import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { corsHeaders,jsonHeaders } from "../_shared/cors.ts";
import { configPaper,newPaper,updatePaper } from "../_shared/paper-engine.mjs";

const env=(key:string)=>String(Deno.env.get(key)||'').trim();
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:jsonHeaders});
Deno.serve(async(request:Request)=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(request.method!=='POST')return reply({ok:false,error:'POST erforderlich.'},405);
  try {
    const authorization=request.headers.get('Authorization')||'';
    if(!/^Bearer\s+\S+$/i.test(authorization))return reply({ok:false,error:'Anmeldung erforderlich.'},401);
    const url=env('SUPABASE_URL'),auth=createClient(url,env('SUPABASE_ANON_KEY')||env('SUPABASE_PUBLISHABLE_KEY'),{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
    const verified=await auth.auth.getUser();
    if(verified.error||!verified.data.user)return reply({ok:false,error:'Sitzung ungültig.'},401);
    const userId=verified.data.user.id,admin=createClient(url,env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
    const text=await request.text();if(text.length>900000)return reply({ok:false,error:'Anfrage zu groß.'},413);
    let body:any;try{body=JSON.parse(text);}catch{return reply({ok:false,error:'Ungültiges JSON.'},400);}
    if(!body||typeof body!=='object'||Array.isArray(body)||body.manual_start!==true)return reply({ok:false,error:'Manueller Start erforderlich.'},400);
    if(!['create','run','pause','resume'].includes(body.action))return reply({ok:false,error:'Unbekannte Aktion.'},400);
    let row:any=null;
    if(body.action!=='create') {
      if(!/^[0-9a-f-]{36}$/i.test(body.id||''))return reply({ok:false,error:'Experiment auswählen.'},400);
      const result=await admin.from('paper_portfolios').select('*').eq('id',body.id).eq('user_id',userId).maybeSingle();
      if(result.error||!result.data)return reply({ok:false,error:'Eigenes Experiment nicht gefunden; V33-Schema prüfen.'},404);
      row=result.data;
    }
    if(body.action==='pause'||body.action==='resume') {
      const saved=await admin.from('paper_portfolios').update({paused:body.action==='pause',version:row.version+1}).eq('id',row.id).eq('user_id',userId).eq('version',row.version).select('id');
      if(saved.error||!saved.data?.length)return reply({ok:false,error:'Parallel geändert. Neu laden.'},409);
      return reply({ok:true,id:row.id});
    }
    if(row?.paused)return reply({ok:false,error:'Experiment ist pausiert.'},409);
    const now=new Date(),config=row?.config||configPaper(body.config),market:any={};
    // Cache / explicit CSV only: no automatic paid provider or LLM requests in this module.
    for(const symbol of config.symbols) {
      if(body.market?.[symbol])market[symbol]=body.market[symbol];
      else {
        const r=await admin.from('signal_market_cache').select('bars').eq('symbol',symbol).maybeSingle();
        if(r.error||!r.data?.bars)return reply({ok:false,error:'Keine OHLCV-Daten für '+symbol+'. CSV importieren oder zunächst manuelle Deep-Analyse mit aktuellen Kursen ausführen.'},422);
        market[symbol]=r.data.bars;
      }
    }
    const a=await admin.from('deep_analyses').select('id,raw_result,created_at').eq('user_id',userId).in('symbol',config.symbols).gte('created_at',new Date(now.getTime()-7*86400000).toISOString()).order('created_at',{ascending:false}).limit(100);
    if(a.error)return reply({ok:false,error:'KI-Historie nicht lesbar; V32-Schema prüfen. Keine Buchung.'},503);
    const analyses=(a.data||[]).map((r:any)=>({...r.raw_result,id:r.id,created_at:r.created_at}));
    const result=updatePaper(config,row?.state||newPaper(config,now),market,analyses,now);
    const saved=await admin.rpc('commit_paper_portfolio',{p_user_id:userId,p_id:row?.id||null,p_version:row?.version||0,p_config:config,p_state:result.state,p_events:result.events,p_nav:result.nav});
    if(saved.error)return reply({ok:false,error:'Nicht gespeichert: V33-Schema prüfen oder nach paralleler Änderung neu laden. '+(saved.error.message?.includes('Maximal 10')?'Maximal 10 Experimente erreicht.':'')},409);
    return reply({ok:true,id:saved.data,price_date:result.state.last_session,events:result.events.length});
  } catch(e) {
    // Engine messages contain only validated symbols and data-quality explanations, never credentials.
    return reply({ok:false,error:e instanceof Error?e.message.slice(0,350):'Papierdepot nicht aktualisiert.'},422);
  }
});
