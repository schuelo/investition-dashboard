-- Investition Dashboard V29.4 – konsistenter Gesamtstand
--
-- Dieses Skript ist idempotent und darf erneut ausgeführt werden.
-- Es:
--   1. ergänzt alle seit V26 benötigten Tabellen und Felder,
--   2. richtet den EODHD-Tagescache und die Laufprotokolle ein,
--   3. ergänzt den deduplizierten Tages-/Wochenbericht,
--   4. entfernt alte Dashboard-Cronjobs anhand ihres Function-Ziels,
--   5. erstellt exakt drei aktuelle Jobs mit dem vorhandenen CRON_SECRET.
--
-- WICHTIG:
-- Das vorhandene Vault-Secret "investition_news_cron_secret" wird nur gelesen
-- und niemals überschrieben. Es muss bereits denselben Wert wie das
-- Edge-Function-Secret CRON_SECRET enthalten.

create extension if not exists pgcrypto;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if to_regclass('public.market_news') is null then
    raise exception
      'Basistabelle public.market_news fehlt. V29.4 ist ein Update des bestehenden Dashboards.';
  end if;
  if to_regclass('public.trade_plans') is null then
    raise exception
      'Basistabelle public.trade_plans fehlt. V29.4 ist ein Update des bestehenden Dashboards.';
  end if;
  if to_regclass('public.depot_positions') is null then
    raise exception
      'Basistabelle public.depot_positions fehlt. V29.4 ist ein Update des bestehenden Dashboards.';
  end if;
  if to_regclass('public.notification_settings') is null then
    raise exception
      'Basistabelle public.notification_settings fehlt. V29.4 ist ein Update des bestehenden Dashboards.';
  end if;
  if to_regclass('public.notification_policies') is null then
    raise exception
      'Basistabelle public.notification_policies fehlt. V29.4 ist ein Update des bestehenden Dashboards.';
  end if;
  if to_regclass('public.alert_events') is null then
    raise exception
      'Basistabelle public.alert_events fehlt. V29.4 ist ein Update des bestehenden Dashboards.';
  end if;
  if not exists (
    select 1
      from vault.decrypted_secrets
     where name = 'investition_news_cron_secret'
       and nullif(decrypted_secret, '') is not null
  ) then
    raise exception
      'Vault-Secret investition_news_cron_secret fehlt. Vor dem V29.4-Setup einmalig mit dem vorhandenen CRON_SECRET anlegen.';
  end if;
end
$$;

-- News-Benachrichtigungen deduplizieren.
create table if not exists public.news_notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  news_id uuid not null references public.market_news(id) on delete cascade,
  delivery_channel text not null default 'telegram',
  delivered_at timestamptz not null default now(),
  unique(user_id, news_id, delivery_channel)
);

create index if not exists idx_news_notification_log_user_time
  on public.news_notification_log(user_id, delivered_at desc);

alter table public.news_notification_log enable row level security;
drop policy if exists news_notification_log_own
  on public.news_notification_log;
create policy news_notification_log_own
  on public.news_notification_log
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on table public.news_notification_log
  from anon, authenticated;
grant select on table public.news_notification_log to authenticated;
grant select, insert, update, delete on table public.news_notification_log
  to service_role;

-- Portfolio Intelligence.
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
  previous_target_price numeric
    check (previous_target_price is null or previous_target_price >= 0),
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

drop trigger if exists trg_analyst_revisions_updated
  on public.analyst_revisions;
create trigger trg_analyst_revisions_updated
before update on public.analyst_revisions
for each row execute function public.set_updated_at_v28();

alter table public.portfolio_snapshots enable row level security;
alter table public.analyst_revisions enable row level security;

drop policy if exists portfolio_snapshots_own
  on public.portfolio_snapshots;
create policy portfolio_snapshots_own
  on public.portfolio_snapshots
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists analyst_revisions_own
  on public.analyst_revisions;
