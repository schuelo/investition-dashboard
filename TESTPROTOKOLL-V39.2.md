# Prüfprotokoll V39.2.0

Stand: 15.11.2026. Grundlage: das zuvor gelieferte vollständige V39.1.0-Paket, SHA-256 `fbf2ed72658d65cd805e0a2cad523a52472b30d37a2c76090e9972ec340649e2`.

## Ergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| JavaScript-Tests | **477 bestanden**, keine fehlgeschlagen oder übersprungen |
| Umfang | 462 vorhandene Tests und 15 zusätzliche V39.2-Tests |
| Tatsächliche SQL-Prüfungen in PostgreSQL/PGlite | **169 bestanden**: 72 V38, 12 V39, 35 V39.1, 50 V39.2 |
| JavaScript-Syntax | 94 Dateien |
| TypeScript-Parsing | 14 Dateien; kein Deno-Typcheck |
| Relative Modulimporte | 222 vorhanden |
| Service-Worker-Kerndateien | 45 Dateiverweise vorhanden |
| HTML | 459 eindeutige IDs; keine verschachtelten Formulare; lokale Ressourcen vorhanden |
| WKN-/ISIN-Masken | 9 eindeutige Bereiche einschließlich direkter Depotmaske |
| GitHub-Workflows | 12 YAML-Dateien parsebar |
| Version und kombinierte Migrationen | Beide Generatoren mit `--check` erfolgreich |

## Prüfung des vollständigen Depotablaufs

Der direkte Einstieg aus einem leeren Depot war zuvor nicht ausreichend in der Hauptbedienung enthalten. V39.2 prüft deshalb den tatsächlichen Einstieg **Position hinzufügen** und das tatsächliche Formular, einschließlich des Rückwegs ins Depot.

Die 14 neuen Depotablauf-Tests verwenden den tatsächlichen UI-Controller mit einem kontrollierten DOM-Adapter sowie den tatsächlichen Function-Handler. Die Datenbankabfragen und RPC-Aufrufe werden für diese Tests in SQL übersetzt und in einer echten lokalen PostgreSQL/PGlite-Laufzeit ausgeführt. Die Bestandsdaten werden dabei nicht durch eine JavaScript-Attrappe gespeichert. Ein zusätzlicher Test führt die tatsächliche WKN-Picker-Logik für den neuen Bereich aus.

Abgedeckt sind:

- Leeres Depot → Hauptbutton → Wertpapier/Stückzahl/Einstand → Speichern → sichtbarer Depotbestand. Kein vorheriger Analysebericht, kein implizites Merken/Analysieren und kein Kursanbieter-Aufruf.
- Komma als Dezimaltrennzeichen, persistierte tatsächliche Stückzahl und tatsächlicher Einstand, optionales Kaufdatum und sichtbarer investierter Betrag ohne Kursdaten.
- Neu laden und vorhandene Position bearbeiten: absolute Stückzahl ersetzen statt zusätzliche Käufe anzulegen.
- Mehrere ausdrücklich bestätigte Positionen desselben Wertpapiers und korrekter gewichteter Einstand. Unbekannter oder nicht geladener Bestand darf keine unbestätigte zusätzliche Position erzeugen.
- Eigener Bewertungskurs mit Datum von heute: Depotwert und Ergebnis werden berechnet; Chartkurs und Analysezeitpunkt bleiben unverändert. Die manuelle Bewertung wird ausdrücklich gekennzeichnet.
- Alter Chartkurs und fehlgeschlagener Anbieterabruf bleiben neben einer separaten manuellen Bewertung sichtbar.
- Schließen erfordert eine Bestätigung; der Datensatz bleibt erhalten. Eine alte Wiederholung öffnet keine später geschlossene Position wieder.
- Nach dem Speichern Rückkehr zum Depot und Zurücksetzen eines alten Filters, der den neu erfassten Wert sonst verdecken könnte.
- Identitätswechsel leert abhängige Stückzahlen, Einstand, alte Kennungen und manuelle Kursangaben, bevor ein anderer Wert gespeichert werden kann.
- Fehlende V39.2-Datenbankmigration wird sichtbar erkannt und blockiert den Schreibvorgang vor dem RPC.
- Anmeldung und Besitzer werden serverseitig geprüft. Fremde Wertpapiere können nicht bearbeitet werden. Späte Antworten nach dem Abmelden füllen keine privaten Felder oder Listen wieder auf.
- Ungültige Zahlen, NaN/Infinity, falsche Währung, Zukunftsdatum und unbestätigte Identität werden abgewiesen.
- Die neue WKN-Maske verwendet die bestehende verifizierte Zuordnung. Im unabhängigen Modus werden keine Kursmetadaten abgefragt. Übernahme speichert keine Position und startet keine KI.

Die älteren Tests bleiben erhalten. Angepasste Erwartungen betreffen die neue Berichts-Version, den eigenständigen Bestandsbildschirm und den neuen transaktionalen Speichervorgang. Die bisherigen Schutzprüfungen für doppelte Starts, unklare Speicherantworten, Quellenwahl und Kontowechsel bestehen weiter.

## SQL-Prüfung und Kompatibilität

