(() => {
  "use strict";

  const WS_URLS = ["wss://xrplcluster.com", "wss://s1.ripple.com"];
  const XRPSCAN_VALIDATORS = "https://api.xrpscan.com/api/v1/validatorregistry";
  const SNAP_UNL = "data/unl-snapshot.json";
  const SNAP_DOMAINS = "data/unl-domains-snapshot.json";
  const IS_MOBILE = window.matchMedia("(max-width:720px)").matches || navigator.maxTouchPoints > 1;

  const FEAT_COPY = {
    escrow: { title: "Escrow", body: "Escrow locks XRP until a finish time or crypto-condition is met. Anyone can finish or cancel according to the rules encoded in the transaction — useful for time-locks and conditional settlement.", href: "https://xrpl.org/docs/concepts/payment-types/escrow" },
    amm: { title: "Automated Market Maker (AMM)", body: "On-ledger AMM pools let traders swap issued tokens and XRP without a central order book operator for that pool. Liquidity providers deposit and withdraw against pool state on the ledger.", href: "https://xrpl.org/docs/concepts/tokens/decentralized-exchange/automated-market-makers" },
    iou: { title: "Issued tokens", body: "Anyone can issue a token (IOU). Holders set trust lines to issuers they accept. Settlements of issued value move as ledger balances — the same rails as XRP payments.", href: "https://xrpl.org/docs/concepts/tokens/fungible-tokens" },
    nft: { title: "NFTs (NFToken)", body: "The NFToken amendment adds native non-fungible tokens: mint, burn, brokered offers, and transfers with on-ledger provenance — no separate NFT sidechain required for the base standard.", href: "https://xrpl.org/docs/concepts/tokens/nfts" },
    dex: { title: "Cross-currency payments", body: "A Payment can consume order-book and AMM paths so a sender pays in one asset and a destination receives another in a single atomic transaction when a path exists.", href: "https://xrpl.org/docs/concepts/tokens/decentralized-exchange" },
    checks: { title: "Checks", body: "Checks are authorizations for a destination to pull funds later (up to a send-max). They support invoice-like flows without giving the sender continuous spend authority.", href: "https://xrpl.org/docs/concepts/payment-types/checks" },
  };

  const MYTHS = [
    { myth: "XRP is just a Ripple share proxy.", fact: "XRP is the native asset of an open ledger. Holding XRP is not equity in Ripple. Protocol rules change via validator-voted amendments, not a corporate board vote.", href: "https://xrpl.org/about/xrp" },
    { myth: "Ripple alone decides every ledger.", fact: "Ledgers advance by consensus among servers that trust overlapping validator lists. Operators choose their UNL; Foundation and other publishers recommend lists.", href: "https://xrpl.org/docs/concepts/consensus-protocol/consensus-structure" },
    { myth: "New features appear when Ripple ships code.", fact: "Code can propose amendments, but enabling them on mainnet requires ~80% of trusted validators for two weeks, then a flag ledger.", href: "https://xrpl.org/docs/concepts/consensus-protocol/amendments" },
    { myth: "You need Ripple to use escrow, DEX, or tokens.", fact: "Escrow, Checks, AMM, issued tokens, and NFTs are ledger features any compatible client can use. Settlement finality is on the shared ledger.", href: "https://xrpl.org/docs/concepts" },
    { myth: "Neutral settlement is only theory.", fact: "Every few seconds a validated ledger commits transactions with a base fee denominated in drops of XRP. Watch the live ticker on this page.", href: "https://xrpl.org/docs/concepts/transactions" },
    { myth: "Validators are all Ripple machines.", fact: "Recommended UNLs include independent operators (exchanges, universities, infra teams, individuals). Explore domains on the validators scene.", href: "https://livenet.xrpl.org/network/validators" },
  ];

  const TICK_HELP = {
    ledger: "The latest validated ledger index from the public cluster (read-only).",
    fee: "Base fee in XRP for a reference transaction (drops ÷ 1,000,000).",
    txns: "How many transactions closed in the most recent validated ledger.",
    age: "Seconds since that validated ledger closed on the connected server.",
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  /* ---------- reduced motion ---------- */
  const motionBtn = $("#motion-toggle");
  let reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let netAnimId = 0;
  let rainAnimId = 0;

  let rainReady = false;
  function applyMotion() {
    document.body.classList.toggle("reduce-motion", reduce);
    if (motionBtn) {
      motionBtn.setAttribute("aria-pressed", String(reduce));
      motionBtn.textContent = reduce ? "Motion on" : "Reduce motion";
    }
    if (reduce) {
      cancelAnimationFrame(rainAnimId);
      cancelAnimationFrame(netAnimId);
    } else {
      if (rainReady) startRain();
      if (window.__net && window.__net.ready) loopNet();
    }
  }
  applyMotion();
  motionBtn?.addEventListener("click", () => {
    reduce = !reduce;
    applyMotion();
  });

  /* ---------- helpers ---------- */
  function animateCount(el, target, ms = 900) {
    if (!el) return;
    el.dataset.target = String(target);
    const start = performance.now();
    const from = parseInt(el.textContent.replace(/\D/g, ""), 10) || 0;
    if (reduce) {
      el.textContent = String(target);
      el.closest(".interactive-stat")?.classList.add("lit");
      return;
    }
    function frame(t) {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(from + (target - from) * eased));
      if (p < 1) requestAnimationFrame(frame);
      else {
        el.textContent = String(target);
        el.closest(".interactive-stat")?.classList.add("lit");
        setTimeout(() => el.closest(".interactive-stat")?.classList.remove("lit"), 700);
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- scroll reveal + parallax hint ---------- */
  const scenes = $$("[data-scene]");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) e.target.classList.add("in");
      },
      { threshold: 0.15 }
    );
    scenes.forEach((s) => io.observe(s));
  } else scenes.forEach((s) => s.classList.add("in"));

  /* ---------- digital rain (capped on mobile) ---------- */
  const canvasRain = $("#rain");
  rainReady = true;
  function startRain() {
    if (!canvasRain || reduce) return;
    const ctx = canvasRain.getContext("2d");
    let w, h, cols, drops;
    const chars = "01XRPL consenSUS#*+".split("");
    const step = IS_MOBILE ? 22 : 16;
    function resize() {
      w = canvasRain.width = window.innerWidth;
      h = canvasRain.height = window.innerHeight;
      cols = Math.floor(w / step);
      drops = Array.from({ length: cols }, () => Math.random() * h);
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });
    function frame() {
      if (reduce) return;
      ctx.fillStyle = "rgba(7,9,11,0.1)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(61,245,143,0.45)";
      ctx.font = (IS_MOBILE ? 11 : 13) + "px monospace";
      for (let i = 0; i < drops.length; i++) {
        ctx.fillText(chars[(Math.random() * chars.length) | 0], i * step, drops[i] * step);
        if (drops[i] * step > h && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      rainAnimId = requestAnimationFrame(frame);
    }
    cancelAnimationFrame(rainAnimId);
    rainAnimId = requestAnimationFrame(frame);
  }
  if (!reduce) startRain();

  /* ---------- hero micro ---------- */
  const heroPulse = $("#hero-pulse");
  heroPulse?.addEventListener("click", () => {
    if (reduce) return;
    heroPulse.classList.remove("burst");
    void heroPulse.offsetWidth;
    heroPulse.classList.add("burst");
  });
  const orbs = $("#hero-orbs");
  if (orbs && !reduce) {
    const n = IS_MOBILE ? 4 : 8;
    for (let i = 0; i < n; i++) {
      const o = document.createElement("span");
      o.className = "hero-orb";
      o.style.left = 10 + Math.random() * 80 + "%";
      o.style.top = 20 + Math.random() * 60 + "%";
      o.style.animationDelay = (Math.random() * 4).toFixed(2) + "s";
      orbs.appendChild(o);
    }
  }
  // Note: o.style.* from JS is CSSOM — allowed under style-src 'self' in Chromium.
  // Hero orbs use left/top via style; if CSP ever blocks, switch to CSS vars on container.

  /* ---------- myths ---------- */
  const mythGrid = $("#myth-grid");
  if (mythGrid) {
    mythGrid.innerHTML = MYTHS.map(
      (m, i) => `<button type="button" class="myth-card" data-i="${i}" aria-label="Flip myth card ${i + 1}">
        <div class="myth-inner">
          <div class="myth-face front"><span class="tag">MYTH</span><h3>${escapeHtml(m.myth)}</h3><p>Tap to reveal the fact</p></div>
          <div class="myth-face back"><span class="tag">FACT</span><h3>${escapeHtml(m.fact)}</h3><a href="${escapeHtml(m.href)}" rel="noopener" target="_blank" onclick="event.stopPropagation()">Source on xrpl.org →</a></div>
        </div></button>`
    ).join("");
    mythGrid.addEventListener("click", (e) => {
      const card = e.target.closest(".myth-card");
      if (card) card.classList.toggle("flipped");
    });
  }

  /* ---------- feature cards tilt ---------- */
  const detail = $("#feat-detail");
  $$(".feat-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = FEAT_COPY[btn.dataset.feat];
      if (!c) return;
      $$(".feat-card").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active", "press");
      setTimeout(() => btn.classList.remove("press"), 280);
      detail.hidden = false;
      $("#feat-detail-title").textContent = c.title;
      $("#feat-detail-body").textContent = c.body;
      const link = $("#feat-detail-link");
      link.href = c.href;
      link.textContent = "Read the docs →";
    });
    if (!IS_MOBILE && !reduce) {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        btn.style.transform = `perspective(600px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-2px)`;
      });
      btn.addEventListener("pointerleave", () => {
        btn.style.transform = "";
      });
    }
  });

  /* ---------- amendments scrubber ---------- */
  const scrub = $("#vote-scrub");
  const amendBar = $("#amend-bar");
  const voteLabel = $("#vote-pct-label");
  const amendCaption = $("#amend-caption");
  const weekSpans = () => $$("#amend-weeks span");
  let weekTimer = null;

  function setSupport(pct) {
    const p = Math.max(0, Math.min(100, pct));
    document.documentElement.style.setProperty("--amend-pct", p + "%");
    if (scrub) {
      scrub.value = String(p);
      scrub.setAttribute("aria-valuenow", String(p));
    }
    if (voteLabel) voteLabel.textContent = p + "%";
    amendBar?.classList.toggle("over", p >= 80);
    if (amendCaption) {
      if (p < 80) amendCaption.textContent = `Support ${p}% — below the ~80% threshold (demo scrubber).`;
      else amendCaption.textContent = `Support ${p}% — at/above threshold. Hold ~14 days, then a flag ledger can enable (docs).`;
    }
  }

  scrub?.addEventListener("input", () => {
    clearInterval(weekTimer);
    weekSpans().forEach((s) => s.classList.remove("on"));
    setSupport(Number(scrub.value));
  });

  $("#week-play")?.addEventListener("click", () => {
    clearInterval(weekTimer);
    const spans = weekSpans();
    spans.forEach((s) => s.classList.remove("on"));
    if (Number(scrub.value) < 80) setSupport(82);
    if (reduce) {
      spans.forEach((s) => s.classList.add("on"));
      amendCaption.textContent = "Two weeks at ≥80% → ready for a flag ledger. (Docs: Amendments)";
      return;
    }
    let d = 0;
    weekTimer = setInterval(() => {
      if (d < spans.length) spans[d].classList.add("on");
      d++;
      amendCaption.textContent = `Holding ≥80%… day ${Math.min(d, 14)} of 14 (demo timer)`;
      if (d >= spans.length) {
        clearInterval(weekTimer);
        amendCaption.textContent = "Two weeks at ≥80% → ready for a flag ledger. (Docs: Amendments)";
      }
    }, 120);
  });

  // Auto-demo once when section enters view
  let amendDemoDone = false;
  const amendSection = $("#amendments");
  if (amendSection && "IntersectionObserver" in window) {
    const aio = new IntersectionObserver(
      (ents) => {
        if (!ents.some((e) => e.isIntersecting) || amendDemoDone) return;
        amendDemoDone = true;
        if (reduce) {
          setSupport(82);
          weekSpans().forEach((s) => s.classList.add("on"));
          return;
        }
        let v = 0;
        const climb = setInterval(() => {
          v = Math.min(82, v + 2);
          setSupport(v);
          if (v >= 82) {
            clearInterval(climb);
            $("#week-play")?.click();
          }
        }, 35);
      },
      { threshold: 0.35 }
    );
    aio.observe(amendSection);
  } else setSupport(0);

  function renderAmendChips(entries) {
    const wrap = $("#amend-chips");
    if (!wrap) return;
    const enabled = entries.filter(([, v]) => v.enabled);
    const pending = entries.filter(([, v]) => !v.enabled);
    const show = [
      ...pending.map(([, v]) => ({ name: v.name || "unknown", enabled: false, supported: !!v.supported })),
      ...enabled
        .slice()
        .sort((a, b) => (a[1].name || "").localeCompare(b[1].name || ""))
        .slice(0, 12)
        .map(([, v]) => ({ name: v.name || "unknown", enabled: true, supported: !!v.supported })),
    ];
    wrap.innerHTML = "";
    show.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "amend-chip " + (item.enabled ? "enabled" : "pending");
      btn.textContent = item.name;
      btn.addEventListener("click", () => {
        $$(".amend-chip").forEach((c) => c.classList.remove("active"));
        btn.classList.add("active");
        const box = $("#amend-detail");
        box.hidden = false;
        $("#amend-detail-title").textContent = item.name;
        $("#amend-detail-body").textContent = item.enabled
          ? `Status: enabled on this public server. Supported by server binary: ${item.supported ? "yes" : "no"}. Source: rippled feature command (live).`
          : `Status: not enabled yet on this public server. Supported by server binary: ${item.supported ? "yes" : "no"}. Enabling still needs the amendment process (~80% trusted validators for two weeks). Source: rippled feature command (live).`;
      });
      wrap.appendChild(btn);
    });
  }

  /* ---------- validator network canvas ---------- */
  const stage = $("#net-stage");
  const netCanvas = $("#net-canvas");
  const tooltip = $("#node-tooltip");
  const net = {
    ready: false,
    nodes: [],
    links: [],
    pulses: [],
    rotY: 0,
    rotX: 0.25,
    targetRotY: 0,
    targetRotX: 0.25,
    dragging: false,
    lastX: 0,
    lastY: 0,
    ripple: 0,
    hover: -1,
  };
  window.__net = net;

  function buildNetwork(validators) {
    // validators: [{domain, unl:bool}]
    const list = validators.slice(0, IS_MOBILE ? 28 : 40);
    net.nodes = list.map((v, i) => {
      const phi = Math.acos(-1 + (2 * i) / Math.max(1, list.length - 1));
      const theta = Math.sqrt(list.length * Math.PI) * phi;
      return {
        domain: v.domain || "(no domain)",
        unl: !!v.unl,
        x: Math.cos(theta) * Math.sin(phi),
        y: Math.cos(phi),
        z: Math.sin(theta) * Math.sin(phi),
        glow: 0,
      };
    });
    net.links = [];
    for (let i = 0; i < net.nodes.length; i++) {
      const dists = [];
      for (let j = 0; j < net.nodes.length; j++) {
        if (i === j) continue;
        const a = net.nodes[i],
          b = net.nodes[j];
        const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
        dists.push({ j, d });
      }
      dists.sort((a, b) => a.d - b.d);
      dists.slice(0, 3).forEach(({ j }) => {
        if (i < j) net.links.push([i, j]);
      });
    }
    net.pulses = [];
    net.ready = true;
    if (!reduce) loopNet();
    else drawNet(true);
  }

  function project(n, w, h) {
    const cy = Math.cos(net.rotY),
      sy = Math.sin(net.rotY);
    const cx = Math.cos(net.rotX),
      sx = Math.sin(net.rotX);
    let x = n.x,
      y = n.y,
      z = n.z;
    let xz = x * cy + z * sy;
    let zz = -x * sy + z * cy;
    let y2 = y * cx - zz * sx;
    let z2 = y * sx + zz * cx;
    const scale = Math.min(w, h) * 0.36;
    return { x: w / 2 + xz * scale, y: h / 2 + y2 * scale, z: z2, r: 3.2 + (z2 + 1) * 2.2 };
  }

  function spawnPulse() {
    if (!net.links.length || reduce) return;
    const link = net.links[(Math.random() * net.links.length) | 0];
    net.pulses.push({ a: link[0], b: link[1], t: 0, speed: 0.012 + Math.random() * 0.02 });
    if (net.pulses.length > (IS_MOBILE ? 10 : 22)) net.pulses.shift();
  }

  function drawNet(staticFrame) {
    if (!netCanvas || !net.ready) return;
    const ctx = netCanvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = netCanvas.clientWidth;
    const h = netCanvas.clientHeight;
    if (netCanvas.width !== Math.floor(w * dpr) || netCanvas.height !== Math.floor(h * dpr)) {
      netCanvas.width = Math.floor(w * dpr);
      netCanvas.height = Math.floor(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // globe ring
    ctx.strokeStyle = "rgba(46,230,208,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, Math.min(w, h) * 0.38, Math.min(w, h) * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();

    const projected = net.nodes.map((n) => project(n, w, h));

    // links
    ctx.lineWidth = 1;
    for (const [i, j] of net.links) {
      const a = projected[i],
        b = projected[j];
      const alpha = 0.12 + ((a.z + b.z) / 2 + 1) * 0.12;
      ctx.strokeStyle = `rgba(61,245,143,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // traveling pulses
    for (const p of net.pulses) {
      const a = projected[p.a],
        b = projected[p.b];
      const x = a.x + (b.x - a.x) * p.t;
      const y = a.y + (b.y - a.y) * p.t;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 8);
      g.addColorStop(0, "rgba(46,230,208,0.95)");
      g.addColorStop(1, "rgba(46,230,208,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // nodes
    projected.forEach((p, i) => {
      const n = net.nodes[i];
      const glow = n.glow + (net.ripple > 0 ? net.ripple : 0) + (net.hover === i ? 0.8 : 0);
      const color = n.unl ? "61,245,143" : "46,230,208";
      if (glow > 0.05) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${color},${0.15 + glow * 0.25})`;
        ctx.arc(p.x, p.y, p.r + 6 + glow * 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.fillStyle = `rgba(${color},${0.55 + (p.z + 1) * 0.2})`;
      ctx.arc(p.x, p.y, p.r + (net.hover === i ? 2 : 0), 0, Math.PI * 2);
      ctx.fill();
      if (n.unl) {
        ctx.strokeStyle = "rgba(255,210,122,0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    if (!staticFrame) {
      // idle spin
      if (!net.dragging && !reduce) net.targetRotY += 0.003;
      net.rotY += (net.targetRotY - net.rotY) * 0.08;
      net.rotX += (net.targetRotX - net.rotX) * 0.08;
      net.ripple = Math.max(0, net.ripple - 0.02);
      net.nodes.forEach((n) => {
        n.glow = Math.max(0, n.glow - 0.03);
      });
      if (!reduce && Math.random() < (IS_MOBILE ? 0.04 : 0.08)) spawnPulse();
      net.pulses.forEach((p) => {
        p.t += p.speed;
      });
      net.pulses = net.pulses.filter((p) => {
        if (p.t >= 1) {
          net.nodes[p.b].glow = 1;
          return false;
        }
        return true;
      });
    }
  }

  function loopNet() {
    cancelAnimationFrame(netAnimId);
    if (reduce) {
      drawNet(true);
      return;
    }
    drawNet(false);
    netAnimId = requestAnimationFrame(loopNet);
  }

  function hitTest(clientX, clientY) {
    if (!netCanvas || !net.ready) return -1;
    const rect = netCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const w = netCanvas.clientWidth;
    const h = netCanvas.clientHeight;
    const projected = net.nodes.map((n) => project(n, w, h));
    let best = -1,
      bestD = 16;
    projected.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  function showTip(i, clientX, clientY) {
    if (!tooltip || i < 0) {
      tooltip.hidden = true;
      return;
    }
    const n = net.nodes[i];
    const rect = stage.getBoundingClientRect();
    tooltip.hidden = false;
    tooltip.textContent = `${n.domain}${n.unl ? " · UNL" : " · seen"}`;
    let left = clientX - rect.left + 12;
    let top = clientY - rect.top + 12;
    if (left > rect.width - 160) left -= 170;
    if (top > rect.height - 40) top -= 40;
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
  }

  if (stage && netCanvas) {
    stage.addEventListener("pointerdown", (e) => {
      net.dragging = true;
      stage.classList.add("dragging");
      net.lastX = e.clientX;
      net.lastY = e.clientY;
      stage.setPointerCapture?.(e.pointerId);
    });
    stage.addEventListener("pointermove", (e) => {
      if (net.dragging) {
        const dx = e.clientX - net.lastX;
        const dy = e.clientY - net.lastY;
        net.lastX = e.clientX;
        net.lastY = e.clientY;
        net.targetRotY += dx * 0.005;
        net.targetRotX = Math.max(-0.9, Math.min(0.9, net.targetRotX + dy * 0.004));
      }
      const i = hitTest(e.clientX, e.clientY);
      net.hover = i;
      if (i >= 0) showTip(i, e.clientX, e.clientY);
      else if (!IS_MOBILE) tooltip.hidden = true;
    });
    const endDrag = (e) => {
      if (!net.dragging) return;
      net.dragging = false;
      stage.classList.remove("dragging");
      const i = hitTest(e.clientX, e.clientY);
      if (i >= 0) {
        net.nodes[i].glow = 1.2;
        showTip(i, e.clientX, e.clientY);
        // highlight matching chip
        $$("#domain-chips button").forEach((b) => {
          b.classList.toggle("active", b.dataset.domain === net.nodes[i].domain);
        });
      }
    };
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);
    stage.addEventListener("pointerleave", () => {
      if (!net.dragging) {
        net.hover = -1;
        if (!IS_MOBILE) tooltip.hidden = true;
      }
    });
    window.addEventListener(
      "resize",
      () => {
        if (net.ready) drawNet(reduce);
      },
      { passive: true }
    );
  }

  function paintDomainChips(domains, unlSet) {
    const chips = $("#domain-chips");
    chips.innerHTML = "";
    domains.slice(0, 24).forEach((d) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.domain = d;
      btn.textContent = d;
      btn.addEventListener("click", () => {
        $$("#domain-chips button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const idx = net.nodes.findIndex((n) => n.domain === d);
        if (idx >= 0) {
          net.nodes[idx].glow = 1.4;
          net.hover = idx;
          const rect = stage.getBoundingClientRect();
          showTip(idx, rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
      });
      chips.appendChild(btn);
    });
  }

  async function loadValidators() {
    let snap = null,
      domainSnap = null;
    try {
      snap = await (await fetch(SNAP_UNL)).json();
    } catch (_) {}
    try {
      domainSnap = await (await fetch(SNAP_DOMAINS)).json();
    } catch (_) {}

    try {
      const res = await fetch(XRPSCAN_VALIDATORS, { mode: "cors" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const list = await res.json();
      const unl = list.filter((v) => Array.isArray(v.unl) && v.unl.length);
      const domains = [...new Set(unl.map((v) => v.domain || "(no domain)"))].sort();
      animateCount($("#unl-count"), unl.length);
      animateCount($("#seen-count"), list.length, 1100);
      $("#unl-source").textContent = "Live from XRPScan validatorregistry · " + new Date().toISOString();
      const nodes = unl.map((v) => ({ domain: v.domain || "(no domain)", unl: true }));
      // sprinkle a few non-UNL for visual contrast (from live seen list)
      const extras = list
        .filter((v) => !(Array.isArray(v.unl) && v.unl.length))
        .slice(0, 8)
        .map((v) => ({ domain: v.domain || "(no domain)", unl: false }));
      buildNetwork(nodes.concat(extras));
      paintDomainChips(domains);
      net.ripple = 1;
      return { live: true, unl: unl.length };
    } catch (err) {
      const count = snap?.unl_validator_count ?? domainSnap?.unl_count ?? 0;
      const domains = domainSnap?.domains || [];
      animateCount($("#unl-count"), count || 0);
      animateCount($("#seen-count"), domainSnap?.total_seen || 0);
      $("#unl-source").textContent = `Snapshot ${snap?.captured_at || domainSnap?.captured_at || "n/a"} (live fetch failed: ${err.message})`;
      buildNetwork(domains.map((d) => ({ domain: d, unl: true })));
      paintDomainChips(domains);
      return { live: false, error: String(err) };
    }
  }

  /* ---------- ticker / ledger blocks ---------- */
  let ws;
  let wsUrl = WS_URLS[0];
  const tickLog = $("#ticker-log");
  const rail = $("#ledger-rail");
  const recentLedgers = [];

  function logTick(line) {
    if (!tickLog) return;
    const div = document.createElement("div");
    div.textContent = line;
    tickLog.prepend(div);
    while (tickLog.children.length > 10) tickLog.lastChild.remove();
  }

  function rippleTimeToIso(rt) {
    return new Date((rt + 946684800) * 1000).toISOString();
  }

  function pushLedgerBlock(info) {
    if (!rail) return;
    recentLedgers.unshift(info);
    if (recentLedgers.length > 8) recentLedgers.pop();
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ledger-block";
    if (reduce) btn.style.animation = "none";
    btn.innerHTML = `<span class="lb-idx">#${escapeHtml(String(info.index))}</span>${escapeHtml(String(info.txns ?? "?"))} tx · fee ${escapeHtml(String(info.feeDrops ?? "?"))} drops`;
    btn.addEventListener("click", () => {
      $$(".ledger-block").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const box = $("#ledger-detail");
      box.hidden = false;
      $("#ledger-detail-title").textContent = "Ledger #" + info.index;
      $("#ledger-detail-body").textContent = `txns: ${info.txns ?? "—"}\nfee_base: ${info.feeDrops ?? "—"} drops\nclosed: ${info.when || "—"}\nsource: ${wsUrl} (read-only subscribe)`;
    });
    rail.prepend(btn);
    while (rail.children.length > 8) rail.lastChild.remove();
  }

  $$(".tick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".tick-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const key = btn.dataset.tick;
      const box = $("#ledger-detail");
      box.hidden = false;
      $("#ledger-detail-title").textContent = btn.querySelector(".tick-label")?.textContent || key;
      $("#ledger-detail-body").textContent = TICK_HELP[key] || "";
    });
  });

  function handleFeature(result) {
    const feats = result.features || result;
    const entries = Object.entries(feats).filter(([, v]) => v && typeof v === "object");
    const enabled = entries.filter(([, v]) => v.enabled).length;
    const pending = entries.filter(([, v]) => !v.enabled).length;
    animateCount($("#feat-enabled"), enabled);
    animateCount($("#feat-pending"), pending);
    renderAmendChips(entries);
    $("#feat-source").innerHTML = `Live via <code>feature</code> on <code>${escapeHtml(wsUrl)}</code> · ${enabled} enabled / ${pending} pending. Docs: <a href="https://xrpl.org/docs/concepts/consensus-protocol/amendments" rel="noopener" target="_blank">Amendments</a>.`;
  }

  function handleServerInfo(result) {
    const vl = result.info?.validated_ledger;
    if (!vl) return;
    $("#tick-ledger").textContent = String(vl.seq);
    $("#tick-fee").textContent = String(vl.base_fee_xrp);
    $("#tick-age").textContent = String(vl.age);
    net.ripple = 1;
  }

  function handleLedger(msg) {
    const idx = msg.ledger_index;
    const txns = msg.txn_count;
    const feeDrops = msg.fee_base;
    if (idx != null) $("#tick-ledger").textContent = String(idx);
    if (txns != null) $("#tick-txns").textContent = String(txns);
    if (feeDrops != null) $("#tick-fee").textContent = (feeDrops / 1e6).toString();
    if (msg.ledger_time != null) $("#tick-age").textContent = "0";
    const when = msg.ledger_time != null ? rippleTimeToIso(msg.ledger_time) : new Date().toISOString();
    logTick(`#${idx} · ${txns ?? "?"} tx · fee_base ${feeDrops} drops · ${when}`);
    pushLedgerBlock({ index: idx, txns, feeDrops, when });
    $("#tick-source").innerHTML = `Live subscribe <code>ledger</code> on <code>${escapeHtml(wsUrl)}</code> (read-only).`;
    net.ripple = 1;
    if (net.nodes.length) net.nodes[(Math.random() * net.nodes.length) | 0].glow = 1;
  }

  function connectWs(attempt = 0) {
    wsUrl = WS_URLS[attempt % WS_URLS.length];
    $("#tick-source").textContent = `Connecting to ${wsUrl}…`;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      $("#tick-source").textContent = "WebSocket unavailable in this browser context.";
      return;
    }
    const t = setTimeout(() => {
      try {
        ws.close();
      } catch (_) {}
    }, 12000);
    ws.addEventListener("open", () => {
      clearTimeout(t);
      ws.send(JSON.stringify({ id: 1, command: "server_info" }));
      ws.send(JSON.stringify({ id: 2, command: "feature" }));
      ws.send(JSON.stringify({ id: 3, command: "subscribe", streams: ["ledger"] }));
      ws.send(JSON.stringify({ id: 4, command: "ledger", ledger_index: "validated", transactions: true, expand: false }));
      $("#tick-source").textContent = `Connected to ${wsUrl}`;
    });
    ws.addEventListener("message", (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === "ledgerClosed") {
        handleLedger(msg);
        return;
      }
      if (msg.id === 1 && msg.status === "success") handleServerInfo(msg.result);
      if (msg.id === 2 && msg.status === "success") handleFeature(msg.result);
      if (msg.id === 4 && msg.status === "success") {
        const L = msg.result.ledger || {};
        const txs = L.transactions || [];
        $("#tick-txns").textContent = String(txs.length);
        if (msg.result.ledger_index) $("#tick-ledger").textContent = String(msg.result.ledger_index);
        logTick(`validated #${msg.result.ledger_index} · ${txs.length} tx · ${L.close_time_human || ""}`);
        pushLedgerBlock({
          index: msg.result.ledger_index,
          txns: txs.length,
          feeDrops: undefined,
          when: L.close_time_human || "",
        });
      }
    });
    ws.addEventListener("close", () => {
      $("#tick-source").textContent = `Disconnected from ${wsUrl}. Retrying…`;
      setTimeout(() => connectWs(attempt + 1), 4000);
    });
  }

  /* boot */
  loadValidators().then((r) => {
    window.__explainerStatus = Object.assign(window.__explainerStatus || {}, { validators: r });
  });
  connectWs(0);
  window.__explainerStatus = { boot: new Date().toISOString(), v: 2 };
})();
