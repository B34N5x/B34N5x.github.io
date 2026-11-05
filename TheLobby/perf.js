// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// v17 manual Lightweight mode (Settings toggle, off by default). Memory only; no auto-detection.
import * as THREE from './lib/three.module.js';
export function initPerf({ renderer, bloom, scene, sun }) {
  const S = { low: false }, hiPR = renderer.getPixelRatio();
  const lights = () => { const L = []; scene.traverse(o => { if (o.isPointLight) L.push(o); }); return L; };
  S.apply = low => { S.low = low; document.body.classList.toggle("lw", !!low); renderer.setPixelRatio(low ? 1 : hiPR);
    bloom.enabled = !low; renderer.shadowMap.type = low ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    const ms = low ? 512 : 1024; if (sun.shadow.mapSize.x !== ms) { sun.shadow.mapSize.set(ms, ms); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    const L = lights().sort((a, b) => b.intensity * b.distance - a.intensity * a.distance); L.forEach((l, i) => { if (l.userData.v0 == null) l.userData.v0 = l.visible; l.visible = low ? (i < 4 && l.userData.v0) : l.userData.v0; });
    renderer.setSize(innerWidth, innerHeight); window.dispatchEvent(new Event('resize')); S.onchange && S.onchange(low); };
  // envpass.js listens onchange for fake-bloom / grade

  window.__perf = S; return S;
}
