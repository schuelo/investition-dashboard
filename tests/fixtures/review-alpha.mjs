import {makeBars,now} from './independent-market.mjs';
export const alphaInput={symbol:'SND.XETRA',currency:'EUR',market_source:'alphavantage',quote_symbol:'SND.DEX',quote_confirmed:true};
export const alphaSearch=(symbol='SND.DEX',currency='EUR',region='Germany')=>({bestMatches:[{'1. symbol':symbol,'2. name':'Schneider Electric SE','3. type':'Equity','4. region':region,'8. currency':currency}]});
export const alphaDaily=(symbol='SND.DEX')=>({'Meta Data':{'2. Symbol':symbol,'5. Time Zone':'Europe/Berlin'},'Time Series (Daily)':Object.fromEntries(makeBars(100,now).map(b=>[b.date,{'1. open':String(b.open),'2. high':String(b.high),'3. low':String(b.low),'4. close':String(b.close),'5. volume':String(b.volume)}]))});