create policy analyst_revisions_own
  on public.analyst_revisions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Nachvollziehbare Market-Intelligence-Bewertung.
alter table public.market_news
  add column if not exists assessment_version text not null
    default 'legacy-v28',
  add column if not exists evaluated_at timestamptz,
  add column if not exists primary_symbol text,
  add column if not exists event_type text not null default 'general',
  add column if not exists direction text not null default 'neutral',
  add column if not exists relevance_score smallint not null default 50,
  add column if not exists confidence_score smallint not null default 35,
  add column if not exists impact_score smallint not null default 50,
  add column if not exists urgency_score smallint not null default 35,
  add column if not exists relevance_reason text not null default '',
  add column if not exists priced_in_state text not null default 'unklar',
  add column if not exists analyst_signal text not null
    default 'nicht_verfuegbar',
  add column if not exists action_code text not null default 'observe',
  add column if not exists recommended_action text not null default '',
  add column if not exists price_reaction_percent numeric,
  add column if not exists normal_move_percent numeric,
  add column if not exists analyst_target_price numeric,
  add column if not exists analyst_target_upside_percent numeric,
  add column if not exists analyst_currency text,
  add column if not exists data_quality text not null default 'niedrig',
  add column if not exists analysis_basis jsonb not null default '{}'::jsonb;

create index if not exists idx_market_news_published_impact
  on public.market_news(is_published, impact, published_at desc);
create index if not exists idx_market_news_symbols_gin
  on public.market_news using gin(symbols);
create index if not exists idx_market_news_v29_priority
  on public.market_news(
    is_published,
    relevance_score desc,
    urgency_score desc,
    published_at desc
  );
create index if not exists idx_market_news_v29_pricing
  on public.market_news(priced_in_state, published_at desc);

