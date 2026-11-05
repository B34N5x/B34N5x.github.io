// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// B34N5 Lobby - step 3: de-blocked street detail, clutter (instanced), enterable apartment, TV gallery.
// All procedural, original code (MIT). No third-party models.
import * as THREE from './lib/three.module.js';
import { pbr } from './world4.js';
import { RoundedBoxGeometry } from './lib/addons/geometries/RoundedBoxGeometry.js';
let onTV = () => {}; export const setTVHandler = f => { onTV = f; };

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.1, ...o });
const glow = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });

// ---------- Instanced batching helper ----------
class Batch {
  constructor(geo, m) { this.geo = geo; this.m = m; this.list = []; }
  add(mtx) { this.list.push(mtx.clone()); }
  build(scene, shadow = false) {
    if (!this.list.length) return;
    const im = new THREE.InstancedMesh(this.geo, this.m, this.list.length);
    this.list.forEach((mt, i) => im.setMatrixAt(i, mt));
    im.castShadow = shadow; im.receiveShadow = true; scene.add(im); return im;
  }
}
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();
const mtx = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => M4.compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz));

// ---------- Box colliders (axis-aligned, with vertical range) ----------
export const boxes = [];
const wallBox = (x0, x1, z0, z1, y0, y1) => boxes.push({ x0, x1, z0, z1, y0, y1 });
export function collideBoxes(pos, pad = 0.32) {
  for (const b of boxes) {
    if (pos.y + 0.15 >= b.y1 || pos.y + 1.7 <= b.y0) continue;
    const x0 = b.x0 - pad, x1 = b.x1 + pad, z0 = b.z0 - pad, z1 = b.z1 + pad;
    if (pos.x <= x0 || pos.x >= x1 || pos.z <= z0 || pos.z >= z1) continue;
    const dl = pos.x - x0, dr = x1 - pos.x, dn = pos.z - z0, df = z1 - pos.z, m = Math.min(dl, dr, dn, df);
    if (m === dl) pos.x = x0; else if (m === dr) pos.x = x1; else if (m === dn) pos.z = z0; else pos.z = z1;
  }
}

// ---------- Apartment layout (world coords, door faces plaza at -z) ----------
export const APT = { x0: -6, x1: 6, z0: 28, z1: 38, GF: 0.1, UF: 3.7, door: [0, 28] }; // preview: spaced further from plaza (+8z)
const ST = { x0: 2.6, x1: 5.7, z0: 29.6, z1: 36.4 }; // stair run, rising toward +z (shifted with APT)
export const inApt = (x, z) => x > APT.x0 && x < APT.x1 && z > APT.z0 && z < APT.z1;
export function aptFloor(x, z, y) {
  if (!inApt(x, z)) return null;
  if (x > ST.x0 && x < ST.x1 && z > ST.z0 - 0.3 && z < ST.z1) {
    const t = THREE.MathUtils.clamp((z - ST.z0) / (ST.z1 - ST.z0), 0, 1); return APT.GF + t * (APT.UF - APT.GF);
  }
  const overHole = x > ST.x0 && z < ST.z1;
  return (y > (APT.GF + APT.UF) / 2 && !overHole) ? APT.UF : APT.GF;
}
// step 6: shop lots on the street block (arcade north, gallery/florist east); kept clear of clutter and flattened
export const LOTS = { arcade: { x0: -7, x1: 7, z0: -29, z1: -20 }, florist: { x0: 22, x1: 28.5, z0: -5.5, z1: 5.5 } }; // preview: spaced from plaza
export const inLot = (x, z, pad = 0) => Object.values(LOTS).some(L => x > L.x0 - pad && x < L.x1 + pad && z > L.z0 - pad && z < L.z1 + pad);
const lotMask = (x, z) => Math.max(...Object.values(LOTS).map(L => { const dx = Math.max(0, L.x0 - 2 - x, x - L.x1 - 2), dz = Math.max(0, L.z0 - 2 - z, z - L.z1 - 2); return 1 - THREE.MathUtils.smoothstep(Math.hypot(dx, dz), 0, 6); }));
export const flattenMask = (x, z) => Math.max(lotMask(x, z), aptMask(x, z));
const aptMask = (x, z) => { // 1 inside apartment lot, used to flatten terrain
  const dx = Math.max(0, Math.abs(x) - 8), dz = Math.max(0, Math.abs(z - 33) - 7);
  return 1 - THREE.MathUtils.smoothstep(Math.hypot(dx, dz), 0, 5);
};

