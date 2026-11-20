import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reconstructOpenHoldings,portfolioChartModel,portfolioChartHtml} from '../portfolio-chart.mjs';
import {dashboardDiagnostics,diagnosticsHtml} from '../dashboard-diagnostics.mjs';
import {portfolioHero,assetRow} from '../direct-view.mjs';
import {selectPriceSeries} from '../supabase/functions/_shared/price-series.mjs';
import {apiHarness,alice,bob} from './fixtures/investment-api.mjs';
import {uiHarness} from './fixtures/investment-dom.mjs';
import {makeBars,now} from './fixtures/independent-market.mjs';
const a={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user_id:alice,symbol:'VOW3.XETRA',currency:'EUR',company:'Volkswagen',is_portfolio:true,config:{source:'stored'},state:{price:110,price_date:'2026-11-06'}};
const sample=()=>({assets:[a],series:{[a.id]:{asset_id:a.id,symbol:a.symbol,currency:a.currency,kind:'price_history',points:[{date:'2026-11-04',value:100},{date:'2026-11-05',value:105},{date:'2026-11-06',value:110}]}},portfolio:{as_of:now.toISOString(),groups:[{currency:'EUR',amount:1100,cost_basis:900,invested:900,missing:0,stale:0,positions:1}],marks:[],holdings:[{asset_id:a.id,symbol:a.symbol,currency:'EUR',quantity:10,lots:[{instrument_type:'Aktie',direction:'Long',quantity:10,entry_date:'2026-11-01'}]}]}});
test('No account snapshots but genuine stored OHLCV and known purchase dates produce a labelled euro reconstruction',()=>{
 const s=sample(),m=portfolioChartModel(s.portfolio,{...s,now});assert.equal(m.mode,'reconstructed');assert.deepEqual(m.points.map(p=>p.value),[1000,1050,1100]);const html=portfolioChartHtml(s.portfolio,{...s,now});assert.match(html,/class="price-line"/);assert.match(html,/1.100 EUR/);assert.match(html,/Keine vollständige historische Depotbilanz/);assert.match(html,/3 rückrechenbare Kurstage/);
});
test('Reconstruction starts after the final known buy and never fabricates unavailable trading days',()=>{
 const s=sample();s.portfolio.holdings[0].lots.push({instrument_type:'Aktie',direction:'Long',entry_date:'2026-11-05'});const r=reconstructOpenHoldings(s.portfolio,s.assets,s.series,'EUR',now);assert.deepEqual(r.points.map(p=>p.date),['2026-11-05','2026-11-06']);
});
test('Missing purchase dates switch to an explicitly indexed course comparison instead of a fabricated past account value',()=>{
 const s=sample();s.portfolio.holdings[0].lots[0].entry_date=null;const m=portfolioChartModel(s.portfolio,{...s,now});assert.equal(m.mode,'comparison');const html=portfolioChartHtml(s.portfolio,{...s,now});assert.match(html,/Startwert 100/);assert.match(html,/keine Depotwert- oder Renditehistorie/);assert.doesNotMatch(html,/Rückrechnung des heutigen offenen Bestands aus/);
});
test('Complete actual account measurements take priority over a reconstruction',()=>{
 const s=sample();s.portfolio.marks=[{currency:'EUR',amount:960,recorded_at:'2026-11-05T12:00Z'},{currency:'EUR',amount:1100,recorded_at:'2026-11-06T12:00Z'}];assert.equal(portfolioChartModel(s.portfolio,{...s,now}).mode,'measured');assert.match(portfolioChartHtml(s.portfolio,{...s,now}),/Tatsächlich gespeicherte/);
});
test('A valid current amount remains a visible dated point when the history table has no rows',()=>{
 const s=sample();s.series={};const m=portfolioChartModel(s.portfolio,{...s,now});assert.equal(m.transient,true);assert.equal(m.points.length,1);const html=portfolioChartHtml(s.portfolio,{...s,now});assert.match(html,/<circle/);assert.match(html,/Aktuell berechnete Bewertung/);assert.match(html,/1.100 EUR/);assert.equal(s.portfolio.marks.length,0);
});
test('No depot response is reported as unavailable rather than falsely presenting an empty depot',()=>{
 const s=sample(),html=portfolioHero(null,{...s,now});assert.match(html,/Depotbewertung noch nicht verfügbar/);assert.doesNotMatch(html,/Dein Depot aufbauen/);assert.match(html,/<svg/);
});
test('A mixed-currency portfolio reconstruction never combines USD with EUR or substitutes manual price points',()=>{
 const s=sample();s.portfolio.holdings.push({asset_id:'b',currency:'USD',symbol:'B.US',quantity:999});assert.equal(reconstructOpenHoldings(s.portfolio,s.assets,s.series,'EUR',now).points.at(-1).value,1100);s.series[a.id].kind='manual_valuation';assert.equal(reconstructOpenHoldings(s.portfolio,s.assets,s.series,'EUR',now).points.length,0);
});
test('A missing component blocks a total reconstruction and a future acquisition cannot be backdated',()=>{
 const s=sample();s.portfolio.holdings.push({...s.portfolio.holdings[0],asset_id:'missing'});assert.equal(reconstructOpenHoldings(s.portfolio,s.assets,s.series,'EUR',now).points.length,0);s.portfolio.holdings.pop();s.portfolio.holdings[0].lots[0].entry_date='2026-12-01';assert.equal(reconstructOpenHoldings(s.portfolio,s.assets,s.series,'EUR',now).points.length,0);
});
test('Explicit period and display selections remain respected, including an honest empty reconstruction',()=>{
 const s=sample();s.portfolio.holdings[0].lots[0].entry_date=null;const html=portfolioChartHtml(s.portfolio,{...s,now,mode:'reconstructed'});assert.match(html,/Kaufdaten/);assert.doesNotMatch(html,/price-line/);assert.match(html,/value="reconstructed" selected/);
});
test('Diagnostics expose an outdated server, missing history and stale scheduler without leaking holdings or credentials',()=>{
 const s=sample(),report=dashboardDiagnostics({...s,now,capabilities:{version:'39.3.0',table_health:{history:false},monitor_last_run:'2026-01-01T12:00Z',chat_configured:false}});assert.equal(report.checks.find(c=>c.label==='Website / Server').ok,false);assert.equal(report.checks.find(c=>c.label==='Verlaufsspeicher').ok,false);assert.match(diagnosticsHtml(report),/veraltet/);assert.doesNotMatch(JSON.stringify(report),/VOW3|Volkswagen|average_entry_price|token|api_key/);
});
test('Preparing Deep reuses genuine owner OHLCV read-only, with no quote or model or quota operation',async()=>{
 const api=apiHarness({tables:{investment_assets:[a],investment_market_cache:[{user_id:alice,symbol:a.symbol,currency:a.currency,source:'csv',snapshot:{symbol:a.symbol,currency:a.currency,bars:makeBars(),provider:'CSV'}}]}});const r=await api.post({action:'prepare_deep',asset_id:a.id});assert.equal(r.status,200);assert.equal(r.body.bars.length,300);assert.equal(r.body.currency,'EUR');assert.equal(api.requests.length,0);assert.equal(api.rpcs.length,0);assert.ok(api.calls.every(c=>c.action==='read'));
});
test('Preparing Deep never derives OHLCV from a closing-price-only graph or another owner’s cache',async()=>{
 const api=apiHarness({tables:{investment_assets:[a],investment_market_cache:[{user_id:bob,symbol:a.symbol,currency:a.currency,source:'csv',snapshot:{symbol:a.symbol,currency:a.currency,bars:makeBars()}}]}});const r=await api.post({action:'prepare_deep',asset_id:a.id});assert.equal(r.body.bars.length,0);assert.match(r.body.warning,/Kein Kurs- oder KI-Aufruf/);assert.equal(api.requests.length,0);const foreign=apiHarness({owner:bob,tables:{investment_assets:[a]}});assert.equal((await foreign.post({action:'prepare_deep',asset_id:a.id})).status,404);
});
test('When optional cache is unavailable, genuine OHLCV from the selected own review can prepare Deep',async()=>{
 const reviewId=crypto.randomUUID(),asset={...a,latest_review_id:reviewId},api=apiHarness({tables:{investment_assets:[asset],investment_reviews:[{id:reviewId,asset_id:a.id,user_id:alice,snapshot:{symbol:a.symbol,currency:a.currency,provider:'Altbericht',analysis:{history:makeBars().slice(-120)}}}]},beforeQuery:q=>{if(q.table==='investment_market_cache')throw Error('unavailable');}});const r=await api.post({action:'prepare_deep',asset_id:a.id});assert.equal(r.body.bars.length,120);assert.equal(r.body.provider,'Altbericht');assert.equal(api.requests.length,0);
});
test('Actual detail -> Deep control prepares the matching security and cached bars without starting analysis',async()=>{
 const api=apiHarness({tables:{investment_assets:[a],investment_market_cache:[{user_id:alice,symbol:a.symbol,currency:a.currency,source:'csv',snapshot:{symbol:a.symbol,currency:a.currency,bars:makeBars()}}]}}),h=uiHarness({api});let prepared;h.window.addEventListener('investition:prepare-deep-security',event=>prepared=event.detail);await h.controller.loadAssets();await h.controller.openAsset(h.controller.getState().assets[0]);const count=h.calls.length;await h.controller.openDeep();assert.equal(h.controller.getState().route,'deep');assert.equal(h.window.lastLegacyTab,'deep');assert.equal(prepared.symbol,a.symbol);assert.equal(prepared.bars.length,300);assert.deepEqual(h.calls.slice(count).map(c=>c.body.action),['prepare_deep']);assert.equal(api.requests.length,0);h.controller.navigate('review');assert.equal(h.controller.getState().selected.symbol,a.symbol);
});
test('An overview failure preserves the last successful portfolio and labels its original data age',async()=>{
 let broken=false;const api=apiHarness({tables:{investment_assets:[a],depot_positions:[{id:crypto.randomUUID(),user_id:alice,symbol:a.symbol,currency:'EUR',is_open:true,quantity:10,average_entry_price:90,direction:'Long',instrument_type:'Aktie'}]},beforeQuery:q=>{if(broken&&q.table==='depot_positions')throw Error('Depot unavailable');}}),h=uiHarness({api});await h.controller.loadAssets();assert.equal(h.controller.getState().portfolio.groups[0].amount,1100);broken=true;await h.controller.loadAssets({force:true,sync:false});assert.equal(h.controller.getState().portfolio.groups[0].amount,1100);assert.match(h.els.ivValueHero.innerHTML,/letzte erfolgreiche Depotantwort/);assert.match(h.els.ivDiagnosticsBody.innerHTML,/Antwort veraltet/);
});
test('The diagnostics button is read-only and its copied summary contains no names or holdings',async()=>{
 const api=apiHarness({tables:{investment_assets:[a]}}),h=uiHarness({api});await h.controller.loadAssets();const count=h.calls.length;await h.els.ivRunDiagnostics.fire('click');assert.deepEqual(h.calls.slice(count).map(c=>c.body.action),['capabilities']);await h.els.ivCopyDiagnostics.fire('click');assert.equal(h.copied.length,1);assert.doesNotMatch(h.copied[0],/VOW3|Volkswagen|quantity|api_key/);assert.equal(api.requests.length,0);
});
test('Latest own Deep report date appears at the security without recasting it as a current buy/sell rating',()=>{
 const id=crypto.randomUUID(),raw={symbol:a.symbol,currency:a.currency,price_date:'2026-11-06',history:makeBars()},s=selectPriceSeries(a,{deep:[{id,user_id:alice,symbol:a.symbol,currency:a.currency,created_at:'2026-11-07T12:00Z',raw_result:raw}]},now);assert.equal(s.latest_deep.id,id);const html=assetRow(a,{index:0,priceSeries:s,now});assert.match(html,/Deep:/);assert.match(html,/07\.11\.2026|07\.11\.26/);assert.doesNotMatch(html,/Bedingter Einstieg/);
});
test('A missing or non-approved Gemini model cannot be reported as an operational chat configuration',async()=>{
 for(const model of ['', 'unknown-model']){const api=apiHarness({env:{GEMINI_API_KEY:'PRIVATE',DEEP_GEMINI_FREE_TIER_CONFIRMED:'true',DEEP_GEMINI_MODEL:model}}),r=await api.post({action:'capabilities'});assert.equal(r.body.chat_configured,false);assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE/);assert.equal(api.requests.length,0);}
});
test('A stale last portfolio response outside the selected period is not redated to create a new chart point',()=>{
 const s=sample();s.series={};s.portfolio.as_of='2026-01-05T12:00Z';const m=portfolioChartModel(s.portfolio,{...s,period:'1W',now});assert.equal(m.points.length,0);assert.equal(m.transient,false);
});
test('Actual boot watchdog makes missing chart modules visible and leaves an initialized dashboard alone',()=>{
 const listeners={},el={textContent:'',setAttribute(k,v){this[k]=v;}},doc={readyState:'complete',documentElement:{dataset:{}},getElementById:()=>el};let timeout;const win={addEventListener:(n,fn)=>listeners[n]=fn};
 new Function('window','document','setTimeout',readFileSync(new URL('../dashboard-health.js',import.meta.url),'utf8'))(win,doc,fn=>timeout=fn);timeout();assert.match(el.textContent,/noch nicht gestartet/);assert.equal(el.role,'alert');doc.documentElement.dataset.investmentUi='ready';el.textContent='ready';timeout();assert.equal(el.textContent,'ready');listeners.error({target:{src:'https://dashboard.test/price-ui.mjs'}});assert.match(el.textContent,/Darstellungsmodul/);
});
test('A failed capability call is visible rather than silently leaving a misleading ready status',async()=>{
 const h=uiHarness({beforeInvoke:body=>{if(body.action==='capabilities')throw Error('Function offline');}});await h.controller.loadAssets();assert.match(h.els.ivSetupStatus.textContent,/Serverstatus nicht erreichbar: Function offline/);assert.equal(h.els.ivSetupStatus.getAttribute('role'),'alert');
});
