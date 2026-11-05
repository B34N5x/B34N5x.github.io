// (c) 2026 B34N5x. All rights reserved.
// Lobby life: rule-placed seats/street furniture + upright wandering NPC animals + arcade players.
// Made-up NPC skins only (never B34N5 NFTs). Upright only. Phone-capped counts. CC0 Kenney/ambientCG via envpass patterns.
import * as THREE from './lib/three.module.js';
import { PLAZA_R, SAFE_SPOTS, isClearSpot } from './envpass.js?v=4';

const HASH = (i) => { let x = (i * 374761393 + 668265263) | 0; x = (x ^ (x >>> 13)) * 1274126177; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();

const NPC_PAL = [
  { body: '#d08a4a', accent: '#8a5a30' }, // ginger cat
  { body: '#6a7ad8', accent: '#3a4a98' }, // blue dog
  { body: '#c8a070', accent: '#6a5040' }, // bear
  { body: '#e0a040', accent: '#403018' }, // tiger
  { body: '#f0e8d8', accent: '#c05040' }, // bird
  { body: '#7a9a6a', accent: '#3a5a3a' }, // ape green
  { body: '#b09080', accent: '#504040' }, // muted dog
  { body: '#9a70a8', accent: '#503060' }, // purple cat
];
const SPECIES = ['cat', 'dog', 'bear', 'tiger', 'bird', 'ape'];
const LOD_HIDE = 38;
const LOD_SLOW = 22;

function bakeMat(hex, ao = 0.3) {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const g = c.getContext('2d'); g.fillStyle = hex; g.fillRect(0, 0, 32, 32);
  const gr = g.createLinearGradient(0, 0, 0, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${ao})`);
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: t, toneMapped: true });
}

class Batch {
  constructor(geo, mat, max = 64) { this.geo = geo; this.m = mat; this.list = []; this.max = max; this.im = null; }
  add(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
    if (this.list.length >= this.max) return false;
    E.set(0, ry, 0); Q.setFromEuler(E); S.set(sx, sy, sz); P.set(x, y, z);
    this.list.push(M4.compose(P, Q, S).clone()); return true;
  }
  build(scene) {
    if (!this.list.length) return null;
    const im = new THREE.InstancedMesh(this.geo, this.m, this.list.length);
    this.list.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true; im.userData.envProp = true; im.userData.npcLife = true;
    scene.add(im); this.im = im; return im;
  }
}

function mkCtl() {
  return {
    blend: { idle: 1, walk: 0, run: 0, jump: 0, fall: 0, land: 0 },
    grounded: true, speed: 0, turnRate: 0, hopping: false,
    scale: new THREE.Vector3(1, 1, 1),
  };
}

function npcSpec(i) {
  const type = SPECIES[i % SPECIES.length];
  const col = NPC_PAL[i % NPC_PAL.length];
  return {
    type,
    colours: { body: col.body, accent: col.accent },
    features: {},
    tier: null,
    seed: `lobby-npc-${type}-${i}`,
    detected: [],
    matched: [],
    florist: false,
  };
}

function arcadeSpec(i) {
  // simple upright humanoid players — never B34N5
  const pals = [
    { body: '#6a8ad0', accent: '#ff6af3' },
    { body: '#d08a6a', accent: '#22f0ff' },
    { body: '#7ad0a0', accent: '#ffd23d' },
    { body: '#c070a0', accent: '#7ff8ff' },
  ];
  const c = pals[i % pals.length];
  return {
    type: i % 2 ? 'human' : 'robot',
    colours: { body: c.body, accent: c.accent },
    features: {},
    tier: null,
    seed: `arcade-npc-${i}`,
    detected: [],
    matched: [],
    florist: false,
  };
}



// Shared materials across all lite NPCs (huge draw-call / state win vs per-NPC mats).
const MATS = {};
function matBasic(key, hex) {
  if (MATS[key]) return MATS[key];
  return (MATS[key] = new THREE.MeshBasicMaterial({ color: hex, toneMapped: true }));
}
const GEO = {
  torso: new THREE.CapsuleGeometry(0.2, 0.26, 3, 6),
  head: new THREE.SphereGeometry(0.18, 8, 6),
  ear: new THREE.ConeGeometry(0.05, 0.1, 5),
  earR: new THREE.SphereGeometry(0.055, 5, 5),
  snout: new THREE.SphereGeometry(0.06, 5, 5),
  beak: new THREE.ConeGeometry(0.035, 0.1, 5),
  limb: new THREE.CapsuleGeometry(0.045, 0.22, 2, 5),
  leg: new THREE.CapsuleGeometry(0.055, 0.32, 2, 5),
  tail: new THREE.CapsuleGeometry(0.025, 0.22, 2, 5),
  wing: new THREE.SphereGeometry(0.1, 5, 5),
  eye: new THREE.SphereGeometry(0.03, 5, 5),
  blob: new THREE.PlaneGeometry(0.85, 0.85),
};
let _blobMap = null;
function blobMap() {
  if (_blobMap) return _blobMap;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(16, 16, 1, 16, 16, 15);
  rg.addColorStop(0, 'rgba(0,0,0,0.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
  _blobMap = new THREE.CanvasTexture(c); return _blobMap;
}

/** Phone-light upright NPC (~10 meshes, shared geo/mats). Ear/tail sway + species gait. */
function buildLiteNpc(spec, { animal = true } = {}) {
  const col = (spec.colours && spec.colours.body) || '#9a9aa0';
  const key = String(col);
  const m = matBasic('b:' + key, col);
  const md = matBasic('d:' + key, new THREE.Color(col).multiplyScalar(0.55));
  const ink = matBasic('ink', '#15151a');
  const root = new THREE.Group(); root.userData.spec = spec; root.userData.isQuad = false; root.userData.npcLife = true;
  const body = new THREE.Group(); root.add(body);
  const torso = new THREE.Mesh(GEO.torso, m); torso.position.y = 0.82; body.add(torso);
  const head = new THREE.Group(); head.position.y = 1.16; body.add(head);
  head.add(new THREE.Mesh(GEO.head, m));
  [-1, 1].forEach(s => { const e = new THREE.Mesh(GEO.eye, ink); e.position.set(s * 0.07, 0.02, 0.15); head.add(e); });
  const ears = [];
  if (animal && spec.type !== 'bird') {
    [-1, 1].forEach(s => {
      const ear = new THREE.Mesh(spec.type === 'cat' ? GEO.ear : GEO.earR, m);
      ear.position.set(s * 0.13, 0.16, 0);
      if (spec.type === 'cat') ear.rotation.z = -s * 0.25;
      if (spec.type === 'dog') { ear.scale.set(0.5, 1.25, 0.7); ear.position.y = 0.06; }
      head.add(ear); ears.push(ear);
    });
  }
  if (spec.type === 'bird') {
    const beak = new THREE.Mesh(GEO.beak, matBasic('beak', '#f2a830'));
    beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.02, 0.2); head.add(beak);
  } else if (animal) {
    const sn = new THREE.Mesh(GEO.snout, md); sn.position.set(0, -0.03, 0.16); head.add(sn);
  }
  const limb = (x, y, geo) => {
    const g = new THREE.Group(); g.position.set(x, y, 0);
    const L = new THREE.Mesh(geo, md); L.position.y = -0.12; g.add(L); body.add(g); return g;
  };
  const arms = [-1, 1].map(s => { const a = limb(s * 0.26, 0.95, GEO.limb); a.rotation.z = s * 0.2; return a; });
  const legs = [-1, 1].map(s => limb(s * 0.09, 0.5, GEO.leg));
  let tail = null;
  if (animal && /cat|dog|tiger|bear/.test(spec.type)) {
    tail = new THREE.Group(); tail.position.set(0, 0.65, -0.16); body.add(tail);
    const tm = new THREE.Mesh(GEO.tail, m); tm.rotation.x = 0.9; tm.position.set(0, 0.04, -0.1); tail.add(tm);
  }
  let wings = null;
  if (spec.type === 'bird') {
    wings = [-1, 1].map(s => {
      const g = new THREE.Group(); g.position.set(s * 0.16, 0.85, -0.04); body.add(g);
      const w = new THREE.Mesh(GEO.wing, m); w.scale.set(1, 0.35, 0.15); w.position.x = s * 0.07; g.add(w);
      return g;
    });
  }
  const blob = new THREE.Mesh(GEO.blob, new THREE.MeshBasicMaterial({ map: blobMap(), transparent: true, depthWrite: false, opacity: 0.65 }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; root.add(blob);

  const gait = { cat: 1.15, dog: 1.05, tiger: 1.0, bear: 0.75, bird: 1.35, ape: 0.9, human: 1, robot: 1 }[spec.type] || 1;
  const amp = { cat: 0.4, dog: 0.55, tiger: 0.45, bear: 0.5, bird: 0.3, ape: 0.5 }[spec.type] || 0.45;
  root.userData.animate = (t, dt, ctl, walkT) => {
    const B = ctl ? ctl.blend : { idle: 1, walk: 0, run: 0, jump: 0 };
    const mv = (B.walk || 0) + (B.run || 0);
    const wt = (walkT || 0) * gait;
    const sw = Math.sin(wt) * amp * mv;
    legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
    arms[0].rotation.x = -sw * 0.7 - 0.35 * (B.jump || 0); arms[1].rotation.x = sw * 0.7 - 0.35 * (B.jump || 0);
    body.position.y = Math.abs(Math.sin(wt)) * 0.035 * mv + Math.sin(t * 2) * 0.008 * (B.idle || 0);
    if (spec.type === 'bird' && mv > 0.2) body.position.y += Math.max(0, Math.sin(wt)) * 0.07;
    head.rotation.z = Math.sin(wt * 0.5) * 0.04 * mv;
    if (tail) { tail.rotation.y = Math.sin(t * (root.userData.nearPlayer ? 7 : 3) + wt) * 0.4; tail.rotation.x = 0.12 * mv; }
    ears.forEach((e, i) => { e.rotation.z = (root.userData.nearPlayer ? (i ? 0.12 : -0.12) : 0) + Math.sin(t * 5 + i) * 0.04 * mv; });
    if (wings) { const flap = Math.sin(t * (mv > 0.2 ? 10 : 3)) * (0.18 + mv * 0.25); wings[0].rotation.y = flap; wings[1].rotation.y = -flap; }
  };
  return root;
}

/** Rule-placed seats / stools / planters / cones. Keeps plaza / doors / Unstuck clear. */
export function scatterSeats(scene, { blocks, groundH, FLOOR = 0.35, low = false, colliders = [] }) {
  const dens = low ? 0.4 : 0.85;
  const bench = new Batch(new THREE.BoxGeometry(1.4, 0.12, 0.42), bakeMat('#6a5644', 0.35), Math.floor(28 * dens));
  const leg = new Batch(new THREE.BoxGeometry(0.08, 0.42, 0.08), bakeMat('#3a3028', 0.2), Math.floor(80 * dens));
  const stool = new Batch(new THREE.CylinderGeometry(0.22, 0.24, 0.55, 8), bakeMat('#5a4a3a', 0.3), Math.floor(20 * dens));
  const planter = new Batch(new THREE.BoxGeometry(0.7, 0.45, 0.7), bakeMat('#4a6a48', 0.3), Math.floor(22 * dens));
  const cone = new Batch(new THREE.ConeGeometry(0.18, 0.55, 8), bakeMat('#e07030', 0.15), Math.floor(16 * dens));
  const placed = [];

  const tryPlace = (x, z, kind, ry, addFn) => {
    if (!isClearSpot(x, z, blocks)) return false;
    // also keep a little clear of other seats we just placed
    for (const p of placed) if (Math.hypot(p.x - x, p.z - z) < 1.35) return false;
    const y = typeof groundH === 'function' ? groundH(x, z) : FLOOR;
    if (!addFn(x, y, z, ry)) return false;
    placed.push({ x, z, kind, y });
    if (kind === 'bench' || kind === 'planter') colliders.push({ x, z, r: kind === 'bench' ? 0.55 : 0.4, hop: 0.55 });
    else if (kind === 'stool') colliders.push({ x, z, r: 0.3, hop: 0.5 });
    else if (kind === 'cone') colliders.push({ x, z, r: 0.25 });
    return true;
  };

  // plaza-rim seats facing inward
  const N = Math.floor((low ? 7 : 14) * dens);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.31;
    const r = PLAZA_R + 1.15 + HASH(i + 3) * 0.55;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const ry = a + Math.PI; // face plaza
    const roll = HASH(i + 11);
    if (roll < 0.55) {
      tryPlace(x, z, 'bench', ry, (x, y, z, ry) => {
        if (!bench.add(x, y + 0.42, z, ry)) return false;
        leg.add(x + Math.cos(ry) * 0.5 - Math.sin(ry) * 0.12, y + 0.21, z + Math.sin(ry) * 0.5 + Math.cos(ry) * 0.12, ry);
        leg.add(x - Math.cos(ry) * 0.5 - Math.sin(ry) * 0.12, y + 0.21, z - Math.sin(ry) * 0.5 + Math.cos(ry) * 0.12, ry);
        leg.add(x + Math.cos(ry) * 0.5 + Math.sin(ry) * 0.12, y + 0.21, z + Math.sin(ry) * 0.5 - Math.cos(ry) * 0.12, ry);
        leg.add(x - Math.cos(ry) * 0.5 + Math.sin(ry) * 0.12, y + 0.21, z - Math.sin(ry) * 0.5 - Math.cos(ry) * 0.12, ry);
        return true;
      });
    } else if (roll < 0.78) {
      tryPlace(x, z, 'stool', ry, (x, y, z, ry) => stool.add(x, y + 0.28, z, ry));
    } else {
      tryPlace(x, z, 'planter', ry, (x, y, z, ry) => planter.add(x, y + 0.22, z, ry));
    }
  }

  // alley / shop-edge stools + cones (outside door clear via isClearSpot)
  for (let bi = 0; bi < (blocks || []).length; bi++) {
    const bk = blocks[bi]; if (!bk || !bk.g) continue;
    const gx = bk.g.position.x, gz = bk.g.position.z;
    const fwd = new THREE.Vector3(-gx, 0, -gz).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), fwd).normalize();
    const n = low ? 1 : 2;
    for (let k = 0; k < n; k++) {
      const along = (HASH(bi * 19 + k) - 0.5) * (bk.w - 3.2);
      if (Math.abs(along) < 1.8) continue;
      const out = bk.d / 2 + 1.35 + HASH(bi * 23 + k) * 0.5;
      const x = gx + right.x * along + fwd.x * out;
      const z = gz + right.z * along + fwd.z * out;
      const ry = Math.atan2(fwd.x, fwd.z);
      if (HASH(bi * 29 + k) < 0.5) tryPlace(x, z, 'stool', ry, (x, y, z, ry) => stool.add(x, y + 0.28, z, ry));
      else tryPlace(x, z, 'cone', ry, (x, y, z, ry) => cone.add(x, y + 0.28, z, ry));
    }
  }

  // a couple of seats near arcade entrance pavement (outside door wedge — z > -20)
  [[-4.2, -18.4, 0], [4.0, -18.4, 0], [18.8, -2.2, Math.PI / 2], [-10.5, 2.5, -Math.PI / 2]].forEach(([x, z, ry], i) => {
    tryPlace(x, z, i % 2 ? 'stool' : 'bench', ry, (x, y, z, ry) => {
      if (i % 2) return stool.add(x, y + 0.28, z, ry);
      if (!bench.add(x, y + 0.42, z, ry)) return false;
      leg.add(x + 0.5, y + 0.21, z + 0.12, ry); leg.add(x - 0.5, y + 0.21, z + 0.12, ry);
      leg.add(x + 0.5, y + 0.21, z - 0.12, ry); leg.add(x - 0.5, y + 0.21, z - 0.12, ry);
      return true;
    });
  });

  [bench, leg, stool, planter, cone].forEach(b => b.build(scene));
  window.__lifeSeats = placed;
  return { placed, batches: { bench, leg, stool, planter, cone } };
}

function steerAvoid(x, z, blocks, props, player, others, self) {
  let vx = 0, vz = 0;
  // keep off plaza centre a bit (wander the rim)
  const r = Math.hypot(x, z);
  if (r < PLAZA_R - 1.5) { vx += x / (r || 1) * 0.8; vz += z / (r || 1) * 0.8; }
  if (r > PLAZA_R + 14) { vx -= x / (r || 1) * 0.9; vz -= z / (r || 1) * 0.9; }
  // buildings
  for (const bk of blocks || []) {
    if (!bk || !bk.g) continue;
    const dx = x - bk.g.position.x, dz = z - bk.g.position.z;
    const d = Math.hypot(dx, dz), pad = Math.max(bk.w, bk.d) * 0.4 + 1.2;
    if (d < pad && d > 0.01) { vx += dx / d * (pad - d); vz += dz / d * (pad - d); }
  }
  // props / seats
  for (const p of props || []) {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d < 1.1 && d > 0.01) { vx += dx / d * (1.1 - d); vz += dz / d * (1.1 - d); }
  }
  // player — stop / circle near
  if (player) {
    const dx = x - player.x, dz = z - player.z, d = Math.hypot(dx, dz);
    if (d < 2.2 && d > 0.01) { vx += dx / d * (2.2 - d) * 1.4; vz += dz / d * (2.2 - d) * 1.4; }
  }
  // other NPCs
  for (const o of others || []) {
    if (o === self) continue;
    const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz);
    if (d < 1.4 && d > 0.01) { vx += dx / d * (1.4 - d); vz += dz / d * (1.4 - d); }
  }
  // safe spots — soft push out so Unstuck stays clear
  for (const s of SAFE_SPOTS) {
    const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz);
    if (d < 1.8 && d > 0.01) { vx += dx / d * (1.8 - d); vz += dz / d * (1.8 - d); }
  }
  return { vx, vz };
}

function spawnWanderers(scene, { blocks, groundH, FLOOR = 0.35, low = false, seats = [] }) {
  const n = low ? 3 : 5;
  const animals = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    const r = PLAZA_R + 2.5 + HASH(i + 40) * 6;
    let x = Math.cos(a) * r, z = Math.sin(a) * r;
    // nudge until clear
    for (let k = 0; k < 8; k++) {
      if (isClearSpot(x, z, blocks)) break;
      const aa = a + k * 0.4; x = Math.cos(aa) * (r + k); z = Math.sin(aa) * (r + k);
    }
    const y = typeof groundH === 'function' ? groundH(x, z) : FLOOR;
    const spec = npcSpec(i);
    const root = buildLiteNpc(spec, { animal: true });
    root.name = `npc-animal-${spec.type}-${i}`;
    root.userData.npcLife = true;
    root.userData.npcKind = 'animal';
    root.userData.npcSpec = spec;
    root.position.set(x, y, z);
    root.rotation.y = a + Math.PI;
    root.scale.setScalar(0.92);
    scene.add(root);
    const ctl = mkCtl();
    animals.push({
      root, ctl, spec, x, z, y, yaw: a + Math.PI,
      walkT: HASH(i) * 10,
      state: 'wander', // wander | idle | sniff | sit
      stateT: 2 + HASH(i + 5) * 4,
      heading: a + Math.PI,
      speed: 1.1 + HASH(i + 7) * 0.7,
      nearPlayer: false,
    });
  }
  return animals;
}

/** Arcade cabinet players — standing at Coming Soon / live machines with mash + cheer. */
function spawnArcadePlayers(scene, { FLOOR = 0.35, low = false }) {
  // cabinets at x = -5.5 + i*2.2, z = -27.6 (props.js). Stand just in front (toward door = +z).
  const slots = low
    ? [[-5.5 + 2 * 2.2, -26.35], [-5.5 + 3 * 2.2, -26.35]] // runners + puzzles
    : [[-5.5 + 2 * 2.2, -26.35], [-5.5 + 3 * 2.2, -26.35], [-5.5 + 4 * 2.2, -26.35]];
  const players = [];
  slots.forEach(([x, z], i) => {
    const spec = arcadeSpec(i);
    const root = buildLiteNpc(spec, { animal: false });
    root.name = `npc-arcade-${i}`;
    root.userData.npcLife = true;
    root.userData.npcKind = 'arcade';
    root.position.set(x, FLOOR, z);
    root.rotation.y = Math.PI; // face -z toward cabinets
    root.scale.setScalar(0.95);
    scene.add(root);
    const ctl = mkCtl();
    // soft screen glow sprite in front of them (fake cabinet flicker companion)
    const glowC = document.createElement('canvas'); glowC.width = glowC.height = 64;
    const gg = glowC.getContext('2d');
    const rg = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(120,255,255,0.85)'); rg.addColorStop(1, 'rgba(120,255,255,0)');
    gg.fillStyle = rg; gg.fillRect(0, 0, 64, 64);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowC), blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, opacity: 0.35, toneMapped: false,
    }));
    spr.scale.set(0.9, 0.7, 1); spr.position.set(0, 1.35, -0.55); root.add(spr);
    players.push({
      root, ctl, spec, x, z, y: FLOOR, yaw: Math.PI,
      walkT: 0, mash: 0, cheerT: 4 + HASH(i + 90) * 8, glow: spr,
      phase: HASH(i) * 6,
    });
  });
  return players;
}

function updateAnimal(a, dt, t, ctx) {
  const { blocks, seats, player, animals } = ctx;
  const dx = a.x - (player?.x || 0), dz = a.z - (player?.z || 0);
  const dist = Math.hypot(dx, dz);
  a.root.visible = dist < LOD_HIDE;
  if (!a.root.visible) return;
  const slow = dist > LOD_SLOW;
  const step = slow ? dt * 0.45 : dt;

  a.stateT -= step;
  a.nearPlayer = dist < 3.2;
  a.root.userData.nearPlayer = a.nearPlayer;

  if (a.stateT <= 0) {
    const roll = HASH(((t * 17 + a.x * 3) | 0) + 3);
    if (a.nearPlayer) { a.state = 'sniff'; a.stateT = 1.4 + roll; }
    else if (roll < 0.22) { a.state = 'sit'; a.stateT = 2.5 + roll * 2; }
    else if (roll < 0.4) { a.state = 'idle'; a.stateT = 1.5 + roll; }
    else { a.state = 'wander'; a.stateT = 3 + roll * 4; a.heading += (roll - 0.5) * 1.6; }
  }

  const ctl = a.ctl;
  ctl.blend.idle = 1; ctl.blend.walk = 0; ctl.blend.run = 0;
  ctl.speed = 0; ctl.turnRate = 0; ctl.grounded = true;

  if (a.state === 'wander' && !a.nearPlayer) {
    const avoid = steerAvoid(a.x, a.z, blocks, seats, player, animals, a);
    let hx = Math.sin(a.heading) + avoid.vx * 0.55;
    let hz = Math.cos(a.heading) + avoid.vz * 0.55;
    const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl;
    const spd = a.speed * (slow ? 0.7 : 1);
    const nx = a.x + hx * spd * step;
    const nz = a.z + hz * spd * step;
    // only step if still roughly clear / not inside building
    let ok = true;
    for (const bk of blocks || []) {
      if (!bk?.g) continue;
      const d = Math.hypot(nx - bk.g.position.x, nz - bk.g.position.z);
      if (d < Math.max(bk.w, bk.d) * 0.35 + 0.8) { ok = false; break; }
    }
    if (ok) { a.x = nx; a.z = nz; }
    else a.heading += 1.2;
    const wantYaw = Math.atan2(hx, hz);
    let dy = wantYaw - a.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    a.yaw += dy * Math.min(1, 6 * step);
    ctl.turnRate = dy;
    ctl.blend.idle = 0; ctl.blend.walk = 1; ctl.speed = spd;
    a.walkT += step * spd * 2.2;
    // ground
    a.y = typeof ctx.groundH === 'function' ? ctx.groundH(a.x, a.z) : ctx.FLOOR;
  } else if (a.state === 'sit') {
    // mild crouch via body animate idle; keep still
    ctl.blend.idle = 1;
  } else if (a.state === 'sniff') {
    ctl.blend.idle = 1;
    // face player
    if (player) {
      const want = Math.atan2(player.x - a.x, player.z - a.z);
      let dy = want - a.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      a.yaw += dy * Math.min(1, 4 * step);
      ctl.turnRate = dy;
    }
  }

  a.root.position.set(a.x, a.y, a.z);
  a.root.rotation.y = a.yaw;
  if (a.root.userData.animate) a.root.userData.animate(t, step, ctl, a.walkT);
}

function updateArcade(p, dt, t) {
  const ctl = p.ctl;
  ctl.blend.idle = 1; ctl.blend.walk = 0; ctl.speed = 0; ctl.grounded = true;
  // button-mash bob
  p.mash += dt;
  const bob = Math.sin(t * 9 + p.phase) * 0.025 + Math.sin(t * 17 + p.phase) * 0.012;
  p.root.position.y = p.y + Math.abs(bob);
  // arms via animate idle + slight walk blend for mash feel
  ctl.blend.walk = 0.15 + 0.1 * Math.sin(t * 11 + p.phase);
  p.walkT += dt * 3;
  // cheer occasionally — hop + glow flash
  p.cheerT -= dt;
  if (p.cheerT <= 0) {
    p.cheerT = 6 + HASH((t * 3) | 0) * 8;
    ctl.blend.jump = 0.7;
  } else {
    ctl.blend.jump = Math.max(0, ctl.blend.jump - dt * 1.5);
  }
  if (p.glow) {
    p.glow.material.opacity = 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(t * 14 + p.phase));
    p.glow.scale.setScalar(0.8 + 0.25 * Math.sin(t * 11 + p.phase));
  }
  if (p.root.userData.animate) p.root.userData.animate(t, dt, ctl, p.walkT);
}

/**
 * Install seats + wandering animals + arcade NPCs. Returns { update, info }.
 */
export function installLobbyLife(scene, {
  blocks, groundH, FLOOR = 0.35, colliders = [], low = false, getPlayer = () => null,
} = {}) {
  const seats = scatterSeats(scene, { blocks, groundH, FLOOR, low, colliders });
  const animals = spawnWanderers(scene, { blocks, groundH, FLOOR, low, seats: seats.placed });
  const arcade = spawnArcadePlayers(scene, { FLOOR, low });

  const info = () => ({
    seats: seats.placed.length,
    animals: animals.filter(a => !a._cappedOff).length,
    arcade: arcade.filter(p => !p._cappedOff).length,
    animalPos: animals.filter(a => !a._cappedOff).map(a => ({
      type: a.spec.type, x: +a.x.toFixed(2), z: +a.z.toFixed(2), y: +a.y.toFixed(2),
      visible: a.root.visible, state: a.state,
    })),
    arcadePos: arcade.filter(p => !p._cappedOff).map(p => ({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: +p.y.toFixed(2) })),
  });

  const assertOk = () => {
    const fails = [];
    for (const a of animals) {
      const gy = typeof window.__lobbyLifeGround === 'function' ? window.__lobbyLifeGround(a.x, a.z) : (a.y);
      if (a.y < -0.5 || (Number.isFinite(gy) && a.y < gy - 0.35)) fails.push(`animal below ground y=${a.y} g=${gy}`);
      for (const bk of blocks || []) {
        if (!bk?.g) continue;
        const d = Math.hypot(a.x - bk.g.position.x, a.z - bk.g.position.z);
        if (d < Math.max(bk.w, bk.d) * 0.3) fails.push(`animal inside building ${a.spec.type}`);
      }
      // parts attached: root has children
      if (!a.root.children.length) fails.push('animal empty root');
    }
    for (const p of seats.placed) {
      if (!isClearSpot(p.x, p.z, blocks) && Math.hypot(p.x, p.z) < PLAZA_R - 1.2) fails.push(`seat in plaza ${p.kind}`);
      for (const s of SAFE_SPOTS) if (Math.hypot(p.x - s.x, p.z - s.z) < 1.5) fails.push(`seat on safe ${p.kind}`);
    }
    return fails;
  };

  const LOW_ANIMALS = 3, LOW_ARCADE = 2, HI_ANIMALS = 5, HI_ARCADE = 3;
  function applyCap(isLow) {
    const na = isLow ? LOW_ANIMALS : HI_ANIMALS;
    const nc = isLow ? LOW_ARCADE : HI_ARCADE;
    animals.forEach((a, i) => {
      const on = i < na;
      a._cappedOff = !on;
      a.root.visible = on;
      // must leave scene when capped — traverse still counts invisible meshes
      if (on) { if (!a.root.parent) scene.add(a.root); }
      else if (a.root.parent) a.root.parent.remove(a.root);
    });
    arcade.forEach((p, i) => {
      const on = i < nc;
      p._cappedOff = !on;
      p.root.visible = on;
      if (on) { if (!p.root.parent) scene.add(p.root); }
      else if (p.root.parent) p.root.parent.remove(p.root);
    });
    if (seats && seats.batches) {
      for (const b of Object.values(seats.batches)) {
        if (!b || !b.im) continue;
        const full = b.list.length;
        b.im.count = isLow ? Math.max(1, Math.ceil(full * 0.55)) : full;
        // also detach excess seat IM entirely on aggressive low if still over — keep attached
      }
    }
  }
  applyCap(!!low);

  const api = {
    seats, animals, arcade, info, assertOk,
    setLow(on) { applyCap(!!on); },
    update(t, dt) {
      const player = getPlayer && getPlayer();
      const ctx = { blocks, seats: seats.placed, player, animals, groundH, FLOOR };
      for (const a of animals) { if (a._cappedOff) continue; updateAnimal(a, dt, t, ctx); }
      for (const p of arcade) { if (p._cappedOff) continue; updateArcade(p, dt, t); }
    },
  };
  window.__npclife = api;
  return api;
}
