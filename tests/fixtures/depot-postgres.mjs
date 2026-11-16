import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {createInvestmentHandler} from '../../supabase/functions/_shared/investment-endpoint.mjs';
import {alice,bob} from './investment-api.mjs';import {now} from './independent-market.mjs';
export async function createDepotDatabase({withV392=true}={}){
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;
   insert into auth.users values('${alice}'),('${bob}');
   create table trade_plans(id uuid primary key,user_id uuid not null references auth.users(id),name text not null,symbol text not null,market_symbol text,currency text,instrument_type text,direction text,status text,quantity numeric,monitoring_enabled boolean not null default false,stop_price numeric,target1 numeric,wkn text,isin text,unique(id,user_id));
   create table depot_positions(id uuid primary key,user_id uuid not null references auth.users(id),trade_id uuid,name text,symbol text,currency text,is_open boolean,foreign key(trade_id,user_id) references trade_plans(id,user_id));
   grant all on trade_plans,depot_positions to service_role;`);
  for(const file of ['setup-v38-investment-review.sql','setup-v39-direct.sql','setup-v39-1-depotfix.sql',...(withV392?['setup-v39-2-depot.sql']:[])]){
   try{await db.exec(readFileSync(new URL('../../'+file,import.meta.url),'utf8'));}catch(e){throw Error(file+': '+e.message);}
  }
  return db;
 }catch(error){await db.close();throw error;}
}
const identifier=value=>{if(!/^[a-z_][a-z0-9_]*$/.test(value))throw Error('Invalid SQL identifier');return '"'+value+'"';};
const normalize=(v,key='')=>v instanceof Date?v.toISOString().slice(0,key==='entry_date'?10:undefined):Array.isArray(v)?v.map(x=>normalize(x)):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,normalize(x,k)])):typeof v==='bigint'?Number(v):v;
export async function postgresDepotApi(options={}){
 const db=await createDepotDatabase(options),calls=[],rpcs=[],requests=[];let owner=options.owner||alice;
 const encode=(key,value)=>key==='legacy_trade_ids'&&Array.isArray(value)?'{'+value.join(',')+'}':value!==null&&typeof value==='object'?JSON.stringify(value):value;
 class Query{
  constructor(table){this.table=table;this.filters=[];this.orders=[];this.action='read';this.fields='*';this.payload=null;this.limitN=null;this.mode='many';this.options={};}
  select(fields='*'){this.fields=fields;return this;}eq(k,v){this.filters.push([k,'=',v]);return this;}gte(k,v){this.filters.push([k,'>=',v]);return this;}lte(k,v){this.filters.push([k,'<=',v]);return this;}in(k,v){this.filters.push([k,'in',v]);return this;}
  order(k,o={}){this.orders.push([k,o.ascending===false?'desc':'asc']);return this;}limit(n){this.limitN=n;return this;}maybeSingle(){this.mode='one';return this;}single(){this.mode='required';return this;}
  insert(v){this.action='insert';this.payload=v;return this;}upsert(v,o={}){this.action='upsert';this.payload=v;this.options=o;return this;}update(v){this.action='update';this.payload=v;return this;}delete(){this.action='delete';return this;}
  then(resolve,reject){return this.execute().then(resolve,reject);}
  async execute(){
   calls.push({table:this.table,action:this.action,payload:structuredClone(this.payload)});
   try{
    const params=[],bind=(k,v)=>{params.push(encode(k,v));return '$'+params.length;};let sql,rows=[];
    const where=()=>this.filters.length?' where '+this.filters.map(([k,op,v])=>op==='in'?(v.length?identifier(k)+' in ('+v.map(x=>bind(k,x)).join(',')+')':'false'):identifier(k)+op+bind(k,v)).join(' and '):'';
    if(this.action==='insert'||this.action==='upsert'){
     for(const value of Array.isArray(this.payload)?this.payload:[this.payload]){
      params.length=0;const keys=Object.keys(value);sql='insert into '+identifier(this.table)+' ('+keys.map(identifier).join(',')+') values ('+keys.map(k=>bind(k,value[k])).join(',')+')';
      if(this.action==='upsert'){const conflict=(this.options.onConflict||'id').split(',');sql+=' on conflict ('+conflict.map(identifier).join(',')+') '+(this.options.ignoreDuplicates?'do nothing':'do update set '+keys.filter(k=>!conflict.includes(k)).map(k=>identifier(k)+'=excluded.'+identifier(k)).join(','));}
      rows.push(...(await db.query(sql+' returning *',params)).rows);
     }
    }else{
     if(this.action==='update')sql='update '+identifier(this.table)+' set '+Object.keys(this.payload).map(k=>identifier(k)+'='+bind(k,this.payload[k])).join(',')+where()+' returning *';
     else if(this.action==='delete')sql='delete from '+identifier(this.table)+where()+' returning *';
     else sql='select '+(this.fields==='*'?'*':this.fields.split(',').map(identifier).join(','))+' from '+identifier(this.table)+where()+(this.orders.length?' order by '+this.orders.map(([k,d])=>identifier(k)+' '+d).join(','):'')+(this.limitN!==null?' limit '+Number(this.limitN):'');
     rows=(await db.query(sql,params)).rows;
    }
    if(this.mode==='required'&&rows.length!==1)return {data:null,error:{message:'Expected exactly one row'}};
    return {data:normalize(this.mode==='many'?rows:rows[0]||null),error:null};
   }catch(error){return {data:null,error:{message:error.message,code:error.code}};}
  }
 }
 const admin={from:t=>new Query(t),rpc:async(name,p)=>{
  rpcs.push({name,p:structuredClone(p)});
  try{const keys=Object.keys(p),result=await db.query('select '+identifier(name)+'('+keys.map((k,i)=>identifier(k)+'=> $'+(i+1)).join(',')+') as result',keys.map(k=>encode(k,p[k])));return {data:normalize(result.rows[0].result),error:null};}
  catch(error){return {data:null,error:{message:error.message,code:error.code}};}
 }};
 const env={SUPABASE_URL:'https://project.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',CRON_SECRET:'private-cron-secret'};
 const handler=createInvestmentHandler({createClient:(u,k)=>k==='service'?admin:{auth:{getUser:async()=>({data:{user:owner?{id:owner}:null}})}},getEnv:k=>env[k]||'',now:()=>now,parseRss:()=>[],getPage:async()=>{throw Error('Unexpected article request');},fetchImpl:async(...args)=>{requests.push(args);throw Error('Unexpected market-provider request');}});
 const post=async(body,{auth=true}={})=>{const r=await handler(new Request('https://test/review-investments',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer user'}:{})},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()};};
 return {db,admin,post,handler,calls,rpcs,requests,setOwner:value=>owner=value,close:()=>db.close()};
}
