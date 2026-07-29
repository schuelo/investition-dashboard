# Investition Dashboard V29.4 – konsistenter Gesamtstand

V29.4 vereinheitlicht den nach den V29.2-/V29.3-Hotfixes entstandenen
Mischstand. Frontend, Browsercache, drei Edge Functions, Shared-Module,
GitHub-Deployment, Datenbankschema, Cronjobs und Diagnose verwenden jetzt
denselben Release-Stand.

## Enthalten

- weltweite Multi-Source-News über GDELT, Yahoo Finance sowie direkte
  Institutions- und Herausgeberfeeds;
- regelbasierte Portfolio- und Market-Intelligence-Bewertung;
- EODHD ausschließlich für gecachte Schlusskurse mit höchstens sechs
  reservierten Aufrufen pro UTC-Tag;
- Stooq für kostenlose Markt-Proxys;
- Telegram-Sofortmeldungen zu relevanten Portfolio-News;
- deduplizierte Telegram-Tages- und Wochenberichte gemäß den im Dashboard
  gespeicherten Uhrzeiten;
- ein einziges idempotentes SQL-Setup für den vorhandenen Datenbestand;
- genau drei authentifizierte Hintergrundjobs;
- ein lesendes Gesamtdiagnose-Skript;
- ein gepinnter Supabase-CLI-Workflow ohne dynamische `latest`-Auflösung.

## Einheitliche Versionen

```text
Frontend:          29.4
sync-news:         29.4-multisource-hybrid-market-intelligence-sync
send-news-alerts:  29.4-multisource-hybrid-portfolio-market-intelligence-alerts
send-digest:       29.4-multisource-hybrid-digest
Bewertungsmodell:  29.4-multisource-hybrid-rule-market-intelligence
```

## Daten- und Secret-Sicherheit

`setup-v29-4-consistent.sql` löscht keine Depotpositionen, Analysen,
Meldungen oder Benutzerdaten. Es entfernt ausschließlich frühere Cronjobs,
die auf `sync-news`, `send-news-alerts` oder `send-digest` zeigen, und ersetzt
sie durch die drei aktuellen Jobs.

Das vorhandene Vault-Secret `investition_news_cron_secret` wird nur gelesen.
Das Skript enthält keinen Secret-Platzhalter und überschreibt weder
`CRON_SECRET` noch EODHD- oder Telegram-Zugangsdaten.

## Installation

Die verbindliche Reihenfolge steht in
[`INSTALLATION-V29.4.md`](./INSTALLATION-V29.4.md).

Nach der Installation prüft
[`diagnose-v29-4.sql`](./diagnose-v29-4.sql) Tabellen, Spalten, Cronjobs,
Autorisierungsheader, Function-Antworten, Sync-Versionen und Digest-Protokolle.
