# V40.0.0 – Installation und Bedienung

Stand: 21.11.2026. Vollständiges Update auf Basis des vollständigen Pakets V39.5.0. Alle bisherigen Dateien und Unterordner sind enthalten. Es wird ein bestehendes Investition-Projekt aktualisiert, keine leere Datenbank eingerichtet.

## 1. Das vollständige Paket übernehmen

1. Das bisherige Repository und die Supabase-Datenbank sichern. Eigene Änderungen vergleichen. Die öffentliche Projektkonfiguration in `supabase.js` beibehalten, falls du ein anderes Projekt verwendest.
2. ZIP entpacken. **Den Inhalt direkt in die Wurzel des vorhandenen Repositorys kopieren**, einschließlich `.github/workflows`, `scripts`, `tests` und `supabase/functions`. Keine zusätzliche äußere Ordnerebene anlegen. `node_modules` und `dist` sind nicht erforderlich.
3. Mit GitHub Desktop die Änderungen committen und **Push origin** wählen. Damit werden auch Unterordner übernommen; diese müssen nicht einzeln auf GitHub angelegt werden.
4. Unter **Settings → Pages → Build and deployment → Source** einmalig **GitHub Actions** wählen, wenn diese Website über den neuen Workflow veröffentlicht werden soll.
5. Unter **Settings → Secrets and variables → Actions** muss das bisherige Secret `SUPABASE_ACCESS_TOKEN` vorhanden sein. Das ist der vorhandene Supabase Access Token mit Rechten für das Zielprojekt. Für ein anderes Projekt die Repository-Variable `SUPABASE_PROJECT_ID` setzen; voreingestellt ist das bisherige Projekt `pzhfybtoyfttftgcrcxk`. Niemals private Schlüssel in Website-Dateien eintragen.

## 2. Ein Workflow für Datenbank, Functions und Website

**Actions → V40 Produktivstand veröffentlichen → Run workflow** auf dem Standardbranch starten.

Die drei Optionen sind zunächst eingeschaltet:

| Option | Wirkung |
| --- | --- |
| V40-Datenbankupdate anwenden | Prüft die bestehende Depotbasis und ergänzt Bestandsverlauf, Archivierung und Abrufstatus. Eine bestehende ältere Depotbasis erhält das kombinierte V40-Depotupdate. |
| Zeitplan einrichten | Verwendet das vorhandene, geschützte Cron-Secret aus Vault; richtet den eigenen Monitor alle 30 Minuten ein und fordert einen ersten Lauf an. |
| Website veröffentlichen | Baut ausschließlich die Laufzeitdateien und veröffentlicht sie mit GitHub Pages. Tests, SQL, Entwicklungsskripte und Paketdateien werden nicht veröffentlicht. |

Der Workflow führt zuerst alle Anwendungstests und SQL-Prüfungen aus. Danach aktualisiert er die Datenbank, veröffentlicht `review-investments` und `analyze-deep-signal`, richtet auf Wunsch den Monitor ein und veröffentlicht zuletzt die Website. Die bisherige Trennung „Function aktualisiert, Website noch alt“ entfällt bei aktiviertem Pages-Schritt.

**Ein angeforderter erster Monitorlauf ist noch kein nachgewiesener erfolgreicher Lauf.** Die Website zeigt erst den tatsächlich gespeicherten Hintergrundlauf deines Benutzers. Fehlt Vault oder das passende Secret, gibt die Action einen Hinweis aus; die manuelle Anwendung bleibt nutzbar. Ein Anbieterproblem kann auch bei erfolgreich ausgeführtem Monitor bestehen bleiben.

Falls die Action nicht erscheint: Prüfen, ob `.github/workflows/deploy-v40-production.yml` tatsächlich im Standardbranch liegt und gepusht wurde. Die alten Actions bleiben als historische Dateien enthalten; für dieses Update die **V40**-Action verwenden.

## Fehler im automatischen V37-Prüflauf

