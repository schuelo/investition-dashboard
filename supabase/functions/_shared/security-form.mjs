// Field changes are calculated before touching a form; this module never saves a trade.
export const ANALYSIS_CURRENCIES=['EUR','USD','GBP','GBX','CHF','JPY','KRW','CNY','HKD','SEK','AUD','CAD','INR'];
export const SECURITY_TARGETS=['trade','signal','deep','paper','csv','history','event'];
export function securityFieldChanges(scope,candidate,current={},options={}) {
  if(!SECURITY_TARGETS.includes(scope)||!candidate?.verified||!/^[A-Z0-9_^+\-]{1,25}\.[A-Z0-9]{1,12}$/.test(candidate.market_symbol||''))throw Error('Keine verifizierte Notierung ausgewählt.');
  const c=candidate,values={},messages=[];
  if(['signal','deep'].includes(scope)&&!ANALYSIS_CURRENCIES.includes(c.currency))throw Error('Diese Notierungswährung wird von der Analyse noch nicht unterstützt. Anderen Handelsplatz wählen.');
  const changed=(oldSymbol,oldCurrency)=>oldSymbol!==c.market_symbol||!!oldCurrency&&oldCurrency!==c.currency;
  if(scope==='trade') {
    const product=current.type==='Knock-out';
    Object.assign(values,{name:c.name,marketSymbol:c.market_symbol,currency:c.currency,symbol:options.chart_symbol||c.chart_symbol||'',type:product?'Knock-out':c.instrument_type});
    if(values.symbol&&!/^[A-Z0-9._-]+:[A-Z0-9._-]+$/.test(values.symbol))throw Error('TradingView benötigt BÖRSE:TICKER.');
    if(!values.symbol)throw Error('Chart-Handelsplatz noch wählen oder TradingView-Kennung ergänzen; der EODHD-Sammelcode ist dafür nicht eindeutig.');
    if(changed(current.marketSymbol,current.currency)) {
      for(const key of ['currentPrice','entryLow','entryHigh','limitPrice','stop','target1','target2','target3','quantity','positionValue'])values[key]='';
      if(product)for(const key of ['wkn','isin','issuer','expiry','koBarrier','strike','leverage','ratio','productPrice','koDistance'])values[key]='';
      messages.push('Wertpapier/Währung geändert: bisherige Kurse, Kursmarken und Ordermengen im Formular geleert.');
    }
    if(!product)Object.assign(values,{wkn:c.wkn||'',isin:c.isin});
    else messages.push('Basiswert übernommen. KO-Produktkennung und aktuelle Produktbedingungen separat eingeben.');
  } else if(scope==='signal')Object.assign(values,{ssSymbol:c.market_symbol,ssCompany:c.name,ssCurrency:c.currency});
  else if(scope==='deep') {
    Object.assign(values,{daSymbol:c.market_symbol,daCompany:c.name,daCurrency:c.currency});
    if(changed(current.daSymbol,current.daCurrency)) {
      Object.assign(values,{daEps:'0',daValSource:'',daCik:'',daCikVerified:false,daProductType:'none',daProductRef:'',daBarrier:'0',daFinance:'0',daPremium:'0',daStrike:'0',daTermsVerified:false,daIvVerified:false,daProductFxVerified:false,daRiskFxVerified:false,daRiskFx:'1',daProductFx:'1',daProductCurrency:c.currency});
      messages.push('Wertpapier/Währung geändert: alte EPS-/CIK-/Produktdaten und FX-Bestätigungen zurückgesetzt. Eigene Links, These und Historienauswahl auf Eignung prüfen.');
    }
  } else if(scope==='paper'||scope==='csv') {
    if(!((c.exchange==='XETRA'&&c.currency==='EUR')||(c.exchange==='US'&&c.currency==='USD')))throw Error('Das Papierdepot unterstützt aktuell XETRA/EUR oder US/USD. Anderen Handelsplatz wählen.');
    if(scope==='csv')values.ppCsvSymbol=c.market_symbol;
    else {
      const symbols=options.append?String(current.ppSymbols||'').trim().toUpperCase().split(/[\s,;]+/).filter(Boolean):[];
      if(symbols.some(s=>!s.endsWith('.'+c.exchange)))throw Error('Papierdepot: vorhandene Symbole haben eine andere Börse. Ersetzen wählen oder gleichartigen Handelsplatz auswählen.');
      const combined=[...new Set([...symbols,c.market_symbol])];if(combined.length>3)throw Error('Maximal drei Symbole je Papierexperiment.');
      values.ppSymbols=combined.join(', ');values.ppCurrency=c.currency;
      messages.push('Nur die Eingaben für ein neues Experiment geändert. Laufende Papierdepots behalten ihre Konfiguration.');
    }
  } else if(scope==='history')values.daHistorySymbol=c.market_symbol;
  else if(scope==='event') {
    const line='Wertpapier: '+c.name+' | EODHD '+c.market_symbol+' | ISIN '+c.isin+(c.wkn?' | WKN '+c.wkn:'');
    const existing=String(current.eventAnalysisInput||'');const text=existing.includes(line)?existing:(existing?existing+'\n\n':'')+line;
    if(text.length>2000)throw Error('Ereignistext zu lang; zuerst Platz für die Wertpapierkennung schaffen.');values.eventAnalysisInput=text;
  }
  return {values,messages};
}
