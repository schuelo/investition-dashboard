# V31.0 – Signal- & Verlaufssimulation

Ausgangsstand: vollständiges Paket V29.4 + V30.1.1 Deployment-Fix.
Dieses Paket ergänzt ein getrenntes Modul. Es wurde nicht auf dein produktives System aufgespielt.

## Installation bei vorhandenem V30.1.1

1. Repository sichern und den Inhalt dieses Paketordners in die Repository-Wurzel übernehmen. Den übergeordneten ZIP-Ordner nicht als zusätzlichen Unterordner veröffentlichen. Die Dateien unter `.github/workflows/` gehören zum Paket und müssen mit übernommen werden.
2. Im Supabase SQL Editor ausschließlich `setup-v31-signal-simulation.sql` ausführen. Bestehende V29.4-/V30-Migrationen und Cronjobs nicht erneut einrichten.
3. Supabase → Project Settings / Edge Functions → Secrets prüfen:

| Secret | Verwendung |
| --- | --- |
| `EODHD_API_TOKEN` | Tageskurse abrufen; vorhandenen Schlüssel weiterverwenden. |
| `OPENAI_API_KEY` | Neue KI-Auswertung der Feedmeldungen. Ausschließlich als serverseitiges Secret speichern. |
| `OPENAI_MODEL` | Ein für deinen API-Zugang verfügbares Modell mit Responses API und Structured Outputs. Exakten Modellnamen aus deinem OpenAI-Projekt übernehmen; kein Modell ist fest im Code vorgegeben. |
| `HYBRID_EODHD_DAILY_BUDGET` | Optional; gemeinsames Kontingent, Standard 6, maximal 20. Bestehende Einstellung beibehalten. |

   Die Supabase-Standard-Secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` und `SUPABASE_SERVICE_ROLE_KEY` verwendet die Function wie die bisherigen Functions. Schlüssel nicht in Frontenddateien eintragen.
4. GitHub → Actions → **V31 Signal-Simulation deployen** → Run workflow. Dieser neue Workflow deployt ausschließlich `analyze-signal-path`. Er benötigt das bestehende GitHub Secret `SUPABASE_ACCESS_TOKEN`.
5. GitHub Pages wie bisher veröffentlichen. Danach `https://schuelo.github.io/investition-dashboard/reset.html?v=31.0` öffnen und neu anmelden.
6. Navigation → **Signal- & Verlaufssimulation**, alternativ `#signals`.

Wenn bisher nur V29.4 installiert ist, zuvor auch `setup-v30-event-analysis.sql` ausführen und den bisherigen Workflow **Supabase Functions deployen** einmal für die V30.1-Function verwenden. Danach den neuen V31-Workflow starten. Die V29.4-Basistabellen und Budgetfunktion müssen bereits vorhanden sein.

## Erste Nutzung

1. Ein EODHD-Symbol mit Handelsplatz eingeben, z. B. `NVDA.US`, `SAP.XETRA` oder `000660.KO`. TradingView-Symbole wie `NASDAQ:NVDA` werden nicht geraten oder stillschweigend umgewandelt.
2. Notierungswährung ausdrücklich bestätigen. Bei Londoner Aktien ggf. `GBX` (Pence) statt `GBP`; es erfolgt keine Währungsumrechnung.
3. Optional den Unternehmensnamen und eine Nachrichtenthese angeben. Eine These ist keine bestätigte Nachricht.
4. 5, 20 oder 60 Handelstage auswählen und **Analysieren & simulieren** starten.
5. Zuerst Kursdatum, Quelle, Warnungen und KI-Modus prüfen. Anschließend Modellband, Chartbefunde und Handelsschwellen lesen.

**Ausgewählte Aktie übernehmen** kopiert EODHD-Symbol, Name und Währung der aktuellen Trading-Analyse. Bei KO-/Zertifikat-Plänen wird die Produktwährung nicht übernommen; die Notierungswährung des Basiswerts muss neu bestätigt werden. Auch beliebige Werte außerhalb des Portfolios sind analysierbar. Ergebnisse werden nicht automatisch in Depot, Watchlist oder Trade-Pläne geschrieben.

Die **Synthetische Demo** braucht keine Datenanbieter und zeigt ausschließlich künstliche Kurse. Sie wird nicht als echte Marktanalyse gespeichert.

## Daten und Modell

