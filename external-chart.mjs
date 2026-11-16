const exchanges={XETRA:'XETR',F:'FWB',PA:'EURONEXT',AS:'EURONEXT',SW:'SIX',MI:'MIL',LSE:'LSE',KO:'KRX',KQ:'KRX',SHE:'SZSE',SHG:'SSE',HK:'HKEX',TO:'TSX'};
export function externalChartSymbol(asset){
 const m=/^([A-Z0-9_^+\-]+)\.([A-Z0-9]+)$/.exec(asset?.symbol||'');return m&&exchanges[m[2]]?exchanges[m[2]]+':'+m[1]:'';
}
export function mountExternalChart({document,container,symbol,confirmed=false,mini=false,onStatus=()=>{}}){
 if(!confirmed||!/^[A-Z0-9_]{2,20}:[A-Z0-9._^+\-]{1,30}$/.test(symbol||'')||/^(US|XETRA):/.test(symbol))throw Error('TradingView-Kennung mit bestätigtem Handelsplatz eingeben, z. B. XETR:VOW3. US-Sammelcodes sind keine eindeutige Chartbörse.');
 if(typeof document.createElement!=='function')throw Error('Externer Börsenchart ist in dieser Umgebung nicht verfügbar.');
 container.innerHTML='';
 const shell=document.createElement('div');shell.className='tradingview-widget-container';shell.style.height=(mini?170:350)+'px';shell.style.width='100%';const target=document.createElement('div');target.className='tradingview-widget-container__widget';target.style.height=(mini?140:320)+'px';target.style.width='100%';shell.appendChild(target);
 const attribution=document.createElement('div');attribution.className='tradingview-widget-copyright';const link=document.createElement('a');link.href='https://www.tradingview.com/';link.target='_blank';link.rel='noopener noreferrer';link.textContent='Kurschart von TradingView';attribution.appendChild(link);shell.appendChild(attribution);
 const script=document.createElement('script');script.type='text/javascript';script.src='https://s3.tradingview.com/external-embedding/embed-widget-'+(mini?'mini-symbol-overview':'symbol-overview')+'.js';script.async=true;
 script.textContent=JSON.stringify(mini?{symbol,width:'100%',height:140,locale:'de_DE',colorTheme:'dark',dateRange:'1M',isTransparent:true,autosize:true,chartOnly:true}:{symbols:[[symbol,symbol+'|1D']],chartOnly:false,width:'100%',height:320,locale:'de_DE',colorTheme:'dark',autosize:true,showVolume:false,showMA:false,hideDateRanges:false,hideMarketStatus:false,hideSymbolLogo:false,chartType:'area',dateRanges:['1d|1','1m|30','3m|60','12m|1D','60m|1W','all|1M']});
 script.onload=()=>onStatus('TradingView eingebunden. Verfügbarkeit und mögliche Verzögerung direkt im Widget beachten.');script.onerror=()=>onStatus('Der externe Chart konnte nicht geladen werden. Gespeicherte Kurse oder CSV bleiben nutzbar.',true);
 shell.appendChild(script);container.appendChild(shell);return ()=>{script.onload=null;script.onerror=null;container.innerHTML='';};
}
