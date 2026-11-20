# V39.4.0 — Dashboardprüfung, nachvollziehbare Depotgrafik und direkter Deep-Zugang

Aktuelle Anleitung: [INSTALLATION-V39.4.md](INSTALLATION-V39.4.md). Vollständiger Abgleich der bisherigen Anforderungen: [ANFORDERUNGSABGLEICH-V39.4.md](ANFORDERUNGSABGLEICH-V39.4.md).

Die Depotgrafik wählt zwischen gespeicherten Messungen, ausdrücklich gekennzeichneter Rückrechnung des heutigen offenen Bestands aus echten Kursen und Kursvergleich mit Index 100. Fehlende Kaufdaten, Kurse und Verlaufsspeicher bleiben erkennbar. Eine gescheiterte Depotantwort löscht nicht die letzte gültige Übersicht. Die Übersicht zeigt ihre Datenmenge und hat eine kopierbare technische Statusprüfung ohne private Bestandsdetails.

Deep, Szenarien und Hebel sind wieder direkt am Wertpapier erreichbar. Echte eigene OHLCV können ohne neuen Anbieterabruf vorbereitet werden. Der letzte Deep-Zeitpunkt erscheint zusätzlich in der Liste. Der Start bleibt manuell; Gemini ist zunächst ausgeschaltet.

**Update:** Alle Dateien einschließlich Unterordnern übernehmen; **Actions → V39.4 Dashboard prüfen und deployen** starten; anschließend die **statische Website veröffentlichen**. Diese Action deployt Basis- und Deep-Function, nicht SQL oder Website. Anmeldung und Server müssen **39.4.0** zeigen. Bei vollständig aktivem V39.2/V39.3 kein neues SQL für die Depotgrafik nötig. Ältere Versionen und fehlende Deep-Tabellen siehe Anleitung.

Prüfung: **537 automatisierte Tests und 169 SQL-Prüfungen bestanden**. Zusätzlich drei vom tatsächlichen Controller erzeugte Diagrammtypen bei 375/1000 Pixeln gerendert. [TESTPROTOKOLL-V39.4.md](TESTPROTOKOLL-V39.4.md) trennt diese Prüfung von der noch offenen produktiven Website-/iPhone-Abnahme. Die Rückrechnung ist keine vollständige historische Depotperformance mit Cash und Verkäufen.

---

## Historischer Stand V39.3.0 — sichtbare Verläufe in Depot, Beobachtung und Wertpapier

Aktuelle Anleitung: [INSTALLATION-V39.3.md](INSTALLATION-V39.3.md). Die Depotgrafik zeigt echte gespeicherte Bewertungen mit Euro-/Währungswerten, sichtbaren Einzelpunkten und Linien auch bei unverändertem Wert. Depot, Beobachtung und gespeicherte Suche erhalten Kurs-Minicharts; Beobachtung zusätzlich einen Vergleich mit gemeinsamem Startwert 100. Jede Wertpapierseite hat eine eigene historische Kursgrafik mit Zeitraumwahl und Datenstand, unabhängig von der Freigabe eines Prognosemodells.

Gespeicherte Kurse und echte Historien bisheriger Analysen werden ohne neuen Anbieter- oder KI-Aufruf gelesen. **Kursverlauf aktualisieren** fordert nur Kursdaten aus der bewusst gewählten Quelle an. Wo eine gespeicherte Historie fehlt, kann ein separater TradingView-Chart erscheinen. Dafür wird ausschließlich die öffentliche Wertpapierkennung übergeben; Widgetwerte werden nicht in die eigene Depotbewertung oder Analyse übernommen. Unklare US-Sammelcodes werden keiner Börse zugeordnet.

**Bei vollständig aktivem V39.2 ist kein neues SQL nötig:** sämtliche Dateien einschließlich Unterordnern übernehmen, **Actions → V39.3 Kursgrafiken deployen → Run workflow**, anschließend die statische Website veröffentlichen. Anmeldung: **39.3.0**. Bei älteren V36–V39.1-Installationen zuerst **setup-v39-3-depotupdate.sql** ausführen. Die neue Action veröffentlicht nur die Function, nicht SQL oder Website.

