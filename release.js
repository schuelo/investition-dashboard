// Generated from release.json by scripts/set-version.mjs.
(function(scope){
  const release=Object.freeze({"version":"35.0.0","name":"WKN-Eingabemaske und geprüfte EODHD-Zuordnung","date":"2026-11-08"});
  scope.InvestitionRelease=release;
  if(typeof document!=="undefined"){
    const bind=()=>{document.documentElement.dataset.appVersion=release.version;document.querySelectorAll("[data-release-version]").forEach(el=>{el.textContent=release.version;});document.querySelectorAll("[data-release-label]").forEach(el=>el.setAttribute("data-release-label","V"+release.version+" · INVESTITION DASHBOARD"));};
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
  }
})(globalThis);
