import { createClient } from "npm:@supabase/supabase-js@2.49.8";

type Plan = Record<string, any>;
type Quote = {
  symbol: string;
  price: number;
  quoteAt: string;
  source: string;
};
type Candidate = {
  type: "entry" | "limit" | "stop" | "target1" | "target2" | "target3" | "ko";
  level: number | null;
  initial: boolean;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json; charset=utf-8",
};

const labels: Record<Candidate["type"], string> = {
  entry: "ENTRY-ZONE",
  limit: "ORDERLIMIT",
  stop: "STOP / INVALIDATION",
  target1: "ZIEL 1",
  target2: "ZIEL 2",
  target3: "ZIEL 3",
  ko: "KO-WARNUNG",
};

const inactiveStatuses = new Set([
  "geschlossen",
  "verworfen",
  "archiviert",
  "gelöscht",
]);

const activePositionStatuses = new Set([
  "position offen",
  "teilverkauf",
]);

function env(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  return value || null;
}

function requiredEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`${name} ist nicht gesetzt.`);
  return value;
}

function serverKey(): string {
  const direct = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;

  const raw = env("SUPABASE_SECRET_KEYS");
  if (!raw) {
    throw new Error(
      "Kein Supabase-Server-Key verfügbar. SUPABASE_SECRET_KEYS und " +
        "SUPABASE_SERVICE_ROLE_KEY fehlen.",
    );
  }

  let keys: Record<string, string>;
  try {
    keys = JSON.parse(raw);
  } catch {
    throw new Error("SUPABASE_SECRET_KEYS enthält kein gültiges JSON.");
  }

  const selected = keys.default || Object.values(keys).find((value) =>
    typeof value === "string" && value.trim().length > 0
  );

  if (!selected) throw new Error("Kein verwendbarer Supabase Secret Key gefunden.");
  return selected.trim();
}

function publishableKey(): string {
  const direct = env("SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY");
  if (direct) return direct;

  const raw = env("SUPABASE_PUBLISHABLE_KEYS");
  if (!raw) throw new Error("Kein Supabase Publishable Key verfügbar.");

  let keys: Record<string, string>;
  try {
    keys = JSON.parse(raw);
  } catch {
    throw new Error("SUPABASE_PUBLISHABLE_KEYS enthält kein gültiges JSON.");
  }

  const selected = keys.default || Object.values(keys).find((value) =>
    typeof value === "string" && value.trim().length > 0
  );

  if (!selected) throw new Error("Kein verwendbarer Supabase Publishable Key gefunden.");
  return selected.trim();
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function crossedAbove(previous: number, current: number, level: number): boolean {
  return previous < level && current >= level;
}

function crossedBelow(previous: number, current: number, level: number): boolean {
  return previous > level && current <= level;
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("de-DE", { maximumFractionDigits: 4 });
}

function planSignature(plan: Plan): string {
  return JSON.stringify({
    market_symbol: plan.market_symbol ?? null,
    direction: plan.direction ?? null,
    status: plan.status ?? null,
    monitoring_enabled: Boolean(plan.monitoring_enabled),
    entry_low: asNumber(plan.entry_low),
    entry_high: asNumber(plan.entry_high),
    limit_price: asNumber(plan.limit_price),
    stop_price: asNumber(plan.stop_price),
    target1: asNumber(plan.target1),
    target2: asNumber(plan.target2),
    target3: asNumber(plan.target3),
    ko_barrier: asNumber(plan.ko_barrier),
    alert_entry: Boolean(plan.alert_entry),
    alert_limit: Boolean(plan.alert_limit),
    alert_stop: Boolean(plan.alert_stop),
    alert_target1: Boolean(plan.alert_target1),
    alert_target2: Boolean(plan.alert_target2),
    alert_target3: Boolean(plan.alert_target3),
    alert_ko: Boolean(plan.alert_ko),
    alert_ko_distance_pct: asNumber(plan.alert_ko_distance_pct),
  });
}

function normalizeQuoteTimestamp(value: unknown): string {
  const seconds = asNumber(value);
  if (seconds !== null && seconds > 0) return new Date(seconds * 1000).toISOString();
  return new Date().toISOString();
}

async function fetchEodhdQuotes(
  symbols: string[],
  testPrices: Record<string, unknown>,
): Promise<Map<string, Quote>> {
  const output = new Map<string, Quote>();
  const missing: string[] = [];

  for (const symbol of symbols) {
    const testPrice = asNumber(testPrices[symbol]);
    if (testPrice !== null && testPrice > 0) {
      output.set(symbol, {
        symbol,
        price: testPrice,
        quoteAt: new Date().toISOString(),
        source: "Testkurs",
      });
    } else {
      missing.push(symbol);
    }
  }

  if (!missing.length) return output;

  const token = requiredEnv("EODHD_API_TOKEN");

  // EODHD empfiehlt 15–20 Symbole pro Request. Das reduziert HTTP-Requests,
  // EODHD zählt laut Dokumentation dennoch einen API Call je Ticker.
  for (let start = 0; start < missing.length; start += 20) {
    const chunk = missing.slice(start, start + 20);
    const [first, ...rest] = chunk;
    const query = new URLSearchParams({ api_token: token, fmt: "json" });
    if (rest.length) query.set("s", rest.join(","));

    const response = await fetch(
      `https://eodhd.com/api/real-time/${encodeURIComponent(first)}?${query.toString()}`,
      { headers: { Accept: "application/json" } },
    );

    const raw = await response.text();
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        `EODHD lieferte keine JSON-Antwort (HTTP ${response.status}): ${raw.slice(0, 180)}`,
      );
    }

    if (!response.ok || parsed?.error || parsed?.message) {
      const message = parsed?.error || parsed?.message || raw.slice(0, 180);
      throw new Error(
        `EODHD-Zugriff fehlgeschlagen (HTTP ${response.status}): ${message}. ` +
          "Prüfe Tarif, API-Limit und EODHD_API_TOKEN.",
      );
    }

    const rows = Array.isArray(parsed) ? parsed : [parsed];
    for (const row of rows) {
      const code = String(row?.code || "").trim().toUpperCase();
      const price = asNumber(row?.close);
      if (!code || price === null || price <= 0) continue;
      output.set(code, {
        symbol: code,
        price,
        quoteAt: normalizeQuoteTimestamp(row?.timestamp),
        source: "EODHD Live (verzögert)",
      });
    }
  }

  return output;
}

