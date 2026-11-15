import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCompactUI} from '../compact-ui.js';
import {buildSignalAnalysis} from '../supabase/functions/_shared/signal-engine.mjs';
import {buildDeepAnalysis,validateDeepInput} from '../supabase/functions/_shared/deep-engine.mjs';
import {makeBars,now} from './fixtures/independent-market.mjs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const signal=()=>buildSignalAnalysis({symbol:'SND.XETRA',currency:'EUR',rawBars:makeBars(),days:20,provider:'CSV',now});
const deep=()=>buildDeepAnalysis(validateDeepInput({symbol:'SND.XETRA',currency:'EUR',days:20,lookback:252,use_ai:false,manual_start:true}),makeBars(),{provider:'CSV',now});

// This adapter exercises the real controller and engine results without a browser or external API.
function harness({owner=null,data={},deferred=false,decision=false}={}) {
  const queries=[],pending=[],observed=[],listeners={};let invokes=0,fetches=0;
  const window=new EventTarget();
  const document={hidden:false,documentElement:{dataset:{}},addEventListener(name,fn){(listeners[name]||=[]).push(fn);},
    fire(name,target){for(const fn of listeners[name]||[])fn({target});}};
  class El {
    constructor(id='',dataset={}){this.id=id;this.dataset=dataset;this.attributes={};this.hidden=false;this.open=false;this.disabled=false;this.value='';this.textContent='';this.clientWidth=320;this.scrolled=0;this.clicked=0;this._html='';}
    set innerHTML(v){this._html=v;this.chart=v.includes('data-compact-chart')?new El('chart'):null;}
    get innerHTML(){return this._html;}
    querySelector(selector){return selector==='[data-compact-chart]'?this.chart:null;}
    setAttribute(k,v){this.attributes[k]=String(v);}removeAttribute(k){delete this.attributes[k];}
    getAttribute(k){return this.attributes[k]??null;}
    closest(selector){return selector==='button'?this:this.inNav&&selector==='#compactMainNav'?this:null;}
    matches(selector){return selector==='[data-compact-direction]'&&this.dataset.compactDirection!==undefined;}
    scrollIntoView(){this.scrolled++;}
    dispatchEvent(event){document.fire(event.type,this);return true;}
    click(){this.clicked++;this.onClick?.();document.fire('click',this);}
  }
  const els=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new El(m[1])]));
  const tabs=['signal','deep','paper'].map(name=>new El('',{compactTab:name}));
  const docks=['decision','signal','deep'].map(name=>new El('',{compactPage:name}));
  document.getElementById=id=>els[id]||null;
  document.querySelectorAll=selector=>selector==='[data-compact-tab]'?tabs:selector==='[data-compact-page]'?docks:[];
  els.decisionPage.hidden=!decision;els.signalSimulationPage.hidden=decision;
  els.navDecisionBtn.onClick=()=>{els.decisionPage.hidden=false;els.signalSimulationPage.hidden=true;window.dispatchEvent(new Event('investition:decision-visible'));};
  els.navSignalSimulationBtn.onClick=()=>{els.decisionPage.hidden=true;els.signalSimulationPage.hidden=false;window.dispatchEvent(new Event('investition:signal-simulation-visible'));};
  window.ResizeObserver=class {constructor(fn){this.fn=fn;this.disconnected=false;observed.push(this);}observe(target){this.target=target;}disconnect(){this.disconnected=true;}};
  let activeOwner=owner,currentNow=now;
  const sb={functions:{invoke(){invokes++;throw Error('No automatic analysis allowed');}},from(table){
    const calls=[],q={select(...a){calls.push(['select',...a]);return q;},eq(...a){calls.push(['eq',...a]);return q;},not(...a){calls.push(['not',...a]);return q;},order(...a){calls.push(['order',...a]);return q;},limit(...a){
      calls.push(['limit',...a]);queries.push({table,calls});const result=data[table]||{data:[]};
      return deferred?new Promise(resolve=>pending.push(()=>resolve(result))):Promise.resolve(result);
    }};return q;
  }};
  window.fetch=()=>{fetches++;throw Error('No provider request allowed');};
  window.InvestitionDashboard={getSession:()=>activeOwner?{user:{id:activeOwner}}:null,getSupabase:()=>sb};
  const api=createCompactUI({window,document,now:()=>currentNow});
  return {api,els,document,window,tabs,docks,queries,pending,observed,
    button:dataset=>new El('',dataset),setOwner:value=>activeOwner=value,setNow:value=>currentNow=value,
    emit:(name,detail)=>window.dispatchEvent(new CustomEvent(name,{detail})),
    get invocations(){return invokes;},get fetches(){return fetches;}};
}
function row(a,id='saved',owner='alice'){return {id,user_id:owner,symbol:a.symbol,currency:a.currency,created_at:a.created_at,raw_result:a};}

