// Life Link Progressive Web App — Service Worker
// Version: 1.0.0
// Strategies:
//   - Core Shell: Cache-first / Stale-While-Revalidate
//   - Navigation: Network-first with /index.html fallback for client-side routing
//   - API calls: Network-first with graceful offline fallback

const CACHE_NAME = 'lifelink-pwa-v1';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo_cross.png',
    '/pwa-192x192.png',
    '/pwa-512x512.png',
    '/pwa-maskable-512x512.png',
    '/apple-touch-icon.png',
    '/doctor_consultation.jpg',
    '/testimonial_user.jpg'
];

// Install: Pre-cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('Some assets could not be pre-cached:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Activate: Purge obsolete caches and claim clients immediately
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Strategy depending on request type
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Skip non-GET requests and browser extensions
    if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
        return;
    }

    // Navigation requests (HTML pages): Network-first with offline fallback to /index.html
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Update cache with fresh version
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put('/index.html', responseClone);
                    });
                    return response;
                })
                .catch(async () => {
                    // Offline navigation fallback: serve cached index.html so React Router renders
                    const cachedIndex = await caches.match('/index.html');
                    if (cachedIndex) {
                        return cachedIndex;
                    }
                    return caches.match('/');
                })
        );
        return;
    }

    // API calls: Network first
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache successful read responses
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(async () => {
                    // Check if we have a cached response for this API call
                    const cachedResponse = await caches.match(request);
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Return simulated offline JSON
                    return new Response(
                        JSON.stringify({
                            offline: true,
                            message: 'Network offline. Showing local emergency data if available.'
                        }),
                        {
                            status: 503,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                })
        );
        return;
    }

    // Static assets & images: Stale-While-Revalidate
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => cachedResponse);

            return cachedResponse || fetchPromise;
        })
    );
});
