# V39.2.0 — Depot direkt verwalten

Vollständiger neuer Stand auf Basis von V39.1.0. Hauptänderung: **Depot → Position hinzufügen → Wertpapier, Stückzahl und Einstand → Im Depot speichern**. Es ist keine vorherige Analyse, kein Alpha-Schlüssel und kein erfolgreicher Kursabruf erforderlich.

## Installation

1. Bestehendes Repository und Datenbank sichern. Eigene Änderungen vergleichen. Die eigene öffentliche Supabase-Konfiguration in `supabase.js` beibehalten.
2. Das ZIP vollständig entpacken. **Den Inhalt einschließlich aller Unterordner** in die Repository-Wurzel übernehmen, insbesondere `.github/workflows` und `supabase/functions`. Mit GitHub Desktop: in den lokalen Repository-Ordner kopieren, committen, **Push origin**. Keine zusätzliche äußere Ordnerebene hochladen.
3. In **Supabase → SQL Editor** die Datei **`setup-v39-2-depotupdate.sql`** vollständig ausführen. Diese gemeinsame Datei ergänzt auch die möglicherweise noch fehlenden V38-/V39-/V39.1-Depotstrukturen. Bei einem vorhandenen V36-, V37-, V38-, V39- oder V39.1-System musst du diese Zwischenupdates nicht einzeln ausführen. Die vorhandenen Basistabellen bleiben Voraussetzung.
4. In GitHub **Actions → V39.2 Depotverwaltung deployen → Run workflow** starten. Auf die grünen Prüfschritte und das erfolgreiche Function-Deployment warten.
5. Die statische Website über dein bisheriges Hosting veröffentlichen. Die Action deployt ausschließlich `review-investments`. SQL und Website werden nicht automatisch durch diese Action veröffentlicht.
6. Website vollständig neu laden und neu anmelden. Auf der Anmeldung muss **39.2.0** stehen. Im Depot muss anschließend **„Depotverwaltung bereit · Website 39.2.0 · Server 39.2.0“** erscheinen.

Die neue Action benötigt das vorhandene Repository-Secret `SUPABASE_ACCESS_TOKEN`. Das voreingestellte Projekt ist `pzhfybtoyfttftgcrcxk`; bei einem anderen Projekt die Repository-Variable `SUPABASE_PROJECT_ID` setzen. Wenn die Action nicht erscheint, muss die neue Workflow-Datei auf dem Standardbranch liegen und gepusht sein.

Die SQL ist wiederholbar und löscht weder bestehende Positionen noch Analysen. Sie ersetzt keine alten Basisinstallationen vor V36. Für eine vorhandene V31.2-/V32-Basis ist `setup-v39-2-gesamtupdate.sql` vorgesehen; die vorausgesetzten Basisfunctions gemäß den älteren Anleitungen zusätzlich bereitstellen. Das ist kein Grundsetup einer leeren Datenbank. Nicht zusätzlich alle historischen Gesamtdateien ausführen.

## Position direkt im Depot anlegen

1. **Depot → ＋ Position hinzufügen**.
2. Einen bereits gespeicherten Wert auswählen, WKN/ISIN suchen und übernehmen oder unter **Notierung und Stammdaten** die genaue Kennung eingeben, z. B. `VOW3.XETRA`. Handelsplatz, Aktiengattung und Währung prüfen. Eine WKN allein ist noch keine Notierung; sie muss über die Suche zugeordnet werden.
3. **Stückzahl** und **durchschnittlichen Einstand je Stück** eintragen. Das Kauf-/Einstandsdatum ist optional. Komma und Dezimalpunkt werden unterstützt; keine Tausendertrennzeichen verwenden.
4. **Im Depot speichern**. Die Ansicht kehrt zum Depot zurück. Der neue Bestand ist sofort sichtbar, einschließlich Einstand gesamt. Eine Analyse wird dabei nicht gestartet.

Der Standard ist ein gehaltener Long-Aktienbestand. Für ETF oder Short die aufklappbare Auswahl **Wertpapierart und Richtung** verwenden. Eine ungeklärte ältere Richtung muss ausdrücklich bestätigt werden. Short-/KO-/Hebelpositionen werden nicht als gewöhnlicher Long-Aktienwert in die Summe einbezogen. Diese Bestandsmaske unterstützt Aktien und ETFs.

