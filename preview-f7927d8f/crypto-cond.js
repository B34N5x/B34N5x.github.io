(() => {
  "use strict";
  function toHex(u8) {
    return [...u8].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  function concat(arrs) {
    const n = arrs.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(n);
    let o = 0;
    for (const a of arrs) {
      out.set(a, o);
      o += a.length;
    }
    return out;
  }
  async function sha256(bytes) {
    const dig = await crypto.subtle.digest("SHA-256", bytes);
    return new Uint8Array(dig);
  }
  /** Build PREIMAGE-SHA-256 condition + fulfillment hex for XRPL EscrowCreate/Finish. */
  async function makePreimageSha256(preimage) {
    const pre = preimage instanceof Uint8Array ? preimage : new Uint8Array(preimage);
    if (pre.length < 1 || pre.length > 64) throw new Error("preimage length 1–64 bytes");
    const hash = await sha256(pre);
    // Condition: A0 | 0x25 | 80 20 | hash | 81 01 | cost
    // cost = preimage length (INTEGER). For length<=127 use short form.
    const cost = pre.length;
    const cond = concat([
      new Uint8Array([0xa0, 0x25, 0x80, 0x20]),
      hash,
      new Uint8Array([0x81, 0x01, cost]),
    ]);
    // Fulfillment: A0 | len | 80 | len | preimage
    const innerLen = 2 + pre.length;
    if (innerLen > 127) throw new Error("fulfillment too large for short-form encoder");
    const ful = concat([new Uint8Array([0xa0, innerLen, 0x80, pre.length]), pre]);
    return {
      type: "PREIMAGE-SHA-256",
      condition: toHex(cond),
      fulfillment: toHex(ful),
      preimageHex: toHex(pre),
      cost,
    };
  }
  async function randomPreimagePair(bytes = 32) {
    const pre = new Uint8Array(bytes);
    crypto.getRandomValues(pre);
    return makePreimageSha256(pre);
  }
  window.EscrowCryptoCond = { makePreimageSha256, randomPreimagePair, toHex };
})();
