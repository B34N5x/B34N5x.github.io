// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// v14 polish-preview: prompt chip, label fade, My Music (local files, memory only), TESTNET badge, SEC v. Ripple wall exhibit + Web Audio flush.
// Nothing is stored: no localStorage/sessionStorage/IndexedDB/cookies; audio files stay as in-memory object URLs.
import * as THREE from './lib/three.module.js';
import { boxes } from './world3.js';
import { ZONE } from './boundary.js?v=2';
const $ = id => document.getElementById(id);
const labels = [];
export const trackLabel = s => (labels.push(s), s);
// ---- prompt chip: "E: play X · ..." -> [E] Play
const chip = Object.assign(document.createElement('div'), { id: 'pchip' }); document.body.append(chip);
export function showPrompt(text) {
  if (!text) return chip.classList.remove('on');
  const m = /^([A-Z]):\s*(\S+)/.exec(text), key = m ? m[1] : '', word = m ? m[2] : text.split(/[:·]/)[0].trim();
  { const sp = document.createElement('span'); sp.textContent = word.charAt(0).toUpperCase() + word.slice(1); const kb = key ? Object.assign(document.createElement('kbd'), { textContent: key }) : null; chip.replaceChildren(...(kb ? [kb, sp] : [sp])); }
  chip.title = text; chip.classList.add('on');
}
// ---- TESTNET badge
(document.getElementById('wallet') || document.body).append(Object.assign(document.createElement('div'), { id: 'tnbadge', textContent: 'TESTNET · no real funds' })); // v17: sits under the sign-in button
// ---- My Music
const mb = Object.assign(document.createElement('button'), { id: 'mymusic', type: 'button', textContent: '♫' }); mb.title = 'My Music (only you hear it)';
const mp = Object.assign(document.createElement('div'), { id: 'mpanel', className: 'gcard' });
mp.innerHTML = '<b>My Music</b><p class="gsub">Pick songs from your device. Only you hear them; nothing is uploaded or saved.</p><label class="mpick">Choose files<input id="mfiles" type="file" accept="audio/*" multiple hidden></label><p id="mnow">No songs picked</p><div class="mrow"><button id="mplay" type="button">▶</button><button id="mnext" type="button">⏭</button><input id="mvol" type="range" min="0" max="100" value="70"></div>';
($('mmrow') || document.body).append(mb); document.body.append(mp);
let list = [], idx = 0; const au = new Audio(); au.volume = .7;
const load = i => { if (!list.length) return; idx = (i + list.length) % list.length; au.src = list[idx].url; $('mnow').textContent = list[idx].name; au.play().catch(() => {}); $('mplay').textContent = '⏸'; };
mb.onclick = e => { e.stopPropagation(); mp.classList.toggle('on'); };
mp.addEventListener('click', e => e.stopPropagation()); mp.addEventListener('keydown', e => e.stopPropagation());
$('mfiles').onchange = e => { list.forEach(s => URL.revokeObjectURL(s.url)); list = [...e.target.files].map(f => ({ name: f.name, url: URL.createObjectURL(f) })); load(0); };
$('mplay').onclick = () => { if (!au.src) return load(0); if (au.paused) { au.play(); $('mplay').textContent = '⏸'; } else { au.pause(); $('mplay').textContent = '▶'; } };
$('mnext').onclick = () => load(idx + 1); au.onended = () => load(idx + 1);
$('mvol').oninput = e => { au.volume = e.target.value / 100; };
// ---- SEC v. Ripple quarantine room (internal name: restroom) exhibit (neutral facts only)
const R = { x: -18, z: 0.5, w: 4, d: 4 }, H = 3;
const LINES = ['Dec 2020: The SEC filed a lawsuit against Ripple Labs and two executives over sales of XRP.',
  'Jul 2023: A US federal judge ruled XRP sales on public exchanges were not investment contracts; certain institutional sales were.',
  'Aug 2024: The court ordered Ripple to pay a civil penalty of about US$125 million.'];
