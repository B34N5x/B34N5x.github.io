// Step 7: look polish only (no new features). Original code (MIT).
// Room warm-white regrade + lamp pool + flickering window neon, street readability
// (puddles, steam, window glow variety, lamp pools, haze shafts, bigger cat), animated arcade attract screens.
import * as THREE from './lib/three.module.js';

const ctex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const radial = (stops) => ctex(128, 128, (q) => { const g = q.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([a, c]) => g.addColorStop(a, c)); q.fillStyle = g; q.fillRect(0, 0, 128, 128); });
const add = (o = {}) => new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, ...o });

export function buildWorld7(scene, { FLOOR }) {
  const anim = [], U = 3.7; let rainTick = null;
  const inRoom = p => p.x > -5.9 && p.x < 2.6 && p.z > 20.2 && p.z < 29.8 && p.y > U - 0.1 && p.y < 7.5;

  // ---------- 1) apartment room ----------
  // regrade room materials once the Kenney furniture has loaded: no pink/magenta casts, warm whites, honest wood.
  const regrade = () => {
    const hsl = {}, wp = new THREE.Vector3();
    scene.traverse(o => {
      if (!o.isMesh || o.userData.g7) return; o.getWorldPosition(wp); if (!inRoom(wp)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      o.material = mats.map(m => {
        if (!m.isMeshStandardMaterial) return m; m = m.clone(); m.color.getHSL(hsl);
        // pull pink/magenta/lilac hues to warm neutral; keep wood oranges
        if (hsl.h > 0.75 || hsl.h < 0.03) { hsl.h = 0.08; hsl.s *= 0.35; }
        else if (hsl.h < 0.13) { hsl.s = Math.min(hsl.s, 0.55); }
        else hsl.s *= 0.7;
        m.color.setHSL(hsl.h, hsl.s, Math.min(hsl.l, 0.82));
        if (m.map && Math.abs(wp.y - U) > 0.2) m.color.multiply(new THREE.Color(0.9, 0.88, 0.95)); // peach plaster -> warm white
        if (m.emissive) m.emissive.setRGB(0, 0, 0);
        m.roughness = Math.max(m.roughness, 0.6); m.metalness = Math.min(m.metalness, 0.1); m.envMapIntensity = 0.4;
        return m;
      });
      if (o.material.length === 1) o.material = o.material[0]; o.userData.g7 = true;
    });
  };
  setTimeout(regrade, 3500); setTimeout(regrade, 7000);
  // sofa: warm oatmeal fabric (Kenney loungeSofa sits at -1.7, 24.0)
  setTimeout(() => { const wp = new THREE.Vector3(); scene.traverse(o => { if (!o.isMesh) return; o.getWorldPosition(wp); if (wp.y > U - 0.1 && wp.y < U + 1.4 && Math.abs(wp.x + 1.7) < 1.4 && Math.abs(wp.z - 24.0) < 0.7) { o.material = o.material.clone(); o.material.color.set(0x8a7a66); o.material.roughness = 0.95; } }); }, 7200);
  // visible lamp: glowing shade + bulb + warm pool on the floor
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.34, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffc27a, toneMapped: false, side: THREE.DoubleSide }));
  shade.position.set(-3.2, U + 1.55, 26.1); scene.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff0c0, toneMapped: false })); bulb.position.copy(shade.position); scene.add(bulb);
  const lampL = new THREE.PointLight(0xffb46a, 6, 7, 1.8); lampL.position.set(-3.2, U + 1.45, 26.1); scene.add(lampL);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), add({ map: radial([[0, 'rgba(255,170,90,0.35)'], [0.5, 'rgba(255,140,60,0.18)'], [1, 'rgba(0,0,0,0)']]) }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(-3.0, U + 0.025, 26.0); scene.add(pool);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial([[0, 'rgba(255,200,130,0.7)'], [1, 'rgba(0,0,0,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  halo.scale.setScalar(1.6); halo.position.copy(shade.position); scene.add(halo);
  // window neon: a projecting sign just outside the upstairs window (x -4.4..-1.4, y 4.9..6.7, wall z 20)
  const neonTex = ctex(128, 512, (q, w, h) => { q.fillStyle = '#0a0612'; q.fillRect(0, 0, w, h); q.strokeStyle = '#ff3df0'; q.lineWidth = 8; q.shadowColor = '#ff3df0'; q.shadowBlur = 18; q.strokeRect(10, 10, w - 20, h - 20);
    q.fillStyle = '#7ff8ff'; q.shadowColor = '#22f0ff'; q.font = '900 70px system-ui'; q.textAlign = 'center'; 'NOODLE'.split('').forEach((c, i) => q.fillText(c, w / 2, 90 + i * 74)); });
  const neonM = new THREE.MeshBasicMaterial({ map: neonTex, toneMapped: false });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.8), neonM); sign.position.set(-2.9, 5.9, 17.6); scene.add(sign); const signB = sign.clone(); signB.rotation.y = Math.PI; signB.position.z -= 0.01; scene.add(signB);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.4), new THREE.MeshStandardMaterial({ color: 0x222228, metalness: 0.8, roughness: 0.4 })); bracket.position.set(-2.9, 7.35, 18.8); scene.add(bracket);
  const neonIn = new THREE.PointLight(0xff3df0, 3, 6, 1.8); neonIn.position.set(-2.9, U + 2.2, 21.0); scene.add(neonIn);
  const neonCy = new THREE.PointLight(0x22f0ff, 3, 6, 1.8); neonCy.position.set(-2.2, U + 1.6, 21.2); scene.add(neonCy);
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.8), add({ map: ctex(64, 64, (q) => { const r = q.createLinearGradient(0, 0, 0, 64); r.addColorStop(0, 'rgba(255,80,240,0.8)'); r.addColorStop(0.6, 'rgba(60,220,255,0.35)'); r.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = r; q.fillRect(4, 0, 56, 64); q.fillStyle = '#000'; q.fillRect(30, 0, 4, 64); }), opacity: 0.6 }));
  spill.rotation.x = -Math.PI / 2; spill.position.set(-2.9, U + 0.03, 21.8); scene.add(spill);
  anim.push(t => { // irregular neon flicker (stutter now and then)
    const s = Math.sin(t * 37) * Math.sin(t * 5.3), off = (t % 6.5 > 5.9 && s > 0.2) ? 0.15 : 1, f = off * (0.88 + 0.12 * Math.sin(t * 22));
    neonM.color.setScalar(f * 1.4); neonIn.intensity = 3 * f; neonCy.intensity = 3 * f; spill.material.opacity = 0.6 * f; });

  // ---------- 2) street ----------
  // lamp light pools + soft haze shafts under each street lamp (world6 lamp list)
  const poolT = radial([[0, 'rgba(255,190,120,0.2)'], [0.6, 'rgba(255,150,80,0.05)'], [1, 'rgba(0,0,0,0)']]);
  const shaftT = ctex(64, 128, (q, w, h) => { for (let y = 0; y < h; y++) { const v = y / h, half = 6 + v * 26, a = 0.28 * (1 - v * 0.8); const g = q.createLinearGradient(32 - half, 0, 32 + half, 0); g.addColorStop(0, 'rgba(255,200,140,0)'); g.addColorStop(0.5, `rgba(255,200,140,${a})`); g.addColorStop(1, 'rgba(255,200,140,0)'); q.fillStyle = g; q.fillRect(0, y, w, 1); } });
  const shaftM = add({ map: shaftT, side: THREE.DoubleSide, opacity: 0.5 });
  [[-9, -12], [9, -11], [13, -8], [13, 8], [-8, 17], [8, 17]].forEach(([x, z]) => { const lx = x * 0.92, lz = z * 0.92;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), add({ map: poolT })); p.rotation.x = -Math.PI / 2; p.position.set(lx, FLOOR + 0.03, lz); scene.add(p);
    for (let k = 0; k < 2; k++) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.8), shaftM); sh.position.set(lx, FLOOR + 2.5, lz); sh.rotation.y = k * Math.PI / 2; scene.add(sh); }
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial([[0, 'rgba(255,220,160,0.8)'], [1, 'rgba(0,0,0,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); h.scale.setScalar(1.3); h.position.set(lx, 5.05, lz); scene.add(h); });
  anim.push(t => { shaftM.opacity = 0.42 + Math.sin(t * 0.6) * 0.08; });
  // stronger puddles: brighter mirror + neon/lamp colour streaks drawn into extra reflective patches
  setTimeout(() => scene.traverse(o => { const m = o.material; if (o.isMesh && m && m.isMeshStandardMaterial && m.alphaMap && m.metalness === 1 && m.roughness < 0.05) { m.envMapIntensity = 4.5; m.color.set(0x2a2a3a); o.scale.multiplyScalar(1.25); } }), 1500);
  const streak = ctex(128, 256, (q, w, h) => { [['255,61,240', 30], ['34,240,255', 70], ['255,180,100', 100]].forEach(([c, x]) => { const g = q.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.5, `rgba(${c},0.55)`); g.addColorStop(1, `rgba(${c},0)`); q.fillStyle = g; q.fillRect(x - 6, 0, 12, h); }); });
  const streakM = add({ map: streak, opacity: 0.55 });
  [[-6, -6], [5, 9], [9, -4], [-10, 10], [1, -10.3]].forEach(([x, z], i) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.2), streakM); s.rotation.set(-Math.PI / 2, 0, Math.atan2(x, z)); s.position.set(x, FLOOR + 0.025, z); scene.add(s); });
  anim.push(t => { streakM.opacity = 0.45 + Math.sin(t * 1.3) * 0.1; });
  // roof-vent steam: denser, bigger, lit plume on the arcade roof vent (4.9, 5.4, -18.6) and the street grate
  const puff = radial([[0, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
  const sp = []; [[4.9, 5.4, -18.6, 1.0], [-8.6, 0.1, -16.5, 0.7]].forEach(([x, y, z, k]) => { for (let i = 0; i < 18; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: 0xe8dcf0, transparent: true, depthWrite: false, opacity: 0, fog: false })); scene.add(s); sp.push({ s, x, y, z, k, ph: i / 18 * 5 }); } });
  anim.push(t => sp.forEach(({ s, x, y, z, k, ph }) => { const u = ((t + ph) % 5) / 5; s.position.set(x + Math.sin(t * 0.8 + ph * 2) * 0.5 * u + u * 0.8, y + u * 4.2, z + u * 0.6); s.scale.setScalar((0.8 + u * 2.6) * k); s.material.opacity = Math.sin(u * Math.PI) * 0.55 * k; }));
  // (facade window-pane overlay tried and removed: Kenney buildings share one colormap, so panes floated off the facades)
  // bigger cat on the ESCROW PALACE ledge (world6 places it at -3.2, 3.98, ~19.9)
  setTimeout(() => scene.traverse(o => { if (o.isGroup && Math.abs(o.position.x + 3.2) < 0.01 && Math.abs(o.position.y - 3.98) < 0.01) { o.scale.setScalar(1.7); o.position.y = 4.05; } }), 500);



  // ---------- light-bridge walkway veins: additive overlay on the plaza (original shader, muted teal/indigo/violet) ----------
  const veinM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform float t; varying vec2 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){ vec2 p = vP*0.55; vec2 c = floor(p), f = fract(p);
        // circuit veins: cell-aligned traces that turn per cell, plus pads at junctions
        float r = h(c), lx = smoothstep(0.06,0.0,abs(f.y-0.5)) * step(r,0.55), ly = smoothstep(0.06,0.0,abs(f.x-0.5)) * step(0.35,r);
        float pad = smoothstep(0.14,0.08,length(f-0.5));
        float d = length(vP), flow = pow(0.5+0.5*sin(d*0.9 - t*0.8 + r*6.28), 6.0);
        float shim = 0.5+0.5*sin(vP.x*1.3 + sin(vP.y*0.9 + t*0.35)*2.0 + t*0.25); // inner refractive shimmer
        vec3 teal = vec3(0.10,0.42,0.46), indigo = vec3(0.18,0.20,0.52), violet = vec3(0.34,0.20,0.48);
        vec3 col = mix(mix(teal, indigo, shim), violet, 0.5+0.5*sin(d*0.15 - t*0.2));
        float edge = smoothstep(15.6, 13.5, d);
        float a = (max(lx,ly)*(0.35+0.9*flow) + pad*0.6*flow + shim*0.08) * edge;
        gl_FragColor = vec4(col*a, a); }` });
  const vein = new THREE.Mesh(new THREE.CircleGeometry(15.6, 96), veinM); vein.rotation.x = -Math.PI / 2; vein.position.y = FLOOR + 0.006; vein.renderOrder = 1; scene.add(vein);
  anim.push(t => { veinM.uniforms.t.value = t; });

  // ---------- digital rain glyph streams (outdoor plaza only, walk-through, fade around the player) ----------
  const glyphT = ctex(64, 512, (q, w, h) => { q.fillStyle = '#000'; q.fillRect(0, 0, w, h); q.font = '700 30px monospace'; q.textAlign = 'center'; const G = '01ABCDEF#$%&+=<>XRPL';
    for (let y = 0; y < h; y += 32) { q.fillStyle = `rgba(160,255,255,${0.4 + Math.random() * 0.6})`; q.fillText(G[Math.floor(Math.random() * G.length)], w / 2, y + 26); } });
  glyphT.wrapS = glyphT.wrapT = THREE.RepeatWrapping;
  const rainM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { map: { value: glyphT }, t: { value: 0 }, pl: { value: new THREE.Vector3(0, -99, 0) } },
    vertexShader: `attribute vec4 inf; varying vec2 vU; varying float vA, vS, vP; varying vec3 vW; uniform vec3 pl;
      void main(){ vU = uv; vS = inf.x; vP = inf.y; vA = inf.z; vec4 w = instanceMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D map; uniform float t; uniform vec3 pl; varying vec2 vU; varying float vA, vS, vP; varying vec3 vW;
      void main(){ float y = vU.y*4.0 + t*vS + vP; float g = texture2D(map, vec2(vU.x, y)).r;
        float head = fract(-(t*vS*0.25 + vP)); float trail = 0.35 + 0.65*smoothstep(0.0, 0.6, 1.0 - fract(vU.y - head)); float edge = smoothstep(0.0,0.25,vU.x)*smoothstep(1.0,0.75,vU.x);
        float d = length(vW.xz - pl.xz); float near = smoothstep(0.6, 2.6, d);
        float a = g * trail * edge * vA * near * smoothstep(0.0,0.1,vU.y) * smoothstep(1.0,0.85,vU.y);
        gl_FragColor = vec4(vec3(0.4,1.0,1.0)*a*3.4, a); }` });
  const RN = 8, rainG = new THREE.PlaneGeometry(0.5, 6); rainG.translate(0, 3, 0);
  const inf = new Float32Array(RN * 4); rainG.setAttribute('inf', new THREE.InstancedBufferAttribute(inf, 4));
  const rain = new THREE.InstancedMesh(rainG, rainM, RN); rain.frustumCulled = false; scene.add(rain);
  const outdoor = (x, z) => Math.hypot(x, z) < 10.5 && !(z < -11.5) && !(x > 13.5) && !(z > 15);
  const R = Array.from({ length: RN }, (_, i) => ({ x: 0, z: 0, life: 0, born: -i * 1.7 - 1, sp: 0 }));
  const spawn = (r, t) => { let x, z; do { x = (Math.random() * 2 - 1) * 10; z = (Math.random() * 2 - 1) * 10; } while (!outdoor(x, z)); r.x = x; r.z = z; r.born = t + Math.random() * 2.5; r.life = 5 + Math.random() * 7; r.sp = Math.random() < 0.3 ? 2.2 + Math.random() : 0.5 + Math.random() * 0.6; };
  R.forEach(r => spawn(r, Math.random() * 4 - 4));
  const dm = new THREE.Object3D();
  let pin = null;
  rainTick = (t, cam) => { if (pin) { const r = R[0]; r.x = pin[0]; r.z = pin[1]; r.born = Math.min(r.born, t - 2); r.life = 1e9; r.sp = 1.6; } rainM.uniforms.t.value = t; if (cam) rainM.uniforms.pl.value.copy(cam.position);
    R.forEach((r, i) => { if (t > r.born + r.life) spawn(r, t); const age = t - r.born, fade = age < 0 ? 0 : Math.min(1, age / 1.2, (r.life - age) / 1.2);
      dm.position.set(r.x, FLOOR, r.z); dm.rotation.set(0, cam ? Math.atan2(cam.position.x - r.x, cam.position.z - r.z) : 0, 0); dm.updateMatrix(); rain.setMatrixAt(i, dm.matrix);
      inf[i * 4] = r.sp; inf[i * 4 + 1] = i * 0.37; inf[i * 4 + 2] = Math.max(0, fade) * 1.0; });
    rain.instanceMatrix.needsUpdate = true; rainG.attributes.inf.needsUpdate = true; };

  // ---------- 3) arcade attract modes ----------
  const screens = [];
  scene.traverse(o => { if (o.isMesh && o.geometry?.parameters?.width === 0.95 && o.geometry.parameters.height === 0.7 && o.material?.map) screens.push(o); });
  screens.forEach((o, i) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 192; const q = c.getContext('2d'), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    let src = o.material.map; o.material.map = tex; o.material.color.setScalar(1.5); o.material.needsUpdate = true;
    const stars = Array.from({ length: 40 }, (_, k) => [Math.random() * 256, Math.random() * 192, 0.5 + Math.random() * 2]);
    screens[i] = { o, draw: (t) => {
      const m = o.material.map; if (m !== tex) { src = m; o.material.map = tex; } // locked->unlocked swaps keep the attract layer
      q.fillStyle = '#04020c'; q.fillRect(0, 0, 256, 192);
      stars.forEach(s => { s[1] = (s[1] + s[2]) % 192; q.fillStyle = `rgba(255,255,255,${0.3 + s[2] / 3})`; q.fillRect(s[0], s[1], 2, 2); });
      const hue = (i * 60 + t * 40) % 360, mode = i % 3;
      if (mode === 0) for (let k = 0; k < 6; k++) { const x = 40 + k * 32 + Math.sin(t * 2 + k) * 14, y = 150 + Math.cos(t * 3 + k) * 6; q.fillStyle = `hsl(${(hue + k * 30) % 360},100%,60%)`; q.fillRect(x, y - 30 - (k % 2) * 14, 14, 10); }
      else if (mode === 1) { const x = 128 + Math.sin(t * 2.2) * 80; q.fillStyle = '#ffd23d'; q.fillRect(x - 10, 150, 20, 26); q.fillStyle = '#22f0ff'; q.fillRect(256 - x - 10, 150, 20, 26); q.fillStyle = `hsl(${hue},100%,60%)`; q.fillRect(118, 140 + Math.sin(t * 9) * 4, 20, 4); }
      else { q.strokeStyle = `hsl(${hue},100%,60%)`; q.lineWidth = 3; for (let k = 0; k < 5; k++) { const r = ((t * 40 + k * 22) % 110); q.strokeRect(128 - r, 110 - r * 0.6, r * 2, r * 1.2); } }
      if (src?.image) { q.globalAlpha = 0.9; q.globalCompositeOperation = 'lighter'; q.drawImage(src.image, 0, 0, 256, 192); q.globalCompositeOperation = 'source-over'; q.globalAlpha = 1; }
      if (Math.floor(t * 2) % 2) { q.fillStyle = '#fff'; q.font = '700 16px monospace'; q.textAlign = 'center'; q.fillText('INSERT TOKEN', 128, 182); }
      q.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < 192; y += 3) q.fillRect(0, y, 256, 1);
      tex.needsUpdate = true; } };
  });
  let last = 0; anim.push(t => { if (t - last < 1 / 20) return; last = t; screens.forEach(s => s.draw(t)); });

  return { pinRain: (x, z) => { pin = [x, z]; }, update: (t, cam) => { anim.forEach(f => f(t)); rainTick && rainTick(t, cam); } };
}
