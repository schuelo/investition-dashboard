-- Investition Dashboard V29.0
-- Read-only checks after installation.

-- 1. Required V29 columns
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'market_news'
  and column_name in (
    'assessment_version',
    'evaluated_at',
    'primary_symbol',
    'event_type',
    'direction',
    'relevance_score',
    'confidence_score',
    'impact_score',
    'urgency_score',
    'relevance_reason',
    'priced_in_state',
    'recommended_action',
    'analysis_basis'
  )
order by column_name;

-- Erwartung: 14 Zeilen.

-- 2. Bewertungsstand
select
  assessment_version,
  count(*) as meldungen,
  max(evaluated_at) as letzte_bewertung
from public.market_news
where is_published = true
group by assessment_version
order by letzte_bewertung desc nulls last;

-- 3. Neueste V29-Bewertungen
select
  published_at,
  title,
  primary_symbol,
  relevance_score,
  confidence_score,
  impact_score,
  urgency_score,
  direction,
  priced_in_state,
  price_reaction_percent,
  data_quality
from public.market_news
where assessment_version like '29.%'
order by published_at desc
limit 20;

-- 4. Vorhandene News-Cronjobs
select
  jobid,
  jobname,
  schedule,
  active
from cron.job
where jobname in (
  'sync-portfolio-news-hourly',
  'portfolio-news-alerts-hourly'
)
order by jobname;

-- Erwartung bei eingerichteter Automatik: 2 aktive Zeilen.

-- 5. Vault-Secret nur als Name prüfen; der geheime Wert wird nicht ausgegeben.
select
  name,
  description,
  created_at,
  updated_at
from vault.secrets
where name = 'investition_news_cron_secret';
