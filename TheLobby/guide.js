// v29: beginner "How it works" walkthrough. Once per session (sessionStorage 'guideSeen' only), reopen via ? Guide.
// NFT demo is a mock (sample address/tiles only). Whole card is draggable (no Drag button); position persists in localStorage (coords only).
const $ = id => document.getElementById(id);
const STEPS = [
  { t: 'Use your NFT as a skin', b: 'Tap the glowing "Sign in with Xaman" button and type an XRPL wallet address. We only look, nothing is saved.', el: 'walletBtn', mock: 'addr' },
  { t: 'Wait for the search', b: 'Wait a few seconds while the lookup checks Mainnet and Testnet.', el: 'walletBtn', mock: 'wait' },
  { t: 'Open Skin', b: 'Tap the glowing Skin button.', el: 'skintag' },
  { t: 'Pick My NFTs', b: 'Choose "My NFTs" in the list.', el: 'skintag', mock: 'mine' },
  { t: 'Tap an NFT', b: 'Pick a tile and your avatar changes to that NFT.', el: 'skintag', mock: 'tiles' },
  { t: 'Your screen', b: '→ View (V) / Settings ▸ Camera view: switch camera.\n→ ⚙ Settings ▸ Toggle HUD (or M): hide the chrome.\n→ ⚙ Settings: Fullscreen.', els: ['hmenu', 'hmS', 'hmHud'] },
  { t: 'PETAL & PIXEL', b: 'Gallery and florist. Browse NFT art on the walls and the easel outside.' },
  { t: 'LEDGER ARCADE', b: 'Play arcade cabinets like Vault Run. Earn tokens to unlock more.' },
  { t: 'Easter egg quest', b: 'Hidden eggs are scattered around the lobby. Keep your eyes open.' },
  { t: 'QUARANTINE ROOM', b: 'Visit to catch up on crypto and real-world news.' },
  { t: 'Many more....', b: 'Behind ESCROW PALACE…', arrow: [2.5, 1.6, 30.03] },
];
let box, i = 0, raf, hl;
const GUIDE_POS_KEY = 'lobbyGuidePos'; // localStorage: {left,top} only — no wallet/user data
/** @type {{left:number,top:number}|null} */
let guidePosMem = null;
function loadGuidePos() {
  try {
    const raw = localStorage.getItem(GUIDE_POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && Number.isFinite(p.left) && Number.isFinite(p.top)) return { left: +p.left, top: +p.top };
  } catch {}
  return null;
}
function saveGuidePos(p) {
  if (!p || !Number.isFinite(p.left) || !Number.isFinite(p.top)) return;
  guidePosMem = { left: p.left, top: p.top };
  try { localStorage.setItem(GUIDE_POS_KEY, JSON.stringify(guidePosMem)); } catch {}
}
guidePosMem = loadGuidePos();

