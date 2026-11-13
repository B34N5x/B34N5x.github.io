/* Route hops from metadata, and flag checks. Read-only. Facts only. */
(function (global) {
  "use strict";

  const C = global.TracerCurrency;

  function nodeOf(entry) {
    const n = entry.CreatedNode || entry.ModifiedNode || entry.DeletedNode;
    if (!n) return null;
    return {
      type: n.LedgerEntryType,
      action: entry.CreatedNode ? "create" : entry.DeletedNode ? "delete" : "modify",
      fields: n.FinalFields || n.NewFields || {},
      prev: n.PreviousFields || {},
    };
  }

  function issuerOfAmount(amt) {
    if (!amt || typeof amt === "string") return null;
    return amt.issuer || null;
  }

  function currencyOfAmount(amt) {
    if (amt == null) return null;
    if (typeof amt === "string") return "XRP";
    return C.decodeCurrency(amt.currency);
  }

  function offerWasConsumed(n) {
    if (!n || n.type !== "Offer") return false;
    if (n.action !== "modify" && n.action !== "delete") return false;
    return !!(n.prev && (n.prev.TakerGets != null || n.prev.TakerPays != null));
  }

  function extractHops(tx) {
    const hops = [];
    const seen = new Set();

    function push(hop) {
      if (!hop) return;
      const key = [hop.kind, hop.account || "", hop.issuer || "", hop.currency || ""].join(":");
      if (seen.has(key)) return;
      seen.add(key);
      hops.push(hop);
    }

    // Only claim DEX / AMM involvement when metadata shows modified or deleted
    // Offer or AMM nodes. Paths is a list of candidate paths, not the path taken.
    // Rippling over trust lines (RippleState) is not listed as a hop.
    const affected = tx.affected || [];
    for (let i = 0; i < affected.length; i++) {
      const n = nodeOf(affected[i]);
      if (!n) continue;
      if (offerWasConsumed(n)) {
        const acct = n.fields.Account;
        if (!acct || acct === tx.account || acct === tx.destination) continue;
        const gets = currencyOfAmount(n.fields.TakerGets);
        const pays = currencyOfAmount(n.fields.TakerPays);
        const iss = issuerOfAmount(n.fields.TakerGets) || issuerOfAmount(n.fields.TakerPays);
        const known = iss ? (C.KNOWN_ISSUERS[iss] || null) : null;
        const tokenIssued = !!(iss && ((gets && gets !== "XRP") || (pays && pays !== "XRP")));
        push({
          kind: "offer",
          account: acct,
          issuer: iss,
          currency: gets || pays,
          label: "DEX offer" + (gets && pays ? " " + pays + "→" + gets : "") + " · " + C.shortAddr(acct),
          unexpected: !!(tokenIssued && !known),
        });
      }
      if (n.type === "AMM" && (n.action === "modify" || n.action === "delete")) {
        const acct = n.fields.Account || n.fields.AMMAccount;
        if (!acct || acct === tx.account || acct === tx.destination) continue;
        push({
          kind: "amm",
          account: acct,
          issuer: null,
          currency: null,
          label: "AMM pool · " + C.shortAddr(acct),
          unexpected: false,
        });
      }
    }

    return hops;
  }

  function waypointsFor(tx) {
    const hops = tx.hops || [];
    const pts = [];
    function add(addr) {
      if (addr && pts.indexOf(addr) === -1) pts.push(addr);
    }
    add(tx.account);
    for (let i = 0; i < hops.length; i++) add(hops[i].account);
    add(tx.destination);
    return pts;
  }

  const TF_PARTIAL_PAYMENT = 0x00020000;
  // Official token maximum: 9999999999999999e80. Official XRP maximum: 1e11 XRP = 1e17 drops.
  const MAX_IOU_VALUE = "9999999999999999e80";
  const MAX_XRP_DROPS = 100000000000000000n;

  function hasPartialPaymentFlag(txOrFlags) {
    const flags = (txOrFlags && typeof txOrFlags === "object")
      ? (txOrFlags.flags || 0)
      : (txOrFlags || 0);
    const type = (txOrFlags && typeof txOrFlags === "object") ? txOrFlags.type : null;
    if (type && type !== "Payment") return false;
    return (Number(flags || 0) & TF_PARTIAL_PAYMENT) === TF_PARTIAL_PAYMENT;
  }

  function isMaxAmount(amount) {
    if (amount == null || amount === "unavailable") return false;
    if (typeof amount === "string") {
      try { return BigInt(String(amount).trim()) >= MAX_XRP_DROPS; } catch (e) { return false; }
    }
    if (typeof amount === "object") {
      const v = amount.value;
      if (v == null || v === "") return false;
      const cmpMax = C.cmpDecimal(v, MAX_IOU_VALUE);
      if (cmpMax != null && cmpMax >= 0) return true;
      // Values at or above 1e70 are past any realistic payment and match the max-Amount DEX pattern.
      const cmpHuge = C.cmpDecimal(v, "1e70");
      return cmpHuge != null && cmpHuge >= 0;
    }
    return false;
  }

  function isDeliveredShort(amount, delivered) {
    if (amount == null || delivered == null || delivered === "unavailable") return false;
    if (typeof amount === "string" && typeof delivered === "string") {
      try { return BigInt(String(delivered).trim()) < BigInt(String(amount).trim()); } catch (e) {
        return false;
      }
    }
    if (typeof amount === "object" && typeof delivered === "object") {
      if (String(amount.currency || "") !== String(delivered.currency || "")) return false;
      if (String(amount.issuer || "") !== String(delivered.issuer || "")) return false;
      const cmp = C.cmpDecimal(delivered.value, amount.value);
      return cmp != null && cmp < 0;
    }
    return false;
  }

  function isPartialPayment(tx) {
    if (!tx || tx.type && tx.type !== "Payment") return false;
    if (!hasPartialPaymentFlag(tx)) return false;
    return isDeliveredShort(tx.amount, tx.delivered);
  }

  function parseExpectedAmount(raw) {
    const s = String(raw || "").trim();
    if (!s) return null;
    const m = s.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)(?:\s+([A-Za-z0-9.?!\-_]{1,20}))?$/);
    if (!m) return null;
    return { value: m[1], currency: (m[2] || "XRP").toUpperCase() };
  }

  function amountMatchesExpected(actual, expected) {
    if (!expected) return true;
    if (actual == null || actual === "unavailable") return false;
    const d = C.describeAmount(actual);
    const expCur = expected.currency.toUpperCase();
    if (expCur === "XRP") {
      if (!d.isXrp) return false;
      const expDrops = C.xrpToDropsString(expected.value);
      if (expDrops == null) return false;
      try { return BigInt(String(d.drops).trim()) === BigInt(expDrops); } catch (e) { return false; }
    }
    if (String(d.currency).toUpperCase() !== expCur) return false;
    const cmp = C.cmpDecimal(d.value, expected.value);
    return cmp === 0;
  }

  function failedResultReason(tx) {
    if (!tx || !tx.validated) return null;
    if (!tx.result || tx.result === "tesSUCCESS" || tx.result === "—") return null;
    const code = String(tx.result);
    if (code.indexOf("tec") === 0) {
      return (
        "Result " + code + " — the intended operation did not succeed. " +
        "This result is final (validated ledger). The transaction fee was still charged."
      );
    }
    return "Result " + code + " — the intended operation did not succeed. This result is final (validated ledger).";
  }

  function assess(tx, expected) {
    expected = expected || {};
    const reasons = [];
    if (tx && tx.validated === false) {
      reasons.push("Not final: this transaction is not in a validated ledger yet.");
      return { flagged: true, reasons: reasons, failed: false, partial: false };
    }
    const failed = failedResultReason(tx);
    if (failed) reasons.push(failed);
    const partial = isPartialPayment(tx);
    if (partial) {
      const want = C.describeAmount(tx.amount).text;
      const got = C.describeAmount(tx.delivered).text;
      const fact = "Partial payment (tfPartialPayment is set): delivered " + got + " of up to " + want + ".";
      // Ledger-max Amount is the documented way to express "deliver as much as possible".
      // Still a partial payment (shown in the HUD) but not treated as an alarm.
      if (!isMaxAmount(tx.amount)) reasons.push(fact);
    }
    if (expected.destination && tx.destination && expected.destination !== tx.destination) {
      reasons.push("Destination does not match expected " + C.shortAddr(expected.destination));
    }
    if (expected.destination && !tx.destination) {
      reasons.push("No destination to match expected " + C.shortAddr(expected.destination));
    }
    if (expected.amount) {
      const actual = tx.delivered != null && tx.delivered !== "unavailable" ? tx.delivered : null;
      if (!amountMatchesExpected(actual, expected.amount)) {
        reasons.push("Delivered amount does not match expected " + expected.amount.value + " " + expected.amount.currency);
      }
    }
    const hops = tx.hops || [];
    for (let i = 0; i < hops.length; i++) {
      if (hops[i].unexpected && hops[i].issuer && !C.KNOWN_ISSUERS[hops[i].issuer]) {
        reasons.push(C.unverifiedIssuerReason(hops[i].currency || "token", hops[i].issuer));
      }
    }
    return { flagged: reasons.length > 0, reasons: reasons, failed: !!failed, partial: partial };
  }

  function enrich(tx) {
    if (!tx) return tx;
    tx.hasPath = !!(tx.paths && tx.paths.length);
    tx.hops = extractHops(tx);
    tx.hasDex = tx.hops.some(function (h) { return h.kind === "offer"; });
    tx.hasAmm = tx.hops.some(function (h) { return h.kind === "amm"; });
    tx.waypoints = waypointsFor(tx);
    const verdict = assess(tx, null);
    tx.flagReasons = verdict.reasons;
    tx.flagged = verdict.flagged;
    tx.isPartial = verdict.partial;
    return tx;
  }

  global.TracerRoute = {
    TF_PARTIAL_PAYMENT: TF_PARTIAL_PAYMENT,
    extractHops: extractHops,
    waypointsFor: waypointsFor,
    isDeliveredShort: isDeliveredShort,
    hasPartialPaymentFlag: hasPartialPaymentFlag,
    isMaxAmount: isMaxAmount,
    isPartialPayment: isPartialPayment,
    parseExpectedAmount: parseExpectedAmount,
    amountMatchesExpected: amountMatchesExpected,
    failedResultReason: failedResultReason,
    assess: assess,
    enrich: enrich,
  };
})(window);
