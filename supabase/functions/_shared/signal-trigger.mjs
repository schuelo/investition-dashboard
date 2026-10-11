// Message-only extension: this helper never chooses recipients or sends requests.
export const TRIGGER_LABEL = 'TRIGGER KI';
export const DEFAULT_SIGNAL_DASHBOARD = 'https://schuelo.github.io/investition-dashboard/';
const validSymbol = value => /^[A-Z0-9_^+\-]{1,25}\.[A-Z0-9]{1,12}$/.test(value);
export const validTriggerId = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));

export function signalTriggerSymbols(affected, plans) {
  const planMap = new Map((plans || []).map(plan => [String(plan.id), plan]));
  return [...new Set((affected || []).flatMap(position => {
    const plan = planMap.get(String(position.trade_id));
    // Prefer the established underlying symbol, never a KO product identifier.
    const symbol = String(plan?.market_symbol || position.market_symbol || position.symbol || '').trim().toUpperCase();
    return validSymbol(symbol) ? [symbol] : [];
  }))].slice(0, 12);
}

export function signalDashboardLink({ dashboardUrl, triggerId, newsId, symbols = [] }) {
  let url;
  try {
    url = new URL(dashboardUrl || DEFAULT_SIGNAL_DASHBOARD);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid dashboard URL');
  } catch { url = new URL(DEFAULT_SIGNAL_DASHBOARD); }
  url.search = '';
  url.hash = 'signals';
  if (validTriggerId(triggerId)) url.searchParams.set('signal_trigger', triggerId);
  else if (validTriggerId(newsId)) url.searchParams.set('signal_news', newsId);
  if (symbols.length === 1 && validSymbol(symbols[0])) url.searchParams.set('signal_symbol', symbols[0]);
  return url.href;
}

export function extendTelegramWithSignal({ originalText, dashboardUrl, triggerId, newsId, symbols = [] }) {
  const appendix = '\n\n🔔 TRIGGER KI\nNews + Charttechniken, Verlauf und Ein-/Ausstiege prüfen.\nKI-Analyse im Dashboard manuell starten.';
  return {
    // Preserve the entire previous 3900-character message, including its source.
    text: String(originalText).slice(0, 3900) + appendix,
    replyMarkup: { inline_keyboard: [[{ text: 'TRIGGER KI · Analyse öffnen', url: signalDashboardLink({ dashboardUrl, triggerId, newsId, symbols }) }]] }
  };
}
