// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
import { fromQuery, drawHeadTraits, drawAura, drawLaptop } from '../traitfx.js';
const TR = fromQuery(), DEMO = !!new URLSearchParams(location.search).get('demo'); // v16: worn NFT traits via URL only
import { submitScore, qualifies, top, RULES, lastBlockReason } from '../arcade.js';
// Vault Run v3 - classic fixed-shooter mechanics (formations, swoops, dives, stages). Original code (MIT). Sprites: Kenney Space Shooter Remastered (CC0); SFX: Kenney Digital Audio (CC0); music: original WebAudio loop.
const cv = document.getElementById('game'), g = cv.getContext('2d');
const $ = id => document.getElementById(id);
const A = '../assets/kenney/', img = n => { const i = new Image(); i.src = A + 'space/' + n + '.png'; return i; };
const IM = { ship: img('playerShip2_blue'), e: [img('enemyRed1'), img('enemyBlack3'), img('enemyGreen4')], las: img('laserBlue01'), elas: img('laserRed03'),
  bolt: img('powerupBlue_bolt'), shield: img('powerupGreen_shield'), life: img('pill_red'), bg: img('darkPurple'), rock: img('meteorBrown_big1') };
const snd = n => { const a = new Audio(A + 'sfx/' + n + '.ogg'); a.volume = 0.35; return () => { const c = a.cloneNode(); c.volume = 0.3; c.play().catch(() => {}); }; };
const S = { shot: snd('laser4'), pow: snd('powerUp2'), die: snd('lowDown'), boom: snd('impactGeneric_light_002'), start: snd('phaserUp3') };
let W, H; const fit = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; }; addEventListener('resize', fit); fit();
// ---- original synth music loop ----
let ac, musicOn = true, mGain;
function music() {
  if (ac) return; ac = new AudioContext(); mGain = ac.createGain(); mGain.gain.value = 0.06; mGain.connect(ac.destination);
  const notes = [45, 45, 52, 45, 48, 45, 55, 53], step = 0.18; let t0 = ac.currentTime + 0.05, i = 0;
  (function sched() { while (t0 < ac.currentTime + 0.5) { const o = ac.createOscillator(), v = ac.createGain(); o.type = 'sawtooth';
      o.frequency.value = 440 * 2 ** ((notes[i % 8] - 69) / 12); v.gain.setValueAtTime(1, t0); v.gain.exponentialRampToValueAtTime(0.01, t0 + step * 0.9);
      o.connect(v).connect(mGain); o.start(t0); o.stop(t0 + step); t0 += step; i++; } setTimeout(sched, 120); })();
}
const keys = {}; addEventListener('keydown', e => { keys[e.key.toLowerCase()] = 1;
  if (e.key === 'Escape') {
    if (new URLSearchParams(location.search).get('embed') || window.parent !== window) {
      try { parent.postMessage({ type: 'lobby-back' }, '*'); } catch (_) {}
      return;
    }
    location.href = '../index.html?spawn=arcade';
  }
  if (e.key.toLowerCase() === 'm' && mGain) { musicOn = !musicOn; mGain.gain.value = musicOn ? 0.06 : 0; } });
addEventListener('keyup', e => keys[e.key.toLowerCase()] = 0);
let mouse = null; cv.addEventListener('pointermove', e => mouse = e.clientX);
let P, shots, foes, eb, parts, score, lives, stage, run = false, t, inv, banner, bannerT, diveT, scroll = 0;
const ROWS = [[2, 150], [1, 80], [0, 50], [0, 50]], COLS = 8;
const bez = (p, u) => { const v = 1 - u; return [v * v * v * p[0][0] + 3 * v * v * u * p[1][0] + 3 * v * u * u * p[2][0] + u * u * u * p[3][0], v * v * v * p[0][1] + 3 * v * v * u * p[1][1] + 3 * v * u * u * p[2][1] + u * u * u * p[3][1]]; };
// v16: formation scales to the viewport and always keeps >=35% of play height clear above the ship
const PY = () => H - Math.max(56, Math.min(70, H * 0.09));
const slot = (f) => { const top = H > W ? Math.max(130, H * 0.15) : Math.max(56, H * 0.1), room = PY() - H * 0.35 - top, rg = Math.max(18, Math.min(52, room / ROWS.length)), sp = Math.min(64, W / 12, rg * 1.5), sway = Math.sin(t * 0.9) * Math.min(26, W * 0.04);
  return [W / 2 + (f.c - (COLS - 1) / 2) * sp + sway, top + f.r * rg + Math.sin(t * 2 + f.c) * 2]; };
