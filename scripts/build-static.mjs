import {readdirSync,mkdirSync,copyFileSync,rmSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,relative,resolve} from 'node:path';
export function buildStatic(root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'dist')){
 if(resolve(out)!==join(resolve(root),'dist'))throw Error('Statisches Ausgabeziel muss dist im Projekt sein.');
 const allowed=/\.(?:html|js|mjs|css|json|svg|png|webp|jpg|jpeg|ico|woff2?|webmanifest|txt)$/i,exclude=new Set(['.git','.github','.openai','node_modules','tests','scripts','dist','upload']);
 rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});let count=0;
 function copy(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){if(exclude.has(entry.name)||entry.name.startsWith('.'))continue;const path=join(dir,entry.name),rel=relative(root,path);if(entry.isDirectory()){if(rel==='supabase'||rel==='supabase/functions'||rel==='supabase/functions/_shared'||!rel.startsWith('supabase/'))copy(path);}else if(entry.isFile()&&allowed.test(entry.name)&&(!entry.name.endsWith('.json')||['release.json','manifest.json','startdaten.json'].includes(rel))&&!/^RELEASE-MANIFEST-|^package(?:-lock)?\.json$/.test(entry.name)&&(!rel.startsWith('supabase/')||rel.startsWith('supabase/functions/_shared/'))){mkdirSync(join(out,relative(root,dir)),{recursive:true});copyFileSync(path,join(out,rel));count++;}}}
 copy(root);if(!readFileSync(join(out,'index.html'),'utf8').includes('investmentReviewModule'))throw Error('Statisches Dashboard fehlt.');return {directory:out,files:count};
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(buildStatic()));
