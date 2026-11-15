// A saved plan is not evidence of a filled order. Only explicit open/partial status plus positive units establishes a legacy holding.
export const isEquity=p=>/^(Aktie|ETF|Stock|Equity)$/i.test(p.instrument_type||'Aktie');
export const isClosedPlan=p=>/^(geschlossen|position geschlossen|verkauft|verworfen|beendet|archiviert|closed|sold)$/i.test(String(p.status||'').trim());
export const isLegacyHolding=p=>!isClosedPlan(p)&&/^(position offen|teilverkauf|open|partially sold)$/i.test(String(p.status||'').trim())&&Number.isFinite(Number(p.quantity))&&Number(p.quantity)>0;
export function planIdentity(p){
  let symbol=String(p.market_symbol||p.symbol||'').trim().toUpperCase();
  if(!/^[A-Z0-9_^+\-]{1,25}\.[A-Z0-9]{1,12}$/.test(symbol)){
    const m=/^XETR:([A-Z0-9_^+\-]{1,25})$/.exec(String(p.symbol||'').toUpperCase());symbol=m?m[1]+'.XETRA':symbol;
  }
  return {symbol,currency:String(p.currency||'').trim().toUpperCase(),company:p.name||'',direction:p.direction||'Unknown',instrument_type:p.instrument_type||'Aktie',stop:p.stop_price,target:p.target1};
}
export function mappedPlan(p,assets){
  const a=assets.find(a=>a.user_id===p.user_id&&a.legacy_trade_ids?.includes(p.id));
  return a?{...planIdentity(p),symbol:a.symbol,currency:a.currency,company:a.company||p.name||''}:planIdentity(p);
}
export function mergedPositions(rows,plans,assets,links){
  const positions=rows.filter(p=>p.is_open!==false).map(p=>{
    const plan=plans.find(t=>t.id===p.trade_id&&t.user_id===p.user_id),base={...p,...planIdentity({...plan,...p,name:p.name||plan?.name,symbol:p.symbol||plan?.symbol,currency:p.currency||plan?.currency,market_symbol:p.market_symbol||plan?.market_symbol,instrument_type:p.instrument_type||plan?.instrument_type,direction:p.direction||plan?.direction}),position_origin:'depot_positions'};
    const link=links.find(l=>l.position_id===p.id&&l.user_id===p.user_id),asset=assets.find(a=>a.id===link?.asset_id&&a.user_id===p.user_id);
    return asset?{...base,symbol:asset.symbol,currency:asset.currency,company:asset.company}:base;
  });
  for(const p of plans){
    if(!isLegacyHolding(p)||rows.some(r=>r.user_id===p.user_id&&r.trade_id===p.id))continue;
    positions.push({...p,...mappedPlan(p,assets),id:p.id,trade_id:p.id,position_origin:'legacy_plan',average_entry_price:Number(p.average_entry_price)>0?Number(p.average_entry_price):null,is_open:true});
  }
  return positions;
}
