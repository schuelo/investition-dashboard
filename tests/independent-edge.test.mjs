import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {resolveSecurity,SecurityError,readProviderJson} from '../supabase/functions/_shared/security-resolver.mjs';
import {resolveIndependentSecurity,publicMetadata} from '../supabase/functions/_shared/independent-security.mjs';
import {loadPublicMarket,publicMarketAdapters} from '../supabase/functions/_shared/independent-market.mjs';
import {runSignalAnalysis,callSignalAi,SignalError} from '../supabase/functions/_shared/signal-service.mjs';
import {runDeepAnalysis,runDeepEvaluation,callDeepGemini} from '../supabase/functions/_shared/deep-service.mjs';
import {deepBars} from '../supabase/functions/_shared/deep-engine.mjs';
import {identity,independentInput,chartPayload,makeBars} from './fixtures/independent-market.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function harness(name,{authenticated=true,chartStatus=200,missingSchema=false}={}) {
  let serve;const reads=[],writes=[],rpcs=[],requests=[];
  const query=table=>{
    const filters=[];const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);reads.push({table,k,v});return q;},gte:()=>q,contains:()=>q,order:()=>q,limit:()=>q,in:()=>q,
      insert:row=>{writes.push({table,row});return q;},upsert:row=>{writes.push({table,row});return q;},update:()=>q,
      maybeSingle:async()=>({data:null,error:missingSchema&&table==='independent_market_cache'?{message:'missing'}:null}),single:async()=>({data:{id:'11111111-1111-4111-8111-111111111111'},error:null}),then:fn=>fn({data:[],error:null})};return q;
  };
  const createClient=()=>({auth:{getUser:async()=>({data:{user:authenticated?{id:'owner'}:null},error:null})},from:query,rpc:async(name,args)=>{rpcs.push({name,args});if(name==='reserve_hybrid_eodhd_calls')assert.fail('EOD quota accessed');return {data:true,error:missingSchema&&name==='reserve_independent_data'?{message:'missing'}:null};}});
  const fetchImpl=async(url,options)=>{
    requests.push({url:String(url),options});const host=new URL(url).hostname;
    if(host==='api.openfigi.com')return new Response(JSON.stringify(JSON.parse(options.body).map(()=>({data:[identity]}))));
    if(host==='query1.finance.yahoo.com')return new Response(chartStatus===200?JSON.stringify(chartPayload({bars:makeBars(300,new Date())})):'{}',{status:chartStatus});
    assert.fail('Unexpected provider '+host);
  };
  const Deno={env:{get:key=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service'})[key]},serve:handler=>serve=handler};
  const forbidden=()=>assert.fail('No research or AI expected');
  const deps={createClient,corsHeaders:{'Access-Control-Allow-Origin':'*'},jsonHeaders:{'Content-Type':'application/json'},resolveSecurity,SecurityError,readProviderJson,resolveIndependentSecurity,publicMetadata,loadPublicMarket,publicMarketAdapters:(admin,userId)=>publicMarketAdapters(admin,userId,fetchImpl),runSignalAnalysis,callSignalAi,SignalError,runDeepAnalysis,runDeepEvaluation,callDeepGemini,deepBars,discoverFreeSources:forbidden,parseRss:forbidden,loadSecFundamentals:forbidden,loadManualSources:forbidden,pinnedHttpsPage:forbidden,Deno,fetch:fetchImpl};
  const code=stripTypeScriptTypes(read('supabase/functions/'+name+'/index.ts')).replace(/^import .*;$/gm,'');new Function(...Object.keys(deps),code)(...Object.values(deps));
  const request=body=>new Request('https://edge.test',{method:'POST',headers:{Authorization:'Bearer valid'},body:JSON.stringify(body)});
  return{serve,request,reads,writes,rpcs,requests};
}
for(const name of ['resolve-security','analyze-signal-path','analyze-deep-signal']) {
  test(name+': authenticated independent capability check consumes no quota and performs no IO',async()=>{
    const h=harness(name),r=await h.serve(h.request({action:'capabilities'}));assert.equal(r.status,200);assert.ok((await r.json()).features.includes('independent_market_v36'));assert.equal(h.rpcs.length,0);assert.equal(h.reads.length,0);assert.equal(h.requests.length,0);
    const no=harness(name,{authenticated:false});assert.equal((await no.serve(no.request({action:'capabilities'}))).status,401);assert.equal(no.rpcs.length,0);
  });
}
test('Actual independent WKN edge needs no EODHD token and no EODHD quota RPC',async()=>{
  const h=harness('resolve-security'),r=await h.serve(h.request({query:'860180',preferred_exchange:'XETRA',manual_start:true,catalogue_source:'independent',quote_metadata:true,user_id:'foreign'}));assert.equal(r.status,200);const c=(await r.json()).resolution.candidates[0];assert.equal(c.market_symbol,'SND.XETRA');assert.equal(c.currency,'EUR');assert.equal(c.eodhd_verified,false);assert.deepEqual(h.rpcs.map(r=>r.name),['reserve_independent_data','reserve_independent_data']);assert.ok(h.rpcs.every(r=>r.args.p_user_id==='owner'));assert.deepEqual(h.requests.map(r=>new URL(r.url).hostname),['api.openfigi.com','query1.finance.yahoo.com']);assert.equal(h.writes[0].row.user_id,'owner');assert.match(h.writes[0].row.lookup_key,/^F1:/);
});
test('Actual WKN CSV-only lookup does not call any price provider',async()=>{
  const h=harness('resolve-security'),r=await h.serve(h.request({query:'860180',manual_start:true,catalogue_source:'independent',quote_metadata:false}));assert.equal(r.status,200);assert.equal(h.requests.length,1);assert.equal((await r.json()).resolution.candidates[0].currency,null);
});
for(const name of ['analyze-signal-path','analyze-deep-signal']) {
  test(name+': actual public-source analysis has no EODHD secret, no legacy market reads and owner-only cache',async()=>{
    const h=harness(name),r=await h.serve(h.request({...independentInput,user_id:'foreign'}));assert.equal(r.status,200,JSON.stringify(await r.clone().json()));const a=(await r.json()).analysis;assert.equal(a.market_data.eodhd_used,false);assert.equal(a.market_data.quote_symbol,'SND.DE');assert.equal(h.requests.length,1);assert.ok(h.reads.every(r=>!['signal_market_cache','hybrid_market_cache'].includes(r.table)));assert.ok(h.reads.some(r=>r.table==='independent_market_cache'&&r.k==='user_id'&&r.v==='owner'));assert.ok(h.writes.every(w=>w.row.user_id==='owner'));assert.ok(h.writes.some(w=>w.table==='independent_market_cache'));
  });
  test(name+': provider 429 stops before AI/storage and never triggers EODHD fallback',async()=>{
    const h=harness(name,{chartStatus:429}),r=await h.serve(h.request(independentInput));assert.equal(r.status,429);assert.match((await r.json()).error,/eigenes Limit/);assert.equal(h.requests.length,1);assert.equal(h.writes.length,0);assert.ok(h.rpcs.every(r=>!r.name.includes('eodhd')));
  });
  test(name+': CSV runs without any quote service and records CSV provenance',async()=>{
    const h=harness(name),r=await h.serve(h.request({...independentInput,bars:makeBars(300,new Date())}));assert.equal(r.status,200);assert.equal((await r.json()).analysis.market_data.source,'csv');assert.equal(h.requests.length,0);assert.ok(h.writes.every(w=>w.table!=='independent_market_cache'&&w.table!=='signal_market_cache'));
  });
}
test('Missing V36 schema is a 503 installation error, not an exhausted EODHD quota message',async()=>{
  const h=harness('analyze-deep-signal',{missingSchema:true}),r=await h.serve(h.request(independentInput));assert.equal(r.status,503);assert.match((await r.json()).error,/V36/);assert.equal(h.requests.length,0);
});
test('Additive SQL isolates independent counters/cache and V36 workflow deploys all four required functions',()=>{
  const sql=read('setup-v36-independent.sql');assert.equal((sql.match(/enable row level security/g)||[]).length,2);assert.match(sql,/using\(user_id=auth.uid\(\)\)/);assert.match(sql,/independent_data_usage.runs<40/);assert.match(sql,/revoke all on function.*from public,anon,authenticated/);assert.doesNotMatch(sql,/cron\.|reserve_hybrid_eodhd|alter table public.trade_plans|drop table/i);
  const workflow=read('.github/workflows/deploy-v36-complete.yml');assert.equal((workflow.match(/supabase functions deploy/g)||[]).length,4);for(const name of ['resolve-security','analyze-signal-path','analyze-deep-signal','paper-benchmark'])assert.ok(workflow.includes('deploy '+name));assert.doesNotMatch(workflow,/deploy send-news|deploy sync-news|cron/);assert.match(workflow,/set-version\.mjs --check/);
});
