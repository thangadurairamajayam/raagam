// Cache app assets only. Imported music is stored separately in IndexedDB.
const CACHE = "raagam-shell-v3";
const SHELL = /* PRECACHE */ ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith("raagam-shell-") && key !== CACHE).map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
  } else if (SHELL.includes(url.pathname)) {
    // Module requests include Origin; precache requests may not. These static
    // same-origin assets have identical content for both request forms.
    event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match(request, { ignoreVary: true })) || fetch(request)));
  }
});
