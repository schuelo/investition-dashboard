# V38.0.0 — Depotprüfung, Handlungseinschätzungen und Analysechat

Vollständiges Paket auf Basis des zuvor gelieferten V37.0.0. Die Anmeldung zeigt **38.0.0**. Neue Hauptansichten: **Mein Portfolio** und **Wertpapier prüfen**. Bisherige Werkzeuge einschließlich Deep-Analyse, News, Depotverwaltung und Benchmark bleiben über **Mehr** erreichbar.

Dieses Update enthält neue Datenbanktabellen und eine neue Serverfunktion. Anders als beim reinen V37-Layoutupdate sind deshalb die folgenden Installationsschritte erforderlich.

## Installation bei aktivem V36 oder V37

1. Das bisherige Repository sichern. Eigene Änderungen vergleichen und die eigene öffentliche Supabase-Konfiguration in `supabase.js` beibehalten.
2. `investition-dashboard-v38.0.0-komplett.zip` entpacken und den gesamten Inhalt einschließlich Unterordnern in die Repository-Wurzel übernehmen. Keine zusätzliche ZIP-Oberordnerebene hochladen. Mit GitHub Desktop den Inhalt in das lokale Repository kopieren, committen und **Push origin** wählen. `node_modules` ist weder enthalten noch für das statische Hosting nötig.
3. In **Supabase → SQL Editor** die Datei **`setup-v38-investment-review.sql`** vollständig ausführen. Sie ergänzt ausschließlich V38-Tabellen, sichere Schreibfunktionen und das separate Alpha-Vantage-Schutzbudget. Bestehende Depotdaten, Berichte und Zeitpläne werden nicht gelöscht.
4. In GitHub **Actions → V38 Depotprüfung und Chat deployen → Run workflow** starten. Der Workflow führt die Tests aus und deployt ausschließlich die neue Function `review-investments`. Vorhandenes Secret: `SUPABASE_ACCESS_TOKEN`. Vorhandene Standardprojekt-ID: `pzhfybtoyfttftgcrcxk`; für ein anderes Projekt `SUPABASE_PROJECT_ID` als Repository-Variable setzen.
5. Die Website über das bisherige Hosting veröffentlichen. Der V38-Workflow deployt die Serverfunktion; er veröffentlicht nicht die statische Website. Vollständig neu laden und auf der Anmeldung **38.0.0** prüfen.
6. Anmelden und **Mein Portfolio → Depot abgleichen** wählen. Bestehende offene Depotpositionen werden zugeordnet. Fehlende oder mehrdeutige Kennungen erscheinen unter **Depotzuordnung ergänzen** und können über WKN/ISIN geprüft werden. Die alten Depotzeilen werden dabei nicht verändert.

Wenn V36 noch nicht vollständig installiert ist, die enthaltene `INSTALLATION-V36.md` für die Basis berücksichtigen. `setup-v38-gesamtupdate.sql` fasst die additiven V32-/V33-/V35-/V36-/V38-Strukturen für eine vorhandene V31.2-/V32-Basis zusammen. Bei aktivem V36/V37 genügt die V38-Teil-SQL aus Schritt 3. Die Gesamtdatei ersetzt kein Grundsetup einer leeren Datenbank.

## Ersatzweg für den Yahoo-Fehler HTTP 429

Die bisherige Meldung „Öffentliche Chartquelle hat ihr eigenes Limit erreicht“ entsteht beim Yahoo-Kursabruf vor der KI. V38 ergänzt in der **neuen Wertpapierprüfung** den auswählbaren API-Weg **Alpha Vantage**. Die früheren Analysewerkzeuge behalten ihre bisherigen Datenwege.

