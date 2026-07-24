import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";

const BUILD_VERSION = "28.2-news-sync-cors";

type Ref = {
  id: string;
  user_id: string;
  trade_id?: string | null;
  name: string;
  symbol?: string | null;
  market_symbol?: string | null;
  status?: string | null;
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

function env(name: string) {
  return Deno.env.get(name)?.trim() || null;
}

function required(name: string) {
  const value = env(name);
  if (!value) throw new Error(`${name} fehlt.`);
  return value;
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

function topicFrom(tags: string[], requested: string, text: string) {
  const haystack = `${requested} ${tags.join(" ")} ${text}`.toLowerCase();
  if (/semiconductor|chip|memory|foundry|hbm|dram|nand|gpu/.test(haystack)) {
    return "Halbleiter";
  }
  if (
    /artificial intelligence|\bai\b|machine learning|llm|agentic/.test(
      haystack,
    )
  ) {
    return "KI";
  }
  if (
    /energy|oil|gas|solar|wind|uranium|electricity|battery/.test(haystack)
  ) {
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

function impact(sentiment: any, title: string, portfolioHits: number) {
  const polarity = Math.abs(Number(sentiment?.polarity || 0));
  const headline = title.toLowerCase();
  if (
    portfolioHits > 0 &&
    (
      /earnings|guidance|profit warning|acquisition|merger|recall|bankruptcy|default|dividend|capital increase|downgrade|upgrade/
        .test(
          headline,
        ) || polarity >= 0.65
    )
  ) {
    return "hoch";
  }
  if (
    portfolioHits > 0 ||
    polarity >= 0.3 ||
    /earnings|guidance|forecast|production|order|contract|rating|target price/
      .test(
        headline,
      )
  ) {
    return "mittel";
  }
  return "niedrig";
}

function valuation(sentiment: any, impactValue: string) {
  const polarity = Number(sentiment?.polarity);
  const direction = Number.isFinite(polarity)
    ? polarity > 0.15 ? "positiv" : polarity < -0.15 ? "negativ" : "neutral"
    : "neutral";
  return {
    market_impact:
      `Vorläufige automatische Einordnung: ${direction}; Relevanz ${impactValue}. Kursreaktion und Investmentthese im Dashboard gegenprüfen.`,
    priced_in:
      "Automatische Einpreisungsprüfung benötigt aktuelle Kursreaktion; noch manuell zu bestätigen.",
    analyst_view:
      "Analystenänderungen werden aus News-Schlagzeilen erkannt; Konsensdaten sind nicht Bestandteil dieses Feeds.",
  };
}

async function eodhd(
  token: string,
  query: NewsQuery,
  from: string,
  limit = 25,
) {
  const parameter = query.kind === "symbol" ? "s" : "t";
  const url = new URL("https://eodhd.com/api/news");
  url.searchParams.set(parameter, query.value);
  url.searchParams.set("from", from);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("api_token", token);
  url.searchParams.set("fmt", "json");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(
      `${query.kind}:${query.value}: HTTP ${response.status} ${
        raw.slice(0, 160)
      }`,
    );
  }
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error(`${query.kind}:${query.value}: Antwort ist kein Array.`);
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "Nur POST erlaubt." },
        { status: 405, headers: jsonHeaders },
      );
    }

    const url = required("SUPABASE_URL");
    const auth = await authorize(req, url);
    if (!auth.ok) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: jsonHeaders },
      );
    }

    const token = required("EODHD_API_TOKEN");
    const admin = createClient(url, serverKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let plansQuery = admin
      .from("trade_plans")
      .select("id,user_id,name,symbol,market_symbol,status")
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
      market_symbol: planMap.get(String(position.trade_id))?.market_symbol ||
        null,
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
      const eodhdSymbol = String(ref.market_symbol || "").trim();
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

    const unique = [
      ...new Map(
        queries.map((query) => [
          `${query.kind}:${query.value.toUpperCase()}`,
          query,
        ]),
      ).values(),
    ].slice(0, 60);

    const from = new Date(Date.now() - 10 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const received: any[] = [];
    const errors: string[] = [];

    for (const query of unique) {
      try {
        const rows = await eodhd(token, query, from, 20);
        rows.forEach((article) =>
          received.push({ ...article, __query: query.value })
        );
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
      await new Promise((resolve) => setTimeout(resolve, 110));
    }

    if (!received.length) {
      throw new Error(
        `Keine News geladen. ${errors.slice(0, 5).join(" | ")}`,
      );
    }

    const deduplicated = new Map<string, any>();
    for (const article of received) {
      const key = await sha256(
        String(article.link || `${article.date}|${article.title}`),
      );
      if (!deduplicated.has(key)) {
        deduplicated.set(key, { ...article, __external: key });
      }
    }

    const rows: any[] = [];
    for (const article of deduplicated.values()) {
      const symbols = Array.isArray(article.symbols)
        ? article.symbols.map(String)
        : [];
      const tags = Array.isArray(article.tags) ? article.tags.map(String) : [];
      const text = `${article.title || ""} ${article.content || ""}`;
      const portfolioHits = portfolio.filter((ref) =>
        matchRef(text, symbols, ref)
      );
      const watchlistHits = watchlist.filter((ref) =>
        matchRef(text, symbols, ref)
      );
      const linkedSymbols = [
        ...new Set([
          ...symbols,
          ...portfolioHits.map((ref) =>
            String(ref.market_symbol || ref.symbol || "")
          ).filter(Boolean),
          ...watchlistHits.map((ref) =>
            String(ref.market_symbol || ref.symbol || "")
          ).filter(Boolean),
        ]),
      ].slice(0, 16);
      const impactValue = impact(
        article.sentiment,
        String(article.title || ""),
        portfolioHits.length,
      );
      const valuationResult = valuation(article.sentiment, impactValue);
      const topic = topicFrom(tags, article.__query, text);

      rows.push({
        external_id: article.__external,
        published_at: article.date || new Date().toISOString(),
        topic,
        title: String(article.title || "Ohne Titel"),
        summary: String(article.content || "")
          .replace(/\s+/g, " ")
          .slice(0, 520),
        content: String(article.content || ""),
        source_url: article.link || null,
        source_name: "EODHD News",
        symbols: linkedSymbols,
        tags: [
          ...new Set([
            ...tags,
            topic,
            portfolioHits.length
              ? "Portfolio"
              : watchlistHits.length
              ? "Watchlist"
              : "",
          ]),
        ].filter(Boolean).slice(0, 16),
        sentiment: Number.isFinite(Number(article.sentiment?.polarity))
          ? Number(article.sentiment.polarity)
          : null,
        impact: impactValue,
        ...valuationResult,
        is_published: true,
      });
    }

    const { data: upserted, error: upsertError } = await admin
      .from("market_news")
      .upsert(rows, { onConflict: "external_id" })
      .select("id");
    if (upsertError) throw upsertError;

    return Response.json(
      {
        ok: true,
        version: BUILD_VERSION,
        request_id: requestId,
        provider: "EODHD Unternehmens-News + Themenfeeds",
        auth_mode: auth.mode,
        tracked_instruments: tracked.length,
        portfolio_positions: portfolio.length,
        watchlist_items: watchlist.length,
        queries: unique.length,
        received: received.length,
        unique: rows.length,
        inserted: upserted?.length || 0,
        source_errors: errors.slice(0, 20),
      },
      { headers: jsonHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("sync-news-v28-2", { requestId, message });
    return Response.json(
      {
        ok: false,
        version: BUILD_VERSION,
        request_id: requestId,
        error: message,
      },
      { status: 500, headers: jsonHeaders },
    );
  }
});
