(() => {
  "use strict";

  const PATH = String(location.pathname || "");
  if (/(?:^|\/)qu1pu(?:\/|$)/i.test(PATH)) return;

  const GUIDE = "https://b34n5.xyz/qu1pu/";
  const ALLOWED_SOURCE = ["https://xrpl.org/", "https://xrpl-ai.org/"];
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
      const sources = (extra.sources || []).filter(isAllowedHref).map((href) => ({ href, label: href }));
      const tools = (extra.tools || []).filter((l) => isAllowedHref(l && l.href));
      appendLinks(msg, sources, "Source:");
      appendLinks(msg, tools, "Optional tool:");
    }
    log.appendChild(msg);
    log.scrollTop = log.scrollHeight;
    return msg;
  }

  function sourceLabels(ans) {
    const faq = window.EscrowFAQ;
    if (faq && typeof faq.sourcesOf === "function") return faq.sourcesOf(ans);
    return (ans && (ans.sources || (ans.href ? [ans.href] : []))) || [];
  }

  function logoImg(cls) {
    const img = el("img", {
      className: cls || "",
      src: (function () {
        const s = document.querySelector('script[src*="qu1pu-bubble.js"]');
        const dir = s && s.src ? s.src.replace(/qu1pu-bubble\.js.*$/, "") : "./";
        return dir + "xrp-symbol-black.svg";
      })(),
      alt: "",
      width: "37",
      height: "32",
    });
    img.setAttribute("decoding", "async");
    return img;
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
          mark.appendChild(logoImg());
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
      "aria-label": "Ask QU1PU",
      "aria-expanded": "false",
      "aria-controls": "qu1pu-bubble-panel",
    });
    fab.appendChild(logoImg("qu1pu-fab-logo"));
    const dock = el("div", { className: "qu1pu-dock", id: "qu1pu-dock" }, [panel, fab]);
    document.body.appendChild(dock);

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
