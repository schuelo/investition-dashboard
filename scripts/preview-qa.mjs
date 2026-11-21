// Isolated preview with synthetic data and actual PostgreSQL/API/controller code.
// Never connects to Supabase, live quote providers or AI. Not part of the static publication.
import {createServer} from 'node:http';import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {resolve,extname} from 'node:path';
import {postgresDepotApi} from '../tests/fixtures/depot-postgres.mjs';
import {alice,bob} from '../tests/fixtures/investment-api.mjs';
import {makeBars,chartPayload} from '../tests/fixtures/independent-market.mjs';
import {alphaSearch} from '../tests/fixtures/review-alpha.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),now=new Date(),fresh=makeBars(300,now),old=makeBars(300,new Date('2026-11-13T16:00:00Z'));let quota=false;
const api=await postgresDepotApi({nowImpl:()=>now,env:{EODHD_API_TOKEN:'fixture-eod-key',ALPHAVANTAGE_API_KEY:'fixture-alpha-key'},fetchImpl:async u=>{
 const url=new URL(u);if(quota)return new Response('{}',{status:429});
 if(url.hostname==='eodhd.com')return new Response(JSON.stringify(fresh));
 if(url.hostname==='query1.finance.yahoo.com')return new Response(JSON.stringify(chartPayload({symbol:decodeURIComponent(url.pathname.split('/').at(-1)),bars:fresh})));
 if(url.hostname==='www.alphavantage.co'){const symbol=url.searchParams.get('symbol')||url.searchParams.get('keywords');return new Response(JSON.stringify(url.searchParams.get('function')==='SYMBOL_SEARCH'?alphaSearch(symbol):{'Meta Data':{'2. Symbol':symbol,'5. Time Zone':'Europe/Berlin'},'Time Series (Daily)':Object.fromEntries(fresh.slice(-100).map(b=>[b.date,{'1. open':String(b.open),'2. high':String(b.high),'3. low':String(b.low),'4. close':String(b.close),'5. volume':String(b.volume)}]))}));}
 throw Error('QA blocks external requests: '+url.hostname);
}});
await api.db.exec(readFileSync(resolve(root,'setup-v36-independent.sql'),'utf8'));
// Use the original EODHD budget function, not a permissive replacement.
const baseline=readFileSync(resolve(root,'setup-v29-4-consistent.sql'),'utf8'),start=baseline.indexOf('create or replace function public.reserve_hybrid_eodhd_calls('),end=baseline.indexOf('$$;',start)+3;
await api.db.exec('create table hybrid_api_usage(usage_date date primary key,eodhd_calls smallint not null default 0 check(eodhd_calls between 0 and 20),updated_at timestamptz not null default now());'+baseline.slice(start,end));
await api.db.exec('create table market_news(id uuid primary key default gen_random_uuid(),is_published boolean,published_at timestamptz,title text,url text,summary text);');
async function seed(){
 await api.db.exec('truncate auth.users cascade;truncate hybrid_api_usage,investment_portfolio_marks,investment_market_cache,independent_market_cache;');await api.db.query('insert into auth.users values($1),($2)',[alice,bob]);quota=false;
 for(const [symbol,name,quantity,source]of [['NVD.XETRA','NVIDIA · TESTDATEN',2,'independent'],['VOW3.XETRA','Volkswagen · TESTDATEN',10,'eodhd']]){
  const r=await api.post({action:'save_position',request_id:crypto.randomUUID(),manual_start:true,symbol,currency:'EUR',company:name,identity_confirmed:true,quantity,average_entry_price:95,entry_date:'2026-10-01',direction:'Long',instrument_type:'Aktie'});if(r.status!==200)throw Error(r.body.error);const a=r.body.asset,c={...a.config,source,quote_symbol:source==='independent'?'NVD.DE':symbol,quote_confirmed:true,refresh_minutes:60,days:20,lookback:252,research:false};
  await api.db.query('update investment_assets set config=$1,state=$2 where id=$3',[JSON.stringify(c),JSON.stringify({price:old.at(-1).close,price_date:old.at(-1).date,provider:'Gespeicherte TESTDATEN'}),a.id]);
  await api.db.query('insert into investment_market_cache(user_id,symbol,currency,source,snapshot) values($1,$2,$3,$4,$5)',[alice,symbol,'EUR',source,JSON.stringify({symbol,currency:'EUR',quote_symbol:c.quote_symbol,bars:old,provider:'Gespeicherte TESTDATEN',fetched_at:'2026-11-13T16:00:00Z'})]);
 }
 await api.post({action:'remember',manual_start:true,symbol:'AKZA.AS',currency:'EUR',company:'Akzo Nobel · TESTDATEN'});api.requests.length=0;
}
await seed();
const bootstrap=`const owner=${JSON.stringify(alice)};
 document.body.classList.remove('auth-locked');document.querySelectorAll('.auth-gate').forEach(e=>e.remove());document.getElementById('appShell').removeAttribute('aria-hidden');document.getElementById('appShell').removeAttribute('inert');
 function show(name){document.querySelectorAll('main.page').forEach(e=>e.hidden=e.id!==name);}
 document.getElementById('navDecisionBtn').addEventListener('click',()=>{show('decisionPage');window.dispatchEvent(new Event('investition:decision-visible'));});
 document.getElementById('navSignalSimulationBtn').addEventListener('click',()=>{show('signalSimulationPage');window.dispatchEvent(new Event('investition:signal-simulation-visible'));});
 class Query{constructor(table){this.table=table;this.filters=[];this.orders=[];this.mode='many';this.limitN=500;}select(){return this;}eq(k,v){this.filters.push([k,'eq',v]);return this;}in(k,v){this.filters.push([k,'in',v]);return this;}gte(k,v){this.filters.push([k,'gte',v]);return this;}order(k,o={}){this.orders.push([k,o]);return this;}limit(n){this.limitN=n;return this;}maybeSingle(){this.mode='one';return this;}then(resolve,reject){return fetch('/__qa-query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(this)}).then(r=>r.json()).then(resolve,reject);}}
 window.InvestitionDashboard={getSession:()=>({user:{id:owner}}),getSupabase:()=>({from:t=>new Query(t),functions:{invoke:async(name,{body})=>{if(name!=='review-investments')return {error:{message:'Diese QA-Seite prüft Depot und Basisanalyse; Deep separat automatisiert getestet.'}};const r=await fetch('/__qa-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await r.json();return r.ok?{data,error:null}:{data:null,error:{message:data.error}};}}})};
 window.InvestitionCompact={showTab:()=>{}};await import('/investment-ui.js?v=40.0.0');
 for(const [id,mode]of [['qaReset','reset'],['qaQuota','quota']])document.getElementById(id).onclick=async()=>{await fetch('/__qa-control',{method:'POST',body:JSON.stringify({mode})});await window.InvestitionReview.loadAssets({force:true});};
 window.__qaReady=true;`;
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
 try{const url=new URL(req.url,'http://qa.local');let raw='';if(req.method==='POST'){for await(const chunk of req){raw+=chunk;if(raw.length>650000){res.writeHead(413);res.end();return;}}}const send=(code,data,type='application/json')=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store'});res.end(type==='application/json'?JSON.stringify(data):data);};
  if(url.pathname==='/__qa-mobile.html'){send(200,'<!doctype html><html lang="de"><meta charset="utf-8"><title>Mobile QA · Investition</title><style>body{background:#202020;color:white;font:16px system-ui;text-align:center}button,a{margin:5px;padding:10px;color:white;background:#111;border:1px solid #888}iframe{display:block;margin:15px auto;border:1px solid #777;width:375px;height:812px;max-width:100%}</style><h1>Mobile Breitenprüfung · nur Testdaten</h1><p><button data-width="320">320 px</button><button data-width="375">375 px</button><button data-width="430">430 px</button><a href="/">Desktop</a></p><iframe title="Mobile Depotansicht" src="/"></iframe><script>document.querySelectorAll("[data-width]").forEach(b=>b.onclick=()=>document.querySelector("iframe").style.width=b.dataset.width+"px")</script></html>','text/html');return;}
  if(url.pathname==='/__qa-bootstrap.mjs'){send(200,bootstrap,'text/javascript');return;}
  if(url.pathname==='/__qa-api'){const r=await api.post(JSON.parse(raw));send(r.status,r.body);return;}
  if(url.pathname==='/__qa-query'){const q=JSON.parse(raw);if(!['investment_assets','investment_reviews','investment_chat_messages'].includes(q.table))throw Error('QA read not allowed');let query=api.admin.from(q.table).select('*').eq('user_id',alice);for(const[k,op,v]of q.filters||[]){if(!['eq','in','gte'].includes(op)||!/^[a-z_]+$/.test(k))throw Error('Bad filter');query=query[op](k,v);}for(const[k,o]of q.orders||[])query=query.order(k,o);query=query.limit(Math.min(500,Number(q.limitN)||500));if(q.mode==='one')query=query.maybeSingle();send(200,await query);return;}
  if(url.pathname==='/__qa-control'){if(JSON.parse(raw).mode==='reset')await seed();else{quota=true;await api.db.exec('delete from independent_market_cache;delete from investment_market_cache;');await api.db.query('update investment_assets set state=state||$1::jsonb,quote_status=$2::jsonb',[JSON.stringify({price_date:'2026-11-12'}),'{}']);}send(200,{test_data:true});return;}
  if(url.pathname==='/__qa-stats'){send(200,{synthetic:true,external_requests:0,simulated_provider_requests:api.requests.length,open_positions:(await api.db.query('select count(*)::int as n from depot_positions where is_open')).rows[0].n});return;}
  if(url.pathname==='/'||url.pathname==='/index.html'){let html=readFileSync(resolve(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<body([^>]*)>/i,'<body$1><div class="qa-banner">TESTDATEN · lokale Abnahme · kein produktives Depot <button id="qaReset">Zurücksetzen</button><button id="qaQuota">Anbieterlimit simulieren</button><a href="/__qa-mobile.html" style="color:#fff;margin:8px">Mobile-Test</a></div>').replace('</head>','<style>.qa-banner{padding:12px 16px;background:#283511;color:#e8ffc2;font:14px system-ui}.qa-banner button{margin:4px 6px;padding:8px;border:1px solid #888;border-radius:8px;background:#111;color:#fff}.auth-gate{display:none!important}body.auth-locked .app-shell{filter:none!important;pointer-events:auto!important;user-select:auto!important}</style></head>').replace('</body>','<script src="/release.js"></script><script type="module" src="/__qa-bootstrap.mjs"></script></body>');send(200,html,'text/html');return;}
  const path=resolve(root,'.'+decodeURIComponent(url.pathname));if(!path.startsWith(root)||['/scripts/','/tests/','/node_modules/'].some(x=>url.pathname.startsWith(x)))throw Error('Not found');const data=readFileSync(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
});
const args=process.argv.slice(2),portArg=args.indexOf('--port'),hostArg=args.indexOf('--host');
server.listen(Number(portArg>=0?args[portArg+1]:process.env.PORT)||3000,hostArg>=0?args[hostArg+1]:'127.0.0.1',()=>console.log('Investition QA ready · synthetic data only.'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await api.close();process.exit();}));
