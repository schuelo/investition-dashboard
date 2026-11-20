import {escapeHtml,formatNumber,reportView,reportHtml,modelChart,previousReport} from './compact-analysis.mjs?v=39.4.0';

export function createCompactUI({window,document,now=()=>new Date()}) {
  const $=id=>document.getElementById(id),e=escapeHtml;
  const reports=new Map(),options=new Map(),observers=new Map();
  let rows=[],homeRows=[],triggers=[],triggerError=false,authEpoch=0,homeToken=0,homeBusy=false,lastOwner=null,lastLoaded=0,tab='signal';
  const access=()=>({sb:window.InvestitionDashboard?.getSupabase?.(),owner:window.InvestitionDashboard?.getSession?.()?.user?.id||null});
  function showTab(next) {
    if(!['signal','deep','paper'].includes(next))return;
    tab=next;document.documentElement.dataset.analysisTab=next;
    for(const [name,id] of [['signal','signalCompactView'],['deep','deepAnalysisModule'],['paper','paperPortfolioModule']])if($(id))$(id).hidden=name!==next;
    document.querySelectorAll('[data-compact-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.compactTab===next)));
    updateDock();
  }
  function closeMenu(){delete document.documentElement.dataset.compactMenu;$('compactMenuBtn')?.setAttribute('aria-expanded','false');}
  function updateDock(){
    const signals=$('signalSimulationPage')&&!$('signalSimulationPage').hidden,decision=$('decisionPage')&&!$('decisionPage').hidden;
    document.querySelectorAll('[data-compact-page]').forEach(b=>{const active=b.dataset.compactPage==='decision'?decision:signals&&b.dataset.compactPage===tab;if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  }
  function navigate(where) {
    if(where==='decision')$('navDecisionBtn')?.click();
    else if(['signal','deep','paper'].includes(where)){$('navSignalSimulationBtn')?.click();showTab(where);}
    closeMenu();updateDock();
  }
  function drawChart(scope) {
    const host=$((scope==='deep'?'da':'ss')+'CompactReport'),a=reports.get(scope),target=host?.querySelector('[data-compact-chart]');if(!target||!a)return;
    const v=reportView(a,{...options.get(scope),now:now()}),width=target.clientWidth||320;
    target.innerHTML=modelChart(a,{scenarioId:options.get(scope)?.selected||'base',width,blocked:v.blocked});
  }
  function render(scope,a,{closeInput=false}={}) {
    if(!['signal','deep'].includes(scope)||!a||typeof a!=='object')return;
    reports.set(scope,a);const prefix=scope==='deep'?'da':'ss',host=$(prefix+'CompactReport');if(!host)return;
    const opts=options.get(scope)||{direction:'long',selected:'base'};options.set(scope,opts);
    const same=rows.filter(r=>r.scope===scope).map(r=>r.analysis),v=reportView(a,{...opts,now:now(),previous:previousReport(a,same)});
    host.innerHTML=reportHtml(v,{scope,selected:opts.selected});
    observers.get(scope)?.disconnect();drawChart(scope);
    const target=host.querySelector('[data-compact-chart]');
    if(target&&typeof window.ResizeObserver==='function'){
      let oldWidth=target.clientWidth;
      const observer=new window.ResizeObserver(()=>{if(target.clientWidth!==oldWidth){oldWidth=target.clientWidth;drawChart(scope);}});observer.observe(target);observers.set(scope,observer);
    }
    if(closeInput&&$(prefix+'InputPanel'))$(prefix+'InputPanel').open=false;
    renderHome();
  }
  function renderHome(){
    const host=$('compactHomeCards');if(!host)return;
    const combined=[...rows,...[...reports.entries()].map(([scope,analysis])=>({scope,analysis}))],seen=new Set();
    homeRows=combined.filter(r=>{
      if(!r.analysis?.symbol||reportView(r.analysis,{now:now()}).synthetic)return false;
      const key=r.scope+'|'+(r.analysis.id||r.analysis.symbol+'|'+r.analysis.created_at);if(seen.has(key))return false;seen.add(key);return true;
    }).sort((x,y)=>Date.parse(y.analysis.created_at)-Date.parse(x.analysis.created_at)).slice(0,6);
    host.innerHTML=homeRows.length?homeRows.map((r,i)=>{
      const a=r.analysis,v=reportView(a,{now:now()}),history=(a.history||[]).filter(b=>typeof b.close==='number'&&Number.isFinite(b.close)).slice(-25),values=history.map(b=>b.close),lo=Math.min(...values),hi=Math.max(...values),line=history.map((b,j)=>(j?'L':'M')+(2+j/Math.max(1,history.length-1)*72).toFixed(1)+' '+(27-(b.close-lo)/(hi-lo||1)*23).toFixed(1)).join(' ');
      return '<button class="compact-home-item" type="button" data-compact-open="'+i+'"><span><b>'+e(a.symbol)+'</b><small>'+e(r.scope==='deep'?'Deep':'Analyse')+' · '+e(a.price_date)+' · '+e(v.mode)+'</small><span class="compact-state '+(v.blocked?'bad':'warn')+'">'+e(v.status)+'</span></span><span><b>'+e(formatNumber(v.price))+' '+e(v.currency)+'</b>'+(history.length>1?'<svg viewBox="0 0 76 32" width="76" height="32" role="img" aria-label="Gespeicherter historischer Kursverlauf"><path d="'+line+'" fill="none" stroke="var(--accent)" stroke-width="2"/></svg>':'')+'</span></button>';
    }).join(''):'<p class="compact-muted">Noch keine Analysen geladen. Bestehende Signale und Depotinformationen stehen unten in der Entscheidungszentrale.</p>';
    if($('compactHomeTriggers'))$('compactHomeTriggers').innerHTML='<h3 class="compact-trigger-title">TRIGGER KI · offene Meldungen</h3>'+(triggerError?'<p class="compact-muted">Meldungen nicht erreichbar. Bestehende Verbindung und Trigger-Schema prüfen.</p>':triggers.length?triggers.slice(0,3).map((t,i)=>'<button class="compact-home-item" type="button" data-compact-trigger="'+i+'"><span><b>'+e(t.news_title)+'</b><small>'+e((t.symbols||[]).join(' · '))+'</small><span class="compact-state">Analyse manuell vorbereiten →</span></span></button>').join(''):'<p class="compact-muted">Keine offenen, bereits zugestellten Meldungen geladen.</p>');
  }
  async function loadHome(force=false){
    const {sb,owner}=access();if(!sb||!owner){$('compactHomeStatus').textContent='Nach Anmeldung verfügbar.';return;}
    if(homeBusy||!force&&owner===lastOwner&&now().getTime()-lastLoaded<60000)return;
    const token=++homeToken,epoch=authEpoch;homeBusy=true;$('compactHomeLoad').disabled=true;$('compactHomeStatus').textContent='Eigene gespeicherte Analysen laden … Kein KI- oder Kursabruf.';
    try{
      const queries=[['signal','signal_simulations'],['deep','deep_analyses']].map(async([scope,table])=>{
        const r=await sb.from(table).select('id,user_id,symbol,currency,created_at,raw_result').eq('user_id',owner).order('created_at',{ascending:false}).limit(10);
        if(r.error)throw Error(scope);return (r.data||[]).filter(row=>row.user_id===owner&&row.raw_result?.symbol===row.symbol&&row.raw_result?.currency===row.currency).map(row=>({scope,analysis:{...row.raw_result,id:row.id}}));
      });
      queries.push((async()=>{const r=await sb.from('signal_news_triggers').select('id,user_id,news_id,news_title,news_published_at,symbols,state,delivered_at,reason').eq('user_id',owner).eq('state','pending').not('delivered_at','is',null).order('created_at',{ascending:false}).limit(5);if(r.error)throw Error('triggers');return (r.data||[]).filter(t=>t.user_id===owner&&t.state==='pending'&&t.delivered_at);})());
      const results=await Promise.allSettled(queries);
      if(token!==homeToken||epoch!==authEpoch||access().owner!==owner)return;
      rows=results.slice(0,2).flatMap(r=>r.status==='fulfilled'?r.value:[]);triggerError=results[2].status==='rejected';triggers=triggerError?[]:results[2].value;lastOwner=owner;lastLoaded=now().getTime();
      $('compactHomeStatus').textContent=results.every(r=>r.status==='rejected')?'Historie nicht erreichbar. Verbindung und vorhandenes Schema prüfen.':results.some(r=>r.status==='rejected')?'Ein Analysebereich ist nicht erreichbar; verfügbare Berichte geladen.':'Gespeicherte Berichte · aktuelles Datenalter wird geprüft · keine neue Analyse gestartet.';
      for(const [scope,a] of reports)render(scope,a);renderHome();
    }catch{if(token===homeToken&&epoch===authEpoch)$('compactHomeStatus').textContent='Gespeicherte Analysen konnten nicht geladen werden.';}
    finally{if(token===homeToken){homeBusy=false;$('compactHomeLoad').disabled=false;}}
  }
  function reset(){
    authEpoch++;homeToken++;homeBusy=false;lastOwner=null;lastLoaded=0;rows=[];homeRows=[];triggers=[];triggerError=false;reports.clear();options.clear();window.InvestitionCompactReports={};
    for(const observer of observers.values())observer.disconnect();observers.clear();
    for(const prefix of ['ss','da']){if($(prefix+'CompactReport'))$(prefix+'CompactReport').innerHTML='';const status=$(prefix+'CompactStatus');if(status){status.textContent='Sitzung geändert. Analyse neu vorbereiten.';status.className='compact-status';status.setAttribute('role','status');}}
    $('compactHomeLoad').disabled=false;$('compactHomeStatus').textContent='Gespeicherte Analysen nach Anmeldung neu laden.';renderHome();closeMenu();
  }
  function prepare(scope){navigate(scope);const prefix=scope==='deep'?'da':'ss';if($(prefix+'InputPanel'))$(prefix+'InputPanel').open=true;$(prefix+'Form')?.scrollIntoView?.({behavior:'smooth',block:'start'});}
  document.addEventListener('click',event=>{
    const b=event.target.closest?.('button');if(!b)return;
    if(b.dataset.compactPage)navigate(b.dataset.compactPage);
    if(b.dataset.compactTab){showTab(b.dataset.compactTab);closeMenu();}
    if(b.dataset.compactPrepare)prepare(b.dataset.compactPrepare);
    if(b.dataset.compactScenario){const a=reports.get('deep');if(a?.scenarios?.some(s=>s.id===b.dataset.compactScenario)){options.set('deep',{...(options.get('deep')||{}),selected:b.dataset.compactScenario});const select=$('daScenario');if(select){select.value=b.dataset.compactScenario;select.dispatchEvent(new Event('change',{bubbles:true}));}render('deep',a);}}
    if(b.dataset.compactOpen!==undefined){const row=homeRows[Number(b.dataset.compactOpen)];if(row){navigate(row.scope);window.dispatchEvent(new CustomEvent('investition:open-analysis',{detail:row}));}}
    if(b.dataset.compactTrigger!==undefined){const trigger=triggers[Number(b.dataset.compactTrigger)];if(trigger){prepare('signal');window.dispatchEvent(new CustomEvent('investition:prepare-trigger',{detail:trigger}));}}
    if(b.id==='compactMenuBtn'){const open=document.documentElement.dataset.compactMenu!=='open';if(open)document.documentElement.dataset.compactMenu='open';else closeMenu();b.setAttribute('aria-expanded',String(open));if(open)$('compactMainNav')?.scrollIntoView?.({behavior:'smooth',block:'start'});}
    if(b.id==='compactHomeLoad')loadHome(true);
    if(b.closest?.('#compactMainNav')){closeMenu();updateDock();}
  });
  document.addEventListener('change',event=>{
    const el=event.target,scope=el.dataset?.scope;
    if(el.matches?.('[data-compact-direction]')&&reports.has(scope)){
      options.set(scope,{...(options.get(scope)||{}),direction:el.value==='short'?'short':'long'});render(scope,reports.get(scope));
      if(scope==='signal'&&$('ssChartDirection')){$('ssChartDirection').value=el.value;$('ssChartDirection').dispatchEvent(new Event('change',{bubbles:true}));}
    }
    if(el.id==='daScenario'&&reports.has('deep')){options.set('deep',{...(options.get('deep')||{}),selected:el.value});render('deep',reports.get('deep'));}
    if(el.id==='ssChartDirection'&&['long','short'].includes(el.value)&&reports.has('signal')){options.set('signal',{...(options.get('signal')||{}),direction:el.value});render('signal',reports.get('signal'));}
  });
  window.addEventListener('investition:analysis-rendered',event=>{const {scope,analysis}=event.detail||{};if(scope==='deep')options.set(scope,{...(options.get(scope)||{direction:'long'}),selected:'base'});render(scope,analysis,{closeInput:true});});
  window.addEventListener('investition:analysis-status',event=>{
    const {scope,message,type}=event.detail||{},prefix=scope==='deep'?'da':scope==='signal'?'ss':null,el=prefix?$(prefix+'CompactStatus'):null;
    if(el){el.textContent=String(message||'')+(type==='bad'&&reports.has(scope)?' Der zuletzt geöffnete Bericht bleibt mit seinem ursprünglichen Datenstand sichtbar.':'');el.className='compact-status '+(type||'');el.setAttribute('role',type==='bad'?'alert':'status');if(type==='bad'){$(prefix+'InputPanel').open=true;el.scrollIntoView?.({behavior:'smooth',block:'center'});}}
  });
  window.addEventListener('investition:analysis-tab',event=>showTab(event.detail?.tab));
  window.addEventListener('investition:auth-changed',()=>{reset();if(access().owner&&$('decisionPage')&&!$('decisionPage').hidden)loadHome();});
  window.addEventListener('investition:decision-visible',()=>{updateDock();loadHome();});
  for(const name of ['signal-simulation','analytics','event-analysis'])window.addEventListener('investition:'+name+'-visible',updateDock);
  window.addEventListener('hashchange',updateDock);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){for(const [scope,a] of reports)render(scope,a);renderHome();}});
  showTab(tab);renderHome();for(const [scope,a] of Object.entries(window.InvestitionCompactReports||{}))render(scope,a);
  if(access().owner&&$('decisionPage')&&!$('decisionPage').hidden)loadHome();
  return {render,showTab,navigate,loadHome,reset};
}
if(typeof window!=='undefined'&&typeof document!=='undefined'&&document.getElementById('compactHomeCards'))window.InvestitionCompact=createCompactUI({window,document});
