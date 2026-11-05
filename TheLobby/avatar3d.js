// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// Step 10: procedural 3D trait avatars (smooth primitives, stylised vinyl-toy look; no voxels).
// buildAvatar(spec from traits.readTraits) -> THREE.Group with .userData.animate(t, dt, ctl, walkT).
// Feet at y=0, ~1.3 tall, faces +Z. Controller drives it via ctl.blend / ctl.scale / ctl.speed.
// Preview 2026-11-05: all-fours REVERTED (broke assets). Upright only + ear/tail/wing spring secondary motion.
import * as THREE from './lib/three.module.js';
import { nearestMaskPart, buildFeatures, applyTierGlow } from './parts.js';
import { buildItem, addHat } from './items3d.js'; // step 23
const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0.05 }, o));
const S = (r, w = 32, h = 20) => new THREE.SphereGeometry(r, w, h);
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 8, 20);
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; };
const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
// per-type proportions: head radius, body size, ears, snout, tail, extras
const T = {
  bear:     { head: 0.3, body: [0.3, 0.35], ears: 'round', snout: 0.12, tail: 0.08, eye: 'dot' },
  tiger:    { head: 0.29, body: [0.27, 0.36], ears: 'round', snout: 0.11, tail: 'long', eye: 'dot', stripes: 1 },
  cat:      { head: 0.29, body: [0.24, 0.32], ears: 'point', snout: 0.07, tail: 'long', eye: 'big', whisk: 1 },
  dog:      { head: 0.28, body: [0.26, 0.34], ears: 'flop', snout: 0.13, tail: 0.1, eye: 'dot' },
  ape:      { head: 0.30, body: [0.33, 0.38], ears: 'side', snout: 0.16, tail: 0, eye: 'dot', longArms: 1, brow: 1, muzzle: 1 },
  bird:     { head: 0.27, body: [0.3, 0.32], ears: null, snout: 'beak', tail: 0, eye: 'big', smallWings: 1 },
  frog:     { head: 0.33, body: [0.3, 0.28], ears: null, snout: 0, tail: 0, eye: 'frog' },
  skeleton: { head: 0.28, body: [0.2, 0.38], ears: null, snout: 0, tail: 0, eye: 'socket', bones: 1 },
  robot:    { head: 0.27, body: [0.28, 0.36], ears: 'bolt', snout: 0, tail: 0, eye: 'visor', metal: 1 },
  human:    { head: 0.27, body: [0.25, 0.38], ears: 'side', snout: 0, tail: 0, eye: 'dot', hair: 1 },
  armour:   { head: 0.28, body: [0.26, 0.42], ears: null, snout: 0, tail: 0, eye: 'visor', metal: 1, armour: 1 },
  alien:    { head: 0.3, body: [0.22, 0.34], ears: 'bolt', snout: 0, tail: 0, eye: 'big', metal: 0 }
};

// Upright species walk personalities (all-fours retired). Phone-light multipliers only.
const GAIT = {
  cat:  { amp: 0.42, bob: 0.035, arm: 0.55, stride: 1.15, hop: 0, style: 'prowl' },
  bear: { amp: 0.55, bob: 0.07,  arm: 0.9,  stride: 0.75, hop: 0, style: 'lumber' },
  dog:  { amp: 0.62, bob: 0.055, arm: 0.85, stride: 1.05, hop: 0, style: 'bounce' },
  tiger:{ amp: 0.5,  bob: 0.045, arm: 0.7,  stride: 1.0,  hop: 0, style: 'prowl' },
  bird: { amp: 0.35, bob: 0.09,  arm: 0.25, stride: 1.35, hop: 1, style: 'hop' },
  ape:  { amp: 0.55, bob: 0.05,  arm: 1.1,  stride: 0.9,  hop: 0, style: 'lumber' },
  default:{ amp: 0.5, bob: 0.05, arm: 0.8, stride: 1, hop: 0, style: 'default' }
};
export const AVATAR_TYPES = ['capsule', ...Object.keys(T)];
// Step 11: 'capsule' body: smooth upright felt capsule, one top bump, wrap-around face band with strapped shades,
// stubby legs + chunky sneakers, short arms + mitten gloves. Original design (no backpack, no single-pane visor).
// Step 13: deterministic per-NFT variation (seed = NFT id) + felt detail textures.
export function seededRng(seed) { let h = 2166136261; for (const ch of String(seed || 'x')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
const feltTex = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 5000; i++) { const v = 100 + r() * 60 | 0; g.strokeStyle = `rgba(${v},${v},${v},0.35)`; g.lineWidth = 0.6 + r(); const x = r() * 256, y = r() * 256, an = r() * 6.28, l = 2 + r() * 5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); g.stroke(); } // felt fibres
  t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t; }; })();
const shoeText = (() => { const cache = {}; return txt => { if (cache[txt]) return cache[txt]; const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.clearRect(0, 0, 256, 64); g.fillStyle = '#2f7a3a'; g.font = 'bold 50px sans-serif'; g.textAlign = 'center'; g.fillText(txt, 128, 48); return (cache[txt] = new THREE.CanvasTexture(c)); }; })();
// Step 13b: hard-shell moulded face plate contoured to the capsule: glossy shell + thickness lips on top/bottom edges + side rivets for the straps.
// step 13d: parametric soft felt mask (never hockey-style). spec: coverage, shape round|rect, top/bottom (rel. to shades centre, body heights), width, puff, cheekTuck, tint, xMarks, straps, emblem, vents, patches
export function maskSpecFor(spec) { const legacy = { lower: { coverage: 'lower', top: -0.02, bottom: 0.32, width: 0.75, shape: 'round', puff: 0.6, cheekTuck: true }, forehead: { coverage: 'forehead', top: -0.28, bottom: -0.06, width: 0.9, shape: 'rect', puff: 0.3 } };
  const m = Object.assign({ coverage: 'eyeband', top: -0.12, bottom: 0.1, width: 0.95, shape: 'rect', puff: 0.4 }, legacy[spec.maskStyle] || {}, spec.mask && spec.mask.coverage !== 'none' ? spec.mask : {});
  if (!(spec.features && spec.features.mask) && !spec.mask && !spec.maskStyle) { m.coverage = 'none'; m.xMarks = m.xMarks || null; m.straps = { count: 0 }; m.emblem = false; return m; } // step 13f: no mask detected -> none built
  const np = nearestMaskPart(m); m.part = np.part; m.partExact = np.exact; if (!['eyeband', 'forehead', 'lower', 'full', 'muzzle'].includes(m.coverage)) m.coverage = np.part; return m; }
function feltMask(R, k, w, cy, M, felt, body) {
  const y2th = y => Math.acos(Math.max(-0.98, Math.min(0.98, 1 - 2 * y))), th0 = y2th(0.36 + M.top), th1 = y2th(0.36 + M.bottom);
  const PH = Math.min(Math.PI * 0.47, Math.PI * 0.5 * (M.width || 0.8) * (M.cheekTuck ? 1.05 : 0.95)), ex = M.shape === 'round' ? 2.2 : 6, pf = (M.puff ?? 0.5) * 0.06;
  const phAt = t => PH * Math.pow(Math.max(0.02, 1 - Math.pow(Math.abs(2 * t - 1), ex)), 1 / ex), r0 = R * 1.03;
  const rad = (t, u) => r0 + pf * Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * (1 - 0.6 * u * u) * (M.cheekTuck ? 1 + 0.3 * u * u : 1); // pillow bulge, fuller at the cheeks when tucked
  const P = (t, u, lift = 0) => { const th = th0 + (th1 - th0) * t, a = u * phAt(t), r = rad(t, u) + lift; return new THREE.Vector3(Math.sin(a) * Math.sin(th) * r * w, Math.cos(th) * r * k + cy, Math.cos(a) * Math.sin(th) * r * 0.92); };
  const NU = 40, NT = 24, pos = [], idx = []; for (let j = 0; j <= NT; j++) for (let i = 0; i <= NU; i++) { const v = P(j / NT, -1 + 2 * i / NU); pos.push(v.x, v.y, v.z); }
  for (let j = 0; j < NT; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + NU + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const none = M.coverage === 'none'; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); if (!none) body.add(new THREE.Mesh(g, felt));
  const loop = []; for (let i = 0; i <= 20; i++) loop.push(P(0, -1 + 2 * i / 20)); for (let j = 1; j <= 16; j++) loop.push(P(j / 16, 1)); for (let i = 19; i >= 0; i--) loop.push(P(1, -1 + 2 * i / 20)); for (let j = 15; j >= 1; j--) loop.push(P(j / 16, -1));
  const rollM = felt.clone(); rollM.color = M.edgeColour ? new THREE.Color(M.edgeColour) : felt.color.clone().multiplyScalar(0.93); const ew = M.edgeWidth ?? 0.02;
  if (!none) body.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loop, true), 200, ew + pf * 0.25, 10, true), rollM)); // soft rounded edge roll (piping colour/width per card)
  const seam = mat(M.stitchColour || felt.color.clone().multiplyScalar(0.6), { roughness: 0.9 });
  if (!none && M.seam === 'centre') { const sp = []; for (let j = 0; j <= 12; j++) sp.push(P(0.04 + 0.92 * j / 12, 0, 0.004)); body.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp), 24, 0.008, 6), rollM)); for (let j = 0; j < 12; j++) { const q = P(0.08 + 0.84 * j / 11, 0.06, 0.006), q2 = P(0.08 + 0.84 * j / 11, -0.06, 0.006); [q, q2].forEach(qq => { const st = mesh(new THREE.CapsuleGeometry(0.0035, 0.012, 2, 4), seam, qq.x, qq.y, qq.z); body.add(st); }); } } // centre seam
  if (!none && M.frayed) for (let i = 0; i < 26; i++) { const u = -0.95 + 1.9 * i / 25, q = P(1, u, 0.002), L = 0.02 + ((i * 7919) % 5) * 0.008; const fr = mesh(new THREE.BoxGeometry(0.018, L, 0.008), rollM, q.x, q.y - L / 2, q.z); fr.rotation.y = Math.atan2(q.x, q.z); fr.rotation.z = ((i * 31) % 7 - 3) * 0.06; body.add(fr); } // frayed bottom edge
  const rimStitch = !none && (M.trims || []).some(t => /stitch/.test(t)); // v33: verified 'stitched rim' trims (was swallowed by a comment)
  for (let i = 0; i < (rimStitch ? 60 : 0); i++) { const u = -0.9 + 1.8 * (i % 30) / 29, t = i < 30 ? 0.08 : 0.92, q = P(t, u, 0.003); const st = mesh(new THREE.CapsuleGeometry(0.0035, 0.012, 2, 4), seam, q.x, q.y, q.z); st.rotation.set(0, Math.atan2(q.x, q.z), Math.PI / 2); body.add(st); } // running stitch
  const tOf = y => (y2th(y) - th0) / (th1 - th0);
  return { th0, th1, phAt, at: P, liftAt: y => { if (none) return 0; const t = tOf(y); return t >= -0.05 && t <= 1.05 ? rad(Math.min(1, Math.max(0, t + 0.12)), 0) - R + pf * 0.6 : 0; },
    surf: (y, x, lift = 0) => { const t = tOf(y), th = y2th(y); if (!none && t >= 0 && t <= 1) { const u = Math.max(-1, Math.min(1, Math.asin(Math.min(0.99, x / (Math.sin(th) * r0 * w))) / phAt(t))); return P(t, u, lift); }
      const r = R * 1.0 + lift, a = Math.asin(Math.max(-0.99, Math.min(0.99, x / (Math.sin(th) * r * w)))); return new THREE.Vector3(Math.sin(a) * Math.sin(th) * r * w, Math.cos(th) * r * k + cy, Math.cos(a) * Math.sin(th) * r * 0.92); } };
}
// step 13c: oversized chunky sneaker (sole + midsole stripe, cream upper, green panels, toe cap, heel tab, tongue, laces, APOGEE side text as in the V11 art)
function sneaker(s, V, C) { const g = new THREE.Group(), L = 0.42 * V.shoe, Wd = 0.2 * V.shoe; g.position.set(s * 0.02, -0.1, 0.07);
  const cream = mat(C.shoes || '#f1ede2', { roughness: 0.55 }), green = mat(C.shoeTrim || '#4f9a4a', { roughness: 0.5 }), white = mat('#fbfaf6', { roughness: 0.7 });
  const sole = mesh(cap(Wd / 2, L - Wd), white, 0, -0.045, 0); sole.rotation.x = Math.PI / 2; sole.scale.set(1.06, 1, 0.42); g.add(sole);
  const mid = mesh(cap(Wd / 2 + 0.004, L - Wd), green, 0, -0.022, 0); mid.rotation.x = Math.PI / 2; mid.scale.set(1.03, 1.005, 0.12); g.add(mid);
  const upper = mesh(cap(Wd / 2 * 0.95, L - Wd * 1.1), cream, 0, 0.02, -0.01); upper.rotation.x = Math.PI / 2; upper.scale.set(1, 1, 0.75); g.add(upper);
  const toe = mesh(S(Wd / 2 * 0.95, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), green, 0, 0.0, L / 2 - Wd * 0.5); toe.rotation.x = Math.PI / 2; toe.scale.set(1, 0.8, 0.75); g.add(toe);
  const heel = mesh(cap(0.045, 0.03), green, 0, 0.05, -L / 2 + 0.04); heel.scale.set(1.6, 1, 0.6); g.add(heel);
  [-1, 1].forEach(sd => { const p = mesh(cap(0.03, L * 0.45), green, sd * Wd / 2 * 0.92, 0.02, -0.02); p.rotation.x = Math.PI / 2 - 0.25; p.scale.set(0.35, 1, 0.9); g.add(p); }); // side panels
  const tongue = mesh(cap(0.045, 0.06), cream, 0, 0.085, 0.03); tongue.rotation.x = -0.5; tongue.scale.set(1.1, 1, 0.5); g.add(tongue);
  for (let l = 0; l < 4; l++) { const lc = mesh(new THREE.CapsuleGeometry(0.008, Wd * 0.55, 3, 8), white, 0, 0.07 - l * 0.012, 0.06 + l * 0.03); lc.rotation.z = Math.PI / 2; g.add(lc); }
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.045), new THREE.MeshStandardMaterial({ map: shoeText('APOGEE'), roughness: 0.6, transparent: true })); tag.position.set(s * (Wd / 2 * 1.0 + 0.004), 0.015, 0.03); tag.rotation.y = s * Math.PI / 2; g.add(tag); // his art's wording
  return g; }
