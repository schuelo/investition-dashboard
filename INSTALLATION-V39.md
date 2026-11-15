# V39.0.0 — Depot, Suche, Beobachtung

Vollständiges Update auf Basis des zuvor gelieferten V38.0.0-Pakets. Die neue Bedienung orientiert sich an kurzen Wegen einer Broker-App: Depot öffnen, Wert antippen, Einschätzung lesen, Plan anpassen oder Analyse aktualisieren. Hintergrund und mobile Darstellung bleiben schwarz. Die Anmeldung zeigt **39.0.0**.

## Installation

1. Repository sichern. Die eigene öffentliche Supabase-Konfiguration in `supabase.js` beibehalten. Eigene Quelltextanpassungen vor dem Übernehmen vergleichen.
2. `investition-dashboard-v39.0.0-komplett.zip` entpacken. Den gesamten Inhalt einschließlich `.github/workflows`, `supabase/functions` und aller Unterordner in die Repository-Wurzel übernehmen. Keine zusätzliche äußere ZIP-Ordnerebene hochladen. Mit GitHub Desktop: Inhalt in den lokalen Repository-Ordner kopieren, committen, **Push origin**.
3. In **Supabase → SQL Editor** abhängig vom aktiven Stand ausführen:

| Aktiver Stand | Auszuführende SQL |
| --- | --- |
| V38 vollständig installiert | `setup-v39-direct.sql` |
| V36 oder V37 vollständig installiert | Zuerst `setup-v38-investment-review.sql`, danach `setup-v39-direct.sql` |
| Vorhandene V31.2-/V32-Basis | `setup-v39-gesamtupdate.sql`; die vorherigen Basisfunktionen gemäß `INSTALLATION-V36.md` bereitstellen |

Die Gesamtdatei ist kein Grundsetup einer leeren Datenbank. Keine Datenbanktabellen oder bestehenden Jobs werden gelöscht. V39 ergänzt die Beobachtungskennzeichnung und eine private Tabelle für echte Depotbewertungen. Historische Analysen und Gespräche bleiben erhalten. Bereits gespeicherte Nicht-Depotwerte erscheinen bei der ersten V39-Migration in Beobachtung; eine erneute SQL-Ausführung hebt spätere Entfernungen nicht auf.

4. In GitHub **Actions → V39 Depot Suche und Beobachtung deployen → Run workflow** starten. Voraussetzung ist das vorhandene Repository-Secret `SUPABASE_ACCESS_TOKEN`. Das Standardprojekt ist `pzhfybtoyfttftgcrcxk`; bei einem anderen Projekt `SUPABASE_PROJECT_ID` als Repository-Variable setzen.
5. Die Website über dein bisheriges Hosting veröffentlichen. Die Action deployt nur die aktualisierte Function `review-investments`; SQL und statische Website werden dadurch nicht automatisch veröffentlicht.
6. Website vollständig neu laden, auf der Anmeldung **39.0.0** kontrollieren und anmelden. Der Einstieg erfolgt in **Depot**. **Depot abgleichen** ordnet bestehende offene Aktien-/ETF-Positionen zu.

WKN-/ISIN-Auflösung benötigt die vorhandene V36-Function `resolve-security`. Die V39-Action verändert die anderen Functions nicht. Falls V36 noch nicht vollständig aktiv war, zuerst dessen Installationsschritte nachholen. Die alten Anleitungen und Dateien sind im vollständigen Paket enthalten.

## Hintergrundprüfung

Ein bereits eingerichteter Job `investition-v38-portfolio-monitor` bleibt bestehen. Nach dem Function-Update verwendet er die V39-Logik über denselben Endpunkt. Keinen zweiten parallelen Job anlegen.

Falls noch kein V38-Zeitplan eingerichtet ist: `setup-v38-monitoring.sql` ausführen und die Konfiguration aus dem Abschnitt **Automatische Portfolioprüfung einschalten** in `INSTALLATION-V38.md` abschließen. Dazu gehören pg_cron, pg_net, Vault und der vorhandene `CRON_SECRET`. Tatsächliche Secrets ausschließlich im eigenen Supabase-Projekt verwenden.

