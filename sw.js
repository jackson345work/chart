// Minimal service worker: caches the app shell + local chart library so the app opens instantly / installs as a PWA.
// Market data (Binance/Bybit/OKX/Gate/Bitget REST + websockets) is never cached: always live from the network.
const CACHE = 'chart-shell-v19';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './vendor/lightweight-charts.standalone.production.js'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // add each file on its own so one miss cannot abort the whole upgrade
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function isPage(url) {
  const p = url.pathname;
  return p.endsWith('/') || p.endsWith('.html') || p.endsWith('/chart');
}

// Live market data must never be cached: Bitget (and every other exchange) always goes to the network.
const LIVE_HOST = /(?:^|\.)(?:api\.bitget\.com|ws\.bitget\.com|api\.binance\.com|fapi\.binance\.com|stream\.binance\.com|data-stream\.binance\.vision|data-api\.binance\.vision|api1\.binance\.com|fstream\.binance\.com|api\.bybit\.com|api\.bytick\.com|stream\.bybit\.com|stream\.bytick\.com|www\.okx\.com|ws\.okx\.com|api\.gateio\.ws|fxds-data-ws\.dukascopy\.com)$/;

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || LIVE_HOST.test(url.hostname) || url.origin !== location.origin) return; // API + CDN + websockets go straight to the network
  if (isPage(url)) {
    // network-first for the page (so updates arrive), with a short timeout then cache
    e.respondWith((async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        const r = await fetch(e.request, { signal: ctrl.signal });
        clearTimeout(t);
        if (r && r.ok) { const c = await caches.open(CACHE); c.put(e.request, r.clone()); return r; }
      } catch {}
      return (await caches.match(e.request)) || (await caches.match('./index.html')) || Response.error();
    })());
    return;
  }
  // vendor JS, icons, manifest: cache-first so a slow or blocked network cannot hang the app
  e.respondWith((async () => {
    const hit = await caches.match(e.request);
    if (hit) return hit;
    try {
      const r = await fetch(e.request);
      if (r && r.ok) { const c = await caches.open(CACHE); c.put(e.request, r.clone()); }
      return r;
    } catch {
      return Response.error();
    }
  })());
});
