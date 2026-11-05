// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
const P1N = ((new URLSearchParams(location.search).get('nft') || 'XRP').replace(/[<>]/g, '').slice(0, 24)).toUpperCase();
addEventListener('DOMContentLoaded', () => { const e = document.getElementById('n1'); if (e) e.textContent = P1N + ' (you)'; });
// Escrow Clash - original game code (MIT). Fighters are ORIGINAL limb-rigged characters drawn in code
// (separate torso/arm/leg segments animated with keyframes) - no sprites, no commercial likeness.
// SFX: Kenney Impact Sounds + Digital Audio (CC0). Stage is drawn procedurally (original).
import { fromQuery, drawHeadTraits, drawLaptop } from '../traitfx.js';
const TR = fromQuery(); // v16: worn NFT traits from the URL only (nothing stored)
import { submitScore, qualifies, top, RULES, lastBlockReason } from '../arcade.js';
const cv = document.getElementById('game'), g = cv.getContext('2d'), $ = id => document.getElementById(id);
const A = '../assets/kenney/';
const snd = n => () => { const a = new Audio(A + 'sfx/' + n + '.ogg'); a.volume = 0.4; a.play().catch(() => {}); };
const S = { punch: snd('impactPunch_medium_000'), kick: snd('impactPunch_heavy_001'), block: snd('impactGeneric_light_002'), sp: snd('phaserUp3'), ko: snd('lowDown'), win: snd('jingles_NES03') };
let W, H, GY; const fit = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; GY = H * 0.8; }; addEventListener('resize', fit); fit();
const keys = {}; addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (!keys[k]) keys[k] = 2; if (k === 'escape') {
  if (new URLSearchParams(location.search).get('embed') || window.parent !== window) { try { parent.postMessage({ type: 'lobby-back' }, '*'); } catch (_) {} return; }
  location.href = '../index.html?spawn=fighter';
}});
addEventListener('keyup', e => keys[e.key.toLowerCase()] = 0);
const MOVES = { punch: { t: 0.3, hit: [0.1, 0.18], dmg: 6, reach: 120, h: 'mid' }, kick: { t: 0.48, hit: [0.16, 0.3], dmg: 10, reach: 150, h: 'low' } };
function mk(id, x, dir, col) { return { id, x, y: 0, vy: 0, dir, col, hp: 100, act: null, at: 0, stun: 0, block: false, crouch: false, spCd: 0, dash: 0, meter: 0, wins: 0, walk: 0, hitDone: false }; }
let P1, P2, shots, sparks, pows = [], papers = [], spec = null, timer, round, state = 'menu', callT = 0, shake = 0;
function newRound() { P1.x = W * 0.3; P2.x = W * 0.7; [P1, P2].forEach(f => Object.assign(f, { y: 0, vy: 0, hp: 100, act: null, stun: 0, spCd: 0, dash: 0 })); shots = []; sparks = []; pows = []; papers = []; spec = null; timer = 60; state = 'call'; callT = 1.4; call(`ROUND ${round}`); }
function call(t) { $('call').textContent = t; }
$('play').onclick = start;
function start() { P1 = mk('node', W * 0.3, 1, '#22f0ff'); P2 = mk('volt', W * 0.7, -1, '#ff3df0'); round = 1; dealt = 0; $('ent').classList.add('hidden'); $('panel').classList.add('hidden'); newRound(); }
function spark(x, y, c, n = 14) { for (let i = 0; i < n; i++) { const a = Math.random() * 7, s = 120 + Math.random() * 380; sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 0.35, c }); } }
let dealt = 0;
function doHit(att, def, dmg, kind) {
  if (att === P1) dealt += dmg;
  const y = GY - def.y - 110;
  if (def.block && def.dir === -att.dir) { def.hp -= dmg * 0.15; def.x += att.dir * 14; S.block(); spark(def.x - att.dir * 30, y, '#ffffff', 6); return; }
  att.meter = Math.min(100, att.meter + dmg * 1.6); def.meter = Math.min(100, def.meter + dmg * 0.8);
  pows.push({ x: def.x - att.dir * 30, y: y - 30, l: 0.6, w: ['POW!', 'BAM!', 'WHAM!', 'BIFF!'][Math.floor(Math.random() * 4)], r: (Math.random() - 0.5) * 0.5 });
  def.hp -= dmg; def.stun = 0.3; def.act = null; def.x += att.dir * (kind === 'kick' ? 40 : 24); shake = 0.15;
  (kind === 'kick' ? S.kick : S.punch)(); spark(def.x - att.dir * 30, y, att.col, 18); spark(def.x - att.dir * 30, y, '#ffd23d', 8);
}
function control(f, inp, dt) {
  f.spCd -= dt; f.block = false;
  if (f.stun > 0) { f.stun -= dt; return; }
  const onG = f.y <= 0;
  f.crouch = onG && inp.down && !f.act; f.block = inp.block && onG && !f.act;
  if (!f.act && !f.block && !f.crouch && f.dash <= 0) { const mv = (inp.right ? 1 : 0) - (inp.left ? 1 : 0); f.x += mv * 260 * dt; f.walk += Math.abs(mv) * dt; f.moving = mv !== 0; } else f.moving = false;
  if (inp.jump && onG && !f.act) f.vy = 720;
  if (!f.act && !f.block) { if (inp.punch) start2(f, 'punch'); else if (inp.kick) start2(f, 'kick');
    else if (inp.special && f.id === 'volt' && f.meter >= 100 && !spec) { f.meter = 0; spec = { f, t: 0, thrown: false }; S.sp(); }
    else if (inp.special && f.spCd <= 0) { f.spCd = 2.5; S.sp(); if (f.id === 'node') shots.push({ x: f.x + f.dir * 50, y: GY - f.y - 120, dir: f.dir, o: f }); else { f.dash = 0.32; f.hitDone = false; } } }
}
function start2(f, m) { f.act = m; f.at = 0; f.hitDone = false; }
function phys(f, o, dt) {
  f.vy -= 2000 * dt; f.y = Math.max(0, f.y + f.vy * dt); if (f.y === 0) f.vy = Math.max(0, f.vy);
  if (f.dash > 0) { f.dash -= dt; f.x += f.dir * 900 * dt; if (!f.hitDone && Math.abs(f.x - o.x) < 80) { f.hitDone = true; doHit(f, o, 14, 'kick'); f.dash = 0; } }
  if (f.act) { const M = MOVES[f.act]; f.at += dt;
    if (!f.hitDone && f.at > M.hit[0] && f.at < M.hit[1] && Math.abs(f.x - o.x) < M.reach && Math.abs(f.y - o.y) < 120) {
      f.hitDone = true; if (M.h === 'mid' && o.crouch) {} else doHit(f, o, M.dmg, f.act); }
    if (f.at > M.t) f.act = null; }
  f.x = Math.max(60, Math.min(W - 60, f.x));
  if (!f.dash && Math.abs(f.x - o.x) < 60 && f.y < 40 && o.y < 40) { const s = f.x < o.x ? -1 : 1; f.x += s * 2; }
  if (f.y === 0 && !f.act && !f.dash) f.dir = o.x > f.x ? 1 : -1;
}
let ai = { t: 0, plan: {} };
function cpu(dt) { ai.t -= dt; const d = Math.abs(P1.x - P2.x), toward = P1.x > P2.x;
  if (ai.t <= 0) { ai.t = 0.18 + Math.random() * 0.25; const r = Math.random(), p = {};
    if (P1.act && d < 140 && r < 0.45) p.block = 1;
    else if (d > 170) { p[toward ? 'right' : 'left'] = 1; if (r < 0.08 || P2.meter >= 100) p.special = 1; if (r > 0.95) p.jump = 1; }
    else if (r < 0.4) p.punch = 1; else if (r < 0.65) p.kick = 1; else if (r < 0.75) p[toward ? 'left' : 'right'] = 1; else if (r < 0.82) p.down = 1; else if (r < 0.86) p.special = 1;
    ai.plan = p; } const p = ai.plan; ai.plan = { block: p.block, left: p.left, right: p.right, down: p.down }; return p; }
