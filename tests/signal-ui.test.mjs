import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildSignalAnalysis} from '../supabase/functions/_shared/signal-engine.mjs';

class Element {
  constructor(id) {this.id=id;this.value='';this.checked=false;this.hidden=true;this.innerHTML='';this.textContent='';this.dataset={};this.events={};this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
  addEventListener(name,fn){(this.events[name] ||= []).push(fn);}
  async trigger(name,event={}){for(const fn of this.events[name] || [])await fn({preventDefault(){},target:this,...event});}
  setAttribute(){} querySelectorAll(selector){
    if(this.childrenHtml!==this.innerHTML){this.childrenHtml=this.innerHTML;this.children=[...this.innerHTML.matchAll(/<button([^>]*)>/g)].map(match=>{const element=new Element('dynamic');for(const attr of match[1].matchAll(/data-([\w-]+)="([^"]*)"/g)){const key=attr[1].replace(/-([a-z])/g,(_m,c)=>c.toUpperCase());element.dataset[key]=attr[2];}return element;});}
    const data=selector.match(/^\[data-([\w-]+)\]$/)?.[1]?.replace(/-([a-z])/g,(_m,c)=>c.toUpperCase());return data?this.children.filter(element=>data in element.dataset):[];
  } focus(){}
}
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
const fakeWindow=new EventTarget();fakeWindow.InvestitionDashboard={getSession:()=>null,getSupabase:()=>null,getSelectedTrade:()=>({marketSymbol:'SAP.XETRA',currency:'EUR',name:'SAP'})};
fakeWindow.location={search:'?signal_trigger=11111111-1111-4111-8111-111111111111'};
globalThis.window=fakeWindow;globalThis.document={hidden:false,getElementById:id=>elements[id]};
elements.ssDays.value='20';elements.ssChartDirection.value='none';elements.ssCurrency.value='USD';
await import('../signal-simulation.js');

test('Offline UI demo renders methods, scenarios and correctly labelled synthetic values',async()=>{
  await elements.ssDemo.trigger('click');
  assert.equal(elements.ssResults.hidden,false);assert.match(elements.ssStatus.textContent,/Synthetische/);
  assert.match(elements.ssMetrics.innerHTML,/SYNTHETISCHE DEMONSTRATION/);assert.match(elements.ssChart.innerHTML,/<svg/);
  assert.match(elements.ssMethods.innerHTML,/RSI 14/);assert.match(elements.ssSetups.innerHTML,/Stop/);assert.match(elements.ssSimulationInfo.textContent,/Seed/);
  assert.match(elements.ssScenarios.innerHTML,/P25/);assert.match(elements.ssSources.innerHTML,/Keine passenden/);
});
test('UI chart switch draws selected long thresholds',async()=>{
  elements.ssChartDirection.value='long';await elements.ssChartDirection.trigger('change');assert.match(elements.ssChart.innerHTML,/Einstieg/);assert.match(elements.ssChart.innerHTML,/Stop/);
});
test('Selected existing stock is copied without modifying the trading API',async()=>{
  await elements.ssSelected.trigger('click');assert.equal(elements.ssSymbol.value,'SAP.XETRA');assert.equal(elements.ssCurrency.value,'EUR');assert.equal(elements.ssCompany.value,'SAP');
});
test('Authentication change clears results and selected trigger without starting AI',()=>{
  window.dispatchEvent(new CustomEvent('investition:auth-changed'));
  assert.equal(elements.ssResults.hidden,true);assert.match(elements.ssOrigin.textContent,/Keine Meldung/);
  assert.equal(elements.ssAutoFeed,undefined);
});
test('KO selection requires underlying currency rather than copying product currency',async()=>{
  const original=window.InvestitionDashboard.getSelectedTrade;
  window.InvestitionDashboard.getSelectedTrade=()=>({marketSymbol:'NVDA.US',currency:'EUR',name:'Nvidia KO',type:'Knock-out'});
  await elements.ssSelected.trigger('click');assert.equal(elements.ssCurrency.value,'');assert.match(elements.ssStatus.textContent,/Produktwährung/);
  window.InvestitionDashboard.getSelectedTrade=original;
});
test('Real navigation function selects signals and hides every previous page',()=> {
  const script=readFileSync(new URL('../news.js',import.meta.url),'utf8');
  const body=script.slice(script.indexOf('  function showPage(name) {'),script.indexOf('  function pageFromHash() {'));
  const els={tradingPage:elements.tradingPage,decisionPage:elements.decisionPage,analyticsPage:elements.analyticsPage,newsPage:elements.newsPage,eventAnalysisPage:elements.eventAnalysisPage,signalSimulationPage:elements.signalSimulationPage,navTrading:elements.navTradingBtn,navDecision:elements.navDecisionBtn,navAnalytics:elements.navAnalyticsBtn,navNews:elements.navNewsBtn,navEventAnalysis:elements.navEventAnalysisBtn,navSignalSimulation:elements.navSignalSimulationBtn};
  let url;const showPage=new Function('els','window','history','renderList',body+'\nreturn showPage;')(els,fakeWindow,{replaceState:(_a,_b,value)=>url=value},()=>{});
  showPage('signals');assert.equal(url,'#signals');assert.equal(els.signalSimulationPage.hidden,false);
  for (const k of ['tradingPage','decisionPage','analyticsPage','newsPage','eventAnalysisPage']) assert.equal(els[k].hidden,true);
  showPage('events');assert.equal(els.signalSimulationPage.hidden,true);assert.equal(els.eventAnalysisPage.hidden,false);
});
test('HTML has unique IDs and every module DOM reference resolves',()=> {
  const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
  const code=readFileSync(new URL('../signal-simulation.js',import.meta.url),'utf8');
  for (const match of code.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(match[1]),`Missing ${match[1]}`);
});
test('Previous function, schema and UI logic bytes remain identical to V30.1.1',()=> {
  const hashes=JSON.parse(readFileSync(new URL('./v31-baseline-hashes.json',import.meta.url),'utf8'));
  for(const [path,expected] of Object.entries(hashes)){
    const actual=createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex');assert.equal(actual,expected,path);
  }
});
test('New schema and deploy workflow are separate and restricted to V31',()=> {
  const sql=readFileSync(new URL('../setup-v31-signal-simulation.sql',import.meta.url),'utf8');
  assert.doesNotMatch(sql,/cron\.schedule|update public\.market_news|alter table public\.(trade_plans|depot_positions)/);
  assert.match(sql,/using \(user_id = auth.uid\(\)\)/);assert.match(sql,/where signal_analysis_usage.runs < 20/);assert.match(sql,/from public,anon,authenticated/);
  const deploy=readFileSync(new URL('../.github/workflows/deploy-signal-simulation.yml',import.meta.url),'utf8');
  assert.equal([...deploy.matchAll(/supabase functions deploy /g)].length,2);assert.match(deploy,/deploy analyze-signal-path/);assert.match(deploy,/deploy send-news-alerts/);assert.match(deploy,/node-version: '24'/);
});

async function displayServerAnalysis(analysis) {
  const originalSession=window.InvestitionDashboard.getSession,originalSupabase=window.InvestitionDashboard.getSupabase;
  window.InvestitionDashboard.getSession=()=>({user:{id:'ui-user'}});
  window.InvestitionDashboard.getSupabase=()=>({functions:{invoke:async()=>({data:{ok:true,analysis}})},from:()=>{const chain={select:()=>chain,eq:()=>chain,not:()=>chain,order:()=>chain,limit:async()=>({data:[],error:null})};return chain;}});
  elements.ssSymbol.value='NVDA.US';elements.ssCurrency.value='USD';elements.ssUseAi.checked=true;
  try {await elements.ssForm.trigger('submit');await new Promise(resolve=>setImmediate(resolve));}
  finally {window.InvestitionDashboard.getSession=originalSession;window.InvestitionDashboard.getSupabase=originalSupabase;}
}
function serverAnalysis() {
  const bars=Array.from({length:220},(_,i)=>{const date=new Date();date.setUTCDate(date.getUTCDate()-220+i);const close=100*Math.exp(.001*i+.01*Math.sin(i));return{date:date.toISOString().slice(0,10),open:close,high:close*1.02,low:close*.98,close,volume:1e6};});
  return buildSignalAnalysis({symbol:'NVDA.US',currency:'USD',rawBars:bars,days:20,provider:'EODHD EOD'});
}
test('Actual UI identifies Gemini and its model, with compatible display of older AI results',async()=> {
  const analysis=serverAnalysis();analysis.narrative={mode:'ai',summary:'News geprüft',bias:'neutral',confidence:30,evidence:[],risks:[],watchpoints:[]};
  analysis.ai={provider:'gemini',model:'gemini-3.5-flash-lite'};
  await displayServerAnalysis(analysis);
  assert.match(elements.ssStatus.textContent,/Gemini \+ Chartberechnung/);assert.match(elements.ssMetrics.innerHTML,/Gemini-Auswertung aktiv/);
  assert.match(elements.ssNarrative.innerHTML,/gemini-3.5-flash-lite/);
  delete analysis.ai;await displayServerAnalysis(analysis);
  assert.match(elements.ssStatus.textContent,/KI \+ Chartberechnung/);assert.doesNotMatch(elements.ssNarrative.innerHTML,/Modell:/);
});
test('Actual UI shows quota fallback warning without claiming active Gemini',async()=> {
  const analysis=serverAnalysis();analysis.ai=null;analysis.warnings=['Gemini-Kontingent oder Anfragelimit erreicht.'];
  await displayServerAnalysis(analysis);
  assert.match(elements.ssStatus.textContent,/KI nicht aktiv/);assert.match(elements.ssQuality.innerHTML,/Gemini-Kontingent/);
  assert.doesNotMatch(elements.ssMetrics.innerHTML,/Gemini-Auswertung aktiv/);assert.match(elements.ssNarrative.innerHTML,/Chartregeln/);
});

test('Telegram link, auth, navigation, feed updates and trigger selection prepare data without invoking AI',async()=> {
  let invocations=0,sent;
  const row={id:'11111111-1111-4111-8111-111111111111',news_id:'22222222-2222-4222-8222-222222222222',news_title:'Nvidia news <script>',news_published_at:new Date().toISOString(),symbols:['NVDA.US'],state:'pending',reason:'Bestehender Portfolio-News-Alarm'};
  const originalSession=window.InvestitionDashboard.getSession,originalSupabase=window.InvestitionDashboard.getSupabase;
  window.InvestitionDashboard.getSession=()=>({user:{id:'ui-user'}});
  window.InvestitionDashboard.getSupabase=()=>({functions:{invoke:async(_name,{body})=>{invocations++;sent=body;return{data:{ok:true,analysis:serverAnalysis()}};}},from:table=>{const chain={select:()=>chain,eq:()=>chain,not:()=>chain,order:()=>chain,limit:async()=>({data:table==='signal_news_triggers'?[row]:[],error:null}),maybeSingle:async()=>({data:row,error:null})};return chain;}});
  elements.signalSimulationPage.hidden=false;
  try {
    window.dispatchEvent(new CustomEvent('investition:auth-changed'));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(invocations,0);assert.equal(elements.ssSymbol.value,'NVDA.US');assert.equal(elements.ssCurrency.value,'');
    assert.match(elements.ssOrigin.innerHTML,/TRIGGER KI/);assert.match(elements.ssOrigin.innerHTML,/&lt;script&gt;/);
    window.dispatchEvent(new CustomEvent('investition:signal-simulation-visible'));window.dispatchEvent(new CustomEvent('investition:news-changed'));
    await new Promise(resolve=>setImmediate(resolve));
    await elements.ssLoadTriggers.trigger('click');
    await elements.ssTriggerList.querySelectorAll('[data-ss-trigger]')[0].trigger('click');
    assert.equal(invocations,0);
    elements.ssCurrency.value='USD';elements.ssUseAi.checked=true;
    await elements.ssForm.trigger('submit');
    assert.equal(invocations,1);assert.equal(sent.manual_start,true);assert.equal(sent.trigger_id,row.id);
    window.dispatchEvent(new CustomEvent('investition:news-changed'));await new Promise(resolve=>setImmediate(resolve));assert.equal(invocations,1);
  }finally{elements.signalSimulationPage.hidden=true;window.InvestitionDashboard.getSession=originalSession;window.InvestitionDashboard.getSupabase=originalSupabase;window.dispatchEvent(new CustomEvent('investition:auth-changed'));}
});

test('Double manual submission cannot spend two AI calls while an analysis is running',async()=> {
  let finish,invocations=0;
  const originalSession=window.InvestitionDashboard.getSession,originalSupabase=window.InvestitionDashboard.getSupabase;
  window.InvestitionDashboard.getSession=()=>({user:{id:'ui-user'}});
  window.InvestitionDashboard.getSupabase=()=>({functions:{invoke:()=>{invocations++;return new Promise(resolve=>{finish=()=>resolve({data:{ok:true,analysis:serverAnalysis()}});});}},from:()=>{const chain={select:()=>chain,eq:()=>chain,not:()=>chain,order:()=>chain,limit:async()=>({data:[],error:null})};return chain;}});
  elements.ssSymbol.value='NVDA.US';elements.ssCurrency.value='USD';elements.ssUseAi.checked=true;
  try{const first=elements.ssForm.trigger('submit');await elements.ssForm.trigger('submit');assert.equal(invocations,1);finish();await first;}
  finally{window.InvestitionDashboard.getSession=originalSession;window.InvestitionDashboard.getSupabase=originalSupabase;}
});
