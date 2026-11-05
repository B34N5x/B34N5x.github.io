// (c) 2026 B34N5x. All rights reserved.
// v34 day/night cycle: ~60 min: day held 25 min, 5 min eased sunset, night held 25 min (still bright), 5 min eased dawn. Always starts at day.
// Cheap: one translucent sky dome + light/fog/exposure lerps on a timer (2 s steps in lightweight mode, 0.25 s otherwise).
// Night never goes as dark as the old dusk look; neon stays readable. ?daytime=0..1 pins the phase (0 day, .5 night).
import * as THREE from './lib/three.module.js';
const KEYS = [ // phase, sky dome colour/opacity, fog colour/density, hemi colour/intensity, sun colour/intensity, exposure
  [0.00, '#4a80c0', 0.62, '#b9d4ec', 0.007, '#ffffff', 2.4, '#fff2dc', 2.2, 1.3],
  [25/60, '#4a80c0', 0.62, '#b9d4ec', 0.007, '#ffffff', 2.4, '#fff2dc', 2.2, 1.3],
  [27.5/60, '#ff9a6a', 0.55, '#c88a7a', 0.009, '#ffd2b8', 2.0, '#ff9a5a', 1.8, 1.3],
  [30/60, '#1a2048', 0.00, '#4a3a56', 0.011, '#c8cde0', 1.9, '#9fb0ff', 1.1, 1.3],
  [55/60, '#1a2048', 0.00, '#4a3a56', 0.011, '#c8cde0', 1.9, '#9fb0ff', 1.1, 1.3],
  [57.5/60, '#ffb8a0', 0.55, '#d0a0a8', 0.009, '#ffe0d0', 2.0, '#ffb888', 1.8, 1.3],
  [1.00, '#4a80c0', 0.62, '#b9d4ec', 0.007, '#ffffff', 2.4, '#fff2dc', 2.2, 1.3]];
const C = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t), L = (a, b, t) => a + (b - a) * t;
export function initDayCycle({ scene, renderer, hemi, sun, period = 3600 }) {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(150, 24, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false, fog: false }));
  dome.renderOrder = -1; scene.add(dome);
  const pin = new URLSearchParams(location.search).get('daytime'), t0 = performance.now();
  const step = () => {
    const ph = pin != null ? (+pin % 1) : ((performance.now() - t0) / 1000 / period) % 1;
    let i = 0; while (KEYS[i + 1][0] < ph) i++; const a = KEYS[i], b = KEYS[i + 1], t = (ph - a[0]) / ((b[0] - a[0]) || 1), s = t * t * (3 - 2 * t);
    dome.material.color.copy(C(a[1], b[1], s)); dome.material.opacity = L(a[2], b[2], s); dome.visible = dome.material.opacity > 0.01;
    if (scene.fog) { scene.fog.color.copy(C(a[3], b[3], s)); scene.fog.density = L(a[4], b[4], s); }
    if (hemi) { hemi.color.copy(C(a[5], b[5], s)); hemi.intensity = L(a[6], b[6], s); }
    if (sun) { sun.color.copy(C(a[7], b[7], s)); sun.intensity = L(a[8], b[8], s); }
    renderer.toneMappingExposure = L(a[9], b[9], s); window.__daytime = +ph.toFixed(3);
  };
  step(); let id = 0; const go = () => { clearInterval(id); id = setInterval(step, document.body.classList.contains('lw') ? 2000 : 250); };
  go(); new MutationObserver(go).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  return { step };
}
