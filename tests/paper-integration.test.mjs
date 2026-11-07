import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {configPaper,newPaper,updatePaper} from '../supabase/functions/_shared/paper-engine.mjs';
import {parseOhlcvCsv} from '../supabase/functions/_shared/signal-engine.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const edge=stripTypeScriptTypes(read('supabase/functions/paper-benchmark/index.ts')).replace(/^import .*;$/gm,'');
const cfg={symbols:'SND.XETRA',currency:'EUR',capital:10000,fee_bps:10,slippage_bps:5};
function data(){const out=[];let d=new Date();d.setUTCDate(d.getUTCDate()-1);while(out.length<100){if(![0,6].includes(d.getUTCDay()))out.unshift({date:d.toISOString().slice(0,10),open:100,high:101,low:99,close:100,volume:1000});d.setUTCDate(d.getUTCDate()-1);}return out;}
function harness({authenticated=true,row=null,commitError=false}={}) {
  let serve;const calls=[];const writes=[];
  const createClient=()=>({auth:{getUser:async()=>({data:{user:authenticated?{id:'owner'}:null},error:null})},from:table=>{
    const filters=[];const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);calls.push([table,k,v]);return q;},in:()=>q,gte:()=>q,order:()=>q,limit:()=>q,
      update:value=>{writes.push({table,value});return q;},maybeSingle:async()=>({data:table==='paper_portfolios'?row&&filters.every(([k,v])=>row[k]===v)?row:null:{bars:data()},error:null}),then:fn=>fn({data:table==='deep_analyses'?[]:[{id:'portfolio'}],error:null})};return q;},rpc:async(name,args)=>{writes.push({name,args});return {data:'portfolio',error:commitError?{message:'conflict'}:null};}});
  const Deno={env:{get:key=>({SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private'})[key]},serve:fn=>serve=fn};
  new Function('Deno','createClient','corsHeaders','jsonHeaders','configPaper','newPaper','updatePaper',edge)(Deno,createClient,{}, {'Content-Type':'application/json'},configPaper,newPaper,updatePaper);
  return {serve,calls,writes};
}
const req=body=>new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer valid'},body:JSON.stringify(body)});
test('V33 actual Edge authenticates before reading/writing any data',async()=>{
  const a=harness({authenticated:false});assert.equal((await a.serve(req({}))).status,401);assert.equal(a.calls.length,0);assert.equal(a.writes.length,0);
  const b=harness();assert.equal((await b.serve(new Request('https://example.test',{method:'POST'}))).status,401);
});
test('V33 actual Edge validates method, JSON and explicit manual intent',async()=>{
  const a=harness();assert.equal((await a.serve(new Request('https://example.test'))).status,405);assert.equal((await a.serve(new Request('https://example.test',{method:'OPTIONS'}))).status,200);
  for(const body of [null,[],{}, {action:'run',manual_start:true,id:'wrong'}, {action:'cron',manual_start:true}])assert.equal((await a.serve(req(body))).status,400);
});
test('V33 actual Edge ignores claimed owner and atomically creates only paper data',async()=>{
  const a=harness(),r=await a.serve(req({action:'create',manual_start:true,user_id:'attacker',config:cfg}));assert.equal(r.status,200);const commit=a.writes[0];assert.equal(commit.name,'commit_paper_portfolio');assert.equal(commit.args.p_user_id,'owner');assert.equal(commit.args.p_state.accounts.hold.cash,10000);assert.ok(a.calls.some(c=>c[0]==='deep_analyses'&&c[1]==='user_id'&&c[2]==='owner'));assert.equal(a.writes.length,1);
});
test('V33 actual Edge never accepts another user portfolio',async()=>{
  const a=harness({row:{id:'11111111-1111-4111-8111-111111111111',user_id:'foreign'}});const r=await a.serve(req({action:'run',manual_start:true,id:'11111111-1111-4111-8111-111111111111'}));assert.equal(r.status,404);assert.equal(a.writes.length,0);
});
test('V33 actual Edge reports CAS conflict instead of claiming success',async()=>{
  const a=harness({commitError:true}),r=await a.serve(req({action:'create',manual_start:true,config:cfg}));assert.equal(r.status,409);assert.equal((await r.json()).ok,false);
});
test('V33 actual Edge accepts private CSV without global cache writes',async()=>{
  const a=harness();const r=await a.serve(req({action:'create',manual_start:true,config:cfg,market:{'SND.XETRA':data()}}));assert.equal(r.status,200);assert.equal(a.calls.some(c=>c[0]==='signal_market_cache'),false);assert.equal(a.writes.length,1);
});
test('V33 SQL enforces owner RLS, composite FK and atomic version guards',()=>{
  const sql=read('setup-v33-paperdepot.sql');assert.equal((sql.match(/enable row level security/g)||[]).length,3);assert.equal((sql.match(/using\(user_id=auth.uid\(\)\)/g)||[]).length,3);assert.match(sql,/r.version<>p_version or r.paused or r.config<>p_config/);assert.match(sql,/for update/);assert.match(sql,/foreign key\(portfolio_id,user_id\)/);assert.match(sql,/revoke all on function.*from public,anon,authenticated/);assert.doesNotMatch(sql,/create policy[^;]+for (insert|update|delete|all)/i);
});
test('V33 no paid AI, broker, real portfolio or background trigger dependency',()=>{
  const code=edge+read('supabase/functions/_shared/paper-engine.mjs');assert.doesNotMatch(code,/fetch\(|callDeepGemini|GEMINI_API_KEY|from\(['"]trades|reserve_hybrid|cron\.schedule/);assert.doesNotMatch(read('paper-portfolio.js'),/setInterval|investition:signal-simulation-visible/);
});
test('V33 panel embedded exactly once without altering existing module markup',()=>{
  const html=read('index.html'),panel=read('paper-portfolio-panel.html');assert.ok(html.includes(panel));assert.equal((html.match(/id="paperPortfolioModule"/g)||[]).length,1);assert.match(html,/paper-portfolio.js\?v=33.0/);
  const ids=[...panel.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);for(const id of [...read('paper-portfolio.js').matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]))assert.ok(ids.includes(id),id);
});
function uiHarness(){const handlers={},elements={},windowHandlers={};let invokes=0;const ids=[...read('paper-portfolio-panel.html').matchAll(/id="([^"]+)"/g)].map(m=>m[1]);for(const id of ids)elements[id]={value:'',innerHTML:'',textContent:'',files:[],setAttribute(){},querySelectorAll:()=>[],addEventListener:(event,fn)=>handlers[id+':'+event]=fn};
  const window={InvestitionDashboard:{getSupabase:()=>({functions:{invoke:async()=>{invokes++;throw Error('offline');}}}),getSession:()=>({user:{id:'owner'}})},addEventListener:(event,fn)=>windowHandlers[event]=fn};
  const js=read('paper-portfolio.js').replace(/^import .*;$/gm,'');new Function('document','window','parseOhlcvCsv','ACCOUNT_NAMES','configPaper',js)({getElementById:id=>elements[id]},window,parseOhlcvCsv,{chart:'Chartregeln',hybrid:'KI',hold:'Hold'},configPaper);return{handlers,elements,windowHandlers,get invokes(){return invokes;}};}
test('V33 actual UI makes no requests on load or auth change and clears private results',()=>{const h=uiHarness();assert.equal(h.invokes,0);h.elements.ppSummary.innerHTML='private';h.windowHandlers['investition:auth-changed']();assert.equal(h.elements.ppSummary.innerHTML,'');assert.equal(h.invokes,0);});
test('V33 actual UI update without selection gives feedback without invocation',async()=>{const h=uiHarness();h.handlers['ppRun:click']();await new Promise(r=>setTimeout(r,0));assert.match(h.elements.ppStatus.textContent,/Experiment laden/);assert.equal(h.invokes,0);});
test('V33 actual UI catches failed create and rejects a double click',async()=>{const h=uiHarness();Object.assign(h.elements.ppSymbols,{value:'SND.XETRA'});h.elements.ppCurrency.value='EUR';h.elements.ppCapital.value='10000';h.elements.ppFees.value='10';h.elements.ppSlip.value='5';const e={preventDefault(){}};h.handlers['ppForm:submit'](e);h.handlers['ppForm:submit'](e);await new Promise(r=>setTimeout(r,0));assert.equal(h.invokes,1);assert.match(h.elements.ppStatus.textContent,/offline/);});
