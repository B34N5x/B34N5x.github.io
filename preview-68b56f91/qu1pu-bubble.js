(() => {
  "use strict";

  const PATH = String(location.pathname || "");
  if (/(?:^|\/)qu1pu(?:\/|$)/i.test(PATH)) return;

  const GUIDE = "https://b34n5.xyz/qu1pu/";
  const ALLOWED_SOURCE = [
    "https://xrpl.org/",
    "https://xrpl-ai.org/",
    "https://help.xaman.app/",
    "https://ripple.com/",
    "https://www.xrpl.foundation/",
    "https://x.com/Vet_X0",
    "https://x.com/bearableguy123",
  ];
  const ALLOWED_TOOLS = {
    "https://b34n5.xyz/explainer/": 1,
    "https://b34n5.xyz/explainer/try/": 1,
    "https://b34n5.xyz/tracer/": 1,
    "https://b34n5.xyz/checker/": 1,
    "https://b34n5.xyz/checker/batch/": 1,
    "https://b34n5.xyz/family-vault/": 1,
    "https://b34n5.xyz/TheLobby/": 1,
    "https://b34n5.xyz/tools/": 1,
    "https://xrpl-will.pages.dev/": 1,
    "https://xrpl-will.pages.dev": 1,
    "https://b34n5.xyz/qu1pu/": 1,
  };

  function reduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
      || document.body.classList.contains("reduce-motion");
  }

  function isAllowedHref(href) {
    const u = String(href || "");
    if (!u || /preview-/i.test(u)) return false;
    if (ALLOWED_TOOLS[u]) return true;
    return ALLOWED_SOURCE.some((p) => u.startsWith(p));
  }

  function prettyLabel(s) {
    return String(s || "")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }

  function shortSourceLabel(href) {
    const u = String(href || "");
    try {
      const url = new URL(u, "https://b34n5.xyz");
      const host = (url.hostname || "").replace(/^www\./, "");
      if (host === "x.com" || host === "twitter.com") {
        const handle = url.pathname.replace(/^\//, "").split("/")[0];
        return handle ? "@" + handle : "X";
      }
      if (host === "xrpl-ai.org") {
        const hash = (url.hash || "").replace(/^#/, "").replace(/-/g, " ");
        return hash ? "xrpl-ai.org: " + prettyLabel(hash) : "xrpl-ai.org FAQ";
      }
      if (host === "help.xaman.app") {
        const last = url.pathname.split("/").filter(Boolean).pop() || "";
        return last ? "Xaman: " + prettyLabel(last) : "Xaman Help";
      }
      if (host === "xrpl.org") {
        const last = url.pathname.split("/").filter(Boolean).pop() || "xrpl.org";
        return prettyLabel(last);
      }
      if (host === "ripple.com") {
        const last = url.pathname.split("/").filter(Boolean).pop() || "Ripple";
        return "Ripple: " + prettyLabel(last);
      }
      if (host === "www.xrpl.foundation" || host === "xrpl.foundation") return "XRPL Foundation";
      return host || u;
    } catch (_) {
      return u;
    }
  }

  function safeText(text) {
    const parser = window.EscrowParser;
    const s = String(text || "");
    if (parser?.redactSecrets) return parser.redactSecrets(s);
    return s;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === "className") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.slice(0, 2) === "on" && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : String(v));
    });
    (children || []).forEach((c) => c && node.appendChild(c));
    return node;
  }

  function placeDock(dock) {
    const footer = document.querySelector("footer, .foot");
    let lift = 0;
    if (footer) {
      const rect = footer.getBoundingClientRect();
      const overlap = Math.max(0, window.innerHeight - rect.top);
      if (overlap > 0) lift = overlap + 8;
    }
    document.querySelectorAll(".tips-memo, .tips-sheet").forEach((pop) => {
      if (!pop.getClientRects().length) return;
      const r = pop.getBoundingClientRect();
      const need = Math.max(0, window.innerHeight - r.top) + 8;
      if (need > lift) lift = need;
    });
    dock.style.setProperty("--qu1pu-dock-lift", lift + "px");
  }

  function appendLinks(msg, links, heading) {
    const ok = (links || []).filter((l) => isAllowedHref(l.href));
    if (!ok.length) return;
    const wrap = el("div", { className: "qu1pu-links" });
    wrap.appendChild(document.createTextNode(heading + " "));
    ok.forEach((lnk, i) => {
      if (i) wrap.appendChild(document.createTextNode(" · "));
      wrap.appendChild(el("a", {
        href: lnk.href,
        rel: "noopener",
        target: "_blank",
        text: lnk.label || lnk.href,
      }));
    });
    msg.appendChild(wrap);
  }

  function addMsg(log, role, text, extra) {
    const msg = el("div", { className: "qu1pu-msg " + role + (extra && extra.warn ? " warn" : "") });
    msg.appendChild(el("div", { className: "meta", text: role === "user" ? "you" : "QU1PU" }));
    msg.appendChild(el("div", { className: "body", text: safeText(text) }));
    if (extra) {
      const sources = (extra.sources || []).map(asSourceLink).filter(Boolean);
      const tools = (extra.tools || []).filter((l) => isAllowedHref(l && l.href));
      appendLinks(msg, sources, "Source:");
      appendLinks(msg, tools, "Optional tool:");
    }
    log.appendChild(msg);
    scrollLogToMessage(log, msg);
    return msg;
  }

  function asSourceLink(item) {
    if (!item) return null;
    if (typeof item === "string") {
      return isAllowedHref(item) ? { href: item, label: shortSourceLabel(item) } : null;
    }
    if (!isAllowedHref(item.href)) return null;
    return { href: item.href, label: item.label || shortSourceLabel(item.href) };
  }

  function scrollLogToMessage(log, msg) {
    const start = msg.previousElementSibling && msg.previousElementSibling.classList.contains("user")
      ? msg.previousElementSibling
      : msg;
    const rel = start.getBoundingClientRect().top - log.getBoundingClientRect().top + log.scrollTop;
    log.scrollTop = Math.max(0, rel - 8);
  }

  function sourceLabels(ans) {
    const list = (ans && (ans.sources || (ans.href ? [ans.href] : []))) || [];
    return list.map(asSourceLink).filter(Boolean);
  }

  function abstractQ() {
    const q = el("span", { className: "qu1pu-q", "aria-hidden": "true" });
    q.appendChild(el("span", { className: "qu1pu-q-ring" }));
    const pupil = el("span", { className: "qu1pu-q-pupil" });
    const tail = el("span", { className: "qu1pu-q-tail" });
    q.appendChild(pupil);
    q.appendChild(tail);
    q._pupil = pupil;
    q._tail = tail;
    return q;
  }

  function canWatchPointer() {
    if (reduceMotion()) return false;
    try {
      return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    } catch (_) {
      return false;
    }
  }

  function attachWatch(fab, qmark) {
    const pupil = qmark && qmark._pupil;
    const tail = qmark && qmark._tail;
    if (!pupil || !tail) return;
    const MAX = 4;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, active = false;

    function apply() {
      pupil.style.transform = "translate(" + cx.toFixed(2) + "px," + cy.toFixed(2) + "px)";
      const rot = 38 + (cx / MAX) * 6;
      tail.style.transform = "rotate(" + rot.toFixed(2) + "deg)";
    }
    function tick() {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      apply();
      if (Math.abs(tx - cx) > 0.08 || Math.abs(ty - cy) > 0.08) {
        raf = requestAnimationFrame(tick);
      } else {
        cx = tx;
        cy = ty;
        apply();
        raf = 0;
      }
    }
    function kick() {
      if (!raf) raf = requestAnimationFrame(tick);
    }
    function onMove(ev) {
      if (reduceMotion()) return;
      const isMouse = !ev.pointerType || ev.pointerType === "mouse";
      if (!isMouse) return;
      if (!canWatchPointer() && ev.pointerType !== "mouse") return;
      const r = fab.getBoundingClientRect();
      const mx = r.left + r.width / 2;
      const my = r.top + r.height / 2;
      let dx = ev.clientX - mx;
      let dy = ev.clientY - my;
      const dist = Math.hypot(dx, dy) || 1;
      const mag = Math.min(MAX, (MAX * Math.min(dist, 160)) / 160);
      tx = (dx / dist) * mag;
      ty = (dy / dist) * mag;
      active = true;
      kick();
    }
    function onLeave() {
      tx = 0;
      ty = 0;
      active = false;
      kick();
    }
    function bind() {
      if (!canWatchPointer()) {
        tx = ty = cx = cy = 0;
        pupil.style.transform = "";
        tail.style.transform = "";
        return;
      }
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      const ptr = window.matchMedia("(hover: hover) and (pointer: fine)");
      const onCh = function () { bind(); if (!canWatchPointer()) onLeave(); };
      if (mq.addEventListener) mq.addEventListener("change", onCh);
      if (ptr.addEventListener) ptr.addEventListener("change", onCh);
    } catch (_) {}
    bind();
  }

  function boot() {
    const faq = window.EscrowFAQ;
    if (!faq || typeof faq.answer !== "function") return;
    if (window.Qu1puDocs && typeof window.Qu1puDocs.load === "function") {
      window.Qu1puDocs.load().catch(function () {});
    }

    const log = el("div", { className: "qu1pu-log", id: "qu1pu-bubble-log", "aria-live": "polite" });
    const input = el("input", {
      id: "qu1pu-bubble-input",
      type: "text",
      autocomplete: "off",
      spellcheck: "false",
      placeholder: "Ask about XRPL or escrow…",
    });
    input.setAttribute("aria-label", "Ask QU1PU a question");
    const askBtn = el("button", { type: "button", text: "Ask" });
    const closeBtn = el("button", { type: "button", className: "qu1pu-close", "aria-label": "Close chat", text: "×" });
    const panel = el("div", {
      className: "qu1pu-panel",
      id: "qu1pu-bubble-panel",
      role: "dialog",
      "aria-label": "QU1PU chat",
      hidden: true,
    }, [
      el("div", { className: "qu1pu-head" }, [
        (function () {
          const mark = el("span", { className: "qu1pu-mark", "aria-hidden": "true" });
          mark.appendChild(abstractQ());
          return mark;
        })(),
        el("strong", { text: "QU1PU" }),
        el("div", { className: "qu1pu-head-links" }, [
          closeBtn,
        ]),
      ]),
      log,
      el("div", { className: "qu1pu-ask" }, [input, askBtn]),
    ]);
    const fab = el("button", {
      type: "button",
      className: "qu1pu-fab",
      id: "qu1pu-bubble-fab",
      "aria-label": "QU1PU",
      title: "QU1PU",
      "aria-expanded": "false",
      "aria-controls": "qu1pu-bubble-panel",
    });
    const fabQ = abstractQ();
    fab.appendChild(fabQ);
    const dock = el("div", { className: "qu1pu-dock", id: "qu1pu-dock" }, [panel, fab]);
    document.body.appendChild(dock);
    attachWatch(fab, fabQ);

    let open = false;
    const relocate = () => placeDock(dock);
    relocate();
    window.addEventListener("scroll", relocate, { passive: true });
    window.addEventListener("resize", relocate);
    const mo = new MutationObserver(relocate);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });

    function setOpen(next) {
      open = !!next;
      dock.classList.toggle("is-open", open);
      fab.setAttribute("aria-expanded", String(open));
      if (open) {
        panel.removeAttribute("hidden");
        if (!log.childNodes.length) {
          addMsg(log, "bot", "Ask about the XRP Ledger — payments, escrow, fees, reserves, and more. I’ll answer from official docs.");
        }
        input.focus();
      } else {
        panel.setAttribute("hidden", "");
        fab.focus();
      }
      relocate();
    }

    fab.addEventListener("click", () => setOpen(!open));
    closeBtn.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && open) setOpen(false);
    });

    async function ask() {
      const q = input.value.trim();
      if (!q) return;
      if (window.Qu1puDocs && typeof window.Qu1puDocs.load === "function") {
        try { await window.Qu1puDocs.load(); } catch (_) {}
      }
      const answerFn = (window.Qu1puDocs && window.Qu1puDocs.answer) || faq.answer;
      const ans = answerFn(q);
      if (!ans) return;
      if (ans.blocked || ans.hideUser) input.value = "";
      if (ans.hideUser) addMsg(log, "user", "[hidden — I won’t repeat that]");
      else addMsg(log, "user", q);
      if (typeof faq.logFaqLocal === "function") faq.logFaqLocal(q, ans);
      const delay = reduceMotion() ? 0 : 160;
      window.setTimeout(() => {
        addMsg(log, "bot", ans.a, {
          warn: !!(ans.refusal || ans.blocked || ans.injection),
          sources: sourceLabels(ans),
          tools: ans.tools || [],
        });
      }, delay);
      if (!ans.blocked && !ans.hideUser) input.value = "";
    }

    askBtn.addEventListener("click", () => ask());
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        ask();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
