import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runSignalAnalysis, callOpenAi, SignalError } from '../supabase/functions/_shared/signal-service.mjs';
// Execute the actual TS entry point, stripped with Node, against isolated Supabase IO.
const code = stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/analyze-signal-path/index.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
const sample=Array.from({length:220},(_,i)=>{const d=new Date();d.setUTCDate(d.getUTCDate()-220+i);const c=100*Math.exp(.001*i+.01*Math.sin(i));return{date:d.toISOString().slice(0,10),open:c,high:c*1.02,low:c*.98,close:c,volume:1e6};});
function handler({authenticated=true}={}) {
  let serve,calls=[];
  const chain=table=>{ let row;const q={select:()=>q,eq:()=>q,gte:()=>q,contains:()=>q,order:()=>q,limit:()=>q,insert:r=>{row=r;calls.push({table,row:r});return q;},upsert:()=>q,maybeSingle:async()=>({data:table==='signal_market_cache'?{bars:sample,provider:'EODHD EOD',fetched_at:new Date().toISOString()}:null}),single:async()=>({data:{id:'sim1'}}),then:(resolve)=>resolve({data:[],error:null})};return q;};
  const createClient=()=>({auth:{getUser:async()=>({data:{user:authenticated?{id:'verified-user'}:null},error:authenticated?null:{message:'invalid'}})},from:chain,rpc:async()=>({data:true})});
  const Deno={env:{get:k=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'public-test',SUPABASE_SERVICE_ROLE_KEY:'service-test'}[k])},serve:f=>{serve=f;}};
  new Function('createClient','corsHeaders','jsonHeaders','runSignalAnalysis','callOpenAi','SignalError','Deno',code)(createClient,{'Access-Control-Allow-Origin':'*'},{'Content-Type':'application/json'},runSignalAnalysis,callOpenAi,SignalError,Deno);
  return { serve,calls };
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