function messageFor(plan: Plan, event: Candidate, quote: Quote): string {
  const currency = String(plan.currency || "").trim();
  const suffix = currency ? ` ${currency}` : "";
  const lines = [
    `🔔 ${plan.name || plan.market_symbol} – ${labels[event.type]}`,
    `Kurs: ${formatNumber(quote.price)}${suffix}`,
  ];

  if (event.level !== null) lines.push(`Marke: ${formatNumber(event.level)}${suffix}`);

  const entryLow = asNumber(plan.entry_low);
  const entryHigh = asNumber(plan.entry_high);
  if (entryLow !== null || entryHigh !== null) {
    lines.push(`Entry: ${formatNumber(entryLow)}–${formatNumber(entryHigh)}${suffix}`);
  }

  const stop = asNumber(plan.stop_price);
  const target1 = asNumber(plan.target1);
  if (stop !== null) lines.push(`Stop: ${formatNumber(stop)}${suffix}`);
  if (target1 !== null) lines.push(`Ziel 1: ${formatNumber(target1)}${suffix}`);

  lines.push(`Kurszeit: ${new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(quote.quoteAt))}`);

  if (event.initial) lines.push("Hinweis: Marke war bei der ersten Serverprüfung bereits erreicht.");
  return lines.join("\n");
}

async function sendTelegram(
  token: string,
  chatId: string | number,
  text: string,
): Promise<{ delivered: boolean; error: string | null }> {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  const raw = await response.text();
  let result: any = null;
  try {
    result = JSON.parse(raw);
  } catch {
    // Fehlertext wird unten verwendet.
  }

  if (response.ok && result?.ok) return { delivered: true, error: null };
  return {
    delivered: false,
    error: result?.description || `Telegram HTTP ${response.status}: ${raw.slice(0, 180)}`,
  };
}

function addCandidate(
  events: Candidate[],
  fired: Record<string, unknown>,
  type: Candidate["type"],
  level: number | null,
  initial: boolean,
): void {
  if (!fired[type]) events.push({ type, level, initial });
}

