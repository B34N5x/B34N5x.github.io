// (c) 2026 B34N5x. All rights reserved.
// Environment pass: grounded street denseness + phone-smooth quality tiers.
// FogExp2 dusk grade, InstancedMesh prop scatter (paths/doors/Unstuck clear),
// weathered facade decals (MeshBasicMaterial bg), fake bloom + steam on low,
// camera shake + billboard debris (respects reduced-motion). No GPL/LGPL/CC-BY-SA.
import * as THREE from './lib/three.module.js';

const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const LW = () => !!(window.__perf && window.__perf.low);

// Plaza footpath + Unstuck safe spots + building door wedges must stay clear.
export const PLAZA_R = 16;
export const SAFE_SPOTS = [{ x: 0, z: 0 }, { x: 3, z: 3 }, { x: -3, z: 3 }, { x: 3, z: -3 }, { x: -3, z: -3 }, { x: 0, z: 6 }];
const DOOR_CLEAR = 2.2; // metres in front of building face
const PATH_CLEAR = 1.15; // keep kerb/bollard off walk centre
const SAFE_R = 1.6;

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();

function ctex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return t;
}

function hash(i) { let x = (i * 374761393 + 668265263) | 0; x = (x ^ (x >>> 13)) * 1274126177; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; }

export function isClearSpot(x, z, blocks) { return !blocked(x, z, blocks); }

function blocked(x, z, blocks) {
  if (Math.hypot(x, z) < PLAZA_R - PATH_CLEAR) return true; // open plaza
  for (const s of SAFE_SPOTS) if (Math.hypot(x - s.x, z - s.z) < SAFE_R) return true;
  for (const bk of blocks || []) {
    const gx = bk.g.position.x, gz = bk.g.position.z;
    const half = Math.max(bk.w, bk.d) / 2 + 0.4;
    // keep building footprint + front door strip clear
    const local = new THREE.Vector3(x - gx, 0, z - gz);
    // approximate facing toward plaza origin
    const fwd = new THREE.Vector3(-gx, 0, -gz).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), fwd).normalize();
    const along = local.dot(right), out = local.dot(fwd);
    if (Math.abs(along) < bk.w / 2 + 0.5 && out > -bk.d / 2 - 0.2 && out < bk.d / 2 + DOOR_CLEAR) return true;
    if (Math.hypot(x - gx, z - gz) < half * 0.55) return true;
  }
  return false;
}

class Batch {
  constructor(geo, mat, max = 256) { this.geo = geo; this.m = mat; this.list = []; this.max = max; this.im = null; }
  add(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
    if (this.list.length >= this.max) return;
    E.set(0, ry, 0); Q.setFromEuler(E); S.set(sx, sy, sz); P.set(x, y, z);
    this.list.push(M4.compose(P, Q, S).clone());
  }
  build(scene, shadow = false) {
    if (!this.list.length) return null;
    const im = new THREE.InstancedMesh(this.geo, this.m, this.list.length);
    this.list.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = !!shadow; im.receiveShadow = true;
    im.userData.envProp = true;
    scene.add(im); this.im = im; return im;
  }
}

function bakeBasic(color, ao = 0.35) {
  // Diffuse with baked AO darkening toward bottom of UV (wall base).
  const map = ctex(64, 64, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, `rgba(0,0,0,${ao})`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // fine grain
    for (let i = 0; i < 80; i++) {
      g.fillStyle = `rgba(0,0,0,${0.04 + hash(i) * 0.08})`;
      g.fillRect((hash(i + 3) * w) | 0, (hash(i + 7) * h) | 0, 1 + (hash(i + 9) * 3) | 0, 1);
    }
  });
  return new THREE.MeshBasicMaterial({ map, toneMapped: true });
}

function grimeDecal() {
  return ctex(128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) {
      const x = 20 + hash(i) * (w - 40);
      const gr = g.createLinearGradient(x, 0, x, h);
      gr.addColorStop(0, 'rgba(40,30,25,0)');
      gr.addColorStop(0.2, `rgba(50,40,30,${0.35 + hash(i + 1) * 0.25})`);
      gr.addColorStop(1, 'rgba(20,15,10,0.55)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(x - 6, 0); g.lineTo(x + 6, 0); g.lineTo(x + 14 + hash(i + 2) * 10, h); g.lineTo(x - 14 - hash(i + 4) * 10, h); g.fill();
    }
  });
}

