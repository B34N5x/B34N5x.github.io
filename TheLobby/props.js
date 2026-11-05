// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// Step 3b: in-world objects replace portals - arcade cabinets, art frames (gallery), Ledger News overlay.
// Original procedural code (MIT).
import * as THREE from './lib/three.module.js';
import { RoundedBoxGeometry } from './lib/addons/geometries/RoundedBoxGeometry.js';
import { activeItems, registryReady, openGallery } from './world3.js';
import { load as arcadeLoad, isUnlocked, nextLocked, spendUnlock, top } from './arcade.js';

export const interactables = []; // { x, z, y, r, hint, use }
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.3, ...o });

function screenTex(canvasTex, title, sub, col) {
  return canvasTex(256, 192, (q, w, h) => {
    q.fillStyle = '#05030f'; q.fillRect(0, 0, w, h); q.strokeStyle = col; q.lineWidth = 4; q.strokeRect(8, 8, w - 16, h - 16);
    q.fillStyle = col; q.font = '700 30px monospace'; q.textAlign = 'center'; q.fillText(title, w / 2, 80);
    q.fillStyle = '#ffffff'; q.font = '18px monospace'; q.fillText(sub, w / 2, 120);
    q.fillStyle = 'rgba(255,255,255,0.07)'; for (let y = 0; y < h; y += 4) q.fillRect(0, y, w, 2);
  });
}

