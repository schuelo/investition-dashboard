# V39.5.0 — Einheitliche Charts und puristische Übersicht

Vollständiges Paket auf Basis V39.4.0. Der Stand enthält alle bisherigen Dateien und Unterordner. Prüfnachweise: **TESTPROTOKOLL-V39.5.md**.

## Warum die Charts unterschiedlich waren

Die frühere Übersicht mischte eigene gespeicherte Kursreihen als kleine SVG-Grafik mit einem separaten TradingView-Widget. Das Widget verwendete eine andere Gestaltung und eigene Daten. Seine Kurse standen der eigenen Depotberechnung nicht zur Verfügung.

Im vorgelegten Screenshot endet die NVIDIA-Historie am **09.10.2026**. Kurze Zeiträume wurden bisher vom heutigen Datum zurückgerechnet; damit konnten ältere vorhandene Kurse vollständig aus dem Ausschnitt fallen. Außerdem bedeutet eine vorhandene Historie nicht automatisch, dass schon ein gültiger Bewertungskurs im Depot gespeichert ist.

V39.5 verwendet in allen Listen dieselbe eigene Grafik. Ein separater Börsenchart ist weiterhin bewusst über die Datenquellen am Wertpapier startbar.

## Installation

1. Eigenes Repository und Datenbank sichern. Eigene Anpassungen vergleichen und die eigene öffentliche Supabase-Konfiguration in `supabase.js` beibehalten.
2. ZIP vollständig entpacken. **Den Inhalt einschließlich aller Unterordner in die Repository-Wurzel übernehmen.** Dazu gehören `.github/workflows` und `supabase/functions`. Keine zusätzliche äußere Ordnerebene anlegen. Am einfachsten den Inhalt mit GitHub Desktop in das vorhandene Repository kopieren, committen und **Push origin** wählen.
3. Bei vollständig installiertem **V39.2, V39.3 oder V39.4 ist kein neues SQL nötig**. Bei älteren V36–V39.1-Ständen die mitgelieferte **setup-v39-5-depotupdate.sql** im Supabase SQL Editor ausführen. Sie enthält die bisherigen V38-/V39-/V39.1-/V39.2-Erweiterungen. Für eine bestehende V31.2-/V32-Basis gibt es **setup-v39-5-gesamtupdate.sql**. Das ist kein Grundsetup einer leeren Datenbank. Nicht alle historischen Gesamtupdates nacheinander ausführen.
4. **Actions → V39.5 Übersicht und Charts deployen → Run workflow** starten. Der Workflow prüft Versionen, Tests und SQL und veröffentlicht **review-investments** sowie **analyze-deep-signal**. Er veröffentlicht weder SQL noch die statische Website.
5. **Die statische Website über das bisherige Hosting veröffentlichen.** Die neuen Dateien `chart-window.mjs` und `purist-ui.css` sowie alle Unterordner müssen enthalten sein. Nur die GitHub Action zu starten aktualisiert die Oberfläche nicht.
6. Website vollständig neu laden und gegebenenfalls neu anmelden. Anmeldung und **Status & Datenprüfung** müssen **39.5.0** anzeigen. Im Depot **Depot neu laden** wählen.

Die neue Workflow-Datei heißt `.github/workflows/deploy-v39-5-purist.yml`. Erscheint die Action nicht, prüfen, ob diese Datei auf dem Standardbranch liegt und tatsächlich gepusht wurde. Der Workflow benötigt das vorhandene Secret `SUPABASE_ACCESS_TOKEN`. Voreingestelltes Projekt ist `pzhfybtoyfttftgcrcxk`; für ein anderes Projekt die Repository-Variable `SUPABASE_PROJECT_ID` setzen.

Fehlen die alten Deep-Berichtstabellen, bleibt deren vorhandene Einrichtung über **setup-v32-deep-analysis.sql** erforderlich. Diese Tabellen werden für die gespeicherte Kursübernahme nur optional gelesen. Die Basis-Depotbewertung funktioniert weiter, wenn sie nicht vorhanden sind.

Der bestehende V38-Hintergrundzeitplan bleibt bestehen. Es wird kein zweiter Zeitplan angelegt. Fehlt ein nachgewiesener Hintergrundlauf, die bestehende Anleitung **INSTALLATION-V38.md** prüfen.

## Neue Bedienung

| Bereich | Zunächst sichtbar | Aufklappbar oder unter „Mehr“ |
| --- | --- | --- |
| Depotübersicht | Depotwert, Ergebnis seit Einstand, investierter Betrag, Kursqualität und Verlauf | Bestand & Bewertung; Daten & Darstellung |
| Wertpapierliste | Name, Ticker, Einschätzung, Kursstatus, Kurs-/Analysedatum, Positionswert oder Stückkurs, Minichart | Details & Bestand mit Stückzahl, Einstand, Bearbeitung, Quellen und Abrufmeldungen |
| Beobachtung | Einheitliche Minicharts und gemeinsamer Kursvergleich mit Index 100 | Filter und gespeicherte Details |
| Einzelwert | Historischer Kurschart; Analyse aktualisieren; Gespräch | Mehr: Bestand, Analyseplan, Deep/Szenarien/Hebel, automatische Prüfung |
| Analysebericht | Einschätzung und bei gültiger Datenbasis bedingte Schwellen | Charttechnik & Szenarien, Simulation, Begründung, Quellen und Datenlücken |
| Technischer Status | Kompakter Hinweis bei einem Problem | Status & Datenprüfung am Ende der Übersicht |

