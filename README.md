# V35.0.0 — WKN eingeben, EODHD-Notierung übernehmen

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
