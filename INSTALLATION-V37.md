# V37.0.0 — kompakte schwarze Oberfläche

Stand: 15.11.2026. Dieses vollständige Paket setzt die abgestimmte Ansicht auf dem gewählten **V36.0.0** um. Die Anmeldung zeigt **37.0.0**. Die Serverfunktionen und Berechnungen stammen unverändert aus V36.0.0. V36.1 mit Alpha Vantage ist nicht enthalten.

## Update eines bereits funktionierenden V36-Systems

1. Das vorhandene Repository sichern. Eigene Änderungen und die öffentliche Projektkonfiguration in `supabase.js` beibehalten beziehungsweise vergleichen.
2. `investition-dashboard-v37.0.0-komplett.zip` entpacken. Den gesamten Inhalt einschließlich Unterordnern in die Repository-Wurzel übernehmen. `index.html`, `compact-ui.js`, `compact-ui.css`, `compact-analysis.mjs`, `release.js` und `service-worker.js` liegen direkt in dieser Wurzel. Auch die übrigen Dateien gemeinsam aktualisieren.
3. Alle Änderungen auf den bisherigen Veröffentlichungsbranch übertragen. Mit GitHub Desktop: Repository lokal öffnen, entpackten Inhalt hineinkopieren, Änderungen committen und **Push origin** wählen. So werden Dateien und Unterordner gemeinsam übernommen.
4. Die Website über das bisherige Hosting veröffentlichen. Bei GitHub Pages dessen vorhandenen Veröffentlichungsablauf verwenden. **Actions → V37 kompakte Ansicht prüfen** prüft das Paket; dieser Workflow veröffentlicht weder Website noch Serverfunktionen und benötigt keine neuen Secrets.
5. Website vollständig neu laden. Auf der Anmeldeseite muss **37.0.0** stehen. Bei einer alten Anzeige zunächst prüfen, ob das Hosting den neuen Commit veröffentlicht hat; anschließend die Seite neu öffnen. Falls nötig die Website-Daten dieser Domain im Browser löschen und erneut anmelden.

Für den Wechsel von einem vollständig aktiven **V36.0.0** zu dieser Oberfläche sind **keine SQL-Ausführung, kein Supabase-Function-Deployment und keine zusätzlichen API-Schlüssel** nötig. Datenbanken und gespeicherte Berichte bleiben bestehen.

## Bedienung

- **Cockpit:** zeigt bis zu sechs zuletzt gespeicherte eigene Analysen mit Datenstand und kleinen historischen Charts sowie bis zu drei offene, bereits zugestellte TRIGGER-KI-Meldungen. Beim Öffnen lädt es nur vorhandene Datenbankeinträge. **Analysen laden** aktualisiert diese Liste und startet keine KI oder Kursabfrage.
- **Analyse / Deep / Benchmark:** eigene Ansichten innerhalb des bisherigen Signalbereichs. Auf dem iPhone stehen Cockpit, Analyse, Deep und **Mehr** in einer unteren Navigation. **Mehr** öffnet alle bisherigen Bereiche; das Benchmark-Depot ist zusätzlich über seinen Reiter erreichbar.
- **Neue Analyse vorbereiten:** öffnet die Eingaben. Wertpapier, Quelle, Horizont und Optionen prüfen und anschließend den bisherigen Startknopf bewusst drücken. Der KI-Aufruf bleibt manuell.
- **Auf einen Blick:** aktueller Befund, gespeicherte Triggerbedingung und Invalidierung. Der Status verwendet die tatsächliche Setup-Entscheidung; eine Preisüberschreitung allein gilt nicht als bestätigtes Signal.
- **Kursleiter:** bedingte Long-/Short-Marken aus der Berechnung, Abstand zum letzten Schlusskurs und Chance/Risiko. Bei Deep wird das gespeicherte Nettoverhältnis verwendet, soweit vorhanden. Es wird keine Order ausgeführt.
- **Historie & Modellband:** tatsächliche gespeicherte Kurshistorie und berechnetes P10-/P50-/P90-Modellband. Deep-Szenarien lassen sich mit ihren vorhandenen Modellpfaden umschalten; alle verwenden dieselbe Kursskala. Quantile sind keine verifizierten Eintrittswahrscheinlichkeiten.
- **Was hat sich verändert?:** Vergleich mit einem älteren eigenen Bericht desselben Wertpapiers und derselben Währung. Dafür die Historie im Cockpit laden. Bereits im Deep-Ergebnis gespeicherte, vergleichbare Deltas werden ebenfalls angezeigt.
- **Vollständiger Originalbericht:** aufklappen für alle bisherigen Methoden, Quellen, Annahmen, Szenarien, Risiko- und Produktstressangaben. Die Eingaben sowie die Trigger-/Historienlisten sind ebenfalls aufklappbar.

