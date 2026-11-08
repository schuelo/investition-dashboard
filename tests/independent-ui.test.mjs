import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSignalAnalysis,parseOhlcvCsv} from '../supabase/functions/_shared/signal-engine.mjs';
import {validateSignalInput} from '../supabase/functions/_shared/signal-service.mjs';
import {validateDeepInput,buildDeepAnalysis} from '../supabase/functions/_shared/deep-engine.mjs';
import {canonicalUrl} from '../supabase/functions/_shared/deep-sources.mjs';
import {validateMarketChoice} from '../supabase/functions/_shared/independent-market.mjs';
import {makeBars,identity} from './fixtures/independent-market.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),html=read('index.html');
class Element extends EventTarget {
  constructor(){super();this.value='';this.checked=false;this.innerHTML='';this.textContent='';this.disabled=false;this.files=[];this.attributes={};}
  setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}querySelectorAll(){return[];}scrollIntoView(){}focus(){}
}
function harness(scope,{oldServer=false,pause=false,loadMarket=true}={}) {
  const els=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
  for(const m of html.matchAll(/<input[^>]*id="([^"]+)"[^>]*>/g)){const value=m[0].match(/value="([^"]*)"/);if(value)els[m[1]].value=value[1];els[m[1]].checked=/\bchecked\b/.test(m[0]);}
  for(const [id,value] of Object.entries({ssSymbol:'SND.XETRA',ssCurrency:'EUR',ssDays:'20',ssChartDirection:'none',daSymbol:'SND.XETRA',daCurrency:'EUR',daDays:'20',daLookback:'252',daNewsDays:'14',daEventDirection:'neutral',daProductType:'none',daProductDirection:'long',daObservation:'unknown',daValProvenance:'assumption',ssMarketSource:'independent',daMarketSource:'independent',ssQuoteSymbol:'SND.DE',daQuoteSymbol:'SND.DE'}))els[id].value=value;
  els.ssUseAi.checked=false;els.daUseAi.checked=false;els.daResearch.checked=false;
  let session={user:{id:'owner'}},release;const calls=[],bars=makeBars(300,new Date()),window=new EventTarget();window.location={search:''};
  const sb={functions:{invoke:async(name,{body})=>{calls.push({name,body});if(body.action==='capabilities'){if(pause)await new Promise(r=>release=r);return oldServer?{error:{message:'old'}}:{data:{ok:true,features:['manual_urls_v34','independent_market_v36']}};}
    const analysis=scope==='signal'?buildSignalAnalysis({symbol:body.symbol,currency:body.currency,rawBars:bars,provider:'Public test'}):buildDeepAnalysis(validateDeepInput(body),bars,{provider:'Public test'});analysis.market_data={source:body.market_source,eodhd_used:body.market_source==='eodhd',quote_symbol:body.quote_symbol,identity:'<script>not trusted</script>'};return{data:{ok:true,analysis}};}},from:()=>{const q={select:()=>q,eq:()=>q,not:()=>q,order:()=>q,limit:()=>q,range:async()=>({data:[],count:0}),then:f=>f({data:[]})};return q;}};
  window.InvestitionDashboard={getSession:()=>session,getSupabase:()=>sb};const document={getElementById:id=>els[id]};
  if(loadMarket)new Function('window','document','validateMarketChoice',read('market-data.js').replace(/^import .*;$/gm,'').replace(/^export /gm,''))(window,document,validateMarketChoice);
  const deps={window,document,buildSignalAnalysis,parseOhlcvCsv,validateSignalInput,buildDeepAnalysis,validateDeepInput,canonicalUrl};
  const file=scope==='signal'?'signal-simulation.js':'deep-analysis.js',code=read(file).replace(/^import .*;$/gm,'');
  const api=new Function(...Object.keys(deps),code+'\nreturn {run};')(...Object.values(deps));
  return{window,els,calls,api,confirm(){const el=els[(scope==='signal'?'ss':'da')+'QuoteConfirmed'];el.checked=true;el.dispatchEvent(new Event('change'));},release:()=>release(),logout(){session=null;window.dispatchEvent(new CustomEvent('investition:auth-changed'));},pick(security){window.dispatchEvent(new CustomEvent('investition:security-picked',{detail:{scope,security}}));}};
}
for(const scope of ['signal','deep']) {
  const p=scope==='signal'?'ss':'da';
  test(scope+': new UI loads without provider calls and requires quote confirmation before start',async()=>{
    const h=harness(scope);assert.equal(h.calls.length,0);await h.api.run();assert.equal(h.calls.length,0);assert.match(h.els[p+'Status'].textContent,/bestätigen/);
  });
  test(scope+': actual UI checks server support, sends independent selection and renders escaped provenance',async()=>{
    const h=harness(scope);h.confirm();await h.api.run();assert.equal(h.calls.length,2);assert.equal(h.calls[0].body.action,'capabilities');assert.equal(h.calls[1].body.market_source,'independent');assert.equal(h.calls[1].body.quote_symbol,'SND.DE');assert.match(h.els[p+'Status'].textContent,/abgeschlossen/);assert.match(h.els[p+'Quality'].innerHTML,/EODHD verwendet: Nein/);assert.doesNotMatch(h.els[p+'Quality'].innerHTML,/<script>/);
  });
  test(scope+': old server is stopped before it can silently use EODHD',async()=>{
    const h=harness(scope,{oldServer:true});h.confirm();await h.api.run();assert.equal(h.calls.length,1);assert.match(h.els[p+'Status'].textContent,/V36-Gesamtupdate/);
  });
  test(scope+': missing source module blocks a real source selection rather than using legacy defaults',async()=>{
    const h=harness(scope,{loadMarket:false});h.confirm();await h.api.run();assert.equal(h.calls.length,0);assert.match(h.els[p+'Status'].textContent,/Quellenmodul/);
  });
  test(scope+': logout during capability preparation prevents the subsequent analysis',async()=>{
    const h=harness(scope,{pause:true});h.confirm();const pending=h.api.run();assert.equal(h.calls.length,1);h.logout();h.release();await pending;assert.equal(h.calls.length,1);assert.equal(h.els[p+'QuoteConfirmed'].checked,false);
  });
  test(scope+': double click shares one manual request, not two provider/AI calls',async()=>{
    const h=harness(scope,{pause:true});h.confirm();const first=h.api.run();await h.api.run();assert.equal(h.calls.length,1);h.release();await first;assert.equal(h.calls.length,2);
  });
}
test('OpenFIGI pick binds the owner key and quote separately, then manual edits invalidate the binding/confirmation',()=>{
  const h=harness('deep');h.pick({figi:identity.figi,security_key:'F0:WKN:860180:XETRA',quote_symbol:'SND.DE',eodhd_verified:false});h.confirm();let input=h.window.InvestitionMarketData.input('deep');assert.equal(input.security_key,'F0:WKN:860180:XETRA');assert.equal(input.quote_figi,identity.figi);h.els.daQuoteSymbol.dispatchEvent(new Event('input'));assert.equal(h.els.daQuoteConfirmed.checked,false);h.confirm();input=h.window.InvestitionMarketData.input('deep');assert.equal(input.security_key,'');
});
test('CSV selection stays independent after a WKN pick, and a CSV import wins over any selected service',()=>{
  const h=harness('deep');h.els.daMarketSource.value='csv';h.pick({quote_symbol:'SND.DE',eodhd_verified:false});assert.equal(h.els.daMarketSource.value,'csv');assert.equal(h.window.InvestitionMarketData.input('deep',true).market_source,'csv');h.els.daMarketSource.value='eodhd';assert.equal(h.window.InvestitionMarketData.input('deep',true).market_source,'csv');
});
test('Programmatic stock selection cannot reuse the old manual quote confirmation',async()=>{
  const h=harness('signal');h.confirm();h.els.ssSymbol.value='OTHER.US';await h.api.run();assert.equal(h.calls.length,0);assert.equal(h.els.ssQuoteConfirmed.checked,false);assert.match(h.els.ssStatus.textContent,/erneut prüfen/);
});
test('An unverified EODHD reference from OpenFIGI cannot become an EODHD call through the source dropdown',()=>{
  const h=harness('deep');h.pick({quote_symbol:'SND.DE',eodhd_verified:false});h.els.daMarketSource.value='eodhd';assert.throws(()=>h.window.InvestitionMarketData.input('deep'),/EODHD-Katalog/);
});
test('Independent source is first in both forms and source modules are included in current cache assets',()=>{
  for(const prefix of ['ss','da'])assert.match(html,new RegExp('id="'+prefix+'MarketSource"><option value="independent">'));assert.match(read('security-picker.js'),/data-sec-source><option value="independent">/);assert.ok(html.includes('market-data.js?v=36.0.0'));assert.ok(read('service-worker.js').includes('market-data.js?v=36.0.0'));assert.ok(read('service-worker.js').includes('independent-market.mjs'));
});
