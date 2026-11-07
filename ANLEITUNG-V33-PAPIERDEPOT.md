# V33 · Unabhängiges fiktives Benchmark-Depot

Erweiterung des gelieferten V32.0.1-Startfix-Stands. Dieses Paket ist Quellcode, kein bereits erfolgtes Live-Deployment.

## Was enthalten ist

- Drei Modellkonten mit identischem Startkapital: Chartregeln, KI + Chartregeln und gleichgewichtetes Buy-and-Hold im gleichen Universum.
- Eigene Tabellen, eigener Funktionsendpunkt, eigene Oberfläche unter „Signal- & Verlaufssimulation“. Keine Änderung echter Trades, bestehender Telegram-Nachrichten, News-Funktionen oder Zeitpläne.
- Fiktive Orders, Positionen, Cash, Gebühren, adverse Slippage, Wertkurve, Rendite, maximaler Drawdown und dauerhaftes Entscheidungsjournal.
- Eigene manuell gespeicherte Gemini-Analysen werden gelesen und mit Chartregeln verknüpft. Ohne passende Analyse bleibt das KI-Konto für Neueinstiege in Cash.
- Transparente Signalbegründungen mit SMA, MACD, RSI, ATR, Bollinger-Bändern, Donchian-Zonen und Volumen. Nicht alle angezeigten Techniken sind unabhängige Handelssignale.

## Installation bei vorhandenem V32.0.1

1. Aktuelles GitHub-Repository als Sicherung herunterladen. Eigene seit V32 vorgenommene Änderungen vor Übernahme vergleichen, insbesondere in `index.html` und `supabase/config.toml`.
2. `V33-Papierdepot-Update.zip` lokal entpacken. Den **Inhalt** einschließlich `.github` und `supabase` mit erhaltenen Unterordnern in die Repository-Wurzel übernehmen, nicht einen neuen zusätzlichen Oberordner anlegen. Vorhandene Dateien nur nach Vergleich ersetzen.
3. In Supabase → SQL Editor die Datei `setup-v33-paperdepot.sql` vollständig ausführen. Voraussetzung sind die bestehenden V31/V32-Tabellen, insbesondere `signal_market_cache` und `deep_analyses`. Keine alte SQL erneut ausführen oder bestehende Tabellen löschen.
4. GitHub → Actions → **V33 Papierdepot deployen** → **Run workflow**. Es wird ausschließlich `paper-benchmark` deployt, nachdem alle Tests bestanden haben. Das bestehende Repository-Secret `SUPABASE_ACCESS_TOKEN` wird verwendet. Der Workflow übernimmt die bisherige Projekt-ID `pzhfybtoyfttftgcrcxk`; bei einem anderen Projekt vorher anpassen.
5. Die statische Website über den bestehenden Hosting-Workflow veröffentlichen. Der neue Workflow veröffentlicht nur die Supabase-Function, nicht die Website. Danach im Browser neu laden, bei veraltetem Cache mit Strg+F5.
6. Im Dashboard anmelden → Signal- & Verlaufssimulation → **V33 · Fiktives Benchmark-Depot öffnen**.

Falls der neue Workflow nicht erscheint: `.github/workflows/deploy-paper-benchmark.yml` muss auf dem Standardbranch liegen. Bei rotem Lauf den fehlgeschlagenen Schritt öffnen; „exit code 1“ allein ist nicht die Fehlerursache. Zugangstokens nicht als Screenshot oder Log weitergeben.

Alternativ mit vorhandener Supabase CLI:

```sh
supabase functions deploy paper-benchmark --project-ref pzhfybtoyfttftgcrcxk --no-verify-jwt
```

`verify_jwt=false` ist hier beabsichtigt: Der Handler prüft die übermittelte Benutzersitzung mit `auth.getUser()` vor jedem Datenzugriff. Keine anonymen Schreibzugriffe; Service-Schlüssel bleibt serverseitig.

## Erstes Experiment

