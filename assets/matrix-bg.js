// Decorative full-page code rain behind the content. Self-hosted, no inline script (strict CSP).
// ~15 fps, pauses when the tab is hidden, static frame for prefers-reduced-motion, hidden when printing.
(function () {
  "use strict";
  if (!document.createElement("canvas").getContext) return;
  var c = document.createElement("canvas"); c.className = "matrix-bg"; c.setAttribute("aria-hidden", "true");
  document.body.insertBefore(c, document.body.firstChild); document.body.classList.add("has-matrix");
  var ctx = c.getContext("2d"), G = "01XRPL0123456789ABCDEF<>/=+*", FS = 16, cols = [], w = 0, h = 0, timer = null;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  function size() {
    var d = Math.min(window.devicePixelRatio || 1, 1.5);
    w = window.innerWidth; h = window.innerHeight; c.width = Math.floor(w * d); c.height = Math.floor(h * d);
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.fillStyle = "#020403"; ctx.fillRect(0, 0, w, h);
    cols = []; for (var i = 0; i < Math.ceil(w / FS); i++) cols.push(Math.random() * -h / FS);
  }
  function step() {
    ctx.fillStyle = "rgba(2,4,3,0.10)"; ctx.fillRect(0, 0, w, h);
    ctx.font = FS + "px 'DejaVu Sans Mono', ui-monospace, monospace";
    for (var i = 0; i < cols.length; i++) {
      ctx.fillStyle = Math.random() < 0.08 ? "#2ee6d0" : "#3df58f";
      ctx.fillText(G[(Math.random() * G.length) | 0], i * FS, cols[i] * FS);
      if (cols[i] * FS > h && Math.random() > 0.975) cols[i] = 0; else cols[i]++;
    }
  }
  function staticFrame() { size(); for (var k = 0; k < 120; k++) step(); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function start() { stop(); if (reduce && reduce.matches) { staticFrame(); return; } if (!document.hidden) timer = setInterval(step, 66); }
  window.addEventListener("resize", function () { size(); if (reduce && reduce.matches) staticFrame(); });
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
  if (reduce && reduce.addEventListener) reduce.addEventListener("change", start);
  window.addEventListener("beforeprint", stop); window.addEventListener("afterprint", start);
  size(); start();
})();
