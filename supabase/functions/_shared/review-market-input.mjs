export {MarketDataError} from './independent-market.mjs';
export function alphaSymbolFor(symbol){
  if(/^[A-Z0-9-]+\.XETRA$/.test(symbol))return symbol.slice(0,-6)+'.DEX';
  if(/^[A-Z0-9.-]+\.US$/.test(symbol))return symbol.slice(0,-3);return null;
}
export function validateMarketChoice(input){
  if(input.market_source!=='alphavantage'||input.quote_confirmed!==true||!/^[A-Z0-9][A-Z0-9.-]{0,39}$/.test(input.quote_symbol||''))throw Error('Alpha-Vantage-Kennung und Währung ausdrücklich bestätigen.');
  return {market_source:'alphavantage',quote_symbol:input.quote_symbol,security_key:'',quote_figi:''};
}
