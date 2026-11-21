# Testprotokoll V40.0.0

Abschluss der lokalen Abnahme: **21.11.2026**. Basis: vollständiges V39.5.0-Paket mit SHA-256 `87c5e33082388749c9b7313aab9f55f592703d64f8b365bb596831d9fc1f5cfc`.

## Automatisierte Gesamtläufe

| Prüfung | Ergebnis |
| --- | --- |
| `npm test` | **614 von 614 bestanden**, keine übersprungenen Tests, keine Fehler |
| `npm run check:sql` | **199 Prüfungen bestanden**: V38 72, V39 12, V39.1 35, V39.2 50, V40 30 |
| `node scripts/set-version.mjs --check` | Bestanden: Website, Anmeldung, aktive UI und Server-Metadaten konsistent auf 40.0.0 |
| `node scripts/build-update-sql.mjs --check` | Bestanden: kombinierte V40-Migrationen entsprechen ihren Quelldateien |
| `node scripts/build-static.mjs` | Bestanden: 75 Laufzeitdateien; Tests, SQL, Entwickler- und Deploymentskripte sowie beliebige JSON-Dateien ausgeschlossen |
| Vergleich mit Basisarchiv | Alle 241 bisherigen Dateien vorhanden; alle 30 historischen SQL-Dateien unverändert |
| Zentrale bestehende Module | `app.js`, `news.js`, `decision.js`, `analytics.js`, `event-analysis.js`, `supabase.js` und `startdaten.json` bytegleich zur Basis |

Die Datenbanktests führen tatsächliche SQL-Funktionen, Trigger und Rechteprüfungen in PostgreSQL/PGlite aus. Für Cron, Netzwerk und Vault sind Schnittstellen simuliert. Sie senden keine produktiven HTTP-Anfragen und beweisen keine laufende Supabase-Infrastruktur.

## Neu oder besonders gezielt geprüft

- **Bestände:** Neu anlegen, bekannte Identität wählen, absolute Menge/Einstand ändern, neue getrennte Käufe, gewichteter Einstand, Bruchstücke, Einstandsdatum, bestätigtes Ausbuchen und Auswahl nur eines von mehreren Posten.
- **Doppelbuchungen:** Wiederholte Anfrage, unklarer erster Speicherausgang, unbekannt bereits vorhandener Bestand, zusätzliche Position nur nach bewusster Auswahl; kein stilles Überschreiben bei globalem Hinzufügen.
- **Archivierung:** Alle eigenen Posten atomar schließen, alte unmigrierte Bestände schließen, Watchlist und Monitoring deaktivieren, Berichte und Änderungen behalten; Wiederholung einer alten Archiv-Anfrage kann einen später neu angelegten Bestand nicht schließen.
- **Eigentümergrenzen:** Fremde und nicht angemeldete Anfragen, Schreibrechte auf Ereignisse, direkte SQL-Funktionsrechte, abgelaufene UI-Antworten nach Abmeldung und konkurrierende Analyse-/Archivierungsoperationen.
- **Kurse:** Kürzlich geladenes, aber veraltetes öffentliches/Alpha-Cachematerial; explizites Erzwingen des inneren Datenabrufs; genaue Quelle, Kennung und Währung; fremde IDs in einer Batch-Anfrage werden vor jedem Anbieteraufruf abgefangen.
- **Anbieterfehler:** HTTP 429 mit und ohne vorhandene Historie, sichtbare sechsstündige Pause, gleicher ursprünglicher Fehlerzeitpunkt, keine weitere Netzwerkanfrage innerhalb der Pause; alter gültiger Kurs bleibt datiert erhalten. Falsche Währung wird nicht zur Depotbewertung übernommen.
- **Automatik:** Eigener tatsächlich gespeicherter Hintergrundlauf statt globalem Lauf anderer Benutzer; manuelle Prüfungen ändern diesen Nachweis nicht. Netzwerkbudget und Reihenfolge mehrerer Monitorläufe, nächste Prüftermine und gemeinsame Kontingente.
- **Bedienung:** Reale Controller-Ereignisse für Tabwechsel, Kurskonfiguration, Speichern, Archivieren, Watchlist-Entfernen und Hintergrundaktualisierung der Ansicht. Der Browser-Timer liest nur gespeicherte Daten; er startet keine Anbieter oder KI.
- **Analyse:** Separater Kursrefresh verändert nicht den Analysezeitpunkt. Nach Bestands-/Planänderung sind alte aktuelle Schwellen blockiert, während Bericht, Techniken und damaliges Szenariomodell datiert erhalten bleiben. Vorhandene Quellen-, Deep-, Chat-, Hebel-, Simulations- und Papierdepot-Tests sind im Gesamtlauf enthalten.
- **Migration/Deployment:** Wiederholbares V40-SQL, Upgrade einer bestehenden älteren Depotbasis, keine automatische leere Neuinstallation; Zugangsdaten nicht in Fehlerausgaben; Management-API-Fehler ohne riskante automatische DDL-Wiederholung; statischer Build darf nicht die Projektwurzel löschen.

## Gerenderte Browserabnahme

Verwendet wurden die tatsächliche Oberfläche und der Controller mit einer echten lokalen PostgreSQL-Testdatenbank und dem tatsächlichen API-Handler. Authentifizierung und Kursanbieter wurden ausschließlich durch synthetische Testadapter ersetzt. Die Vorschau war sichtbar mit **TESTDATEN** gekennzeichnet. Keine echte Depotposition, echte Order, produktive Nachricht, Gemini- oder Anbieterabrechnung wurde ausgelöst.

