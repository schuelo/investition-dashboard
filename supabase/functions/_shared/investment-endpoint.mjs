import {validateReviewInput,runInvestmentReview,ReviewError} from './investment-review.mjs';
import {acquireReviewMarket,reviewMarketAdapters} from './review-market.mjs';
import {callReviewChat} from './review-chat.mjs';
import {discoverFreeSources} from './deep-sources.mjs';
import {loadManualSources} from './manual-sources.mjs';
import {portfolioValues} from './portfolio-value.mjs';
import {validateDepotInput,depotDay} from './depot-input.mjs';
import {loadPriceSeries} from './price-series.mjs';
import {loadValuationAssets} from './stored-valuation.mjs';
import {normalizeBars} from './signal-engine.mjs';
import {FREE_DEEP_MODELS} from './deep-service.mjs';
import {targetedFeed} from './review-feed.mjs';
import {isEquity,isClosedPlan,mappedPlan,mergedPositions} from './legacy-portfolio.mjs';

const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''));
const symbolValid=s=>/^[A-Z0-9_^+\-]{1,25}\.[A-Z0-9]{1,12}$/.test(s||'');
const sameSecret=(a,b)=>{if(!a||!b||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;};
const result=(r,message)=>{if(r.error)throw new ReviewError(message,503);return r.data;};
export function canonicalPosition(position,plans){const plan=plans.find(p=>p.id===position.trade_id&&p.user_id===position.user_id),symbol=String(position.market_symbol||plan?.market_symbol||position.symbol||'').toUpperCase(),currency=String(position.currency||plan?.currency||'').toUpperCase();return {...position,symbol,currency,company:position.name||plan?.name||'',direction:position.direction||plan?.direction||'Long',instrument_type:plan?.instrument_type||position.instrument_type||'Aktie',stop:position.stop_price??plan?.stop_price,target:plan?.target1};}
export async function reviewFingerprint(review){
  const core={symbol:review.symbol,currency:review.currency,price_date:review.price_date,price:review.price,provider:review.provider,
    decision:review.decision.code,quote:review.quote.code,request:review.request,policy:review.policy,position:review.position,conversation_assumptions:review.conversation_assumptions,chart:review.analysis?.chart,setups:review.analysis?.setups,weekly:review.analysis?.weekly,
    news:review.news?.assessment?{status:review.news.assessment.status,reviewed:review.news.assessment.reviewed,evidence:review.news.assessment.evidence}:null,scenarios:review.scenarios,sources:review.sources.map(s=>({id:s.id,title:s.title,date:s.published_at,excerpt:s.excerpt,status:s.retrieval_status})),warnings:review.warnings};
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(core))))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
export function createInvestmentHandler({createClient,getEnv,fetchImpl=fetch,now=()=>new Date(),parseRss,getPage,headers={}}){
  const baseReply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
  return async request=>{
    let responseOwner=null;const reply=(value,status=200)=>baseReply({...value,...(responseOwner?{user_id:responseOwner}: {})},status);
    if(request.method==='OPTIONS')return new Response('ok',{headers});
    if(request.method!=='POST')return reply({ok:false,error:'POST erforderlich.'},405);
    try{
      const raw=await request.text();if(raw.length>650000)return reply({ok:false,error:'Anfrage zu groß.'},413);
      let body;try{body=JSON.parse(raw);}catch{return reply({ok:false,error:'Ungültiges JSON.'},400);}
      if(!body||typeof body!=='object'||Array.isArray(body))throw new ReviewError('JSON-Objekt erforderlich.',400);
      const cron=body.action==='monitor'&&sameSecret(request.headers.get('x-cron-secret')||'',getEnv('CRON_SECRET'));
      let userId=null;
      if(!cron){
        if(body.action==='monitor')return reply({ok:false,error:'Cron-Autorisierung erforderlich.'},401);
        const authorization=request.headers.get('Authorization')||'';if(!/^Bearer\s+\S+$/i.test(authorization))return reply({ok:false,error:'Dashboard-Anmeldung erforderlich.'},401);
        const client=createClient(getEnv('SUPABASE_URL'),getEnv('SUPABASE_PUBLISHABLE_KEY')||getEnv('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
        const auth=await client.auth.getUser();if(auth.error||!auth.data?.user)return reply({ok:false,error:'Sitzung ungültig. Erneut anmelden.'},401);userId=auth.data.user.id;
      }
      responseOwner=userId;
      const admin=createClient(getEnv('SUPABASE_URL'),getEnv('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
      if(body.action==='capabilities'){
        const checks=await Promise.allSettled([admin.from('investment_monitor_health').select('last_run_at').eq('id',true).maybeSingle(),admin.from('investment_depot_requests').select('request_id').limit(0),admin.from('investment_portfolio_marks').select('id').eq('user_id',userId).limit(0),admin.from('investment_market_cache').select('symbol').eq('user_id',userId).limit(0),admin.from('deep_analyses').select('id').eq('user_id',userId).limit(0),admin.from('investment_position_events').select('id').eq('user_id',userId).limit(0),admin.from('investment_monitor_runs').select('last_run_at,checked,failed').eq('user_id',userId).maybeSingle(),admin.rpc('investition_scheduler_status',{})]);
        const health=checks[0].status==='fulfilled'?checks[0].value:null,depotReady=checks[1].status==='fulfilled'&&!checks[1].value.error;
        const ready=i=>checks[i].status==='fulfilled'&&!checks[i].value.error;
        return reply({ok:true,version:'40.0.0',features:['investment_review_v38','portfolio_monitor_v38','persistent_gemini_chat_v38','legacy_depot_v391','holding_editor_v391','depot_editor_v392','price_charts_v393','dashboard_audit_v394','cached_deep_v394','position_management_v40','quote_refresh_v40'],scheduler:checks[7]?.status==='fulfilled'&&!checks[7].value.error&&typeof checks[7].value.data==='object'?checks[7].value.data:null,monitor_owner_last_run:checks[6]?.status==='fulfilled'?checks[6].value.data?.last_run_at||null:null,monitor_failures:checks[6]?.status==='fulfilled'?checks[6].value.data?.failed||0:0,monitor_checked:checks[6]?.status==='fulfilled'?checks[6].value.data?.checked||0:0,eodhd_daily_budget:getEnv('HYBRID_EODHD_DAILY_BUDGET')===''?6:Number(getEnv('HYBRID_EODHD_DAILY_BUDGET')),cron_secret_configured:!!getEnv('CRON_SECRET'),depot_ready:depotReady,table_health:{depot:ready(1),history:ready(2),market_cache:ready(3),deep:ready(4),positions:ready(5)},monitor_last_run:health?.data?.last_run_at||null,alpha_configured:!!getEnv('ALPHAVANTAGE_API_KEY'),eodhd_configured:!!getEnv('EODHD_API_TOKEN'),chat_provider:'gemini',chat_configured:getEnv('DEEP_GEMINI_FREE_TIER_CONFIRMED')==='true'&&!!getEnv('GEMINI_API_KEY')&&FREE_DEEP_MODELS.includes(getEnv('DEEP_GEMINI_MODEL'))});
      }
      const ownAsset=async(id,owner=userId)=>{
        if(!uuid(id))throw new ReviewError('Wertpapier-ID fehlt.',400);
        const a=result(await admin.from('investment_assets').select('*').eq('id',id).eq('user_id',owner).maybeSingle(),'Wertpapier nicht lesbar. V38-SQL prüfen.');
        if(!a||a.user_id!==owner)throw new ReviewError('Eigenes Wertpapier nicht gefunden.',404);return a;
      };
      const sources=async(owner)=>{
        const p=result(await admin.from('depot_positions').select('*').eq('user_id',owner).limit(1000),'Depotpositionen nicht erreichbar.');
        const t=result(await admin.from('trade_plans').select('*').eq('user_id',owner).limit(1000),'Trade-Zuordnungen nicht erreichbar.');
        const links=result(await admin.from('investment_position_links').select('*').eq('user_id',owner),'Depotzuordnung nicht lesbar.')||[];
        const assets=result(await admin.from('investment_assets').select('*').eq('user_id',owner),'Wertpapierzuordnung nicht lesbar.')||[];
        return {rows:(p||[]).filter(r=>r.user_id===owner),plans:(t||[]).filter(r=>r.user_id===owner),assets:assets.filter(a=>a.user_id===owner),links:links.filter(l=>l.user_id===owner)};
      };
      const positions=async(owner)=>{const s=await sources(owner);return mergedPositions(s.rows,s.plans,s.assets,s.links);};
      const register=async(input,owner=userId,isPortfolio=false)=>{
        const old=result(await admin.from('investment_assets').select('*').eq('user_id',owner).eq('symbol',input.symbol).eq('currency',input.currency).maybeSingle(),'V38-Wertpapiertabelle fehlt.');
        if(old)return old;
        const {bars,...config}=input;config.source=input.source==='csv'?'stored':input.source;
        const row={user_id:owner,symbol:input.symbol,currency:input.currency,company:input.company,config,legacy_trade_ids:[],
          enabled:isPortfolio,watchlisted:!isPortfolio,is_portfolio:isPortfolio};
        const created=result(await admin.from('investment_assets').upsert(row,{onConflict:'user_id,symbol,currency',ignoreDuplicates:true}).select('*').maybeSingle(),'Wertpapier konnte nicht gespeichert werden.');
        return created||result(await admin.from('investment_assets').select('*').eq('user_id',owner).eq('symbol',input.symbol).eq('currency',input.currency).single(),'Wertpapier konnte nicht geladen werden.');
      };
      const sync=async(owner)=>{
        const s=await sources(owner),held=mergedPositions(s.rows,s.plans,s.assets,s.links),unmapped=[];const seen=new Set(),legacy=new Map();
        const existing=s.assets;
        for(const plan of s.plans.filter(p=>!isClosedPlan(p))){
          const p=mappedPlan(plan,existing);let input;
          try{if(!isEquity(plan))throw Error();input=validateReviewInput({symbol:p.symbol,currency:p.currency,company:p.company,wkn:plan.wkn,isin:plan.isin,source:'stored',policy:{stop:Number(p.stop)>0?p.stop:null,target:Number(p.target)>0?p.target:null}});}catch{unmapped.push({id:plan.id,kind:'legacy_plan',name:p.company,symbol:p.symbol,currency:p.currency,product:!isEquity(plan)});continue;}
          let a=existing.find(a=>a.symbol===input.symbol&&a.currency===input.currency);
          if(!a){a=await register(input,owner,false);existing.push(a);result(await admin.from('investment_assets').update({enabled:plan.monitoring_enabled!==false}).eq('id',a.id).eq('user_id',owner),'Altbestand nicht aktiviert.');}
          const ids=legacy.get(a.id)||[];ids.push(plan.id);legacy.set(a.id,ids);
        }
        for(const a of existing){const ids=legacy.get(a.id)||[];if(JSON.stringify([...(a.legacy_trade_ids||[])].sort())!==JSON.stringify([...ids].sort()))result(await admin.from('investment_assets').update({legacy_trade_ids:ids}).eq('id',a.id).eq('user_id',owner),'Altbestandszuordnung nicht gespeichert. setup-v39-1-depotfix.sql ausführen.');}
        for(const p of held){
          let initial;try{if(!symbolValid(p.symbol)||!p.currency||!isEquity(p))throw Error();initial=validateReviewInput({symbol:p.symbol,currency:p.currency,company:p.company,source:'stored',policy:{stop:Number(p.stop)>0?p.stop:null,target:Number(p.target)>0?p.target:null}});}catch{unmapped.push({id:p.id,kind:p.position_origin==='legacy_plan'?'legacy_plan':'position',name:p.company,symbol:p.symbol,currency:p.currency,product:!isEquity(p)});continue;}
          const identity=p.symbol+'|'+p.currency;if(seen.has(identity))continue;seen.add(identity);
          const old=existing.find(a=>a.symbol===p.symbol&&a.currency===p.currency);
          if(old){if(!old.is_portfolio)result(await admin.from('investment_assets').update({is_portfolio:true,enabled:true}).eq('id',old.id).eq('user_id',owner),'Depotzuordnung nicht gespeichert.');}
          else await register(initial,owner,true);
        }
        for(const a of existing.filter(a=>a.is_portfolio&&!seen.has(a.symbol+'|'+a.currency)))result(await admin.from('investment_assets').update({is_portfolio:false,enabled:a.watchlisted===true}).eq('id',a.id).eq('user_id',owner),'Geschlossene Position nicht abgeglichen.');
        return unmapped;
      };
      const portfolioOverview=async(owner)=>{
        const held=await positions(owner),all=result(await admin.from('investment_assets').select('*').eq('user_id',owner),'Depotbewertung nicht erreichbar.')||[];
        const valuations=await loadValuationAssets(admin,owner,all,held,now()),summary=portfolioValues(held,valuations.assets,now());let historyWarning='';
        try{
        for(const g of summary.groups){
          if(g.positions===g.missing)continue;
          const fingerprint=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({valuation_day:depotDay(now()),components:g.components}))))].map(v=>v.toString(16).padStart(2,'0')).join('');
          const value={currency:g.currency,amount:g.amount,cost_basis:g.cost_basis,missing:g.missing,stale:g.stale,positions:g.positions,price_dates:g.price_dates};
          result(await admin.from('investment_portfolio_marks').upsert({user_id:owner,...value,fingerprint,recorded_at:now().toISOString()},{onConflict:'user_id,currency,fingerprint',ignoreDuplicates:true}),'V39-Bewertungstabelle fehlt.');
        }
        }catch{historyWarning='Aktueller Depotwert verfügbar; eine neue Verlaufsmessung konnte nicht gespeichert werden.';}
        let marks=[];try{marks=result(await admin.from('investment_portfolio_marks').select('*').eq('user_id',owner).order('recorded_at',{ascending:false}).limit(1000),'Depotverlauf nicht lesbar.')||[];}catch{historyWarning='Aktueller Depotwert verfügbar; die gespeicherte Verlaufshistorie ist nicht erreichbar.';}
        return {...summary,as_of:now().toISOString(),marks:marks.filter(m=>m.user_id===owner).reverse(),history_warning:historyWarning,stored_quotes_reused:valuations.reused,valuation_warning:valuations.warnings.join(' ')};
      };
      const optionalOverview=async(owner)=>{try{const portfolio=await portfolioOverview(owner);return {portfolio,portfolio_warning:portfolio.history_warning||''};}catch(e){return {portfolio:null,portfolio_warning:e instanceof ReviewError?e.message:'Depotbewertung nicht verfügbar. Die Wertpapierliste bleibt nutzbar.'};}};
      const withLease=async(asset,kind,fn)=>{
        const token=crypto.randomUUID(),q=await admin.rpc('claim_investment_operation',{p_user_id:asset.user_id,p_asset_id:asset.id,p_kind:kind,p_token:token});
        if(q.error)throw new ReviewError('V38-Sperrfunktion fehlt oder ist nicht erreichbar.',503);if(q.data!==true)throw new ReviewError('Für diesen Wert läuft bereits eine '+(kind==='chat'?'Chatantwort':'Prüfung')+'.',409);
        try{return await fn(token);}finally{await admin.from('investment_operation_locks').delete().eq('user_id',asset.user_id).eq('asset_id',asset.id).eq('kind',kind).eq('token',token);}
      };
      const recordQuote=async(asset,input,market)=>{
        const old=asset.quote_status||{},bars=(market?.bars||[]).filter(b=>b.date<now().toISOString().slice(0,10)),last=bars.at(-1),attempt=market?.attempt||old.attempt||null;
        const quote_status={...old,source:input.source,inspected_at:now().toISOString(),...(last?{last_verified_at:now().toISOString()}:{}),attempt,...(['success','failed'].includes(market?.attempt?.status)?{last_network_at:market.attempt.at}:{}),price_date:last?.date||old.price_date||null,retry_after:market?.retry_after||null,...(market?.attempt?.status==='success'?{last_success_at:market.attempt.at}: {})};
        const saved=await admin.from('investment_assets').update({quote_status}).eq('id',asset.id).eq('user_id',asset.user_id);
        if(!saved.error)asset.quote_status=quote_status;
      };
      const refreshAsset=async(asset)=>withLease(asset,'review',async()=>{
        const input=validateReviewInput({...asset.config,symbol:asset.symbol,currency:asset.currency,company:asset.company,research:false,manual_urls:[]});
        const market=await acquireReviewMarket(input,reviewMarketAdapters(admin,asset.user_id,{getEnv,fetchImpl}),now());await recordQuote(asset,input,market);
        const last=(market.bars||[]).filter(b=>b.date<now().toISOString().slice(0,10)).at(-1),state={...asset.state};
        if(last&&typeof last.close==='number'&&Number.isFinite(last.close)&&last.close>0){if(state.price!==last.close||state.price_date!==last.date)state.plan_pending=true;Object.assign(state,{price:last.close,price_date:last.date,provider:market.provider});}
        if(market.attempt)state.last_attempt=market.attempt;
        result(await admin.from('investment_assets').update({state}).eq('id',asset.id).eq('user_id',asset.user_id),'Kursstatus nicht gespeichert.');
        return {asset:{...asset,state},attempt:market.attempt||null,warning:market.warning||'',source:input.source};
      });
      const readReview=async(asset,id=asset.latest_review_id)=>{
        if(!id)return null;const r=result(await admin.from('investment_reviews').select('*').eq('id',id).eq('asset_id',asset.id).eq('user_id',asset.user_id).maybeSingle(),'Analyse nicht lesbar.');
        if(!r||r.user_id!==asset.user_id||r.asset_id!==asset.id)return null;return {...r.snapshot,id:r.id,asset_id:asset.id};
      };
      let remainingNetwork=2,remainingNews=2;
      const reviewOne=async(asset,input,{scheduled=false,requestId=crypto.randomUUID(),leaseToken=null}={})=>{
       const run=async token=>{
        const prior=result(await admin.from('investment_reviews').select('*').eq('user_id',asset.user_id).eq('request_id',requestId).maybeSingle(),'Anfrageprüfung fehlgeschlagen.');
        if(prior){if(prior.asset_id!==asset.id)throw new ReviewError('Anfragereferenz gehört zu einem anderen Wertpapier.',409);return {...prior.snapshot,id:prior.id,asset_id:asset.id,saved:true};}
        const readPosition=async()=>{
          const matched=(await positions(asset.user_id)).filter(p=>p.symbol===asset.symbol&&p.currency===asset.currency),holding=matched.filter(p=>/^(Aktie|ETF|Stock|Equity)$/i.test(p.instrument_type)),quantity=holding.reduce((s,p)=>s+Math.abs(Number(p.quantity)||0),0);
          const direction=holding.every(p=>String(p.direction||'').toLowerCase()==='long')?'long':holding.every(p=>String(p.direction||'').toLowerCase()==='short')?'short':'unknown';
          return matched.length?{quantity,direction,unsupported_exposure:matched.length!==holding.length,average_entry_price:quantity>0&&holding.every(p=>Number(p.average_entry_price)>0)?holding.reduce((s,p)=>s+Math.abs(Number(p.quantity)||0)*Number(p.average_entry_price),0)/quantity:null}:null;
        };
        const adapters=reviewMarketAdapters(admin,asset.user_id,{getEnv,fetchImpl,force:body.force_quote===true&&!scheduled,allowNetwork:!scheduled||remainingNetwork>0});
        const fetchSource=adapters.fetchSource;adapters.fetchSource=async(...args)=>{if(scheduled)remainingNetwork--;return fetchSource(...args);};
        let market;
        return runInvestmentReview(input,{
          now,previous:()=>readReview(asset),position:readPosition,preserveManualSources:scheduled,
          readNotes:async()=>result(await admin.from('investment_chat_messages').select('id,role,content,created_at').eq('user_id',asset.user_id).eq('asset_id',asset.id).in('role',['user','note']).order('sequence',{ascending:false}).limit(5),'Gesprächsannahmen nicht erreichbar.')||[],
          loadMarket:async()=>{market=await acquireReviewMarket(input,adapters,now());await recordQuote(asset,input,market);if(!scheduled&&market?.bars?.length){const quota=await admin.rpc('reserve_investment_operation',{p_user_id:asset.user_id,p_kind:'review'});if(quota.error||quota.data!==true)throw new ReviewError('Manuelles V38-Prüflimit erreicht. Bereits gespeicherten Bericht öffnen.',429);}return market;},
          readNews:async(i,n)=>{
            const sources=result(await admin.from('market_news').select('*').eq('is_published',true).gte('published_at',new Date(n.getTime()-i.news_days*86400000).toISOString()).order('published_at',{ascending:false}).limit(1000),'News nicht erreichbar.')||[];
            if(!scheduled)return sources;
            let feed;try{feed=await targetedFeed(asset,{now:n,allowNetwork:remainingNews>0,fetchImpl:async(...args)=>{remainingNews--;return fetchImpl(...args);},parseRss,
              read:async()=>result(await admin.from('investment_news_cache').select('*').eq('user_id',asset.user_id).eq('asset_id',asset.id).maybeSingle(),'Newszwischenspeicher nicht erreichbar.'),
              write:async row=>result(await admin.from('investment_news_cache').upsert({user_id:asset.user_id,asset_id:asset.id,...row},{onConflict:'user_id,asset_id'}),'Newszwischenspeicher nicht gespeichert.')});}catch{feed={sources:[],status:'failed',fetched_at:null,error:'Gezielter Newszwischenspeicher nicht verfügbar; vorhandene Feed-Belege bleiben erhalten.'};}
            return {sources:[...sources,...feed.sources],targeted_feed:feed};
          },
          discover:scheduled?null:async(i,n)=>(await discoverFreeSources(i,{parseRss,fetchImpl,now:n})).sources,
          manualSources:scheduled?null:async(i,n)=>loadManualSources(i,{getPage,now:n}),
          save:async snapshot=>{
            const key=await reviewFingerprint(snapshot),commit=await admin.rpc('commit_investment_review',{p_user_id:asset.user_id,p_asset_id:asset.id,p_token:token,p_request_id:requestId,p_snapshot:snapshot,p_key:key});
            if(commit.error||!uuid(commit.data))throw new ReviewError('Bericht nicht gespeichert.',503);
            const stored=await readReview(asset,commit.data);return {id:commit.data,asset_id:asset.id,snapshot:stored};
          }
        });
       };
       return leaseToken?run(leaseToken):withLease(asset,'review',run);
      };
      if(body.action==='get_chart_series'){
        if(!Array.isArray(body.asset_ids)||body.asset_ids.length<1||body.asset_ids.length>24||body.asset_ids.some(id=>!uuid(id)))throw new ReviewError('Ein bis 24 eigene Wertpapier-IDs für Kursverläufe angeben.',400);
        const ids=[...new Set(body.asset_ids)],owned=result(await admin.from('investment_assets').select('*').eq('user_id',userId).in('id',ids),'Eigene Werte nicht lesbar.')||[];
        if(owned.length!==ids.length)throw new ReviewError('Eigene Wertpapiere für den Kursverlauf nicht gefunden.',404);
        return reply({ok:true,series:await loadPriceSeries(admin,userId,owned,now())});
      }
      if(body.action==='prepare_deep'){
        const asset=await ownAsset(body.asset_id);let cached=null,report=null;
        try{cached=await reviewMarketAdapters(admin,userId,{getEnv,fetchImpl,allowNetwork:false}).readCache({symbol:asset.symbol,currency:asset.currency,source:'stored'},now());}catch{/* A saved report can supply real OHLCV even when the optional cache is unavailable. */}
        try{report=await readReview(asset);}catch{/* Preparing the page must not require a new analysis. */}
        let bars=[],provider='';for(const candidate of [cached,{symbol:report?.symbol,currency:report?.currency,bars:report?.analysis?.history,provider:report?.provider}]){
          if(candidate?.symbol!==asset.symbol||candidate?.currency!==asset.currency)continue;
          try{const normalized=normalizeBars(candidate.bars,now()).bars.filter(b=>b.date<now().toISOString().slice(0,10));if(normalized.length>=60){bars=normalized;provider=candidate.provider||'Gespeicherte OHLCV';break;}}catch{}
        }
        return reply({ok:true,symbol:asset.symbol,currency:asset.currency,company:asset.company,bars,provider,price_date:bars.at(-1)?.date||null,warning:bars.length?'':'Keine ausreichende eigene OHLCV-Historie. CSV importieren oder einen Anbieter ausdrücklich wählen. Kein Kurs- oder KI-Aufruf ausgelöst.'});
      }
      if(body.action==='refresh_chart'){
        if(body.manual_start!==true)throw new ReviewError('Kursverlauf ausdrücklich aktualisieren.',400);
        const asset=await ownAsset(body.asset_id),input=validateReviewInput(body);
        if(input.symbol!==asset.symbol||input.currency!==asset.currency)throw new ReviewError('Wertpapier und Kursformular passen nicht zusammen.',409);
        return await withLease(asset,'review',async()=>{
          const market=await acquireReviewMarket(input,reviewMarketAdapters(admin,userId,{getEnv,fetchImpl,force:body.force_quote===true}),now());
          const bars=(market.bars||[]).filter(b=>b.date<now().toISOString().slice(0,10)),last=bars.at(-1),state={...asset.state};
          if(last&&typeof last.close==='number'&&Number.isFinite(last.close)&&last.close>0){if(state.price!==last.close||state.price_date!==last.date)state.plan_pending=true;state.price=last.close;state.price_date=last.date;state.provider=market.provider;}
          if(market.attempt)state.last_attempt=market.attempt;
          await recordQuote(asset,input,market);
          if(JSON.stringify(state)!==JSON.stringify(asset.state))result(await admin.from('investment_assets').update({state}).eq('id',asset.id).eq('user_id',userId),'Kursstatus nicht gespeichert.');
          const updated={...asset,state},series=(await loadPriceSeries(admin,userId,[updated],now()))[0];
          return reply({ok:true,series,asset:updated,attempt:market.attempt||null,warning:market.warning||'',...await optionalOverview(userId)});
        });
      }
      if(body.action==='save_quote_settings'){
        if(body.manual_start!==true||typeof body.enabled!=='boolean')throw new ReviewError('Kursautomatik ausdrücklich speichern.',400);
        const asset=await ownAsset(body.asset_id);if(asset.archived_at&&body.enabled)throw new ReviewError('Wert erst wieder in Beobachtung aufnehmen.');const input=validateReviewInput({...asset.config,...body,symbol:asset.symbol,currency:asset.currency,manual_urls:[],research:false});
        if(![30,60,120,360,1440].includes(Number(body.refresh_minutes??60)))throw new ReviewError('Prüfintervall ungültig.');
        if(input.source==='eodhd'&&input.quote_symbol&&input.quote_symbol!==asset.symbol)throw new ReviewError('EODHD verwendet die genaue Wertpapierkennung '+asset.symbol+'.');
        if(input.source==='csv')throw new ReviewError('CSV über die Importfunktion laden; keine automatische CSV-Aktualisierung.');
        const config={...asset.config,source:input.source,quote_symbol:input.quote_symbol,quote_confirmed:input.quote_confirmed,refresh_minutes:input.refresh_minutes},changed=asset.config?.source!==config.source||asset.config?.quote_symbol!==config.quote_symbol;
        const patch={config,enabled:body.enabled,next_check_at:now().toISOString(),...(changed?{quote_status:{source:input.source,configured_at:now().toISOString(),attempt:null,price_date:null},state:{...asset.state,plan_pending:true}}:{})};
        return await withLease(asset,'review',async()=>{result(await admin.from('investment_assets').update(patch).eq('id',asset.id).eq('user_id',userId),'Kurseinstellungen nicht gespeichert. V40-SQL prüfen.');return reply({ok:true,asset:{...asset,...patch}});});
      }
      if(body.action==='refresh_quotes'){
        if(body.manual_start!==true||!Array.isArray(body.asset_ids)||!body.asset_ids.length||body.asset_ids.length>6||body.asset_ids.some(id=>!uuid(id)))throw new ReviewError('Ein bis sechs eigene Werte ausdrücklich aktualisieren.',400);
        const owned=[];for(const id of [...new Set(body.asset_ids)])owned.push(await ownAsset(id));
        const results=[];for(const asset of owned){try{results.push(await refreshAsset(asset));}catch(e){results.push({asset_id:asset.id,error:e instanceof ReviewError?e.message:'Kursaktualisierung fehlgeschlagen.'});}}
        return reply({ok:true,results,...await optionalOverview(userId)});
      }
      if(body.action==='get_position_events'){
        const asset=await ownAsset(body.asset_id),rows=result(await admin.from('investment_position_events').select('*').eq('user_id',userId).eq('asset_id',asset.id).order('created_at',{ascending:false}).limit(60),'Bestandsverlauf nicht erreichbar. V40-SQL installieren.')||[];
        return reply({ok:true,events:rows.filter(r=>r.user_id===userId&&r.asset_id===asset.id).map(r=>({id:r.id,kind:r.kind,currency:r.currency,before:r.before_data,after:r.after_data,created_at:r.created_at}))});
      }
      if(body.action==='archive_asset'){
        const asset=await ownAsset(body.asset_id);if(body.manual_start!==true||body.confirm!==true||!uuid(body.request_id))throw new ReviewError('Das Entfernen des gesamten Werts ausdrücklich bestätigen.',400);
        const r=await admin.rpc('archive_investment_asset',{p_user_id:userId,p_asset_id:asset.id,p_request_id:body.request_id,p_confirm:true});
        if(r.error)throw new ReviewError(/in progress/i.test(r.error.message)?'Für diesen Wert läuft eine Bearbeitung. Danach erneut versuchen.':'Wert nicht entfernt. V40-SQL und Bestandszuordnung prüfen.',409);
        if(r.data?.archived!==true)throw new ReviewError('Entfernen nicht bestätigt. Bestand neu laden.',503);
        return reply({ok:true,...r.data,...await optionalOverview(userId)});
      }
      if(body.action==='sync_portfolio'){const unmapped=await sync(userId);return reply({ok:true,unmapped,...await optionalOverview(userId)});}
      if(body.action==='portfolio_overview')return reply({ok:true,...await optionalOverview(userId)});
      if(body.action==='get_holdings'){
        let asset;if(body.asset_id)asset=await ownAsset(body.asset_id);else{const input=validateReviewInput({symbol:body.symbol,currency:body.currency,source:'stored'});asset=result(await admin.from('investment_assets').select('*').eq('user_id',userId).eq('symbol',input.symbol).eq('currency',input.currency).maybeSingle(),'Wertpapier nicht lesbar.');}
        if(!asset)return reply({ok:true,asset:null,positions:[],legacy_trade_ids:[]});
        const all=(await positions(userId)).filter(p=>p.symbol===asset.symbol&&p.currency===asset.currency).sort((a,b)=>String(a.entry_date||'9999').localeCompare(String(b.entry_date||'9999'))||String(a.id).localeCompare(String(b.id)));
        return reply({ok:true,asset,positions:all.filter(isEquity).map(p=>({id:p.id,trade_id:p.trade_id,position_origin:p.position_origin,quantity:p.quantity,average_entry_price:p.average_entry_price,entry_date:p.entry_date||null,direction:p.direction,instrument_type:p.instrument_type})),legacy_trade_ids:asset.legacy_trade_ids||[]});
      }
      if(body.action==='save_position'){
        let input;try{input=validateDepotInput(body,now());}catch(e){throw new ReviewError(e.message,422);}
        if(input.asset_id){const a=await ownAsset(input.asset_id);if(a.symbol!==input.symbol||a.currency!==input.currency)throw new ReviewError('Wertpapier geändert. Position für die neue Notierung separat anlegen.',409);}
        const saved=await admin.rpc('save_depot_position',{p_user_id:userId,p_request_id:input.request_id,p_asset_id:input.asset_id,p_symbol:input.symbol,p_currency:input.currency,p_company:input.company,p_wkn:input.wkn,p_isin:input.isin,p_position_id:input.position_id,p_legacy_trade_id:input.legacy_trade_id,p_quantity:input.quantity,p_entry:input.average_entry_price,p_direction:input.direction,p_type:input.instrument_type,p_entry_date:input.entry_date,p_valuation_mode:input.valuation_mode,p_manual_price:input.manual_price,p_manual_price_date:input.manual_price_date,p_close:input.close,p_additional_confirmed:input.additional_position_confirmed});
        if(saved.error){
          const message=saved.error.message||'';
          if(/Review in progress/i.test(message))throw new ReviewError('Für diesen Wert läuft eine Analyse. Danach den Bestand erneut speichern.',409);
          if(/Request reference already used/i.test(message))throw new ReviewError('Dieser Speichervorgang wurde bereits verarbeitet. Bestand neu laden und danach bearbeiten.',409);
          if(/Additional position requires/i.test(message))throw new ReviewError('Für diesen Wert besteht bereits ein Depotbestand. Bestand neu laden, die Position bearbeiten oder eine zusätzliche Position ausdrücklich bestätigen.',409);
          if(/identity|Own .*missing|migrated/i.test(message))throw new ReviewError('Die Position passt nicht mehr zur Auswahl. Bestand neu laden und erneut auswählen.',409);
          throw new ReviewError('Depotposition nicht gespeichert. setup-v39-2-depot.sql und die Action „V39.2 Depotverwaltung deployen“ prüfen.',503);
        }
        if(!saved.data?.asset_id||saved.data.saved!==true)throw new ReviewError('Speicherbestätigung unvollständig. Bestand neu laden, bevor eine weitere Position angelegt wird.',503);
        if(!input.close)await admin.from('investment_assets').update({archived_at:null}).eq('id',saved.data.asset_id).eq('user_id',userId);
        let unmapped=[],syncWarning='';try{unmapped=await sync(userId);}catch{syncWarning='Position gespeichert; der anschließende Abgleich ist nicht vollständig. Depot erneut laden.';}
        let asset=saved.data.asset;try{asset=await ownAsset(saved.data.asset_id);}catch{/* The committed receipt remains a valid save confirmation. */}
        return reply({ok:true,saved:true,position:saved.data,asset,unmapped,sync_warning:syncWarning,...await optionalOverview(userId)});
      }
      if(body.action==='save_holding'){
        const asset=await ownAsset(body.asset_id);if(body.manual_start!==true||!uuid(body.request_id))throw new ReviewError('Bestand ausdrücklich speichern; Anfragereferenz fehlt.',400);
        const close=body.close===true,q=Number(body.quantity),entry=Number(body.average_entry_price);
        if(!close&&(!Number.isFinite(q)||q<=0||q>1e9||!Number.isFinite(entry)||entry<=0||entry>1e9||!['Long','Short'].includes(body.direction)||!['Aktie','ETF'].includes(body.instrument_type)))throw new ReviewError('Tatsächliche positive Stückzahl, Einstand, Richtung und Aktien-/ETF-Typ eingeben.');
        if(body.position_id&&!uuid(body.position_id)||body.legacy_trade_id&&!uuid(body.legacy_trade_id))throw new ReviewError('Bestandszuordnung ungültig.');
        const saved=await admin.rpc('save_investment_holding',{p_user_id:userId,p_asset_id:asset.id,p_request_id:body.request_id,p_position_id:body.position_id||null,p_legacy_trade_id:body.legacy_trade_id||null,p_quantity:close?null:q,p_entry:close?null:entry,p_direction:body.direction||'Long',p_type:body.instrument_type||'Aktie',p_close:close});
        if(saved.error)throw new ReviewError(/Review in progress/i.test(saved.error.message)?'Für diesen Wert läuft gerade eine Analyse. Danach den Bestand speichern.':'Bestand nicht gespeichert. V39.1-SQL und Zuordnung prüfen.',/Review in progress/i.test(saved.error.message)?409:503);
        const unmapped=await sync(userId);return reply({ok:true,position:saved.data,unmapped,...await optionalOverview(userId)});
      }
      if(body.action==='set_watchlist'){
        const asset=await ownAsset(body.asset_id);if(typeof body.watchlisted!=='boolean')throw new ReviewError('Beobachtungsstatus ungültig.');
        const patch={watchlisted:body.watchlisted,...(body.watchlisted?{archived_at:null}:{}),...(!asset.is_portfolio?{enabled:body.watchlisted,next_check_at:now().toISOString()}: {})};
        result(await admin.from('investment_assets').update(patch).eq('id',asset.id).eq('user_id',userId),'Beobachtung nicht gespeichert. V39-SQL installieren.');return reply({ok:true,asset:{...asset,...patch}});
      }
      if(body.action==='remember'){
        if(body.manual_start!==true)throw new ReviewError('Wert ausdrücklich merken.',400);
        const input=validateReviewInput({symbol:body.symbol,currency:body.currency,company:body.company,wkn:body.wkn,isin:body.isin,source:'stored'}),asset=await register(input);
        const patch={watchlisted:true,archived_at:null,...(!asset.is_portfolio?{enabled:true,next_check_at:now().toISOString()}: {})};
        result(await admin.from('investment_assets').update(patch).eq('id',asset.id).eq('user_id',userId),'Wert nicht zur Beobachtung gespeichert. V39-SQL prüfen.');return reply({ok:true,asset:{...asset,...patch}});
      }
      if(body.action==='set_monitoring'){
        const asset=await ownAsset(body.asset_id);if(typeof body.enabled!=='boolean')throw new ReviewError('Überwachungsstatus ungültig.');if(asset.archived_at&&body.enabled)throw new ReviewError('Archivierten Wert erst wieder in Beobachtung aufnehmen.');
        result(await admin.from('investment_assets').update({enabled:body.enabled,next_check_at:now().toISOString()}).eq('id',asset.id).eq('user_id',userId),'Überwachung nicht gespeichert.');return reply({ok:true});
      }
      if(body.action==='analyze'||body.action==='save_config'){
        if(body.manual_start!==true)throw new ReviewError('Prüfung ausdrücklich manuell starten.',400);
        const input=validateReviewInput(body);if(body.asset_id){const old=await ownAsset(body.asset_id);if(old.symbol!==input.symbol||old.currency!==input.currency)throw new ReviewError('Gespeichertes Wertpapier und Formular passen nicht zusammen. Neuen Wert separat prüfen.');}
        if(body.request_id&&!uuid(body.request_id))throw new ReviewError('Anfragereferenz ungültig.');
        const asset=await register(input);if(body.refresh_minutes===undefined&&[30,60,120,360,1440].includes(Number(asset.config?.refresh_minutes)))input.refresh_minutes=Number(asset.config.refresh_minutes);
        return await withLease(asset,'review',async token=>{
        if(body.position_id){
          if(!uuid(body.position_id))throw new ReviewError('Depotposition ungültig.');
          const p=result(await admin.from('depot_positions').select('*').eq('id',body.position_id).eq('user_id',userId).maybeSingle(),'Depotposition nicht lesbar.');
          if(!p||p.is_open===false||p.user_id!==userId||p.currency&&p.currency!==asset.currency)throw new ReviewError('Depotposition oder Währung passt nicht zur Zuordnung.');
          const holding=(await positions(userId)).find(v=>v.id===p.id);if(!holding||!/^(Aktie|ETF|Stock|Equity)$/i.test(holding.instrument_type))throw new ReviewError('KO-/Hebelprodukt nicht als Aktie zuordnen. Basiswert getrennt prüfen und bisherige Produktwerkzeuge verwenden.');
          result(await admin.from('investment_position_links').upsert({user_id:userId,position_id:p.id,asset_id:asset.id},{onConflict:'user_id,position_id'}),'Depotzuordnung nicht gespeichert.');
          result(await admin.from('investment_assets').update({is_portfolio:true,enabled:true}).eq('id',asset.id).eq('user_id',userId),'Depotzuordnung nicht gespeichert.');
          if(p.trade_id){const plan=result(await admin.from('trade_plans').select('*').eq('id',p.trade_id).eq('user_id',userId).maybeSingle(),'Trade-Zuordnung nicht lesbar.');if(plan&&isEquity(plan)){asset.legacy_trade_ids=[...new Set([...(asset.legacy_trade_ids||[]),plan.id])];result(await admin.from('investment_assets').update({legacy_trade_ids:asset.legacy_trade_ids}).eq('id',asset.id).eq('user_id',userId),'Altbestandszuordnung nicht gespeichert.');}}
        }
        if(body.legacy_trade_id){
          if(!uuid(body.legacy_trade_id))throw new ReviewError('Ältere Zuordnung ungültig.');
          const p=result(await admin.from('trade_plans').select('*').eq('id',body.legacy_trade_id).eq('user_id',userId).maybeSingle(),'Älterer Wert nicht lesbar.');
          if(!p||p.user_id!==userId||!isEquity(p)||p.currency&&p.currency!==asset.currency)throw new ReviewError('Älterer Aktien-/ETF-Wert und Währung passen nicht zur gewählten Zuordnung.');
          asset.legacy_trade_ids=[...new Set([...(asset.legacy_trade_ids||[]),p.id])];result(await admin.from('investment_assets').update({legacy_trade_ids:asset.legacy_trade_ids}).eq('id',asset.id).eq('user_id',userId),'Ältere Zuordnung nicht gespeichert.');
        }
        const {bars,...config}=input;config.source=input.source==='csv'?'stored':input.source;
        const patch={config,company:input.company,...(JSON.stringify(config)!==JSON.stringify(asset.config)?{state:{...asset.state,plan_pending:true}}:{}),...(!asset.is_portfolio?{watchlisted:true,enabled:true}: {})};
        result(await admin.from('investment_assets').update(patch).eq('id',asset.id).eq('user_id',userId),'Plan konnte nicht gespeichert werden.');
        const updated={...asset,...patch};
        return body.action==='save_config'?reply({ok:true,asset:updated}):reply({ok:true,review:await reviewOne(updated,input,{requestId:body.request_id||crypto.randomUUID(),leaseToken:token})});
        });
      }
      if(body.action==='monitor'||body.action==='monitor_once'){
        if(!cron&&body.manual_start!==true)throw new ReviewError('Depotprüfung manuell starten.',400);
        if(!cron)await sync(userId);
        else{
          const owners=result(await admin.from('depot_positions').select('user_id').eq('is_open',true).limit(2000),'Depotzugriff nicht möglich.')||[];
          const old=result(await admin.from('trade_plans').select('user_id,status').limit(2000),'Altbestand nicht erreichbar.')||[];
          for(const owner of [...new Set([...owners,...old.filter(p=>!isClosedPlan(p))].map(p=>p.user_id))])await sync(owner);
        }
        let q=admin.from('investment_assets').select('*').eq('enabled',true).order('next_check_at',{ascending:true}).limit(40);
        if(userId)q=q.eq('user_id',userId);if(cron)q=q.lte('next_check_at',now().toISOString());
        const assets=result(await q,'Überwachung nicht erreichbar.')||[],results=[];
        let feedAges=[];if(assets.length){try{feedAges=result(await admin.from('investment_news_cache').select('user_id,asset_id,attempted_at').in('asset_id',assets.map(a=>a.id)),'Newswarteschlange nicht erreichbar.')||[];}catch{/* Per-value feed status reports the unavailable cache; keep the existing feed and reviews usable. */}}
        assets.sort((a,b)=>(Date.parse(a.quote_status?.last_network_at)||0)-(Date.parse(b.quote_status?.last_network_at)||0)||(Date.parse(feedAges.find(c=>c.asset_id===a.id&&c.user_id===a.user_id)?.attempted_at)||0)-(Date.parse(feedAges.find(c=>c.asset_id===b.id&&c.user_id===b.user_id)?.attempted_at)||0));
        for(const asset of assets){try{const config=validateReviewInput({...asset.config,symbol:asset.symbol,currency:asset.currency,company:asset.company,research:false,manual_urls:[]});const r=await reviewOne(asset,config,{scheduled:true});results.push({asset_id:asset.id,saved:r.saved});}catch(e){results.push({asset_id:asset.id,error:e instanceof ReviewError?e.message:'Prüfung nicht abgeschlossen.'});}finally{const minutes=[30,60,120,360,1440].includes(Number(asset.config?.refresh_minutes))?Number(asset.config.refresh_minutes):60;await admin.from('investment_assets').update({next_check_at:new Date(now().getTime()+minutes*60000).toISOString()}).eq('id',asset.id).eq('user_id',asset.user_id);}}
        for(const owner of [...new Set(assets.map(a=>a.user_id))]){try{await portfolioOverview(owner);}catch{results.push({error:'Depotverlauf konnte nicht aktualisiert werden; Einzelberichte bleiben erhalten.'});}}
        if(cron)for(const owner of [...new Set(assets.map(a=>a.user_id))]){const own=results.filter(r=>assets.some(a=>a.user_id===owner&&a.id===r.asset_id));await admin.from('investment_monitor_runs').upsert({user_id:owner,last_run_at:now().toISOString(),checked:own.length,failed:own.filter(r=>r.error).length},{onConflict:'user_id'});}
        if(cron)result(await admin.from('investment_monitor_health').upsert({id:true,last_run_at:now().toISOString(),checked:results.length}),'Hintergrundstatus nicht gespeichert.');
        return reply({ok:true,checked:results.length,results});
      }
      if(['chat','note','external'].includes(body.action)){
        const asset=await ownAsset(body.asset_id);if(body.manual_start!==true)throw new ReviewError('Nachricht ausdrücklich senden.',400);
        const content=String(body.message||'').trim();if(content.length<2||content.length>4000)throw new ReviewError('Nachricht mit 2 bis 4000 Zeichen eingeben.');
        const requestId=body.request_id||crypto.randomUUID();if(!uuid(requestId))throw new ReviewError('Anfragereferenz ungültig.');
        const review=await readReview(asset,body.review_id||asset.latest_review_id);if(!review)throw new ReviewError('Zuerst eine eigene Analyse öffnen.',404);
        return await withLease(asset,'chat',async token=>{
          const duplicate=result(await admin.from('investment_chat_messages').select('*').eq('user_id',userId).eq('request_id',requestId),'Chat nicht lesbar.')||[];
          if(duplicate.length){if(duplicate.some(m=>m.asset_id!==asset.id))throw new ReviewError('Nachrichtenreferenz gehört zu einem anderen Wertpapier.',409);return reply({ok:true,duplicate:true});}
          if(body.action!=='chat'){
            result(await admin.from('investment_chat_messages').insert({user_id:userId,asset_id:asset.id,review_id:review.id,request_id:requestId,role:body.action,content,provider:body.action==='external'?'external_unverified':'user'}),'Notiz nicht gespeichert.');return reply({ok:true});
          }
          const quota=await admin.rpc('reserve_investment_operation',{p_user_id:userId,p_kind:'chat'});let answer;
          try{
            if(quota.error||quota.data!==true)throw new ReviewError('V38-Chatlimit von 20 Antworten pro UTC-Tag erreicht.',429);
            const messages=result(await admin.from('investment_chat_messages').select('*').eq('user_id',userId).eq('asset_id',asset.id).order('sequence',{ascending:false}).limit(20),'Chatverlauf nicht erreichbar.')||[];
            answer=await callReviewChat({question:content,review,asset,messages:messages.reverse(),getEnv,fetchImpl,now:now()});
          }catch(e){answer={answer:e instanceof ReviewError?e.message:'Chat nicht verfügbar. Verlauf und Analyse bleiben erhalten.',provider:'none',is_error:true,evidence_ids:[]};}
          const committed=await admin.rpc('commit_investment_chat',{p_user_id:userId,p_asset_id:asset.id,p_token:token,p_request_id:requestId,p_review_id:review.id,p_content:content,p_answer:answer});
          if(committed.error)return reply({ok:true,saved:false,answer:{...answer,answer:answer.answer+'\nAntwort konnte nicht gespeichert werden. Vor dem Schließen kopieren.'}});
          return reply({ok:true,saved:true,answer});
        });
      }
      throw new ReviewError('Unbekannte Aktion.',400);
    }catch(e){return reply({ok:false,error:e instanceof ReviewError?e.message:'V38-Prüfung nicht abgeschlossen. Installation und Verbindung prüfen.'},e instanceof ReviewError?e.status:500);}
  };
}
