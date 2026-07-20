(() => {
  'use strict';

  const VERSION = '25.0';
  const LOCAL_PREFIX = 'investition-decision-v25-';
  const DEFAULT_PREFS = {
    portfolio_value: 100000,
    cash_value: 0,
    immediate_min_score: 80,
    daily_digest_enabled: true,
    daily_digest_time: '19:00',
    weekly_digest_enabled: true,
    weekly_digest_day: 0,
    weekly_digest_time: '18:00',
    quiet_start: '22:00',
    quiet_end: '07:00',
    cooldown_minutes: 180,
    ko_yellow_pct: 15,
    ko_orange_pct: 10,
    ko_red_pct: 5,
    max_single_weight_pct: 20,
    max_sector_weight_pct: 35,
    max_total_risk_pct: 8
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const page = $('#decisionPage');
  const content = $('#decisionContent');
  const statusEl = $('#decisionStatus');
  const refreshBtn = $('#decisionRefreshBtn');
  if (!page || !content) return;

  const state = {
    activeTab: 'today',
    selectedTradeId: null,
    editingEventId: null,
    session: null,
    sb: null,
    cloudReady: false,
    schemaReady: false,
    loading: false,
    errors: [],
    theses: loadLocal('theses', []),
    scenarios: loadLocal('scenarios', []),
    events: loadLocal('events', []),
    preferences: {...DEFAULT_PREFS, ...loadLocal('preferences', {})},
    signalStates: loadLocal('signal-states', []),
    outcomes: loadLocal('outcomes', []),
    healthRows: loadLocal('health', []),
    alertEvents: [],
    news: loadNewsLocal(),
    notificationSettings: null,
    lastLoadedAt: null
  };

  function dashboard() { return window.InvestitionDashboard || null; }
  function trades() { return dashboard()?.getTrades?.() || []; }
  function selectedTrade() {
    const list = trades();
    if (!state.selectedTradeId) state.selectedTradeId = dashboard()?.getSelectedTrade?.()?.id || list[0]?.id || null;
    return list.find(item => item.id === state.selectedTradeId) || list[0] || null;
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function uuid() {
    try { return crypto.randomUUID(); } catch { return `v25-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  }
  function num(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function bool(value, fallback = false) {
    if (value === null || value === undefined || value === '') return fallback;
    return value === true || value === 'true' || value === 1 || value === '1' || value === 'on';
  }
  function clamp(value, min = 0, max = 100) { return Math.min(max, Math.max(min, num(value, 0))); }
  function formatNumber(value, digits = 2) {
    const parsed = num(value);
    if (parsed === null) return '—';
    return new Intl.NumberFormat('de-DE', {maximumFractionDigits: digits}).format(parsed);
  }
  function formatMoney(value, currency = 'EUR') {
    const parsed = num(value);
    if (parsed === null) return '—';
    try { return new Intl.NumberFormat('de-DE', {style:'currency', currency, maximumFractionDigits:2}).format(parsed); }
    catch { return `${formatNumber(parsed)} ${currency}`; }
  }
  function formatPct(value, digits = 1) {
    const parsed = num(value);
    return parsed === null ? '—' : `${formatNumber(parsed, digits)} %`;
  }
  function formatDate(value, withTime = false) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('de-DE', withTime
      ? {dateStyle:'short', timeStyle:'short', timeZone:'Europe/Berlin'}
      : {dateStyle:'medium', timeZone:'Europe/Berlin'}).format(date);
  }
  function ageHours(value) {
    if (!value) return null;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? (Date.now() - time) / 3600000 : null;
  }
  function daysUntil(value) {
    if (!value) return null;
    const target = new Date(value).getTime();
    if (!Number.isFinite(target)) return null;
    return Math.ceil((target - Date.now()) / 86400000);
  }
  function localKey(name) { return LOCAL_PREFIX + name; }
  function loadLocal(name, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(localKey(name)) || 'null');
      return parsed === null ? fallback : parsed;
    } catch { return fallback; }
  }
  function saveLocal(name, value) {
    try { localStorage.setItem(localKey(name), JSON.stringify(value)); } catch {}
  }
  function loadNewsLocal() {
    try {
      const parsed = JSON.parse(localStorage.getItem('investition-news-feed-v1') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  function setStatus(text, type = '') {
    statusEl.textContent = text;
    statusEl.className = `decision-status ${type}`;
  }
  function errorText(error) {
    if (!error) return 'Unbekannter Fehler';
    return error.message || error.error_description || String(error);
  }
  function serializeForm(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    $$('input[type="checkbox"]', form).forEach(input => { data[input.name] = input.checked; });
    return data;
  }
  function tradeById(id) { return trades().find(item => item.id === id) || null; }
  function thesisFor(tradeId) {
    return state.theses.find(item => item.trade_id === tradeId) || {
      trade_id: tradeId,
      core_thesis: '', catalysts: '', risks: '', invalidation: '', thesis_status: 'neutral', confidence: 50,
      sector: '', region: '', currency_exposure: '', decision_status: 'Beobachten', updated_at: null
    };
  }
  function scenariosFor(tradeId) {
    const current = state.scenarios.filter(item => item.trade_id === tradeId);
    const defaults = [
      {scenario:'bull', probability:25, revenue_growth:null, margin:null, valuation_multiple:null, target_price:null, notes:''},
      {scenario:'base', probability:50, revenue_growth:null, margin:null, valuation_multiple:null, target_price:null, notes:''},
      {scenario:'bear', probability:25, revenue_growth:null, margin:null, valuation_multiple:null, target_price:null, notes:''}
    ];
    return defaults.map(fallback => ({...fallback, ...(current.find(item => item.scenario === fallback.scenario) || {}), trade_id: tradeId}));
  }
  function signalStateFor(key) { return state.signalStates.find(item => item.signal_key === key) || null; }
  function outcomeFor(eventId) { return state.outcomes.find(item => String(item.alert_event_id) === String(eventId)) || null; }
  function currentPrice(trade) { return num(trade?.currentPrice); }
  function positionValue(trade) {
    const direct = num(trade?.positionValue);
    if (direct !== null && direct > 0) return direct;
    const quantity = num(trade?.quantity);
    const price = currentPrice(trade);
    return quantity !== null && price !== null ? Math.abs(quantity * price) : 0;
  }
  function riskToStop(trade) {
    const direct = num(trade?.riskBudget);
    if (direct !== null && direct > 0) return direct;
    const quantity = num(trade?.quantity);
    const price = currentPrice(trade);
    const stop = num(trade?.stop);
    return quantity !== null && price !== null && stop !== null ? Math.abs(quantity * (price - stop)) : 0;
  }
  function normalizeSymbolTokens(value) {
    const input = String(value || '').toUpperCase().replace(/\s+/g, '');
    if (!input) return [];
    const values = new Set([input]);
    if (input.includes(':')) values.add(input.split(':').pop());
    if (input.includes('.')) values.add(input.split('.')[0]);
    return [...values];
  }
  function newsMatchesTrade(item, trade) {
    const wanted = new Set([...normalizeSymbolTokens(trade.symbol), ...normalizeSymbolTokens(trade.marketSymbol)]);
    return (item.symbols || []).some(symbol => normalizeSymbolTokens(symbol).some(token => wanted.has(token)));
  }
  function score({relevance = 0, confidence = 0, impact = 0, urgency = 0}) {
    return Math.round(clamp(relevance) * .30 + clamp(impact) * .25 + clamp(confidence) * .25 + clamp(urgency) * .20);
  }
  function signal(input) {
    const dimensions = {
      relevance: clamp(input.relevance), confidence: clamp(input.confidence), impact: clamp(input.impact), urgency: clamp(input.urgency)
    };
    const total = input.score ?? score(dimensions);
    const severity = input.severity || (total >= 80 ? 'critical' : total >= 60 ? 'review' : total >= 40 ? 'watch' : 'info');
    return {...input, ...dimensions, score: total, severity};
  }
  function koDistance(trade) {
    const stored = num(trade.koDistance);
    if (stored !== null) return stored;
    const price = currentPrice(trade), barrier = num(trade.koBarrier);
    return price && barrier !== null ? Math.abs((price - barrier) / price) * 100 : null;
  }
  function computeExposures() {
    const positions = trades().map(trade => ({trade, value:positionValue(trade), thesis:thesisFor(trade.id)})).filter(item => item.value > 0);
    const invested = positions.reduce((sum, item) => sum + item.value, 0);
    const group = key => {
      const map = new Map();
      positions.forEach(item => {
        const label = item.thesis[key] || (key === 'currency_exposure' ? item.trade.currency : '') || 'Nicht zugeordnet';
        map.set(label, (map.get(label) || 0) + item.value);
      });
      return [...map.entries()].map(([label, value]) => ({label, value, pct: invested > 0 ? value / invested * 100 : 0})).sort((a,b) => b.value - a.value);
    };
    return {positions, invested, sectors:group('sector'), regions:group('region'), currencies:group('currency_exposure')};
  }
  function computeHealth() {
    const list = trades();
    const latestQuote = list.map(item => item.currentPriceAt || item.quoteAt).filter(Boolean).sort().pop() || null;
    const latestCheck = list.map(item => item.lastCheckAt).filter(Boolean).sort().pop() || null;
    const latestNews = state.news.map(item => item.published_at || item.created_at).filter(Boolean).sort().pop() || null;
    const alertErrors = list.filter(item => item.lastCheckError).length;
    const schemaMissing = !state.schemaReady;
    const health = [
      {name:'Browser / Netzwerk', status:navigator.onLine ? 'good' : 'bad', value:navigator.onLine ? 'Online' : 'Offline', detail:'Direkter Verbindungsstatus dieses Geräts'},
      {name:'Cloud-Anmeldung', status:state.session ? 'good' : 'warn', value:state.session ? 'Verbunden' : 'Nicht angemeldet', detail:state.session?.user?.email || 'Lokaler Betrieb bleibt möglich'},
      {name:'Entscheidungsschema', status:schemaMissing ? 'warn' : 'good', value:schemaMissing ? 'Lokaler Modus' : 'Cloud aktiv', detail:schemaMissing ? 'version25-schema.sql noch nicht vollständig erreichbar' : 'Thesen, Szenarien und Ereignisse werden synchronisiert'},
      {name:'Kursdaten', status:!latestQuote ? 'warn' : ageHours(latestQuote) > 24 ? 'bad' : ageHours(latestQuote) > 6 ? 'warn' : 'good', value:latestQuote ? formatDate(latestQuote, true) : 'Keine Daten', detail:latestQuote ? `Alter ${formatNumber(ageHours(latestQuote),1)} Stunden` : 'Alarmprüfung oder Referenzkurs fehlt'},
      {name:'Alarmprüfung', status:alertErrors ? 'bad' : !latestCheck ? 'warn' : ageHours(latestCheck) > 4 ? 'warn' : 'good', value:latestCheck ? formatDate(latestCheck, true) : 'Noch nicht gelaufen', detail:alertErrors ? `${alertErrors} Pläne mit Fehler` : 'Keine gemeldeten Planfehler'},
      {name:'News Feed', status:!latestNews ? 'warn' : ageHours(latestNews) > 48 ? 'warn' : 'good', value:latestNews ? formatDate(latestNews, true) : 'Leer', detail:`${state.news.length} lokal geladene Meldungen`},
      {name:'Telegram', status:state.notificationSettings?.telegram_chat_id ? 'good' : 'warn', value:state.notificationSettings?.telegram_chat_id ? 'Verbunden' : 'Nicht verbunden', detail:state.notificationSettings?.telegram_enabled === false ? 'Benachrichtigungen deaktiviert' : 'Verbindung in Cloud-Einstellungen prüfen'},
      {name:'Service Worker', status:'serviceWorker' in navigator ? (navigator.serviceWorker.controller ? 'good' : 'warn') : 'warn', value:navigator.serviceWorker?.controller ? 'Aktiv' : 'Nicht aktiv', detail:`Dashboard ${VERSION}`},
      {name:'Datenkonsistenz', status:list.some(item => !item.symbol || !item.marketSymbol) ? 'warn' : 'good', value:list.some(item => !item.symbol || !item.marketSymbol) ? 'Prüfung nötig' : 'Symbole vollständig', detail:`${list.length} Trade-Pläne geprüft`}
    ];
    return health;
  }

  function generateSignals() {
    const signals = [];
    const prefs = state.preferences;
    const list = trades();

    list.forEach(trade => {
      const symbol = trade.symbol || trade.marketSymbol || '';
      const price = currentPrice(trade);
      const isShort = String(trade.direction || '').toLowerCase().includes('short');
      const thesis = thesisFor(trade.id);

      if (trade.lastCheckError) {
        signals.push(signal({key:`system:${trade.id}:alarm-error`, source_type:'system', trade_id:trade.id, symbol, title:`Alarmdaten ${trade.name} fehlerhaft`, summary:trade.lastCheckError, action:'Kursquelle, Symbol und EODHD-Limit prüfen.', relevance:100, confidence:100, impact:85, urgency:95, severity:'critical'}));
      }
      const quoteAge = ageHours(trade.currentPriceAt || trade.quoteAt);
      if (quoteAge !== null && quoteAge > 24) {
        signals.push(signal({key:`system:${trade.id}:stale-quote`, source_type:'system', trade_id:trade.id, symbol, title:`Kurs für ${trade.name} ist veraltet`, summary:`Letzter Kursstand ist ${formatNumber(quoteAge,1)} Stunden alt.`, action:'Vor Entscheidungen einen aktuellen Kurs abrufen.', relevance:95, confidence:100, impact:70, urgency:80}));
      }

      const stop = num(trade.stop);
      if (price !== null && stop !== null && price > 0) {
        const breached = isShort ? price >= stop : price <= stop;
        const distance = Math.abs((price - stop) / price) * 100;
        if (breached) signals.push(signal({key:`risk:${trade.id}:stop-breached`, source_type:'risk', trade_id:trade.id, symbol, title:`Stop / Invalidierung bei ${trade.name} erreicht`, summary:`Kurs ${formatNumber(price)} gegenüber Stop ${formatNumber(stop)} ${trade.currency || ''}.`, action:'These und Exit unverzüglich prüfen.', relevance:100, confidence:95, impact:100, urgency:100, severity:'critical'}));
        else if (distance <= 3) signals.push(signal({key:`risk:${trade.id}:stop-near`, source_type:'risk', trade_id:trade.id, symbol, title:`${trade.name} nähert sich dem Stop`, summary:`Abstand zum Stop nur ${formatPct(distance)}.`, action:'Positionsrisiko und Ereigniskalender prüfen.', relevance:100, confidence:90, impact:90, urgency:90}));
      }

      const distance = koDistance(trade);
      if (distance !== null && (trade.type === 'Knock-out' || trade.alertKo)) {
        let severity = null, urgency = 0, label = '';
        if (distance <= num(prefs.ko_red_pct, 5)) { severity = 'critical'; urgency = 100; label = 'rot'; }
        else if (distance <= num(prefs.ko_orange_pct, 10)) { severity = 'review'; urgency = 90; label = 'orange'; }
        else if (distance <= num(prefs.ko_yellow_pct, 15)) { severity = 'watch'; urgency = 70; label = 'gelb'; }
        if (severity) signals.push(signal({key:`risk:${trade.id}:ko-${label}`, source_type:'ko', trade_id:trade.id, symbol, title:`KO-Abstand ${trade.name}: ${formatPct(distance)}`, summary:`Risikostufe ${label}; KO-Barriere ${formatNumber(trade.koBarrier)} ${trade.currency || ''}.`, action:'Hebel, Gap-Risiko und maximalen Verlust prüfen.', relevance:100, confidence:90, impact:100, urgency, severity}));
      }

      const low = num(trade.entryLow), high = num(trade.entryHigh), limit = num(trade.limitPrice);
      if (price !== null && (low !== null || high !== null)) {
        const lower = Math.min(low ?? high, high ?? low), upper = Math.max(low ?? high, high ?? low);
        const inside = price >= lower && price <= upper;
        const proximity = price < lower ? (lower-price)/price*100 : price > upper ? (price-upper)/price*100 : 0;
        if (inside) signals.push(signal({key:`opportunity:${trade.id}:entry`, source_type:'price', trade_id:trade.id, symbol, title:`${trade.name} liegt in der Einstiegszone`, summary:`Kurs ${formatNumber(price)}; Zone ${formatNumber(lower)}–${formatNumber(upper)} ${trade.currency || ''}.`, action:'These, Bewertung und Portfoliokonzentration vor Order prüfen.', relevance:100, confidence:90, impact:70, urgency:80}));
        else if (proximity <= 2) signals.push(signal({key:`opportunity:${trade.id}:entry-near`, source_type:'price', trade_id:trade.id, symbol, title:`${trade.name} nähert sich der Einstiegszone`, summary:`Abstand rund ${formatPct(proximity)}.`, action:'Einstiegsvoraussetzungen und Positionsgröße vorbereiten.', relevance:90, confidence:85, impact:65, urgency:55}));
      } else if (price !== null && limit !== null) {
        const proximity = Math.abs(price-limit)/price*100;
        if (proximity <= 2) signals.push(signal({key:`opportunity:${trade.id}:limit-near`, source_type:'price', trade_id:trade.id, symbol, title:`${trade.name} nähert sich dem Limit`, summary:`Kurs ${formatNumber(price)}, Limit ${formatNumber(limit)} ${trade.currency || ''}.`, action:'Limit und Risikobudget bestätigen.', relevance:90, confidence:85, impact:65, urgency:60}));
      }

      const reviewDays = daysUntil(trade.reviewDate);
      if (reviewDays !== null && reviewDays <= 0) signals.push(signal({key:`review:${trade.id}:overdue`, source_type:'review', trade_id:trade.id, symbol, title:`Analyse ${trade.name} ist fällig`, summary:`Überprüfungstermin ${formatDate(trade.reviewDate)}.`, action:'These, Szenarien, Kursziele und Stop aktualisieren.', relevance:95, confidence:100, impact:60, urgency:75}));
      else if (reviewDays !== null && reviewDays <= 7) signals.push(signal({key:`review:${trade.id}:due`, source_type:'review', trade_id:trade.id, symbol, title:`Analyse ${trade.name} in ${reviewDays} Tagen prüfen`, summary:`Nächster Überprüfungstermin ${formatDate(trade.reviewDate)}.`, action:'Offene Prüfpunkte sammeln.', relevance:85, confidence:100, impact:45, urgency:45}));

      if (thesis.thesis_status === 'invalidated') signals.push(signal({key:`thesis:${trade.id}:invalidated`, source_type:'thesis', trade_id:trade.id, symbol, title:`Investmentthese ${trade.name} als invalidiert markiert`, summary:thesis.invalidation || 'Invalidierungsbedingung wurde markiert.', action:'Position und Trade-Status unverzüglich überprüfen.', relevance:100, confidence:90, impact:100, urgency:100, severity:'critical'}));
      else if (thesis.thesis_status === 'weakened') signals.push(signal({key:`thesis:${trade.id}:weakened`, source_type:'thesis', trade_id:trade.id, symbol, title:`Investmentthese ${trade.name} geschwächt`, summary:thesis.risks || 'Die These wurde als geschwächt markiert.', action:'Neue Evidenz und Szenariowahrscheinlichkeiten prüfen.', relevance:100, confidence:80, impact:80, urgency:70}));
    });

    state.events.forEach(event => {
      const days = daysUntil(event.event_at);
      if (days === null || days < -1 || event.status === 'abgeschlossen') return;
      const trade = tradeById(event.trade_id);
      const symbol = trade?.symbol || '';
      const importance = String(event.importance || 'mittel').toLowerCase();
      const relevance = trade ? 95 : 70;
      const impact = importance === 'hoch' ? 90 : importance === 'niedrig' ? 45 : 70;
      const urgency = days <= 1 ? 95 : days <= 3 ? 80 : days <= 7 ? 60 : 35;
      if (days <= 30) signals.push(signal({key:`event:${event.id}`, source_type:'event', trade_id:event.trade_id || null, symbol, title:`${event.title}${days >= 0 ? ` in ${days} Tagen` : ' war gestern'}`, summary:`${event.event_type || 'Ereignis'} · erwartete Volatilität ${event.expected_volatility || 'nicht bewertet'}.`, action:event.prep_notes || 'Erwartungen, Risikobudget und Szenarien vorbereiten.', relevance, confidence:95, impact, urgency}));
    });

    const cutoff = Date.now() - 72 * 3600000;
    state.news.filter(item => new Date(item.published_at || item.created_at).getTime() >= cutoff).forEach(item => {
      const impacted = list.filter(trade => newsMatchesTrade(item, trade));
      impacted.forEach(trade => {
        const impactLabel = String(item.impact || 'mittel').toLowerCase();
        const impact = impactLabel === 'hoch' ? 85 : impactLabel === 'niedrig' ? 35 : 60;
        signals.push(signal({key:`news:${item.id || item.external_id}:${trade.id}`, source_type:'news', source_id:item.id, trade_id:trade.id, symbol:trade.symbol, title:item.title, summary:item.summary || item.content || `Neue Meldung zu ${trade.name}.`, action:'Auswirkung auf These, Bewertung und Kursreaktion einordnen.', relevance:95, confidence:60, impact, urgency:impactLabel === 'hoch' ? 75 : 45}));
      });
    });

    const exposure = computeExposures();
    const topPosition = exposure.positions.slice().sort((a,b) => b.value-a.value)[0];
    if (topPosition && exposure.invested > 0) {
      const weight = topPosition.value / exposure.invested * 100;
      if (weight > num(prefs.max_single_weight_pct, 20)) signals.push(signal({key:`portfolio:single:${topPosition.trade.id}`, source_type:'portfolio', trade_id:topPosition.trade.id, symbol:topPosition.trade.symbol, title:`Einzeltitelkonzentration ${topPosition.trade.name}: ${formatPct(weight)}`, summary:`Grenzwert ${formatPct(prefs.max_single_weight_pct)} überschritten.`, action:'Neue Käufe oder Teilreduktion im Portfoliokontext prüfen.', relevance:100, confidence:100, impact:80, urgency:55}));
    }
    const topSector = exposure.sectors[0];
    if (topSector && topSector.pct > num(prefs.max_sector_weight_pct, 35)) signals.push(signal({key:`portfolio:sector:${topSector.label}`, source_type:'portfolio', title:`Sektorkonzentration ${topSector.label}: ${formatPct(topSector.pct)}`, summary:`Grenzwert ${formatPct(prefs.max_sector_weight_pct)} überschritten.`, action:'Zusätzliche Positionen im selben Sektor restriktiver bewerten.', relevance:95, confidence:100, impact:75, urgency:45}));

    computeHealth().filter(item => item.status === 'bad').forEach(item => signals.push(signal({key:`health:${item.name}`, source_type:'system', title:`Systemwarnung: ${item.name}`, summary:`${item.value} · ${item.detail}`, action:'Datenqualität vor einer Entscheidung wiederherstellen.', relevance:100, confidence:100, impact:85, urgency:90, severity:'critical'})));

    const now = Date.now();
    return signals.filter(item => {
      const saved = signalStateFor(item.key);
      if (!saved) return true;
      if (saved.status === 'resolved') return false;
      if (saved.snoozed_until && new Date(saved.snoozed_until).getTime() > now) return false;
      return true;
    }).sort((a,b) => b.score - a.score || a.title.localeCompare(b.title));
  }

  async function safeSelect(table, queryFactory, fallback = []) {
    try {
      const query = queryFactory(state.sb.from(table));
      const {data, error} = await query;
      if (error) {
        state.errors.push(`${table}: ${error.message}`);
        return fallback;
      }
      return data ?? fallback;
    } catch (error) {
      state.errors.push(`${table}: ${errorText(error)}`);
      return fallback;
    }
  }

  async function loadCloud() {
    state.sb = dashboard()?.getSupabase?.() || state.sb;
    state.session = dashboard()?.getSession?.() || null;
    state.news = window.InvestitionNews?.getItems?.() || loadNewsLocal();
    state.errors = [];
    state.cloudReady = Boolean(state.sb && state.session);
    if (!state.cloudReady) {
      state.schemaReady = false;
      state.lastLoadedAt = new Date().toISOString();
      setStatus('Lokaler Modus: Für geräteübergreifende Thesen, Ereignisse und Präferenzen in der Cloud anmelden.', 'warn');
      return;
    }

    const uid = state.session.user.id;
    const [theses, scenarios, events, preferences, signalStates, outcomes, alertEvents, news, notificationSettings, healthRows] = await Promise.all([
      safeSelect('investment_theses', q => q.select('*').eq('user_id', uid), state.theses),
      safeSelect('valuation_scenarios', q => q.select('*').eq('user_id', uid), state.scenarios),
      safeSelect('market_events', q => q.select('*').eq('user_id', uid).order('event_at', {ascending:true}), state.events),
      safeSelect('notification_policies', q => q.select('*').eq('user_id', uid).maybeSingle(), null),
      safeSelect('decision_signal_state', q => q.select('*').eq('user_id', uid), state.signalStates),
      safeSelect('signal_outcomes', q => q.select('*').eq('user_id', uid), state.outcomes),
      safeSelect('alert_events', q => q.select('*').eq('user_id', uid).order('created_at', {ascending:false}).limit(200), []),
      safeSelect('market_news', q => q.select('*').eq('is_published', true).order('published_at', {ascending:false}).limit(300), state.news),
      safeSelect('notification_settings', q => q.select('*').eq('user_id', uid).maybeSingle(), null),
      safeSelect('system_health', q => q.select('*').eq('user_id', uid).order('checked_at', {ascending:false}).limit(100), state.healthRows)
    ]);

    if (Array.isArray(theses)) state.theses = theses;
    if (Array.isArray(scenarios)) state.scenarios = scenarios;
    if (Array.isArray(events)) state.events = events;
    if (preferences && !Array.isArray(preferences)) state.preferences = {...DEFAULT_PREFS, ...preferences};
    if (Array.isArray(signalStates)) state.signalStates = signalStates;
    if (Array.isArray(outcomes)) state.outcomes = outcomes;
    if (Array.isArray(alertEvents)) state.alertEvents = alertEvents;
    if (Array.isArray(news)) state.news = news;
    if (notificationSettings && !Array.isArray(notificationSettings)) state.notificationSettings = notificationSettings;
    if (Array.isArray(healthRows)) state.healthRows = healthRows;

    state.schemaReady = !state.errors.some(message => /investment_theses|valuation_scenarios|market_events|notification_policies/i.test(message));
    state.lastLoadedAt = new Date().toISOString();
    saveAllLocal();
    setStatus(state.errors.length
      ? `Cloud teilweise geladen. ${state.errors.length} Tabellenhinweis(e); fehlende Version-25-Tabellen arbeiten lokal.`
      : `Cloud-Entscheidungsdaten geladen · ${formatDate(state.lastLoadedAt, true)}.`, state.errors.length ? 'warn' : 'good');
  }

  function saveAllLocal() {
    saveLocal('theses', state.theses);
    saveLocal('scenarios', state.scenarios);
    saveLocal('events', state.events);
    saveLocal('preferences', state.preferences);
    saveLocal('signal-states', state.signalStates);
    saveLocal('outcomes', state.outcomes);
    saveLocal('health', state.healthRows);
  }

  async function upsertCloud(table, row, onConflict) {
    if (!state.sb || !state.session) return {local:true};
    const payload = {...row, user_id:state.session.user.id};
    const {error} = await state.sb.from(table).upsert(payload, onConflict ? {onConflict} : undefined);
    if (error) {
      state.errors.push(`${table}: ${error.message}`);
      setStatus(`Lokal gespeichert; Cloud-Speicherung fehlgeschlagen: ${error.message}`, 'warn');
      return {error};
    }
    return {ok:true};
  }
  async function deleteCloud(table, id) {
    if (!state.sb || !state.session) return;
    const {error} = await state.sb.from(table).delete().eq('id', id).eq('user_id', state.session.user.id);
    if (error) setStatus(`Lokal gelöscht; Cloud-Löschung fehlgeschlagen: ${error.message}`, 'warn');
  }

  function tradeOptions(selected = '') {
    return trades().map(trade => `<option value="${escapeHtml(trade.id)}" ${trade.id === selected ? 'selected' : ''}>${escapeHtml(trade.name)} · ${escapeHtml(trade.symbol || trade.marketSymbol || '')}</option>`).join('');
  }
  function sectionHeader(title, subtitle, right = '') {
    return `<div class="decision-panel-head"><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(subtitle)}</p></div>${right}</div>`;
  }
  function renderExposure(title, items) {
    return `<div class="card decision-panel">${sectionHeader(title, 'Anteil am investierten Positionswert')}<div class="exposure-bars">${items.length ? items.map(item => `<div class="exposure-row"><div class="exposure-label">${escapeHtml(item.label)}</div><div class="exposure-track"><div class="exposure-fill" style="width:${Math.min(100,item.pct)}%"></div></div><div class="exposure-value">${formatPct(item.pct)}</div></div>`).join('') : '<div class="decision-empty">Keine Positionswerte vorhanden.</div>'}</div></div>`;
  }

  function renderToday() {
    const signals = generateSignals();
    const groups = [
      {key:'critical', title:'Sofort prüfen', subtitle:'Stop, KO, These oder Datenqualität', filter:item => item.severity === 'critical'},
      {key:'review', title:'Heute prüfen', subtitle:'Hohe Relevanz oder zeitnahe Entscheidung', filter:item => item.severity === 'review'},
      {key:'watch', title:'Beobachten', subtitle:'Annäherung, Vorbereitung und Bestätigung', filter:item => item.severity === 'watch'},
      {key:'info', title:'Wochenbericht', subtitle:'Niedrigere Dringlichkeit', filter:item => item.severity === 'info'}
    ];
    const exposure = computeExposures();
    const activeRisk = trades().reduce((sum, trade) => sum + riskToStop(trade), 0);
    const kpis = [
      {label:'Sofort prüfen', value:signals.filter(groups[0].filter).length, sub:'kritische Zustände'},
      {label:'Heute prüfen', value:signals.filter(groups[1].filter).length, sub:'priorisierte Aufgaben'},
      {label:'Kapital im Risiko', value:formatMoney(activeRisk), sub:'bis Stop / Risikobudget'},
      {label:'Investiert', value:formatMoney(exposure.invested), sub:`${exposure.positions.length} Positionen`}
    ];
    content.innerHTML = `<div class="decision-grid">
      <div class="card decision-panel decision-span-12"><div class="decision-kpis">${kpis.map(item => `<div class="decision-kpi"><div class="label">${escapeHtml(item.label)}</div><div class="value">${escapeHtml(item.value)}</div><div class="sub">${escapeHtml(item.sub)}</div></div>`).join('')}</div></div>
      <div class="card decision-panel decision-span-8">${sectionHeader('Priorisierte Entscheidungsliste', `${signals.length} aktive Signale nach Relevanz, Auswirkung, Vertrauen und Dringlichkeit`)}
        ${groups.map(group => {
          const items = signals.filter(group.filter);
          return `<div class="signal-group"><div class="signal-group-head"><h3>${group.title}</h3><span class="chip ${group.key === 'critical' ? 'bad' : group.key === 'review' ? 'warn' : 'neutral'}">${items.length}</span></div><div class="signal-list-v25">${items.length ? items.map(renderSignalCard).join('') : `<div class="decision-empty">Keine Einträge in dieser Stufe.</div>`}</div></div>`;
        }).join('')}
      </div>
      <div class="decision-span-4"><div class="card decision-panel">${sectionHeader('Entscheidungskette', 'Jede Meldung wird in Handlungsschritte übersetzt')}<div class="notification-preview">Ereignis
→ betroffenes Instrument
→ vierdimensionale Bewertung
→ Auswirkung auf Investmentthese
→ Portfolio- und KO-Risiko
→ nächste Prüfung oder Handlung
→ spätere Signalvalidierung</div></div>
      <div class="card decision-panel" style="margin-top:14px">${sectionHeader('Nächste Ereignisse', 'Termine der kommenden 14 Tage')}<div>${state.events.filter(event => { const d=daysUntil(event.event_at); return d !== null && d >= 0 && d <= 14 && event.status !== 'abgeschlossen'; }).slice(0,6).map(event => `<div class="event-card"><div class="event-card-head"><strong>${escapeHtml(event.title)}</strong><span class="event-date">${formatDate(event.event_at)}</span></div><div class="cell-sub">${escapeHtml(tradeById(event.trade_id)?.name || 'Markt')} · ${escapeHtml(event.event_type || 'Ereignis')}</div></div>`).join('') || '<div class="decision-empty">Keine Ereignisse in den nächsten 14 Tagen.</div>'}</div></div></div>
    </div>`;
    bindSignalActions();
  }

  function renderSignalCard(item) {
    const trade = tradeById(item.trade_id);
    return `<article class="signal-card-v25 ${item.severity}">
      <div class="signal-top"><div><div class="signal-title">${escapeHtml(item.title)}</div><div class="signal-meta">${escapeHtml(trade?.name || item.source_type || 'Markt')} · ${escapeHtml(item.symbol || '')}</div></div><div class="signal-score">${item.score}</div></div>
      <div class="signal-summary">${escapeHtml(item.summary)}</div><div class="signal-action">Nächster Schritt: ${escapeHtml(item.action)}</div>
      <div class="signal-dimensions"><div class="signal-dimension">Relevanz<strong>${item.relevance}</strong></div><div class="signal-dimension">Vertrauen<strong>${item.confidence}</strong></div><div class="signal-dimension">Auswirkung<strong>${item.impact}</strong></div><div class="signal-dimension">Dringlichkeit<strong>${item.urgency}</strong></div></div>
      <div class="signal-actions">${item.trade_id ? `<button class="btn small primary" data-open-trade="${escapeHtml(item.trade_id)}">Analyse öffnen</button>` : ''}<button class="btn small" data-snooze-signal="${escapeHtml(item.key)}">24h zurückstellen</button><button class="btn small" data-resolve-signal="${escapeHtml(item.key)}">Erledigt</button></div>
    </article>`;
  }

  function bindSignalActions() {
    $$('[data-open-trade]', content).forEach(button => button.onclick = () => {
      dashboard()?.selectTradeById?.(button.dataset.openTrade);
      window.InvestitionNavigation?.showPage?.('trading');
    });
    $$('[data-snooze-signal]', content).forEach(button => button.onclick = () => updateSignalState(button.dataset.snoozeSignal, 'snoozed'));
    $$('[data-resolve-signal]', content).forEach(button => button.onclick = () => updateSignalState(button.dataset.resolveSignal, 'resolved'));
  }

  async function updateSignalState(key, action) {
    const existing = signalStateFor(key);
    const row = {
      id: existing?.id || uuid(), signal_key:key,
      status: action === 'resolved' ? 'resolved' : 'active',
      snoozed_until: action === 'snoozed' ? new Date(Date.now()+86400000).toISOString() : null,
      updated_at:new Date().toISOString()
    };
    state.signalStates = [...state.signalStates.filter(item => item.signal_key !== key), row];
    saveLocal('signal-states', state.signalStates);
    await upsertCloud('decision_signal_state', row, 'user_id,signal_key');
    renderToday();
  }

  function renderThesis() {
    const trade = selectedTrade();
    if (!trade) { content.innerHTML = '<div class="decision-empty">Noch keine Trade-Pläne vorhanden.</div>'; return; }
    const thesis = thesisFor(trade.id);
    const scenarios = scenariosFor(trade.id);
    const totalProbability = scenarios.reduce((sum, item) => sum + num(item.probability,0), 0);
    const expected = scenarios.reduce((sum,item) => sum + num(item.target_price,0) * num(item.probability,0) / 100, 0);
    const price = currentPrice(trade);
    const upside = price && expected ? (expected-price)/price*100 : null;
    content.innerHTML = `<div class="decision-grid">
      <div class="card decision-panel decision-span-12">${sectionHeader('Instrument auswählen', 'These und Szenarien werden je Analyse gespeichert', `<button class="btn small" id="openSelectedAnalysis">Analyse öffnen</button>`)}<select id="decisionTradeSelect">${tradeOptions(trade.id)}</select></div>
      <div class="card decision-panel decision-span-7">${sectionHeader('Investmentthese', 'Kernannahme, Evidenz, Risiken und klare Invalidierung')}
        <form id="thesisForm"><div class="decision-form-grid">
          <div class="span-4"><label>Kernthese</label><textarea name="core_thesis" placeholder="Warum sollte dieses Unternehmen im gewählten Anlagehorizont überdurchschnittlich abschneiden?">${escapeHtml(thesis.core_thesis || '')}</textarea></div>
          <div class="span-2"><label>Positive Katalysatoren</label><textarea name="catalysts" placeholder="Ein Katalysator pro Zeile">${escapeHtml(thesis.catalysts || '')}</textarea></div>
          <div class="span-2"><label>Thesenrisiken</label><textarea name="risks" placeholder="Ein Risiko pro Zeile">${escapeHtml(thesis.risks || '')}</textarea></div>
          <div class="span-4"><label>Invalidierung</label><textarea name="invalidation" placeholder="Welche beobachtbare Entwicklung widerlegt die These?">${escapeHtml(thesis.invalidation || '')}</textarea></div>
          <div><label>Thesenstatus</label><select name="thesis_status"><option value="confirmed" ${thesis.thesis_status==='confirmed'?'selected':''}>Bestätigt</option><option value="neutral" ${thesis.thesis_status==='neutral'?'selected':''}>Neutral</option><option value="weakened" ${thesis.thesis_status==='weakened'?'selected':''}>Geschwächt</option><option value="invalidated" ${thesis.thesis_status==='invalidated'?'selected':''}>Invalidiert</option></select></div>
          <div><label>Vertrauen 0–100</label><input name="confidence" type="number" min="0" max="100" value="${escapeHtml(thesis.confidence ?? 50)}"></div>
          <div><label>Handlungsstatus</label><select name="decision_status">${['Beobachten','Analysieren','Einstieg vorbereiten','Einstiegszone aktiv','Position halten','Position reduzieren','Exit prüfen','These verletzt'].map(v=>`<option ${thesis.decision_status===v?'selected':''}>${v}</option>`).join('')}</select></div>
          <div><label>Sektor</label><input name="sector" value="${escapeHtml(thesis.sector || '')}" placeholder="z. B. Halbleiter"></div>
          <div><label>Region</label><input name="region" value="${escapeHtml(thesis.region || '')}" placeholder="z. B. Südkorea"></div>
          <div><label>Währungsexponierung</label><input name="currency_exposure" value="${escapeHtml(thesis.currency_exposure || trade.currency || '')}" placeholder="EUR, USD, KRW …"></div>
          <div class="span-2"><label>Letzte Prüfung</label><input value="${escapeHtml(formatDate(thesis.updated_at,true))}" disabled></div>
        </div><div class="signal-actions"><button class="btn primary" type="submit">These speichern</button></div></form>
      </div>
      <div class="card decision-panel decision-span-5">${sectionHeader('Thesenprofil', 'Strukturierte Qualitätskontrolle')}
        <div class="scenario-result"><div class="label">Aktueller Status</div><div class="big">${escapeHtml(thesis.decision_status || 'Beobachten')}</div><div class="cell-sub">${escapeHtml(trade.name)} · ${escapeHtml(thesis.thesis_status || 'neutral')}</div></div>
        <div class="score-meter"><div class="score-box"><span>Vertrauen</span><strong>${clamp(thesis.confidence)}</strong></div><div class="score-box"><span>Katalysatoren</span><strong>${String(thesis.catalysts||'').split('\n').filter(Boolean).length}</strong></div><div class="score-box"><span>Risiken</span><strong>${String(thesis.risks||'').split('\n').filter(Boolean).length}</strong></div><div class="score-box"><span>Invalidierung</span><strong>${thesis.invalidation ? '✓' : '—'}</strong></div></div>
        <div class="risk-warning ${thesis.invalidation ? '' : 'bad'}" style="margin-top:12px">${thesis.invalidation ? 'Eine Invalidierungsbedingung ist dokumentiert.' : 'Ohne klare Invalidierung ist die Entscheidungskontrolle unvollständig.'}</div>
      </div>
      <div class="card decision-panel decision-span-12">${sectionHeader('Bull / Base / Bear', 'Annahmen und Zielwerte statt eines einzelnen Zielkurses')}
        <form id="scenarioForm"><div class="table-shell-v25"><table class="scenario-table"><thead><tr><th>Szenario</th><th>Wahrscheinlichkeit %</th><th>Umsatzwachstum %</th><th>Marge %</th><th>Multiple</th><th>Zielkurs</th><th>Annahmen</th></tr></thead><tbody>${scenarios.map(item => `<tr data-scenario="${item.scenario}"><td><strong>${item.scenario.toUpperCase()}</strong></td><td><input name="${item.scenario}_probability" type="number" min="0" max="100" value="${escapeHtml(item.probability ?? '')}"></td><td><input name="${item.scenario}_revenue_growth" type="number" step="0.1" value="${escapeHtml(item.revenue_growth ?? '')}"></td><td><input name="${item.scenario}_margin" type="number" step="0.1" value="${escapeHtml(item.margin ?? '')}"></td><td><input name="${item.scenario}_valuation_multiple" type="number" step="0.1" value="${escapeHtml(item.valuation_multiple ?? '')}"></td><td><input name="${item.scenario}_target_price" type="number" step="0.01" value="${escapeHtml(item.target_price ?? '')}"></td><td><textarea name="${item.scenario}_notes">${escapeHtml(item.notes || '')}</textarea></td></tr>`).join('')}</tbody></table></div>
        <div class="decision-grid" style="margin-top:12px"><div class="decision-span-4 scenario-result"><div class="label">Wahrscheinlichkeitssumme</div><div class="big">${formatPct(totalProbability,0)}</div></div><div class="decision-span-4 scenario-result"><div class="label">Erwartungsgewichteter Zielwert</div><div class="big">${expected ? formatNumber(expected) : '—'}</div></div><div class="decision-span-4 scenario-result"><div class="label">Potenzial zum Referenzkurs</div><div class="big">${upside === null ? '—' : formatPct(upside)}</div></div></div>
        <div class="signal-actions"><button class="btn primary" type="submit">Szenarien speichern</button><span class="form-note">Die Wahrscheinlichkeitssumme sollte 100 % ergeben.</span></div></form>
      </div>
    </div>`;
    $('#decisionTradeSelect').onchange = event => { state.selectedTradeId = event.target.value; renderThesis(); };
    $('#openSelectedAnalysis').onclick = () => { dashboard()?.selectTradeById?.(trade.id); window.InvestitionNavigation?.showPage?.('trading'); };
    $('#thesisForm').onsubmit = saveThesis;
    $('#scenarioForm').onsubmit = saveScenarios;
  }

  async function saveThesis(event) {
    event.preventDefault();
    const trade = selectedTrade(); if (!trade) return;
    const data = serializeForm(event.currentTarget);
    const existing = thesisFor(trade.id);
    const row = {...existing, ...data, trade_id:trade.id, confidence:clamp(data.confidence), updated_at:new Date().toISOString()};
    state.theses = [...state.theses.filter(item => item.trade_id !== trade.id), row];
    saveLocal('theses', state.theses);
    await upsertCloud('investment_theses', row, 'trade_id');
    setStatus(`Investmentthese für ${trade.name} gespeichert.`, 'good');
    renderThesis();
  }

  async function saveScenarios(event) {
    event.preventDefault();
    const trade = selectedTrade(); if (!trade) return;
    const data = serializeForm(event.currentTarget);
    const rows = ['bull','base','bear'].map(name => {
      const old = scenariosFor(trade.id).find(item => item.scenario === name) || {};
      return {...old, id:old.id || uuid(), trade_id:trade.id, scenario:name, probability:num(data[`${name}_probability`],0), revenue_growth:num(data[`${name}_revenue_growth`]), margin:num(data[`${name}_margin`]), valuation_multiple:num(data[`${name}_valuation_multiple`]), target_price:num(data[`${name}_target_price`]), notes:data[`${name}_notes`] || '', updated_at:new Date().toISOString()};
    });
    const probabilitySum = rows.reduce((sum, row) => sum + num(row.probability, 0), 0);
    if (Math.abs(probabilitySum - 100) > 0.01) {
      setStatus(`Szenarien nicht gespeichert: Wahrscheinlichkeiten ergeben ${formatPct(probabilitySum, 0)} statt 100 %.`, 'bad');
      return;
    }
    state.scenarios = [...state.scenarios.filter(item => item.trade_id !== trade.id), ...rows];
    saveLocal('scenarios', state.scenarios);
    for (const row of rows) await upsertCloud('valuation_scenarios', row, 'trade_id,scenario');
    setStatus(`Szenarien für ${trade.name} gespeichert.`, 'good');
    renderThesis();
  }

  function renderEvents() {
    const edit = state.events.find(item => item.id === state.editingEventId) || {trade_id:selectedTrade()?.id || '', event_type:'Quartalszahlen', importance:'hoch', expected_volatility:'hoch', status:'geplant'};
    const sorted = [...state.events].sort((a,b) => String(a.event_at).localeCompare(String(b.event_at)));
    content.innerHTML = `<div class="decision-grid"><div class="card decision-panel decision-span-5">${sectionHeader(edit.id ? 'Ereignis bearbeiten' : 'Ereignis anlegen', 'Katalysatoren und bekannte Risikotermine vorbereiten')}
      <form id="eventForm"><input type="hidden" name="id" value="${escapeHtml(edit.id || '')}"><div class="decision-form-grid">
        <div class="span-4"><label>Titel</label><input name="title" required value="${escapeHtml(edit.title || '')}" placeholder="z. B. Quartalszahlen SK hynix"></div>
        <div class="span-2"><label>Analyse</label><select name="trade_id"><option value="">Gesamtmarkt</option>${tradeOptions(edit.trade_id || '')}</select></div>
        <div class="span-2"><label>Typ</label><select name="event_type">${['Quartalszahlen','Hauptversammlung','Dividende','Produktvorstellung','Analystentag','Notenbanksitzung','Konjunkturdaten','Regulierung','Gericht','Verfallstag','Sonstiges'].map(v=>`<option ${edit.event_type===v?'selected':''}>${v}</option>`).join('')}</select></div>
        <div class="span-2"><label>Datum und Uhrzeit</label><input name="event_at" type="datetime-local" required value="${escapeHtml(toLocalInput(edit.event_at))}"></div>
        <div><label>Bedeutung</label><select name="importance"><option ${edit.importance==='hoch'?'selected':''}>hoch</option><option ${edit.importance==='mittel'?'selected':''}>mittel</option><option ${edit.importance==='niedrig'?'selected':''}>niedrig</option></select></div>
        <div><label>Volatilität</label><select name="expected_volatility"><option ${edit.expected_volatility==='hoch'?'selected':''}>hoch</option><option ${edit.expected_volatility==='mittel'?'selected':''}>mittel</option><option ${edit.expected_volatility==='niedrig'?'selected':''}>niedrig</option></select></div>
        <div class="span-4"><label>Vorbereitung / Prüfpunkte</label><textarea name="prep_notes" placeholder="Erwartungen, Kennzahlen, Bull-/Bear-Überraschungen, Handlungsplan">${escapeHtml(edit.prep_notes || '')}</textarea></div>
        <div class="span-2"><label>Status</label><select name="status"><option ${edit.status==='geplant'?'selected':''}>geplant</option><option ${edit.status==='vorbereitet'?'selected':''}>vorbereitet</option><option ${edit.status==='abgeschlossen'?'selected':''}>abgeschlossen</option></select></div>
        <div class="span-2"><label>Quelle</label><input name="source_url" type="url" value="${escapeHtml(edit.source_url || '')}" placeholder="https://…"></div>
      </div><div class="signal-actions"><button class="btn primary" type="submit">Speichern</button>${edit.id ? '<button class="btn" type="button" id="cancelEventEdit">Abbrechen</button>' : ''}</div></form></div>
      <div class="card decision-panel decision-span-7">${sectionHeader('Ereigniskalender', 'Nächste 7, 30 und 90 Tage', `<span class="chip neutral">${sorted.length} Termine</span>`)}
        <div>${sorted.length ? sorted.map(item => { const d=daysUntil(item.event_at); const trade=tradeById(item.trade_id); return `<div class="event-card"><div class="event-card-head"><div><strong>${escapeHtml(item.title)}</strong><div class="cell-sub">${escapeHtml(trade?.name || 'Gesamtmarkt')} · ${escapeHtml(item.event_type || '')}</div></div><span class="event-date">${formatDate(item.event_at,true)}</span></div><div class="news-tags" style="margin-top:8px"><span class="chip ${item.importance==='hoch'?'bad':item.importance==='mittel'?'warn':'neutral'}">Bedeutung ${escapeHtml(item.importance || 'mittel')}</span><span class="chip neutral">Volatilität ${escapeHtml(item.expected_volatility || '—')}</span><span class="chip neutral">${d===null?'—':d<0?`${Math.abs(d)} Tage zurück`:`in ${d} Tagen`}</span></div><div class="event-notes">${escapeHtml(item.prep_notes || 'Noch keine Prüfpunkte dokumentiert.')}</div><div class="signal-actions"><button class="btn small" data-edit-event="${escapeHtml(item.id)}">Bearbeiten</button><button class="btn small danger" data-delete-event="${escapeHtml(item.id)}">Löschen</button></div></div>`; }).join('') : '<div class="decision-empty">Noch keine Ereignisse hinterlegt.</div>'}</div></div></div>`;
    $('#eventForm').onsubmit = saveEvent;
    $('#cancelEventEdit')?.addEventListener('click', () => { state.editingEventId = null; renderEvents(); });
    $$('[data-edit-event]', content).forEach(button => button.onclick = () => { state.editingEventId = button.dataset.editEvent; renderEvents(); });
    $$('[data-delete-event]', content).forEach(button => button.onclick = () => removeEvent(button.dataset.deleteEvent));
  }
  function toLocalInput(value) {
    if (!value) return '';
    const date = new Date(value); if (Number.isNaN(date.getTime())) return '';
    const pad = n => String(n).padStart(2,'0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  async function saveEvent(event) {
    event.preventDefault();
    const data = serializeForm(event.currentTarget);
    const old = state.events.find(item => item.id === data.id) || {};
    const eventDate = new Date(data.event_at);
    if (Number.isNaN(eventDate.getTime())) { setStatus('Ereignis nicht gespeichert: Datum und Uhrzeit sind ungültig.', 'bad'); return; }
    const row = {...old, ...data, id:data.id || uuid(), event_at:eventDate.toISOString(), updated_at:new Date().toISOString()};
    state.events = [...state.events.filter(item => item.id !== row.id), row];
    saveLocal('events', state.events);
    await upsertCloud('market_events', row, 'id');
    state.editingEventId = null;
    setStatus(`Ereignis „${row.title}“ gespeichert.`, 'good');
    renderEvents();
  }
  async function removeEvent(id) {
    const row = state.events.find(item => item.id === id); if (!row) return;
    if (!confirm(`Ereignis „${row.title}“ löschen?`)) return;
    state.events = state.events.filter(item => item.id !== id); saveLocal('events', state.events); await deleteCloud('market_events', id); renderEvents();
  }

  function renderPortfolio() {
    const exposure = computeExposures();
    const prefs = state.preferences;
    const totalRisk = trades().reduce((sum,trade) => sum+riskToStop(trade),0);
    const portfolioValue = num(prefs.portfolio_value,0);
    const riskPct = portfolioValue > 0 ? totalRisk/portfolioValue*100 : 0;
    const koTrades = trades().filter(trade => trade.type === 'Knock-out' || num(trade.koBarrier) !== null);
    const warnings = [];
    const activeCurrencies = [...new Set(exposure.positions.map(item => String(item.trade.currency || 'EUR').toUpperCase()))];
    if (activeCurrencies.length > 1) warnings.push(`Mehrere Währungen (${activeCurrencies.join(', ')}): Positionswerte werden ohne automatische FX-Umrechnung als Näherung addiert.`);
    exposure.positions.forEach(item => { const pct=exposure.invested?item.value/exposure.invested*100:0; if(pct>num(prefs.max_single_weight_pct,20)) warnings.push(`${item.trade.name}: ${formatPct(pct)} Einzeltitelgewicht`); });
    exposure.sectors.forEach(item => { if(item.pct>num(prefs.max_sector_weight_pct,35)) warnings.push(`${item.label}: ${formatPct(item.pct)} Sektoranteil`); });
    if (riskPct > num(prefs.max_total_risk_pct,8)) warnings.push(`Gesamtrisiko ${formatPct(riskPct)} über Grenzwert`);
    const broadLoss = exposure.invested * .10;
    const semiLoss = exposure.positions.filter(item => /halb|semi|chip|memory/i.test(item.thesis.sector || '')).reduce((sum,item)=>sum+item.value*.15,0);
    const fxLoss = exposure.positions.filter(item => String(item.thesis.currency_exposure || item.trade.currency || 'EUR').toUpperCase() !== 'EUR').reduce((sum,item)=>sum+item.value*.08,0);
    content.innerHTML = `<div class="decision-grid">
      <div class="card decision-panel decision-span-12"><div class="decision-kpis"><div class="decision-kpi"><div class="label">Portfoliowert</div><div class="value">${formatMoney(portfolioValue)}</div><div class="sub">inkl. Cash gemäß Einstellung</div></div><div class="decision-kpi"><div class="label">Investiert (Näherung)</div><div class="value">${formatMoney(exposure.invested)}</div><div class="sub">ohne automatische FX-Umrechnung</div></div><div class="decision-kpi"><div class="label">Risiko bis Stop (Näherung)</div><div class="value">${formatMoney(totalRisk)}</div><div class="sub">${formatPct(riskPct)} des Portfolios</div></div><div class="decision-kpi"><div class="label">Warnungen</div><div class="value">${warnings.length}</div><div class="sub">Konzentration und Risiko</div></div></div></div>
      <div class="card decision-panel decision-span-5">${sectionHeader('Portfolio-Grenzwerte', 'Grundlage für Positions- und Konzentrationsentscheidungen')}<form id="portfolioPrefsForm"><div class="decision-form-grid"><div class="span-2"><label>Portfoliowert EUR</label><input name="portfolio_value" type="number" step="0.01" value="${escapeHtml(prefs.portfolio_value)}"></div><div class="span-2"><label>Cash EUR</label><input name="cash_value" type="number" step="0.01" value="${escapeHtml(prefs.cash_value)}"></div><div><label>Max. Einzeltitel %</label><input name="max_single_weight_pct" type="number" value="${escapeHtml(prefs.max_single_weight_pct)}"></div><div><label>Max. Sektor %</label><input name="max_sector_weight_pct" type="number" value="${escapeHtml(prefs.max_sector_weight_pct)}"></div><div><label>Max. Gesamtrisiko %</label><input name="max_total_risk_pct" type="number" value="${escapeHtml(prefs.max_total_risk_pct)}"></div><div><label>KO gelb %</label><input name="ko_yellow_pct" type="number" value="${escapeHtml(prefs.ko_yellow_pct)}"></div><div><label>KO orange %</label><input name="ko_orange_pct" type="number" value="${escapeHtml(prefs.ko_orange_pct)}"></div><div><label>KO rot %</label><input name="ko_red_pct" type="number" value="${escapeHtml(prefs.ko_red_pct)}"></div></div><div class="signal-actions"><button class="btn primary" type="submit">Grenzwerte speichern</button></div></form></div>
      <div class="card decision-panel decision-span-7">${sectionHeader('Risikohinweise', 'Regelbasiert aus Positionen und Grenzwerten')}<div class="signal-list-v25">${warnings.length ? warnings.map(text=>`<div class="risk-warning bad">${escapeHtml(text)}</div>`).join('') : '<div class="risk-warning">Keine hinterlegten Grenzwerte überschritten.</div>'}</div><div class="decision-kpis" style="margin-top:12px"><div class="decision-kpi"><div class="label">Breitmarkt −10 %</div><div class="value">−${formatMoney(broadLoss)}</div><div class="sub">vereinfachte Schätzung</div></div><div class="decision-kpi"><div class="label">Halbleiter −15 %</div><div class="value">−${formatMoney(semiLoss)}</div><div class="sub">nach Sektorzuordnung</div></div><div class="decision-kpi"><div class="label">Fremdwährung −8 %</div><div class="value">−${formatMoney(fxLoss)}</div><div class="sub">nicht-EUR Exponierung</div></div><div class="decision-kpi"><div class="label">Cashquote</div><div class="value">${portfolioValue>0?formatPct(num(prefs.cash_value,0)/portfolioValue*100):'—'}</div><div class="sub">Liquiditätspuffer</div></div></div></div>
      <div class="decision-span-4">${renderExposure('Sektoren', exposure.sectors)}</div><div class="decision-span-4">${renderExposure('Regionen', exposure.regions)}</div><div class="decision-span-4">${renderExposure('Währungen', exposure.currencies)}</div>
      <div class="card decision-panel decision-span-12">${sectionHeader('KO-Risikocockpit', 'Abstand, Hebel, Barriere und Kursalter getrennt vom Aktienrisiko')}<div class="ko-grid">${koTrades.length ? koTrades.map(trade => { const distance=koDistance(trade); const level=distance===null?'':distance<=num(prefs.ko_red_pct,5)?'red':distance<=num(prefs.ko_orange_pct,10)?'orange':distance<=num(prefs.ko_yellow_pct,15)?'yellow':''; return `<div class="ko-card ${level}"><strong>${escapeHtml(trade.name)}</strong><div class="cell-sub">${escapeHtml(trade.wkn || trade.symbol || '')}</div><div class="ko-distance">${formatPct(distance)}</div><div class="cell-sub">KO ${formatNumber(trade.koBarrier)} · Hebel ${formatNumber(trade.leverage,1)}</div><div class="cell-sub">Kurs ${formatNumber(trade.currentPrice)} · ${formatDate(trade.currentPriceAt,true)}</div><div class="signal-actions"><button class="btn small" data-open-trade="${escapeHtml(trade.id)}">Analyse öffnen</button></div></div>`; }).join('') : '<div class="decision-empty">Keine Knock-out-Produkte oder KO-Barrieren hinterlegt.</div>'}</div></div>
      <div class="card decision-panel decision-span-6">${sectionHeader('Positionsgrößenrechner', 'Maximalverlust statt Bauchgefühl')}<div class="decision-form-grid" id="positionSizeCalc"><div><label>Maximalverlust EUR</label><input id="calcLoss" type="number" value="300"></div><div><label>Einstieg</label><input id="calcEntry" type="number" step="0.01" value="100"></div><div><label>Stop</label><input id="calcStop" type="number" step="0.01" value="94"></div><div><label>Ergebnis</label><div class="scenario-result"><div class="big" id="calcQuantity">50 Stück</div><div class="cell-sub" id="calcValue">5.000 EUR</div></div></div></div></div>
      <div class="card decision-panel decision-span-6">${sectionHeader('Positionen', 'Wert, Gewicht und Risiko bis Stop')}<div class="table-shell-v25"><table class="portfolio-table"><thead><tr><th>Instrument</th><th>Wert</th><th>Gewicht</th><th>Risiko</th><th>Sektor</th></tr></thead><tbody>${exposure.positions.length ? exposure.positions.map(item=>`<tr><td><strong>${escapeHtml(item.trade.name)}</strong><div class="cell-sub">${escapeHtml(item.trade.symbol||'')}</div></td><td>${formatMoney(item.value,item.trade.currency||'EUR')}</td><td>${formatPct(exposure.invested?item.value/exposure.invested*100:0)}</td><td>${formatMoney(riskToStop(item.trade),item.trade.currency||'EUR')}</td><td>${escapeHtml(item.thesis.sector||'—')}</td></tr>`).join('') : '<tr><td colspan="5" class="empty-table">Keine Positionswerte vorhanden.</td></tr>'}</tbody></table></div></div>
    </div>`;
    $('#portfolioPrefsForm').onsubmit = savePortfolioPrefs;
    $$('[data-open-trade]', content).forEach(button => button.onclick = () => { dashboard()?.selectTradeById?.(button.dataset.openTrade); window.InvestitionNavigation?.showPage?.('trading'); });
    ['calcLoss','calcEntry','calcStop'].forEach(id => $('#'+id)?.addEventListener('input', updatePositionSize));
    updatePositionSize();
  }
  async function savePortfolioPrefs(event) {
    event.preventDefault(); const data=serializeForm(event.currentTarget);
    state.preferences={...state.preferences, ...Object.fromEntries(Object.entries(data).map(([k,v]) => [k, num(v, v)])), updated_at:new Date().toISOString()};
    saveLocal('preferences',state.preferences); await upsertCloud('notification_policies',state.preferences,'user_id'); setStatus('Portfolio-Grenzwerte gespeichert.','good'); renderPortfolio();
  }
  function updatePositionSize() {
    const loss=num($('#calcLoss')?.value,0), entry=num($('#calcEntry')?.value), stop=num($('#calcStop')?.value);
    const risk=entry!==null&&stop!==null?Math.abs(entry-stop):0; const quantity=risk>0?Math.floor(loss/risk):0;
    if ($('#calcQuantity')) $('#calcQuantity').textContent=`${formatNumber(quantity,0)} Stück`;
    if ($('#calcValue')) $('#calcValue').textContent=`${formatNumber(quantity*(entry||0))} EUR Positionswert`;
  }

  function renderSignals() {
    const events = state.alertEvents;
    const rows = events.map(event => {
      const trade=tradeById(event.trade_id), outcome=outcomeFor(event.id), start=num(event.price), now=currentPrice(trade);
      let liveReturn = start && now ? (now-start)/start*100 : null;
      if (liveReturn!==null && String(trade?.direction||'').toLowerCase().includes('short')) liveReturn*=-1;
      return {event,trade,outcome,liveReturn};
    });
    const reviewed=rows.filter(row=>row.outcome?.manual_result && row.outcome.manual_result!=='offen');
    const hits=reviewed.filter(row=>row.outcome.manual_result==='bestätigt').length;
    const returns=rows.map(row=>num(row.outcome?.return_20d ?? row.liveReturn)).filter(v=>v!==null);
    const avg=returns.length?returns.reduce((a,b)=>a+b,0)/returns.length:null;
    content.innerHTML=`<div class="decision-grid"><div class="card decision-panel decision-span-12"><div class="decision-kpis"><div class="decision-kpi"><div class="label">Signale</div><div class="value">${rows.length}</div><div class="sub">gespeicherte Alarmereignisse</div></div><div class="decision-kpi"><div class="label">Bewertet</div><div class="value">${reviewed.length}</div><div class="sub">manuell klassifiziert</div></div><div class="decision-kpi"><div class="label">Trefferquote</div><div class="value">${reviewed.length?formatPct(hits/reviewed.length*100):'—'}</div><div class="sub">bestätigt / bewertet</div></div><div class="decision-kpi"><div class="label">Ø Rendite</div><div class="value">${avg===null?'—':formatPct(avg)}</div><div class="sub">20T oder aktueller Stand</div></div></div></div>
      <div class="card decision-panel decision-span-12">${sectionHeader('Signalvalidierung', 'Alarmzeitpunkt, spätere Rendite und manuelle Qualitätsbewertung', `<button class="btn small primary" id="evaluateSignalsBtn">Signale auswerten</button>`)}<div class="table-shell-v25"><table class="signals-table"><thead><tr><th>Zeit</th><th>Instrument / Signal</th><th>Signalpreis</th><th>1T</th><th>5T</th><th>20T / aktuell</th><th>Bewertung</th><th>Notiz</th></tr></thead><tbody>${rows.length?rows.map(({event,trade,outcome,liveReturn})=>`<tr><td>${formatDate(event.created_at,true)}</td><td><strong>${escapeHtml(trade?.name||'Instrument')}</strong><div class="cell-sub">${escapeHtml(event.event_type||'')} · Score ${escapeHtml(event.score ?? '—')} · ${escapeHtml(event.severity || 'nicht klassifiziert')}</div></td><td>${formatNumber(event.price)}</td><td>${formatPct(outcome?.return_1d)}</td><td>${formatPct(outcome?.return_5d)}</td><td>${formatPct(outcome?.return_20d ?? liveReturn)}</td><td><select data-outcome-result="${escapeHtml(event.id)}"><option value="offen" ${!outcome?.manual_result||outcome.manual_result==='offen'?'selected':''}>offen</option><option value="bestätigt" ${outcome?.manual_result==='bestätigt'?'selected':''}>bestätigt</option><option value="fehlalarm" ${outcome?.manual_result==='fehlalarm'?'selected':''}>Fehlalarm</option><option value="neutral" ${outcome?.manual_result==='neutral'?'selected':''}>neutral</option></select></td><td><input data-outcome-note="${escapeHtml(event.id)}" value="${escapeHtml(outcome?.notes||'')}" placeholder="Lernpunkt"></td></tr>`).join(''):'<tr><td colspan="8" class="empty-table">Noch keine Alarmereignisse vorhanden.</td></tr>'}</tbody></table></div><p class="form-note">Die automatische 1-/5-/20-Tage-Auswertung benötigt die optionale Edge Function <code>evaluate-signals</code>. Ohne sie bleibt die aktuelle Rendite sichtbar und die Qualitätsbewertung kann manuell erfolgen.</p></div></div>`;
    $$('[data-outcome-result]',content).forEach(select=>select.onchange=()=>saveOutcome(select.dataset.outcomeResult,{manual_result:select.value}));
    $$('[data-outcome-note]',content).forEach(input=>input.onchange=()=>saveOutcome(input.dataset.outcomeNote,{notes:input.value}));
    $('#evaluateSignalsBtn').onclick=evaluateSignals;
  }
  async function saveOutcome(eventId, patch) {
    const existing=outcomeFor(eventId)||{id:uuid(),alert_event_id:String(eventId),manual_result:'offen'};
    const row={...existing,...patch,updated_at:new Date().toISOString()};
    state.outcomes=[...state.outcomes.filter(item=>String(item.alert_event_id)!==String(eventId)),row]; saveLocal('outcomes',state.outcomes); await upsertCloud('signal_outcomes',row,'alert_event_id'); setStatus('Signalbewertung gespeichert.','good');
  }
  async function evaluateSignals() {
    if (!state.sb || !state.session) return setStatus('Für die automatische Auswertung zuerst in der Cloud anmelden.','warn');
    setStatus('Signalhistorien werden ausgewertet …');
    const {data,error}=await state.sb.functions.invoke('evaluate-signals',{body:{limit:20}});
    if(error) return setStatus(`Auswertung nicht verfügbar: ${error.message}`,'warn');
    const errorCount=Array.isArray(data?.errors)?data.errors.length:0;
    setStatus(`${data?.updated||0} Signale ausgewertet; ${data?.skipped||0} übersprungen${errorCount?`; ${errorCount} Fehler`:''}.`,errorCount?'warn':'good'); await loadCloud(); renderSignals();
  }

  function renderNotifications() {
    const p=state.preferences;
    content.innerHTML=`<div class="decision-grid"><div class="card decision-panel decision-span-7">${sectionHeader('Alarm- und Digest-Regeln', 'Telegram nur bei Zustandsänderung oder gebündelt als Bericht')}<form id="notificationForm"><div class="decision-form-grid"><div><label>Sofort ab Score</label><input name="immediate_min_score" type="number" min="0" max="100" value="${escapeHtml(p.immediate_min_score)}"></div><div><label>Cooldown Minuten</label><input name="cooldown_minutes" type="number" min="0" value="${escapeHtml(p.cooldown_minutes)}"></div><div><label>Ruhezeit ab</label><input name="quiet_start" type="time" value="${escapeHtml(p.quiet_start)}"></div><div><label>Ruhezeit bis</label><input name="quiet_end" type="time" value="${escapeHtml(p.quiet_end)}"></div><div><label><input name="daily_digest_enabled" type="checkbox" ${bool(p.daily_digest_enabled,true)?'checked':''}> Tagesbericht aktiv</label></div><div><label>Tagesbericht</label><input name="daily_digest_time" type="time" value="${escapeHtml(p.daily_digest_time)}"></div><div><label><input name="weekly_digest_enabled" type="checkbox" ${bool(p.weekly_digest_enabled,true)?'checked':''}> Wochenbericht aktiv</label></div><div><label>Wochentag</label><select name="weekly_digest_day">${[['0','Sonntag'],['1','Montag'],['2','Dienstag'],['3','Mittwoch'],['4','Donnerstag'],['5','Freitag'],['6','Samstag']].map(([value,label])=>`<option value="${value}" ${String(p.weekly_digest_day ?? 0)===value?'selected':''}>${label}</option>`).join('')}</select></div><div><label>Wochenbericht</label><input name="weekly_digest_time" type="time" value="${escapeHtml(p.weekly_digest_time)}"></div><div><label>KO gelb %</label><input name="ko_yellow_pct" type="number" value="${escapeHtml(p.ko_yellow_pct)}"></div><div><label>KO orange %</label><input name="ko_orange_pct" type="number" value="${escapeHtml(p.ko_orange_pct)}"></div><div><label>KO rot %</label><input name="ko_red_pct" type="number" value="${escapeHtml(p.ko_red_pct)}"></div><div><label>Telegram</label><input value="${state.notificationSettings?.telegram_chat_id?'verbunden':'nicht verbunden'}" disabled></div></div><div class="signal-actions"><button class="btn primary" type="submit">Regeln speichern</button><button class="btn" type="button" id="sendDailyDigest">Tagesbericht testen</button><button class="btn" type="button" id="sendWeeklyDigest">Wochenbericht testen</button></div></form></div>
      <div class="card decision-panel decision-span-5">${sectionHeader('Vorschau', 'Priorität und Versandkanal')}<div class="notification-preview">SOFORT
• Stop / Invalidierung erreicht
• KO-Risikostufe verschärft
• These invalidiert
• Alarm- oder Kursdaten ausgefallen

TAGESBERICHT
• neue relevante News
• veränderte Scores
• Einstiegszonen und Termine

WOCHENBERICHT
• Thesenänderungen
• Konzentrationen
• Signalqualität
• kommende Katalysatoren

Regel: gleiche Zustandsstufe nicht wiederholen; erst Eskalation oder Entwarnung erzeugt eine neue Sofortmeldung.</div></div>
      <div class="card decision-panel decision-span-12">${sectionHeader('KO-Eskalationslogik', 'Schwellen aus deinen Präferenzen')}<div class="decision-kpis"><div class="decision-kpi"><div class="label">Gelb</div><div class="value">≤ ${formatPct(p.ko_yellow_pct)}</div><div class="sub">Beobachtung</div></div><div class="decision-kpi"><div class="label">Orange</div><div class="value">≤ ${formatPct(p.ko_orange_pct)}</div><div class="sub">heute prüfen</div></div><div class="decision-kpi"><div class="label">Rot</div><div class="value">≤ ${formatPct(p.ko_red_pct)}</div><div class="sub">sofort prüfen</div></div><div class="decision-kpi"><div class="label">Entwarnung</div><div class="value">> ${formatPct(p.ko_yellow_pct)}</div><div class="sub">nach vorheriger Warnstufe</div></div></div></div></div>`;
    $('#notificationForm').onsubmit=saveNotificationPrefs;
    $('#sendDailyDigest').onclick=()=>sendDigest('daily'); $('#sendWeeklyDigest').onclick=()=>sendDigest('weekly');
  }
  async function saveNotificationPrefs(event) {
    event.preventDefault(); const data=serializeForm(event.currentTarget);
    const numeric=['immediate_min_score','cooldown_minutes','weekly_digest_day','ko_yellow_pct','ko_orange_pct','ko_red_pct']; numeric.forEach(key=>data[key]=num(data[key],state.preferences[key]));
    state.preferences={...state.preferences,...data,updated_at:new Date().toISOString()}; saveLocal('preferences',state.preferences); await upsertCloud('notification_policies',state.preferences,'user_id'); setStatus('Benachrichtigungsregeln gespeichert.','good'); renderNotifications();
  }
  async function sendDigest(period) {
    if(!state.sb||!state.session)return setStatus('Für den Telegram-Bericht zuerst in der Cloud anmelden.','warn');
    setStatus(`${period==='daily'?'Tages':'Wochen'}bericht wird erzeugt …`);
    const {data,error}=await state.sb.functions.invoke('send-digest',{body:{period,manual:true}});
    if(error)return setStatus(`Bericht fehlgeschlagen: ${error.message}`,'bad');
    setStatus(data?.message||'Bericht wurde versendet.',data?.failed?'warn':'good');
  }

  function renderSystem() {
    const health=computeHealth();
    content.innerHTML=`<div class="decision-grid"><div class="card decision-panel decision-span-12">${sectionHeader('Systemgesundheit', 'Datenalter, Quellen, Cloud und Benachrichtigungskette', `<button class="btn small" id="exportDecisionData">Entscheidungsdaten exportieren</button>`)}<div class="health-grid-v25">${health.map(item=>`<div class="health-card-v25 ${item.status}"><div class="health-name">${escapeHtml(item.name)}</div><div class="health-value">${escapeHtml(item.value)}</div><div class="health-detail">${escapeHtml(item.detail)}</div></div>`).join('')}</div></div>
      <div class="card decision-panel decision-span-7">${sectionHeader('Diagnosehinweise', 'Konkrete nächste Schritte bei Warnungen')}<div class="signal-list-v25">${health.filter(item=>item.status!=='good').map(item=>`<div class="risk-warning ${item.status==='bad'?'bad':''}"><strong>${escapeHtml(item.name)}:</strong> ${escapeHtml(item.detail)}</div>`).join('')||'<div class="risk-warning">Alle prüfbaren Komponenten melden einen guten Status.</div>'}</div><div class="notification-preview" style="margin-top:12px">Datenqualitätsregel:
Kein Kauf-, Stop- oder KO-Entscheid auf Basis eines veralteten oder fehlgeschlagenen Kursabrufs. Der Zeitpunkt und die Quelle müssen sichtbar sein.</div></div>
      <div class="card decision-panel decision-span-5">${sectionHeader('Cloud-/Function-Protokoll', 'Letzte gespeicherte Systemprüfungen')}<div class="system-log">${state.healthRows.length?state.healthRows.slice(0,25).map(row=>`<div class="system-log-row"><strong>${escapeHtml(row.component||'System')} · ${escapeHtml(row.status||'')}</strong><span>${formatDate(row.checked_at,true)} · ${escapeHtml(row.message||row.details||'')}</span></div>`).join(''):'<div class="decision-empty">Noch keine serverseitigen Health-Einträge. Die Oberfläche leitet den Status derzeit direkt aus den vorhandenen Daten ab.</div>'}</div></div>
      <div class="card decision-panel decision-span-12">${sectionHeader('Installationsstand', 'Für den vollständigen Funktionsumfang')}<div class="table-shell-v25"><table><thead><tr><th>Baustein</th><th>Status</th><th>Erforderlich</th></tr></thead><tbody><tr><td>GitHub Dashboard</td><td><span class="chip good">25.0</span></td><td>index.html, app.js, news.js, decision.js, service-worker.js, reset.html</td></tr><tr><td>Supabase Schema</td><td><span class="chip ${state.schemaReady?'good':'warn'}">${state.schemaReady?'erreichbar':'prüfen'}</span></td><td>version25-schema.sql</td></tr><tr><td>Alarm-Function</td><td><span class="chip neutral">optional aktualisieren</span></td><td>check-alerts-index.ts für Eskalationsstufen</td></tr><tr><td>Digest-Function</td><td><span class="chip neutral">optional</span></td><td>send-digest-index.ts + setup-v25-cron.sql</td></tr><tr><td>Signalauswertung</td><td><span class="chip neutral">optional</span></td><td>evaluate-signals-index.ts</td></tr></tbody></table></div></div></div>`;
    $('#exportDecisionData').onclick=exportDecisionData;
  }
  function exportDecisionData() {
    const payload={version:VERSION,exported_at:new Date().toISOString(),theses:state.theses,scenarios:state.scenarios,events:state.events,preferences:state.preferences,signal_states:state.signalStates,outcomes:state.outcomes};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`investition-entscheidungsdaten-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
  }

  function render() {
    $$('.decision-tab').forEach(button => button.classList.toggle('active', button.dataset.decisionTab === state.activeTab));
    const renderers={today:renderToday,thesis:renderThesis,events:renderEvents,portfolio:renderPortfolio,signals:renderSignals,notifications:renderNotifications,system:renderSystem};
    (renderers[state.activeTab]||renderToday)();
  }
  async function refresh() {
    if(state.loading)return; state.loading=true; refreshBtn.disabled=true; setStatus('Entscheidungsdaten werden aktualisiert …');
    await loadCloud(); state.loading=false; refreshBtn.disabled=false; render();
  }
  function setTab(tab) { state.activeTab=tab; render(); }

  $$('.decision-tab').forEach(button => button.onclick=()=>setTab(button.dataset.decisionTab));
  refreshBtn.onclick=refresh;
  window.addEventListener('investition:data-changed',()=>{ if(!page.hidden) render(); });
  window.addEventListener('investition:auth-changed',()=>setTimeout(refresh,100));
  window.addEventListener('investition:decision-visible',()=>{ state.news=window.InvestitionNews?.getItems?.()||loadNewsLocal(); render(); });
  window.addEventListener('investition:news-changed',()=>{ state.news=window.InvestitionNews?.getItems?.()||loadNewsLocal(); if(state.activeTab==='today'||state.activeTab==='system') render(); });
  window.addEventListener('online',()=>render()); window.addEventListener('offline',()=>render());

  window.InvestitionDecision = {refresh,setTab,getSignals:generateSignals,getState:()=>({...state,trades:trades()})};
  render();
  setTimeout(refresh,300);
})();