// ---------- TV gallery (HTML overlay) ----------
// Collections are plain data so phase 2 can append read-only wallet results.
// step 6: generic OPT-IN registry (collections.json). No collection is shown by default (neutral world);
// the player picks one in the gallery overlay and the choice is kept in localStorage 'ledgerCollection'.
export const collections = [];
export const holderCollections = []; // holdersOnly: matched by issuer only, never listed/pickable
export const registryReady = fetch('collections.json', { cache: 'no-cache' }).then(r => r.json()).then(d => { collections.push(...d.collections.filter(c => c.optIn && !c.holdersOnly)); holderCollections.push(...d.collections.filter(c => c.optIn && c.holdersOnly)); }).catch(() => {});
let chosenId = null; // in-memory only
// v34d: 'My NFTs' = items from the player's own read-only address lookup (wallet.js sets window.__walletItems).
// Same for every player and every collection (B34N5 included); nothing stored, memory only.
const MINE = '__mine';
const mineItems = () => (window.__walletItems || []).filter(it => it && it.src);
const mineCollection = () => { const it = mineItems(); return it.length ? { id: MINE, name: `My NFTs (${it.length})`, note: 'From your address lookup. Only shown to you. Resets after 1 hour.', items: it } : null; };
export const chosenCollection = () => chosenId === MINE ? mineCollection() : (collections.find(c => c.id === chosenId) || null);
// v34d: 1-hour reset, same for everyone: whatever is shown goes back to the default after an hour (in-memory timer; reload also clears).
export const SHOW_RESET_MS = 3600000;
let resetT = null;
export const activeItems = () => (chosenCollection() || { items: [] }).items;
export function chooseCollection(id) { chosenId = id || null; clearTimeout(resetT); resetT = chosenId ? setTimeout(() => { chooseCollection(null); if (isGalleryOpen()) openGallery(); }, SHOW_RESET_MS) : null; dispatchEvent(new Event('collectionchange')); }
// PHASE 2 STUB (not implemented, by design): a read-only lookup of a public r-address
// (xrpl.js account_nfts, no keys, no signing) would map each NFT to { name, src } and push
// one { name, items } entry per opted-in collection into `collections`. No wallet code yet.
export async function loadWalletCollections(/* address */) { return []; }

let galleryOpen = false;
export const isGalleryOpen = () => galleryOpen && document.getElementById('gallery').classList.contains('on'); // self-heals if state drifts
export function openGallery() {
  const g = document.getElementById('gallery'), body = document.getElementById('gbody');
  body.replaceChildren();
  const pick = document.createElement('div'); pick.className = 'gpick'; pick.append('Show collection: ');
  [{ id: '', name: 'None (neutral)' }, ...[mineCollection()].filter(Boolean), ...collections].forEach(c => { const bt = document.createElement('button'); bt.type = 'button'; bt.textContent = c.name; if ((chosenCollection()?.id || '') === c.id) bt.className = 'on'; bt.addEventListener('click', () => { chooseCollection(c.id); openGallery(); }); pick.append(bt); });
  body.append(pick);
  const c = chosenCollection();
  if (!c) { const p = document.createElement('p'); p.className = 'gnote'; p.textContent = 'No collection chosen. Pick an opt-in collection above to show it on the TV, easels and window canvases.'; body.append(p); }
  for (const c of [chosenCollection()].filter(Boolean)) {
    const sec = document.createElement('section'); const h = document.createElement('h2'); h.textContent = c.name; sec.append(h);
    if (c.note) { const p = document.createElement('p'); p.className = 'gnote'; p.textContent = c.note; sec.append(p); }
    const grid = document.createElement('div'); grid.className = 'ggrid';
    for (const it of c.items) {
      const f = document.createElement('figure'); const im = document.createElement('img'); im.src = it.src; im.alt = it.name;
      const cap = document.createElement('figcaption'); cap.textContent = it.name; f.append(im, cap);
      f.addEventListener('click', () => { const z = document.getElementById('gzoom'); document.getElementById('gzimg').src = it.src; document.getElementById('gzcap').textContent = it.name; z.classList.add('on'); });
      grid.append(f);
    }
    sec.append(grid); body.append(sec);
  }
  g.classList.add('on'); galleryOpen = true;
  if (document.pointerLockElement) document.exitPointerLock();
}
export function closeGallery() {
  document.getElementById('gallery').classList.remove('on'); document.getElementById('gzoom').classList.remove('on'); galleryOpen = false;
}
addEventListener('walletitems', () => { if (chosenId === MINE) { if (!mineCollection()) chooseCollection(null); else dispatchEvent(new Event('collectionchange')); } if (isGalleryOpen()) openGallery(); });
document.getElementById('gclose').addEventListener('click', closeGallery);
document.getElementById('gzoom').addEventListener('click', e => { e.currentTarget.classList.remove('on'); });
addEventListener('keydown', e => { if (e.code === 'Escape' && galleryOpen) { const z = document.getElementById('gzoom'); if (z.classList.contains('on')) z.classList.remove('on'); else closeGallery(); } });

