# V39.4.0 — Dashboardprüfung und nachvollziehbare Depotgrafik

Vollständiges Paket auf Basis V39.3.0. Der Anforderungsabgleich steht in **ANFORDERUNGSABGLEICH-V39.4.md**, die Prüfnachweise in **TESTPROTOKOLL-V39.4.md**.

## Installation

1. Repository und Datenbank sichern. Eigene Anpassungen vergleichen; die eigene öffentliche Supabase-Konfiguration in `supabase.js` beibehalten.
2. ZIP vollständig entpacken. **Den Inhalt einschließlich aller Unterordner in die Repository-Wurzel** übernehmen, besonders `.github/workflows` und `supabase/functions`. Keine weitere äußere Ordnerebene hochladen. Mit GitHub Desktop kopieren, committen und **Push origin** wählen.
3. Bei vollständig installiertem **V39.2 oder V39.3 ist für die Depotgrafik kein neues SQL nötig**. Bei älterem V36–V39.1 zuerst **setup-v39-4-depotupdate.sql** vollständig im Supabase SQL Editor ausführen. Die historische gemeinsame Datei enthält die bestehenden V38-/V39-/V39.1-/V39.2-Erweiterungen; Daten und Zeitpläne bleiben erhalten.
4. **Actions → V39.4 Dashboard prüfen und deployen → Run workflow**. Dieser neue Workflow prüft das gesamte Paket und veröffentlicht **review-investments und analyze-deep-signal**. Er veröffentlicht weder SQL noch die statische Website.
5. **Die statische Website über dein bisheriges Hosting veröffentlichen.** Alle neuen JavaScript-Module und Unterordner müssen mit veröffentlicht werden. Nur die GitHub Action zu starten aktualisiert die Benutzeroberfläche nicht.
6. Website vollständig neu laden und neu anmelden. Auf der Anmeldung muss **39.4.0** stehen. Im Depot **Depot neu laden** wählen und unter **Status & Datenprüfung** ebenfalls **Website / Server 39.4.0 / 39.4.0** kontrollieren.

Der Workflow benötigt das vorhandene Secret `SUPABASE_ACCESS_TOKEN`. Voreingestelltes Projekt: `pzhfybtoyfttftgcrcxk`; bei einem anderen Projekt die Repository-Variable `SUPABASE_PROJECT_ID` setzen. Erscheint die Action nicht, muss die neue Workflow-Datei auf dem Standardbranch liegen und gepusht sein.

Wenn **Deep / Hebel** eine fehlende Berichtstabelle meldet und die Deep-Datenbank bisher nicht installiert war, die vorhandene **setup-v32-deep-analysis.sql** nach der bisherigen Basisinstallation ergänzen. Für eine alte V31.2-/V32-Basis steht **setup-v39-4-gesamtupdate.sql** bereit. Diese Datei ist kein Grundsetup einer leeren Datenbank. Nicht sämtliche historischen Gesamtupdates nacheinander ausführen.

Der vorhandene V38-Hintergrundzeitplan wird weiterverwendet; keinen zweiten Job anlegen. Fehlt ein nachgewiesener Hintergrundlauf, die bestehende Einrichtung aus **INSTALLATION-V38.md** prüfen. Das bloße Öffnen der Website richtet keinen Zeitplan ein.

## Warum der Depotverlauf bisher leer bleiben konnte

Bis V39.3 stützte sich der Depotwertverlauf ausschließlich auf gespeicherte Depotmessungen. Eine vorhandene Aktienkurshistorie ergab noch keine Depotkurve. Fehlte der Verlaufsspeicher oder schlug die Depotantwort fehl, konnte die Übersicht trotz vorhandener Werte fehlen. Eine reine Source-/SVG-Prüfung bestätigte zudem nicht, dass dieselben Dateien auf deiner Website veröffentlicht waren.

V39.4 trennt jetzt drei Darstellungen. **Automatisch** wählt eine passende vorhandene Datenbasis; über **Darstellung** kannst du sie selbst auswählen:

| Darstellung | Verwendete Daten | Bedeutung |
| --- | --- | --- |
| Gespeicherte Bewertungen | Tatsächliche aufgezeichnete Depotmessungen | Eigene Kontomessungen. Einzelne Werte sind als Punkt sichtbar; unveränderte Werte ergeben eine waagerechte Linie. |
| Offene Positionen rückrechnen | Echte gespeicherte Kurse und heutige offene Stückzahlen; vollständige Kaufdaten erforderlich | Historischer Modellwert des heutigen offenen Bestands, frühestens nach dem letzten Kauf. Keine vollständige frühere Depotbilanz. |
| Kurse vergleichen | Gespeicherte Zeitreihen der aktuell gehaltenen Werte, Startwert 100 | Kursentwicklung, wenn z. B. Kaufdaten für eine Rückrechnung fehlen. Kein Depotwert in Euro. |

Bei vorhandenen zwei Depotmessungen im gewählten Zeitraum haben diese in der automatischen Auswahl Vorrang. Für die Rückrechnung müssen passende Historien aller eingeschlossenen Long-Aktien-/ETF-Bestände und mindestens zwei gemeinsame Kurstage vorliegen. Es werden keine Kurse interpoliert oder Positionen vor ihrem letzten Kaufdatum unterstellt. Währungen bleiben getrennt.

Die Rückrechnung berücksichtigt nur die heutigen offenen Bestände. Geschlossene Positionen, Cash, Ein-/Auszahlungen, Gebühren und die damalige tatsächliche Stückzahlentwicklung sind darin nicht vollständig enthalten. Die Grafik ist ausdrücklich als Rückrechnung gekennzeichnet. Sie ist weder eine echte frühere Kontobilanz noch eine bereinigte Renditekurve.

