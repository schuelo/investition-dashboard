import {buildDeepAnalysis,validateDeepInput} from './deep-engine.mjs';
import {dedupeSources,relevantNews} from './deep-sources.mjs';
import {ANALYSIS_CURRENCIES} from './security-form.mjs';
import {validateManualUrls} from './manual-sources.mjs';
import {assessNews,combineNewsDecision} from './review-news.mjs';

export class ReviewError extends Error{constructor(message,status=422){super(message);this.status=status;}}
const number=(v,fallback=null)=>v===''||v==null?fallback:Number.isFinite(Number(v))?Number(v):fallback;
const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export const REVIEW_SOURCES=['stored','alphavantage','eodhd','independent','csv'];
export function validateReviewInput(body={}){
  const symbol=String(body.symbol||'').trim().toUpperCase(),currency=String(body.currency||'').trim().toUpperCase();
  if(!/^[A-Z0-9_^+\-]{1,25}\.[A-Z0-9]{1,12}$/.test(symbol))throw new ReviewError('Analysekennung mit Handelsplatz bestätigen, z. B. SND.XETRA.');
  if(!ANALYSIS_CURRENCIES.includes(currency))throw new ReviewError('Notierungswährung bestätigen.');
  const source=String(body.source||'stored'),days=number(body.days,20),lookback=number(body.lookback,252);
  if(!REVIEW_SOURCES.includes(source)||![5,20,60,120,252].includes(days)||![60,126,252,756,1260,2000].includes(lookback))throw new ReviewError('Quelle oder Zeithorizont ungültig.');
  const quote_symbol=String(body.quote_symbol||'').trim().toUpperCase();
  if(['alphavantage','independent'].includes(source)&&(!/^[A-Z0-9][A-Z0-9.\-^=]{0,39}$/.test(quote_symbol)||body.quote_confirmed!==true))throw new ReviewError('Anbieterkennung, Handelsplatz und Währung vor dem Abruf bestätigen.');
  if(source==='eodhd'&&body.quote_confirmed!==true)throw new ReviewError('EODHD-Kennung, Handelsplatz und Notierungswährung vor dem Abruf bestätigen.');
  if(source==='eodhd'&&(symbol.endsWith('.US')&&currency!=='USD'||symbol.endsWith('.XETRA')&&currency!=='EUR'))throw new ReviewError('Die Notierungswährung passt nicht zur ausgewählten US-/XETRA-Kennung. Keine automatische Währungsumrechnung.');
  if(source==='csv'&&(!Array.isArray(body.bars)||body.bars.length<60||body.bars.length>2000))throw new ReviewError('CSV benötigt 60 bis 2000 vollständige OHLCV-Tageskerzen.');
  const p=body.policy||{},policy={budget:number(p.budget,0),tranches:number(p.tranches,3),stop:number(p.stop),target:number(p.target),horizon:String(p.horizon||'').slice(0,120)};
  if(policy.budget<0||policy.budget>1e9||!Number.isInteger(policy.tranches)||policy.tranches<1||policy.tranches>10||[policy.stop,policy.target].some(v=>v!==null&&(v<=0||v>1e9)))throw new ReviewError('Budget, Tranchen oder persönliche Kursgrenzen prüfen.');
  return {symbol,currency,source,days,lookback,quote_symbol,quote_confirmed:body.quote_confirmed===true,
    company:String(body.company||'').trim().slice(0,160),wkn:String(body.wkn||'').trim().toUpperCase().slice(0,6),isin:String(body.isin||'').trim().toUpperCase().slice(0,12),
    context:String(body.context||'').trim().slice(0,2000),news_days:14,policy,
    bars:source==='csv'?body.bars:undefined,manual_urls:validateManualUrls(body.manual_urls||[]),research:body.research===true};
}
// EOD policy: compare with the last weekday BEFORE today. No real-time or exchange-holiday claim.
export function expectedEodDate(now=new Date()){
  const d=new Date(now.toISOString().slice(0,10)+'T00:00:00Z');
  do{d.setUTCDate(d.getUTCDate()-1);}while([0,6].includes(d.getUTCDay()));return d.toISOString().slice(0,10);
}
export function quoteStatus(priceDate,now=new Date()){
  if(!iso(priceDate)||priceDate>=now.toISOString().slice(0,10))return {code:'missing',label:'Kein gültiger abgeschlossener Tageskurs',expected:expectedEodDate(now)};
  const expected=expectedEodDate(now);return {code:priceDate>=expected?'current':'stale',label:priceDate>=expected?'Tageskurs aktuell':'Kurs veraltet',expected};
}
export function investmentDecision(analysis,{position=null,policy={},now=new Date(),attempt=null}={}){
  const price=analysis?.chart?.price,status=quoteStatus(analysis?.price_date,now),held=number(position?.quantity,0)>0;
  const s=analysis?.setups?.find(v=>v.direction==='long');
  let code='wait',label='Abwarten',reason='Keine vollständige aktuelle Entscheidungsgrundlage.',conditions=[];
  if(position?.unsupported_exposure)return {code:'review',label:'Produkt-/Hebelrisiko separat prüfen',reason:'Zum Basiswert besteht eine Produktposition. Zertifikatstückzahlen werden nicht als Aktienbestand übernommen; Gesamtrisiko und Produktbedingungen getrennt prüfen.',conditions:[],current:false,held,quote:status,attempt};
  if(status.code!=='current'||analysis?.quality?.blocked||!Number.isFinite(price)||price<=0){
    return {code,label:analysis?'Aktuelle Entscheidung offen':'Nicht beurteilbar',reason:analysis?'Kursstand oder Datenqualität reicht für aktuelle Handelsschwellen nicht aus.':'Keine ausreichende Kurshistorie. Nachrichten können separat gelesen werden.',conditions:[],current:false,held,quote:status,attempt};
  }
  if(held&&String(position?.direction||'long').toLowerCase()!=='long')return {code:'review',label:String(position.direction).toLowerCase()==='short'?'Short-Position prüfen':'Positionsrichtung prüfen',reason:'Die automatische Handlungseinschätzung ist auf eindeutig zugeordnete Long-Aktien/ETF ausgerichtet. Andere oder ungeklärte Richtungen getrennt prüfen.',conditions:[],current:false,held,quote:status,attempt};
  if(held&&number(policy.stop)>0&&price<=policy.stop){code='sell';label='Verkaufen prüfen';reason='Der letzte Schlusskurs liegt an oder unter deiner hinterlegten Risikogrenze.';conditions=['Aktuellen ausführbaren Kurs, mögliche Gaps und Orderbedingungen prüfen.'];}
  else if(held&&number(policy.target)>0&&price>=policy.target){code='sell_part';label='Teilverkauf prüfen';reason='Dein persönliches Teilgewinnziel wurde auf Schlusskursbasis erreicht.';conditions=['Teilmenge anhand des Depotgewichts und der weiter gültigen These bestimmen.'];}
  else if(held&&analysis.chart.trend===-1){code='reduce';label='Reduzieren prüfen';reason='Die gehaltene Position zeigt einen Abwärtstrend. Die Investmentthese benötigt eine erneute Prüfung.';conditions=['News-Gegenargumente und eigene Risikogrenze prüfen; ein Trendfilter allein erzwingt keinen Verkauf.'];}
  else if(held){code='hold';label='Halten prüfen';reason='Kein hinterlegter Risiko-/Gewinntrigger ausgelöst; die Chartdaten rechtfertigen allein keine Änderung der Position.';conditions=[s?.invalidation||'Kernthese und Datenstand weiter beobachten.'];}
  else if(analysis.chart.trend===1&&s?.status==='bedingter Kandidat'&&s?.decision!=='ABWARTEN / KEIN TRADE'){
    code=policy.tranches>1?'buy_staged':'buy';label=policy.tranches>1?'Gestaffelten Kauf prüfen':'Kauf prüfen';reason='Positiver Charttrend und ein bedingter technischer Kandidat. Nachrichtenbewertung und Triggerbestätigung stehen gesondert aus.';conditions=[s.trigger,s.invalidation];
  }else{reason=s?.reason||'Kein bestätigter technischer Einstieg. Daten und relevante Nachrichten gemeinsam prüfen.';conditions=[s?.trigger||'Triggerbestätigung abwarten.'];}
  const tranche=number(policy.budget,0)>0?{count:policy.tranches||1,amount:policy.budget/(policy.tranches||1),currency:analysis.currency,note:'Budgetaufteilung aus Nutzervorgabe, keine bestätigte Kaufmenge. Weitere Tranchen nur nach erneuter Prüfung.'}:null;
  return {code,label,reason,conditions:conditions.filter(Boolean),current:true,held,quote:status,attempt,tranche,
    basis:'Deterministische Chart-/Planprüfung; aktuelle Nachrichten sind getrennte Belege. Keine automatische Order.'};
}
export function buildInvestmentReview(input,{market=null,news=[],previous=null,position=null,now=new Date(),warnings=[]}={}){
  const sources=dedupeSources([...relevantNews(news,input,now),...news.filter(s=>s.manual||['free_rss_search','targeted_free_rss'].includes(s.discovery))],now),notes=[...warnings];let analysis=null;
  if(market?.bars?.length){try{
    const req=validateDeepInput({...input,market_source:'csv',manual_start:true,use_ai:false,bars:market.bars,manual_urls:[],risk:{}});
    analysis=buildDeepAnalysis(req,market.bars,{sources,now,previous:previous?.analysis?[previous.analysis]:[],provider:market.provider});
    analysis.request.market_source=input.source;
    analysis.market_data={source:input.source,eodhd_used:input.source==='eodhd',...(market.provenance||{})};
  }catch(e){notes.push('Chartberechnung nicht möglich: '+e.message);}}
  const newsAssessment=assessNews(sources,input,now),decision=combineNewsDecision(investmentDecision(analysis,{position,policy:input.policy,now,attempt:market?.attempt}),newsAssessment);
  const long=analysis?.setups?.find(s=>s.direction==='long');
  decision.levels={entry:long?.entry||null,stop:input.policy.stop||long?.stop||null,target:input.policy.target||long?.target1||null,stop_source:input.policy.stop?'Eigene Planvorgabe':'Technisches Modell',target_source:input.policy.target?'Eigene Planvorgabe':'Technisches Szenario'};
  const scenarios=(analysis?.scenarios||[]).map(s=>({id:s.id,name:s.name,endpoint:s.endpoint,change_pct:(s.endpoint/analysis.chart.price-1)*100,assumption:s.assumption}));
  const previousDecision=previous?.decision||null;
  return {version:'39.2.0',symbol:input.symbol,currency:input.currency,company:input.company,created_at:now.toISOString(),
    request:{days:input.days,lookback:input.lookback,source:input.source,quote_symbol:input.quote_symbol,context:input.context,manual_urls:input.manual_urls},
    price_date:analysis?.price_date||null,price:analysis?.chart?.price||null,provider:market?.provider||null,
    quote:quoteStatus(analysis?.price_date,now),attempt:market?.attempt||null,analysis,decision,scenarios,sources,
    news:{count:sources.filter(s=>s.match!=='background').length,as_of:now.toISOString(),assessment:newsAssessment,limitation:'Feed-Metadaten und Auszüge sind keine vollständig gelesenen Artikel. Keine Treffer bedeutet nicht, dass es keine relevanten Nachrichten gibt.'},
    change:previousDecision?{previous_at:previous.created_at,previous:previousDecision.label,current:decision.label,changed:previousDecision.code!==decision.code}:null,
    policy:input.policy,position,warnings:notes,limits:['Szenarien sind Modellannahmen, keine kalibrierten Eintrittswahrscheinlichkeiten.','Tageskursprüfung mit Werktagskalender; Börsenfeiertage und Intraday-Kurse nicht geprüft.','Stops und KO-Produkte benötigen separate ausführbare Kurse und Produktbedingungen.']};
}
export async function runInvestmentReview(input,deps){
  const now=deps.now?.()||new Date(),warnings=[];let market=null,news=[],newsFailed=false,feed=null;
  try{market=await deps.loadMarket(input,now);}catch(e){warnings.push(e.message);market={attempt:{status:'not_run',at:now.toISOString(),error:e.message}};}
  if(market?.warning)warnings.push(market.warning);
  try{const read=await deps.readNews(input,now);news=Array.isArray(read)?read:read.sources;feed=Array.isArray(read)?null:read.targeted_feed;if(feed?.status!=='success'&&feed?.error)warnings.push(feed.error);}catch{newsFailed=true;warnings.push('Nachrichtenabruf fehlgeschlagen. Vorhandene Quellen behalten ihren ursprünglichen Datenstand.');}
  if(input.research&&deps.discover){try{news.push(...await deps.discover(input,now));}catch{warnings.push('Zusätzliche Online-Recherche nicht erreichbar.');}}
  if(input.manual_urls.length&&deps.manualSources){try{const s=await deps.manualSources(input,now);news.push(...s.sources);warnings.push(...s.warnings);}catch{warnings.push('Eigene Quellen nicht lesbar; keine Inhalte erfunden.');}}
  let previous=null,position=null,positionKnown=true;
  try{previous=await deps.previous();}catch{warnings.push('Vorheriger Bericht nicht erreichbar. Vergleich derzeit nicht verfügbar.');}
  try{position=await deps.position();}catch{positionKnown=false;warnings.push('Depotbestand nicht erreichbar. Keine aktuelle positionsbezogene Handlung freigegeben.');}
  if(deps.preserveManualSources&&previous?.sources)news.push(...previous.sources.filter(s=>s.manual));
  if(!market?.bars&&previous?.analysis?.history?.length){market={...market,bars:previous.analysis.history,provider:previous.provider};warnings.push('Historische Kurse des vorherigen Berichts verwendet; keine neue Kursaktualisierung.');}
  const review=buildInvestmentReview(input,{market,news,previous,position,now,warnings});
  if(feed)review.news.targeted_feed={status:feed.status,fetched_at:feed.fetched_at||null,last_attempt_at:feed.last_attempt_at||feed.attempted_at||null,error:feed.error||null,cached:!!feed.cached};
  review.position_known=positionKnown;if(!positionKnown)review.decision={...review.decision,code:'wait',label:'Depotkontext fehlt',reason:'Der tatsächliche Bestand konnte nicht geprüft werden. Chartbefunde und Quellen bleiben lesbar.',current:false};
  try{review.conversation_assumptions=deps.readNotes?(await deps.readNotes()).map(m=>({id:m.id,role:m.role,created_at:m.created_at,content:String(m.content||'').slice(0,1200),truncated:String(m.content||'').length>1200})):[];}catch{review.conversation_assumptions=[];review.warnings.push('Frühere Gesprächsannahmen konnten nicht geladen werden.');}
  if(deps.preserveManualSources)for(const source of review.sources.filter(s=>s.manual)){const old=previous?.sources?.find(s=>s.canonical_url===source.canonical_url);if(old){source.retrieved_at=old.retrieved_at;const full=review.analysis?.sources?.find(s=>s.id===source.id);if(full)full.retrieved_at=old.retrieved_at;}}
  if(newsFailed){review.news.status='failed';review.news.as_of=previous?.news?.as_of||null;review.news.assessment=assessNews(review.sources,input,now,{failed:true});review.decision={...combineNewsDecision(investmentDecision(review.analysis,{position,policy:input.policy,now,attempt:review.attempt}),review.news.assessment),levels:review.decision.levels};if(!positionKnown)review.decision={...review.decision,current:false,code:'wait',label:'Depotkontext fehlt',reason:'Der tatsächliche Depotbestand konnte nicht geprüft werden.'};}else review.news.status='success';
  try{const saved=await deps.save(review,market);return {...(saved.snapshot||review),id:saved.id,asset_id:saved.asset_id,saved:true};}
  catch{return {...review,saved:false,warnings:[...review.warnings,'Ergebnis berechnet, aber nicht gespeichert. JSON exportieren; keinen erneuten Anbieterabruf auslösen.']};}
}
