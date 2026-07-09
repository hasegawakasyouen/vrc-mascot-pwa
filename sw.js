const CACHE_VERSION = 'mascot-cache-v6';

const CACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './model.glb',
  './model.usdz',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

const CDN_URL = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await cache.addAll(CACHE_URLS);
      try {
        await cache.add(CDN_URL);
      } catch (err) {
        // CDNが初回インストール時に到達不能でも、ローカルアセットのキャッシュは成立させる。
        // CDN分は次回オンライン時の通常fetch経由でキャッシュされる。
        console.warn('sw.js: CDN prefetch failed, will cache on next successful fetch:', err);
      }
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      const response = await fetch(event.request);
      const cache = await caches.open(CACHE_VERSION);
      cache.put(event.request, response.clone());
      return response;
    })()
  );
});
