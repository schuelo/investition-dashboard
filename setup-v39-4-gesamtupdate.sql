-- V39.4.0 additive update of an existing installation. Preserves data and schedules.
-- setup-v39-4-gesamtupdate.sql; not a bootstrap of an empty database.
begin;

-- setup-v32-deep-analysis.sql
-- Additive V32. Run after both V31 SQL files. Existing tables, RPCs and schedules remain unchanged.

create table if not exists public.deep_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  currency text not null,
  horizon_days integer not null check (horizon_days in (5,20,60,120,252)),
  lookback_days integer not null,
  news_days integer not null,
  ai_mode text not null check (ai_mode in ('ai','rules')),
  raw_result jsonb not null,
  created_at timestamptz not null default now(),
  unique(id,user_id)
);
create index if not exists deep_analyses_owner_time on public.deep_analyses(user_id,created_at desc);
create index if not exists deep_analyses_owner_symbol on public.deep_analyses(user_id,symbol,created_at desc);
create table if not exists public.deep_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  source_key text not null,
  canonical_url text not null,
  title text not null,
  kind text not null,
  snapshot jsonb not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(user_id,symbol,canonical_url)
);
create index if not exists deep_sources_owner_symbol on public.deep_sources(user_id,symbol,last_seen_at desc);
create table if not exists public.deep_analysis_notes (
  analysis_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  note text not null default '' check (length(note)<=4000),
  updated_at timestamptz not null default now(),
  foreign key(analysis_id,user_id) references public.deep_analyses(id,user_id) on delete cascade
);
create table if not exists public.deep_evaluations (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  result jsonb not null,
  evaluated_at timestamptz not null default now(),
  foreign key(analysis_id,user_id) references public.deep_analyses(id,user_id) on delete cascade
);
create index if not exists deep_evaluations_owner_analysis on public.deep_evaluations(user_id,analysis_id,evaluated_at desc);
alter table public.deep_analyses enable row level security;
alter table public.deep_sources enable row level security;
alter table public.deep_analysis_notes enable row level security;
alter table public.deep_evaluations enable row level security;
drop policy if exists deep_analyses_read on public.deep_analyses;
create policy deep_analyses_read on public.deep_analyses for select to authenticated using(user_id=auth.uid());
drop policy if exists deep_sources_read on public.deep_sources;
create policy deep_sources_read on public.deep_sources for select to authenticated using(user_id=auth.uid());
drop policy if exists deep_evaluations_read on public.deep_evaluations;
create policy deep_evaluations_read on public.deep_evaluations for select to authenticated using(user_id=auth.uid());
drop policy if exists deep_notes_read on public.deep_analysis_notes;
create policy deep_notes_read on public.deep_analysis_notes for select to authenticated using(user_id=auth.uid());
drop policy if exists deep_notes_insert on public.deep_analysis_notes;
create policy deep_notes_insert on public.deep_analysis_notes for insert to authenticated with check(user_id=auth.uid());
drop policy if exists deep_notes_update on public.deep_analysis_notes;
create policy deep_notes_update on public.deep_analysis_notes for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on public.deep_analyses,public.deep_sources,public.deep_analysis_notes,public.deep_evaluations from anon,authenticated;
grant select on public.deep_analyses,public.deep_sources,public.deep_evaluations to authenticated;
grant select,insert,update on public.deep_analysis_notes to authenticated;
grant all on public.deep_analyses,public.deep_sources,public.deep_analysis_notes,public.deep_evaluations to service_role;

-- Reject edits to immutable forecasts even by a future server adapter.
create or replace function public.deep_analysis_immutable()
returns trigger language plpgsql set search_path=public as $$
begin
  raise exception 'V32 original forecasts are immutable; create a new analysis or a separate note/evaluation.';
end;
$$;
drop trigger if exists deep_analysis_no_update on public.deep_analyses;
create trigger deep_analysis_no_update before update on public.deep_analyses for each row execute function public.deep_analysis_immutable();
revoke all on function public.deep_analysis_immutable() from public,anon,authenticated;

