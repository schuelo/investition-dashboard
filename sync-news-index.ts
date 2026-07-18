import { createClient } from "npm:@supabase/supabase-js@2.49.8";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cron-secret" };

function serverKey(): string {
  const direct = Deno.env.get("SUPABASE_SECRET_KEY")?.trim() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (direct) return direct;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) throw new Error("Kein Supabase-Server-Key verfügbar.");
  const keys = JSON.parse(raw);
  const key = keys.default || Object.values(keys).find(v => typeof v === "string" && v.length > 0);
  if (!key || typeof key !== "string") throw new Error("Kein verwendbarer Supabase-Server-Key gefunden.");
  return key;
}
function publishableKey(): string {
  const direct = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() || Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  if (direct) return direct;
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!raw) throw new Error("Kein Supabase-Publishable-Key verfügbar.");
  const keys = JSON.parse(raw);
  const key = keys.default || Object.values(keys).find(v => typeof v === "string" && v.length > 0);
  if (!key || typeof key !== "string") throw new Error("Kein verwendbarer Publishable Key gefunden.");
  return key;
}
async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,"0")).join("");
}
function topicFrom(tags: string[], requested: string): string {
  const text = `${requested} ${tags.join(" ")}`.toLowerCase();
  if (/artificial|\bai\b|machine learning|tech/.test(text)) return "KI";
  if (/semiconductor|chip|memory|foundry/.test(text)) return "Halbleiter";
  if (/energy|oil|gas|solar|wind|uranium|electricity/.test(text)) return "Energie";
  if (/forex|eurusd|currency|euro|dollar/.test(text)) return "EUR/USD";
  if (/macro|inflation|interest rate|central bank|gdp|employment/.test(text)) return "Makro";
  return "Unternehmen";
}
function impactFrom(sentiment: any, symbols: string[]): "hoch"|"mittel"|"niedrig" {
  const polarity = Number(sentiment?.polarity ?? 0);
  if (Math.abs(polarity) >= 0.7 || symbols.length >= 4) return "hoch";
  if (Math.abs(polarity) >= 0.3 || symbols.length >= 1) return "mittel";
  return "niedrig";
}
async function authorized(req: Request, url: string): Promise<boolean> {
  const expected = Deno.env.get("CRON_SECRET")?.trim();
  if (expected && req.headers.get("x-cron-secret")?.trim() === expected) return true;
  const auth = req.headers.get("Authorization") || "";
  if (!auth) return false;
  const client = createClient(url, publishableKey(), { global:{headers:{Authorization:auth}}, auth:{persistSession:false,autoRefreshToken:false} });
  const {data, error} = await client.auth.getUser();
  return !error && Boolean(data.user);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:jsonHeaders});
  const requestId = crypto.randomUUID();
  try {
    const url = Deno.env.get("SUPABASE_URL")?.trim();
    if (!url) throw new Error("SUPABASE_URL fehlt.");
    if (!(await authorized(req, url))) return Response.json({ok:false,error:"Unauthorized",request_id:requestId},{status:401,headers:jsonHeaders});
    const token = Deno.env.get("EODHD_API_TOKEN")?.trim();
    if (!token) throw new Error("EODHD_API_TOKEN fehlt.");
    const admin = createClient(url, serverKey(), {auth:{persistSession:false,autoRefreshToken:false}});
    const body = await req.json().catch(() => ({}));
    const force = Boolean(body.force);
    if (!force) {
      const {data:last} = await admin.from("market_news").select("updated_at").order("updated_at",{ascending:false}).limit(1).maybeSingle();
      if (last?.updated_at && Date.now() - new Date(last.updated_at).getTime() < 4*60*60*1000) {
        return Response.json({ok:true,skipped:true,message:"Letzte Synchronisierung liegt weniger als vier Stunden zurück.",request_id:requestId},{headers:jsonHeaders});
      }
    }
    const from = new Date(Date.now()-7*24*60*60*1000).toISOString().slice(0,10);
    const topics = ["artificial intelligence","energy","semiconductors","macroeconomics"];
    const received:any[] = [];
    const sourceErrors:string[] = [];
    for (const topic of topics) {
      try {
        const endpoint = `https://eodhd.com/api/news?t=${encodeURIComponent(topic)}&from=${from}&limit=25&api_token=${encodeURIComponent(token)}&fmt=json`;
        const response = await fetch(endpoint,{headers:{Accept:"application/json"}});
        const raw = await response.text();
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${raw.slice(0,180)}`);
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) throw new Error("Antwort ist kein News-Array.");
        data.forEach(article => received.push({...article,__requestedTopic:topic}));
      } catch (sourceError) {
        const message = sourceError instanceof Error ? sourceError.message : String(sourceError);
        sourceErrors.push(`${topic}: ${message}`);
        console.warn("EODHD topic failed", {topic,message});
      }
    }
    if (!received.length) throw new Error(`Keine EODHD-News geladen. ${sourceErrors.join(" | ")}`);
    const dedup = new Map<string,any>();
    for (const article of received) {
      const external = await sha256(String(article.link || `${article.date}|${article.title}`));
      if (!dedup.has(external)) dedup.set(external,{...article,external});
    }
    const rows = [...dedup.values()].map(article => {
      const symbols = Array.isArray(article.symbols) ? article.symbols.map(String) : [];
      const tags = Array.isArray(article.tags) ? article.tags.map(String) : [];
      const polarity = Number(article.sentiment?.polarity);
      const topic = topicFrom(tags, article.__requestedTopic);
      return {
        external_id: article.external,
        published_at: article.date || new Date().toISOString(),
        topic,
        title: String(article.title || "Ohne Titel"),
        summary: String(article.content || "").replace(/\s+/g," ").slice(0,420),
        content: String(article.content || ""),
        source_url: article.link || null,
        source_name: "EODHD News",
        symbols, tags,
        sentiment: Number.isFinite(polarity) ? polarity : null,
        impact: impactFrom(article.sentiment, symbols),
        market_impact: "Rohmeldung aus dem Newsfeed; detaillierte Einpreisungs- und Analystenbewertung kann später ergänzt werden.",
        priced_in: "Noch nicht bewertet",
        analyst_view: "Noch nicht bewertet",
        is_published: true
      };
    });
    let inserted = 0;
    if (rows.length) {
      const {data,error} = await admin.from("market_news").upsert(rows,{onConflict:"external_id"}).select("id");
      if (error) throw new Error(`market_news konnte nicht gespeichert werden: ${error.message}`);
      inserted = data?.length || 0;
    }
    return Response.json({ok:true,request_id:requestId,received:received.length,unique:rows.length,inserted,source_errors:sourceErrors},{headers:jsonHeaders});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("sync-news error",{requestId,message});
    return Response.json({ok:false,request_id:requestId,error:message},{status:500,headers:jsonHeaders});
  }
});
