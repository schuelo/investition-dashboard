# Investition Dashboard – korrigierte GitHub-Pages-Version

## Dateien direkt in die oberste Ebene des Repositorys hochladen

- `index.html`
- `app.js`
- `supabase.js`
- `service-worker.js`
- `reset.html`
- `startdaten.json`
- `.nojekyll`

Die Supabase-Browserbibliothek liegt nun lokal als `supabase.js` im Repository. Dadurch blockiert ein Ausfall oder Content-Blocker für jsDelivr nicht mehr das gesamte Dashboard.

## Upload

1. Repository `schuelo/investition-dashboard` öffnen.
2. `Add file` → `Upload files`.
3. Alle oben genannten Dateien hochladen und vorhandene Dateien ersetzen.
4. `Commit changes`.
5. Unter `Settings` → `Pages` prüfen: Branch `main`, Ordner `/(root)`.

## Einmaliger Cache-Reset auf dem iPhone

Nach dem Upload zuerst öffnen:

`https://schuelo.github.io/investition-dashboard/reset.html`

Dann `Jetzt zurücksetzen` drücken. Danach wird das Dashboard mit der aktuellen Version geöffnet.

Die Reset-Seite löscht keine Trade-Pläne aus `localStorage`; sie entfernt nur alte Service Worker und Cache-Dateien.

## Sicherheit

Nicht in GitHub speichern:

- Telegram Bot Token
- EODHD API Token
- CRON Secret
- Supabase Secret-/Service-Role-Key

Der Supabase Publishable Key ist für Browseranwendungen bestimmt; Row Level Security muss aktiv bleiben.
