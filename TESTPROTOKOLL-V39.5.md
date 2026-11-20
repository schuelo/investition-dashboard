# V39.5.0 — Prüfprotokoll

Stand: **20.11.2026**. Grundlage ist das vollständige V39.4.0-Paket mit 231 Dateien; SHA-256 des Ausgangs-ZIP: `05b90c6212c108cad8ebd237b379f6ca3582b08bc8d289187de528a77d0d8423`.

## Ergebnis und Umfang

| Prüfung | Ergebnis |
| --- | --- |
| Gesamte JavaScript-Testserie | 560 bestanden; 0 fehlgeschlagen; 0 übersprungen |
| Umfang gegenüber V39.4 | 537 bestehende und 23 zusätzliche Tests |
| Tatsächliche SQL-Prüfungen in PostgreSQL/PGlite | 169 bestanden: 72 V38, 12 V39, 35 V39.1 und 50 V39.2 |
| Versions- und SQL-Generatoren | Prüfmodus erfolgreich |
| Historische Dateien | Alle 231 bisherigen Dateien weiter enthalten; ursprüngliche SQL-Dateien unverändert |
| Unveränderte Basismodule | app.js, news.js, decision.js, analytics.js, event-analysis.js, supabase.js, startdaten.json bytegleich |

Ausführen: `npm ci --ignore-scripts --no-audit --no-fund`, danach `npm test`, `npm run check:sql`, `node scripts/set-version.mjs --check` und `node scripts/build-update-sql.mjs --check`. Das statische Hosting benötigt diese Testabhängigkeiten nicht.

## Neue funktionale Prüfungen

- Eine tatsächlich gespeicherte Oktober-Historie bleibt bei einem November-Prüfdatum in allen fünf Zeiträumen sichtbar. Datum und Veraltet-Status bleiben unverändert.
- Zu kurze Historien werden als unvollständig bezeichnet. Zukünftige, ungültige und negative Werte können keinen aktuellen Endpunkt vortäuschen. Ohne Daten sind alle Zeitraum-Schaltflächen deaktiviert.
- Der automatische Depotchart wählt seine Bedeutung vor dem Zeitfilter. Ein Wechsel des Zeitraums ersetzt Euro-Messungen nicht durch eine Simulation oder einen Index.
- Der Beobachtungsvergleich verwendet gemeinsame echte Kurstage. Ein einzelner gemeinsamer Kurstag wird als solcher gezeigt.
- Alle Listenzeilen verwenden dieselbe Minichart-Geometrie, einschließlich des Platzhalters. Umfangreiche Kennzahlen und Meldungen stehen in einem zunächst geschlossenen Detailbereich; kein automatisch erzeugtes TradingView-Widget in der Liste.
- Tatsächliche UI-Controllerereignisse prüfen die Zeitraumwahl am Wertpapier, den 3M-Zeitraum im Depot und die Synchronisierung der Listen-Minicharts ohne zusätzliche Anbieteranfrage.
- Eine reine Höhenänderung des Charts löst keinen kompletten Neuaufbau aus und schließt dadurch nicht sofort die aufgeklappte Datenerklärung. Breitenänderungen passen die Grafik weiter an.
- Ticker und Währung müssen für dargestellte Kurse und Historien übereinstimmen.
- Ein passender eigener gespeicherter Schlusskurs kann eine fehlende oder ältere Depotbewertung ergänzen. Ein neuerer vorhandener Kurs und eine manuelle Bewertung behalten Vorrang.
- Tatsächliche API- und PostgreSQL-Tests prüfen die Übernahme aus eigenem Kurscache und einem früheren Deep-Bericht, ohne Anbieter-/KI-Aufruf und ohne Änderung der gespeicherten Asset-Analyse oder Kursdaten.
- Die JSON-Feldauswahl älterer Berichte wird mit tatsächlich ausgeführter PostgreSQL-Projektion geprüft. Modellpfade, fremde Eigentümer und abweichende Währungen liefern keinen Ersatzkurs.
- Ein nicht erreichbarer eigener Kurscache löscht keine noch gültige Bewertung und löst keinen Ersatzanbieter aus.

Bestehende Prüfungen decken weiterhin Bestandseditor, Transaktionen und Eigentümertrennung, Quellenwahl, WKN/ISIN, News, Hintergrund-Lease, Analysehistorie, Chat, Deep-Vorbereitung, sechs Szenarien, Hebel-/Produktmodelle, Trigger und getrenntes Papierdepot ab. Die frühere Erwartung eines automatisch geöffneten Börsencharts wurde auf ausdrücklich bestätigten manuellen Start geändert. Versionsprüfungen folgen 39.5.0.

## Grafik- und Strukturprüfung

Ein lokaler Ablauf führte den tatsächlichen Controller über die Function bis zur PostgreSQL-Datenbank mit ausdrücklich synthetischen Testdaten aus. Die Zeitreihe endete am 09.10.2026, der UI-Prüfzeitpunkt lag am 20.11.2026. Die erzeugten SVGs aller fünf Zeiträume sowie zwei Listen-Minicharts wurden anschließend mit Inkscape gerendert:

- Fünf historische Chart-SVGs jeweils bei 375 und 1000 Pixeln Breite.
- Zwei Listen-SVGs, mit Daten und ohne Daten, jeweils bei 94 und 128 Pixeln Breite.
- Insgesamt 14 Rasterbilder; gültiges SVG/XML, passende Geometrie und sichtbare Kurvenpixel geprüft. Stichproben von 1W, 1J und beiden Minicharts visuell geprüft.
- Ursprüngliches Kursdatum im Controller unverändert; keine externe Anbieteranfrage.

Die statische Strukturprüfung kontrolliert eindeutige HTML-IDs, lokale Assets und Modulimporte, geschlossene Details-Strukturen, Cache-Einträge und ausgeglichene CSS-Klammern. Die mobilen Größen sind zusätzlich in den CSS-Regeln berücksichtigt. Dies ist keine vollständig gerenderte Browser- oder iPhone-Abnahme.

## Grenzen

Kein Deployment und kein Live-Test der produktiven Website durchgeführt. Für diese Arbeit wurde keine Live-URL angegeben. Eigene zusätzliche Datenbanktrigger, aktive Supabase-Zeitpläne, reale Anbieterquoten, TradingView-Verfügbarkeit, Gemini-Billing und Telegram-Zustellung sind nicht live verifiziert. Die Cron-/Net-/Vault-Schnittstellen der SQL-Tests sind kontrollierte Ersatzschnittstellen; kein HTTP-Versand.

Die synthetischen Grafikbilder sind interne Prüfdaten und keine Börsenhistorien des Nutzers. Es wurden keine echten Datenbestände ergänzt oder historische Kurse erfunden. Datenlücken, veraltete Preise und die Grenzen einer Bestandsrückrechnung bleiben in der Oberfläche erkennbar.
