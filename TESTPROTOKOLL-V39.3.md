# V39.3.0 — Prüfnachweise

Datum: 16.11.2026. Ausgangsstand: vollständiges V39.2.0-Paket mit SHA-256 `f3b5e0924d629c7f3bfb239407ac3228570ffcb04aee3811d41d1050835d1b68`.

## Ergebnis

- `npm test`: **512 Tests bestanden**, keine Fehler, keine übersprungenen Tests. Enthält 477 bisherige Tests und 35 neue Chart-/Datenwegprüfungen.
- `npm run check:sql`: **169 SQL-Prüfungen bestanden** in PostgreSQL/PGlite: 72 V38, 12 V39, 35 V39.1, 50 V39.2. Cron-/Net-/Vault-Schnittstellen sind dort nachgebildet; kein HTTP-Versand.
- Die Version verwendet die vorhandenen Datenbankstrukturen. Für ein vollständig aktives V39.2-System ist kein neues SQL erforderlich.

## Neue Prüfungen

| Bereich | Nachweis |
| --- | --- |
| Depotgrafik | Einzelpunkt sichtbar; unveränderte Bewertungen einschließlich Betrag 0 als waagerechte Linie; keine Null-/Leer-/Zukunftswerte oder fremde Währung als erfundene Werte. |
| Darstellung | Endliche SVG-Koordinaten und sichtbare Datengeometrie bei 280, 320, 375 und 900 Pixeln sowie ungültigen Breiten; keine NaN-/Infinity-Ausgabe. Konkrete Linienfarben und Marker. |
| Bedienung | Zeitraum und Schieberegler ändern die vorhandene Grafik ohne Anbieter-/KI-Aufruf. Aktueller Wert und Datum stehen als Text unter der Grafik. |
| Historische Daten | Exakter Eigentümer, Notierung, Aktiengattung und Währung. Nur echte OHLCV-/Einzelkursdaten; Szenariopfade werden nicht als Historie benutzt. |
| Gesperrte Modelle | Veralteter/gesperrter Prognosebericht bleibt gesperrt; echte historische Kurve ist trotzdem sichtbar. |
| Datenquellen | Vorhandener Cache, aktuelle und ältere Analyseberichte sowie alte Deep-/Signalhistorien werden genutzt. Fehlende Alttabellen verhindern den Cachechart nicht. |
| Datenabruf | `get_chart_series` führt ausschließlich Lesezugriffe aus, keine Quotenreservierung, Mutation, externe Kurs- oder Modellanfrage. Beschränkung auf eigene IDs und maximal 24 Werte pro Anfrage. |
| Nur Kurs aktualisieren | CSV-Import speichert Kurse ohne neuen Analysebericht, KI oder neues erfolgreiches Analysedatum. Geänderte Kurse markieren die bisherige Einschätzung als erneut zu prüfen. |
| Anbieterfehler | HTTP 429 der öffentlichen Quelle erhält Preis und vorhandene Historie. Keine EODHD-Ersatzanfrage. |
| Depotmessung | Gleiche Bewertungsbasis am selben Tag dedupliziert; spätere tatsächlich erfasste Tage werden auch bei unverändertem Wert gespeichert. Ausgelassene Tage werden nicht aufgefüllt. |
| Teilausfall | Nicht erreichbare Verlaufstabelle lässt aktuellen Depotwert und Bestände sichtbar. |
| Beobachtungsvergleich | Gemeinsamer Start- und Endtag, mindestens zwei gemeinsame Daten, Index 100, keine Summierung verschiedener Währungen. |
| Sitzung | Logout leert Chartdaten und Einbettungen; verspätete Antwort eines anderen Kontos füllt sie nicht wieder. Identitätswechsel blendet die vorherige Grafik aus. |
| Gleichzeitige Antworten | Ein früher gestarteter langsamer History-Lesezugriff überschreibt keinen später ausdrücklich aktualisierten Chart. |
| Externe Anzeige | Eindeutige Börsenkennung, Bestätigung, feste Containerhöhe, sichtbare Quellenkennung, Fehlerstatus, Entfernung und Begrenzung auf acht Listenwidgets. Keine Depot-/Schlüsselparameter im Widget. |
| Kein stilles Speichern | Kursbutton für ungespeicherten Wert löst keinen impliziten Merken-/Analyseaufruf aus. |

Die drei neuen PostgreSQL-Integrationstests verwenden die tatsächlichen installierten V38–V39.2-SQL-Funktionen und den tatsächlichen API-/UI-Controller: Position → Depot-Punkt/Minichart; CSV-Kursimport → Depot/Beobachtung/Wertpapiergrafik ohne Analyse; Eigentümertrennung der tatsächlichen Kurscachetabellen. Die DOM-Adapter prüfen die erzeugte Grafik und die Ereignislogik, sie sind kein Browserrenderer.

## Grenzen der Prüfung

Kein Deployment in GitHub oder Supabase durchgeführt. Produktive Daten, zusätzliche eigene Trigger, echte Providerkontingente und die gehostete Website wurden nicht live geprüft. Kein Browser-, Screenshot- oder gerenderter iPhone-Test durchgeführt. Mobile Größen wurden anhand der Grafikgeometrie, Markup-/CSS-Eigenschaften und tatsächlicher Controllerereignisse geprüft.

TradingView-Einbettung gegen offizielle Dokumentation vorbereitet; beide verwendeten offiziellen JavaScript-Ressourcen waren beim textuellen HTTP-Abruf erreichbar (HTTP 200). Die laufenden Widgets, die Abdeckung bestimmter Wertpapiere und aktuelle Marktwerte wurden nicht gerendert oder live verifiziert. Fremde Widgetkurse fließen nicht in eigene Berechnungen ein.

Der Depotwertverlauf enthält ausschließlich gespeicherte Messungen, keine erfundene Vergangenheit und keine um Zahlungsströme bereinigte Performance. Ein einzelner echter Punkt wird sichtbar dargestellt, kann aber noch keine zeitliche Entwicklung belegen.
