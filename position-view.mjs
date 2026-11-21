import {e,dateTime} from './investment-view.mjs';
import {formatNumber,formatPercent} from './compact-analysis.mjs';
import {refreshState,monitorSummary} from './refresh-state.mjs';
import {shareNumber} from './quantity-format.mjs';
export function positionPanel(asset,holding){
 const h=holding,has=!!h&&h.quantity>0;
 return '<div class="position-heading"><h3>Deine Position</h3><span>'+(has?e(h.positions)+' Bestandsposten':'Noch kein Bestand')+'</span></div>'+(has?'<div class="position-facts">'+[['Anteile',shareNumber(h.quantity)],['Ø Einstand',formatNumber(h.average_entry_price)+' '+h.currency],['Positionswert',h.amount===null?'Bewertung offen':formatNumber(h.amount)+' '+h.currency],['Ergebnis',h.pnl===null?'Offen':formatNumber(h.pnl)+' '+h.currency+' · '+formatPercent(h.pnl_pct)]].map(([label,value])=>'<div><small>'+e(label)+'</small><strong>'+e(value)+'</strong></div>').join('')+'</div>':'<p>Erfasse Stückzahl und Einstand unabhängig von Kursabruf und Analyse.</p>')+'<div class="position-actions"><button class="btn primary" id="rvEditPosition" type="button">'+(has?'Bestand ändern':'Position anlegen')+'</button>'+(has?'<button class="btn" id="rvAddLot" type="button">Position hinzufügen</button><button class="btn danger" id="rvBookOut" type="button">Ausbuchen</button>':'')+'</div>'+(has?'<p class="position-footnote">Bewertung: '+e(h.quote?.manual?'manuell erfasst':h.quote?.source||'Quelle offen')+' · Kursdatum '+e(h.quote?.price_date||'fehlt')+(h.quote?.status==='stale'?' · veraltet':'')+'</p>':'')+'<p class="position-footnote">Bestandsänderungen werden dokumentiert. Eine Mengenänderung ist eine Korrektur des erfassten Bestands; Verkaufserlöse werden hier nicht berechnet.</p>';
}
export function quotePanel(asset,{capabilities,now=new Date()}={}){
 const s=refreshState(asset,{capabilities,now}),a=s.attempt;
 return '<div class="quote-heading"><div><h3>Kursaktualisierung</h3><strong>'+e(s.label)+'</strong></div><button class="btn" id="rvConfigureQuotes" type="button">'+e(asset.id?s.action:'Beobachten & Kurse einrichten')+'</button></div><p>'+e(s.detail)+'</p><div class="quote-meta"><span>Automatische Quelle: '+e(s.provider)+'</span><span>Letzter gespeicherter Quellenkurs: '+e(s.price_date||'fehlt')+'</span><span>Letzter Versuch: '+e(a?.at?dateTime(a.at):'noch keiner')+'</span></div>'+(s.retry_after?'<p>Nächster möglicher Versuch: '+e(dateTime(s.retry_after))+'</p>':'')+(['independent','alphavantage','eodhd'].includes(s.source)?'<button class="btn" id="rvQuoteNow" type="button">Jetzt aktualisieren</button>':'')+(a?.error?'<details><summary>Abrufmeldung</summary><p>'+e(a.error)+'</p></details>':'');
}
export function automationPanel(capabilities,assets,now=new Date()){
 const s=monitorSummary(capabilities,now),missing=assets.filter(a=>(a.is_portfolio||a.watchlisted)&&refreshState(a,{capabilities,now}).code==='needs_source').length;
 return '<div><strong>'+e(s.label)+'</strong><p>'+e(s.detail)+(missing?' · '+missing+' Wert(e) ohne automatische Kursquelle.':'')+'</p></div><button class="btn" type="button" data-open-diagnostics="true">Status prüfen</button>';
}
export function positionEventsHtml(events){
 if(!events?.length)return '<p class="compact-muted">Noch keine Bestandsänderung seit Einrichtung dieses Verlaufs. Frühere Vorgänge werden nicht nachträglich erfunden.</p>';
 const names={created:'Position erfasst',changed:'Bestand geändert',closed:'Position ausgebucht',removed:'Position entfernt'};
 return '<ol class="position-timeline">'+events.map(v=>'<li><div><strong>'+e(names[v.kind]||'Bestandsänderung')+'</strong><time>'+e(dateTime(v.created_at))+'</time></div><p>'+e(v.before?.quantity==null?'–':Number.isFinite(Number(v.before.quantity))?shareNumber(v.before.quantity):v.before.quantity)+' → '+e(v.after?.quantity==null?'–':Number.isFinite(Number(v.after.quantity))?shareNumber(v.after.quantity):v.after.quantity)+' Anteile · '+e(v.currency)+'</p><small>'+e(v.after?.is_open===false?'Ausgebucht; historische Daten bleiben erhalten.':'Einstand '+formatNumber(v.after?.average_entry_price)+' '+v.currency)+'</small></li>').join('')+'</ol>';
}
