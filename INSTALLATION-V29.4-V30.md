# Installation V29.4 + V30.1 Event- & Szenarioanalyse

## Ausgangslage

Das Paket ersetzt den bisherigen Repository-Stand vollständig. Die vorhandenen Supabase-Daten bleiben erhalten. V30 ergänzt eigene Tabellen und eine zusätzliche Edge Function; es gibt keinen neuen Cronjob.

## Funktionsprinzip der Marktideen in V30.1

Der Auswahlpunkt **Bestandsabgleich** steuert ausschließlich, ob Portfolio und/oder Watchlist zusätzlich analysiert werden. Der globale Markt-Scan läuft immer. Die Investmentideen sind daher fachlich und technisch unabhängig von vorhandenen Wertpapieren.

Bei eindeutig erkannten Ereignissen werden mindestens vier themenspezifische Ideen erzeugt. Bei nicht eindeutig zuordenbaren Szenarien erzeugt die Function mindestens sechs niedrig-konfidente Recherchekandidaten. Diese werden als **Rückfallhypothese** markiert und dürfen nicht wie bestätigte Gewinner oder Verlierer behandelt werden.

## 1. Repository vollständig aktualisieren

1. ZIP lokal entpacken.
2. Den **Inhalt** des Ordners `investition-dashboard-v29.4-v30.1-independent-ideas` in das Stammverzeichnis des GitHub-Repositories laden.
3. Vorhandene Dateien überschreiben.
4. Den Upload in einem Commit bestätigen.

Wichtig: Nicht nur die neuen V30-Dateien hochladen. `index.html`, `news.js`, `app.js`, `service-worker.js`, `supabase/config.toml` und der GitHub-Workflow enthalten notwendige Integrationsänderungen.

## 2. V30-Datenbanktabellen anlegen

Im Supabase SQL Editor den vollständigen Inhalt von

```text
setup-v30-event-analysis.sql
```

ausführen.

Erwartet:

```text
Success. No rows returned
```

Das Skript ist idempotent. Es verändert keine V29.4-Cronjobs, Secrets, Depotpositionen, Trade-Pläne oder News.

## 3. Vier Edge Functions deployen

GitHub öffnen:

1. **Actions**
2. **Supabase Functions deployen**
3. **Run workflow**
4. Branch `main`
5. **Run workflow**

Im Job müssen zusätzlich zu den drei V29.4-Functions diese Schritte grün sein:

```text
V29.4- und V30-Konsistenz prüfen
Event- und Szenarioanalyse deployen
```

Deployte Functions:

```text
sync-news
send-news-alerts
send-digest
analyze-market-event
```

Nur die ersten drei Functions werden durch Cronjobs aufgerufen. `analyze-market-event` läuft ausschließlich nach einer angemeldeten Benutzeraktion im Dashboard.

## 4. Browsercache zurücksetzen

Nach dem GitHub-Pages-Deployment öffnen:

```text
https://schuelo.github.io/investition-dashboard/reset.html?v=30.1
```

**Jetzt zurücksetzen** wählen und danach neu anmelden.

## 5. Navigation prüfen

Die Hauptnavigation muss fünf Bereiche enthalten:

```text
Entscheidungszentrale
Trading & Analysen
Portfolio Intelligence
News Feed
Event- & Szenarioanalyse
```

Die neue Seite ist zusätzlich direkt über den Hash erreichbar:

```text
https://schuelo.github.io/investition-dashboard/#events
```

## 6. Funktionstest

Unter **Event- & Szenarioanalyse** eingeben:

```text
China beschränkt den Export seltener Erden nach Europa und in die USA.
```

Bestandsabgleich:

```text
Portfolio und Watchlist
```

Erwartet:

- Marktrelevanz, Portfolio-Impact und Vertrauen;
- Zusammenfassung und Interpretation;
- Portfolio-/Watchlistwerte;
- mindestens vier unabhängige Marktideen mit Chancen, Risiken oder Absicherungen;
- Base-, Bull- und Bear-Szenario;
- Frühindikatoren;
- Quellen;
- gespeicherter Eintrag in der Analysehistorie.

## 7. Diagnose

Im Supabase SQL Editor `diagnose-v30-event-analysis.sql` ausführen.

Alle fünf Tabellen müssen mit `vorhanden = true` erscheinen. Nach dem Funktionstest muss mindestens eine Zeile in `event_analyses` vorhanden sein.

## Fehlerbilder

### Historie meldet fehlendes Schema

`setup-v30-event-analysis.sql` vollständig ausführen und die Seite neu laden.

### Function nicht gefunden

GitHub Action erneut ausführen und prüfen, ob **Event- und Szenarioanalyse deployen** grün ist.

### Navigation reagiert nicht auf den neuen Punkt

Browsercache über `reset.html?v=30.1` löschen. Der geänderte Service Worker verwendet den Cache `investition-dashboard-v29-4-event-analysis-v30-1`.

### Analyse liefert wenig oder keine externen Quellen

GDELT oder Google News kann temporär keine passenden Meldungen liefern. Das Modul zeigt dann weiterhin Portfolio-/Watchlistabgleich und das Regelmodell an, kennzeichnet die geringere Sicherheit aber über den Confidence Score.