const p1in = () => ({ left: keys.a || keys.arrowleft, right: keys.d || keys.arrowright, jump: keys.w === 2 || keys.arrowup === 2, down: keys.s || keys.arrowdown,
  punch: keys.j === 2, kick: keys.k === 2, block: keys.l, special: keys.u === 2 });
// ---- original neon stage (drawn once per resize) ----
let stage, stW = 0;
function buildStage() { stage = document.createElement('canvas'); stage.width = W; stage.height = H; stW = W; const s = stage.getContext('2d');
  const sky = s.createLinearGradient(0, 0, 0, GY); sky.addColorStop(0, '#120634'); sky.addColorStop(0.7, '#3a0f5a'); sky.addColorStop(1, '#ff3d8a'); s.fillStyle = sky; s.fillRect(0, 0, W, GY);
  s.fillStyle = '#ffd23d'; s.globalAlpha = 0.25; s.beginPath(); s.arc(W / 2, GY * 0.62, H * 0.2, 0, 7); s.fill(); s.globalAlpha = 1;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const [layer, col, hmax] of [[0, '#1c0b3a', 0.55], [1, '#0d0620', 0.4]]) for (let x = 0; x < W; ) { const w = 40 + rnd() * 90, h = GY * (0.15 + rnd() * hmax);
    s.fillStyle = col; s.fillRect(x, GY - h, w, h);
    for (let wy = GY - h + 10; wy < GY - 10; wy += 16) for (let wx = x + 6; wx < x + w - 8; wx += 14) if (rnd() < (layer ? 0.35 : 0.18)) { s.fillStyle = ['#ffcf7a', '#22f0ff', '#ff3df0'][(rnd() * 3) | 0]; s.globalAlpha = 0.7; s.fillRect(wx, wy, 6, 8); s.globalAlpha = 1; }
    x += w + 4; }
  s.font = `bold ${Math.round(Math.min(34, W / 24))}px system-ui`; s.textAlign = 'center'; s.shadowBlur = 18; [['XRP', '#22f0ff', 0.2], ['THE REGULATOR', '#ff3df0', 0.8], ['VS', '#ffd23d', 0.5]].forEach(([t, c, fx]) => { s.shadowColor = c; s.fillStyle = c; s.fillText(t, W * fx, GY * 0.38); }); s.shadowBlur = 0;
  const fl = s.createLinearGradient(0, GY, 0, H); fl.addColorStop(0, '#2a0f48'); fl.addColorStop(1, '#07031a'); s.fillStyle = fl; s.fillRect(0, GY, W, H - GY);
  s.strokeStyle = '#22f0ff55'; s.lineWidth = 1; for (let i = -20; i <= 20; i++) { s.beginPath(); s.moveTo(W / 2 + i * 40, GY); s.lineTo(W / 2 + i * 200, H); s.stroke(); }
  for (let y = GY; y < H; y += (y - GY) * 0.25 + 6) { s.beginPath(); s.moveTo(0, y); s.lineTo(W, y); s.stroke(); }
  s.fillStyle = '#ff3df0'; s.shadowColor = '#ff3df0'; s.shadowBlur = 16; s.fillRect(0, GY - 2, W, 3); s.shadowBlur = 0; }
