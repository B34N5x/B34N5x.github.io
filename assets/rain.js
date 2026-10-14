// Decorative digital rain for the home page. aria-hidden; reduced-motion shows a static frame.
(function () {
  "use strict";
  const c = document.getElementById("rain"); if (!c || !c.getContext) return;
  const ctx = c.getContext("2d");
  const WORDS = ["XRPL","XRP Ledger","Payments","Cross-border","Escrow","EscrowFinish","Time-locked savings","AMM","DEX","NFTs","XLS-20","Tokenization","RWA","RLUSD","Stablecoins","Trust lines","TrustSet","Checks","Payment channels","Hooks","Sidechains","drops","1M drops = 1 XRP","3-5 sec","tesSUCCESS","Testnet","ledger close","#XRPFamily","#XRPCommunity","#BuildOnXRPL","build in public","bg123","B34N5"];
  const GLYPHS = "01XRPLrabcdef0123456789ABCDEF<>/=+*";
  const FS = 14; let cols = [], words = [], w = 0, h = 0, timer = null;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  function size() {
    const r = c.getBoundingClientRect(); w = c.width = Math.max(1, Math.floor(r.width)); h = c.height = Math.max(1, Math.floor(r.height));
    cols = Array.from({ length: Math.ceil(w / FS) }, () => Math.random() * -h / FS);
  }
  function step() {
    ctx.fillStyle = "rgba(2,4,3,0.12)"; ctx.fillRect(0, 0, w, h);
    ctx.font = FS + "px 'DejaVu Sans Mono', ui-monospace, monospace";
    for (let i = 0; i < cols.length; i++) {
      ctx.fillStyle = Math.random() < 0.1 ? "#2ee6d0" : "#3df58f";
      ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * FS, cols[i] * FS);
      if (cols[i] * FS > h && Math.random() > 0.975) cols[i] = 0; else cols[i]++;
    }
    if (Math.random() < 0.06 && words.length < 4) words.push({ t: WORDS[(Math.random() * WORDS.length) | 0], x: Math.random() * Math.max(10, w - 300), y: 0 });
    ctx.fillStyle = "#eafff4";
    words = words.filter(o => { ctx.fillText(o.t, o.x, o.y); o.y += FS * 0.35; return o.y < h + FS; });
  }
  function staticFrame() { size(); for (let i = 0; i < 60; i++) step(); ctx.fillStyle = "#eafff4"; ctx.fillText("bg123", 20, h * 0.3); }
  function start() { if (!timer && !document.hidden && !(reduce && reduce.matches)) timer = setInterval(step, 60); }
  function stop() { clearInterval(timer); timer = null; }
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  window.addEventListener("resize", () => { size(); if (reduce && reduce.matches) staticFrame(); });
  if (reduce && reduce.addEventListener) reduce.addEventListener("change", () => { stop(); reduce.matches ? staticFrame() : start(); });
  size(); if (reduce && reduce.matches) staticFrame(); else start();
})();
