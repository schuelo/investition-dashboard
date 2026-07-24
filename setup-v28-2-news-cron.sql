-- Investition Dashboard V28.2
-- Automatischer News-Sync und Telegram-News-Alarm
--
-- VOR DEM AUSFÜHREN:
-- 1. DEIN_CRON_SECRET durch denselben Wert ersetzen, der in
--    Edge Functions -> Secrets als CRON_SECRET gespeichert ist.
-- 2. Das Secret nicht in GitHub eintragen oder diese bearbeitete Datei committen.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_id uuid;
begin
  select id
    into existing_id
    from vault.secrets
   where name = 'investition_news_cron_secret'
   limit 1;

  if existing_id is null then
    perform vault.create_secret(
      'DEIN_CRON_SECRET',
      'investition_news_cron_secret',
      'Investition Dashboard News-Cron'
    );
  else
    perform vault.update_secret(
      existing_id,
      'DEIN_CRON_SECRET',
      'investition_news_cron_secret',
      'Investition Dashboard News-Cron'
    );
  end if;
end
$$;

select cron.unschedule('sync-portfolio-news-hourly')
where exists (
  select 1 from cron.job where jobname = 'sync-portfolio-news-hourly'
);

select cron.schedule(
  'sync-portfolio-news-hourly',
  '7 * * * *',
  $$
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
    body := '{"force":true,"portfolio":true}'::jsonb
  );
  $$
);

select cron.unschedule('portfolio-news-alerts-hourly')
where exists (
  select 1 from cron.job where jobname = 'portfolio-news-alerts-hourly'
);

select cron.schedule(
  'portfolio-news-alerts-hourly',
  '17 * * * *',
  $$
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
    body := '{}'::jsonb
  );
  $$
);
