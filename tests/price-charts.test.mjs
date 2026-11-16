import test from 'node:test';
import assert from 'node:assert/strict';
import {chartGeometry,lineChart,portfolioHistoryChart,periodPoints,watchComparison,seriesSpark} from '../price-charts.mjs';
import {cleanPricePoints,selectPriceSeries} from '../supabase/functions/_shared/price-series.mjs';
import {alice,bob,apiHarness} from './fixtures/investment-api.mjs';
import {now,makeBars} from './fixtures/independent-market.mjs';
const points=[{date:'2026-11-04',value:100},{date:'2026-11-05',value:105},{date:'2026-11-06',value:102}];
const own=()=>({id:crypto.randomUUID(),user_id:alice,symbol:'VOW3.XETRA',currency:'EUR',state:{},config:{source:'stored'}});
const snapshot=(a,bars=makeBars())=>({symbol:a.symbol,currency:a.currency,provider:'CSV',bars});
test('A single real portfolio valuation has a visible labelled point rather than empty axes',()=>{
 const html=portfolioHistoryChart([{currency:'EUR',amount:320,recorded_at:'2026-11-06T12:00Z'}],'EUR',{now});
 assert.match(html,/<circle[^>]*r="5"/);assert.match(html,/320 EUR/);assert.match(html,/ein Messpunkt/);assert.doesNotMatch(html,/class="price-line"/);
});
test('Unchanged real valuations render a nonzero horizontal line including zero portfolio value',()=>{
 for(const amount of [0,100]){const html=portfolioHistoryChart(['05','06'].map(day=>({currency:'EUR',amount,recorded_at:'2026-11-'+day+'T12:00Z'})),'EUR',{now});assert.match(html,/class="price-line"/);assert.match(html,/stroke="#50d2c2"/);assert.doesNotMatch(html,/NaN|Infinity/);const g=chartGeometry(periodPoints(points.map(p=>({...p,value:amount})),'Max',now));assert.ok(g.points.at(-1).x>g.points[0].x);assert.equal(g.points[0].y,g.points.at(-1).y);}
});
test('Missing, future and wrong-currency valuations cannot become invented graph values',()=>{
 const marks=[null,'',undefined,-1].map(amount=>({currency:'EUR',amount,recorded_at:'2026-11-06'}));marks.push({currency:'USD',amount:50,recorded_at:'2026-11-06'},{currency:'EUR',amount:99,recorded_at:'2026-12-01'});
 const html=portfolioHistoryChart(marks,'EUR',{now});assert.match(html,/Noch keine gültige/);assert.doesNotMatch(html,/<svg/);
});
test('Coincident timestamps are deduplicated and retain a visible point with the last real amount',()=>{
 const html=lineChart([{date:points[0].date,value:1},{date:points[0].date,value:2}],{now,currency:'EUR'});assert.match(html,/2 EUR/);assert.match(html,/<circle/);assert.doesNotMatch(html,/NaN|Infinity/);
});
test('Phone and desktop geometry keeps every data point inside a finite chart box',()=>{
 for(const width of [280,320,375,900,NaN,Infinity]){const g=chartGeometry(periodPoints(points,'Max',now),{width});assert.ok(Number.isFinite(g.w)&&g.w>=280&&g.w<=2400);for(const p of g.points){assert.ok(p.x>=g.left&&p.x<=g.right);assert.ok(p.y>=g.top&&p.y<=g.bottom);}assert.doesNotMatch(lineChart(points,{width,now}),/NaN|Infinity/);}
});
test('Period controls filter actual observations without interpolating unavailable days',()=>{
 const data=[{date:'2025-11-06',value:1},...points];assert.equal(periodPoints(data,'1W',now).length,3);assert.equal(periodPoints(data,'Max',now).length,4);assert.match(lineChart([{date:'2025-01-01',value:100}],{now}),/„Max“/);assert.doesNotMatch(lineChart([],{now}),/<svg/);
});
test('The selected historical observation is readable independently of hover',()=>{
 assert.match(lineChart(points,{now,currency:'EUR',selected:'2026-11-05'}),/<strong>105 EUR<\/strong>/);assert.match(seriesSpark({currency:'EUR',points},{now}),/22|3 Kurse/);assert.match(seriesSpark({currency:'EUR',kind:'manual_valuation',points:[points[0]]},{now}),/Ein Messpunkt.*manuell/);
});
test('Watch comparison uses a shared start and end and does not sum currencies or use forecast paths',()=>{
 const assets=[{id:'a',symbol:'A.XETRA',currency:'EUR'},{id:'b',symbol:'B.US',currency:'USD'}],series={a:{kind:'price_history',points},b:{kind:'price_history',points:[{date:'2026-11-05',value:200},{date:'2026-11-06',value:220},{date:'2026-11-07',value:240}]}};
 const html=watchComparison(assets,series,{now});assert.match(html,/Start 2026-11-05/);assert.match(html,/10 %/);assert.match(html,/-2,86 %/);assert.doesNotMatch(html,/20 %/);assert.match(html,/ohne Währungsumrechnung/);assert.equal((html.match(/<path/g)||[]).length,2);
 series.b.points=[{date:'2026-11-06',value:220},{date:'2026-11-07',value:240}];assert.match(watchComparison(assets,series,{now}),/zwei gemeinsame/);
 series.a.kind='manual_valuation';series.b.kind='forecast';assert.doesNotMatch(watchComparison(assets,series,{now}),/<svg/);
});
test('Chart input retains only real positive completed-day prices and deduplicates exact dates',()=>{
 const cleaned=cleanPricePoints([{date:'2026-02-30',close:1},{date:'2026-11-09',close:1},{date:'2026-11-08',close:1},{date:'2026-11-05',close:'123'},{date:'2026-11-04',close:0},{date:'2026-11-06',close:3},{date:'2026-11-06',close:4}],{now});assert.deepEqual(cleaned,[{date:'2026-11-06',value:4}]);assert.equal(cleanPricePoints([{date:'2026-11-08',value:12}],{now,allowToday:true}).length,1);
});
test('Price histories require exact owner, security class and currency; forecasts never become prices',()=>{
 const a=own(),valid={user_id:alice,symbol:a.symbol,currency:a.currency,snapshot:snapshot(a)},rows=[{...valid,user_id:bob},{...valid,symbol:'VOW.XETRA'},{...valid,currency:'USD'}];assert.equal(selectPriceSeries(a,{caches:rows},now).status,'missing');
 const forecast={user_id:alice,asset_id:a.id,snapshot:{symbol:a.symbol,currency:a.currency,analysis:{simulation:{paths:points},scenarios:points}}};assert.equal(selectPriceSeries(a,{reviews:[forecast]},now).points.length,0);
});
test('A stale historical series survives blocked forecasts and a newer isolated price',()=>{
 const a=own(),old=snapshot(a,[{date:'2026-01-05',close:10},{date:'2026-01-06',close:11}]);old.quality={blocked:true};
 const c=selectPriceSeries(a,{caches:[{user_id:alice,symbol:a.symbol,currency:a.currency,snapshot:old},{user_id:alice,symbol:a.symbol,currency:a.currency,snapshot:snapshot(a,[{date:'2026-11-06',close:100}])}]},now);assert.equal(c.points.length,2);assert.equal(c.price_date,'2026-01-06');assert.match(lineChart(c.points,{now,period:'Max'}),/<path/);
});
test('Older Deep and Signal analyses contribute only their actual recorded histories',()=>{
 const a=own(),row={user_id:alice,symbol:a.symbol,currency:a.currency,raw_result:{...snapshot(a),bars:undefined,history:makeBars().slice(-60)}};
 for(const field of ['deep','signals']){const s=selectPriceSeries(a,{[field]:[row]},now);assert.equal(s.kind,'price_history');assert.equal(s.points.length,60);}
});
test('Own manual valuation is a labelled point without being passed off as market history',()=>{
 const a={...own(),valuation_override:{source:'manual',price:90,price_date:'2026-11-08'}};const s=selectPriceSeries(a,{},now);assert.equal(s.kind,'manual_valuation');assert.equal(s.points.length,1);assert.match(s.source,/manuell/);
});
test('Read-only series endpoint makes no provider, quota, model or mutation calls and rejects foreign IDs',async()=>{
 const a=own(),api=apiHarness({tables:{investment_assets:[a,{...own(),user_id:bob}],investment_market_cache:[{user_id:alice,symbol:a.symbol,currency:a.currency,snapshot:snapshot(a)}]}});
 const r=await api.post({action:'get_chart_series',asset_ids:[a.id]});assert.equal(r.status,200);assert.equal(r.body.series[0].points.length,300);assert.equal(api.requests.length,0);assert.equal(api.rpcs.length,0);assert.ok(api.calls.every(c=>c.action==='read'));
 assert.equal((await api.post({action:'get_chart_series',asset_ids:[api.db.investment_assets[1].id]})).status,404);assert.equal((await api.post({action:'get_chart_series',asset_ids:Array(25).fill(a.id)})).status,400);assert.equal((await api.post({action:'get_chart_series',asset_ids:[a.id]},{auth:false})).status,401);
});
test('Missing legacy tables cannot prevent the current owner cache from supplying graphics',async()=>{
 const a=own(),api=apiHarness({tables:{investment_assets:[a],investment_market_cache:[{user_id:alice,symbol:a.symbol,currency:a.currency,snapshot:snapshot(a)}]},beforeQuery:q=>{if(['deep_analyses','signal_simulations'].includes(q.table))throw Error('legacy missing');}});
 const r=await api.post({action:'get_chart_series',asset_ids:[a.id]});assert.equal(r.status,200);assert.equal(r.body.series[0].points.length,300);assert.equal(r.body.series[0].warnings.length,2);
});
test('CSV chart refresh stores prices while preserving the analysis timestamp and creating no report or AI call',async()=>{
 const a={...own(),analysis_at:'2026-01-01T12:00Z',latest_review_id:crypto.randomUUID(),checked_at:'2026-01-02T12:00Z',state:{price:12,price_date:'2026-01-01',decision:{current:true,label:'Alt'}}},api=apiHarness({tables:{investment_assets:[a]}});
 const r=await api.post({action:'refresh_chart',asset_id:a.id,manual_start:true,symbol:a.symbol,currency:a.currency,source:'csv',bars:makeBars()});assert.equal(r.status,200);assert.equal(r.body.series.points.length,300);assert.equal(r.body.asset.analysis_at,a.analysis_at);assert.equal(r.body.asset.checked_at,a.checked_at);assert.equal(r.body.asset.latest_review_id,a.latest_review_id);assert.equal(r.body.asset.state.plan_pending,true);assert.equal(api.requests.length,0);assert.equal(api.rpcs.some(r=>/reserve|commit/.test(r.name)),false);assert.equal(api.db.investment_reviews.length,0);
});
test('Failed public quote leaves the existing graph and prior quote intact with no EODHD fallback',async()=>{
 const a={...own(),state:{price:50,price_date:'2026-01-06'}},bars=[...makeBars().map(b=>({...b,date:new Date(Date.parse(b.date)-365*86400000).toISOString().slice(0,10)}))],api=apiHarness({tables:{investment_assets:[a],investment_market_cache:[{user_id:alice,symbol:a.symbol,currency:a.currency,source:'csv',snapshot:snapshot(a,bars)}]},fetchImpl:async()=>new Response('{}',{status:429})});
 const r=await api.post({action:'refresh_chart',asset_id:a.id,manual_start:true,symbol:a.symbol,currency:a.currency,source:'independent',quote_symbol:'VOW3.DE',quote_confirmed:true});assert.equal(r.status,200);assert.equal(r.body.attempt.status,'failed');assert.equal(r.body.asset.state.price,50);assert.equal(r.body.series.points.length,bars.length);assert.ok(api.requests.length>0);assert.ok(api.requests.every(([url])=>!String(url).includes('eodhd.com')));assert.equal(api.rpcs.some(r=>r.name==='reserve_hybrid_eodhd_calls'),false);
});
test('Actual daily depot marks retain same-day deduplication and record unchanged valuations on a later day only',async()=>{
 let clock=new Date(now);const a={...own(),is_portfolio:true,state:{price:100,price_date:'2026-11-06'}},api=apiHarness({nowImpl:()=>clock,tables:{investment_assets:[a],depot_positions:[{id:crypto.randomUUID(),user_id:alice,symbol:a.symbol,currency:a.currency,is_open:true,quantity:2,average_entry_price:80,direction:'Long',instrument_type:'Aktie'}]}});
 await api.post({action:'portfolio_overview'});await api.post({action:'portfolio_overview'});assert.equal(api.db.investment_portfolio_marks.length,1);clock=new Date('2026-11-10T12:00Z');await api.post({action:'portfolio_overview'});assert.equal(api.db.investment_portfolio_marks.length,2);assert.deepEqual(api.db.investment_portfolio_marks.map(m=>m.amount),[200,200]);assert.match(portfolioHistoryChart(api.db.investment_portfolio_marks,'EUR',{now:clock}),/class="price-line"/);assert.equal(api.db.investment_portfolio_marks.some(m=>m.recorded_at.startsWith('2026-11-09')),false);
});
test('A history-table outage leaves the current portfolio amount and positions available',async()=>{
 const a={...own(),state:{price:100,price_date:'2026-11-06'}},api=apiHarness({tables:{investment_assets:[a],depot_positions:[{id:crypto.randomUUID(),user_id:alice,symbol:a.symbol,currency:a.currency,is_open:true,quantity:2,average_entry_price:80,direction:'Long',instrument_type:'Aktie'}]},beforeQuery:q=>{if(q.table==='investment_portfolio_marks')throw Error('unavailable');}});
 const r=await api.post({action:'portfolio_overview'});assert.equal(r.status,200);assert.equal(r.body.portfolio.groups[0].amount,200);assert.equal(r.body.portfolio.holdings.length,1);assert.match(r.body.portfolio_warning,/nicht erreichbar/);
});
