import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {resolveSecurity,SecurityError,readProviderJson} from '../supabase/functions/_shared/security-resolver.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const code=stripTypeScriptTypes(read('supabase/functions/resolve-security/index.ts')).replace(/^import .*;$/gm,'');
const proof={figi:'BBG000A00001',shareClassFIGI:'BBG000S00001',name:'SCHNEIDER ELECTRIC SE',ticker:'SND',exchCode:'GY',marketSector:'Equity',securityType:'Common Stock',securityType2:'Common Stock'};
const row={Code:'SND',Exchange:'XETRA',Name:'Schneider Electric SE',Currency:'EUR',ISIN:'FR0000121972',Type:'Common Stock'};
function harness({authenticated=true,cache=null,quota=true,eodToken='private-eod-token'}={}) {
  let serve;const reads=[],writes=[],rpcs=[],requests=[];
  const createClient=()=>({auth:{getUser:async()=>({data:{user:authenticated?{id:'owner'}:null},error:null})},from:table=>{const q={select:()=>q,eq:(k,v)=>{reads.push({table,k,v});return q;},maybeSingle:async()=>({data:cache?{result:cache}:null,error:null}),upsert:async data=>{writes.push({table,data});return{error:null};}};return q;},rpc:async(name,args)=>{rpcs.push({name,args});return{data:quota,error:null};}});
  const Deno={env:{get:k=>({SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private-service-role',EODHD_API_TOKEN:eodToken})[k]},serve:fn=>serve=fn};
  const fetch=async(url,options={})=>{requests.push({url,options});return Response.json(new URL(url).hostname==='api.openfigi.com'?JSON.parse(options.body).map(()=>({data:[proof]})):[row]);};
  new Function('Deno','createClient','corsHeaders','jsonHeaders','resolveSecurity','SecurityError','readProviderJson','fetch',code)(Deno,createClient,{}, {'Content-Type':'application/json'},resolveSecurity,SecurityError,readProviderJson,fetch);
  return {serve,reads,writes,rpcs,requests};
}
const req=body=>new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer valid'},body:JSON.stringify(body)}),body={query:'860180',manual_start:true};
test('Actual WKN edge authenticates before all provider/cache/quota access',async()=>{
  const h=harness({authenticated:false});assert.equal((await h.serve(req(body))).status,401);assert.equal(h.reads.length,0);assert.equal(h.rpcs.length,0);assert.equal(h.requests.length,0);assert.equal(h.writes.length,0);
  assert.equal((await harness().serve(new Request('https://example.test',{method:'POST'}))).status,401);
});
test('Actual WKN edge validates explicit intent, methods and payload size',async()=>{
  const h=harness();assert.equal((await h.serve(new Request('https://example.test'))).status,405);assert.equal((await h.serve(new Request('https://example.test',{method:'OPTIONS'}))).status,200);
  for(const b of [null,[],{}, {...body,query:'bad'}, {...body,manual_start:false}])assert.ok((await h.serve(req(b))).status>=400);
  assert.equal((await h.serve(req({query:'x'.repeat(1600)}))).status,413);assert.equal(h.requests.length,0);
});
test('Actual WKN edge ignores claimed owner and writes only its reference-data cache',async()=>{
  const h=harness(),r=await h.serve(req({...body,user_id:'foreign'}));assert.equal(r.status,200);const json=await r.json();assert.equal(json.resolution.candidates[0].market_symbol,'SND.XETRA');assert.equal(h.writes.length,1);assert.equal(h.writes[0].table,'security_lookup_cache');assert.equal(h.writes[0].data.user_id,'owner');assert.ok(h.reads.some(r=>r.k==='user_id'&&r.v==='owner'));assert.equal(h.rpcs.find(r=>r.name==='reserve_security_lookup').args.p_user_id,'owner');assert.doesNotMatch(JSON.stringify(json),/private-eod|private-service|api_token|x-openfigi-apikey/i);
});
test('Actual WKN edge uses the existing global EODHD budget and fixed API hosts',async()=>{
  const h=harness();await h.serve(req(body));assert.deepEqual(h.rpcs.find(r=>r.name==='reserve_hybrid_eodhd_calls').args,{p_calls:1,p_daily_limit:6});assert.equal(h.requests.length,3);assert.ok(h.requests.every(r=>['api.openfigi.com','eodhd.com'].includes(new URL(r.url).hostname)));assert.ok(h.requests.every(r=>r.options.redirect==='error'));assert.ok(h.requests.every(r=>!r.options.headers?.Authorization));assert.match(String(h.requests.find(r=>new URL(r.url).hostname==='eodhd.com').url),/private-eod-token/);
});
test('Actual WKN edge quota stops provider calls and never falls back to AI or another vendor',async()=>{
  const h=harness({quota:false});assert.equal((await h.serve(req(body))).status,429);assert.equal(h.requests.length,0);assert.equal(h.writes.length,0);
  const text=read('supabase/functions/resolve-security/index.ts');assert.doesNotMatch(text,/gemini|generativelanguage|OpenAI|api\/id-mapping|from\(['"]trade_plans|from\(['"]depot_positions/i);
});
test('Actual WKN edge rejects the demo token before any EODHD request',async()=>{
  const h=harness({eodToken:'demo'});const r=await h.serve(req(body));assert.equal(r.status,503);assert.match((await r.json()).error,/Demo-Token/);assert.ok(h.requests.every(r=>new URL(r.url).hostname!=='eodhd.com'));
});
test('WKN SQL keeps cache owner-scoped and cache/usage writes service-only',()=>{
  const sql=read('setup-v35-wkn.sql');assert.equal((sql.match(/enable row level security/g)||[]).length,2);assert.match(sql,/using\(user_id=auth.uid\(\)\)/);assert.match(sql,/security_lookup_usage.runs<20/);assert.match(sql,/interval '3 seconds'/);assert.match(sql,/revoke all on function.*from public,anon,authenticated/);assert.doesNotMatch(sql,/cron\.|alter table public.trade_plans|drop table/i);
});
test('V35 complete workflow publishes the resolver alongside prior modules and checks release',()=>{
  const workflow=read('.github/workflows/deploy-v35-complete.yml');assert.match(workflow,/set-version\.mjs --check/);assert.match(workflow,/build-update-sql\.mjs --check/);assert.match(workflow,/deploy resolve-security/);assert.match(workflow,/deploy analyze-deep-signal/);assert.match(workflow,/deploy paper-benchmark/);assert.equal((workflow.match(/supabase functions deploy/g)||[]).length,3);assert.doesNotMatch(workflow,/cron|deploy sync-news|deploy send-news/);
});
