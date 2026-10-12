import { hashSeed } from './signal-engine.mjs';
// These pages are starting points, not read expert opinions or endorsements.
export const EXPERT_REGISTRY = [
  {name:'SEC EDGAR',url:'https://www.sec.gov/search-filings/edgar-application-programming-interfaces',kind:'filings',note:'Unternehmensmeldungen und XBRL; kostenlose API mit Fair-Access-Regeln.'},
  {name:'Damodaran / NYU Stern',url:'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html',kind:'valuation',note:'Bewertungs- und Branchenannahmen; Aktualität und Lizenz des Datensatzes prüfen.'},
  {name:'IEA',url:'https://www.iea.org/reports/energy-and-ai',kind:'industry',note:'Energie-/KI-Branchenkontext; Methodik und Berichtsdatum beachten.'},
  {name:'WSTS',url:'https://www.wsts.org/SERVICE',kind:'industry',note:'Halbleitermarkt; frei zugängliche Mitteilungen, Nutzungsbedingungen beachten.'},
  {name:'Oaktree / Howard Marks',url:'https://www.oaktreecapital.com/insights/memos',kind:'expert',note:'Öffentliche Risikokommentare; keine unternehmensspezifische Bestätigung.'},
  {name:'FRED / ALFRED',url:'https://fred.stlouisfed.org/',kind:'macro',note:'Makro-Zeitreihen; freier API-Schlüssel und historische Datenstände ggf. erforderlich.'}
];
export function canonicalUrl(value) {
  try {
    const u=new URL(String(value || ''));
    if(!['https:','http:'].includes(u.protocol) || u.username || u.password || u.port ||
      !u.hostname.includes('.') || /(^localhost$|\.local$|\.internal$|^\d+\.\d+\.\d+\.\d+$|:)/i.test(u.hostname)) return null;
    u.hash='';
    for(const k of [...u.searchParams.keys()]) if(/^(utm_|fbclid$|gclid$|mc_)/i.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    return u.href.length<=1800?u.href:null;
  } catch {return null;}
}
const clean = v => String(v || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function normalizeSource(row, now = new Date()) {
  const url=canonicalUrl(row.canonical_url || row.source_url || row.url || row.link);
  if(!url) return null;
  const rawDate=row.published_at || row.publishedAt,dt=rawDate?new Date(rawDate):null;
  if(dt && (!Number.isFinite(dt.getTime()) || dt>now)) return null;
  const text=row.content_status==='metadata'?'':clean(row.excerpt || row.description || row.summary || '');
  const excerpt=text.split(/\s+/).slice(0,25).join(' '); // short feed excerpt; never archive publisher full text
  const status=row.content_status==='structured_data' && row.facts?'structured_data':excerpt?'feed_excerpt':'metadata';
  const id='s-'+hashSeed(url).toString(16)+'-'+hashSeed([...url].reverse().join('')).toString(16);
  return {id,canonical_url:url,url,title:clean(row.title || row.name || url).slice(0,300),
    source:clean(row.source || row.source_name || row.sourceName || new URL(url).hostname).slice(0,120),
    kind:row.kind || 'news',published_at:dt?.toISOString() || null,retrieved_at:now.toISOString(),
    content_status:status,excerpt,own_summary:clean(row.own_summary || row.note).slice(0,1000),...(status==='structured_data'?{facts:row.facts}:{}),
    match:row.match || 'research',rights:'Link/Metadaten und kurzer Feed-Auszug; kein gespeicherter Volltext.',
    discovery:row.discovery || 'existing_feed'};
}
export function dedupeSources(rows, now = new Date()) {
  const byUrl=new Map();
  for(const r of rows) {
    const s=normalizeSource(r,now);if(!s) continue;
    const old=byUrl.get(s.canonical_url);
    if(!old || old.content_status==='metadata'&&s.content_status!=='metadata') byUrl.set(s.canonical_url,s);
  }
  return [...byUrl.values()];
}
export function relevantNews(rows,input,now = new Date(),selectedId = null) {
  const since=now.getTime()-input.news_days*86400000;
  const name=input.company.toLowerCase().trim(),terms=input.context.toLowerCase().split(/\W+/).filter(t=>t.length>=5);
  return rows.filter(r=>{
    const date=Date.parse(r.published_at || r.publishedAt);
    if(!Number.isFinite(date) || date<since || date>now.getTime()) return false;
    const txt=(r.title+' '+(r.summary || r.description || '')).toLowerCase();
    return r.id===selectedId || r.symbols?.includes(input.symbol) || name.length>2&&txt.includes(name) || terms.some(t=>txt.includes(t));
  }).sort((a,b)=>(b.id===selectedId?1:0)-(a.id===selectedId?1:0)||Date.parse(b.published_at)-Date.parse(a.published_at))
    .slice(0,24).map(r=>({...r,match:r.id===selectedId?'selected':r.symbols?.includes(input.symbol)?'direct':'context'}));
}
export async function fetchSmall(url, fetchImpl = fetch, timeout = 7000) {
  const res=await fetchImpl(url,{signal:AbortSignal.timeout(timeout),redirect:'error'});
  if(!res.ok) throw new Error('Öffentliche Recherchequelle derzeit nicht verfügbar.');
  const size=Number(res.headers?.get('content-length') || 0);
  if(size>1000000) throw new Error('Rechercheantwort zu groß.');
  if(!res.body?.getReader) {const t=await res.text();if(t.length>1000000)throw new Error('Rechercheantwort zu groß.');return t;}
  const reader=res.body.getReader(),chunks=[];let length=0;
  try {
    while(true) {const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>1000000)throw new Error('Rechercheantwort zu groß.');chunks.push(value);}
  } finally {await reader.cancel();}
  const all=new Uint8Array(length);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.byteLength;}
  return new TextDecoder().decode(all);
}
// Only fetch fixed public search endpoints, never a discovered/user-provided URL (SSRF boundary).
export async function discoverFreeSources(input,{parseRss,fetchImpl=fetch,now=new Date()}={}) {
  const query=(input.company || input.symbol.split('.')[0])+' '+input.context.slice(0,200);
  const makeUrl=q=>{
    const u=new URL('https://news.google.com/rss/search');
    u.search=new URLSearchParams({q:q+' when:'+input.news_days+'d',hl:'de',gl:'DE',ceid:'DE:de'}).toString();
    return u.href;
  };
  const jobs=[
    {url:makeUrl(query),kind:'news',name:'Öffentliche News-Recherche'},
    {url:makeUrl(query+' (site:sec.gov OR site:iea.org OR site:wsts.org OR site:stern.nyu.edu OR site:oaktreecapital.com)'),kind:'expert',name:'Primär-/Expertenquellen-Recherche'}
  ];
  const settled=await Promise.allSettled(jobs.map(async job=>{
    const text=await fetchSmall(job.url,fetchImpl);
    // Search result snippets often repeat only the headline. Do not turn them into a read article.
    return parseRss(text,job.name).slice(0,12).map(r=>({...r,content_status:'metadata',kind:job.kind,discovery:'free_rss_search',match:'research'}));
  }));
  const rows=[],warnings=[];
  settled.forEach((r,i)=>{if(r.status==='fulfilled') rows.push(...r.value);else warnings.push(jobs[i].name+' fehlgeschlagen; vorhandene Quellen weiter genutzt.');});
  rows.push(...EXPERT_REGISTRY.map(r=>({...r,title:r.name,source:r.name,discovery:'registry',match:'background'})));
  return {sources:dedupeSources(rows,now),warnings};
}
