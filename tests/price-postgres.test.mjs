import test,{before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {postgresDepotApi} from './fixtures/depot-postgres.mjs';
import {uiHarness} from './fixtures/investment-dom.mjs';
import {alice,bob} from './fixtures/investment-api.mjs';
import {makeBars} from './fixtures/independent-market.mjs';
let api;
before(async()=>{api=await postgresDepotApi();});
beforeEach(async()=>{await api.db.exec('truncate auth.users cascade;');await api.db.query('insert into auth.users values($1),($2)',[alice,bob]);api.setOwner(alice);api.calls.length=0;api.rpcs.length=0;api.requests.length=0;});
after(async()=>api.close());
const save=async()=>{const r=await api.post({action:'save_position',manual_start:true,request_id:crypto.randomUUID(),symbol:'VOW3.XETRA',currency:'EUR',company:'Volkswagen Vz.',identity_confirmed:true,quantity:10,average_entry_price:90,direction:'Long',instrument_type:'Aktie',entry_date:'2026-11-01',valuation_mode:'manual',manual_price:100,manual_price_date:'2026-11-08'});assert.equal(r.status,200,r.body.error);return r.body;};
test('Real PostgreSQL holding -> controller -> single depot point and manual mini chart without a market or AI call',async()=>{
 await save();const h=uiHarness({api});await h.controller.loadAssets();assert.match(h.els.ivValueHero.innerHTML,/<circle/);assert.match(h.els.ivValueHero.innerHTML,/1.000 EUR/);assert.match(h.els.ivAssets.innerHTML,/price-sparkline/);assert.match(h.els.ivAssets.innerHTML,/manuell/);assert.equal(api.requests.length,0);assert.equal((await api.db.query('select count(*)::int as n from investment_reviews')).rows[0].n,0);
});
test('Real PostgreSQL CSV chart refresh -> depot sparkline -> saved watch graph and detail history independently of an analysis',async()=>{
 const {asset}=await save(),r=await api.post({action:'refresh_chart',manual_start:true,asset_id:asset.id,symbol:asset.symbol,currency:asset.currency,source:'csv',bars:makeBars()});assert.equal(r.status,200,r.body.error);assert.equal(r.body.series.points.length,300);assert.equal(r.body.asset.analysis_at,null);assert.equal(r.body.portfolio.holdings[0].amount,1000);assert.equal(r.body.portfolio.holdings[0].quote.manual,true);
 await api.post({action:'set_watchlist',asset_id:asset.id,watchlisted:true});const h=uiHarness({api});await h.controller.loadAssets();assert.match(h.els.ivAssets.innerHTML,/price-sparkline/);h.controller.navigate('watch');assert.match(h.els.ivValueHero.innerHTML,/Kursindex · Start 100/);await h.controller.openAsset(h.controller.getState().assets[0]);assert.equal(h.els.rvResult.hidden,true);assert.equal(h.els.rvPricePanel.hidden,false);assert.match(h.els.rvPricePlot.innerHTML,/class="price-line"/);assert.match(h.els.rvPriceInfo.textContent,/300 gespeicherte Werte/);assert.equal((await api.db.query('select count(*)::int as n from investment_reviews')).rows[0].n,0);assert.equal(api.requests.length,0);
});
test('Actual database caches and current-report joins cannot expose another owner’s price series',async()=>{
 const {asset}=await save();await api.db.query('insert into investment_market_cache(user_id,symbol,currency,source,snapshot) values($1,$2,$3,$4,$5)',[bob,asset.symbol,asset.currency,'csv',JSON.stringify({symbol:asset.symbol,currency:asset.currency,bars:makeBars(),provider:'FOREIGN'})]);const r=await api.post({action:'get_chart_series',asset_ids:[asset.id]});assert.equal(r.status,200);assert.equal(r.body.series[0].kind,'manual_valuation');assert.notEqual(r.body.series[0].source,'FOREIGN');api.setOwner(bob);assert.equal((await api.post({action:'get_chart_series',asset_ids:[asset.id]})).status,404);
});
test('The real database and dashboard reconstruct a curve from stored daily prices without two prior account marks',async()=>{
 const {asset}=await save();await api.db.query('update depot_positions set entry_date=$1',['2026-01-05']);const r=await api.post({action:'refresh_chart',manual_start:true,asset_id:asset.id,symbol:asset.symbol,currency:asset.currency,source:'csv',bars:makeBars()});assert.equal(r.status,200);
 const h=uiHarness({api});await h.controller.loadAssets();assert.match(h.els.ivValueHero.innerHTML,/data-chart-mode="reconstructed"/);assert.match(h.els.ivValueHero.innerHTML,/class="price-line"/);assert.match(h.els.ivValueHero.innerHTML,/Keine vollständige historische Depotbilanz/);assert.equal(api.requests.length,0);
 await api.db.exec('update depot_positions set entry_date=null');await h.controller.loadAssets({force:true,sync:false});assert.match(h.els.ivValueHero.innerHTML,/data-chart-mode="comparison"/);assert.match(h.els.ivValueHero.innerHTML,/Kursindex · Start 100/);
});
test('Real missing snapshot table is diagnosed while prices still produce a visible historical graph',async()=>{
 const {asset}=await save();await api.db.query('update depot_positions set entry_date=$1',['2026-01-05']);await api.post({action:'refresh_chart',manual_start:true,asset_id:asset.id,symbol:asset.symbol,currency:asset.currency,source:'csv',bars:makeBars()});await api.db.exec('alter table investment_portfolio_marks rename to investment_marks_test_unavailable');
 try{const h=uiHarness({api});await h.controller.loadAssets();assert.match(h.els.ivValueHero.innerHTML,/class="price-line"/);assert.match(h.els.ivValueHero.innerHTML,/Verlaufshistorie ist nicht erreichbar/);assert.match(h.els.ivDiagnosticsBody.innerHTML,/Nicht erreichbar · SQL\/Projekt prüfen/);assert.equal(h.controller.getState().portfolio.holdings[0].amount,1000);assert.equal(api.requests.length,0);}finally{await api.db.exec('alter table investment_marks_test_unavailable rename to investment_portfolio_marks');}
});
test('Actual PostgreSQL stored OHLCV can prepare Deep without triggering any analysis or provider',async()=>{
 const {asset}=await save();await api.post({action:'refresh_chart',manual_start:true,asset_id:asset.id,symbol:asset.symbol,currency:asset.currency,source:'csv',bars:makeBars()});const r=await api.post({action:'prepare_deep',asset_id:asset.id});assert.equal(r.status,200);assert.equal(r.body.bars.length,300);assert.equal((await api.db.query('select count(*)::int as n from investment_reviews')).rows[0].n,0);assert.equal(api.requests.length,0);
});