function posterTex(title, sub, col) {
  return ctex(128, 192, (g, w, h) => {
    g.fillStyle = '#1a1220'; g.fillRect(0, 0, w, h);
    g.strokeStyle = col; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = col; g.font = '800 22px system-ui'; g.textAlign = 'center';
    g.fillText(title, w / 2, 48);
    g.fillStyle = '#e8e0f0'; g.font = '600 14px system-ui';
    String(sub).split('|').forEach((l, i) => g.fillText(l, w / 2, 90 + i * 22));
    g.globalAlpha = 0.35; g.fillStyle = '#000';
    for (let i = 0; i < 40; i++) g.fillRect(hash(i) * w, hash(i + 5) * h, 3, 2);
  });
}

function crackTex() {
  return ctex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(20,15,18,0.65)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(10, 60); g.lineTo(40, 55); g.lineTo(70, 70); g.lineTo(110, 50); g.stroke();
    g.beginPath(); g.moveTo(40, 55); g.lineTo(45, 90); g.lineTo(30, 120); g.stroke();
  });
}

function puddleTex() {
  return ctex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(64, 64, 10, 64, 64, 60);
    r.addColorStop(0, 'rgba(80,120,180,0.45)');
    r.addColorStop(0.7, 'rgba(40,60,90,0.25)');
    r.addColorStop(1, 'rgba(20,30,40,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
}

function glowSpriteTex(col = '255,180,90') {
  return ctex(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, `rgba(${col},0.95)`);
    r.addColorStop(0.4, `rgba(${col},0.35)`);
    r.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  });
}