Die Gestaltung verwendet schwarzen Hintergrund, flache Trennlinien und schmale Minicharts. Bei schmalen Ansichten werden Abstände und Chartbreiten reduziert. Eingaben bleiben lesbar und Bedienelemente für Touch erreichbar. Bestandsverwaltung, WKN-/ISIN-Suche, Berichte, Chat, Quellen und getrenntes Papierdepot bleiben vorhanden.

## Zeitraum und Datenstand richtig lesen

- **1W / 1M / 3M / 1J / Max** beziehen sich auf den letzten gespeicherten Wert der gewählten Datenbasis. Sein tatsächliches Datum wird angezeigt.
- Bei alten Daten steht **veraltet**. Ein Chart bis 09.10.2026 wird dadurch nicht zu einem aktuellen Chart.
- Reicht die Historie nicht für den gewählten Zeitraum, steht **Historie kürzer als …**. Gezeigt wird der vorhandene Abschnitt; fehlende Monate werden nicht erfunden.
- Ein einziger echter Wert erscheint als Punkt. Ohne Historie erscheint ein einheitlicher Platzhalter und die Zeitraumwahl ist deaktiviert.
- Die Datenbasis wird vor der Zeitraumfilterung gewählt. Ein Wechsel von 1W zu 1J wechselt deshalb nicht stillschweigend von Euro-Bewertungen zu einem Index.
- Unter **Daten & Darstellung** bleiben gespeicherte Bewertungen, Rückrechnung des heutigen offenen Bestands und Kursvergleich auswählbar. Eine Rückrechnung ist keine vollständige frühere Depotbilanz; Cash, geschlossene Positionen, Gebühren und Zahlungsströme sind nicht vollständig enthalten.
- Der Kursvergleich verwendet gemeinsame tatsächliche Kurstage. Unterschiedliche Währungen werden nicht in eine Depotwährung umgerechnet.
- Die Simulation bleibt unter **Charttechnik & Szenarien** ausdrücklich als Modellband beschriftet. Sie liefert keine historischen Preise für die Depotbewertung.

## Gespeicherte Kurse für die Bewertung

Fehlt ein Depotkurs oder ist er älter, kann die aktualisierte Serverfunktion den neuesten passenden echten Schlusskurs aus dem eigenen Kurscache, letzten Basisbericht oder gespeicherten Deep-/Signalbericht verwenden. Eigentümer, Ticker und Währung müssen passen. Aus älteren Berichten werden nur Preisgeschichte und Kursmetadaten gelesen; Szenariopfade werden nicht als Marktwerte verwendet.

Eine bewusst gewählte manuelle Bewertung hat Vorrang. Das ursprüngliche Kursdatum bleibt erhalten und ein alter Kurs bleibt alt. Die Übernahme verändert weder den gespeicherten Analysezeitpunkt noch die Kaufen-/Halten-/Verkaufen-Freigabe oder gespeicherte Schwellen. Unter **Bestand & Bewertung** steht, wenn vorhandene Kurse zur Bewertung übernommen wurden.

Das Öffnen der Übersicht und das Umschalten von Zeiträumen starten dafür keinen neuen Kursanbieter- oder KI-Aufruf. Neue aktuelle Daten erfordern weiterhin einen ausdrücklich ausgelösten Kursabruf oder den vorhandenen eingerichteten Hintergrundlauf. Es werden keine neuen Schlüssel, bezahlten Ersatzanbieter oder Billing-Einstellungen aktiviert.

## Kurze Kontrolle nach der Veröffentlichung

1. Website und Server zeigen **39.5.0** unter **Status & Datenprüfung**.
2. Ein Wert mit gespeicherter Historie zeigt in allen Zeiträumen den vorhandenen Abschnitt. Altes Datum und kurze Historie bleiben sichtbar.
3. Ein Wert ohne Historie zeigt den Platzhalter, keine weiße externe Großgrafik.
4. Die Minicharts folgen der gewählten Zeitspanne. Bei einer anderen Datenbasis bleiben Einheit und Bedeutung ausdrücklich beschriftet.
5. **Details & Bestand → Bestand bearbeiten** öffnet Stückzahl und Einstand. Unter **Mehr** bleiben Deep, Plan und Überwachung erreichbar.
6. Falls die Grafik weiterhin fehlt, **Status & Datenprüfung → Prüfbericht kopieren** verwenden. Dort stehen Versionen, Datenmengen und Abrufzustände.

Dieses Paket wurde lokal geprüft und noch nicht im Zielprojekt veröffentlicht. Eine vollständige gerenderte Browser-/iPhone-Abnahme und die produktive Datenbank konnten ohne Live-URL und Sitzung nicht geprüft werden.
