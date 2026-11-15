-- Additive V38 upgrade from a working V36/V37. Existing depot, cron and alerts are preserved.
begin;
create table if not exists public.investment_assets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 symbol text not null, currency text not null, company text not null default '', config jsonb not null default '{}',
 enabled boolean not null default false, is_portfolio boolean not null default false,
 state jsonb not null default '{}', latest_review_id uuid, analysis_at timestamptz, checked_at timestamptz,
 next_check_at timestamptz not null default now(), last_key text, created_at timestamptz not null default now(),
 unique(user_id,symbol,currency), unique(id,user_id)
);
create table if not exists public.investment_reviews (
 id uuid primary key default gen_random_uuid(), user_id uuid not null, asset_id uuid not null,
 request_id uuid not null, created_at timestamptz not null default now(), snapshot jsonb not null,
 foreign key(asset_id,user_id) references public.investment_assets(id,user_id) on delete cascade,
 unique(user_id,request_id), unique(id,asset_id,user_id)
);
create table if not exists public.investment_position_links (
 user_id uuid not null references auth.users(id) on delete cascade,position_id uuid not null,asset_id uuid not null,
 primary key(user_id,position_id),foreign key(asset_id,user_id) references public.investment_assets(id,user_id) on delete cascade
);
create table if not exists public.investment_monitor_health (
 id boolean primary key default true check(id),last_run_at timestamptz not null,checked integer not null default 0
);
alter table public.investment_monitor_health enable row level security;
revoke all on public.investment_monitor_health from public,anon,authenticated;
grant all on public.investment_monitor_health to service_role;
create table if not exists public.investment_market_cache (
 user_id uuid not null references auth.users(id) on delete cascade,symbol text not null,currency text not null,
 source text not null check(source in ('stored','csv','alphavantage','eodhd','independent')),
 snapshot jsonb not null,updated_at timestamptz not null default now(),primary key(user_id,symbol,currency,source)
);
create table if not exists public.investment_operation_locks (
 user_id uuid not null,asset_id uuid not null,kind text not null check(kind in ('review','chat')),
 token uuid not null,expires_at timestamptz not null,
 primary key(user_id,asset_id,kind),foreign key(asset_id,user_id) references public.investment_assets(id,user_id) on delete cascade
);
create table if not exists public.investment_review_usage (
 user_id uuid not null references auth.users(id) on delete cascade,usage_date date not null,kind text not null,
 runs integer not null,primary key(user_id,usage_date,kind)
);
create table if not exists public.investment_chat_messages (
 id uuid primary key default gen_random_uuid(),sequence bigint generated always as identity,user_id uuid not null,asset_id uuid not null,review_id uuid,
 request_id uuid not null,role text not null check(role in ('user','assistant','note','external')),
 content text not null check(length(content) between 1 and 12000),provider text not null default 'none',
 model text,evidence_ids jsonb not null default '[]',is_error boolean not null default false,created_at timestamptz not null default now(),
 foreign key(asset_id,user_id) references public.investment_assets(id,user_id) on delete cascade,
 foreign key(review_id,asset_id,user_id) references public.investment_reviews(id,asset_id,user_id),unique(user_id,request_id,role)
);
create index if not exists investment_reviews_owner_asset on public.investment_reviews(user_id,asset_id,created_at desc);
create index if not exists investment_chat_owner_asset on public.investment_chat_messages(user_id,asset_id,created_at);
create index if not exists investment_assets_due on public.investment_assets(next_check_at) where enabled;
do $$ declare t text; begin
 foreach t in array array['investment_assets','investment_reviews','investment_position_links','investment_market_cache','investment_operation_locks','investment_review_usage','investment_chat_messages'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 foreach t in array array['investment_assets','investment_reviews','investment_chat_messages'] loop
  execute format('drop policy if exists investment_owner_read on public.%I',t);
  execute format('create policy investment_owner_read on public.%I for select to authenticated using(user_id=auth.uid())',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create or replace function public.claim_investment_operation(p_user_id uuid,p_asset_id uuid,p_kind text,p_token uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare allowed boolean;
begin
 if p_kind not in ('review','chat') or not exists(select 1 from investment_assets where id=p_asset_id and user_id=p_user_id) then return false;end if;
 insert into investment_operation_locks(user_id,asset_id,kind,token,expires_at)
 values(p_user_id,p_asset_id,p_kind,p_token,now()+interval '2 minutes')
 on conflict(user_id,asset_id,kind) do update set token=excluded.token,expires_at=excluded.expires_at
 where investment_operation_locks.expires_at<now() returning true into allowed;
 return coalesce(allowed,false);
end $$;
create or replace function public.reserve_investment_operation(p_user_id uuid,p_kind text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare allowed boolean; maximum integer;
begin
 maximum=case p_kind when 'review' then 40 when 'chat' then 20 else 0 end;
 if maximum=0 then return false;end if;
 insert into investment_review_usage(user_id,usage_date,kind,runs) values(p_user_id,(now() at time zone 'utc')::date,p_kind,1)
 on conflict(user_id,usage_date,kind) do update set runs=investment_review_usage.runs+1
 where investment_review_usage.runs<maximum returning true into allowed;
 return coalesce(allowed,false);
end $$;
create or replace function public.commit_investment_review(p_user_id uuid,p_asset_id uuid,p_token uuid,p_request_id uuid,p_snapshot jsonb,p_key text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare a investment_assets; rid uuid; stamp timestamptz;
begin
 select * into a from investment_assets where id=p_asset_id and user_id=p_user_id for update;
 if a.id is null or not exists(select 1 from investment_operation_locks where user_id=p_user_id and asset_id=p_asset_id and kind='review' and token=p_token and expires_at>now()) then raise exception 'Review lease expired';end if;
 select id into rid from investment_reviews where user_id=p_user_id and request_id=p_request_id;
 if rid is not null then return rid;end if;
 rid=a.latest_review_id;stamp=a.analysis_at;
 if a.last_key is distinct from p_key or rid is null then
  insert into investment_reviews(user_id,asset_id,request_id,snapshot) values(p_user_id,p_asset_id,p_request_id,p_snapshot) returning id into rid;
  if p_snapshot->'decision'->>'current'='true' and p_snapshot->'analysis' is not null and p_snapshot->'analysis'<>'null'::jsonb then stamp=(p_snapshot->>'created_at')::timestamptz;end if;
 end if;
 update investment_assets set latest_review_id=rid,analysis_at=stamp,checked_at=now(),next_check_at=now()+interval '30 minutes',last_key=p_key,
 state=jsonb_build_object('price',coalesce(nullif(p_snapshot->'price','null'::jsonb),a.state->'price'),
 'price_date',case when p_snapshot->>'price' is not null then p_snapshot->'price_date' else a.state->'price_date' end,
 'provider',case when p_snapshot->>'price' is not null then p_snapshot->'provider' else a.state->'provider' end,'quote',p_snapshot->'quote',
 'decision',p_snapshot->'decision','news',p_snapshot->'news','last_attempt',coalesce(nullif(p_snapshot->'attempt','null'::jsonb),a.state->'last_attempt'),'warnings',p_snapshot->'warnings')
 where id=p_asset_id and user_id=p_user_id;
 return rid;
end $$;
create or replace function public.commit_investment_chat(p_user_id uuid,p_asset_id uuid,p_token uuid,p_request_id uuid,p_review_id uuid,p_content text,p_answer jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from investment_operation_locks where user_id=p_user_id and asset_id=p_asset_id and kind='chat' and token=p_token and expires_at>now()) then raise exception 'Chat lease expired';end if;
 if p_review_id is not null and not exists(select 1 from investment_reviews where id=p_review_id and asset_id=p_asset_id and user_id=p_user_id) then raise exception 'Foreign review';end if;
 insert into investment_chat_messages(user_id,asset_id,review_id,request_id,role,content) values(p_user_id,p_asset_id,p_review_id,p_request_id,'user',p_content) on conflict(user_id,request_id,role) do nothing;
 insert into investment_chat_messages(user_id,asset_id,review_id,request_id,role,content,provider,model,evidence_ids,is_error)
 values(p_user_id,p_asset_id,p_review_id,p_request_id,'assistant',p_answer->>'answer',coalesce(p_answer->>'provider','none'),p_answer->>'model',coalesce(p_answer->'evidence_ids','[]'::jsonb),coalesce((p_answer->>'is_error')::boolean,false)) on conflict(user_id,request_id,role) do nothing;
end $$;
revoke all on function public.claim_investment_operation(uuid,uuid,text,uuid),public.reserve_investment_operation(uuid,text),public.commit_investment_review(uuid,uuid,uuid,uuid,jsonb,text),public.commit_investment_chat(uuid,uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_investment_operation(uuid,uuid,text,uuid),public.reserve_investment_operation(uuid,text),public.commit_investment_review(uuid,uuid,uuid,uuid,jsonb,text),public.commit_investment_chat(uuid,uuid,uuid,uuid,uuid,text,jsonb) to service_role;
-- Global protection for the additional Alpha Vantage key; never pooled with EODHD.
create table if not exists public.alphavantage_data_usage(usage_date date primary key,runs integer not null check(runs between 1 and 25));
alter table public.alphavantage_data_usage enable row level security;
revoke all on public.alphavantage_data_usage from public,anon,authenticated;
grant all on public.alphavantage_data_usage to service_role;
create or replace function public.reserve_alphavantage_call(p_calls integer default 1)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare allowed boolean;
begin
 if p_calls is null or p_calls<>1 then return false;end if;
 insert into alphavantage_data_usage(usage_date,runs) values((now() at time zone 'utc')::date,1)
 on conflict(usage_date) do update set runs=alphavantage_data_usage.runs+1 where alphavantage_data_usage.runs<25 returning true into allowed;
 return coalesce(allowed,false);
end $$;
revoke all on function public.reserve_alphavantage_call(integer) from public,anon,authenticated;
grant execute on function public.reserve_alphavantage_call(integer) to service_role;
commit;