Prüfung: **512 automatisierte Tests und 169 SQL-Prüfungen bestanden**, einschließlich realer PostgreSQL-/UI-Datenwege für die Grafiken. Details: [TESTPROTOKOLL-V39.3.md](TESTPROTOKOLL-V39.3.md). Kein Live-Deployment und keine gerenderte iPhone-Abnahme durchgeführt.

---

## Historischer Stand V39.2.0 — Depot direkt mit Stückzahl und Einstand verwalten

Aktuelle Anleitung: [INSTALLATION-V39.2.md](INSTALLATION-V39.2.md). **Depot → Position hinzufügen → Wertpapier, Stückzahl, durchschnittlichen Einstand eingeben → Im Depot speichern.** Eine Analyse oder ein funktionierender Kursanbieter ist dafür nicht erforderlich. Vorhandene Positionen werden direkt in der Liste bearbeitet. Zusätzliche Kaufpositionen werden getrennt erfasst und in der Übersicht zu einem gewichteten Einstand zusammengefasst.

Die Depotansicht zeigt Bestand, investierten Betrag und Ergebnis zum Einstand. Auch ohne Kursdaten bleibt das eingesetzte Kapital sichtbar. Ein eigener Bewertungskurs mit Datum ist optional; er wird als manuell erfasst gekennzeichnet und getrennt von den Chartdaten gespeichert. Währungen bleiben getrennt. Der Verlauf zeigt tatsächlich aufgezeichnete Depotbewertungen und keine nachträglich erfundene oder um Ein-/Auszahlungen bereinigte Rendite.

Die Bedienung verwendet einen gemeinsamen Bestandseditor für Hinzufügen, Bearbeiten, Übernehmen aus Beobachtung und Schließen. Speichern kehrt sofort ins Depot zurück und setzt einen alten Filter zurück. WKN/ISIN-Suche steht auch in diesem Editor zur Verfügung. Website-/Serverversion und fehlende Datenbankerweiterungen werden sichtbar geprüft; fehlendes Alpha blockiert die Bestandsverwaltung nicht.

**Update von V36 bis V39.1:** Die gemeinsame Datei **`setup-v39-2-depotupdate.sql`** im Supabase SQL Editor ausführen, **V39.2 Depotverwaltung deployen** in GitHub Actions starten und die statische Website veröffentlichen. Alle Dateien und Unterordner des vollständigen Pakets übernehmen. Auf der Anmeldung muss **39.2.0** erscheinen. Im Depot anschließend **Depotverwaltung bereit** prüfen. Keine neuen Cronjobs oder Billingfreigaben nötig.

Prüfung: **477 automatisierte Tests und 169 SQL-Prüfungen bestanden**, einschließlich tatsächlicher UI-Controller → Function → PostgreSQL-Transaktionen für den Depotablauf. Details und Grenzen: [TESTPROTOKOLL-V39.2.md](TESTPROTOKOLL-V39.2.md). Noch kein Live-Deployment oder gerenderter iPhone-Test im Zielprojekt.

---

## Historischer Stand V39.1.0 — Depotabgleich mit Altbestand und einheitlicher Oberfläche

Aktuelle Anleitung: [INSTALLATION-V39.1.md](INSTALLATION-V39.1.md). Das vollständige Paket behebt den Abgleich älterer gespeicherter Werte wie **Volkswagen Vz. / VOW3.XETRA**. Gespeicherte Analysen erscheinen im Depot unter **Bereits hinterlegte Werte**; tatsächliche Bestände lassen sich direkt beim Wert mit Stückzahl und Einstand erfassen, ändern oder schließen. Eine bloße Analyse wird nicht automatisch als ausgeführter Kauf behandelt. Doppelte Speicheranfragen erzeugen keine zusätzlichen Positionen.

