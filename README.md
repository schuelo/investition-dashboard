# Investition Dashboard – GitHub Pages

## Dateien für das Repository

- `index.html` – vollständiges Dashboard mit Supabase-Cloud und Telegram-Verknüpfung
- `.nojekyll` – verhindert eine unnötige Jekyll-Verarbeitung
- `startdaten.json` – optionale Sicherung der Startdatensätze zum Import

## Upload

Lade alle drei Dateien direkt in die oberste Ebene des Repositorys `investition-dashboard` hoch. Die bisherige `index.html` muss ersetzt werden.

GitHub Pages:
- Source: Deploy from a branch
- Branch: main
- Folder: /(root)

URL:
https://schuelo.github.io/investition-dashboard/

## Sicherheit

Der Supabase Publishable Key darf im Browsercode stehen, wenn Row Level Security aktiv ist. Nicht nach GitHub gehören:
- Telegram Bot Token
- EODHD API Token
- CRON Secret
- Supabase Secret-/Service-Role-Key

## Startdaten

Die HTML-Datei enthält Platzhalter für K+S, SK hynix, Volkswagen Vz., Akzo Nobel und CATL. Konkrete Entry-, Stop- und Zielmarken sind absichtlich nicht erfunden. Nach der Anmeldung können die lokalen Startdatensätze über „Lokale Pläne in Cloud übernehmen“ in Supabase gespeichert werden.
