# V39.4.0 — Prüfprotokoll

Stand: 16.11.2026. Grundlage: vollständiges V39.3.0-Paket, 220 Dateien, SHA-256 `c8b96472cb2081ee7f3237f784aea0ac02d38ed144e4902374e332da08ab2867`.

## Prüfarten

Die Prüfung umfasst vorhandene Basismodule, Benutzerabläufe, APIs, PostgreSQL-Transaktionen, Quellen-/Providertrennung, Chartberechnung, gespeicherte Berichte, Chat, Szenarien, Produktmodelle, Benchmark und Versionsgenerierung. Eine lokale erfolgreiche Prüfung ist keine Bestätigung des veröffentlichten Installationsstands.

- **537 automatisierte Tests bestanden**, keine Fehler oder übersprungenen Tests. Darin enthalten: 512 bisherige Tests und 25 neue Prüfungen bzw. Integrationstests für V39.4.
- **169 SQL-Prüfungen bestanden** in PostgreSQL/PGlite: 72 V38, 12 V39, 35 V39.1, 50 V39.2. Keine neue Datenbankstruktur für die Grafik erforderlich.
- Tatsächlicher Datenweg **Position speichern → PostgreSQL → Function → UI-Controller → erzeugte SVG** geprüft.
- Drei tatsächlich vom UI-Controller erzeugte Diagrammtypen mit Inkscape als SVG-Renderer bei **375 und 1000 Pixeln** gerendert: Rückrechnung, Kursvergleich und Einzelbewertung. Sechs Rasterbilder erzeugt; Kurven-/Punktpixel jeweils sichtbar vorhanden. Rückrechnung und Einzelbewertung zusätzlich visuell kontrolliert.
- Keine Browserverifikation der kompletten Website, keine iPhone-Geräteabnahme und kein Deployment durchgeführt.

## Konkrete neue Fehlerfälle

| Fall | Ergebnis |
| --- | --- |
| Keine zwei früheren Depotmessungen, aber echte gespeicherte Kurse und Kaufdaten | Sichtbare, ausdrücklich gekennzeichnete Rückrechnung des heutigen offenen Bestands in der jeweiligen Währung. |
| Kaufdaten fehlen | Kursvergleich mit Index 100 anstelle eines erfundenen historischen Kontowerts. |
| Zwei gültige Depotmessungen vorhanden | Tatsächlich gespeicherte Messungen haben in der automatischen Auswahl Vorrang. |
| Verlaufstabelle leer | Aktuelle tatsächliche Bewertung als Punkt und klarer Erfassungsstatus; kein heimliches Schreiben einer erfundenen Vergangenheit. |
| Verlaufstabelle in echter PostgreSQL-Datenbank nicht erreichbar | Depotwert bleibt verfügbar, gespeicherte Kurse liefern weiterhin einen Graphen, Diagnose zeigt den Speicherfehler. |
| Gesamte Depotantwort schlägt nach früherem Erfolg fehl | Letzte gültige Übersicht bleibt mit ursprünglichem Stand und deutlicher Fehlerkennzeichnung erhalten. |
| Noch keine erfolgreiche Depotantwort | Nicht als leeres Depot dargestellt. Vorhandene eigene Kursreihen können separat verglichen werden. |
| Eine Position hat keine Historie, ein anderer Handelsplatz oder eine andere Währung liegt vor | Keine vollständige Euro-Rückrechnung aus unvollständigen/vermischten Komponenten. |
| Letzter Kauf liegt nach historischen Kursen | Keine rückdatierten Bestände oder erfundenen Handelstage. |
| Alte Depotantwort außerhalb des gewählten Zeitraums | Kein Umdatieren eines alten Werts auf heute, um einen Punkt zu erzeugen. |
| Deep aus dem Wertpapier öffnen | Exakte Identität, Währung und echte eigene OHLCV übernommen; nur Lesezugriffe, keine Kurs-/KI-/Quotenoperation. |
| Cache fehlt, eigener letzter Bericht hat echte OHLCV | Vorbereitung aus diesem eigenen Bericht möglich. Reine Schlusskurse werden nicht in OHLCV umgebaut. |
| Fremder Cache / fremde Wertpapier-ID | Kein Zugriff auf fremde Historien oder vorbereitete Deep-Daten. |
| Neue Deep-Analyse | Eigenes Deep-Datum zusätzlich in der Wertpapierliste; keine unbelegte Umwandlung der Simulation in ein aktuelles Kaufsignal. |
| Deep-Eingaben eines früheren Werts oder einer früheren Sitzung | Formular, Produktannahmen und privater Kontext werden beim entsprechenden Wechsel zurückgesetzt. |
| Fehlende / nicht freigegebene Gemini-Modellkennung | Status behauptet keine funktionsfähige Chatkonfiguration, obwohl Schlüssel und Tarif-Bestätigung allein gesetzt sind. |
| Fehlende Darstellungsdatei oder ausbleibende Initialisierung | Sichtbarer Fehlerstatus statt stiller leerer Oberfläche. |
| Fehler beim Abfragen der Function-Fähigkeiten | Sichtbare Fehlermeldung statt stillschweigendem „bereit“-Status. |

