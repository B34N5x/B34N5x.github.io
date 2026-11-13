/* Transaction Tracer HUD preview. Read-only. No wallet, no signing, no keys. */
(function () {
  "use strict";

  const STORAGE_KEY = "b34n5.tracer.watches";
  const EXAMPLE_HASH = "BF2B0B95C54E4FE60829D77ED71F245BDCE9A4977069C9C2A14F6FBAE265B02D";
  const MAX_AMBIENT_PER_SEC = 28;
  const MAX_WATCH = 16;
  const MAX_BATCH = 25;

  const els = {
    q: document.getElementById("q"),
    watch: document.getElementById("btn-watch"),
    lookup: document.getElementById("btn-lookup"),
    example: document.getElementById("btn-example"),
    clear: document.getElementById("btn-clear"),
    hint: document.getElementById("hint"),
    watches: document.getElementById("watches"),
    statusText: document.getElementById("status-text"),
    statusDot: document.getElementById("status-dot"),
    hudEmpty: document.getElementById("hud-empty"),
    hudDl: document.getElementById("hud-dl"),
    tooltip: document.getElementById("tooltip"),
    expectAmount: document.getElementById("expect-amount"),
    expectDest: document.getElementById("expect-dest"),
    alerts: document.getElementById("alerts"),
    alertList: document.getElementById("alert-list"),
    alertCount: document.getElementById("alert-count"),
    panel: document.getElementById("panel"),
    panelToggle: document.getElementById("panel-toggle"),
    panelTitle: document.getElementById("panel-title"),
    panelPeek: document.getElementById("panel-peek"),
    btnSearch: document.getElementById("btn-search"),
    mapFlags: document.getElementById("map-flags"),
    hud: document.getElementById("hud"),
    hudTitle: document.getElementById("hud-title"),
    btnReset: document.getElementById("btn-reset"),
  };

  let panelAnim = null;
  function setPanel(open) {
    if (!els.panel) return;
    const landscape = window.matchMedia && window.matchMedia("(orientation: landscape)").matches;
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const closed = landscape
      ? "translateX(calc(100% - var(--tab-w)))"
      : "translateY(calc(100% - var(--handle-h)))";
    const opened = landscape ? "translateX(0px)" : "translateY(0px)";
    const from = open ? closed : opened;
    const to = open ? opened : closed;
    if (panelAnim && typeof panelAnim.stop === "function") {
      try { panelAnim.stop(); } catch (e) {}
      panelAnim = null;
    }
    els.panel.classList.toggle("open", !!open);
    document.body.classList.toggle("panel-open", !!open);
    if (els.panelToggle) els.panelToggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (reduced || typeof Motion === "undefined" || typeof Motion.animate !== "function") return;
    els.panel.style.transition = "none";
    els.panel.style.transform = from;
    panelAnim = Motion.animate(els.panel, { transform: to }, { duration: 0.28, ease: [0.22, 1, 0.36, 1] });
    const done = function () {
      els.panel.style.transform = "";
      panelAnim = null;
    };
    if (panelAnim && panelAnim.finished && typeof panelAnim.finished.then === "function") {
      panelAnim.finished.then(done).catch(function () { done(); });
    }
  }

  function isPanelOpen() {
    return !!(els.panel && els.panel.classList.contains("open"));
  }

  function updatePeek(tx) {
    if (!els.panelPeek) return;
    if (!tx) {
      els.panelPeek.textContent = "";
      if (els.panelTitle) els.panelTitle.textContent = "Find a transaction";
      return;
    }
    const d = TracerCurrency.describeAmount(tx.delivered != null ? tx.delivered : null);
    const bits = [];
    if (tx.delivered != null) bits.push(d.text);
    else bits.push(tx.type || "Transaction");
    if (!tx.validated) bits.push("not validated");
    else if (tx.result && tx.result !== "tesSUCCESS") bits.push(tx.result);
    else if (tx.flagged) bits.push("flagged");
    els.panelPeek.textContent = bits.join(" · ");
    if (els.panelTitle) els.panelTitle.textContent = tx.type || "Transaction";
  }

  const state = {
    watching: [],
    lastTx: null,
    lastError: null,
    connected: false,
    server: "",
    ledger: null,
    ambientShown: 0,
    ambientWindowStart: 0,
    streamSeen: 0,
    lookups: 0,
    subscribeOk: false,
    alerts: [],
  };

  const map = new TracerMap(document.getElementById("map"));

  const client = new XrplClient({
    onStatus: onStatus,
    onTransaction: onStreamTx,
    onLedger: function (msg) {
      state.ledger = msg.ledger_index;
      refreshStatus();
    },
    onError: function (err) {
      state.lastError = String(err && err.message ? err.message : err);
      hint(state.lastError, true);
    },
  });

  function onStatus(s) {
    state.connected = s.state === "up";
    state.server = s.url || state.server;
    els.statusDot.dataset.state = s.state;
    refreshStatus(s.message);
  }

  function refreshStatus(message) {
    const bits = [];
    if (message) bits.push(message);
    else if (state.connected) bits.push("Mainnet · " + hostOf(state.server));
    else bits.push("Connecting to mainnet…");
    if (state.ledger) bits.push("ledger " + state.ledger);
    if (state.watching.length === 1) bits.push("watching " + TracerCurrency.shortAddr(state.watching[0]));
    else if (state.watching.length > 1) bits.push("watching " + state.watching.length + " wallets");
    if (state.alerts.length) bits.push(state.alerts.length + " flagged");
    els.statusText.textContent = bits.join("  ·  ");
  }

  function hostOf(url) {
    try { return new URL(url).host; } catch (e) { return url || ""; }
  }

  function hint(text, isErr) {
    els.hint.textContent = text;
    els.hint.classList.toggle("err", !!isErr);
  }

  function readExpected() {
    const amt = TracerRoute.parseExpectedAmount(els.expectAmount && els.expectAmount.value);
    const destRaw = els.expectDest ? TracerCurrency.classifyInput(els.expectDest.value) : { kind: "empty" };
    return {
      amount: amt,
      destination: destRaw.kind === "address" ? destRaw.value : null,
    };
  }

  function parseList(raw) {
    const parts = String(raw || "").split(/[\s,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    const addresses = [], hashes = [], invalid = [];
    for (let i = 0; i < parts.length; i++) {
      const c = TracerCurrency.classifyInput(parts[i]);
      if (c.kind === "address") addresses.push(c.value);
      else if (c.kind === "hash") hashes.push(c.value.toUpperCase());
      else invalid.push(parts[i]);
    }
    const uniq = function (arr) { return arr.filter(function (v, i, a) { return a.indexOf(v) === i; }); };
    return { addresses: uniq(addresses), hashes: uniq(hashes), invalid: invalid };
  }

  function loadWatches() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter(function (x) { return x && x.address; }).slice(0, MAX_WATCH) : [];
    } catch (e) {
      return [];
    }
  }

  function saveWatches(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_WATCH))); }
    catch (e) { /* private mode */ }
  }

  function renderWatches() {
    const saved = loadWatches();
    els.watches.innerHTML = "";
    saved.forEach(function (item) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (state.watching.indexOf(item.address) !== -1 ? " active" : "");
      chip.title = item.address;
      chip.textContent = TracerCurrency.shortAddr(item.address) + " ";
      const x = document.createElement("span");
      x.className = "x";
      x.textContent = "×";
      x.title = "Remove from this device";
      chip.appendChild(x);
      chip.addEventListener("click", function (ev) {
        if (ev.target === x) {
          ev.preventDefault();
          const next = loadWatches().filter(function (w) { return w.address !== item.address; });
          saveWatches(next);
          if (state.watching.indexOf(item.address) !== -1) {
            const remain = state.watching.filter(function (a) { return a !== item.address; });
            if (remain.length) watchAddresses(remain);
            else clearWatch();
          } else renderWatches();
          return;
        }
        els.q.value = item.address;
        watchAddresses([item.address]);
      });
      els.watches.appendChild(chip);
    });
  }

  function remember(address) {
    const list = loadWatches().filter(function (w) { return w.address !== address; });
    list.unshift({ address: address, addedAt: Date.now() });
    saveWatches(list);
    renderWatches();
  }

  function isWatchedTx(tx) {
    return !!(tx && (state.watching.indexOf(tx.account) !== -1 || (tx.destination && state.watching.indexOf(tx.destination) !== -1)));
  }

  function applyFlags(tx) {
    const verdict = TracerRoute.assess(tx, readExpected());
    tx.flagReasons = verdict.reasons;
    tx.flagged = verdict.flagged;
    return verdict;
  }

  function addAlert(tx, reasons) {
    if (!tx || !reasons || !reasons.length) return;
    const id = tx.hash || (tx.account + ":" + tx.ledgerIndex + ":" + reasons[0]);
    if (state.alerts.some(function (a) { return a.id === id; })) return;
    state.alerts.unshift({ id: id, hash: tx.hash, tx: tx, reasons: reasons.slice(), at: Date.now() });
    if (state.alerts.length > 40) state.alerts.length = 40;
    renderAlerts();
    refreshStatus();
  }

  function terseReason(r) {
    const t = String(r || "");
    if (t.indexOf("Result ") === 0) {
      const code = t.slice(7).split(" ")[0];
      return code || "Failed";
    }
    if (t.indexOf("Partial payment") === 0) return "Partial payment";
    if (t.indexOf("Unverified issuer") === 0) return "Unverified issuer";
    if (t.indexOf("Delivered amount does not") === 0 || t.indexOf("Amount does not") === 0) return "Amount mismatch";
    if (t.indexOf("Destination") === 0 || t.indexOf("No destination") === 0) return "Dest mismatch";
    if (t.indexOf("Not final") === 0) return "Not validated";
    return t.length > 28 ? t.slice(0, 26) + "…" : t;
  }

  function renderAlerts() {
    const n = state.alerts.length;
    if (els.alerts) els.alerts.hidden = n === 0;
    if (els.alertCount) els.alertCount.textContent = n ? String(n) : "";
    if (els.alertList) {
      els.alertList.innerHTML = "";
      state.alerts.forEach(function (a) {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "alert-item";
        const title = (a.hash ? a.hash.slice(0, 8) + "…" : "tx") + " · " + (a.tx && a.tx.type ? a.tx.type : "Transaction");
        btn.innerHTML = "<strong>" + esc(title) + "</strong><span>" + esc(a.reasons.join(" · ")) + "</span>";
        btn.addEventListener("click", function () {
          if (a.tx) {
            map.addPing(a.tx, { watched: true, priority: true, flagged: true, focus: true });
            showHud(a.tx);
          }
        });
        li.appendChild(btn);
        els.alertList.appendChild(li);
      });
    }
    const box = els.mapFlags;
    if (!box) return;
    box.innerHTML = "";
    if (!n) { box.hidden = true; return; }
    box.hidden = false;
    state.alerts.slice(0, 3).forEach(function (a) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "map-flag";
      chip.textContent = terseReason(a.reasons[0] || "Flagged");
      chip.title = a.reasons.join(" · ");
      chip.addEventListener("click", function () {
        if (a.tx) {
          map.addPing(a.tx, { watched: true, priority: true, flagged: true, focus: true });
          showHud(a.tx);
        } else {
          setPanel(true);
        }
      });
      box.appendChild(chip);
    });
  }

  function pingTx(tx, opts) {
    opts = opts || {};
    const verdict = applyFlags(tx);
    const watched = opts.watched || isWatchedTx(tx);
    if (watched || opts.alert) {
      if (verdict.flagged) addAlert(tx, verdict.reasons);
    }
    map.addPing(tx, {
      watched: watched,
      priority: opts.priority || watched || verdict.flagged,
      flagged: verdict.flagged,
      focus: opts.focus,
    });
    if (opts.focus || (watched && verdict.flagged)) showHud(tx);
    return verdict;
  }

  function onStreamTx(tx) {
    state.streamSeen += 1;
    const watched = isWatchedTx(tx);
    if (!watched) {
      const now = performance.now();
      if (now - state.ambientWindowStart > 1000) {
        state.ambientWindowStart = now;
        state.ambientShown = 0;
      }
      if (state.ambientShown >= MAX_AMBIENT_PER_SEC) return;
      if (state.ambientShown > 12 && Math.random() > 0.45) return;
      state.ambientShown += 1;
    }
    pingTx(tx, { watched: watched, priority: watched, focus: watched, alert: watched });
  }

  function flagClass(reason) {
    const t = String(reason || "");
    if (t.indexOf("Result ") === 0 || t.indexOf("Destination") === 0 || t.indexOf("No destination") === 0 || t.indexOf("Delivered amount does not") === 0 || t.indexOf("Not final") === 0) {
      return "flag fail";
    }
    return "flag";
  }

  function involvementNotes(tx) {
    const notes = [];
    if (tx.hasDex) notes.push("DEX offer consumed (from metadata)");
    if (tx.hasAmm) notes.push("AMM pool used (from metadata)");
    if (tx.hasPath && !tx.hasDex && !tx.hasAmm) notes.push("Paths specified (not necessarily taken)");
    return notes;
  }

  function resultHtml(tx) {
    if (!tx.validated) {
      return '<span class="flag fail">Not final — this transaction is not in a validated ledger yet.</span>';
    }
    const code = tx.result || "—";
    if (code === "tesSUCCESS") {
      return '<span class="flag ok">tesSUCCESS (final)</span>';
    }
    if (String(code).indexOf("tec") === 0) {
      return '<span class="flag fail">' + esc(code) + " — the intended operation did not succeed. This result is final. The fee was still charged.</span>";
    }
    if (code === "—") {
      return '<span class="flag">Result not available</span>';
    }
    return '<span class="flag fail">' + esc(code) + " — the intended operation did not succeed. This result is final (validated ledger).</span>";
  }

  function showHud(tx) {
    state.lastTx = tx;
    els.hudEmpty.hidden = true;
    els.hudDl.hidden = false;
    const fee = TracerCurrency.formatXrp(tx.fee || "0");
    const shortPay = TracerRoute.isPartialPayment(tx);
    const rows = [];

    function add(k, html) { rows.push("<dt>" + k + "</dt><dd>" + html + "</dd>"); }

    add("Type", esc(tx.type || "—"));
    add("Validated", tx.validated ? '<span class="flag ok">Yes — in a validated ledger</span>' : '<span class="flag fail">No — result is not final</span>');

    if (tx.delivered != null) {
      const delivered = TracerCurrency.describeAmount(tx.delivered);
      let amountHtml = '<span class="amount">' + esc(delivered.text) + "</span>";
      if (delivered.known) amountHtml += '<span class="flag ok">Known issuer · ' + esc(delivered.known.name) + "</span>";
      else if (delivered.unverified) amountHtml += '<span class="flag" title="' + esc(TracerCurrency.unverifiedIssuerReason(delivered.currency, delivered.issuer)) + '">Unverified issuer</span>';
      if (shortPay) amountHtml += '<span class="flag">Partial payment (tfPartialPayment)</span>';
      involvementNotes(tx).forEach(function (n) { amountHtml += '<span class="flag">' + esc(n) + "</span>"; });
      add("Delivered", amountHtml);
      add("Currency", esc(delivered.currency) + (delivered.isXrp ? "" : " (issued)"));
      if (!delivered.isXrp && delivered.issuer) {
        const tip = delivered.known
          ? " · " + esc(delivered.known.name)
          : ' <span class="flag" title="' + esc(TracerCurrency.unverifiedIssuerReason(delivered.currency, delivered.issuer)) + '">Unverified issuer — not in this tool\'s known-issuer list; xrp-ledger.toml is not checked</span>';
        add("Issuer", addrLink(delivered.issuer, true) + tip);
      }
    } else if (tx.type === "Payment") {
      add("Delivered", tx.result && tx.result !== "tesSUCCESS" ? "None — this payment did not succeed, so nothing was delivered." : "—");
    }

    if (tx.type === "Payment" && tx.amount != null) {
      const requested = esc(TracerCurrency.describeAmount(tx.amount).text);
      if (tx.result && tx.result !== "tesSUCCESS") {
        add("Requested amount", requested + ' <span class="flag">Not delivered — this payment did not succeed</span>');
      } else if (tx.delivered == null || TracerRoute.isDeliveredShort(tx.amount, tx.delivered) || TracerRoute.hasPartialPaymentFlag(tx)) {
        add("Amount (max)", requested);
      }
    }
    if (tx.sendMax != null) add("SendMax", esc(TracerCurrency.describeAmount(tx.sendMax).text));
    if (tx.takerPays != null) add("TakerPays", esc(TracerCurrency.describeAmount(tx.takerPays).text));
    if (tx.takerGets != null) add("TakerGets", esc(TracerCurrency.describeAmount(tx.takerGets).text));
    if (tx.limitAmount != null) add("Limit", esc(TracerCurrency.describeAmount(tx.limitAmount).text));
    if (tx.nftokenID) add("NFTokenID", esc(tx.nftokenID));
    if (tx.asset) add("Asset", esc(assetLabel(tx.asset)));
    if (tx.asset2) add("Asset2", esc(assetLabel(tx.asset2)));

    add("Sender", addrLink(tx.account, true));
    add("Receiver", tx.destination ? addrLink(tx.destination, true) : "—");
    if (tx.destinationTag != null) add("Dest. tag", esc(String(tx.destinationTag)));
    if (tx.hops && tx.hops.length) {
      const bits = tx.hops.map(function (h) {
        const cls = h.unexpected ? ' class="hop unexpected"' : ' class="hop"';
        const note = h.unexpected ? " · unverified issuer" : "";
        return "<span" + cls + ">" + esc(h.label || h.kind) + note + "</span>";
      });
      add("Route", bits.join(" <span class=\"arrow\">→</span> ") + '<div class="hint">Hops shown are from ledger metadata (consumed offers or AMM pools), not from the Paths field.</div>');
    } else {
      const notes = involvementNotes(tx);
      if (notes.length) add("Route", notes.map(function (n) { return '<span class="flag">' + esc(n) + "</span>"; }).join(" "));
    }
    if (tx.flagReasons && tx.flagReasons.length) {
      add("Flags", tx.flagReasons.map(function (r) { return '<span class="' + flagClass(r) + '">' + esc(r) + "</span>"; }).join(" "));
    }
    add("Fee", esc(fee));
    add("Result", resultHtml(tx));
    add("Ledger", esc(tx.ledgerIndex != null ? String(tx.ledgerIndex) : "—"));
    add("Time (Sydney)", esc(TracerCurrency.rippleTimeToSydney(tx.date)));
    if (tx.hash) {
      add("Hash", '<a href="https://livenet.xrpl.org/transactions/' + encodeURIComponent(tx.hash) + '" target="_blank" rel="noopener noreferrer">' + esc(tx.hash.slice(0, 8) + "…" + tx.hash.slice(-8)) + " · livenet.xrpl.org</a>");
    }
    if (els.hudTitle) els.hudTitle.textContent = "Transaction";
    els.hudDl.innerHTML = rows.join("");
    updatePeek(tx);
    setPanel(true);
    if (els.hud) {
      try { els.hud.scrollIntoView({ block: "nearest" }); } catch (e) { /* ignore */ }
    }
  }



  function updateNodePeek(node) {
    if (!els.panelPeek) return;
    const bits = [TracerCurrency.shortAddr(node.addr)];
    if (state.watching.indexOf(node.addr) !== -1) bits.push("watching");
    if (node.hub) bits.push("hub ×" + node.count);
    if (node.unexpected) bits.push("unverified hop");
    else if (node.route) bits.push("route hop");
    els.panelPeek.textContent = bits.join(" · ");
    if (els.panelTitle) els.panelTitle.textContent = "Account";
  }

  function showNode(node) {
    if (!node) return;
    state.lastNode = node;
    els.hudEmpty.hidden = true;
    els.hudDl.hidden = false;
    if (els.hudTitle) els.hudTitle.textContent = "Account";
    const rows = [];
    function add(k, html) { rows.push("<dt>" + k + "</dt><dd>" + html + "</dd>"); }
    add("Address", addrLink(node.addr, false));
    const tags = [];
    if (state.watching.indexOf(node.addr) !== -1) tags.push('<span class="flag ok">Watching</span>');
    if (node.hub) tags.push('<span class="flag">Hub ×' + esc(String(node.count || 0)) + "</span>");
    if (node.unexpected) tags.push('<span class="flag fail">Unverified hop</span>');
    else if (node.route) tags.push('<span class="flag">Route hop</span>');
    add("Status", tags.length ? tags.join(" ") : '<span class="flag ok">Account</span>');
    add("Activity", esc(String(node.count || 0)) + " transaction" + ((node.count || 0) === 1 ? "" : "s") + " seen on this view in the last 20s (includes other live mainnet transactions)");
    const recent = (node.recent || []).slice(0, 8);
    const flagSet = [];
    recent.forEach(function (r) {
      const reasons = (r.tx && r.tx.flagReasons) || [];
      reasons.forEach(function (reason) {
        if (flagSet.indexOf(reason) === -1) flagSet.push(reason);
      });
    });
    if (flagSet.length) {
      add("Flags", flagSet.map(function (r) { return '<span class="flag fail">' + esc(r) + "</span>"; }).join(" "));
    } else {
      add("Flags", "None on recent pings in this view");
    }
    if (recent.length) {
      const items = recent.map(function (r) {
        const tx = r.tx || {};
        const d = TracerCurrency.describeAmount(tx.delivered != null ? tx.delivered : null);
        const dir = r.dir === "in" ? "in" : r.dir === "out" ? "out" : "hop";
        const cls = "recent-tx" + (r.flagged || tx.flagged ? " flagged" : "");
        const hash = tx.hash ? esc(tx.hash) : "";
        const amt = tx.delivered != null ? d.text : (tx.type || "tx");
        const label = dir + " · " + esc(amt) + (tx.result && tx.result !== "tesSUCCESS" ? " · " + esc(tx.result) : (r.flagged || tx.flagged ? " · flagged" : ""));
        return '<button type="button" class="' + cls + '" data-tx-hash="' + hash + '">' + label + "</button>";
      }).join("");
      add("Recent", '<div class="recent">' + items + "</div>");
    } else {
      add("Recent", "No recent pings on this view yet. Ambient traffic comes and goes.");
    }
    add("Explorer", '<a href="https://livenet.xrpl.org/accounts/' + encodeURIComponent(node.addr) + '" target="_blank" rel="noopener noreferrer">livenet.xrpl.org</a>');
    els.hudDl.innerHTML = rows.join("");
    updateNodePeek(node);
    setPanel(true);
    if (els.hud) {
      try { els.hud.scrollIntoView({ block: "nearest" }); } catch (e) { /* ignore */ }
    }
  }

  function assetLabel(asset) {
    if (asset == null) return "—";
    if (typeof asset === "string") return asset === "XRP" || !asset.currency ? "XRP" : String(asset);
    if (asset.currency === "XRP" || (!asset.currency && !asset.issuer && !asset.mpt_issuance_id)) return "XRP";
    const cur = TracerCurrency.decodeCurrency(asset.currency);
    return cur + (asset.issuer ? " · " + TracerCurrency.shortAddr(asset.issuer) : "");
  }

  function addrLink(addr, compact) {
    if (!addr) return "—";
    const label = compact ? TracerCurrency.shortAddr(addr) : addr;
    return '<a href="https://livenet.xrpl.org/accounts/' + encodeURIComponent(addr) + '" target="_blank" rel="noopener noreferrer" title="' + esc(addr) + '">' + esc(label) + "</a>";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function watchAddresses(addresses) {
    const addrs = (addresses || []).filter(Boolean).slice(0, MAX_WATCH);
    if (!addrs.length) return Promise.resolve();
    hint("Subscribing to " + addrs.length + " wallet" + (addrs.length > 1 ? "s" : "") + "…", false);
    return client.clearWatches().then(function () {
      state.watching = addrs.slice();
      map.setWatched(state.watching);
      addrs.forEach(remember);
      return client.watchAccounts(addrs);
    }).then(function () {
      state.subscribeOk = true;
      hint("Watching " + addrs.map(TracerCurrency.shortAddr).join(", ") + ". Loading recent hops…", false);
      refreshStatus();
      renderWatches();
      return addrs.reduce(function (chain, address) {
        return chain.then(function (all) {
          return client.fetchAccountTx(address, 10).then(function (rows) {
            return all.concat(rows || []);
          }).catch(function () { return all; });
        });
      }, Promise.resolve([]));
    }).then(function (rows) {
      const payments = rows.filter(function (t) { return t.account || t.destination; });
      payments.slice().reverse().forEach(function (tx, i, arr) {
        pingTx(tx, { watched: true, priority: true, focus: i === arr.length - 1, alert: true });
      });
      if (!payments.length) hint("Watching " + addrs.length + " wallet" + (addrs.length > 1 ? "s" : "") + ". Waiting for the next validated payment.", false);
      else hint("Watching " + addrs.length + " wallet" + (addrs.length > 1 ? "s" : "") + ". Recent hops are on the map.", false);
    }).catch(function (err) {
      state.subscribeOk = false;
      state.lastError = err.message || String(err);
      hint("Could not watch that account: " + state.lastError, true);
    });
  }

  function clearWatch() {
    client.clearWatches();
    state.watching = [];
    state.subscribeOk = false;
    map.setWatched([]);
    renderWatches();
    refreshStatus();
    hint("Watch cleared. Ambient traffic is still flowing.", false);
  }

  function lookupHash(hash) {
    hint("Looking up transaction…", false);
    return client.fetchTx(hash).then(function (tx) {
      if (!tx) throw new Error("Transaction not found");
      state.lookups += 1;
      pingTx(tx, { watched: true, priority: true, focus: true, alert: true });
      showHud(tx);
      const flagBit = tx.flagged ? " Flagged." : "";
      hint("Replaying " + tx.type + " " + TracerCurrency.shortAddr(tx.hash) + "." + flagBit, false);
      return tx;
    }).catch(function (err) {
      state.lastError = err.message || String(err);
      hint("Lookup failed: " + state.lastError, true);
    });
  }

  function lookupHashes(hashes) {
    const list = (hashes || []).slice(0, MAX_BATCH);
    if (!list.length) return Promise.resolve([]);
    hint("Looking up " + list.length + " transaction" + (list.length > 1 ? "s" : "") + "…", false);
    const found = [];
    return list.reduce(function (chain, hash, idx) {
      return chain.then(function () {
        return client.fetchTx(hash).then(function (tx) {
          if (!tx) return;
          state.lookups += 1;
          found.push(tx);
          pingTx(tx, { watched: true, priority: true, focus: idx === list.length - 1, alert: true });
          if (idx === list.length - 1) showHud(tx);
        }).catch(function (err) {
          state.lastError = err.message || String(err);
        });
      });
    }, Promise.resolve()).then(function () {
      const failed = found.filter(function (t) { return t.validated && t.result && t.result !== "tesSUCCESS"; }).length;
      const pending = found.filter(function (t) { return !t.validated; }).length;
      const missing = list.length - found.length;
      let msg = "Looked up " + found.length + " of " + list.length + " transaction" + (list.length > 1 ? "s" : "") + ". ";
      msg += failed + " did not succeed (non-tesSUCCESS).";
      if (pending) msg += " " + pending + " not yet validated.";
      if (missing) msg += " " + missing + " could not be loaded.";
      hint(msg, false);
      return found;
    });
  }

  function handleGo(prefer) {
    const parsed = parseList(els.q.value);
    if (!parsed.addresses.length && !parsed.hashes.length) {
      hint("Paste an r-address or a 64-character tx hash. This never connects a wallet.", true);
      els.q.focus();
      return;
    }
    if (parsed.invalid.length && !parsed.addresses.length && !parsed.hashes.length) {
      hint("That does not look like a classic r-address or a transaction hash. Check it and try again.", true);
      return;
    }
    if (prefer === "watch") {
      if (parsed.addresses.length) {
        const jobs = [watchAddresses(parsed.addresses)];
        if (parsed.hashes.length) jobs.push(lookupHashes(parsed.hashes));
        return Promise.all(jobs);
      }
      hint("That looks like transaction hash" + (parsed.hashes.length > 1 ? "es" : "") + ", so I'm looking " + (parsed.hashes.length > 1 ? "them" : "it") + " up rather than watching a wallet.", false);
      return lookupHashes(parsed.hashes);
    }
    if (prefer === "lookup") {
      if (parsed.hashes.length) {
        const jobs = [lookupHashes(parsed.hashes)];
        if (parsed.addresses.length) jobs.push(watchAddresses(parsed.addresses));
        return Promise.all(jobs);
      }
      hint("That looks like " + (parsed.addresses.length > 1 ? "addresses, so I'm watching them" : "an address, so I'm watching it") + " for live payments.", false);
      return watchAddresses(parsed.addresses);
    }
    if (parsed.hashes.length && !parsed.addresses.length) return lookupHashes(parsed.hashes);
    if (parsed.addresses.length && !parsed.hashes.length) return watchAddresses(parsed.addresses);
    return Promise.all([watchAddresses(parsed.addresses), lookupHashes(parsed.hashes)]);
  }

  map.onHover = function (node, sx, sy) {
    const tip = els.tooltip;
    if (!node) { tip.hidden = true; return; }
    tip.hidden = false;
    const watched = state.watching.indexOf(node.addr) !== -1;
    let extra = "";
    if (node.unexpected) extra += "  ·  unverified issuer on a metadata hop";
    else if (node.route) extra += "  ·  route hop from metadata";
    else if (node.hub) extra += "  ·  high-volume hub ×" + node.count;
    if (!watched && !node.route && !node.unexpected) extra += "  ·  other live mainnet transactions (not part of your lookup)";
    if (watched) extra += "  ·  watching";
    tip.textContent = node.addr + extra;
    const stage = document.querySelector(".stage").getBoundingClientRect();
    tip.style.left = Math.min(sx + 14, stage.width - 180) + "px";
    tip.style.top = Math.max(8, sy - 28) + "px";
  };

  map.onClick = function (node, ping) {
    if (node) {
      map.selectNode(node.addr);
      showNode(node);
      return;
    }
    if (ping && ping.tx) {
      map.selectNode(null);
      showHud(ping.tx);
      return;
    }
    map.selectNode(null);
    setPanel(false);
  };

  if (els.panelToggle) {
    els.panelToggle.addEventListener("click", function () { setPanel(!isPanelOpen()); });
  }
  if (els.btnSearch) {
    els.btnSearch.addEventListener("click", function () {
      setPanel(true);
      if (els.q) els.q.focus();
    });
  }
  if (els.btnReset) {
    els.btnReset.addEventListener("click", function () {
      map.resetView();
    });
  }
  if (els.hudDl) {
    els.hudDl.addEventListener("click", function (ev) {
      const btn = ev.target.closest ? ev.target.closest("[data-tx-hash]") : null;
      if (!btn) return;
      const hash = btn.getAttribute("data-tx-hash");
      if (!hash) return;
      const node = state.lastNode;
      const rec = node && node.recent ? node.recent : [];
      for (let i = 0; i < rec.length; i++) {
        if (rec[i].tx && rec[i].tx.hash === hash) {
          const ping = map.addPing(rec[i].tx, { watched: true, priority: true, flagged: !!rec[i].tx.flagged, focus: true });
          showHud(rec[i].tx);
          return;
        }
      }
      lookupHash(hash);
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isPanelOpen()) setPanel(false);
  });

  els.watch.addEventListener("click", function () { handleGo("watch"); });
  els.lookup.addEventListener("click", function () { handleGo("lookup"); });
  els.clear.addEventListener("click", clearWatch);
  els.example.addEventListener("click", function () {
    els.q.value = EXAMPLE_HASH;
    lookupHash(EXAMPLE_HASH);
  });
  els.q.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey || els.q.tagName === "INPUT")) {
      e.preventDefault();
      handleGo();
    }
  });

  renderWatches();
  renderAlerts();
  client.connect();

  window.__tracer = {
    state: state,
    client: client,
    map: map,
    watchAddress: function (a) { return watchAddresses([a]); },
    watchAddresses: watchAddresses,
    lookupHash: lookupHash,
    lookupHashes: lookupHashes,
    exampleHash: EXAMPLE_HASH,
    readExpected: readExpected,
    focusNetwork: function () { map.focusNetwork(); },
    fitAll: function () { map.fitAll(); },
    resetView: function (instant) { map.resetView(instant); },
    selectNode: function (addr) {
      const n = map.ensureNode(addr, true);
      map.focusNode(addr);
      if (n) showNode(n);
      return n;
    },
    showNode: showNode,
    openPanel: function () { setPanel(true); },
    closePanel: function () { setPanel(false); },
    isPanelOpen: isPanelOpen,
  };
})();
