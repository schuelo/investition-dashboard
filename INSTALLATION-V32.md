# V32.0 – Deep-Analyse installieren

V32 ergänzt den vollständigen V31.2-Stand um ein eigenes Modul. Der vorhandene News-Bot und alle bisherigen Analyse-/Portfoliofunktionen sind gegenüber V31.2 unverändert. Telegram behält **TRIGGER KI**; keine zusätzlichen Empfänger, Versandbedingungen oder Zeitpläne.

Das Paket ist vorbereitet und lokal geprüft, aber noch nicht in deinem GitHub-/Supabase-Projekt installiert.

## 1. Dateien mit Unterordnern übernehmen

1. ZIP vollständig entpacken.
2. In GitHub Desktop das Repository **schuelo/investition-dashboard** öffnen. Über **Repository → Show in Explorer/Finder** den lokalen Ordner anzeigen.
3. Den **Inhalt** des entpackten Paketordners in die Repository-Wurzel kopieren und vorhandene Dateien ersetzen. Den umschließenden Paketordner nicht als zusätzliche Ebene kopieren.
4. Prüfen: index.html, deep-analysis.js, deep-analysis.css, setup-v32-deep-analysis.sql, supabase/, tests/ und .github/workflows/ liegen direkt in der Repository-Wurzel.
5. In GitHub Desktop **Commit to main** und **Push origin** wählen. Dateien und Unterordner werden automatisch übernommen.

Die entpackten Dateien hochladen, nicht die ZIP-Datei an ihrer Stelle. Den versteckten Ordner .github mitkopieren; unter Windows ggf. „Ausgeblendete Elemente“ einschalten. Vorhandene persönliche Dateien nicht löschen.

## 2. Datenbank ergänzen

