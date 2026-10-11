import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { signalTriggerSymbols, signalDashboardLink, extendTelegramWithSignal } from '../supabase/functions/_shared/signal-trigger.mjs';

const original = readFileSync(new URL('./fixtures/send-news-alerts-v294-source.txt', import.meta.url), 'utf8');
const updated = readFileSync(new URL('../supabase/functions/send-news-alerts/index.ts', import.meta.url), 'utf8');
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const news = (n, changes={}) => ({ id:uuid(n),title:'Nvidia aktuelle Meldung',symbols:['NVDA.US'],published_at:new Date(Date.now()-3600000).toISOString(),is_published:true,impact:'hoch',relevance_score:90,urgency_score:80,source_url:'https://example.org/original',...changes });
function fixtures() {
  return {
    notification_settings:[{user_id:'alice',telegram_enabled:true,telegram_chat_id:'chat-a'},{user_id:'bob',telegram_enabled:true,telegram_chat_id:'chat-b'},{user_id:'disabled',telegram_enabled:false,telegram_chat_id:'chat-x'},{user_id:'missing-chat',telegram_enabled:true,telegram_chat_id:null}],
    depot_positions:[{user_id:'alice',name:'Nvidia Long',symbol:'KO123',trade_id:'a',is_open:true},{user_id:'bob',name:'Apple',symbol:'AAPL.US',trade_id:'b',is_open:true},{user_id:'bob',name:'Nvidia',symbol:'NVDA.US',trade_id:'closed',is_open:false}],
    trade_plans:[{user_id:'alice',id:'a',name:'Nvidia',symbol:'KO123',market_symbol:'NVDA.US'},{user_id:'bob',id:'b',name:'Apple',symbol:'AAPL.US',market_symbol:'AAPL.US'}],
    market_news:[news(1),news(2,{symbols:['AAPL.US'],title:'Apple quarterly report'}),news(3,{relevance_score:69,urgency_score:64}),news(4,{impact:'niedrig'}),news(5,{is_published:false}),news(6,{published_at:new Date(Date.now()-9*3600000).toISOString()}),news(7,{symbols:['AMD.US'],title:'Advanced Micro Devices report'}),news(8),news(9,{impact:'mittel',relevance_score:70,urgency_score:20}),news(10,{impact:'mittel',relevance_score:20,urgency_score:65}),news(11,{relevance_score:undefined,urgency_score:undefined}),news(12,{title:'Sehr lange Originalmeldung '+ 'x'.repeat(4500)})],
    news_notification_log:[{id:'existing',user_id:'alice',news_id:uuid(8),delivery_channel:'telegram'}],
    signal_news_triggers:[]
  };
}
// Execute BOTH real handlers. The same isolated query and Telegram fixtures are
// used for the old and new release, rather than duplicating notification rules.
function bot(source,{db=fixtures(),userId=null,authorized=true,triggerFailure=false,deliveredFailure=false}={}) {
  let serve; const sent=[],queries=[],writes=[],rpcs=[];
  const from=table=>{
    const filters=[]; let mutation=null,one=false,max=Infinity;
    const query={
      select:()=>query,
      eq:(key,value)=>{filters.push(row=>row[key]===value);queries.push({table,key,value});return query;},
      not:(key,operator,value)=>{assert.equal(operator,'is');filters.push(row=>row[key]!==value);return query;},
      gte:(key,value)=>{filters.push(row=>row[key]>=value);return query;},
      in:(key,values)=>{filters.push(row=>values.includes(row[key]));return query;},
      order:()=>query,limit:n=>{max=n;return query;},
      insert:row=>{mutation={kind:'insert',row};return query;},
      update:row=>{mutation={kind:'update',row};return query;},
      maybeSingle:()=>{one=true;return query;},
      then:resolve=>{
        const rows=(db[table]||[]).filter(row=>filters.every(fn=>fn(row))).slice(0,max);
        let error=null;
        if(mutation){
          writes.push({table,...mutation,selected:rows.map(row=>row.id)});
          if(table==='signal_news_triggers' && deliveredFailure) error={message:'new table write unavailable'};
          else if(mutation.kind==='insert') db[table].push({...mutation.row});
          else rows.forEach(row=>Object.assign(row,mutation.row));
        }
        resolve({data:one?rows[0]||null:rows,error});
      }
    };return query;
  };
  const createClient=()=>({auth:{getUser:async()=>({data:{user:authorized?{id:userId}:null},error:authorized?null:{message:'invalid'}})},from,rpc:async(name,args)=>{
    rpcs.push({name,args});assert.equal(name,'record_signal_news_trigger');
    if(triggerFailure) return{data:null,error:{message:'new SQL not installed'}};
    const id=uuid(100+args.p_news_id.slice(-3)*1);db.signal_news_triggers.push({id,user_id:args.p_user_id,news_id:args.p_news_id,symbols:args.p_symbols});return{data:id,error:null};
  }});
  const Deno={env:{get:key=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service',CRON_SECRET:'cron-fixture',TELEGRAM_BOT_TOKEN:'test-bot',SIGNAL_DASHBOARD_URL:'https://example.org/dashboard/'}[key])},serve:fn=>{serve=fn;}};
  const fetch=async(url,init)=>{assert.equal(url,'https://api.telegram.org/bottest-bot/sendMessage','The news bot may only send its original Telegram request; never call an AI provider');sent.push(JSON.parse(init.body));return{ok:true,text:async()=>'{"ok":true}'};};
  const code=stripTypeScriptTypes(source).replace(/^import .*;$/gm,'');
  new Function('createClient','corsHeaders','jsonHeaders','signalTriggerSymbols','extendTelegramWithSignal','Deno','fetch',code)(createClient,{}, {'Content-Type':'application/json'},signalTriggerSymbols,extendTelegramWithSignal,Deno,fetch);
  return{serve,sent,queries,writes,rpcs,db};
}
const request=(user=false)=>new Request('https://test',{method:'POST',headers:user?{Authorization:'Bearer user-fixture'}:{'x-cron-secret':'cron-fixture'}});
test('Original and extended real news bots send the same portfolio alerts to the same recipients',async()=>{
  const old=bot(original),next=bot(updated);
  const before=await(await old.serve(request())).json(),after=await(await next.serve(request())).json();
  assert.equal(before.ok,true);assert.equal(after.ok,true);assert.equal(before.alerts_sent,6);assert.equal(after.alerts_sent,before.alerts_sent);
  assert.deepEqual(after.results,before.results);
  assert.deepEqual(next.queries.filter(q=>q.table!=='signal_news_triggers'),old.queries);
  assert.deepEqual(next.writes.filter(w=>w.table!=='signal_news_triggers'),old.writes);
  assert.equal(next.sent.length,old.sent.length);
  next.sent.forEach((body,i)=>{
    assert.equal(body.chat_id,old.sent[i].chat_id);assert.equal(body.disable_web_page_preview,old.sent[i].disable_web_page_preview);
    assert.ok(body.text.startsWith(old.sent[i].text),'The complete previous text, including its 3900-character limit, is preserved');
    assert.match(body.text.slice(old.sent[i].text.length),/TRIGGER KI/);assert.ok(body.text.length<4096);
    const link=new URL(body.reply_markup.inline_keyboard[0][0].url);assert.equal(link.hash,'#signals');assert.ok(link.searchParams.get('signal_trigger'));
  });
  assert.equal(next.rpcs.length,before.alerts_sent);assert.deepEqual(next.rpcs[0].args.p_symbols,['NVDA.US']);
  assert.ok(next.db.signal_news_triggers.every(row=>row.delivered_at));
});
test('Original deduplication prevents repeat Telegram sends and repeat trigger writes',async()=>{
  const a=bot(updated);await a.serve(request());const first=a.sent.length;
  const res=await(await a.serve(request())).json();assert.equal(res.alerts_sent,0);assert.equal(a.sent.length,first);assert.equal(a.rpcs.length,first);
});
test('Signed-in news bot keeps the original user scope',async()=>{
  const old=bot(original,{userId:'bob'}),next=bot(updated,{userId:'bob'});
  const a=await(await old.serve(request(true))).json(),b=await(await next.serve(request(true))).json();
  assert.deepEqual(b.results,a.results);assert.equal(b.alerts_sent,1);assert.ok(next.sent.every(row=>row.chat_id==='chat-b'));
  assert.ok(next.rpcs.every(row=>row.args.p_user_id==='bob'));
});
test('Optional trigger table and delivery-state failures cannot suppress an original alert',async()=>{
  for(const failure of [{triggerFailure:true},{deliveredFailure:true}]){
    const old=bot(original),next=bot(updated,failure);
    const a=await(await old.serve(request())).json(),b=await(await next.serve(request())).json();
    assert.equal(b.ok,true);assert.deepEqual(b.results,a.results);assert.equal(next.sent.length,old.sent.length);assert.ok(b.signal_warnings.length);
    if(failure.triggerFailure){const url=new URL(next.sent[0].reply_markup.inline_keyboard[0][0].url);assert.equal(url.searchParams.get('signal_news'),uuid(1));assert.equal(url.searchParams.get('signal_trigger'),null);}
  }
});
test('Original authorization and method rejection remain intact',async()=>{
  for(const source of [original,updated]){
    const a=bot(source,{authorized:false});
    assert.equal((await a.serve(new Request('https://test',{method:'OPTIONS'}))).status,200);
    assert.equal((await a.serve(new Request('https://test'))).status,405);
    assert.equal((await a.serve(new Request('https://test',{method:'POST'}))).status,401);
    assert.equal(a.sent.length,0);assert.equal(a.rpcs.length,0);
  }
});
test('Telegram helper selects established underlying symbols without guessing product markets',()=>{
  assert.deepEqual(signalTriggerSymbols([{trade_id:'a',symbol:'KO123'},{trade_id:'a',symbol:'KO123'},{symbol:'AMBIGUOUS'},{symbol:'AAPL.US'}],[{id:'a',market_symbol:'NVDA.US'}]),['NVDA.US','AAPL.US']);
  const url=new URL(signalDashboardLink({dashboardUrl:'javascript:bad',triggerId:uuid(1),symbols:['NVDA.US','AAPL.US']}));
  assert.equal(url.protocol,'https:');assert.equal(url.searchParams.get('signal_symbol'),null);
  assert.equal(new URL(signalDashboardLink({dashboardUrl:'https://example.org/app?secret=discard#old',newsId:uuid(2),symbols:['NVDA.US']})).searchParams.get('secret'),null);
});
test('New trigger SQL only touches new module objects and restricts writes to their owner',()=>{
  const sql=readFileSync(new URL('../setup-v31-2-manual-triggers.sql',import.meta.url),'utf8');
  assert.match(sql,/enable row level security/);assert.match(sql,/using \(user_id = auth\.uid\(\)\)/);
  assert.match(sql,/grant update\(state\)/);assert.match(sql,/revoke all on function public\.record_signal_news_trigger\(uuid,uuid,text\[\],text\) from public,anon,authenticated/);
  assert.match(sql,/grant execute on function public\.record_signal_news_trigger\(uuid,uuid,text\[\],text\) to service_role/);
  assert.doesNotMatch(sql,/cron\.|alter table public\.(?!signal_)/i);
  assert.doesNotMatch(sql,/insert into public\.(?!signal_)/i);
});
