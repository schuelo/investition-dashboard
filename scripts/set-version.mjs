// Change release.json, then run `node scripts/set-version.mjs` before packaging.
// --check verifies the exact generated result without writing files.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const release=JSON.parse(read('release.json'));
if(!/^\d+\.\d+\.\d+$/.test(release.version)||!/^\d{4}-\d{2}-\d{2}$/.test(release.date))throw Error('Ungültige Release-Metadaten.');
const version=release.version,check=process.argv.includes('--check'),label='V'+version+' · INVESTITION DASHBOARD';
const put=(p,text)=>{let old='';try{old=read(p);}catch{}if(check){if(old!==text)throw Error('Release-Angabe veraltet: '+p);}else if(old!==text)writeFileSync(new URL(p,root),text);};
put('release.js','// Generated from release.json by scripts/set-version.mjs.\n(function(scope){\n  const release=Object.freeze('+JSON.stringify(release)+');\n  scope.InvestitionRelease=release;\n  if(typeof document!=="undefined"){\n    const bind=()=>{document.documentElement.dataset.appVersion=release.version;document.querySelectorAll("[data-release-version]").forEach(el=>{el.textContent=release.version;});document.querySelectorAll("[data-release-label]").forEach(el=>el.setAttribute("data-release-label","V"+release.version+" · INVESTITION DASHBOARD"));};\n    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();\n  }\n})(globalThis);\n');
let panel=read('deep-analysis-panel.html').replace(/V[\d.]+ · DEEP-ANALYSE/g,'V'+version+' · DEEP-ANALYSE').replace(/V[\d.]+ wird geladen/g,'V'+version+' wird geladen');put('deep-analysis-panel.html',panel);
let html=read('index.html').replace(/(data-release-version(?:="")?>)[^<]*/g,'$1'+version).replace(/data-release-label="[^"]*"/g,'data-release-label="'+label+'"').replace(/(name="application-version" content=")[^"]*/,'$1'+version)
  .replace(/(release\.js|deep-analysis\.(?:js|css)|security-picker\.(?:js|css)|signal-simulation\.js|market-data\.js|compact-ui\.(?:js|css)|investment-ui\.(?:js|css))\?v=[\d.]+/g,'$1?v='+version).replace(/V[\d.]+ · Deep-Analyse öffnen/g,'V'+version+' · Deep-Analyse öffnen');
const reviewPanel=read('investment-panel.html').trim(),reviewStart=html.indexOf('<section id="investmentReviewModule"'),reviewEnd=html.indexOf('<div class="compact-tabs"',reviewStart);
if(reviewStart>=0){if(reviewEnd<0)throw Error('V38-Panelende fehlt.');html=html.slice(0,reviewStart)+reviewPanel.slice(reviewPanel.indexOf('<section'))+'\n    '+html.slice(reviewEnd);}
else html=html.replace('<!-- investment-review-panel -->',reviewPanel.slice(reviewPanel.indexOf('<section')));
put('investment-ui.js',read('investment-ui.js').replace(/investment-view\.mjs\?v=[\d.]+/g,'investment-view.mjs?v='+version));
const start=html.indexOf('<section class="da-module" id="deepAnalysisModule">'),end=html.indexOf('<section id="paperPortfolioModule"',start);
if(start<0||end<0)throw Error('Analyse-/Papierdepot-Panel fehlt.');
html=html.slice(0,start)+panel.slice(panel.indexOf('<section class="da-module"')).trim()+'\n\n'+html.slice(end);put('index.html',html);
const paper=read('paper-portfolio-panel.html').trim(),ppStart=html.indexOf('<section id="paperPortfolioModule"'),ppEnd=html.indexOf('  </main>',ppStart);
if(ppStart<0||ppEnd<0)throw Error('Papierdepot-Einbettung fehlt.');
html=html.slice(0,ppStart)+paper+'\n'+html.slice(ppEnd);put('index.html',html);
let js=read('deep-analysis.js').replace(/(deep-engine\.mjs|deep-sources\.mjs)\?v=[\d.]+/g,'$1?v='+version).replace(/V[\d.]+ bereit/g,'V'+version+' bereit');put('deep-analysis.js',js);
put('signal-simulation.js',read('signal-simulation.js').replace(/signal-service\.mjs\?v=[\d.]+/g,'signal-service.mjs?v='+version));
// V37 changes only the presentation. Preserve the V36 calculation engine and its snapshot version.
put('compact-ui.js',read('compact-ui.js').replace(/compact-analysis\.mjs\?v=[\d.]+/g,'compact-analysis.mjs?v='+version));
put('service-worker.js',read('service-worker.js').replace(/release\.js\?v=[\d.]+/g,'release.js?v='+version).replace(/(deep-analysis\.(?:js|css)|security-picker\.(?:js|css)|signal-simulation\.js|market-data\.js|compact-ui\.(?:js|css)|investment-ui\.(?:js|css)|(?:deep-engine|deep-sources|signal-service|compact-analysis|investment-view)\.mjs)\?v=[\d.]+/g,'$1?v='+version));
put('reset.html',read('reset.html').replace(/(<title>Dashboard V)[\d.]+/,'$1'+version).replace(/(data-release-version>)[^<]*/g,'$1'+version).replace(/\?v=[\d.]+/g,'?v='+version));
console.log((check?'Release geprüft: ':'Release synchronisiert: ')+version+' · '+fileURLToPath(root));
