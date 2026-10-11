import { buildSignalAnalysis, parseOhlcvCsv, selectNews } from './supabase/functions/_shared/signal-engine.mjs?v=31.0';
import { validateSignalInput } from './supabase/functions/_shared/signal-service.mjs?v=31.0';

const $ = id => document.getElementById(id);
const page = $('signalSimulationPage');
const html = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const num = v => v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : new Intl.NumberFormat('de-DE', { maximumFractionDigits:4 }).format(v);
const safeUrl = v => { try { const u = new URL(v); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const date = v => new Date(v).toLocaleString('de-DE', { timeZone:'Europe/Berlin' });
const dashboard = () => window.InvestitionDashboard;
const access = () => ({ sb:dashboard()?.getSupabase?.(), session:dashboard()?.getSession?.() });
let current = null, imported = null, rules = [], busy = false, epoch = 0, checking = false;

function status(message, type = '') { $('ssStatus').textContent = message; $('ssStatus').className = `ss-status ${type}`; }
function setBusy(v) { busy = v; page.setAttribute('aria-busy', String(v)); for (const id of ['ssRun','ssDemo','ssSaveRule','ssCheckRules','ssLoadHistory']) $(id).disabled = v; }
function formInput() { return validateSignalInput({ symbol:$('ssSymbol').value, currency:$('ssCurrency').value, company:$('ssCompany').value, context:$('ssContext').value, days:Number($('ssDays').value), use_ai:$('ssUseAi').checked, news_impulse:$('ssNewsImpulse').checked, ...(imported ? {bars:imported} : {}) }); }
function populateForm(input) { $('ssSymbol').value = input.symbol; $('ssCurrency').value = input.currency; $('ssCompany').value = input.company || ''; $('ssContext').value = input.context || ''; $('ssDays').value = input.days; $('ssUseAi').checked = input.use_ai !== false; $('ssNewsImpulse').checked = input.news_impulse === true; clearImport(); }
function clearImport() { imported = null; $('ssCsv').value = ''; $('ssCsvStatus').textContent = 'Kein Import; Kurse kommen aus dem Marktcache/EODHD.'; }
async function errorText(error) { try { if (error?.context instanceof Response) return (await error.context.clone().json()).error || error.message; } catch {} return error?.message || String(error); }

async function run(input = null, rule = null) {
  if (busy) return false;
  const runEpoch = epoch;
  let body;
  try { body = input || formInput(); } catch(e) { status(e.message, 'bad'); return false; }
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
    status(`Analyse abgeschlossen · ${analysis.symbol} · ${analysis.narrative.mode === 'ai' ? 'KI + Chartberechnung' : 'Chartregeln; KI nicht aktiv'} · Kursstand ${analysis.price_date}`, analysis.quality.blocked || analysis.warnings?.length ? 'warn' : 'good');
    if (rule && analysis.sources?.length) {
      const latest = analysis.sources.map(n => n.published_at).sort().at(-1);
      const update = await sb.from('signal_watch_rules').update({ last_news_at:latest }).eq('id', rule.id).eq('user_id', session.user.id);
      if (update.error) status('Analyse berechnet; Trigger-Zeitpunkt konnte nicht gespeichert werden.', 'warn');
      else rule.last_news_at = latest;
    }
    await loadHistory(); return true;
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
    ['News / Modus',`${a.sources.length} Quellen`,a.narrative.mode === 'ai' ? 'KI-Auswertung aktiv' : 'Regelbasierte Berechnung']
  ].map(([label,value,detail]) => `<article class="card ss-metric"><span class="ss-small">${html(label)}</span><strong>${html(value)}</strong><span class="ss-small">${html(detail)}</span></article>`).join('');
  $('ssQuality').innerHTML = `<div class="ss-note">${a.quality.blocked ? '<b class="ss-bad">Handelsschwellen gesperrt. </b>' : ''}Daten: ${a.quality.bars} Tageskerzen · ${a.quality.ageDays} Kalendertage seit letzter Kerze. ${html([...a.quality.notes,...(a.warnings || [])].join(' '))}<br>${html(a.limitations.join(' '))}</div>`;
  $('ssChart').innerHTML = chartSvg(a);
  $('ssSimulationInfo').textContent = `${a.simulation.paths} Pfade · Seed ${a.simulation.seed} · ${a.simulation.model} Tagesdrift ${(a.simulation.drift*100).toFixed(3)} %. Newsimpuls ${num(a.simulation.newsBias)}. ${a.simulation.newsImpulseRule} ${a.simulation.note}`;
  $('ssScenarios').innerHTML = a.scenarios.map(s => `<article class="ss-method"><h4>${html(s.name)}</h4><b>${num(s.endpoint)} ${html(a.currency)}</b><p>${html(s.condition)}</p><small>Illustrative Bedingung; keine gemessene Ereigniswahrscheinlichkeit.</small></article>`).join('');
  $('ssTriggers').innerHTML = (a.triggerReport || []).map(t => `<div class="ss-trigger"><b>${t.active ? '● Aktiv' : '○ Nicht bestätigt'}</b> · ${html(t.name)} · ${html(typeof t.value === 'number' ? num(t.value) : t.value ?? '—')}</div>`).join('') || '<p>Lokale Berechnung: Chartbefunde siehe Methoden.</p>';
  $('ssMethods').innerHTML = a.chart.methods.map(m => `<article class="ss-method"><h4>${html(m.name)}</h4><b>${html(m.finding)}</b><dl>${Object.entries(m.values).map(([k,v]) => `<dt>${html(k)}</dt><dd>${num(v)}</dd>`).join('')}</dl><p>${html(m.purpose)}</p><small>${html(m.limitation)}</small></article>`).join('');
  $('ssSetups').innerHTML = a.setups.map(s => `<article class="ss-method"><h4>${s.direction === 'long' ? 'Long / Einstieg' : 'Short / Absicherung prüfen'}</h4><b class="${s.status === 'gesperrt' ? 'ss-bad' : 'ss-warn'}">${html(s.status)}</b><p>${html(s.reason)}</p><dl><dt>Einstiegsschwelle</dt><dd>${num(s.entry)}</dd><dt>Stop / Ausstieg bei Verlust</dt><dd>${num(s.stop)}</dd><dt>Ziel 1 / Teilgewinn (2R)</dt><dd>${num(s.target1)}</dd><dt>Ziel 2 / Ausstieg (3R)</dt><dd>${num(s.target2)}</dd><dt>Abstand zum Stop</dt><dd>${num(s.riskPercent)} %</dd></dl><p>${html(s.trigger)} ${s.volumeAvailable ? '' : '<b>Volumen fehlt: Trigger kann nicht vollständig bestätigt werden.</b>'}</p><p><b>Ungültig bei:</b> ${html(s.invalidation)}</p><p>${html(s.exit)} ${html(s.trailingStop)}</p><small>${html(s.pricingBasis)} 2R/3R sind Risikomultiplikatoren, keine statistischen Renditeziele. Stops können bei Gaps übersprungen werden.</small></article>`).join('');
  const n = a.narrative, map = { bullish:'positiv',bearish:'negativ',mixed:'gemischt',neutral:'neutral' };
  $('ssNarrative').innerHTML = `<b>${n.mode === 'ai' ? 'KI-News-Ableitung' : 'Chartregeln'} · ${html(map[n.bias] || n.bias)}</b><p>${html(n.summary)}</p>${n.mode === 'ai' ? `<small>Subjektives KI-Vertrauen ${num(n.confidence)}/100; keine Prognosegüte.</small>` : ''}${n.evidence.map(e => `<p><b>Quelle ${html(e.source_id)}</b>: ${html(e.inference)}</p>`).join('')}<p><b>Beobachten:</b> ${html(n.watchpoints.join(' · ') || 'Trend, Ausbruch und Volumen bestätigen.')}</p><p><b>Risiken:</b> ${html(n.risks.join(' · ') || 'Datenqualität, Fehlausbrüche und unerwartete Ereignisse.')}</p>`;
  $('ssSources').innerHTML = a.sources.length ? a.sources.map(s => { const u = safeUrl(s.url); return `<p>${u ? `<a href="${html(u)}" target="_blank" rel="noopener noreferrer">${html(s.title)}</a>` : html(s.title)}<br><small>${html(s.source)} · ${html(date(s.published_at))} · ${s.match === 'direct' ? 'direkter Bezug' : 'Bezug zur Hypothese'} · Quelle ${html(s.id)}</small></p>`; }).join('') : '<p>Keine passenden aktuellen Feedquellen. Keine bestätigte News-These.</p>';
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
async function saveRule() {
  const { sb,session } = access();
  if (!sb || !session) { status('Zum Speichern bitte anmelden.','bad'); return; }
  try {
    const input = formInput(); delete input.bars;
    const baseline = new Date().toISOString();
    const { error } = await sb.from('signal_watch_rules').insert({ user_id:session.user.id,label:`${input.symbol} · ${input.days} Tage`,config:input,last_news_at:baseline });
    if (error) throw error;
    await loadRules(); status('Feedregel gespeichert. Neue passende Meldungen ab jetzt lösen die Prüfung aus.','good');
  } catch (e) { status(`Regel nicht gespeichert: ${e.message}`,'bad'); }
}
async function loadRules() {
  const { sb,session } = access(), loadEpoch = epoch;
  if (!sb || !session) return;
  const {data,error} = await sb.from('signal_watch_rules').select('*').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(30);
  if (loadEpoch !== epoch) return;
  if (error) { $('ssRules').textContent = 'Regeln noch nicht verfügbar. V31-SQL ausführen.'; return; }
  rules = data || [];
  $('ssRules').innerHTML = rules.length ? rules.map((r,i) => `<div class="ss-rule"><b>${html(r.label)}</b><div class="ss-small">Prüft neue Feedquellen nach ${html(date(r.last_news_at || r.created_at))}.</div><button type="button" class="btn" data-ss-open="${i}">Übernehmen</button><button type="button" class="btn" data-ss-delete="${i}">Entfernen</button></div>`).join('') : '<p>Noch keine Feedregeln gespeichert.</p>';
  $('ssRules').querySelectorAll('[data-ss-open]').forEach(b => b.addEventListener('click',() => populateForm(rules[Number(b.dataset.ssOpen)].config)));
  $('ssRules').querySelectorAll('[data-ss-delete]').forEach(b => b.addEventListener('click',async () => {
    const result = await sb.from('signal_watch_rules').delete().eq('id',rules[Number(b.dataset.ssDelete)].id).eq('user_id',session.user.id);
    if (result.error) status('Regel konnte nicht entfernt werden.','bad'); else await loadRules();
  }));
}
async function checkRules() {
  if (checking || busy) return;
  const {sb,session} = access(); if (!sb || !session) return;
  checking = true;
  const checkEpoch = epoch;
  try {
    await loadRules();
    const {data,error} = await sb.from('market_news').select('*').eq('is_published',true).gte('published_at',new Date(Date.now()-14*86400000).toISOString()).order('published_at',{ascending:false}).limit(1000);
    if (error) throw error;
    let triggered = 0;
    for (const rule of [...rules]) {
      if (checkEpoch !== epoch || triggered >= 3) break;
      const cfg = validateSignalInput(rule.config), fresh = selectNews(data,cfg.symbol,cfg.company,cfg.context).filter(n => Date.parse(n.published_at)>Date.parse(rule.last_news_at || rule.created_at));
      if (!fresh.length) continue;
      triggered++;
      status(`Neue Feedmeldung für ${cfg.symbol}; Analyse ${triggered}/3 wird gestartet …`);
      await run(cfg,rule);
    }
    if (checkEpoch !== epoch) return;
    await loadRules();
    if (!triggered) status('Keine neuen passenden Feedmeldungen für gespeicherte Regeln.','good');
    else status(`${triggered} Regeln ausgelöst (maximal 3 pro Prüfung). Ergebnisse und KI-Modus im Bericht prüfen.`, 'warn');
  } catch(e) { if (checkEpoch === epoch) status(`Feedprüfung nicht abgeschlossen: ${e.message}`,'bad'); }
  finally { checking = false; }
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
  status(derivative ? 'Basiswert übernommen. Notierungswährung des Basiswerts bestätigen; die Produktwährung wird nicht übernommen.' : 'Wert übernommen. Notierungswährung prüfen.', 'warn');
}
if (page) {
  $('ssForm').addEventListener('submit',e => { e.preventDefault(); run(); });
  $('ssDemo').addEventListener('click',demo); $('ssSelected').addEventListener('click',useSelected);
  $('ssSaveRule').addEventListener('click',saveRule); $('ssCheckRules').addEventListener('click',checkRules); $('ssLoadHistory').addEventListener('click',loadHistory);
  $('ssClearCsv').addEventListener('click',clearImport);
  $('ssCsv').addEventListener('change',async e => {
    try { const f=e.target.files[0]; if (!f) return; if (f.size>600000) throw new Error('CSV darf höchstens 600 kB groß sein.'); imported=parseOhlcvCsv(await f.text()); $('ssCsvStatus').textContent=`${imported.length} importierte Tageszeilen. Für lokale Berechnung KI ausschalten.`; }
    catch(err) { clearImport(); status(err.message,'bad'); }
  });
  $('ssSymbol').addEventListener('change',clearImport);
  $('ssChartDirection').addEventListener('change',() => { if (current) $('ssChart').innerHTML=chartSvg(current); });
  window.addEventListener('investition:signal-simulation-visible',async () => { await loadHistory(); await loadRules(); });
  window.addEventListener('investition:news-changed',() => { if ($('ssAutoFeed').checked && !document.hidden) checkRules(); });
  window.addEventListener('investition:auth-changed',() => {
    epoch++; current=null; imported=null; rules=[]; $('ssResults').hidden=true; $('ssHistory').textContent='Nach Anmeldung neu laden.'; $('ssRules').textContent='Nach Anmeldung neu laden.'; $('ssAutoFeed').checked=false; clearImport();
    if (!page.hidden) { loadHistory(); loadRules(); }
  });
  // Deferred navigation can select #signals before this module finishes loading.
  if (!page.hidden) { loadHistory(); loadRules(); }
}
