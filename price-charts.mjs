import {e} from './investment-view.mjs';
import {historyWindow,windowCaption,periodButtons} from './chart-window.mjs';
export const CHART_PERIODS=['1W','1M','3M','1J','Max'];
const spans={'1W':7,'1M':31,'3M':93,'1J':366,Max:Infinity};
const number=v=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(v);
const date=t=>new Date(t).toLocaleDateString('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'2-digit'});
export function periodPoints(points,period='1M',now=new Date()){
 const span=spans[period]??31,map=new Map();
 for(const p of points||[]){const t=Date.parse(p.date);if(typeof p.value!=='number'||!Number.isFinite(p.value)||p.value<0||!Number.isFinite(t)||t>now.getTime()||now.getTime()-t>span*86400000)continue;map.set(t,{...p,t});}
 return [...map.values()].sort((a,b)=>a.t-b.t);
}
export function chartGeometry(points,{width=640,height=240,mini=false}={}){
 const parsed=Number(width),w=Math.min(2400,Math.max(mini?90:280,Number.isFinite(parsed)?Math.round(parsed):640)),h=mini?48:height,left=mini?4:Math.min(112,Math.max(62,...points.map(p=>number(p.value).length*7+10))),right=w-(mini?4:14),top=mini?6:26,bottom=h-(mini?6:37);
 const min=Math.min(...points.map(p=>p.value)),max=Math.max(...points.map(p=>p.value)),pad=Math.max((max-min)*.12,max*.007,.01),lo=Math.max(0,min-pad),hi=max+pad,first=points[0].t,last=points.at(-1).t;
 const x=t=>last===first?(left+right)/2:left+(t-first)/(last-first)*(right-left),y=value=>bottom-(value-lo)/(hi-lo)*(bottom-top),mapped=points.map(p=>({...p,x:x(p.t),y:y(p.value)}));
 return {w,h,left,right,top,bottom,lo,hi,points:mapped,path:mapped.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' ')};
}
export function lineChart(points,{period='1M',now=new Date(),width=640,mini=false,currency='',label='Historischer Kursverlauf',selected=null,anchor='today'}={}){
 const rows=anchor==='latest'?historyWindow(points,period,{now,anchor}).points:periodPoints(points,period,now);
 if(!rows.length)return '<div class="price-empty" role="status">Für diesen Zeitraum keine gespeicherten Werte.'+(period!=='Max'?' „Max“ zeigt den verfügbaren Verlauf.':' Kursquelle wählen oder CSV importieren.')+'</div>';
 const g=chartGeometry(rows,{width,mini}),last=g.points.at(-1),first=g.points[0],color=last.value<first.value?'#ef7b82':'#50d2c2',single=rows.length===1,focus=g.points.find(p=>p.date===selected)||last;
 const grid=mini?'':[0,.5,1].map(v=>{const value=g.lo+(g.hi-g.lo)*v,y=g.bottom-v*(g.bottom-g.top);return '<line x1="'+g.left+'" x2="'+g.right+'" y1="'+y+'" y2="'+y+'" stroke="#303030"/><text x="'+(g.left-9)+'" y="'+(y+4)+'" text-anchor="end" fill="#aebbc8">'+e(number(value))+'</text>';}).join('');
 const area=single?'':'<path d="'+g.path+' L'+last.x.toFixed(2)+' '+g.bottom+' L'+first.x.toFixed(2)+' '+g.bottom+' Z" fill="'+color+'" opacity="0.10"/>';
 const markers=(rows.length<=12?g.points:[first,last]).map(p=>'<circle cx="'+p.x.toFixed(2)+'" cy="'+p.y.toFixed(2)+'" r="'+(mini?2:single?5:3)+'" fill="'+color+'" stroke="#080808" stroke-width="1.5"><title>'+e(date(p.t)+' · '+number(p.value)+' '+currency)+'</title></circle>').join('');
 const axes=mini?'':'<text x="'+g.left+'" y="15" fill="#aebbc8">'+e(currency)+'</text><text x="'+g.left+'" y="'+(g.h-10)+'" fill="#aebbc8">'+e(date(first.t))+'</text>'+(single?'':'<text x="'+g.right+'" y="'+(g.h-10)+'" text-anchor="end" fill="#aebbc8">'+e(date(last.t))+'</text>')+'<line x1="'+focus.x.toFixed(2)+'" x2="'+focus.x.toFixed(2)+'" y1="'+g.top+'" y2="'+g.bottom+'" stroke="#718096" stroke-dasharray="3 4"/>';
 const path=single?'':'<path class="price-line" d="'+g.path+'" stroke="'+color+'" stroke-width="'+(mini?2:3)+'" stroke-linecap="round" stroke-linejoin="round" fill="none" vector-effect="non-scaling-stroke"/>';
 return '<svg class="'+(mini?'price-sparkline':'price-chart')+'" viewBox="0 0 '+g.w+' '+g.h+'" role="img" aria-label="'+e(label+(single?' · ein gespeicherter Wert':'')+' · '+currency)+'">'+grid+area+path+axes+markers+'</svg>'+(mini?'':'<p class="price-readout"><strong>'+e(number(focus.value)+' '+currency)+'</strong><span>'+e(date(focus.t))+(single?' · ein Messpunkt, noch keine Zeitreihe':' · '+rows.length+' gespeicherte Werte')+'</span></p>');
}
export function seriesSpark(series,{now=new Date(),compact=false,period='1M'}={}){
 if(!series?.points?.length)return '<span class="price-spark-empty" role="img" aria-label="Kursverlauf fehlt"><svg class="price-sparkline" viewBox="0 0 122 48" aria-hidden="true"><path d="M4 24 H118" stroke="#424242" stroke-width="1" stroke-dasharray="3 5"/></svg><small>Keine Historie</small></span>';
 const window=historyWindow(series.points,period,{now}),points=compact?window.points:periodPoints(series.points,'Max',now).slice(-22),first=points[0],last=points.at(-1);if(!first||!last)return '<span class="price-spark-empty">Kursverlauf fehlt</span>';
 const change=points.length>1&&first.value>0?(last.value/first.value-1)*100:null;
 return '<span class="price-spark" title="'+e(windowCaption(series.points,compact?period:'Max',{now}))+'">'+lineChart(points,{period:'Max',now,width:122,mini:true,currency:series.currency,label:'Gespeicherter Kursverlauf'})+'<small>'+(change===null?'Ein Messpunkt':e((compact?'':points.length+' Kurse · ')+(change>0?'+':'')+number(change)+' %'))+(compact?' · '+e(window.partial?'Hist.':period):' · '+e(series.kind==='manual_valuation'?'manuell':last.date))+'</small></span>';
}
export function portfolioHistoryChart(marks,currency,{period='1M',now=new Date(),width=640}={}){
 const rows=(marks||[]).filter(m=>m.currency===currency&&m.amount!==null&&m.amount!==''&&Number.isFinite(Number(m.amount))&&Number(m.amount)>=0&&Number.isFinite(Date.parse(m.recorded_at))&&Date.parse(m.recorded_at)<=now.getTime()).map(m=>({date:m.recorded_at,value:Number(m.amount)}));
 const selected=periodPoints(rows,period,now);
 if(!selected.length)return '<div class="price-empty">Noch keine gültige Depotbewertung für diesen Zeitraum. Stückzahl und Bewertungskurs prüfen; bei vorhandener älterer Historie „Max“ wählen.</div>';
 return lineChart(selected,{period:'Max',now,width,currency,label:'Tatsächlich gespeicherte Depotbewertungen'})+'<p class="compact-muted">'+(selected.length===1?'Für eine Kurve fehlen noch weitere Bewertungen. ':'')+'Tatsächlich aufgezeichnete Bewertungen; keine rückwirkend erfundene Historie. Bestandsänderungen beeinflussen den Verlauf; keine bereinigte Renditekurve.</p>';
}
export function comparisonHistory(assets,series,now=new Date()){
 const available=assets.map(a=>({a,s:series[a.id],points:periodPoints(series[a.id]?.points,'Max',now).filter(p=>p.value>0)})).filter(r=>r.points.length>=2&&r.s.kind==='price_history').slice(0,5);
 let common=new Set(available[0]?.points.map(p=>p.date)||[]);for(const r of available.slice(1))common=new Set(r.points.filter(p=>common.has(p.date)).map(p=>p.date));
 return {available,shared:[...common].sort().map(date=>({date,value:100}))};
}
export function watchHero(assets,series,{period='1M',now=new Date(),width=640}={}){
 const c=comparisonHistory(assets,series,now);return '<div class="portfolio-chart-shell"><div class="chart-heading"><h3>Kursvergleich · Beobachtung</h3><span class="chart-kind">Index 100</span></div>'+watchComparison(assets,series,{period,now,width,anchor:'latest'})+'<div class="direct-periods" aria-label="Zeitraum des Kursvergleichs">'+periodButtons(c.shared.length>=2?c.shared:[],{selected:period,scope:'watch',now})+'</div></div>';
}
export function watchComparison(assets,series,{period='1M',now=new Date(),width=640,anchor='today'}={}){
 const c=comparisonHistory(assets,series,now),available=c.available;
 if(!available.length)return '<div class="price-empty">Für den Kursvergleich fehlen gespeicherte Zeitreihen. Einen Wert öffnen und Kursdaten laden oder CSV importieren.</div>';
 if(c.shared.length<2)return '<div class="price-empty">Mindestens zwei gemeinsame Kursdaten sind für den Vergleich nötig. Einzelverläufe stehen direkt bei den Werten.</div>';
 const shared=historyWindow(c.shared,period,{now,anchor}).points,base=shared[0]?.date,end=shared.at(-1)?.date;if(!shared.length)return '<div class="price-empty">Für diesen Zeitraum keine gemeinsamen Kurse. „Max“ zeigt die gespeicherte Historie.</div>';
 const colors=['#50d2c2','#70aaff','#f4c869','#dc9fff','#ef7b82'],normalized=available.map((r,i)=>{const b=r.points.find(p=>p.date===base).value;return {...r,color:colors[i],points:r.points.filter(p=>p.date>=base&&p.date<=end).map(p=>({...p,value:p.value/b*100}))};}),all=normalized.flatMap(r=>r.points),g=chartGeometry(all,{width});
 // Use one shared time/value scale for every line.
 const minT=Math.min(...all.map(p=>p.t)),maxT=Math.max(...all.map(p=>p.t)),x=t=>maxT===minT?(g.left+g.right)/2:g.left+(t-minT)/(maxT-minT)*(g.right-g.left),y=v=>g.bottom-(v-g.lo)/(g.hi-g.lo)*(g.bottom-g.top);
 const lines=normalized.map(r=>'<path d="'+r.points.map((p,i)=>(i?'L':'M')+x(p.t).toFixed(2)+' '+y(p.value).toFixed(2)).join(' ')+'" stroke="'+r.color+'" stroke-width="2.5" fill="none" stroke-linejoin="round"/><circle cx="'+x(r.points.at(-1).t)+'" cy="'+y(r.points.at(-1).value)+'" r="3" fill="'+r.color+'"/>').join('');
 return '<svg class="price-chart" viewBox="0 0 '+g.w+' '+g.h+'" role="img" aria-label="Kursvergleich, gemeinsamer Startwert 100"><line x1="'+g.left+'" x2="'+g.right+'" y1="'+y(100)+'" y2="'+y(100)+'" stroke="#718096" stroke-dasharray="4 4"/><text x="'+(g.left-8)+'" y="'+(y(100)+4)+'" text-anchor="end" fill="#aebbc8">100</text><text x="'+g.left+'" y="15" fill="#aebbc8">Kursindex · Start 100</text>'+lines+'<text x="'+g.left+'" y="'+(g.h-10)+'" fill="#aebbc8">'+e(date(minT))+'</text><text x="'+g.right+'" y="'+(g.h-10)+'" text-anchor="end" fill="#aebbc8">'+e(date(maxT))+'</text></svg><div class="price-compare-legend">'+normalized.map(r=>'<span><i style="background:'+r.color+'"></i>'+e(r.a.company||r.a.symbol)+' · '+e(r.points.length>1?number(r.points.at(-1).value-100)+' %':'ein Kurstag')+'</span>').join('')+'</div><p class="chart-fineprint">Gemeinsamer Start '+e(base)+' = 100. Kursentwicklung in jeweiliger Notierungswährung, ohne Währungsumrechnung. '+available.length+' von '+assets.length+' Werten mit ausreichender Historie.</p>'+(anchor==='latest'?'<p class="chart-window-note">'+e(windowCaption(c.shared,period,{now,anchor}))+'</p>':'');
}
