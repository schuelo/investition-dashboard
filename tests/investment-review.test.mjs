import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReviewInput,buildInvestmentReview,investmentDecision,runInvestmentReview,quoteStatus,expectedEodDate} from '../supabase/functions/_shared/investment-review.mjs';
import {assetCard,assetView,portfolioCounts,reviewHtml} from '../investment-view.mjs';
import {makeBars,now} from './fixtures/independent-market.mjs';
const input=()=>validateReviewInput({symbol:'SND.XETRA',currency:'EUR',company:'Schneider Electric',policy:{budget:900,tranches:3}});
const report=()=>buildInvestmentReview(input(),{market:{bars:makeBars(),provider:'CSV'},now});
const article={id:'n',symbols:['SND.XETRA'],title:'Schneider Electric meldet Zahlen',url:'https://example.org/news',published_at:'2026-11-07T10:00Z',summary:'Dokumentierter Feed-Auszug.'};
test('Review validates exact identities, known sources, confirmed provider codes and bounded budgets/URLs',()=>{
  for(const patch of [{symbol:'SND'},{currency:'XYZ'},{source:'other'},{source:'alphavantage',quote_symbol:'SND.DEX',quote_confirmed:false},{source:'eodhd',quote_confirmed:false},{source:'eodhd',quote_confirmed:true,currency:'USD'},{policy:{tranches:0}},{policy:{budget:-1}},{manual_urls:['http://127.0.0.1/admin']}])assert.throws(()=>validateReviewInput({...input(),...patch}));
  const i=validateReviewInput({...input(),source:'alphavantage',quote_symbol:'SND.DEX',quote_confirmed:true});assert.equal(i.source,'alphavantage');assert.equal(i.quote_symbol,'SND.DEX');
});
test('EOD freshness handles weekends and distinguishes stale, missing, impossible dates and future bars',()=>{
  assert.equal(expectedEodDate(now),'2026-11-06');assert.equal(expectedEodDate(new Date('2026-11-09T06:00Z')),'2026-11-06');assert.equal(expectedEodDate(new Date('2026-11-10T06:00Z')),'2026-11-09');
  assert.equal(quoteStatus('2026-11-06',now).code,'current');assert.equal(quoteStatus('2026-11-05',now).code,'stale');
  for(const d of [null,'2026-02-30','2026-11-09','2026-11-08'])assert.equal(quoteStatus(d,now).code,'missing');
});
test('A successful real V36 calculation feeds six scenarios and the original seven methods without AI',()=>{
  const r=report();assert.equal(r.scenarios.length,6);assert.equal(r.analysis.chart.methods.length,7);assert.equal(r.analysis.narrative.mode,'rules');assert.equal(r.quote.code,'current');assert.equal(r.version,'39.3.0');
  for(const s of r.scenarios)assert.equal(s.change_pct,(s.endpoint/r.price-1)*100);
});
test('Hold, risk exit, partial exit and trend reduction depend on actual holdings and user plan levels',()=>{
  const a=report().analysis;a.quality.blocked=false;a.chart.trend=1;
  const position={quantity:10,direction:'Long'};
  assert.equal(investmentDecision(a,{position,now}).code,'hold');
  assert.equal(investmentDecision(a,{position,policy:{stop:a.chart.price+1},now}).code,'sell');
  assert.equal(investmentDecision(a,{position,policy:{target:a.chart.price-1},now}).code,'sell_part');
  a.chart.trend=-1;assert.equal(investmentDecision(a,{position,now}).code,'reduce');
  assert.equal(investmentDecision(a,{position:{quantity:10,direction:'Short'},now}).code,'review');
});
test('Buy candidates remain conditional and the tranche amount comes only from the user budget',()=>{
  const a=report().analysis;a.quality.blocked=false;a.chart.trend=1;const s=a.setups.find(s=>s.direction==='long');s.status='bedingter Kandidat';s.decision='BEDINGTER KANDIDAT';
  const d=investmentDecision(a,{policy:{budget:900,tranches:3},now});assert.equal(d.code,'buy_staged');assert.equal(d.tranche.amount,300);assert.ok(d.conditions.includes(s.trigger));assert.match(d.basis,/keine automatische Order/i);
  s.decision='ABWARTEN / KEIN TRADE';assert.equal(investmentDecision(a,{now}).code,'wait');
});
test('Stale or quality-blocked quotes cannot produce a current buy/sell recommendation',()=>{
  const a=report().analysis;for(const mutate of [a=>a.price_date='2026-11-05',a=>a.quality.blocked=true,a=>a.chart.price=0]){const b=structuredClone(a);mutate(b);const d=investmentDecision(b,{position:{quantity:10},policy:{stop:1000},now});assert.equal(d.current,false);assert.equal(d.code,'wait');}
});
test('News are retained when market data fail; no chart or price is fabricated',async()=>{
  let saved;const r=await runInvestmentReview(input(),{now:()=>now,loadMarket:async()=>({attempt:{status:'failed',at:now.toISOString(),error:'Yahoo HTTP 429'},warning:'Yahoo HTTP 429'}),readNews:async()=>[article],previous:async()=>null,position:async()=>null,save:async r=>{saved=r;return{id:'r',asset_id:'a'};}});
  assert.equal(r.saved,true);assert.equal(r.analysis,null);assert.equal(r.price,null);assert.equal(r.sources.length,1);assert.equal(r.decision.current,false);assert.equal(saved.attempt.status,'failed');assert.match(r.warnings.join(' '),/429/);
});
test('A storage failure returns the calculated report for export without repeating any provider call',async()=>{
  let calls=0;const r=await runInvestmentReview(input(),{now:()=>now,loadMarket:async()=>{calls++;return {bars:makeBars(),provider:'CSV'};},readNews:async()=>[],previous:async()=>null,position:async()=>null,save:async()=>{throw Error();}});
  assert.equal(r.saved,false);assert.ok(r.analysis);assert.equal(calls,1);assert.match(r.warnings.join(' '),/JSON exportieren/);
});
test('Deduplicated persistence returns the original snapshot timestamp rather than inventing a new analysis time',async()=>{
  const original={...report(),created_at:'2026-11-07T08:00Z'};const r=await runInvestmentReview(input(),{now:()=>now,loadMarket:async()=>({bars:makeBars(),provider:'CSV'}),readNews:async()=>[],previous:async()=>null,position:async()=>null,save:async()=>({id:'r',asset_id:'a',snapshot:original})});assert.equal(r.created_at,original.created_at);
});
test('Manual sources without a publication date remain explicitly user-selected sources',()=>{
  const r=buildInvestmentReview(input(),{now,news:[{...article,published_at:null,manual:true,match:'manual',discovery:'manual_url',retrieval_status:'read',content_status:'page_excerpt'}]});assert.equal(r.sources.length,1);assert.equal(r.sources[0].manual,true);assert.equal(r.sources[0].published_at,null);
});
test('Quote freshness and last request outcome are independent, allowing fresh price plus failed refresh',()=>{
  const asset={symbol:'SND.XETRA',currency:'EUR',company:'Schneider',analysis_at:'2026-11-07T08:00Z',checked_at:'2026-11-08T08:00Z',state:{price:100,price_date:'2026-11-06',decision:{label:'Halten prüfen',reason:'Begründung'},last_attempt:{status:'failed',at:'2026-11-08T08:00Z',error:'HTTP 429'}}};
  const v=assetView(asset,now);assert.equal(v.quote.code,'current');assert.equal(v.failed,true);const html=assetCard(asset,{now});assert.match(html,/Tageskurs aktuell/);assert.match(html,/Abruf fehlgeschlagen/);assert.match(html,/07\.11\.26/);assert.match(html,/2026-11-06/);assert.equal(portfolioCounts([asset],now).failed,1);assert.equal(portfolioCounts([asset],now).current,1);
});
test('Reopening the depot later recomputes age and suppresses stale action badges without rewriting original data',()=>{
  const asset={symbol:'SND.XETRA',currency:'EUR',state:{price:100,price_date:'2026-11-06',decision:{label:'Kauf prüfen'},last_attempt:{status:'not_run',at:now.toISOString(),error:'Kein Schlüssel'}}},before=JSON.stringify(asset);
  const v=assetView(asset,new Date('2026-11-15T09:00Z'));assert.equal(v.quote.code,'stale');assert.equal(v.decision,'Aktuelle Entscheidung offen');assert.equal(v.notRun,true);assert.equal(JSON.stringify(asset),before);
  for(const bad of [0,null,NaN])assert.equal(assetView({...asset,state:{...asset.state,price:bad}},now).quote.code,'missing');
});
test('Stored news and chat-like text are escaped in actual review and portfolio HTML',()=>{
  const r=report();r.company='<img src=x onerror=evil()>';r.decision.reason='<script>evil()</script>';r.sources=[{...article,canonical_url:'https://example.org/',source:'x',excerpt:'<iframe>',content_status:'metadata'}];const html=reviewHtml(r,{now});assert.doesNotMatch(html,/<img|<script|<iframe/);assert.match(html,/&lt;img/);
});
test('A missing depot/history service cannot erase a computed chart or be interpreted as no holdings',async()=>{const r=await runInvestmentReview(input(),{now:()=>now,loadMarket:async()=>({bars:makeBars(),provider:'CSV'}),readNews:async()=>[],previous:async()=>{throw Error();},position:async()=>{throw Error();},save:async()=>({id:'r',asset_id:'a'})});assert.ok(r.analysis);assert.equal(r.position_known,false);assert.equal(r.decision.current,false);assert.equal(r.decision.label,'Depotkontext fehlt');assert.match(r.warnings.join(' '),/Depotbestand nicht erreichbar/);});
