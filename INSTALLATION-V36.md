# V36.0.0 — Analyse ohne EODHD

Stand: 08.11.2026. Vollständiges Paket mit den bisherigen V33-/V34-/V35-Erweiterungen. Es aktualisiert ein funktionierendes Dashboard ab V31.2/V32. Separate ältere ZIPs müssen nicht kombiniert werden.

## Weshalb das Update nötig ist

In V35 nutzt bereits die WKN-Zuordnung die EODHD-Suche und damit dasselbe gemeinsame Tagesbudget wie andere EODHD-Abfragen. Ein ausgeschöpftes Budget kann deshalb die Wertpapierauswahl stoppen, noch bevor eine Analyse beginnt.

V36 bietet getrennte Wege: WKN/ISIN direkt mit OpenFIGI zuordnen, Tageskurse aus einer öffentlichen Chartquelle laden oder eigene OHLCV-Daten importieren. Der unabhängige Analyseweg benötigt weder einen EODHD-Schlüssel noch dessen Budgetfunktion. Der bisherige EODHD-Weg bleibt ausdrücklich auswählbar. Keine automatische Umschaltung auf EODHD oder eine kostenpflichtige Datenquelle.

## Installation

1. Vorhandenes Repository sichern und eigene Anpassungen vergleichen. Die eigene öffentliche Supabase-Konfiguration in `supabase.js` beibehalten.
2. `investition-dashboard-v36.0.0-komplett.zip` entpacken und den gesamten Inhalt mit Unterordnern in die Repository-Wurzel übernehmen. `index.html`, `.github`, `supabase` und `tests` liegen direkt dort. Keine zusätzliche ZIP-Oberordnerebene hochladen.
3. In **Supabase → SQL Editor** die Datei **`setup-v36-gesamtupdate.sql`** vollständig ausführen. Sie ergänzt fehlende V32-/V33-/V35-/V36-Strukturen und verändert keine bestehenden Cronjobs. Wenn V35 bereits vollständig installiert ist, genügt alternativ **`setup-v36-independent.sql`**. Nur eine der beiden Varianten ist nötig.
4. Alle Änderungen auf den GitHub-Standardbranch pushen. **Actions → V36 Analyse ohne EODHD und Gesamtupdate deployen → Run workflow** ausführen. Der Workflow prüft Version, Gesamt-SQL und Tests und deployt `resolve-security`, `analyze-signal-path`, `analyze-deep-signal` und `paper-benchmark`.
5. Die Website über das vorhandene Hosting/GitHub Pages veröffentlichen. Der neue Workflow veröffentlicht die Supabase-Functions; die Website folgt dem bisherigen Hosting-Verfahren. Vollständig neu laden. Auf der Anmeldeseite muss **36.0.0** stehen.

GitHub benötigt wie bisher das Secret `SUPABASE_ACCESS_TOKEN`. Standardprojekt ist `pzhfybtoyfttftgcrcxk`; bei einem anderen Projekt die Repository-Variable `SUPABASE_PROJECT_ID` setzen. Die neue Workflow-Datei lautet `.github/workflows/deploy-v36-complete.yml`. Ist sie in Actions nicht sichtbar, die Datei und ihre Ordner auf dem Standardbranch prüfen.

Für eine leere Datenbank zuerst das bisherige Grundsetup ausführen. Bei einem Stand vor V31 die enthaltenen V31-Installationsschritte berücksichtigen. Dieses Gesamtupdate ersetzt das ursprüngliche Grundsetup nicht.

## Unabhängige Analyse starten

1. Signal- oder Deep-Analyse öffnen. **Kursquelle: Öffentliche Chartdaten · ohne EODHD** ist vorausgewählt.
2. In der WKN-/ISIN-Maske **OpenFIGI – ohne EODHD** wählen, Kennung eingeben und den gewünschten Handelsplatz auswählen. **Suchen** drücken. Alternativ Analysekennung, Name, Währung und öffentliche Kurskennung selbst eintragen.
3. Ergebnis kontrollieren und **In dieses Formular übernehmen** drücken. Die Analysekennung und die öffentliche Kurskennung werden getrennt angezeigt. Eine OpenFIGI-Zuordnung bestätigt nicht die Existenz desselben Tickers im EODHD-Katalog.
4. Öffentliche Kurskennung, Handelsplatz und Notierungswährung prüfen; danach das Bestätigungskästchen im Analyseformular aktivieren. Bei einer späteren Kennungs- oder Währungsänderung ist erneut zu bestätigen.
5. KI und Recherche nach Bedarf auswählen und **manuell starten**. Status und Fehler erscheinen im Formular. Quellenwahl und Anbieterherkunft bleiben im gespeicherten Bericht erhalten.

