# Investition Dashboard V29.2 – kostenlose Hybrid Intelligence

V29.2 ersetzt den API-intensiven EODHD-Newsabruf aus V29.1 durch eine
kostenfreie Hybrid-Architektur. Das Dashboard bleibt die führende Datenquelle
für Portfolio, Watchlist, Bewertungen und Telegram-News.

## Datenfluss

- stündliche Unternehmens-, Branchen- und Makronachrichten über kostenlose
  Google-News-RSS-Suchen;
- automatische Ausweichquelle Bing News RSS, wenn eine Google-Suche ausfällt;
- regelbasierte Bewertung von Relevanz, Vertrauen, Auswirkung und Dringlichkeit;
- Handlungshinweise für offene Positionen und Watchlist-Werte;
- Telegram-Alarm für neue, relevante Meldungen zu offenen Depotpositionen;
- direkte Schlusskurse über einen serverseitigen EODHD-Tagescache;
- kostenlose Stooq-Schlusskurse für die Markt-Proxys `QQQ.US`, `SOXX.US`,
  `XLE.US`, `SPY.US` und `EURUSD.FOREX`;
- sichtbarer Nachweis des letzten manuellen oder automatischen Sync-Laufs.

## Schutz des kostenlosen EODHD-Tarifs

Der Newsfeed selbst verbraucht keine EODHD-Einheiten. Für direkte
Wertpapierkurse reserviert `sync-news` standardmäßig höchstens sechs
EODHD-Aufrufe je UTC-Tag. Das Budget wird atomar in Supabase geführt, sodass
gleichzeitige manuelle und automatische Läufe es nicht überschreiten.

Portfolio-Symbole werden zuerst aktualisiert. Reicht das Tagesbudget nicht für
alle Symbole, werden die übrigen Werte über die Folgetage rotiert und vorhandene
Cache-Daten weiterverwendet.

Optional kann das Function-Secret `HYBRID_EODHD_DAILY_BUDGET` auf einen Wert
zwischen `0` und `20` gesetzt werden. Für den kostenlosen Tarif wird der
Standardwert `6` empfohlen, damit ein Restkontingent für andere Funktionen
bleibt.

## Bewusste Einschränkungen

- keine Intraday-Einpreisung; die Bewertung verwendet abgeschlossene
  Handelstage;
- keine automatisch geladenen Analysten-Konsensziele;
- Analystensignale entstehen nur, wenn eine Meldung ausdrücklich eine
  Hoch-/Herabstufung oder Kurszieländerung nennt;
- RSS-Inhalte bestehen überwiegend aus Überschrift und Kurztext. Vor einer
  Handlung ist die verlinkte Originalquelle zu prüfen;
- kostenlose RSS-Dienste können einzelne Meldungen verzögert oder unvollständig
  liefern.

## Installation

Die vollständige Schrittfolge steht in
[`INSTALLATION-V29.2.md`](./INSTALLATION-V29.2.md).

Kurzfassung:

1. Paketinhalt nach GitHub laden.
2. `version29-2-hybrid-schema.sql` in Supabase ausführen.
3. GitHub Action **Supabase Functions deployen** starten.
4. Bei fehlenden Cronjobs `setup-v29-2-hybrid-cron.sql` ausführen.
5. `reset.html?v=29.2` online öffnen.
6. Einmal **News Feed → Feed aktualisieren** wählen.

Der vorhandene `CRON_SECRET` bleibt unverändert. Das bestehende
`version29-market-intelligence-schema.sql` muss nur vorhanden sein; es wird
durch V29.2 nicht ersetzt.
