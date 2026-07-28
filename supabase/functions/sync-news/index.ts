import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import {
  assessMarketNews,
  type NewsScope,
  type PriceBar,
} from "../_shared/market-intelligence.ts";
import {
  bingNewsRssUrl,
  cacheIsFresh,
  googleNewsRssUrl,
  parseRss,
  parseStooqCsv,
  rotateForUtcDay,
  stooqHistoryUrl,
  stooqSymbol,
} from "../_shared/hybrid-sources.ts";

const BUILD_VERSION = "29.2-hybrid-market-intelligence-sync";
const DAY = 86_400_000;

type Ref = {
  id: string;
  user_id: string;
  trade_id?: string | null;
  name: string;
  symbol?: string | null;
  market_symbol?: string | null;
  status?: string | null;
  direction?: string | null;
  is_open?: boolean | null;
  __scope?: "portfolio" | "watchlist";
  __key?: string;
};

type AuthContext = {
  ok: boolean;
  mode: "cron" | "user" | null;
  userId: string | null;
};

type FeedQuery = {
  key: string;
  value: string;
  label: string;
  topic: string;
  refKeys: string[];
};

type ReceivedArticle = {
  guid: string;
  title: string;
  link: string;
  publishedAt: string;
  description: string;
  sourceName: string;
  feedProvider: string;
  queryKeys: string[];
  queryLabels: string[];
  topics: string[];
  refKeys: string[];
};

type PreparedArticle = {
  externalId: string;
  title: string;
  content: string;
  publishedAt: string;
  sourceUrl: string;
  sourceName: string;
  feedProvider: string;
  symbols: string[];
  tags: string[];
  topic: string;
  scope: NewsScope;
  primarySymbol: string | null;
  priceContextSymbol: string | null;
  priceContextKind: "direct" | "proxy" | null;
  linkedSymbols: string[];
  portfolioHits: Ref[];
  watchlistHits: Ref[];
  queryLabels: string[];
};

type MarketCacheRow = {
  symbol: string;
  provider: string;
  price_bars: PriceBar[] | null;
  fetched_at: string | null;
  last_attempt_at?: string | null;
  last_error?: string | null;
};

function env(name: string) {
  return Deno.env.get(name)?.trim() || null;
}

function required(name: string) {
  const value = env(name);
  if (!value) throw new Error(`${name} fehlt.`);
  return value;
}

function integerEnv(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const raw = env(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, Math.floor(parsed)))
    : fallback;
}

function jsonKey(name: string) {
  const raw = env(name);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.default === "string") return parsed.default;
    return Object.values(parsed).find((value) => typeof value === "string") as
      | string
      | null;
  } catch {
    return null;
  }
}

function serverKey() {
  return env("SUPABASE_SECRET_KEY") ||
    env("SUPABASE_SERVICE_ROLE_KEY") ||
    jsonKey("SUPABASE_SECRET_KEYS") ||
    (() => {
      throw new Error("Kein Supabase-Server-Key.");
    })();
}

function publishableKey() {
  return env("SUPABASE_PUBLISHABLE_KEY") ||
    env("SUPABASE_ANON_KEY") ||
    jsonKey("SUPABASE_PUBLISHABLE_KEYS") ||
    (() => {
      throw new Error("Kein Supabase-Publishable-Key.");
    })();
}