Wenn nur eine aktuelle Bewertung möglich ist, erscheint ein beschrifteter Punkt. Dieser wird als aktuell berechnete Bewertung ausgewiesen, falls keine passende gespeicherte Messung vorliegt. Fehlen sämtliche Kurse, erscheint ein konkreter Datenhinweis. Es gibt keine erfundene Entwicklung.

## Status direkt im Depot prüfen

**Status & Datenprüfung** zeigt Website-/Serverversion, Depotantwort, Anzahl gespeicherter Messungen und Kursreihen, Erreichbarkeit des Verlaufsspeichers, letzten Hintergrundlauf, Deep-Datenbank und KI-Konfiguration.

- **Status neu prüfen** liest den Serverstatus, ohne Kursanbieter oder KI zu starten.
- **Prüfbericht kopieren** kopiert nur technische Versionen, Zustände und Anzahlen. Wertpapiernamen, Stückzahlen, Einstandswerte und Schlüssel sind nicht enthalten.
- Bei einer fehlgeschlagenen Depotantwort bleibt die letzte erfolgreiche Übersicht mit ihrem ursprünglichen Stand sichtbar. Sie wird deutlich als ältere Antwort gekennzeichnet.
- Ein Fehler beim Laden der Darstellungsdateien erhält eine sichtbare Meldung statt eines stillen leeren Bereichs.
- Eine fehlende Depotantwort wird nicht mehr als leeres Depot ausgegeben.

Die Zeile **Daten im Zeitraum** nennt direkt an der Grafik die Anzahl der Depotmessungen, rückrechenbaren Kurstage und Kursreihen. Ohne eigene gespeicherte Kursdaten kann ein TradingView-Widget weiterhin einen separaten Marktchart zeigen. Seine Daten werden nicht für die eigene Depotberechnung übernommen.

## Deep, Szenarien und Hebel wieder direkt beim Wertpapier

1. Im Depot oder in Beobachtung einen Wert öffnen.
2. **Deep, Szenarien & Hebel** wählen. Symbol, Währung, Horizont, Kontext und eigene Quellen werden vorbereitet. Passende echte OHLCV-Daten aus dem eigenen Kurscache oder letzten Basisbericht können ohne neuen Kursabruf übernommen werden.
3. Es werden keine OHLC-Kerzen aus reinen Schlusskursen erzeugt. Fehlen echte OHLCV-Daten, CSV importieren oder eine externe Quelle bewusst auswählen.
4. Die **Deep-Analyse ausdrücklich starten**. Gemini ist zunächst ausgeschaltet und kann optional vor dem manuellen Start zugeschaltet werden.
5. Produktart und tatsächliche Produktbedingungen unter der Hebel-/Produktprüfung eingeben. Die Modellprüfung ersetzt keine ausführbaren Produktkurse.
6. **Zum Wertpapier / Depot** führt zurück. In der Liste erscheint das Datum des letzten eigenen Deep-Berichts zusätzlich zum Basisanalyse- und Kursdatum. Eine neue Deep-Simulation überschreibt nicht stillschweigend die regelbasierte Kaufen-/Halten-/Verkaufen-Einschätzung.

Unter **Verwaltung → Deep-Archiv / TRIGGER KI** bleiben die vertiefenden Werkzeuge und gespeicherten Berichte erreichbar. KI, Quellenabruf und Kursabruf starten nicht beim Öffnen. Ein Telegram-/TRIGGER-Link ist keine Startfreigabe für Gemini; Notierung und Einstellungen bleiben vor dem manuellen Start zu prüfen.

Der interne Chat verwendet weiterhin optional Gemini. Ein direkt mit diesem ChatGPT-Gespräch synchronisierter Chat ist nicht enthalten. Notizen, gespeicherte Gespräche und Export für ChatGPT bleiben verfügbar. Die Konfigurationsprüfung verlangt Schlüssel, freigegebenes Modell und ausdrückliche Tarif-Bestätigung. Sie prüft **nicht automatisch den tatsächlichen Google-Abrechnungsstatus**. Das Dashboard aktiviert kein Billing und verwendet keinen bezahlten Ersatzanbieter.

## Abnahme nach der Veröffentlichung

1. Anmeldung und **Status & Datenprüfung** müssen jeweils **39.4.0** anzeigen. Ein Frontend-/Server-Mischstand ist zuerst zu korrigieren.
2. Depot neu laden. Aktueller Wert oder ein präziser Hinweis muss erscheinen; außerdem Datenanzahl an der Grafik.
3. **Darstellung → Gespeicherte Bewertungen**, dann **Offene Positionen rückrechnen** und **Kurse vergleichen** testen. Für ältere Daten **Max** wählen.
4. Einen Depotwert mit echten gespeicherten Kursen und vorhandenem Kaufdatum öffnen. Historischer Chart und Deep-Vorbereitung müssen ohne neuen Anbieterabruf funktionieren.
5. In **Beobachtung** Minicharts und gemeinsamen Kursvergleich prüfen. Ein fehlender gemeinsamer Start-/Endtag wird erklärt.
6. Eine Position mit Stückzahl und Einstand hinzufügen, neu laden und bearbeiten. Bestand und Analyse bleiben getrennt.
7. Bestehenden Chat, Berichtshistorie, eigene URLs, Quellenarchiv und Benchmark öffnen. Eine KI-Anfrage nur dann ausdrücklich starten, wenn sie gewünscht und eingerichtet ist.

Bei weiterhin leerer Grafik den **Prüfbericht kopieren**. Er zeigt, ob die veröffentlichte Version, die Depotantwort, der Verlaufsspeicher oder die Kursdaten fehlen. Die produktive Website und zusätzliche eigene Datenbanktrigger konnten für dieses Paket mangels Live-URL nicht geprüft werden.
