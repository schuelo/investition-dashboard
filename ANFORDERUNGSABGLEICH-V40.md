# Anforderungsabgleich V40.0.0

Stand 21.11.2026; Basis V39.5.0. Vollständige Regressionstests umfassen auch die vorherigen Module.

| Anforderung | Umsetzung | Verifikation / Grenze |
| --- | --- | --- |
| Ursache alter Kurse erkennen | Gespeicherte/CSV-Quelle, fehlende Bestätigung, Schlüssel, Pause und fehlgeschlagener Abruf getrennt. Kursdatum unabhängig von Ansicht und Analyse. | Tests alter Tageskerzen in kürzlich geladenem Cache; Statusfälle und Browserprüfung. |
| Regelmäßige Aktualisierung | Bestehender Monitor mit 30-Minuten-Zeitplan, eigenem nachgewiesenen Lauf, je Wert wählbarem Intervall und begrenzten Anbieteraufrufen. | Tatsächliche SQL/API-Tests mit simuliertem Cron/HTTP. Produktiver Zeitplan und Schlüssel müssen im Zielprojekt aktiviert/geprüft werden. |
| Nicht ein einzelner Fehler blockiert alle Werte | Auswahl nach tatsächlichem Netzwerkversuch; fehlgeschlagene und zurückgestellte Prüfungen erhalten einen nächsten Prüftermin. | Mehrere aufeinanderfolgende Monitorläufe mit unterschiedlichen Werten getestet. |
| Mengen und Einstand leicht ändern | Direkte Knöpfe in Liste und Wertpapier, reduzierte Bearbeitungsmaske mit vorausgefüllten Werten. | Controller → echte PostgreSQL-Schreibfunktion → erneut geladene Übersicht; auch Bruchstücke. |
| Neue Positionen und zusätzliche Käufe | Globales Hinzufügen, WKN/ISIN oder gespeicherte Identität; am Wert zusätzlicher getrennter Posten. | Neue Posten, gewichteter Einstand, unerwartet bereits vorhandene Bestände und Wiederholungen getestet. |
| Depotposition entfernen / ausbuchen | Direkter Ausbuchen-Knopf und explizite Bestätigung; Auswahl des Postens bei mehreren Käufen. | Nur gewählter Posten geschlossen, übrige erhalten; Originaldatensatz bleibt bestehen. |
| Ganzen Wert entfernen | Atomare Archivierung aller eigenen gebundenen Posten, Beobachtung und Monitoring aus. | Wiederholungssicherheit, gleichzeitig laufende Prüfung, fremde Benutzer und alte unmigrierte Bestände getestet. |
| Aus Beobachtung entfernen | Direkter Knopf; Depotpositionen bleiben erhalten. | Automatisiert und im Browser mit Testdaten geprüft. |
| Nachvollziehbare Historie | Echte Bestandsereignisse mit Vorher/Nachher, Datum und erhaltenen Berichten/Gesprächen im Archiv. | PostgreSQL-Trigger, RLS, Leserechte und keine doppelten Ereignisse pro atomarem Speichervorgang. Keine erfundene Vorgeschichte. |
| Trade-Republic-orientierte Bedienung | Depot zuerst; drei Hauptbereiche; eigener Wertpapierbildschirm; drei klare Unterbereiche; große Werte, schwarzer Hintergrund, flache Listen und direkte Aktionen. | Desktop und schmale Browseransichten mit Testdaten; keine Übernahme einer fremden Marke oder eines Brokerage-Logins. |
| Charts konsistent | Einheitliche eigene Kursgrafiken; gleiche Zeiträume und transparente Datenbasis; fehlende/kurze Historie sichtbar. | Regressionstests für Zeiträume, Einzelpunkte, Währungen, Datenquellen und keine erfundenen Kursverläufe. |
| Einschätzung am Wert mit Datum | Gespeicherte Analyse bleibt direkt am Wert; Preis, Bericht und Prüfversuch getrennt. | Kursrefresh erstellt keinen neuen Bericht. Bestands-/Planänderungen sperren frühere aktuelle Schwellen. |
| Charttechniken, Szenarien, Deep, Quellen und Chat behalten | Bestehende Verfahren bleiben im Analysebereich erreichbar; Gemini startet weiterhin nur auf ausdrückliche Anforderung. | Bisherige Funktionstests eingeschlossen; keine produktive Gemini-/Abrechnungsprüfung. |
| Bestehende Funktionen erhalten | Historische Dateien und SQL-Migrationen enthalten; zentrale alte Module bytegleich zur Basis. | Dateivergleich und Paketprüfung. Die neue primäre Navigation ersetzt die alten Alltagsansichten. |
| Einfaches vollständiges Update | Ein V40-Workflow prüft und aktualisiert Datenbank, Functions, Zeitplan und optional GitHub Pages. | Deployment- und statische Pakettests; keine produktive Veröffentlichung im Rahmen der lokalen Abnahme. |

Die Anwendung bildet ein manuell gepflegtes Depot und mögliche Handlungsoptionen ab. Bestandsbuchungen sind keine echten Orders. Eine vollständige Brokerabrechnung mit Cash, Steuern, Verkäufen und Dividenden ist nicht neu implementiert. Tageskurse und öffentliche Nachrichten ersetzen keinen Echtzeitdatenvertrag.
