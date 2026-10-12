// V32: independent deterministic engine. No orders, network calls or changes to V31.
import { normalizeBars, technicals, tradeSetups, hashSeed, mean, clamp } from './signal-engine.mjs';
import { validateSignalInput, SignalError } from './signal-service.mjs';

export const DEEP_VERSION = '32.0-deep-analysis';
export const HORIZONS = [5, 20, 60, 120, 252];
export const LOOKBACKS = [60, 126, 252, 756, 1260, 2000];
const finite = (v, fallback) => v === '' || v == null ? fallback : Number(v);
const round = v => Number.isFinite(v) ? Number(v.toPrecision(8)) : null;
const deviation = a => Math.sqrt(mean(a.map(x => (x - mean(a)) ** 2)));
export const quantile = (a, q) => {
  if (!a.length) return null;
  const s = [...a].sort((a,b) => a-b), p = (s.length-1)*q, lo = Math.floor(p);
  return s[lo] + (s[Math.ceil(p)] - s[lo]) * (p-lo);
};
const uuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v));
function range(v, lo, hi, name, fallback) {
  const n = finite(v, fallback);
  if (!Number.isFinite(n) || n < lo || n > hi) throw new SignalError(name + ' außerhalb des zulässigen Bereichs.', 422);
  return n;
}
export function validateDeepInput(body = {}) {
  if(!body || typeof body!=='object' || Array.isArray(body)) throw new SignalError('JSON-Objekt erforderlich.',400);
  const base = validateSignalInput({ ...body, days:20 });
  const days = finite(body.days,20), lookback = finite(body.lookback,252), news_days = finite(body.news_days,14);
  if (!HORIZONS.includes(days) || !LOOKBACKS.includes(lookback) || ![3,7,14,30,90].includes(news_days)) throw new SignalError('Ungültige Zeitfenster.',422);
  if (!Array.isArray(body.prior_ids || [])) throw new SignalError('Analyseauswahl muss eine Liste sein.',422);
  const prior_ids = [...new Set(body.prior_ids || [])];
  if (prior_ids.length > 5 || prior_ids.some(v => !uuid(v))) throw new SignalError('Maximal fünf eigene Analysen auswählen.',422);
  const risk = body.risk || {};
  const product = body.product || {};
  if(body.cik && !/^\d{1,10}$/.test(String(body.cik))) throw new SignalError('CIK muss aus 1–10 Ziffern bestehen.',422);
  if(risk.account_currency && !/^[A-Z]{3}$/.test(String(risk.account_currency)) || product.currency && !/^[A-Z]{3}$/.test(String(product.currency))) throw new SignalError('Konto-/Produktwährung als dreistelligen Währungscode eingeben.',422);
  if (!['none','ko','factor','option'].includes(product.type || 'none')) throw new SignalError('Unbekannter Produkttyp.',422);
  if (!['long','short'].includes(product.direction || 'long')) throw new SignalError('Ungültige Produktrichtung.',422);
  const p = {
    type:product.type || 'none', direction:product.direction || 'long',
    barrier:range(product.barrier,0,1e9,'KO-Barriere',0),
    financing:range(product.financing,0,1e9,'Finanzierungslevel',0),
    ratio:range(product.ratio,.000001,1e6,'Bezugsverhältnis',1),
    premium:range(product.premium,0,1e9,'Produktpreis',0),
    spread_pct:range(product.spread_pct,0,50,'Produktspread',1),
    financing_pct:range(product.financing_pct,0,100,'Finanzierung p.a.',5),
    observation:['continuous','close','unknown'].includes(product.observation) ? product.observation : 'unknown',
    terms_verified:product.terms_verified === true,
    factor:range(product.factor,1,100,'Faktor',3),
    strike:range(product.strike,0,1e9,'Strike',0),
    expiry_days:range(product.expiry_days,1,3650,'Restlaufzeit',90),
    iv_pct:range(product.iv_pct,.01,500,'Implizite Volatilität',30),
    rate_pct:range(product.rate_pct,-5,30,'Zins',3),
    dividend_pct:range(product.dividend_pct,0,30,'Dividendenrendite',0),
    iv_verified:product.iv_verified === true,
    currency:String(product.currency || base.currency).slice(0,5),
    reference:String(product.reference || '').slice(0,160),
    // FX is explicitly entered by the user, never inferred from product denomination.
    fx_rate:String(product.currency || base.currency)===base.currency?1:range(product.fx_rate,.000001,1e6,'FX Produktwährung je Basiswertwährung',1),
    fx_verified:product.fx_verified === true
  };
  const valuation = body.valuation || {};
  return {
    ...base, days, lookback, news_days, prior_ids,
    research:body.research !== false,
    sector:String(body.sector || '').slice(0,100),
    cik:String(body.cik || '').replace(/\D/g,'').slice(0,10),
    cik_verified:body.cik_verified === true,
    shock_pct:range(body.shock_pct,0,40,'Ereignisschock',5),
    event_direction:['bullish','bearish','neutral'].includes(body.event_direction) ? body.event_direction : 'neutral',
    risk:{
      capital:range(risk.capital,0,1e10,'Analysekapital',0),
      budget_pct:range(risk.budget_pct,.01,5,'Risikobudget',.5),
      exposure:range(risk.exposure,0,1e10,'Vorhandenes Exposure',0),
      max_exposure_pct:range(risk.max_exposure_pct,1,100,'Exposure-Limit',20),
      fx_rate:String(risk.account_currency || base.currency)===base.currency?1:range(risk.fx_rate,.000001,1e6,'FX Kontowährung je Basiswertwährung',1),
      fx_verified:risk.fx_verified === true,
      account_currency:String(risk.account_currency || base.currency).slice(0,5),
      fee_bps:range(risk.fee_bps,0,500,'Gebühren je Seite in Basispunkten',10),
      slippage_bps:range(risk.slippage_bps,0,500,'Slippage je Seite in Basispunkten',15)
    },
    product:p,
    valuation:{
      eps:range(valuation.eps,-1e6,1e6,'EPS-Annahme',0),
      growth_pct:range(valuation.growth_pct,-95,200,'Gewinnwachstum',5),
      multiple:range(valuation.multiple,0,500,'Bewertungsmultiple',20),
      source_id:String(valuation.source_id || '').slice(0,160),
      as_of:String(valuation.as_of || '').slice(0,10),
      provenance:valuation.provenance === 'source' ? 'source' : 'assumption'
    }
  };
}