let clock = 0;
// ---- skeletal rig: angles in radians from straight down, + = toward the facing side ----
const BONES = { head: 17, neck: 10, torso: 74, ua: 40, fa: 38, th: 52, sh: 52 };
const GUARD = { lean: 0.1, head: 0, ua1: 0.55, fa1: 2.1, ua2: 0.25, fa2: 2.3, th1: 0.32, sh1: -0.35, th2: -0.28, sh2: -0.12 };
const KF = {
  punch: [[0, GUARD], [0.35, { lean: 0.28, ua1: 1.55, fa1: 0.05, th1: 0.45, sh1: -0.4 }], [1, GUARD]],
  kick: [[0, GUARD], [0.3, { lean: -0.15, th1: 1.3, sh1: -1.6 }], [0.5, { lean: -0.3, th1: 1.6, sh1: -0.05, ua1: 0.9, fa1: 1.6, th2: 0.05, sh2: 0 }], [1, GUARD]],
  hurt: [[0, GUARD], [0.3, { lean: -0.45, head: -0.4, ua1: -0.2, fa1: 0.9, ua2: -0.4, fa2: 0.8 }], [1, { lean: -0.2, head: -0.1 }]],
};
const BLOCK = { lean: -0.04, ua1: 0.95, fa1: 2.5, ua2: 0.85, fa2: 2.55, head: 0.15 };
const CROUCH = { lean: 0.35, th1: 1.35, sh1: -2.3, th2: 0.7, sh2: -2.1, ua1: 0.7, fa1: 2.2 };
const JUMP = { lean: 0.05, th1: 1.0, sh1: -1.8, th2: 0.35, sh2: -1.5, ua1: 0.9, fa1: 1.9 };
const mix = (a, b, t) => { const o = { ...a }; for (const k in b) o[k] = (a[k] ?? GUARD[k]) + ((b[k]) - (a[k] ?? GUARD[k])) * t; return o; };
const ease = t => t * t * (3 - 2 * t);
function track(kf, t) { for (let i = 1; i < kf.length; i++) if (t <= kf[i][0]) { const [t0, p0] = kf[i - 1], [t1, p1] = kf[i]; return mix({ ...GUARD, ...p0 }, p1, ease((t - t0) / (t1 - t0))); } return { ...GUARD, ...kf[kf.length - 1][1] }; }
function pose(f) {
  if ((state === 'over' || state === 'rest') && f.hp <= 0) { f.koT = Math.min(1, (f.koT || 0) + 1 / 40); return { ...mix(GUARD, KF.hurt[1][1], 1), ko: f.koT }; }
  f.koT = 0;
  if (spec && spec.f === f && !spec.thrown) return { ...GUARD, ua1: Math.PI - 0.35, fa1: 0.2, ua2: Math.PI + 0.35, fa2: -0.2, lean: -0.05, head: -0.3, papers: 1 };
  if (f.stun > 0) return track(KF.hurt, 1 - f.stun / 0.3);
  if (f.dash > 0) return { ...KF.punch[1][1], ...GUARD, lean: 0.45, ua1: 1.6, fa1: 0, ua2: 1.4, fa2: 0.1, th2: -0.7, sh2: -0.4 };
  if (f.act) return track(KF[f.act], Math.min(1, f.at / MOVES[f.act].t));
  if (f.block) return mix(GUARD, BLOCK, 1);
  if (f.y > 0) return mix(GUARD, JUMP, 1);
  if (f.crouch) return mix(GUARD, CROUCH, 1);
  if (f.moving) { const w = f.walk * 9; return { ...GUARD, th1: 0.3 + Math.sin(w) * 0.42, sh1: -0.3 - Math.max(0, -Math.cos(w)) * 0.7, th2: -0.2 - Math.sin(w) * 0.42, sh2: -0.2 - Math.max(0, Math.cos(w)) * 0.7, lean: 0.14, ua2: 0.25 + Math.sin(w) * 0.25 }; }
  const b = Math.sin(clock * 3.2); return { ...GUARD, ua1: GUARD.ua1 + b * 0.05, fa1: GUARD.fa1 + b * 0.06, lean: GUARD.lean + b * 0.02, bob: b * 3 };
}
const dirv = a => [Math.sin(a), Math.cos(a)];
const LOOK = { node: { suit: '#1e8fa8', suit2: '#14606f', trim: '#22f0ff', skin: '#c98a62', hair: '#1a1410', pants: '#20263a', band: '#22f0ff' },
               volt: { suit: '#2e3340', suit2: '#1f232c', trim: '#ff3df0', skin: '#b07a55', hair: '#4a4a4a', pants: '#2a2e38', band: '#111318', suitd: 1 } }; // v16: generic made-up Regulator in a business suit
