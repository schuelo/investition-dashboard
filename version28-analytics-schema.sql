-- Investition Dashboard V28.0
-- Portfolio-Snapshots und Analystenrevisionen für Portfolio Intelligence.
-- Idempotent: kann erneut ausgeführt werden.

create extension if not exists pgcrypto;

create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  captured_at timestamptz not null default now(),
  invested_value numeric not null default 0,
  market_value numeric not null default 0,
  total_value numeric not null default 0,
  unrealized_pnl numeric not null default 0,
  stop_risk numeric not null default 0,
  cash_value numeric not null default 0,
  position_count integer not null default 0 check (position_count >= 0),
  positions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.analyst_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_id uuid not null references public.trade_plans(id) on delete cascade,
  institution text not null,
  rating text,
  previous_rating text,
  target_price numeric check (target_price is null or target_price >= 0),
  previous_target_price numeric check (previous_target_price is null or previous_target_price >= 0),
  currency text not null default 'EUR',
  published_at date not null default current_date,
  source_url text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_portfolio_snapshots_user_time
  on public.portfolio_snapshots(user_id, captured_at desc);
create index if not exists idx_analyst_revisions_user_trade_date
  on public.analyst_revisions(user_id, trade_id, published_at desc);

create or replace function public.set_updated_at_v28()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_analyst_revisions_updated on public.analyst_revisions;
create trigger trg_analyst_revisions_updated
before update on public.analyst_revisions
for each row execute function public.set_updated_at_v28();

alter table public.portfolio_snapshots enable row level security;
alter table public.analyst_revisions enable row level security;

drop policy if exists portfolio_snapshots_own on public.portfolio_snapshots;
create policy portfolio_snapshots_own on public.portfolio_snapshots
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists analyst_revisions_own on public.analyst_revisions;
create policy analyst_revisions_own on public.analyst_revisions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

comment on table public.portfolio_snapshots is
  'Zeitpunkte der tatsächlichen Depotbewertung für V28 Portfolio Intelligence.';
comment on table public.analyst_revisions is
  'Manuell erfasste oder später importierte Rating- und Kurszieländerungen je Trade-Analyse.';
