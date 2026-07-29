import type { PriceBar } from "./market-intelligence.ts";

export type RssArticle = {
  guid: string;
  title: string;
  link: string;
  publishedAt: string;
  description: string;
  sourceName: string;
};

export type PublisherFeed = {
  provider: string;
  url: URL;
  forcedTopic: "Makro" | null;
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

function tagAttribute(block: string, tag: string, attribute: string) {
  const tagMatch = block.match(
    new RegExp(`<${tag}\\b([^>]*)\\/?>`, "i"),
  );
  const attributes = tagMatch?.[1] || "";
  const attributeMatch = attributes.match(
    new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, "i"),
  );
  return decodeXml(attributeMatch?.[1] || "").trim();
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
  const source = String(xml || "");
  const items = source.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const entries = source.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  return [...items, ...entries].map((item) => {
    const sourceName = stripMarkup(tagValue(item, "source")) || providerName;
    const rawTitle = stripMarkup(tagValue(item, "title")) || "Ohne Titel";
    const sourceSuffix = ` - ${sourceName}`;
    const title = rawTitle.endsWith(sourceSuffix)
      ? rawTitle.slice(0, -sourceSuffix.length).trim()
      : rawTitle;
    const rawDate = tagValue(item, "pubDate") || tagValue(item, "published") ||
      tagValue(item, "updated") || tagValue(item, "date");
    const parsedDate = new Date(rawDate);
    const link = tagValue(item, "link") || tagAttribute(item, "link", "href");
    const guid = tagValue(item, "guid") || tagValue(item, "id") || link ||
      `${rawDate}|${rawTitle}|${sourceName}`;
    return {
      guid,
      title,
      link,
      publishedAt: Number.isNaN(parsedDate.getTime())
        ? new Date().toISOString()
        : parsedDate.toISOString(),
      description: stripMarkup(
        tagValue(item, "description") || tagValue(item, "summary") ||
          tagValue(item, "content:encoded") || tagValue(item, "content"),
      ).slice(0, 2_000),
      sourceName,
    };
  }).filter((article) => article.title && article.guid);
}

function gdeltDate(value: unknown) {
  const raw = String(value || "").trim();
  const compact = raw.match(
    /^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/,
  );
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z`;
  }
  return raw;
}

export function parseGdeltJson(
  value: unknown,
  providerName = "GDELT Global News",
): RssArticle[] {
  if (!value || typeof value !== "object") return [];
  const articles = Array.isArray((value as Record<string, unknown>).articles)
    ? (value as Record<string, unknown>).articles as Record<string, unknown>[]
    : [];
  return articles.map((article) => {
    const link = String(article.url || article.url_mobile || "").trim();
    const title = stripMarkup(article.title);
    const sourceName = stripMarkup(
      article.domain || article.sourcecommonname || providerName,
    ) || providerName;
    const rawDate = gdeltDate(article.seendate);
    const parsedDate = new Date(rawDate);
    return {
      guid: link || `${rawDate}|${title}|${sourceName}`,
      title,
      link,
      publishedAt: Number.isNaN(parsedDate.getTime())
        ? new Date().toISOString()
        : parsedDate.toISOString(),
      description: "",
      sourceName,
    };
  }).filter((article) => article.title && article.guid && article.link);
}

function gdeltQuery(query: string) {
  const trimmed = String(query || "").trim();
  if (/\sOR\s/i.test(trimmed) && !trimmed.startsWith("(")) {
    return `(${trimmed})`;
  }
  return trimmed;
}

export function gdeltDocUrl(
  query: string,
  lookbackDays: number,
  maximumRecords = 30,
) {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", gdeltQuery(query));
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set(
    "maxrecords",
    String(Math.min(50, Math.max(5, Math.floor(maximumRecords)))),
  );
  url.searchParams.set("format", "json");
  url.searchParams.set("sort", "DateDesc");
  url.searchParams.set("timespan", `${Math.min(7, Math.max(1, lookbackDays))}d`);
  return url;
}

export function googleNewsRssUrl(query: string, lookbackDays: number) {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", `${query} when:${lookbackDays}d`);
  url.searchParams.set("hl", "de");
  url.searchParams.set("gl", "DE");
  url.searchParams.set("ceid", "DE:de");
  return url;
}

export function yahooFinanceSymbol(value: string) {
  const symbol = String(value || "").trim().toUpperCase();
  const suffixes: Record<string, string> = {
    ".XETRA": ".DE",
    ".SHE": ".SZ",
    ".SHG": ".SS",
    ".KO": ".KS",
    ".LSE": ".L",
  };
  for (const [suffix, yahooSuffix] of Object.entries(suffixes)) {
    if (symbol.endsWith(suffix)) {
      return `${symbol.slice(0, -suffix.length)}${yahooSuffix}`;
    }
  }
  if (symbol.endsWith(".US")) {
    return symbol.slice(0, -3).replace(".", "-");
  }
  return symbol;
}

export function yahooFinanceRssUrl(symbols: string[]) {
  const mapped = [...new Set(symbols.map(yahooFinanceSymbol).filter(Boolean))];
  if (!mapped.length) return null;
  const url = new URL("https://feeds.finance.yahoo.com/rss/2.0/headline");
  url.searchParams.set("s", mapped.slice(0, 10).join(","));
  url.searchParams.set("region", "DE");
  url.searchParams.set("lang", "de-DE");
  return url;
}

export function publisherFeeds(): PublisherFeed[] {
  return [
    {
      provider: "EZB",
      url: new URL("https://www.ecb.europa.eu/rss/press.html"),
      forcedTopic: "Makro",
    },
    {
      provider: "Federal Reserve",
      url: new URL("https://www.federalreserve.gov/feeds/press_monetary.xml"),
      forcedTopic: "Makro",
    },
    {
      provider: "BIZ",
      url: new URL("https://www.bis.org/doclist/all_pressrels.rss"),
      forcedTopic: "Makro",
    },
    {
      provider: "Tagesschau Wirtschaft",
      url: new URL("https://www.tagesschau.de/wirtschaft/index~rss2.xml"),
      forcedTopic: null,
    },
    {
      provider: "Tagesschau Technologie",
      url: new URL(
        "https://www.tagesschau.de/wirtschaft/technologie/index~rss2.xml",
      ),
      forcedTopic: null,
    },
  ];
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