`scripts/check-v39-2-sql.mjs` führt die tatsächliche gemeinsame Datei `setup-v39-2-depotupdate.sql` wiederholt auf einer bestehenden älteren Basis aus. Die Basistabellen enthalten für Trade-Plan- und Depot-IDs bewusst **keine UUID-Defaults**. Neue IDs werden vom neuen Speichervorgang ausdrücklich erzeugt beziehungsweise aus der eindeutigen Anfragereferenz übernommen. Damit ist eine häufige Abweichung alter Grundschemas abgedeckt.

Die 50 neuen Prüfungen betreffen serverseitige Funktionsrechte und private Anfragereferenzen, gemeinsame Anlage von Wertpapier und Position, Datums-/Zahlen-/Währungsprüfung, atomaren Rollback ohne verwaiste neue Akten, getrennte manuelle Bewertung, erhaltene Marktpreise und Analysezeiten, explizite Rückkehr zur gespeicherten Quelle, mehrere Positionen, absolute Bearbeitung, aktive Analysesperre, erhaltene deaktivierte Überwachung, Schließen und Wiederholschutz. RLS und Schreibverbote werden mit tatsächlichen PostgreSQL-Rollen geprüft.

Die bisherige V39.1-Schreibfunktion bleibt für ältere Aufrufer verfügbar. Der neue direkte Bestandseditor verwendet die V39.2-Transaktion. Die gemeinsame Update-Datei ergänzt die eventuell fehlenden Investment-Tabellen aus V38/V39/V39.1 und die neue Erweiterung, ohne vorhandene Jobs neu zu planen. Die vollständige Gesamtdatei für eine ältere V31.2-/V32-Basis bleibt ein separates Installationspaket.

## Handhabung und Konsistenz

Ein gemeinsamer Bestandseditor wird vom Depot-Hauptbutton, der Depotliste, der Wertpapierseite und der Übernahme eines beobachteten Werts verwendet. Erfassung erfordert keinen erfolgreichen Kursabruf. Bereits bekannte Positionen werden zunächst geladen. Ein Lesefehler lässt kein blindes Überschreiben zu.

Die Depotliste und Wertpapierseite verwenden dieselbe Kennzahlen-Darstellung. Investierter Betrag, Marktwert, Ergebnis zum Einstand, Kursdatum, Datenquelle und Analysezeitpunkt bleiben getrennt. Eine fehlende Bewertung wird nicht als Verlust des gesamten Einstands oder als Depotwert null ausgegeben. Ein manuell eingetragener Intradaykurs ist nur eine eigene Bewertung und keine abgeschlossene Tageskerze.

Die mobile Auslegung verwendet einspaltige Felder, aufklappbare Zusatzangaben, mindestens 44 Pixel hohe neue Aktionsflächen, 16-Pixel-Eingabeschrift und Abstand zur unteren Navigation. Verborgene Formbereiche werden ausdrücklich ausgeblendet. Das sind geprüfte Struktur-/CSS-Eigenschaften, keine gerenderte Bildschirmabnahme.

`app.js`, `news.js`, `decision.js`, `analytics.js`, `event-analysis.js`, `supabase.js` und `startdaten.json` bleiben bytegleich zur V39.1-Basis. Die neuen Wege ersetzen die alte sichtbare Fachnavigation. Alte Tabellen, Berichte, Gespräche, News-/Telegram-Functions und bestehende Zeitpläne bleiben erhalten. Der endgültige Dateivergleich steht in `RELEASE-MANIFEST-V39.2.json`.

## Reproduzieren und Grenzen

```sh
npm ci --ignore-scripts --no-audit --no-fund
node scripts/set-version.mjs --check
node scripts/build-update-sql.mjs --check
npm test
npm run check:sql
```

Kein Live-Deployment, kein Zugriff auf das produktive Depot und keine echten Anbieterabfragen mit deinen Schlüsseln. Der tatsächliche Bestand im Zielprojekt wurde nicht ausgelesen. Die lokal rekonstruierte Basistabelle kann unbekannte zusätzliche Pflichtfelder, Typänderungen oder Trigger des Zielsystems nicht vollständig nachbilden. Die PostgreSQL-Prüfung ersetzt keinen parallelen Lasttest mit mehreren Supabase-Verbindungen. Der vorhandene Zeitplan verwendet weiterhin kontrollierte `cron`-/`net`-/`vault`-Schnittstellen im Test; es wird kein echter Job oder HTTP-Aufruf erzeugt.

Keine gerenderte Browser-/iPhone-Abnahme. Ein vollständiger Funktionsdurchlauf und die mobile Darstellung müssen nach Installation im Zielprojekt geprüft werden. Die neue Versions-/Schemaanzeige unterstützt diese Prüfung.

Depotwertverlauf und Ergebnis betreffen die erfassten offenen, bewertbaren Bestände. Verkaufserlöse, Cash, Steuern und einzahlungsbereinigte Rendite werden nicht als vollständige Buchhaltung simuliert. Historische Kurse oder Bestände werden nicht aus heutigen Angaben erfunden. Der bestehende Analysen-/Trade-Plan-JSON-Export ist kein vollständiger Export der neuen tatsächlichen Depotpositionen; die Sicherung erfolgt über die Datenbank. Bestehende Anbieterlimits und manuelle KI-Freigaben bleiben bestehen.