Die Meldung **V37 kompakte Ansicht prüfen / check (push)** bezeichnet den bisherigen automatischen Prüfworkflow, nicht die installierte Dashboard-Version. Er wird bei jedem Push nach `main` gestartet. In der ursprünglichen Workflow-Datei fehlte die Installation der inzwischen hinzugekommenen Testabhängigkeiten. In einer frischen Kopie des vollständigen V40-Pakets lässt sich dadurch `ERR_MODULE_NOT_FOUND: Cannot find package '@electric-sql/pglite'` reproduzieren. Der tatsächliche GitHub-Fehlertext muss bei abweichendem Verhalten im fehlgeschlagenen Schritt geprüft werden.

**Korrektur für ein bereits hochgeladenes V40-Paket:**

1. In GitHub unter **Code** die Datei `.github/workflows/check-v37-ui.yml` öffnen und bearbeiten.
2. Direkt nach dem Schritt **Node einrichten**, vor den Prüfungen, diesen Schritt ergänzen. Beide neuen Zeilen gehören zu `steps`; `- name` steht auf derselben Einrückung wie die anderen Schritte:

```yaml
      - name: Prüfwerkzeuge installieren
        run: npm ci --ignore-scripts --no-audit --no-fund
```

3. Änderung auf dem Standardbranch committen. Den Prüflauf dieses **neuen Commits** ansehen. Ein erneuter Lauf des alten fehlgeschlagenen Commits verwendet weiterhin die alte Datei.

Alternativ die Workflow-Datei aus dem korrigierten vollständigen V40-Paket übernehmen und pushen. Diese Fassung heißt in Actions **Dashboard prüfen**, verwendet zusätzlich den npm-Cache und prüft SQL. Das Paket bleibt **V40.0.0**, da sich nur Prüfworkflow und Dokumentation ändern. Es sind dafür weder neue Datenbankänderungen noch neue Schlüssel oder ein neues Function-Deployment nötig. Anschließend kann die eigentliche Veröffentlichung über **V40 Produktivstand veröffentlichen** fortgesetzt werden.

## 3. SQL-Alternative bei eingeschränktem Access Token

Wenn der Management-API-Zugriff für Datenbankabfragen nicht erlaubt ist, das passende SQL im **Supabase SQL Editor** ausführen und anschließend den Workflow mit **Datenbankupdate deaktiviert** starten:

| Bereits eingerichteter Stand | Einmalig ausführen |
| --- | --- |
| V39.2 bis V39.5 mit funktionierender Bestandsverwaltung | `setup-v40-production.sql` |
| Bestehende V36–V39.1-Installation mit bisheriger Depotbasis | `setup-v40-depotupdate.sql` |
| Bestehende V31.2-/V32-Basis, spätere Module noch nicht eingerichtet | `setup-v40-gesamtupdate.sql` nach Prüfung der bisherigen Basisinstallation |

**Nicht alle historischen Gesamtupdates nacheinander ausführen.** Die V40-Updates behalten bestehende Positionen, Berichte und alte Kursdaten. Sie erfinden keine aktuellen Kursdaten und enthalten keinen Hintergrundzeitplan. Fehlende alte Deep-Tabellen separat gemäß bisheriger Einrichtung ergänzen; für eine aktuelle V39.5-Installation ist dies normalerweise bereits erledigt.

Für den Zeitplan kann `setup-v40-monitoring.sql` separat ausgeführt werden. Danach:

```sql
select public.ensure_investition_monitor(
  'https://pzhfybtoyfttftgcrcxk.supabase.co'
);
```

Bei einem anderen Projekt dessen genaue Projekt-URL einsetzen. Der Aufruf übernimmt ausschließlich ein bereits geschütztes `investition_review_cron_secret` oder `investition_news_cron_secret` aus Vault. Er gibt keinen Schlüssel aus. Der verwendete Wert muss zum vorhandenen Edge-Function-Secret `CRON_SECRET` passen. Fehlt er oder stimmt er nicht überein, die vorhandene Einrichtung in `INSTALLATION-V38.md`, Abschnitt kontinuierliche Überwachung, abschließen. Bestehende Newsbot-Jobs werden nicht ersetzt. Supabase benötigt dafür **pg_cron**, **pg_net** und **Vault**; die Monitor-SQL richtet die ersten beiden Erweiterungen ein, sofern die Projektberechtigungen dies zulassen.