1. Zunächst aktuelle tägliche OHLCV-Daten bereitstellen. Entweder besteht bereits ein aktueller Kurscache durch eine manuelle Deep-Analyse oder pro Symbol eine eigene CSV importieren.
2. „Neues, unabhängiges Experiment“ öffnen. Zum technischen Einstieg ist `SND.XETRA` vorausgefüllt, keine Kaufempfehlung. Notierung unbedingt beim Kursanbieter prüfen. `SBGSF.XETRA` nicht ungeprüft als Ersatz verwenden: US-OTC- und XETRA-Notierungen sind nicht identisch.
3. 1–3 Symbole derselben Börse, passende Währung (XETRA/EUR oder US/USD), Startkapital und Kosten eintragen. Nur Aktien/ETFs, keine KO-, Faktor- oder anderen Hebelprodukte.
4. „Mit fiktivem Kapital starten“ klicken. Die erste Bewertung ist die Cash-Ausgangsbasis am letzten abgeschlossenen Kurstag; der tatsächliche Startzeitpunkt wird separat angezeigt. Buy-and-Hold wird **vorgemerkt**, nicht rückwirkend gekauft.
5. An folgenden Tagen „Papierdepot aktualisieren“ starten, idealerweise vor der nächsten regulären Börseneröffnung mit bereits verfügbaren Vortagesdaten. Eine heute vorgemerkte Order wird erst anhand einer späteren, vollständig vorliegenden Tageskerze gebucht. Das ist kein Echtzeithandel.
6. Für das KI-Konto im Deep-Modul bei Bedarf manuell Gemini starten. Nur eigene, valide Gemini-Ergebnisse mit Quellenbelegen und höchstens sieben Kalendertagen Alter zählen. Regel-Fallbacks zählen nicht als KI. Bullische KI allein reicht nicht: Auch die Chart-Einstiegsbedingungen müssen erfüllt sein.

## Kosten und Daten

Das neue Modul selbst ruft **keine** KI, keinen Broker und keinen externen Kursdienst auf. Es liest nur vorhandene Kursdaten und eigene Deep-Analysen oder verarbeitet CSV. Bestehende manuelle Deep-Aufrufe unterliegen weiterhin deren Anbieterbedingungen und Kontingenten; eine Abrechnungsfreigabe des Gesamtprojekts wird durch dieses Update weder aktiviert noch geprüft.

CSV: Spalten `date,open,high,low,close,volume`, optional `adjusted_close`, 60–2000 abgeschlossene Tageskerzen, maximal 280 KB je Datei. Je Symbol separat importieren. Nur vom Anbieter bestätigte reguläre Handelstage verwenden, keine Wochenenden oder erfundenen Feiertagskurse. Kursdaten dürfen maximal vier Kalendertage alt sein. Bei mehreren Symbolen müssen die zuletzt vorliegenden Tage und die neu verbuchten Sitzungen übereinstimmen. Importe werden nicht in den gemeinsamen Cache geschrieben und sind nur bis zum Sitzungswechsel/Neuladen verfügbar.

Kostenannahmen: 10 Basispunkte = 0,10 % vom Orderwert, 5 bp Slippage = 0,05 % nachteilige Preisabweichung. Keine festen Mindestgebühren. Modellierte Bruchstücke: sechs Nachkommastellen. Geplanter Stop-Risikobetrag ohne Gebühren; Gaps können darüber hinausgehende Verluste verursachen.

## Handelsregeln

Chart-Einstieg: Score mindestens 40, Kurs über SMA50, RSI14 zwischen 40 und 70, Volumen mindestens 1,2× des vorherigen 20-Tage-Mittels. Score: Trend (40 %), MACD-Momentum (25 %), Donchian-Ausbruch (20 %), RSI (15 %). SMA200 und Bollinger-Bänder werden informativ gezeigt, sind kein zusätzlicher Entry-Filter. Volumenbeschreibung des gemeinsamen Moduls nennt 1,5× für „erhöht“; diese Papierstrategie verwendet explizit 1,2×.