OpenFIGI liefert bei einer WKN-Abfrage FIGI, Börsenzuordnung und Ticker, jedoch nicht automatisch eine ISIN oder Notierungswährung. V36 erfindet diese Angaben nicht. Wenn öffentliche Kursmetadaten fehlen, vor der Übernahme eine Währung ausdrücklich auswählen; damit bleibt CSV nutzbar. Bei ISIN-Eingabe wird die gültige eingegebene ISIN beibehalten.

Beispiel zur Orientierung für die bereits besprochene Schneider-Notierung: Analysekennung `SND.XETRA`, öffentliche Kurskennung `SND.DE`, Notierungswährung `EUR`. Für Paris ist `SU.PA` eine andere Notierung. Das Ergebnis der aktuellen Suche und der Handelsplatz sind vor dem Start zu prüfen; dieses Beispiel ist kein Live-Nachweis der Anbieterabdeckung.

Die Quellenprüfung vor dem Start erkennt einen alten Server. Die Meldung „V36-Gesamtupdate deployen“ bedeutet, dass mindestens eine neue Function noch fehlt. Dabei startet keine EODHD-Analyse.

## Ohne Kursdienst per CSV arbeiten

In der Analyse **Eigene OHLCV-CSV · ohne Kursdienst** wählen. Falls die WKN-Suche verwendet wird, ruft sie in diesem Modus nur OpenFIGI auf. Analysekennung und Währung können auch vollständig manuell eingetragen werden; dann wird selbst diese Suche nicht benötigt.

Eine rechtmäßig vorhandene/exportierte Datei importieren: `date,open,high,low,close,volume[,adjusted_close]`. 60–2000 abgeschlossene Tageskerzen, höchstens 600 kB. Die Kennung und Währung müssen zu den Daten passen. Ein erfolgreicher Import hat Vorrang vor jeder anderen Kursquellenwahl. CSV-Daten gelangen in den eigenen Analysebericht, nicht in den gemeinsamen EODHD- oder öffentlichen Kurscache.

Mit Dashboard-Anmeldung bleiben manuelle Gemini-Analyse, automatische öffentliche Recherche, eigene URLs und Historie bei einem CSV-Import nutzbar. Ohne Anmeldung ist nur die lokale Chartberechnung mit ausgeschalteter KI und ohne Quellen-URLs verfügbar. Für die spätere Erfolgsauswertung einer CSV-Analyse ist eine aktualisierte CSV-Datei erforderlich.

Bereits in V35 lässt sich EODHD sofort umgehen: WKN-Suche verwerfen, Analysekennung und Währung selbst eintragen und eine OHLCV-CSV importieren. Die neue automatische öffentliche Kursquelle erfordert V36.

## Datenquellen, Limits und Herkunft

OpenFIGI-Mapping ist eine eigenständige öffentliche API. `OPENFIGI_API_KEY` ist optional; ohne Schlüssel gelten die Anbieterlimits. Die Zuordnung verwendet WKN/ISIN und den ausdrücklich ausgewählten MIC-Handelsplatz. Namensähnlichkeit ist kein Identitätsnachweis. Unterstützt werden verfügbare Aktien-/ETF-/Fondsnotierungen an den hinterlegten Börsen; keine automatische Übersetzung von KO-Produkt-WKNs in einen Basiswert.

Die Kursquelle verwendet den öffentlichen Yahoo-Chart-Endpunkt `query1.finance.yahoo.com/v8/finance/chart/…`. Das ist eine **inoffizielle Schnittstelle ohne Verfügbarkeitszusage**, kein vertraglicher kostenloser Marktdatenfeed. Sie benötigt in dieser Implementierung keinen API-Schlüssel, kann jedoch fehlen, begrenzt sein oder blockiert werden. Keine Cookie-/Crumb-Beschaffung, keine Hostrotation, keine Umgehung von Anmelde-/Bot-Sperren und kein Zugriff auf kostenpflichtige CSV-Downloads. Bei einem Fehler CSV verwenden oder später erneut manuell versuchen.

Bis zu 2000 der verfügbaren abgeschlossenen Tageskerzen werden verwendet. Die tatsächliche Historienlänge hängt vom Wertpapier und der Quelle ab. Währung, Kurskennung und bei gespeicherter OpenFIGI-Zuordnung auch der Handelsplatz werden abgeglichen. Heutige/unvollständige Kerzen werden nicht verwendet. Lücken, Datenalter und fehlende Adjustierung erscheinen in der Qualitätsprüfung. GBP und GBX bleiben verschiedene Notierungseinheiten; keine automatische Währungsumrechnung.

