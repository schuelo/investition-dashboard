# Hinweis zum integrierten V30.1-Modul

Die folgenden V29.4-Prüfungen bleiben gültig. Ergänzend wurden Navigation, V30.1-Schema und unabhängige Ideen-Engine, die Function `analyze-market-event` und die vollständige Testsuite geprüft. Für den produktiven Funktionstest gilt Abschnitt 6 in [`INSTALLATION-V29.4-V30.md`](./INSTALLATION-V29.4-V30.md).

---

# Validierung V29.4

Geprüfter Paketstand: Investition Dashboard V29.4

## Erfolgreiche Prüfungen

- 40 automatisierte Fach- und Konsistenztests;
- JavaScript-Syntax aller fünf Browserdateien und des Service Workers;
- sieben unterschiedliche Ereignisszenarien erzeugen jeweils mindestens vier themenspezifische Marktideen;
- ein nicht klassifizierbares Szenario erzeugt transparente Rückfallhypothesen statt einer leeren Liste;
- Ideenlogik funktioniert ohne Portfolio- oder Watchlistdaten;
- Portfolio-/Watchlist-Überschneidungen entfernen keine Marktideen;
- TypeScript-Syntaxprüfung aller vier deploybaren Edge Functions;
- YAML-Prüfung des GitHub-Actions-Workflows;
- einheitliche V29.4-Kennungen in Frontend, Cache, Functions und
  Bewertungsmodell;
- genau vier Function-Deployments im Workflow;
- feste Supabase CLI `2.110.0`, keine `latest`-Auflösung;
- keine alten Shared-Quellenmodule im Paket;
- genau drei aktuelle Cron-Definitionen im Konsolidierungs-SQL;
- kein Secret-Platzhalter und kein Vault-Create/-Update im SQL;
- Deduplizierung automatischer Tages- und Wochenberichte;
- Sommerzeit-/Zeitzonenprüfung für `Europe/Berlin`;
- ZIP-Inhalts- und Archivprüfung.

## Erwartete Laufzeitkennungen

```text
29.4-multisource-hybrid-market-intelligence-sync
29.4-multisource-hybrid-portfolio-market-intelligence-alerts
29.4-multisource-hybrid-digest
29.4-multisource-hybrid-rule-market-intelligence
```