Das Datenalter wird beim Anzeigen und bei Rückkehr in den sichtbaren Tab neu berechnet. Ein fehlender, zukünftiger oder mehr als vier Kalendertage alter Kursstand, ungültige Kurse oder die bestehende Qualitätssperre sperren aktuelle Schwellen und Prognosechart in der kompakten Ansicht. Im vollständigen Originalbericht bleibt das damalige Ergebnis lesbar. Es wird kein gespeicherter Bericht nachträglich umgeschrieben.

## Bearbeitungsstatus und Fehler

Der Status steht oberhalb der Ergebnisse und bleibt sichtbar, wenn die Eingaben zugeklappt sind. Er übernimmt tatsächliche Meldungen des vorhandenen Analyseablaufs: etwa Prüfung der Serverunterstützung, Absenden der Anfrage, Ergebnis oder Fehler. Der Server meldet keine laufenden internen Arbeitsschritte; deshalb gibt es keine erfundene Prozentanzeige.

Bei einem Fehler öffnet sich die Eingabe wieder. Ein zuvor geöffneter Bericht bleibt sichtbar und wird ausdrücklich als Bericht mit ursprünglichem Datenstand bezeichnet. Eine neue Analyse ersetzt ihn erst, wenn ein Ergebnis vorliegt.

## Quellen, Kosten und Versionsangaben

Öffentliche Chartquelle, OHLCV-CSV und ausdrücklich gewählter EODHD-Weg behalten den V36-Stand. Anbieterfehler beziehungsweise HTTP 429 werden durch das Layoutupdate nicht behoben; CSV bleibt der unabhängige Ersatz. Die bestehenden Gemini-Kontingente, Free-Tier-Einstellungen und manuellen Starts werden beibehalten. Das Update verändert keine Abrechnungseinstellungen.

Telegram-Ergänzungen, Newsbot, Portfolio, Papierhandelsregeln und Zeitpläne behalten ihre bestehende Logik. Der neue Cockpit-Bereich verwendet nur vorhandene, benutzerbezogene Datenbanktabellen. Er ist keine zusätzliche automatische Analyse.

Die Oberflächenversion ist **37.0.0**, während ein Deep-Originalbericht weiterhin die Berechnungsversion **36.0.0** tragen kann. Das ist beabsichtigt: Darstellung und unveränderte Berechnungsgrundlage sind getrennt nachvollziehbar.

## Falls V36 noch nicht vollständig aktiv ist

Für ein vorhandenes V31.2-/V32-/V35-System gelten zusätzlich die enthaltenen V36-Installationsschritte für Datenbank und Serverfunktionen; siehe `INSTALLATION-V36.md`. Das enthaltene `setup-v37-gesamtupdate.sql` fasst dieselben additiven V32-/V33-/V35-/V36-Strukturen unter der aktuellen Paketversion zusammen. Es führt kein neues V37-Schema ein. Nur die zum eigenen Ausgangsstand passende Gesamt- oder Teilmigration verwenden.

Der bestehende Workflow **V36 Analyse ohne EODHD und Gesamtupdate deployen** bleibt für diese Basisinstallation enthalten. Nicht allein wegen des neuen Layouts erneut deployen. Eine leere Datenbank benötigt weiterhin das ursprüngliche Grundsetup.

## Kurzer Funktionstest nach Veröffentlichung

1. Version auf der Anmeldung prüfen und anmelden.
2. Auf dem iPhone Cockpit, Analyse, Deep, Benchmark und die bisherigen Bereiche über **Mehr** öffnen.
3. In Analyse und Deep jeweils **Synthetische Demo** starten. Die Kennzeichnung, Chart, Kursleiter und vollständigen Details prüfen; in Deep ein anderes Szenario auswählen. Diese Demo benötigt keine KI und stellt keine Marktpreise dar.
4. Einen vorhandenen Bericht im Cockpit öffnen. Datenstand und Kennzeichnung älterer Berichte prüfen. Ein neuer Anbieterabruf soll dabei nicht starten.
5. Für eine echte Betriebsprüfung aktuelle OHLCV-Daten importieren oder die bisherige Kursquelle bewusst wählen und eine Analyse manuell starten. Bei einem Fehler muss oben eine Meldung erscheinen.

Automatisierte Prüfungen und ihre Grenzen stehen in `TESTPROTOKOLL-V37.md`. Ein Live-Deployment in deinem GitHub-/Supabase-Projekt ist in diesem Paket nicht enthalten.
