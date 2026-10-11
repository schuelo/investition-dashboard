import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBars, rsi, atr, ema, technicals, simulate, buildSignalAnalysis, selectNews, validateNarrative, parseOhlcvCsv } from '../supabase/functions/_shared/signal-engine.mjs';

export const NOW = new Date('2026-10-11T05:00:00Z');
export function fixture(n=220, trend=.001) {
  return Array.from({length:n},(_,i) => {
    const date=new Date('2026-10-09T00:00:00Z'); date.setUTCDate(date.getUTCDate()-(n-i-1));
    const close=100*Math.exp(trend*i+.012*Math.sin(i*1.7)),open=close*.998;
    return { date:date.toISOString().slice(0,10),open,high:close*1.02,low:close*.98,close,volume:1000000 };
  });
}
test('RSI14 matches the published Wilder worked sequence',()=> {
  const v=[44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28];
  assert.ok(Math.abs(rsi(v)-70.46413502109705)<1e-9);
  assert.equal(rsi(Array(30).fill(100)),50);
  assert.equal(rsi(Array.from({length:30},(_,i)=>i+1)),100);
  assert.equal(rsi(Array.from({length:30},(_,i)=>100-i)),0);
});
test('ATR includes overnight gaps and applies Wilder smoothing',()=> {
  const bars=[{high:101,low:99,close:100},{high:111,low:109,close:110},{high:111,low:109,close:110},{high:113,low:111,close:112}];
  assert.equal(atr(bars,2),4.75); // TRs 11,2,3; seed 6.5 then (6.5+3)/2
});
test('EMA is SMA seeded and unavailable before enough observations',()=> {
  assert.deepEqual(ema([1,2,3,4,5],3),[null,null,2,3,4]);
});
test('Validation rejects incomplete OHLC, duplicates and nonpositive prices',()=> {
  for (const mutate of [a=>delete a[5].high,a=>a[5].close=0,a=>a[5].date=a[4].date,a=>a[5].low=a[5].high+10]) {
    const a=fixture(); mutate(a); assert.throws(()=>normalizeBars(a,NOW));
  }
  assert.throws(()=>normalizeBars(fixture(59),NOW),/60/);
});
test('Today and future bars cannot influence closed-day analysis',()=> {
  const a=fixture(60); a.push({...a.at(-1),date:'2026-10-11',close:999,high:1000});
  const q=normalizeBars(a,NOW); assert.equal(q.bars.length,60); assert.equal(q.bars.at(-1).date,'2026-10-09');
  assert.equal(q.ageDays,2); assert.match(q.notes[0],/ausgeschlossen/);
});
test('Capital adjustment anchors historic OHLC to current raw-price basis',()=> {
  const a=fixture(80,0).map((r,i)=>({...r,open:i<79?100:50,high:i<79?102:51,low:i<79?98:49,close:i<79?100:50,adjusted_close:50}));
  const q=normalizeBars(a,NOW); assert.equal(q.bars[0].close,50); assert.equal(q.bars.at(-1).close,50);
  assert.equal(q.unresolvedJump,false); assert.equal(q.volumeValid,false); assert.equal(technicals(q.bars,q.volumeValid).volumeRatio,null);
});
test('Donchian breakout uses previous bars rather than the breakout bar itself',()=> {
  const a=fixture(80,0).map(r=>({...r,open:100,close:100,high:101,low:99}));
  a.at(-1).close=105; a.at(-1).high=106;
  const t=technicals(a); assert.equal(t.resistance,101); assert.equal(t.breakout,1);
  assert.equal(t.sma200,null); assert.equal(t.volumeRatio,1);
});
test('Seven techniques expose parameters, findings and limitations',()=> {
  const t=technicals(fixture()); assert.equal(t.methods.length,7);
  for (const m of t.methods) { assert.ok(m.purpose); assert.ok(m.limitation); assert.ok(m.finding); }
});
test('Seeded simulation is reproducible, positive and quantiles are ordered',()=> {
  const a=fixture(),t=technicals(a),first=simulate(a,t,{days:60,seed:423});
  assert.deepEqual(first,simulate(a,t,{days:60,seed:423}));
  assert.notDeepEqual(first.bands,simulate(a,t,{days:60,seed:424}).bands);
  assert.equal(first.bands.length,61); assert.equal(first.calibrated,false);
  for(const b of first.bands) { assert.ok(b.q10>0); assert.ok(b.q10<=b.q25&&b.q25<=b.q50&&b.q50<=b.q75&&b.q75<=b.q90); }
});
test('News impulse changes model only after explicit opt-in',()=> {
  const base={symbol:'NVDA.US',currency:'USD',rawBars:fixture(),now:NOW,narrative:{mode:'ai',bias:'bearish',confidence:80,summary:'x',evidence:[],risks:[],watchpoints:[]}};
  const off=buildSignalAnalysis(base),on=buildSignalAnalysis({...base,useNewsImpulse:true});
  assert.equal(off.simulation.newsBias,0); assert.equal(on.simulation.newsBias,-.8);
  assert.ok(on.simulation.bands.at(-1).q50<off.simulation.bands.at(-1).q50);
});
test('Long and short levels have correct order and defined risk multiples',()=> {
  const a=buildSignalAnalysis({symbol:'NVDA.US',currency:'USD',rawBars:fixture(),now:NOW});
  for(const s of a.setups) {
    const sign=s.direction==='long'?1:-1;
    assert.ok(sign*(s.entry-s.stop)>0); assert.ok(sign*(s.target1-s.entry)>0); assert.ok(sign*(s.target2-s.target1)>0);
    assert.ok(Math.abs(Math.abs(s.target1-s.entry)/Math.abs(s.entry-s.stop)-2)<1e-5);
    assert.equal(s.confirmed,false); assert.match(s.trigger,/Volumen/);
  }
});
test('Stale data and unresolved jumps disable trade recommendations',()=> {
  const a=fixture().map(r=>({...r,date:new Date(Date.parse(r.date)-20*86400000).toISOString().slice(0,10)}));
  const stale=buildSignalAnalysis({symbol:'NVDA.US',currency:'USD',rawBars:a,now:NOW});
  assert.ok(stale.setups.every(s=>s.status==='gesperrt'));
  const b=fixture(); b.at(-1).open=300;b.at(-1).close=301;b.at(-1).low=299;b.at(-1).high=303;
  const jump=buildSignalAnalysis({symbol:'NVDA.US',currency:'USD',rawBars:b,now:NOW});
  assert.ok(jump.setups.every(s=>s.status==='gesperrt'));
});
test('News opposite to chart requires waiting rather than immediate entry',()=> {
  const a=buildSignalAnalysis({symbol:'NVDA.US',currency:'USD',rawBars:fixture(),now:NOW,narrative:{mode:'ai',bias:'bearish',confidence:70,summary:'x',evidence:[],risks:[],watchpoints:[]}});
  assert.ok(a.chart.score>0); assert.ok(a.setups.every(s=>s.status.includes('abwarten')));
});
test('News selection does not confuse trading venues and excludes future/old news',()=> {
  const rows=[
    {id:'wrong',title:'Andere Börse',symbols:['SAP.US'],published_at:'2026-10-10'},
    {id:'right',title:'Auftrag SAP',symbols:['SAP.XETRA'],published_at:'2026-10-10'},
    {id:'future',title:'Zukunft',symbols:['SAP.XETRA'],published_at:'2026-10-12'},
    {id:'old',title:'Alt',symbols:['SAP.XETRA'],published_at:'2026-08-01'},
    {id:'ctx',title:'Neue Halbleiter Exportkontrollen',symbols:[],published_at:'2026-10-09'},
    {id:'duplicate',title:'Auftrag SAP',symbols:['SAP.XETRA'],published_at:'2026-10-09'}
  ];
  assert.deepEqual(selectNews(rows,'SAP.XETRA','','Exportkontrollen',NOW).map(r=>r.id),['right','ctx']);
});
test('Unknown AI sources and unsupported directional assertions are rejected',()=> {
  const n={summary:'x',bias:'bullish',confidence:75,evidence:[{source_id:'known',inference:'x'}],risks:[],watchpoints:[]};
  assert.equal(validateNarrative(n,['known']).mode,'ai');
  assert.throws(()=>validateNarrative(n,['other']),/unbekannte/);
  assert.throws(()=>validateNarrative({...n,evidence:[]},['known']),/Quellenbeleg/);
  assert.throws(()=>validateNarrative({...n,confidence:900},['known']),/Format/);
});
test('CSV accepts semicolon decimal comma and rejects wrong header/columns',()=> {
  const rows=parseOhlcvCsv('date;open;high;low;close;volume\n2026-10-09;10,1;11,0;9,8;10,5;100');
  assert.equal(rows[0].close,10.5); assert.equal(rows[0].date,'2026-10-09');
  assert.throws(()=>parseOhlcvCsv('date,close\n2026-10-09,10'),/CSV-Kopf/);
  assert.throws(()=>parseOhlcvCsv('date,open,high,low,close\n2026-10-09,10,11'),/Spalten/);
});
