-- Optional V40 scheduler. Reuses the existing protected review/news CRON_SECRET in Vault.
-- Never prints or embeds that secret in a cron command. Existing news jobs are untouched.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create or replace function public.ensure_investition_monitor(p_project_url text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare secret_value text; secret_id uuid; j record; command text; first_request bigint;
begin
 if p_project_url !~ '^https://[a-z0-9]{20}\.supabase\.co$' then raise exception 'Exact Supabase project URL required';end if;
 if to_regclass('vault.decrypted_secrets') is null then return jsonb_build_object('configured',false,'reason','Vault fehlt; bestehendes CRON_SECRET einmalig sicher einrichten');end if;
 execute 'select decrypted_secret from vault.decrypted_secrets where name in (''investition_review_cron_secret'',''investition_news_cron_secret'') order by case name when ''investition_review_cron_secret'' then 0 else 1 end limit 1' into secret_value;
 if secret_value is null or length(secret_value)<16 then return jsonb_build_object('configured',false,'reason','Kein bestehendes Cron-Secret in Vault. V38-Einrichtung mit vorhandenem CRON_SECRET abschließen.');end if;
 select id into secret_id from vault.secrets where name='investition_review_cron_secret' limit 1;
 if secret_id is null then perform vault.create_secret(secret_value,'investition_review_cron_secret','Investition monitor; reused server-side secret');end if;
 command=format($q$select net.http_post(url := %L,headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='investition_review_cron_secret' limit 1)),body := '{"action":"monitor"}'::jsonb,timeout_milliseconds := 120000);$q$,p_project_url||'/functions/v1/review-investments');
 for j in select jobid from cron.job where jobname='investition-v38-portfolio-monitor' loop perform cron.unschedule(j.jobid);end loop;
 perform cron.schedule('investition-v38-portfolio-monitor','*/30 * * * *',command);
 first_request=net.http_post(url:=p_project_url||'/functions/v1/review-investments',headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',secret_value),body:='{"action":"monitor"}'::jsonb,timeout_milliseconds:=120000);
 return jsonb_build_object('configured',true,'schedule','*/30 * * * *','secret_reused',true,'first_run_pending',true,'first_run_request_id',first_request);
end $$;
revoke all on function public.ensure_investition_monitor(text) from public,anon,authenticated;
grant execute on function public.ensure_investition_monitor(text) to service_role;
