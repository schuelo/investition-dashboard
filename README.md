# Investition Dashboard V29.0 – Market Intelligence

V29.0 basiert vollständig auf V28.2. Die Korrekturen für Modal-Überlagerung,
gemeinsame Supabase-Sitzung, deployfähige Edge Functions und CORS bleiben
erhalten.

## Neu in V29

- nachvollziehbare Scores von 0 bis 100 für Relevanz, Vertrauen, Auswirkung und
  Dringlichkeit;
- persönlicher Relevanzaufschlag für Depot- und Watchlist-Bezug;
- Einpreisungsindikation aus tatsächlicher Kursreaktion relativ zur üblichen
  Tagesbewegung;
- verzögerte Live-Kurse für sehr aktuelle Meldungen und End-of-Day-Reaktionen
  für ältere Meldungen;
- Ereignisklassifikation und Wirkungsrichtung;
- Analystenbild aus erkannten Up-/Downgrades sowie verfügbarem
  EODHD-Konsenskursziel;
- konkrete, nach Portfolio/Watchlist und Wirkungsrichtung differenzierte
  Handlung;
- sichtbare Datenqualität, Bewertungszeitpunkt und Methodik;
- V29-Scores in Entscheidungszentrale, Analytics und Telegram;
- direkter Browser-Aufruf der `sync-news`-Function mit klaren HTTP-Fehlern;
- Teilfehlertoleranz: News werden auch gespeichert, wenn einzelne Kurs- oder
  Fundamentalendpunkte nicht verfügbar sind;
- V28-Kompatibilitätsmodus, falls das neue SQL-Schema beim ersten Test noch
  fehlt.

## Bewertungsprinzip

Die Bewertung ist regel- und datenbasiert. Sie kombiniert:

1. direkten Symbol-, Depot- oder Watchlist-Bezug;
2. Ereignistyp und Schlüsselbegriffe;
3. EODHD-News-Sentiment;
4. Aktualität;
5. beobachtete Kursreaktion und Normalbewegung;
6. verfügbare Konsenskursziel- beziehungsweise Analystensignale.

Einpreisung wird ausdrücklich als Indikation dargestellt, nicht als beweisbare
Tatsache. Bei fehlender Datengrundlage erfindet das Dashboard keine Aussage,
sondern zeigt `unklar` oder `nicht verfügbar`.

## Installation

Die vollständige Schrittfolge steht in
[`INSTALLATION-V29.md`](./INSTALLATION-V29.md).

Kurzfassung:

1. Paketinhalt in das GitHub-Repository laden.
2. `version29-market-intelligence-schema.sql` in Supabase ausführen.
3. unter GitHub **Actions → Supabase Functions deployen → Run workflow**
   starten;
4. `reset.html?v=29.0` öffnen;
5. unter **News Feed → Feed aktualisieren** testen.
