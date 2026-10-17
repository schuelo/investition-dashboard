import { buildDeepAnalysis, validateDeepInput, comparePrior } from './supabase/functions/_shared/deep-engine.mjs?v=32.0';
import { parseOhlcvCsv } from './supabase/functions/_shared/signal-engine.mjs?v=31.2';
import { canonicalUrl } from './supabase/functions/_shared/deep-sources.mjs?v=32.0';

const $=id=>document.getElementById(id);
const root=$('deepAnalysisModule');
const esc=v=>String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v==null||!Number.isFinite(Number(v))?'—':new Intl.NumberFormat('de-DE',{maximumFractionDigits:3}).format(v);
const dt=v=>v?new Date(v).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}):'Datum unbekannt';
const access=()=>({sb:window.InvestitionDashboard?.getSupabase?.(),session:window.InvestitionDashboard?.getSession?.()});
const value=id=>$(id).value,number=id=>Number(value(id)),checked=id=>$(id).checked;
let current=null,imported=null,busy=false,epoch=0,page=0,historyRows=[],historyTotal=0,selected=new Map(),launchOrigin=null,historyToken=0;
const launch=new URLSearchParams(window.location?.search || '');
const validId=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v));
if(validId(launch.get('signal_trigger'))) launchOrigin={trigger_id:launch.get('signal_trigger')};
else if(validId(launch.get('signal_news'))) launchOrigin={source_news_id:launch.get('signal_news')};
const launchSymbol=launch.get('signal_symbol');
function status(message,type='',reveal=false){
  const el=$('daStatus');el.textContent=message;el.className='da-status '+type;
  if(reveal)el.scrollIntoView?.({behavior:'smooth',block:'center'});
}
let invalidBatch=false;
function invalidInput(event){
  event.preventDefault();
  const field=event.target;field.setAttribute('aria-invalid','true');
  // Native validation runs before submit, including inputs in closed details.
  // Reveal every invalid section, but report/focus only the first invalid field.
  let details=field.closest?.('details');
  while(details){details.open=true;details=details.parentElement?.closest('details');}
  if(invalidBatch)return;
  invalidBatch=true;setTimeout(()=>{invalidBatch=false;},0);
  const label=(field.labels?.[0]?.textContent || field.getAttribute?.('aria-label') || field.id || 'Eingabe').replace(/\s+/g,' ').trim().slice(0,100);
  status('Eingabe prüfen – '+label+': '+(field.validationMessage || 'Bitte einen gültigen Wert eingeben.'),'bad',true);
  field.focus?.({preventScroll:true});
}
function setBusy(on) {
  busy=on;root.setAttribute('aria-busy',String(on));
  $('daForm').querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=on);
  for(const id of ['daHistoryLoad','daNoteSave','daEvaluate']) $(id).disabled=on || (['daNoteSave','daEvaluate'].includes(id)&&!current?.id);
  $('daPrev').disabled=on||page===0;$('daNext').disabled=on||(page+1)*20>=historyTotal;
}
function clearImport(){imported=null;$('daCsv').value='';$('daCsvStatus').textContent='Kein CSV-Import; Kurscache / kostenlose EODHD-Abfrage.';}
function input() {
  const symbol=value('daSymbol').trim().toUpperCase();
  const origin=value('daTrigger')?{trigger_id:value('daTrigger')}:launchOrigin || {};
  return validateDeepInput({
    symbol,currency:value('daCurrency'),company:value('daCompany'),context:value('daContext'),sector:value('daSector'),
    days:number('daDays'),lookback:number('daLookback'),news_days:number('daNewsDays'),shock_pct:number('daShock'),
    event_direction:value('daEventDirection'),use_ai:checked('daUseAi'),research:checked('daResearch'),manual_start:true,
    prior_ids:[...selected.keys()],...origin,...(imported?{bars:imported}:{}),
    risk:{capital:number('daCapital'),account_currency:value('daAccountCurrency').trim().toUpperCase(),budget_pct:number('daBudget'),
      exposure:number('daExposure'),max_exposure_pct:number('daMaxExposure'),fx_rate:number('daRiskFx'),fx_verified:checked('daRiskFxVerified'),
      fee_bps:number('daFee'),slippage_bps:number('daSlippage')},
    valuation:{eps:number('daEps'),growth_pct:number('daGrowth'),multiple:number('daMultiple'),source_id:value('daValSource'),as_of:value('daValDate'),provenance:value('daValProvenance')},
    cik:value('daCik'),cik_verified:checked('daCikVerified'),
    product:{type:value('daProductType'),direction:value('daProductDirection'),reference:value('daProductRef'),
      currency:value('daProductCurrency').trim().toUpperCase(),fx_rate:number('daProductFx'),fx_verified:checked('daProductFxVerified'),
      premium:number('daPremium'),ratio:number('daRatio'),spread_pct:number('daSpread'),financing_pct:number('daFinancePct'),
      barrier:number('daBarrier'),financing:number('daFinance'),observation:value('daObservation'),factor:number('daFactor'),
      strike:number('daStrike'),expiry_days:number('daExpiry'),iv_pct:number('daIv'),rate_pct:number('daRate'),dividend_pct:number('daDividend'),
      terms_verified:checked('daTermsVerified'),iv_verified:checked('daIvVerified')}
  });
}
async function errorText(error){try{if(error?.context instanceof Response)return (await error.context.clone().json()).error || error.message;}catch{}return error?.message || 'Verbindung fehlgeschlagen.';}
async function invoke(body){
  const {sb,session}=access();if(!sb||!session)throw new Error('Dashboard-Anmeldung erforderlich.');
  const result=await sb.functions.invoke('analyze-deep-signal',{body});
  if(result.error)throw new Error(await errorText(result.error));
  if(!result.data?.ok)throw new Error(result.data?.error || 'Kein Ergebnis empfangen.');
  return result.data;
}
async function run(){
  if(busy)return;
  let body;try{body=input();}catch(e){status(e.message,'bad',true);return;}
  if([...selected.values()].some(a=>a.symbol!==body.symbol)){status('Vergleichskontext enthält ein anderes Symbol. Auswahl in der Historie entfernen.','bad',true);return;}
  const runEpoch=epoch;setBusy(true);status('Analyse gestartet: Kurse und Quellen prüfen, Szenarien berechnen und Analyse speichern …','',true);
  try{
    let a;const {sb,session}=access();
    if(!sb||!session){
      if(!body.bars||body.use_ai)throw new Error('Bitte anmelden. Lokal ist nur CSV mit ausgeschalteter KI verfügbar.');
      a=buildDeepAnalysis(body,body.bars,{provider:'CSV lokal'});a.warnings=['Lokale Analyse; keine Recherche, KI oder Cloudhistorie.'];
    }else a=(await invoke({action:'analyze',...body})).analysis;
    if(runEpoch!==epoch)return;
    open(a);status('Deep-Analyse abgeschlossen · '+(a.ai?.provider==='gemini'?'Gemini '+a.ai.model:'Regelberechnung')+' · Kursstand '+a.price_date,a.warnings?.length||a.quality.blocked?'warn':'good');
    if(a.id){page=0;await loadHistory(false);}
  }catch(e){if(runEpoch===epoch)status(e.message,'bad',true);}
  finally{if(runEpoch===epoch)setBusy(false);}
}
const table=(headers,rows)=>'<div class="da-scroll"><table class="da-table"><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+
  rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const list=items=>'<ul>'+items.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>';
