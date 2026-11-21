import {quoteStatus} from './supabase/functions/_shared/investment-review.mjs';
export const QUOTE_SOURCES={stored:'Gespeicherte Kurse',csv:'CSV-Import',independent:'Yahoo · experimentell',alphavantage:'Alpha Vantage',eodhd:'EODHD'};
export const remoteSource=source=>['independent','alphavantage','eodhd'].includes(source);
export function refreshState(asset,{capabilities=null,now=new Date()}={}){
 const c=asset?.config||{},s=asset?.quote_status||{},attempt=Object.hasOwn(s,'attempt')?s.attempt:asset?.state?.last_attempt,source=c.source||'stored',interval=[30,60,120,360,1440].includes(Number(c.refresh_minutes))?Number(c.refresh_minutes):60;
 const base={source,provider:QUOTE_SOURCES[source]||source,interval,attempt,price_date:s.source===source&&s.price_date?s.price_date:asset?.state?.price_date||null,last_success_at:s.last_success_at||null,retry_after:s.retry_after||null};
 if(!remoteSource(source))return {...base,code:'needs_source',label:'Keine automatische Kursquelle',detail:source==='csv'?'CSV bleibt unverändert, bis du neue Daten importierst.':'Gespeicherte Kurse werden gelesen, aber nicht vom Anbieter erneuert.',action:'Kursquelle einrichten'};
 if(!c.quote_confirmed)return {...base,code:'unconfirmed',label:'Kursquelle bestätigen',detail:'Anbieterkennung, Handelsplatz und Währung müssen zusammenpassen.',action:'Zuordnung prüfen'};
 if(capabilities&&(source==='alphavantage'&&!capabilities.alpha_configured||source==='eodhd'&&!capabilities.eodhd_configured))return {...base,code:'unconfigured',label:'Anbieterschlüssel fehlt',detail:'Quelle auf dem Server einrichten oder eine andere Quelle ausdrücklich wählen.',action:'Kursquelle einrichten'};
 if(!asset.enabled)return {...base,code:'paused',label:'Automatik pausiert',detail:'Einzelabruf bleibt möglich. Hintergrundprüfungen sind für diesen Wert ausgeschaltet.',action:'Automatik einrichten'};
 if(s.retry_after&&Date.parse(s.retry_after)>now.getTime())return {...base,code:'cooldown',label:'Anbieterpause',detail:attempt?.error||'Nächster Versuch nach der Anbieterpause.',action:'Abrufdetails'};
 if(attempt&&['failed','not_run'].includes(attempt.status))return {...base,code:'failed',label:attempt.status==='failed'?'Kursabruf fehlgeschlagen':'Kursabruf ausstehend',detail:attempt.error||'Letzten gültigen Kurs beibehalten.',action:'Abruf prüfen'};
 if(s.configured_at&&!s.last_verified_at&&!attempt)return {...base,code:'due',label:'Erster Abruf dieser Quelle ausstehend',detail:'Ein vorhandener Kurs kann aus einer früheren Quelle stammen. Die neue Quelle wird erst nach ihrer Prüfung verwendet.',action:'Kursquelle verwalten'};
 const q=quoteStatus(base.price_date,now);return {...base,code:q.code==='current'?'current':'due',label:q.code==='current'?'Tageskurs aktuell':'Kursaktualisierung fällig',detail:'Automatische Prüfung alle '+interval+' Minuten; neue Kurse nur, wenn der Anbieter einen neueren abgeschlossenen Handelstag liefert.',action:'Kursquelle verwalten'};
}
export function monitorSummary(capabilities,now=new Date()){
 const s=capabilities?.scheduler,run=capabilities?.features?.includes('quote_refresh_v40')?capabilities.monitor_owner_last_run:capabilities?.monitor_last_run;
 if(!capabilities)return {ok:false,label:'Aktualisierung wird geprüft',detail:'Serverstatus noch nicht geladen.'};
 if(s?.configured===false)return {ok:false,label:'Zeitplan noch nicht eingerichtet',detail:'Automatische Aktualisierung bei geschlossener Website benötigt den Supabase-Zeitplan.'};
 if(s?.active===false)return {ok:false,label:'Zeitplan pausiert',detail:'Der eingerichtete Hintergrundjob ist nicht aktiv.'};
 const age=run?now.getTime()-Date.parse(run):Infinity,ok=age>=0&&age<2*3600000&&!(capabilities?.monitor_failures>0);
 return {ok,label:ok?'Hintergrundprüfung läuft':capabilities?.monitor_failures>0?'Hintergrundlauf mit Hinweisen':'Hintergrundlauf nicht aktuell',detail:run?'Letzter nachgewiesener Lauf: '+run:'Noch kein erfolgreicher Lauf nachgewiesen.',last_run:run||null};
}
