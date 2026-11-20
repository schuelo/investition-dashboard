import test from 'node:test';
import assert from 'node:assert/strict';
import {historyWindow,windowCaption,periodButtons} from '../chart-window.mjs';
import {CHART_PERIODS,watchComparison,seriesSpark} from '../price-charts.mjs';
import {portfolioChartModel,portfolioChartHtml} from '../portfolio-chart.mjs';
import {assetRow,displayQuote} from '../direct-view.mjs';
import {storedValuationFor} from '../supabase/functions/_shared/stored-valuation.mjs';
import {quoteStatus} from '../supabase/functions/_shared/investment-review.mjs';
import {apiHarness,alice,bob} from './fixtures/investment-api.mjs';
import {uiHarness} from './fixtures/investment-dom.mjs';
import {makeBars,now as fixtureNow} from './fixtures/independent-market.mjs';
const now=new Date('2026-11-20T18:00:00Z'),a={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user_id:alice,symbol:'NVD.XETRA',currency:'EUR',company:'NVIDIA',is_portfolio:true,config:{source:'stored'},state:{}},points=Array.from({length:22},(_,i)=>({date:new Date(Date.parse('2026-09-18')+i*86400000).toISOString().slice(0,10),value:100+i}));
const s={asset_id:a.id,symbol:a.symbol,currency:a.currency,kind:'price_history',status:'ready',source:'Gespeicherte Tageskurse',points};
const holding={asset_id:a.id,symbol:a.symbol,currency:a.currency,quantity:1,positions:1,average_entry_price:95,invested:95,amount:121,pnl:26,pnl_pct:26/95*100,quote:{price:121,price_date:'2026-10-09',status:'stale',source:'Gespeicherte Historie',from_history:true},lots:[{quantity:1,entry_date:'2026-09-01',direction:'Long',instrument_type:'Aktie'}]};
test('An October history has a real visible selection for every period in November without changing its dates',()=>{
 for(const p of CHART_PERIODS){const w=historyWindow(points,p,{now});assert.ok(w.points.length>0,p);assert.equal(w.end,'2026-10-09');assert.equal(w.points.at(-1).date,'2026-10-09');assert.equal(w.stale,true);assert.equal(quoteStatus(w.end,now).code,'stale');}
 assert.match(windowCaption(points,'1W',{now}),/2026-10-09 · veraltet/);assert.match(windowCaption(points,'1W',{now}),/endet am letzten gespeicherten Wert/);
});
test('Shorter yearly history is explicitly partial and no missing months are invented',()=>{
 const w=historyWindow(points,'1J',{now});assert.equal(w.partial,true);assert.equal(w.points.length,22);assert.match(windowCaption(points,'1J',{now}),/Historie kürzer als 1J/);assert.equal(historyWindow(points,'Max',{now}).partial,false);
});
test('Missing histories disable every period instead of offering clickable empty plots',()=>{
 const html=periodButtons([],{now});assert.equal((html.match(/ disabled/g)||[]).length,5);assert.equal((html.match(/<button/g)||[]).length,5);assert.doesNotMatch(periodButtons(points,{now}),/ disabled/);
});
test('Future, invalid and negative values cannot become a latest anchor',()=>{
 const w=historyWindow([...points,{date:'2026-12-01',value:999},{date:'2026-02-30',value:888},{date:'2026-10-10',value:-1},{date:'2026-10-10',value:'5'}],'Max',{now});assert.equal(w.end,'2026-10-09');assert.equal(w.points.length,22);
});
test('A period switch never changes measured EUR balances into a reconstructed or indexed chart',()=>{
 const p={groups:[{currency:'EUR',amount:121}],holdings:[holding],marks:[{currency:'EUR',recorded_at:'2026-08-01',amount:90},{currency:'EUR',recorded_at:'2026-10-09',amount:121}]};
 for(const period of CHART_PERIODS){const m=portfolioChartModel(p,{assets:[a],series:{[a.id]:s},period,now,anchor:'latest'});assert.equal(m.mode,'measured');assert.ok(m.points.length);assert.equal(m.currency,'EUR');const html=portfolioChartHtml(p,{assets:[a],series:{[a.id]:s},period,now});assert.match(html,/data-chart-mode="measured"/);assert.match(html,/<circle/);assert.doesNotMatch(html,/Kursindex · Start 100/);}
});
test('Observation comparison uses its common historical end date rather than mixing a fresh and an old window',()=>{
 const b={id:'b',symbol:'B.XETRA',currency:'EUR'},ss={...s,asset_id:'b',symbol:b.symbol,points:[...points.map(p=>({...p,value:p.value*2})),{date:'2026-11-19',value:300}]};
 for(const period of CHART_PERIODS){const html=watchComparison([a,b],{[a.id]:s,b:ss},{period,now,anchor:'latest'});assert.match(html,/<svg/);assert.match(html,/Datenstand 2026-10-09 · veraltet/);assert.doesNotMatch(html,/NaN|Infinity/);}
});
test('List rows have one consistent mini geometry and keep metrics and fetch explanations behind a closed disclosure',()=>{
 const html=assetRow(a,{index:0,holding,priceSeries:s,now}),front=html.split('<details')[0];assert.match(front,/price-sparkline/);assert.match(front,/Positionswert/);assert.match(front,/Kurs alt/);assert.match(front,/121/);assert.doesNotMatch(front,/Stückzahl|Ø Einstand|Bewertungskurs fehlt|TRADINGVIEW|pc-mini|<script|<iframe/i);assert.match(html,/<details class="direct-row-status row-details">/);assert.match(html,/Stückzahl/);assert.match(html,/data-holding-edit="0"/);
 const missing=assetRow({...a,symbol:'AKZA.AS'},{index:1,now});assert.match(missing,/price-sparkline/);assert.match(missing,/Keine Historie/);assert.doesNotMatch(missing,/pc-mini|<iframe|<script/);
});
test('A compact mini uses its selected historical period and labels a shortened range rather than a daily return',()=>{
 const html=seriesSpark(s,{compact:true,period:'1J',now});assert.match(html,/Hist\./);assert.match(html,/Historie kürzer als 1J/);assert.match(seriesSpark(s,{compact:true,period:'1W',now}),/1W/);
});
test('A foreign currency or ticker series cannot silently supply the row quote or graph',()=>{
 assert.equal(displayQuote(a,{priceSeries:{...s,currency:'USD'},now}).price,null);assert.equal(displayQuote(a,{priceSeries:{...s,symbol:'NVDA.US'},now}).price,null);const html=assetRow(a,{index:0,priceSeries:{...s,currency:'USD'},now});assert.match(html,/Keine Historie/);
});
test('Stored historical quote can value the holding without making its analysis current',()=>{
 const row={user_id:alice,symbol:a.symbol,currency:a.currency,snapshot:{symbol:a.symbol,currency:a.currency,provider:'CSV',bars:points.map(p=>({date:p.date,close:p.value}))}},q=storedValuationFor(a,{caches:[row]},now);assert.equal(q.price,121);assert.equal(q.price_date,'2026-10-09');assert.equal(q.valuation_from_history,true);assert.equal(quoteStatus(q.price_date,now).code,'stale');assert.deepEqual(a.state,{});
});
test('Stored valuation requires matching owner, ticker and currency and never accepts scenario paths',()=>{
 const row={user_id:alice,symbol:a.symbol,currency:a.currency,snapshot:{symbol:a.symbol,currency:a.currency,bars:points.map(p=>({date:p.date,close:p.value}))}};
 for(const patch of [{user_id:bob},{symbol:'OTHER.XETRA'},{currency:'USD'},{snapshot:{symbol:a.symbol,currency:a.currency,analysis:{scenarios:points}}}])assert.equal(storedValuationFor(a,{caches:[{...row,...patch}]},now),null);
});
test('Manual valuation and a newer existing provider quote retain priority over a historical cache',()=>{
 const row={user_id:alice,symbol:a.symbol,currency:a.currency,snapshot:{symbol:a.symbol,currency:a.currency,bars:points.map(p=>({date:p.date,close:p.value}))}};
 assert.equal(storedValuationFor({...a,valuation_override:{source:'manual',price:80,price_date:'2026-09-01'}},{caches:[row]},now),null);assert.equal(storedValuationFor({...a,state:{price:150,price_date:'2026-11-19'}},{caches:[row]},now),null);
});
test('Actual portfolio endpoint reuses the owned cache without asset updates, provider calls or an AI operation',async()=>{
 const asset={...a,state:{},analysis_at:'2026-01-01T12:00Z'},api=apiHarness({tables:{investment_assets:[asset],depot_positions:[{id:crypto.randomUUID(),user_id:alice,symbol:a.symbol,currency:'EUR',is_open:true,quantity:1,average_entry_price:95,direction:'Long',instrument_type:'Aktie'}],investment_market_cache:[{user_id:alice,symbol:a.symbol,currency:'EUR',source:'csv',snapshot:{symbol:a.symbol,currency:'EUR',provider:'CSV',bars:makeBars()}}]}}),r=await api.post({action:'portfolio_overview'});
 assert.equal(r.status,200);assert.ok(r.body.portfolio.groups[0].amount>0);assert.equal(r.body.portfolio.holdings[0].quote.from_history,true);assert.equal(r.body.portfolio.stored_quotes_reused,1);assert.deepEqual(api.db.investment_assets[0].state,{});assert.equal(api.db.investment_assets[0].analysis_at,asset.analysis_at);assert.equal(api.requests.length,0);assert.equal(api.rpcs.length,0);assert.ok(api.calls.filter(c=>c.table==='investment_assets').every(c=>c.action==='read'));
});
test('Unavailable stored cache cannot erase an existing valid provider price or invoke another source',async()=>{
 const asset={...a,state:{price:90,price_date:'2026-01-06'}},api=apiHarness({tables:{investment_assets:[asset],depot_positions:[{id:crypto.randomUUID(),user_id:alice,symbol:a.symbol,currency:'EUR',is_open:true,quantity:1,average_entry_price:95,direction:'Long',instrument_type:'Aktie'}]},beforeQuery:q=>{if(q.table==='investment_market_cache')throw Error('unavailable');}}),r=await api.post({action:'portfolio_overview'});assert.equal(r.status,200);assert.equal(r.body.portfolio.groups[0].amount,90);assert.match(r.body.portfolio.valuation_warning,/nicht erreichbar/);assert.equal(api.requests.length,0);
});
test('The actual stock controller renders every stale-history period without requesting providers or re-dating the quote',async()=>{
 const api=apiHarness({tables:{investment_assets:[a],investment_market_cache:[{user_id:alice,symbol:a.symbol,currency:'EUR',source:'csv',snapshot:{symbol:a.symbol,currency:'EUR',provider:'CSV',bars:points.map(p=>({date:p.date,close:p.value}))}}]}}),h=uiHarness({api});h.setNow(now);await h.controller.openAsset(a);const calls=h.calls.length;
 for(const period of CHART_PERIODS){for(const fn of h.els.rvPricePeriods.events.click)fn({target:h.button({pricePeriod:period})});assert.match(h.els.rvPricePlot.innerHTML,/<svg/);assert.match(h.els.rvPriceInfo.textContent,/2026-10-09 · veraltet/);}
 assert.equal(h.calls.length,calls);assert.equal(api.requests.length,0);
});
test('The real depot control accepts 3M and keeps archival and filtering sections collapsed by default',async()=>{
 const api=apiHarness({tables:{investment_assets:[a],depot_positions:[{id:crypto.randomUUID(),user_id:alice,symbol:a.symbol,currency:'EUR',is_open:true,quantity:1,average_entry_price:95,direction:'Long',instrument_type:'Aktie'}],investment_market_cache:[{user_id:alice,symbol:a.symbol,currency:'EUR',source:'csv',snapshot:{symbol:a.symbol,currency:'EUR',bars:points.map(p=>({date:p.date,close:p.value}))}}]}}),h=uiHarness({api});await h.controller.loadAssets();h.button({reviewPeriod:'3M'}).click();assert.match(h.els.ivValueHero.innerHTML,/data-review-period="3M" aria-pressed="true"/);assert.match(h.els.ivValueHero.innerHTML,/<svg/);assert.equal(h.els.ivFilterTitle.textContent,'Filter · Alle · 1');assert.equal(h.els.ivLegacySection.open,false);assert.equal(h.els.rvMoreActions.open,false);assert.equal(api.requests.length,0);
});
test('A chart height change cannot immediately close its data disclosure or redraw the entire chart',async()=>{
 const api=apiHarness({tables:{investment_assets:[{...a,state:{price:121,price_date:'2026-11-06'}}],depot_positions:[{id:crypto.randomUUID(),user_id:alice,symbol:a.symbol,currency:'EUR',is_open:true,quantity:1,average_entry_price:95,direction:'Long',instrument_type:'Aktie'}]}}),h=uiHarness({api});await h.controller.loadAssets();const observer=h.observed.filter(o=>o.target?.id==='ivValueChart'&&!o.disconnected).at(-1),chart=observer.target,calls=h.calls.length;chart.innerHTML='<p>Disclosure remains open</p>';observer.fn();assert.equal(chart.innerHTML,'<p>Disclosure remains open</p>');chart.clientWidth=480;observer.fn();assert.match(chart.innerHTML,/viewBox="0 0 480 240"/);assert.equal(h.calls.length,calls);
});
test('The row and depot use the newest owned stored quote while retaining a separately chosen manual valuation',()=>{
 const old={...a,state:{price:80,price_date:'2026-09-01'}},q=displayQuote(old,{priceSeries:s,now});assert.equal(q.price,121);assert.equal(q.price_date,'2026-10-09');const manual={...holding,quote:{price:95,price_date:'2026-11-20',status:'current',manual:true}};assert.equal(displayQuote(old,{holding:manual,priceSeries:s,now}).price,95);assert.equal(old.state.price,80);
});
test('An old own Deep or Signal history can supply a valuation without using its forecast paths',()=>{
 const legacy={user_id:alice,symbol:a.symbol,currency:a.currency,stored_symbol:a.symbol,stored_currency:a.currency,history:points.map(p=>({date:p.date,close:p.value})),price_date:'2026-10-09',price:121,provider:'Frühere Analyse'};assert.equal(storedValuationFor(a,{legacy:[legacy]},now).price,121);assert.equal(storedValuationFor(a,{legacy:[{...legacy,user_id:bob}]},now),null);assert.equal(storedValuationFor(a,{legacy:[{...legacy,stored_currency:'USD'}]},now),null);assert.equal(storedValuationFor(a,{legacy:[{...legacy,history:[],price:null}]},now),null);
});
test('The overview and its actual list minis change to the same selected period without another fetch',async()=>{
 const api=apiHarness({tables:{investment_assets:[{...a,watchlisted:true}],depot_positions:[{id:crypto.randomUUID(),user_id:alice,symbol:a.symbol,currency:'EUR',is_open:true,quantity:1,average_entry_price:95,direction:'Long',instrument_type:'Aktie'}],investment_market_cache:[{user_id:alice,symbol:a.symbol,currency:'EUR',source:'csv',snapshot:{symbol:a.symbol,currency:'EUR',bars:points.map(p=>({date:p.date,close:p.value}))}}]}}),h=uiHarness({api});h.setNow(now);await h.controller.loadAssets();const calls=h.calls.length;
 h.button({reviewPeriod:'1W'}).click();assert.match(h.els.ivAssets.innerHTML,/<small>[^<]*1W<\/small>/);h.controller.navigate('watch');h.button({watchPeriod:'1W'}).click();assert.match(h.els.ivAssets.innerHTML,/<small>[^<]*1W<\/small>/);assert.equal(h.calls.length,calls);assert.equal(api.requests.length,0);
});
