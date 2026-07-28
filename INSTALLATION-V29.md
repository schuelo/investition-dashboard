# Installation V29.0

V29.0 erweitert den bestehenden V28.2-Stand. Die Website bleibt auf GitHub
Pages, Datenbank und Edge Functions bleiben bei Supabase. GitHub enthält nur den
versionierten Function-Quellcode und veröffentlicht ihn über den bereits
eingerichteten Workflow nach Supabase.

## Benötigte Schritte im Überblick

1. V29-Dateien in das GitHub-Repository laden.
2. einmalig das V29-SQL-Schema in Supabase ausführen;
3. die aktualisierten Edge Functions über GitHub Actions deployen;
4. Browser-Cache zurücksetzen;
5. den Feed einmal manuell synchronisieren und das Ergebnis prüfen.

## 1. Bestehenden Stand sichern

Im Repository `investition-dashboard`:

1. **Code → Download ZIP** wählen;
2. den bisherigen Stand lokal als Sicherung aufbewahren.

## 2. V29-Dateien nach GitHub laden

Den Inhalt des entpackten V29-Pakets in das Hauptverzeichnis des vorhandenen
Repositories laden und vorhandene Dateien ersetzen.

Im Repository müssen danach direkt sichtbar sein:

```text
index.html
app.js
news.js
decision.js
analytics.js
service-worker.js
reset.html
version29-market-intelligence-schema.sql
supabase/
.github/
```

Wichtige Unterordner:

```text
.github/workflows/deploy-supabase-functions.yml
supabase/functions/_shared/cors.ts
supabase/functions/_shared/market-intelligence.ts
supabase/functions/sync-news/index.ts
supabase/functions/send-news-alerts/index.ts
```

Die ZIP-Datei selbst nicht ins Repository laden. `index.html` muss direkt im
Hauptverzeichnis bleiben.

Empfohlene Commit-Nachricht:

```text
Dashboard V29 Market Intelligence und News Sync
```

## 3. V29-Datenbankschema einmalig installieren

Dieser Schritt ist für die neuen Scores und Bewertungen erforderlich.

1. Supabase öffnen.
2. Das Projekt `pzhfybtoyfttftgcrcxk` auswählen.
3. **SQL Editor → New query** öffnen.
4. Den vollständigen Inhalt von
   `version29-market-intelligence-schema.sql` einfügen.
5. **Run** wählen.
6. Der Lauf muss ohne rote Fehlermeldung enden.

Das Skript:

- löscht keine News;
- ergänzt nur neue Spalten und Indizes;
- kann bei Bedarf erneut ausgeführt werden;
- markiert ältere Meldungen als `legacy-v28`, bis sie beim nächsten Sync neu
  bewertet werden.

`version28-analytics-schema.sql` muss nicht erneut ausgeführt werden, wenn
Portfolio Analytics bereits funktioniert.

## 4. Function-Secrets kontrollieren

In Supabase unter **Edge Functions → Secrets**:

| Secret | Zweck | Erforderlich |
|---|---|---|
| `EODHD_API_TOKEN` | News, Kursreaktion und Analystenkontext | ja |
| `CRON_SECRET` | automatische Cron-Aufrufe | nur für Automatik |
| `TELEGRAM_BOT_TOKEN` | Telegram-News-Alarme | nur für Telegram |

Die Supabase-Systemvariablen wie `SUPABASE_URL`, Publishable Key und Secret Key
werden automatisch bereitgestellt.

Wichtig: EODHD-News sind für den Sync zwingend. Historische Kurse, verzögerte
Live-Kurse und Fundamentaldaten sind tarifabhängig. Ist einer dieser
Zusatzendpunkte nicht verfügbar, speichert V29 die Meldungen trotzdem und zeigt
bei der betroffenen Bewertung transparent `unklar` beziehungsweise
`nicht verfügbar`.

## 5. Edge Functions deployen

Wenn das GitHub Secret `SUPABASE_ACCESS_TOKEN` bereits für V28.2 eingerichtet
wurde, muss es nicht neu erstellt werden.

### Secret bei Bedarf prüfen

1. GitHub-Repository öffnen.
2. **Settings → Secrets and variables → Actions** wählen.
3. Unter **Repository secrets** muss `SUPABASE_ACCESS_TOKEN` vorhanden sein.

Der Supabase Access Token gehört ausschließlich in dieses Secret und niemals in
eine Repository-Datei.

