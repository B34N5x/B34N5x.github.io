// Decorative full-page code rain behind the content. Self-hosted, no inline script (strict CSP).
// ~15 fps, pauses when the tab is hidden, static frame for prefers-reduced-motion, hidden when printing.
(function () {
  "use strict";
  if (!document.createElement("canvas").getContext) return;
  var c = document.createElement("canvas"); c.className = "matrix-bg"; c.setAttribute("aria-hidden", "true");
  document.body.insertBefore(c, document.body.firstChild); document.body.classList.add("has-matrix");
  var ctx = c.getContext("2d"), G = "01XRPL0123456789ABCDEF<>/=+*", FS = 16, cols = [], w = 0, h = 0, timer = null, words = [];
  var WORDS = ["XRPL","XRP Ledger","Payments","Cross-border","Escrow","EscrowFinish","Time-locked savings","AMM","DEX","NFTs","XLS-20","Tokenization","RWA","RLUSD","Stablecoins","Trust lines","TrustSet","Checks","Payment channels","Hooks","Sidechains","drops","1M drops = 1 XRP","3-5 sec","tesSUCCESS","Testnet","ledger close","#XRPFamily","#XRPCommunity","#BuildOnXRPL","build in public","bg123","B34N5"];
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
    if (Math.random() < 0.05 && words.length < 4) words.push({ t: WORDS[(Math.random() * WORDS.length) | 0], x: Math.random() * Math.max(10, w - 220), y: 0 });
    ctx.fillStyle = "#c8ffe0";
    words = words.filter(function (o) { ctx.fillText(o.t, o.x, o.y); o.y += FS * 0.35; return o.y < h + FS; });
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
