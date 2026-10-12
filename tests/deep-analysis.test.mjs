import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateDeepInput,buildDeepAnalysis,deepBars,weeklyBars,simulateDeep,productAnalysis,optionValue,sizing,evaluateForecast,historicalAnalogs} from '../supabase/functions/_shared/deep-engine.mjs';
import {technicals} from '../supabase/functions/_shared/signal-engine.mjs';
import {runDeepAnalysis,runDeepEvaluation,callDeepGemini} from '../supabase/functions/_shared/deep-service.mjs';
import {canonicalUrl,dedupeSources,normalizeSource,discoverFreeSources,relevantNews,fetchSmall} from '../supabase/functions/_shared/deep-sources.mjs';
import {annualSecFacts,loadSecFundamentals} from '../supabase/functions/_shared/deep-fundamentals.mjs';

const now=new Date('2026-10-11T12:00:00Z');
function candles(count=800,end='2026-10-09') {
  const dates=[];let d=new Date(end+'T00:00:00Z');
  while(dates.length<count){if(![0,6].includes(d.getUTCDay()))dates.unshift(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()-1);}
  let p=100;
  return dates.map((date,i)=>{const open=p;p*=Math.exp(.0003+.009*Math.sin(i*1.51));return {date,open,high:Math.max(open,p)*1.008,low:Math.min(open,p)*.992,close:p,volume:1e6*(1+.1*Math.sin(i))};});
}
const raw=candles();
const request=(extra={})=>validateDeepInput({symbol:'NVDA.US',currency:'USD',company:'NVIDIA',days:20,lookback:756,use_ai:false,manual_start:true,...extra});
const source=normalizeSource({url:'https://example.com/news',title:'NVIDIA announces new chip',summary:'NVIDIA confirmed a new product in its public announcement.',published_at:'2026-10-10T10:00:00Z',symbols:['NVDA.US']},now);
const ai={mode:'ai',summary:'Ableitung aus Feed-Auszug.',bias:'bullish',confidence:55,evidence:[{source_id:source.id,inference:'Hypothetischer positiver Impuls.'}],risks:['Ausführung'],watchpoints:['Volumen'],countercase:'Bewertung kann zu hoch sein.',information_gaps:['Konsens fehlt'],scenario_notes:[{scenario_id:'base',assessment:'Bedingtes Szenario.'}],provider:'gemini',model:'gemini-test'};
function adapters(extra={}) {
  const calls={reserve:0,ai:0,market:0,archive:0,save:0,search:0};
  return {calls,deps:{
    now:()=>now,readOrigin:async()=>null,readPrevious:async()=>[],
    reserveRun:async()=>{calls.reserve++;return true;},loadMarket:async()=>{calls.market++;return {bars:raw,provider:'TEST'};},
    readNews:async()=>[{id:'news',source_url:source.url,title:source.title,summary:source.excerpt,published_at:source.published_at,symbols:['NVDA.US']}],
    discoverSources:async()=>{calls.search++;return {sources:[],warnings:[]};},archiveSources:async()=>{calls.archive++;},
    analyze:async()=>{calls.ai++;return ai;},save:async()=>{calls.save++;return '11111111-1111-4111-8111-111111111111';},...extra
  }};
}
test('Independent horizons, lookbacks and news windows are validated; malformed values cannot silently use defaults',()=>{
  assert.equal(request({days:252,news_days:90}).days,252);
  assert.throws(()=>request({days:365}),/Zeitfenster/);assert.throws(()=>request({lookback:10}),/Zeitfenster/);
  assert.throws(()=>request({risk:{budget_pct:10}}),/Risikobudget/);
  assert.throws(()=>request({prior_ids:{}}),/Liste/);
  assert.throws(()=>request({product:{direction:'sideways'}}),/Produktrichtung/);
});
test('Long histories keep 756 candles, validate older rows, and exclude future/incomplete days',()=>{
  const q=deepBars([...raw,{...raw.at(-1),date:'2026-10-11'}],756,now);
  assert.equal(q.bars.length,756);assert.equal(q.ageDays,2);assert.ok(q.notes.some(n=>n.includes('ausgeschlossen')));
  assert.throws(()=>deepBars([{...raw[0],low:1e9},...raw.slice(1)],756,now),/Ungültige OHLC/);
  assert.ok(weeklyBars(q.bars).length>=140);
});
test('Six genuinely different scenarios are reproducible and preserve their bands',()=>{
  const input=request(),bars=deepBars(raw,756,now).bars,chart=technicals(bars);
  const a=simulateDeep(bars,chart,input,123,'technical',100),b=simulateDeep(bars,chart,input,123,'technical',100);
  assert.deepEqual(a.scenarios,b.scenarios);assert.equal(new Set(a.scenarios.map(s=>s.id)).size,6);
  const endpoint=id=>a.scenarios.find(s=>s.id===id).endpoint;
  assert.ok(endpoint('positive')>endpoint('base'));assert.ok(endpoint('negative')<endpoint('base'));
  for(const s of a.scenarios)for(const band of s.bands)assert.ok(band.q10<=band.q50&&band.q50<=band.q90);
  assert.notEqual(a.scenarios.find(s=>s.id==='recovery').bands[1].q50,a.scenarios[0].bands[1].q50);
});
test('Full report separates model families, shows weekly methods, and blocks stale data',()=>{
  const a=buildDeepAnalysis(request(),raw,{now});
  assert.equal(a.models.length,4);assert.equal(a.scenarios.length,6);assert.ok(a.weekly.chart.methods.length>=7);
  assert.equal(a.valuation.available,false);assert.ok(a.setups.every(s=>s.decision==='ABWARTEN / KEIN TRADE'));
  const stale=buildDeepAnalysis(request(),candles(300,'2026-08-01'),{now});
  assert.equal(stale.quality.blocked,true);assert.ok(stale.setups.every(s=>s.units===null));
});
test('Historical analogs never use an unobserved future and do not overlap',()=>{
  const q=deepBars(raw,756,now),a=historicalAnalogs(q.bars,technicals(q.bars),20);
  for(const s of a.sample)assert.ok(q.bars.findIndex(b=>b.date===s.date)+20<q.bars.length);
  for(let i=1;i<a.sample.length;i++)assert.ok(q.bars.findIndex(b=>b.date===a.sample[i].date)-q.bars.findIndex(b=>b.date===a.sample[i-1].date)>=20);
});
test('Sizing includes two-sided costs, exposure limits and explicit currency conversion',()=>{
  const setup={direction:'long',entry:100,stop:95,target1:110,status:'bedingter Kandidat',volumeAvailable:true};
  const input=request({risk:{capital:10000,budget_pct:1,fee_bps:10,slippage_bps:15}});
  assert.equal(sizing([setup],input,.01)[0].units,18);assert.ok(sizing([setup],input,.01)[0].net_reward_risk<2);
  assert.equal(sizing([setup],request({risk:{capital:10000,exposure:2500}}),.01)[0].units,null);
  assert.equal(sizing([setup],request({risk:{capital:10000,account_currency:'EUR'}}),.01)[0].units,null);
});
const path=(points)=>points.map((p,i)=>({day:i,open:p,high:p,low:p,close:p}));
test('KO touch is irreversible even when endpoint recovers; high/low and short barriers are checked',()=>{
  const p=request({product:{type:'ko',direction:'long',barrier:90,financing:85,ratio:1,premium:15,observation:'continuous',terms_verified:true,financing_pct:0}}).product;
  const groups={currency:'USD',paths:[{id:'base',paths:[path([100,89,110]),path([100,101,110])]}]};
  const result=productAnalysis(p,groups,100,2);
  assert.equal(result.rows[0].barrier_model_frequency_pct,50);assert.ok(result.rows[0].return_p10_pct<0);
  const intraday=path([100,100,100]);intraday[1].low=89;
  assert.equal(productAnalysis(p,{currency:'USD',paths:[{id:'base',paths:[intraday]}]},100,2).rows[0].barrier_model_frequency_pct,100);
  const short={...p,direction:'short',barrier:110,financing:115};
  assert.equal(productAnalysis(short,{currency:'USD',paths:[{id:'stress',paths:[path([100,111,90])]}]},100,2).rows[0].return_p50_pct,-100);
});
test('Unknown product terms, FX or observation prevent product decisions',()=>{
  const p=request({product:{type:'ko',barrier:90,financing:85,premium:15,currency:'EUR'}}).product;
  const a=productAnalysis(p,{currency:'USD',paths:[]},100,20);
  assert.match(a.decision,/gesperrt/);assert.ok(a.issues.some(s=>s.includes('FX')));
});
test('Factor daily reset is path dependent and cannot become negative',()=>{
  const p=request({product:{type:'factor',factor:3,financing_pct:0,spread_pct:0,terms_verified:true}}).product;
  const group=points=>({currency:'USD',paths:[{id:'base',paths:[path(points)]}]});
  assert.notEqual(productAnalysis(p,group([100,110,100]),100,2).rows[0].return_p50_pct,productAnalysis(p,group([100,100,100]),100,2).rows[0].return_p50_pct);
  assert.equal(productAnalysis(p,group([100,50,100]),100,2).rows[0].return_p50_pct,-100);
});
test('Black-Scholes matches known vanilla call/put values and expiry intrinsic value',()=>{
  assert.ok(Math.abs(optionValue(100,100,1,.2,.05)-10.45058)<.0002);
  assert.ok(Math.abs(optionValue(100,100,1,.2,.05,0,false)-5.57353)<.0002);
  assert.equal(optionValue(110,100,0,.2),10);
});
test('Forecast evaluation requires anchor, excludes future rows, and preserves immutable original',()=>{
  const original=buildDeepAnalysis(request({days:5}),raw.slice(0,-10),{now});
  const snapshot=JSON.stringify(original),e=evaluateForecast(original,raw,now);
  assert.equal(e.matured,true);assert.equal(e.observed_days,5);assert.ok(Number.isFinite(e.benchmarks.rules));assert.equal(e.benchmarks.ai,null);
  assert.equal(JSON.stringify(original),snapshot);
  assert.throws(()=>evaluateForecast(original,raw.slice(-5),now),/Mindestens 60|Original/);
  assert.equal(evaluateForecast(original,raw.slice(0,-8),now).matured,false);
});
test('Split-adjusted evaluation rebases current data to original forecast basis',()=>{
  const original=buildDeepAnalysis(request({days:5}),raw.slice(0,-10),{now});
  const split=raw.map(b=>({...b,open:b.open/2,high:b.high/2,low:b.low/2,close:b.close/2}));
  const a=evaluateForecast(original,raw,now),b=evaluateForecast(original,split,now);
  assert.equal(a.endpoint,b.endpoint);assert.equal(b.basis_scale,2);
});
test('URL canonicalization removes tracking, rejects private literal targets, and archives no publisher full text',()=>{
  assert.equal(canonicalUrl('https://example.com/a?utm_source=x&b=2#x'),'https://example.com/a?b=2');
  for(const url of ['file:///etc/passwd','http://127.0.0.1/x','http://localhost/x','https://u:p@example.com/x','https://[::1]/'])assert.equal(canonicalUrl(url),null);
  const rows=dedupeSources([{url:'https://example.com/a?utm_source=x',title:'A'},{url:'https://example.com/a',title:'A',summary:'word '.repeat(100)}],now);
  assert.equal(rows.length,1);assert.equal(rows[0].excerpt.split(/\s+/).length,25);
  assert.equal(normalizeSource({url:'https://example.com',published_at:'2027-01-01'},now),null);
});
test('Research uses only fixed free search endpoints, registers discoveries as metadata and tolerates partial failure',async()=>{
  const urls=[];const result=await discoverFreeSources(request(),{now,parseRss:()=>[{link:'https://publisher.example/story',title:'Headline',description:'Only headline repeated',publishedAt:'2026-10-10'}],
    fetchImpl:async url=>{urls.push(url);return new Response('<rss/>');}});
  assert.equal(urls.length,2);assert.ok(urls.every(url=>new URL(url).hostname==='news.google.com'));
  assert.ok(result.sources.some(s=>s.title==='Headline'&&s.content_status==='metadata'&&s.excerpt===''));
  assert.ok(result.sources.some(s=>s.discovery==='registry'&&s.content_status==='metadata'));
  await assert.rejects(()=>fetchSmall('https://news.google.com',async()=>new Response('x',{headers:{'content-length':'2000000'}})),/zu groß/);
});
test('News windows exclude future, expired and irrelevant items, including selected old items',()=>{
  const input=request({news_days:30});
  const rows=[{id:'old',published_at:'2026-08-01',title:'NVIDIA'},{id:'future',published_at:'2027-01-01',title:'NVIDIA'},{id:'ok',published_at:'2026-09-20',title:'NVIDIA news'},{id:'other',published_at:'2026-10-10',title:'Unrelated'}];
  assert.deepEqual(relevantNews(rows,input,now,'old').map(r=>r.id),['ok']);
});
test('Manual gate, foreign history and foreign trigger reject before consuming quota or IO',async()=>{
  const a=adapters();
  await assert.rejects(()=>runDeepAnalysis({...request(),manual_start:false},a.deps),/manuell/);
  await assert.rejects(()=>runDeepAnalysis({...request(),trigger_id:'11111111-1111-4111-8111-111111111111'},a.deps),/Meldung/);
  await assert.rejects(()=>runDeepAnalysis({...request(),prior_ids:['11111111-1111-4111-8111-111111111111']},a.deps),/Frühere/);
  assert.deepEqual(a.calls,{reserve:0,ai:0,market:0,archive:0,save:0,search:0});
});
test('Quota gate prevents market, public search and AI calls',async()=>{
  const a=adapters({reserveRun:async()=>false});
  await assert.rejects(()=>runDeepAnalysis(request({use_ai:true}),a.deps),/Tageslimit/);
  assert.equal(a.calls.market,0);assert.equal(a.calls.search,0);assert.equal(a.calls.ai,0);
});
test('Gemini quota fallback saves a rules-only forecast and source snapshots once',async()=>{
  const a=adapters({analyze:async()=>{a.calls.ai++;throw new Error('Gemini-Kontingent erreicht.');}});
  const r=await runDeepAnalysis(request({use_ai:true,research:false}),a.deps);
  assert.equal(r.analysis.narrative.mode,'rules');assert.equal(r.analysis.ai,undefined);assert.equal(a.calls.ai,1);assert.equal(a.calls.archive,1);assert.equal(a.calls.save,1);
  assert.ok(r.analysis.warnings.some(w=>w.includes('Kontingent')));
});
test('AI may not cite metadata or unknown sources; disabled AI never calls provider',async()=>{
  const a=adapters({analyze:async()=>({...ai,evidence:[{source_id:'invented',inference:'fake'}]})});
  const r=await runDeepAnalysis(request({use_ai:true,research:false}),a.deps);
  assert.equal(r.analysis.narrative.mode,'rules');
  const b=adapters();await runDeepAnalysis(request(),b.deps);assert.equal(b.calls.ai,0);
});
test('Source archive failure is visible; history failure does not silently lose a forecast',async()=>{
  const a=adapters({archiveSources:async()=>{throw new Error();}});
  const r=await runDeepAnalysis(request({research:false}),a.deps);
  assert.equal(r.analysis.source_archive_saved,false);assert.ok(r.analysis.sources.length);
  const b=adapters({save:async()=>{throw new Error();}});
  await assert.rejects(()=>runDeepAnalysis(request({research:false}),b.deps),/Historie/);
});
test('Free-mode attestation is required and no OpenAI fallback or Google Search grounding is used',async()=>{
  const analysis=buildDeepAnalysis(request(),raw,{now,sources:[source]});let calls=0,body;
  const getEnv=k=>({GEMINI_API_KEY:'test',DEEP_GEMINI_MODEL:'gemini-3.5-flash-lite',OPENAI_API_KEY:'must-not-use'})[k] || '';
  await assert.rejects(()=>callDeepGemini({input:request({use_ai:true}),analysis,getEnv,fetchImpl:async()=>{calls++;}}),/nicht bestätigt/);assert.equal(calls,0);
  const env=k=>k==='DEEP_GEMINI_FREE_TIER_CONFIRMED'?'true':getEnv(k);
  await assert.rejects(()=>callDeepGemini({input:request({use_ai:true}),analysis,getEnv:env,fetchImpl:async(_url,opts)=>{calls++;body=JSON.parse(opts.body);return new Response('{}',{status:429});}}),/Kontingent/);
  assert.equal(calls,1);assert.equal(body.tools,undefined);assert.equal(body.generationConfig.candidateCount,1);
  assert.match(body.systemInstruction.parts[0].text,/untrusted/);
});
test('Strict Gemini result uses only readable source IDs and keeps extra deep fields',async()=>{
  const analysis=buildDeepAnalysis(request(),raw,{now,sources:[source]});
  const env=k=>({GEMINI_API_KEY:'test',DEEP_GEMINI_MODEL:'gemini-3.5-flash-lite',DEEP_GEMINI_FREE_TIER_CONFIRMED:'true'})[k] || '';
  const response={candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(ai)}]}}]};
  const n=await callDeepGemini({input:request({use_ai:true}),analysis,getEnv:env,fetchImpl:async()=>Response.json(response)});
  assert.equal(n.countercase,ai.countercase);assert.equal(n.provider,'gemini');
});
test('Paid or unreviewed Gemini model is blocked before network IO even with free-mode confirmation',async()=>{
  const analysis=buildDeepAnalysis(request(),raw,{now,sources:[source]});let calls=0;
  const env=k=>({GEMINI_API_KEY:'test',DEEP_GEMINI_MODEL:'gemini-unreviewed-pro',DEEP_GEMINI_FREE_TIER_CONFIRMED:'true'})[k] || '';
  await assert.rejects(()=>callDeepGemini({input:request({use_ai:true}),analysis,getEnv:env,fetchImpl:async()=>{calls++;}}),/freigegebenes/);
  assert.equal(calls,0);
});
test('Evaluation never calls Gemini and respects analysis ownership',async()=>{
  const original={...buildDeepAnalysis(request({days:5}),raw.slice(0,-10),{now}),id:'11111111-1111-4111-8111-111111111111'};
  let saves=0;
  const result=await runDeepEvaluation({analysis_id:original.id,manual_start:true,bars:raw},{now:()=>now,readOriginal:async()=>original,loadMarket:async()=>{throw new Error('must use CSV');},saveEvaluation:async()=>{saves++;}});
  assert.equal(result.evaluation.matured,true);assert.equal(saves,1);
  await assert.rejects(()=>runDeepEvaluation({analysis_id:original.id,manual_start:true},{readOriginal:async()=>null}),/nicht verfügbar/);
});
test('SEC annual facts retain reporting units and exclude quarterly, invalid and future filings',async()=>{
  const data={units:{'USD/shares':[
    {start:'2025-01-01',end:'2025-12-31',filed:'2026-02-01',form:'10-K',val:5,accn:'A'},
    {start:'2025-01-01',end:'2025-12-31',filed:'2026-09-01',form:'10-K',val:6,accn:'B'},
    {start:'2026-01-01',end:'2026-03-31',filed:'2026-05-01',form:'10-Q',val:2},
    {start:'2025-01-01',end:'2025-12-31',filed:'2027-01-01',form:'10-K',val:10},
    {end:'2025-12-31',filed:'2026-01-01',form:'10-K',val:15}
  ]}};
  const facts=annualSecFacts(data,now);assert.equal(facts.length,1);assert.equal(facts[0].value,6);assert.equal(facts[0].unit,'USD/shares');
  let calls=0;
  const missing=await loadSecFundamentals({cik:'123'}, {now,fetchImpl:async()=>{calls++;}});
  assert.equal(missing.fundamentals.available,false);assert.equal(calls,0);
  const loaded=await loadSecFundamentals({cik:'123',cik_verified:true},{userAgent:'Dashboard user@example.com',now,fetchImpl:async url=>{assert.match(url,/^https:\/\/data.sec.gov\/api\/xbrl\/companyconcept\/CIK0000000123\/us-gaap\//);return Response.json({...data,entityName:'Example',cik:123});}});
  assert.equal(loaded.sources[0].content_status,'structured_data');assert.equal(loaded.fundamentals.available,true);
});
test('V32 schema grants only owner reads, keeps forecasts immutable and does not redefine existing RPCs',()=>{
  const sql=readFileSync(new URL('../setup-v32-deep-analysis.sql',import.meta.url),'utf8');
  assert.ok((sql.match(/user_id=auth.uid\(\)/g)||[]).length>=7);
  assert.match(sql,/before update on public.deep_analyses/);
  assert.doesNotMatch(sql,/create or replace function public.reserve_signal_analysis_run|alter table public\.(trades|market_news|signal_simulations)|cron\.schedule/i);
  assert.match(sql,/foreign key\(analysis_id,user_id\)/);
});
