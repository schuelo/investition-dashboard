# V30.1 – unabhängige Investmentideen

## Behoben

- Marktideen waren zuvor an `analysis_scope = portfolio_watchlist_market` gekoppelt.
- Nicht erkannte Szenarien erzeugten keine Kandidaten.
- Eine globale Symbol-Deduplizierung entfernte Marktideen, wenn derselbe Wert bereits im Portfolio oder in der Watchlist lag.

## Neu

- Eigenständige Ideen-Engine `event-idea-engine.mjs` ohne Portfolioabhängigkeit.
- Erweiterte Themenmuster für Rohstoffe, Zinsen, Energie, KI, Stromnetze, Cybersecurity, Düngemittel, Wasser, Logistik, Gesundheit und weitere Marktmechanismen.
- Garantierte Recherche-Rückfallebene mit transparenter Kennzeichnung.
- Separate Deduplizierung für Portfolio, Watchlist und Marktideen.
- Anzeige von Chancen, Risiken/Short-Kandidaten, Absicherungen und Recherchekandidaten.
- 40 automatisierte Tests, darunter sieben unterschiedliche Ereignisszenarien mit mindestens vier Ideen und ein nicht klassifizierbarer Fallback-Fall mit mindestens sechs Recherchekandidaten.

---

# V30.0 Integration in V29.4

## Frontend

- fünfter Navigationspunkt `Event- & Szenarioanalyse`;
- eigene `#events`-Seite innerhalb der bestehenden Login-Wall;
- gemeinsame Supabase-Sitzung statt separatem V30-Login;
- Analysehistorie, sechs Ergebnis-Tabs und Verlinkung zu vorhandenen Trading-Analysen;
- eigener, namensräumlich getrennter CSS-Bereich;
- Service-Worker-Cache auf den integrierten Stand aktualisiert.

## Backend

- neue Edge Function `analyze-market-event`;
- Abgleich mit `market_news`, offenen `depot_positions` und bereinigter `trade_plans`-Watchlist;
- Recherche über GDELT und Google News RSS;
- getrennte V30-Tabellen mit RLS;
- keine neuen Cronjobs und keine Änderung bestehender Secrets.

## Korrekturen gegenüber dem Standalone-Prototyp

- Verwendung der tatsächlichen V29.4-Tabelle `market_news` statt `news_items`;
- offene Depotpositionen über `is_open = true`;
- geschlossene/verworfenene Trade-Pläne werden nicht als Watchlist behandelt;
- historischer V30.0-Stand: Marktideen wurden nur beim Umfang `Portfolio, Watchlist und Marktideen` ergänzt; in V30.1 behoben;
- Einpreisung wird aus passenden, bereits bewerteten V29.4-News abgeleitet;
- bestehende Dashboard-Anmeldung wird wiederverwendet.
