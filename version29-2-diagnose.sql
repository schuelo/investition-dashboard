-- Investition Dashboard V29.2 Hybrid
-- Nur lesende Diagnose nach Installation.

-- 1. Hybrid-Tabellen und Budgetfunktion
select
  to_regclass('public.hybrid_market_cache') as kurscache,
  to_regclass('public.hybrid_api_usage') as api_budget,
  to_regclass('public.news_sync_runs') as sync_protokoll,
  to_regprocedure(
    'public.reserve_hybrid_eodhd_calls(integer,integer)'
  ) as budgetfunktion;

-- Erwartung: alle vier Spalten sind gefüllt.

-- 2. EODHD-Budget der letzten sieben UTC-Tage
select
  usage_date,
  eodhd_calls,
  updated_at at time zone 'Europe/Berlin' as aktualisiert_berlin
from public.hybrid_api_usage
where usage_date >= (now() at time zone 'UTC')::date - 6
order by usage_date desc;

-- V29.2 reserviert standardmäßig höchstens 6 Aufrufe pro UTC-Tag.

-- 3. Kurscache
select
  symbol,
  provider,
  jsonb_array_length(price_bars) as handelstage,
  fetched_at at time zone 'Europe/Berlin' as geladen_berlin,
  last_error
from public.hybrid_market_cache
order by fetched_at desc nulls last, symbol;

-- 4. Letzte automatischen und manuellen Sync-Läufe
select
  finished_at at time zone 'Europe/Berlin' as ende_berlin,
  ok,
  auth_mode,
  version,
  inserted,
  assessed,
  rss_articles,
  eodhd_calls,
  warning_count,
  error_message
from public.news_sync_runs
order by finished_at desc
limit 20;

-- 5. Neueste Hybrid-Bewertungen
select
  published_at at time zone 'Europe/Berlin' as meldung_berlin,
  title,
  source_name,
  primary_symbol,
  relevance_score,
  confidence_score,
  urgency_score,
  priced_in_state,
  analysis_basis ->> 'price_provider' as kursanbieter,
  analysis_basis ->> 'price_context_updated_at' as kurscache_stand,
  data_quality
from public.market_news
where assessment_version = '29.2-hybrid-rule-market-intelligence'
order by published_at desc
limit 30;

-- 6. Einpreisungsverteilung
select
  priced_in_state,
  count(*) as meldungen,
  count(price_reaction_percent) as mit_kursreaktion
from public.market_news
where assessment_version = '29.2-hybrid-rule-market-intelligence'
group by priced_in_state
order by count(*) desc;

-- 7. Cronjobs
select
  jobid,
  jobname,
  schedule,
  active
from cron.job
where jobname in (
  'sync-portfolio-news-hourly',
  'portfolio-news-alerts-hourly'
)
order by jobname;

-- 8. Letzte HTTP-Antworten der Cron-Aufrufe
select
  created at time zone 'Europe/Berlin' as zeit_berlin,
  status_code,
  timed_out,
  error_msg,
  left(content, 1800) as antwort
from net._http_response
where created > now() - interval '6 hours'
order by created desc
limit 20;
