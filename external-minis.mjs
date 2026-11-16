import {externalChartSymbol,mountExternalChart} from './external-chart.mjs';
export function createExternalMinis({document,getOwner,onError=()=>{}}){
 let generation=0,destroyers=[],enabled=true;
 function clear(){generation++;for(const stop of destroyers)stop();destroyers=[];}
 function reset(){clear();enabled=true;}
 function update(items,ready){
  clear();if(!enabled||!ready||!getOwner()||typeof document.createElement!=='function')return;
  const captured=generation,owner=getOwner();queueMicrotask(()=>{
   if(captured!==generation||owner!==getOwner())return;let count=0;
   for(const {asset,hostId,series}of items){if(count>=8)break;if(series?.kind==='price_history'&&series.points?.length>=2)continue;const symbol=externalChartSymbol(asset);if(!symbol)continue;const host=document.getElementById(hostId);if(!host)continue;
    try{destroyers.push(mountExternalChart({document,container:host,symbol,confirmed:true,mini:true,onStatus:(message,bad)=>{if(bad&&captured===generation&&owner===getOwner())onError(message);}}));count++;}catch(error){onError(error.message);}
   }
  });
 }
 return {update,clear,reset,toggle(){enabled=!enabled;if(!enabled)clear();return enabled;},isEnabled:()=>enabled};
}