-- Separate bounded allowance for manual outcome checks; no new cron or AI calls.
create table if not exists public.deep_evaluation_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  runs integer not null check(runs between 0 and 20),
  primary key(user_id,usage_date)
);
alter table public.deep_evaluation_usage enable row level security;
revoke all on public.deep_evaluation_usage from anon,authenticated;
grant all on public.deep_evaluation_usage to service_role;
create or replace function public.reserve_deep_evaluation(p_user_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare allowed boolean;
begin
  insert into public.deep_evaluation_usage(user_id,usage_date,runs)
  values(p_user_id,(now() at time zone 'utc')::date,1)
  on conflict(user_id,usage_date) do update set runs=deep_evaluation_usage.runs+1
  where deep_evaluation_usage.runs<20 returning true into allowed;
  return coalesce(allowed,false);
end;
$$;
revoke all on function public.reserve_deep_evaluation(uuid) from public,anon,authenticated;
grant execute on function public.reserve_deep_evaluation(uuid) to service_role;

-- setup-v33-paperdepot.sql
-- V33 additive only. Run once in Supabase SQL Editor after V32.

create table if not exists public.paper_portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  config jsonb not null,
  state jsonb not null,
  version integer not null default 0,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id)
);
create table if not exists public.paper_events (
  id bigint generated always as identity primary key,
  portfolio_id uuid not null,
  user_id uuid not null,
  event_key text not null,
  event jsonb not null,
  foreign key(portfolio_id,user_id) references public.paper_portfolios(id,user_id) on delete cascade,
  unique(portfolio_id,event_key)
);
create table if not exists public.paper_nav (
  portfolio_id uuid not null,
  user_id uuid not null,
  date date not null,
  accounts jsonb not null,
  primary key(portfolio_id,date),
  foreign key(portfolio_id,user_id) references public.paper_portfolios(id,user_id) on delete cascade
);
alter table public.paper_portfolios enable row level security;
alter table public.paper_events enable row level security;
alter table public.paper_nav enable row level security;
drop policy if exists paper_owner_read on public.paper_portfolios;
create policy paper_owner_read on public.paper_portfolios for select to authenticated using(user_id=auth.uid());
drop policy if exists paper_owner_read on public.paper_events;
create policy paper_owner_read on public.paper_events for select to authenticated using(user_id=auth.uid());
drop policy if exists paper_owner_read on public.paper_nav;
create policy paper_owner_read on public.paper_nav for select to authenticated using(user_id=auth.uid());
revoke all on public.paper_portfolios,public.paper_events,public.paper_nav from anon,authenticated;
grant select on public.paper_portfolios,public.paper_events,public.paper_nav to authenticated;
grant all on public.paper_portfolios,public.paper_events,public.paper_nav to service_role;
grant usage,select on sequence public.paper_events_id_seq to service_role;

-- One atomic compare-and-swap transaction: a conflicting update cannot book twice.
create or replace function public.commit_paper_portfolio(p_user_id uuid,p_id uuid,p_version integer,p_config jsonb,p_state jsonb,p_events jsonb,p_nav jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.paper_portfolios; item jsonb; account jsonb;
begin
  if p_state is null or jsonb_typeof(p_state->'accounts') is distinct from 'object' or jsonb_array_length(p_events)>5000 or jsonb_array_length(p_nav)>100 then raise exception 'Invalid paper result'; end if;
  for account in select value from jsonb_each(p_state->'accounts') loop
    if (account->>'cash')::numeric < -0.00001 then raise exception 'Negative paper cash'; end if;
  end loop;
  if p_id is null then
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,33));
    if (select count(*) from public.paper_portfolios where user_id=p_user_id)>=10 then raise exception 'Maximal 10 Experimente; vorhandenes Experiment auswählen'; end if;
    insert into public.paper_portfolios(user_id,config,state) values(p_user_id,p_config,p_state) returning * into r;
  else
    select * into r from public.paper_portfolios where id=p_id and user_id=p_user_id for update;
    if not found or r.version<>p_version or r.paused or r.config<>p_config then raise exception 'Experiment pausiert oder parallel aktualisiert. Neu laden'; end if;
    update public.paper_portfolios set state=p_state,version=version+1,updated_at=now() where id=r.id;
  end if;
  for item in select value from jsonb_array_elements(p_events) loop
    insert into public.paper_events(portfolio_id,user_id,event_key,event) values(r.id,p_user_id,item->>'event_key',item);
  end loop;
  for item in select value from jsonb_array_elements(p_nav) loop
    insert into public.paper_nav(portfolio_id,user_id,date,accounts) values(r.id,p_user_id,(item->>'date')::date,item->'accounts');
  end loop;
  return r.id;
