importScripts('./release.js?v=35.0.0');
const CACHE_NAME = 'investition-dashboard-v'+self.InvestitionRelease.version;
const CORE = [
  './',
  './index.html',
  './release.js?v=35.0.0',
  './security-picker.js?v=35.0.0',
  './security-picker.css?v=35.0.0',
  './supabase/functions/_shared/security-resolver.mjs',
  './supabase/functions/_shared/security-form.mjs',
  './deep-analysis.js?v=35.0.0',
  './deep-analysis.css?v=35.0.0',
  './paper-portfolio.js?v=33.0',
  './paper-portfolio.css?v=33.0',
  './supabase/functions/_shared/deep-engine.mjs?v=35.0.0',
  './supabase/functions/_shared/deep-sources.mjs?v=35.0.0',
  './supabase/functions/_shared/manual-sources.mjs',
  './supabase/functions/_shared/paper-engine.mjs?v=33.0',
  './app.js?v=31.2',
  './supabase.js?v=29.4',
  './news.js?v=31.2',
  './decision.js?v=29.4',
  './analytics.js?v=29.4',
  './event-analysis.js?v=30.1',
  './signal-simulation.js?v=31.2',
  './signal-simulation.css?v=31.2',
  './supabase/functions/_shared/signal-engine.mjs?v=31.2',
  './supabase/functions/_shared/signal-engine.mjs',
  './supabase/functions/_shared/signal-service.mjs?v=31.2'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE))
      .catch(() => undefined)
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => key.startsWith('investition-dashboard-')&&key!==CACHE_NAME ? caches.delete(key) : undefined)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // A loaded new page must never receive an older analysis/validation script from cache.
  if(/\.(?:m?js|css|json)$/.test(url.pathname)){
    event.respondWith(fetch(request,{cache:'no-cache'}).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));}
      return response;
    }).catch(()=>caches.match(request)));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, {cache:'no-store'})
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const fresh = fetch(request, {cache:'no-cache'}).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
      return cached || fresh;
    })
  );
});
