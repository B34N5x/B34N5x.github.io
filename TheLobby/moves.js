// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// Step 13e: creature movement profiles (traits_map.json 'movement'), Legendary themed boost
// (cosmetic, lobby only) and data-driven emotes (skeleton BONE PILE). Toggles persist in localStorage.
// 2026-11-05: all-fours / STANCE toggle REMOVED — every fix broke connected bodies. All avatars stay upright.
// Species feel = movement multipliers (stride/weight/speed) + ear/tail springs + trait ability FX instead.
import * as THREE from './lib/three.module.js';
import { PuffPool } from './controller.js';
const FX = { slime: 0x7dff8a, gold: 0xffcc55, feathers: 0xf4f4ff, ripple: 0x7fe0ff, dust: 0xc8a878, streak: 0xff9a3c, sparks: 0xfff080 };
let P0 = null, cur = null, fxPool = null, pools = {}, pile = null, floorFn = null;
export const GROUND_EPS = 0.012; // lift above surface to avoid z-fighting
const _bb = new THREE.Box3();
// Generic: lift a ground-placed prop so its WORLD bbox min.y >= groundY + eps (never pushes down).
export function clampAboveGround(o, groundY, eps = GROUND_EPS) { o.updateWorldMatrix(true, true); _bb.setFromObject(o); if (_bb.isEmpty()) return 0; const d = groundY + eps - _bb.min.y; if (d > 0) { const w = o.getWorldPosition(new THREE.Vector3()); w.y += d; o.parent.worldToLocal(w); o.position.copy(w); } return d; }
const ls = (k, v) => v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v);
export function movementFor(spec, map) { const M = (map && map.movement) || {}; const m = Object.assign({ speed: 1, jump: 1, gravity: 1, glide: 0, stride: 1, weight: 1 }, M.default, M[spec.type] || {}); m.type = spec.type; return m; }
export function setupMoves(ctl, scene, getChar, floorAt) {
  floorFn = typeof floorAt === 'function' ? floorAt : null;
  P0 = Object.assign({}, ctl.p);
  const st = document.getElementById('stance'), bo = document.getElementById('boost'), em = document.getElementById('emote');
  if (st) { st.hidden = true; st.setAttribute('hidden', ''); st.style.display = 'none'; } // stance retired — keep DOM id harmless if present
  try { ls('ledgerStance', 'off'); } catch {}
  const label = () => { if (!cur) return; const b = ls('ledgerBoost') === 'on';
    if (cur.boost) { bo.textContent = `${cur.boost.name}: ${b ? 'ON' : 'OFF'}`; bo.setAttribute('aria-pressed', b); } };
  const apply = () => { if (!cur) return; const b = cur.legendary && cur.boost && ls('ledgerBoost') === 'on' ? cur.boost : {};
    ctl.p.walk = P0.walk * cur.speed * (b.speed || 1); ctl.p.run = P0.run * cur.speed * (b.speed || 1);
    ctl.p.jumpV = P0.jumpV * cur.jump * (b.jump || 1); ctl.p.gravity = P0.gravity * cur.gravity; cur.glideNow = Math.max(cur.glide, b.glide || 0); cur.fxNow = b.fx || null;
    if (b.fx) fxPool = pools[b.fx] || (pools[b.fx] = new PuffPool(scene, { n: 80, color: FX[b.fx] || 0xffffff, size: 0.16 })); label(); };
  if (bo) bo.addEventListener('click', () => { ls('ledgerBoost', ls('ledgerBoost') === 'on' ? 'off' : 'on'); apply(); });
  const doEmote = () => { const c = getChar(); if (!c || !cur || !cur.emote) return; if (pile && pile.state !== 'done' && pile.state !== 'up') { pile.parts.forEach(p => { p.from = p.o.position.clone(); p.rf = p.o.rotation.clone(); }); Object.assign(pile, { state: 'up', t: 0 }); } else if (!pile || pile.state === 'done') pile = startPile(c); };
  if (em) em.addEventListener('click', doEmote); addEventListener('keydown', e => { if (cur && cur.emote && e.code === cur.emote.key && !e.repeat && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) doEmote(); });
  return {
    set(spec, map) { if (!spec) { cur = null; Object.assign(ctl.p, P0); if (st) st.hidden = true; if (bo) bo.hidden = true; if (em) em.hidden = true; return; }
      cur = movementFor(spec, map); cur.legendary = spec.tier === 'Legendary'; cur.emote = ((map && map.emotes) || {})[spec.type] ? map.emotes[spec.type][0] : null; pile = null;
      if (st) st.hidden = true; if (bo) bo.hidden = !(cur.legendary && cur.boost); if (em) { em.hidden = !cur.emote; if (cur.emote) em.textContent = `${cur.emote.name} [${cur.emote.key.replace('Key', '')}]`; } apply(); },
    pileClearance: () => { if (!pile) return null; let min = Infinity; for (const p of pile.parts) { p.o.updateWorldMatrix(true, true); _bb.setFromObject(p.o); if (!_bb.isEmpty()) min = Math.min(min, _bb.min.y - p.g); } return { state: pile.state, n: pile.parts.length, minClear: min }; },
    dbg: () => pile && { state: pile.state, t: pile.t, n: pile.parts.length, y0: pile.parts[0].o.position.y, p0: pile.parts[0].p0.y },
    strideMul: () => (cur ? cur.stride : 1), weight: () => (cur ? cur.weight : 1),
    stance: () => 0, isQuad: () => false, // API stubs — all-fours retired
    update(dt, pos) { if (!cur) return; const c = getChar();
      if (cur.glideNow && !ctl.grounded && ctl.vy < 0) ctl.vy += ctl.p.gravity * cur.glideNow * 0.75 * dt;
      if (cur.fxNow && fxPool) { if (ctl.speed > 0.6) fxPool.trail(pos, ctl.speed * dt * 1.6, 0.5); fxPool.update(dt); }
      if (c) {
        // Always upright — clear any leftover lean from older builds / hot reload
        c.rotation.x = 0; c.rotation.z = 0; c.position.y = 0; c.position.z = 0;
        c.userData.stanceA = 0; c.userData.quad = false;
      }
      if (pile && c) stepPile(pile, dt); }
  };
}
function startPile(c) { const parts = []; c.updateMatrixWorld(true);
  // 2026-11-05 fix: targets were absolute world y 0.04-0.12 (ignored plaza FLOOR 0.35 + mesh extents) -> bones sank below the surface.
  const feet = c.getWorldPosition(new THREE.Vector3()).y;
  c.traverse(o => { if (o.isMesh && o !== c) { const w = o.getWorldPosition(new THREE.Vector3()), q = Math.random() * 6.28, r = 0.15 + Math.random() * 0.35;
  const tx = w.x + Math.cos(q) * r, tz = w.z + Math.sin(q) * r, g = floorFn ? floorFn(tx, tz, feet + 0.5) : feet;
  const tgt = new THREE.Vector3(tx, g + 0.04 + Math.random() * 0.08, tz); o.parent.worldToLocal(tgt); parts.push({ o, g, p0: o.position.clone(), r0: o.rotation.clone(), tgt, spin: new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3) }); } });
  return { parts, t: 0, state: 'falling' }; }