function steamTex() {
  return ctex(128, 256, (g, w, h) => {
    for (let i = 0; i < 5; i++) {
      const x = 20 + hash(i) * (w - 40);
      const gr = g.createRadialGradient(x, h * 0.7, 4, x, h * 0.3, 50);
      gr.addColorStop(0, 'rgba(200,210,220,0.22)');
      gr.addColorStop(1, 'rgba(180,190,200,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  });
}

/** Apply FogExp2 dusk purple-orange grade; keep neon readable. */
export function applyDuskGrade({ scene, renderer, fogDensity = 0.014 }) {
  const fogCol = new THREE.Color(0x5a3a58);
  if (!(scene.fog instanceof THREE.FogExp2)) scene.fog = new THREE.FogExp2(fogCol.getHex(), fogDensity);
  else { scene.fog.color.copy(fogCol); scene.fog.density = fogDensity; }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Slight warm exposure; daycycle still lerps exposure — seed a dusk bias flag
  window.__envDusk = { fog: fogCol.getHex(), density: fogDensity };
  // CSS grade overlay (cheap, keeps neon via mix-blend)
  if (!document.getElementById('envgrade')) {
    const d = document.createElement('div'); d.id = 'envgrade'; d.setAttribute('aria-hidden', 'true');
    d.style.cssText = 'pointer-events:none;position:fixed;inset:0;z-index:2;mix-blend-mode:soft-light;opacity:0.28;background:linear-gradient(180deg,rgba(90,50,110,0.35) 0%,rgba(255,140,70,0.22) 55%,rgba(40,20,50,0.4) 100%)';
    document.body.append(d);
  }
}

/** Weather facade bases: AO strip + grime leaks + original posters (made-up text). */
export function weatherFacades(scene, blocks, { low = false } = {}) {
  const grime = grimeDecal();
  const posters = [
    posterTex('NODE BITES', 'open late|trustless ramen', '#ff6af3'),
    posterTex('LEDGER LIVE', 'tonight only|plaza stage', '#4ff6ff'),
    posterTex('XRPL AMP', 'volt drop|no KYC show', '#ffb040'),
    posterTex('ESCROW MART', 'hold & release|aisle 5', '#9dffa0')
  ];
  const crack = crackTex();
  // CC0 ambientCG concrete/brick facade panels (MeshBasic + Color map — phone-cheap)
  const tl = new THREE.TextureLoader();
  const loadC = (name, rep) => {
    const t = tl.load(`assets/textures/${name}_1K-JPG_Color.jpg`);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rep, rep); t.anisotropy = 2; return t;
  };
  const brickM = new THREE.MeshBasicMaterial({ map: loadC('Bricks076C', low ? 1.5 : 2.5), toneMapped: true });
  const plasterM = new THREE.MeshBasicMaterial({ map: loadC('Plaster001', low ? 1.2 : 2), toneMapped: true });
  const count = low ? Math.min(blocks.length, 6) : blocks.length;
  for (let i = 0; i < count; i++) {
    const bk = blocks[i]; if (!bk || !bk.g) continue;
    const { g, w, h, d } = bk;
    // Full-face textured panels on street-facing sides so buildings read as brick/concrete at dusk
    const faceH = Math.min(h * 0.85, low ? 8 : 12);
    const matA = (i % 2 ? brickM : plasterM);
    const matB = (i % 2 ? plasterM : brickM);
    const faces = [
      { geo: new THREE.PlaneGeometry(w * 0.98, faceH), pos: [0, faceH / 2 + 0.05, d / 2 + 0.02], ry: 0, mat: matA },
      { geo: new THREE.PlaneGeometry(w * 0.98, faceH), pos: [0, faceH / 2 + 0.05, -d / 2 - 0.02], ry: Math.PI, mat: matB },
      { geo: new THREE.PlaneGeometry(d * 0.98, faceH), pos: [w / 2 + 0.02, faceH / 2 + 0.05, 0], ry: Math.PI / 2, mat: matA },
      { geo: new THREE.PlaneGeometry(d * 0.98, faceH), pos: [-w / 2 - 0.02, faceH / 2 + 0.05, 0], ry: -Math.PI / 2, mat: matB },
    ];
    const faceN = low ? 2 : 4; // phone: front+back only
    for (let fi = 0; fi < faceN; fi++) {
      const f = faces[fi];
      const face = new THREE.Mesh(f.geo, f.mat.clone());
      face.position.set(...f.pos); face.rotation.y = f.ry; face.userData.envProp = true; g.add(face);
    }
    // AO base strip (MeshBasicMaterial)
    const ao = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.95, 1.2), bakeBasic('#2a2228', 0.55));
    ao.position.set(0, 0.55, d / 2 + 0.02); ao.userData.envProp = true; g.add(ao);
    // grime leaks
    const nG = low ? 1 : 2 + (i % 2);
    for (let k = 0; k < nG; k++) {
      const leak = new THREE.Mesh(new THREE.PlaneGeometry(0.7 + hash(i + k) * 0.5, 2.4 + hash(i * 3 + k) * 1.5),
        new THREE.MeshBasicMaterial({ map: grime, transparent: true, depthWrite: false, opacity: 0.7, toneMapped: false }));
      leak.position.set(-w / 2 + 1.2 + k * (w / (nG + 1)), 2.2 + hash(k) * 2, d / 2 + 0.03);
      leak.userData.envProp = true; g.add(leak);
    }
    // poster
    if (!low || i % 2 === 0) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.35),
        new THREE.MeshBasicMaterial({ map: posters[i % posters.length], transparent: true, toneMapped: false }));
      p.position.set(w / 2 - 1.4, 1.8, d / 2 + 0.04); p.userData.envProp = true; g.add(p);
    }
    // wall crack
    if (!low) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4),
        new THREE.MeshBasicMaterial({ map: crack, transparent: true, depthWrite: false, opacity: 0.75, toneMapped: false }));
      c.position.set(-w / 4, 1.1, d / 2 + 0.025); c.userData.envProp = true; g.add(c);
    }
  }
}