Die fünf bisherigen Fachansichten werden in der Bedienung durch **Depot**, **Suche**, **Beobachtung** und die **Wertpapierseite** ersetzt. Unter **Verwaltung** bleiben Nachrichten, Benchmark-Depot, Import/Export, Konto/Telegram und Sperren erreichbar. Historische Daten und bisherige Kernmodule bleiben erhalten. Ein Ausfall der optionalen Depotbewertung blendet die Wertpapierliste nicht mehr aus.

Neue Werte verwenden zunächst **Gespeicherte Kurse / News**. Alpha Vantage ist ausdrücklich optional; der fehlende Schlüssel wird vor einem neuen Alpha-Abruf erkannt. Gespeicherte Daten und OHLCV-CSV benötigen keinen neuen Anbieter-Schlüssel. Ohne ausreichende aktuelle Kurshistorie bleibt eine Chart-/Kursempfehlung offen. Es gibt keine automatische Quellenumschaltung, Billing-Aktivierung oder automatisch gestartete KI.

**Update von V39:** `setup-v39-1-depotfix.sql` im Supabase SQL Editor ausführen, **V39.1 Depotabgleich und Oberfläche deployen** starten und die statische Website veröffentlichen. Danach auf der Anmeldung **39.1.0** prüfen und **Depot abgleichen**. Weitere Installationswege und die optionale Alpha-Einrichtung stehen in der aktuellen Anleitung.

Prüfprotokoll: [TESTPROTOKOLL-V39.1.md](TESTPROTOKOLL-V39.1.md). Noch kein Live-Deployment oder iPhone-Test im Zielprojekt.

---

## Historischer Stand V39.0.0 — Depot, Suche, Beobachtung und Analyse direkt am Wertpapier

Aktuelle Anleitung: [INSTALLATION-V39.md](INSTALLATION-V39.md). Die Hauptnavigation besteht aus **Depot**, **Suche** und **Beobachtung**. Ein Wert öffnet seine eigene Seite mit Einschätzung, Kursmarken, Modellchart, Quellen, Plan, Gespräch und Historie. Die bisher getrennten Werkzeuge bleiben unter Verwaltung erreichbar. Die Anmeldung zeigt **39.0.0**.

V39 ergänzt Merken/Entfernen mit erhaltenem Analysearchiv, konservative regelbasierte News-Gegenprüfung und echte gespeicherte Depotbewertungen ab Installation. Kursdatum, letzte erfolgreiche Analyse, Newsprüfung und Abruffehler bleiben getrennt. Es gibt keine automatisch gestartete KI. Der Verlauf wird nicht rückwirkend aus heutigen Beständen erfunden, und verschiedene Währungen werden nicht summiert.

**Update:** bei aktivem V38 `setup-v39-direct.sql` ausführen; bei V36/V37 zusätzlich vorher `setup-v38-investment-review.sql`. Danach **V39 Depot Suche und Beobachtung deployen** starten und die statische Website veröffentlichen. Der vorhandene V38-Zeitplan verwendet anschließend die neue Function über denselben Endpunkt. Vollständige Installationswege und Grenzen stehen in der Anleitung.

Prüfprotokoll: [TESTPROTOKOLL-V39.md](TESTPROTOKOLL-V39.md). Noch nicht im Zielprojekt deployt oder auf einem iPhone live geprüft.

---

## Historischer Stand V38.0.0 — Depotprüfung und gemeinsame Wertpapieranalyse

Aktuelle Anleitung: [INSTALLATION-V38.md](INSTALLATION-V38.md). Das vollständige Paket basiert auf V37.0.0 und bündelt den Hauptablauf in **Mein Portfolio** und **Wertpapier prüfen**. Bisherige Werkzeuge bleiben unter **Mehr** erreichbar.

Direkt bei jedem gespeicherten Wert stehen Ticker, letzter gültiger Kurs mit Kursdatum, Handlungseinschätzung, letzte erfolgreiche Analyse und letzter Abrufversuch. Kursalter und Abruffehler sind unabhängig sichtbar und filterbar. Neue Prüfungen kombinieren die vorhandenen Chartmethoden und sechs Szenarien mit News, tatsächlichem Depotbestand und expliziten Planvorgaben. KI bleibt optional.

