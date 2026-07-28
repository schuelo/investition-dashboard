import type { PriceBar } from "./market-intelligence.ts";

export type RssArticle = {
  guid: string;
  title: string;
  link: string;
  publishedAt: string;
  description: string;
  sourceName: string;
};

const XML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

export function decodeXml(value: unknown) {
  return String(value || "")
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/i, "$1")
    .replace(/&#(\d+);/g, (_match, decimal) =>
      String.fromCodePoint(Number(decimal)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, hexadecimal) =>
      String.fromCodePoint(Number.parseInt(hexadecimal, 16)))
    .replace(/&([a-z]+);/gi, (match, name) =>
      XML_ENTITIES[String(name).toLowerCase()] ?? match);
}

function tagValue(block: string, tag: string) {
  const match = block.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"),
  );
  return decodeXml(match?.[1] || "").trim();
}

export function stripMarkup(value: unknown) {
  return decodeXml(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseRss(xml: string, providerName: string): RssArticle[] {
  const items = String(xml || "").match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return items.map((item) => {
    const sourceName = stripMarkup(tagValue(item, "source")) || providerName;
    const rawTitle = stripMarkup(tagValue(item, "title")) || "Ohne Titel";
    const sourceSuffix = ` - ${sourceName}`;
    const title = rawTitle.endsWith(sourceSuffix)
      ? rawTitle.slice(0, -sourceSuffix.length).trim()
      : rawTitle;
    const rawDate = tagValue(item, "pubDate") || tagValue(item, "date");
    const parsedDate = new Date(rawDate);
    const link = tagValue(item, "link");
    const guid = tagValue(item, "guid") || link ||
      `${rawDate}|${rawTitle}|${sourceName}`;
    return {
      guid,
      title,
      link,
      publishedAt: Number.isNaN(parsedDate.getTime())
        ? new Date().toISOString()
        : parsedDate.toISOString(),
      description: stripMarkup(
        tagValue(item, "description") || tagValue(item, "content:encoded"),
      ).slice(0, 2_000),
      sourceName,
    };
  }).filter((article) => article.title && article.guid);
}

export function googleNewsRssUrl(query: string, lookbackDays: number) {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", `${query} when:${lookbackDays}d`);
  url.searchParams.set("hl", "de");
  url.searchParams.set("gl", "DE");
  url.searchParams.set("ceid", "DE:de");
  return url;
}

export function bingNewsRssUrl(query: string) {
  const url = new URL("https://www.bing.com/news/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "rss");
  url.searchParams.set("setlang", "de-DE");
  return url;
}

const STOOQ_SYMBOLS: Record<string, string> = {
  "QQQ.US": "qqq.us",
  "SOXX.US": "soxx.us",
  "SPY.US": "spy.us",
  "XLE.US": "xle.us",
  "EURUSD.FOREX": "eurusd",
};

export function stooqSymbol(symbol: string) {
  return STOOQ_SYMBOLS[String(symbol || "").toUpperCase()] || null;
}

export function stooqHistoryUrl(
  symbol: string,
  from: string,
  to: string,
) {
  const mapped = stooqSymbol(symbol);
  if (!mapped) return null;
  const url = new URL("https://stooq.com/q/d/l/");
  url.searchParams.set("s", mapped);
  url.searchParams.set("d1", from.replaceAll("-", ""));
  url.searchParams.set("d2", to.replaceAll("-", ""));
  url.searchParams.set("i", "d");
  return url;
}

export function parseStooqCsv(csv: string): PriceBar[] {
  const lines = String(csv || "").trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((value) => value.trim().toLowerCase());
  const index = (name: string) => headers.indexOf(name);
  const dateIndex = index("date");
  const closeIndex = index("close");
  if (dateIndex < 0 || closeIndex < 0) return [];
  const numberAt = (columns: string[], position: number) => {
    if (position < 0 || !columns[position]) return null;
    const parsed = Number(columns[position]);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return lines.slice(1).map((line) => {
    const columns = line.split(",").map((value) => value.trim());
    return {
      date: columns[dateIndex] || "",
      open: numberAt(columns, index("open")),
      high: numberAt(columns, index("high")),
      low: numberAt(columns, index("low")),
      close: numberAt(columns, closeIndex),
      adjusted_close: null,
      volume: numberAt(columns, index("volume")),
    };
  }).filter((bar) =>
    /^\d{4}-\d{2}-\d{2}$/.test(bar.date) &&
    bar.close !== null
  );
}

export function rotateForUtcDay<T>(values: T[], now = new Date()) {
  if (values.length < 2) return [...values];
  const dayNumber = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) /
      86_400_000,
  );
  const offset = dayNumber % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}

export function cacheIsFresh(
  fetchedAt: unknown,
  maximumAgeHours: number,
  now = new Date(),
) {
  const fetched = new Date(String(fetchedAt || ""));
  if (Number.isNaN(fetched.getTime())) return false;
  return now.getTime() - fetched.getTime() <= maximumAgeHours * 3_600_000;
}
