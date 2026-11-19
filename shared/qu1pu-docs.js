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
    [/\btrust\s*lines?\b/i, ["trust", "line", "trustline", "issuer", "token"]],
    [/\bnfts?\b|nftoken|non-?fungible/i, ["nft", "nfts", "nftoken", "nonfungible", "token"]],
    [/\bescrow\b/i, ["escrow", "lock", "finish", "cancel"]],
    [/\b(freeze|clawback)\b/i, ["freeze", "clawback", "xrp", "token", "issuer"]],
    [/\bpayments?\b/i, ["payment", "payments", "transaction"]],
  ];

  const TOOLS = [
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

  function compiledTopics() {
    const list = (window.QU1PU_HUB && window.QU1PU_HUB.topics) || [];
    return list.map((t) => ({
      id: t.id,
      title: t.title,
      queryRe: (t.queryRe || []).map((s) => new RegExp(s, "i")),
      docUrlRe: (t.docUrlRe || []).map((s) => new RegExp(s, "i"))
    }));
  }

  function hubBase() {
    const loc = (typeof location !== "undefined" && location) || null;
    const path = String((loc && loc.pathname) || "");
    const origin = (loc && loc.origin) || "https://b34n5.xyz";
    const m = path.match(/^(.*\/preview-[a-f0-9]+)\//i);
    if (m) return origin + m[1] + "/qu1pu/";
    return origin + "/qu1pu/";
  }

  function hubHref(topicId) {
    const base = hubBase();
    return topicId ? base + "#" + topicId : base;
  }

  function detectTopics(question) {
    const q = String(question || "");
    const hits = [];
    compiledTopics().forEach((t) => {
      if (t.queryRe.some((re) => re.test(q))) hits.push(t.id);
    });
    return hits;
  }

  function detectTopic(question) {
    const hits = detectTopics(question);
    return hits.length ? hits[0] : null;
  }

  function docInTopic(doc, topicId) {
    if (!topicId) return true;
    const t = compiledTopics().find((x) => x.id === topicId);
    if (!t) return true;
    const u = String((doc && doc.u) || "");
    return t.docUrlRe.some((re) => re.test(u));
  }

  function topicById(id) {
    const list = (window.QU1PU_HUB && window.QU1PU_HUB.topics) || [];
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function topicTools(ids) {
    const out = [];
    const seen = {};
    (ids || []).forEach((id) => {
      const t = topicById(id);
      if (!t) return;
      const href = hubHref(id);
      if (seen[href]) return;
      seen[href] = 1;
      out.push({ href: href, label: t.title, hub: true });
    });
    return out;
  }

  function toks(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w && w.length > 1 && !STOP.has(w));
  }

  function expandQuery(question) {
    const q = String(question || "").replace(/\btrustlines?\b/gi, "trust line");
    const bag = new Set(toks(q));
    EXPAND.forEach(([re, words]) => {
      if (re.test(q) || re.test(question || "")) words.forEach((w) => bag.add(w));
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

  const WEAK_TERMS = new Set(("xrp xrpl ledger ripple work works working official docs page use used using make made also into over such any all about how what when where why who which does did can will protocol feature question introduction").split(" "));

  function mainTerms(question) {
    return expandQuery(question).filter((t) => t.length > 2 && !WEAK_TERMS.has(t) && !STOP.has(t));
  }

  function isBasicDefinition(question) {
    return /^(?:what(?:'s| is| are)|how do(?:es)?|define|explain)\b/i.test(String(question || "").trim());
  }

  function hitHasContentWords(doc, terms) {
    if (!terms.length) return true;
    const blob = [doc.t, doc.s, doc.x].join(" ").toLowerCase();
    const dt = new Set(toks(blob));
    return terms.some((t) => dt.has(t) || blob.indexOf(t) !== -1);
  }

  function sentenceHasMainTerms(s, terms) {
    if (!terms.length) return true;
    const st = new Set(toks(s));
    return terms.some((t) => st.has(t));
  }

  function bm25(question, limit, topic) {
    if (!index || !inv) return [];
    const qTokens = expandQuery(question);
    const qSet = new Set(qTokens);
    const raw = String(question || "").toLowerCase();
    const main = mainTerms(question);
    const basic = isBasicDefinition(question);
    const { N, tokenized, df, avgdl } = inv;
    const scored = [];
    for (let i = 0; i < index.docs.length; i++) {
      const doc = index.docs[i];
      if (topic && !docInTopic(doc, topic)) continue;
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
      if (basic && String(doc.u || "").indexOf("https://xrpl.org/docs/concepts/") === 0) score += 3.5;
      if (basic && /xrpl-ai\.org/.test(doc.u || "")) score -= 2.2;
      if (basic && (doc.s || "") === doc.t) score += 1.6;
      scored.push({ score, doc });
    }
    scored.sort((a, b) => b.score - a.score || (b.doc.p || 0) - (a.doc.p || 0));
    const sliced = scored.slice(0, limit || 8);
    if (!main.length) return sliced;
    const filtered = sliced.filter((h) => hitHasContentWords(h.doc, main));
    return filtered.length ? filtered : [];
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
    const main = mainTerms(question);
    const cands = [];
    hits.forEach((h, rank) => {
      const overview = (h.doc.s || "") === h.doc.t;
      const defChunk = overview || rank === 0;
      splitSentences(h.doc.x).forEach((s) => {
        if (isAnaphoric(s)) return;
        if (main.length && !sentenceHasMainTerms(s, main)) return;
        let sc = sentenceScore(s, qTokens) + Math.max(0, 2.4 - rank * 0.3) + (h.doc.p || 0) * 0.2;
        const onTopicDef = isDefinition(s) && sentenceHasMainTerms(s, main.length ? main : qTokens);
        if (onTopicDef) sc += 2.2;
        if (defChunk && onTopicDef) sc += 1.2;
        if (overview) sc += 1.4;
        if (sc >= 1.2) cands.push({ s, sc, url: h.doc.u, title: h.doc.t, def: onTopicDef });
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
    // Fall back only to sentences that still overlap the question's main terms.
    if (!picked.length) {
      hits.forEach((h) => {
        splitSentences(h.doc.x).forEach((s) => {
          if (picked.length >= 4) return;
          if (main.length && !sentenceHasMainTerms(s, main)) return;
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

  function answerFromDocs(question, topic) {
    const hits = bm25(question, 8, topic);
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


  const SECURITY_RE = /\b(?:how (?:can|do|to) (?:i |you )?(?:secure|stay safe|keep (?:my |your )?(?:xrp|wallet|account|funds|keys?) safe|avoid (?:a )?scams?)|secur(?:e|ing) (?:my |your )?(?:xrp|wallet|account|funds|keys?|secret)|(?:avoid|spot|report) (?:a )?scams?|scams?|phish(?:ing)?|airdrops?|giveaways?|fake support|support (?:dm|account)|dmed me|dm'?d me|direct messag|someone (?:dmed|messaged|texted)|lost (?:my )?(?:seed|secret|mnemonic|recovery)|forgot (?:my )?(?:seed|secret)|verify (?:my |your )?wallet|hardware wallet|stay safe|not (?:get )?scammed|(?:is it |is that )?(?:safe|ok|okay|wise) to (?:share|give|send|paste|type)|(?:should i|can i|do i|never)(?: ever)? (?:share|give|send|paste|type)|share (?:my |your |a |the )?(?:seed|secret|mnemonic|recovery)|(?:seed|secret|mnemonic|recovery)(?: phrase| key)?(?: safety| security)?|seed phrase|secret key|private key|recovery phrase)\b/i;
  const LENDING_RE = /\b(?:lending\s+(?:protocol|amendment)s?|lendingprotocol(?:v1[_.]?1)?|xls-?66|(?:what(?:'s| is) (?:the )?(?:xrpl |xrp ledger )?lending))\b/i;
  const CHEEKY_OFFTOPIC_RE = /\b(?:what.?s the weather|write me a poem|tell me a joke|you suck|this is useless|dumb bot|stupid bot|lol bot)\b/i;
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
      "Never share your seed or secret with anyone, including QU1PU. Nobody legitimate will ever ask for your seed or secret key — not support, not an airdrop, and not this chat. Keep that secret offline and never type it into a website or chat. Official Xaman help is only through the Xaman Support xApp inside the app; Xaman does not give support in social-media DMs. Check every URL carefully (Xaman’s official domain is xaman.app). If you use a hardware or card wallet, the key can stay on the device. Before you send, check the destination address and any destination tag. If you already lost a secret, paid “recovery” offers are usually a second scam. I will never ask you to type or send a secret.";
    return pack(lead + body, SECURITY_SOURCES, [], { curated: "security" });
  }

  function lendingAnswer() {
    const text =
      "The LendingProtocol and SingleAssetVault amendments are not enabled on mainnet yet; they are still in validator voting. " +
      "The Lending Protocol is an XRP Ledger DeFi primitive that enables on-chain, fixed-term, uncollateralized loans using pooled funds from a Single Asset Vault. " +
      "Loan brokers create vaults, depositors add assets, and borrowers receive loans on agreed terms. Official detail is in the XRPL docs.";
    return pack(text, [
      "https://xrpl.org/docs/concepts/tokens/lending-protocol",
      "https://xrpl.org/docs/concepts/tokens/single-asset-vaults",
      "https://xrpl.org/resources/known-amendments",
    ], topicTools(["lending", "vault"]), { curated: "lending" });
  }

  function vaultAnswer() {
    const text =
      "The SingleAssetVault amendment is not enabled on mainnet yet; it is still in validator voting. " +
      "A Single Asset Vault is an XRP Ledger primitive that holds one asset and issues shares to depositors. " +
      "Vaults can also supply funds used by the Lending Protocol, which is likewise not enabled on mainnet yet. Official detail is in the XRPL docs.";
    return pack(text, [
      "https://xrpl.org/docs/concepts/tokens/single-asset-vaults",
      "https://xrpl.org/docs/concepts/tokens/lending-protocol",
      "https://xrpl.org/resources/known-amendments",
    ], topicTools(["vault", "lending"]), { curated: "vault" });
  }

  function steerToTopics(ids, currentId) {
    const dest = (ids || []).filter((id) => id && id !== currentId);
    if (!dest.length) return null;
    const names = dest.map((id) => (topicById(id) || {}).title || id);
    const label = names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + ", or " + names[names.length - 1];
    const current = topicById(currentId);
    const cover = current ? current.title : "this topic";
    const text = "I only answer " + cover + " questions in this tile. That looks like a question for " + label + ".";
    return pack(text, [], topicTools(dest), { steered: true, steerTo: dest });
  }

  function listOtherTopics(currentId) {
    const list = (window.QU1PU_HUB && window.QU1PU_HUB.topics) || [];
    return list.filter((t) => t && t.id && t.id !== currentId);
  }

  function joinTopicNames(names) {
    if (!names.length) return "";
    if (names.length === 1) return names[0];
    if (names.length === 2) return names[0] + " or " + names[1];
    return names.slice(0, -1).join(", ") + ", or " + names[names.length - 1];
  }

  function tileOffTopic(scope, question) {
    const hits = detectTopics(question);
    const foreign = hits.filter((id) => id && id !== scope);
    if (foreign.length) {
      const steered = steerToTopics(foreign, scope);
      if (steered) return steered;
    }
    const current = topicById(scope);
    const cover = current ? current.title : "this topic";
    const others = listOtherTopics(scope);
    const names = others.map((t) => t.title);
    let text = "I only answer " + cover + " questions in this tile.";
    if (names.length) {
      text += " For other topics, open " + joinTopicNames(names) + ".";
    }
    return pack(text, [], topicTools(others.map((t) => t.id)), { offTopic: true, tileOffTopic: true });
  }

  function offTopicReply(scope, question) {
    if (scope) return tileOffTopic(scope, question);
    const faq = window.EscrowFAQ;
    if (scope) return offTopicReply(scope, q);
    if (faq && typeof faq.steerOffTopic === "function") {
      return { a: faq.steerOffTopic(), offTopic: true, sources: [], tools: [] };
    }
    return pack("I only cover XRP Ledger and escrow questions here.", [], [], { offTopic: true });
  }

  const VAULT_RE = /\b(?:single\s*asset\s*vaults?|singleassetvault|xls-?65|vault(?:set|deposit|withdraw)s?)\b/i;

  function isSecurityQuestion(q) {
    return SECURITY_RE.test(String(q || ""));
  }

  function isFinanceQuestion(q) {
    const n = String(q || "");
    if (isSecurityQuestion(n)) return false;
    if (/\b(seed|secret|mnemonic|recovery phrase|private key)\b/i.test(n)) return false;
    return /\b(buy|sell|invest(?:ing|ment)?|price|worth)\b/i.test(n);
  }

  const XRPL_VOCAB = new Set(("trust line trustline issuer iou token tokens nft nfts nftoken nonfungible amm escrow reserve reserves payment payments tag memo fee fees lending loan vault vaults borrower broker amendment credential credentials freeze clawback batch domain destination account wallet validator consensus dex offer offers check ticket ripplestate nftoken mint").split(" "));

  function expandsToXrpl(q) {
    return mainTerms(q).concat(expandQuery(q)).some((t) => XRPL_VOCAB.has(t));
  }

  function isCheekyOrRude(q, safety) {
    if (CHEEKY_OFFTOPIC_RE.test(q)) return true;
    if (safety && safety.hideUser) return true;
    return false;
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
    if (isSecurityQuestion(q)) return securityAnswer(q);
    if (MEME_RE.test(q)) return memeAnswer();
    if (VAULT_RE.test(q) && !LENDING_RE.test(q)) return vaultAnswer();
    if (LENDING_RE.test(q) && VAULT_RE.test(q)) return lendingAnswer();
    if (LENDING_RE.test(q)) return lendingAnswer();
    if (VAULT_RE.test(q)) return vaultAnswer();
    const who = peopleAnswer(q);
    if (who) return who;
    return null;
  }

  function mergeTopicTools(ans, question, opts) {
    if (!ans || ans.blocked || ans.injection) return ans;
    const scope = opts && opts.topic;
    const hits = detectTopics(question);
    const add = [];
    if (scope) {
      hits.forEach((id) => { if (id !== scope) add.push(id); });
    } else {
      hits.forEach((id) => add.push(id));
      if (ans.curated === "lending") ["lending", "vault"].forEach((id) => add.push(id));
      if (ans.curated === "vault") ["vault", "lending"].forEach((id) => add.push(id));
    }
    if (!add.length && !scope && /\b(?:set\s*up|setup|create|draft|how to)\b/i.test(question)) {
      const guessed = detectTopic(question);
      if (guessed) add.push(guessed);
    }
    const extra = topicTools(add);
    if (!extra.length) return ans;
    const have = {};
    const tools = (ans.tools || []).slice();
    tools.forEach((t) => { if (t && t.href) have[t.href] = 1; });
    extra.forEach((t) => { if (!have[t.href]) { tools.push(t); have[t.href] = 1; } });
    ans.tools = tools;
    if (!scope && hits.length && ans.a && !/open QU1PU /i.test(ans.a) && !ans.steered) {
      const first = topicById(hits[0]);
      if (first && !ans.curated) {
        ans.a = String(ans.a) + " For a closer look, open " + first.title + ".";
      } else if (first && (ans.curated === "lending" || ans.curated === "vault")) {
        ans.a = String(ans.a) + " Open " + first.title + " on the QU1PU AI page to read more.";
      }
    }
    return ans;
  }

  function answer(question, opts) {
    opts = opts || {};
    const q = String(question || "").trim();
    if (!q) return null;
    const faq = window.EscrowFAQ;
    const scope = opts.topic || null;

    if (faq && typeof faq.answer === "function") {
      const safety = faq.answer(q);
      if (safety && (safety.blocked || safety.injection || safety.hideUser)) {
        return safety;
      }
    }

    const curated = curatedAnswer(q);
    if (curated && curated.curated === "security") return mergeTopicTools(curated, q, opts);
    if (scope && !(curated && (curated.curated === "security" || curated.curated === "meme"))) {
      const hits = detectTopics(q);
      const foreign = hits.filter((id) => id !== scope);
      const onScope = hits.indexOf(scope) !== -1;
      if (foreign.length && !onScope) {
        const steered = steerToTopics(foreign, scope);
        if (steered) return steered;
      }
    }
    if (curated && scope && curated.curated && curated.curated !== scope && curated.curated !== "meme" && curated.curated !== "people" && curated.curated !== "security") {
      const onThis = detectTopics(q).indexOf(scope) !== -1;
      if (!onThis) {
        const steered = steerToTopics([curated.curated], scope);
        if (steered) return steered;
      }
    }
    if (curated) return mergeTopicTools(curated, q, opts);

    if (CHEEKY_OFFTOPIC_RE.test(q)) {
      return offTopicReply(scope, q);
    }

    if (faq && typeof faq.answer === "function") {
      const safety = faq.answer(q);
      if (safety && (safety.refusal || safety.offTopic)) {
        // Rude or cheeky questions always get topic suggestions — never a BM25 override.
        // If FAQ missed a compound XRPL term (e.g. "trustline"), try the docs after expansion.
        if (safety.offTopic) {
          if (isCheekyOrRude(q, safety) || !expandsToXrpl(q)) {
            return offTopicReply(scope, q);
          }
          const docsAns = index ? answerFromDocs(q, scope) : null;
          if (docsAns && !docsAns.weak) return docsAns;
          return offTopicReply(scope, q);
        }
        // Honour finance refusals only for buy/sell/invest/price, not "should I share my seed".
        if (safety.refusal && isFinanceQuestion(q)) return safety;
        if (safety.refusal && !isFinanceQuestion(q)) {
          // fall through to docs
        } else {
          return safety;
        }
      }
      // Strong curated FAQ (not the generic fallback / wizard redirect)
      if (safety && safety.a && !safety.fallback && !safety.xrplGeneral) {
        const cleaned = cleanGuideTalk(safety.a);
        const docsAns = index ? answerFromDocs(q, scope) : null;
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
      const docsAns = answerFromDocs(q, scope);
      if (docsAns) return docsAns;
    }

    if (faq && typeof faq.steerOffTopic === "function") {
      return { a: faq.steerOffTopic(), offTopic: true, sources: [], tools: [] };
    }
    return pack("I can answer from the official XRP Ledger docs, but I don’t have a close match for that yet and I won’t invent one.", ["https://xrpl.org/docs"], [], {});
  }

  const LENDING_CAVEAT = "The LendingProtocol and LendingProtocolV1_1 amendments are not enabled on mainnet yet; they are still in validator voting. ";
  const VAULT_CAVEAT = "The SingleAssetVault amendment is not enabled on mainnet yet; it is still in validator voting. ";

  function ensureTopicCaveat(ans, question, opts) {
    if (!ans || !ans.a || ans.blocked || ans.injection || ans.steered || ans.offTopic || ans.refusal) return ans;
    const scope = (opts && opts.topic) || null;
    const hits = detectTopics(question);
    const aboutLending = scope === "lending" || hits.indexOf("lending") !== -1 || ans.curated === "lending";
    const aboutVault = scope === "vault" || hits.indexOf("vault") !== -1 || ans.curated === "vault";
    if (!aboutLending && !aboutVault) return ans;
    const low = String(ans.a).toLowerCase();
    if (low.indexOf("not enabled on mainnet") !== -1) return ans;
    if (scope === "vault" || (aboutVault && !aboutLending)) ans.a = VAULT_CAVEAT + ans.a;
    else ans.a = LENDING_CAVEAT + ans.a;
    const need = "https://xrpl.org/resources/known-amendments";
    ans.sources = (ans.sources || []).slice();
    if (ans.sources.indexOf(need) === -1) ans.sources.push(need);
    return ans;
  }

  const answerCore = answer;
  function answerPublic(question, opts) {
    opts = opts || {};
    const ans = mergeTopicTools(answerCore(question, opts), question, opts);
    return ensureTopicCaveat(ans, question, opts);
  }

  window.Qu1puDocs = { load, answer: answerPublic, bm25, cleanGuideTalk, assetDir, curatedAnswer, PEOPLE, RIDDLES, expandQuery, mainTerms, detectTopic, detectTopics, docInTopic, hubHref };
})();
