import {validateDepotInput,depotNumber,depotDay} from './supabase/functions/_shared/depot-input.mjs';
import {e} from './investment-view.mjs';
import {decimalInput,shareNumber} from './quantity-format.mjs';
const money=v=>Number(v).toLocaleString('de-DE',{maximumFractionDigits:2,minimumFractionDigits:2});
export function createHoldingEditor({document,window,getAssets=()=>[],getAsset=()=>null,invoke,onSaved,onBusy,isRunning,onOpen=()=>{},onCancel=()=>{},now=()=>new Date()}){
 const $=id=>document.getElementById(id);
 let rows=[],asset=null,active=false,token=0,operation=0,busy=false,fetching=false,ready=false,request=null,lastIdentity='',boundIdentity='',intent='edit';
 const identity=()=>[$('hpSymbol').value.trim().toUpperCase().replace(/^XETR:([A-Z0-9_^+\-]+)$/,'$1.XETRA'),$('hpCurrency').value].join('|');
 const status=(message,bad=false)=>{$('rvHoldingStatus').textContent=message;$('rvHoldingStatus').setAttribute('role',bad?'alert':'status');};
 const chosen=()=>rows.find(p=>(p.position_origin==='legacy_plan'?'legacy:':'')+p.id===$('rvHoldingSelect').value);
 function pickerReset(){window?.dispatchEvent(new CustomEvent('investition:reset-security-picker',{detail:{scope:'holding'}}));}
 function preview(){
  $('hpManualFields').hidden=$('hpValuation').value!=='manual';$('hpManualPrice').required=$('hpValuation').value==='manual';$('hpManualDate').required=$('hpValuation').value==='manual';
  try{const q=depotNumber($('rvHoldingQuantity').value,'Stückzahl'),p=depotNumber($('rvHoldingEntry').value,'Einstand');$('hpPreview').innerHTML='<strong>Vorschau · Einstand gesamt</strong><p>'+e(money(q*p))+' '+e($('hpCurrency').value)+' · '+e(shareNumber(q))+' Stück × '+e(money(p))+'</p><small>Ohne Kursabruf. Keine Order.</small>';}
  catch{$('hpPreview').innerHTML='<p class="compact-muted">Stückzahl und Einstand ergeben deinen investierten Betrag. Ein Bewertungskurs ist optional.</p>';}
 }
 function fill(){
  const p=chosen();request=null;$('rvHoldingQuantity').value=decimalInput(p?.quantity);$('rvHoldingEntry').value=decimalInput(p?.average_entry_price);$('hpEntryDate').value=p?.entry_date||'';
  $('rvHoldingDirection').value=p?(['Long','Short'].find(d=>d.toLowerCase()===String(p.direction).toLowerCase())||''):'Long';$('rvHoldingType').value=p?.instrument_type==='ETF'?'ETF':'Aktie';
  $('hpTypeDetails').open=$('rvHoldingDirection').value==='';
  $('hpAdditionalRow').hidden=!!p||!rows.length;$('hpAdditionalConfirmed').checked=intent==='add'&&!p&&rows.length>0;$('hpAdditionalConfirmed').required=!p&&rows.length>0;
  $('hpClosePanel').hidden=!p;$('hpClosePanel').open=intent==='close';$('hpCloseConfirmed').checked=false;$('rvHoldingClose').disabled=true;
  $('hpPositionHelp').textContent=p?'Du bearbeitest diesen Bestandsposten: '+shareNumber(p.quantity)+' von insgesamt '+shareNumber(rows.reduce((n,v)=>n+Number(v.quantity||0),0))+' Anteilen. Die absolute Stückzahl dieses Postens wird ersetzt.':rows.length?'Eine zusätzliche Position wird getrennt angelegt. Den zusätzlichen Bestand ausdrücklich bestätigen.':'Neue tatsächliche Position. Eine Analyse ist dafür nicht erforderlich.';
  $('hpSecurityInputs').hidden=!!asset?.id&&intent!=='add';$('hpBookOut').hidden=!p||intent==='close';$('rvHoldingIntro').textContent=intent==='close'?'Den ausgewählten Bestandsposten aus dem Depot ausbuchen.':p?'Stückzahl und Einstand dieses Bestandspostens anpassen.':'Wertpapier, Stückzahl und Einstand erfassen.';
  $('rvHoldingPanel').setAttribute('data-position-intent',intent);$('hpPositionSelector').hidden=rows.length<2;
  $('rvHoldingTitle').textContent=intent==='close'?'Position ausbuchen':p?'Bestand ändern':'Position hinzufügen';$('rvHoldingSave').textContent=p?'Bestand speichern':'Position anlegen';$('hpClosePanel').open=intent==='close'&&!!p;preview();
 }
 function clear(){
  token++;operation++;active=false;busy=false;fetching=false;ready=false;intent='edit';rows=[];asset=null;request=null;boundIdentity='';
  for(const id of ['hpSymbol','hpCompany','hpWkn','hpIsin','rvHoldingQuantity','rvHoldingEntry','hpEntryDate','hpManualPrice','hpManualDate'])$(id).value='';
  $('hpCurrency').value='EUR';$('hpValuation').value='keep';$('hpSavedAsset').innerHTML='<option value="">Neues Wertpapier / manuelle Eingabe</option>';$('hpSavedAsset').value='';
  $('hpConfirmed').checked=false;$('hpAdditionalConfirmed').checked=false;$('hpCloseConfirmed').checked=false;$('rvHoldingSelect').innerHTML='<option value="new">Neue tatsächliche Position</option>';$('rvHoldingSelect').value='new';
  $('rvHoldingPanel').hidden=true;$('rvHoldingFields').disabled=false;$('rvHoldingSave').disabled=false;$('rvHoldingCancel').disabled=false;$('rvHoldingSelect').disabled=false;$('rvHoldingClose').disabled=true;$('hpClosePanel').hidden=true;$('hpAdditionalRow').hidden=true;
  $('hpSecurityLabel').textContent='Noch kein Wertpapier ausgewählt.';$('hpValuationDetails').open=false;lastIdentity=identity();status('');pickerReset();preview();
 }
 function close(){clear();}
 function setIdentity(a){
  asset=a;$('hpSymbol').value=a.symbol||'';$('hpCurrency').value=a.currency||'EUR';$('hpCompany').value=a.company||'';
  $('hpWkn').value=a.config?.wkn||'';$('hpIsin').value=a.config?.isin||'';$('hpConfirmed').checked=!!a.id;
  $('hpSavedAsset').value=a.id||'';$('hpValuation').value='keep';$('hpManualPrice').value=a.valuation_override?.price??'';$('hpManualDate').value=a.valuation_override?.price_date||'';lastIdentity=identity();
  $('hpSecurityLabel').textContent=[a.company||a.symbol,a.symbol,a.currency].join(' · ');$('hpWknDetails').open=false;boundIdentity=identity();
 }
 function options(){
  $('rvHoldingSelect').innerHTML=(intent==='close'?'':'<option value="new">'+(rows.length?'Zusätzliche getrennte Position':'Neue tatsächliche Position')+'</option>')+rows.map((p,i)=>'<option value="'+(p.position_origin==='legacy_plan'?'legacy:':'')+e(p.id)+'">'+e((p.position_origin==='legacy_plan'?'Älterer offener Bestand':'Position '+(i+1))+' · '+(p.quantity==null?'?':shareNumber(p.quantity))+' Stück · Einstand '+(p.average_entry_price==null?'offen':money(p.average_entry_price))+' · '+(p.entry_date||'Datum offen'))+'</option>').join('');
  $('rvHoldingSelect').value=rows.length&&intent!=='add'?(rows[0].position_origin==='legacy_plan'?'legacy:':'')+rows[0].id:'new';fill();
 }
 async function load(a,{preserveIdentity=false}={}){
  const captured=++token;fetching=true;ready=false;$('rvHoldingSave').disabled=true;$('rvHoldingSelect').disabled=true;status('Vorhandene Positionen laden. Kein Kursabruf.');
  try{
   const r=await invoke(a?.id?{action:'get_holdings',asset_id:a.id}:{action:'get_holdings',symbol:identity().split('|')[0],currency:$('hpCurrency').value});
   if(captured!==token||!active)return;
   if(r.asset){if(!preserveIdentity)setIdentity(r.asset);else asset=r.asset;}
   else asset=a?.id?a:null;
   rows=r.positions||[];ready=true;options();
   status(rows.length?'Vorhandenen Bestand bearbeiten oder zusätzliche Position auswählen.':'Noch kein tatsächlicher Bestand. Stückzahl und Einstand eintragen; ein Kurs ist optional.');
  }catch(error){if(captured===token)status(error.message,true);}
  finally{if(captured===token){fetching=false;$('rvHoldingSave').disabled=!ready;$('rvHoldingSelect').disabled=!ready;}}
 }
 async function open(value=undefined,{mode='edit'}={}){
  if(isRunning())return;const a=value===undefined?getAsset():value;clear();intent=a?mode:'add';active=true;ready=!a?.id;
  $('rvHoldingPanel').hidden=false;$('hpIdentityDetails').open=!a;$('hpWknDetails').open=!a;$('rvHoldingFields').disabled=false;$('hpEntryDate').max=depotDay(now());$('hpManualDate').max=depotDay(now());
  $('hpSavedAsset').innerHTML='<option value="">Neues Wertpapier / manuelle Eingabe</option>'+getAssets().map(a=>'<option value="'+e(a.id)+'">'+e((a.company||a.symbol)+' · '+a.symbol+' · '+a.currency)+'</option>').join('');
  onOpen();if(a){setIdentity(a);await load(a);if(mode==='add'&&rows.length){$('rvHoldingSelect').value='new';fill();$('hpAdditionalConfirmed').checked=true;}if(mode==='close'&&rows.length){$('hpClosePanel').open=true;$('hpClosePanel').scrollIntoView?.({behavior:'smooth',block:'center'});$('hpCloseConfirmed').focus?.();}}else{rows=[];options();status('Wert aus gespeicherten Daten oder per WKN/ISIN auswählen. Eine genaue Kennung kannst du auch direkt eingeben.');}
  $('rvHoldingPanel').scrollIntoView?.({behavior:'smooth',block:'start'});
 }
 function identityChanged(event){
  if(!active||identity()===lastIdentity)return;if(boundIdentity&&event?.isTrusted!==false){for(const id of ['hpCompany','hpWkn','hpIsin'])$(id).value='';}boundIdentity='';$('hpManualPrice').value='';$('hpManualDate').value='';$('hpValuation').value='keep';token++;fetching=false;ready=true;asset=null;rows=[];request=null;$('hpSavedAsset').value='';$('hpConfirmed').checked=false;lastIdentity=identity();$('hpSecurityLabel').textContent=[$('hpCompany').value,$('hpSymbol').value,$('hpCurrency').value].filter(Boolean).join(' · ');options();$('rvHoldingSave').disabled=false;$('rvHoldingSelect').disabled=false;status('Wertpapier geändert. Stückzahl und Einstand für den neuen Wert eingeben und die Identität bestätigen.');
 }
 async function save(closePosition=false){
  if(busy||fetching||isRunning()||!active||!ready)return;const p=chosen();
  if(closePosition&&(!p||!$('hpCloseConfirmed').checked)){status('Das vollständige Schließen dieser Position bestätigen.',true);return;}
  if(!request)request=crypto.randomUUID();
  let input;try{
   input=validateDepotInput({manual_start:true,request_id:request,asset_id:asset?.id,symbol:$('hpSymbol').value,currency:$('hpCurrency').value,company:$('hpCompany').value,wkn:$('hpWkn').value,isin:$('hpIsin').value,identity_confirmed:$('hpConfirmed').checked,
    ...(p?.position_origin==='legacy_plan'?{legacy_trade_id:p.trade_id}:p?{position_id:p.id}:{}),quantity:$('rvHoldingQuantity').value,average_entry_price:$('rvHoldingEntry').value,entry_date:$('hpEntryDate').value,direction:$('rvHoldingDirection').value,instrument_type:$('rvHoldingType').value,
    valuation_mode:$('hpValuation').value,manual_price:$('hpManualPrice').value,manual_price_date:$('hpManualDate').value,additional_position_confirmed:$('hpAdditionalConfirmed').checked,close:closePosition},now());
   if(!p&&rows.length&&!input.additional_position_confirmed)throw Error('Eine zusätzliche getrennte Position ausdrücklich bestätigen oder die bestehende Position auswählen.');
  }catch(error){status(error.message,true);return;}
  const captured=token,op=++operation;busy=true;onBusy(true);$('rvHoldingFields').disabled=true;$('rvHoldingSave').disabled=true;$('rvHoldingSelect').disabled=true;$('rvHoldingCancel').disabled=true;$('rvHoldingClose').disabled=true;status(closePosition?'Position schließen und Depot aktualisieren.':'Depotposition speichern. Kein Kurs- oder KI-Aufruf.');
  try{
   const cap=await invoke({action:'capabilities'});if(captured!==token)return;
   if(!cap.features?.includes('depot_editor_v392'))throw Error('Bestandsverwaltung auf dem Server fehlt. Das V40-Update einschließlich der Function bereitstellen.');
   if(cap.depot_ready!==true)throw Error('Die Datenbankerweiterung fehlt. Das V40-Update gemäß Installationsanleitung ausführen.');
   if(!asset?.id){
    const own=await invoke({action:'get_holdings',symbol:input.symbol,currency:input.currency});if(captured!==token||!active)return;
    if(own.asset&&own.positions?.length){intent='edit';setIdentity(own.asset);rows=own.positions;ready=true;options();status('Für diesen Wert ist bereits Bestand gespeichert. Vorhandene Position bearbeiten oder eine zusätzliche Position ausdrücklich wählen.');return;}
    if(own.asset){asset=own.asset;input.asset_id=asset.id;}
   }
   const r=await invoke({action:'save_position',...input,identity_confirmed:true});if(captured!==token||!active)return;
   if(r.saved!==true)throw Error('Speichern nicht bestätigt. Bestand neu laden, bevor du erneut anlegst.');
   await onSaved(r);if(captured===token){onBusy(false);close();}
  }catch(error){if(captured===token)status(error.message,true);}
  finally{if(op===operation){busy=false;onBusy(false);$('rvHoldingFields').disabled=false;$('rvHoldingSave').disabled=!ready;$('rvHoldingCancel').disabled=false;$('rvHoldingSelect').disabled=!ready;$('rvHoldingClose').disabled=!chosen()||!$('hpCloseConfirmed').checked;}}
 }
 $('rvHoldingSelect').addEventListener('change',fill);
 $('rvHoldingCancel').addEventListener('click',()=>{if(!busy){clear();onCancel();}});
 $('hpBookOut').addEventListener('click',()=>{if(!busy&&!fetching&&chosen()){intent='close';fill();$('hpCloseConfirmed').focus?.();}});
 $('rvHoldingClose').addEventListener('click',()=>save(true));$('hpCloseConfirmed').addEventListener('change',()=>{$('rvHoldingClose').disabled=!chosen()||!$('hpCloseConfirmed').checked;});
 $('rvHoldingForm').addEventListener('submit',event=>{event.preventDefault();return save();});
 $('rvHoldingForm').addEventListener('invalid',()=>{for(const id of ['hpIdentityDetails','hpTypeDetails','hpValuationDetails'])$(id).open=true;status('Die markierte Eingabe prüfen. WKN-Suche abschließen oder eine genaue Notierung eingeben.',true);},true);
 $('hpReload').addEventListener('click',()=>{if(!busy&&!fetching)load(asset);});
 $('hpSavedAsset').addEventListener('change',async()=>{const a=getAssets().find(a=>a.id===$('hpSavedAsset').value);if(a){setIdentity(a);await load(a);}else await open(null);});
 for(const id of ['hpSymbol','hpCurrency']){ $(id).addEventListener('input',identityChanged);$(id).addEventListener('change',identityChanged); }
 for(const id of ['rvHoldingQuantity','rvHoldingEntry','hpCurrency','hpValuation','hpManualPrice'])$(id).addEventListener('input',preview);
 $('hpValuation').addEventListener('change',preview);
 window?.addEventListener('investition:security-picked',async event=>{
  if(event.detail?.scope!=='holding'||!active||busy)return;const c=event.detail.security,a=getAssets().find(a=>a.symbol===c.market_symbol&&a.currency===c.currency);
  if(a){setIdentity(a);await load(a);}else{asset=null;rows=[];ready=true;lastIdentity=identity();$('hpConfirmed').checked=true;options();$('rvHoldingType').value=c.instrument_type==='ETF'?'ETF':'Aktie';boundIdentity=identity();$('hpWknDetails').open=false;$('hpSecurityLabel').textContent=[c.name,c.market_symbol,c.currency].join(' · ');status('Wertpapier übernommen. Tatsächliche Stückzahl und Einstand eintragen. Noch nicht gespeichert.');}
 });
 return {open,close,save,load,preview,getState:()=>({asset,rows,active,ready,busy})};
}
