import { normalizeBars, technicals } from './signal-engine.mjs';

// Deliberately no Gemini, broker, news-write or real-portfolio dependency.
export const PAPER_VERSION='33.0';
export const ACCOUNT_NAMES={chart:'Chartregeln',hybrid:'KI + Chartregeln',hold:'Buy-and-Hold'};
export function configPaper(input={}) {
  const symbols=String(input.symbols || '').toUpperCase().split(/[\s,;]+/).filter(Boolean);
  if(!symbols.length || symbols.length>3 || new Set(symbols).size!==symbols.length || symbols.some(s=>! /^[A-Z0-9-]{1,16}\.(XETRA|US)$/.test(s))) throw Error('1–3 eindeutige Symbole mit .XETRA oder .US eingeben.');
  const venue=symbols[0].split('.').at(-1),currency=venue==='US'?'USD':'EUR';
  if(symbols.some(s=>!s.endsWith('.'+venue)) || input.currency!==currency) throw Error('Nur eine Börse und Währung je Experiment: XETRA/EUR oder US/USD.');
  const capital=Number(input.capital),fee_bps=Number(input.fee_bps),slippage_bps=Number(input.slippage_bps);
  if(!Number.isFinite(capital)||capital<1000||capital>10000000 || !Number.isFinite(fee_bps)||fee_bps<0||fee_bps>100 || !Number.isFinite(slippage_bps)||slippage_bps<0||slippage_bps>100) throw Error('Kapital 1.000–10.000.000; Kosten und Slippage jeweils 0–100 Basispunkte.');
  return {version:PAPER_VERSION,symbols,currency,capital,fee_bps,slippage_bps,risk_pct:.5,max_position_pct:20,stop_atr:2,reward_risk:2,max_hold_sessions:20,ai_max_age_days:7};
}
export function newPaper(config,now=new Date()) {
  return {version:PAPER_VERSION,started_at:now.toISOString(),last_session:null,anchors:{},accounts:Object.fromEntries(Object.keys(ACCOUNT_NAMES).map(k=>[k,{cash:config.capital,positions:{},pending:[],costs:0,peak:config.capital,drawdown:0}])),signals:[],last_update:null};
}
export function marketOpen(symbol,date) {
  const us=symbol.endsWith('.US'),zone=us?'America/New_York':'Europe/Berlin';
  const target=Date.parse(date+'T'+(us?'09:30':'09:00')+':00Z');let utc=target;
  for(let i=0;i<3;i++) {
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(utc)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    utc+=target-Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
  }
  return utc;
}
function rawBars(rows,now) {
  const quality=normalizeBars(rows,now); // Validate every supplied row before retaining raw execution prices.
  if(quality.ageDays>4 || quality.unresolvedJump) throw Error('Kursdaten zu alt oder ungeklärter Kurssprung. Aktualisierung ohne Buchung abgebrochen.');
  const today=now.toISOString().slice(0,10);
  const bars=rows.filter(r=>String(r.date).slice(0,10)<today).map(r=>({date:String(r.date).slice(0,10),open:+r.open,high:+r.high,low:+r.low,close:+r.close,volume:r.volume==null||r.volume===''?null:+r.volume,factor:r.adjusted_close==null?1:+r.adjusted_close/+r.close})).sort((a,b)=>a.date.localeCompare(b.date));
  if(new Set(bars.map(b=>b.date)).size!==bars.length) throw Error('Doppelte Kurstage.');
  if(bars.some(b=>[0,6].includes(new Date(b.date+'T00:00Z').getUTCDay()))) throw Error('Wochenend-Kerzen sind für XETRA/US-Aktien keine regulären Handelstage. CSV prüfen.');
  return bars;
}
export function eligibleAI(analyses,symbol,currency,now,priceDate) {
  return analyses.filter(a=>a.symbol===symbol && a.currency===currency && a.narrative?.mode==='ai' && a.ai?.provider==='gemini' && a.narrative.evidence?.length && !a.quality?.blocked && a.price_date<=priceDate && now-Date.parse(a.created_at)>=0 && now-Date.parse(a.created_at)<=7*86400000 && Date.parse(priceDate)-Date.parse(a.price_date)<=7*86400000).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))[0] || null;
}
export function updatePaper(config,original,market,analyses=[],now=new Date()) {
  const state=structuredClone(original),events=[],nav=[];
  const stamp=now.toISOString(),emit=(account,type,symbol,details={})=>{state.event_sequence=(state.event_sequence||0)+1;events.push({event_key:String(state.event_sequence),recorded_at:stamp,account,type,symbol,...details});};
  const series=Object.fromEntries(config.symbols.map(s=>[s,rawBars(market[s] || [],now)]));
  const latest=config.symbols.map(s=>series[s].at(-1).date);
  if(new Set(latest).size!==1) throw Error('Unterschiedliche letzte Kurstage: keine vergleichbare Bewertung möglich.');
  const last=latest[0];
  for(const s of config.symbols) {
    const anchor=state.anchors[s];
    if(anchor) {
      const b=series[s].find(b=>b.date===anchor.date);
      if(!b || ['open','high','low','close'].some(k=>Math.abs(b[k]/anchor[k]-1)>1e-6) || Math.abs(b.factor/anchor.factor-1)>.005) throw Error('Kursrevision/Kapitalmaßnahme bei '+s+'. Keine rückwirkende Umbuchung; neues Experiment oder Datenprüfung erforderlich.');
    }
    const future=series[s].filter(b=>!state.last_session || b.date>state.last_session);
    let previous=anchor?.close;
    for(const b of future){if(anchor && Math.abs(b.factor/anchor.factor-1)>.005)throw Error('Mögliche Kapitalmaßnahme bei '+s+'. Keine Verbuchung.');if(previous && (Math.abs(b.open/previous-1)>.35 || Math.abs(b.close/previous-1)>.35))throw Error('Großer Kurssprung bei '+s+': manuelle Prüfung erforderlich.');previous=b.close;}
  }
  if(state.last_session && last<state.last_session) throw Error('Kursdaten liegen vor dem letzten verbuchten Tag.');
  const dates=state.last_session ? series[config.symbols[0]].filter(b=>b.date>state.last_session).map(b=>b.date) : [];
  if(dates.length>90) throw Error('Mehr als 90 versäumte Sitzungen. Experiment pausiert; Daten prüfen.');
  if(config.symbols.some(s=>dates.some(d=>!series[s].some(b=>b.date===d)))) throw Error('Fehlende gemeinsame Handelstage; keine Teilbuchung.');
  const fee=n=>n*config.fee_bps/10000,slip=config.slippage_bps/10000;
  const equity=(a,prices)=>a.cash+Object.entries(a.positions).reduce((v,[s,p])=>v+p.qty*prices[s].close,0);
  function sell(key,a,s,raw,reason,date,ambiguous=false) {
    const p=a.positions[s],price=raw*(1-slip),gross=p.qty*price,cost=fee(gross);
    a.cash+=gross-cost;a.costs+=cost+p.qty*raw*slip;
    emit(key,'SELL',s,{date,qty:p.qty,price,fee:cost,reason,ambiguous,pnl:gross-cost-p.basis});delete a.positions[s];
    a.pending=a.pending.filter(o=>o.symbol!==s);
  }
  for(const date of dates) {
    const prices=Object.fromEntries(config.symbols.map(s=>[s,series[s].find(b=>b.date===date)]));
    for(const [key,a] of Object.entries(state.accounts)) {
      const orders=[...a.pending];
      for(const o of orders) {
        if(marketOpen(o.symbol,date)<=Date.parse(o.created_at)) continue;
        const b=prices[o.symbol];
        if(date>o.expires_on){a.pending=a.pending.filter(x=>x!==o);emit(key,'EXPIRED',o.symbol,{date,reason:'Order nach 7 Kalendertagen abgelaufen.'});continue;}
        a.pending=a.pending.filter(x=>x!==o);
        if(o.side==='sell') {if(a.positions[o.symbol])sell(key,a,o.symbol,b.open,o.reason,date);continue;}
        if(a.positions[o.symbol])continue;
        const price=b.open*(1+slip);
        // Stops and risk budget were known when the order was recorded, not derived from this future bar.
        if(o.stop!=null && (price<=o.stop || price>=o.target)){emit(key,'SKIP',o.symbol,{date,reason:'Eröffnung außerhalb des geplanten Stop-/Zielbereichs.'});continue;}
        const budget=Math.min(a.cash,o.budget),riskQty=o.stop==null?Infinity:o.risk_budget/(price-o.stop);
        const qty=Math.floor(Math.min(budget/(price*(1+config.fee_bps/10000)),riskQty)*1e6)/1e6;
        if(!(qty>0))continue;
        const gross=qty*price,cost=fee(gross);a.cash-=gross+cost;a.costs+=cost+qty*b.open*slip;
        a.positions[o.symbol]={qty,entry:price,basis:gross+cost,stop:o.stop,target:o.target,atr:o.atr,sessions:0,analysis_id:o.analysis_id || null};
        emit(key,'BUY',o.symbol,{date,qty,price,fee:cost,reason:o.reason,analysis_id:o.analysis_id || null});
      }
      for(const [s,p] of Object.entries(a.positions)) {
        if(key==='hold')continue;
        const b=prices[s];p.sessions++;
        if(b.open<=p.stop)sell(key,a,s,b.open,'Stop-Gap',date);
        else if(b.low<=p.stop)sell(key,a,s,p.stop,'Stop',date,b.high>=p.target);
        else if(b.high>=p.target)sell(key,a,s,p.target,'Kursziel',date);
        else p.stop=Math.max(p.stop,b.close-2*p.atr); // Apply this close-derived trail only on a later bar.
      }
      const value=equity(a,prices);a.peak=Math.max(a.peak,value);a.drawdown=Math.min(a.drawdown,(value/a.peak-1)*100);
      if(a.cash<-.00001 || !Number.isFinite(value))throw Error('Ledger-Integritätsfehler. Keine Speicherung.');
    }
    nav.push({date,accounts:Object.fromEntries(Object.entries(state.accounts).map(([k,a])=>[k,{value:equity(a,prices),cash:a.cash,return_pct:(equity(a,prices)/config.capital-1)*100,max_drawdown_pct:a.drawdown,costs:a.costs}]))});
  }
  const prices=Object.fromEntries(config.symbols.map(s=>[s,series[s].at(-1)]));
  state.signals=[];
  const initial=!state.last_session;
  for(const s of config.symbols) {
    const recent=series[s].slice(-300),factor=recent.at(-1).factor;
    const volumeValid=recent.slice(-21).every(b=>Math.abs(b.factor/factor-1)<.005);
    const chart=technicals(recent,volumeValid),ai=eligibleAI(analyses,s,config.currency,now,last);
    const candidate=chart.score>=40 && chart.price>chart.sma50 && chart.rsi>=40 && chart.rsi<=70 && chart.volumeRatio>=1.2 && chart.atr>0 && chart.price>2*chart.atr;
    chart.methods=chart.methods.map(m=>m.name==='Volumenbestätigung 20'?{...m,finding:chart.volumeRatio===null?'Nicht verfügbar / mögliche Kapitalmaßnahme':chart.volumeRatio>=1.2?'Papierstrategie: Volumenfilter erfüllt':'Papierstrategie: Volumenfilter nicht erfüllt',purpose:'Papierstrategie: letztes Volumen / Mittel der vorherigen 20 Kerzen, Einstieg ab 1,2×.'}:m);
    state.signals.push({symbol:s,date:last,score:chart.score,rsi:chart.rsi,atr:chart.atr,sma50:chart.sma50,volumeRatio:chart.volumeRatio,methods:chart.methods,ai_id:ai?.id || null,ai_bias:ai?.narrative.bias || null,status:candidate?'Chart-Kandidat':'Kein Chart-Einstieg',ai_status:ai?'Gespeicherte KI-Analyse berücksichtigt':'Wartet auf gültige manuelle Gemini-Analyse'});
    for(const [key,a] of Object.entries(state.accounts)) {
      if(a.pending.some(o=>o.symbol===s))continue;
      const p=a.positions[s];let order=null;
      if(key==='hold' && initial)order={side:'buy',budget:config.capital/config.symbols.length,stop:null,target:null,reason:'Gleichgewichteter Buy-and-Hold-Start'};
      else if(key!=='hold' && p && (chart.score<=-25 || chart.price<chart.sma20 || p.sessions>=20 || key==='hybrid'&&ai?.narrative.bias==='bearish'))order={side:'sell',reason:'Chart-/Haltedauer-Exit'+(key==='hybrid'&&ai?.narrative.bias==='bearish'?' / KI bearish':'')};
      else if(key!=='hold'&&!p&&candidate&&(key==='chart'||ai?.narrative.bias==='bullish')) {
        const value=equity(a,prices),atr=chart.atr;
        order={side:'buy',budget:value*.2,risk_budget:value*.005,stop:chart.price-2*atr,target:chart.price+4*atr,atr,reason:'Score ≥40, über SMA50, RSI 40–70, Volumen ≥1,2×'+(key==='hybrid'?' + KI bullish':''),analysis_id:key==='hybrid'?ai.id:null};
      }
      if(order){const o={...order,symbol:s,created_at:stamp,expires_on:new Date(now.getTime()+7*86400000).toISOString().slice(0,10)};a.pending.push(o);emit(key,'ORDER',s,o);}
    }
    state.anchors[s]={...prices[s]};
  }
  if(initial)nav.push({date:last,accounts:Object.fromEntries(Object.keys(ACCOUNT_NAMES).map(k=>[k,{value:config.capital,cash:config.capital,return_pct:0,max_drawdown_pct:0,costs:0}]))});
  state.last_session=last;state.last_update=stamp;
  // Every update records the exact information set, even if no trade is permitted.
  for(const signal of state.signals)emit('all','SIGNAL',signal.symbol,{date:last,...signal});
  return {state,events,nav};
}
