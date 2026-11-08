import {validateSecurityQuery,isSupportedFigi,SecurityError} from './security-resolver.mjs';
import {PUBLIC_VENUES,chartMetadata,assertQuoteBinding} from './independent-market.mjs';

export async function resolveIndependentSecurity(body,deps) {
  const input=validateSecurityQuery(body),now=deps.now?.()||new Date(),withMetadata=body.quote_metadata!==false;
  const venues=PUBLIC_VENUES[input.preferred_exchange];
  if(!venues)throw new SecurityError('Für diesen Handelsplatz ist noch keine unabhängige Zuordnung hinterlegt. Anderen Handelsplatz oder manuelle CSV-Eingabe wählen.');
  const key='F'+(withMetadata?'1':'0')+':'+input.key,cached=await deps.readCache(key);
  if(cached?.schema===36&&cached.lookup_key===key&&cached.query===input.query&&cached.preferred_exchange===input.preferred_exchange&&Date.parse(cached.expires_at)>now.getTime()&&Array.isArray(cached.candidates)&&cached.candidates.length&&cached.candidates.every(c=>c.verified===true&&c.verification==='openfigi_mic'&&c.eodhd_verified===false))return {...cached,cached:true};
  if(!await deps.reserveIndependentLookup())throw new SecurityError('Eigenes OpenFIGI-Suchlimit erreicht. Gespeicherte Zuordnung oder manuelle CSV-Eingabe verwenden. Dieses Limit ist unabhängig von EODHD.',429);
  const jobs=venues.map(v=>({idType:input.kind==='WKN'?'ID_WERTPAPIER':'ID_ISIN',idValue:input.query,micCode:v.mic}));
  const mapped=await deps.mapFigi(jobs);
  if(!Array.isArray(mapped)||mapped.length!==jobs.length||mapped.some(r=>!r||typeof r!=='object'))throw new SecurityError('OpenFIGI-Zuordnung derzeit unvollständig. Keine EODHD-Abfrage ausgelöst.',502);
  const candidates=[],warnings=[],metadata=new Map();
  for(let i=0;i<mapped.length;i++) {
    if(mapped[i].error){warnings.push('OpenFIGI liefert für '+venues[i].mic+' keine verwertbare Zuordnung.');continue;}
    if(!Array.isArray(mapped[i].data||[]))throw new SecurityError('OpenFIGI-Antwort ungültig.',502);
    for(const row of (mapped[i].data||[]).filter(isSupportedFigi).slice(0,50)) {
      const venue=venues[i];let code=String(row.ticker||'').trim().toUpperCase();
      if(input.preferred_exchange==='HK'&&/^\d{1,5}$/.test(code))code=String(Number(code)).padStart(4,'0');
      if(['KO','KQ','SHE','SHG'].includes(input.preferred_exchange)&&/^\d{1,6}$/.test(code))code=code.padStart(6,'0');
      if(!/^[A-Z0-9_^+\-]{1,25}$/.test(code)||!/^BBG[A-Z0-9]{9}$/.test(row.figi||''))continue;
      const quote_symbol=code+venue.suffix;
      if(candidates.some(c=>c.figi===row.figi&&c.mic===venue.mic))continue;
      let meta=null,metadata_error=null;
      if(withMetadata&&deps.quoteMetadata) {
        if(!metadata.has(quote_symbol))metadata.set(quote_symbol,metadata.size<3?Promise.resolve().then(()=>deps.quoteMetadata(quote_symbol)).catch(()=>null):Promise.resolve(null));
        meta=await metadata.get(quote_symbol);
        if(meta) {
          try{assertQuoteBinding(meta,{exchange:input.preferred_exchange,mic:venue.mic,quote_symbol},meta.currency);}catch{continue;}
        } else metadata_error='Öffentliche Kursmetadaten nicht verfügbar. Währung selbst bestätigen; CSV bleibt möglich.';
      }
      candidates.push({name:String(row.name||row.ticker).slice(0,160),code,exchange:input.preferred_exchange,exchange_name:venue.mic,market_symbol:code+'.'+input.preferred_exchange,
        chart_symbol:venue.chart+':'+code,quote_symbol,currency:meta?.currency||null,provider_name:meta?.name||null,
        instrument_type:/fund|etf/i.test((row.securityType||'')+' '+(row.securityType2||''))?'ETF':'Aktie',provider_type:row.securityType,
        figi:row.figi,mic:venue.mic,isin:input.kind==='ISIN'?input.query:null,wkn:input.kind==='WKN'?input.query:null,verified:true,verification:'openfigi_mic',eodhd_verified:false,quote_metadata_error:metadata_error});
    }
  }
  if(!candidates.length)throw new SecurityError('Keine unabhängige Aktien-/ETF-Zuordnung für diese WKN/ISIN an der gewählten Börse gefunden. Handelsplatz wechseln oder Kennung und CSV manuell eingeben.');
  if(candidates.some(c=>!c.currency))warnings.push('Währung fehlt in den verfügbaren Kursmetadaten. Sie muss vor der Übernahme ausdrücklich gewählt werden.');
  const result={schema:36,catalogue_source:'independent',lookup_key:key,query:input.query,kind:input.kind,preferred_exchange:input.preferred_exchange,resolved_at:now.toISOString(),expires_at:new Date(now.getTime()+7*86400000).toISOString(),candidates:candidates.slice(0,40),sources:['OpenFIGI: WKN/ISIN und MIC',...(withMetadata?['Öffentliche Chartmetadaten, soweit erreichbar']:[])],warnings,eodhd_used:false};
  try{await deps.saveCache(key,result);}catch{warnings.push('Zuordnung für diese Sitzung verfügbar, aber nicht im Quellenregister gespeichert.');}
  return {...result,cached:false};
}
export function publicMetadata(payload,symbol){return chartMetadata(payload,symbol).meta;}
