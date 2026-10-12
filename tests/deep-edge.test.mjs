import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runDeepAnalysis,runDeepEvaluation,callDeepGemini} from '../supabase/functions/_shared/deep-service.mjs';
import {deepBars,validateDeepInput,buildDeepAnalysis} from '../supabase/functions/_shared/deep-engine.mjs';
import {SignalError} from '../supabase/functions/_shared/signal-service.mjs';
const code=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/analyze-deep-signal/index.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
const bars=Array.from({length:250},(_,i)=>{const d=new Date();d.setUTCDate(d.getUTCDate()-260+i);const close=100*Math.exp(.001*i+.01*Math.sin(i));return {date:d.toISOString().slice(0,10),open:close,high:close*1.01,low:close*.99,close,volume:1e6};});
const id='11111111-1111-4111-8111-111111111111';
function harness({authenticated=true,analyses=[],triggers=[],quota=true}={}) {
  let serve;const writes=[],reads=[],rpcs=[];
  const chain=table=>{
    const filters=[];let inserted;
    const selected=()=>{
      const data=table==='deep_analyses'?analyses:table==='signal_news_triggers'?triggers:[];
      return data.filter(r=>filters.every(([k,v])=>r[k]===v));
    };
    const q={
      select:()=>q,eq:(k,v)=>{filters.push([k,v]);reads.push({table,k,v});return q;},gte:()=>q,contains:()=>q,order:()=>q,limit:()=>q,
      in:(k,values)=>{const result=selected().filter(r=>values.includes(r[k]));q.then=fn=>fn({data:result,error:null});return q;},
      insert:r=>{inserted=r;writes.push({table,row:r});return q;},upsert:r=>{writes.push({table,row:r});return q;},
      single:async()=>({data:{id},error:null}),maybeSingle:async()=>({data:selected()[0] || null,error:null}),
      then:fn=>fn({data:inserted?[inserted]:selected(),error:null})
    };return q;
  };
  const createClient=()=>({auth:{getUser:async()=>({data:{user:authenticated?{id:'owner'}:null},error:authenticated?null:{}})},from:chain,
    rpc:async(name,args)=>{rpcs.push({name,args});return {data:quota,error:null};}});
  const Deno={env:{get:k=>({SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private'})[k]},serve:f=>{serve=f;}};
  const discoverFreeSources=async()=>{throw new Error('Research must be disabled in these tests.');};
  const loadSecFundamentals=async()=>{throw new Error('SEC must be disabled in these tests.');};
  new Function('createClient','corsHeaders','jsonHeaders','runDeepAnalysis','runDeepEvaluation','callDeepGemini','deepBars','SignalError','discoverFreeSources','parseRss','loadSecFundamentals','Deno',code)(
    createClient,{'Access-Control-Allow-Origin':'*'},{'Content-Type':'application/json'},runDeepAnalysis,runDeepEvaluation,callDeepGemini,deepBars,SignalError,discoverFreeSources,()=>[],loadSecFundamentals,Deno);
  return {serve,writes,reads,rpcs};
}
const req=body=>new Request('https://test',{method:'POST',headers:{Authorization:'Bearer valid'},body:JSON.stringify(body)});
const body={action:'analyze',symbol:'NVDA.US',currency:'USD',days:20,use_ai:false,manual_start:true,research:false,bars};
test('Actual V32 edge validates user session before any data access',async()=>{
  const a=harness();assert.equal((await a.serve(new Request('https://test',{method:'POST',body:'{}'}))).status,401);
  const b=harness({authenticated:false});assert.equal((await b.serve(req(body))).status,401);assert.equal(b.writes.length,0);assert.equal(b.rpcs.length,0);
});
test('Actual V32 edge handles OPTIONS, methods and malformed payloads',async()=>{
  const a=harness();assert.equal((await a.serve(new Request('https://test',{method:'OPTIONS'}))).status,200);
  assert.equal((await a.serve(new Request('https://test'))).status,405);
  assert.equal((await a.serve(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer valid'},body:'{' }))).status,400);
  assert.equal((await a.serve(req(null))).status,400);assert.equal((await a.serve(req([]))).status,400);
});
test('Actual edge rejects malformed older OHLCV rows with actionable 422',async()=>{
  const a=harness();const r=await a.serve(req({...body,bars:[{...bars[0],low:1e9},...bars.slice(1)]}));
  assert.equal(r.status,422);assert.match((await r.json()).error,/Kursdaten/);assert.equal(a.writes.length,0);
});
test('Actual edge ignores supplied user_id and stores CSV only in the owner forecast',async()=>{
  const a=harness(),r=await a.serve(req({...body,user_id:'foreign-user'}));assert.equal(r.status,200);
  const result=await r.json();assert.equal(result.analysis.id,id);assert.equal(result.analysis.narrative.mode,'rules');
  const saved=a.writes.find(w=>w.table==='deep_analyses');
  assert.equal(saved.row.user_id,'owner');assert.equal(saved.row.raw_result.request.bars,undefined);
  assert.equal(a.writes.filter(w=>w.table==='signal_market_cache').length,0);
  assert.equal(a.rpcs[0].name,'reserve_signal_analysis_run');
});
test('Actual edge scopes previous forecasts and triggers to owner before quota',async()=>{
  const input=validateDeepInput(body),analysis=buildDeepAnalysis(input,bars);
  const a=harness({analyses:[{id,user_id:'foreign',symbol:'NVDA.US',raw_result:analysis}]});
  assert.equal((await a.serve(req({...body,prior_ids:[id]}))).status,404);assert.equal(a.rpcs.length,0);
  assert.ok(a.reads.some(r=>r.table==='deep_analyses'&&r.k==='user_id'&&r.v==='owner'));
  const b=harness({triggers:[{id,user_id:'foreign',news_id:id}]});
  assert.equal((await b.serve(req({...body,trigger_id:id}))).status,404);assert.equal(b.rpcs.length,0);
});
test('Actual edge quota rejection makes no writes',async()=>{
  const a=harness({quota:false});assert.equal((await a.serve(req(body))).status,429);assert.equal(a.writes.length,0);
});
test('Actual evaluation uses supplied CSV, own analysis and separate quota; original not updated',async()=>{
  const input=validateDeepInput({...body,days:5}),analysis=buildDeepAnalysis(input,bars.slice(0,-10));
  const a=harness({analyses:[{id,user_id:'owner',symbol:'NVDA.US',raw_result:analysis}]});
  const r=await a.serve(req({action:'evaluate',analysis_id:id,manual_start:true,bars}));
  assert.equal(r.status,200);assert.equal((await r.json()).evaluation.matured,true);
  assert.equal(a.rpcs[0].name,'reserve_deep_evaluation');
  assert.equal(a.writes[0].table,'deep_evaluations');assert.equal(a.writes[0].row.user_id,'owner');
  assert.equal(a.writes.filter(w=>w.table==='deep_analyses').length,0);
});
