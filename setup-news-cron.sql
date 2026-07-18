-- Einmal täglich EODHD-News synchronisieren (05:30 UTC)
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname='sync-investment-news' limit 1;
  if existing_job_id is not null then perform cron.unschedule(existing_job_id); end if;
end $$;

select cron.schedule(
  'sync-investment-news',
  '30 5 * * *',
  $$
  select net.http_post(
    url := 'https://pzhfybtoyfttftgcrcxk.supabase.co/functions/v1/sync-news',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='investment_cron_secret' limit 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
