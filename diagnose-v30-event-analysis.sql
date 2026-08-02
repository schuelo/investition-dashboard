-- Lesende Diagnose für V30.1 Event- & Szenarioanalyse

with required(table_name) as (
  values
    ('event_analyses'),
    ('event_analysis_assets'),
    ('event_analysis_scenarios'),
    ('event_analysis_sources'),
    ('event_analysis_signals')
)
select
  required.table_name,
  to_regclass('public.' || required.table_name) is not null as vorhanden
from required
order by required.table_name;

select
  created_at,
  event_title,
  market_relevance,
  portfolio_impact,
  confidence_score,
  pricing_state,
  analysis_scope
from public.event_analyses
where user_id = auth.uid()
order by created_at desc
limit 20;

select
  analysis_id,
  count(*) filter (where is_portfolio_position) as portfolio_werte,
  count(*) filter (where is_watchlist_position) as watchlist_werte,
  count(*) filter (where not is_portfolio_position and not is_watchlist_position) as marktideen,
  count(*) filter (where is_fallback_idea) as rueckfallhypothesen,
  count(*) filter (where overlaps_portfolio) as ideen_auch_im_portfolio,
  count(*) filter (where overlaps_watchlist) as ideen_auch_in_watchlist,
  count(*) filter (where is_fallback_idea) as rueckfallhypothesen,
  count(*) filter (where overlaps_portfolio) as ideen_auch_im_portfolio,
  count(*) filter (where overlaps_watchlist) as ideen_auch_in_watchlist
from public.event_analysis_assets
where user_id = auth.uid()
group by analysis_id
order by max(created_at) desc
limit 20;
