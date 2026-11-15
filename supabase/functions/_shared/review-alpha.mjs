import {normalizeBars} from './signal-engine.mjs';
import {MarketDataError,validateMarketChoice,alphaSymbolFor} from './review-market-input.mjs';

const fail=(message,status=422)=>new MarketDataError(message,status);
const keyValid=key=>typeof key==='string'&&key.trim()!==''&&key!=='demo'&&key.length<=200&&!/\s/.test(key);
function providerError(payload) {
  const notice=payload?.Information||payload?.Note||payload?.['Error Message'];if(!notice)return;
  const text=String(notice);
  if(/limit|frequency|requests? per|rate|25 requests/i.test(text))throw fail('Alpha Vantage hat sein eigenes Abruflimit erreicht. CSV verwenden oder später erneut manuell versuchen.',429);
  if(/premium|subscription|subscribe/i.test(text))throw fail('Alpha Vantage gibt diesen Abruf im vorhandenen Tarif nicht frei. Es wird kein Bezahlabruf gestartet; CSV verwenden.',403);
  if(/api.?key/i.test(text))throw fail('Alpha-Vantage-Schlüssel nicht freigegeben. ALPHAVANTAGE_API_KEY in Supabase prüfen.',503);
  throw fail('Alpha Vantage liefert für diese Kennung keine verwertbaren Daten. Notierung prüfen oder CSV verwenden.');
}
function verifyMeta(meta,input) {
  const expected=alphaSymbolFor(input.symbol);
  if(!expected)throw fail('Alpha Vantage ist hier zunächst für XETRA und US eingerichtet. Andere Handelsplätze mit CSV analysieren.');
  if(meta?.symbol!==input.quote_symbol||meta.symbol!==expected)throw fail('Alpha-Vantage-Kennung passt nicht zur Analysekennung. Xetra nutzt .DEX; US nutzt den Ticker ohne .US.');
  const region=input.symbol.endsWith('.XETRA')?'Germany':'United States';
  if(meta.region!==region)throw fail('Alpha-Vantage-Region passt nicht zum ausgewählten Handelsplatz. Keine automatische Börsenumschaltung.');
  if(meta.currency!==input.currency)throw fail('Alpha Vantage meldet '+meta.currency+' statt '+input.currency+'. Währung prüfen; keine automatische Umrechnung.');
}
export function parseAlphaSearch(payload,input) {
  providerError(payload);
  const rows=payload?.bestMatches;if(!Array.isArray(rows))throw fail('Alpha-Vantage-Stammdaten fehlen. Kurskennung prüfen oder CSV verwenden.');
  const matches=rows.filter(r=>String(r?.['1. symbol']||'').toUpperCase()===input.quote_symbol);
  if(matches.length!==1)throw fail('Keine eindeutige exakte Alpha-Vantage-Notierung gefunden. Es wird kein ähnlicher Ticker eingesetzt.');
  const row=matches[0],type=String(row['3. type']||'');
  if(!/^(equity|etf|mutual fund)$/i.test(type))throw fail('Alpha-Vantage-Treffer ist keine unterstützte Aktie/ETF/Fondsnotierung.');
  const meta={symbol:input.quote_symbol,name:String(row['2. name']||'').slice(0,160),region:String(row['4. region']||''),currency:String(row['8. currency']||'').toUpperCase(),type};
  verifyMeta(meta,input);return meta;
}
export function parseAlphaDaily(payload,symbol,now=new Date()) {
  providerError(payload);const meta=payload?.['Meta Data'],series=payload?.['Time Series (Daily)'];
  if(String(meta?.['2. Symbol']||'').toUpperCase()!==symbol||!series||typeof series!=='object'||Array.isArray(series))throw fail('Alpha-Vantage-Tageskurse passen nicht zur ausgewählten Kennung.');
  const entries=Object.entries(series);if(entries.length>100)throw fail('Unerwartete Alpha-Vantage-Antwort: nur compact mit höchstens 100 Kerzen wird verwendet.');
  const zone=String(meta['5. Time Zone']||'');try{if(!zone)throw Error();new Intl.DateTimeFormat('en',{timeZone:zone}).format(now);}catch{throw fail('Börsenzeitzone der Alpha-Vantage-Tageskurse fehlt oder ist ungültig.');}
  const bars=entries.map(([date,row])=>{
    if(!row||typeof row!=='object')throw fail('Alpha-Vantage-Kurszeile ungültig.');
    const number=field=>row[field]===undefined||row[field]===null||row[field]===''?NaN:Number(row[field]);
    return {date,open:number('1. open'),high:number('2. high'),low:number('3. low'),close:number('4. close'),volume:number('5. volume')};
  }).sort((a,b)=>a.date.localeCompare(b.date));
  // The common engine validates even excluded rows, then removes today's/future bars.
  try{normalizeBars(bars,now);}catch(e){throw fail('Alpha-Vantage-OHLCV nicht ausreichend: '+e.message);}
  return {bars:bars.filter(b=>b.date<now.toISOString().slice(0,10)),timezone:zone};
}
async function readJson(response) {
  if(!response.ok)throw fail(response.status===429?'Alpha Vantage hat sein eigenes Abruflimit erreicht. CSV verwenden oder später erneut versuchen.':'Alpha Vantage derzeit nicht erreichbar (HTTP '+response.status+'). CSV verwenden.',response.status===429?429:422);
  if(Number(response.headers.get('content-length')||0)>500000)throw fail('Alpha-Vantage-Antwort zu groß.');
  const reader=response.body?.getReader();if(!reader)throw fail('Alpha-Vantage-Antwort ist leer.');
  let text='',size=0;const decoder=new TextDecoder();try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>500000)throw fail('Alpha-Vantage-Antwort zu groß.');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel();}
  try{return JSON.parse(text);}catch{throw fail('Alpha Vantage lieferte keine JSON-Kursdaten. CSV verwenden.');}
}
export async function fetchAlpha(symbol,kind,key,fetchImpl=fetch) {
  if(!keyValid(key))throw fail('Kostenlosen Alpha-Vantage-Schlüssel als ALPHAVANTAGE_API_KEY in Supabase hinterlegen. Der allgemeine Demo-Schlüssel wird nicht verwendet.',503);
  if(!/^[A-Z0-9][A-Z0-9.\-]{0,39}$/.test(symbol))throw fail('Alpha-Vantage-Kennung ungültig.');
  if(!['metadata','history'].includes(kind))throw fail('Alpha-Vantage-Abfragetyp ungültig.');
  const url=new URL('https://www.alphavantage.co/query');
  url.search=new URLSearchParams(kind==='metadata'?{function:'SYMBOL_SEARCH',keywords:symbol,apikey:key}:{function:'TIME_SERIES_DAILY',symbol,outputsize:'compact',datatype:'json',apikey:key}).toString();
  let response;try{response=await fetchImpl(url,{redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});}catch{throw fail('Alpha-Vantage-Verbindung fehlgeschlagen. CSV verwenden; keine automatische Wiederholung.');}
  return readJson(response);
}
export async function loadAlphaMarket(input,deps,now=new Date()) {
  const choice=validateMarketChoice(input);if(choice.market_source!=='alphavantage')throw fail('Alpha Vantage wurde nicht ausgewählt.');
  const expected=alphaSymbolFor(input.symbol);if(!expected||expected!==choice.quote_symbol)throw fail('Alpha-Vantage-Kennung passt nicht. Für Xetra z. B. SND.DEX, für US z. B. NVDA bestätigen.');
  let binding=null;
  if(choice.security_key){const cached=await deps.readSecurity(choice.security_key);binding=Date.parse(cached?.expires_at)>now.getTime()?cached?.candidates?.find(c=>c.verified===true&&c.eodhd_verified===false&&c.verification==='openfigi_mic'&&c.figi===choice.quote_figi&&c.market_symbol===input.symbol):null;if(!binding)throw fail('Eigene OpenFIGI-Zuordnung fehlt oder passt nicht. WKN erneut suchen.');}
  if(!deps.configured)throw fail('Alpha Vantage ist noch nicht eingerichtet. Kostenlosen Schlüssel in Supabase als ALPHAVANTAGE_API_KEY hinterlegen.',503);
  const key='AV:'+choice.quote_symbol+':'+input.currency,cached=await deps.readCache(key);let old=null,verifiedCache=null;
  if(cached?.schema==='alphavantage-compact-v1'&&Date.parse(cached.fetched_at)<=now.getTime()){
    try{verifyMeta(cached.meta,input);const q=normalizeBars(cached.bars,now);verifiedCache=cached;if(q.ageDays<=4)old=cached;}catch{}
  }
  let attempt=null;
  let result=old&&Date.parse(old.fetched_at)>now.getTime()-12*3600000?{...old,cached:true}:null;
  if(!result){
    let meta=verifiedCache&&Date.parse(verifiedCache.meta_at)>now.getTime()-7*86400000?verifiedCache.meta:null;
    const request=async kind=>{if(!await deps.reserve())throw fail('Gemeinsames Alpha-Vantage-Schutzlimit von 25 API-Aufrufen pro UTC-Tag erreicht. CSV verwenden oder später erneut starten.',429);return deps.fetchChart(choice.quote_symbol,kind);};
    try{
      if(!meta)meta=parseAlphaSearch(await request('metadata'),input);
      const daily=parseAlphaDaily(await request('history'),choice.quote_symbol,now);
      result={schema:'alphavantage-compact-v1',...daily,meta,meta_at:meta===verifiedCache?.meta?verifiedCache.meta_at:now.toISOString(),fetched_at:now.toISOString()};
      attempt={status:'success',at:now.toISOString()};
      try{await deps.writeCache(key,result);}catch{result.cache_warning='Kurse geladen, eigener Alpha-Vantage-Cache nicht gespeichert.';}
    }catch(e){attempt={status:'failed',at:now.toISOString(),error:e.message};if(old&&[429,503].includes(e?.status))result={...old,cached:true,cache_warning:'Aktueller Alpha-Vantage-Abruf nicht verfügbar; geprüften eigenen Cache verwendet. Datenstand beachten.'};else throw e;}
  }
  return {attempt,bars:result.bars,provider:'Alpha Vantage · '+choice.quote_symbol,warning:['Alpha Vantage Free: höchstens 100 Tageskerzen; unadjustierte OHLCV. Lange Vergleiche/SMA200 können fehlen.',...(result.cache_warning?[result.cache_warning]:[])].join(' '),
    provenance:{source:'alphavantage',provider:'Alpha Vantage TIME_SERIES_DAILY compact',quote_symbol:choice.quote_symbol,analysis_symbol:input.symbol,currency:result.meta.currency,exchange:input.symbol.endsWith('.XETRA')?'XETRA':'US-Sammelnotierung',timezone:result.timezone,provider_name:result.meta.name,identity:binding?'OpenFIGI-Identität; exaktes Anbietersymbol, Region und Währung geprüft':'Manuell bestätigte Zuordnung; exaktes Anbietersymbol, Region und Währung geprüft',figi:binding?.figi||null,eodhd_used:false,cached:!!result.cached,price_basis:'Unadjustierte Tages-OHLCV, höchstens 100 Kerzen; nur vor dem heutigen Datum'}};
}
export function alphaMarketAdapters(admin,userId,key,fetchImpl=fetch) {
  return {...publicAdapters(admin,userId),configured:keyValid(key),
    reserve:async()=>{const r=await admin.rpc('reserve_alphavantage_call',{p_calls:1});if(r.error)throw fail('V38-Quotenschema fehlt. setup-v38-investment-review.sql ausführen.',503);return r.data===true;},
    fetchChart:(symbol,kind)=>fetchAlpha(symbol,kind,key,fetchImpl)};
}
function publicAdapters(admin,userId) {
  // This provider uses its own AV: cache namespace; no CSV or EODHD cache is read.
  return {
    readSecurity:async key=>{const r=await admin.from('security_lookup_cache').select('result').eq('user_id',userId).eq('lookup_key',key).maybeSingle();if(r.error)throw fail('Eigene WKN-Zuordnung nicht lesbar. V36-Schema prüfen.',503);return r.data?.result;},
    readCache:async key=>{const r=await admin.from('independent_market_cache').select('result').eq('user_id',userId).eq('cache_key',key).maybeSingle();if(r.error)throw fail('V36-Kurscache fehlt. Gesamt-SQL ausführen.',503);return r.data?.result;},
    writeCache:async(cache_key,result)=>{const r=await admin.from('independent_market_cache').upsert({user_id:userId,cache_key,result,updated_at:result.fetched_at});if(r.error)throw r.error;}
  };
}
