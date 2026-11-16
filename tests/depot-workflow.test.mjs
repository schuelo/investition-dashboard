import test,{before,beforeEach,after} from 'node:test';import assert from 'node:assert/strict';
import {postgresDepotApi} from './fixtures/depot-postgres.mjs';import {uiHarness} from './fixtures/investment-dom.mjs';import {alice,bob} from './fixtures/investment-api.mjs';
import {validateDepotInput} from '../supabase/functions/_shared/depot-input.mjs';import {valuationQuote} from '../supabase/functions/_shared/portfolio-value.mjs';import {now} from './fixtures/independent-market.mjs';
let api;const scalar=async(sql,p=[])=>Object.values((await api.db.query(sql,p)).rows[0])[0];
const body=patch=>({action:'save_position',manual_start:true,request_id:crypto.randomUUID(),symbol:'VOW3.XETRA',currency:'EUR',company:'Volkswagen Vz.',identity_confirmed:true,quantity:'10',average_entry_price:'95,50',direction:'Long',instrument_type:'Aktie',entry_date:'2026-11-01',...patch});
const save=async patch=>{const r=await api.post(body(patch));assert.equal(r.status,200,r.body.error);return r.body;};
async function fillNew(h,{symbol='VOW3.XETRA',company='Volkswagen Vz.',quantity='10',entry='95,50'}={}){await h.els.ivAddPosition.fire('click');h.els.hpSymbol.value=symbol;await h.els.hpSymbol.fire('input');h.els.hpCompany.value=company;h.els.hpCurrency.value=symbol.endsWith('.US')?'USD':'EUR';h.els.hpConfirmed.checked=true;h.els.rvHoldingQuantity.value=quantity;h.els.rvHoldingEntry.value=entry;h.els.hpEntryDate.value='2026-11-01';}
before(async()=>{api=await postgresDepotApi();});
beforeEach(async()=>{await api.db.exec('truncate auth.users cascade;truncate investment_monitor_health;');await api.db.query('insert into auth.users values($1),($2)',[alice,bob]);api.setOwner(alice);api.calls.length=0;api.rpcs.length=0;api.requests.length=0;});
after(async()=>{await api.close();});
test('Empty depot -> Add position -> actual form -> PostgreSQL -> visible invested capital, without a prior analysis or provider',async()=>{
 const h=uiHarness({api});await h.controller.loadAssets();await fillNew(h);assert.equal(h.controller.getState().route,'holding');await h.els.rvHoldingForm.fire('submit');
 assert.equal(h.controller.getState().route,'portfolio');assert.match(h.els.ivAssets.innerHTML,/Volkswagen Vz/);assert.match(h.els.ivAssets.innerHTML,/Stückzahl/);assert.match(h.els.ivAssets.innerHTML,/95,5/);assert.match(h.els.ivValueHero.innerHTML,/955 EUR/);assert.match(h.els.ivValueHero.innerHTML,/Kursbewertung offen/);
 assert.equal(Number(await scalar('select quantity from depot_positions')),10);assert.equal(Number(await scalar('select average_entry_price from depot_positions')),95.5);assert.equal(await scalar('select entry_date::text from depot_positions'),'2026-11-01');
 assert.equal(Number(await scalar('select count(*) from investment_reviews')),0);assert.equal(api.requests.length,0);assert.ok(h.calls.every(c=>!['analyze','remember','save_config'].includes(c.body.action)));assert.match(h.els.ivSetupStatus.textContent,/bereit/);
});
test('Reloading and editing uses the same actual lot and replaces its absolute quantity',async()=>{
 const first=await save(),h=uiHarness({api});await h.controller.loadAssets();await h.controller.holdingEditor.open(h.controller.getState().assets[0]);assert.equal(Number(h.els.rvHoldingQuantity.value),10);assert.equal(Number(h.els.rvHoldingEntry.value),95.5);assert.equal(h.els.hpEntryDate.value,'2026-11-01');h.els.rvHoldingQuantity.value='8';await h.els.rvHoldingForm.fire('submit');
 assert.equal(Number(await scalar('select count(*) from depot_positions')),1);assert.equal(Number(await scalar('select quantity from depot_positions where id=$1',[first.position.id])),8);assert.match(h.els.ivValueHero.innerHTML,/764 EUR/);assert.equal(api.requests.length,0);
});
test('A manual valuation from today produces dated P/L while leaving chart prices and analysis timestamps untouched',async()=>{
 const first=await save(),h=uiHarness({api});await h.controller.loadAssets();await h.controller.holdingEditor.open(h.controller.getState().assets[0]);h.els.hpValuation.value='manual';h.els.hpManualPrice.value='100';h.els.hpManualDate.value='2026-11-08';await h.els.rvHoldingForm.fire('submit');
 const a=(await api.post({action:'get_holdings',asset_id:first.asset.id})).body.asset;assert.equal(a.state.price,undefined);assert.equal(a.analysis_at,null);assert.equal(a.valuation_override.price,100);
 const hld=h.controller.getState().portfolio.holdings[0];assert.equal(hld.amount,1000);assert.equal(hld.invested,955);assert.equal(hld.pnl,45);assert.equal(hld.quote.status,'current');assert.match(h.els.ivAssets.innerHTML,/Manuell erfasst/);assert.match(h.els.ivAssets.innerHTML,/2026-11-08/);assert.equal(api.requests.length,0);
});
test('Multiple lots require explicit addition and share a correct weighted entry; editing does not add purchases',async()=>{
 await save({valuation_mode:'manual',manual_price:100,manual_price_date:'2026-11-08'});const h=uiHarness({api});await h.controller.loadAssets();await h.controller.holdingEditor.open(h.controller.getState().assets[0]);h.els.rvHoldingSelect.value='new';await h.els.rvHoldingSelect.fire('change');h.els.rvHoldingQuantity.value='5';h.els.rvHoldingEntry.value='110';await h.controller.holdingEditor.save();assert.match(h.els.rvHoldingStatus.textContent,/ausdrücklich bestätigen/);assert.equal(Number(await scalar('select count(*) from depot_positions')),1);
 h.els.hpAdditionalConfirmed.checked=true;await h.els.rvHoldingForm.fire('submit');const summary=h.controller.getState().portfolio.holdings[0];assert.equal(summary.quantity,15);assert.equal(summary.invested,1505);assert.ok(Math.abs(summary.average_entry_price-1505/15)<1e-10);assert.equal(summary.pnl,-5);assert.equal(Number(await scalar('select count(*) from depot_positions')),2);
});
test('The server rejects an unconfirmed extra position even when an existing asset was not loaded into the client',async()=>{
 await save();const r=await api.post(body());assert.equal(r.status,409);assert.match(r.body.error,/besteht bereits/);assert.equal(Number(await scalar('select count(*) from depot_positions')),1);
 const h=uiHarness({api});await fillNew(h);await h.els.rvHoldingForm.fire('submit');assert.equal(h.controller.getState().route,'holding');assert.match(h.els.rvHoldingStatus.textContent,/bereits Bestand/);assert.equal(Number(h.els.rvHoldingQuantity.value),10);assert.equal(Number(await scalar('select count(*) from depot_positions')),1);
});
test('Closing requires a deliberate confirmation and keeps the underlying stored record',async()=>{
 await save();const h=uiHarness({api});await h.controller.loadAssets();await h.controller.holdingEditor.open(h.controller.getState().assets[0]);await h.controller.holdingEditor.save(true);assert.match(h.els.rvHoldingStatus.textContent,/bestätigen/);h.els.hpCloseConfirmed.checked=true;await h.controller.holdingEditor.save(true);
 assert.equal(await scalar('select is_open from depot_positions'),false);assert.equal(Number(await scalar('select count(*) from depot_positions')),1);assert.doesNotMatch(h.els.ivAssets.innerHTML,/Volkswagen/);assert.equal(h.controller.getState().route,'portfolio');
});
test('A new saved position is visible immediately even when a previous list filter would have hidden it',async()=>{
 const h=uiHarness({api});await h.controller.loadAssets();h.button({reviewFilter:'failed'}).click();await fillNew(h);await h.els.rvHoldingForm.fire('submit');assert.match(h.els.ivAssets.innerHTML,/Volkswagen/);assert.match(h.els.ivFilters.innerHTML,/data-review-filter="all" aria-pressed="true"/);
});
test('Entry and dated manual valuation remain separate from stale chart data and a failed provider attempt',async()=>{
 const r=await save({valuation_mode:'manual',manual_price:100,manual_price_date:'2026-11-08'});await api.db.query("update investment_assets set state=state||$1::jsonb where id=$2",[JSON.stringify({price:90,price_date:'2026-11-01',provider:'CSV',last_attempt:{status:'failed',at:now.toISOString(),error:'Provider 429'}}),r.asset.id]);const h=uiHarness({api});await h.controller.loadAssets();assert.match(h.els.ivAssets.innerHTML,/Abruf fehlgeschlagen/);assert.match(h.els.ivAssets.innerHTML,/2026-11-01/);assert.match(h.els.ivAssets.innerHTML,/Manuell erfasst/);assert.equal(h.controller.getState().portfolio.holdings[0].pnl,45);assert.equal(api.requests.length,0);
});
test('Manual identity changes clear prior units, entry, identifiers and valuation inputs before another security can be saved',async()=>{
 await save({wkn:'766403',valuation_mode:'manual',manual_price:100,manual_price_date:'2026-11-08'});const h=uiHarness({api});await h.controller.loadAssets();await h.controller.holdingEditor.open(h.controller.getState().assets[0]);h.els.hpSymbol.value='BAS.XETRA';await h.els.hpSymbol.fire('input');assert.equal(h.els.rvHoldingQuantity.value,'');assert.equal(h.els.rvHoldingEntry.value,'');assert.equal(h.els.hpWkn.value,'');assert.equal(h.els.hpCompany.value,'');assert.equal(h.els.hpManualPrice.value,'');assert.equal(h.els.hpValuation.value,'keep');assert.equal(h.els.hpConfirmed.checked,false);assert.equal(h.controller.holdingEditor.getState().asset,null);
});
test('A missing V39.2 SQL migration is shown as an incomplete setup and prevents all writes',async()=>{
 const old=await postgresDepotApi({withV392:false});try{const h=uiHarness({api:old});await h.controller.loadAssets();assert.match(h.els.ivSetupStatus.textContent,/unvollständig/);await fillNew(h);await h.els.rvHoldingForm.fire('submit');assert.match(h.els.rvHoldingStatus.textContent,/Datenbankerweiterung fehlt/);assert.equal(old.rpcs.length,0);assert.equal(Number((await old.db.query('select count(*) as n from investment_assets')).rows[0].n),0);}finally{await old.close();}
});
test('A late save response cannot repopulate the previous owner’s holdings or entry inputs after logout',async()=>{
 let release,entered;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r),h=uiHarness({api,beforeInvoke:async b=>{if(b.action==='save_position'){entered();await gate;}}});await fillNew(h);const saving=h.controller.holdingEditor.save();await ready;h.setOwner(null);h.emit('investition:auth-changed');release();await saving;assert.equal(h.els.rvHoldingQuantity.value,'');assert.equal(h.els.hpCompany.value,'');assert.equal(h.els.rvHoldingPanel.hidden,true);assert.equal(h.controller.getState().portfolio,null);assert.doesNotMatch(h.els.ivAssets.innerHTML,/Volkswagen/);assert.equal(h.els.rvHoldingSave.disabled,false);
});
test('The endpoint derives the owner from authentication and refuses foreign asset mutation',async()=>{
 const r=await save();api.setOwner(bob);const foreign=await api.post(body({asset_id:r.asset.id,position_id:r.position.id,user_id:alice}));assert.equal(foreign.status,404);assert.equal(Number(await scalar('select quantity from depot_positions')),10);api.setOwner(null);assert.equal((await api.post(body())).status,401);
});
test('Same request retries are idempotent and cannot reopen a later closed position',async()=>{
 const request=body(),first=await api.post(request);assert.equal(first.status,200);const again=await api.post(request);assert.equal(again.status,200);assert.equal(Number(await scalar('select count(*) from depot_positions')),1);
 await save({asset_id:first.body.asset.id,position_id:first.body.position.id,close:true});assert.equal((await api.post(request)).status,200);assert.equal(await scalar('select is_open from depot_positions'),false);const changed=await api.post({...request,quantity:11});assert.equal(changed.status,409);
});
test('Position validation accepts German decimal input and rejects ambiguous numbers, future dates and mismatched currency',()=>{
 const input=validateDepotInput(body({quantity:'10,5',average_entry_price:'95.5'}),now);assert.equal(input.quantity,10.5);assert.equal(input.average_entry_price,95.5);
 for(const patch of [{quantity:'1.234,56'},{quantity:'NaN'},{quantity:'Infinity'},{average_entry_price:0},{entry_date:'2027-01-01'},{currency:'USD'},{identity_confirmed:false},{valuation_mode:'manual',manual_price:100,manual_price_date:'2027-01-01'}])assert.throws(()=>validateDepotInput(body(patch),now));
 assert.equal(valuationQuote({valuation_override:{source:'manual',price:100,price_date:'2026-11-08'}},now).price,100);assert.equal(valuationQuote({valuation_override:{source:'manual',price:100,price_date:'2027-01-01'}},now).price,null);
});
