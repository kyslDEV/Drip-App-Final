const CACHE_NAME = 'driptest-v21';

const CORE_ASSETS = [
  './',
  './index.html',
  './DripTeste.html',
  './DripTestF.html',
  './DripSchedule.html',
  './DripAbsorption.html',
  './DripReports.html',
  './DripSupervisor.html',
  './DripSettings.html',
  './drip-data.js',
  './drip-api.js',
  './drip-sync.js',
  './drip-theme.css',
  './drip-ui.js',
  './manifest.webmanifest'
];

const OPTIONAL_ASSETS = [
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => (
      cache.addAll(CORE_ASSETS).then(() => (
        Promise.allSettled(OPTIONAL_ASSETS.map((asset) => cache.add(asset)))
      ))
    ))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// Allow the page to tell the service worker to skip waiting (useful on deploy)
self.addEventListener('message', (event) => {
  try {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  } catch (e) {
    // ignore
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const acceptsHtml = event.request.mode === 'navigate'
    || (event.request.headers.get('accept') || '').includes('text/html');

  if (acceptsHtml) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        const isHttp = event.request.url.startsWith('http://') || event.request.url.startsWith('https://');
        if (isHttp && response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => new Response('', { status: 503, statusText: 'Indisponivel' }));
    })
  );
});
