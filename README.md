# Investition Dashboard 25.2 – Passwortschutz

Version 25.2 ergänzt eine vollständige Login-Wall vor dem Dashboard. Ohne erfolgreiche Supabase-Anmeldung sind Oberfläche, Analysen, Depotpositionen, News, Alarme und Einstellungen gesperrt.

## Sicherheitsfunktionen

- Anmeldung ausschließlich mit bestehendem Supabase-Konto
- Kontoerstellung aus der Dashboard-Oberfläche entfernt
- lokaler Betriebsmodus deaktiviert
- Supabase-Sitzung wird nicht dauerhaft im Browser gespeichert
- nach Neuladen oder vollständigem Beenden der App ist eine neue Anmeldung erforderlich
- automatische Sperre nach 30 Minuten ohne Bedienung
- manuelle Sofortsperre über `Sperren`
- persönliche Analyse-, Depot-, News- und Entscheidungsdaten werden nicht mehr in `localStorage` gespeichert
- Service Worker cached ausschließlich statische Programmdateien, keine Supabase-Daten

## Vor dem Update: Sicherung

Version 25.2 entfernt nach einer erfolgreichen Cloud-Anmeldung alte persönliche Dashboard-Caches aus dem Browser. Vor dem Upload daher einmal sichern:

1. Oben im bisherigen Dashboard `Export` ausführen.
2. Unter `Entscheidungszentrale → System` die `Entscheidungsdaten exportieren`.
3. Kontrollieren, dass die bisherigen Pläne und Depotpositionen in Supabase vorhanden sind.

## GitHub aktualisieren

Direkt im Hauptverzeichnis des GitHub-Repositorys ersetzen:

- `index.html`
- `app.js`
- `news.js`
- `decision.js`
- `service-worker.js`
- `reset.html`
- `README.md`

Diese Dateien können unverändert bleiben:

- `supabase.js`
- `startdaten.json`
- `.nojekyll`

SQL- und TypeScript-Dateien gehören nicht nach GitHub.

## Supabase einstellen

Das bestehende Konto bleibt erhalten. Das Konto darf nicht gelöscht werden, weil zugehörige Cloud-Daten über Fremdschlüssel mitgelöscht werden könnten.

In Supabase die Registrierung neuer Benutzer deaktivieren. Damit kann sich nur ein bereits vorhandener Benutzer anmelden. Der genaue Schalter befindet sich in der E-Mail-/Auth-Konfiguration und heißt sinngemäß `Allow new users to sign up`.

Erforderlich:

- E-Mail-Provider aktiviert
- bestehender Benutzer besitzt ein Passwort
- neue Registrierungen deaktiviert
- Row Level Security auf allen persönlichen Tabellen aktiviert
- kein `service_role`-, `sb_secret_...`- oder sonstiger Server-Key in GitHub

## Cache zurücksetzen

Nach dem GitHub-Commit in Safari öffnen:

`https://schuelo.github.io/investition-dashboard/reset.html?v=25.2`

Dann `Jetzt zurücksetzen` drücken und anschließend öffnen:

`https://schuelo.github.io/investition-dashboard/?v=25.2`

Bei einer bereits installierten Home-Screen-App kann es erforderlich sein, das alte Symbol zu entfernen und die Seite erneut zum Home-Bildschirm hinzuzufügen.

## Anmeldung

Die Login-Wall zeigt nur:

- E-Mail
- Passwort
- Anmelden
- Zugang wiederherstellen / Passwort einrichten

Die regelmäßige Anmeldung erfolgt mit E-Mail und Passwort. Ein Wiederherstellungslink wird nur benötigt, wenn das Passwort fehlt oder geändert werden muss.

## Sperrverhalten

Die Sitzung wird gesperrt:

- nach 30 Minuten ohne Touch-, Tastatur- oder Zeigereingabe
- nach `Sperren`
- nach `Abmelden`
- nach einem Neuladen
- nach vollständigem Beenden und erneutem Starten der App

Nach der Sperre werden Trade-Pläne aus dem Arbeitsspeicher entfernt und die Dashboard-Oberfläche wird wieder vollständig verdeckt.

## Cloud-only-Betrieb

Neue und geänderte Trade-Pläne werden direkt in Supabase geschrieben. JSON-Importe werden ebenfalls direkt in die Cloud übernommen. Bei einem Cloud-Fehler ist die Änderung nicht dauerhaft gespeichert.

Die folgenden Daten werden nicht mehr lokal persistiert:

- Trade-Pläne
- Depotpositionen
- Investmentthesen
- Szenarien
- Ereignisse
- Benachrichtigungspräferenzen
- Signalauswertungen
- News-Feed

Unkritische Oberflächenpräferenzen wie Chartmodus oder Zeitraum können weiterhin lokal gespeichert werden.

## Keine Backend-Migration erforderlich

Für Version 25.2 müssen nicht geändert werden:

- Datenbankschema 25.1
- `sync-news`
- `check-alerts`
- `send-digest`
- `evaluate-signals`

Die funktionierende News-Function kann unverändert bleiben.
