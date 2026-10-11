// Identical engine in the browser and Edge Function. No external dependencies.
export const SIGNAL_VERSION = '31.2-manual-signal-simulation';
export const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sd = a => Math.sqrt(mean(a.map(v => (v - mean(a)) ** 2)));
const last = a => a[a.length - 1];
const round = v => Number.isFinite(v) ? Number(v.toPrecision(8)) : null;

export function normalizeBars(input, now = new Date()) {
  if (!Array.isArray(input) || input.length > 2000) throw new Error('60–2000 tägliche OHLCV-Zeilen erforderlich.');
  const today = now.toISOString().slice(0, 10), dates = new Set(), notes = [];
  let excluded = 0;
  const rows = input.map((row, i) => {
    const date = String(row.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error(`Ungültiges Datum in Zeile ${i + 1}.`);
    if (dates.has(date)) throw new Error(`Doppeltes Datum: ${date}.`);
    dates.add(date);
    const vals = ['open', 'high', 'low', 'close'].map(k => row[k] === null || row[k] === '' || row[k] === undefined ? NaN : Number(row[k]));
    const [open, high, low, close] = vals;
    if (vals.some(v => !Number.isFinite(v) || v <= 0) || high < Math.max(open, low, close) || low > Math.min(open, close)) throw new Error(`Ungültige OHLC-Kurse am ${date}. Reine Schlusskursreihen reichen nicht.`);
    const adjusted = row.adjusted_close == null ? close : Number(row.adjusted_close);
    if (!Number.isFinite(adjusted) || adjusted <= 0) throw new Error(`Ungültiger adjustierter Schlusskurs am ${date}.`);
    const volume = row.volume == null || row.volume === '' ? null : Number(row.volume);
    if (volume !== null && (!Number.isFinite(volume) || volume < 0)) throw new Error(`Ungültiges Volumen am ${date}.`);
    return { date, open, high, low, close, volume, factor: adjusted / close };
  }).filter(r => { if (r.date >= today) { excluded++; return false; } return true; }).sort((a, b) => a.date.localeCompare(b.date)).slice(-300);
  if (rows.length < 60) throw new Error('Mindestens 60 abgeschlossene Tageskerzen erforderlich.');
  if (excluded) notes.push(`${excluded} heutige/zukünftige Zeilen ausgeschlossen; nur abgeschlossene Tageskerzen.`);
  const f = last(rows).factor;
  const recentAdjustment = rows.slice(-21).some(r => Math.abs(r.factor / f - 1) > 0.08);
  const bars = rows.map(r => ({ date: r.date, open: r.open * r.factor / f, high: r.high * r.factor / f, low: r.low * r.factor / f, close: r.close * r.factor / f, volume: r.volume }));
  if (rows.some(r => Math.abs(r.factor / f - 1) > 0.001)) notes.push('Historische OHLC-Werte über adjusted_close auf die jüngste Rohkursbasis skaliert (inkl. Dividenden).');
  const unresolvedJump = bars.slice(1).some((r, i) => Math.abs(Math.log(r.close / bars[i].close)) > Math.log(1.6));
  if (unresolvedJump) notes.push('Extremer Kurssprung: Kapitalmaßnahme oder Ereignis prüfen. Handelsschwellen gesperrt.');
  if (recentAdjustment) notes.push('Volumenvergleich wegen möglicher Kapitalmaßnahme in den letzten 21 Tagen gesperrt.');
  return { bars, notes, unresolvedJump, volumeValid: !recentAdjustment, ageDays: Math.floor((Date.parse(today) - Date.parse(last(bars).date)) / 86400000) };
}

export function ema(values, period) {
  const out = Array(values.length).fill(null);
  if (values.length < period) return out;
  out[period - 1] = mean(values.slice(0, period));
  for (let i = period; i < values.length; i++) out[i] = values[i] * (2 / (period + 1)) + out[i - 1] * (1 - 2 / (period + 1));
  return out;
}
export function rsi(values, period = 14) {
  if (values.length <= period) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) { gain += Math.max(0, values[i] - values[i - 1]); loss += Math.max(0, values[i - 1] - values[i]); }
  gain /= period; loss /= period;
  for (let i = period + 1; i < values.length; i++) { const d = values[i] - values[i - 1]; gain = (gain * (period - 1) + Math.max(d, 0)) / period; loss = (loss * (period - 1) + Math.max(-d, 0)) / period; }
  return gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}
