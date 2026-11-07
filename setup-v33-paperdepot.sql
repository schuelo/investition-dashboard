-- V33 additive only. Run once in Supabase SQL Editor after V32.
begin;
create table if not exists public.paper_portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  config jsonb not null,
  state jsonb not null,
  version integer not null default 0,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id)
);
create table if not exists public.paper_events (
  id bigint generated always as identity primary key,
  portfolio_id uuid not null,
  user_id uuid not null,
  event_key text not null,
  event jsonb not null,
  foreign key(portfolio_id,user_id) references public.paper_portfolios(id,user_id) on delete cascade,
  unique(portfolio_id,event_key)
);
create table if not exists public.paper_nav (
  portfolio_id uuid not null,
  user_id uuid not null,
  date date not null,
  accounts jsonb not null,
  primary key(portfolio_id,date),
  foreign key(portfolio_id,user_id) references public.paper_portfolios(id,user_id) on delete cascade
);
alter table public.paper_portfolios enable row level security;
alter table public.paper_events enable row level security;
alter table public.paper_nav enable row level security;
drop policy if exists paper_owner_read on public.paper_portfolios;
create policy paper_owner_read on public.paper_portfolios for select to authenticated using(user_id=auth.uid());
drop policy if exists paper_owner_read on public.paper_events;
create policy paper_owner_read on public.paper_events for select to authenticated using(user_id=auth.uid());
drop policy if exists paper_owner_read on public.paper_nav;
create policy paper_owner_read on public.paper_nav for select to authenticated using(user_id=auth.uid());
revoke all on public.paper_portfolios,public.paper_events,public.paper_nav from anon,authenticated;
grant select on public.paper_portfolios,public.paper_events,public.paper_nav to authenticated;
grant all on public.paper_portfolios,public.paper_events,public.paper_nav to service_role;
grant usage,select on sequence public.paper_events_id_seq to service_role;

-- One atomic compare-and-swap transaction: a conflicting update cannot book twice.
create or replace function public.commit_paper_portfolio(p_user_id uuid,p_id uuid,p_version integer,p_config jsonb,p_state jsonb,p_events jsonb,p_nav jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.paper_portfolios; item jsonb; account jsonb;
begin
  if p_state is null or jsonb_typeof(p_state->'accounts') is distinct from 'object' or jsonb_array_length(p_events)>5000 or jsonb_array_length(p_nav)>100 then raise exception 'Invalid paper result'; end if;
  for account in select value from jsonb_each(p_state->'accounts') loop
    if (account->>'cash')::numeric < -0.00001 then raise exception 'Negative paper cash'; end if;
  end loop;
  if p_id is null then
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,33));
    if (select count(*) from public.paper_portfolios where user_id=p_user_id)>=10 then raise exception 'Maximal 10 Experimente; vorhandenes Experiment auswählen'; end if;
    insert into public.paper_portfolios(user_id,config,state) values(p_user_id,p_config,p_state) returning * into r;
  else
    select * into r from public.paper_portfolios where id=p_id and user_id=p_user_id for update;
    if not found or r.version<>p_version or r.paused or r.config<>p_config then raise exception 'Experiment pausiert oder parallel aktualisiert. Neu laden'; end if;
    update public.paper_portfolios set state=p_state,version=version+1,updated_at=now() where id=r.id;
  end if;
  for item in select value from jsonb_array_elements(p_events) loop
    insert into public.paper_events(portfolio_id,user_id,event_key,event) values(r.id,p_user_id,item->>'event_key',item);
  end loop;
  for item in select value from jsonb_array_elements(p_nav) loop
    insert into public.paper_nav(portfolio_id,user_id,date,accounts) values(r.id,p_user_id,(item->>'date')::date,item->'accounts');
  end loop;
  return r.id;
end $$;
revoke all on function public.commit_paper_portfolio(uuid,uuid,integer,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_paper_portfolio(uuid,uuid,integer,jsonb,jsonb,jsonb,jsonb) to service_role;
commit;