// step 13d: unmistakable Legendary: fresnel gold rim aura, orbiting embers, gold motion trail, pulsing rune sigil, rising light rays, landing glow burst.
const sigilTex = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.translate(128, 128); g.strokeStyle = 'rgba(255,215,120,1)'; g.shadowColor = '#ffc040'; g.shadowBlur = 10;
  [118, 100, 64].forEach((r, i) => { g.lineWidth = i === 1 ? 2 : 4; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); });
  for (let i = 0; i < 12; i++) { g.save(); g.rotate(i / 12 * Math.PI * 2); g.lineWidth = 3; g.beginPath(); g.moveTo(0, -100); g.lineTo(6, -112); g.lineTo(-6, -112); g.closePath(); g.stroke(); g.fillStyle = 'rgba(255,215,120,0.9)'; g.fillRect(-2, -86, 4, 14); g.restore(); }
  g.beginPath(); for (let i = 0; i <= 6; i++) { const an = i / 6 * Math.PI * 2; g.lineTo(Math.cos(an) * 64, Math.sin(an) * 64); } g.stroke(); return (t = new THREE.CanvasTexture(c)); }; })();
function addLegendary(root, torso, cy, R, k, w) {
  const add = o => new THREE.MeshBasicMaterial(Object.assign({ color: '#ffcc55', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }, o));
  const rim = new THREE.Mesh(torso.geometry, new THREE.ShaderMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide, uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform float uT; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1. - max(dot(vN, vV), 0.), 2.6); gl_FragColor = vec4(vec3(1.,.78,.3) * f * (1.1 + .5*sin(uT*2.)), f); }' }));
  rim.position.y = cy; rim.scale.set(w * 1.07, k * 1.07, 0.92 * 1.07); root.add(rim);
  const sig = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), add({ map: sigilTex(), opacity: 0.8 })); sig.rotation.x = -Math.PI / 2; sig.position.y = 0.02; root.add(sig);
  const rays = new THREE.Group(); root.add(rays); for (let i = 0; i < 8; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 1.2).translate(0, 0.6, 0), add({ opacity: 0.12, color: '#ffe3a0' })); const an = i / 8 * Math.PI * 2; p.position.set(Math.cos(an) * 0.55, 0, Math.sin(an) * 0.55); p.rotation.y = -an; p.userData.ph = i; rays.add(p); }
  const emb = []; for (let i = 0; i < 28; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.014 + (i % 3) * 0.006, 8, 6), add({ color: i % 4 ? '#ffd070' : '#fff2c0', opacity: 0.9 })); m.userData = { a: i / 28 * Math.PI * 2, r: 0.5 + (i % 5) * 0.06, y: (i * 0.37) % 1, sp: 0.6 + (i % 4) * 0.25 }; root.add(m); emb.push(m); }
  const trail = []; for (let i = 0; i < 18; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), add({ opacity: 0 })); root.add(s); trail.push({ m: s, p: new THREE.Vector3(), life: 0 }); }
  const burst = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.5, 48), add({ opacity: 0 })); burst.rotation.x = -Math.PI / 2; burst.position.y = 0.03; root.add(burst);
  let bt = 9, wasAir = false, ti = 0, acc = 0; const wp = new THREE.Vector3();
  // step 13e: '+1 AURA' energy aura: rising flickering gold flame tongues, crackling sparks, light pulse; power-up burst when switched on (original design)
  const flameTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 96, 2, 32, 80, 60); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.35, 'rgba(255,200,80,0.8)'); gr.addColorStop(1, 'rgba(255,140,20,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(32, 2); g.bezierCurveTo(58, 50, 62, 100, 32, 126); g.bezierCurveTo(2, 100, 6, 50, 32, 2); g.fill(); return new THREE.CanvasTexture(c); })();
  const flames = []; for (let i = 0; i < 26; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: i % 3 ? '#ffc24a' : '#fff0b0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); sp.userData = { a: i / 26 * Math.PI * 2, o: (i * 0.618) % 1, s: 0.7 + (i % 5) * 0.12 }; root.add(sp); flames.push(sp); }
  const sparks = []; for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.06, 0.008), add({ color: '#fffbe0', opacity: 0 })); root.add(m); sparks.push(m); }
  const pulse = new THREE.PointLight('#ffc860', 0, 3, 2); pulse.position.y = 0.7; root.add(pulse);
  const pu = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 20), add({ color: '#fff2c0', opacity: 0 })), puR = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 48), add({ color: '#ffd070', opacity: 0 })); pu.position.y = 0.6; puR.rotation.x = -Math.PI / 2; puR.position.y = 0.05; root.add(pu, puR);
  let pt = 9;
  const fx = [rim, sig, rays, burst, pulse, ...emb, ...trail.map(x => x.m), ...flames, ...sparks]; let on = localStorage.getItem('ledgerAura') !== 'off';
  root.userData.auraSet = (v, burstNow = true) => { if (v && !on && burstNow) pt = 0; on = v; fx.forEach(o => { o.visible = v; }); }; root.userData.auraSet(on, false); // '+1 AURA' toggle (cosmetic)
  return (t, dt, ctl) => { pt += dt; const pk = Math.max(0, 1 - pt / 0.7); pu.material.opacity = pk * 0.55; pu.scale.setScalar(0.6 + (1 - pk) * 2.6); puR.material.opacity = pk * 0.9; puR.scale.setScalar(1 + (1 - pk) * 4);
    if (!on) return;
    flames.forEach(f => { const u = f.userData, ph = (t * 1.25 * u.s + u.o) % 1, an = u.a + Math.sin(t * 2 + u.o * 9) * 0.15, rr = 0.42 + 0.06 * Math.sin(t * 7 + u.a * 3) - ph * 0.12;
      f.position.set(Math.cos(an) * rr, 0.1 + ph * 1.45, Math.sin(an) * rr * 0.9); const fl = 0.75 + 0.25 * Math.sin(t * 23 + u.a * 7); f.scale.set(0.2 * fl * (1 - ph * 0.5), 0.5 * fl * (1 - ph * 0.3), 1); f.material.opacity = Math.sin(ph * Math.PI) * 0.75 * (1 + pk); });
    sparks.forEach((m, i) => { if (Math.random() < 0.12) { const an = Math.random() * 6.28; m.position.set(Math.cos(an) * 0.5, 0.2 + Math.random() * 1.3, Math.sin(an) * 0.45); m.rotation.set(Math.random(), Math.random(), Math.random()); m.material.opacity = 1; } else m.material.opacity *= 0.7; });
    pulse.intensity = 1.2 + 0.6 * Math.sin(t * 6) + 3 * pk; const B = ctl ? ctl.blend : { idle: 1 }, sp = ctl ? ctl.speed : 0; rim.material.uniforms.uT.value = t;
    sig.rotation.z = t * 0.3; sig.material.opacity = 0.55 + 0.3 * Math.sin(t * 2.2); sig.scale.setScalar(1 + 0.04 * Math.sin(t * 2.2));
    rays.rotation.y = t * 0.2; rays.children.forEach(p => { const q = 0.5 + 0.5 * Math.sin(t * 1.7 + p.userData.ph * 1.3); p.material.opacity = 0.05 + 0.12 * q; p.scale.y = 0.6 + 0.5 * q; });
    emb.forEach(m => { const u = m.userData, f = (t * 0.18 * u.sp + u.y) % 1, an = u.a + t * u.sp; m.position.set(Math.cos(an) * u.r, 0.15 + f * 1.5, Math.sin(an) * u.r); m.material.opacity = Math.sin(f * Math.PI) * (0.6 + 0.4 * Math.sin(t * 9 + u.a * 5)); });
    // gold trail: drop a world-space puff every ~0.05s while moving, convert back to local each frame
    root.updateMatrixWorld(true); acc += dt; if (sp > 1 && acc > 0.05) { acc = 0; const tr = trail[ti++ % trail.length]; tr.p.copy(root.localToWorld(wp.set(0, 0.45, 0))); tr.life = 1; }
    trail.forEach(tr => { tr.life = Math.max(0, tr.life - dt * 1.8); tr.m.visible = tr.life > 0; if (tr.m.visible) { tr.m.position.copy(root.worldToLocal(wp.copy(tr.p))); tr.m.material.opacity = tr.life * 0.45; tr.m.scale.setScalar(0.6 + (1 - tr.life) * 1.4); } });
    // landing glow burst
    const air = ctl ? !ctl.grounded : false; if (wasAir && !air) bt = 0; wasAir = air; bt += dt;
    burst.material.opacity = Math.max(0, 0.9 - bt * 1.8); burst.scale.setScalar(1 + bt * 3); };
}
function buildCapsule(spec) {
  const C = spec.colours, F = spec.features, rnd = seededRng(spec.seed), v = (a, b) => a + (b - a) * rnd(); // art-derived values first; random only nudges within art-faithful limits
  const V = { w: v(0.96, 1.05), bump: v(0.065, 0.088), bumpSq: v(0.85, 1.15), arm: v(0.12, 0.16), leg: v(0.1, 0.14), glove: v(0.085, 0.1), shoe: v(0.95, 1.1), band: v(0.25, 0.29), emX: v(-0.015, 0.015), emY: v(-0.01, 0.012), sway: v(0.6, 1.4), bounce: v(0.8, 1.25), hue: v(-0.012, 0.012), lit: v(-0.03, 0.03), wear: v(0.2, 0.6) };
  const k = Math.max(1, Math.min(1.2, spec.aspect || 1.15));
  const fc = new THREE.Color(C.body || '#8fbf38').offsetHSL(V.hue, 0, V.lit), felt = mat(fc, { roughness: 0.95, bumpMap: feltTex(), bumpScale: 0.6 }), band = mat(C.band || '#efe5cf', { roughness: 0.7 }), strap = mat(C.strap || '#6b3f26', { roughness: 0.6 });
  const glove = mat(C.gloves || '#8fb6c8', { roughness: 0.9 }), shoe = mat(C.shoes || '#f1ede2', { roughness: 0.6 }), trim = mat(C.shoeTrim || '#6fa58a'), lens = mat(C.visor || '#0a0b0c', { roughness: 0.08, metalness: 0.6 });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.userData.spec = spec; root.userData.body = body;
  const R = 0.4, cy = 0.22 + R * k; const tg = S(R, 64, 40), tp = tg.attributes.position; for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); if (y < 0) { const f = 1 + 0.09 * (-y / R); tp.setX(i, tp.getX(i) * f); tp.setZ(i, tp.getZ(i) * f); } } tg.computeVertexNormals(); const torso = mesh(tg, felt, 0, cy, 0); torso.scale.set(V.w, k, 0.92); body.add(torso); // pear-ish like the art
  if (spec.topBump !== false) { const bm = mesh(S(V.bump, 24, 16), felt, 0, cy + R * k + V.bump * 0.4, 0); bm.scale.set(1, V.bumpSq, 1); body.add(bm); }
  const thread = mat(fc.clone().multiplyScalar(0.55), { roughness: 0.9 }); // stitched side seams
  [-1, 1].forEach(s => { for (let i = 0; i < 26; i++) { const th = 0.25 + i / 25 * 2.6, x = s * Math.sin(th) * R * V.w * 1.003, y = cy + Math.cos(th) * R * k; const st = mesh(new THREE.CapsuleGeometry(0.005, 0.014, 3, 6), thread, x, y, 0); st.rotation.z = -s * th; body.add(st); } });
  const wp = mesh(S(R * 0.45, 24, 16), mat(fc.clone().lerp(new THREE.Color('#fff'), 0.12), { roughness: 1, transparent: true, opacity: V.wear * 0.5 }), 0, cy - R * k * 0.35, R * 0.66 * V.w); wp.scale.set(1, 0.8, 0.25); body.add(wp); // subtle wear patch
  const head = new THREE.Group(); head.position.y = cy + R * k * 0.28; body.add(head);
  const bandR = R * 1.015; // step 13d: parametric per-card felt mask from spec.mask (verified > auto image extractor > maskStyle), nearest library part when unknown
  const M = maskSpecFor(spec), lower = M.coverage === 'lower' || M.coverage === 'full' || M.coverage === 'muzzle', fore = M.coverage === 'forehead';
  const mtint = mat(M.tint || C.band || '#efe5cf', { roughness: 0.97, bumpMap: feltTex(), bumpScale: 0.8, side: THREE.DoubleSide });
  const mk = feltMask(R, k, V.w, cy, M, mtint, body); if (mk && mk.userData) mk.userData.stage = 2; root.userData.mask = M;
  const strapM = mat((M.straps && M.straps.colour) || C.strap || '#6b3f26', { roughness: 0.65 }), ns = M.straps ? M.straps.count : 1;
  for (let i = 0; i < ns; i++) { const t = ns === 1 ? 0.45 : 0.22 + i * 0.56, th = mk.th0 + (mk.th1 - mk.th0) * t, yn = Math.cos(th), rr = Math.sin(th), pe = mk.phAt(t);
    const sw = (M.straps && M.straps.width) || 0.017, tilt = ((M.straps && M.straps.tilt) || 0) * (i % 2 ? -1 : 1); const st = mesh(new THREE.TorusGeometry(R * 1.012 * rr, sw, 8, 56, Math.PI * 2 - pe * 2), strapM, 0, cy + R * k * yn, 0); st.rotation.set(Math.PI / 2 + tilt, 0, Math.PI / 2 + pe); st.scale.z = sw > 0.02 ? 0.45 : 1; st.scale.set(V.w, 0.92, 1); body.add(st); // back-only strap arc
    if (M.straps && M.straps.buckle) [-1, 1].forEach(s => { const bs = (M.straps.buckleSize || 1); const bx = mesh(new THREE.BoxGeometry(0.046 * bs, 0.046 * bs, 0.016), mat(M.straps.buckleColour || '#c8b48a', { metalness: 0.5, roughness: 0.4 }), s * Math.sin(pe) * R * 1.05 * rr * V.w, cy + R * k * yn, Math.cos(pe) * R * 1.05 * rr * 0.92); bx.rotation.y = s * pe; body.add(bx); bx.add(mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), strapM)); }); }
  (M.patches || []).forEach((pt, i) => { const q = mk.at(0.8 - i * 0.2, i % 2 ? -0.7 : 0.7, 0.004); const pc = typeof pt === 'object' && pt.colour ? pt.colour : new THREE.Color(M.tint || '#e6d6b8').multiplyScalar(0.72); const pm = mesh(S(0.075, 16, 10), mat(pc, { roughness: 1 }), q.x, q.y, q.z); pm.scale.set(1, 0.75, 0.15); pm.lookAt(q.clone().multiplyScalar(3).setY(q.y)); body.add(pm); }); // worn felt patch
  for (let i = 0; i < (M.vents || 0); i++) { const q = mk.at(0.5 + (i % 2) * 0.15, (i < (M.vents / 2) ? -1 : 1) * 0.8, 0.002); const vt = mesh(S(0.011, 10, 8), mat('#3a332c'), q.x, q.y, q.z); vt.scale.z = 0.4; body.add(vt); }
  if (F.emblem || M.emblem) { const em = mesh(S(0.042, 20, 12), mat('#5fd82a', { roughness: 0.35, emissive: '#39ff14', emissiveIntensity: 1.6 }), 0.06 + V.emX, 0.08 + V.emY, bandR * 0.93 + 0.004); em.scale.set(0.75, 1.15, 0.45); em.rotation.z = -0.5; head.add(em);
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g2 = cv.getContext('2d'), gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(140,255,120,0.9)'); gr.addColorStop(1, 'rgba(60,255,60,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5, toneMapped: false })); halo.scale.setScalar(0.13); halo.position.set(0.06 + V.emX, 0.08 + V.emY, bandR * 0.93 + 0.03); head.add(halo);
    const rc = document.createElement('canvas'); rc.width = 16; rc.height = 128; const g3 = rc.getContext('2d'), lg = g3.createLinearGradient(0, 128, 0, 0); lg.addColorStop(0, 'rgba(120,255,90,1)'); lg.addColorStop(1, 'rgba(57,255,20,0)'); g3.fillStyle = lg; g3.beginPath(); g3.moveTo(5, 128); g3.lineTo(8, 0); g3.lineTo(11, 128); g3.fill();
    const rays = new THREE.Group(); rays.position.copy(halo.position); head.add(rays); const rTex = new THREE.CanvasTexture(rc);
    for (let i = 0; i < 10; i++) { const ln = 0.12 + (i % 3) * 0.05, pl = new THREE.Mesh(new THREE.PlaneGeometry(0.022, ln).translate(0, ln / 2 + 0.02, 0), new THREE.MeshBasicMaterial({ map: rTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      pl.rotation.z = i / 10 * Math.PI * 2; pl.userData.ph = i * 1.7; rays.add(pl); }
    root.userData.emblem = [em, halo, rays]; } // neon 'gamma ray' emblem: core + halo + thin rotating rays (short, stays off the face) // glowing Rare bean emblem // bean emblem on the band (Rare)
  const XM = (M.coverage !== 'none' && M.xMarks) || (F.xMarks ? { count: 2, size: 'large', y: 0.17, spread: 0.12 } : { count: 0 }); // never drop detected X marks
  for (let i = 0; i < (XM.count || 0); i++) { const big = XM.size !== 'small', s = XM.count === 1 ? 0 : (i % 2 ? 1 : -1), row = Math.floor(i / 2), q = mk.surf(0.36 + (XM.y ?? 0.17) + row * 0.1, s * (XM.spread ?? 0.12) * 2 * R * V.w, 0.008);
    const xg = new THREE.Group(); xg.position.copy(q); xg.lookAt(q.clone().setY(q.y).multiplyScalar(2).setY(q.y)); body.add(xg);
    [0.75, -0.75].forEach(r => { const th = XM.thick || 1, x = mesh(new THREE.CapsuleGeometry((big ? 0.016 : 0.011) * th, (big ? 0.075 : 0.04) * (XM.len || 1), 4, 8), mat(XM.colour || C.xMarks || '#4a2e22', { roughness: 0.9 })); x.scale.z = 0.5; x.rotation.z = r; xg.add(x); }); } // stitched X marks
  const hy = R * k * 0.28 - 0.015, zAt = x => 0.92 * Math.sqrt(Math.max(0.01, R * R * (1 - (hy / (R * k)) ** 2) - x * x)); // capsule surface depth at head height
  { const E = spec.eyes || {}, st = spec.style || '3d_art', ec = E.colour || (st === 'anime' ? '#3a7ad8' : '#1a1410'), sp = (E.spacing ?? 0.1), sz = (E.size ?? 1) * (st === 'anime' ? 1.35 : st === 'realistic' ? 0.8 : 1), lift = mk.liftAt(0.36) + 0.004; // step 13h: every avatar has a face; eyewear/masks layer over it
    root.userData.eyes = [-1, 1].map(s => { const g = new THREE.Group(), x = s * sp; g.position.set(x, -0.01, zAt(x) + lift); g.rotation.y = s * Math.asin(Math.min(0.9, x / R)) * 0.9; head.add(g);
      if (st === '3d_art' && !E.sclera) { const b = mesh(S(0.038 * sz, 16, 12), mat(ec, { roughness: 0.15 })); b.scale.set(1, 1.25, 0.5); g.add(b); }
      else { const w = mesh(S(0.045 * sz, 16, 12), mat('#fbfbf7', { roughness: 0.4 })); w.scale.set(st === 'anime' ? 0.9 : 1, st === 'anime' ? 1.35 : 1.05, 0.35); g.add(w);
        const ir = mesh(S((st === 'realistic' ? 0.022 : 0.028) * sz, 14, 10), mat(ec, { roughness: 0.2 }), 0, st === 'anime' ? -0.006 : 0, 0.012); ir.scale.set(1, st === 'anime' ? 1.4 : 1, 0.4); g.add(ir);
        if (st === 'realistic' || st === 'anime') { const pu = mesh(S(0.011 * sz, 10, 8), mat('#050505'), 0, 0, 0.018); pu.scale.z = 0.4; g.add(pu); } }
      const hl = mesh(S(0.009 * sz, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 0.012 * sz, 0.016 * sz, 0.024); g.add(hl); return g; }); }
  if (F.eyewear) { [-1, 1].forEach(s => { const l = mesh(S(0.1, 24, 16), lens, s * 0.115, -0.015, zAt(s * 0.115) + 0.014 + mk.liftAt(0.36)); l.scale.set(1.15, 0.75, 0.35); l.rotation.y = s * Math.asin(Math.min(0.9, 0.115 / R)) * 0.9; head.add(l); });
    head.add(mesh(new THREE.BoxGeometry(0.05, 0.014, 0.02), lens, 0, 0.01, zAt(0) + 0.022 + mk.liftAt(0.36)));
    const st = mesh(new THREE.TorusGeometry(zAt(0) / 0.92 + 0.006 + mk.liftAt(0.36), 0.009, 6, 48), lens, 0, 0.0, 0); st.rotation.x = Math.PI / 2; st.scale.y = 0.93; head.add(st); }
  const limb = (x, y, len, r, m, endGeo, endM, endPos) => { const g = new THREE.Group(); g.position.set(x, y, 0); g.add(mesh(cap(r, len), m, 0, -len / 2, 0)); const e = mesh(endGeo, endM, ...endPos(len)); g.add(e); body.add(g); return [g, e]; };
  // step 13c: art-matched limbs: short thick tapered arms + big mittens with thumbs; tiny stub legs in OVERSIZED chunky sneakers (kid-in-big-shoes look)
  const arms = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * R * V.w * 0.93, cy - 0.04, 0.02); body.add(g); const al = V.arm * 0.9;
    const up = mesh(new THREE.CylinderGeometry(0.052, 0.068, al, 20), felt, 0, -al / 2, 0); g.add(up); g.add(mesh(S(0.068, 20, 14), felt, 0, 0, 0));
    const mit = new THREE.Group(); mit.position.set(s * 0.012, -al - 0.06, 0.02); g.add(mit); const gm = F.gloves ? glove : felt;
    const palm = mesh(S(V.glove * 1.2, 24, 18), gm); palm.scale.set(1, 1.15, 0.82); mit.add(palm); const cuff = mesh(new THREE.TorusGeometry(0.06, 0.02, 10, 24), gm, 0, 0.085, 0); cuff.rotation.x = Math.PI / 2; mit.add(cuff);
    const th = mesh(S(0.045, 16, 12), gm, -s * 0.07, 0.01, 0.05); th.scale.set(0.9, 1.3, 0.9); th.rotation.z = s * 0.5; mit.add(th); g.rotation.z = s * 0.35; return g; });
  const legs = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * 0.15 * V.w, 0.22, 0); body.add(g); g.add(mesh(cap(0.06, 0.04), felt, 0, -0.03, 0)); if (F.shoes) g.add(sneaker(s, V, C)); else g.add(mesh(S(0.08), felt, 0, -0.1, 0.03)); return g; });
  if (F.necklace) { const nk = mat('#c9ced4', { metalness: 0.95, roughness: 0.25 }); for (let i = 0; i < 22; i++) { const th = -1.25 + i / 21 * 2.5, l = mesh(new THREE.TorusGeometry(0.02, 0.007, 8, 16), nk, Math.sin(th) * R * 0.92, cy - R * k * 0.45 - Math.cos(th * 0.9) * 0.07, Math.cos(th) * R * 0.86); l.rotation.y = th + (i % 2) * Math.PI / 2; body.add(l); } }
  const sway = spec.wearables ? addWearables(body, spec.wearables, R, cy, k) : [];
  let trail = null;
  if (spec.heldItems) spec.heldItems.forEach(h => { if (h.attach === 'desk') { trail = addTrailer(root, arms[h.hand === 'left' ? 0 : 1], h, spec.tier === 'Legendary'); return; } const piv = addHeld(arms[h.hand === 'left' ? 0 : 1], h, spec.tier === 'Legendary', body); if (piv) sway.push(piv); });
  root.userData.animate = (t, dt, ctl, walkT) => {
    const B = ctl ? ctl.blend : { idle: 1, walk: 0, run: 0, jump: 0, fall: 0, land: 0 }, mv = B.walk + B.run;
    sway.forEach((g, i) => { g.rotation.x = Math.sin(walkT * 2 + i) * 0.25 * mv + (B.jump + B.fall) * 0.35 * (i % 2 ? 1 : -1) * 0.6 + Math.sin(t * 1.3 + i) * 0.03; g.rotation.z = Math.sin(walkT + i * 1.3) * 0.15 * mv; });
    if (trail) trail(t, dt, ctl);
    sway.forEach((g, i) => { if (g.userData.aura) g.userData.aura.material.opacity = 0.4 + 0.25 * Math.sin(t * 2 + i); });
    if (root.userData.lockGlow && !root.userData.lockTier) { const p = 0.5 + 0.5 * Math.sin(t * 1.8); root.userData.lockGlow[0].emissiveIntensity = 0.6 + 0.7 * p; root.userData.lockGlow[1].material.opacity = 0.25 + 0.25 * p; }
    const sw = Math.sin(walkT) * (0.6 * B.walk + 0.95 * B.run);
    legs[0].rotation.x = sw - (ctl && ctl.hopping ? 0.8 : 0); legs[1].rotation.x = -sw - (ctl && ctl.hopping ? 0.8 : 0);
    arms[0].rotation.x = -sw * 0.9; arms[1].rotation.x = sw * 0.9; arms[0].rotation.z = -0.35 - 0.9 * (B.jump + B.fall); arms[1].rotation.z = 0.35 + 0.9 * (B.jump + B.fall);
    body.position.y = Math.abs(Math.sin(walkT)) * 0.06 * V.bounce * mv + Math.sin(t * 2 * V.sway) * 0.015 * B.idle - 0.06 * B.land; body.rotation.y = Math.sin(t * 0.7 * V.sway) * 0.05 * B.idle; // per-NFT idle quirk
    body.rotation.z = Math.sin(walkT) * 0.07 * mv; body.rotation.x = Math.min((ctl ? ctl.speed : 0) / 6, 1) * 0.15;
    if (root.userData.emblem && !root.userData.emblemTier) { const p = 0.5 + 0.5 * Math.sin(t * 1.6); root.userData.emblem[0].material.emissiveIntensity = 0.9 + 0.5 * p; root.userData.emblem[1].material.opacity = 0.3 + 0.2 * p; const R = root.userData.emblem[2]; R.rotation.z = t * 0.25; R.children.forEach(c => { const q = 0.5 + 0.5 * Math.sin(t * 2.2 + c.userData.ph); c.material.opacity = 0.35 + 0.5 * q; c.scale.y = 0.7 + 0.45 * q; }); } // slow gentle pulse
    if (root.userData.legend) root.userData.legend(t, dt, ctl);
  if (spec.wearables) root.userData.lockGlow = body.userData.lockGlow;
    if (ctl) root.scale.copy(ctl.scale); else root.scale.set(1, 1, 1); root.scale.multiplyScalar(root.userData.hScale); };
  root.userData.hScale = (spec.height || 5) / 5;
  root.userData.nativeObjs = { emblem: root.userData.emblem && root.userData.emblem[0], belt: body.userData.belt, lock: body.userData.lockObj }; // step 13i
  const tc = { Rare: '#5fb8ff', Legendary: '#ffcc55', Epic: '#c07bff' }[spec.tier];
  { const al = V.arm * 0.9, V3 = (x, y, z) => new THREE.Vector3(x, y, z), nkY = cy - R * k * 0.12; // step 13f: attach points for the generic trait builder
    root.userData.anchors = { head: { obj: body, pos: V3(0, cy + R * k * 0.96, 0), s: 1.9 }, face: { obj: body, pos: V3(0, cy + R * k * 0.28, R * 0.92 + 0.03), s: 1.6 },
      neck: { obj: body, pos: V3(0, nkY, 0), s: R * V.w * 1.02 / 0.21 }, chest: { obj: body, pos: V3(0, cy - R * k * 0.25, R * 0.92 * 0.97), s: 1 },
      back: { obj: body, pos: V3(0, cy, -R * 0.92), s: 1.5 }, tail: { obj: body, pos: V3(0, 0.38, -R * 0.86), s: 1.3 }, waist: { obj: body, pos: V3(0, cy - R * k * 0.5, 0), r: R * V.w * 0.95 },
      wrists: arms.map((g, i) => ({ obj: g, pos: V3((i ? 1 : -1) * 0.012, -al + 0.01, 0.02), s: 1.05 })), hands: arms.map((g, i) => ({ obj: g, pos: V3((i ? 1 : -1) * 0.012, -al - 0.06, 0.06), s: 1 })),
      ankles: legs.map(g => ({ obj: g, pos: V3(0, -0.04, 0), s: 1 })) };
    const Mk = root.userData.mask || {}; root.userData.native = [...(Mk.coverage !== 'none' ? ['mask'] : []), ...(F.eyewear ? ['eyewear'] : []), ...(F.gloves ? ['gloves'] : []), ...(F.shoes ? ['shoes'] : []), ...(F.necklace ? ['chain', 'necklace'] : []), ...(F.emblem || Mk.emblem ? ['patch'] : []), ...(F.xMarks || (Mk.xMarks && Mk.xMarks.count) ? ['markings'] : []), ...(spec.wearables ? ['belt', 'held'] : []), ...(spec.heldItems ? ['held'] : [])]; }
  if (spec.tier === 'Legendary') root.userData.legend = addLegendary(root, torso, cy, R, k, V.w);
  else if (tc) { const r = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.55, 40), new THREE.MeshBasicMaterial({ color: tc, transparent: true, opacity: 0.5, toneMapped: false, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; r.position.y = 0.02; root.add(r); }
  return root;
}
const ink = () => mat('#15151a', { roughness: 0.3 });
// Step 11e+: held props (profile.heldItems). Chain from the glove with an item hanging at the end; Legendary => gold aura.
const PROPS = {
  laptop: () => { const g = new THREE.Group(), al = mat('#9aa0a8', { metalness: 0.8, roughness: 0.35 });
    const base = mesh(new THREE.BoxGeometry(0.2, 0.012, 0.14), al, 0, 0, 0); g.add(base); const lid = new THREE.Group(); lid.position.set(0, 0.006, -0.07); lid.rotation.x = -0.3; g.add(lid);
    lid.add(mesh(new THREE.BoxGeometry(0.2, 0.135, 0.01), al, 0, 0.068, 0)); const scr = mesh(new THREE.PlaneGeometry(0.18, 0.115), mat('#2a2f36', { roughness: 0.2, emissive: '#1a2028', emissiveIntensity: 0.6 }), 0, 0.068, 0.006); lid.add(scr);
    [0.7, -0.7].forEach(r => { const x = mesh(new THREE.BoxGeometry(0.006, 0.05, 0.002), mat('#d8dde2', { emissive: '#ffffff', emissiveIntensity: 0.4 }), 0, 0.068, 0.008); x.rotation.z = r; lid.add(x); }); g.rotation.x = 0.35; return g; },
  timelock: () => TOOLS.timelock('#c9a24a'),
  lantern: () => { const g = new THREE.Group(), br = mat('#b08a3a', { metalness: 0.85, roughness: 0.3 }); g.add(mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 14), br, 0, 0.02, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.02, 16), br, 0, -0.02, 0)); g.add(mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.02, 16), br, 0, -0.16, 0));
    for (let i = 0; i < 4; i++) { const a2 = i / 4 * Math.PI * 2; g.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.13, 6), br, Math.cos(a2) * 0.05, -0.09, Math.sin(a2) * 0.05)); }
    const fl = mesh(new THREE.SphereGeometry(0.028, 12, 10), mat('#ffd27a', { emissive: '#ffb040', emissiveIntensity: 2 }), 0, -0.09, 0); fl.scale.y = 1.4; g.add(fl);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffc870', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); gl.position.y = -0.09; g.add(gl); return g; },
  desk: () => { const g = new THREE.Group(), wood = mat('#7a4e2c', { roughness: 0.7 }), dk = mat('#2a2522', { roughness: 0.5 });
    const top = mesh(new THREE.BoxGeometry(0.46, 0.035, 0.3), wood, 0, 0.26, 0); g.add(top);
    [[0, 0.15, 0.46, 0.012], [0, -0.15, 0.46, 0.012], [0.23, 0, 0.012, 0.3], [-0.23, 0, 0.012, 0.3]].forEach(([x, z, w, d]) => g.add(mesh(new THREE.BoxGeometry(w, 0.04, d), wood, x, 0.295, z))); // raised rim
    [[-0.19, -0.11], [0.19, -0.11], [-0.19, 0.11], [0.19, 0.11]].forEach(([x, z]) => g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.17, 10), wood, x, 0.16, z)));
    g.add(mesh(new THREE.BoxGeometry(0.42, 0.025, 0.025), wood, 0, 0.1, 0.11)); g.add(mesh(new THREE.BoxGeometry(0.42, 0.025, 0.025), wood, 0, 0.1, -0.11));
    const wheels = [[-0.19, -0.11], [0.19, -0.11], [-0.19, 0.11], [0.19, 0.11]].map(([x, z]) => { const cs = new THREE.Group(); cs.position.set(x, 0.055, z); g.add(cs); const w = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20), dk); w.rotation.z = Math.PI / 2; cs.add(w); w.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.034, 12), mat('#a08850', { metalness: 0.8 }))); return cs; });
    const lap = PROPS.laptop(); lap.rotation.x = 0; lap.scale.setScalar(1.2); lap.position.set(0.02, 0.285, 0.01); g.add(lap);
    g.userData.wheels = wheels; g.userData.lap = lap; g.userData.handle = new THREE.Vector3(0, 0.27, 0.16); return g; }
};
// Step 11g: B34N5 desk trailer - independent spring/rope physics in world space (lags, catches up, swings on turns, bounces on landings, laptop wobble).
function addTrailer(root, arm, h, legendary) {
  const cart = PROPS.desk(); root.add(cart); const steel = mat('#b9bec4', { metalness: 0.9, roughness: 0.3 }), N = 16, links = [];
  for (let i = 0; i < N; i++) { const l = mesh(new THREE.TorusGeometry(0.015, 0.0055, 10, 20), steel); l.scale.y = 1.5; root.add(l); links.push(l); }
  const hand = new THREE.Object3D(); hand.position.set(0.01, -0.25, 0.04); arm.add(hand);
  const S0 = { p: null, v: new THREE.Vector3(), vy: 0, yaw: 0, yawV: 0, roll: 0, wob: 0, wobV: 0, groundY: 0, rot: 0, lastYaw: 0 };
  const tmp = new THREE.Vector3(), hw = new THREE.Vector3(), cw = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), off = new THREE.Vector3(0.55, 0, -0.45), L = 0.95;
  return (t, dt, ctl) => {
    dt = Math.min(dt, 0.05); root.updateMatrixWorld(true); root.getWorldQuaternion(q); e.setFromQuaternion(q, 'YXZ'); const rootYaw = e.y;
    const target = root.localToWorld(tmp.copy(off)); const rp = root.getWorldPosition(new THREE.Vector3());
    if (!S0.p) { S0.p = target.clone(); S0.groundY = rp.y; S0.p.y = rp.y; S0.yaw = rootYaw; }
    if (!ctl || ctl.grounded) S0.groundY += (rp.y - S0.groundY) * Math.min(1, dt * 12);
    // horizontal spring toward slot + rope limit to the hand
    const ax = (target.x - S0.p.x) * 18 - S0.v.x * 6.5, az = (target.z - S0.p.z) * 18 - S0.v.z * 6.5;
    S0.v.x += ax * dt; S0.v.z += az * dt; S0.p.x += S0.v.x * dt; S0.p.z += S0.v.z * dt;
    hand.getWorldPosition(hw); const dx = S0.p.x - hw.x, dz = S0.p.z - hw.z, d = Math.hypot(dx, dz);
    if (d > L) { S0.p.x = hw.x + dx / d * L; S0.p.z = hw.z + dz / d * L; S0.v.multiplyScalar(0.9); }
    // vertical: gravity + soft bounce on the remembered floor (stays on the ground during hops)
    S0.vy -= 14 * dt; S0.p.y += S0.vy * dt; let bump = 0;
    if (S0.p.y < S0.groundY) { if (S0.vy < -0.6) { bump = -S0.vy; S0.vy = -S0.vy * 0.32; S0.wobV += bump * 2.5; } else S0.vy = 0; S0.p.y = S0.groundY; }
    // yaw follows travel direction (casters swing first), roll on turns
    const sp = Math.hypot(S0.v.x, S0.v.z), want = sp > 0.3 ? Math.atan2(S0.v.x, S0.v.z) : S0.yaw, dy = Math.atan2(Math.sin(want - S0.yaw), Math.cos(want - S0.yaw));
    S0.yawV += (dy * 10 - S0.yawV * 4) * dt; S0.yaw += S0.yawV * dt; S0.roll += (-S0.yawV * 0.05 * Math.min(1, sp) - S0.roll) * Math.min(1, dt * 6);
    S0.wobV += (-S0.wob * 60 - S0.wobV * 5 - (ax + az) * 0.004) * dt; S0.wob += S0.wobV * dt; S0.rot += sp * dt / 0.05;
    // write back in root-local space (undo root squash so the desk keeps its size)
    cart.position.copy(root.worldToLocal(cw.copy(S0.p))); cart.rotation.set(0, S0.yaw - rootYaw, S0.roll); cart.scale.set(1 / root.scale.x, 1 / root.scale.y, 1 / root.scale.z);
    cart.userData.wheels.forEach((c, i) => { c.rotation.y = Math.max(-0.8, Math.min(0.8, S0.yawV * 0.25)) * (i < 2 ? 1 : -1); c.children[0].rotation.x = S0.rot; });
    const lp = cart.userData.lap; lp.rotation.z = S0.wob * 0.06; lp.rotation.x = S0.wob * 0.04; lp.position.y = 0.285 + Math.max(0, S0.wob) * 0.004;
    // chain: sagging, swaying curve hand -> desk handle
    const hl = root.worldToLocal(hw.clone()), cl = root.worldToLocal(cart.localToWorld(cart.userData.handle.clone())), dist = hl.distanceTo(cl), sag = Math.max(0.04, (L + 0.25 - dist) * 0.45);
    for (let i = 0; i < N; i++) { const f = (i + 0.5) / N, l = links[i]; l.position.lerpVectors(hl, cl, f); l.position.y -= Math.sin(f * Math.PI) * sag; l.position.x += Math.sin(f * Math.PI) * Math.sin(t * 3 + i * 0.4) * 0.01 * (0.3 + sp);
      const g = (i + 1.5) / N; tmp.lerpVectors(hl, cl, g); tmp.y -= Math.sin(g * Math.PI) * sag; l.lookAt(root.localToWorld(tmp.clone())); l.rotateY(i % 2 ? Math.PI / 2 : 0); }
  };
}
function addHeld(arm, h, legendary, body) {
  const hand = new THREE.Group(); hand.userData.stage = 3; hand.position.set(0.01, -0.24, 0.04); arm.add(hand); const piv = new THREE.Group(); hand.add(piv);
  const steel = mat('#b9bec4', { metalness: 0.9, roughness: 0.3 }), n = h.item === 'lantern' || h.attach === undefined ? 0 : 9; if (h.item === 'lantern') h = Object.assign({}, h, { attach: 'lantern' });
  for (let i = 0; i < n; i++) { const l = mesh(new THREE.TorusGeometry(0.016, 0.005, 6, 12), steel, 0, -i * 0.024, 0); l.rotation.y = i % 2 ? Math.PI / 2 : 0; l.scale.y = 1.4; piv.add(l); }
  if (h.attach && PROPS[h.attach]) { const p = PROPS[h.attach](); p.position.y = -n * 0.024 - 0.05; piv.add(p); if (p.userData.glow) { body.userData.lockGlow = p.userData.glow; body.userData.lockObj = p; } }
  if (legendary) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c2 = cv.getContext('2d'), gr = c2.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,214,110,0.85)'); gr.addColorStop(1, 'rgba(255,190,60,0)'); c2.fillStyle = gr; c2.fillRect(0, 0, 64, 64);
    const au = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6, toneMapped: false })); au.scale.set(0.32, 0.42, 1); au.position.y = -n * 0.024 * 0.7; piv.add(au); piv.userData.aura = au; }
  return piv;
}
// Step 11e: generic 'scene props -> wearables' (profile.wearables). Returns pivot groups that sway.
const TOOLS = {
  wrench: c => { const g = new THREE.Group(); g.add(mesh(new THREE.CapsuleGeometry(0.012, 0.16, 4, 10), mat(c, { metalness: 0.9, roughness: 0.3 }), 0, -0.1, 0));
    const jaw = mesh(new THREE.TorusGeometry(0.024, 0.01, 8, 20, Math.PI * 1.4), mat(c, { metalness: 0.9, roughness: 0.3 }), 0, -0.2, 0); jaw.rotation.z = Math.PI * 0.8; g.add(jaw); return g; },
  screwdriver: c => { const g = new THREE.Group(); g.add(mesh(new THREE.CapsuleGeometry(0.02, 0.06, 6, 14), mat(c, { roughness: 0.35 }), 0, -0.05, 0)); g.add(mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.1, 10), mat('#c8ccd2', { metalness: 0.9, roughness: 0.25 }), 0, -0.14, 0)); return g; },
  pliers: c => { const g = new THREE.Group(); [-1, 1].forEach(s => { const h = mesh(new THREE.CapsuleGeometry(0.01, 0.09, 4, 10), mat(c === '#2a2b30' ? '#c8342c' : c, { roughness: 0.4 }), s * 0.014, -0.05, 0); h.rotation.z = s * 0.15; g.add(h);
      const j = mesh(new THREE.CapsuleGeometry(0.007, 0.05, 4, 8), mat('#9aa0a8', { metalness: 0.9, roughness: 0.3 }), s * 0.004, -0.14, 0); j.rotation.z = -s * 0.12; g.add(j); }); return g; },
  hammer: c => { const g = new THREE.Group(); g.add(mesh(new THREE.CapsuleGeometry(0.012, 0.15, 4, 10), mat('#8a5a36'), 0, -0.09, 0)); const h = mesh(new THREE.CapsuleGeometry(0.02, 0.06, 6, 12), mat(c, { metalness: 0.8, roughness: 0.3 }), 0, -0.19, 0); h.rotation.z = Math.PI / 2; g.add(h); return g; },
  timelock: c => { const g = new THREE.Group(), bm = mat(c, { metalness: 0.85, roughness: 0.3, emissive: '#ffb030', emissiveIntensity: 0.8 });
    g.add(mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 16), bm, 0, -0.02, 0)); g.add(mesh(new RoundedBox(0.07, 0.065, 0.045), bm, 0, -0.07, 0));
    const face = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 20), mat('#f4ecd6', { emissive: '#fff2c0', emissiveIntensity: 0.6 }), 0, -0.07, 0.025); face.rotation.x = Math.PI / 2; g.add(face);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10), new THREE.MeshBasicMaterial({ color: '#ffc860', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); halo.position.y = -0.07; g.add(halo); g.userData.glow = [bm, halo]; return g; }
};
function RoundedBox(w, h, d) { const g = new THREE.CapsuleGeometry(Math.min(w, d) / 2, h - Math.min(w, d), 6, 12); g.scale(w / Math.min(w, d), 1, d / Math.min(w, d)); return g; }
function addWearables(body, W, R, cy, k) {
  const out = [], y = cy - R * k * 0.45, rr = R * Math.sqrt(1 - 0.45 * 0.45) * 1.04; // waist height on the capsule
  const belt = mesh(new THREE.TorusGeometry(rr, 0.03, 12, 48), mat((W.belt && W.belt.colour) || '#6b4528', { roughness: 0.6 }), 0, y, 0); belt.rotation.x = Math.PI / 2; belt.scale.y = 0.93; body.add(belt); body.userData.belt = belt;
  body.add(mesh(new THREE.TorusGeometry(0.035, 0.01, 8, 20), mat((W.belt && W.belt.buckle) || '#c9a24a', { metalness: 0.9, roughness: 0.25 }), 0, y, rr * 0.93 + 0.02));
  const beltItems = W.items.filter(i => i.slot === 'belt'), angs = [-0.95, -0.55, 0.6, 0.95];
  beltItems.forEach((it, i) => { const a = angs[i % 4], piv = new THREE.Group(); piv.position.set(Math.sin(a) * (rr + 0.02), y - 0.01, Math.cos(a) * (rr + 0.02) * 0.93); piv.rotation.y = a; body.add(piv);
    piv.add(mesh(new THREE.CapsuleGeometry(0.03, 0.03, 4, 10), mat('#5a3a22', { roughness: 0.7 }), 0, -0.03, 0.005)); // smooth leather loop
    const tool = (TOOLS[it.item] || TOOLS.wrench)(it.colour || '#b8bec6'); tool.rotation.z = (i % 2 ? 0.12 : -0.12); tool.scale.setScalar(1.5); piv.add(tool); out.push(piv); });
  W.items.filter(i => i.slot === 'charm').forEach(it => { const piv = new THREE.Group(); piv.position.set(0.09, y - 0.02, rr * 0.93 + 0.03); body.add(piv); const c = (TOOLS[it.item] || TOOLS.timelock)(it.colour || '#c9a24a'); piv.add(c); out.push(piv); if (c.userData.glow) body.userData.lockGlow = c.userData.glow; });
  return out;
}
// Step 12: per-style render pass. anime = 3-band cel + thin ink outline; cartoon = 2-band bold toon + thick outline;
// 3d_art = soft PBR felt/clay with sheen (default); realistic = physical clearcoat/sheen, subtler proportions.
const gradTex = n => { const d = new Uint8Array(n); for (let i = 0; i < n; i++) d[i] = Math.round(255 * (0.35 + 0.65 * i / (n - 1))); const t = new THREE.DataTexture(d, n, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; };
export function applyStyle(root, style) {
  const list = []; root.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial && !o.userData.outline) list.push(o); });
  list.forEach(o => { const m = o.material, c = m.color.clone(), em = m.emissive.clone(), ei = m.emissiveIntensity;
    if (style === 'anime' || style === 'cartoon') {
      o.material = new THREE.MeshToonMaterial({ color: style === 'cartoon' ? c.clone().offsetHSL(0, 0.12, 0.03) : c, gradientMap: gradTex(style === 'cartoon' ? 2 : 3), emissive: em, emissiveIntensity: ei, side: m.side });
      const g = o.geometry; g.computeBoundingSphere(); if (g.boundingSphere.radius < 0.012) return;
      const ol = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: style === 'anime' ? '#2a1e2e' : '#101014', side: THREE.BackSide }));
      ol.userData.outline = true; ol.scale.setScalar(1 + (style === 'cartoon' ? 0.045 : 0.025) / Math.max(0.05, g.boundingSphere.radius) * 0.1 + (style === 'cartoon' ? 0.035 : 0.018)); o.add(ol); }
    else if (style === 'realistic') o.material = new THREE.MeshPhysicalMaterial({ color: c, roughness: Math.min(0.75, m.roughness), metalness: m.metalness, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.6, sheenRoughness: 0.5, sheenColor: c.clone().lerp(new THREE.Color('#fff'), 0.4), emissive: em, emissiveIntensity: ei, side: m.side });
    else if (m.roughness > 0.8) o.material = new THREE.MeshPhysicalMaterial({ color: c, roughness: m.roughness, sheen: 1, sheenRoughness: 0.8, sheenColor: c.clone().lerp(new THREE.Color('#fff'), 0.5), emissive: em, emissiveIntensity: ei, side: m.side }); // felt/clay
    o.castShadow = true; });
  if (style === 'realistic') root.children[0] && root.children[0].scale.set(0.94, 1.07, 0.94);
  root.userData.style = style || '3d_art'; return root;
}

