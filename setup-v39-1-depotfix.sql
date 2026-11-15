-- V39.1: additive bridge from saved legacy plans plus transactional real-position editing.
begin;
-- Earlier depot schemas may not contain these editable fields. Null leaves unknown legacy values unknown.
alter table public.depot_positions add column if not exists quantity numeric;
alter table public.depot_positions add column if not exists average_entry_price numeric;
alter table public.depot_positions add column if not exists direction text;
alter table public.depot_positions add column if not exists instrument_type text;
alter table public.investment_assets add column if not exists legacy_trade_ids uuid[] not null default '{}';
create index if not exists investment_legacy_plan_ids on public.investment_assets using gin(legacy_trade_ids);
create table if not exists public.investment_holding_requests(
 user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,asset_id uuid not null,
 input jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,request_id),
 foreign key(asset_id,user_id) references public.investment_assets(id,user_id) on delete cascade
);
alter table public.investment_holding_requests enable row level security;
revoke all on public.investment_holding_requests from public,anon,authenticated;
grant all on public.investment_holding_requests to service_role;
-- Serialize lease acquisition with holding writes on the same asset row.
create or replace function public.claim_investment_operation(p_user_id uuid,p_asset_id uuid,p_kind text,p_token uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare allowed boolean;
begin
 if p_kind not in ('review','chat') then return false;end if;
 perform 1 from investment_assets where id=p_asset_id and user_id=p_user_id for update;
 if not found then return false;end if;
 insert into investment_operation_locks(user_id,asset_id,kind,token,expires_at)
 values(p_user_id,p_asset_id,p_kind,p_token,now()+interval '2 minutes')
 on conflict(user_id,asset_id,kind) do update set token=excluded.token,expires_at=excluded.expires_at
 where investment_operation_locks.expires_at<now() returning true into allowed;
 return coalesce(allowed,false);
end $$;
revoke all on function public.claim_investment_operation(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_investment_operation(uuid,uuid,text,uuid) to service_role;
create or replace function public.save_investment_holding(
 p_user_id uuid,p_asset_id uuid,p_request_id uuid,p_position_id uuid default null,p_legacy_trade_id uuid default null,
 p_quantity numeric default null,p_entry numeric default null,p_direction text default 'Long',p_type text default 'Aktie',p_close boolean default false
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a investment_assets; d depot_positions; t trade_plans; pid uuid; payload jsonb; answer jsonb; receipt investment_holding_requests;
begin
 select * into a from investment_assets where id=p_asset_id and user_id=p_user_id for update;
 if a.id is null or p_request_id is null then raise exception 'Own asset or request reference missing';end if;
 payload=jsonb_build_object('position_id',p_position_id,'legacy_trade_id',p_legacy_trade_id,'quantity',p_quantity,'entry',p_entry,'direction',p_direction,'type',p_type,'close',p_close);
 select * into receipt from investment_holding_requests where user_id=p_user_id and request_id=p_request_id;
 if found then
  if receipt.asset_id<>a.id or receipt.input is distinct from payload then raise exception 'Request reference already used';end if;
  return receipt.result;
 end if;
 if exists(select 1 from investment_operation_locks where user_id=p_user_id and asset_id=p_asset_id and kind='review' and expires_at>now()) then raise exception 'Review in progress';end if;
 if p_close and p_position_id is null then
  select * into t from trade_plans where id=p_legacy_trade_id and user_id=p_user_id and id=any(a.legacy_trade_ids) for update;
  if t.id is null or t.quantity is null or t.quantity<=0 or lower(coalesce(t.instrument_type,'')) not in ('aktie','etf','stock','equity') or lower(coalesce(t.status,'')) not in ('position offen','teilverkauf','open','partially sold') then raise exception 'Own open legacy holding missing';end if;
  if exists(select 1 from depot_positions where user_id=p_user_id and trade_id=t.id) then raise exception 'Holding already migrated; reload positions';end if;
  update trade_plans set status='Geschlossen',monitoring_enabled=false where id=t.id and user_id=p_user_id;
  answer=jsonb_build_object('legacy_trade_id',t.id,'is_open',false);
  insert into investment_holding_requests(user_id,request_id,asset_id,input,result) values(p_user_id,p_request_id,a.id,payload,answer);
  return answer;
 end if;
 pid=coalesce(p_position_id,p_request_id);
 select * into d from depot_positions where id=pid and user_id=p_user_id for update;
 if p_position_id is not null and d.id is null then raise exception 'Own position missing';end if;
 if d.id is not null and not (
  exists(select 1 from investment_position_links l where l.user_id=p_user_id and l.position_id=d.id and l.asset_id=a.id)
  or (coalesce(d.currency,'')=a.currency and d.symbol=a.symbol)
  or exists(select 1 from trade_plans x where x.id=d.trade_id and x.user_id=p_user_id and x.market_symbol=a.symbol and coalesce(d.currency,x.currency)=a.currency)
 ) then raise exception 'Position identity mismatch';end if;
 if p_close then
  if d.id is null then raise exception 'Own position missing';end if;
  update depot_positions set is_open=false where id=d.id and user_id=p_user_id;
  if d.trade_id is not null and not exists(select 1 from depot_positions where trade_id=d.trade_id and user_id=p_user_id and is_open is not false) then
   update trade_plans set status='Geschlossen',monitoring_enabled=false where id=d.trade_id and user_id=p_user_id;
  end if;
  answer=jsonb_build_object('id',d.id,'is_open',false);
  insert into investment_holding_requests(user_id,request_id,asset_id,input,result) values(p_user_id,p_request_id,a.id,payload,answer);
  return answer;
 end if;
 if p_quantity is null or p_quantity<=0 or p_quantity>1000000000 or p_entry is null or p_entry<=0 or p_entry>1000000000 or p_quantity::text in ('NaN','Infinity','-Infinity') or p_entry::text in ('NaN','Infinity','-Infinity') then raise exception 'Positive actual quantity and entry price required';end if;
 if p_direction is null or p_type is null or p_direction not in ('Long','Short') or p_type not in ('Aktie','ETF') then raise exception 'Unsupported holding type';end if;
 if d.id is not null then t.id=d.trade_id;
 elsif p_legacy_trade_id is not null then
  select * into t from trade_plans where id=p_legacy_trade_id and user_id=p_user_id and id=any(a.legacy_trade_ids) for update;
  if t.id is null or lower(coalesce(t.instrument_type,'')) not in ('aktie','etf','stock','equity') or (nullif(t.currency,'') is not null and t.currency<>a.currency) then raise exception 'Own equity plan missing';end if;
 else
  insert into trade_plans(user_id,name,symbol,market_symbol,currency,instrument_type,direction,status,monitoring_enabled)
  values(p_user_id,a.company,a.symbol,a.symbol,a.currency,p_type,p_direction,'Position offen',false) returning id into t.id;
 end if;
 if d.id is null then
  insert into depot_positions(id,user_id,trade_id,name,symbol,currency,instrument_type,direction,quantity,average_entry_price,is_open)
  values(pid,p_user_id,t.id,a.company,a.symbol,a.currency,p_type,p_direction,p_quantity,p_entry,true);
 else
  update depot_positions set quantity=p_quantity,average_entry_price=p_entry,direction=p_direction,instrument_type=p_type,is_open=true where id=pid and user_id=p_user_id;
 end if;
 insert into investment_position_links(user_id,position_id,asset_id) values(p_user_id,pid,a.id) on conflict(user_id,position_id) do update set asset_id=excluded.asset_id;
 update investment_assets set is_portfolio=true,enabled=true,legacy_trade_ids=case when t.id is null then legacy_trade_ids else array(select distinct unnest(legacy_trade_ids||array[t.id])) end,
 state=state||jsonb_build_object('plan_pending',true) where id=a.id and user_id=p_user_id;
 answer=jsonb_build_object('id',pid,'trade_id',t.id,'is_open',true);
 insert into investment_holding_requests(user_id,request_id,asset_id,input,result) values(p_user_id,p_request_id,a.id,payload,answer);
 return answer;
end $$;
revoke all on function public.save_investment_holding(uuid,uuid,uuid,uuid,uuid,numeric,numeric,text,text,boolean) from public,anon,authenticated;
grant execute on function public.save_investment_holding(uuid,uuid,uuid,uuid,uuid,numeric,numeric,text,text,boolean) to service_role;
commit;
