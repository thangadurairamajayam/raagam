// Offline shell only. Audio is never cached: archive/radio/YouTube streams are
// other people's copyrighted material, and caching them would be a copy we have
// no right to make. Your own local files never touch the network anyway.

// Bumping this name makes `activate` purge the previous shell, so renamed
// builds reach already-installed clients instead of serving the stale cache.
const CACHE = "raagam-shell-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(["/", "/manifest.webmanifest", "/icon-192.png"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // never touch third-party media
  if (request.destination === "audio" || request.destination === "video") return;

  // Network-first so a rebuilt app is picked up, cache as the offline fallback.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match("/")))
  );
});
