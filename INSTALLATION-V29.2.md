# Installation V29.2 Hybrid

V29.2 ist für den kostenlosen EODHD-Tarif mit 20 API-Einheiten pro Tag
optimiert. News kommen stündlich aus kostenlosen RSS-Quellen. EODHD wird nur
kontrolliert für gecachte Schlusskurse verwendet.

## Vor dem Start

Unverändert weiterverwenden:

- Supabase-Projekt;
- GitHub-Repository `investition-dashboard`;
- `SUPABASE_ACCESS_TOKEN` in GitHub;
- Supabase-Secrets `CRON_SECRET`, `EODHD_API_TOKEN` und
  `TELEGRAM_BOT_TOKEN`;
- bestehende Depot-, Watchlist-, News- und Telegram-Daten.

`CRON_SECRET` nicht erneut ändern. Das echte Secret nie in GitHub speichern.

## 1. Paket nach GitHub laden

1. ZIP vollständig auf dem PC entpacken.
2. GitHub-Repository `investition-dashboard` öffnen.
3. **Code → Add file → Upload files** wählen.
4. Den gesamten Inhalt des entpackten V29.2-Ordners hochladen.
5. Vorhandene Dateien ersetzen.
6. Commit-Nachricht:

```text
Dashboard V29.2 Hybrid RSS
```

7. **Commit changes** bestätigen.

`index.html`, `.github/` und `supabase/` müssen im Repository-Hauptverzeichnis
liegen.

## 2. V29.2-Hybrid-Schema ausführen

Dieser Schritt ist zwingend.

1. Supabase → **SQL Editor → New query** öffnen.
2. `version29-2-hybrid-schema.sql` vollständig einfügen.
3. **Run** wählen.

Das Skript ist idempotent und löscht keine vorhandenen Daten. Es ergänzt:

- `hybrid_market_cache` für Schlusskursreihen;
- `hybrid_api_usage` für das UTC-Tagesbudget;
- `reserve_hybrid_eodhd_calls(...)` als atomare Budgetsperre;
- `news_sync_runs` für die Anzeige des letzten Hintergrundlaufs.

Das bisherige `version29-market-intelligence-schema.sql` bleibt erforderlich.
Wenn die vier Scores in V29.1 bereits sichtbar waren, muss es nicht erneut
ausgeführt werden.

## 3. Edge Functions deployen

1. GitHub → **Actions** öffnen.
2. **Supabase Functions deployen** auswählen.
3. **Run workflow** anklicken.
4. Branch `main` wählen und bestätigen.
5. Den Lauf öffnen.

Diese Schritte müssen grün enden:

```text
Repository laden
Supabase CLI einrichten
News-Sync deployen
Telegram-News deployen
```

Danach antwortet `sync-news` mit:

```text
29.2-hybrid-market-intelligence-sync
```

und `send-news-alerts` mit:

```text
29.2-hybrid-portfolio-market-intelligence-alerts
```

## 4. Cronjobs

Wenn die beiden vorhandenen V29.1-Cronjobs aktiv waren, bleiben sie gültig,
weil Function-Namen und Zeitplan unverändert sind:

| Job | Zeitplan |
|---|---|
| `sync-portfolio-news-hourly` | jede Stunde um `:07` |
| `portfolio-news-alerts-hourly` | jede Stunde um `:17` |

Nur wenn einer der Jobs fehlt oder inaktiv ist:

1. `setup-v29-2-hybrid-cron.sql` öffnen.
2. alle Vorkommen von `DEIN_CRON_SECRET` durch den bestehenden Wert des
   Supabase-Secrets `CRON_SECRET` ersetzen;
3. den vollständigen SQL-Inhalt im Supabase SQL Editor ausführen;
4. die bearbeitete Datei mit echtem Secret nicht nach GitHub hochladen.

## 5. Browser-Cache zurücksetzen

Im normalen Browser öffnen:

```text
https://schuelo.github.io/investition-dashboard/reset.html?v=29.2
```