export function atr(bars, period = 14) {
  const tr = bars.slice(1).map((b, i) => Math.max(b.high - b.low, Math.abs(b.high - bars[i].close), Math.abs(b.low - bars[i].close)));
  if (tr.length < period) return null;
  let a = mean(tr.slice(0, period));
  for (const t of tr.slice(period)) a = (a * (period - 1) + t) / period;
  return a;
}
export function technicals(bars, volumeValid = true) {
  const close = bars.map(b => b.close), price = last(close), sma = n => close.length >= n ? mean(close.slice(-n)) : null;
  const sma20 = sma(20), sma50 = sma(50), sma200 = sma(200);
  const fast = ema(close, 12), slow = ema(close, 26);
  const macdSeries = close.map((_, i) => slow[i] === null ? null : fast[i] - slow[i]).filter(v => v !== null);
  const signal = last(ema(macdSeries, 9)), macd = last(macdSeries), histogram = macd - signal;
  const previousHistogram = macdSeries.at(-2) - ema(macdSeries, 9).at(-2);
  const r = rsi(close), a = atr(bars), sigma = sd(close.slice(-20));
  // Prior completed bars only: today's breakout must not move its own threshold.
  const prior = bars.slice(-21, -1), support = Math.min(...prior.map(b => b.low)), resistance = Math.max(...prior.map(b => b.high));
  const volumeRows = prior.map(b => b.volume);
  const vol = volumeValid && last(bars).volume !== null && volumeRows.every(v => v !== null) && mean(volumeRows) > 0 ? last(bars).volume / mean(volumeRows) : null;
  const trend = price > sma20 && sma20 > sma50 ? 1 : price < sma20 && sma20 < sma50 ? -1 : 0;
  const momentum = histogram > 0 && histogram >= previousHistogram ? 1 : histogram < 0 && histogram <= previousHistogram ? -1 : 0;
  const breakout = price > resistance ? 1 : price < support ? -1 : 0;
  const rsiSignal = r >= 50 && r <= 70 ? 1 : r >= 30 && r < 50 ? -1 : 0;
  const score = Math.round(100 * (.4 * trend + .25 * momentum + .2 * breakout + .15 * rsiSignal));
  const methods = [
    { name: 'Trend: SMA 20 / 50 / 200', values: { sma20, sma50, sma200 }, finding: trend === 1 ? 'Aufwärtstrend' : trend === -1 ? 'Abwärtstrend' : 'Gemischter Trend', purpose: 'Trendfilter; SMA200 erst ab 200 Kerzen.', limitation: 'Nachlaufend; keine unabhängige Bestätigung von MACD.' },
    { name: 'MACD 12 / 26 / 9', values: { macd, signal, histogram }, finding: momentum === 1 ? 'Positives Momentum nimmt zu' : momentum === -1 ? 'Negatives Momentum nimmt zu' : 'Momentum gemischt', purpose: 'EMA-Differenz und 9er EMA-Signallinie.', limitation: 'In Seitwärtsphasen häufige Fehlsignale.' },
    { name: 'RSI 14 (Wilder)', values: { rsi: r }, finding: r > 70 ? 'Überkauft' : r < 30 ? 'Überverkauft' : 'Neutraler Bereich', purpose: 'Momentum und Überdehnung; Extremwert allein löst keinen Trade aus.', limitation: 'Kann in starken Trends lange extrem bleiben.' },
    { name: 'ATR 14 (Wilder)', values: { atr: a, atrPercent: a / price * 100 }, finding: 'Volatilität bestimmt Puffer und Stopabstand', purpose: 'True Range inkl. Gaps; Wilder-Glättung.', limitation: 'Misst Schwankung, keine Richtung.' },
    { name: 'Bollinger-Bänder 20 / 2', values: { lower: sma20 - 2 * sigma, middle: sma20, upper: sma20 + 2 * sigma }, finding: price > sma20 + 2 * sigma ? 'Oberes Band überschritten' : price < sma20 - 2 * sigma ? 'Unteres Band unterschritten' : 'Innerhalb der Bänder', purpose: '20er SMA ± 2 Standardabweichungen (Population).', limitation: 'Bänder sind keine 95-%-Prognoseintervalle.' },
    { name: 'Donchian 20: Unterstützung / Widerstand', values: { support, resistance }, finding: breakout === 1 ? 'Ausbruch nach oben' : breakout === -1 ? 'Ausbruch nach unten' : 'Innerhalb der vorherigen Handelsspanne', purpose: 'Hoch/Tief der 20 vorherigen Tageskerzen.', limitation: 'Zonen ändern sich mit rollierendem Fenster; Fehlausbrüche möglich.' },
    { name: 'Volumenbestätigung 20', values: { volumeRatio: vol }, finding: vol === null ? 'Nicht verfügbar / Kapitalmaßnahme' : vol >= 1.5 ? 'Erhöhtes Volumen' : 'Kein starkes Volumensignal', purpose: 'Letztes Volumen / Mittel der vorherigen 20 Kerzen; Bestätigung ab 1,5×.', limitation: 'Rohvolumen ist bei Splits und einigen Instrumenten ungeeignet.' }
  ];
  return { price, sma20, sma50, sma200, macd, signal, histogram, rsi: r, atr: a, support, resistance, volumeRatio: vol, trend, momentum, breakout, score, methods };
}

