import test from 'node:test';
import assert from 'node:assert/strict';
import {configPaper,newPaper,marketOpen,eligibleAI,updatePaper} from '../supabase/functions/_shared/paper-engine.mjs';
const config=configPaper({symbols:'SND.XETRA',currency:'EUR',capital:10000,fee_bps:10,slippage_bps:5});
function bars(end='2026-10-15',count=100){const out=[];let d=new Date(end+'T00:00Z');while(out.length<count){if(d.getUTCDay()!==0&&d.getUTCDay()!==6)out.unshift({date:d.toISOString().slice(0,10),open:100,high:101,low:99,close:100,volume:1000});d.setUTCDate(d.getUTCDate()-1);}return out;}
const at=s=>new Date(s),symbol='SND.XETRA';
const run=(state,b,now='2026-10-16T06:00Z',a=[])=>updatePaper(config,state,{[symbol]:b},a,at(now));
const init=()=>run(newPaper(config,at('2026-10-16T06:00Z')),bars());
test('V33 config is same-venue, long-only, bounded and immutable',()=>{
  assert.equal(config.risk_pct,.5);assert.equal(config.max_position_pct,20);
  for(const input of [{symbols:'SND.XETRA,AAPL.US'},{currency:'USD'},{capital:-1},{fee_bps:Infinity},{symbols:'SND.XETRA,SND.XETRA'},{symbols:'<script>.US'},{slippage_bps:-1}])assert.throws(()=>configPaper({...config,symbols:config.symbols.join(','),...input}));
});
test('V33 market opening handles European/US DST independently',()=>{
  assert.equal(new Date(marketOpen(symbol,'2026-07-01')).toISOString(),'2026-07-01T07:00:00.000Z');
  assert.equal(new Date(marketOpen(symbol,'2026-12-01')).toISOString(),'2026-12-01T08:00:00.000Z');
  assert.equal(new Date(marketOpen('AAPL.US','2026-03-20')).toISOString(),'2026-03-20T13:30:00.000Z');
  assert.equal(new Date(marketOpen('AAPL.US','2026-12-01')).toISOString(),'2026-12-01T14:30:00.000Z');
});
test('V33 initializes only pending hold orders, no invented backtest',()=>{
  const r=init();assert.equal(r.nav.length,1);assert.equal(r.state.accounts.hold.cash,10000);assert.equal(r.state.accounts.hold.pending.length,1);assert.equal(r.events.some(e=>e.type==='BUY'),false);assert.equal(r.state.signals[0].ai_status.includes('Wartet'),true);
});
test('V33 next opening fills hold with adverse slippage and fees',()=>{
  const first=init(),original=JSON.stringify(first.state),r=run(first.state,bars('2026-10-16'),'2026-10-17T06:00Z');
  const buy=r.events.find(e=>e.type==='BUY');assert.equal(buy.date,'2026-10-16');assert.equal(buy.price,100.05);assert.ok(buy.fee>0);assert.ok(r.state.accounts.hold.cash>=0);assert.ok(r.nav[0].accounts.hold.value<10000);assert.equal(JSON.stringify(first.state),original);
});
test('V33 repeated same-day runs cannot duplicate fills or NAV',()=>{
  const a=init(),b=run(a.state,bars(),'2026-10-16T06:30Z');assert.equal(b.nav.length,0);assert.equal(b.events.some(e=>e.type==='BUY'),false);assert.equal(b.state.accounts.hold.pending.length,1);assert.ok(+b.events[0].event_key>+a.events.at(-1).event_key);
});
test('V33 order recorded after open cannot fill retrospectively',()=>{
  const a=run(newPaper(config,at('2026-10-16T12:00Z')),bars(),'2026-10-16T12:00Z');const b=run(a.state,bars('2026-10-16'),'2026-10-17T06:00Z');assert.equal(b.events.some(e=>e.type==='BUY'),false);
  const c=run(b.state,bars('2026-10-19'),'2026-10-20T06:00Z');assert.equal(c.events.find(e=>e.type==='BUY').date,'2026-10-19');
});
test('V33 stale data, missing data and revised raw anchors abort atomically',()=>{
  const a=init();assert.throws(()=>run(a.state,bars(),'2026-10-25T06:00Z'),/zu alt/);
  const revised=bars('2026-10-16');revised.find(b=>b.date==='2026-10-15').close=100.1;assert.throws(()=>run(a.state,revised,'2026-10-17T06:00Z'),/Revision|revision/);
  assert.throws(()=>updatePaper(config,a.state,{},[],at('2026-10-17T06:00Z')));
});
test('V33 malformed OHLCV, duplicates and current-day bars do not slip through',()=>{
  const b=bars();b[0].low=500;assert.throws(()=>run(newPaper(config),b),/OHLC/);
  assert.throws(()=>run(newPaper(config),[...bars(),bars()[0]]),/Doppel/);
  const r=run(newPaper(config),bars('2026-10-16'));assert.equal(r.state.last_session,'2026-10-15');
});
test('V33 cash-only hybrid is not mislabeled as active AI',()=>{const r=init();assert.deepEqual(r.state.accounts.hybrid.positions,{});assert.equal(r.state.signals[0].ai_id,null);assert.equal(r.state.signals[0].methods.length,7);});
const ai={id:'own-analysis',symbol,currency:'EUR',created_at:'2026-10-15T16:00Z',price_date:'2026-10-15',narrative:{mode:'ai',bias:'bullish',evidence:[{source_id:'news'}]},ai:{provider:'gemini'},quality:{blocked:false}};
test('V33 AI input excludes future, stale, foreign-symbol, rule-only and sourceless reports',()=>{
  const now=at('2026-10-16T06:00Z');assert.equal(eligibleAI([ai],symbol,'EUR',now,'2026-10-15').id,ai.id);
  for(const x of [{created_at:'2026-10-18T00:00Z'},{created_at:'2026-10-01T00:00Z'},{symbol:'SAP.XETRA'},{currency:'USD'},{quality:{blocked:true}},{ai:null},{narrative:{mode:'rules'}},{narrative:{mode:'ai',evidence:[]}}])assert.equal(eligibleAI([{...ai,...x}],symbol,'EUR',now,'2026-10-15'),null);
});
function withPosition(){const s=init().state;s.accounts.chart.positions[symbol]={qty:10,entry:100,basis:1001,stop:98,target:104,atr:1,sessions:0};s.accounts.chart.cash=8999;return s;}
test('V33 ambiguous daily stop and target chooses conservative stop',()=>{
  const b=bars('2026-10-16');Object.assign(b.at(-1),{open:100,high:105,low:97});const r=run(withPosition(),b,'2026-10-17T06:00Z');const e=r.events.find(e=>e.account==='chart'&&e.type==='SELL');assert.equal(e.reason,'Stop');assert.equal(e.ambiguous,true);assert.equal(e.price,98*.9995);
});
test('V33 stop gaps fill at worse open, not guaranteed stop',()=>{
  const b=bars('2026-10-16');Object.assign(b.at(-1),{open:95,high:101,low:94});const r=run(withPosition(),b,'2026-10-17T06:00Z');const e=r.events.find(e=>e.account==='chart'&&e.type==='SELL');assert.equal(e.reason,'Stop-Gap');assert.equal(e.price,95*.9995);
});
test('V33 close-derived trailing stop never triggers against earlier low',()=>{
  const b=bars('2026-10-16');Object.assign(b.at(-1),{open:100,high:103,low:99,close:102});const r=run(withPosition(),b,'2026-10-17T06:00Z');assert.equal(r.events.some(e=>e.account==='chart'&&e.type==='SELL'),false);assert.equal(r.state.accounts.chart.positions[symbol].stop,100);
});
test('V33 capital-action factors and large opening gaps stop updates',()=>{
  const a=init(),b=bars('2026-10-16');b.at(-1).adjusted_close=95;assert.throws(()=>run(a.state,b,'2026-10-17T06:00Z'),/Kapitalmaßnahme/);
  const c=bars('2026-10-16');Object.assign(c.at(-1),{open:140,high:141,low:99});assert.throws(()=>run(a.state,c,'2026-10-17T06:00Z'),/Kurssprung/);
});
test('V33 expired pending orders cannot execute on a later known open',()=>{
  const a=init();a.state.accounts.hold.pending[0].expires_on='2026-10-15';const r=run(a.state,bars('2026-10-16'),'2026-10-17T06:00Z');assert.ok(r.events.some(e=>e.type==='EXPIRED'));assert.equal(r.state.accounts.hold.pending.length,0);
});
test('V33 common calendar is required across all accounts',()=>{
  const c={...config,symbols:[symbol,'SAP.XETRA']},a=updatePaper(c,newPaper(c),{[symbol]:bars(),'SAP.XETRA':bars()},[],at('2026-10-16T06:00Z'));
  assert.throws(()=>updatePaper(c,a.state,{[symbol]:bars('2026-10-16'),'SAP.XETRA':bars()},[],at('2026-10-17T06:00Z')),/Unterschiedliche/);
});
test('V33 chart candidates and saved AI become timestamped orders, not immediate trades',()=>{
  const b=bars();b.forEach((r,i)=>{const c=100+i*.05+Math.sin(i*.5)*.7;Object.assign(r,{open:c,high:c+.5,low:c-.5,close:c,volume:i===99?2000:1000});});
  const r=run(newPaper(config,at('2026-10-16T06:00Z')),b,'2026-10-16T06:00Z',[ai]);
  assert.equal(r.state.accounts.chart.pending.length,1);assert.equal(r.state.accounts.hybrid.pending.length,1);assert.equal(r.state.accounts.hybrid.pending[0].analysis_id,ai.id);assert.equal(r.state.accounts.chart.cash,10000);assert.equal(r.events.some(e=>e.type==='BUY'),false);
  const order=r.state.accounts.chart.pending[0];assert.equal(order.risk_budget,50);assert.equal(order.budget,2000);assert.ok(order.stop<b.at(-1).close);assert.ok(order.target>b.at(-1).close);
  const noAI=run(newPaper(config),b);assert.equal(noAI.state.accounts.chart.pending.length,1);assert.equal(noAI.state.accounts.hybrid.pending.length,0);
});
test('V33 entry gap cannot break configured risk size or produce negative cash',()=>{
  const a=init().state;a.accounts.chart.pending.push({symbol,side:'buy',created_at:'2026-10-16T06:00Z',expires_on:'2026-10-23',budget:2000,risk_budget:50,stop:98,target:104,atr:1,reason:'test'});
  const b=bars('2026-10-16');Object.assign(b.at(-1),{open:102,high:103,low:101,close:102});const r=run(a,b,'2026-10-17T06:00Z');const p=r.state.accounts.chart.positions[symbol];assert.ok(p.qty*(p.entry-98)<=50+1e-6);assert.ok(p.basis<=2000);assert.ok(r.state.accounts.chart.cash>=0);
});
