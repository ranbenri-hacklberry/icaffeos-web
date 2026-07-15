self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Only handle http/https requests to avoid throwing on ws:// and chrome-extension:// schemes
  try {
    const url = new URL(e.request.url);
    if (!url.protocol.startsWith('http')) {
      return; // Let the browser handle this request natively (ws://, chrome-extension://, etc.)
    }
  } catch (err) {
    return;
  }

  // Pass-through to network, bypassing all cache
  e.respondWith(fetch(e.request));
});
