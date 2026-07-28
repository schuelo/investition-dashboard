# Investition Dashboard V29.1 – Market Intelligence

V29.1 korrigiert die Einpreisungsanalyse aus V29.0 und übernimmt alle bisherigen
Dashboard-Funktionen.

## Korrekturen in V29.1

- leere EODHD-Zahlen werden nicht mehr als `0` interpretiert;
- fehlendes `adjusted_close` fällt auf den tatsächlichen Schlusskurs zurück;
- Branchen- und Makromeldungen erhalten einen transparent ausgewiesenen
  Markt-Proxy;
- Meldungen vor der nächsten Handelssitzung erscheinen als `noch zu früh`;
- fehlende Kursdaten erscheinen als `nicht messbar`;
- vorhandene Kursreaktionen führen auch bei gemischtem Textsignal zu einer
  abgestuften Einpreisungsindikation;
- Statuszeile zeigt geladene Kursreihen, Live-Kurse, Markt-Proxys und die
  Verteilung der Einpreisungsstatus.

## Bewertungsprinzip

Die regel- und datenbasierte Einordnung kombiniert:

1. Symbol-, Depot- und Watchlist-Bezug;
2. Ereignistyp und Nachrichtensignal;
3. Aktualität;
4. tatsächliche Kursreaktion;
5. übliche Tagesbewegung;
6. verfügbare Analysten- und Konsensdaten.

`Weitgehend`, `teilweise` und `eher nicht` sind Indikationen, keine beweisbaren
Tatsachen oder individuellen Anlageempfehlungen. Die Bewertungsgrundlage nennt
Kursquelle, Messfenster und einen gegebenenfalls verwendeten Markt-Proxy.

## Aktualisierung

Die vollständige Schrittfolge steht in
[`INSTALLATION-V29.1.md`](./INSTALLATION-V29.1.md).

Kurzfassung:

1. Paketinhalt nach GitHub laden.
2. GitHub Action **Supabase Functions deployen** starten.
3. `reset.html?v=29.1` online öffnen.
4. **News Feed → Feed aktualisieren** wählen.

Von V29.0 auf V29.1 ist keine neue SQL-Migration erforderlich. Bei einer
Neuinstallation weiterhin einmal
`version29-market-intelligence-schema.sql` ausführen.
