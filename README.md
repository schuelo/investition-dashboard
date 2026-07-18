# Investition Dashboard · Version 14

Version 14 behebt zwei Punkte:

1. **TradingView auf dem iPhone**: eigener Chart-Modus, eigener Zeitraum-/Intervallschalter, manuelle Aktualisierung und automatisches Neuladen nach Rückkehr in die App.
2. **Alarmdiagnose**: manuelle Serverprüfung aus dem Dashboard, sichtbarer letzter Prüfzeitpunkt, Kurszeit, Fehlerstatus und eine überarbeitete `check-alerts`-Function.

## Wesentliche Ursache der ausgebliebenen Alarme

Der kostenlose EODHD-Tarif ist für einen laufenden Alarmdienst nicht geeignet:

- 20 API Calls pro Tag
- freier Zugriff im Wesentlichen auf End-of-Day-Daten; der Live-/Delayed-Endpunkt für normale globale Aktien erfordert einen passenden Tarif
- EODHD zählt beim Live-Endpunkt **einen API Call pro Ticker**, auch wenn mehrere Ticker in einem HTTP-Aufruf gebündelt werden
- globale Aktienkurse des Live-Endpunkts sind typischerweise 15–20 Minuten verzögert

Der News-Sync kann das kostenlose Tageskontingent ebenfalls verbrauchen. Für K+S-, Volkswagen-, SK-hynix- oder CATL-Alarme wird daher ein EODHD-Tarif mit Live Data und ausreichendem Tageslimit oder ein anderer Kursanbieter benötigt.

## Dateien für GitHub Pages

Diese Dateien direkt in das Hauptverzeichnis des Repositorys hochladen:

```text
index.html
app.js
news.js
supabase.js
service-worker.js
reset.html
startdaten.json
news-startdaten.json
marktausblick-import-vorlage.json
.nojekyll
```

Danach öffnen:

```text
https://schuelo.github.io/investition-dashboard/reset.html
```

und **Jetzt zurücksetzen** wählen. Anschließend:

```text
https://schuelo.github.io/investition-dashboard/?v=14
```

## TradingView-Steuerung

Im Chartbereich stehen jetzt bereit:

- **Kursverlauf**: mobiles TradingView-Mini-Chart mit wählbarem Zeitraum
- **Analysechart**: TradingView Advanced Chart mit wählbarem Kerzenintervall
- **Aktualisieren**: initialisiert das Widget neu

Der Zeitstempel unter dem Chart zeigt nur, wann das Widget neu geladen wurde. Er ist nicht gleichbedeutend mit dem Börsen-Zeitstempel. TradingView kann je Handelsplatz Echtzeit-, verzögerte oder End-of-Day-Daten anzeigen.

## Supabase-Anpassungen

### 1. Diagnosefelder anlegen

`alarm-health-schema.sql` im SQL Editor vollständig ausführen.

### 2. check-alerts ersetzen

Unter **Edge Functions → check-alerts** den gesamten Code durch `check-alerts-index.ts` ersetzen.

Danach:

- **Verify JWT deaktivieren**
- Function deployen
- Secrets müssen vorhanden sein:

```text
EODHD_API_TOKEN
TELEGRAM_BOT_TOKEN
CRON_SECRET
```

Die Function akzeptiert zwei sichere Aufrufarten:

- Cronjob mit `x-cron-secret`
- angemeldeter Dashboard-Benutzer über seine Supabase-Sitzung; dabei werden nur dessen eigene Pläne geprüft

Dadurch funktioniert im Dashboard der Button **Alarme jetzt prüfen**, ohne dass das CRON-Secret im Browser gespeichert wird.

### 3. Manuell im Dashboard testen

1. Cloud-Anmeldung öffnen.
2. Prüfen, dass Telegram verbunden ist.
3. Einen Plan mit EODHD-Symbol, Marke und aktivem Alarm speichern.
4. **Alarme jetzt prüfen** drücken.
5. Ergebnis und Fehler erscheinen direkt im Cloud-Fenster.

Die erste Prüfung sendet jetzt bereits ein Signal, wenn Entry oder Limit zu diesem Zeitpunkt schon erreicht sind. Stop- und Zielsignale werden bei der Initialprüfung nur für den Status **Position offen** oder **Teilverkauf** ausgelöst.

### 4. Cronjob

`setup-alert-cron-v14.sql` setzt einen 15-Minuten-Takt an Werktagen.

Das ist nur sinnvoll, wenn der EODHD-Tarif das Live-/Delayed-Produkt und genügend API Calls enthält. Bei fünf aktiven Tickern entstehen bis zu 480 EODHD-Calls pro Werktag.

## Diagnose

`alarm-diagnose.sql` zeigt:

- aktive Marken und Symbole
- Telegram-Verbindung
- letzte Kurs- und Serverprüfung
- gespeicherte Fehler
- Signalhistorie und Telegram-Zustellung
- Cronjob und letzte Cron-Läufe

## Wichtige Alarmregeln

- Long-Limit: Alarm bei Kurs **kleiner oder gleich Limit**
- Short-Limit: Alarm bei Kurs **größer oder gleich Limit**
- Entry: Alarm beim Eintritt in die Zone
- Stop und Ziele: nur bei **Position offen** oder **Teilverkauf**
- Änderungen an Marken setzen den Alarmstatus zurück
- Telegram-Warnungen ersetzen keine Stop-Order beim Broker

## Sicherheit

Nicht in GitHub hochladen:

- `EODHD_API_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `CRON_SECRET`
- Supabase Secret-/Service-Role-Key

Der Supabase Publishable Key im Browser ist für Clientzugriffe vorgesehen; Tabellenzugriffe bleiben durch Row Level Security geschützt.