- Mindestens 60 abgeschlossene Tageskerzen mit Open, High, Low und Close; 200 Kerzen für SMA200. Bis zu 300 Kerzen werden verarbeitet.
- Heutige und zukünftige Tageszeilen werden ausgeschlossen, weil ihr Abschluss nicht sicher feststeht. Intraday-Trading wird in dieser Version nicht unterstützt.
- Zuerst eigener OHLCV-Cache, dann lesender Versuch mit dem bisherigen V29.4-Cache. Reine Schlusskursreihen werden nicht zu erfundenen OHLC-Kerzen ergänzt.
- Frischer Cache spart Anbieteraufrufe. EODHD-Abrufe reservieren zuerst einen Aufruf aus dem vorhandenen gemeinsamen Tagesbudget. Bei Erschöpfung: nutzbarer Cache oder CSV, sonst klare Fehlermeldung.
- Kurse über 7 Kalendertage alt: Simulation sichtbar, Handelsschwellen gesperrt. Ungeklärte extreme Kurssprünge oder fehlende Renditeschwankung sperren ebenfalls.
- `adjusted_close` skaliert historische OHLC-Kurse auf die jüngste Rohkursbasis; Dividendenanpassungen fließen dabei ein. Rohvolumen wird bei großen Anpassungen innerhalb der letzten 21 Kerzen nicht bestätigt.
- Feedquellen: veröffentlichte `market_news` der letzten 14 Tage, exakter Handelsplatz/Symbol, Unternehmensname oder Stichwörter der These. Bis zu 12 deduplizierte passende Quellen. Kontextsuche betrachtet bis zu 1000 jüngste Meldungen; besonders häufige Feeds können ältere Kontexttreffer verdrängen.
- Die KI erhält berechnete Indikatoren und diese Quellen. Ungültige Quellenverweise, unvollständige Antworten und unbelegte gerichtete Thesen werden verworfen. Ohne API-Konfiguration oder passende News läuft eine deutlich gekennzeichnete Chartberechnung.

## Informativ angezeigte Chartmethoden

| Methode | Parameter / Befund | Einsatz |
| --- | --- | --- |
| SMA | 20, 50, optional 200 Tage | Trendfilter |
| MACD | EMA12 − EMA26, EMA9 als Signal | Momentum |
| RSI | 14, Wilder-Glättung | Überdehnung und Momentum |
| ATR | 14, Wilder-Glättung, True Range inkl. Gaps | Stopabstände und Puffer |
| Bollinger | SMA20 ± 2 Standardabweichungen | Schwankungsband |
| Donchian | Hoch/Tief der vorherigen 20 Kerzen | Unterstützung, Widerstand, Ausbruch |
| Volumen | Letztes Volumen / Mittel der vorherigen 20 Kerzen | Bestätigung ab 1,5× |

Der Chartscore ist eine feste Heuristik: 40 % Trend, 25 % MACD, 20 % Ausbruch, 15 % RSI. Die Indikatoren sind teilweise korreliert; der Score ist keine statistische Sicherheit.

Die Simulation zieht 800 reproduzierbare Pfade aus 5er-Blöcken von bis zu 120 zentrierten Tagesrenditen. Ein technischer Drift ist auf 0,1 Tagesvolatilität begrenzt. Das Band zeigt P10–P90, die mittlere Kurve P50. Die Szenariokarten zeigen illustrative P25/P50/P75-Endpunkte, keine Eintrittswahrscheinlichkeiten politischer oder wirtschaftlicher Ereignisse.

Standardmäßig verändert die KI keine Modellpfade. Die Option **KI-Richtung als Newsimpuls** ergänzt ausdrücklich eine zusätzliche Annahme: Richtung × subjektives KI-Vertrauen × 0,1 Tagesvolatilität, mit Abklingen über 5 Handelstage. Parameter und Seed sind im Ergebnis sichtbar. Das Modell ist nicht auf Prognosegüte kalibriert oder außerhalb der Stichprobe validiert.

## Ein- und Ausstiege

