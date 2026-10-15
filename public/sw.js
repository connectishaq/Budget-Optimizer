// Offline support. The page is fetched from the network first so updates
// arrive straight away, and the saved copy is used when there's no
// connection. Built files (hashed names, never change) are served from the
// cache. Other sites (ads) are never touched. Budget numbers stay in
// localStorage; nothing here sees them.

const VERSION = 'v1';
const PAGES = `pages-${VERSION}`;
const FILES = `files-${VERSION}`;
const MAX_FILES = 40;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.add('/')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== PAGES && k !== FILES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Old builds' files pile up after each deploy, so keep only the newest few
async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_FILES)).map((k) => cache.delete(k)));
}

async function pageFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    // Only the app page is kept; opening robots.txt or the sitemap mustn't replace it
    const path = new URL(request.url).pathname;
    if (res.ok && (path === '/' || path === '/index.html')) cache.put('/', res.clone());
    return res;
  } catch {
    return (await cache.match('/')) || Response.error();
  }
}

async function fileFromCache(request) {
  const cache = await caches.open(FILES);
  const hit = await cache.match(request);
  const fresh = fetch(request).then(async (res) => {
    if (res.ok) {
      await cache.put(request, res.clone());
      trim(cache);
    }
    return res;
  });
  if (hit) {
    fresh.catch(() => {});
    return hit;
  }
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') event.respondWith(pageFirst(request));
  else event.respondWith(fileFromCache(request));
});
