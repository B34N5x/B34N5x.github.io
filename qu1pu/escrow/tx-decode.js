(() => {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;

  const TYPE_PLAIN = {
    EscrowCreate: "EscrowCreate — lock XRP in an escrow until the finish rules are met",
    EscrowFinish: "EscrowFinish — release an escrow to its destination",
    EscrowCancel: "EscrowCancel — return an escrow to the sender",
    Payment: "Payment — send funds to a destination",
    OfferCreate: "OfferCreate — place a trading offer",
    OfferCancel: "OfferCancel — cancel a trading offer",
    TrustSet: "TrustSet — set or update a trust line",
    AccountSet: "AccountSet — change account settings",
    AccountDelete: "AccountDelete — delete an account",
    TicketCreate: "TicketCreate — create tickets",
    PaymentChannelCreate: "PaymentChannelCreate — open a payment channel",
    PaymentChannelFund: "PaymentChannelFund — add funds to a payment channel",
    PaymentChannelClaim: "PaymentChannelClaim — claim from a payment channel",
    NFTokenMint: "NFTokenMint — mint an NFToken",
    NFTokenBurn: "NFTokenBurn — burn an NFToken",
    NFTokenCreateOffer: "NFTokenCreateOffer — create an NFToken offer",
    NFTokenAcceptOffer: "NFTokenAcceptOffer — accept an NFToken offer",
    NFTokenCancelOffer: "NFTokenCancelOffer — cancel an NFToken offer",
  };

  function hexToBytes(hex) {
    const h = String(hex || "")
      .trim()
      .replace(/^0x/i, "")
      .replace(/\s+/g, "");
    if (!h || h.length % 2 || /[^0-9a-fA-F]/.test(h)) return null;
    const out = new Uint8Array(h.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
    return out;
  }

  function bytesToText(bytes) {
    if (!bytes) return { ok: false, reason: "not hex" };
    try {
      let t = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      t = t.replace(/\u0000+$/g, "");
      if (t.length && /^[\t\n\r\x20-\x7E\u00A0-\u024F\u0400-\u04FF]*$/.test(t)) {
        return { ok: true, text: t };
      }
      return { ok: false, reason: "not plain text" };
    } catch {
      return { ok: false, reason: "not valid UTF-8" };
    }
  }

  function decodeHexField(hex, label) {
    const bytes = hexToBytes(hex);
    if (!bytes) {
      return { label, hex: String(hex || ""), text: null, note: "Value is not even hex." };
    }
    const txt = bytesToText(bytes);
    if (txt.ok) return { label, hex: String(hex), text: txt.text, note: "Decoded as plain text." };
    return { label, hex: String(hex), text: null, note: "Could not read as plain text (" + txt.reason + ")." };
  }

  function decodeInvoiceID(hex) {
    const field = decodeHexField(hex, "InvoiceID");
    const bytes = hexToBytes(hex);
    if (bytes && bytes.length !== 32) {
      field.note = "InvoiceID is usually 32 bytes. This one is " + bytes.length + " byte(s). " + field.note;
      field.unusual = true;
    } else if (field.text) {
      field.note = "Invoice reference as text: “" + field.text + "”.";
    } else if (bytes) {
      field.note = "32-byte invoice reference (hex only — not plain text).";
    }
    return field;
  }

  function decodeMemo(memoWrap) {
    const memo = memoWrap?.Memo || memoWrap || {};
    const type = decodeHexField(memo.MemoType, "MemoType");
    const format = decodeHexField(memo.MemoFormat, "MemoFormat");
    const data = decodeHexField(memo.MemoData, "MemoData");
    const warnings = memoWarnings(type, format, data);
    return { type, format, data, warnings };
  }

  function memoWarnings(type, format, data) {
    const warnings = [];
    const blob = [type.text, format.text, data.text].filter(Boolean).join("\n");
    if (!data.text && data.hex) warnings.push("A memo is not plain text (binary or unusual encoding).");
    if (/\b(seed|secret key|private key|family seed|mnemonic|passphrase|secret numbers)\b/i.test(blob)) {
      warnings.push("A memo mentions seed or key words. Treat it as unusual. We will never ask for your seed.");
    }
    if (/\b(javascript:|data:text\/html|connect your wallet|enter your seed|paste your seed)\b/i.test(blob)) {
      warnings.push("A memo looks like a phishing-style message. Do not follow instructions in memos.");
    }
    const bytes = hexToBytes(data.hex);
    if (bytes && bytes.length > 1024) warnings.push("A memo is unusually large.");
    return warnings;
  }

  function explainTag(name, value) {
    if (value == null || value === "") {
      return {
        name,
        value: null,
        text:
          name === "DestinationTag"
            ? "No destination tag. Some exchanges or payment services need a tag to credit the right account."
            : "No source tag.",
      };
    }
    const n = Number(value);
    const ok = Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
    return {
      name,
      value: n,
      text: ok
        ? name +
          " " +
          n +
          " — a number some services use to credit or track an account. Shown as written."
        : name + " value looks unusual (not a normal 32-bit tag).",
      unusual: !ok,
    };
  }

  function formatAmount(amount, { entered } = {}) {
    if (entered != null && String(entered).trim() !== "") {
      return "Amount as you entered: " + String(entered).trim() + (/\bXRP\b/i.test(String(entered)) ? "" : " XRP");
    }
    if (amount == null || amount === "") return "Amount: not set";
    if (typeof amount === "string" && /^\d+$/.test(amount)) {
      const drops = amount;
      let xrp = drops;
      try {
        const xrpl = root.xrpl;
        xrp = xrpl?.dropsToXrp ? xrpl.dropsToXrp(drops) : String(Number(drops) / 1e6);
      } catch {
        xrp = String(Number(drops) / 1e6);
      }
      return "Amount as written: " + drops + " drops (" + xrp + " XRP)";
    }
    if (amount && typeof amount === "object") {
      return (
        "Amount as written: " +
        (amount.value || "?") +
        " " +
        (amount.currency || "") +
        (amount.issuer ? " (issuer " + amount.issuer + ")" : "")
      );
    }
    return "Amount as written: " + String(amount);
  }

  function formatFee(fee) {
    if (fee == null || fee === "") {
      return "Network fee: not set in this draft. Xaman will show the fee before you sign. This is not a fee suggestion.";
    }
    const drops = String(fee);
    return "Network fee as written: " + drops + " drops. Shown as in the transaction, not a suggestion.";
  }

  function collectWarnings(tx, opts = {}) {
    const warnings = [];
    const type = tx?.TransactionType;
    const needsDest = type === "Payment" || type === "EscrowCreate";
    if (needsDest && tx.Destination && (tx.DestinationTag == null || tx.DestinationTag === "")) {
      if (opts.requireDest) {
        warnings.push("This destination is marked as needing a destination tag, and none is set.");
      } else {
        warnings.push(
          "No destination tag. If this is an exchange-style or payment-service address, a missing tag can make funds hard to credit. This is a reminder, not advice."
        );
      }
    }
    const memos = tx?.Memos || [];
    memos.forEach((m) => {
      decodeMemo(m).warnings.forEach((w) => warnings.push(w));
    });
    if (tx?.InvoiceID) {
      const inv = decodeInvoiceID(tx.InvoiceID);
      if (inv.unusual) warnings.push(inv.note);
    }
    const destTag = explainTag("DestinationTag", tx?.DestinationTag);
    const srcTag = explainTag("SourceTag", tx?.SourceTag);
    if (destTag.unusual) warnings.push(destTag.text);
    if (srcTag.unusual) warnings.push(srcTag.text);
    return [...new Set(warnings)];
  }

  function summarizeTx(tx, opts = {}) {
    const type = tx?.TransactionType || "Unknown";
    const typeLine = TYPE_PLAIN[type] || type + " — a ledger transaction of this type";
    const lines = [
      "Plain-word summary of what this would do:",
      "Type: " + typeLine + ".",
      tx?.Account ? "Source account: " + tx.Account + " (this account would sign)." : "Source account: not set.",
      tx?.Destination ? "Destination: " + tx.Destination + "." : "Destination: none on this transaction type.",
      formatAmount(tx?.Amount, { entered: opts.amountEntered }),
      formatFee(tx?.Fee),
    ];
    const destTag = explainTag("DestinationTag", tx?.DestinationTag);
    const srcTag = explainTag("SourceTag", tx?.SourceTag);
    lines.push(destTag.text);
    if (tx?.SourceTag != null) lines.push(srcTag.text);
    if (tx?.InvoiceID) {
      const inv = decodeInvoiceID(tx.InvoiceID);
      lines.push(inv.text ? "InvoiceID as text: “" + inv.text + "”." : "InvoiceID: " + inv.note);
    }
    const memos = (tx?.Memos || []).map((m, i) => {
      const d = decodeMemo(m);
      const parts = [];
      if (d.type.text) parts.push("type “" + d.type.text + "”");
      if (d.format.text) parts.push("format “" + d.format.text + "”");
      if (d.data.text) parts.push("message “" + d.data.text + "”");
      else if (d.data.hex) parts.push("message is not plain text");
      return "Memo " + (i + 1) + ": " + (parts.join(", ") || "empty") + ".";
    });
    memos.forEach((m) => lines.push(m));
    lines.push("QU1PU does not sign. You review this, then sign in Xaman yourself. We will never ask for your seed.");
    return {
      type,
      typeLine,
      lines,
      warnings: collectWarnings(tx, opts),
      destTag,
      srcTag,
      invoice: tx?.InvoiceID ? decodeInvoiceID(tx.InvoiceID) : null,
      memos: (tx?.Memos || []).map(decodeMemo),
    };
  }

  function looksLikeBlob(text) {
    const t = String(text || "").trim();
    if (!t) return false;
    if (t.startsWith("{") && t.endsWith("}")) return true;
    const h = t.replace(/^0x/i, "").replace(/\s+/g, "");
    return h.length >= 80 && h.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(h);
  }

  function decodeBlobOrJson(input, opts = {}) {
    const raw = String(input || "").trim();
    const parser = root.EscrowParser;
    if (parser?.looksLikeSecret?.(raw) && !looksLikeBlob(raw)) {
      return {
        ok: false,
        secretBlocked: true,
        error: "That looks like a seed or secret key. We will never ask for your seed. It was not stored or sent.",
      };
    }
    if (!raw) return { ok: false, error: "Paste a signed blob (hex) or transaction JSON first." };
    let tx = null;
    let fromBlob = false;
    if (raw.startsWith("{")) {
      try {
        tx = JSON.parse(raw);
        if (tx.tx_blob && !tx.TransactionType) {
          return decodeBlobOrJson(tx.tx_blob, opts);
        }
        tx = tx.tx_json || tx.transaction || tx;
      } catch {
        return { ok: false, error: "That JSON could not be read." };
      }
    } else {
      const xrpl = root.xrpl;
      if (!xrpl?.decode) return { ok: false, error: "Decoder is not loaded." };
      if (!looksLikeBlob(raw)) {
        return { ok: false, error: "That is not a transaction blob or JSON. If it is a seed or secret, it was not stored." };
      }
      try {
        tx = xrpl.decode(raw.replace(/^0x/i, "").replace(/\s+/g, ""));
        fromBlob = true;
      } catch (e) {
        return { ok: false, error: "Could not decode that blob. Nothing was submitted." };
      }
    }
    if (!tx || typeof tx !== "object") return { ok: false, error: "No transaction found in that input." };
    const summary = summarizeTx(tx, opts);
    return {
      ok: true,
      fromBlob,
      submitted: false,
      tx,
      summary,
    };
  }

  root.TxDecode = {
    hexToBytes,
    decodeHexField,
    decodeInvoiceID,
    decodeMemo,
    explainTag,
    summarizeTx,
    collectWarnings,
    decodeBlobOrJson,
    looksLikeBlob,
    formatAmount,
    formatFee,
  };
})();
