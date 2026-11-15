import {validateReviewInput,runInvestmentReview,ReviewError} from './investment-review.mjs';
import {acquireReviewMarket,reviewMarketAdapters} from './review-market.mjs';
import {callReviewChat} from './review-chat.mjs';
import {discoverFreeSources} from './deep-sources.mjs';
import {loadManualSources} from './manual-sources.mjs';
import {portfolioValues} from './portfolio-value.mjs';
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
      if(body.action==='capabilities'){const health=await admin.from('investment_monitor_health').select('last_run_at').eq('id',true).maybeSingle();return reply({ok:true,version:'39.1.0',features:['investment_review_v38','portfolio_monitor_v38','persistent_gemini_chat_v38','legacy_depot_v391','holding_editor_v391'],monitor_last_run:health.data?.last_run_at||null,alpha_configured:!!getEnv('ALPHAVANTAGE_API_KEY'),eodhd_configured:!!getEnv('EODHD_API_TOKEN'),chat_provider:'gemini',chat_configured:getEnv('DEEP_GEMINI_FREE_TIER_CONFIRMED')==='true'&&!!getEnv('GEMINI_API_KEY')});}
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
        const summary=portfolioValues(held,all,now());
        for(const g of summary.groups){
          if(g.positions===g.missing)continue;
          const fingerprint=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(g.components))))].map(v=>v.toString(16).padStart(2,'0')).join('');
          const {components,...value}=g;
          result(await admin.from('investment_portfolio_marks').upsert({user_id:owner,...value,fingerprint,recorded_at:now().toISOString()},{onConflict:'user_id,currency,fingerprint',ignoreDuplicates:true}),'V39-Bewertungstabelle fehlt.');
        }
        const marks=result(await admin.from('investment_portfolio_marks').select('*').eq('user_id',owner).order('recorded_at',{ascending:false}).limit(1000),'Depotverlauf nicht lesbar.')||[];
        return {...summary,marks:marks.filter(m=>m.user_id===owner).reverse()};
      };
      const optionalOverview=async(owner)=>{try{return {portfolio:await portfolioOverview(owner)};}catch(e){return {portfolio:null,portfolio_warning:e instanceof ReviewError?e.message:'Depotbewertung nicht verfügbar. Die Wertpapierliste bleibt nutzbar.'};}};
      const withLease=async(asset,kind,fn)=>{
        const token=crypto.randomUUID(),q=await admin.rpc('claim_investment_operation',{p_user_id:asset.user_id,p_asset_id:asset.id,p_kind:kind,p_token:token});
        if(q.error)throw new ReviewError('V38-Sperrfunktion fehlt oder ist nicht erreichbar.',503);if(q.data!==true)throw new ReviewError('Für diesen Wert läuft bereits eine '+(kind==='chat'?'Chatantwort':'Prüfung')+'.',409);
        try{return await fn(token);}finally{await admin.from('investment_operation_locks').delete().eq('user_id',asset.user_id).eq('asset_id',asset.id).eq('kind',kind).eq('token',token);}
      };
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
          loadMarket:async()=>{market=await acquireReviewMarket(input,adapters,now());if(!scheduled&&market?.bars?.length){const quota=await admin.rpc('reserve_investment_operation',{p_user_id:asset.user_id,p_kind:'review'});if(quota.error||quota.data!==true)throw new ReviewError('Manuelles V38-Prüflimit erreicht. Bereits gespeicherten Bericht öffnen.',429);}return market;},
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
      if(body.action==='sync_portfolio'){const unmapped=await sync(userId);return reply({ok:true,unmapped,...await optionalOverview(userId)});}
      if(body.action==='portfolio_overview')return reply({ok:true,...await optionalOverview(userId)});
      if(body.action==='get_holdings'){
        const asset=await ownAsset(body.asset_id),all=(await positions(userId)).filter(p=>p.symbol===asset.symbol&&p.currency===asset.currency);
        return reply({ok:true,positions:all.filter(isEquity).map(p=>({id:p.id,trade_id:p.trade_id,position_origin:p.position_origin,quantity:p.quantity,average_entry_price:p.average_entry_price,direction:p.direction,instrument_type:p.instrument_type})),legacy_trade_ids:asset.legacy_trade_ids||[]});
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
        const patch={watchlisted:body.watchlisted,...(!asset.is_portfolio?{enabled:body.watchlisted,next_check_at:now().toISOString()}: {})};
        result(await admin.from('investment_assets').update(patch).eq('id',asset.id).eq('user_id',userId),'Beobachtung nicht gespeichert. V39-SQL installieren.');return reply({ok:true,asset:{...asset,...patch}});
      }
      if(body.action==='remember'){
        if(body.manual_start!==true)throw new ReviewError('Wert ausdrücklich merken.',400);
        const input=validateReviewInput({symbol:body.symbol,currency:body.currency,company:body.company,wkn:body.wkn,isin:body.isin,source:'stored'}),asset=await register(input);
        const patch={watchlisted:true,...(!asset.is_portfolio?{enabled:true,next_check_at:now().toISOString()}: {})};
        result(await admin.from('investment_assets').update(patch).eq('id',asset.id).eq('user_id',userId),'Wert nicht zur Beobachtung gespeichert. V39-SQL prüfen.');return reply({ok:true,asset:{...asset,...patch}});
      }
      if(body.action==='set_monitoring'){
        const asset=await ownAsset(body.asset_id);if(typeof body.enabled!=='boolean')throw new ReviewError('Überwachungsstatus ungültig.');
        result(await admin.from('investment_assets').update({enabled:body.enabled,next_check_at:now().toISOString()}).eq('id',asset.id).eq('user_id',userId),'Überwachung nicht gespeichert.');return reply({ok:true});
      }
      if(body.action==='analyze'||body.action==='save_config'){
        if(body.manual_start!==true)throw new ReviewError('Prüfung ausdrücklich manuell starten.',400);
        const input=validateReviewInput(body);if(body.asset_id){const old=await ownAsset(body.asset_id);if(old.symbol!==input.symbol||old.currency!==input.currency)throw new ReviewError('Gespeichertes Wertpapier und Formular passen nicht zusammen. Neuen Wert separat prüfen.');}
        if(body.request_id&&!uuid(body.request_id))throw new ReviewError('Anfragereferenz ungültig.');
        const asset=await register(input);
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
        assets.sort((a,b)=>(Date.parse(feedAges.find(c=>c.asset_id===a.id&&c.user_id===a.user_id)?.attempted_at)||0)-(Date.parse(feedAges.find(c=>c.asset_id===b.id&&c.user_id===b.user_id)?.attempted_at)||0));
        for(const asset of assets){try{const config=validateReviewInput({...asset.config,symbol:asset.symbol,currency:asset.currency,company:asset.company,research:false,manual_urls:[]});const r=await reviewOne(asset,config,{scheduled:true});results.push({asset_id:asset.id,saved:r.saved});}catch(e){results.push({asset_id:asset.id,error:e instanceof ReviewError?e.message:'Prüfung nicht abgeschlossen.'});}}
        for(const owner of [...new Set(assets.map(a=>a.user_id))]){try{await portfolioOverview(owner);}catch{results.push({error:'Depotverlauf konnte nicht aktualisiert werden; Einzelberichte bleiben erhalten.'});}}
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
