import {validateMarketChoice} from './supabase/functions/_shared/independent-market.mjs';
const ids={signal:'ss',deep:'da'},bindings=new Map(),confirmations=new Map();
const $=id=>document.getElementById(id);
const fingerprint=prefix=>JSON.stringify(['Symbol','Currency','QuoteSymbol'].map(s=>$(prefix+s).value.trim().toUpperCase()));
export function marketInput(scope,hasCsv=false) {
  const prefix=ids[scope];if(!prefix)throw Error('Unbekannter Analysebereich.');
  const source=$(prefix+'MarketSource').value,binding=bindings.get(scope);
  if(source==='eodhd'&&binding?.eodhd_verified===false&&!hasCsv)throw Error('Diese Zuordnung stammt aus OpenFIGI, nicht aus dem EODHD-Katalog. Unabhängige Quelle/CSV nutzen oder den Wert ausdrücklich mit EODHD suchen.');
  const confirmed=$(prefix+'QuoteConfirmed').checked&&confirmations.get(scope)===fingerprint(prefix);
  if(source==='independent'&&!hasCsv&&$(prefix+'QuoteConfirmed').checked&&!confirmed){$(prefix+'QuoteConfirmed').checked=false;throw Error('Analysekennung, Kurskennung oder Währung wurde seit der Bestätigung geändert. Zuordnung erneut prüfen und bestätigen.');}
  return validateMarketChoice({market_source:source,bars:hasCsv?[]:undefined,quote_symbol:$(prefix+'QuoteSymbol').value,
    quote_confirmed:confirmed,security_key:binding?.security_key||'',quote_figi:binding?.figi||''});
}
function install(scope,prefix) {
  const source=$(prefix+'MarketSource'),quote=$(prefix+'QuoteSymbol'),confirmed=$(prefix+'QuoteConfirmed');
  if(!source||!quote||!confirmed)return;
  confirmed.addEventListener('change',()=>{if(confirmed.checked)confirmations.set(scope,fingerprint(prefix));else confirmations.delete(scope);});
  source.addEventListener('change',()=>{confirmed.checked=false;});
  for(const el of [$(prefix+'Symbol'),$(prefix+'Currency'),quote])el?.addEventListener('input',()=>{bindings.delete(scope);confirmed.checked=false;});
  $(prefix+'Csv')?.addEventListener('change',()=>{if($(prefix+'Csv').files?.length)source.value='csv';confirmed.checked=false;});
  $(prefix+'ClearCsv')?.addEventListener('click',()=>{if(source.value==='csv')source.value='independent';});
}
if(typeof window!=='undefined'&&typeof document!=='undefined') {
  Object.entries(ids).forEach(([scope,prefix])=>install(scope,prefix));
  window.InvestitionMarketData={input:marketInput};
  window.addEventListener('investition:security-picked',event=>{
    const {scope,security}=event.detail||{},prefix=ids[scope];if(!prefix)return;
    bindings.set(scope,security);
    if(security.eodhd_verified===false){if($(prefix+'MarketSource').value!=='csv')$(prefix+'MarketSource').value='independent';$(prefix+'QuoteSymbol').value=security.quote_symbol||'';}
    else{$(prefix+'MarketSource').value='eodhd';$(prefix+'QuoteSymbol').value='';}
    $(prefix+'QuoteConfirmed').checked=false;
  });
  window.addEventListener('investition:market-copy',event=>{
    const {from,to}=event.detail||{},a=ids[from],b=ids[to];if(!a||!b)return;
    bindings.delete(to);if(bindings.has(from))bindings.set(to,bindings.get(from));
    $(b+'MarketSource').value=$(a+'MarketSource').value==='csv'?'independent':$(a+'MarketSource').value;
    $(b+'QuoteSymbol').value=$(a+'QuoteSymbol').value;$(b+'QuoteConfirmed').checked=false;
  });
  window.addEventListener('investition:auth-changed',()=>{bindings.clear();confirmations.clear();for(const prefix of Object.values(ids)){$(prefix+'QuoteSymbol').value='';$(prefix+'QuoteConfirmed').checked=false;}});
}