Der Ablauf: alle 30 Minuten, bis zu 40 fällige aktivierte Werte, höchstens zwei Vorgänge mit neuen Kursabrufen und zwei gezielte kostenlose RSS-Suchen je Lauf. Der bisherige Newsbot soll für den vorhandenen Newsbestand weiterlaufen. Zusätzlich werden gemerkte und gehaltene Werte nach und nach über eine feste öffentliche RSS-Suche recherchiert. Ergebnisse werden sechs Stunden wiederverwendet; nach Fehlern gilt eine Stunde Pause. Zurückgestellte Werte erhalten einen späteren Suchslot. Bei mehr Werten oder erschöpften Anbieterbudgets können Aktualisierungen später erfolgen. KI wird durch den Zeitplan nicht gestartet.

Gezielte Suchtreffer bleiben ausdrücklich Metadaten und gelten nicht als gelesene Artikel. Erfolgreicher Newsabruf, fehlgeschlagener Abruf und nicht durchgeführte Suche sowie der ursprüngliche Abrufzeitpunkt werden getrennt angezeigt. Qualifizierte regelbasierte Ereignishinweise benötigen weiterhin passende Quellen-Auszüge; die manuelle Vertiefung kann zusätzliche erreichbare URLs und KI einbeziehen.

## Der neue Hauptablauf

### Depot

- Gehaltene zugeordnete Aktien/ETFs, mit Einschätzung, Ticker, Kursdatum, letzter erfolgreicher Analyse und unabhängigem Abrufstatus.
- Ein Tipp auf den Wert öffnet dessen eigene Wertpapierseite.
- **Prüfen** filtert Werte mit Handlungs- oder Datenbedarf. Weitere Kurs-/Abruffilter bleiben verfügbar.
- Fehlgeschlagene Abrufe erhalten den letzten gültigen Kurs. Weder Seitenaufruf noch Newsprüfung setzen das Kursdatum neu.

Die Bewertung verwendet tatsächliche offene Long-Aktien-/ETF-Bestände. Unterschiedliche Währungen stehen getrennt zur Auswahl; es findet keine erfundene Währungsumrechnung statt. KO-/Hebelprodukte, Short-/ungeklärte Richtungen und nicht zugeordnete Positionen fließen nicht als gewöhnliche Long-Aktien in die Summe ein. Fehlende oder alte Kurse und ausgeschlossene Positionen werden kenntlich gemacht. Ergebnis zum Einstand: vor Kosten, nur bei vollständig bekanntem Einstand der bewerteten Gruppe.

Der Verlauf zeigt tatsächlich gespeicherte Depotbewertungen **ab V39**. Ohne mindestens zwei Bewertungen erscheint ein ehrlicher Aufbauhinweis. Es wird kein vergangener Depotverlauf aus dem heutigen Bestand erfunden. Bestandsänderungen können die Kurve verändern; sie ist keine um Ein-/Auszahlungen und Trades bereinigte Renditekurve. Zeiträume 1W/1M/1J/Max lesen nur gespeicherte Daten und lösen keinen Anbieterabruf aus.

### Suche

Eigene gespeicherte Werte lassen sich lokal nach Name, Ticker, WKN und ISIN finden. Für einen neuen Wert die vorhandene WKN-/ISIN-Suche verwenden; verifizierte Notierung und Währung auswählen. Das ist keine neue weltweite Unternehmensnamensuche. Eine bekannte exakte Analysekennung kann unter **Notierung, Kursquelle und Horizont** eingegeben werden.

Bereits vorhandene Werte öffnen dieselbe Akte einschließlich Berichten und Gespräch. Neue Werte können über **Merken** ohne Kurs- oder KI-Aufruf gespeichert werden. Ihre erste automatische Prüfung nutzt zunächst gespeicherte Daten. Für neue externe Kurse die gewünschte Quelle bewusst wählen und Anbieterkennung/Währung bestätigen.

### Beobachtung

Gemerkte Werte und Kaufkandidaten. **Merken** aktiviert bei Nicht-Depotwerten die Prüfung ohne KI; die gespeicherte Quellenwahl und deren Budget gelten. Über **Automatisch prüfen** auf der Wertpapierseite kann die Überwachung separat ausgeschaltet werden.

