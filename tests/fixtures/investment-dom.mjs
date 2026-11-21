import {readFileSync} from 'node:fs';
import {createInvestmentUI} from '../../investment-ui.js';
import {apiHarness,alice} from './investment-api.mjs';
import {now} from './independent-market.mjs';
export const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
export function uiHarness({api=apiHarness(),owner=alice,beforeInvoke=null,decorateWindow=null}={}){
  let activeOwner=owner,currentNow=now;const calls=[],listeners={},observed=[],copied=[];
  const window=new EventTarget(),document={hidden:false,documentElement:{dataset:{}},
    addEventListener(name,fn){(listeners[name]||=[]).push(fn);},
    async fire(name,target){const pending=[];for(const fn of listeners[name]||[])pending.push(fn({target,preventDefault(){},stopPropagation(){}}));await Promise.all(pending);}};
  const els={};
  class El{
    constructor(id='',dataset={}){this.id=id;this.dataset=dataset;this.attributes={};this.events={};this.hidden=false;this.disabled=false;this.open=false;this.checked=false;this.value='';this.textContent='';this.clientWidth=320;this.files=[];this.scrolled=0;this._html='';this.dynamic=[];}
    set innerHTML(value){for(const id of this.dynamic)delete els[id];this.dynamic=[];this._html=value;for(const m of value.matchAll(/id="([^"]+)"/g)){if(!els[m[1]]){els[m[1]]=new El(m[1]);this.dynamic.push(m[1]);}}}
    get innerHTML(){return this._html;}
    addEventListener(name,fn){(this.events[name]||=[]).push(fn);}
    async fire(name){for(const fn of this.events[name]||[])await fn({target:this,preventDefault(){}});await document.fire(name,this);}
    setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}removeAttribute(k){delete this.attributes[k];}
    closest(selector){return selector==='button'?this:null;}
    click(){this.onClick?.();for(const fn of this.events.click||[])fn({target:this,preventDefault(){}});document.fire('click',this);}
    scrollIntoView(){this.scrolled++;}reset(){resetFields();}
  }
  for(const m of html.matchAll(/<[a-z][^>]*\bid="([^"]+)"[^>]*>/gi)){const dataset={};for(const a of m[0].matchAll(/data-([a-z0-9-]+)="([^"]*)"/g))dataset[a[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=a[2];els[m[1]]=new El(m[1],dataset);}
  const defaults={rvAssetId:'',rvPositionId:'',rvLegacyTradeId:'',rvSymbol:'',rvCompany:'',rvCurrency:'EUR',rvSource:'stored',rvQuoteSymbol:'',rvDays:'20',rvLookback:'252',rvWkn:'',rvIsin:'',rvBudget:'0',rvTranches:'3',rvStop:'',rvTarget:'',rvContext:'',rvUrls:'',rvCsv:'',rvMessage:'',rvChatMode:'chat'};
  function resetFields(){for(const[id,v]of Object.entries(defaults))els[id].value=v;els.rvQuoteConfirmed.checked=false;els.rvResearch.checked=false;}
  resetFields();els.decisionPage.hidden=true;els.signalSimulationPage.hidden=false;
  document.getElementById=id=>els[id]||null;const navs=['portfolio','search','watch','more'].map(v=>new El('',{reviewNav:v}));document.querySelectorAll=s=>s==='[data-review-nav]'?navs:[];
  els.navDecisionBtn.onClick=()=>{els.decisionPage.hidden=false;els.signalSimulationPage.hidden=true;window.dispatchEvent(new Event('investition:decision-visible'));};
  els.navSignalSimulationBtn.onClick=()=>{els.decisionPage.hidden=true;els.signalSimulationPage.hidden=false;window.dispatchEvent(new Event('investition:signal-simulation-visible'));};
  window.ResizeObserver=class{constructor(fn){this.fn=fn;this.disconnected=false;observed.push(this);}observe(target){this.target=target;}disconnect(){this.disconnected=true;}};
  window.navigator={clipboard:{writeText:async text=>copied.push(text)}};window.InvestitionCompact={showTab:tab=>window.lastLegacyTab=tab};
  const sb={from:api.admin.from,functions:{invoke:async(name,{body})=>{calls.push({name,body});if(beforeInvoke)await beforeInvoke(body);const r=await api.post(body);return r.status<400?{data:r.body,error:null}:{data:null,error:{message:r.body.error,context:new Response(JSON.stringify(r.body))}};}}};
  window.InvestitionDashboard={getSession:()=>activeOwner?{user:{id:activeOwner}}:null,getSupabase:()=>sb};
  decorateWindow?.(window);
  const controller=createInvestmentUI({window,document,now:()=>currentNow});
  return {api,controller,window,document,els,calls,copied,observed,navs,button:data=>new El('',data),setOwner:v=>activeOwner=v,setNow:v=>currentNow=v,
    emit:(name,detail)=>window.dispatchEvent(new CustomEvent(name,{detail}))};
}