async function authorize(req: Request, url: string): Promise<AuthContext> {
  const cronSecret = env("CRON_SECRET");
  const requestSecret = req.headers.get("x-cron-secret")?.trim();
  if (cronSecret && requestSecret && requestSecret === cronSecret) {
    return { ok: true, mode: "cron", userId: null };
  }

  const authorization = req.headers.get("authorization") || "";
  if (!authorization) return { ok: false, mode: null, userId: null };

  const client = createClient(url, publishableKey(), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  return {
    ok: !error && Boolean(data.user),
    mode: !error && data.user ? "user" : null,
    userId: data.user?.id || null,
  };
}

async function sha256(value: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function norm(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function searchText(value: unknown) {
  return norm(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+/.:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function symbolTokens(value: unknown) {
  const normalized = String(value || "").toUpperCase().replace(/\s+/g, "");
  if (!normalized) return [];
  const tokens = new Set([normalized]);
  if (normalized.includes(":")) tokens.add(normalized.split(":").pop()!);
  if (normalized.includes(".")) tokens.add(normalized.split(".")[0]);
  return [...tokens].filter(Boolean);
}

function aliases(ref: Ref) {
  const result = new Set<string>();
  for (const raw of [ref.name, ref.symbol, ref.market_symbol]) {
    const normalized = searchText(raw);
    if (normalized.length >= 3) result.add(normalized);
    for (const token of normalized.split(/[\s.:/]+/)) {
      if (token.length >= 4) result.add(token);
    }
  }
  return [...result];
}

function matchRef(text: string, symbols: string[], ref: Ref) {
  const wanted = new Set([
    ...symbolTokens(ref.symbol),
    ...symbolTokens(ref.market_symbol),
  ]);
  if (
    symbols.some((symbol) =>
      symbolTokens(symbol).some((token) => wanted.has(token))
    )
  ) {
    return true;
  }
  const haystack = searchText(text);
  return aliases(ref).some((alias) => haystack.includes(alias));
}

function topicFrom(tags: string[], requested: string[], text: string) {
  const haystack = `${requested.join(" ")} ${tags.join(" ")} ${text}`
    .toLowerCase();
  if (/semiconductor|halbleiter|chip|memory|foundry|hbm|dram|nand|gpu/.test(haystack)) {
    return "Halbleiter";
  }
  if (
    /artificial intelligence|künstliche intelligenz|\bai\b|\bki\b|machine learning|llm|agentic/.test(
      haystack,
    )
  ) {
    return "KI";
  }
  if (
    /energy|energie|oil|öl|gas|solar|wind|uranium|electricity|battery|batterie/.test(
      haystack,
    )
  ) {
    return "Energie";
  }
  if (
    /forex|eurusd|eur\/usd|currency|euro|dollar|exchange rate|wechselkurs/.test(
      haystack,
    )
  ) {
    return "EUR/USD";
  }
  if (
    /macro|inflation|interest rate|central bank|gdp|employment|fomc|ecb|fed|zinsen|bip|arbeitsmarkt/.test(
      haystack,
    )
  ) {
    return "Makro";
  }
  return "Unternehmen";
}

function scopeFor(
  portfolioHits: Ref[],
  watchlistHits: Ref[],
  topic: string,
): NewsScope {
  if (portfolioHits.length) return "portfolio";
  if (watchlistHits.length) return "watchlist";
  if (["KI", "Halbleiter", "Energie", "Unternehmen"].includes(topic)) {
    return "sector";
  }
  return "market";
}

function primarySymbolFor(
  portfolioHits: Ref[],
  watchlistHits: Ref[],
  articleSymbols: string[],
) {
  const preferred = [...portfolioHits, ...watchlistHits]
    .map((ref) => norm(ref.market_symbol))
    .find(Boolean);
  if (preferred) return preferred;
  return articleSymbols.find((symbol) => /\.[A-Z0-9-]+$/i.test(symbol)) || null;
}

function proxySymbolFor(topic: string) {
  const proxies: Record<string, string> = {
    KI: "QQQ.US",
    Halbleiter: "SOXX.US",
    Energie: "XLE.US",
    "EUR/USD": "EURUSD.FOREX",
    Makro: "SPY.US",
    Unternehmen: "SPY.US",
  };
  return proxies[topic] || "SPY.US";
}

function safeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchText(
  url: URL,
  label: string,
  timeoutMs = 12_000,
  retries = 1,
) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/rss+xml, application/xml, text/xml, text/csv, */*",
          "User-Agent": "Investition-Dashboard/29.2 (+RSS market monitor)",
        },
        signal: controller.signal,
      });
      const raw = await response.text();
      if (!response.ok) {
        const error = new Error(
          `${label}: HTTP ${response.status} ${raw.slice(0, 180)}`,
        );
        if ((response.status === 429 || response.status >= 500) && attempt < retries) {
          lastError = error;
          await sleep(450 * (attempt + 1));
          continue;
        }
        throw error;
      }
      return raw;
    } catch (error) {
      lastError = error;
      if (
        attempt < retries &&
        (error instanceof DOMException || /fetch|abort/i.test(safeError(error)))
      ) {
        await sleep(350 * (attempt + 1));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function fetchJson(
  url: URL,
  label: string,
  timeoutMs = 12_000,
) {
  const raw = await fetchText(url, label, timeoutMs, 0);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${label}: ungültige JSON-Antwort.`);
  }
}

async function mapLimit<T, R>(
  values: T[],
  limit: number,
  worker: (value: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(limit, Math.max(1, values.length)) },
    async () => {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(values[index], index);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

function instrumentQuery(ref: Ref) {
  const cleanName = norm(ref.name).replaceAll('"', "").slice(0, 90);
  const ticker = symbolTokens(ref.market_symbol || ref.symbol)
    .map((value) => value.split(".")[0])
    .find((value) => value.length >= 3 && !/^[A-Z]+:/.test(value));
  const parts = [`"${cleanName}"`];
  if (ticker && !searchText(cleanName).includes(ticker.toLowerCase())) {
    parts.push(`"${ticker}"`);
  }
  return parts.join(" OR ");
}

function buildFeedQueries(portfolio: Ref[], watchlist: Ref[]) {
  const trackedQueries = [...portfolio, ...watchlist].map((ref) => ({
    key: `instrument:${ref.__key}`,
    value: instrumentQuery(ref),
    label: ref.name,
    topic: "Unternehmen",
    refKeys: [ref.__key!],
  }));
  const topicQueries: FeedQuery[] = [
    {
      key: "topic:ki",
      value:
        '("artificial intelligence" OR "künstliche Intelligenz" OR AI OR KI) (stocks OR Aktien OR investment)',
      label: "KI",
      topic: "KI",
      refKeys: [],
    },
    {
      key: "topic:halbleiter",
      value:
        "(semiconductor OR Halbleiter OR HBM OR DRAM OR foundry) (stocks OR Aktien OR market)",
      label: "Halbleiter",
      topic: "Halbleiter",
      refKeys: [],
    },
    {
      key: "topic:energie",
      value:
        "(energy OR Energie OR uranium OR battery OR oil OR gas) (stocks OR Aktien OR market)",
      label: "Energie",
      topic: "Energie",
      refKeys: [],
    },
    {
      key: "topic:makro",
      value:
        "(inflation OR ECB OR EZB OR Fed OR central bank OR Zinsen OR GDP OR Arbeitsmarkt) markets",
      label: "Makro",
      topic: "Makro",
      refKeys: [],
    },
    {
      key: "topic:eurusd",
      value:
        '("EUR/USD" OR EURUSD OR "euro dollar" OR "Euro Dollar") (forecast OR outlook OR Ausblick)',
      label: "EUR/USD",
      topic: "EUR/USD",
      refKeys: [],
    },
  ];
  const limit = integerEnv("RSS_QUERY_LIMIT", 30, 5, 60);
  const trackedLimit = Math.max(0, limit - topicQueries.length);
  return [...trackedQueries.slice(0, trackedLimit), ...topicQueries].slice(
    0,
    limit,
  );
}

async function fetchFeedQuery(
  query: FeedQuery,
  lookbackDays: number,
  sourceErrors: string[],
) {
  const attemptErrors: string[] = [];
  const attempts = [
    {
      provider: "Google News RSS",
      url: googleNewsRssUrl(query.value, lookbackDays),
    },
    {
      provider: "Bing News RSS",
      url: bingNewsRssUrl(query.value),
    },
  ];
  for (const attempt of attempts) {
    try {
      const xml = await fetchText(
        attempt.url,
        `${attempt.provider} ${query.label}`,
        10_000,
        1,
      );
      const articles = parseRss(xml, attempt.provider);
      if (!articles.length) {
        throw new Error(`${attempt.provider} ${query.label}: keine RSS-Einträge.`);
      }
      return articles.map((article) => ({
        ...article,
        feedProvider: attempt.provider,
        queryKeys: [query.key],
        queryLabels: [query.label],
        topics: [query.topic],
        refKeys: [...query.refKeys],
      } satisfies ReceivedArticle));
    } catch (error) {
      attemptErrors.push(safeError(error));
    }
  }
  sourceErrors.push(
    `${query.label}: ${attemptErrors.join(" | ")}`.slice(0, 1_200),
  );
  return [] as ReceivedArticle[];
}

async function eodhdHistory(
  token: string,
  symbol: string,
  from: string,
) {
  const url = new URL(`https://eodhd.com/api/eod/${encodeURIComponent(symbol)}`);
  url.searchParams.set("from", from);
  url.searchParams.set("period", "d");
  url.searchParams.set("order", "a");
  url.searchParams.set("api_token", token);
  url.searchParams.set("fmt", "json");
  const data = await fetchJson(url, `EOD ${symbol}`, 8_000);
  if (!Array.isArray(data)) throw new Error(`EOD ${symbol}: Antwort ist kein Array.`);
  return data as PriceBar[];
}

async function stooqHistory(symbol: string, from: string, to: string) {
  const url = stooqHistoryUrl(symbol, from, to);
  if (!url) return [] as PriceBar[];
  const csv = await fetchText(url, `Stooq EOD ${symbol}`, 8_000, 1);
  return parseStooqCsv(csv);
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function legacyRow(row: Record<string, unknown>) {
  const allowed = [
    "external_id",
    "published_at",
    "topic",
    "title",
    "summary",
    "content",
    "source_url",
    "source_name",
    "symbols",
    "tags",
    "sentiment",
    "impact",
    "market_impact",
    "priced_in",
    "analyst_view",
    "is_published",
  ];
  return Object.fromEntries(allowed.map((key) => [key, row[key]]));
}

function missingIntelligenceSchema(error: unknown) {
  return /schema cache|pgrst204|column .* (?:does not exist|not found)|assessment_version|relevance_score|priced_in_state|recommended_action/i
    .test(safeError(error));
}

function missingHybridSchema(error: unknown) {
  return /hybrid_market_cache|hybrid_api_usage|news_sync_runs|reserve_hybrid_eodhd_calls|pgrst202|could not find the function/i
    .test(safeError(error));
}

async function upsertInChunks(
  admin: any,
  rows: Record<string, unknown>[],
) {
  const ids: string[] = [];
  for (const part of chunks(rows, 80)) {
    const { data, error } = await admin
      .from("market_news")
      .upsert(part, { onConflict: "external_id" })
      .select("id");
    if (error) throw error;
    ids.push(...(data || []).map((item: any) => String(item.id)));
  }
  return ids;
}

async function loadMarketCache(admin: any, symbols: string[]) {
  if (!symbols.length) return [] as MarketCacheRow[];
  const { data, error } = await admin
    .from("hybrid_market_cache")
    .select("symbol,provider,price_bars,fetched_at,last_attempt_at,last_error")
    .in("symbol", symbols);
  if (error) throw error;
  return (data || []) as MarketCacheRow[];
}

async function saveMarketCache(
  admin: any,
  symbol: string,
  provider: string,
  bars: PriceBar[],
) {
  const now = new Date().toISOString();
  const { error } = await admin.from("hybrid_market_cache").upsert({
    symbol,
    provider,
    price_bars: bars,
    fetched_at: now,
    last_attempt_at: now,
    last_error: null,
  }, { onConflict: "symbol" });
  if (error) throw error;
}

async function saveMarketCacheError(
  admin: any,
  existing: MarketCacheRow | undefined,
  symbol: string,
  provider: string,
  error: unknown,
) {
  const now = new Date().toISOString();
  const { error: databaseError } = await admin.from("hybrid_market_cache")
    .upsert({
      symbol,
      provider: existing?.provider || provider,
      price_bars: existing?.price_bars || [],
      fetched_at: existing?.fetched_at || null,
      last_attempt_at: now,
      last_error: safeError(error).slice(0, 700),
    }, { onConflict: "symbol" });
  if (databaseError) throw databaseError;
}

async function reserveEodhdCall(admin: any, dailyLimit: number) {
  const { data, error } = await admin.rpc("reserve_hybrid_eodhd_calls", {
    p_calls: 1,
    p_daily_limit: dailyLimit,
  });
  if (error) throw error;
  return data === true;
}

async function currentEodhdUsage(admin: any) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await admin
    .from("hybrid_api_usage")
    .select("eodhd_calls")
    .eq("usage_date", today)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.eodhd_calls || 0);
}

async function recordSyncRun(
  admin: any,
  values: Record<string, unknown>,
) {
  const { error } = await admin.from("news_sync_runs").insert(values);
  if (error) throw error;
}

async function reuseExistingExternalIds(
  admin: any,
  prepared: PreparedArticle[],
) {
  const since = new Date(Date.now() - 8 * DAY).toISOString();
  const { data, error } = await admin
    .from("market_news")
    .select("external_id,title,published_at")
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(1_000);
  if (error) return;
  const byTitle = new Map<string, any>();
  for (const row of data || []) {
    const key = searchText(row.title);
    if (key && !byTitle.has(key)) byTitle.set(key, row);
  }
  for (const article of prepared) {
    const existing = byTitle.get(searchText(article.title));
    if (!existing) continue;
    const age = Math.abs(
      new Date(article.publishedAt).getTime() -
        new Date(existing.published_at).getTime(),
    );
    if (age <= 36 * 3_600_000) {
      article.externalId = String(existing.external_id);
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let admin: any = null;
  let authMode: "cron" | "user" | null = null;
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "Nur POST erlaubt." },
        { status: 405, headers: jsonHeaders },
      );
    }

    const supabaseUrl = required("SUPABASE_URL");
    const auth = await authorize(req, supabaseUrl);
    authMode = auth.mode;
    if (!auth.ok) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: jsonHeaders },
      );
    }

    admin = createClient(supabaseUrl, serverKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let plansQuery = admin
      .from("trade_plans")
      .select("id,user_id,name,symbol,market_symbol,status,direction")
      .limit(1_000);
    let positionsQuery = admin
      .from("depot_positions")
      .select("id,user_id,trade_id,name,symbol,is_open")
      .eq("is_open", true)
      .limit(1_000);

    if (auth.userId) {
      plansQuery = plansQuery.eq("user_id", auth.userId);
      positionsQuery = positionsQuery.eq("user_id", auth.userId);
    }

    const [
      { data: plans, error: plansError },
      { data: positions, error: positionsError },
    ] = await Promise.all([plansQuery, positionsQuery]);
    if (plansError) throw plansError;
    if (positionsError) throw positionsError;

    const planMap = new Map<string, any>(
      (plans || []).map((plan: any) => [String(plan.id), plan]),
    );
    const portfolio: Ref[] = (positions || []).map((position: any) => {
      const plan = planMap.get(String(position.trade_id));
      return {
        ...plan,
        ...position,
        market_symbol: plan?.market_symbol || null,
        direction: plan?.direction || null,
        __scope: "portfolio",
        __key: `portfolio:${position.trade_id || position.id}`,
      };
    });
    const heldIds = new Set(
      portfolio.map((position) => position.trade_id).filter(Boolean),
    );
    const watchlist: Ref[] = (plans || [])
      .filter((plan: any) =>
        !heldIds.has(plan.id) &&
        !["Geschlossen", "Verworfen"].includes(plan.status)
      )
      .map((plan: any) => ({
        ...plan,
        __scope: "watchlist",
        __key: `watchlist:${plan.id}`,
      }));
    const tracked = [...portfolio, ...watchlist];
    const refsByKey = new Map(
      tracked.map((ref) => [String(ref.__key), ref]),
    );

    const feedQueries = buildFeedQueries(portfolio, watchlist);
    const lookbackDays = integerEnv("RSS_LOOKBACK_DAYS", 3, 1, 7);
    const minimumPublishedAt = Date.now() - (lookbackDays + 1) * DAY;
    const sourceErrors: string[] = [];
    const received: ReceivedArticle[] = [];

    await mapLimit(feedQueries, 5, async (query) => {
      const articles = await fetchFeedQuery(query, lookbackDays, sourceErrors);
      received.push(
        ...articles.filter((article) =>
          new Date(article.publishedAt).getTime() >= minimumPublishedAt
        ),
      );
      return null;
    });

    if (!received.length) {
      throw new Error(
        `Keine RSS-News geladen. ${sourceErrors.slice(-6).join(" | ")}`,
      );
    }

    const deduplicated = new Map<string, ReceivedArticle>();
    for (const article of received) {
      const key = `${searchText(article.title)}|${
        article.publishedAt.slice(0, 10)
      }`;
      const existing = deduplicated.get(key);
      if (existing) {
        existing.queryKeys = [
          ...new Set([...existing.queryKeys, ...article.queryKeys]),
        ];
        existing.queryLabels = [
          ...new Set([...existing.queryLabels, ...article.queryLabels]),
        ];
        existing.topics = [...new Set([...existing.topics, ...article.topics])];
        existing.refKeys = [...new Set([...existing.refKeys, ...article.refKeys])];
      } else {
        deduplicated.set(key, { ...article });
      }
    }

    const prepared: PreparedArticle[] = [];
    for (const article of deduplicated.values()) {
      const queryRefs = article.refKeys
        .map((key) => refsByKey.get(key))
        .filter((ref): ref is Ref => Boolean(ref));
      const querySymbols = queryRefs
        .map((ref) => norm(ref.market_symbol || ref.symbol))
        .filter(Boolean);
      const text = `${article.title} ${article.description}`;
      const portfolioHits = [
        ...new Map(
          [
            ...queryRefs.filter((ref) => ref.__scope === "portfolio"),
            ...portfolio.filter((ref) => matchRef(text, querySymbols, ref)),
          ].map((ref) => [String(ref.__key), ref]),
        ).values(),
      ];
      const watchlistHits = [
        ...new Map(
          [
            ...queryRefs.filter((ref) => ref.__scope === "watchlist"),
            ...watchlist.filter((ref) => matchRef(text, querySymbols, ref)),
          ].map((ref) => [String(ref.__key), ref]),
        ).values(),
      ];
      const topic = topicFrom([], article.topics, text);
      const scope = scopeFor(portfolioHits, watchlistHits, topic);
      const primarySymbol = primarySymbolFor(
        portfolioHits,
        watchlistHits,
        querySymbols,
      );
      const priceContextSymbol = primarySymbol || proxySymbolFor(topic);
      const priceContextKind = primarySymbol ? "direct" : "proxy";
      const linkedSymbols = [
        ...new Set([
          ...querySymbols,
          ...portfolioHits.map((ref) =>
            norm(ref.market_symbol || ref.symbol)
          ).filter(Boolean),
          ...watchlistHits.map((ref) =>
            norm(ref.market_symbol || ref.symbol)
          ).filter(Boolean),
        ]),
      ].slice(0, 16);
      prepared.push({
        externalId: await sha256(
          `hybrid-rss|${article.guid}|${article.title}`,
        ),
        title: article.title,
        content: article.description,
        publishedAt: article.publishedAt,
        sourceUrl: article.link,
        sourceName: article.sourceName,
        feedProvider: article.feedProvider,
        symbols: querySymbols,
        tags: article.queryLabels,
        topic,
        scope,
        primarySymbol,
        priceContextSymbol,
        priceContextKind,
        linkedSymbols,
        portfolioHits,
        watchlistHits,
        queryLabels: article.queryLabels,
      });
    }

    await reuseExistingExternalIds(admin, prepared);

    const scopeRank: Record<NewsScope, number> = {
      portfolio: 0,
      watchlist: 1,
      sector: 2,
      market: 3,
    };
    prepared.sort((a, b) =>
      scopeRank[a.scope] - scopeRank[b.scope] ||
      String(b.publishedAt).localeCompare(String(a.publishedAt))
    );

    const contextLimit = integerEnv(
      "HYBRID_MARKET_CONTEXT_LIMIT",
      36,
      5,
      60,
    );
    const trackedDirectSymbols = [
      ...new Set(
        tracked.map((ref) => norm(ref.market_symbol).toUpperCase()).filter(
          Boolean,
        ),
      ),
    ];
    const articleDirectSymbols = [
      ...new Set(
        prepared
          .filter((article) => article.priceContextKind === "direct")
          .map((article) => norm(article.priceContextSymbol).toUpperCase())
          .filter(Boolean),
      ),
    ];
    const proxyContextSymbols = [
      ...new Set(
        prepared
          .filter((article) => article.priceContextKind === "proxy")
          .map((article) => norm(article.priceContextSymbol).toUpperCase())
          .filter(Boolean),
      ),
    ];
    const directContextSymbols = [
      ...new Set([...trackedDirectSymbols, ...articleDirectSymbols]),
    ];
    const contextSymbols = [
      ...directContextSymbols,
      ...proxyContextSymbols,
    ].slice(0, contextLimit);
    const contextSymbolSet = new Set(contextSymbols);
    const marketWarnings: string[] = [];
    const historyMap = new Map<string, PriceBar[]>();
    const providerMap = new Map<string, string>();
    const cacheUpdatedMap = new Map<string, string>();
    const cacheMap = new Map<string, MarketCacheRow>();
    let hybridSchemaReady = true;

    try {
      const cacheRows = await loadMarketCache(admin, contextSymbols);
      for (const row of cacheRows) {
        const key = norm(row.symbol).toUpperCase();
        cacheMap.set(key, row);
        if (Array.isArray(row.price_bars) && row.price_bars.length) {
          historyMap.set(key, row.price_bars);
          providerMap.set(key, row.provider || "cache");
          if (row.fetched_at) cacheUpdatedMap.set(key, row.fetched_at);
        }
      }
    } catch (error) {
      if (!missingHybridSchema(error)) throw error;
      hybridSchemaReady = false;
      marketWarnings.push(
        "V29.2-Hybrid-Schema fehlt; RSS läuft, Kurscache und Tagesbudget sind bis zur Migration nicht aktiv.",
      );
    }

    const historyFrom = new Date(Date.now() - 90 * DAY)
      .toISOString()
      .slice(0, 10);
    const historyTo = new Date().toISOString().slice(0, 10);
    let stooqSymbolsLoaded = 0;
    const proxyCandidates = proxyContextSymbols.filter((symbol) =>
      stooqSymbol(symbol)
    );

    await mapLimit(proxyCandidates, 3, async (symbol) => {
      const key = symbol.toUpperCase();
      const cached = cacheMap.get(key);
      if (
        cached &&
        cacheIsFresh(cached.fetched_at, 6) &&
        Array.isArray(cached.price_bars) &&
        cached.price_bars.length
      ) {
        return null;
      }
      try {
        const bars = await stooqHistory(symbol, historyFrom, historyTo);
        if (!bars.length) {
          throw new Error(`Stooq EOD ${symbol}: keine Kurszeilen geliefert.`);
        }
        historyMap.set(key, bars);
        providerMap.set(key, "Stooq EOD");
        cacheUpdatedMap.set(key, new Date().toISOString());
        stooqSymbolsLoaded += 1;
        if (hybridSchemaReady) {
          await saveMarketCache(admin, key, "Stooq EOD", bars);
        }
      } catch (error) {
        marketWarnings.push(safeError(error));
        if (hybridSchemaReady) {
          try {
            await saveMarketCacheError(
              admin,
              cached,
              key,
              "Stooq EOD",
              error,
            );
          } catch (cacheError) {
            marketWarnings.push(safeError(cacheError));
          }
        }
      }
      return null;
    });

    const eodhdDailyBudget = integerEnv(
      "HYBRID_EODHD_DAILY_BUDGET",
      6,
      0,
      20,
    );
    const token = env("EODHD_API_TOKEN");
    let eodhdCallsReserved = 0;
    let eodhdCallsSucceeded = 0;
    let eodhdBudgetExhausted = false;
    let eodhdBlocked = false;
    const portfolioSymbols = [
      ...new Set(
        portfolio.map((ref) => norm(ref.market_symbol).toUpperCase()).filter(
          Boolean,
        ),
      ),
    ];
    const watchlistSymbols = [
      ...new Set(
        watchlist.map((ref) => norm(ref.market_symbol).toUpperCase()).filter(
          Boolean,
        ),
      ),
    ].filter((symbol) => !portfolioSymbols.includes(symbol));
    const otherSymbols = directContextSymbols.filter((symbol) =>
      !portfolioSymbols.includes(symbol) && !watchlistSymbols.includes(symbol)
    );
    const refreshOrder = [
      ...rotateForUtcDay(portfolioSymbols),
      ...rotateForUtcDay(watchlistSymbols),
      ...rotateForUtcDay(otherSymbols),
    ].filter((symbol) =>
      !cacheIsFresh(cacheMap.get(symbol)?.fetched_at, 20)
    );

    if (!token && refreshOrder.length) {
      marketWarnings.push(
        "EODHD_API_TOKEN fehlt; RSS und kostenlose Markt-Proxys laufen weiter, direkte Schlusskurse bleiben im vorhandenen Cache.",
      );
    } else if (token && hybridSchemaReady && eodhdDailyBudget > 0) {
      for (const symbol of refreshOrder) {
        if (eodhdBlocked) break;
        let reserved = false;
        try {
          reserved = await reserveEodhdCall(admin, eodhdDailyBudget);
        } catch (error) {
          if (!missingHybridSchema(error)) throw error;
          hybridSchemaReady = false;
          marketWarnings.push(
            "V29.2-Budgetfunktion fehlt; zum Schutz des Free-Tarifs wurden keine EODHD-Aufrufe ausgeführt.",
          );
          break;
        }
        if (!reserved) {
          eodhdBudgetExhausted = true;
          break;
        }
        eodhdCallsReserved += 1;
        const cached = cacheMap.get(symbol);
        try {
          const bars = await eodhdHistory(token, symbol, historyFrom);
          if (!bars.length) {
            throw new Error(`EOD ${symbol}: keine Kurszeilen geliefert.`);
          }
          historyMap.set(symbol, bars);
          providerMap.set(symbol, "EODHD EOD");
          const fetchedAt = new Date().toISOString();
          cacheUpdatedMap.set(symbol, fetchedAt);
          await saveMarketCache(admin, symbol, "EODHD EOD", bars);
          eodhdCallsSucceeded += 1;
        } catch (error) {
          marketWarnings.push(safeError(error));
          try {
            await saveMarketCacheError(
              admin,
              cached,
              symbol,
              "EODHD EOD",
              error,
            );
          } catch (cacheError) {
            marketWarnings.push(safeError(cacheError));
          }
          if (/HTTP 402|daily API requests limit|exceeded/i.test(safeError(error))) {
            eodhdBlocked = true;
          }
        }
      }
    } else if (token && !hybridSchemaReady && refreshOrder.length) {
      marketWarnings.push(
        "Direkte EODHD-Kurse wurden ohne V29.2-Budgettabelle vorsorglich nicht abgerufen.",
      );
    }

    let eodhdCallsUsedToday: number | null = null;
    if (hybridSchemaReady) {
      try {
        eodhdCallsUsedToday = await currentEodhdUsage(admin);
      } catch (error) {
        if (missingHybridSchema(error)) hybridSchemaReady = false;
        marketWarnings.push(safeError(error));
      }
    }
    if (eodhdBudgetExhausted) {
      marketWarnings.push(
        `EODHD-Tagesbudget ${eodhdDailyBudget} erreicht; vorhandene Kurscaches werden weiterverwendet.`,
      );
    }

    const rows: Record<string, unknown>[] = [];
    let pricedArticles = 0;
    let analystArticles = 0;
    const pricingBreakdown = {
      weitgehend: 0,
      teilweise: 0,
      eher_nicht: 0,
      zu_frueh: 0,
      unklar: 0,
    };
    for (const article of prepared.slice(0, 600)) {
      const key = String(article.priceContextSymbol || "").toUpperCase();
      const assessment = assessMarketNews({
        title: article.title,
        content: article.content,
        publishedAt: article.publishedAt,
        topic: article.topic,
        tags: article.tags,
        symbols: article.linkedSymbols,
        sentiment: null,
        primarySymbol: article.primarySymbol,
        priceContextSymbol: article.priceContextSymbol,
        priceContextKind: article.priceContextKind,
        scope: article.scope,
        positionDirections: article.portfolioHits
          .map((ref) => norm(ref.direction))
          .filter(Boolean),
        priceBars: historyMap.get(key) || null,
        liveQuote: null,
        fundamentals: null,
        newsSourceKind: "rss_aggregator",
        priceProvider: providerMap.get(key) || null,
        priceContextUpdatedAt: cacheUpdatedMap.get(key) || null,
      });
      if (assessment.price_reaction_percent !== null) pricedArticles += 1;
      pricingBreakdown[assessment.priced_in_state] += 1;
      if (assessment.analyst_signal !== "nicht_verfuegbar") {
        analystArticles += 1;
      }

      rows.push({
        external_id: article.externalId,
        published_at: article.publishedAt,
        topic: article.topic,
        title: article.title,
        summary: norm(article.content).slice(0, 520),
        content: article.content,
        source_url: article.sourceUrl || null,
        source_name: article.sourceName || article.feedProvider,
        symbols: article.linkedSymbols,
        tags: [
          ...new Set([
            ...article.tags,
            article.topic,
            "RSS",
            article.feedProvider,
            article.scope === "portfolio"
              ? "Portfolio"
              : article.scope === "watchlist"
              ? "Watchlist"
              : "",
          ]),
        ].filter(Boolean).slice(0, 20),
        sentiment: null,
        ...assessment,
        is_published: true,
      });
    }

    let intelligenceSchemaReady = true;
    let savedIds: string[] = [];
    const syncWarnings = [...marketWarnings];
    try {
      savedIds = await upsertInChunks(admin, rows);
    } catch (error) {
      if (!missingIntelligenceSchema(error)) throw error;
      intelligenceSchemaReady = false;
      syncWarnings.unshift(
        "V29-Bewertungsschema fehlt; News wurden im V28-Kompatibilitätsmodus gespeichert. version29-market-intelligence-schema.sql ausführen.",
      );
      savedIds = await upsertInChunks(admin, rows.map(legacyRow));
    }

    const feedProviders = [...new Set(received.map((item) => item.feedProvider))];
    const sourceNames = [...new Set(received.map((item) => item.sourceName))];
    const durationMs = Date.now() - startedAt;
    const responseBody = {
      ok: true,
      version: BUILD_VERSION,
      request_id: requestId,
      provider:
        "Kostenlose RSS-News + EODHD-Tagescache + Stooq-Markt-Proxys",
      auth_mode: auth.mode,
      schema_ready: intelligenceSchemaReady && hybridSchemaReady,
      intelligence_schema_ready: intelligenceSchemaReady,
      hybrid_schema_ready: hybridSchemaReady,
      tracked_instruments: tracked.length,
      portfolio_positions: portfolio.length,
      watchlist_items: watchlist.length,
      rss_queries: feedQueries.length,
      rss_feed_providers: feedProviders,
      rss_source_count: sourceNames.length,
      received: received.length,
      unique: rows.length,
      inserted: savedIds.length,
      assessed: rows.length,
      priced_articles: pricedArticles,
      pricing_breakdown: pricingBreakdown,
      analyst_articles: analystArticles,
      market_context_symbols: contextSymbols.length,
      direct_context_symbols: directContextSymbols
        .filter((symbol) => contextSymbolSet.has(symbol)).length,
      proxy_context_symbols: proxyContextSymbols
        .filter((symbol) => contextSymbolSet.has(symbol)).length,
      historical_symbols: historyMap.size,
      cached_history_symbols: [...historyMap.keys()].filter((symbol) =>
        cacheMap.has(symbol)
      ).length,
      stooq_symbols_loaded: stooqSymbolsLoaded,
      eodhd_daily_budget: eodhdDailyBudget,
      eodhd_calls_reserved: eodhdCallsReserved,
      eodhd_calls_succeeded: eodhdCallsSucceeded,
      eodhd_calls_used_today: eodhdCallsUsedToday,
      eodhd_budget_exhausted: eodhdBudgetExhausted,
      live_quote_symbols: 0,
      fundamentals_symbols: 0,
      source_errors: sourceErrors.slice(-20),
      warnings: syncWarnings.slice(0, 30),
      duration_ms: durationMs,
    };

    if (hybridSchemaReady) {
      try {
        await recordSyncRun(admin, {
          started_at: new Date(startedAt).toISOString(),
          finished_at: new Date().toISOString(),
          ok: true,
          auth_mode: auth.mode,
          version: BUILD_VERSION,
          provider: responseBody.provider,
          inserted: savedIds.length,
          assessed: rows.length,
          rss_articles: received.length,
          eodhd_calls: eodhdCallsReserved,
          warning_count: sourceErrors.length + syncWarnings.length,
          error_message: null,
          details: responseBody,
        });
      } catch (error) {
        syncWarnings.push(`Sync-Protokoll: ${safeError(error)}`);
        responseBody.warnings = syncWarnings.slice(0, 30);
      }
    }

    return Response.json(responseBody, { headers: jsonHeaders });
  } catch (error) {
    const message = safeError(error);
    console.error("sync-news-v29-2", { requestId, message });
    if (admin) {
      try {
        await recordSyncRun(admin, {
          started_at: new Date(startedAt).toISOString(),
          finished_at: new Date().toISOString(),
          ok: false,
          auth_mode: authMode,
          version: BUILD_VERSION,
          provider:
            "Kostenlose RSS-News + EODHD-Tagescache + Stooq-Markt-Proxys",
          inserted: 0,
          assessed: 0,
          rss_articles: 0,
          eodhd_calls: 0,
          warning_count: 0,
          error_message: message.slice(0, 1_500),
          details: { request_id: requestId },
        });
      } catch {
        // Das Fehlerprotokoll ist optional; die eigentliche Fehlermeldung bleibt erhalten.
      }
    }
    return Response.json(
      {
        ok: false,
        version: BUILD_VERSION,
        request_id: requestId,
        error: message,
        duration_ms: Date.now() - startedAt,
      },
      { status: 500, headers: jsonHeaders },
    );
  }
});
