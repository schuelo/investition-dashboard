import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSecurity,validateSecurityQuery,validIsin,normalizeCatalogue,readProviderJson} from '../supabase/functions/_shared/security-resolver.mjs';
import {securityFieldChanges} from '../supabase/functions/_shared/security-form.mjs';
const now=new Date('2026-11-08T06:00Z'),request={query:'860180',manual_start:true,preferred_exchange:'XETRA'};
const identity={figi:'BBG000A00001',compositeFIGI:'BBG000C00001',shareClassFIGI:'BBG000S00001',name:'SCHNEIDER ELECTRIC SE',ticker:'SND',exchCode:'GY',marketSector:'Equity',securityType:'Common Stock',securityType2:'Common Stock'};
const rows=[{Code:'SND',Exchange:'XETRA',Name:'Schneider Electric SE',Currency:'EUR',ISIN:'FR0000121972',Type:'Common Stock'},
  {Code:'SND',Exchange:'US',Name:'Unrelated issuer with same ticker',Currency:'USD',ISIN:'US0378331005',Type:'Common Stock'}];
function adapters(extra={}) {
  const calls={lookup:0,eod:0,search:[],maps:[],saved:[]};
  const deps={now:()=>now,readCache:async()=>null,reserveLookup:async()=>{calls.lookup++;return true;},reserveEod:async()=>{calls.eod++;return true;},
    searchEod:async q=>{calls.search.push(q);return rows;},mapFigi:async jobs=>{calls.maps.push(jobs);return jobs.map(j=>({data:[j.idType==='ID_WERTPAPIER'||j.idValue==='FR0000121972'?identity:{...identity,figi:'BBG000B00002',compositeFIGI:'BBG000B00003',shareClassFIGI:'BBG000B00004'}]}));},saveCache:async(key,result)=>calls.saved.push({key,result}),...extra};return{deps,calls};
}
test('WKN leading zeros, case normalization, ISIN checksum and explicit start are enforced',()=>{
  assert.equal(validateSecurityQuery({...request,query:' a1jx52 '}).query,'A1JX52');assert.equal(validateSecurityQuery({...request,query:'000001'}).query,'000001');
  assert.equal(validIsin('FR0000121972'),true);assert.equal(validIsin('US0378331005'),true);assert.equal(validIsin('US0378331006'),false);
  for(const query of ['12345','1234567','US0378331006','ABC:XYZ','../secret','<script>'])assert.throws(()=>validateSecurityQuery({...request,query}));
  assert.throws(()=>validateSecurityQuery({...request,manual_start:false}),/ausdrücklich/);
});
test('WKN resolution verifies ISIN against FIGI identity and rejects a same-ticker foreign issuer',async()=>{
  const h=adapters(),r=await resolveSecurity(request,h.deps);assert.equal(r.candidates.length,1);assert.equal(r.candidates[0].market_symbol,'SND.XETRA');assert.equal(r.candidates[0].isin,'FR0000121972');assert.equal(r.candidates[0].chart_symbol,'XETR:SND');assert.equal(r.candidates[0].currency,'EUR');assert.equal(h.calls.eod,1);assert.equal(h.calls.maps.length,2);assert.equal(h.calls.maps[0][0].idType,'ID_WERTPAPIER');assert.equal(h.calls.saved[0].key,'WKN:860180:XETRA');
});
test('Share-class mismatch does not confuse preferred/common shares or ETF share classes',async()=>{
  const h=adapters({mapFigi:async jobs=>jobs.map(j=>({data:[j.idType==='ID_WERTPAPIER'?identity:{...identity,figi:'BBG000B00002',compositeFIGI:'BBG000B00003',shareClassFIGI:'BBG000B00004'}]}))});await assert.rejects(()=>resolveSecurity(request,h.deps),/Keine eindeutig/);assert.equal(h.calls.saved.length,0);
});
test('Matching share-class FIGI allows a different exchange FIGI without using names as proof',async()=>{
  const h=adapters({mapFigi:async jobs=>jobs.map(j=>({data:[j.idType==='ID_WERTPAPIER'?identity:{...identity,figi:'BBG000B00002',name:'Different name',compositeFIGI:'BBG000B00003'}]}))});const r=await resolveSecurity(request,h.deps);assert.ok(r.candidates.some(c=>c.market_symbol==='SND.XETRA'));
});
test('ISIN entry needs only exact provider ISIN, excludes nearby shares and makes no FIGI call',async()=>{
  const h=adapters(),r=await resolveSecurity({...request,query:'FR0000121972'},h.deps);assert.equal(r.candidates.length,1);assert.equal(h.calls.maps.length,0);assert.equal(h.calls.eod,1);assert.equal(r.candidates[0].wkn,null);
});
test('Multiple verified listings are returned and sorted with the preferred venue first',async()=>{
  const h=adapters({searchEod:async()=>[rows[0],{...rows[0],Exchange:'PA',Code:'SU',isPrimary:true}]});const r=await resolveSecurity(request,h.deps);assert.equal(r.candidates.length,2);assert.equal(r.candidates[0].market_symbol,'SND.XETRA');
});
test('A second discovery query can find the preferred venue without losing earlier verified listings',async()=>{
  const h=adapters({searchEod:async q=>q==='SND'?[{...rows[0],Exchange:'US',Currency:'USD'}]:[rows[0]]});const r=await resolveSecurity(request,h.deps);assert.equal(h.calls.eod,2);assert.equal(r.candidates.length,2);assert.equal(r.candidates[0].exchange,'XETRA');
});
test('A quota exhausted after a verified partial result returns that result with a warning',async()=>{
  let reservations=0;const h=adapters({reserveEod:async()=>++reservations===1,searchEod:async()=>[{...rows[0],Exchange:'US',Currency:'USD'}]});const r=await resolveSecurity(request,h.deps);assert.equal(r.candidates.length,1);assert.match(r.warnings[0],/Kontingent/);
});
test('Fresh owner cache is reused without new quota reservations or provider requests',async()=>{
  const a=adapters(),first=await resolveSecurity(request,a.deps);const b=adapters({readCache:async()=>first});const r=await resolveSecurity(request,b.deps);assert.equal(r.cached,true);assert.equal(b.calls.lookup,0);assert.equal(b.calls.eod,0);assert.equal(b.calls.maps.length,0);
});
test('A venue-preference change does not reuse an incomplete cache from another venue',async()=>{
  const a=adapters(),first=await resolveSecurity(request,a.deps),b=adapters({readCache:async()=>first});const r=await resolveSecurity({...request,preferred_exchange:'US'},b.deps);assert.equal(r.cached,false);assert.equal(b.calls.lookup,1);assert.notEqual(validateSecurityQuery(request).key,validateSecurityQuery({...request,preferred_exchange:'US'}).key);
});
test('Expired/unverified cache never becomes an authoritative lookup result',async()=>{
  const a=adapters(),first=await resolveSecurity(request,a.deps);for(const cached of [{...first,expires_at:'2026-10-01'},{...first,candidates:[{...first.candidates[0],verified:false}]}]){
    const h=adapters({readCache:async()=>cached});const r=await resolveSecurity(request,h.deps);assert.equal(r.cached,false);assert.equal(h.calls.lookup,1);
  }
});
test('Derivative WKN cannot silently turn into the underlying equity',async()=>{
  const h=adapters({mapFigi:async()=>[{data:[{...identity,securityType:'Equity Warrant',securityType2:'Warrant'}]}]});await assert.rejects(()=>resolveSecurity(request,h.deps),/Basiswert separat/);assert.equal(h.calls.eod,0);assert.equal(h.calls.saved.length,0);
});
test('No candidate is fabricated when provider identifiers or currencies are missing',()=>{
  assert.equal(normalizeCatalogue([{...rows[0],ISIN:''},{...rows[0],Currency:''},{...rows[0],Type:'Warrant'},{...rows[0],Code:'<BAD>'}]).length,0);assert.equal(normalizeCatalogue([{...rows[0],Exchange:'LSE',Currency:'GBp'}])[0].currency,'GBX');
});
test('Conflicting identifiers or quote units for the same provider symbol are rejected',()=>{
  assert.throws(()=>normalizeCatalogue([rows[0],{...rows[0],ISIN:'US0378331005'}]),/Widersprüchliche/);assert.throws(()=>normalizeCatalogue([rows[0],{...rows[0],Currency:'USD'}]),/Widersprüchliche/);assert.equal(normalizeCatalogue([rows[0],rows[0]]).length,1);
});
test('US consolidated exchange does not fabricate a TradingView primary exchange',()=>{assert.equal(normalizeCatalogue([{...rows[0],Exchange:'US',Currency:'USD'}])[0].chart_symbol,null);});
test('Lookup and global EODHD quota block before corresponding network requests',async()=>{
  const a=adapters({reserveLookup:async()=>false});await assert.rejects(()=>resolveSecurity(request,a.deps),/Suchlimit/);assert.equal(a.calls.maps.length,0);
  const b=adapters({reserveEod:async()=>false});await assert.rejects(()=>resolveSecurity(request,b.deps),/EODHD-Tageskontingent/);assert.equal(b.calls.search.length,0);
});
test('Invalid mapping replies and rate limits remain actionable; no automatic retry',async()=>{
  const a=adapters({mapFigi:async()=>[{error:'provider error'}]});await assert.rejects(()=>resolveSecurity(request,a.deps),/nicht verfügbar/);
  await assert.rejects(()=>readProviderJson(new Response('{}',{status:429})),/keine automatische Wiederholung/i);
  await assert.rejects(()=>readProviderJson(new Response('bad json')),/Ungültige/);
  await assert.rejects(()=>readProviderJson(new Response('x',{headers:{'content-length':'1900000'}})),/zu groß/);
});
test('Cache write failure preserves the verified result and exposes the missing cache',async()=>{
  const h=adapters({saveCache:async()=>{throw Error('db error');}});const r=await resolveSecurity(request,h.deps);assert.equal(r.candidates.length,1);assert.match(r.warnings[0],/nicht zwischengespeichert/);
});
const candidate={...normalizeCatalogue([rows[0]])[0],wkn:'860180',verified:true};
test('Trade form fills both providers, name, WKN/ISIN and currency, clearing price levels on identity change',()=>{
  const r=securityFieldChanges('trade',candidate,{marketSymbol:'NVDA.US',currency:'USD',type:'Aktie'});assert.equal(r.values.symbol,'XETR:SND');assert.equal(r.values.marketSymbol,'SND.XETRA');assert.equal(r.values.wkn,'860180');assert.equal(r.values.isin,'FR0000121972');assert.equal(r.values.stop,'');assert.equal(r.values.quantity,'');
  const same=securityFieldChanges('trade',candidate,{marketSymbol:'SND.XETRA',currency:'EUR',type:'Aktie'});assert.equal('stop' in same.values,false);
});
test('KO trade form keeps product identity separate and clears old product terms on underlying change',()=>{
  const r=securityFieldChanges('trade',candidate,{marketSymbol:'NVDA.US',currency:'USD',type:'Knock-out'});assert.equal(r.values.type,'Knock-out');assert.equal(r.values.wkn,'');assert.equal(r.values.koBarrier,'');
  const same=securityFieldChanges('trade',candidate,{marketSymbol:'SND.XETRA',currency:'EUR',type:'Knock-out'});assert.equal('wkn' in same.values,false);
});
test('Analysis form fills requested identity without changing thesis/risk capital; resets stale fundamentals/product assumptions',()=>{
  const s=securityFieldChanges('signal',candidate);assert.equal(s.values.ssCompany,'Schneider Electric SE');assert.equal(s.values.ssCurrency,'EUR');
  const d=securityFieldChanges('deep',candidate,{daSymbol:'NVDA.US',daCurrency:'USD'});assert.equal(d.values.daCikVerified,false);assert.equal(d.values.daProductType,'none');assert.equal(d.values.daRiskFxVerified,false);assert.equal('daCapital' in d.values,false);assert.equal('daContext' in d.values,false);assert.equal('daManualUrls' in d.values,false);
});
test('Paper picker only changes new-experiment fields and respects same-venue/max-three constraints',()=>{
  assert.equal(securityFieldChanges('paper',candidate,{ppSymbols:'NVDA.US'}).values.ppSymbols,'SND.XETRA');
  assert.equal(securityFieldChanges('paper',candidate,{ppSymbols:'SAP.XETRA'},{append:true}).values.ppSymbols,'SAP.XETRA, SND.XETRA');
  assert.throws(()=>securityFieldChanges('paper',candidate,{ppSymbols:'NVDA.US'},{append:true}),/andere Börse/);
  assert.throws(()=>securityFieldChanges('paper',candidate,{ppSymbols:'SAP.XETRA,SIE.XETRA,ALV.XETRA'},{append:true}),/drei/);
  assert.throws(()=>securityFieldChanges('paper',{...candidate,exchange:'PA'}),/XETRA\/EUR/);
});
test('US chart needs an explicit venue; unsupported analysis currency cannot be silently re-labelled',()=>{
  const us={...candidate,market_symbol:'SND.US',exchange:'US',currency:'USD',code:'SND',chart_symbol:null};assert.throws(()=>securityFieldChanges('trade',us,{type:'Aktie'}),/Chart-Handelsplatz/);assert.equal(securityFieldChanges('trade',us,{type:'Aktie'},{chart_symbol:'NYSE:SND'}).values.symbol,'NYSE:SND');
  assert.throws(()=>securityFieldChanges('deep',{...candidate,currency:'ARS'}),/nicht unterstützt/);
});
test('History/CSV pickers target their own fields; event picker appends identity without overwriting the event',()=>{
  assert.deepEqual(securityFieldChanges('history',candidate).values,{daHistorySymbol:'SND.XETRA'});assert.deepEqual(securityFieldChanges('csv',candidate).values,{ppCsvSymbol:'SND.XETRA'});
  const a=securityFieldChanges('event',candidate,{eventAnalysisInput:'Energieinvestitionen prüfen'});assert.ok(a.values.eventAnalysisInput.startsWith('Energieinvestitionen prüfen'));assert.match(a.values.eventAnalysisInput,/WKN 860180/);assert.throws(()=>securityFieldChanges('event',candidate,{eventAnalysisInput:'x'.repeat(2000)}),/zu lang/);
});
