/**
 * Deep Focus v2.0 - Service Worker
 * Enables offline execution and asset caching
 */

const CACHE_NAME = 'deep-focus-v2.0.10';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/css/themes.css',
  '/css/components.css',
  '/js/app.js',
  '/js/state/db.js',
  '/js/state/store.js',
  '/js/timer/timer.js',
  '/js/audio/synth.js',
  '/js/audio/studio.js',
  '/js/audio/eq.js',
  '/js/audio/visualizer.js',
  '/js/intelligence/recommender.js',
  '/js/ui/view.js',
  '/js/ui/components/timerUi.js',
  '/js/ui/components/studioUi.js',
  '/js/ui/components/journalUi.js',
  '/js/ui/components/analyticsUi.js',
  '/js/ui/components/todoUi.js',
  '/js/ui/components/themeCreatorUi.js',
  '/js/ui/components/zenModeUi.js',
  '/js/ui/components/aiCompanionUi.js'
];

// Install Event - Pre-cache Static Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pre-caching static app shell...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up Outdated Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Evicting deprecated cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network-First for HTML, Cache-First for assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isHtml = url.pathname === '/' || url.pathname.endsWith('.html') || url.pathname.endsWith('/index.html');

  if (isHtml) {
    // Network First Strategy for main pages to ensure live layout updates
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(event.request);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Serve from cache but perform background update check
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, responseClone);
                });
              }
            })
            .catch(() => {/* Ignore network check errors when offline */});
          
          return cachedResponse;
        }

        // Fetch from network if not in cache
        return fetch(event.request).then((networkResponse) => {
          // Cache newly fetched external resources (e.g. Google Fonts)
          if (networkResponse.status === 200 && (event.request.url.startsWith('http') || event.request.url.includes('fonts.gstatic.com'))) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        });
      })
  );
});