export function buildProps(scene, { canvasTex, colliders, FLOOR, warpTo }) {
  // ---- Arcade row (plaza north side), first cabinet live ----
  const games = [['VAULT RUN', 'PRESS E', '#ff3d8a', 'shooter/index.html'], ['ESCROW CLASH', 'PRESS E', '#ff9a1f', 'fighter/index.html'], ['RUNNERS', 'COMING SOON', '#22ffa0'], ['PUZZLES', 'COMING SOON', '#3f9bff']];
  games.forEach(([title, sub, col, live], i) => {
    const x = -5.5 + i * 2.2, z = -27.6, g = new THREE.Group(); g.position.set(x, FLOOR, z); // step 6: inside LEDGER ARCADE
    const body = new THREE.Mesh(new RoundedBoxGeometry(1.2, 2.1, 1.0, 3, 0.1), std(0x1a1630)); body.position.y = 1.05; body.castShadow = true; g.add(body);
    const side = new THREE.Mesh(new RoundedBoxGeometry(1.26, 0.08, 1.06, 2, 0.03), new THREE.MeshBasicMaterial({ color: col, toneMapped: false })); side.position.y = 2.12; g.add(side);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.7), new THREE.MeshBasicMaterial({ map: screenTex(canvasTex, title, sub, col), toneMapped: false }));
    scr.position.set(0, 1.5, 0.51); scr.rotation.x = -0.15; g.add(scr);
    const panel = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.12, 0.45, 2, 0.04), std(0x2a2448)); panel.position.set(0, 1.0, 0.6); panel.rotation.x = 0.25; g.add(panel);
    [[-0.25, 0xff3d3d], [0.1, 0x22f0ff], [0.3, 0xffd23d]].forEach(([bx, bc]) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: bc, toneMapped: false })); b.position.set(bx, 1.08, 0.62); g.add(b); });
    const marq = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.3), new THREE.MeshBasicMaterial({ color: col, toneMapped: false, transparent: true, opacity: live ? 1 : 0.45 })); marq.position.set(0, 2.25, 0.4); g.add(marq);
    if (live) { const mt = canvasTex(512, 128, (q, w, h) => { q.fillStyle = '#0a0418'; q.fillRect(0, 0, w, h); q.strokeStyle = col; q.lineWidth = 6; q.strokeRect(4, 4, w - 8, h - 8); q.shadowColor = col; q.shadowBlur = 16; q.fillStyle = '#fff'; q.font = '900 54px system-ui'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(title, w / 2, h / 2 + 2); for (let i = 0; i < 6; i++) { q.fillStyle = i % 2 ? col : '#22f0ff'; q.fillRect(14 + i * 6, 20, 3, h - 40); q.fillRect(w - 32 + i * 3, 20, 2, h - 40); } }); const mq = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.28), new THREE.MeshBasicMaterial({ map: mt, toneMapped: false })); mq.position.set(0, 2.25, 0.41); g.add(mq); }
    const L = new THREE.PointLight(new THREE.Color(col), live ? 4 : 1.5, 4, 2); L.position.set(0, 1.6, 1.2); g.add(L);
    scene.add(g); colliders.push({ x, z, r: 0.75 });
    const mk = title === 'VAULT RUN' ? 'run' : title === 'ESCROW CLASH' ? 'clash' : null;
    const it = { x, z: z + 1.1, r: 1.4, use: live ? () => warpTo(live) : null };
    Object.defineProperty(it, 'hint', { get: () => { if (!live) return `${title}: coming soon`; const t1 = top(mk); return `E: play ${title} · #1 ${t1.n} ${t1.s} · beat it for a token`; } });
    interactables.push(it);
  });

  // ---- step 5: LOCKED cabinets. Progress lives in localStorage, written by the games themselves:
  // 'ledgerRunBest' (shooter high score) and 'ledgerClashWins' (fighter matches won). Unlocked = 'COMING SOON' for now.
  // step 6b: LOCKED cabinets use the token system in arcade.js (2 tokens unlock the next one, in order).
  const LOCKS = ['VAULT', 'NODE RUSH'];
  LOCKS.forEach((title, i) => {
    const x = -5.5 + (4 + i) * 2.2, z = -27.6, g = new THREE.Group(); g.position.set(x, FLOOR, z);
    const L = { title };
    const body = new THREE.Mesh(new RoundedBoxGeometry(1.2, 2.1, 1.0, 3, 0.1), std(0x1a1630)); body.position.y = 1.05; body.castShadow = true; g.add(body);
    const marqMat = new THREE.MeshBasicMaterial({ color: 0xff2a3a, toneMapped: false }); const marq = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.3), marqMat); marq.position.set(0, 2.25, 0.41); g.add(marq);
    const scrTex = (txt, col) => canvasTex(256, 192, (q, w, h) => { q.fillStyle = '#05030c'; q.fillRect(0, 0, w, h); q.fillStyle = col; q.font = '800 30px system-ui'; q.textAlign = 'center'; q.fillText(L.title, w / 2, 60); q.font = '600 20px system-ui'; q.fillText(txt, w / 2, 100); q.fillStyle = '#ccc'; q.font = '14px system-ui'; ['Beat a #1 score: +1 token', '2 tokens unlock me', 'Board resets after 2 tokens'].forEach((l, k) => q.fillText(l, w / 2, 130 + k * 18)); });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.7), new THREE.MeshBasicMaterial({ map: scrTex('LOCKED', '#ff5a6a'), toneMapped: false })); scr.position.set(0, 1.5, 0.51); scr.rotation.x = -0.15; g.add(scr);
    const lock = new THREE.Group(), hm = new THREE.MeshBasicMaterial({ color: 0xff4a5a, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const lb = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.12, 4, 12), hm); lb.rotation.z = Math.PI / 2; lock.add(lb);
    const sh = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 20, Math.PI), hm); sh.position.y = 0.16; lock.add(sh);
    lock.position.set(0, 2.75, 0.3); g.add(lock);
    const unlocked = () => { scr.material.map = scrTex('UNLOCKED · COMING SOON', '#7ff8ff'); marqMat.color.set(0x22f0ff); lock.visible = false; };
    if (isUnlocked(title)) unlocked();
    let spin = 0; (function tick() { spin += 0.02; lock.rotation.y = spin; lock.position.y = 2.75 + Math.sin(spin * 2) * 0.05; requestAnimationFrame(tick); })();
    const playUnlock = () => { let k = 0; hm.color.set(0x7ff8ff); const a = () => { k++; lock.scale.setScalar(1 + k * 0.06); hm.opacity = Math.max(0, 0.9 - k / 40); marqMat.color.set(k % 6 < 3 ? 0xffffff : 0x22f0ff); if (k < 45) requestAnimationFrame(a); else unlocked(); }; a(); };
    scene.add(g); colliders.push({ x, z, r: 0.75 });
    const it = { x, z: z + 1.1, r: 1.4, use: () => { if (spendUnlock(title)) playUnlock(); } };
    Object.defineProperty(it, 'hint', { get: () => { if (isUnlocked(title)) return `${title}: unlocked, coming soon`; const tk = arcadeLoad().tokens; if (nextLocked() !== title) return `LOCKED ${title}: unlock ${nextLocked()} first`; return tk >= 2 ? `E: spend 2 tokens to unlock ${title}` : `LOCKED ${title}: needs 2 tokens (you have ${tk}). Beat a #1 score to earn one`; } });
    interactables.push(it);
  });

  // ---- Art frames on easels (plaza east): E opens the collections gallery ----
  const loader = new THREE.TextureLoader(), artMeshes = [];
  // neutral canvas until a player chooses a collection
  const blank = canvasTex(512, 288, (q, w, h) => { q.fillStyle = '#a9a294'; q.fillRect(0, 0, w, h); q.fillStyle = 'rgba(0,0,0,0.04)'; for (let i = 0; i < 4000; i++) q.fillRect(Math.random() * w, Math.random() * h, 2, 2); q.fillStyle = '#8a8070'; q.font = 'italic 26px Georgia'; q.textAlign = 'center'; q.fillText('Your collection here', w / 2, h / 2); q.font = '18px system-ui'; q.fillText('Press E to choose one', w / 2, h / 2 + 32); });
  const refreshArt = () => { const items = activeItems(); artMeshes.forEach((m, i) => { const it = items[i % Math.max(1, items.length)]; if (!it) { m.material.map = blank; m.material.needsUpdate = true; return; } loader.load(it.src, t => { t.colorSpace = THREE.SRGBColorSpace; m.material.map = t; m.material.needsUpdate = true; }); }); };
  registryReady.then(refreshArt); addEventListener('collectionchange', refreshArt);
  // step 6: one easel on the pavement outside PETAL & PIXEL, two canvases displayed in its shop window
  [[19.9, -3.2], [22.8, -3.9], [22.8, 3.9]].forEach(([x, z], i) => {
    const g = new THREE.Group(); g.position.set(x, FLOOR, z); g.lookAt(x - 1, FLOOR, z + (i ? 0 : 0.3));
    const frame = new THREE.Mesh(new RoundedBoxGeometry(2.5, 1.55, 0.12, 2, 0.04), std(0x7a5236, { roughness: 0.6 })); frame.position.y = 1.9; frame.castShadow = true; g.add(frame);
        const art = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.3), new THREE.MeshBasicMaterial({ map: blank, toneMapped: false })); art.position.set(0, 1.9, 0.07); g.add(art); artMeshes.push(art);
    for (const s of [-0.9, 0.9]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 6), std(0x4a3426)); leg.position.set(s, 1.1, -0.15); leg.rotation.x = 0.12; g.add(leg); }
    const spot = new THREE.PointLight(0xffd8a8, 3, 4, 2); spot.position.set(0, 3.2, 1.0); g.add(spot);
    scene.add(g); colliders.push({ x, z, r: 0.6 });
    const n = g.getWorldDirection(new THREE.Vector3());
    interactables.push({ x: x + n.x * (i ? 1.6 : 1.2), z: z + n.z * (i ? 1.6 : 1.2), r: 1.5, hint: 'E: open Collections gallery', use: openGallery });
  });
}

