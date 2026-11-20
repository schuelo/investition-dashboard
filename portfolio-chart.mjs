import {e} from './investment-view.mjs';
import {periodPoints,lineChart,watchComparison} from './price-charts.mjs';
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
export function portfolioChartModel(portfolio,{assets=[],series={},currency='',period='1M',now=new Date(),mode='auto'}={}){
 const g=portfolio?.groups?.find(g=>g.currency===currency)||portfolio?.groups?.[0];if(!g)return {mode:'missing',points:[],currency,reason:portfolio?'Für diese Bestände fehlt eine unterstützte Bewertung.':'Depotdaten noch nicht geladen oder nicht erreichbar.'};currency=g.currency;
 const measured=periodPoints((portfolio.marks||[]).filter(m=>m.currency===currency&&m.amount!==null&&m.amount!==''&&Number.isFinite(Number(m.amount))&&Number(m.amount)>=0).map(m=>({date:m.recorded_at,value:Number(m.amount)})),period,now);
 const reconstructed=reconstructOpenHoldings(portfolio,assets,series,currency,now),derived=periodPoints(reconstructed.points,period,now);
 const held=assets.filter(a=>portfolio.holdings?.some(h=>h.asset_id===a.id&&h.currency===currency&&positive(h.quantity))),comparison=held.filter(a=>series[a.id]?.kind==='price_history'&&periodPoints(series[a.id].points,period,now).length>=2);
 if(mode==='auto')mode=measured.length>=2?'measured':derived.length>=2?'reconstructed':comparison.length?'comparison':'measured';
 let points=mode==='reconstructed'?derived:measured,transient=false;
 if(mode==='measured'&&!points.length&&Number.isFinite(g.amount)&&g.amount>=0){points=periodPoints([{date:portfolio.as_of||now.toISOString(),value:g.amount}],period,now);transient=points.length>0;}
 return {mode,points,currency,transient,measured:measured.length,reconstructed:derived.length,comparison:comparison.length,assets:held,reason:reconstructed.reason,group:g,history_warning:portfolio.history_warning||'',period};
}
export function portfolioChartHtml(portfolio,{assets=[],series={},currency='',period='1M',now=new Date(),width=640,mode='auto'}={}){
 const m=portfolioChartModel(portfolio,{assets,series,currency,period,now,mode}),options=[['auto','Automatisch'],['measured','Gespeicherte Bewertungen'],['reconstructed','Offene Positionen rückrechnen'],['comparison','Kurse vergleichen']];
 let body='',note='';
 if(m.mode==='comparison'){
  body=watchComparison(m.assets,series,{period,now,width});note='Kursvergleich deiner aktuell gehaltenen Werte. Startwert 100; keine Depotwert- oder Renditehistorie.';
 }else{
  body=lineChart(m.points,{period:'Max',now,width,currency:m.currency,label:m.mode==='reconstructed'?'Rückrechnung des heutigen offenen Bestands':'Tatsächlich beobachtete Depotbewertungen'});
  note=m.mode==='reconstructed'?'Rückrechnung des heutigen offenen Bestands aus gespeicherten Kursen, frühestens ab dem letzten Kaufdatum. Keine vollständige historische Depotbilanz; geschlossene Positionen, Cash, Gebühren und Zahlungsströme fehlen.':m.transient?'Aktuell berechnete Bewertung. Noch keine gespeicherte Verlaufsmessung für diesen Zeitraum. Weitere tatsächliche Messungen ergeben die Zeitreihe.':'Tatsächlich gespeicherte Depotbewertungen. Bestandsänderungen beeinflussen den Verlauf; keine um Zahlungsströme bereinigte Rendite.';
 }
 const title=m.mode==='reconstructed'?'Wertentwicklung · heutiger offener Bestand':m.mode==='comparison'?'Kursentwicklung deiner Depotwerte':'Depotwertverlauf';
 return '<div class="portfolio-chart-shell" data-chart-mode="'+e(m.mode)+'"><div class="compact-heading"><h3>'+e(title)+'</h3><label>Darstellung<select id="ivChartMode">'+options.map(([v,label])=>'<option value="'+v+'"'+(v===mode?' selected':'')+'>'+label+'</option>').join('')+'</select></label></div>'+body+'<p class="compact-muted">'+e(note)+'</p>'+(m.mode==='reconstructed'&&!m.points.length?'<p class="compact-status">'+e(m.reason)+'</p>':'')+(m.history_warning?'<p class="compact-status bad">'+e(m.history_warning)+'</p>':'')+'<p class="chart-evidence">Daten im Zeitraum: '+e(m.measured||0)+' Depotmessung(en) · '+e(m.reconstructed||0)+' rückrechenbare Kurstage · '+e(m.comparison||0)+' Kursreihe(n).</p></div>';
}
