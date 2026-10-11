import test from 'node:test';
import assert from 'node:assert/strict';
import { runSignalAnalysis, validateSignalInput } from '../supabase/functions/_shared/signal-service.mjs';
import { selectNews } from '../supabase/functions/_shared/signal-engine.mjs';
const now=new Date('2026-10-11T05:00:00Z');
const newsId='22222222-2222-4222-8222-222222222222',triggerId='11111111-1111-4111-8111-111111111111';
const input={symbol:'NVDA.US',currency:'USD',days:20,use_ai:true,manual_start:true,trigger_id:triggerId};
const source={id:newsId,title:'Selected supply-chain event',symbols:[],is_published:true,published_at:'2026-10-10T03:00:00Z'};
const narrative={summary:'Die manuell ausgewählte Quelle könnte indirekt relevant sein.',bias:'neutral',confidence:30,evidence:[{source_id:newsId,inference:'Unternehmensbezug muss geprüft werden.'}],risks:[],watchpoints:[]};
const bars=Array.from({length:220},(_,i)=>{const date=new Date('2026-10-09');date.setUTCDate(date.getUTCDate()-219+i);const close=100*Math.exp(.001*i+.01*Math.sin(i));return{date:date.toISOString().slice(0,10),open:close,high:close*1.02,low:close*.98,close,volume:1e6};});
const deps=(overrides={})=>({now,readOrigin:async()=>({news:source}),reserveRun:async()=>true,readCache:async()=>({bars,provider:'test',fetched_at:now.toISOString()}),readNews:async()=>[],analyzeNews:async()=>narrative,saveResult:async()=> '33333333-3333-4333-8333-333333333333',finishTrigger:async()=>{},...overrides});

test('AI request without manual_start is rejected before any budget or provider access',async()=>{
  const body={...input};delete body.manual_start;
  await assert.rejects(()=>runSignalAnalysis(body,deps({reserveRun:async()=>assert.fail('Budget must not be touched'),readOrigin:async()=>assert.fail('Origin must not be read')})),error=>error.status===400&&/manuell/.test(error.message));
  assert.equal(validateSignalInput({...body,use_ai:false}).use_ai,false);
});
test('Invalid news references are rejected before requests',()=>{
  for(const patch of [{trigger_id:'https://bad.test'},{source_news_id:'not-a-uuid'}])assert.throws(()=>validateSignalInput({...input,...patch}),/Meldungsreferenz/);
});
test('Unavailable or foreign trigger is rejected before reserving quota',async()=>{
  await assert.rejects(()=>runSignalAnalysis(input,deps({readOrigin:async()=>null,reserveRun:async()=>assert.fail('No quota for inaccessible trigger')})),error=>error.status===404);
});
test('Selected original feed is prioritised and labelled separately from direct symbol evidence',()=>{
  const others=Array.from({length:20},(_,i)=>({id:'direct'+i,title:'Nvidia item '+i,symbols:['NVDA.US'],published_at:'2026-10-10T04:00:00Z'}));
  const selected=selectNews([...others,source],'NVDA.US','','',now,[newsId]);
  assert.equal(selected.length,12);assert.equal(selected[0].id,newsId);assert.equal(selected[0].match,'selected');
  assert.equal(selectNews([source],'NVDA.US','','',now).length,0);
});
test('Manual trigger origin reaches AI and is recorded in history only after validation',async()=>{
  let marked,saved;
  const result=await runSignalAnalysis(input,deps({analyzeNews:async(_input,_chart,sources)=>{assert.equal(sources[0].id,newsId);return narrative;},saveResult:async(_input,analysis)=>{saved=structuredClone(analysis);return 'analysis-id';},finishTrigger:async(id,analysisId)=>{marked={id,analysisId};}}));
  assert.equal(result.analysis.origin.included,true);assert.equal(saved.origin.news_id,newsId);assert.equal(result.analysis.request.manual_start,true);
  assert.deepEqual(marked,{id:triggerId,analysisId:'analysis-id'});
});
test('Gemini fallback keeps trigger pending and cannot introduce a news impulse',async()=>{
  const result=await runSignalAnalysis({...input,news_impulse:true},deps({analyzeNews:async()=>{throw new Error('Gemini-Kontingent erreicht');},finishTrigger:async()=>assert.fail('Fallback is not successful AI')}));
  assert.equal(result.analysis.narrative.mode,'rules');assert.equal(result.analysis.simulation.newsBias,0);assert.equal(result.analysis.origin.included,true);
});
test('Expired selected feed is excluded even when it was explicitly selected',async()=>{
  const result=await runSignalAnalysis(input,deps({readOrigin:async()=>({news:{...source,published_at:'2026-09-01'}}),analyzeNews:async()=>assert.fail('No current evidence'),finishTrigger:async()=>assert.fail('Do not mark expired feed')}));
  assert.equal(result.analysis.origin.included,false);assert.equal(result.analysis.narrative.mode,'rules');assert.match(result.analysis.warnings.join(),/älter als 14 Tage/);
});
test('History failure cannot mark trigger analyzed; marking failure does not lose saved report',async()=>{
  const unsaved=await runSignalAnalysis(input,deps({saveResult:async()=>{throw new Error('history unavailable');},finishTrigger:async()=>assert.fail('No history association')}));
  assert.equal(unsaved.ok,true);assert.equal(unsaved.analysis.id,undefined);
  const unmarked=await runSignalAnalysis(input,deps({finishTrigger:async()=>{throw new Error('queue unavailable');}}));
  assert.equal(unmarked.ok,true);assert.ok(unmarked.analysis.id);assert.match(unmarked.analysis.warnings.join(),/als analysiert/);
});
