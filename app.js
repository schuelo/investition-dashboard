(() => {
  (() => {
    var _a, _b;
    window.__dashboardBooted = true;
    const memoryStorage = /* @__PURE__ */ new Map();
    function storageGet(key) {
      try {
        if (window.localStorage) return window.localStorage.getItem(key);
      } catch (_e) {
      }
      return memoryStorage.has(key) ? memoryStorage.get(key) : null;
    }
    function storageSet(key, value) {
      memoryStorage.set(key, String(value));
      try {
        if (window.localStorage) window.localStorage.setItem(key, String(value));
      } catch (_e) {
      }
    }
    function uuid() {
      try {
        if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
        if (window.crypto && typeof window.crypto.getRandomValues === "function") {
          const bytes = new Uint8Array(16);
          window.crypto.getRandomValues(bytes);
          bytes[6] = bytes[6] & 15 | 64;
          bytes[8] = bytes[8] & 63 | 128;
          const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
          return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
        }
      } catch (_e) {
      }
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === "x" ? r : r & 3 | 8;
        return v.toString(16);
      });
    }
    const STORAGE_KEY = "investition-dashboard-v2";
    const LEGACY_STORAGE_KEY = "investition-dashboard-v1";
    const SUPABASE_URL = "https://pzhfybtoyfttftgcrcxk.supabase.co";
    const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_yGiDH_M0fUZglk40fCk7cQ_kkL1XKzj";
    const APP_URL = "https://schuelo.github.io/investition-dashboard/";
    const CHART_MODE_KEY = "investition-chart-mode-v1";
    const CHART_RANGE_KEY = "investition-chart-range-v1";
    const LOGIN_EMAIL_KEY = "investition-dashboard-login-email";
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const seed = [
      { id: uuid(), name: "K+S", symbol: "XETR:SDF", marketSymbol: "SDF.XETRA", currency: "EUR", type: "Aktie", direction: "Neutral", horizon: "6\u201312 Monate", status: "Analyse \xFCbertragen", analysisDate: "2026-07-14", source: "K+S Aktienanalyse Juli 2026", monitoringEnabled: true, alertKoDistancePct: "10", notes: "Entry-, Stop- und Zielzonen aus der K+S-Analyse eintragen. Die Marken werden nicht automatisch erfunden." },
      { id: uuid(), name: "SK hynix", symbol: "KRX:000660", marketSymbol: "000660.KO", currency: "KRW", type: "Aktie", direction: "Neutral", horizon: "Kurzfristig", status: "Analyse \xFCbertragen", analysisDate: "2026-07-14", source: "SK Hynix Analyse 2026", monitoringEnabled: true, alertKoDistancePct: "10", notes: "Analysewerte aus dem bestehenden Chat hier eintragen. Keine Zielmarken wurden automatisch erfunden." },
      { id: uuid(), name: "Volkswagen Vz.", symbol: "XETR:VOW3", marketSymbol: "VOW3.XETRA", currency: "EUR", type: "Aktie", direction: "Neutral", horizon: "3\u20136 Monate", status: "Analyse \xFCbertragen", analysisDate: "2026-07-14", source: "Volkswagen Aktie Analyse", monitoringEnabled: true, alertKoDistancePct: "10", notes: "Entry-, Stop- und Zielzonen aus der Analyse \xFCbertragen." },
      { id: uuid(), name: "Akzo Nobel", symbol: "EURONEXT:AKZA", marketSymbol: "AKZA.AS", currency: "EUR", type: "Aktie", direction: "Neutral", horizon: "3\u20136 Monate", status: "Analyse \xFCbertragen", analysisDate: "2026-07-13", source: "Aktienanalyse Akzo Nobel", monitoringEnabled: true, alertKoDistancePct: "10", notes: "Entry-, Stop- und Zielzonen aus der Analyse \xFCbertragen." },
      { id: uuid(), name: "CATL", symbol: "SZSE:300750", marketSymbol: "300750.SHE", currency: "CNY", type: "Aktie", direction: "Neutral", horizon: "3\u20136 Monate", status: "Analyse \xFCbertragen", analysisDate: "2026-07-13", source: "CATL Analyse", monitoringEnabled: true, alertKoDistancePct: "10", notes: "Entry-, Stop- und Zielzonen aus der Analyse \xFCbertragen." }
    ];
    const symbolPresets = {
      ks: { name: "K+S", symbol: "XETR:SDF", marketSymbol: "SDF.XETRA", currency: "EUR" },
      vw: { name: "Volkswagen Vz.", symbol: "XETR:VOW3", marketSymbol: "VOW3.XETRA", currency: "EUR" },
      skhynix: { name: "SK hynix", symbol: "KRX:000660", marketSymbol: "000660.KO", currency: "KRW" },
      akzo: { name: "Akzo Nobel", symbol: "EURONEXT:AKZA", marketSymbol: "AKZA.AS", currency: "EUR" },
      catl: { name: "CATL", symbol: "SZSE:300750", marketSymbol: "300750.SHE", currency: "CNY" }
    };
    const $ = (q, el = document) => el.querySelector(q);
    const $$ = (q, el = document) => [...el.querySelectorAll(q)];
    const els = {
      tickerHost: $("#tickerHost"),
      chartHost: $("#chartHost"),
      chartCaption: $("#chartCaption"),
      chartStatus: $("#chartStatus"),
      chartMode: $("#chartMode"),
      chartRange: $("#chartRange"),
      chartRangeButtons: $("#chartRangeButtons"),
      chartRefreshBtn: $("#chartRefreshBtn"),
      symbolSelect: $("#symbolSelect"),
      setupPanel: $("#setupPanel"),
      setupStatusChip: $("#setupStatusChip"),
      tradeRows: $("#tradeRows"),
      rowCountChip: $("#rowCountChip"),
      searchInput: $("#searchInput"),
      typeFilter: $("#typeFilter"),
      directionFilter: $("#directionFilter"),
      statusFilter: $("#statusFilter"),
      modal: $("#modalBackdrop"),
      form: $("#tradeForm"),
      modalTitle: $("#modalTitle"),
      deleteBtn: $("#deleteBtn"),
      importFile: $("#importFile"),
      koSection: $("#koSection"),
      cloudModal: $("#cloudModal"),
      cloudBtn: $("#cloudBtn"),
      cloudDot: $("#cloudDot"),
      cloudLabel: $("#cloudLabel"),
      cloudMessage: $("#cloudMessage"),
      loggedOutBox: $("#loggedOutBox"),
      loggedInBox: $("#loggedInBox"),
      telegramBox: $("#telegramBox"),
      signalsBox: $("#signalsBox"),
      telegramCode: $("#telegramCode"),
      telegramStatus: $("#telegramStatus"),
      signalList: $("#signalList"),
      userEmail: $("#userEmail"),
      alarmHealthBox: $("#alarmHealthBox"),
      alarmHealthSummary: $("#alarmHealthSummary"),
      runAlertsBtn: $("#runAlertsBtn"),
      newPassword: $("#newPassword"),
      newPasswordConfirm: $("#newPasswordConfirm"),
      authGate: $("#authGate"),
      appShell: $("#appShell"),
      gateForm: $("#authGateForm"),
      gateEmail: $("#gateLoginEmail"),
      gatePassword: $("#gateLoginPassword"),
      gateMessage: $("#gateMessage"),
      gateLoginBtn: $("#gateLoginBtn"),
      gateSetupLinkBtn: $("#gateSetupLinkBtn"),
      symbolPreset: $("#symbolPreset"),
      chartSymbolPreview: $("#chartSymbolPreview"),
      marketSymbolPreview: $("#marketSymbolPreview")
    };
    const sb = (_a = window.supabase) == null ? void 0 : _a.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } });
    let trades = [];
    let selectedId = null;
    let session = null;
    let realtimeChannel = null;
    let telegramLinkCode = "";
    let cloudBusy = false;
    let currentChartKey = "";
    let lastChartReloadAt = 0;
    let chartAutoRefreshTimer = null;
    const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
    let lastActivityAt = Date.now();
    let idleTimer = null;
    let lockReason = "";
    let widgetsStarted = false;
    function emitDashboardEvent(name, detail = {}) {
      try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (_e) {}
    }
    function loadLocal() {
      return [];
    }
    function normalizeTrade(t = {}) {
      const id = isUuid(t.id) ? t.id : uuid();
      return {
        monitoringEnabled: true,
        alertKoDistancePct: "10",
        ...t,
        id,
        monitoringEnabled: bool(t.monitoringEnabled, true),
        alertEntry: bool(t.alertEntry),
        alertLimit: bool(t.alertLimit),
        alertStop: bool(t.alertStop),
        alertTarget1: bool(t.alertTarget1),
        alertTarget2: bool(t.alertTarget2),
        alertTarget3: bool(t.alertTarget3),
        alertKo: bool(t.alertKo)
      };
    }
    function saveLocal() {
      // Version 28.2 arbeitet ausschließlich in der Cloud. Persönliche Daten
      // bleiben nur für die laufende Sitzung im Arbeitsspeicher.
      emitDashboardEvent("investition:data-changed", { trades: trades.map((trade) => ({ ...trade })) });
    }
    function purgePersonalBrowserData() {
      try {
        const explicitKeys = new Set([
          STORAGE_KEY,
          LEGACY_STORAGE_KEY,
          "investition-news-feed-v1",
          "investition-news-read-v1",
          LOGIN_EMAIL_KEY
        ]);
        for (let index = localStorage.length - 1; index >= 0; index -= 1) {
          const key = localStorage.key(index);
          if (!key) continue;
          if (explicitKeys.has(key) || key.startsWith("investition-decision-v25-")) localStorage.removeItem(key);
        }
      } catch (_e) {}
    }
    function isUuid(v) {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v || "");
    }
    function uid() {
      return uuid();
    }
    function bool(v, fallback = false) {
      if (v === void 0 || v === null || v === "") return fallback;
      return v === true || v === "true" || v === "on" || v === 1;
    }
    function num(v) {
      if (v === null || v === void 0 || v === "") return null;
      let s = String(v).trim().replace(/\s/g, "");
      const dots = (s.match(/\./g) || []).length, commas = (s.match(/,/g) || []).length;
      if (dots && commas) {
        if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
        else s = s.replace(/,/g, "");
      } else if (commas) {
        if (commas > 1) {
          const last = s.lastIndexOf(",");
          s = s.slice(0, last).replace(/,/g, "") + "." + s.slice(last + 1);
        } else s = s.replace(",", ".");
      } else if (dots > 1) {
        const last = s.lastIndexOf("."), groups = s.split(".");
        s = groups.slice(1).every((g) => g.length === 3) ? groups.join("") : s.slice(0, last).replace(/\./g, "") + "." + s.slice(last + 1);
      }
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }
    function displayNum(v, currency = "", max = 2) {
      const n = num(v);
      if (n === null) return "\u2014";
      return new Intl.NumberFormat("de-DE", { maximumFractionDigits: max }).format(n) + (currency ? " " + currency : "");
    }
    function displayDate(v) {
      if (!v) return "\u2014";
      const d = /* @__PURE__ */ new Date(String(v).slice(0, 10) + "T12:00:00");
      return Number.isNaN(d.getTime()) ? v : new Intl.DateTimeFormat("de-DE").format(d);
    }
    function displayDateTime(v) {
      if (!v) return "\u2014";
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? v : new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(d);
    }
    function escapeHtml(s = "") {
      return String(s).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
    }
    function midpoint(t) {
      var _a2;
      const a = num(t.entryLow), b = num(t.entryHigh), l = num(t.limitPrice);
      if (a !== null && b !== null) return (a + b) / 2;
      return (_a2 = a != null ? a : b) != null ? _a2 : l;
    }
    function rr(t) {
      const e = midpoint(t), s = num(t.stop), target = num(t.target1);
      if ([e, s, target].some((x) => x === null)) return null;
      const risk = Math.abs(e - s), reward = Math.abs(target - e);
      return risk > 0 ? reward / risk : null;
    }
    function chipClass(value) {
      if (["Long", "Position offen", "Teilverkauf"].includes(value)) return "good";
      if (["Short", "Verworfen"].includes(value)) return "bad";
      if (["Limit aktiv", "Beobachten", "Analyse \xFCbertragen"].includes(value)) return "warn";
      return "neutral";
    }
    function filteredTrades() {
      const q = els.searchInput.value.trim().toLowerCase();
      return trades.filter((t) => {
        const hay = [t.name, t.symbol, t.marketSymbol, t.wkn, t.isin, t.notes, t.source, t.issuer].join(" ").toLowerCase();
        return (!q || hay.includes(q)) && (!els.typeFilter.value || t.type === els.typeFilter.value) && (!els.directionFilter.value || t.direction === els.directionFilter.value) && (!els.statusFilter.value || t.status === els.statusFilter.value);
      });
    }
    function initTicker() {
      els.tickerHost.innerHTML = '<div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div></div>';
      const s = document.createElement("script");
      s.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
      s.async = true;
      s.onerror = () => { els.tickerHost.innerHTML = '<div class="chart-placeholder">TradingView-Ticker konnte nicht geladen werden. Dashboard und Alarme funktionieren weiterhin.</div>'; };
      s.textContent = JSON.stringify({ symbols: [{ proName: "KRX:000660", title: "SK hynix" }, { proName: "XETR:VOW3", title: "Volkswagen Vz." }, { proName: "XETR:SDF", title: "K+S" }, { proName: "EURONEXT:AKZA", title: "Akzo Nobel" }, { proName: "SZSE:300750", title: "CATL" }, { proName: "FOREXCOM:SPXUSD", title: "S&P 500" }, { proName: "FOREXCOM:NSXUSD", title: "Nasdaq 100" }, { proName: "TVC:SOX", title: "Semiconductor Index" }, { proName: "FX:EURUSD", title: "EUR/USD" }], showSymbolLogo: true, isTransparent: true, displayMode: "adaptive", colorTheme: "dark", locale: "de" });
      $(".tradingview-widget-container", els.tickerHost).appendChild(s);
    }
    function renderSymbolSelect() {
      const unique = [], seen = /* @__PURE__ */ new Set();
      trades.forEach((t) => {
        if (t.symbol && !seen.has(t.symbol)) {
          seen.add(t.symbol);
          unique.push(t);
        }
      });
      els.symbolSelect.innerHTML = unique.length ? unique.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)} \xB7 ${escapeHtml(t.symbol)}</option>`).join("") : "<option>Keine Instrumente</option>";
      if (selectedId && trades.some((t) => t.id === selectedId)) els.symbolSelect.value = selectedId;
    }
    function setChartStatus(message, detail = "") {
      if (!els.chartStatus) return;
      els.chartStatus.innerHTML = `<span>${escapeHtml(message)}</span>${detail ? `<span>${escapeHtml(detail)}</span>` : ""}`;
    }
    function syncTimeframeButtons(mode, range) {
      if (els.chartRangeButtons) {
        els.chartRangeButtons.classList.toggle("hidden", mode !== "overview");
        $$('[data-chart-range]', els.chartRangeButtons).forEach((button) => {
          button.classList.toggle("active", button.dataset.chartRange === range);
          button.setAttribute("aria-pressed", button.dataset.chartRange === range ? "true" : "false");
        });
      }
    }
    function chartPrefs() {
      const mode = els.chartMode.value || storageGet(CHART_MODE_KEY) || "overview";
      const range = els.chartRange.value || storageGet(CHART_RANGE_KEY) || "12M";
      els.chartMode.value = mode;
      els.chartRange.value = range;
      syncTimeframeButtons(mode, range);
      return { mode, range };
    }
    function renderChart(force = false) {
      const t = trades.find((x) => x.id === selectedId) || trades[0];
      if (!(t == null ? void 0 : t.symbol)) {
        els.chartHost.innerHTML = '<div class="chart-placeholder">Noch kein TradingView-Symbol hinterlegt.</div>';
        setChartStatus("Kein TradingView-Symbol hinterlegt.");
        return;
      }
      const prefs = chartPrefs();
      const key = `${t.symbol}|${prefs.mode}|${prefs.range}`;
      if (!force && key === currentChartKey && els.chartHost.querySelector("iframe")) return;
      currentChartKey = key;
      lastChartReloadAt = Date.now();
      els.chartCaption.textContent = `${t.name} · ${t.symbol} · ${prefs.mode === "overview" ? "Zeitraum " + prefs.range : "Analysechart · Tagesintervall"}`;
      els.chartHost.innerHTML = '<div class="tradingview-widget-container" style="height:100%;width:100%"><div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div></div>';
      const s = document.createElement("script");
      s.async = true;
      s.onerror = () => {
        els.chartHost.innerHTML = '<div class="chart-placeholder">TradingView-Chart konnte nicht geladen werden. Prüfe Internet-, Datenschutz- oder Inhaltsblocker.</div>';
        setChartStatus("TradingView konnte nicht geladen werden.", "Dashboard-Alarme arbeiten davon unabhängig.");
      };
      if (prefs.mode === "overview") {
        s.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
        s.textContent = JSON.stringify({
          symbols: [[t.name, `${t.symbol}|${prefs.range}`]],
          chartOnly: false,
          width: "100%",
          height: "100%",
          locale: "de",
          colorTheme: "dark",
          autosize: true,
          showVolume: true,
          showMA: false,
          hideDateRanges: false,
          hideMarketStatus: false,
          hideSymbolLogo: false,
          scalePosition: "right",
          scaleMode: "Normal",
          fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
          fontSize: "10",
          noTimeScale: false,
          valuesTracking: "1",
          changeMode: "price-and-percent",
          chartType: "area",
          dateRanges: ["1d|1", "5d|5", "1m|30", "3m|60", "6m|120", "12m|1D", "60m|1W", "all|1M"]
        });
      } else {
        s.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        s.textContent = JSON.stringify({
          autosize: true,
          symbol: t.symbol,
          interval: "D",
          timezone: "exchange",
          theme: "dark",
          style: "1",
          locale: "de",
          allow_symbol_change: true,
          calendar: false,
          details: true,
          hide_side_toolbar: false,
          hide_top_toolbar: false,
          hide_legend: false,
          hide_volume: false,
          backgroundColor: "rgba(7,16,25,1)",
          gridColor: "rgba(36,56,74,.38)",
          withdateranges: true,
          save_image: false,
          support_host: "https://www.tradingview.com"
        });
      }
      $(".tradingview-widget-container", els.chartHost).appendChild(s);
      const loaded = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
      setChartStatus(`Widget neu geladen: ${loaded}`, "Im Kursverlauf wird der Zeitraum über die Schalter oberhalb des Charts gesetzt. Der Analysechart verwendet das Tagesintervall. TradingView-Daten können je Handelsplatz verzögert sein.");
    }
    function ladder(t) {
      const raw = [["Ziel 3", num(t.target3), "#4ad295"], ["Ziel 2", num(t.target2), "#4ad295"], ["Ziel 1", num(t.target1), "#4ad295"], ["Live/Referenz", num(t.currentPrice), "#63a9ff"], ["Limit", num(t.limitPrice), "#f5bd4f"], ["Entry oben", num(t.entryHigh), "#50d2c2"], ["Entry unten", num(t.entryLow), "#50d2c2"], ["Stop", num(t.stop), "#ff6b7a"], ["KO", num(t.koBarrier), "#ff6b7a"]].filter((x) => x[1] !== null);
      if (!raw.length) return '<div class="ladder-empty">Noch keine Kursmarken hinterlegt.</div>';
      const values = raw.map((x) => x[1]), min = Math.min(...values), max = Math.max(...values), pad = Math.max((max - min) * 0.1, Math.abs(max || 1) * 0.02), lo = min - pad, hi = max + pad;
      return `<div class="ladder"><div class="ladder-axis"></div><div class="ladder-tick" style="top:25%"></div><div class="ladder-tick" style="top:50%"></div><div class="ladder-tick" style="top:75%"></div>${raw.map(([label, value, color]) => {
        const top = 100 - (value - lo) / (hi - lo) * 100;
        return `<div class="ladder-item" style="top:${top}%"><div class="ladder-label">${label}</div><div class="ladder-dot" style="background:${color}"></div><div class="ladder-line" style="background:${color}"></div><div class="ladder-value" style="color:${color}">${displayNum(value, t.currency)}</div></div>`;
      }).join("")}</div>`;
    }
    function alertSummary(t) {
      const names = [];
      if (t.alertEntry) names.push("Entry");
      if (t.alertLimit) names.push("Limit");
      if (t.alertStop) names.push("Stop");
      if (t.alertTarget1) names.push("Z1");
      if (t.alertTarget2) names.push("Z2");
      if (t.alertTarget3) names.push("Z3");
      if (t.alertKo) names.push("KO");
      return !t.monitoringEnabled ? "\xDCberwachung aus" : names.length ? names.join(", ") : "keine Marken aktiv";
    }
    function renderSetup() {
      const t = trades.find((x) => x.id === selectedId);
      if (!t) {
        els.setupStatusChip.className = "chip neutral";
        els.setupStatusChip.textContent = "Kein Plan";
        els.setupPanel.innerHTML = '<div class="ladder-empty">Lege einen Trade-Plan an oder importiere vorhandene Daten.</div>';
        return;
      }
      els.setupStatusChip.className = `chip ${chipClass(t.status)}`;
      els.setupStatusChip.textContent = t.status || "Offen";
      const entryText = [t.entryLow, t.entryHigh].filter(Boolean).length ? `${displayNum(t.entryLow, t.currency)} \u2013 ${displayNum(t.entryHigh, t.currency)}` : displayNum(t.limitPrice, t.currency);
      const r = rr(t);
      const koMeta = t.type === "Knock-out" ? `${t.wkn || t.isin || "Kennung offen"}${t.leverage ? " \xB7 Hebel " + displayNum(t.leverage, "", 1) : ""}` : "Direktinvestment";
      els.setupPanel.innerHTML = `<div class="setup-title-row"><div><div class="setup-name">${escapeHtml(t.name)}</div><div class="setup-meta">Chart: ${escapeHtml(t.symbol || "nicht gesetzt")} \xB7 Alarm: ${escapeHtml(t.marketSymbol || "nicht gesetzt")}</div><div class="setup-meta">${escapeHtml(t.type)} \xB7 ${escapeHtml(t.direction)} \xB7 ${escapeHtml(t.horizon || "")}</div></div><span class="chip ${chipClass(t.direction)}">${escapeHtml(t.direction || "Neutral")}</span></div><div class="setup-grid"><div class="metric"><div class="m-label">Entry / Limit</div><div class="m-value">${entryText}</div><div class="m-sub">geplante Ausf\xFChrung</div></div><div class="metric"><div class="m-label">Stop / Invalidation</div><div class="m-value">${displayNum(t.stop, t.currency)}</div><div class="m-sub">maximale These-Grenze</div></div><div class="metric"><div class="m-label">Ziele</div><div class="m-value">${displayNum(t.target1, t.currency)} / ${displayNum(t.target2, t.currency)}</div><div class="m-sub">Teilgewinn / Hauptziel</div></div><div class="metric"><div class="m-label">Chance/Risiko</div><div class="m-value">${r === null ? "\u2014" : r.toFixed(2)}</div><div class="m-sub">auf Ziel 1 gerechnet</div></div><div class="metric"><div class="m-label">Produkt</div><div class="m-value">${escapeHtml(koMeta)}</div><div class="m-sub">${t.type === "Knock-out" ? "KO " + displayNum(t.koBarrier, t.currency) : "Aktie"}</div></div><div class="metric"><div class="m-label">Alarme</div><div class="m-value">${escapeHtml(alertSummary(t))}</div><div class="m-sub">EODHD: ${escapeHtml(t.marketSymbol || "nicht gesetzt")}</div></div></div><div class="ladder-wrap"><div class="ladder-head"><span>Kursleiter</span><span>${t.currentPrice ? "letzter Kurs " + displayDateTime(t.currentPriceAt) : "noch kein Serverkurs"}</span></div>${ladder(t)}</div><div class="notes ${t.notes ? "" : "muted"}">${escapeHtml(t.notes || "Noch keine Investment-These hinterlegt.")}</div><div class="setup-actions"><button class="btn small primary" data-action="edit">Bearbeiten</button><button class="btn small" data-action="duplicate">Duplizieren</button></div>`;
      $('[data-action="edit"]', els.setupPanel).onclick = () => openModal(t);
      $('[data-action="duplicate"]', els.setupPanel).onclick = () => duplicateTrade(t);
    }
    function renderTable() {
      const rows = filteredTrades();
      els.rowCountChip.textContent = `${rows.length} ${rows.length === 1 ? "Plan" : "Pl\xE4ne"}`;
      if (!rows.length) {
        els.tradeRows.innerHTML = '<tr><td colspan="10" class="empty-table">Keine passenden Trade-Pl\xE4ne gefunden.</td></tr>';
        return;
      }
      els.tradeRows.innerHTML = rows.map((t) => {
        const r = rr(t), selected = t.id === selectedId ? "selected" : "", entry = t.entryLow || t.entryHigh ? `${displayNum(t.entryLow, t.currency)} \u2013 ${displayNum(t.entryHigh, t.currency)}` : "\u2014", ko = t.type === "Knock-out" ? `${displayNum(t.koBarrier, t.currency)}${t.leverage ? '<div class="cell-sub">Hebel ' + displayNum(t.leverage, "", 1) + "</div>" : ""}` : "\u2014";
        return `<tr class="${selected}" data-id="${escapeHtml(t.id)}"><td><strong>${escapeHtml(t.name)}</strong><div class="cell-sub">Chart: ${escapeHtml(t.symbol || "nicht gesetzt")}</div><div class="cell-sub">Alarm: ${escapeHtml(t.marketSymbol || "nicht gesetzt")}${t.wkn ? " \xB7 " + escapeHtml(t.wkn) : ""}</div></td><td><span class="chip ${chipClass(t.direction)}">${escapeHtml(t.direction)}</span><div class="cell-sub">${escapeHtml(t.type)}</div></td><td><span class="chip ${chipClass(t.status)}">${escapeHtml(t.status)}</span><div class="cell-sub">${escapeHtml(alertSummary(t))}</div></td><td class="num">${entry}</td><td class="num">${displayNum(t.limitPrice, t.currency)}</td><td class="num">${displayNum(t.stop, t.currency)}</td><td class="num">${displayNum(t.target1, t.currency)} / ${displayNum(t.target2, t.currency)}</td><td class="num">${ko}</td><td class="num">${r === null ? "\u2014" : r.toFixed(2)}</td><td>${displayDate(t.reviewDate)}<div class="cell-sub">Analyse ${displayDate(t.analysisDate)}</div></td></tr>`;
      }).join("");
      $$("tbody tr[data-id]", els.tradeRows).forEach((row) => row.onclick = () => selectTrade(row.dataset.id));
    }
    function renderKpis() {
      const list = filteredTrades(), active = list.filter((t) => ["Limit aktiv", "Position offen", "Teilverkauf"].includes(t.status)), longs = list.filter((t) => t.direction === "Long").length, shorts = list.filter((t) => t.direction === "Short").length, rrs = list.map(rr).filter((x) => x !== null), risk = active.reduce((sum, t) => sum + (num(t.riskBudget) || 0), 0), currencies = [...new Set(active.filter((t) => num(t.riskBudget) !== null).map((t) => t.currency).filter(Boolean))], upcoming = list.filter((t) => t.reviewDate).sort((a, b) => a.reviewDate.localeCompare(b.reviewDate))[0];
      $("#kpiActive").textContent = active.length;
      $("#kpiActiveSub").textContent = active.length ? `${active.filter((t) => t.status === "Position offen").length} Positionen offen` : "keine aktiven Positionen";
      $("#kpiDirection").textContent = `${longs} / ${shorts}`;
      $("#kpiRR").textContent = rrs.length ? (rrs.reduce((a, b) => a + b, 0) / rrs.length).toFixed(2) : "\u2014";
      $("#kpiRisk").textContent = risk ? displayNum(risk, currencies.length === 1 ? currencies[0] : "") : "\u2014";
      $("#kpiReview").textContent = upcoming ? displayDate(upcoming.reviewDate) : "\u2014";
      $("#kpiReviewSub").textContent = upcoming ? upcoming.name : "kein Termin hinterlegt";
    }
    function minutesSince(value) {
      if (!value) return null;
      const time = new Date(value).getTime();
      if (!Number.isFinite(time)) return null;
      return Math.max(0, Math.round((Date.now() - time) / 60000));
    }
    function renderAlarmHealth() {
      if (!els.alarmHealthSummary) return;
      const selected = trades.find((x) => x.id === selectedId) || trades[0];
      const active = trades.filter((t) => t.monitoringEnabled && [t.alertEntry,t.alertLimit,t.alertStop,t.alertTarget1,t.alertTarget2,t.alertTarget3,t.alertKo].some(Boolean));
      const checked = active.filter((t) => t.lastCheckAt);
      const errors = active.filter((t) => t.lastCheckError);
      const last = checked.sort((a,b) => String(b.lastCheckAt).localeCompare(String(a.lastCheckAt)))[0];
      const age = last ? minutesSince(last.lastCheckAt) : null;
      const stateClass = errors.length ? "bad" : age === null ? "warn" : age > 30 ? "warn" : "good";
      const selectedQuoteAge = selected ? minutesSince(selected.currentPriceAt) : null;
      els.alarmHealthSummary.innerHTML = `
        <div class="health-item ${stateClass}"><div class="label">Letzte Serverprüfung</div><div class="value">${last ? escapeHtml(displayDateTime(last.lastCheckAt)) : "Noch keine Prüfung"}</div></div>
        <div class="health-item ${errors.length ? "bad" : "good"}"><div class="label">Aktive Pläne / Fehler</div><div class="value">${active.length} / ${errors.length}</div></div>
        <div class="health-item ${selected && selected.lastCheckError ? "bad" : "neutral"}"><div class="label">Ausgewählter Plan</div><div class="value">${selected ? escapeHtml(selected.lastCheckError || "Kein Serverfehler gespeichert") : "Kein Plan"}</div></div>
        <div class="health-item ${selectedQuoteAge !== null && selectedQuoteAge > 30 ? "warn" : "neutral"}"><div class="label">Kurszeit des Plans</div><div class="value">${selected && selected.currentPriceAt ? escapeHtml(displayDateTime(selected.currentPriceAt)) + ` · ${selectedQuoteAge} Min. alt` : "Noch kein EODHD-Kurs"}</div></div>`;
    }
    function renderAll() {
      renderSymbolSelect();
      renderChart();
      renderSetup();
      renderTable();
      renderKpis();
      renderAlarmHealth();
    }
    function selectTrade(id) {
      selectedId = id;
      currentChartKey = "";
      renderAll();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    function symbolMatchTokens(value) {
      const normalized = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
      if (!normalized) return [];
      const tokens = new Set([normalized]);
      if (normalized.includes(":")) tokens.add(normalized.split(":").pop());
      if (normalized.includes(".")) tokens.add(normalized.split(".")[0]);
      return [...tokens].filter(Boolean);
    }
    function findTradeBySymbol(symbol) {
      const wanted = new Set(symbolMatchTokens(symbol));
      if (!wanted.size) return null;
      return trades.find((trade) => {
        const available = new Set([
          ...symbolMatchTokens(trade.symbol),
          ...symbolMatchTokens(trade.marketSymbol)
        ]);
        return [...wanted].some((token) => available.has(token));
      }) || null;
    }
    window.InvestitionDashboard = Object.assign(window.InvestitionDashboard || {}, {
      version: "28.2",
      openAnalysisBySymbol(symbol) {
        const trade = findTradeBySymbol(symbol);
        if (!trade) return { ok: false, symbol, message: "Keine zugehörige Analyse gefunden." };
        selectedId = trade.id;
        currentChartKey = "";
        if (els.searchInput) els.searchInput.value = "";
        if (els.typeFilter) els.typeFilter.value = "";
        if (els.directionFilter) els.directionFilter.value = "";
        if (els.statusFilter) els.statusFilter.value = "";
        renderAll();
        emitDashboardEvent("investition:selection-changed", { trade: { ...trade } });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return { ok: true, id: trade.id, name: trade.name, symbol: trade.symbol };
      },
      hasAnalysisForSymbol(symbol) {
        return Boolean(findTradeBySymbol(symbol));
      },
      getTrades() {
        return trades.map((trade) => ({ ...trade }));
      },
      getSelectedTrade() {
        const trade = trades.find((item) => item.id === selectedId);
        return trade ? { ...trade } : null;
      },
      getSession() {
        return session;
      },
      getSupabase() {
        return sb;
      },
      selectTradeById(id) {
        const trade = trades.find((item) => item.id === id);
        if (!trade) return { ok: false, id };
        selectTrade(id);
        emitDashboardEvent("investition:selection-changed", { trade: { ...trade } });
        return { ok: true, trade: { ...trade } };
      },
      refreshFromCloud() {
        return loadCloud();
      },
      openCloudSettings() {
        els.cloudModal.classList.add("open");
      },
      lock(reason) {
        return lockSession(reason || "Sitzung gesperrt.");
      }
    });
    function normalizeSymbolInput(value) {
      return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
    }
    function alertsRequested() {
      return ["alertEntry", "alertLimit", "alertStop", "alertTarget1", "alertTarget2", "alertTarget3", "alertKo"].some((name) => els.form.elements[name].checked);
    }
    function updateSymbolPreview() {
      const chart = normalizeSymbolInput(els.form.elements.symbol.value);
      const market = normalizeSymbolInput(els.form.elements.marketSymbol.value);
      els.chartSymbolPreview.textContent = chart || "Noch kein TradingView-Symbol";
      els.marketSymbolPreview.textContent = market || "Noch kein EODHD-Symbol";
      validateSymbolFields(false);
    }
    function validateSymbolFields(showMessage = true) {
      const chartInput = els.form.elements.symbol;
      const marketInput = els.form.elements.marketSymbol;
      const chart = normalizeSymbolInput(chartInput.value);
      const market = normalizeSymbolInput(marketInput.value);
      const needsMarket = els.form.elements.monitoringEnabled.checked || alertsRequested();
      chartInput.setCustomValidity("");
      marketInput.setCustomValidity("");
      chartInput.classList.remove("symbol-valid", "symbol-invalid");
      marketInput.classList.remove("symbol-valid", "symbol-invalid");
      if (!chart || !/^[A-Z0-9._-]+:[A-Z0-9._-]+$/.test(chart)) {
        chartInput.setCustomValidity("TradingView benötigt das Format BÖRSE:TICKER, z. B. XETR:SDF.");
        if (chart || showMessage) chartInput.classList.add("symbol-invalid");
      } else {
        chartInput.classList.add("symbol-valid");
      }
      if (needsMarket && !market) {
        marketInput.setCustomValidity("Für Überwachung und Telegram-Alarme ist ein EODHD-Symbol erforderlich, z. B. SDF.XETRA.");
        if (showMessage) marketInput.classList.add("symbol-invalid");
      } else if (market && !/^[A-Z0-9._-]+\.[A-Z0-9._-]+$/.test(market)) {
        marketInput.setCustomValidity("EODHD benötigt das Format TICKER.BÖRSENCODE, z. B. SDF.XETRA. Verwende einen Punkt, keinen Doppelpunkt.");
        marketInput.classList.add("symbol-invalid");
      } else if (market) {
        marketInput.classList.add("symbol-valid");
      }
      const valid = chartInput.checkValidity() && marketInput.checkValidity();
      if (!valid && showMessage) {
        const first = !chartInput.checkValidity() ? chartInput : marketInput;
        first.reportValidity();
        first.focus();
      }
      return valid;
    }
    function applySymbolPreset() {
      const preset = symbolPresets[els.symbolPreset.value];
      if (!preset) return;
      for (const key of ["name", "symbol", "marketSymbol", "currency"]) {
        const field = els.form.elements[key];
        if (field) field.value = preset[key];
      }
      updateSymbolPreview();
    }
    function openModal(t = null) {
      els.form.reset();
      const data = t || { id: "", type: "Aktie", direction: "Neutral", horizon: "Kurzfristig", status: "Analyse \xFCbertragen", analysisDate: today, monitoringEnabled: true, alertKoDistancePct: "10" };
      Object.entries(data).forEach(([k, v]) => {
        const f = els.form.elements[k];
        if (!f || v === void 0 || v === null) return;
        if (f.type === "checkbox") f.checked = bool(v);
        else f.value = v;
      });
      els.modalTitle.textContent = t ? `Trade-Plan bearbeiten \xB7 ${t.name}` : "Neuen Trade-Plan anlegen";
      els.deleteBtn.classList.toggle("hidden", !t);
      els.symbolPreset.value = "";
      toggleKo();
      updateSymbolPreview();
      els.modal.classList.add("open");
    }
    function closeModal() {
      els.modal.classList.remove("open");
    }
    function toggleKo() {
      els.koSection.classList.toggle("hidden", els.form.elements.type.value !== "Knock-out");
    }
    async function duplicateTrade(t) {
      const c = { ...t, id: uid(), name: t.name + " \xB7 Kopie", status: "Beobachten" };
      trades.unshift(c);
      selectedId = c.id;
      saveLocal();
      renderAll();
      if (session) await upsertCloud(c, true);
    }
    async function deleteSelected() {
      var _a2;
      const id = els.form.elements.id.value;
      if (!id) return;
      if (!confirm("Diesen Trade-Plan wirklich l\xF6schen?")) return;
      trades = trades.filter((t) => t.id !== id);
      selectedId = ((_a2 = trades[0]) == null ? void 0 : _a2.id) || null;
      saveLocal();
      closeModal();
      renderAll();
      if (session) {
        const { error } = await sb.from("trade_plans").delete().eq("id", id);
        if (error) showCloudMessage("Cloud-L\xF6schung fehlgeschlagen: " + error.message, false);
      }
    }
    function collectForm() {
      const fd = new FormData(els.form), data = Object.fromEntries(fd.entries());
      for (const n of ["monitoringEnabled", "alertEntry", "alertLimit", "alertStop", "alertTarget1", "alertTarget2", "alertTarget3", "alertKo"]) data[n] = els.form.elements[n].checked;
      data.id = data.id || uid();
      data.symbol = normalizeSymbolInput(data.symbol);
      data.marketSymbol = normalizeSymbolInput(data.marketSymbol);
      data.currency = normalizeSymbolInput(data.currency);
      return normalizeTrade(data);
    }
    els.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!validateSymbolFields(true)) return;
      const data = collectForm(), idx = trades.findIndex((t) => t.id === data.id);
      if (idx >= 0) trades[idx] = data;
      else trades.unshift(data);
      selectedId = data.id;
      saveLocal();
      closeModal();
      renderAll();
      if (session) await upsertCloud(data, true);
    });
    els.form.elements.type.addEventListener("change", toggleKo);
    els.symbolPreset.addEventListener("change", applySymbolPreset);
    els.form.elements.symbol.addEventListener("input", updateSymbolPreview);
    els.form.elements.marketSymbol.addEventListener("input", updateSymbolPreview);
    els.form.elements.monitoringEnabled.addEventListener("change", updateSymbolPreview);
    for (const name of ["alertEntry", "alertLimit", "alertStop", "alertTarget1", "alertTarget2", "alertTarget3", "alertKo"]) {
      els.form.elements[name].addEventListener("change", updateSymbolPreview);
    }
    function toRow(t) {
      var _a2;
      return { id: t.id, user_id: session.user.id, name: t.name, symbol: t.symbol, market_symbol: t.marketSymbol || null, currency: t.currency || null, instrument_type: t.type || "Aktie", direction: t.direction || "Neutral", horizon: t.horizon || null, status: t.status || null, analysis_date: t.analysisDate || null, review_date: t.reviewDate || null, source: t.source || null, notes: t.notes || null, reference_price: num(t.currentPrice), entry_low: num(t.entryLow), entry_high: num(t.entryHigh), limit_price: num(t.limitPrice), stop_price: num(t.stop), target1: num(t.target1), target2: num(t.target2), target3: num(t.target3), risk_budget: num(t.riskBudget), quantity: num(t.quantity), position_value: num(t.positionValue), order_ref: t.orderRef || null, wkn: t.wkn || null, isin: t.isin || null, issuer: t.issuer || null, expiry: t.expiry || null, ko_barrier: num(t.koBarrier), strike_price: num(t.strike), leverage: num(t.leverage), ratio: num(t.ratio), product_price: num(t.productPrice), ko_distance_pct: num(t.koDistance), monitoring_enabled: bool(t.monitoringEnabled, true), alert_entry: bool(t.alertEntry), alert_limit: bool(t.alertLimit), alert_stop: bool(t.alertStop), alert_target1: bool(t.alertTarget1), alert_target2: bool(t.alertTarget2), alert_target3: bool(t.alertTarget3), alert_ko: bool(t.alertKo), alert_ko_distance_pct: (_a2 = num(t.alertKoDistancePct)) != null ? _a2 : 10 };
    }
    function fromRow(r) {
      var _a2, _b2, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s;
      return normalizeTrade({ id: r.id, name: r.name, symbol: r.symbol, marketSymbol: r.market_symbol || "", currency: r.currency || "", type: r.instrument_type, direction: r.direction, horizon: r.horizon || "", status: r.status || "", analysisDate: r.analysis_date || "", reviewDate: r.review_date || "", source: r.source || "", notes: r.notes || "", currentPrice: (_b2 = (_a2 = r.last_price) != null ? _a2 : r.reference_price) != null ? _b2 : "", currentPriceAt: r.last_price_at || "", entryLow: (_c = r.entry_low) != null ? _c : "", entryHigh: (_d = r.entry_high) != null ? _d : "", limitPrice: (_e = r.limit_price) != null ? _e : "", stop: (_f = r.stop_price) != null ? _f : "", target1: (_g = r.target1) != null ? _g : "", target2: (_h = r.target2) != null ? _h : "", target3: (_i = r.target3) != null ? _i : "", riskBudget: (_j = r.risk_budget) != null ? _j : "", quantity: (_k = r.quantity) != null ? _k : "", positionValue: (_l = r.position_value) != null ? _l : "", orderRef: r.order_ref || "", wkn: r.wkn || "", isin: r.isin || "", issuer: r.issuer || "", expiry: r.expiry || "", koBarrier: (_m = r.ko_barrier) != null ? _m : "", strike: (_n = r.strike_price) != null ? _n : "", leverage: (_o = r.leverage) != null ? _o : "", ratio: (_p = r.ratio) != null ? _p : "", productPrice: (_q = r.product_price) != null ? _q : "", koDistance: (_r = r.ko_distance_pct) != null ? _r : "", monitoringEnabled: r.monitoring_enabled, alertEntry: r.alert_entry, alertLimit: r.alert_limit, alertStop: r.alert_stop, alertTarget1: r.alert_target1, alertTarget2: r.alert_target2, alertTarget3: r.alert_target3, alertKo: r.alert_ko, alertKoDistancePct: (_s = r.alert_ko_distance_pct) != null ? _s : 10 });
    }
    async function upsertCloud(t, resetState = false) {
      if (!session) return false;
      setCloudState("syncing", "Synchronisiert …");
      const { error } = await sb.from("trade_plans").upsert(toRow(t));
      if (error) {
        setCloudState("error", "Cloud-Fehler");
        showCloudMessage(error.message, false);
        return false;
      }
      if (resetState) await sb.from("alert_state").delete().eq("trade_id", t.id);
      setCloudState("online", "Cloud");
      return true;
    }
    async function uploadAllLocal() {
      if (!session) return;
      setBusy(true);
      const rows = trades.map(toRow);
      const { error } = await sb.from("trade_plans").upsert(rows);
      setBusy(false);
      if (error) return showCloudMessage("Upload fehlgeschlagen: " + error.message, false);
      showCloudMessage(`${rows.length} Pl\xE4ne wurden in die Cloud \xFCbernommen.`, true);
      await loadCloud();
    }
    async function loadAlertHealthMap() {
      const map = new Map();
      if (!session) return map;
      let result = await sb.from("alert_state").select("trade_id,checked_at,quote_at,last_error,data_source");
      if (result.error && /quote_at|last_error|data_source/i.test(result.error.message || "")) {
        result = await sb.from("alert_state").select("trade_id,checked_at");
      }
      if (result.error) return map;
      for (const row of result.data || []) {
        map.set(row.trade_id, {
          lastCheckAt: row.checked_at || "",
          quoteAt: row.quote_at || "",
          lastCheckError: row.last_error || "",
          dataSource: row.data_source || ""
        });
      }
      return map;
    }
    async function loadCloud() {
      var _a2;
      if (!session) return;
      setCloudState("syncing", "L\xE4dt \u2026");
      const { data, error } = await sb.from("trade_plans").select("*").order("updated_at", { ascending: false });
      if (error) {
        setCloudState("error", "Cloud-Fehler");
        showCloudMessage(error.message, false);
        return;
      }
      if (data == null ? void 0 : data.length) {
        const health = await loadAlertHealthMap();
        trades = data.map((row) => ({ ...fromRow(row), ...(health.get(row.id) || {}) }));
        selectedId = trades.some((t) => t.id === selectedId) ? selectedId : ((_a2 = trades[0]) == null ? void 0 : _a2.id) || null;
      } else {
        trades = [];
        selectedId = null;
        showCloudMessage("Die Cloud enthält noch keine Trade-Pläne. Lege einen neuen Plan an oder importiere eine zuvor exportierte JSON-Datei.");
      }
      saveLocal();
      renderAll();
      purgePersonalBrowserData();
      setCloudState("online", "Cloud");
      await loadNotificationSettings();
      await loadSignals();
    }
    async function loadNotificationSettings() {
      if (!session) return;
      const { data } = await sb.from("notification_settings").select("*").maybeSingle();
      telegramLinkCode = (data == null ? void 0 : data.telegram_link_code) || "";
      els.telegramCode.textContent = telegramLinkCode || "Noch kein Code";
      els.telegramStatus.textContent = (data == null ? void 0 : data.telegram_chat_id) ? `Verbunden \xB7 Chat-ID endet auf ${String(data.telegram_chat_id).slice(-4)}` : "Telegram noch nicht verbunden.";
    }
    async function loadSignals() {
      if (!session) return;
      const { data, error } = await sb.from("alert_events").select("event_type,price,level_value,message,created_at,trade_plans(name)").order("created_at", { ascending: false }).limit(20);
      if (error || !(data == null ? void 0 : data.length)) {
        els.signalList.innerHTML = "<p>Noch keine Signale.</p>";
        return;
      }
      els.signalList.innerHTML = data.map((e) => {
        var _a2;
        return `<div class="signal-item"><strong>${escapeHtml(((_a2 = e.trade_plans) == null ? void 0 : _a2.name) || "Instrument")} \xB7 ${escapeHtml(e.event_type)}</strong><span>${displayDateTime(e.created_at)} \xB7 Kurs ${displayNum(e.price)}${e.level_value !== null ? " \xB7 Marke " + displayNum(e.level_value) : ""}</span></div>`;
      }).join("");
    }
    function subscribeRealtime() {
      if (realtimeChannel) sb.removeChannel(realtimeChannel);
      if (!session) return;
      realtimeChannel = sb.channel("trade-plans-cloud").on("postgres_changes", { event: "*", schema: "public", table: "trade_plans", filter: `user_id=eq.${session.user.id}` }, () => loadCloud()).subscribe();
    }
    function setCloudState(state, label) {
      els.cloudDot.className = "status-dot " + (state || "");
      els.cloudLabel.textContent = label;
    }
    function showCloudMessage(text, good = null) {
      els.cloudMessage.textContent = text;
      els.cloudMessage.className = "sync-message" + (good === true ? " good" : good === false ? " bad" : "");
    }
    function setBusy(v) {
      cloudBusy = v;
      $$("#cloudModal button, #authGate button").forEach((b) => b.disabled = v);
    }
    function showGateMessage(text, good = null) {
      if (!els.gateMessage) return;
      els.gateMessage.textContent = text;
      els.gateMessage.className = "auth-message" + (good === true ? " good" : good === false ? " bad" : "");
    }
    function setAuthLocked(locked, message = "") {
      document.body.classList.toggle("auth-locked", locked);
      els.authGate?.classList.toggle("hidden", !locked);
      if (els.appShell) {
        els.appShell.toggleAttribute("inert", locked);
        els.appShell.setAttribute("aria-hidden", locked ? "true" : "false");
      }
      if (locked) {
        els.gatePassword.value = "";
        showGateMessage(message || "Bitte mit deinem bestehenden Konto anmelden.");
        setTimeout(() => (els.gateEmail.value ? els.gatePassword : els.gateEmail)?.focus(), 80);
      }
    }
    function stopIdleTimer() {
      if (idleTimer) window.clearInterval(idleTimer);
      idleTimer = null;
    }
    function recordActivity() {
      if (session) lastActivityAt = Date.now();
    }
    function startIdleTimer() {
      stopIdleTimer();
      lastActivityAt = Date.now();
      idleTimer = window.setInterval(() => {
        if (session && Date.now() - lastActivityAt >= IDLE_TIMEOUT_MS) lockSession("Sitzung nach 30 Minuten ohne Aktivität automatisch gesperrt.");
      }, 30000);
    }
    async function lockSession(reason = "Sitzung gesperrt. Bitte erneut anmelden.") {
      lockReason = reason;
      setAuthLocked(true, reason);
      stopIdleTimer();
      if (sb && session) {
        try { await sb.auth.signOut(); } catch (_e) {}
      } else {
        session = null;
        refreshAuthUi();
      }
    }
    function ensureAuthenticatedAppStarted() {
      if (widgetsStarted || !session) return;
      widgetsStarted = true;
      initTicker();
      renderAll();
    }
    function refreshAuthUi() {
      var _a2;
      const logged = !!session;
      els.loggedOutBox.classList.toggle("hidden", logged);
      els.loggedInBox.classList.toggle("hidden", !logged);
      els.telegramBox.classList.toggle("hidden", !logged);
      els.alarmHealthBox.classList.toggle("hidden", !logged);
      els.signalsBox.classList.toggle("hidden", !logged);
      els.userEmail.textContent = ((_a2 = session == null ? void 0 : session.user) == null ? void 0 : _a2.email) || "—";
      setCloudState(logged ? "online" : "", logged ? "Sitzung aktiv" : "Gesperrt");
      setAuthLocked(!logged, lockReason || "Bitte mit deinem bestehenden Konto anmelden.");
      if (logged) {
        lockReason = "";
        startIdleTimer();
        ensureAuthenticatedAppStarted();
      } else {
        stopIdleTimer();
        trades = [];
        selectedId = null;
        currentChartKey = "";
        widgetsStarted = false;
        if (els.tickerHost) els.tickerHost.innerHTML = "";
        saveLocal();
        renderAll();
      }
      emitDashboardEvent("investition:auth-changed", { session });
    }
    async function initCloud() {
      if (!sb) {
        setCloudState("error", "Cloud nicht geladen");
        setAuthLocked(true, "Supabase konnte nicht geladen werden. Prüfe die Internetverbindung und lade die Seite neu.");
        return;
      }
      const { data } = await sb.auth.getSession();
      session = data.session;
      refreshAuthUi();
      if (session) {
        subscribeRealtime();
        await loadCloud();
        if (new URLSearchParams(location.search).get("setup") === "password") {
          els.cloudModal.classList.add("open");
          setTimeout(() => els.newPassword?.focus(), 150);
          showCloudMessage("Du bist über den Wiederherstellungslink angemeldet. Lege jetzt unten ein Passwort fest.", true);
        }
      }
      sb.auth.onAuthStateChange((_event, newSession) => {
        session = newSession;
        refreshAuthUi();
        setTimeout(() => {
          if (session) {
            subscribeRealtime();
            loadCloud();
          } else if (realtimeChannel) {
            sb.removeChannel(realtimeChannel);
            realtimeChannel = null;
          }
        }, 0);
      });
    }
    function loginCredentials() {
      const email = els.gateEmail.value.trim().toLowerCase();
      const password = els.gatePassword.value;
      if (!email) {
        showGateMessage("Bitte eine E-Mail-Adresse eingeben.", false);
        return null;
      }
      if (!password || password.length < 8) {
        showGateMessage("Das Passwort muss mindestens 8 Zeichen lang sein.", false);
        return null;
      }
      return { email, password };
    }
    async function signInPassword() {
      const credentials = loginCredentials();
      if (!credentials) return;
      if (!sb) return showGateMessage("Supabase ist nicht verfügbar.", false);
      setBusy(true);
      showGateMessage("Anmeldung wird geprüft …");
      const { error } = await sb.auth.signInWithPassword(credentials);
      setBusy(false);
      if (error) return showGateMessage("Anmeldung fehlgeschlagen: " + error.message, false);
      els.gatePassword.value = "";
      showGateMessage("Anmeldung erfolgreich.", true);
    }
    async function sendSetupLink() {
      const email = els.gateEmail.value.trim().toLowerCase();
      if (!email) return showGateMessage("Bitte eine E-Mail-Adresse eingeben.", false);
      setBusy(true);
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: APP_URL + "?setup=password"
        }
      });
      setBusy(false);
      if (error) return showGateMessage("Wiederherstellungslink konnte nicht gesendet werden: " + error.message, false);
      showGateMessage("Einmaliger Wiederherstellungslink wurde gesendet. Öffne ihn in Safari und lege anschließend im Bereich Cloud & Benachrichtigungen ein Passwort fest.", true);
    }
    async function setAccountPassword() {
      if (!session) return showCloudMessage("Du musst angemeldet sein, um ein Passwort festzulegen.", false);
      const password = els.newPassword.value;
      const confirmation = els.newPasswordConfirm.value;
      if (!password || password.length < 8) return showCloudMessage("Das neue Passwort muss mindestens 8 Zeichen lang sein.", false);
      if (password !== confirmation) return showCloudMessage("Die beiden Passwörter stimmen nicht überein.", false);
      setBusy(true);
      const { error } = await sb.auth.updateUser({ password });
      setBusy(false);
      if (error) return showCloudMessage("Passwort konnte nicht gespeichert werden: " + error.message, false);
      els.newPassword.value = "";
      els.newPasswordConfirm.value = "";
      showCloudMessage("Passwort gespeichert. Du kannst dich jetzt auch in der Home-Screen-App mit E-Mail und Passwort anmelden.", true);
    }
    async function generateTelegramCode() {
      if (!session) return;
      telegramLinkCode = "INV-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      const { error } = await sb.from("notification_settings").upsert({ user_id: session.user.id, telegram_link_code: telegramLinkCode, telegram_enabled: true }, { onConflict: "user_id" });
      if (error) return showCloudMessage("Code konnte nicht gespeichert werden: " + error.message, false);
      els.telegramCode.textContent = telegramLinkCode;
      showCloudMessage(`Sende jetzt /start ${telegramLinkCode} an deinen Telegram-Bot.`, true);
    }
    async function connectTelegram() {
      if (!telegramLinkCode) return showCloudMessage("Zuerst einen Einmalcode erzeugen.", false);
      setBusy(true);
      const { data, error } = await sb.functions.invoke("connect-telegram", { body: { code: telegramLinkCode } });
      setBusy(false);
      if (error) {
        let details = error.message || String(error);
        try {
          if (error.context instanceof Response) {
            const payload = await error.context.clone().json();
            details = (payload == null ? void 0 : payload.error) || (payload == null ? void 0 : payload.message) || JSON.stringify(payload);
          }
        } catch (_e) {
          try {
            if (error.context instanceof Response) details = await error.context.clone().text() || details;
          } catch (_ignored) {
          }
        }
        console.error("connect-telegram:", error);
        return showCloudMessage("Verbindung fehlgeschlagen: " + details, false);
      }
      showCloudMessage((data == null ? void 0 : data.message) || "Telegram verbunden.", true);
      await loadNotificationSettings();
    }
    async function checkAlertsNow() {
      if (!session) return showCloudMessage("Bitte zuerst in der Cloud anmelden.", false);
      setBusy(true);
      showCloudMessage("Alarmprüfung läuft …");
      const { data, error } = await sb.functions.invoke("check-alerts", { body: { manual: true } });
      setBusy(false);
      if (error) {
        let details = error.message || String(error);
        try {
          if (error.context instanceof Response) {
            const payload = await error.context.clone().json();
            details = payload?.error || payload?.message || JSON.stringify(payload);
          }
        } catch (_e) {}
        return showCloudMessage("Alarmprüfung fehlgeschlagen: " + details, false);
      }
      const failed = Number(data?.failed || 0);
      const events = Number(data?.events_sent || 0);
      const checked = Number(data?.checked || 0);
      const firstError = (data?.results || []).find((r) => r.error)?.error;
      showCloudMessage(`Alarmprüfung: ${checked} Pläne, ${events} Signale, ${failed} Fehler${firstError ? " · " + firstError : ""}`, failed ? false : true);
      await loadCloud();
    }
    $("#newBtn").onclick = () => openModal();
    $("#closeModalBtn").onclick = closeModal;
    $("#cancelBtn").onclick = closeModal;
    els.deleteBtn.onclick = deleteSelected;
    els.modal.addEventListener("click", (e) => {
      if (e.target === els.modal) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal();
        els.cloudModal.classList.remove("open");
      }
    });
    els.symbolSelect.addEventListener("change", () => {
      selectedId = els.symbolSelect.value;
      currentChartKey = "";
      renderAll();
    });
    els.chartMode.value = storageGet(CHART_MODE_KEY) || "overview";
    els.chartRange.value = storageGet(CHART_RANGE_KEY) || "12M";
    els.chartMode.addEventListener("change", () => {
      storageSet(CHART_MODE_KEY, els.chartMode.value);
      currentChartKey = "";
      renderChart(true);
    });
    els.chartRange.addEventListener("change", () => {
      storageSet(CHART_RANGE_KEY, els.chartRange.value);
      currentChartKey = "";
      renderChart(true);
    });
    if (els.chartRangeButtons) {
      $$('[data-chart-range]', els.chartRangeButtons).forEach((button) => {
        button.addEventListener("click", () => {
          els.chartRange.value = button.dataset.chartRange || "12M";
          storageSet(CHART_RANGE_KEY, els.chartRange.value);
          currentChartKey = "";
          renderChart(true);
        });
      });
    }
    els.chartRefreshBtn.addEventListener("click", () => renderChart(true));
    [els.searchInput, els.typeFilter, els.directionFilter, els.statusFilter].forEach((el) => el.addEventListener("input", () => {
      renderTable();
      renderKpis();
    }));
    $("#exportBtn").onclick = () => {
      const blob = new Blob([JSON.stringify({ version: 2, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), trades }, null, 2)], { type: "application/json" }), a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `investition-dashboard-${today}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
    $("#importBtn").onclick = () => els.importFile.click();
    els.importFile.addEventListener("change", async () => {
      var _a2;
      const file = els.importFile.files[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text()), incoming = Array.isArray(parsed) ? parsed : parsed.trades;
        if (!Array.isArray(incoming)) throw new Error("Kein g\xFCltiger Trade-Datensatz.");
        if (!session) throw new Error("Anmeldung erforderlich.");
        trades = incoming.map(normalizeTrade);
        selectedId = ((_a2 = trades[0]) == null ? void 0 : _a2.id) || null;
        const rows = trades.map(toRow);
        const { error } = await sb.from("trade_plans").upsert(rows);
        if (error) throw error;
        showCloudMessage(`${rows.length} Pläne importiert und in der Cloud gespeichert.`, true);
        await loadCloud();
      } catch (e) {
        alert("Import fehlgeschlagen: " + e.message);
      }
      els.importFile.value = "";
    });
    els.cloudBtn.onclick = () => els.cloudModal.classList.add("open");
    $("#closeCloudBtn").onclick = () => els.cloudModal.classList.remove("open");
    els.cloudModal.addEventListener("click", (e) => {
      if (e.target === els.cloudModal) els.cloudModal.classList.remove("open");
    });
    els.gateForm.addEventListener("submit", (event) => { event.preventDefault(); signInPassword(); });
    els.gateSetupLinkBtn.onclick = sendSetupLink;
    $("#setPasswordBtn").onclick = setAccountPassword;
    els.newPasswordConfirm.addEventListener("keydown", (event) => { if (event.key === "Enter") setAccountPassword(); });
    $("#lockNowBtn").onclick = () => lockSession("Sitzung manuell gesperrt.");
    $("#quickLockBtn").onclick = () => lockSession("Sitzung manuell gesperrt.");
    $("#logoutBtn").onclick = () => lockSession("Abgemeldet. Bitte erneut anmelden.");
    $("#reloadCloudBtn").onclick = loadCloud;
    els.runAlertsBtn.onclick = checkAlertsNow;
    $("#generateCodeBtn").onclick = generateTelegramCode;
    $("#connectTelegramBtn").onclick = connectTelegram;
    ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
      document.addEventListener(eventName, recordActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && session && Date.now() - lastActivityAt >= IDLE_TIMEOUT_MS) lockSession("Sitzung nach 30 Minuten ohne Aktivität automatisch gesperrt.");
    });
    renderAll();
    initCloud();
    emitDashboardEvent("investition:ready", { version: "28.2", trades: trades.map((trade) => ({ ...trade })) });
    chartAutoRefreshTimer = window.setInterval(() => {
      if (!document.hidden && Date.now() - lastChartReloadAt > 300000) renderChart(true);
    }, 60000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && Date.now() - lastChartReloadAt > 60000) renderChart(true);
    });
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function() {
        navigator.serviceWorker.register("./service-worker.js?v=28.2").catch(function(err) {
          console.warn("Service Worker konnte nicht registriert werden.", err);
        });
      });
    }
  })();
})();
