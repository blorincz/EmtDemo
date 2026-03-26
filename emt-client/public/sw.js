// sw.js
const CACHE_NAME = "emt-pwa-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "/src/main.tsx",
  "/src/App.tsx",
  "/src/App.css",
];

// Assets that should be cached (static files)
const STATIC_ASSETS = [
  "html",
  "css",
  "js",
  "json",
  "png",
  "jpg",
  "jpeg",
  "svg",
  "webp",
];

// API paths that should NOT be cached or intercepted
const API_PATHS = ["/api/"];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    }),
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

// Helper function to check if request is for API
function isApiRequest(request) {
  const url = new URL(request.url);
  return API_PATHS.some((path) => url.pathname.startsWith(path));
}

// Helper function to check if request is for static assets
function isStaticAsset(request) {
  const url = new URL(request.url);
  const extension = url.pathname.split(".").pop();
  return (
    STATIC_ASSETS.includes(extension) ||
    url.pathname === "/" ||
    url.pathname.includes("manifest.json")
  );
}

// Fetch event - handle requests
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip API requests - let them go to the network
  if (isApiRequest(request)) {
    // Don't intercept API calls
    event.respondWith(fetch(request));
    return;
  }

  // For static assets, try cache first then network
  if (isStaticAsset(request)) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(request).then((networkResponse) => {
          // Cache the fetched response for future
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      }),
    );
    return;
  }

  // For everything else, try network first, then fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for static assets
        if (response && response.status === 200 && isStaticAsset(request)) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails and it's a navigation request, serve the cached index.html
        if (request.mode === "navigate") {
          return caches.match("/index.html");
        }
        return caches.match(request);
      }),
  );
});
