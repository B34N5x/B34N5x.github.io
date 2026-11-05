// v34e: PWA bootstrap. Registers sw.js and keeps the install prompt for the Settings 'Install app' button.
(function () {
  // v34g copy check: only run on our own hosts (static JS can still be copied; the licence is the real protection).
  const h = location.hostname, ok = h === 'b34n5-lobby-test.pages.dev' || h.endsWith('.b34n5-lobby-test.pages.dev') || h === 'b34n5.xyz' || h === 'www.b34n5.xyz' || h === 'localhost' || h === '127.0.0.1';
  if (!ok) { document.documentElement.innerHTML = '<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#08041a;color:#dff;font:18px system-ui;text-align:center"><div><h1>Unofficial copy</h1><p>The Lobby &copy; B34N5x. All rights reserved. Play it at the official site.</p></div>'; window.stop(); throw new Error('unofficial host'); }
  const beta = h.startsWith('beta.');
  if (beta && 'serviceWorker' in navigator) { navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {}); if (self.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k))).catch(() => {}); } // beta: no offline copy
  window.__bip = null;
  window.__isInstalled = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches && !document.fullscreenElement || navigator.standalone === true;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__bip = e; dispatchEvent(new Event('pwachange')); });
  addEventListener('appinstalled', () => { window.__bip = null; window.__pwaInstalled = true; dispatchEvent(new Event('pwachange')); });
  if (!beta && 'serviceWorker' in navigator && !/[?&]rec=1/.test(location.search)) addEventListener('load', () => navigator.serviceWorker.register(new URL('sw.js', document.baseURI || location.href).pathname, { scope: new URL('./', document.baseURI || location.href).pathname }).catch(() => {}));
})();
