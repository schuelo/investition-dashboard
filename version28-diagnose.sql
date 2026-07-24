-- V28.0 Diagnose: nur lesend.
select
  c.relname as tabelle,
  c.relrowsecurity as rls_aktiv,
  pg_size_pretty(pg_total_relation_size(c.oid)) as groesse
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('portfolio_snapshots','analyst_revisions','depot_positions','market_events','market_news','valuation_scenarios','signal_outcomes')
order by c.relname;

select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('portfolio_snapshots','analyst_revisions')
order by tablename, policyname;