Zusätzlicher Kursweg: Alpha Vantage für geprüfte XETRA-/US-Notierungen, mit eigenem Schlüssel und separatem Schutzbudget; höchstens 100 Tageskerzen. CSV, ausdrücklich gewählter EODHD-Weg und die öffentliche Quelle bleiben verfügbar. Keine automatische Anbieterumschaltung. Ein Kursfehler verhindert nicht mehr den Nachrichtenbericht. Unvollständige Ergebnisse und veraltete Kurse werden sichtbar markiert.

Je Wertpapier werden Gespräch und Berichtshistorie gespeichert. Der manuelle KI-Chat verwendet Gemini mit bestehender Free-Tier-Freigabe. Notizen und ChatGPT-Export sind ohne zusätzlichen KI-Aufruf nutzbar. Ein direkt eingebundener OpenAI-Chat ist in V38 nicht enthalten.

**Update eines aktiven V36/V37:** `setup-v38-investment-review.sql` ausführen, **V38 Depotprüfung und Chat deployen** starten und die statische Website veröffentlichen. Für kontinuierliche Hintergrundprüfungen zusätzlich `setup-v38-monitoring.sql` konfigurieren. Die Anmeldung zeigt **38.0.0**. Die Anleitung beschreibt Schlüssel, Reihenfolge und einen kurzen Funktionstest.

Prüfumfang und Grenzen: [TESTPROTOKOLL-V38.md](TESTPROTOKOLL-V38.md). Noch nicht live im Zielprojekt installiert oder auf einem iPhone geprüft.

---

## Historischer Stand V37.0.0 — kompakte schwarze Oberfläche auf V36-Basis

Aktuelle Anleitung: [INSTALLATION-V37.md](INSTALLATION-V37.md). Vollständiges Paket mit schwarzem Hintergrund, mobiler Schnellnavigation, Cockpit, drei Kernaussagen, responsiven Modellcharts, Kursleiter, Deep-Szenariovergleich und aufklappbaren Originalberichten.

Die vorhandenen V36.0.0-Berechnungen, Kursquellen, manuellen KI-Starts, Kontingente und Hintergrundfunktionen bleiben erhalten. V36.1 mit Alpha Vantage ist nicht enthalten. Das Cockpit liest vorhandene eigene Berichte und TRIGGER-KI-Meldungen; es startet keine Analyse. Veraltete Daten werden anhand des heutigen Datums gekennzeichnet und aktuelle Schwellen gesperrt.

Für ein bereits vollständig aktives V36-System: Dateien einschließlich Unterordnern übernehmen und die Website wie bisher veröffentlichen. **Keine neue SQL-Ausführung und kein Function-Deployment erforderlich.** Die Anmeldung zeigt **37.0.0**; die Berechnungsversion gespeicherter Deep-Berichte bleibt V36.

Prüfumfang und Grenzen: [TESTPROTOKOLL-V37.md](TESTPROTOKOLL-V37.md). Der neue Workflow **V37 kompakte Ansicht prüfen** führt ausschließlich Prüfungen aus. Er benötigt keine neuen Secrets und veröffentlicht keine Serverfunktionen.

---

## Historischer Stand V36.0.0 — Signal- und Deep-Analyse ohne EODHD

Aktueller Einstieg: [INSTALLATION-V36.md](INSTALLATION-V36.md). Vollständiges Paket einschließlich V33-Papierdepot, V34-Quellen-URLs und V35-WKN-Maske.

Die WKN-/ISIN-Suche verwendet standardmäßig OpenFIGI direkt. Signal- und Deep-Analyse bieten öffentliche Chartdaten über eine eigene, inoffizielle Yahoo-Schnittstelle oder einen OHLCV-CSV-Import. In diesen Modi sind weder EODHD-Schlüssel noch EODHD-Tagesbudget nötig. Der bisherige EODHD-Weg bleibt ausdrücklich auswählbar. Es gibt keine automatische Anbieterumschaltung und keine neuen automatischen KI-Aufrufe.