export function validateNarrative(raw, sourceIds) {
  if (!raw || typeof raw.summary !== 'string' || !['bullish', 'bearish', 'mixed', 'neutral'].includes(raw.bias) || !Number.isFinite(raw.confidence) || raw.confidence < 0 || raw.confidence > 100 || !Array.isArray(raw.evidence) || !Array.isArray(raw.risks) || raw.risks.some(v => typeof v !== 'string') || !Array.isArray(raw.watchpoints) || raw.watchpoints.some(v => typeof v !== 'string')) throw new Error('KI-Antwort entspricht nicht dem erwarteten Format.');
  if (raw.evidence.some(e => !sourceIds.includes(e.source_id) || typeof e.inference !== 'string')) throw new Error('KI-Antwort verweist auf unbekannte Quellen.');
  if (raw.bias !== 'neutral' && !raw.evidence.length) throw new Error('Gerichtete KI-These ohne Quellenbeleg verworfen.');
  return { mode: 'ai', summary: raw.summary.slice(0, 2000), bias: raw.bias, confidence: raw.confidence, evidence: raw.evidence.slice(0, 12), risks: raw.risks.slice(0, 8), watchpoints: raw.watchpoints.slice(0, 8) };
}

export function selectNews(rows, symbol, company = '', context = '', now = new Date(), selectedIds = []) {
  const normalize = v => String(v || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const name = normalize(company).trim(), keywords = normalize(context).split(/\W+/).filter(w => w.length >= 4), seen = new Set();
  return (rows || []).filter(n => {
    const age = now.getTime() - Date.parse(n.published_at);
    return n.is_published !== false && Number.isFinite(age) && age >= 0 && age <= 14 * 86400000;
  }).map(n => {
    const symbols = Array.isArray(n.symbols) ? n.symbols : [];
    const text = normalize(`${n.title || ''} ${n.summary || ''}`);
    const direct = symbols.some(s => String(s).toUpperCase() === symbol) || (name.length >= 4 && text.includes(name));
    const related = keywords.some(w => new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(text));
    return { ...n, match: selectedIds.includes(String(n.id)) ? 'selected' : direct ? 'direct' : related ? 'context' : null };
  }).filter(n => n.match).sort((a, b) => Number(b.match === 'selected') - Number(a.match === 'selected') || Number(b.match === 'direct') - Number(a.match === 'direct') || Date.parse(b.published_at) - Date.parse(a.published_at)).filter(n => {
    const key = normalize(n.title).replace(/\W/g, '');
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 12).map(n => ({ id: String(n.id), title: String(n.title || '').slice(0, 350), summary: String(n.summary || '').slice(0, 1200), published_at: n.published_at, url: n.source_url || n.url || '', source: n.source_name || n.source || 'Feed', match: n.match }));
}

function seeded(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }
export function hashSeed(value) { let h = 2166136261; for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function quantile(a, q) { const x = [...a].sort((a, b) => a - b), pos = (x.length - 1) * q, lo = Math.floor(pos); return x[lo] + (x[Math.ceil(pos)] - x[lo]) * (pos - lo); }
export function simulate(bars, chart, { days = 20, paths = 800, seed = 1, newsBias = 0 } = {}) {
  if (![5, 20, 60].includes(days) || !Number.isInteger(paths) || paths < 100 || paths > 2000 || !Number.isFinite(newsBias) || Math.abs(newsBias) > 1) throw new Error('Ungültige Simulationsparameter.');
  const closes = bars.map(b => b.close), returns = closes.slice(1).map((c, i) => Math.log(c / closes[i])).slice(-120);
  const average = mean(returns), sigma = sd(returns), residuals = returns.map(v => v - average), rng = seeded(seed);
  const drift = chart.score / 100 * sigma * .1; // assumption, not a fitted forecasting model
  const all = Array.from({ length: days + 1 }, () => []);
  for (let p = 0; p < paths; p++) {
    let price = chart.price, block = 0;
    all[0].push(price);
    for (let d = 1; d <= days; d++) {
      if ((d - 1) % 5 === 0) block = Math.floor(rng() * residuals.length);
      const sampled = residuals[(block + (d - 1) % 5) % residuals.length];
      const impulse = newsBias * sigma * .1 * Math.exp(-(d - 1) / 5);
      price *= Math.exp(sampled + drift + impulse);
      all[d].push(price);
    }
  }
  return { days, paths, seed, dailyVolatility: sigma, drift, newsBias, newsImpulseRule: 'KI-Richtung × Vertrauen × 0,1 Tagesvolatilität; Abklingen über 5 Handelstage. Annahme, nicht kalibriert.', calibrated: false, model: 'Block-Bootstrap: 5er Blöcke aus bis zu 120 zentrierten Tagesrenditen; begrenzter technischer Drift.', bands: all.map((a, day) => ({ day, q10: round(quantile(a, .1)), q25: round(quantile(a, .25)), q50: round(quantile(a, .5)), q75: round(quantile(a, .75)), q90: round(quantile(a, .9)) })), note: 'Quantile der Modellpfade; keine validierten Eintrittswahrscheinlichkeiten. Keine Intraday-Gaps, Gebühren, Slippage oder Wechselkurse simuliert.' };
}

export function tradeSetups(chart, { ageDays, unresolvedJump }, narrative, simulation) {
  const p = chart.price, a = chart.atr, blocked = ageDays > 7 || unresolvedJump || !a || simulation.dailyVolatility < 1e-8;
  const entryLong = Math.max(p, chart.resistance) + .25 * a;
  const entryShort = Math.min(p, chart.support) - .25 * a;
  const stopLong = Math.max(.01 * entryLong, Math.min(chart.support - .25 * a, entryLong - 1.5 * a));
  const stopShort = Math.max(chart.resistance + .25 * a, entryShort + 1.5 * a);
  const conflict = narrative.mode === 'ai' && ((chart.score > 0 && narrative.bias === 'bearish') || (chart.score < 0 && narrative.bias === 'bullish'));
  return ['long', 'short'].map(direction => {
    const entry = direction === 'long' ? entryLong : entryShort, stop = direction === 'long' ? stopLong : stopShort, risk = Math.abs(entry - stop);
    const valid = entry > 0 && risk > 0 && risk / entry <= .15;
    const aligned = direction === 'long' ? chart.score >= 40 && chart.rsi < 75 : chart.score <= -40 && chart.rsi > 25;
    return { direction, status: blocked || !valid ? 'gesperrt' : conflict ? 'widersprüchlich – abwarten' : aligned ? 'bedingter Kandidat' : 'abwarten', entry: round(entry), stop: round(stop), target1: round(entry + (direction === 'long' ? 1 : -1) * 2 * risk), target2: round(entry + (direction === 'long' ? 1 : -1) * 3 * risk), riskPercent: round(risk / entry * 100), rewardRisk: [2, 3], trigger: direction === 'long' ? 'Tages-Schlusskurs über Einstieg + Volumen ≥ 1,5×; am Folgetag Bestätigung prüfen.' : 'Tages-Schlusskurs unter Einstieg + Volumen ≥ 1,5×; am Folgetag Bestätigung prüfen.', invalidation: direction === 'long' ? 'Unterstützung bricht oder News-These wird widerlegt.' : 'Widerstand wird zurückerobert oder News-These wird widerlegt.', exit: 'Teilgewinn an Ziel 1 prüfen; Rest an Ziel 2 oder nachlaufendem Stop; Zeitstopp am Horizontende überprüfen.', reason: blocked ? 'Veraltete Daten, ungeklärter Kurssprung oder fehlende Schwankung.' : !valid ? 'Stoprisiko > 15 % oder nicht positive Kursmarke; engeren Zeithorizont/Struktur prüfen.' : conflict ? 'News- und Chartthese widersprechen sich.' : aligned ? 'Trend/Momentum unterstützen die Richtung; Trigger muss noch bestätigt werden.' : 'Chartbestätigung fehlt oder RSI überdehnt.', confirmed: false, volumeAvailable: chart.volumeRatio !== null, pricingBasis: 'Kurs des Basiswerts; keine Preise von KO-Produkten.', trailingStop: direction === 'long' ? 'Höchster Schlusskurs seit Einstieg minus 2 × ATR14; nur nach oben nachziehen.' : 'Tiefster Schlusskurs seit Einstieg plus 2 × ATR14; nur nach unten nachziehen.' };
  });
}

export function buildSignalAnalysis({ symbol, currency, rawBars, news = [], narrative = null, days = 20, now = new Date(), provider = 'CSV', useNewsImpulse = false }) {
  const quality = normalizeBars(rawBars, now), chart = technicals(quality.bars, quality.volumeValid);
  const ai = narrative || { mode: 'rules', summary: 'Chartregeln berechnet. KI-Nachrichtenauswertung ist nicht aktiv.', bias: 'neutral', confidence: 0, evidence: [], risks: [], watchpoints: [] };
  const newsBias = useNewsImpulse && ai.mode === 'ai' ? (ai.bias === 'bullish' ? 1 : ai.bias === 'bearish' ? -1 : 0) * ai.confidence / 100 : 0;
  const seed = hashSeed(`${symbol}|${last(quality.bars).date}|${days}|${newsBias}`), simulation = simulate(quality.bars, chart, { days, seed, newsBias });
  const setups = tradeSetups(chart, quality, ai, simulation);
  const end = last(simulation.bands), scenarios = [
    { name: 'Schwächerer Modellverlauf (P25)', endpoint: end.q25, condition: 'Unterstützung bricht, negative Nachrichten werden bestätigt oder Momentum schwächt sich ab.' },
    { name: 'Mittlerer Modellverlauf (P50)', endpoint: end.q50, condition: 'Bestehendes Chartregime bleibt bestehen, keine neue wesentliche Überraschung.' },
    { name: 'Stärkerer Modellverlauf (P75)', endpoint: end.q75, condition: 'Widerstand wird mit Volumen überwunden und die News-These bestätigt.' }
  ];
  return { version: SIGNAL_VERSION, symbol, currency, created_at: now.toISOString(), price_date: last(quality.bars).date, timeframe: 'Abgeschlossene Tageskerzen (EOD)', provider, quality: { ageDays: quality.ageDays, bars: quality.bars.length, notes: quality.notes, blocked: setups.every(s => s.status === 'gesperrt') }, chart, simulation, scenarios, setups, narrative: ai, sources: news, history: quality.bars.slice(-60), limitations: ['Modellsimulation und bedingte Handelsideen, keine gesicherte Kursprognose.', 'Keine Kalibrierung, Out-of-sample-Güte oder Erfolgsquote vorhanden.', 'Stops garantieren keinen Ausführungskurs; Gaps und KO-Schwellen separat prüfen.', 'Währung/Notierung wird vom Nutzer bestätigt; keine automatische Umrechnung.'] };
}

export function parseOhlcvCsv(text) {
  const lines = String(text).replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (lines.length > 2001) throw new Error('CSV darf höchstens 2000 Datenzeilen enthalten.');
  const separator = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].toLowerCase().split(separator).map(v => v.trim().replace(/^"|"$/g, '').replace(/\s+/g, '_'));
  if (!['date', 'open', 'high', 'low', 'close'].every(k => headers.includes(k))) throw new Error('CSV-Kopf: date,open,high,low,close,volume[,adjusted_close].');
  return lines.slice(1).filter(v => v.trim()).map(line => {
    const columns = line.split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
    if (columns.length !== headers.length) throw new Error('CSV-Zeile hat eine abweichende Spaltenzahl.');
    return Object.fromEntries(headers.map((k, i) => [k, k === 'date' ? columns[i] : columns[i] === '' ? null : Number(separator === ';' ? columns[i].replace(',', '.') : columns[i])]));
  });
}
