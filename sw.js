// B34N5 service worker: same-origin GET only. Never touches WebSocket or cross-origin requests.
const VERSION = "b34n5-v19";
const SHELL = ["/", "/index.html", "/tools/", "/security/", "/checker/", "/checker/testnet/", "/checker/mainnet/", "/tools/balance-checker/", "/terms/",
  "/assets/style.css", "/assets/cursor-xrp.svg", "/assets/cursor-xrp.png", "/assets/checker.js", "/assets/consent.js", "/assets/rain.js", "/assets/eggs.js", "/assets/pwa.js", "/assets/sparkle.js", "/assets/matrix-bg.js", "/assets/hud.js", "/assets/visits.js", "/assets/vendor/xrpl-4.7.0.min.js",
  "/assets/img/A-digital-rain-1600x500.png", "/assets/img/A-digital-rain-800x600.png", "/assets/img/favicon-32.png", "/assets/img/favicon-192.png",
  "/assets/img/favicon-512.png", "/assets/img/icon-192.png", "/assets/img/icon-512.png", "/assets/img/icon-maskable-192.png",
  "/assets/img/icon-maskable-512.png", "/assets/img/apple-touch-icon-180.png", "/favicon.ico", "/manifest.webmanifest"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || (url.protocol !== "https:" && url.protocol !== "http:")) return;
  // Network first, so updates show; fall back to the cached shell when offline.
  e.respondWith(fetch(req).then(res => {
    if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === "navigate" ? caches.match("/") : Response.error()))));
});
