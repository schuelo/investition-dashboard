(() => {
  'use strict';

  const VERSION = '28.0';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const page = $('#analyticsPage');
  const content = $('#analyticsContent');
  const statusEl = $('#analyticsStatus');
  const refreshBtn = $('#analyticsRefreshBtn');
  const snapshotBtn = $('#analyticsSnapshotBtn');
  if (!page || !content) return;

  const state = {
    loading: false,
    sb: null,
    session: null,
    trades: [],
    positions: [],
    theses: [],
    scenarios: [],
    events: [],
    news: [],
    outcomes: [],
    revisions: [],
    snapshots: [],
    preferences: null,
    errors: [],
    analyticsSchemaReady: true,
    lastLoadedAt: null
  };

  function dashboard() { return window.InvestitionDashboard || null; }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function num(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function clamp(value, min = 0, max = 100) { return Math.max(min, Math.min(max, num(value, 0))); }
  function fmt(value, digits = 2) {
    const parsed = num(value);
    return parsed === null ? '—' : new Intl.NumberFormat('de-DE', {maximumFractionDigits:digits}).format(parsed);
  }
  function money(value, currency = 'EUR') {
    const parsed = num(value);
    if (parsed === null) return '—';
    try { return new Intl.NumberFormat('de-DE', {style:'currency', currency, maximumFractionDigits:2}).format(parsed); }
    catch { return `${fmt(parsed)} ${currency}`; }
  }
  function pct(value, digits = 1) {
    const parsed = num(value);
    return parsed === null ? '—' : `${fmt(parsed, digits)} %`;
  }
  function dateText(value, withTime = false) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('de-DE', withTime
      ? {dateStyle:'short', timeStyle:'short', timeZone:'Europe/Berlin'}
      : {dateStyle:'medium', timeZone:'Europe/Berlin'}).format(date);
  }
  function daysUntil(value) {
    if (!value) return null;
    const target = new Date(value).getTime();
    return Number.isFinite(target) ? Math.ceil((target - Date.now()) / 86400000) : null;
  }
  function ageHours(value) {
    if (!value) return null;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? (Date.now() - time) / 3600000 : null;
  }
  function setStatus(text, type = '') {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = `analytics-status ${type}`;
  }
  function normalizeTokens(value) {
    const raw = String(value || '').toUpperCase().replace(/\s+/g, '');
    if (!raw) return [];
    const values = new Set([raw]);
    if (raw.includes(':')) values.add(raw.split(':').pop());
    if (raw.includes('.')) values.add(raw.split('.')[0]);
    return [...values].filter(Boolean);
  }
  function tradeById(id) { return state.trades.find(item => item.id === id) || null; }
  function thesisByTrade(id) { return state.theses.find(item => item.trade_id === id) || null; }
  function scenariosByTrade(id) { return state.scenarios.filter(item => item.trade_id === id); }
  function currentTradePrice(trade) { return num(trade?.currentPrice ?? trade?.current_price); }
  function currentTradePriceAt(trade) { return trade?.currentPriceAt || trade?.current_price_at || trade?.quoteAt || null; }

  async function safeSelect(table, build, fallback = [], optional = false) {
    try {
      const {data, error} = await build(state.sb.from(table));
      if (error) throw error;
      return data ?? fallback;
    } catch (error) {
      const message = `${table}: ${error?.message || String(error)}`;
      state.errors.push(message);
      if (!optional) console.warn(message);
      if (/analyst_revisions|portfolio_snapshots/i.test(message)) state.analyticsSchemaReady = false;
      return fallback;
    }
  }

  function normalizePosition(row) {
    const trade = tradeById(row.trade_id);
    const direction = String(row.direction || trade?.direction || 'Long');
    const quantity = Math.abs(num(row.quantity, 0));
    const fx = num(row.fx_rate_to_eur, 1) || 1;
    const entry = num(row.average_entry_price, 0);
    const fees = num(row.fees, 0);
    const current = num(row.current_price_override, currentTradePrice(trade));
    const invested = (quantity * entry + fees) * fx;
    const marketValue = current === null ? null : quantity * current * fx;
    const pnl = marketValue === null ? null : direction.toLowerCase() === 'short' ? invested - marketValue : marketValue - invested;
    const pnlPct = invested > 0 && pnl !== null ? pnl / invested * 100 : null;
    const stop = num(row.stop_price, num(trade?.stop));
    let stopRisk = null;
    let stopBreached = false;
    if (current !== null && stop !== null) {
      if (direction.toLowerCase() === 'short') {
        stopRisk = Math.max(0, (stop - current) * quantity * fx);
        stopBreached = current >= stop;
      } else {
        stopRisk = Math.max(0, (current - stop) * quantity * fx);
        stopBreached = current <= stop;
      }
    }
    const thesis = thesisByTrade(row.trade_id);
    return {
      ...row,
      trade,
      thesis,
      name: row.name || trade?.name || 'Depotposition',
      symbol: row.symbol || trade?.symbol || trade?.marketSymbol || '',
      currency: String(row.currency || trade?.currency || 'EUR').toUpperCase(),
      direction,
      quantity,
      fx,
      entry,
      current,
      invested,
      marketValue,
      pnl,
      pnlPct,
      stop,
      stopRisk,
      stopBreached,
      sector: row.sector || thesis?.sector || 'Nicht zugeordnet',
      region: row.region || thesis?.region || 'Nicht zugeordnet',
      priceAt: row.current_price_at || currentTradePriceAt(trade)
    };
  }

  function metrics() {
    const valid = state.positions.filter(position => position.marketValue !== null);
    const invested = state.positions.reduce((sum, position) => sum + position.invested, 0);
    const marketValue = valid.reduce((sum, position) => sum + position.marketValue, 0);
    const pnl = state.positions.reduce((sum, position) => sum + (position.pnl || 0), 0);
    const stopRisk = state.positions.reduce((sum, position) => sum + (position.stopRisk || 0), 0);
    const cash = num(state.preferences?.cash_value, 0);
    const totalValue = marketValue + cash;
    return {invested, marketValue, pnl, pnlPct: invested > 0 ? pnl / invested * 100 : null, stopRisk, cash, totalValue, count:state.positions.length};
  }

  function groupPositions(key) {
    const total = state.positions.reduce((sum, position) => sum + (position.marketValue || 0), 0);
    const map = new Map();
    state.positions.forEach(position => {
      const label = position[key] || 'Nicht zugeordnet';
      map.set(label, (map.get(label) || 0) + (position.marketValue || 0));
    });
    return [...map.entries()].map(([label, value]) => ({label, value, pct:total > 0 ? value / total * 100 : 0})).sort((a,b) => b.value - a.value);
  }

  function newsMatchesPosition(news, position) {
    const wanted = new Set([
      ...normalizeTokens(position.symbol),
      ...normalizeTokens(position.trade?.marketSymbol),
      ...normalizeTokens(position.trade?.symbol)
    ]);
    if ((news.symbols || []).some(symbol => normalizeTokens(symbol).some(token => wanted.has(token)))) return true;
    const hay = `${news.title || ''} ${news.summary || ''} ${news.content || ''}`.toLowerCase();
    return String(position.name || '').length > 3 && hay.includes(String(position.name).toLowerCase());
  }

  function newsStats(position, days = 30) {
    const cutoff = Date.now() - days * 86400000;
    const rows = state.news.filter(item => {
      const time = new Date(item.published_at || item.created_at || 0).getTime();
      return time >= cutoff && newsMatchesPosition(item, position);
    });
    const positive = rows.filter(item => num(item.sentiment, 0) > .15).length;
    const negative = rows.filter(item => num(item.sentiment, 0) < -.15).length;
    const high = rows.filter(item => String(item.impact || '').toLowerCase() === 'hoch').length;
    const score = rows.reduce((sum, item) => sum + num(item.sentiment, 0), 0);
    return {rows, positive, negative, high, score};
  }

  function weightedTarget(tradeId) {
    const rows = scenariosByTrade(tradeId).filter(row => num(row.target_price) !== null && num(row.probability, 0) > 0);
    const totalProbability = rows.reduce((sum, row) => sum + num(row.probability, 0), 0);
    if (!rows.length || totalProbability <= 0) return null;
    return rows.reduce((sum, row) => sum + num(row.target_price, 0) * num(row.probability, 0), 0) / totalProbability;
  }

  function latestRevision(tradeId) {
    return state.revisions.filter(row => row.trade_id === tradeId).sort((a,b) => String(b.published_at || b.created_at).localeCompare(String(a.published_at || a.created_at)))[0] || null;
  }

  function signalLab() {
    const reviewed = state.outcomes.filter(row => row.manual_result && row.manual_result !== 'offen');
    const hits = reviewed.filter(row => row.manual_result === 'bestätigt').length;
    const returns = period => state.outcomes.map(row => num(row[period])).filter(value => value !== null);
    const average = values => values.length ? values.reduce((a,b) => a+b, 0) / values.length : null;
    return {
      total: state.outcomes.length,
      reviewed: reviewed.length,
      hitRate: reviewed.length ? hits / reviewed.length * 100 : null,
      avg1d: average(returns('return_1d')),
      avg5d: average(returns('return_5d')),
      avg20d: average(returns('return_20d'))
    };
  }

  function upcomingEvents() {
    return state.events
      .map(event => ({...event, days:daysUntil(event.event_at)}))
      .filter(event => event.days !== null && event.days >= -1 && event.days <= 90)
      .sort((a,b) => new Date(a.event_at) - new Date(b.event_at));
  }

  function recommendations() {
    const result = [];
    const m = metrics();
    const maxSingle = num(state.preferences?.max_single_weight_pct, 20);
    const maxSector = num(state.preferences?.max_sector_weight_pct, 35);
    const positionsByValue = [...state.positions].sort((a,b) => (b.marketValue || 0) - (a.marketValue || 0));
    positionsByValue.forEach(position => {
      const weight = m.marketValue > 0 ? (position.marketValue || 0) / m.marketValue * 100 : 0;
      if (weight > maxSingle) result.push({severity:'bad', score:95, title:`Konzentration ${position.name}`, detail:`${pct(weight)} Depotgewicht überschreitet den Grenzwert von ${pct(maxSingle)}.`, action:'Neukäufe oder Teilreduktion im Portfoliokontext prüfen.', tradeId:position.trade_id});
      if (position.stopBreached) result.push({severity:'bad', score:100, title:`Stop verletzt: ${position.name}`, detail:`Aktueller Kurs ${fmt(position.current)} gegenüber Stop ${fmt(position.stop)}.`, action:'Position und Invalidation sofort prüfen.', tradeId:position.trade_id});
      if (position.current === null) result.push({severity:'bad', score:90, title:`Kurs fehlt: ${position.name}`, detail:'Weder manueller Depotkurs noch verknüpfter Analysepreis verfügbar.', action:'Kursquelle oder Symbolzuordnung korrigieren.', tradeId:position.trade_id});
      else if (ageHours(position.priceAt) !== null && ageHours(position.priceAt) > 24) result.push({severity:'warn', score:72, title:`Kurs veraltet: ${position.name}`, detail:`Letzte Kurszeit ${dateText(position.priceAt, true)}.`, action:'Vor einer Entscheidung Kursdaten aktualisieren.', tradeId:position.trade_id});
      if (position.stop === null) result.push({severity:'warn', score:62, title:`Kein Stop: ${position.name}`, detail:'Für die gehaltene Position ist kein Stop-/Risikopreis hinterlegt.', action:'Risikogrenze in der Depotposition ergänzen.', tradeId:position.trade_id});
      const news = newsStats(position, 30);
      if (news.negative >= 2 && news.negative > news.positive) result.push({severity:'warn', score:65 + Math.min(20, news.negative * 3), title:`Negativer News-Überhang: ${position.name}`, detail:`${news.negative} negative gegenüber ${news.positive} positiven Meldungen in 30 Tagen.`, action:'Investmentthese gegen die neuen Informationen prüfen.', tradeId:position.trade_id});
      if (!position.thesis?.core_thesis) result.push({severity:'neutral', score:45, title:`These unvollständig: ${position.name}`, detail:'Keine strukturierte Kernthese hinterlegt.', action:'These, Katalysatoren, Risiken und Invalidation dokumentieren.', tradeId:position.trade_id});
      const expected = weightedTarget(position.trade_id);
      if (expected !== null && position.current !== null) {
        const upside = position.direction.toLowerCase() === 'short' ? (position.current - expected) / position.current * 100 : (expected - position.current) / position.current * 100;
        if (upside < 0) result.push({severity:'warn', score:68, title:`Szenariowert unter Kurs: ${position.name}`, detail:`Wahrscheinlichkeitsgewichteter Zielwert ${fmt(expected)} entspricht ${pct(upside)} Potenzial.`, action:'Szenarien oder Positionsgröße überprüfen.', tradeId:position.trade_id});
      }
    });
    groupPositions('sector').forEach(group => {
      if (group.pct > maxSector) result.push({severity:'bad', score:92, title:`Sektorkonzentration ${group.label}`, detail:`${pct(group.pct)} gegenüber Grenzwert ${pct(maxSector)}.`, action:'Diversifikation und Korrelation der Positionen prüfen.'});
    });
    upcomingEvents().filter(event => event.days >= 0 && event.days <= 7 && !String(event.prep_notes || '').trim()).forEach(event => {
      result.push({severity:'warn', score:78 - event.days, title:`Ereignis ohne Vorbereitung: ${event.title}`, detail:`In ${event.days === 0 ? 'weniger als einem Tag' : `${event.days} Tagen`} · ${event.event_type || 'Ereignis'}.`, action:'Erwartung, Risiken und Handlungsplan ergänzen.', tradeId:event.trade_id});
    });
    if (!state.positions.length) result.push({severity:'neutral', score:40, title:'Keine offenen Depotpositionen', detail:'Portfolio Intelligence wertet ausschließlich tatsächliche Depotpositionen aus.', action:'Positionen unter Entscheidungszentrale → Portfolio & KO erfassen.'});
    return result.sort((a,b) => b.score - a.score);
  }

  function lineChart(rows) {
    if (!rows.length) return '<div class="analytics-empty">Noch keine Portfolio-Snapshots. Über „Snapshot speichern“ wird der aktuelle Stand in der Cloud abgelegt.</div>';
    const ordered = [...rows].sort((a,b) => new Date(a.captured_at) - new Date(b.captured_at)).slice(-60);
    const values = ordered.map(row => num(row.total_value, num(row.market_value, 0) + num(row.cash_value, 0)));
    const min = Math.min(...values), max = Math.max(...values);
    const spread = max - min || Math.max(1, Math.abs(max) * .02);
    const width = 820, height = 250, padX = 44, padY = 25;
    const points = values.map((value, index) => {
      const x = padX + (ordered.length === 1 ? (width - padX * 2) / 2 : index / (ordered.length - 1) * (width - padX * 2));
      const y = height - padY - (value - min) / spread * (height - padY * 2);
      return {x,y,value,row:ordered[index]};
    });
    const polyline = points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    const area = `${padX},${height-padY} ${polyline} ${width-padX},${height-padY}`;
    const last = points.at(-1);
    return `<svg class="analytics-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Portfolioentwicklung aus gespeicherten Snapshots">
      <defs><linearGradient id="v28Area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#42d6c3" stop-opacity=".28"/><stop offset="100%" stop-color="#42d6c3" stop-opacity="0"/></linearGradient></defs>
      <line x1="${padX}" y1="${padY}" x2="${padX}" y2="${height-padY}" class="chart-axis"/><line x1="${padX}" y1="${height-padY}" x2="${width-padX}" y2="${height-padY}" class="chart-axis"/>
      <polygon points="${area}" fill="url(#v28Area)"/><polyline points="${polyline}" class="chart-line"/>
      ${points.map((point,index) => index === points.length - 1 || index === 0 ? `<circle cx="${point.x}" cy="${point.y}" r="4" class="chart-dot"><title>${escapeHtml(dateText(point.row.captured_at,true))}: ${escapeHtml(money(point.value))}</title></circle>` : '').join('')}
      <text x="${padX}" y="17" class="chart-label">${escapeHtml(money(max))}</text><text x="${padX}" y="${height-5}" class="chart-label">${escapeHtml(money(min))}</text>
      <text x="${last.x}" y="${Math.max(18,last.y-10)}" text-anchor="end" class="chart-value">${escapeHtml(money(last.value))}</text>
    </svg>`;
  }

  function donut(groups) {
    if (!groups.length) return '<div class="analytics-empty">Noch keine auswertbaren Positionswerte.</div>';
    const palette = ['#42d6c3','#4f8cff','#d6a84b','#9d7cff','#ff7b8a','#5bbf7a','#7e93a7'];
    let start = 0;
    const stops = groups.slice(0,7).map((group,index) => {
      const end = start + group.pct;
      const stop = `${palette[index % palette.length]} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
      start = end;
      return stop;
    });
    return `<div class="analytics-donut-wrap"><div class="analytics-donut" style="background:conic-gradient(${stops.join(',')})"><div><strong>${groups.length}</strong><span>Sektoren</span></div></div><div class="analytics-legend">${groups.slice(0,7).map((group,index)=>`<div><i style="background:${palette[index%palette.length]}"></i><span>${escapeHtml(group.label)}</span><b>${pct(group.pct)}</b></div>`).join('')}</div></div>`;
  }

  function positionBars() {
    const max = Math.max(1, ...state.positions.map(position => Math.max(position.invested, position.marketValue || 0)));
    if (!state.positions.length) return '<div class="analytics-empty">Keine offenen Depotpositionen.</div>';
    return `<div class="position-bars">${[...state.positions].sort((a,b)=>(b.marketValue||0)-(a.marketValue||0)).map(position => {
      const investedWidth = position.invested / max * 100;
      const marketWidth = (position.marketValue || 0) / max * 100;
      return `<button class="position-bar-row" data-analytics-trade="${escapeHtml(position.trade_id || '')}"><div class="position-bar-label"><strong>${escapeHtml(position.name)}</strong><span>${escapeHtml(position.symbol || position.currency)}</span></div><div class="position-bar-track"><span class="bar-invested" style="width:${investedWidth.toFixed(2)}%"></span><span class="bar-current ${position.pnl < 0 ? 'negative' : ''}" style="width:${marketWidth.toFixed(2)}%"></span></div><div class="position-bar-values"><span>${money(position.marketValue)}</span><b class="${position.pnl < 0 ? 'negative-text' : 'positive-text'}">${pct(position.pnlPct)}</b></div></button>`;
    }).join('')}<div class="bar-legend"><span><i class="invested"></i>Investiert</span><span><i class="current"></i>Aktueller Wert</span></div></div>`;
  }

  function heatmap() {
    const total = metrics().marketValue;
    if (!state.positions.length) return '<div class="analytics-empty">Keine Positionen für die Risikomatrix.</div>';
    return `<div class="risk-heatmap">${[...state.positions].sort((a,b)=>(b.marketValue||0)-(a.marketValue||0)).map(position => {
      const weight = total > 0 ? (position.marketValue || 0) / total * 100 : 0;
      const news = newsStats(position, 30);
      const severity = position.stopBreached || weight > 25 ? 'bad' : weight > 20 || position.stop === null || news.negative > news.positive + 1 ? 'warn' : 'good';
      return `<button class="heat-cell ${severity}" style="--cell-size:${Math.max(1,weight).toFixed(2)}" data-analytics-trade="${escapeHtml(position.trade_id || '')}"><strong>${escapeHtml(position.name)}</strong><span>${pct(weight)} Gewicht</span><span class="${position.pnl < 0 ? 'negative-text' : 'positive-text'}">${pct(position.pnlPct)} P/L</span><span>${position.stopRisk === null ? 'Risiko —' : `Stop-Risiko ${money(position.stopRisk)}`}</span><span>News ${news.positive}+/ ${news.negative}−</span></button>`;
    }).join('')}</div>`;
  }

  function eventRadar() {
    const events = upcomingEvents();
    if (!events.length) return '<div class="analytics-empty">Keine Ereignisse in den nächsten 90 Tagen.</div>';
    return `<div class="event-radar">${events.slice(0,12).map(event => {
      const urgent = event.days <= 7 ? 'urgent' : event.days <= 30 ? 'soon' : '';
      return `<div class="event-radar-row ${urgent}"><div class="event-day"><strong>${event.days === 0 ? 'HEUTE' : event.days === 1 ? '1 TAG' : `${event.days} TAGE`}</strong><span>${dateText(event.event_at)}</span></div><div><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(event.event_type || 'Ereignis')} · ${escapeHtml(event.importance || 'mittel')}</span>${event.prep_notes ? `<small>${escapeHtml(event.prep_notes)}</small>` : '<small class="negative-text">Vorbereitung fehlt</small>'}</div></div>`;
    }).join('')}</div>`;
  }

  function newsMatrix() {
    if (!state.positions.length) return '<div class="analytics-empty">Keine Depotpositionen für die News-Matrix.</div>';
    return `<div class="table-shell-v28"><table><thead><tr><th>Instrument</th><th>30 Tage</th><th>Positiv</th><th>Negativ</th><th>Hohe Relevanz</th><th>Tendenz</th></tr></thead><tbody>${state.positions.map(position => {
      const stats = newsStats(position, 30);
      const trend = stats.score > .3 ? 'positiv' : stats.score < -.3 ? 'negativ' : 'neutral';
      return `<tr><td><strong>${escapeHtml(position.name)}</strong><div class="cell-sub">${escapeHtml(position.symbol)}</div></td><td>${stats.rows.length}</td><td class="positive-text">${stats.positive}</td><td class="negative-text">${stats.negative}</td><td>${stats.high}</td><td><span class="chip ${trend === 'positiv' ? 'good' : trend === 'negativ' ? 'bad' : 'neutral'}">${trend}</span></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function scenarioTable() {
    const rows = state.trades.map(trade => {
      const target = weightedTarget(trade.id);
      const current = currentTradePrice(trade);
      if (target === null) return null;
      const direction = String(trade.direction || '').toLowerCase();
      const upside = current ? (direction === 'short' ? (current - target) / current : (target - current) / current) * 100 : null;
      return {trade,target,current,upside,scenarios:scenariosByTrade(trade.id)};
    }).filter(Boolean).sort((a,b)=>(b.upside ?? -999)-(a.upside ?? -999));
    if (!rows.length) return '<div class="analytics-empty">Noch keine Szenario-Zielwerte hinterlegt.</div>';
    return `<div class="table-shell-v28"><table><thead><tr><th>Analyse</th><th>Kurs</th><th>Erwartungswert</th><th>Potenzial</th><th>Wahrscheinlichkeiten</th></tr></thead><tbody>${rows.map(row => `<tr><td><button class="link-button" data-analytics-trade="${escapeHtml(row.trade.id)}">${escapeHtml(row.trade.name)}</button></td><td>${fmt(row.current)}</td><td>${fmt(row.target)}</td><td class="${row.upside < 0 ? 'negative-text' : 'positive-text'}">${pct(row.upside)}</td><td>${row.scenarios.map(s=>`${escapeHtml(s.scenario)} ${fmt(s.probability,0)}%`).join(' · ')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function analystSection() {
    const latestRows = state.trades.map(trade => ({trade, revision:latestRevision(trade.id)})).filter(row => row.revision).sort((a,b)=>String(b.revision.published_at).localeCompare(String(a.revision.published_at)));
    const tradeOptions = state.trades.map(trade => `<option value="${escapeHtml(trade.id)}">${escapeHtml(trade.name)} · ${escapeHtml(trade.symbol || trade.marketSymbol || '')}</option>`).join('');
    return `<div class="analyst-layout"><form class="analyst-form" id="analystRevisionForm"><div><label>Analyse</label><select name="trade_id" required><option value="">Auswählen …</option>${tradeOptions}</select></div><div><label>Institut / Quelle</label><input name="institution" required placeholder="z. B. Goldman Sachs"></div><div><label>Rating neu</label><input name="rating" placeholder="Buy / Hold / Sell"></div><div><label>Rating vorher</label><input name="previous_rating" placeholder="optional"></div><div><label>Kursziel neu</label><input name="target_price" inputmode="decimal" placeholder="0,00"></div><div><label>Kursziel vorher</label><input name="previous_target_price" inputmode="decimal" placeholder="0,00"></div><div><label>Währung</label><input name="currency" value="EUR" maxlength="3"></div><div><label>Datum</label><input name="published_at" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="span-2"><label>Quellenlink</label><input name="source_url" type="url" placeholder="https://…"></div><div class="span-2"><label>Notiz</label><input name="notes" placeholder="Begründung oder Kernaussage"></div><div class="span-4 form-actions"><button class="btn primary" type="submit" ${state.analyticsSchemaReady ? '' : 'disabled'}>Analystenänderung speichern</button>${state.analyticsSchemaReady ? '' : '<span class="negative-text">Zuerst version28-analytics-schema.sql ausführen.</span>'}</div></form><div class="table-shell-v28"><table><thead><tr><th>Datum</th><th>Instrument</th><th>Institut</th><th>Rating</th><th>Kursziel</th><th>Änderung</th><th></th></tr></thead><tbody>${latestRows.length ? latestRows.map(({trade,revision}) => {
      const delta = num(revision.target_price) !== null && num(revision.previous_target_price) !== null ? num(revision.target_price)-num(revision.previous_target_price) : null;
      return `<tr><td>${dateText(revision.published_at)}</td><td><strong>${escapeHtml(trade.name)}</strong></td><td>${escapeHtml(revision.institution)}</td><td>${escapeHtml(revision.previous_rating || '—')} → <strong>${escapeHtml(revision.rating || '—')}</strong></td><td>${revision.target_price === null ? '—' : `${fmt(revision.target_price)} ${escapeHtml(revision.currency || trade.currency || '')}`}</td><td class="${delta < 0 ? 'negative-text' : delta > 0 ? 'positive-text' : ''}">${delta === null ? '—' : `${delta > 0 ? '+' : ''}${fmt(delta)}`}</td><td><button class="btn small danger" data-delete-revision="${escapeHtml(revision.id)}">Löschen</button></td></tr>`;
    }).join('') : '<tr><td colspan="7" class="empty-table">Noch keine Analystenänderungen erfasst.</td></tr>'}</tbody></table></div></div>`;
  }

  function render() {
    const m = metrics();
    const sectors = groupPositions('sector');
    const regions = groupPositions('region');
    const lab = signalLab();
    const recs = recommendations();
    content.innerHTML = `<section class="analytics-kpis">
      <div class="card analytics-kpi"><span>Portfoliowert</span><strong>${money(m.marketValue)}</strong><small>${m.count} offene Positionen</small></div>
      <div class="card analytics-kpi"><span>Unrealisierter P/L</span><strong class="${m.pnl < 0 ? 'negative-text' : 'positive-text'}">${money(m.pnl)}</strong><small>${pct(m.pnlPct)}</small></div>
      <div class="card analytics-kpi"><span>Risiko bis Stop</span><strong>${money(m.stopRisk)}</strong><small>${m.marketValue > 0 ? pct(m.stopRisk / m.marketValue * 100) : '—'} des Depotwerts</small></div>
      <div class="card analytics-kpi"><span>News-Risiken</span><strong>${recs.filter(item=>/News|Negativer/.test(item.title)).length}</strong><small>regelbasierte Hinweise</small></div>
      <div class="card analytics-kpi"><span>Signalqualität</span><strong>${pct(lab.hitRate)}</strong><small>${lab.reviewed} bewertete Signale</small></div>
    </section>
    <section class="analytics-grid">
      <article class="card analytics-panel span-8"><div class="analytics-panel-head"><div><h3>Portfolioentwicklung</h3><p>Historie aus gespeicherten Cloud-Snapshots</p></div><span class="chip neutral">${state.snapshots.length} Snapshots</span></div>${lineChart(state.snapshots)}</article>
      <article class="card analytics-panel span-4"><div class="analytics-panel-head"><div><h3>Sektorallokation</h3><p>Aktueller Marktwert in EUR</p></div></div>${donut(sectors)}</article>
      <article class="card analytics-panel span-7"><div class="analytics-panel-head"><div><h3>Investiert vs. aktueller Wert</h3><p>Depotpositionen, nicht geplante Trade-Setups</p></div></div>${positionBars()}</article>
      <article class="card analytics-panel span-5"><div class="analytics-panel-head"><div><h3>Portfolio-Check</h3><p>Priorisierte, regelbasierte nächste Schritte</p></div><span class="chip ${recs.some(r=>r.severity==='bad')?'bad':recs.some(r=>r.severity==='warn')?'warn':'good'}">${recs.length} Hinweise</span></div><div class="recommendation-list">${recs.slice(0,8).map(item=>`<button class="recommendation ${item.severity}" ${item.tradeId ? `data-analytics-trade="${escapeHtml(item.tradeId)}"` : ''}><span class="recommendation-score">${item.score}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p><small>${escapeHtml(item.action)}</small></div></button>`).join('') || '<div class="analytics-empty">Keine regelbasierten Warnungen.</div>'}</div></article>
      <article class="card analytics-panel span-12"><div class="analytics-panel-head"><div><h3>Risiko-Heatmap</h3><p>Gewicht, P/L, Stop-Risiko und News-Lage pro Position</p></div></div>${heatmap()}</article>
      <article class="card analytics-panel span-6"><div class="analytics-panel-head"><div><h3>Ereignis- und Earnings-Radar</h3><p>Bestehender Ereigniskalender, nächste 90 Tage</p></div><button class="btn small" id="openEventsBtn">Ereignisse öffnen</button></div>${eventRadar()}</article>
      <article class="card analytics-panel span-6"><div class="analytics-panel-head"><div><h3>News-Impact-Matrix</h3><p>Portfolio-Meldungen der letzten 30 Tage</p></div><button class="btn small" id="openNewsBtn">News öffnen</button></div>${newsMatrix()}</article>
      <article class="card analytics-panel span-7"><div class="analytics-panel-head"><div><h3>Szenario-Bewertung</h3><p>Wahrscheinlichkeitsgewichtete Zielwerte</p></div></div>${scenarioTable()}</article>
      <article class="card analytics-panel span-5"><div class="analytics-panel-head"><div><h3>Signal-Labor</h3><p>Historische Auswertung gespeicherter Signale</p></div></div><div class="signal-lab-grid"><div><span>Trefferquote</span><strong>${pct(lab.hitRate)}</strong></div><div><span>Ø 1 Tag</span><strong class="${lab.avg1d < 0 ? 'negative-text':'positive-text'}">${pct(lab.avg1d)}</strong></div><div><span>Ø 5 Tage</span><strong class="${lab.avg5d < 0 ? 'negative-text':'positive-text'}">${pct(lab.avg5d)}</strong></div><div><span>Ø 20 Tage</span><strong class="${lab.avg20d < 0 ? 'negative-text':'positive-text'}">${pct(lab.avg20d)}</strong></div></div><p class="analytics-note">Die Kennzahlen basieren auf <strong>${lab.total}</strong> Outcome-Datensätzen. Leere Zeiträume werden nicht hochgerechnet.</p></article>
      <article class="card analytics-panel span-12"><div class="analytics-panel-head"><div><h3>Analysten-Revisionen</h3><p>Rating- und Kurszielhistorie je Analyse</p></div><span class="chip ${state.analyticsSchemaReady?'good':'warn'}">${state.analyticsSchemaReady?'Cloud aktiv':'Schema fehlt'}</span></div>${analystSection()}</article>
      <article class="card analytics-panel span-6"><div class="analytics-panel-head"><div><h3>Regionen</h3><p>Aktuelle Exponierung</p></div></div><div class="exposure-list-v28">${regions.map(group=>`<div><span>${escapeHtml(group.label)}</span><div><i style="width:${group.pct.toFixed(2)}%"></i></div><b>${pct(group.pct)}</b></div>`).join('') || '<div class="analytics-empty">Keine Regionen zugeordnet.</div>'}</div></article>
      <article class="card analytics-panel span-6"><div class="analytics-panel-head"><div><h3>Datenqualität</h3><p>Quellen und Installationsstand</p></div></div><div class="quality-list"><div><span>Depotpositionen</span><b class="${state.positions.length?'positive-text':'negative-text'}">${state.positions.length}</b></div><div><span>Analysen</span><b>${state.trades.length}</b></div><div><span>News</span><b>${state.news.length}</b></div><div><span>Ereignisse</span><b>${state.events.length}</b></div><div><span>Analystenrevisionen</span><b>${state.revisions.length}</b></div><div><span>Letzte Aktualisierung</span><b>${dateText(state.lastLoadedAt,true)}</b></div></div>${state.errors.length ? `<details class="analytics-errors"><summary>${state.errors.length} Tabellenhinweis(e)</summary>${state.errors.map(error=>`<p>${escapeHtml(error)}</p>`).join('')}</details>` : ''}</article>
    </section>`;

    $$('[data-analytics-trade]', content).forEach(button => button.addEventListener('click', () => openTrade(button.dataset.analyticsTrade)));
    $('#openEventsBtn')?.addEventListener('click', () => { window.InvestitionDecision?.setTab?.('events'); window.InvestitionNavigation?.showPage?.('decision'); });
    $('#openNewsBtn')?.addEventListener('click', () => window.InvestitionNavigation?.showPage?.('news'));
    $('#analystRevisionForm')?.addEventListener('submit', saveRevision);
    $$('[data-delete-revision]', content).forEach(button => button.addEventListener('click', () => deleteRevision(button.dataset.deleteRevision)));
  }

  function openTrade(tradeId) {
    if (!tradeId) return;
    const result = dashboard()?.selectTradeById?.(tradeId);
    if (result?.ok) window.InvestitionNavigation?.showPage?.('trading');
  }

  async function saveRevision(event) {
    event.preventDefault();
    if (!state.sb || !state.session) { setStatus('Bitte zuerst anmelden.', 'bad'); return; }
    const form = new FormData(event.currentTarget);
    const row = {
      user_id: state.session.user.id,
      trade_id: form.get('trade_id'),
      institution: String(form.get('institution') || '').trim(),
      rating: String(form.get('rating') || '').trim() || null,
      previous_rating: String(form.get('previous_rating') || '').trim() || null,
      target_price: num(form.get('target_price')),
      previous_target_price: num(form.get('previous_target_price')),
      currency: String(form.get('currency') || 'EUR').trim().toUpperCase(),
      published_at: form.get('published_at') || new Date().toISOString().slice(0,10),
      source_url: String(form.get('source_url') || '').trim() || null,
      notes: String(form.get('notes') || '').trim()
    };
    const {error} = await state.sb.from('analyst_revisions').insert(row);
    if (error) { setStatus(`Analystenänderung nicht gespeichert: ${error.message}`, 'bad'); return; }
    setStatus('Analystenänderung gespeichert.', 'good');
    await load();
  }

  async function deleteRevision(id) {
    if (!state.sb || !state.session || !id) return;
    if (!confirm('Diese Analystenänderung löschen?')) return;
    const {error} = await state.sb.from('analyst_revisions').delete().eq('id', id).eq('user_id', state.session.user.id);
    if (error) { setStatus(`Löschen fehlgeschlagen: ${error.message}`, 'bad'); return; }
    setStatus('Analystenänderung gelöscht.', 'good');
    await load();
  }

  async function saveSnapshot() {
    if (!state.sb || !state.session) { setStatus('Bitte zuerst anmelden.', 'bad'); return; }
    if (!state.analyticsSchemaReady) { setStatus('Zuerst version28-analytics-schema.sql im Supabase SQL Editor ausführen.', 'bad'); return; }
    const m = metrics();
    const payload = {
      user_id: state.session.user.id,
      captured_at: new Date().toISOString(),
      invested_value: m.invested,
      market_value: m.marketValue,
      total_value: m.totalValue,
      unrealized_pnl: m.pnl,
      stop_risk: m.stopRisk,
      cash_value: m.cash,
      position_count: m.count,
      positions: state.positions.map(position => ({id:position.id, trade_id:position.trade_id, name:position.name, market_value:position.marketValue, invested:position.invested, pnl:position.pnl, sector:position.sector, region:position.region}))
    };
    snapshotBtn.disabled = true;
    const {error} = await state.sb.from('portfolio_snapshots').insert(payload);
    snapshotBtn.disabled = false;
    if (error) { setStatus(`Snapshot nicht gespeichert: ${error.message}`, 'bad'); return; }
    setStatus(`Portfolio-Snapshot gespeichert · ${money(m.totalValue)}.`, 'good');
    await load();
  }

  async function load() {
    if (state.loading) return;
    state.loading = true;
    refreshBtn && (refreshBtn.disabled = true);
    snapshotBtn && (snapshotBtn.disabled = true);
    setStatus('Portfolio Intelligence wird aktualisiert …');
    state.sb = dashboard()?.getSupabase?.() || state.sb;
    state.session = dashboard()?.getSession?.() || null;
    state.trades = dashboard()?.getTrades?.() || [];
    state.errors = [];
    state.analyticsSchemaReady = true;
    if (!state.sb || !state.session) {
      state.loading = false;
      refreshBtn && (refreshBtn.disabled = false);
      setStatus('Keine aktive Cloud-Sitzung.', 'bad');
      render();
      return;
    }
    const uid = state.session.user.id;
    const [positions, theses, scenarios, events, news, outcomes, revisions, snapshots, preferences] = await Promise.all([
      safeSelect('depot_positions', query => query.select('*').eq('user_id', uid).eq('is_open', true).order('updated_at', {ascending:false}), []),
      safeSelect('investment_theses', query => query.select('*').eq('user_id', uid), []),
      safeSelect('valuation_scenarios', query => query.select('*').eq('user_id', uid), []),
      safeSelect('market_events', query => query.select('*').eq('user_id', uid).order('event_at', {ascending:true}), []),
      safeSelect('market_news', query => query.select('*').eq('is_published', true).order('published_at', {ascending:false}).limit(500), []),
      safeSelect('signal_outcomes', query => query.select('*').eq('user_id', uid), []),
      safeSelect('analyst_revisions', query => query.select('*').eq('user_id', uid).order('published_at', {ascending:false}).limit(300), [], true),
      safeSelect('portfolio_snapshots', query => query.select('*').eq('user_id', uid).order('captured_at', {ascending:true}).limit(500), [], true),
      safeSelect('notification_policies', query => query.select('*').eq('user_id', uid).maybeSingle(), null)
    ]);
    state.theses = Array.isArray(theses) ? theses : [];
    state.scenarios = Array.isArray(scenarios) ? scenarios : [];
    state.events = Array.isArray(events) ? events : [];
    state.news = Array.isArray(news) ? news : [];
    state.outcomes = Array.isArray(outcomes) ? outcomes : [];
    state.revisions = Array.isArray(revisions) ? revisions : [];
    state.snapshots = Array.isArray(snapshots) ? snapshots : [];
    state.preferences = preferences && !Array.isArray(preferences) ? preferences : null;
    state.positions = (Array.isArray(positions) ? positions : []).map(normalizePosition);
    state.lastLoadedAt = new Date().toISOString();
    state.loading = false;
    refreshBtn && (refreshBtn.disabled = false);
    snapshotBtn && (snapshotBtn.disabled = false);
    const schemaNote = state.analyticsSchemaReady ? '' : ' · V28-Schema noch nicht vollständig installiert';
    setStatus(`${state.positions.length} Depotpositionen · ${state.news.length} News · ${state.events.length} Ereignisse geladen${schemaNote}.`, state.errors.length ? 'warn' : 'good');
    render();
  }

  refreshBtn?.addEventListener('click', load);
  snapshotBtn?.addEventListener('click', saveSnapshot);
  window.addEventListener('investition:analytics-visible', () => load());
  window.addEventListener('investition:data-changed', () => { if (!page.hidden) load(); });
  window.addEventListener('investition:auth-changed', () => setTimeout(() => { if (!page.hidden) load(); }, 100));
  window.addEventListener('investition:news-changed', () => { if (!page.hidden) load(); });
  window.InvestitionAnalytics = {refresh:load, getState:() => ({...state, positions:state.positions.map(position => ({...position}))})};
  render();
  if (!page.hidden) setTimeout(load, 0);
})();
