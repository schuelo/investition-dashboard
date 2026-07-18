-- 1. Existiert die News-Tabelle?
select to_regclass('public.market_news') as market_news_table;

-- 2. Wie viele Meldungen sind gespeichert?
select
  count(*) as total_news,
  max(published_at) as newest_published_at,
  max(updated_at) as last_database_update
from public.market_news;

-- 3. Letzte Meldungen
select published_at, topic, title, source_name
from public.market_news
order by published_at desc
limit 20;

-- 4. Ist der Cronjob aktiv?
select jobid, jobname, schedule, active
from cron.job
where jobname = 'sync-investment-news';

-- 5. Letzte Cron-Ausführungen
select jobid, status, start_time, end_time, return_message
from cron.job_run_details
where jobid in (
  select jobid from cron.job where jobname = 'sync-investment-news'
)
order by start_time desc
limit 20;
