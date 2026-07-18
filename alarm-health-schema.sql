-- Ergänzt Diagnosefelder für den Alarmstatus im Dashboard.
alter table public.alert_state
  add column if not exists quote_at timestamptz,
  add column if not exists last_error text,
  add column if not exists data_source text;

comment on column public.alert_state.quote_at is
  'Zeitstempel des vom Kursanbieter gelieferten Kurses.';
comment on column public.alert_state.last_error is
  'Letzter Fehler der Kurs- oder Alarmprüfung für diesen Trade.';
comment on column public.alert_state.data_source is
  'Verwendete Kursquelle, z. B. EODHD Live (verzögert).';
