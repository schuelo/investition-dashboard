# Anforderungsabgleich — Investition V39.4.0

Stand: 16.11.2026. Geprüft wurde das vollständige V39.3-Paket und daraus V39.4 erstellt. Dies ist ein Abgleich von Code, Datenwegen und Bedienlogik, kein Nachweis des Installationszustands deiner veröffentlichten Website.

**Umgesetzt** bedeutet im Paket vorhanden und lokal funktional geprüft. **Bedingt** bedeutet, dass Daten, Einrichtung oder ein externer Anbieter erforderlich bleiben. **Teilweise / offen** benennt eine fachliche Grenze oder einen noch fehlenden Teil.

| Anforderung aus dem bisherigen Verlauf | Stand V39.4 | Ergebnis und Grenze |
| --- | --- | --- |
| Depot, Suche und Beobachtung als Hauptnavigation | Umgesetzt | Drei Hauptbereiche; Analyse und Gespräch beim Wert. Vertiefende Werkzeuge sind direkt beim Wert und unter Verwaltung erreichbar. |
| Kompakte schwarze Oberfläche | Umgesetzt; mobile Live-Abnahme offen | Responsive Layouts, aufklappbare Details, ausreichend große Eingaben. SVGs bei 375/1000 Pixeln gerendert; kein vollständiger iPhone-Browsertest. |
| Tatsächliche Position mit Stückzahl und Einstand anlegen | Umgesetzt | Gemeinsamer Editor ohne vorherige Analyse und ohne Kursdienst. Dezimalkomma, Kaufdatum, zusätzliche bestätigte Position und Schließen unterstützt. |
| Frühere Werte, z. B. VW, weiterfinden | Umgesetzt | Alte Pläne/Analysen bleiben auffindbar; ein Analyseplan wird nicht als ausgeführter Kauf behandelt. Vorhandener tatsächlicher Bestand wird gesondert erfasst. |
| Depotwert, Einstand und Gewinn/Verlust | Umgesetzt, an Kursdaten gebunden | Getrennte Währungen und manuelle Bewertungen; fehlende oder unklare Bestände erzeugen keine erfundene Summe. |
| Sichtbare Depotentwicklung | In V39.4 erweitert | Gespeicherte Messungen, ausdrücklich gekennzeichnete Rückrechnung offener Bestände oder Kursvergleich. Fehlende Daten und Speicherfehler werden sichtbar. |
| Echte historische Gesamtdepot-Performance inklusive Cash/Verkäufen | Teilweise / offen | Messungen ab Erfassung vorhanden. Kein vollständiges historisches Transaktions-/Cashbuch und keine durchgängige TWR-/MWR-Rechnung. Rückrechnung ist dafür kein Ersatz. |
| Historische Kurven bei Depot, Beobachtung und Suche | Umgesetzt, an Historien gebunden | Eigene Kurs-Minicharts; historischer Wertpapierchart unabhängig von einem gesperrten Prognosemodell. Externe TradingView-Anzeige bleibt getrennt. |
| Andere Werte analysieren und speichern | Umgesetzt | WKN-/ISIN-Zuordnung, Merken, Beobachtung und erhaltenes Analysearchiv. |
| WKN/ISIN statt manueller Tickerkenntnis | Umgesetzt, Anbieterabdeckung bedingt | Gemeinsame Suchmasken einschließlich Depoteditor. Notierung, Aktiengattung und Währung bleiben zu prüfen; keine garantierte Auflösung jedes Papiers. |
| Analyse unabhängig von EODHD | Umgesetzt | Eigene gespeicherte Daten und CSV ohne EODHD; öffentliche Quelle und optional Alpha Vantage mit eigenen Grenzen. Keine stille EODHD-Ersatzabfrage. |
| Beliebig viele kostenlose aktuelle Kurse | Nicht garantiert | Auch öffentliche Quellen und Widgets haben Abdeckung und Limits. Ohne aktuelle Daten werden keine aktuellen Kursmarken freigegeben. |
| Kontinuierliche News-/Chartprüfung im Depot | Bedingt umgesetzt | Vorhandener V38-Zeitplan prüft aktiv markierte Werte ohne KI in begrenzten Chargen. Supabase-Zeitplan, Secrets und Datenzugänge müssen produktiv eingerichtet sein. Der letzte Lauf ist sichtbar; kein sekündliches Echtzeitmonitoring. |
| Kauf/Halten/Teilkäufe/Teilverkauf/Verkauf am Wert | Umgesetzt mit Qualitätsgrenzen | Regelbasierte Handlungsoptionen aus Daten, News, Bestand und explizitem Plan. Keine automatische Order; veraltete oder unzureichende Daten sperren aktuelle Kursschwellen. |
| Kursdatum, Analysezeit und Abruffehler auf einen Blick | Umgesetzt | Basisanalyse, zusätzlicher Deep-Zeitpunkt, Kursdatum, fehlender/gescheiterter Abruf und Planänderung sind getrennt sichtbar. |
| Eigene Quellen-URLs ergänzend zur Recherche | Umgesetzt | Bis zu zehn HTTPS-URLs, Status pro Abruf, begrenzte lesbare Auszüge und Quellenarchiv. Gesperrte Inhalte werden nicht als gelesen dargestellt. |
| Angewendete Charttechniken informativ anzeigen | Umgesetzt | Methoden mit Befund, Zweck und Grenzen; Tages-/Wochenanalyse und technische Schwellen. |
| Deep-Analyse und mehrere Szenarien | Umgesetzt, Zugang in V39.4 wieder ergänzt | Direkter Wertpapierbutton, sechs Szenarien, Stress-/Ereignisannahmen, begrenzte Risikomodelle. Gespeicherte echte OHLCV können vorbereitet werden, ohne erneut einen Anbieter aufzurufen. |
| Wählbarer Analyse-/Historienhorizont | Umgesetzt, Datenumfang bedingt | Fünf Prognosehorizonte und Historienauswahl bis 2000 Kerzen; nur tatsächlich vorhandene Daten werden verwendet. |
| Frühere Analysen ansehen und als Kontext nutzen | Umgesetzt mit Begrenzung | Basisberichtshistorie, ausgewählte frühere Deep-Berichte und Vergleich. Kein unbegrenztes automatisches Training aus allen Analysen. |
| Simulation später gegen echte Entwicklung prüfen | Teilweise | Vorhandene Auswertungsfunktion. Keine systematisch nachgewiesene Out-of-sample-Güte oder kalibrierte Trefferwahrscheinlichkeit. |
| Knock-outs und Hebel analysieren | Umgesetzt als Modellprüfung | KO-, Faktor- und Optionsstress mit manuell bestätigten Produktdaten, Kosten-/FX-Annahmen und Grenzen. Keine verlässliche Echtzeit-Produktbewertung oder automatische Emittentenauswahl. |
| Expertenwissen automatisch einbeziehen | Teilweise | Kostenfreie Quellenrecherche, Archiv, lesbare Auszüge und optionale Primärdaten. Keine lückenlose aktuelle Analystenkonsensdatenbank und keine unabhängige Verifikation jeder Expertenaussage. |
| KI nur manuell starten | Umgesetzt | Hintergrund prüft ohne KI. Deep-KI optional und beim neuen Einstieg zunächst ausgeschaltet. Chat ruft Gemini nur beim Senden auf. |
| Garantiert kein Gemini-Billing | Einrichtung außerhalb des Dashboards | Kein Billing wird durch den Code aktiviert. Schlüssel, Modell und Tarif-Bestätigung werden geprüft; das tatsächliche Google-Projekt und dessen Billingstatus konnten nicht ausgelesen werden. |
| Telegram mit „TRIGGER KI“ | Code vorhanden, Live-Zustellung unbestätigt | Bestehender Newsbot-/Triggerweg erhalten. Einrichtung, Chat-ID, Berechtigungen und tatsächliche Zustellung sind produktiv zu prüfen. Keine Telegram-Nachricht im Test versendet. |
| Chat innerhalb des Wertpapiers, später fortsetzen | Umgesetzt als optionaler Gemini-Chat | Gespeicherter Verlauf, Notizen, gewählter Bericht und begrenzter jüngerer Gesprächskontext. Kein direkt synchronisierter Zugang zu diesem ChatGPT-Gespräch. |
| Separates fiktives Benchmark-Depot | Umgesetzt mit Modellgrenzen | Getrennte Modellkonten auf vorhandenen Signalen/Analysen; keine echten Orders und keine automatisch neu ausgelöste KI. Kein vollständig autonomer lernender Vermögensverwalter. |
| Bestehende Kernfunktionen erhalten | Geprüft | app.js, news.js, decision.js, analytics.js, event-analysis.js, supabase.js und Startdaten gegenüber V39.3 unverändert. Historische SQL-Dateien erhalten. |
| Versionsstand auf Anmeldung und im Dashboard | In V39.4 weiter vereinheitlicht | Release-Prüfung umfasst jetzt auch Basisbericht, Function-Metadaten und Diagnose. Versionsabweichung Website/Server wird sichtbar. |
| Sauberes vollständiges Installationspaket | Umgesetzt | Alle bisherigen Dateien plus Änderungen; neue gemeinsame Action deployt Basis- und Deep-Function. SQL und Website müssen gemäß Anleitung separat veröffentlicht werden. |
| Produktiver End-to-End-Test deiner Installation | Offen | Keine Live-URL und kein Zugriff auf die angemeldete produktive Sitzung vorhanden. Lokal bestandene Prüfungen ersetzen diesen Abgleich nicht. |