/** Rule-based prop scatter along footpaths / building edges. */
export function scatterStreetProps(scene, { blocks, groundH, FLOOR = 0, low = false }) {
  const dens = low ? 0.45 : 1;
  const kerb = new Batch(new THREE.BoxGeometry(1.2, 0.18, 0.28), bakeBasic('#4a4550', 0.4), Math.floor(120 * dens));
  const bollard = new Batch(new THREE.CylinderGeometry(0.12, 0.14, 0.85, 8), bakeBasic('#6a6870', 0.3), Math.floor(64 * dens));
  const vent = new Batch(new THREE.BoxGeometry(0.7, 0.35, 0.5), bakeBasic('#3a383c', 0.25), Math.floor(40 * dens));
  const pipe = new Batch(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), bakeBasic('#5a4a42', 0.2), Math.floor(48 * dens));
  const bin = new Batch(new THREE.BoxGeometry(0.55, 0.9, 0.55), bakeBasic('#2f5a46', 0.35), Math.floor(36 * dens));
  const crate = new Batch(new THREE.BoxGeometry(0.65, 0.55, 0.65), bakeBasic('#8a6a44', 0.3), Math.floor(40 * dens));
  const placed = [];

  // Ring along plaza edge (footpath kerb line)
  const N = Math.floor((low ? 28 : 48) * dens);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.07;
    const r = PLAZA_R + 0.55 + (hash(i) - 0.5) * 0.3;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (blocked(x, z, blocks)) continue;
    const y = typeof groundH === 'function' ? groundH(x, z) : FLOOR;
    kerb.add(x, y + 0.09, z, a + Math.PI / 2, 1, 1, 1);
    placed.push({ x, z, kind: 'kerb' });
    if (i % 3 === 0 && !blocked(x + Math.cos(a) * 0.35, z + Math.sin(a) * 0.35, blocks)) {
      const bx = x + Math.cos(a) * 0.4, bz = z + Math.sin(a) * 0.4;
      bollard.add(bx, y + 0.42, bz, a);
      placed.push({ x: bx, z: bz, kind: 'bollard' });
    }
  }

  // Building-edge clutter (outside door clear)
  for (let bi = 0; bi < (blocks || []).length; bi++) {
    const bk = blocks[bi]; if (!bk) continue;
    const gx = bk.g.position.x, gz = bk.g.position.z;
    const fwd = new THREE.Vector3(-gx, 0, -gz).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), fwd).normalize();
    const nEdge = low ? 2 : 4;
    for (let k = 0; k < nEdge; k++) {
      const along = -bk.w / 2 + 1.2 + k * ((bk.w - 2.4) / Math.max(1, nEdge - 1));
      const out = bk.d / 2 + 1.1 + hash(bi * 11 + k) * 0.6; // past door clear (2.2) only at centre; sides ok at 1.1 if |along| large
      if (Math.abs(along) < 1.5) continue; // leave entrance centre clear
      const x = gx + right.x * along + fwd.x * out;
      const z = gz + right.z * along + fwd.z * out;
      if (blocked(x, z, blocks)) continue;
      const y = typeof groundH === 'function' ? groundH(x, z) : FLOOR;
      const roll = hash(bi * 17 + k);
      if (roll < 0.25) { bin.add(x, y + 0.45, z, Math.atan2(fwd.x, fwd.z)); placed.push({ x, z, kind: 'bin' }); }
      else if (roll < 0.45) { crate.add(x, y + 0.28, z, hash(k) * 6); placed.push({ x, z, kind: 'crate' }); }
      else if (roll < 0.65) { vent.add(x, y + 0.18, z, Math.atan2(fwd.x, fwd.z)); placed.push({ x, z, kind: 'vent' }); }
      else { pipe.add(x, y + 0.8, z, 0, 1, 1, 1); placed.push({ x, z, kind: 'pipe' }); }
    }
  }

  // Ground decals: cracks + puddles (not colliding)
  const puddleM = new THREE.MeshBasicMaterial({ map: puddleTex(), transparent: true, depthWrite: false, opacity: 0.55, toneMapped: false });
  const crackM = new THREE.MeshBasicMaterial({ map: crackTex(), transparent: true, depthWrite: false, opacity: 0.7, toneMapped: false });
  const nDecal = low ? 8 : 18;
  for (let i = 0; i < nDecal; i++) {
    const a = hash(i + 90) * Math.PI * 2;
    const r = PLAZA_R + 1.5 + hash(i + 91) * 10;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (blocked(x, z, blocks) && Math.hypot(x, z) < PLAZA_R) continue;
    const y = (typeof groundH === 'function' ? groundH(x, z) : FLOOR) + 0.02;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2 + hash(i) * 1.2, 1.2 + hash(i + 2) * 1.2), i % 2 ? puddleM : crackM);
    m.rotation.x = -Math.PI / 2; m.rotation.z = hash(i) * 6; m.position.set(x, y, z); m.userData.envProp = true; scene.add(m);
  }

  // Cable runs between bollard-ish points (simple tubes as thin boxes for draw-call thrift)
  const cable = new Batch(new THREE.BoxGeometry(1, 0.03, 0.03), bakeBasic('#1a1518', 0.1), Math.floor(24 * dens));
  for (let i = 0; i < (low ? 6 : 14); i++) {
    const a = hash(i + 200) * Math.PI * 2;
    const r = PLAZA_R + 0.8;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (blocked(x, z, blocks)) continue;
    const y = (typeof groundH === 'function' ? groundH(x, z) : FLOOR) + 2.4;
    cable.add(x, y, z, a, 2.5, 1, 1);
  }

  // Made-up street signs
  const signTitles = [['FLUX ST', 'no idling'], ['HASH WAY', 'peer only'], ['GAS LANE', 'watch fees'], ['MINT ROW', '1/1 drops']];
  for (let i = 0; i < (low ? 2 : 4); i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const r = PLAZA_R + 1.0;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (blocked(x, z, blocks)) continue;
    const y = typeof groundH === 'function' ? groundH(x, z) : FLOOR;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 6), bakeBasic('#55606a', 0.2));
    post.position.set(x, y + 1.3, z); post.userData.envProp = true; scene.add(post);
    const [t, s] = signTitles[i % signTitles.length];
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.4),
      new THREE.MeshBasicMaterial({ map: posterTex(t, s, '#e8f4ee'), toneMapped: false, side: THREE.DoubleSide }));
    board.position.set(x, y + 2.5, z); board.lookAt(0, y + 2.5, 0); board.userData.envProp = true; scene.add(board);
    placed.push({ x, z, kind: 'sign' });
  }

  [kerb, bollard, vent, pipe, bin, crate, cable].forEach(b => b.build(scene, false));
  window.__envProps = placed;
  return { placed, batches: { kerb, bollard, vent, pipe, bin, crate, cable } };
}

