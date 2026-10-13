// Testnet only. Mainnet is intentionally not wired up.
// Read-only: never asks for, accepts or stores a seed or secret key.
(function () {
  "use strict";
  const TESTNET = ["wss://s.altnet.rippletest.net:51233", "wss://testnet.xrpl-labs.com"];
  const out = document.getElementById("out"), btn = document.getElementById("btn");
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; }
  function show(cls, nodes) { out.className = "result " + cls; out.replaceChildren(...nodes); }
  function msg(cls, text) { show(cls, [document.createTextNode(text)]); }
  document.getElementById("f").addEventListener("submit", async e => {
    e.preventDefault();
    const addr = document.getElementById("addr").value.trim();
    if (!window.xrpl) return msg("err", "Couldn't load the XRPL library. Check your internet connection and refresh.");
    if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(addr) || !xrpl.isValidClassicAddress(addr)) {
      return msg("err", "That doesn't look like a valid XRP address. It should start with \"r\". (Never paste a seed or secret here.)");
    }
    btn.disabled = true; msg("ok", "Checking the Testnet ledger...");
    let client = null;
    try {
      for (const url of TESTNET) {
        const c = new xrpl.Client(url, { connectionTimeout: 6000 });
        try { await c.connect(); client = c; break; } catch (_) { try { await c.disconnect(); } catch (__) {} }
      }
      if (!client) throw new Error("no server");
      const r = await client.request({ command: "account_info", account: addr, ledger_index: "validated" });
      const xrp = xrpl.dropsToXrp(String(r.result.account_data.Balance));
      const ledger = Number(r.result.ledger_index);
      const line = el("div");
      line.append("Testnet balance for ", el("code", null, addr), " (validated ledger " + (Number.isFinite(ledger) ? ledger : "?") + ").");
      show("ok", [el("div", "big", xrp + " XRP"), line]);
    } catch (err) {
      const code = err && err.data && err.data.error;
      if (code === "actNotFound") msg("err", "Account not found. This address hasn't been funded on Testnet yet, so it doesn't exist on the ledger.");
      else msg("err", "Couldn't reach the Testnet right now. Please check your connection and try again in a moment.");
    } finally {
      try { if (client) await client.disconnect(); } catch (_) {}
      btn.disabled = false;
    }
  });
})();
