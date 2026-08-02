# Testprotokoll V30.1 – Event- & Szenarioanalyse

## Prüfziel

Geprüft wurde, ob die Investmentideen fachlich und technisch unabhängig von Portfolio und Watchlist entstehen und ob verschiedene Ereigniseingaben zuverlässig Kandidaten liefern.

## Gefundene Ursachen im V30.0-Integrationsstand

1. Marktideen wurden nur erzeugt, wenn `analysis_scope` exakt den Wert `portfolio_watchlist_market` hatte.
2. Die Ereigniszuordnung umfasste nur acht fest hinterlegte Themen. Nicht erkannte Szenarien lieferten keine Kandidaten.
3. Portfolio, Watchlist und Marktideen nutzten dieselbe Symbol-Deduplizierung. War ein Wert bereits im Bestand, wurde seine Marktidee entfernt.

## Korrektur in V30.1

- Der Markt-Scan läuft bei jedem Bestandsabgleich separat.
- Portfolio, Watchlist und Marktideen besitzen getrennte Deduplizierungsräume.
- Ein Wert darf gleichzeitig als Bestandswert und als unabhängige Marktidee erscheinen.
- Die Ideen-Engine umfasst zusätzliche Muster für Rohstoffe, Zinsen, Energie, Halbleiter, KI, Stromnetze, Cybersecurity, Logistik, Düngemittel, Wasser, Gesundheit und weitere Marktmechanismen.
- Erkannte Ereignisse liefern mindestens vier themenspezifische Kandidaten.
- Nicht eindeutig erkannte Ereignisse liefern mindestens sechs niedrig-konfidente Recherchekandidaten und werden sichtbar als Rückfallhypothese markiert.

## Getestete Szenarien

| Szenario | Erkanntes Thema | Ideen | Beispielhafte Ergebnisse | Rückfallebene |
|---|---|---:|---|---|
| China beschränkt Exporte seltener Erden | Seltene Erden | 4 | MP Materials, Lynas Rare Earths, Energy Fuels, Volkswagen Vz. | Nein |
| USA verschärfen KI-Chip-Exportkontrollen | Halbleiter-Exportkontrollen | 5 | NVIDIA, GlobalFoundries, TSMC, SK Hynix, Broadcom | Nein |
| Ölpreis steigt über 100 USD | Steigender Ölpreis | 5 | Exxon Mobil, Shell, Chevron, Lufthansa, BASF | Nein |
| EZB senkt Zinsen schneller als erwartet | Zinssenkung | 4 | Vonovia, NextEra Energy, Realty Income, Deutsche Bank | Nein |
| Cyberangriff legt europäische Häfen lahm | Cybersecurity | 5 | Palo Alto Networks, CrowdStrike, Fortinet, Cloudflare, Munich Re | Nein |
| Strombedarf von KI-Rechenzentren steigt | Stromnetze/Rechenzentren | 5 | Eaton, Schneider Electric, Vertiv, Quanta Services, ABB | Nein |
| Dürre treibt Agrar- und Düngemittelpreise | Landwirtschaft/Düngemittel | 5 | Nutrien, Mosaic, K+S, Corteva, Tyson Foods | Nein |
| Neue Umweltabgabe auf autonome Industrieroboter | keine eindeutige Zuordnung | 6 | Schneider Electric, Eaton, Newmont, Walmart, Caterpillar, BASF | Ja |

## Technische Prüfungen

- 40 automatisierte Fach- und Konsistenztests: erfolgreich.
- Browser-JavaScript und Service Worker: Syntax erfolgreich.
- Vier Edge Functions: TypeScript-Syntax erfolgreich.
- Neue Ideen-Engine: Node-Syntax erfolgreich.
- Navigation, Cache-Busting und V30.1-Schema: erfolgreich.
- Test ohne Portfolio- oder Watchlistdaten: Ideen werden vollständig erzeugt.
- Test mit Quellenbezug: direkte Unternehmensnennung erhöht den Confidence Score.
- Test für unbekannte Szenarien: keine leere Ideenliste.

## Fachliche Grenze

Die Rückfallebene ist bewusst konservativ. Sie erzeugt Recherchekandidaten, keine bestätigten Kauf- oder Short-Signale. Vor einer Handlung müssen Unternehmensbezug, Einpreisung, aktuelle Meldungen, Bewertung und technische Bestätigung geprüft werden.
