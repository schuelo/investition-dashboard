# Prüfprotokoll V39.1.0

Stand: 15.11.2026. Grundlage ist das zuvor gelieferte vollständige V39.0.0-Paket, SHA-256 `c0bab73714dff7081defda3806c94838915901ce0832c4ddc7a3c0f6a773e2ec`.

## Ergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| Automatisierte JavaScript-Tests | **462 bestanden**, keine fehlgeschlagen oder übersprungen |
| Umfang | 445 vorhandene Tests und 17 neue V39.1-Tests |
| Tatsächliche SQL-Prüfungen in PostgreSQL/PGlite | **119 bestanden**: 72 V38, 12 V39, 35 V39.1 |
| JavaScript-Syntax | 90 Dateien geprüft |
| TypeScript-Syntax | 14 Dateien mit dem Node-TypeScript-Parser gelesen; kein Deno-Typcheck |
| Relative Modulimporte | 207 vorhanden |
| Service-Worker-Kerndateien | 44 Dateiverweise vorhanden |
| HTML | 430 eindeutige IDs, keine verschachtelten Formulare, relative Ressourcen vorhanden |
| GitHub-Workflows | 11 YAML-Dateien parsebar |
| Version und kombinierte Migration | Generatoren mit `--check` erfolgreich |

Die drei bestehenden Erwartungsanpassungen betreffen die Berichts-Version, die ausdrücklich ersetzte alte Navigation und die neue Voreinstellung für Kursquellen. Keine vorhandenen Tests wurden entfernt.

## Neue Funktionsprüfung

Die Tests verwenden den tatsächlichen UI-Controller und tatsächlichen Function-Handler hinter kontrollierten DOM-, Datenbank- und HTTP-Adaptern. Für die SQL-Funktion wird zusätzlich die tatsächliche Migration ausgeführt.

- Der originale Volkswagen-Startdatensatz mit `VOW3.XETRA` erscheint unter **Bereits hinterlegte Werte**. Er erzeugt weder Stückzahl noch Einstand, Depotwert, aktuellen Kurs oder ausgeführten Kauf.
- Wiederholter Abgleich legt keine weiteren Wertpapierakten an. Mehrere eigene Altpläne derselben Notierung behalten ihre Referenzen; fremde Konten, Währungen und Aktiengattungen bleiben getrennt. Eine ausgeschaltete alte Überwachung wird bei der erstmaligen Übernahme berücksichtigt.
- Nur ein ausdrücklich offener/teilverkaufter Altbestand mit positiver Stückzahl gilt als älterer tatsächlicher Bestand. Fehlender Einstand und neutrale Richtung bleiben offen. Ein geschlossener tatsächlicher Positionsdatensatz hat Vorrang vor einem älteren offenen Plan.
- Geschlossene und verworfene Pläne werden nicht als neue Kandidaten wieder angelegt. Eine ausgefallene Bewertungshistorie verhindert nicht die Anzeige der Wertpapierliste.
- Ein unklarer alter Plan kann per WKN/ISIN einer bereits gespeicherten Akte zugeordnet werden. Die geprüfte Referenz bleibt beim Öffnen der Akte erhalten. Fremde oder währungsfremde Referenzen werden abgewiesen.
- Neue Werte starten mit gespeicherten Kursen/News. Fehlendes Alpha-Secret wird vor einer Analyseanfrage erkannt. Explizit gewähltes und eingerichtetes Alpha verwendet ausschließlich diesen Anbieter; ein Fehler führt zu keinem stillen Wechsel. Providerstatus gibt nur Schlüsselvorhandensein aus.
- Der Bestandseditor verlangt tatsächliche positive Stückzahl, Einstand und eindeutige Richtung. Er überträgt absolute Einheiten und keine additiven Käufe. Doppelte Klicks und Wiederholungen nach einem unklaren Fehler behalten die Anfragereferenz.
- Eine fehlgeschlagene Bestandsabfrage blockiert das Speichern, bis die aktuellen Positionen geladen wurden. Späte private Antworten können nach einem Kontowechsel keine Felder oder Listen wieder befüllen.
- Alte Navigationsaufrufe und Nachrichtenlinks führen zur neuen Oberfläche beziehungsweise zur einzelnen Wertpapierakte. Benchmark und Verwaltung bleiben erreichbar.