const VS = () => Math.max(0.55, Math.min(1, H / 800)); // speed scale for short screens
function reset() { P = { x: W / 2, y: PY() }; shots = []; eb = []; parts = []; score = 0; lives = 3; t = 0; inv = 2; stage = 0; nextStage(); }
function nextStage() { stage++; foes = []; banner = `STAGE ${stage}`; bannerT = 2; diveT = 3;
  for (let r = 0; r < 4; r++) for (let c = 0; c < COLS; c++) { const left = (r + c) % 2 === 0, k = r * COLS + c;
    const from = left ? [-60, H * 0.35] : [W + 60, H * 0.35];
    foes.push({ r, c, kind: ROWS[r][0], pts: ROWS[r][1], st: 'wait', delay: 0.4 + Math.floor(k / 4) * 0.45, u: 0, hp: r === 0 ? 2 : 1,
      path: [from, [left ? W * 0.55 : W * 0.45, H * 0.15], [left ? W * 0.15 : W * 0.85, H * 0.75], null], x: from[0], y: from[1] }); } }
function boom(x, y, c, n = 18) { for (let i = 0; i < n; i++) { const a = Math.random() * 7, s = 60 + Math.random() * 220; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 0.6, c }); } }
function hitPlayer() { if (inv > 0) return; lives--; S.die(); boom(P.x, P.y, '#22f0ff', 30); inv = 2.5; eb = []; if (lives <= 0) end(); }
function end() { run = false; const q = qualifies('run', score);
  $('title').textContent = 'GAME OVER'; $('msg').textContent = `Stage ${stage} · Score ${score} · #1 is ${top('run').n} ${top('run').s}`; $('play').textContent = 'Play again'; $('panel').classList.remove('hidden'); if (!q && lastBlockReason()) $('msg').textContent += ' · ' + lastBlockReason();
  $('ent').classList.toggle('hidden', !q); if (q) { const inp = $('ini'); inp.value = ''; setTimeout(() => inp.focus(), 50);
    $('save').onclick = () => { const r = submitScore('run', inp.value, score); $('ent').classList.add('hidden'); if (!r) return; $('msg').textContent += ` · Saved #${r.rank}` + (r.token ? ` · +1 TOKEN (you have ${r.tokens})` : '') + (r.reset ? ' · Board reset (2 tokens earned here)' : ''); refreshBest(); }; } }