Vorhandene Tests sichern unter anderem Depoteditor, Idempotenz, Bestands-/Eigentümertrennung, fehlgeschlagene Kurse, manuelle Quellen, WKN-/ISIN-Bestätigung, sechs Szenarien, KO-/Faktor-/Optionsmodelle, fehlende Ausführungsdaten, begrenzten KI-Kontext, Chatstatus, Triggerverhalten und getrenntes Papierdepot ab.

## Darstellung und Erreichbarkeit

Die neue Darstellung erhält eine explizite minimale Höhe. Linien und Punkte haben konkrete Farben und positive Geometrie; eine einzelne Bewertung wird nicht zu einem unsichtbaren Pfad zusammengezogen. Datenquelle, Diagrammtyp und Datenanzahl stehen neben der Grafik. Die Deep-Navigation aktiviert zusätzlich die bestehende Panelsteuerung, damit das Werkzeug nicht nur per CSS erreichbar erscheint.

Die SVG-Rasterprüfung verwendet synthetische, ausdrücklich als Testdaten behandelte Kursreihen über den tatsächlichen API-/Datenbank-/Controllerweg. Die Rasterbilder zeigen keine realen Nutzerbestände und wurden nicht als Marktanalyse geliefert. Sie sind kein Screenshot der produktiven Website.

## Erhaltener Bestand

`app.js`, `news.js`, `decision.js`, `analytics.js`, `event-analysis.js`, `supabase.js` und `startdaten.json` gegenüber V39.3 bytegleich. Historische SQL-Dateien erhalten. Änderungen an Berechnungs-/Darstellungsmodulen sind im aktuellen Quellstand und Release-Manifest enthalten. Die bestehende V36-Deep-Berechnungsversion und V33-Benchmarkversion bleiben von der Dashboard-Releaseversion getrennt.

## Externe Abhängigkeiten und offene Live-Abnahme

Die dokumentierten Gemini-Modellkennungen wurden gegen die offizielle [Modellübersicht](https://ai.google.dev/gemini-api/docs/models) und [Preisseite](https://ai.google.dev/gemini-api/docs/pricing) geprüft. Das Tool aktiviert kein Billing, kann aber den tatsächlichen Tarif des eigenen Google-Projekts nicht allein anhand eines Schlüssels bestätigen. Es wurden keine Gemini-Anfragen ausgelöst.

Nicht live verifiziert: veröffentlichte Website, angemeldete produktive Sitzung, zusätzliche eigene Datenbanktrigger, externer Kursabruf, TradingView-Abdeckung konkreter Werte, tatsächliche Gemini-Berechtigungen/Kontingente, Telegram-Zustellung und aktiver Supabase-Zeitplan. Es wurde keine Nachricht versendet. Für den Live-Abgleich wurde keine Website-URL angegeben; die lokale Prüfung wurde ohne sie abgeschlossen.
