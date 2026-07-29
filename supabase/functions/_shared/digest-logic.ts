export type DigestPeriod = "daily" | "weekly";

export type BerlinClock = {
  date: string;
  weekday: number;
  minuteOfDay: number;
};

type DigestPolicy = {
  daily_digest_enabled?: unknown;
  daily_digest_time?: unknown;
  weekly_digest_enabled?: unknown;
  weekly_digest_day?: unknown;
  weekly_digest_time?: unknown;
};

type DigestNews = {
  title?: unknown;
  source_name?: unknown;
  primary_symbol?: unknown;
  symbols?: unknown;
  relevance_score?: unknown;
  urgency_score?: unknown;
  priced_in_state?: unknown;
  recommended_action?: unknown;
};

function asBoolean(value: unknown, fallback = false) {
  if (value === null || value === undefined || value === "") return fallback;
  return value === true || value === 1 || value === "1" ||
    String(value).toLowerCase() === "true" ||
    String(value).toLowerCase() === "on";
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clean(value: unknown, fallback = "—") {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

export function berlinClock(now = new Date()): BerlinClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [
      part.type,
      part.value,
    ]),
  );
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const hour = asNumber(values.hour);
  const minute = asNumber(values.minute);
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    weekday: weekdays[values.weekday] ?? 0,
    minuteOfDay: hour * 60 + minute,
  };
}

export function scheduledMinute(value: unknown, fallback: string) {
  const match = String(value || fallback).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return scheduledMinute(fallback, "00:00");
  const hour = Math.max(0, Math.min(23, Number(match[1])));
  const minute = Math.max(0, Math.min(59, Number(match[2])));
  return hour * 60 + minute;
}

export function isDigestDue(
  period: DigestPeriod,
  policy: DigestPolicy,
  clock: BerlinClock,
  windowMinutes = 15,
) {
  const enabled = period === "daily"
    ? asBoolean(policy.daily_digest_enabled, true)
    : asBoolean(policy.weekly_digest_enabled, true);
  if (!enabled) return false;

  if (
    period === "weekly" &&
    clock.weekday !== asNumber(policy.weekly_digest_day, 0)
  ) {
    return false;
  }

  const target = scheduledMinute(
    period === "daily"
      ? policy.daily_digest_time
      : policy.weekly_digest_time,
    period === "daily" ? "19:00" : "18:00",
  );
  const difference = clock.minuteOfDay - target;
  return difference >= 0 && difference < windowMinutes;
}

export function digestPeriodKey(
  period: DigestPeriod,
  clock: BerlinClock,
) {
  return `${period}:${clock.date}`;
}

export function chooseDigestNews(news: DigestNews[], limit = 8) {
  return [...news]
    .sort((left, right) => {
      const leftScore = asNumber(left.relevance_score) * 2 +
        asNumber(left.urgency_score);
      const rightScore = asNumber(right.relevance_score) * 2 +
        asNumber(right.urgency_score);
      return rightScore - leftScore;
    })
    .slice(0, Math.max(0, limit));
}

export function buildDigestText(input: {
  period: DigestPeriod;
  news: DigestNews[];
  positions: Array<Record<string, unknown>>;
  alerts: Array<Record<string, unknown>>;
}) {
  const weekly = input.period === "weekly";
  const selected = chooseDigestNews(input.news, weekly ? 10 : 7);
  const lines = [
    weekly ? "📅 WOCHENBERICHT INVESTITION" : "📊 TAGESBERICHT INVESTITION",
    "",
    `Depot: ${input.positions.length} offene Position(en)`,
    `Neue Signale: ${input.alerts.length}`,
    `Relevante Meldungen: ${input.news.length}`,
  ];

  if (selected.length) {
    lines.push("", "TOP-MELDUNGEN");
    selected.forEach((item, index) => {
      const symbols = Array.isArray(item.symbols)
        ? item.symbols.map((value) => clean(value, "")).filter(Boolean)
        : [];
      const instrument = clean(
        item.primary_symbol || symbols[0],
        "Markt",
      );
      const score = Math.round(asNumber(item.relevance_score, 50));
      lines.push(
        `${index + 1}. [${instrument}] ${clean(item.title)} (${score}/100)`,
      );
      const action = clean(item.recommended_action, "");
      if (action) lines.push(`   Handlung: ${action}`);
    });
  } else {
    lines.push("", "Keine neuen relevanten Meldungen im Berichtsfenster.");
  }

  if (input.alerts.length) {
    lines.push("", "NEUE SIGNALE");
    input.alerts.slice(0, 5).forEach((item) => {
      lines.push(
        `• ${clean(item.event_type || item.severity, "Signal")} · Score ${
          Math.round(asNumber(item.score))
        }`,
      );
    });
  }

  lines.push(
    "",
    "Hinweis: Regelbasierte Marktbeobachtung, keine Anlageberatung. Originalquelle und Kurslage vor einer Handlung prüfen.",
  );
  return lines.join("\n").slice(0, 3900);
}
