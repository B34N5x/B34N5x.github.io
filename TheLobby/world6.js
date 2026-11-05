// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// Step 6: one street block done properly - LEDGER ARCADE shop, PETAL & PIXEL gallery/florist, ESCROW PALACE entrance,
// and life details (wires, puddles, steam, benches, lamps, cat, birds, ambient sound). Original code (MIT);
// models: Kenney Nature Kit, City Kit Roads, Furniture Kit (CC0) - see CREDITS.md.
import * as THREE from './lib/three.module.js';
import { boxes, LOTS, APT } from './world3.js';
import { place, pbr } from './world4.js';

const ctex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.1, ...o });
const glow = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
const NA = 'assets/kenney/nature/', RD = 'assets/kenney/city-roads/', FU = 'assets/kenney/furniture/', CC = 'assets/kenney/city-commercial/';

export function buildWorld6(scene, { colliders, FLOOR }) {
  const anim = [];
  const box = (m, x0, x1, y0, y1, z0, z1, collide = true) => { const o = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m); o.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); o.receiveShadow = true; scene.add(o); if (collide) boxes.push({ x0, x1, z0, z1, y0, y1 }); return o; };
  const plane = (mat, w, h, x, y, z, ry = 0, rx = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); scene.add(m); return m; };
  const glassM = new THREE.MeshStandardMaterial({ color: 0xa8d0e0, transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0.9, envMapIntensity: 2, depthWrite: false, side: THREE.DoubleSide });
  const frameM = std(0x1c1c22, { metalness: 0.7, roughness: 0.35 });
  const neonSign = (txt, col, w, h, font) => new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, map: ctex(1024, Math.round(1024 * h / w), (q, W, H) => { q.fillStyle = 'rgba(8,4,16,0.9)'; q.beginPath(); q.roundRect(6, 6, W - 12, H - 12, 24); q.fill(); q.strokeStyle = col; q.lineWidth = 8; q.shadowColor = col; q.shadowBlur = 30; q.stroke(); q.fillStyle = '#fff'; q.font = font; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(txt, W / 2, H / 2 + 4); q.shadowBlur = 0; q.fillStyle = col; q.globalAlpha = 0.35; q.fillText(txt, W / 2, H / 2 + 4); }) });

  // ================= 1) LEDGER ARCADE (x -7..7, z -21..-12, door faces plaza +z) =================
  { const L = LOTS.arcade, H = 4.4, T = 0.3, y0 = 0, F = FLOOR;
    const brick = pbr('Bricks076C', 3, { color: 0x6a5a66 }), inner = pbr('Plaster001', 2, { color: 0x2a2440 });
    box(brick, L.x0, L.x1, y0, H, L.z0, L.z0 + T); box(brick, L.x0, L.x0 + T, y0, H, L.z0, L.z1); box(brick, L.x1 - T, L.x1, y0, H, L.z0, L.z1);
    box(inner, L.x0 + T, L.x1 - T, F, H, L.z0 + T, L.z0 + T + 0.02, false); box(inner, L.x0 + T, L.x0 + T + 0.02, F, H, L.z0, L.z1, false); box(inner, L.x1 - T - 0.02, L.x1 - T, F, H, L.z0, L.z1, false);
    box(brick, L.x0 - 0.1, L.x1 + 0.1, H, H + 0.35, L.z0 - 0.1, L.z1 + 0.1, false); // roof slab
    box(std(0x15121f, { roughness: 0.9 }), L.x0 + T, L.x1 - T, H - 0.05, H, L.z0, L.z1, false); // ceiling
    // carpet: dark navy with neon confetti (classic arcade carpet), original canvas pattern
    const carpet = ctex(512, 512, (q, w, h) => { q.fillStyle = '#141032'; q.fillRect(0, 0, w, h); const cols = ['#22f0ff', '#ff3df0', '#ffd23d', '#7aff7a'];
      for (let i = 0; i < 900; i++) { q.fillStyle = cols[i % 4]; q.globalAlpha = 0.55; const x = Math.random() * w, y = Math.random() * h, r = Math.random() * 3 + 1.2; i % 3 ? (q.beginPath(), q.arc(x, y, r, 0, 7), q.fill()) : (q.save(), q.translate(x, y), q.rotate(Math.random() * 6), q.fillRect(-r * 1.5, -1.5, r * 3, 3), q.restore()); }
      q.globalAlpha = 0.18; q.fillStyle = '#000'; for (let i = 0; i < 3000; i++) q.fillRect(Math.random() * w, Math.random() * h, 2, 2); });
    carpet.wrapS = carpet.wrapT = THREE.RepeatWrapping; carpet.repeat.set(4, 2.6);
    plane(new THREE.MeshStandardMaterial({ map: carpet, roughness: 1 }), L.x1 - L.x0 - 2 * T, L.z1 - L.z0 - T, 0, F + 0.012, (L.z0 + L.z1) / 2 + T / 2, 0, -Math.PI / 2);
    // glass shopfront: low kerb, mullions, door gap x -1..1, transom above
    const fz = L.z1;
    box(frameM, L.x0, L.x1, y0, F + 0.35, fz - 0.15, fz, false); boxes.push({ x0: L.x0, x1: -1, z0: fz - 0.15, z1: fz, y0: 0, y1: H }); boxes.push({ x0: 1, x1: L.x1, z0: fz - 0.15, z1: fz, y0: 0, y1: H });
    plane(glassM, 5.7, H - 0.4, -4, (F + 0.35 + H) / 2, fz - 0.07); plane(glassM, 5.7, H - 0.4, 4, (F + 0.35 + H) / 2, fz - 0.07); plane(glassM, 2, H - 2.9, 0, (2.9 + H) / 2, fz - 0.07);
    [-6.85, -4, -1.05, 1.05, 4, 6.85].forEach(x => box(frameM, x - 0.06, x + 0.06, 0, H, fz - 0.18, fz + 0.02, false));
    box(frameM, L.x0, L.x1, H - 0.12, H + 0.02, fz - 0.18, fz + 0.02, false); box(frameM, -1.05, 1.05, 2.82, 2.92, fz - 0.18, fz + 0.02, false);
    // fascia + neon LEDGER ARCADE
    box(std(0x0e0b18, { roughness: 0.4, metalness: 0.5 }), L.x0 - 0.2, L.x1 + 0.2, H + 0.35, H + 1.6, fz - 0.3, fz + 0.15, false);
    const sm = neonSign('LEDGER ARCADE', '#ff3df0', 8, 1.1, '900 118px system-ui'); plane(sm, 8, 1.1, 0, H + 0.97, fz + 0.17);
    const signL = new THREE.PointLight(0xff3df0, 6, 7, 2); signL.position.set(0, H + 0.9, fz + 1.2); scene.add(signL);
    anim.push(t => { const f = Math.sin(t * 23) > 0.97 ? 0.55 : 1; sm.opacity = f; signL.intensity = 6 * f; });
    // ceiling light panels + interior light (cool white + magenta wash)
    const panelM = glow(0xe8f0ff);
    for (const x of [-4.5, 0, 4.5]) for (const z of [-27, -23.5]) { plane(panelM, 1.4, 0.5, x, H - 0.07, z, 0, Math.PI / 2); }
    [[-3.5, -25], [3.5, -25]].forEach(([x, z]) => { const p = new THREE.PointLight(0xdfe8ff, 7, 12, 1.6); p.position.set(x, H - 0.4, z); scene.add(p); });
    const wash = new THREE.PointLight(0xff4ad8, 3, 10, 1.8); wash.position.set(0, 2.2, -22); scene.add(wash);
    // prize counter (Kenney kitchenBar) along the right side + shelf of prizes behind it
    for (let i = 0; i < 3; i++) place(scene, `${FU}kitchenBar${i === 2 ? 'End' : ''}.glb`, { x: 5.0, y: F, z: -21.9 - i * 1.0, ry: -Math.PI / 2, fitW: 1.0, tint: new THREE.Color(0.55, 0.45, 0.75) });
    boxes.push({ x0: 4.5, x1: 5.5, z0: -24.6, z1: -21.4, y0: 0, y1: 1.2 });
    box(std(0x3a2a20, { roughness: 0.8 }), 6.3, 6.68, F, F + 2.4, -24.6, -21.4, false);
    const pc = [0xff5a8a, 0x5ad0ff, 0xffd25a, 0x7aff7a, 0xc08aff];
    for (let s = 0; s < 3; s++) { const y = F + 0.6 + s * 0.7; box(std(0x5a4030), 6.0, 6.68, y - 0.04, y, -24.6, -21.4, false);
      for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(k % 2 ? new THREE.SphereGeometry(0.15, 14, 10) : new THREE.CapsuleGeometry(0.1, 0.16, 6, 12), std(pc[(k + s) % 5], { roughness: 0.85 })); m.position.set(6.3, y + 0.17, -24.3 + k * 0.52); scene.add(m); } }
    const prizes = ctex(512, 160, (q, w, h) => { q.fillStyle = '#0a0618'; q.fillRect(0, 0, w, h); q.fillStyle = '#ffd23d'; q.font = '900 64px system-ui'; q.textAlign = 'center'; q.fillText('PRIZES', w / 2, 66); q.fillStyle = '#fff'; q.font = '600 26px system-ui'; q.fillText('Beat a #1 score = 1 token', w / 2, 108); q.fillText('2 tokens unlock a machine', w / 2, 142); });
    plane(glow(0xffffff), 2.4, 0.75, 6.66, F + 3.0, -23, -Math.PI / 2).material.map = prizes;
    const pL = new THREE.PointLight(0xffd8a0, 3, 5, 2); pL.position.set(5.5, 3, -23); scene.add(pL);
    place(scene, `${FU}speaker.glb`, { x: -6.3, y: F, z: -21, ry: Math.PI / 2, scale: 2.2 });
    place(scene, `${FU}trashcan.glb`, { x: -6.4, y: F, z: -22.2, scale: 2 });
  }

  // ================= 2) PETAL & PIXEL gallery/florist (x 14..20.5, z -5.5..5.5, front faces -x) =================
  { const L = LOTS.florist, H = 4.0, T = 0.3, F = FLOOR, fx = L.x0;
    const brick = pbr('Bricks076C', 3, { color: 0xb89a88 }), inner = pbr('Plaster001', 2, { color: 0xe8e0d4 });
    box(brick, L.x1 - T, L.x1, 0, H, L.z0, L.z1); box(brick, fx, L.x1, 0, H, L.z0, L.z0 + T); box(brick, fx, L.x1, 0, H, L.z1 - T, L.z1);
    box(inner, L.x1 - T - 0.02, L.x1 - T, F, H, L.z0, L.z1, false); box(pbr('WoodFloor051', 2), fx, L.x1, 0, F + 0.01, L.z0, L.z1, false);
    box(brick, fx - 0.1, L.x1 + 0.1, H, H + 1.4, L.z0 - 0.1, L.z1 + 0.1, false);
    // full glass front (closed door, shop seen through the window)
    boxes.push({ x0: fx, x1: fx + 0.15, z0: L.z0, z1: L.z1, y0: 0, y1: H });
    box(std(0x2e4a3a, { roughness: 0.5 }), fx, fx + 0.15, 0, F + 0.5, L.z0, L.z1, false);
    plane(glassM, L.z1 - L.z0, H - 0.6, fx + 0.07, (F + 0.5 + H) / 2, 0, Math.PI / 2);
    [-5.4, -2.6, -0.8, 0.8, 2.6, 5.4].forEach(z => box(std(0x2e4a3a), fx - 0.02, fx + 0.17, 0, H, z - 0.06, z + 0.06, false));
    box(std(0x2e4a3a), fx - 0.02, fx + 0.17, 2.7, 2.8, -0.8, 0.8, false);
    const sm = neonSign('PETAL & PIXEL', '#7affb0', 6, 0.9, '800 112px Georgia'); plane(sm, 6, 0.9, fx - 0.45, H + 1.25, 0, -Math.PI / 2);
    plane(new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, map: ctex(512, 64, (q, w, h) => { q.fillStyle = '#e8ffe8'; q.font = '600 36px system-ui'; q.textAlign = 'center'; q.fillText('GALLERY · FLORIST · NFT ART', w / 2, 44); }) }), 3.6, 0.45, fx - 0.17, 2.45, 0, -Math.PI / 2);
    place(scene, `${CC}detail-awning-wide.glb`, { x: fx - 0.6, y: 2.9, z: -3.3, ry: -Math.PI / 2, fitW: 4.0 }); place(scene, `${CC}detail-awning-wide.glb`, { x: fx - 0.6, y: 2.9, z: 3.3, ry: -Math.PI / 2, fitW: 4.0 });
    // warm interior glow + plants and buckets inside
    [[25.5, -2.5], [25.5, 2.5]].forEach(([x, z]) => { const p = new THREE.PointLight(0xffd6a0, 2.5, 8, 1.6); p.position.set(x, H - 0.5, z); scene.add(p); });
    plane(new THREE.MeshBasicMaterial({ color: 0xffe0b8, toneMapped: false, transparent: true, opacity: 0.25 }), 10, 3, L.x1 - T - 0.05, 2, 0, -Math.PI / 2);
    // flower stall: tiered wooden stand with buckets (zinc cylinders) of Kenney CC0 flowers, out front (z 1.2..5)
    const wood = std(0x7a5236, { roughness: 0.8 }), zinc = std(0x9aa4ad, { metalness: 0.8, roughness: 0.35 });
    const fl = ['flower_redA', 'flower_yellowA', 'flower_purpleA', 'flower_redB', 'flower_yellowB'];
    [[21.4, 0.35], [20.8, 0.7], [20.2, 1.05]].forEach(([x, top], row) => {
      box(wood, x - 0.32, x + 0.32, 0, top, 1.3, 5.0, false);
      for (let k = 0; k < 5; k++) { const z = 1.7 + k * 0.72, b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 16, 1, true), zinc); b.position.set(x, top + 0.2, z); scene.add(b);
        for (let j = 0; j < 3; j++) place(scene, `${NA}${fl[(k + row + j) % 5]}.glb`, { x: x + (j - 1) * 0.09, y: top + 0.25, z: z + ((j * 7) % 3 - 1) * 0.07, ry: j * 2, fitH: 0.75, fitW: 0.5 }); } });
    boxes.push({ x0: 19.8, x1: 21.8, z0: 1.3, z1: 5.0, y0: 0, y1: 1.1 });
    [[21.3, -4.9], [20.7, -4.9]].forEach(([x, z], i) => place(scene, `${NA}${i ? 'pot_large' : 'pot_small'}.glb`, { x, y: F, z, scale: 1.6 }));
    place(scene, `${NA}plant_bush.glb`, { x: 21.3, y: F + 0.3, z: -4.9, scale: 0.9 });
    for (const z of [-4, 4]) place(scene, `${NA}plant_bushSmall.glb`, { x: 26.6, y: F, z, scale: 1.6 });
    // A-frame chalk menu board
    const menu = ctex(256, 360, (q, w, h) => { q.fillStyle = '#1e2a24'; q.fillRect(0, 0, w, h); q.strokeStyle = '#c9a36a'; q.lineWidth = 14; q.strokeRect(0, 0, w, h); q.fillStyle = '#f2f2e8'; q.textAlign = 'center'; q.font = '700 34px Georgia'; q.fillText('Fresh today', w / 2, 56);
      q.font = '24px Georgia'; ['Tulips ....... $8', 'Roses ...... $12', 'Sunflowers .. $6', 'Posies ...... $5', '', 'Gallery open', 'NFT art inside'].forEach((l, i) => q.fillText(l, w / 2, 106 + i * 34)); q.fillStyle = '#ff9ad0'; q.beginPath(); q.arc(40, 330, 10, 0, 7); q.fill(); });
    const aframe = new THREE.Group(); aframe.position.set(20.4, F, -1.6); aframe.rotation.y = -Math.PI / 2 + 0.25;
    for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.85), new THREE.MeshStandardMaterial({ map: menu, roughness: 0.9, side: THREE.DoubleSide })); p.position.set(0, 0.45, s * 0.12); p.rotation.x = -s * 0.25; aframe.add(p); }
    scene.add(aframe); colliders.push({ x: 20.4, z: -1.6, r: 0.35 });
  }

  // ================= 3) ESCROW PALACE entrance (front wall z=20, door x -0.9..0.9) =================
  { const z = APT.z0 - 0.02, metal = std(0x8a8e94, { metalness: 0.8, roughness: 0.35 });
    // stoop steps
    const conc = std(0x8a8480, { roughness: 0.9 });
    box(conc, -1.6, 1.6, 0, 0.2, z - 1.4, z, false); box(conc, -1.3, 1.3, 0.2, 0.32, z - 0.8, z, false);
    // letterbox bank 2x3 with slots + numbers
    const lb = ctex(256, 192, (q, w, h) => { q.fillStyle = '#5c6068'; q.fillRect(0, 0, w, h); for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { const x = 8 + c * 82, y = 8 + r * 92; q.fillStyle = '#7d828a'; q.fillRect(x, y, 76, 84); q.fillStyle = '#16161a'; q.fillRect(x + 12, y + 18, 52, 8); q.fillStyle = '#e8e0c8'; q.font = '700 20px system-ui'; q.fillText('0' + (r * 3 + c + 1), x + 26, y + 66); } });
    box(metal, 1.35, 2.45, 1.0, 1.85, z - 0.16, z, false); plane(new THREE.MeshStandardMaterial({ map: lb, metalness: 0.6, roughness: 0.4 }), 1.1, 0.85, 1.9, 1.425, z - 0.165, Math.PI);
    // intercom with lit screen + buttons
    box(metal, -1.6, -1.25, 1.05, 1.75, z - 0.08, z, false);
    const ic = ctex(128, 256, (q, w, h) => { q.fillStyle = '#202228'; q.fillRect(0, 0, w, h); q.fillStyle = '#7ff8ff'; q.fillRect(14, 14, 100, 50); q.fillStyle = '#062028'; q.font = '700 18px monospace'; q.fillText('ESCROW PALACE', 24, 46); for (let i = 0; i < 6; i++) { q.fillStyle = '#c8ccd4'; q.beginPath(); q.arc(36 + (i % 2) * 56, 100 + Math.floor(i / 2) * 50, 14, 0, 7); q.fill(); q.fillStyle = '#333'; q.font = '14px system-ui'; q.fillText('0' + (i + 1), 28 + (i % 2) * 56, 105 + Math.floor(i / 2) * 50); } });
    plane(new THREE.MeshBasicMaterial({ map: ic, toneMapped: false }), 0.33, 0.66, -1.425, 1.4, z - 0.085, Math.PI);
    place(scene, `${FU}lampWall.glb`, { x: 1.25, y: 2.1, z: z - 0.1, ry: Math.PI, scale: 1.6 });
    place(scene, `${FU}rugRounded.glb`, { x: 0, y: 0.33, z: z - 0.45, scale: 1.2, tint: new THREE.Color(0.5, 0.4, 0.3) });
    // sleeping cat on the first-floor ledge (procedural), breathing
    const cat = new THREE.Group(), fur = std(0xd08a4a, { roughness: 0.95 });
    const bod = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), fur); bod.scale.set(1.3, 0.6, 0.9); cat.add(bod);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), fur); head.position.set(0.26, 0.02, 0.06); cat.add(head);
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 4), fur); ear.position.set(0.28, 0.12, 0.06 + s * 0.05); cat.add(ear); }
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 16, Math.PI * 1.2), fur); tail.rotation.x = Math.PI / 2; tail.position.y = -0.06; cat.add(tail);
    cat.position.set(-3.2, 3.98, z - 0.12); scene.add(cat);
    anim.push(t => { bod.scale.y = 0.6 + Math.sin(t * 1.6) * 0.025; tail.rotation.z = Math.sin(t * 0.7) * 0.15; });
  }

  // ================= 4) life details =================
  // street lamps (Kenney City Kit Roads) around the plaza edge, placed between shops
  [[-9, -20], [9, -19], [21, -8], [21, 8], [-8, 25], [8, 25]].forEach(([x, z]) => { const a = Math.atan2(-x, -z); place(scene, `${RD}light-curved.glb`, { x, y: 0, z, ry: a, fitH: 5.5 }); colliders.push({ x, z, r: 0.25 });
    const p = new THREE.PointLight(0xffd0a0, 5, 10, 1.6); p.position.set(x * 0.92, 5, z * 0.92); scene.add(p); });
  // benches facing the plaza + bin beside each
  [[-3.8, -17.2, 0], [3.6, -17.2, 0], [19.6, 6.8, -Math.PI / 2], [-11, 4, Math.PI / 2]].forEach(([x, z, ry]) => { place(scene, `${FU}bench.glb`, { x, y: FLOOR, z, ry: ry + Math.PI, scale: 2.2, tint: new THREE.Color(0.6, 0.5, 0.42) }); colliders.push({ x, z, r: 0.6, hop: 0.6 });
    const bx = x + Math.cos(ry) * 1.3, bz = z - Math.sin(ry) * 1.3; place(scene, `${FU}trashcan.glb`, { x: bx, y: FLOOR, z: bz, scale: 1.8 }); });
  // service alley beside the arcade: dumpster + steam vent
  place(scene, `${RD}dumpster.glb`, { x: -8.6, y: 0, z: -27.5, ry: Math.PI / 2, fitW: 1.8 }); colliders.push({ x: -8.6, z: -27.5, r: 1.0 });
  // overhead wires between rooftops (catenaries)
  const wireM = new THREE.MeshBasicMaterial({ color: 0x15121a });
  const wire = (a, b, sag) => { const mid = a.clone().lerp(b, 0.5); mid.y -= sag; const c = new THREE.QuadraticBezierCurve3(a, mid, b); scene.add(new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.018, 4), wireM)); };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  wire(V(-7, 4.7, -20), V(22, 5.3, -5.5), 1.0); wire(V(-7, 4.4, -20.2), V(22, 5.0, -5.3), 1.2); wire(V(7, 4.7, -20), V(-6, 7.5, 28), 1.6); wire(V(28.5, 5.3, 5.5), V(6, 7.4, 28), 1.4); wire(V(22, 5.0, 5.5), V(-6, 7.2, 28), 2.0);
  // puddles: glossy irregular decals on the plaza
  const pud = ctex(256, 256, (q, w, h) => { const g = q.createRadialGradient(128, 128, 20, 128, 128, 120); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.7, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; for (let i = 0; i < 5; i++) { q.beginPath(); q.ellipse(128 + Math.cos(i * 2.1) * 40, 128 + Math.sin(i * 1.7) * 30, 70, 45, i, 0, 7); q.fill(); } });
  const pudM = new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.02, metalness: 1, alphaMap: pud, transparent: true, envMapIntensity: 2.5, depthWrite: false });
  [[-6, -6, 2.6], [5, 9, 2], [9, -4, 1.6], [-10, 10, 2.2], [1, -10.3, 1.6]].forEach(([x, z, s], i) => plane(pudM, s, s * 0.7, x, FLOOR + 0.015, z, i, -Math.PI / 2).rotation.z = i);
  // vent steam: soft sprite particles rising from a street grate and the arcade roof vent
  const grate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), std(0x222226, { metalness: 0.8, roughness: 0.4 })); grate.rotation.x = -Math.PI / 2; grate.position.set(-8.6, 0.03, -24.5); scene.add(grate);
  box(std(0x555a60, { metalness: 0.7 }), 4.5, 5.3, 4.75, 5.4, -27, -26.2, false);
  const puff = ctex(64, 64, (q) => { const g = q.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, 64, 64); });
  const vents = [V(-8.6, 0.1, -24.5), V(4.9, 5.4, -26.6)], N = 40, sp = [];
  vents.forEach((v, vi) => { for (let i = 0; i < N / 2; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: 0xd8d4e8, transparent: true, depthWrite: false, opacity: 0 })); scene.add(s); sp.push({ s, v, ph: i / (N / 2) * 4 }); } });
  anim.push((t) => sp.forEach(({ s, v, ph }) => { const k = ((t + ph) % 4) / 4; s.position.set(v.x + Math.sin(t + ph * 3) * 0.3 * k, v.y + k * 3.2, v.z + k * 0.4); s.scale.setScalar(0.5 + k * 1.8); s.material.opacity = Math.sin(k * Math.PI) * 0.45; }));
  // birds: a small flock circling over the block (simple flapping V shapes)
  const birdG = new THREE.BufferGeometry(); birdG.setAttribute('position', new THREE.Float32BufferAttribute([-0.35, 0, 0, 0, 0, 0.1, 0, 0, -0.1, 0.35, 0, 0, 0, 0, 0.1, 0, 0, -0.1], 3));
  const birds = Array.from({ length: 7 }, (_, i) => { const b = new THREE.Mesh(birdG.clone(), new THREE.MeshBasicMaterial({ color: 0x1a1420, side: THREE.DoubleSide })); scene.add(b); return { b, i }; });
  anim.push(t => birds.forEach(({ b, i }) => { const a = t * 0.18 + i * 0.35, r = 14 + (i % 3) * 2; b.position.set(Math.cos(a) * r + 3, 13 + Math.sin(t + i) * 0.6, Math.sin(a) * r - 2); b.rotation.y = -a; const f = Math.sin(t * 9 + i) * 0.35, p = b.geometry.attributes.position; p.setY(0, f); p.setY(3, f); p.needsUpdate = true; }));

  // arcade A-frame (tokens & rules) on the pavement by the door
  const ab = ctex(256, 360, (q, w, h) => { q.fillStyle = '#120a24'; q.fillRect(0, 0, w, h); q.strokeStyle = '#ff3df0'; q.lineWidth = 10; q.strokeRect(0, 0, w, h); q.textAlign = 'center'; q.fillStyle = '#22f0ff'; q.font = '900 34px system-ui'; q.fillText('HIGH SCORES', w / 2, 56);
    q.fillStyle = '#fff'; q.font = '22px system-ui'; ['Beat a #1 score', 'earn 1 TOKEN', '', 'Spend 2 TOKENS', 'unlock the next', 'machine', '', 'Free play inside'].forEach((l, i) => q.fillText(l, w / 2, 100 + i * 32)); });
  const af = new THREE.Group(); af.position.set(2.4, FLOOR, -18.8); af.rotation.y = -0.3;
  for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.85), new THREE.MeshStandardMaterial({ map: ab, roughness: 0.8, emissive: 0xffffff, emissiveMap: ab, emissiveIntensity: 0.3, side: THREE.DoubleSide })); p.position.set(0, 0.45, s * 0.12); p.rotation.x = -s * 0.25; af.add(p); }
  scene.add(af); colliders.push({ x: 2.4, z: -18.8, r: 0.35 });


  // ================= 5) preview: footpaths from plaza rim to each building door =================
  {
    const pathM = new THREE.MeshStandardMaterial({ color: 0x1a2238, roughness: 0.55, metalness: 0.25, envMapIntensity: 0.8 });
    const edgeM = new THREE.MeshBasicMaterial({ color: 0x22f0ff, toneMapped: false, transparent: true, opacity: 0.55 });
    const strip = (x0, z0, x1, z1, w = 2.4) => {
      const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz) || 1, ang = Math.atan2(dx, dz);
      const g = new THREE.Group(); g.position.set((x0 + x1) / 2, FLOOR + 0.02, (z0 + z1) / 2); g.rotation.y = ang;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(w, len), pathM); road.rotation.x = -Math.PI / 2; road.receiveShadow = true; g.add(road);
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.PlaneGeometry(0.08, len), edgeM); e.rotation.x = -Math.PI / 2; e.position.set(s * (w / 2 - 0.05), 0.01, 0); g.add(e); }
      // dashed centre line
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.12, Math.max(0.4, len * 0.08)), new THREE.MeshBasicMaterial({ color: 0xffd23d, toneMapped: false, transparent: true, opacity: 0.7 }));
      dash.rotation.x = -Math.PI / 2; dash.position.y = 0.012; g.add(dash);
      scene.add(g); return g;
    };
    // plaza rim (~15.5) -> building doors
    const rim = 15.5;
    strip(0, -rim, 0, LOTS.arcade.z1 + 0.3, 2.6);           // south -> LEDGER ARCADE
    strip(rim, 0, LOTS.florist.x0 - 0.4, 0, 2.4);           // east -> PETAL & PIXEL
    strip(0, rim, 0, APT.z0 - 0.5, 2.6);                    // north -> ESCROW PALACE
    // small plaza hub disc marker
    const hub = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), new THREE.MeshStandardMaterial({ color: 0x12182a, roughness: 0.35, metalness: 0.4 }));
    hub.rotation.x = -Math.PI / 2; hub.position.y = FLOOR + 0.025; scene.add(hub);
    const hubR = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.6, 48), new THREE.MeshBasicMaterial({ color: 0xff3df0, toneMapped: false, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    hubR.rotation.x = -Math.PI / 2; hubR.position.y = FLOOR + 0.03; scene.add(hubR);
  }

  return { update: t => anim.forEach(f => f(t)) };
}

// ---- ambient sound (procedural WebAudio, original: soft city rumble + distant hum + occasional drip). Off by default. ----
let ctx = null, master = null;
export function toggleAmbient() {
  if (!ctx) {
    ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = buf.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; src.connect(lp).connect(master); src.start();
    const hum = ctx.createOscillator(); hum.frequency.value = 55; const hg = ctx.createGain(); hg.gain.value = 0.03; hum.connect(hg).connect(master); hum.start();
    setInterval(() => { if (master.gain.value < 0.01) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 900 + Math.random() * 600; o.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.12); g.gain.setValueAtTime(0.04, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15); o.connect(g).connect(master); o.start(); o.stop(ctx.currentTime + 0.2); }, 2300);
  }
  const on = master.gain.value < 0.01; master.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.3); if (ctx.state === 'suspended') ctx.resume(); return on;
}
