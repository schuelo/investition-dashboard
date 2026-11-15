-- Optional scheduler installer. Does not touch existing news/alert jobs.
-- Run this file, then call configure_investition_monitor in SQL Editor with the EXISTING CRON_SECRET.
-- Never put the secret in GitHub, frontend files or a committed SQL file.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create or replace function public.configure_investition_monitor(p_project_url text,p_cron_secret text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare secret_id uuid; job record; command text;
begin
 if p_project_url !~ '^https://[a-z0-9]{20}\.supabase\.co$' then raise exception 'Use the Supabase project URL without a trailing slash';end if;
 if p_cron_secret is null or length(p_cron_secret)<16 or p_cron_secret like '%DEIN_%' then raise exception 'Use the existing CRON_SECRET, not a placeholder';end if;
 select id into secret_id from vault.secrets where name='investition_review_cron_secret' limit 1;
 if secret_id is null then perform vault.create_secret(p_cron_secret,'investition_review_cron_secret','V38 portfolio monitor');
 else perform vault.update_secret(secret_id,p_cron_secret);end if;
 command=format($q$select net.http_post(url := %L,headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='investition_review_cron_secret' limit 1)),body := '{"action":"monitor"}'::jsonb,timeout_milliseconds := 120000);$q$,p_project_url||'/functions/v1/review-investments');
 for job in select jobid from cron.job where jobname='investition-v38-portfolio-monitor' loop perform cron.unschedule(job.jobid);end loop;
 perform cron.schedule('investition-v38-portfolio-monitor','*/30 * * * *',command);
 return 'V38 monitor scheduled every 30 minutes. Check the dashboard for the first successful background run.';
end $$;
revoke all on function public.configure_investition_monitor(text,text) from public,anon,authenticated;
grant execute on function public.configure_investition_monitor(text,text) to service_role;
