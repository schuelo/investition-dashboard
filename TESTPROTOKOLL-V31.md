# Testprotokoll V31.2 – TRIGGER KI und manueller Start

Geprüfter Stand: originales V29.4 + V30.1.1 Deployment-Fix + separates V31.2-Signalmodul mit manueller Gemini-Analyse und ergänztem Telegram-Text. Prüfung am 11.10.2026.

## Ergebnis

- 124 Tests, 124 erfolgreich, 0 fehlgeschlagen; einschließlich aller 40 bisherigen V29.4-/V30.1-Tests.
- Node 24.19.0; Aufruf: `node --test tests/*.test.mjs`.
- 21 JavaScript-/TypeScript-Dateien zusätzlich mit `node --check` auf Syntax geprüft.
- 172 eindeutige HTML-IDs, sechs getrennte Navigationsseiten, acht referenzierte lokale Frontendassets geprüft.
- 14 bestehende Kern-Dateien per SHA-256 unverändert gegenüber dem originalen V30.1.1-Paket. Die zulässige Telegram-Ergänzung ist separat gegen den Originalhandler geprüft.
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
| Gemini-Protokoll | Tatsächlichen Adapter mit HTTP-Fixtures geprüft: festes HTTPS-Ziel, Secret nur im Header, getrennte Systemanweisungen, JSON-Schema, ausschließlich abgeschlossene Antworten, kein Gedankentext im Bericht. |
| Gemini-Auswahl | Anbieter ausschließlich aus serverseitigen Secrets, Gemini bevorzugt bei beiden Schlüsseln, explizite Wahl und Abschaltung, Kompatibilität bestehender OpenAI-Konfiguration. |
| Kostenloser Rückfall | HTTP 429 führt nach genau einem Aufruf zu Chartmodus und Newsimpuls 0; vorhandener OpenAI-Schlüssel wird nicht benutzt. Fehlender Gemini-Schlüssel, Netzwerkfehler und ungültige Modelle lösen keinen Wechsel zum zweiten Anbieter aus. |
| Edge Function | Tatsächlichen TypeScript-Handler mit isolierten IO-Abhängigkeiten ausgeführt: Anmeldung, ungültige Sitzung, Preflight, falsche Methode, JSON-Fehler und Speicherung nur unter serverseitig verifizierter Nutzer-ID. |
| Oberfläche | Tatsächliches UI-Modul in minimaler DOM-Testumgebung: Demo, SVG, Methoden, Szenarien, Kursmarken, Auswahl bestehender Aktie und Löschen bei Sitzungswechsel. |
| KI-Anzeige | Gemini-Anbieter und Modell im tatsächlichen UI-Modul, kompatible Darstellung älterer Ergebnisse, sichtbare Kontingentwarnung ohne Behauptung aktiver KI. |
| Manueller Start | Tatsächliche Oberfläche: Telegram-Link, Login, Navigation, Feedupdate, Triggerladen und Vorbereitung verursachen 0 KI-Function-Aufrufe; ausdrückliches Absenden genau 1. Doppeltes Absenden während laufender Analyse verursacht keinen zweiten Aufruf. |
| Startkennzeichnung | Tatsächlicher Edge-Handler und Service weisen fehlende `manual_start=true` vor Budgetreservierung und Anbieterzugriff zurück. |
| Originalmeldung | Ausgewählte Meldung erreicht Quellen, KI und Historie; priorisiert und als manuell ausgewählt gekennzeichnet. Veraltete Meldungen bleiben ausgeschlossen. Fehler/Chartmodus bestätigen den Trigger nicht als KI-analysiert. |
| Trigger-Eigentümer | Tatsächlicher Edge-Handler blockiert fremde Trigger sowie unveröffentlichte oder widersprüchliche Originalmeldungen vor Reservierung. Speicherung und Abschluss filtern nach der verifizierten Nutzer-ID. |
| Telegram-Regression | Original- und aktualisierten TypeScript-News-Bot mit denselben isolierten DB-/HTTP-Fixtures ausgeführt: gleiche Empfänger, 6 gleiche Meldungen, gleiche bestehende Logeinträge und identischer vorheriger Text einschließlich 3900-Zeichen-Grenze. Nur TRIGGER-KI-Anhang und URL-Button kommen hinzu. |
| Telegram-Deduplizierung | Zweiter Versanddurchlauf: 0 weitere Nachrichten und 0 weitere Trigger-RPCs. Nutzergebundene Auslösung weiterhin nur für diesen Nutzer. Filter für Impact, Alter, Veröffentlichung, Scoregrenzen und offene Positionen geprüft. |
| Telegram-Isolation | Neue Trigger-/Zustellstatusfehler verhindern keine ursprünglichen Alerts. Der tatsächliche Bot ruft in den Tests ausschließlich Telegram auf, keinen KI-Anbieter. |
| KO-Handhabung | Produktwährung wird nicht als Basiswertwährung übernommen; explizite Bestätigung erforderlich. |
| Navigation | Tatsächliche showPage-Funktion ausgeführt; Signal-Seite sichtbar, alle bisherigen Seiten verborgen; Rückkehr zur Eventanalyse geprüft. |
| Isolation | Bestehende News-Sync-, Digest- und Eventanalyse-Functions, Shared-Quellen, V29.4-/V30-SQLs, Eventanalyse, Decision- und Analytics-Komponenten sowie bisheriger Deployworkflow byteweise identisch. News-Bot ausschließlich um die zugelassene Meldungsergänzung und eigene Modulmetadaten erweitert. |
| Neues Schema | Eigene Tabellen, RLS-Nutzerfilter, eingeschränkte Cache-/Budgetzugriffe; Trigger-RPC nur für Service-Rolle. Authentifizierte Nutzer lesen eigene Trigger und können nur deren Status auf zurückgestellt setzen. Keine neuen Cronjobs. |

## Grenzen der Prüfung

Keine Liveanbieter, produktiven Secrets, Telegram-Nachrichten, SQL-Migrationen oder Deployments ausgeführt. Die Supabase-RLS- und Budget-SQLs wurden statisch geprüft; tatsächliche Ausführung und Anbieterberechtigungen müssen bei der Inbetriebnahme verifiziert werden. Browserdarstellung und echte Telegram-Weiterleitung wurden nicht in einem interaktiven Browser geprüft. Die DOM-Tests ersetzen keinen Browser-/Mobilgerätecheck.

Die Gemini-API wurde mit isolierten Antwort-Fixtures und anhand der offiziellen Dokumentation geprüft, nicht mit einem echten Google-Schlüssel. Modellzugang, Free-Tier-Kontingent und tatsächliche JSON-Ausgabe im Nutzerprojekt müssen nach der Installation geprüft werden. Der Code erkennt nicht, ob ein API-Schlüssel zu einem kostenpflichtigen Google-Projekt gehört; die kostenlose Nutzung setzt ein Free-Tier-Projekt ohne Billing voraus.

Die Simulation wurde auf technische Korrektheit geprüft, nicht auf finanzielle Prognosegüte. Es gibt keine Kalibrierung oder nachgewiesene Erfolgsquote. Synthetische Kursfixtures sind ausdrücklich keine echten Marktpreise.

Installation und Live-Abnahme: `INSTALLATION-V31.md`.
