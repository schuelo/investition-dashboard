import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSESSMENT_VERSION,
  assessMarketNews
} from '../supabase/functions/_shared/market-intelligence.ts';

const bars = [
  {date:'2026-06-20', close:100, adjusted_close:100, volume:1000},
  {date:'2026-06-21', close:101, adjusted_close:101, volume:1050},
  {date:'2026-06-22', close:100.5, adjusted_close:100.5, volume:980},
  {date:'2026-06-23', close:101.2, adjusted_close:101.2, volume:990},
  {date:'2026-06-24', close:100.8, adjusted_close:100.8, volume:1020},
  {date:'2026-06-25', close:101.4, adjusted_close:101.4, volume:1100},
  {date:'2026-06-26', close:100.9, adjusted_close:100.9, volume:960},
  {date:'2026-06-27', close:101.5, adjusted_close:101.5, volume:1040},
  {date:'2026-06-28', close:101.1, adjusted_close:101.1, volume:1005},
  {date:'2026-06-29', close:101.8, adjusted_close:101.8, volume:1010},
  {date:'2026-06-30', close:101.2, adjusted_close:101.2, volume:1030},
  {date:'2026-07-01', close:102, adjusted_close:102, volume:1040},
  {date:'2026-07-02', close:101.5, adjusted_close:101.5, volume:990},
  {date:'2026-07-03', close:102.1, adjusted_close:102.1, volume:1010},
  {date:'2026-07-04', close:101.7, adjusted_close:101.7, volume:1000},
  {date:'2026-07-05', close:102.4, adjusted_close:102.4, volume:1080},
  {date:'2026-07-06', close:101.9, adjusted_close:101.9, volume:980},
  {date:'2026-07-07', close:102.6, adjusted_close:102.6, volume:1070},
  {date:'2026-07-08', close:102.1, adjusted_close:102.1, volume:1020},
  {date:'2026-07-09', close:102.8, adjusted_close:102.8, volume:1010}
];

test('positive Guidance mit Kurs- und Konsensdaten wird fundiert bewertet', () => {
  const result = assessMarketNews({
    title:'Company raises full-year guidance after record revenue',
    content:'The company raises its outlook above expectations and reports stronger margins.',
    publishedAt:'2026-07-10T08:00:00Z',
    topic:'Unternehmen',
    symbols:['TEST.US'],
    sentiment:.78,
    primarySymbol:'TEST.US',
    scope:'watchlist',
    priceBars:bars,
    liveQuote:{
      code:'TEST.US',
      timestamp:1783677600,
      close:107,
      previousClose:102.8,
      change_p:4.0856
    },
    fundamentals:{targetPrice:120, currency:'USD', updatedAt:'2026-07-09'},
    now:new Date('2026-07-10T10:30:00Z')
  });

  assert.equal(result.assessment_version, ASSESSMENT_VERSION);
  assert.equal(result.event_type, 'guidance');
  assert.equal(result.direction, 'positiv');
  assert.ok(result.relevance_score >= 70);
  assert.ok(result.price_reaction_percent > 4);
  assert.ok(result.analyst_target_upside_percent > 10);
  assert.notEqual(result.priced_in_state, 'unklar');
  assert.match(result.analyst_view, /Konsensziel/);
});

test('negative Gewinnwarnung einer Long-Position erzeugt sofortige Risikoprüfung', () => {
  const result = assessMarketNews({
    title:'Company cuts outlook and issues profit warning',
    content:'Demand is weaker and management lowers full-year margin guidance below expectations.',
    publishedAt:'2026-07-10T08:00:00Z',
    topic:'Unternehmen',
    symbols:['TEST.US'],
    sentiment:-.88,
    primarySymbol:'TEST.US',
    scope:'portfolio',
    positionDirections:['Long'],
    priceBars:bars,
    liveQuote:{
      code:'TEST.US',
      timestamp:1783677600,
      close:96.5,
      previousClose:102.8,
      change_p:-6.1284
    },
    now:new Date('2026-07-10T10:30:00Z')
  });

  assert.equal(result.direction, 'negativ');
  assert.equal(result.action_code, 'portfolio_risk_now');
  assert.ok(result.urgency_score >= 70);
  assert.match(result.recommended_action, /Stop\/Invalidierung/);
  assert.match(result.market_impact, /Negativ/);
});

test('fehlende Markt- und Analystendaten werden nicht erfunden', () => {
  const result = assessMarketNews({
    title:'Company comments on industry conference',
    content:'Management discussed long-term themes without changing its outlook.',
    publishedAt:'2026-07-10T08:00:00Z',
    topic:'Unternehmen',
    symbols:[],
    sentiment:null,
    primarySymbol:null,
    scope:'market',
    now:new Date('2026-07-10T10:30:00Z')
  });

  assert.equal(result.priced_in_state, 'unklar');
  assert.equal(result.price_reaction_percent, null);
  assert.equal(result.analyst_signal, 'nicht_verfuegbar');
  assert.match(result.analyst_view, /kostenlosen Hybrid-Modus/);
  assert.equal(result.data_quality, 'niedrig');
});

