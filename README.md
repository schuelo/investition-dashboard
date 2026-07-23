# Investition Dashboard V26.0 – News Intelligence

V26 erweitert V25.2.1 um einen priorisierten Nachrichtenfeed für tatsächlich gehaltene Depotpositionen, Watchlist-Werte, Branchen und Makrothemen.

## Neu in V26

- Portfolio-News werden automatisch aus `depot_positions` abgeleitet und zuerst angezeigt.
- Watchlist-News werden aus offenen Trade-Plänen abgeleitet, die nicht als Depotposition gehalten werden.
- Gezielte EODHD-Newsabfragen je Wertpapier sowie zusätzliche Themenabfragen.
- Automatische Symbol- und Namensverknüpfung.
- Prioritätsstufen Portfolio, Watchlist, Branche und Markt.
- Relevanzbewertung mit 1–5 Sternen.
- Direkte Verknüpfung von Meldungen zur zugehörigen Analyse.
- Sofortige Telegram-Hinweise für neue relevante Portfolio-Nachrichten über die Function `send-news-alerts`.
- Deduplizierung versendeter Telegram-Nachrichten über `news_notification_log`.

## 1. Sicherung

Vor dem Update Dashboard- und Entscheidungsdaten exportieren. Datenbanktabellen und bestehende Edge Functions nicht löschen.

## 2. Datenbankmigration

Im Supabase SQL Editor ausführen:

`version26-news-schema.sql`

Die Migration legt nur das Benachrichtigungsprotokoll und zusätzliche Indizes an.

## 3. Edge Function `sync-news` aktualisieren

In Supabase unter **Edge Functions → sync-news** den Inhalt durch `sync-news-index-v26.ts` ersetzen und deployen.

Erforderliche Secrets:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` oder `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PUBLISHABLE_KEY` oder `SUPABASE_ANON_KEY`
- `EODHD_API_TOKEN`
- `CRON_SECRET`

## 4. Edge Function `send-news-alerts` erstellen

Neue Function mit dem Namen `send-news-alerts` anlegen, den Inhalt aus `send-news-alerts-index-v26.ts` einsetzen und deployen.

Zusätzlich erforderlich:

- `TELEGRAM_BOT_TOKEN`

Die vorhandene Telegram-Verbindung aus `notification_settings` wird weiterverwendet.

## 5. Zeitpläne einrichten

`setup-v26-news-cron.sql` öffnen, `DEIN_CRON_SECRET` durch den tatsächlichen Wert ersetzen und im SQL Editor ausführen.

Ablauf:

- Minute 07 jeder Stunde: Portfolio- und Markt-News synchronisieren.
- Minute 17 jeder Stunde: neue relevante Portfolio-News per Telegram versenden.

## 6. GitHub Pages aktualisieren

Aus dem GitHub-Paket folgende Dateien in das Repository-Hauptverzeichnis laden und vorhandene Dateien ersetzen:

- `index.html`
- `app.js`
- `news.js`
- `decision.js`
- `service-worker.js`
- `reset.html`
- `supabase.js`
- `startdaten.json`
- `.nojekyll`

Danach committen.

## 7. Cache zurücksetzen

Auf dem iPhone öffnen:

`https://schuelo.github.io/investition-dashboard/reset.html?v=26.0`

Anschließend:

`https://schuelo.github.io/investition-dashboard/?v=26.0`

## Bedienung

Im News-Bereich zeigen die vier Kacheln die Anzahl der Meldungen für:

1. Portfolio
2. Watchlist
3. Branche und Themen
4. Markt und Makro

Ein Tippen auf eine Kachel aktiviert oder entfernt den Filter. Innerhalb jeder Gruppe werden Meldungen nach Relevanz und danach nach Veröffentlichungszeit sortiert.

## Wichtige fachliche Grenze

Die automatische Auswirkungs-, Einpreisungs- und Analystenbewertung ist eine Vorbewertung auf Basis des Newsfeeds. Sie ersetzt keine Prüfung der Originalquelle, Kursreaktion, Unternehmensmeldung und aktuellen Analystendaten.
