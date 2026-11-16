(() => {
  "use strict";

  const TOPICS = [
    {
      id: "dest-tag",
      title: "what a destination tag is",
      phrases: ["destination tag", "destination tags", "dest tag", "dest tags", "destinationtag"],
      any: ["tag", "tags"],
      need: [["tag", "tags", "destinationtag"]],
      alsoNeed: [["dest", "destination", "exchange", "exchanges", "service", "services", "credit"]],
      a: "A destination tag is a number some services, including many exchanges, use to credit the right account. If that kind of address is missing a tag, the funds can be hard to credit, and some accounts will reject the transaction. You can add a tag in step 2 (Confirm parties). The review screen also warns when a tag looks missing. This is a reminder, not advice.",
      href: "https://xrpl.org/docs/concepts/accounts/addresses",
    },
    {
      id: "memo",
      title: "what a memo is",
      phrases: ["what is a memo", "what are memos", "memo data", "memo field"],
      any: ["memo", "memos"],
      need: [["memo", "memos"]],
      a: "A memo is an optional note attached to a transaction. It is often stored as hex; the review screen can show it in plain words when it decodes. Treat unusual memos with care, and don’t follow instructions in a memo. I don’t suggest what to write in one.",
      href: "https://xrpl.org/docs/references/protocol/transactions/common-fields",
    },
    {
      id: "signing",
      title: "how signing works",
      phrases: [
        "how do i sign",
        "how signing works",
        "who signs",
        "sign in xaman",
        "never ask for your seed",
        "never ask for a seed",
      ],
      any: ["sign", "signing", "signature", "xaman", "signer", "seed"],
      need: [["sign", "signing", "signature", "xaman", "signer", "seed"]],
      blockIf: ["secret code", "fulfillment", "preimage", "condition"],
      a: "QU1PU only drafts what a transaction would do. You read a plain-word summary on the Review step, then you sign in Xaman yourself. Keys stay in your signer. We will never ask for your seed or secret. Nothing is auto-signed.",
      href: "https://xrpl.org/docs/concepts/transactions",
    },
    {
      id: "fees",
      title: "what fees are",
      phrases: ["transaction fee", "transaction cost", "network fee", "what are fees", "what is the fee"],
      any: ["fee", "fees", "cost", "costs"],
      need: [["fee", "fees", "cost", "costs"]],
      blockIf: ["reserve", "reserves"],
      a: "A network fee is paid so a transaction can be included on the ledger. It can change with network load. This draft does not set a fee — Xaman will show the fee before you sign, and the review screen notes that. I don’t suggest a fee amount. General information only, not financial advice.",
      href: "https://xrpl.org/docs/concepts/transactions/transaction-cost",
    },
    {
      id: "reserve",
      title: "what reserve is",
      phrases: ["owner reserve", "base reserve", "account reserve", "what is reserve", "what is the reserve"],
      any: ["reserve", "reserves"],
      need: [["reserve", "reserves"]],
      a: "An XRP Ledger account must hold a reserve — a minimum XRP balance. Some objects you own, such as an open escrow, add an owner reserve until they are removed. Reserve is not a fee paid to someone; that XRP stays in the account. I don’t suggest amounts. Official rules are in the XRPL docs.",
      href: "https://xrpl.org/docs/concepts/accounts/reserves",
    },
    {
      id: "explorer",
      title: "how to check a transaction on an explorer",
      phrases: [
        "check a transaction",
        "check my transaction",
        "look up a transaction",
        "look up the transaction",
        "find my transaction",
        "on an explorer",
        "transaction hash",
      ],
      any: ["explorer", "explorers", "xrpscan", "lookup", "look up"],
      need: [["explorer", "explorers", "xrpscan", "look up", "lookup", "check", "find", "hash"]],
      alsoNeed: [["transaction", "transactions", "tx", "hash", "explorer", "explorers", "xrpscan"]],
      a: "After a transaction is submitted, you can look it up on a public explorer with the transaction hash or account address, and read the result and details. I don’t submit transactions for you. If you have a signed blob, you can inspect it read-only on the Review step without submitting it.",
      href: "https://xrpl.org/docs/concepts/transactions",
    },
    {
      id: "failed",
      title: "what happens if a transaction fails",
      phrases: [
        "if a transaction fails",
        "if a tx fails",
        "transaction failed",
        "tx failed",
        "did not go through",
        "didn't go through",
      ],
      any: ["fail", "fails", "failed", "failure", "rejected", "tec", "tef", "tem"],
      need: [["fail", "fails", "failed", "failure", "rejected", "tec", "tef", "tem"]],
      a: "If a transaction fails, the intended payment or escrow is not applied. A result code explains why — for example, a missing destination tag, or trying to finish an escrow too early. Some failed results still destroy a small network fee. Check the result on an explorer, or inspect a blob on the Review step. General information only, not advice.",
      href: "https://xrpl.org/docs/references/protocol/transactions/transaction-results",
    },
    {
      id: "finishafter",
      title: "when an escrow can be finished",
      phrases: ["finish after", "finishafter", "when can i finish", "when can they claim", "when can he claim"],
      any: ["finishafter"],
      a: "FinishAfter is the earliest ledger time the escrow can be finished. Before that, EscrowFinish fails. Times follow ledger close time, which can be a few seconds off a wall clock. Set this in step 4 (Timing), then check the review screen. I don’t suggest a time.",
      href: "https://xrpl.org/docs/concepts/payment-types/escrow",
    },
    {
      id: "cancelafter",
      title: "when an escrow can be cancelled",
      phrases: ["cancel after", "cancelafter", "expires", "expiry", "expiration"],
      any: ["cancelafter", "expire", "expires", "expiry", "expiration"],
      a: "CancelAfter is when the escrow expires. After that it cannot be finished; EscrowCancel can return funds to the sender. An XRP escrow with no CancelAfter does not expire and cannot be cancelled. Set this in step 4 (Timing), then check the review screen. I don’t suggest a time.",
      href: "https://xrpl.org/docs/concepts/payment-types/escrow",
    },
    {
      id: "condition",
      title: "optional escrow conditions",
      phrases: ["secret code", "crypto condition", "crypto-condition"],
      any: ["condition", "fulfillment", "preimage"],
      need: [["condition", "conditions", "fulfillment", "preimage", "secret code"]],
      a: "The only supported crypto-condition type is PREIMAGE-SHA-256. EscrowCreate stores the Condition; EscrowFinish must supply the matching Fulfillment. Keep the fulfillment secret — losing it can lock funds until CancelAfter (if set). This is optional in step 5. I don’t suggest whether to use one.",
      href: "https://xrpl.org/docs/concepts/payment-types/escrow",
    },
    {
      id: "escrowfinish",
      title: "how EscrowFinish works",
      phrases: ["escrow finish", "escrowfinish", "finish the escrow", "release the escrow"],
      a: "EscrowFinish delivers escrowed funds to the destination when FinishAfter has passed and any condition is fulfilled. Conditional finishes can cost a higher network fee. You sign that transaction in Xaman after a review. I don’t suggest when to finish one.",
      href: "https://xrpl.org/docs/references/protocol/transactions/types/escrowfinish",
    },
    {
      id: "escrowcancel",
      title: "how EscrowCancel works",
      phrases: ["escrow cancel", "escrowcancel", "cancel the escrow", "return the escrow"],
      a: "EscrowCancel returns funds to the sender after CancelAfter. It cannot succeed before expiration. You sign that transaction in Xaman after a review. I don’t suggest when to cancel one.",
      href: "https://xrpl.org/docs/references/protocol/transactions/types/escrowcancel",
    },
    {
      id: "escrow",
      title: "what escrow is versus a normal payment",
      phrases: [
        "what is escrow",
        "how does escrow work",
        "escrow vs",
        "escrow versus",
        "versus a payment",
        "vs a payment",
        "compared to a payment",
        "normal payment",
        "difference between",
      ],
      any: ["escrow", "escrows"],
      need: [["escrow", "escrows"]],
      a: "A Payment delivers funds when the transaction succeeds. An escrow locks funds on the ledger until a finish time and/or a condition is met, then they can be released to the destination or returned to the sender. To draft an escrow, describe the deal in step 1 (Describe the deal). You’ll confirm a plain-word review before you sign in Xaman. General information only, not financial advice.",
      href: "https://xrpl.org/docs/concepts/payment-types/escrow",
    },
    {
      id: "payment",
      title: "sending a payment from one account to another",
      phrases: [
        "send a transaction",
        "send a payment",
        "send transaction",
        "send payment",
        "from one account to another",
        "from one wallet to another",
        "account to another",
        "wallet to another",
        "transaction from one",
      ],
      any: ["send", "sending", "pay", "payment", "payments", "transfer", "transferring"],
      need: [["send", "sending", "pay", "payment", "payments", "transfer", "transferring"]],
      alsoNeed: [["account", "accounts", "wallet", "wallets", "address", "another", "destination", "someone", "transaction", "transactions", "tx"]],
      blockIf: ["escrow", "escrows"],
      a: "A normal Payment sends funds from one account to another when the transaction is accepted. An escrow is different: it locks the funds until a time or condition is met. This page helps you draft an escrow. To start, describe the deal in step 1 (Describe the deal). You’ll get a plain-word review before anyone signs. You sign in Xaman — we will never ask for your seed. General information only, not financial advice.",
      href: "https://xrpl.org/docs/concepts/payment-types/direct-xrp-payments",
    },
    {
      id: "network",
      title: "which network a draft is for",
      phrases: ["switch network", "which network"],
      any: ["testnet", "mainnet"],
      need: [["testnet", "mainnet", "network"]],
      a: "The badge shows which network this draft is for. You can switch. Mainnet uses real XRP, so confirm first. This tool only drafts — you sign in Xaman. General information only, not financial advice.",
      href: "https://xrpl.org/docs/concepts/networks-and-servers/parallel-networks",
    },
  ];

  const DEFAULT_SUGGESTIONS = [
    "sending a payment from one account to another",
    "what a destination tag is",
    "how signing works",
  ];

  function normalize(question) {
    return String(question || "")
      .toLowerCase()
      .replace(/\[|\]/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasTerm(norm, term) {
    const t = String(term || "").toLowerCase();
    if (!t) return false;
    if (t.includes(" ")) return (" " + norm + " ").includes(" " + t + " ") || norm.includes(t);
    return new RegExp("\\b" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(norm);
  }

  function hasAny(norm, terms) {
    return (terms || []).some((t) => hasTerm(norm, t));
  }

  function scoreTopic(norm, topic) {
    if (hasAny(norm, topic.blockIf)) return 0;
    if (topic.need && !hasAny(norm, topic.need[0] || topic.need)) return 0;
    if (topic.alsoNeed && !hasAny(norm, topic.alsoNeed[0] || topic.alsoNeed)) return 0;
    let score = 0;
    (topic.phrases || []).forEach((p) => {
      if (norm.includes(p)) score += 3;
    });
    (topic.any || []).forEach((k) => {
      if (hasTerm(norm, k)) score += k.includes(" ") ? 2 : 1;
    });
    if (score <= 0 && (topic.phrases || []).some((p) => norm.includes(p))) score = 3;
    return score;
  }

  function rankTopics(question) {
    const norm = normalize(question);
    return TOPICS.map((topic) => ({ topic, score: scoreTopic(norm, topic) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || TOPICS.indexOf(a.topic) - TOPICS.indexOf(b.topic));
  }

  function matchIntent(question) {
    const ranked = rankTopics(question);
    if (!ranked.length) return null;
    return { id: ranked[0].topic.id, score: ranked[0].score, topic: ranked[0].topic, ranked };
  }

  function fallbackSuggestions(question) {
    const titles = rankTopics(question)
      .map((x) => x.topic.title)
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, 3);
    const list = titles.length >= 2 ? titles : DEFAULT_SUGGESTIONS;
    if (list.length === 2) return list[0] + " or " + list[1];
    return list[0] + ", " + list[1] + ", or " + list[2];
  }

  function answer(question) {
    const q = String(question || "").trim();
    if (!q) return null;
    if (window.EscrowParser?.looksLikeSecret?.(q) || window.EscrowParser?.looksLikeSeed?.(q)) {
      return {
        a: "We will never ask for your seed. That looked like a seed or secret key, so it was not stored or sent. Sign only in Xaman. General information only — not financial advice.",
        href: "https://xrpl.org/docs/concepts/accounts",
        blocked: true,
      };
    }
    if (/\b(buy|sell|price|should i|worth|invest)\b/i.test(q)) {
      return {
        a: "I won’t answer buy/sell/price or ‘should I’ questions. I only explain how XRPL payments and escrow work. General information only — not financial advice.",
        href: "https://xrpl.org/docs/concepts/payment-types/escrow",
        refusal: true,
      };
    }
    const hit = matchIntent(q);
    if (hit) {
      return { a: hit.topic.a, href: hit.topic.href, id: hit.id };
    }
    return {
      a:
        "I don’t have a curated answer for that yet. I can explain " +
        fallbackSuggestions(q) +
        ". You can also describe the deal in step 1 and check the review screen before you sign. Official escrow docs have more detail.",
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

  window.EscrowFAQ = {
    answer,
    matchIntent,
    normalize,
    rankTopics,
    logFaqLocal,
    TOPICS,
    FAQ_COUNT: TOPICS.length,
  };
})();
