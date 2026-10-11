-- New module only. Existing tables, functions, schedules and recipients unchanged.
begin;
create table if not exists public.signal_news_triggers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  news_id uuid not null references public.market_news(id) on delete cascade,
  news_title text not null,
  news_published_at timestamptz not null,
  source_url text,
  symbols text[] not null default '{}',
  reason text not null,
  state text not null default 'pending' check (state in ('pending','analyzed','dismissed')),
  analysis_id uuid references public.signal_simulations(id) on delete set null,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id,news_id)
);
create index if not exists signal_news_triggers_user_time on public.signal_news_triggers(user_id,created_at desc);
alter table public.signal_news_triggers enable row level security;
drop policy if exists signal_news_triggers_own_read on public.signal_news_triggers;
create policy signal_news_triggers_own_read on public.signal_news_triggers for select to authenticated using (user_id = auth.uid());
drop policy if exists signal_news_triggers_own_update on public.signal_news_triggers;
create policy signal_news_triggers_own_update on public.signal_news_triggers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and state = 'dismissed');
revoke all on public.signal_news_triggers from anon,authenticated;
grant select on public.signal_news_triggers to authenticated;
grant update(state) on public.signal_news_triggers to authenticated;
grant all on public.signal_news_triggers to service_role;

create or replace function public.record_signal_news_trigger(p_user_id uuid,p_news_id uuid,p_symbols text[],p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare trigger_id uuid;
begin
  insert into public.signal_news_triggers(user_id,news_id,news_title,news_published_at,source_url,symbols,reason)
  select p_user_id,n.id,n.title,n.published_at,n.source_url,p_symbols,left(p_reason,1000)
  from public.market_news n where n.id=p_news_id and n.is_published=true
  on conflict(user_id,news_id) do update set news_title=excluded.news_title,symbols=excluded.symbols,reason=excluded.reason
  returning id into trigger_id;
  return trigger_id;
end;
$$;
revoke all on function public.record_signal_news_trigger(uuid,uuid,text[],text) from public,anon,authenticated;
grant execute on function public.record_signal_news_trigger(uuid,uuid,text[],text) to service_role;
commit;
