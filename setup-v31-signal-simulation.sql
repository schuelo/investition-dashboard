-- Additive V31 schema; no edits to existing tables, functions or cron jobs.
begin;
create table if not exists public.signal_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  currency text not null,
  horizon_days integer not null check (horizon_days in (5,20,60)),
  raw_result jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists signal_simulations_user_time on public.signal_simulations(user_id,created_at desc);
create table if not exists public.signal_market_cache (
  symbol text primary key,
  bars jsonb not null,
  provider text not null,
  fetched_at timestamptz not null default now()
);
create table if not exists public.signal_analysis_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  runs integer not null default 0 check (runs between 0 and 20),
  primary key (user_id,usage_date)
);
alter table public.signal_simulations enable row level security;
alter table public.signal_market_cache enable row level security;
alter table public.signal_analysis_usage enable row level security;
drop policy if exists signal_simulations_own_read on public.signal_simulations;
create policy signal_simulations_own_read on public.signal_simulations for select to authenticated using (user_id = auth.uid());
revoke all on public.signal_simulations, public.signal_market_cache, public.signal_analysis_usage from anon,authenticated;
grant select on public.signal_simulations to authenticated;
grant all on public.signal_simulations, public.signal_market_cache, public.signal_analysis_usage to service_role;
create or replace function public.reserve_signal_analysis_run(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare allowed boolean;
begin
  insert into public.signal_analysis_usage(user_id,usage_date,runs)
  values(p_user_id,(now() at time zone 'utc')::date,1)
  on conflict(user_id,usage_date) do update set runs=signal_analysis_usage.runs+1
  where signal_analysis_usage.runs < 20
  returning true into allowed;
  return coalesce(allowed,false);
end;
$$;
revoke all on function public.reserve_signal_analysis_run(uuid) from public,anon,authenticated;
grant execute on function public.reserve_signal_analysis_run(uuid) to service_role;
commit;
