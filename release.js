// Generated from release.json by scripts/set-version.mjs.
(function(scope){
  const release=Object.freeze({"version":"39.3.0","name":"Sichtbare Depot- und Kursverläufe mit Minicharts und Beobachtungsvergleich","date":"2026-11-16"});
  scope.InvestitionRelease=release;
  if(typeof document!=="undefined"){
    const bind=()=>{document.documentElement.dataset.appVersion=release.version;document.querySelectorAll("[data-release-version]").forEach(el=>{el.textContent=release.version;});document.querySelectorAll("[data-release-label]").forEach(el=>el.setAttribute("data-release-label","V"+release.version+" · INVESTITION DASHBOARD"));};
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
  }
})(globalThis);