Eigene lokale Schutzgrenzen: je Benutzer und UTC-Tag höchstens 40 neue OpenFIGI-Suchvorgänge und 40 öffentliche Chartanfragen. Kursmetadaten bei einer Suche zählen bereits zu diesen Chartanfragen. Anbieter können früher begrenzen. Zuordnungen werden sieben Tage, öffentliche Kursdaten höchstens zwölf Stunden bei ausreichender Aktualität wiederverwendet. Alle neuen Caches sind benutzerbezogen und getrennt von EODHD. Bestehende manuelle Analyse-/Gemini-Limits bleiben zusätzlich bestehen.

Für den unabhängigen Analyseweg muss kein `EODHD_API_TOKEN` hinzugefügt, verändert oder bezahlt werden. Bestehende Gemini-Free-Tier-Einstellungen bleiben erhalten. Das Update richtet kein Billing ein und wechselt keinen Tarif; die Abrechnungseinstellungen vorhandener Konten werden nicht verändert.

## Bestehende Bereiche

Newsbot, Telegram-Ergänzungen, Portfoliologik und bestehende Zeitpläne behalten ihren bisherigen Stand. Vorhandene EODHD-basierte Alarme können weiterhin von deren Datenversorgung abhängen. Dieses Update macht die Signal- und Deep-Analyse unabhängig, stellt diese Hintergrundfunktionen nicht automatisch auf eine andere Quelle um.

Die gemeinsame Eingabemaske verwendet OpenFIGI auch in anderen Bereichen. Im Trade-Formular erfordert eine reine Chart-/Stammdatenübernahme ohne EODHD eine ausdrückliche Bestätigung zum Leeren der EODHD-Kennung und Alarm-Checkboxen im noch ungespeicherten Formular. Bestehende gespeicherte Pläne werden durch die Suche nicht verändert. Für EODHD-Kursalarme den ausdrücklich gewählten bisherigen EODHD-Katalogweg verwenden.

Das Papierdepot behält sein bisheriges Datenmodell und seine Ausführungsregeln. Öffentliche Chartdaten werden nicht automatisch zur Preisquelle laufender Experimente. Für einen unabhängigen Papierlauf eigene CSV-Daten bereitstellen; andernfalls gelten dessen bestehende geprüfte Cache-Quellen. WKN-Suche und Übernahme führen keine fiktive Order aus.

## Prüfung und Fehlerhilfe

Die Anmeldung, Reset-Seite, Asset-Versionen und Deep-Berichte sind aus `release.json` auf **36.0.0** synchronisiert. Prüfungen: `node scripts/set-version.mjs --check`, `node scripts/build-update-sql.mjs --check`, `node --test tests/*.test.mjs`. Ergebnisse und Grenzen stehen in `TESTPROTOKOLL-V36.md`.

- **EODHD-Tageskontingent erreicht:** Prüfen, ob sowohl Stammdatenquelle als auch Kursquelle unabhängig gewählt sind. Eine noch alte Website zeigt möglicherweise weiterhin V35.
- **V36-Schema fehlt:** Gesamt-SQL beziehungsweise V36-Teil-SQL ausführen. Ein fehlender RPC wird getrennt von einem echten Budgetfehler gemeldet.
- **Öffentliche Quelle nicht erreichbar / HTTP 429:** CSV verwenden. Es gibt keinen automatischen Wechsel zu EODHD.
- **Eigene OpenFIGI-Zuordnung nicht mehr verfügbar:** WKN/ISIN erneut suchen und dieselbe Notierung prüfen oder Kennungen ausdrücklich manuell erfassen und bestätigen.
- **Währung oder Handelsplatz passt nicht:** Die tatsächliche Notierung prüfen. Keinen anders lautenden Ticker als vermeintlich gleichwertig einsetzen.

Noch nicht durchgeführt: Live-Anbieterabfrage aus deinem Supabase-Projekt, Ausführung der SQL im Zielsystem, GitHub-/Supabase-Deployment und Live-Browserprüfung. Nach Installation einen manuellen Test durchführen; die automatisierten Tests ersetzen diese Betriebsprüfung nicht.

Referenzen: [OpenFIGI-Dokumentation](https://www.openfigi.com/api/documentation), [OpenFIGI-Börsencodes](https://www.openfigi.com/about/exchange-codes), [Yahoo-Notierung SND.DE](https://finance.yahoo.com/quote/SND.DE/). Für den öffentlichen Chart-Endpunkt gibt es hier keine zugesicherte offizielle API-Dokumentation.
