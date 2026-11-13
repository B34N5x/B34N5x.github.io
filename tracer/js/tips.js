/* B34N5 tips dock. Read-only: shows a public r-address and QR. Never connects a wallet or asks for keys. */
(function (global) {
  "use strict";

  var ADDR = "r3vRGJPqasAJgjyU98xxL8tvx2WiEni41f";
  var XAMAN = "https://xaman.app/detect/request:" + ADDR + "?network=XRPL";
  var MEMO = "Hey, I'm Beans. I'm still learning, and I build free, helpful XRPL tools for the community. Tips help cover hosting and keep new tools coming. Totally optional — everything here stays free.\n\nAny drop is a drop of love and kindness. It's 1 in a million 😘";

  var X_URL = "https://x.com/B34N5XRP";

  function coinSvg() {
    return '<svg class="tips-coin-svg" viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
      '<circle cx="16" cy="16" r="15" fill="#1a2422" stroke="#3df58f" stroke-width="1.4"/>' +
      '<circle cx="16" cy="16" r="12.2" fill="none" stroke="#2ee6d0" stroke-width="0.55" opacity="0.55"/>' +
      '<path fill="#e8eef0" d="M7.2 16 L13.4 9.2 H16.2 L10 16 L16.2 22.8 H13.4 Z"/>' +
      '<path fill="#e8eef0" d="M24.8 16 L18.6 22.8 H15.8 L22 16 L15.8 9.2 H18.6 Z"/>' +
      '</svg>';
  }

  function xLogoSvg() {
    return '<svg class="tips-x-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.171-5.401 6.171H2.74l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>' +
      '</svg>';
  }

  function el(html) {
    var d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function memoHtml() {
    return MEMO.split("\n\n").map(function (p) { return "<p>" + escapeHtml(p) + "</p>"; }).join("");
  }

  function buildDock(footerMode) {
    var dock = el('<div class="tips-dock' + (footerMode ? " tips-dock--footer" : "") + '"></div>');
    dock.innerHTML =
      '<button type="button" class="tips-coin" aria-haspopup="dialog" aria-expanded="false" aria-label="Send a tip in XRP" title="Tips">' + coinSvg() + '</button>' +
      '<button type="button" class="tips-q" aria-expanded="false" aria-label="About tips" title="About tips">?</button>' +
      '<a class="tips-x" href="' + X_URL + '" target="_blank" rel="noopener noreferrer" aria-label="B34N5x on X" title="@B34N5XRP">' + xLogoSvg() + '</a>' +
      '<div class="tips-memo" hidden role="tooltip">' + memoHtml() + '</div>' +
      '<div class="tips-sheet" hidden role="dialog" aria-label="Send a tip in XRP">' +
        '<p class="tips-sheet-kicker">Tips are optional</p>' +
        '<p class="tips-addr" data-addr></p>' +
        '<div class="tips-actions">' +
          '<button type="button" class="tips-copy">Copy address</button>' +
          '<a class="tips-xaman" target="_blank" rel="noopener noreferrer">Pay in Xaman</a>' +
        '</div>' +
        '<div class="tips-qr" aria-hidden="true"></div>' +
        '<p class="tips-note">Scan or paste the address in your own wallet. This page never connects a wallet, and it never asks for keys or a seed.</p>' +
      '</div>';
    dock.querySelector("[data-addr]").textContent = ADDR;
    var xa = dock.querySelector(".tips-xaman");
    xa.href = XAMAN;
    bindDock(dock);
    renderQr(dock.querySelector(".tips-qr"), ADDR);
    return dock;
  }

  function renderQr(node, text) {
    if (!node) return;
    try {
      if (typeof qrcode !== "function") throw new Error("no qr lib");
      var qr = qrcode(0, "M");
      qr.addData(text);
      qr.make();
      node.innerHTML = qr.createSvgTag(3, 0);
      var svg = node.querySelector("svg");
      if (svg) {
        svg.setAttribute("width", "128");
        svg.setAttribute("height", "128");
        svg.removeAttribute("alt");
      }
    } catch (e) {
      node.innerHTML = "";
      node.hidden = true;
    }
  }

  function closeAll(except) {
    document.querySelectorAll(".tips-dock").forEach(function (dock) {
      if (dock === except) return;
      setOpen(dock, "sheet", false);
      setOpen(dock, "memo", false);
    });
  }

  function setOpen(dock, which, open) {
    var sheet = dock.querySelector(".tips-sheet");
    var memo = dock.querySelector(".tips-memo");
    var coin = dock.querySelector(".tips-coin");
    var q = dock.querySelector(".tips-q");
    if (which === "sheet") {
      sheet.hidden = !open;
      coin.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        memo.hidden = true;
        q.setAttribute("aria-expanded", "false");
        dock.classList.remove("memo-pinned");
        place(dock, sheet);
      }
    } else {
      memo.hidden = !open;
      q.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) place(dock, memo);
    }
  }

  function place(dock, pop) {
    if (!pop || pop.hidden) return;
    var footer = dock.classList.contains("tips-dock--footer");
    pop.style.top = footer ? "auto" : "calc(100% + 8px)";
    pop.style.bottom = footer ? "calc(100% + 8px)" : "auto";
    pop.style.right = "auto";
    pop.style.left = "0px";
    pop.style.maxWidth = "";
    var vw = document.documentElement.clientWidth;
    var pad = 8;
    var rect = dock.getBoundingClientRect();
    var width = pop.offsetWidth || 280;
    if (width > vw - pad * 2) {
      width = vw - pad * 2;
      pop.style.maxWidth = width + "px";
    }
    var left = rect.left;
    if (left + width > vw - pad) left = vw - pad - width;
    if (left < pad) left = pad;
    pop.style.left = (left - rect.left) + "px";
  }

  function bindDock(dock) {
    var coin = dock.querySelector(".tips-coin");
    var q = dock.querySelector(".tips-q");
    var memo = dock.querySelector(".tips-memo");
    var sheet = dock.querySelector(".tips-sheet");
    var copy = dock.querySelector(".tips-copy");

    coin.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = sheet.hidden;
      closeAll();
      setOpen(dock, "sheet", open);
    });

    function showMemo(pin) {
      closeAll(dock);
      setOpen(dock, "sheet", false);
      setOpen(dock, "memo", true);
      if (pin) dock.classList.add("memo-pinned");
    }
    function hideMemo() {
      if (dock.classList.contains("memo-pinned")) return;
      setOpen(dock, "memo", false);
    }

    q.addEventListener("mouseenter", function () { showMemo(false); });
    q.addEventListener("focus", function () { showMemo(false); });
    q.addEventListener("mouseleave", function (e) {
      if (memo.contains(e.relatedTarget)) return;
      hideMemo();
    });
    memo.addEventListener("mouseenter", function () { setOpen(dock, "memo", true); });
    memo.addEventListener("mouseleave", function (e) {
      if (q.contains(e.relatedTarget)) return;
      hideMemo();
    });
    q.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!memo.hidden && dock.classList.contains("memo-pinned")) {
        dock.classList.remove("memo-pinned");
        setOpen(dock, "memo", false);
      } else {
        showMemo(true);
      }
    });

    copy.addEventListener("click", function (e) {
      e.stopPropagation();
      function ok() {
        copy.textContent = "Copied";
        setTimeout(function () { copy.textContent = "Copy address"; }, 1600);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ADDR).then(ok).catch(fallback);
      } else fallback();
      function fallback() {
        var ta = document.createElement("textarea");
        ta.value = ADDR;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); ok(); } catch (err) {}
        document.body.removeChild(ta);
      }
    });

    sheet.addEventListener("click", function (e) { e.stopPropagation(); });
    memo.addEventListener("click", function (e) { e.stopPropagation(); });
  }

  function onDocClick() { closeAll(); }
  function onKey(e) {
    if (e.key === "Escape") closeAll();
  }

  function mount(node, footerMode) {
    if (!node) return null;
    node.innerHTML = "";
    var dock = buildDock(!!footerMode);
    node.appendChild(dock);
    return dock;
  }

  function insertInFooter(footer) {
    if (!footer || footer.querySelector(".tips-dock, [data-tips-mount]")) return;
    // If a page already has a header/HUD mount, don't also inject into a footer.
    if (document.querySelector("[data-tips-mount]:not([data-tips-mount='footer'])")) return;
    var holder = document.createElement("div");
    holder.setAttribute("data-tips-mount", "footer");
    holder.className = "tips-mount-footer";
    var disc = footer.querySelector("p.disclaimer, .disc");
    if (disc) {
      disc.parentNode.insertBefore(holder, disc);
    } else {
      var wrap = footer.querySelector(".wrap") || footer;
      var legal = null;
      var kids = wrap.children;
      for (var i = 0; i < kids.length; i++) {
        var k = kids[i];
        if (k.tagName === "SPAN" || (k.tagName === "P" && !k.querySelector("button"))) legal = k;
      }
      if (legal) wrap.insertBefore(holder, legal);
      else wrap.appendChild(holder);
    }
    mount(holder, true);
  }

  function init() {
    document.querySelectorAll("[data-tips-mount]").forEach(function (node) {
      if (node.querySelector(".tips-dock")) return;
      var footerMode = node.closest("footer") || node.getAttribute("data-tips-mount") === "footer";
      mount(node, !!footerMode);
    });
    document.querySelectorAll("footer").forEach(insertInFooter);
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  global.B34N5Tips = {
    address: ADDR,
    memo: MEMO,
    xaman: XAMAN,
    mount: mount,
  };
})(window);
