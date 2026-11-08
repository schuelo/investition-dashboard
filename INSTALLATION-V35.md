# V35.0.0 — WKN-/ISIN-Eingabe für Analyse und EODHD

Stand: 08.11.2026. Dieses ZIP enthält den vollständigen Stand einschließlich der zuvor gelieferten V33-/V34-Erweiterungen. Separate alte Update-ZIPs sind nicht nötig. Ausgangspunkt ist ein bereits eingerichtetes Dashboard mit V31.2/V32 oder neuer; Hinweise für ältere Grundinstallationen stehen unten.

## Installation

1. Das vorhandene Repository sichern. Eigene Änderungen mit diesem Paket vergleichen, insbesondere öffentliche Projektkonfiguration in `supabase.js`, HTML-Anpassungen und `supabase/config.toml`.
2. `investition-dashboard-v35.0.0-komplett.zip` lokal entpacken. Den gesamten Inhalt mit erhaltenen Unterordnern in die Repository-Wurzel übernehmen. `index.html`, `.github`, `supabase` und `tests` müssen direkt dort liegen. Keine zusätzliche ZIP-Oberordnerebene ins Repository kopieren.
3. In Supabase → SQL Editor **`setup-v35-gesamtupdate.sql`** vollständig ausführen. Sie ergänzt V32-/V33-Tabellen soweit erforderlich und die neue WKN-Suche, ohne vorhandene Daten oder Zeitpläne zu löschen. Wenn V34 bereits vollständig installiert ist, ist stattdessen nur **`setup-v35-wkn.sql`** nötig. Nicht beide Varianten erforderlich.
4. In GitHub auf dem Standardbranch speichern/pushen. Dann **Actions → V35 WKN und Gesamtupdate deployen → Run workflow**. Der Workflow prüft Version, SQL-Datei und Tests und deployt `resolve-security`, `analyze-deep-signal` und `paper-benchmark` gemeinsam.
5. Die statische Website über das bisherige GitHub-Pages-/Hosting-Verfahren veröffentlichen. Der neue Workflow veröffentlicht die Supabase-Functions, nicht die Website. Anschließend vollständig neu laden. Die Anmeldeseite muss **Version 35.0.0** anzeigen.

Voraussetzung im Repository: vorhandenes Secret `SUPABASE_ACCESS_TOKEN`. Standardmäßig gilt weiterhin die Projekt-ID `pzhfybtoyfttftgcrcxk`; bei einem anderen Projekt die Repository-Variable `SUPABASE_PROJECT_ID` setzen und die eigene öffentliche Frontend-Konfiguration beibehalten.

Der neue Workflow steht in `.github/workflows/deploy-v35-complete.yml`. Fehlt er in Actions, die Datei samt Ordnerstruktur auf dem Standardbranch prüfen. Bei Fehlern den fehlgeschlagenen Schritt öffnen und die konkrete Meldung lesen.

Die vorhandene V31-Signal-Function und News-/Telegram-Functions werden durch diesen Workflow nicht verändert. Wer bisher erst V29.4/V30 eingerichtet hat, richtet zuerst die enthaltenen V31-Schritte aus `INSTALLATION-V31.md` ein. Für eine vollständig leere Supabase-Datenbank gilt zuerst das bisherige Grundsetup. Die Gesamt-SQL ist eine Erweiterung eines funktionierenden Dashboards, kein vollständiger Ersatz für dessen ursprüngliche Installation.

## Secrets für die neue Suche

- **`EODHD_API_TOKEN`**: vorhandener persönlicher EODHD-Token, serverseitig in Supabase Edge Function Secrets. Der allgemeine Demo-Token funktioniert für den Suchendpunkt nicht. Es wird der vorhandene Tarif verwendet; keine neue Bezahlquelle oder automatische Tarifänderung.
- **`OPENFIGI_API_KEY`**: optional. Die OpenFIGI-Mapping-API funktioniert auch ohne Schlüssel innerhalb ihres Limits. Ein optionaler kostenloser Schlüssel verbessert das Abrufkontingent; für den Start nicht erforderlich.
- **`HYBRID_EODHD_DAILY_BUDGET`**: vorhandene gemeinsame Begrenzung bleibt bestehen. Ohne explizite Einstellung maximal sechs EODHD-Abrufe pro Tag in diesem gemeinsamen Budget; Obergrenze im Code 20. Die WKN-Suche erhöht diesen Wert nicht selbst.

Keine Schlüssel in die HTML-Datei oder in öffentliche GitHub-Dateien eintragen. Die Frontend-Maske ruft nur die eigene authentifizierte Function auf.

## Bedienung

In den Eingabebereichen erscheint **„Wertpapier per WKN / ISIN übernehmen“**:

