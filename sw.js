// Minimal service worker: caches the app shell + chart library so the app opens instantly / installs as a PWA.
// Market data (Binance/Bybit/OKX/Gate REST + websockets) is never cached: always live from the network.
const CACHE = 'chart-shell-v7';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  'https://unpkg.com/lightweight-charts@5.1.0/dist/lightweight-charts.standalone.production.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isShell = url.origin === location.origin || url.hostname === 'unpkg.com';
  if (e.request.method !== 'GET' || !isShell) return; // API calls go straight to the network
  // network-first for the page (so updates arrive), cache fallback when offline
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request)));
});
