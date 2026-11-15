import {e,dateTime,assetView,assetCard,portfolioCounts,reviewHtml} from './investment-view.mjs?v=38.0.0';
import {parseOhlcvCsv} from './supabase/functions/_shared/signal-engine.mjs';
import {alphaSymbolFor} from './supabase/functions/_shared/review-market-input.mjs';
import {modelChart} from './compact-analysis.mjs';
import {quoteStatus} from './supabase/functions/_shared/investment-review.mjs';

export function createInvestmentUI({window,document,now=()=>new Date()}){
  const $=id=>document.getElementById(id),access=()=>({sb:window.InvestitionDashboard?.getSupabase?.(),owner:window.InvestitionDashboard?.getSession?.()?.user?.id||null});
  let assets=[],unmapped=[],selected=null,current=null,imported=null,epoch=0,loadToken=0,openToken=0,csvToken=0,csvLoading=false,loading=false,running=false,chatting=false,filter='all',scenario='base',direction='long',messages=[],messageLimit=40,lastLoaded=0,lastOwner=null,observer=null,capabilities=null;
  const identityKey=()=>JSON.stringify([$('rvSymbol').value.trim().toUpperCase(),$('rvCurrency').value]);let lastIdentity=identityKey();
  function status(message,bad=false,id='rvStatus'){const el=$(id);if(!el)return;el.textContent=message;el.className='compact-status '+(bad?'bad':'');el.setAttribute('role',bad?'alert':'status');}
  function closeMenu(){delete document.documentElement.dataset.investmentMenu;for(const id of ['reviewMoreBtn','reviewDockMore'])$(id)?.setAttribute('aria-expanded','false');}
  function updateNav(){const portfolio=!$('decisionPage').hidden,review=!$('signalSimulationPage').hidden;document.querySelectorAll('[data-review-nav]').forEach(b=>{const yes=b.dataset.reviewNav==='portfolio'?portfolio:b.dataset.reviewNav==='review'?review:false;if(yes)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});}
  function navigate(view){if(view==='portfolio')$('navDecisionBtn').click();else{$('navSignalSimulationBtn').click();document.documentElement.dataset.reviewView=view==='legacy'?'legacy':'review';}closeMenu();updateNav();}
  async function invoke(body){
    const {sb,owner}=access(),captured=epoch;if(!sb||!owner)throw Error('Im Dashboard anmelden.');
    const r=await sb.functions.invoke('review-investments',{body});
    if(captured!==epoch||owner!==access().owner){const e=Error('Sitzung geändert.');e.name='StaleResponse';throw e;}
    if(r.error){let text=r.error.message;try{text=(await r.error.context.clone().json()).error||text;}catch{}throw Error(text||'V38-Function nicht erreichbar. SQL und Deployment prüfen.');}
    if(!r.data?.ok)throw Error(r.data?.error||'Kein Ergebnis empfangen.');return r.data;
  }
  function renderPortfolio(){
    const counts=portfolioCounts(assets,now()),labels={all:'Alle',current:'Kurs aktuell',stale:'Veraltet',missing:'Kurs fehlt',failed:'Abruf fehlgeschlagen',not_run:'Abruf nicht erfolgt'};
    $('ivFilters').innerHTML=Object.entries(labels).map(([k,v])=>'<button class="btn" type="button" data-review-filter="'+k+'" aria-pressed="'+(filter===k)+'">'+e(v)+' · '+counts[k]+'</button>').join('');
    $('ivAssets').innerHTML=assets.map((a,i)=>({a,i,v:assetView(a,now())})).filter(({v})=>filter==='all'||filter==='failed'&&v.failed||filter==='not_run'&&v.notRun||filter===v.quote.code).map(({a,i})=>assetCard(a,{index:i,now:now()})).join('')||'<p class="iv-empty">Keine Positionen für diesen Filter. Depot abgleichen oder ein Wertpapier prüfen.</p>';
    $('ivUnmapped').innerHTML=unmapped.length?'<details class="compact-original" open><summary>Depotzuordnung ergänzen · '+unmapped.length+'</summary>'+unmapped.map((p,i)=>'<button class="iv-history-item" type="button" data-review-unmapped="'+i+'">'+e(p.name||'Depotposition')+' · '+e(p.symbol||'Kennung fehlt')+' · Zuordnung über WKN/ISIN prüfen</button>').join('')+'</details>':'';
  }
  async function loadAssets({force=false,sync=true}={}){
    const {sb,owner}=access();if(!sb||!owner){status('Depot nach Anmeldung verfügbar.',false,'ivStatus');return;}
    if(loading||!force&&owner===lastOwner&&now().getTime()-lastLoaded<60000)return;
    const token=++loadToken,captured=epoch;loading=true;$('ivLoad').disabled=true;status('Eigene Depotzuordnungen und gespeicherte Ergebnisse laden. Kein KI- oder Kursabruf.',false,'ivStatus');
    try{
      if(sync){const r=await invoke({action:'sync_portfolio'});if(token!==loadToken||captured!==epoch)return;unmapped=r.unmapped||[];}
      const r=await sb.from('investment_assets').select('*').eq('user_id',owner).order('is_portfolio',{ascending:false}).order('company',{ascending:true}).limit(500);
      if(token!==loadToken||captured!==epoch||owner!==access().owner)return;if(r.error)throw Error('V38-Datenbank noch nicht erreichbar. setup-v38-investment-review.sql und Function installieren.');
      assets=(r.data||[]).filter(a=>a.user_id===owner);lastLoaded=now().getTime();lastOwner=owner;renderPortfolio();status('Gespeicherte Einschätzungen geladen. Kursalter und Abrufstatus werden getrennt angezeigt.',false,'ivStatus');
      try{capabilities=await invoke({action:'capabilities'});if(captured===epoch)$('ivMonitorStatus').textContent=capabilities.monitor_last_run?'Letzter Hintergrundlauf: '+dateTime(capabilities.monitor_last_run)+' · Nur aktiv markierte Werte werden geprüft.':'Noch kein Hintergrundlauf nachgewiesen. V38-Zeitplan installieren; markierte Werte bleiben bis dahin manuell prüfbar.';}catch{}
    }catch(error){if(captured===epoch&&error.name!=='StaleResponse')status(error.message,true,'ivStatus');}
    finally{if(token===loadToken){loading=false;$('ivLoad').disabled=false;}}
  }
  function setBusy(value){running=value;for(const id of ['rvRun','rvSave','rvNew'])$(id).disabled=value;$('investmentReviewModule').setAttribute('aria-busy',String(value));}
  function fillForm(asset){
    window.dispatchEvent(new CustomEvent('investition:reset-security-picker',{detail:{scope:'review'}}));
    const c=asset.config||{},p=c.policy||{};
    for(const [id,v] of Object.entries({rvAssetId:asset.id,rvSymbol:asset.symbol,rvCurrency:asset.currency,rvCompany:asset.company,rvSource:c.source||'stored',rvQuoteSymbol:c.quote_symbol||'',rvDays:c.days||20,rvLookback:c.lookback||252,rvWkn:c.wkn||'',rvIsin:c.isin||'',rvBudget:p.budget||0,rvTranches:p.tranches||3,rvStop:p.stop||'',rvTarget:p.target||'',rvContext:c.context||'',rvUrls:(c.manual_urls||[]).join('\n')}))$(id).value=String(v??'');
    $('rvQuoteConfirmed').checked=c.quote_confirmed===true;$('rvResearch').checked=c.research===true;clearImport('Kein neuer CSV-Import. Gespeicherte Kurse können wiederverwendet werden.');
    lastIdentity=identityKey();
  }
  function formInput(){
    const value=id=>$(id).value.trim(),policy={budget:value('rvBudget'),tranches:value('rvTranches'),stop:value('rvStop'),target:value('rvTarget')};
    return {symbol:value('rvSymbol').toUpperCase(),currency:value('rvCurrency'),company:value('rvCompany'),wkn:value('rvWkn'),isin:value('rvIsin'),source:value('rvSource'),quote_symbol:value('rvQuoteSymbol').toUpperCase(),quote_confirmed:$('rvQuoteConfirmed').checked,
      days:Number(value('rvDays')),lookback:Number(value('rvLookback')),context:value('rvContext'),policy,research:$('rvResearch').checked,manual_urls:value('rvUrls'),...(imported?{bars:imported}:{}),...($('rvAssetId').value?{asset_id:$('rvAssetId').value}:{}),...($('rvPositionId').value?{position_id:$('rvPositionId').value}:{})};
  }
  function renderReview(){
    if(!current)return;observer?.disconnect();const width=$('rvResultBody').clientWidth||320;
    $('rvResultBody').innerHTML=reviewHtml(current,{now:now(),scenario,direction,width:Math.min(width,900)});$('rvResult').hidden=false;
    const target=$('rvChart'),draw=()=>{if(target&&current?.analysis)target.innerHTML=modelChart(current.analysis,{scenarioId:scenario,width:target.clientWidth||320,blocked:quoteStatus(current.price_date,now()).code!=='current'||current.analysis.quality.blocked});};draw();
    if(window.ResizeObserver&&target){let previous=target.clientWidth;observer=new window.ResizeObserver(()=>{if(target.clientWidth!==previous){previous=target.clientWidth;draw();}});observer.observe(target);}
    $('rvConversation').hidden=!current.saved||!current.id;$('rvHistoryPanel').hidden=!current.saved||!current.id;
    $('rvChatContext').textContent='Kontext: '+current.symbol+' · Bericht '+dateTime(current.created_at)+' · Kurs '+(current.price_date||'fehlt')+'. Antworten bleiben an diesen Bericht gebunden.';
  }
  async function readReport(asset,id){
    const {sb,owner}=access(),captured=epoch,token=++openToken;
    const r=await sb.from('investment_reviews').select('*').eq('user_id',owner).eq('asset_id',asset.id).eq('id',id).maybeSingle();
    if(captured!==epoch||token!==openToken||owner!==access().owner)return null;
    if(r.error||!r.data||r.data.user_id!==owner||r.data.asset_id!==asset.id||r.data.snapshot?.symbol!==asset.symbol||r.data.snapshot?.currency!==asset.currency)throw Error('Eigener gespeicherter Bericht nicht verfügbar.');
    return {...r.data.snapshot,id:r.data.id,asset_id:asset.id,saved:true};
  }
  async function openAsset(asset,id=asset.latest_review_id,{fill=true}={}){
    const captured=epoch;selected=asset;current=null;scenario='base';direction='long';messages=[];messageLimit=40;$('rvMessages').innerHTML='';$('rvResult').hidden=true;$('rvConversation').hidden=true;$('rvHistoryPanel').hidden=true;$('rvPositionId').value='';
    if(fill)fillForm(asset);status('Gespräch wird für diesen Wert geladen.',false,'rvChatStatus');navigate('review');
    if(!id){$('rvInputs').open=true;status('Wert geöffnet. Kursquelle und Plan prüfen; Start bleibt manuell.');return;}
    try{const report=await readReport(asset,id);if(!report||captured!==epoch||selected?.id!==asset.id)return;current=report;renderReview();$('rvInputs').open=false;status('Gespeicherten Bericht geöffnet. Kursdatum und letzten Abruf im Depot beachten.');await loadMessages();}
    catch(error){if(captured===epoch)status(error.message,true);}
  }
  function clearImport(message='Kein neuer CSV-Import.'){csvToken++;csvLoading=false;imported=null;$('rvCsv').value='';$('rvCsvStatus').textContent=message;if(!running)$('rvRun').disabled=false;}
  function newSecurity(){if(running)return;selected=null;current=null;messages=[];clearImport();openToken++;observer?.disconnect();$('rvForm').reset();lastIdentity=identityKey();window.dispatchEvent(new CustomEvent('investition:reset-security-picker',{detail:{scope:'review'}}));$('rvAssetId').value='';$('rvPositionId').value='';$('rvResult').hidden=true;$('rvConversation').hidden=true;$('rvHistoryPanel').hidden=true;$('rvInputs').open=true;navigate('review');status('Neuen Wert über WKN/ISIN auswählen.');}
  async function run(saveOnly=false){
    if(running)return;const captured=epoch;let input;try{if(csvLoading)throw Error('CSV-Import wird noch gelesen.');input=formInput();if(input.source==='csv'&&!imported)throw Error('Zuerst eine CSV-Datei importieren.');}catch(error){$('rvInputs').open=true;status(error.message+(current?' Der vorherige Bericht behält seinen ursprünglichen Datenstand.':''),true);return;}
    setBusy(true);status(saveOnly?'Plan wird gespeichert. Kein Kurs- oder KI-Abruf.':'Prüfung angefordert. Kurse und Nachrichten werden geprüft; keine KI angefordert.');
    try{const r=await invoke({action:saveOnly?'save_config':'analyze',manual_start:true,request_id:crypto.randomUUID(),...input});if(captured!==epoch)return;
      if(saveOnly){selected=r.asset;$('rvAssetId').value=r.asset.id;status('Plan und Quellenwahl gespeichert. Eine Analyse wurde nicht gestartet.');}
      else{current=r.review;selected={id:current.asset_id,symbol:current.symbol,currency:current.currency,company:current.company,config:input};$('rvAssetId').value=current.asset_id||'';$('rvPositionId').value='';scenario='base';renderReview();$('rvInputs').open=false;status(current.saved?'Prüfung abgeschlossen und gespeichert. Datenstand und Abrufhinweise beachten.':'Ergebnis verfügbar, Speicherung fehlgeschlagen. Bericht exportieren.',!current.saved);if(current.saved)await loadMessages();}
      await loadAssets({force:true,sync:false});
    }catch(error){if(captured===epoch&&error.name!=='StaleResponse'){$('rvInputs').open=true;status(error.message+(current?' Der vorherige Bericht bleibt mit ursprünglichem Datenstand sichtbar.':''),true);}}
    finally{if(captured===epoch)setBusy(false);}
  }
  function renderMessages(){
    $('rvMessages').innerHTML=messages.map(m=>'<article class="iv-message '+e(m.role)+(m.is_error?' is-error':'')+'"><small>'+e(({user:'Du',assistant:m.provider==='gemini'?'Gemini · '+(m.model||''):'Statusmeldung',note:'Deine Notiz',external:'Externe Antwort · ungeprüft'})[m.role]||m.role)+' · '+e(dateTime(m.created_at))+'</small><p>'+e(m.content)+'</p><small>Berichtsbezug: '+e(m.review_id||'ohne')+(m.evidence_ids?.length?' · Quellen: '+e(m.evidence_ids.join(', ')):'')+'</small></article>').join('')||'<p class="compact-muted">Noch kein Gespräch. Eine Frage senden oder eine eigene Notiz speichern.</p>';
  }
  async function loadMessages(){
    if(!selected||!current?.saved)return;const asset=selected.id,captured=epoch,{sb,owner}=access();
    const r=await sb.from('investment_chat_messages').select('*').eq('user_id',owner).eq('asset_id',asset).order('sequence',{ascending:false}).limit(messageLimit);
    if(captured!==epoch||selected?.id!==asset||owner!==access().owner)return;if(r.error){status('Gespräch nicht erreichbar. Analyse bleibt verfügbar.',true,'rvChatStatus');return;}
    messages=(r.data||[]).filter(m=>m.user_id===owner&&m.asset_id===asset).reverse();renderMessages();$('rvMoreMessages').disabled=messages.length<messageLimit;
  }
  async function sendMessage(){
    if(chatting||!current?.saved||!selected)return;const captured=epoch,asset=selected.id,review=current.id,message=$('rvMessage').value.trim();if(message.length<2)return;
    chatting=true;$('rvChatSend').disabled=true;status($('rvChatMode').value==='chat'?'Gemini-Antwort ausdrücklich angefordert.':'Nachricht wird ohne KI gespeichert.',false,'rvChatStatus');
    try{const r=await invoke({action:$('rvChatMode').value,asset_id:asset,review_id:review,request_id:crypto.randomUUID(),manual_start:true,message});if(captured!==epoch||selected?.id!==asset)return;
      if(r.saved===false){status(r.answer?.answer||'Antwort nicht gespeichert. Vor dem Schließen kopieren.',true,'rvChatStatus');}
      else{$('rvMessage').value='';await loadMessages();status(r.answer?.is_error?r.answer.answer:'Nachricht gespeichert. Der Chat verändert keine Depotposition und führt keine Order aus.',!!r.answer?.is_error,'rvChatStatus');}
    }catch(error){if(captured===epoch&&selected?.id===asset&&error.name!=='StaleResponse')status(error.message,true,'rvChatStatus');}
    finally{if(captured===epoch){chatting=false;$('rvChatSend').disabled=false;}}
  }
  async function history(){if(!selected)return;const asset=selected,captured=epoch,{sb,owner}=access();const r=await sb.from('investment_reviews').select('id,user_id,asset_id,created_at,snapshot').eq('user_id',owner).eq('asset_id',asset.id).order('created_at',{ascending:false}).limit(40);if(captured!==epoch||selected?.id!==asset.id)return;if(r.error){status('Historie nicht erreichbar.',true);return;}$('rvHistory').innerHTML=(r.data||[]).filter(r=>r.user_id===owner&&r.asset_id===asset.id).map(r=>'<button type="button" class="iv-history-item" data-review-history="'+e(r.id)+'">'+e(dateTime(r.created_at))+' · '+e(r.snapshot.decision?.label||'Bericht')+' · Kurs '+e(r.snapshot.price_date||'fehlt')+'</button>').join('')||'<p>Noch keine Historie.</p>';}
  function reset(){
    epoch++;loadToken++;openToken++;observer?.disconnect();observer=null;
    assets=[];unmapped=[];selected=null;current=null;messages=[];messageLimit=40;capabilities=null;loading=false;lastLoaded=0;lastOwner=null;chatting=false;
    setBusy(false);clearImport();$('ivLoad').disabled=false;$('ivCheck').disabled=false;$('rvChatSend').disabled=false;
    $('rvForm').reset();lastIdentity=identityKey();$('rvAssetId').value='';$('rvPositionId').value='';$('rvMessage').value='';
    for(const id of ['rvMessages','rvHistory','rvResultBody','ivUnmapped','rvChatContext'])$(id).innerHTML='';
    $('rvChatContext').textContent='';
    $('rvResult').hidden=true;$('rvConversation').hidden=true;$('rvHistoryPanel').hidden=true;
    status('Sitzung geändert. Wertpapier neu öffnen.');status('Gespräch nach Anmeldung neu öffnen.',false,'rvChatStatus');status('Depot nach Anmeldung neu laden.',false,'ivStatus');
    $('ivMonitorStatus').textContent='Hintergrundstatus nach Anmeldung verfügbar.';renderPortfolio();closeMenu();
  }
  document.addEventListener('click',event=>{
    const b=event.target.closest?.('button');if(!b)return;
    if(b.dataset.reviewNav&&b.dataset.reviewNav!=='more')navigate(b.dataset.reviewNav);
    if(b.dataset.reviewNav==='more'||b.id==='reviewMoreBtn'){const open=document.documentElement.dataset.investmentMenu!=='open';if(open)document.documentElement.dataset.investmentMenu='open';else closeMenu();for(const id of ['reviewMoreBtn','reviewDockMore'])$(id)?.setAttribute('aria-expanded',String(open));if(open)$('compactMainNav').scrollIntoView?.({behavior:'smooth',block:'start'});}
    if(b.dataset.reviewFilter){filter=b.dataset.reviewFilter;renderPortfolio();}
    if(b.dataset.reviewOpen!==undefined){const a=assets[Number(b.dataset.reviewOpen)];if(a&&!running)openAsset(a);}
    if(b.dataset.reviewUnmapped!==undefined){const p=unmapped[Number(b.dataset.reviewUnmapped)];if(p){newSecurity();$('rvPositionId').value=p.id;$('rvCompany').value=p.name||'';if(p.currency)$('rvCurrency').value=p.currency;status('Depotposition über WKN/ISIN eindeutig zuordnen. Die bestehende Position bleibt erhalten.');}}
    if(b.dataset.reviewScenario&&current?.analysis?.scenarios.some(s=>s.id===b.dataset.reviewScenario)){scenario=b.dataset.reviewScenario;renderReview();}
    if(b.dataset.reviewHistory&&selected)openAsset(selected,b.dataset.reviewHistory,{fill:false});
    if(b.id==='reviewLegacyBtn'){navigate('legacy');window.InvestitionCompact?.showTab('signal');}
    if(b.id==='reviewBenchmarkBtn'){navigate('legacy');window.InvestitionCompact?.showTab('paper');}
  });
  document.addEventListener('change',async event=>{
    const el=event.target;
    if(el.id==='rvDirection'){direction=el.value;renderReview();}
    if(el.dataset?.reviewMonitor){const captured=epoch;el.disabled=true;try{await invoke({action:'set_monitoring',asset_id:el.dataset.reviewMonitor,enabled:el.checked});if(captured===epoch)await loadAssets({force:true,sync:false});}catch(error){if(captured===epoch){el.checked=!el.checked;status(error.message,true,'ivStatus');}}finally{if(captured===epoch)el.disabled=false;}}
  });
  $('rvForm').addEventListener('submit',event=>{event.preventDefault();run();});$('rvChatForm').addEventListener('submit',event=>{event.preventDefault();sendMessage();});
  $('rvForm').addEventListener('invalid',event=>{$('rvInputs').open=true;status('Eingabe prüfen: '+(event.target.labels?.[0]?.textContent||event.target.id),true);},true);
  $('rvSave').addEventListener('click',()=>run(true));$('rvNew').addEventListener('click',newSecurity);$('ivNew').addEventListener('click',newSecurity);$('ivLoad').addEventListener('click',()=>loadAssets({force:true}));
  $('ivCheck').addEventListener('click',async()=>{const captured=epoch;$('ivCheck').disabled=true;status('Depotprüfung auf dem Server angefordert. Keine KI.',false,'ivStatus');try{const r=await invoke({action:'monitor_once',manual_start:true});await loadAssets({force:true,sync:false});if(captured===epoch)status(r.checked+' markierte Werte geprüft.'+(r.results.some(v=>v.error)?' Einzelne Prüfungen konnten nicht abgeschlossen werden.':''),r.results.some(v=>v.error),'ivStatus');}catch(error){if(captured===epoch)status(error.message,true,'ivStatus');}finally{if(captured===epoch)$('ivCheck').disabled=false;}});
  $('rvCsv').addEventListener('change',async event=>{
    const captured=epoch,token=++csvToken;csvLoading=true;$('rvRun').disabled=true;
    try{const file=event.target.files?.[0];if(!file){imported=null;return;}if(file.size>600000)throw Error('CSV maximal 600 kB.');const bars=parseOhlcvCsv(await file.text());if(captured!==epoch||token!==csvToken)return;imported=bars;$('rvSource').value='csv';$('rvQuoteConfirmed').checked=false;$('rvCsvStatus').textContent=bars.length+' Tageskerzen importiert.';}
    catch(error){if(captured===epoch&&token===csvToken){imported=null;status(error.message,true);}}
    finally{if(captured===epoch&&token===csvToken){csvLoading=false;if(!running)$('rvRun').disabled=false;}}
  });
  function clearPlanForIdentity(){const key=identityKey();if(key===lastIdentity)return;lastIdentity=key;for(const id of ['rvStop','rvTarget','rvContext','rvUrls'])$(id).value='';$('rvBudget').value='0';$('rvAssetId').value='';}
  for(const id of ['rvSymbol','rvCurrency','rvQuoteSymbol'])$(id).addEventListener('input',()=>{$('rvQuoteConfirmed').checked=false;if(id!=='rvQuoteSymbol'){clearPlanForIdentity();clearImport('Wertpapier geändert. CSV bei Bedarf neu importieren.');}});
  $('rvSource').addEventListener('change',()=>{$('rvQuoteConfirmed').checked=false;const symbol=$('rvSymbol').value.trim().toUpperCase();if($('rvSource').value==='alphavantage')$('rvQuoteSymbol').value=alphaSymbolFor(symbol)||'';else if($('rvSource').value!=='independent')$('rvQuoteSymbol').value='';if($('rvSource').value!=='csv')clearImport();});
  $('rvCurrency').addEventListener('change',()=>{$('rvQuoteConfirmed').checked=false;clearPlanForIdentity();clearImport();});
  $('rvLoadHistory').addEventListener('click',history);$('rvMoreMessages').addEventListener('click',()=>{messageLimit+=40;loadMessages();});
  $('rvUpdateContext').addEventListener('click',async()=>{if(!selected)return;const {sb,owner}=access(),asset=selected.id,captured=epoch;try{const r=await sb.from('investment_assets').select('*').eq('user_id',owner).eq('id',asset).maybeSingle();if(captured!==epoch||selected?.id!==asset)return;if(r.error||r.data?.user_id!==owner)throw Error('Aktueller Kontext nicht lesbar.');await openAsset(r.data,r.data.latest_review_id,{fill:false});status('Neuesten gespeicherten Bericht geöffnet. Gespräch fortsetzen startet erst beim Senden.');}catch(error){if(captured===epoch)status(error.message,true);}});
  $('rvExport').addEventListener('click',()=>{if(!current)return;const url=URL.createObjectURL(new Blob([JSON.stringify({review:current,messages},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='Investition-'+current.symbol+'-'+(current.price_date||'ohne-kurs')+'.json';a.click();URL.revokeObjectURL(url);});
  $('rvCopyContext').addEventListener('click',async()=>{if(!current)return;const text='Bitte bewerte dieses Wertpapier anhand des angegebenen Datenstands. Trenne Fakten, Annahmen und Optionen. Keine Kurse erfinden.\n'+JSON.stringify({review:current,conversation:messages},null,2);try{await window.navigator.clipboard.writeText(text);status('Analyse und geladener Gesprächsverlauf kopiert. In ChatGPT einfügen; Antworten optional als externe Interpretation übernehmen.');}catch{status('Zwischenablage nicht verfügbar. JSON exportieren und in ChatGPT hochladen.',true);}});
  $('rvLegacy').addEventListener('click',()=>{if(!current?.analysis)return;navigate('legacy');window.InvestitionCompact?.showTab('deep');window.dispatchEvent(new CustomEvent('investition:open-analysis',{detail:{scope:'deep',analysis:current.analysis}}));});
  window.addEventListener('investition:security-picked',event=>{if(event.detail?.scope!=='review')return;const s=event.detail.security;$('rvAssetId').value='';clearImport();$('rvQuoteConfirmed').checked=false;$('rvQuoteSymbol').value=$('rvSource').value==='alphavantage'?alphaSymbolFor(s.market_symbol)||'':$('rvSource').value==='independent'?s.quote_symbol||'':'';status('Wertpapier übernommen. Anbieterkennung, Währung und persönlichen Plan vor dem Start prüfen.');});
  window.addEventListener('investition:decision-visible',()=>{updateNav();closeMenu();loadAssets();});
  window.addEventListener('investition:signal-simulation-visible',()=>{document.documentElement.dataset.reviewView='review';updateNav();closeMenu();});
  for(const name of ['analytics-visible','event-analysis-visible','hashchange'])window.addEventListener(name==='hashchange'?name:'investition:'+name,()=>{updateNav();closeMenu();});
  window.addEventListener('investition:auth-changed',()=>{reset();if(access().owner&&!$('decisionPage').hidden)loadAssets({force:true});});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){renderPortfolio();renderReview();}});
  document.documentElement.dataset.investmentUi='ready';document.documentElement.dataset.reviewView='review';renderPortfolio();updateNav();if(access().owner&&!$('decisionPage').hidden)loadAssets();
  return {loadAssets,openAsset,run,sendMessage,reset,renderPortfolio,renderReview,navigate,getState:()=>({assets,selected,current,messages,epoch})};
}
if(typeof window!=='undefined'&&typeof document!=='undefined'&&document.getElementById('investmentReviewModule'))window.InvestitionReview=createInvestmentUI({window,document});