Maximal 20 % Positionsbudget und 0,5 % geplantes Stop-Risiko je Einstieg. Stop anfänglich 2× ATR unter Signalkurs; Ziel 4× ATR darüber. Die zukünftige Eröffnung kann die Stückzahl reduzieren; Eröffnungen außerhalb des geplanten Stop-/Zielkorridors führen zum Auslassen des Einstiegs. Stop nach Tagesschluss nur für spätere Tage nachziehen. Wenn Stop und Ziel innerhalb derselben Tageskerze erreicht werden, gilt der Stop zuerst; Journal markiert die Unsicherheit. Exit bei Score höchstens −25, Kurs unter SMA20 oder mindestens 20 verarbeiteten Sitzungen. Zusätzlich KI-Exit bei einer passenden bärischen KI-These. Solche diskretionären Exits werden erst bei tatsächlicher Aktualisierung vorgemerkt, nicht rückwirkend generiert.

Orders gelten sieben Kalendertage. Ausführung nur an einer Kursdaten-Eröffnung nach dem gespeicherten Orderzeitpunkt (XETRA 09:00 Europe/Berlin, US 09:30 America/New_York, Sommerzeit berücksichtigt). Kein nachträglicher „Bestpreis“. Nicht aktualisierte Zeiträume werden nur mit schon zuvor feststehenden Orders/Stops verarbeitet; fehlende KI-Signale werden nicht nachträglich erfunden. Mehr als 90 neue Sitzungen werden nicht in einem Lauf nachgebucht.

## Vergleich richtig lesen

Buy-and-Hold hält dasselbe, anfangs gleichgewichtete Universum ohne Rebalancing. Es ist **kein unabhängiger Marktindex**. Gebühren, Slippage und Ausführungszeitpunkt folgen denselben Modellannahmen. Das Chart-/KI-Konto darf weniger investieren; Cash-Zeit gehört zur Strategie. Rendite und Drawdown sind netto der modellierten Handelskosten, aber **ohne Dividenden, Steuern, FX, Finanzierung und tatsächliche Ausführungsliquidität**. Deshalb kein Total-Return-Vergleich und keine belegte künftige Überrendite.

Bei Kursrevisionen, erkennbaren Kapitalmaßnahmen oder großen Kurssprüngen wird der Lauf ohne Teilbuchung abgebrochen. Solche Fälle müssen geprüft werden; diese Version verbucht keine Splits oder Dividenden automatisch. Kein nachträgliches Umschreiben der Historie. Ein frisches Experiment beginnt eine neue, getrennte Messreihe.

## Unabhängigkeit und Bedienung

Diese Version wird **manuell per Button** verarbeitet. Keine neue Hintergrundaufgabe, kein Cron, keine automatische Gemini-Nutzung. „Pause“ verhindert weitere Buchungen, löscht aber weder Orders noch Historie. Beim Fortsetzen gelten weiterhin gespeicherte Orders, Ablaufdaten und Stops; nicht mit einer Löschung des Depots verwechseln.

Maximal zehn Experimente pro Benutzer. Konfiguration pro Experiment fest. Eigene Tabellen `paper_portfolios`, `paper_events`, `paper_nav` sind durch Owner-RLS getrennt; Buchungen passieren atomar mit Versionsprüfung. Gleichzeitige Klicks können deshalb nicht doppelt handeln. Ein Journal pro Entscheidung zeigt den damaligen Informationsstand und die verwendete Analyse-ID.

Zum technischen Rückbau nur neue statische Verweise/Panel und die neue Function deaktivieren. Bestehende Module unangetastet lassen; Tabellen nicht löschen, wenn die Historie erhalten bleiben soll.

## Prüfstand

Automatisierte Engine-, tatsächliche Handler- und DOM-Adaptertests plus bestehende Regressionen. Keine Live-Installation in deinem Supabase/GitHub, keine echte Datenbankmigration und keine Live-Browserprüfung durchgeführt. Nach Installation zunächst ein einzelnes Testexperiment mit CSV prüfen. Es gibt keine versprochene Rendite oder kalibrierte KI-Erfolgsquote.
