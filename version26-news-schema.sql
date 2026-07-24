-- Version 26: Deduplizierung sofortiger Portfolio-News-Benachrichtigungen
create table if not exists public.news_notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  news_id uuid not null references public.market_news(id) on delete cascade,
  delivery_channel text not null default 'telegram',
  delivered_at timestamptz not null default now(),
  unique(user_id, news_id, delivery_channel)
);
create index if not exists idx_news_notification_log_user_time on public.news_notification_log(user_id, delivered_at desc);
alter table public.news_notification_log enable row level security;
drop policy if exists news_notification_log_own on public.news_notification_log;
create policy news_notification_log_own on public.news_notification_log for select using (auth.uid() = user_id);

-- Empfohlene Indizes für den priorisierten Feed
create index if not exists idx_market_news_published_impact on public.market_news(is_published, impact, published_at desc);
create index if not exists idx_market_news_symbols_gin on public.market_news using gin(symbols);
