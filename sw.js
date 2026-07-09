const CACHE_VERSION = 'mascot-cache-v7';

const CACHE_URLS = [
  './',
  './index.html',
  './mascot.js',
  './manifest.json',
  './model.glb',
  './vendor/three.module.js',
  './vendor/loaders/GLTFLoader.js',
  './vendor/utils/BufferGeometryUtils.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await cache.addAll(CACHE_URLS);
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
