(() => {
  "use strict";
  const FAQ = [
    {
      q: /what is escrow|how does escrow work/i,
      a: "On the XRP Ledger, escrow locks XRP (or eligible tokens) until time and/or a crypto-condition is met. There is no human third party — the ledger rules enforce release or return.",
      href: "https://xrpl.org/docs/concepts/payment-types/escrow",
    },
    {
      q: /finishafter|finish after|when can .+ claim/i,
      a: "FinishAfter is the earliest ledger time the escrow can be finished. Before that, EscrowFinish fails. Times follow ledger close time (~few seconds skew).",
      href: "https://xrpl.org/docs/concepts/payment-types/escrow",
    },
    {
      q: /cancelafter|cancel after|expir/i,
      a: "CancelAfter is when the escrow expires. After that it cannot be finished; anyone may submit EscrowCancel to return funds to the sender. XRP escrows without CancelAfter never expire and cannot be cancelled.",
      href: "https://xrpl.org/docs/concepts/payment-types/escrow",
    },
    {
      q: /condition|fulfillment|preimage|secret code/i,
      a: "The only supported crypto-condition type is PREIMAGE-SHA-256. EscrowCreate stores the Condition; EscrowFinish must supply the matching Fulfillment. Keep the fulfillment secret — losing it can lock funds until CancelAfter (if set).",
      href: "https://xrpl.org/docs/concepts/payment-types/escrow",
    },
    {
      q: /escrowfinish|finish the escrow/i,
      a: "EscrowFinish delivers escrowed funds to Destination when FinishAfter has passed and any Condition is fulfilled. Crypto-condition finishes cost more fees.",
      href: "https://xrpl.org/docs/references/protocol/transactions/types/escrowfinish",
    },
    {
      q: /escrowcancel|cancel the escrow/i,
      a: "EscrowCancel returns funds to the sender after CancelAfter. It cannot succeed before expiration.",
      href: "https://xrpl.org/docs/references/protocol/transactions/types/escrowcancel",
    },
    {
      q: /reserve|cost|fee/i,
      a: "Creating an escrow uses an owner reserve while the Escrow object exists, plus transaction fees for create and finish/cancel. Conditional finishes need a higher fee.",
      href: "https://xrpl.org/docs/concepts/payment-types/escrow",
    },
    {
      q: /destination tag|dest tag/i,
      a: "If the destination account requires a destination tag (asfRequireDest), payments and escrows to it must include DestinationTag or they fail.",
      href: "https://xrpl.org/docs/concepts/accounts/addresses",
    },
    {
      q: /testnet|mainnet/i,
      a: "This assistant defaults to Testnet. Mainnet is a manual switch with a confirm dialog. Never use the in-page faucet demo on mainnet — it is testnet-only.",
      href: "https://xrpl.org/resources/dev-tools/faucet",
    },
  ];

  function answer(question) {
    const q = String(question || "").trim();
    if (!q) return null;
    if (window.EscrowParser?.looksLikeSeed(q)) {
      return {
        a: "Do not paste seeds. Sign only in Xaman. General information only — not financial advice.",
        href: "https://xrpl.org/docs/concepts/accounts",
        blocked: true,
      };
    }
    if (/\b(buy|sell|price|should i|worth|invest)\b/i.test(q)) {
      return {
        a: "I won’t answer buy/sell/price or ‘should I’ questions. I only explain how XRPL escrow works. General information only — not financial advice.",
        href: "https://xrpl.org/docs/concepts/payment-types/escrow",
        refusal: true,
      };
    }
    for (const item of FAQ) {
      if (item.q.test(q)) return { a: item.a, href: item.href };
    }
    return {
      a: "I don’t have a curated answer for that yet. See the official Escrow docs for authoritative detail.",
      href: "https://xrpl.org/docs/concepts/payment-types/escrow",
      fallback: true,
    };
  }

  function logFaqLocal(question, answerObj) {
    try {
      const key = "escrowAssistant.faqLog";
      const prev = JSON.parse(localStorage.getItem(key) || "[]");
      prev.unshift({ t: new Date().toISOString(), q: question.slice(0, 240), href: answerObj.href });
      localStorage.setItem(key, JSON.stringify(prev.slice(0, 50)));
    } catch (_) {}
  }

  window.EscrowFAQ = { answer, logFaqLocal, FAQ_COUNT: FAQ.length };
})();
