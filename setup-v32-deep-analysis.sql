-- Additive V32. Run after both V31 SQL files. Existing tables, RPCs and schedules remain unchanged.
begin;
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
commit;
