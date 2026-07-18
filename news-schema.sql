-- News Feed für „10 · Wöchentlicher Marktausblick“
create extension if not exists pgcrypto;

create table if not exists public.market_news (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  published_at timestamptz not null,
  topic text not null default 'Sonstiges',
  title text not null,
  summary text,
  content text,
  source_url text,
  source_name text,
  symbols text[] not null default '{}',
  tags text[] not null default '{}',
  sentiment numeric,
  impact text not null default 'mittel' check (impact in ('hoch','mittel','niedrig')),
  market_impact text,
  priced_in text not null default 'Noch nicht bewertet',
  analyst_view text not null default 'Noch nicht bewertet',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_news_published_idx on public.market_news(published_at desc);
create index if not exists market_news_topic_idx on public.market_news(topic, published_at desc);
create index if not exists market_news_symbols_gin_idx on public.market_news using gin(symbols);
create index if not exists market_news_tags_gin_idx on public.market_news using gin(tags);

create or replace function public.market_news_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end
$$;

drop trigger if exists market_news_updated_at on public.market_news;
create trigger market_news_updated_at before update on public.market_news
for each row execute function public.market_news_set_updated_at();

alter table public.market_news enable row level security;

drop policy if exists "market_news_authenticated_read" on public.market_news;
create policy "market_news_authenticated_read"
on public.market_news for select to authenticated
using (is_published = true);

grant select on public.market_news to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.market_news;
exception when duplicate_object then null;
end $$;
