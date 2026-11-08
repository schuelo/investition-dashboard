# Prüfprotokoll V35.0.0 — 08.11.2026

273 Tests bestanden, 0 fehlgeschlagen, 0 übersprungen. Ausgangspunkt: das zuletzt gespeicherte V34.0.0-Gesamtpaket, dessen ZIP-Inhalt vor Übernahme per SHA-256 geprüft wurde.

## Neue Funktionsprüfungen

- WKN-/ISIN-Normalisierung einschließlich führender Nullen und ISIN-Prüfziffer; keine Namensähnlichkeit als Identitätsnachweis.
- OpenFIGI-WKN-/FIGI-Identität gegen EODHD-ISIN geprüft; abweichende Aktien-/ETF-Klassen und gleichlautende Ticker anderer Emittenten ausgeschlossen.
- Mehrere verifizierte Notierungen, bevorzugter Handelsplatz, begrenzte zweite Suche und verwertbare Teiltreffer bei erschöpftem Budget.
- Fehlende Währung/ISIN und widersprüchliche Katalogkennungen werden abgewiesen; keine Umdeutung von GBP/GBX; keine erfundene US-Chartbörse.
- Eigener Sieben-Tage-Cache mit je Handelsplatzpräferenz getrennten Schlüsseln; keine neuen Anbieterabfragen bei frischem Cache.
- Tatsächlicher Edge-Handler authentifiziert vor Cache-/Anbieterzugriff, ignoriert fremde User-IDs, verwendet den vorhandenen EODHD-Budget-RPC und schreibt ausschließlich den Owner-Cache.
- Keine Gemini-Abhängigkeit, kein kostenpflichtiges Anbieter-Fallback, keine direkte Änderung realer Portfolios oder bestehender Zeitpläne.
- Tatsächliches Frontend-Skript: alle sieben Eingabebereiche, kein Abruf beim Laden, Übergabe an die eigene Function, Übernahme mit vorhandenen Input-/Change-Listenern, Enter startet nur die Suche, Doppelklicksperre.
- Sitzungswechsel, verworfene Suche und inzwischen geänderte Formulare übernehmen keine verspäteten Resultate. Ausstehende WKN-Übernahme blockiert einen versehentlichen Analysestart mit alten Symbolen.
- Trade-Plan füllt EODHD- und Chartkennung sowie Name/Währung/WKN/ISIN; bei geänderter Identität werden alte Kursmarken geleert. KO-Produktkennung bleibt getrennt vom Basiswert.
- Deep-Analyse setzt beim Wechsel fremde EPS-/CIK-/Produkt-/FX-Annahmen zurück; Kapital, eigener Kontext und eigene URLs bleiben bestehen.
- Papierdepot wird nur für neue Experiment-Eingaben befüllt, mit bestehenden Börsen-/Währungs- und Maximalzahlregeln. Historie, CSV und Eventtext werden nur im jeweiligen Zielbereich angepasst.
- Release-Generator, gemeinsame SQL-Datei und Gesamtworkflow geprüft. Die zentrale Anmeldung-/Cache-Version ist 35.0.0.

Die 228 bisherigen Tests bleiben erhalten. Die neue Suite ergänzt 45 Tests. Die bisherigen Kernskripte für Portfolio, Entscheidungen, News, Telegram, Signal-/Deep-/Papierdepot-Ausführung sind im Verhalten unverändert. Release-Strings und Asset-Versionen in den Deep-Dateien werden zentral fortgeschrieben.

## Grenzen

Anbieter-HTTP, Supabase-Zugriffe und native DOM-Ereignisse wurden mit kontrollierten Testadaptern geprüft. Keine Live-Abfrage mit dem EODHD-Token des Nutzers, keine reale SQL-Migration, kein GitHub-/Supabase-Deployment und kein Live-Browsertest durchgeführt. Anbieterabdeckung, tatsächliche Verfügbarkeit einzelner WKNs und die Chartverfügbarkeit einer bestätigten TradingView-Kennung sind deshalb nach Installation gesondert zu prüfen.
