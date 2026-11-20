import {e} from './investment-view.mjs';
export function dashboardDiagnostics({version='39.5.0',capabilities=null,portfolio=null,assets=[],series={},now=new Date()}={}){
 const known=Object.values(series),validMarks=(portfolio?.marks||[]).filter(m=>m.amount!==null&&Number.isFinite(Number(m.amount))&&Number.isFinite(Date.parse(m.recorded_at))),histories=known.filter(s=>s.kind==='price_history'&&s.points?.length>=2),manual=known.filter(s=>s.kind==='manual_valuation'),pricesMissing=assets.filter(a=>!Number.isFinite(Number(a.state?.price))||Number(a.state.price)<=0).length;
 const elapsed=capabilities?.monitor_last_run?now.getTime()-Date.parse(capabilities.monitor_last_run):Infinity;
 const checks=[
  {label:'Website / Server',value:version+' / '+(capabilities?.version||'noch nicht erreichbar'),ok:!!capabilities&&capabilities.version===version},
  {label:'Depotdaten',value:portfolio?(portfolio.holdings?.length||0)+' bewertete/prüfbare Wertpapiere · '+(portfolio.groups?.length||0)+' Währungsgruppen'+(portfolio.load_warning?' · letzte Antwort veraltet':''):'Noch keine erfolgreiche Depotantwort',ok:!!portfolio&&!portfolio.load_warning},
  {label:'Gespeicherter Depotverlauf',value:validMarks.length+' Messung(en)'+(portfolio?.history_warning?' · '+portfolio.history_warning:''),ok:!!portfolio&&!portfolio.history_warning&&validMarks.length>0},
  {label:'Kursgrafiken',value:histories.length+' gespeicherte Historie(n) · '+manual.length+' manuelle Einzelbewertung(en) · '+pricesMissing+' Werte ohne Anbieterpreis',ok:histories.length>0||manual.length>0||assets.length===0},
  {label:'Verlaufsspeicher',value:capabilities?.table_health?.history===false?'Nicht erreichbar · SQL/Projekt prüfen':capabilities?'Serverprüfung '+(capabilities.table_health?'erfolgt':'mit älterer Function nicht verfügbar'):'Noch nicht geprüft',ok:capabilities?.table_health?.history===true},
  {label:'Kontinuierliche Prüfung',value:elapsed<=2*3600000?'Letzter nachgewiesener Lauf '+capabilities.monitor_last_run:Number.isFinite(elapsed)?'Letzter Lauf veraltet: '+capabilities.monitor_last_run:'Noch kein Hintergrundlauf nachgewiesen',ok:elapsed>=0&&elapsed<=2*3600000},
  {label:'Deep / Hebel',value:capabilities?.table_health?.deep===true?'Berichtstabelle erreichbar; Deep-Function separat bereitstellen':'Einrichtung noch prüfen · Basisanalyse bleibt nutzbar',ok:capabilities?.table_health?.deep===true},
  {label:'KI-Chat',value:capabilities?.chat_configured?'Schlüssel, freigegebenes Modell und Tarif-Bestätigung gesetzt; tatsächlicher Google-Abrechnungsstatus nicht automatisch geprüft':'Nicht vollständig freigeschaltet; Notizen und ChatGPT-Export bleiben nutzbar',ok:!!capabilities?.chat_configured}
 ];
 return {version,server_version:capabilities?.version||null,checked_at:now.toISOString(),counts:{assets:assets.length,holdings:portfolio?.holdings?.length||0,marks:validMarks.length,histories:histories.length,manual_points:manual.length},checks};
}
export function diagnosticsHtml(report){return '<dl>'+report.checks.map(c=>'<dt>'+e(c.label)+'</dt><dd class="'+(c.ok?'':'bad')+'">'+e(c.value)+'</dd>').join('')+'</dl><p class="compact-muted">Stand '+e(report.checked_at)+'. Die Prüfung startet weder Kursanbieter noch KI. Ein nachgewiesener Hintergrundlauf bestätigt nicht, dass jeder einzelne Anbieterabruf erfolgreich war.</p>';}
