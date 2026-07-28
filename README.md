# Investition Dashboard V29.3 – kostenlose Multi-Source Intelligence

V29.3 ersetzt die in Supabase blockierten Google-/Bing-Suchen aus V29.2 durch
eine unabhängige Mehrquellen-Architektur. Portfolio, Watchlist, Bewertungen,
Einpreisungsindikationen und Telegram-News bleiben unverändert miteinander
verbunden.

## News-Quellen

- GDELT DOC 2.0 als offener, weltweiter News-Index ohne API-Schlüssel;
- Yahoo Finance RSS als aktienbezogener Ersatzweg;
- direkte Feeds von EZB, Federal Reserve und BIZ für Geldpolitik und Makro;
- direkte Wirtschafts- und Technologiefeeds der Tagesschau;
- Google News RSS nur optional über
  `GOOGLE_NEWS_RSS_ENABLED=true` (standardmäßig deaktiviert).

Die Suchabfragen laufen gedrosselt. Fehler einer Quelle werden als Teilhinweis
protokolliert und brechen den übrigen Lauf nicht ab. Falls in einem Lauf keine
Quelle aktuelle Treffer liefert, antwortet die Function kontrolliert mit
`ok=true` und `degraded=true`; vorhandene Meldungen bleiben erhalten.

## Bewertung und Benachrichtigung

- regelbasierte Bewertung von Relevanz, Vertrauen, Auswirkung und Dringlichkeit;
- Einpreisungsindikation über direkte Schlusskurse oder kostenlose Markt-Proxys;
- Handlungshinweise für offene Positionen und Watchlist-Werte;
- Telegram-Alarm für neue, relevante Meldungen zu offenen Depotpositionen;
- transparente Kennzeichnung als offener News-Index, Direktfeed oder
  RSS-Aggregator.

## Schutz des kostenlosen EODHD-Tarifs

Der Newsfeed verbraucht keine EODHD-News-Einheiten. Für direkte
Wertpapierkurse reserviert `sync-news` weiterhin höchstens sechs
EODHD-Aufrufe je UTC-Tag. Stooq liefert kostenlos die Markt-Proxys `QQQ.US`,
`SOXX.US`, `XLE.US`, `SPY.US` und `EURUSD.FOREX`.

## Bewusste Einschränkungen

- keine Intraday-Einpreisung; die Bewertung verwendet abgeschlossene
  Handelstage;
- keine automatisch geladenen Analysten-Konsensziele;
- GDELT-Ergebnisse enthalten überwiegend Überschrift, Link und Quellenmetadaten;
- kostenlose Quellen können einzelne Meldungen verzögert oder unvollständig
  liefern;
- vor einer Handlung ist immer die verlinkte Originalquelle zu prüfen.

## Update von V29.2

1. Paketinhalt nach GitHub laden.
2. GitHub Action **Supabase Functions deployen** starten.
3. `reset.html?v=29.3` online öffnen.
4. Einmal **News Feed → Feed aktualisieren** wählen.

Von V29.2 auf V29.3 ist keine neue SQL-Migration und keine Änderung von
`CRON_SECRET`, EODHD-Token oder Cronjobs erforderlich.

Die vollständige Anleitung steht in
[`INSTALLATION-V29.3.md`](./INSTALLATION-V29.3.md).