/** Fake bloom sprites at neon sources (phones / low). Steam/smog cards. */
export function installCheapAtmosphere(scene, { low = false } = {}) {
  const group = new THREE.Group(); group.name = 'envCheapFX'; scene.add(group);
  const glowTex = glowSpriteTex('255,160,80');
  const cyanTex = glowSpriteTex('80,240,255');
  const steamT = steamTex();
  const glows = [];
  const nGlow = low ? 10 : 18;
  for (let i = 0; i < nGlow; i++) {
    const a = (i / nGlow) * Math.PI * 2;
    const r = 14 + (i % 3) * 6;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: i % 2 ? glowTex : cyanTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: low ? 0.55 : 0.35, toneMapped: false
    }));
    spr.scale.set(low ? 3.2 : 2.2, low ? 3.2 : 2.2, 1);
    spr.position.set(Math.cos(a) * r, 2.2 + (i % 4) * 0.8, Math.sin(a) * r);
    group.add(spr); glows.push(spr);
  }
  const steams = [];
  const nSteam = low ? 4 : 7;
  for (let i = 0; i < nSteam; i++) {
    const a = hash(i + 50) * Math.PI * 2;
    const r = PLAZA_R + 2 + hash(i + 51) * 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 4.5),
      new THREE.MeshBasicMaterial({ map: steamT, transparent: true, depthWrite: false, opacity: 0.22, side: THREE.DoubleSide, toneMapped: false }));
    m.position.set(Math.cos(a) * r, 2.2, Math.sin(a) * r);
    m.userData.scroll = 0.15 + hash(i) * 0.2;
    group.add(m); steams.push(m);
  }
  return {
    group, glows, steams,
    setLow(on) {
      glows.forEach(s => { s.material.opacity = on ? 0.55 : 0.3; s.scale.setScalar(on ? 3.2 : 2.2); });
      // On high quality, hide fake bloom (composer handles it); keep soft steam.
      glows.forEach(s => { s.visible = !!on; });
    },
    update(t, dt) {
      if (RM()) return;
      for (const m of steams) {
        m.position.y = 2.0 + Math.sin(t * m.userData.scroll) * 0.25;
        m.rotation.y += dt * 0.15;
        if (m.material.map) m.material.map.offset.y = (m.material.map.offset.y + dt * 0.05) % 1;
      }
    }
  };
}

