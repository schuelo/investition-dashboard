import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";

const BUILD_VERSION = "29.3-multisource-hybrid-portfolio-market-intelligence-alerts";

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

async function authorize(req: Request, url: string) {
  const cronSecret = env("CRON_SECRET");
  const requestSecret = req.headers.get("x-cron-secret")?.trim();
  if (cronSecret && requestSecret && requestSecret === cronSecret) {
    return { ok: true, userId: null };
  }

  const authorization = req.headers.get("authorization") || "";
  if (!authorization) return { ok: false, userId: null };
  const client = createClient(url, publishableKey(), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  return { ok: !error && Boolean(data.user), userId: data.user?.id || null };
}

function tokens(value: unknown) {
  const normalized = String(value || "").toUpperCase().replace(/\s+/g, "");
  if (!normalized) return [];
  const result = new Set([normalized]);
  if (normalized.includes(":")) result.add(normalized.split(":").pop()!);
  if (normalized.includes(".")) result.add(normalized.split(".")[0]);
  return [...result];
}

function matches(news: any, position: any, plan: any) {
  const wanted = new Set([
    ...tokens(position.symbol),
    ...tokens(plan?.symbol),
    ...tokens(plan?.market_symbol),
  ]);
  if (
    (news.symbols || []).some((symbol: string) =>
      tokens(symbol).some((token) => wanted.has(token))
    )
  ) {
    return true;
  }
  const haystack = `${news.title || ""} ${news.summary || ""}`.toLowerCase();
  return String(position.name || plan?.name || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((token: string) => token.length >= 5)
    .some((token: string) => haystack.includes(token));
}

async function telegram(token: string, chatId: string, text: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    },
  );
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Telegram ${response.status}: ${raw.slice(0, 180)}`);
  }
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

    const admin = createClient(url, serverKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // RSS-Aggregatoren können Meldungen verzögert ausliefern. Das längere
    // Fenster verhindert verpasste Alarme; news_notification_log verhindert
    // doppelte Telegram-Nachrichten.
    const since = new Date(Date.now() - 8 * 3_600_000).toISOString();
    let settingsQuery = admin
      .from("notification_settings")
      .select("user_id,telegram_chat_id,telegram_enabled")
      .eq("telegram_enabled", true)
      .not("telegram_chat_id", "is", null);
    if (auth.userId) {
      settingsQuery = settingsQuery.eq("user_id", auth.userId);
    }

    const [
      { data: settings, error: settingsError },
      { data: news, error: newsError },
    ] = await Promise.all([
      settingsQuery,
      admin
        .from("market_news")
        .select("*")
        .eq("is_published", true)
        .gte("published_at", since)
        .in("impact", ["hoch", "mittel"])
        .order("published_at", { ascending: false })
        .limit(200),
    ]);
    if (settingsError) throw settingsError;
    if (newsError) throw newsError;

    const botToken = required("TELEGRAM_BOT_TOKEN");
    const results: any[] = [];
    for (const setting of settings || []) {
      const [
        { data: positions, error: positionsError },
        { data: plans, error: plansError },
      ] = await Promise.all([
        admin
          .from("depot_positions")
          .select("*")
          .eq("user_id", setting.user_id)
          .eq("is_open", true),
        admin
          .from("trade_plans")
          .select("id,name,symbol,market_symbol")
          .eq("user_id", setting.user_id),
      ]);
      if (positionsError) throw positionsError;
      if (plansError) throw plansError;

      const planMap = new Map<string, any>(
        (plans || []).map((plan: any) => [String(plan.id), plan]),
      );
      for (const article of news || []) {
        const affected = (positions || []).filter((position: any) =>
          matches(article, position, planMap.get(String(position.trade_id)))
        );
        if (!affected.length) continue;
        const relevanceScore = Number.isFinite(Number(article.relevance_score))
          ? Number(article.relevance_score)
          : article.impact === "hoch"
          ? 85
          : 65;
        const urgencyScore = Number.isFinite(Number(article.urgency_score))
          ? Number(article.urgency_score)
          : article.impact === "hoch"
          ? 80
          : 55;
        if (relevanceScore < 70 && urgencyScore < 65) continue;

        const { data: existing, error: existingError } = await admin
          .from("news_notification_log")
          .select("id")
          .eq("user_id", setting.user_id)
          .eq("news_id", article.id)
          .maybeSingle();
        if (existingError) throw existingError;
        if (existing) continue;

        const names = affected
          .map((position: any) =>
            position.name ||
            planMap.get(String(position.trade_id))?.name ||
            "Position"
          )
          .join(", ");
        const stars = relevanceScore >= 90
          ? "★★★★★"
          : relevanceScore >= 78
          ? "★★★★☆"
          : "★★★☆☆";
        const text =
          `📰 PORTFOLIO-NEWS ${stars}\n${names}\n\n${article.title}\n\n` +
          `Relevanz: ${Math.round(relevanceScore)}/100 · Vertrauen: ${
            Math.round(Number(article.confidence_score) || 50)
          }/100 · Dringlichkeit: ${Math.round(urgencyScore)}/100\n` +
          `Auswirkung: ${article.market_impact || article.impact}\n` +
          `Einpreisung: ${article.priced_in || "unklar"}\n` +
          `Analystenbild: ${article.analyst_view || "nicht verfügbar"}\n` +
          `Handlung: ${
            article.recommended_action ||
            "These, Kursreaktion und Risikobudget prüfen."
          }\n` +
          `Datenqualität: ${article.data_quality || "nicht bewertet"}\n` +
          `Quelle: ${article.source_name || "RSS-News"}${
            article.tags?.includes("RSS")
              ? " · Originalmeldung vor einer Handlung prüfen"
              : ""
          }\n\n` +
          `${article.source_url || ""}`;

        await telegram(
          botToken,
          String(setting.telegram_chat_id),
          text.slice(0, 3900),
        );
        const { error: logError } = await admin
          .from("news_notification_log")
          .insert({
            user_id: setting.user_id,
            news_id: article.id,
            delivery_channel: "telegram",
          });
        if (logError) throw logError;
        results.push({
          user_id: setting.user_id,
          news_id: article.id,
          positions: names,
        });
      }
    }

    return Response.json(
      {
        ok: true,
        version: BUILD_VERSION,
        request_id: requestId,
        alerts_sent: results.length,
        results,
      },
      { headers: jsonHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("send-news-alerts-v29-2", { requestId, message });
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