## SQL-Prüfung

`scripts/check-v39-1-sql.mjs` erstellt eine lokale, bewusst kleine und streng verknüpfte Basis mit `trade_plans` und `depot_positions`. Es wendet die tatsächlichen V38-, V39- und V39.1-Migrationen an und führt die neue Schreibfunktion aus. Die Basis enthält zunächst noch keine neuen optionalen Bestandsfelder, damit deren additive Ergänzung tatsächlich geprüft wird.

Geprüft werden wiederholbare Migration, serverseitige Rechte, Konto-/Positions-/Plan-Zuordnung, absolute Bestandsänderung, getrennte Einstandswerte, positive numerische Eingaben einschließlich NaN/Infinity-Abweisung, unterstützte Typen, RLS der Anfragereferenzen, aktive Analysesperre, Rollback, Plan-Neuanlage ohne zusätzliche alte Telegramfreigabe sowie Schließen realer und expliziter älterer Bestände. Identische Wiederholungen erzeugen keine Doppelposition. Eine späte Wiederholung eines früheren Speichervorgangs öffnet einen inzwischen geschlossenen Bestand nicht erneut.

Die Analysesperre und Bestandsänderungen sperren dieselbe Wertpapierzeile. Die SQL-Tests prüfen die tatsächlichen Funktionen und aktive Lease-Abweisung; sie ersetzen keinen parallelen Lasttest mit mehreren Supabase-Verbindungen. Für den bestehenden Zeitplan werden `cron`, `net` und `vault` weiterhin durch kontrollierte Schnittstellen nachgebildet; dabei wird keine HTTP-Anfrage gesendet.

## Erhaltene Kernfunktionen

`app.js`, `news.js`, `decision.js`, `analytics.js`, `event-analysis.js`, `supabase.js` und `startdaten.json` sind bytegleich zur V39-Grundlage. 35 vorhandene Dateien unter `supabase/functions` bleiben ebenfalls bytegleich. Die bisherige Authentifizierung, ursprüngliche News-/Telegram-Functions und ihre Zeitpläne wurden nicht umgeschrieben. Die neuen Hauptrouten ersetzen die alten sichtbaren Fachansichten; deren DOM und Daten bleiben für die bestehenden Controller erhalten.

Die neue Bestandsmaske schreibt auf ausdrückliche Benutzereingabe tatsächliche Positionen. Beim Schließen wird der zugehörige alte Plan erst dann geschlossen und dessen Überwachung beendet, wenn keine offene tatsächliche Position dieses Plans mehr existiert. Neue Bestandspläne schalten die alte Telegram-Alarmüberwachung nicht automatisch ein. Die separate neue Überwachung arbeitet weiterhin ohne automatische KI.

Der neue Workflow führt die Versions-, Migrations-, JavaScript- und SQL-Prüfungen aus und deployt ausschließlich `review-investments`. Der Dateivergleich und Prüfsummen des endgültigen Pakets stehen in `RELEASE-MANIFEST-V39.1.json`.

## Reproduzieren und Grenzen

```sh
npm ci --ignore-scripts --no-audit --no-fund
node scripts/set-version.mjs --check
node scripts/build-update-sql.mjs --check
npm test
npm run check:sql
```

Keine Liveinstallation, kein Zugriff auf das tatsächliche Depot, kein Anbieterabruf mit deinen Schlüsseln, keine Billing-Änderung und kein gerenderter Browser-/iPhone-Test. Die lokale kontrollierte Basistabelle bestätigt die SQL-Logik, nicht alle möglichen zusätzlichen Constraints oder Trigger einer unbekannten Zielinstallation. Der konkrete VW-Datensatz im Zielprojekt wurde nicht ausgelesen.

Gespeicherte Kurse werden durch eine Newsprüfung nicht aktueller. Ohne ausreichend aktuelle Historie gibt es keine vollständige aktuelle Chartanalyse. Die übernommenen Newsregeln bleiben eine begrenzte Ereignisprüfung; Suchtreffer sind zunächst Metadaten. Bestehende Anbieterlimits, Abdeckungsgrenzen und manuelle KI-Freigaben gelten weiter. Nach Installation gemäß `INSTALLATION-V39.1.md` die echten Daten, den Hintergrundlauf und die mobile Bedienung prüfen.
