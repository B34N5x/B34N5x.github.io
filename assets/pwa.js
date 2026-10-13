// Registers the service worker and shows a quiet install hint on the home page.
(function () {
  "use strict";
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  const hint = document.getElementById("install"); if (!hint) return;
  const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  if (standalone) return;
  const text = hint.querySelector(".install-text"), btn = hint.querySelector("button");
  let deferred = null;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); deferred = e;
    text.textContent = "Use these tools like an app.";
    btn.hidden = false; hint.hidden = false;
  });
  btn.addEventListener("click", () => {
    if (!deferred) return; deferred.prompt();
    deferred.userChoice.finally(() => { deferred = null; hint.hidden = true; });
  });
  window.addEventListener("appinstalled", () => { hint.hidden = true; });
  const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  if (ios && safari) { text.textContent = "Install: tap Share, then Add to Home Screen."; btn.hidden = true; hint.hidden = false; }
})();
