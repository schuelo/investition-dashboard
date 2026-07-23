# Investition Dashboard V28.1 – Stabilitätsupdate

V28.1 behebt zwei Fehler aus V28.0:

1. Modalfenster wie **Cloud & Benachrichtigungen** liegen jetzt zuverlässig über Header, Marktticker und Seitenleiste.
2. Der News Feed verwendet nun dieselbe authentifizierte Supabase-Sitzung wie das Hauptdashboard. Dadurch funktioniert **Feed aktualisieren** wieder und der Aufruf der Edge Function `sync-news` erhält den Benutzer-Token.

## Installation

Die Dateien aus dem GitHub-Paket in das Hauptverzeichnis des Repositories laden und vorhandene Dateien ersetzen. Für dieses Update sind keine Änderungen an Tabellen, Edge Functions, Secrets oder Cronjobs erforderlich.

Danach Cache zurücksetzen:

`https://schuelo.github.io/investition-dashboard/reset.html?v=28.1`

Anschließend öffnen:

`https://schuelo.github.io/investition-dashboard/?v=28.1#news`

## Funktionsprüfung

- **Cloud** öffnen: Das Fenster muss vollständig vor dem Ticker liegen.
- **News Feed → Feed aktualisieren**: Der Status wechselt zunächst auf „gezielte Suche läuft …“ und anschließend auf Erfolg oder zeigt eine konkrete Serverfehlermeldung.
- Im Kopf bzw. in der Seitenleiste muss **V28.1** erscheinen.

## Unverändert

- V28 Analytics-Schema
- V26 News-Edge-Function `sync-news`
- V26 Cron-Konfiguration
- Supabase RLS und Login-Wall
