# Installation V29.4

Diese Aktualisierung bringt das bestehende Dashboard auf einen vollständig
konsistenten Stand. Die Reihenfolge ist wichtig, damit der neue Digest-Cronjob
erst nach der neuen Function aktiviert wird.

## 1. Alte Repository-Dateien entfernen

Vor dem Upload in GitHub alle noch vorhandenen Dateien aus dieser Liste
löschen. Sie werden durch V29.4 ersetzt und gehören nicht mehr zum aktiven
Stand:

```text
HOTFIX-V29.3.1.md
INSTALLATION-V29.3.1.md
send-news-alerts-index-v26.ts
sync-news-index-v26.ts
setup-v26-news-cron.sql
setup-v28-2-news-cron.sql
setup-v29-news-cron.sql
setup-v29-2-hybrid-cron.sql
setup-v29-3-multisource-cron.sql
version26-news-schema.sql
version28-analytics-schema.sql
version28-diagnose.sql
version29-market-intelligence-schema.sql
version29-2-hybrid-schema.sql
version29-3-diagnose.sql
supabase/functions/_shared/hybrid-sources.ts
supabase/functions/_shared/multisource-sources-v2931.ts
```

Falls einzelne Dateien nicht vorhanden sind, ist nichts zu tun. Nicht löschen:
`startdaten.json`, `supabase.js`, `.nojekyll` oder eigene Dashboard-Daten.

## 2. V29.4 vollständig hochladen

1. Das ZIP lokal entpacken.
2. Den **Inhalt** des Ordners `investition-dashboard-v29.4` in das
   Stammverzeichnis des GitHub-Repositories hochladen.
3. Vorhandene aktuelle Dateien überschreiben.
4. Den Upload als einen Commit bestätigen.

## 3. Drei Edge Functions deployen

GitHub öffnen:

1. **Actions**
2. **Supabase Functions deployen**
3. **Run workflow**
4. Branch `main`
5. **Run workflow**

Im Job `deploy` müssen diese Schritte grün sein:

```text
Supabase CLI einrichten
Supabase CLI prüfen
V29.4-Konsistenz prüfen
News-Sync deployen
Telegram-News deployen
Telegram-Berichte deployen
```

Der Konsistenzschritt bricht absichtlich ab, falls eines der beiden alten
Shared-Module noch im Repository liegt.

## 4. Konsolidierung in Supabase ausführen

Im Supabase SQL Editor den vollständigen Inhalt von
`setup-v29-4-consistent.sql` ausführen.

Das Skript:

- ergänzt fehlende V26–V29.4-Strukturen idempotent;
- legt das Versandprotokoll für Tages-/Wochenberichte an;
- entfernt alte und doppelte Dashboard-Cronjobs anhand ihres Function-Ziels;
- erstellt exakt diese drei aktiven Jobs:

```text
sync-portfolio-news-hourly       7 * * * *
portfolio-news-alerts-hourly     17 * * * *
portfolio-digests-quarter-hour   */15 * * * *
```

Das vorhandene `investition_news_cron_secret` bleibt unverändert. Wenn das
Secret wider Erwarten fehlt, stoppt das Skript mit einer klaren Meldung, statt
einen Platzhalter zu speichern.

## 5. Browsercache einmal zurücksetzen

[Dashboard V29.4 zurücksetzen](https://schuelo.github.io/investition-dashboard/reset.html?v=29.4)

Danach anmelden und unter **News Feed** einmal **Feed aktualisieren** wählen.

## 6. Abschlussdiagnose

Im Supabase SQL Editor `diagnose-v29-4.sql` ausführen.

Erwartet:

```text
aktuelle_jobs: 3
alte_dashboard_jobs: 0
sync-news-Version:
29.4-multisource-hybrid-market-intelligence-sync
```

Nach dem nächsten automatischen Lauf zur Minute `:07` muss in
`news_sync_runs` zusätzlich `auth_mode = cron` erscheinen. Automatische
Digest-Aufrufe ohne fälligen Bericht antworten mit HTTP 200 und der Meldung,
dass im aktuellen Zeitfenster kein Bericht fällig ist.

## Unverändert

- Supabase-Projekt und Login
- Depotpositionen, Analysen und Newsbestand
- `CRON_SECRET`
- EODHD-Token
- Telegram-Bot-Token und Chat-ID
- maximal sechs reservierte EODHD-Schlusskursabrufe pro UTC-Tag
