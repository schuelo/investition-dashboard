# V34.0.0 — Ein vollständiger Stand einschließlich V33

Stand: 01.11.2026. Dieses Paket baut auf dem zuletzt gelieferten V33-Quellstand auf und enthält sämtliche bisherigen Dateien. Eine vorherige separate V33-Installation ist nicht erforderlich. Die nachfolgenden Schritte gelten für dein bereits eingerichtetes Dashboard mit V31.2-/V32-Funktionen. Eine komplett neue Supabase-Datenbank benötigt zuerst die bisherigen Grundschemas; siehe Abschnitt „Andere Ausgangslage“.

## 1. Repository sichern und Dateien übernehmen

1. In GitHub das aktuelle Repository als ZIP sichern. Eigene zwischenzeitliche Änderungen vor dem Ersetzen vergleichen, insbesondere Anpassungen an `supabase.js`, `index.html` und `supabase/config.toml`.
2. `investition-dashboard-v34.0.0-komplett.zip` lokal entpacken. In diesem ZIP liegen `index.html`, `README.md`, `.github`, `supabase` und `tests` direkt in der obersten Ebene.
3. Den **Inhalt** in die Wurzel deines vorhandenen Repositorys übernehmen. Es darf kein zusätzlicher Unterordner wie `investition-dashboard-v34…` zwischen Repository und `index.html` entstehen. Unterordner mit übernehmen, insbesondere die möglicherweise ausgeblendete `.github`-Struktur.
4. Änderungen auf `main` beziehungsweise dem eingestellten Standardbranch speichern. Alle Dateien gehören zusammen; V32-/V33-Patches nicht nachträglich darüberkopieren.

Mit GitHub Desktop werden die lokalen Dateien und Unterordner gemeinsam übernommen: Repository öffnen → Dateien hineinkopieren → Änderungen prüfen → Commit → Push. Beim Web-Upload prüfen, dass die Ordnerstruktur erhalten bleibt und versteckte `.github`-Dateien dabei sind.

Das Paket übernimmt die vorhandene Projektkonfiguration. Bei einem anderen Supabase-Projekt die eigenen öffentlichen Verbindungsdaten beibehalten und die Projekt-ID wie unter Schritt 3 konfigurieren. Keine Service-Role-Schlüssel in Frontend-Dateien oder GitHub-Code speichern.

## 2. Datenbank einmal ergänzen

In Supabase → **SQL Editor** die Datei **`setup-v34-gesamtupdate.sql`** vollständig öffnen und ausführen.

Die Datei enthält die zusammengefassten V32-/V33-Ergänzungen in einer Transaktion. Sie ergänzt Analysehistorie, Quellenregister und Papierdepot, soweit noch nicht vorhanden. Vorhandene Daten bleiben erhalten; News-/Telegram-Zeitpläne werden nicht neu angelegt oder geändert. Für die URL-Erweiterung genügt die bestehende JSONB-Struktur, es gibt keine zusätzliche V34-Tabelle.

Wenn V32 bereits aktiv ist und V33 fehlt, ist dies genau der vorgesehene Weg. `setup-v32-deep-analysis.sql` und `setup-v33-paperdepot.sql` müssen dann nicht zusätzlich ausgeführt werden. Diese Originaldateien bleiben zur Dokumentation enthalten.

Bei einer SQL-Fehlermeldung erst deren vollständigen Text prüfen. Nicht durch Löschen bestehender Tabellen oder wiederholtes Ausführen alter Cron-Installationen beheben.

## 3. Beide Functions gemeinsam veröffentlichen

GitHub → **Actions → V34 Gesamtupdate deployen → Run workflow**.

Der Workflow prüft die Versionsanzeigen, die gemeinsame SQL-Datei und alle Tests. Anschließend veröffentlicht er:

- `analyze-deep-signal` für V34-Deep-Analysen einschließlich eigener URLs;
- `paper-benchmark` für das eigenständige V33-Papierdepot.