function seg(x, y, a, len, w, c, hi) { const [dx, dy] = dirv(a), x2 = x + dx * len, y2 = y + dy * len; g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
  if (hi) { g.strokeStyle = hi; g.lineWidth = w * 0.28; g.beginPath(); g.moveTo(x - w * 0.18, y); g.lineTo(x2 - w * 0.18, y2); g.stroke(); } return [x2, y2]; }
function drawF(f) {
  const p = pose(f), L = LOOK[f.id], sc = H / 720 * 1.35, B = BONES;
  g.save(); g.translate(f.x, GY - f.y); g.scale(f.dir * sc, sc);
  if (p.ko) { g.rotate(-p.ko * Math.PI / 2 * 0.95); }
  const legY = th => B.th * Math.cos(th) , hipH = Math.max(legY(p.th1) + B.sh * Math.cos(p.th1 + p.sh1), legY(p.th2) + B.sh * Math.cos(p.th2 + p.sh2));
  const hx = 0, hy = -(f.y > 0 ? 100 : hipH) + (p.bob || 0);
  const [lx, ly] = dirv(Math.PI - p.lean), sx = hx + lx * B.torso, sy = hy + ly * B.torso; // shoulder
  const leg = (th, sh, c, hi) => { const k = seg(hx, hy, th, B.th, 22, c, hi), a = seg(k[0], k[1], th + sh, B.sh, 18, c, hi); g.fillStyle = '#111'; g.beginPath(); g.ellipse(a[0] + 8, a[1] + 2, 16, 7, 0, 0, 7); g.fill(); };
  const arm = (ua, fa, c, hi) => { const e = seg(sx, sy, ua, B.ua, 16, c, hi), h = seg(e[0], e[1], ua + fa, B.fa, 13, L.skin); g.fillStyle = L.trim; g.beginPath(); g.arc(h[0], h[1], 10, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(h[0] - 3, h[1] - 3, 4, 0, 7); g.fill(); };
  g.shadowColor = L.trim; g.shadowBlur = 14;
  arm(p.ua2, p.fa2, L.suit2); leg(p.th2, p.sh2, '#151a28');
  // torso: tapered gi jacket + belt
  g.shadowBlur = 0;
  const [px, py] = [Math.cos(p.lean), Math.sin(p.lean)];
  g.fillStyle = L.suit; g.beginPath(); g.moveTo(hx - 15 * px, hy - 15 * py); g.lineTo(sx - 24 * px, sy - 24 * py); g.quadraticCurveTo(sx, sy - 10, sx + 22 * px, sy + 22 * py); g.lineTo(hx + 16 * px, hy + 16 * py); g.closePath(); g.fill();
  g.strokeStyle = L.trim; g.lineWidth = 3; g.beginPath(); g.moveTo(sx - 4, sy + 2); g.lineTo((sx + hx) / 2 + 6, (sy + hy) / 2); g.stroke();
  if (L.suitd) { g.save(); g.translate(sx, sy); g.rotate(p.lean); g.fillStyle = '#e9edf2'; g.beginPath(); g.moveTo(-6, 4); g.lineTo(10, 4); g.lineTo(2, 34); g.closePath(); g.fill(); g.fillStyle = '#b3122e'; g.beginPath(); g.moveTo(0, 6); g.lineTo(6, 6); g.lineTo(7, 40); g.lineTo(3, 46); g.lineTo(-1, 40); g.closePath(); g.fill(); g.restore(); }
  g.fillStyle = L.band; g.save(); g.translate(hx, hy - 6); g.rotate(p.lean); g.fillRect(-18, -5, 36, 9); g.fillRect(-14, 2, 6, 16); g.restore();
  leg(p.th1, p.sh1, L.pants, 'rgba(255,255,255,0.12)');
  // head
  const [nx, ny] = dirv(Math.PI - p.lean - (p.head || 0) * 0.5), cx = sx + nx * (B.neck + B.head), cy = sy + ny * (B.neck + B.head);
  seg(sx, sy, Math.PI - p.lean, B.neck, 11, L.skin);
  g.fillStyle = L.skin; g.beginPath(); g.ellipse(cx + 2, cy, B.head * 0.85, B.head, p.lean, 0, 7); g.fill();
  g.fillStyle = L.hair; g.beginPath(); g.ellipse(cx - 3, cy - 6, B.head * 0.9, B.head * 0.65, p.lean, Math.PI, 2 * Math.PI); g.fill();
  if (!L.suitd) { g.fillStyle = L.band; g.fillRect(cx - 14, cy - 8, 28, 5); } g.fillStyle = '#111'; g.fillRect(cx + 7, cy - 2, 4, 3);
  if (f === P1) { drawHeadTraits(g, TR, cx + 2, cy, B.head, clock); drawLaptop(g, TR, hx - 40, hy - 10, 1); }
  if (p.papers) { g.fillStyle = '#fbfbf2'; g.strokeStyle = '#888'; g.lineWidth = 1; [[-1, 0], [1, 1]].forEach(([s, k]) => { const ex = sx + s * 30, ey = sy - 70; g.save(); g.translate(ex, ey); g.rotate(s * 0.3 + Math.sin(clock * 9 + k) * 0.08); g.fillRect(-12, -16, 24, 30); g.strokeRect(-12, -16, 24, 30); for (let i = 0; i < 4; i++) g.fillStyle = '#9aa', g.fillRect(-8, -10 + i * 6, 16, 2); g.fillStyle = '#fbfbf2'; g.restore(); }); }
  arm(p.ua1, p.fa1, L.suit, 'rgba(255,255,255,0.18)');
  if (f.block) { g.strokeStyle = L.trim + 'aa'; g.lineWidth = 4; g.beginPath(); g.arc(30, hy - 60, 75, -1.1, 1.1); g.stroke(); }
  if (f.dash > 0) { g.fillStyle = L.trim + '44'; g.fillRect(-140, hy - 90, 110, 80); }
  g.restore(); g.globalAlpha = 0.35; g.fillStyle = '#000'; g.beginPath(); g.ellipse(f.x, GY + 4, 60 * sc, 9, 0, 0, 7); g.fill(); g.globalAlpha = 1; }
function endRound() { const w = P1.hp === P2.hp ? null : P1.hp > P2.hp ? P1 : P2; if (w) w.wins++; S.ko(); call(w ? (w === P1 ? (P1N + ' WINS ROUND') : 'THE REGULATOR WINS ROUND') : 'DRAW'); state = 'rest'; callT = 2;
  $('w1').textContent = '●'.repeat(P1.wins); $('w2').textContent = '●'.repeat(P2.wins); }
let last = performance.now();
function loop(now) { let dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (spec) { spec.t += dt; if (!spec.thrown && spec.t < 2.2) dt *= 0.25; else if (!spec.thrown) { spec.thrown = true; const f = spec.f; for (let i = 0; i < 7; i++) papers.push({ x: f.x + f.dir * 40, y: GY - 200 - i * 8, vx: f.dir * (520 + i * 40), vy: -120 + i * 50, r: 0, o: f }); call(''); } if (spec.t > 3.4) spec = null; }
  clock += dt;
  if (!stage || stW !== W) buildStage();
  g.save(); if (shake > 0) { shake -= dt; g.translate((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8); } g.drawImage(stage, 0, 0);
  if (P1) {
    if (state === 'fight') { timer -= dt; control(P1, p1in(), dt); control(P2, cpu(dt), dt); phys(P1, P2, dt); phys(P2, P1, dt);
      shots.forEach(s => { s.x += s.dir * 620 * dt; const o = s.o === P1 ? P2 : P1; if (Math.abs(s.x - o.x) < 50 && o.y < 140) { s.dead = 1; doHit(s.o, o, 12, 'kick'); } });
      shots = shots.filter(s => !s.dead && s.x > 0 && s.x < W);
      if (P1.hp <= 0 || P2.hp <= 0 || timer <= 0) { P1.hp = Math.max(0, P1.hp); P2.hp = Math.max(0, P2.hp); endRound(); } }
    else if (state === 'call') { callT -= dt; if (callT < 0.5) call('FIGHT!'); if (callT <= 0) { state = 'fight'; call(''); } }
    else if (state === 'rest') { callT -= dt; if (callT <= 0) { if (P1.wins === 2 || P2.wins === 2) { state = 'over'; const won = P1.wins === 2; if (won) S.win();
        const score = Math.round(P1.wins * 1000 + dealt * 10 + (won ? P1.hp * 20 + Math.max(0, timer) * 10 : 0));
        $('title').textContent = won ? 'YOU WIN!' : 'THE REGULATOR WINS'; $('msg').textContent = `Rounds ${P1.wins} - ${P2.wins} · Score ${score} · #1 is ${top('clash').n} ${top('clash').s}`; askInitials(score); $('play').textContent = 'Rematch'; $('panel').classList.remove('hidden'); call(''); }
      else { round++; newRound(); } } }
    const cu = spec && !spec.thrown; if (cu) { const f = spec.f, z = 1 + Math.min(1, spec.t / 0.6) * 1.3, hx = f.x, hy = GY - f.y - H * 0.33; g.save(); g.translate(W / 2, H * 0.45); g.scale(z, z); g.translate(-hx, -hy); }
    drawF(P1); drawF(P2);
    papers.forEach(q => { if (state === 'fight') { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; q.r += dt * 8; const o = q.o === P1 ? P2 : P1; if (!q.dead && Math.abs(q.x - o.x) < 50 && q.y > GY - o.y - 230 && q.y < GY - o.y) { q.dead = 1; doHit(q.o, o, 5, 'punch'); } }
      g.save(); g.translate(q.x, q.y); g.rotate(q.r); g.fillStyle = '#fbfbf2'; g.fillRect(-14, -18, 28, 36); g.fillStyle = '#9aa'; for (let i = 0; i < 4; i++) g.fillRect(-9, -11 + i * 7, 18, 2); g.restore(); });
    papers = papers.filter(q => !q.dead && q.x > -50 && q.x < W + 50 && q.y < H);
    if (cu) { g.restore(); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, H * 0.08); g.fillRect(0, H * 0.92, W, H * 0.08); if (spec.t > 0.3) { g.fillStyle = '#ffd23d'; g.font = `900 ${Math.min(W / 14, H * 0.06)}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PAPERWORK STORM!', W / 2, H * 0.96 - H * 0.04); } }
    shots.forEach(s => { g.fillStyle = '#22f0ff'; g.shadowColor = '#22f0ff'; g.shadowBlur = 24; g.beginPath(); g.arc(s.x, s.y, 16, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(s.x, s.y, 7, 0, 7); g.fill(); g.shadowBlur = 0; });
    sparks.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; p.l -= dt; g.globalAlpha = Math.max(0, p.l / 0.35); g.strokeStyle = p.c; g.lineWidth = 3; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); g.stroke(); });
    g.globalAlpha = 1; sparks = sparks.filter(p => p.l > 0);
    pows.forEach(p => { p.l -= dt; const k = p.l > 0.6 ? 1 : Math.max(0.3, Math.min(1, (0.6 - p.l) * 8)), s = Math.max(28, H * 0.06) * k; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.min(1, p.l * 3);
      g.fillStyle = '#ffd23d'; g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < 20; i++) { const a = i / 20 * 6.283, rr = i % 2 ? s * 0.75 : s * 1.3; g.lineTo(Math.cos(a) * rr * 1.3, Math.sin(a) * rr); } g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#e8173b'; g.font = `900 ${s * 0.6}px Impact, system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeText(p.w, 0, 0); g.fillText(p.w, 0, 0); g.restore(); });
    pows = pows.filter(p => p.l > 0);
    $('m1').style.width = P1.meter + '%'; $('m2').style.width = P2.meter + '%'; $('m2').parentNode.parentNode.classList.toggle('full', P2.meter >= 100);
    $('hp1').style.width = Math.max(0, P1.hp) + '%'; $('hp2').style.width = Math.max(0, P2.hp) + '%'; $('timer').textContent = Math.max(0, Math.ceil(timer));
  }
  g.restore(); for (const k in keys) if (keys[k] === 2) keys[k] = 1; requestAnimationFrame(loop); }
requestAnimationFrame(loop);
const DQ = new URLSearchParams(location.search).get('demo');
if (DQ === 'special') { start(); state = 'fight'; call(''); P1.x = W * 0.35; P2.x = W * 0.62; P2.meter = 100; setTimeout(() => { spec = { f: P2, t: 0, thrown: false }; P2.meter = 0; pows.push({ x: W * 0.4, y: GY - 260, l: 99, w: 'POW!', r: -0.2 }); }, 300); }
else if (DQ) { start(); state = 'fight'; call(''); P1.hp = 62; P2.hp = 41; P1.x = W * 0.45; P2.x = W * 0.56; setTimeout(() => { start2(P1, 'kick'); }, 600); }

// ---- leaderboard / tokens (arcade.js) ----
function board() { const b = JSON.parse(localStorage.getItem('ledgerArcade.v1') || 'null'); return b; }
function askInitials(score) {
  const ent = $('ent'); if (!qualifies('clash', score)) { ent.classList.add('hidden'); if (lastBlockReason()) $('msg').textContent += ' · ' + lastBlockReason(); return; }
  ent.classList.remove('hidden'); const inp = $('ini'); inp.value = ''; inp.focus();
  $('save').onclick = () => { const r = submitScore('clash', inp.value, score); ent.classList.add('hidden'); if (!r) return;
    $('msg').textContent += ` · Saved #${r.rank}` + (r.token ? ` · +1 TOKEN (you have ${r.tokens})` : '') + (r.reset ? ' · Board reset (2 tokens earned here)' : ''); };
}
$('rules').textContent = RULES;
if (new URLSearchParams(location.search).get('test')) window.__askInitials = askInitials; // headless test hook
