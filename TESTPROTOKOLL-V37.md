# Prüfprotokoll V37.0.0 — 15.11.2026

**351 automatisierte Tests bestanden; 0 fehlgeschlagen, 0 übersprungen.** Davon sind 328 vorhandene Prüfungen und 23 neue Prüfungen für die kompakte Darstellung und Bedienung. Eine bisher fest auf V36 gesetzte Asset-Erwartung liest jetzt die zentrale Releaseversion. Die vorhandenen Prüfungen bleiben erhalten.

## Ausgangsstand und Erhalt des Bestands

Ausgangspunkt ist das vollständige V36.0.0-Paket mit SHA-256 `35a282bbbe53af4adba946d82cb060bf86163eda5b8ee0a8a354d51f74914b12`. Der zuvor zurückgestellte V36.1-Stand mit Alpha Vantage wurde nicht als Implementierungsbasis verwendet.

Alle **28 Dateien unter `supabase/`** wurden byteweise mit V36.0.0 verglichen und sind unverändert. Das gilt einschließlich Deep-Engine, Quellenadaptern, Analyse-Endpunkten und Quotenlogik. `app.js`, `news.js`, `decision.js`, `analytics.js`, `event-analysis.js` sowie die öffentliche Konfiguration `supabase.js` stimmen ebenfalls byteweise mit V36 überein.

Die Originalmodule für Signal- und Deep-Analyse wurden um Darstellungsereignisse, tatsächliche Statusmeldungen und das Öffnen vorhandener Berichte ergänzt. Die Berechnungen und Analyseaufrufe behalten ihre bisherigen Eingaben und Regeln. Die Oberfläche zeigt 37.0.0; die unveränderte Deep-Berechnung führt weiterhin `36.0.0-deep-analysis` als Snapshotversion.

## Neue Prüfungen

- Tatsächliche Ergebnisse der V36-Engines speisen Kernaussagen, Kursleiter, Long-/Short-Auswahl, Modellchart und Deep-Szenarien. Eine Kursüberschreitung erzeugt keine erfundene Triggerbestätigung. Deep-Entscheidungen wie „ABWARTEN / KEIN TRADE“ bleiben vorrangig sichtbar.
- Datenalter wird gegen das aktuelle Datum ermittelt, nicht aus dem eingefrorenen `ageDays` eines alten Berichts übernommen. Fehlende oder zukünftige Kursdaten, ungültige Preise, bestehende Qualitätssperren und mehr als vier Kalendertage alte Kurse sperren aktuelle kompakte Schwellen und Modellchart.
- Chartgeometrie zwischen 280 und 900 Pixeln ohne ungültige SVG-Koordinaten; gemeinsamer Wertebereich für die berechneten Deep-Szenarien. Signal-Quantile ohne eigene Modellpfade erhalten keine erfundenen Szenariocharts. Quellenherkunft, KI-/Regelmodus und synthetische Daten werden anhand des Berichts gekennzeichnet.
- Historienvergleich nur mit einem strikt älteren Bericht desselben Symbols und derselben Währung. Gespeicherte Deep-Deltas müssen ausdrücklich währungsvergleichbar sein. Rendering verändert die gespeicherten Originaldaten nicht.
- Der tatsächliche neue UI-Controller läuft unter einem DOM-Adapter: Navigation über die bestehenden Seitenknöpfe, Mehr-Menü, Eingabebereitstellung, Öffnen vorhandener Berichte, Deep-Szenarioauswahl und beidseitige Synchronisierung der vorhandenen Auswahlfelder.
- Fehler übernehmen den tatsächlichen Status, öffnen die Eingaben und kennzeichnen einen noch sichtbaren vorherigen Bericht. Es gibt keine simulierten Fortschrittsprozente. Sichtbarkeit und Größenänderung aktualisieren nur die Darstellung.
- Cockpit-Abfragen enthalten die Benutzer-ID. Fremde Benutzer, widersprüchliche Symbol-/Währungszuordnungen und nicht passende Trigger werden zusätzlich im Controller verworfen. Teilausfälle bleiben benutzbar. Gleichzeitige Ladevorgänge werden zusammengefasst; ein 60-Sekunden-Zwischenspeicher verhindert unnötiges erneutes Laden.
- Ein Sitzungswechsel leert eigene Ergebnisansichten, Trigger, Berichtswarteschlange und Status und trennt Größenbeobachter. Später eintreffende Antworten der vorherigen Sitzung werden verworfen.
- Cockpit, Navigation, Trigger-Vorbereitung, Historienöffnung und Szenariowechsel starten keine KI oder Kursabfrage. Synthetische Demos erscheinen nicht als echte Marktberichte im Cockpit.
- Mobile CSS-Regeln enthalten ausreichend große Bedienflächen, 16-Pixel-Eingabeschrift, sichere Abstände zur iPhone-Unterkante und schwarze Hintergründe. Alle 320 HTML-IDs sind eindeutig; Berichts-, Formular- und Modulverschachtelung sowie lokale Assetverweise sind geprüft. Das ist eine Strukturprüfung, kein gerenderter Bildschirmtest.

## Weitere Prüfungen

```sh
node scripts/set-version.mjs --check
node scripts/build-update-sql.mjs --check
node --test tests/*.test.mjs
```

Bestanden: Release-/Panel-Synchronisation, additive Basis-SQL, Syntaxprüfung von 60 JavaScript-/MJS-Dateien, Parsen von 13 TypeScript-Dateien nach Entfernung der Typangaben sowie Einlesen aller acht GitHub-Workflow-YAML-Dateien. Die TypeScript-Prüfung ersetzt keinen vollständigen Deno-/Supabase-Typcheck.

Der neue Workflow `check-v37-ui.yml` prüft ausschließlich und benötigt keine Secrets. Er deployt keine Functions und führt keine SQL aus. Die bisherigen Installationsworkflows bleiben im vollständigen Paket vorhanden.

Das ZIP wird nach Erstellung auf Lesbarkeit, enthaltene Dateien und identische Dateibytes geprüft. Der aktuelle Release-Manifest dokumentiert die Ausgangsbasis und Datei-Prüfsummen. Das Archiv enthält den vollständigen Repository-Inhalt ohne zusätzliche äußere Ordnerebene.

## Grenzen und noch ausstehende Betriebsprüfung

Es erfolgten kein Live-Browsertest, kein Test auf einem physischen iPhone, kein GitHub-/Supabase-Deployment, keine SQL-Ausführung im Zielsystem und kein Live-Anbieter- oder Billingtest. Die DOM- und HTTP-Adapter prüfen Verhalten unter kontrollierten Bedingungen; sie bestätigen keine Anbietererreichbarkeit oder konkrete Browserdarstellung.

Nach Veröffentlichung die kurze Betriebsprüfung in `INSTALLATION-V37.md` durchführen. Das Layoutupdate beseitigt keine Limits der bisherigen öffentlichen Chartquelle. Bei einem bestehenden V36-System sind für die Oberfläche keine neuen Datenbank- oder Serveränderungen erforderlich.