Öffentliche Quellen können ausfallen oder eigene Limits erreichen. Dann wird ein Fehler mit CSV-Hinweis angezeigt. CSV funktioniert ohne Kursdienst; Kennung, Handelsplatz und Währung bleiben prüfbare Eingaben. Der Bericht speichert die Kursherkunft. Vor dem Start prüft das Frontend, ob die Serverfunktionen die neue Quellenwahl unterstützen.

Installation: **`setup-v36-gesamtupdate.sql`** ausführen, **V36 Analyse ohne EODHD und Gesamtupdate deployen** in GitHub Actions starten und die Website über das bisherige Hosting veröffentlichen. Bei bereits vollständig installiertem V35 genügt alternativ `setup-v36-independent.sql`. Die Anmeldung zeigt **36.0.0**. News-/Telegram- und Depot-Hintergrundfunktionen behalten ihre bisherigen Quellen und Regeln.

328 automatisierte Tests bestanden. [Prüfprotokoll](TESTPROTOKOLL-V36.md). Kein Live-Deployment oder Live-Test im Zielsystem erfolgt.

---

## Historischer Stand V35.0.0

Die folgenden Abschnitte beschreiben ältere Releases. Für das aktuelle Paket gilt die V36-Anleitung oben.

Aktueller Einstieg: [INSTALLATION-V35.md](INSTALLATION-V35.md). Vollständiger Stand einschließlich V33-Papierdepot und V34-Analyse eigener Quellen-URLs. Das neue Gesamtpaket kann den zuvor gelieferten Stand komplett ersetzen; bestehende eigene Anpassungen vorher vergleichen.

Eine gemeinsame WKN-/ISIN-Eingabemaske steht in Trade-Plänen, Signal- und Deep-Analyse, Historienfilter, neuem Papierexperiment, Papierdepot-CSV-Zuordnung und Eventanalyse bereit. Sie liefert geprüfte Notierungen mit Namen, EODHD-Ticker, Handelsplatz, Währung und ISIN. Die Übernahme füllt die Felder im gewählten Formular. Analyse, Speichern und fiktive Handelsläufe bleiben separate bewusste Aktionen.

WKN-Identitäten kommen aus OpenFIGI. EODHD-Suchtreffer werden anhand ihrer ISIN gegen diese Identität geprüft; ähnliche Firmennamen oder gleiche Ticker reichen nicht als Nachweis. Die Auswahl zeigt gefundene Notierungen, kein vollständiges Verzeichnis aller Börsen. Der bevorzugte Handelsplatz wird zuerst angezeigt. Wo der Chart-Handelsplatz eindeutig zugeordnet werden kann, wird auch die TradingView-Kennung übernommen; US-Sammelcodes erfordern gegebenenfalls eine zusätzliche Börsenwahl.

Die Suche nutzt keinen Gemini-Aufruf. EODHD-Abfragen zählen zum vorhandenen gemeinsamen Tagesbudget; gleiche Zuordnungen werden je Benutzer und Handelsplatzpräferenz sieben Tage wiederverwendet. Eigene Kurse, Kaufentscheidungen, KO-Barrieren und Produktbedingungen werden nicht recherchiert oder erfunden.

Installation: `setup-v35-gesamtupdate.sql` ausführen, **V35 WKN und Gesamtupdate deployen** starten und die Website über das bestehende Hosting veröffentlichen. Bei bereits aktivem V34 genügt für die neue Datenbankstruktur alternativ `setup-v35-wkn.sql`. Nicht beide SQL-Dateien nacheinander nötig.

Die Anmeldung, Dashboard- und Reset-Seite zeigen **35.0.0**, zentral aus `release.json` synchronisiert. 273 automatisierte Tests bestanden. [Prüfprotokoll](TESTPROTOKOLL-V35.md). Noch kein Live-Deployment im Zielprojekt erfolgt.