Deno.serve(async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID();

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return Response.json(
      { ok: false, request_id: requestId, error: "Nur POST ist erlaubt." },
      { status: 405, headers: jsonHeaders },
    );
  }

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const admin = createClient(supabaseUrl, serverKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const expectedCronSecret = env("CRON_SECRET");
    const suppliedCronSecret = req.headers.get("x-cron-secret")?.trim() || "";
    const cronAuthorized = Boolean(
      expectedCronSecret && suppliedCronSecret && suppliedCronSecret === expectedCronSecret,
    );

    let userId: string | null = null;
    if (!cronAuthorized) {
      const authorization = req.headers.get("authorization") || "";
      if (!authorization) {
        return Response.json(
          { ok: false, request_id: requestId, error: "Nicht autorisiert." },
          { status: 401, headers: jsonHeaders },
        );
      }

      const userClient = createClient(supabaseUrl, publishableKey(), {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: authData, error: authError } = await userClient.auth.getUser();
      if (authError || !authData.user) {
        return Response.json(
          { ok: false, request_id: requestId, error: "Ungültige Supabase-Sitzung." },
          { status: 401, headers: jsonHeaders },
        );
      }
      userId = authData.user.id;
    }

    const body = await req.json().catch(() => ({}));
    const testPrices = cronAuthorized && body?.test_prices && typeof body.test_prices === "object"
      ? body.test_prices as Record<string, unknown>
      : {};

    let planQuery = admin
      .from("trade_plans")
      .select("*")
      .eq("monitoring_enabled", true)
      .not("market_symbol", "is", null);

    if (userId) planQuery = planQuery.eq("user_id", userId);

    const { data: planRows, error: planError } = await planQuery;
    if (planError) throw new Error(`trade_plans: ${planError.message}`);

    const plans = (planRows || []).filter((plan: Plan) => {
      const status = String(plan.status || "").trim().toLowerCase();
      const hasAlarm = [
        plan.alert_entry,
        plan.alert_limit,
        plan.alert_stop,
        plan.alert_target1,
        plan.alert_target2,
        plan.alert_target3,
        plan.alert_ko,
      ].some(Boolean);
      return !inactiveStatuses.has(status) && hasAlarm;
    });

    if (!plans.length) {
      return Response.json(
        {
          ok: true,
          request_id: requestId,
          checked: 0,
          successful: 0,
          failed: 0,
          events_sent: 0,
          message: "Keine aktiven Alarmpläne gefunden.",
          results: [],
        },
        { status: 200, headers: jsonHeaders },
      );
    }

    const symbols = [...new Set(plans.map((p: Plan) => String(p.market_symbol).trim().toUpperCase()))];
    const quotes = await fetchEodhdQuotes(symbols, testPrices);

    const tradeIds = plans.map((p: Plan) => p.id);
    const { data: stateRows, error: stateError } = await admin
      .from("alert_state")
      .select("*")
      .in("trade_id", tradeIds);
    if (stateError) throw new Error(`alert_state: ${stateError.message}`);
    const states = new Map((stateRows || []).map((row: any) => [row.trade_id, row]));

    const userIds = [...new Set(plans.map((p: Plan) => p.user_id))];
    const { data: settingRows, error: settingError } = await admin
      .from("notification_settings")
      .select("user_id,telegram_chat_id,telegram_enabled")
      .in("user_id", userIds)
      .eq("telegram_enabled", true)
      .not("telegram_chat_id", "is", null);
    if (settingError) throw new Error(`notification_settings: ${settingError.message}`);
    const chats = new Map((settingRows || []).map((row: any) => [row.user_id, row.telegram_chat_id]));

    const telegramToken = env("TELEGRAM_BOT_TOKEN");
    const results: Array<Record<string, unknown>> = [];
    let eventsSent = 0;

    for (const plan of plans) {
      const symbol = String(plan.market_symbol).trim().toUpperCase();
      const checkedAt = new Date().toISOString();

      try {
        const quote = quotes.get(symbol);
        if (!quote) throw new Error(`${symbol}: kein gültiger EODHD-Kurs zurückgegeben.`);

        const state: any = states.get(plan.id) || null;
        const previous = asNumber(state?.previous_price);
        const storedFired = state?.fired && typeof state.fired === "object"
          ? { ...state.fired as Record<string, unknown> }
          : {};
        const currentSignature = planSignature(plan);
        const previousSignature = typeof storedFired.__plan_signature === "string"
          ? storedFired.__plan_signature
          : null;
        const planChanged = previousSignature !== currentSignature;
        const fired: Record<string, unknown> = planChanged ? {} : storedFired;
        fired.__plan_signature = currentSignature;

        const direction = String(plan.direction || "Long").toLowerCase();
        const isShort = direction.includes("short");
        const status = String(plan.status || "").trim().toLowerCase();
        const positionActive = activePositionStatuses.has(status);
        const price = quote.price;
        const entryLow = asNumber(plan.entry_low);
        const entryHigh = asNumber(plan.entry_high);
        const limit = asNumber(plan.limit_price);
        const stop = asNumber(plan.stop_price);
        const target1 = asNumber(plan.target1);
        const target2 = asNumber(plan.target2);
        const target3 = asNumber(plan.target3);
        const koBarrier = asNumber(plan.ko_barrier);
        const koThreshold = asNumber(plan.alert_ko_distance_pct) ?? 10;

        let entryInside = false;
        if (entryLow !== null || entryHigh !== null) {
          const lower = Math.min(entryLow ?? entryHigh!, entryHigh ?? entryLow!);
          const upper = Math.max(entryLow ?? entryHigh!, entryHigh ?? entryLow!);
          entryInside = price >= lower && price <= upper;
        }

        const baseline = previous === null || planChanged;
        const events: Candidate[] = [];

        if (baseline) {
          if (plan.alert_entry && entryInside) {
            addCandidate(
              events,
              fired,
              "entry",
              entryLow !== null && entryHigh !== null ? (entryLow + entryHigh) / 2 : entryLow ?? entryHigh,
              true,
            );
          }
          if (plan.alert_limit && limit !== null) {
            const reached = isShort ? price >= limit : price <= limit;
            if (reached) addCandidate(events, fired, "limit", limit, true);
          }
          if (positionActive && plan.alert_stop && stop !== null) {
            const reached = isShort ? price >= stop : price <= stop;
            if (reached) addCandidate(events, fired, "stop", stop, true);
          }
          if (positionActive && plan.alert_target1 && target1 !== null) {
            const reached = isShort ? price <= target1 : price >= target1;
            if (reached) addCandidate(events, fired, "target1", target1, true);
          }
          if (positionActive && plan.alert_target2 && target2 !== null) {
            const reached = isShort ? price <= target2 : price >= target2;
            if (reached) addCandidate(events, fired, "target2", target2, true);
          }
          if (positionActive && plan.alert_target3 && target3 !== null) {
            const reached = isShort ? price <= target3 : price >= target3;
            if (reached) addCandidate(events, fired, "target3", target3, true);
          }
          if (plan.alert_ko && koBarrier !== null && price > 0) {
            const distance = Math.abs((price - koBarrier) / price) * 100;
            if (distance <= koThreshold) addCandidate(events, fired, "ko", koBarrier, true);
          }
        } else {
          if (plan.alert_entry && entryInside && state?.entry_inside !== true) {
            addCandidate(
              events,
              fired,
              "entry",
              entryLow !== null && entryHigh !== null ? (entryLow + entryHigh) / 2 : entryLow ?? entryHigh,
              false,
            );
          }

          if (plan.alert_limit && limit !== null) {
            const crossed = isShort
              ? crossedAbove(previous, price, limit)
              : crossedBelow(previous, price, limit);
            if (crossed) addCandidate(events, fired, "limit", limit, false);
          }

          if (positionActive && plan.alert_stop && stop !== null) {
            const crossed = isShort
              ? crossedAbove(previous, price, stop)
              : crossedBelow(previous, price, stop);
            if (crossed) addCandidate(events, fired, "stop", stop, false);
          }

          const targetCross = isShort ? crossedBelow : crossedAbove;
          if (positionActive && plan.alert_target1 && target1 !== null && targetCross(previous, price, target1)) {
            addCandidate(events, fired, "target1", target1, false);
          }
          if (positionActive && plan.alert_target2 && target2 !== null && targetCross(previous, price, target2)) {
            addCandidate(events, fired, "target2", target2, false);
          }
          if (positionActive && plan.alert_target3 && target3 !== null && targetCross(previous, price, target3)) {
            addCandidate(events, fired, "target3", target3, false);
          }

          if (plan.alert_ko && koBarrier !== null && previous > 0 && price > 0) {
            const previousDistance = Math.abs((previous - koBarrier) / previous) * 100;
            const currentDistance = Math.abs((price - koBarrier) / price) * 100;
            if (previousDistance > koThreshold && currentDistance <= koThreshold) {
              addCandidate(events, fired, "ko", koBarrier, false);
            }
          }
        }

        const emitted: Array<Record<string, unknown>> = [];
        for (const event of events) {
          const text = messageFor(plan, event, quote);
          const chatId = chats.get(plan.user_id);
          let delivered = false;
          let deliveryError: string | null = null;

          if (!chatId) {
            deliveryError = "Telegram ist für diesen Benutzer nicht verbunden.";
          } else if (!telegramToken) {
            deliveryError = "TELEGRAM_BOT_TOKEN ist nicht gesetzt.";
          } else {
            const delivery = await sendTelegram(telegramToken, chatId, text);
            delivered = delivery.delivered;
            deliveryError = delivery.error;
          }

          const eventAt = new Date().toISOString();
          fired[event.type] = eventAt;

          const { error: insertError } = await admin.from("alert_events").insert({
            user_id: plan.user_id,
            trade_id: plan.id,
            event_type: event.type,
            price,
            level_value: event.level,
            message: text,
            delivered,
            delivery_error: deliveryError,
            delivered_at: delivered ? eventAt : null,
          });
          if (insertError) throw new Error(`alert_events: ${insertError.message}`);

          if (delivered) eventsSent += 1;
          emitted.push({
            type: event.type,
            initial: event.initial,
            delivered,
            delivery_error: deliveryError,
          });
        }

        const statePayload: Record<string, unknown> = {
          trade_id: plan.id,
          user_id: plan.user_id,
          previous_price: price,
          entry_inside: entryInside,
          fired,
          plan_updated_at: plan.updated_at ?? null,
          checked_at: checkedAt,
          quote_at: quote.quoteAt,
          last_error: null,
          data_source: quote.source,
        };

        let stateWrite = await admin.from("alert_state").upsert(statePayload, { onConflict: "trade_id" });
        if (stateWrite.error && /quote_at|last_error|data_source/i.test(stateWrite.error.message || "")) {
          delete statePayload.quote_at;
          delete statePayload.last_error;
          delete statePayload.data_source;
          stateWrite = await admin.from("alert_state").upsert(statePayload, { onConflict: "trade_id" });
        }
        if (stateWrite.error) throw new Error(`alert_state: ${stateWrite.error.message}`);

        const koDistance = koBarrier !== null && price > 0
          ? Math.abs((price - koBarrier) / price) * 100
          : null;
        const { error: updateError } = await admin.from("trade_plans").update({
          last_price: price,
          last_price_at: quote.quoteAt,
          ko_distance_pct: koDistance,
        }).eq("id", plan.id).eq("user_id", plan.user_id);
        if (updateError) throw new Error(`trade_plans update: ${updateError.message}`);

        results.push({
          id: plan.id,
          name: plan.name,
          symbol,
          price,
          quote_at: quote.quoteAt,
          baseline,
          events: emitted,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("check-alerts plan error", {
          requestId,
          tradeId: plan.id,
          symbol,
          error: message,
        });

        const errorPayload: Record<string, unknown> = {
          trade_id: plan.id,
          user_id: plan.user_id,
          checked_at: checkedAt,
          last_error: message,
          data_source: "EODHD",
        };
        let saveError = await admin.from("alert_state").upsert(errorPayload, { onConflict: "trade_id" });
        if (saveError.error && /last_error|data_source/i.test(saveError.error.message || "")) {
          delete errorPayload.last_error;
          delete errorPayload.data_source;
          saveError = await admin.from("alert_state").upsert(errorPayload, { onConflict: "trade_id" });
        }

        results.push({ id: plan.id, name: plan.name, symbol, error: message });
      }
    }

    const failed = results.filter((result) => result.error).length;
    return Response.json(
      {
        ok: failed === 0,
        request_id: requestId,
        mode: cronAuthorized ? "cron" : "user",
        checked_at: new Date().toISOString(),
        checked: results.length,
        successful: results.length - failed,
        failed,
        events_sent: eventsSent,
        results,
      },
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("check-alerts fatal error", {
      requestId,
      message,
      stack: error instanceof Error ? error.stack : null,
    });

    return Response.json(
      {
        ok: false,
        request_id: requestId,
        error: message,
        error_type: error instanceof Error ? error.name : typeof error,
      },
      { status: 500, headers: jsonHeaders },
    );
  }
});
