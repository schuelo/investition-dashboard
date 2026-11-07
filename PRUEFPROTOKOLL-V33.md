# Prüfprotokoll V33.0 — 18.10.2026

- Basis: zuletzt gelieferter V32.0.1-Startfix.
- `node --test tests/*.test.mjs`: 195 bestanden, 0 fehlgeschlagen, 0 übersprungen (165 bestehende und 30 neue Tests).
- Engine: Sommerzeit-Eröffnungen, keine rückwirkenden Käufe, gleiche Tagesdaten, Kosten, Kapital-/Risikobegrenzung, KI-Quellen-/Zeitfilter, Stop-Gaps, Stop-vor-Ziel, nachgelagerter Trailing-Stop, Ablauf von Orders, Revisions-/Sprung-Sperre, wiederholte Aktualisierung ohne doppelte Ausführungen.
- Tatsächlicher Edge-Handler mit injizierten Testadaptern: Sitzungsprüfung vor Zugriff, Owner-Filter, keine Fremddepots, CSV ohne Cache-Schreiben, atomarer Versionskonflikt wird als Fehler angezeigt.
- Tatsächliches UI-Skript mit DOM-Adaptern: keine API-Aufrufe beim Laden/Auth-Wechsel, private Anzeigen werden geleert, Status bei fehlender Auswahl, Fehlerfeedback und Doppelklicksperre.
- SQL statisch geprüft auf RLS, zusammengesetzte Owner-Fremdschlüssel, Service-only-Schreibfunktion und atomare Versionsprüfung.
- Quellvergleich: 76 bestehende Dateien byte-identisch. Nur `index.html` und `supabase/config.toml` wurden ausschließlich additiv erweitert. Entfernt man die neuen Panel-/CSS-/Script-/Sprunglink-Zeilen, ist die alte HTML-Datei exakt wiederhergestellt.
- Keine bestehende Function, kein News-/Telegram-Code, keine alte Migration und kein vorhandener Workflow geändert oder gelöscht.

Nicht geprüft: tatsächliche PostgreSQL-Migration, echte Supabase-Netzwerkaufrufe, GitHub-Deployment, Live-Weboberfläche, reale Anbieterpreise/-Lizenzen und Handelsperformance. UI-Tests sind keine Browserprüfung. Das Paket ist nicht live installiert. Nach Installation einen Testlauf und die Owner-Isolation mit getrennten Testbenutzern prüfen, bevor es dauerhaft genutzt wird.
