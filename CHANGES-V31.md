# Änderungen V31.0

Neues getrenntes Modul Signal- & Verlaufssimulation auf Basis des vollständigen V30.1.1-Pakets.

- Neue Seite und Navigationspunkt `#signals`.
- KI-News-Ableitungen mit validierten Quellenverweisen; klar sichtbarer Chartmodus bei fehlender KI.
- Berechnete Chartmethoden mit Parametern, Werten, Befunden und Grenzen.
- Reproduzierbarer Block-Bootstrap, Modellbänder und illustrative Verlaufsszenarien.
- Bedingte Long-/Short-Einstiege, Stops, Teilgewinn-/Ausstiegsmarken und Zeit-/Trailing-Stop-Regeln.
- Eigenes Schema, eigene Historie, Feedregeln und eigener manueller Deployworkflow.
- OHLCV-CSV für lokale Berechnung; kein Scraping von TradingView-Widgets.

Notwendige Änderungen vorhandener Dateien: `index.html` (neue Seite/Assets), `news.js` (Navigation), `app.js` (nur Service-Worker-Versionskennung), `service-worker.js` / `reset.html` (Cache), `supabase/config.toml` (neue Function), Regressionstest-Cachekennungen und README.

Bestehende Analyse- und Newsfunctions sowie bisheriger Deploymentworkflow unverändert. Keine produktive Installation vorgenommen.
