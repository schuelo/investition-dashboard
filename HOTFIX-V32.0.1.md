# V32.0.1 – Startknopf der Deep-Analyse

Dieser Hotfix behebt einen Formularfehler der V32.0-Deep-Analyse. Die fünf vorbelegten Zahlenwerte für Risikobudget, Konto-/Produkt-FX, Bezugsverhältnis und IV verletzten ihre eigenen HTML-Schrittweiten. Der Browser konnte den Start deshalb vor dem JavaScript-Handler blockieren, ohne eine Statusmeldung zu setzen.

## Installation bei vorhandenem V32.0

1. Startfix-V32.0.1.zip vollständig entpacken.
2. Den Inhalt des entpackten Ordners in die Wurzel deines lokalen GitHub-Repositorys kopieren. Vorhandene gleichnamige Dateien vollständig ersetzen; Ordnerstruktur beibehalten. Keinen zusätzlichen Paketordner dazwischen anlegen.
3. In GitHub Desktop committen, zum Beispiel mit „V32.0.1 Startfix“, und Push origin wählen.
4. Das normale GitHub-Pages-Deployment abwarten.
5. Dashboard vollständig neu laden und V32.0.1 prüfen.

Die Laufzeitänderung betrifft nur index.html, deep-analysis.js und deep-analysis.css. Das Paket enthält zusätzlich die aktualisierte HTML-Fragmentreferenz, Regressionstests und diese Anleitung.

**Keine SQL-Ausführung, kein Supabase-Function-Deployment und keine neuen Secrets notwendig.** Den Workflow „V32.0 Deep-Analyse deployen“ für diesen Frontend-Hotfix nicht erneut starten.

Das vollständige Dashboard-Paket V32.0.1 ist separat verfügbar. Bei funktionierendem V32.0 genügt das kleine Startfix-Paket.

## Woran du die neue Version erkennst

Nach Laden des Moduls erscheint:

    V32.0.1 bereit. Deep-Analyse über den Startknopf manuell starten.

Bleibt „V32.0.1 wird geladen …“ stehen, wurde das JavaScript-Modul noch nicht erfolgreich initialisiert. Dann Deployment/Dateien und Browser-Konsole prüfen. Erscheint noch V32.0 ohne .1, ist die neue Frontend-Version noch nicht geladen.

JavaScript und CSS werden mit neuer Versionskennung geladen, damit die vorherige Cache-Fassung nicht den Hotfix überlagert.

## Kurzer Funktionstest

1. Optional zuerst „Synthetische Demo“ testen. Sie startet keine KI.
2. Für Schneider Electric SND.XETRA, Basiswertwährung EUR und Unternehmensname Schneider Electric eintragen.
3. „Deep-Analyse manuell starten“ klicken. Sofort muss „Analyse gestartet: Kurse und Quellen prüfen …“ erscheinen.
4. Danach wird das Ergebnis oder eine konkrete Fehlermeldung angezeigt, etwa bei fehlenden Kursdaten, Anmeldung oder Kontingent.
5. Optional ein ungültiges Risikobudget wie 10 % eingeben und starten. Der Bereich öffnet sich und die Statusanzeige benennt das fehlerhafte Feld. Es wird keine Anfrage ausgelöst.

SND ist das Xetra-Kürzel. Die tatsächliche Verfügbarkeit der historischen Kurse im gewählten EODHD-Tarif ist durch diesen Frontend-Hotfix nicht bestätigt. SBGSF ist das OTC-Kürzel und wird nicht automatisch zu einem Xetra-Symbol umgeschrieben.

## Was geändert wurde

- Gültige Schrittweiten für alle fünf vorbelegten Zahlenfelder; Mindest-/Höchstwerte bleiben erhalten.
- Native Eingabefehler werden vor dem submit-Handler abgefangen und sichtbar ausgegeben. Zugeklappte betroffene Bereiche öffnen sich.
- Die erste fehlerhafte Eingabe wird benannt und fokussiert; korrigierte Felder verlieren ihre Fehlermarkierung.
- Start- und Fehlermeldungen werden in den sichtbaren Bereich gescrollt.
- Initialisierungsstatus unterscheidet „wird geladen“ von „bereit“.

Die KI bleibt ausschließlich manuell gestartet. Bestehende Portfolio-, Telegram- und Serverfunktionen sind unverändert.

## Prüfung

165 automatisierte Tests erfolgreich, einschließlich aller 162 bisherigen Tests. Neue Prüfungen decken die gültigen Standardwerte, den sichtbaren Initialisierungsstatus sowie Fehlermeldung und Öffnen eines Formularbereichs vor einem Request ab.

Die zusätzliche echte Browserprüfung wurde durch die verweigerte Zugriffsfreigabe auf die lokale Testseite blockiert und nicht ausgeführt. Kein Live-Aufruf von Gemini, EODHD oder deinem Supabase-Projekt; kein produktives Deployment.
