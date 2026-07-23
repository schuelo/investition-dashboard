# Investition Dashboard V28.0 – Portfolio Intelligence

V28 erweitert das Professional-Dark-Dashboard um eine eigenständige Analyseebene für das tatsächliche Depot. Die neue Seite **Portfolio Intelligence** wertet ausschließlich offene Datensätze aus `depot_positions` aus; geplante Stückzahlen aus Trade-Setups werden nicht als Investment gezählt.

## Neue Funktionen

- Portfolioentwicklung über speicherbare Cloud-Snapshots
- aktueller Depotwert, investiertes Kapital, unrealisierter Gewinn/Verlust und Risiko bis Stop
- Investiert-vs.-Marktwert-Diagramm je Position
- Sektor- und Regionsallokation
- Risiko-Heatmap mit Gewicht, P/L, Stop-Risiko und News-Lage
- Ereignis- und Earnings-Radar aus dem vorhandenen Kalender
- News-Impact-Matrix für Depotpositionen
- wahrscheinlichkeitsgewichtete Szenario-Zielwerte
- Signal-Labor aus `signal_outcomes`
- Analysten-Rating- und Kurszielhistorie
- regelbasierter Portfolio-Check mit priorisierten nächsten Schritten
- Korrektur der Portfolioauswertung in der Entscheidungszentrale: tatsächliche Depotpositionen statt geplanter Trade-Setup-Werte

## Installation

### 1. Supabase-Schema ergänzen

Im Supabase SQL Editor ausführen:

`version28-analytics-schema.sql`

Das Script legt ausschließlich folgende neue Tabellen an:

- `portfolio_snapshots`
- `analyst_revisions`

Beide Tabellen besitzen Row Level Security und können nur vom jeweils angemeldeten Benutzer gelesen und verändert werden.

### 2. GitHub-Dateien aktualisieren

Den Inhalt des Pakets `investition-dashboard-v28-github.zip` in das Hauptverzeichnis des GitHub-Repositories hochladen und vorhandene Dateien ersetzen.

Neu hinzugekommen ist:

`analytics.js`

### 3. Cache zurücksetzen

Öffnen:

`https://schuelo.github.io/investition-dashboard/reset.html?v=28.0`

Danach „Jetzt zurücksetzen“ wählen und anschließend öffnen:

`https://schuelo.github.io/investition-dashboard/?v=28.0#analytics`

## Bedienung

In der linken Navigation beziehungsweise in der mobilen Bottom-Navigation erscheint **Portfolio Intelligence**.

Mit **Snapshot speichern** wird der aktuelle Depotstand in Supabase abgelegt. Erst mehrere Snapshots erzeugen eine Zeitreihe. Analystenänderungen können direkt im unteren Bereich der Analytics-Seite erfasst werden.

## Unverändert

Die vorhandenen V26-Edge-Functions, News-Cronjobs, Telegram-Funktionen und EODHD-Alarme bleiben unverändert. Für V28 ist keine neue Edge Function erforderlich.

## Kontrolle

`version28-diagnose.sql` prüft lesend, ob Tabellen, RLS und Policies vorhanden sind.
