import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import { runSignalAnalysis, callOpenAi, SignalError } from "../_shared/signal-service.mjs";

const env = (name: string) => String(Deno.env.get(name) || "").trim();
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ ok: false, error: "POST erforderlich." }, 405);
  try {
    const authorization = request.headers.get("Authorization") || "";
    if (!/^Bearer\s+\S+$/i.test(authorization)) return respond({ ok: false, error: "Dashboard-Anmeldung erforderlich." }, 401);
    const url = env("SUPABASE_URL"), key = env("SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY");
    const auth = createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: authData, error: authError } = await auth.auth.getUser();
    if (authError || !authData?.user) return respond({ ok: false, error: "Sitzung ungültig. Erneut anmelden." }, 401);
    const userId = authData.user.id, admin = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
    const text = await request.text();
    if (text.length > 600000) return respond({ ok: false, error: "Anfrage zu groß; maximal 2000 CSV-Zeilen." }, 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(text); } catch { return respond({ ok: false, error: "Ungültiges JSON." }, 400); }
    const result = await runSignalAnalysis(body, {
      reserveRun: async () => {
        const { data, error } = await admin.rpc("reserve_signal_analysis_run", { p_user_id: userId });
        if (error) throw new SignalError("V31-Schema fehlt. setup-v31-signal-simulation.sql ausführen.", 503);
        return data === true;
      },
      readCache: async (symbol: string) => {
        const own = await admin.from("signal_market_cache").select("bars,provider,fetched_at").eq("symbol", symbol).maybeSingle();
        if (own.data) return own.data;
        // Existing cache is read-only and may only contain closes; validation handles this.
        const legacy = await admin.from("hybrid_market_cache").select("price_bars,provider,fetched_at").eq("symbol", symbol).maybeSingle();
        return legacy.data ? { bars: legacy.data.price_bars, provider: legacy.data.provider, fetched_at: legacy.data.fetched_at } : null;
      },
      fetchBars: async (symbol: string) => {
        const token = env("EODHD_API_TOKEN");
        if (!token) throw new Error("EODHD_API_TOKEN fehlt.");
        const limit = Math.max(1, Math.min(20, Number(env("HYBRID_EODHD_DAILY_BUDGET")) || 6));
        const budget = await admin.rpc("reserve_hybrid_eodhd_calls", { p_calls: 1, p_daily_limit: limit });
        if (budget.error || budget.data !== true) throw new Error("Gemeinsames EODHD-Tagesbudget erschöpft oder V29.4-Budgetfunktion fehlt.");
        const from = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
        const endpoint = new URL(`https://eodhd.com/api/eod/${encodeURIComponent(symbol)}`);
        endpoint.search = new URLSearchParams({ api_token: token, fmt: "json", period: "d", order: "a", from }).toString();
        const res = await fetch(endpoint, { signal: AbortSignal.timeout(20000) });
        if (!res.ok) throw new Error(`EODHD meldet HTTP ${res.status}. Symbol, Tarif oder Kontingent prüfen.`);
        return await res.json();
      },
      writeCache: async (symbol: string, bars: unknown[], provider: string) => {
        const { error } = await admin.from("signal_market_cache").upsert({ symbol, bars, provider, fetched_at: new Date().toISOString() });
        if (error) throw new Error("V31-Kurscache nicht verfügbar.");
      },
      readNews: async (input: { symbol: string }) => {
        const since = new Date(Date.now() - 14 * 86400000).toISOString();
        const [direct, general] = await Promise.all([
          admin.from("market_news").select("*").eq("is_published", true).gte("published_at", since).contains("symbols", [input.symbol]).order("published_at", { ascending: false }).limit(60),
          admin.from("market_news").select("*").eq("is_published", true).gte("published_at", since).order("published_at", { ascending: false }).limit(1000)
        ]);
        if (general.error && direct.error) throw new Error("News nicht verfügbar.");
        return [...(direct.data || []), ...(general.data || [])];
      },
      analyzeNews: async (input: unknown, chart: unknown, sources: unknown[]) => {
        const apiKey = env("OPENAI_API_KEY"), model = env("OPENAI_MODEL");
        if (!apiKey || !model) throw new Error("OPENAI_API_KEY oder OPENAI_MODEL fehlt. KI-Auswertung ist nicht aktiv.");
        return await callOpenAi({ apiKey, model, input, chart, sources });
      },
      saveResult: async (input: { symbol: string; currency: string; days: number }, analysis: unknown) => {
        const { data, error } = await admin.from("signal_simulations").insert({ user_id: userId, symbol: input.symbol, currency: input.currency, horizon_days: input.days, raw_result: analysis }).select("id").single();
        if (error) throw error;
        return data.id;
      }
    });
    return respond(result);
  } catch (error) {
    const status = error instanceof SignalError ? error.status : 500;
    const message = error instanceof SignalError ? error.message : "Analyse nicht abgeschlossen. Verbindung und V31-Konfiguration prüfen.";
    // Do not log provider URLs, API credentials or user news payloads.
    return respond({ ok: false, error: message }, status);
  }
});
