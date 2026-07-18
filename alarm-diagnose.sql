-- Aktive Pläne und gesetzte Alarmmarken
select
  name,
  market_symbol,
  status,
  monitoring_enabled,
  alert_entry,
  alert_limit,
  alert_stop,
  alert_target1,
  alert_target2,
  alert_target3,
  limit_price,
  stop_price,
  target1,
  last_price,
  last_price_at
from public.trade_plans
order by updated_at desc;

-- Telegram-Verbindung
select
  user_id,
  telegram_enabled,
  telegram_chat_id,
  telegram_connected_at
from public.notification_settings;

-- Letzte Alarmprüfungen und Fehler
select
  tp.name,
  s.previous_price,
  s.checked_at,
  s.quote_at,
  s.data_source,
  s.last_error,
  s.fired
from public.alert_state s
join public.trade_plans tp on tp.id = s.trade_id
order by s.checked_at desc;

-- Letzte Signale einschließlich Zustellstatus
select
  tp.name,
  e.event_type,
  e.price,
  e.level_value,
  e.delivered,
  e.delivery_error,
  e.created_at
from public.alert_events e
join public.trade_plans tp on tp.id = e.trade_id
order by e.created_at desc
limit 50;

-- Cronjob und letzte Ausführungen
select jobid, jobname, schedule, active
from cron.job
where jobname = 'check-investment-alerts';

select jobid, status, start_time, end_time, return_message
from cron.job_run_details
where jobid in (
  select jobid from cron.job where jobname = 'check-investment-alerts'
)
order by start_time desc
limit 20;
