import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import {
  assessMarketNews,
  type FundamentalContext,
  type LiveQuote,
  type NewsScope,
  type PriceBar,
} from "../_shared/market-intelligence.ts";

const BUILD_VERSION = "29.0-market-intelligence-sync";
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
};

type AuthContext = {
  ok: boolean;
  mode: "cron" | "user" | null;
  userId: string | null;
};

type NewsQuery = {
  kind: "symbol" | "topic";
  value: string;
};

type PreparedArticle = {
  raw: any;
  externalId: string;
  title: string;
  content: string;
  publishedAt: string;
  symbols: string[];
  tags: string[];
  topic: string;
  scope: NewsScope;
  primarySymbol: string | null;
  linkedSymbols: string[];
  portfolioHits: Ref[];
  watchlistHits: Ref[];
  queries: string[];
};

function env(name: string) {
  return Deno.env.get(name)?.trim() || null;
}

function required(name: string) {
  const value = env(name);
  if (!value) throw new Error(`${name} fehlt.`);
  return value;
}

function integerEnv(name: string, fallback: number, minimum: number, maximum: number) {
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
  if (/semiconductor|chip|memory|foundry|hbm|dram|nand|gpu/.test(haystack)) {
    return "Halbleiter";
  }
  if (
    /artificial intelligence|\bai\b|machine learning|llm|agentic/.test(haystack)
  ) {
    return "KI";
  }
  if (/energy|oil|gas|solar|wind|uranium|electricity|battery/.test(haystack)) {
    return "Energie";
  }
  if (/forex|eurusd|currency|euro|dollar|exchange rate/.test(haystack)) {
    return "EUR/USD";
  }
  if (
    /macro|inflation|interest rate|central bank|gdp|employment|fomc|ecb/.test(
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
  queries: string[],
) {
  const preferred = [...portfolioHits, ...watchlistHits]
    .map((ref) => norm(ref.market_symbol))
    .find(Boolean);
  if (preferred) return preferred;
  const articleSymbol = articleSymbols.find((symbol) => /\.[A-Z0-9-]+$/i.test(symbol));
  if (articleSymbol) return articleSymbol;
  return queries.find((query) => /\.[A-Z0-9-]+$/i.test(query)) || null;
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchJson(
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
        headers: { Accept: "application/json" },
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
      try {
        return JSON.parse(raw);
      } catch {
        throw new Error(`${label}: ungültige JSON-Antwort.`);
      }
    } catch (error) {
      lastError = error;
      if (attempt < retries && (error instanceof DOMException || /fetch|abort/i.test(safeError(error)))) {
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

async function eodhdNews(
  token: string,
  query: NewsQuery,
  from: string,
  limit = 20,
) {
  const parameter = query.kind === "symbol" ? "s" : "t";
  const url = new URL("https://eodhd.com/api/news");
  url.searchParams.set(parameter, query.value);
  url.searchParams.set("from", from);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("api_token", token);
  url.searchParams.set("fmt", "json");
  const data = await fetchJson(url, `News ${query.kind}:${query.value}`, 10_000, 0);
  if (!Array.isArray(data)) {
    throw new Error(`${query.kind}:${query.value}: Antwort ist kein Array.`);
  }
  return data;
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
  const data = await fetchJson(url, `EOD ${symbol}`, 8_000, 0);
  if (!Array.isArray(data)) throw new Error(`EOD ${symbol}: Antwort ist kein Array.`);
  return data as PriceBar[];
}

async function eodhdLiveBatch(token: string, symbols: string[]) {
  if (!symbols.length) return [] as LiveQuote[];
  const [first, ...rest] = symbols;
  const url = new URL(
    `https://eodhd.com/api/real-time/${encodeURIComponent(first)}`,
  );
  if (rest.length) url.searchParams.set("s", rest.join(","));
  url.searchParams.set("api_token", token);
  url.searchParams.set("fmt", "json");
  const data = await fetchJson(url, `Live ${symbols.length} Symbole`, 8_000, 0);
  return (Array.isArray(data) ? data : [data]) as LiveQuote[];
}

async function eodhdFundamentals(
  token: string,
  symbol: string,
): Promise<FundamentalContext> {
  const url = new URL(
    `https://eodhd.com/api/v1.1/fundamentals/${encodeURIComponent(symbol)}`,
  );
  url.searchParams.set(
    "filter",
    "Highlights::WallStreetTargetPrice,General::CurrencyCode,General::UpdatedAt",
  );
  url.searchParams.set("api_token", token);
  url.searchParams.set("fmt", "json");
  const data = await fetchJson(url, `Fundamentals ${symbol}`, 8_000, 0);
  return {
    targetPrice: Number.isFinite(Number(data?.Highlights?.WallStreetTargetPrice))
      ? Number(data.Highlights.WallStreetTargetPrice)
      : Number.isFinite(Number(data?.WallStreetTargetPrice))
      ? Number(data.WallStreetTargetPrice)
      : null,
    currency: data?.General?.CurrencyCode || data?.CurrencyCode || null,
    updatedAt: data?.General?.UpdatedAt || data?.UpdatedAt || null,
  };
}

function supportsFundamentals(symbol: string) {
  return !/\.(FOREX|CC|INDX|GBOND|MONEY)$/i.test(symbol);
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "Nur POST erlaubt." },
        { status: 405, headers: jsonHeaders },
      );
    }

    const supabaseUrl = required("SUPABASE_URL");
    const auth = await authorize(req, supabaseUrl);
    if (!auth.ok) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: jsonHeaders },
      );
    }

    const token = required("EODHD_API_TOKEN");
    const admin = createClient(supabaseUrl, serverKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let plansQuery = admin
      .from("trade_plans")
      .select("id,user_id,name,symbol,market_symbol,status,direction")
      .limit(1000);
    let positionsQuery = admin
      .from("depot_positions")
      .select("id,user_id,trade_id,name,symbol,is_open")
      .eq("is_open", true)
      .limit(1000);

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
    const portfolio: Ref[] = (positions || []).map((position: any) => ({
      ...planMap.get(String(position.trade_id)),
      ...position,
      market_symbol:
        planMap.get(String(position.trade_id))?.market_symbol || null,
      direction: planMap.get(String(position.trade_id))?.direction || null,
    }));
    const heldIds = new Set(
      portfolio.map((position) => position.trade_id).filter(Boolean),
    );
    const watchlist: Ref[] = (plans || []).filter((plan: any) =>
      !heldIds.has(plan.id) &&
      !["Geschlossen", "Verworfen"].includes(plan.status)
    );
    const tracked = [...portfolio, ...watchlist];

    const queries: NewsQuery[] = [];
    for (const ref of tracked) {
      const eodhdSymbol = norm(ref.market_symbol);
      if (eodhdSymbol) {
        queries.push({ kind: "symbol", value: eodhdSymbol });
      } else if (ref.name) {
        queries.push({ kind: "topic", value: ref.name });
      }
    }
    for (
      const topic of [
        "artificial intelligence",
        "semiconductors",
        "energy",
        "macroeconomics",
      ]
    ) {
      queries.push({ kind: "topic", value: topic });
    }
    queries.push({ kind: "symbol", value: "EURUSD.FOREX" });

    const queryLimit = integerEnv("NEWS_QUERY_LIMIT", 50, 5, 80);
    const uniqueQueries = [
      ...new Map(
        queries.map((query) => [
          `${query.kind}:${query.value.toUpperCase()}`,
          query,
        ]),
      ).values(),
    ].slice(0, queryLimit);

    const lookbackDays = integerEnv("NEWS_LOOKBACK_DAYS", 10, 2, 30);
    const from = new Date(Date.now() - lookbackDays * DAY)
      .toISOString()
      .slice(0, 10);
    const received: any[] = [];
    const sourceErrors: string[] = [];

    await mapLimit(uniqueQueries, 5, async (query) => {
      try {
        const articles = await eodhdNews(token, query, from, 20);
        for (const article of articles) {
          received.push({ ...article, __query: query.value });
        }
      } catch (error) {
        sourceErrors.push(safeError(error));
      }
      return null;
    });

    if (!received.length) {
      throw new Error(
        `Keine News geladen. ${sourceErrors.slice(0, 5).join(" | ")}`,
      );
    }

    const deduplicated = new Map<string, any>();
    for (const article of received) {
      const externalId = await sha256(
        String(article.link || `${article.date}|${article.title}`),
      );
      const existing = deduplicated.get(externalId);
      if (existing) {
        existing.__queries = [
          ...new Set([...(existing.__queries || []), article.__query]),
        ];
      } else {
        deduplicated.set(externalId, {
          ...article,
          __external: externalId,
          __queries: [article.__query],
        });
      }
    }

    const prepared: PreparedArticle[] = [];
    for (const article of deduplicated.values()) {
      const symbols = Array.isArray(article.symbols)
        ? article.symbols.map(String)
        : [];
      const tags = Array.isArray(article.tags) ? article.tags.map(String) : [];
      const title = norm(article.title) || "Ohne Titel";
      const content = String(article.content || "").trim();
      const text = `${title} ${norm(content)}`;
      const portfolioHits = portfolio.filter((ref) =>
        matchRef(text, symbols, ref)
      );
      const watchlistHits = watchlist.filter((ref) =>
        matchRef(text, symbols, ref)
      );
      const queriesForArticle = Array.isArray(article.__queries)
        ? article.__queries.map(String)
        : [];
      const topic = topicFrom(tags, queriesForArticle, text);
      const scope = scopeFor(portfolioHits, watchlistHits, topic);
      const primarySymbol = primarySymbolFor(
        portfolioHits,
        watchlistHits,
        symbols,
        queriesForArticle,
      );
      const linkedSymbols = [
        ...new Set([
          ...symbols,
          ...portfolioHits.map((ref) =>
            norm(ref.market_symbol || ref.symbol)
          ).filter(Boolean),
          ...watchlistHits.map((ref) =>
            norm(ref.market_symbol || ref.symbol)
          ).filter(Boolean),
        ]),
      ].slice(0, 16);
      prepared.push({
        raw: article,
        externalId: article.__external,
        title,
        content,
        publishedAt: article.date || new Date().toISOString(),
        symbols,
        tags,
        topic,
        scope,
        primarySymbol,
        linkedSymbols,
        portfolioHits,
        watchlistHits,
        queries: queriesForArticle,
      });
    }

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
      "NEWS_MARKET_CONTEXT_LIMIT",
      24,
      4,
      40,
    );
    const contextSymbols = [
      ...new Set(
        prepared.map((article) => norm(article.primarySymbol)).filter(Boolean),
      ),
    ].slice(0, contextLimit);
    const marketWarnings: string[] = [];
    const liveMap = new Map<string, LiveQuote>();
    const historyMap = new Map<string, PriceBar[]>();
    const fundamentalsMap = new Map<string, FundamentalContext>();

    await mapLimit(chunks(contextSymbols, 15), 2, async (batch) => {
      try {
        const quotes = await eodhdLiveBatch(token, batch);
        for (const quote of quotes) {
          if (quote?.code) liveMap.set(String(quote.code).toUpperCase(), quote);
        }
      } catch (error) {
        marketWarnings.push(safeError(error));
      }
      return null;
    });

    const historyFrom = new Date(Date.now() - 75 * DAY)
      .toISOString()
      .slice(0, 10);
    await mapLimit(contextSymbols, 4, async (symbol) => {
      try {
        historyMap.set(
          symbol.toUpperCase(),
          await eodhdHistory(token, symbol, historyFrom),
        );
      } catch (error) {
        marketWarnings.push(safeError(error));
      }
      return null;
    });

    const fundamentalsLimit = integerEnv(
      "NEWS_FUNDAMENTALS_LIMIT",
      12,
      0,
      25,
    );
    const fundamentalsSymbols = contextSymbols
      .filter(supportsFundamentals)
      .slice(0, fundamentalsLimit);
    await mapLimit(fundamentalsSymbols, 3, async (symbol) => {
      try {
        fundamentalsMap.set(
          symbol.toUpperCase(),
          await eodhdFundamentals(token, symbol),
        );
      } catch (error) {
        marketWarnings.push(safeError(error));
      }
      return null;
    });

    const rows: Record<string, unknown>[] = [];
    let pricedArticles = 0;
    let analystArticles = 0;
    for (const article of prepared.slice(0, 600)) {
      const key = String(article.primarySymbol || "").toUpperCase();
      const assessment = assessMarketNews({
        title: article.title,
        content: article.content,
        publishedAt: article.publishedAt,
        topic: article.topic,
        tags: article.tags,
        symbols: article.symbols,
        sentiment: Number.isFinite(Number(article.raw.sentiment?.polarity))
          ? Number(article.raw.sentiment.polarity)
          : null,
        primarySymbol: article.primarySymbol,
        scope: article.scope,
        positionDirections: article.portfolioHits
          .map((ref) => norm(ref.direction))
          .filter(Boolean),
        priceBars: historyMap.get(key) || null,
        liveQuote: liveMap.get(key) || null,
        fundamentals: fundamentalsMap.get(key) || null,
      });
      if (assessment.price_reaction_percent !== null) pricedArticles += 1;
      if (
        assessment.analyst_target_price !== null ||
        assessment.analyst_signal !== "nicht_verfuegbar"
      ) {
        analystArticles += 1;
      }

      rows.push({
        external_id: article.externalId,
        published_at: article.publishedAt,
        topic: article.topic,
        title: article.title,
        summary: norm(article.content).slice(0, 520),
        content: article.content,
        source_url: article.raw.link || null,
        source_name: "EODHD News",
        symbols: article.linkedSymbols,
        tags: [
          ...new Set([
            ...article.tags,
            article.topic,
            article.scope === "portfolio"
              ? "Portfolio"
              : article.scope === "watchlist"
              ? "Watchlist"
              : "",
          ]),
        ].filter(Boolean).slice(0, 20),
        sentiment: Number.isFinite(Number(article.raw.sentiment?.polarity))
          ? Number(article.raw.sentiment.polarity)
          : null,
        ...assessment,
        is_published: true,
      });
    }

    let schemaReady = true;
    let savedIds: string[] = [];
    const syncWarnings = [...marketWarnings];
    try {
      savedIds = await upsertInChunks(admin, rows);
    } catch (error) {
      if (!missingIntelligenceSchema(error)) throw error;
      schemaReady = false;
      syncWarnings.unshift(
        "V29-Bewertungsschema fehlt; News wurden im V28-Kompatibilitätsmodus gespeichert. version29-market-intelligence-schema.sql ausführen.",
      );
      savedIds = await upsertInChunks(admin, rows.map(legacyRow));
    }

    return Response.json(
      {
        ok: true,
        version: BUILD_VERSION,
        request_id: requestId,
        provider:
          "EODHD News + Kursreaktion + verzögerte Live-Kurse + Fundamentaldaten",
        auth_mode: auth.mode,
        schema_ready: schemaReady,
        tracked_instruments: tracked.length,
        portfolio_positions: portfolio.length,
        watchlist_items: watchlist.length,
        queries: uniqueQueries.length,
        received: received.length,
        unique: rows.length,
        inserted: savedIds.length,
        assessed: rows.length,
        priced_articles: pricedArticles,
        analyst_articles: analystArticles,
        market_context_symbols: contextSymbols.length,
        live_quote_symbols: liveMap.size,
        historical_symbols: historyMap.size,
        fundamentals_symbols: fundamentalsMap.size,
        source_errors: sourceErrors.slice(0, 20),
        warnings: syncWarnings.slice(0, 30),
        duration_ms: Date.now() - startedAt,
      },
      { headers: jsonHeaders },
    );
  } catch (error) {
    const message = safeError(error);
    console.error("sync-news-v29", { requestId, message });
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