Im [Supabase SQL Editor](https://supabase.com/dashboard/project/pzhfybtoyfttftgcrcxk/sql/new) den vollständigen Inhalt von **setup-v32-deep-analysis.sql** einfügen und **Run** wählen.

Wenn V31.2 bereits funktioniert, reicht diese neue Datei. Bei Erstinstallation von V29.4/30.x zuerst in dieser Reihenfolge:

1. setup-v31-signal-simulation.sql
2. setup-v31-2-manual-triggers.sql
3. setup-v32-deep-analysis.sql

Ältere Setup-Dateien und Cronjobs nicht erneut einrichten. V32 fügt eigene Tabellen/Rechte/Hilfsfunktionen hinzu. Originalanalysen können nicht überschrieben werden; Notizen und Auswertungen sind separate Datensätze.

## 3. Gemini ohne neues Billing

Unter **Supabase → Edge Functions → Secrets**:

| Name | Wert / Zweck |
|---|---|
| GEMINI_API_KEY | Vorhandener Gemini-Schlüssel aus einem Projekt ohne aktiviertes Billing |
| DEEP_GEMINI_MODEL | gemini-3.5-flash-lite |
| DEEP_GEMINI_FREE_TIER_CONFIRMED | true – erst nach Prüfung des kostenlosen API-Tarifs und deaktivierten Billings |
| EODHD_API_TOKEN | Vorhandener kostenloser EODHD-Schlüssel; alternativ CSV-Kursimport |
| SEC_USER_AGENT | Optional: InvestitionDashboard dein.name@example.com mit deiner tatsächlichen Kontakt-E-Mail |

**gemini-3.1-flash-lite** ist ebenfalls explizit zugelassen. Andere Modelle werden im neuen Modul abgewiesen. Keine automatischen Wiederholungen, Modell-/OpenAI-Wechsel oder Google-Search-Grounding. Die Recherche nutzt separate öffentliche RSS-Suchtreffer.

Der Code kann den Google-Abrechnungstarif nicht aus dem Schlüssel erkennen. Die Bestätigung ist eine Betreiberangabe. Ohne Bestätigung oder bei Kontingentfehlern bleibt die Regelanalyse verfügbar. Kostenfreiheit setzt außerdem voraus, dass die bestehenden Hosting-/Datenbankdienste in ihren kostenlosen Kontingenten bleiben.

V31-Secrets bleiben gültig. Für dessen bisherigen Bereich weiterhin **SIGNAL_AI_PROVIDER=gemini** und **GEMINI_MODEL=gemini-3.5-flash-lite** verwenden, falls er ebenfalls kostenlos über Gemini laufen soll. V32 verändert dessen Konfiguration nicht.

API-Schlüssel ausschließlich in Supabase-Secrets, niemals in Browserdateien oder GitHub-Commits eintragen. Supabase stellt seine Auth-/Service-Secrets selbst bereit.

## 4. Neues Modul deployen

1. [GitHub Repository](https://github.com/schuelo/investition-dashboard) öffnen.
2. **Settings → Secrets and variables → Actions → Repository secrets**: SUPABASE_ACCESS_TOKEN muss einen gültigen persönlichen Supabase-Zugriffstoken enthalten. Gemini-/EODHD-/Anon-Keys sind dafür nicht geeignet.
3. **Actions → V32.0 Deep-Analyse deployen → Run workflow**.
4. Branch **main** wählen und starten.

Der Workflow prüft das Paket und deployt ausschließlich **analyze-deep-signal** in das Projekt **pzhfybtoyfttftgcrcxk**. Wenn V31 noch fehlt, zuerst dessen Workflow **V31.2 TRIGGER KI deployen** ausführen, dann V32. Bei funktionierendem V31 nur den neuen Workflow starten.

V32 verwendet Node 24 und Checkout/Setup-Node v6. Obwohl die Plattform-JWT-Prüfung deaktiviert ist, prüft der Handler den Bearer-Token mit auth.getUser() vor jedem Datenzugriff. Anonyme Anfragen werden abgewiesen.

Alternative mit eingerichteter Supabase CLI, aus der Repository-Wurzel:

    supabase functions deploy analyze-deep-signal --project-ref pzhfybtoyfttftgcrcxk --no-verify-jwt

## 5. Erster Start

GitHub Pages wie bisher veröffentlichen lassen. Dashboard mit **Strg+F5** hart aktualisieren und anmelden:

[Dashboard – Signalanalyse](https://schuelo.github.io/investition-dashboard/#signals)

1. **V32 · Deep-Analyse öffnen** wählen.
2. **Synthetische Demo** testen. Keine echten Kurse, API oder Gemini-Kontingent.
3. Symbol mit Handelsplatz, Basiswertwährung und Unternehmensname eingeben.
4. Prognosehorizont, Kursrückblick und Nachrichtenfenster separat wählen.
5. Optional **TRIGGER KI**-Meldung auswählen, CSV importieren und Risikobudget/Produktdaten ergänzen.
6. **Deep-Analyse manuell starten** drücken. Erst dieser Schritt kann Gemini aufrufen.
7. Bericht, tatsächlich aktiven Modus und Quellen prüfen. **Historie laden** muss das gespeicherte Original anzeigen.

Telegram-Links bereiten nur die Ausgangsmeldung vor. Im V32-Bericht wird sie dokumentiert; der vorhandene V31-Triggerstatus wird dadurch nicht geändert. Anmeldung, Newsupdates, Historienöffnung und Vergleich starten keine KI.

## Enthaltene Erweiterungen

| Bereich | Umsetzung |
|---|---|
| Zeitfenster | 5/20/60/120/252 prognostizierte Handelstage; 60–2000 historische Tageskerzen; 3/7/14/30/90 Kalendertage Nachrichten |
| Charts | SMA20/50/200, MACD, RSI, ATR, Bollinger, Donchian, Volumen mit Befund/Zweck/Grenzen; vollständige Wochen separat |
| Szenarien | Basis, positive/negative Überraschung, Seitwärts, Rücksetzer mit Erholung, Gap/Stress; eigene Pfade, Modellbänder und Prüfkriterien |
| Modellvergleich | Technik-Bootstrap, driftfreier Bootstrap, manuelle Ereignisannahme, EPS/Multiple; gemeinsame Datenfamilien sichtbar |
| Historien | OHLCV und nicht überlappende historische Chartähnlichkeiten; keine behaupteten News-Kausalitäten |
| Bewertung | EPS/Wachstum/Multiple, implizierte Erwartungen und Sensitivitätsmatrix; keine erfundenen Konsenszahlen |
| Quellen | Automatisches Register gefundener URLs/Metadaten, kurze gelesene Feed-Auszüge und SEC-Primärdaten; unveränderte Snapshots im Original |
| Experteneinstiege | SEC, NYU/Damodaran, IEA, WSTS, Oaktree, FRED/ALFRED; Suchlinks sind ausdrücklich keine gelesenen Expertenmeinungen |
| SEC | Optional Jahres-EPS/Umsatz über XBRL bei geprüfter US-CIK/User-Agent; Einheiten und Einreichungsdaten sichtbar |
| Risiko | Bedingte Einstiege/Stops/Ziele, Abwarten, Budget, Gebühren/Slippage, FX und manuell angegebenes Exposure einer Risikogruppe |
| Produkte | KO-Berührung über den gesamten Pfad, Finanzierung/Spread/Beobachtung und Reverse-Stress; täglicher Faktor-Reset; europäische Optionspreise/Greeks/IV-Sensitivität |
| Analysehistorie | Symbol-/Modus-/Datumsfilter, 20 Einträge je Seite, bis zu fünf eigene frühere Analysen als KI-Kontext, Vergleich, separate Notizen, JSON-Export |
| Änderungsprüfung | Kurs-/Chartscore-/Bias-/Quellenvergleich, neue Prüfpunkte mit TRIGGER KI im Bericht |
| Prognosejournal | Manuelle spätere Auswertung ohne KI; gleicher Horizont/Kosten für hypothetische KI-/Regel-/Buy-Hold-Richtungsbenchmarks |

## Grenzen der kostenlosen ersten Version

- EODHD-Abfrage höchstens ein Jahr Tagesdaten. Längere Historien per CSV; fehlende Daten werden angezeigt. Die Auswahl „5 Jahre“ erzeugt keine nicht verfügbaren Preise.
- RSS-Suchtreffer werden als Metadaten gespeichert. Gemini nutzt gelesene Feed-Auszüge und SEC-Zahlen. Ohne solche Belege wird kein KI-Aufruf verbraucht. Keine Paywall-Umgehung oder automatische Auswertung von Experten-PDFs.
- FRED/ALFRED, Damodaran und Branchenberichte sind Rechercheeinstiege; ihre vollständigen Tabellen/Zeitreihen werden nicht automatisch importiert. Automatische Analystenkonsens-/Revisionsdaten und historische News-Ereignisvergleiche sind nicht enthalten.
- Risikogruppen, Exposure, FX-/Produkt-/IV-Daten sind Nutzereingaben. Keine automatische Korrelationsmatrix, Live-Emittentenpreise oder vollständige Optionskette.
- Wochenmethoden brauchen 60 vollständige Wochen, Wochen-SMA200 braucht 200 Wochen. Kurze kostenlose Historien liefern diese Bestätigung nicht.
- Ereignisschocks, Bewertung und Barrierenfortschreibung sind explizite Annahmen. Modellquantile, KO-Modellhäufigkeiten und KI-Vertrauen sind keine kalibrierten Wahrscheinlichkeiten.
- Tages-Hoch/Tief liefert keine sichere Intraday-Reihenfolge. KO-Beobachtung außerhalb der vorhandenen Börsenkerzen, Sonderbedingungen, Emittentenausfälle und Handelsunterbrechungen sind nicht vollständig modelliert. Unbestätigte Produktbedingungen sperren die Produktentscheidung.
- Optionsmodell für europäische Vanilla-Auszahlung und konstante IV. Faktorprodukte enthalten keinen vollständigen untertägigen Emittenten-Reset.
- Journal ist Beobachtungshilfe, kein unabhängiger Strategiebeweis. Mehrfachauswertungen werden je Analyse einmal gezählt; KI-Mittelwerte nur aus vorhandenen KI-Ergebnissen. Analysen können sich zeitlich überlappen.
- Keine Orders. Ein Stop garantiert keinen Maximalverlust.

## Spätere Auswertung

Original aus Historie öffnen und **Verlauf jetzt auswerten (ohne KI)** wählen. Vor Ende des Horizonts erscheint der Zwischenstand; danach Abweichung, Modellbandabdeckung und Richtungsbenchmarks.

Bei älteren Originalen eine CSV mit **Original-Kerze und allen folgenden Handelstagen** importieren. Fehlende Original-Kerzen werden abgewiesen. Später adjustierte Kurse werden auf die ursprüngliche Preisbasis ausgerichtet. **Journal laden** fasst gespeicherte Auswertungen zusammen; das Original bleibt unverändert.

V31 und V32 teilen das vorhandene Limit von **20 manuellen Analysen je Benutzer/UTC-Tag**. Auswertungen: separates Limit 20/UTC-Tag. EODHD nutzt das bestehende gemeinsame Tagesbudget, standardmäßig 6 Abfragen. CSV-Nutzerdaten werden nicht in einen globalen Kurscache geschrieben.

## Fehlerhilfe

| Problem | Prüfung |
|---|---|
| Workflow fehlt | .github/workflows/deploy-deep-analysis.yml muss auf main direkt dort liegen, ohne zusätzliche Paketordnerebene |
| „exit code 1“ | Roten Job öffnen und ersten fehlgeschlagenen Schritt aufklappen; Sammelmeldung allein enthält keine Ursache |
| Token fehlt / unauthorized | GitHub Secret SUPABASE_ACCESS_TOKEN mit tatsächlichem Supabase-Personal-Access-Token prüfen |
| Function nicht gefunden | Erfolgreichen V32-Workflow und Projekt-ID prüfen |
| Historie / Register fehlen | V32-SQL vollständig ausführen; bei Erstinstallation beide V31-SQLs voranstellen |
| Gemini inaktiv | Drei Gemini-Secrets und Hinweise im Bericht prüfen |
| Nur Suchlinks, keine KI | Gelesene Feed-Auszüge oder SEC-Primärdaten benötigt |
| Kursdaten fehlen | EODHD-Symbol, kostenloses Kontingent und Token prüfen; OHLCV-CSV als Alternative |
| Altes Dashboard | Pages-Deployment abwarten und hart neu laden; neue CSS-/JS-Dateien müssen erreichbar sein |
| Auswertung: Datenlücke | CSV mit Originaldatum und nachfolgender Handelsreihe importieren |

## Prüfung

**162 Tests erfolgreich**, einschließlich aller 124 bestehenden Tests. Details: TESTPROTOKOLL-V32.md.

SQL-Ausführung, Produktiv-Deployment und ein echter Gemini-Aufruf müssen in deinem Konto erfolgen. Externe Projekte wurden nicht geändert.

Technische Primärquellen, geprüft 11.10.2026:

- [Gemini Preise / Free Tier](https://ai.google.dev/gemini-api/docs/pricing)
- [Strukturierte Gemini-Ausgabe](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)
- [SEC EDGAR API](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- [Supabase Auth-Header](https://supabase.com/docs/guides/functions/auth-headers)
- [GitHub Checkout](https://github.com/actions/checkout)
- [GitHub Setup Node](https://github.com/actions/setup-node)
