// In development, always fetch from the network and do not enable offline support.
// This is because caching would make development difficult (changes wouldn't be reflected immediately).
self.addEventListener('install', async event => {
    console.log('Service worker: Install (Dev)');
    self.skipWaiting();
});

self.addEventListener('fetch', event => {
    return null;
});