## Bearbeiten und mehrere Käufe

Direkt in der Depotliste **Bestand bearbeiten** wählen. Derselbe Editor ist auf der Wertpapierseite erreichbar. Du siehst deine vorhandenen Positionen einschließlich Stückzahl, Einstand und Kaufdatum.

- **Bestehende Position ausgewählt:** Speichern ersetzt deren absolute Stückzahl und Einstand. Es addiert keinen weiteren Kauf.
- **Zusätzliche getrennte Position ausgewählt:** Einen neuen tatsächlichen Bestand erfassen und die zusätzliche Position ausdrücklich bestätigen. Vorhandene Positionen bleiben erhalten.
- Mehrere Positionen derselben Notierung werden im Depot zusammengefasst. Der durchschnittliche Einstand wird anhand ihrer Stückzahlen gewichtet, sofern alle Einstandswerte bekannt sind.
- Ein vergessenes Laden des bisherigen Bestands darf keinen Doppelbestand erzeugen: Der Editor lädt vorhandene Positionen; zusätzlich prüft der Server die ausdrückliche Bestätigung für weitere Positionen.
- Bei einer unsicheren Speicherantwort Angaben unverändert erneut speichern oder **Bestand neu laden**. Wiederholungen desselben Vorgangs sind geschützt. Eine veränderte bereits verarbeitete Anfrage wird abgewiesen und darf keine weitere Position erzeugen.

Eine neue Position wird atomar zusammen mit ihrer Wertpapierakte gespeichert. Scheitert die Transaktion, bleiben keine halbfertigen neuen Depotpositionen oder Beobachtungseinträge zurück. Eine Bestandsänderung setzt keinen erfolgreichen Analysezeitpunkt neu. Für eine aktualisierte Handlungseinschätzung anschließend beim Wert **Analyse aktualisieren** wählen.

## Einstand, Depotwert und Wertentwicklung

Die Liste zeigt je Wertpapier **Stückzahl, gewichteten Einstand, investierten Betrag und Ergebnis zum Einstand**. Auf der Wertpapierseite stehen dieselben Bestandskennzahlen. Die Übersicht trennt die Währungen; sie summiert EUR und USD nicht ohne Umrechnung.

Einstand ist unabhängig von Kursdaten: Ohne Bewertungskurs bleibt der investierte Betrag sichtbar. Depotwert sowie Gewinn/Verlust bleiben dann ausdrücklich offen. Der Einstandspreis wird nicht als aktueller Kurs ausgegeben.

Unter **Bewertung und eigener Kurs · optional** stehen drei Möglichkeiten:

| Auswahl | Verhalten |
| --- | --- |
| Bisherige Bewertung beibehalten | Die ausdrücklich gespeicherte Bewertungswahl bleibt erhalten. Kein Abruf. |
| Gespeicherten Anbieter-Kurs verwenden | Einen vorhandenen Kurs aus der bisherigen Datenquelle verwenden; ein manueller Bewertungsübertrag wird aufgehoben. Kein neuer Abruf. |
| Eigenen Kurs mit Datum erfassen | Preis und tatsächliches Kursdatum eingeben. Der Depotwert verwendet diesen ausdrücklich als **manuell erfasst** markierten Kurs. |

Ein manueller Kurs von heute ist für eine eigene Depotbewertung zulässig. Er wird getrennt von den abgeschlossenen Tageskerzen der Chartanalyse gespeichert und erzeugt weder Charttechniken noch eine neue erfolgreiche Analyse. Veraltete Kurse und fehlgeschlagene Anbieterabrufe bleiben unabhängig sichtbar. Die Rückkehr zu einem gespeicherten Anbieter-Kurs ist eine bewusste Auswahl; es erfolgt keine stille Quellenumschaltung.

Das Ergebnis zum Einstand betrifft die **offenen** bewertbaren Long-Aktien-/ETF-Bestände. Zusätzliche Gebühren sind nur insoweit enthalten, wie du sie in deinen durchschnittlichen Einstand aufgenommen hast. Ein unbekannter Einstand führt zu keiner erfundenen Rendite.

