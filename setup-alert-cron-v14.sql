-- Voraussetzung:
-- 1) pg_cron und pg_net sind aktiviert.
-- 2) Vault enthält investment_cron_secret mit demselben Wert wie CRON_SECRET.
-- 3) check-alerts ist deployt und Verify JWT ist deaktiviert.
--
-- Hinweis: EODHD zählt laut Dokumentation einen API Call je Ticker.
-- Bei fünf aktiven Symbolen und 15-Minuten-Takt sind das bis zu 480 Calls je Werktag.
-- Der kostenlose EODHD-Tarif ist hierfür nicht geeignet.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'check-investment-alerts'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end
$$;

select cron.schedule(
  'check-investment-alerts',
  '*/15 * * * 1-5',
  $$
  select net.http_post(
    url := 'https://pzhfybtoyfttftgcrcxk.supabase.co/functions/v1/check-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'investment_cron_secret'
        limit 1
      )
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
