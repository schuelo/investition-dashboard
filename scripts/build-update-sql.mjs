// Generate repeatable V40 updates while retaining all historical migration files.
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8'),version=JSON.parse(read('release.json')).version;
const base=['setup-v38-investment-review.sql','setup-v39-direct.sql','setup-v39-1-depotfix.sql','setup-v39-2-depot.sql','setup-v40-production.sql'];
for(const [name,inputs]of [['setup-v40-depotupdate.sql',base],['setup-v40-gesamtupdate.sql',['setup-v32-deep-analysis.sql','setup-v33-paperdepot.sql','setup-v35-wkn.sql','setup-v36-independent.sql',...base]]]){
 const sections=inputs.map(file=>{const sql=read(file);if(/cron\.(?:schedule|unschedule)|truncate|drop table/i.test(sql))throw Error('Unexpected destructive or scheduling operation in '+file);return '-- '+file+'\n'+sql.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'').trim();});
 const result='-- V'+version+' additive update of an existing installation. Preserves data and schedules.\n-- '+name+'; not a bootstrap of an empty database.\nbegin;\n\n'+sections.join('\n\n')+'\n\ncommit;\n';
 if(process.argv.includes('--check')){if(read(name)!==result)throw Error('Combined migration is outdated: '+name);}else writeFileSync(new URL(name,root),result);
}
console.log('V40 migrations '+(process.argv.includes('--check')?'checked':'generated'));
