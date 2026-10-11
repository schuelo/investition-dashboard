import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runSignalAnalysis, callSignalAi, SignalError } from '../supabase/functions/_shared/signal-service.mjs';
// Execute the actual TS entry point, stripped with Node, against isolated Supabase IO.
const code = stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/analyze-signal-path/index.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
const sample=Array.from({length:220},(_,i)=>{const d=new Date();d.setUTCDate(d.getUTCDate()-220+i);const c=100*Math.exp(.001*i+.01*Math.sin(i));return{date:d.toISOString().slice(0,10),open:c,high:c*1.02,low:c*.98,close:c,volume:1e6};});
function handler({authenticated=true,secrets={},news=[],triggers=[],fetchImpl=async()=>{assert.fail('No network expected');}}={}) {
  let serve,calls=[],reads=[],rpcs=[];
  const chain=table=>{
    let mutation; const filters=[];
    const data=()=> (table==='market_news'?news:table==='signal_news_triggers'?triggers:[]).filter(row=>filters.every(([key,value])=>row[key]===value));
    const q={select:()=>q,eq:(key,value)=>{filters.push([key,value]);reads.push({table,key,value});return q;},gte:()=>q,contains:()=>q,order:()=>q,limit:()=>q,
      insert:r=>{calls.push({table,row:r});return q;},upsert:()=>q,update:r=>{mutation=r;return q;},
      maybeSingle:async()=>({data:table==='signal_market_cache'?{bars:sample,provider:'EODHD EOD',fetched_at:new Date().toISOString()}:data()[0]||null}),single:async()=>({data:{id:'sim1'}}),
      then:resolve=>{if(mutation){calls.push({table,row:mutation,filters});data().forEach(row=>Object.assign(row,mutation));}resolve({data:data(),error:null});}
    };return q;
  };
  const createClient=()=>({auth:{getUser:async()=>({data:{user:authenticated?{id:'verified-user'}:null},error:authenticated?null:{message:'invalid'}})},from:chain,rpc:async(name,args)=>{rpcs.push({name,args});return{data:true};}});
  const Deno={env:{get:k=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'public-test',SUPABASE_SERVICE_ROLE_KEY:'service-test',...secrets}[k])},serve:f=>{serve=f;}};
  new Function('createClient','corsHeaders','jsonHeaders','runSignalAnalysis','callSignalAi','SignalError','Deno',code)(createClient,{'Access-Control-Allow-Origin':'*'},{'Content-Type':'application/json'},runSignalAnalysis,args=>callSignalAi({...args,fetchImpl}),SignalError,Deno);
  return { serve,calls,reads,rpcs };
}
test('Edge refuses anonymous and invalid sessions before touching data',async()=> {
  const a=handler(),r=await a.serve(new Request('https://test',{method:'POST',body:'{}'}));assert.equal(r.status,401);assert.equal(a.calls.length,0);
  const b=handler({authenticated:false}),s=await b.serve(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer invalid'},body:'{}'}));assert.equal(s.status,401);assert.equal(b.calls.length,0);
});
test('Edge handles preflight, wrong method and malformed JSON',async()=> {
  const a=handler();
  assert.equal((await a.serve(new Request('https://test',{method:'OPTIONS'}))).status,200);
  assert.equal((await a.serve(new Request('https://test'))).status,405);
  assert.equal((await a.serve(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer valid'},body:'broken'}))).status,400);
});
test('Edge analysis saves only under authenticated identity, ignoring user_id in body',async()=> {
  const a=handler();
  const res=await a.serve(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer valid'},body:JSON.stringify({symbol:'NVDA.US',currency:'USD',days:20,use_ai:false,user_id:'attacker-selected'})}));
  assert.equal(res.status,200); const data=await res.json();assert.equal(data.ok,true);assert.equal(data.analysis.id,'sim1');assert.equal(data.analysis.narrative.mode,'rules');
  assert.equal(a.calls[0].table,'signal_simulations');assert.equal(a.calls[0].row.user_id,'verified-user');
});

test('Actual Edge handler selects Gemini from server secrets and persists provider metadata',async()=> {
  const news=[{id:'edge-news',title:'Nvidia company news',symbols:['NVDA.US'],published_at:new Date(Date.now()-3600000).toISOString(),is_published:true}];
  const a=handler({secrets:{SIGNAL_AI_PROVIDER:'gemini',GEMINI_API_KEY:'edge-test',GEMINI_MODEL:'gemini-3.5-flash-lite'},news,fetchImpl:async(url,init)=>{
    assert.match(url,/generativelanguage\.googleapis\.com/);assert.equal(init.headers['x-goog-api-key'],'edge-test');
    return{ok:true,status:200,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({summary:'Aktuelle Meldung geprüft.',bias:'neutral',confidence:30,evidence:[],risks:[],watchpoints:[]})}]}}]})};
  }});
  const res=await a.serve(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer valid'},body:JSON.stringify({symbol:'NVDA.US',currency:'USD',days:20,manual_start:true,ai_provider:'openai'})}));
  assert.equal(res.status,200);const data=await res.json();assert.equal(data.analysis.ai.provider,'gemini');assert.equal(data.analysis.narrative.mode,'ai');
  assert.equal(a.calls[0].row.raw_result.ai.provider,'gemini');
});

