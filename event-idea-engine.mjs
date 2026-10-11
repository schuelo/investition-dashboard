// V30.1 – unabhängige Marktideen-Engine für Event- & Szenarioanalysen.
// Reine Funktionen: keine Supabase-, Portfolio- oder Benutzerabhängigkeit.

export const IDEA_ENGINE_VERSION = '30.1-independent-market-ideas';

export function normalizeEventText(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[-–—]+/g, ' ')
    .replace(/[^a-z0-9+:/%]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const C = (name, symbol, role, score, reason, aliases = []) => ({
  name, symbol, role, score, reason, aliases: [name, symbol, ...aliases].filter(Boolean),
});

export const EVENT_THEMES = [
  {
    id: 'rare-earths',
    terms: ['seltene erden', 'rare earth', 'neodym', 'dysprosium', 'permanentmagnet', 'magnet export'],
    sectors: ['Rohstoffe', 'Elektromobilität', 'Windkraft', 'Rüstung', 'Halbleiter'], tone: -1,
    positiveAliases: ['mp materials', 'lynas', 'energy fuels', 'rare earth'],
    negativeAliases: ['volkswagen', 'bmw', 'mercedes', 'vestas', 'siemens gamesa'],
    candidates: [
      C('MP Materials', 'NYSE:MP', 'winner', 68, 'Nicht-chinesische Förderung und Verarbeitung seltener Erden.'),
      C('Lynas Rare Earths', 'ASX:LYC', 'winner', 66, 'Etablierte alternative Lieferkette außerhalb Chinas.'),
      C('Energy Fuels', 'NYSEAMERICAN:UUUU', 'winner', 55, 'Aufbau einer nordamerikanischen Lieferkette für kritische Mineralien.'),
      C('Volkswagen Vz.', 'XETR:VOW3', 'loser', -52, 'Mögliche Kosten- und Verfügbarkeitsrisiken bei Permanentmagneten.'),
    ],
  },
  {
    id: 'semiconductor-controls',
    terms: ['ki chip export', 'ai chip export', 'chip exportkontroll', 'halbleiter exportkontroll', 'chip embargo', 'technologie embargo', 'exportbeschrankung chip'],
    sectors: ['Halbleiter', 'KI', 'Rechenzentren', 'Cloud', 'Halbleiterausrüstung'], tone: -1,
    positiveAliases: ['tsmc', 'broadcom', 'marvell', 'globalfoundries'],
    negativeAliases: ['nvidia', 'sk hynix', 'amd', 'applied materials', 'lam research'],
    candidates: [
      C('TSMC', 'NYSE:TSM', 'winner', 44, 'Strategische Fertigungsposition; mögliche regionale Kapazitätsverlagerung, zugleich regulatorisches Risiko.'),
      C('GlobalFoundries', 'NASDAQ:GFS', 'winner', 48, 'US-nahe Fertigung kann bei Regionalisierung und Förderprogrammen profitieren.'),
      C('Broadcom', 'NASDAQ:AVGO', 'winner', 40, 'Diversifizierte KI- und Netzwerkinfrastruktur mit kundenspezifischen Beschleunigern.'),
      C('NVIDIA', 'NASDAQ:NVDA', 'loser', -58, 'Direktes Umsatz- und Produktmixrisiko bei verschärften Exportkontrollen.'),
      C('SK Hynix', 'KRX:000660', 'loser', -45, 'China- und Speicherexponierung kann durch Restriktionen und Gegenmaßnahmen belastet werden.'),
    ],
  },
  {
    id: 'oil-up',
    terms: ['olpreis steigt', 'oil price rises', 'brent steigt', 'wti steigt', 'olpreis uber 100', 'opec kurzt', 'forderkurzung', 'olangebot sinkt', 'ol embargo'],
    sectors: ['Energie', 'Transport', 'Chemie', 'Luftfahrt', 'Konsum'], tone: -1,
    positiveAliases: ['exxon', 'shell', 'chevron', 'bp', 'totalenergies'],
    negativeAliases: ['lufthansa', 'ryanair', 'basf', 'carnival'],
    candidates: [
      C('Exxon Mobil', 'NYSE:XOM', 'winner', 62, 'Hoher Cashflow-Hebel auf steigende Öl- und Gaspreise.'),
      C('Shell', 'NYSE:SHEL', 'winner', 58, 'Integriertes Energiegeschäft mit positivem Upstream-Hebel.'),
      C('Chevron', 'NYSE:CVX', 'winner', 57, 'Direkter Ergebnishebel auf höhere Energiepreise.'),
      C('Lufthansa', 'XETR:LHA', 'loser', -55, 'Steigende Treibstoffkosten belasten Margen, abhängig vom Hedging.'),
      C('BASF', 'XETR:BAS', 'loser', -38, 'Höhere Energie- und Rohstoffkosten können Margen belasten.'),
    ],
  },
  {
    id: 'oil-down',
    terms: ['olpreis fallt', 'oil price falls', 'brent fallt', 'wti fallt', 'olangebot steigt', 'opec erhoht', 'nachfrage nach ol sinkt'],
    sectors: ['Energie', 'Transport', 'Chemie', 'Luftfahrt', 'Konsum'], tone: 1,
    positiveAliases: ['lufthansa', 'ryanair', 'basf', 'carnival'],
    negativeAliases: ['exxon', 'shell', 'chevron', 'bp', 'totalenergies'],
    candidates: [
      C('Lufthansa', 'XETR:LHA', 'winner', 50, 'Niedrigere Treibstoffkosten können die operative Marge stützen.'),
      C('Ryanair', 'NASDAQ:RYAAY', 'winner', 48, 'Hohe Treibstoffsensitivität schafft bei fallenden Preisen Ergebnisentlastung.'),
      C('BASF', 'XETR:BAS', 'winner', 34, 'Sinkende Energie- und Rohstoffkosten können Margen entlasten.'),
      C('Exxon Mobil', 'NYSE:XOM', 'loser', -48, 'Fallende Ölpreise reduzieren den Upstream-Cashflow.'),
    ],
  },
  {
    id: 'rates-cut',
    terms: ['zinssenkung', 'senkt leitzins', 'leitzins sinkt', 'rate cut', 'dovish', 'geldpolitische lockerung', 'zinswende nach unten'],
    sectors: ['Immobilien', 'Technologie', 'Versorger', 'Banken', 'Anleihen'], tone: 1,
    positiveAliases: ['vonovia', 'aroundtown', 'sap', 'nextera', 'realty income'],
    negativeAliases: ['deutsche bank', 'commerzbank', 'bank of america'],
    candidates: [
      C('Vonovia', 'XETR:VNA', 'winner', 60, 'Sinkende Finanzierungskosten und Diskontsätze stützen Immobilienwerte.'),
      C('NextEra Energy', 'NYSE:NEE', 'winner', 51, 'Kapitalintensives Wachstum wird bei niedrigeren Renditen attraktiver.'),
      C('Realty Income', 'NYSE:O', 'winner', 46, 'REIT-Bewertungen profitieren tendenziell von sinkenden Renditen.'),
      C('Deutsche Bank', 'XETR:DBK', 'loser', -32, 'Zinsmargen können unter schnellen Zinssenkungen leiden; Kreditqualität bleibt Gegenfaktor.'),
    ],
  },
  {
    id: 'rates-hike',
    terms: ['zinserhohung', 'hebt leitzins', 'leitzins steigt', 'rate hike', 'hawkish', 'geldpolitische straffung', 'hoher fur langer'],
    sectors: ['Banken', 'Immobilien', 'Technologie', 'Versorger', 'Anleihen'], tone: -1,
    positiveAliases: ['deutsche bank', 'commerzbank', 'cme group'],
    negativeAliases: ['vonovia', 'aroundtown', 'nextera', 'realty income', 'wachstumsaktien'],
    candidates: [
      C('Deutsche Bank', 'XETR:DBK', 'winner', 36, 'Höhere Zinsen können Zinsmargen stützen, sofern Kreditrisiken beherrschbar bleiben.'),
      C('CME Group', 'NASDAQ:CME', 'winner', 38, 'Zins- und Volatilitätsprodukte profitieren häufig von höherer Handelsaktivität.'),
      C('Vonovia', 'XETR:VNA', 'loser', -58, 'Höhere Finanzierungskosten und Diskontsätze belasten Immobilienwerte.'),
      C('NextEra Energy', 'NYSE:NEE', 'loser', -40, 'Kapitalintensive Projekte und hohe Duration reagieren negativ auf steigende Renditen.'),
    ],
  },
  {
    id: 'inflation-up',
    terms: ['inflation steigt', 'inflationsschub', 'preisauftrieb', 'verbraucherpreise steigen', 'cpi steigt', 'teuerung steigt'],
    sectors: ['Rohstoffe', 'Basiskonsum', 'Banken', 'Anleihen', 'Konsum'], tone: -1,
    positiveAliases: ['newmont', 'cme group', 'shell', 'exxon'],
    negativeAliases: ['adidas', 'zalando', 'vonovia', 'realty income'],
    candidates: [
      C('Newmont', 'NYSE:NEM', 'hedge', 42, 'Goldproduzenten können als Inflations- und Risikoabsicherung profitieren.'),
      C('CME Group', 'NASDAQ:CME', 'winner', 34, 'Höhere Zins- und Inflationsvolatilität kann Handelsaktivität stützen.'),
      C('Walmart', 'NYSE:WMT', 'winner', 28, 'Skaleneffekte und preisorientierte Nachfrage können Marktanteile stützen.'),
      C('Vonovia', 'XETR:VNA', 'loser', -42, 'Steigende Renditen und Finanzierungskosten können Bewertungsdruck erzeugen.'),
    ],
  },
  {
    id: 'copper-tightness',
    terms: ['kupferpreis steigt', 'kupfer knapp', 'copper shortage', 'copper deficit', 'kupferangebot sinkt', 'kupfernachfrage steigt'],
    sectors: ['Bergbau', 'Stromnetze', 'Elektromobilität', 'Erneuerbare Energien', 'Industrie'], tone: 1,
    positiveAliases: ['freeport', 'bhp', 'rio tinto', 'southern copper', 'aurubis'],
    negativeAliases: ['automobil', 'kabel', 'netzausrustung', 'siemens energy'],
    candidates: [
      C('Freeport-McMoRan', 'NYSE:FCX', 'winner', 66, 'Hoher operativer Hebel auf Kupferpreise.'),
      C('Southern Copper', 'NYSE:SCCO', 'winner', 62, 'Große Kupferreserven und hohe Preissensitivität.'),
      C('BHP', 'NYSE:BHP', 'winner', 48, 'Große Kupferbasis bei zusätzlicher Rohstoffdiversifikation.'),
      C('Siemens Energy', 'XETR:ENR', 'loser', -30, 'Höhere Materialkosten können projektbezogene Margen belasten.'),
    ],
  },
  {
    id: 'trade-barriers',
    terms: ['zoll', 'tariff', 'handelskrieg', 'trade war', 'importabgabe', 'exportverbot', 'lokalisierungsquote', 'protektionismus'],
    sectors: ['Automobil', 'Industrie', 'Konsum', 'Logistik', 'Halbleiter'], tone: -1,
    positiveAliases: ['lokale produktion', 'domestic', 'union pacific', 'globalfoundries'],
    negativeAliases: ['volkswagen', 'bmw', 'mercedes', 'nike', 'apple', 'basf'],
    candidates: [
      C('Union Pacific', 'NYSE:UNP', 'winner', 32, 'Regionalisierung nordamerikanischer Lieferketten kann Binnenlogistik stützen.'),
      C('GlobalFoundries', 'NASDAQ:GFS', 'winner', 38, 'Lokale Fertigung kann bei Handelsbarrieren und Förderprogrammen profitieren.'),
      C('Volkswagen Vz.', 'XETR:VOW3', 'loser', -54, 'Hohe grenzüberschreitende Produktions- und Absatzabhängigkeit.'),
      C('Apple', 'NASDAQ:AAPL', 'loser', -45, 'Komplexe globale Lieferkette und China-Exponierung.'),
    ],
  },
  {
    id: 'defense-spending',
    terms: ['verteidigungsausgaben', 'rustungsausgaben', 'nato ausgaben', 'defense spending', 'aufrustung', 'munition nachfrage', 'geopolitische eskalation', 'krieg eskaliert'],
    sectors: ['Rüstung', 'Cybersecurity', 'Energie', 'Luftfahrt', 'Rohstoffe'], tone: -1,
    positiveAliases: ['rheinmetall', 'leonardo', 'bae systems', 'lockheed', 'northrop'],
    negativeAliases: ['lufthansa', 'touristik', 'chemie', 'automobil'],
    candidates: [
      C('Rheinmetall', 'XETR:RHM', 'winner', 68, 'Direkter Hebel auf europäische Verteidigungsbudgets und Munitionsnachfrage.'),
      C('Leonardo', 'MIL:LDO', 'winner', 58, 'Breites europäisches Verteidigungs- und Luftfahrtportfolio.'),
      C('BAE Systems', 'LSE:BA.', 'winner', 57, 'Langfristige Auftragsbücher und hohe NATO-Exponierung.'),
      C('Lufthansa', 'XETR:LHA', 'loser', -36, 'Geopolitische Risiken können Routen, Nachfrage und Treibstoffkosten belasten.'),
    ],
  },
  {
    id: 'recession',
    terms: ['rezession', 'recession', 'konjunktureinbruch', 'nachfrageruckgang', 'hard landing', 'industrieproduktion bricht ein', 'arbeitslosigkeit steigt'],
    sectors: ['Zyklischer Konsum', 'Industrie', 'Banken', 'Rohstoffe', 'Basiskonsum'], tone: -1,
    positiveAliases: ['walmart', 'procter', 'unilever', 'gold', 'newmont'],
    negativeAliases: ['automobil', 'chemie', 'maschinenbau', 'bank', 'luxus'],
    candidates: [
      C('Walmart', 'NYSE:WMT', 'winner', 46, 'Defensiver Konsum und mögliche Marktanteilsgewinne bei preissensibler Nachfrage.'),
      C('Procter & Gamble', 'NYSE:PG', 'winner', 42, 'Robuste Basiskonsum-Nachfrage und starke Marken.'),
      C('Newmont', 'NYSE:NEM', 'hedge', 30, 'Gold kann bei Risikoaversion und sinkenden Realrenditen stützen.'),
      C('Caterpillar', 'NYSE:CAT', 'loser', -52, 'Hohe Zyklik gegenüber Bau-, Rohstoff- und Investitionsnachfrage.'),
    ],
  },
  {
    id: 'energy-costs-europe',
    terms: ['strompreis steigt', 'energiepreise steigen', 'gaspreis steigt', 'erdgas knapp', 'energiekrise', 'strommangel', 'gaslieferung stoppt'],
    sectors: ['Versorger', 'Chemie', 'Metalle', 'Industrie', 'Energie'], tone: -1,
    positiveAliases: ['rwe', 'equinor', 'shell', 'constellation energy'],
    negativeAliases: ['basf', 'covestro', 'thyssenkrupp', 'aurubis'],
    candidates: [
      C('RWE', 'XETR:RWE', 'winner', 44, 'Erzeugungsportfolio kann bei höheren Großhandelspreisen profitieren; Regulierung bleibt Risiko.'),
      C('Equinor', 'NYSE:EQNR', 'winner', 52, 'Hohe europäische Gasexponierung.'),
      C('Constellation Energy', 'NASDAQ:CEG', 'winner', 45, 'CO₂-arme Grundlast kann bei knapper Stromversorgung an Wert gewinnen.'),
      C('BASF', 'XETR:BAS', 'loser', -58, 'Hohe Energieintensität und europäische Produktionsbasis.'),
      C('Covestro', 'XETR:1COV', 'loser', -48, 'Energie- und Gaspreise sind wesentliche Margentreiber.'),
    ],
  },
  {
    id: 'grid-data-centers',
    terms: ['rechenzentrum strombedarf', 'data center power', 'strombedarf ki', 'netzausbau', 'stromnetz investition', 'transformatoren knapp', 'elektrifizierung beschleunigt'],
    sectors: ['Stromnetze', 'Rechenzentren', 'Elektrifizierung', 'Versorger', 'Halbleiter'], tone: 1,
    positiveAliases: ['eaton', 'schneider electric', 'abb', 'vertiv', 'quanta services'],
    negativeAliases: ['stromengpass', 'netzengpass'],
    candidates: [
      C('Eaton', 'NYSE:ETN', 'winner', 65, 'Schalttechnik und Stromverteilung profitieren von Elektrifizierung und Rechenzentren.'),
      C('Schneider Electric', 'EPA:SU', 'winner', 63, 'Energie-Management und Rechenzentrumsinfrastruktur.'),
      C('Vertiv', 'NYSE:VRT', 'winner', 62, 'Strom- und Kühltechnik für Rechenzentren.'),
      C('Quanta Services', 'NYSE:PWR', 'winner', 56, 'Netzausbau und Hochspannungsinfrastruktur.'),
      C('ABB', 'NYSE:ABB', 'winner', 50, 'Elektrifizierung, Automatisierung und Netzinfrastruktur.'),
    ],
  },
  {
    id: 'ai-capex',
    terms: ['ki investitionen steigen', 'ai capex', 'hyperscaler investieren', 'ki boom', 'gpu nachfrage steigt', 'rechenzentrum ausbau', 'generative ai nachfrage'],
    sectors: ['KI', 'Halbleiter', 'Cloud', 'Rechenzentren', 'Netzwerk'], tone: 1,
    positiveAliases: ['nvidia', 'broadcom', 'tsmc', 'arista', 'vertiv'],
    negativeAliases: ['legacy software', 'dienstleister ohne ki'],
    candidates: [
      C('NVIDIA', 'NASDAQ:NVDA', 'winner', 66, 'Direkter Hebel auf KI-Beschleuniger und Rechenzentrumsinvestitionen.'),
      C('Broadcom', 'NASDAQ:AVGO', 'winner', 58, 'Netzwerkchips und kundenspezifische KI-Beschleuniger.'),
      C('Arista Networks', 'NYSE:ANET', 'winner', 54, 'Hochgeschwindigkeitsnetzwerke für KI-Cluster.'),
      C('Vertiv', 'NYSE:VRT', 'winner', 51, 'Strom- und Kühlinfrastruktur für Rechenzentren.'),
      C('TSMC', 'NYSE:TSM', 'winner', 49, 'Fertigung führender KI-Chips; geopolitisches Risiko bleibt zentral.'),
    ],
  },
  {
    id: 'cybersecurity',
    terms: ['cyberangriff', 'ransomware', 'datenleck', 'cybersecurity', 'it sicherheit', 'kritische infrastruktur gehackt', 'zero day'],
    sectors: ['Cybersecurity', 'Cloud', 'Kritische Infrastruktur', 'Versicherungen', 'IT-Dienstleistungen'], tone: -1,
    positiveAliases: ['palo alto', 'crowdstrike', 'fortinet', 'cloudflare', 'zscaler'],
    negativeAliases: ['versicherung', 'betreiber kritischer infrastruktur'],
    candidates: [
      C('Palo Alto Networks', 'NASDAQ:PANW', 'winner', 58, 'Breite Security-Plattform und steigender Schutzbedarf.'),
      C('CrowdStrike', 'NASDAQ:CRWD', 'winner', 54, 'Endpoint- und Cloud-Security mit hoher Relevanz bei Angriffswellen.'),
      C('Fortinet', 'NASDAQ:FTNT', 'winner', 46, 'Netzwerksicherheit und Security-Appliances.'),
      C('Cloudflare', 'NYSE:NET', 'winner', 38, 'Netzwerk-, DDoS- und Zero-Trust-Schutz.'),
      C('Munich Re', 'XETR:MUV2', 'loser', -24, 'Steigende Cyber-Schadenlast kann Versicherungsrisiken erhöhen; Prämieneffekt wirkt gegenläufig.'),
    ],
  },
  {
    id: 'lithium-battery',
    terms: ['lithiumpreis steigt', 'lithium knapp', 'batterienachfrage steigt', 'battery shortage', 'ev batterie boom', 'batteriefabrik ausbau'],
    sectors: ['Lithium', 'Batterien', 'Elektromobilität', 'Rohstoffe', 'Chemie'], tone: 1,
    positiveAliases: ['albemarle', 'sqm', 'catl', 'lithium americas'],
    negativeAliases: ['automobilhersteller', 'batteriekosten'],
    candidates: [
      C('Albemarle', 'NYSE:ALB', 'winner', 58, 'Hohe Lithiumpreissensitivität und globale Produktionsbasis.'),
      C('Sociedad Química y Minera', 'NYSE:SQM', 'winner', 52, 'Großer Lithiumproduzent mit hoher Preisexponierung.'),
      C('CATL', 'SHE:300750', 'winner', 38, 'Skalenvorteile und technologische Führungsposition; Rohstoffkosten bleiben Gegenrisiko.'),
      C('Volkswagen Vz.', 'XETR:VOW3', 'loser', -28, 'Steigende Batterierohstoffkosten können EV-Margen belasten.'),
    ],
  },
  {
    id: 'china-stimulus',
    terms: ['china konjunkturpaket', 'china stimulus', 'chinesische nachfrage steigt', 'immobilienhilfen china', 'china lockert', 'infrastrukturpaket china'],
    sectors: ['Rohstoffe', 'Luxus', 'Industrie', 'Automobil', 'Bergbau'], tone: 1,
    positiveAliases: ['rio tinto', 'bhp', 'lvmh', 'kering', 'bmw'],
    negativeAliases: ['china short'],
    candidates: [
      C('Rio Tinto', 'NYSE:RIO', 'winner', 50, 'Hohe Abhängigkeit von chinesischer Rohstoffnachfrage.'),
      C('BHP', 'NYSE:BHP', 'winner', 48, 'Breite Rohstoffexponierung gegenüber chinesischer Infrastruktur- und Industrienachfrage.'),
      C('LVMH', 'EPA:MC', 'winner', 38, 'China ist ein wesentlicher Treiber der globalen Luxusnachfrage.'),
      C('BMW', 'XETR:BMW', 'winner', 30, 'China bleibt ein wichtiger Absatzmarkt; Preisdruck und lokale Konkurrenz begrenzen den Hebel.'),
    ],
  },
  {
    id: 'gold-riskoff',
    terms: ['goldpreis steigt', 'risk off', 'sicherer hafen', 'bankenkrise', 'staatskrise', 'geopolitische unsicherheit', 'realzinsen fallen'],
    sectors: ['Gold', 'Bergbau', 'Finanzmärkte', 'Defensive Anlagen', 'Banken'], tone: -1,
    positiveAliases: ['newmont', 'barrick', 'agnico', 'gold'],
    negativeAliases: ['banken', 'zykliker'],
    candidates: [
      C('Newmont', 'NYSE:NEM', 'winner', 56, 'Direkter operativer Hebel auf den Goldpreis.'),
      C('Barrick Gold', 'NYSE:GOLD', 'winner', 52, 'Goldpreishebel bei diversifiziertem Minenportfolio.'),
      C('Agnico Eagle Mines', 'NYSE:AEM', 'winner', 50, 'Qualitativ hochwertige Minenbasis in vergleichsweise stabilen Regionen.'),
      C('Deutsche Bank', 'XETR:DBK', 'loser', -28, 'Breite Risikoaversion und Kreditstress können Banken belasten.'),
    ],
  },
  {
    id: 'shipping-disruption',
    terms: ['suez blockiert', 'rotes meer', 'red sea shipping', 'hafen geschlossen', 'frachter stau', 'containerpreise steigen', 'lieferkette seeweg', 'schifffahrt unterbrochen'],
    sectors: ['Schifffahrt', 'Logistik', 'Einzelhandel', 'Automobil', 'Industrie'], tone: -1,
    positiveAliases: ['maersk', 'hapag lloyd', 'zimo', 'shipping rates'],
    negativeAliases: ['automobil', 'einzelhandel', 'chemie'],
    candidates: [
      C('Hapag-Lloyd', 'XETR:HLAG', 'winner', 48, 'Steigende Frachtraten können kurzfristig die Erträge stützen; Kapazitätsrisiko bleibt hoch.'),
      C('A.P. Møller-Mærsk', 'CPH:MAERSK-B', 'winner', 42, 'Höhere Frachtraten bei globaler Netzwerkkapazität.'),
      C('DHL Group', 'XETR:DHL', 'winner', 24, 'Komplexere Lieferketten können Nachfrage nach hochwertigen Logistiklösungen erhöhen.'),
      C('Volkswagen Vz.', 'XETR:VOW3', 'loser', -34, 'Längere Lieferzeiten und höhere Logistikkosten belasten globale Produktionsketten.'),
    ],
  },
  {
    id: 'agriculture-fertilizer',
    terms: ['durrre', 'dürre', 'ernteausfall', 'agrarpreise steigen', 'dungemittel nachfrage', 'düngemittel nachfrage', 'getreide knapp', 'kalipreis steigt', 'weizenpreis steigt'],
    sectors: ['Landwirtschaft', 'Düngemittel', 'Nahrungsmittel', 'Wasser', 'Rohstoffe'], tone: -1,
    positiveAliases: ['nutrien', 'mosaic', 'k+s', 'corteva', 'deere'],
    negativeAliases: ['lebensmittelhersteller', 'fleischproduzenten'],
    candidates: [
      C('Nutrien', 'NYSE:NTR', 'winner', 54, 'Breites Düngemittelportfolio mit Hebel auf Agrarpreise und Farmer-Einkommen.'),
      C('Mosaic', 'NYSE:MOS', 'winner', 50, 'Phosphat- und Kali-Exponierung.'),
      C('K+S', 'XETR:SDF', 'winner', 44, 'Kalipreise und Düngemittelnachfrage sind zentrale Ergebnistreiber.'),
      C('Corteva', 'NYSE:CTVA', 'winner', 36, 'Saatgut und Pflanzenschutz gewinnen bei Ertragsoptimierung an Bedeutung.'),
      C('Tyson Foods', 'NYSE:TSN', 'loser', -28, 'Höhere Futtermittelpreise können Margen belasten.'),
    ],
  },
  {
    id: 'healthcare-innovation',
    terms: ['glp 1', 'adipositas medikament', 'gewichtssenker', 'neues krebsmedikament', 'medizinischer durchbruch', 'zulassung blockbuster', 'fda zulassung'],
    sectors: ['Pharma', 'Biotechnologie', 'Medizintechnik', 'Versicherungen', 'Konsum'], tone: 1,
    positiveAliases: ['novo nordisk', 'eli lilly', 'astrazeneca', 'merck'],
    negativeAliases: ['dialyse', 'medizintechnik adipositas', 'snacks'],
    candidates: [
      C('Novo Nordisk', 'NYSE:NVO', 'winner', 58, 'Führende Position bei GLP-1- und Stoffwechseltherapien.'),
      C('Eli Lilly', 'NYSE:LLY', 'winner', 58, 'Breite Pipeline und starke Position bei Adipositas- und Diabetesmedikamenten.'),
      C('AstraZeneca', 'NASDAQ:AZN', 'winner', 38, 'Breite Onkologie- und Spezialpharma-Pipeline.'),
      C('Fresenius Medical Care', 'XETR:FME', 'loser', -24, 'Langfristig könnte eine bessere Stoffwechselkontrolle Dialyseinzidenzen beeinflussen; Wirkung ist unsicher.'),
    ],
  },
  {
    id: 'climate-water',
    terms: ['wasserknappheit', 'uberschwemmung', 'überschwemmung', 'hitzewelle', 'klimaschaden', 'trinkwasser knapp', 'wasserinfrastruktur', 'extremwetter'],
    sectors: ['Wasser', 'Infrastruktur', 'Versicherungen', 'Landwirtschaft', 'Bau'], tone: -1,
    positiveAliases: ['xylem', 'veolia', 'quanta services', 'eaton'],
    negativeAliases: ['versicherung', 'munich re', 'swiss re'],
    candidates: [
      C('Xylem', 'NYSE:XYL', 'winner', 54, 'Wasseraufbereitung, Pumpen und digitale Wasserinfrastruktur.'),
      C('Veolia', 'EPA:VIE', 'winner', 46, 'Wasser-, Abfall- und Umweltinfrastruktur.'),
      C('Quanta Services', 'NYSE:PWR', 'winner', 36, 'Wiederaufbau und resiliente Energieinfrastruktur.'),
      C('Munich Re', 'XETR:MUV2', 'loser', -30, 'Höhere Naturkatastrophenschäden können die Schadenquote belasten; Prämienanpassungen wirken zeitverzögert.'),
    ],
  },
];

const GENERIC_FALLBACKS = [
  {
    id: 'supply-shortage',
    terms: ['knappheit', 'engpass', 'lieferstopp', 'angebot sinkt', 'produktion fallt aus', 'mine geschlossen', 'fabrik geschlossen'],
    sectors: ['Lieferketten', 'Rohstoffe', 'Industrie'], tone: -1,
    candidates: [
      C('BHP', 'NYSE:BHP', 'research', 24, 'Breiter Rohstoffproduzent als möglicher Profiteur knapper physischer Märkte.'),
      C('Rio Tinto', 'NYSE:RIO', 'research', 22, 'Rohstoffexponierung als möglicher Angebotsknappheits-Hebel.'),
      C('Schneider Electric', 'EPA:SU', 'research', 18, 'Automatisierung und Effizienzlösungen können bei Lieferketten- und Kapazitätsumbau relevant werden.'),
      C('BASF', 'XETR:BAS', 'research', -22, 'Rohstoff- und Lieferkettenkosten können industrielle Margen belasten.'),
    ],
  },
  {
    id: 'demand-boom',
    terms: ['nachfrage steigt', 'boom', 'investitionen steigen', 'kapazitat wird ausgebaut', 'auftragsboom', 'wachstum beschleunigt'],
    sectors: ['Industrie', 'Infrastruktur', 'Technologie'], tone: 1,
    candidates: [
      C('Eaton', 'NYSE:ETN', 'research', 28, 'Elektrifizierung und Kapazitätsausbau stützen Nachfrage nach Stromverteilung.'),
      C('Schneider Electric', 'EPA:SU', 'research', 28, 'Energie-Management und Automatisierung als Querschnittsprofiteur von Investitionszyklen.'),
      C('Caterpillar', 'NYSE:CAT', 'research', 24, 'Investitions- und Infrastrukturzyklen können Baumaschinennachfrage treiben.'),
      C('DHL Group', 'XETR:DHL', 'research', 16, 'Wachsende Warenströme können Logistikvolumen stützen.'),
    ],
  },
  {
    id: 'risk-off',
    terms: ['krise', 'panik', 'eskalation', 'unsicherheit steigt', 'marktcrash', 'schock', 'systemrisiko'],
    sectors: ['Defensive Anlagen', 'Gold', 'Basiskonsum', 'Zykliker'], tone: -1,
    candidates: [
      C('Newmont', 'NYSE:NEM', 'hedge', 30, 'Goldproduzent als möglicher Risiko- und Realzins-Hedge.'),
      C('Walmart', 'NYSE:WMT', 'research', 22, 'Defensive Basiskonsumexponierung.'),
      C('Caterpillar', 'NYSE:CAT', 'research', -24, 'Zyklische Investitionsnachfrage ist in Stressphasen anfällig.'),
      C('Lufthansa', 'XETR:LHA', 'research', -25, 'Reise- und Treibstoffrisiken reagieren häufig empfindlich auf externe Schocks.'),
    ],
  },
  {
    id: 'regulation-subsidy',
    terms: ['subvention', 'forderung', 'förderung', 'steuerbonus', 'neues gesetz', 'regulierung', 'verbot', 'pflicht', 'staatliches programm'],
    sectors: ['Regulierung', 'Industrie', 'Technologie', 'Infrastruktur'], tone: 0,
    candidates: [
      C('Schneider Electric', 'EPA:SU', 'research', 22, 'Effizienz- und Elektrifizierungslösungen sind häufig relevant bei Investitions- und Regulierungsprogrammen.'),
      C('Eaton', 'NYSE:ETN', 'research', 22, 'Elektrische Infrastruktur kann von Förder- und Modernisierungsprogrammen profitieren.'),
      C('SGS', 'SWX:SGSN', 'research', 18, 'Prüf-, Inspektions- und Zertifizierungsbedarf steigt häufig mit Regulierung.'),
      C('Volkswagen Vz.', 'XETR:VOW3', 'research', -18, 'Kapitalintensive Anpassungen an Regulierung können Margen belasten.'),
    ],
  },
];

const UNIVERSAL_RESEARCH = [
  C('Schneider Electric', 'EPA:SU', 'research', 18, 'Querschnittsexponierung zu Elektrifizierung, Automatisierung und Energieeffizienz.'),
  C('Eaton', 'NYSE:ETN', 'research', 18, 'Querschnittsexponierung zu Stromverteilung und industrieller Elektrifizierung.'),
  C('Walmart', 'NYSE:WMT', 'research', 14, 'Defensiver Basiskonsum als Vergleichswert für Nachfragerobustheit.'),
  C('Newmont', 'NYSE:NEM', 'hedge', 16, 'Goldproduzent als Vergleichswert für Risikoaversion und Realzinsen.'),
  C('Caterpillar', 'NYSE:CAT', 'research', -14, 'Zyklischer Vergleichswert für Investitions- und Konjunktureffekte.'),
  C('BASF', 'XETR:BAS', 'research', -14, 'Industrie- und Kostenvergleichswert für Energie-, Rohstoff- und Nachfrageschocks.'),
];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sourceText(sources) {
  return normalizeEventText((sources || []).map(source => `${source.title || ''} ${source.source_name || ''}`).join(' '));
}

function stemToken(token) {
  let value = String(token || '');
  if (value.length <= 3) return value;
  for (const suffix of ['ungen', 'ung', 'ern', 'en', 'er', 'es', 'em', 'e', 'n', 's', 'ing', 'ed']) {
    if (value.length - suffix.length >= 4 && value.endsWith(suffix)) {
      value = value.slice(0, -suffix.length);
      break;
    }
  }
  return value;
}

function conceptMatch(text, term) {
  if (text.includes(term)) return true;
  const textTokens = text.split(' ').filter(Boolean).map(stemToken);
  const termTokens = term.split(' ').filter(Boolean).map(stemToken);
  if (!termTokens.length) return false;
  return termTokens.every(termToken => textTokens.some(textToken => {
    if (termToken === textToken) return true;
    const shorter = Math.min(termToken.length, textToken.length);
    const longer = Math.max(termToken.length, textToken.length);
    if (shorter < 6 || shorter / longer < 0.75) return false;
    return textToken.startsWith(termToken) || termToken.startsWith(textToken);
  }));
}

function themeMatch(theme, inputText, sourcesText) {
  let score = 0;
  const matchedTerms = [];
  for (const term of theme.terms) {
    const normalizedTerm = normalizeEventText(term);
    if (!normalizedTerm) continue;
    if (conceptMatch(inputText, normalizedTerm)) {
      score += normalizedTerm.includes(' ') ? 4 : 3;
      matchedTerms.push(term);
    } else if (conceptMatch(sourcesText, normalizedTerm)) {
      score += normalizedTerm.includes(' ') ? 2 : 1;
      matchedTerms.push(term);
    }
  }
  return {score, matchedTerms: unique(matchedTerms)};
}

export function classifyEvent(input, sources = []) {
  const inputText = normalizeEventText(input);
  const sourcesText = sourceText(sources);
  const hits = EVENT_THEMES.map(theme => ({theme, ...themeMatch(theme, inputText, sourcesText)}))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(item => ({...item.theme, matchScore: item.score, matchedTerms: item.matchedTerms}));
  return {
    hits,
    sectors: unique(hits.flatMap(theme => theme.sectors)).slice(0, 12),
  };
}

export function getEventTone(input, hits = []) {
  const text = normalizeEventText(input);
  let tone = hits.reduce((sum, theme) => sum + Number(theme.tone || 0), 0);
  if (/beschrank|verbot|embargo|krieg|eskal|knapp|mangel|stopp|zoll|rezession|einbruch|fallt aus|schaden/.test(text)) tone -= 1;
  if (/forderung|foerderung|subvention|senkung|wachstum|boom|lockerung|genehmigung|einigung|investitionen steigen/.test(text)) tone += 1;
  return tone > 0 ? 1 : tone < 0 ? -1 : 0;
}

function mentioned(candidate, combinedText) {
  return candidate.aliases.some(alias => {
    const value = normalizeEventText(alias);
    return value.length >= 3 && combinedText.includes(value);
  });
}

function roleLabel(role) {
  if (role === 'winner') return 'potenzieller Gewinner';
  if (role === 'loser') return 'Risiko-/Short-Kandidat';
  if (role === 'hedge') return 'mögliche Absicherung';
  return 'Recherchekandidat';
}

function mergeCandidate(map, candidate, context) {
  const key = normalizeEventText(candidate.symbol || candidate.name);
  if (!key) return;
  const current = map.get(key);
  const absoluteScore = Math.abs(Number(candidate.score || 0));
  if (!current || absoluteScore > Math.abs(Number(current.impact_score || 0))) {
    map.set(key, {
      symbol: candidate.symbol || null,
      name: candidate.name,
      role: candidate.role,
      impact_score: Number(candidate.score || 0),
      reasoning: candidate.reason,
      theme_ids: context.themeId ? [context.themeId] : [],
      matched_terms: context.matchedTerms || [],
      match_score: context.matchScore || 0,
      fallback: Boolean(context.fallback),
      source_mentioned: Boolean(context.sourceMentioned),
    });
    return;
  }
  current.theme_ids = unique([...(current.theme_ids || []), context.themeId]);
  current.matched_terms = unique([...(current.matched_terms || []), ...(context.matchedTerms || [])]);
  if (context.sourceMentioned) current.source_mentioned = true;
  if (!current.reasoning.includes(candidate.reason)) current.reasoning += ` ${candidate.reason}`;
}

export function buildIndependentMarketIdeas({input, sources = [], baseConfidence = 45, pricingState = 'unklar', horizon = '1–6 Monate', minimumIdeas = 6, maximumIdeas = 12} = {}) {
  const classification = classifyEvent(input, sources);
  const tone = getEventTone(input, classification.hits);
  const combinedText = normalizeEventText(`${input || ''} ${sourceText(sources)}`);
  const map = new Map();
  const inferredSectors = [...classification.sectors];
  const targetIdeas = classification.hits.length ? Math.min(Number(minimumIdeas || 6), 4) : Number(minimumIdeas || 6);

  for (const theme of classification.hits) {
    for (const candidate of theme.candidates) {
      mergeCandidate(map, candidate, {
        themeId: theme.id,
        matchedTerms: theme.matchedTerms,
        matchScore: theme.matchScore,
        sourceMentioned: mentioned(candidate, combinedText),
      });
    }
  }

  // Direkte Unternehmensnennungen in Eingabe oder Quellen ergänzen auch dann Peers,
  // wenn das Szenario nicht exakt auf einen Themenbegriff passt.
  for (const theme of EVENT_THEMES) {
    const mentionedCandidates = theme.candidates.filter(candidate => mentioned(candidate, combinedText));
    if (!mentionedCandidates.length) continue;
    for (const candidate of theme.candidates) {
      mergeCandidate(map, candidate, {
        themeId: theme.id,
        matchedTerms: ['Unternehmens-/Peer-Bezug'],
        matchScore: 2,
        sourceMentioned: mentioned(candidate, combinedText),
      });
    }
  }

  if (map.size < targetIdeas) {
    const text = normalizeEventText(input);
    const fallbackHits = GENERIC_FALLBACKS.map(theme => ({theme, ...themeMatch(theme, text, sourceText(sources))}))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
    for (const item of fallbackHits) {
      inferredSectors.push(...(item.theme.sectors || []));
      for (const candidate of item.theme.candidates) {
        mergeCandidate(map, candidate, {
          themeId: `fallback:${item.theme.id}`,
          matchedTerms: item.matchedTerms,
          matchScore: item.score,
          fallback: true,
          sourceMentioned: mentioned(candidate, combinedText),
        });
      }
      if (map.size >= targetIdeas) break;
    }
  }

  // Letzte technische Rückfallebene: niemals leere Marktideen, aber klar als
  // niedrig-konfidente Recherchekandidaten kennzeichnen.
  if (map.size < targetIdeas) {
    for (const candidate of UNIVERSAL_RESEARCH) {
      const adjusted = {...candidate};
      if (tone > 0 && adjusted.score < 0) adjusted.score = Math.round(adjusted.score * 0.75);
      if (tone < 0 && adjusted.score > 0 && adjusted.role === 'research') adjusted.score = Math.round(adjusted.score * 0.8);
      mergeCandidate(map, adjusted, {
        themeId: 'fallback:universal-research',
        matchedTerms: ['keine eindeutige Themenzuordnung'],
        matchScore: 0,
        fallback: true,
        sourceMentioned: mentioned(adjusted, combinedText),
      });
      if (map.size >= targetIdeas) break;
    }
  }

  const ideas = [...map.values()].map(item => {
    const specificTheme = (item.theme_ids || []).some(id => id && !id.startsWith('fallback:'));
    const confidence = Math.max(25, Math.min(94, Math.round(
      Number(baseConfidence || 45)
      + Math.min(Number(item.match_score || 0) * 3, 18)
      + (item.source_mentioned ? 8 : 0)
      - (item.fallback ? 14 : 0)
      - (!specificTheme ? 4 : 0)
    )));
    const opportunity = Math.max(5, Math.min(95, Math.round(
      38 + Math.abs(Number(item.impact_score || 0)) * 0.72 + (item.source_mentioned ? 6 : 0) - (item.fallback ? 8 : 0)
    )));
    const evidence = item.source_mentioned
      ? 'Das Unternehmen oder ein enger Peer wird in Eingabe/Quellen genannt.'
      : specificTheme
      ? 'Die Idee stammt aus einem zum Ereignis passenden Branchen- und Wirkungsmuster.'
      : 'Niedrig-konfidente Rückfallhypothese; vor einer Handlung ist eine gezielte Unternehmensrecherche erforderlich.';
    return {
      ...item,
      company_name: item.name,
      idea_type: item.role,
      idea_label: roleLabel(item.role),
      confidence_score: confidence,
      opportunity_score: opportunity,
      pricing_state: pricingState,
      time_horizon: horizon,
      reasoning: `${item.reasoning} ${evidence}`,
    };
  }).sort((a, b) => {
    const aSpecific = a.fallback ? 0 : 1;
    const bSpecific = b.fallback ? 0 : 1;
    if (aSpecific !== bSpecific) return bSpecific - aSpecific;
    return Number(b.opportunity_score || 0) - Number(a.opportunity_score || 0);
  }).slice(0, maximumIdeas).map((idea, index) => ({...idea, idea_rank: index + 1}));

  return {
    ideas,
    hits: classification.hits,
    sectors: unique(inferredSectors).slice(0, 12),
    tone,
    used_fallback: ideas.some(idea => idea.fallback),
  };
}
