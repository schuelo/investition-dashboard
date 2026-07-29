# Hotfix V29.3.1 – Supabase BOOT_ERROR

## Behobener Fehler

V29.3 konnte in Supabase mit folgender Meldung abbrechen:

```text
The requested module '../_shared/hybrid-sources.ts'
does not provide an export named 'gdeltDocUrl'
```

Dabei wurden beim manuellen GitHub-Upload der neue V29.3-Function-Code und eine
ältere V29.2-Fassung des gemeinsam verwendeten Moduls kombiniert.

V29.3.1 verwendet deshalb das eindeutig benannte Modul:

```text
supabase/functions/_shared/multisource-sources-v2931.ts
```

Alte oder zwischengespeicherte Fassungen von `hybrid-sources.ts` können den
Start der Function damit nicht mehr beeinflussen.

## Installation

1. Den **gesamten Inhalt** dieses Ordners in das Stammverzeichnis des
   GitHub-Repositories `investition-dashboard` hochladen und vorhandene Dateien
   überschreiben.
2. In GitHub **Actions → Supabase Functions deployen → Run workflow** öffnen.
3. Warten, bis der Job `deploy` und beide Schritte
   `News-Sync deployen` sowie `Telegram-News deployen` grün sind.
4. Im Dashboard einmal **News Feed → Feed aktualisieren** ausführen.

Keine SQL-Migration, kein Reset des Dashboards und keine Änderung von
`CRON_SECRET` oder `EODHD_API_TOKEN` sind erforderlich.

## Erwartete Versionen

```text
29.3.1-multisource-hybrid-market-intelligence-sync
29.3.1-multisource-hybrid-portfolio-market-intelligence-alerts
```

## Serverseitiger Test

Nach dem Deployment kann der vorhandene V29.3-Test erneut verwendet werden.
In `net._http_response` muss für `sync-news` anschließend `status_code = 200`
und die Version
`29.3.1-multisource-hybrid-market-intelligence-sync` erscheinen.
