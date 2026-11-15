# Prüfprotokoll V38.0.0

Stand: 15.11.2026. Basis: das zuvor gelieferte vollständige V37.0.0-Paket. Es wurde kein Deployment in das GitHub-/Supabase-Projekt durchgeführt.

## Ergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| Automatisierte JavaScript-Tests | 421 bestanden, 0 fehlgeschlagen, 0 übersprungen |
| Bestehende Tests der V37-Basis | 351 enthalten |
| Zusätzliche V38-Tests | 70 enthalten |
| SQL-Prüfungen in PostgreSQL/PGlite | 72 bestanden |
| Versions- und SQL-Ableitungsprüfung | bestanden |

Die JavaScript-Tests laufen mit `npm test`. Für die lokale SQL-Prüfung zuerst `npm ci --ignore-scripts --no-audit --no-fund` und anschließend `npm run check:sql` ausführen. Die einzige neue Entwicklungsabhängigkeit ist die festgelegte PostgreSQL-Laufzeit `@electric-sql/pglite`. Das statische Frontend benötigt keine Node-Installation.

## Was geprüft wurde

- Tatsächlicher V38-HTTP-Handler mit kontrollierten Datenbank- und HTTP-Adaptern: Benutzerzuordnung, Autorisierung, getrennte manuelle und Cron-Aufrufe, Depotabgleich, Analysestart, Nachrichten und Chat.
- Tatsächlicher UI-Controller in einer DOM-Testumgebung einschließlich integriertem Handler: manuelle Starts, WKN-Auswahl ohne Yahoo-Kursabfrage, Statusanzeigen, gespeicherte Berichte, Chat, Quellenwahl und Wechsel von Wertpapier oder angemeldetem Benutzer.
- Kursfrische getrennt vom Abrufstatus: fehlgeschlagener Abruf löscht keinen letzten gültigen Kurs; Cache-Lesen und Wiederöffnen ändern keine ursprünglichen Datenzeitpunkte.
- Keine stillen Quellenwechsel; Alpha-Vantage-Symbol-/Währungsprüfung, Tagesbudget, HTTP-429-/Limitmeldungen, fehlende Konfiguration, zwischengespeicherte Historien und Import eigener CSV-Daten.
- Teilberichte bei Kurs-/Nachrichtenproblemen, tatsächliche Bestände, eingeschränkte Aussage bei KO/Short/unklarer Richtung, bedingte Ein-/Ausstiegseinschätzungen, Szenarien und Quellenherkunft.
- Chat startet nur manuell. Fehler erzeugen keine erfundene Antwort. Berichtbezug, gekennzeichnete Nutzervorgaben, begrenzter Modellkontext, Notizen und externe Antworten bleiben nachvollziehbar.
- SQL-Migrationen und geschützte Schreibfunktionen wurden in einer echten lokalen PostgreSQL-Laufzeit ausgeführt: wiederholte Installation, RLS/Benutzertrennung, zusammengesetzte Fremdschlüssel, serverseitige Rechte, parallele Sperren, Kontingente, unveränderliche Berichte und atomare Chatpaare.
- Für den Zeitplan wurden die Schnittstellen von `cron`, `net` und `vault` kontrolliert nachgebildet. SQL-Konfiguration und erzeugter Job-Aufruf wurden dagegen ausgeführt; vorhandene fremde Jobs blieben erhalten. Dies ist kein Live-Test der Supabase-Erweiterungen und sendet kein HTTP.

## Erhalt der bisherigen Funktionen

Die unveränderte V37-Referenz hat SHA-256 `2915d604a7e26298682eeeacf01621fc7aaeeef6c0d2066dc6d105ff557e0cfc`.

Die 26 bisherigen Serverdateien außerhalb der erweiterten gemeinsamen Wertpapiereingabe wurden bytegenau mit dieser Referenz verglichen. Ebenso unverändert: `app.js`, `news.js`, `decision.js`, `analytics.js`, `event-analysis.js` und `supabase.js`. Die bisherige Deep-Berechnung bleibt auf ihrem vorhandenen Engine-Stand. V38 ergänzt eigene Tabellen, eine eigene Function und einen separat einzurichtenden Zeitplan. Neue Versionsverweise, Navigation und die gemeinsame Wertpapiereingabe sind notwendige Oberflächenergänzungen.

`RELEASE-MANIFEST-V38.json` enthält die endgültige Dateiliste, SHA-256-Prüfsummen und den Vergleich mit dem V37-Paket. Entwicklungsinstallationen, temporäre Logs und Zugangsdaten gehören nicht zum ZIP.

## Noch im Zielsystem zu prüfen

Es wurden keine eigenen Anbieter-/Benutzerschlüssel verwendet, keine echten Börsendaten angefordert und keine Abrechnungseinstellungen verändert. Anbieterabdeckung, tatsächliche kostenlose Kontingente, Supabase-Deployment und der echte Cron-Lauf müssen nach Installation im Zielprojekt überprüft werden. Die Alpha-Vantage-Compact-Historie liefert höchstens 100 Tageskerzen; eine längere Historie und SMA200 stehen damit nicht immer zur Verfügung.

Es wurde kein Browser-/iPhone-Live-Test ausgeführt. Die mobile Gestaltung ist implementiert und die Controller-Logik ist getestet; Darstellung, Bedienung und Tastatur auf dem eigenen Endgerät gehören zur Abnahme. Die Schritte dafür stehen in `INSTALLATION-V38.md`.