Voraussetzung ist das vorhandene GitHub-Secret **`SUPABASE_ACCESS_TOKEN`** unter Settings → Secrets and variables → Actions. Der Workflow nutzt standardmäßig die bisherige Projekt-ID `pzhfybtoyfttftgcrcxk`. Falls erforderlich, die Repository-Variable **`SUPABASE_PROJECT_ID`** auf die eigene Projekt-ID setzen.

Es gibt keine neuen Gemini-Zugangsdaten oder zusätzlichen bezahlten Dienste. Die vorhandenen Gemini-Secrets, die Free-Tier-Bestätigung und die freigegebene Modellkonfiguration bleiben bestehen. Der eigene URL-Leser benötigt keinen zusätzlichen API-Schlüssel. Die tatsächlich im Google-Projekt eingestellte Abrechnung wird dadurch nicht geändert oder automatisch überprüft.

Falls der Workflow nicht erscheint: `.github/workflows/deploy-v34-complete.yml` muss auf dem Standardbranch liegen. Bei rotem Lauf den fehlgeschlagenen Schritt öffnen; „exit code 1“ ist nur die Abschlussmeldung. SQL-Einrichtung erfolgt weiterhin zuvor im SQL Editor, nicht automatisch im Deployment-Workflow.

Die anderen vorhandenen Workflows bleiben für den bisherigen Funktionsumfang enthalten. Für dieses Update nur den neuen V34-Workflow starten; alte News-Functions müssen nicht erneut deployt werden.

Alternativ mit bereits eingerichteter Supabase CLI:

```sh
supabase functions deploy analyze-deep-signal --project-ref pzhfybtoyfttftgcrcxk --no-verify-jwt
supabase functions deploy paper-benchmark --project-ref pzhfybtoyfttftgcrcxk --no-verify-jwt
```

Die Handler prüfen die angemeldete Benutzersitzung selbst vor jedem Datenzugriff. `--no-verify-jwt` setzt diese interne Prüfung nicht außer Kraft.

## 4. Website veröffentlichen und Version kontrollieren

Die statischen Dateien mit dem bisherigen GitHub-Pages-/Hosting-Verfahren veröffentlichen. Der neue Supabase-Workflow veröffentlicht **nur die Functions**, nicht die statische Website.

Bei Veröffentlichung aus dem Repository-Root genügt der übliche Push entsprechend deiner Pages-Konfiguration. Falls ein separater Pages-Workflow existiert, diesen wie bisher ausführen. Der neue Funktions-Workflow verändert die Hosting-Einstellung nicht.

Danach die Website neu öffnen. Auf der Anmeldeseite muss **„Version 34.0.0“** stehen. Auch im Dashboard ist dieselbe Gesamtversion sichtbar. Falls noch 29.4 oder ein älterer Stand angezeigt wird, sind Website-Veröffentlichung oder Browsercache noch nicht aktuell. Vollständig neu laden; falls nötig den vorhandenen `reset.html` über deine veröffentlichte Domain verwenden. Anschließend erneut die Version kontrollieren.

Die Cache-Version folgt dem Gesamtstand. Analyse-Skripte werden bei verfügbarer Verbindung zuerst vom Server geladen; offline können weiterhin zuletzt gespeicherte Dateien angezeigt werden. Eine aktuelle Versionsanzeige bestätigt den Frontend-Stand, nicht automatisch den erfolgreichen Function-Deploy. Bei eigenen URLs prüft das Formular deshalb zusätzlich die Server-Unterstützung vor dem Analysestart.

## 5. Analyse mit automatischer Suche und eigenen Links

