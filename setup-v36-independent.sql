-- Independent lookup/chart budgets and private public-chart cache. No EODHD counter is changed.
begin;
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
commit;