function sourcesHtml(sources){
  return sources.length?sources.map(s=>'<div class="da-source"><a href="'+esc(canonicalUrl(s.url)||'#')+'" target="_blank" rel="noopener noreferrer">'+esc(s.title)+'</a>'+
    '<br><small>'+esc(s.source)+' · '+esc(s.kind)+' · '+esc(dt(s.published_at))+'<br>'+esc(s.id)+' · '+
    (s.content_status==='metadata'?'Nur Metadaten; Volltext nicht gelesen':s.content_status==='structured_data'?'Strukturierte Primärdaten':'Kurzer Feed-Auszug; kein Volltext')+
    ' · abgerufen '+esc(dt(s.retrieved_at))+'</small>'+
    (s.excerpt?'<p>'+esc(s.excerpt)+'</p>':'')+(s.own_summary?'<p>'+esc(s.own_summary)+'</p>':'')+'</div>').join(''):'<p>Keine passenden Quellen.</p>';
}
function chartSvg(a){
  const s=a.scenarios.find(s=>s.id===value('daScenario')) || a.scenarios[0],h=a.history,b=s.bands,offset=h.length-1;
  const values=[...h.map(b=>b.close),...b.flatMap(b=>[b.q10,b.q90])],lo=Math.min(...values)*.97,hi=Math.max(...values)*1.03;
  const x=i=>65+i/(offset+a.request.days)*810,y=v=>290-(v-lo)/(hi-lo||1)*245;
  const path=points=>points.map(([i,v],n)=>(n?'L':'M')+x(i).toFixed(2)+' '+y(v).toFixed(2)).join(' ');
  const fan=path(b.map(b=>[offset+b.day,b.q10]))+' '+b.slice().reverse().map(b=>'L'+x(offset+b.day).toFixed(2)+' '+y(b.q90).toFixed(2)).join(' ')+' Z';
  return '<svg class="da-chart" viewBox="0 0 920 340" role="img" aria-label="Historie und Modellband '+esc(s.name)+'">'+
    [0,.25,.5,.75,1].map(t=>{const v=lo+t*(hi-lo);return '<line x1="65" x2="875" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#2a4056"/><text x="0" y="'+(y(v)+4)+'">'+num(v)+'</text>';}).join('')+
    '<path d="'+fan+'" fill="#72dec9" fill-opacity=".14"/><path d="'+path(h.map((v,i)=>[i,v.close]))+'" fill="none" stroke="#e4edf6" stroke-width="2"/>'+
    '<path d="'+path(b.map(v=>[offset+v.day,v.q50]))+'" fill="none" stroke="#72dec9" stroke-width="2" stroke-dasharray="6 4"/>'+
    '<line x1="'+x(offset)+'" x2="'+x(offset)+'" y1="40" y2="290" stroke="#8ea5be" stroke-dasharray="4 4"/>'+
    '<text x="65" y="315">'+esc(h[0].date)+'</text><text x="'+Math.max(200,x(offset)-70)+'" y="333">'+esc(a.price_date)+'</text><text x="765" y="315">+'+a.request.days+' Handelstage</text></svg>';
}
function render(a){
  $('daResults').hidden=false;$('daTitle').textContent=a.symbol+' · '+a.request.days+' Handelstage · '+a.currency;
  const metrics=[['Schlusskurs',num(a.chart.price)+' '+a.currency,a.price_date+' · '+a.provider],['Historie',a.quality.bars+' Kerzen',a.quality.shortfall?'Wunsch: '+a.quality.requested+' · Lücke: '+a.quality.shortfall:'Gewähltes Fenster verfügbar'],
    ['Szenarien','6 Verläufe',a.simulation.paths_per_scenario+' Pfade je Szenario'],['Modus',a.ai?'Gemini':'Regeln',a.ai?.model || 'Kein KI-Aufruf erfolgreich']];
  $('daMetrics').innerHTML=metrics.map(([label,v,detail])=>'<div class="da-metric"><small>'+esc(label)+'</small><strong>'+esc(v)+'</strong><small>'+esc(detail)+'</small></div>').join('');
  $('daQuality').innerHTML='<div class="da-note">'+(a.quality.blocked?'<b class="da-danger">Handelsschwellen gesperrt.</b> ':'')+'Datenalter '+a.quality.ageDays+' Kalendertage.'+
    list([...a.quality.notes,...a.quality.gaps,...(a.warnings || [])])+'<small>'+esc(a.simulation.assumptions)+' Seed '+a.simulation.seed+'.</small></div>';
  $('daScenario').innerHTML=a.scenarios.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>').join('');$('daScenario').value='base';$('daChart').innerHTML=chartSvg(a);
  $('daScenarios').innerHTML=a.scenarios.map(s=>'<article class="da-card"><h4>'+esc(s.name)+'</h4><b>Modellmedian '+num(s.endpoint)+' '+esc(a.currency)+'</b><p>'+esc(s.assumption)+'</p>'+
    '<dl><dt>P10 / P90 am Ende</dt><dd>'+num(s.bands.at(-1).q10)+' / '+num(s.bands.at(-1).q90)+'</dd><dt>Ungünstige Kursauslenkung P10</dt><dd>'+num(s.adverse_p10_pct)+' %</dd><dt>Drawdown P90</dt><dd>'+num(s.drawdown_p90_pct)+' %</dd></dl>'+
    '<p>Bestätigung: '+esc(s.confirmation)+'</p><p>Ungültig: '+esc(s.invalidation)+'</p><small>'+esc(s.frequency_label)+'</small></article>').join('');
  const n=a.narrative;
  $('daNarrative').innerHTML='<b>'+esc(n.mode==='ai'?'Gemini · '+a.ai?.model:'Regelberechnung')+' · '+esc(n.bias)+'</b><p>'+esc(n.summary)+'</p>'+
    (n.mode==='ai'?'<p class="da-help">Subjektives KI-Vertrauen '+num(n.confidence)+'/100; keine gemessene Prognosegüte.</p>':'')+
    '<h4>Gegenargument</h4><p>'+esc(n.countercase || 'Keine KI-Gegenthese verfügbar.')+'</p>'+
    n.evidence.map(e=>'<p><b>'+esc(e.source_id)+'</b>: '+esc(e.inference)+'</p>').join('')+
    '<h4>Risiken / Informationslücken</h4>'+list([...(n.risks || []),...(n.information_gaps || [])])+
    '<h4>Beobachten</h4>'+list(n.watchpoints || [])+
    (n.scenario_notes?.length?table(['Szenario','KI-Einordnung'],n.scenario_notes.map(s=>[s.scenario_id,s.assessment])):'');
  $('daModels').innerHTML=table(['Methode','Modellwert','Datenfamilie / Annahme'],a.models.map(m=>[m.name,num(m.endpoint)+' '+a.currency,m.group+' · '+m.assumption]))+
    '<p class="da-help">Technik und Bootstrap teilen dieselben Kursdaten. Übereinstimmung ist keine unabhängige Bestätigung.</p>';
  $('daValuation').innerHTML=a.valuation.available?'<h4>Bewertungssensitivität</h4><p>'+esc(a.valuation.provenance)+' · Impliziertes KGV '+num(a.valuation.implied_multiple)+
    ' · Erforderliches Wachstum p.a. unter dieser Annahme '+num(a.valuation.implied_growth_pct)+' %.</p>'+
    table(['Wachstum p.a.','Multiple','Modellwert'],a.valuation.matrix.map(v=>[num(v.growth_pct)+' %',num(v.multiple),num(v.value)+' '+a.currency]))+
    '<p class="da-help">'+esc(a.valuation.limitation)+'</p>':'<p>'+esc(a.valuation.reason)+'</p>';
  const f=a.fundamentals;
  if(f?.available)$('daValuation').innerHTML+='<h4>SEC-Primärdaten · '+esc(f.entity)+' · CIK '+esc(f.cik)+'</h4>'+
    table(['Kennzahl / Quelle','Zeitraum','Wert / Einheit','Eingereicht'],f.metrics.flatMap(m=>m.history.map(h=>[m.concept+' · '+m.source_id,h.period_start+' – '+h.period_end,num(h.value)+' '+h.unit,h.filed])))+
    '<p class="da-help">'+esc(f.limitation)+'</p>';
  else if(f?.reason)$('daValuation').innerHTML+='<p class="da-help">'+esc(f.reason)+'</p>';
  $('daAnalogs').innerHTML='<h4>Historische Chartähnlichkeiten</h4><p>'+a.analogs.matches+' nicht überlappende Vergleichsfenster · Medianverlauf '+num(a.analogs.median_return_pct)+' %.</p>'+
    table(['Datum','Score','RSI','Verlauf','Ungünstige Auslenkung'],a.analogs.sample.map(v=>[v.date,v.score,num(v.rsi),num(v.return_pct)+' %',num(v.adverse_pct)+' %']))+'<p class="da-help">'+esc(a.analogs.limitation)+'</p>';
  $('daSensitivity').innerHTML='<h4>Volatilitätssensitivität (driftfreie Näherung)</h4>'+
    table(['Volatilitätsfaktor','Unteres Modellband','Oberes Modellband'],a.sensitivity.map(s=>[num(s.volatility_factor),num(s.lower),num(s.upper)]));
  $('daSetups').innerHTML=a.setups.map(s=>'<article class="da-card"><h4>'+esc(s.direction.toUpperCase())+' · '+esc(s.decision)+'</h4><p>'+esc(s.reason)+'</p>'+
    '<dl><dt>Einstieg nach Bestätigung</dt><dd>'+num(s.entry)+'</dd><dt>Stop</dt><dd>'+num(s.stop)+'</dd><dt>Ziel 1 / Ziel 2</dt><dd>'+num(s.target1)+' / '+num(s.target2)+'</dd>'+
    '<dt>Netto Chance/Risiko zu Ziel 1</dt><dd>'+num(s.net_reward_risk)+'</dd><dt>Budget in '+esc(s.risk_currency)+'</dt><dd>'+num(s.budget)+'</dd><dt>Bedingte Basiswert-Stückzahl</dt><dd>'+num(s.units)+'</dd>'+
    '<dt>3σ-Gap-Stressverlust</dt><dd>'+num(s.gap_stress_loss)+'</dd></dl>'+list(s.flags)+
    '<p>Trigger: '+esc(s.trigger)+'</p><p>Ungültig: '+esc(s.invalidation)+'</p><p>'+esc(s.exit)+' '+esc(s.trailingStop)+'</p><small>'+esc(s.note)+'</small></article>').join('');
  const p=a.product;
  $('daProduct').innerHTML=p.available?'<b>'+esc(p.type.toUpperCase())+' · '+esc(p.reference)+' · '+esc(p.decision)+'</b>'+list(p.issues || [])+
    (p.reason?'<p>'+esc(p.reason)+'</p>':'')+
    (p.distance_pct!=null?'<p>Barrierenabstand '+num(p.distance_pct)+' % · Reverse-Stress: Bewegung '+num(p.reverse_stress_pct)+' % erreicht die heutige Barriere.</p>':'')+
    table(['Szenario','Barrierenberührung im Modell','Rendite P10','Rendite P50'],(p.rows || []).map(r=>[r.scenario,r.barrier_model_frequency_pct==null?'—':num(r.barrier_model_frequency_pct)+' %',num(r.return_p10_pct)+' %',num(r.return_p50_pct)+' %']))+
    (p.greeks?table(['Greek','Modellwert'],Object.entries(p.greeks).map(([k,v])=>[k,num(v)])):'')+
    (p.iv_sensitivity?table(['IV','Theoretischer Produktwert'],p.iv_sensitivity.map(s=>[num(s.iv_pct)+' %',num(s.theoretical_value)])):'')+
    '<p class="da-help">'+esc(p.limitations || '')+'</p>':'<p>'+esc(p.reason)+'</p>';
  $('daMethods').innerHTML=a.chart.methods.map(m=>'<article class="da-card"><h4>'+esc(m.name)+'</h4><b>'+esc(m.finding)+'</b>'+
    table(['Kennzahl','Wert'],Object.entries(m.values).map(([k,v])=>[k,num(v)]))+'<p>'+esc(m.purpose)+'</p><small>'+esc(m.limitation)+'</small></article>').join('');
  $('daWeekly').innerHTML='<h4>Wochenchart · '+a.weekly.bars+' vollständige Wochen</h4>'+(a.weekly.chart?
    table(['Technik','Wochenbefund'],a.weekly.chart.methods.map(m=>[m.name,m.finding]))+'<p class="da-help">Perioden beziehen sich hier auf Wochen; Volumenbestätigung deaktiviert. Wochen-SMA200 benötigt 200 Wochen.</p>':'<p>'+esc(a.weekly.reason)+'</p>');
  $('daDelta').innerHTML=a.delta.length?table(['Frühere Analyse','Kursänderung','Chartscore Δ','Bias alt → neu','Neu prüfen'],a.delta.map(d=>[dt(d.created_at),num(d.price_change_pct)+' %',d.score_delta,d.previous_bias+' → '+d.current_bias,d.reevaluate?'TRIGGER KI · These erneut prüfen':'Keine neue Modellabweichung'])):'<p>Keine frühere Analyse als Vergleichskontext ausgewählt.</p>';
  $('daReassess').textContent='Erneut manuell prüfen bei: '+a.reassess.join(' · ')+'.';
  $('daSources').innerHTML=sourcesHtml(a.sources);
  $('daNote').value='';$('daEvaluation').innerHTML='';
  $('daNoteSave').disabled=!a.id;$('daEvaluate').disabled=!a.id;
}
function open(a){current=a;render(a);if(a.id)loadNote(a.id);}
async function loadNote(id){
  const {sb,session}=access(),token=epoch;if(!sb||!session)return;
  const [notes,evaluations]=await Promise.allSettled([
    sb.from('deep_analysis_notes').select('note').eq('user_id',session.user.id).eq('analysis_id',id).maybeSingle(),
    sb.from('deep_evaluations').select('result').eq('user_id',session.user.id).eq('analysis_id',id).order('evaluated_at',{ascending:false}).limit(1)
  ]);
  if(token!==epoch||current?.id!==id)return;
  if(notes.status==='fulfilled'&&!notes.value.error)$('daNote').value=notes.value.data?.note || '';
  if(evaluations.status==='fulfilled'&&evaluations.value.data?.[0])renderEvaluation(evaluations.value.data[0].result);
}
async function loadHistory(reset=true){
  const {sb,session}=access(),token=++historyToken,authEpoch=epoch;
  if(reset)page=0;
  if(!sb||!session){$('daHistory').textContent='Nach Anmeldung verfügbar.';return;}
  let query=sb.from('deep_analyses').select('id,symbol,currency,horizon_days,created_at,ai_mode,raw_result',{count:'exact'}).eq('user_id',session.user.id);
  if(value('daHistorySymbol').trim())query=query.eq('symbol',value('daHistorySymbol').trim().toUpperCase());
  if(value('daHistoryMode'))query=query.eq('ai_mode',value('daHistoryMode'));
  if(value('daHistoryFrom'))query=query.gte('created_at',value('daHistoryFrom')+'T00:00:00Z');
  if(value('daHistoryTo'))query=query.lte('created_at',value('daHistoryTo')+'T23:59:59.999Z');
  const r=await query.order('created_at',{ascending:false}).range(page*20,page*20+19);
  if(token!==historyToken||authEpoch!==epoch)return;
  if(r.error){$('daHistory').textContent='Historie noch nicht verfügbar. V32-SQL ausführen.';return;}
  historyTotal=r.count || 0;historyRows=(r.data || []).map(r=>({...r.raw_result,id:r.id}));
  $('daHistory').innerHTML=historyRows.length?historyRows.map((a,i)=>'<div class="da-history-row"><input type="checkbox" data-da-select="'+i+'" '+(selected.has(a.id)?'checked':'')+' aria-label="Als Vergleichskontext auswählen"><button type="button" data-da-open="'+i+'">'+
    esc(a.symbol)+' · '+a.request.days+' Tage<small>'+esc(dt(a.created_at))+' · '+esc(a.narrative.mode)+' · '+esc(a.price_date)+'</small></button></div>').join(''):'<p>Keine Analysen für diese Auswahl.</p>';
  $('daHistory').querySelectorAll('[data-da-open]').forEach(el=>el.addEventListener('click',()=>{if(busy)return;open(historyRows[Number(el.dataset.daOpen)]);status('Originalanalyse geöffnet; Datenstand beachten.','warn');}));
  $('daHistory').querySelectorAll('[data-da-select]').forEach(el=>el.addEventListener('change',()=>{
    const a=historyRows[Number(el.dataset.daSelect)];if(el.checked&&selected.size>=5){el.checked=false;status('Maximal fünf Analysen auswählen.','warn');return;}
    if(el.checked)selected.set(a.id,a);else selected.delete(a.id);
  }));
  $('daPageLabel').textContent='Seite '+(page+1)+' · '+(r.count ?? '—')+' Analysen';
  $('daPrev').disabled=page===0||busy;$('daNext').disabled=(page+1)*20>=(r.count ?? 0)||busy;
}
async function loadTriggers(){
  const {sb,session}=access(),token=epoch;if(!sb||!session)return;
  const r=await sb.from('signal_news_triggers').select('id,news_title,symbols').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(50);
  if(token!==epoch)return;
  if(r.error){status('TRIGGER-KI-Liste nicht verfügbar. V31.2-SQL prüfen.','warn');return;}
  $('daTrigger').innerHTML='<option value="">Ohne ausgewählte Meldung</option>'+(r.data || []).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.news_title)+'</option>').join('');
  if(launchOrigin?.trigger_id)$('daTrigger').value=launchOrigin.trigger_id;
}
async function saveNote(){
  if(busy||!current?.id)return;
  const {sb,session}=access();if(!sb||!session)return;
  const id=current.id,token=epoch;
  const r=await sb.from('deep_analysis_notes').upsert({analysis_id:id,user_id:session.user.id,note:value('daNote'),updated_at:new Date().toISOString()});
  if(token===epoch&&current?.id===id)status(r.error?'Notiz nicht gespeichert.':'Notiz gespeichert; Originalanalyse unverändert.',r.error?'bad':'good');
}
function renderEvaluation(e){
  $('daEvaluation').innerHTML='<p>'+esc(e.matured?'Horizont vollständig beobachtet':'Noch nicht vollständig beobachtet')+' · '+e.observed_days+'/'+e.required_days+' Handelstage.</p>'+
    (e.matured?table(['Kennzahl','Ergebnis'],[['Realisierter Verlauf',num(e.realized_return_pct)+' %'],['Medianfehler',num(e.base_absolute_error_pct)+' %'],['Innerhalb P10–P90',e.in_model_band?'Ja':'Nein']])+
      table(['Richtungsbenchmark','Ergebnis nach gleichen Kosten'],Object.entries(e.benchmarks).map(([k,v])=>[k,num(v)+' %']))+
      '<p class="da-help">'+esc(e.benchmark_note)+'</p>':'')+'<p class="da-help">'+esc(e.note)+'</p>';
}
async function evaluate(){
  if(busy||!current?.id)return;const id=current.id,token=epoch;setBusy(true);status('Tatsächlichen Verlauf prüfen und getrennt speichern …');
  try{const r=await invoke({action:'evaluate',analysis_id:id,manual_start:true,...(imported?{bars:imported}:{})});if(token!==epoch||current?.id!==id)return;renderEvaluation(r.evaluation);status('Auswertung gespeichert; kein KI-Aufruf.','good');}
  catch(e){if(token===epoch)status(e.message,'bad');}finally{if(token===epoch)setBusy(false);}
}
async function loadArchive(){
  const {sb,session}=access(),token=epoch;if(!sb||!session)return;
  const r=await sb.from('deep_sources').select('snapshot').eq('user_id',session.user.id).eq('symbol',value('daSymbol').trim().toUpperCase()).order('last_seen_at',{ascending:false}).limit(100);
  if(token!==epoch)return;$('daArchive').innerHTML=r.error?'<p>Quellenarchiv nicht verfügbar; V32-SQL prüfen.</p>':sourcesHtml((r.data || []).map(r=>r.snapshot));
}
async function loadJournal(){
  const {sb,session}=access(),token=epoch;if(!sb||!session)return;
  const r=await sb.from('deep_evaluations').select('analysis_id,result,evaluated_at').eq('user_id',session.user.id).order('evaluated_at',{ascending:false}).limit(500);
  if(token!==epoch)return;
  if(r.error){$('daJournal').textContent='Journal nicht verfügbar; V32-SQL prüfen.';return;}
  const unique=new Map();for(const row of r.data || [])if(!unique.has(row.analysis_id))unique.set(row.analysis_id,row.result);
  const all=[...unique.values()],mature=all.filter(e=>e.matured),avg=key=>{
    const a=mature.map(e=>key(e)).filter(Number.isFinite);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
  };
  $('daJournal').innerHTML=table(['Journal (letzte 500 Auswertungen)','Wert'],[['Eindeutige Auswertungen',all.length],['Abgeschlossene Horizonte',mature.length],
    ['Mittlerer Medianfehler',num(avg(e=>e.base_absolute_error_pct))+' %'],['Bandabdeckung in dieser Stichprobe',mature.length?num(mature.filter(e=>e.in_model_band).length/mature.length*100)+' %':'—'],
    ['Ø Buy/Hold',num(avg(e=>e.benchmarks?.buy_hold))+' %'],['Ø Regeln',num(avg(e=>e.benchmarks?.rules))+' %'],['Ø KI',num(avg(e=>e.benchmarks?.ai))+' %']])+
    '<p class="da-help">Manuell ausgewählte, möglicherweise überlappende Analysen; keine unabhängige Teststichprobe oder kalibrierte Erfolgsquote. KI-Mittelwert nur über verfügbare KI-Auswertungen. Ein fehlender KI-Wert wird nicht als Nullrendite gezählt.</p>';
}
function compare(){
  const rows=[...selected.values()];if(rows.length<2){status('Mindestens zwei Analysen zum Vergleich auswählen.','warn');return;}
  const symbols=new Set(rows.map(a=>a.symbol));if(symbols.size!==1){status('Für den Vergleich dasselbe Symbol auswählen.','warn');return;}
  const sorted=rows.sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)),latest=sorted.at(-1),delta=comparePrior(sorted.slice(0,-1),latest);
  $('daComparison').innerHTML=table(['Datum','Horizont','Kurs','Bias','Score'],sorted.map(a=>[dt(a.created_at),a.request.days,num(a.chart.price)+' '+a.currency,a.narrative.bias,a.chart.score]))+
    table(['Vergleich mit jüngster Auswahl','Kursänderung','Score Δ'],delta.map(d=>[dt(d.created_at),num(d.price_change_pct)+' %',d.score_delta]))+
    table(['Produkt','Stand / Horizont','Stress P10','Entscheidung'],sorted.filter(a=>a.product.available).map(a=>[a.product.reference||a.product.type,
      a.price_date+' / '+a.request.days+' Tage',num(a.product.rows?.find(r=>r.scenario==='stress')?.return_p10_pct)+' %',a.product.decision]))+
    '<p class="da-help">Produktvergleich nur bei gleichen Basiswerten, Datenständen, Horizonten und Annahmen sinnvoll.</p>';
}
function demo(){
  if(busy)return;
  const bars=[],end=new Date();end.setUTCDate(end.getUTCDate()-1);let p=100;
  for(let i=1100;i>=0;i--){const d=new Date(end);d.setUTCDate(end.getUTCDate()-i);if([0,6].includes(d.getUTCDay()))continue;
    const open=p;p*=Math.exp(.00015+.012*Math.sin(i*1.73));bars.push({date:d.toISOString().slice(0,10),open,high:Math.max(open,p)*1.009,low:Math.min(open,p)*.991,close:p,volume:1000000+200000*Math.sin(i)});
  }
  const body=validateDeepInput({symbol:'DEMO.US',currency:'USD',company:'SYNTHETISCHE DEMO',days:20,lookback:756,use_ai:false,manual_start:true,
    risk:{capital:10000},product:{type:'ko',barrier:p*.9,financing:p*.88,premium:p*.012,ratio:.1,observation:'continuous',terms_verified:true,reference:'SYNTHETISCH – keine Produktdaten'}});
  const a=buildDeepAnalysis(body,bars,{provider:'SYNTHETISCHE DEMONSTRATION – keine Marktpreise'});
  a.warnings=['Synthetische Testdaten; keine Investmentidee, echten Kurse oder realen Produktpreise.'];open(a);status('Synthetische Demonstration · keine echten Preise oder Produktdaten.','warn');
}
if(root){
  $('daForm').addEventListener('invalid',invalidInput,true);
  $('daForm').addEventListener('input',event=>{
    if(event.target.validity?.valid)event.target.removeAttribute('aria-invalid');
  });
  $('daOpen').addEventListener('click',()=>root.scrollIntoView({behavior:'smooth',block:'start'}));
  if(launchSymbol&&/^[A-Z0-9_^+\-]{1,25}\.[A-Z0-9]{1,12}$/.test(launchSymbol))$('daSymbol').value=launchSymbol;
  $('daForm').addEventListener('submit',e=>{e.preventDefault();return run();});
  $('daDemo').addEventListener('click',demo);$('daHistoryLoad').addEventListener('click',()=>loadHistory());
  $('daPrev').addEventListener('click',()=>{if(page>0&&!busy){page--;return loadHistory(false);}});
  $('daNext').addEventListener('click',()=>{if(!busy){page++;return loadHistory(false);}});
  $('daCompare').addEventListener('click',compare);$('daSourceLoad').addEventListener('click',loadArchive);$('daJournalLoad').addEventListener('click',loadJournal);
  $('daLoadTriggers').addEventListener('click',loadTriggers);$('daNoteSave').addEventListener('click',saveNote);$('daEvaluate').addEventListener('click',evaluate);
  $('daScenario').addEventListener('change',()=>{if(current)$('daChart').innerHTML=chartSvg(current);});
  $('daTrigger').addEventListener('change',()=>{launchOrigin=null;});
  $('daCopy').addEventListener('click',()=>{
    $('daSymbol').value=$('ssSymbol').value;$('daCurrency').value=$('ssCurrency').value;$('daCompany').value=$('ssCompany').value;$('daContext').value=$('ssContext').value;
    clearImport();status('Eingaben übernommen. Eine in V31 ausgewählte Meldung bitte auch hier unter TRIGGER KI auswählen.','warn');
  });
  $('daClearCsv').addEventListener('click',clearImport);
  $('daSymbol').addEventListener('change',()=>{clearImport();launchOrigin=null;$('daTrigger').value='';});
  $('daCsv').addEventListener('change',async e=>{
    const token=epoch;
    try{const f=e.target.files[0];if(!f)return;if(f.size>600000)throw new Error('CSV maximal 600 kB.');const parsed=parseOhlcvCsv(await f.text());if(token!==epoch)return;imported=parsed;$('daCsvStatus').textContent=imported.length+' importierte Tageskerzen.';}
    catch(e){if(token===epoch){clearImport();status(e.message,'bad');}}
  });
  $('daExport').addEventListener('click',()=>{
    if(!current)return;const url=URL.createObjectURL(new Blob([JSON.stringify(current,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='Deep-Analyse-'+current.symbol+'-'+current.price_date+'.json';a.click();URL.revokeObjectURL(url);
  });
  window.addEventListener('investition:auth-changed',()=>{
    epoch++;historyToken++;current=null;selected.clear();historyRows=[];historyTotal=0;page=0;clearImport();launchOrigin=null;setBusy(false);
    $('daResults').hidden=true;for(const id of ['daHistory','daArchive','daJournal','daComparison'])$(id).textContent='Nach Anmeldung neu laden.';
    $('daTrigger').innerHTML='<option value="">Ohne ausgewählte Meldung</option>';$('daPrev').disabled=true;$('daNext').disabled=true;
    status('Anmeldung geändert. Analyse und Kontextauswahl zurückgesetzt.');
  });
  // Deliberately no invoke on auth, news, visibility, link opening, history or context selection.
  status('V32.0.1 bereit. Deep-Analyse über den Startknopf manuell starten.');
}
