import {e} from './investment-view.mjs';
import {expectedEodDate} from './supabase/functions/_shared/investment-review.mjs';
export const PERIOD_DAYS={'1W':7,'1M':31,'3M':93,'1J':366,Max:Infinity};
const DAY=86400000;
export function historyWindow(values,period='1M',{now=new Date(),anchor='latest'}={}){
 const byTime=new Map();for(const p of values||[]){const t=Date.parse(p?.date);if(typeof p?.value!=='number'||!Number.isFinite(p.value)||p.value<0||!Number.isFinite(t)||t>now.getTime())continue;if(/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&new Date(t).toISOString().slice(0,10)!==p.date)continue;byTime.set(t,{...p,t});}
 const all=[...byTime.values()].sort((a,b)=>a.t-b.t),last=all.at(-1),span=PERIOD_DAYS[period]??31,end=anchor==='latest'&&last?last.t:now.getTime(),cutoff=end-span*DAY,points=all.filter(p=>p.t>=cutoff&&p.t<=end);
 return {points,all,period,anchor,end:last?.date||null,start:all[0]?.date||null,stale:!!last&&last.date.slice(0,10)<expectedEodDate(now),partial:Number.isFinite(span)&&!!all.length&&all[0].t>cutoff+3*DAY,single:points.length===1};
}
export function periodButtons(values,{selected='1M',scope='price',now=new Date(),anchor='latest'}={}){
 const w=historyWindow(values,'Max',{now,anchor}),allowed=['price','review','watch'].includes(scope)?scope:'price';
 return Object.keys(PERIOD_DAYS).map(p=>{const choice=historyWindow(w.all,p,{now,anchor}),disabled=!choice.points.length;return '<button class="btn" type="button" data-'+allowed+'-period="'+p+'" aria-pressed="'+(p===selected)+'"'+(disabled?' disabled':'')+' title="'+e(disabled?'Keine gespeicherten Daten':choice.partial?'Verfügbare Historie ist kürzer als '+p:'Zeitraum bis '+choice.end?.slice(0,10))+'">'+p+'</button>';}).join('');
}
export function windowCaption(values,period,{now=new Date(),anchor='latest'}={}){
 const w=historyWindow(values,period,{now,anchor});if(!w.all.length)return 'Keine gespeicherte Historie.';
 return 'Datenstand '+w.end.slice(0,10)+(w.stale?' · veraltet':'')+(w.partial?' · Historie kürzer als '+period:'')+(anchor==='latest'?' · Zeitraum endet am letzten gespeicherten Wert':'')+(w.single?' · ein Messpunkt':'');
}
