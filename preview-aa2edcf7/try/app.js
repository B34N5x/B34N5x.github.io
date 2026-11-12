/* Unlisted XRPL Explainer preview: Testnet demo + draft review.
   Never asks for seeds. Never signs for the user. Demo wallets stay in memory only. */
(function () {
  "use strict";

  var TESTNET = ["wss://s.altnet.rippletest.net:51233", "wss://testnet.xrpl-labs.com"];
  var MAINNET = ["wss://xrplcluster.com", "wss://s1.ripple.com"];
  var FAUCET = "https://faucet.altnet.rippletest.net/accounts";
  var DEMO_DROPS = "1000000"; /* fixed Testnet practice amount, not a suggestion */
  var STEPS = ["intro", "diagram", "demo", "viewer", "ask", "compose", "review", "sign"];
  var DIAGRAM_MS = [0, 900, 2000, 3200, 4300];
  var DIAGRAM_STAGES = ["sender", "network", "ledger", "dest", "fee"];
  var CAPTIONS = {
    sender: "The sender starts a payment and signs it in their own wallet.",
    network: "The network of validators shares the transaction and votes on the next ledger.",
    ledger: "When a ledger closes, the payment is validated and becomes final.",
    dest: "The destination receives the amount.",
    fee: "A tiny fee is burned — destroyed, not paid to a person. A validated payment cannot be reversed."
  };

  var state = {
    step: "intro",
    network: "testnet",
    demo: null,
    draft: null,
    feeDrops: null,
    aborted: false,
    runningDemo: false,
    timers: []
  };

  var live = {
    client: null,
    url: "",
    host: "",
    lastLedger: null,
    lastCloseRipple: null,
    lastCloseMs: null,
    prevCloseMs: null,
    validations: {},
    currentValLedger: null,
    pendingHash: null,
    sawProposed: false,
    startedAt: null,
    bound: false,
    handlers: null,
    ambientTimer: null,
    valTimer: null,
    hidden: false
  };

  function hostOf(url) {
    try { return new URL(url).host; } catch (e) { return url || ""; }
  }

  function shortKey(k) {
    if (!k || k.length < 10) return k || "";
    return k.slice(0, 6) + "…" + k.slice(-4);
  }

  function reducedMotion() {
    return document.body.classList.contains("reduce-motion") ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function setLiveLine(msg) { text($("live-line"), msg); }

  function updateAmbient() {
    if (state.network !== "mainnet") {
      var ambient = $("live-ambient");
      if (ambient) ambient.hidden = false;
    }
    if (state.network === "mainnet") {
      setLiveLine("Live closes are Testnet-only. Switch back to watch them.");
      return;
    }
    if (!live.host && !live.lastLedger) {
      setLiveLine("Connecting to Testnet…");
      return;
    }
    var parts = [];
    if (live.lastLedger != null) {
      var ago = live.lastCloseMs ? ((Date.now() - live.lastCloseMs) / 1000) : null;
      var agoTxt = ago != null ? ago.toFixed(1) + "s ago" : "";
      parts.push("Ledger " + live.lastLedger + (agoTxt ? " · " + agoTxt : ""));
    } else {
      parts.push("Live Testnet");
    }
    if (live.host) parts.push(live.host);
    setLiveLine(parts.join(" · "));
    updateLedgerLabels();
  }

  function updateLedgerLabels() {
    var label = live.lastLedger != null ? ("ledger " + live.lastLedger) : "waiting for a close";
    document.querySelectorAll(".d-live-ledger").forEach(function (el) { text(el, label); });
  }

  function pulseLedgerNodes() {
    if (live.hidden || reducedMotion()) return;
    document.querySelectorAll('.d-group[data-stage="ledger"] .d-node').forEach(function (n) {
      n.classList.add("on", "pulse");
      later(function () { n.classList.remove("pulse"); }, 800);
    });
  }

  function renderValidations() {
    var idx = live.currentValLedger;
    var bucket = idx != null ? live.validations[idx] : null;
    var count = bucket ? Object.keys(bucket.keys).length : 0;
    var order = bucket ? bucket.order : [];
    var cap = 8;
    var countEl = $("val-count");
    if (countEl) {
      if (!count) {
        text(countEl, live.pendingHash
          ? "Waiting for validations…"
          : "Waiting for a payment.");
      } else {
        text(countEl, count + " validations · ledger " + idx);
      }
    }
    var ul = $("val-keys");
    if (ul) {
      ul.replaceChildren();
      order.slice(0, cap).forEach(function (k) {
        var li = document.createElement("li");
        text(li, shortKey(k));
        ul.appendChild(li);
      });
      if (order.length > cap) {
        var more = document.createElement("li");
        text(more, "+" + (order.length - cap) + " more");
        ul.appendChild(more);
      }
    }
    var valLabel = count ? (count + " validations") : "validators vote";
    document.querySelectorAll(".d-live-vals").forEach(function (el) { text(el, valLabel); });
    var sats = document.querySelectorAll("#demo-diagram .d-sat");
    sats.forEach(function (sat, i) {
      sat.classList.toggle("on", i < Math.min(count, sats.length));
    });
  }

  function scheduleValRender() {
    if (live.valTimer) return;
    live.valTimer = setTimeout(function () {
      live.valTimer = null;
      if (!live.hidden) renderValidations();
    }, 180);
  }

  function addTrack(line, kind) {
    var ol = $("live-track");
    if (!ol) return;
    var li = document.createElement("li");
    var span = document.createElement("span");
    text(span, line);
    li.appendChild(span);
    if (kind) {
      var tag = document.createElement("span");
      tag.className = kind === "illust" ? "tag-illust" : "tag-real";
      text(tag, kind === "illust" ? "illus." : "real");
      li.appendChild(tag);
    }
    ol.appendChild(li);
  }

  function handleLedgerClosed(msg) {
    if (!msg) return;
    var idx = msg.ledger_index != null ? Number(msg.ledger_index) : null;
    if (idx == null || isNaN(idx)) return;
    live.prevCloseMs = live.lastCloseMs;
    live.lastLedger = idx;
    live.lastCloseRipple = msg.ledger_time != null ? msg.ledger_time : live.lastCloseRipple;
    live.lastCloseMs = Date.now();
    updateAmbient();
    pulseLedgerNodes();
    globeCall("onLedgerClosed", { index: idx, time: live.lastCloseRipple });
    /* Drop stale validation buckets to keep memory light */
    Object.keys(live.validations).forEach(function (k) {
      if (Number(k) < idx - 2) delete live.validations[k];
    });
  }

  function handleValidation(msg) {
    if (!msg) return;
    var idx = msg.ledger_index != null ? Number(msg.ledger_index) : null;
    var key = msg.validation_public_key || msg.public_key || msg.validationPublicKey || "";
    if (idx == null || isNaN(idx) || !key) return;
    /* Ignore indexes that cannot belong to the current Testnet close (bad or stale fields). */
    if (live.lastLedger != null && (idx > live.lastLedger + 5 || idx < live.lastLedger - 2)) return;
    if (live.lastLedger == null && (idx < 1 || idx > 1e9)) return;
    if (!live.validations[idx]) live.validations[idx] = { keys: {}, order: [] };
    var bucket = live.validations[idx];
    if (!bucket.keys[key]) {
      bucket.keys[key] = true;
      bucket.order.push(key);
    }
    /* Prefer the in-progress ledger (usually last closed + 1) */
    if (live.lastLedger == null || idx >= live.lastLedger) live.currentValLedger = idx;
    scheduleValRender();
    globeCall("onValidation", { key: key, ledger: idx });
  }

  function handleProposed(msg) {
    if (!live.pendingHash || !msg) return;
    var tx = msg.transaction || msg.tx_json || msg;
    var hash = (tx && (tx.hash || tx.Hash)) || msg.hash;
    if (!hash) return;
    if (String(hash).toUpperCase() !== String(live.pendingHash).toUpperCase()) return;
    if (live.sawProposed) return;
    live.sawProposed = true;
    var svg = diagramRoot("demo");
    setStage(svg, "network", false);
    addTrack("The connected server has seen this payment as proposed (not yet final).", "real");
    globeCall("onProposed", { hash: hash });
    setStatus("Payment is proposed on " + (live.host || "Testnet") + "…");
  }

  function attachLiveHandlers(client) {
    if (live.bound) return;
    live.bound = true;
    live.handlers = {
      ledger: function (m) { handleLedgerClosed(m); },
      val: function (m) { handleValidation(m); },
      tx: function (m) { handleProposed(m); }
    };
    var target = (typeof client.on === "function") ? client : client.connection;
    if (!target || typeof target.on !== "function") return;
    target.on("ledgerClosed", live.handlers.ledger);
    target.on("validationReceived", live.handlers.val);
    target.on("transaction", live.handlers.tx);
  }

  async function ensureLiveStream() {
    if (state.network !== "testnet") return null;
    if (live.client && live.client.isConnected && live.client.isConnected()) return live.client;
    if (live.client && live.client.isConnected === true) return live.client;
    var client = await connectClient("testnet", { reuse: false, forLive: true });
    live.client = client;
    live.url = client.url || "";
    live.host = hostOf(live.url);
    try {
      await client.request({ command: "subscribe", streams: ["ledger", "validations", "transactions_proposed"] });
    } catch (e) {
      setLiveLine("Connected to " + live.host + ", but the live stream could not subscribe. " + (e.message || ""));
      return client;
    }
    attachLiveHandlers(client);
    updateAmbient();
    if (!live.ambientTimer) {
      live.ambientTimer = setInterval(function () {
        if (!live.hidden) updateAmbient();
      }, 1000);
    }
    return client;
  }

  async function stopLiveStream() {
    if (live.ambientTimer) { clearInterval(live.ambientTimer); live.ambientTimer = null; }
    if (live.valTimer) { clearTimeout(live.valTimer); live.valTimer = null; }
    var client = live.client;
    live.client = null;
    live.bound = false;
    live.handlers = null;
    live.url = "";
    live.host = "";
    if (client) {
      try { await client.disconnect(); } catch (e) { /* ignore */ }
    }
  }

  function $(id) { return document.getElementById(id); }
  function globeCall(name, payload) {
    var g = window.LiveGlobe;
    if (g && g.ok && typeof g[name] === "function") g[name](payload);
  }
  function syncGlobeVisibility(step) {
    var on = (step === "intro" || step === "diagram" || step === "demo");
    var supported = window.LiveGlobe && window.LiveGlobe.ok;
    document.body.classList.toggle("globe-on", !!(supported && on));
    globeCall("setVisible", on && supported);
  }
  function text(el, value) { if (el) el.textContent = value == null ? "" : String(value); }
  function showErr(id, msg) { var el = $(id); if (!el) return; el.hidden = !msg; text(el, msg || ""); }
  function setStatus(msg) { text($("status"), msg || ""); }

  function forgetWallet(w) {
    if (!w) return;
    try {
      if ("seed" in w) w.seed = "";
      if ("privateKey" in w) w.privateKey = "";
    } catch (e) { /* ignore */ }
  }

  function shortAddr(a) {
    if (!a || a.length < 12) return a || "";
    return a.slice(0, 6) + "…" + a.slice(-5);
  }

  function isClassic(addr) {
    if (window.xrpl && typeof xrpl.isValidClassicAddress === "function") {
      return xrpl.isValidClassicAddress(addr);
    }
    return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(addr || "");
  }

  function dropsToXrp(d) {
    if (window.xrpl && typeof xrpl.dropsToXrp === "function") return xrpl.dropsToXrp(String(d));
    return String(Number(d) / 1e6);
  }

  function xrpToDrops(x) {
    if (window.xrpl && typeof xrpl.xrpToDrops === "function") return xrpl.xrpToDrops(String(x));
    var n = Number(x);
    if (!isFinite(n)) throw new Error("Enter a valid amount.");
    return String(Math.round(n * 1e6));
  }

  function unixToRipple(ms) {
    return Math.floor(ms / 1000) - 946684800;
  }

  function rippleToIso(rt) {
    var d = new Date((Number(rt) + 946684800) * 1000);
    return isNaN(d.getTime()) ? "—" : d.toISOString().replace("T", " ").replace(".000Z", " UTC");
  }

  function explorerTx(hash) {
    if (!/^[A-Fa-f0-9]{64}$/.test(hash || "")) return "";
    var host = state.network === "mainnet" ? "https://livenet.xrpl.org/transactions/" : "https://testnet.xrpl.org/transactions/";
    return host + hash;
  }

  function clearTimers() {
    state.timers.forEach(function (t) { clearTimeout(t); });
    state.timers = [];
  }

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    state.timers.push(id);
    return id;
  }

  function mountDiagrams() {
    var tpl = $("diagram-template");
    if (!tpl) return;
    ["diagram-wrap", "demo-diagram"].forEach(function (id) {
      var host = $(id);
      if (!host) return;
      host.replaceChildren();
      host.appendChild(tpl.content.cloneNode(true));
    });
  }

  function diagramRoot(which) {
    var host = $(which === "demo" ? "demo-diagram" : "diagram-wrap");
    return host ? host.querySelector("svg") : null;
  }

  function resetDiagram(svg) {
    if (!svg) return;
    svg.querySelectorAll(".d-group").forEach(function (g) { g.classList.remove("on", "done"); });
    svg.querySelectorAll(".d-node").forEach(function (n) { n.classList.remove("on", "done"); });
    svg.querySelectorAll(".d-path").forEach(function (p) { p.classList.remove("on"); });
    var tok = svg.querySelector(".d-token");
    if (tok) tok.className.baseVal = "d-token";
  }

  function setStage(svg, stage, done) {
    if (!svg || !stage) return;
    var g = svg.querySelector('.d-group[data-stage="' + stage + '"]');
    if (g) {
      g.classList.add("on");
      if (done) g.classList.add("done");
      var node = g.querySelector(".d-node");
      if (node) {
        node.classList.add("on");
        if (done) node.classList.add("done");
      }
    }
    var pathMap = { network: "to-net", ledger: "to-led", dest: "to-dst", fee: "to-fee" };
    var pid = pathMap[stage];
    if (pid) {
      var path = svg.querySelector('.d-path[data-path="' + pid + '"]');
      if (path) path.classList.add("on");
    }
    var tok = svg.querySelector(".d-token");
    if (tok) {
      tok.classList.remove("at-sender", "at-network", "at-ledger", "at-dest", "at-fee");
      tok.classList.add("at-" + stage, "visible");
    }
  }

  function playDiagram(kind) {
    /* Teaching map + live ledger pulse. No canned token flight — the demo is driven by the stream. */
    var svg = diagramRoot(kind);
    if (!svg) return;
    var cap = $("diagram-caption");
    if (cap && kind !== "demo") {
      var liveBit = live.lastLedger != null
        ? (" Latest closed ledger is " + live.lastLedger + " (real).")
        : " Waiting for the first live close.";
      text(cap, "This map stays linked to the live Testnet stream." + liveBit + " The hop lines are illustrative. The next step follows one payment in real time.");
    }
    updateLedgerLabels();
    ensureLiveStream().catch(function (e) {
      setLiveLine(e.message || "Could not start the Testnet stream.");
    });
  }

  function showPanel(name) {
    document.querySelectorAll(".panel").forEach(function (p) {
      var on = p.getAttribute("data-panel") === name;
      p.hidden = !on;
      p.classList.remove("is-on");
      if (on) {
        void p.offsetWidth;
        p.classList.add("is-on");
      }
    });
    var rail = $("steps-rail");
    if (rail) {
      var idx = STEPS.indexOf(name);
      rail.querySelectorAll("li").forEach(function (li) {
        var s = li.getAttribute("data-step");
        var i = STEPS.indexOf(s);
        li.classList.toggle("on", s === name);
        li.classList.toggle("done", idx >= 0 && i >= 0 && i < idx);
      });
    }
    state.step = name;
    document.body.setAttribute("data-step", name);
    var back = $("btn-back");
    var next = $("btn-next");
    var skip = $("btn-skip");
    var cancel = $("btn-cancel");
    var atEnd = name === "done" || name === "cancelled";
    if (back) back.disabled = name === "intro" || atEnd;
    if (skip) skip.hidden = atEnd || name === "ask" || name === "sign" || name === "review";
    if (next) {
      next.hidden = atEnd || name === "ask" || name === "sign";
      text(next, name === "review" ? "Continue to sign" : name === "compose" ? "Review draft" : name === "demo" ? "Continue" : "Next");
    }
    if (cancel) cancel.hidden = atEnd;
    if (name === "intro" || name === "diagram" || name === "demo" || name === "viewer") {
      ensureLiveStream().catch(function (e) { setLiveLine(e.message || "Could not start the Testnet stream."); });
    }
    if (name === "diagram") playDiagram("diagram");
    if (name === "demo") {
      var warn = $("demo-mainnet-warn");
      if (warn) warn.hidden = state.network !== "mainnet";
      var run = $("btn-run-demo");
      if (run) run.disabled = state.network !== "testnet" || state.runningDemo;
      if (!state.demo) resetDiagram(diagramRoot("demo"));
    }
    if (name === "viewer") renderViewer();
    if (name === "compose") syncComposeNet();
    if (name === "review") renderReview();
    if (name === "sign") renderSign();
    syncGlobeVisibility(name);
    window.scrollTo(0, 0);
  }

  function syncComposeNet() {
    var el = $("compose-net");
    if (!el) return;
    el.setAttribute("data-net", state.network);
    text(el, "Network: " + (state.network === "mainnet" ? "Mainnet (real ledger)" : "Testnet (practice ledger)"));
  }

  function setNetwork(net) {
    state.network = net === "mainnet" ? "mainnet" : "testnet";
    var badge = $("net-badge");
    if (badge) {
      badge.setAttribute("data-net", state.network);
      text(badge, state.network === "mainnet" ? "Mainnet" : "Testnet");
    }
    var tog = $("net-toggle");
    if (tog) {
      tog.setAttribute("aria-pressed", state.network === "mainnet" ? "true" : "false");
      text(tog, state.network === "mainnet" ? "Switch to Testnet" : "Switch to Mainnet");
    }
    syncComposeNet();
    var warn = $("demo-mainnet-warn");
    if (warn) warn.hidden = state.network !== "mainnet";
    var run = $("btn-run-demo");
    if (run) run.disabled = state.network !== "testnet" || state.runningDemo;
    if (state.step === "review") renderReview();
    if (state.network === "testnet") {
      ensureLiveStream().catch(function (e) { setLiveLine(e.message || "Could not start the Testnet stream."); });
    } else {
      stopLiveStream();
      updateAmbient();
    }
  }

  async function connectClient(network, opts) {
    if (!window.xrpl || typeof xrpl.Client !== "function") {
      throw new Error("The ledger library failed to load.");
    }
    opts = opts || {};
    if (network === "testnet" && !opts.forLive && live.client && typeof live.client.isConnected === "function" && live.client.isConnected()) {
      return live.client;
    }
    var urls = network === "mainnet" ? MAINNET : TESTNET;
    var wantId = network === "mainnet" ? 0 : 1;
    var last = null;
    for (var i = 0; i < urls.length; i++) {
      var client = new xrpl.Client(urls[i]);
      try {
        await client.connect();
        var info = await client.request({ command: "server_info" });
        var nid = info.result.info.network_id;
        if (nid !== wantId) {
          await client.disconnect();
          last = new Error("Connected server was not the expected network.");
          continue;
        }
        return client;
      } catch (e) {
        last = e;
        try { await client.disconnect(); } catch (e2) { /* ignore */ }
      }
    }
    throw last || new Error("Could not reach the ledger. Check your connection and try again.");
  }

  async function fundAddress(address) {
    var res = await fetch(FAUCET, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: address })
    });
    if (!res.ok) {
      throw new Error("The Testnet faucet is busy or unavailable. Wait a moment and try again.");
    }
    return res.json();
  }

  async function waitFunded(client, address) {
    var tries = 0;
    while (tries < 16) {
      if (state.aborted) throw new Error("cancelled");
      try {
        var info = await client.request({ command: "account_info", account: address, ledger_index: "validated" });
        if (info && info.result && info.result.account_data) return info;
      } catch (e) { /* not funded yet */ }
      await new Promise(function (resolve, reject) {
        var start = Date.now();
        var id = setInterval(function () {
          if (state.aborted) { clearInterval(id); reject(new Error("cancelled")); }
          else if (Date.now() - start >= 1500) { clearInterval(id); resolve(); }
        }, 100);
      });
      tries += 1;
    }
    throw new Error("The faucet credited the demo wallet, but it is not visible on the ledger yet. Try again.");
  }

  function appendMeta(id, line) {
    var el = $(id);
    if (!el) return;
    el.replaceChildren();
    var p = document.createElement("div");
    text(p, line);
    el.appendChild(p);
  }

  async function runDemo() {
    if (state.runningDemo) return;
    if (state.network !== "testnet") {
      setStatus("Switch back to Testnet to run the demo.");
      return;
    }
    state.aborted = false;
    state.runningDemo = true;
    live.pendingHash = null;
    live.sawProposed = false;
    live.startedAt = Date.now();
    var run = $("btn-run-demo");
    if (run) run.disabled = true;
    var meta = $("demo-meta");
    if (meta) meta.replaceChildren();
    var track = $("live-track");
    if (track) track.replaceChildren();
    var svg = diagramRoot("demo");
    resetDiagram(svg);
    renderValidations();
    setStatus("Creating demo-only Testnet wallets…");
    appendMeta("demo-meta", "Creating throwaway Testnet wallets…");

    var sender = null;
    var dest = null;
    var client = null;
    try {
      client = await ensureLiveStream();
      if (!client) client = await connectClient("testnet");
      var host = live.host || hostOf(client.url) || "the connected Testnet server";

      sender = xrpl.Wallet.generate();
      dest = xrpl.Wallet.generate();
      var fromAddr = sender.classicAddress;
      var toAddr = dest.classicAddress;
      appendMeta("demo-meta", shortAddr(fromAddr) + " → " + shortAddr(toAddr));
      setStage(svg, "sender", false);
      addTrack("Demo wallets created in this browser. About to submit to " + host + ".", "real");

      if (state.aborted) throw new Error("cancelled");
      setStatus("Asking the public Testnet faucet for play funds…");
      appendMeta("demo-meta", "Asking the public faucet for play funds.");
      await fundAddress(fromAddr);
      await waitFunded(client, fromAddr);
      if (state.aborted) throw new Error("cancelled");

      setStatus("Submitting the demo payment to " + host + "…");
      appendMeta("demo-meta", "Submitting a practice payment.");

      var prepared = await client.autofill({
        TransactionType: "Payment",
        Account: fromAddr,
        Destination: toAddr,
        Amount: DEMO_DROPS
      });
      var signed = sender.sign(prepared);
      live.pendingHash = signed.hash;
      live.sawProposed = false;
      live.startedAt = Date.now();
      forgetWallet(sender);
      forgetWallet(dest);
      sender = null;
      dest = null;

      addTrack("Submitted to " + host + " (the server this page is actually connected to).", "real");
      globeCall("onSubmit", { hash: signed.hash, host: host });
      setStage(svg, "sender", false);
      if (!reducedMotion()) {
        setStage(svg, "network", false);
        addTrack("Showing a simple hop from the sender to the network. This path is illustrative — we cannot see the real peer routing.", "illust");
      } else {
        setStage(svg, "network", false);
        addTrack("Relay path skipped (reduced motion). Real peer routing is not visible anyway.", "illust");
      }

      var result = await client.submitAndWait(signed.tx_blob);
      if (state.aborted && !(result && result.result && result.result.meta)) {
        throw new Error("cancelled");
      }
      var tx = result.result;
      var tes = (tx.meta && tx.meta.TransactionResult) || tx.engine_result || "";
      if (tes !== "tesSUCCESS") {
        throw new Error("The demo payment did not succeed (" + tes + "). Try again.");
      }

      var elapsed = ((Date.now() - live.startedAt) / 1000).toFixed(1);
      var ledgerIndex = tx.ledger_index;
      var closeTime = null;
      try {
        var led = await client.request({ command: "ledger", ledger_index: ledgerIndex });
        closeTime = led.result.ledger.close_time;
      } catch (e) { /* optional */ }
      if (closeTime == null && live.lastLedger === ledgerIndex) closeTime = live.lastCloseRipple;

      if (!live.sawProposed) {
        addTrack("The payment was not observed on the proposed stream before it closed, but it has now validated.", "real");
      }
      setStage(svg, "ledger", false);
      addTrack("Ledger " + ledgerIndex + " closed" + (closeTime != null ? " at " + rippleToIso(closeTime) : "") + ".", "real");
      setStage(svg, "dest", false);
      setStage(svg, "fee", true);
      addTrack("Validated in " + elapsed + " seconds. A validated payment cannot be reversed.", "real");
      globeCall("onValidated", { ledger: ledgerIndex, elapsed: elapsed });
      renderValidations();
      updateLedgerLabels();

      var txjson = (tx && tx.tx_json) || {};
      state.demo = {
        tx: txjson,
        meta: tx.meta,
        hash: tx.hash || txjson.hash || signed.hash,
        ledger: ledgerIndex,
        validated: tx.validated === true,
        from: fromAddr,
        to: toAddr,
        amount: DEMO_DROPS,
        fee: txjson.Fee || prepared.Fee,
        sequence: prepared.Sequence != null ? prepared.Sequence : txjson.Sequence,
        closeTime: closeTime,
        elapsed: elapsed,
        server: host
      };

      setStatus("The demo payment validated on Testnet in " + elapsed + "s via " + host + ".");
      appendMeta("demo-meta", "Validated in " + elapsed + "s. This cannot be reversed.");
      renderViewer();
    } catch (e) {
      if (String(e.message || e) === "cancelled") {
        setStatus("Cancelled before a new signature. If a payment had already validated, it cannot be reversed.");
      } else {
        setStatus(e.message || "The demo could not finish.");
        appendMeta("demo-meta", e.message || "The demo could not finish.");
      }
    } finally {
      forgetWallet(sender);
      forgetWallet(dest);
      live.pendingHash = live.pendingHash; /* keep hash for the viewer context */
      state.runningDemo = false;
      if (run) run.disabled = state.network !== "testnet";
      /* Keep the shared live client connected for the ambient stream. */
    }
  }

  function addField(dl, label, value, mono) {
    var dt = document.createElement("dt");
    text(dt, label);
    var dd = document.createElement("dd");
    if (mono) dd.className = "mono";
    text(dd, value == null || value === "" ? "—" : value);
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function renderViewer() {
    var dl = $("tx-fields");
    if (!dl) return;
    dl.replaceChildren();
    var d = state.demo;
    var lede = $("viewer-lede");
    var note = $("viewer-note");
    var more = $("tx-more");
    var moreDl = $("tx-fields-more");
    if (moreDl) moreDl.replaceChildren();
    if (!d) {
      var msg = state.runningDemo
        ? "The demo payment has not validated yet. You can keep going — if it validates, these fields will fill in from the real Testnet payment."
        : "The Testnet demo has not validated, so there is no live payment to label yet. You can still continue, or go Back and run the demo.";
      if (lede) text(lede, "No validated payment to label yet.");
      if (note) { note.hidden = false; text(note, msg); }
      if (more) more.hidden = true;
      addField(dl, "Status", msg);
      var emptyWrap = $("viewer-link-wrap");
      if (emptyWrap) emptyWrap.replaceChildren();
      return;
    }
    if (lede) text(lede, "The main fields from the Testnet payment, in plain words.");
    if (note) { note.hidden = true; text(note, ""); }
    if (more) more.hidden = false;
    var tx = d.tx || {};
    var extra = moreDl || dl;
    addField(dl, "From", tx.Account || d.from, true);
    addField(dl, "To", tx.Destination || d.to, true);
    addField(dl, "Amount", dropsToXrp(tx.Amount || d.amount) + " Testnet XRP");
    addField(dl, "Result", d.validated ? "Validated — this is final and cannot be reversed." : ((d.meta && d.meta.TransactionResult) || "Not yet validated."));
    addField(extra, "Network", "Testnet (practice ledger)");
    if (d.server) addField(extra, "Submitted through", d.server, true);
    if (d.elapsed) addField(extra, "Time to validate", d.elapsed + " seconds");
    addField(extra, "Fee burned", dropsToXrp(tx.Fee || d.fee) + " Testnet XRP — destroyed, not paid to a person");
    addField(extra, "Ledger", d.ledger != null ? String(d.ledger) : "—", true);
    addField(extra, "Ledger closed", d.closeTime != null ? rippleToIso(d.closeTime) : "—");
    addField(extra, "Sequence", d.sequence != null ? String(d.sequence) : (tx.Sequence != null ? String(tx.Sequence) : "—"), true);
    addField(extra, "Hash", d.hash || "—", true);

    var wrap = $("viewer-link-wrap");
    if (wrap) {
      wrap.replaceChildren();
      var url = explorerTx(d.hash);
      if (url) {
        var lead = document.createElement("span");
        text(lead, "Public Testnet record: ");
        var a = document.createElement("a");
        a.href = url;
        a.rel = "noopener";
        a.target = "_blank";
        text(a, url);
        wrap.appendChild(lead);
        wrap.appendChild(a);
      }
    }
  }

  function toggleEscrowFields() {
    var escrow = $("kind-escrow") && $("kind-escrow").checked;
    var box = $("escrow-fields");
    if (box) box.hidden = !escrow;
  }

  function readDraft() {
    var kind = ($("kind-escrow") && $("kind-escrow").checked) ? "EscrowCreate" : "Payment";
    var from = (($("draft-from") && $("draft-from").value) || "").trim();
    var to = (($("draft-to") && $("draft-to").value) || "").trim();
    var amount = (($("draft-amount") && $("draft-amount").value) || "").trim();
    var when = $("draft-cancel-after") && $("draft-cancel-after").value;
    var errors = [];
    if (!isClassic(from)) errors.push("Enter a valid From address (classic address starting with r).");
    if (!isClassic(to)) errors.push("Enter a valid To address (classic address starting with r).");
    if (from && to && from === to) errors.push("From and To should not be the same address.");
    var drops = null;
    if (!amount) errors.push("Enter an amount in XRP. This page does not suggest one.");
    else {
      try {
        var n = Number(amount);
        if (!isFinite(n) || n <= 0) errors.push("Amount must be a positive number.");
        else drops = xrpToDrops(amount);
      } catch (e) {
        errors.push(e.message || "Amount could not be read.");
      }
    }
    var cancelAfter = null;
    if (kind === "EscrowCreate") {
      if (!when) errors.push("Choose a cancel-after date and time so you can later send an EscrowCancel.");
      else {
        var ms = new Date(when).getTime();
        if (isNaN(ms)) errors.push("That cancel-after date could not be read.");
        else if (ms <= Date.now()) errors.push("Cancel-after must be in the future.");
        else cancelAfter = unixToRipple(ms);
      }
    }
    if (errors.length) return { ok: false, errors: errors };
    var tx = {
      TransactionType: kind,
      Account: from,
      Destination: to,
      Amount: drops
    };
    if (kind === "EscrowCreate") tx.CancelAfter = cancelAfter;
    if (state.feeDrops) tx.Fee = String(state.feeDrops);
    return {
      ok: true,
      kind: kind,
      from: from,
      to: to,
      amountXrp: dropsToXrp(drops),
      drops: drops,
      cancelAfter: cancelAfter,
      cancelLabel: when ? new Date(when).toString() : "",
      network: state.network,
      tx: tx
    };
  }

  async function lookupFee() {
    var client = null;
    try {
      client = await connectClient(state.network);
      var fee = await client.request({ command: "fee" });
      state.feeDrops = fee.result.drops.base_fee || fee.result.drops.minimum_fee;
    } catch (e) {
      state.feeDrops = null;
    } finally {
      if (client && client !== live.client) try { await client.disconnect(); } catch (e) { /* ignore */ }
    }
  }

  function renderReview() {
    var dl = $("review-fields");
    if (!dl) return;
    dl.replaceChildren();
    var d = state.draft;
    var net = $("review-net");
    var netName = state.network === "mainnet" ? "Mainnet (real ledger)" : "Testnet (practice ledger)";
    if (net) {
      net.setAttribute("data-net", state.network);
      text(net, "Network: " + netName);
    }
    if (!d) {
      addField(dl, "Status", "No draft yet.");
      return;
    }
    addField(dl, "Network", netName);
    addField(dl, "Type", d.kind === "EscrowCreate"
      ? "Escrow create"
      : "Payment — once validated, this cannot be reversed");
    addField(dl, "From", d.from, true);
    addField(dl, "To", d.to, true);
    addField(dl, "Amount", d.amountXrp + " XRP");
    addField(dl, "Fee", d.tx.Fee ? dropsToXrp(d.tx.Fee) + " XRP, burned" : "Your wallet will fill the current fee (burned).");
    if (d.kind === "EscrowCreate") {
      addField(dl, "Cancel after", d.cancelLabel + " — after this you can send an EscrowCancel yourself.");
    }
    showErr("review-error", "");
    setStatus("");
    var box = $("review-confirm");
    if (box) box.checked = false;
  }

  function renderSign() {
    var pre = $("draft-json");
    if (!pre) return;
    var payload = {
      note: "Unsigned draft only. This preview does not create a Xaman sign payload.",
      network: state.draft ? state.draft.network : state.network,
      transaction: state.draft ? state.draft.tx : null
    };
    text(pre, JSON.stringify(payload, null, 2));
    setStatus("Draft ready. Xaman payload step is not connected on this preview.");
  }

  function leaveDemo() {
    if (!state.demo) {
      var note = state.runningDemo
        ? "The demo payment has not validated yet. You can keep going — the field labels will fill in if it does."
        : "The Testnet demo has not validated, so there is no live payment to label yet. You can still continue.";
      setStatus(note);
    }
    showPanel("viewer");
  }

  function goNext() {
    var i = STEPS.indexOf(state.step);
    if (state.step === "demo") {
      leaveDemo();
      return;
    }
    if (state.step === "viewer") {
      showPanel("ask");
      return;
    }
    if (state.step === "compose") {
      var draft = readDraft();
      if (!draft.ok) {
        showErr("compose-error", draft.errors.join(" "));
        setStatus(draft.errors[0]);
        return;
      }
      showErr("compose-error", "");
      state.draft = draft;
      lookupFee().then(function () {
        if (state.aborted) return;
        if (state.draft && state.feeDrops) state.draft.tx.Fee = String(state.feeDrops);
        if (state.step === "compose") showPanel("review");
      });
      setStatus("Looking up the current network fee…");
      return;
    }
    if (state.step === "review") {
      if (!$("review-confirm") || !$("review-confirm").checked) {
        showErr("review-error", "Tick the box to confirm you have checked everything is correct.");
        return;
      }
      showErr("review-error", "");
      showPanel("sign");
      return;
    }
    if (i >= 0 && i < STEPS.length - 1) showPanel(STEPS[i + 1]);
  }

  function goBack() {
    if (state.step === "done" || state.step === "cancelled") {
      showPanel("intro");
      return;
    }
    var i = STEPS.indexOf(state.step);
    if (i > 0) showPanel(STEPS[i - 1]);
  }

  function goSkip() {
    if (state.step === "diagram") {
      showPanel("demo");
      return;
    }
    if (state.step === "demo") {
      leaveDemo();
      return;
    }
    goNext();
  }

  function cancelFlow() {
    state.aborted = true;
    clearTimers();
    if (state.step === "intro" || state.step === "diagram") {
      showPanel("cancelled");
      text($("cancelled-body"), "You left the walkthrough before anything was sent. Nothing was signed.");
      return;
    }
    if (state.step === "demo" || state.step === "viewer" || state.step === "ask") {
      var msg = state.demo
        ? "You cancelled the next step. The Testnet demo payment that already validated cannot be reversed, but it used demo-only play funds, not your wallet."
        : "Cancelled. No payment was signed by you.";
      text($("cancelled-body"), msg);
      showPanel("cancelled");
      return;
    }
    text($("cancelled-body"), "Cancelled before signing. This page did not sign or submit your draft. If you had already rejected a request in Xaman, that also cancels it.");
    showPanel("cancelled");
  }

  function restart() {
    state.aborted = false;
    state.draft = null;
    state.demo = null;
    state.feeDrops = null;
    state.runningDemo = false;
    clearTimers();
    ["draft-from", "draft-to", "draft-amount", "draft-cancel-after"].forEach(function (id) {
      if ($(id)) $(id).value = "";
    });
    if ($("kind-payment")) $("kind-payment").checked = true;
    toggleEscrowFields();
    showErr("compose-error", "");
    showErr("review-error", "");
    if ($("demo-meta")) $("demo-meta").replaceChildren();
    if ($("tx-fields")) $("tx-fields").replaceChildren();
    setNetwork("testnet");
    setStatus("");
    showPanel("intro");
  }

  function openMainnetModal(open) {
    var m = $("modal-mainnet");
    if (!m) return;
    m.hidden = !open;
    if (open) {
      var yes = $("btn-mainnet-yes");
      if (yes) yes.focus();
    }
  }

  function copyDraft() {
    var pre = $("draft-json");
    var btn = $("btn-copy-json");
    if (!pre) return;
    var ok = function (label) { if (btn) text(btn, label); later(function () { if (btn) text(btn, "Copy draft JSON"); }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pre.textContent).then(function () { ok("Copied"); }).catch(function () { ok("Select and copy"); });
    } else {
      ok("Select and copy");
    }
  }

  function bind() {
    mountDiagrams();
    $("btn-next").addEventListener("click", goNext);
    $("btn-back").addEventListener("click", goBack);
    $("btn-skip").addEventListener("click", goSkip);
    $("btn-cancel").addEventListener("click", cancelFlow);
    $("btn-run-demo").addEventListener("click", function () {
      runDemo();
    });
    $("btn-try-real").addEventListener("click", function () { showPanel("compose"); });
    $("btn-not-now").addEventListener("click", function () { showPanel("done"); });
    $("btn-restart").addEventListener("click", restart);
    $("btn-restart-2").addEventListener("click", restart);
    $("kind-payment").addEventListener("change", toggleEscrowFields);
    $("kind-escrow").addEventListener("change", toggleEscrowFields);
    $("btn-copy-json").addEventListener("click", copyDraft);
    $("motion-toggle").addEventListener("click", function () {
      var on = document.body.classList.toggle("reduce-motion");
      $("motion-toggle").setAttribute("aria-pressed", on ? "true" : "false");
    });
    $("net-toggle").addEventListener("click", function () {
      if (state.network === "testnet") openMainnetModal(true);
      else setNetwork("testnet");
    });
    $("btn-mainnet-yes").addEventListener("click", function () { openMainnetModal(false); setNetwork("mainnet"); });
    $("btn-mainnet-no").addEventListener("click", function () { openMainnetModal(false); });
    $("modal-mainnet").addEventListener("click", function (e) {
      if (e.target === $("modal-mainnet")) openMainnetModal(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (!$("modal-mainnet").hidden) { openMainnetModal(false); e.preventDefault(); }
      }
    });
    toggleEscrowFields();
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.body.classList.add("reduce-motion");
      $("motion-toggle").setAttribute("aria-pressed", "true");
    }
    setNetwork("testnet");
    showPanel("intro");
    ensureLiveStream().catch(function (e) { setLiveLine(e.message || "Could not start the Testnet stream."); });
    document.addEventListener("visibilitychange", function () {
      live.hidden = document.hidden === true;
    });
    window.addEventListener("pagehide", function () { stopLiveStream(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
