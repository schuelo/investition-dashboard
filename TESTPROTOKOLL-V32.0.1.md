# Prüfung V32.0.1 – 16.10.2026

    node --test tests/*.test.mjs

Ergebnis: **165 Tests erfolgreich**, 0 Fehler, 0 übersprungen.

Die bisherigen 162 Tests bestehen unverändert weiter. Zusätzlich:

- Alle vorbelegten Zahlenfelder des tatsächlichen HTML-Formulars erfüllen ihre min-/max-/step-Bedingungen. Dezimalschritte werden im Regressionstest mit ganzzahliger Skalierung exakt geprüft.
- „Bereit“ wird erst nach Initialisierung des tatsächlichen UI-Moduls angezeigt; HTML zeigt vorher den Ladestatus und referenziert die neue JS-Version.
- Der native invalid-Handler zeigt den Feldnamen und die Validierungsmeldung, öffnet den betroffenen Abschnitt, fokussiert das Feld und löst keine Analyseanfrage aus. Weitere ungültige Felder überschreiben die erste Meldung im selben Validierungsdurchlauf nicht.

Die HTML-Fragmentreferenz stimmt mit der eingebetteten Fassung überein. Alle Supabase-Dateien, SQL-Dateien, bisherigen Portfolio-/Telegrammodule und Deployment-Workflows sind byteidentisch mit V32.0. Das kleine Updatepaket enthält keine Server-/SQL-/Workflowdateien.

Die zusätzliche Browserprüfung über die lokale Testseite wurde durch die verweigerte Browser-Zugriffsfreigabe blockiert. Es erfolgte keine Prüfung in einer echten Browsersitzung. Die bestehenden UI-Integrationstests führen den tatsächlichen Modulcode mit DOM-/Schnittstellenadaptern aus; sie ersetzen keinen Live-End-to-End-Test.

Kein Gemini-/EODHD-Aufruf, keine produktiven Datenänderungen und kein Deployment.