test('erwartete Meldung mit kleiner Reaktion kann weitgehend eingepreist sein', () => {
  const result = assessMarketNews({
    title:'Results in line with consensus, outlook confirmed',
    content:'Earnings were as expected and management reiterated the full-year forecast.',
    publishedAt:'2026-07-10T08:00:00Z',
    topic:'Unternehmen',
    symbols:['TEST.US'],
    sentiment:.2,
    primarySymbol:'TEST.US',
    scope:'watchlist',
    priceBars:bars,
    liveQuote:{
      code:'TEST.US',
      timestamp:1783677600,
      close:102.9,
      previousClose:102.8,
      change_p:.0973
    },
    now:new Date('2026-07-10T10:30:00Z')
  });

  assert.equal(result.priced_in_state, 'weitgehend');
});

test('fehlendes adjusted_close fällt auf close zurück und liefert EOD-Reaktion', () => {
  const result = assessMarketNews({
    title:'Company wins major contract and raises production outlook',
    content:'The new order supports higher revenue and stronger capacity utilization.',
    publishedAt:'2026-07-10T18:30:00Z',
    topic:'Unternehmen',
    symbols:['TEST.US'],
    sentiment:.65,
    primarySymbol:'TEST.US',
    priceContextSymbol:'TEST.US',
    priceContextKind:'direct',
    scope:'watchlist',
    priceBars:[
      ...bars,
      {date:'2026-07-10', close:103, adjusted_close:null, volume:1100},
      {date:'2026-07-13', close:106.5, adjusted_close:null, volume:1800}
    ],
    now:new Date('2026-07-14T08:00:00Z')
  });

  assert.ok(result.price_reaction_percent > 3);
  assert.notEqual(result.priced_in_state, 'unklar');
  assert.equal(result.analysis_basis.price_context_symbol, 'TEST.US');
  assert.equal(result.analysis_basis.price_availability, 'available');
});

test('Meldung nach Börsenschluss bleibt bis zur nächsten Sitzung zu früh', () => {
  const result = assessMarketNews({
    title:'Company raises guidance after market close',
    content:'Management reports stronger demand and increases its outlook.',
    publishedAt:'2026-07-10T20:30:00Z',
    topic:'Unternehmen',
    symbols:['TEST.US'],
    sentiment:.7,
    primarySymbol:'TEST.US',
    priceContextSymbol:'TEST.US',
    priceContextKind:'direct',
    scope:'watchlist',
    priceBars:[
      ...bars,
      {date:'2026-07-10', close:103, adjusted_close:103, volume:1100}
    ],
    liveQuote:{
      code:'TEST.US',
      timestamp:1783713600,
      close:103,
      previousClose:102.8,
      change_p:.1945
    },
    now:new Date('2026-07-11T08:00:00Z')
  });

  assert.equal(result.priced_in_state, 'zu_frueh');
  assert.match(result.priced_in, /noch keine abgeschlossene Handelssitzung/i);
});

test('gemischtes Nachrichtensignal mit deutlicher Proxy-Reaktion bleibt nicht unklar', () => {
  const result = assessMarketNews({
    title:'Semiconductor outlook shows stronger demand but higher costs',
    content:'Orders improve while capital spending and financing costs increase.',
    publishedAt:'2026-07-10T18:00:00Z',
    topic:'Halbleiter',
    sentiment:0,
    primarySymbol:null,
    priceContextSymbol:'SOXX.US',
    priceContextKind:'proxy',
    scope:'sector',
    priceBars:[
      ...bars,
      {date:'2026-07-10', close:103, adjusted_close:103, volume:1100},
      {date:'2026-07-13', close:105.5, adjusted_close:105.5, volume:1500}
    ],
    now:new Date('2026-07-14T08:00:00Z')
  });

  assert.notEqual(result.priced_in_state, 'unklar');
  assert.match(result.priced_in, /Markt-Proxy SOXX\.US/);
  assert.equal(result.analysis_basis.price_context_kind, 'proxy');
});

test('Hybridmodus weist RSS- und Kursquellen transparent aus', () => {
  const result = assessMarketNews({
    title:'Analyst upgrades company after stronger order intake',
    content:'The bank raises its rating to buy but publishes no consensus target.',
    publishedAt:'2026-07-10T18:00:00Z',
    topic:'Unternehmen',
    symbols:['TEST.US'],
    primarySymbol:'TEST.US',
    priceContextSymbol:'TEST.US',
    priceContextKind:'direct',
    scope:'watchlist',
    priceBars:[
      ...bars,
      {date:'2026-07-10', close:103, adjusted_close:103, volume:1100},
      {date:'2026-07-13', close:104.5, adjusted_close:104.5, volume:1250}
    ],
    newsSourceKind:'rss_aggregator',
    priceProvider:'EODHD EOD',
    priceContextUpdatedAt:'2026-07-14T02:10:00Z',
    now:new Date('2026-07-14T08:00:00Z')
  });

  assert.equal(
    result.assessment_version,
    '29.4-multisource-hybrid-rule-market-intelligence'
  );
  assert.equal(result.analysis_basis.news_source_kind, 'rss_aggregator');
  assert.equal(result.analysis_basis.price_provider, 'EODHD EOD');
  assert.match(result.analyst_view, /ausschließlich auf dem erkannten Meldungstext/);
  assert.ok(result.analysis_basis.limitations.some(value =>
    /RSS-Aggregator/.test(value)
  ));
});