### Deployment starten

1. Im Repository **Actions** öffnen.
2. Links **Supabase Functions deployen** auswählen.
3. **Run workflow** wählen.
4. Branch `main` auswählen.
5. **Run workflow** bestätigen.
6. Den Lauf öffnen.

Diese Schritte müssen grün enden:

```text
Repository laden
Supabase CLI einrichten
News-Sync deployen
Telegram-News deployen
```

Danach in Supabase unter **Edge Functions** prüfen:

```text
sync-news
send-news-alerts
```

Beide Functions müssen ein aktuelles Deployment mit dem Zeitpunkt des
GitHub-Laufs anzeigen.

## 6. Dashboard-Cache zurücksetzen

Öffnen:

```text
https://schuelo.github.io/investition-dashboard/reset.html?v=29.0
```

**Jetzt zurücksetzen** wählen und die Weiterleitung abwarten. Anschließend muss
im Dashboard `V29.0` angezeigt werden.

Der Reset entfernt nur Browser-Cache und Service Worker. Depot-, Watchlist- und
Analysedaten in Supabase bleiben erhalten.

## 7. Manuellen Sync testen

1. Im Dashboard anmelden.
2. **News Feed** öffnen.
3. **Feed aktualisieren** wählen.
4. Den Lauf abwarten.

Erwartete Statusfelder:

```text
Sync-Function: erfolgreich
Supabase-Tabelle: erreichbar
Marktdaten: Kurskontexte / Fundamentalabrufe
Bewertungen: V29 bewertet / Meldungen mit Kursreaktion
```

Eine Meldung im Feed öffnen. Sichtbar sein müssen:

- Relevanz, Vertrauen, Auswirkung und Dringlichkeit als Werte von 0 bis 100;
- begründete Relevanz;
- Auswirkung und Wirkmechanismus;
- Einpreisungsstatus mit Kursreaktion und Normalbewegung;
- Analystenbild beziehungsweise klarer Hinweis auf fehlende Daten;
- konkrete Handlung;
- Datenqualität und Bewertungsgrundlage.

Ältere Meldungen mit dem Badge `Legacy · neu synchronisieren` werden beim
nächsten erfolgreichen Sync neu bewertet, sofern sie im eingestellten
10-Tage-Fenster liegen.

## 8. Automatischen Sync nur bei Bedarf neu einrichten

Läuft der bisherige V28.2-Cronjob bereits und `CRON_SECRET` wurde nicht
geändert, ist keine neue SQL-Ausführung nötig: Die bestehenden Jobs rufen
weiterhin dieselben Function-Namen auf und verwenden nach dem Deployment
automatisch V29.

Nur wenn noch kein Cronjob existiert oder das Secret geändert wurde:

1. `setup-v29-news-cron.sql` lokal öffnen.
2. beide Vorkommen `DEIN_CRON_SECRET` durch exakt den Wert aus dem Supabase
   Function-Secret `CRON_SECRET` ersetzen;
3. das vollständige SQL im Supabase SQL Editor ausführen;
4. die Datei mit eingetragenem Secret niemals nach GitHub laden.

Zeitplan:

- Market-Intelligence-Sync stündlich zur Minute 07;
- Telegram-News-Prüfung stündlich zur Minute 17.

## Fehlerzuordnung

| Anzeige | Ursache / Maßnahme |
|---|---|
| `Edge Function sync-news ist nicht deployt` | GitHub Action ausführen und Supabase Deployment prüfen |
| `Anmeldung abgelehnt` | im Dashboard ab- und neu anmelden |
| `EODHD_API_TOKEN fehlt` | Secret in Supabase ergänzen; kein neues Deployment nötig |
| `SQL-Migration erforderlich` | `version29-market-intelligence-schema.sql` ausführen, danach erneut synchronisieren |
| `EODHD-Aufrufslimit erreicht` | später erneut testen und EODHD Tarif-/API-Limit prüfen |
| einzelne Quellen- oder Marktdatenhinweise | Teilabruf fehlgeschlagen; übrige News wurden gespeichert |
| weiterhin V28.2 sichtbar | `reset.html?v=29.0` ausführen und Seite vollständig neu laden |

Für eine rein lesende Abschlusskontrolle kann anschließend
`version29-diagnose.sql` im Supabase SQL Editor ausgeführt werden. Das Skript
zeigt Spalten, Bewertungsstand und Cronjob-Status, verändert aber keine Daten.
