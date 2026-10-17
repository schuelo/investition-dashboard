import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateDeepInput,buildDeepAnalysis} from '../supabase/functions/_shared/deep-engine.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
class Element {
  constructor(id){this.id=id;this.value='';this.checked=false;this.hidden=true;this.innerHTML='';this.textContent='';this.events={};this.disabled=false;this.attributes={};}
  addEventListener(name,fn){(this.events[name] ||= []).push(fn);}
  async trigger(name,e={}){for(const fn of this.events[name] || [])await fn({preventDefault(){},target:this,...e});}
  setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}getAttribute(k){return this.attributes[k] ?? null;}
  querySelectorAll(){return [];}focus(){this.focused=true;}scrollIntoView(){this.revealed=true;}
}
const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
for(const m of html.matchAll(/<input[^>]*id="([^"]+)"[^>]*>/g)){
  if(/value="/.test(m[0]))elements[m[1]].value=m[0].match(/value="([^"]*)"/)[1];
  elements[m[1]].checked=/\bchecked\b/.test(m[0]);
}
for(const [id,value] of Object.entries({daCurrency:'USD',daDays:'20',daLookback:'252',daNewsDays:'14',daEventDirection:'neutral',daProductType:'none',daProductDirection:'long',daObservation:'unknown',daValProvenance:'assumption'}))elements[id].value=value;
const fakeWindow=new EventTarget();let invocations=0,release;
let session=null;
const sample=Array.from({length:250},(_,i)=>{const d=new Date();d.setUTCDate(d.getUTCDate()-260+i);const close=100*Math.exp(.001*i+.01*Math.sin(i));return {date:d.toISOString().slice(0,10),open:close,high:close*1.01,low:close*.99,close,volume:1e6};});
const analysis=buildDeepAnalysis(validateDeepInput({symbol:'NVDA.US',currency:'USD',days:20,use_ai:false,manual_start:true}),sample);
const sb={functions:{invoke:async()=>{
  invocations++;await new Promise(resolve=>release=resolve);return {data:{ok:true,analysis},error:null};
}},from:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,range:async()=>({data:[],count:0}),limit:async()=>({data:[]}),maybeSingle:async()=>({data:null})};return q;}};
fakeWindow.InvestitionDashboard={getSession:()=>session,getSupabase:()=>sb};
fakeWindow.location={search:'?signal_trigger=11111111-1111-4111-8111-111111111111&signal_symbol=NVDA.US'};
globalThis.window=fakeWindow;globalThis.document={getElementById:id=>elements[id]};
await import('../deep-analysis.js');
test('Module readiness is visible only after successful initialization',()=>{
  assert.match(elements.daStatus.textContent,/V32\.0\.1 bereit/);
  assert.match(html,/V32\.0\.1 wird geladen/);
  assert.match(html,/deep-analysis\.js\?v=32\.0\.1/);
});
test('All default numeric values satisfy native min/step rules including closed optional sections',()=>{
  const form=html.split('<form id="daForm"')[1].split('</form>')[0];
  const decimal=v=>{
    const s=String(v),parts=s.split('.'),places=(parts[1] || '').length;
    return {n:BigInt((parts[0] || '0')+(parts[1] || '')),places};
  };
  for(const tag of form.matchAll(/<input[^>]+type="number"[^>]*>/g)){
    const attr=Object.fromEntries([...tag[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
    if(!attr.value || attr.step==='any')continue;
    const a=decimal(attr.value),b=decimal(attr.min ?? attr.value ?? '0'),c=decimal(attr.step || '1'),places=Math.max(a.places,b.places,c.places);
    const scaled=x=>x.n*10n**BigInt(places-x.places);
    assert.equal((scaled(a)-scaled(b))%scaled(c),0n,attr.id+' default fails native step validation');
    if(attr.min!=null)assert.ok(Number(attr.value)>=Number(attr.min),attr.id);
    if(attr.max!=null)assert.ok(Number(attr.value)<=Number(attr.max),attr.id);
  }
});
test('Native invalid event opens hidden section and reports the field before an analysis request',async()=>{
  const field=elements.daBudget,details={open:false};
  field.labels=[{textContent:'Risikobudget (%)'}];field.closest=()=>details;
  field.validationMessage='Der Wert muss kleiner oder gleich 5 sein.';field.validity={valid:false};
  await elements.daForm.trigger('invalid',{target:field});
  assert.equal(details.open,true);assert.equal(field.getAttribute('aria-invalid'),'true');
  assert.match(elements.daStatus.textContent,/Risikobudget/);assert.match(elements.daStatus.textContent,/kleiner oder gleich 5/);
  assert.equal(elements.daStatus.revealed,true);assert.equal(invocations,0);
  const second=elements.daIv;second.labels=[{textContent:'Implizite Volatilität'}];
  await elements.daForm.trigger('invalid',{target:second});
  assert.match(elements.daStatus.textContent,/Risikobudget/);
  field.validity.valid=true;await elements.daForm.trigger('input',{target:field});
  assert.equal(field.getAttribute('aria-invalid'),null);
});
test('Deep module DOM references resolve and index has unique IDs',()=>{
  const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
  const js=readFileSync(new URL('../deep-analysis.js',import.meta.url),'utf8');
  for(const m of js.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(m[1]),m[1]);
});
test('Real module demo renders all six scenarios, methods, weekly analysis and KO stress',async()=>{
  await elements.daDemo.trigger('click');
  assert.equal(elements.daResults.hidden,false);assert.match(elements.daStatus.textContent,/Synthetische/);
  assert.match(elements.daScenarios.innerHTML,/Rücksetzer/);assert.match(elements.daScenarios.innerHTML,/Gap \/ Stress/);
  assert.match(elements.daChart.innerHTML,/<svg/);assert.match(elements.daMethods.innerHTML,/RSI 14/);
  assert.match(elements.daWeekly.innerHTML,/Wochen/);assert.match(elements.daProduct.innerHTML,/Reverse-Stress/);
  assert.equal(elements.daEvaluate.disabled,true);assert.equal(invocations,0);
});
test('Trigger link, auth, news and visibility events cannot invoke Gemini; auth clears private results',()=>{
  window.dispatchEvent(new CustomEvent('investition:news-changed'));
  window.dispatchEvent(new CustomEvent('investition:signal-simulation-visible'));
  window.dispatchEvent(new CustomEvent('investition:auth-changed'));
  assert.equal(invocations,0);assert.equal(elements.daResults.hidden,true);assert.equal(elements.daNoteSave.disabled,true);
});
test('Manual double submission issues only one edge request and a changed session discards its result',async()=>{
  session={user:{id:'owner'}};elements.daUseAi.checked=false;elements.daResearch.checked=false;
  const pending=elements.daForm.trigger('submit');
  await elements.daForm.trigger('submit');assert.equal(invocations,1);
  window.dispatchEvent(new CustomEvent('investition:auth-changed'));
  release();await pending;assert.equal(elements.daResults.hidden,true);
});
test('New deploy workflow deploys only the independent function and leaves V31 workflow available',()=>{
  const wf=readFileSync(new URL('../.github/workflows/deploy-deep-analysis.yml',import.meta.url),'utf8');
  assert.equal((wf.match(/supabase functions deploy/g)||[]).length,1);assert.match(wf,/deploy analyze-deep-signal/);
  assert.doesNotMatch(wf,/send-news-alerts|cron/);
});
