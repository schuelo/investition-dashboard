# Installation V29.1

V29.1 korrigiert die pauschale Anzeige `eingepreist: unklar` aus V29.0.
Website und Function-Quellcode werden über GitHub versioniert; Datenbank und
Edge Functions laufen weiterhin bei Supabase.

## Was V29.1 ändert

- `null`-Kursfelder werden nicht mehr als Kurs `0` behandelt;
- falls `adjusted_close` fehlt, wird der vorhandene Schlusskurs verwendet;
- direkte Wertpapiermeldungen erhalten den Kurskontext ihres EODHD-Symbols;
- Branchen- und Makromeldungen verwenden dokumentierte Markt-Proxys:
  - KI: `QQQ.US`
  - Halbleiter: `SOXX.US`
  - Energie: `XLE.US`
  - EUR/USD: `EURUSD.FOREX`
  - Makro/übergreifend: `SPY.US`
- eine Meldung nach Börsenschluss bleibt bis zur nächsten abgeschlossenen
  Handelssitzung `noch zu früh`;
- nur wirklich fehlende Kursdaten erscheinen als `nicht messbar`;
- die Oberfläche zeigt geladene statt nur angeforderte Kursreihen und eine
  Aufteilung der Einpreisungsstatus.

## Aktualisierung von V29.0 auf V29.1

### 1. Paket entpacken

Die ZIP vollständig auf dem PC entpacken. Nicht die ZIP-Datei selbst nach
GitHub laden.

Im entpackten Hauptordner müssen unter anderem sichtbar sein:

```text
index.html
app.js
news.js
service-worker.js
reset.html
.github/
supabase/
```

### 2. Dateien nach GitHub laden

1. Repository `investition-dashboard` öffnen.
2. **Code → Add file → Upload files** wählen.
3. Den gesamten Inhalt des entpackten V29.1-Ordners hochladen.
4. Vorhandene Dateien ersetzen.
5. Als Commit-Nachricht beispielsweise eintragen:

```text
Dashboard V29.1 Einpreisungsanalyse
```

6. **Commit changes** bestätigen.

`index.html` muss weiterhin direkt im Repository-Hauptverzeichnis liegen.

### 3. Supabase-Schema

Wenn V29.0 bereits installiert ist und die vier Scores sichtbar sind, ist
keine neue SQL-Migration erforderlich. V29.1 verwendet dieselben
Datenbankspalten.

Nur bei einer Neuinstallation oder bei der Anzeige
`SQL-Migration erforderlich`:

1. Supabase → **SQL Editor → New query** öffnen.
2. `version29-market-intelligence-schema.sql` vollständig einfügen.
3. **Run** wählen.

Das Skript ist idempotent und löscht keine Meldungen.

### 4. Edge Functions deployen

Dieser Schritt ist zwingend, weil die Korrektur serverseitig berechnet wird.

1. GitHub-Repository öffnen.
2. **Actions → Supabase Functions deployen** wählen.
3. **Run workflow** anklicken.
4. Branch `main` auswählen.
5. **Run workflow** bestätigen.
6. Den Lauf öffnen.

Diese Schritte müssen grün enden:

```text
Repository laden
Supabase CLI einrichten
News-Sync deployen
Telegram-News deployen
```

Der vorhandene GitHub-Schlüssel `SUPABASE_ACCESS_TOKEN` muss nicht geändert
werden.

Danach in Supabase unter **Edge Functions → sync-news** prüfen, ob das neueste
Deployment den aktuellen Zeitpunkt trägt.

### 5. Browser-Cache zurücksetzen

Im normalen Browser öffnen:

```text
https://schuelo.github.io/investition-dashboard/reset.html?v=29.1
```

**Jetzt zurücksetzen** wählen. Die Adresse muss mit `https://` beginnen, nicht
mit `file:///`.

Nach der Weiterleitung muss im Dashboard `V29.1` angezeigt werden.

### 6. News neu bewerten

1. Im Dashboard anmelden.
2. **News Feed** öffnen.
3. **Feed aktualisieren** wählen.
4. Den vollständigen Lauf abwarten.

Die obere Statuszeile zeigt anschließend beispielsweise:

```text
Marktdaten: 18/22 Kursreihen · 12 Live-Kurse · 5 Markt-Proxys
Bewertungen: 160 bewertet · 94 Einpreisungen · 22 zu früh · 44 nicht messbar
```

Die Werte sind Beispiele. Entscheidend ist:

- `Kursreihen` darf bei funktionierendem EODHD-Zugang nicht überall `0` sein;
- `Einpreisungen` muss bei vorhandenen Kursdaten größer als `0` sein;
- aktuelle Meldungen nach Handelsschluss dürfen `noch zu früh` sein;
- `nicht messbar` bleibt nur dort, wo kein belastbarer Kursvergleich verfügbar
  ist.

## Anzeige im Feed

Die Chips bedeuten:

| Anzeige | Bedeutung |
|---|---|
| `weitgehend` | Kursbewegung ist groß bzw. die Meldung war erwartet |
| `teilweise` | Kurs hat materiell reagiert, aber die Verarbeitung ist nicht vollständig bestätigt |
| `eher nicht` | Kursreaktion ist im Verhältnis zur Normalbewegung klein |
| `noch zu früh` | erste abgeschlossene Handelssitzung nach Veröffentlichung fehlt |
| `nicht messbar` | Kursdaten oder belastbarer Vergleich fehlen |

Im rechten Detailbereich zeigt **Bewertungsgrundlage & Grenzen** zusätzlich:

- verwendetes Wertpapier oder Markt-Proxy;
- Kursquelle;
- Messfenster;
- Kursstatus;
- Zeitpunkt der Beobachtung.

## Wenn weiterhin alles „nicht messbar“ ist

Die Anzeige **Marktdaten** oben im News Feed prüfen:

1. Steht dort `0/x Kursreihen`, liegen keine historischen EODHD-Kurse vor.
2. In Supabase unter **Edge Functions → sync-news → Logs** den letzten Lauf
   öffnen.
3. Auf Hinweise wie `HTTP 401`, `HTTP 403`, `HTTP 429` oder
   `keine Kurszeilen geliefert` prüfen.
4. Unter **Edge Functions → Secrets** kontrollieren, dass
   `EODHD_API_TOKEN` vorhanden ist.

Ein HTTP-Fehler bedeutet:

| Fehler | Bedeutung |
|---|---|
| `401` | EODHD-Token fehlt oder ist ungültig |
| `403` | Endpunkt im Tarif nicht freigeschaltet |
| `429` | API-Limit erreicht |
| leere Kursreihe | Symbol/Börsenkürzel wird von EODHD nicht gefunden |

Zur Datenbankkontrolle kann `version29-1-diagnose.sql` im Supabase SQL Editor
ausgeführt werden. Das Skript liest nur und verändert keine Daten.

## Technischer Build-Stand

Nach erfolgreichem Deployment antwortet `sync-news` mit:

```text
29.1-market-intelligence-sync
```

Die gespeicherten neuen Bewertungen tragen:

```text
29.1-rule-market-intelligence
```