1. Anmelden → **Signal- & Verlaufssimulation → V34.0.0 · Deep-Analyse öffnen**.
2. Ein Symbol mit Handelsplatz eingeben, beispielsweise `SND.XETRA`, und Notierungswährung bestätigen. Den Unternehmensnamen ergänzen, beispielsweise Schneider Electric, damit die automatische Recherche eindeutigere Suchbegriffe erhält. Notierung beim Datenanbieter prüfen; eine US-OTC-Notierung nicht als XETRA-Symbol behandeln.
3. Prognosehorizont, historische Kursdaten und Nachrichtenfenster auswählen. Wie bisher werden für die Chartberechnung tägliche OHLCV-Daten benötigt; eine reine Webseite ersetzt keine Kursreihe.
4. **„Kostenlose öffentliche Quellen recherchieren und hinterlegen“** aktiviert lassen, wenn zusätzlich automatisch gesucht werden soll.
5. Unter **„Eigene Quellen-URLs“** optional bis zu zehn vollständige öffentliche **HTTPS-Adressen** einfügen, eine je Zeile. Leere Zeilen werden ignoriert; doppelte normalisierte Links nur einmal abgerufen. Wenn die automatische Recherche deaktiviert wird, werden deine Links trotzdem geprüft.
6. **„Gemini beim manuellen Start verwenden“** aktivieren und **„Deep-Analyse manuell starten“** klicken. Ohne aktivierte KI werden Links und Chart-/Regelergebnisse gespeichert, aber keine neue KI-Auswertung durchgeführt.
7. Unter **„Quellen & Datenstand → Deine eingegebenen Links“** je URL prüfen: Abrufstatus, Bereitstellung an die KI und Verwendung als Quellenbeleg.

Bei einer alten Serverversion verhindert die neue URL-Vorabprüfung den Analysestart und verweist auf das V34-Deployment. Ohne eigene Links bleibt der bisherige Ablauf verfügbar.

### Was „einbezogen“ bedeutet

Lesbare HTML-/Textseiten werden ohne Anmeldung und ohne Ausführung von Seiten-JavaScript abgerufen. Ein begrenzter Textabschnitt, möglichst um den Unternehmensnamen, wird zusammen mit vorhandenen Feed-Auszügen und Chartdaten an den einen manuellen Gemini-Aufruf übergeben. Eigene Quellen haben Priorität vor allgemeinen Hintergrundlinks. Die KI soll deren Zusammenhang mit dem gewählten Wertpapier prüfen und Gegenargumente berücksichtigen.

„Der KI bereitgestellt“ bestätigt die Übergabe bei abgeschlossener KI-Auswertung. „Als Beleg zitiert“ bedeutet, dass die Antwort die Quellen-ID tatsächlich referenziert. Beides ist keine Bestätigung der inhaltlichen Richtigkeit der Quelle. Bei einem Gemini-Fehler oder fehlendem Kontingent erscheint die Regelanalyse mit einer Warnung; es gibt keine automatischen Wiederholungen pro Link.

Die automatische Suche bleibt die bisherige kostenlose News-/Primärquellen-Recherche. Suchtreffer und Expertenregister ohne gelesenen Text bleiben ausdrücklich **Metadaten**, keine gelesenen Artikel. Vorhandene relevante Feed-Auszüge und lesbare eigene Links können die Textgrundlage der KI liefern.

Nicht unterstützt werden PDF, Webseiten mit notwendigem JavaScript, Anmeldung oder zuverlässig erkannter Paywall/Bot-Sperre. Auch ein öffentlicher Link kann technisch nicht lesbar sein. Dann wird er als nicht gelesen ausgewiesen und liefert keinen Seitenauszug an die KI. Falls derselbe Link bereits einen Feed-Auszug besitzt, kann dieser separat gekennzeichnete Feed-Auszug weiter genutzt werden. Alternativ einen frei lesbaren HTML-Artikel beziehungsweise eine Unternehmensmeldung verlinken.

Es werden keine Paywalls oder Zugriffssperren umgangen. Nur Standard-HTTPS ohne eingebettete Zugangsdaten und eigene Ports wird unterstützt. Seiten nur mit IPv6-Ziel sind in dieser ersten URL-Version nicht abrufbar. Maximal drei Abrufe parallel, sieben Sekunden je URL einschließlich Weiterleitungen; Größen- und Textlimits verhindern unbegrenzte Downloads.