**Jetzt zurücksetzen** wählen. Die Adresse muss mit `https://` beginnen.

Nach der Weiterleitung muss das Dashboard `V29.2` anzeigen.

## 6. Erster Hybrid-Sync

1. Dashboard anmelden.
2. **News Feed** öffnen.
3. **Feed aktualisieren** wählen.
4. Den vollständigen Lauf abwarten.

Erwartete Statusangaben:

```text
Letzter Sync-Lauf: manuell/automatisch · [Zeit] · [Anzahl] gespeichert
Hybrid-Quellen: [RSS-Treffer] · [Quellen] · [Kursreihen] · EODHD x/6 heute
Bewertungen: [Anzahl] bewertet · [Einpreisungen] · [zu früh] · [nicht messbar]
```

Ein erfolgreicher Lauf kann Teilhinweise anzeigen. Das ist im Hybrid-Modus
erwartbar: Fällt eine RSS-Suche oder ein Kursanbieter aus, werden die übrigen
Meldungen gespeichert und vorhandene Kurse weiterverwendet.

## 7. Automatik kontrollieren

`version29-2-diagnose.sql` vollständig im Supabase SQL Editor ausführen.

Entscheidend:

- `news_sync_runs` zeigt regelmäßig einen erfolgreichen Lauf mit
  `auth_mode = cron`;
- `hybrid_api_usage.eodhd_calls` liegt standardmäßig zwischen `0` und `6`;
- `hybrid_market_cache` enthält direkte EODHD- und Proxy-Kursreihen;
- beide Cronjobs sind `active = true`;
- die HTTP-Antwort des News-Syncs enthält
  `"version":"29.2-hybrid-market-intelligence-sync"` und `"ok":true`.

## Telegram-Verhalten

Der Lauf um `:17` prüft neue, bewertete Meldungen. Eine Nachricht wird nur
gesendet, wenn:

- Telegram verbunden und aktiviert ist;
- die Meldung eine offene Depotposition betrifft;
- Auswirkung `hoch` oder `mittel` ist;
- Relevanz mindestens `70` oder Dringlichkeit mindestens `65` beträgt;
- dieselbe Meldung noch nicht gesendet wurde.

Das Telegram-Paket enthält Relevanz, Vertrauen, Dringlichkeit, Auswirkung,
Einpreisung, Analystensignal, Handlung, Datenqualität und Originalquelle.

## EODHD-Tagesbudget

Standard:

```text
HYBRID_EODHD_DAILY_BUDGET = 6
```

Das Secret muss nicht angelegt werden; ohne Eintrag gilt automatisch `6`.
Optional kann unter **Supabase → Edge Functions → Secrets** ein anderer Wert
zwischen `0` und `20` gesetzt werden.

Bei erreichtem Limit:

- RSS-News laufen weiter;
- Bewertungen ohne frische Direktkurse laufen weiter;
- vorhandene Kurscaches bleiben nutzbar;
- der Sync antwortet weiterhin erfolgreich mit einem Warnhinweis;
- ein EODHD-`402` führt nicht mehr zum Abbruch des gesamten Newsfeeds.

Der Zähler wird mit dem UTC-Tag geführt. Die Tabelle zählt nur Aufrufe von
`sync-news`; andere Functions oder Anwendungen mit demselben EODHD-Token
verbrauchen weiterhin das globale EODHD-Kontingent.

## Aussagekraft der Bewertungen

`weitgehend`, `teilweise`, `eher nicht`, `noch zu früh` und `nicht messbar`
sind regelbasierte Indikationen. Im kostenlosen Hybrid-Modus gilt zusätzlich:

- keine Intraday-Messung;
- keine externen Analysten-Konsensziele;
- RSS-Überschrift/Kurztext können Kontext aus dem Originalartikel auslassen.

Vor Kauf, Verkauf oder Knock-out-Handlung immer die verlinkte Originalquelle,
das hinterlegte Setup, Stop/Invalidierung und den Barriereabstand prüfen.
