const CACHE = 'awakening-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg'
];

// Установка: кэшируем оболочку
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

// Активация: чистим старые кэши
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: сеть → кэш → фолбэк
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isExternal =
    url.origin.includes('unpkg.com') ||
    url.origin.includes('tile.openstreetmap.org') ||
    url.origin.includes('overpass-api.de') ||
    url.origin.includes('yandex.net');

  // Внешние ресурсы (Leaflet, тайлы, Overpass) — сеть, при ошибке кэш
  if (isExternal) {
    e.respondWith(
      fetch(req).then(resp => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return resp;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Свои файлы — кэш сначала, сеть как обновление
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        fetch(req).then(resp => {
          if (resp.ok) caches.open(CACHE).then(c => c.put(req, resp));
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then(resp => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return resp;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