Der **Depotwertverlauf** enthält tatsächlich aufgezeichnete Bewertungen ab Installation der bisherigen V39-Struktur. Erst ab zwei gültigen Punkten gibt es eine Kurve. Ein altes Kaufdatum erzeugt keine nachträglich erfundene Historie. Bestandsänderungen beeinflussen die Kurve; sie ist keine um Ein-/Auszahlungen oder Verkäufe bereinigte Renditekurve.

## Position schließen

Im Bestandseditor **Position schließen** aufklappen, die vollständig geschlossene Position bestätigen und als geschlossen markieren. Der Datensatz und die gespeicherten Analysen bleiben erhalten. Ein realisierter Verkaufserlös oder eine Cashbuchung wird dadurch nicht berechnet. Eine später erneut eintreffende Wiederholung eines alten Speichervorgangs öffnet die Position nicht wieder.

## Bisherige Werte und andere Ansichten

Der Altbestandsabgleich aus V39.1 bleibt enthalten. Frühere eigene Analysen wie die mitgelieferte VW-Analyse erscheinen unter **Bereits hinterlegte Werte**, bis ein tatsächlicher Bestand bestätigt ist. Ein Analyseplan ohne Stückzahl und Einstand ist weiterhin kein ausgeführter Kauf. **Ins Depot aufnehmen** öffnet den neuen Bestandseditor direkt.

Die Hauptnavigation bleibt **Depot, Suche, Beobachtung**. Analyse, Chart, Plan, Quellen, Historie und Gespräch liegen beim einzelnen Wertpapier. Im Depot führt der Hauptbutton zur Positionserfassung; in Beobachtung führt **Wert beobachten** zur Wertpapiersuche. Nachrichten, Benchmark, die bisherigen Analysen-JSON-Funktionen, Konto/Telegram und Sperren bleiben unter Verwaltung erreichbar. Der bestehende JSON-Import/-Export der alten Trade-Pläne ist kein vollständiger Export der neuen tatsächlichen Depotpositionen; für deren Sicherung die Supabase-Datenbank sichern.

## Wenn es weiterhin nicht funktioniert

| Anzeige | Nächster Schritt |
| --- | --- |
| Anmeldung zeigt noch 39.1 oder älter | Statische Website und sämtliche Dateien aktualisieren, vollständig neu laden. |
| Website 39.2, Server älter oder Feature fehlt | Die neue **V39.2 Depotverwaltung deployen**-Action ausführen. |
| V39.2-Datenbankerweiterung fehlt | Die gemeinsame Datei **setup-v39-2-depotupdate.sql** vollständig im richtigen Supabase-Projekt ausführen. |
| Für diesen Wert läuft eine Analyse | Die Prüfung abwarten, danach speichern; die vorhandene Position bleibt erhalten. |
| Position passt nicht mehr zur Auswahl | **Bestand neu laden**, richtigen Wert und richtige Position auswählen. |
| Alpha-Vantage-Schlüssel fehlt | Das blockiert die Bestandsverwaltung nicht. Alpha ist nur für einen ausdrücklich gewählten Kursabruf erforderlich. |

Kein neues Billing und keine automatische KI. Ein vorhandener Hintergrundzeitplan wird weiterverwendet; keinen zweiten Job anlegen. Neue Bestände nutzen für die neue Überwachung zunächst gespeicherte Daten, sofern der Wert nicht bereits eine bewusst konfigurierte Quelle hatte. Eine zuvor ausdrücklich abgeschaltete Überwachung einer bereits gehaltenen Position bleibt beim Bearbeiten ausgeschaltet.

## Abnahme nach Installation

Eine tatsächliche Position anlegen, neu laden, bearbeiten und die Stückzahl kontrollieren. Einen eigenen Bewertungskurs mit Datum erfassen oder einen gespeicherten Kurs verwenden; Einstand und Ergebnis vergleichen. Eine zweite Position ausdrücklich hinzufügen und den gewichteten Einstand prüfen. Anschließend Analyse, Beobachtung, vorhandene Historie und Gespräch öffnen. Die mobile Darstellung auf deinem Endgerät prüfen.

Prüfnachweise und technische Grenzen: **TESTPROTOKOLL-V39.2.md**. Das Paket wurde lokal einschließlich echter PostgreSQL-Transaktionen geprüft. Dein produktives Depot, zusätzliche eigene Datenbanktrigger und die gerenderte iPhone-Oberfläche wurden nicht live ausgelesen oder geprüft.