// Validate every candle using V31, but preserve requested long history instead of its 300-bar display limit.
export function deepBars(raw, lookback = 252, now = new Date()) {
  const quality = normalizeBars(raw, now);
  const today = now.toISOString().slice(0,10);
  const rows = raw.filter(r => String(r.date).slice(0,10) < today)
    .map(r => ({...r,date:String(r.date).slice(0,10)})).sort((a,b) => a.date.localeCompare(b.date)).slice(-lookback);
  const latest = rows.at(-1), f = Number(latest.adjusted_close ?? latest.close) / Number(latest.close);
  const bars = rows.map(r => {
    const factor = Number(r.adjusted_close ?? r.close)/Number(r.close)/f;
    return {date:r.date,open:Number(r.open)*factor,high:Number(r.high)*factor,low:Number(r.low)*factor,close:Number(r.close)*factor,volume:r.volume == null || r.volume === '' ? null : Number(r.volume)};
  });
  const jump = bars.slice(1).some((b,i) => Math.abs(Math.log(b.close/bars[i].close)) > Math.log(1.6));
  return {...quality,bars,unresolvedJump:jump,requested:lookback,shortfall:Math.max(0,lookback-bars.length)};
}
export function weeklyBars(bars) {
  const weeks = new Map();
  for (const b of bars) {
    const d = new Date(b.date + 'T00:00:00Z'), monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - (d.getUTCDay()+6)%7);
    const key = monday.toISOString().slice(0,10), w = weeks.get(key);
    if (!w) weeks.set(key,{...b,key});
    else {w.high=Math.max(w.high,b.high);w.low=Math.min(w.low,b.low);w.close=b.close;w.date=b.date;w.volume=w.volume == null || b.volume == null ? null : w.volume+b.volume;}
  }
  // Omit the week containing the latest candle: it may still be incomplete.
  return [...weeks.values()].slice(0,-1);
}
function random(seed) {
  let x=seed>>>0 || 1;
  return () => {x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};
}
const SCENARIOS = [
  ['base','Basis','Kein neuer Schock; begrenzter technischer Drift.','Trend und Volumen bestätigen.','Trendbruch oder wesentliche neue Nachricht.'],
  ['positive','Positive Überraschung','Positiver, vom Nutzer vorgegebener Schock am ersten Tag.','Positive Meldung durch Primärquelle bestätigt.','Meldung widerlegt oder Ausbruch scheitert.'],
  ['negative','Negative Überraschung','Negativer, vom Nutzer vorgegebener Schock am ersten Tag.','Negative Meldung bestätigt und Unterstützung fällt.','Entwarnung oder Rückeroberung der Unterstützung.'],
  ['sideways','Seitwärts','Mittelwert-Rückkehr mit halbierter historischer Schwankung.','Kurs bleibt innerhalb der bisherigen Spanne.','Bestätigter Ausbruch mit erhöhtem Volumen.'],
  ['recovery','Rücksetzer → Erholung','Anfänglicher Rücksetzer; angenommene Erholung ab Mitte des Horizonts.','Unterstützung hält; Momentum dreht.','Unterstützung bricht nachhaltig.'],
  ['stress','Gap / Stress','Negativer Schock und 1,8× historische Schwankung.','Liquiditäts- oder Ereignisstress tritt ein.','Stress bleibt aus; kein Basisszenario.']
];
export function simulateDeep(bars, chart, input, seed, model = 'technical', count = null) {
  count ??= input.days>=120?120:240;
  const rows = bars.slice(1).map((b,i) => {
    const previous = bars[i].close;
    return {ret:Math.log(b.close/previous),gap:Math.log(b.open/previous),upper:Math.log(b.high/Math.max(b.open,b.close)),lower:Math.log(Math.min(b.open,b.close)/b.low)};
  });
  const avg = mean(rows.map(r=>r.ret)), sigma = deviation(rows.map(r=>r.ret));
  const drift = model === 'bootstrap' ? 0 : chart.score/100*sigma*.1;
  const rng=random(seed), definitions=model === 'technical' ? SCENARIOS : [SCENARIOS[0]];
  const allPaths=[];
  const scenarios=definitions.map(([id,name,assumption,confirmation,invalidation]) => {
    const byDay=Array.from({length:input.days+1},()=>[]), endpoints=[], excursions=[], paths=[];
    let drawdowns=[];
    for(let p=0;p<count;p++) {
      let price=chart.price, peak=price, maxdd=0, min=price, block=0;
      const path=[{day:0,open:price,high:price,low:price,close:price}];byDay[0].push(price);
      for(let d=1;d<=input.days;d++) {
        if((d-1)%5===0) block=Math.floor(rng()*rows.length);
        const r=rows[(block+(d-1)%5)%rows.length];
        const scale=id==='stress'?1.8:id==='sideways'?.5:1;
        const shock=input.shock_pct/100;
        let extra=id==='positive'&&d===1?Math.log1p(shock):['negative','stress'].includes(id)&&d===1?Math.log1p(-shock):0;
        if(id==='recovery') extra=d===1?Math.log1p(-shock):d>input.days/2?-Math.log1p(-shock)/Math.max(1,Math.ceil(input.days/2)):0;
        const revert=id==='sideways'?-.08*Math.log(price/chart.price):0;
        const event=model==='event' ? (input.event_direction==='bullish'?1:input.event_direction==='bearish'?-1:0)*shock/input.days : 0;
        const ret=(r.ret-avg)*scale+(id==='sideways'?0:drift)+extra+revert+event;
        const open=price*Math.exp(r.gap*scale+extra), close=price*Math.exp(ret);
        const high=Math.max(open,close)*Math.exp(r.upper*scale), low=Math.min(open,close)*Math.exp(-r.lower*scale);
        peak=Math.max(peak,high);maxdd=Math.max(maxdd,1-low/peak);min=Math.min(min,low);
        path.push({day:d,open,high,low,close});price=close;byDay[d].push(price);
      }
      endpoints.push(price);excursions.push((min/chart.price-1)*100);drawdowns.push(maxdd*100);paths.push(path);
    }
    allPaths.push({id,paths});
    return {id,name,assumption,confirmation,invalidation,shock_pct:input.shock_pct,
      bands:byDay.map((a,day)=>({day,q10:round(quantile(a,.1)),q50:round(quantile(a,.5)),q90:round(quantile(a,.9))})),
      endpoint:round(quantile(endpoints,.5)),adverse_p10_pct:round(quantile(excursions,.1)),drawdown_p90_pct:round(quantile(drawdowns,.9)),
      frequency_label:'Modellquantile; keine reale Eintrittswahrscheinlichkeit.'};
  });
  return {scenarios,paths:allPaths,sigma,drift,count,seed,model,
    assumptions:'5er Block-Bootstrap zentrierter Logrenditen; OHLC-Spannen und Gaps aus derselben historischen Kerze. Intraday-Reihenfolge unbekannt. Keine kalibrierten Ereigniswahrscheinlichkeiten.'};
}

