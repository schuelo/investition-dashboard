import { createClient } from "npm:@supabase/supabase-js@2.49.8";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type NewsRow = {
  external_id: string;
  published_at: string;
  topic: string;
  title: string;
  summary: string;
  content: string;
  source_url: string | null;
  source_name: string;
  symbols: string[];
  tags: string[];
  sentiment: number | null;
  impact: "hoch" | "mittel" | "niedrig";
  market_impact: string;
  priced_in: string;
  analyst_view: string;
  is_published: boolean;
};

function serverKey(): string {
  const direct = Deno.env.get("SUPABASE_SECRET_KEY")?.trim() ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (direct) return direct;

  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) throw new Error("Kein Supabase-Server-Key verfügbar.");
  const keys = JSON.parse(raw) as Record<string, string>;
  const key = keys.default || Object.values(keys).find((value) => typeof value === "string" && value.length > 0);
  if (!key) throw new Error("Kein verwendbarer Supabase-Server-Key gefunden.");
  return key;
}

function publishableKey(): string {
  const direct = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() ||
    Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  if (direct) return direct;

  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!raw) throw new Error("Kein Supabase-Publishable-Key verfügbar.");
  const keys = JSON.parse(raw) as Record<string, string>;
  const key = keys.default || Object.values(keys).find((value) => typeof value === "string" && value.length > 0);
  if (!key) throw new Error("Kein verwendbarer Supabase-Publishable-Key gefunden.");
  return key;
}

