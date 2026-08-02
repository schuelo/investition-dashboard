(() => {
  'use strict';

  const VERSION = '30.1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const page = $('#eventAnalysisPage');
  if (!page) return;

  const els = {
    input: $('#eventAnalysisInput'),
    horizon: $('#eventAnalysisHorizon'),
    scope: $('#eventAnalysisScope'),
    risk: $('#eventAnalysisRisk'),
    region: $('#eventAnalysisRegion'),
    analyze: $('#eventAnalysisRunBtn'),
    clear: $('#eventAnalysisClearBtn'),
    refreshHistory: $('#eventAnalysisRefreshHistoryBtn'),
    status: $('#eventAnalysisStatus'),
    history: $('#eventAnalysisHistory'),
    results: $('#eventAnalysisResults'),
    metrics: $('#eventAnalysisMetrics'),
    tabs: $('#eventAnalysisTabs'),
    tabContent: $('#eventAnalysisTabContent')
  };

  const state = {
    sb: null,
    session: null,
    current: null,
    loading: false,
    historyLoaded: false
  };

  function dashboard() {
    return window.InvestitionDashboard || null;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ''));
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function impactClass(value) {
    const score = number(value);
    return score > 20 ? 'event-impact-positive' : score < -20 ? 'event-impact-negative' : 'event-impact-neutral';
  }

  function dateText(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('de-DE', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Europe/Berlin'
    }).format(date);
  }

  function setStatus(message, type = '') {
    if (!els.status) return;
    els.status.textContent = message;
    els.status.className = `event-analysis-status ${type}`;
  }

  function setBusy(busy) {
    state.loading = busy;
    if (els.analyze) els.analyze.disabled = busy;
    if (els.refreshHistory) els.refreshHistory.disabled = busy;
    page.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  function syncAccess() {
    state.sb = dashboard()?.getSupabase?.() || state.sb;
    state.session = dashboard()?.getSession?.() || null;
    return Boolean(state.sb && state.session);
  }

  async function functionError(error) {
    let details = error?.message || String(error || 'Unbekannter Function-Fehler');
    try {
      if (error?.context instanceof Response) {
        const payload = await error.context.clone().json();
        details = payload?.error || payload?.message || details;
      }
    } catch (_ignored) {
      try {
        if (error?.context instanceof Response) details = await error.context.clone().text() || details;
      } catch (_ignoredAgain) {}
    }
    return details;
  }

  async function runAnalysis() {
    const eventInput = String(els.input?.value || '').trim();
    if (eventInput.length < 8) {
      setStatus('Bitte das Ereignis oder die These etwas genauer beschreiben.', 'warn');
      els.input?.focus();
      return;
    }
    if (!syncAccess()) {
      setStatus('Keine aktive Cloud-Sitzung. Bitte das Dashboard erneut entsperren.', 'bad');
      return;
    }

    setBusy(true);
    setStatus('Recherche, Portfolioabgleich und Szenariomodell laufen …');
    try {
      const {data, error} = await state.sb.functions.invoke('analyze-market-event', {
        body: {
          event_input: eventInput,
          analysis_horizon: els.horizon?.value || '1–6 Monate',
          analysis_scope: els.scope?.value || 'portfolio_watchlist',
          risk_profile: els.risk?.value || 'chancenorientiert',
          regions: [els.region?.value || 'weltweit']
        }
      });
      if (error) throw new Error(await functionError(error));
      if (!data?.ok || !data.analysis) throw new Error(data?.error || 'Die Function lieferte kein Analyseergebnis.');

      state.current = data.analysis;
      renderAnalysis(state.current);
      await loadHistory(true);
      const sourceCount = state.current.sources?.length || 0;
      const assetCount = state.current.assets?.length || 0;
      const ideaCount = (state.current.assets || []).filter(asset => !asset.is_portfolio_position && !asset.is_watchlist_position).length;
      setStatus(`Analyse abgeschlossen · ${sourceCount} Quellen · ${assetCount} Werte bewertet · ${ideaCount} unabhängige Marktideen.`, 'good');
    } catch (error) {
      console.error('Event-Analyse:', error);
      setStatus(`Analyse fehlgeschlagen: ${error?.message || String(error)}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function loadHistory(force = false) {
    if (!syncAccess()) {
      els.history.innerHTML = '<div class="event-empty">Keine aktive Cloud-Sitzung.</div>';
      return;
    }
    if (state.historyLoaded && !force) return;

    els.history.innerHTML = '<div class="event-empty">Analysehistorie wird geladen …</div>';
    const {data, error} = await state.sb
      .from('event_analyses')
      .select('id,event_title,event_input,market_relevance,portfolio_impact,confidence_score,created_at,raw_result')
      .eq('user_id', state.session.user.id)
      .order('created_at', {ascending: false})
      .limit(30);

    if (error) {
      state.historyLoaded = false;
      const schemaHint = /event_analyses|schema cache|does not exist/i.test(error.message || '')
        ? ' Das SQL „setup-v30-event-analysis.sql“ wurde vermutlich noch nicht ausgeführt.'
        : '';
      els.history.innerHTML = `<div class="event-empty">Historie nicht verfügbar: ${escapeHtml(error.message)}${escapeHtml(schemaHint)}</div>`;
      return;
    }

    state.historyLoaded = true;
    if (!data?.length) {
      els.history.innerHTML = '<div class="event-empty">Noch keine gespeicherten Analysen.</div>';
      return;
    }

    els.history.innerHTML = data.map(item => `
      <button class="event-history-item" type="button" data-analysis-id="${escapeHtml(item.id)}">
        <span>
          <strong>${escapeHtml(item.event_title || item.event_input || 'Ereignisanalyse')}</strong>
          <small>${escapeHtml(dateText(item.created_at))} · Vertrauen ${escapeHtml(item.confidence_score ?? '—')}/100</small>
        </span>
        <span class="event-history-score ${impactClass(item.portfolio_impact)}">${number(item.portfolio_impact) > 0 ? '+' : ''}${escapeHtml(item.portfolio_impact ?? 0)}</span>
      </button>
    `).join('');

    $$('[data-analysis-id]', els.history).forEach(button => {
      button.addEventListener('click', () => {
        const row = data.find(item => item.id === button.dataset.analysisId);
        if (!row?.raw_result) return;
        state.current = row.raw_result;
        renderAnalysis(state.current);
        setStatus(`Gespeicherte Analyse vom ${dateText(row.created_at)} geöffnet.`, 'good');
      });
    });
  }

  function metricCard(label, value, detail, className = '') {
    return `
      <article class="card event-metric-card ${className}">
        <div class="event-metric-value">${escapeHtml(value)}</div>
        <div class="event-metric-label">${escapeHtml(label)}</div>
        <div class="event-metric-detail">${escapeHtml(detail)}</div>
      </article>
    `;
  }

  function assetsFrom(analysis) {
    return Array.isArray(analysis?.assets) ? analysis.assets : [];
  }

  function ideaRoleLabel(asset) {
    if (asset.idea_type === 'winner') return 'Potenzieller Gewinner';
    if (asset.idea_type === 'loser') return 'Risiko-/Short-Kandidat';
    if (asset.idea_type === 'hedge') return 'Mögliche Absicherung';
    return 'Recherchekandidat';
  }

  function renderIdeaGroups(rows, analysis) {
    if (!rows.length) return '<div class="event-empty">Keine Marktideen vorhanden. Dies wäre ein technischer Fehler der Ideen-Engine.</div>';
    const sorted = [...rows].sort((a, b) => number(a.idea_rank, 999) - number(b.idea_rank, 999));
    const positive = sorted.filter(asset => number(asset.impact_score) > 20);
    const negative = sorted.filter(asset => number(asset.impact_score) < -20);
    const research = sorted.filter(asset => Math.abs(number(asset.impact_score)) <= 20);
    const fallback = Boolean(analysis?.idea_engine?.used_fallback);
    const section = (title, description, items) => items.length ? `
      <section class="event-idea-group">
        <div class="event-idea-group-head"><h3>${escapeHtml(title)}</h3><span>${escapeHtml(description)}</span></div>
        ${assetTable(items, false)}
      </section>` : '';
    return `
      <div class="event-idea-notice ${fallback ? 'warn' : 'good'}">
        <strong>Unabhängiger Markt-Scan</strong>
        <span>Diese Ideen werden getrennt von Portfolio und Watchlist erzeugt.${fallback ? ' Mindestens ein Kandidat stammt aus einer niedrig-konfidenten Rückfallebene und muss besonders sorgfältig validiert werden.' : ''}</span>
      </div>
      ${section('Chancen & Profiteure', 'positive Ereigniswirkung', positive)}
      ${section('Risiken & Short-Kandidaten', 'negative Ereigniswirkung', negative)}
      ${section('Recherche & Absicherung', 'noch keine eindeutige Richtung', research)}
    `;
  }

  function renderAnalysis(analysis) {
    if (!analysis) return;
    els.results.hidden = false;
    const impact = number(analysis.portfolio_impact);
    const ideaCount = assetsFrom(analysis).filter(asset => !asset.is_portfolio_position && !asset.is_watchlist_position).length;
    els.metrics.innerHTML = [
      metricCard('Marktrelevanz', analysis.market_relevance ?? '—', 'von 100'),
      metricCard('Portfolio-Impact', `${impact > 0 ? '+' : ''}${impact}`, '-100 bis +100', impactClass(impact)),
      metricCard('Marktideen', ideaCount, 'unabhängig vom Bestand'),
      metricCard('Vertrauen', analysis.confidence_score ?? '—', 'von 100')
    ].join('');

    const tabs = [
      ['summary', 'Zusammenfassung'],
      ['portfolio', 'Portfolio & Watchlist'],
      ['ideas', 'Investmentideen'],
      ['scenarios', 'Szenarien'],
      ['signals', 'Frühindikatoren'],
      ['sources', 'Quellen']
    ];
    els.tabs.innerHTML = tabs.map(([key, label], index) => `
      <button class="btn small event-tab ${index === 0 ? 'active' : ''}" type="button" data-event-tab="${key}">${label}</button>
    `).join('');
    $$('[data-event-tab]', els.tabs).forEach(button => {
      button.addEventListener('click', () => {
        $$('[data-event-tab]', els.tabs).forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        renderTab(button.dataset.eventTab, analysis);
      });
    });
    renderTab('summary', analysis);
    els.results.scrollIntoView({behavior: 'smooth', block: 'start'});
  }

  function renderTab(tab, analysis) {
    const assets = assetsFrom(analysis);
    if (tab === 'summary') {
      els.tabContent.innerHTML = `
        <div class="event-summary-head">
          <div>
            <span class="event-eyebrow">Ereignisinterpretation</span>
            <h2>${escapeHtml(analysis.event_title || 'Ereignisanalyse')}</h2>
            <p>${escapeHtml(analysis.event_summary || '')}</p>
          </div>
          <span class="chip neutral">Einpreisung: ${escapeHtml(analysis.pricing_state || 'unklar')}</span>
        </div>
        <div class="event-result-grid">
          <article class="event-result-panel">
            <h3>So wurde das Ereignis verstanden</h3>
            <p>${escapeHtml(analysis.interpretation || 'Keine Interpretation verfügbar.')}</p>
          </article>
          <article class="event-result-panel">
            <h3>Wichtigste Handlung</h3>
            <p>${escapeHtml(analysis.key_action || 'Keine Handlungsempfehlung verfügbar.')}</p>
          </article>
        </div>
        <div class="event-sector-row">
          ${(analysis.affected_sectors || []).map(sector => `<span class="event-pill">${escapeHtml(sector)}</span>`).join('') || '<span class="event-pill">Keine Branche erkannt</span>'}
        </div>
      `;
      return;
    }
    if (tab === 'portfolio') {
      els.tabContent.innerHTML = assetTable(assets.filter(asset => asset.is_portfolio_position || asset.is_watchlist_position), true);
      bindAssetLinks();
      return;
    }
    if (tab === 'ideas') {
      els.tabContent.innerHTML = renderIdeaGroups(assets.filter(asset => !asset.is_portfolio_position && !asset.is_watchlist_position), analysis);
      bindAssetLinks();
      return;
    }
    if (tab === 'scenarios') {
      els.tabContent.innerHTML = (analysis.scenarios || []).map(scenario => `
        <article class="event-scenario event-scenario-${escapeHtml(scenario.scenario_type || 'base')}">
          <div class="event-scenario-head">
            <h3>${escapeHtml(scenario.title || 'Szenario')}</h3>
            <span class="chip neutral">${escapeHtml(scenario.probability ?? '—')} %</span>
          </div>
          <p>${escapeHtml(scenario.description || '')}</p>
          <div class="event-result-grid compact">
            <div><strong>Portfolio</strong><span>${escapeHtml(scenario.portfolio_effect || '—')}</span></div>
            <div><strong>Markt</strong><span>${escapeHtml(scenario.market_effect || '—')}</span></div>
          </div>
          <p class="event-muted"><strong>Bestätigung:</strong> ${(scenario.confirmation_signals || []).map(escapeHtml).join(' · ') || '—'}</p>
          <p class="event-muted"><strong>Ungültig bei:</strong> ${(scenario.invalidation_signals || []).map(escapeHtml).join(' · ') || '—'}</p>
        </article>
      `).join('') || '<div class="event-empty">Keine Szenarien vorhanden.</div>';
      return;
    }
    if (tab === 'signals') {
      els.tabContent.innerHTML = (analysis.signals || []).map(signal => `
        <article class="event-source-row">
          <div>
            <strong>${escapeHtml(signal.signal_name || 'Frühindikator')}</strong>
            <p>${escapeHtml(signal.signal_description || '')}</p>
          </div>
          <span class="chip neutral">Priorität ${escapeHtml(signal.importance ?? '—')}</span>
        </article>
      `).join('') || '<div class="event-empty">Keine Frühindikatoren vorhanden.</div>';
      return;
    }
    if (tab === 'sources') {
      els.tabContent.innerHTML = (analysis.sources || []).map(source => {
        const url = safeUrl(source.source_url);
        return `
          <article class="event-source-row">
            <div>
              <strong>${escapeHtml(source.title || 'Quelle')}</strong>
              <p>${escapeHtml(source.source_name || 'Quelle')} · ${escapeHtml(dateText(source.published_at))} · Relevanz ${escapeHtml(source.relevance_score ?? '—')}</p>
            </div>
            ${url ? `<a class="btn small" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Originalquelle ↗</a>` : ''}
          </article>
        `;
      }).join('') || '<div class="event-empty">Keine externen Quellen gefunden. Die Analyse basiert auf Portfolio-, News- und Regelmodell.</div>';
    }
  }

  function assetTable(rows, includeSource) {
    if (!rows.length) return '<div class="event-empty">Keine passenden Werte erkannt.</div>';
    return `
      <div class="event-table-wrap">
        <table class="event-table">
          <thead><tr>
            <th>Wert</th>
            ${includeSource ? '<th>Zuordnung</th>' : '<th>Rolle</th><th>Chance</th>'}
            <th>Impact</th>
            <th>Vertrauen</th>
            <th>Einpreisung</th>
            <th>Empfehlung</th>
            <th>Begründung</th>
            <th></th>
          </tr></thead>
          <tbody>${rows.map(asset => {
            const score = number(asset.impact_score);
            const canOpen = Boolean(asset.symbol && dashboard()?.hasAnalysisForSymbol?.(asset.symbol));
            return `
              <tr>
                <td><strong>${escapeHtml(asset.company_name || 'Unbekannter Wert')}</strong><span class="event-muted">${escapeHtml(asset.symbol || 'kein Symbol')}</span>${asset.overlaps_portfolio ? '<span class="event-overlap">auch im Portfolio</span>' : ''}${asset.overlaps_watchlist ? '<span class="event-overlap">auch in Watchlist</span>' : ''}</td>
                <td>${escapeHtml(includeSource ? (asset.asset_source || 'Bestand') : ideaRoleLabel(asset))}${asset.is_fallback_idea ? '<span class="event-muted">Rückfallhypothese</span>' : ''}</td>
                ${includeSource ? '' : `<td><strong>${escapeHtml(asset.opportunity_score ?? '—')}</strong><span class="event-muted">von 100</span></td>`}
                <td class="${impactClass(score)}"><strong>${score > 0 ? '+' : ''}${escapeHtml(score)}</strong></td>
                <td>${escapeHtml(asset.confidence_score ?? '—')}</td>
                <td>${escapeHtml(asset.pricing_state || 'unklar')}</td>
                <td>${escapeHtml(asset.recommendation || '—')}</td>
                <td>${escapeHtml(asset.reasoning || '—')}</td>
                <td>${canOpen ? `<button class="btn small" type="button" data-event-open-symbol="${escapeHtml(asset.symbol)}">Analyse öffnen</button>` : ''}</td>
              </tr>
            `;
          }).join('')}</tbody>
        </table>
      </div>
    `;
  }

  function bindAssetLinks() {
    $$('[data-event-open-symbol]', els.tabContent).forEach(button => {
      button.addEventListener('click', () => {
        const result = dashboard()?.openAnalysisBySymbol?.(button.dataset.eventOpenSymbol || '');
        if (!result?.ok) {
          setStatus('Für diesen Wert wurde keine bestehende Trading-Analyse gefunden.', 'warn');
          return;
        }
        window.InvestitionNavigation?.showPage?.('trading');
      });
    });
  }

  function clearInput() {
    if (els.input) els.input.value = '';
    els.input?.focus();
    setStatus('Eingabe geleert. Bestehende Analysen bleiben gespeichert.');
  }

  function initialize() {
    els.analyze?.addEventListener('click', runAnalysis);
    els.clear?.addEventListener('click', clearInput);
    els.refreshHistory?.addEventListener('click', () => loadHistory(true));
    $$('[data-event-example]', page).forEach(button => {
      button.addEventListener('click', () => {
        els.input.value = button.dataset.eventExample || '';
        els.input.focus();
      });
    });
    window.addEventListener('investition:event-analysis-visible', () => loadHistory());
    window.addEventListener('investition:auth-changed', event => {
      state.session = event.detail?.session || null;
      state.historyLoaded = false;
      if (!state.session) {
        state.current = null;
        els.results.hidden = true;
        els.history.innerHTML = '<div class="event-empty">Dashboard ist gesperrt.</div>';
      } else if (!page.hidden) {
        loadHistory(true);
      }
    });
    window.addEventListener('investition:ready', () => {
      syncAccess();
      if (!page.hidden) loadHistory(true);
    });
    if (!page.hidden) loadHistory(true);
    window.InvestitionEventAnalysis = Object.assign(window.InvestitionEventAnalysis || {}, {
      version: VERSION,
      refresh: () => loadHistory(true),
      getCurrent: () => state.current ? {...state.current} : null
    });
  }

  initialize();
})();