| Im Browser ausgeführter Ablauf | Beobachtetes Ergebnis |
| --- | --- |
| Zwei alte Kursstände manuell aktualisieren | Neue simulierte abgeschlossene Tageskerzen, korrektes Datum und aktuelle Kurskennzeichnung; kein KI-Aufruf |
| Basisanalyse am Wert starten | Sichtbarer Bearbeitungsstatus, gespeicherter Bericht und Einschätzung; Charttechniken und Szenarien aufklappbar |
| Techniken anzeigen | SMA 20/50/200, MACD, RSI, ATR, Bollinger, Donchian und Volumen mit jeweiliger Einordnung und Grenzen sichtbar |
| Menge 2 auf 2,5 ändern | Bestehender Posten korrigiert, Rückkehr zum selben Wert, aktualisierte Positionsbewertung; kein zusätzlicher Kauf |
| Alten Bericht nach Bestandsänderung ansehen | Aktuelle Entscheidung offen; aktuelle Schwellen gesperrt; früheres Modell und Techniken bleiben datiert lesbar |
| Einen weiteren Anteil als getrennten Posten anlegen | Zwei Posten mit insgesamt 3,5 Anteilen und gewichtetem Einstand |
| Zweiten Posten gezielt ausbuchen | Erster Posten mit 2,5 Anteilen bleibt offen; Bestandsverlauf dokumentiert Schließen |
| Gesamten Wert archivieren | Bestätigung erforderlich; alle verbleibenden Posten geschlossen, Rückkehr zur Übersicht; Wert aus aktiver Beobachtung entfernt |
| Quelle eines bisher gespeicherten Werts einrichten | Anbieterkennung und Intervall 120 Minuten gespeichert; erster Quellenabruf ausdrücklich als ausstehend dargestellt; danach datierter Quellenkurs |
| Beobachtungswert entfernen | Wert verschwindet aus Beobachtung; gesondert geprüft: Entfernen eines gehaltenen Werts erhält dessen Depotbestand |
| Anbieterlimit simulieren | Alter Preis/Bestand bleibt erhalten; Abrufmeldung, **Anbieterpause** und nächster möglicher Versuch sichtbar |
| 1W, 1M, 3M, 1J und Max am Wert | In jedem Zeitraum genau eine eigene SVG-Kursgrafik; im Test 6/24/68/263/300 tatsächliche Testpunkte, jeweils passender Ausschnitt |
| Mobile Breiten 320, 375 und 430 px | Kein horizontaler Überlauf: Inhalts-/Scrollbreite jeweils 305/305, 360/360, 415/415 px (verbleibende Breite ist die Browser-Scrollleiste) |
| Bearbeiten bei 320 px | Vorausgefüllte Felder erreichbar, Bruchstück 0,125 gespeichert und wieder am Wert angezeigt; sichtbare Aktionsflächen mindestens 44 px hoch |
| Tastaturnavigation der Wertpapier-Tabs | End wechselt zu Verlauf, Home zurück zu Überblick; Auswahlzustand entsprechend gesetzt |

Die Browser-Konsole zeigte beim abschließenden Abruf ausschließlich Fehler einer Browser-Erweiterung, keine Anwendungsfehlermeldung. Die schmalen Ansichten wurden in einem Browserrahmen getestet. Das ist **keine Prüfung auf einem physischen iPhone oder in Safari**.

## Während der Abnahme korrigiert

Die Tests deckten unter anderem den Unterschied zwischen explizitem zusätzlichen Kauf und unerwartet bereits vorhandenem Bestand auf. Der zweite Fall öffnet den vorhandenen Bestand zur bewussten Entscheidung. Außerdem wurde die tatsächliche Anbieterpause zwar serverseitig gespeichert, zunächst aber in bestimmten Fehlerantworten nicht weitergegeben; API und Oberfläche geben sie nun auch ohne vorhandene Historie korrekt wieder. Beide Abläufe sind im abschließenden grünen Gesamtlauf enthalten. Die zusätzliche Paketprüfung deckte außerdem einen zu weit gefassten Verzeichnisfilter auf, der die bestehende Anmeldedatei `supabase.js` aus dem statischen Build ausschloss. Dieser Filter ist korrigiert. Ein zusätzlicher Test baut die tatsächliche Anwendung und prüft alle lokalen Startdateien sowie Modulimporte; die separate Abschlussprüfung bestätigte 140 gültige lokale Referenzen ohne fehlende Datei.

## Noch im Zielprojekt nachzuweisen

- Erfolgreicher Lauf des mitgelieferten GitHub-Workflows mit dem eigenen Access Token und aktivierter Pages-Quelle.
- Produktive Migration, Deployment beider Edge Functions, tatsächlicher eigener Monitorlauf und passende Vault-/Function-Secrets.
- Live-Verfügbarkeit, Abdeckung und Kontingent des bewusst gewählten Kursanbieters für die eigenen Wertpapiere.
- Produktive Anmeldung, reale vorhandene Depotdaten sowie Safari/iPhone-Bedienung mit Bildschirmtastatur.
- Bei optionalem Gemini-Einsatz: eigenes Modell, Kontingent und tatsächlicher Abrechnungsstatus.

Es wurde im Rahmen dieser Abnahme **keine produktive Veröffentlichung behauptet oder durchgeführt**. Diese offenen Nachweise sind in der Installationskontrolle berücksichtigt.
