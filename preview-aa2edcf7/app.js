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

  function $(id) { return document.getElementById(id); }
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
    clearTimers();
    var svg = diagramRoot(kind);
    resetDiagram(svg);
    var reduced = document.body.classList.contains("reduce-motion") ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    var cap = $("diagram-caption");
    if (reduced) {
      DIAGRAM_STAGES.forEach(function (s) { setStage(svg, s, true); });
      if (cap) text(cap, CAPTIONS.fee);
      return;
    }
    DIAGRAM_STAGES.forEach(function (stage, i) {
      later(function () {
        setStage(svg, stage, i === DIAGRAM_STAGES.length - 1);
        if (cap && kind !== "demo") text(cap, CAPTIONS[stage]);
      }, DIAGRAM_MS[i]);
    });
  }

  function showPanel(name) {
    document.querySelectorAll(".panel").forEach(function (p) {
      var on = p.getAttribute("data-panel") === name;
      p.hidden = !on;
      p.classList.toggle("is-on", on);
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
    if (name === "diagram") playDiagram("diagram");
    if (name === "demo") {
      var warn = $("demo-mainnet-warn");
      if (warn) warn.hidden = state.network !== "mainnet";
      var run = $("btn-run-demo");
      if (run) run.disabled = state.network !== "testnet" || state.runningDemo;
      if (!state.demo) resetDiagram(diagramRoot("demo"));
    }
    if (name === "compose") syncComposeNet();
    if (name === "review") renderReview();
    if (name === "sign") renderSign();
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
  }

  async function connectClient(network) {
    if (!window.xrpl || typeof xrpl.Client !== "function") {
      throw new Error("The ledger library failed to load.");
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
    var run = $("btn-run-demo");
    if (run) run.disabled = true;
    var meta = $("demo-meta");
    if (meta) meta.replaceChildren();
    var svg = diagramRoot("demo");
    resetDiagram(svg);
    setStatus("Creating demo-only Testnet wallets…");
    appendMeta("demo-meta", "Creating two throwaway Testnet wallets in this browser (demo only).");

    var sender = null;
    var dest = null;
    var client = null;
    try {
      sender = xrpl.Wallet.generate();
      dest = xrpl.Wallet.generate();
      var fromAddr = sender.classicAddress;
      var toAddr = dest.classicAddress;
      appendMeta("demo-meta", "Demo sender: " + shortAddr(fromAddr) + "  ·  Demo destination: " + shortAddr(toAddr));
      setStage(svg, "sender", false);

      if (state.aborted) throw new Error("cancelled");
      setStatus("Asking the public Testnet faucet for play funds…");
      appendMeta("demo-meta", "Requesting Testnet play funds from the public faucet. This is not real value.");
      await fundAddress(fromAddr);

      client = await connectClient("testnet");
      await waitFunded(client, fromAddr);
      if (state.aborted) throw new Error("cancelled");

      setStatus("Submitting the demo payment to Testnet…");
      appendMeta("demo-meta", "Submitting a fixed demo payment of " + dropsToXrp(DEMO_DROPS) + " Testnet XRP (practice amount, not a suggestion).");
      setStage(svg, "network", false);

      var prepared = await client.autofill({
        TransactionType: "Payment",
        Account: fromAddr,
        Destination: toAddr,
        Amount: DEMO_DROPS
      });
      var signed = sender.sign(prepared);
      forgetWallet(sender);
      forgetWallet(dest);
      sender = null;
      dest = null;

      var result = await client.submitAndWait(signed.tx_blob);
      if (state.aborted && !(result && result.result && result.result.meta)) {
        throw new Error("cancelled");
      }
      var tx = result.result;
      var tes = (tx.meta && tx.meta.TransactionResult) || tx.engine_result || "";
      if (tes !== "tesSUCCESS") {
        throw new Error("The demo payment did not succeed (" + tes + "). Try again.");
      }

      setStage(svg, "ledger", false);
      setStage(svg, "dest", false);
      setStage(svg, "fee", true);
      var txjson = (tx && tx.tx_json) || {};
      state.demo = {
        tx: txjson,
        meta: tx.meta,
        hash: tx.hash || txjson.hash || signed.hash,
        ledger: tx.ledger_index,
        validated: tx.validated === true,
        from: fromAddr,
        to: toAddr,
        amount: DEMO_DROPS,
        fee: txjson.Fee || prepared.Fee,
        sequence: prepared.Sequence != null ? prepared.Sequence : txjson.Sequence,
        closeTime: null
      };
      try {
        var led = await client.request({ command: "ledger", ledger_index: state.demo.ledger });
        state.demo.closeTime = led.result.ledger.close_time;
      } catch (e) { /* optional */ }

      setStatus("The demo payment validated on Testnet.");
      appendMeta("demo-meta", "Validated on Testnet. A validated payment cannot be reversed.");
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
      state.runningDemo = false;
      if (run) run.disabled = state.network !== "testnet";
      if (client) {
        try { await client.disconnect(); } catch (e) { /* ignore */ }
      }
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
    if (!d) {
      addField(dl, "Status", "No demo payment yet. Run the Testnet demo first.");
      return;
    }
    var tx = d.tx || {};
    addField(dl, "Network", "Testnet (practice ledger)");
    addField(dl, "Type", "Payment — a transfer of Testnet XRP.");
    addField(dl, "Sender (who sent it)", tx.Account || d.from, true);
    addField(dl, "Destination (who received it)", tx.Destination || d.to, true);
    addField(dl, "Amount sent", dropsToXrp(tx.Amount || d.amount) + " Testnet XRP (fixed demo amount)");
    addField(dl, "Fee burned", dropsToXrp(tx.Fee || d.fee) + " Testnet XRP — destroyed, not paid to a person");
    addField(dl, "Result", (d.meta && d.meta.TransactionResult) || "tesSUCCESS");
    addField(dl, "Validated", d.validated ? "Yes — this is final on Testnet and cannot be reversed." : "Not yet marked validated.");
    addField(dl, "Ledger it settled in", d.ledger != null ? String(d.ledger) : "—", true);
    addField(dl, "When the ledger closed", d.closeTime != null ? rippleToIso(d.closeTime) : "—");
    addField(dl, "Sequence number (this account’s transaction count)", d.sequence != null ? String(d.sequence) : (tx.Sequence != null ? String(tx.Sequence) : "—"), true);
    addField(dl, "Transaction hash (its unique ID)", d.hash || "—", true);

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
      if (client) try { await client.disconnect(); } catch (e) { /* ignore */ }
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
      ? "Escrow create — funds lock until the rules you set"
      : "Payment — once validated, this cannot be reversed");
    addField(dl, "From", d.from, true);
    addField(dl, "To", d.to, true);
    addField(dl, "Amount", d.amountXrp + " XRP");
    addField(dl, "Fee (looked up, your wallet may adjust)", d.tx.Fee ? dropsToXrp(d.tx.Fee) + " XRP, burned" : "Your wallet will fill the current network fee (burned, not paid to a person).");
    if (d.kind === "EscrowCreate") {
      addField(dl, "Cancel after", d.cancelLabel + " — after this time you can send an EscrowCancel yourself to return the funds to you.");
    }
    addField(dl, "Honest limit", "A validated payment cannot be reversed. Cancel now, or reject in Xaman, if anything is wrong.");
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

  function goNext() {
    var i = STEPS.indexOf(state.step);
    if (state.step === "demo" && !state.demo) {
      setStatus("Run the Testnet demo first, or go Back.");
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
      clearTimers();
      var svg = diagramRoot("diagram");
      DIAGRAM_STAGES.forEach(function (s) { setStage(svg, s, true); });
      text($("diagram-caption"), CAPTIONS.fee);
      showPanel("demo");
      return;
    }
    if (state.step === "demo" && !state.demo) {
      setStatus("The demo cannot be skipped if you want the live field viewer. You can Cancel, or run the demo.");
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
      runDemo().then(function () {
        if (state.demo && !state.aborted) {
          later(function () { showPanel("viewer"); }, 700);
        }
      });
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
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
