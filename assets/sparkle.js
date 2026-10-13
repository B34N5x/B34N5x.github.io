// Subtle XRP cursor sparkle: fine pointers only, off under reduced motion, max 6 nodes.
(function () {
  if (!window.matchMedia || !matchMedia("(pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var layer = document.createElement("div"), live = 0, next = 0;
  layer.className = "sparkle-layer"; layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);
  document.addEventListener("mousemove", function (e) {
    var now = performance.now();
    if (now < next) return;
    next = now + 2000 + Math.random() * 2000;
    var n = 1 + (Math.random() < 0.5 ? 1 : 0);
    for (var i = 0; i < n && live < 6; i++) {
      var s = document.createElement("span"), size = 4 + Math.random() * 2;
      s.className = "sparkle" + (Math.random() < 0.5 ? " sparkle-p" : "");
      s.style.cssText = "left:" + (e.clientX + 6 + Math.random() * 10) + "px;top:" + (e.clientY + 6 + Math.random() * 10) + "px;width:" + size + "px;height:" + size + "px;--dx:" + (Math.random() * 16 - 8) + "px;--dy:" + (Math.random() * 10 + 4) + "px";
      live++;
      s.addEventListener("animationend", function () { this.remove(); live--; });
      layer.appendChild(s);
    }
  }, { passive: true });
})();
