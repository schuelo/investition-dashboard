// Presentation only. These helpers never fetch data, run an analysis or mutate saved reports.
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e=escapeHtml;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export const formatNumber=v=>finite(v)?new Intl.NumberFormat('de-DE',Math.abs(v)>0&&Math.abs(v)<.01?{maximumSignificantDigits:4}:{maximumFractionDigits:2}).format(v):'—';
export const formatPercent=v=>finite(v)?new Intl.NumberFormat('de-DE',{maximumFractionDigits:1,signDisplay:'always'}).format(v)+' %':'—';
const dateLabel=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleDateString('de-DE',{timeZone:'UTC'}):'unbekannt';};
const cleanDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function reportView(a,{direction='long',now=new Date(),previous=null}={}) {
  const price=a?.chart?.price,currency=a?.currency||'',priceDate=a?.price_date;
  const age=cleanDate(priceDate)?Math.floor((Date.parse(now.toISOString().slice(0,10))-Date.parse(priceDate))/86400000):null;
  const blocked=!!a?.quality?.blocked||!finite(price)||price<=0||age===null||age<0||age>4;
  const setup=a?.setups?.find(s=>s.direction===direction)||null;
  const denied=!setup||setup.status==='gesperrt'||setup.status==='abwarten'||String(setup.status||'').includes('widersprüchlich')||setup.decision==='ABWARTEN / KEIN TRADE';
  const status=blocked?'Daten prüfen':denied?'Abwarten':setup.confirmed===true?'Bestätigung im Bericht':setup.status==='bedingter Kandidat'?'Bedingter Kandidat':'Bestätigung offen';
  const trend=({1:'Aufwärtstrend','-1':'Abwärtstrend',0:'Gemischter Trend'})[a?.chart?.trend]||'Trend nicht gespeichert';
  const reasons=[...(a?.quality?.notes||[]),...(a?.warnings||[]),...(a?.quality?.gaps||[])].filter(x=>typeof x==='string'&&x.trim());
  if(age>4)reasons.unshift('Kursstand ist heute '+age+' Kalendertage alt. Keine aktuellen Handelsschwellen.');
  if(age===null||age<0)reasons.unshift('Kursdatum fehlt oder liegt in der Zukunft.');
  const synthetic=/^DEMO\./.test(a?.symbol||'')||/synthe|demonstration/i.test(a?.provider||'');
  const ai=a?.narrative?.mode==='ai',mode=ai?(a?.ai?.provider==='gemini'?'Gemini-Auswertung':a?.ai?.provider==='openai'?'OpenAI-Auswertung':'KI-Auswertung · Anbieter nicht gespeichert'):'Regelberechnung';
  const conditions=setup?.trigger||'Keine vollständige Triggerbedingung gespeichert.';
  const next=blocked?'Datenstand und Quelle prüfen; bei Abrufproblemen eigene OHLCV-CSV verwenden.':(denied&&setup?.reason?setup.reason+' ':'')+conditions;
  const invalidation=blocked?'Im Originalbericht gelten die damaligen Annahmen; aktuell keine Freigabe.':setup?.invalidation||'Keine Invalidierungsbedingung gespeichert.';
  let prior=null;
  if(previous&&previous.symbol===a.symbol&&previous.currency===currency&&Date.parse(previous.created_at)<Date.parse(a.created_at)&&finite(previous.chart?.price)&&previous.chart.price>0)prior=previous;
  const delta=Array.isArray(a?.delta)?a.delta.filter(d=>d.currency_comparable===true&&Date.parse(d.created_at)<Date.parse(a.created_at)).sort((x,y)=>Date.parse(y.created_at)-Date.parse(x.created_at))[0]||null:null;
  const comparison=prior?{created_at:prior.created_at,price_change_pct:(price/prior.chart.price-1)*100,score_delta:finite(a.chart.score)&&finite(prior.chart.score)?a.chart.score-prior.chart.score:null,previous_bias:prior.narrative?.bias,current_bias:a.narrative?.bias}:delta;
  const levels=!blocked&&setup&&setup.status!=='gesperrt'?[
    ['Ziel 2',setup.target2,'good'],['Ziel 1',setup.target1,'good'],['Einstieg nach Bestätigung',setup.entry,''],['Letzter Schlusskurs',price,''],['Stop',setup.stop,'bad']
  ].filter(r=>finite(r[1])&&r[1]>0).sort((x,y)=>y[1]-x[1]):[];
  const days=a?.request?.days||a?.simulation?.days||null;
  return {a,price,currency,age,blocked,setup,status,trend,reasons:[...new Set(reasons)],synthetic,mode,next,invalidation,comparison,levels,days,direction};
}
export function summaryHtml(v) {
  return '<header class="compact-report-header"><div><p class="compact-eyebrow">'+e(v.a.symbol)+(v.synthetic?' · SYNTHETISCHE DEMO':'')+'</p><h2>'+e(formatNumber(v.price))+' <small>'+e(v.currency)+'</small></h2></div><span class="compact-state '+(v.blocked?'bad':'warn')+'">'+e(v.status)+'</span></header>'+
    '<p class="compact-provenance">Kursstand '+e(dateLabel(v.a.price_date))+' · '+(v.age===null?'Alter unbekannt':e(v.age)+' Kalendertage alt')+'<br>'+e(v.a.provider||'Quelle nicht gespeichert')+' · '+e(v.mode)+(v.synthetic?'<br><strong>Keine Marktpreise oder Investmentidee.</strong>':'')+'</p>'+
    '<section class="compact-decision"><h3>Auf einen Blick</h3><div><small>Aktueller Befund</small><p>'+e(v.blocked?'Datenqualität begrenzt die Auswertung.':v.trend+(finite(v.a.chart?.score)?' · Chartscore '+v.a.chart.score+'/100':''))+'</p></div><div><small>Nächster Schritt</small><p>'+e(v.next)+'</p></div><div><small>These widerlegt, wenn …</small><p>'+e(v.invalidation)+'</p></div></section>'+
    (v.reasons.length?'<div class="compact-data-note" '+(v.blocked?'role="alert"':'')+'><strong>'+e(v.blocked?'Aktuelle Schwellen gesperrt':'Daten & Annahmen beachten')+'</strong><ul>'+v.reasons.slice(0,3).map(s=>'<li>'+e(s)+'</li>').join('')+'</ul><small>Alle Hinweise im vollständigen Originalbericht.</small></div>':'');
}
export function ladderHtml(v) {
  if(!v.levels.length)return '<section class="compact-panel"><h3>Kursleiter</h3><p>Keine verwendbaren aktuellen Schwellen. Originalbericht und Datenstand prüfen.</p></section>';
  const s=v.setup,rr=finite(s.net_reward_risk)?s.net_reward_risk:finite(s.entry)&&finite(s.stop)&&s.entry!==s.stop&&finite(s.target1)?Math.abs(s.target1-s.entry)/Math.abs(s.entry-s.stop):null;
  return '<section class="compact-panel"><h3>Kursleiter · '+(v.direction==='short'?'Short':'Long')+'</h3><p class="compact-muted">'+e(s.decision||s.status||'Bedingter Plan')+' · keine Order</p><div class="compact-ladder">'+v.levels.map(([label,value,tone])=>'<div class="compact-rung '+tone+'"><span>'+e(label)+'</span><span><b>'+e(formatNumber(value))+' '+e(v.currency)+'</b><small>'+e(formatPercent((value/v.price-1)*100))+' zum Schlusskurs</small></span></div>').join('')+'</div><p>Chance/Risiko zu Ziel 1: <strong>'+e(formatNumber(rr))+'</strong></p><small>'+e(finite(s.net_reward_risk)?'Netto nach den gespeicherten Kostenannahmen.':'Am geplanten Einstieg, vor Kosten.')+' Triggerbestätigung bleibt erforderlich. Stops sind bei Gaps keine Verlustgarantie.</small></section>';
}
export function changesHtml(v) {
  const d=v.comparison;
  return '<section class="compact-panel"><h3>Was hat sich verändert?</h3>'+(d?'<p class="compact-muted">Gegenüber '+e(dateLabel(d.created_at))+' · gleiches Wertpapier / gleiche Währung</p><dl class="compact-changes"><dt>Kursänderung</dt><dd>'+e(formatPercent(d.price_change_pct))+'</dd><dt>Chartscore Δ</dt><dd>'+e(formatNumber(d.score_delta))+'</dd><dt>News-Richtung</dt><dd>'+e(d.previous_bias||'unbekannt')+' → '+e(d.current_bias||'unbekannt')+'</dd></dl><small>Keine rückwirkende Änderung des Originalberichts.</small>':'<p>Noch kein älterer Bericht desselben Werts und derselben Währung als Vergleich verfügbar. Historie laden oder Deep-Kontext auswählen.</p>')+'</section>';
}
function chartData(a,scenarioId) {
  const deep=Array.isArray(a.scenarios)&&a.scenarios.some(s=>Array.isArray(s.bands));
  const selected=deep?(a.scenarios.find(s=>s.id===scenarioId)||a.scenarios[0]):null;
  const bands=selected?.bands||a.simulation?.bands||[];
  const history=(a.history||[]).filter(b=>finite(b.close)&&b.close>0).slice(-60);
  const allBands=deep?a.scenarios.flatMap(s=>s.bands||[]):bands;
  return {history,bands,allBands,name:selected?.name||'Berechnetes Modellband'};
}
export function modelChart(a,{scenarioId='base',width=320,blocked=false}={}) {
  if(blocked)return '<p class="compact-muted">Modellchart nicht als aktuelle Prognose dargestellt. Historisches Modell bleibt im Originalbericht verfügbar.</p>';
  const {history,bands,allBands,name}=chartData(a,scenarioId);
  const valid=b=>finite(b.day)&&['q10','q50','q90'].every(k=>finite(b[k])&&b[k]>0);
  if(history.length<2||bands.length<2||!bands.every(valid)||!allBands.every(valid))return '<p>Keine vollständigen Modellbänder im gespeicherten Bericht.</p>';
  const values=[...history.map(b=>b.close),...allBands.flatMap(b=>[b.q10,b.q50,b.q90])],min=Math.min(...values),max=Math.max(...values),pad=Math.max((max-min)*.07,max*.005),lo=Math.max(0,min-pad),hi=max+pad;
  const w=Math.max(280,Math.round(width)),h=250,left=Math.min(104,Math.max(48,Math.max(...[lo,hi].map(v=>formatNumber(v).length))*7+10)),right=w-12,top=22,bottom=199;
  const offset=history.length-1,days=Math.max(...bands.map(b=>b.day));if(days<=0)return '<p>Modellhorizont fehlt.</p>';
  const x=n=>left+n/(offset+days)*(right-left),y=v=>bottom-(v-lo)/(hi-lo)*(bottom-top),line=pts=>pts.map(([xx,yy],i)=>(i?'L':'M')+x(xx).toFixed(2)+' '+y(yy).toFixed(2)).join(' ');
  const fan=line(bands.map(b=>[offset+b.day,b.q10]))+' '+bands.slice().reverse().map(b=>'L'+x(offset+b.day).toFixed(2)+' '+y(b.q90).toFixed(2)).join(' ')+' Z';
  const date=v=>String(v).slice(5).split('-').reverse().join('.'),end=bands.at(-1);
  return '<svg class="compact-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+e(name)+': Historie sowie berechneter P50-Verlauf und P10–P90-Band in '+e(a.currency)+'. Keine kalibrierte Wahrscheinlichkeit.">'+
    '<rect x="'+left+'" y="'+top+'" width="'+(right-left)+'" height="'+(bottom-top)+'" fill="none" stroke="var(--border)"/>'+
    [0,.5,1].map(t=>{const v=lo+t*(hi-lo);return '<line x1="'+left+'" x2="'+right+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="var(--border)"/><text x="'+(left-7)+'" y="'+(y(v)+4)+'" text-anchor="end">'+e(formatNumber(v))+'</text>';}).join('')+
    '<text x="'+left+'" y="13">Kurs · '+e(a.currency)+'</text><path d="'+fan+'" fill="var(--accent)" opacity=".14"/><path d="'+line(history.map((b,i)=>[i,b.close]))+'" stroke="var(--text)" stroke-width="2" fill="none"/><path d="'+line(bands.map(b=>[offset+b.day,b.q50]))+'" stroke="var(--accent)" stroke-width="2" stroke-dasharray="5 4" fill="none"/>'+
    '<line x1="'+x(offset)+'" x2="'+x(offset)+'" y1="'+top+'" y2="'+bottom+'" stroke="var(--muted)" stroke-dasharray="3 4"/><text x="'+left+'" y="220">'+e(date(history[0].date))+'</text>'+
    (x(offset)-left>65&&right-x(offset)>75?'<text x="'+x(offset)+'" y="220" text-anchor="middle">Kursstand</text>':'')+
    '<text x="'+right+'" y="220" text-anchor="end">+'+e(days)+' Tage</text><text x="'+((left+right)/2)+'" y="244" text-anchor="middle">Vergangenheit / Handelstage im Modell</text></svg>'+
    '<p class="compact-legend">Durchgezogen: Historie · gestrichelt: P50 · Band: P10–P90</p><div class="compact-band-values"><span>P10 <b>'+e(formatNumber(end.q10))+'</b></span><span>P50 <b>'+e(formatNumber(end.q50))+'</b></span><span>P90 <b>'+e(formatNumber(end.q90))+'</b></span></div><p class="compact-muted">'+e(name)+' · '+e(a.currency)+' · modellierte Bandbreite, keine verifizierten Eintrittschancen</p>';
}
export function scenariosHtml(a,{selected='base',scope='deep',blocked=false}={}) {
  if(blocked)return '';
  const items=(a.scenarios||[]).filter(s=>finite(s.endpoint)),price=a.chart.price;
  const max=Math.max(1,...items.map(s=>Math.abs((s.endpoint/price-1)*100)));
  return '<section class="compact-panel"><h3>Szenarien im Vergleich</h3><p class="compact-muted">Änderung zum Schlusskurs · gemeinsamer Nullpunkt</p>'+items.map((s,i)=>{
    const r=(s.endpoint/price-1)*100,x=58+r/max*45,id=s.id||String(i),interactive=Array.isArray(s.bands),tag=interactive?'button':'div';
    return '<'+tag+(interactive?' type="button" data-compact-scenario="'+e(id)+'" data-scope="'+e(scope)+'" aria-pressed="'+(id===selected)+'"':'')+' class="compact-scenario"><span>'+e(s.name)+'</span><svg viewBox="0 0 116 32" width="116" height="32" role="img" aria-label="'+e(s.name)+' '+e(formatPercent(r))+'"><line x1="58" x2="58" y1="2" y2="18" stroke="var(--border)"/><line x1="58" x2="'+x+'" y1="11" y2="11" stroke="var(--'+(r<0?'bad':'accent')+')" stroke-width="5"/><text x="'+(r<0?114:2)+'" y="31" text-anchor="'+(r<0?'end':'start')+'">'+e(formatPercent(r))+'</text></svg></'+tag+'>';
  }).join('')+'<small>Hypothetische Szenarien bzw. Modellquantile, keine Eintrittswahrscheinlichkeiten.</small></section>';
}
export function reportHtml(v,{scope='signal',selected='base'}={}) {
  return summaryHtml(v)+'<div class="compact-toolbar"><label>Bedingter Plan<select data-compact-direction data-scope="'+scope+'"><option value="long"'+(v.direction==='long'?' selected':'')+'>Long</option><option value="short"'+(v.direction==='short'?' selected':'')+'>Short</option></select></label><span>Ausblick '+e(v.days||'—')+' Handelstage · '+e(v.a.quality?.bars||'—')+' Kerzen Grundlage</span></div><div class="compact-report-grid"><section class="compact-panel compact-chart-panel"><h3>Historie &amp; Modellband</h3><div data-compact-chart></div></section>'+ladderHtml(v)+scenariosHtml(v.a,{scope,selected,blocked:v.blocked})+changesHtml(v)+'</div><button type="button" class="btn" data-compact-prepare="'+scope+'">Neue Analyse vorbereiten</button>';
}
export function previousReport(a,rows=[]) {
  return rows.filter(p=>p.symbol===a.symbol&&p.currency===a.currency&&Date.parse(p.created_at)<Date.parse(a.created_at)).sort((x,y)=>Date.parse(y.created_at)-Date.parse(x.created_at))[0]||null;
}
