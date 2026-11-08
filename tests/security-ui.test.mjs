import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSecurityQuery,normalizeCatalogue} from '../supabase/functions/_shared/security-resolver.mjs';
import {securityFieldChanges,SECURITY_TARGETS} from '../supabase/functions/_shared/security-form.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),html=read('index.html');
const candidate={...normalizeCatalogue([{Code:'SND',Exchange:'XETRA',Name:'Schneider Electric SE',Currency:'EUR',ISIN:'FR0000121972',Type:'Common Stock'}])[0],wkn:'860180',verified:true};
class El {
  constructor(value=''){this.value=value;this.checked=false;this.events={};this.classList={add(){},toggle(){}};this.hidden=false;this.innerHTML='';this.textContent='';this.attributes={};}
  addEventListener(type,fn,capture){(this.events[type]||=[]).push({fn,capture});}
  async trigger(type,event={}){for(const {fn} of this.events[type]||[])await fn({preventDefault(){},stopPropagation(){},stopImmediatePropagation(){},target:this,...event});}
  dispatchEvent(event){for(const {fn} of this.events[event.type]||[])fn(event);return true;}
  setAttribute(k,v){this.attributes[k]=v;}
}
function harness(scope='deep',{pause=false,fail=false,resolved=candidate,source='eodhd',oldServer=false}={}) {
  const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new El()]));
  elements.tradeForm.elements=Object.fromEntries([...html.matchAll(/<input[^>]+name="([^"]+)"/g),...html.matchAll(/<select[^>]+name="([^"]+)"/g)].map(m=>[m[1],new El()]));elements.tradeForm.elements.type.value='Aktie';elements.tradeForm.elements.marketSymbol.value='NVDA.US';elements.tradeForm.elements.currency.value='USD';
  elements.daSymbol.value='NVDA.US';elements.daCurrency.value='USD';elements.ppSymbols.value='SND.XETRA';elements.ppCurrency.value='EUR';
  const nodes={};for(const key of ['[data-sec-query]','[data-sec-exchange]','[data-sec-select]','[data-sec-results]','[data-sec-apply]','[data-sec-search]','[data-sec-cancel]','[data-sec-preview]','[data-sec-chart]','[data-sec-chart-block]','[data-sec-chart-dropdown]','[data-sec-chart-custom]','[data-sec-append]','[role=status]'])nodes[key]=new El();nodes['[data-sec-exchange]'].value='XETRA';nodes['[data-sec-select]'].value='0';nodes['[data-sec-append]'].value='replace';
  for(const key of ['[data-sec-source]','[data-sec-currency-label]','[data-sec-currency]','[data-sec-disable-eod-label]','[data-sec-disable-eod]'])nodes[key]=new El();nodes['[data-sec-source]'].value=source;
  const root=new El();root.dataset={securityTarget:scope};root.querySelector=s=>nodes[s];const form=scope==='trade'?elements.tradeForm:new El();root.closest=selector=>selector==='form'?form:null;
  let session={user:{id:'owner'}},release;const calls=[],globalEvents=[];
  const window=new EventTarget();
  const sb={functions:{invoke:async(name,{body})=>{
    calls.push({name,body});if(pause)await new Promise(r=>release=r);
    if(body.action==='capabilities')return oldServer?{data:{ok:true,features:[]}}:{data:{ok:true,features:['independent_market_v36']}};
    if(fail)return{data:null,error:{message:'Kontingent erreicht'}};
    return{data:{ok:true,resolution:{candidates:[resolved],lookup_key:source==='independent'?'F0:WKN:860180:XETRA':undefined,cached:false,warnings:[]}}};
  }}};
  window.InvestitionDashboard={getSession:()=>session,getSupabase:()=>sb};
  window.addEventListener('investition:security-picked',e=>globalEvents.push(e.detail));
  const js=read('security-picker.js').replace(/^import .*;$/gm,'').replace(/^export /gm,'');
  const api=new Function('window','document','validateSecurityQuery','securityFieldChanges',js+'\nreturn {mountSecurityPicker,writeSecurityFields};')(window,{getElementById:id=>elements[id],querySelectorAll:()=>[]},validateSecurityQuery,securityFieldChanges);
  const control=api.mountSecurityPicker(root);
  return{elements,nodes,root,form,window,calls,globalEvents,api,control,release:()=>release(),logout(){session=null;window.dispatchEvent(new CustomEvent('investition:auth-changed'));}};
}
test('A WKN picker is embedded once for every typed instrument/ticker input area',()=>{
  const mounted=[...html.matchAll(/data-security-target="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(mounted.sort(),[...SECURITY_TARGETS].sort());assert.equal(new Set(mounted).size,mounted.length);assert.ok(html.includes(read('deep-analysis-panel.html').split('\n').slice(1).join('\n').trim()));assert.ok(html.includes(read('paper-portfolio-panel.html').trim()));
});
test('Actual picker makes no request on load and only invokes resolve-security when explicitly searched',async()=>{
  const h=harness();assert.equal(h.calls.length,0);h.nodes['[data-sec-query]'].value='860180';await h.control.lookup();assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'resolve-security');assert.deepEqual(h.calls[0].body,{query:'860180',preferred_exchange:'XETRA',manual_start:true});assert.equal(h.elements.daSymbol.value,'NVDA.US');assert.equal(h.nodes['[data-sec-results]'].hidden,false);
});
test('Actual picker fills analysis fields through existing input/change events without saving or starting AI',async()=>{
  const h=harness();const events=[];h.elements.daSymbol.addEventListener('change',()=>events.push(h.elements.daCurrency.value));h.nodes['[data-sec-query]'].value='860180';await h.control.lookup();await h.nodes['[data-sec-apply]'].trigger('click');assert.equal(h.elements.daSymbol.value,'SND.XETRA');assert.equal(h.elements.daCompany.value,'Schneider Electric SE');assert.equal(h.elements.daCurrency.value,'EUR');assert.deepEqual(events,['EUR']);assert.equal(h.calls.length,1);assert.equal(h.globalEvents.length,1);assert.match(h.nodes['[role=status]'].textContent,/Noch nicht gespeichert oder analysiert/);
});
test('Actual picker guards the analysis submit while a WKN lookup is pending',async()=>{
  const h=harness('deep',{pause:true});h.nodes['[data-sec-query]'].value='860180';const pending=h.control.lookup();let prevented=false;await h.form.trigger('submit',{preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.ok(h.form.events.submit[0].capture);h.release();await pending;
});
test('Actual picker Enter searches the WKN and prevents native analysis submission',async()=>{
  const h=harness();h.nodes['[data-sec-query]'].value='860180';let prevented=false;await h.root.trigger('keydown',{key:'Enter',target:h.nodes['[data-sec-query]'],preventDefault(){prevented=true;}});await new Promise(r=>setTimeout(r,0));assert.equal(prevented,true);assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'resolve-security');
});
test('Actual picker double clicks do not issue duplicate provider lookups',async()=>{
  const h=harness('deep',{pause:true});h.nodes['[data-sec-query]'].value='860180';const pending=h.control.lookup();await h.control.lookup();assert.equal(h.calls.length,1);h.release();await pending;
});
test('Actual picker logout or discard prevents late results from changing the form',async()=>{
  for(const cancel of [h=>h.logout(),h=>h.control.clear()]){const h=harness('deep',{pause:true});h.nodes['[data-sec-query]'].value='860180';const pending=h.control.lookup();cancel(h);h.release();await pending;assert.equal(h.elements.daSymbol.value,'NVDA.US');assert.equal(h.nodes['[data-sec-query]'].value,'');assert.equal(h.nodes['[data-sec-results]'].hidden,true);}
});
test('Actual picker rejects stale lookup results when the modal/form changed meanwhile',async()=>{
  const h=harness();h.nodes['[data-sec-query]'].value='860180';await h.control.lookup();h.elements.daSymbol.value='SAP.XETRA';await h.nodes['[data-sec-apply]'].trigger('click');assert.equal(h.elements.daSymbol.value,'SAP.XETRA');assert.match(h.nodes['[role=status]'].textContent,/inzwischen geändert/);
});
test('Actual trade picker fills both provider codes and WKN/ISIN but leaves persistence to the existing submit',async()=>{
  const h=harness('trade');h.nodes['[data-sec-query]'].value='860180';await h.control.lookup();await h.nodes['[data-sec-apply]'].trigger('click');assert.equal(h.elements.tradeForm.elements.symbol.value,'XETR:SND');assert.equal(h.elements.tradeForm.elements.marketSymbol.value,'SND.XETRA');assert.equal(h.elements.tradeForm.elements.wkn.value,'860180');assert.equal(h.elements.tradeForm.elements.isin.value,'FR0000121972');assert.equal(h.calls.length,1);
});
test('Actual US trade picker waits for the chart venue rather than guessing NASDAQ',async()=>{
  const h=harness('trade',{resolved:{...candidate,market_symbol:'SND.US',exchange:'US',currency:'USD',chart_symbol:null}});h.nodes['[data-sec-query]'].value='860180';await h.control.lookup();assert.equal(h.nodes['[data-sec-chart-block]'].hidden,false);await h.nodes['[data-sec-apply]'].trigger('click');assert.equal(h.elements.tradeForm.elements.marketSymbol.value,'NVDA.US');assert.match(h.nodes['[role=status]'].textContent,/Chart-Handelsplatz/);h.nodes['[data-sec-chart]'].value='NYSE';await h.nodes['[data-sec-apply]'].trigger('click');assert.equal(h.elements.tradeForm.elements.symbol.value,'NYSE:SND');
});
test('Actual unknown-exchange trade picker accepts an explicitly entered chart code',async()=>{
  const h=harness('trade',{resolved:{...candidate,market_symbol:'SND.BUD',exchange:'BUD',currency:'HUF',chart_symbol:null}});h.nodes['[data-sec-query]'].value='860180';await h.control.lookup();h.nodes['[data-sec-chart-custom]'].value='BET:SND';await h.nodes['[data-sec-apply]'].trigger('click');assert.equal(h.elements.tradeForm.elements.symbol.value,'BET:SND');assert.equal(h.elements.tradeForm.elements.marketSymbol.value,'SND.BUD');
});
test('Actual picker errors are visible, preserve the form, and a discarded search unblocks manual entry',async()=>{
  const h=harness('deep',{fail:true});h.nodes['[data-sec-query]'].value='860180';await h.control.lookup();assert.match(h.nodes['[role=status]'].textContent,/Kontingent/);assert.equal(h.elements.daSymbol.value,'NVDA.US');h.control.clear();let prevented=false;await h.form.trigger('submit',{preventDefault(){prevented=true;}});assert.equal(prevented,false);
});
test('Actual picker rejects invalid identifiers without any API request',async()=>{
  const h=harness();h.nodes['[data-sec-query]'].value='http://invalid';await h.control.lookup();assert.equal(h.calls.length,0);assert.match(h.nodes['[role=status]'].textContent,/WKN/);
});
test('Actual independent picker checks server capabilities and carries owner lookup key into the analysis form',async()=>{
  const h=harness('deep',{source:'independent',resolved:{...candidate,eodhd_verified:false,isin:null,figi:'BBG000A00001',quote_symbol:'SND.DE'}});h.nodes['[data-sec-query]'].value='860180';await h.control.lookup();assert.equal(h.calls.length,2);assert.equal(h.calls[0].body.action,'capabilities');assert.equal(h.calls[1].body.catalogue_source,'independent');await h.nodes['[data-sec-apply]'].trigger('click');assert.equal(h.globalEvents[0].security.security_key,'F0:WKN:860180:XETRA');assert.equal(h.globalEvents[0].security.eodhd_verified,false);
});
test('Actual independent picker blocks an old backend before it can call EODHD',async()=>{
  const h=harness('deep',{source:'independent',oldServer:true});h.nodes['[data-sec-query]'].value='860180';await h.control.lookup();assert.equal(h.calls.length,1);assert.match(h.nodes['[role=status]'].textContent,/V36-Gesamtupdate/);assert.equal(h.elements.daSymbol.value,'NVDA.US');
});
test('Actual CSV-only picker needs an explicit currency when public metadata are absent',async()=>{
  const h=harness('deep',{source:'independent',resolved:{...candidate,currency:null,isin:null,eodhd_verified:false,figi:'BBG000A00001',quote_symbol:'SND.DE'}});h.elements.daMarketSource.value='csv';h.nodes['[data-sec-query]'].value='860180';await h.control.lookup();assert.equal(h.calls[1].body.quote_metadata,false);assert.equal(h.nodes['[data-sec-currency-label]'].hidden,false);await h.nodes['[data-sec-apply]'].trigger('click');assert.equal(h.elements.daSymbol.value,'NVDA.US');h.nodes['[data-sec-currency]'].value='EUR';await h.nodes['[data-sec-apply]'].trigger('click');assert.equal(h.elements.daSymbol.value,'SND.XETRA');assert.equal(h.globalEvents[0].security.currency,'EUR');
});