function mockHTML(m) {
  if (m === 'addr') return '<div class="gmock">rSAMPLE…demo<span class="gcur">|</span></div>';
  if (m === 'wait') return '<div class="gmock"><span class="wspin"></span> Looking up…</div>';
  if (m === 'mine') return '<div class="gmock">Drop (default)<br><b>▸ My NFTs (3)</b></div>';
  if (m === 'tiles') return '<div class="gmock gtiles"><i></i><i class="on"></i><i></i></div>';
  return '';
}
function arrow(p) {
  const a = $('garrow'), cam = window.__camera; if (!a) return;
  let x = innerWidth / 2, y = innerHeight * 0.3, ang = -90;
  if (cam && window.THREE_V) { const v = new window.THREE_V(...p).project(cam); const beh = v.z > 1;
    let sx = (v.x * .5 + .5) * innerWidth, sy = (-v.y * .5 + .5) * innerHeight; if (beh) { sx = innerWidth - sx; sy = innerHeight - sy; }
    const cx = innerWidth / 2, cy = innerHeight / 2, m = 50, on = !beh && sx > m && sx < innerWidth - m && sy > m && sy < innerHeight - m;
    ang = Math.atan2(sy - cy, sx - cx) * 180 / Math.PI;
    if (on) { x = sx; y = sy - 40; ang = 90; } else { const k = Math.min((cx - m) / Math.abs(sx - cx || 1), (cy - m) / Math.abs(sy - cy || 1)); x = cx + (sx - cx) * k; y = cy + (sy - cy) * k; } }
  a.style.left = x + 'px'; a.style.top = y + 'px'; a.style.transform = `translate(-50%,-50%) rotate(${ang}deg)`;
  raf = requestAnimationFrame(() => arrow(p));
}
function safeInsets() {
  const cs = getComputedStyle(document.documentElement);
  const read = (name) => { try { const v = parseFloat(getComputedStyle(document.body).getPropertyValue(name)); return Number.isFinite(v) ? v : 0; } catch { return 0; } };
  // Use a probe if present (layout.js), else env() via temp el
  let t = 0, l = 0, r = 0, b = 0;
  const probe = document.getElementById('layprobe');
  if (probe) {
    const s = getComputedStyle(probe);
    t = parseFloat(s.top) || 0; l = parseFloat(s.left) || 0; r = parseFloat(s.right) || 0; b = parseFloat(s.bottom) || 0;
  }
  return { t, l, r, b };
}
function overlaps(a, b, g = 6) {
  return a.left < b.right + g && b.left < a.right + g && a.top < b.bottom + g && b.top < a.bottom + g;
}
/** Clamp card inside safe area and nudge off joystick / abilities / touch pad when dropped. */
function clampGuide(left, top) {
  if (!box) return { left, top };
  const m = 8, sa = safeInsets();
  const W = window.innerWidth, H = window.innerHeight;
  const w = box.offsetWidth || 320, h = box.offsetHeight || 180;
  let L = Math.max(m + sa.l, Math.min(left, W - w - m - sa.r));
  let T = Math.max(m + sa.t, Math.min(top, H - h - m - sa.b));
  const card = { left: L, top: T, right: L + w, bottom: T + h };
  const ids = ['abil', 'tpad', 'joy', 'tstick'];
  for (const id of ids) {
    const el = $(id);
    if (!el || getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none') continue; // fixed HUD has null offsetParent
    const raw = el.getBoundingClientRect();
    if (!raw.width || !raw.height) continue;
    // Pad joy/tpad so the card never sits on the thumb zone
    const pad = (id === 'joy' || id === 'tstick' || id === 'tpad') ? 18 : 6;
    const o = { left: raw.left - pad, top: raw.top - pad, right: raw.right + pad, bottom: raw.bottom + pad };
    if (!overlaps(card, o)) continue;
    const above = o.top - h - m;
    if (above >= m + sa.t) { T = above; card.top = T; card.bottom = T + h; }
    else if (o.left - w - m >= m + sa.l) { L = o.left - w - m; card.left = L; card.right = L + w; }
    else if (o.right + m + w <= W - m - sa.r) { L = o.right + m; card.left = L; card.right = L + w; }
    else { T = Math.max(m + sa.t, Math.min(T, o.top - h - m)); card.top = T; card.bottom = T + h; }
  }
  L = Math.max(m + sa.l, Math.min(L, W - w - m - sa.r));
  T = Math.max(m + sa.t, Math.min(T, H - h - m - sa.b));
  return { left: L, top: T };
}
function applyGuidePos(p) {
  if (!box || !p) return;
  box.style.left = p.left + 'px';
  box.style.top = p.top + 'px';
  box.style.right = 'auto';
  box.style.bottom = 'auto';
  box.style.transform = 'none';
}
function enableDrag(el) {
  // Subtle grab cue only (no "Drag" button) — whole tile is the handle.
  const handle = document.createElement('div');
  handle.className = 'ghandle';
  handle.setAttribute('aria-hidden', 'true');
  handle.innerHTML = '<i></i><i></i><i></i>';
  el.insertBefore(handle, el.firstChild);

  const THRESH = 8; // px — tap vs drag so Next/Back/Skip still click
  let dragging = false, armed = false, sx = 0, sy = 0, ox = 0, oy = 0, pid = null, moved = false;

  const isChrome = (t) => !!(t && t.closest && t.closest('.gnav button, button, a, input, select, textarea, label'));

  const onDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    if (isChrome(e.target)) return; // let buttons receive the click
    armed = true; dragging = false; moved = false; pid = e.pointerId;
    const r = el.getBoundingClientRect();
    sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
    try { el.setPointerCapture(pid); } catch {}
    e.stopPropagation(); // never steal for camera/joy; don't preventDefault yet (preserve button taps)
  };
  const onMove = (e) => {
    if (!armed || (pid != null && e.pointerId !== pid)) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!dragging) {
      if (dx * dx + dy * dy < THRESH * THRESH) return;
      dragging = true; moved = true;
      applyGuidePos({ left: ox, top: oy });
      el.classList.add('dragging');
    }
    const m = 8, sa = safeInsets(), W = innerWidth, H = innerHeight;
    const w = el.offsetWidth, h = el.offsetHeight;
    const L = Math.max(m + sa.l, Math.min(ox + dx, W - w - m - sa.r));
    const T = Math.max(m + sa.t, Math.min(oy + dy, H - h - m - sa.b));
    applyGuidePos({ left: L, top: T });
    e.preventDefault(); e.stopPropagation();
  };
  const onUp = (e) => {
    if (!armed || (pid != null && e.pointerId !== pid)) return;
    armed = false;
    try { el.releasePointerCapture(pid); } catch {}
    pid = null;
    if (dragging) {
      dragging = false;
      el.classList.remove('dragging');
      const r = el.getBoundingClientRect();
      const p = clampGuide(r.left, r.top);
      applyGuidePos(p);
      saveGuidePos(p);
      e.preventDefault(); e.stopPropagation();
    }
    // if !moved: leave the event alone so button onclick can fire
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  // Block joy/camera from eating card gestures (buttons still get their own clicks)
  ['touchstart', 'touchmove'].forEach(t => {
    el.addEventListener(t, ev => { if (!isChrome(ev.target)) ev.stopPropagation(); }, { passive: false });
  });
  const onResize = () => {
    if (!box) return;
    const r = box.getBoundingClientRect();
    const p = clampGuide(r.left, r.top);
    applyGuidePos(p);
    if (guidePosMem) saveGuidePos(p);
  };
  addEventListener('resize', onResize);
  addEventListener('orientationchange', onResize);
  // Expose for tests
  window.__guidePos = () => guidePosMem ? { ...guidePosMem } : null;
  window.__guidePosClear = () => { guidePosMem = null; try { localStorage.removeItem(GUIDE_POS_KEY); } catch {} };
  window.__guideClamp = () => { if (!box) return null; const r = box.getBoundingClientRect(); const p = clampGuide(r.left, r.top); applyGuidePos(p); saveGuidePos(p); return p; };
}

