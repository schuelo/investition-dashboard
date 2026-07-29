# Installation V29.3.1 Multi-Source Hybrid

V29.3.1 behebt zusätzlich den Supabase-Startfehler durch eine mögliche
Versionsmischung des Shared-Moduls. Die Function importiert die Multi-Source-
Helfer nun aus `multisource-sources-v2931.ts`.

V29.3 behebt den Ausfall der V29.2-Newsquellen. Google News RSS wird
standardmäßig nicht mehr aufgerufen; Bing News RSS wurde entfernt. Der
kostenlose Newsabruf nutzt GDELT, Yahoo Finance und direkte Herausgeber-Feeds.

## Update von V29.2

Unverändert weiterverwenden:

- Supabase-Projekt und GitHub-Repository;
- GitHub-Secret `SUPABASE_ACCESS_TOKEN`;
- Supabase-Secrets `CRON_SECRET`, `EODHD_API_TOKEN` und
  `TELEGRAM_BOT_TOKEN`;
- vorhandene Cronjobs, Depot-, Watchlist-, News- und Telegram-Daten;
- `version29-market-intelligence-schema.sql` und
  `version29-2-hybrid-schema.sql`.

Von V29.2 auf V29.3 ist **keine SQL-Migration erforderlich**. `CRON_SECRET`
und EODHD-Token nicht ändern.

## 1. Paket nach GitHub laden

1. ZIP vollständig auf dem PC entpacken.
2. GitHub-Repository `investition-dashboard` öffnen.
3. **Code → Add file → Upload files** wählen.
4. Den gesamten Inhalt des entpackten V29.3-Ordners hochladen und vorhandene
   Dateien ersetzen.
5. Commit-Nachricht:

```text
Dashboard V29.3 Multi-Source News
```

6. **Commit changes** bestätigen.

`index.html`, `.github/` und `supabase/` müssen im Repository-Hauptverzeichnis
liegen.

## 2. Edge Functions deployen

1. GitHub → **Actions** öffnen.
2. **Supabase Functions deployen** auswählen.
3. **Run workflow** anklicken.
4. Branch `main` wählen und bestätigen.
5. Den Lauf öffnen.

Diese Schritte müssen grün enden:

```text
Repository laden
Supabase CLI einrichten
Supabase CLI prüfen
V29.3.1-Quellen prüfen
News-Sync deployen
Telegram-News deployen
```

Der Workflow verwendet bewusst die fest gesetzte Supabase CLI `2.110.0`.
Dadurch muss GitHub nicht bei jedem Lauf die neueste Version über die
GitHub-API ermitteln. Der Fehler
`Failed to resolve latest Supabase CLI release: rate limit exceeded`
tritt damit nicht mehr auf.

Erwartete Versionswerte:

```text
sync-news:
29.3.1-multisource-hybrid-market-intelligence-sync

send-news-alerts:
29.3.1-multisource-hybrid-portfolio-market-intelligence-alerts
```

## 3. Browser-Cache zurücksetzen

Im normalen Browser öffnen:

```text
https://schuelo.github.io/investition-dashboard/reset.html?v=29.3
```

**Jetzt zurücksetzen** wählen. Nach der Weiterleitung muss das Dashboard
`V29.3` anzeigen.

## 4. Ersten Multi-Source-Sync testen

1. Dashboard anmelden.
2. **News Feed** öffnen.
3. **Feed aktualisieren** wählen.
4. Den vollständigen Lauf abwarten.

Erwartet wird:

```text
Sync-Function: erfolgreich · [Anzahl] gespeichert
Hybrid-Quellen: [News-Treffer] · [Quellen] · [Kursreihen]
Bewertungen: [Anzahl] bewertet
```

Einzelne Quellenhinweise sind zulässig. Der Lauf ist funktional, wenn
`ok=true` zurückkommt und mindestens eine Quelle Treffer liefert.

`degraded=true` bedeutet: Function, Authentifizierung und Kursprüfung liefen,
aber in diesem Lauf lieferte keine kostenlose Quelle aktuelle Treffer. Die
Function antwortet trotzdem mit HTTP 200, erhält vorhandene Meldungen und
versucht es beim nächsten Cronlauf erneut.

## 5. Automatik kontrollieren

`version29-3-diagnose.sql` im Supabase SQL Editor ausführen. Entscheidend:

- `news_sync_runs` enthält regelmäßig `auth_mode = cron`;
- die neueste Version lautet
  `29.3.1-multisource-hybrid-market-intelligence-sync`;
- die HTTP-Antwort besitzt `status_code = 200`;
- beide Cronjobs sind `active = true`;
- `hybrid_api_usage.eodhd_calls` liegt standardmäßig zwischen `0` und `6`.

Die bisherigen Zeitpläne bleiben:

| Job | Zeitplan |
|---|---|
| `sync-portfolio-news-hourly` | jede Stunde um `:07` |
| `portfolio-news-alerts-hourly` | jede Stunde um `:17` |

Nur wenn ein Job fehlt, `setup-v29-3-multisource-cron.sql` verwenden. Darin
alle Vorkommen von `DEIN_CRON_SECRET` durch den vorhandenen Secret-Wert
ersetzen. Die bearbeitete Datei mit echtem Secret niemals nach GitHub laden.

## Quellenlogik

| Quelle | Zweck | Verhalten bei Ausfall |
|---|---|---|
| GDELT DOC 2.0 | weltweite Suche für Portfolio, Watchlist und Themen | Yahoo bzw. Direktfeeds laufen weiter |
| Yahoo Finance RSS | aktienbezogener Ersatzweg | andere Quellen laufen weiter |
| EZB, Fed, BIZ | direkte Makro-/Geldpolitikmeldungen | übrige Direktfeeds laufen weiter |
| Tagesschau | Wirtschaft und Technologie | übrige Quellen laufen weiter |
| Google News RSS | optional | standardmäßig deaktiviert |

Google News RSS kann testweise über das Function-Secret
`GOOGLE_NEWS_RSS_ENABLED=true` aktiviert werden. Wegen der beobachteten
serverseitigen `503`-Antworten wird dies derzeit nicht empfohlen.

## Telegram-Verhalten

Der Lauf um `:17` prüft neue, bewertete Meldungen. Gesendet wird nur, wenn:

- Telegram verbunden und aktiviert ist;
- die Meldung eine offene Depotposition betrifft;
- Auswirkung `hoch` oder `mittel` ist;
- Relevanz mindestens `70` oder Dringlichkeit mindestens `65` beträgt;
- dieselbe Meldung noch nicht gesendet wurde.

Ein Lauf mit `alerts_sent = 0` ist erfolgreich; dann erfüllte keine neue
Meldung die Alarmbedingungen.

## Aussagekraft

`weitgehend`, `teilweise`, `eher nicht`, `noch zu früh` und `nicht messbar`
sind regelbasierte Indikationen. Im kostenlosen Modus gibt es keine
Intraday-Messung und keine extern geladenen Analysten-Konsensziele.

Vor Kauf, Verkauf oder Knock-out-Handlung immer Originalquelle, Setup,
Stop/Invalidierung und Barriereabstand prüfen.
