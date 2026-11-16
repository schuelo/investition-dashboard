-- V39.2 after the V39.1 migration: direct, atomic position entry without quote providers or analysis.
begin;
alter table public.depot_positions add column if not exists entry_date date;
alter table public.investment_assets add column if not exists valuation_override jsonb;
create table if not exists public.investment_depot_requests(
 user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,
 input jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,request_id)
);
alter table public.investment_depot_requests enable row level security;
revoke all on public.investment_depot_requests from public,anon,authenticated;
grant all on public.investment_depot_requests to service_role;
create or replace function public.save_depot_position(
 p_user_id uuid,p_request_id uuid,p_asset_id uuid default null,p_symbol text default null,p_currency text default null,p_company text default null,
 p_wkn text default null,p_isin text default null,p_position_id uuid default null,p_legacy_trade_id uuid default null,
 p_quantity numeric default null,p_entry numeric default null,p_direction text default 'Long',p_type text default 'Aktie',p_entry_date date default null,
 p_valuation_mode text default 'keep',p_manual_price numeric default null,p_manual_price_date date default null,p_close boolean default false,p_additional_confirmed boolean default false
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a investment_assets; prior investment_depot_requests; payload jsonb; saved jsonb; answer jsonb; pid uuid; legacy_id uuid; keep_disabled boolean;
begin
 if p_user_id is null or p_request_id is null then raise exception 'Owner or request missing';end if;
 payload=jsonb_build_object('asset_id',p_asset_id,'symbol',p_symbol,'currency',p_currency,'company',p_company,'wkn',p_wkn,'isin',p_isin,
  'position_id',p_position_id,'legacy_trade_id',p_legacy_trade_id,'quantity',p_quantity,'entry',p_entry,'direction',p_direction,'type',p_type,
  'entry_date',p_entry_date,'valuation_mode',p_valuation_mode,'manual_price',p_manual_price,'manual_price_date',p_manual_price_date,'close',p_close,'additional_confirmed',p_additional_confirmed);
 select * into prior from investment_depot_requests where user_id=p_user_id and request_id=p_request_id;
 if found then
  if prior.input is distinct from payload then raise exception 'Request reference already used';end if;
  return prior.result;
 end if;
 if p_symbol is null or p_symbol !~ '^[A-Z0-9_^+\-]{1,25}\.[A-Z0-9]{1,12}$' or p_currency is null or p_currency not in ('EUR','USD','GBP','GBX','CHF','JPY','KRW','CNY','HKD','SEK','AUD','CAD','INR') then raise exception 'Exact security and currency required';end if;
 if p_entry_date>(now() at time zone 'Europe/Berlin')::date then raise exception 'Entry date in future';end if;
 if p_valuation_mode is null or p_valuation_mode not in ('keep','market','manual') then raise exception 'Invalid valuation mode';end if;
 if p_valuation_mode='manual' and (p_manual_price is null or p_manual_price<=0 or p_manual_price>1000000000 or p_manual_price::text in ('NaN','Infinity','-Infinity') or p_manual_price_date is null or p_manual_price_date>(now() at time zone 'Europe/Berlin')::date) then raise exception 'Valid manual price and date required';end if;
 if p_asset_id is not null then
  select * into a from investment_assets where id=p_asset_id and user_id=p_user_id for update;
  if a.id is null then raise exception 'Own asset missing';end if;
  if a.symbol<>p_symbol or a.currency<>p_currency then raise exception 'Asset identity mismatch';end if;
 else
  insert into investment_assets(user_id,symbol,currency,company,config,is_portfolio,watchlisted,enabled)
  values(p_user_id,p_symbol,p_currency,coalesce(nullif(p_company,''),p_symbol),jsonb_build_object('symbol',p_symbol,'currency',p_currency,'company',coalesce(p_company,p_symbol),'source','stored','wkn',p_wkn,'isin',p_isin),false,false,false)
  on conflict(user_id,symbol,currency) do nothing;
  select * into a from investment_assets where user_id=p_user_id and symbol=p_symbol and currency=p_currency for update;
 end if;
 select * into prior from investment_depot_requests where user_id=p_user_id and request_id=p_request_id;
 if found then
  if prior.input is distinct from payload then raise exception 'Request reference already used';end if;
  return prior.result;
 end if;
 if not p_close and p_position_id is null and not coalesce(p_additional_confirmed,false)
 and not exists(select 1 from trade_plans t where t.id=p_legacy_trade_id and t.user_id=p_user_id and t.id=any(a.legacy_trade_ids) and lower(coalesce(t.status,'')) in ('position offen','teilverkauf','open','partially sold') and t.quantity>0 and not exists(select 1 from depot_positions d where d.user_id=p_user_id and d.trade_id=t.id))
 and exists(select 1 from depot_positions d left join trade_plans t on t.id=d.trade_id and t.user_id=d.user_id where d.user_id=p_user_id and d.is_open is not false and d.id<>p_request_id and (
  exists(select 1 from investment_position_links l where l.user_id=p_user_id and l.position_id=d.id and l.asset_id=a.id)
  or (coalesce(d.currency,t.currency)=a.currency and (d.symbol=a.symbol or t.market_symbol=a.symbol or t.id=any(a.legacy_trade_ids)))
 )) then raise exception 'Additional position requires confirmation';end if;
 keep_disabled=a.is_portfolio and not a.enabled;
 legacy_id=p_legacy_trade_id;
 if not p_close and p_position_id is null and legacy_id is null then
  -- Old base tables may require an explicit id rather than supplying a UUID default.
  legacy_id=gen_random_uuid();
  insert into trade_plans(id,user_id,name,symbol,market_symbol,currency,instrument_type,direction,status,monitoring_enabled)
  values(legacy_id,p_user_id,coalesce(nullif(p_company,''),a.company),case when p_symbol like '%.XETRA' then 'XETR:'||split_part(p_symbol,'.',1) else p_symbol end,p_symbol,p_currency,p_type,p_direction,'Position offen',false);
  update investment_assets set legacy_trade_ids=legacy_trade_ids||array[legacy_id] where id=a.id and user_id=p_user_id;
 end if;
 saved=save_investment_holding(p_user_id,a.id,p_request_id,p_position_id,legacy_id,p_quantity,p_entry,p_direction,p_type,p_close);
 pid=(saved->>'id')::uuid;
 if not p_close then
  update depot_positions set entry_date=p_entry_date where id=pid and user_id=p_user_id;
  update investment_assets set company=coalesce(nullif(p_company,''),company),config=config||jsonb_build_object('wkn',coalesce(p_wkn,''),'isin',coalesce(p_isin,'')),
   enabled=case when keep_disabled then false else enabled end,
   valuation_override=case p_valuation_mode when 'manual' then jsonb_build_object('price',p_manual_price,'price_date',p_manual_price_date,'source','manual','recorded_at',now()) when 'market' then null else valuation_override end
  where id=a.id and user_id=p_user_id;
 end if;
 select * into a from investment_assets where id=a.id and user_id=p_user_id;
 answer=saved||jsonb_build_object('asset_id',a.id,'asset',to_jsonb(a),'saved',true);
 insert into investment_depot_requests(user_id,request_id,input,result) values(p_user_id,p_request_id,payload,answer);
 return answer;
end $$;
revoke all on function public.save_depot_position(uuid,uuid,uuid,text,text,text,text,text,uuid,uuid,numeric,numeric,text,text,date,text,numeric,date,boolean,boolean) from public,anon,authenticated;
grant execute on function public.save_depot_position(uuid,uuid,uuid,text,text,text,text,text,uuid,uuid,numeric,numeric,text,text,date,text,numeric,date,boolean,boolean) to service_role;
commit;
