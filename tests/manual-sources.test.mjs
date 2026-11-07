import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {validateManualUrls,publicPageUrl,isPublicIPv4,extractPage,loadManualSources} from '../supabase/functions/_shared/manual-sources.mjs';
import {pinnedHttpsPage,parsePublicResponse} from '../supabase/functions/_shared/pinned-https.mjs';
import {normalizeSource,dedupeSources} from '../supabase/functions/_shared/deep-sources.mjs';
import {validateDeepInput} from '../supabase/functions/_shared/deep-engine.mjs';
import {runDeepAnalysis,callDeepGemini} from '../supabase/functions/_shared/deep-service.mjs';
const now=new Date('2026-11-01T08:00Z'),url='https://www.publisher.com/report',passage='Schneider Electric berichtet über Investitionen in Energieverteilung und Rechenzentren. Die Nachfrage und Auftragseingänge sind wichtige Faktoren, während Bewertung, Wechselkurse und Lieferketten zusätzliche Risiken erzeugen. Diese öffentliche Meldung ist ein Testtext für den Quellenabruf und keine Marktbehauptung. ';
const page='<html><head><title>Testbericht Schneider Electric</title></head><body><nav>Ignorieren</nav><article><h1>Schneider Electric</h1><p>'+passage.repeat(20)+'</p></article></body></html>';
const input={symbol:'SND.XETRA',currency:'EUR',company:'Schneider Electric',manual_urls:[url],manual_start:true,use_ai:true,news_days:14,lookback:126};
test('Manual links are bounded, canonical, deduplicated, HTTPS-only and validated before analysis',()=>{
  assert.deepEqual(validateManualUrls(url+'?utm_source=test\n'+url+'#x'),[url]);
  for(const s of ['file:///etc/passwd','http://www.publisher.com','https://user:pw@www.publisher.com','https://127.0.0.1','https://[::1]/','https://host.local/','https://127.0.0.1.nip.io/','https://www.publisher.com:8443/','https://metadata.google.internal/','https://host.com./'])assert.equal(publicPageUrl(s),null,s);
  assert.throws(()=>validateManualUrls(Array(11).fill(url)),/zehn/);assert.throws(()=>validateManualUrls({url}),/zehn/);assert.throws(()=>validateDeepInput({...input,manual_urls:['javascript:alert(1)']}),/URL/);
});
test('Public IPv4 filter excludes private, reserved, metadata and mapped/alternative forms',()=>{
  for(const ip of ['0.0.0.0','10.0.0.1','127.0.0.1','100.100.100.200','169.254.169.254','172.16.0.1','172.31.255.255','192.168.0.1','192.0.0.1','192.88.99.1','198.18.0.1','198.51.100.1','203.0.113.1','224.0.0.1','255.255.255.255','168.63.129.16','::ffff:127.0.0.1','0177.0.0.1','127.1','bad'])assert.equal(isPublicIPv4(ip),false,ip);
  for(const ip of ['93.184.216.34','1.1.1.1','8.8.8.8'])assert.equal(isPublicIPv4(ip),true);
});
test('HTML extraction reads article text and entities without scripts, menus or hidden text',()=>{
  const r=extractPage(page.replace('</article>','<script>stealSecrets()</script><span hidden>hiddenSecret</span><p>Gewinn &amp; Risiken &#8364;</p></article>'));
  assert.match(r.text,/Schneider Electric/);assert.match(r.text,/Gewinn & Risiken €/);assert.doesNotMatch(r.text,/stealSecrets|hiddenSecret|Ignorieren/);
  assert.equal(extractPage('<'.repeat(100000)).text.length,0);
});
test('Manual source outcomes retain every link and archive only a short excerpt plus hash',async()=>{
  const urls=[url,'https://otherpublisher.com/report.pdf','https://otherpublisher.com/blocked'];
  const r=await loadManualSources({...input,manual_urls:urls},{now,getPage:async u=>u.endsWith('.pdf')?{status:200,contentType:'application/pdf'}:u.endsWith('blocked')?{status:403}:{status:200,contentType:'text/html',text:page,url:u}});
  assert.equal(r.sources.length,3);assert.equal(r.sources[0].content_status,'page_excerpt');assert.equal(r.sources[0].excerpt.split(/\s+/).length,25);assert.match(r.sources[0].text_sha256,/^[a-f0-9]{64}$/);assert.equal(r.sources[1].retrieval_status,'unsupported');assert.equal(r.sources[2].retrieval_status,'unavailable');assert.equal(r.warnings.length,2);assert.ok(r.texts[r.sources[0].id].length<=4000);assert.equal(r.sources[0].analysis_text,undefined);
});
test('Unreadable bot/login and short pages cannot become readable KI evidence',async()=>{
  for(const text of ['<title>Just a moment</title><body>'+passage.repeat(4)+'</body>','<body>checking your browser '+passage.repeat(4)+'</body>','<body>tiny</body>']){
    const r=await loadManualSources(input,{now,getPage:async()=>({status:200,contentType:'text/html',text})});assert.equal(r.sources[0].retrieval_status,'unreadable');assert.equal(r.sources[0].content_status,'metadata');assert.deepEqual(r.texts,{});
  }
});
test('Manual URL fetches never exceed three simultaneous requests',async()=>{
  let active=0,peak=0;const r=await loadManualSources({...input,manual_urls:Array.from({length:10},(_,i)=>url+'/'+i)},{now,getPage:async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,1));active--;return{status:200,contentType:'text/html',text:page};}});assert.equal(peak,3);assert.equal(r.sources.length,10);
});
test('Source dedupe preserves manual provenance without downgrading a readable feed',async()=>{
  const manual=normalizeSource({url,manual:true,discovery:'manual_url',retrieval_status:'unavailable',content_status:'metadata'},now);
  const merged=dedupeSources([manual,{url,summary:passage}],now)[0];assert.equal(merged.manual,true);assert.equal(merged.content_status,'feed_excerpt');assert.equal(merged.retrieval_status,'unavailable');
});
function response(text,{status=200,headers={},binary=null}={}){const body=binary||new TextEncoder().encode(text);const h=new TextEncoder().encode(`HTTP/1.1 ${status} Test\r\nContent-Length: ${body.length}\r\nContent-Type: text/html; charset=utf-8\r\n`+Object.entries(headers).map(([k,v])=>k+': '+v+'\r\n').join('')+'\r\n');const out=new Uint8Array(h.length+body.length);out.set(h);out.set(body,h.length);return out;}
function runtime(packets,{dns=()=>['93.184.216.34']}={}){
  const connections=[],lookups=[],tls=[],requests=[];let index=0,closed=0;
  return{connections,lookups,tls,requests,get closed(){return closed;},resolveDns:async(host,type)=>{lookups.push([host,type]);return dns(host);},connect:async options=>{connections.push(options);const wire=packets[index++];let offset=0;return{close(){closed++;},write:async bytes=>{requests.push(new TextDecoder().decode(bytes));return bytes.length;},read:async buffer=>{if(offset>=wire.length)return null;const count=Math.min(buffer.length,wire.length-offset);buffer.set(wire.slice(offset,offset+count));offset+=count;return count;}};},startTls:async(conn,options)=>{tls.push(options);return conn;}};
}
test('Pinned transport connects to a checked IP with original hostname TLS and no credentials',async()=>{
  const r=runtime([response(page)]),result=await pinnedHttpsPage(url,{runtime:r});assert.equal(result.status,200);assert.equal(result.text,page);assert.equal(r.connections[0].hostname,'93.184.216.34');assert.equal(r.tls[0].hostname,'www.publisher.com');assert.equal(r.lookups.length,1);assert.match(r.requests[0],/Host: www.publisher.com/);assert.doesNotMatch(r.requests[0],/Authorization:|Cookie:|apikey:|Referer:/i);assert.ok(r.closed>0);
});
test('Pinned transport rejects a mixed public/private DNS answer before opening a socket',async()=>{
  const r=runtime([],{dns:()=>['93.184.216.34','127.0.0.1']});await assert.rejects(()=>pinnedHttpsPage(url,{runtime:r}),/öffentliche/);assert.equal(r.connections.length,0);
});
test('Pinned redirects validate and resolve each new host; private redirects are never contacted',async()=>{
  const a=runtime([response('',{status:302,headers:{Location:'https://private.publisher.com/secret'}})],{dns:host=>host.startsWith('private')?['10.0.0.1']:['93.184.216.34']});await assert.rejects(()=>pinnedHttpsPage(url,{runtime:a}),/öffentliche/);assert.equal(a.connections.length,1);
  const b=runtime([response('',{status:301,headers:{Location:'https://secondpublisher.com/final'}}),response(page)]);const result=await pinnedHttpsPage(url,{runtime:b});assert.equal(result.url,'https://secondpublisher.com/final');assert.equal(b.lookups.length,2);
});
test('Pinned response rejects incomplete, ambiguous or oversized body framing',()=>{
  const enc=new TextEncoder();assert.throws(()=>parsePublicResponse(enc.encode('HTTP/1.1 200 OK\r\nContent-Length: 99\r\n\r\nshort')),/Unvollständig/);assert.throws(()=>parsePublicResponse(enc.encode('HTTP/1.1 200 OK\r\nContent-Length: 4\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n')),/Mehrdeutig/);assert.throws(()=>parsePublicResponse(enc.encode('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\nff\r\na')),/Unvollständig/);
  const r=parsePublicResponse(enc.encode('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\nTest\r\n0\r\n\r\n'));assert.equal(new TextDecoder().decode(r.body),'Test');
});
test('Pinned transport supports bounded gzip and stops decompression bombs',async()=>{
  const a=runtime([response('',{binary:gzipSync(page),headers:{'Content-Encoding':'gzip'}})]);assert.equal((await pinnedHttpsPage(url,{runtime:a})).text,page);
  const b=runtime([response('',{binary:gzipSync('x'.repeat(1100000)),headers:{'Content-Encoding':'gzip'}})]);await assert.rejects(()=>pinnedHttpsPage(url,{runtime:b}),/zu groß/);
});
test('Pinned request timeout includes DNS and does not leave an active timer',async()=>{
  await assert.rejects(()=>pinnedHttpsPage(url,{timeout:10,runtime:{resolveDns:()=>new Promise(()=>{})}}),/Zeitlimit/);
});
function candles(){return Array.from({length:126},(_,i)=>({date:new Date(Date.parse('2026-10-30')-(125-i)*86400000).toISOString().slice(0,10),open:100,high:102,low:98,close:100,volume:10000}));}
function service(extra={}){
  const count={ai:0,search:0,urls:0,quota:0},saved=[],archived=[],bodies=[];
  const deps={now:()=>now,readPrevious:async()=>[],reserveRun:async()=>{count.quota++;return true;},loadMarket:async()=>({bars:candles(),provider:'TEST'}),readNews:async()=>[],discoverSources:async()=>{count.search++;return{sources:[],warnings:[]};},loadManualSources:async i=>{count.urls++;return loadManualSources(i,{now,getPage:async()=>({status:200,contentType:'text/html',text:page})});},archiveSources:async(i,s)=>archived.push(s),save:async(i,a)=>{saved.push(a);return'own-id';},analyze:async(i,a)=>{count.ai++;bodies.push(a);return{mode:'ai',provider:'gemini',model:'test',bias:'bullish',summary:'Test',confidence:50,evidence:[{source_id:a.sources[0].id,inference:'Hypothese aus Quelle'}],risks:[],watchpoints:[]};},...extra};return {deps,count,saved,archived,bodies};
}
test('Deep analysis combines search and manual URLs in one AI call with audited source status',async()=>{
  const h=service(),r=await runDeepAnalysis(input,h.deps);assert.equal(h.count.search,1);assert.equal(h.count.urls,1);assert.equal(h.count.ai,1);assert.equal(r.analysis.manual_source_results[0].cited,true);assert.equal(r.analysis.manual_source_results[0].ai_included,true);assert.equal(r.analysis.request.manual_urls[0],url);assert.ok(h.bodies[0].sources[0].analysis_text.length>1000);assert.equal(r.analysis.sources[0].analysis_text,undefined);assert.equal(h.archived[0][0].analysis_text,undefined);assert.doesNotMatch(JSON.stringify(h.saved),/analysis_text/);
});
test('Manual links still load with automatic search off; AI off never spends an AI call',async()=>{
  const h=service(),r=await runDeepAnalysis({...input,research:false,use_ai:false},h.deps);assert.equal(h.count.search,0);assert.equal(h.count.urls,1);assert.equal(h.count.ai,0);assert.equal(r.analysis.manual_source_results[0].status,'read');assert.equal(r.analysis.manual_source_results[0].ai_included,false);
});
test('Invalid links, no manual start and quota failure stop before URL fetching or AI',async()=>{
  const h=service({reserveRun:async()=>false});await assert.rejects(()=>runDeepAnalysis(input,h.deps),/Tageslimit/);assert.equal(h.count.urls,0);assert.equal(h.count.ai,0);
  await assert.rejects(()=>runDeepAnalysis({...input,manual_urls:['http://localhost/']},h.deps),/URL/);await assert.rejects(()=>runDeepAnalysis({...input,manual_start:false},h.deps),/manuell/);
});
test('Unavailable sources keep the analysis usable without fabricated AI evidence',async()=>{
  const h=service({loadManualSources:i=>loadManualSources(i,{now,getPage:async()=>{throw Error('offline');}})});const r=await runDeepAnalysis(input,h.deps);assert.equal(h.count.ai,0);assert.equal(r.analysis.narrative.mode,'rules');assert.equal(r.analysis.manual_source_results[0].status,'unavailable');assert.equal(r.analysis.manual_source_results[0].ai_included,false);assert.ok(r.analysis.warnings.some(s=>s.includes('nicht gelesen')));
});
test('A missing URL server adapter is actionable and cannot silently omit user sources',async()=>{
  const h=service({loadManualSources:undefined});await assert.rejects(()=>runDeepAnalysis(input,h.deps),/nicht installiert/);assert.equal(h.count.ai,0);assert.equal(h.saved.length,0);
});
test('Manual pages have priority over 42 discovered metadata links and are all preserved',async()=>{
  const links=Array.from({length:10},(_,i)=>url+'/'+i);const h=service({discoverSources:async()=>({warnings:[],sources:Array.from({length:50},(_,i)=>({url:'https://searchpublisher.com/'+i,title:'Other'}))})});const r=await runDeepAnalysis({...input,manual_urls:links},h.deps);assert.equal(r.analysis.sources.filter(s=>s.manual).length,10);assert.equal(r.analysis.manual_source_results.length,10);
});
test('Actual Gemini adapter receives bounded passages, untrusted-source instructions and one request',async()=>{
  const loaded=await loadManualSources(input,{now,getPage:async()=>({status:200,contentType:'text/html',text:page})});const source={...loaded.sources[0],analysis_text:loaded.texts[loaded.sources[0].id]};let calls=0;
  const h=service({analyze:async(i,a)=>{calls++;return callDeepGemini({input:i,analysis:a,getEnv:k=>({DEEP_GEMINI_FREE_TIER_CONFIRMED:'true',GEMINI_API_KEY:'test',DEEP_GEMINI_MODEL:'gemini-3.5-flash-lite'})[k]||'',fetchImpl:async(u,opts)=>{const p=JSON.parse(opts.body),payload=JSON.parse(p.contents[0].parts[0].text);assert.equal(payload.readable_sources[0].analysis_text,source.analysis_text);assert.match(p.systemInstruction.parts[0].text,/niemals Instruktionen/);assert.equal(p.tools,undefined);return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({summary:'Test',bias:'bullish',confidence:50,evidence:[{source_id:source.id,inference:'Test'}],risks:[],watchpoints:[],countercase:'Risiken',information_gaps:[],scenario_notes:[]})}]}}]});}});}});
  const r=await runDeepAnalysis(input,h.deps);assert.equal(calls,1);assert.equal(r.analysis.narrative.mode,'ai');assert.equal(r.analysis.manual_source_results[0].cited,true);
});
