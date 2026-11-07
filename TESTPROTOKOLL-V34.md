# Prüfprotokoll V34.0.0 — 01.11.2026

## Ergebnis

228 automatisierte Tests, 228 bestanden, keine fehlgeschlagenen oder übersprungenen Tests. Zusätzlich Versionsgenerator im Prüfmodus und Generator der gemeinsamen Migration geprüft.

## Neue Prüfungen

- Validierung von maximal zehn eindeutigen HTTPS-Quellen vor Kontingentverbrauch und externen Abrufen.
- Öffentliche Zieladressen, IP-gebundene Verbindung mit TLS-Prüfung des ursprünglichen Hosts, erneute Prüfung bei Weiterleitungen und Sperre privater/gemischter DNS-Antworten. Keine Dashboard-/Service-/Gemini-Zugangsdaten im Webseitenabruf.
- Zeitlimit einschließlich DNS, begrenzte parallele Abrufe, Größenlimit, HTTP-Chunking, Gzip und Abbruch bei übergroßer Dekomprimierung.
- HTML-/Textauszüge, Entfernung von Skripten/Navigation, kurze Archivbelege, Texthash, eindeutige Statuswerte bei PDF/Blockade/Fehler.
- Eigene Links werden auch ohne automatische Suche gelesen. Ausgeschaltete KI führt zu keinem Provider-Aufruf. Mehrere Quellen fließen in einen einzelnen manuellen Gemini-Aufruf ein.
- Quellenstatus und -IDs bleiben im Analysebericht erhalten; längere Texte werden nur transient an Gemini übergeben, nicht als Volltext gespeichert.
- Tatsächlicher Edge-Handler authentifiziert die URL-Vorabprüfung, führt dabei keine Analyse oder Kontingentreservierung aus und bindet die gespeicherten Quellen an den angemeldeten Benutzer.
- Tatsächliches UI-Skript: URL-Übergabe, Fehlerfeedback, Schutz vor stiller Auslassung durch einen alten Server, Löschen eigener URLs bei Sitzungswechsel, HTML-Escaping von Quelltexten.
- Versionsgenerator hält zentrale Metadaten, sichtbare Login-Angabe, statische Fallbacks, Modulkennung und Cache-Verweise synchron. Tatsächliche Worker-Logik bevorzugt aktuelle Skripte und löscht keine fremden App-Caches.
- Neuer Gesamtworkflow veröffentlicht ausschließlich Deep-Analyse und Papierdepot, nach Tests und Versionsprüfung.

## Bestehende Prüfungen

Die bisherigen 195 Tests wurden mitgeführt. Nur Erwartungen an die bewusst erneuerte sichtbare Version und die neue Cache-Kennung wurden aktualisiert; bestehende Verhaltenstests bleiben erhalten. Core-Frontend, reale Depotfunktionen, News-/Telegram-Funktionen, V31-Signalmodul und die V33-Papierdepot-Logik wurden nicht geändert.

## Grenzen

Netzwerkabrufe und Supabase-Zugriffe sind in den Tests durch kontrollierte Adapter ersetzt. Die Tests sind kein Nachweis für die Erreichbarkeit beliebiger Verlagsseiten, reale Gemini-Antwortqualität oder eine erfolgreiche Installation im Zielprojekt. Keine Datenbankmigration, echtes Function-Deployment oder Live-Browserprüfung vorgenommen. Nach Installation ist ein manueller Test mit dem gewählten Wertpapier und einer eigenen öffentlichen Quelle erforderlich.
