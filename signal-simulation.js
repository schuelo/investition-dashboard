import { buildSignalAnalysis, parseOhlcvCsv } from './supabase/functions/_shared/signal-engine.mjs?v=31.2';
import { validateSignalInput } from './supabase/functions/_shared/signal-service.mjs?v=31.2';

const $ = id => document.getElementById(id);
const page = $('signalSimulationPage');
const html = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const num = v => v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : new Intl.NumberFormat('de-DE', { maximumFractionDigits:4 }).format(v);
const safeUrl = v => { try { const u = new URL(v); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const date = v => new Date(v).toLocaleString('de-DE', { timeZone:'Europe/Berlin' });
const aiLabel = a => a.ai?.provider === 'gemini' ? 'Gemini' : a.ai?.provider === 'openai' ? 'OpenAI' : 'KI';
const dashboard = () => window.InvestitionDashboard;
const access = () => ({ sb:dashboard()?.getSupabase?.(), session:dashboard()?.getSession?.() });
let current = null, imported = null, selectedOrigin = null, triggers = [], busy = false, epoch = 0;
const launch = new URLSearchParams(window.location?.search || '');
const validId = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
const launchSymbol = /^[A-Z0-9_^+\-]{1,25}\.[A-Z0-9]{1,12}$/.test(launch.get('signal_symbol') || '') ? launch.get('signal_symbol') : null;
let pendingLaunch = validId(launch.get('signal_trigger')) ? { triggerId: launch.get('signal_trigger') } : validId(launch.get('signal_news')) ? { newsId: launch.get('signal_news') } : null;

function status(message, type = '') { $('ssStatus').textContent = message; $('ssStatus').className = `ss-status ${type}`; }
function setBusy(v) { busy = v; page.setAttribute('aria-busy', String(v)); for (const id of ['ssRun','ssDemo','ssLoadTriggers','ssLoadHistory']) $(id).disabled = v; }
function formInput() { return validateSignalInput({ symbol:$('ssSymbol').value, currency:$('ssCurrency').value, company:$('ssCompany').value, context:$('ssContext').value, days:Number($('ssDays').value), use_ai:$('ssUseAi').checked, manual_start:true, news_impulse:$('ssNewsImpulse').checked, ...(selectedOrigin?.id ? {trigger_id:selectedOrigin.id} : selectedOrigin?.news_id ? {source_news_id:selectedOrigin.news_id} : {}), ...(imported ? {bars:imported} : {}) }); }
function clearImport() { imported = null; $('ssCsv').value = ''; $('ssCsvStatus').textContent = 'Kein Import; Kurse kommen aus dem Marktcache/EODHD.'; }
async function errorText(error) { try { if (error?.context instanceof Response) return (await error.context.clone().json()).error || error.message; } catch {} return error?.message || String(error); }

async function run() {
  if (busy) return false;
  const runEpoch = epoch;
  let body;
  try { body = formInput(); } catch(e) { status(e.message, 'bad'); return false; }
  const { sb, session } = access();
  if ((!sb || !session) && !(body.bars && !body.use_ai)) { status('Bitte das Dashboard anmelden. Alternativ CSV mit ausgeschalteter KI lokal berechnen.', 'bad'); return false; }
  setBusy(true); status('Kursdaten prüfen, Chartmethoden berechnen und Verlauf simulieren …');
  try {
    let analysis;
    if (body.bars && !body.use_ai) {
      analysis = buildSignalAnalysis({ symbol:body.symbol, currency:body.currency, rawBars:body.bars, days:body.days, provider:'CSV lokal (Nutzerdaten)' });
      analysis.warnings = ['Lokal berechnet; keine KI-News-Auswertung und keine Cloudhistorie.'];
      analysis.request = { ...body, bars:undefined };
    } else {
      const result = await sb.functions.invoke('analyze-signal-path', { body });
      if (result.error) throw new Error(await errorText(result.error));
      if (!result.data?.ok || !result.data.analysis) throw new Error(result.data?.error || 'Kein Analyseergebnis empfangen.');
      analysis = result.data.analysis;
    }
    if (runEpoch !== epoch) return false;
    current = analysis; render(analysis);
    status(`Analyse abgeschlossen · ${analysis.symbol} · ${analysis.narrative.mode === 'ai' ? `${aiLabel(analysis)} + Chartberechnung` : 'Chartregeln; KI nicht aktiv'} · Kursstand ${analysis.price_date}`, analysis.quality.blocked || analysis.warnings?.length ? 'warn' : 'good');
    await Promise.allSettled([loadHistory(), loadTriggers()]); return true;
  } catch (e) { if (runEpoch === epoch) status(`Analyse fehlgeschlagen: ${e.message}`, 'bad'); return false; }
  finally { setBusy(false); }
}

function chartSvg(a) {
  const direction = $('ssChartDirection').value, setup = a.setups.find(s => s.direction === direction);
  const history = a.history, bands = a.simulation.bands, offset = history.length - 1;
  const marks = setup ? [['Einstieg',setup.entry,'#50d2c2'],['Stop',setup.stop,'#ff6b7a'],['Ziel 1',setup.target1,'#63a9ff']] : [];
  const values = [...history.map(b => b.close), ...bands.flatMap(b => [b.q10,b.q90]), ...marks.map(m => m[1])];
  const lower = Math.min(...values) * .98, upper = Math.max(...values) * 1.02, x = n => 65 + n / (offset + a.simulation.days) * 820, y = v => 285 - (v - lower) / (upper - lower || 1) * 235;
  const line = points => points.map(([xx, yy], i) => `${i ? 'L' : 'M'}${x(xx).toFixed(2)} ${y(yy).toFixed(2)}`).join(' ');
  const historyLine = line(history.map((b,i) => [i,b.close])), median = line(bands.map(b => [offset+b.day,b.q50]));
  const fan = `${line(bands.map(b => [offset+b.day,b.q10]))} ${bands.slice().reverse().map(b => `L${x(offset+b.day).toFixed(2)} ${y(b.q90).toFixed(2)}`).join(' ')} Z`;
  return `<svg class="ss-chart" viewBox="0 0 960 335" role="img" aria-label="Historischer Kurs, modelliertes P10 bis P90 Band und P50 Kurve; keine gesicherte Prognose">
    ${[0,.25,.5,.75,1].map(t => {const v = lower + t*(upper-lower); return `<line x1="65" y1="${y(v)}" x2="885" y2="${y(v)}" stroke="#24384a"/><text x="2" y="${y(v)+4}">${html(num(v))}</text>`;}).join('')}
    <path d="${fan}" fill="#63a9ff" fill-opacity=".15"/><path d="${historyLine}" fill="none" stroke="#e7eef6" stroke-width="2"/><path d="${median}" fill="none" stroke="#63a9ff" stroke-width="2" stroke-dasharray="6 3"/>
    <line x1="${x(offset)}" y1="40" x2="${x(offset)}" y2="290" stroke="#8fa3b7" stroke-dasharray="4 4"/>
    ${marks.map(([label,value,color]) => `<line x1="${x(offset)}" y1="${y(value)}" x2="885" y2="${y(value)}" stroke="${color}" stroke-dasharray="3 5"/><text class="ss-mark" x="890" y="${y(value)+4}">${label}</text>`).join('')}
    <text x="65" y="310">${html(history[0].date)}</text><text x="${x(offset)-65}" y="330">Kursstand ${html(a.price_date)}</text><text x="770" y="310">+${a.simulation.days} Handelstage</text>
    ${bands.filter(b => b.day>0).map(b => `<circle cx="${x(offset+b.day)}" cy="${y(b.q50)}" r="7" fill="transparent"><title>Tag ${b.day}: P10 ${num(b.q10)}, P50 ${num(b.q50)}, P90 ${num(b.q90)} ${html(a.currency)}</title></circle>`).join('')}
  </svg>`;
}

function render(a) {
  $('ssResults').hidden = false;
  $('ssResultTitle').textContent = `${a.symbol} · ${a.currency} · ${a.simulation.days} Handelstage`;
  const end = a.simulation.bands.at(-1);
  $('ssMetrics').innerHTML = [
    ['Letzter Schlusskurs',`${num(a.chart.price)} ${a.currency}`,`${a.price_date} · ${a.provider}`],
    ['Chartscore',`${a.chart.score}/100`,'Trend 40 %, MACD 25 %, Ausbruch 20 %, RSI 15 %'],
    ['Mittlerer Modellwert',`${num(end.q50)} ${a.currency}`,'P50 am Horizontende; keine Zielkursprognose'],
    ['News / Modus',`${a.sources.length} Quellen`,a.narrative.mode === 'ai' ? `${aiLabel(a)}-Auswertung aktiv` : 'Regelbasierte Berechnung']
  ].map(([label,value,detail]) => `<article class="card ss-metric"><span class="ss-small">${html(label)}</span><strong>${html(value)}</strong><span class="ss-small">${html(detail)}</span></article>`).join('');
  $('ssQuality').innerHTML = `<div class="ss-note">${a.quality.blocked ? '<b class="ss-bad">Handelsschwellen gesperrt. </b>' : ''}Daten: ${a.quality.bars} Tageskerzen · ${a.quality.ageDays} Kalendertage seit letzter Kerze. ${html([...a.quality.notes,...(a.warnings || [])].join(' '))}<br>${html(a.limitations.join(' '))}</div>`;
  $('ssChart').innerHTML = chartSvg(a);
  $('ssSimulationInfo').textContent = `${a.simulation.paths} Pfade · Seed ${a.simulation.seed} · ${a.simulation.model} Tagesdrift ${(a.simulation.drift*100).toFixed(3)} %. Newsimpuls ${num(a.simulation.newsBias)}. ${a.simulation.newsImpulseRule} ${a.simulation.note}`;
  $('ssScenarios').innerHTML = a.scenarios.map(s => `<article class="ss-method"><h4>${html(s.name)}</h4><b>${num(s.endpoint)} ${html(a.currency)}</b><p>${html(s.condition)}</p><small>Illustrative Bedingung; keine gemessene Ereigniswahrscheinlichkeit.</small></article>`).join('');
  $('ssTriggers').innerHTML = (a.triggerReport || []).map(t => `<div class="ss-trigger"><b>${t.active ? '● Aktiv' : '○ Nicht bestätigt'}</b> · ${html(t.name)} · ${html(typeof t.value === 'number' ? num(t.value) : t.value ?? '—')}</div>`).join('') || '<p>Lokale Berechnung: Chartbefunde siehe Methoden.</p>';
  $('ssMethods').innerHTML = a.chart.methods.map(m => `<article class="ss-method"><h4>${html(m.name)}</h4><b>${html(m.finding)}</b><dl>${Object.entries(m.values).map(([k,v]) => `<dt>${html(k)}</dt><dd>${num(v)}</dd>`).join('')}</dl><p>${html(m.purpose)}</p><small>${html(m.limitation)}</small></article>`).join('');
  $('ssSetups').innerHTML = a.setups.map(s => `<article class="ss-method"><h4>${s.direction === 'long' ? 'Long / Einstieg' : 'Short / Absicherung prüfen'}</h4><b class="${s.status === 'gesperrt' ? 'ss-bad' : 'ss-warn'}">${html(s.status)}</b><p>${html(s.reason)}</p><dl><dt>Einstiegsschwelle</dt><dd>${num(s.entry)}</dd><dt>Stop / Ausstieg bei Verlust</dt><dd>${num(s.stop)}</dd><dt>Ziel 1 / Teilgewinn (2R)</dt><dd>${num(s.target1)}</dd><dt>Ziel 2 / Ausstieg (3R)</dt><dd>${num(s.target2)}</dd><dt>Abstand zum Stop</dt><dd>${num(s.riskPercent)} %</dd></dl><p>${html(s.trigger)} ${s.volumeAvailable ? '' : '<b>Volumen fehlt: Trigger kann nicht vollständig bestätigt werden.</b>'}</p><p><b>Ungültig bei:</b> ${html(s.invalidation)}</p><p>${html(s.exit)} ${html(s.trailingStop)}</p><small>${html(s.pricingBasis)} 2R/3R sind Risikomultiplikatoren, keine statistischen Renditeziele. Stops können bei Gaps übersprungen werden.</small></article>`).join('');
  const n = a.narrative, map = { bullish:'positiv',bearish:'negativ',mixed:'gemischt',neutral:'neutral' };
  $('ssNarrative').innerHTML = `<b>${n.mode === 'ai' ? `${html(aiLabel(a))}-News-Ableitung` : 'Chartregeln'} · ${html(map[n.bias] || n.bias)}</b><p>${html(n.summary)}</p>${n.mode === 'ai' ? `<small>${a.ai?.model ? `Modell: ${html(a.ai.model)} · ` : ''}Subjektives KI-Vertrauen ${num(n.confidence)}/100; keine Prognosegüte.</small>` : ''}${n.evidence.map(e => `<p><b>Quelle ${html(e.source_id)}</b>: ${html(e.inference)}</p>`).join('')}<p><b>Beobachten:</b> ${html(n.watchpoints.join(' · ') || 'Trend, Ausbruch und Volumen bestätigen.')}</p><p><b>Risiken:</b> ${html(n.risks.join(' · ') || 'Datenqualität, Fehlausbrüche und unerwartete Ereignisse.')}</p>`;
  $('ssSources').innerHTML = a.sources.length ? a.sources.map(s => { const u = safeUrl(s.url); return `<p>${u ? `<a href="${html(u)}" target="_blank" rel="noopener noreferrer">${html(s.title)}</a>` : html(s.title)}<br><small>${html(s.source)} · ${html(date(s.published_at))} · ${s.match === 'selected' ? 'manuell ausgewählte Meldung; Bezug zum Wert prüfen' : s.match === 'direct' ? 'direkter Bezug' : 'Bezug zur Hypothese'} · Quelle ${html(s.id)}</small></p>`; }).join('') : '<p>Keine passenden aktuellen Feedquellen. Keine bestätigte News-These.</p>';
}

async function loadHistory() {
  const { sb, session } = access(), loadEpoch = epoch;
  if (!sb || !session) { $('ssHistory').textContent = 'Nach Anmeldung verfügbar.'; return; }
  const { data,error } = await sb.from('signal_simulations').select('id,symbol,currency,horizon_days,created_at,raw_result').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(15);
  if (loadEpoch !== epoch) return;
  if (error) { $('ssHistory').textContent = 'Historie noch nicht verfügbar. V31-SQL ausführen.'; return; }
  $('ssHistory').innerHTML = data?.length ? data.map((r,i) => `<button type="button" class="ss-history-item" data-ss-history="${i}">${html(r.symbol)} · ${r.horizon_days} Tage<small>${html(date(r.created_at))}</small></button>`).join('') : '<p>Noch keine Simulationen.</p>';
  $('ssHistory').querySelectorAll('[data-ss-history]').forEach(b => b.addEventListener('click',() => { current = data[Number(b.dataset.ssHistory)].raw_result; render(current); status('Gespeichertes Ergebnis geöffnet. Kursstand im Bericht beachten.','warn'); }));
}
function clearOrigin() { selectedOrigin=null; $('ssOrigin').textContent='Keine Meldung ausgewählt. Du kannst auch einen Wert direkt manuell analysieren.'; $('ssOriginSymbols').hidden=true; }
function prepareOrigin(row) {
  if (busy) return;
  selectedOrigin=row; clearImport();
  const symbols=Array.isArray(row.symbols)?row.symbols:[];
  $('ssSymbol').value=symbols[0] || '';
  $('ssCurrency').value=''; $('ssCompany').value=''; $('ssContext').value='';
  $('ssUseAi').checked=true; $('ssRun').textContent='KI-Analyse manuell starten';
  $('ssOriginSymbol').innerHTML=symbols.map(symbol=>`<option>${html(symbol)}</option>`).join('');
  $('ssOriginSymbols').hidden=symbols.length<2;
  $('ssOrigin').innerHTML=`<b>TRIGGER KI · ausgewählte Meldung</b><p>${html(row.news_title)}</p><small>${html(date(row.news_published_at))} · ${html(row.reason || 'Meldung aus Telegram. Bezug zum Basiswert prüfen.')}</small><p>Währung und Basiswert prüfen. Die KI startet erst über den Startknopf.</p>`;
  status('TRIGGER KI vorbereitet. Basiswert und Notierungswährung bestätigen, dann KI-Analyse manuell starten.','warn');
}
async function loadTriggers() {
  const {sb,session}=access(), loadEpoch=epoch;
  if (!sb || !session) { $('ssTriggerList').textContent='Nach Anmeldung verfügbar.'; return; }
  const {data,error}=await sb.from('signal_news_triggers').select('*').eq('user_id',session.user.id).not('delivered_at','is',null).order('created_at',{ascending:false}).limit(30);
  if (loadEpoch!==epoch) return;
  if (error) { $('ssTriggerList').textContent='Triggerliste nicht verfügbar. setup-v31-2-manual-triggers.sql prüfen.'; return; }
  triggers=data || [];
  $('ssTriggerList').innerHTML=triggers.length?triggers.map((row,i)=>`<div class="ss-rule"><b>TRIGGER KI · ${html(row.news_title)}</b><div class="ss-small">${html(date(row.news_published_at))} · ${row.state==='analyzed'?'KI-Analyse erfolgt':row.state==='dismissed'?'Zurückgestellt':'Manueller Start ausstehend'}</div><button type="button" class="btn" data-ss-trigger="${i}">Analyse vorbereiten</button><button type="button" class="btn" data-ss-dismiss="${i}">Zurückstellen</button></div>`).join(''):'<p>Noch keine TRIGGER-KI-Meldungen. Sie erscheinen mit den nächsten regulären Telegram-Portfolio-News.</p>';
  $('ssTriggerList').querySelectorAll('[data-ss-trigger]').forEach(button=>button.addEventListener('click',()=>prepareOrigin(triggers[Number(button.dataset.ssTrigger)])));
  $('ssTriggerList').querySelectorAll('[data-ss-dismiss]').forEach(button=>button.addEventListener('click',async()=>{
    const row=triggers[Number(button.dataset.ssDismiss)];
    const result=await sb.from('signal_news_triggers').update({state:'dismissed'}).eq('id',row.id).eq('user_id',session.user.id);
    if (loadEpoch!==epoch) return;
    if (result.error) status('Meldung konnte nicht zurückgestellt werden.','bad');else await loadTriggers();
  }));
}
async function loadLaunch() {
  const {sb,session}=access(), loadEpoch=epoch;
  if (!pendingLaunch || !sb || !session || busy) return;
  let row,error;
  if (pendingLaunch.triggerId) {
    const result=await sb.from('signal_news_triggers').select('*').eq('id',pendingLaunch.triggerId).eq('user_id',session.user.id).maybeSingle();
    row=result.data; error=result.error;
  } else {
    const result=await sb.from('market_news').select('id,title,published_at,symbols').eq('id',pendingLaunch.newsId).eq('is_published',true).maybeSingle();
    error=result.error;
    if (result.data) row={news_id:result.data.id,news_title:result.data.title,news_published_at:result.data.published_at,symbols:launchSymbol?[launchSymbol]:(result.data.symbols || []).filter(symbol=>/^[A-Z0-9_^+\-]{1,25}\.[A-Z0-9]{1,12}$/.test(symbol))};
  }
  if (loadEpoch!==epoch || busy) return;
  if (error || !row) { status('TRIGGER-KI-Link nicht verfügbar oder gehört zu einer anderen Anmeldung.','warn'); return; }
  prepareOrigin(row); pendingLaunch=null;
}

function demo() {
  const rawBars = [], end = new Date(); end.setUTCDate(end.getUTCDate()-1); let p = 100;
  for (let i=299;i>=0;i--) {
    const d = new Date(end); d.setUTCDate(end.getUTCDate()-i);
    if ([0,6].includes(d.getUTCDay())) continue;
    const open=p; p *= Math.exp(.001 + .009*Math.sin(i*1.3));
    rawBars.push({date:d.toISOString().slice(0,10),open,high:Math.max(open,p)*1.012,low:Math.min(open,p)*.988,close:p,volume:1000000+200000*Math.sin(i)});
  }
  current = buildSignalAnalysis({symbol:'DEMO.US',currency:'USD',rawBars,days:Number($('ssDays').value),provider:'SYNTHETISCHE DEMONSTRATION – keine Marktpreise'});
  render(current); status('Synthetische Demonstration · keine echten Preise · nicht als Investmentidee verwenden.','warn');
}
function useSelected() {
  const t = dashboard()?.getSelectedTrade?.();
  if (!t?.marketSymbol) { status('Die ausgewählte Analyse hat kein EODHD-Symbol. Symbol inklusive Handelsplatz eingeben.','warn'); return; }
  $('ssSymbol').value=t.marketSymbol; $('ssCompany').value=t.name || '';
  const derivative = /knock|\bko\b|zertifikat/i.test(t.type || '');
  $('ssCurrency').value = derivative ? '' : t.currency || '';
  clearImport();
  clearOrigin();
  status(derivative ? 'Basiswert übernommen. Notierungswährung des Basiswerts bestätigen; die Produktwährung wird nicht übernommen.' : 'Wert übernommen. Notierungswährung prüfen.', 'warn');
}
if (page) {
  $('ssForm').addEventListener('submit',e => { e.preventDefault(); return run(); });
  $('ssDemo').addEventListener('click',demo); $('ssSelected').addEventListener('click',useSelected);
  $('ssLoadTriggers').addEventListener('click',loadTriggers); $('ssLoadHistory').addEventListener('click',loadHistory);
  $('ssClearOrigin').addEventListener('click',clearOrigin);
  $('ssOriginSymbol').addEventListener('change',()=>{if (!busy) {$('ssSymbol').value=$('ssOriginSymbol').value;clearImport();}});
  $('ssUseAi').addEventListener('change',()=>{$('ssRun').textContent=$('ssUseAi').checked?'KI-Analyse manuell starten':'Chartsimulation starten';});
  $('ssClearCsv').addEventListener('click',clearImport);
  $('ssCsv').addEventListener('change',async e => {
    try { const f=e.target.files[0]; if (!f) return; if (f.size>600000) throw new Error('CSV darf höchstens 600 kB groß sein.'); imported=parseOhlcvCsv(await f.text()); $('ssCsvStatus').textContent=`${imported.length} importierte Tageszeilen. Für lokale Berechnung KI ausschalten.`; }
    catch(err) { clearImport(); status(err.message,'bad'); }
  });
  $('ssSymbol').addEventListener('change',clearImport);
  $('ssChartDirection').addEventListener('change',() => { if (current) $('ssChart').innerHTML=chartSvg(current); });
  window.addEventListener('investition:signal-simulation-visible',() => Promise.allSettled([loadHistory(),loadTriggers(),loadLaunch()]));
  window.addEventListener('investition:news-changed',() => { if (!page.hidden) return Promise.allSettled([loadTriggers()]); });
  window.addEventListener('investition:auth-changed',() => {
    epoch++; current=null; imported=null; triggers=[]; $('ssResults').hidden=true; $('ssHistory').textContent='Nach Anmeldung neu laden.'; $('ssTriggerList').textContent='Nach Anmeldung neu laden.'; clearImport(); clearOrigin();
    if (!page.hidden) return Promise.allSettled([loadHistory(),loadTriggers(),loadLaunch()]);
  });
  // Deferred navigation can select #signals before this module finishes loading.
  if (!page.hidden) Promise.allSettled([loadHistory(),loadTriggers(),loadLaunch()]);
}
