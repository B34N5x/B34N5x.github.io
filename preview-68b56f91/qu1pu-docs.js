(() => {
  "use strict";

  const STOP = new Set("a an the of and to in is it for on or as be by at from that this with are was were been being not no do does did can will would should may might have has had you your we they their its if then than also into over such any all about how what when where why who which than does".split(" "));
  const K1 = 1.5;
  const B = 0.75;
  const ALLOWED_SOURCE = ["https://xrpl.org/", "https://xrpl-ai.org/"];

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

  function answer(question) {
    const q = String(question || "").trim();
    if (!q) return null;
    const faq = window.EscrowFAQ;

    if (faq && typeof faq.answer === "function") {
      const safety = faq.answer(q);
      if (safety && (safety.blocked || safety.injection || safety.refusal || safety.hideUser || safety.offTopic)) {
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

  window.Qu1puDocs = { load, answer, bm25, cleanGuideTalk, assetDir };
})();
