# Prüfprotokoll V36.0.0 — 08.11.2026

328 Tests bestanden, 0 fehlgeschlagen, 0 übersprungen. Ausgangspunkt ist das zuletzt gespeicherte vollständige V35.0.0-Paket, vor Übernahme anhand der SHA-256-Prüfsumme `f80e6dbb511717ea90d074a32b518c1e7a083ea14ac06b49c9d05bc91ffa2484` verifiziert. Die 273 vorhandenen Tests bleiben erhalten; eine Capability-Erwartung ist um das neue Servermerkmal ergänzt. 55 neue Tests prüfen die unabhängigen Datenwege und Formulare.

## Prüfumfang

- WKN-/ISIN-Mapping unmittelbar anhand von OpenFIGI und MIC ohne EODHD-Suche, EODHD-Token oder Zugriff auf den bisherigen Budget-RPC. Eine US-MIC-Suche verwendet einen Batch und verwirft gültige Treffer nicht wegen fehlender Treffer an anderen Börsen.
- Keine erfundene ISIN oder Währung aus einer WKN-Antwort. Fehlende Kursmetadaten lassen die Identität bestehen, verlangen aber eine ausdrückliche Währungseingabe für die Formularübernahme. Derivate, ungültige Kennungen und nicht passende Handelsplätze werden nicht in vermeintlich passende Aktien umgedeutet.
- Getrennte Owner-Caches, eigene Budgetfunktionen und Wiederverwendung frischer Daten. Fremde, abgelaufene oder zum Symbol unpassende gespeicherte Zuordnungen stoppen vor einem Kursabruf.
- Öffentliche Chartantworten: Kennung, Instrumenttyp, Zeitzone, Währung, OHLCV-Vektorlängen und Kursgültigkeit geprüft. Unvollständige/heutige Tageskerzen ausgeschlossen; fehlende Adjusted-Close-Reihen nicht teilweise vermischt. GBP/GBX bleiben getrennt.
- Fester öffentlicher Host, Redirect-Abbruch, begrenzte Antwortgröße, Zeitlimit, HTTP-429-/HTML-/Fehlerantworten. Kein Retry, Cookie-/Crumb-Abruf, Alternativhost, kostenpflichtiger Download oder EODHD-Fallback.
- Signal- und Deep-Dienste laufen mit unabhängigen Daten, während sämtliche Legacy-EODHD-Adapter als Fehlerfallen eingerichtet sind. CSV benötigt keinen externen Kursadapter; dies gilt auch für die spätere Auswertung neuer und älterer CSV-Berichte.
- Tatsächliche TypeScript-Edge-Einstiegspunkte werden mit Node von Typangaben bereinigt und mit kontrollierten Supabase-/HTTP-Adaptern ausgeführt. Authentifizierung vor Zugriff, Owner-ID statt eingeschleuster Nutzer-ID, keine Legacy-Kurscache-Lese-/Schreibvorgänge bei unabhängigen Analysen, getrennte Quoten und Herkunft im Ergebnis.
- Capability-Abfragen der drei aktualisierten Einstiegspunkte benötigen eine Anmeldung, verbrauchen aber keine Daten-/Analysequote und starten weder Recherche noch KI. Fehlendes V36-Schema wird als Installationsfehler gemeldet.
- Tatsächliche Frontend-Skripte unter einem DOM-Adapter: Quellenwahl, ausdrückliche Kennungsbestätigung, Schutz gegen alten Serverstand/fehlendes Quellenmodul, Doppelklicksperre und Sitzungswechsel. Nach programmatischem Symbolwechsel gilt eine alte Bestätigung nicht weiter.
- WKN-Formular prüft Serverunterstützung vor einer unabhängigen Suche und gibt die eigene Zuordnung getrennt von der öffentlichen Kurskennung weiter. CSV-Modus unterdrückt Kursmetadatenabrufe und verlangt bei Bedarf die manuell bestätigte Währung.
- Trade-Übernahme einer unabhängigen Zuordnung benötigt eine ausdrückliche Bestätigung zum Leeren der ungespeicherten EODHD-Alarmfelder. Kein Speichern eines Trade-Plans durch Suche oder Übernahme.
- Frühere Regressionsprüfungen für Chartmethoden, sechs Deep-Szenarien, KO-/Hebelstress, Quellen/URLs, Historie, Papierdepot, Telegram sowie unveränderte Kernmodule bestehen weiterhin.
- Release-Generator, eingebettete Panels, eindeutige HTML-IDs, Anmeldungs-/Reset-Version und Cache-Referenzen sowie additive Gesamt-SQL und V36-Workflow geprüft.

## Befehle

```sh
node scripts/set-version.mjs --check
node scripts/build-update-sql.mjs --check
node --test tests/*.test.mjs
```

Die neue SQL wird als additive, servicegeschützte Migration geprüft. Es erfolgte keine Ausführung gegen eine echte PostgreSQL-/Supabase-Datenbank. Die geprüften Handler-Tests sind keine vollständige Deno- oder Supabase-Laufzeitprüfung.

Zusätzlich bestanden Syntaxprüfungen für 56 JavaScript-/MJS-Dateien, das Parsen von 12 TypeScript-Dateien nach Entfernung der Typangaben und das Einlesen aller sieben GitHub-Workflow-YAML-Dateien. Die TypeScript-Prüfung ist kein vollständiger Typcheck mit Deno/Supabase.

## Grenzen

Kein Live-Aufruf der öffentlichen Chartquelle oder einer konkreten WKN aus dem Nutzerprojekt, kein Live-Browsertest, kein GitHub-/Supabase-Deployment und keine SQL-Ausführung im Zielsystem. Verfügbarkeit und Anbieterabdeckung sind daher nach Installation zu prüfen. Die öffentliche Chart-Schnittstelle ist inoffiziell und kann jederzeit ausfallen oder begrenzt werden; CSV ist der vorgesehene unabhängige Ersatz.

Bestehende News-/Telegram-/Portfolio-Kernskripte und Zeitpläne bleiben unverändert. Der neue Modus betrifft die Eingabe und Kursversorgung der Signal-/Deep-Analyse; er ersetzt nicht automatisch Datenquellen von Hintergrundalarmen oder laufenden Papierexperimenten. Es wurde keine Abrechnungseinstellung geprüft oder verändert.