export function historicalAnalogs(bars, chart, days) {
  const analogs=[];
  // Only fully observed, non-overlapping forward windows, with predictors taken before their outcomes.
  for(let i=60;i+days<bars.length;i+=Math.max(days,5)) {
    const c=technicals(bars.slice(Math.max(0,i-251),i+1));
    if(Math.abs(c.score-chart.score)>25 || Math.abs(c.rsi-chart.rsi)>12) continue;
    const future=bars.slice(i+1,i+days+1);
    analogs.push({date:bars[i].date,score:c.score,rsi:round(c.rsi),return_pct:round((future.at(-1).close/bars[i].close-1)*100),adverse_pct:round((Math.min(...future.map(b=>b.low))/bars[i].close-1)*100)});
  }
  return {matches:analogs.length,sample:analogs.slice(-12),median_return_pct:round(quantile(analogs.map(a=>a.return_pct),.5)),
    limitation:'Ähnlichkeit von Chartmerkmalen, keine historischen News-Kausalitäten. Kleine, selektierte Stichprobe; keine Erfolgsquote.'};
}
export function valuationModel(input, sources, price, now = new Date()) {
  const v=input.valuation;
  if(!(v.eps>0 && v.multiple>0)) return {available:false,reason:'Positive EPS- und Multiple-Annahmen fehlen. Keine kostenlose automatische Analysten-Konsensdatenquelle vorausgesetzt.'};
  const source=sources.find(s=>s.id===v.source_id);
  const sourced=v.provenance==='source' && source?.content_status!=='metadata' && source?.excerpt &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.as_of) && v.as_of<=now.toISOString().slice(0,10);
  // EPS must be in the underlying quote currency and per-share basis, confirmed by the user.
  const years=input.days/252, earnings=v.eps*Math.pow(1+v.growth_pct/100,years);
  const matrix=[-10,0,10].flatMap(g=>[-20,0,20].map(m=>{
    const growth=Math.max(-95,v.growth_pct+g), multiple=v.multiple*(1+m/100);
    return {growth_pct:growth,multiple:round(multiple),value:round(v.eps*Math.pow(1+growth/100,years)*multiple)};
  }));
  return {available:true,provenance:sourced?'Nutzereingabe mit Quellenverweis; nicht unabhängig geprüft':'Hypothetische Nutzereingabe',
    source_id:sourced?source.id:null,as_of:v.as_of || null,eps:v.eps,growth_pct:v.growth_pct,multiple:v.multiple,
    endpoint:round(earnings*v.multiple),implied_multiple:round(price/v.eps),
    implied_growth_pct:round((Math.pow(price/(v.eps*v.multiple),1/years)-1)*100),matrix,
    limitation:'EPS × Wachstum × Multiple, kein DCF oder Kursziel. Bilanz, Verschuldung, Verwässerung und Analystenrevisionen nur bei belegten Daten diskutieren.'};
}