---

## Historischer Stand V34.0.0

Die nachfolgenden Abschnitte dokumentieren ältere Releases. Für das aktuelle Paket gilt die V35-Anleitung oben.

Aktueller Einstieg: [INSTALLATION-V34.md](INSTALLATION-V34.md). Dieses vollständige Paket enthält den bisherigen Dashboard-Stand, die neue URL-Erweiterung der Deep-Analyse und das bislang noch nicht installierte V33-Papierdepot. V33 muss nicht separat heruntergeladen oder vorher installiert werden.

Wertpapier mit Handelsplatz und Unternehmensnamen vorgeben, automatische öffentliche Recherche nutzen und optional bis zu zehn eigene HTTPS-Links ergänzen. Beim manuellen Start werden erreichbare HTML-/Textauszüge in dieselbe KI-Analyse einbezogen. Der Bericht zeigt Abrufstatus, Bereitstellung an die KI und tatsächliche Quellenbelege je Link. Fehlende Seiten, PDF, Anmelde- und Bot-Sperren werden sichtbar ausgewiesen.

Gemini bleibt manuell. Bestehende Free-Tier-Konfiguration, Kontingente und Regel-Fallback bleiben bestehen. Telegram, reale Depotfunktionen und vorhandene Zeitpläne behalten ihren bisherigen Umfang. V33 enthält drei fiktive Vergleichskonten und wird separat per Button aktualisiert.

Die Anmeldeseite und das Dashboard zeigen **34.0.0**. `release.json` ist die zentrale Versionsquelle. Nach einer Versionsänderung `node scripts/set-version.mjs` ausführen; der V34-Workflow prüft die Synchronisation vor dem Deployment. Die statische Versionsanzeige ist auch vor dem JavaScript-Start vorhanden.

Für ein bestehendes V31.2-/V32-System: `setup-v34-gesamtupdate.sql` ausführen, **V34 Gesamtupdate deployen** starten und die statische Website über das bisherige Hosting veröffentlichen. Details und Reihenfolge stehen in der Installationsanleitung. Keine alten ZIPs kombinieren.

228 automatisierte Tests bestanden. [Prüfprotokoll](TESTPROTOKOLL-V34.md). Noch kein Live-Deployment oder Test in deinem Supabase-Projekt erfolgt.

---

## Historischer Stand V32.0.1

Die nachfolgenden Abschnitte dokumentieren ältere Releases. Für dieses Gesamtpaket gilt die V34-Anleitung oben.

**Update von V32.0:** [HOTFIX-V32.0.1.md](HOTFIX-V32.0.1.md). Gültige Zahlenfelder, sichtbare Eingabefehler und Startmeldungen. Keine SQL-Ausführung oder Supabase-Bereitstellung erforderlich.

Vollständiges Dashboard auf dem verfügbaren V31.2-Stand. Neues eigenständiges Modul: sechs Szenarien, Tages-/Wochenmethoden, Quellenregister, frühere Analysen als Kontext, Risikobudget sowie KO-/Faktor-/Optionsprüfung. Originalberichte bleiben unverändert; Notizen und Auswertungen werden getrennt gespeichert.

Gemini startet ausschließlich manuell. Im neuen Modul sind nur ausdrücklich freigegebene Free-Tier-Modelle erlaubt; ohne Tarifbestätigung oder bei erreichtem Kontingent bleibt die Regelberechnung aktiv. Suchlinks werden automatisch als Metadaten archiviert, nicht als gelesene Expertenmeinungen. Keine automatischen kostenpflichtigen Quellen oder Anbieterwechsel.

Die bisherigen Funktionen und der V31.2-News-Bot bleiben unverändert. Telegram behält **TRIGGER KI**; Links, Anmeldung und Feedupdates starten keine KI.

**Installation:** [INSTALLATION-V32.md](INSTALLATION-V32.md).  
**Prüfbericht und Grenzen:** [TESTPROTOKOLL-V32.md](TESTPROTOKOLL-V32.md).  
**V31-Erstinstallation:** [INSTALLATION-V31.md](INSTALLATION-V31.md).

