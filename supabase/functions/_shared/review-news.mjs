// Conservative, auditable rules over short excerpts. No sentiment model, probability or full-text claim.
const normal=v=>String(v||'').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const rules=[
  {id:'outlook_down',risk:true,label:'Prognose-/Ergebnisrisiko',pattern:/gewinnwarnung|profit warning|(?:prognose|ausblick|guidance|forecast).{0,35}(?:gesenkt|reduziert|senkt|lowered|cut)|(?:senkt|cuts|lowers).{0,30}(?:prognose|ausblick|guidance|forecast)/i},
  {id:'solvency',risk:true,label:'Finanzierungs-/Insolvenzrisiko',pattern:/insolvenz(?:antrag)?|file[sd]? for bankruptcy|zahlungsunf[aä]hig|liquidit[aä]tsengpass/i},
  {id:'accounting',risk:true,label:'Bilanz-/Prüfungsrisiko',pattern:/bilanzf[aä]lschung|accounting fraud|financial restatement|testat verweigert/i},
  {id:'outlook_up',risk:false,label:'Positiver Ausblickhinweis',pattern:/(?:prognose|ausblick|guidance|forecast).{0,35}(?:angehoben|erh[oö]ht|raised)|(?:hebt|raises).{0,30}(?:prognose|ausblick|guidance|forecast)/i},
  {id:'order',risk:false,label:'Auftragshinweis',pattern:/gro[ßs]s?auftrag|major contract|new order|auftragseingang.{0,25}(?:steigt|gestiegen|w[aä]chst)/i}
];
export function assessNews(sources,input,now=new Date(),{failed=false}={}){
  const company=normal(input.company),evidence=[],seen=new Set();let reviewed=0;
  for(const s of sources||[]){
    const stamp=Date.parse(s.published_at),age=now.getTime()-stamp;
    if(!Number.isFinite(stamp)||age<0||age>7*86400000||s.match==='background')continue;
    const text=String(s.title||'')+' '+String(s.excerpt||''),direct=s.match==='direct'||company.length>=5&&normal(text).includes(company);
    if(!direct)continue;
    const readable=['feed_excerpt','page_excerpt','structured_data'].includes(s.content_status)&&String(s.excerpt||'').trim().length>=45;
    if(readable)reviewed++;
    for(const rule of rules){
      const match=rule.pattern.exec(text);if(!match)continue;
      const before=text.slice(Math.max(0,match.index-50),match.index);
      const negated=/(?:keine?|nicht|no|not|denies|without)\s+(?:\S+\s+){0,3}$/i.test(before);
      const uncertain=negated||/ger[uü]cht|rumou?r|unbest[aä]tigt|m[oö]gliche?|k[oö]nnte|could|angeblich|bef[uü]rchtet/i.test(text);
      const key=s.id+'|'+rule.id;if(seen.has(key))continue;seen.add(key);
      evidence.push({source_id:s.id,rule:rule.id,label:rule.label,risk:rule.risk,usable:readable&&!uncertain,uncertain:uncertain||!readable,published_at:s.published_at});
    }
  }
  const negative=evidence.filter(e=>e.usable&&e.risk),positive=evidence.filter(e=>e.usable&&!e.risk);
  const status=failed?'failed':negative.length?(positive.length?'mixed':'risk'):positive.length?'supportive':evidence.length?'unconfirmed':reviewed?'neutral':'unassessed';
  const labels={failed:'Newsprüfung fehlgeschlagen',risk:'Newsrisiko erkannt',mixed:'Widersprüchliche Newsbefunde',supportive:'Positive Newshinweise',unconfirmed:'Newshinweis unbestätigt',neutral:'Kein definierter Ereignistrigger',unassessed:'Keine ausreichend auswertbaren direkten News'};
  return {version:'39.0.0-rules',status,label:labels[status],checked_at:failed?null:now.toISOString(),reviewed,evidence,
    limitation:'Regelhafte Ereignishinweise aus kurzen direkten Quellen-Auszügen der letzten sieben Tage. Keine vollständige semantische Nachrichten-, Bewertungs- oder Faktenprüfung. Fehlende Trigger bedeuten keine Entwarnung.'};
}
export function combineNewsDecision(base,news){
  const decision={...base,conditions:[...(base.conditions||[])],news_status:news.status,news_evidence_ids:[...new Set(news.evidence.map(e=>e.source_id))],basis:'Chart-/Planregeln mit konservativer News-Gegenprüfung aus gekennzeichneten Auszügen. Keine automatische Order.'};
  if(!base.current)return decision;
  const risk=news.evidence.some(e=>e.usable&&e.risk),buy=['buy','buy_staged'].includes(base.code);
  if(news.status==='failed'){decision.current=false;decision.conditions.unshift('Nachrichtenabruf fehlgeschlagen; keine vollständige aktuelle Analyse.');if(buy){decision.code='wait';decision.label='Newsprüfung offen';decision.reason='Der technische Einstieg ist ohne erfolgreiche Nachrichtenprüfung nicht freigegeben.';}return decision;}
  if(risk){
    if(buy){decision.code='wait';decision.label='Einstieg zurückstellen';decision.reason='Ein aktueller direkter Quellen-Auszug enthält einen negativen Ereignistrigger. Erst Auswirkungen und Gegenargumente prüfen.';}
    else if(base.held&&base.code==='hold'){decision.code='review';decision.label='Position überprüfen';decision.reason='Ein negativer News-Ereignistrigger verändert die Prüfgrundlage. Unternehmensbetroffenheit und Investmentthese vor einer Bestandsänderung prüfen.';}
    decision.conditions.unshift('Newsrisiko anhand der angegebenen Originalquelle verifizieren; ein Schlüsselwort allein bestimmt keine Verkaufsmenge.');
  }else if(buy&&['failed','unassessed','unconfirmed'].includes(news.status)){
    decision.code='wait';decision.label='Newsprüfung vor Einstieg';decision.reason='Der technische Kandidat bleibt bedingt. Die direkten Nachrichten sind noch nicht ausreichend prüfbar.';
    decision.conditions.unshift('Direkte aktuelle Unternehmensmeldungen und widersprechende Informationen prüfen.');
  }
  if(news.status==='failed')decision.conditions.unshift('Nachrichtenabruf fehlgeschlagen; kein aktuelles Newsurteil verfügbar.');
  if(news.status==='unassessed')decision.conditions.unshift('Keine ausreichend auswertbaren direkten News; daraus folgt keine Entwarnung.');
  return decision;
}
