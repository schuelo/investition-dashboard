import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {apiHarness,alice,bob} from './fixtures/investment-api.mjs';import {uiHarness} from './fixtures/investment-dom.mjs';
import {mergedPositions} from '../supabase/functions/_shared/legacy-portfolio.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
const vw=()=>{const p=JSON.parse(readFileSync(new URL('../startdaten.json',import.meta.url))).trades.find(t=>t.marketSymbol==='VOW3.XETRA');return {...p,id:crypto.randomUUID(),user_id:alice,market_symbol:p.marketSymbol,instrument_type:p.type,monitoring_enabled:p.monitoringEnabled};};
const asset=()=>({id:crypto.randomUUID(),user_id:alice,symbol:'VOW3.XETRA',currency:'EUR',company:'Volkswagen Vz.',legacy_trade_ids:[],state:{},config:{source:'stored'},enabled:false,is_portfolio:false});
test('The actual saved VW seed is recovered without fabricating shares, cost, quotes or a filled order',async()=>{
 const p=vw(),api=apiHarness({tables:{trade_plans:[p]}}),h=uiHarness({api});await h.controller.loadAssets();
 const a=api.db.investment_assets[0];assert.equal(a.symbol,'VOW3.XETRA');assert.deepEqual(a.legacy_trade_ids,[p.id]);assert.equal(a.is_portfolio,false);assert.equal(a.config.source,'stored');assert.equal(a.state.price,undefined);
 assert.equal(h.els.ivLegacySection.hidden,false);assert.match(h.els.ivLegacyAssets.innerHTML,/Volkswagen Vz/);assert.doesNotMatch(h.els.ivAssets.innerHTML,/Volkswagen/);assert.equal(api.db.depot_positions.length,0);assert.equal(api.requests.length,0);
 await h.controller.openAsset(h.controller.getState().assets[0]);await h.controller.holdingEditor.open();assert.equal(h.els.rvHoldingQuantity.value,'');assert.equal(h.els.rvHoldingEntry.value,'');assert.equal(h.controller.getState().route,'holding');assert.equal(h.els.rvHoldingTitle.textContent,'Position hinzufügen');
});
test('Repeated sync retains every own legacy plan reference and respects disabled monitoring',async()=>{
 const p=vw(),q={...p,id:crypto.randomUUID(),monitoring_enabled:false},api=apiHarness({tables:{trade_plans:[{...p,monitoring_enabled:false},q,{...p,id:crypto.randomUUID(),user_id:bob}]}});await api.post({action:'sync_portfolio'});await api.post({action:'sync_portfolio'});
 assert.equal(api.db.investment_assets.length,1);assert.deepEqual(api.db.investment_assets[0].legacy_trade_ids.sort(),[p.id,q.id].sort());assert.equal(api.db.investment_assets[0].enabled,false);assert.equal(api.requests.length,0);
});
test('Only explicitly open legacy shares are holdings; missing entry and neutral direction stay unknown',async()=>{
 const p={...vw(),status:'Position offen',quantity:12},api=apiHarness({tables:{trade_plans:[p]}});await api.post({action:'sync_portfolio'});const a=api.db.investment_assets[0],r=await api.post({action:'get_holdings',asset_id:a.id});
 assert.equal(a.is_portfolio,true);assert.equal(r.body.positions[0].quantity,12);assert.equal(r.body.positions[0].average_entry_price,null);assert.equal(r.body.positions[0].direction,'Neutral');
 const h=uiHarness({api});await h.controller.openAsset(a);await h.controller.holdingEditor.open();assert.equal(h.els.rvHoldingQuantity.value,12);assert.equal(h.els.rvHoldingEntry.value,'');assert.equal(h.els.rvHoldingDirection.value,'');
});
test('A closed real position overrides the old open plan and cannot be resurrected by sync',async()=>{
 const p={...vw(),status:'Position offen',quantity:12},row={id:crypto.randomUUID(),user_id:alice,trade_id:p.id,is_open:false},api=apiHarness({tables:{trade_plans:[p],depot_positions:[row]}});await api.post({action:'sync_portfolio'});assert.equal(api.db.investment_assets[0].is_portfolio,false);assert.equal((await api.post({action:'get_holdings',asset_id:api.db.investment_assets[0].id})).body.positions.length,0);
});
test('Nullable legacy open flags and exact XETR identity work without merging share classes or currencies',()=>{
 const p=vw(),rows=[{id:crypto.randomUUID(),user_id:alice,trade_id:p.id,is_open:null,quantity:2}],r=mergedPositions(rows,[p],[],[]);assert.equal(r[0].symbol,'VOW3.XETRA');assert.equal(r[0].currency,'EUR');assert.notEqual(r[0].symbol,'VOW.XETRA');
 const foreign={id:crypto.randomUUID(),user_id:bob,symbol:'OTHER.US',currency:'USD',legacy_trade_ids:[p.id]};assert.equal(mergedPositions([],[{...p,status:'Position offen',quantity:2}],[foreign],[])[0].symbol,'VOW3.XETRA');
});
test('Discarded and closed old plans do not return as new candidates',async()=>{
 const p=vw(),api=apiHarness({tables:{trade_plans:['Verworfen','Geschlossen','Verkauft'].map(status=>({...p,id:crypto.randomUUID(),status}))}});await api.post({action:'sync_portfolio'});assert.equal(api.db.investment_assets.length,0);
});
test('A missing value-history table cannot hide the saved VW list',async()=>{
 const api=apiHarness({tables:{trade_plans:[vw()]},beforeQuery:q=>{if(q.table==='investment_portfolio_marks')throw Error('history unavailable');}}),h=uiHarness({api});await h.controller.loadAssets();assert.match(h.els.ivLegacyAssets.innerHTML,/Volkswagen/);assert.match(h.els.ivStatus.textContent,/Hinweis/);assert.equal(h.controller.getState().assets.length,1);
});
test('An ambiguous older plan can be mapped to an existing saved asset, with owner and currency checks',async()=>{
 const p={...vw(),symbol:'UNKNOWN',market_symbol:null},a=asset(),api=apiHarness({tables:{trade_plans:[p],investment_assets:[a]}}),h=uiHarness({api});await h.controller.loadAssets();h.button({reviewUnmapped:'0'}).click();
 h.els.rvSymbol.value=a.symbol;h.emit('investition:security-picked',{scope:'review',security:{market_symbol:a.symbol,currency:'EUR',name:a.company}});await tick();assert.equal(h.els.rvLegacyTradeId.value,p.id);
 await h.controller.run(true);await api.post({action:'sync_portfolio'});assert.deepEqual(api.db.investment_assets[0].legacy_trade_ids,[p.id]);assert.equal(api.db.investment_assets.length,1);
 const request={action:'save_config',manual_start:true,symbol:a.symbol,currency:a.currency,source:'stored',legacy_trade_id:crypto.randomUUID()};assert.equal((await api.post(request)).status,422);
 const other={...p,id:crypto.randomUUID(),user_id:bob};api.db.trade_plans.push(other);assert.equal((await api.post({...request,legacy_trade_id:other.id})).status,422);
 api.db.trade_plans.push({...p,id:request.legacy_trade_id,currency:'USD'});assert.equal((await api.post(request)).status,422);
});
test('The new source default works without Alpha credentials; explicit Alpha is blocked before analysis',async()=>{
 const h=uiHarness();assert.equal(h.els.rvSource.value,'stored');h.els.rvSymbol.value='VOW3.XETRA';h.els.rvCompany.value='Volkswagen';h.els.rvSource.value='alphavantage';h.els.rvQuoteSymbol.value='VOW3.DEX';h.els.rvQuoteConfirmed.checked=true;await h.controller.run();
 assert.deepEqual(h.calls.map(c=>c.body.action),['capabilities']);assert.match(h.els.rvStatus.textContent,/nicht eingerichtet/);assert.equal(h.els.rvSource.value,'alphavantage');assert.equal(h.api.requests.length,0);
 h.els.rvUseStored.click();assert.equal(h.els.rvSource.value,'stored');await h.controller.run();assert.equal(h.controller.getState().current.analysis,null);assert.equal(h.controller.getState().current.price,null);assert.equal(h.api.requests.length,0);
});
test('Configured provider capabilities expose key presence without disclosing secrets',async()=>{
 const api=apiHarness({env:{ALPHAVANTAGE_API_KEY:'PRIVATE',EODHD_API_TOKEN:'HIDDEN'}}),r=await api.post({action:'capabilities'});assert.equal(r.body.alpha_configured,true);assert.equal(r.body.eodhd_configured,true);assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE|HIDDEN/);
});
test('Holding writes require positive actual inputs and use the authenticated owner',async()=>{
 const a=asset(),api=apiHarness({tables:{investment_assets:[a]}}),body={action:'save_holding',asset_id:a.id,request_id:crypto.randomUUID(),manual_start:true,user_id:bob,quantity:4,average_entry_price:90,direction:'Long',instrument_type:'Aktie'};
 for(const patch of [{quantity:0},{average_entry_price:0},{direction:'Neutral'},{instrument_type:'Knock-out'},{manual_start:false}])assert.ok((await api.post({...body,...patch})).status>=400);assert.equal(api.rpcs.length,0);
 assert.equal((await api.post(body)).status,200);const r=api.rpcs.find(r=>r.name==='save_investment_holding');assert.equal(r.p.p_user_id,alice);assert.equal(r.p.p_quantity,4);assert.equal(r.p.p_entry,90);
 const foreign=apiHarness({tables:{investment_assets:[{...a,user_id:bob}]}});assert.equal((await foreign.post(body)).status,404);assert.equal(foreign.rpcs.length,0);
});
test('The actual holding form sends absolute units, keeps its request id after failure and guards double submission',async()=>{
 const a=asset();let release,entered,attempt=0;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r),api=apiHarness({tables:{investment_assets:[a]},rpcImpl:async name=>{if(name==='save_depot_position'){attempt++;if(attempt===1){entered();await gate;return {error:{message:'retry'}};}return {data:{id:crypto.randomUUID(),asset_id:a.id,asset:a,saved:true}};}}}),h=uiHarness({api});
 await h.controller.openAsset(a);await h.controller.holdingEditor.open();h.els.rvHoldingQuantity.value='7';h.els.rvHoldingEntry.value='99';const pending=h.controller.holdingEditor.save();await ready;await h.controller.holdingEditor.save();assert.equal(attempt,1);release();await pending;const first=api.rpcs.find(r=>r.name==='save_depot_position').p;assert.equal(h.els.rvHoldingSave.disabled,false);
 await h.controller.holdingEditor.save();const second=api.rpcs.filter(r=>r.name==='save_depot_position')[1].p;assert.equal(first.p_request_id,second.p_request_id);assert.equal(second.p_quantity,7);assert.equal(second.p_entry,99);assert.equal(h.els.rvHoldingPanel.hidden,true);assert.equal(api.requests.length,0);
});
test('A late holdings response cannot repopulate private inputs after logout',async()=>{
 let release,entered;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r),p={...vw(),status:'Position offen',quantity:12345},api=apiHarness({tables:{trade_plans:[p]}});await api.post({action:'sync_portfolio'});const h=uiHarness({api,beforeInvoke:async b=>{if(b.action==='get_holdings'){entered();await gate;}}});await h.controller.openAsset(api.db.investment_assets[0]);const pending=h.controller.holdingEditor.open();await ready;h.setOwner(null);h.emit('investition:auth-changed');release();await pending;
 assert.equal(h.els.rvHoldingPanel.hidden,true);assert.equal(h.els.rvHoldingQuantity.value,'');assert.equal(h.els.rvHoldingEntry.value,'');assert.doesNotMatch(h.els.ivLegacyAssets.innerHTML,/Volkswagen/);assert.equal(h.els.rvHoldingSave.disabled,false);
});
test('A failed holdings read blocks writes until the actual current positions have been loaded',async()=>{
 const a=asset(),api=apiHarness({tables:{investment_assets:[a]}}),h=uiHarness({api,beforeInvoke:b=>{if(b.action==='get_holdings')throw Error('Depot nicht erreichbar');}});await h.controller.openAsset(a);await h.controller.holdingEditor.open();h.els.rvHoldingQuantity.value='10';h.els.rvHoldingEntry.value='90';await h.controller.holdingEditor.save();assert.equal(h.els.rvHoldingSave.disabled,true);assert.equal(api.rpcs.length,0);assert.match(h.els.rvHoldingStatus.textContent,/nicht erreichbar/);
});
test('An uncertain failed save keeps the same request reference even if inputs are edited before retry',async()=>{
 const a=asset(),api=apiHarness({tables:{investment_assets:[a]},rpcImpl:name=>name==='save_depot_position'?{error:{message:'Unknown delivery outcome'}}:undefined}),h=uiHarness({api});await h.controller.openAsset(a);await h.controller.holdingEditor.open();h.els.rvHoldingQuantity.value='7';h.els.rvHoldingEntry.value='90';await h.controller.holdingEditor.save();h.els.rvHoldingQuantity.value='8';await h.controller.holdingEditor.save();const writes=api.rpcs.filter(r=>r.name==='save_depot_position');assert.equal(writes.length,2);assert.equal(writes[0].p.p_request_id,writes[1].p.p_request_id);
});
test('Explicit configured Alpha uses only that provider and preserves its fetch failure',async()=>{
 const api=apiHarness({env:{ALPHAVANTAGE_API_KEY:'PRIVATE'},fetchImpl:async()=>new Response('{}',{status:429})}),h=uiHarness({api});h.els.rvSymbol.value='VOW3.XETRA';h.els.rvSource.value='alphavantage';h.els.rvQuoteSymbol.value='VOW3.DEX';h.els.rvQuoteConfirmed.checked=true;await h.controller.run();assert.equal(api.requests.length,1);assert.equal(new URL(api.requests[0][0]).hostname,'www.alphavantage.co');assert.equal(h.controller.getState().current.attempt.status,'failed');assert.equal(h.els.rvSource.value,'alphavantage');assert.equal(api.rpcs.some(r=>r.name==='reserve_hybrid_eodhd_calls'),false);
});
test('Older navigation calls and news analysis links reach the new security page after the old callback completes',async()=>{
 const api=apiHarness({tables:{trade_plans:[vw()]}}),h=uiHarness({api,decorateWindow:w=>{w.InvestitionNavigation={showPage:name=>w.oldPage=name};w.InvestitionDashboard.openAnalysisBySymbol=()=>({ok:false});}});await h.controller.loadAssets();h.window.InvestitionNavigation.showPage('analytics');assert.equal(h.controller.getState().route,'portfolio');
 const r=h.window.InvestitionDashboard.openAnalysisBySymbol('XETR:VOW3');assert.equal(r.ok,true);h.window.oldPage='trading';await tick();assert.equal(h.controller.getState().route,'detail');assert.equal(h.controller.getState().selected.symbol,'VOW3.XETRA');assert.equal(api.requests.length,0);
});
