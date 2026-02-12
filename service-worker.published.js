// Enhanced Service Worker with Offline Support for Teacher and POD
// Caution! Be sure you understand the caveats before publishing an application with
// offline support. The implications can be subtle. See https://aka.ms/blazor-offline-considerations

self.importScripts('./service-worker-assets.js');
self.addEventListener('install', event => event.waitUntil(onInstall(event)));
self.addEventListener('activate', event => event.waitUntil(onActivate(event)));
self.addEventListener('fetch', event => event.respondWith(onFetch(event)));

const cacheNamePrefix = 'offline-cache-';
const cacheName = `${cacheNamePrefix}${self.assetsManifest.version}`;
const dataCacheName = 'offline-data-cache-v1';

// Assets to cache for offline use
const offlineAssetsInclude = [/\.dll$/, /\.pdb$/, /\.wasm/, /\.html/, /\.js$/, /\.json$/, /\.css$/, /\.woff$/, /\.png$/, /\.jpe?g$/, /\.gif$/, /\.ico$/, /\.blat$/, /\.dat$/];
const offlineAssetsExclude = [/^service-worker\.js$/];

// Teacher and POD specific routes to cache
const OFFLINE_ROUTES = [
    '/official-incident-report',
    '/pod/offline-online-rounding',
    '/adviser-dashboard',
    '/pod-dashboard'
];

async function onInstall(event) {
    console.info('Service worker: Install - Enhanced with offline support');

    // Fetch and cache all matching items from the assets manifest
    const assetsRequests = self.assetsManifest.assets
        .filter(asset => offlineAssetsInclude.some(pattern => pattern.test(asset.url)))
        .filter(asset => !offlineAssetsExclude.some(pattern => pattern.test(asset.url)))
        .map(asset => new Request(asset.url, { integrity: asset.hash, cache: 'no-cache' }));

    await caches.open(cacheName).then(cache => cache.addAll(assetsRequests));

    console.info('Service worker: Cached assets for offline use');
}

async function onActivate(event) {
    console.info('Service worker: Activate');

    // Delete unused caches
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys
        .filter(key => key.startsWith(cacheNamePrefix) && key !== cacheName)
        .map(key => caches.delete(key)));

    console.info('Service worker: Cleaned up old caches');
}

async function onFetch(event) {
    const request = event.request;

    // Only handle GET requests
    if (request.method !== 'GET') {
        return fetch(request);
    }

    const url = new URL(request.url);

    // Check if this is a navigation request (page load)
    const shouldServeIndexHtml = request.mode === 'navigate';

    // For navigation requests, try network first, then cache
    if (shouldServeIndexHtml) {
        try {
            // Try to fetch from network
            const networkResponse = await fetch(request);

            // If successful, cache the response for offline use
            if (networkResponse.ok) {
                const cache = await caches.open(cacheName);
                cache.put('index.html', networkResponse.clone());
            }

            return networkResponse;
        } catch (error) {
            // Network failed, try cache
            console.log('Network failed, serving from cache:', error);
            const cache = await caches.open(cacheName);
            const cachedResponse = await cache.match('index.html');

            if (cachedResponse) {
                return cachedResponse;
            }

            // If no cache, return error
            return new Response('Offline and no cached version available', {
                status: 503,
                statusText: 'Service Unavailable'
            });
        }
    }

    // For static assets, try cache first, then network
    const cache = await caches.open(cacheName);
    let cachedResponse = await cache.match(request);

    if (cachedResponse) {
        return cachedResponse;
    }

    // Not in cache, try network
    try {
        const networkResponse = await fetch(request);

        // Cache successful responses for future offline use
        if (networkResponse.ok && shouldCacheResponse(url)) {
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.log('Fetch failed for:', url.pathname, error);

        // Return a fallback response for failed requests
        return new Response('Network error occurred', {
            status: 408,
            statusText: 'Request Timeout'
        });
    }
}

// Helper function to determine if response should be cached
function shouldCacheResponse(url) {
    // Don't cache API calls
    if (url.pathname.startsWith('/api/')) {
        return false;
    }

    // Cache static assets
    return offlineAssetsInclude.some(pattern => pattern.test(url.pathname));
}

console.log('Enhanced Service Worker v1.1 - Forced Refresh for Offline Support');
