import { normalizeSource } from './deep-sources.mjs';

export function annualSecFacts(data,now=new Date()) {
  const today=now.toISOString().slice(0,10);
  const records=[];
  for(const [unit,rows] of Object.entries(data.units || {})) {
    if(!Array.isArray(rows)) continue;
    for(const r of rows) {
      const duration=(Date.parse(r.end)-Date.parse(r.start))/86400000;
      if(!['10-K','20-F','40-F'].includes(r.form) || !Number.isFinite(duration) || duration<300 || duration>400 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(r.filed || '') || r.filed>today || r.end>today ||
        !Number.isFinite(r.val)) continue;
      records.push({period_start:r.start,period_end:r.end,filed:r.filed,value:r.val,unit,form:r.form,accession:r.accn});
    }
  }
  const latest=new Map();
  for(const r of records.sort((a,b)=>a.filed.localeCompare(b.filed)))latest.set(r.unit+'|'+r.period_end,r);
  return [...latest.values()].sort((a,b)=>b.period_end.localeCompare(a.period_end)).slice(0,12);
}
export async function loadSecFundamentals(input,{userAgent,fetchImpl=fetch,now=new Date()}={}) {
  if(!/^[0-9]{1,10}$/.test(input.cik) || input.cik_verified!==true || !userAgent || !/@/.test(userAgent)) {
    return {fundamentals:{available:false,reason:'Geprüfte US-CIK-Zuordnung und SEC_USER_AGENT mit Kontakt-E-Mail erforderlich.'},sources:[],warnings:['SEC-Abfrage ausgelassen; geprüfte CIK oder Kontakt-Konfiguration fehlt.']};
  }
  const cik=input.cik.padStart(10,'0');
  const concepts=['EarningsPerShareDiluted','RevenueFromContractWithCustomerExcludingAssessedTax'];
  const settled=await Promise.allSettled(concepts.map(async concept=>{
    const url='https://data.sec.gov/api/xbrl/companyconcept/CIK'+cik+'/us-gaap/'+concept+'.json';
    const res=await fetchImpl(url,{headers:{'User-Agent':userAgent,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)});
    if(!res.ok)throw new Error('SEC-Konzept nicht verfügbar.');
    const text=await res.text();if(text.length>1500000)throw new Error('SEC-Antwort zu groß.');
    const data=JSON.parse(text),facts=annualSecFacts(data,now);
    const source=normalizeSource({url,title:(data.entityName || 'SEC-Unternehmen')+' · '+concept,
      source:'SEC EDGAR XBRL',kind:'filings',content_status:'structured_data',facts,match:'direct',discovery:'sec_api',
      own_summary:'Aus SEC-XBRL extrahierte Jahreswerte. Gemeldete Einheiten und Einreichungsdatum erhalten; keine automatische Umrechnung oder Analystenschätzung.'},now);
    return {concept,entity:data.entityName,cik:data.cik,facts,source};
  }));
  const loaded=settled.filter(r=>r.status==='fulfilled').map(r=>r.value);
  const warnings=settled.some(r=>r.status==='rejected')?['Ein SEC-Konzept fehlt (z. B. abweichende Taxonomie); kein Ersatzwert angenommen.']:[];
  return {fundamentals:{available:loaded.some(r=>r.facts.length),cik,entity:loaded[0]?.entity || null,
    mapping_verified:true,metrics:loaded.map(r=>({concept:r.concept,source_id:r.source.id,history:r.facts})),
    limitation:'CIK-Zuordnung zum Symbol muss vom Nutzer geprüft werden. Nur US-GAAP-Konzepte und Jahreswerte; keine Quartals-/Konsensrevisionen. Später bekannte Neubewertungen werden nur im aktuellen Abruf verwendet, Original-Snapshots bleiben bestehen.'},
    sources:loaded.map(r=>r.source),warnings};
}