1. Eine WKN mit sechs Zeichen oder eine gültige ISIN mit zwölf Zeichen eingeben. Führende Nullen bleiben erhalten; die Eingabe ist ein Textfeld.
2. Einen Handelsplatz bevorzugen, etwa Xetra. Dies sortiert beziehungsweise priorisiert die Suche, garantiert aber keinen Treffer an dieser Börse.
3. **Suchen** klicken oder im Suchfeld Enter drücken. Enter startet die Stammdatensuche, keine KI-Analyse.
4. Eine gefundene Notierung mit Name, EODHD-Symbol, Währung und ISIN auswählen.
5. **In dieses Formular übernehmen** klicken. Danach wie gewohnt den Plan speichern oder die Analyse separat manuell starten.

Solange eine eingetragene WKN noch nicht übernommen ist oder gerade gesucht wird, verhindert die Maske den Formularstart mit versehentlich alten Symbolen. **Verwerfen** entfernt nur die Suche und gibt die bisherigen manuellen Felder wieder frei. Bei fehlenden Suchergebnissen bleiben diese manuellen Eingaben möglich.

Die Trefferliste enthält die über die begrenzte Suche gefundenen und anhand von Identifikatoren geprüften Notierungen. Sie ist kein vollständiger Börsenkatalog und keine Bestätigung, dass der gewählte Kursabruf im jeweiligen EODHD-Tarif verfügbar ist. Namensähnlichkeit allein genügt nicht für die Übernahme. Fehlende Identität oder Währung wird als fehlende Zuordnung gemeldet.

## Eingabebereiche

| Bereich | Übernahme |
| --- | --- |
| Trade-Plan / Watchlist | Name, EODHD-Ticker, Währung, Aktien-/ETF-Typ, WKN/ISIN; bei eindeutiger Börsenzuordnung zusätzlich TradingView-Kennung |
| Signal- & Verlaufssimulation | EODHD-Symbol, Unternehmensname und Notierungswährung |
| Deep-Analyse | EODHD-Symbol, Unternehmensname und Notierungswährung |
| Historienfilter | EODHD-Symbol im Symbolfilter; anschließend Historie laden |
| Neues Papierdepot-Experiment | Ein Symbol ersetzen oder bis zu drei hinzufügen, passende Währung; laufende Experimente behalten ihre Konfiguration |
| Papierdepot-CSV | Symbolzuordnung der nächsten CSV-Datei; kein Kursabruf oder Import allein durch die WKN-Übernahme |
| Eventanalyse | Wertpapiername, EODHD-Symbol, ISIN und gegebenenfalls WKN an den vorhandenen Ereignistext anhängen |

Portfolio-/Entscheidungsbereiche, die einen bereits gespeicherten Trade-Plan auswählen, verwenden dessen Kennungen weiter. Den Wert dort zunächst im Trade-Plan per WKN anlegen beziehungsweise korrigieren und anschließend auswählen. Die Suche selbst erzeugt keine neue reale Depotposition.

## Handelsplatz, Währung und Chart

Bei mehreren passenden Notierungen wählst du die tatsächlich gewünschte aus. Eine EUR-Notierung und eine USD-Notierung können dieselbe Aktie repräsentieren, haben aber unterschiedliche Kursreihen und Währungen. Die Auswahl setzt die Währung aus den Katalogdaten; sie rechnet keine Kurse oder bestehenden Geldbeträge um.

Für bekannte Börsenpaare wird die Chartkennung abgeleitet, etwa `SND.XETRA` → `XETR:SND`. Der EODHD-Sammelcode `US` sagt dagegen nicht, ob TradingView NASDAQ, NYSE, AMEX oder OTC benötigt. In diesem Fall zeigt die Trade-Plan-Maske eine gezielte Auswahl. Für andere nicht eindeutig zugeordnete Börsen kann eine bestätigte TradingView-Kennung eingegeben werden. Die Auswahl bestätigt nur deine Eingabe; sie ist keine zusätzliche Prüfung des TradingView-Anbieters.

Die vorhandene Analyse unterstützt EUR, USD, GBP, GBX, CHF, JPY, KRW, CNY, HKD, SEK, AUD, CAD und INR. Andere Notierungswährungen können in Trade-Plänen erfasst werden, werden aber nicht als unterstützte Analysewährung umetikettiert. GBp aus dem Katalog wird als GBX behandelt, nicht als GBP. Das Papierdepot bleibt auf XETRA/EUR oder US/USD und eine gemeinsame Börse je Experiment beschränkt.

## Wertpapierwechsel und Produktdaten

Die Übernahme ändert zunächst nur ungespeicherte Formularfelder. Bei geändertem Wertpapier oder geänderter Notierungswährung werden im Trade-Plan vorherige Referenzkurse, Ein-/Ausstiegsmarken und Ordermengen geleert. So bleiben keine Kursmarken des alten Wertes im neuen Plan stehen. Bei unveränderter Identität und Währung bleiben diese Angaben erhalten.

