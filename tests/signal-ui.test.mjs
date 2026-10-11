import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

class Element {
  constructor(id) {this.id=id;this.value='';this.checked=false;this.hidden=true;this.innerHTML='';this.textContent='';this.dataset={};this.events={};this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
  addEventListener(name,fn){(this.events[name] ||= []).push(fn);}
  async trigger(name,event={}){for(const fn of this.events[name] || [])await fn({preventDefault(){},target:this,...event});}
  setAttribute(){} querySelectorAll(){return [];} focus(){}
}
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
const fakeWindow=new EventTarget();fakeWindow.InvestitionDashboard={getSession:()=>null,getSupabase:()=>null,getSelectedTrade:()=>({marketSymbol:'SAP.XETRA',currency:'EUR',name:'SAP'})};
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
test('Authentication change clears results and disables feed automation',()=>{
  elements.ssAutoFeed.checked=true;window.dispatchEvent(new CustomEvent('investition:auth-changed'));
  assert.equal(elements.ssResults.hidden,true);assert.equal(elements.ssAutoFeed.checked,false);
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
  assert.equal([...deploy.matchAll(/supabase functions deploy /g)].length,1);assert.match(deploy,/deploy analyze-signal-path/);assert.match(deploy,/node-version: '24'/);
});
