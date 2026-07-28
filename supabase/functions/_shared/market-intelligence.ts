export const ASSESSMENT_VERSION = "29.1-rule-market-intelligence";

export type NewsScope = "portfolio" | "watchlist" | "sector" | "market";
export type MarketDirection = "positiv" | "negativ" | "gemischt" | "neutral";
export type PricedInState =
  | "weitgehend"
  | "teilweise"
  | "eher_nicht"
  | "zu_frueh"
  | "unklar";

export type PriceBar = {
  date: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  adjusted_close?: number | null;
  volume?: number | null;
};

export type LiveQuote = {
  code?: string | null;
  timestamp?: number | null;
  close?: number | null;
  previousClose?: number | null;
  change_p?: number | null;
  volume?: number | null;
};

export type FundamentalContext = {
  targetPrice?: number | null;
  currency?: string | null;
  updatedAt?: string | null;
};

export type AssessmentInput = {
  title: string;
  content?: string | null;
  publishedAt: string;
  topic?: string | null;
  tags?: string[];
  symbols?: string[];
  sentiment?: number | null;
  primarySymbol?: string | null;
  priceContextSymbol?: string | null;
  priceContextKind?: "direct" | "proxy" | null;
  scope: NewsScope;
  positionDirections?: string[];
  priceBars?: PriceBar[] | null;
  liveQuote?: LiveQuote | null;
  fundamentals?: FundamentalContext | null;
  now?: Date;
};

export type AssessmentResult = {
  assessment_version: string;
  evaluated_at: string;
  primary_symbol: string | null;
  event_type: string;
  direction: MarketDirection;
  relevance_score: number;
  confidence_score: number;
  impact_score: number;
  urgency_score: number;
  impact: "hoch" | "mittel" | "niedrig";
  relevance_reason: string;
  market_impact: string;
  priced_in_state: PricedInState;
  priced_in: string;
  analyst_view: string;
  analyst_signal: "positiv" | "negativ" | "neutral" | "nicht_verfuegbar";
  action_code: string;
  recommended_action: string;
  price_reaction_percent: number | null;
  normal_move_percent: number | null;
  analyst_target_price: number | null;
  analyst_target_upside_percent: number | null;
  analyst_currency: string | null;
  data_quality: "hoch" | "mittel" | "niedrig";
  analysis_basis: Record<string, unknown>;
};

type EventRule = {
  id: string;
  label: string;
  materiality: number;
  pattern: RegExp;
};

type PriceReaction = {
  reaction: number | null;
  normalMove: number | null;
  reactionRatio: number | null;
  referencePrice: number | null;
  observedPrice: number | null;
  observedAt: string | null;
  periodLabel: string;
  volumeRatio: number | null;
  source: "live_delayed" | "eod" | "none";
  availability: "available" | "awaiting_session" | "missing_market_data";
};

