// Service Worker for AnomCAT PWA
const CACHE_NAME = 'anomcat-v1.01';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/home.html',
  '/wallet.html',
  '/transactions.html',
  '/analytics.html',
  '/settings.html',
  '/assets/css/style.css',
  '/assets/js/app.js',
  '/assets/data/chart-data.json',
  '/assets/data/users.json',
  '/manifest.json'
];

// Install service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Fetch from cache
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Update service worker
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
