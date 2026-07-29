import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import {
  berlinClock,
  buildDigestText,
  digestPeriodKey,
  type DigestPeriod,
  isDigestDue,
} from "../_shared/digest-logic.ts";

const BUILD_VERSION = "29.4-multisource-hybrid-digest";

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
    return { ok: true, userId: null, mode: "cron" as const };
  }

  const authorization = req.headers.get("authorization") || "";
  if (!authorization) {
    return { ok: false, userId: null, mode: "none" as const };
  }
  const client = createClient(url, publishableKey(), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  return {
    ok: !error && Boolean(data.user),
    userId: data.user?.id || null,
    mode: "user" as const,
  };
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

function periodFrom(value: unknown): DigestPeriod | null {
  return value === "daily" || value === "weekly" ? value : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, version: BUILD_VERSION, error: "Nur POST erlaubt." },
        { status: 405, headers: jsonHeaders },
      );
    }

    const url = required("SUPABASE_URL");
    const auth = await authorize(req, url);
    if (!auth.ok) {
      return Response.json(
        {
          ok: false,
          version: BUILD_VERSION,
          request_id: requestId,
          error: "Nicht autorisiert.",
        },
        { status: 401, headers: jsonHeaders },
      );
    }

    const body = await req.json().catch(() => ({}));
    const requestedPeriod = periodFrom(body?.period);
    const manual = auth.mode === "user" && body?.manual === true &&
      Boolean(requestedPeriod);
    if (auth.mode === "user" && !manual) {
      return Response.json(
        {
          ok: false,
          version: BUILD_VERSION,
          request_id: requestId,
          error: "Manueller Aufruf benötigt period und manual=true.",
        },
        { status: 400, headers: jsonHeaders },
      );
    }

    const admin = createClient(url, serverKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let settingsQuery = admin
      .from("notification_settings")
      .select("user_id,telegram_chat_id,telegram_enabled")
      .eq("telegram_enabled", true)
      .not("telegram_chat_id", "is", null);
    if (auth.userId) settingsQuery = settingsQuery.eq("user_id", auth.userId);

    const [
      { data: settings, error: settingsError },
      { data: policies, error: policiesError },
    ] = await Promise.all([
      settingsQuery,
      admin.from("notification_policies").select("*"),
    ]);
    if (settingsError) throw settingsError;
    if (policiesError) throw policiesError;

    const policyMap = new Map(
      (policies || []).map((policy: any) => [String(policy.user_id), policy]),
    );
    const clock = berlinClock();
    const candidates: Array<{
      userId: string;
      chatId: string;
      period: DigestPeriod;
      key: string;
      manual: boolean;
    }> = [];

    for (const setting of settings || []) {
      const userId = String(setting.user_id);
      const policy = policyMap.get(userId) || {};
      const periods: DigestPeriod[] = manual && requestedPeriod
        ? [requestedPeriod]
        : ["daily", "weekly"];
      for (const period of periods) {
        if (!manual && !isDigestDue(period, policy, clock)) continue;
        candidates.push({
          userId,
          chatId: String(setting.telegram_chat_id),
          period,
          key: manual
            ? `${digestPeriodKey(period, clock)}:manual:${requestId}`
            : digestPeriodKey(period, clock),
          manual,
        });
      }
    }

    if (!candidates.length) {
      return Response.json(
        {
          ok: true,
          version: BUILD_VERSION,
          request_id: requestId,
          sent: 0,
          skipped: 0,
          message: manual
            ? "Telegram ist nicht verbunden oder deaktiviert."
            : "Kein Bericht ist in diesem Zeitfenster fällig.",
        },
        { headers: jsonHeaders },
      );
    }

    const botToken = required("TELEGRAM_BOT_TOKEN");
    const results: Array<Record<string, unknown>> = [];
    let skipped = 0;
    for (const candidate of candidates) {
      if (!candidate.manual) {
        const { data: reservation, error: reservationError } = await admin
          .from("digest_delivery_log")
          .insert({
            user_id: candidate.userId,
            period: candidate.period,
            period_key: candidate.key,
            delivery_channel: "telegram",
            status: "pending",
          })
          .select("id")
          .maybeSingle();
        if (reservationError) {
          if (reservationError.code === "23505") {
            skipped += 1;
            continue;
          }
          throw reservationError;
        }
        if (!reservation) {
          skipped += 1;
          continue;
        }
      }

      const since = new Date(
        Date.now() -
          (candidate.period === "weekly" ? 7 : 1) * 24 * 3_600_000,
      ).toISOString();
      const [
        { data: news, error: newsError },
        { data: positions, error: positionsError },
        { data: alerts, error: alertsError },
      ] = await Promise.all([
        admin
          .from("market_news")
          .select(
            "title,source_name,primary_symbol,symbols,relevance_score,urgency_score,priced_in_state,recommended_action,published_at",
          )
          .eq("is_published", true)
          .gte("published_at", since)
          .order("relevance_score", { ascending: false })
          .limit(candidate.period === "weekly" ? 80 : 40),
        admin
          .from("depot_positions")
          .select("*")
          .eq("user_id", candidate.userId)
          .eq("is_open", true),
        admin
          .from("alert_events")
          .select("*")
          .eq("user_id", candidate.userId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      if (newsError) throw newsError;
      if (positionsError) throw positionsError;
      if (alertsError) throw alertsError;

      const text = buildDigestText({
        period: candidate.period,
        news: news || [],
        positions: positions || [],
        alerts: alerts || [],
      });
      let delivered = false;
      try {
        await telegram(botToken, candidate.chatId, text);
        delivered = true;
        if (!candidate.manual) {
          const { error: logError } = await admin
            .from("digest_delivery_log")
            .update({ status: "sent", delivered_at: new Date().toISOString() })
            .eq("user_id", candidate.userId)
            .eq("period", candidate.period)
            .eq("period_key", candidate.key);
          if (logError) {
            console.error("send-digest-log-v29-4", {
              requestId,
              userId: candidate.userId,
              period: candidate.period,
              message: logError.message,
            });
          }
        }
        results.push({
          user_id: candidate.userId,
          period: candidate.period,
          manual: candidate.manual,
        });
      } catch (error) {
        if (!candidate.manual && !delivered) {
          await admin
            .from("digest_delivery_log")
            .delete()
            .eq("user_id", candidate.userId)
            .eq("period", candidate.period)
            .eq("period_key", candidate.key);
        }
        throw error;
      }
    }

    return Response.json(
      {
        ok: true,
        version: BUILD_VERSION,
        request_id: requestId,
        sent: results.length,
        skipped,
        results,
        message: results.length
          ? `${results.length} Bericht(e) versendet.`
          : "Kein neuer Bericht zu versenden.",
      },
      { headers: jsonHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("send-digest-v29-4", { requestId, message });
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
