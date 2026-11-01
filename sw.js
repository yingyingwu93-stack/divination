const CACHE_NAME = 'divination-v10';
const urlsToCache = ['/', '/index.html', '/auth.html', '/dream.html', '/zodiac.html', '/tarot.html', '/bazi.html', '/ziwei.html', '/history.html', '/settings.html', '/css/style.css', '/js/data.js', '/js/main.js', '/js/auth.js', '/js/api.js', '/js/tarot.js', '/js/tarot-data.js', '/js/longcat.js', '/js/bazi.js', '/js/bazi-regions.js', '/js/ziwei.js', '/js/iztro.min.js', '/js/pwa.js'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request).then(response => {
    const clone = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
    return response;
  }).catch(() => caches.match(event.request)));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))));
});
