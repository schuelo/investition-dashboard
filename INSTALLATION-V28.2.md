# Installation V28.2

## 1. Dateien in GitHub aktualisieren

Den gesamten Inhalt dieses Pakets in das Hauptverzeichnis des vorhandenen
Repositories `investition-dashboard` hochladen und vorhandene Dateien ersetzen.

Wichtig: Die neuen Ordner müssen mit hochgeladen werden:

- `.github/workflows/`
- `supabase/functions/`
- `supabase/config.toml`

## 2. Supabase-Functions deployen

Das Hochladen nach GitHub allein aktiviert Edge Functions nicht. V28.2 enthält
deshalb einen manuellen GitHub-Workflow.

### Einmalige Einrichtung

1. In Supabase unter **Account → Access Tokens** einen persönlichen Access Token
   erzeugen.
2. In GitHub das Repository öffnen.
3. **Settings → Secrets and variables → Actions → New repository secret**
   wählen.
4. Name exakt: `SUPABASE_ACCESS_TOKEN`
5. Als Wert den Supabase Access Token eintragen.

Der Token gehört ausschließlich in das GitHub Secret und niemals in eine
Repository-Datei.

### Deployment starten

1. In GitHub den Reiter **Actions** öffnen.
2. Workflow **Supabase Functions deployen** auswählen.
3. **Run workflow** starten.
4. Der Lauf muss mit einem grünen Haken enden.

Danach müssen in Supabase unter **Edge Functions** mindestens diese beiden
Functions sichtbar sein:

- `sync-news`
- `send-news-alerts`

## 3. Function-Secrets kontrollieren

In Supabase unter **Edge Functions → Secrets** müssen vorhanden sein:

- `EODHD_API_TOKEN`
- `CRON_SECRET`
- `TELEGRAM_BOT_TOKEN` nur für Telegram-News-Alarme

Die Supabase-Systemvariablen wie `SUPABASE_URL`, Publishable Key und Secret Key
werden von Supabase automatisch bereitgestellt.

## 4. Dashboard-Cache zurücksetzen

Öffnen:

`https://schuelo.github.io/investition-dashboard/reset.html?v=28.2`

Danach:

`https://schuelo.github.io/investition-dashboard/?v=28.2#news`

## 5. Funktionsprüfung

1. Im Dashboard anmelden.
2. **News Feed** öffnen.
3. **Feed aktualisieren** wählen.
4. Erwartetes Ergebnis:
   - Sync-Function: `erfolgreich`
   - Supabase-Tabelle: `erreichbar`
   - News-Quelle: `EODHD Unternehmens-News + Themenfeeds`

Falls `EODHD_API_TOKEN fehlt` angezeigt wird, ist nur dieses Function-Secret
nachzutragen; ein erneutes Deployment ist danach nicht nötig.

## 6. Cronjob nur bei Bedarf neu einrichten

Für den Button **Feed aktualisieren** ist kein Cronjob nötig. Wenn die
automatische stündliche Aktualisierung bisher nicht eingerichtet war oder das
Cron-Secret geändert wurde, anschließend
`setup-v28-2-news-cron.sql` im Supabase SQL Editor ausführen.
