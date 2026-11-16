# V39.3.0 — Kursgrafiken und Depotverlauf

Vollständiges Paket auf Basis V39.2.0. Die neue Darstellung ergänzt Depot, Beobachtung, gespeicherte Suche und Wertpapierseite um echte historische Grafiken. Die Bestandsverwaltung mit Stückzahl, Einstand und manueller Bewertung bleibt enthalten.

## Update eines vollständig aktiven V39.2-Systems

1. Repository und Datenbank sichern. Eigene Anpassungen vergleichen; die eigene öffentliche Supabase-Konfiguration in `supabase.js` beibehalten.
2. ZIP entpacken und **den Inhalt einschließlich sämtlicher Unterordner** in die Repository-Wurzel übernehmen. Besonders `.github/workflows` und `supabase/functions` mitkopieren. Keine zusätzliche äußere Ordnerebene anlegen. Mit GitHub Desktop: Dateien in den lokalen Repository-Ordner kopieren, committen und **Push origin**.
3. **Kein neues SQL erforderlich**, wenn V39.2 bereits vollständig installiert ist. Diese Version verwendet die vorhandenen Tabellen und Funktionen weiter.
4. In GitHub **Actions → V39.3 Kursgrafiken deployen → Run workflow** starten. Auf erfolgreiche Prüfungen und das grüne Function-Deployment warten.
5. Die **statische Website über das bisherige Hosting veröffentlichen**. Die Action aus Schritt 4 aktualisiert ausschließlich `review-investments`; sie veröffentlicht weder Website noch SQL.
6. Website vollständig neu laden und neu anmelden. Auf der Anmeldung muss **39.3.0** stehen. Im Depot **Website 39.3.0 · Server 39.3.0** kontrollieren und **Depot neu laden** wählen.

Die neue Action benötigt das vorhandene Secret `SUPABASE_ACCESS_TOKEN`. Voreingestelltes Projekt: `pzhfybtoyfttftgcrcxk`; bei einem anderen Projekt die Repository-Variable `SUPABASE_PROJECT_ID` setzen. Erscheint die Action nicht, muss `.github/workflows/deploy-v39-3-charts.yml` auf dem Standardbranch liegen und gepusht sein.

Bei **V36 bis V39.1** oder unvollständigen V39.2-Tabellen zuerst **`setup-v39-3-depotupdate.sql`** vollständig im Supabase SQL Editor ausführen, anschließend Schritte 4–6. Diese gemeinsame Datei enthält die bestehenden V38-/V39-/V39.1-/V39.2-Erweiterungen. Nicht zusätzlich alle historischen Gesamtupdates ausführen.

Für eine vorhandene V31.2-/V32-Basis ist **`setup-v39-3-gesamtupdate.sql`** enthalten. Sie ist kein Grundsetup einer leeren Datenbank; die bisherigen Basistabellen und Basisfunctions gemäß den älteren Anleitungen bleiben Voraussetzung. Vorhandene Zeitpläne werden weiterverwendet. Keine neuen Cronjobs oder Billingfreigaben erforderlich.

## Was wo angezeigt wird

| Ansicht | Grafik und Bedeutung |
| --- | --- |
| Depotübersicht | Tatsächlich aufgezeichnete Depotbewertungen, getrennt nach Währung. Numerischer Wert, Datum, Zeitraumwahl und sichtbare Messpunkte. |
| Depotliste | Historischer Minichart je Wert; Stückzahl, Einstand und Ergebnis bleiben daneben lesbar. |
| Beobachtung | Minicharts je Wert sowie gemeinsamer Kursvergleich für bis zu fünf Werte mit ausreichender gespeicherter Historie. |
| Gespeicherte Suche | Minicharts bei den eigenen gespeicherten Treffern. |
| Einzelnes Wertpapier | Eigener historischer Kurschart mit `1W`, `1M`, `3M`, `1J`, `Max`, ablesbarem Wert/Datum und Schieberegler für einzelne Messpunkte. |
| Separater Börsenchart | TradingView-Anzeige, wenn eigene Historie fehlt und der Handelsplatz eindeutig zugeordnet werden kann; im Detail auch manuell aufrufbar. |