/* Opt-in voxel Power Zerp experiment (Beans 2026-11-05): each opaque NFT pixel →
   a small cube via InstancedMesh (~1 draw call). Background (corner colour) culled.
   Rides the armoured humanoid so limbs still walk. Never the default path —
   pass spec.voxel = { image|canvas|imageData, depth?, cell?, bgTol?, maxSide? }
   or spec.voxel=true with spec.voxelSource. */
function sampleBgRGBA(data, w, h) {
  const idx = (x, y) => (y * w + x) * 4;
  const corners = [idx(0, 0), idx(w - 1, 0), idx(0, h - 1), idx(w - 1, h - 1)];
  let r = 0, g = 0, b = 0, a = 0;
  corners.forEach(i => { r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3]; });
  return [r / 4, g / 4, b / 4, a / 4];
}
function colourDist3(r, g, b, br, bg, bb) {
  const dr = r - br, dg = g - bg, db = b - bb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
export function buildVoxelMesh(source, opts = {}) {
  let w, h, data;
  if (source && source.data && source.width) { w = source.width; h = source.height; data = source.data; }
  else {
    const img = source;
    const iw = img.width || img.naturalWidth || 64, ih = img.height || img.naturalHeight || 64;
    const maxSide = opts.maxSide || 48;
    const scale = Math.min(1, maxSide / Math.max(iw, ih));
    w = Math.max(8, Math.round(iw * scale)); h = Math.max(8, Math.round(ih * scale));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, w, h);
    data = ctx.getImageData(0, 0, w, h).data;
  }
  const bg = sampleBgRGBA(data, w, h);
  const tol = opts.bgTol != null ? opts.bgTol : 42;
  const depth = Math.max(1, opts.depth != null ? opts.depth : 8);
  const cell = opts.cell != null ? opts.cell : 1;
  const positions = [], colors = [];
  const z0 = -((depth - 1) / 2); // center extrusion so side-on still has body thickness
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 18) continue;
      const d = colourDist3(r, g, b, bg[0], bg[1], bg[2]);
      if (d < tol) continue; // drop studio / flat backdrop
      for (let zi = 0; zi < depth; zi++) {
        const f = 1 - Math.abs(zi - (depth - 1) / 2) * 0.06;
        positions.push(x, (h - 1 - y), z0 + zi);
        colors.push((r / 255) * f, (g / 255) * f, (b / 255) * f);
      }
    }
  }
  const count = positions.length / 3;
  if (!count) return null;
  const geo = new THREE.BoxGeometry(cell * 0.92, cell * 0.92, cell * 0.92);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.22, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  for (let i = 0; i < count; i++) {
    dummy.position.set((positions[i * 3] - cx) * cell, (positions[i * 3 + 1] - cy) * cell, positions[i * 3 + 2] * cell);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.setRGB(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.voxel = { w, h, count, depth, drawCalls: 1 };
  return mesh;
}
function attachVoxelToArmour(root, source, opts = {}) {
  const vox = buildVoxelMesh(source, opts);
  if (!vox) return null;
  const targetH = opts.targetH != null ? opts.targetH : 1.2;
  // provisional place to measure
  root.add(vox);
  const box = new THREE.Box3().setFromObject(vox);
  const size = new THREE.Vector3(); box.getSize(size);
  const s = targetH / Math.max(0.001, size.y);
  vox.scale.setScalar(s);
  box.setFromObject(vox);
  const c = new THREE.Vector3(); box.getCenter(c);
  vox.position.x -= c.x; vox.position.z -= c.z;
  box.setFromObject(vox);
  vox.position.y -= box.min.y; vox.position.y += 0.02;
  vox.name = 'voxelBody';
  // Hide procedural meshes; keep Groups so animate() still swings limbs under the voxel figure
  root.traverse(o => { if (o.isMesh && o !== vox) o.visible = false; });
  vox.visible = true;
  // Re-parent onto body so walk bob / sway carries the voxel
  const body = root.userData.body;
  if (body) { root.remove(vox); body.add(vox); }
  root.userData.voxel = vox.userData.voxel;
  root.userData.voxelMesh = vox;
  root.userData.voxelMode = true;
  return vox;
}
function applyVoxelOptIn(root, spec) {
  if (!spec || !spec.voxel) return root;
  const src = (typeof spec.voxel === 'object')
    ? (spec.voxel.source || spec.voxel.imageData || spec.voxel.canvas || spec.voxel.image)
    : spec.voxelSource;
  if (!src) return root;
  const opts = typeof spec.voxel === 'object' ? spec.voxel : {};
  try { attachVoxelToArmour(root, src, opts); } catch (e) { console.warn('[avatar3d] voxel attach failed', e); }
  return root;
}

export function buildAvatar(spec) {
  // Walking object/canvas: explicit object-trait (cup/mug etc.) always uses item builder;
  // otherwise keep v29 rule — characters with eyes/detected features never become items.
  if (spec.type === 'object' || spec.type === 'canvas') {
    const explicitObj = spec.typeFrom === 'object-trait' && spec.item && spec.item.template;
    const noChar = !spec.heldItems && !spec.eyes && !(spec.detected || []).length;
    if (explicitObj || noChar) return buildItem(spec);
  }
  let r = buildAvatarBase(spec); if (spec.item && spec.item.category === 'hat') addHat(r, spec.item); if (r.userData.anchors) buildFeatures(r, spec.detected || []); // step 13f: every detected feature -> closest part
  r = applyStyle(r, spec.style || '3d_art'); // style pass first, so tier glow sits on the final materials
  (r.userData.pendingGlow || []).forEach(([o, tier, c, sd]) => applyTierGlow(r, o, tier, c, sd)); // step 13i: per-trait tier glow (generic parts)
  const TT = spec.traitTiers || {}, N = r.userData.nativeObjs || {}; r.userData.nativeGlow = {}; // tiers on native parts (verified traitTiers)
  for (const [k, tier] of Object.entries(TT)) if (N[k]) { r.userData.nativeGlow[k] = applyTierGlow(r, N[k], tier, null, k.length * 7 + 3); if (k === 'emblem') r.userData.emblemTier = tier; if (k === 'lock') r.userData.lockTier = tier; }
  if (r.userData.tierGlows) { const an = r.userData.animate; r.userData.animate = (t, ...a) => { an(t, ...a); r.userData.tierGlows.forEach(g => g(t)); }; }
  applyVoxelOptIn(r, spec); // opt-in only — default remains armoured humanoid
  return r; }
function buildAvatarBase(spec) {
  if (spec.type === 'capsule' || spec.type === 'generic' || spec._avatarType === 'capsule') return buildCapsule(spec);
  const P = T[spec.type] || T.human, col = spec.colours.body || '#9a9aa0', acc = spec.colours.accent;
  const m = mat(col, P.armour ? { metalness: 0.55, roughness: 0.32, flatShading: true } : P.metal ? { metalness: 0.35, roughness: 0.3 } : P.bones ? { roughness: 0.7 } : {});
  const dark = mat(shade(col, 0.45)), light = mat(new THREE.Color(col).lerp(new THREE.Color('#fff'), 0.45)), ink = mat('#15151a', { roughness: 0.3 });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.userData.spec = spec;
  const [br, bl] = P.body, hipY = 0.42, torsoY = hipY + bl / 2 + br * 0.6;
  // torso
  const torso = mesh(P.bones ? cap(0.08, bl) : (P.armour ? new THREE.BoxGeometry(br * 1.35, bl * 0.85, br * 0.9) : cap(br, bl * 0.6)), P.bones ? m : m, 0, torsoY, 0); body.add(torso);
  if (P.bones) for (let i = 0; i < 4; i++) { const r = mesh(new THREE.TorusGeometry(0.17 - i * 0.015, 0.025, 10, 28, Math.PI * 1.6), m, 0, torsoY + 0.18 - i * 0.09, 0); r.rotation.set(Math.PI / 2, 0, Math.PI * 0.7); body.add(r); }
  else if (!P.metal && !P.armour && spec.type !== 'bean') { const belly = mesh(S(br * 0.8), light, 0, torsoY - 0.02, br * 0.32); belly.scale.set(0.8, 1, 0.5); body.add(belly); }
  if (P.stripes) for (let i = 0; i < 3; i++) { const s = mesh(new THREE.TorusGeometry(br * 1.0, 0.018, 8, 32), ink, 0, torsoY + 0.12 - i * 0.12, 0); s.rotation.x = Math.PI / 2; s.scale.y = 1.02; body.add(s); }
  // head (bean = head and body are one pod)
  const head = new THREE.Group(); const hr = P.head || 0.3; head.position.set(0, P.head ? torsoY + bl * 0.5 + hr * 0.9 : torsoY + 0.18, P.head ? 0.02 : 0.2); body.add(head);
  if (P.head) {
    const h = mesh(P.armour ? new THREE.BoxGeometry(hr * 1.55, hr * 1.45, hr * 1.5) : S(hr, 40, 28), m);
    if (P.metal && !P.armour) h.scale.set(1.05, 0.9, 1);
    if (spec.type === 'frog') h.scale.set(1.2, 0.75, 1);
    if (P.armour) h.material = mat(shade(col, 0.35), { metalness: 0.5, roughness: 0.4, flatShading: true }); // dark under-suit, plates/helmet cover
    head.add(h);
  }
  if (spec.type === 'bean') { torso.scale.set(1, 1.05, 0.85); const seam = mesh(new THREE.TorusGeometry(br * 1.0, 0.012, 8, 40, Math.PI), dark, 0, torsoY, 0); seam.rotation.y = Math.PI / 2; body.add(seam); }
  const fz = P.head ? hr * 0.92 : 0.16; // face depth
  // eyes
  const eyePair = (geo, mt, y, x, z) => [-1, 1].forEach(s => head.add(mesh(geo, mt, s * x, y, z)));
  const helmSoon = P.armour || (spec.features && spec.features.headwear && spec.features.headwear.kind === 'helmet');
  if (P.eye === 'socket') { eyePair(S(0.07), ink, 0.03, 0.1, fz - 0.03); head.add(mesh(new THREE.ConeGeometry(0.035, 0.06, 3), ink, 0, -0.06, fz)); const jaw = mesh(S(hr * 0.7), m, 0, -hr * 0.55, 0.05); jaw.scale.set(1, 0.5, 0.95); head.add(jaw); }
  else if (P.eye === 'visor' && !helmSoon) { const v = mesh(new THREE.CapsuleGeometry(0.06, 0.26, 6, 16), new THREE.MeshBasicMaterial({ color: '#5ff8ff', transparent: true, opacity: 0.4, depthWrite: false }), 0, 0.02, fz); v.rotation.z = Math.PI / 2; head.add(v); eyePair(S(0.035), ink, 0.02, 0.09, fz - 0.01); }
  else if (P.eye === 'visor' && helmSoon) { /* helmet carries the visor — skip soft face visor */ }
  else if (P.eye === 'frog') { [-1, 1].forEach(s => { const e = mesh(S(0.1), m, s * 0.16, hr * 0.62, 0.12); head.add(e); e.add(mesh(S(0.06), mat('#fff'), 0, 0.01, 0.06)); e.add(mesh(S(0.035), ink, 0, 0.01, 0.105)); }); }
  else { const r = P.eye === 'big' ? 0.06 : 0.042; eyePair(S(r), ink, 0.04, 0.1, fz); eyePair(S(r * 0.35), mat('#fff', { emissive: '#fff', emissiveIntensity: 0.6 }), 0.06, 0.09, fz + r * 0.8); }
  // snout / beak
  if (P.snout === 'beak') { const b = mesh(new THREE.ConeGeometry(0.06, 0.16, 20), mat('#f2a830'), 0, -0.04, fz + 0.06); b.rotation.x = Math.PI / 2; head.add(b); }
  else if (P.snout) { const sn = mesh(S(P.snout), light, 0, -0.06, fz - 0.02); sn.scale.set(P.muzzle ? 1.35 : 1.15, P.muzzle ? 0.95 : 0.85, P.muzzle ? 1.25 : 1); head.add(sn); head.add(mesh(S(P.snout * 0.35), ink, 0, -0.03, fz + P.snout * 0.75));
    if (P.muzzle) { // ape: wider jaw plate + nostril dots
      const jaw = mesh(S(P.snout * 1.05), light, 0, -0.14, fz - 0.04); jaw.scale.set(1.45, 0.55, 1.1); head.add(jaw);
      [-1, 1].forEach(s => head.add(mesh(S(0.012), ink, s * 0.04, -0.05, fz + P.snout * 0.9)));
    }
  }
  if (P.brow) { const brw = mesh(new THREE.BoxGeometry(hr * 1.35, 0.045, 0.08), dark, 0, hr * 0.28, fz - 0.02); head.add(brw); }
  if (P.whisk) [-1, 1].forEach(s => [0, 1].forEach(k => { const w = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.18, 4), ink, s * 0.13, -0.06 + k * 0.03, fz - 0.02); w.rotation.z = Math.PI / 2 + s * (0.1 - k * 0.2); head.add(w); }));
  // ears
  [-1, 1].forEach(s => { let e;
    if (P.ears === 'round') { e = mesh(S(0.09), m, s * hr * 0.7, hr * 0.75, 0); e.add(mesh(S(0.05), light, 0, 0, 0.04)); }
    else if (P.ears === 'point') { e = mesh(new THREE.ConeGeometry(0.08, 0.17, 24), m, s * hr * 0.55, hr * 0.92, 0); e.rotation.z = -s * 0.3; }
    else if (P.ears === 'flop') { e = mesh(S(0.08), dark, s * hr * 0.9, hr * 0.2, 0); e.scale.set(0.5, 1.4, 0.8); e.rotation.z = s * 0.3; }
    else if (P.ears === 'side') e = mesh(S(0.06), m, s * hr, 0, 0);
    else if (P.ears === 'bolt') { e = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 20), dark, s * hr, 0, 0); e.rotation.z = Math.PI / 2; }
    if (e) { e.userData.ear = 1; head.add(e); } });
  if (P.metal) { head.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 6), dark, 0, hr + 0.06, 0)); head.add(mesh(S(0.035), new THREE.MeshBasicMaterial({ color: '#ff5470', toneMapped: false }), 0, hr + 0.15, 0)); }
  if (P.hair && !spec.features.headwear && !P.armour) { const hcap = mesh(new THREE.SphereGeometry(hr * 1.04, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), mat('#3a2a20'), 0, 0.02, -0.02); head.add(hcap); }
  // limbs (pivot groups so they swing) — upright biped only (all-fours reverted 2026-11-05)
  const limb = (x, y, len, r, mt) => { const g = new THREE.Group(); g.position.set(x, y, 0); const l = mesh(P.bones ? new THREE.CylinderGeometry(0.025, 0.025, len, 8) : cap(r, len), mt, 0, -len / 2, 0); g.add(l); g.add(mesh(S(r * 1.25), mt, 0, -len - r * 0.3, 0.02)); body.add(g); return g; };
  const armLen = P.longArms ? 0.38 : 0.24, shY = torsoY + bl * 0.25;
  const arms = [-1, 1].map(s => { const a = limb(s * (br + 0.03), shY, armLen, 0.06, m); a.rotation.z = s * 0.25; return a; });
  const legs = [-1, 1].map(s => limb(s * br * 0.45, hipY, hipY - 0.12, 0.075, P.bones ? m : dark));
  // Space-armour plating: ONLY when type=armour (explicit ranger/zerp / Helmet+Body-Armor).
  // Never from vest/jacket/shirt/camo — those use the clothing pass below.
  if (P.armour) {
    const plateCol = spec.colours.body || col;
    const accentCol = (spec.colours.accent && spec.colours.accent !== '#7dffd8') ? spec.colours.accent : shade(plateCol, 1.22);
    const signalCol = spec.colours.signal || '#d8383a';
    // Shared materials (flatShading = crisp edges, not soft blobs). Merge draw via reuse.
    const am = mat(plateCol, { metalness: 0.62, roughness: 0.28, flatShading: true });
    const amDark = mat(shade(plateCol, 0.62), { metalness: 0.55, roughness: 0.34, flatShading: true });
    const trim = mat(accentCol, { metalness: 0.5, roughness: 0.3, flatShading: true });
    const edgeHi = mat(shade(plateCol, 1.35), { metalness: 0.4, roughness: 0.35, flatShading: true });
    const signal = mat(signalCol, { metalness: 0.35, roughness: 0.4, emissive: signalCol, emissiveIntensity: 0.18, flatShading: true });
    // Layered chest: back plate + front plate + panel lines + central signal strip
    const chestY = torsoY + 0.02;
    body.add(mesh(new THREE.BoxGeometry(br * 1.85, bl * 0.62, br * 0.55), amDark, 0, chestY, -br * 0.05));
    body.add(mesh(new THREE.BoxGeometry(br * 1.7, bl * 0.55, br * 0.42), am, 0, chestY + 0.02, br * 0.38));
    body.add(mesh(new THREE.BoxGeometry(br * 1.55, 0.02, br * 0.38), amDark, 0, chestY - bl * 0.2, br * 0.4)); // panel seam
    body.add(mesh(new THREE.BoxGeometry(br * 0.22, bl * 0.38, 0.06), signal, 0, chestY + 0.02, br * 0.62));
    // Collar / neck seal (dark)
    body.add(mesh(new THREE.BoxGeometry(br * 1.1, 0.07, br * 0.7), mat('#141418', { metalness: 0.7, roughness: 0.25, flatShading: true }), 0, torsoY + bl * 0.32, br * 0.1));
    // Belt with buckle plate
    body.add(mesh(new THREE.BoxGeometry(br * 1.65, 0.08, br * 0.75), trim, 0, torsoY - bl * 0.28, br * 0.15));
    body.add(mesh(new THREE.BoxGeometry(br * 0.28, 0.1, 0.12), edgeHi, 0, torsoY - bl * 0.28, br * 0.52));
    // Pauldrons (layered shoulder boxes, not soft spheres)
    arms.forEach((a, i) => {
      const s = i ? 1 : -1;
      const pauldron = new THREE.Group(); pauldron.position.set(s * 0.02, 0.04, 0); a.add(pauldron);
      pauldron.add(mesh(new THREE.BoxGeometry(0.22, 0.14, 0.2), am, 0, 0, 0));
      pauldron.add(mesh(new THREE.BoxGeometry(0.18, 0.08, 0.16), amDark, 0, 0.08, 0.02));
      // Gauntlet ATTACHED at forearm end (rides the arm pivot — never floating)
      const gaunt = new THREE.Group(); gaunt.position.set(0, -armLen - 0.02, 0.02); a.add(gaunt);
      gaunt.add(mesh(new THREE.BoxGeometry(0.14, armLen * 0.42, 0.15), am, 0, armLen * 0.18, 0));
      gaunt.add(mesh(new THREE.BoxGeometry(0.16, 0.08, 0.17), trim, 0, 0.02, 0));
      gaunt.add(mesh(S(0.07), amDark, 0, -0.06, 0.02)); // fist bulb locked to cuff
    });
    // Shin guards + boots ATTACHED at leg end
    legs.forEach((lg) => {
      const legLen = hipY - 0.12;
      lg.add(mesh(new THREE.BoxGeometry(0.16, legLen * 0.45, 0.14), am, 0, -legLen * 0.35, 0.04));
      lg.add(mesh(new THREE.BoxGeometry(0.14, 0.06, 0.12), amDark, 0, -legLen * 0.55, 0.05));
      const boot = new THREE.Group(); boot.position.set(0, -legLen - 0.04, 0.05); lg.add(boot);
      boot.add(mesh(new THREE.BoxGeometry(0.18, 0.1, 0.26), trim, 0, 0.02, 0.02));
      boot.add(mesh(new THREE.BoxGeometry(0.16, 0.05, 0.14), amDark, 0, 0.08, -0.02)); // ankle seal
    });
    // Extra collar ring + chest trim lines from art (Power Zerp panel seams)
    body.add(mesh(new THREE.TorusGeometry(br * 0.55, 0.025, 8, 24), mat('#141418', { metalness: 0.7, roughness: 0.25, flatShading: true }), 0, torsoY + bl * 0.38, br * 0.08));
    [-1, 1].forEach(s => body.add(mesh(new THREE.BoxGeometry(0.025, bl * 0.35, 0.04), amDark, s * br * 0.55, chestY, br * 0.55)));
    root.userData.armourPlates = 1;
  }
  // ear pivots ONLY (never eyes/snout/antenna — those looked 'disconnected')
  const earSprings = []; head.children.forEach(ch => { if (ch.userData && ch.userData.ear) earSprings.push({ o: ch, x: 0, v: 0, z0: ch.rotation.z }); });
  // tail
  let tail = null; if (P.tail) { tail = new THREE.Group(); tail.position.set(0, hipY + 0.05, -br * 0.9); body.add(tail);
    if (P.tail === 'long') { const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.12, -0.18), new THREE.Vector3(0, 0.38, -0.24)]); tail.add(mesh(new THREE.TubeGeometry(curve, 20, 0.035, 10), P.stripes ? m : m)); }
    else tail.add(mesh(S(P.tail), light)); }
  // ---- distinct-feature attachments ----
  const F = spec.features || {}, topY = P.head ? hr * 0.9 : 0.46;
  if (F.headwear) {
    const kind = F.headwear.kind || 'hat';
    // Skull hats use bone/grey — never the dark battle-helmet fallback (that made them look like black tophats).
    const hc = kind === 'skull_hat'
      ? (F.headwear.colour || (spec.colours && spec.colours.helmet) || '#c5c0b4')
      : ((spec.colours && spec.colours.helmet) || F.headwear.colour || (P.armour ? col : null) || acc || '#2b2b34');
    const isHelm = kind === 'helmet' || (P.armour && !String(kind).startsWith('hair') && kind !== 'skull_hat');
    const armyHelm = isHelm && !P.armour && (F.headwear.style === 'army' || /soldier|military|army|combat|camo/.test(String(F.headwear.from || '').toLowerCase()));
    const hm = mat(hc, kind === 'crown' ? { metalness: 0.9, roughness: 0.25, color: F.headwear.colour || '#e0b040' } : isHelm ? { metalness: 0.58, roughness: 0.3, flatShading: true } : { roughness: 0.85 });
    const hat = new THREE.Group(); hat.userData.stage = 2; hat.name = 'headwear'; hat.userData.kind = kind; hat.position.y = topY - 0.04; head.add(hat);
    if (kind === 'crown') { hat.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 32, 1, true), hm, 0, 0.04, 0)); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, c = mesh(new THREE.ConeGeometry(0.03, 0.08, 12), hm, Math.sin(a) * 0.15, 0.11, Math.cos(a) * 0.15); hat.add(c); } }
    else if (kind === 'cap') { hat.add(mesh(new THREE.SphereGeometry(hr * 0.85, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), hm)); const bill = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 32, 1, false, -Math.PI / 2, Math.PI), hm, 0, 0.01, 0.12); hat.add(bill); }
    else if (String(kind).startsWith('hair_') || kind === 'hair') {
      // Hair styles from art — never a hat
      const hairCol = F.headwear.colour || acc || '#2a1a14';
      const hm2 = mat(hairCol, { roughness: 0.95 });
      if (kind === 'hair_afro') { hat.add(mesh(S(hr * 1.15, 28, 18), hm2, 0, hr * 0.35, -0.02)); }
      else if (kind === 'hair_mohawk') { for (let i = 0; i < 5; i++) { const sp = mesh(new THREE.ConeGeometry(0.04, 0.22, 6), hm2, 0, hr * 0.55 + i * 0.02, -0.05 + i * 0.01); sp.rotation.x = -0.2; hat.add(sp); } }
      else if (kind === 'hair_long') { hat.add(mesh(new THREE.SphereGeometry(hr * 1.02, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hm2, 0, 0.02, -0.04)); [-1, 1].forEach(s => { const t = mesh(cap(0.06, 0.35), hm2, s * hr * 0.55, -0.15, -0.05); hat.add(t); }); }
      else if (kind === 'hair_buns') { hat.add(mesh(new THREE.SphereGeometry(hr * 0.95, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hm2, 0, 0.05, -0.03)); [-1, 1].forEach(s => hat.add(mesh(S(0.09), hm2, s * hr * 0.7, hr * 0.55, -0.05))); }
      else if (kind === 'hair_tufts') { [-1, 1].forEach(s => { const t = mesh(new THREE.ConeGeometry(0.05, 0.12, 8), hm2, s * hr * 0.55, hr * 0.7, 0); t.rotation.z = -s * 0.4; hat.add(t); }); }
      else { // spiky default
        for (let i = 0; i < 7; i++) {
          const a = -0.9 + i * 0.3;
          const sp = mesh(new THREE.ConeGeometry(0.045, 0.2 + (i % 3) * 0.04, 6), hm2, Math.sin(a) * hr * 0.55, hr * 0.55, Math.cos(a) * hr * 0.2 - 0.05);
          sp.rotation.z = a * 0.35; sp.rotation.x = -0.35; hat.add(sp);
        }
      }
    }
    else if (kind === 'skull_hat') {
      // Grey animal/skull HELMET worn as hat — NOT a tophat, NOT a skeleton body
      const boneHex = hc || '#c5c0b4';
      const bone = mat(boneHex, { roughness: 0.72, flatShading: true });
      const boneDark = mat(shade(boneHex, 0.7), { roughness: 0.75, flatShading: true });
      const socket = mat('#6a1018', { roughness: 0.85, flatShading: true });
      const cranium = mesh(S(hr * 1.08, 28, 20), bone, 0, hr * 0.45, 0); cranium.userData.skullHat = 1; hat.add(cranium);
      // Large forward eye sockets — must read as skull from front cam, not a brimmed dome
      [-1, 1].forEach(s => {
        const sock = mesh(S(0.09, 14, 10), socket, s * hr * 0.35, hr * 0.48, hr * 0.85);
        sock.scale.set(1.15, 1.25, 0.7); sock.userData.skullHat = 1; hat.add(sock);
        hat.add(mesh(S(0.035), mat('#1a0508'), s * hr * 0.35, hr * 0.48, hr * 1.05));
      });
      // Nasal cavity
      const nose = mesh(new THREE.ConeGeometry(0.04, 0.07, 4), boneDark, 0, hr * 0.28, hr * 0.85); nose.rotation.x = Math.PI; nose.userData.skullHat = 1; hat.add(nose);
      // Jaw + teeth row
      const jaw = mesh(new THREE.BoxGeometry(hr * 1.1, hr * 0.35, hr * 0.7), bone, 0, hr * 0.08, hr * 0.2); jaw.userData.skullHat = 1; hat.add(jaw);
      for (let i = -2; i <= 2; i++) {
        const tooth = mesh(new THREE.BoxGeometry(0.03, 0.05, 0.03), mat('#f4f0e6', { flatShading: true }), i * 0.055, hr * 0.02, hr * 0.55);
        tooth.userData.skullHat = 1; hat.add(tooth);
      }
      // Short curved horns (mutant skull silhouette)
      [-1, 1].forEach(s => {
        const horn = mesh(new THREE.ConeGeometry(0.045, 0.16, 6), boneDark, s * hr * 0.55, hr * 0.95, -0.05);
        horn.rotation.z = s * 0.55; horn.rotation.x = -0.35; horn.userData.skullHat = 1; hat.add(horn);
      });
      hat.userData.skullHat = 1;
      hat.userData.kind = 'skull_hat';
    }
    else if (kind === 'headband' || kind === 'bandana' || kind === 'headwrap') {
      const band = mesh(new THREE.TorusGeometry(hr * 0.95, kind === 'headwrap' ? 0.06 : 0.035, 8, 28), hm, 0, hr * 0.35, 0);
      band.rotation.x = Math.PI / 2; hat.add(band);
      if (kind === 'bandana') { const tail = mesh(cap(0.03, 0.16), hm, hr * 0.5, hr * 0.2, -hr * 0.6); tail.rotation.z = 0.5; hat.add(tail); }
      if (kind === 'headwrap') hat.add(mesh(new THREE.SphereGeometry(hr * 1.05, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hm, 0, hr * 0.2, -0.02));
    }
    else if (kind === 'ears') {
      [-1, 1].forEach(s => { const e = mesh(new THREE.ConeGeometry(0.07, 0.16, 10), hm, s * hr * 0.55, hr * 0.85, 0); e.rotation.z = -s * 0.35; hat.add(e); });
    }
    else if (kind === 'halo') {
      const h = mesh(new THREE.TorusGeometry(0.16, 0.018, 8, 28), mat(hc || '#ffe08a', { emissive: hc || '#ffe08a', emissiveIntensity: 0.5 }), 0, hr * 0.95, 0);
      h.rotation.x = Math.PI / 2; hat.add(h);
    }
    else if (kind === 'goggles' || kind === 'eyemask') {
      const gm = mat(kind === 'eyemask' ? (hc || '#d8383a') : '#101014', { metalness: kind === 'goggles' ? 0.6 : 0.1, roughness: 0.4 });
      if (kind === 'eyemask') {
        // Horizontal eye-mask stripe across the face (bears / heroes)
        const stripe = mesh(new THREE.BoxGeometry(hr * 2.1, hr * 0.55, 0.08), gm, 0, 0.02, hr * 0.85);
        hat.position.y = 0; head.add(stripe); stripe.userData.stage = 2;
      } else {
        [-1, 1].forEach(s => { const l = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16), gm, s * 0.1, 0.02, hr * 0.7); l.rotation.x = Math.PI / 2; hat.add(l); });
        hat.add(mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), gm, 0, 0.02, hr * 0.7));
      }
    }
    else if (isHelm && armyHelm) {
      // Olive/green SOLDIER / army pot helmet (M1-style) — NOT black battle box, NOT tophat
      const helmHex = (spec.colours && spec.colours.helmet) || F.headwear.colour || '#5a7a3a';
      const hmFlat = mat(helmHex, { metalness: 0.35, roughness: 0.55, flatShading: true });
      const hmDark = mat(shade(helmHex, 0.65), { metalness: 0.3, roughness: 0.6, flatShading: true });
      // Domed shell
      const dome = mesh(new THREE.SphereGeometry(hr * 1.05, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), hmFlat, 0, hr * 0.15, 0);
      dome.userData.helmet = 1; hat.add(dome);
      // Brim
      const brim = mesh(new THREE.CylinderGeometry(hr * 1.25, hr * 1.3, 0.04, 28), hmDark, 0, -hr * 0.05, 0.04);
      brim.userData.helmet = 1; hat.add(brim);
      // Chin strap nubs
      [-1, 1].forEach(s => hat.add(mesh(new THREE.BoxGeometry(0.03, 0.08, 0.03), hmDark, s * hr * 0.85, -hr * 0.15, hr * 0.2)));
      // Side X mark (Little Ledger etc.)
      hat.add(mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), mat('#f2f2ee'), hr * 0.7, hr * 0.25, hr * 0.55));
      hat.add(mesh(new THREE.BoxGeometry(0.02, 0.06, 0.02), mat('#f2f2ee'), hr * 0.7, hr * 0.25, hr * 0.55));
      hat.userData.helmet = 1;
      hat.userData.helmetStyle = 'army';
      hat.userData.helmetColour = helmHex;
    }
    else if (isHelm) { // hard-edged battle helmet (Power Ranger / space-armour) — NEVER soft tophat
      // Helmet colour follows art/trait: colours.helmet > headwear.colour > body > dark default
      const helmHex = (spec.colours && spec.colours.helmet) || F.headwear.colour || (P.armour ? col : null) || '#2b2b34';
      const visHex = (spec.colours && spec.colours.visor) || '#0a0b0c';
      const crestHex = (acc && acc !== '#7dffd8' && String(acc).toLowerCase() !== String(helmHex).toLowerCase()) ? acc : '#e8c04a';
      const hmFlat = mat(helmHex, { metalness: 0.58, roughness: 0.3, flatShading: true });
      const hmDark = mat(shade(helmHex, 0.55), { metalness: 0.55, roughness: 0.34, flatShading: true });
      const hmEdge = mat(shade(helmHex, 1.28), { metalness: 0.45, roughness: 0.32, flatShading: true });
      const crest = mat(crestHex, { metalness: 0.72, roughness: 0.22, flatShading: true });
      const visMat = new THREE.MeshStandardMaterial({ color: visHex, metalness: 0.95, roughness: 0.1, emissive: '#102038', emissiveIntensity: 0.55, flatShading: true });
      // Boxy dome shell + side panels (hard bevels, not soft sphere blob)
      hat.add(mesh(new THREE.BoxGeometry(hr * 1.85, hr * 1.35, hr * 1.7), hmFlat, 0, hr * 0.15, 0));
      hat.add(mesh(new THREE.BoxGeometry(hr * 1.95, hr * 0.55, hr * 1.55), hmDark, 0, -hr * 0.35, hr * 0.05)); // jaw / lower face plate
      hat.add(mesh(new THREE.BoxGeometry(hr * 1.7, 0.035, hr * 1.5), hmEdge, 0, hr * 0.78, 0.02)); // top bevel highlight
      // Dark visor slit (Power Ranger style) + gold grille ticks
      const vis = mesh(new THREE.BoxGeometry(Math.max(0.36, hr * 1.55), Math.max(0.11, hr * 0.42), 0.08), visMat, 0, hr * 0.08, hr * 0.88);
      hat.add(vis);
      for (let i = -2; i <= 2; i++) hat.add(mesh(new THREE.BoxGeometry(0.016, hr * 0.28, 0.025), crest, i * 0.048, hr * 0.08, hr * 0.94));
      // Twin crest horns (Champion / Power Zerp silhouette)
      [-1, 1].forEach(s => {
        const horn = mesh(new THREE.ConeGeometry(0.048, 0.34, 6), crest, s * hr * 0.42, hr * 1.05, -0.02);
        horn.rotation.z = s * 0.28; horn.rotation.x = -0.22; hat.add(horn);
        hat.add(mesh(new THREE.BoxGeometry(0.06, 0.05, 0.08), hmDark, s * hr * 0.4, hr * 0.82, 0)); // horn base socket
      });
      // V crest plate + signal gem
      hat.add(mesh(new THREE.BoxGeometry(0.16, 0.06, 0.05), crest, 0, hr * 0.55, hr * 0.7));
      hat.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 0.04), mat('#d8383a', { emissive: '#d8383a', emissiveIntensity: 0.55, flatShading: true }), 0, hr * 0.48, hr * 0.78));
      hat.userData.helmet = 1;
      hat.userData.helmetStyle = 'battle';
      hat.userData.helmetColour = helmHex;
      hat.userData.visorColour = visHex;

    }
    else if (kind === 'hat') { hat.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 40), hm)); hat.add(mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.2, 32), hm, 0, 0.11, 0)); hat.add(mesh(new THREE.CylinderGeometry(0.172, 0.172, 0.04, 32), mat(acc || '#c0303a'), 0, 0.04, 0)); }
    // unknown kinds: skip mesh (do not invent a tophat)
  }
  // Clothing LAYER system (shirt/vest/jacket/overalls/camo/suit) — NEVER armour plates.
  // Colours from traits / art torso sample (F.clothes.colour). Generic for any NFT.
  if (F.clothes && !P.armour) {
    const ck = F.clothes.kind, cc = F.clothes.colour || acc || '#4a5568';
    const layers = [];
    const clothG = new THREE.Group(); clothG.name = 'clothes'; clothG.userData.kind = ck; body.add(clothG);
    // Front of capsule ≈ br; park clothing OUTSIDE so it reads in third-person screenshots
    const fzC = br * 0.92;
    const addC = (geo, material, x, y, z) => { const o = mesh(geo, material, x, y, z); o.userData.clothes = ck; clothG.add(o); return o; };
    // Under-shirt layer (vest/jacket always get collar + torso panel)
    const under = F.clothes.under;
    if (under || ck === 'shirt' || ck === 'striped' || ck === 'overalls') {
      const uc = (under && under.colour) || (ck === 'shirt' || ck === 'striped' || ck === 'overalls' ? cc : '#7a1f2a');
      const um = mat(uc, { roughness: 0.78 });
      addC(new THREE.BoxGeometry(br * 1.65, bl * 0.7, 0.1), um, 0, torsoY, fzC);
      // Collar
      addC(new THREE.BoxGeometry(br * 0.85, 0.08, 0.1), mat(shade(uc, 1.15), { roughness: 0.75 }), 0, torsoY + bl * 0.32, fzC + 0.04);
      [-1, 1].forEach(s => addC(new THREE.BoxGeometry(0.12, 0.06, 0.08), mat(shade(uc, 1.1), { roughness: 0.75 }), s * br * 0.35, torsoY + bl * 0.3, fzC + 0.05));
      layers.push('shirt');
      if (ck === 'striped' || (ck === 'overalls' && F.clothes.stripe)) {
        const sc = F.clothes.stripe || shade(uc, 0.55);
        for (let i = 0; i < 3; i++) addC(new THREE.BoxGeometry(br * 1.66, 0.05, 0.11), mat(sc, { roughness: 0.8 }), 0, torsoY + 0.14 - i * 0.12, fzC + 0.02);
        layers.push('stripe');
      }
    }
    if (ck === 'vest') {
      const cm = mat(cc, { roughness: 0.72 });
      const cmDark = mat(shade(cc, 0.55), { roughness: 0.78 });
      addC(new THREE.BoxGeometry(br * 1.75, bl * 0.55, 0.12), cm, 0, torsoY - 0.02, fzC + 0.06);
      [-1, 1].forEach(s => addC(new THREE.BoxGeometry(0.06, bl * 0.52, 0.08), cmDark, s * br * 0.42, torsoY - 0.02, fzC + 0.12));
      for (let i = 0; i < 3; i++) addC(new THREE.SphereGeometry(0.025, 8, 6), mat('#e0b040', { metalness: 0.5, roughness: 0.4 }), 0, torsoY + 0.12 - i * 0.11, fzC + 0.14);
      layers.push('vest');
    } else if (ck === 'jacket' || ck === 'suit' || ck === 'cape') {
      const cm = mat(cc || '#4a5538', { roughness: 0.75 });
      addC(new THREE.BoxGeometry(br * 1.85, bl * 0.72, 0.14), cm, 0, torsoY, fzC + 0.04);
      arms.forEach((a) => { a.add(mesh(new THREE.BoxGeometry(0.16, armLen * 0.6, 0.14), cm, 0, -armLen * 0.25, 0.02)); });
      layers.push(ck === 'cape' ? 'cape' : 'jacket');
    } else if (ck === 'overalls') {
      const oc = cc || '#3a6fd8';
      const om = mat(oc, { roughness: 0.8 });
      addC(new THREE.BoxGeometry(br * 1.7, bl * 0.85, 0.12), om, 0, torsoY - 0.05, fzC + 0.02);
      [-1, 1].forEach(s => addC(new THREE.BoxGeometry(0.08, bl * 0.6, 0.06), mat(shade(oc, 0.85), { roughness: 0.8 }), s * br * 0.3, torsoY + 0.1, fzC + 0.1));
      layers.push('overalls');
    } else if (ck === 'camo') {
      const base = cc && cc !== acc ? cc : '#4f6b3a';
      addC(new THREE.BoxGeometry(br * 1.75, bl * 0.7, 0.12), mat(base, { roughness: 0.9 }), 0, torsoY, fzC + 0.02);
      [[-0.12, 0.1, '#2f4520'], [0.14, -0.06, '#6b7a45'], [-0.04, -0.14, '#3a5028'], [0.1, 0.12, '#5a6b38']].forEach(([x, y, hex]) =>
        addC(new THREE.BoxGeometry(0.14, 0.11, 0.05), mat(hex, { roughness: 0.9 }), x, torsoY + y, fzC + 0.1));
      layers.push('camo');
    } else if (ck === 'shirt' || ck === 'striped') {
      if (!layers.includes('shirt')) layers.push('shirt');
    }
    // Satchel / bag strap — thick diagonal, clearly in front
    const bag = (F.accessories && (F.accessories.kind === 'satchel' || F.accessories.kind === 'backpack')) || F.clothes.bag;
    if (bag || (ck === 'camo' && F.accessories)) {
      const strapC = mat((F.accessories && F.accessories.colour) || '#1a1a1e', { roughness: 0.85 });
      const strap = addC(new THREE.BoxGeometry(0.07, bl * 0.95, 0.05), strapC, br * 0.2, torsoY - 0.02, fzC + 0.12);
      strap.rotation.z = 0.55;
      addC(new THREE.BoxGeometry(0.18, 0.14, 0.1), strapC, -br * 0.4, hipY + 0.14, fzC + 0.08);
      layers.push('satchel');
      root.userData.satchel = 1;
    }
    root.userData.clothes = ck;
    root.userData.clothesLayers = layers;
  }
  // Eye-mask from features.mask (stripe) when not already built as headwear
  if (F.mask && !P.bones && F.mask.kind === 'eyemask') {
    const mc = F.mask.colour || '#d8383a';
    head.add(mesh(new THREE.BoxGeometry(hr * 2.05, hr * 0.5, 0.07), mat(mc, { roughness: 0.5 }), 0, 0.04, fz + 0.02));
  }
  if (F.neckwear) { const sm = mat(F.neckwear.colour || acc || '#8a4fd8', { roughness: 0.85 }), ny = P.head ? torsoY + bl * 0.45 : torsoY - 0.05;
    const ring = mesh(new THREE.TorusGeometry(P.head ? br * 0.85 : br * 0.95, 0.06, 14, 36), sm, 0, ny, 0); ring.rotation.x = Math.PI / 2; body.add(ring);
    const tailS = mesh(new THREE.CapsuleGeometry(0.045, 0.2, 6, 12), sm, br * 0.4, ny - 0.13, br * 0.6); tailS.rotation.z = 0.3; body.add(tailS); root.userData.scarfTail = tailS; }
  if (F.eyewear) {
    const g = new THREE.Group(); g.name = 'eyewear'; g.position.set(0, P.head ? 0.05 : 0.04, fz + 0.03); head.add(g);
    const lensHex = F.eyewear.colour || '#101014';
    const frame = mat(shade(lensHex, 0.45), { metalness: 0.55, roughness: 0.25 });
    const lens = mat(lensHex, { metalness: 0.35, roughness: 0.35, transparent: true, opacity: 0.85 });
    [-1, 1].forEach(s => {
      const l = mesh(new THREE.BoxGeometry(0.12, 0.1, 0.03), lens, s * 0.1, 0, 0); l.userData.eyewear = 1; g.add(l);
      g.add(mesh(new THREE.BoxGeometry(0.13, 0.11, 0.015), frame, s * 0.1, 0, -0.01));
    });
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.02, 0.015), frame));
    const strap = mesh(new THREE.TorusGeometry(P.head ? hr * 1.0 : 0.33, 0.012, 6, 40), frame, 0, 0, -fz); strap.rotation.x = Math.PI / 2; g.add(strap);
    root.userData.eyewear = F.eyewear.kind || 'glasses';
    root.userData.eyewearColour = lensHex;
  }
  if (F.mask && !P.bones && F.mask.kind !== 'eyemask') { const mk = mesh(S(0.2, 32, 16), mat(F.mask.colour || '#3fae5a', { roughness: 0.4 }), 0, -0.1, fz - 0.06); mk.scale.set(1.25, 0.6, 0.6); mk.userData.stage = 2; head.add(mk); // strapped sports mask
    const st = mesh(new THREE.TorusGeometry(P.head ? hr : 0.33, 0.014, 6, 40), mat('#1d2a20'), 0, -0.1, 0); st.rotation.x = Math.PI / 2; head.add(st);
    if (spec.type === 'bean') head.add(mesh(S(0.03), mat('#f4f4ee'), 0, -0.07, fz + 0.06)); } // white seedling dot
  let wings = null; if (F.wings || P.smallWings) { wings = [-1, 1].map(s => { const g = new THREE.Group(); g.name = 'ability-wings'; g.userData.abilityPart = 'wings'; g.position.set(s * br * 0.6, torsoY + 0.1, -br * 0.7); body.add(g);
      const big = !!F.wings, w = mesh(S(big ? 0.28 : 0.14, 24, 16), mat(F.wings && F.wings.colour || (big ? '#f4f4f8' : col), { roughness: 0.6, side: THREE.DoubleSide }), s * (big ? 0.26 : 0.1), big ? 0.1 : -0.05, 0);
      w.scale.set(1, big ? 0.55 : 1.2, 0.12); w.rotation.z = s * 0.4; g.add(w); return g; }); }
  { const V3 = (x, y, z) => new THREE.Vector3(x, y, z), hs = hr / 0.18; // step 13f: attach points for the generic trait builder
    root.userData.anchors = { head: { obj: head, pos: V3(0, hr * 0.82, 0), s: hs }, face: { obj: head, pos: V3(0, 0.02, hr * 0.98), s: hr / 0.2 }, neck: { obj: body, pos: V3(0, head.position.y - hr * 0.85, 0), s: Math.max(0.6, br / 0.21) },
      chest: { obj: body, pos: V3(0, torsoY, br * 0.97), s: 1 }, back: { obj: body, pos: V3(0, torsoY + 0.05, -br * 1.02), s: 1.1 }, tail: { obj: body, pos: V3(0, hipY + 0.05, -br * 0.95), s: 1 }, waist: { obj: body, pos: V3(0, hipY + 0.08, 0), r: br * 1.02 },
      wrists: arms.map(g => ({ obj: g, pos: V3(0, -armLen * 0.82, 0), s: 0.85 })), hands: arms.map(g => ({ obj: g, pos: V3(0, -armLen - 0.03, 0.02), s: 0.9 })), ankles: legs.map(g => ({ obj: g, pos: V3(0, -(hipY - 0.12) + 0.03, 0), s: 1 })) };
    const hk = F.headwear && ({ crown: 'crown', cap: 'cap', hat: 'tophat', helmet: 'helmet', skull_hat: 'skull_hat', hair_spiky: 'hair', hair_afro: 'hair', hair_mohawk: 'hair', hair_long: 'hair', hair_buns: 'hair', hair_tufts: 'hair', eyemask: 'mask', headband: 'headband', bandana: 'bandana', headwrap: 'headwrap', ears: 'ears', halo: 'halo', goggles: 'eyewear' }[F.headwear.kind] || F.headwear.kind);
    root.userData.native = [...(hk ? [hk] : []), ...(F.neckwear ? ['scarf'] : []), ...(F.eyewear ? ['eyewear'] : []), ...(F.mask && !P.bones ? ['mask'] : []), ...(F.wings ? ['wings'] : []), ...(P.tail ? ['tail'] : [])]; }
  // tier glow ring (stored for later perks; subtle visual only)
  const tierCol = { Rare: '#5fb8ff', Legendary: '#ffcc55', Epic: '#c07bff' }[spec.tier];
  if (tierCol) { const r = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40), new THREE.MeshBasicMaterial({ color: tierCol, transparent: true, opacity: 0.5, toneMapped: false, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; r.position.y = 0.02; root.add(r); }
  root.traverse(o => { if (o.isMesh) o.receiveShadow = false; });
  // upright biped walk + ear/tail/wing spring secondary motion (all-fours removed)
  const spr = { tailY: { x: 0, v: 0 }, tailX: { x: 0, v: 0 }, wingL: { x: 0, v: 0 }, wingR: { x: 0, v: 0 }, ear: earSprings.map(() => ({ x: 0, v: 0 })) };
  const spring = (st, target, dt, k = 18, d = 8) => { st.v += (target - st.x) * k * dt; st.v *= Math.exp(-d * dt); st.x += st.v * dt; return st.x; };
  const gait = GAIT[spec.type] || GAIT.default;
  root.userData.gait = gait.style;
  // fading paw prints (phone-capped pool on root)
  const prints = [];
  {
    const n = 8, matP = new THREE.MeshBasicMaterial({ color: 0x1a1210, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), matP.clone());
      m.rotation.x = -Math.PI / 2; m.visible = false; m.name = 'paw-print'; root.add(m);
      prints.push({ m, life: 0 });
    }
  }
  let printI = 0, printAcc = 0, pounceT = 0;
  root.userData.animate = (t, dt, ctl, walkT) => {
    const B = ctl ? ctl.blend : { idle: 1, walk: 0, run: 0, jump: 0, fall: 0, land: 0 }, mv = B.walk + B.run;
    const amp = (gait.amp * B.walk + gait.amp * 1.35 * B.run);
    const wt = walkT * gait.stride;
    let sw = Math.sin(wt) * amp;
    // bird hop: discrete vertical pops instead of smooth stride
    if (gait.hop && mv > 0.2) {
      const phase = (wt % (Math.PI * 2));
      sw = phase < Math.PI ? amp * 0.35 : -amp * 0.15;
      body.position.y = (phase < Math.PI ? Math.sin(phase) * 0.12 : 0) + Math.sin(t * 2) * 0.008 * B.idle - 0.05 * B.land;
    } else {
      body.position.y = Math.abs(Math.sin(wt)) * gait.bob * mv + Math.sin(t * 2) * 0.012 * B.idle - 0.05 * B.land;
    }
    // dog bounce: extra vertical on walk peaks
    if (gait.style === 'bounce') body.position.y += Math.abs(Math.sin(wt * 2)) * 0.025 * mv;
    // bear lumber: slower heavy sway
    if (gait.style === 'lumber') body.rotation.y = Math.sin(wt * 0.5) * 0.06 * mv;
    else body.rotation.y = 0;
    // cat prowl: lower idle crouch when moving slow
    const crouch = gait.style === 'prowl' ? 0.03 * Math.min(1, mv) : 0;
    body.position.y -= crouch;
    // pounce: hold jump briefly while grounded+moving = crouch then spring (animals only)
    const animal = /^(cat|dog|tiger|bear|ape|bird)$/.test(spec.type);
    if (animal && ctl && ctl.grounded && B.jump > 0.4 && mv > 0.15) pounceT = Math.min(0.22, pounceT + dt);
    else pounceT = Math.max(0, pounceT - dt * 2);
    if (pounceT > 0.02) {
      body.position.y -= pounceT * 0.55;
      body.rotation.x = pounceT * 0.6;
      legs[0].rotation.x = 0.55 + pounceT; legs[1].rotation.x = 0.55 + pounceT;
      arms[0].rotation.x = -0.4; arms[1].rotation.x = -0.4;
    } else {
      legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
      arms[0].rotation.x = -sw * gait.arm - 0.6 * (B.jump + B.fall); arms[1].rotation.x = sw * gait.arm - 0.6 * (B.jump + B.fall);
      arms[0].rotation.z = -0.25 - 0.5 * B.jump; arms[1].rotation.z = 0.25 + 0.5 * B.jump;
      const tuck = (ctl && ctl.hopping) ? 0.7 : 0; legs.forEach(l => l.rotation.x -= tuck);
      body.rotation.x = Math.min((ctl ? ctl.speed : 0) / 6, 1) * 0.18;
    }
    body.position.z = 0; body.scale.set(1, 1, 1);
    head.rotation.x = 0; head.rotation.z = Math.sin(wt * 0.5) * 0.05 * mv;
    // Secondary motion — ear-only; perk ears when another player / nearby avatar flagged
    const turn = (ctl && ctl.turnRate) || 0, air = ctl && !ctl.grounded;
    const near = !!(root.userData.nearPlayer);
    if (tail) {
      const wag = gait.style === 'bounce' || gait.style === 'prowl' ? 0.55 : 0.35;
      const ty = spring(spr.tailY, Math.sin(t * (near ? 7 : 3) + wt) * wag - turn * 0.08, dt, 16, 7);
      const tx = spring(spr.tailX, air ? 0.25 : mv * 0.15 + (near ? 0.08 : 0), dt, 12, 6);
      tail.rotation.y = ty; tail.rotation.x = tx;
    }
    earSprings.forEach((e, i) => {
      const perk = near ? (i ? 0.18 : -0.18) : 0; // ears perk up when someone is near
      const wiggle = spring(spr.ear[i] || (spr.ear[i] = { x: 0, v: 0 }), perk + turn * 0.15 + Math.sin(t * 5 + i) * 0.04 * mv, dt, 22, 9);
      e.o.rotation.z = (e.z0 || 0) + wiggle;
    });
    if (wings) {
      const flapWant = ((F.wings ? 0.28 : 0.15) + (B.jump + B.fall) * 0.65) * (air ? 1.35 : 1);
      const flap = Math.sin(t * (air || F.wings ? 10 : 4)) * flapWant;
      const fl = spring(spr.wingL, flap, dt, 28, 10), fr = spring(spr.wingR, -flap, dt, 28, 10);
      wings[0].rotation.y = fl; wings[1].rotation.y = fr;
      wings[0].rotation.z = (air ? 0.25 : 0.1) + Math.sin(t * 6) * 0.05 * (air ? 1 : mv);
      wings[1].rotation.z = -wings[0].rotation.z;
    }
    if (root.userData.scarfTail) root.userData.scarfTail.rotation.x = -0.3 - mv * 0.6 + Math.sin(t * 9) * 0.1 * mv;
    // fading paw prints while walking on ground (animals)
    if (animal && ctl && ctl.grounded && mv > 0.35) {
      printAcc += (ctl.speed || 1) * dt;
      if (printAcc > 0.45) {
        printAcc = 0;
        const p = prints[printI++ % prints.length];
        const side = (printI % 2) ? 0.08 : -0.08;
        p.m.position.set(side, 0.015, 0.05);
        p.m.visible = true; p.life = 1.4; p.m.material.opacity = 0.4;
      }
    }
    for (const p of prints) {
      if (!p.m.visible) continue;
      p.life -= dt;
      p.m.material.opacity = Math.max(0, p.life * 0.28);
      // leave prints in world by slowly sliding them back relative to root facing
      p.m.position.z -= (ctl && ctl.speed ? ctl.speed : 1) * dt * 0.35;
      if (p.life <= 0) p.m.visible = false;
    }
    if (ctl) root.scale.copy(ctl.scale);
  };
  root.userData.isQuad = false;
  return root;
}
