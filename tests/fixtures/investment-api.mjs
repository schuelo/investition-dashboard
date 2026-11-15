import {createInvestmentHandler} from '../../supabase/functions/_shared/investment-endpoint.mjs';
import {now} from './independent-market.mjs';
export const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
export function apiHarness({owner=alice,tables={},fetchImpl=async()=>{throw Error('Unexpected network');},env={},beforeQuery=null}={}){
  const db=structuredClone(tables),calls=[],rpcs=[],requests=[];let sequence=0;
  const stamp=()=>now.toISOString(),newId=()=>crypto.randomUUID();
  class Query{
    constructor(table){this.table=table;this.filters=[];this.orders=[];this.limitN=Infinity;this.mode='many';this.action='read';this.payload=null;this.options={};}
    select(){return this;}eq(k,v){this.filters.push(r=>r[k]===v);return this;}in(k,v){this.filters.push(r=>v.includes(r[k]));return this;}
    gte(k,v){this.filters.push(r=>r[k]>=v);return this;}lte(k,v){this.filters.push(r=>r[k]<=v);return this;}
    order(k,o={}){this.orders.push([k,o.ascending!==false]);return this;}limit(v){this.limitN=v;return this;}
    maybeSingle(){this.mode='one';return this;}single(){this.mode='required';return this;}
    insert(payload){this.action='insert';this.payload=payload;return this;}upsert(payload,options={}){this.action='upsert';this.payload=payload;this.options=options;return this;}
    update(payload){this.action='update';this.payload=payload;return this;}delete(){this.action='delete';return this;}
    async then(resolve,reject){try{if(beforeQuery)await beforeQuery(this);calls.push({table:this.table,action:this.action,filters:this.filters.length,payload:structuredClone(this.payload)});const rows=db[this.table]||=[];let matches=rows.filter(r=>this.filters.every(f=>f(r))),out=[];
      if(this.action==='insert'||this.action==='upsert'){
        const fields=(this.options.onConflict||'id').split(',');for(const item of Array.isArray(this.payload)?this.payload:[this.payload]){
          let existing=this.action==='upsert'?rows.find(r=>fields.every(k=>r[k]===item[k])):null;
          if(existing&&this.options.ignoreDuplicates)continue;
          if(existing)Object.assign(existing,structuredClone(item));else{existing={id:newId(),created_at:stamp(),state:{},next_check_at:stamp(),enabled:false,...structuredClone(item)};if(this.table==='investment_chat_messages')existing.sequence=++sequence;rows.push(existing);}out.push(existing);
        }
      }else if(this.action==='update'){for(const r of matches)Object.assign(r,structuredClone(this.payload));out=matches;}
      else if(this.action==='delete'){db[this.table]=rows.filter(r=>!matches.includes(r));out=matches;}
      else out=matches;
      out=[...out].sort((a,b)=>{for(const[k,asc]of this.orders){const v=a[k]<b[k]?-1:a[k]>b[k]?1:0;if(v)return asc?v:-v;}return 0;}).slice(0,this.limitN);
      const response=this.mode==='required'&&!out.length?{error:{message:'missing'},data:null}:{data:this.mode==='many'?structuredClone(out):structuredClone(out[0]||null),error:null};resolve(response);
    }catch(e){if(reject)reject(e);else throw e;}}
  }
  const admin={from:table=>new Query(table),rpc:async(name,p)=>{
    rpcs.push({name,p:structuredClone(p)});
    if(name==='claim_investment_operation'){
      const locks=db.investment_operation_locks||=[],old=locks.find(l=>l.user_id===p.p_user_id&&l.asset_id===p.p_asset_id&&l.kind===p.p_kind);if(old)return{data:false};locks.push({user_id:p.p_user_id,asset_id:p.p_asset_id,kind:p.p_kind,token:p.p_token});return{data:true};
    }
    if(name==='reserve_investment_operation'||name==='reserve_alphavantage_call'||name==='reserve_independent_data'||name==='reserve_hybrid_eodhd_calls')return{data:true};
    if(name==='commit_investment_review'){
      const asset=(db.investment_assets||[]).find(a=>a.id===p.p_asset_id&&a.user_id===p.p_user_id);if(!asset)return{error:{message:'foreign'}};
      const reviews=db.investment_reviews||=[];let row=reviews.find(r=>r.user_id===p.p_user_id&&r.request_id===p.p_request_id);
      if(!row&&asset.last_key===p.p_key)row=reviews.find(r=>r.id===asset.latest_review_id);
      if(!row){row={id:newId(),user_id:p.p_user_id,asset_id:asset.id,request_id:p.p_request_id,created_at:stamp(),snapshot:structuredClone(p.p_snapshot)};reviews.push(row);if(p.p_snapshot.decision.current)asset.analysis_at=p.p_snapshot.created_at;}
      asset.latest_review_id=row.id;asset.checked_at=stamp();asset.next_check_at='2026-11-08T09:30:00Z';asset.last_key=p.p_key;
      asset.state={price:p.p_snapshot.price,price_date:p.p_snapshot.price_date,provider:p.p_snapshot.provider,decision:p.p_snapshot.decision,news:p.p_snapshot.news,last_attempt:p.p_snapshot.attempt||asset.state.last_attempt,warnings:p.p_snapshot.warnings};return{data:row.id};
    }
    if(name==='commit_investment_chat'){
      const rows=db.investment_chat_messages||=[];for(const[role,content]of [['user',p.p_content],['assistant',p.p_answer.answer]])if(!rows.some(r=>r.user_id===p.p_user_id&&r.request_id===p.p_request_id&&r.role===role))rows.push({id:newId(),user_id:p.p_user_id,asset_id:p.p_asset_id,review_id:p.p_review_id,request_id:p.p_request_id,role,content,created_at:stamp(),sequence:++sequence,...(role==='assistant'?{provider:p.p_answer.provider,model:p.p_answer.model,is_error:p.p_answer.is_error,evidence_ids:p.p_answer.evidence_ids}:{})});return{data:null};
    }
    return{data:true};
  }};
  const settings={SUPABASE_URL:'https://project.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',CRON_SECRET:'private-cron-secret',...env};
  const createClient=(u,k)=>k==='service'?admin:{auth:{getUser:async()=>({data:{user:owner?{id:owner}:null},error:null})}};
  const handler=createInvestmentHandler({createClient,getEnv:k=>settings[k]||'',fetchImpl:async(...args)=>{requests.push(args);return fetchImpl(...args);},now:()=>now,parseRss:()=>[],getPage:async()=>{throw Error('No page');}});
  const post=async(body,{auth=true,secret=null}={})=>{const headers={'Content-Type':'application/json'};if(auth)headers.Authorization='Bearer user-token';if(secret)headers['x-cron-secret']=secret;const r=await handler(new Request('https://test/functions/v1/review-investments',{method:'POST',headers,body:JSON.stringify(body)}));return{status:r.status,body:await r.json()};};
  return {db,calls,rpcs,requests,post,handler,admin,settings};
}
