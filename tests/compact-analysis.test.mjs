import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSignalAnalysis} from '../supabase/functions/_shared/signal-engine.mjs';
import {buildDeepAnalysis,validateDeepInput} from '../supabase/functions/_shared/deep-engine.mjs';
import {makeBars,now} from './fixtures/independent-market.mjs';
import {reportView,summaryHtml,ladderHtml,changesHtml,modelChart,scenariosHtml,reportHtml,previousReport} from '../compact-analysis.mjs';
const bars=makeBars(),signal=()=>buildSignalAnalysis({symbol:'SND.XETRA',currency:'EUR',rawBars:bars,days:20,provider:'CSV',now});
const deep=()=>buildDeepAnalysis(validateDeepInput({symbol:'SND.XETRA',currency:'EUR',days:20,lookback:252,use_ai:false,manual_start:true}),bars,{provider:'CSV',now});
test('Compact overview uses actual engine triggers and never derives confirmation from a price crossing',()=>{
  const a=signal(),s=a.setups.find(s=>s.direction==='long');s.status='bedingter Kandidat';s.confirmed=false;a.chart.price=s.entry*1.1;
  const v=reportView(a,{now});assert.equal(v.status,'Bedingter Kandidat');assert.ok(v.next.includes(s.trigger));assert.equal(v.invalidation,s.invalidation);assert.doesNotMatch(summaryHtml(v),/Bedingungen erfüllt|Kaufen/);
});
test('A Deep budget/volume rejection stays prominent even when technical setup is a candidate',()=>{
  const a=deep(),s=a.setups.find(s=>s.direction==='long');s.status='bedingter Kandidat';s.decision='ABWARTEN / KEIN TRADE';const v=reportView(a,{now});assert.equal(v.status,'Abwarten');assert.match(ladderHtml(v),/ABWARTEN \/ KEIN TRADE/);
});
test('Historical reports are blocked using today, not their frozen saved ageDays',()=>{
  const a=signal();a.quality.ageDays=0;a.quality.blocked=false;const before=JSON.stringify(a),v=reportView(a,{now:new Date('2026-11-15T06:00Z')});assert.equal(v.age,9);assert.equal(v.blocked,true);assert.equal(v.levels.length,0);assert.doesNotMatch(ladderHtml(v),/class="compact-rung/);assert.doesNotMatch(modelChart(a,{blocked:v.blocked}),/<svg/);assert.equal(JSON.stringify(a),before);
});
test('Missing/future date, invalid price and original quality block all disable compact levels',()=>{
  for(const mutate of [a=>a.price_date=null,a=>a.price_date='2026-11-10',a=>a.chart.price=NaN,a=>a.quality.blocked=true]){const a=signal();mutate(a);const v=reportView(a,{now});assert.equal(v.blocked,true);assert.equal(v.levels.length,0);}
});
test('Long and Short price ladders keep original marks and correct signed distances without FX conversion',()=>{
  const a=signal();for(const direction of ['long','short']){const v=reportView(a,{direction,now}),s=a.setups.find(s=>s.direction===direction);if(s.status==='gesperrt')continue;assert.ok(v.levels.some(([label,value])=>label==='Stop'&&value===s.stop));assert.ok(v.levels.some(([label,value])=>label==='Ziel 1'&&value===s.target1));assert.ok(ladderHtml(v).includes(a.currency));assert.equal(v.direction,direction);}
});
test('Gemini, rules and synthetic data are labelled from report provenance rather than a UI toggle',()=>{
  const a=signal();a.ai={provider:'gemini'};a.narrative.mode='rules';assert.equal(reportView(a,{now}).mode,'Regelberechnung');a.narrative.mode='ai';assert.equal(reportView(a,{now}).mode,'Gemini-Auswertung');delete a.ai;assert.match(reportView(a,{now}).mode,/Anbieter nicht gespeichert/);a.symbol='DEMO.US';assert.match(summaryHtml(reportView(a,{now})),/SYNTHETISCHE DEMO/);
});
test('Comparison excludes other symbols, other currencies, same-time and future records',()=>{
  const a=signal(),old={...signal(),created_at:'2026-11-07T09:00Z'},future={...signal(),created_at:'2026-11-09T09:00Z'};
  const rows=[{...old,symbol:'NVDA.US'},{...old,currency:'USD'},future,a,old];assert.equal(previousReport(a,rows),old);const v=reportView(a,{previous:old,now});assert.ok(v.comparison);assert.match(changesHtml(v),/Kursänderung/);assert.equal(reportView(a,{previous:future,now}).comparison,null);
});
test('Saved Deep delta is only used when currency-comparable and strictly older',()=>{
  const a=deep();a.delta=[{currency_comparable:false,created_at:'2026-11-07',price_change_pct:9},{currency_comparable:true,created_at:'2026-11-10',price_change_pct:8}];assert.equal(reportView(a,{now}).comparison,null);a.delta.push({currency_comparable:true,created_at:'2026-11-07',price_change_pct:3});assert.equal(reportView(a,{now}).comparison.price_change_pct,3);
});
test('Responsive charts use one domain across Deep scenarios and valid geometry from 280 to 900 pixels',()=>{
  const a=deep();for(const width of [280,320,375,430,900]){const variants=a.scenarios.map(s=>modelChart(a,{width,scenarioId:s.id}));const axis=html=>[...html.matchAll(/text-anchor="end">([^<]+)<\/text>/g)].map(m=>m[1]).slice(0,3);for(const html of variants){assert.match(html,new RegExp('viewBox="0 0 '+width+' 250"'));assert.doesNotMatch(html,/NaN|undefined|Infinity/);assert.deepEqual(axis(html),axis(variants[0]));assert.match(html,/P10/);assert.match(html,/P90/);}}
});
test('Scenario comparison uses real endpoint changes; only fully computed Deep scenarios are interactive',()=>{
  const a=deep(),html=scenariosHtml(a,{scope:'deep'});assert.equal((html.match(/data-compact-scenario=/g)||[]).length,6);assert.match(html,/gemeinsamer Nullpunkt/);assert.equal(scenariosHtml(a,{blocked:true}),'');assert.doesNotMatch(scenariosHtml(signal()),/data-compact-scenario/);
});
test('Stored report text is escaped in summary, scenario IDs, chart names and comparisons',()=>{
  const a=deep();a.symbol='<img onerror=evil()>';a.provider='<script>secret</script>';a.scenarios[0].name='<svg onload=evil()>';a.scenarios[0].id='" onclick="evil()';a.setups[0].trigger='<img onerror=evil()>';
  const html=reportHtml(reportView(a,{now}),{scope:'deep'})+modelChart(a);assert.doesNotMatch(html,/<script>|<img|<svg onload/);assert.match(html,/&lt;img/);
});
test('Rendering all summaries/charts does not mutate saved results or fabricate missing bands',()=>{
  const a=deep(),before=JSON.stringify(a),v=reportView(a,{now});reportHtml(v);for(const s of a.scenarios)modelChart(a,{scenarioId:s.id});assert.equal(JSON.stringify(a),before);delete a.scenarios;delete a.simulation.bands;assert.match(modelChart(a),/Keine vollständigen/);
});
