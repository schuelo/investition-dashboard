import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite(),read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8'),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';let checks=0;
const check=(v,msg)=>{assert.ok(v,msg);checks++;};const scalar=async(sql,p=[])=>Object.values((await db.query(sql,p)).rows[0])[0];
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;insert into auth.users values('${a}'),('${b}');`);
 await db.exec(read('setup-v38-investment-review.sql'));
 const x=await scalar('insert into investment_assets(user_id,symbol,currency) values($1,\'A.XETRA\',\'EUR\') returning id',[a]),y=await scalar('insert into investment_assets(user_id,symbol,currency,is_portfolio) values($1,\'B.US\',\'USD\',true) returning id',[b]);
 await db.exec(read('setup-v39-direct.sql'));check(await scalar('select watchlisted from investment_assets where id=$1',[x]),'Existing non-held analyses appear in observation');check(await scalar('select not watchlisted from investment_assets where id=$1',[y]),'Depot membership stays separate');
 await db.query('update investment_assets set watchlisted=false where id=$1',[x]);await db.exec(read('setup-v39-direct.sql'));check(await scalar('select not watchlisted from investment_assets where id=$1',[x]),'Repeated migration preserves an explicit unfollow');
 await db.query("insert into investment_portfolio_marks(user_id,currency,amount,positions,price_dates,fingerprint) values($1,'EUR',100,1,'[]','a'),($2,'USD',200,1,'[]','b')",[a,b]);
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);`);check(await scalar('select count(*)::int from investment_portfolio_marks')===1,'Only own value history is visible');
 await assert.rejects(()=>db.query("insert into investment_portfolio_marks(user_id,currency,amount,positions,price_dates,fingerprint) values($1,'EUR',999,1,'[]','fake')",[a]),/permission denied/);checks++;
 await assert.rejects(()=>db.query('update investment_assets set watchlisted=true where id=$1',[x]),/permission denied/);checks++;
 check(await scalar("select has_table_privilege(current_user,'investment_portfolio_marks','DELETE')")===false,'Clients cannot erase old valuations');
 check(await scalar("select has_table_privilege(current_user,'investment_news_cache','SELECT')")===false,'Targeted search caches are server-only');
 await db.exec('reset role;set role service_role;');
 check(await scalar("select count(*)::int from investment_portfolio_marks")===2,'Server may record owner-scoped valuations');
 const token=crypto.randomUUID();check(await scalar("select claim_investment_operation($1,$2,'review',$3)",[a,x,token]),'V38 lease remains valid after table extension');
 const snapshot={created_at:'2026-11-15T10:00:00Z',price:100,price_date:'2026-11-13',decision:{current:true},analysis:{chart:{price:100}},news:{assessment:{status:'risk',checked_at:'2026-11-15T10:00:00Z'}},provider:'CSV',quote:{code:'current'}};
 const id=await scalar('select commit_investment_review($1,$2,$3,$4,$5::jsonb,$6)',[a,x,token,crypto.randomUUID(),JSON.stringify(snapshot),'news-risk']);check(!!id,'Existing immutable commit works with V39 row type');check(await scalar("select state->'news'->'assessment'->>'status' from investment_assets where id=$1",[x])==='risk','News assessment persists in the existing owner-scoped state');
 console.log('V39 SQL: '+checks+' checks passed in PostgreSQL/PGlite; no external access.');
}finally{await db.close();}
