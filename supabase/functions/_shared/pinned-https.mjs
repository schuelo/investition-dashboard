import {publicPageUrl,isPublicIPv4} from './manual-sources.mjs';

const MAX_BYTES=1000000,MAX_HEADERS=32768;
const enc=new TextEncoder(),ascii=new TextDecoder('latin1');
function concat(a,b){const out=new Uint8Array(a.length+b.length);out.set(a);out.set(b,a.length);return out;}
function boundary(bytes){for(let i=0;i<bytes.length-3;i++)if(bytes[i]===13&&bytes[i+1]===10&&bytes[i+2]===13&&bytes[i+3]===10)return i;return -1;}
export function parsePublicResponse(wire) {
  const end=boundary(wire);if(end<0||end>MAX_HEADERS)throw Error('Ungültige HTTP-Antwort.');
  const head=ascii.decode(wire.slice(0,end)).split('\r\n'),match=/^HTTP\/1\.[01] (\d{3})(?: |$)/.exec(head.shift());
  if(!match)throw Error('Ungültiger HTTP-Status.');
  const headers=new Headers();
  for(const line of head){const i=line.indexOf(':');if(i<=0||/^[\s]/.test(line))throw Error('Ungültiger HTTP-Header.');headers.append(line.slice(0,i),line.slice(i+1).trim());}
  let body=wire.slice(end+4);const transfer=headers.get('transfer-encoding'),length=headers.get('content-length');
  if(transfer && length)throw Error('Mehrdeutige HTTP-Länge.');
  if(transfer) {
    if(transfer.toLowerCase()!=='chunked')throw Error('Unbekannte HTTP-Kodierung.');
    let pos=0,total=0;const pieces=[];let finished=false;
    while(pos<body.length){let endLine=pos;while(endLine<body.length-1&&!(body[endLine]===13&&body[endLine+1]===10))endLine++;
      const line=ascii.decode(body.slice(pos,endLine));if(!/^[\da-f]+(?:;[^\r\n]*)?$/i.test(line))throw Error('Ungültige Chunk-Länge.');
      const size=parseInt(line.split(';')[0],16);pos=endLine+2;
      if(!Number.isSafeInteger(size)||size<0||total+size>MAX_BYTES)throw Error('Antwort zu groß.');
      if(size===0){if(pos+2>body.length)throw Error('Unvollständige Chunk-Antwort.');finished=true;break;}
      if(pos+size+2>body.length||body[pos+size]!==13||body[pos+size+1]!==10)throw Error('Unvollständige HTTP-Antwort.');
      pieces.push(body.slice(pos,pos+size));total+=size;pos+=size+2;
    }
    if(!finished)throw Error('Unvollständige HTTP-Antwort.');
    body=new Uint8Array(total);let offset=0;for(const piece of pieces){body.set(piece,offset);offset+=piece.length;}
  } else if(length!=null && (!/^\d+$/.test(length)||Number(length)!==body.length))throw Error('Unvollständige HTTP-Antwort.');
  if(body.length>MAX_BYTES)throw Error('Antwort zu groß.');
  return {status:Number(match[1]),headers,body};
}
async function decompress(body,encoding) {
  if(!encoding||encoding==='identity')return body;
  if(!['gzip','deflate'].includes(encoding))throw Error('Komprimierung nicht unterstützt.');
  const reader=new Blob([body]).stream().pipeThrough(new DecompressionStream(encoding)).getReader();
  let out=new Uint8Array();
  try{while(true){const {done,value}=await reader.read();if(done)break;if(out.length+value.length>MAX_BYTES)throw Error('Text zu groß.');out=concat(out,value);}return out;}finally{await reader.cancel();}
}
// Connect to the validated IP itself, then verify TLS for the original hostname.
// There is no second hostname lookup at connect time and no general-fetch fallback.
export async function pinnedHttpsPage(value,{runtime=globalThis.Deno,timeout=7000}={}) {
  const initial=publicPageUrl(value);if(!initial)throw Error('Öffentliche HTTPS-URL erforderlich.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout),signal=controller.signal;
  let conn=null;
  const close=()=>{try{conn?.close();}catch{}};
  signal.addEventListener('abort',close);
  const bounded=promise=>new Promise((resolve,reject)=>{
    const abort=()=>reject(Error('Zeitlimit beim Quellenabruf.'));if(signal.aborted){promise.catch(()=>{});abort();return;}
    signal.addEventListener('abort',abort,{once:true});
    promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
  try {
    let current=initial;
    for(let hop=0;hop<4;hop++) {
      if(!publicPageUrl(current))throw Error('Weiterleitung nicht freigegeben.');
      const url=new URL(current),addresses=await bounded(runtime.resolveDns(url.hostname,'A'));
      if(!addresses.length || addresses.some(ip=>!isPublicIPv4(ip)))throw Error('Nicht öffentliche Zieladresse.');
      conn=await bounded(runtime.connect({hostname:addresses[0],port:443,transport:'tcp'}).then(c=>{if(signal.aborted)c.close();return c;}));
      conn=await bounded(runtime.startTls(conn,{hostname:url.hostname,alpnProtocols:['http/1.1']}).then(c=>{if(signal.aborted)c.close();return c;}));
      const request=enc.encode('GET '+url.pathname+url.search+' HTTP/1.1\r\nHost: '+url.hostname+'\r\nUser-Agent: InvestitionDashboard/34.0 (public-source-reader)\r\nAccept: text/html, application/xhtml+xml, text/plain\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n');
      let sent=0;while(sent<request.length){const n=await bounded(conn.write(request.subarray(sent)));if(!n)throw Error('Verbindung unterbrochen.');sent+=n;}
      let wire=new Uint8Array(),end=-1;const buffer=new Uint8Array(16384);
      while(true){const n=await bounded(conn.read(buffer));if(n==null)break;wire=concat(wire,buffer.slice(0,n));
        if(wire.length>MAX_BYTES+MAX_HEADERS+16384)throw Error('Quelle zu groß.');
        if(end<0){end=boundary(wire);if(end<0&&wire.length>MAX_HEADERS)throw Error('Header zu groß.');}
      }
      close();conn=null;
      const response=parsePublicResponse(wire);
      if([301,302,303,307,308].includes(response.status)) {
        const location=response.headers.get('location');if(!location||hop===3)throw Error('Zu viele oder ungültige Weiterleitungen.');
        current=publicPageUrl(new URL(location,current).href);if(!current)throw Error('Weiterleitung gesperrt.');continue;
      }
      const contentType=response.headers.get('content-type')||'';
      if(!/^text\/(html|plain)(\s*;|$)|^application\/xhtml\+xml(\s*;|$)/i.test(contentType))return {status:response.status,url:current,contentType,text:''};
      const body=await bounded(decompress(response.body,(response.headers.get('content-encoding')||'').toLowerCase()));
      let decoder;try{decoder=new TextDecoder(contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]||'utf-8');}catch{decoder=new TextDecoder();}
      return {status:response.status,url:current,contentType,text:decoder.decode(body)};
    }
    throw Error('Quelle nicht abrufbar.');
  } finally {clearTimeout(timer);signal.removeEventListener('abort',close);close();}
}