-- Kontingentsparender Schlusskurscache und Laufprotokoll.
create table if not exists public.hybrid_market_cache (
  symbol text primary key,
  provider text not null,
  price_bars jsonb not null default '[]'::jsonb,
  fetched_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.hybrid_api_usage (
  usage_date date primary key,
  eodhd_calls smallint not null default 0
    check (eodhd_calls between 0 and 20),
  updated_at timestamptz not null default now()
);

alter table public.hybrid_market_cache enable row level security;
alter table public.hybrid_api_usage enable row level security;
revoke all on table public.hybrid_market_cache from anon, authenticated;
revoke all on table public.hybrid_api_usage from anon, authenticated;
grant select, insert, update, delete on table public.hybrid_market_cache
  to service_role;
grant select, insert, update, delete on table public.hybrid_api_usage
  to service_role;

create or replace function public.reserve_hybrid_eodhd_calls(
  p_calls integer default 1,
  p_daily_limit integer default 6
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage_date date := (now() at time zone 'UTC')::date;
  v_new_total integer;
  v_calls integer := greatest(1, least(coalesce(p_calls, 1), 20));
  v_limit integer := greatest(0, least(coalesce(p_daily_limit, 6), 20));
begin
  if v_limit = 0 or v_calls > v_limit then
    return false;
  end if;

  insert into public.hybrid_api_usage(
    usage_date,
    eodhd_calls,
    updated_at
  )
  values (
    v_usage_date,
    v_calls,
    now()
  )
  on conflict (usage_date) do update
    set
      eodhd_calls = public.hybrid_api_usage.eodhd_calls +
        excluded.eodhd_calls,
      updated_at = now()
    where public.hybrid_api_usage.eodhd_calls +
      excluded.eodhd_calls <= v_limit
  returning eodhd_calls into v_new_total;

  return v_new_total is not null;
end
$$;

revoke all on function public.reserve_hybrid_eodhd_calls(integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_hybrid_eodhd_calls(integer, integer)
  to service_role;

create table if not exists public.news_sync_runs (
  id bigint generated by default as identity primary key,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  ok boolean not null,
  auth_mode text,
  version text not null,
  provider text not null,
  inserted integer not null default 0,
  assessed integer not null default 0,
  rss_articles integer not null default 0,
  eodhd_calls integer not null default 0,
  warning_count integer not null default 0,
  error_message text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.news_sync_runs enable row level security;
drop policy if exists authenticated_read_news_sync_runs
  on public.news_sync_runs;
create policy authenticated_read_news_sync_runs
  on public.news_sync_runs
  for select
  to authenticated
  using (true);

grant select on table public.news_sync_runs to authenticated;
revoke insert, update, delete on table public.news_sync_runs
  from anon, authenticated;
grant select, insert, update, delete on table public.news_sync_runs
  to service_role;

do $$
begin
  if to_regclass('public.news_sync_runs_id_seq') is not null then
    execute
      'grant usage, select on sequence public.news_sync_runs_id_seq to service_role';
  end if;
end
$$;

create index if not exists idx_news_sync_runs_finished
  on public.news_sync_runs(finished_at desc);
create index if not exists idx_news_sync_runs_status
  on public.news_sync_runs(ok, finished_at desc);

-- Exakt-einmal-Protokoll für automatische Tages- und Wochenberichte.
create table if not exists public.digest_delivery_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null check (period in ('daily', 'weekly')),
  period_key text not null,
  delivery_channel text not null default 'telegram',
  status text not null default 'pending'
    check (status in ('pending', 'sent')),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, period, period_key, delivery_channel)
);

create index if not exists idx_digest_delivery_log_user_time
  on public.digest_delivery_log(user_id, created_at desc);

alter table public.digest_delivery_log enable row level security;
drop policy if exists digest_delivery_log_own
  on public.digest_delivery_log;
create policy digest_delivery_log_own
  on public.digest_delivery_log
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on table public.digest_delivery_log
  from anon, authenticated;
grant select on table public.digest_delivery_log to authenticated;
grant select, insert, update, delete on table public.digest_delivery_log
  to service_role;

-- Alle früheren Jobs dieser vier Function-Ziele gezielt entfernen.
do $$
declare
  dashboard_job record;
begin
  for dashboard_job in
    select jobid
      from cron.job
     where jobname in (
       'sync-portfolio-news-hourly',
       'portfolio-news-alerts-hourly',
       'portfolio-digests-quarter-hour'
     )
        or command ilike '%/functions/v1/sync-news%'
        or command ilike '%/functions/v1/send-news-alerts%'
        or command ilike '%/functions/v1/send-digest%'
  loop
    perform cron.unschedule(dashboard_job.jobid);
  end loop;
end
$$;

select cron.schedule(
  'sync-portfolio-news-hourly',
  '7 * * * *',
  $job$
  select net.http_post(
    url := 'https://pzhfybtoyfttftgcrcxk.supabase.co/functions/v1/sync-news',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
          from vault.decrypted_secrets
         where name = 'investition_news_cron_secret'
         limit 1
      )
    ),
    body := '{"mode":"hybrid","portfolio":true,"intelligence":true}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);

select cron.schedule(
  'portfolio-news-alerts-hourly',
  '17 * * * *',
  $job$
  select net.http_post(
    url := 'https://pzhfybtoyfttftgcrcxk.supabase.co/functions/v1/send-news-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
          from vault.decrypted_secrets
         where name = 'investition_news_cron_secret'
         limit 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);

select cron.schedule(
  'portfolio-digests-quarter-hour',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := 'https://pzhfybtoyfttftgcrcxk.supabase.co/functions/v1/send-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
          from vault.decrypted_secrets
         where name = 'investition_news_cron_secret'
         limit 1
      )
    ),
    body := '{"period":"auto"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);

-- Direkte Abschlusskontrolle im SQL Editor.
select
  jobid,
  jobname,
  schedule,
  active
from cron.job
where jobname in (
  'sync-portfolio-news-hourly',
  'portfolio-news-alerts-hourly',
  'portfolio-digests-quarter-hour'
)
order by jobname;
