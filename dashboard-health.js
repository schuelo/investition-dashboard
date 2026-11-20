// A visible failure message is preferable to an empty panel when module files are missing or mixed.
(function(){
 function failed(message){const el=document.getElementById('ivSetupStatus');if(el){el.textContent=message;el.className='compact-status bad';el.setAttribute('role','alert');}}
 window.addEventListener('error',function(event){const file=event.target?.src||event.filename||'';if(/(?:investment-ui|direct-view|price-[a-z-]+|portfolio-chart|dashboard-diagnostics)\.(?:m?js)(?:\?|$)/.test(file))failed('Darstellungsmodul konnte nicht geladen werden. Alle Dateien und Unterordner der aktuellen Version veröffentlichen und die Website vollständig neu laden.');},true);
 const start=()=>setTimeout(function(){if(document.documentElement.dataset.investmentUi!=='ready')failed('Dashboard-Darstellung noch nicht gestartet. Website-Dateien unvollständig oder veraltet; alle Dateien inklusive Unterordnern veröffentlichen und neu laden.');},8000);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
