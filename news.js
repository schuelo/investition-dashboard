(() => {
  const SUPABASE_URL = 'https://pzhfybtoyfttftgcrcxk.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_yGiDH_M0fUZglk40fCk7cQ_kkL1XKzj';
  const LOCAL_KEY = 'investition-news-feed-v1';
  const READ_KEY = 'investition-news-read-v1';

  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => [...el.querySelectorAll(q)];
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const safeUrl = value => {
    try { const u = new URL(String(value)); return ['http:','https:'].includes(u.protocol) ? u.href : ''; }
    catch { return ''; }
  };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `news-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' }
  });

  const els = {
    tradingPage: $('#tradingPage'), newsPage: $('#newsPage'), navTrading: $('#navTradingBtn'), navNews: $('#navNewsBtn'),
    list: $('#newsList'), detail: $('#newsDetail'), detailCard: $('#newsDetailCard'), count: $('#newsCountChip'), lastUpdated: $('#newsLastUpdated'),
    search: $('#newsSearchInput'), topic: $('#newsTopicFilter'), impact: $('#newsImpactFilter'), read: $('#newsReadFilter'),
    sync: $('#newsSyncBtn'), importBtn: $('#newsImportBtn'), importFile: $('#newsImportFile'), status: $('#newsStatus'), markAll: $('#markAllReadBtn'),
    cloudHealth: $('#newsCloudHealth'), tableHealth: $('#newsTableHealth'), functionHealth: $('#newsFunctionHealth'), providerHealth: $('#newsProviderHealth')
  };
  if (!els.newsPage) return;

  let items = loadLocal();
  let selectedId = items[0]?.id || null;
  let session = null;
  let realtimeChannel = null;
  let readIds = loadReadIds();

  function loadLocal() {
    try { const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); return Array.isArray(parsed) ? parsed.map(normalize) : []; }
    catch { return []; }
  }
  function saveLocal() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(items)); } catch {} }
  function loadReadIds() {
    try { const parsed = JSON.parse(localStorage.getItem(READ_KEY) || '[]'); return new Set(Array.isArray(parsed) ? parsed : []); }
    catch { return new Set(); }
  }
  function saveReadIds() { try { localStorage.setItem(READ_KEY, JSON.stringify([...readIds])); } catch {} }
  function normalize(n) {
    return {
      id: n.id || uuid(), external_id: n.external_id || n.externalId || null,
      published_at: n.published_at || n.publishedAt || n.date || new Date().toISOString(),
      topic: n.topic || 'Sonstiges', title: n.title || 'Ohne Titel', summary: n.summary || '', content: n.content || n.summary || '',
      source_url: n.source_url || n.sourceUrl || n.link || '', source_name: n.source_name || n.sourceName || 'EODHD News',
      symbols: Array.isArray(n.symbols) ? n.symbols : [], tags: Array.isArray(n.tags) ? n.tags : [],
      sentiment: n.sentiment ?? null, impact: String(n.impact || 'mittel').toLowerCase(),
      priced_in: n.priced_in || n.pricedIn || 'Noch nicht bewertet', analyst_view: n.analyst_view || n.analystView || 'Noch nicht bewertet',
      market_impact: n.market_impact || n.marketImpact || '', created_at: n.created_at || n.createdAt || new Date().toISOString()
    };
  }
  function dateTime(value) {
    if (!value) return '—';
    const d = new Date(value); if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat('de-DE', {dateStyle:'short', timeStyle:'short', timeZone:'Europe/Berlin'}).format(d);
  }
  function setStatus(text, type='') { els.status.textContent = text; els.status.className = `news-status ${type}`; }
  function setHealth(element, value, type='') {
    if (!element) return;
    element.className = `news-health-item ${type}`;
    const target = $('.value', element);
    if (target) target.textContent = value;
  }
  function impactClass(value) { return value === 'hoch' ? 'bad' : value === 'niedrig' ? 'neutral' : 'warn'; }
  function filtered() {
    const query = els.search.value.trim().toLowerCase();
    return [...items].sort((a,b) => String(b.published_at).localeCompare(String(a.published_at))).filter(n => {
      const hay = [n.topic,n.title,n.summary,n.content,n.symbols.join(' '),n.tags.join(' ')].join(' ').toLowerCase();
      if (query && !hay.includes(query)) return false;
      if (els.topic.value && n.topic !== els.topic.value) return false;
      if (els.impact.value && n.impact !== els.impact.value) return false;
      const read = readIds.has(n.id);
      if (els.read.value === 'read' && !read) return false;
      if (els.read.value === 'unread' && read) return false;
      return true;
    });
  }
  function renderList() {
    const list = filtered();
    els.count.textContent = `${list.length} ${list.length === 1 ? 'Eintrag' : 'Einträge'}`;
    if (!list.length) {
      els.list.innerHTML = '<div class="news-empty">Noch keine passenden Meldungen. Melde dich in der Cloud an und tippe auf „Feed aktualisieren“ oder importiere einen News-JSON-Datensatz.</div>';
      renderDetail(null); return;
    }
    if (!list.some(n => n.id === selectedId)) selectedId = list[0].id;
    els.list.innerHTML = list.map(n => {
      const unread = !readIds.has(n.id);
      const symbols = n.symbols.slice(0,3).map(s => `<span class="chip neutral">${escapeHtml(s)}</span>`).join('');
      return `<button class="news-item ${n.id===selectedId?'selected':''} ${unread?'unread':''}" data-news-id="${escapeHtml(n.id)}">
        <div class="news-meta-row"><span class="news-topic">${escapeHtml(n.topic)}</span><span class="news-time">${escapeHtml(dateTime(n.published_at))}</span></div>
        <div class="news-title">${escapeHtml(n.title)}</div>
        <div class="news-summary">${escapeHtml(n.summary || n.content)}</div>
        <div class="news-tags"><span class="chip ${impactClass(n.impact)}">Relevanz ${escapeHtml(n.impact)}</span>${symbols}</div>
      </button>`;
    }).join('');
    $$('[data-news-id]', els.list).forEach(btn => btn.onclick = () => selectItem(btn.dataset.newsId));
    renderDetail(items.find(n => n.id === selectedId));
  }
  function renderDetail(n) {
    if (!n) { els.detail.innerHTML = '<div class="news-empty">Wähle einen Eintrag aus der Liste.</div>'; return; }
    const source = safeUrl(n.source_url);
    const symbols = n.symbols.length ? n.symbols.map(s => `<button type="button" class="btn small news-analysis-link" data-analysis-symbol="${escapeHtml(s)}"><span>${escapeHtml(s)}</span><span>Analyse öffnen →</span></button>`).join(' ') : '—';
    const tags = n.tags.length ? n.tags.map(s => `<span class="chip neutral">${escapeHtml(s)}</span>`).join(' ') : '—';
    els.detail.innerHTML = `
      <div class="news-topic">${escapeHtml(n.topic)}</div>
      <h2>${escapeHtml(n.title)}</h2>
      <div class="news-detail-meta"><span>${escapeHtml(dateTime(n.published_at))}</span><span>•</span><span>${escapeHtml(n.source_name)}</span><span class="chip ${impactClass(n.impact)}">Relevanz ${escapeHtml(n.impact)}</span></div>
      ${n.summary ? `<div class="notice"><div>◆</div><div><strong>Kernaussage:</strong> ${escapeHtml(n.summary)}</div></div>` : ''}
      <div class="news-analysis-grid">
        <div class="news-analysis-box"><div class="label">Marktauswirkung</div><div class="value">${escapeHtml(n.market_impact || 'Aus Rohmeldung noch nicht gesondert bewertet')}</div></div>
        <div class="news-analysis-box"><div class="label">Bereits eingepreist?</div><div class="value">${escapeHtml(n.priced_in)}</div></div>
        <div class="news-analysis-box"><div class="label">Analystenbild</div><div class="value">${escapeHtml(n.analyst_view)}</div></div>
      </div>
      <div class="news-detail-content">${escapeHtml(n.content || n.summary || 'Kein Volltext verfügbar.')}</div>
      <div class="news-analysis-box" style="margin-top:16px"><div class="label">Betroffene Symbole</div><div class="value">${symbols}</div></div>
      <div class="news-analysis-box" style="margin-top:10px"><div class="label">Themen-Tags</div><div class="value">${tags}</div></div>
      ${source ? `<a class="btn news-source-link" href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Originalquelle öffnen ↗</a>` : ''}`;
    $$('[data-analysis-symbol]', els.detail).forEach(button => {
      button.onclick = () => openLinkedAnalysis(button.dataset.analysisSymbol || '');
    });
  }
  function openLinkedAnalysis(symbol) {
    const dashboard = window.InvestitionDashboard;
    if (!dashboard || typeof dashboard.openAnalysisBySymbol !== 'function') {
      setStatus('Die Analyseansicht ist noch nicht vollständig geladen. Bitte Seite kurz neu öffnen.', 'bad');
      return;
    }
    const result = dashboard.openAnalysisBySymbol(symbol);
    if (!result?.ok) {
      setStatus(`Für ${symbol} wurde kein zugehöriger Trade-Plan gefunden.`, 'bad');
      return;
    }
    showPage('trading');
    setStatus(`Analyse ${result.name} geöffnet.`, 'good');
  }
  function selectItem(id) {
    selectedId = id; readIds.add(id); saveReadIds(); renderList();
    if (matchMedia('(max-width:980px)').matches) els.detailCard.scrollIntoView({behavior:'smooth', block:'start'});
  }
  function showPage(name) {
    const news = name === 'news';
    els.tradingPage.hidden = news; els.newsPage.hidden = !news;
    els.navTrading.classList.toggle('active', !news); els.navNews.classList.toggle('active', news);
    history.replaceState(null, '', news ? '#news' : '#trading');
    if (news) renderList();
  }
  async function loadCloudNews() {
    if (!sb || !session) {
      setHealth(els.cloudHealth, 'nicht angemeldet', 'warn');
      renderList();
      return;
    }
    setHealth(els.cloudHealth, session.user?.email || 'angemeldet', 'good');
    setStatus('News Feed wird aus der Cloud geladen …');
    const {data, error} = await sb.from('market_news').select('*').eq('is_published', true).order('published_at', {ascending:false}).limit(300);
    if (error) {
      setHealth(els.tableHealth, error.message, 'bad');
      setStatus(`Cloud-News konnten nicht geladen werden: ${error.message}. Führe news-schema.sql in Supabase aus.`, 'bad');
      renderList(); return;
    }
    setHealth(els.tableHealth, `erreichbar · ${(data || []).length} Zeilen`, (data || []).length ? 'good' : 'warn');
    items = (data || []).map(normalize); saveLocal();
    selectedId = items.some(n => n.id === selectedId) ? selectedId : items[0]?.id || null;
    els.lastUpdated.textContent = items[0] ? `Neueste Meldung: ${dateTime(items[0].published_at)}` : 'Cloud-Tabelle ist erreichbar, enthält aber noch keine Meldungen';
    setStatus(items.length ? `${items.length} Meldungen aus Supabase geladen.` : 'Die News-Tabelle ist leer. Tippe auf „Feed aktualisieren“.', items.length ? 'good' : '');
    renderList();
  }
  async function syncNews() {
    if (!sb || !session) {
      setHealth(els.cloudHealth, 'nicht angemeldet', 'bad');
      setStatus('Bitte zuerst über „Cloud-Anmeldung“ anmelden.', 'bad');
      return;
    }
    els.sync.disabled = true;
    setHealth(els.functionHealth, 'wird aufgerufen …', 'warn');
    setStatus('News werden serverseitig synchronisiert …');
    const {data, error} = await sb.functions.invoke('sync-news', {body:{force:true}});
    els.sync.disabled = false;
    if (error) {
      let detail = error.message || String(error);
      try {
        if (error.context instanceof Response) {
          const body = await error.context.clone().json();
          detail = body.error || body.message || detail;
        }
      } catch {}
      setHealth(els.functionHealth, detail, 'bad');
      setStatus(`Synchronisierung fehlgeschlagen: ${detail}`, 'bad');
      return;
    }
    const provider = data?.provider || data?.providers?.join?.(', ') || 'unbekannt';
    setHealth(els.functionHealth, `erfolgreich · ${data?.inserted ?? 0} gespeichert`, 'good');
    setHealth(els.providerHealth, provider, 'good');
    const sourceErrors = Array.isArray(data?.source_errors) && data.source_errors.length ? ` · Hinweise: ${data.source_errors.join(' | ')}` : '';
    setStatus(`${data?.inserted ?? 0} Meldungen gespeichert, ${data?.received ?? data?.unique ?? 0} geprüft${sourceErrors}.`, 'good');
    await loadCloudNews();
  }
  async function importNews(file) {
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = Array.isArray(parsed) ? parsed : parsed.news;
      if (!Array.isArray(incoming)) throw new Error('Kein gültiges News-Array gefunden.');
      const mapped = incoming.map(normalize);
      items = [...mapped, ...items.filter(old => !mapped.some(n => (n.external_id && n.external_id === old.external_id) || n.id === old.id))];
      saveLocal(); selectedId = mapped[0]?.id || selectedId; renderList();
      setStatus(`${mapped.length} News-Einträge lokal importiert.`, 'good');
      if (session) {
        const rows = mapped.map(n => ({...n, is_published:true}));
        const {error} = await sb.from('market_news').upsert(rows, {onConflict:'external_id'});
        if (error) setStatus(`Lokal importiert; Cloud-Upload nicht möglich: ${error.message}`, 'bad');
        else setStatus(`${mapped.length} Einträge importiert und in Supabase gespeichert.`, 'good');
      }
    } catch (e) { setStatus(`Import fehlgeschlagen: ${e.message}`, 'bad'); }
  }
  function subscribeRealtime() {
    if (!sb || !session) return;
    if (realtimeChannel) sb.removeChannel(realtimeChannel);
    realtimeChannel = sb.channel('market-news-feed').on('postgres_changes', {event:'*', schema:'public', table:'market_news'}, () => loadCloudNews()).subscribe();
  }
  async function initCloud() {
    if (!sb) {
      setHealth(els.cloudHealth, 'Supabase-Bibliothek fehlt', 'bad');
      setStatus('Supabase-Bibliothek nicht geladen.', 'bad');
      return;
    }
    const {data} = await sb.auth.getSession(); session = data.session;
    if (session) {
      setHealth(els.cloudHealth, session.user?.email || 'angemeldet', 'good');
      subscribeRealtime();
      await loadCloudNews();
    } else {
      setHealth(els.cloudHealth, 'nicht angemeldet', 'warn');
      setHealth(els.tableHealth, 'Anmeldung erforderlich', 'warn');
      setStatus('Für den Cloud-Newsfeed über „Cloud-Anmeldung“ anmelden. Lokale Imports bleiben verfügbar.');
      renderList();
    }
    sb.auth.onAuthStateChange((_event, newSession) => {
      session = newSession;
      setTimeout(() => {
        if (session) {
          setHealth(els.cloudHealth, session.user?.email || 'angemeldet', 'good');
          subscribeRealtime(); loadCloudNews();
        } else {
          setHealth(els.cloudHealth, 'nicht angemeldet', 'warn');
          setHealth(els.tableHealth, 'Anmeldung erforderlich', 'warn');
          renderList();
        }
      }, 0);
    });
  }

  els.navTrading.onclick = () => showPage('trading');
  els.navNews.onclick = () => showPage('news');
  [els.search, els.topic, els.impact, els.read].forEach(el => el.addEventListener('input', renderList));
  els.sync.onclick = syncNews;
  els.importBtn.onclick = () => els.importFile.click();
  els.importFile.onchange = async () => { const file = els.importFile.files[0]; if (file) await importNews(file); els.importFile.value=''; };
  els.markAll.onclick = () => { items.forEach(n => readIds.add(n.id)); saveReadIds(); renderList(); };
  window.addEventListener('hashchange', () => showPage(location.hash === '#news' ? 'news' : 'trading'));

  showPage(location.hash === '#news' ? 'news' : 'trading');
  renderList();
  initCloud();
})();
