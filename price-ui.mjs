import {CHART_PERIODS,lineChart} from './price-charts.mjs';
import {externalChartSymbol,mountExternalChart} from './external-chart.mjs';
import {historyWindow,periodButtons,windowCaption} from './chart-window.mjs';
export function createPriceUI({document,window,invoke,getAssets,getAsset,getVisible,getInput,ensureAsset,getOwner,getCapabilities,onCapabilities=()=>{},onSeriesChanged=()=>{},onChanged=()=>{},onBusy=()=>{},isRunning=()=>false,now=()=>new Date()}){
 const $=id=>document.getElementById(id);let series={},versions={},generation=0,operation=0,busy=false,period='1M',userPeriod=false,pickedDate=null,openedKey='',destroyExternal=null,externalMode='';
 const status=(text,bad=false)=>{$('rvPriceStatus').textContent=text;$('rvPriceStatus').setAttribute('role',bad?'alert':'status');};
 const key=a=>a?.id||[a?.symbol,a?.currency].join('|');
 function clearExternal(){destroyExternal?.();destroyExternal=null;externalMode='';$('rvExternalHost').innerHTML='';}
 async function support(){let c=getCapabilities();if(!c){c=await invoke({action:'capabilities'});onCapabilities(c);}if(!c.features?.includes('price_charts_v393'))throw Error('Kursgrafiken benötigen die aktuelle Function. Action „V39.5 Übersicht und Charts deployen“ ausführen.');return c;}
 function render(){
  const a=getAsset(),visible=getVisible()&&!!a;$('rvPricePanel').hidden=!visible;if(!visible){clearExternal();return;}
  const k=key(a);if(k!==openedKey){openedKey=k;period='1M';userPeriod=false;pickedDate=null;clearExternal();$('rvExternalSymbol').value=externalChartSymbol(a);$('rvExternalConfirmed').checked=false;$('rvExternalDetails').open=false;}
  const s=series[a.id],points=historyWindow(s?.points,period,{now:now()}).points;
  $('rvPricePeriods').innerHTML=periodButtons(s?.points,{selected:period,scope:'price',now:now()});
  $('rvPricePlot').innerHTML=s?.points?.length?lineChart(s.points,{period,now:now(),anchor:'latest',width:$('rvPricePlot').clientWidth||640,currency:a.currency,selected:pickedDate,label:s.kind==='manual_valuation'?'Manuell erfasste Bewertung':'Gespeicherter historischer Kursverlauf'}):'<div class="price-empty">'+(s?.status==='loading'?'Gespeicherten Kursverlauf laden …':'Keine gespeicherte Historie. Kursdaten laden oder eine CSV importieren.')+'</div>';
  $('rvPriceInfo').textContent=s?.points?.length?[s.source,s.points.length+' gespeicherte Werte',windowCaption(s.points,period,{now:now()}),s.kind==='observed_prices'?'Einzelkurse':s.kind==='manual_valuation'?'Eigene Bewertung':''].filter(Boolean).join(' · '):'Ein externer Börsenchart ist bei Bedarf separat unter Datenquellen aufrufbar.';
  $('rvPriceCursorLabel').hidden=points.length<2;$('rvPriceCursor').max=String(Math.max(0,points.length-1));$('rvPriceCursor').value=String(Math.max(0,pickedDate?points.findIndex(p=>p.date===pickedDate):points.length-1));$('rvPriceCursor').disabled=busy;
  $('rvRefreshPrices').disabled=busy||isRunning();
 }
 async function load(values){
  const captured=generation,owner=getOwner(),assets=values.filter(a=>a?.id).slice(0,72);if(!owner||!assets.length)return;
  const mine={};for(const a of assets){mine[a.id]=versions[a.id]=(versions[a.id]||0)+1;if(!series[a.id]?.points?.length)series[a.id]={status:'loading',points:[]};}
  onSeriesChanged();render();
  try{
   await support();if(captured!==generation||owner!==getOwner())return;
   for(let i=0;i<assets.length;i+=24){const batch=assets.slice(i,i+24),r=await invoke({action:'get_chart_series',asset_ids:batch.map(a=>a.id)});if(captured!==generation||owner!==getOwner())return;
    for(const s of r.series||[]){const a=batch.find(a=>a.id===s.asset_id);if(a&&s.symbol===a.symbol&&s.currency===a.currency&&versions[a.id]===mine[a.id])series[a.id]=s;}
   }
  }catch(error){if(captured!==generation)return;for(const a of assets)if(versions[a.id]===mine[a.id])series[a.id]={...(series[a.id]||{}),status:series[a.id]?.points?.length?'ready':'error',warning:error.message};if(getVisible())status(error.message,true);}
  finally{if(captured===generation&&owner===getOwner()){onSeriesChanged();render();}}
 }
 async function open(){render();const a=getAsset();if(a?.id&&!(series[a.id]?.kind==='price_history'&&series[a.id]?.points?.length>=2))await load([a]);render();}
 async function refresh(){
  if(busy||isRunning())return;const captured=generation,owner=getOwner();if(!owner)return;const op=++operation;busy=true;onBusy(true);status('Kursverlauf aktualisieren. Kein KI-Aufruf.');render();
  try{
   const cap=await support();if(captured!==generation)return;
   const a=getAsset();if(!a?.id)throw Error('Für gespeicherte Kursdaten den Wert zuerst merken oder als Depotposition speichern. Der separate Börsenchart ist auch ohne Speichern verfügbar.');if(captured!==generation||owner!==getOwner())return;const form=getInput();
   if(form.source==='alphavantage'&&!cap.alpha_configured)throw Error('Alpha Vantage ist nicht eingerichtet. Kursquelle/CSV wählen oder den separaten TradingView-Chart verwenden.');
   const input=Object.fromEntries(['symbol','currency','company','source','quote_symbol','quote_confirmed','days','lookback','bars'].filter(k=>form[k]!==undefined).map(k=>[k,form[k]]));
   const requestVersion=versions[a.id]=(versions[a.id]||0)+1,r=await invoke({action:'refresh_chart',manual_start:true,asset_id:a.id,...input});if(captured!==generation||owner!==getOwner()||versions[a.id]!==requestVersion)return;
   if(r.series?.symbol===a.symbol&&r.series.currency===a.currency)series[a.id]=r.series;await onChanged(r);
   if(captured===generation){onSeriesChanged();render();status(r.warning||r.attempt?.error||(input.source==='stored'?'Gespeicherten Verlauf angezeigt. Kein neuer Kursabruf.':'Kursverlauf aktualisiert. Die bisherige Einschätzung bleibt an ihren ursprünglichen Bericht gebunden.'),!!(r.attempt?.error));}
  }catch(error){if(captured===generation)status(error.message,true);}
  finally{if(op===operation&&captured===generation){busy=false;onBusy(false);render();}}
 }
 function clear(){generation++;operation++;series={};versions={};busy=false;period='1M';pickedDate=null;openedKey='';clearExternal();for(const id of ['rvPricePlot','rvPricePeriods'])$(id).innerHTML='';$('rvPriceInfo').textContent='';$('rvExternalSymbol').value='';$('rvExternalConfirmed').checked=false;$('rvPriceCursor').value='0';$('rvPriceCursorLabel').hidden=true;$('rvPricePanel').hidden=true;status('');}
 $('rvPricePeriods').addEventListener('click',event=>{const p=event.target.closest?.('button')?.dataset?.pricePeriod;if(CHART_PERIODS.includes(p)){period=p;userPeriod=true;pickedDate=null;render();}});
 $('rvPriceCursor').addEventListener('input',()=>{const a=getAsset(),s=series[a?.id],rows=historyWindow(s?.points,period,{now:now()}).points;pickedDate=rows[Number($('rvPriceCursor').value)]?.date||null;if(a&&s)$('rvPricePlot').innerHTML=lineChart(s.points,{period,now:now(),anchor:'latest',width:$('rvPricePlot').clientWidth||640,currency:a.currency,selected:pickedDate});});
 $('rvRefreshPrices').addEventListener('click',refresh);
 $('rvChoosePriceSource').addEventListener('click',()=>{$('rvInputs').open=true;$('rvQuoteSettings').open=true;$('rvQuoteSettings').scrollIntoView?.({behavior:'smooth',block:'start'});});
 $('rvExternalLoad').addEventListener('click',()=>{if(!getOwner()||!getAsset()||busy||isRunning())return;try{clearExternal();const captured=generation;destroyExternal=mountExternalChart({document,container:$('rvExternalHost'),symbol:$('rvExternalSymbol').value.trim().toUpperCase(),confirmed:$('rvExternalConfirmed').checked,onStatus:(message,bad)=>{if(captured===generation)status(message,bad);}});externalMode='manual';status('Externer Börsenchart angefordert. Widgetkurse werden nicht als Depot-/Analysekurse übernommen.');}catch(error){status(error.message,true);}});
 $('rvExternalSymbol').addEventListener('input',()=>{$('rvExternalConfirmed').checked=false;});
 window?.addEventListener('resize',()=>{if(getVisible())render();});
 return {load,open,render,refresh,clear,getSeries:()=>series};
}
