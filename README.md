# Investition Dashboard v16

## Was wurde behoben?

### TradingView
- Die grauen bzw. schwer bedienbaren Auswahlfelder wurden durch echte Touch-Schaltflächen ersetzt.
- **Kursverlauf**: 1T, 5T, 1M, 3M, 6M, 1J, 5J, Max.
- **Analysechart**: 1m, 5m, 15m, 1h, 4h, 1T, 1W, 1M.
- Der Kursverlauf verwendet das aktuelle TradingView-Widget **Symbol Overview** statt des Legacy-Mini-Widgets.
- Jeder Klick lädt das TradingView-Widget mit dem gewählten Zeitraum bzw. Intervall neu.

### News Feed
- Neue Diagnoseanzeige für Cloud-Anmeldung, Tabelle, Sync-Function und Datenquelle.
- `Feed aktualisieren` erzwingt einen Serverabruf und zeigt die konkrete Fehlermeldung an.
- Die neue `sync-news` Function nutzt **GDELT** als offene Newsquelle. Für den Newsfeed ist deshalb kein kostenpflichtiger EODHD-News-Tarif erforderlich.
- EODHD bleibt unverändert für die Kurs- und Alarmprüfung zuständig.

## A. GitHub aktualisieren

Lade diese Dateien direkt in das Hauptverzeichnis des Repositorys:

- `index.html`
- `app.js`
- `supabase.js`
- `news.js`
- `service-worker.js`
- `reset.html`
- `startdaten.json`
- `.nojekyll` (falls vorhanden)

Nicht in einen Unterordner hochladen. Danach `Commit changes`.

Öffne anschließend auf dem iPhone:

`https://schuelo.github.io/investition-dashboard/reset.html?v=16`

Tippe auf **Jetzt zurücksetzen** und öffne danach:

`https://schuelo.github.io/investition-dashboard/?v=16`

## B. News-Tabelle anlegen

Supabase → SQL Editor → New query:

1. Inhalt von `news-schema.sql` einfügen.
2. **Run** drücken.

## C. News-Function ersetzen oder anlegen

Supabase → Edge Functions:

1. Function `sync-news` öffnen oder neu anlegen.
2. Vollständigen Inhalt von `sync-news-index.ts` einsetzen.
3. **Verify JWT deaktivieren**.
4. **Deploy function**.

Für den manuellen Abruf aus dem angemeldeten Dashboard ist kein neues Secret erforderlich. Für den Cronjob bleibt `CRON_SECRET` notwendig.

## D. Newsfeed testen

1. Im Dashboard in der Cloud anmelden.
2. **News Feed** öffnen.
3. **Feed aktualisieren** drücken.
4. Die Diagnosefelder müssen anzeigen:
   - Cloud-Anmeldung: deine E-Mail
   - Supabase-Tabelle: erreichbar
   - Sync-Function: erfolgreich
   - News-Quelle: GDELT

## E. News-Cronjob aktivieren

Voraussetzung: Das Vault-Secret `investment_cron_secret` enthält denselben Wert wie das Edge-Function-Secret `CRON_SECRET`.

Im SQL Editor den Inhalt von `setup-news-cron-v16.sql` ausführen. Der Feed wird danach stündlich aktualisiert.

## F. Diagnose bei leerem Feed

Im SQL Editor `news-diagnose.sql` ausführen. Entscheidend sind:

- `market_news_table` darf nicht `null` sein.
- `total_news` sollte nach dem ersten Sync größer als 0 sein.
- Der Cronjob `sync-investment-news` sollte `active = true` anzeigen.

## G. TradingView bedienen

- Wähle **Kursverlauf**, um den gesamten Zeitraum über die Schalter zu ändern.
- Wähle **Analysechart**, um die Kerzenauflösung über die Schalter zu ändern.
- Die Schalter befinden sich oberhalb des Charts und werden türkis markiert, wenn sie aktiv sind.
- TradingView kann je Handelsplatz verzögerte Daten anzeigen. Das ist unabhängig von den EODHD-Telegram-Alarmen.
