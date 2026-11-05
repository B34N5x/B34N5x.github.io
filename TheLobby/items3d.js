// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// Step 23: non-character avatars from the offline item classifier (tools/classify_item.py -> profile.item).
// 'object' = walking object (template shape scaled up as the body + legs/arms/eyes, image colours);
// 'canvas' = walking canvas (flat panel textured with the image itself + legs); addHat = hat on a default figure.
import * as THREE from './lib/three.module.js';
const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6, metalness: 0.05 }, o));
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; };
function objectShape(tpl, c, c2) {
  const g = new THREE.Group(), m = mat(c), m2 = mat(c2 || new THREE.Color(c).multiplyScalar(0.45));
  if (tpl === 'boot') { // shaft + foot + sole (the dark sole stays part of the boot, never gloves)
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.62, 28), m, -0.06, 0.48, 0));
    const foot = mesh(new THREE.CapsuleGeometry(0.2, 0.32, 8, 20), m, 0.12, 0.2, 0); foot.rotation.z = Math.PI / 2; g.add(foot);
    g.add(mesh(new THREE.BoxGeometry(0.66, 0.06, 0.4), m2, 0.07, 0.03, 0));
    { const r = mesh(new THREE.TorusGeometry(0.205, 0.03, 8, 28), m2, -0.06, 0.79, 0); r.rotation.x = Math.PI / 2; g.add(r); }
    g.userData.face = new THREE.Vector3(0.0, 0.6, 0.22); }
  else if (tpl === 'cup') { g.add(mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.62, 32), m, 0, 0.31, 0)); const h = mesh(new THREE.TorusGeometry(0.13, 0.04, 10, 24), m, 0.32, 0.36, 0); g.add(h); g.add(mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 32), m2, 0, 0.62, 0)); g.userData.face = new THREE.Vector3(0, 0.4, 0.3); }
  else if (tpl === 'can') { g.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.78, 32), m, 0, 0.39, 0)); g.add(mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.05, 32), m2, 0, 0.8, 0)); g.userData.face = new THREE.Vector3(0, 0.5, 0.245); }
  else if (tpl === 'ball') { g.add(mesh(new THREE.SphereGeometry(0.38, 32, 22), m, 0, 0.38, 0)); g.add(mesh(new THREE.TorusGeometry(0.381, 0.015, 6, 40), m2, 0, 0.38, 0)); g.userData.face = new THREE.Vector3(0, 0.46, 0.36); }
  else { g.add(mesh(new THREE.BoxGeometry(0.56, 0.7, 0.36), m, 0, 0.35, 0)); g.userData.face = new THREE.Vector3(0, 0.48, 0.19); }
  return g;
}
function canvasPanel(item) {
  const g = new THREE.Group(), frame = mat('#2a2a30');
  let face = mat(item.colours && item.colours[0] || '#ddd');
  if (item.texture) { const t = new THREE.TextureLoader().load(item.texture, () => { t.needsUpdate = true; if (canvasPanel.onLoad) canvasPanel.onLoad(); }); t.colorSpace = THREE.SRGBColorSpace; face = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }); }
  g.add(mesh(new THREE.BoxGeometry(0.74, 0.74, 0.05), frame, 0, 0.37, 0));
  const front = mesh(new THREE.PlaneGeometry(0.68, 0.68), face, 0, 0.37, 0.026); g.add(front); const back = front.clone(); back.position.z = -0.026; back.rotation.y = Math.PI; g.add(back);
  g.userData.face = null; return g;
}
export const onItemTexture = f => { canvasPanel.onLoad = f; };
export function buildItem(spec) {
  const item = spec.item || {}, cols = item.colours || [], c = cols[0] || spec.colours.body || '#a0784a', c2 = cols[1];
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const shape = spec.type === 'canvas' ? canvasPanel(item) : objectShape(item.template, c, c2); shape.position.y = 0.36; if (spec.type === 'object') shape.scale.setScalar(0.85); body.add(shape);
  const limb = mat('#26262c'), shoe = mat('#f2f2f2'), legs = [], arms = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(s * 0.13, 0.38, 0); const l = mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.32, 10), limb, 0, -0.16, 0); p.add(l);
    { const sh = mesh(new THREE.SphereGeometry(0.065, 16, 10), shoe, 0, -0.33, 0.03); sh.scale.set(1, 0.6, 1.4); p.add(sh); } root.add(p); legs.push(p);
    const a = new THREE.Group(); a.position.set(s * 0.42, 0.78, 0); a.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 10), limb, 0, -0.15, 0)); a.add(mesh(new THREE.SphereGeometry(0.05, 14, 10), shoe, 0, -0.31, 0)); body.add(a); arms.push(a);
  }
  const f = shape.userData.face;
  const eyeAt = f ? f.clone().add(new THREE.Vector3(0, 0.36, 0.01)) : new THREE.Vector3(0, 1.17, 0.03);
  if (!f) { const head = mesh(new THREE.SphereGeometry(0.001), limb); body.add(head); }
  for (const s of [-1, 1]) { const w = mesh(new THREE.SphereGeometry(0.055, 16, 12), mat('#fff'), eyeAt.x + s * 0.09, eyeAt.y, eyeAt.z); w.scale.z = 0.5; body.add(w); body.add(mesh(new THREE.SphereGeometry(0.026, 12, 8), mat('#111'), eyeAt.x + s * 0.09, eyeAt.y, eyeAt.z + 0.03)); }
  // Head accessories on object avatars (cup spikes etc.) — colour from features/art
  const F = spec.features || {};
  if (F.headwear && String(F.headwear.kind || '').startsWith('hair')) {
    const hc = F.headwear.colour || spec.colours.accent || '#ff6bcb';
    const hm = mat(hc, { roughness: 0.9 });
    const hy = eyeAt.y + 0.18;
    for (let i = 0; i < 6; i++) {
      const a = -1 + i * 0.4;
      const sp = mesh(new THREE.ConeGeometry(0.04, 0.16 + (i % 2) * 0.05, 6), hm, Math.sin(a) * 0.18, hy, Math.cos(a) * 0.1);
      sp.rotation.z = a * 0.3; sp.rotation.x = -0.4; body.add(sp);
    }
  }
  // Face: clown nose + moustache (Big Cup etc.) — driven by traits, not per-NFT hardcode
  if (F.eyes && F.eyes.kind === 'clown') {
    const nose = mesh(new THREE.SphereGeometry(0.05, 12, 10), mat(F.eyes.colour || '#d8383a', { roughness: 0.55 }), eyeAt.x, eyeAt.y - 0.08, eyeAt.z + 0.06);
    nose.userData.clownNose = 1; body.add(nose); root.userData.clownNose = 1;
  }
  if (F.mouth && F.mouth.kind === 'moustache') {
    const mc = mat(F.mouth.colour || '#1a1a1e', { roughness: 0.9 });
    const stache = mesh(new THREE.BoxGeometry(0.22, 0.045, 0.06), mc, eyeAt.x, eyeAt.y - 0.14, eyeAt.z + 0.04);
    stache.userData.moustache = 1; body.add(stache);
    [-1, 1].forEach(s => body.add(mesh(new THREE.BoxGeometry(0.07, 0.035, 0.05), mc, eyeAt.x + s * 0.12, eyeAt.y - 0.15, eyeAt.z + 0.03)));
    root.userData.moustache = 1;
  }
  // Polka-dot pattern on object body / shirt panel
  if (F.pattern && F.pattern.kind === 'polka') {
    const ground = F.pattern.ground || '#f2c53d';
    const dot = F.pattern.colour || '#3a6fd8';
    const panel = mesh(new THREE.BoxGeometry(0.42, 0.35, 0.08), mat(ground, { roughness: 0.85 }), 0, 0.55, 0.28);
    panel.userData.polka = 1; body.add(panel);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
      const d = mesh(new THREE.SphereGeometry(0.03, 8, 6), mat(dot, { roughness: 0.8 }), -0.12 + col * 0.08, 0.45 + row * 0.08, 0.33);
      d.userData.polka = 1; body.add(d);
    }
    root.userData.polka = 1;
  }
  if (item.template === 'cup' && (spec.colours.accent || spec.colours.body)) {
    // mug handle already green/body; tip rim with accent
    shape.traverse(o => { if (o.isMesh && o.position.y > 0.55) o.material = mat(spec.colours.accent || '#3fae5a'); });
  }
  root.userData.itemType = spec.type; root.userData.template = item.template;
  root.userData.animate = (t, dt, ctl, walkT) => {
    const B = ctl ? ctl.blend : { idle: 1, walk: 0, run: 0, jump: 0, fall: 0, land: 0 }, mv = B.walk + B.run, sw = Math.sin(walkT) * (0.5 * B.walk + 0.85 * B.run);
    legs[0].rotation.x = sw; legs[1].rotation.x = -sw; arms[0].rotation.x = -sw * 0.8; arms[1].rotation.x = sw * 0.8; arms[0].rotation.z = -0.3 - 0.5 * B.jump; arms[1].rotation.z = 0.3 + 0.5 * B.jump;
    body.position.y = Math.abs(Math.sin(walkT)) * 0.05 * mv + Math.sin(t * 2) * 0.012 * B.idle; body.rotation.z = Math.sin(walkT) * 0.06 * mv;
    if (ctl) root.scale.copy(ctl.scale);
  };
  return root;
}
export function addHat(root, item) {
  const A = root.userData.anchors && root.userData.anchors.head; if (!A) return;
  const c = (item.colours && item.colours[0]) || '#c0262d', m = mat(c), m2 = mat(new THREE.Color(c).multiplyScalar(0.7)), g = new THREE.Group(), k = item.template;
  if (k === 'cap') { g.add(mesh(new THREE.SphereGeometry(0.2, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), m)); const b = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.015, 24, 1, false, -Math.PI / 2, Math.PI), m2, 0, 0.005, 0.12); b.scale.z = 0.9; g.add(b); }
  else if (k === 'tophat') { g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.28, 24), m, 0, 0.14, 0)); g.add(mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 28), m2)); }
  else if (k === 'beanie') { g.add(mesh(new THREE.SphereGeometry(0.205, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), m)); { const r = mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 28), m2); r.rotation.x = Math.PI / 2; g.add(r); } }
  else { g.add(mesh(new THREE.SphereGeometry(0.18, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.02, 0)); g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.02, 32), m2)); }
  g.position.copy(A.pos).multiplyScalar(0.45); g.scale.setScalar(Math.max(1, A.s * 0.97)); A.obj.add(g); root.userData.hat = k;
}
