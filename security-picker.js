import {validateSecurityQuery} from './supabase/functions/_shared/security-resolver.mjs';
import {securityFieldChanges} from './supabase/functions/_shared/security-form.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const access=()=>({sb:window.InvestitionDashboard?.getSupabase?.(),session:window.InvestitionDashboard?.getSession?.()});
const $=id=>document.getElementById(id);
let epoch=0;
export function currentSecurityFields(scope) {
  if(scope==='trade'){const form=$('tradeForm');return Object.fromEntries(['id','name','symbol','marketSymbol','currency','type'].map(k=>[k,form.elements[k]?.value||'']));}
  const keys={signal:['ssSymbol','ssCurrency'],deep:['daSymbol','daCurrency'],paper:['ppSymbols','ppCurrency'],csv:['ppCsvSymbol'],history:['daHistorySymbol'],event:['eventAnalysisInput']}[scope]||[];
  return Object.fromEntries(keys.map(k=>[k,$(k)?.value||'']));
}
export function writeSecurityFields(scope,changes) {
  const touched=[];
  for(const [key,value] of Object.entries(changes.values)) {
    const el=scope==='trade'?$('tradeForm').elements[key]:$(key);if(!el)throw Error('Wertpapier-Zielfeld fehlt. Vollständiges V35-Paket verwenden.');
    touched.push([el,value]);
  }
  // Set all fields before firing the existing validation and CSV/trigger-reset listeners.
  for(const [el,value] of touched){if(typeof value==='boolean')el.checked=value;else el.value=value;}
  for(const [el] of touched){el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
}
export function mountSecurityPicker(root) {
  const scope=root.dataset.securityTarget;
  let busy=false,pending=false,token=0,result=null,snapshot=null;
  root.classList.add('security-picker');
  const uid='security-'+scope;
  root.innerHTML='<div class="security-picker-title">Wertpapier per WKN / ISIN übernehmen</div><div class="security-picker-row">'+
    '<label for="'+uid+'-query">WKN oder ISIN<input id="'+uid+'-query" data-sec-query maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="z. B. 860180"></label>'+
    '<label for="'+uid+'-exchange">Handelsplatz bevorzugen<select id="'+uid+'-exchange" data-sec-exchange><option value="XETRA">Xetra</option><option value="US">USA</option><option value="F">Frankfurt</option><option value="PA">Paris</option><option value="AS">Amsterdam</option><option value="LSE">London</option><option value="SW">Schweiz</option><option value="KO">Korea</option><option value="SHE">Shenzhen</option><option value="HK">Hongkong</option></select></label>'+
    '<button class="btn" type="button" data-sec-search>Suchen</button><button class="btn" type="button" data-sec-cancel>Verwerfen</button></div>'+
    '<p class="security-picker-status" role="status" aria-live="polite">Aktie oder ETF auswählen. Die Übernahme füllt dieses Formular; Speichern und Analysestart erfolgen wie bisher.</p>'+
    '<div data-sec-results hidden><label for="'+uid+'-result">Gefundene und geprüfte Notierung<select id="'+uid+'-result" data-sec-select></select></label><div data-sec-preview></div>'+
    (scope==='trade'?'<div data-sec-chart-block hidden><label for="'+uid+'-chart" data-sec-chart-dropdown>US-Chartbörse bestätigen<select id="'+uid+'-chart" data-sec-chart><option value="">Bitte wählen</option><option>NASDAQ</option><option>NYSE</option><option>AMEX</option><option>OTC</option></select></label><label for="'+uid+'-chart-custom">Alternativ bestätigte TradingView-Kennung<input id="'+uid+'-chart-custom" data-sec-chart-custom maxlength="60" autocapitalize="characters" spellcheck="false" placeholder="BÖRSE:TICKER"></label></div>':'')+
    (scope==='paper'?'<label>Im neuen Experiment<select data-sec-append><option value="replace">Symbolauswahl ersetzen</option><option value="append">Symbol hinzufügen</option></select></label>':'')+
    '<p class="security-picker-note">Bei einem Wertpapierwechsel werden abhängige Kurs-/Produktfelder zurückgesetzt. KO-/Hebelprodukt-WKN und Basiswert gehören getrennt erfasst.</p><button class="btn primary" type="button" data-sec-apply>In dieses Formular übernehmen</button></div>';
  const find=s=>root.querySelector(s),query=find('[data-sec-query]'),exchange=find('[data-sec-exchange]'),select=find('[data-sec-select]'),results=find('[data-sec-results]'),apply=find('[data-sec-apply]'),search=find('[data-sec-search]'),statusEl=find('[role=status]');
  const status=(text,bad=false)=>{statusEl.textContent=text;statusEl.classList.toggle('security-picker-error',bad);};
  const fingerprint=()=>JSON.stringify(currentSecurityFields(scope));
  const setBusy=on=>{busy=on;root.setAttribute('aria-busy',String(on));search.disabled=on;query.disabled=on;exchange.disabled=on;apply.disabled=on;};
  function clear(){token++;pending=false;result=null;query.value='';results.hidden=true;snapshot=null;setBusy(false);status('Suche zurückgesetzt. Bisherige Formulareingaben bleiben erhalten.');}
  function preview(){
    const c=result?.candidates[Number(select.value)];if(!c)return;
    find('[data-sec-preview]').innerHTML='<p><strong>'+esc(c.name)+'</strong><br>'+esc(c.market_symbol+' · '+c.currency+' · ISIN '+c.isin)+(c.wkn?' · WKN '+esc(c.wkn):'')+'<br>Chart: '+esc(c.chart_symbol||'Börse gesondert bestätigen')+'</p>';
    if(scope==='trade'){find('[data-sec-chart-block]').hidden=!!c.chart_symbol;find('[data-sec-chart-dropdown]').hidden=c.exchange!=='US';find('[data-sec-chart]').value='';find('[data-sec-chart-custom]').value='';}
  }
  async function lookup(){
    if(busy)return;let body;try{body=validateSecurityQuery({query:query.value,preferred_exchange:exchange.value,manual_start:true});}catch(e){pending=!!query.value.trim();status(e.message,true);return;}
    const {sb,session}=access();if(!sb||!session){status('Für die WKN-Suche im Dashboard anmelden.',true);return;}
    pending=true;const captured=epoch,request=++token,owner=session.user.id;snapshot=fingerprint();results.hidden=true;setBusy(true);status('WKN/ISIN wird geprüft und dem EODHD-Katalog zugeordnet …');
    try{
      const response=await sb.functions.invoke('resolve-security',{body:{query:body.query,preferred_exchange:body.preferred_exchange,manual_start:true}});
      if(captured!==epoch||request!==token||access().session?.user?.id!==owner)return;
      if(response.error){let message=response.error.message;try{message=(await response.error.context.clone().json()).error||message;}catch{}throw Error(message||'WKN-Suche nicht erreichbar. V35-Function und SQL prüfen.');}
      if(!response.data?.ok||!response.data.resolution?.candidates?.length)throw Error(response.data?.error||'Keine verifizierte Zuordnung gefunden.');
      result=response.data.resolution;select.innerHTML=result.candidates.map((c,i)=>'<option value="'+i+'">'+esc(c.name+' · '+c.market_symbol+' · '+c.currency+' · '+c.isin)+'</option>').join('');select.value='0';results.hidden=false;preview();
      status(result.candidates.length+' geprüfte Notierung(en)'+(result.cached?' aus gespeichertem Suchergebnis':'')+'. Auswahl prüfen und übernehmen.'+(result.warnings?.length?' '+result.warnings.join(' '):''));
    }catch(e){if(captured===epoch&&request===token)status(e.message,true);}finally{if(captured===epoch&&request===token)setBusy(false);}
  }
  query.addEventListener('input',()=>{pending=!!query.value.trim();token++;result=null;results.hidden=true;});
  exchange.addEventListener('change',()=>{pending=!!query.value.trim();result=null;results.hidden=true;token++;});
  root.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target===query){e.preventDefault();e.stopPropagation();lookup();}});
  search.addEventListener('click',lookup);find('[data-sec-cancel]').addEventListener('click',clear);select.addEventListener('change',preview);
  apply.addEventListener('click',()=>{
    if(busy||!result)return;
    try{
      if(snapshot!==fingerprint()&&scope!=='event')throw Error('Das Zielformular wurde inzwischen geändert. Erneut suchen, bevor die Zuordnung übernommen wird.');
      const c=result.candidates[Number(select.value)],chart=find('[data-sec-chart]')?.value,custom=find('[data-sec-chart-custom]')?.value?.trim().toUpperCase();
      const override=!c?.chart_symbol?(custom||(chart&&c?.exchange==='US'?chart+':'+c.code:undefined)):undefined;
      const changes=securityFieldChanges(scope,c,currentSecurityFields(scope),{chart_symbol:override,append:find('[data-sec-append]')?.value==='append'});
      writeSecurityFields(scope,changes);pending=false;results.hidden=true;query.value='';status(c.name+' · '+c.market_symbol+' · '+c.currency+' übernommen. '+changes.messages.join(' ')+' Noch nicht gespeichert oder analysiert.');
      window.dispatchEvent(new CustomEvent('investition:security-picked',{detail:{scope,security:c}}));
    }catch(e){status(e.message,true);}
  });
  const guard=e=>{if(pending||busy){e.preventDefault();e.stopImmediatePropagation();status('Zuerst die gesuchte WKN übernehmen oder die Suche verwerfen.',true);}};
  root.closest('form')?.addEventListener('submit',guard,true);
  const standalone={event:'eventAnalysisRunBtn',history:'daHistoryLoad'}[scope];if(standalone)$(standalone)?.addEventListener('click',guard,true);
  window.addEventListener('investition:auth-changed',()=>{clear();status('Sitzung geändert. WKN-Suche bei Bedarf neu starten.');});
  return {lookup,clear};
}
if(typeof window!=='undefined'&&typeof document!=='undefined'){
  window.addEventListener('investition:auth-changed',()=>{epoch++;});
  document.querySelectorAll('[data-security-target]').forEach(mountSecurityPicker);
}
