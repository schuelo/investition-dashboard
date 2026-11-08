export const now=new Date('2026-11-08T09:00:00Z');
export function makeBars(count=300,asOf=now) {
  const rows=[];let date=new Date(asOf);date.setUTCHours(0,0,0,0);
  while(rows.length<count){date.setUTCDate(date.getUTCDate()-1);if([0,6].includes(date.getUTCDay()))continue;rows.unshift({date:date.toISOString().slice(0,10)});}
  return rows.map((r,i)=>{const close=100*Math.exp(.0005*i+.008*Math.sin(i));return{...r,open:close*.998,high:close*1.015,low:close*.985,close,volume:1000000+i*100};});
}
export const identity={figi:'BBG000A00001',name:'SCHNEIDER ELECTRIC SE',ticker:'SND',exchCode:'GY',marketSector:'Equity',securityType:'Common Stock',securityType2:'Common Stock'};
export const independentInput={symbol:'SND.XETRA',currency:'EUR',market_source:'independent',quote_symbol:'SND.DE',quote_confirmed:true,manual_start:true,use_ai:false,research:false,days:20};
export function chartPayload({symbol='SND.DE',currency='EUR',exchange='GER',timezone='Europe/Berlin',bars=makeBars()}={}) {
  return {chart:{error:null,result:[{meta:{symbol,currency,exchangeName:exchange,exchangeTimezoneName:timezone,instrumentType:'EQUITY',longName:'Schneider Electric SE'},timestamp:bars.map(b=>Date.parse(b.date+'T14:30Z')/1000),indicators:{quote:[Object.fromEntries(['open','high','low','close','volume'].map(k=>[k,bars.map(b=>b[k])]))],adjclose:[{adjclose:bars.map(b=>b.close*.999)}]}}]}};
}
