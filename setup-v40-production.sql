-- Additive V40 update after V39.2+. Keeps existing positions, analysis and news jobs.
begin;
alter table public.investment_assets add column if not exists archived_at timestamptz;
alter table public.investment_assets add column if not exists quote_status jsonb not null default '{}'::jsonb;
create table if not exists public.investment_position_events(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 asset_id uuid references public.investment_assets(id) on delete set null,position_id uuid,symbol text not null,currency text not null,
 kind text not null check(kind in ('created','changed','closed','removed')),
 before_data jsonb,after_data jsonb,created_at timestamptz not null default now(),transaction_id bigint not null default txid_current(),
 unique(user_id,position_id,transaction_id)
);
create index if not exists investment_events_owner_asset on public.investment_position_events(user_id,asset_id,created_at desc);
alter table public.investment_position_events enable row level security;
drop policy if exists investment_position_events_read on public.investment_position_events;
create policy investment_position_events_read on public.investment_position_events for select to authenticated using(user_id=auth.uid());
revoke all on public.investment_position_events from public,anon,authenticated;
grant select on public.investment_position_events to authenticated;
grant all on public.investment_position_events to service_role;
create or replace function public.record_investment_position_event() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare before_row jsonb; after_row jsonb; owner_id uuid; security_id uuid; sym text; cur text; event_kind text;
begin
 if tg_op='UPDATE' and row(new.quantity,new.average_entry_price,new.is_open,new.entry_date,new.direction,new.instrument_type) is not distinct from row(old.quantity,old.average_entry_price,old.is_open,old.entry_date,old.direction,old.instrument_type) then return new;end if;
 before_row=case when tg_op='INSERT' then null else to_jsonb(old) end;
 after_row=case when tg_op='DELETE' then null else to_jsonb(new) end;
 owner_id=coalesce((after_row->>'user_id')::uuid,(before_row->>'user_id')::uuid);
 sym=coalesce(after_row->>'symbol',before_row->>'symbol');cur=coalesce(after_row->>'currency',before_row->>'currency');
 select a.id into security_id from investment_assets a where a.user_id=owner_id and a.symbol=sym and a.currency=cur limit 1;
 if security_id is null then return coalesce(new,old);end if;
 event_kind=case when tg_op='INSERT' then 'created' when tg_op='DELETE' then 'removed' when new.is_open is false and old.is_open is not false then 'closed' else 'changed' end;
 insert into investment_position_events(user_id,asset_id,position_id,symbol,currency,kind,before_data,after_data)
 values(owner_id,security_id,coalesce((after_row->>'id')::uuid,(before_row->>'id')::uuid),sym,cur,event_kind,
  case when before_row is null then null else jsonb_build_object('quantity',before_row->'quantity','average_entry_price',before_row->'average_entry_price','is_open',before_row->'is_open','entry_date',before_row->'entry_date') end,
  case when after_row is null then null else jsonb_build_object('quantity',after_row->'quantity','average_entry_price',after_row->'average_entry_price','is_open',after_row->'is_open','entry_date',after_row->'entry_date') end)
 on conflict(user_id,position_id,transaction_id) do update set after_data=excluded.after_data,kind=case when investment_position_events.kind='created' then 'created' else excluded.kind end;
 return coalesce(new,old);
end $$;
revoke all on function public.record_investment_position_event() from public,anon,authenticated;
drop trigger if exists investition_position_audit on public.depot_positions;
create trigger investition_position_audit after insert or update or delete on public.depot_positions for each row execute function public.record_investment_position_event();
create or replace function public.record_legacy_investment_event() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare security_id uuid; old_open boolean; new_open boolean;
begin
 if exists(select 1 from depot_positions where user_id=new.user_id and trade_id=new.id) then return new;end if;
 old_open=lower(coalesce(old.status,'')) in ('position offen','teilverkauf','open','partially sold');
 new_open=lower(coalesce(new.status,'')) in ('position offen','teilverkauf','open','partially sold');
 if not old_open or (old.quantity is not distinct from new.quantity and old_open=new_open) then return new;end if;
 select id into security_id from investment_assets where user_id=new.user_id and new.id=any(legacy_trade_ids) and currency=coalesce(new.currency,currency) limit 1;
 if security_id is null then return new;end if;
 insert into investment_position_events(user_id,asset_id,symbol,currency,kind,before_data,after_data)
 select new.user_id,id,symbol,currency,case when new_open then 'changed' else 'closed' end,
 jsonb_build_object('quantity',old.quantity,'is_open',true),jsonb_build_object('quantity',new.quantity,'is_open',new_open)
 from investment_assets where id=security_id;
 return new;