function plaque() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 640; const g = c.getContext('2d');
  g.fillStyle = '#e9ecef'; g.fillRect(0, 0, 1024, 640); g.strokeStyle = '#8a9099'; g.lineWidth = 10; g.strokeRect(20, 20, 984, 600);
  g.fillStyle = '#1d232b'; g.font = '600 34px system-ui,sans-serif'; let y = 90;
  for (const l of LINES) { let row = ''; for (const w of l.split(' ')) { if (g.measureText(row + w).width > 900) { g.fillText(row, 60, y); y += 46; row = ''; } row += w + ' '; } g.fillText(row, 60, y); y += 80; }
  g.font = 'italic 24px system-ui,sans-serif'; g.fillStyle = '#5a616b'; g.fillText('Facts summarised from public court records. Not legal advice.', 60, 590);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function buildRestroom(scene) {
  const g = new THREE.Group(), wm = new THREE.MeshStandardMaterial({ color: 0xcfd6dc, roughness: .8 }), T = .15, x0 = R.x - R.w / 2, x1 = R.x + R.w / 2, z0 = R.z - R.d / 2, z1 = R.z + R.d / 2, DOOR = 1.4;
  const wall = (ax, bx, az, bz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(bx - ax, T), H, Math.max(bz - az, T)), wm); m.position.set((ax + bx) / 2, H / 2, (az + bz) / 2); g.add(m);
    boxes.push({ x0: Math.min(ax, bx) - T / 2, x1: Math.max(ax, bx) + T / 2, z0: Math.min(az, bz) - T / 2, z1: Math.max(az, bz) + T / 2, y0: -1, y1: H }); };
  wall(x0, x1, z0, z0); wall(x0, x0, z0, z1); wall(x1, x1, z0, z1); wall(x0, R.x - DOOR / 2, z1, z1); wall(R.x + DOOR / 2, x1, z1, z1); // doorway centred on +z
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(DOOR, .5, T), wm); lintel.position.set(R.x, H - .25, z1); g.add(lintel);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(R.w + T, T, R.d + T), wm); roof.position.set(R.x, H, R.z); g.add(roof);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(R.w, R.d), new THREE.MeshStandardMaterial({ color: 0x9aa3ab })); floor.rotation.x = -Math.PI / 2; floor.position.set(R.x, .37, R.z); g.add(floor);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.625), new THREE.MeshBasicMaterial({ map: plaque(), color: 0x9a9a9a })); p.position.set(R.x, 1.75, z0 + T / 2 + .01); g.add(p);
  const sg = document.createElement('canvas'); sg.width = 256; sg.height = 64; const sc = sg.getContext('2d'); sc.fillStyle = '#2b3138'; sc.fillRect(0, 0, 256, 64); sc.fillStyle = '#fff'; sc.font = '600 26px system-ui'; sc.textAlign = 'center'; sc.fillText('QUARANTINE ROOM', 128, 44, 240);
  const sn = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sg) })); sn.position.set(R.x, H + .3, z1 + .09); g.add(sn);
  const l = new THREE.PointLight(0xffffff, 6, 7); l.position.set(R.x, H - .4, R.z + .5); g.add(l); scene.add(g);
}
// ---- Easter eggs: 7 tiny faint pulsing eggs, random spots each load, ~1s walk outside the ZONE border
const FACTS = ['The XRP Ledger went live in 2012.', 'A new XRP Ledger version closes about every 3 to 5 seconds.',
  '100 billion XRP were created when the ledger began; no more can ever be made.', 'Transaction fees on the XRP Ledger are destroyed, not paid to anyone.',
  'Every XRP Ledger account must hold a small base reserve of XRP to exist.', 'The XRP Ledger has had a built-in decentralized exchange since launch.',
  'Riddle: I am the smallest unit of XRP, one millionth of one. What am I? (A drop)'];
