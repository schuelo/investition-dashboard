-- V39 additive upgrade after setup-v38-investment-review.sql.
-- Existing reports/messages and the V38 cron job are retained.
begin;
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
commit;
