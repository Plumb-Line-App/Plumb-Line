// Offline support. The app's own files are network-first (fresh whenever online, so a new version
// arrives whole, never as a mix of old and new files) with the cache as the offline fallback.
// Fonts are cache-first. Bump VERSION when shipping changes so old caches are cleared.
const VERSION = 'vt-v8';
const CORE = [
  './',
  'index.html',
  'css/tailwind.css',
  'css/styles.css',
  'js/stages.js',
  'js/virtues.js',
  'js/scripture.js',
  'js/storage.js',
  'js/insights.js',
  'js/script.js',
  'js/charts.js',
  'js/ui.js',
  'js/today.js',
  'js/honesty.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
];
const NETWORK_WAIT_MS = 4000; // on a weak connection, fall back to the cached copy after this long

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache, so the precache is the version just deployed.
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  const network = fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  });
  const cached = await cache.match(req, { ignoreSearch: true });
  if (!cached) return network;
  const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_WAIT_MS));
  return Promise.race([network.catch(() => cached), timeout]);
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) e.respondWith(networkFirst(req));
  else if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) e.respondWith(cacheFirst(req));
});