### Historie

Analyse, Quellenstatus und manuelle URL-Auswahl bleiben im ursprünglichen Bericht gespeichert. Im Quellenregister stehen Link, Abrufzeit, kurzer Auszug (maximal 25 Wörter) und ein Hash des der KI bereitgestellten längeren Textabschnitts. Längere Seitenauszüge bleiben nicht als Volltext in der Datenbank. Der Hash erlaubt eine Änderungsprüfung, ersetzt aber keine vollständige Reproduzierbarkeit des später möglicherweise geänderten Artikels.

## 6. V33-Papierdepot aus demselben Paket starten

Unter **Signal- & Verlaufssimulation → V33 · Fiktives Benchmark-Depot öffnen** ein eigenes Experiment anlegen. Drei Konten vergleichen Chartregeln, KI + Chartregeln und Buy-and-Hold. Das Papierdepot kann die neu gespeicherten, geeigneten V34-Gemini-Analysen lesen; es benötigt kein separates KI-Modell.

Das Modul wird separat per Button aktualisiert und ruft selbst keine neue KI auf. Details zu Daten, Kosten und Ausführung stehen in [ANLEITUNG-V33-PAPIERDEPOT.md](ANLEITUNG-V33-PAPIERDEPOT.md). Für die Installation gelten die V34-Schritte dieses Dokuments. Die Bezeichnung V33 kennzeichnet die Version des Papierdepot-Moduls, während das Gesamtpaket und die Anmeldung V34.0.0 anzeigen.

## Andere Ausgangslage

- Bereits funktionierendes V32: Schritte 1–6 oben reichen, V33 nicht separat installieren.
- Erst V31.2 installiert: Dieselbe Gesamt-SQL ergänzt V32 und V33; danach beide Functions und Website aus diesem Paket veröffentlichen.
- Nur V29.4/V30 eingerichtet: Zuerst die enthaltenen V31-Anweisungen für `setup-v31-signal-simulation.sql` und `setup-v31-2-manual-triggers.sql` berücksichtigen, danach V34. Nicht ungeprüft alte Grundinstallationen erneut ausführen.
- Vollständig neues Projekt: Grundsetup aus `INSTALLATION-V29.4-V30.md`, dann V31 und anschließend dieses V34-Update. Projekt-/Hosting-/Telegram-Zugangsdaten müssen selbst eingerichtet werden; das ZIP enthält keine privaten Zugangsschlüssel.

## Versionspflege für künftige Updates

Nur `release.json` ändern, dann:

```sh
node scripts/set-version.mjs
node scripts/set-version.mjs --check
node scripts/build-update-sql.mjs --check
node --test tests/*.test.mjs
```

Das synchronisiert die sichtbare Anmeldung, Dashboard-Kennung, Deep-Modul-Kennung und Cache-Referenzen. Der Gesamtworkflow bricht bei abweichenden Versionsanzeigen ab. Alte Modulnummern in historischen Anleitungen sind Dokumentation, keine Gesamtversionsangabe.

## Prüfstand

228 automatisierte Tests erfolgreich. Getestet wurden Engine, Service, tatsächliche Handler mit Testadaptern, Quellenabruf mit simulierten Netzwerkverbindungen, DOM-Bedienung und Cache-/Versionslogik. Die bestehende Handels-, News- und Telegram-Logik wird weiter durch Regressionen abgesichert.

Nicht durchgeführt: Live-Deployment in deinem GitHub/Supabase, Ausführung der Migration in deiner Datenbank, echte Seitenabrufe aus deinem Supabase-Runtime oder Live-Browserprüfung. Nach Installation zuerst einen eigenen Testlauf durchführen und die Meldungen im Quellenbericht prüfen.
