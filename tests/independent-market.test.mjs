import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveIndependentSecurity} from '../supabase/functions/_shared/independent-security.mjs';
import {validateMarketChoice,parsePublicChart,fetchPublicChart,loadPublicMarket,readChartResponse,assertQuoteBinding} from '../supabase/functions/_shared/independent-market.mjs';
import {runSignalAnalysis} from '../supabase/functions/_shared/signal-service.mjs';
import {runDeepAnalysis,runDeepEvaluation} from '../supabase/functions/_shared/deep-service.mjs';
import {securityFieldChanges} from '../supabase/functions/_shared/security-form.mjs';
import {now,makeBars,identity,independentInput,chartPayload} from './fixtures/independent-market.mjs';
const request={query:'860180',preferred_exchange:'XETRA',manual_start:true,quote_metadata:false};
const forbidden=async()=>assert.fail('EODHD/legacy budget must not be called');
function lookup(extra={}) {
  const calls={maps:[],saved:[],lookup:0,metadata:0};
  const deps={now:()=>now,readCache:async()=>null,reserveIndependentLookup:async()=>{calls.lookup++;return true;},mapFigi:async jobs=>{calls.maps.push(jobs);return jobs.map(()=>({data:[identity]}));},saveCache:async(key,result)=>calls.saved.push({key,result}),quoteMetadata:async()=>{calls.metadata++;return{symbol:'SND.DE',currency:'EUR',exchange:'GER'};},reserveEod:forbidden,reserveLookup:forbidden,searchEod:forbidden,...extra};return{deps,calls};
}
function market(extra={}) {
  const calls={reserve:0,fetch:0,save:[]};
  const deps={readSecurity:async()=>null,readCache:async()=>null,reserve:async()=>{calls.reserve++;return true;},fetchChart:async()=>{calls.fetch++;return chartPayload();},writeCache:async(key,result)=>calls.save.push({key,result}),...extra};return{deps,calls};
}
test('Independent WKN resolves directly by MIC without EODHD and does not invent ISIN or currency',async()=>{
  const h=lookup(),r=await resolveIndependentSecurity(request,h.deps),c=r.candidates[0];assert.equal(c.market_symbol,'SND.XETRA');assert.equal(c.quote_symbol,'SND.DE');assert.equal(c.isin,null);assert.equal(c.currency,null);assert.equal(c.eodhd_verified,false);assert.equal(c.mic,'XETR');assert.equal(r.eodhd_used,false);assert.deepEqual(h.calls.maps,[[{idType:'ID_WERTPAPIER',idValue:'860180',micCode:'XETR'}]]);assert.equal(h.calls.metadata,0);
});
test('Independent ISIN keeps the supplied checked identity and can read quote currency without EODHD',async()=>{
  const h=lookup(),r=await resolveIndependentSecurity({...request,query:'FR0000121972',quote_metadata:true},h.deps);assert.equal(r.candidates[0].isin,'FR0000121972');assert.equal(r.candidates[0].currency,'EUR');assert.equal(h.calls.maps[0][0].idType,'ID_ISIN');assert.equal(h.calls.metadata,1);
});
test('US MIC mapping is one batch and empty/error venues do not erase another verified listing',async()=>{
  const h=lookup({mapFigi:async jobs=>{h.calls.maps.push(jobs);return jobs.map(j=>j.micCode==='XNAS'?{data:[{...identity,ticker:'NVDA'}]}:{error:'No identifier found.'});}}),r=await resolveIndependentSecurity({...request,preferred_exchange:'US'},h.deps);assert.equal(h.calls.maps.length,1);assert.equal(h.calls.maps[0].length,4);assert.equal(r.candidates.length,1);assert.equal(r.candidates[0].mic,'XNAS');assert.equal(r.candidates[0].quote_symbol,'NVDA');
});
test('A derivative, unsupported venue or arbitrary name cannot become a guessed stock',async()=>{
  const h=lookup({mapFigi:async()=>[{data:[{...identity,securityType:'Equity Warrant',securityType2:'Warrant'}]}]});await assert.rejects(()=>resolveIndependentSecurity(request,h.deps),/Keine unabhängige/);
  await assert.rejects(()=>resolveIndependentSecurity({...request,query:'Schneider Electric'},lookup().deps),/WKN/);await assert.rejects(()=>resolveIndependentSecurity({...request,preferred_exchange:'UNKNOWN'},lookup().deps),/Handelsplatz/);
});
test('Public metadata failure keeps the independent WKN result with explicitly unconfirmed currency',async()=>{
  const h=lookup({quoteMetadata:async()=>{throw Error('429');}}),r=await resolveIndependentSecurity({...request,quote_metadata:true},h.deps);assert.equal(r.candidates[0].currency,null);assert.match(r.candidates[0].quote_metadata_error,/CSV/);assert.throws(()=>securityFieldChanges('deep',r.candidates[0]),/Notierungswährung/);assert.equal(securityFieldChanges('deep',{...r.candidates[0],currency:'EUR'}).values.daCurrency,'EUR');
});
test('Wrong quote exchange is rejected instead of silently changing the selected listing',async()=>{
  const h=lookup({quoteMetadata:async()=>({symbol:'SND.DE',currency:'USD',exchange:'NMS'})});await assert.rejects(()=>resolveIndependentSecurity({...request,quote_metadata:true},h.deps),/Keine unabhängige/);
});
test('Owner lookup cache is reused, but an unverified or expired result is refreshed',async()=>{
  const first=await resolveIndependentSecurity(request,lookup().deps),h=lookup({readCache:async()=>first});assert.equal((await resolveIndependentSecurity(request,h.deps)).cached,true);assert.equal(h.calls.lookup,0);
  for(const cached of [{...first,expires_at:'2026-10-01'},{...first,candidates:[{...first.candidates[0],verified:false}]}]){const x=lookup({readCache:async()=>cached});assert.equal((await resolveIndependentSecurity(request,x.deps)).cached,false);assert.equal(x.calls.lookup,1);}
});
test('Independent quota rejection happens before OpenFIGI; no alternate identity or EOD fallback',async()=>{
  const h=lookup({reserveIndependentLookup:async()=>false});await assert.rejects(()=>resolveIndependentSecurity(request,h.deps),/unabhängig von EODHD/);assert.equal(h.calls.maps.length,0);
});
test('CSV takes priority and public quotes require an explicit symbol/venue/currency confirmation',()=>{
  assert.equal(validateMarketChoice({...independentInput,quote_confirmed:false,bars:makeBars()}).market_source,'csv');assert.throws(()=>validateMarketChoice({...independentInput,quote_confirmed:false}),/bestätigen/);assert.throws(()=>validateMarketChoice({market_source:'csv'}),/importieren/);assert.throws(()=>validateMarketChoice({...independentInput,quote_symbol:'https://evil.test'}),/Kurskennung/);
});
test('Public chart parsing excludes the current exchange day and preserves all completed OHLCV bars',()=>{
  const bars=makeBars(),p=chartPayload({bars:[...bars,{...bars.at(-1),date:'2026-11-08'}]}),r=parsePublicChart(p,'SND.DE',now);assert.equal(r.bars.length,300);assert.equal(r.bars.at(-1).date,'2026-11-06');assert.equal(r.meta.currency,'EUR');assert.match(r.warnings.join(),/heutige/);assert.ok(r.bars.every(b=>b.adjusted_close>0));
});
test('Public parsing rejects wrong symbols, unsupported instruments and invalid OHLCV vector alignment',()=>{
  for(const mutate of [p=>p.chart.result[0].meta.symbol='OTHER',p=>p.chart.result[0].meta.instrumentType='FUTURE',p=>p.chart.result[0].indicators.quote[0].volume.pop(),p=>p.chart.result[0].meta.exchangeTimezoneName='Invalid/Zone',p=>p.chart.result[0].indicators.quote[0].low[0]=10000]){const p=chartPayload();mutate(p);assert.throws(()=>parsePublicChart(p,'SND.DE',now));}
});
test('Missing adjusted values are never partly mixed into a price series and missing OHLC rows are reported',()=>{
  const p=chartPayload();p.chart.result[0].indicators.adjclose[0].adjclose[15]=null;p.chart.result[0].indicators.quote[0].close[20]=null;const r=parsePublicChart(p,'SND.DE',now);assert.equal(r.bars.length,299);assert.ok(r.bars.every(b=>b.adjusted_close===undefined));assert.match(r.warnings.join(),/unvollständige/);assert.match(r.warnings.join(),/Adjusted-Close/);
});
test('GBp is pence (GBX), never converted or silently treated as GBP',()=>{
  const r=parsePublicChart(chartPayload({currency:'GBp'}),'SND.DE',now);assert.equal(r.meta.currency,'GBX');assert.throws(()=>assertQuoteBinding(r.meta,null,'GBP'),/GBX statt GBP/);
});
test('Independent public chart request uses one fixed public endpoint without cookies, keys or retry',async()=>{
  const calls=[];await assert.rejects(()=>fetchPublicChart('SND.DE','history',async(url,options)=>{calls.push({url:String(url),options});return new Response('{}',{status:429});}),/eigenes Limit/);assert.equal(calls.length,1);assert.equal(new URL(calls[0].url).hostname,'query1.finance.yahoo.com');assert.equal(calls[0].options.redirect,'error');assert.deepEqual(Object.keys(calls[0].options.headers),['Accept']);assert.doesNotMatch(calls[0].url,/crumb|download|api_token/);
});
test('HTML, oversized responses, redirects and provider error payloads are not accepted as history',async()=>{
  await assert.rejects(()=>readChartResponse(new Response('<html>verification</html>')),/JSON/);await assert.rejects(()=>readChartResponse(new Response('{}',{headers:{'content-length':'2200001'}})),/groß/);await assert.rejects(()=>readChartResponse(new Response('',{status:302})),/HTTP 302/);assert.throws(()=>parsePublicChart({chart:{error:{description:'not found'}}},'SND.DE',now));
});
test('Independent cache stores only public data under a separate key and carries source provenance',async()=>{
  const h=market(),r=await loadPublicMarket(independentInput,h.deps,now);assert.equal(h.calls.save[0].key,'SND.DE:EUR');assert.equal(r.provenance.eodhd_used,false);assert.equal(r.provenance.source,'independent');assert.equal(r.provenance.quote_symbol,'SND.DE');assert.equal(h.calls.fetch,1);
});
test('Fresh independent owner cache needs neither public quota nor an EOD token',async()=>{
  const cached={...parsePublicChart(chartPayload(),'SND.DE',now),fetched_at:now.toISOString()},h=market({readCache:async()=>cached,reserve:forbidden,fetchChart:forbidden}),r=await loadPublicMarket(independentInput,h.deps,now);assert.equal(r.provenance.cached,true);
});
test('Mismatched, foreign or expired FIGI binding stops before a quote request',async()=>{
  for(const cached of [null,{expires_at:'2026-10-01',candidates:[]},{expires_at:'2026-11-15',candidates:[{figi:identity.figi,market_symbol:'OTHER.US',quote_symbol:'SND.DE'}]}]){const h=market({readSecurity:async()=>cached});await assert.rejects(()=>loadPublicMarket({...independentInput,security_key:'F0:WKN:860180:XETRA',quote_figi:identity.figi},h.deps,now),/Zuordnung/);assert.equal(h.calls.fetch,0);}
});
test('Currency mismatch or independent quota failure never writes or calls another provider',async()=>{
  const h=market();await assert.rejects(()=>loadPublicMarket({...independentInput,currency:'USD'},h.deps,now),/EUR statt USD/);assert.equal(h.calls.save.length,0);
  const q=market({reserve:async()=>false});await assert.rejects(()=>loadPublicMarket(independentInput,q.deps,now),/Tageslimit/);assert.equal(q.calls.fetch,0);
});
test('Signal and Deep analysis use independent bars even when all legacy EOD operations fail',async()=>{
  const publicDeps=market().deps,load=async input=>loadPublicMarket(input,publicDeps,now),base={reserveRun:async()=>true,readNews:async()=>[],readCache:forbidden,fetchBars:forbidden,writeCache:forbidden};
  const s=await runSignalAnalysis(independentInput,{...base,now,loadIndependentMarket:load,saveResult:async()=> 'signal-id'});assert.equal(s.analysis.market_data.source,'independent');assert.equal(s.analysis.request.quote_symbol,'SND.DE');
  const d=await runDeepAnalysis(independentInput,{...base,now:()=>now,readPrevious:async()=>[],loadMarket:load,archiveSources:async()=>{},save:async()=> 'deep-id'});assert.equal(d.analysis.scenarios.length,6);assert.equal(d.analysis.market_data.eodhd_used,false);assert.equal(d.analysis.request.market_source,'independent');
});
test('CSV analysis and CSV evaluation cannot fall back to any external market service',async()=>{
  const body={...independentInput,bars:makeBars()},base={reserveRun:async()=>true,readNews:async()=>[],readCache:forbidden,fetchBars:forbidden,writeCache:forbidden,loadIndependentMarket:forbidden,loadMarket:forbidden};
  const s=await runSignalAnalysis(body,{...base,now,saveResult:async()=> 'signal-id'}),d=await runDeepAnalysis(body,{...base,now:()=>now,readPrevious:async()=>[],archiveSources:async()=>{},save:async()=> '11111111-1111-4111-8111-111111111111'});assert.equal(s.analysis.market_data.source,'csv');assert.equal(d.analysis.request.market_source,'csv');
  await assert.rejects(()=>runDeepEvaluation({analysis_id:d.analysis.id,manual_start:true},{readOriginal:async()=>d.analysis,loadMarket:forbidden}),/aktualisierte OHLCV/);
  const old={...d.analysis,request:{...d.analysis.request,market_source:undefined},market_data:undefined};await assert.rejects(()=>runDeepEvaluation({analysis_id:old.id,manual_start:true},{readOriginal:async()=>old,loadMarket:forbidden}),/aktualisierte OHLCV/);
});
test('Independent trade form requires consent to clear EOD alarm fields and never persists a trade',async()=>{
  const r=await resolveIndependentSecurity(request,lookup().deps),c={...r.candidates[0],currency:'EUR'},original={type:'Aktie',marketSymbol:'NVDA.US',currency:'USD'};assert.throws(()=>securityFieldChanges('trade',c,original),/bestätigen/);const changes=securityFieldChanges('trade',c,original,{disable_eod_alerts:true});assert.equal(changes.values.marketSymbol,'');assert.equal(changes.values.monitoringEnabled,false);assert.equal(changes.values.alertEntry,false);assert.equal(original.marketSymbol,'NVDA.US');assert.equal(changes.values.symbol,'XETR:SND');
});
