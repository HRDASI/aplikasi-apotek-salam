// Service worker: tampilan aplikasi tetap terbuka walau sinyal putus-putus.
// Data (Supabase) tidak di-cache, selalu diambil langsung dari server.
const C = 'apotek-salam-1.3.1';
const FILES = ['./', 'index.html', 'css/app.css?v=1.3.1', 'js/app.js?v=1.3.1', 'img/logo-128.png', 'img/lamlam.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); }
    return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