const EVENT_RULES: EventRule[] = [
  {
    id: "insolvency",
    label: "Insolvenz-/Ausfallrisiko",
    materiality: 100,
    pattern:
      /\b(bankrupt(?:cy)?|insolven(?:cy|t)|default|chapter\s*11|zahlungsunfähig|gläubigerschutz)\b/i,
  },
  {
    id: "guidance",
    label: "Prognose / Guidance",
    materiality: 92,
    pattern:
      /\b(guidance|outlook|profit warning|forecast|prognos(?:e|tiziert)|gewinnwarnung|raises? (?:its )?outlook|cuts? (?:its )?outlook)\b/i,
  },
  {
    id: "earnings",
    label: "Ergebnis / Kennzahlen",
    materiality: 88,
    pattern:
      /\b(earnings|results?|revenue|sales|profit|ebit(?:da)?|eps|quarter|umsatz|ergebnis|gewinn|marge|quartal)\b/i,
  },
  {
    id: "capital",
    label: "Kapitalmaßnahme / Ausschüttung",
    materiality: 87,
    pattern:
      /\b(capital increase|rights issue|share offering|buyback|dividend|sonderdividende|kapitalerhöhung|aktienrückkauf|verwässerung)\b/i,
  },
  {
    id: "ma",
    label: "Übernahme / Transaktion",
    materiality: 86,
    pattern:
      /\b(acquisition|merger|takeover|bid|deal|divest|spin-?off|übernahme|fusion|verkauf von|abspaltung)\b/i,
  },
  {
    id: "regulatory",
    label: "Regulierung / Recht",
    materiality: 84,
    pattern:
      /\b(approval|approved|reject(?:ed|ion)?|ban|sanction|lawsuit|investigation|antitrust|regulat(?:or|ory)|zulassung|verbot|sanktion|klage|ermittlung|kartell)\b/i,
  },
  {
    id: "analyst",
    label: "Analystenrevision",
    materiality: 74,
    pattern:
      /\b(upgrad(?:e|ed)|downgrad(?:e|ed)|rating|price target|target price|outperform|underperform|buy|sell|kursziel|hochgestuft|herabgestuft)\b/i,
  },
  {
    id: "contract",
    label: "Auftrag / Partnerschaft",
    materiality: 72,
    pattern:
      /\b(contract|order|partnership|joint venture|award(?:ed)?|auftrag|kooperation|partnerschaft|rahmenvertrag)\b/i,
  },
  {
    id: "product",
    label: "Produkt / Produktion",
    materiality: 66,
    pattern:
      /\b(product|launch|recall|production|capacity|shipment|delay|produkt|markteinführung|rückruf|produktion|kapazität|lieferung|verzögerung)\b/i,
  },
  {
    id: "macro",
    label: "Makro / Geldpolitik",
    materiality: 70,
    pattern:
      /\b(inflation|interest rate|central bank|fomc|ecb|fed|gdp|employment|tariff|zinsen|not(en)?bank|bip|arbeitsmarkt|zoll)\b/i,
  },
  {
    id: "fx",
    label: "Währung / EUR-USD",
    materiality: 62,
    pattern:
      /\b(eurusd|forex|currency|exchange rate|euro|dollar|wechselkurs|währung)\b/i,
  },
];

const POSITIVE_PATTERN =
  /\b(beat(?:s|ing)?|above expectations|raises?|raised|increase(?:s|d)?|record (?:profit|revenue|sales)|upgrade(?:d)?|outperform|buy rating|target (?:raised|increased)|wins?|won|approval|approved|growth|expands?|higher|strong(?:er)?|übertrifft|angehoben|erhöht|rekord(?:gewinn|umsatz)|hochgestuft|gewinnt|genehmigt|wachstum|stärker)\b/i;
const NEGATIVE_PATTERN =
  /\b(miss(?:es|ed)?|below expectations|cuts?|cutting|lower(?:s|ed)?|profit warning|downgrade(?:d)?|underperform|sell rating|target (?:cut|lowered)|recall|delay(?:ed)?|investigation|lawsuit|ban(?:ned)?|sanction(?:ed)?|loss|decline|weak(?:er)?|default|bankrupt(?:cy)?|verfehlt|gesenkt|gewinnwarnung|herabgestuft|rückruf|verzögert|ermittlung|klage|verbot|verlust|rückgang|schwächer|insolvenz)\b/i;
const EXPECTED_PATTERN =
  /\b(as expected|in line with|consensus|anticipated|priced in|reiterate(?:s|d)?|confirmed|unverändert|wie erwartet|im rahmen|konsens|eingepreist|bestätigt)\b/i;
const UPGRADE_PATTERN =
  /\b(upgrad(?:e|ed)|outperform|overweight|buy rating|hochgestuft|kaufen)\b/i;
const DOWNGRADE_PATTERN =
  /\b(downgrad(?:e|ed)|underperform|underweight|sell rating|herabgestuft|verkaufen)\b/i;
const TARGET_UP_PATTERN =
  /\b(price target|target price|kursziel).{0,32}\b(rais(?:e|ed)|increas(?:e|ed)|higher|angehoben|erhöht)\b|\b(rais(?:e|ed)|increas(?:e|ed)|angehoben|erhöht).{0,32}\b(price target|target price|kursziel)\b/i;
const TARGET_DOWN_PATTERN =
  /\b(price target|target price|kursziel).{0,32}\b(cut|lower(?:ed)?|reduc(?:e|ed)|gesenkt|reduziert)\b|\b(cut|lower(?:ed)?|reduc(?:e|ed)|gesenkt|reduziert).{0,32}\b(price target|target price|kursziel)\b/i;

