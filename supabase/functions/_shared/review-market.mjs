import {normalizeBars} from './signal-engine.mjs';
import {loadPublicMarket,publicMarketAdapters} from './independent-market.mjs';
import {loadAlphaMarket,alphaMarketAdapters} from './review-alpha.mjs';
import {quoteStatus,ReviewError} from './investment-review.mjs';

export async function boundedJson(response,max=2200000){
  if(!response.ok)throw new ReviewError('Kursanbieter meldet HTTP '+response.status+'.',response.status);
  if(Number(response.headers.get('content-length')||0)>max)throw new ReviewError('Anbieterantwort zu groß.');
  const reader=response.body?.getReader();if(!reader)throw new ReviewError('Leere Anbieterantwort.');let size=0,text='';const decoder=new TextDecoder();
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw new ReviewError('Anbieterantwort zu groß.');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel();}
  try{return JSON.parse(text);}catch{throw new ReviewError('Anbieterantwort enthält keine Kursdaten.');}
}
export async function acquireReviewMarket(input,deps,now=new Date()){
  const cached=await deps.readCache(input,now),previousAttempt=cached?.attempt||null;
  let usable=null;try{if(cached?.symbol===input.symbol&&cached.currency===input.currency&&(!['independent','alphavantage'].includes(input.source)||cached.quote_symbol===input.quote_symbol)){normalizeBars(cached.bars,now);usable=cached;}}catch{}
  const current=usable&&quoteStatus(usable.bars.filter(b=>b.date<now.toISOString().slice(0,10)).at(-1)?.date,now).code==='current';
  if(input.source==='stored')return usable?{...usable,attempt:null,cached:true}:{attempt:null,warning:'Noch keine eigenen gespeicherten OHLCV-Kurse. Anbieter wählen oder CSV importieren.'};
  if(input.source==='csv'){
    normalizeBars(input.bars,now);const result={symbol:input.symbol,currency:input.currency,bars:input.bars.filter(b=>b.date<now.toISOString().slice(0,10)),provider:'CSV · eigene OHLCV-Daten',fetched_at:now.toISOString(),attempt:{status:'imported',at:now.toISOString()}};
    await deps.writeCache(input,result);return result;
  }
  if(current&&!deps.force)return {...usable,attempt:null,cached:true};
  if(cached?.retry_after&&Date.parse(cached.retry_after)>now.getTime())return {...(usable||{}),attempt:previousAttempt,retry_after:cached.retry_after,cached:!!usable,warning:'Anbieterpause bis '+cached.retry_after+'. Letzter gültiger Kurs bleibt bestehen.'};
  let requested=false;
  const mark=()=>{requested=true;};
  try{
    if(deps.allowNetwork===false)throw new ReviewError('Kursabruf in diesem Hintergrundlauf zurückgestellt; vorhandene Kurse und News werden geprüft.',429);
    const result=await deps.fetchSource(input,now,mark);
    normalizeBars(result.bars,now);
    const attempt=result.attempt||{status:requested?'success':'cache',at:now.toISOString()};
    const valid={...result,symbol:input.symbol,currency:input.currency,quote_symbol:input.quote_symbol,fetched_at:result.fetched_at||(attempt.status==='failed'?usable?.fetched_at:null)||now.toISOString(),attempt,
      ...(attempt.status==='failed'?{retry_after:new Date(now.getTime()+6*3600000).toISOString()}:quoteStatus(result.bars.filter(b=>b.date<now.toISOString().slice(0,10)).at(-1)?.date,now).code!=='current'?{retry_after:new Date(now.getTime()+3600000).toISOString()}: {})};
    await deps.writeCache(input,valid);return valid;
  }catch(e){
    const attempt={status:requested?'failed':'not_run',at:now.toISOString(),error:String(e.message||'Kursabruf fehlgeschlagen.').slice(0,700)},retry_after=requested?new Date(now.getTime()+(e.status===429?6*3600000:3600000)).toISOString():null;
    await deps.recordFailure(input,{attempt,retry_after});return {...(usable||{}),attempt,retry_after,cached:!!usable,warning:attempt.error};
  }
}
export function reviewMarketAdapters(admin,userId,{getEnv,fetchImpl=fetch,force=false,allowNetwork=true}={}){
  const get=async(input,asOf=new Date())=>{
    const q=admin.from('investment_market_cache').select('snapshot').eq('user_id',userId).eq('symbol',input.symbol).eq('currency',input.currency);
    const r=input.source==='stored'?await q.order('updated_at',{ascending:false}).limit(10):await q.eq('source',input.source).limit(1);
    if(r.error)throw new ReviewError('V38-Kurscache fehlt oder nicht erreichbar.',503);
    if(input.source==='stored'){
      const usable=(r.data||[]).flatMap(row=>{try{const s=row.snapshot;if(s.symbol!==input.symbol||s.currency!==input.currency)return[];const q=normalizeBars(s.bars,asOf);return[{snapshot:s,date:q.bars.at(-1).date}];}catch{return[];}}).sort((a,b)=>b.date.localeCompare(a.date));
      return usable[0]?.snapshot||r.data?.[0]?.snapshot||null;
    }
    return r.data?.[0]?.snapshot||null;
  };
  const put=async(input,snapshot)=>{
    const r=await admin.from('investment_market_cache').upsert({user_id:userId,symbol:input.symbol,currency:input.currency,source:input.source,snapshot,updated_at:new Date().toISOString()},{onConflict:'user_id,symbol,currency,source'});
    if(r.error)throw new ReviewError('Kursdaten konnten nicht gespeichert werden.',503);
  };
  return {force,allowNetwork,readCache:get,writeCache:put,
    recordFailure:async(input,failure)=>{const old=await get(input);await put(input,{...(old||{}),symbol:input.symbol,currency:input.currency,...failure});},
    fetchSource:async(input,now,mark)=>{
      if(input.source==='alphavantage'){
        const adapters=alphaMarketAdapters(admin,userId,getEnv('ALPHAVANTAGE_API_KEY'),fetchImpl),fetchChart=adapters.fetchChart;adapters.force=force;
        adapters.fetchChart=(...args)=>{mark();return fetchChart(...args);};
        return loadAlphaMarket({...input,market_source:'alphavantage'},adapters,now);
      }
      if(input.source==='independent'){
        const adapters=publicMarketAdapters(admin,userId,fetchImpl),fetchChart=adapters.fetchChart;adapters.force=force;
        adapters.fetchChart=(...args)=>{mark();return fetchChart(...args);};
        return loadPublicMarket({...input,market_source:'independent'},adapters,now);
      }
      if(input.source==='eodhd'){
        const key=getEnv('EODHD_API_TOKEN');if(!key)throw new ReviewError('EODHD-Schlüssel fehlt. Alpha Vantage oder CSV wählen.',503);
        const raw=getEnv('HYBRID_EODHD_DAILY_BUDGET'),limit=raw===''?6:Number(raw);
        if(!Number.isInteger(limit)||limit<=0||limit>20)throw new ReviewError('EODHD-Abrufe sind deaktiviert oder das gemeinsame Budget ist ungültig.',429);
        const q=await admin.rpc('reserve_hybrid_eodhd_calls',{p_calls:1,p_daily_limit:limit});if(q.error||q.data!==true)throw new ReviewError('Gemeinsames EODHD-Tagesbudget nicht verfügbar. Keine EODHD-Anfrage gesendet.',429);
        const endpoint=new URL('https://eodhd.com/api/eod/'+encodeURIComponent(input.symbol));endpoint.search=new URLSearchParams({api_token:key,fmt:'json',period:'d',order:'a',from:new Date(now.getTime()-365*86400000).toISOString().slice(0,10)}).toString();
        mark();let bars;try{bars=await boundedJson(await fetchImpl(endpoint,{redirect:'error',signal:AbortSignal.timeout(15000)}));}catch(e){if(e instanceof ReviewError)throw e;throw new ReviewError('EODHD-Verbindung fehlgeschlagen. Keine automatische Wiederholung.',503);}normalizeBars(bars,now);
        return {bars,provider:'EODHD EOD · '+input.symbol};
      }
      throw new ReviewError('Kursquelle nicht unterstützt.');
    }};
}