- Long: über dem größeren Wert aus letztem Schlusskurs / Widerstand plus 0,25 ATR.
- Short: unter dem kleineren Wert aus letztem Schlusskurs / Unterstützung minus 0,25 ATR.
- Stop jenseits der Gegenzone und mindestens 1,5 ATR vom Einstieg entfernt.
- Ziel 1 = 2R, Ziel 2 = 3R, wobei R der Abstand zwischen Einstieg und Stop ist. Diese Ziele sind Risikomultiplikatoren, keine Renditeprognosen.
- Bedingter Kandidat erst bei passendem Chartscore und ohne RSI-Überdehnung. Der eigentliche Einstieg erfordert einen bestätigten Tages-Schlusskurs und Volumen ≥ 1,5×; es wird keine bereits bestätigte Kauf-/Verkaufsorder behauptet.
- News-/Chartwiderspruch → abwarten. Stoprisiko über 15 % → gesperrt. Fehlendes Volumen verhindert die vollständige Triggerbestätigung.
- Teilgewinn an Ziel 1, Rest an Ziel 2 oder nachlaufendem 2-ATR-Stop; Zeitstopp am Horizontende prüfen.
- Kursmarken beziehen sich auf den Basiswert. KO-Produkte, Hebel, KO-Abstand, Finanzierungskosten und WKN-Auswahl sind nicht Bestandteil dieses Moduls. Gaps, Slippage und Gebühren sind nicht simuliert.

## Feedregeln und Historie

**Eingabe als Regel speichern** speichert Symbol, Währung, These, Horizont und KI-Optionen separat. Nur neue passende Meldungen nach dem Speicherzeitpunkt bzw. dem zuletzt verarbeiteten Newszeitpunkt lösen beim Prüfen eine neue Analyse aus. CSV-Daten werden nicht Teil der Regel.

**Neue Feedmeldungen prüfen** arbeitet gespeicherte Regeln ab, maximal drei ausgelöste Regeln pro Prüfung. Weitere Regeln werden beim nächsten Prüfen verarbeitet. **Bei Feedaktualisierung automatisch prüfen** reagiert auf das vorhandene Feed-Update-Ereignis, solange die Seite geöffnet und sichtbar ist. Die Option ist standardmäßig aus und wird beim Sitzungswechsel abgeschaltet. Kein neuer Cronjob, keine neuen Telegram-Nachrichten und keine Hintergrundüberwachung bei geschlossenem Browser.

Ergebnisse stehen in einer eigenen Historie. Maximal 20 serverseitige Analysen pro Nutzer und UTC-Tag; auch fehlgeschlagene Anbieterabrufe verbrauchen einen Versuch. CSV ohne KI kann lokal berechnet werden und wird dann nicht in der Cloudhistorie gespeichert.

## Was unverändert bleibt

V29.4-News-Sync, Telegram-Alerts, Digests, Portfolioanalyse und V30.1-Eventanalyse behalten ihre bisherigen Implementierungen. Die bestehenden Functions, Shared-Quellen und beiden bisherigen Setup-SQLs wurden byteweise auf Unverändertheit geprüft. Frontendänderungen beschränken sich auf die neue Seite, Navigation und Cacheversionen.

## Inbetriebnahme prüfen

1. Synthetische Demo öffnen: Methoden, Kurven und beide Schwellenkarten sichtbar.
2. Einen realen Wert mit aktivem EODHD-Zugang analysieren: korrektes Kursdatum, OHLCV-Quelle, passende Notierungswährung.
3. Mit passenden News und OpenAI-Secrets: **KI + Chartberechnung** und belegte Quellenverweise erwarten. Fehlende KI darf nicht als aktive KI angezeigt werden.
4. CSV mit ausgeschalteter KI prüfen; anschließend ohne Import wieder Datenanbieter verwenden.
5. Regel speichern und nach einer neuen passenden Meldung manuell prüfen; danach Auto-Feed bei geöffnetem Dashboard testen.
6. Alte Navigationsbereiche öffnen und News-Sync wie bisher prüfen.

Lokale Tests ersetzen diesen Livecheck nicht. Es wurden keine produktiven Secrets verwendet, keine Liveanbieter aufgerufen und keine Supabase-Migrationen ausgeführt. Eine interaktive Browserprüfung stand in dieser Umgebung nicht zur Verfügung; Oberfläche und Navigation wurden über isolierte DOM-/Funktionsprüfungen kontrolliert.

## Technische Quellen

- [EODHD: Historical OHLCV / adjusted_close](https://eodhd.com/financial-apis/api-for-historical-data-and-volumes)
- [OpenAI: Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Fidelity: ATR](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/atr)
- [Fidelity: MACD](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/macd)

## Rückkehr zu V30.1.1

Frontend aus deinem gesicherten V30.1.1-Paket wiederherstellen und dessen Reset-Seite verwenden. Die neuen V31-Tabellen dürfen bestehen bleiben; ohne Modulaufrufe starten sie keine Hintergrundarbeit. Bestehende Tabellen nicht löschen.
