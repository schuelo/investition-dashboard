import test from 'node:test';
import assert from 'node:assert/strict';
import {uiHarness} from './fixtures/investment-dom.mjs';
import {apiHarness,alice,bob} from './fixtures/investment-api.mjs';
import {makeBars,now} from './fixtures/independent-market.mjs';
import {createPriceUI} from '../price-ui.mjs';
import {externalChartSymbol,mountExternalChart} from '../external-chart.mjs';
import {createExternalMinis} from '../external-minis.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
const seed=async()=>{const api=apiHarness();await api.post({action:'analyze',manual_start:true,symbol:'SND.XETRA',currency:'EUR',source:'csv',bars:makeBars()});return api;};
function mockDocument(){
 const els={};class El{constructor(tag){this.tagName=tag;this.children=[];this.style={};this.events={};this.dataset={};this.value='';this.checked=false;this.hidden=false;this.clientWidth=320;this.textContent='';this.attributes={};this._html='';}set innerHTML(v){this._html=v;this.children=[];}get innerHTML(){return this._html;}appendChild(el){this.children.push(el);return el;}addEventListener(n,fn){(this.events[n]||=[]).push(fn);}setAttribute(k,v){this.attributes[k]=v;}fire(n,target=this){return Promise.all((this.events[n]||[]).map(fn=>fn({target})));}}
 return {els,createElement:tag=>new El(tag),getElementById:id=>els[id]||=(new El('div'))};
}
test('The real controller renders cached mini graphs in observation and saved search without requesting a quote',async()=>{
 const api=await seed(),h=uiHarness({api});await h.controller.loadAssets();h.controller.navigate('watch');assert.match(h.els.ivAssets.innerHTML,/price-sparkline/);assert.match(h.els.ivValueHero.innerHTML,/Kursindex · Start 100/);assert.match(h.els.rvSavedMatches.innerHTML,/price-sparkline/);assert.equal(api.requests.length,0);assert.ok(h.calls.every(c=>['sync_portfolio','capabilities','get_chart_series'].includes(c.body.action)));
});
test('A stale/blocked report still shows its separate actual historical chart and timestamp',async()=>{
 const api=await seed(),a=api.db.investment_assets[0];for(const r of api.db.investment_reviews){r.snapshot.price_date='2026-01-01';r.snapshot.analysis.quality.blocked=true;}const h=uiHarness({api});h.setNow(new Date('2026-11-16T12:00Z'));await h.controller.openAsset(a);assert.match(h.els.rvPricePlot.innerHTML,/price-line/);assert.match(h.els.rvPriceInfo.textContent,/2026-11-06/);assert.match(h.els.rvResultBody.innerHTML,/Aktuelle Entscheidung offen/);assert.match(h.els.rvChart.innerHTML,/nicht als aktuelle Prognose/);assert.equal(api.requests.length,0);
});
test('Period and scrub controls redraw actual values without a quote or AI request',async()=>{
 const api=await seed(),h=uiHarness({api});await h.controller.openAsset(api.db.investment_assets[0]);const count=h.calls.length;for(const fn of h.els.rvPricePeriods.events.click)fn({target:h.button({pricePeriod:'Max'})});h.els.rvPriceCursor.value='0';await h.els.rvPriceCursor.fire('input');assert.match(h.els.rvPricePlot.innerHTML,/300 gespeicherte Werte/);assert.equal(h.calls.length,count);assert.equal(api.requests.length,0);
});
test('Changing the security identity hides the previous security chart and logout clears its data',async()=>{
 const api=await seed(),h=uiHarness({api});await h.controller.openAsset(api.db.investment_assets[0]);h.els.rvSymbol.value='OTHER.US';await h.els.rvSymbol.fire('input');assert.equal(h.els.rvPricePanel.hidden,true);h.setOwner(null);h.emit('investition:auth-changed');assert.equal(h.els.rvPricePlot.innerHTML,'');assert.deepEqual(h.controller.priceUI.getSeries(),{});
});
test('A delayed chart response cannot restore another account’s cleared history',async()=>{
 let release,entered;const gate=new Promise(r=>release=r),ready=new Promise(r=>entered=r),api=await seed(),h=uiHarness({api,beforeInvoke:async b=>{if(b.action==='get_chart_series'){entered();await gate;}}});const pending=h.controller.openAsset(api.db.investment_assets[0]);await ready;h.setOwner(bob);h.emit('investition:auth-changed');release();await pending;assert.deepEqual(h.controller.priceUI.getSeries(),{});assert.equal(h.els.rvPricePlot.innerHTML,'');
});
test('External symbols retain the confirmed market and never guess the exchange of US aggregate tickers',()=>{
 assert.equal(externalChartSymbol({symbol:'VOW3.XETRA'}),'XETR:VOW3');assert.equal(externalChartSymbol({symbol:'VOW.XETRA'}),'XETR:VOW');assert.equal(externalChartSymbol({symbol:'MSFT.US'}),'');assert.equal(externalChartSymbol({symbol:'UNKNOWN'}),'');
});
test('External chart embeds have explicit visible heights and attribution and contain only the public symbol',()=>{
 const d=mockDocument(),host=d.getElementById('host'),statuses=[];const stop=mountExternalChart({document:d,container:host,symbol:'XETR:VOW3',confirmed:true,onStatus:(...v)=>statuses.push(v)});const shell=host.children[0],target=shell.children[0],script=shell.children[2];assert.equal(shell.style.height,'350px');assert.equal(target.style.height,'320px');assert.match(script.src,/s3\.tradingview\.com/);assert.match(shell.children[1].children[0].textContent,/TradingView/);const config=JSON.parse(script.textContent);assert.deepEqual(config.symbols,[['XETR:VOW3','XETR:VOW3|1D']]);assert.doesNotMatch(script.textContent,/quantity|entry|user_id|api_key|token/);script.onload();assert.match(statuses.at(-1)[0],/mögliche Verzögerung/);script.onerror();assert.equal(statuses.at(-1)[1],true);stop();assert.equal(host.children.length,0);assert.equal(script.onload,null);
});
test('Unconfirmed, script-bearing and ambiguous external chart identifiers are rejected before embedding',()=>{
 const d=mockDocument(),host=d.getElementById('host');for(const [symbol,confirmed] of [['XETR:VOW3',false],['US:MSFT',true],['XETRA:VOW3',true],['XETR:<script>',true]])assert.throws(()=>mountExternalChart({document:d,container:host,symbol,confirmed}));assert.equal(host.children.length,0);
});
test('Automatic external mini charts are capped and removed on disable or account reset',async()=>{
 const d=mockDocument();let owner=alice;const minis=createExternalMinis({document:d,getOwner:()=>owner}),items=Array.from({length:12},(_,i)=>({asset:{symbol:'VOW3.XETRA'},hostId:'m'+i}));minis.update(items,true);await tick();assert.equal(Object.values(d.els).filter(el=>el.children.length).length,8);assert.equal(d.els.m0.children[0].children[0].style.height,'140px');minis.toggle();assert.ok(Object.values(d.els).every(el=>!el.children.length));minis.toggle();minis.update(items,true);owner=bob;await tick();assert.ok(Object.values(d.els).every(el=>!el.children.length));minis.reset();
});
test('Minis prefer a full stored history and no exchange is guessed for an unsupported symbol',async()=>{
 const d=mockDocument(),minis=createExternalMinis({document:d,getOwner:()=>alice});minis.update([{asset:{symbol:'VOW3.XETRA'},hostId:'a',series:{kind:'price_history',points:[1,2]}},{asset:{symbol:'MSFT.US'},hostId:'b'}],true);await tick();assert.equal(Object.keys(d.els).length,0);
});
test('Detailed fallback automatically embeds an exact external listing without storing or analysing the asset',async()=>{
 const d=mockDocument(),asset={symbol:'VOW3.XETRA',currency:'EUR'};const ui=createPriceUI({document:d,window:new EventTarget(),getOwner:()=>alice,getAsset:()=>asset,getVisible:()=>true,getCapabilities:()=>null,invoke:async()=>{throw Error('Unexpected endpoint call');},getInput:()=>({}),now:()=>now});await ui.open();assert.equal(d.els.rvExternalDetails.open,true);assert.equal(d.els.rvExternalHost.children.length,1);ui.clear();assert.equal(d.els.rvExternalHost.children.length,0);
});
test('Refreshing an unsaved external-only chart never implicitly remembers a new security',async()=>{
 const d=mockDocument(),calls=[],ui=createPriceUI({document:d,window:new EventTarget(),getOwner:()=>alice,getAsset:()=>({symbol:'VOW3.XETRA',currency:'EUR'}),getVisible:()=>true,getCapabilities:()=>({features:['price_charts_v393']}),invoke:async b=>{calls.push(b);return {};},getInput:()=>({source:'stored'}),now:()=>now});await ui.refresh();assert.equal(calls.length,0);assert.match(d.els.rvPriceStatus.textContent,/zuerst merken/);
});
test('A slow earlier history read cannot overwrite a newer explicitly refreshed chart',async()=>{
 const d=mockDocument(),a={id:'a',symbol:'VOW3.XETRA',currency:'EUR'},series=value=>({asset_id:'a',symbol:a.symbol,currency:a.currency,kind:'price_history',status:'ready',source:'CSV',price_date:'2026-11-06',points:[{date:'2026-11-05',value},{date:'2026-11-06',value}]}),gate={};gate.ready=new Promise(r=>gate.enter=r);gate.wait=new Promise(r=>gate.release=r);
 const ui=createPriceUI({document:d,window:new EventTarget(),getOwner:()=>alice,getAsset:()=>a,getVisible:()=>true,getCapabilities:()=>({features:['price_charts_v393']}),invoke:async b=>{if(b.action==='get_chart_series'){gate.enter();await gate.wait;return {series:[series(10)]};}return {series:series(20)};},getInput:()=>({symbol:a.symbol,currency:a.currency,source:'stored'}),now:()=>now});const pending=ui.load([a]);await gate.ready;await ui.refresh();gate.release();await pending;assert.equal(ui.getSeries().a.points[0].value,20);assert.match(d.els.rvPricePlot.innerHTML,/20 EUR/);
});
