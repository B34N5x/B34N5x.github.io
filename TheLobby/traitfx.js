// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// v16 shared 2D trait renderer for every arcade game. Traits travel only in the game URL (?tr=...&tier=...);
// nothing is stored. Only traits the worn NFT actually has are drawn; the chained laptop prop is opt-in per collection (none enabled).
export function traitsFromSpec(spec, collectionId) {
  if (!spec || spec.type === 'art') return null;
  const txt = JSON.stringify([spec.detected || [], spec.features || {}, spec.wearables || [], spec.matched || []]).toLowerCase();
  const t = [];
  if ((spec.features && spec.features.mask) || (spec.mask && spec.mask.coverage && spec.mask.coverage !== 'none')) t.push('mask');
  if (spec.features && spec.features.eyewear) t.push('shades');
  if (/teeth|grill|fang/.test(txt)) t.push('teeth');
  const held = JSON.stringify(spec.heldItems || []).toLowerCase();
  return { tr: t, tier: spec.tier || 'Common' };
}
export const toQuery = o => o && o.tr.length ? `tr=${o.tr.join(',')}&tier=${encodeURIComponent(o.tier)}` : '';
export function fromQuery(qs = new URLSearchParams(location.search)) {
  const tr = (qs.get('tr') || '').split(',').filter(x => ['mask', 'shades', 'teeth', 'laptop'].includes(x));
  const tier = (qs.get('tier') || 'Common').replace(/[^A-Za-z]/g, '').slice(0, 12);
  return { tr, tier, has: k => tr.includes(k), glow: ['Rare', 'Legendary'].includes(tier) };
}
// Draw traits on a head centred at (cx,cy) with radius r, facing +x. clock drives the glow pulse.
export function drawHeadTraits(g, T, cx, cy, r, clock = 0) {
  if (!T || !T.tr.length) return;
  g.save();
  if (T.has('mask')) { g.fillStyle = '#111827'; g.beginPath(); g.ellipse(cx + r * 0.15, cy - r * 0.18, r * 0.95, r * 0.32, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx + r * 0.45, cy - r * 0.2, r * 0.18, r * 0.12, 0, 0, 7); g.fill(); }
  if (T.has('shades')) { g.fillStyle = '#05060a'; g.fillRect(cx - r * 0.1, cy - r * 0.3, r * 0.9, r * 0.25); }
  if (T.has('teeth')) { const pulse = 0.6 + 0.4 * Math.sin(clock * 6);
    if (T.glow) { g.shadowColor = '#fff6a8'; g.shadowBlur = r * 0.9 * pulse; }
    g.fillStyle = T.glow ? '#fffbe0' : '#e8e8e8'; g.fillRect(cx + r * 0.15, cy + r * 0.3, r * 0.6, r * 0.18);
    g.shadowBlur = 0; g.strokeStyle = '#999'; g.lineWidth = 1; for (let i = 1; i < 4; i++) { const x = cx + r * 0.15 + i * r * 0.15; g.beginPath(); g.moveTo(x, cy + r * 0.3); g.lineTo(x, cy + r * 0.48); g.stroke(); } }
  g.restore();
}
export function drawLaptop(g, T, x, y, s) { // chained laptop prop (unused by default)
  if (!T || !T.has('laptop')) return; g.save(); g.fillStyle = '#9aa0a8'; g.fillRect(x, y, 26 * s, 17 * s); g.fillStyle = '#22f0ff'; g.fillRect(x + 2 * s, y + 2 * s, 22 * s, 12 * s);
  g.strokeStyle = '#d0d4da'; g.lineWidth = 2 * s; g.setLineDash([3 * s, 2 * s]); g.beginPath(); g.moveTo(x, y + 8 * s); g.lineTo(x - 18 * s, y - 10 * s); g.stroke(); g.restore(); }
// Tier aura ring for small sprites (shooter etc.)
export function drawAura(g, T, x, y, r, clock = 0) { if (!T || !T.glow) return; g.save(); g.strokeStyle = T.tier === 'Legendary' ? '#ffd23d' : '#7dffa0'; g.shadowColor = g.strokeStyle; g.shadowBlur = 16; g.lineWidth = 2; g.globalAlpha = 0.5 + 0.3 * Math.sin(clock * 4); g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.restore(); }
