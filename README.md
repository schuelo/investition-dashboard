# Investition Dashboard V28.2 – News-Sync-Fix

V28.2 basiert vollständig auf V28.1 und korrigiert den nicht erreichbaren
News-Sync.

## Behobene Ursachen

- Der für Browser-Aufrufe nötige CORS-Header `x-client-info` ist jetzt erlaubt.
- `sync-news` und `send-news-alerts` liegen in der von Supabase erwarteten
  Struktur `supabase/functions/<name>/index.ts`.
- `supabase/config.toml` enthält die für Cron-Aufrufe nötige
  Function-Konfiguration. Die Functions prüfen danach selbst wahlweise den
  angemeldeten Benutzer oder `CRON_SECRET`.
- EODHD-Unternehmensabfragen verwenden jetzt korrekt den Ticker-Parameter `s`;
  Themenabfragen verwenden `t`.
- Ein manueller Sync verarbeitet nur das Portfolio und die Watchlist des
  angemeldeten Benutzers. Der Cron-Lauf verarbeitet weiterhin alle Benutzer.
- Das Dashboard zeigt bei fehlendem Deployment, Auth- oder Providerfehlern eine
  konkrete Meldung.

Die V28.1-Korrektur für die Modal-Überlagerung bleibt vollständig erhalten.

## Installation

Die genaue Schrittfolge steht in
[`INSTALLATION-V28.2.md`](./INSTALLATION-V28.2.md).

Kurzfassung:

1. Paketinhalt in das Hauptverzeichnis des GitHub-Repositories hochladen.
2. Die beiden Supabase Edge Functions deployen.
3. Dashboard-Cache über `reset.html?v=28.2` zurücksetzen.
4. Unter **News Feed → Feed aktualisieren** testen.

Für die manuelle Aktualisierung ist keine erneute Ausführung der SQL-Schemata
erforderlich, wenn V26 und V28 bereits vollständig eingerichtet wurden.
