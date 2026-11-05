// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// v15b adaptive layout. Uses ONLY standard viewport info: visualViewport size, orientation, pointer/hover media,
// env(safe-area-inset-*) (read via a probe element), fullscreen state, devicePixelRatio (to snap sizes to device pixels).
// No device/UA detection, no permissions, nothing stored or sent. Re-runs on resize / orientationchange / fullscreenchange.
const $ = id => document.getElementById(id);
const mm = q => matchMedia(q).matches;
const probe = Object.assign(document.createElement('div'), { id: 'layprobe' });
probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;top:env(safe-area-inset-top);left:env(safe-area-inset-left);right:env(safe-area-inset-right);bottom:env(safe-area-inset-bottom)';
document.body.append(probe);
const set = (el, k, v) => el && el.style.setProperty(k, v, 'important');
const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return r.width && r.height && getComputedStyle(el).visibility !== 'hidden' ? r : null; };
const hit = (a, b, g = 4) => a && b && a.left < b.right + g && b.left < a.right + g && a.top < b.bottom + g && b.top < a.bottom + g;
export function layout() {
  const vv = window.visualViewport, W = vv ? vv.width : innerWidth, H = vv ? vv.height : innerHeight, dpr = devicePixelRatio || 1;
  const px = v => Math.round(v * dpr) / dpr + 'px', land = W > H, coarse = mm('(pointer: coarse)') || !mm('(hover: hover)');
  const fs = !!(document.fullscreenElement || document.webkitFullscreenElement) || mm('(display-mode: fullscreen)');
  const sa = getComputedStyle(probe), inset = { t: parseFloat(sa.top) || 0, l: parseFloat(sa.left) || 0, r: parseFloat(sa.right) || 0, b: parseFloat(sa.bottom) || 0 };
  const m = 10, short = Math.min(W, H), root = document.documentElement;
  root.classList.toggle('lay-land', land); root.classList.toggle('lay-port', !land); root.classList.toggle('lay-touch', coarse); root.classList.toggle('lay-fs', fs);
  // controls scale with the short side; landscape phones get a bit smaller so the scene stays visible
  const k = Math.max(0.62, Math.min(1, short / (land ? 520 : 470)));
  const stick = $('tstick'), pad = $('tpad'), hub = $('hub');
  if (stick) { set(stick, 'width', px(150 * k)); set(stick, 'height', px(150 * k)); set(stick, 'left', px(m + inset.l)); set(stick, 'bottom', px(m + inset.b + (land ? 0 : 54))); set(stick, 'top', 'auto'); }
  if (pad) { set(pad, 'transform', `scale(${k.toFixed(3)})`); set(pad, 'transform-origin', 'bottom right'); set(pad, 'right', px(m + inset.r)); set(pad, 'bottom', px(m + inset.b + (land ? 0 : 54))); set(pad, 'top', 'auto'); set(pad, 'left', 'auto'); }
  let hk = Math.max(0.5, Math.min(1, short / (land ? 640 : 560))), hk0 = 1;
  if (hub && pad && box(pad)) { const hh = hub.offsetHeight || 1, pt = box(pad).top; hk0 = Math.min(1, (pt - 8 - (m + inset.t + 56)) / hh); }
  if (hub) { root.style.setProperty('--hk', Math.min(hk, hk0).toFixed(3)); set(hub, 'zoom', '1'); set(hub, 'transform', `scale(${Math.min(hk, hk0).toFixed(3)})`); set(hub, 'transform-origin', 'top right'); set(hub, 'right', px(m + inset.r)); set(hub, 'top', px(m + inset.t + 56)); }
  // movable items: first free candidate slot, checked against everything already placed
  const fixedIds = ['joy', 'tstick', 'tpad', 'hub', 'hud', 'skintag', 'texit', 'view', 'aura'];
  const taken = () => fixedIds.map(i => box($(i))).filter(Boolean);
  const place = (el, slots) => { if (!el || !box(el)) return; for (const [l, t] of slots) { set(el, 'left', px(l)); set(el, 'top', px(t)); set(el, 'right', 'auto'); set(el, 'bottom', 'auto'); set(el, 'transform', 'none');
      const r = box(el); if (r && r.right <= W - inset.r && r.bottom <= H - inset.b && !taken().some(o => hit(r, o))) return; } };
  const top = m + inset.t;
  const tb = $('tnbadge'); if (tb && box(tb)) { const w = box(tb).width; place(tb, [[W / 2 - w / 2, top], [W / 2 - w / 2, top + 40], [m + inset.l, top + 84], [m + inset.l, top + 120], [m + inset.l, top + 160]]); fixedIds.push('tnbadge'); }
  const wb = $('wallet'); if (wb && box(wb)) { const w = box(wb).width; const pads = [box(stick), box($('joy')), box(pad)].filter(Boolean); const hi = pads.length ? Math.min(...pads.map(r => r.top)) : H;
    /* v31: wallet pinned top-right by CSS (neon.css); not moved here */ void w; void hi;
    fixedIds.push('wallet'); }
  // v4 invite bar zone: above the wallet / pads, never under them
  const rb = $('roombar'); if (rb && box(rb)) { const r0 = box(rb), w = r0.width, h = r0.height, wr = box(wb); const pads = [box(stick), box($('joy')), box(pad)].filter(Boolean); const hi = pads.length ? Math.min(...pads.map(r => r.top)) : H - inset.b;
    const yw = wr ? wr.top - 8 - h : H - inset.b - m - h; place(rb, [[W / 2 - w / 2, H - inset.b - m - h], [W / 2 - w / 2, yw], [W / 2 - w / 2, Math.min(yw, hi - 8 - h)], [W / 2 - w / 2, hi - 52 - h], [m + inset.l, H / 2 - h / 2], [m + inset.l, top + 170], [W / 2 - w / 2, top + 80]]); fixedIds.push('roombar'); }
  const rc = $('roomchat'), rcb = box(rc), rbb = box(rb); if (rcb && rbb && hit(rcb, rbb, 0)) { set(rc, 'top', 'auto'); set(rc, 'bottom', px(H - rbb.top + 8)); }
  const sp = $('skinpanel'); if (sp) { const lowTop = Math.min(H - inset.b, ...[box(stick), box(pad)].filter(Boolean).map(r => r.top));
    set(sp, 'top', px(top + 38)); set(sp, 'left', px(m + inset.l)); set(sp, 'max-width', px(Math.min(360, W - 2 * m - inset.l - inset.r)));
    set(sp, 'max-height', px(Math.max(160, (land ? H - inset.b - m : lowTop - 8) - (top + 38)))); set(sp, 'z-index', '30'); }
}
let q = 0; const later = () => { cancelAnimationFrame(q); q = requestAnimationFrame(() => requestAnimationFrame(layout)); };
['resize', 'orientationchange', 'fullscreenchange', 'webkitfullscreenchange'].forEach(e => addEventListener(e, later));
document.addEventListener('fullscreenchange', later); if (window.visualViewport) visualViewport.addEventListener('resize', later);
new MutationObserver(later).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] }); later(); setTimeout(later, 1500);
window.__layout = layout;
