import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { corsHeaders,jsonHeaders } from "../_shared/cors.ts";
import { resolveSecurity,SecurityError,readProviderJson } from "../_shared/security-resolver.mjs";
const env=(key:string)=>String(Deno.env.get(key)||'').trim();
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:jsonHeaders});
Deno.serve(async(request:Request)=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(request.method!=='POST')return reply({ok:false,error:'POST erforderlich.'},405);
  try {
    const authorization=request.headers.get('Authorization')||'';
    if(!/^Bearer\s+\S+$/i.test(authorization))return reply({ok:false,error:'Dashboard-Anmeldung erforderlich.'},401);
    const auth=createClient(env('SUPABASE_URL'),env('SUPABASE_ANON_KEY')||env('SUPABASE_PUBLISHABLE_KEY'),{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
    const verified=await auth.auth.getUser();if(verified.error||!verified.data.user)return reply({ok:false,error:'Sitzung ungültig. Erneut anmelden.'},401);
    const raw=await request.text();if(raw.length>1500)return reply({ok:false,error:'Anfrage zu groß.'},413);
    let body:any;try{body=JSON.parse(raw);}catch{return reply({ok:false,error:'Ungültige Anfrage.'},400);}
    const userId=verified.data.user.id,admin=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
    const resolution=await resolveSecurity(body,{
      readCache:async(key:string)=>{
        const r=await admin.from('security_lookup_cache').select('result').eq('user_id',userId).eq('lookup_key',key).maybeSingle();
        if(r.error)throw new SecurityError('WKN-Schema fehlt oder nicht erreichbar. V35-SQL ausführen.',503);
        return r.data?.result||null;
      },
      reserveLookup:async()=>{const r=await admin.rpc('reserve_security_lookup',{p_user_id:userId});if(r.error)throw new SecurityError('WKN-Suchschema fehlt. V35-SQL ausführen.',503);return r.data===true;},
      reserveEod:async()=>{
        const token=env('EODHD_API_TOKEN');if(!token||token==='demo')throw new SecurityError('EODHD_API_TOKEN für den vorhandenen kostenlosen Account konfigurieren; Demo-Token unterstützt die Suche nicht.',503);
        const configured=Number(env('HYBRID_EODHD_DAILY_BUDGET'));
        const limit=Number.isFinite(configured)&&configured>0?Math.max(1,Math.min(20,Math.floor(configured))):6;
        const r=await admin.rpc('reserve_hybrid_eodhd_calls',{p_calls:1,p_daily_limit:limit});return !r.error&&r.data===true;
      },
      mapFigi:async(jobs:any[])=>{
        const headers:any={'Content-Type':'application/json','Accept':'application/json'},key=env('OPENFIGI_API_KEY');if(key)headers['X-OPENFIGI-APIKEY']=key;
        const response=await fetch('https://api.openfigi.com/v3/mapping',{method:'POST',headers,body:JSON.stringify(jobs),redirect:'error',signal:AbortSignal.timeout(10000)});
        return readProviderJson(response);
      },
      searchEod:async(query:string)=>{
        const endpoint=new URL('https://eodhd.com/api/search/'+encodeURIComponent(query));
        endpoint.search=new URLSearchParams({api_token:env('EODHD_API_TOKEN'),fmt:'json',limit:'50',type:'all'}).toString();
        return readProviderJson(await fetch(endpoint,{redirect:'error',signal:AbortSignal.timeout(10000)}));
      },
      saveCache:async(key:string,result:any)=>{
        const r=await admin.from('security_lookup_cache').upsert({user_id:userId,lookup_key:key,result,expires_at:result.expires_at,updated_at:result.resolved_at});if(r.error)throw r.error;
      }
    });
    return reply({ok:true,resolution});
  } catch(e) {
    return reply({ok:false,error:e instanceof SecurityError?e.message:'Wertpapiersuche nicht abgeschlossen. Verbindung und Anbieter-Kontingent prüfen.'},e instanceof SecurityError?e.status:502);
  }
});
