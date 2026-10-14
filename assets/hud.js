// Decorative HUD effects for the balance checker (original design). Visual only: never changes what is queried or shown.
// Under 1s, skipped entirely for prefers-reduced-motion.
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.body.classList.add("hud"); if (reduce) { document.body.classList.add("hud-still"); return; }
  var sweep = document.createElement("div"); sweep.className = "hud-scan"; sweep.setAttribute("aria-hidden", "true");
  document.body.appendChild(sweep); setTimeout(function () { sweep.remove(); }, 1000);
  var out = document.getElementById("out"); if (!out || !window.MutationObserver) return;
  var busy = false;
  new MutationObserver(function () {
    if (busy) return;
    var big = out.querySelector(".big");
    if (big && !big.dataset.hud) {
      var final = big.textContent, m = final.match(/^([\d.]+)(.*)$/); big.dataset.hud = "1"; if (!m) return;
      var target = parseFloat(m[1]), dec = (m[1].split(".")[1] || "").length, t0 = performance.now();
      (function tick(now) { var k = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - k, 3);
        busy = true; big.textContent = k < 1 ? (target * e).toFixed(dec) + m[2] : final; busy = false;
        if (k < 1) requestAnimationFrame(tick); })(t0);
    } else if (!big && /^Checking/.test(out.textContent) && !out.dataset.typing) {
      var txt = out.textContent, i = 0; out.dataset.typing = "1"; out.setAttribute("aria-label", txt);
      (function type() { if (!/^Checking/.test(txt) || out.querySelector(".big")) return; busy = true; out.firstChild && (out.firstChild.textContent = txt.slice(0, i)); busy = false;
        if (i++ < txt.length) setTimeout(type, Math.max(8, 600 / txt.length)); else delete out.dataset.typing; })();
    }
  }).observe(out, { childList: true, subtree: true, characterData: true });
})();
