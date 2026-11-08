// WKN -> OpenFIGI identity -> EODHD catalogue -> ISIN identity cross-check.
// Names/ticker similarities are discovery hints only, never identity evidence.
export class SecurityError extends Error {constructor(message,status=422){super(message);this.status=status;}}
const figi=/^BBG[A-Z0-9]{9}$/;
export function validIsin(value) {
  if(!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(value))return false;
  const digits=[...value].map(c=>/\d/.test(c)?c:String(c.charCodeAt(0)-55)).join('');
  let sum=0;for(let i=digits.length-1,n=0;i>=0;i--,n++){let v=Number(digits[i]);if(n%2===1){v*=2;if(v>9)v-=9;}sum+=v;}
  return sum%10===0;
}
export function validateSecurityQuery(body={}) {
  if(!body||typeof body!=='object'||Array.isArray(body)||body.manual_start!==true)throw new SecurityError('Wertpapiersuche ausdrücklich mit „Suchen“ starten.',400);
  const query=String(body.query||'').trim().toUpperCase();
  const kind=validIsin(query)?'ISIN':/^[A-Z0-9]{6}$/.test(query)?'WKN':null;
  if(!kind)throw new SecurityError('Sechsstellige WKN oder gültige zwölfstellige ISIN eingeben. Führende Nullen beibehalten.');
  const preferred=String(body.preferred_exchange||'XETRA').trim().toUpperCase();
  if(!/^[A-Z0-9]{1,12}$/.test(preferred))throw new SecurityError('Handelsplatz-Auswahl ungültig.');
  return {query,kind,preferred_exchange:preferred,key:kind+':'+query+':'+preferred};
}
const equity=m=>m.marketSector==='Equity'&&!/warrant|option|certificate|structured|future|right|note/i.test((m.securityType||'')+' '+(m.securityType2||'')) && /stock|share|fund|etf|deposit|reit|equity/i.test((m.securityType||'')+' '+(m.securityType2||''));
export const isSupportedFigi=equity;
function identities(rows) {
  return new Set(rows.flatMap(r=>['figi','compositeFIGI','shareClassFIGI'].map(k=>r[k]).filter(v=>figi.test(v||''))));
}
function sameSecurity(records,proof) {const expected=identities(proof);return records.some(r=>equity(r)&&['figi','compositeFIGI','shareClassFIGI'].some(k=>expected.has(r[k])));}
const exchangeNames={XETRA:'Xetra',F:'Frankfurt',US:'USA (Sammelcode)',PA:'Euronext Paris',AS:'Euronext Amsterdam',BR:'Euronext Brüssel',SW:'SIX Schweiz',MI:'Mailand',LSE:'London',KO:'Korea',KQ:'KOSDAQ',SHE:'Shenzhen',SHG:'Shanghai',HK:'Hongkong',TO:'Toronto',V:'TSX Venture'};
// Reviewed pairs; US consolidated exchange does not prove NASDAQ vs NYSE vs AMEX.
const chartExchanges={XETRA:'XETR',F:'FWB',PA:'EURONEXT',AS:'EURONEXT',BR:'EURONEXT',SW:'SIX',MI:'MIL',LSE:'LSE',KO:'KRX',KQ:'KRX',SHE:'SZSE',SHG:'SSE',HK:'HKEX',TO:'TSX',V:'TSXV'};
export function normalizeCatalogue(rows) {
  if(!Array.isArray(rows))throw new SecurityError('EODHD-Katalogantwort ungültig.',502);
  const results=[];
  for(const row of rows.slice(0,100)) {
    const code=String(row.Code||'').trim().toUpperCase(),exchange=String(row.Exchange||'').trim().toUpperCase(),isin=String(row.ISIN||'').toUpperCase();
    // This component supplies current stock/ETF/fund identities, never a derivative's underlying.
    if(!/^[A-Z0-9_^+\-]{1,25}$/.test(code)||!/^[A-Z0-9]{1,12}$/.test(exchange)||!validIsin(isin)||!/^(Common Stock|Preferred Stock|Stock|ETF|Fund|Mutual Fund|REIT|Depositary Receipt)$/i.test(row.Type||''))continue;
    const currency=row.Currency==='GBp'?'GBX':String(row.Currency||'').trim().toUpperCase();
    if(!/^[A-Z]{3}$/.test(currency)||!String(row.Name||'').trim())continue;
    const market_symbol=code+'.'+exchange;
    const duplicate=results.find(r=>r.market_symbol===market_symbol);
    if(duplicate){if(duplicate.isin!==isin||duplicate.currency!==currency)throw new SecurityError('Widersprüchliche Identität/Währung im EODHD-Katalog. Keine Zuordnung übernommen.',502);continue;}
    results.push({market_symbol,code,exchange,exchange_name:exchangeNames[exchange]||exchange,name:String(row.Name).slice(0,160),currency,isin,
      instrument_type:/ETF|Fund/i.test(row.Type)?'ETF':'Aktie',provider_type:row.Type,primary:row.isPrimary===true,
      chart_symbol:chartExchanges[exchange]?chartExchanges[exchange]+':'+code:null});
  }
  return results;
}
function order(rows,preferred){return [...rows].sort((a,b)=>Number(b.exchange===preferred)-Number(a.exchange===preferred)||Number(b.primary)-Number(a.primary)||a.market_symbol.localeCompare(b.market_symbol));}
function searchSeeds(proof,preferred) {
  const codes={XETRA:'GY',US:'US',F:'GF',PA:'FP',AS:'NA',LSE:'LN',SW:'SW',KO:'KS',HK:'HK'};
  const chosen=proof.find(p=>p.exchCode===codes[preferred])||proof.find(p=>p.exchCode==='US')||proof[0];
  const ticker=String(chosen.ticker||'').trim().toUpperCase(),name=String(chosen.name||'').trim().slice(0,100);
  const seeds=[];if(/^[A-Z0-9._+\-]{1,25}$/.test(ticker))seeds.push(ticker);
  if(name)seeds.push(name);
  return [...new Set(seeds)].slice(0,2);
}
export async function resolveSecurity(body,deps) {
  const input=validateSecurityQuery(body),now=deps.now?.()||new Date();
  const cached=await deps.readCache(input.key);
  if(cached?.schema===1 && Date.parse(cached.expires_at)>now.getTime() && cached.kind===input.kind && cached.query===input.query && cached.preferred_exchange===input.preferred_exchange && Array.isArray(cached.candidates)&&cached.candidates.every(c=>c.verified===true&&c.verification==='provider_isin_figi'))return {...cached,candidates:order(cached.candidates,input.preferred_exchange),cached:true};
  if(!await deps.reserveLookup())throw new SecurityError('Suchlimit erreicht oder bereits eine Suche gestartet. Kurz warten; Tageslimit maximal 20 neue Suchen.',429);
  let proof=[],warnings=[];
  if(input.kind==='WKN') {
    const response=await deps.mapFigi([{idType:'ID_WERTPAPIER',idValue:input.query}]);
    if(!Array.isArray(response)||response[0]?.error)throw new SecurityError('WKN-Stammdaten derzeit nicht verfügbar. Keine Zuordnung übernommen.',502);
    proof=(response[0]?.data||[]).filter(equity);
    if(!proof.length)throw new SecurityError('Für diese WKN keine unterstützte Aktie/ETF-Zuordnung gefunden. Bei KO-/Hebelprodukten den Basiswert separat suchen; Produktdaten bleiben manuell.');
  }
  const seeds=input.kind==='ISIN'?[input.query]:searchSeeds(proof,input.preferred_exchange);
  if(!seeds.length)throw new SecurityError('Keine passende Katalog-Suchkennung zur WKN vorhanden. ISIN verwenden.');
  const checked=new Map();let candidates=[];
  for(const seed of seeds) {
    // Each search uses the pre-existing atomic global EODHD budget. No paid endpoint fallback.
    if(!await deps.reserveEod()){
      if(candidates.length){warnings.push('Weitere Notierungen wegen erreichtem EODHD-Kontingent nicht gesucht. Die angezeigten Zuordnungen sind geprüft.');break;}
      throw new SecurityError('Gemeinsames EODHD-Tageskontingent erreicht. Gespeicherte Zuordnungen weiter nutzen oder später erneut versuchen.',429);
    }
    const found=order(normalizeCatalogue(await deps.searchEod(seed)),input.preferred_exchange);
    let matched=[];
    if(input.kind==='ISIN')matched=found.filter(c=>c.isin===input.query);
    else {
      const ids=[...new Set(found.map(c=>c.isin))].filter(id=>!checked.has(id)).slice(0,10);
      if(ids.length) {
        const response=await deps.mapFigi(ids.map(isin=>({idType:'ID_ISIN',idValue:isin})));
        if(!Array.isArray(response)||response.length!==ids.length||response.some(r=>r.error))throw new SecurityError('Identitätsprüfung der ISIN unvollständig. Keine unsichere Zuordnung übernommen.',502);
        ids.forEach((id,i)=>checked.set(id,sameSecurity(response[i]?.data||[],proof)));
      }
      matched=found.filter(c=>checked.get(c.isin)===true);
    }
    for(const item of matched)if(!candidates.some(c=>c.market_symbol===item.market_symbol))candidates.push(item);
    if(input.kind==='ISIN'||candidates.some(c=>c.exchange===input.preferred_exchange))break;
  }
  if(!candidates.length)throw new SecurityError('Keine eindeutig zur WKN/ISIN passende EODHD-Notierung mit Währung gefunden. Bitte ISIN versuchen oder die bestehenden Symbolfelder manuell nutzen.');
  const result={schema:1,kind:input.kind,query:input.query,preferred_exchange:input.preferred_exchange,resolved_at:now.toISOString(),expires_at:new Date(now.getTime()+7*86400000).toISOString(),
    candidates:order(candidates,input.preferred_exchange).slice(0,40).map(c=>({...c,wkn:input.kind==='WKN'?input.query:null,verified:true,verification:'provider_isin_figi'})),
    sources:input.kind==='WKN'?['OpenFIGI WKN/FIGI','EODHD Search','OpenFIGI ISIN/FIGI']:['EODHD Search: exakte ISIN'],warnings};
  try{await deps.saveCache(input.key,result);}catch{warnings.push('Zuordnung für diese Sitzung verfügbar, aber nicht zwischengespeichert.');}
  return {...result,cached:false};
}
export async function readProviderJson(response,maxBytes=1800000) {
  if(!response.ok)throw new SecurityError(response.status===429?'Stammdatenanbieter-Limit erreicht. Keine automatische Wiederholung.':'Stammdatenanbieter nicht erreichbar oder Token nicht freigegeben.',response.status===429?429:502);
  if(Number(response.headers.get('content-length')||0)>maxBytes)throw new SecurityError('Stammdatenantwort zu groß.',502);
  const reader=response.body.getReader(),parts=[];let total=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>maxBytes)throw new SecurityError('Stammdatenantwort zu groß.',502);parts.push(value);}}finally{await reader.cancel();}
  const bytes=new Uint8Array(total);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new SecurityError('Ungültige Stammdatenantwort.',502);}
}
