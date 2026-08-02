(() => {
  'use strict';
  const SUPABASE_URL='https://pzhfybtoyfttftgcrcxk.supabase.co';
  const SUPABASE_KEY='sb_publishable_yGiDH_M0fUZglk40fCk7cQ_kkL1XKzj';
  const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  const $=id=>document.getElementById(id);
  let current=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const impactClass=n=>n>20?'impact-pos':n<-20?'impact-neg':'impact-neu';

  async function init(){
    $('loginBtn').onclick=login;$('analyzeBtn').onclick=analyze;$('clearBtn').onclick=()=>{$('eventInput').value='';};
    const {data:{session}}=await sb.auth.getSession();
    if(session) showApp();
  }
  async function login(){
    $('loginBtn').disabled=true;$('loginStatus').textContent='Anmeldung läuft …';
    const {error}=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
    $('loginBtn').disabled=false;
    if(error){$('loginStatus').textContent='Fehler: '+error.message;return;}
    showApp();
  }
  async function showApp(){
    $('loginCard').classList.add('hidden');$('app').classList.remove('hidden');await loadHistory();
  }
  async function analyze(){
    const eventInput=$('eventInput').value.trim();
    if(eventInput.length<8){$('analysisStatus').textContent='Bitte das Ereignis etwas genauer beschreiben.';return;}
    $('analyzeBtn').disabled=true;$('analysisStatus').textContent='Recherche, Portfolioabgleich und Szenariomodell laufen …';
    try{
      const {data:{session}}=await sb.auth.getSession();
      if(!session) throw new Error('Sitzung abgelaufen. Bitte neu anmelden.');
      const res=await fetch(`${SUPABASE_URL}/functions/v1/analyze-market-event`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({event_input:eventInput,analysis_horizon:$('horizon').value,analysis_scope:$('scope').value,risk_profile:$('risk').value,regions:[$('region').value]})});
      const body=await res.json().catch(()=>({}));
      if(!res.ok||!body.ok) throw new Error(body.error||`Function-Fehler ${res.status}`);
      current=body.analysis;render(current);await loadHistory();$('analysisStatus').textContent=`Analyse abgeschlossen · ${current.sources?.length||0} Quellen · ${current.assets?.length||0} Werte bewertet.`;
    }catch(e){$('analysisStatus').textContent='Fehler: '+(e.message||String(e));}
    finally{$('analyzeBtn').disabled=false;}
  }
  async function loadHistory(){
    const {data,error}=await sb.from('event_analyses').select('id,event_title,event_input,market_relevance,portfolio_impact,created_at,raw_result').order('created_at',{ascending:false}).limit(20);
    if(error){$('history').innerHTML='<div class="empty">Historie noch nicht verfügbar. Zuerst V30-SQL ausführen.</div>';return;}
    if(!data?.length){$('history').innerHTML='<div class="empty">Noch keine gespeicherten Analysen.</div>';return;}
    $('history').innerHTML=data.map(x=>`<div class="history-item" data-id="${x.id}"><div><b>${esc(x.event_title||x.event_input)}</b><div class="muted">${new Date(x.created_at).toLocaleString('de-DE')}</div></div><span class="${impactClass(x.portfolio_impact)}">${x.portfolio_impact>0?'+':''}${x.portfolio_impact}</span></div>`).join('');
    [...$('history').querySelectorAll('.history-item')].forEach(el=>el.onclick=async()=>{const {data}=await sb.from('event_analyses').select('raw_result').eq('id',el.dataset.id).single();if(data?.raw_result){current=data.raw_result;render(current);}});
  }
  function render(a){
    $('results').classList.remove('hidden');
    $('metrics').innerHTML=[['Marktrelevanz',a.market_relevance,'/ 100'],['Portfolio-Impact',`${a.portfolio_impact>0?'+':''}${a.portfolio_impact}`,'-100 bis +100'],['Vertrauen',a.confidence_score,'/ 100']].map((m,i)=>`<div class="card span-4"><div class="metric ${i===1?impactClass(a.portfolio_impact):''}">${esc(m[1])}<small>${esc(m[0])} · ${esc(m[2])}</small></div></div>`).join('');
    const tabs=[['summary','Zusammenfassung'],['portfolio','Portfolio & Watchlist'],['ideas','Investmentideen'],['scenarios','Szenarien'],['signals','Frühindikatoren'],['sources','Quellen']];
    $('tabs').innerHTML=tabs.map((t,i)=>`<button class="btn tab ${i===0?'active':''}" data-tab="${t[0]}">${t[1]}</button>`).join('');
    [...$('tabs').children].forEach(b=>b.onclick=()=>{[...$('tabs').children].forEach(x=>x.classList.remove('active'));b.classList.add('active');renderTab(b.dataset.tab,a);});
    renderTab('summary',a);$('results').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function renderTab(tab,a){
    const assets=a.assets||[];
    if(tab==='summary') $('tabContent').innerHTML=`<h2>${esc(a.event_title)}</h2><p>${esc(a.event_summary)}</p><div class="grid"><div class="card span-6"><h3>So wurde das Ereignis verstanden</h3><p>${esc(a.interpretation)}</p><p><b>Einpreisung:</b> ${esc(a.pricing_state)}</p></div><div class="card span-6"><h3>Wichtigste Handlung</h3><p>${esc(a.key_action)}</p><p><b>Betroffene Bereiche:</b> ${(a.affected_sectors||[]).map(x=>`<span class="pill">${esc(x)}</span>`).join(' ')}</p></div></div>`;
    if(tab==='portfolio') $('tabContent').innerHTML=tableAssets(assets.filter(x=>x.is_portfolio_position||x.is_watchlist_position));
    if(tab==='ideas') $('tabContent').innerHTML=tableAssets(assets.filter(x=>!x.is_portfolio_position&&!x.is_watchlist_position));
    if(tab==='scenarios') $('tabContent').innerHTML=(a.scenarios||[]).map(s=>`<div class="scenario"><h3>${esc(s.title)} · ${esc(s.probability)} %</h3><p>${esc(s.description)}</p><p><b>Portfolio:</b> ${esc(s.portfolio_effect)}<br><b>Markt:</b> ${esc(s.market_effect)}</p><p class="muted">Bestätigung: ${(s.confirmation_signals||[]).map(esc).join(' · ')}</p></div>`).join('')||'<div class="empty">Keine Szenarien.</div>';
    if(tab==='signals') $('tabContent').innerHTML=(a.signals||[]).map(s=>`<div class="source"><b>${esc(s.signal_name)}</b><span class="pill" style="float:right">${esc(s.importance)}/100</span><div>${esc(s.signal_description)}</div></div>`).join('')||'<div class="empty">Keine Frühindikatoren.</div>';
    if(tab==='sources') $('tabContent').innerHTML=(a.sources||[]).map(s=>`<div class="source"><b>${esc(s.title)}</b><div class="muted">${esc(s.source_name||'Quelle')} · Relevanz ${esc(s.relevance_score)}</div>${s.source_url?`<a target="_blank" rel="noopener" href="${esc(s.source_url)}">Originalquelle öffnen</a>`:''}</div>`).join('')||'<div class="empty">Keine externen Quellen gefunden; Analyse beruht auf Portfolio- und Regelmodell.</div>';
  }
  function tableAssets(rows){
    if(!rows.length)return '<div class="empty">Keine passenden Werte erkannt.</div>';
    return `<div class="table-wrap"><table><thead><tr><th>Wert</th><th>Bezug</th><th>Impact</th><th>Vertrauen</th><th>Einpreisung</th><th>Empfehlung</th><th>Begründung</th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${esc(x.company_name)}</b><br><span class="muted">${esc(x.symbol||'')}</span></td><td>${esc(x.asset_source)}</td><td class="${impactClass(x.impact_score)}">${x.impact_score>0?'+':''}${esc(x.impact_score)}</td><td>${esc(x.confidence_score)}</td><td>${esc(x.pricing_state)}</td><td>${esc(x.recommendation)}</td><td>${esc(x.reasoning)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  init();
})();
