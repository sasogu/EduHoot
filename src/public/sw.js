const CACHE_NAME = 'eduh-pwa-v2';
const ASSETS = [
  '/',
  '/join.html',
  '/css/index.css',
  '/css/landing.css',
  '/js/join.js',
  '/js/i18n-player.js',
  '/manifest.webmanifest',
  '/icons/logo.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => {
      if (key !== CACHE_NAME) return caches.delete(key);
      return null;
    }))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/socket.io')) return;

  // No interferir con recursos cross-origin
  if (url.origin !== self.location.origin) return;

  const accept = request.headers.get('accept') || '';
  const isHtml = request.mode === 'navigate' || accept.includes('text/html');

  // HTML: network-first para que los cambios se vean al recargar.
  if (isHtml) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const response = await fetch(request, { cache: 'no-store' });
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        } catch (err) {
          const cached = await caches.match(request);
          return cached || caches.match('/');
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await caches.match(request);

      const fetchPromise = fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          cache.put(request, response.clone());
        }
        return response;
      });

      // stale-while-revalidate: devuelve caché si existe, pero actualiza en background.
      if (cached) {
        event.waitUntil(fetchPromise.catch(() => null));
        return cached;
      }

      try {
        return await fetchPromise;
      } catch (err) {
        return cached;
      }
    })()
  );
});