## 4. Kursautomatik pro Wert einschalten

1. Im **Depot** oder in **Beobachtung** einen Wert öffnen.
2. Unter **Überblick → Kursaktualisierung → Kursquelle einrichten/verwalten** die Quelle wählen.
3. Anbieterkennung, Handelsplatz und Währung prüfen und bestätigen. Vorschläge sind keine automatische Identitätsfreigabe.
4. Prüfintervall und **Automatische Kurs- und Newsprüfung aktivieren** wählen. Speichern startet noch keinen Anbieter- oder KI-Aufruf.
5. **Jetzt aktualisieren** für den ersten einzelnen Kursabruf wählen. Im Depot aktualisiert **Kurse aktualisieren** bis zu sechs geeignete Werte pro manuellem Aufruf.

| Quelle | Voraussetzung und Grenze |
| --- | --- |
| Gespeicherte Kurse | Liest vorhandene Daten. Holt keine neuen Kurse. |
| CSV | Neue Daten müssen erneut importiert werden. Keine automatische Anbieterabfrage. Import bleibt unter Analyse verfügbar. |
| EODHD | Vorhandenes serverseitiges `EODHD_API_TOKEN`, bestätigte genaue Notierung und gemeinsames Tagesbudget. Der bisherige Schutzstandard bleibt bei 6 Aufrufen pro Tag, wenn nichts anderes konfiguriert ist. |
| Alpha Vantage | Serverseitiges `ALPHAVANTAGE_API_KEY` und unterstützte genaue Notierung. Der verwendete kostenlose Datenweg liefert bis zu 100 Tageskerzen; lange Durchschnitte können fehlen. |
| Yahoo | Experimentelle öffentliche Quelle ohne garantierte Verfügbarkeit. Anbieterlimits können auch nach mehreren Tagen ohne eigene Nutzung auftreten. |

Es gibt keinen stillen Wechsel zu einem anderen Anbieter, keine automatische Billing-Aktivierung und keine automatische Gemini-Anfrage. Der Code kann den tatsächlichen Abrechnungsstatus beim Anbieter nicht auslesen.

Die Preise sind **abgeschlossene Tageskurse**, keine Livekurse. Der erwartete Datenstand ist der vorherige Werktag; ein Börsenfeiertagskalender ist nicht enthalten. Ein Prüfintervall von 30 Minuten erzeugt deshalb nicht alle 30 Minuten einen neuen Preis. Der Monitor arbeitet begrenzte Kontingente ab: maximal zwei neue Kursanfragen und zwei Newsabrufe pro Hintergrundlauf. Bei vielen Werten kann die tatsächliche Bearbeitung später als das gewählte Intervall erfolgen. Werte ohne tatsächlichen Abruf werden bevorzugt, damit ein fehlerhafter Wert nicht dauerhaft die Warteschlange blockiert.

## 5. Bestände anlegen, ändern und entfernen

| Wunsch | Bedienung |
| --- | --- |
| Neues Wertpapier ins Depot | **Depot → ＋ Position hinzufügen**; gespeicherten Wert oder WKN/ISIN wählen, Stückzahl und Einstand erfassen. |
| Menge oder Einstand korrigieren | Wert öffnen → **Überblick → Deine Position → Bestand ändern**. Derselbe Knopf steht direkt in der Depotliste. |
| Weiteren Kauf getrennt erfassen | **Position hinzufügen** am Wertpapier. Es entsteht ein zusätzlicher Bestandsposten; bestehende Posten bleiben erhalten. |
| Einen Bestandsposten entfernen | **Ausbuchen**; bei mehreren Posten den gewünschten wählen und das Schließen ausdrücklich bestätigen. |
| Ganzen Wert aus Depot und Beobachtung entfernen | **Wert entfernen / archivieren**; alle offenen Posten dieses Werts werden nach Bestätigung geschlossen. Berichte, Gespräch, Kurse und Änderungsverlauf bleiben im Archiv. |
| Nur aus der Beobachtung entfernen | **Aus Beobachtung entfernen** in der Liste oder über die Merken-Schaltfläche am Wert. Ein tatsächlicher Depotbestand bleibt erhalten. |
| Frühere Vorgänge nachlesen | Wert öffnen → **Verlauf**. Archivierte Werte sind über **Beobachtung → Archiv** auffindbar. |