## Konkret korrigierte Lücken

1. Der Depotverlauf hing allein von gespeicherten Depotmessungen ab. Vorhandene historische Kurse erzeugten keine entsprechende Grafik. V39.4 ergänzt eine ausdrücklich gekennzeichnete Rückrechnung und einen Kursvergleich.
2. Eine fehlgeschlagene Depotantwort konnte eine ältere gültige Übersicht verdrängen. Jetzt bleibt deren ursprünglicher Stand sichtbar, inklusive Fehlerkennzeichnung.
3. Eine fehlende Depotantwort konnte wie ein leeres Depot aussehen. Jetzt wird der Abrufzustand klar von einem tatsächlich leeren Depot getrennt.
4. Deep-/Hebelwerkzeuge waren durch die neue Navigation praktisch versteckt. Sie sind wieder direkt erreichbar und verwenden bei Bedarf eigene gespeicherte OHLCV.
5. Der letzte Deep-Zeitpunkt fehlte in der Wertpapierliste. Er wird jetzt zusätzlich zum Basisbericht angezeigt.
6. Die vorherige Statusprüfung prüfte die Gemini-Modellfreigabe nicht vollständig. Schlüssel und Bestätigungsflag allein reichen jetzt nicht mehr für „konfiguriert“.
7. Fehlende Darstellungsdateien konnten ohne sichtbare Hilfestellung bleiben. Ein Initialisierungswächter zeigt einen verständlichen Fehler.
8. Private Deep-Eingaben werden beim Sitzungswechsel mit zurückgesetzt.

## Was nach Veröffentlichung noch abzunehmen ist

Website-/Serverversion unter **Status & Datenprüfung**, Verlaufsspeicher und tatsächliche Historienmenge prüfen. Danach Depot, Beobachtung, einen aktuellen und einen veralteten Wert, Deep mit gespeicherten Kursen, eigene URLs, Gespräch sowie Benchmark öffnen. Kursanbieter, Gemini, Telegram und Cron erst in ihrer tatsächlichen eigenen Konfiguration bestätigen. Ohne diese Live-Abnahme wäre die Aussage „alles vollständig produktiv funktionsfähig“ nicht belegt.
