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
  };

  function netCfg() {
    return CFG.networks[network];
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  function bubble(role, htmlOrText, { html = false } = {}) {
    const log = $("#chat-log");
    const div = document.createElement("div");
    div.className = "bubble " + role;
    div.innerHTML = `<div class="meta">${role === "user" ? "you" : "Bean"}</div>${html ? htmlOrText : escapeHtml(htmlOrText)}`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function assistantSay(text, { warn = false } = {}) {
    return new Promise((resolve) => {
      clearTimeout(typingTimer);
      const log = $("#chat-log");
      const typing = document.createElement("div");
      typing.className = "bubble bot typing";
      typing.innerHTML = `<div class="meta">Bean</div><span class="dots"><span></span><span></span><span></span></span>`;
      log.appendChild(typing);
      log.scrollTop = log.scrollHeight;
      setPresence(warn ? "warn" : "think");

      const delay = reduce ? 80 : 450 + Math.min(900, text.length * 8);
      typingTimer = setTimeout(() => {
        typing.remove();
        const div = bubble("bot", "");
        const body = document.createElement("span");
        div.appendChild(body);
        if (reduce) {
          body.textContent = text;
          setPresence(warn ? "warn" : "idle");
          resolve();
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
          else {
            setPresence(warn ? "warn" : "idle");
            resolve();
          }
        };
        tick();
      }, delay);
    });
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
  }

  async function goStep(n, { viaRail = false, skipIntro = false } = {}) {
    if (n < 0 || n > 7) return;
    if (n > step) {
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
    if (n === 6) showTab();
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
      "Review every field. Tap a card to flip explanations. Fix warnings before signing.",
      "Copy JSON or send to Xaman when you add an API key. Testnet demo is available here.",
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
    model.dealText = text;
    if (!text) {
      setPresence("warn");
      await assistantSay("Type a deal first (or load a sample).", { warn: true });
      return false;
    }
    bubble("user", text);
    const parsed = window.EscrowParser.parseDeal(text);
    if (parsed.seedBlocked || parsed.refusal) {
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
        if (model.destinationTag == null) {
          await assistantSay("That destination requires a DestinationTag (asfRequireDest).", { warn: true });
          setPresence("warn");
          $("#parties-note").textContent = "Destination requires a tag.";
          return false;
        }
        $("#parties-note").textContent = "Destination requires a tag — provided.";
      } else {
        $("#parties-note").textContent = "Destination does not require a tag.";
      }
    } catch (e) {
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

  function renderReview() {
    const warns = [];
    if (!model.cancelAfter) warns.push("No CancelAfter — funds may be uncancellable if never finished / secret lost.");
    if (model.finishAfter && model.cancelAfter && model.finishAfter >= model.cancelAfter) warns.push("FinishAfter >= CancelAfter.");
    if (model.account && model.account === model.destination) warns.push("Source equals destination.");
    if (model.wantsCondition && !lastCondition) warns.push("Condition requested but not generated.");
    model.warnings = [...new Set([...(model.warnings || []), ...warns])];
    const ul = $("#warn-list");
    ul.innerHTML = "";
    model.warnings.forEach((w) => {
      const li = document.createElement("li");
      li.textContent = w;
      ul.appendChild(li);
    });
    if (model.warnings.length) setPresence("warn");
    const items = [
      { k: "Amount", v: `${model.amountXrp} XRP (${model.amountDrops} drops)`, back: "Locked until finish/cancel rules allow release." },
      { k: "Destination", v: model.destination || "—", back: "Receives XRP on EscrowFinish." },
      { k: "DestinationTag", v: model.destinationTag != null ? String(model.destinationTag) : "(none)", back: "Required if asfRequireDest is set." },
      { k: "FinishAfter", v: model.finishAfter != null ? `${model.finishAfter}\n${fmtLocal(new Date(model.finishLocal))}` : "(none)", back: "Ripple Epoch; human time in your local zone." },
      { k: "CancelAfter", v: model.cancelAfter != null ? `${model.cancelAfter}\n${fmtLocal(new Date(model.cancelLocal))}` : "(none)", back: "After this, EscrowCancel returns funds to sender." },
      { k: "Condition", v: lastCondition ? lastCondition.condition.slice(0, 24) + "…" : "(none)", back: "PREIMAGE-SHA-256 only. Keep fulfillment secret." },
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
    if (network !== "testnet") {
      demoLog(["Blocked on mainnet."]);
      return;
    }
    const xrpl = window.xrpl;
    const lines = [];
    const log = (s) => {
      lines.push(s);
      demoLog(lines);
    };
    $("#demo-btn").disabled = true;
    try {
      log("Faucet sender…");
      const fr = await fetch(netCfg().faucet, { method: "POST", headers: { "Content-Type": "application/json" } });
      const funded = await fr.json();
      const wallet = xrpl.Wallet.fromSeed(funded.seed || funded.account?.secret);
      const fr2 = await fetch(netCfg().faucet, { method: "POST", headers: { "Content-Type": "application/json" } });
      const funded2 = await fr2.json();
      const dest = funded2.account?.classicAddress || funded2.account?.address || funded2.address;
      const c = await ensureClient();
      for (let i = 0; i < 20; i++) {
        try {
          await c.request({ command: "account_info", account: wallet.classicAddress, ledger_index: "validated" });
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 1200));
        }
      }
      const now = Math.floor(Date.now() / 1000) - RIPPLE_EPOCH;
      const prepared = await c.autofill({
        TransactionType: "EscrowCreate",
        Account: wallet.classicAddress,
        Destination: dest,
        Amount: xrpl.xrpToDrops("10"),
        FinishAfter: now + 12,
        CancelAfter: now + 180,
      });
      const create = await c.submitAndWait(wallet.sign(prepared).tx_blob);
      log("Create " + create.result.hash);
      await new Promise((r) => setTimeout(r, 18000));
      const fin = await c.autofill({
        TransactionType: "EscrowFinish",
        Account: wallet.classicAddress,
        Owner: wallet.classicAddress,
        OfferSequence: prepared.Sequence,
      });
      const finSub = await c.submitAndWait(wallet.sign(fin).tx_blob);
      log("Finish " + finSub.result.hash);
      window.__escrowDemoResult = { createHash: create.result.hash, finishHash: finSub.result.hash };
      await assistantSay("Testnet demo finished successfully.");
    } catch (e) {
      log("Error: " + (e.message || e));
      setPresence("warn");
    } finally {
      $("#demo-btn").disabled = network !== "testnet";
    }
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
            model.amountDrops = String(BigInt(Math.round(x * 1e6)));
            updateDropsLabel();
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

  $("#faq-btn").addEventListener("click", async () => {
    const q = $("#faq-input").value.trim();
    if (!q) return;
    bubble("user", q);
    const ans = window.EscrowFAQ.answer(q);
    window.EscrowFAQ.logFaqLocal(q, ans);
    if (ans.refusal || ans.blocked) setPresence("warn");
    await assistantSay(ans.a + " Source: " + ans.href, { warn: !!(ans.refusal || ans.blocked) });
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
    await assistantSay("Copied JSON.");
  });
  $("#xaman-btn").addEventListener("click", async () => {
    const key = (CFG.xummApiKey || "").trim();
    if (!key) {
      $("#xaman-box").textContent =
        "No Xaman API key in config.js. Create a free app at https://apps.xumm.dev and paste the public API Key into xummApiKey.";
      await assistantSay("Add your public Xaman API key to enable push. Until then, copy the JSON.");
      return;
    }
    $("#xaman-box").textContent = "API key present (…" + key.slice(-4) + "). Wire xumm PKCE / payload.create next — key is ready.";
  });
  $("#demo-btn").addEventListener("click", runDemo);
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

  /* boot */
  setNetwork(network, { force: true });
  applyMotion();
  initPresence();
  wireEdits();
  renderRail();
  $$(".step").forEach((el) => {
    el.hidden = Number(el.dataset.step) !== 0;
  });
  assistantSay("Hi — I’m Bean. Step 1: describe the escrow deal. Use Back anytime, or the rail to jump to completed steps.");

  window.__escrowWizard = { goStep, get step() { return step; }, get model() { return model; }, setPresence };
})();
