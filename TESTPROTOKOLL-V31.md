# Testprotokoll V31.0

Geprüfter Stand: V29.4 + V30.1.1 + separates V31.0-Signalmodul. Prüfung am 11.10.2026.

## Ergebnis

- 83 Tests, 83 erfolgreich, 0 fehlgeschlagen.
- Node 24.19.0; Aufruf: `node --test tests/*.test.mjs`.
- 20 JavaScript-/TypeScript-Dateien zusätzlich mit `node --check` auf Syntax geprüft.
- 170 eindeutige HTML-IDs, sechs getrennte Navigationsseiten, acht referenzierte lokale Frontendassets geprüft.
- 15 bestehende Kern-Dateien per SHA-256 unverändert gegenüber dem originalen V30.1.1-Paket.
- ZIP auf Lesbarkeit und CRC-Integrität geprüft.

## Prüfbereiche

| Bereich | Nachweis |
| --- | --- |
| Bisherige Funktionen | Alle 40 bestehenden V29.4-/V30.1-Tests bestehen. |
| Indikatoren | RSI-Referenzsequenz, ATR inklusive Gaps und Wilder-Glättung, SMA-Seed der EMA, Donchian ohne Einbezug der Ausbruchskerze. |
| Kursdaten | Fehlende OHLC, doppelte Daten, nicht positive Preise und unvollständige Kerzen abgewiesen; adjusted_close auf jüngste Rohkursbasis normalisiert. |
| Simulation | Reproduzierbarer Seed, positive Pfade und geordnete Quantile; Newsimpuls nur nach ausdrücklicher Auswahl. |
| Handelsschwellen | Long-/Short-Reihenfolge, 2R/3R, veraltete Daten, extreme Sprünge und News-/Chartwiderspruch. |
| Quellen/KI | Handelsplatzgenauer Abgleich, Zukunft/Alter/Dubletten; unbekannte Quellenverweise und unbelegte gerichtete Thesen verworfen. |
| Anbieterfehler | Fehlende KI-Konfiguration, keine News, Budgetlimit, Cachefehler, Historienfehler und CSV ohne globale Cacheänderung. |
| Edge Function | Tatsächlichen TypeScript-Handler mit isolierten IO-Abhängigkeiten ausgeführt: Anmeldung, ungültige Sitzung, Preflight, falsche Methode, JSON-Fehler und Speicherung nur unter serverseitig verifizierter Nutzer-ID. |
| Oberfläche | Tatsächliches UI-Modul in minimaler DOM-Testumgebung: Demo, SVG, Methoden, Szenarien, Kursmarken, Auswahl bestehender Aktie und Löschen bei Sitzungswechsel. |
| KO-Handhabung | Produktwährung wird nicht als Basiswertwährung übernommen; explizite Bestätigung erforderlich. |
| Navigation | Tatsächliche showPage-Funktion ausgeführt; Signal-Seite sichtbar, alle bisherigen Seiten verborgen; Rückkehr zur Eventanalyse geprüft. |
| Isolation | Bestehende Functions, Shared-Quellen, V29.4-/V30-SQLs, Eventanalyse, Decision- und Analytics-Komponenten sowie bisheriger Deployworkflow byteweise identisch. |
| Neues Schema | Eigene Tabellen, RLS-Nutzerfilter, eingeschränkte Cache-/Budgetzugriffe; keine neuen Cronjobs. |

## Grenzen der Prüfung

Keine Liveanbieter, produktiven Secrets, SQL-Migrationen oder Deployments ausgeführt. Die Supabase-RLS- und Budget-SQLs wurden statisch geprüft; tatsächliche Ausführung und Anbieterberechtigungen müssen bei der Inbetriebnahme verifiziert werden. Browserdarstellung und echte Feedregel-Auslösung wurden nicht in einem interaktiven Browser geprüft. Die DOM-Tests ersetzen keinen Browser-/Mobilgerätecheck.

Die Simulation wurde auf technische Korrektheit geprüft, nicht auf finanzielle Prognosegüte. Es gibt keine Kalibrierung oder nachgewiesene Erfolgsquote. Synthetische Kursfixtures sind ausdrücklich keine echten Marktpreise.

Installation und Live-Abnahme: `INSTALLATION-V31.md`.