function stepPile(P, dt) { if (P.state === 'done') return; P.t += dt; const k = P.state === 'up' ? 1 - Math.min(1, P.t / 0.6) : Math.min(1, P.t / 0.6), e = P.state === 'up' ? k * k : 1 - (1 - k) * (1 - k) * (1 - k);
  if (P.state === 'up') { for (const p of P.parts) { p.o.position.lerpVectors(p.p0, p.from, e); p.o.rotation.set(p.r0.x + (p.rf.x - p.r0.x) * e, p.r0.y + (p.rf.y - p.r0.y) * e, p.r0.z + (p.rf.z - p.r0.z) * e); } }
  else for (const p of P.parts) { p.o.position.lerpVectors(p.p0, p.tgt, e); if (P.state !== 'up' && k < 1) p.o.position.y += Math.sin(k * Math.PI) * 0.15; p.o.rotation.set(p.r0.x + p.spin.x * e, p.r0.y + p.spin.y * e, p.r0.z + p.spin.z * e); }
  if (P.state !== 'up') for (const p of P.parts) clampAboveGround(p.o, p.g);
  if (P.state === 'falling' && k >= 1) P.state = 'down'; if (P.state === 'up' && k <= 0) { P.parts.forEach(p => { p.o.position.copy(p.p0); p.o.rotation.copy(p.r0); }); P.state = 'done'; } }
