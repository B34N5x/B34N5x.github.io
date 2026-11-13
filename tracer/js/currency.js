/* Currency decode + conservative known-issuer list. Unknown tokens are flagged. */
(function (global) {
  "use strict";

  // Only well-known, publicly documented issuers. This is a short local list.
  // The tool does not check xrp-ledger.toml or account Domain verification.
  const KNOWN_ISSUERS = {
    rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De: { name: "Ripple", asset: "RLUSD" },
    rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B: { name: "Bitstamp" },
    rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq: { name: "GateHub" },
    rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz: { name: "Sologenic" },
    rKiCet8SdvWxPXnAgYarFUXMh1zCPz432Y: { name: "Ripple" },
  };

  const KNOWN_ISSUER_NAMES = "Ripple, Bitstamp, GateHub, Sologenic";

  function hexToAsciiPrintable(hex) {
    if (!hex || hex.length % 2 !== 0) return "";
    let s = "";
    for (let i = 0; i < hex.length; i += 2) {
      const n = parseInt(hex.slice(i, i + 2), 16);
      if (!Number.isFinite(n) || n < 32 || n > 126) return "";
      s += String.fromCharCode(n);
    }
    return s;
  }

  function decodeCurrency(code) {
    if (!code || code === "XRP") return "XRP";
    const raw = String(code);
    if (raw.length <= 3) return raw;
    if (!/^[0-9A-Fa-f]{40}$/.test(raw)) return raw;
    const prefix = raw.slice(0, 2).toLowerCase();
    // Protocol: 0x00 prefix is a serialized standard 3-character code.
    if (prefix === "00") {
      const body = raw.slice(2).replace(/(?:00)+$/i, "");
      const s = hexToAsciiPrintable(body);
      if (s.length === 3 && s !== "XRP") return s;
      return "HEX:" + raw.slice(0, 8);
    }
    // 0x01 = historical demurrage codes; 0x03 = AMM LP token codes. Do not ASCII-decode.
    if (prefix === "01") return "DEMURRAGE:" + raw.slice(0, 8);
    if (prefix === "03") return "LP:" + raw.slice(0, 8);
    const trimmed = raw.replace(/(?:00)+$/i, "");
    if (trimmed.length >= 6 && trimmed.length % 2 === 0) {
      const s = hexToAsciiPrintable(trimmed);
      // Official standard charset is wider; keep a conservative printable set.
      if (/^[A-Za-z0-9.?!\-@_#$%^&*<>(){}[\]|]{3,20}$/.test(s)) {
        // A hex code that decodes to "XRP" is a look-alike token, not native XRP.
        if (s === "XRP") return "HEX:" + raw.slice(0, 8);
        return s;
      }
    }
    return "HEX:" + raw.slice(0, 8);
  }

  function pow10(n) {
    if (n < 0) throw new Error("pow10 expects a non-negative exponent");
    let r = 1n;
    let b = 10n;
    let e = n;
    while (e > 0) {
      if (e & 1) r *= b;
      e >>= 1;
      if (e) b *= b;
    }
    return r;
  }

  // Parse an XRPL string-number (optional sign, decimal point, scientific notation) exactly.
  function parseXrplDecimal(s) {
    if (s == null) return null;
    const t = String(s).trim();
    if (!t) return null;
    const m = t.match(/^([+-])?(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
    if (!m) return null;
    const sign = m[1] === "-" ? -1n : 1n;
    const intPart = m[2];
    const frac = m[3] || "";
    const exp = m[4] != null ? parseInt(m[4], 10) : 0;
    if (!Number.isFinite(exp) || Math.abs(exp) > 10000) return null;
    const digitsStr = (intPart + frac).replace(/^0+(?=\d)/, "");
    const digits = BigInt(digitsStr || "0");
    const scale = exp - frac.length;
    return { sign: sign, digits: digits, scale: scale };
  }

  function cmpDecimal(a, b) {
    const pa = typeof a === "object" && a && "digits" in a ? a : parseXrplDecimal(a);
    const pb = typeof b === "object" && b && "digits" in b ? b : parseXrplDecimal(b);
    if (!pa || !pb) return null;
    const va = pa.sign * pa.digits;
    const vb = pb.sign * pb.digits;
    if (va === 0n && vb === 0n) return 0;
    if (va < 0n && vb >= 0n) return -1;
    if (va > 0n && vb <= 0n) return 1;
    const scaleDiff = pa.scale - pb.scale;
    let xa = va;
    let xb = vb;
    if (scaleDiff > 0) xa = xa * pow10(scaleDiff);
    else if (scaleDiff < 0) xb = xb * pow10(-scaleDiff);
    return xa < xb ? -1 : xa > xb ? 1 : 0;
  }

  function dropsToXrpString(drops) {
    let d;
    try { d = BigInt(String(drops).trim()); } catch (e) { return null; }
    const neg = d < 0n;
    if (neg) d = -d;
    const whole = d / 1000000n;
    const frac = d % 1000000n;
    let fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
    const num = whole.toString() + (fracStr ? "." + fracStr : "");
    return (neg ? "-" : "") + num;
  }

  function xrpToDropsString(xrp) {
    const p = parseXrplDecimal(xrp);
    if (!p) return null;
    // drops = value * 1e6, must be an integer number of drops.
    const scale = p.scale + 6;
    let drops;
    if (scale >= 0) {
      drops = p.sign * p.digits * pow10(scale);
    } else {
      const div = pow10(-scale);
      if (p.digits % div !== 0n) return null;
      drops = p.sign * (p.digits / div);
    }
    return drops.toString();
  }

  function formatXrp(drops) {
    const s = dropsToXrpString(drops);
    if (s == null) return String(drops);
    return s + " XRP";
  }

  function describeAmount(amount) {
    if (amount == null || amount === "unavailable") {
      return {
        text: amount === "unavailable" ? "unavailable" : "—",
        currency: "—",
        issuer: null,
        known: null,
        unverified: false,
        isXrp: false,
        unavailable: amount === "unavailable",
      };
    }
    if (typeof amount === "string") {
      return {
        text: formatXrp(amount),
        currency: "XRP",
        issuer: null,
        known: null,
        unverified: false,
        isXrp: true,
        drops: String(amount),
      };
    }
    if (typeof amount === "object" && amount.mpt_issuance_id) {
      return {
        text: String(amount.value != null ? amount.value : "—") + " MPT",
        currency: "MPT",
        issuer: null,
        known: null,
        unverified: false,
        isXrp: false,
        value: amount.value,
        mptIssuanceId: amount.mpt_issuance_id,
      };
    }
    const rawCurrency = amount.currency;
    const currency = decodeCurrency(rawCurrency);
    const issuer = amount.issuer || "";
    const known = issuer ? (KNOWN_ISSUERS[issuer] || null) : null;
    const value = amount.value;
    const issuerLabel = known ? known.name : shortAddr(issuer);
    return {
      text: (value != null ? String(value) : "—") + " " + currency,
      currency: currency,
      rawCurrency: rawCurrency,
      issuer: issuer,
      issuerLabel: issuerLabel,
      known: known,
      unverified: !known,
      isXrp: false,
      value: value,
    };
  }

  function shortAddr(addr) {
    if (!addr) return "—";
    if (addr.length <= 12) return addr;
    return addr.slice(0, 6) + "…" + addr.slice(-4);
  }

  const RIPPLE_EPOCH = 946684800;

  function rippleTimeToSydney(rippleTime) {
    if (rippleTime == null || rippleTime === "") return "—";
    const sec = Number(rippleTime);
    if (!Number.isFinite(sec)) return "—";
    const d = new Date((sec + RIPPLE_EPOCH) * 1000);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-AU", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short",
    });
  }

  const ADDR_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
  const HASH_RE = /^[A-Fa-f0-9]{64}$/;

  function classifyInput(raw) {
    const s = String(raw || "").trim();
    if (!s) return { kind: "empty", value: "" };
    if (HASH_RE.test(s)) return { kind: "hash", value: s.toUpperCase() };
    if (ADDR_RE.test(s)) return { kind: "address", value: s };
    return { kind: "invalid", value: s };
  }

  function unverifiedIssuerReason(currency, issuer) {
    return (
      "Unverified issuer: " + (currency || "token") + " from " + shortAddr(issuer) +
      " is not in this tool's known-issuer list (" + KNOWN_ISSUER_NAMES +
      "). This tool does not check xrp-ledger.toml or domain verification."
    );
  }

  global.TracerCurrency = {
    KNOWN_ISSUERS: KNOWN_ISSUERS,
    KNOWN_ISSUER_NAMES: KNOWN_ISSUER_NAMES,
    RIPPLE_EPOCH: RIPPLE_EPOCH,
    decodeCurrency: decodeCurrency,
    parseXrplDecimal: parseXrplDecimal,
    cmpDecimal: cmpDecimal,
    dropsToXrpString: dropsToXrpString,
    xrpToDropsString: xrpToDropsString,
    formatXrp: formatXrp,
    describeAmount: describeAmount,
    shortAddr: shortAddr,
    rippleTimeToSydney: rippleTimeToSydney,
    classifyInput: classifyInput,
    unverifiedIssuerReason: unverifiedIssuerReason,
  };
})(window);
