-- Investition Dashboard V29.4 – Systemdiagnose (nur lesend)

select
  'Erwarteter Stand' as pruefung,
  'V29.4 Frontend · 3 Edge Functions · 3 aktive Cronjobs' as ergebnis;

select
  required.object_name,
  case
    when to_regclass(required.object_name) is null then 'FEHLT'
    else 'OK'
  end as status
from (
  values
    ('public.market_news'),
    ('public.trade_plans'),
    ('public.depot_positions'),
    ('public.notification_settings'),
    ('public.notification_policies'),
    ('public.alert_events'),
    ('public.news_notification_log'),
    ('public.portfolio_snapshots'),
    ('public.analyst_revisions'),
    ('public.hybrid_market_cache'),
    ('public.hybrid_api_usage'),
    ('public.news_sync_runs'),
    ('public.digest_delivery_log')
) as required(object_name)
order by required.object_name;

select
  required.column_name,
  case when columns.column_name is null then 'FEHLT' else 'OK' end as status
from (
  values
    ('assessment_version'),
    ('primary_symbol'),
    ('relevance_score'),
    ('urgency_score'),
    ('priced_in_state'),
    ('recommended_action'),
    ('analysis_basis')
) as required(column_name)
left join information_schema.columns as columns
  on columns.table_schema = 'public'
 and columns.table_name = 'market_news'
 and columns.column_name = required.column_name
order by required.column_name;

select
  jobid,
  jobname,
  schedule,
  active,
  case
    when command ilike '%x-cron-secret%' then 'Secret-Header vorhanden'
    else 'FEHLT: x-cron-secret'
  end as autorisierung,
  case
    when command ilike '%/functions/v1/sync-news%' then 'sync-news'
    when command ilike '%/functions/v1/send-news-alerts%'
      then 'send-news-alerts'
    when command ilike '%/functions/v1/send-digest%' then 'send-digest'
    else 'anderer Job'
  end as ziel
from cron.job
where command ilike '%/functions/v1/%'
order by jobname, jobid;

select
  count(*) as dashboard_jobs_gesamt,
  count(*) filter (
    where jobname in (
      'sync-portfolio-news-hourly',
      'portfolio-news-alerts-hourly',
      'portfolio-digests-quarter-hour'
    )
  ) as aktuelle_jobs,
  count(*) filter (
    where (
      command ilike '%/functions/v1/sync-news%'
      or command ilike '%/functions/v1/send-news-alerts%'
      or command ilike '%/functions/v1/send-digest%'
    )
      and jobname not in (
        'sync-portfolio-news-hourly',
        'portfolio-news-alerts-hourly',
        'portfolio-digests-quarter-hour'
      )
  ) as alte_dashboard_jobs
from cron.job
where command ilike '%/functions/v1/%';

select
  finished_at at time zone 'Europe/Berlin' as zeit_berlin,
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
limit 10;

select
  created at time zone 'Europe/Berlin' as zeit_berlin,
  status_code,
  timed_out,
  error_msg,
  left(content, 1000) as antwort
from net._http_response
where created > now() - interval '6 hours'
order by created desc
limit 30;

select
  period,
  status,
  count(*) as anzahl,
  max(coalesce(delivered_at, created_at)) at time zone 'Europe/Berlin'
    as letzter_eintrag_berlin
from public.digest_delivery_log
group by period, status
order by period, status;
