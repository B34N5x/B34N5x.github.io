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
      a: "A destination tag is a number some services, including many exchanges, use to credit the right account. If that kind of address is missing a tag, the funds can be hard to credit, and some accounts will reject the transaction. A service can also use one address with many tags to route payments. You can add a tag in step 2 (Confirm parties). The review screen also warns when a tag looks missing. This is a reminder, not advice.",
      href: "https://xrpl.org/docs/concepts/accounts/addresses",
      sources: [
        "https://xrpl.org/docs/concepts/accounts/addresses",
        "https://xrpl-ai.org/faq#tags-memos",
      ],
    },
    {
      id: "memo",
      title: "what a memo is",
      phrases: ["what is a memo", "what are memos", "memo data", "memo field"],
      any: ["memo", "memos"],
      need: [["memo", "memos"]],
      a: "A memo is an optional note attached to a transaction. It is often stored as hex; the review screen can show it in plain words when it decodes. Memos are public on the ledger. I don’t suggest what to write in one.",
      href: "https://xrpl.org/docs/references/protocol/transactions/common-fields",
      sources: [
        "https://xrpl.org/docs/references/protocol/transactions/common-fields",
        "https://xrpl-ai.org/faq#tags-memos",
      ],
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
      a: "Official XRPL AI guidance is a human preview before every signature, and that keys never leave the signer. QU1PU only drafts what a transaction would do. You read a plain-word summary on the Review step, then you sign in Xaman yourself. We will never ask for your seed or secret. Nothing is auto-signed.",
      href: "https://xrpl-ai.org/faq#official-xrpl-resources",
      sources: [
        "https://xrpl-ai.org/faq#official-xrpl-resources",
        "https://xrpl-ai.org/faq#custody",
        "https://xrpl.org/docs/concepts/transactions",
      ],
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
      sources: ["https://xrpl.org/docs/concepts/transactions/transaction-cost"],
    },
    {
      id: "reserve",
      title: "what reserve is",
      phrases: ["owner reserve", "base reserve", "account reserve", "what is reserve", "what is the reserve"],
      any: ["reserve", "reserves"],
      need: [["reserve", "reserves"]],
      a: "An XRP Ledger account must hold a reserve — a minimum XRP balance. Some objects you own, such as an open escrow, add an owner reserve until they are removed. Reserve is not a fee paid to someone; that XRP stays in the account. I don’t suggest amounts. Official rules are in the XRPL docs.",
      href: "https://xrpl.org/docs/concepts/accounts/reserves",
      sources: ["https://xrpl.org/docs/concepts/accounts/reserves"],
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
      sources: [
        "https://xrpl.org/docs/concepts/transactions",
        "https://xrpl-ai.org/faq#why-presigned",
      ],
      tools: ["tracer"],
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
      sources: ["https://xrpl.org/docs/references/protocol/transactions/transaction-results"],
      tools: ["tracer"],
    },
    {
      id: "finishafter",
      title: "when an escrow can be finished",
      phrases: ["finish after", "finishafter", "when can i finish", "when can they claim", "when can he claim"],
      any: ["finishafter"],
      a: "FinishAfter is the earliest ledger time the escrow can be finished. Before that, EscrowFinish fails. Times follow ledger close time, which can be a few seconds off a wall clock. Set this in step 4 (Timing), then check the review screen. I don’t suggest a time.",
      href: "https://xrpl.org/docs/concepts/payment-types/escrow",
      sources: ["https://xrpl.org/docs/concepts/payment-types/escrow"],
    },
    {
      id: "cancelafter",
      title: "when an escrow can be cancelled",
      phrases: ["cancel after", "cancelafter", "expires", "expiry", "expiration"],
      any: ["cancelafter", "expire", "expires", "expiry", "expiration"],
      a: "CancelAfter is when the escrow expires. After that it cannot be finished; EscrowCancel can return funds to the sender. An XRP escrow with no CancelAfter does not expire and cannot be cancelled. Set this in step 4 (Timing), then check the review screen. I don’t suggest a time.",
      href: "https://xrpl.org/docs/concepts/payment-types/escrow",
      sources: ["https://xrpl.org/docs/concepts/payment-types/escrow"],
    },
    {
      id: "condition",
      title: "optional escrow conditions",
      phrases: ["secret code", "crypto condition", "crypto-condition"],
      any: ["condition", "fulfillment", "preimage"],
      need: [["condition", "conditions", "fulfillment", "preimage", "secret code"]],
      a: "The only supported crypto-condition type is PREIMAGE-SHA-256. EscrowCreate stores the Condition; EscrowFinish must supply the matching Fulfillment. Keep the fulfillment secret — losing it can lock funds until CancelAfter (if set). This is optional in step 5. I don’t suggest whether to use one.",
      href: "https://xrpl.org/docs/concepts/payment-types/escrow",
      sources: ["https://xrpl.org/docs/concepts/payment-types/escrow"],
    },
    {
      id: "escrowfinish",
      title: "how EscrowFinish works",
      phrases: ["escrow finish", "escrowfinish", "finish the escrow", "release the escrow"],
      a: "EscrowFinish delivers escrowed funds to the destination when FinishAfter has passed and any condition is fulfilled. Conditional finishes can cost a higher network fee. You sign that transaction in Xaman after a review. I don’t suggest when to finish one.",
      href: "https://xrpl.org/docs/references/protocol/transactions/types/escrowfinish",
      sources: ["https://xrpl.org/docs/references/protocol/transactions/types/escrowfinish"],
    },
    {
      id: "escrowcancel",
      title: "how EscrowCancel works",
      phrases: ["escrow cancel", "escrowcancel", "cancel the escrow", "return the escrow"],
      a: "EscrowCancel returns funds to the sender after CancelAfter. It cannot succeed before expiration. You sign that transaction in Xaman after a review. I don’t suggest when to cancel one.",
      href: "https://xrpl.org/docs/references/protocol/transactions/types/escrowcancel",
      sources: ["https://xrpl.org/docs/references/protocol/transactions/types/escrowcancel"],
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
      sources: ["https://xrpl.org/docs/concepts/payment-types/escrow"],
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
      sources: [
        "https://xrpl.org/docs/concepts/payment-types/direct-xrp-payments",
        "https://xrpl-ai.org/faq#official-xrpl-resources",
      ],
    },
    {
      id: "network",
      title: "which network a draft is for",
      phrases: ["switch network", "which network"],
      any: ["testnet", "mainnet"],
      need: [["testnet", "mainnet", "network"]],
      a: "The badge shows which network this draft is for. You can switch. Mainnet uses real XRP, so confirm first. This tool only drafts — you sign in Xaman. General information only, not financial advice.",
      href: "https://xrpl.org/docs/concepts/networks-and-servers/parallel-networks",
      sources: ["https://xrpl.org/docs/concepts/networks-and-servers/parallel-networks"],
    },

    {
      id: "blob",
      title: "what a presigned blob is",
      phrases: ["presigned blob", "pre-signed blob", "signed blob", "tx blob", "transaction blob", "decode a blob", "inspect a blob"],
      any: ["blob", "presigned", "pre-signed"],
      need: [["blob", "presigned", "pre-signed"]],
      a: "A presigned blob is a fully formed transaction the payer has already signed. Someone who has the blob can submit it or drop it, but they cannot change the amount, destination, or fee without breaking the signature. Keys stay in the signer. On the Review step you can decode a blob read-only to see what it would do; I will not submit it.",
      href: "https://xrpl-ai.org/faq#why-presigned",
      sources: [
        "https://xrpl-ai.org/faq#why-presigned",
        "https://xrpl-ai.org/faq#custody",
        "https://xrpl.org/docs/concepts/transactions",
      ],
    },
    {
      id: "xrpl",
      title: "what the XRP Ledger is",
      phrases: ["what is xrpl", "what is the xrpl", "what is the xrp ledger", "what is xrp", "what are xrp"],
      any: ["xrpl", "xrp ledger"],
      need: [["xrpl", "xrp", "xrp ledger"]],
      blockIf: ["escrow", "payment", "fee", "tag", "memo", "reserve"],
      a: "The XRP Ledger is a public, open-source blockchain. XRP is its built-in digital asset, used to pay network fees and to transfer value. Official detail is in the XRPL docs. This page helps you draft an escrow in plain words — start in step 1, then review it before you sign in Xaman. General information only, not financial advice.",
      href: "https://xrpl.org/docs/introduction/what-is-the-xrp-ledger",
      sources: ["https://xrpl.org/docs/introduction/what-is-the-xrp-ledger"],
      tools: ["explainer"],
    },
    {
      id: "consensus",
      title: "how the ledger reaches agreement",
      phrases: ["how does the ledger work", "how the ledger works", "consensus", "validators", "how are transactions confirmed"],
      any: ["consensus", "validator", "validators"],
      a: "On the XRP Ledger, a network of validators runs a consensus protocol to agree on which transactions are included. Official detail is in the XRPL docs. This page is for drafting an escrow — describe the deal in step 1 and review it before you sign in Xaman. General information only, not financial advice.",
      href: "https://xrpl.org/docs/concepts/consensus-protocol",
      sources: ["https://xrpl.org/docs/concepts/consensus-protocol"],
      tools: ["explainer"],
    },
    {
      id: "accounts",
      title: "what an XRPL account is",
      phrases: ["what is an account", "classic address", "xrpl account", "r address"],
      any: ["classic address"],
      need: [["account", "accounts", "address", "addresses"]],
      alsoNeed: [["xrpl", "xrp", "classic", "ledger", "wallet"]],
      blockIf: ["destination tag", "dest tag", "send a", "payment"],
      a: "An XRP Ledger account is identified by a classic address starting with r, and it holds XRP plus any objects it owns. You control it with keys in your own signer. I don’t suggest addresses or amounts. Official detail is in the XRPL docs. To draft an escrow, start in step 1 and review it before you sign in Xaman.",
      href: "https://xrpl.org/docs/concepts/accounts",
      sources: ["https://xrpl.org/docs/concepts/accounts"],
      tools: ["checker"],
    },
    {
      id: "dex",
      title: "the XRPL decentralized exchange",
      phrases: ["decentralized exchange", "what is the dex", "offercreate", "dex offer", "trading offer"],
      any: ["dex", "offercreate", "offercancel"],
      need: [["dex", "offer", "offers", "offercreate", "offercancel", "exchange"]],
      alsoNeed: [["xrpl", "xrp", "ledger", "dex", "offercreate", "offercancel", "decentralized"]],
      a: "The XRP Ledger has a built-in decentralized exchange, where OfferCreate and OfferCancel place or cancel trading offers. Official detail is in the XRPL docs. This page helps you draft an escrow, not a trading offer. Start in step 1 if you want to draft an escrow. General information only, not financial advice.",
      href: "https://xrpl.org/docs/concepts/tokens/decentralized-exchange",
      sources: ["https://xrpl.org/docs/concepts/tokens/decentralized-exchange"],
    },
    {
      id: "nfts",
      title: "NFTokens on the XRP Ledger",
      phrases: ["what is an nft", "nftoken", "xrpl nft", "nfts on xrpl"],
      any: ["nft", "nfts", "nftoken", "nftokens"],
      a: "The XRP Ledger can issue NFTokens with its built-in NFT transaction types. Official detail is in the XRPL docs. This page is for drafting an escrow — start in step 1 and review it before you sign in Xaman. General information only, not financial advice.",
      href: "https://xrpl.org/docs/concepts/tokens/nfts",
      sources: ["https://xrpl.org/docs/concepts/tokens/nfts"],
    },
    {
      id: "amendments",
      title: "what amendments are",
      phrases: ["what is an amendment", "xrpl amendment", "amendments"],
      any: ["amendment", "amendments"],
      need: [["amendment", "amendments"]],
      a: "Amendments are protocol changes that validators can enable on the XRP Ledger. Official detail is in the XRPL docs. This page is for drafting an escrow — start in step 1 and review it before you sign in Xaman.",
      href: "https://xrpl.org/docs/concepts/networks-and-servers/amendments",
      sources: ["https://xrpl.org/docs/concepts/networks-and-servers/amendments"],
      tools: ["explainer"],
    },
    {
      id: "balance",
      title: "checking an XRP balance",
      phrases: ["check a balance", "check my balance", "xrp balance", "account balance"],
      any: ["balance", "balances"],
      need: [["balance", "balances"]],
      a: "Anyone can look up the XRP balance of a public classic address; you do not need to share a seed. I don’t suggest amounts. Official account details are in the XRPL docs. This page drafts escrows — start in step 1 if that’s what you need.",
      href: "https://xrpl.org/docs/concepts/accounts",
      sources: ["https://xrpl.org/docs/concepts/accounts"],
      tools: ["checker"],
    },
    {
      id: "family-lock",
      title: "time-locking XRP for family",
      phrases: ["family vault", "lock xrp for family", "time lock for family", "time-lock for family"],
      any: ["family vault"],
      need: [["family"]],
      alsoNeed: [["vault", "lock", "time", "escrow", "will", "heir", "heirs"]],
      a: "XRPL escrow can lock funds until a time or condition is met, including for later release. Official escrow rules are in the XRPL docs. This page helps you draft an escrow in plain words — start in step 1 and review it before you sign in Xaman. Not financial or legal advice.",
      href: "https://xrpl.org/docs/concepts/payment-types/escrow",
      sources: ["https://xrpl.org/docs/concepts/payment-types/escrow"],
      tools: ["vault", "will"],
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


  const PUBLIC_TOOLS = {
    explainer: { href: "https://b34n5.xyz/explainer/", label: "XRPL Explainer" },
    tracer: { href: "https://b34n5.xyz/tracer/", label: "Transaction Tracer" },
    checker: { href: "https://b34n5.xyz/checker/", label: "Balance Checker" },
    batch: { href: "https://b34n5.xyz/checker/batch/", label: "BatchChecker" },
    vault: { href: "https://b34n5.xyz/family-vault/", label: "Family Vault" },
    lobby: { href: "https://b34n5.xyz/TheLobby/", label: "The Lobby" },
    tools: { href: "https://b34n5.xyz/tools/", label: "Tools" },
    will: { href: "https://xrpl-will.pages.dev/", label: "XRPL Will" },
  };

  const ALLOWED_SOURCE_PREFIX = ["https://xrpl.org/", "https://xrpl-ai.org/"];
  const XRPL_TERMS = [
    "xrpl", "xrp", "ledger", "escrow", "payment", "transaction", "tx", "account",
    "wallet", "address", "destination", "tag", "memo", "fee", "reserve", "sign",
    "xaman", "blob", "invoice", "explorer", "hash", "trust", "offer", "nft",
    "nftoken", "amendment", "validator", "consensus", "dex", "iou", "drops",
    "testnet", "mainnet", "ripple", "qu1pu", "condition", "fulfillment", "preimage",
    "finishafter", "cancelafter", "signer",
  ];

  function steerOffTopic() {
    return "I only cover XRP Ledger and escrow questions here. I can explain " + fallbackSuggestions("") + ".";
  }

  function sourcesOf(topicOrAns) {
    const list = (topicOrAns && (topicOrAns.sources || (topicOrAns.href ? [topicOrAns.href] : []))) || [];
    return list.filter((u) => ALLOWED_SOURCE_PREFIX.some((p) => String(u).startsWith(p)));
  }

  function toolsOf(ids) {
    const out = [];
    const seen = {};
    (ids || []).forEach((id) => {
      const t = PUBLIC_TOOLS[id];
      if (!t || seen[t.href]) return;
      if (/preview-/i.test(t.href)) return;
      seen[t.href] = true;
      out.push({ href: t.href, label: t.label });
    });
    return out;
  }

  function isInjection(text) {
    const s = String(text || "");
    const n = normalize(s);
    const patterns = [
      /\bignore (all |the |your )?(previous |prior |above )?(instructions|rules|prompts)\b/,
      /\bdisregard (your |all |the )?(previous )?(instructions|rules)\b/,
      /\byou are now\b/,
      /\bact as\b/,
      /\brole\s*play\b/,
      /\bpretend (you|to be|you are|you're)\b/,
      /\bsystem\s*:/,
      /\bdeveloper mode\b/,
      /\bjailbreak\b/,
      /\bdo anything now\b/,
      /\benable dan\b/,
      /\byou are dan\b/,
      /\b(reveal|show|print|dump) (your )?(system prompt|hidden (prompt|instructions)|instructions)\b/,
      /\boverride (your )?(rules|instructions|programming)\b/,
      /\bforget (your |all )?(rules|instructions)\b/,
      /\bnew (system )?prompt\b/,
      /\bsign (this|it|that|the transaction)?( now)? (for me|on my behalf|for us)\b/,
      /\b(sign|submit|broadcast) (it |this |that )?(on my behalf|for me)\b/,
      /\b(give|tell|send|share|show) (me )?(your )?(seed|secret|private key|mnemonic|secret key)\b/,
    ];
    if (patterns.some((re) => re.test(n) || re.test(s.toLowerCase()))) return true;
    return false;
  }

  const ABUSE_RE = /\b(fuck|fucking|shit|bitch|asshole|bastard|cunt|dick|piss off|slut|whore|retard|retarded|nigger|nigga|faggot|fag|kike|tranny|spic|chink|idiot|moron|stupid|dumbass|shut up)\b/i;
  const CHEEKY_RE = /\b(you suck|this is useless|dumb bot|stupid bot|lol bot|shut up|tell me a joke|write me a poem|what.?s the weather)\b/i;

  function isAbuse(text) {
    return ABUSE_RE.test(String(text || ""));
  }

  function hasXrplTerms(text) {
    const n = normalize(text);
    return XRPL_TERMS.some((w) => hasTerm(n, w));
  }

  function isOffTopic(text) {
    if (isAbuse(text) || CHEEKY_RE.test(String(text || ""))) return true;
    return !hasXrplTerms(text);
  }

  function pack(extra) {
    const sources = sourcesOf(extra);
    const tools = toolsOf(extra.tools || extra.toolIds);
    return Object.assign({ sources, tools, href: sources[0] }, extra, { sources, tools, href: extra.href || sources[0] });
  }

  function answer(question) {
    const q = String(question || "").trim();
    if (!q) return null;
    if (window.EscrowParser?.looksLikeSecret?.(q) || window.EscrowParser?.looksLikeSeed?.(q)) {
      return pack({
        a: "We will never ask for your seed. That looked like a seed or secret key, so it was not stored or sent. Sign only in Xaman. General information only — not financial advice.",
        href: "https://xrpl.org/docs/concepts/accounts",
        sources: ["https://xrpl.org/docs/concepts/accounts"],
        blocked: true,
        hideUser: true,
      });
    }
    if (isInjection(q)) {
      return pack({
        a:
          "I can’t follow requests that try to change my rules, reveal hidden instructions, or have me sign or handle a seed or key. We will never ask for your seed, and I don’t sign for you — you sign in Xaman. I can explain sending a payment, destination tags, or how signing works.",
        href: "https://xrpl-ai.org/faq#custody",
        sources: ["https://xrpl-ai.org/faq#custody", "https://xrpl-ai.org/faq#official-xrpl-resources"],
        injection: true,
        refusal: true,
      });
    }
    if (/\b(buy|sell|price|should i|worth|invest)\b/i.test(q)) {
      return pack({
        a: "I won’t answer buy/sell/price or ‘should I’ questions. I only explain how XRPL payments and escrow work. General information only — not financial advice.",
        href: "https://xrpl.org/docs/concepts/payment-types/escrow",
        sources: ["https://xrpl.org/docs/concepts/payment-types/escrow"],
        refusal: true,
      });
    }
    if (isAbuse(q) || CHEEKY_RE.test(q) || (!hasXrplTerms(q) && !matchIntent(q))) {
      return {
        a: steerOffTopic(),
        offTopic: true,
        hideUser: isAbuse(q),
        sources: [],
        tools: [],
      };
    }
    const hit = matchIntent(q);
    if (hit) {
      return pack({
        a: hit.topic.a,
        href: hit.topic.href,
        sources: hit.topic.sources || [hit.topic.href],
        tools: hit.topic.tools,
        id: hit.id,
      });
    }
    if (hasXrplTerms(q)) {
      return pack({
        a:
          "I can share general information from the official XRPL docs, but I don’t have a curated answer for that exact question, and I won’t invent one. Official documentation is the source of truth. This page helps you draft an escrow in plain words — describe the deal in step 1, then review it before you sign in Xaman.",
        href: "https://xrpl.org/docs",
        sources: ["https://xrpl.org/docs"],
        tools: ["explainer", "tools"],
        fallback: true,
        xrplGeneral: true,
      });
    }
    return {
      a: steerOffTopic(),
      offTopic: true,
      sources: [],
      tools: [],
    };
  }

  function logFaqLocal(question, answerObj) {
    try {
      const key = "escrowAssistant.faqLog";
      const prev = JSON.parse(localStorage.getItem(key) || "[]");
      const storedQ = answerObj && (answerObj.hideUser || answerObj.injection || answerObj.blocked)
        ? "[hidden]"
        : String(question || "").slice(0, 240);
      prev.unshift({ t: new Date().toISOString(), q: storedQ, href: answerObj && answerObj.href });
      localStorage.setItem(key, JSON.stringify(prev.slice(0, 50)));
    } catch (_) {}
  }

  window.EscrowFAQ = {
    answer,
    matchIntent,
    normalize,
    rankTopics,
    isInjection,
    isAbuse,
    isOffTopic,
    hasXrplTerms,
    toolsOf,
    sourcesOf,
    PUBLIC_TOOLS,
    steerOffTopic,
    logFaqLocal,
    TOPICS,
    FAQ_COUNT: TOPICS.length,
  };
})();