function show() {
  cancelAnimationFrame(raf); document.querySelectorAll('.ghl').forEach(e => e.classList.remove('ghl')); $('garrow')?.remove();
  const s = STEPS[i]; hl = s.el && $(s.el); hl && hl.classList.add('ghl'); (s.els || []).forEach(id => $(id)?.classList.add('ghl'));
  box.querySelector('.gbody').innerHTML = ''; const c = document.createElement('small'); c.className = 'gcount'; c.textContent = `${i + 1}/${STEPS.length}`; const h = document.createElement('h3'); h.textContent = s.t; const p = document.createElement('p'); p.textContent = s.b; p.style.whiteSpace = 'pre-line';
  const gb = box.querySelector('.gbody'); gb.classList.remove('gin'); void gb.offsetWidth; gb.classList.add('gin'); gb.append(c, h, p); box.querySelector('.gbody').insertAdjacentHTML('beforeend', mockHTML(s.mock));
  box.querySelector('#gback').disabled = i === 0; box.querySelector('#gnext').textContent = i === STEPS.length - 1 ? 'Done' : 'Next ›';
  if (s.arrow) { const a = document.createElement('div'); a.id = 'garrow'; a.textContent = '➜'; document.body.append(a); arrow(s.arrow); }
  box.dataset.step = i;
}
function close() { cancelAnimationFrame(raf); document.querySelectorAll('.ghl').forEach(e => e.classList.remove('ghl')); $('garrow')?.remove(); box?.remove(); box = null; try { sessionStorage.setItem('guideSeen', '1'); } catch {} }
export function openGuide(start = 0) {
  if (box) close(); i = start;
  box = document.createElement('div'); box.id = 'hguide'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'How it works');
  box.innerHTML = '<div class="gbody"></div><div class="gnav"><button type="button" id="gback">‹ Back</button><button type="button" id="gskip">Skip</button><button type="button" id="gnext">Next ›</button></div>';
  document.body.append(box);
  enableDrag(box);
  const placeInitial = () => {
    if (!box) return;
    const touch = document.body.classList.contains('touch') || document.documentElement.classList.contains('lay-touch') || matchMedia('(pointer:coarse)').matches;
    const overlapsCtrl = () => {
      for (const id of ['joy', 'tpad', 'abil', 'tstick']) {
        const el = document.getElementById(id);
        if (!el || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden') continue;
        const a = el.getBoundingClientRect(), g = box.getBoundingClientRect();
        if (!a.width || !a.height) continue;
        if (g.left < a.right && g.right > a.left && g.top < a.bottom && g.bottom > a.top) return true;
      }
      return false;
    };
    if (guidePosMem) {
      // Exact session restore; only re-clamp if a control now overlaps (orientation/HUD change)
      applyGuidePos(guidePosMem);
      if (overlapsCtrl()) {
        const p = clampGuide(guidePosMem.left, guidePosMem.top);
        applyGuidePos(p); saveGuidePos(p);
      }
      return;
    }
    const r = box.getBoundingClientRect();
    let left = r.left, top = r.top;
    if (touch) {
      // Upper-middle: keep thumbs clear of joy / jump / abilities
      left = Math.max(8, (innerWidth - r.width) / 2);
      top = Math.max(8, Math.min(innerHeight * 0.14, Math.max(8, innerHeight - r.height - 200)));
    }
    const p = clampGuide(left, top);
    applyGuidePos(p);
    // Do NOT write guidePosMem here — memory is session-drag only so a bad
    // first-run layout (before touch HUD) cannot poison later opens.
    // If still overlapping joy (late layout), shove to top center once more
    const joy = document.getElementById('joy');
    if (joy && getComputedStyle(joy).display !== 'none') {
      const a = joy.getBoundingClientRect(), g = box.getBoundingClientRect();
      if (g.left < a.right && g.right > a.left && g.top < a.bottom && g.bottom > a.top) {
        const p2 = clampGuide(Math.max(8, (innerWidth - g.width) / 2), 8);
        applyGuidePos(p2);
      }
    }
  };
  if (guidePosMem) {
    // Sync restore so reopen is instant and tests/players see the saved spot immediately
    applyGuidePos(guidePosMem);
  }
  // Two rAFs so first-run touch HUD / joy have laid out before we clamp
  requestAnimationFrame(() => requestAnimationFrame(placeInitial));
  box.querySelector('#gback').onclick = () => { if (i > 0) { i--; show(); } };
  box.querySelector('#gnext').onclick = () => { if (i < STEPS.length - 1) { i++; show(); } else close(); };
  box.querySelector('#gskip').onclick = close; show();
}
window.__guide = openGuide;
function addBtn() { const bar = $('hmenu'); if (!bar || $('hmG')) return !!bar; const b = document.createElement('button'); b.type = 'button'; b.id = 'hmG'; b.setAttribute('aria-label', 'How it works'); b.innerHTML = '?<span class="lbl"> Guide</span>'; b.onclick = () => openGuide(); bar.append(b); return true; }
let seen = false; try { seen = sessionStorage.getItem('guideSeen') === '1'; } catch {}
const t = setInterval(() => { const ok = addBtn(); const ov = $('overlay'); if (ok && !$('intro') && (!ov || ov.hidden || getComputedStyle(ov).display === 'none' || !ov.offsetParent)) { clearInterval(t); if (!seen && !/[?&]noguide/.test(location.search)) setTimeout(() => openGuide(), 600); } }, 300);
