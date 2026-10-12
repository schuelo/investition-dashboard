# Prüfprotokoll V32.0

Stand: 11.10.2026. Basis: verfügbarer V31.2-Stand auf V29.4 + V30.1.1. Ein anderer Originalstand vom 09.10.2026 war nicht verfügbar.

**162 Tests bestanden, 0 Fehler, 0 übersprungene Tests.**

Ausgeführt mit Node 24:

    node --test tests/*.test.mjs

Alle 124 bestehenden Tests bestehen weiterhin. Die neuen Tests prüfen die tatsächlichen Module und die tatsächliche TypeScript-Edge-Function nach Entfernen der Typannotationen mit isolierten Auth-/Datenbank-/Provideradaptern.

## Geprüft

- Zeitfenster, Grenzen, fehlerhafte Eingaben, lange OHLCV-Historien, alte Kerzen, vollständige Wochen und Ausschluss zukünftiger Kerzen.
- Sechs reproduzierbare, unterschiedliche Szenarien und geordnete Modellbänder.
- Historische Chartvergleiche ohne unvollständig bekannte Folgeperioden oder überlappende Vergleichsfenster.
- Budget, Kosten beider Seiten, Exposure-Limits, bestätigte Währungsumrechnung und gesperrte Kandidaten.
- KO-Berührung trotz Erholung, Hoch-/Tief-Berührung und Short-Barrieren.
- Gesperrte Produktentscheidungen bei fehlenden Bedingungen, FX oder Beobachtungsart.
- Faktor-Pfadabhängigkeit, nichtnegative Werte, Black-Scholes gegen numerische Call/Put-Referenz und Auszahlung bei Verfall.
- Auswertungen mit Originaldatum, Horizontende, unverändertem Original und Preisbasis nach Split.
- Quellen-Deduplizierung, kurze Auszüge, Metadaten-/Primärdatenstatus, feste Rechercheendpunkte, keine künftigen/abgelaufenen/irrelevanten Belege.
- Manuelle Startpflicht, fremde Historien/Trigger vor Quote/IO abgewiesen, Tageslimit.
- Ein KI-Versuch bei Kontingentfehler, kein OpenAI/Such-Grounding-Fallback, Kostenbestätigung und explizite Free-Tier-Modellliste.
- KI darf nur gelesene Auszüge/Primärdaten referenzieren; Archiv-/Historienfehler sind sichtbar.
- SEC-Jahresperioden, Einheiten, Einreichungszeitpunkte; zukünftige und quartalsweise Werte ausgeschlossen.
- Tatsächliche Edge-Authentifizierung, Benutzerbindung von Reads/Writes, eigene Auswertungen ohne Überschreiben des Originals.
- Reale UI-Eventhandler, Demo, DOM-IDs, Doppelklickschutz und Verwerfen alter Antworten bei Sitzungswechsel.
- Links, Anmeldung, News-/Sichtbarkeitsevents starten keine KI.
- Bestehende Telegram-/Portfolio-/Rechenregressionen weiter erfolgreich.

## Grenzen der Prüfung

- Kein Produktiv-Deployment und keine SQL-Ausführung in Supabase.
- Keine echten Gemini/EODHD/SEC-Aufrufe mit Benutzerschlüsseln.
- Datenbankrechte/Unveränderlichkeit statisch und über echte Edge-Adapter geprüft; PostgreSQL/RLS nicht live ausgeführt.
- UI-Tests mit DOM-/Schnittstellenadaptern. Echte Browser-Layoutprüfung nicht möglich: Chromium fehlt und Browserdownload lieferte keine verwertbaren Bytes.
- TypeScript-Handler unter Node ausgeführt; kein Deno-CLI-Typecheck, da Deno nicht installiert ist.
- Kein Beleg einer statistisch validierten Handelsstrategie.

## Modultrennung

Neue Function: supabase/functions/analyze-deep-signal/index.ts.

Neue Kernmodule: deep-engine.mjs, deep-service.mjs, deep-sources.mjs und deep-fundamentals.mjs im bestehenden _shared/-Ordner.

Neue Oberfläche: deep-analysis.js, deep-analysis.css und additive Einbettung in index.html. deep-analysis-panel.html ist die Referenz des bereits eingebetteten Fragments; kein zusätzlicher HTML-Fetch erforderlich.

Neue Tabellen: deep_analyses, deep_sources, deep_analysis_notes, deep_evaluations, deep_evaluation_usage. Keine neuen Cronjobs.

V31-News-Bot und V31-Engine-/Service-/UI-Dateien bleiben byteidentisch. Die neue Function ist separat konfiguriert und deploybar.
