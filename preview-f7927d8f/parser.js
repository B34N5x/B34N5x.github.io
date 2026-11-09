(() => {
  "use strict";
  const RIPPLE_EPOCH = 946684800;
  const SEED_RE = /\bs[A-Za-z0-9]{20,}\b/g;
  const ADDR_RE = /\br[1-9A-HJ-NP-Za-km-z]{24,34}\b/g;
  const REFUSAL = /(?:\b(?:buy|sell|invest|price|worth|should i|pump|dump|moon|hodl|financial advice)\b)/i;

  function looksLikeSeed(text) {
    const m = text.match(SEED_RE);
    if (!m) return false;
    // classic family seed starts with s and is base58-ish ~29 chars; err on caution
    return m.some((s) => s.length >= 25 && /^s[a-zA-Z0-9]+$/.test(s));
  }

  function toRippleTime(date) {
    return Math.floor(date.getTime() / 1000) - RIPPLE_EPOCH;
  }
  function fromRippleTime(rt) {
    return new Date((rt + RIPPLE_EPOCH) * 1000);
  }

  function parseAmountXrp(text) {
    // 50 XRP, 50xrp, lock 12.5 XRP
    const m = text.match(/(\d+(?:\.\d+)?)\s*(?:xrp|XRP)\b/);
    if (!m) return null;
    const xrp = Number(m[1]);
    if (!(xrp > 0) || xrp > 1e9) return null;
    // drops as string integer
    const drops = BigInt(Math.round(xrp * 1e6));
    return { xrp, drops: drops.toString() };
  }

  function parseAddresses(text) {
    const all = text.match(ADDR_RE) || [];
    return [...new Set(all)];
  }

  function parseDestinationTag(text) {
    const m = text.match(/\b(?:destination\s*tag|dest\s*tag|tag)\s*[:=#]?\s*(\d{1,10})\b/i);
    return m ? Number(m[1]) : null;
  }

  /** Relative + absolute date parsing — returns Date or null (local zone). */
  function parseWhen(phrase, now = new Date()) {
    const t = phrase.toLowerCase();
    // in N minutes/hours/days
    let m = t.match(/\bin\s+(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs|day|days)\b/);
    if (m) {
      const n = Number(m[1]);
      const unit = m[2];
      const d = new Date(now.getTime());
      if (/min/.test(unit)) d.setMinutes(d.getMinutes() + n);
      else if (/hour|hr/.test(unit)) d.setHours(d.getHours() + n);
      else d.setDate(d.getDate() + n);
      return d;
    }
    // after N …
    m = t.match(/\bafter\s+(\d+)\s*(minute|minutes|min|hour|hours|day|days)\b/);
    if (m) {
      const n = Number(m[1]);
      const unit = m[2];
      const d = new Date(now.getTime());
      if (/min/.test(unit)) d.setMinutes(d.getMinutes() + n);
      else if (/hour|hr/.test(unit)) d.setHours(d.getHours() + n);
      else d.setDate(d.getDate() + n);
      return d;
    }
    // tomorrow [at] HH[:MM][am/pm]
    if (/\btomorrow\b/.test(t)) {
      const d = new Date(now.getTime());
      d.setDate(d.getDate() + 1);
      const tm = t.match(/\btomorrow(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
      if (tm) applyClock(d, tm);
      else {
        d.setHours(17, 0, 0, 0);
      }
      return d;
    }
    // next monday / friday etc
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    m = t.match(/\b(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b(?:\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/);
    if (m) {
      const target = days.indexOf(m[1]);
      const d = new Date(now.getTime());
      const add = (target - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + add);
      if (m[2]) applyClock(d, [null, m[2], m[3], m[4]]);
      else d.setHours(17, 0, 0, 0);
      return d;
    }
    // friday 5pm / friday at 17:00
    m = t.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
    if (m) {
      const target = days.indexOf(m[1]);
      const d = new Date(now.getTime());
      let add = (target - d.getDay() + 7) % 7;
      if (add === 0) {
        // later today if clock still ahead, else next week
        const tmp = new Date(d);
        applyClock(tmp, [null, m[2], m[3], m[4]]);
        if (tmp <= now) add = 7;
      }
      d.setDate(d.getDate() + add);
      applyClock(d, [null, m[2], m[3], m[4]]);
      return d;
    }
    // ISO-ish YYYY-MM-DD[ HH:MM]
    m = t.match(/\b(20\d{2}-\d{2}-\d{2})(?:[t\s](\d{2}):(\d{2}))?\b/);
    if (m) {
      const d = new Date(m[1] + "T" + (m[2] ? m[2] + ":" + m[3] + ":00" : "17:00:00"));
      if (!isNaN(d)) return d;
    }
    // until Friday 5pm style handled by scanning segments below
    return null;
  }

  function applyClock(d, tm) {
    let h = Number(tm[1]);
    const min = tm[2] != null ? Number(tm[2]) : 0;
    const ap = (tm[3] || "").toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (!ap && h <= 24) {
      /* 24h if no am/pm and hour looks 24h, else assume as given */
    }
    d.setHours(h, min, 0, 0);
  }

  function wantsCondition(text) {
    return /\b(secret\s*code|crypto-?condition|condition|fulfillment|preimage|password\s*code|passcode)\b/i.test(text);
  }

  function extractFinishPhrase(text) {
    // until X, after X, finish after X, claim after X, release after X
    const m =
      text.match(/\b(?:until|finish(?:\s+after)?|claim(?:\s+after)?|release(?:\s+after)?|available(?:\s+after)?|can claim (?:it )?after)\s+(.+?)(?:,|\.|$|he can|i can|and\b|cancel)/i) ||
      text.match(/\bafter\s+(that|[^,.]+)/i);
    return m ? m[1].trim() : null;
  }

  function extractCancelPhrase(text) {
    const m =
      text.match(/\b(?:cancel(?:\s+if[^,]*)?(?:\s+by|\s+after)?|expires?(?:\s+by|\s+after)?|expire(?:\s+by)?|not claimed by|unless claimed by)\s+(.+?)(?:,|\.|$)/i) ||
      text.match(/\bby\s+(next\s+\w+(?:\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)/i);
    return m ? m[1].trim() : null;
  }

  /**
   * Parse plain-English deal → draft fields (no signing).
   * @returns {{ok, refusal?, seedBlocked?, warnings[], draft?, notes[]}}
   */
  function parseDeal(raw, opts = {}) {
    const text = String(raw || "").trim();
    const now = opts.now || new Date();
    const out = { ok: false, warnings: [], notes: [], draft: null };

    if (!text) {
      out.error = "Type a deal in plain English first.";
      return out;
    }
    if (looksLikeSeed(text)) {
      out.seedBlocked = true;
      out.error = "That looks like a seed (starts with s…). Never paste seeds here. This tool drafts only — sign in Xaman.";
      return out;
    }
    if (REFUSAL.test(text) && !/\bescrow\b/i.test(text)) {
      // hard refusal for buy/sell/price/should I — still allow if clearly escrow wording mixed? Prefer refuse.
      out.refusal = true;
      out.error =
        "I only help draft XRPL escrow fields. I won’t answer buy/sell/price or ‘should I’ questions. General information only — not financial advice.";
      return out;
    }
    if (REFUSAL.test(text) && /\b(should i|buy|sell|price|worth)\b/i.test(text)) {
      out.refusal = true;
      out.error =
        "I only help draft XRPL escrow fields. I won’t answer buy/sell/price or ‘should I’ questions. General information only — not financial advice.";
      return out;
    }

    const amount = parseAmountXrp(text);
    if (!amount) {
      out.error = "Couldn’t find an XRP amount (e.g. “50 XRP”).";
      return out;
    }

    const addrs = parseAddresses(text);
    let destination = null;
    if (addrs.length >= 1) destination = addrs[0];
    // “for rBob” / “to r…” already captured by ADDR_RE
    if (!destination) {
      out.warnings.push("No destination classic address found (r…). Add one before signing.");
    }

    const destTag = parseDestinationTag(text);
    const conditional = wantsCondition(text);

    let finishAfter = null;
    let cancelAfter = null;

    // Prefer explicit finish / until
    const finPhrase = extractFinishPhrase(text);
    if (finPhrase) {
      // strip leading "that"
      const p = finPhrase.replace(/^that\b/i, "").trim() || finPhrase;
      finishAfter = parseWhen(p, now) || parseWhen(finPhrase, now);
    }
    // “in 2 minutes” / “after 2 hours” as FinishAfter (skip “expires after …”)
    if (!finishAfter) {
      const rel = text.match(/(?<!expires?\s)\b(?:in|after)\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)\b/i);
      if (rel) finishAfter = parseWhen("in " + rel[1] + " " + rel[2], now);
    }
    // tomorrow at … as FinishAfter if still missing
    if (!finishAfter && /\btomorrow\b/i.test(text)) {
      finishAfter = parseWhen(text.match(/\btomorrow\b[^,.]*/i)?.[0] || "tomorrow", now);
    }

    const canPhrase = extractCancelPhrase(text);
    if (canPhrase) cancelAfter = parseWhen(canPhrase, now);

    // Heuristic: “cancel if not claimed by next Monday”
    if (!cancelAfter) {
      const m = text.match(/not claimed by\s+(.+?)(?:,|\.|$)/i);
      if (m) cancelAfter = parseWhen(m[1], now);
    }
    if (!cancelAfter) {
      const m = text.match(/\bexpires?(?:\s+after)?\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)\b/i);
      if (m) cancelAfter = parseWhen("in " + m[1] + " " + m[2], now);
    }

    if (conditional && !cancelAfter) {
      out.warnings.push(
        "Conditional escrows should set CancelAfter. Without it (and without FinishAfter), rules require an expiration; without CancelAfter a time-locked escrow can be un-cancellable if the secret is lost."
      );
    }
    if (!conditional && finishAfter && !cancelAfter) {
      out.warnings.push(
        "No CancelAfter: once FinishAfter passes anyone can finish, but if nobody does the XRP stays locked until finished (cannot cancel). Consider an expiry."
      );
    }
    if (!finishAfter && !conditional) {
      out.warnings.push("No FinishAfter and no condition — EscrowCreate needs at least one release condition.");
    }
    if (finishAfter && cancelAfter && toRippleTime(finishAfter) >= toRippleTime(cancelAfter)) {
      out.warnings.push("FinishAfter must be earlier than CancelAfter.");
    }
    if (finishAfter && toRippleTime(finishAfter) <= toRippleTime(now)) {
      out.warnings.push("FinishAfter is not in the future (ledger time).");
    }

    const draft = {
      TransactionType: "EscrowCreate",
      Amount: amount.drops,
      amountXrp: amount.xrp,
      Destination: destination,
      DestinationTag: destTag,
      FinishAfter: finishAfter ? toRippleTime(finishAfter) : undefined,
      CancelAfter: cancelAfter ? toRippleTime(cancelAfter) : undefined,
      Condition: conditional ? "__GENERATE__" : undefined,
      finishAfterDate: finishAfter ? finishAfter.toISOString() : null,
      cancelAfterDate: cancelAfter ? cancelAfter.toISOString() : null,
      wantsCondition: conditional,
    };

    // strip undefined for JSON cleanliness later
    out.ok = true;
    out.draft = draft;
    out.notes.push("Amounts are in drops inside the transaction (1 XRP = 1,000,000 drops).");
    out.notes.push("Times use Ripple Epoch (seconds since 2000-01-01 UTC); human times shown in your local zone.");
    return out;
  }

  window.EscrowParser = {
    parseDeal,
    looksLikeSeed,
    toRippleTime,
    fromRippleTime,
    REFUSAL,
  };
})();
