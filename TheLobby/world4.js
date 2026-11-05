// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// B34N5 Lobby - step 5: swap procedural boxes for CC0 Kenney glTF models + CC0 ambientCG PBR textures.
// Models: Kenney City Kit Commercial/Suburban, Furniture Kit (CC0). Textures: ambientCG (CC0). See CREDITS.md.
import * as THREE from './lib/three.module.js';
import { inLot } from './world3.js';
import { GLTFLoader } from './lib/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader(), tl = new THREE.TextureLoader(), cache = {};
const load = url => cache[url] || (cache[url] = loader.loadAsync(url).then(g => { g.scene.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } }); return g.scene; }));

// 1K JPG PBR sets (colour + GL normal + roughness), shared across all users of a material.
export function pbr(name, rep = 1, o = {}) {
  const f = m => { const t = tl.load(`assets/textures/${name}_1K-JPG_${m}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 4; if (m === 'Color') t.colorSpace = THREE.SRGBColorSpace; return t; };
  return new THREE.MeshStandardMaterial({ map: f('Color'), normalMap: f('NormalGL'), roughnessMap: f('Roughness'), roughness: 1, metalness: 0, ...o });
}

// Place a model so its footprint width fits `fitW` (uniform scale), base on y, facing +z of the given group frame.
// Shared facade materials (1K ambientCG CC0) — phone-smooth: one material set reused across all Kenney buildings.
let _facadeMats = null;
function facadeMats() {
  if (_facadeMats) return _facadeMats;
  const low = !!(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  // Phone: MeshBasic Color maps (always readable at dusk). Desktop: light Standard PBR.
  const colorMap = (name, rep) => {
    const t = tl.load(`assets/textures/${name}_1K-JPG_Color.jpg`);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rep, rep); t.anisotropy = 2;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    return t;
  };
  const brick = low
    ? new THREE.MeshBasicMaterial({ map: colorMap('Bricks076C', 2), color: 0xe8d8d0, toneMapped: true })
    : pbr('Bricks076C', 3.5, { color: 0xd8c8c0, roughness: 0.85, metalness: 0.05 });
  const plaster = low
    ? new THREE.MeshBasicMaterial({ map: colorMap('Plaster001', 1.5), color: 0xd0c8d8, toneMapped: true })
    : pbr('Plaster001', 2.5, { color: 0xc0b8c8, roughness: 0.9, metalness: 0.02 });
  const asphalt = low
    ? new THREE.MeshBasicMaterial({ map: colorMap('Asphalt025C', 1.2), color: 0x8a8898, toneMapped: true })
    : pbr('Asphalt025C', 2, { color: 0x7a7888, roughness: 0.75, metalness: 0.15 });
  // Canvas window-grid overlay (original, not third-party art)
  const win = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#1a1520'; g.fillRect(0, 0, 128, 256);
    for (let y = 8; y < 248; y += 28) for (let x = 8; x < 120; x += 28) {
      const lit = ((x * 3 + y * 7) % 11) > 4;
      g.fillStyle = lit ? 'rgba(120,220,255,0.7)' : 'rgba(30,40,60,0.9)';
      g.fillRect(x, y, 18, 20);
      g.strokeStyle = 'rgba(180,200,220,0.35)'; g.strokeRect(x, y, 18, 20);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 2;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    if (low) return new THREE.MeshBasicMaterial({ map: t, toneMapped: true });
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: 0.2, emissive: 0x204060, emissiveIntensity: 0.35 });
  })();
  _facadeMats = { brick, plaster, asphalt, win, low };
  return _facadeMats;
}

/** Retexture a Kenney city mesh: wall-ish → brick/plaster, dark → metal/asphalt, glass-ish → window grid. */
function dressBuilding(root, tint) {
  const mats = facadeMats();
  root.traverse(o => {
    if (!o.isMesh) return;
    const src = o.material;
    const col = (src && src.color) ? src.color.clone() : new THREE.Color(0x888888);
    // Soft tint only — keep Color maps readable (don't crush to muddy dusk)
    if (tint) col.lerp(tint, 0.35);
    const lum = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;
    let mat;
    if (lum < 0.22) mat = mats.asphalt.clone();
    else if (lum > 0.55 && col.b > col.r * 0.9) mat = mats.win.clone();
    else if ((o.name || '').toLowerCase().includes('window') || lum < 0.35) mat = mats.win.clone();
    else if (lum > 0.45) mat = mats.plaster.clone();
    else mat = mats.brick.clone();
    if (mat.color) mat.color.multiply(col);
    o.material = mat;
    o.castShadow = false; o.receiveShadow = true;
  });
}

export async function place(scene, url, { x, y, z, ry = 0, fitW = null, fitH = null, scale = 1, tint = null, dress = false }) {
  const src = await load(url), m = src.clone(true);
  if (dress) dressBuilding(m, tint);
  else if (tint) m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(tint); o.material.roughness = 0.55; o.material.envMapIntensity = 1.2; } });
  const bb = new THREE.Box3().setFromObject(m), sz = bb.getSize(new THREE.Vector3());
  let s = scale; if (fitW) s = fitW / Math.max(sz.x, 1e-3); if (fitH) s = Math.min(s, fitH / sz.y);
  m.scale.setScalar(s); m.position.set(x - (bb.min.x + sz.x / 2) * s, y - bb.min.y * s, z - (bb.min.z + sz.z / 2) * s);
  const pivot = new THREE.Group(); pivot.position.set(x, 0, z); pivot.rotation.y = ry; m.position.x -= x; m.position.z -= z; pivot.add(m);
  scene.add(pivot); return pivot;
}

const CC = 'assets/kenney/city-commercial/', SB = 'assets/kenney/city-suburban/', FU = 'assets/kenney/furniture/';
const BLD = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'k', 'l', 'm', 'n'].map(c => `${CC}building-${c}.glb`);
const SKY = ['a', 'b', 'c'].map(c => `${CC}building-skyscraper-${c}.glb`);

const TINTS = [new THREE.Color(0.78, 0.66, 0.7), new THREE.Color(0.7, 0.68, 0.8), new THREE.Color(0.82, 0.7, 0.62)];
export function buildWorld4(scene, { blocks, groundH, FLOOR, colliders = [] }) {
  // 1) street buildings: one detailed Kenney building per old block lot (old box meshes are hidden in main.js)
  for (const bk of blocks) {
    const { g, w, h, k } = bk, url = h > 22 ? SKY[k % 3] : BLD[k % BLD.length];
    place(scene, url, { x: g.position.x, y: g.position.y + 0.5, z: g.position.z, ry: g.rotation.y, fitW: w, fitH: h + 4, tint: TINTS[k % 3], dress: true });
  }
  // a few awnings/parasols + trees/planters around the plaza edge (instanced-light: shared geometry via clone)
  const ring = (n, r, off = 0) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2 + off; return [Math.cos(a) * r, Math.sin(a) * r, -a + Math.PI / 2]; });
  ring(10, 19, 0.3).forEach(([x, z, ry], i) => { if ((Math.abs(x) < 8 && z > 15) || inLot(x, z, 2)) return; place(scene, i % 2 ? `${SB}tree-large.glb` : `${SB}planter.glb`, { x, z, y: groundH(x, z), ry, scale: i % 2 ? 2.2 : 1.6 }); colliders.push(i % 2 ? { x, z, r: 0.5 } : { x, z, r: 0.5, hop: 0.55 }); });
  ring(6, 15.2, 0.9).forEach(([x, z, ry], i) => { if ((Math.abs(x) < 8 && z > 10) || inLot(x, z, 2)) return; place(scene, `${CC}detail-parasol-a.glb`, { x, z, y: FLOOR, ry, scale: 2.0 }); });

  // 2) ESCROW PALACE room furniture (Kenney Furniture Kit). Positions match the procedural colliders in world3.js.
  const U = 3.7;
  const F = (n, x, z, ry, scale = 1.9, tint = null) => place(scene, `${FU}${n}.glb`, { x, y: U, z, ry, scale, tint });
  F('bedDouble', -4.55, 36.1, Math.PI, 1.9, new THREE.Color(0.75, 0.75, 0.72)); F('loungeSofa', -1.7, 32.0, Math.PI, 1.9, new THREE.Color(0.35, 0.45, 0.5)); F('desk', -5.1, 29.9, Math.PI / 2); F('chairDesk', -4.2, 29.9, -Math.PI / 2);
  F('cabinetTelevision', -1.7, 37.4, Math.PI); F('lampRoundFloor', -3.2, 34.1, 0); F('rugRectangle', -1.8, 33.6, 0, 2.6, new THREE.Color(0.38, 0.42, 0.32)); F('pottedPlant', 1.9, 37.3, 0);
  F('bookcaseOpen', -5.5, 32.9, Math.PI / 2); F('tableCoffee', -1.7, 33.6, 0); F('computerScreen', -5.2, 29.9, Math.PI / 2, 1.2 * 1.9 / 1.9);
}

// ---- Easter eggs (subtle, original; list kept privately in EASTER_EGGS.md) ----
const ctex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const decal = (scene, tex, w, h, x, y, z, ry, basic = true) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }) : new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9 })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };
const sign = (txt, sub) => ctex(256, 96, (q, w, h) => { q.fillStyle = '#1f6a4a'; q.beginPath(); q.roundRect(2, 2, w - 4, h - 4, 10); q.fill(); q.strokeStyle = '#e8f4ee'; q.lineWidth = 4; q.stroke(); q.fillStyle = '#e8f4ee'; q.textAlign = 'center'; q.font = '700 38px system-ui'; q.fillText(txt, w / 2, 50); q.font = '18px system-ui'; q.fillText(sub, w / 2, 78); });
export function buildEasterEggs(scene) {
  const anim = [];
  // 1. faded '589' graffiti on the back (north) wall of ESCROW PALACE, outside, facing away from the plaza
  decal(scene, ctex(256, 128, (q, w, h) => { q.globalAlpha = 0.75; q.fillStyle = '#22f0ff'; q.font = 'italic 900 92px system-ui'; q.rotate(-0.08); q.fillText('589', 30, 100); q.globalAlpha = 0.5; q.fillStyle = '#ff3df0'; q.fillRect(30, 108, 160, 6); }), 1.8, 0.9, 2.5, 1.6, 38.03, 0, false);
  // 2. street-sign puns on lamp-height posts at the plaza edge
  [['Escrow Ln', 'release on condition'], ['Trustline Ave', 'set your limit']].forEach(([t, s2], i) => {
    const x = i ? -17.5 : 17.5, z = -6;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 8), new THREE.MeshStandardMaterial({ color: 0x55606a, metalness: 0.7, roughness: 0.4 })); post.position.set(x, 1.5, z); scene.add(post);
    const d = decal(scene, sign(t, s2), 1.3, 0.48, x, 2.8, z, i ? Math.PI / 2 : -Math.PI / 2); d.material.side = THREE.DoubleSide;
  });
  // 3. riddle note pinned above the desk in the apartment
  decal(scene, ctex(256, 256, (q, w, h) => { q.fillStyle = '#f2e6c8'; q.fillRect(0, 0, w, h); q.fillStyle = '#3a2a20'; q.font = '20px Georgia'; ['Five feet walk,', 'eight lamps glow,', 'nine keys turn.', 'Add them up and', 'reduce to one:', 'what does the', 'ledger remember?', '            - B'].forEach((l, i) => q.fillText(l, 20, 36 + i * 28)); }), 0.42, 0.42, -5.66, 3.7 + 1.55, 30.6, Math.PI / 2, false);
  // 4. tiny B34N5 bean figurine on the bookshelf (green pod + white seedling, per the V11 art rules)
  const bean = new THREE.Group();
  const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.06, 6, 12), new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.4 })); pod.rotation.z = 0.3; bean.add(pod);
  const shades = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.2 })); shades.position.set(0, 0.04, 0.045); bean.add(shades);
  const sprout = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff })); sprout.position.y = 0.11; bean.add(sprout);
  bean.position.set(-5.45, 3.7 + 1.32, 33.3); bean.rotation.y = Math.PI / 2; // step 6: not added - no B34N5 defaults anywhere (Beans rule)
  // 5. neon sign that secretly flickers 5-8-9 in short bursts (watch the 'OPEN' sign by the arcade row)
  const open = decal(scene, ctex(256, 96, (q, w, h) => { q.shadowColor = '#ff3df0'; q.shadowBlur = 18; q.fillStyle = '#ff9af5'; q.font = '800 64px system-ui'; q.textAlign = 'center'; q.fillText('OPEN', w / 2, 70); }), 1.4, 0.52, 0, 3.4, -19.2, 0);
  const code = [5, 8, 9]; let cyc = 0;
  anim.push(t => { const c = t % 14, idx = Math.floor(c / 4); if (idx > 2) { open.material.opacity = 1; return; } const n = code[idx], ph = (c % 4) / 3; open.material.opacity = ph < 1 && Math.floor(ph * n * 2) % 2 === 0 ? 0.15 : 1; });
  // 6. hidden ledger index   
  decal(scene, ctex(256, 64, (q, w, h) => { q.fillStyle = 'rgba(120,250,255,0.55)'; q.font = '20px monospace'; q.fillText('ledger #0 · genesis was here', 8, 40); }), 1.6, 0.4, 0, 0.37, -19.0, 0, true).rotation.x = -Math.PI / 2;
  return { update: t => anim.forEach(f => f(t)) };
}
