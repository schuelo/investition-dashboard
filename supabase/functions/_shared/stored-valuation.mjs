import {cleanPricePoints} from './price-series.mjs';
import {valuationQuote} from './portfolio-value.mjs';
// Reuse genuine, already stored closing prices for valuation only. No model, provider call or asset mutation.
export function storedValuationFor(asset,{caches=[],reviews=[],legacy=[]}={},now=new Date()){
 if(asset.valuation_override?.source==='manual')return null;
 const existing=valuationQuote(asset,now),quotes=[];
 const add=(row,snapshot)=>{if(row.user_id!==asset.user_id||snapshot?.symbol!==asset.symbol||snapshot.currency!==asset.currency)return;const points=cleanPricePoints([...(Array.isArray(snapshot.bars)?snapshot.bars:Array.isArray(snapshot.analysis?.history)?snapshot.analysis.history:Array.isArray(snapshot.history)?snapshot.history:[]),{date:snapshot.price_date,value:snapshot.price??snapshot.chart?.price}],{now}),last=points.at(-1);if(last)quotes.push({...last,provider:snapshot.provider||'Gespeicherte Tageskurse'});};
 for(const row of caches)if(row.symbol===asset.symbol&&row.currency===asset.currency)add(row,row.snapshot);
 for(const row of reviews)if(row.asset_id===asset.id)add(row,row.snapshot);
 for(const row of legacy)if(row.symbol===asset.symbol&&row.currency===asset.currency)add(row,row.raw_result||{symbol:row.stored_symbol,currency:row.stored_currency,history:row.history,price_date:row.price_date,price:row.price,provider:row.provider});
 quotes.sort((a,b)=>b.date.localeCompare(a.date));const last=quotes[0];
 if(!last||existing.price!==null&&last.date<=existing.price_date)return null;
 return {price:last.value,price_date:last.date,provider:'Gespeicherte Historie · '+last.provider,valuation_from_history:true};
}
export async function loadValuationAssets(admin,owner,assets,held,now=new Date()){
 const missing=assets.filter(a=>a.user_id===owner&&a.valuation_override?.source!=='manual'&&held.some(p=>p.symbol===a.symbol&&p.currency===a.currency)&&valuationQuote(a,now).status!=='current').slice(0,72),reused=new Map(),warnings=[];
 for(let i=0;i<missing.length;i+=24){const batch=missing.slice(i,i+24),symbols=[...new Set(batch.map(a=>a.symbol))],ids=batch.map(a=>a.latest_review_id).filter(Boolean);
  const reads=await Promise.allSettled([
   admin.from('investment_market_cache').select('user_id,symbol,currency,snapshot,updated_at').eq('user_id',owner).in('symbol',symbols).order('updated_at',{ascending:false}).limit(batch.length*5),
   ids.length?admin.from('investment_reviews').select('user_id,asset_id,snapshot').eq('user_id',owner).in('id',ids).limit(batch.length):Promise.resolve({data:[],error:null})
  ]);
  const rows=reads.map(r=>r.status==='fulfilled'&&!r.value.error?r.value.data||[]:[]);if(reads.some(r=>r.status==='rejected'||r.value?.error))warnings.push('Ein Teil der gespeicherten Bewertungskurse ist nicht erreichbar.');
  for(const a of batch){const q=storedValuationFor(a,{caches:rows[0],reviews:rows[1]},now);if(q)reused.set(a.id,{...a,state:{...a.state,...q}});}
  const older=batch.filter(a=>valuationQuote(reused.get(a.id)||a,now).status!=='current');
  if(older.length){
   // Project only historical prices and metadata; omit large model paths and source documents.
   const fields='user_id,symbol,currency,stored_symbol:raw_result->>symbol,stored_currency:raw_result->>currency,history:raw_result->history,price_date:raw_result->>price_date,price:raw_result->chart->price,provider:raw_result->>provider',names=[...new Set(older.map(a=>a.symbol))];
   const old=await Promise.allSettled(['deep_analyses','signal_simulations'].map(table=>admin.from(table).select(fields).eq('user_id',owner).in('symbol',names).order('created_at',{ascending:false}).limit(older.length*3))),legacy=old.flatMap(r=>r.status==='fulfilled'&&!r.value.error?r.value.data||[]:[]);
   for(const a of older){const base=reused.get(a.id)||a,q=storedValuationFor(base,{legacy},now);if(q)reused.set(a.id,{...a,state:{...a.state,...q}});}
  }
 }
 return {assets:assets.map(a=>reused.get(a.id)||a),reused:reused.size,warnings:[...new Set(warnings)]};
}
