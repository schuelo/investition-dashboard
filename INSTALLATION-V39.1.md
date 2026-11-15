# V39.1.0 — Depotabgleich und aufgeräumte Oberfläche

Vollständiges Update des gelieferten V39.0.0-Stands. Die Anmeldung und die Website zeigen **39.1.0**. Die Serverfunktion meldet ebenfalls diese Version. Das Paket wurde lokal geprüft, jedoch noch nicht in deinem Supabase-Projekt installiert.

## Update eines aktiven V39

1. Repository und Datenbank wie bisher sichern. Eigene Änderungen vergleichen und die eigene öffentliche Supabase-Konfiguration in `supabase.js` beibehalten.
2. Das vollständige ZIP entpacken. **Den Inhalt** einschließlich `.github/workflows`, `supabase/functions` und aller Unterordner in die Repository-Wurzel übernehmen. Keine zusätzliche äußere Ordnerebene anlegen. Einfach mit GitHub Desktop: Dateien in den lokalen Repository-Ordner kopieren, committen und **Push origin**.
3. In **Supabase → SQL Editor** die Datei **`setup-v39-1-depotfix.sql`** vollständig ausführen. Sie ergänzt Altbestandszuordnungen, fehlende Bestandsfelder und eine geschützte Schreibfunktion. Bestehende Analysen, Nachrichten und Positionen werden dabei nicht gelöscht. SQL zuerst ausführen, danach die neue Function bereitstellen.
4. In GitHub **Actions → V39.1 Depotabgleich und Oberfläche deployen → Run workflow** starten. Warten, bis alle Schritte grün sind. Erforderlich ist das vorhandene Repository-Secret `SUPABASE_ACCESS_TOKEN`. Standardprojekt: `pzhfybtoyfttftgcrcxk`; für ein anderes Projekt die Repository-Variable `SUPABASE_PROJECT_ID` verwenden.
5. Die statische Website über das bisherige Hosting veröffentlichen. Die Action aktualisiert ausschließlich **`review-investments`**. SQL und Website werden dadurch nicht automatisch veröffentlicht.
6. Website vollständig neu laden. Vor der Anmeldung **39.1.0** kontrollieren. Falls weiter V39 erscheint, zunächst die Aktualisierung des Hostings und anschließend den Browsercache prüfen.
7. Anmelden und **Depot abgleichen** drücken. Die VW-Aktie sollte nun bei einem bestehenden passenden alten Datensatz unter **Bereits hinterlegte Werte** oder als bestätigte Depotposition erscheinen.

Falls die Action nicht sichtbar ist: Die neue `.github/workflows/deploy-v39-1-depotfix.yml` muss einschließlich der Unterordner auf dem Standardbranch des Repositorys liegen. Unter **Actions** nach dem vollständigen Namen oben suchen. Ein nur lokal kopiertes oder nicht gepushtes ZIP aktiviert keinen Workflow.

## Update älterer Stände

| Aktiver Stand | SQL in dieser Reihenfolge |
| --- | --- |
| V39 vollständig aktiv | `setup-v39-1-depotfix.sql` |
| V38 vollständig aktiv | `setup-v39-direct.sql`, danach `setup-v39-1-depotfix.sql` |
| V36/V37 vollständig aktiv | `setup-v38-investment-review.sql`, `setup-v39-direct.sql`, `setup-v39-1-depotfix.sql` |
| Vorhandene V31.2-/V32-Basis | `setup-v39-1-gesamtupdate.sql`; außerdem die vorausgesetzten Basisfunctions gemäß `INSTALLATION-V36.md` bereitstellen |

Die Gesamtdatei ist ein additives Update einer bestehenden Anwendung, kein Grundsetup für eine leere Datenbank. Nicht zusätzlich sämtliche historischen Gesamtdateien nacheinander ausführen. WKN-/ISIN-Suche benötigt weiterhin die vorhandene Function `resolve-security`. Hintergrundprüfung und Gemini verwenden die bestehende V38-Konfiguration; ein bereits eingerichteter Zeitplan wird nicht nochmals angelegt.

