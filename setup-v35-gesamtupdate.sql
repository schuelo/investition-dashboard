-- V35.0.0 overall upgrade from a working V31.2 or V32 installation.
-- Adds missing V32/V33/V35 objects; preserves data and existing schedules.
-- V34 manual URLs use the existing JSONB analysis/source snapshots.
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

commit;
