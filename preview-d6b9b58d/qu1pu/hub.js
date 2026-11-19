(() => {
  "use strict";

  const cfg = window.QU1PU_HUB || { title: "QU1PU AI", topics: [] };
  const topics = cfg.topics || [];

  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, props, kids) {
    const n = document.createElement(tag);
    if (props) Object.keys(props).forEach((k) => {
      const v = props[k];
      if (v == null) return;
      if (k === "text") n.textContent = v;
      else if (k === "html") n.innerHTML = v;
      else if (k === "className") n.className = v;
      else if (k.slice(0, 2) === "on" && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in n && k !== "list") n[k] = v;
      else n.setAttribute(k, v);
    });
    (kids || []).forEach((c) => { if (c) n.appendChild(c); });
    return n;
  }

  function allowedHref(href) {
    const u = String(href || "");
    if (!u) return false;
    if (/^#/.test(u) || /^\.\/|^escrow\//.test(u)) return true;
    try {
      const url = new URL(u, location.href);
      if (url.origin === location.origin) {
        const here = (location.pathname.match(/^(.*\/preview-[^/]+)\//) || [])[1] || "";
        if (here && url.pathname.indexOf(here + "/qu1pu/") === 0) return true;
        if (!/preview-/i.test(url.pathname) && /\/qu1pu\/(?:escrow\/)?$/.test(url.pathname)) return true;
      }
    } catch (_) {}
    return [
      "https://xrpl.org/",
      "https://xrpl-ai.org/",
      "https://help.xaman.app/",
      "https://ripple.com/",
      "https://www.xrpl.foundation/"
    ].some((p) => u.indexOf(p) === 0);
  }

  function appendLinks(node, links, heading) {
    const ok = (links || []).filter((l) => l && allowedHref(l.href || l));
    if (!ok.length) return;
    const wrap = el("div", { className: "links" });
    wrap.appendChild(document.createTextNode(heading + " "));
    ok.forEach((item, i) => {
      if (i) wrap.appendChild(document.createTextNode(" · "));
      const href = typeof item === "string" ? item : item.href;
      const label = typeof item === "string" ? item : (item.label || item.href);
      const a = el("a", { href: href, rel: "noopener", text: label });
      if (/^https?:/i.test(href)) a.target = "_blank";
      a.addEventListener("click", (ev) => {
        const url = new URL(href, location.href);
        if (url.origin === location.origin && url.hash) {
          ev.preventDefault();
          if (url.hash !== location.hash) location.hash = url.hash;
          else openTopic(url.hash.replace(/^#/, ""), { focus: true });
        }
      });
      wrap.appendChild(a);
    });
    node.appendChild(wrap);
  }

  function addMsg(log, role, text, extra) {
    const msg = el("div", { className: "tmsg " + role + (extra && extra.warn ? " warn" : "") });
    msg.appendChild(el("div", { className: "meta", text: role === "user" ? "you" : "QU1PU" }));
    msg.appendChild(el("div", { className: "body", text: String(text || "") }));
    if (extra) {
      const sources = (extra.sources || []).map((s) => typeof s === "string" ? { href: s, label: s.replace(/^https:\/\/xrpl\.org\/docs\//, "") } : s);
      appendLinks(msg, sources, "Source:");
      const tools = extra.tools || [];
      const heading = tools.some((t) => /#(?:escrow|lending|vault)\b/.test((t && t.href) || "")) ? "Open topic:" : "Related:";
      appendLinks(msg, tools, heading);
    }
    log.appendChild(msg);
    msg.scrollIntoView({ block: "nearest" });
    return msg;
  }

  function currentId() {
    const h = (location.hash || "").replace(/^#/, "").toLowerCase();
    if (topics.some((t) => t.id === h)) return h;
    return "";
  }

  function openTopic(id, opts) {
    const want = String(id || "");
    topics.forEach((t) => {
      const tile = document.getElementById("tile-" + t.id);
      const tab = document.getElementById("tab-" + t.id);
      const on = t.id === want;
      if (tile) {
        tile.dataset.open = on ? "true" : "false";
        const body = $(".tile-body", tile);
        if (body) body.hidden = !on;
        const head = $(".tile-head", tile);
        if (head) head.setAttribute("aria-expanded", on ? "true" : "false");
      }
      if (tab) tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (want && location.hash.replace(/^#/, "") !== want) {
      history.replaceState(null, "", "#" + want);
    }
    if (!want && location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    if (opts && opts.focus && want) {
      const input = document.getElementById("ask-" + want);
      if (input) input.focus();
    }
  }

  function switchTo(id) {
    openTopic(id, { focus: true });
  }

  async function ask(topic, question) {
    const q = String(question || "").trim();
    const log = document.getElementById("log-" + topic.id);
    const input = document.getElementById("ask-" + topic.id);
    if (!q || !log) return;
    addMsg(log, "user", q);
    if (input) input.value = "";
    const docs = window.Qu1puDocs;
    if (docs && typeof docs.load === "function") {
      try { await docs.load(); } catch (_) {}
    }
    let ans = null;
    if (docs && typeof docs.answer === "function") {
      ans = docs.answer(q, { topic: topic.id });
    }
    if (!ans || !ans.a) {
      addMsg(log, "bot", "I can answer from the official XRP Ledger docs, but I don’t have a close match for that yet and I won’t invent one.");
      return;
    }
    if (ans.hideUser) {
      const last = log.querySelector(".tmsg.user:last-of-type");
      if (last) last.remove();
    }
    const extra = {
      sources: ans.sources || [],
      tools: ans.tools || [],
      warn: !!(ans.blocked || ans.warn)
    };
    addMsg(log, "bot", ans.a, extra);
  }


  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function flowGraphic(opts) {
    const pub = (opts && opts.pub) || "Public key";
    const pubNote = (opts && opts.pubNote) || "33 bytes";
    const prefix = (opts && opts.prefix) || "";
    const wrap = el("ol", { className: "key-flow", "aria-label": "Seed, private key, public key, then address" });
    [
      ["Seed", "16 bytes", "secret"],
      ["Private key", "32 bytes", "secret"],
      [pub, pubNote, "public"],
      ["Address", "public info", "public"]
    ].forEach((item, i) => {
      const li = el("li", { className: "key-flow-step key-flow-" + item[2] });
      if (i) li.setAttribute("data-arrow", "true");
      li.appendChild(el("span", { className: "key-flow-label", text: item[0] }));
      if (item[0] === pub && prefix) {
        const note = el("span", { className: "key-flow-note" });
        note.appendChild(el("span", { className: "key-ed-prefix", text: "0xED" }));
        note.appendChild(document.createTextNode(" "));
        note.appendChild(el("span", { className: "key-flow-sub", text: pubNote }));
        li.appendChild(note);
      } else {
        li.appendChild(el("span", { className: "key-flow-note", text: item[1] }));
      }
      wrap.appendChild(li);
    });
    return wrap;
  }

  function curveSvg(kind) {
    // Stylized neon curve, not a plot of the actual equation.
    const teal = "#2ee6d0";
    const green = "#3df58f";
    const d = kind === "ed25519"
      ? "M12 70 C 40 70, 48 18, 88 36 S 140 96, 188 28"
      : "M12 58 C 38 86, 58 12, 98 40 S 148 94, 188 22";
    const label = kind === "ed25519" ? "Ed25519" : "secp256k1";
    const svg = '<svg class="key-curve" viewBox="0 0 200 100" width="200" height="80" aria-hidden="true" focusable="false">'
      + '<defs><filter id="keyglow-' + kind + '" x="-20%" y="-20%" width="140%" height="140%">'
      + '<feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
      + '<path d="' + d + '" fill="none" stroke="' + teal + '" stroke-width="2.2" stroke-linecap="round" filter="url(#keyglow-' + kind + ')"/>'
      + '<circle cx="98" cy="40" r="4" fill="' + green + '"/>'
      + '<text x="8" y="16" fill="' + green + '" font-size="11" font-family="ui-monospace,monospace">' + label + "</text>"
      + "</svg>";
    const box = el("div", { className: "key-curve-wrap" });
    box.innerHTML = svg;
    return box;
  }

  function overviewGraphic() {
    const wrap = el("div", { className: "key-compare", "aria-label": "How public keys differ" });
    wrap.innerHTML = ""
      + '<div class="key-compare-row">'
      + '<span class="key-compare-name">secp256k1</span>'
      + '<span class="key-compare-bar">33-byte public key</span>'
      + "</div>"
      + '<div class="key-compare-row">'
      + '<span class="key-compare-name">Ed25519</span>'
      + '<span class="key-compare-bar"><span class="key-ed-prefix">0xED</span> + 32-byte public key</span>'
      + "</div>";
    return wrap;
  }

  function slideGraphic(kind) {
    const root = el("div", { className: "key-graphic" });
    if (kind === "overview") {
      root.appendChild(overviewGraphic());
    } else {
      root.appendChild(curveSvg(kind === "ed25519" ? "ed25519" : "secp256k1"));
      root.appendChild(flowGraphic(kind === "ed25519"
        ? { pub: "Public key", pubNote: "32-byte key", prefix: "0xED" }
        : { pub: "Public key", pubNote: "33 bytes" }));
    }
    return root;
  }

  function bindKeySlider(root) {
    const track = root.querySelector(".key-track");
    const slides = Array.prototype.slice.call(root.querySelectorAll(".key-slide"));
    const dots = Array.prototype.slice.call(root.querySelectorAll(".key-dot"));
    const status = root.querySelector(".key-slider-status");
    const prevBtn = root.querySelector(".key-prev");
    const nextBtn = root.querySelector(".key-next");
    if (!track || !slides.length) return;
    let index = 0;
    let startX = 0;
    let startY = 0;
    let tracking = false;

    function go(i, opts) {
      const n = slides.length;
      index = ((i % n) + n) % n;
      const reduce = reducedMotion();
      track.style.transition = reduce ? "none" : "transform .28s ease";
      track.style.transform = "translateX(-" + (index * 100) + "%)";
      slides.forEach((s, j) => {
        const on = j === index;
        s.dataset.active = on ? "true" : "false";
        s.setAttribute("aria-hidden", on ? "false" : "true");
        if (on) s.removeAttribute("inert");
        else s.setAttribute("inert", "");
      });
      dots.forEach((d, j) => {
        if (j === index) d.setAttribute("aria-current", "true");
        else d.removeAttribute("aria-current");
      });
      if (status) {
        const title = (slides[index].querySelector("h3") || {}).textContent || ("Slide " + (index + 1));
        status.textContent = title + ", " + (index + 1) + " of " + n;
      }
      if (opts && opts.focusTitle) {
        const h = slides[index].querySelector("h3");
        if (h) h.focus();
      }
    }

    if (prevBtn) prevBtn.addEventListener("click", () => go(index - 1));
    if (nextBtn) nextBtn.addEventListener("click", () => go(index + 1));
    dots.forEach((d, j) => d.addEventListener("click", () => go(j)));

    root.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowRight") { ev.preventDefault(); go(index + 1); }
      else if (ev.key === "ArrowLeft") { ev.preventDefault(); go(index - 1); }
      else if (ev.key === "Home") { ev.preventDefault(); go(0); }
      else if (ev.key === "End") { ev.preventDefault(); go(slides.length - 1); }
    });

    const frame = root.querySelector(".key-frame") || root;
    frame.addEventListener("pointerdown", (ev) => {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      if (ev.target.closest && ev.target.closest("button, a, summary")) return;
      tracking = true;
      startX = ev.clientX;
      startY = ev.clientY;
      try { frame.setPointerCapture(ev.pointerId); } catch (_) {}
    });
    frame.addEventListener("pointerup", (ev) => {
      if (!tracking) return;
      tracking = false;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) {
        go(index + (dx < 0 ? 1 : -1));
      }
    });
    frame.addEventListener("pointercancel", () => { tracking = false; });

    go(0);
  }

  function sourceWrap(srcs) {
    const srcwrap = el("p", { className: "teach-sources" });
    if (!srcs.length) return srcwrap;
    srcwrap.appendChild(document.createTextNode(srcs.length === 1 ? "Source: " : "Sources: "));
    srcs.forEach((s, i) => {
      if (i) srcwrap.appendChild(document.createTextNode(" · "));
      const href = typeof s === "string" ? s : s.href;
      const label = typeof s === "string" ? s.replace(/^https:\/\/xrpl\.org\/docs\//, "") : (s.label || s.href);
      if (allowedHref(href)) {
        srcwrap.appendChild(el("a", { href: href, rel: "noopener", target: "_blank", text: label }));
      }
    });
    return srcwrap;
  }

  function renderTeachBody(text) {
    const body = el("div", { className: "teach-body" });
    String(text || "").split(/\n\n/).forEach((para) => {
      const p = para.trim();
      if (p) body.appendChild(el("p", { text: p }));
    });
    return body;
  }

  function renderKeySlider(card) {
    const slides = card.slides || [];
    const root = el("div", {
      className: "key-slider",
      id: "keys-slider",
      role: "region",
      tabindex: "0",
      "aria-roledescription": "carousel",
      "aria-label": "Cryptographic key types"
    });
    const track = el("div", { className: "key-track" });
    slides.forEach((s, i) => {
      const title = s.title || ("Slide " + (i + 1));
      const slide = el("div", {
        className: "key-slide",
        role: "group",
        "aria-roledescription": "slide",
        "aria-label": (i + 1) + " of " + slides.length + ": " + title,
        "data-id": s.id || String(i),
        "data-index": String(i)
      });
      const heading = el("h3", { text: title, id: "keys-slide-title-" + (s.id || i), tabindex: "-1" });
      if (s.kicker) slide.appendChild(el("p", { className: "key-slide-kicker", text: s.kicker }));
      slide.appendChild(heading);
      slide.appendChild(slideGraphic(s.graphic || s.id));
      (s.lines || []).forEach((line) => {
        slide.appendChild(el("p", { className: "key-slide-line", text: line }));
      });
      track.appendChild(slide);
    });
    const frame = el("div", { className: "key-frame" }, [track]);
    const dots = el("div", { className: "key-dots", role: "group", "aria-label": "Choose a key-type slide" });
    slides.forEach((s, i) => {
      const dot = el("button", {
        type: "button",
        className: "key-dot",
        "data-index": String(i),
        "aria-label": "Show slide " + (i + 1) + " of " + slides.length + ": " + (s.title || "")
      });
      dots.appendChild(dot);
    });
    const controls = el("div", { className: "key-controls" }, [
      el("button", { type: "button", className: "key-nav key-prev", "aria-label": "Previous slide", text: "‹" }),
      dots,
      el("button", { type: "button", className: "key-nav key-next", "aria-label": "Next slide", text: "›" })
    ]);
    const status = el("div", { className: "key-slider-status visually-hidden", "aria-live": "polite", "aria-atomic": "true" });
    root.appendChild(frame);
    root.appendChild(controls);
    root.appendChild(status);
    bindKeySlider(root);
    return root;
  }

  function render() {
    const lede = document.getElementById("hub-lede");
    if (lede) lede.textContent = cfg.lede || "";
    const tabs = document.getElementById("topic-tabs");
    const list = document.getElementById("tiles");
    if (!tabs || !list) return;
    tabs.innerHTML = "";
    list.innerHTML = "";
    topics.forEach((t, i) => {
      const tab = el("button", {
        type: "button",
        className: "topic-tab",
        id: "tab-" + t.id,
        role: "tab",
        text: t.title,
        "aria-controls": "tile-" + t.id,
        "aria-selected": "false"
      });
      tab.addEventListener("click", () => switchTo(t.id));
      tabs.appendChild(tab);

      const head = el("button", {
        type: "button",
        className: "tile-head",
        id: "head-" + t.id,
        "aria-expanded": "false",
        "aria-controls": "body-" + t.id
      });
      head.appendChild(el("div", { className: "tile-titles" }, [
        el("p", { className: "tile-kicker", text: t.kicker || "" }),
        el("h2", { text: t.title, id: "title-" + t.id }),
        el("p", { className: "tile-blurb", text: t.blurb || "" })
      ]));
      head.appendChild(el("span", { className: "tile-chevron", "aria-hidden": "true", text: "▾" }));
      head.addEventListener("click", () => {
        const open = document.getElementById("tile-" + t.id);
        if (open && open.dataset.open === "true") switchTo("");
        else switchTo(t.id);
      });

      const bodyKids = [];
      if (t.caveat) {
        const cav = el("p", { className: "caveat", text: t.caveat + " " });
        (t.caveatSources || []).slice(0, 2).forEach((href, idx) => {
          if (idx) cav.appendChild(document.createTextNode(" · "));
          cav.appendChild(el("a", { href: href, rel: "noopener", target: "_blank", text: idx ? "Known amendments" : "Official docs" }));
          if (idx === 0 && (t.caveatSources || [])[1]) {
            // labels: first official concept page, then known amendments if present
          }
        });
        // Fix labels properly
        cav.textContent = t.caveat + " ";
        const srcs = t.caveatSources || [];
        srcs.forEach((href, idx) => {
          if (idx) cav.appendChild(document.createTextNode(" · "));
          const label = /known-amendments/.test(href) ? "Known amendments" : "Official docs";
          cav.appendChild(el("a", { href: href, rel: "noopener", target: "_blank", text: label }));
        });
        bodyKids.push(cav);
      }
      if (t.intro) bodyKids.push(el("p", { className: "tile-intro", text: t.intro }));

      const log = el("div", { className: "topic-log", id: "log-" + t.id, "aria-live": "polite" });
      const input = el("input", {
        type: "text",
        id: "ask-" + t.id,
        placeholder: "Ask a " + t.title.replace(/^QU1PU\s+/i, "") + " question…",
        autocomplete: "off"
      });
      input.setAttribute("aria-label", "Ask a question about " + t.title);
      const btn = el("button", { type: "button", className: "primary", id: "btn-" + t.id, text: "Ask" });
      const go = () => ask(t, input.value);
      btn.addEventListener("click", go);
      input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") go(); });
      const chat = el("div", { className: "topic-chat" }, [
        log,
        el("div", { className: "topic-ask" }, [input, btn])
      ]);
      bodyKids.push(chat);

      if (t.assistant) {
        bodyKids.push(el("a", {
          className: "open-assist",
          href: t.assistant.page,
          text: t.assistant.openLabel || "Open the assistant"
        }));
        bodyKids.push(el("iframe", {
          className: "assist-frame",
          src: t.assistant.src,
          title: t.assistant.title || "Assistant",
          id: "frame-" + t.id,
          loading: "lazy"
        }));
      }

      const body = el("div", { className: "tile-body", id: "body-" + t.id, hidden: true }, bodyKids);
      const tile = el("section", {
        className: "tile",
        id: "tile-" + t.id,
        "data-topic": t.id,
        "aria-labelledby": "title-" + t.id
      }, [head, body]);
      tile.dataset.open = "false";
      list.appendChild(tile);
    });

    const cardsHost = document.getElementById("teach-cards");
    if (cardsHost) {
      cardsHost.innerHTML = "";
      (cfg.cards || []).forEach((card) => {
        const kids = [
          el("p", { className: "tile-kicker", text: card.kicker || "" }),
          el("h2", { text: card.title, id: "title-card-" + card.id })
        ];
        if (card.slides && card.slides.length) {
          kids.push(renderKeySlider(card));
          if (card.reminder) kids.push(el("p", { className: "key-reminder", text: card.reminder }));
          const more = el("details", { className: "teach-more", id: "keys-learn-more" });
          more.appendChild(el("summary", { text: "Learn more" }));
          more.appendChild(renderTeachBody(card.body));
          more.appendChild(sourceWrap(card.sources || []));
          kids.push(more);
        } else {
          kids.push(renderTeachBody(card.body));
          kids.push(sourceWrap(card.sources || []));
        }
        cardsHost.appendChild(el("section", {
          className: "teach-card",
          id: "card-" + card.id,
          "aria-labelledby": "title-card-" + card.id
        }, kids));
      });
    }

    openTopic(currentId());
    if ((location.hash || "").replace(/^#/, "") === "keys") {
      const card = document.getElementById("card-keys");
      if (card) card.scrollIntoView({ block: "start" });
    }
  }

  window.addEventListener("hashchange", () => openTopic(currentId(), { focus: true }));

  render();

  if (window.Qu1puDocs && typeof window.Qu1puDocs.load === "function") {
    window.Qu1puDocs.load();
  }
})();