const eggs = []; let eggCard = null;
export function buildEggs(scene) {
  const geo = new THREE.SphereGeometry(.09, 10, 8); geo.scale(1, 1.3, 1);
  for (let i = 0; i < 7; i++) {
    // v15: 2-3 units INSIDE the zone edge (the walk-tested street band), never inside a collider box, so it is walkable and the E prompt only fires there
    let x, z, n = 0; do { const side = i % 4, out = -2 - Math.random(), u = .15 + Math.random() * .7;
      x = side === 0 ? ZONE.x0 - out : side === 1 ? ZONE.x1 + out : ZONE.x0 + u * (ZONE.x1 - ZONE.x0);
      z = side === 2 ? ZONE.z0 - out : side === 3 ? ZONE.z1 + out : ZONE.z0 + u * (ZONE.z1 - ZONE.z0);
    } while (++n < 40 && boxes.some(b => x > b.x0 - 1.4 && x < b.x1 + 1.4 && z > b.z0 - 1.4 && z < b.z1 + 1.4));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xbff9ff, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.position.set(x, .5, z); m.userData = { fact: FACTS[i], ph: Math.random() * 6 }; scene.add(m); eggs.push(m);
  }
  eggCard = Object.assign(document.createElement('div'), { id: 'eggcard', className: 'gcard' }); document.body.append(eggCard);
  addEventListener('keydown', e => { if ((e.code !== 'KeyE' && e.key !== 'e' && e.key !== 'E') || !nearEgg) return; const m = nearEgg; m.parent.remove(m); eggs.splice(eggs.indexOf(m), 1); nearEgg = null;
    eggCard.replaceChildren(Object.assign(document.createElement('b'), { textContent: `Found ${7 - eggs.length} of 7` }), Object.assign(document.createElement('p'), { textContent: m.userData.fact })); eggCard.classList.add('on'); clearTimeout(eggCard.t); eggCard.t = setTimeout(() => eggCard.classList.remove('on'), 6000); });
  window.__eggs = () => eggs.map(m => [m.position.x, m.position.z]);
}
let nearEgg = null;
// ---- lightweight cosmic sky: one 1024x512 canvas texture on the existing skydome + 3 faint distant worlds
export function cosmicSky(sky, scene) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#070722'); gr.addColorStop(.35, '#141a4a'); gr.addColorStop(.5, '#0f4a5a'); gr.addColorStop(.56, '#2a3a5c'); gr.addColorStop(1, '#0a0820');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  g.globalCompositeOperation = 'lighter';
  for (const [x, y, r, col] of [[200, 170, 220, 'rgba(255,61,240,.10)'], [620, 120, 260, 'rgba(34,240,255,.08)'], [880, 200, 200, 'rgba(120,90,255,.10)'], [420, 210, 300, 'rgba(60,200,200,.06)']]) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.save(); g.translate(x, y); g.scale(1.8, .55); g.translate(-x, -y); g.fillRect(x - r, y - r, 2 * r, 2 * r); g.restore(); }
  for (let i = 0; i < 1400; i++) { const y = Math.random() ** 1.6 * 250, a = Math.random() * .8 + .2, s = Math.random() < .06 ? 1.6 : .8; g.fillStyle = `rgba(230,250,255,${a})`; g.fillRect(Math.random() * 1024, y, s, s); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  sky.material.dispose(); sky.material = new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false });
  const worlds = new THREE.Group(); sky.add(worlds);
  const disc = (draw) => { const k = document.createElement('canvas'); k.width = k.height = 256; draw(k.getContext('2d')); const tx = new THREE.CanvasTexture(k); tx.colorSpace = THREE.SRGBColorSpace; return new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, fog: false, toneMapped: false, opacity: .55 }); };
  const planet = (c1, c2, ring) => disc(k => { const rg = k.createRadialGradient(100, 100, 10, 128, 128, 80); rg.addColorStop(0, c1); rg.addColorStop(1, c2); k.fillStyle = rg; k.beginPath(); k.arc(128, 128, 78, 0, 7); k.fill();
    if (ring) { k.strokeStyle = 'rgba(200,250,255,.6)'; k.lineWidth = 5; k.beginPath(); k.ellipse(128, 128, 124, 30, -.3, 0, 7); k.stroke(); } });
  const portal = disc(k => { for (let i = 0; i < 3; i++) { k.strokeStyle = `rgba(34,240,255,${.5 - i * .15})`; k.lineWidth = 6 - i * 2; k.beginPath(); k.arc(128, 128, 110 - i * 18, 0, 7); k.stroke(); } });
  for (const [m, x, y, z, s] of [[planet('#ffb3f5', '#5a1a6a', true), -160, 90, -200, 60], [planet('#9ff', '#145a6a', false), 210, 60, 120, 34], [portal, 40, 120, -240, 50]]) { const sp = new THREE.Sprite(m); sp.position.set(x, y, z); sp.scale.set(s, s, 1); worlds.add(sp); }
  sky.userData.drift = true;
}
let ac = null, wasIn = false;
export function flush() {
  ac = ac || new AudioContext(); const n = ac.sampleRate * 1.2, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain(), t = ac.currentTime; src.buffer = b; f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(1800, t + .35); f.frequency.exponentialRampToValueAtTime(250, t + 1.2);
  gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(.5, t + .15); gn.gain.exponentialRampToValueAtTime(.001, t + 1.2);
  src.connect(f).connect(gn).connect(ac.destination); src.start(t); src.stop(t + 1.2);
}
const tmp = new THREE.Vector3();
export function polishTick(pos, camera, t = 0, sky = null) {
  if (sky) sky.rotation.y = t * .004;
  nearEgg = null; for (const m of eggs) { m.material.opacity = .18 + .14 * Math.sin(t * 1.2 + m.userData.ph); if (Math.hypot(pos.x - m.position.x, pos.z - m.position.z) < 2) nearEgg = m; }
  if (nearEgg) showPrompt('E: Collect');
  const inR = Math.abs(pos.x - R.x) < R.w / 2 && Math.abs(pos.z - R.z) < R.d / 2;
  if (wasIn && !inR) flush(); wasIn = inR;
  for (const s of labels) { s.getWorldPosition(tmp); const d = tmp.distanceTo(camera.position); s.material.opacity = THREE.MathUtils.clamp((16 - d) / 6, 0, 1); }
}
// v15 security lounge INSIDE the quarantine room (restroom): bean bags, 2 fish tanks, 3 TVs on the west wall; E turns a screen on and draws its tip on it.
const TVS = [
  ['Keys', 'Never share your secret key, seed or family seed. No one legit will ever ask for it: not support, not a dev, not an airdrop.', ['xrpl.org/docs/concepts/accounts/cryptographic-keys']],
  ['Signing', 'Before you sign, check the address, the amount and what the transaction actually does. Be wary of fake airdrops, scam DMs and trust lines to tokens you do not know.', ['xrpl.org/docs/concepts/transactions/secure-signing', 'xrpl.org/docs/concepts/tokens/fungible-tokens/trust-line-tokens']],
  ['Device & ethics', 'Keep your device and wallet app updated and turn on its security features. Never ask anyone for their keys, respect other people\u2019s IP, and be honest.', ['xrpl.org/docs/concepts/transactions/secure-signing']]];