In der Deep-Analyse werden beim Wechsel außerdem bisherige EPS-/CIK- und Produktannahmen sowie FX-Bestätigungen zurückgesetzt. Die globale Kapitalangabe, eigene These und eigene URLs bleiben erhalten und müssen auf Bezug zum neuen Wertpapier geprüft werden. Frühere, ausgewählte Analysen eines anderen Symbols können weiterhin den Start blockieren und sind dann aus der Auswahl zu entfernen. Die bestehenden Symbolwechsel-Listener verwerfen wie bisher symbolgebundene CSV-/Triggerkontexte.

Die neue Auflösung ist auf verfügbare Aktien-/ETF-/Fondsidentitäten beschränkt. **KO-/Hebelprodukte werden nicht automatisch in ihren Basiswert übersetzt.** In einem KO-Trade-Plan befüllt die Suche oben den Basiswert. Produkt-WKN, Produkt-ISIN, Emittent, Barriere und Bezugsverhältnis bleiben gesonderte Angaben; bei Basiswertwechsel werden alte Produktdaten geleert. Auch das separate Produktreferenzfeld der Deep-Analyse bleibt manuell. Für Anleihen, Indizes oder andere nicht abgedeckte WKNs wird keine vermeintlich passende Aktie eingesetzt.

## Kontingente und Zwischenspeicherung

Die Suche benötigt keinen Gemini-Aufruf. Eine neue WKN-Zuordnung verwendet OpenFIGI für die WKN-Identität, normalerweise eine EODHD-Suche und eine OpenFIGI-ISIN-Gegenprüfung. Wenn der bevorzugte Handelsplatz noch fehlt, ist höchstens eine zweite EODHD-Suchabfrage vorgesehen. Jede EODHD-Abfrage wird zuvor aus dem bestehenden gemeinsamen Tagesbudget reserviert. Bei erschöpftem Budget werden bereits verifizierte Teiltreffer mit Hinweis angezeigt oder die Suche mit einer klaren Meldung abgebrochen.

ISIN-Eingaben werden direkt über eine exakte ISIN-Zuordnung im EODHD-Suchergebnis geprüft. Ergebnisse werden sieben Tage je Benutzer, Kennung und Handelsplatzpräferenz gespeichert. Ein erneuter Aufruf desselben Ergebnisses, auch aus einem anderen Formular, verbraucht keine neue Anbieterabfrage. Ein anderer bevorzugter Handelsplatz kann eine neue Suche auslösen.

Zusätzlich höchstens 20 neue Suchversuche pro Benutzer und UTC-Tag, drei Sekunden Abstand zwischen neuen Suchen. Anbieterlimits bleiben davon unabhängig bestehen. Bei Fehlern gibt es weder automatisches kostenpflichtiges Fallback noch automatische Wiederholungen oder KI-Ticker-Schätzungen. Ein erreichter Tarif- oder Suchlimitfehler führt zu einer Meldung.

## Technischer Stand und Prüfung

Neue eigenständige Function `resolve-security`, eigene Tabellen `security_lookup_cache` und `security_lookup_usage`, Owner-RLS und serverseitig geprüfte Benutzersitzung. Die Suchfunktion schreibt ausschließlich ihre Referenzdaten, keine Trades, Positionen oder Analysen. Bestehende Analyse- und Handelsalgorithmen bleiben erhalten; in alten Analyse-Dateien wurden nur Release-Kennungen aktualisiert.

273 automatisierte Tests bestanden. Darunter Identitätsabgleich, getrennte Aktien-/Fonds-Anteilsklassen, gleichlautende Ticker verschiedener Emittenten, Börsen-/Währungszuordnung, Kontingentschutz, Benutzerisolation, Formularübernahme, Enter-/Doppelklickverhalten und Sitzungswechsel. Tests für HTTP-/Datenbankzugriffe und DOM verwenden kontrollierte Adapter.

Noch nicht durchgeführt: echtes GitHub-/Supabase-Deployment, Ausführung der neuen SQL im Zielprojekt, Live-Anbieterabfragen mit deinem Token und Live-Browserprüfung. Nach Installation eine bekannte eigene WKN suchen, die Notierung prüfen, in eine Analyse übernehmen und anschließend einen manuellen Testlauf starten.

Offizielle Referenzen der Umsetzung:

- [OpenFIGI Mapping API, WKN-Typ ID_WERTPAPIER und Limits](https://www.openfigi.com/api/documentation)
- [EODHD Search API, ISIN, Währung und Free-Plan-Verfügbarkeit](https://eodhd.com/financial-apis/search-api-for-stocks-etfs-mutual-funds)

Die vorherige URL-Analyse bleibt enthalten; für deren Bedienung gilt weiterhin der passende Abschnitt aus `INSTALLATION-V34.md`. Für die Installation dieses Gesamtpakets ausschließlich die V35-Schritte oben verwenden.
