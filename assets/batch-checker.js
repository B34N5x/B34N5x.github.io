/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 B34N5x contributors
 * Licensed under the Apache License, Version 2.0 (see /LICENSE).
 * Read-only XRPL BatchChecker. Never asks for, accepts or stores a seed or secret.
 * Addresses and hashes stay in memory for this page visit only — never localStorage/sessionStorage/cookies.
 * No innerHTML. Public WebSocket nodes only. Network from the radio (default Testnet).
 * Tour UI is self-made (no third-party tour library).
 */
(function () {
  "use strict";

  var NETWORKS = Object.freeze({
    testnet: Object.freeze({
      name: "Testnet",
      servers: Object.freeze(["wss://s.altnet.rippletest.net:51233", "wss://testnet.xrpl-labs.com"])
    }),
    mainnet: Object.freeze({
      name: "Mainnet",
      servers: Object.freeze(["wss://xrplcluster.com", "wss://s1.ripple.com"])
    })
  });

  // Public sample only — a throwaway Testnet faucet address + a clearly labelled invalid line. Never a seed.
  var SAMPLE_LIST = [
    "rh7w4w3dTVbGtHof2GrSsaYBzh6hs2uoqh",
    "sample-not-a-real-address"
  ].join("\n");

  var MAX_LINES = 50;
  var DELAY_MS = 220;
  var REQUEST_TIMEOUT_MS = 6000;
  var RIPPLE_EPOCH = 946684800;

  var out = document.getElementById("out");
  var btn = document.getElementById("btn");
  var csvBtn = document.getElementById("csv");
  var listEl = document.getElementById("list");
  var banner = document.getElementById("netbanner");
  var form = document.getElementById("f");
  var step2 = document.getElementById("step2");
  var step3 = document.getElementById("step3");
  var lastRows = [];
  var tourBusy = false;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }

  function revealResults() {
    if (step2) {
      step2.hidden = false;
      step2.classList.remove("is-idle");
    }
  }

  function revealCsv() {
    if (step3) {
      step3.hidden = false;
      step3.classList.remove("is-idle");
    }
  }

  function hideCsv() {
    if (step3) {
      step3.hidden = true;
      step3.classList.add("is-idle");
    }
    if (csvBtn) csvBtn.disabled = true;
  }

  function show(cls, nodes) {
    revealResults();
    out.className = "result " + cls;
    out.replaceChildren.apply(out, nodes);
  }

  function msg(cls, text) {
    show(cls, [document.createTextNode(text)]);
  }

  function looksLikeSecret(s) {
    var t = String(s || "").trim();
    if (/^s[1-9A-HJ-NP-Za-km-z]{20,}$/.test(t)) return true;
    var parts = t.split(/\s+/);
    return parts.length >= 12 && parts.every(function (w) { return /^[a-zA-Z]+$/.test(w); });
  }

  function isAddress(s) {
    return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(s) && window.xrpl && xrpl.isValidClassicAddress(s);
  }

  function isTxHash(s) {
    return /^[0-9A-Fa-f]{64}$/.test(s);
  }

  function selectedNet() {
    var checked = form.querySelector('input[name="net"]:checked');
    var key = checked ? checked.value : "testnet";
    return Object.prototype.hasOwnProperty.call(NETWORKS, key) ? key : "testnet";
  }

  function syncBanner() {
    var key = selectedNet();
    document.body.setAttribute("data-network", key);
    banner.className = "netbanner " + key;
    banner.replaceChildren();
    var wrap = el("div", "wrap");
    if (key === "mainnet") {
      wrap.append(el("strong", null, "Mainnet: real XRP, read-only, never enter a seed."));
    } else {
      var strong = el("strong", null, "Testnet");
      wrap.append(strong, document.createTextNode(": test XRP with no real value, read-only. Default network."));
    }
    banner.append(wrap);
  }

  form.querySelectorAll('input[name="net"]').forEach(function (r) {
    r.addEventListener("change", syncBanner);
  });
  syncBanner();

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function withTimeout(promise, ms, label) {
    var timer = null;
    var timeout = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        reject(Object.assign(new Error(label || "timeout"), { code: "timeout" }));
      }, ms);
    });
    return Promise.race([promise, timeout]).then(
      function (v) { clearTimeout(timer); return v; },
      function (e) { clearTimeout(timer); throw e; }
    );
  }

  function isNodeError(err) {
    if (!err) return false;
    if (err.code === "timeout" || err.code === "ECONNRESET" || err.code === "ENOTFOUND") return true;
    var msgText = String(err.message || err || "").toLowerCase();
    return /timeout|not connected|websocket|disconnect|network|failed to fetch|connection/.test(msgText);
  }

  function nodeUnavailableRow(kind, input) {
    return {
      kind: kind || "unknown",
      input: input,
      status: "error",
      balance: "—", ownerCount: "—", reserve: "—", spendable: "—", lastActivity: "—",
      result: "node_unavailable", type: "—", amount: "—", date: "—",
      detail: "Node unavailable — try again"
    };
  }

  function parseLines(raw) {
    return String(raw || "").split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
  }

  function formatXrp(drops) {
    try { return xrpl.dropsToXrp(String(drops)) + " XRP"; }
    catch (_) { return String(drops) + " drops"; }
  }

  function formatAmount(amount) {
    if (amount == null) return "—";
    if (typeof amount === "string") return formatXrp(amount);
    if (typeof amount === "object") {
      var cur = amount.currency || "?";
      var val = amount.value != null ? amount.value : "?";
      var iss = amount.issuer ? " @" + amount.issuer : "";
      return val + " " + cur + iss;
    }
    return String(amount);
  }

  function rippleDate(seconds) {
    if (seconds == null || !Number.isFinite(Number(seconds))) return "—";
    var d = new Date((Number(seconds) + RIPPLE_EPOCH) * 1000);
    return isNaN(d.getTime()) ? "—" : d.toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  async function connect(netKey, startIndex) {
    var net = NETWORKS[netKey];
    var lastErr = null;
    var start = startIndex || 0;
    for (var n = 0; n < net.servers.length; n++) {
      var i = (start + n) % net.servers.length;
      var c = new xrpl.Client(net.servers[i], { connectionTimeout: 8000 });
      try {
        await withTimeout(c.connect(), 7000, "connect timeout");
        c.__bcServerIndex = i;
        return c;
      } catch (err) {
        lastErr = err;
        try { await c.disconnect(); } catch (_) {}
      }
    }
    throw lastErr || new Error("no server");
  }

  async function reconnectNext(netKey, client) {
    var next = 0;
    if (client && typeof client.__bcServerIndex === "number") next = client.__bcServerIndex + 1;
    try { if (client) await client.disconnect(); } catch (_) {}
    return connect(netKey, next);
  }

  async function fetchReserves(client) {
    var base = 1000000;
    var inc = 200000;
    try {
      var st = await withTimeout(client.request({ command: "server_state" }), REQUEST_TIMEOUT_MS, "server_state timeout");
      var vl = st.result && st.result.state && st.result.state.validated_ledger;
      if (vl) {
        if (vl.reserve_base != null) base = Number(vl.reserve_base);
        if (vl.reserve_inc != null) inc = Number(vl.reserve_inc);
      }
    } catch (_) {
      try {
        var info = await withTimeout(client.request({ command: "server_info" }), REQUEST_TIMEOUT_MS, "server_info timeout");
        var ivl = info.result && info.result.info && info.result.info.validated_ledger;
        if (ivl) {
          if (ivl.reserve_base_xrp != null) base = Math.round(Number(ivl.reserve_base_xrp) * 1000000);
          if (ivl.reserve_inc_xrp != null) inc = Math.round(Number(ivl.reserve_inc_xrp) * 1000000);
        }
      } catch (__) {}
    }
    return { base: base, inc: inc };
  }

  async function lookupAddress(client, addr, reserves) {
    try {
      var r = await withTimeout(client.request({ command: "account_info", account: addr, ledger_index: "validated" }), REQUEST_TIMEOUT_MS, "account_info timeout");
      var data = r.result.account_data;
      var bal = Number(data.Balance);
      var owners = Number(data.OwnerCount) || 0;
      var reserve = reserves.base + owners * reserves.inc;
      var spendable = Math.max(0, bal - reserve);
      var last = "—";
      try {
        var txr = await withTimeout(client.request({
          command: "account_tx",
          account: addr,
          ledger_index_min: -1,
          ledger_index_max: -1,
          limit: 1,
          forward: false
        }), REQUEST_TIMEOUT_MS, "account_tx timeout");
        var txs = txr.result && txr.result.transactions;
        if (txs && txs.length) {
          var t = txs[0].tx || txs[0].tx_json || txs[0];
          if (txs[0].close_time_iso) last = String(txs[0].close_time_iso);
          else if (t.date != null) last = rippleDate(t.date);
        } else {
          last = "none";
        }
      } catch (_) {
        last = "unavailable";
      }
      return {
        kind: "address",
        input: addr,
        status: "ok",
        balance: formatXrp(bal),
        ownerCount: String(owners),
        reserve: formatXrp(reserve),
        spendable: formatXrp(spendable),
        lastActivity: last,
        result: "—",
        type: "account",
        amount: "—",
        date: last,
        detail: ""
      };
    } catch (err) {
      if (isNodeError(err)) throw err;
      var code = err && err.data && err.data.error;
      if (code === "actNotFound") {
        return {
          kind: "address", input: addr, status: "missing",
          balance: "—", ownerCount: "—", reserve: "—", spendable: "—", lastActivity: "—",
          result: "actNotFound", type: "account", amount: "—", date: "—",
          detail: "Not funded on this network"
        };
      }
      return {
        kind: "address", input: addr, status: "error",
        balance: "—", ownerCount: "—", reserve: "—", spendable: "—", lastActivity: "—",
        result: "error", type: "account", amount: "—", date: "—",
        detail: "Lookup failed"
      };
    }
  }

  async function lookupTx(client, hash) {
    try {
      var r = await withTimeout(client.request({ command: "tx", transaction: hash, binary: false }), REQUEST_TIMEOUT_MS, "tx timeout");
      var raw = r.result || {};
      var tx = raw.tx_json && typeof raw.tx_json === "object" ? Object.assign({}, raw, raw.tx_json) : raw;
      var meta = raw.meta || raw.metaData || tx.meta || {};
      var resultCode = meta.TransactionResult || (raw.validated === false ? "unvalidated" : "—");
      var typ = tx.TransactionType || "—";
      var amount = "—";
      if (tx.Amount != null) amount = formatAmount(tx.Amount);
      else if (tx.DeliverMax != null) amount = formatAmount(tx.DeliverMax);
      else if (meta.delivered_amount != null) amount = formatAmount(meta.delivered_amount);
      var date = "—";
      if (raw.close_time_iso) date = String(raw.close_time_iso);
      else if (tx.date != null) date = rippleDate(tx.date);
      return {
        kind: "tx", input: hash, status: "ok",
        balance: "—", ownerCount: "—", reserve: "—", spendable: "—", lastActivity: "—",
        result: resultCode, type: typ, amount: amount, date: date, detail: ""
      };
    } catch (err) {
      if (isNodeError(err)) throw err;
      var code = err && err.data && err.data.error;
      return {
        kind: "tx", input: hash, status: "error",
        balance: "—", ownerCount: "—", reserve: "—", spendable: "—", lastActivity: "—",
        result: code || "error", type: "—", amount: "—", date: "—",
        detail: code === "txnNotFound" ? "Transaction not found" : "Lookup failed"
      };
    }
  }

  function csvEscape(v) {
    var s = String(v == null ? "" : v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function buildCsv(rows) {
    var headers = ["input", "kind", "status", "balance", "owner_count", "reserve", "spendable", "last_activity", "tx_result", "tx_type", "amount", "date", "detail"];
    var lines = [headers.join(",")];
    rows.forEach(function (r) {
      lines.push([
        r.input, r.kind, r.status, r.balance, r.ownerCount, r.reserve, r.spendable,
        r.lastActivity, r.result, r.type, r.amount, r.date, r.detail
      ].map(csvEscape).join(","));
    });
    return lines.join("\n");
  }

  function kv(card, label, value) {
    var row = el("div", "batch-kv");
    row.append(el("span", "k", label), el("span", "v", value));
    card.append(row);
  }

  function renderCard(r) {
    var card = el("article", "batch-card st-" + r.status);
    var head = el("div", "batch-card-head");
    head.append(el("span", "batch-kind", r.kind), el("span", "batch-status", r.status));
    card.append(head);
    card.append(el("p", "batch-input", r.input));
    if (r.kind === "address") {
      kv(card, "Balance", r.balance);
      kv(card, "Reserve", r.reserve);
      kv(card, "Spendable", r.spendable);
      kv(card, "Owners", r.ownerCount);
      kv(card, "Last activity", r.lastActivity);
    } else if (r.kind === "tx") {
      kv(card, "Result", r.result);
      kv(card, "Type", r.type);
      kv(card, "Amount", r.amount);
      kv(card, "Date", r.date);
    }
    if (r.detail) card.append(el("p", "batch-note", r.detail));
    var more = el("details", "batch-card-more");
    more.append(el("summary", null, "More"));
    var pre = el("p", "batch-card-raw");
    pre.textContent = [
      "kind: " + r.kind,
      "status: " + r.status,
      "balance: " + r.balance,
      "owners: " + r.ownerCount,
      "reserve: " + r.reserve,
      "spendable: " + r.spendable,
      "last: " + r.lastActivity,
      "tx: " + r.result + " / " + r.type + " / " + r.amount,
      "date: " + r.date,
      "note: " + (r.detail || "—")
    ].join("\n");
    more.append(pre);
    card.append(more);
    return card;
  }

  function renderTableDesktop(rows) {
    var table = el("table", "batch-table");
    var thead = document.createElement("thead");
    var hr = document.createElement("tr");
    ["Input", "Kind", "Status", "Balance", "Owners", "Reserve", "Spendable", "Last / Date", "Tx result", "Type", "Amount", "Note"].forEach(function (h) {
      hr.append(el("th", null, h));
    });
    thead.append(hr);
    table.append(thead);
    var tbody = document.createElement("tbody");
    rows.forEach(function (r) {
      var tr = document.createElement("tr");
      tr.className = "st-" + r.status;
      [
        r.input, r.kind, r.status, r.balance, r.ownerCount, r.reserve, r.spendable,
        r.kind === "address" ? r.lastActivity : r.date, r.result, r.type, r.amount, r.detail
      ].forEach(function (v) {
        tr.append(el("td", null, v));
      });
      tbody.append(tr);
    });
    table.append(tbody);
    var scroller = el("div", "batch-scroll");
    scroller.append(table);
    return scroller;
  }

  function renderResults(rows, netName) {
    var wrap = el("div", "batch-wrap");
    wrap.append(el("p", "batch-summary", rows.length + " line(s) on " + netName + "."));
    var cards = el("div", "batch-cards");
    rows.forEach(function (r) { cards.append(renderCard(r)); });
    wrap.append(cards);
    wrap.append(renderTableDesktop(rows));
    show("ok", [wrap]);
    revealCsv();
  }

  csvBtn.addEventListener("click", function () {
    if (!lastRows.length) return;
    var blob = new Blob([buildCsv(lastRows)], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "batchchecker-" + selectedNet() + ".csv";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  });

  async function runBatch() {
    var raw = listEl.value;
    if (looksLikeSecret(raw) || parseLines(raw).some(looksLikeSecret)) {
      listEl.value = "";
      lastRows = [];
      hideCsv();
      msg("err", "That looks like a seed or secret key. Never paste it anywhere, including here. Only public addresses or transaction hashes.");
      return false;
    }
    if (!window.xrpl) {
      msg("err", "Couldn't load the XRPL library. Check your connection and refresh.");
      return false;
    }

    var lines = parseLines(raw);
    if (!lines.length) {
      msg("err", "Paste at least one address or transaction hash (one per line).");
      return false;
    }
    if (lines.length > MAX_LINES) {
      msg("err", "Please keep it to " + MAX_LINES + " lines or fewer.");
      return false;
    }

    var netKey = selectedNet();
    var net = NETWORKS[netKey];
    btn.disabled = true;
    hideCsv();
    lastRows = [];
    msg("ok", "Connecting to " + net.name + "…");

    var client = null;
    try {
      client = await connect(netKey);
      var reserves = await fetchReserves(client);
      var rows = [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        msg("ok", "Checking " + (i + 1) + " of " + lines.length + "…");
        var row;
        if (looksLikeSecret(line)) {
          row = {
            kind: "invalid", input: "[redacted]", status: "blocked",
            balance: "—", ownerCount: "—", reserve: "—", spendable: "—", lastActivity: "—",
            result: "—", type: "—", amount: "—", date: "—",
            detail: "Looks like a seed — cleared, not sent"
          };
        } else if (isAddress(line)) {
          try {
            row = await lookupAddress(client, line, reserves);
          } catch (lookupErr) {
            if (isNodeError(lookupErr)) {
              try {
                client = await reconnectNext(netKey, client);
                reserves = await fetchReserves(client);
                row = await lookupAddress(client, line, reserves);
              } catch (retryErr) {
                row = nodeUnavailableRow("address", line);
              }
            } else {
              throw lookupErr;
            }
          }
        } else if (isTxHash(line)) {
          try {
            row = await lookupTx(client, line);
          } catch (lookupErr) {
            if (isNodeError(lookupErr)) {
              try {
                client = await reconnectNext(netKey, client);
                row = await lookupTx(client, line);
              } catch (retryErr) {
                row = nodeUnavailableRow("tx", line);
              }
            } else {
              throw lookupErr;
            }
          }
        } else {
          row = {
            kind: "invalid", input: line.slice(0, 80), status: "invalid",
            balance: "—", ownerCount: "—", reserve: "—", spendable: "—", lastActivity: "—",
            result: "—", type: "—", amount: "—", date: "—",
            detail: "Not a classic address or 64-hex tx hash"
          };
        }
        rows.push(row);
        if (i < lines.length - 1) await sleep(DELAY_MS);
      }
      lastRows = rows;
      renderResults(rows, net.name);
      csvBtn.disabled = false;
      return true;
    } catch (err) {
      lastRows = [];
      hideCsv();
      msg("err", "Couldn't reach " + net.name + " right now. Please check your connection and try again.");
      return false;
    } finally {
      try { if (client) await client.disconnect(); } catch (_) {}
      btn.disabled = false;
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (tourBusy) return;
    runBatch();
  });

  // --- Self-made guided tour (no third-party library) ---
  var tourEl = document.getElementById("tour");
  var tourSpot = document.getElementById("tour-spot");
  var tourTitle = document.getElementById("tour-title");
  var tourBody = document.getElementById("tour-body");
  var tourCount = document.getElementById("tour-stepcount");
  var tourBack = document.getElementById("tour-back");
  var tourNext = document.getElementById("tour-next");
  var tourIdx = 0;
  var tourSteps = [];

  function clearHighlight() {
    document.querySelectorAll(".tour-highlight").forEach(function (n) {
      n.classList.remove("tour-highlight");
    });
    if (tourSpot) {
      tourSpot.hidden = true;
      tourSpot.style.cssText = "";
    }
  }

  function highlight(sel) {
    clearHighlight();
    var node = typeof sel === "string" ? document.querySelector(sel) : sel;
    if (!node) return;
    node.classList.add("tour-highlight");
    var rect = node.getBoundingClientRect();
    if (tourSpot) {
      tourSpot.hidden = false;
      tourSpot.style.top = (rect.top + window.scrollY - 6) + "px";
      tourSpot.style.left = (rect.left + window.scrollX - 6) + "px";
      tourSpot.style.width = (rect.width + 12) + "px";
      tourSpot.style.height = (rect.height + 12) + "px";
    }
    try { node.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (_) {}
  }

  function endTour() {
    tourBusy = false;
    if (tourEl) {
      tourEl.hidden = true;
      tourEl.setAttribute("aria-hidden", "true");
      tourEl.setAttribute("hidden", "");
    }
    clearHighlight();
    document.body.classList.remove("tour-open");
  }

  function paintTour() {
    var step = tourSteps[tourIdx];
    if (!step) return endTour();
    tourCount.textContent = "Step " + (tourIdx + 1) + " of " + tourSteps.length;
    tourTitle.textContent = step.title;
    tourBody.textContent = step.body;
    tourBack.disabled = tourIdx === 0;
    tourNext.textContent = tourIdx === tourSteps.length - 1 ? "Done" : "Next";
    if (step.highlight) highlight(step.highlight);
    else clearHighlight();
    if (typeof step.enter === "function") step.enter();
  }

  function startTour() {
    if (tourBusy) return;
    tourBusy = true;
    document.body.classList.add("tour-open");
    // Ensure Testnet + consent for a clean demo
    var tn = form.querySelector('input[name="net"][value="testnet"]');
    if (tn) { tn.checked = true; syncBanner(); }
    var consent = document.getElementById("consent");
    if (consent && !consent.checked) {
      consent.checked = true;
      try { consent.dispatchEvent(new Event("change", { bubbles: true })); } catch (_) {}
    }

    tourSteps = [
      {
        title: "Paste a list",
        body: "Step 1 is where you paste public addresses (they start with r) or transaction IDs. We'll fill in a SAMPLE list for you — one real Testnet practice address and one invalid line so you can see both outcomes.",
        highlight: "#step1",
        enter: function () {
          listEl.value = SAMPLE_LIST;
        }
      },
      {
        title: "Testnet or Mainnet?",
        body: "Testnet is the practice network — free test XRP with no real value. That's the default. Mainnet is the real ledger with real XRP. This tool is read-only on both: it never moves funds and never asks for a seed.",
        highlight: ".batch-net"
      },
      {
        title: "Run the check",
        body: "Tap Check list. We look up each line one at a time (with a short pause so public nodes aren't flooded) and show the results below.",
        highlight: "#btn",
        enter: function () {
          // auto-run once when arriving here if no results yet
        }
      },
      {
        title: "Read the results",
        body: "Balance is the total XRP. Reserve is XRP the network keeps locked so the account can exist. Spendable is roughly what's left to send. Invalid lines are flagged so good ones still finish.",
        highlight: "#step2",
        enter: function () {
          // results should already be visible after previous Next ran the check
        }
      },
      {
        title: "CSV and privacy",
        body: "Optional: download a CSV built in your browser. Nothing you paste is stored, and only public XRPL nodes see the lookup. You're done — Skip anytime on a future visit; we don't remember that you took the tour.",
        highlight: "#step3"
      }
    ];

    tourIdx = 0;
    if (tourEl) {
      tourEl.hidden = false;
      tourEl.setAttribute("aria-hidden", "false");
    }
    paintTour();
  }

  async function tourNextStep() {
    var step = tourSteps[tourIdx];
    // When leaving the "Run the check" step (index 2), actually run
    if (step && step.title === "Run the check") {
      tourNext.disabled = true;
      tourBack.disabled = true;
      try {
        await runBatch();
      } finally {
        tourNext.disabled = false;
        tourBack.disabled = tourIdx === 0;
      }
    }
    if (tourIdx >= tourSteps.length - 1) {
      endTour();
      return;
    }
    tourIdx += 1;
    paintTour();
  }

  function tourPrevStep() {
    if (tourIdx <= 0) return;
    tourIdx -= 1;
    paintTour();
  }

  var tourStartBtn = document.getElementById("tour-start");
  if (tourStartBtn) tourStartBtn.addEventListener("click", startTour);
  if (tourNext) tourNext.addEventListener("click", function () { tourNextStep(); });
  if (tourBack) tourBack.addEventListener("click", tourPrevStep);
  document.querySelectorAll("[data-tour-skip]").forEach(function (n) {
    n.addEventListener("click", endTour);
  });

  // Expose for guided tour / walkthrough automation (no test-only node hooks)
  window.__batchChecker = {
    runBatch: runBatch,
    startTour: startTour,
    endTour: endTour,
    SAMPLE_LIST: SAMPLE_LIST,
    MAX_LINES: MAX_LINES,
    DELAY_MS: DELAY_MS
  };
})();
