import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {validateDeepInput,buildDeepAnalysis} from '../supabase/functions/_shared/deep-engine.mjs';
import {canonicalUrl} from '../supabase/functions/_shared/deep-sources.mjs';
import {parseOhlcvCsv} from '../supabase/functions/_shared/signal-engine.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),html=read('index.html');
function harness({oldServer=false,offline=false,pauseCapabilities=false}={}) {
  const elements={},windowEvents={},calls=[];let session={user:{id:'owner'}};
  for(const m of html.matchAll(/id="([^"]+)"/g))elements[m[1]]={value:'',checked:false,innerHTML:'',textContent:'',disabled:false,events:{},addEventListener(n,f){this.events[n]=f;},querySelectorAll:()=>[],setAttribute(){},removeAttribute(){},focus(){},scrollIntoView(){}};
  for(const m of html.matchAll(/<input[^>]*id="([^"]+)"[^>]*>/g)){const e=elements[m[1]];e.value=m[0].match(/value="([^"]*)"/)?.[1]||'';e.checked=/\bchecked\b/.test(m[0]);}
  for(const [id,value] of Object.entries({daCurrency:'EUR',daSymbol:'SND.XETRA',daCompany:'Schneider Electric',daDays:'20',daLookback:'126',daNewsDays:'14',daEventDirection:'neutral',daProductType:'none',daProductDirection:'long',daObservation:'unknown',daValProvenance:'assumption'}))elements[id].value=value;
  const bars=Array.from({length:126},(_,i)=>({date:new Date(Date.now()-(127-i)*86400000).toISOString().slice(0,10),open:100,high:102,low:98,close:100,volume:1000}));
  let continueCapabilities;
  const sb={functions:{invoke:async(name,{body})=>{calls.push(body);if(body.action==='capabilities'){if(pauseCapabilities)await new Promise(resolve=>continueCapabilities=resolve);return oldServer?{error:{message:'unknown action'}}:{data:{ok:true,features:['manual_urls_v34']}};}if(offline)return{error:{message:'offline'}};const analysis=buildDeepAnalysis(validateDeepInput({...body,use_ai:false}),bars);analysis.manual_source_results=(body.manual_urls||[]).map(url=>({url,status:'read',message:'Auszug gelesen',ai_included:false,cited:false}));return{data:{ok:true,analysis}};}},from:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,range:async()=>({data:[],count:0})};return q;}};
  const window={location:{search:''},InvestitionDashboard:{getSupabase:()=>sb,getSession:()=>session},addEventListener:(name,fn)=>windowEvents[name]=fn};
  const js=read('deep-analysis.js').replace(/^import .*;$/gm,'');
  const api=new Function('window','document','validateDeepInput','buildDeepAnalysis','parseOhlcvCsv','canonicalUrl',js+'\nreturn {run,input,sourcesHtml};')(window,{getElementById:id=>elements[id]},validateDeepInput,buildDeepAnalysis,parseOhlcvCsv,canonicalUrl);
  return {elements,calls,windowEvents,api,releaseCapabilities:()=>continueCapabilities(),logout(){session=null;windowEvents['investition:auth-changed']();}};
}
test('Actual deep UI submits canonical manual URLs after capability check and renders per-link outcomes',async()=>{
  const h=harness();h.elements.daManualUrls.value='https://www.publisher.com/report?utm_source=x\nhttps://secondpublisher.com/news';await h.api.run();assert.equal(h.calls.length,2);assert.equal(h.calls[0].action,'capabilities');assert.deepEqual(h.calls[1].manual_urls,['https://www.publisher.com/report','https://secondpublisher.com/news']);assert.match(h.elements.daManualSourceResults.innerHTML,/Auszug gelesen/);assert.match(h.elements.daManualSourceResults.innerHTML,/Als Beleg zitiert/);assert.match(h.elements.daStatus.textContent,/abgeschlossen/);
});
test('Actual deep UI old-server check stops before starting an analysis that would ignore URLs',async()=>{
  const h=harness({oldServer:true});h.elements.daManualUrls.value='https://www.publisher.com/report';await h.api.run();assert.equal(h.calls.length,1);assert.match(h.elements.daStatus.textContent,/V34-Gesamtupdate deployen/);assert.equal(h.elements.daResults.hidden,undefined);
});
test('Actual deep UI rejects invalid URL before network access and clears URLs at logout',async()=>{
  const h=harness();h.elements.daManualUrls.value='http://localhost/private';await h.api.run();assert.equal(h.calls.length,0);assert.match(h.elements.daStatus.textContent,/URL/);h.logout();assert.equal(h.elements.daManualUrls.value,'');assert.equal(h.elements.daManualSourceResults.innerHTML,'');
});
test('Actual deep UI session change during preparation prevents the later analysis request',async()=>{
  const h=harness({pauseCapabilities:true});h.elements.daManualUrls.value='https://www.publisher.com/report';const pending=h.api.run();assert.equal(h.calls.length,1);h.logout();h.releaseCapabilities();await pending;assert.equal(h.calls.length,1);assert.equal(h.elements.daManualUrls.value,'');
});
test('Actual deep UI double click with URLs issues one preparation and one analysis request',async()=>{
  const h=harness({pauseCapabilities:true});h.elements.daManualUrls.value='https://www.publisher.com/report';const first=h.api.run();await h.api.run();assert.equal(h.calls.length,1);h.releaseCapabilities();await first;assert.equal(h.calls.length,2);
});
test('Actual deep UI escapes manual source titles and messages before rendering',()=>{
  const h=harness();const out=h.api.sourcesHtml([{url:'https://www.publisher.com',title:'<img onerror=evil()>',source:'test',kind:'manual',content_status:'page_excerpt',manual:true,retrieval_message:'<script>alert(1)</script>'}]);assert.doesNotMatch(out,/<img|<script/);assert.match(out,/&lt;img/);assert.match(out,/Seitenauszug gelesen/);
});
test('Release generator check keeps login fallback, dashboard, cache and analysis version synchronized',()=>{
  const version=JSON.parse(read('release.json')).version;execFileSync(process.execPath,['scripts/set-version.mjs','--check'],{cwd:new URL('../',import.meta.url)});assert.ok(html.includes('data-release-version>'+version));assert.ok(html.includes('name="application-version" content="'+version));assert.ok(html.includes('data-release-label="V'+version));assert.ok(html.includes('release.js?v='+version));assert.ok(html.includes(read('deep-analysis-panel.html').split('\n').slice(1).join('\n').trim()));
  const gate=html.slice(html.indexOf('class="auth-subtitle"'),html.indexOf('id="gateLoginEmail"'));assert.doesNotMatch(gate,/Version 29\.4/);
  assert.ok(read('reset.html').includes('data-release-version>'+version));assert.ok(read('reset.html').includes('reset.html?v='+version));
});
test('Actual release runtime displays the same version without API or AI calls',()=>{
  const version=JSON.parse(read('release.json')).version,slots=[{},{}],nav={setAttribute(k,v){this[k]=v;}};const document={readyState:'complete',documentElement:{dataset:{}},querySelectorAll:s=>s==='[data-release-version]'?slots:[nav]};const scope={};new Function('globalThis','document',read('release.js'))(scope,document);assert.ok(slots.every(s=>s.textContent===version));assert.equal(document.documentElement.dataset.appVersion,version);assert.ok(nav['data-release-label'].startsWith('V'+version));
});
test('Actual worker serves current script ahead of cache and preserves unrelated caches on activation',async()=>{
  const handlers={},removed=[];let chosen;const release=JSON.parse(read('release.json'));const self={InvestitionRelease:release,location:{origin:'https://dashboard.test'},clients:{claim:async()=>{}},addEventListener:(n,f)=>handlers[n]=f};
  const caches={open:async()=>({put:async()=>{}}),match:async()=>new Response('old'),keys:async()=>['investition-dashboard-v32','another-app','investition-dashboard-v'+release.version],delete:async name=>removed.push(name)};
  new Function('self','importScripts','caches','fetch',read('service-worker.js'))(self,()=>{},caches,async()=>new Response('current'));
  handlers.fetch({request:{method:'GET',url:'https://dashboard.test/deep-analysis.js?v='+release.version,mode:'cors'},respondWith:p=>chosen=p});assert.equal(await(await chosen).text(),'current');let wait;handlers.activate({waitUntil:p=>wait=p});await wait;assert.deepEqual(removed,['investition-dashboard-v32']);
});
test('V34 combined workflow deploys Deep analysis and V33 together and validates release before deployment',()=>{
  const workflow=read('.github/workflows/deploy-v34-complete.yml');assert.match(workflow,/set-version\.mjs --check/);assert.match(workflow,/deploy analyze-deep-signal/);assert.match(workflow,/deploy paper-benchmark/);assert.equal((workflow.match(/supabase functions deploy/g)||[]).length,2);assert.doesNotMatch(workflow,/cron|deploy send-news|deploy sync-news/);
});