/** Camera shake + billboard debris. */
export function createImpactFeel(scene, camera) {
  let shakeT = 0, shakeAmp = 0;
  const debris = [];
  const tex = ctex(32, 32, (g) => {
    g.fillStyle = '#c8a070'; g.fillRect(8, 8, 16, 16);
    g.fillStyle = '#6a5040'; g.fillRect(10, 10, 6, 6);
  });
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    m.visible = false; scene.add(m);
    debris.push({ m, life: 0, vx: 0, vy: 0, vz: 0 });
  }
  let di = 0;
  return {
    shake(amp = 0.12, dur = 0.22) {
      if (RM() || LW()) { shakeAmp = Math.min(amp * 0.35, 0.05); shakeT = dur * 0.6; return; }
      shakeAmp = amp; shakeT = dur;
    },
    burst(pos, n = 8, speed = 2) {
      if (RM()) return;
      const N = LW() ? Math.min(4, n) : n;
      for (let k = 0; k < N; k++) {
        const p = debris[di++ % debris.length];
        p.m.visible = true; p.m.material.opacity = 0.9;
        p.m.position.set(pos.x + (Math.random() - 0.5) * 0.3, pos.y + 0.4 + Math.random() * 0.4, pos.z + (Math.random() - 0.5) * 0.3);
        p.m.scale.setScalar(0.25 + Math.random() * 0.35);
        const a = Math.random() * Math.PI * 2;
        p.vx = Math.cos(a) * speed; p.vz = Math.sin(a) * speed; p.vy = 1.5 + Math.random() * 2; p.life = 0.5 + Math.random() * 0.4;
      }
    },
    update(dt) {
      if (shakeT > 0 && camera) {
        shakeT -= dt;
        const k = Math.max(0, shakeT) * shakeAmp * 12;
        camera.position.x += (Math.random() - 0.5) * k;
        camera.position.y += (Math.random() - 0.5) * k * 0.6;
      }
      for (const p of debris) {
        if (!p.m.visible) continue;
        p.life -= dt; p.vy -= 9 * dt;
        p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
        p.m.material.opacity = Math.max(0, p.life * 1.5);
        if (p.life <= 0) p.m.visible = false;
      }
    }
  };
}

/** Ensure a single soft blob shadow under the player (reuse/replace contact). */
export function ensureBlobShadow(skinChar) {
  if (!skinChar) return null;
  let blob = skinChar.getObjectByName('envBlobShadow');
  if (blob) return blob;
  const map = ctex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 4, 64, 64, 60);
    r.addColorStop(0, 'rgba(8,6,14,0.5)');
    r.addColorStop(0.55, 'rgba(8,6,14,0.2)');
    r.addColorStop(1, 'rgba(8,6,14,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  });
  blob = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.35), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, opacity: 0.85 }));
  blob.name = 'envBlobShadow'; blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012;
  // Hide older contact planes to keep a single blob
  skinChar.traverse(o => { if (o.isMesh && o !== blob && o.material && o.material.map && o.rotation.x < -1.4 && o.position.y < 0.05) o.visible = false; });
  skinChar.add(blob);
  return blob;
}

/** Clearance assertions for tests. */
export function propsClearPaths(placed, blocks) {
  const hits = [];
  for (const p of placed || []) {
    if (Math.hypot(p.x, p.z) < PLAZA_R - PATH_CLEAR) hits.push({ ...p, why: 'plaza' });
    for (const s of SAFE_SPOTS) if (Math.hypot(p.x - s.x, p.z - s.z) < SAFE_R) hits.push({ ...p, why: 'safe' });
    for (const bk of blocks || []) {
      const gx = bk.g.position.x, gz = bk.g.position.z;
      const fwd = new THREE.Vector3(-gx, 0, -gz).normalize();
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), fwd).normalize();
      const local = new THREE.Vector3(p.x - gx, 0, p.z - gz);
      const along = local.dot(right), out = local.dot(fwd);
      if (Math.abs(along) < 1.5 && out > 0 && out < DOOR_CLEAR + bk.d / 2) hits.push({ ...p, why: 'door' });
    }
  }
  return hits;
}

export function drawCallBudget(scene, { low = false } = {}) {
  let meshes = 0, im = 0, env = 0;
  scene.traverse(o => {
    if (o.isInstancedMesh) { im++; if (o.userData.envProp) env++; }
    else if (o.isMesh || o.isSprite) { meshes++; if (o.userData.envProp) env++; }
  });
  const budget = low ? 1400 : 2200;
  return { meshes, im, env, total: meshes + im, budget, ok: meshes + im <= budget };
}
