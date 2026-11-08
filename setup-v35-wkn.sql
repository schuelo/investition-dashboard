-- V35: owner-scoped reference-data cache; no real portfolio writes or new schedules.
begin;
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
