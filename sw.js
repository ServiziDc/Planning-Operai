// Service Worker - Planning Operai Gama Service
// Strategia network-first: prende sempre la versione online,
// usa la cache solo se sei offline (evita problemi di file vecchi).
var CACHE = 'planning-operai-v9';
var BASE = '/Planning-Operai/';
var CORE = [
  BASE,
  BASE + 'index.html',
  BASE + 'css/style.css?v=11',
  BASE + 'js/firebase-config.js?v=11',
  BASE + 'js/seed-giugno-2026.js?v=11',
  BASE + 'js/seed-presidi-lug-set.js?v=11',
  BASE + 'js/app.js?v=11',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  // Non intercettare Firebase/Google: devono andare sempre in rete
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(function (resp) {
      var copia = resp.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copia); });
      return resp;
    }).catch(function () {
      return caches.match(e.request).then(function (r) {
        return r || caches.match(BASE + 'index.html');
      });
    })
  );
});
