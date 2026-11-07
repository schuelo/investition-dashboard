import {canonicalUrl,normalizeSource} from './deep-sources.mjs';

export const MAX_MANUAL_URLS=10;
export function publicPageUrl(value) {
  const canonical=canonicalUrl(value);
  if(!canonical) return null;
  const u=new URL(canonical),host=u.hostname;
  if(u.protocol!=='https:' || host.endsWith('.') || !/^[a-z0-9.-]+$/i.test(host) || host.split('.').some(p=>!p||p.length>63||p.startsWith('-')||p.endsWith('-')) ||
    /(^|\.)(localhost|local|internal|lan|home|test|invalid|example|onion|arpa)$/.test(host) ||
    /(^|\.)(nip\.io|sslip\.io|localtest\.me|lvh\.me)$/.test(host)) return null;
  return canonical;
}
export function validateManualUrls(value=[]) {
  const rows=typeof value==='string'?value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean):value;
  if(!Array.isArray(rows) || rows.length>MAX_MANUAL_URLS || rows.some(s=>typeof s!=='string')) throw Error('Maximal zehn Quellen-URLs eingeben, eine vollständige HTTPS-Adresse je Zeile.');
  const urls=rows.map(s=>publicPageUrl(s.trim()));
  if(urls.some(s=>!s))throw Error('Quellen-URL ungültig. Vollständige öffentliche HTTPS-Adressen ohne Zugangsdaten oder eigene Ports verwenden.');
  return [...new Set(urls)];
}
export function isPublicIPv4(value) {
  if(!/^\d{1,3}(\.\d{1,3}){3}$/.test(value))return false;
  const [a,b,c,d]=value.split('.').map(Number);
  if([a,b,c,d].some(n=>n>255))return false;
  return !(a===0||a===10||a===127||a>=224||a===100&&b>=64&&b<=127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2||b===88&&c===99)||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113||value==='168.63.129.16');
}
const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',auml:'ä',ouml:'ö',uuml:'ü',Auml:'Ä',Ouml:'Ö',Uuml:'Ü',szlig:'ß',ndash:'–',mdash:'—',hellip:'…',euro:'€'};
const decode=text=>text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(all,k)=>{
  if(k.startsWith('#')){const n=k[1].toLowerCase()==='x'?parseInt(k.slice(2),16):Number(k.slice(1));return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):' ';}
  return entities[k]||all;
});
const textOnly=html=>decode(html.replace(/<[^<>]*>/g,' ')).replace(/[\u0000-\u001f]+/g,' ').replace(/\s+/g,' ').trim();
export function extractPage(text,type='text/html') {
  if(type.startsWith('text/plain'))return {title:'Öffentliche Textquelle',text:textOnly(text).slice(0,16000)};
  // Bounded token scan instead of repeated whole-document nested-tag regexes.
  const hidden=new Set(['script','style','noscript','template','nav','footer','header','form','svg','iframe']);
  const buffers={article:'',main:'',body:'',all:'',title:''},depth={article:0,main:0,body:0,title:0};let skip=null;
  for(const match of text.matchAll(/<!--[\s\S]*?(?:-->|$)|<[^<>]*>|[^<]+|</g)) {
    const token=match[0];if(token.startsWith('<!--'))continue;
    if(token.startsWith('<')) {
      const tag=token.match(/^<\s*(\/?)\s*([a-z][\w:-]*)/i);if(!tag)continue;const closing=!!tag[1],name=tag[2].toLowerCase();
      if(skip){if(closing&&name===skip)skip=null;continue;}
      if(!closing&&(hidden.has(name)||/\shidden(?:\s|>|=)|aria-hidden\s*=\s*["']true["']/i.test(token))){skip=name;continue;}
      if(name in depth)depth[name]=Math.max(0,depth[name]+(closing?-1:1));
      continue;
    }
    if(skip)continue;
    for(const key of Object.keys(buffers))if((key==='all'||depth[key]>0)&&buffers[key].length<24000)buffers[key]+=' '+token.slice(0,24000-buffers[key].length);
  }
  return {title:textOnly(buffers.title||'Öffentliche Webseite').slice(0,300),text:textOnly(buffers.article||buffers.main||buffers.body||buffers.all).slice(0,16000)};
}
function relevantExcerpt(text,input) {
  // Keep a bounded, contiguous passage around the requested company, if present.
  const terms=[input.company,input.symbol?.split('.')[0]].filter(v=>v&&v.length>2);
  const lower=text.toLowerCase(),hits=terms.map(t=>lower.indexOf(t.toLowerCase())).filter(n=>n>=0);
  const start=hits.length?Math.max(0,Math.min(...hits)-350):0;
  return text.slice(start,start+4000);
}
export async function loadManualSources(input,{getPage,now=new Date()}={}) {
  const urls=validateManualUrls(input.manual_urls),sources=[],texts={},warnings=[];
  for(let i=0;i<urls.length;i+=3) {
    const batch=await Promise.all(urls.slice(i,i+3).map(async url=>{
      let source={url,canonical_url:url,title:url,kind:'manual',discovery:'manual_url',match:'manual',manual:true,content_status:'metadata',retrieval_status:'unavailable',retrieval_message:'Quelle nicht abrufbar.'};
      try {
        const page=await getPage(url);
        if(!page || page.status<200||page.status>=300)throw Error('HTTP-Abruf fehlgeschlagen.');
        if(!/^text\/(html|plain)(\s*;|$)|^application\/xhtml\+xml(\s*;|$)/i.test(page.contentType||''))return {source:{...source,retrieval_status:'unsupported',retrieval_message:'Format nicht unterstützt; bitte eine öffentliche HTML-/Textseite verwenden. PDF wird nicht gelesen.'}};
        const extracted=extractPage(page.text,page.contentType.toLowerCase());
        const lower=extracted.text.toLowerCase();
        if(extracted.text.length<160 || /^(just a moment|access denied|sign in|anmelden|seite nicht gefunden|page not found)/i.test(extracted.title) || /enable javascript and cookies to continue|checking your browser|verify you are human|captcha|subscribe to continue|subscribe to read|melden sie sich an, um weiterzulesen|abonnieren sie, um weiterzulesen/.test(lower))return {source:{...source,title:extracted.title,retrieval_status:'unreadable',retrieval_message:'Kein ausreichend lesbarer öffentlicher Text; mögliche Anmeldung, Paywall oder Bot-Sperre.'}};
        const passage=relevantExcerpt(extracted.text,input);
        const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(passage));
        return {source:{...source,title:extracted.title,excerpt:passage.split(/\s+/).slice(0,25).join(' '),content_status:'page_excerpt',retrieval_status:'read',retrieval_message:'Begrenzter Seitenauszug gelesen; kein vollständiger oder unabhängig verifizierter Artikel.',final_url:page.url||url,text_sha256:[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join(''),analysis_chars:passage.length},text:passage};
      } catch {return {source};}
    }));
    for(const item of batch) {
      const normalized=normalizeSource(item.source,now);sources.push(normalized);
      if(item.text)texts[normalized.id]=item.text;
      else warnings.push('Eigene Quelle nicht gelesen: '+item.source.url+' — '+item.source.retrieval_message);
    }
  }
  return {sources,texts,warnings};
}
