# Investition – Live Web Dashboard

## Start

1. `index.html` im Browser öffnen.
2. Für zuverlässigeres Laden der Live-Widgets optional einen lokalen Webserver starten:
   - Windows: `start-dashboard.bat`
   - macOS/Linux: `./start-dashboard.sh`
3. Danach `http://localhost:8080` öffnen.

## Funktionen

- Live-Ticker und interaktive Charts über TradingView
- Trade-Pläne für Aktien sowie Long-/Short-Knock-outs
- Entry-Zonen, Limits, Stop/Invalidation, drei Kursziele
- KO-Schwelle, Basispreis, Hebel, Bezugsverhältnis, WKN/ISIN
- Status- und Filterlogik
- Kursleiter zur visuellen Darstellung der Analysemarken
- Lokale Speicherung im Browser (`localStorage`)
- JSON-Export und -Import zur Datensicherung

## Wichtiger Hinweis

Die individuellen Analysemarken sind manuell gepflegte Planungsdaten. Die kostenlose TradingView-Einbettung liefert Marktansichten; je nach Börse können Kursdaten verzögert sein. Das Dashboard führt keine Orders aus und ist nicht mit einem Broker verbunden.