// ---- Ledger News overlay (TV). Reads local news.json built by tools/fetch_news.py ----
const FALLBACK = { generated: 'offline', items: [
  { title: 'rippled releases', date: '', url: 'https://github.com/XRPLF/rippled/releases', source: 'XRPL rippled releases (GitHub)' },
  { title: 'xrpl.js releases', date: '', url: 'https://github.com/XRPLF/xrpl.js/releases', source: 'xrpl.js releases (GitHub)' },
  { title: 'xrpl-py releases', date: '', url: 'https://github.com/XRPLF/xrpl-py/releases', source: 'xrpl-py releases (GitHub)' },
] };
let newsOpen = false;
export const isNewsOpen = () => newsOpen;
export async function openNews() {
  let data = FALLBACK;
  try { const r = await fetch('news.json', { cache: 'no-cache' }); if (r.ok) data = await r.json(); } catch (e) { /* offline fallback */ }
  const list = document.getElementById('nlist'); list.replaceChildren();
  for (const it of data.items) {
    const li = document.createElement('li'); const a = document.createElement('a'); if (/^https:\/\//i.test(it.url || '')) a.href = it.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = it.title;
    const meta = document.createElement('span'); meta.className = 'nmeta'; meta.textContent = `${it.date ? it.date + ' · ' : ''}${it.source}`;
    li.append(a, meta); list.append(li);
  }
  document.getElementById('ngen').textContent = data.generated === 'offline' ? 'Offline - showing source links only.' : `Headlines fetched ${data.generated}. Links open the original source.`;
  document.getElementById('news').classList.add('on'); newsOpen = true;
  if (document.pointerLockElement) document.exitPointerLock();
}
export function closeNews() { document.getElementById('news').classList.remove('on'); newsOpen = false; }
document.getElementById('nclose').addEventListener('click', closeNews);
addEventListener('keydown', e => { if (e.code === 'Escape' && newsOpen) closeNews(); });
