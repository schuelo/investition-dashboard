import {quoteStatus} from './investment-review.mjs';
import {depotDay} from './depot-input.mjs';
const positive=value=>Number.isFinite(Number(value))&&Number(value)>0;
const supported=p=>/^(Aktie|ETF|Stock|Equity)$/i.test(p.instrument_type)&&String(p.direction).toLowerCase()==='long';
export function valuationQuote(asset,now=new Date()){
 const manual=asset?.valuation_override?.source==='manual',source=manual?asset.valuation_override:asset?.state||{};let q=quoteStatus(source.price_date,now);
 // A user's dated valuation may be intraday. It is never substituted for closed OHLCV chart data.
 if(manual&&/^\d{4}-\d{2}-\d{2}$/.test(source.price_date||'')&&Number.isFinite(Date.parse(source.price_date))&&new Date(source.price_date).toISOString().slice(0,10)===source.price_date&&source.price_date<=depotDay(now))q={...q,code:source.price_date>=q.expected?'current':'stale'};
 return {price:positive(source.price)&&q.code!=='missing'?Number(source.price):null,price_date:source.price_date||null,manual,source:manual?'Manuell erfasst':source.provider||'Gespeicherter Anbieter-Kurs',status:q.code,...(source.valuation_from_history?{from_history:true}:{})};
}
export function holdingSummary(rows,asset,now=new Date()){
 const all=rows.filter(p=>p.symbol===asset.symbol&&p.currency===asset.currency),included=all.filter(p=>supported(p)&&positive(p.quantity)),quantity=included.reduce((s,p)=>s+Number(p.quantity),0);
 const invested=included.length&&included.every(p=>positive(p.average_entry_price))?included.reduce((s,p)=>s+Number(p.quantity)*Number(p.average_entry_price),0):null,quote=valuationQuote(asset,now),amount=quantity&&quote.price!==null?quantity*quote.price:null;
 const pnl=amount!==null&&invested!==null?amount-invested:null;
 return {asset_id:asset.id,symbol:asset.symbol,currency:asset.currency,positions:all.length,excluded:all.length-included.length,quantity:quantity||null,average_entry_price:quantity&&invested!==null?invested/quantity:null,invested,amount,pnl,pnl_pct:pnl!==null&&invested>0?pnl/invested*100:null,quote,
  lots:all.map(p=>({id:p.id,trade_id:p.trade_id,position_origin:p.position_origin,quantity:p.quantity,average_entry_price:p.average_entry_price,entry_date:p.entry_date||null,direction:p.direction,instrument_type:p.instrument_type}))};
}
export function portfolioValues(positions,assets,now=new Date()){
 const groups=new Map(),excluded=[];
 for(const p of positions){
  const quantity=Math.abs(Number(p.quantity)||0),key=p.symbol+'|'+p.currency;
  if(!quantity)continue;
  if(!Number.isFinite(quantity)||!Number.isFinite(quantity*Number(p.average_entry_price||1))||!p.currency||!p.symbol||!supported(p)){excluded.push(p.id);continue;}
  if(!groups.has(p.currency))groups.set(p.currency,{currency:p.currency,amount:0,cost_basis:0,invested:0,entry_missing:0,missing:0,stale:0,manual:0,positions:0,price_dates:[],components:[]});
  const g=groups.get(p.currency),asset=assets.find(a=>a.symbol===p.symbol&&a.currency===p.currency),quote=valuationQuote(asset,now),cost=Number(p.average_entry_price);
  g.positions++;
  if(positive(cost))g.invested+=quantity*cost;else g.entry_missing++;
  if(quote.price===null){g.missing++;g.components.push([key,quantity,null,cost>0?cost:null]);continue;}
  g.amount+=quantity*quote.price;if(quote.status!=='current')g.stale++;if(quote.manual)g.manual++;
  g.cost_basis=g.cost_basis!==null&&positive(cost)?g.cost_basis+quantity*cost:null;
  g.price_dates.push({symbol:p.symbol,date:quote.price_date,source:quote.source});g.components.push([key,quantity,quote.price,quote.price_date,cost>0?cost:null,quote.source]);
 }
 return {groups:[...groups.values()].map(g=>({...g,amount:g.positions===g.missing?null:g.amount,cost_basis:g.missing?null:g.cost_basis,invested:g.entry_missing?null:g.invested,components:g.components.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))})),
  holdings:assets.map(a=>holdingSummary(positions,a,now)).filter(s=>s.positions>0),excluded:excluded.length};
}
