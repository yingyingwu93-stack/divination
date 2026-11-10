const CACHE_NAME = 'divination-v12';
const urlsToCache = ['/', '/index.html', '/auth.html', '/dream.html', '/zodiac.html', '/tarot.html', '/bazi.html', '/history.html', '/settings.html', '/admin.html', '/css/style.css', '/js/data.js', '/js/main.js', '/js/auth.js', '/js/api.js', '/js/tarot.js', '/js/tarot-data.js', '/js/longcat.js', '/js/bazi.js', '/js/bazi-regions.js', '/js/ziwei.js', '/js/iztro.min.js', '/js/assistant.js', '/js/followup.js', '/js/pwa.js', '/js/admin.js', '/js/settings.js', '/js/echarts.min.js'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // API 请求与跨域请求直接走网络，不写入缓存（避免拿到过期数据）
  if (url.pathname.startsWith('/api') || url.origin !== self.location.origin) {
    return;
  }
  event.respondWith(fetch(event.request).then(response => {
    const clone = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
    return response;
  }).catch(() => caches.match(event.request)));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))));
});
