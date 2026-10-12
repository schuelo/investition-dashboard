import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import { runDeepAnalysis, runDeepEvaluation, callDeepGemini } from "../_shared/deep-service.mjs";
import { deepBars } from "../_shared/deep-engine.mjs";
import { SignalError } from "../_shared/signal-service.mjs";
import { discoverFreeSources } from "../_shared/deep-sources.mjs";
import { parseRss } from "../_shared/multisource-sources-v294.ts";
import { loadSecFundamentals } from "../_shared/deep-fundamentals.mjs";

const env = (name: string) => String(Deno.env.get(name) || "").trim();
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return reply({ok:false,error:"POST erforderlich."},405);
  try {
    const authorization=request.headers.get("Authorization") || "";
    if (!/^Bearer\s+\S+$/i.test(authorization)) return reply({ok:false,error:"Dashboard-Anmeldung erforderlich."},401);
    const url=env("SUPABASE_URL"),key=env("SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY");
    const auth=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
    const {data:authData,error:authError}=await auth.auth.getUser();
    if(authError || !authData.user) return reply({ok:false,error:"Sitzung ungültig. Erneut anmelden."},401);
    const userId=authData.user.id,admin=createClient(url,env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false}});
    const raw=await request.text();
    if(raw.length>650000) return reply({ok:false,error:"Anfrage zu groß; maximal 2000 CSV-Kerzen."},413);
    let body: Record<string,any>;
    try{body=JSON.parse(raw);}catch{return reply({ok:false,error:"Ungültiges JSON."},400);}
    if(!body || typeof body!=="object" || Array.isArray(body)) return reply({ok:false,error:"JSON-Objekt erforderlich."},400);
    const ownAnalysis=async(id:string)=>{
      const {data,error}=await admin.from("deep_analyses").select("id,raw_result")
        .eq("id",id).eq("user_id",userId).maybeSingle();
      if(error || !data) return null;
      return {...data.raw_result,id:data.id};
    };
    const loadMarket=async(input:any,now:Date)=>{
      const cached=await admin.from("signal_market_cache").select("bars,provider,fetched_at").eq("symbol",input.symbol).maybeSingle();
      let usable:any=null;
      if(cached.data) {
        try {
          const q=deepBars(cached.data.bars,input.lookback,now);
          usable={bars:cached.data.bars,provider:cached.data.provider};
          if(q.ageDays<=4 && now.getTime()-Date.parse(cached.data.fetched_at)<12*3600000) return usable;
        } catch { /* Close-only and malformed caches are not accepted. */ }
      }
      try {
        const token=env("EODHD_API_TOKEN");
        if(!token) throw new Error("EODHD_API_TOKEN fehlt; tägliche OHLCV-CSV importieren.");
        const limit=Math.max(1,Math.min(20,Number(env("HYBRID_EODHD_DAILY_BUDGET")) || 6));
        const quota=await admin.rpc("reserve_hybrid_eodhd_calls",{p_calls:1,p_daily_limit:limit});
        if(quota.error || quota.data!==true) throw new Error("Gemeinsames EODHD-Kontingent erreicht oder V29.4-Budget-RPC fehlt.");
        const from=new Date(now.getTime()-365*86400000).toISOString().slice(0,10);
        const endpoint=new URL("https://eodhd.com/api/eod/"+encodeURIComponent(input.symbol));
        endpoint.search=new URLSearchParams({api_token:token,fmt:"json",period:"d",order:"a",from}).toString();
        const res=await fetch(endpoint,{signal:AbortSignal.timeout(18000)});
        if(!res.ok) throw new Error("Kostenlose Kursdaten nicht verfügbar (HTTP "+res.status+").");
        const bars=await res.json();deepBars(bars,input.lookback,now);
        const saved=await admin.from("signal_market_cache").upsert({symbol:input.symbol,bars,provider:"EODHD EOD",fetched_at:now.toISOString()});
        return {bars,provider:"EODHD EOD",warning:saved.error?"Kurscache nicht gespeichert.":null};
      } catch(e) {
        if(usable) return {...usable,warning:"Vorhandenen Cache genutzt; aktueller Kursabruf nicht verfügbar. Kontingent und Kursalter prüfen."};
        throw new SignalError("Keine gültigen OHLCV-Daten. CSV importieren oder EODHD-Token, Symbol und kostenloses Kontingent prüfen.",422);
      }
    };
    if(body.action==="evaluate") {
      const original=await ownAnalysis(String(body.analysis_id || ""));
      if(!original || body.manual_start!==true) throw new SignalError("Eigene Analyse manuell zur Auswertung auswählen.",404);
      const budget=await admin.rpc("reserve_deep_evaluation",{p_user_id:userId});
      if(budget.error || budget.data!==true) throw new SignalError("Auswertungs-Tageslimit erreicht oder V32-Schema fehlt.",429);
      return reply(await runDeepEvaluation(body,{
        readOriginal:async()=>original,loadMarket,
        saveEvaluation:async(analysisId:string,result:any)=>{
          const saved=await admin.from("deep_evaluations").insert({user_id:userId,analysis_id:analysisId,result});
          if(saved.error) throw new SignalError("Auswertung nicht gespeichert; V32-Schema prüfen.",503);
        }
      }));
    }
    if(body.action && body.action!=="analyze") throw new SignalError("Unbekannte Aktion.",400);
    return reply(await runDeepAnalysis(body,{
      readOrigin:async(input:any)=>{
        let newsId=input.source_news_id;
        if(input.trigger_id) {
          const t=await admin.from("signal_news_triggers").select("news_id").eq("id",input.trigger_id).eq("user_id",userId).maybeSingle();
          if(t.error || !t.data || newsId&&newsId!==t.data.news_id) return null;
          newsId=t.data.news_id;
        }
        const n=await admin.from("market_news").select("*").eq("id",newsId).eq("is_published",true).maybeSingle();
        return n.error || !n.data?null:{news:n.data};
      },
      readPrevious:async(ids:string[],symbol:string)=>{
        if(!ids.length) return [];
        const r=await admin.from("deep_analyses").select("id,raw_result").eq("user_id",userId).eq("symbol",symbol).in("id",ids).order("created_at",{ascending:false});
        if(r.error) throw new SignalError("V32-Historie nicht verfügbar.",503);
        return Promise.all((r.data || []).map(async(row:any)=>{
          const last=await admin.from("deep_evaluations").select("result").eq("analysis_id",row.id).eq("user_id",userId).order("evaluated_at",{ascending:false}).limit(1);
          return {...row.raw_result,id:row.id,latest_evaluation:last.data?.[0]?.result || null};
        }));
      },
      reserveRun:async()=>{
        const r=await admin.rpc("reserve_signal_analysis_run",{p_user_id:userId});
        if(r.error) throw new SignalError("V31-Schema fehlt. Beide V31-SQL-Dateien vor V32 ausführen.",503);
        return r.data===true;
      },
      loadMarket,
      readNews:async(input:any,now:Date)=>{
        const since=new Date(now.getTime()-input.news_days*86400000).toISOString();
        const results=await Promise.all([
          admin.from("market_news").select("*").eq("is_published",true).contains("symbols",[input.symbol]).gte("published_at",since).order("published_at",{ascending:false}).limit(100),
          admin.from("market_news").select("*").eq("is_published",true).gte("published_at",since).order("published_at",{ascending:false}).limit(1000)
        ]);
        if(results.every(r=>r.error)) throw new Error("News nicht verfügbar.");
        return results.flatMap(r=>r.data || []);
      },
      discoverSources:async(input:any,now:Date)=>discoverFreeSources(input,{parseRss,now}),
      loadFundamentals:async(input:any,now:Date)=>loadSecFundamentals(input,{userAgent:env("SEC_USER_AGENT"),now}),
      archiveSources:async(input:any,sources:any[])=>{
        if(!sources.length) return;
        const r=await admin.from("deep_sources").upsert(sources.map(s=>({user_id:userId,symbol:input.symbol,source_key:s.id,canonical_url:s.canonical_url,title:s.title,kind:s.kind,snapshot:s,last_seen_at:s.retrieved_at})),{onConflict:"user_id,symbol,canonical_url"});
        if(r.error) throw r.error;
      },
      analyze:async(input:any,analysis:any,previous:any[])=>callDeepGemini({input,analysis,previous,getEnv:env}),
      save:async(input:any,analysis:any)=>{
        const r=await admin.from("deep_analyses").insert({user_id:userId,symbol:input.symbol,currency:input.currency,horizon_days:input.days,lookback_days:input.lookback,news_days:input.news_days,ai_mode:analysis.narrative.mode,raw_result:analysis}).select("id").single();
        if(r.error) throw r.error;
        return r.data.id;
      }
    }));
  } catch(e) {
    return reply({ok:false,error:e instanceof SignalError?e.message:"Deep-Analyse nicht abgeschlossen. Verbindung und V32-Installation prüfen."},e instanceof SignalError?e.status:500);
  }
});
