/* Read-only XRPL mainnet WebSocket client. Never signs, never asks for keys. */
(function (global) {
  "use strict";

  const SERVERS = [
    "wss://xrplcluster.com",
    "wss://s1.ripple.com",
    "wss://s2.ripple.com",
  ];

  function XrplClient(opts) {
    this.servers = (opts && opts.servers) || SERVERS;
    this.onStatus = (opts && opts.onStatus) || function () {};
    this.onTransaction = (opts && opts.onTransaction) || function () {};
    this.onLedger = (opts && opts.onLedger) || function () {};
    this.onError = (opts && opts.onError) || function () {};
    this.ws = null;
    this.serverIndex = 0;
    this.serverUrl = "";
    this.nextId = 1;
    this.pending = new Map();
    this.watched = new Set();
    this.wantStream = true;
    this.connected = false;
    this.closed = false;
    this.backoff = 500;
    this.keepAlive = null;
    this.reconnectTimer = null;
    this.ledgerIndex = null;
  }

  XrplClient.prototype.connect = function () {
    this.closed = false;
    this._open(this.servers[this.serverIndex % this.servers.length]);
  };

  XrplClient.prototype.disconnect = function () {
    this.closed = true;
    this.connected = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.keepAlive) clearInterval(this.keepAlive);
    this.keepAlive = null;
    if (this.ws) {
      try { this.ws.close(); } catch (e) { /* ignore */ }
      this.ws = null;
    }
  };

  XrplClient.prototype._open = function (url) {
    const self = this;
    if (this.closed) return;
    this.serverUrl = url;
    this.connected = false;
    this.onStatus({ state: "wait", url: url, message: "Connecting to " + hostOf(url) + "…" });
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      this._fail(err);
      return;
    }
    this.ws = ws;

    ws.onopen = function () {
      if (self.ws !== ws) return;
      self.connected = true;
      self.backoff = 500;
      self.onStatus({ state: "up", url: url, message: "Mainnet · " + hostOf(url) });
      self._resubscribe();
      if (self.keepAlive) clearInterval(self.keepAlive);
      self.keepAlive = setInterval(function () {
        self.request("ping", {}).catch(function () { /* reconnect path handles it */ });
      }, 25000);
    };

    ws.onmessage = function (ev) {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      self._handle(msg);
    };

    ws.onerror = function () {
      // close handler drives reconnect
    };

    ws.onclose = function () {
      if (self.ws !== ws) return;
      self.connected = false;
      self.ws = null;
      if (self.keepAlive) clearInterval(self.keepAlive);
      self.keepAlive = null;
      self.pending.forEach(function (p) {
        p.reject(new Error("Connection closed"));
      });
      self.pending.clear();
      if (!self.closed) self._scheduleReconnect();
    };
  };

  XrplClient.prototype._scheduleReconnect = function () {
    const self = this;
    this.serverIndex = (this.serverIndex + 1) % this.servers.length;
    const wait = this.backoff;
    this.backoff = Math.min(this.backoff * 2, 15000);
    const next = this.servers[this.serverIndex];
    this.onStatus({
      state: "wait",
      url: next,
      message: "Reconnecting in " + Math.round(wait / 1000) + "s · " + hostOf(next),
    });
    this.reconnectTimer = setTimeout(function () {
      self._open(next);
    }, wait);
  };

  XrplClient.prototype._fail = function (err) {
    this.onError(err);
    if (!this.closed) this._scheduleReconnect();
  };

  XrplClient.prototype._handle = function (msg) {
    if (msg.type === "transaction") {
      // Only surface validated ledger data as a finished transaction.
      if (msg.validated !== true) return;
      const norm = normalizeTx(msg);
      if (norm) this.onTransaction(norm, "stream");
      return;
    }
    if (msg.type === "ledgerClosed") {
      this.ledgerIndex = msg.ledger_index;
      this.onLedger(msg);
      return;
    }
    if (msg.id != null && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.status === "error" || msg.error) {
        p.reject(new Error(msg.error_message || msg.error || "XRPL error"));
      } else {
        p.resolve(msg.result || msg);
      }
    }
  };

  XrplClient.prototype.request = function (command, params) {
    const self = this;
    return new Promise(function (resolve, reject) {
      if (!self.ws || self.ws.readyState !== 1) {
        reject(new Error("Not connected"));
        return;
      }
      const id = self.nextId++;
      const body = Object.assign({ id: id, command: command }, params || {});
      self.pending.set(id, { resolve: resolve, reject: reject });
      try {
        self.ws.send(JSON.stringify(body));
      } catch (err) {
        self.pending.delete(id);
        reject(err);
        return;
      }
      setTimeout(function () {
        if (self.pending.has(id)) {
          self.pending.delete(id);
          reject(new Error("Request timed out: " + command));
        }
      }, 20000);
    });
  };

  XrplClient.prototype._resubscribe = function () {
    const streams = [];
    if (this.wantStream) streams.push("transactions", "ledger");
    const payload = {};
    if (streams.length) payload.streams = streams;
    if (this.watched.size) payload.accounts = Array.from(this.watched);
    if (!payload.streams && !payload.accounts) return;
    this.request("subscribe", payload).catch((err) => this.onError(err));
  };

  XrplClient.prototype.watchAccount = function (address) {
    return this.watchAccounts([address]);
  };

  XrplClient.prototype.watchAccounts = function (addresses) {
    const list = (addresses || []).filter(Boolean);
    for (let i = 0; i < list.length; i++) this.watched.add(list[i]);
    if (!this.connected || !list.length) return Promise.resolve();
    return this.request("subscribe", { accounts: list });
  };

  XrplClient.prototype.unwatchAccount = function (address) {
    this.watched.delete(address);
    if (!this.connected) return Promise.resolve();
    return this.request("unsubscribe", { accounts: [address] });
  };

  XrplClient.prototype.clearWatches = function () {
    const addrs = Array.from(this.watched);
    this.watched.clear();
    if (!this.connected || !addrs.length) return Promise.resolve();
    return this.request("unsubscribe", { accounts: addrs });
  };

  XrplClient.prototype.fetchTx = function (hash) {
    return this.request("tx", { transaction: hash, binary: false }).then(function (result) {
      return normalizeTxCommand(result);
    });
  };

  XrplClient.prototype.fetchAccountTx = function (address, limit) {
    return this.request("account_tx", {
      account: address,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: limit || 15,
      forward: false,
    }).then(function (result) {
      const out = [];
      const rows = (result && result.transactions) || [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const norm = normalizeTxCommand(row);
        if (norm && norm.validated) out.push(norm);
      }
      return out;
    });
  };

  function hostOf(url) {
    try { return new URL(url).host; } catch (e) { return url; }
  }

  function normalizeTx(msg) {
    const tx = msg.transaction || msg.tx_json || msg.tx;
    if (!tx) return null;
    return buildNorm(tx, msg.meta || msg.metaData, msg.ledger_index, msg.validated === true, msg.hash);
  }

  function normalizeTxCommand(result) {
    if (!result) return null;
    const tx = result.tx || result.tx_json || result.transaction || (result.TransactionType ? result : null);
    if (!tx) return null;
    const meta = result.meta || result.metaData || tx.meta || null;
    const ledgerIndex = result.ledger_index || tx.ledger_index;
    const validated = result.validated === true || tx.validated === true;
    const hash = result.hash || tx.hash;
    return buildNorm(tx, meta, ledgerIndex, validated, hash);
  }

  function deliveredFromMeta(meta) {
    if (!meta) return null;
    if (meta.delivered_amount != null) return meta.delivered_amount;
    if (meta.DeliveredAmount != null) return meta.DeliveredAmount;
    return null;
  }

  function buildNorm(tx, meta, ledgerIndex, validated, hashHint) {
    if (!tx || !tx.TransactionType) return null;
    meta = meta || {};
    // Official rule: always use meta.delivered_amount. Never fall back to Amount.
    const delivered = deliveredFromMeta(meta);
    const amount = tx.Amount != null ? tx.Amount : (tx.DeliverMax != null ? tx.DeliverMax : null);
    const resultCode = meta.TransactionResult || null;
    const norm = {
      hash: tx.hash || hashHint,
      type: tx.TransactionType,
      account: tx.Account,
      destination: tx.Destination || null,
      amount: amount,
      delivered: delivered,
      sendMax: tx.SendMax || null,
      deliverMin: tx.DeliverMin || null,
      paths: tx.Paths || null,
      flags: tx.Flags || 0,
      fee: tx.Fee,
      result: resultCode || "—",
      ledgerIndex: ledgerIndex,
      date: tx.date,
      destinationTag: tx.DestinationTag,
      validated: !!validated,
      affected: meta.AffectedNodes || [],
      takerGets: tx.TakerGets || null,
      takerPays: tx.TakerPays || null,
      limitAmount: tx.LimitAmount || null,
      nftokenID: tx.NFTokenID || null,
      nftokenOffers: tx.NFTokenOffers || null,
      asset: tx.Asset || null,
      asset2: tx.Asset2 || null,
    };
    if (global.TracerRoute) global.TracerRoute.enrich(norm);
    return norm;
  }

  global.XrplClient = XrplClient;
  global.XRPL_SERVERS = SERVERS;
})(window);