end $$;
revoke all on function public.record_legacy_investment_event() from public,anon,authenticated;
drop trigger if exists investition_legacy_audit on public.trade_plans;
create trigger investition_legacy_audit after update on public.trade_plans for each row execute function public.record_legacy_investment_event();
create table if not exists public.investment_monitor_runs(
 user_id uuid primary key references auth.users(id) on delete cascade,last_run_at timestamptz not null,checked integer not null default 0,failed integer not null default 0
);
alter table public.investment_monitor_runs enable row level security;
revoke all on public.investment_monitor_runs from public,anon,authenticated;
grant all on public.investment_monitor_runs to service_role;
create or replace function public.archive_investment_asset(p_user_id uuid,p_asset_id uuid,p_request_id uuid,p_confirm boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a investment_assets; prior investment_depot_requests; row_data record; answer jsonb; payload jsonb; n integer=0;
begin
 if p_user_id is null or p_request_id is null or p_confirm is not true then raise exception 'Explicit owner and confirmation required';end if;
 select * into a from investment_assets where id=p_asset_id and user_id=p_user_id for update;
 if a.id is null then raise exception 'Own asset missing';end if;
 payload=jsonb_build_object('action','archive_asset','asset_id',p_asset_id);
 select * into prior from investment_depot_requests where user_id=p_user_id and request_id=p_request_id;
 if found then
  if prior.input is distinct from payload then raise exception 'Request reference already used';end if;
  return prior.result;
 end if;
 if exists(select 1 from investment_operation_locks where user_id=p_user_id and asset_id=p_asset_id and expires_at>now()) then raise exception 'Operation in progress';end if;
 for row_data in select d.id from depot_positions d left join trade_plans t on t.id=d.trade_id and t.user_id=d.user_id
  where d.user_id=p_user_id and d.is_open is not false and (
   exists(select 1 from investment_position_links l where l.user_id=p_user_id and l.position_id=d.id and l.asset_id=p_asset_id)
   or (coalesce(d.currency,t.currency)=a.currency and (d.symbol=a.symbol or t.market_symbol=a.symbol)))
 loop
  perform save_investment_holding(p_user_id,p_asset_id,gen_random_uuid(),row_data.id,null,null,null,'Long','Aktie',true);n=n+1;
 end loop;
 for row_data in select t.id from trade_plans t where t.user_id=p_user_id and t.id=any(a.legacy_trade_ids)
  and lower(coalesce(t.status,'')) in ('position offen','teilverkauf','open','partially sold') and t.quantity>0 and coalesce(t.currency,a.currency)=a.currency
  and not exists(select 1 from depot_positions d where d.trade_id=t.id and d.user_id=p_user_id)
 loop
  perform save_investment_holding(p_user_id,p_asset_id,gen_random_uuid(),null,row_data.id,null,null,'Long','Aktie',true);n=n+1;
 end loop;
 update investment_assets set is_portfolio=false,watchlisted=false,enabled=false,archived_at=now() where id=p_asset_id and user_id=p_user_id;
 answer=jsonb_build_object('asset_id',p_asset_id,'archived',true,'closed_positions',n);
 insert into investment_depot_requests(user_id,request_id,input,result) values(p_user_id,p_request_id,payload,answer);
 return answer;
end $$;
revoke all on function public.archive_investment_asset(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.archive_investment_asset(uuid,uuid,uuid,boolean) to service_role;
create or replace function public.investition_scheduler_status() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer=0; active_jobs integer=0; secret_present boolean=false;
begin
 if to_regclass('cron.job') is null then return jsonb_build_object('configured',false,'active',false,'reason','pg_cron fehlt');end if;
 execute 'select count(*),count(*) filter(where active) from cron.job where jobname=''investition-v38-portfolio-monitor''' into n,active_jobs;
 if to_regclass('vault.secrets') is not null then execute 'select exists(select 1 from vault.secrets where name=''investition_review_cron_secret'')' into secret_present;end if;
 return jsonb_build_object('configured',n>0,'active',active_jobs>0,'jobs',n,'vault_secret_present',secret_present);
end $$;
revoke all on function public.investition_scheduler_status() from public,anon,authenticated;
grant execute on function public.investition_scheduler_status() to service_role;
commit;