// ---------- Build everything ----------
export function buildWorld3(scene, { blocks, colliders, groundH, canvasTex }) {
  const anim = [];
  // --- de-block apartment blocks: frames, sills, ledges, pipes, awnings, roof clutter ---
  const frameB = new Batch(new THREE.BoxGeometry(1, 1, 1), std(0x1d1820, { roughness: 0.6 }));
  const sillB = new Batch(new RoundedBoxGeometry(1, 1, 1, 2, 0.08), std(0x6a5d58));
  const ledgeB = new Batch(new RoundedBoxGeometry(1, 1, 1, 2, 0.1), std(0x564a4c));
  const pipeB = new Batch(new THREE.CylinderGeometry(0.08, 0.08, 1, 8), std(0x3a3a3e, { metalness: 0.6, roughness: 0.4 }));
  const tankB = new Batch(new THREE.CylinderGeometry(1, 1, 1, 16), std(0x5c524c, { roughness: 0.9 }));
  const awnColors = [0xc0503a, 0x2a8a8a, 0xb08a3a, 0x7a3a8a];
  const awnB = awnColors.map(c => new Batch(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true, 0, Math.PI), std(c, { side: THREE.DoubleSide, roughness: 0.9, emissive: c, emissiveIntensity: 0.15 })));
  const shopB = new Batch(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffb070, toneMapped: false, transparent: true, opacity: 0.9 }));
  for (const bk of blocks) {
    const { g, w, h, d } = bk; g.updateMatrixWorld(true); const W = g.matrixWorld;
    const put = (b, lm) => b.add(new THREE.Matrix4().multiplyMatrices(W, lm));
    for (let fy = 3.6; fy < h - 1.5; fy += 3.5) {
      put(ledgeB, mtx(0, fy - 0.4, d / 2 + 0.05, 0, w + 0.3, 0.22, 0.45));       // floor ledge
      for (let wx = -w / 2 + 1.2; wx < w / 2 - 0.8; wx += 2.0) {               // window frames
        put(frameB, mtx(wx, fy + 1.4, d / 2 + 0.06, 0, 1.1, 0.08, 0.12));
        put(frameB, mtx(wx - 0.55, fy + 0.9, d / 2 + 0.06, 0, 0.08, 1.05, 0.12));
        put(frameB, mtx(wx + 0.55, fy + 0.9, d / 2 + 0.06, 0, 0.08, 1.05, 0.12));
        put(sillB, mtx(wx, fy + 0.33, d / 2 + 0.12, 0, 1.3, 0.1, 0.3));
      }
    }
    put(pipeB, mtx(-w / 2 + 0.35, h / 2, d / 2 + 0.2, 0, 1, h, 1)); put(pipeB, mtx(w / 2 - 0.3, h / 2, d / 2 + 0.2, 0, 1.3, h, 1.3));
    put(ledgeB, mtx(0, h + 0.25, 0, 0, w + 0.2, 0.5, d + 0.2));                 // parapet cap
    if (bk.k % 3 === 0) put(tankB, mtx(w / 4, h + 1.4, 0, 0, 1.1, 2, 1.1));
    else if (bk.k % 3 === 1) put(ledgeB, mtx(-w / 5, h + 1.3, -d / 5, 0, w * 0.4, 2.2, d * 0.5)); // stair hut -> varied roofline
    put(awnB[bk.k % 4], mtx(0, 2.6, d / 2 + 0.2, 0, w * 0.35, w * 0.6, 1.2, 0, Math.PI / 2));
    put(shopB, mtx(0, 1.25, d / 2 + 0.03, 0, w * 0.6, 1.8, 1));                  // warm shopfront glow
  }
  [frameB, sillB, ledgeB, pipeB, tankB, shopB, ...awnB].forEach(b => b.build(scene));

  // --- street clutter, instanced ---
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const potB = new Batch(new THREE.CylinderGeometry(0.32, 0.24, 0.5, 12), std(0xa0583a));
  const leafB = new Batch(new THREE.IcosahedronGeometry(0.5, 1), std(0x3f7a3a, { roughness: 0.9 }));
  const binB = new Batch(new RoundedBoxGeometry(0.7, 1, 0.6, 2, 0.08), std(0x2f5a46));
  const crateB = new Batch(new RoundedBoxGeometry(0.7, 0.7, 0.7, 2, 0.05), std(0x8a6a44, { roughness: 0.95 }));
  const wheelB = new Batch(new THREE.TorusGeometry(0.33, 0.035, 6, 20), std(0x111111));
  const barB = new Batch(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), std(0xd04a3a, { metalness: 0.6 }));
  const lanB = new Batch(new THREE.SphereGeometry(0.28, 12, 10), glow(0xff5a3a));
  const okSpot = (x, z) => Math.hypot(x, z) > 17.5 && !inLot(x, z, 1.5) && !(Math.abs(x) < 8 && z > 26.5 && z < 39) && !colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 0.8);
  for (let i = 0; i < 140; i++) {
    const a = rnd() * Math.PI * 2, r = 18 + rnd() * 12, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!okSpot(x, z)) continue;
    const y = groundH(x, z), ry = rnd() * 6.28, kind = i % 5;
    if (kind === 0) { potB.add(mtx(x, y + 0.25, z)); leafB.add(mtx(x, y + 0.85, z, ry, 1, 1.2, 1)); }
    else if (kind === 1) binB.add(mtx(x, y + 0.5, z, ry));
    else if (kind === 2) { crateB.add(mtx(x, y + 0.35, z, ry)); if (rnd() < 0.5) crateB.add(mtx(x, y + 1.05, z, ry + 0.4, 0.9, 0.9, 0.9)); }
    else if (kind === 3) { // bike: two wheels + frame bars
      const c = Math.cos(ry), s = Math.sin(ry);
      wheelB.add(mtx(x + c * 0.5, y + 0.34, z - s * 0.5, ry)); wheelB.add(mtx(x - c * 0.5, y + 0.34, z + s * 0.5, ry));
      barB.add(mtx(x, y + 0.6, z, ry, 1, 1, 1, 0, Math.PI / 2)); barB.add(mtx(x + c * 0.2, y + 0.5, z - s * 0.2, ry, 1, 0.6, 1, 0, 0.5));
    } else continue;
    if (kind < 3) colliders.push({ x, z, r: 0.35 });
  }
  // lantern strings across the street ring
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + 0.3; for (let j = 0; j < 7; j++) { const r = 19 + j * 1.5, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if ((Math.abs(x) < 7 && z > 17) || inLot(x, z, 1)) continue; lanB.add(mtx(x, groundH(x, z) + 5.2 - Math.sin(j / 6 * Math.PI) * 0.8, z)); } }
  [potB, leafB, wheelB, barB, lanB] /* step 5: boxy bins + crates dropped */.forEach(b => b.build(scene, true));
  // vending machines (few, real meshes with lit fronts)
  const vfront = canvasTex(64, 128, (q, w, h) => { q.fillStyle = '#e8f6ff'; q.fillRect(0, 0, w, h); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { q.fillStyle = ['#ff5a5a', '#5ad0ff', '#ffd25a', '#7aff7a'][(x + y) % 4]; q.fillRect(6 + x * 14, 10 + y * 18, 9, 12); } q.fillStyle = '#222'; q.fillRect(8, 96, 48, 20); });
  [[-9, -16.8], [12, -14], [-14, 11]].forEach(([x, z]) => {
    const a = Math.atan2(x, z), v = new THREE.Group(); v.position.set(x * 1.12, groundH(x, z), z * 1.12); v.rotation.y = a + Math.PI;
    v.add(Object.assign(new THREE.Mesh(new RoundedBoxGeometry(1, 1.9, 0.75, 2, 0.06), std(0xb03040)), { castShadow: true }).translateY(0.95));
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6), new THREE.MeshBasicMaterial({ map: vfront, toneMapped: false })); f.position.set(0, 1.0, 0.38); v.add(f);
    const L = new THREE.PointLight(0xbfe6ff, 4, 5, 2); L.position.set(0, 1.2, 1); v.add(L);
    scene.add(v); colliders.push({ x: v.position.x, z: v.position.z, r: 0.6 });
  });

  // --- Apartment building ---
  const A = APT, H = 7.6, T = 0.3;
  const plaster = pbr('Plaster001', 1.5, { color: 0xd8d3ca }), plaster2 = pbr('Plaster001', 1.5, { color: 0xc4bcb0 }) // step 6: neutral warm white, not pink;
  const ext = pbr('Bricks076C', 3, { color: 0xc8a898 }), wood = std(0x7a5236, { roughness: 0.7 }), floorM = pbr('WoodFloor051', 3, { roughness: 0.8 });
  const box = (m, x0, x1, y0, y1, z0, z1, collide = true, rounded = false) => {
    const geo = rounded ? new RoundedBoxGeometry(x1 - x0, y1 - y0, z1 - z0, 2, Math.min(0.08, (y1 - y0) / 3)) : new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    const o = new THREE.Mesh(geo, m); o.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); o.receiveShadow = true; scene.add(o);
    if (collide) wallBox(x0, x1, z0, z1, y0, y1); return o;
  };
  // exterior shell: front wall with door (x -0.9..0.9, y<2.6) and upstairs window (x -4.4..-1.4, y 4.9..6.7)
  const fz0 = A.z0, fz1 = A.z0 + T;
  box(ext, 0.9, A.x1, 0, H, fz0, fz1); box(ext, -0.9, 0.9, 2.6, H, fz0, fz1);
  box(ext, A.x0, -4.4, 0, H, fz0, fz1); box(ext, -1.4, -0.9, 0, H, fz0, fz1);
  box(ext, -4.4, -1.4, 0, 4.9, fz0, fz1); box(ext, -4.4, -1.4, 6.7, H, fz0, fz1);
  box(ext, A.x0, A.x1, 0, H, A.z1 - T, A.z1); box(ext, A.x0, A.x0 + T, 0, H, A.z0, A.z1); box(ext, A.x1 - T, A.x1, 0, H, A.z0, A.z1);
  box(ext, A.x0 - 0.2, A.x1 + 0.2, H, H + 0.4, A.z0 - 0.2, A.z1 + 0.2, false, true); // roof cap
  box(ext, A.x0 - 0.15, A.x1 + 0.15, 3.55, 3.85, A.z0 - 0.25, A.z0, false, true); // ledge
  // window frame + glass, door frame, awning, sign
  box(wood, -4.5, -1.3, 4.8, 4.95, fz0 - 0.15, fz1 + 0.1, false); box(wood, -4.5, -1.3, 6.65, 6.8, fz0 - 0.1, fz1, false);
  box(wood, -2.95, -2.85, 4.9, 6.7, fz0 + 0.1, fz0 + 0.2, false);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.8), new THREE.MeshBasicMaterial({ color: 0xffc890, transparent: true, opacity: 0.18, toneMapped: false, side: THREE.DoubleSide }));
  glass.position.set(-2.9, 5.8, fz0 + 0.15); scene.add(glass);
  box(wood, -1.05, -0.9, 0, 2.75, fz0 - 0.1, fz1 + 0.1, false); box(wood, 0.9, 1.05, 0, 2.75, fz0 - 0.1, fz1 + 0.1, false); box(wood, -1.05, 1.05, 2.6, 2.75, fz0 - 0.1, fz1 + 0.1, false);
  const door = box(wood, -0.9, -0.85, 0, 2.6, fz0 - 0.9, fz0 - 0.05, false); door.rotation.y = 0; // open door swung outward-left
  const awn = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.8, 16, 1, true, 0, Math.PI), std(0x2a8a8a, { side: THREE.DoubleSide, emissive: 0x2a8a8a, emissiveIntensity: 0.2 }));
  awn.rotation.z = Math.PI / 2; awn.scale.set(1, 1, 0.5); awn.position.set(0, 3.0, fz0); scene.add(awn);
  const homeTex = canvasTex(256, 96, (q, w, h) => { q.fillStyle = 'rgba(10,0,20,0.85)'; q.beginPath(); q.roundRect(4, 4, w - 8, h - 8, 24); q.fill(); q.strokeStyle = '#ffb35c'; q.lineWidth = 5; q.stroke(); q.fillStyle = '#ffd09a'; q.font = '700 30px system-ui'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('ESCROW PALACE', w / 2, h / 2 + 3); });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshBasicMaterial({ map: homeTex, transparent: true, toneMapped: false })); sign.position.set(2.6, 3.0, fz0 - 0.05); sign.rotation.y = Math.PI; scene.add(sign);
  const porch = new THREE.PointLight(0xffa860, 14, 9, 1.6); porch.position.set(0, 3.2, fz0 - 1.2); scene.add(porch);

  // interior: floors, ceiling, stair, rails
  box(floorM, A.x0, A.x1, -0.2, A.GF, A.z0, A.z1, false);
  // upper slab with stair hole (x>ST.x0 & z<ST.z1 open)
  box(floorM, A.x0 + T, ST.x0, A.UF - 0.25, A.UF, A.z0 + T, A.z1 - T, false);
  box(floorM, ST.x0, A.x1 - T, A.UF - 0.25, A.UF, ST.z1, A.z1 - T, false);
  box(plaster, A.x0 + T, A.x1 - T, H - 0.2, H - 0.05, A.z0 + T, A.z1 - T, false); // ceiling
  // ground-floor ceiling paint underside
  const under = box(plaster2, A.x0 + T, ST.x0, A.UF - 0.3, A.UF - 0.25, A.z0 + T, A.z1 - T, false); under.material = plaster2;
  // interior wall plaster skins (visual only, inner faces warm)
  box(plaster, A.x0 + T, A.x0 + T + 0.02, A.GF, H, A.z0 + T, A.z1 - T, false); box(plaster2, A.x1 - T - 0.02, A.x1 - T, A.GF, H, A.z0 + T, A.z1 - T, false);
  box(plaster, A.x0 + T, A.x1 - T, A.GF, H, A.z1 - T - 0.02, A.z1 - T, false);
  // stairs: visual steps + rail wall along x=ST.x0 (doubles as upstairs guard)
  const steps = 14;
  for (let i = 0; i < steps; i++) { const z0 = ST.z0 + (ST.z1 - ST.z0) * i / steps, z1 = ST.z0 + (ST.z1 - ST.z0) * (i + 1) / steps, y = A.GF + (A.UF - A.GF) * (i + 1) / steps;
    box(wood, ST.x0, ST.x1, A.GF, y, z0, z1, false, true); }
  box(plaster2, ST.x0 - 0.15, ST.x0, A.GF, A.UF + 1.0, ST.z0 + 0.9, ST.z1);          // stair side wall / upstairs guard
  box(wood, ST.x0 - 0.2, ST.x0 + 0.05, A.UF + 0.95, A.UF + 1.05, ST.z0 + 0.9, ST.z1, false); // handrail cap
  box(wood, ST.x0, A.x1 - T, A.UF, A.UF + 1.0, ST.z0 - 0.4, ST.z0 - 0.3);               // guard at top of hole front
  // stairwell lights (warm, no shadows)
  [[4.2, 2.9, 30.5], [4.2, 6.6, 36.9]].forEach(([x, y, z]) => { const L = new THREE.PointLight(0xffb070, 5, 8, 1.6); L.position.set(x, y, z); scene.add(L);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), glow(0xffd0a0)); b.position.copy(L.position); scene.add(b); });

  // cosy room upstairs: x -5.7..2.45, z 20.3..29.7
  const U = A.UF, rugTex = canvasTex(128, 128, (q, w, h) => { q.fillStyle = '#7a2e3a'; q.fillRect(0, 0, w, h); q.strokeStyle = '#e0a060'; q.lineWidth = 6; q.strokeRect(10, 10, w - 20, h - 20); q.strokeRect(26, 26, w - 52, h - 52); });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.4), std(0xffffff, { map: rugTex })); rug.rotation.x = -Math.PI / 2; rug.position.set(-1.8, U + 0.01, 33.6); rug.visible = false; scene.add(rug);
  // step 5: procedural furniture is hidden (colliders kept); Kenney Furniture Kit models are placed in world4.js
  const HB = (...a) => { const o = box(...a); o.visible = false; return o; };
  // bed
  HB(wood, -5.6, -3.5, U, U + 0.45, 34.6, 37.6, true, true); HB(std(0xe8e0d0), -5.55, -3.55, U + 0.45, U + 0.7, 34.7, 37.5, false, true);
  HB(std(0x3a6a8a), -5.55, -3.55, U + 0.7, U + 0.78, 34.7, 36.4, false, true); HB(std(0xf4ece0), -5.3, -3.8, U + 0.7, U + 0.9, 36.8, 37.4, false, true);
  // couch facing TV
  const couchM = std(0x5a4a7a, { roughness: 0.95 });
  HB(couchM, -2.9, -0.5, U, U + 0.5, 31.6, 32.5, true, true); HB(couchM, -2.9, -0.5, U + 0.5, U + 1.1, 31.5, 31.85, false, true);
  HB(couchM, -3.1, -2.85, U, U + 0.8, 31.5, 32.5, false, true); HB(couchM, -0.55, -0.3, U, U + 0.8, 31.5, 32.5, false, true);
  // desk + chair + monitor glow
  HB(wood, -5.6, -4.6, U, U + 0.78, 29.0, 30.8, true, true);
  const mon = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.42), glow(0x5ad8ff)); mon.position.set(-5.4, U + 1.1, 29.9); mon.rotation.y = Math.PI / 2; scene.add(mon);
  // TV on back wall above low cabinet
  HB(wood, -2.6, -0.8, U, U + 0.5, 37.2, 37.68, true, true);
  box(std(0x111114, { roughness: 0.3, metalness: 0.5 }), -2.75, -0.65, U + 0.9, U + 2.1, 37.55, 37.68, false, true);
  const tvTex = canvasTex(512, 288, (q, w, h) => { q.fillStyle = '#05070c'; q.fillRect(0, 0, w, h); });
  const tvMat = new THREE.MeshBasicMaterial({ map: tvTex, toneMapped: false });
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 1.1), tvMat); tvScreen.position.set(-1.7, U + 1.5, 37.54); tvScreen.rotation.y = Math.PI; scene.add(tvScreen);
  const tvLight = new THREE.PointLight(0x6ab0ff, 0, 5, 2); tvLight.position.set(-1.7, U + 1.5, 36.6); scene.add(tvLight);
  // lamp (warm bounce)
  HB(wood, -3.4, -3.0, U, U + 0.55, 33.9, 34.3, true, true);
  const shadeM = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.32, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false, side: THREE.DoubleSide }));
  shadeM.position.set(-3.2, U + 0.95, 34.1); shadeM.visible = false; scene.add(shadeM);
  const lamp = new THREE.PointLight(0xffc88a, 3.5, 9, 1.6); lamp.position.set(-3.2, U + 1.0, 34.1); lamp.castShadow = false; scene.add(lamp);
  const fill = new THREE.PointLight(0xfff2e2, 2.2, 9, 1.6); fill.position.set(-1.5, U + 3.2, 33.0); scene.add(fill); // ceiling bounce
  // neon spill through window: magenta/cyan light outside + glowing floor patch
  const neonL = new THREE.PointLight(0xff3df0, 0.2, 3, 2); neonL.position.set(-2.9, U + 2.2, 28.9); scene.add(neonL);
  const spillTex = canvasTex(64, 64, (q) => { const r = q.createLinearGradient(0, 0, 0, 64); r.addColorStop(0, 'rgba(255,80,240,0.7)'); r.addColorStop(1, 'rgba(60,220,255,0)'); q.fillStyle = r; q.fillRect(8, 0, 48, 64); q.fillStyle = 'rgba(0,0,0,1)'; q.fillRect(30, 0, 4, 64); });
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.6), new THREE.MeshBasicMaterial({ map: spillTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.35 }));
  spill.rotation.x = -Math.PI / 2; spill.position.set(-2.9, U + 0.02, 29.7); scene.add(spill);
  const outsideNeon = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 2.4), glow(0xff3df0)); outsideNeon.position.set(-4.8, 5.6, fz0 - 0.4); scene.add(outsideNeon);
  // plant + shelf
  HB(std(0xa0583a), 1.6, 2.2, U, U + 0.5, 37.0, 37.6, true, true);
  const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), std(0x3f7a3a)); pl.position.set(1.9, U + 0.95, 37.3); pl.visible = false; scene.add(pl);
  HB(wood, -5.68, -5.4, U + 1.6, U + 1.68, 32.0, 33.8, false);

  // TV channel logic: E near TV powers it on and opens gallery overlay.
  const tvPos = new THREE.Vector3(-1.7, U, 36.9);
  // screen is one canvas: channel image + channel number + scanlines
  let imgs = [];
  const loadImgs = () => { imgs = activeItems().map(it => { const im = new Image(); im.src = it.src; im.addEventListener('load', () => { if (tvOn) drawTV(); }); return im; }); ch = 0; if (tvOn) drawTV(); };
  registryReady.then(loadImgs); addEventListener('collectionchange', loadImgs);
  let tvOn = false, ch = 0, chT = 0;
  const tvCv = tvTex.image, tq = tvCv.getContext('2d');
  function drawTV() {
    tq.fillStyle = '#05070c'; tq.fillRect(0, 0, 512, 288);
    const im = imgs[ch]; if (im && im.complete && im.naturalWidth) tq.drawImage(im, 0, 0, 512, 288);
    else { tq.fillStyle = '#9ab'; tq.font = '600 26px system-ui'; tq.textAlign = 'center'; tq.fillText('No collection chosen', 256, 140); tq.font = '18px system-ui'; tq.fillText('Pick one in the Collections gallery', 256, 175); tq.textAlign = 'left'; }
    tq.fillStyle = 'rgba(0,0,0,0.28)'; for (let y = 0; y < 288; y += 3) tq.fillRect(0, y, 512, 1);
    tq.font = '700 30px monospace'; tq.fillStyle = '#7fff9a'; tq.fillText('CH ' + String(ch + 1).padStart(2, '0'), 18, 40);
    tvTex.needsUpdate = true;
  }
  function setChannel(i) { ch = imgs.length ? i % imgs.length : 0; drawTV(); }
  const scanM = { visible: false };
  function tvUse(pos) {
    if (pos.distanceTo(tvPos) > 2.6) return false;
    tvOn = true; scanM.visible = true; tvLight.intensity = 5; setChannel(ch); onTV(); return true;
  }
  if (new URLSearchParams(location.search).get('tv')) { tvOn = true; scanM.visible = true; tvLight.intensity = 5; setChannel(0); }
  anim.push((t, dt) => {
    outsideNeon.material.color.setHex(Math.sin(t * 2) > -0.8 ? 0xff3df0 : 0x551040);
    if (tvOn) { chT += dt; if (chT > 6) { chT = 0; setChannel(ch + 1); } }
  });
  return { update: (t, dt) => anim.forEach(f => f(t, dt)), tvUse, tvPos };
}
