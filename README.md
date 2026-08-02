# Investition Dashboard V29.4 + V30.1 Event- & Szenarioanalyse

Dieses Paket enthält den vollständigen, konsistenten V29.4-Stand und integriert die V30-Funktion **als eigene Seite innerhalb der vorhandenen Navigation**.

## Ergebnis

Die Navigation enthält zusätzlich:

```text
◇ Event- & Szenarioanalyse
```

Die neue Seite nutzt dieselbe Supabase-Anmeldung wie das Dashboard. Eine zweite Login-Seite ist nicht erforderlich.

## Korrektur V30.1 – unabhängige Investmentideen

- Marktideen werden bei jedem Bestandsabgleich separat erzeugt – auch bei „nur Portfolio“ oder „kein Bestandsabgleich“.
- Die Themen- und Wirkungsmuster wurden deutlich erweitert.
- Erkannte Szenarien liefern mindestens vier themenspezifische Kandidaten.
- Nicht eindeutig klassifizierbare Eingaben liefern mindestens sechs gekennzeichnete Recherchekandidaten statt einer leeren Liste.
- Ein Wert kann gleichzeitig als Marktidee und als Portfolio-/Watchlistwert erscheinen; die Marktidee wird nicht mehr durch eine Dublettenprüfung entfernt.
- Chancen, Risiken, Absicherungen und Recherchekandidaten werden getrennt dargestellt.

## Trennung vom Bestand

V30 liest vorhandene Daten aus:

- `depot_positions` – nur offene Positionen;
- `trade_plans` – Watchlist und bestehende Analysen;
- `market_news` – bereits synchronisierte und bewertete Dashboard-News.

V30 verändert diese Tabellen nicht. Ergebnisse werden ausschließlich in eigenen Tabellen gespeichert:

- `event_analyses`
- `event_analysis_assets`
- `event_analysis_scenarios`
- `event_analysis_sources`
- `event_analysis_signals`

Bestehende News-Syncs, Telegram-Alerts, Digest-Berichte und die drei Cronjobs bleiben unverändert.

## Neue Komponenten

- `event-analysis.js` – integrierte Oberfläche, Function-Aufruf, Historie und Ergebnisdarstellung;
- `setup-v30-event-analysis.sql` – eigene Tabellen, Indizes und RLS;
- `supabase/functions/analyze-market-event/index.ts` – Recherche, Portfolio-/Watchlistabgleich, Ideen und Szenarien;
- `supabase/functions/_shared/event-idea-engine.mjs` – vom Bestand unabhängige Themen-, Peer- und Rückfalllogik;
- `diagnose-v30-event-analysis.sql` – Datenbankdiagnose;
- erweiterte Navigation in `index.html` und `news.js`;
- erweiterter Deployment-Workflow für die vierte Edge Function.

## Recherche und Bewertung

Die erste integrierte Fassung kombiniert:

- vorhandene V29.4-Market-News;
- GDELT;
- Google News RSS;
- regelbasierte Ereignis- und Wertschöpfungskettenmodelle;
- Portfolio- und Watchlistabgleich;
- Base-, Bull- und Bear-Szenario;
- Einpreisungsstatus aus bereits bewerteten V29.4-News, soweit verfügbar.

Die Ergebnisse sind Entscheidungsunterstützung und keine garantierte Prognose oder individuelle Anlageberatung.

## Installation

Verbindlich ist [`INSTALLATION-V29.4-V30.md`](./INSTALLATION-V29.4-V30.md).