Entfernen aus Beobachtung löscht keine Berichte und keinen Chat. Bei Nicht-Depotwerten stoppt es die Überwachung. Eine weiterhin gehaltene Depotposition wird dadurch nicht aus dem Depot entfernt oder dort abgeschaltet. Im **Analysearchiv** sind frühere gespeicherte Berichte weiterhin erreichbar.

### Wertpapierseite

**Analyse aktualisieren**, **Plan bearbeiten** und **Gespräch / KI** liegen direkt beim Wert. Die Übersicht zeigt Einschätzung, Begründung, Ein-/Ausstiegsmarken mit Herkunft und Chart. Weitere Charttechniken, Szenarien, Quellen und Datenlücken sind aufklappbar. Eingabeoptionen sind nach Notierung/Kursquelle, eigenem Plan und zusätzlichen URLs gegliedert.

Eine Planänderung schreibt keinen neuen erfolgreichen Analysezeitpunkt. Die Liste weist bis zur nächsten Prüfung auf den geänderten Plan hin. Neue Analyseversionen und ältere Gespräche bleiben getrennt nachvollziehbar. **Zurück** führt zur vorherigen Liste oder Suche. Die früheren Werkzeuge einschließlich Depotverwaltung, Eventanalyse, Portfolio Intelligence und Benchmark liegen unter **Verwaltung**.

## Nachrichten als Bestandteil der Einschätzung

V39 ergänzt eine konservative regelbasierte Gegenprüfung. Direkte, datierte Nachrichten der letzten sieben Tage werden auf definierte Ereignisse geprüft, etwa Prognosesenkung, Finanzierungs-/Bilanzrisiken, angehobenen Ausblick oder Aufträge. Ausreichende Quellen-Auszüge, bloße Metadaten, unbestätigte Hinweise und Negationen werden unterschieden. Jede erkannte Regel verweist auf die im Bericht angegebene Quellen-ID.

Negative Ereignishinweise können einen technischen Einstieg zurückstellen oder bei einer gehaltenen Position eine Thesenprüfung anstoßen. Eigene Risiko-/Teilgewinnmarken bleiben sichtbar. Positive Hinweise erzeugen ohne technischen Kandidaten keinen Kauf. Ungeprüfte Schlagzeilen lösen keinen automatischen Verkauf aus. Fehlgeschlagene Newsabrufe gelten nicht als vollständige aktuelle Analyse.

Das ist eine Ereignisprüfung mit begrenzten Sprachmustern, keine vollständige KI-/Fundamental-/Faktenprüfung. Sie kann Ereignisse übersehen oder Formulierungen falsch einordnen. Feed-/Seitenauszüge sind keine vollständig gelesenen Artikel. Keine Treffer bedeuten keine Entwarnung. Veröffentlichungsdatum, Prüfdatum, Belege, Gegenargumente und Datenlücken bleiben daher Teil des Ergebnisses. Eine vertiefende Gemini-Frage startet weiterhin nur ausdrücklich manuell.

## Kosten, Datenquellen und Prüfung nach Installation

Keine neuen automatischen KI-Aufrufe, kein neuer kostenpflichtiger Dienst und keine Billing-Aktivierung. Die vorhandenen Anbieterlimits und Schlüssel bleiben maßgeblich. Alpha Vantage, gespeicherte Daten, CSV, ausdrücklich gewähltes EODHD und die öffentliche Quelle bleiben wie in V38 verfügbar. Ein neuer Quellenweg erfordert weiterhin die entsprechende Einrichtung; er garantiert keine unbegrenzten oder Echtzeitkurse. Gemini benötigt die bereits dokumentierte eigene Free-Tier-Freigabe. ChatGPT-Export und Notizen bleiben verfügbar.

Nach der Installation: Depot abgleichen, einen Wert öffnen, Kurs-/Analysezeiten prüfen, einen neuen Wert merken, Beobachtung öffnen, CSV-Analyse speichern, Plan verändern, erneut prüfen und die Historie/Notiz wieder öffnen. Entfernen aus Beobachtung und danach das Archiv testen. Einen echten Hintergrundlauf und die iPhone-Darstellung im Zielsystem kontrollieren.

Technische Nachweise und verbleibende Prüflücken: `TESTPROTOKOLL-V39.md`. Dieses Paket wurde lokal getestet; kein Live-Deployment und keine Anbieterabfrage mit deinen Schlüsseln wurde durchgeführt.
