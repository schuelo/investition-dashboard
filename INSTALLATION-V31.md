# V31.2 – TRIGGER KI und manueller Gemini-Start

Dieses vollständige Paket basiert auf dem originalen **V29.4 + V30.1.1 Deployment-Fix**. Ein gesonderter Originalstand vom 09.10.2026 war nicht verfügbar. Das Paket wurde nicht produktiv installiert.

Das neue Modul zeigt News-Ableitungen, angewendete Charttechniken, simulierte Kursverläufe und bedingte Ein-/Ausstiegsschwellen. **Die KI startet ausschließlich über den Startknopf im Dashboard.**

Die bisherigen Funktionen bleiben erhalten. Die einzige fachliche Änderung am bestehenden News-Bot ist eine Ergänzung derselben Telegram-Meldung: **TRIGGER KI** und ein Button zur Vorbereitung der Analyse. Empfänger, Portfolioabgleich, Filter, Zeitfenster, Duplikatsprüfung und Versandplan bleiben bestehen. Der Button selbst verbraucht kein Gemini-Kontingent.

## Installation bei vorhandenem V29.4 / V30.x

1. Das bestehende Repository sichern und das ZIP vollständig entpacken. Den **Inhalt** des Paketordners in die lokale Repository-Wurzel kopieren und vorhandene Dateien ersetzen. `index.html`, `supabase/`, `tests/` und `.github/` müssen dort direkt liegen. Den umschließenden ZIP-Ordner nicht als zusätzliche Ebene übernehmen.
2. In **GitHub Desktop** das lokale Repository öffnen, die Änderungen committen und **Push origin** wählen. GitHub übernimmt dabei alle enthaltenen Dateien und Unterordner. Keine API-Schlüssel in Repository-Dateien eintragen.
3. Im **Supabase SQL Editor** diese beiden Dateien nacheinander ausführen:

   1. `setup-v31-signal-simulation.sql`
   2. `setup-v31-2-manual-triggers.sql`

   Beide ergänzen ausschließlich eigene Modultabellen, RLS-Regeln und eigene Budget-/Triggerfunktionen. Bestehende V29.4-/V30-SQLs und Cronjobs nicht erneut einrichten. Bei einem Update von V31.0/V31.1 ebenfalls beide Dateien ausführen; gespeicherte Simulationen bleiben bestehen. Frühere Feedregeln lösen keine Analysen mehr aus und werden nicht verwendet.
4. Unter **Supabase → Edge Functions → Secrets** Gemini einrichten, siehe nächster Abschnitt. Den vorhandenen EODHD-Schlüssel und die bisherigen Telegram-/Supabase-Secrets weiterverwenden.
5. In **GitHub → Actions → V31.2 TRIGGER KI deployen → Run workflow** den Branch `main` wählen. Der Workflow führt zuerst die Tests aus und deployt anschließend:

   - `analyze-signal-path`: neues, manuell aufgerufenes Modul;
   - `send-news-alerts`: bisheriger News-Bot mit ergänzter Telegram-Meldung.

   Der Workflow benötigt das bestehende GitHub Secret `SUPABASE_ACCESS_TOKEN`. Die Projekt-ID im Workflow ist `pzhfybtoyfttftgcrcxk`; nur bei einem anderen Supabase-Projekt entsprechend ersetzen. Der bisherige Deploymentworkflow bleibt erhalten.
