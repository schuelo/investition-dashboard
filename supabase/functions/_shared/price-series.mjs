import {depotDay} from './depot-input.mjs';
const isDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function cleanPricePoints(rows,{now=new Date(),allowToday=false}={}){
 const end=allowToday?depotDay(now):now.toISOString().slice(0,10),byDate=new Map();
 for(const p of Array.isArray(rows)?rows.slice(-4000):[]){const value=p?.value??p?.close;if(!isDay(p?.date)||p.date>end||!allowToday&&p.date===end||typeof value!=='number'||!Number.isFinite(value)||value<=0||value>1e12)continue;byDate.set(p.date,{date:p.date,value});}
 return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-2000);
}
function candidate(asset,row,snapshot,{now,source,kind='price_history',createdAt}={}){
 if(row.user_id!==asset.user_id||snapshot?.symbol!==asset.symbol||snapshot?.currency!==asset.currency)return null;
 const points=cleanPricePoints(snapshot.bars||snapshot.analysis?.history||snapshot.history,{now});
 if(!points.length)return null;return {asset_id:asset.id,symbol:asset.symbol,currency:asset.currency,status:'ready',kind,points,source:snapshot.provider||source,recorded_at:createdAt||row.updated_at||row.created_at||null,price_date:points.at(-1).date};
}
export function selectPriceSeries(asset,{caches=[],reviews=[],deep=[],signals=[],warnings=[]}={},now=new Date()){
 const ownReviews=reviews.filter(r=>r.user_id===asset.user_id&&r.asset_id===asset.id),candidates=[];
 for(const r of caches){if(r.symbol!==asset.symbol||r.currency!==asset.currency)continue;const c=candidate(asset,r,r.snapshot,{now,source:'Gespeicherte Tageskurse'});if(c)candidates.push(c);}
 for(const r of ownReviews){const c=candidate(asset,r,r.snapshot,{now,source:r.snapshot?.provider||'Gespeicherter Analysebericht'});if(c)candidates.push(c);}
 for(const [rows,label] of [[deep,'Ältere Deep-Analyse'],[signals,'Ältere Signalanalyse']])for(const r of rows){if(r.symbol!==asset.symbol||r.currency!==asset.currency)continue;const c=candidate(asset,r,r.raw_result,{now,source:r.raw_result?.provider||label});if(c)candidates.push(c);}
 candidates.sort((a,b)=>Number(b.points.length>=2)-Number(a.points.length>=2)||b.price_date.localeCompare(a.price_date)||b.points.length-a.points.length||String(b.recorded_at).localeCompare(String(a.recorded_at)));
 if(candidates.length)return {...candidates[0],warnings};
 const observed=ownReviews.filter(r=>r.snapshot?.symbol===asset.symbol&&r.snapshot.currency===asset.currency).map(r=>({date:r.snapshot.price_date,value:r.snapshot.price}));
 if(typeof asset.state?.price==='number')observed.push({date:asset.state.price_date,value:asset.state.price});
 const points=cleanPricePoints(observed,{now});
 if(points.length)return {asset_id:asset.id,symbol:asset.symbol,currency:asset.currency,status:'ready',kind:'observed_prices',points,source:'Gespeicherte Einzelkurse',price_date:points.at(-1).date,warnings};
 const manual=asset.valuation_override,manualPoints=manual?.source==='manual'?cleanPricePoints([{date:manual.price_date,value:manual.price}],{now,allowToday:true}):[];
 if(manualPoints.length)return {asset_id:asset.id,symbol:asset.symbol,currency:asset.currency,status:'ready',kind:'manual_valuation',points:manualPoints,source:'Eigene Bewertung · manuell',price_date:manualPoints[0].date,warnings};
 return {asset_id:asset.id,symbol:asset.symbol,currency:asset.currency,status:'missing',kind:null,points:[],source:null,price_date:null,warnings};
}
export async function loadPriceSeries(admin,owner,assets,now=new Date()){
 if(!assets.length)return [];
 const ids=assets.map(a=>a.id),symbols=[...new Set(assets.map(a=>a.symbol))],n=assets.length;
 const queries=[
  ['Kurscache',()=>admin.from('investment_market_cache').select('user_id,symbol,currency,snapshot,updated_at').eq('user_id',owner).in('symbol',symbols).order('updated_at',{ascending:false}).limit(n*5)],
  ['Analysehistorie',()=>admin.from('investment_reviews').select('user_id,asset_id,snapshot,created_at').eq('user_id',owner).in('asset_id',ids).order('created_at',{ascending:false}).limit(n*4)],
  ['Ältere Deep-Historie',()=>admin.from('deep_analyses').select('user_id,symbol,currency,raw_result,created_at').eq('user_id',owner).in('symbol',symbols).order('created_at',{ascending:false}).limit(n*3)],
  ['Ältere Signalhistorie',()=>admin.from('signal_simulations').select('user_id,symbol,currency,raw_result,created_at').eq('user_id',owner).in('symbol',symbols).order('created_at',{ascending:false}).limit(n*3)],
  ['Letzter Analysebericht',()=>admin.from('investment_reviews').select('user_id,asset_id,snapshot,created_at').eq('user_id',owner).in('id',assets.map(a=>a.latest_review_id).filter(Boolean)).limit(n)]
 ];
 const read=await Promise.allSettled(queries.map(async([label,query])=>{const r=await query();if(r.error)throw Error(label+' nicht verfügbar.');return r.data||[];}));
 const data=read.map(r=>r.status==='fulfilled'?r.value:[]),warnings=read.flatMap((r,i)=>r.status==='rejected'?[queries[i][0]+' nicht verfügbar.']:[]);
 return assets.map(a=>selectPriceSeries(a,{caches:data[0],reviews:[...data[1],...data[4]],deep:data[2],signals:data[3],warnings},now));
}
