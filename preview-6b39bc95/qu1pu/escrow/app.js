(() => {
  "use strict";

  const CFG = window.ESCROW_ASSISTANT_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RIPPLE_EPOCH = 946684800;
  const STEPS = [
    { id: 0, label: "Deal" },
    { id: 1, label: "Parties" },
    { id: 2, label: "Amount" },
    { id: 3, label: "Timing" },
    { id: 4, label: "Condition" },
    { id: 5, label: "Review" },
    { id: 6, label: "Sign" },
    { id: 7, label: "Track" },
  ];

  let network = CFG.defaultNetwork === "mainnet" ? "mainnet" : "testnet";
  let client = null;
  let reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let step = 0;
  let maxReached = 0;
  let tab = "create";
  let lastCondition = null;
  let typingTimer = null;
  let dirtyFrom = null; // lowest step edited that needs re-validation messaging
  let xamanBusy = false;
  let xamanTimer = null;

  const model = {
    dealText: "",
    account: "",
    destination: "",
    destinationTag: null,
    amountXrp: null,
    amountDrops: null,
    finishAfter: null, // ripple time
    cancelAfter: null,
    finishLocal: null, // ISO for inputs
    cancelLocal: null,
    wantsCondition: false,
    warnings: [],
    parsedNotes: [],
    reviewConfirmed: false,
    amountEntered: "",
    destRequiresTag: null,
    sourceTag: null,
    invoiceId: null,
    memos: [],
  };

  function netCfg() {
    return CFG.networks[network];
  }
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function toRipple(date) {
    return Math.floor(date.getTime() / 1000) - RIPPLE_EPOCH;
  }
  function fromRipple(rt) {
    return new Date((rt + RIPPLE_EPOCH) * 1000);
  }
  function toDatetimeLocalValue(d) {
    if (!d || isNaN(d)) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fmtLocal(d) {
    if (!d || isNaN(d)) return "—";
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) + " (local)";
  }

  /* ---------- presence (DUM-e style particle ring) ---------- */
  const presence = {
    mode: "idle", // idle | think | speak | warn | flash
    canvas: null,
    ctx: null,
    raf: 0,
    t: 0,
    mx: 0.5,
    my: 0.5,
    speakAmp: 0,
    flash: 0,
    particles: [],
  };

  function initPresence() {
    presence.canvas = $("#presence");
    if (!presence.canvas) return;
    presence.ctx = presence.canvas.getContext("2d");
    const n = window.innerWidth < 920 ? 48 : 72;
    presence.particles = Array.from({ length: n }, (_, i) => ({
      a: (i / n) * Math.PI * 2,
      r: 0.28 + Math.random() * 0.08,
      s: 0.4 + Math.random() * 0.8,
      z: Math.random(),
    }));
    presence.canvas.addEventListener("pointermove", (e) => {
      const rect = presence.canvas.getBoundingClientRect();
      presence.mx = (e.clientX - rect.left) / rect.width;
      presence.my = (e.clientY - rect.top) / rect.height;
    });
    loopPresence();
  }

  function setPresence(mode, opts = {}) {
    presence.mode = mode;
    if (mode === "flash") presence.flash = 1;
    if (mode === "speak") presence.speakAmp = Math.min(1, (presence.speakAmp || 0) + (opts.boost || 0.35));
    if (mode === "warn") presence.flash = 0.6;
    const lab = $("#presence-label");
    if (lab) lab.textContent = mode;
  }

  function loopPresence() {
    cancelAnimationFrame(presence.raf);
    drawPresence();
    if (!reduce) presence.raf = requestAnimationFrame(loopPresence);
  }

  function drawPresence() {
    const c = presence.canvas,
      ctx = presence.ctx;
    if (!c || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth,
      h = c.clientHeight;
    if (c.width !== Math.floor(w * dpr) || c.height !== Math.floor(h * dpr)) {
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    presence.t += reduce ? 0 : 0.016;
    presence.speakAmp *= 0.92;
    presence.flash *= 0.9;

    const cx = w * (0.5 + (presence.mx - 0.5) * 0.08);
    const cy = h * (0.5 + (presence.my - 0.5) * 0.08);
    const base = Math.min(w, h) * 0.34;
    const breath = reduce ? 0 : Math.sin(presence.t * 1.6) * 0.03;
    const think = presence.mode === "think" && !reduce ? presence.t * 2.2 : presence.t * 0.35;
    const speak = presence.speakAmp * (reduce ? 0 : 1);
    const warn = presence.mode === "warn";
    const col = warn ? [255, 210, 122] : [61, 245, 143];
    const col2 = warn ? [255, 160, 80] : [46, 230, 208];

    // digital rain streaks inside orb
    if (!reduce) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, base * (1.05 + breath), 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "rgba(7,9,11,0.35)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = `rgba(${col2.join(",")},0.35)`;
      ctx.font = "10px monospace";
      for (let i = 0; i < 18; i++) {
        const x = ((i * 37 + presence.t * 40) % (w + 20)) - 10;
        const y = ((i * 53 + presence.t * 90 * (0.5 + speak)) % (h + 40)) - 20;
        ctx.fillText("01XRPL"[i % 6], x, y);
      }
      ctx.restore();
    }

    // frequency waves
    const waves = presence.mode === "think" ? 4 : 3;
    for (let i = 0; i < waves; i++) {
      const phase = presence.t * (1.2 + i * 0.2) + i;
      const rad = base * (0.75 + i * 0.18 + breath + speak * 0.12 + Math.sin(phase) * 0.02);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${col.join(",")},${0.18 - i * 0.04 + speak * 0.15 + presence.flash * 0.2})`;
      ctx.lineWidth = 1.5;
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
    }

    // particle ring
    for (const p of presence.particles) {
      const a = p.a + think * (0.4 + p.s * 0.3) * (presence.mode === "think" ? 1.8 : 1);
      const wobble = Math.sin(presence.t * 3 * p.s + p.a) * (0.02 + speak * 0.05);
      const rr = base * (p.r + breath + wobble + speak * 0.06);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr * 0.92;
      const size = 1.4 + p.z * 2 + speak * 1.5;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${(p.z > 0.5 ? col : col2).join(",")},${0.45 + p.z * 0.5})`;
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // core
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 0.45);
    g.addColorStop(0, `rgba(${col.join(",")},${0.35 + speak * 0.35 + presence.flash * 0.4})`);
    g.addColorStop(1, "rgba(7,9,11,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, base * (0.42 + breath + speak * 0.08), 0, Math.PI * 2);
    ctx.fill();

    if (reduce) {
      // static calm ring
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${col.join(",")},0.55)`;
      ctx.lineWidth = 2;
      ctx.arc(cx, cy, base * 0.85, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /* ---------- rain bg ---------- */
  const rain = $("#rain");
  let rainId = 0;
  function startRain() {
    if (!rain || reduce) return;
    const ctx = rain.getContext("2d");
    let w, h, cols, drops;
    const step = window.innerWidth < 720 ? 22 : 16;
    function resize() {
      w = rain.width = window.innerWidth;
      h = rain.height = window.innerHeight;
      cols = Math.floor(w / step);
      drops = Array.from({ length: cols }, () => Math.random() * h);
    }
    resize();
    function frame() {
      if (reduce) return;
      ctx.fillStyle = "rgba(7,9,11,0.1)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(61,245,143,0.35)";
      ctx.font = "12px monospace";
      for (let i = 0; i < drops.length; i++) {
        ctx.fillText("01XRPL#"[i % 7], i * step, drops[i] * step);
        if (drops[i] * step > h && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      rainId = requestAnimationFrame(frame);
    }
    cancelAnimationFrame(rainId);
    rainId = requestAnimationFrame(frame);
  }

  function applyMotion() {
    document.body.classList.toggle("reduce-motion", reduce);
    $("#motion-toggle").textContent = reduce ? "Motion on" : "Reduce motion";
    $("#motion-toggle").setAttribute("aria-pressed", String(reduce));
    if (reduce) {
      cancelAnimationFrame(rainId);
      cancelAnimationFrame(presence.raf);
      drawPresence();
    } else {
      startRain();
      loopPresence();
    }
  }

  /* ---------- chat ---------- */
  function safeChatText(text) {
    const parser = window.EscrowParser;
    const s = String(text || "");
    if (parser?.looksLikeSecret?.(s)) return parser.redactSecrets(s);
    return parser?.redactSecrets ? parser.redactSecrets(s) : s;
  }

  function bubble(role, htmlOrText) {
    const log = $("#chat-log");
    const div = document.createElement("div");
    div.className = "bubble " + role;
    const body = safeChatText(htmlOrText);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = role === "user" ? "you" : "QU1PU";
    const span = document.createElement("div");
    span.textContent = body;
    div.appendChild(meta);
    div.appendChild(span);
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  const ALLOWED_LINK_HOSTS = {
    "https://b34n5.xyz/explainer/": 1,
    "https://b34n5.xyz/explainer/try/": 1,
    "https://b34n5.xyz/tracer/": 1,
    "https://b34n5.xyz/checker/": 1,
    "https://b34n5.xyz/checker/batch/": 1,
    "https://b34n5.xyz/family-vault/": 1,
    "https://b34n5.xyz/TheLobby/": 1,
    "https://b34n5.xyz/tools/": 1,
    "https://xrpl-will.pages.dev/": 1,
    "https://xrpl-will.pages.dev": 1,
  };

  function previewHubBase() {
    const path = String(location.pathname || "");
    const m = path.match(/^(.*\/preview-[a-f0-9]+)\//i);
    if (!m) return "";
    return location.origin + m[1] + "/qu1pu/";
  }

  function isAllowedHref(href) {
    const u = String(href || "");
    if (!u) return false;
    const hub = previewHubBase();
    if (hub) {
      try {
        const url = new URL(u, location.href);
        const base = new URL(hub, location.href);
        if (url.origin === base.origin && url.pathname.replace(/\/?$/, "/") === base.pathname.replace(/\/?$/, "/")) return true;
      } catch (_) {}
    }
    if (/preview-/i.test(u)) return false;
    if (ALLOWED_LINK_HOSTS[u] || ALLOWED_LINK_HOSTS[u.replace(/#.*$/, "")]) return true;
    if (u.startsWith("https://xrpl.org/") || u.startsWith("https://xrpl-ai.org/") || u.startsWith("https://help.xaman.app/") || u.startsWith("https://ripple.com/") || u.startsWith("https://www.xrpl.foundation/")) return true;
    return false;
  }

  function appendSafeLinks(div, links, heading) {
    if (!div || !links || !links.length) return;
    const wrap = document.createElement("div");
    wrap.className = "faq-links tiny";
    if (heading) {
      const lab = document.createElement("span");
      lab.className = "dim";
      lab.textContent = heading + " ";
      wrap.appendChild(lab);
    }
    links.forEach((lnk, i) => {
      if (!isAllowedHref(lnk.href)) return;
      if (i) wrap.appendChild(document.createTextNode(" · "));
      const a = document.createElement("a");
      a.href = lnk.href;
      a.rel = "noopener";
      a.target = "_blank";
      a.textContent = lnk.label || lnk.href;
      wrap.appendChild(a);
    });
    if (wrap.querySelector("a")) div.appendChild(wrap);
  }

  function assistantSay(text, { warn = false, sources = [], tools = [] } = {}) {
    return new Promise((resolve) => {
      clearTimeout(typingTimer);
      const log = $("#chat-log");
      const typing = document.createElement("div");
      typing.className = "bubble bot typing";
      typing.innerHTML = `<div class="meta">QU1PU</div><span class="dots"><span></span><span></span><span></span></span>`;
      log.appendChild(typing);
      log.scrollTop = log.scrollHeight;
      setPresence(warn ? "warn" : "think");

      const finish = (div) => {
        const srcLinks = (sources || []).filter(isAllowedHref).map((href) => ({ href, label: href }));
        const toolLinks = (tools || []).filter((l) => isAllowedHref(l && l.href));
        appendSafeLinks(div, srcLinks, "Source:");
        const toolHeading = toolLinks.some((l) => /\/qu1pu\/?#/.test((l && l.href) || "")) ? "Open topic:" : "Optional tool:";
        appendSafeLinks(div, toolLinks, toolHeading);
        setPresence(warn ? "warn" : "idle");
        resolve();
      };

      const delay = reduce ? 80 : 450 + Math.min(900, text.length * 8);
      typingTimer = setTimeout(() => {
        typing.remove();
        const div = bubble("bot", "");
        const body = document.createElement("span");
        div.appendChild(body);
        if (reduce) {
          body.textContent = text;
          finish(div);
          return;
        }
        setPresence("speak");
        let i = 0;
        const tick = () => {
          i++;
          body.textContent = text.slice(0, i);
          if (i % 2 === 0) setPresence("speak", { boost: 0.5 });
          log.scrollTop = log.scrollHeight;
          if (i < text.length) requestAnimationFrame(tick);
          else finish(div);
        };
        tick();
      }, delay);
    });
  }

  function interruptSpeech() {
    clearTimeout(typingTimer);
    $$(".bubble.typing").forEach((el) => el.remove());
    // leave last partial bubble as-is
  }

  /* ---------- guided demo (cutscene) ---------- */
  const DEMO_EXAMPLE = {
    account: "rh3oFni4dC3ZExgy4PqkZyAH5ukGb43axk",
    destination: "r3ETavejSADPb2uiWvRDiUGi6GE71sDbj9",
    amountXrp: 10,
    amountDrops: "10000000",
    createHash: "77FCB5F6C2252C1914119B8973C49A9670A0798109DB71A08F6858FEF18D908E",
    finishHash: "177E74F6673BE8939BFD7C6CF5C0A2D95A2A8F40612F82AE866D83949D6B1E0D",
    sequence: 22188846,
    deal:
      "EXAMPLE (testnet practice): Lock 10 XRP for r3ETavejSADPb2uiWvRDiUGi6GE71sDbj9. Claimable after 1 hour. Cancel if not claimed within 1 day.",
  };

  const DEMO_LINES = [
    "Step 1 — Deal. Type the escrow in plain English. This box is filled with example testnet data so you can see the flow.",
    "Step 2 — Parties. Source locks the XRP. Destination receives it when the escrow finishes.",
    "Step 3 — Amount. How much XRP to lock. The ledger stores drops: 1 XRP = 1,000,000 drops.",
    "Step 4 — Timing. FinishAfter is when it can be claimed. CancelAfter is the safety expiry.",
    "Step 5 — Condition. Optional secret code. This example is time-only — no condition.",
    "Step 6 — Review. Check every field. Tap a card to flip a short explanation.",
    "Step 7 — Sign. Here is the draft JSON. We do not sign or open Xaman in this walkthrough. Explorer links below are an example testnet result.",
    "Step 8 — Track. Look up open escrows on an address. Example explorer links point at a past practice run.",
  ];

  const demo = {
    active: false,
    index: 0,
    snapshot: null,
    advancing: false,
  };

  function demoCaption(text) {
    const el = $("#cutscene-caption");
    if (el) el.textContent = text;
  }

  function clearDemoHighlight() {
    $$(".demo-hl").forEach((el) => el.classList.remove("demo-hl"));
  }

  function highlight(sel) {
    clearDemoHighlight();
    const el = typeof sel === "string" ? $(sel) : sel;
    if (el) {
      el.classList.add("demo-hl");
      try {
        el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
      } catch (_) {}
    }
  }

  function snapshotState() {
    return {
      step,
      maxReached,
      tab,
      network,
      lastCondition: lastCondition ? { ...lastCondition } : null,
      dirtyFrom,
      model: JSON.parse(JSON.stringify(model)),
      dealText: $("#deal-input")?.value || "",
      fieldAccount: $("#field-account")?.value || "",
      fieldDestination: $("#field-destination")?.value || "",
      fieldDestTag: $("#field-dest-tag")?.value || "",
      fieldAmount: $("#field-amount")?.value || "",
      fieldFinish: $("#field-finish")?.value || "",
      fieldCancel: $("#field-cancel")?.value || "",
      fieldWantCond: !!$("#field-want-cond")?.checked,
      conditionBoxHidden: $("#condition-box")?.hidden !== false,
      fulfillmentJson: $("#fulfillment-json")?.textContent || "",
      lookupAddr: $("#lookup-addr")?.value || "",
      lookupOut: $("#lookup-out")?.textContent || "[]",
      demoLog: $("#demo-log")?.textContent || "Waiting…",
      txJson: $("#tx-json")?.textContent || "{}",
      chatHTML: $("#chat-log")?.innerHTML || "",
      warnHTML: $("#warn-list")?.innerHTML || "",
      fieldGridHTML: $("#field-grid")?.innerHTML || "",
    };
  }

  function restoreState(snap) {
    if (!snap) return;
    interruptSpeech();
    clearDemoHighlight();
    Object.keys(model).forEach((k) => delete model[k]);
    Object.assign(model, snap.model);
    lastCondition = snap.lastCondition;
    dirtyFrom = snap.dirtyFrom;
    tab = snap.tab;
    maxReached = snap.maxReached;
    network = snap.network;
    setNetwork(network, { force: true });
    $("#deal-input").value = snap.dealText;
    $("#field-account").value = snap.fieldAccount;
    $("#field-destination").value = snap.fieldDestination;
    $("#field-dest-tag").value = snap.fieldDestTag;
    $("#field-amount").value = snap.fieldAmount;
    $("#field-finish").value = snap.fieldFinish;
    $("#field-cancel").value = snap.fieldCancel;
    $("#field-want-cond").checked = snap.fieldWantCond;
    $("#condition-box").hidden = snap.conditionBoxHidden;
    $("#fulfillment-json").textContent = snap.fulfillmentJson;
    $("#lookup-addr").value = snap.lookupAddr;
    $("#lookup-out").textContent = snap.lookupOut;
    $("#demo-log").textContent = snap.demoLog;
    $("#tx-json").textContent = snap.txJson;
    $("#chat-log").innerHTML = snap.chatHTML;
    $("#warn-list").innerHTML = snap.warnHTML;
    $("#field-grid").innerHTML = snap.fieldGridHTML;
    // re-bind flip cards if any
    $$("#field-grid .flip-card").forEach((btn) => {
      btn.addEventListener("click", () => btn.classList.toggle("flipped"));
    });
    updateDropsLabel();
    updateTimeline();
    $$(".step").forEach((el) => {
      el.hidden = Number(el.dataset.step) !== snap.step;
    });
    step = snap.step;
    renderRail();
    $("#btn-back").disabled = snap.step === 0;
    $("#btn-next").textContent = snap.step === 7 ? "Done" : snap.step === 5 ? "Looks good" : "Next";
    if (snap.step === 6) showTab();
    setPresence("idle");
  }

  function applyDemoExampleToModel() {
    const now = new Date();
    const finish = new Date(now.getTime() + 60 * 60 * 1000);
    const cancel = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    model.dealText = DEMO_EXAMPLE.deal;
    model.account = DEMO_EXAMPLE.account;
    model.destination = DEMO_EXAMPLE.destination;
    model.destinationTag = null;
    model.amountXrp = DEMO_EXAMPLE.amountXrp;
    model.amountDrops = DEMO_EXAMPLE.amountDrops;
    model.finishLocal = finish.toISOString();
    model.cancelLocal = cancel.toISOString();
    model.finishAfter = toRipple(finish);
    model.cancelAfter = toRipple(cancel);
    model.wantsCondition = false;
    model.warnings = [];
    model.parsedNotes = ["example testnet data"];
    model.amountEntered = String(DEMO_EXAMPLE.amountXrp);
    model.destRequiresTag = null;
    model.reviewConfirmed = false;
    lastCondition = null;
    $("#deal-input").value = DEMO_EXAMPLE.deal;
    $("#field-account").value = DEMO_EXAMPLE.account;
    $("#field-destination").value = DEMO_EXAMPLE.destination;
    $("#field-dest-tag").value = "";
    $("#field-amount").value = String(DEMO_EXAMPLE.amountXrp);
    $("#field-finish").value = toDatetimeLocalValue(finish);
    $("#field-cancel").value = toDatetimeLocalValue(cancel);
    $("#field-want-cond").checked = false;
    $("#condition-box").hidden = true;
    $("#lookup-addr").value = DEMO_EXAMPLE.account;
    updateDropsLabel();
    updateTimeline();
  }

  function setDemoExamplePanels(show) {
    const a = $("#demo-example-sign");
    const b = $("#demo-example-track");
    if (a) a.hidden = !show || demo.index !== 6;
    if (b) b.hidden = !show || demo.index !== 7;
  }

  async function runDemoBeat(i) {
    if (!demo.active) return;
    demo.index = i;
    interruptSpeech();
    clearDemoHighlight();
    demoCaption(`Demo ${i + 1}/8`);
    $("#cut-back").disabled = i === 0;
    $("#cut-next").textContent = i >= 7 ? "Done" : "Next";

    applyDemoExampleToModel();
    maxReached = Math.max(maxReached, 7);
    await goStep(i, { force: true, skipIntro: true });
    syncStepFields();

    const targets = [
      "#deal-input",
      "#field-destination",
      "#field-amount",
      "#field-finish",
      "#field-want-cond",
      "#field-grid",
      "#tx-json",
      "#lookup-addr",
    ];
    if (i === 5) renderReview();
    if (i === 6) {
      showTab();
      $("#lookup-out").textContent = JSON.stringify(
        {
          note: "example testnet result — not live",
          createHash: DEMO_EXAMPLE.createHash,
          finishHash: DEMO_EXAMPLE.finishHash,
          sequence: DEMO_EXAMPLE.sequence,
        },
        null,
        2
      );
    }
    if (i === 7) {
      $("#lookup-out").textContent = JSON.stringify(
        [
          {
            note: "example shape only — escrow already finished in the practice run",
            LedgerEntryType: "Escrow",
            Account: DEMO_EXAMPLE.account,
            Destination: DEMO_EXAMPLE.destination,
            Amount: DEMO_EXAMPLE.amountDrops,
            PreviousTxnID: DEMO_EXAMPLE.createHash,
          },
        ],
        null,
        2
      );
    }
    setDemoExamplePanels(true);
    highlight(targets[i]);
    setPresence("speak");
    await assistantSay(DEMO_LINES[i]);
    if (!demo.active) return;
    setPresence("idle");
    demoCaption(`Demo ${i + 1}/8 · ← Back · → Next · Esc Skip`);
  }

  async function startDemo() {
    if (demo.active || demo.advancing) return;
    demo.advancing = true;
    try {
      demo.snapshot = snapshotState();
      demo.active = true;
      demo.index = 0;
      document.body.classList.add("demo-mode");
      $("#cutscene-bar").hidden = false;
      const hint = $("#demo-hint");
      if (hint) hint.hidden = true;
      try {
        localStorage.setItem("qu1pu-demo-hint-seen", "1");
      } catch (_) {}
      // stay on testnet only
      setNetwork("testnet", { force: true });
      bubble("bot", "Starting the guided demo with example testnet data. Nothing is signed.");
      await runDemoBeat(0);
    } finally {
      demo.advancing = false;
    }
  }

  async function demoNext() {
    if (!demo.active || demo.advancing) return;
    demo.advancing = true;
    try {
      if (demo.index >= 7) {
        await endDemo({ finished: true });
        return;
      }
      await runDemoBeat(demo.index + 1);
    } finally {
      demo.advancing = false;
    }
  }

  async function demoBack() {
    if (!demo.active || demo.advancing) return;
    if (demo.index <= 0) return;
    demo.advancing = true;
    try {
      await runDemoBeat(demo.index - 1);
    } finally {
      demo.advancing = false;
    }
  }

  async function endDemo({ finished = false } = {}) {
    if (!demo.active) return;
    interruptSpeech();
    clearDemoHighlight();
    setDemoExamplePanels(false);
    const snap = demo.snapshot;
    demo.active = false;
    demo.snapshot = null;
    document.body.classList.remove("demo-mode");
    $("#cutscene-bar").hidden = true;
    demoCaption("Demo");
    restoreState(snap);
    await assistantSay(
      finished
        ? "Demo complete. Your own draft is restored — nothing was signed."
        : "Demo skipped. Your own draft is restored untouched."
    );
  }

  function maybeShowDemoHint() {
    const hint = $("#demo-hint");
    if (!hint) return;
    try {
      if (localStorage.getItem("qu1pu-demo-hint-seen") === "1") {
        hint.hidden = true;
        return;
      }
    } catch (_) {}
    hint.hidden = false;
  }

  /* ---------- network ---------- */
  function setNetwork(next, { force = false } = {}) {
    if (next === "mainnet" && !force) {
      if (!confirm("Switch to MAINNET?\n\nReal XRP can lock forever if CancelAfter/condition are wrong.\n\nContinue?")) return;
    }
    network = next;
    $("#net-badge").textContent = network.toUpperCase();
    $("#net-badge").classList.toggle("danger", network === "mainnet");
    $("#net-badge").classList.toggle("warn", network === "testnet");
    const demo = $("#demo-btn");
    if (demo) demo.disabled = network !== "testnet";
    if (client) {
      try {
        client.disconnect();
      } catch (_) {}
      client = null;
    }
  }

  async function ensureClient() {
    if (client && client.isConnected()) return client;
    const xrpl = window.xrpl;
    const primary = netCfg().ws;
    const urls =
      network === "testnet"
        ? [...new Set([primary, "wss://testnet.xrpl-labs.com", "wss://s.altnet.rippletest.net:51233"])]
        : [...new Set([primary, "wss://xrplcluster.com", "wss://s1.ripple.com"])];
    let lastErr;
    for (const u of urls) {
      try {
        const c = new xrpl.Client(u);
        await c.connect();
        client = c;
        return client;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("No WebSocket");
  }

  /* ---------- rail + steps ---------- */
  function renderRail() {
    const rail = $("#progress-rail");
    rail.innerHTML = "";
    STEPS.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = `<span class="n">${s.id + 1}</span>${s.label}`;
      b.setAttribute("aria-current", s.id === step ? "step" : "false");
      if (s.id === step) b.classList.add("current");
      if (s.id <= maxReached) b.classList.add("done");
      b.disabled = s.id > maxReached;
      b.addEventListener("click", () => {
        if (s.id <= maxReached) goStep(s.id, { viaRail: true });
      });
      rail.appendChild(b);
    });
  }

  function markDirty(fromStep) {
    dirtyFrom = dirtyFrom == null ? fromStep : Math.min(dirtyFrom, fromStep);
    if (fromStep <= 5) {
      model.reviewConfirmed = false;
      const box = $("#review-confirm");
      if (box) box.checked = false;
      syncReviewGateNote();
    }
  }

  function syncReviewGateNote() {
    const note = $("#review-gate-note");
    if (!note) return;
    note.textContent = model.reviewConfirmed
      ? "Summary confirmed. You can continue to Sign — you will sign in Xaman yourself."
      : "Confirm above to continue to Sign. Nothing is sent until you sign in Xaman.";
    syncXamanButton();
  }

  function clearReviewConfirm() {
    model.reviewConfirmed = false;
    const box = $("#review-confirm");
    if (box) box.checked = false;
    syncReviewGateNote();
  }

  async function goStep(n, { viaRail = false, skipIntro = false, force = false } = {}) {
    if (n < 0 || n > 7) return;
    if (!force && n > step) {
      const ok = await validateLeaving(step);
      if (!ok) return;
    }
    const prev = step;
    const panel = $("#step-panel");
    const curEl = $(`.step[data-step="${prev}"]`);
    if (curEl && !reduce) {
      curEl.classList.add("out");
      await new Promise((r) => setTimeout(r, 220));
      curEl.classList.remove("out");
    }
    $$(".step").forEach((el) => {
      el.hidden = Number(el.dataset.step) !== n;
    });
    step = n;
    maxReached = Math.max(maxReached, n);
    renderRail();
    $("#btn-back").disabled = n === 0;
    $("#btn-next").textContent = n === 7 ? "Done" : n === 5 ? "Looks good" : "Next";
    setPresence("flash");
    syncStepFields();
    if (n === 5) renderReview();
    if (n === 6) { showTab(); syncXamanButton(); }
    if (!skipIntro) {
      if (viaRail && dirtyFrom != null && dirtyFrom < n) {
        await assistantSay(`Jumped to step ${n + 1}. You changed something earlier — I’ll re-check from there when you hit Next.`);
      } else if (n !== prev) {
        await stepIntro(n);
      }
    }
    if (dirtyFrom != null && n > dirtyFrom) {
      await revalidateCascade(dirtyFrom, n);
      dirtyFrom = null;
    }
  }

  async function stepIntro(n) {
    const lines = [
      "Tell me the deal in plain English. Samples are fine — I’ll parse amount, parties, and times.",
      "Confirm who locks funds (source) and who can receive them (destination). I’ll check destination tags if the account requires one.",
      "Set how much XRP to lock. Shown as drops in the transaction (1 XRP = 1,000,000 drops).",
      "Pick FinishAfter and CancelAfter. Without CancelAfter, a time escrow may never be cancellable.",
      "Optional secret code (PREIMAGE-SHA-256). Only enable if you can safely store the fulfillment.",
      "Read the plain-word summary, check memos and tags, then confirm you will sign in Xaman yourself. We will never ask for your seed.",
      "Confirm the review, then sign in Xaman yourself. You can also copy the transaction JSON. QU1PU never asks for your seed and never signs for you.",
      "Look up open escrows on an address (read-only). Finish/Cancel skeletons are on Sign.",
    ];
    await assistantSay(lines[n] || "Continue when ready.");
  }

  function syncStepFields() {
    $("#field-account").value = model.account || "";
    $("#field-destination").value = model.destination || "";
    $("#field-dest-tag").value = model.destinationTag != null ? String(model.destinationTag) : "";
    $("#field-amount").value = model.amountXrp != null ? String(model.amountXrp) : "";
    updateDropsLabel();
    $("#field-finish").value = model.finishLocal ? toDatetimeLocalValue(new Date(model.finishLocal)) : "";
    $("#field-cancel").value = model.cancelLocal ? toDatetimeLocalValue(new Date(model.cancelLocal)) : "";
    $("#field-want-cond").checked = !!model.wantsCondition;
    updateTimeline();
    if (model.account) $("#lookup-addr").value = model.account;
  }

  function updateDropsLabel() {
    const el = $("#amount-drops");
    if (!el) return;
    if (model.amountDrops) el.textContent = model.amountDrops + " drops";
    else el.textContent = "— drops";
  }

  function updateTimeline() {
    const fill = $("#tl-fill");
    $("#tl-finish").textContent = "FinishAfter: " + (model.finishLocal ? fmtLocal(new Date(model.finishLocal)) : "—");
    $("#tl-cancel").textContent = "CancelAfter: " + (model.cancelLocal ? fmtLocal(new Date(model.cancelLocal)) : "—");
    if (fill) fill.style.width = model.cancelAfter ? "100%" : model.finishAfter ? "70%" : "0%";
  }

  async function validateLeaving(from) {
    if (from === 0) return parseDealStep();
    if (from === 1) return validateParties();
    if (from === 2) return validateAmount();
    if (from === 3) return validateTiming();
    if (from === 4) return ensureCondition();
    if (from === 5) {
      renderReview();
      if (!model.reviewConfirmed) {
        setPresence("warn");
        await assistantSay("Please read the plain-word summary and confirm that you will sign in Xaman yourself.", { warn: true });
        return false;
      }
      return true;
    }
    return true;
  }

  async function revalidateCascade(from, to) {
    const bits = [];
    if (from <= 1 && to >= 1) bits.push("parties");
    if (from <= 2 && to >= 2) bits.push("amount");
    if (from <= 3 && to >= 3) bits.push("timing");
    if (from <= 4 && to >= 4) bits.push("condition");
    await assistantSay(`Because you edited an earlier step, I re-checked: ${bits.join(", ") || "downstream fields"}.`);
    if (to >= 5) renderReview();
    if (to >= 6) showTab();
  }

  async function parseDealStep() {
    const text = $("#deal-input").value.trim();
    if (!text) {
      setPresence("warn");
      await assistantSay("Type a deal first (or load a sample).", { warn: true });
      return false;
    }
    if (window.EscrowParser?.looksLikeSecret?.(text)) {
      $("#deal-input").value = "";
      model.dealText = "";
      setPresence("warn");
      await assistantSay("That looks like a seed or secret key. We will never ask for your seed. It was cleared and not stored or sent.", { warn: true });
      return false;
    }
    model.dealText = text;
    bubble("user", text);
    const parsed = window.EscrowParser.parseDeal(text);
    if (parsed.seedBlocked || parsed.refusal) {
      if (parsed.seedBlocked) {
        $("#deal-input").value = "";
        model.dealText = "";
      }
      setPresence("warn");
      await assistantSay(parsed.error, { warn: true });
      return false;
    }
    if (!parsed.ok) {
      setPresence("warn");
      await assistantSay(parsed.error || "Could not parse that.", { warn: true });
      return false;
    }
    const d = parsed.draft;
    model.destination = d.Destination || model.destination || "";
    model.destinationTag = d.DestinationTag != null ? d.DestinationTag : model.destinationTag;
    model.amountXrp = d.amountXrp;
    model.amountEntered = d.amountXrp != null ? String(d.amountXrp) : "";
    model.amountDrops = d.Amount;
    model.finishAfter = d.FinishAfter ?? null;
    model.cancelAfter = d.CancelAfter ?? null;
    model.finishLocal = d.finishAfterDate;
    model.cancelLocal = d.cancelAfterDate;
    model.wantsCondition = !!d.wantsCondition;
    model.warnings = parsed.warnings || [];
    model.parsedNotes = parsed.notes || [];
    await assistantSay(
      `Got it — ${model.amountXrp} XRP` +
        (model.destination ? ` to ${model.destination}` : " (add destination next)") +
        `. Let’s confirm parties.`
    );
    return true;
  }

  async function validateParties() {
    const xrpl = window.xrpl;
    model.account = $("#field-account").value.trim();
    model.destination = $("#field-destination").value.trim();
    const tagRaw = $("#field-dest-tag").value.trim();
    model.destinationTag = tagRaw === "" ? null : Number(tagRaw);
    if (model.destinationTag != null && !Number.isFinite(model.destinationTag)) {
      await assistantSay("Destination tag must be a number.", { warn: true });
      setPresence("warn");
      return false;
    }
    if (model.account && !xrpl.isValidClassicAddress(model.account)) {
      await assistantSay("Source address failed checksum.", { warn: true });
      setPresence("warn");
      return false;
    }
    if (!model.destination || !xrpl.isValidClassicAddress(model.destination)) {
      await assistantSay("Destination needs a valid classic r… address.", { warn: true });
      setPresence("warn");
      return false;
    }
    if (model.account && model.account === model.destination) {
      model.warnings.push("Source and destination are the same.");
      await assistantSay("Heads up: source equals destination.", { warn: true });
      setPresence("warn");
    }
    try {
      const c = await ensureClient();
      const info = await c.request({ command: "account_info", account: model.destination, ledger_index: "validated" });
      const flags = info.result.account_data.Flags || 0;
      if (flags & 0x00020000) {
        model.destRequiresTag = true;
        if (model.destinationTag == null) {
          await assistantSay("That destination requires a DestinationTag (asfRequireDest).", { warn: true });
          setPresence("warn");
          $("#parties-note").textContent = "Destination requires a tag.";
          return false;
        }
        $("#parties-note").textContent = "Destination requires a tag — provided.";
      } else {
        model.destRequiresTag = false;
        $("#parties-note").textContent = "Destination does not require a tag.";
      }
    } catch (e) {
      model.destRequiresTag = null;
      $("#parties-note").textContent = "Could not fetch account_info (unfunded/offline) — continue carefully.";
      await assistantSay("I couldn’t read destination flags online. You can continue, but double-check the tag.");
    }
    return true;
  }

  async function validateAmount() {
    const raw = $("#field-amount").value.trim();
    const xrp = Number(raw);
    if (!(xrp > 0) || xrp > 1e9) {
      await assistantSay("Enter a positive XRP amount.", { warn: true });
      setPresence("warn");
      return false;
    }
    model.amountXrp = xrp;
    model.amountDrops = String(BigInt(Math.round(xrp * 1e6)));
    updateDropsLabel();
    return true;
  }

  async function validateTiming() {
    const fin = $("#field-finish").value;
    const can = $("#field-cancel").value;
    model.finishLocal = fin ? new Date(fin).toISOString() : null;
    model.cancelLocal = can ? new Date(can).toISOString() : null;
    model.finishAfter = fin ? toRipple(new Date(fin)) : null;
    model.cancelAfter = can ? toRipple(new Date(can)) : null;
    updateTimeline();
    if (!model.finishAfter && !model.wantsCondition && !$("#field-want-cond").checked) {
      await assistantSay("Need FinishAfter and/or a condition, otherwise EscrowCreate has nothing to wait on.", { warn: true });
      setPresence("warn");
      return false;
    }
    if (model.finishAfter && model.cancelAfter && model.finishAfter >= model.cancelAfter) {
      await assistantSay("FinishAfter must be earlier than CancelAfter.", { warn: true });
      setPresence("warn");
      return false;
    }
    if (!model.cancelAfter) {
      await assistantSay("No CancelAfter — if nobody finishes, XRP can stay locked. Consider an expiry.", { warn: true });
      setPresence("warn");
    }
    return true;
  }

  async function ensureCondition() {
    model.wantsCondition = $("#field-want-cond").checked;
    if (!model.wantsCondition) {
      lastCondition = null;
      $("#condition-box").hidden = true;
      if (!model.finishAfter) {
        await assistantSay("Without a condition you need FinishAfter on the Timing step.", { warn: true });
        return false;
      }
      return true;
    }
    if (!model.cancelAfter) {
      await assistantSay("Conditional escrows should set CancelAfter so a lost secret doesn’t lock funds forever.", { warn: true });
      setPresence("warn");
    }
    const pack = await window.EscrowCryptoCond.randomPreimagePair(32);
    lastCondition = pack;
    $("#condition-box").hidden = false;
    $("#fulfillment-json").textContent = JSON.stringify(
      { type: pack.type, condition: pack.condition, fulfillment: pack.fulfillment, warning: "SECRET — save offline. Not uploaded." },
      null,
      2
    );
    await assistantSay("Generated a PREIMAGE-SHA-256 pair. Save the fulfillment now — I won’t store it on a server.");
    return true;
  }

  function buildCreateTx() {
    const tx = {
      TransactionType: "EscrowCreate",
      Account: model.account || "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      Amount: model.amountDrops,
      Destination: model.destination,
    };
    if (model.destinationTag != null) tx.DestinationTag = model.destinationTag;
    if (model.finishAfter != null) tx.FinishAfter = model.finishAfter;
    if (model.cancelAfter != null) tx.CancelAfter = model.cancelAfter;
    if (model.wantsCondition && lastCondition) tx.Condition = lastCondition.condition;
    return tx;
  }

  function currentDraftTx() {
    const tx = buildCreateTx();
    if (model.sourceTag != null) tx.SourceTag = model.sourceTag;
    if (model.invoiceId) tx.InvoiceID = model.invoiceId;
    if (model.memos && model.memos.length) tx.Memos = model.memos;
    return tx;
  }

  function fillLineList(host, lines) {
    host.textContent = "";
    const h = document.createElement("h3");
    h.textContent = "What this would do";
    const ul = document.createElement("ul");
    lines.forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      ul.appendChild(li);
    });
    host.appendChild(h);
    host.appendChild(ul);
  }

  function fillDecodePanel(host, summary) {
    host.hidden = false;
    host.textContent = "";
    const bits = [];
    if (summary.invoice) bits.push(["InvoiceID", summary.invoice.text || summary.invoice.note || summary.invoice.hex]);
    if (summary.srcTag && summary.srcTag.value != null) bits.push(["SourceTag", summary.srcTag.text]);
    bits.push(["DestinationTag", summary.destTag.text]);
    (summary.memos || []).forEach((m, i) => {
      bits.push([
        "Memo " + (i + 1),
        [m.type.text && "type: " + m.type.text, m.format.text && "format: " + m.format.text, m.data.text ? "text: " + m.data.text : m.data.note]
          .filter(Boolean)
          .join(" · ") || "empty",
      ]);
    });
    if (!bits.length && !(summary.memos || []).length && !summary.invoice) {
      host.hidden = true;
      return;
    }
    bits.forEach(([k, v]) => {
      const dk = document.createElement("div");
      dk.className = "k";
      dk.textContent = k;
      const dv = document.createElement("div");
      dv.className = "v";
      dv.textContent = v;
      host.appendChild(dk);
      host.appendChild(dv);
    });
  }

  function renderReview() {
    const warns = [];
    if (!model.cancelAfter) warns.push("No CancelAfter — funds may be uncancellable if never finished / secret lost.");
    if (model.finishAfter && model.cancelAfter && model.finishAfter >= model.cancelAfter) warns.push("FinishAfter >= CancelAfter.");
    if (model.account && model.account === model.destination) warns.push("Source equals destination.");
    if (model.wantsCondition && !lastCondition) warns.push("Condition requested but not generated.");
    const tx = currentDraftTx();
    const amountEntered = model.amountEntered || (model.amountXrp != null ? String(model.amountXrp) : "");
    const summary = window.TxDecode
      ? window.TxDecode.summarizeTx(tx, { amountEntered, requireDest: model.destRequiresTag === true })
      : { lines: [], warnings: [] };
    (summary.warnings || []).forEach((w) => warns.push(w));
    model.warnings = [...new Set([...(model.warnings || []), ...warns])];
    const box = $("#review-summary");
    if (box) fillLineList(box, summary.lines || []);
    const decodeHost = $("#field-decode");
    if (decodeHost) fillDecodePanel(decodeHost, summary);
    const ul = $("#warn-list");
    ul.innerHTML = "";
    model.warnings.forEach((w) => {
      const li = document.createElement("li");
      li.textContent = w;
      ul.appendChild(li);
    });
    if (model.warnings.length) setPresence("warn");
    const items = [
      { k: "Amount", v: `${amountEntered || model.amountXrp || "—"} XRP (${model.amountDrops || "—"} drops)`, back: "Shown as you entered it. Locked until finish/cancel rules allow release." },
      { k: "Destination", v: model.destination || "—", back: "Receives XRP on EscrowFinish." },
      { k: "DestinationTag", v: model.destinationTag != null ? String(model.destinationTag) : "(none)", back: "A number some services use to credit the right account." },
      { k: "FinishAfter", v: model.finishAfter != null ? `${model.finishAfter}\n${fmtLocal(new Date(model.finishLocal))}` : "(none)", back: "Ripple Epoch; human time in your local zone." },
      { k: "CancelAfter", v: model.cancelAfter != null ? `${model.cancelAfter}\n${fmtLocal(new Date(model.cancelLocal))}` : "(none)", back: "After this, EscrowCancel returns funds to sender." },
      { k: "Condition", v: lastCondition ? lastCondition.condition.slice(0, 24) + "…" : "(none)", back: "PREIMAGE-SHA-256 only. Keep fulfillment secret." },
      { k: "Fee", v: "Not set in this draft", back: "Xaman will show the network fee before you sign. This is not a fee suggestion." },
    ];
    const grid = $("#field-grid");
    grid.innerHTML = "";
    items.forEach((it) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "flip-card";
      btn.innerHTML = `<div class="flip-inner"><div class="flip-face front"><div class="k">${escapeHtml(it.k)}</div><div class="v">${escapeHtml(it.v)}</div></div><div class="flip-face back">${escapeHtml(it.back)}</div></div>`;
      btn.addEventListener("click", () => btn.classList.toggle("flipped"));
      grid.appendChild(btn);
    });
    const confirm = $("#review-confirm");
    if (confirm) confirm.checked = !!model.reviewConfirmed;
    syncReviewGateNote();
  }

  function showTab() {
    const create = buildCreateTx();
    const map = {
      create,
      finish: {
        TransactionType: "EscrowFinish",
        Account: create.Destination,
        Owner: create.Account,
        OfferSequence: 0,
        ...(lastCondition ? { Condition: lastCondition.condition, Fulfillment: lastCondition.fulfillment } : {}),
      },
      cancel: { TransactionType: "EscrowCancel", Account: create.Account, Owner: create.Account, OfferSequence: 0 },
    };
    $("#tx-json").textContent = JSON.stringify(map[tab], null, 2);
  }

  /* ---------- demo / lookup / xaman ---------- */
  function demoLog(lines) {
    $("#demo-log").textContent = lines.join("\n");
  }

  async function runDemo() {
    /* Auto-sign faucet demo removed: nothing is auto-signed in this preview. */
    await assistantSay("Nothing is auto-signed here. Use Watch the demo for an example, or inspect a blob on Review. You sign in your own wallet.");
  }

  /* ---------- wire UI ---------- */
  function wireEdits() {
    const map = [
      ["#deal-input", 0],
      ["#field-account", 1],
      ["#field-destination", 1],
      ["#field-dest-tag", 1],
      ["#field-amount", 2],
      ["#field-finish", 3],
      ["#field-cancel", 3],
      ["#field-want-cond", 4],
    ];
    map.forEach(([sel, s]) => {
      const el = $(sel);
      el?.addEventListener("change", () => markDirty(s));
      el?.addEventListener("input", () => {
        if (sel === "#field-amount") {
          const x = Number(el.value);
          if (x > 0) {
            model.amountXrp = x;
            model.amountEntered = el.value.trim();
            model.amountDrops = String(BigInt(Math.round(x * 1e6)));
            updateDropsLabel();
            clearReviewConfirm();
          }
        }
        if (sel === "#field-finish" || sel === "#field-cancel") {
          const fin = $("#field-finish").value;
          const can = $("#field-cancel").value;
          model.finishLocal = fin ? new Date(fin).toISOString() : null;
          model.cancelLocal = can ? new Date(can).toISOString() : null;
          model.finishAfter = fin ? toRipple(new Date(fin)) : null;
          model.cancelAfter = can ? toRipple(new Date(can)) : null;
          updateTimeline();
        }
      });
    });
  }

  $("#motion-toggle").addEventListener("click", () => {
    reduce = !reduce;
    applyMotion();
  });
  $("#net-toggle").addEventListener("click", () => setNetwork(network === "testnet" ? "mainnet" : "testnet"));
  $("#net-toggle").addEventListener("focus", () => $("#net-tip").classList.add("show"));
  $("#net-toggle").addEventListener("blur", () => $("#net-tip").classList.remove("show"));

  $("#sample-btn").addEventListener("click", () => {
    $("#deal-input").value =
      "Lock 50 XRP for rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH until Friday 5pm, he can claim after that, I can cancel if not claimed by next Monday";
    markDirty(0);
  });
  $("#cond-sample-btn").addEventListener("click", () => {
    $("#deal-input").value =
      "Escrow 10 XRP to rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH with a secret code, release when he gives me the secret code, expires in 7 days";
    markDirty(0);
  });

  $("#btn-back").addEventListener("click", () => goStep(step - 1));
  $("#btn-next").addEventListener("click", async () => {
    if (step >= 7) {
      await assistantSay("You’re on Track. Fetch escrows anytime — or jump back via the rail.");
      return;
    }
    await goStep(step + 1);
  });

  async function askAssistantQuestion() {
    const q = $("#faq-input").value.trim();
    if (!q) return;
    const docs = window.Qu1puDocs;
    if (docs && typeof docs.load === "function") {
      try { await docs.load(); } catch (_) {}
    }
    let ans = null;
    if (docs && typeof docs.answer === "function") {
      ans = docs.answer(q, { topic: "escrow" });
    }
    if (!ans && window.EscrowFAQ && typeof window.EscrowFAQ.answer === "function") {
      ans = window.EscrowFAQ.answer(q);
    }
    if (!ans) return;
    if (ans.blocked) $("#faq-input").value = "";
    if (ans.hideUser) {
      $("#faq-input").value = "";
      bubble("user", "[hidden — I won’t repeat that]");
    } else {
      bubble("user", q);
    }
    window.EscrowFAQ.logFaqLocal(q, ans);
    if (ans.refusal || ans.blocked || ans.injection) setPresence("warn");
    await assistantSay(ans.a, {
      warn: !!(ans.refusal || ans.blocked || ans.injection),
      sources: ans.sources || (ans.href ? [ans.href] : []),
      tools: ans.tools || [],
    });
  }

  $("#faq-btn").addEventListener("click", () => { askAssistantQuestion(); });
  $("#faq-input").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      askAssistantQuestion();
    }
  });

  $$(".tabs button").forEach((b) =>
    b.addEventListener("click", () => {
      $$(".tabs button").forEach((x) => {
        x.classList.remove("active");
        x.setAttribute("aria-selected", "false");
      });
      b.classList.add("active");
      b.setAttribute("aria-selected", "true");
      tab = b.dataset.tab;
      showTab();
    })
  );

  $("#copy-json").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("#tx-json").textContent);
    await assistantSay("Copied the reviewed transaction JSON. Sign it in your own wallet — QU1PU never asks for your seed.");
  });

  function xamanEndpoint() {
    return String(CFG.xamanEndpoint || "").replace(/\/$/, "");
  }
  function isXamanHttps(u) {
    try {
      const x = new URL(u);
      return x.protocol === "https:" && /^(?:[a-z0-9-]+\.)?(xumm|xaman)\.app$/.test(x.hostname);
    } catch {
      return false;
    }
  }
  function isMobileSign() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  }
  function clearXamanBox() {
    const box = $("#xaman-box");
    if (box) box.textContent = "";
    return box;
  }
  function setXamanText(msg) {
    const box = clearXamanBox();
    if (box) box.textContent = msg;
  }
  function syncXamanButton() {
    const btn = $("#xaman-btn");
    if (!btn) return;
    const on = !!model.reviewConfirmed && !xamanBusy;
    btn.disabled = !on;
    btn.setAttribute("aria-disabled", on ? "false" : "true");
    if (!xamanBusy) btn.textContent = "Sign in Xaman";
  }
  function stopXamanPoll() {
    if (xamanTimer) {
      clearInterval(xamanTimer);
      xamanTimer = null;
    }
  }
  function showXamanRequest(data) {
    const box = clearXamanBox();
    if (!box) return;
    const p = document.createElement("p");
    p.textContent = isMobileSign()
      ? "Opening Xaman so you can sign yourself. If it did not open, use the link or scan the QR."
      : "Scan this QR with Xaman to sign yourself. QU1PU never asks for your seed and never signs for you.";
    box.appendChild(p);
    if (data.qr && isXamanHttps(data.qr)) {
      const img = document.createElement("img");
      img.src = data.qr;
      img.alt = "QR code to sign in Xaman";
      img.width = 200;
      img.height = 200;
      box.appendChild(img);
    }
    if (data.link && isXamanHttps(data.link)) {
      const a = document.createElement("a");
      a.href = data.link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Open in Xaman";
      box.appendChild(a);
    }
    const st = document.createElement("p");
    st.id = "xaman-status";
    st.textContent = "Waiting for you to sign in Xaman…";
    box.appendChild(st);
  }
  function setXamanStatus(msg) {
    const st = $("#xaman-status");
    if (st) st.textContent = msg;
    else setXamanText(msg);
  }
  function explorerTx(txid) {
    const base = (netCfg() && netCfg().explorer) || "https://livenet.xrpl.org";
    return base.replace(/\/$/, "") + "/transactions/" + encodeURIComponent(txid);
  }
  function showXamanResult(state) {
    stopXamanPoll();
    xamanBusy = false;
    syncXamanButton();
    const box = clearXamanBox();
    if (!box) return;
    const p = document.createElement("p");
    if (state.signed) {
      p.textContent = state.txid
        ? "Signed in Xaman. Transaction id: " + state.txid
        : "Signed in Xaman.";
      box.appendChild(p);
      if (state.txid) {
        const a = document.createElement("a");
        a.href = explorerTx(state.txid);
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "View on explorer";
        box.appendChild(a);
      }
      assistantSay("Signed in Xaman. Nothing was signed by QU1PU.");
      return;
    }
    if (state.expired && !state.resolved) {
      p.textContent = "This sign request expired. Start again if you still want to sign, or copy the transaction JSON.";
    } else if (state.resolved && !state.signed) {
      p.textContent = "Signing was declined in Xaman. Nothing was submitted.";
    } else {
      p.textContent = "Signing did not finish. You can try again or copy the transaction JSON.";
    }
    box.appendChild(p);
  }
  async function pollXaman(uuid) {
    const ep = xamanEndpoint();
    let n = 0;
    stopXamanPoll();
    xamanTimer = setInterval(async () => {
      n += 1;
      if (n > 240) {
        showXamanResult({ expired: true, resolved: false, signed: false });
        return;
      }
      try {
        const r = await fetch(ep + "/payload/" + encodeURIComponent(uuid));
        if (!r.ok) return;
        const s = await r.json();
        if (s.signed || s.resolved || s.expired) showXamanResult(s);
      } catch (_) {
        /* keep waiting; friendly result only when settled */
      }
    }, 2500);
  }
  $("#xaman-btn").addEventListener("click", async () => {
    if (!model.reviewConfirmed) {
      setXamanText("Confirm the review summary first. You sign in Xaman yourself — nothing is auto-signed.");
      await assistantSay("Please confirm the review summary before signing in Xaman.", { warn: true });
      return;
    }
    const ep = xamanEndpoint();
    if (!ep) {
      setXamanText("Signing is not available right now. Copy the transaction JSON instead.");
      return;
    }
    let tx;
    try {
      tx = JSON.parse($("#tx-json").textContent);
    } catch {
      setXamanText("Could not read the reviewed transaction. Check the details, or copy the JSON.");
      return;
    }
    stopXamanPoll();
    xamanBusy = true;
    syncXamanButton();
    const btn = $("#xaman-btn");
    if (btn) btn.textContent = "Starting Xaman…";
    setXamanText("Starting a sign request in Xaman…");
    try {
      const r = await fetch(ep + "/payload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(tx),
      });
      if (!r.ok) throw new Error("bad");
      const data = await r.json();
      const uuid = data && data.uuid;
      const link = data && data.next && data.next.always;
      const qr = data && data.refs && data.refs.qr_png;
      if (!uuid || !isXamanHttps(link) || !isXamanHttps(qr)) throw new Error("bad");
      showXamanRequest({ link, qr });
      if (isMobileSign()) window.open(link, "_blank", "noopener,noreferrer");
      await assistantSay("Sign in Xaman yourself. QU1PU never asks for your seed and never signs for you.");
      pollXaman(uuid);
    } catch {
      xamanBusy = false;
      syncXamanButton();
      setXamanText("Could not start signing. Try again, or copy the transaction JSON.");
      await assistantSay("Could not start signing. You can copy the transaction JSON instead.", { warn: true });
    }
  });
  $("#demo-btn")?.addEventListener("click", runDemo);
  $("#lookup-btn").addEventListener("click", async () => {
    const addr = $("#lookup-addr").value.trim();
    if (!window.xrpl.isValidClassicAddress(addr)) {
      $("#lookup-out").textContent = JSON.stringify({ error: "Invalid address" }, null, 2);
      return;
    }
    try {
      const c = await ensureClient();
      const res = await c.request({ command: "account_objects", account: addr, type: "escrow", ledger_index: "validated" });
      $("#lookup-out").textContent = JSON.stringify(res.result.account_objects || [], null, 2);
    } catch (e) {
      $("#lookup-out").textContent = JSON.stringify({ error: String(e.message || e) }, null, 2);
    }
  });
  $("#use-source-btn").addEventListener("click", () => {
    if (model.account) $("#lookup-addr").value = model.account;
  });

  // keyboard: Alt+Arrow for steps when focus in panel
  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.key === "ArrowRight") {
      e.preventDefault();
      $("#btn-next").click();
    }
    if (e.altKey && e.key === "ArrowLeft") {
      e.preventDefault();
      $("#btn-back").click();
    }
  });

  /* demo wire */
  $("#watch-demo-btn")?.addEventListener("click", () => startDemo());
  $("#cut-next")?.addEventListener("click", () => demoNext());
  $("#cut-back")?.addEventListener("click", () => demoBack());
  $("#cut-skip")?.addEventListener("click", () => endDemo({ finished: false }));
  $("#demo-hint")?.addEventListener("click", () => {
    $("#demo-hint").hidden = true;
    try {
      localStorage.setItem("qu1pu-demo-hint-seen", "1");
    } catch (_) {}
  });

  document.addEventListener("keydown", (e) => {
    if (!demo.active) return;
    if (e.key === "Escape") {
      e.preventDefault();
      endDemo({ finished: false });
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      demoNext();
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      demoBack();
    }
  });


  function warnSecretCleared() {
    setPresence("warn");
    assistantSay("We will never ask for your seed. That looked like a seed or secret key, so it was cleared and not stored or sent.", { warn: true });
  }

  function guardSecretField(el, { allowBlob = false } = {}) {
    if (!el) return;
    const intercept = (raw) => {
      const parser = window.EscrowParser;
      if (!parser?.looksLikeSecret?.(raw)) return false;
      if (allowBlob && window.TxDecode?.looksLikeBlob?.(raw)) return false;
      el.value = "";
      warnSecretCleared();
      return true;
    };
    el.addEventListener("paste", (e) => {
      const text = e.clipboardData?.getData("text") || "";
      if (intercept(text)) e.preventDefault();
    });
    el.addEventListener("input", () => intercept(el.value));
  }

  [
    "#deal-input",
    "#faq-input",
    "#field-account",
    "#field-destination",
    "#field-dest-tag",
    "#field-amount",
    "#lookup-addr",
  ].forEach((sel) => guardSecretField($(sel)));
  guardSecretField($("#blob-input"), { allowBlob: true });

  $("#review-confirm")?.addEventListener("change", () => {
    model.reviewConfirmed = !!$("#review-confirm").checked;
    syncReviewGateNote();
  });

  function showBlobResult(res) {
    const out = $("#blob-out");
    if (!out) return;
    out.hidden = false;
    out.textContent = "";
    if (!res.ok) {
      const p = document.createElement("p");
      p.className = "v";
      p.textContent = res.error || "Could not decode.";
      out.appendChild(p);
      return;
    }
    const note = document.createElement("p");
    note.className = "dim tiny";
    note.textContent = res.fromBlob
      ? "Decoded from a blob. Read-only — not submitted."
      : "Read from JSON. Read-only — not submitted.";
    out.appendChild(note);
    const sum = document.createElement("div");
    fillLineList(sum, res.summary.lines || []);
    out.appendChild(sum);
    const dec = document.createElement("div");
    fillDecodePanel(dec, res.summary);
    out.appendChild(dec);
    (res.summary.warnings || []).forEach((w) => {
      const li = document.createElement("p");
      li.className = "v";
      li.style.color = "var(--warn)";
      li.textContent = w;
      out.appendChild(li);
    });
  }

  $("#blob-decode-btn")?.addEventListener("click", async () => {
    const raw = $("#blob-input")?.value || "";
    if (window.EscrowParser?.looksLikeSecret?.(raw) && !window.TxDecode?.looksLikeBlob?.(raw)) {
      $("#blob-input").value = "";
      warnSecretCleared();
      return;
    }
    const res = window.TxDecode.decodeBlobOrJson(raw);
    if (res.secretBlocked) {
      $("#blob-input").value = "";
      warnSecretCleared();
      return;
    }
    showBlobResult(res);
    await assistantSay(res.ok ? "Decoded the blob. Nothing was submitted." : res.error, { warn: !res.ok });
  });

  $("#blob-clear-btn")?.addEventListener("click", () => {
    if ($("#blob-input")) $("#blob-input").value = "";
    const out = $("#blob-out");
    if (out) {
      out.hidden = true;
      out.textContent = "";
    }
  });

  $("#blob-sample-btn")?.addEventListener("click", async () => {
    const xrpl = window.xrpl;
    if (!xrpl?.encode) {
      await assistantSay("Decoder is not loaded.", { warn: true });
      return;
    }
    const memoText = (s) =>
      [...new TextEncoder().encode(s)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const invoice = memoText("INV-DEMO-001").padEnd(64, "0");
    let blob;
    try {
      const w = xrpl.Wallet.generate();
      const signed = w.sign({
        TransactionType: "Payment",
        Account: w.classicAddress,
        Destination: "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
        Amount: "1500000",
        Fee: "12",
        Sequence: 1,
        Flags: 0,
        SourceTag: 77,
        InvoiceID: invoice,
        Memos: [{ Memo: { MemoType: memoText("text/plain"), MemoData: memoText("hello from a sample blob") } }],
      });
      blob = signed.tx_blob;
    } catch (e) {
      await assistantSay("Could not build a sample blob.", { warn: true });
      return;
    }
    $("#blob-input").value = blob;
    const res = window.TxDecode.decodeBlobOrJson(blob);
    showBlobResult(res);
    await assistantSay("Loaded a synthetic sample blob (missing destination tag on purpose). Read-only — not submitted.");
  });

  /* boot */
  setNetwork(network, { force: true });
  applyMotion();
  initPresence();
  wireEdits();
  renderRail();
  $$(".step").forEach((el) => {
    el.hidden = Number(el.dataset.step) !== 0;
  });
  maybeShowDemoHint();
  assistantSay("Hi — I’m QU1PU, named after the Inca knotted-string ledger. We will never ask for your seed. You review a plain-word summary, then you sign in Xaman. Step 1: describe the escrow deal.");

  window.__escrowWizard = { goStep, get step() { return step; }, get model() { return model; }, setPresence, renderReview, currentDraftTx };
  window.__escrowDemo = {
    start: startDemo,
    next: demoNext,
    back: demoBack,
    skip: () => endDemo({ finished: false }),
    get active() { return demo.active; },
    get index() { return demo.index; },
  };
})();