test('Compact navigation uses existing page buttons, keeps all three modules accessible and prepares without requests',()=>{
  const h=harness();h.api.navigate('deep');assert.equal(h.els.navSignalSimulationBtn.clicked,1);
  assert.equal(h.document.documentElement.dataset.analysisTab,'deep');assert.equal(h.els.deepAnalysisModule.hidden,false);assert.equal(h.els.signalCompactView.hidden,true);
  assert.equal(h.docks[2].getAttribute('aria-current'),'page');
  h.tabs[2].click();assert.equal(h.els.paperPortfolioModule.hidden,false);assert.equal(h.els.deepAnalysisModule.hidden,true);
  h.els.compactMenuBtn.click();assert.equal(h.els.compactMenuBtn.getAttribute('aria-expanded'),'true');assert.equal(h.els.compactMainNav.scrolled,1);
  h.button({compactPrepare:'signal'}).click();assert.equal(h.els.ssInputPanel.open,true);assert.equal(h.els.ssForm.scrolled,1);assert.equal(h.els.compactMenuBtn.getAttribute('aria-expanded'),'false');
  h.api.navigate('decision');assert.equal(h.els.navDecisionBtn.clicked,1);assert.equal(h.docks[0].getAttribute('aria-current'),'page');assert.equal(h.queries.length,0);
  assert.equal(h.invocations,0);assert.equal(h.fetches,0);
});
test('Actual signal engine result renders chart and thresholds; both direction controls remain synchronized',()=>{
  const h=harness(),a=signal(),before=JSON.stringify(a);h.els.ssInputPanel.open=true;
  h.emit('investition:analysis-rendered',{scope:'signal',analysis:a});
  assert.match(h.els.ssCompactReport.innerHTML,/Auf einen Blick/);assert.match(h.els.ssCompactReport.innerHTML,/SND.XETRA/);assert.match(h.els.ssCompactReport.chart.innerHTML,/<svg/);assert.equal(h.els.ssInputPanel.open,false);
  const select=h.button({compactDirection:'',scope:'signal'});select.value='short';select.dispatchEvent(new Event('change'));
  assert.match(h.els.ssCompactReport.innerHTML,/Kursleiter · Short/);assert.equal(h.els.ssChartDirection.value,'short');
  h.els.ssChartDirection.value='long';h.els.ssChartDirection.dispatchEvent(new Event('change'));assert.match(h.els.ssCompactReport.innerHTML,/Kursleiter · Long/);
  assert.equal(JSON.stringify(a),before);assert.equal(h.invocations,0);assert.equal(h.queries.length,0);
});
test('Deep scenario selection renders its real calculated band and resets when another report opens',()=>{
  const h=harness(),a=deep();h.emit('investition:analysis-rendered',{scope:'deep',analysis:a});
  const alt=a.scenarios.find(s=>s.id!=='base');h.button({compactScenario:alt.id}).click();assert.equal(h.els.daScenario.value,alt.id);
  assert.ok(h.els.daCompactReport.chart.innerHTML.includes(alt.name));assert.match(h.els.daCompactReport.innerHTML,new RegExp('data-compact-scenario="'+alt.id+'" data-scope="deep" aria-pressed="true"'));
  h.emit('investition:analysis-rendered',{scope:'deep',analysis:a});assert.match(h.els.daCompactReport.innerHTML,/data-compact-scenario="base" data-scope="deep" aria-pressed="true"/);
  h.emit('investition:analysis-tab',{tab:'deep'});assert.equal(h.els.deepAnalysisModule.hidden,false);assert.equal(h.invocations,0);
});
test('Real status text is announced and errors keep the previous report visibly identified',()=>{
  const h=harness();h.emit('investition:analysis-rendered',{scope:'deep',analysis:deep()});const original=h.els.daCompactReport.innerHTML;
  h.emit('investition:analysis-status',{scope:'deep',message:'Öffentliche Chartquelle hat ihr eigenes Limit erreicht.',type:'bad'});
  assert.equal(h.els.daCompactStatus.getAttribute('role'),'alert');assert.match(h.els.daCompactStatus.textContent,/eigenes Limit/);assert.match(h.els.daCompactStatus.textContent,/ursprünglichen Datenstand/);
  assert.equal(h.els.daInputPanel.open,true);assert.equal(h.els.daCompactReport.innerHTML,original);assert.ok(h.els.daCompactStatus.scrolled>0);
  h.emit('investition:analysis-status',{scope:'deep',message:'Anfrage gesendet. Interner Fortschritt nicht verfügbar.',type:'warn'});assert.equal(h.els.daCompactStatus.getAttribute('role'),'status');assert.doesNotMatch(h.els.daCompactStatus.textContent,/\d+\s*%/);
});
test('Cockpit queries are owner-scoped and reject foreign owners and mismatched report identities',async()=>{
  const a=signal(),d=deep(),h=harness({owner:'alice',data:{signal_simulations:{data:[row(a),row({...a,symbol:'PRIVATE.US'},'foreign','bob'),{...row(a,'bad'),symbol:'OTHER.US'}]},deep_analyses:{data:[row(d,'deep'),{...row(d,'fx'),currency:'USD'}]},signal_news_triggers:{data:[{id:'t',user_id:'alice',state:'pending',delivered_at:'2026-11-07',news_title:'Eigene Meldung',symbols:['SND.XETRA']},{id:'foreign',user_id:'bob',state:'pending',delivered_at:'2026-11-07',news_title:'PRIVAT',symbols:[]}]}}});
  await h.api.loadHome();assert.equal(h.queries.length,3);for(const q of h.queries)assert.ok(q.calls.some(c=>c[0]==='eq'&&c[1]==='user_id'&&c[2]==='alice'));
  assert.equal((h.els.compactHomeCards.innerHTML.match(/data-compact-open=/g)||[]).length,2);assert.doesNotMatch(h.els.compactHomeCards.innerHTML,/PRIVATE|OTHER/);assert.match(h.els.compactHomeTriggers.innerHTML,/Eigene Meldung/);assert.doesNotMatch(h.els.compactHomeTriggers.innerHTML,/PRIVAT/);
  let opened,trigger;h.window.addEventListener('investition:open-analysis',e=>opened=e.detail);h.window.addEventListener('investition:prepare-trigger',e=>trigger=e.detail);
  h.button({compactOpen:'0'}).click();assert.equal(opened.analysis.symbol,a.symbol);assert.equal(opened.analysis.id,'saved');
  h.button({compactTrigger:'0'}).click();assert.equal(trigger.id,'t');assert.equal(h.els.ssInputPanel.open,true);assert.equal(h.invocations,0);assert.equal(h.fetches,0);
});
test('Cockpit tolerates one unavailable source and compares only older own reports',async()=>{
  const a=signal(),old={...signal(),created_at:'2026-11-07T09:00Z'},h=harness({owner:'alice',data:{signal_simulations:{data:[row(a),row(old,'old')]},deep_analyses:{error:{message:'missing table'}}}});
  h.api.render('signal',a);await h.api.loadHome();assert.match(h.els.compactHomeStatus.textContent,/nicht erreichbar/);assert.match(h.els.ssCompactReport.innerHTML,/Gegenüber 7\.11\.2026/);assert.match(h.els.compactHomeCards.innerHTML,/SND.XETRA/);
});
test('Cockpit loading is deduplicated and cached, with explicit refresh bypassing the 60-second cache',async()=>{
  const h=harness({owner:'alice',deferred:true});const first=h.api.loadHome();await h.api.loadHome(true);assert.equal(h.queries.length,3);assert.equal(h.els.compactHomeLoad.disabled,true);
  h.pending.splice(0).forEach(done=>done());await first;await h.api.loadHome();assert.equal(h.queries.length,3);assert.equal(h.els.compactHomeLoad.disabled,false);
  const second=h.api.loadHome(true);assert.equal(h.queries.length,6);h.pending.splice(0).forEach(done=>done());await second;assert.equal(h.invocations,0);
});
test('Changing sessions clears private reports, triggers, status and observers and discards late data',async()=>{
  const a=signal(),h=harness({owner:'alice',deferred:true,data:{signal_simulations:{data:[row(a)]},signal_news_triggers:{data:[{id:'t',user_id:'alice',state:'pending',delivered_at:'2026-11-07',news_title:'GEHEIM'}]}}});
  h.emit('investition:analysis-rendered',{scope:'signal',analysis:a});h.window.InvestitionCompactReports={signal:a};
  h.emit('investition:analysis-status',{scope:'signal',message:'GEHEIM',type:'bad'});const loading=h.api.loadHome();
  h.setOwner('bob');h.emit('investition:auth-changed');h.pending.splice(0).forEach(done=>done());await loading;
  assert.equal(h.els.ssCompactReport.innerHTML,'');assert.doesNotMatch(h.els.compactHomeCards.innerHTML,/SND.XETRA/);assert.doesNotMatch(h.els.compactHomeTriggers.innerHTML,/GEHEIM/);assert.doesNotMatch(h.els.ssCompactStatus.textContent,/GEHEIM/);assert.equal(h.els.ssCompactStatus.getAttribute('role'),'status');
  assert.deepEqual(h.window.InvestitionCompactReports,{});assert.ok(h.observed.every(o=>o.disconnected));assert.equal(h.els.compactHomeLoad.disabled,false);
});
test('Visibility and resizing refresh presentation only; saved age is recalculated against the actual date',()=>{
  const h=harness(),a=signal();h.api.render('signal',a);const observer=h.observed.at(-1);observer.target.clientWidth=430;observer.fn();assert.match(h.els.ssCompactReport.chart.innerHTML,/viewBox="0 0 430 250"/);
  h.setNow(new Date('2026-11-15T09:00Z'));h.document.fire('visibilitychange',h.document);assert.match(h.els.ssCompactReport.innerHTML,/Aktuelle Schwellen gesperrt/);assert.doesNotMatch(h.els.ssCompactReport.chart.innerHTML,/<svg/);assert.equal(h.queries.length,0);assert.equal(h.invocations,0);
});
test('Synthetic demos remain clearly marked and do not populate real cockpit reports',()=>{
  const h=harness(),a=signal();a.symbol='DEMO.US';h.api.render('signal',a);assert.match(h.els.ssCompactReport.innerHTML,/SYNTHETISCHE DEMO/);assert.doesNotMatch(h.els.compactHomeCards.innerHTML,/DEMO.US/);
});
test('Mobile layout and release reference actual assets while retaining the complete original report and form IDs',()=>{
  const css=readFileSync(new URL('../compact-ui.css',import.meta.url),'utf8'),version=JSON.parse(readFileSync(new URL('../release.json',import.meta.url),'utf8')).version;
  for(const id of ['ssCompactStatus','ssInputPanel','ssCompactReport','daCompactStatus','daInputPanel','daCompactReport','compactMainNav','compactHomeCards','compactMenuBtn'])assert.ok(html.includes('id="'+id+'"'));
  assert.match(html,/<html lang="de" data-analysis-tab="signal">/);assert.match(css,/@media\(max-width:760px\)/);assert.match(css,/safe-area-inset-bottom/);assert.match(css,/font-size:16px!important/);assert.match(css,/min-height:44px/);assert.match(css,/body\{background:#000\}/);
  assert.ok(html.includes('compact-ui.js?v='+version));assert.ok(html.includes('compact-ui.css?v='+version));
  const worker=readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');for(const asset of ['compact-ui.js','compact-ui.css','compact-analysis.mjs'])assert.ok(worker.includes(asset+'?v='+version));
  const code=readFileSync(new URL('../compact-ui.js',import.meta.url),'utf8');assert.doesNotMatch(code,/functions\.invoke|fetch\(|setInterval|setTimeout/);
  const workflow=readFileSync(new URL('../.github/workflows/check-v37-ui.yml',import.meta.url),'utf8');assert.match(workflow,/node --test tests\/\*\.test\.mjs/);assert.doesNotMatch(workflow,/supabase functions deploy|SUPABASE_ACCESS_TOKEN|secrets\./);
});
