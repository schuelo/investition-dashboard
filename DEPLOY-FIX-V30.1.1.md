# Deployment-Fix V30.1.1

## Ursache des fehlgeschlagenen GitHub-Actions-Laufs

Der Workflow prüfte in `supabase/functions/analyze-market-event/index.ts` noch auf die alte Build-Kennung:

```text
30.0-integrated-event-scenario-analysis
```

Die aktuelle Function verwendet jedoch:

```text
30.1-independent-market-ideas
```

Der Befehl `grep -q` fand die alte Kennung nicht und beendete deshalb den Schritt
`V29.4- und V30-Konsistenz prüfen` mit Exit Code 1. Die Functions wurden in diesem Lauf noch nicht deployt.

## Korrektur

- Konsistenzprüfung auf die tatsächliche V30.1-Build-Kennung umgestellt.
- Prüfung der neuen Datei `_shared/event-idea-engine.mjs` ergänzt.
- Fehlermeldungen nennen künftig die konkret fehlende Datei oder Kennung.
- Prüfung des GitHub-Secrets `SUPABASE_ACCESS_TOKEN` ergänzt.
- Die Supabase-CLI bleibt auf der für V29.4 getesteten Version `2.110.0` fixiert.

## Verwendung

Entweder nur folgende Datei im Repository ersetzen:

```text
.github/workflows/deploy-supabase-functions.yml
```

oder das vollständige V30.1.1-Paket hochladen.

Danach unter GitHub **Actions → Supabase Functions deployen → Run workflow** erneut starten.

Die Node.js-Warnung zu Actions mit Node.js 20 ist eine GitHub-Hinweismeldung und nicht die Ursache des Exit Codes 1.
