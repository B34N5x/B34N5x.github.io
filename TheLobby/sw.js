// v34e minimal service worker: app shell only. Versioned cache, old caches deleted on activate.
// Network-first for everything in the shell (so new deploys always win); cache is only an offline fallback.
// Never caches cross-origin requests (XRPL/ledger lookups, APIs, wallet/Xaman, rooms) or non-GET or JSON data.
const VER = 'lobby-shell-thelobby-v1';
const SCOPE = new URL(self.registration.scope).pathname; // e.g. /TheLobby/ or /
const SHELL = [SCOPE, SCOPE + 'index.html', SCOPE + 'style.css?v=58', SCOPE + 'theme.css?v=16', SCOPE + 'neon.css?v=14', SCOPE + 'manifest.webmanifest', SCOPE + 'assets/icons/icon-192.png', SCOPE + 'assets/icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER && k.startsWith('lobby-shell-thelobby')).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || /\.json$|\/api\/|\/rooms|wallet/i.test(u.pathname)) return;
  if (!u.pathname.startsWith(SCOPE)) return; // never intercept site-root paths
  const shell = r.mode === 'navigate' || SHELL.includes(u.pathname + u.search);
  if (!shell) return;
  const navKey = SCOPE + 'index.html';
  e.respondWith(fetch(r).then(res => { if (res.ok && res.type === 'basic') { const cp = res.clone(); caches.open(VER).then(c => c.put(r.mode === 'navigate' ? navKey : r, cp)); } return res; })
    .catch(() => caches.match(r.mode === 'navigate' ? navKey : r)));
});
