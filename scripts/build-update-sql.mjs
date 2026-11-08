// Derive the V36 upgrade from the unchanged V32/V33/V35 and additive independent-data migrations.
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const version=JSON.parse(read('release.json')).version;
const sections=['setup-v32-deep-analysis.sql','setup-v33-paperdepot.sql','setup-v35-wkn.sql','setup-v36-independent.sql'].map(name=>{
  const sql=read(name);
  if(/cron\.(?:schedule|unschedule)|truncate|drop table/i.test(sql))throw Error('Unexpected destructive or scheduling operation in '+name);
  return '-- '+name+'\n'+sql.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'').trim();
});
const result='-- V'+version+' overall upgrade from a working V31.2 or V32 installation.\n-- Adds missing V32/V33/V35/V36 objects; preserves data and existing schedules.\n-- V34 manual URLs use the existing JSONB analysis/source snapshots.\nbegin;\n\n'+sections.join('\n\n')+'\n\ncommit;\n';
if(process.argv.includes('--check')){if(read('setup-v36-gesamtupdate.sql')!==result)throw Error('Combined migration is outdated.');}
else writeFileSync(new URL('setup-v36-gesamtupdate.sql',root),result);
console.log('V36 combined migration '+(process.argv.includes('--check')?'checked':'generated'));
