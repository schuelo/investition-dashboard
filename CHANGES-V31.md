# Änderungen V31.2 – manueller Start und TRIGGER KI

Deploymentkorrektur vom 11.10.2026: Der Pakettest lässt eine verbliebene `event-analysis.html` aus älteren Installationen zu. Geprüft wird weiterhin die integrierte Eventnavigation ohne Abhängigkeit von der alten Datei. Nur Test und Dokumentation geändert; keine Änderungen an Dashboard, Functions, SQL oder Versandlogik.

Ausgangsbasis ist das unveränderte originale V29.4-/V30.1.1-Deployment-Fix-Paket. Das getrennte Signalmodul ergänzt die bisherige Oberfläche.

- KI-Aufruf ausschließlich nach ausdrücklicher manueller Analyse. Telegram-Link, Login, Navigation, Feedupdate und Auswahl einer Trigger-Meldung bereiten Daten vor und starten keine KI.
- Die bereits vorgesehene Telegram-Portfolio-News erhält zusätzlich **TRIGGER KI** und einen URL-Button. Empfänger, Nachrichtenfilter, Schwellenwerte, 8-Stunden-Fenster, bestehende Duplikatsprüfung und Versandplan bleiben gleich. Keine zweite Nachricht.
- Neue eigene Triggerliste mit Zuordnung zur Originalmeldung, zugestellten Meldungen, Vorbereitung, Zurückstellen und erfolgreicher Analyse. Fehler der neuen Speicherung blockieren den ursprünglichen Telegram-Versand nicht.
- Der Server prüft Trigger-Eigentümer und veröffentlichte Originalmeldung vor Kontingentreservierung. Eine Analyse kann nur den eigenen Trigger als analysiert markieren.
- Informativ angezeigte Charttechniken, reproduzierbare Modellpfade, illustrative Szenarien sowie bedingte Long-/Short-Einstiegs-, Stop- und Ausstiegsmarken.
- Gemini-Auswahl ausschließlich über serverseitige Secrets; sichtbarer Chartmodus bei Kontingentfehlern, ohne automatische Wiederholung oder Wechsel zu OpenAI.
- Frühere automatische Feedregeln sind entfernt. Bereits gespeicherte Ergebnisse bleiben lesbar; vorhandene alte Feedregeltabellen bleiben ungenutzt.
- Zwei additive V31-SQL-Dateien; keine Migration bestehender Basistabellen und keine neuen Cronjobs.
- Neuer manueller Workflow deployt ausschließlich die Signal-Function und die zugelassene Ergänzung des bestehenden News-Bots. Bisheriger Deployworkflow unverändert.
- Cacheversion V31.2, aktualisierte Installation und ergänzte Tests des tatsächlichen UI-, Edge- und Telegram-Codes.

## Änderungen vorhandener Dateien

`index.html` ergänzt Seite/Assets, `news.js` die Navigation; `app.js`, `service-worker.js` und `reset.html` erhalten neue Cachekennungen. `supabase/config.toml` ergänzt die neue Function. `send-news-alerts/index.ts` ergänzt den Inhalt der bestehenden Meldung und speichert ausschließlich Daten des neuen Moduls.

Die bisherigen News-Sync-, Digest- und Eventanalyse-Functions, Shared-Quellen, V29.4-/V30-SQLs, Analyse-/Decision-Komponenten und der bisherige Deployworkflow bleiben byteweise identisch. Keine produktive Installation vorgenommen.
