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

    openTopic(currentId());
  }

  window.addEventListener("hashchange", () => openTopic(currentId(), { focus: true }));

  render();

  if (window.Qu1puDocs && typeof window.Qu1puDocs.load === "function") {
    window.Qu1puDocs.load();
  }
})();