6. GitHub Pages wie bisher veröffentlichen. Danach [Reset V31.2](https://schuelo.github.io/investition-dashboard/reset.html?v=31.2) öffnen und erneut anmelden. Bei einer anderen Pages-Adresse deren `reset.html?v=31.2` verwenden.
7. **Signal- & Verlaufssimulation** öffnen. Mit **Synthetische Demo** lässt sich die Oberfläche ohne Anbieteraufrufe prüfen. Anschließend einen realen Wert ausdrücklich manuell analysieren.

Voraussetzung sind die vorhandenen V29.4-Basistabellen, veröffentlichte `market_news` und die Budgetfunktion `reserve_hybrid_eodhd_calls`. Das Signalmodul benötigt die V30-Eventanalyse nicht. Deren bisherige Einrichtung ist separat in `INSTALLATION-V29.4-V30.md` beschrieben.

## Gemini ohne Billing einrichten

1. [Google AI Studio – API keys](https://aistudio.google.com/api-keys) öffnen und anmelden.
2. **Create API key / API-Schlüssel erstellen** wählen. Ein Projekt mit Tarif **Free / Free Tier** und ohne verknüpftes Billing-Konto verwenden. **Set up billing** nicht aktivieren.
3. Einen verfügbaren kostenlosen Gemini-Textmodellnamen mit Structured Outputs wählen. Stand der Dokumentationsprüfung am 11.10.2026: `gemini-3.5-flash-lite`. Modellzugang und tatsächliche Limits im eigenen AI-Studio-Projekt prüfen.
4. Diese drei Werte ausschließlich in **Supabase Secrets** speichern:

| Secret | Wert |
| --- | --- |
| `SIGNAL_AI_PROVIDER` | `gemini` |
| `GEMINI_API_KEY` | API-Schlüssel aus dem Free-Tier-Projekt ohne Billing |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` oder ein anderes im Projekt verfügbares Textmodell mit Structured Outputs |

Zusätzliche bzw. bereits vorhandene Einstellungen:

| Secret | Verwendung |
| --- | --- |
| `EODHD_API_TOKEN` | Vorhandener Schlüssel für Tageskurse |
| `TELEGRAM_BOT_TOKEN` | Vorhandener Schlüssel des News-Bots |
| `CRON_SECRET` | Vorhandener Zugriffsschutz der bisherigen Hintergrundfunktionen |
| `SIGNAL_DASHBOARD_URL` | Optional: eigene HTTPS-Dashboardadresse. Standard: `https://schuelo.github.io/investition-dashboard/` |
| `HYBRID_EODHD_DAILY_BUDGET` | Bestehendes gemeinsames Kursdatenkontingent beibehalten; Standard 6, maximal 20 |

Die üblichen Supabase-Secrets werden wie bisher verwendet. `OPENAI_API_KEY` und `OPENAI_MODEL` sind für Gemini nicht erforderlich. Auch wenn diese bereits vorhanden sind, werden sie bei `SIGNAL_AI_PROVIDER=gemini` nicht verwendet. Der Code erkennt den Tarif eines Google-Schlüssels nicht; die Nutzung ohne Billing setzt das entsprechend eingerichtete Free-Tier-Projekt voraus.

Bei einem Kontingentfehler erfolgt genau ein Gemini-Versuch und anschließend eine sichtbar gekennzeichnete Chartberechnung. Es gibt keine automatischen Wiederholungen oder Anbieterwechsel. Mit `SIGNAL_AI_PROVIDER=none` lässt sich die KI serverseitig abschalten. Die bisherige optionale OpenAI-Anbindung bleibt bei ausdrücklicher Auswahl `openai` verfügbar.

## Ablauf einer TRIGGER-KI-Meldung

Der News-Bot ergänzt ausschließlich Portfolio-News, die er ohnehin versenden würde. Weiterhin gelten: Telegram aktiviert, vorhandene Chat-ID, offene betroffene Position, veröffentlichte Meldung aus den letzten 8 Stunden mit Impact `mittel` oder `hoch`, Relevanz mindestens 70 **oder** Dringlichkeit mindestens 65 und kein vorhandener Versandeintrag. Die ursprünglichen Regeln zur Wertzuordnung und fehlenden Scores bleiben erhalten.

Die bisherige Meldung einschließlich Quelle bleibt erhalten. Angefügter Text:

```text
🔔 TRIGGER KI
News + Charttechniken, Verlauf und Ein-/Ausstiege prüfen.
KI-Analyse im Dashboard manuell starten.
```

1. Den Telegram-Button **TRIGGER KI · Analyse öffnen** wählen.
2. Falls nötig im Dashboard anmelden. Das Modul bereitet die Originalmeldung und bekannte Basiswerte vor; die KI läuft noch nicht.
3. Basiswert, Handelsplatz und Notierungswährung bestätigen. Sind mehrere Positionen betroffen, den gewünschten Basiswert auswählen. Bei einem KO-Produkt wird dessen Währung nicht als Basiswertwährung übernommen.
4. **KI-Analyse manuell starten** drücken. Erst jetzt werden Kursdaten geprüft und gegebenenfalls Gemini aufgerufen.
5. Im Ergebnis Newsquellen, tatsächlich aktiven KI-Anbieter, Modell, Chartbefunde, simulierte Verläufe sowie bedingte Einstieg-, Stop- und Gewinnmarken ansehen.

Die eigene **TRIGGER-KI-Liste** enthält die zugestellten Meldungen. **Analyse vorbereiten** setzt nur die Eingaben; **Zurückstellen** ändert nur den eigenen Triggerstatus. Eine erfolgreich gespeicherte Gemini-Analyse mit enthaltener Originalmeldung markiert den Trigger als analysiert. Bei Chartmodus, Anbieterfehler, abgelaufener Originalmeldung oder fehlender Historien-Speicherung bleibt diese Bestätigung aus.

Bereits vor dem Update versendete Meldungen werden nicht erneut versendet. Es gibt keine zusätzlichen Telegram-Nachrichten, keine neuen Empfänger, keinen neuen Cronjob und keinen automatischen KI-Start beim Laden der Seite, Login oder Feedupdate. Wenn die neue Triggerliste nicht verfügbar ist, bleibt der ursprüngliche Telegram-Versand möglich; der Button verweist dann direkt auf die veröffentlichte News-Meldung.

## Analyse ohne Telegram-Meldung

Ein EODHD-Symbol einschließlich Handelsplatz eingeben, etwa `NVDA.US` oder `SAP.XETRA`, sowie die Notierungswährung bestätigen. TradingView-Symbole wie `NASDAQ:NVDA` werden nicht automatisch umgewandelt. Optional Unternehmensname oder eine Nachrichtenthese ergänzen, 5, 20 oder 60 Handelstage wählen und ausdrücklich starten.

**Ausgewählte Aktie übernehmen** liest die Auswahl der bisherigen Trading-Analyse. Auch beliebige andere Werte lassen sich analysieren. Ergebnisse werden ausschließlich in der eigenen Historie gespeichert und nicht in Depot oder Trade-Pläne übernommen.

OHLCV-CSV-Dateien können als Kursbasis dienen. Mit ausgeschalteter KI läuft die Berechnung lokal; sie verbraucht keine Gemini- oder EODHD-Aufrufe und wird nicht in der Cloudhistorie gespeichert. Die synthetische Demo zeigt ausschließlich künstliche Kurse.

## Charttechniken und simulierte Verläufe

Jede Technik zeigt Parameter, berechnete Werte, Befund, Zweck und Grenzen:

| Technik | Parameter | Verwendung |
| --- | --- | --- |
| SMA | 20 / 50 / optional 200 Tage | Trend |
| MACD | EMA12 − EMA26, EMA9 als Signal | Momentum |
| RSI | 14, Wilder-Glättung | Überdehnung |
| ATR | 14, True Range inklusive Gaps | Stopabstand und Puffer |
| Bollinger | SMA20 ± 2 Standardabweichungen | Schwankungsband |
| Donchian | Vorherige 20 Kerzen | Unterstützung / Widerstand |
| Volumen | Letzte Kerze / vorherige 20; Bestätigung ab 1,5× | Ausbruchsbestätigung |

Die KI erhält geprüfte Newsquellen und diese berechneten Chartdaten. Die Kursverläufe entstehen aus 800 reproduzierbaren Block-Bootstrap-Pfaden. Angezeigt werden P10–P90, P50 und drei illustrative Szenarien. Diese Modellquantile sind keine gemessenen Eintrittswahrscheinlichkeiten von Nachrichtenereignissen.

Standardmäßig beeinflusst die KI die Newsbewertung und die Einordnung der Handelsschwellen. Die zusätzliche Option **KI-Richtung als Newsimpuls** ist ausgeschaltet; sie übernimmt erst nach ausdrücklicher Auswahl eine begrenzte, über 5 Handelstage abklingende KI-Annahme in die Pfade. Parameter und Seed bleiben sichtbar. Es gibt keine nachgewiesene Prognosegüte oder Erfolgsquote.

## Bedingte Ein-/Ausstiegsschwellen

- Long-Einstieg über dem größeren Wert aus Schlusskurs / Widerstand plus 0,25 ATR; Short unter dem kleineren Wert aus Schlusskurs / Unterstützung minus 0,25 ATR.
- Stop jenseits der Gegenzone und mindestens 1,5 ATR vom Einstieg entfernt.
- Ziel 1 = 2R, Ziel 2 = 3R; R ist der Abstand zum Stop. Teilgewinn, nachlaufenden 2-ATR-Stop und Zeitstopp am gewählten Horizont prüfen.
- Die Schwellen sind bedingte Kandidaten. Ein Einstieg erfordert passende Chartbefunde, bestätigten Tages-Schlusskurs und Volumen. News-/Chartwiderspruch führt zu Abwarten.
- Veraltete Kurse über 7 Kalendertage, ungeklärte extreme Sprünge, fehlende Volatilität oder Stoprisiko über 15 % sperren Handelsschwellen.
- Marken beziehen sich auf den Basiswert. KO-Produkte, Hebel, Produktpreise, Gebühren und Slippage werden nicht simuliert.

## Daten und Kontingente

Mindestens 60 abgeschlossene Tageskerzen mit Open, High, Low und Close sind erforderlich; für SMA200 mindestens 200. Heutige, zukünftige, doppelte oder ungültige Kerzen werden ausgeschlossen bzw. zurückgewiesen. Historische OHLC-Kurse werden mit `adjusted_close` auf die jüngste Rohkursbasis angepasst.

Zuerst wird der eigene OHLCV-Cache genutzt. Der bisherige V29.4-Cache wird ausschließlich gelesen. Reine Schlusskurse werden nicht zu OHLC-Kerzen ergänzt. EODHD-Abrufe verwenden das vorhandene gemeinsame Tagesbudget; CSV bleibt eine Alternative.

Bis zu 12 deduplizierte, veröffentlichte Newsquellen der letzten 14 Tage werden verwendet. Die ausgewählte Originalmeldung hat Vorrang und wird ausdrücklich als manuell ausgewählt gekennzeichnet; ein direkter Symbolbezug wird dadurch nicht behauptet. Ohne passende aktuelle Quellen gibt es keinen KI-Aufruf. Ungültige oder unbelegte KI-Antworten werden verworfen.

Zusätzlich zum Gemini-Kontingent gelten maximal **20 serverseitige Analyseversuche je Nutzer und UTC-Tag**. Fehlgeschlagene Anbieterabrufe und Chartmodus zählen nach Reservierung ebenfalls. Ohne manuelle Startkennzeichnung weist die neue Function KI-Anfragen bereits vor der Budgetreservierung zurück.

## Inbetriebnahme prüfen

1. Alte Dashboardbereiche und synthetische Demo öffnen.
2. Eine nächste reguläre Portfolio-News abwarten: genau eine bisherige Telegram-Meldung, ergänzt um TRIGGER KI und den Button.
3. Button öffnen, anmelden und warten: Eingaben werden vorbereitet; kein Gemini-Aufruf.
4. Basiswert/Währung bestätigen und manuell starten: bei verfügbaren aktuellen News und richtigem Schlüssel **Gemini + Chartberechnung** sowie den Modellnamen erwarten.
5. Feed aktualisieren und die Modulseite erneut öffnen: keine selbsttätige Analyse. Bei Kontingentfehlern Chartmodus und Warnung erwarten.
6. Beim Livecheck Kursdatum, Datenanbieter, Quellen und eigene Historie prüfen. Vorhandene Telegram-Deduplizierung und alte Funktionen wie bisher kontrollieren.

Lokale Tests ersetzen diesen Livecheck nicht. Es wurden keine produktiven Schlüssel verwendet, Live-Nachrichten verschickt, SQL-Migrationen ausgeführt oder Functions deployt. DOM-/Handler-Tests ersetzen keine visuelle Prüfung im Browser.

## Deployment-Abbruch: „Standalone-Seite darf im integrierten Paket nicht nötig sein“

Ursache ist eine noch vorhandene `event-analysis.html` aus einer früheren Version. Der ursprüngliche Pakettest hat deren bloße Existenz unnötig als Fehler bewertet. Die korrigierte Prüfung erlaubt die verbliebene Datei und kontrolliert weiterhin, dass die aktuelle Oberfläche ihre Eventanalyse über die integrierte Navigation öffnet.

Nur `tests/package-consistency.test.mjs` durch die korrigierte Datei aus diesem Paket ersetzen und in GitHub committen/pushen. Danach unter Actions **V31.2 TRIGGER KI deployen → Run workflow → main** einen neuen Lauf starten. Ein erneuter Lauf des alten fehlgeschlagenen Commits verwendet noch den alten Test. SQL und Secrets sind für diese Testkorrektur nicht erneut einzurichten. Die alte HTML-Datei muss nicht gelöscht werden.

## Technische Quellen

- [Gemini: Billing / Free Tier](https://ai.google.dev/gemini-api/docs/billing)
- [Gemini: aktuelle Preise](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini: Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini: API-Schlüssel](https://ai.google.dev/gemini-api/docs/api-key)
- [Gemini: 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
- [Gemini: GenerateContent](https://ai.google.dev/api/generate-content)
- [Telegram: SendMessage / InlineKeyboard](https://core.telegram.org/bots/api)
- [Supabase: Function Secrets](https://supabase.com/docs/guides/functions/secrets)
- [EODHD: Historical OHLCV](https://eodhd.com/financial-apis/api-for-historical-data-and-volumes)

## Rückkehr zur Ausgangsversion

Das gesicherte V29.4-/V30.1.1-Frontend und die ursprüngliche `send-news-alerts`-Function wiederherstellen. Die neuen Modultabellen können bestehen bleiben; sie führen keine Hintergrundarbeit aus. Bestehende Tabellen und Cronjobs nicht löschen.