const EVENT_MECHANISM: Record<string, string> = {
  insolvency: "Finanzierungsfähigkeit, Restwert und Ausfallwahrscheinlichkeit",
  guidance: "künftige Umsatz-, Ergebnis- und Margenerwartungen",
  earnings: "Gewinnpfad, Bewertung und operative Erwartungen",
  capital: "Verwässerung, Kapitalallokation und Ausschüttungsprofil",
  ma: "Synergien, Kaufpreis, Bilanzrisiko und strategische Positionierung",
  regulatory: "Marktzugang, Kosten, Zeitplan und Rechtsrisiko",
  analyst: "Konsens, Bewertung und kurzfristige Marktpositionierung",
  contract: "Auftragsbestand, Umsatzsichtbarkeit und Kapazitätsauslastung",
  product: "Wachstumspfad, Kosten und Umsetzungsrisiko",
  macro: "Zinsen, Nachfrage, Bewertungsmultiplikatoren und Risikoprämien",
  fx: "Währungsumrechnung, Exportmargen und internationale Kapitalflüsse",
  general: "Erwartungen, Bewertung und Risikoprämie",
};

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function round(value: number | null, digits = 2): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatNumber(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${formatNumber(value, digits)} %`;
}

function isoDate(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? null : date;
}

function hoursBetween(earlier: Date | null, later: Date) {
  if (!earlier) return 9999;
  return Math.max(0, (later.getTime() - earlier.getTime()) / 3_600_000);
}

function median(values: number[]) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function normalizedBars(value: PriceBar[] | null | undefined) {
  return (Array.isArray(value) ? value : [])
    .map((bar) => ({
      ...bar,
      date: String(bar.date || "").slice(0, 10),
      close: numberOrNull(bar.adjusted_close) ?? numberOrNull(bar.close),
      volume: numberOrNull(bar.volume),
    }))
    .filter((bar) => /^\d{4}-\d{2}-\d{2}$/.test(bar.date) && bar.close !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function normalDailyMove(bars: ReturnType<typeof normalizedBars>, eventDate: string) {
  const eligible = bars.filter((bar) => bar.date < eventDate).slice(-31);
  const moves: number[] = [];
  for (let index = 1; index < eligible.length; index += 1) {
    const previous = eligible[index - 1].close;
    const current = eligible[index].close;
    if (previous && current) moves.push(Math.abs((current / previous - 1) * 100));
  }
  return round(median(moves.slice(-20)), 2);
}

function calculatePriceReaction(input: AssessmentInput): PriceReaction {
  const published = isoDate(input.publishedAt);
  const now = input.now || new Date();
  const ageHours = hoursBetween(published, now);
  const eventDate = (published || now).toISOString().slice(0, 10);
  const bars = normalizedBars(input.priceBars);
  const normalMove = normalDailyMove(bars, eventDate);
  const quoteClose = numberOrNull(input.liveQuote?.close);
  const quotePrevious = numberOrNull(input.liveQuote?.previousClose);
  const quoteChange = numberOrNull(input.liveQuote?.change_p);
  const quoteTime = numberOrNull(input.liveQuote?.timestamp);
  const quoteDate = quoteTime ? new Date(quoteTime * 1000) : null;
  const quoteAfterArticle = Boolean(
    quoteDate && published && quoteDate.getTime() >= published.getTime(),
  );

  if (
    ageHours <= 48 &&
    quoteClose !== null &&
    quotePrevious !== null &&
    quotePrevious !== 0 &&
    (quoteAfterArticle || eventDate === now.toISOString().slice(0, 10))
  ) {
    const reaction = quoteChange ??
      round((quoteClose / quotePrevious - 1) * 100, 3);
    return {
      reaction: round(reaction, 3),
      normalMove,
      reactionRatio: reaction !== null && normalMove
        ? round(Math.abs(reaction) / Math.max(normalMove, 0.15), 2)
        : null,
      referencePrice: round(quotePrevious, 6),
      observedPrice: round(quoteClose, 6),
      observedAt: quoteDate?.toISOString() || now.toISOString(),
      periodLabel: "aktuelle Sitzung gegenüber Vortag",
      volumeRatio: null,
      source: "live_delayed",
      availability: "available",
    };
  }

  const baselineIndex = bars.reduce(
    (last, bar, index) => bar.date <= eventDate ? index : last,
    -1,
  );
  if (baselineIndex < 0) {
    return {
      reaction: null,
      normalMove,
      reactionRatio: null,
      referencePrice: null,
      observedPrice: quoteClose,
      observedAt: quoteDate?.toISOString() || null,
      periodLabel: "keine belastbare Vorperiode",
      volumeRatio: null,
      source: "none",
      availability: "missing_market_data",
    };
  }

  const baseline = bars[baselineIndex];
  const availableAfter = bars.filter((bar) => bar.date > eventDate);
  if (!availableAfter.length || !baseline.close) {
    const latestBar = bars.at(-1)?.date || null;
    const awaitingSession = Boolean(
      latestBar && latestBar <= eventDate && ageHours <= 96,
    );
    return {
      reaction: null,
      normalMove,
      reactionRatio: null,
      referencePrice: round(baseline.close, 6),
      observedPrice: quoteClose,
      observedAt: quoteDate?.toISOString() || null,
      periodLabel: awaitingSession
        ? "noch keine abgeschlossene Handelssitzung nach der Meldung"
        : "keine verwertbare Kursperiode nach der Meldung",
      volumeRatio: null,
      source: "none",
      availability: awaitingSession
        ? "awaiting_session"
        : "missing_market_data",
    };
  }

  const requestedBars = ageHours >= 7 * 24 ? 5 : ageHours >= 3 * 24 ? 3 : 1;
  const observed = availableAfter[Math.min(requestedBars, availableAfter.length) - 1];
  const reaction = observed.close
    ? (observed.close / baseline.close - 1) * 100
    : null;
  const volumeWindow = bars
    .slice(Math.max(0, baselineIndex - 20), baselineIndex)
    .map((bar) => bar.volume)
    .filter((value): value is number => value !== null && value > 0);
  const averageVolume = volumeWindow.length
    ? volumeWindow.reduce((sum, value) => sum + value, 0) / volumeWindow.length
    : null;
  const volumeRatio = observed.volume && averageVolume
    ? observed.volume / averageVolume
    : null;

  return {
    reaction: round(reaction, 3),
    normalMove,
    reactionRatio: reaction !== null && normalMove
      ? round(Math.abs(reaction) / Math.max(normalMove, 0.15), 2)
      : null,
    referencePrice: round(baseline.close, 6),
    observedPrice: round(observed.close, 6),
    observedAt: `${observed.date}T23:59:59.000Z`,
    periodLabel: `${requestedBars}-Handelstag-Reaktion bis ${observed.date}`,
    volumeRatio: round(volumeRatio, 2),
    source: "eod",
    availability: "available",
  };
}

function classifyEvent(text: string, topic: string) {
  const matched = EVENT_RULES.find((rule) => rule.pattern.test(text));
  if (matched) return matched;
  if (/macro|eur\/usd|forex/i.test(topic)) {
    return {
      id: /eur\/usd|forex/i.test(topic) ? "fx" : "macro",
      label: /eur\/usd|forex/i.test(topic)
        ? "Währung / EUR-USD"
        : "Makro / Geldpolitik",
      materiality: /eur\/usd|forex/i.test(topic) ? 62 : 70,
      pattern: /$^/,
    };
  }
  return {
    id: "general",
    label: "Unternehmens-/Marktnachricht",
    materiality: 52,
    pattern: /$^/,
  };
}

function directionFrom(text: string, sentiment: number | null): MarketDirection {
  const positive = POSITIVE_PATTERN.test(text);
  const negative = NEGATIVE_PATTERN.test(text);
  if (positive && negative) return "gemischt";
  if (positive) return "positiv";
  if (negative) return "negativ";
  if (sentiment !== null && sentiment >= 0.18) return "positiv";
  if (sentiment !== null && sentiment <= -0.18) return "negativ";
  return "neutral";
}

function reactionAligned(direction: MarketDirection, reaction: number | null) {
  if (reaction === null) return null;
  if (direction === "positiv") return reaction > 0;
  if (direction === "negativ") return reaction < 0;
  return null;
}

function pricedInState(
  input: AssessmentInput,
  direction: MarketDirection,
  price: PriceReaction,
  expected: boolean,
): PricedInState {
  const now = input.now || new Date();
  const ageHours = hoursBetween(isoDate(input.publishedAt), now);
  if (price.reaction === null) {
    if (
      price.availability === "awaiting_session" ||
      (ageHours < 2 && price.source === "none")
    ) return "zu_frueh";
    return "unklar";
  }

  const aligned = reactionAligned(direction, price.reaction);
  const ratio = price.reactionRatio ??
    Math.abs(price.reaction) / Math.max(price.normalMove || 1, 0.5);

  if (expected && ratio < 0.65) return "weitgehend";
  if (aligned === true && ratio >= 1.6) return "weitgehend";
  if (ratio >= 0.65) return "teilweise";
  if (ratio < 0.65) return expected ? "weitgehend" : "eher_nicht";
  return "unklar";
}

function pricedInText(
  state: PricedInState,
  price: PriceReaction,
  direction: MarketDirection,
  contextSymbol: string | null,
  contextKind: "direct" | "proxy" | null,
) {
  const labels: Record<PricedInState, string> = {
    weitgehend: "Weitgehend eingepreist",
    teilweise: "Teilweise eingepreist",
    eher_nicht: "Eher noch nicht eingepreist",
    zu_frueh: "Für eine Einpreisungsbewertung noch zu früh",
    unklar: "Einpreisung derzeit nicht messbar",
  };
  if (state === "zu_frueh") {
    return `${labels[state]}. Seit der Veröffentlichung liegt noch keine abgeschlossene Handelssitzung mit belastbarer Kursreaktion vor${
      contextSymbol ? ` (${contextSymbol})` : ""
    }.`;
  }
  if (state === "unklar" && price.reaction === null) {
    return `${labels[state]}. ${
      contextSymbol
        ? `Für ${contextSymbol} konnten keine verwertbaren Kursdaten nach der Meldung geladen werden.`
        : "Der Meldung konnte kein belastbarer Kurs- oder Marktvergleich zugeordnet werden."
    }`;
  }
  const observations: string[] = [];
  if (price.reaction !== null) {
    observations.push(
      `Kursreaktion ${formatPercent(price.reaction)} (${price.periodLabel})`,
    );
  }
  if (price.normalMove !== null) {
    observations.push(
      `übliche Tagesbewegung ca. ${formatNumber(price.normalMove, 1)} %`,
    );
  }
  if (price.reactionRatio !== null) {
    observations.push(
      `${formatNumber(price.reactionRatio, 1)}× Normalbewegung`,
    );
  }
  if (price.volumeRatio !== null) {
    observations.push(
      `Volumen ${formatNumber(price.volumeRatio, 1)}× 20-Tage-Mittel`,
    );
  }
  const caveats: string[] = [];
  if (direction === "neutral" || direction === "gemischt") {
    caveats.push(
      "Die Wirkungsrichtung der Meldung ist nicht eindeutig; der Status basiert primär auf der Stärke der Marktbewegung",
    );
  } else if (reactionAligned(direction, price.reaction) === false) {
    caveats.push(
      "Die Kursreaktion läuft entgegen der automatisch erkannten Wirkungsrichtung; der Status ist daher nur indikativ",
    );
  }
  if (contextKind === "proxy" && contextSymbol) {
    caveats.push(`Bewertung über Markt-Proxy ${contextSymbol}`);
  }
  return `${labels[state]}. ${
    observations.length
      ? observations.join("; ")
      : "Es liegt noch keine belastbare Kursreaktion nach der Meldung vor."
  }${caveats.length ? `. ${caveats.join(". ")}.` : ""}`;
}

function analystAssessment(
  text: string,
  fundamentals: FundamentalContext | null | undefined,
  price: PriceReaction,
) {
  const upgrade = UPGRADE_PATTERN.test(text);
  const downgrade = DOWNGRADE_PATTERN.test(text);
  const targetRaised = TARGET_UP_PATTERN.test(text);
  const targetLowered = TARGET_DOWN_PATTERN.test(text);
  const action = upgrade && downgrade
    ? "widersprüchliche Rating-Signale"
    : upgrade
    ? "Hochstufung/positives Rating-Signal"
    : downgrade
    ? "Herabstufung/negatives Rating-Signal"
    : targetRaised
    ? "angehobenes Kursziel"
    : targetLowered
    ? "gesenktes Kursziel"
    : null;

  const target = numberOrNull(fundamentals?.targetPrice);
  const current = price.observedPrice;
  const upside = target !== null && current !== null && current !== 0
    ? (target / current - 1) * 100
    : null;
  const currency = fundamentals?.currency?.trim().toUpperCase() || null;

  let signal: AssessmentResult["analyst_signal"] = "nicht_verfuegbar";
  if (upgrade || targetRaised || (upside !== null && upside >= 10)) {
    signal = "positiv";
  } else if (downgrade || targetLowered || (upside !== null && upside <= -5)) {
    signal = "negativ";
  } else if (target !== null || action) {
    signal = "neutral";
  }

  const parts: string[] = [];
  if (action) parts.push(`Die Meldung enthält: ${action}.`);
  if (target !== null) {
    parts.push(
      `EODHD-Konsensziel ${formatNumber(target, 2)}${currency ? ` ${currency}` : ""}${
        upside !== null
          ? `; Abstand zum Referenzkurs ${formatPercent(upside)}`
          : ""
      }.`,
    );
  }
  if (fundamentals?.updatedAt) {
    parts.push(`Fundamentalstand ${String(fundamentals.updatedAt).slice(0, 10)}.`);
  }
  if (!parts.length) {
    parts.push(
      "Keine belastbaren Konsens-/Kurszieldaten für dieses Symbol verfügbar; es wird kein Analystenurteil ergänzt.",
    );
  }

  return {
    text: parts.join(" "),
    signal,
    target: round(target, 6),
    upside: round(upside, 2),
    currency,
    hasAction: Boolean(action),
  };
}

function recommendedAction(
  scope: NewsScope,
  direction: MarketDirection,
  state: PricedInState,
  urgency: number,
  positionDirections: string[],
) {
  const directions = positionDirections.map((value) => value.toLowerCase());
  const hasLong = directions.some((value) => value.includes("long"));
  const hasShort = directions.some((value) => value.includes("short"));
  const adverse = (direction === "negativ" && hasLong) ||
    (direction === "positiv" && hasShort);

  if (scope === "portfolio" && adverse && urgency >= 70) {
    return {
      code: "portfolio_risk_now",
      text:
        "Sofort These, Stop/Invalidierung und Positionsgröße prüfen. Neue Käufe bis zur Bestätigung zurückstellen; bei Knock-outs den Barriereabstand separat kontrollieren.",
    };
  }
  if (scope === "portfolio" && direction === "negativ") {
    return {
      code: "portfolio_risk_check",
      text:
        "These und Stop/Invalidierung zeitnah prüfen; nicht automatisch nachkaufen. Bei bestätigtem Bruch des Setups Risiko reduzieren.",
    };
  }
  if (scope === "portfolio" && direction === "positiv") {
    return {
      code: "portfolio_confirm",
      text: state === "weitgehend"
        ? "Positive Meldung gegen die bestehende These prüfen; nach starker Reaktion nicht hinterherkaufen. Stop-Nachzug oder Teilgewinn nur nach dem hinterlegten Setup entscheiden."
        : "These aktualisieren und Kursbestätigung abwarten. Bestehende Position halten, solange Stop/Invalidierung und Risikobudget intakt sind.",
    };
  }
  if (scope === "watchlist" && direction === "negativ") {
    return {
      code: "watchlist_wait",
      text:
        "Einstieg zurückstellen. Erst neue Unterstützungs-, Bewertungs- und Invalidierungszonen definieren, wenn die Kursreaktion stabilisiert ist.",
    };
  }
  if (scope === "watchlist" && direction === "positiv") {
    return {
      code: "watchlist_prepare",
      text: state === "eher_nicht"
        ? "Entry-Setup vorbereiten, aber Bestätigung und Liquidität abwarten; Limit und Stop vor einer Order festlegen."
        : "Nicht dem ersten Kurssprung folgen. Retest oder bestätigten Ausbruch abwarten und nur innerhalb des hinterlegten Risikobudgets handeln.",
    };
  }
  if (direction === "negativ" && urgency >= 65) {
    return {
      code: "exposure_check",
      text:
        "Betroffene Branchen- und Währungsexponierung im Depot prüfen; konkrete Trades erst nach Zuordnung zu einer Position und Bestätigung der Kursreaktion ableiten.",
    };
  }
  return {
    code: "observe",
    text:
      "Keine spontane Transaktion ableiten. Originalquelle, Kursreaktion und Bezug zur eigenen Investmentthese prüfen; bei fehlender Positionszuordnung zunächst beobachten.",
  };
}

export function assessMarketNews(input: AssessmentInput): AssessmentResult {
  const now = input.now || new Date();
  const title = String(input.title || "").trim();
  const content = String(input.content || "").trim();
  const tags = Array.isArray(input.tags) ? input.tags.join(" ") : "";
  const text = `${title} ${content} ${tags}`.replace(/\s+/g, " ").trim();
  const sentiment = numberOrNull(input.sentiment);
  const event = classifyEvent(text, String(input.topic || ""));
  const direction = directionFrom(text, sentiment);
  const expected = EXPECTED_PATTERN.test(text);
  const price = calculatePriceReaction(input);
  const pricedState = pricedInState(input, direction, price, expected);
  const analyst = analystAssessment(text, input.fundamentals, price);
  const published = isoDate(input.publishedAt);
  const ageHours = hoursBetween(published, now);
  const directSymbol = Boolean(input.primarySymbol) &&
    (input.symbols || []).some((symbol) =>
      String(symbol).toUpperCase() === String(input.primarySymbol).toUpperCase()
    );
  const scopeBase: Record<NewsScope, number> = {
    portfolio: 74,
    watchlist: 64,
    sector: 50,
    market: 42,
  };
  const recencyBonus = ageHours <= 6
    ? 10
    : ageHours <= 24
    ? 7
    : ageHours <= 72
    ? 4
    : ageHours <= 168
    ? 1
    : -5;
  const relevance = clamp(
    scopeBase[input.scope] +
      (event.materiality - 50) * 0.34 +
      (directSymbol ? 7 : input.primarySymbol ? 4 : 0) +
      Math.min(7, Math.abs(sentiment || 0) * 9) +
      recencyBonus,
  );
  const priceRatio = price.reactionRatio || 0;
  const impactScore = clamp(
    event.materiality * 0.63 +
      Math.min(13, Math.abs(sentiment || 0) * 15) +
      Math.min(18, priceRatio * 9) +
      (input.scope === "portfolio" ? 8 : input.scope === "watchlist" ? 4 : 0),
  );
  const urgency = clamp(
    event.materiality * 0.4 +
      relevance * 0.3 +
      (ageHours <= 6 ? 22 : ageHours <= 24 ? 15 : ageHours <= 72 ? 8 : 0) +
      (input.scope === "portfolio" ? 10 : input.scope === "watchlist" ? 4 : 0),
  );

  let confidence = 30;
  if (input.primarySymbol) confidence += 9;
  if (directSymbol) confidence += 9;
  if (sentiment !== null) confidence += 8;
  if (content.length >= 180) confidence += 8;
  else if (content.length >= 60) confidence += 4;
  if (price.source !== "none") confidence += 18;
  if (price.normalMove !== null) confidence += 8;
  if (input.priceContextKind === "proxy") confidence -= 8;
  if (price.availability === "awaiting_session") confidence -= 3;
  if (analyst.target !== null || analyst.hasAction) confidence += 7;
  if ((input.symbols || []).length > 5) confidence -= 6;
  if (direction === "gemischt") confidence -= 5;
  confidence = clamp(confidence, 20, 96);

  const label: AssessmentResult["impact"] = relevance >= 78
    ? "hoch"
    : relevance >= 55
    ? "mittel"
    : "niedrig";
  const scopeLabel: Record<NewsScope, string> = {
    portfolio: "direkter Bezug zu einer offenen Depotposition",
    watchlist: "direkter Bezug zu einem Watchlist-Wert",
    sector: "Bezug zu einem priorisierten Trend-/Branchenthema",
    market: "übergreifender Markt- oder Makrobezug",
  };
  const reasonParts = [
    `${event.label}; ${scopeLabel[input.scope]}.`,
    input.primarySymbol ? `Primärsymbol ${input.primarySymbol}.` : "",
    direction === "neutral"
      ? "Keine eindeutige Wirkungsrichtung aus Text und Sentiment."
      : `Automatisch erkannte Wirkungsrichtung: ${direction}.`,
  ].filter(Boolean);

  const mechanism = EVENT_MECHANISM[event.id] || EVENT_MECHANISM.general;
  const reactionText = price.reaction !== null
    ? ` Beobachtete Kursreaktion: ${formatPercent(price.reaction)}; ${
      price.reactionRatio !== null
        ? `${formatNumber(price.reactionRatio, 1)}× der üblichen Tagesbewegung.`
        : "Vergleich zur Normalbewegung nicht verfügbar."
    }`
    : " Eine belastbare Kursreaktion nach Veröffentlichung liegt noch nicht vor.";
  const marketImpact =
    `${direction === "positiv" ? "Positiv" : direction === "negativ" ? "Negativ" : direction === "gemischt" ? "Gemischt" : "Neutral/unklar"}: Betroffen sind vor allem ${mechanism}.${reactionText}`;
  const action = recommendedAction(
    input.scope,
    direction,
    pricedState,
    urgency,
    input.positionDirections || [],
  );
  const dataQuality: AssessmentResult["data_quality"] = confidence >= 78
    ? "hoch"
    : confidence >= 55
    ? "mittel"
    : "niedrig";

  return {
    assessment_version: ASSESSMENT_VERSION,
    evaluated_at: now.toISOString(),
    primary_symbol: input.primarySymbol || null,
    event_type: event.id,
    direction,
    relevance_score: relevance,
    confidence_score: confidence,
    impact_score: impactScore,
    urgency_score: urgency,
    impact: label,
    relevance_reason: reasonParts.join(" "),
    market_impact: marketImpact,
    priced_in_state: pricedState,
    priced_in: pricedInText(
      pricedState,
      price,
      direction,
      input.priceContextSymbol || input.primarySymbol || null,
      input.priceContextKind || (input.primarySymbol ? "direct" : null),
    ),
    analyst_view: analyst.text,
    analyst_signal: analyst.signal,
    action_code: action.code,
    recommended_action: action.text,
    price_reaction_percent: price.reaction,
    normal_move_percent: price.normalMove,
    analyst_target_price: analyst.target,
    analyst_target_upside_percent: analyst.upside,
    analyst_currency: analyst.currency,
    data_quality: dataQuality,
    analysis_basis: {
      model: ASSESSMENT_VERSION,
      event_label: event.label,
      event_materiality: event.materiality,
      expected_language_detected: expected,
      scope: input.scope,
      direct_symbol_match: directSymbol,
      sentiment,
      price_context_symbol:
        input.priceContextSymbol || input.primarySymbol || null,
      price_context_kind:
        input.priceContextKind || (input.primarySymbol ? "direct" : null),
      price_source: price.source,
      price_availability: price.availability,
      price_period: price.periodLabel,
      reference_price: price.referencePrice,
      observed_price: price.observedPrice,
      observed_at: price.observedAt,
      reaction_ratio: price.reactionRatio,
      volume_ratio: price.volumeRatio,
      fundamentals_updated_at: input.fundamentals?.updatedAt || null,
      limitations: [
        "Regelbasierte Einordnung; keine individuelle Anlageberatung.",
        "Einpreisung ist eine Indikation aus Kursreaktion und Nachrichtensignal, keine beweisbare Tatsache.",
        input.priceContextKind === "proxy"
          ? "Branchen-/Makromeldung wird über einen liquiden Markt-Proxy gemessen; der Einzelwertbezug kann abweichen."
          : "Direkter Kurskontext des zugeordneten Wertpapiers.",
        price.source === "live_delayed"
          ? "Live-Kurs kann je nach Markt 15–20 Minuten verzögert sein."
          : price.source === "eod"
          ? "Kursbezug basiert auf End-of-Day-Daten."
          : price.availability === "awaiting_session"
          ? "Die erste abgeschlossene Handelssitzung nach Veröffentlichung steht noch aus."
          : "Für die Meldung waren keine verwertbaren Kursdaten verfügbar.",
      ],
    },
  };
}
