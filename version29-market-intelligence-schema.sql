-- Investition Dashboard V29.0
-- Datenfelder für nachvollziehbare News-Bewertungen.
-- Idempotent: kann erneut ausgeführt werden.

do $$
begin
  if to_regclass('public.market_news') is null then
    raise exception
      'Tabelle public.market_news fehlt. Zuerst das bisherige News-Schema installieren.';
  end if;
end
$$;

alter table public.market_news
  add column if not exists assessment_version text not null default 'legacy-v28';

alter table public.market_news
  add column if not exists evaluated_at timestamptz;

alter table public.market_news
  add column if not exists primary_symbol text;

alter table public.market_news
  add column if not exists event_type text not null default 'general';

alter table public.market_news
  add column if not exists direction text not null default 'neutral';

alter table public.market_news
  add column if not exists relevance_score smallint not null default 50;

alter table public.market_news
  add column if not exists confidence_score smallint not null default 35;

alter table public.market_news
  add column if not exists impact_score smallint not null default 50;

alter table public.market_news
  add column if not exists urgency_score smallint not null default 35;

alter table public.market_news
  add column if not exists relevance_reason text not null default '';

alter table public.market_news
  add column if not exists priced_in_state text not null default 'unklar';

alter table public.market_news
  add column if not exists analyst_signal text not null default 'nicht_verfuegbar';

alter table public.market_news
  add column if not exists action_code text not null default 'observe';

alter table public.market_news
  add column if not exists recommended_action text not null default '';

alter table public.market_news
  add column if not exists price_reaction_percent numeric;

alter table public.market_news
  add column if not exists normal_move_percent numeric;

alter table public.market_news
  add column if not exists analyst_target_price numeric;

alter table public.market_news
  add column if not exists analyst_target_upside_percent numeric;

alter table public.market_news
  add column if not exists analyst_currency text;

alter table public.market_news
  add column if not exists data_quality text not null default 'niedrig';

alter table public.market_news
  add column if not exists analysis_basis jsonb not null default '{}'::jsonb;

update public.market_news
set
  relevance_score = case lower(coalesce(impact, 'mittel'))
    when 'hoch' then 82
    when 'niedrig' then 38
    else 60
  end,
  impact_score = case lower(coalesce(impact, 'mittel'))
    when 'hoch' then 80
    when 'niedrig' then 35
    else 58
  end,
  relevance_reason = case
    when coalesce(relevance_reason, '') = ''
      then 'Bestandsmeldung aus einer früheren Dashboard-Version; beim nächsten Sync wird sie neu bewertet.'
    else relevance_reason
  end
where assessment_version = 'legacy-v28';

create index if not exists idx_market_news_v29_priority
  on public.market_news(
    is_published,
    relevance_score desc,
    urgency_score desc,
    published_at desc
  );

create index if not exists idx_market_news_v29_pricing
  on public.market_news(priced_in_state, published_at desc);

comment on column public.market_news.relevance_score is
  'Regelbasierte Grundrelevanz 0–100; das Dashboard ergänzt den persönlichen Portfolio-/Watchlist-Bezug.';
comment on column public.market_news.confidence_score is
  'Daten- und Zuordnungsqualität der automatischen Bewertung 0–100.';
comment on column public.market_news.impact_score is
  'Erwartete bzw. beobachtete Marktwirkung 0–100.';
comment on column public.market_news.urgency_score is
  'Zeitliche Dringlichkeit der Prüfung 0–100.';
comment on column public.market_news.priced_in_state is
  'Indikation aus Nachrichtensignal, Kursreaktion und Normalbewegung; keine beweisbare Tatsache.';
comment on column public.market_news.analysis_basis is
  'Maschinenlesbare Bewertungsgrundlage mit Datenquellen, Messfenster und Einschränkungen.';