Die historische Grafik hängt nicht mehr von einem aktuellen Analysebericht ab. Ein veralteter oder gesperrter Prognosebericht kann also neben einer weiterhin sichtbaren echten Kurshistorie stehen. Das Kursdatum bleibt angezeigt. Ein historischer Verlauf macht eine alte Handlungseinschätzung nicht aktuell.

## Depotverlauf: Punkt, waagerechte Linie oder Kurve

- **Eine gespeicherte Bewertung:** sichtbarer Punkt mit Währungswert und Datum. Eine echte Zeitreihe entsteht erst mit weiteren Messungen.
- **Mehrere unveränderte Bewertungen:** sichtbare waagerechte Linie. Ab V39.3 kann an jedem tatsächlich erfassten Tag auch bei unverändertem Bewertungskurs ein weiterer Messpunkt gespeichert werden. Derselbe Bestand mit derselben Bewertungsbasis wird innerhalb eines Tages weiterhin zusammengefasst.
- **Veränderte Bewertungen:** Verbindung der tatsächlich vorhandenen Messpunkte.
- **Keine gültige Bewertung:** verständlicher Hinweis statt einer leeren Zeitachse. Bestand, Bewertungskurs und Datum prüfen.

Neue Messungen werden bei den vorhandenen Depot-/Hintergrundabläufen geschrieben, wenn eine Bewertung möglich ist. Tage ohne erfolgreiche Erfassung werden nicht nachgetragen. Ein altes Kaufdatum erzeugt keine erfundene Kurve. Stale Kurse bleiben veraltet markiert, auch wenn heute eine Bewertung damit aufgezeichnet wurde.

Der Depotwertverlauf ist keine um Ein-/Auszahlungen, Bestandsänderungen oder Verkäufe bereinigte Renditekurve. Fremdwährungen bleiben getrennt. Manuelle Bewertungen behalten ihre Kennzeichnung und werden nicht als Markthistorie ausgegeben. Ein Ausfall der optionalen Verlaufstabelle blendet den aktuellen Depotwert und die Positionen nicht mehr aus.

## Kursverläufe laden

Beim Laden werden ausschließlich eigene gespeicherte Kursdaten und tatsächliche Historien alter Analyseberichte gelesen. Dafür werden weder neue Kursanbieter noch KI aufgerufen. Die Listen laden zunächst bis zu 72 gespeicherte Werte in begrenzten Paketen; weitere Werte lassen sich einzeln öffnen. Ein neueres isoliertes Kursdatum verdrängt keine vorhandene vollständige Kurshistorie.

Fehlt ein Verlauf:

1. Wert öffnen und **Kursquelle / CSV wählen** anklicken.
2. Unter Notierung eine vorhandene Kursquelle auswählen oder eine eigene OHLCV-CSV mit 60–2000 abgeschlossenen Tageskerzen importieren. Bei abweichender Anbieterkennung den Handelsplatz und die Währung bestätigen.
3. **Kursverlauf aktualisieren** wählen. Dieser Button lädt nur Kursdaten und aktualisiert deren Status. Er erstellt keinen Analysebericht und startet keine KI. Neue Werte vorher mit **Merken** oder als Depotposition speichern.
4. Für eine neue Einschätzung anschließend ausdrücklich **Analyse aktualisieren** starten.

Gespeicherte Daten und CSV benötigen keinen zusätzlichen Anbieter-Schlüssel. Öffentliche Kurse, Alpha Vantage und EODHD verwenden ihre bestehenden Limits und Schutzbudgets. Bei einem Fehler bleiben bereits vorhandene Kursreihen und deren ursprüngliches Datum erhalten; eine andere Datenquelle wird nicht automatisch abgerufen. Ein fehlender Alpha-Schlüssel blockiert nur den ausdrücklich gewählten Alpha-Abruf.

Die Kurven sind als responsive SVGs für schmale und breite Ansichten ausgelegt; der Wert unter der Grafik und der Schieberegler sind auch ohne Maus-Hover nutzbar.

## Separater TradingView-Chart

