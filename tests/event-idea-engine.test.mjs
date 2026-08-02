import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IDEA_ENGINE_VERSION,
  buildIndependentMarketIdeas,
  classifyEvent,
} from '../supabase/functions/_shared/event-idea-engine.mjs';

const scenarios = [
  {
    input: 'China beschränkt den Export seltener Erden nach Europa und in die USA.',
    theme: 'rare-earths',
    expected: ['MP Materials', 'Lynas Rare Earths'],
  },
  {
    input: 'Die USA verschärfen Exportkontrollen für KI-Chips nach China.',
    theme: 'semiconductor-controls',
    expected: ['NVIDIA', 'TSMC'],
  },
  {
    input: 'Der Ölpreis steigt nachhaltig über 100 US-Dollar je Barrel.',
    theme: 'oil-up',
    expected: ['Exxon Mobil', 'Lufthansa'],
  },
  {
    input: 'Die EZB senkt die Leitzinsen schneller als vom Markt erwartet.',
    theme: 'rates-cut',
    expected: ['Vonovia', 'Deutsche Bank'],
  },
  {
    input: 'Ein Cyberangriff legt mehrere europäische Häfen und Logistiksysteme lahm.',
    theme: 'cybersecurity',
    expected: ['Palo Alto Networks', 'CrowdStrike'],
  },
  {
    input: 'Der Strombedarf von KI-Rechenzentren steigt deutlich stärker als erwartet.',
    theme: 'grid-data-centers',
    expected: ['Eaton', 'Schneider Electric'],
  },
  {
    input: 'Eine schwere Dürre treibt Agrarpreise und Düngemittelnachfrage.',
    theme: 'agriculture-fertilizer',
    expected: ['Nutrien', 'K+S'],
  },
];

test('V30.1-Ideen-Engine ist die unabhängige Fassung', () => {
  assert.match(IDEA_ENGINE_VERSION, /30\.1-independent-market-ideas/);
});

for (const scenario of scenarios) {
  test(`Szenario erzeugt belastbare Marktideen: ${scenario.theme}`, () => {
    const classification = classifyEvent(scenario.input, []);
    assert.ok(classification.hits.some(hit => hit.id === scenario.theme), `Thema ${scenario.theme} wurde nicht erkannt`);

    const result = buildIndependentMarketIdeas({
      input: scenario.input,
      sources: [],
      baseConfidence: 48,
      minimumIdeas: 6,
    });
    assert.ok(result.ideas.length >= 4, 'Weniger als vier themenspezifische Marktideen');
    const names = new Set(result.ideas.map(idea => idea.name));
    for (const expected of scenario.expected) assert.ok(names.has(expected), `${expected} fehlt`);
    assert.ok(result.ideas.every(idea => idea.symbol && idea.company_name && idea.recommendation === undefined), 'Ideenstruktur unvollständig');
    assert.ok(result.ideas.every(idea => Number.isFinite(idea.impact_score) && Number.isFinite(idea.opportunity_score)));
  });
}

test('Nicht klassifizierbares Ereignis liefert gekennzeichnete Rechercheideen statt leerem Ergebnis', () => {
  const result = buildIndependentMarketIdeas({
    input: 'Eine neue Umweltabgabe auf autonome Industrieroboter wird kurzfristig beschlossen.',
    sources: [],
    minimumIdeas: 6,
  });
  assert.ok(result.ideas.length >= 6);
  assert.equal(result.used_fallback, true);
  assert.ok(result.ideas.some(idea => idea.fallback));
  assert.ok(result.ideas.some(idea => /Rückfallhypothese|gezielte Unternehmensrecherche/i.test(idea.reasoning)));
});

test('Ideen werden ohne Portfolio- oder Watchlistdaten vollständig erzeugt', () => {
  const result = buildIndependentMarketIdeas({
    input: 'Der Strombedarf von KI-Rechenzentren steigt deutlich stärker als erwartet.',
    sources: [],
  });
  assert.ok(result.ideas.length >= 4);
  assert.deepEqual(result.ideas.slice(0, 2).map(idea => idea.name), ['Eaton', 'Schneider Electric']);
});

test('Quellennennung erhöht die Evidenz einer Marktidee', () => {
  const base = buildIndependentMarketIdeas({input: 'Ein großer Cyberangriff trifft kritische Infrastruktur.', sources: []});
  const sourced = buildIndependentMarketIdeas({
    input: 'Ein großer Cyberangriff trifft kritische Infrastruktur.',
    sources: [{title: 'Palo Alto Networks sees rising demand after cyber attacks', source_name: 'Test'}],
  });
  const baseIdea = base.ideas.find(idea => idea.name === 'Palo Alto Networks');
  const sourcedIdea = sourced.ideas.find(idea => idea.name === 'Palo Alto Networks');
  assert.ok(baseIdea && sourcedIdea);
  assert.ok(sourcedIdea.confidence_score > baseIdea.confidence_score);
  assert.equal(sourcedIdea.source_mentioned, true);
});
