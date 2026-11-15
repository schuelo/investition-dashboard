import {fetchSmall} from './deep-sources.mjs';
// Fixed public RSS host only. Headlines remain metadata; no article-fetch or AI side effect.
export async function targetedFeed(asset,{read,write,fetchImpl,parseRss,now=new Date(),allowNetwork=true}={}){
  const query=(asset.company||asset.symbol).trim(),old=await read(),fresh=old?.query===query&&Date.parse(old.expires_at)>now.getTime();
  if(fresh)return {sources:old.sources||[],status:old.status,fetched_at:old.fetched_at,last_attempt_at:old.attempted_at,error:old.error||null,cached:true};
  if(!allowNetwork)return {sources:old?.query===query?old.sources||[]:[],status:'not_run',fetched_at:old?.query===query?old.fetched_at:null,error:'Gezielter Newsabruf für einen späteren Lauf vorgemerkt.',cached:!!old};
  const url=new URL('https://news.google.com/rss/search');url.search=new URLSearchParams({q:query+' when:7d',hl:'de',gl:'DE',ceid:'DE:de'}).toString();
  try{
    const raw=await fetchSmall(url.href,fetchImpl,6500),sources=parseRss(raw,'Gezielte RSS-Recherche').slice(0,12).map(s=>({...s,content_status:'metadata',excerpt:'',summary:'',description:'',discovery:'targeted_free_rss',match:'research'}));
    const record={query,sources,status:'success',fetched_at:now.toISOString(),attempted_at:now.toISOString(),expires_at:new Date(now.getTime()+6*3600000).toISOString(),error:null};await write(record);
    return {...record,cached:false};
  }catch{
    const record={query,sources:old?.query===query?old.sources||[]:[],status:'failed',fetched_at:old?.query===query?old.fetched_at:null,attempted_at:now.toISOString(),expires_at:new Date(now.getTime()+3600000).toISOString(),error:'Gezielte RSS-Recherche nicht erreichbar; vorhandene News behalten ihren Datenstand.'};await write(record);
    return {...record,cached:false};
  }
}