Bei fehlender ausreichender eigener Historie wird für bekannte Handelsplätze ein externer Mini-/Detailchart eingebunden, z. B. `VOW3.XETRA` → `XETR:VOW3`. Der Listen-Fallback ist auf acht externe Charts je Darstellung begrenzt. Über **Externe Minicharts ausblenden** lassen sie sich abschalten; im Analysearchiv und in Suchtreffern wird kein externer Listenchart automatisch geladen.

Ist die Börse unklar, etwa bei einem `.US`-Sammelcode, wird sie nicht geraten. Auf der Wertpapierseite unter **Separater Börsenchart** die genaue TradingView-Kennung mit Börsenpräfix eingeben und bestätigen. Diese manuelle Kennung muss beim erneuten Öffnen bei Bedarf wieder bestätigt werden.

Die Einbettung benötigt keinen eigenen API-Schlüssel. Sie übergibt nur die öffentliche Chartkennung an TradingView, keine Depotstückzahlen, Einstandswerte, Nutzerdaten oder API-Schlüssel aus dem Dashboard. Verfügbarkeit, Handelsplatz und mögliche Verzögerung werden vom Widget bestimmt. Die TradingView-Quellenkennzeichnung bleibt sichtbar. Externe Browser-/Netzwerksperren können die Einbettung verhindern.

Widgetkurse werden nicht in die eigene Datenbank, Depotbewertung, Charttechnik oder KI-Analyse übernommen. Für solche Berechnungen weiterhin gespeicherte Anbieter-Kurse oder CSV verwenden. Im Beobachtungsvergleich werden ausschließlich eigene gespeicherte Zeitreihen verwendet: gleicher erster und letzter gemeinsamer Kurstag, Startwert 100, jeweilige Notierungswährung ohne Währungsumrechnung.

Offizielle Widget-Dokumentation: [Symbol Overview](https://www.tradingview.com/widget-docs/widgets/charts/symbol-overview/) und [Mini Chart](https://www.tradingview.com/widget-docs/widgets/charts/mini-chart/).

## Kurze Abnahme nach der Installation

1. **Depot neu laden:** Positionen, investierten Betrag sowie Punkt oder Kurve mit Zahlen prüfen.
2. Einen Wert mit vorhandener Historie öffnen: Der historische Chart muss auch ohne neuen Analyseaufruf erscheinen. Datum und Quelle kontrollieren.
3. Zeitraum wechseln und mit dem Schieberegler einen historischen Wert ablesen. Wenn nur alte Daten vorhanden sind, **Max** verwenden.
4. In **Beobachtung** Minicharts und Vergleich öffnen. Der Vergleich benötigt mindestens zwei gemeinsame Kursdaten; Einzelverläufe bleiben ansonsten verfügbar.
5. Optional CSV importieren und nur **Kursverlauf aktualisieren** anklicken. Die Kursgrafik muss aktualisiert werden, der bisherige erfolgreiche Analysezeitpunkt bleibt unverändert.
6. Einen Wert ohne eigene Historie öffnen und die externe Anzeige prüfen. Auch bei einem externen Chart bleibt ein fehlender eigener Depotkurs als fehlend gekennzeichnet.

| Problem | Prüfung |
| --- | --- |
| Anmeldung zeigt eine ältere Version | Vollständige statische Website veröffentlichen und vollständig neu laden. |
| Meldung „V39.3-Function fehlt“ | Die neue Action ausführen; Website und Function müssen zusammen aktualisiert sein. |
| Kein eigener Kursverlauf | Im Wert Kursquelle oder CSV wählen; bei vorhandenen alten Daten `Max` prüfen. |
| Nur ein Depot-Punkt | Es ist bisher nur eine echte Bewertung gespeichert. Weitere tatsächliche Messungen ergeben die Kurve. |
| Externer Chart fehlt | Handelsplatz/Kennung, Quellenabdeckung, Netzwerksperre und die Einstellung für externe Minicharts prüfen. |
| „Zwei gemeinsame Kursdaten“ fehlen | Einzelcharts verwenden oder passende Historien für den Vergleich laden. |

Prüfnachweise: **TESTPROTOKOLL-V39.3.md**. Das Paket ist lokal automatisiert geprüft; die produktive Installation und die Darstellung auf deinem iPhone wurden nicht live geprüft.
