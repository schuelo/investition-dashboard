import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const root=new URL('../',import.meta.url),read=file=>readFileSync(new URL(file,root),'utf8');
export async function productionSetup({mode,projectId,token,fetchImpl=fetch,readFile=read}){
 if(!['migrate','check','scheduler'].includes(mode)||!/^[a-z0-9]{20}$/.test(projectId||''))throw Error('Modus oder SUPABASE_PROJECT_ID ungültig.');
 if(!token||/\s/.test(token))throw Error('GitHub Secret SUPABASE_ACCESS_TOKEN fehlt oder ist ungültig.');
 const run=async query=>{
  const r=await fetchImpl('https://api.supabase.com/v1/projects/'+projectId+'/database/query',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(60000)});
  if(!r.ok)throw Error('Supabase-Datenbankzugriff fehlgeschlagen (HTTP '+r.status+'). Projektzuordnung und Rechte des vorhandenen Access Tokens prüfen. SQL kann alternativ im Supabase SQL Editor ausgeführt werden.');
  const result=await r.json();if(!Array.isArray(result))throw Error('Unerwartete Antwort der Supabase-Datenbankprüfung.');return result;
 };
 const base=await run("select to_regclass('public.investment_depot_requests') is not null and to_regclass('public.investment_position_links') is not null as ready, to_regclass('public.trade_plans') is not null and to_regclass('public.depot_positions') is not null as legacy_ready");
 if(base[0]?.ready!==true&&(mode!=='migrate'||base[0]?.legacy_ready!==true))throw Error('Bestehende Depotbasis fehlt. Zuerst die bisherige Basisinstallation bzw. setup-v40-gesamtupdate.sql prüfen. Keine leere Datenbank automatisch eingerichtet.');
 if(mode==='migrate')await run(readFile(base[0]?.ready===true?'setup-v40-production.sql':'setup-v40-depotupdate.sql'));
 const checked=await run("select to_regclass('public.investment_position_events') is not null and to_regclass('public.investment_monitor_runs') is not null and exists(select 1 from information_schema.columns where table_schema='public' and table_name='investment_assets' and column_name='quote_status') and exists(select 1 from information_schema.columns where table_schema='public' and table_name='investment_assets' and column_name='archived_at') as ready");
 if(checked[0]?.ready!==true)throw Error('V40-SQL fehlt. Datenbankupdate in der Action aktivieren oder setup-v40-production.sql manuell ausführen.');
 if(mode==='scheduler'){
  await run(readFile('setup-v40-monitoring.sql'));
  const row=await run("select public.ensure_investition_monitor('https://"+projectId+".supabase.co') as scheduler");
  return {database_ready:true,scheduler:row[0]?.scheduler||{configured:false}};
 }
 return {database_ready:true,mode};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 try{const r=await productionSetup({mode:process.argv[2]||'check',projectId:process.env.PROJECT_ID||process.env.SUPABASE_PROJECT_ID,token:process.env.SUPABASE_ACCESS_TOKEN});console.log(JSON.stringify(r));if(r.scheduler?.configured===false)console.log('::warning::'+r.scheduler.reason+' Website zeigt diesen offenen Einrichtungsschritt an.');}
 catch(e){console.error('::error::'+e.message);process.exitCode=1;}
}
