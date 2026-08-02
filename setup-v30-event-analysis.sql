-- V30.1 Event- & Szenarioanalyse
-- Ergänzt V29.4 ausschließlich um eigene Tabellen. Bestehende Portfolio-,
-- Watchlist-, News-, Telegram- und Cron-Strukturen werden nicht verändert.

begin;

create extension if not exists pgcrypto;

create table if not exists public.event_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_input text not null check (char_length(event_input) between 8 and 2000),
  event_title text not null,
  event_summary text,
  analysis_horizon text not null default '1–6 Monate',
  risk_profile text not null default 'chancenorientiert',
  regions text[] not null default array['weltweit']::text[],
  analysis_scope text not null default 'portfolio_watchlist_market',
  status text not null default 'completed',
  market_relevance integer not null default 50 check (market_relevance between 0 and 100),
  portfolio_impact integer not null default 0 check (portfolio_impact between -100 and 100),
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  pricing_state text not null default 'unklar',
  key_action text,
  raw_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_analysis_assets (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.event_analyses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text,
  company_name text not null,
  asset_source text not null default 'market',
  impact_direction text not null default 'neutral',
  impact_score integer not null default 0 check (impact_score between -100 and 100),
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  opportunity_score integer check (opportunity_score between 0 and 100),
  recommendation text,
  reasoning text,
  time_horizon text,
  pricing_state text default 'unklar',
  is_portfolio_position boolean not null default false,
  is_watchlist_position boolean not null default false,
  idea_type text,
  idea_rank integer check (idea_rank is null or idea_rank between 1 and 100),
  is_fallback_idea boolean not null default false,
  overlaps_portfolio boolean not null default false,
  overlaps_watchlist boolean not null default false,
  created_at timestamptz not null default now()
);


-- V30.1: sichere Nachrüstung, falls V30.0 bereits testweise ausgeführt wurde.
alter table public.event_analysis_assets add column if not exists idea_type text;
alter table public.event_analysis_assets add column if not exists idea_rank integer;
alter table public.event_analysis_assets add column if not exists is_fallback_idea boolean not null default false;
alter table public.event_analysis_assets add column if not exists overlaps_portfolio boolean not null default false;
alter table public.event_analysis_assets add column if not exists overlaps_watchlist boolean not null default false;

create table if not exists public.event_analysis_scenarios (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.event_analyses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_type text not null,
  title text not null,
  description text not null,
  probability integer not null check (probability between 0 and 100),
  portfolio_effect text,
  market_effect text,
  confirmation_signals text[] not null default '{}'::text[],
  invalidation_signals text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create table if not exists public.event_analysis_sources (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.event_analyses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_name text,
  source_url text,
  published_at timestamptz,
  title text not null,
  relevance_score integer not null default 0 check (relevance_score between 0 and 100),
  source_type text not null default 'news',
  created_at timestamptz not null default now()
);

create table if not exists public.event_analysis_signals (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.event_analyses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  signal_name text not null,
  signal_description text,
  current_status text not null default 'offen',
  importance integer not null default 50 check (importance between 0 and 100),
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists event_analyses_user_created_idx
  on public.event_analyses(user_id, created_at desc);
create index if not exists event_analysis_assets_analysis_idx
  on public.event_analysis_assets(analysis_id);
create index if not exists event_analysis_assets_user_symbol_idx
  on public.event_analysis_assets(user_id, symbol);
create index if not exists event_analysis_scenarios_analysis_idx
  on public.event_analysis_scenarios(analysis_id);
create index if not exists event_analysis_sources_analysis_idx
  on public.event_analysis_sources(analysis_id);
create index if not exists event_analysis_signals_analysis_idx
  on public.event_analysis_signals(analysis_id);

alter table public.event_analyses enable row level security;
alter table public.event_analysis_assets enable row level security;
alter table public.event_analysis_scenarios enable row level security;
alter table public.event_analysis_sources enable row level security;
alter table public.event_analysis_signals enable row level security;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'event_analyses',
    'event_analysis_assets',
    'event_analysis_scenarios',
    'event_analysis_sources',
    'event_analysis_signals'
  ]
  LOOP
    EXECUTE format('drop policy if exists %I on public.%I', table_name || '_own_rows', table_name);
    EXECUTE format(
      'create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      table_name || '_own_rows',
      table_name
    );
  END LOOP;
END $$;

create or replace function public.touch_event_analysis_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_event_analyses_updated_at on public.event_analyses;
create trigger trg_event_analyses_updated_at
before update on public.event_analyses
for each row execute function public.touch_event_analysis_updated_at();

commit;
