import {e,dateTime} from './investment-view.mjs';
import {formatNumber} from './compact-analysis.mjs';
import {shareNumber} from './quantity-format.mjs';
import {displayQuote} from './direct-view.mjs';
import {positionPanel,quotePanel,automationPanel,positionEventsHtml} from './position-view.mjs';
import {refreshState,remoteSource} from './refresh-state.mjs';
import {alphaSymbolFor} from './supabase/functions/_shared/review-market-input.mjs';
import {PUBLIC_VENUES} from './supabase/functions/_shared/independent-market.mjs';

export function suggestedQuoteSymbol(asset,source){
 if(source==='eodhd')return asset.symbol;
 if(source==='alphavantage')return alphaSymbolFor(asset.symbol)||'';
 const i=asset.symbol.lastIndexOf('.'),ticker=asset.symbol.slice(0,i),venue=PUBLIC_VENUES[asset.symbol.slice(i+1)];
 return source==='independent'&&venue?.length?ticker+venue[0].suffix:'';
}
export function createProductionUI({window,document,now=()=>new Date(),ensureAsset,onArchived=()=>{},getSelected,getPortfolio,getAssets,getSeries,getCapabilities,getRoute,getEpoch,getOwner,isRunning,setBusy,invoke,loadAssets,onAsset,holdingEditor,status}){
 const $=id=>document.getElementById(id);let selectedKey='',tab='overview',busy=false,eventToken=0,archiveRequest=null,archiveAsset=null,eventsKey='';
 const same=(epoch,id)=>epoch===getEpoch()&&(!id||getSelected()?.id===id);
 const localStatus=(id,message,bad=false)=>{const el=$(id);el.textContent=message;el.setAttribute('role',bad?'alert':'status');};
 function setTab(value){
  if(!['overview','analysis','activity'].includes(value))return;tab=value;render();
  if(value==='activity'&&getSelected()?.id&&eventsKey!==getSelected().id)loadEvents();
 }
 function render(){
  const a=getSelected(),detail=getRoute()==='detail';$('rvDetailTabs').hidden=!detail;
  if(a?.id!==selectedKey){selectedKey=a?.id||'';tab='overview';eventsKey='';$('rvActivityList').innerHTML='';$('rvQuoteSetupPanel').hidden=true;$('rvArchivePanel').hidden=true;archiveRequest=null;archiveAsset=null;}
  $('rvOverviewContent').hidden=!detail||tab!=='overview';$('rvAnalysisContent').hidden=detail&&tab!=='analysis';$('rvActivityContent').hidden=!detail||tab!=='activity';
  for(const [name,id]of [['overview','rvTabOverview'],['analysis','rvTabAnalysis'],['activity','rvTabActivity']]){$(id).setAttribute('aria-selected',String(tab===name));$(id).setAttribute('tabindex',tab===name?'0':'-1');}
  if(!detail||!a){$('rvPositionSummary').hidden=true;$('rvQuoteStatus').hidden=true;return;}
  const h=getPortfolio()?.holdings?.find(h=>h.asset_id===a.id),q=displayQuote(a,{priceSeries:getSeries()[a.id],now:now()});
  $('rvMarketSummary').innerHTML='<p class="compact-eyebrow">Kurs je Anteil</p><div class="security-price">'+(q.price===null?'—':e(formatNumber(q.price)))+' <small>'+e(a.currency)+'</small></div><p class="security-price-date">'+e(q.price_date?'Schlusskurs vom '+q.price_date:'Noch kein gültiger Kurs')+(q.status==='stale'?' · veraltet':'')+' · '+e(q.source||'Gespeicherter Kurs')+'</p>';
  $('rvPositionSummary').hidden=false;$('rvPositionSummary').innerHTML=positionPanel(a,h);$('rvQuoteStatus').hidden=false;$('rvQuoteStatus').innerHTML=quotePanel(a,{capabilities:getCapabilities(),now:now()});
  $('rvArchiveValue').hidden=!a.id;$('rvArchiveValue').disabled=busy||!!a.archived_at;$('rvArchiveValue').textContent=a.archived_at?'Wert ist archiviert':'Wert entfernen / archivieren';
 }
 function renderOverview(){const a=getAssets().filter(a=>!a.archived_at);$('ivAutomation').innerHTML=automationPanel(getCapabilities(),a,now());}
 function quoteHelp(){
  const a=getSelected();if(!a)return;const source=$('qsSource').value,remote=remoteSource(source);$('qsSymbol').disabled=!remote;$('qsConfirmed').required=remote;
  const info=refreshState({...a,config:{...a.config,source,quote_confirmed:true}},{capabilities:getCapabilities()});
  $('qsHelp').textContent=(source==='independent'?'Experimentelle öffentliche Schnittstelle ohne garantierte Verfügbarkeit. Kein Umgehen von Anbieterlimits. ':source==='eodhd'?'Das gemeinsame vorhandene EODHD-Tagesbudget wird verwendet. ':source==='alphavantage'?'Eigener kostenloser Schlüssel nötig; bis zu 100 Tageskerzen. ':'Kein neuer Kursabruf. ')+a.symbol+' · '+a.currency+'. '+(info.code==='unconfigured'?info.detail:'Ein Symbolvorschlag muss von dir geprüft werden.');
 }
 async function configureQuotes(){
  let a=getSelected();const epoch=getEpoch();if(!a||busy)return;if(!a.id){try{a=await ensureAsset();if(epoch!==getEpoch())return;onAsset(a);}catch(error){if(epoch===getEpoch())status(error.message,true);return;}}setTab('overview');$('rvQuoteSetupPanel').hidden=false;$('qsSource').value=a.config?.source==='csv'?'stored':a.config?.source||'stored';$('qsSymbol').value=a.config?.quote_symbol||suggestedQuoteSymbol(a,$('qsSource').value);$('qsConfirmed').checked=a.config?.quote_confirmed===true;$('qsEnabled').checked=a.enabled===true;$('qsInterval').value=String(a.config?.refresh_minutes||60);quoteHelp();localStatus('qsStatus','');$('rvQuoteSetupPanel').scrollIntoView?.({block:'start',behavior:'smooth'});$('qsSource').focus?.();
 }
 async function saveQuotes(event){
  event.preventDefault();const a=getSelected(),epoch=getEpoch();if(!a?.id||busy||isRunning())return;busy=true;setBusy(true);$('qsSave').disabled=true;localStatus('qsStatus','Kurseinstellungen speichern …');
  try{const r=await invoke({action:'save_quote_settings',manual_start:true,asset_id:a.id,source:$('qsSource').value,quote_symbol:$('qsSymbol').value.trim().toUpperCase(),quote_confirmed:$('qsConfirmed').checked,enabled:$('qsEnabled').checked,refresh_minutes:Number($('qsInterval').value)});if(!same(epoch,a.id))return;onAsset(r.asset);localStatus('qsStatus','Gespeichert. Ein eingerichteter Hintergrundjob prüft diese Quelle im gewählten Intervall. „Jetzt aktualisieren“ startet einen einzelnen Kursabruf.');}
  catch(error){if(same(epoch,a.id))localStatus('qsStatus',error.message,true);}
  finally{if(epoch===getEpoch()){busy=false;setBusy(false);$('qsSave').disabled=false;}}
 }
 async function refreshQuotes(ids=null){
  if(busy||isRunning())return;const epoch=getEpoch();let candidates;
  if(ids)candidates=ids;else candidates=getAssets().filter(a=>!a.archived_at&&(getRoute()==='watch'?a.watchlisted:a.is_portfolio)&&remoteSource(a.config?.source)&&refreshState(a,{capabilities:getCapabilities(),now:now()}).code!=='cooldown').sort((a,b)=>(Date.parse(a.quote_status?.attempt?.at)||0)-(Date.parse(b.quote_status?.attempt?.at)||0)).map(a=>a.id);
  if(!candidates.length){status('Keine abrufbare automatische Kursquelle. Beim Wert „Kursautomatik einrichten“ wählen; Anbieterpausen bleiben bestehen.',true,'ivStatus');if(getSelected()?.id)configureQuotes();return;}
  busy=true;setBusy(true);$('ivRefreshQuotes').disabled=true;status('Kurse aktualisieren … Keine KI.',false,'ivStatus');
  try{const r=await invoke({action:'refresh_quotes',manual_start:true,asset_ids:candidates.slice(0,6)});if(epoch!==getEpoch())return;for(const v of r.results||[])if(v.asset)onAsset(v.asset);await loadAssets({force:true,sync:false});if(epoch!==getEpoch())return;const bad=(r.results||[]).filter(v=>v.error||['failed','not_run'].includes(v.attempt?.status));status((r.results?.length||0)+' Wert(e) geprüft'+(candidates.length>6?' · weitere Werte über den nächsten Lauf.':'.')+(bad.length?' '+bad.length+' Abruf(e) mit Hinweis; Details am Wertpapier.':' Datenstand am Chart beachten.'),bad.length>0,'ivStatus');}
  catch(error){if(epoch===getEpoch())status(error.message,true,'ivStatus');}
  finally{if(epoch===getEpoch()){busy=false;setBusy(false);$('ivRefreshQuotes').disabled=false;render();}}
 }
 async function removeWatch(a){
  if(!a||busy||isRunning())return;const epoch=getEpoch();busy=true;setBusy(true);
  try{const r=await invoke({action:'set_watchlist',asset_id:a.id,watchlisted:false});if(epoch!==getEpoch())return;onAsset(r.asset);await loadAssets({force:true,sync:false});status('Aus Beobachtung entfernt. Bestand und Berichtshistorie bleiben erhalten.',false,'ivStatus');}catch(error){if(epoch===getEpoch())status(error.message,true,'ivStatus');}finally{if(epoch===getEpoch()){busy=false;setBusy(false);}}
 }
 function openArchive(){
  const a=getSelected();if(!a?.id||busy)return;setTab('overview');archiveAsset=a.id;archiveRequest=crypto.randomUUID();$('rvArchivePanel').hidden=false;$('rvArchiveConfirmed').checked=false;$('rvArchiveSubmit').disabled=true;localStatus('rvArchiveStatus','');const h=getPortfolio()?.holdings?.find(h=>h.asset_id===a.id);$('rvArchiveDescription').textContent=(a.company||a.symbol)+(h?' · '+shareNumber(h.quantity)+' Anteile in '+h.positions+' Bestandsposten.':'.')+' Alle offenen Bestände werden ausgebucht und der Wert aus Depot sowie Beobachtung entfernt. Analysen, Gespräch und Änderungsverlauf bleiben im Archiv. Kein Verkaufserlös und keine Order.';$('rvArchivePanel').scrollIntoView?.({block:'center',behavior:'smooth'});$('rvArchiveConfirmed').focus?.();
 }
 async function archive(){
  const epoch=getEpoch(),id=archiveAsset;if(!id||!$('rvArchiveConfirmed').checked||busy||isRunning()||getSelected()?.id!==id)return;busy=true;setBusy(true);$('rvArchiveSubmit').disabled=true;localStatus('rvArchiveStatus','Alle Bestände ausbuchen und Wert archivieren …');
  try{await invoke({action:'archive_asset',asset_id:id,manual_start:true,confirm:true,request_id:archiveRequest});if(!same(epoch,id))return;$('rvArchivePanel').hidden=true;await loadAssets({force:true,sync:false});if(!same(epoch,id))return;onArchived();status('Wert ausgebucht und archiviert. Frühere Berichte bleiben erhalten.',false,'ivStatus');}
  catch(error){if(same(epoch,id))localStatus('rvArchiveStatus',error.message,true);}
  finally{if(epoch===getEpoch()){busy=false;setBusy(false);$('rvArchiveSubmit').disabled=!$('rvArchiveConfirmed').checked;render();}}
 }
 async function loadEvents(){
  const a=getSelected(),epoch=getEpoch(),token=++eventToken;if(!a?.id)return;localStatus('rvActivityList','Bestandsverlauf laden …');
  try{const r=await invoke({action:'get_position_events',asset_id:a.id});if(!same(epoch,a.id)||token!==eventToken)return;eventsKey=a.id;$('rvActivityList').innerHTML=positionEventsHtml(r.events);}
  catch(error){if(same(epoch,a.id)&&token===eventToken)localStatus('rvActivityList',error.message,true);}
 }
 document.addEventListener('click',async event=>{
  const b=event.target.closest?.('button');if(!b)return;
  if(b.dataset.securityTab)setTab(b.dataset.securityTab);
  if(b.dataset.openDiagnostics){$('ivDiagnostics').open=true;$('ivDiagnostics').scrollIntoView?.({block:'start',behavior:'smooth'});$('ivRunDiagnostics').click();}
  if(b.id==='rvEditPosition')return holdingEditor.open(getSelected());
  if(b.id==='rvAddLot')return holdingEditor.open(getSelected(),{mode:'add'});
  if(b.id==='rvBookOut')return holdingEditor.open(getSelected(),{mode:'close'});
  if(b.dataset.holdingEdit!==undefined){const a=getAssets()[Number(b.dataset.holdingEdit)];if(a&&!busy)return holdingEditor.open(a);}
  if(b.dataset.holdingClose!==undefined){const a=getAssets()[Number(b.dataset.holdingClose)];if(a&&!busy)return holdingEditor.open(a,{mode:'close'});}
  if(b.dataset.removeWatch!==undefined)return removeWatch(getAssets()[Number(b.dataset.removeWatch)]);
  if(b.id==='rvConfigureQuotes')return configureQuotes();
  if(b.id==='rvQuoteNow')refreshQuotes([getSelected()?.id].filter(Boolean));
  if(b.id==='ivRefreshQuotes')return refreshQuotes();
  if(b.id==='rvArchiveValue')openArchive();
  if(b.id==='rvArchiveCancel'){$('rvArchivePanel').hidden=true;archiveAsset=null;archiveRequest=null;}
  if(b.id==='rvArchiveSubmit')return archive();
  if(b.id==='qsCancel')$('rvQuoteSetupPanel').hidden=true;
  if(b.id==='rvLoadActivity')return loadEvents();
  if(['rvAnalyze','rvPlan','rvAsk'].includes(b.id))setTab('analysis');
 });
 $('rvDetailTabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const values=['overview','analysis','activity'],i=values.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:2))%3;setTab(values[next]);$('rvTab'+['Overview','Analysis','Activity'][next]).focus?.();});
 $('qsForm').addEventListener('submit',saveQuotes);$('qsSource').addEventListener('change',()=>{const a=getSelected();if(!a)return;$('qsSymbol').value=suggestedQuoteSymbol(a,$('qsSource').value);$('qsConfirmed').checked=false;quoteHelp();});
 $('qsSymbol').addEventListener('input',()=>{$('qsConfirmed').checked=false;});$('rvArchiveConfirmed').addEventListener('change',()=>{$('rvArchiveSubmit').disabled=!$('rvArchiveConfirmed').checked||busy;});
 const timer=window.setInterval?.(()=>{if(!document.hidden&&getOwner()&&!busy&&!isRunning())return loadAssets({force:false,sync:false});},120000);
 function reset(){eventToken++;eventsKey='';selectedKey='';tab='overview';busy=false;archiveAsset=null;archiveRequest=null;$('rvQuoteSetupPanel').hidden=true;$('rvArchivePanel').hidden=true;$('rvActivityList').innerHTML='';$('qsStatus').textContent='';$('rvArchiveStatus').textContent='';$('ivRefreshQuotes').disabled=false;}
 return {render,renderOverview,setTab,configureQuotes,refreshQuotes,removeWatch,loadEvents,openArchive,archive,reset,destroy(){if(timer)window.clearInterval?.(timer);reset();}};
}
