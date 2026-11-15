# Prüfprotokoll V39.0.0

Stand: 15.11.2026. Referenz: das zuvor gelieferte V38.0.0-Gesamtpaket, SHA-256 `d98e38f24a71347c2c4367039ee2445944e764ac0cbb0f6bda8ec44914e6e9ff`.

## Ergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| Automatisierte JavaScript-Tests | 445 bestanden, keine fehlgeschlagen oder übersprungen |
| Umfang | 421 bestehende Tests und 24 zusätzliche V39-Tests |
| Tatsächliche SQL-Prüfungen in PostgreSQL/PGlite | 84 bestanden: 72 V38 und 12 V39 |
| Version und generierte Gesamtmigration | geprüft |

Ausführen: `npm test`. Für die Datenbankprüfungen zuerst `npm ci --ignore-scripts --no-audit --no-fund`, danach `npm run check:sql`. Abhängigkeiten sind nur für die Prüfung nötig; das statische Frontend benötigt kein Node auf dem Hosting.

Die bestehenden Tests bleiben erhalten. Drei bestehende Erwartungen wurden dem neuen Stand entsprechend angepasst: Berichts-Version 39, Nicht-Depotwerte in der Beobachtung sowie der ausdrücklich ergänzte kostenlose RSS-Aufruf während einer Hintergrundprüfung. Der Authentifizierungs-, Eigentümer-, Quellen-, Berechnungs- und Chatumfang bleibt weiter abgedeckt.

## Neue Abdeckung

- Tatsächlicher UI-Controller mit tatsächlichem Function-Handler hinter kontrollierten Datenbank-/HTTP-Adaptern: Depot/Beobachtung trennen, eigene Werte suchen, Wertpapierseite öffnen, ursprünglichen Bericht/Chat erhalten, zurück zur vorherigen Liste, Analysearchiv und Datenschutz beim Kontowechsel.
- Merken ohne Kurs-/KI-Aufruf; Entfernen ohne Löschen von Berichten/Gesprächen; weiterhin gehaltene Werte werden dadurch nicht aus dem Depot entfernt oder in dessen Überwachung abgeschaltet. Fremde Nutzer-IDs geben keine Bearbeitungsrechte.
- Ein zwischenzeitig veralteter Auth-Token darf die aggregierte Bewertung eines vorherigen Kontos nicht in ein neues Konto übernehmen. Erfolgreiche private Function-Antworten sind deshalb ausdrücklich dem authentifizierten Besitzer zugeordnet.
- Regeln für direkte aktuelle News-Auszüge: negative Ereignistrigger stellen Einstiege zurück, positive Hinweise erzeugen keinen Kauf ohne Chartgrundlage; Gerüchte, negierte Warnungen, Metadaten, veraltete/fremde Meldungen und widersprechende Befunde bleiben unterscheidbar.
- Newsfehler und alte Chartdaten erzeugen keine vermeintlich vollständige aktuelle Analyse. Persönliche Risiko-/Teilgewinntrigger werden nicht durch positive Nachrichten überschrieben.
- Wiederholte unveränderte Newsprüfungen schreiben keinen neuen unveränderlichen Bericht allein wegen einer neuen Prüfuhrzeit.
- Gezielte RSS-Recherche: feste öffentliche Zieladresse, Suchtreffer bleiben Metadaten, Cache und Fehlerpause, keine Rückdatierung eines erfolgreichen Abrufs, maximal zwei neue Suchen pro Hintergrundlauf und Verarbeitung zurückgestellter Werte im nächsten Lauf.
- Echte Bewertungen anhand tatsächlicher Long-Aktien-/ETF-Bestände: Währungen getrennt, fehlende/alte Kurse gekennzeichnet, KO-/Short-/ungeklärte Bestände ausgeschlossen. Kein synthetischer Depotverlauf; gleiche Bewertungsgrundlage erzeugt keinen neuen historischen Punkt.
- Planänderungen behalten die ursprüngliche Analysezeit und werden bis zur erneuten Prüfung als offen markiert. Veraltete Kurse behalten ihren letzten gültigen Preis und erhalten keine aktuellen Einstiegsschwellen.

## Datenbank und bestehende Funktionen

Beide SQL-Prüfprogramme führen die tatsächlichen Migrationen und Schreibfunktionen in einer lokalen PostgreSQL-Laufzeit aus. V39 prüft zusätzlich die wiederholbare Migration, erhaltenes Entfernen aus Beobachtung, RLS der Bewertungshistorie, serverseitige Schreibrechte, geschützten Newszwischenspeicher und die weiter funktionsfähigen V38-Lease-/Commit-Funktionen nach der Tabellenerweiterung.

Für den V38-Zeitplan werden `cron`, `net` und `vault` durch kontrollierte Schnittstellen nachgebildet. Der erzeugte SQL-Jobaufruf wird dagegen ausgeführt. Das ist kein Test der echten Supabase-Erweiterungen und sendet keine HTTP-Anfrage.

Die vorherigen Kernmodule `app.js`, `news.js`, `decision.js`, `analytics.js`, `event-analysis.js` und `supabase.js` sowie die ursprünglichen Analyse-/News-/Telegram-Functions bleiben bytegleich zur Referenz. Verändert werden die V38-Wertpapierfunktion, die zugehörige Darstellung, die neue Navigation und die gemeinsame Eingabesperre für den neuen Merken-Button. Der vollständige Änderungsvergleich und die endgültigen Dateiprüfsummen stehen in `RELEASE-MANIFEST-V39.json`.

## Prüflücken und Betriebsgrenzen

Kein Live-Deployment, keine echten Anbieterabfragen, keine Änderung von Billing-Einstellungen und kein Browser-/iPhone-Live-Test. Die Oberfläche wurde über ihre tatsächliche Controller-Logik und DOM-/HTTP-Adapter geprüft; das ersetzt keine gerenderte Abnahme auf dem Endgerät. Die neue Newslogik ist eine konservative Ereignisregel, keine vollständige semantische KI-/Faktenprüfung.

Die V39-Action führt die Paketprüfungen aus und deployt ausschließlich `review-investments`. SQL, statisches Hosting, eigener Zeitplan, kostenlose Anbieterfreigaben und Live-Funktionsprüfung folgen `INSTALLATION-V39.md`. V38-Cron-Erweiterungen müssen nur dann zusätzlich eingerichtet werden, wenn sie noch nicht vorhanden sind.
