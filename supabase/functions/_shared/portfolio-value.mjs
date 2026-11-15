import {quoteStatus} from './investment-review.mjs';
export function portfolioValues(positions,assets,now=new Date()){
  const groups=new Map(),excluded=[];
  for(const p of positions){
    const quantity=Math.abs(Number(p.quantity)||0),key=p.symbol+'|'+p.currency;
    if(!quantity)continue;if(!Number.isFinite(quantity)||!Number.isFinite(quantity*Number(p.average_entry_price||1))||!p.currency||!p.symbol){excluded.push(p.id);continue;}
    if(!/^(Aktie|ETF|Stock|Equity)$/i.test(p.instrument_type)||String(p.direction).toLowerCase()!=='long'){excluded.push(p.id);continue;}
    if(!groups.has(p.currency))groups.set(p.currency,{currency:p.currency,amount:0,cost_basis:0,missing:0,stale:0,positions:0,price_dates:[],components:[]});
    const g=groups.get(p.currency),asset=assets.find(a=>a.symbol===p.symbol&&a.currency===p.currency),s=asset?.state||{},q=quoteStatus(s.price_date,now);
    g.positions++;
    if(typeof s.price!=='number'||!Number.isFinite(s.price)||s.price<=0||q.code==='missing'){g.missing++;g.components.push([key,quantity,null]);continue;}
    g.amount+=quantity*s.price;if(q.code!=='current')g.stale++;
    const cost=Number(p.average_entry_price);g.cost_basis=g.cost_basis!==null&&Number.isFinite(cost)&&cost>0?g.cost_basis+quantity*cost:null;
    g.price_dates.push({symbol:p.symbol,date:s.price_date});g.components.push([key,quantity,s.price,s.price_date,cost>0?cost:null]);
  }
  return {groups:[...groups.values()].map(g=>({...g,cost_basis:g.missing?null:g.cost_basis,components:g.components.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))})),excluded:excluded.length};
}