function tvTex(i) { const [title, body, src] = TVS[i], c = document.createElement('canvas'); c.width = 512; c.height = 300; const q = c.getContext('2d');
  q.fillStyle = '#071a24'; q.fillRect(0, 0, 512, 300); q.fillStyle = ['#22f0ff', '#ff3df0', '#9cff6a'][i]; q.fillRect(0, 0, 512, 8);
  q.font = '700 30px system-ui'; q.fillText(`TV ${i + 1} \u00b7 ${title}`, 22, 50); q.fillStyle = '#e6fbff'; q.font = '500 22px system-ui';
  let y = 92, line = ''; for (const w of body.split(' ')) { if (q.measureText(line + w).width > 468) { q.fillText(line, 22, y); y += 29; line = ''; } line += w + ' '; } q.fillText(line, 22, y);
  q.fillStyle = '#9ff6ff'; q.font = '500 14px system-ui'; src.forEach((u, k) => q.fillText('Source: ' + u, 22, 262 + k * 18 - (src.length - 1) * 18));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
export function buildLounge(scene, interactables) {
  const g = new THREE.Group(); scene.add(g); const F = .37, x0 = R.x - R.w / 2, x1 = R.x + R.w / 2, z0 = R.z - R.d / 2;
  const M = (geo, c, x, y, z, e) => { const m = new THREE.Mesh(geo, e ? new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .55, toneMapped: false }) : new THREE.MeshStandardMaterial({ color: c, roughness: .8, flatShading: true })); m.position.set(x, y, z); g.add(m); return m; };
  const bag = new THREE.IcosahedronGeometry(.3, 1); bag.scale(1, .6, 1);
  [[x1 - .55, R.z + .2, 0xff3df0], [R.x + .7, z0 + .55, 0x22f0ff], [x0 + 1.2, z0 + .55, 0xffb35c]].forEach(([x, z, c]) => M(bag, c, x, F + .18, z));
  const tank = new THREE.BoxGeometry(.4, .45, .6), fish = new THREE.ConeGeometry(.04, .12, 5); fish.rotateZ(Math.PI / 2); fish.rotateY(Math.PI / 2);
  const fishes = []; [z0 + .55, R.z + 1.25].forEach(z => { const x = x1 - .3; M(new THREE.BoxGeometry(.42, .5, .62), 0x1c1934, x, F + .25, z); M(tank, 0x2aa8ff, x, F + .73, z, true);
    for (let i = 0; i < 3; i++) fishes.push([M(fish, [0xffb35c, 0xff3df0, 0x9cff6a][i], x, F + .6 + i * .1, z), z, i]);
    boxes.push({ x0: x - .25, x1: x1, z0: z - .33, z1: z + .33, y0: -1, y1: 1.4 }); });
  const off = new THREE.MeshBasicMaterial({ color: 0x050505 });
  [-.6, .5, 1.6].map(d => R.z + d - .5).forEach((z, i) => { M(new THREE.BoxGeometry(.06, .62, 1), 0x14112a, x0 + .11, F + 1.25, z);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(.92, .54), off); scr.rotation.y = Math.PI / 2; scr.position.set(x0 + .145, F + 1.25, z); g.add(scr);
    interactables.push({ x: x0 + .6, z, r: .5, hint: `E: watch TV ${i + 1}`, use: () => { if (scr.material === off) scr.material = new THREE.MeshBasicMaterial({ map: tvTex(i), toneMapped: false }); } }); });
  return t => fishes.forEach(([m, z, i]) => { m.position.z = z + Math.sin(t * (.6 + i * .2) + i) * .22; m.rotation.y = Math.cos(t * (.6 + i * .2) + i) > 0 ? 0 : Math.PI; });
}
// v36: AI-assistance credit as an in-world notice near spawn (no collider, raised so it never blocks paths)
export function buildAiNote(scene, FLOOR = 0) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
  x.fillStyle = 'rgba(10,14,30,.85)'; x.fillRect(0, 0, 512, 160); x.strokeStyle = '#6ff'; x.lineWidth = 4; x.strokeRect(4, 4, 504, 152);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = 'bold 34px sans-serif'; x.fillText('Built with help from AI assistants', 256, 68);
  x.font = '26px sans-serif'; x.fillStyle = '#9ff'; x.fillText('Designed by B34N5x · Credits in CREDITS.md', 256, 118);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .5), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
  m.position.set(2.4, FLOOR + 2.1, 1.6); m.rotation.y = -0.6; m.name = 'aiNote'; scene.add(m); return m;
}