## Weshalb VW bisher fehlen konnte

V39 hat beim Abgleich nur `depot_positions` berücksichtigt. Frühere Analysen und Trade-Pläne liegen in `trade_plans`. Der mitgelieferte Startdatensatz **Volkswagen Vz. / VOW3.XETRA** ist beispielsweise eine übertragene Analyse mit neutraler Richtung und ohne bestätigte Stückzahl oder Einstand.

V39.1 ordnet solche eigenen gespeicherten Aktien-/ETF-Werte ebenfalls zu. Eine gespeicherte Analyse allein wird **kein erfundener Depotbestand**. Du findest sie im Depot unter **Bereits hinterlegte Werte**, außerdem über Suche und Beobachtung. Der originale Trade-Plan bleibt erhalten. Mehrere alte Pläne derselben exakten Notierung werden einer Wertpapierakte zugeordnet. Fremde Konten, andere Aktiengattungen und andere Notierungswährungen werden nicht vermischt.

Ein ausdrücklich offener älterer Bestand mit positiver Stückzahl wird als solcher erkannt. Ein unbekannter Einstand bleibt unbekannt. Geschlossene tatsächliche Positionen werden nicht durch einen älteren offenen Plan wiederbelebt. Geschlossene oder verworfene Altpläne werden nicht neu als Kandidaten angelegt.

## Tatsächlichen Bestand erfassen

1. Den Wert im Depot oder unter **Bereits hinterlegte Werte** öffnen.
2. **Bestand erfassen / ändern** antippen.
3. Bestehende Position auswählen oder eine neue tatsächliche Position erfassen.
4. **Tatsächliche Stückzahl und tatsächlichen Einstand je Stück** eintragen. Falls eine ältere Richtung ungeklärt ist, Long/Short bewusst bestätigen.
5. **Bestand speichern**. Danach wird der Wert als Depotposition geführt. Anschließend **Analyse aktualisieren**, damit die nächste Einschätzung den geänderten Bestand einbezieht.

Beim Bearbeiten ersetzt die Stückzahl den absoluten Bestand **der ausgewählten Position**. Es ist kein zusätzlicher Kauf. Mehrere tatsächliche Positionen desselben Wertpapiers bleiben separat auswählbar. Die Bestandsmaske unterstützt Aktien und ETFs; KO-/Hebelprodukte werden nicht als normale Aktienbestände ausgegeben. Sie erteilt keine Order und erzeugt keine fiktiven Transaktionen.

Über **Diese Position als geschlossen markieren** lässt sich eine nicht mehr gehaltene Position schließen. Ihre gespeicherten Daten und Analysen bleiben erhalten. Bei einem Netzwerkfehler kann derselbe Speichervorgang erneut bestätigt werden; die geschützte Anfragezuordnung verhindert Doppelbestände und ein späteres Wiederöffnen durch eine alte Wiederholung.

Nicht eindeutig zuordenbare ältere Kennungen stehen unter **Depotzuordnung ergänzen**. Den Eintrag öffnen, über WKN/ISIN die richtige Notierung und Währung wählen und **Nur Plan speichern** bestätigen. Eine gespeicherte Analyse und die Prüfung der Identität ersetzen weiterhin keine Bestandsbestätigung.

## Neue Bedienung

Die fünf alten Hauptansichten werden durch **Depot**, **Suche**, **Beobachtung** und die jeweilige **Wertpapierseite** ersetzt. Die Analyse liegt direkt beim einzelnen Wert. Charts, Chartmethoden, Szenarien, Datenlücken, Berichte und Gespräch bleiben dort gebündelt.

**Verwaltung** bietet Nachrichten, Benchmark-Depot, JSON-Import/-Export, Konto/Telegram, Sperren und Angaben zur Einrichtung der Kursquellen. Die alten großen Fachansichten erscheinen nicht mehr zusätzlich im Menü. Die zugrunde liegenden Tabellen und bisherigen Kernmodule bleiben erhalten. Bestehende Hintergrundjobs und Telegramregeln werden durch die neue Navigation nicht umgestellt.