async function authorized(req: Request, supabaseUrl: string): Promise<boolean> {
  const expected = Deno.env.get("CRON_SECRET")?.trim();
  if (expected && req.headers.get("x-cron-secret")?.trim() === expected) return true;

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization) return false;

  const client = createClient(supabaseUrl, publishableKey(), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  return !error && Boolean(data.user);
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseGdeltDate(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return new Date().toISOString();
  if (/^\d{8}T\d{6}Z$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}Z`;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normalizeText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function domainName(urlValue: unknown): string {
  try {
    return new URL(String(urlValue)).hostname.replace(/^www\./, "");
  } catch {
    return "GDELT News";
  }
}

function impactFor(topic: string, title: string): "hoch" | "mittel" | "niedrig" {
  const text = `${topic} ${title}`.toLowerCase();
  if (/bankruptcy|default|war|sanction|acquisition|merger|profit warning|rate decision|emergency|recall/.test(text)) return "hoch";
  if (/earnings|guidance|inflation|interest rate|production|forecast|subsidy|export|tariff/.test(text)) return "mittel";
  return "niedrig";
}

function detectSymbols(title: string, plans: Array<{ name: string; market_symbol: string | null }>): string[] {
  const haystack = title.toLowerCase();
  return plans
    .filter((plan) => {
      const name = String(plan.name || "").toLowerCase().replace(/\b(ag|se|inc|corp|ltd|vz\.)\b/g, "").trim();
      return name.length >= 3 && haystack.includes(name);
    })
    .map((plan) => String(plan.market_symbol || "").trim())
    .filter(Boolean);
}

async function gdeltArticles(query: string, maxRecords = 25): Promise<any[]> {
  const params = new URLSearchParams({
    query,
    mode: "artlist",
    maxrecords: String(maxRecords),
    format: "json",
    timespan: "48H",
    sort: "datedesc",
  });
  const endpoint = `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`;
  const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
  const raw = await response.text();
  if (!response.ok) throw new Error(`GDELT HTTP ${response.status}: ${raw.slice(0, 180)}`);

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("GDELT lieferte keine gültige JSON-Antwort.");
  }
  return Array.isArray(payload?.articles) ? payload.articles : [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return Response.json({ ok: false, error: "Nur POST ist erlaubt." }, { status: 405, headers });

  const requestId = crypto.randomUUID();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    if (!supabaseUrl) throw new Error("SUPABASE_URL fehlt.");
    if (!(await authorized(req, supabaseUrl))) {
      return Response.json({ ok: false, error: "Unauthorized", request_id: requestId }, { status: 401, headers });
    }

    const body = await req.json().catch(() => ({}));
    const force = Boolean(body.force);
    const admin = createClient(supabaseUrl, serverKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (!force) {
      const { data: last, error: lastError } = await admin
        .from("market_news")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastError) throw new Error(`market_news nicht erreichbar: ${lastError.message}`);
      if (last?.updated_at && Date.now() - new Date(last.updated_at).getTime() < 45 * 60 * 1000) {
        return Response.json({
          ok: true,
          skipped: true,
          provider: "GDELT",
          message: "Letzte Synchronisierung liegt weniger als 45 Minuten zurück.",
          request_id: requestId,
        }, { headers });
      }
    }

    const { data: planRows, error: planError } = await admin
      .from("trade_plans")
      .select("name, market_symbol")
      .eq("monitoring_enabled", true)
      .limit(50);
    if (planError) console.warn("trade_plans konnte für Symbolzuordnung nicht gelesen werden", planError.message);
    const plans = (planRows || []) as Array<{ name: string; market_symbol: string | null }>;

    const topicQueries = [
      { topic: "KI", query: '("artificial intelligence" OR "machine learning" OR AI) (stock OR market OR company OR investment)' },
      { topic: "Halbleiter", query: '(semiconductor OR chip OR foundry OR memory) (stock OR market OR company)' },
      { topic: "Energie", query: '(energy OR oil OR gas OR uranium OR solar OR wind) (stock OR market OR company)' },
      { topic: "Makro", query: '(inflation OR "interest rates" OR "central bank" OR GDP OR employment) (market OR stocks OR currency)' },
      { topic: "EUR/USD", query: '("EUR/USD" OR "euro dollar" OR ECB OR "Federal Reserve") (currency OR forex OR market)' },
    ];

    const sourceErrors: string[] = [];
    const collected: Array<{ topic: string; article: any }> = [];

    for (const entry of topicQueries) {
      try {
        const articles = await gdeltArticles(entry.query, 20);
        articles.forEach((article) => collected.push({ topic: entry.topic, article }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        sourceErrors.push(`${entry.topic}: ${message}`);
      }
    }

    if (!collected.length) {
      throw new Error(`Keine News geladen. ${sourceErrors.join(" | ")}`.trim());
    }

    const deduped = new Map<string, NewsRow>();
    for (const { topic, article } of collected) {
      const sourceUrl = normalizeText(article.url || article.url_mobile || article.link);
      const title = normalizeText(article.title) || "Ohne Titel";
      if (!sourceUrl) continue;

      const externalId = await sha256(sourceUrl);
      if (deduped.has(externalId)) continue;

      const excerpt = normalizeText(article.context || article.snippet || article.description || article.excerpt);
      const summary = excerpt || title;
      const sourceName = normalizeText(article.domain) || domainName(sourceUrl);
      const symbols = detectSymbols(title, plans);

      deduped.set(externalId, {
        external_id: externalId,
        published_at: parseGdeltDate(article.seendate || article.date || article.datetime),
        topic,
        title,
        summary: summary.slice(0, 500),
        content: excerpt
          ? excerpt.slice(0, 1800)
          : "Für diese Meldung liegt im offenen Feed kein Volltextauszug vor. Öffne die Originalquelle für den vollständigen Artikel.",
        source_url: sourceUrl,
        source_name: sourceName,
        symbols,
        tags: [topic, "GDELT"],
        sentiment: null,
        impact: impactFor(topic, title),
        market_impact: "Automatisch zugeordnet. Die konkrete Auswirkung auf Entry, Stop und Kursziele muss im Analysekontext geprüft werden.",
        priced_in: "Noch nicht bewertet",
        analyst_view: "Noch nicht bewertet",
        is_published: true,
      });
    }

    const rows = [...deduped.values()];
    if (!rows.length) throw new Error("News-Antwort enthielt keine verwertbaren Artikel-URLs.");

    const { data: saved, error: saveError } = await admin
      .from("market_news")
      .upsert(rows, { onConflict: "external_id" })
      .select("id");
    if (saveError) throw new Error(`market_news konnte nicht gespeichert werden: ${saveError.message}`);

    return Response.json({
      ok: true,
      request_id: requestId,
      provider: "GDELT",
      received: collected.length,
      unique: rows.length,
      inserted: saved?.length || 0,
      source_errors: sourceErrors,
    }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("sync-news error", { requestId, message });
    return Response.json({ ok: false, request_id: requestId, error: message }, { status: 500, headers });
  }
});
