(() => {
  const VERSION = '29.2';
  const SUPABASE_URL = 'https://pzhfybtoyfttftgcrcxk.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_yGiDH_M0fUZglk40fCk7cQ_kkL1XKzj';
  const READ_KEY = 'investition-news-read-v29';
  const $ = (query, element = document) => element.querySelector(query);
  const $$ = (query, element = document) => [...element.querySelectorAll(query)];
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[character]));
  const safeUrl = value => {
    try {
      const url = new URL(String(value));
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  };
  const dashboardApi = window.InvestitionDashboard || {};
  const sharedClient = typeof dashboardApi.getSupabase === 'function'
    ? dashboardApi.getSupabase()
    : null;
  const sb = sharedClient || window.supabase?.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {auth:{persistSession:false, autoRefreshToken:true, detectSessionInUrl:true}}
  );

  const els = {
    tradingPage: $('#tradingPage'),
    decisionPage: $('#decisionPage'),
    analyticsPage: $('#analyticsPage'),
    newsPage: $('#newsPage'),
    navTrading: $('#navTradingBtn'),
    navDecision: $('#navDecisionBtn'),
    navAnalytics: $('#navAnalyticsBtn'),
    navNews: $('#navNewsBtn'),
    list: $('#newsList'),
    detail: $('#newsDetail'),
    detailCard: $('#newsDetailCard'),
    count: $('#newsCountChip'),
    lastUpdated: $('#newsLastUpdated'),
    search: $('#newsSearchInput'),
    scope: $('#newsScopeFilter'),
    topic: $('#newsTopicFilter'),
    impact: $('#newsImpactFilter'),
    pricing: $('#newsPricingFilter'),
    read: $('#newsReadFilter'),
    sync: $('#newsSyncBtn'),
    importBtn: $('#newsImportBtn'),
    importFile: $('#newsImportFile'),
    status: $('#newsStatus'),
    markAll: $('#markAllReadBtn'),
    cloudHealth: $('#newsCloudHealth'),
    tableHealth: $('#newsTableHealth'),
    functionHealth: $('#newsFunctionHealth'),
    providerHealth: $('#newsProviderHealth'),
    assessmentHealth: $('#newsAssessmentHealth'),
    priorityStrip: $('#newsPriorityStrip'),
    portfolioCount: $('#portfolioNewsCount'),
    watchlistCount: $('#watchlistNewsCount'),
    sectorCount: $('#sectorNewsCount'),
    marketCount: $('#marketNewsCount')
  };
  if (!els.newsPage) return;

  let items = [];
  let selectedId = null;
  let session = typeof dashboardApi.getSession === 'function'
    ? dashboardApi.getSession()
    : null;
  let realtimeChannel = null;
  let syncHealthTimer = null;
  let readIds = loadReadIds();
  let portfolio = [];
  let watchlist = [];
  let analystRevisions = [];

  function loadReadIds() {
    try {
      const parsed = JSON.parse(localStorage.getItem(READ_KEY) || '[]');
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  function saveReadIds() {
    try {
      localStorage.setItem(READ_KEY, JSON.stringify([...readIds]));
    } catch {}
  }

  function getActiveSession() {
    if (typeof dashboardApi.getSession === 'function') {
      session = dashboardApi.getSession() || null;
    }
    return session;
  }

  async function resolveSession(candidate = null) {
    session = candidate || getActiveSession();
    if (!session && sb) {
      const {data} = await sb.auth.getSession();
      session = data?.session || null;
    }
    return session;
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFKD')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9+/.:-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function symbolTokens(value) {
    const normalized = String(value || '').toUpperCase().replace(/\s+/g, '');
    if (!normalized) return [];
    const result = new Set([normalized]);
    if (normalized.includes(':')) result.add(normalized.split(':').pop());
    if (normalized.includes('.')) result.add(normalized.split('.')[0]);
    return [...result].filter(Boolean);
  }

  function numberOr(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum = 0, maximum = 100) {
    return Math.min(maximum, Math.max(minimum, Math.round(numberOr(value, minimum))));
  }

  function scoreFallback(impact, high, medium, low) {
    return impact === 'hoch' ? high : impact === 'niedrig' ? low : medium;
  }

  function normalize(news) {
    const impact = String(news.impact || 'mittel').toLowerCase();
    let basis = news.analysis_basis;
    if (typeof basis === 'string') {
      try { basis = JSON.parse(basis); } catch { basis = {}; }
    }
    return {
      id: news.id,
      external_id: news.external_id,
      published_at: news.published_at || new Date().toISOString(),
      topic: news.topic || 'Sonstiges',
      title: news.title || 'Ohne Titel',
      summary: news.summary || '',
      content: news.content || news.summary || '',
      source_url: news.source_url || '',
      source_name: news.source_name || 'News',
      symbols: Array.isArray(news.symbols) ? news.symbols : [],
      tags: Array.isArray(news.tags) ? news.tags : [],
      sentiment: numberOr(news.sentiment),
      impact,
      assessment_version: news.assessment_version || 'legacy-v28',
      evaluated_at: news.evaluated_at || null,
      primary_symbol: news.primary_symbol || null,
      event_type: news.event_type || 'general',
      direction: news.direction || 'neutral',
      relevance_score: clamp(
        numberOr(news.relevance_score, scoreFallback(impact, 82, 60, 38))
      ),
      confidence_score: clamp(numberOr(news.confidence_score, 35)),
      impact_score: clamp(
        numberOr(news.impact_score, scoreFallback(impact, 80, 58, 35))
      ),
      urgency_score: clamp(numberOr(news.urgency_score, impact === 'hoch' ? 70 : 40)),
      relevance_reason: news.relevance_reason || '',
      market_impact: news.market_impact || '',
      priced_in_state: news.priced_in_state || 'unklar',
      priced_in: news.priced_in || 'Noch nicht bewertet',
      analyst_view: news.analyst_view || 'Noch nicht bewertet',
      analyst_signal: news.analyst_signal || 'nicht_verfuegbar',
      action_code: news.action_code || 'observe',
      recommended_action: news.recommended_action || '',
      price_reaction_percent: numberOr(news.price_reaction_percent),
      normal_move_percent: numberOr(news.normal_move_percent),
      analyst_target_price: numberOr(news.analyst_target_price),
      analyst_target_upside_percent: numberOr(news.analyst_target_upside_percent),
      analyst_currency: news.analyst_currency || null,
      data_quality: news.data_quality || 'niedrig',
      analysis_basis: basis && typeof basis === 'object' ? basis : {}
    };
  }

  function dateTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value || '—')
      : new Intl.DateTimeFormat('de-DE', {
          dateStyle:'short',
          timeStyle:'short',
          timeZone:'Europe/Berlin'
        }).format(date);
  }

  function dateOnly(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value || '—')
      : new Intl.DateTimeFormat('de-DE', {
          dateStyle:'short',
          timeZone:'Europe/Berlin'
        }).format(date);
  }

  function formatNumber(value, digits = 1) {
    const parsed = numberOr(value);
    if (parsed === null) return '—';
    return new Intl.NumberFormat('de-DE', {maximumFractionDigits:digits}).format(parsed);
  }

  function formatPercent(value, digits = 1) {
    const parsed = numberOr(value);
    if (parsed === null) return '—';
    return `${parsed > 0 ? '+' : ''}${formatNumber(parsed, digits)} %`;
  }

  function setStatus(text, type = '') {
    els.status.textContent = text;
    els.status.className = `news-status ${type}`;
  }

  function setHealth(element, value, type = '') {
    if (!element) return;
    element.className = `news-health-item ${type}`;
    const target = $('.value', element);
    if (target) target.textContent = value;
  }

  function explainFunctionError(value) {
    const detail = String(value || 'Unbekannter Fehler').trim();
    if (/abort|timeout|zeitüberschreitung/i.test(detail)) {
      return 'Sync dauerte zu lange. Erneut versuchen; bei vielen RSS-Suchen die Function-Logs prüfen.';
    }
    if (/failed to fetch|failed to send|functionsfetcherror|fetch failed|load failed|networkerror/i.test(detail)) {
      return 'Sync-Function nicht erreichbar. V29.2-Function deployen und Browser-/CORS-Verbindung prüfen.';
    }
    if (/not found|404/i.test(detail)) {
      return 'Edge Function „sync-news“ ist nicht deployt oder falsch benannt.';
    }
    if (/unauthorized|401|invalid jwt/i.test(detail)) {
      return 'Anmeldung für die Sync-Function abgelehnt. Bitte neu anmelden und erneut versuchen.';
    }
    if (/keine rss-news|google news rss|bing news rss/i.test(detail)) {
      return 'Die kostenlosen RSS-Quellen lieferten vorübergehend keine Meldungen. Der vorhandene Feed bleibt erhalten; später erneut versuchen.';
    }
    if (/assessment_version|relevance_score|priced_in_state|version29-market-intelligence-schema/i.test(detail)) {
      return 'V29-Bewertungsschema fehlt. version29-market-intelligence-schema.sql im Supabase SQL Editor ausführen.';
    }
    if (/hybrid_market_cache|hybrid_api_usage|reserve_hybrid_eodhd_calls|version29-2-hybrid-schema/i.test(detail)) {
      return 'V29.2-Hybrid-Schema fehlt. version29-2-hybrid-schema.sql im Supabase SQL Editor ausführen.';
    }
    return detail;
  }

  function impactClass(value) {
    return value === 'hoch' ? 'bad' : value === 'niedrig' ? 'neutral' : 'warn';
  }

  function scoreClass(value) {
    const score = numberOr(value, 0);
    return score >= 78 ? 'bad' : score >= 55 ? 'warn' : 'neutral';
  }

  function qualityClass(value) {
    return value === 'hoch' ? 'good' : value === 'mittel' ? 'warn' : 'neutral';
  }

  function directionClass(value) {
    return value === 'positiv' ? 'good' : value === 'negativ' ? 'bad' : 'neutral';
  }

  function scopeLabel(scope, long = false) {
    const labels = long
      ? {portfolio:'Portfolio-News', watchlist:'Watchlist-News', sector:'Branchen-News', market:'Markt-News'}
      : {portfolio:'Portfolio', watchlist:'Watchlist', sector:'Branche', market:'Markt'};
    return labels[scope] || labels.market;
  }

  function pricingLabel(value) {
    return {
      weitgehend:'weitgehend',
      teilweise:'teilweise',
      eher_nicht:'eher nicht',
      zu_frueh:'noch zu früh',
      unklar:'nicht messbar'
    }[value] || 'nicht messbar';
  }

  function eventLabel(value) {
    return {
      insolvency:'Insolvenz / Ausfall',
      guidance:'Guidance',
      earnings:'Ergebnis',
      capital:'Kapitalmaßnahme',
      ma:'M&A',
      regulatory:'Regulierung / Recht',
      analyst:'Analystenrevision',
      contract:'Auftrag / Partnerschaft',
      product:'Produkt / Produktion',
      macro:'Makro / Geldpolitik',
      fx:'Währung / EUR-USD',
      general:'Allgemeine Meldung'
    }[value] || value || 'Allgemeine Meldung';
  }

  function referenceAliases(reference) {
    const values = [
      reference.name,
      reference.symbol,
      reference.market_symbol,
      reference.isin,
      reference.wkn
    ].filter(Boolean);
    const aliases = new Set();
    for (const value of values) {
      const normalized = normalizeText(value);
      if (normalized.length >= 3) aliases.add(normalized);
      for (const token of normalized.split(/[\s.:/]+/)) {
        if (token.length >= 4) aliases.add(token);
      }
    }
    return [...aliases];
  }

  function matchesReference(news, reference) {
    const wanted = new Set([
      ...symbolTokens(reference.symbol),
      ...symbolTokens(reference.market_symbol)
    ]);
    if (
      news.symbols.some(symbol =>
        symbolTokens(symbol).some(token => wanted.has(token))
      )
    ) {
      return true;
    }
    const haystack = normalizeText(`${news.title} ${news.summary} ${news.content}`);
    return referenceAliases(reference).some(alias => haystack.includes(alias));
  }

  function classify(news) {
    const held = portfolio.filter(position => matchesReference(news, position));
    if (held.length) return {scope:'portfolio', refs:held};
    const watched = watchlist.filter(position => matchesReference(news, position));
    if (watched.length) return {scope:'watchlist', refs:watched};
    if (['KI', 'Halbleiter', 'Energie', 'Unternehmen'].includes(news.topic)) {
      return {scope:'sector', refs:[]};
    }
    return {scope:'market', refs:[]};
  }

  function personalizedScores(news, scope) {
    const floor = {portfolio:82, watchlist:70, sector:52, market:40}[scope] || 40;
    const relevance = clamp(Math.max(news.relevance_score, floor));
    const confidence = clamp(news.confidence_score);
    const impact = clamp(news.impact_score);
    const urgency = clamp(Math.max(
      news.urgency_score,
      scope === 'portfolio' ? Math.min(95, relevance - 2) : 0
    ));
    return {
      relevance,
      confidence,
      impact,
      urgency,
      stars: Math.max(1, Math.min(5, Math.ceil(relevance / 20)))
    };
  }

  function enriched() {
    return items.map(news => {
      const classification = classify(news);
      const scores = personalizedScores(news, classification.scope);
      return {
        ...news,
        scope:classification.scope,
        refs:classification.refs,
        scores,
        relevance:scores.stars,
        personal_relevance_score:scores.relevance
      };
    });
  }

  function filtered() {
    const query = normalizeText(els.search.value);
    return enriched()
      .sort((left, right) =>
        right.scores.relevance - left.scores.relevance ||
        right.scores.urgency - left.scores.urgency ||
        String(right.published_at).localeCompare(String(left.published_at))
      )
      .filter(news => {
        const haystack = normalizeText([
          news.topic,
          news.event_type,
          news.direction,
          news.title,
          news.summary,
          news.content,
          news.relevance_reason,
          news.market_impact,
          news.priced_in,
          news.analyst_view,
          news.recommended_action,
          news.symbols.join(' '),
          news.tags.join(' '),
          news.refs.map(reference => reference.name).join(' ')
        ].join(' '));
        if (query && !haystack.includes(query)) return false;
        if (els.scope.value && news.scope !== els.scope.value) return false;
        if (els.topic.value && news.topic !== els.topic.value) return false;
        if (els.impact.value && news.impact !== els.impact.value) return false;
        if (els.pricing?.value && news.priced_in_state !== els.pricing.value) return false;
        const read = readIds.has(news.id);
        if (els.read.value === 'read' && !read) return false;
        if (els.read.value === 'unread' && read) return false;
        return true;
      });
  }

  function updateCounts() {
    const all = enriched();
    const count = scope => all.filter(news => news.scope === scope).length;
    els.portfolioCount.textContent = count('portfolio');
    els.watchlistCount.textContent = count('watchlist');
    els.sectorCount.textContent = count('sector');
    els.marketCount.textContent = count('market');
    $$('[data-scope]', els.priorityStrip).forEach(button =>
      button.classList.toggle('active', els.scope.value === button.dataset.scope)
    );
  }

  function renderList() {
    updateCounts();
    const list = filtered();
    els.count.textContent = `${list.length} ${list.length === 1 ? 'Eintrag' : 'Einträge'}`;
    if (!list.length) {
      els.list.innerHTML = '<div class="news-empty">Keine Meldungen für den gewählten Filter. „Feed aktualisieren“ sucht gezielt nach Depot-, Watchlist-, Branchen- und Marktnachrichten.</div>';
      renderDetail(null);
      return;
    }
    if (!list.some(news => news.id === selectedId)) selectedId = list[0].id;
    els.list.innerHTML = list.map(news => `
      <button class="news-item ${news.id === selectedId ? 'selected' : ''} ${readIds.has(news.id) ? '' : 'unread'}" data-news-id="${escapeHtml(news.id)}">
        <div class="news-meta-row">
          <span class="news-scope ${news.scope}">${scopeLabel(news.scope)}</span>
          <span class="news-time">${escapeHtml(dateTime(news.published_at))}</span>
        </div>
        <div class="news-title">${escapeHtml(news.title)}</div>
        <div class="news-summary">${escapeHtml(news.relevance_reason || news.summary || news.content)}</div>
        <div class="news-tags">
          <span class="news-score-pill ${scoreClass(news.scores.relevance)}">R ${news.scores.relevance}</span>
          <span class="chip ${directionClass(news.direction)}">${escapeHtml(news.direction)}</span>
          <span class="chip neutral">eingepreist: ${escapeHtml(pricingLabel(news.priced_in_state))}</span>
          ${news.refs.slice(0, 2).map(reference => `<span class="chip neutral">${escapeHtml(reference.name)}</span>`).join('')}
          ${!news.refs.length ? news.symbols.slice(0, 2).map(symbol => `<span class="chip neutral">${escapeHtml(symbol)}</span>`).join('') : ''}
        </div>
      </button>
    `).join('');
    $$('[data-news-id]', els.list).forEach(button => {
      button.onclick = () => selectItem(button.dataset.newsId);
    });
    renderDetail(list.find(news => news.id === selectedId));
  }

  function latestManualRevision(reference) {
    const tradeId = String(reference.trade_id || reference.id || '');
    return analystRevisions
      .filter(revision => String(revision.trade_id) === tradeId)
      .sort((left, right) =>
        String(right.published_at || right.created_at || '')
          .localeCompare(String(left.published_at || left.created_at || ''))
      )[0] || null;
  }

  function manualAnalystSummary(references) {
    const revisions = references
      .map(reference => ({reference, revision:latestManualRevision(reference)}))
      .filter(item => item.revision);
    if (!revisions.length) return '';
    return revisions.map(({reference, revision}) => {
      const target = numberOr(revision.target_price);
      return `Eigene Revision zu ${reference.name}: ${revision.institution || 'Quelle'} · ${revision.rating || 'ohne Rating'}${target !== null ? ` · Ziel ${formatNumber(target, 2)} ${revision.currency || ''}` : ''} · ${dateOnly(revision.published_at)}.`;
    }).join(' ');
  }

  function methodology(news) {
    const basis = news.analysis_basis || {};
    const limitations = Array.isArray(basis.limitations) ? basis.limitations : [];
    const facts = [
      basis.event_label ? `Ereignis: ${basis.event_label}` : '',
      basis.price_context_symbol
        ? `Kursvergleich: ${basis.price_context_symbol}${basis.price_context_kind === 'proxy' ? ' (Markt-Proxy)' : ' (direkt)'}`
        : '',
      basis.price_source ? `Kursquelle: ${basis.price_source === 'live_delayed' ? 'verzögerter Live-Kurs' : basis.price_source === 'eod' ? 'End-of-Day' : 'keine'}` : '',
      basis.price_provider ? `Kursanbieter: ${basis.price_provider}` : '',
      basis.price_context_updated_at
        ? `Kurscache aktualisiert: ${dateTime(basis.price_context_updated_at)}`
        : '',
      basis.news_source_kind === 'rss_aggregator'
        ? 'Nachrichtenzugang: kostenloser RSS-Aggregator'
        : '',
      basis.price_availability
        ? `Kursstatus: ${basis.price_availability === 'available' ? 'verfügbar' : basis.price_availability === 'awaiting_session' ? 'nächste Handelssitzung ausstehend' : 'nicht verfügbar'}`
        : '',
      basis.price_period ? `Messfenster: ${basis.price_period}` : '',
      basis.observed_at ? `Kursstand: ${dateTime(basis.observed_at)}` : '',
      `Modell: ${news.assessment_version || 'unbekannt'}`
    ].filter(Boolean);
    return `
      <details class="news-methodology">
        <summary>Bewertungsgrundlage & Grenzen</summary>
        ${facts.map(fact => `<p>${escapeHtml(fact)}</p>`).join('')}
        ${limitations.map(limitation => `<p>• ${escapeHtml(limitation)}</p>`).join('')}
      </details>
    `;
  }

  function renderDetail(news) {
    if (!news) {
      els.detail.innerHTML = '<div class="news-empty">Wähle einen Eintrag aus der Liste.</div>';
      return;
    }
    const source = safeUrl(news.source_url);
    const references = news.refs || [];
    const portfolioInfo = references.length
      ? references.map(reference => `
          <button type="button" class="btn small news-analysis-link" data-analysis-symbol="${escapeHtml(reference.symbol || reference.market_symbol || '')}">
            <span>${escapeHtml(reference.name)}</span><span>Analyse öffnen →</span>
          </button>
        `).join(' ')
      : 'Keine direkte Position zugeordnet';
    const manualAnalyst = manualAnalystSummary(references);
    const analystText = [news.analyst_view, manualAnalyst].filter(Boolean).join(' ');
    const evaluated = news.evaluated_at ? dateTime(news.evaluated_at) : 'ältere Bewertung';
    const legacy = !String(news.assessment_version || '').startsWith('29.');
    els.detail.innerHTML = `
      <div class="news-detail-heading">
        <div class="news-scope ${news.scope}">${scopeLabel(news.scope, true)}</div>
        <div class="news-detail-badges">
          <span class="chip ${qualityClass(news.data_quality)}">Datenqualität ${escapeHtml(news.data_quality)}</span>
          <span class="chip ${legacy ? 'warn' : 'good'}">${legacy ? 'Legacy · neu synchronisieren' : 'V29 bewertet'}</span>
        </div>
      </div>
      <h2>${escapeHtml(news.title)}</h2>
      <div class="news-detail-meta">
        <span>${escapeHtml(dateTime(news.published_at))}</span>
        <span>•</span>
        <span>${escapeHtml(news.source_name)}</span>
        <span>•</span>
        <span>${escapeHtml(eventLabel(news.event_type))}</span>
        <span class="chip ${directionClass(news.direction)}">${escapeHtml(news.direction)}</span>
      </div>
      <div class="news-score-grid">
        <div><span>Relevanz</span><strong>${news.scores.relevance}</strong></div>
        <div><span>Vertrauen</span><strong>${news.scores.confidence}</strong></div>
        <div><span>Auswirkung</span><strong>${news.scores.impact}</strong></div>
        <div><span>Dringlichkeit</span><strong>${news.scores.urgency}</strong></div>
      </div>
      <div class="notice">
        <div>◆</div>
        <div><strong>Warum relevant:</strong> ${escapeHtml(news.relevance_reason || news.summary || 'Noch keine Begründung vorhanden.')}</div>
      </div>
      <div class="news-analysis-grid intelligence">
        <div class="news-analysis-box">
          <div class="label">Auswirkung / Mechanismus</div>
          <div class="value">${escapeHtml(news.market_impact || 'Noch nicht bewertet')}</div>
        </div>
        <div class="news-analysis-box">
          <div class="label">Bereits eingepreist?</div>
          <div class="value">${escapeHtml(news.priced_in)}</div>
        </div>
        <div class="news-analysis-box">
          <div class="label">Analystenbild</div>
          <div class="value">${escapeHtml(analystText || 'Keine belastbaren Analystendaten verfügbar.')}</div>
        </div>
        <div class="news-analysis-box action">
          <div class="label">Konkrete Handlung</div>
          <div class="value">${escapeHtml(news.recommended_action || 'Originalquelle und Bezug zur Investmentthese prüfen.')}</div>
        </div>
      </div>
      <div class="news-market-facts">
        <div><span>Primärsymbol</span><strong>${escapeHtml(news.primary_symbol || news.symbols[0] || '—')}</strong></div>
        <div><span>Kursvergleich</span><strong>${escapeHtml(news.analysis_basis?.price_context_symbol || '—')}${news.analysis_basis?.price_context_kind === 'proxy' ? ' · Proxy' : ''}</strong></div>
        <div><span>Kursreaktion</span><strong>${escapeHtml(formatPercent(news.price_reaction_percent))}</strong></div>
        <div><span>Normalbewegung</span><strong>${escapeHtml(news.normal_move_percent === null ? '—' : `${formatNumber(news.normal_move_percent, 1)} %`)}</strong></div>
        <div><span>Konsensziel-Abstand</span><strong>${escapeHtml(formatPercent(news.analyst_target_upside_percent))}</strong></div>
        <div><span>Bewertet</span><strong>${escapeHtml(evaluated)}</strong></div>
      </div>
      <div class="news-detail-content">${escapeHtml(news.content || news.summary || 'Kein Volltext verfügbar.')}</div>
      <div class="news-analysis-box" style="margin-top:16px">
        <div class="label">Betroffene Positionen / Analysen</div>
        <div class="value">${portfolioInfo}</div>
      </div>
      ${methodology(news)}
      ${source ? `<a class="btn news-source-link" href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Originalquelle öffnen ↗</a>` : ''}
    `;
    $$('[data-analysis-symbol]', els.detail).forEach(button => {
      button.onclick = () => openLinkedAnalysis(button.dataset.analysisSymbol || '');
    });
  }

  function openLinkedAnalysis(symbol) {
    const dashboard = window.InvestitionDashboard;
    const result = dashboard?.openAnalysisBySymbol?.(symbol);
    if (!result?.ok) {
      setStatus(`Für ${symbol || 'dieses Wertpapier'} wurde keine verknüpfte Analyse gefunden.`, 'bad');
      return;
    }
    showPage('trading');
    setStatus(`Analyse ${result.name} geöffnet.`, 'good');
  }

  function selectItem(id) {
    selectedId = id;
    readIds.add(id);
    saveReadIds();
    renderList();
    if (matchMedia('(max-width:980px)').matches) {
      els.detailCard.scrollIntoView({behavior:'smooth', block:'start'});
    }
  }

  function showPage(name) {
    const page = ['decision', 'trading', 'analytics', 'news'].includes(name)
      ? name
      : 'decision';
    els.tradingPage.hidden = page !== 'trading';
    if (els.decisionPage) els.decisionPage.hidden = page !== 'decision';
    if (els.analyticsPage) els.analyticsPage.hidden = page !== 'analytics';
    els.newsPage.hidden = page !== 'news';
    els.navTrading?.classList.toggle('active', page === 'trading');
    els.navDecision?.classList.toggle('active', page === 'decision');
    els.navAnalytics?.classList.toggle('active', page === 'analytics');
    els.navNews?.classList.toggle('active', page === 'news');
    history.replaceState(null, '', `#${page}`);
    if (page === 'news') renderList();
    if (page === 'decision') {
      window.dispatchEvent(new CustomEvent('investition:decision-visible'));
    }
    if (page === 'analytics') {
      window.dispatchEvent(new CustomEvent('investition:analytics-visible'));
    }
  }

  function pageFromHash() {
    const value = String(location.hash || '').replace('#', '');
    return ['decision', 'trading', 'analytics', 'news'].includes(value)
      ? value
      : 'decision';
  }

  async function loadReferences() {
    const active = await resolveSession();
    if (!sb || !active) return;
    const [plansResult, positionsResult, revisionsResult] = await Promise.all([
      sb.from('trade_plans')
        .select('id,name,symbol,market_symbol,status,instrument_type,direction,wkn,isin')
        .order('updated_at', {ascending:false}),
      sb.from('depot_positions')
        .select('id,trade_id,name,symbol,instrument_type,is_open')
        .eq('is_open', true),
      sb.from('analyst_revisions')
        .select('*')
        .order('published_at', {ascending:false})
        .limit(300)
    ]);
    const plans = plansResult.data || [];
    const planById = new Map(plans.map(plan => [plan.id, plan]));
    portfolio = (positionsResult.data || []).map(position => ({
      ...planById.get(position.trade_id),
      ...position,
      name:position.name || planById.get(position.trade_id)?.name || 'Depotposition',
      market_symbol:planById.get(position.trade_id)?.market_symbol || null,
      direction:planById.get(position.trade_id)?.direction || null,
      wkn:planById.get(position.trade_id)?.wkn || null,
      isin:planById.get(position.trade_id)?.isin || null
    }));
    const heldTradeIds = new Set(portfolio.map(position => position.trade_id).filter(Boolean));
    watchlist = plans.filter(plan =>
      !heldTradeIds.has(plan.id) &&
      !['Geschlossen', 'Verworfen'].includes(plan.status)
    );
    analystRevisions = revisionsResult.error ? [] : (revisionsResult.data || []);
  }

  async function loadAutomaticSyncHealth() {
    if (!sb || !getActiveSession()) return;
    const {data, error} = await sb
      .from('news_sync_runs')
      .select('finished_at,ok,auth_mode,version,inserted,assessed,rss_articles,eodhd_calls,warning_count,error_message,details')
      .order('finished_at', {ascending:false})
      .limit(1)
      .maybeSingle();
    if (error) {
      if (/news_sync_runs|schema cache|does not exist/i.test(error.message || '')) {
        setHealth(
          els.functionHealth,
          'V29.2-Hybrid-Schema ausführen',
          'warn'
        );
      }
      return;
    }
    if (!data) {
      setHealth(els.functionHealth, 'noch kein Hintergrundlauf', 'warn');
      return;
    }
    let details = data.details;
    if (typeof details === 'string') {
      try { details = JSON.parse(details); } catch { details = {}; }
    }
    details = details && typeof details === 'object' ? details : {};
    const mode = data.auth_mode === 'cron' ? 'automatisch' : 'manuell';
    setHealth(
      els.functionHealth,
      data.ok
        ? `${mode} · ${dateTime(data.finished_at)} · ${data.inserted || 0} gespeichert`
        : `${mode} · Fehler ${dateTime(data.finished_at)}`,
      data.ok ? (data.warning_count ? 'warn' : 'good') : 'bad'
    );
    if (data.ok) {
      const used = numberOr(details.eodhd_calls_used_today, data.eodhd_calls || 0);
      const budget = numberOr(details.eodhd_daily_budget, 6);
      setHealth(
        els.providerHealth,
        `${data.rss_articles || 0} RSS-Treffer · ${details.rss_source_count || 0} Quellen · ${details.historical_symbols || 0} Kursreihen · EODHD ${used}/${budget} heute`,
        data.warning_count ? 'warn' : 'good'
      );
    } else if (data.error_message) {
      setHealth(els.providerHealth, explainFunctionError(data.error_message), 'bad');
    }
  }

  function startSyncHealthPolling() {
    if (syncHealthTimer) clearInterval(syncHealthTimer);
    syncHealthTimer = setInterval(() => {
      if (!document.hidden && getActiveSession()) {
        loadAutomaticSyncHealth();
      }
    }, 60_000);
  }

  function stopSyncHealthPolling() {
    if (syncHealthTimer) clearInterval(syncHealthTimer);
    syncHealthTimer = null;
  }

  async function loadCloudNews(options = {}) {
    const active = await resolveSession();
    if (!sb || !active) {
      setHealth(els.cloudHealth, 'nicht angemeldet', 'warn');
      if (!options.quiet) setStatus('News können erst nach der Anmeldung geladen werden.', 'bad');
      return;
    }
    setHealth(els.cloudHealth, active.user.email || 'angemeldet', 'good');
    if (!options.quiet) setStatus('Portfolio- und Markt-News werden geladen …');
    await loadReferences();
    const {data, error} = await sb
      .from('market_news')
      .select('*')
      .eq('is_published', true)
      .order('published_at', {ascending:false})
      .limit(500);
    if (error) {
      setHealth(els.tableHealth, error.message, 'bad');
      if (!options.quiet) setStatus(`News konnten nicht geladen werden: ${error.message}`, 'bad');
      return;
    }
    items = (data || []).map(normalize);
    selectedId = items.some(news => news.id === selectedId)
      ? selectedId
      : items[0]?.id || null;
    const assessed = items.filter(news =>
      String(news.assessment_version).startsWith('29.')
    ).length;
    const measurable = items.filter(news =>
      String(news.assessment_version).startsWith('29.') &&
      !['unklar', 'zu_frueh'].includes(news.priced_in_state)
    ).length;
    const awaiting = items.filter(news =>
      news.priced_in_state === 'zu_frueh'
    ).length;
    const unavailable = items.filter(news =>
      news.priced_in_state === 'unklar'
    ).length;
    setHealth(
      els.tableHealth,
      `erreichbar · ${items.length} Zeilen`,
      items.length ? 'good' : 'warn'
    );
    setHealth(
      els.assessmentHealth,
      assessed
        ? `${assessed} bewertet · ${measurable} Einpreisungen · ${awaiting} zu früh · ${unavailable} nicht messbar`
        : 'V29-Schema/Sync prüfen',
      assessed ? 'good' : 'warn'
    );
    await loadAutomaticSyncHealth();
    els.lastUpdated.textContent = items[0]
      ? `Neueste Meldung: ${dateTime(items[0].published_at)}`
      : 'Noch keine Meldungen';
    if (!options.quiet) {
      setStatus(
        `${items.length} Meldungen geladen · ${portfolio.length} Depotpositionen · ${watchlist.length} Watchlist-Werte · ${assessed} V29-Bewertungen.`,
        'good'
      );
    }
    renderList();
    window.dispatchEvent(new CustomEvent('investition:news-changed', {
      detail:{count:items.length, assessed}
    }));
  }

  async function invokeSyncFunction(active) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 110_000);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-news`, {
        method:'POST',
        mode:'cors',
        cache:'no-store',
        credentials:'omit',
        headers:{
          'Content-Type':'application/json',
          apikey:SUPABASE_PUBLISHABLE_KEY,
          Authorization:`Bearer ${active.access_token}`
        },
        body:JSON.stringify({mode:'hybrid', force:true, portfolio:true, intelligence:true}),
        signal:controller.signal
      });
      const raw = await response.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch {}
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}: ${raw.slice(0, 400)}`);
      }
      return data || {ok:true};
    } finally {
      clearTimeout(timer);
    }
  }

  async function syncNews() {
    const active = await resolveSession();
    if (!sb || !active) {
      setStatus('Bitte zuerst anmelden.', 'bad');
      return;
    }
    els.sync.disabled = true;
    setHealth(els.functionHealth, 'RSS-News und Tageskurse werden bewertet …', 'warn');
    setHealth(els.assessmentHealth, 'Bewertung läuft …', 'warn');
    setStatus('Kostenlose RSS-Quellen werden für Portfolio, Watchlist, Branchen und Märkte synchronisiert und bewertet …');
    try {
      const data = await invokeSyncFunction(active);
      if (data?.ok === false) {
        throw new Error(data.error || 'Die Sync-Function meldet einen Fehler.');
      }
      const sourceErrors = Array.isArray(data?.source_errors)
        ? data.source_errors.length
        : 0;
      const warnings = Array.isArray(data?.warnings) ? data.warnings.length : 0;
      const pricing = data?.pricing_breakdown || {};
      const measurable = (pricing.weitgehend || 0) +
        (pricing.teilweise || 0) +
        (pricing.eher_nicht || 0);
      setHealth(
        els.functionHealth,
        `erfolgreich · ${data?.inserted ?? 0} gespeichert · ${Math.round((data?.duration_ms || 0) / 1000)} s`,
        'good'
      );
      setHealth(
        els.providerHealth,
        `${data?.received ?? 0} RSS-Treffer · ${data?.rss_source_count ?? 0} Quellen · ${data?.historical_symbols ?? 0}/${data?.market_context_symbols ?? 0} Kursreihen · ${data?.proxy_context_symbols ?? 0} Markt-Proxys · EODHD ${data?.eodhd_calls_used_today ?? data?.eodhd_calls_reserved ?? 0}/${data?.eodhd_daily_budget ?? 6} heute${sourceErrors ? ` · ${sourceErrors} RSS-Teilfehler` : ''}`,
        sourceErrors || warnings ? 'warn' : 'good'
      );
      setHealth(
        els.assessmentHealth,
        data?.schema_ready === false
          ? data?.hybrid_schema_ready === false
            ? 'V29.2-Hybrid-Schema erforderlich'
            : 'V29-Bewertungsschema erforderlich'
          : `${data?.assessed ?? 0} bewertet · ${measurable} Einpreisungen · ${pricing.zu_frueh || 0} zu früh · ${pricing.unklar || 0} nicht messbar`,
        data?.schema_ready === false ? 'bad' : 'good'
      );
      await loadCloudNews({quiet:true});
      if (data?.hybrid_schema_ready === false) {
        setStatus(
          `${data?.inserted ?? 0} RSS-Meldungen gespeichert und bewertet. Für Tagesbudget, Kurscache und sichtbare automatische Laufzeiten jetzt version29-2-hybrid-schema.sql ausführen und danach erneut synchronisieren.`,
          'bad'
        );
      } else if (data?.intelligence_schema_ready === false) {
        setStatus(
          `${data?.inserted ?? 0} Meldungen gespeichert, aber nur im V28-Kompatibilitätsmodus. Jetzt version29-market-intelligence-schema.sql ausführen und danach erneut synchronisieren.`,
          'bad'
        );
      } else {
        setStatus(
          `${data?.inserted ?? 0} RSS-Meldungen gespeichert und bewertet; ${data?.tracked_instruments ?? 0} Wertpapiere geprüft; ${measurable} Einpreisungen abgeleitet; ${pricing.zu_frueh || 0} warten auf die nächste Handelssitzung; ${pricing.unklar || 0} ohne verwertbare Kursdaten; ${data?.analyst_articles ?? 0} mit erkanntem Analystensignal.${sourceErrors || warnings ? ` ${sourceErrors + warnings} Teilhinweis(e) – RSS-Sync und übrige Bewertungen waren erfolgreich.` : ''}`,
          sourceErrors || warnings ? 'warn' : 'good'
        );
      }
    } catch (error) {
      const detail = explainFunctionError(error instanceof Error ? error.message : String(error));
      setHealth(els.functionHealth, detail, 'bad');
      setHealth(els.assessmentHealth, 'nicht aktualisiert', 'bad');
      setStatus(`Synchronisierung fehlgeschlagen: ${detail}`, 'bad');
    } finally {
      els.sync.disabled = false;
    }
  }

  async function importNews(file) {
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = Array.isArray(parsed) ? parsed : parsed.news;
      if (!Array.isArray(incoming)) throw new Error('Kein gültiges News-Array.');
      const rows = incoming.map(normalize).map(news => ({
        ...news,
        is_published:true
      }));
      const {error} = await sb.from('market_news').upsert(rows, {onConflict:'external_id'});
      if (error) throw error;
      setStatus(`${rows.length} Meldungen importiert. Für V29-Bewertungen anschließend den Feed synchronisieren.`, 'good');
      await loadCloudNews();
    } catch (error) {
      setStatus(`Import fehlgeschlagen: ${error.message}`, 'bad');
    }
  }

  function subscribeRealtime() {
    if (!sb || !getActiveSession()) return;
    if (realtimeChannel) sb.removeChannel(realtimeChannel);
    realtimeChannel = sb
      .channel('market-news-v29')
      .on('postgres_changes', {
        event:'*',
        schema:'public',
        table:'market_news'
      }, () => loadCloudNews({quiet:true}))
      .subscribe();
  }

  function applySession(nextSession) {
    session = nextSession || null;
    setTimeout(() => {
      if (session) {
        subscribeRealtime();
        startSyncHealthPolling();
        loadCloudNews();
      } else {
        stopSyncHealthPolling();
        if (realtimeChannel) {
          sb?.removeChannel(realtimeChannel);
          realtimeChannel = null;
        }
        items = [];
        portfolio = [];
        watchlist = [];
        analystRevisions = [];
        renderList();
        setHealth(els.cloudHealth, 'nicht angemeldet', 'warn');
      }
    }, 0);
  }

  async function initCloud() {
    if (!sb) {
      setHealth(els.cloudHealth, 'Supabase fehlt', 'bad');
      return;
    }
    const initial = await resolveSession();
    if (initial) {
      subscribeRealtime();
      startSyncHealthPolling();
      await loadCloudNews();
    }
    window.addEventListener('investition:auth-changed', event =>
      applySession(event.detail?.session || null)
    );
    window.addEventListener('investition:ready', () => {
      const active = getActiveSession();
      if (active) applySession(active);
    });
    sb.auth.onAuthStateChange((_event, nextSession) => applySession(nextSession));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && getActiveSession()) loadAutomaticSyncHealth();
    });
  }

  els.navTrading.onclick = () => showPage('trading');
  if (els.navDecision) els.navDecision.onclick = () => showPage('decision');
  if (els.navAnalytics) els.navAnalytics.onclick = () => showPage('analytics');
  els.navNews.onclick = () => showPage('news');
  [els.search, els.scope, els.topic, els.impact, els.pricing, els.read]
    .filter(Boolean)
    .forEach(element => element.addEventListener('input', renderList));
  $$('[data-scope]', els.priorityStrip).forEach(button => {
    button.onclick = () => {
      els.scope.value = els.scope.value === button.dataset.scope
        ? ''
        : button.dataset.scope;
      renderList();
    };
  });
  els.sync.onclick = syncNews;
  els.importBtn.onclick = () => els.importFile.click();
  els.importFile.onchange = async () => {
    const file = els.importFile.files[0];
    if (file) await importNews(file);
    els.importFile.value = '';
  };
  els.markAll.onclick = () => {
    items.forEach(news => readIds.add(news.id));
    saveReadIds();
    renderList();
  };
  window.addEventListener('hashchange', () => showPage(pageFromHash()));
  window.InvestitionNavigation = Object.assign(
    window.InvestitionNavigation || {},
    {showPage, getPage:pageFromHash}
  );
  window.InvestitionNews = Object.assign(
    window.InvestitionNews || {},
    {
      getItems:() => enriched(),
      refresh:loadCloudNews,
      sync:syncNews,
      version:VERSION
    }
  );
  showPage(pageFromHash());
  renderList();
  initCloud();
})();