## Meldung „Alpha Vantage ist noch nicht eingerichtet“

Diese Meldung bedeutet: Die Function findet **keinen nichtleeren `ALPHAVANTAGE_API_KEY`**. Sie belegt kein ausgeschöpftes Tageskontingent.

Alpha Vantage ist **optional**. Neue Werte starten in V39.1 mit **Gespeicherte Kurse / News**. Das benötigt keinen neuen Anbieter-Schlüssel und keinen neuen Kursabruf. Für eine bereits gespeicherte Alpha-Quellenwahl gibt es den ausdrücklichen Button **Gespeicherte Kurse / News wählen**. Die Anwendung wechselt die Quelle nicht stillschweigend. Mit **Nur Plan speichern** lässt sich diese neue Wahl für spätere Prüfungen übernehmen.

Ohne ausreichende gespeicherte Kursgeschichte ist eine Newsprüfung möglich, aber **keine vollständige aktuelle Chartanalyse und keine verlässliche aktuelle Einstiegsschwelle**. Veraltete Kurse behalten ihr tatsächliches Datum. Eigene OHLCV-CSV liefert Chartdaten ohne Kursdienst. EODHD und die öffentliche Yahoo-Quelle sind weiterhin bewusst auswählbar; deren Einrichtung und Limits gelten unverändert.

Wenn du Alpha Vantage nutzen möchtest:

1. Einen eigenen kostenlosen Schlüssel bei [Alpha Vantage](https://www.alphavantage.co/support/api-key/) beantragen.
2. Dein Supabase-Projekt öffnen, **Edge Functions → Secrets** wählen.
3. Neues Secret: **Name `ALPHAVANTAGE_API_KEY`**, **Wert dein Schlüssel**. Speichern. Nicht im Frontend oder in GitHub-Dateien hinterlegen.
4. Die Website neu laden. In **Verwaltung → Kursquellen & Einrichtung** steht anschließend **Schlüssel vorhanden**. Das bestätigt nur die Hinterlegung, noch nicht die Gültigkeit oder Abdeckung einer Notierung.
5. Beim Wert **Alpha Vantage** wählen, Anbieterkennung/Handelsplatz/Währung prüfen und bestätigen. Erst dann die Analyse starten.

Laut [offizieller Supabase-Dokumentation](https://supabase.com/docs/guides/functions/secrets) werden neue Secrets sofort für die Function verfügbar; das allein benötigt kein zusätzliches Deployment. Für dieses V39.1-Update sind die neue SQL und Function aus den Schritten oben trotzdem erforderlich. Laut [Alpha-Vantage-Support](https://www.alphavantage.co/support/api-key/) umfasst der reguläre kostenlose Zugang derzeit 25 Anfragen pro Tag für die meisten Datensätze. Nicht alle Funktionen oder Notierungen sind kostenlos verfügbar. Die Anwendung aktiviert kein Billing und bucht keinen Tarif. Recherchestand: 15.11.2026.

## Kurze Prüfung nach der Installation

- Version 39.1.0 bei Anmeldung kontrollieren und Depot abgleichen.
- VW öffnen; gespeicherte Analyse von tatsächlichem Bestand unterscheiden.
- Tatsächliche Stückzahl/Einstand bestätigen und danach Depot erneut öffnen.
- Eine Analyse mit gespeicherten Daten oder CSV starten; Kursdatum und fehlende Chartdaten prüfen.
- Vorhandene Berichte, Notiz/Chat und Beobachtung wieder öffnen.
- Verwaltung, Nachrichten, Benchmark sowie Import/Export prüfen.
- Einen echten Hintergrundlauf und die mobile Darstellung im Zielsystem prüfen.

Die technischen Nachweise stehen in `TESTPROTOKOLL-V39.1.md`. Kein Livezugriff auf deine Depotdaten oder Schlüssel wurde durchgeführt. Bei einem weiterhin fehlenden VW-Eintrag ist deshalb die angezeigte Zuordnungs-/Ladefehlermeldung maßgeblich; fehlende tatsächliche Bestandsdaten werden nicht ergänzt oder geraten.
