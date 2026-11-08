import {normalizeBars} from './signal-engine.mjs';

export class MarketDataError extends Error {constructor(message,status=422){super(message);this.status=status;}}
export const PUBLIC_VENUES={
  XETRA:[{mic:'XETR',suffix:'.DE',chart:'XETR',exchanges:['GER','XETRA']}],
  F:[{mic:'XFRA',suffix:'.F',chart:'FWB',exchanges:['FRA']}],
  PA:[{mic:'XPAR',suffix:'.PA',chart:'EURONEXT',exchanges:['PAR']}],
  AS:[{mic:'XAMS',suffix:'.AS',chart:'EURONEXT',exchanges:['AMS']}],
  BR:[{mic:'XBRU',suffix:'.BR',chart:'EURONEXT',exchanges:['BRU']}],
  LSE:[{mic:'XLON',suffix:'.L',chart:'LSE',exchanges:['LSE']}],
  SW:[{mic:'XSWX',suffix:'.SW',chart:'SIX',exchanges:['EBS','VTX','SWX']}],
  US:[{mic:'XNAS',suffix:'',chart:'NASDAQ',exchanges:['NMS','NGM','NCM','NASDAQ']},{mic:'XNYS',suffix:'',chart:'NYSE',exchanges:['NYQ','NYSE']},{mic:'XASE',suffix:'',chart:'AMEX',exchanges:['ASE','AMEX']},{mic:'ARCX',suffix:'',chart:'AMEX',exchanges:['PCX','NYSEARCA']}],
  KO:[{mic:'XKRX',suffix:'.KS',chart:'KRX',exchanges:['KSC']}],
  KQ:[{mic:'XKOS',suffix:'.KQ',chart:'KRX',exchanges:['KOE']}],
  SHE:[{mic:'XSHE',suffix:'.SZ',chart:'SZSE',exchanges:['SHZ']}],
  SHG:[{mic:'XSHG',suffix:'.SS',chart:'SSE',exchanges:['SHH']}],
  HK:[{mic:'XHKG',suffix:'.HK',chart:'HKEX',exchanges:['HKG']}]
};
export const publicTicker=value=>/^[A-Z0-9][A-Z0-9.\-^=]{0,39}$/.test(String(value||''));
export function validateMarketChoice(body={}) {
  const market_source=body.bars?'csv':String(body.market_source||'eodhd');
  if(!['independent','csv','eodhd'].includes(market_source))throw new MarketDataError('Kursquelle ungültig. Öffentliche Chartdaten, CSV oder EODHD wählen.');
  const quote_symbol=String(body.quote_symbol||'').trim().toUpperCase();
  const security_key=String(body.security_key||'');
  const quote_figi=String(body.quote_figi||'');
  if(market_source==='csv'&&!body.bars)throw new MarketDataError('CSV als Kursquelle ausgewählt: zuerst OHLCV-Datei importieren.');
  if(market_source==='independent'&&(!publicTicker(quote_symbol)||body.quote_confirmed!==true))throw new MarketDataError('Öffentliche Kurskennung, Handelsplatz und Währung prüfen und bestätigen oder eine CSV-Datei importieren.');
  if(security_key&&(!/^F[01]:(WKN|ISIN):[A-Z0-9]{6,12}:[A-Z0-9]{1,12}$/.test(security_key)||security_key.length>40))throw new MarketDataError('Wertpapierzuordnung ungültig. WKN-Suche erneut öffnen.');
  if(quote_figi&&!/^BBG[A-Z0-9]{9}$/.test(quote_figi))throw new MarketDataError('FIGI-Zuordnung ungültig.');
  return {market_source,quote_symbol,security_key,quote_figi,quote_confirmed:body.quote_confirmed===true};
}
function localDate(seconds,zone) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(seconds*1000)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function chartMetadata(payload,expectedSymbol) {
  const result=payload?.chart?.result?.[0],meta=result?.meta;
  if(payload?.chart?.error||!meta||String(meta.symbol||'').toUpperCase()!==expectedSymbol||!['EQUITY','ETF','MUTUALFUND'].includes(meta.instrumentType))throw new MarketDataError('Öffentliche Chartquelle liefert keine passende Aktie/ETF-Historie. Kurskennung prüfen oder CSV verwenden.');
  const currency=meta.currency==='GBp'?'GBX':String(meta.currency||'').toUpperCase();
  if(!/^[A-Z]{3}$/.test(currency)||!meta.exchangeTimezoneName)throw new MarketDataError('Währung oder Börsenzeitzone der öffentlichen Kursquelle fehlt. CSV verwenden.');
  try{localDate(0,meta.exchangeTimezoneName);}catch{throw new MarketDataError('Börsenzeitzone nicht verwertbar.');}
  return {result,meta:{symbol:expectedSymbol,currency,exchange:String(meta.exchangeName||'').toUpperCase(),timezone:meta.exchangeTimezoneName,name:String(meta.longName||meta.shortName||expectedSymbol).slice(0,160),instrumentType:meta.instrumentType}};
}
export function parsePublicChart(payload,symbol,now=new Date()) {
  const {result,meta}=chartMetadata(payload,symbol),time=result.timestamp,quote=result.indicators?.quote?.[0],adj=result.indicators?.adjclose?.[0]?.adjclose;
  if(!Array.isArray(time)||time.length>5000||!quote||['open','high','low','close','volume'].some(k=>!Array.isArray(quote[k])||quote[k].length!==time.length))throw new MarketDataError('Öffentliche Kursdaten sind unvollständig oder nicht ausgerichtet. CSV verwenden.');
  const today=localDate(now.getTime()/1000,meta.timezone),rows=[];let skipped=0,excluded=0;
  const adjusted=Array.isArray(adj)&&adj.length===time.length&&adj.every((n,i)=>quote.close[i]==null||Number.isFinite(n)&&n>0);
  for(let i=0;i<time.length;i++) {
    if(!Number.isFinite(time[i]))throw new MarketDataError('Ungültige Zeitstempel in öffentlichen Kursdaten.');
    const date=localDate(time[i],meta.timezone);
    if(date>=today||date>=now.toISOString().slice(0,10)){excluded++;continue;}
    const values=['open','high','low','close'].map(k=>quote[k][i]);
    if(values.some(n=>n==null)){skipped++;continue;}
    const [open,high,low,close]=values;
    const row={date,open,high,low,close,volume:quote.volume[i]??null};if(adjusted)row.adjusted_close=adj[i];rows.push(row);
  }
  rows.sort((a,b)=>a.date.localeCompare(b.date));const bars=rows.slice(-2000);
  try{normalizeBars(bars,now);}catch(e){throw new MarketDataError('Öffentliche OHLCV-Historie nicht ausreichend: '+e.message+' CSV verwenden.');}
  return {bars,meta,warnings:[...(skipped?[skipped+' unvollständige Tageskerzen nicht verwendet.']:[]),...(excluded?[excluded+' heutige/zukünftige Kerzen ausgeschlossen.']:[]),...(!adjusted?['Keine lückenlose Adjusted-Close-Reihe vorhanden; OHLC auf Anbieterbasis.']:[])]};
}
export function assertQuoteBinding(meta,binding,currency) {
  if(meta.currency!==currency)throw new MarketDataError('Kursquelle meldet '+meta.currency+' statt '+currency+'. Notierungswährung korrigieren; keine automatische Umrechnung.');
  if(binding) {
    const venue=PUBLIC_VENUES[binding.exchange]?.find(v=>v.mic===binding.mic);
    if(!venue||!venue.exchanges.includes(meta.exchange))throw new MarketDataError('Öffentliche Kursquelle passt nicht zum ausgewählten Handelsplatz. Andere Notierung oder CSV wählen.');
    if(binding.quote_symbol!==meta.symbol)throw new MarketDataError('Öffentliche Kurskennung passt nicht zur Wertpapierzuordnung.');
  }
}
export async function readChartResponse(response) {
  if(!response.ok)throw new MarketDataError(response.status===429?'Öffentliche Chartquelle hat ihr eigenes Limit erreicht. CSV verwenden oder später erneut versuchen; kein EODHD-Aufruf ausgelöst.':'Öffentliche Chartquelle derzeit nicht erreichbar (HTTP '+response.status+'). CSV verwenden; kein EODHD-Aufruf ausgelöst.',response.status===429?429:422);
  if(Number(response.headers.get('content-length')||0)>2200000)throw new MarketDataError('Öffentliche Kursantwort zu groß.');
  const reader=response.body.getReader();let text='',bytes=0;const decoder=new TextDecoder();
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2200000)throw new MarketDataError('Öffentliche Kursantwort zu groß.');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel();}
  try{return JSON.parse(text);}catch{throw new MarketDataError('Öffentliche Chartquelle lieferte keine JSON-Kursdaten. CSV verwenden.');}
}
export async function fetchPublicChart(symbol,kind='history',fetchImpl=fetch) {
  if(!publicTicker(symbol))throw new MarketDataError('Öffentliche Kurskennung ungültig.');
  // Only the public chart endpoint. No cookie/crumb flow, host rotation, paid download or retries.
  const endpoint=new URL('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol));
  endpoint.search=new URLSearchParams({interval:'1d',range:kind==='metadata'?'5d':'10y',events:'div,splits'}).toString();
  let response;try{response=await fetchImpl(endpoint,{redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});}catch{throw new MarketDataError('Öffentliche Chartverbindung fehlgeschlagen. CSV verwenden; kein EODHD-Aufruf ausgelöst.');}
  return readChartResponse(response);
}
export async function loadPublicMarket(input,deps,now=new Date()) {
  const choice=validateMarketChoice(input);if(choice.market_source!=='independent')throw new MarketDataError('Unabhängige Kursquelle wurde nicht ausgewählt.');
  let binding=null;
  if(choice.security_key) {
    const cached=await deps.readSecurity(choice.security_key);
    binding=Date.parse(cached?.expires_at)>now.getTime()?cached?.candidates?.find(c=>c.figi===choice.quote_figi&&c.market_symbol===input.symbol&&c.quote_symbol===choice.quote_symbol&&c.verification==='openfigi_mic'&&c.verified===true&&c.eodhd_verified===false):null;
    if(!binding)throw new MarketDataError('Eigene OpenFIGI-Zuordnung nicht mehr verfügbar oder falsches Symbol. WKN erneut suchen.');
  }
  const key=choice.quote_symbol+':'+input.currency,cached=await deps.readCache(key);
  let result;
  if(cached&&Date.parse(cached.fetched_at)<=now.getTime()&&Date.parse(cached.fetched_at)>now.getTime()-12*3600000) {
    try{const q=normalizeBars(cached.bars,now);if(q.ageDays<=4)result={bars:cached.bars,meta:cached.meta,warnings:cached.warnings||[],cached:true};}catch{}
  }
  if(!result) {
    if(!await deps.reserve())throw new MarketDataError('Eigenes Tageslimit für öffentliche Kursabfragen erreicht. Vorhandene CSV verwenden; das EODHD-Kontingent ist davon unabhängig.',429);
    result=parsePublicChart(await deps.fetchChart(choice.quote_symbol,'history'),choice.quote_symbol,now);
    assertQuoteBinding(result.meta,binding,input.currency);
    try{await deps.writeCache(key,{...result,fetched_at:now.toISOString()});}catch{result.warnings.push('Öffentliche Kurse geladen, eigener Kurscache nicht gespeichert.');}
  }
  if(result.meta?.symbol!==choice.quote_symbol)throw new MarketDataError('Gespeicherte Kurskennung passt nicht zur Anfrage. Quelle erneut laden oder CSV verwenden.');
  assertQuoteBinding(result.meta,binding,input.currency);
  return {bars:result.bars,provider:'Öffentliche Yahoo-Chartdaten · '+choice.quote_symbol,
    warning:result.warnings.join(' ')||null,
    provenance:{source:'independent',provider:'Yahoo public chart (inoffizielle Schnittstelle)',quote_symbol:choice.quote_symbol,analysis_symbol:input.symbol,currency:result.meta.currency,exchange:result.meta.exchange,timezone:result.meta.timezone,provider_name:result.meta.name,identity:binding?'OpenFIGI MIC/FIGI; Kurskennung abgeleitet und Nutzerbestätigung':'Manuell bestätigte Kurskennung',figi:binding?.figi||null,eodhd_used:false,cached:!!result.cached,price_basis:'OHLC/Adjusted Close auf Anbieterbasis, nur abgeschlossene Tage'}};
}
// Server adapters share an owner-scoped public cache. User CSV never enters this cache.
export function publicMarketAdapters(admin,userId,fetchImpl=fetch) {
  return {
    readSecurity:async key=>{const r=await admin.from('security_lookup_cache').select('result').eq('user_id',userId).eq('lookup_key',key).maybeSingle();if(r.error)throw new MarketDataError('V36-Wertpapiercache fehlt oder ist nicht lesbar.',503);return r.data?.result;},
    readCache:async key=>{const r=await admin.from('independent_market_cache').select('result').eq('user_id',userId).eq('cache_key',key).maybeSingle();if(r.error)throw new MarketDataError('V36-Kurscache fehlt. V36-SQL ausführen.',503);return r.data?.result;},
    reserve:async()=>{const r=await admin.rpc('reserve_independent_data',{p_user_id:userId,p_kind:'chart'});if(r.error)throw new MarketDataError('V36-Kursschema fehlt. V36-SQL ausführen.',503);return r.data===true;},
    fetchChart:(symbol,kind)=>fetchPublicChart(symbol,kind,fetchImpl),
    writeCache:async(key,result)=>{const r=await admin.from('independent_market_cache').upsert({user_id:userId,cache_key:key,result,updated_at:result.fetched_at});if(r.error)throw r.error;}
  };
}