function normalCdf(x) {
  const a=Math.abs(x), t=1/(1+.2316419*a);
  const p=1-Math.exp(-a*a/2)/Math.sqrt(2*Math.PI)*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
  return x>=0?p:1-p;
}
export function optionValue(s,k,years,iv,rate=0,dividend=0,call=true) {
  if(years<=0) return Math.max(call?s-k:k-s,0);
  if(!(s>0&&k>0&&iv>0)) return null;
  const d1=(Math.log(s/k)+(rate-dividend+iv*iv/2)*years)/(iv*Math.sqrt(years)),d2=d1-iv*Math.sqrt(years);
  return call?s*Math.exp(-dividend*years)*normalCdf(d1)-k*Math.exp(-rate*years)*normalCdf(d2):
    k*Math.exp(-rate*years)*normalCdf(-d2)-s*Math.exp(-dividend*years)*normalCdf(-d1);
}
export function productAnalysis(product, groups, price, days) {
  if(product.type==='none') return {available:false,reason:'Kein Hebelprodukt ausgewählt.'};
  const dir=product.direction==='long'?1:-1, fx=product.fx_rate;
  const issues=[];
  if(product.currency && product.currency!==groups.currency && !product.fx_verified) issues.push('FX-Umrechnung nicht bestätigt.');
  if(!product.terms_verified) issues.push('Emittentenbedingungen und Handels-/Beobachtungszeiten nicht bestätigt.');
  const result={available:true,type:product.type,reference:product.reference,issues,decision:issues.length?'Produktentscheidung gesperrt':'Nur Modellprüfung; keine automatische Kaufempfehlung.',rows:[]};
  if(product.type==='ko') {
    if(!(product.barrier>0&&product.financing>0&&product.premium>0) || product.observation==='unknown') {
      return {...result,decision:'Produktentscheidung gesperrt',reason:'Barriere, Finanzierungslevel, Preis und Beobachtungsart vollständig eingeben.'};
    }
    const already=dir===1?price<=product.barrier:price>=product.barrier;
    const gapDistance=dir*(price-product.barrier)/price*100;
    result.distance_pct=round(gapDistance);result.reverse_stress_pct=round(-dir*Math.max(0,gapDistance));
    result.already_touched=already;
    if(already || dir*(price-product.financing)<=0) {result.decision='Produktentscheidung gesperrt';result.issues.push('Barriere bereits erreicht oder Finanzierungslevel unplausibel.');}
    for(const group of groups.paths) {
      let touches=0;const returns=[];
      for(const path of group.paths) {
        let touched=already;
        for(const b of path.slice(1)) {
          const calendarDays=b.day*365/252;
          // Parallel barrier/financing shifts are an assumption; issuer updates may differ.
          const shift=product.financing*(Math.exp(product.financing_pct/100*calendarDays/365)-1);
          const barrier=product.barrier+shift;
          const observed=product.observation==='close'?b.close:dir===1?b.low:b.high;
          if(dir===1?observed<=barrier:observed>=barrier) touched=true;
        }
        if(touched) {touches++;returns.push(-100);}
        else {
          const f=product.financing*Math.exp(product.financing_pct/100*days/252);
          const proxy=Math.max(0,dir*(path.at(-1).close-f)*product.ratio*fx);
          returns.push((proxy/product.premium-1)*100-product.spread_pct);
        }
      }
      result.rows.push({scenario:group.id,barrier_model_frequency_pct:round(touches/group.paths.length*100),return_p10_pct:round(quantile(returns,.1)),return_p50_pct:round(quantile(returns,.5))});
    }
    result.limitations='Barrieren über alle modellierten Tages-Hochs/Tiefs geprüft; nach Berührung keine Erholung. 0 Restwert als Stressannahme (Mini-Futures können Restwert haben). Parallel verschobene Barriere/Finanzierung angenommen. Intraday-Pfad, Feiertage, Emittentenkurse, Aufgeld und Handelsausfälle unbekannt. Modellhäufigkeit ist keine Ausfallwahrscheinlichkeit.';
  } else if(product.type==='factor') {
    for(const group of groups.paths) {
      const returns=group.paths.map(path=>{
        let value=1;
        for(let d=1;d<path.length;d++) value*=Math.max(0,1+dir*product.factor*(path[d].close/path[d-1].close-1)-product.financing_pct/100/252);
        return (value-1)*100-product.spread_pct;
      });
      result.rows.push({scenario:group.id,return_p10_pct:round(quantile(returns,.1)),return_p50_pct:round(quantile(returns,.5))});
    }
    result.limitations='Tägliche Rücksetzung, Pfadabhängigkeit und Kosten modelliert. Anpassungsschwellen/untertägige Reset-Regeln des Emittenten fehlen; dadurch kein exakter Produktpreis.';
  } else {
    if(!(product.strike>0&&product.premium>0)) return {...result,decision:'Produktentscheidung gesperrt',reason:'Strike und bezahlten Produktpreis eingeben.'};
    if(!product.iv_verified) {result.issues.push('IV-Annahme nicht durch aktuelle Marktdaten bestätigt.');result.decision='Produktentscheidung gesperrt';}
    const call=dir===1,t=product.expiry_days/365,iv=product.iv_pct/100,r=product.rate_pct/100,q=product.dividend_pct/100;
    const value=optionValue(price,product.strike,t,iv,r,q,call),h=price*.001;
    const up=optionValue(price+h,product.strike,t,iv,r,q,call),down=optionValue(price-h,product.strike,t,iv,r,q,call);
    result.greeks={delta:round((up-down)/(2*h)),gamma:round((up-2*value+down)/(h*h)),
      vega_per_vol_point:round((optionValue(price,product.strike,t,iv+.0001,r,q,call)-value)/.0001/100),
      theta_per_calendar_day:round(optionValue(price,product.strike,Math.max(0,t-1/365),iv,r,q,call)-value)};
    result.iv_sensitivity=[.8,1,1.2].map(m=>({iv_pct:round(iv*m*100),theoretical_value:round(optionValue(price,product.strike,t,iv*m,r,q,call)*product.ratio*fx)}));
    for(const group of groups.paths) {
      const returns=group.paths.map(path=>{
        const expiryStep=Math.min(days,Math.max(1,Math.round(product.expiry_days*252/365)));
        const s=path[expiryStep].close,rem=Math.max(0,(product.expiry_days-days*365/252)/365);
        return (optionValue(s,product.strike,rem,iv,r,q,call)*product.ratio*fx/product.premium-1)*100-product.spread_pct;
      });
      result.rows.push({scenario:group.id,return_p10_pct:round(quantile(returns,.1)),return_p50_pct:round(quantile(returns,.5))});
    }
    result.limitations='Black-Scholes für europäische Vanilla-Option, konstante IV/Zinsen, keine Smile-/Liquiditäts-/Emittentenmodellierung. Greeks pro Basiswert-Einheit; Produktwert skaliert mit Bezugsverhältnis/FX. Amerikanische oder exotische Produkte benötigen andere Modelle.';
  }
  return result;
}
export function sizing(setups, input, sigma) {
  const r=input.risk,fxKnown=r.account_currency===input.currency||r.fx_verified,fx=r.fx_rate;
  return setups.map(s=>{
    const roundtrip=(r.fee_bps+r.slippage_bps)*2/10000;
    const unitRisk=(Math.abs(s.entry-s.stop)+s.entry*roundtrip)*fx;
    const budget=r.capital*r.budget_pct/100;
    const room=Math.max(0,r.capital*r.max_exposure_pct/100-r.exposure);
    const units=fxKnown&&r.capital>0?Math.max(0,Math.floor(Math.min(budget/unitRisk,room/(s.entry*fx)))):null;
    const flags=[];
    if(!fxKnown) flags.push('FX fehlt; keine Positionsgröße.');
    if(!r.capital) flags.push('Analysekapital fehlt; keine Positionsgröße.');
    if(!s.volumeAvailable) flags.push('Volumenbestätigung fehlt.');
    if(s.status==='gesperrt') flags.push('Daten-/Schwellenprüfung gesperrt.');
    if(units===0) flags.push('Risikobudget oder Exposure-Limit ausgeschöpft.');
    const conflict=s.status.includes('widersprüchlich');
    const decision=flags.length||conflict||s.status==='abwarten'?'ABWARTEN / KEIN TRADE':'BEDINGTER KANDIDAT';
    return {...s,decision,flags,units:decision==='BEDINGTER KANDIDAT'?units:null,
      budget:round(budget),unit_risk:round(unitRisk),roundtrip_cost_pct:round(roundtrip*100),
      gap_stress_loss:units==null?null:round(units*(Math.abs(s.entry-s.stop)+s.entry*3*sigma+s.entry*roundtrip)*fx),
      risk_currency:r.account_currency,exposure_room:round(room),
      net_reward_risk:round((Math.abs(s.target1-s.entry)-s.entry*roundtrip)/(Math.abs(s.entry-s.stop)+s.entry*roundtrip)),
      note:'Größe für den Basiswert bei bestätigtem Einstieg. Stop ist keine Verlustgarantie; Gaps und Korrelation können das Budget überschreiten. Exposure ist die vom Nutzer eingegebene gemeinsame Risikogruppe.'};
  });
}
export function comparePrior(previous, analysis) {
  return previous.filter(p=>p.symbol===analysis.symbol).map(p=>({
    id:p.id,created_at:p.created_at,days:p.request?.days ?? p.horizon_days,
    currency_comparable:p.currency===analysis.currency,
    price_change_pct:p.currency===analysis.currency?round((analysis.chart.price/p.chart.price-1)*100):null,
    score_delta:analysis.chart.score-p.chart.score,
    previous_bias:p.narrative?.bias || 'neutral',current_bias:analysis.narrative?.bias || 'neutral',
    added_sources:analysis.sources.filter(s=>!p.sources?.some(old=>old.canonical_url===s.canonical_url)).map(s=>s.id),
    reevaluate:analysis.chart.trend!==p.chart.trend || analysis.narrative?.bias!==p.narrative?.bias || analysis.quality.blocked,
    note:'Gespeicherte Originale bleiben unverändert; keine rückwirkende Optimierung.'
  }));
}
export function evaluateForecast(original, rawBars, now = new Date()) {
  const all=deepBars(rawBars,2000,now).bars;
  const anchor=all.find(b=>b.date===original.price_date);
  if(!anchor) throw new SignalError('Auswertung braucht die Original-Kerze und alle folgenden Handelstage. Längere CSV-Historie importieren; keine Auswertung über eine Datenlücke.',422);
  // Align adjusted prices to the immutable forecast's basis, including later splits/dividend adjustments.
  const scale=original.chart.price/anchor.close;
  const bars=all.filter(b=>b.date>original.price_date).map(b=>({...b,open:b.open*scale,high:b.high*scale,low:b.low*scale,close:b.close*scale}));
  const horizon=original.request.days, future=bars.slice(0,horizon), matured=future.length>=horizon;
  const result={matured,observed_days:future.length,required_days:horizon,price_date:future.at(-1)?.date || null,basis_scale:round(scale),
    note:'Nachträgliche Auswertung getrennt vom unveränderten Original. Künftige Kerzen ausgeschlossen; Anzahl tatsächlicher Handelstage. Modellkennzahlen ≠ Prognosegarantie.'};
  if(!matured) return result;
  const endpoint=future.at(-1).close, band=original.scenarios.find(s=>s.id==='base').bands.at(-1);
  const reference=original.chart.price, fee=2*(original.request.risk.fee_bps+original.request.risk.slippage_bps)/10000;
  result.endpoint=round(endpoint);result.realized_return_pct=round((endpoint/reference-1)*100);
  result.base_absolute_error_pct=round(Math.abs(band.q50-endpoint)/endpoint*100);
  result.in_model_band=endpoint>=band.q10&&endpoint<=band.q90;
  const rules=Math.sign(original.chart.score),ai=original.narrative?.mode==='ai'?(original.narrative.bias==='bullish'?1:original.narrative.bias==='bearish'?-1:0):null;
  const ret=endpoint/reference-1;
  result.benchmarks={buy_hold:round((ret-fee)*100),rules:round((rules*ret-(rules?fee:0))*100),ai:ai==null?null:round((ai*ret-(ai?fee:0))*100)};
  result.benchmark_note='Prospektiver Richtungsvergleich: gleiche Haltedauer, Referenzkurs und Kosten; hypothetische Exposition ±1. Kein rückwirkender Trigger-Trade, keine Leih-/Finanzierungskosten, kein ausführbarer Backtest.';
  result.setups=original.setups.map(s=>{
    let active=false,entry=null,ambiguous=0,exit=null;
    const long=s.direction==='long';
    for(const b of future) {
      let enteredThisBar=false;
      if(!active && !exit && (long?b.high>=s.entry:b.low<=s.entry)) {
        active=true;enteredThisBar=true;entry=long?Math.max(s.entry,b.open):Math.min(s.entry,b.open);
      }
      if(!active || exit) continue;
      const stop=long?b.low<=s.stop:b.high>=s.stop,target=long?b.high>=s.target1:b.low<=s.target1;
      if(stop&&(target||enteredThisBar)) ambiguous++;
      // Worst ordering when a daily bar can touch entry, stop and target; retain uncertainty.
      if(stop) exit={date:b.date,kind:'stop',price:enteredThisBar?s.stop:long?Math.min(s.stop,b.open):Math.max(s.stop,b.open)};
      else if(target) exit={date:b.date,kind:'target',price:s.target1};
    }
    return {direction:s.direction,touched_entry:entry!=null,ambiguous_days:ambiguous,exit,
      hypothetical_return_pct:entry==null?null:round(((long?1:-1)*((exit?.price ?? endpoint)/entry-1)-fee)*100),
      executable:false,note:'Nur tägliche Preisberührungen. Schlusskurs-/Volumenbestätigung und nächste Ausführung nicht nachgebildet; unklare Tagesreihenfolge konservativ.'};
  });
  return result;
}
export function buildDeepAnalysis(input, rawBars, {sources=[],previous=[],narrative=null,now=new Date(),provider='CSV',fundamentals={available:false,reason:'Keine strukturierten Primärdaten geladen.'}} = {}) {
  const quality=deepBars(rawBars,input.lookback,now),bars=quality.bars,chart=technicals(bars,quality.volumeValid);
  const weeks=weeklyBars(bars),weekly=weeks.length>=60?technicals(weeks,false):null;
  const seed=hashSeed(input.symbol+'|'+bars.at(-1).date+'|'+input.days+'|'+input.lookback+'|'+input.shock_pct);
  const simulation=simulateDeep(bars,chart,input,seed);
  const count=input.days>=120?120:160;
  const bootstrap=simulateDeep(bars,chart,input,seed,'bootstrap',count);
  const event=simulateDeep(bars,chart,input,seed,'event',count);
  const n=narrative || {mode:'rules',bias:'neutral',summary:'Chart-/Risikoberechnung ohne KI. Szenarioschocks sind Nutzerannahmen.',confidence:null,evidence:[],risks:[],watchpoints:[],countercase:'News, Bewertung und Chart können voneinander abweichen.'};
  const valuation=valuationModel(input,sources,chart.price,now);
  const base=simulation.scenarios[0].bands.at(-1);
  const models=[
    {name:'Technik + Block-Bootstrap',endpoint:base.q50,group:'Kursdaten',assumption:'Begrenzter Drift aus Chartscore, nicht kalibriert.'},
    {name:'Driftfreier Bootstrap',endpoint:bootstrap.scenarios[0].endpoint,group:'Kursdaten',assumption:'Zentrierte historische Renditen ohne Trenddrift.'},
    {name:'Ereignisannahme',endpoint:event.scenarios[0].endpoint,group:'Nutzerhypothese',assumption:'Manuelle Richtung und Schockgröße, kein geschätzter News-Effekt.'},
    {name:'EPS / Multiple',endpoint:valuation.endpoint ?? null,group:'Bewertung',assumption:valuation.available?valuation.provenance:valuation.reason}
  ];
  const setupBase=tradeSetups(chart,quality,n,{dailyVolatility:simulation.sigma});
  const setups=sizing(setupBase,input,simulation.sigma);
  const result={version:DEEP_VERSION,symbol:input.symbol,currency:input.currency,created_at:now.toISOString(),price_date:bars.at(-1).date,provider,
    request:{...input,bars:undefined},chart,weekly:{bars:weeks.length,chart:weekly,reason:weekly?null:'Mindestens 60 vollständige Wochen erforderlich; lange CSV-Historie importieren.'},
    quality:{ageDays:quality.ageDays,bars:bars.length,requested:input.lookback,shortfall:quality.shortfall,
      blocked:setupBase.every(s=>s.status==='gesperrt'),notes:quality.notes,
      gaps:['Keine automatisch verifizierten Analystenrevisionen oder Intraday-Daten.',...(quality.shortfall?['Historienwunsch nicht vollständig durch verfügbare Daten abgedeckt.']:[]),
        ...(!valuation.available?['Fundamentale Bewertung fehlt.']:[]),...(!weekly?['Langfristige Wochenbestätigung fehlt.']:[]),
        ...(sources.some(s=>s.content_status==='metadata')?['Einige Quellen enthalten nur Metadaten; keine Volltextauswertung.']:[])]},
    simulation:{seed,paths_per_scenario:simulation.count,daily_volatility:simulation.sigma,drift:simulation.drift,assumptions:simulation.assumptions,calibrated:false},
    scenarios:simulation.scenarios,models,analogs:historicalAnalogs(bars,chart,input.days),valuation,fundamentals,setups,narrative:n,sources,
    product:productAnalysis(input.product,{...simulation,currency:input.currency},chart.price,input.days),
    sensitivity:[.5,1,1.5].map(m=>({volatility_factor:m,lower:round(chart.price*Math.exp(-1.28155*simulation.sigma*m*Math.sqrt(input.days))),upper:round(chart.price*Math.exp(1.28155*simulation.sigma*m*Math.sqrt(input.days)))})),
    history:bars.slice(-120),delta:[],warnings:[],
    reassess:['Neue bestätigte Meldung oder Quellenwiderspruch','Bruch von Unterstützung / Widerstand','Änderung der Volatilität oder Produktbarriere','Vor Ergebnissen und bei Ablauf des gewählten Horizonts'],
    limitations:['Keine automatische Order oder Anlageentscheidung.','Methoden auf denselben Kursdaten sind keine unabhängigen Belege.','Szenarioschocks und Bewertungsparameter sind Annahmen, keine Prognosewahrscheinlichkeiten.','Tägliche Bars erlauben keine sichere Intraday-Ausführungs- oder KO-Reihenfolge.']};
  result.delta=comparePrior(previous,result);
  return result;
}