1. Einen kostenlosen Schlüssel auf [Alpha Vantage](https://www.alphavantage.co/support/api-key/) anlegen.
2. Diesen in **Supabase → Edge Functions → Secrets** als **`ALPHAVANTAGE_API_KEY`** hinterlegen. Nicht in GitHub oder in die Website-Dateien schreiben.
3. Depotposition öffnen oder WKN/ISIN suchen. **Kursquelle: Alpha Vantage** wählen.
4. Den vorgeschlagenen Anbieter-Ticker, Handelsplatz und die Währung prüfen und bestätigen. XETRA verwendet hier z. B. `SND.DEX`, die Analysekennung bleibt `SND.XETRA`. Für US-Notierungen entfällt `.US` beim Anbieter-Ticker. Ein Vorschlag ist kein Live-Nachweis der Abdeckung; die API-Stammdaten werden vor Verwendung geprüft.
5. **Prüfen und Plan speichern** starten. Das Ergebnis wird mit Herkunft und Kursdatum gespeichert und steht auch der automatischen Prüfung zur Verfügung.

Alpha Vantage wird zunächst für XETRA und US verwendet. Andere Handelsplätze weiterhin ausdrücklich über EODHD, die öffentliche Quelle oder eigene CSV wählen. Es gibt keine automatische Quellenumschaltung und keinen automatischen Wechsel zu einem Bezahltarif.

Der reguläre kostenlose Alpha-Vantage-Zugang umfasst derzeit 25 API-Anfragen pro Tag. Der erste Abruf benötigt üblicherweise eine Stammdaten- und eine Historienanfrage. Die Implementierung verwendet ausschließlich `SYMBOL_SEARCH` und `TIME_SERIES_DAILY` mit `outputsize=compact`: höchstens 100 unadjustierte Tageskerzen. SMA200 und längere historische Vergleiche können deshalb fehlen und werden nicht ersetzt oder erfunden. Das gemeinsame serverseitige Schutzbudget umfasst auch Hintergrundprüfungen. Andere Anwendungen mit demselben Schlüssel können das Anbieterbudget zusätzlich belasten.

Eigene OHLCV-CSV funktioniert ohne Kursdienst. Spalten: `date,open,high,low,close,volume[,adjusted_close]`, 60 bis 2000 Tageskerzen, maximal 600 kB. Nach einem CSV-Import wird dessen Quelle gewählt. Die automatische Prüfung kann diese gespeicherten Daten erneut bewerten, sie jedoch nicht selbst aktualisieren. Für neue Kurse eine neue Datei importieren.

## Automatische Portfolioprüfung einschalten

Die Hintergrundprüfung läuft auf Supabase, auch wenn Browser und iPhone geschlossen sind. Dafür einmalig den neuen Zeitplan installieren:

1. In Supabase die Erweiterungen **pg_cron**, **pg_net** und **Vault** verfügbar machen, falls sie noch nicht aktiv sind. Der bestehende Newsbot verwendet möglicherweise bereits diese Einrichtungen.
2. Im SQL Editor **`setup-v38-monitoring.sql`** ausführen. Das installiert eine geschützte Konfigurationsfunktion; es verändert noch keinen bestehenden News-/Alarmzeitplan.
3. Danach folgenden Aufruf **nur im Supabase SQL Editor** ausführen. Den Platzhalter durch den bereits als Edge-Function-Secret vorhandenen **CRON_SECRET** ersetzen. Nicht das Supabase-Passwort, den Anon-Key oder einen anderen Token verwenden. Den tatsächlichen Schlüssel nicht in einer Repository-Datei speichern:

```sql
select public.configure_investition_monitor(
  'https://pzhfybtoyfttftgcrcxk.supabase.co',
  'DEIN_BEREITS_VORHANDENER_CRON_SECRET'
);
```

Für ein anderes Projekt dessen Supabase-Projekt-URL ohne abschließenden Schrägstrich einsetzen. Der Cron-Schlüssel wird über Vault bereitgestellt. Es wird nur der eigene Job **`investition-v38-portfolio-monitor`** angelegt beziehungsweise ersetzt. Bestehende Jobs bleiben erhalten.

4. Bei den gewünschten Depotkarten **Automatisch prüfen** aktivieren. Bereits eindeutig zuordenbare offene Positionen werden beim ersten Abgleich mit gespeicherten Kursen vorbereitet. Die gewünschte externe Kursquelle wird je Wert erst durch das Speichern im Wertpapierformular gewählt.
5. Mit **Jetzt prüfen · ohne KI** einen bewussten Probelauf starten. Das ist von der Installation des Zeitplans unabhängig.
6. Nach einem echten Cron-Lauf zeigt das Depot **Letzter Hintergrundlauf** mit Datum/Uhrzeit. Ohne nachgewiesenen Lauf steht dort ausdrücklich ein entsprechender Hinweis. Unter Supabase → Cron → Jobs kann der neue Job samt Verlauf geprüft werden.

Der Zeitplan läuft alle 30 Minuten. Je Lauf werden bis zu 40 fällige, aktiv markierte Werte verarbeitet; höchstens zwei dieser Vorgänge dürfen neue Kursabrufe anstoßen. Weitere Abfragen werden zurückgestellt und als nicht durchgeführt kenntlich gemacht. Bestehende hinreichend aktuelle Tagesdaten werden wiederverwendet. Bei größeren Portfolios, mehreren Nutzern oder erschöpftem Anbieterbudget dauert eine vollständige Kursaktualisierung entsprechend länger. Hintergrundläufe starten keine KI.

Nachrichten stammen dabei aus dem vorhandenen synchronisierten Newsbestand. Der bestehende News-Synchronisationsjob muss dafür weiterlaufen. Zusätzliche öffentliche Recherche und erneutes Lesen eigener URLs erfolgen beim manuellen Start. Bereits gelesene eigene Quellen bleiben bei Hintergrundprüfungen mit ihrem ursprünglichen Abrufzeitpunkt erhalten.

## Was direkt bei jeder Depotaktie steht

- Name, Ticker/Analysekennung und Währung; gehaltene Positionen und zusätzliche Beobachtungen sind gekennzeichnet.
- Letzter gültiger Preis und **Kursdatum**.
- **Datum/Uhrzeit der letzten erfolgreichen aktuellen Analyse** sowie Zeitpunkt der letzten Prüfung.
- Handlungseinschätzung mit Kurzbegründung: Kauf prüfen, gestaffelten Kauf prüfen, Halten prüfen, Reduzieren prüfen, Teilverkauf prüfen, Verkauf prüfen oder Abwarten/nicht beurteilbar.
- Unabhängige Kennzeichnung des letzten Abrufs: erfolgreich, fehlgeschlagen, nicht durchgeführt oder noch nicht protokolliert, mit Zeitpunkt und Ursache.
- Einzeln filterbare Anzahlen aktueller, veralteter und fehlender Kurse sowie fehlgeschlagener beziehungsweise nicht durchgeführter Abrufe.

Ein aktueller gespeicherter Tageskurs kann gleichzeitig mit „letzter Abruf fehlgeschlagen“ erscheinen. Fehler löschen den letzten gültigen Preis nicht. Ein Neuladen der Seite setzt weder Kurszeit noch Analysezeit neu. Die Datumsausgabe erfolgt in deutscher Darstellung mit Zeitzone Europa/Berlin.

„Tageskurs aktuell“ bedeutet: mindestens letzter Werktag vor dem heutigen UTC-Datum. Das ist keine Echtzeitkennzeichnung. Wochenenden werden berücksichtigt, einzelne Börsenfeiertage nicht. Bei fehlenden, zukünftigen oder älteren Daten werden aktuelle kursbasierte Handlungseinschätzungen gesperrt. Ein alter Bericht bleibt mit seinem ursprünglichen Stand lesbar.

## Handlungseinschätzung und Vertiefung

Die Basisprüfung benötigt keine KI. Sie berechnet die vorhandenen V36-Chartmethoden und sechs Szenarien, zeigt Potenziale relativ zum gespeicherten Schlusskurs und verbindet sie mit gehaltenem Bestand sowie deinen explizit hinterlegten Risiko-/Teilgewinnmarken. Der tatsächliche Depotbestand wird serverseitig gelesen; eine vom Browser eingeschleuste Stückzahl wird nicht übernommen.

Nachrichten stehen als gesonderte Belege daneben. Ohne gelesene/ausgewertete Inhalte wird kein vermeintlich fundiertes Newsurteil erfunden. Die KI kann diese Daten anschließend im Chat einordnen. Kaufkandidaten bleiben bedingt; weder Chartscore noch Modellquantile gelten als Trefferquote. Ein eingetragenes Kaufbudget wird auf die gewünschte Zahl von Tranchen verteilt; daraus entsteht keine Order oder automatische Produktauswahl.

KO-/Hebel- und Short-Positionen werden nicht automatisch wie Long-Aktien behandelt. Die bestehenden Produktwerkzeuge bleiben unter **Mehr → Frühere Analysewerkzeuge** erreichbar. Eine neue Kursquellenwahl stellt die bisherigen Telegram-/KO-Alarme oder laufenden Papierdepots nicht automatisch auf eine andere Quelle um.

## Fortsetzbarer Chat und kostenlose Nutzung

Der integrierte KI-Chat verwendet **Gemini** und startet ausschließlich nach **Senden**. Für ihn gelten die vorhandenen Einstellungen:

- `GEMINI_API_KEY`
- `DEEP_GEMINI_MODEL`: ein bereits im Paket freigegebenes Modell (`gemini-3.5-flash-lite` oder `gemini-3.1-flash-lite`), sofern im eigenen Projekt verfügbar.
- `DEEP_GEMINI_FREE_TIER_CONFIRMED=true`: ausschließlich nach Prüfung des eigenen kostenlosen Tarifs setzen. Diese Angabe bestätigt der Betreiber; der Code kann die tatsächliche Google-Abrechnung nicht auslesen.

Ohne diese Freigabe wird kein KI-Anbieter aufgerufen. Das Paket aktiviert keine Abrechnung und verwendet für den neuen Chat keinen vorhandenen OpenAI-Schlüssel. Die eigenen V38-Grenzen sind 40 manuelle Basisprüfungen und 20 manuelle Chatantworten je Nutzer und UTC-Tag; Anbieterlimits gelten zusätzlich. Ein fehlgeschlagener Kursabruf vor nutzbaren Daten verbraucht keinen manuellen Basisprüflauf.

Gespräche werden je eigenem Wertpapier und mit Bezug auf den jeweiligen Bericht gespeichert. Der Kontext enthält den ausgewählten Bericht, aktuelle Planvorgaben und Auszüge der letzten 20 Nachrichten. Weitere Nachrichten lassen sich nachladen. Neue Prüfungen übernehmen die letzten fünf eigenen Nachrichten/Notizen als gekennzeichneten Gesprächskontext. Nutzervorgaben sind keine bestätigten Fakten. Konkrete Risiko-/Gewinnmarken ändern sich über den gespeicherten Plan; keine Chatantwort schreibt Depotpositionen oder Orders um.

**Neuesten gespeicherten Bericht einbeziehen** öffnet die neue Analyse für das bestehende Gespräch. Es startet noch keine KI. Alte Berichte und Aussagen bleiben in der Historie erhalten. Bei KI-Fehlern werden Frage und ehrliche Statusmeldung gespeichert. Bei einer gescheiterten Speicherung bleibt die aktuelle Antwort zum Kopieren sichtbar.

Alternativ **Eigene Notiz speichern** ohne KI wählen oder **Kontext für ChatGPT kopieren** beziehungsweise JSON exportieren. Diesen Inhalt in ChatGPT einfügen. Eine Antwort kann als **Externe Antwort übernehmen** gespeichert werden und bleibt als ungeprüfte Interpretation markiert. Dieses Gespräch hier wird nicht automatisch mit dem Dashboard verbunden. Ein direkt integrierter OpenAI-/ChatGPT-Chat über das bestehende Abonnement ist in dieser Version nicht enthalten.

## Betriebsprüfung und Fehlerhilfe

1. Anmeldung auf 38.0.0 prüfen; beide Hauptansichten und die bisherigen Bereiche über Mehr öffnen.
2. Eigene Depotposition öffnen und eine CSV-Prüfung ohne KI durchführen. Kursdatum, Analysezeit, Handlungseinschätzung und Chartmethoden vergleichen.
3. Falls eingerichtet, Alpha Vantage mit bestätigter Notierung einmal manuell testen. Fehlende Abdeckung wird als Fehler angezeigt, ohne stillen Yahoo-/EODHD-Wechsel.
4. Einen gespeicherten Bericht erneut öffnen: kein neuer Anbieter-/KI-Aufruf, ursprünglicher Zeitstempel bleibt bestehen.
5. Notiz speichern, erneut prüfen und den gekennzeichneten Gesprächskontext kontrollieren. Optional eine Gemini-Frage senden.
6. Hintergrundlauf in Supabase und anschließend den angezeigten Zeitpunkt im Depot prüfen.

Bei HTTP 429 die betroffene Quelle beachten. Eine Yahoo-Sperre wird durch einen KI-Modellwechsel nicht behoben. Ein fehlender Alpha-Schlüssel wird als **Abruf nicht durchgeführt** angezeigt. Nach Anbieterfehlern hält der neue Kursweg eine Pause ein; der letzte gültige Stand bleibt sichtbar. Bei fehlendem V38-Schema zuerst SQL und Function installieren.

Prüfungen und Grenzen stehen in `TESTPROTOKOLL-V38.md`. Kein Live-Deployment und kein Live-Test mit deinen Zugangsdaten wurden durchgeführt.

Referenzen: [Alpha-Vantage-Dokumentation](https://www.alphavantage.co/documentation/), [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart), [Supabase Scheduling](https://supabase.com/docs/guides/functions/schedule-functions).