end $$;
revoke all on function public.commit_paper_portfolio(uuid,uuid,integer,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_paper_portfolio(uuid,uuid,integer,jsonb,jsonb,jsonb,jsonb) to service_role;

-- setup-v35-wkn.sql
-- V35: owner-scoped reference-data cache; no real portfolio writes or new schedules.

create table if not exists public.security_lookup_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  lookup_key text not null check(length(lookup_key)<=40),
  result jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key(user_id,lookup_key)
);
create table if not exists public.security_lookup_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  runs integer not null check(runs between 1 and 20),
  last_started_at timestamptz not null default now(),
  primary key(user_id,usage_date)
);
alter table public.security_lookup_cache enable row level security;
alter table public.security_lookup_usage enable row level security;
drop policy if exists security_cache_owner_read on public.security_lookup_cache;
create policy security_cache_owner_read on public.security_lookup_cache for select to authenticated using(user_id=auth.uid());
revoke all on public.security_lookup_cache,public.security_lookup_usage from public,anon,authenticated;
grant select on public.security_lookup_cache to authenticated;
grant all on public.security_lookup_cache,public.security_lookup_usage to service_role;
create or replace function public.reserve_security_lookup(p_user_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare allowed boolean;
begin
  insert into public.security_lookup_usage(user_id,usage_date,runs,last_started_at)
  values(p_user_id,(now() at time zone 'utc')::date,1,now())
  on conflict(user_id,usage_date) do update set runs=security_lookup_usage.runs+1,last_started_at=now()
  where security_lookup_usage.runs<20 and security_lookup_usage.last_started_at < now()-interval '3 seconds'
  returning true into allowed;
  return coalesce(allowed,false);
end $$;
revoke all on function public.reserve_security_lookup(uuid) from public,anon,authenticated;
grant execute on function public.reserve_security_lookup(uuid) to service_role;

-- setup-v36-independent.sql
-- Independent lookup/chart budgets and private public-chart cache. No EODHD counter is changed.

create table if not exists public.independent_market_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null check(length(cache_key)<=70),
  result jsonb not null,
  updated_at timestamptz not null default now(),
  primary key(user_id,cache_key)
);
create table if not exists public.independent_data_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  kind text not null check(kind in ('lookup','chart')),
  runs integer not null check(runs between 1 and 40),
  primary key(user_id,usage_date,kind)
);
alter table public.independent_market_cache enable row level security;
alter table public.independent_data_usage enable row level security;
drop policy if exists independent_market_owner_read on public.independent_market_cache;
create policy independent_market_owner_read on public.independent_market_cache for select to authenticated using(user_id=auth.uid());
revoke all on public.independent_market_cache,public.independent_data_usage from public,anon,authenticated;
grant select on public.independent_market_cache to authenticated;
grant all on public.independent_market_cache,public.independent_data_usage to service_role;
create or replace function public.reserve_independent_data(p_user_id uuid,p_kind text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare allowed boolean;
begin
  if p_kind not in ('lookup','chart') then return false; end if;
  insert into public.independent_data_usage(user_id,usage_date,kind,runs)
  values(p_user_id,(now() at time zone 'utc')::date,p_kind,1)
  on conflict(user_id,usage_date,kind) do update set runs=independent_data_usage.runs+1
  where independent_data_usage.runs<40 returning true into allowed;
  return coalesce(allowed,false);
end $$;
revoke all on function public.reserve_independent_data(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_independent_data(uuid,text) to service_role;

-- setup-v38-investment-review.sql
-- Additive V38 upgrade from a working V36/V37. Existing depot, cron and alerts are preserved.

create table if not exists public.investment_assets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 symbol text not null, currency text not null, company text not null default '', config jsonb not null default '{}',
 enabled boolean not null default false, is_portfolio boolean not null default false,
 state jsonb not null default '{}', latest_review_id uuid, analysis_at timestamptz, checked_at timestamptz,
 next_check_at timestamptz not null default now(), last_key text, created_at timestamptz not null default now(),
 unique(user_id,symbol,currency), unique(id,user_id)
);
create table if not exists public.investment_reviews (
 id uuid primary key default gen_random_uuid(), user_id uuid not null, asset_id uuid not null,
 request_id uuid not null, created_at timestamptz not null default now(), snapshot jsonb not null,
 foreign key(asset_id,user_id) references public.investment_assets(id,user_id) on delete cascade,
 unique(user_id,request_id), unique(id,asset_id,user_id)
);
create table if not exists public.investment_position_links (
 user_id uuid not null references auth.users(id) on delete cascade,position_id uuid not null,asset_id uuid not null,
 primary key(user_id,position_id),foreign key(asset_id,user_id) references public.investment_assets(id,user_id) on delete cascade
);
create table if not exists public.investment_monitor_health (
 id boolean primary key default true check(id),last_run_at timestamptz not null,checked integer not null default 0
);
alter table public.investment_monitor_health enable row level security;
revoke all on public.investment_monitor_health from public,anon,authenticated;
grant all on public.investment_monitor_health to service_role;
create table if not exists public.investment_market_cache (
 user_id uuid not null references auth.users(id) on delete cascade,symbol text not null,currency text not null,
 source text not null check(source in ('stored','csv','alphavantage','eodhd','independent')),
 snapshot jsonb not null,updated_at timestamptz not null default now(),primary key(user_id,symbol,currency,source)
);
create table if not exists public.investment_operation_locks (
 user_id uuid not null,asset_id uuid not null,kind text not null check(kind in ('review','chat')),
 token uuid not null,expires_at timestamptz not null,
 primary key(user_id,asset_id,kind),foreign key(asset_id,user_id) references public.investment_assets(id,user_id) on delete cascade
);
create table if not exists public.investment_review_usage (
 user_id uuid not null references auth.users(id) on delete cascade,usage_date date not null,kind text not null,
 runs integer not null,primary key(user_id,usage_date,kind)
);
create table if not exists public.investment_chat_messages (
 id uuid primary key default gen_random_uuid(),sequence bigint generated always as identity,user_id uuid not null,asset_id uuid not null,review_id uuid,
 request_id uuid not null,role text not null check(role in ('user','assistant','note','external')),
 content text not null check(length(content) between 1 and 12000),provider text not null default 'none',
 model text,evidence_ids jsonb not null default '[]',is_error boolean not null default false,created_at timestamptz not null default now(),
 foreign key(asset_id,user_id) references public.investment_assets(id,user_id) on delete cascade,
 foreign key(review_id,asset_id,user_id) references public.investment_reviews(id,asset_id,user_id),unique(user_id,request_id,role)
);
create index if not exists investment_reviews_owner_asset on public.investment_reviews(user_id,asset_id,created_at desc);
create index if not exists investment_chat_owner_asset on public.investment_chat_messages(user_id,asset_id,created_at);
create index if not exists investment_assets_due on public.investment_assets(next_check_at) where enabled;
do $$ declare t text; begin
 foreach t in array array['investment_assets','investment_reviews','investment_position_links','investment_market_cache','investment_operation_locks','investment_review_usage','investment_chat_messages'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 foreach t in array array['investment_assets','investment_reviews','investment_chat_messages'] loop
  execute format('drop policy if exists investment_owner_read on public.%I',t);
  execute format('create policy investment_owner_read on public.%I for select to authenticated using(user_id=auth.uid())',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create or replace function public.claim_investment_operation(p_user_id uuid,p_asset_id uuid,p_kind text,p_token uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare allowed boolean;
begin
 if p_kind not in ('review','chat') or not exists(select 1 from investment_assets where id=p_asset_id and user_id=p_user_id) then return false;end if;
 insert into investment_operation_locks(user_id,asset_id,kind,token,expires_at)
 values(p_user_id,p_asset_id,p_kind,p_token,now()+interval '2 minutes')
 on conflict(user_id,asset_id,kind) do update set token=excluded.token,expires_at=excluded.expires_at
 where investment_operation_locks.expires_at<now() returning true into allowed;
 return coalesce(allowed,false);
end $$;
create or replace function public.reserve_investment_operation(p_user_id uuid,p_kind text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare allowed boolean; maximum integer;
begin
 maximum=case p_kind when 'review' then 40 when 'chat' then 20 else 0 end;
 if maximum=0 then return false;end if;
 insert into investment_review_usage(user_id,usage_date,kind,runs) values(p_user_id,(now() at time zone 'utc')::date,p_kind,1)
 on conflict(user_id,usage_date,kind) do update set runs=investment_review_usage.runs+1
 where investment_review_usage.runs<maximum returning true into allowed;
 return coalesce(allowed,false);
end $$;
create or replace function public.commit_investment_review(p_user_id uuid,p_asset_id uuid,p_token uuid,p_request_id uuid,p_snapshot jsonb,p_key text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare a investment_assets; rid uuid; stamp timestamptz;
begin
 select * into a from investment_assets where id=p_asset_id and user_id=p_user_id for update;
 if a.id is null or not exists(select 1 from investment_operation_locks where user_id=p_user_id and asset_id=p_asset_id and kind='review' and token=p_token and expires_at>now()) then raise exception 'Review lease expired';end if;
 select id into rid from investment_reviews where user_id=p_user_id and request_id=p_request_id;
 if rid is not null then return rid;end if;
 rid=a.latest_review_id;stamp=a.analysis_at;
 if a.last_key is distinct from p_key or rid is null then
  insert into investment_reviews(user_id,asset_id,request_id,snapshot) values(p_user_id,p_asset_id,p_request_id,p_snapshot) returning id into rid;
  if p_snapshot->'decision'->>'current'='true' and p_snapshot->'analysis' is not null and p_snapshot->'analysis'<>'null'::jsonb then stamp=(p_snapshot->>'created_at')::timestamptz;end if;
 end if;
 update investment_assets set latest_review_id=rid,analysis_at=stamp,checked_at=now(),next_check_at=now()+interval '30 minutes',last_key=p_key,
 state=jsonb_build_object('price',coalesce(nullif(p_snapshot->'price','null'::jsonb),a.state->'price'),
 'price_date',case when p_snapshot->>'price' is not null then p_snapshot->'price_date' else a.state->'price_date' end,
 'provider',case when p_snapshot->>'price' is not null then p_snapshot->'provider' else a.state->'provider' end,'quote',p_snapshot->'quote',
 'decision',p_snapshot->'decision','news',p_snapshot->'news','last_attempt',coalesce(nullif(p_snapshot->'attempt','null'::jsonb),a.state->'last_attempt'),'warnings',p_snapshot->'warnings')
 where id=p_asset_id and user_id=p_user_id;
 return rid;
end $$;
create or replace function public.commit_investment_chat(p_user_id uuid,p_asset_id uuid,p_token uuid,p_request_id uuid,p_review_id uuid,p_content text,p_answer jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from investment_operation_locks where user_id=p_user_id and asset_id=p_asset_id and kind='chat' and token=p_token and expires_at>now()) then raise exception 'Chat lease expired';end if;
 if p_review_id is not null and not exists(select 1 from investment_reviews where id=p_review_id and asset_id=p_asset_id and user_id=p_user_id) then raise exception 'Foreign review';end if;
 insert into investment_chat_messages(user_id,asset_id,review_id,request_id,role,content) values(p_user_id,p_asset_id,p_review_id,p_request_id,'user',p_content) on conflict(user_id,request_id,role) do nothing;
 insert into investment_chat_messages(user_id,asset_id,review_id,request_id,role,content,provider,model,evidence_ids,is_error)
 values(p_user_id,p_asset_id,p_review_id,p_request_id,'assistant',p_answer->>'answer',coalesce(p_answer->>'provider','none'),p_answer->>'model',coalesce(p_answer->'evidence_ids','[]'::jsonb),coalesce((p_answer->>'is_error')::boolean,false)) on conflict(user_id,request_id,role) do nothing;
end $$;
revoke all on function public.claim_investment_operation(uuid,uuid,text,uuid),public.reserve_investment_operation(uuid,text),public.commit_investment_review(uuid,uuid,uuid,uuid,jsonb,text),public.commit_investment_chat(uuid,uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_investment_operation(uuid,uuid,text,uuid),public.reserve_investment_operation(uuid,text),public.commit_investment_review(uuid,uuid,uuid,uuid,jsonb,text),public.commit_investment_chat(uuid,uuid,uuid,uuid,uuid,text,jsonb) to service_role;
-- Global protection for the additional Alpha Vantage key; never pooled with EODHD.
create table if not exists public.alphavantage_data_usage(usage_date date primary key,runs integer not null check(runs between 1 and 25));
alter table public.alphavantage_data_usage enable row level security;
revoke all on public.alphavantage_data_usage from public,anon,authenticated;
grant all on public.alphavantage_data_usage to service_role;
create or replace function public.reserve_alphavantage_call(p_calls integer default 1)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare allowed boolean;
begin
 if p_calls is null or p_calls<>1 then return false;end if;
 insert into alphavantage_data_usage(usage_date,runs) values((now() at time zone 'utc')::date,1)
 on conflict(usage_date) do update set runs=alphavantage_data_usage.runs+1 where alphavantage_data_usage.runs<25 returning true into allowed;
 return coalesce(allowed,false);
end $$;
revoke all on function public.reserve_alphavantage_call(integer) from public,anon,authenticated;
grant execute on function public.reserve_alphavantage_call(integer) to service_role;

-- setup-v39-direct.sql
-- V39 additive upgrade after setup-v38-investment-review.sql.
-- Existing reports/messages and the V38 cron job are retained.

do $$
begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='investment_assets' and column_name='watchlisted') then
  alter table public.investment_assets add column watchlisted boolean not null default false;
  update public.investment_assets set watchlisted=true where not is_portfolio;
 end if;
end $$;
comment on column public.investment_assets.watchlisted is 'Own watchlist membership; false preserves analysis and chat history.';
create table if not exists public.investment_portfolio_marks (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 currency text not null,recorded_at timestamptz not null default now(),amount numeric not null check(amount>=0),
 cost_basis numeric,missing integer not null default 0,stale integer not null default 0,positions integer not null,
 price_dates jsonb not null,fingerprint text not null,unique(user_id,currency,fingerprint)
);
alter table public.investment_portfolio_marks enable row level security;
drop policy if exists investment_marks_own_read on public.investment_portfolio_marks;
create policy investment_marks_own_read on public.investment_portfolio_marks for select to authenticated using(user_id=auth.uid());
revoke all on public.investment_portfolio_marks from public,anon,authenticated;
grant select on public.investment_portfolio_marks to authenticated;
grant all on public.investment_portfolio_marks to service_role;
create table if not exists public.investment_news_cache (
 user_id uuid not null,asset_id uuid not null,query text not null,sources jsonb not null default '[]',
 status text not null,fetched_at timestamptz,attempted_at timestamptz,expires_at timestamptz not null,error text,
 primary key(user_id,asset_id),foreign key(asset_id,user_id) references public.investment_assets(id,user_id) on delete cascade
);
alter table public.investment_news_cache enable row level security;
revoke all on public.investment_news_cache from public,anon,authenticated;
grant all on public.investment_news_cache to service_role;

-- setup-v39-1-depotfix.sql
-- V39.1: additive bridge from saved legacy plans plus transactional real-position editing.

-- Earlier depot schemas may not contain these editable fields. Null leaves unknown legacy values unknown.
alter table public.depot_positions add column if not exists quantity numeric;
alter table public.depot_positions add column if not exists average_entry_price numeric;
alter table public.depot_positions add column if not exists direction text;
alter table public.depot_positions add column if not exists instrument_type text;
alter table public.investment_assets add column if not exists legacy_trade_ids uuid[] not null default '{}';
create index if not exists investment_legacy_plan_ids on public.investment_assets using gin(legacy_trade_ids);
create table if not exists public.investment_holding_requests(
 user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,asset_id uuid not null,
 input jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,request_id),
 foreign key(asset_id,user_id) references public.investment_assets(id,user_id) on delete cascade
);
alter table public.investment_holding_requests enable row level security;
revoke all on public.investment_holding_requests from public,anon,authenticated;
grant all on public.investment_holding_requests to service_role;
-- Serialize lease acquisition with holding writes on the same asset row.
create or replace function public.claim_investment_operation(p_user_id uuid,p_asset_id uuid,p_kind text,p_token uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare allowed boolean;
begin
 if p_kind not in ('review','chat') then return false;end if;
 perform 1 from investment_assets where id=p_asset_id and user_id=p_user_id for update;
 if not found then return false;end if;
 insert into investment_operation_locks(user_id,asset_id,kind,token,expires_at)
 values(p_user_id,p_asset_id,p_kind,p_token,now()+interval '2 minutes')
 on conflict(user_id,asset_id,kind) do update set token=excluded.token,expires_at=excluded.expires_at
 where investment_operation_locks.expires_at<now() returning true into allowed;
 return coalesce(allowed,false);
end $$;
revoke all on function public.claim_investment_operation(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_investment_operation(uuid,uuid,text,uuid) to service_role;
create or replace function public.save_investment_holding(
 p_user_id uuid,p_asset_id uuid,p_request_id uuid,p_position_id uuid default null,p_legacy_trade_id uuid default null,
 p_quantity numeric default null,p_entry numeric default null,p_direction text default 'Long',p_type text default 'Aktie',p_close boolean default false
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a investment_assets; d depot_positions; t trade_plans; pid uuid; payload jsonb; answer jsonb; receipt investment_holding_requests;
begin
 select * into a from investment_assets where id=p_asset_id and user_id=p_user_id for update;
 if a.id is null or p_request_id is null then raise exception 'Own asset or request reference missing';end if;
 payload=jsonb_build_object('position_id',p_position_id,'legacy_trade_id',p_legacy_trade_id,'quantity',p_quantity,'entry',p_entry,'direction',p_direction,'type',p_type,'close',p_close);
 select * into receipt from investment_holding_requests where user_id=p_user_id and request_id=p_request_id;
 if found then
  if receipt.asset_id<>a.id or receipt.input is distinct from payload then raise exception 'Request reference already used';end if;
  return receipt.result;
 end if;
 if exists(select 1 from investment_operation_locks where user_id=p_user_id and asset_id=p_asset_id and kind='review' and expires_at>now()) then raise exception 'Review in progress';end if;
 if p_close and p_position_id is null then
  select * into t from trade_plans where id=p_legacy_trade_id and user_id=p_user_id and id=any(a.legacy_trade_ids) for update;
  if t.id is null or t.quantity is null or t.quantity<=0 or lower(coalesce(t.instrument_type,'')) not in ('aktie','etf','stock','equity') or lower(coalesce(t.status,'')) not in ('position offen','teilverkauf','open','partially sold') then raise exception 'Own open legacy holding missing';end if;
  if exists(select 1 from depot_positions where user_id=p_user_id and trade_id=t.id) then raise exception 'Holding already migrated; reload positions';end if;
  update trade_plans set status='Geschlossen',monitoring_enabled=false where id=t.id and user_id=p_user_id;
  answer=jsonb_build_object('legacy_trade_id',t.id,'is_open',false);
  insert into investment_holding_requests(user_id,request_id,asset_id,input,result) values(p_user_id,p_request_id,a.id,payload,answer);
  return answer;
 end if;
 pid=coalesce(p_position_id,p_request_id);
 select * into d from depot_positions where id=pid and user_id=p_user_id for update;
 if p_position_id is not null and d.id is null then raise exception 'Own position missing';end if;
 if d.id is not null and not (
  exists(select 1 from investment_position_links l where l.user_id=p_user_id and l.position_id=d.id and l.asset_id=a.id)
  or (coalesce(d.currency,'')=a.currency and d.symbol=a.symbol)
  or exists(select 1 from trade_plans x where x.id=d.trade_id and x.user_id=p_user_id and x.market_symbol=a.symbol and coalesce(d.currency,x.currency)=a.currency)
 ) then raise exception 'Position identity mismatch';end if;
 if p_close then
  if d.id is null then raise exception 'Own position missing';end if;
  update depot_positions set is_open=false where id=d.id and user_id=p_user_id;
  if d.trade_id is not null and not exists(select 1 from depot_positions where trade_id=d.trade_id and user_id=p_user_id and is_open is not false) then
   update trade_plans set status='Geschlossen',monitoring_enabled=false where id=d.trade_id and user_id=p_user_id;
  end if;
  answer=jsonb_build_object('id',d.id,'is_open',false);
  insert into investment_holding_requests(user_id,request_id,asset_id,input,result) values(p_user_id,p_request_id,a.id,payload,answer);
  return answer;
 end if;
 if p_quantity is null or p_quantity<=0 or p_quantity>1000000000 or p_entry is null or p_entry<=0 or p_entry>1000000000 or p_quantity::text in ('NaN','Infinity','-Infinity') or p_entry::text in ('NaN','Infinity','-Infinity') then raise exception 'Positive actual quantity and entry price required';end if;
 if p_direction is null or p_type is null or p_direction not in ('Long','Short') or p_type not in ('Aktie','ETF') then raise exception 'Unsupported holding type';end if;
 if d.id is not null then t.id=d.trade_id;
 elsif p_legacy_trade_id is not null then
  select * into t from trade_plans where id=p_legacy_trade_id and user_id=p_user_id and id=any(a.legacy_trade_ids) for update;
  if t.id is null or lower(coalesce(t.instrument_type,'')) not in ('aktie','etf','stock','equity') or (nullif(t.currency,'') is not null and t.currency<>a.currency) then raise exception 'Own equity plan missing';end if;
 else
  insert into trade_plans(user_id,name,symbol,market_symbol,currency,instrument_type,direction,status,monitoring_enabled)
  values(p_user_id,a.company,a.symbol,a.symbol,a.currency,p_type,p_direction,'Position offen',false) returning id into t.id;
 end if;
 if d.id is null then
  insert into depot_positions(id,user_id,trade_id,name,symbol,currency,instrument_type,direction,quantity,average_entry_price,is_open)
  values(pid,p_user_id,t.id,a.company,a.symbol,a.currency,p_type,p_direction,p_quantity,p_entry,true);
 else
  update depot_positions set quantity=p_quantity,average_entry_price=p_entry,direction=p_direction,instrument_type=p_type,is_open=true where id=pid and user_id=p_user_id;
 end if;
 insert into investment_position_links(user_id,position_id,asset_id) values(p_user_id,pid,a.id) on conflict(user_id,position_id) do update set asset_id=excluded.asset_id;
 update investment_assets set is_portfolio=true,enabled=true,legacy_trade_ids=case when t.id is null then legacy_trade_ids else array(select distinct unnest(legacy_trade_ids||array[t.id])) end,
 state=state||jsonb_build_object('plan_pending',true) where id=a.id and user_id=p_user_id;
 answer=jsonb_build_object('id',pid,'trade_id',t.id,'is_open',true);
 insert into investment_holding_requests(user_id,request_id,asset_id,input,result) values(p_user_id,p_request_id,a.id,payload,answer);
 return answer;
end $$;
revoke all on function public.save_investment_holding(uuid,uuid,uuid,uuid,uuid,numeric,numeric,text,text,boolean) from public,anon,authenticated;
grant execute on function public.save_investment_holding(uuid,uuid,uuid,uuid,uuid,numeric,numeric,text,text,boolean) to service_role;

-- setup-v39-2-depot.sql
-- V39.2 after the V39.1 migration: direct, atomic position entry without quote providers or analysis.

alter table public.depot_positions add column if not exists entry_date date;
alter table public.investment_assets add column if not exists valuation_override jsonb;
create table if not exists public.investment_depot_requests(
 user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,
 input jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,request_id)
);
alter table public.investment_depot_requests enable row level security;
revoke all on public.investment_depot_requests from public,anon,authenticated;
grant all on public.investment_depot_requests to service_role;
create or replace function public.save_depot_position(
 p_user_id uuid,p_request_id uuid,p_asset_id uuid default null,p_symbol text default null,p_currency text default null,p_company text default null,
 p_wkn text default null,p_isin text default null,p_position_id uuid default null,p_legacy_trade_id uuid default null,
 p_quantity numeric default null,p_entry numeric default null,p_direction text default 'Long',p_type text default 'Aktie',p_entry_date date default null,
 p_valuation_mode text default 'keep',p_manual_price numeric default null,p_manual_price_date date default null,p_close boolean default false,p_additional_confirmed boolean default false
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a investment_assets; prior investment_depot_requests; payload jsonb; saved jsonb; answer jsonb; pid uuid; legacy_id uuid; keep_disabled boolean;
begin
 if p_user_id is null or p_request_id is null then raise exception 'Owner or request missing';end if;
 payload=jsonb_build_object('asset_id',p_asset_id,'symbol',p_symbol,'currency',p_currency,'company',p_company,'wkn',p_wkn,'isin',p_isin,
  'position_id',p_position_id,'legacy_trade_id',p_legacy_trade_id,'quantity',p_quantity,'entry',p_entry,'direction',p_direction,'type',p_type,
  'entry_date',p_entry_date,'valuation_mode',p_valuation_mode,'manual_price',p_manual_price,'manual_price_date',p_manual_price_date,'close',p_close,'additional_confirmed',p_additional_confirmed);
 select * into prior from investment_depot_requests where user_id=p_user_id and request_id=p_request_id;
 if found then
  if prior.input is distinct from payload then raise exception 'Request reference already used';end if;
  return prior.result;
 end if;
 if p_symbol is null or p_symbol !~ '^[A-Z0-9_^+\-]{1,25}\.[A-Z0-9]{1,12}$' or p_currency is null or p_currency not in ('EUR','USD','GBP','GBX','CHF','JPY','KRW','CNY','HKD','SEK','AUD','CAD','INR') then raise exception 'Exact security and currency required';end if;
 if p_entry_date>(now() at time zone 'Europe/Berlin')::date then raise exception 'Entry date in future';end if;
 if p_valuation_mode is null or p_valuation_mode not in ('keep','market','manual') then raise exception 'Invalid valuation mode';end if;
 if p_valuation_mode='manual' and (p_manual_price is null or p_manual_price<=0 or p_manual_price>1000000000 or p_manual_price::text in ('NaN','Infinity','-Infinity') or p_manual_price_date is null or p_manual_price_date>(now() at time zone 'Europe/Berlin')::date) then raise exception 'Valid manual price and date required';end if;
 if p_asset_id is not null then
  select * into a from investment_assets where id=p_asset_id and user_id=p_user_id for update;
  if a.id is null then raise exception 'Own asset missing';end if;
  if a.symbol<>p_symbol or a.currency<>p_currency then raise exception 'Asset identity mismatch';end if;
 else
  insert into investment_assets(user_id,symbol,currency,company,config,is_portfolio,watchlisted,enabled)
  values(p_user_id,p_symbol,p_currency,coalesce(nullif(p_company,''),p_symbol),jsonb_build_object('symbol',p_symbol,'currency',p_currency,'company',coalesce(p_company,p_symbol),'source','stored','wkn',p_wkn,'isin',p_isin),false,false,false)
  on conflict(user_id,symbol,currency) do nothing;
  select * into a from investment_assets where user_id=p_user_id and symbol=p_symbol and currency=p_currency for update;
 end if;
 select * into prior from investment_depot_requests where user_id=p_user_id and request_id=p_request_id;
 if found then
  if prior.input is distinct from payload then raise exception 'Request reference already used';end if;
  return prior.result;
 end if;
 if not p_close and p_position_id is null and not coalesce(p_additional_confirmed,false)
 and not exists(select 1 from trade_plans t where t.id=p_legacy_trade_id and t.user_id=p_user_id and t.id=any(a.legacy_trade_ids) and lower(coalesce(t.status,'')) in ('position offen','teilverkauf','open','partially sold') and t.quantity>0 and not exists(select 1 from depot_positions d where d.user_id=p_user_id and d.trade_id=t.id))
 and exists(select 1 from depot_positions d left join trade_plans t on t.id=d.trade_id and t.user_id=d.user_id where d.user_id=p_user_id and d.is_open is not false and d.id<>p_request_id and (
  exists(select 1 from investment_position_links l where l.user_id=p_user_id and l.position_id=d.id and l.asset_id=a.id)
  or (coalesce(d.currency,t.currency)=a.currency and (d.symbol=a.symbol or t.market_symbol=a.symbol or t.id=any(a.legacy_trade_ids)))
 )) then raise exception 'Additional position requires confirmation';end if;
 keep_disabled=a.is_portfolio and not a.enabled;
 legacy_id=p_legacy_trade_id;
 if not p_close and p_position_id is null and legacy_id is null then
  -- Old base tables may require an explicit id rather than supplying a UUID default.
  legacy_id=gen_random_uuid();
  insert into trade_plans(id,user_id,name,symbol,market_symbol,currency,instrument_type,direction,status,monitoring_enabled)
  values(legacy_id,p_user_id,coalesce(nullif(p_company,''),a.company),case when p_symbol like '%.XETRA' then 'XETR:'||split_part(p_symbol,'.',1) else p_symbol end,p_symbol,p_currency,p_type,p_direction,'Position offen',false);
  update investment_assets set legacy_trade_ids=legacy_trade_ids||array[legacy_id] where id=a.id and user_id=p_user_id;
 end if;
 saved=save_investment_holding(p_user_id,a.id,p_request_id,p_position_id,legacy_id,p_quantity,p_entry,p_direction,p_type,p_close);
 pid=(saved->>'id')::uuid;
 if not p_close then
  update depot_positions set entry_date=p_entry_date where id=pid and user_id=p_user_id;
  update investment_assets set company=coalesce(nullif(p_company,''),company),config=config||jsonb_build_object('wkn',coalesce(p_wkn,''),'isin',coalesce(p_isin,'')),
   enabled=case when keep_disabled then false else enabled end,
   valuation_override=case p_valuation_mode when 'manual' then jsonb_build_object('price',p_manual_price,'price_date',p_manual_price_date,'source','manual','recorded_at',now()) when 'market' then null else valuation_override end
  where id=a.id and user_id=p_user_id;
 end if;
 select * into a from investment_assets where id=a.id and user_id=p_user_id;
 answer=saved||jsonb_build_object('asset_id',a.id,'asset',to_jsonb(a),'saved',true);
 insert into investment_depot_requests(user_id,request_id,input,result) values(p_user_id,p_request_id,payload,answer);
 return answer;
end $$;
revoke all on function public.save_depot_position(uuid,uuid,uuid,text,text,text,text,text,uuid,uuid,numeric,numeric,text,text,date,text,numeric,date,boolean,boolean) from public,anon,authenticated;
grant execute on function public.save_depot_position(uuid,uuid,uuid,text,text,text,text,text,uuid,uuid,numeric,numeric,text,text,date,text,numeric,date,boolean,boolean) to service_role;

commit;
