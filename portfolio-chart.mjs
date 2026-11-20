import {e} from './investment-view.mjs';
import {periodPoints,lineChart,watchComparison,comparisonHistory} from './price-charts.mjs';
import {historyWindow,periodButtons,windowCaption} from './chart-window.mjs';
const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
const validDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
// A reconstruction is an explicit model of today's still-open positions, never a historic account balance.
export function reconstructOpenHoldings(portfolio,assets,series,currency,now=new Date()){
 const holdings=(portfolio?.holdings||[]).filter(h=>h.currency===currency&&positive(h.quantity));
 if(!holdings.length)return {points:[],reason:'Keine bewertbaren offenen Long-Aktien-/ETF-Bestände.'};
 const rows=[];
 for(const h of holdings){
  const a=assets.find(a=>a.id===h.asset_id&&a.currency===currency&&a.symbol===h.symbol),s=series[a?.id];
  const lots=(h.lots||[]).filter(p=>/^(Aktie|ETF|Stock|Equity)$/i.test(p.instrument_type)&&String(p.direction).toLowerCase()==='long');
  if(!lots.length||lots.some(p=>!validDay(p.entry_date)))return {points:[],reason:'Für die Rückrechnung fehlen Kaufdaten. Der Kursvergleich ist unabhängig davon nutzbar.'};
  if(!a||s?.kind!=='price_history'||s.symbol!==a.symbol||s.currency!==currency)return {points:[],reason:'Nicht für alle offenen Positionen liegt eine passende Kurshistorie vor.'};
  const points=periodPoints(s.points,'Max',now).filter(p=>positive(p.value));
  if(points.length<2)return {points:[],reason:'Für die Rückrechnung fehlen mindestens zwei historische Kurse je Position.'};
  rows.push({h,points,start:lots.map(p=>p.entry_date).sort().at(-1)});
 }
 const earliest=rows.map(r=>r.start).sort().at(-1);let dates=new Set(rows[0].points.filter(p=>p.date>=earliest).map(p=>p.date));
 for(const r of rows.slice(1))dates=new Set(r.points.filter(p=>dates.has(p.date)).map(p=>p.date));
 const points=[...dates].sort().map(date=>({date,value:rows.reduce((sum,r)=>sum+r.h.quantity*r.points.find(p=>p.date===date).value,0)})).filter(p=>positive(p.value));
 return {points,reason:points.length<2?'Nach dem letzten Kauf fehlen zwei gemeinsame Kurstage.':'',positions:rows.length,start:points[0]?.date||null};
}
export function portfolioChartModel(portfolio,{assets=[],series={},currency='',period='1M',now=new Date(),mode='auto',anchor='today'}={}){
 const g=portfolio?.groups?.find(g=>g.currency===currency)||portfolio?.groups?.[0];if(!g)return {mode:'missing',points:[],currency,reason:portfolio?'Für diese Bestände fehlt eine unterstützte Bewertung.':'Depotdaten noch nicht geladen oder nicht erreichbar.'};currency=g.currency;
 const measuredAll=periodPoints((portfolio.marks||[]).filter(m=>m.currency===currency&&m.amount!==null&&m.amount!==''&&Number.isFinite(Number(m.amount))&&Number(m.amount)>=0).map(m=>({date:m.recorded_at,value:Number(m.amount)})),'Max',now),measured=historyWindow(measuredAll,period,{now,anchor}).points;
 const reconstructed=reconstructOpenHoldings(portfolio,assets,series,currency,now),derived=historyWindow(reconstructed.points,period,{now,anchor}).points;
 const held=assets.filter(a=>portfolio.holdings?.some(h=>h.asset_id===a.id&&h.currency===currency&&positive(h.quantity))),comparison=comparisonHistory(held,series,now);
 // Select the meaning of the graph before filtering time. A period change never switches EUR to index values.
 if(mode==='auto')mode=measuredAll.length>=2?'measured':reconstructed.points.length>=2?'reconstructed':comparison.shared.length>=2?'comparison':'measured';
 let points=mode==='reconstructed'?derived:measured,transient=false;
 const current=Number.isFinite(g.amount)&&g.amount>=0?[{date:portfolio.as_of||now.toISOString(),value:g.amount}]:[];
 if(mode==='measured'&&!measuredAll.length&&current.length){points=historyWindow(current,period,{now,anchor}).points;transient=points.length>0;}
 const values=mode==='measured'?(measuredAll.length?measuredAll:current):mode==='reconstructed'?reconstructed.points:comparison.shared;
 return {mode,points,values,currency,transient,measured:measured.length,reconstructed:derived.length,comparison:comparison.available.length,assets:held,reason:reconstructed.reason,group:g,history_warning:portfolio.history_warning||'',period,available:{measured:measuredAll.length||current.length,reconstructed:reconstructed.points.length,comparison:comparison.shared.length}};
}
export function portfolioChartHtml(portfolio,{assets=[],series={},currency='',period='1M',now=new Date(),width=640,mode='auto'}={}){
 const m=portfolioChartModel(portfolio,{assets,series,currency,period,now,mode,anchor:'latest'}),options=[['auto','Automatisch'],['measured','Gespeicherte Bewertungen'],['reconstructed','Offene Positionen rückrechnen'],['comparison','Kurse vergleichen']];
 let body='',note='';
 if(m.mode==='comparison'){
  body=watchComparison(m.assets,series,{period,now,width,anchor:'latest'});note='Kursvergleich deiner aktuell gehaltenen Werte. Startwert 100; keine Depotwert- oder Renditehistorie.';
 }else{
  body=lineChart(m.points,{period:'Max',now,width,currency:m.currency,label:m.mode==='reconstructed'?'Rückrechnung des heutigen offenen Bestands':'Tatsächlich beobachtete Depotbewertungen'});
  note=m.mode==='reconstructed'?'Rückrechnung des heutigen offenen Bestands aus gespeicherten Kursen, frühestens ab dem letzten Kaufdatum. Keine vollständige historische Depotbilanz; geschlossene Positionen, Cash, Gebühren und Zahlungsströme fehlen.':m.transient?'Aktuell berechnete Bewertung. Noch keine gespeicherte Verlaufsmessung für diesen Zeitraum. Weitere tatsächliche Messungen ergeben die Zeitreihe.':'Tatsächlich gespeicherte Depotbewertungen. Bestandsänderungen beeinflussen den Verlauf; keine um Zahlungsströme bereinigte Rendite.';
 }
 const title=m.mode==='reconstructed'?'Wertentwicklung · heutiger offener Bestand':m.mode==='comparison'?'Kursentwicklung deiner Depotwerte':'Depotwertverlauf',kind=m.mode==='comparison'?'Index 100':m.mode==='reconstructed'?'Rückrechnung · '+m.currency:'Bewertungen · '+m.currency;
 return '<div class="portfolio-chart-shell" data-chart-mode="'+e(m.mode)+'"><div class="chart-heading"><h3>'+e(title)+'</h3><span class="chart-kind">'+e(kind)+'</span></div>'+body+'<div class="direct-periods" role="group" aria-label="Zeitraum">'+periodButtons(m.values,{selected:period,scope:'review',now})+'</div>'+(m.mode==='comparison'?'':'<p class="chart-window-note">'+e(windowCaption(m.values,period,{now}))+'</p>')+(m.history_warning?'<p class="compact-status bad">'+e(m.history_warning)+'</p>':'')+'<details class="chart-notes"><summary>Daten &amp; Darstellung</summary><label>Datenbasis<select id="ivChartMode">'+options.map(([v,label])=>'<option value="'+v+'"'+(v===mode?' selected':'')+(v!=='auto'&&!m.available?.[v]?' disabled':'')+'>'+label+'</option>').join('')+'</select></label><p>'+e(note)+'</p>'+(m.mode==='reconstructed'&&!m.points.length?'<p>'+e(m.reason)+'</p>':'')+'<p class="chart-evidence">Daten im Zeitraum: '+e(m.measured||0)+' Depotmessung(en) · '+e(m.reconstructed||0)+' rückrechenbare Kurstage · '+e(m.comparison||0)+' Kursreihe(n).</p></details></div>';
}