**Eine Mengenänderung ersetzt die absolute Stückzahl des gewählten Bestandspostens.** Sie wird nicht als zusätzlicher Kauf addiert. Mehrere Posten werden für Menge und gewichteten Durchschnittseinstand zusammengefasst. Bruchstücke bleiben erhalten. Ausbuchen ist eine Bestandsbuchung; es berechnet keinen realisierten Verkaufserlös und sendet keine Order. Eine Teilreduktion ist über die absolute neue Stückzahl möglich.

Kaufdatum und Kursdatum sind verschieden. Ohne Kurs bleiben Stückzahl und Einstand sichtbar, die Marktwertberechnung bleibt offen. Ein manuell eingegebener Bewertungskurs wird mit seinem eigenen Datum gekennzeichnet. Unterschiedliche Währungen werden nicht stillschweigend addiert.

## 6. Ansicht und Analyse

Die Hauptnavigation besteht aus **Depot, Suche und Beobachtung**. Ein Wert hat **Überblick, Analyse und Verlauf**. Im Überblick stehen Kurs, Chart, Position und Kursstatus; im Analysebereich die gespeicherte Einschätzung, **Analyse aktualisieren**, Gespräch und unter **Mehr** Deep/Szenarien/Hebel. Technische Details bleiben aufklappbar.

Eine Bestands-/Planänderung sperrt frühere aktuelle Ein-/Ausstiegsschwellen, bis erneut analysiert wurde. Der alte Bericht bleibt mit Datum und Techniken lesbar. Neue Kursdaten allein sind noch keine neue Analyse. Nachrichten können ohne ausreichend passende Quellen keine fundierte Nachrichteneinschätzung liefern; diese Lücke bleibt sichtbar.

Die Charts verwenden dieselbe schwarze Darstellung und echte gespeicherte Daten. **1W / 1M / 3M / 1J / Max** enden am letzten vorhandenen Wert. Eine kürzere Historie wird angezeigt und als kürzer gekennzeichnet; ein einzelner Wert erscheint als Punkt. Depotmessungen, Rückrechnung des heutigen offenen Bestands, Indexvergleich und Modellsimulation sind getrennt beschriftet. Die Rückrechnung enthält keine vollständige historische Depotbilanz mit Cash, Verkäufen und allen Zahlungsströmen.

## 7. Kontrolle nach dem Update

1. Anmeldung und **Status & Datenprüfung → Website / Server** zeigen **40.0.0**. Bei altem Stand vollständig neu laden und gegebenenfalls den alten Website-Cache löschen.
2. Eine vorhandene Position öffnen. Menge/Einstand ändern, speichern und erneut öffnen. Es darf kein zusätzlicher Bestand entstehen.
3. Eine kleine Testposition anlegen und wieder ausbuchen; Verlauf und verbleibende Bestände prüfen.
4. Kursquelle bestätigen und einmal aktualisieren. **Kursdatum** muss zur gelieferten Tageskerze passen; **Ansicht geladen** ist ausdrücklich kein Kursabruf.
5. Bei Anbieterfehlern bleiben der letzte gültige Preis und dessen altes Datum erhalten. **Anbieterpause**, fehlender Schlüssel und fehlende automatische Quelle bleiben unterscheidbar.
6. Nach dem ersten Monitorlauf **Status prüfen**. Ein nachgewiesener eigener Hintergrundlauf ist getrennt vom Erfolg einzelner Werte zu beurteilen.

Dieses Paket ist lokal geprüft und noch nicht in deinem GitHub-/Supabase-Projekt aktiviert. Die Ergebnisse der Tests und ihre Grenzen stehen in `TESTPROTOKOLL-V40.md`.