165 lokale Tests erfolgreich. Noch nicht produktiv installiert. Unter Signal- & Verlaufssimulation den Button **V32.0.1 · Deep-Analyse öffnen** wählen. Produkt-/Bewertungsdaten werden eingegeben; fehlende kostenlose Daten werden angezeigt.

Die folgenden Abschnitte beschreiben den bisherigen V29.4-/V30.1-Umfang.

---

# Investition Dashboard V29.4 + V30.1 Event- & Szenarioanalyse

Dieses Paket enthält den vollständigen, konsistenten V29.4-Stand und integriert die V30-Funktion **als eigene Seite innerhalb der vorhandenen Navigation**.

## Ergebnis

Die Navigation enthält zusätzlich:

```text
◇ Event- & Szenarioanalyse
```

Die neue Seite nutzt dieselbe Supabase-Anmeldung wie das Dashboard. Eine zweite Login-Seite ist nicht erforderlich.

## Korrektur V30.1 – unabhängige Investmentideen

- Marktideen werden bei jedem Bestandsabgleich separat erzeugt – auch bei „nur Portfolio“ oder „kein Bestandsabgleich“.
- Die Themen- und Wirkungsmuster wurden deutlich erweitert.
- Erkannte Szenarien liefern mindestens vier themenspezifische Kandidaten.
- Nicht eindeutig klassifizierbare Eingaben liefern mindestens sechs gekennzeichnete Recherchekandidaten statt einer leeren Liste.
- Ein Wert kann gleichzeitig als Marktidee und als Portfolio-/Watchlistwert erscheinen; die Marktidee wird nicht mehr durch eine Dublettenprüfung entfernt.
- Chancen, Risiken, Absicherungen und Recherchekandidaten werden getrennt dargestellt.

## Trennung vom Bestand

V30 liest vorhandene Daten aus:

- `depot_positions` – nur offene Positionen;
- `trade_plans` – Watchlist und bestehende Analysen;
- `market_news` – bereits synchronisierte und bewertete Dashboard-News.

V30 verändert diese Tabellen nicht. Ergebnisse werden ausschließlich in eigenen Tabellen gespeichert:

- `event_analyses`
- `event_analysis_assets`
- `event_analysis_scenarios`
- `event_analysis_sources`
- `event_analysis_signals`

Bestehende News-Syncs, Telegram-Alerts, Digest-Berichte und die drei Cronjobs bleiben unverändert.

## Neue Komponenten

- `event-analysis.js` – integrierte Oberfläche, Function-Aufruf, Historie und Ergebnisdarstellung;
- `setup-v30-event-analysis.sql` – eigene Tabellen, Indizes und RLS;
- `supabase/functions/analyze-market-event/index.ts` – Recherche, Portfolio-/Watchlistabgleich, Ideen und Szenarien;
- `supabase/functions/_shared/event-idea-engine.mjs` – vom Bestand unabhängige Themen-, Peer- und Rückfalllogik;
- `diagnose-v30-event-analysis.sql` – Datenbankdiagnose;
- erweiterte Navigation in `index.html` und `news.js`;
- erweiterter Deployment-Workflow für die vierte Edge Function.

## Recherche und Bewertung

Die erste integrierte Fassung kombiniert:

- vorhandene V29.4-Market-News;
- GDELT;
- Google News RSS;
- regelbasierte Ereignis- und Wertschöpfungskettenmodelle;
- Portfolio- und Watchlistabgleich;
- Base-, Bull- und Bear-Szenario;
- Einpreisungsstatus aus bereits bewerteten V29.4-News, soweit verfügbar.

Die Ergebnisse sind Entscheidungsunterstützung und keine garantierte Prognose oder individuelle Anlageberatung.

## Installation

Verbindlich ist [`INSTALLATION-V29.4-V30.md`](./INSTALLATION-V29.4-V30.md).
