/* Static offline shell only. Never cache authentication, journal pages, APIs or trade screenshots. */
const shellCache = "trade-notes-shell-v1";
const assets = [
  "/offline.html",
  "/theme.js",
  "/brand/icon-192.png",
  "/brand/icon-512.png",
];
globalThis.addEventListener("install", (event) => {
  event.waitUntil(
    globalThis.caches.open(shellCache).then((cache) => cache.addAll(assets)),
  );
  globalThis.skipWaiting();
});
globalThis.addEventListener("activate", (event) => {
  event.waitUntil(
    globalThis.caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("trade-notes-shell-") && key !== shellCache,
            )
            .map((key) => globalThis.caches.delete(key)),
        ),
      )
      .then(() => globalThis.clients.claim()),
  );
});
globalThis.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new globalThis.URL(request.url);
  if (request.method !== "GET" || url.origin !== globalThis.location.origin)
    return;
  if (request.mode === "navigate") {
    event.respondWith(
      globalThis
        .fetch(request)
        .catch(() => globalThis.caches.match("/offline.html")),
    );
    return;
  }
  if (assets.includes(url.pathname))
    event.respondWith(
      globalThis
        .fetch(request)
        .catch(() => globalThis.caches.match(url.pathname)),
    );
});
