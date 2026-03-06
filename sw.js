/**
 * Service Worker - 离线缓存
 */

const CACHE_NAME = 'profit-calc-v2';
const ASSETS = [
    './',
    './index.html',
    './roi.html',
    './css/style.css',
    './js/calculator.js',
    './js/roi.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
];

// Install: cache all assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: cache-first strategy
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).then((response) => {
                // Cache new requests
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            });
        }).catch(() => {
            // Fallback for navigation
            if (event.request.mode === 'navigate') {
                return caches.match('./index.html');
            }
        })
    );
});
