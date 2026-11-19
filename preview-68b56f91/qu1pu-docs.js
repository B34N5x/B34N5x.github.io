(() => {
  "use strict";

  const STOP = new Set("a an the of and to in is it for on or as be by at from that this with are was were been being not no do does did can will would should may might have has had you your we they their its if then than also into over such any all about how what when where why who which than does".split(" "));
  const K1 = 1.5;
  const B = 0.75;
  const ALLOWED_SOURCE = [
    "https://xrpl.org/",
    "https://xrpl-ai.org/",
    "https://help.xaman.app/",
    "https://ripple.com/",
    "https://www.xrpl.foundation/",
    "https://x.com/Vet_X0",
    "https://x.com/bearableguy123",
  ];

  const EXPAND = [
    [/\b(fees?|transaction cost|burned|destroyed)\b/i, ["transaction", "cost", "destroyed", "burned", "fee"]],
    [/\breserves?\b/i, ["reserve", "base", "owner", "requirement"]],
    [/\bamm\b|automated market maker/i, ["automated", "market", "maker", "amm"]],
    [/\b(lend|loan|borrow)/i, ["lending", "protocol", "loan", "broker", "vault", "borrower"]],
    [/\bcredentials?\b/i, ["credential", "credentials"]],
    [/\bpermissioned domains?\b/i, ["permissioned", "domain", "credentials"]],
    [/\bbatch\b/i, ["batch", "transaction"]],
    [/\b(destination tags?|dest tags?)\b/i, ["destination", "tag", "source"]],
    [/\bescrow\b/i, ["escrow", "lock", "finish", "cancel"]],
    [/\b(freeze|clawback)\b/i, ["freeze", "clawback", "xrp", "token", "issuer"]],
    [/\bpayments?\b/i, ["payment", "payments", "transaction"]],
  ];

  const TOOLS = [
    { re: /\b(escrow|finishafter|cancel after|crypto-condition|xaman|draft)\b/i, href: "https://b34n5.xyz/qu1pu/", label: "QU1PU" },
    { re: /\b(trace|tracer|failed transaction|payment path|globe)\b/i, href: "https://b34n5.xyz/tracer/", label: "Transaction Tracer" },
    { re: /\b(consensus|validator|how the ledger works|explainer)\b/i, href: "https://b34n5.xyz/explainer/", label: "XRPL Explainer" },
  ];

  const GUIDE_RE = /this page (helps|is for|drafts)|describe the deal in step|start in step(?:\s*1)?|open the full (?:guided )?guide|go to the full|for the full guided|to draft an escrow|you’ll confirm a plain-word review|you'll confirm a plain-word review|start in step 1, then review|this draft does not|the review screen|xaman will show the fee|you can add a tag in step|step 2 \(confirm parties\)/i;

  let index = null;
  let inv = null;
  let loadPromise = null;

  function assetDir() {
    const s = document.querySelector('script[src*="qu1pu-bubble.js"], script[src*="qu1pu-docs.js"]');
    if (s && s.src) return s.src.replace(/qu1pu-(?:bubble|docs)\.js.*$/, "");
    return "./";
  }

  function toks(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w && w.length > 1 && !STOP.has(w));
  }

  function expandQuery(question) {
    const q = String(question || "");
    const bag = new Set(toks(q));
    EXPAND.forEach(([re, words]) => {
      if (re.test(q)) words.forEach((w) => bag.add(w));
    });
    return [...bag];
  }

  function buildInv(docs) {
    const N = docs.length;
    const tokenized = docs.map((d) => toks([d.t, d.s, d.x].join(" ")));
    const df = Object.create(null);
    let total = 0;
    tokenized.forEach((ts) => {
      total += ts.length;
      const seen = Object.create(null);
      ts.forEach((t) => {
        if (!seen[t]) {
          seen[t] = 1;
          df[t] = (df[t] || 0) + 1;
        }
      });
    });
    return { N, tokenized, df, avgdl: total / Math.max(1, N) };
  }

  function bm25(question, limit) {
    if (!index || !inv) return [];
    const qTokens = expandQuery(question);
    const qSet = new Set(qTokens);
    const raw = String(question || "").toLowerCase();
    const { N, tokenized, df, avgdl } = inv;
    const scored = [];
    for (let i = 0; i < index.docs.length; i++) {
      const doc = index.docs[i];
      const ts = tokenized[i];
      const tf = Object.create(null);
      for (let j = 0; j < ts.length; j++) tf[ts[j]] = (tf[ts[j]] || 0) + 1;
      let score = 0;
      for (let k = 0; k < qTokens.length; k++) {
        const t = qTokens[k];
        const n = df[t];
        if (!n) continue;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        const f = tf[t] || 0;
        const dl = ts.length || 1;
        if (f) score += idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * dl / avgdl));
        const head = (doc.t + " " + doc.s).toLowerCase();
        if (head.indexOf(t) !== -1) score += 0.4 * idf;
      }
      if (score <= 0) continue;
      score += 0.5 * (doc.p || 0);
      if ((doc.s || "") === doc.t) score += 0.7;
      const title = String(doc.t || "").toLowerCase();
      if (title && raw.indexOf(title) !== -1) score += 3;
      // phrase-ish: share many title tokens
      const titleToks = toks(doc.t);
      const overlap = titleToks.filter((t) => qSet.has(t)).length;
      if (titleToks.length && overlap === titleToks.length) score += 2.2;
      else if (overlap >= 2) score += 1.1;
      scored.push({ score, doc });
    }
    scored.sort((a, b) => b.score - a.score || (b.doc.p || 0) - (a.doc.p || 0));
    return scored.slice(0, limit || 8);
  }

  function allowedSrc(href) {
    const u = String(href || "");
    if (!u || /preview-/i.test(u)) return false;
    return ALLOWED_SOURCE.some((p) => u.startsWith(p));
  }

  function splitSentences(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+(?=[A-Z0-9“"'])/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 28 && s.length <= 420)
      .filter((s) => !/^note:/i.test(s) && !/^\s*warning/i.test(s));
  }

  function sentenceScore(s, qTokens) {
    const st = new Set(toks(s));
    let sc = 0;
    qTokens.forEach((t) => { if (st.has(t)) sc += 1; });
    if (/\b(is|are|lets|enables|means|destroys|destroyed|burned|cannot|can't)\b/i.test(s)) sc += 1.2;
    if (/^(the |an? )?[a-z0-9].{0,80}\b(is|are)\b/i.test(s)) sc += 1.3;
    return sc;
  }

  function tooSimilar(a, b) {
    const A = new Set(toks(a));
    const B = new Set(toks(b));
    let inter = 0;
    A.forEach((t) => { if (B.has(t)) inter += 1; });
    const union = A.size + B.size - inter;
    return union ? inter / union > 0.72 : false;
  }

  function isAnaphoric(s) {
    return /^(if they|they |this |these |it |that |those )\b/i.test(String(s || "").trim());
  }

  function isDefinition(s) {
    const t = String(s || "").trim();
    return /^(The |An? )?[A-Z][\w /()\-]{1,80} (is|are|can be) (a|an|the|used|destroyed|burned|not)\b/.test(t)
      || /\bis (destroyed|burned)\b/i.test(t)
      || /\bis an XRP Ledger\b|\bis a set of tools\b|\bis the (native|cryptocurrency|transaction cost)\b/i.test(t);
  }

  function extractAnswer(question, hits) {
    const qTokens = expandQuery(question);
    const cands = [];
    hits.forEach((h, rank) => {
      const defChunk = (h.doc.s || "") === h.doc.t || rank === 0;
      splitSentences(h.doc.x).forEach((s) => {
        if (isAnaphoric(s)) return;
        let sc = sentenceScore(s, qTokens) + Math.max(0, 2.4 - rank * 0.3) + (h.doc.p || 0) * 0.2;
        if (isDefinition(s)) sc += 2.2;
        if (defChunk && isDefinition(s)) sc += 1.2;
        if (sc >= 1.2) cands.push({ s, sc, url: h.doc.u, title: h.doc.t, def: isDefinition(s) });
      });
    });
    cands.sort((a, b) => (b.def - a.def) || (b.sc - a.sc));
    const picked = [];
    const urls = [];
    cands.forEach((c) => {
      if (picked.length >= 5) return;
      if (picked.some((p) => tooSimilar(p, c.s))) return;
      picked.push(c.s);
      if (allowedSrc(c.url) && urls.indexOf(c.url) === -1) urls.push(c.url);
    });
    // If we skipped everything as anaphoric, fall back to unfiltered top sentences.
    if (!picked.length) {
      hits.forEach((h) => {
        splitSentences(h.doc.x).forEach((s) => {
          if (picked.length >= 4) return;
          if (picked.some((p) => tooSimilar(p, s))) return;
          picked.push(s);
          if (allowedSrc(h.doc.u) && urls.indexOf(h.doc.u) === -1) urls.push(h.doc.u);
        });
      });
    }
    return { text: picked.join(" "), sources: urls.slice(0, 3) };
  }

  function closeTopics(hits) {
    const titles = [];
    hits.forEach((h) => {
      const t = h.doc.t || h.doc.s;
      if (t && titles.indexOf(t) === -1) titles.push(t);
    });
    return titles.slice(0, 3);
  }

  function toolLinks(question, ansText) {
    const blob = question + " " + (ansText || "");
    const out = [];
    const seen = {};
    TOOLS.forEach((t) => {
      if (!t.re.test(blob) || seen[t.href]) return;
      seen[t.href] = 1;
      out.push({ href: t.href, label: t.label });
    });
    return out;
  }

  function cleanGuideTalk(text) {
    return String(text || "")
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim() && !GUIDE_RE.test(s))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function looksStub(text) {
    const s = String(text || "");
    if (s.length < 80) return true;
    if (/official detail is in the xrpl docs/i.test(s) && s.length < 220) return true;
    if (/this draft does not|the review screen|xaman will show the fee|i don.?t suggest a fee/i.test(s)) return true;
    return false;
  }

  function pack(text, sources, tools, extra) {
    return Object.assign({
      a: text,
      sources: (sources || []).filter(allowedSrc),
      tools: tools || [],
      href: ((sources || []).find(allowedSrc)) || "",
    }, extra || {});
  }

  async function load() {
    if (index) return index;
    if (loadPromise) return loadPromise;
    const url = assetDir() + "docs-index.json";
    loadPromise = fetch(url, { credentials: "same-origin" })
      .then((r) => {
        if (!r.ok) throw new Error("index " + r.status);
        return r.json();
      })
      .then((data) => {
        index = data;
        inv = buildInv(data.docs || []);
        return index;
      })
      .catch((err) => {
        loadPromise = null;
        throw err;
      });
    return loadPromise;
  }

  function answerFromDocs(question) {
    const hits = bm25(question, 8);
    if (!hits.length) return null;
    const top = hits[0].score;
    const weak = top < 5.5;
    const extracted = extractAnswer(question, hits);
    if (!extracted.text) return null;
    let text = extracted.text;
    if (weak) {
      const topics = closeTopics(hits);
      if (topics.length) {
        text += " You might also want to know about " +
          (topics.length === 1 ? topics[0] : topics.slice(0, -1).join(", ") + ", or " + topics[topics.length - 1]) +
          ".";
      }
    }
    return pack(text, extracted.sources, toolLinks(question, text), { weak: weak, retrieved: true });
  }


  const SECURITY_RE = /\b(?:how (?:can|do|to) (?:i |you )?(?:secure|stay safe|keep (?:my |your )?(?:xrp|wallet|account|funds|keys?) safe|avoid (?:a )?scams?)|secur(?:e|ing) (?:my |your )?(?:xrp|wallet|account|funds|keys?|secret)|(?:avoid|spot|report) (?:a )?scams?|scams?|phish(?:ing)?|airdrops?|giveaways?|fake support|support (?:dm|account)|dmed me|dm'?d me|direct messag|someone (?:dmed|messaged|texted)|lost (?:my )?(?:seed|secret|mnemonic|recovery)|forgot (?:my )?(?:seed|secret)|verify (?:my |your )?wallet|hardware wallet|stay safe|not (?:get )?scammed)\b/i;
  const MEME_RE = /\b(?:wen moon|wen lambo|price prediction|price target|will xrp hit|should i (?:buy|sell|invest)|buy xrp|sell xrp|xrp(?:'s)? price|price of xrp|how much will (?:xrp|it)|going to (?:the moon|moon)|to the moon|lambo|financial advice|is xrp (?:a good|worth)|worth investing|what(?:'s| is) (?:the |xrp )price)\b/i;
  const PROTOCOL_WORDS = /^(xrp|xrpl|ripple|escrow|amm|validator|ledger|payment|payments|tag|memo|fee|fees|reserve|reserves|credential|credentials|vault|loan|lending|batch|domain|transaction|account|wallet|qu1pu)$/i;

  const PEOPLE = [
    {
      aliases: ["david schwartz", "schwartz", "joelkatz", "joel katz", "@joelkatz"],
      a: "David Schwartz is a co-creator of the XRP Ledger and is described by Ripple as CTO Emeritus. This is a public role, not an endorsement.",
      sources: [
        "https://xrpl.org/about/history",
        "https://ripple.com/insights/ripple-swell-2026-recap/",
      ],
    },
    {
      aliases: ["vet", "vet_x0", "@vet_x0", "hussein zangana"],
      a: "Vet, who posts as @Vet_X0 on X, is affiliated with the XRP Ledger Foundation. This is a public affiliation, not an endorsement.",
      sources: ["https://x.com/Vet_X0"],
    },
    {
      aliases: ["bg123", "bg 123", "bearableguy123", "@bearableguy123", "bearable guy 123", "bearableguy"],
      a: "BG123 is a well-known XRP community account on X, typically @bearableguy123. I only note that public account. I can’t verify who runs it, and this is not an endorsement.",
      sources: ["https://x.com/bearableguy123"],
    },
    {
      aliases: ["brad garlinghouse", "garlinghouse"],
      a: "Brad Garlinghouse is the Chief Executive Officer of Ripple, according to Ripple’s official leadership page. This is a public role, not an endorsement.",
      sources: ["https://ripple.com/company/leadership/"],
    },
    {
      aliases: ["chris larsen", "larsen"],
      a: "Chris Larsen is listed by Ripple as Executive Chairman and a co-founder, and the official XRPL history notes he joined the early project team. This is a public role, not an endorsement.",
      sources: [
        "https://ripple.com/company/leadership/",
        "https://xrpl.org/about/history",
      ],
    },
    {
      aliases: ["jed mccaleb", "mccaleb"],
      a: "Jed McCaleb is one of the three engineers who, according to the official XRP Ledger history, began developing the XRP Ledger in 2011. This is a public historical fact, not an endorsement.",
      sources: ["https://xrpl.org/about/history"],
    },
    {
      aliases: ["arthur britto", "britto"],
      a: "Arthur Britto is one of the three engineers who, according to the official XRP Ledger history, began developing the XRP Ledger in 2011. This is a public historical fact, not an endorsement.",
      sources: ["https://xrpl.org/about/history"],
    },
    {
      aliases: ["monica long"],
      a: "Monica Long is the President of Ripple, according to Ripple’s official leadership page. This is a public role, not an endorsement.",
      sources: ["https://ripple.com/company/leadership/"],
    },
  ];

  const SECURITY_SOURCES = [
    "https://xrpl.org/docs/concepts/accounts/cryptographic-keys",
    "https://xrpl.org/docs/concepts/transactions/secure-signing",
    "https://xrpl.org/docs/concepts/transactions/source-and-destination-tags",
    "https://xrpl-ai.org/faq#custody",
    "https://help.xaman.app/app/getting-started-with-xaman/self-custody-101-staying-safe-with-xaman",
    "https://help.xaman.app/app/learning-more-about-xaman/official-communication-channels",
    "https://help.xaman.app/app/learning-more-about-xaman/ive-lost-my-account-secret",
    "https://help.xaman.app/app/all-about-scams/ive-been-scammed",
  ];

  const RIDDLES = [
    "I settle in a few seconds and I never go mining, yet people still ask when I’ll fly. What am I? (A ledger joke, not a forecast.)",
    "I have a reserve, but I’m not a park, and I have a tag, but I don’t play tag. What am I? (An XRP Ledger account.)",
    "I get burned, but I never start a campfire. What am I? (A transaction fee — it’s destroyed, not paid out.)",
    "I’m public, I don’t nap, and I still won’t name a price. What am I? (The XRP Ledger… and this chat.)",
    "I can lock value for a later date, then I open — or I don’t. What am I? (An escrow. No rockets involved.)",
    "People stare at me for a number, but I only keep a list of trust. What am I? (A validator list, not a price chart.)",
  ];
  let riddleN = 0;

  function normName(s) {
    return String(s || "").toLowerCase().replace(/^@/, "").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function securityLead(q) {
    const n = String(q || "").toLowerCase();
    if (/\blost\b|\bforgot\b/.test(n) && /\b(seed|secret|mnemonic|recovery)\b/.test(n)) {
      return "If a seed or secret is gone, no one can honestly recreate it for you — not Xaman, not Ripple, and not this chat. ";
    }
    if (/\bairdrop|giveaway|verify (?:my |your )?wallet|free xrp\b/.test(n)) {
      return "Treat unexpected airdrops, giveaways, and “verify your wallet” messages as scams. ";
    }
    if (/\bdm|direct messag|fake support|someone (?:dmed|messaged|texted)/.test(n)) {
      return "A support message in your DMs is a warning sign, not a help desk. ";
    }
    return "";
  }

  function securityAnswer(q) {
    const lead = securityLead(q);
    const body =
      "Nobody legitimate will ever ask for your seed or secret key — not support, not an airdrop, and not this chat. Keep that secret offline and never type it into a website or chat. Official Xaman help is only through the Xaman Support xApp inside the app; Xaman does not give support in social-media DMs. Check every URL carefully (Xaman’s official domain is xaman.app). If you use a hardware or card wallet, the key can stay on the device. Before you send, check the destination address and any destination tag. If you already lost a secret, paid “recovery” offers are usually a second scam. I will never ask you to type or send a secret.";
    return pack(lead + body, SECURITY_SOURCES, [], { curated: "security" });
  }

  function memeAnswer() {
    const riddle = RIDDLES[riddleN % RIDDLES.length];
    riddleN += 1;
    const text =
      "Innocent joke: " + riddle +
      " QU1PU doesn’t predict prices or give financial advice. If you’d like something useful, I can explain how payments, escrow, or fees work on the XRP Ledger.";
    return pack(text, ["https://xrpl.org/docs/introduction/what-is-the-xrp-ledger"], [], { curated: "meme", joke: true });
  }

  function findPerson(q) {
    const raw = String(q || "");
    const n = normName(raw);
    for (let i = 0; i < PEOPLE.length; i++) {
      const ppl = PEOPLE[i];
      for (let j = 0; j < ppl.aliases.length; j++) {
        const al = normName(ppl.aliases[j]);
        if (!al) continue;
        if (n === al || n.indexOf(al) !== -1) return ppl;
      }
    }
    return null;
  }

  function isWhoQuestion(q) {
    return /(?:^|\b)(?:who\s+is|who'?s|whos)\b/i.test(String(q || ""));
  }

  function whoToken(q) {
    const m = String(q || "").match(/(?:who\s+is|who'?s|whos)\s+(.+?)[?.!]*$/i);
    return m ? m[1].trim() : "";
  }

  function peopleAnswer(q) {
    const hit = findPerson(q);
    if (hit) return pack(hit.a, hit.sources, [], { curated: "people" });
    if (!isWhoQuestion(q)) return null;
    const token = whoToken(q);
    if (!token) return null;
    const key = token.replace(/^@/, "").trim();
    if (/^(the|a|an|my|your|this|that)\b/i.test(key)) return null;
    if (PROTOCOL_WORDS.test(key) || key.split(/\s+/).length > 4) return null;
    // Looks like a name or handle we don't have.
    if (!/^[A-Za-z0-9_@][A-Za-z0-9_@. -]{1,40}$/.test(token)) return null;
    return pack(
      "I don’t have verified info on that person. Check their official profile and never trust DMs.",
      ["https://help.xaman.app/app/getting-started-with-xaman/self-custody-101-staying-safe-with-xaman"],
      [],
      { curated: "people", unknown: true }
    );
  }

  function curatedAnswer(question) {
    const q = String(question || "").trim();
    if (!q) return null;
    // Safety first is handled by the caller for pasted secrets and injection.
    if (SECURITY_RE.test(q)) return securityAnswer(q);
    if (MEME_RE.test(q)) return memeAnswer();
    const who = peopleAnswer(q);
    if (who) return who;
    return null;
  }

  function answer(question) {
    const q = String(question || "").trim();
    if (!q) return null;
    const faq = window.EscrowFAQ;

    if (faq && typeof faq.answer === "function") {
      const safety = faq.answer(q);
      if (safety && (safety.blocked || safety.injection || safety.hideUser)) {
        return safety;
      }
    }

    const curated = curatedAnswer(q);
    if (curated) return curated;

    if (faq && typeof faq.answer === "function") {
      const safety = faq.answer(q);
      if (safety && (safety.refusal || safety.offTopic)) {
        // Off-topic: if the docs have a real hit, answer from docs instead of only steering.
        if (safety.offTopic && !safety.hideUser && !safety.refusal && index) {
          const docsAns = answerFromDocs(q);
          if (docsAns && !docsAns.weak) return docsAns;
        }
        if (safety.offTopic && safety.a) return safety;
        return safety;
      }
      // Strong curated FAQ (not the generic fallback / wizard redirect)
      if (safety && safety.a && !safety.fallback && !safety.xrplGeneral) {
        const cleaned = cleanGuideTalk(safety.a);
        const docsAns = index ? answerFromDocs(q) : null;
        const keyTerms = expandQuery(q).filter((w) => ["burned","destroyed","burn","amm","lending","credential","credentials","freeze","clawback","domain","batch","permissioned"].indexOf(w) !== -1);
        const faqTok = new Set(toks(cleaned || ""));
        const faqMisses = keyTerms.length && keyTerms.some((w) => !faqTok.has(w));
        if (!cleaned || looksStub(cleaned) || (faqMisses && docsAns && !docsAns.weak)) {
          return docsAns || pack(cleaned || safety.a, faq.sourcesOf ? faq.sourcesOf(safety) : safety.sources, toolLinks(q, cleaned), {});
        }
        const sources = (faq.sourcesOf ? faq.sourcesOf(safety) : (safety.sources || [])).filter(allowedSrc);
        if (docsAns && docsAns.sources && docsAns.sources[0] && sources.indexOf(docsAns.sources[0]) === -1) {
          // Keep the FAQ explanation; add any extra official page that clearly matches.
          sources.push(docsAns.sources[0]);
        }
        return pack(cleaned, sources, toolLinks(q, cleaned) || safety.tools, { id: safety.id });
      }
    }

    if (index) {
      const docsAns = answerFromDocs(q);
      if (docsAns) return docsAns;
    }

    if (faq && typeof faq.steerOffTopic === "function") {
      return { a: faq.steerOffTopic(), offTopic: true, sources: [], tools: [] };
    }
    return pack("I can answer from the official XRP Ledger docs, but I don’t have a close match for that yet and I won’t invent one.", ["https://xrpl.org/docs"], [], {});
  }

  window.Qu1puDocs = { load, answer, bm25, cleanGuideTalk, assetDir, curatedAnswer, PEOPLE, RIDDLES };
})();
