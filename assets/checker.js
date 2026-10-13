// Read-only XRPL balance checker for Testnet and Mainnet.
// The network comes ONLY from <body data-network="..."> in the page itself (never the URL or query),
// and each page's CSP connect-src only allows that network's servers.
// Never asks for, accepts or stores a seed or secret key. No innerHTML.
(function () {
  "use strict";
  const NETWORKS = Object.freeze({
    testnet: Object.freeze({ name: "Testnet", other: "mainnet", otherName: "Mainnet",
      servers: Object.freeze(["wss://s.altnet.rippletest.net:51233", "wss://testnet.xrpl-labs.com"]) }),
    mainnet: Object.freeze({ name: "Mainnet", other: "testnet", otherName: "Testnet",
      servers: Object.freeze(["wss://xrplcluster.com", "wss://s1.ripple.com"]) })
  });
  const key = document.body.getAttribute("data-network");
  if (!Object.prototype.hasOwnProperty.call(NETWORKS, key)) return;
  const NET = NETWORKS[key];
  const out = document.getElementById("out"), btn = document.getElementById("btn");
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; }
  function show(cls, nodes) { out.className = "result " + cls; out.replaceChildren(...nodes); }
  function msg(cls, text) { show(cls, [document.createTextNode(text)]); }
  function looksLikeSecret(s) { return /^s[1-9A-HJ-NP-Za-km-z]{20,}$/.test(s) || /\s/.test(s.trim()) && s.trim().split(/\s+/).length >= 12; }
  document.getElementById("f").addEventListener("submit", async e => {
    e.preventDefault();
    const raw = document.getElementById("addr").value;
    const addr = raw.trim();
    if (looksLikeSecret(raw)) {
      document.getElementById("addr").value = "";
      return msg("err", "That looks like a seed or secret key. Never paste it anywhere, including here. Only a public address (starting with \"r\") is needed.");
    }
    if (!window.xrpl) return msg("err", "Couldn't load the XRPL library. Check your internet connection and refresh.");
    if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(addr) || !xrpl.isValidClassicAddress(addr)) {
      return msg("err", "That doesn't look like a valid XRP address. It should start with \"r\". (Never paste a seed or secret here.)");
    }
    btn.disabled = true; msg("ok", "Checking the " + NET.name + " ledger...");
    let client = null;
    try {
      for (const url of NET.servers) {
        const c = new xrpl.Client(url, { connectionTimeout: 6000 });
        try { await c.connect(); client = c; break; } catch (_) { try { await c.disconnect(); } catch (__) {} }
      }
      if (!client) throw new Error("no server");
      const r = await client.request({ command: "account_info", account: addr, ledger_index: "validated" });
      const xrp = xrpl.dropsToXrp(String(r.result.account_data.Balance));
      const ledger = Number(r.result.ledger_index);
      const line = el("div");
      line.append(NET.name + " balance for ", el("code", null, addr), " (validated ledger " + (Number.isFinite(ledger) ? ledger : "?") + ").");
      show("ok", [el("div", "big", xrp + " XRP"), line]);
    } catch (err) {
      const code = err && err.data && err.data.error;
      if (code === "actNotFound") {
        const a = el("a", null, "Try the " + NET.otherName + " checker.");
        a.href = "../" + NET.other + "/";
        show("err", [document.createTextNode("Not found on " + NET.name + ". This address hasn't been funded on " + NET.name + ", so it doesn't exist there yet. "), a]);
      } else msg("err", "Couldn't reach " + NET.name + " right now. Please check your connection and try again in a moment.");
    } finally {
      try { if (client) await client.disconnect(); } catch (_) {}
      btn.disabled = false;
    }
  });
})();