test('Actual Edge handler returns chart analysis on Gemini quota exhaustion without paid fallback',async()=> {
  let requests=0;
  const a=handler({secrets:{SIGNAL_AI_PROVIDER:'gemini',GEMINI_API_KEY:'edge-test',GEMINI_MODEL:'gemini-3.5-flash-lite',OPENAI_API_KEY:'paid-test',OPENAI_MODEL:'test-model'},news:[{id:'edge-news',title:'Nvidia news',symbols:['NVDA.US'],published_at:new Date(Date.now()-3600000).toISOString(),is_published:true}],fetchImpl:async url=>{
    requests++;assert.match(url,/generativelanguage\.googleapis\.com/);return{ok:false,status:429};
  }});
  const res=await a.serve(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer valid'},body:JSON.stringify({symbol:'NVDA.US',currency:'USD',days:20,manual_start:true,news_impulse:true})}));
  assert.equal(res.status,200);const data=await res.json();assert.equal(data.analysis.narrative.mode,'rules');assert.equal(data.analysis.ai,null);
  assert.equal(data.analysis.simulation.newsBias,0);assert.match(data.analysis.warnings.join(),/Gemini-Kontingent/);assert.equal(requests,1);
});

const triggerId='11111111-1111-4111-8111-111111111111',newsId='22222222-2222-4222-8222-222222222222';
const manualRequest=extra=>new Request('https://test',{method:'POST',headers:{Authorization:'Bearer valid'},body:JSON.stringify({symbol:'NVDA.US',currency:'USD',days:20,manual_start:true,trigger_id:triggerId,...extra})});
test('Actual Edge entry rejects missing manual flag before reserving quota',async()=>{
  const a=handler();const r=await a.serve(manualRequest({manual_start:false}));assert.equal(r.status,400);assert.match((await r.json()).error,/manuell/);assert.equal(a.calls.length,0);assert.equal(a.rpcs.length,0);
});
test('Actual Edge entry cannot read a trigger belonging to another user',async()=>{
  const a=handler({triggers:[{id:triggerId,user_id:'another-user',news_id:newsId}],news:[{id:newsId,is_published:true,title:'Public article'}]});
  const r=await a.serve(manualRequest({source_news_id:newsId,user_id:'another-user'}));assert.equal(r.status,404);assert.equal(a.rpcs.length,0);assert.equal(a.calls.length,0);
  assert.ok(a.reads.some(row=>row.table==='signal_news_triggers'&&row.key==='user_id'&&row.value==='verified-user'));
  assert.equal(a.reads.some(row=>row.table==='market_news'),false);
});
test('Actual Edge entry rejects unpublished or inconsistent selected sources',async()=>{
  for(const changes of [{is_published:false},{is_published:true,source_news_id:'33333333-3333-4333-8333-333333333333'}]){
    const a=handler({triggers:[{id:triggerId,user_id:'verified-user',news_id:newsId}],news:[{id:newsId,title:'Selected article',is_published:changes.is_published}]});
    const r=await a.serve(manualRequest(changes.source_news_id?{source_news_id:changes.source_news_id}:{}));assert.equal(r.status,404);assert.equal(a.rpcs.length,0);
  }
});
test('Actual Edge entry saves and completes only its authenticated user trigger after Gemini success',async()=>{
  let requests=0;const selected={id:newsId,is_published:true,title:'Original event selected manually',symbols:['DIFFERENT.US'],published_at:new Date(Date.now()-3600000).toISOString()};
  const a=handler({triggers:[{id:triggerId,user_id:'verified-user',news_id:newsId},{id:triggerId,user_id:'another-user',news_id:newsId}],news:[selected],secrets:{SIGNAL_AI_PROVIDER:'gemini',GEMINI_API_KEY:'fixture',GEMINI_MODEL:'gemini-3.5-flash-lite'},fetchImpl:async(url,init)=>{
    requests++;assert.match(init.body,/Original event selected manually/);return{ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({summary:'Originalmeldung geprüft.',bias:'neutral',confidence:30,evidence:[],risks:[],watchpoints:[]})}]}}]})};
  }});
  const r=await a.serve(manualRequest({user_id:'another-user'}));assert.equal(r.status,200);const result=await r.json();assert.equal(result.analysis.origin.news_id,newsId);assert.equal(result.analysis.sources[0].match,'selected');assert.equal(requests,1);
  const finished=a.calls.find(row=>row.table==='signal_news_triggers');assert.equal(finished.row.state,'analyzed');assert.deepEqual(finished.filters,[['id',triggerId],['user_id','verified-user']]);
  assert.equal(a.calls.find(row=>row.table==='signal_simulations').row.user_id,'verified-user');
});
