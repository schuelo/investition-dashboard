# Investition Dashboard V27.1 – Professional Dark Rebuild

V27.1 behebt den Desktop-Layoutfehler aus V27.0, bei dem Marktticker, Seitenleiste und Hauptinhalt teilweise übereinanderlagen.

## Korrekturen

- Seitenleiste aus dem Header-Stacking-Kontext gelöst
- feste Desktop-Seitenleiste mit eindeutigem `z-index`
- Header und Ticker beginnen erst rechts neben der Seitenleiste
- Hauptinhalt besitzt eine feste, zur Seitenleiste passende Einrückung
- separate mobile Bottom-Navigation bleibt erhalten
- keine Änderungen an Supabase, Datenbank oder Edge Functions
- Funktionen aus V26/V27 bleiben unverändert

## Installation

1. Vorhandene Dateien im GitHub-Repository sichern.
2. Den Inhalt des GitHub-Pakets in das Repository-Hauptverzeichnis laden und vorhandene Dateien ersetzen.
3. Änderungen committen.
4. Folgende Adresse öffnen:

   `https://schuelo.github.io/investition-dashboard/reset.html?v=27.1`

5. „Jetzt zurücksetzen“ wählen.
6. Danach öffnen:

   `https://schuelo.github.io/investition-dashboard/?v=27.1`

Im Dashboard muss „Dashboard 27.1“ angezeigt werden.

## Technischer Hinweis

Der Fehler entstand, weil die feste Navigation innerhalb des sticky Headers lag. Dadurch war sie an dessen Stacking-Kontext gebunden und konnte vom Ticker überlagert werden. In V27.1 ist die Navigation ein eigenständiges Element außerhalb des Headers.
