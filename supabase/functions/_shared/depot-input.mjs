import {ANALYSIS_CURRENCIES} from './security-form.mjs';
export const depotUuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value||''));
export function depotDay(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
 return parts.year+'-'+parts.month+'-'+parts.day;
}
export function depotNumber(value,label){
 const text=String(value??'').trim();if(!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text))throw Error(label+': eine positive Zahl ohne Tausendertrennzeichen eingeben.');
 const number=Number(text.replace(',','.'));if(!Number.isFinite(number)||number<=0||number>1e9)throw Error(label+' muss größer als 0 und höchstens 1.000.000.000 sein.');return number;
}
function day(value,label,now,required=false){
 if(!value&&!required)return null;const text=String(value||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||!Number.isFinite(Date.parse(text))||new Date(text).toISOString().slice(0,10)!==text||text>depotDay(now))throw Error(label+': gültiges Datum bis heute eingeben.');return text;
}
export function validateDepotInput(raw,now=new Date()){
 if(raw.manual_start!==true||!depotUuid(raw.request_id))throw Error('Depotposition ausdrücklich speichern; Anfragereferenz fehlt.');
 for(const key of ['asset_id','position_id','legacy_trade_id'])if(raw[key]&&!depotUuid(raw[key]))throw Error('Bestandszuordnung ist ungültig.');
 const close=raw.close===true,symbol=String(raw.symbol||'').trim().toUpperCase().replace(/^XETR:([A-Z0-9_^+\-]+)$/,'$1.XETRA'),currency=String(raw.currency||'').trim().toUpperCase();
 if(!/^[A-Z0-9_^+\-]{1,25}\.[A-Z0-9]{1,12}$/.test(symbol))throw Error('Wertpapier zuerst auswählen oder eine genaue Kennung mit Handelsplatz eingeben, z. B. VOW3.XETRA. Eine WKN allein muss über die Suche zugeordnet werden.');
 if(!ANALYSIS_CURRENCIES.includes(currency))throw Error('Die Notierungswährung ausdrücklich auswählen.');
 if(symbol.endsWith('.XETRA')&&currency!=='EUR'||symbol.endsWith('.US')&&currency!=='USD')throw Error('Notierungswährung und Handelsplatz passen nicht zusammen. Keine automatische Währungsumrechnung.');
 if(!close&&raw.identity_confirmed!==true)throw Error('Wertpapier, Handelsplatz und Währung bestätigen.');
 const company=String(raw.company||symbol).trim().slice(0,160),wkn=String(raw.wkn||'').trim().toUpperCase(),isin=String(raw.isin||'').trim().toUpperCase();
 if(wkn&&!/^[A-Z0-9]{6}$/.test(wkn)||isin&&!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin))throw Error('WKN oder ISIN hat kein gültiges Format.');
 if(close&&(!raw.asset_id||!raw.position_id&&!raw.legacy_trade_id))throw Error('Zum Schließen eine bestehende Position auswählen.');
 const direction=raw.direction||'Long',instrument_type=raw.instrument_type||'Aktie';if(!close&&(!['Long','Short'].includes(direction)||!['Aktie','ETF'].includes(instrument_type)))throw Error('Bestandsrichtung und Aktie/ETF auswählen.');
 const valuation_mode=close?'keep':raw.valuation_mode||'keep';if(!['keep','market','manual'].includes(valuation_mode))throw Error('Bewertungsquelle ist ungültig.');
 return {manual_start:true,request_id:raw.request_id,asset_id:raw.asset_id||null,position_id:raw.position_id||null,legacy_trade_id:raw.legacy_trade_id||null,symbol,currency,company,wkn,isin,close,direction,instrument_type,additional_position_confirmed:raw.additional_position_confirmed===true,
  quantity:close?null:depotNumber(raw.quantity,'Stückzahl'),average_entry_price:close?null:depotNumber(raw.average_entry_price,'Einstand je Stück'),entry_date:close?null:day(raw.entry_date,'Kauf-/Einstandsdatum',now),valuation_mode,
  manual_price:valuation_mode==='manual'?depotNumber(raw.manual_price,'Manueller Bewertungskurs'):null,manual_price_date:valuation_mode==='manual'?day(raw.manual_price_date,'Kursdatum',now,true):null};
}
