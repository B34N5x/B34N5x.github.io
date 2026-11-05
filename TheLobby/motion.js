// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// Soft ambient light waves + motion scale. Original calm hub feel (not a Matrix/PS copy).
// Respects prefers-reduced-motion and Lightweight mode (window.__perf.low).
import * as THREE from './lib/three.module.js';

export function motionScale() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  if (window.__perf && window.__perf.low) return 0.35;
  return 1;
}

/** Soft floating light ribbons above the plaza. Kenney CC0 not needed — procedural. */
export function buildAmbientWaves(scene) {
  const group = new THREE.Group(); group.name = 'ambientWaves';
  const tex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    const rg = g.createLinearGradient(0, 0, 256, 0);
    rg.addColorStop(0, 'rgba(34,240,255,0)'); rg.addColorStop(.35, 'rgba(34,240,255,.55)');
    rg.addColorStop(.5, 'rgba(255,255,255,.75)'); rg.addColorStop(.65, 'rgba(255,61,240,.45)');
    rg.addColorStop(1, 'rgba(34,240,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 256, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const waves = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(18 + i * 4, 0.9 + i * 0.15, 1, 1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.18 - i * 0.02, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
    );
    m.rotation.x = -Math.PI / 2.4;
    m.position.set((i % 2 ? -1 : 1) * (4 + i * 2), 6 + i * 1.4, -6 + i * 3);
    m.userData = { baseY: m.position.y, ph: i * 1.3, spin: 0.05 + i * 0.02 };
    group.add(m); waves.push(m);
  }
  // soft mote cloud (fewer than main data particles)
  const N = 120, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) pos.set([(Math.random() - 0.5) * 50, 2 + Math.random() * 14, (Math.random() - 0.5) * 50], i * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
    const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(200,255,255,.9)'); r.addColorStop(1, 'rgba(200,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 32, 32); const t = new THREE.CanvasTexture(c); return t; })();
  const motes = new THREE.Points(geo, new THREE.PointsMaterial({ map: dot, color: 0xbff9ff, size: 0.35, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.7 }));
  group.add(motes);
  scene.add(group);
  return { group, waves, motes, pos };
}

export function tickAmbient(state, t, dt, scale) {
  if (!state || scale <= 0) { if (state) state.group.visible = false; return; }
  state.group.visible = true;
  for (const w of state.waves) {
    w.position.y = w.userData.baseY + Math.sin(t * 0.35 + w.userData.ph) * 0.35 * scale;
    w.rotation.z = Math.sin(t * w.userData.spin + w.userData.ph) * 0.15 * scale;
    w.material.opacity = (0.12 + 0.06 * Math.sin(t * 0.5 + w.userData.ph)) * scale;
  }
  const pa = state.motes.geometry.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    let y = pa.getY(i) + dt * (0.15 + (i % 4) * 0.05) * scale;
    let x = pa.getX(i) + Math.sin(t * 0.2 + i) * 0.002 * scale;
    if (y > 16) y = 2;
    pa.setY(i, y); pa.setX(i, x);
  }
  pa.needsUpdate = true;
}