function refreshBest() { $('best').textContent = top('run').s; }
refreshBest(); $('rules').textContent = RULES;
$('play').onclick = () => { $('panel').classList.add('hidden'); reset(); run = true; S.start(); if (musicOn) music(); };
function fire() { if (shots.length >= 2) return; shots.push({ x: P.x, y: P.y - 30 }); S.shot(); }
addEventListener('keydown', e => { if (run && (e.code === 'Space' || e.key === 'j')) { e.preventDefault(); fire(); } });
cv.addEventListener('pointerdown', () => run && fire());
function update(dt) {
  t += dt; inv -= dt; bannerT -= dt; scroll += dt * 40;
  const mv = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
  if (mv) { P.x += mv * 420 * dt; mouse = null; } else if (mouse != null) P.x += Math.max(-420 * dt, Math.min(420 * dt, mouse - P.x));
  P.x = Math.max(30, Math.min(W - 30, P.x)); P.y = PY();
  shots.forEach(s => s.y -= 900 * dt); shots = shots.filter(s => s.y > -20);
  const sp = 1 + stage * 0.12;
  for (const f of foes) {
    if (f.st === 'wait') { f.delay -= dt; if (f.delay <= 0) { f.st = 'enter'; f.path[3] = slot(f); } continue; }
    if (f.st === 'enter' || f.st === 'dive' || f.st === 'back') { f.path[3] = f.st === 'enter' || f.st === 'back' ? slot(f) : f.path[3]; f.u += dt * (f.st === 'dive' ? 0.42 * VS() : 0.6) * sp;
      const [x, y] = bez(f.path, Math.min(1, f.u)); f.ang = Math.atan2(y - f.y, x - f.x) - Math.PI / 2; f.x = x; f.y = y;
      if (f.st === 'dive' && f.shotsLeft > 0 && f.y > H * 0.3 && Math.random() < dt * 2.2) { f.shotsLeft--; eb.push({ x: f.x, y: f.y + 16, vx: (P.x - f.x) * 0.25, vy: (330 + stage * 20) * VS() }); }
      if (f.u >= 1) { if (f.st === 'dive') { f.st = 'back'; f.u = 0; f.x = slot(f)[0]; f.y = -40; f.path = [[f.x, -40], [f.x, 20], [slot(f)[0], 40], slot(f)]; } else { f.st = 'form'; f.ang = 0; } } }
    else { [f.x, f.y] = slot(f); f.ang = 0; }
  }
  diveT -= dt; const formed = foes.filter(f => f.st === 'form');
  if (diveT <= 0 && formed.length && !foes.some(f => f.st === 'enter' || f.st === 'wait')) { diveT = Math.max(0.8, 2.6 - stage * 0.25);
    const n = Math.min(formed.length, 1 + (Math.random() < 0.3 + stage * 0.1 ? 1 : 0));
    for (let i = 0; i < n; i++) { const f = formed[(Math.random() * formed.length) | 0]; if (f.st !== 'form') continue; const side = f.x < W / 2 ? -1 : 1;
      f.st = 'dive'; f.u = 0; f.shotsLeft = 1 + Math.min(3, stage >> 1); f.path = [[f.x, f.y], [f.x + side * 160, f.y - 120], [P.x - side * 200, H * 0.7], [P.x + side * 120, H + 60]]; } }
  eb.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; }); eb = eb.filter(b => b.y < H + 20);
  for (const s of shots) for (const f of foes) if (!f.dead && f.st !== 'wait' && Math.abs(s.x - f.x) < 24 && Math.abs(s.y - f.y) < 22) { s.y = -99; if (--f.hp > 0) { boom(f.x, f.y, '#fff', 6); continue; }
    f.dead = true; const pts = f.st === 'form' ? f.pts : f.pts * 2; score += pts; boom(f.x, f.y, ['#ff5a5a', '#c8c8d8', '#7aff7a'][f.kind]); S.boom(); }
  foes = foes.filter(f => !f.dead);
  if (inv <= 0) { for (const b of eb) if (Math.abs(b.x - P.x) < 18 && Math.abs(b.y - P.y) < 22) { b.y = H + 99; hitPlayer(); }
    for (const f of foes) if (f.st === 'dive' && Math.abs(f.x - P.x) < 30 && Math.abs(f.y - P.y) < 30) { f.dead = true; boom(f.x, f.y, '#ff5a5a'); hitPlayer(); } foes = foes.filter(f => !f.dead); }
  if (run && !foes.length) { score += 500 * stage; nextStage(); S.pow(); }
  parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt; }); parts = parts.filter(p => p.l > 0);
}
const STARS = Array.from({ length: 140 }, () => [Math.random(), Math.random(), Math.random() * 2 + 0.5]);
function draw() {
  g.fillStyle = '#05030f'; g.fillRect(0, 0, W, H);
  for (const [x, y, z] of STARS) { g.fillStyle = `rgba(200,220,255,${0.3 + z * 0.25})`; g.fillRect(x * W, (y * H + scroll * z) % H, z, z * 2); }
  if (!P) return;
  for (const f of foes) { if (f.st === 'wait') continue; const im = IM.e[f.kind]; g.save(); g.translate(f.x, f.y); g.rotate(f.ang || 0); const es = Math.min(1, H / 640, W / 700); g.scale(es, es); g.drawImage(im, -22, -18, 44, 36); g.restore(); }
  if (run && (inv <= 0 || Math.floor(t * 10) % 2 || DEMO)) g.drawImage(IM.ship, P.x - 26, P.y - 20, 52, 40); if (run) { if (TR.tr.length) { drawAura(g, TR, P.x, P.y, 34, t); g.fillStyle = '#c98a62'; g.beginPath(); g.arc(P.x, P.y - 4, 12, 0, 7); g.fill(); drawHeadTraits(g, TR, P.x - 2, P.y - 4, 12, t); drawLaptop(g, TR, P.x + 22, P.y + 2, 0.6); } }
  shots.forEach(s => g.drawImage(IM.las, s.x - 3, s.y - 14, 6, 26)); eb.forEach(b => g.drawImage(IM.elas, b.x - 3, b.y - 10, 6, 20));
  parts.forEach(p => { g.globalAlpha = p.l / 0.6; g.fillStyle = p.c; g.fillRect(p.x, p.y, 3, 3); }); g.globalAlpha = 1;
  for (let i = 0; i < lives - 1; i++) g.drawImage(IM.ship, 14 + i * 34, H - 34, 28, 22);
  g.fillStyle = '#ffd23d'; g.font = 'bold 14px monospace'; g.fillText(`STAGE ${stage}`, W - 100, H - 16);
  if (bannerT > 0) { g.fillStyle = '#22f0ff'; g.font = '900 48px system-ui'; g.textAlign = 'center'; g.fillText(banner, W / 2, H / 2); g.textAlign = 'left'; }
  $('score').textContent = score; $('lives').textContent = lives;
}
let last = performance.now();
function loop(now) { const dt = Math.min(0.033, (now - last) / 1000); last = now; if (run) update(dt); else if (P) { t += dt; } draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
if (new URLSearchParams(location.search).get('demo')) { $('panel').classList.add('hidden'); reset(); run = true; inv = 99; setInterval(fire, 300); }
