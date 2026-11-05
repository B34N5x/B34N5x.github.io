// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
import { initDayCycle } from './daycycle.js?v=5';
import { addComingSoon } from "./comingsoon.js?v=2";
import { traitsFromSpec, toQuery } from './traitfx.js';
// reload = clean state: drop any old persisted skin/collection keys
try { ['ledgerSkin', 'ledgerCollection'].forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); }); } catch (e) { /* storage blocked */ }
// B34N5 Lobby - step 1b. Soft modern plaza + "Default Ledger Player" avatar.
import * as THREE from './lib/three.module.js';
import * as tp from './touchpad.js?v=10';
import { RoundedBoxGeometry } from './lib/addons/geometries/RoundedBoxGeometry.js';

import { EffectComposer } from './lib/addons/postprocessing/EffectComposer.js';
import { RenderPass } from './lib/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './lib/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './lib/addons/postprocessing/OutputPass.js';
import { showPrompt, trackLabel, buildRestroom, polishTick, buildEggs, cosmicSky, buildLounge, buildAiNote } from './polish.js?v=6';
import { buildProps, interactables, openNews, isNewsOpen } from './props.js';
import { readTraits, loadTraitMap, mergeProfile } from './traits.js?v=34';
import { buildAvatar } from './avatar3d.js?v=50';
import { setupMoves } from './moves.js?v=8';
import { setupAbilities } from './abilities.js?v=11';
import { makeBoundary } from './boundary.js?v=2';
import { setTVHandler, collections, holderCollections, registryReady } from './world3.js';
import { buildWorld4, buildEasterEggs, pbr } from './world4.js';
import { buildWorld6, toggleAmbient } from './world6.js';
import { buildWorld7 } from './world7.js';
import { load as arcadeLoad, exportSave, importSave } from './arcade.js';
import { CharacterController, FollowCam, PuffPool } from './controller.js';
import { buildWorld3, collideBoxes, aptFloor, inApt, inLot, flattenMask, isGalleryOpen, APT } from './world3.js';
import { initHudMenus } from './hudmenus.js?v=9';

import { initPerf } from './perf.js?v=3';
import { applyDuskGrade, weatherFacades, scatterStreetProps, installCheapAtmosphere, createImpactFeel, ensureBlobShadow, propsClearPaths, drawCallBudget } from './envpass.js?v=4';
import { installLobbyLife } from './npclife.js?v=3';
import { buildAmbientWaves, tickAmbient, motionScale } from './motion.js?v=1';
import { installLoader, installVignette, installSfx, setSfxEnabled, tickFeel, polishJoystick } from './unityfeel.js?v=2';
installLoader();
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.25 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2; // step 7: balanced dusk (1.6 washed interiors out)
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x4a3a56, 0.012);
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 170); // v17: far plane trimmed; FogExp2 hides the edge

// Dusk/night sky gradient: deep indigo -> magenta horizon
const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'varying vec3 vP; void main(){ float h = clamp(vP.y*2.0,0.0,1.0); vec3 c = mix(vec3(0.42,0.36,0.52), mix(vec3(0.16,0.22,0.36), vec3(0.05,0.06,0.16), h), smoothstep(0.0,0.5,h)); c += vec3(0.10,0.06,0.10)*exp(-h*8.0); /* step 7: calm indigo/teal/violet dusk */ gl_FragColor = vec4(c,1.0); }'
}));
scene.add(sky); if (!new URLSearchParams(location.search).get('oldsky')) cosmicSky(sky, scene);
// Stars
{ const n = 600, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) * 0.9 + 0.1; v.normalize().multiplyScalar(280); p.set([v.x, v.y, v.z], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, fog: false }))); }

const hemi = new THREE.HemisphereLight(0xc8cde0, 0x7a6450, 1.9); scene.add(hemi); // warmer, brighter fill (v34: driven by daycycle.js)
const sun = new THREE.DirectionalLight(0xffb88a, 1.5);
sun.position.set(-30, 40, -20); sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, far: 150 });
sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0005;
scene.add(sun);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3, ...extra });
const neon = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
const shade = o => { o.castShadow = o.receiveShadow = true; return o; };
const CYAN = 0x22f0ff, MAG = 0xff3df0;

// ---- Rolling dark ground with glowing grid (shader) ----
const PLAZA_R = 16;
function groundH(x, z) {
  const r = Math.hypot(x, z);
  const hills = Math.sin(x * 0.08) * Math.cos(z * 0.07) * 2.2 + Math.sin(x * 0.03 + z * 0.05) * 2.5;
  const t = THREE.MathUtils.smoothstep(r, PLAZA_R + 2, PLAZA_R + 18);
  return (hills * t + 0.6 * t) * (1 - flattenMask(x, z));
}
const gGeo = new THREE.PlaneGeometry(240, 240, 160, 160); gGeo.rotateX(-Math.PI / 2);
const gp = gGeo.attributes.position;
for (let i = 0; i < gp.count; i++) gp.setY(i, groundH(gp.getX(i), gp.getZ(i)));
gGeo.computeVertexNormals();
const gridMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: 'varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vN = normal; gl_Position = projectionMatrix*viewMatrix*w; }',
  fragmentShader: `uniform float uTime; varying vec3 vW; varying vec3 vN;
    float line(float v, float w){ float f = abs(fract(v)-0.5); return smoothstep(0.5-w, 0.5, f); }
    void main(){
      vec2 g = vW.xz/3.0; float l = max(line(g.x,0.03), line(g.y,0.03));
      float d = length(vW.xz); float pulse = 0.5+0.5*sin(d*0.25 - uTime*1.5);
      vec3 grid = mix(vec3(0.13,0.94,1.0), vec3(1.0,0.24,0.94), smoothstep(-1.0,4.0,vW.y));
      vec3 base = vec3(0.07,0.06,0.09) + vec3(0.05,0.04,0.07)*max(vN.y,0.0);
      // wet asphalt: puddles reflect warm window light + neon
      vec2 q = vW.xz*0.18; float n = sin(q.x*1.7+sin(q.y*1.3))*sin(q.y*1.9+sin(q.x*0.7)) + 0.5*sin(q.x*3.1+q.y*2.3);
      float puddle = smoothstep(0.35, 0.6, n);
      float streak = pow(0.5+0.5*sin(vW.x*0.9 + sin(vW.z*0.15)*2.0), 6.0);
      vec3 refl = mix(vec3(1.0,0.55,0.2), vec3(0.15,0.85,1.0), 0.5+0.5*sin(vW.x*0.07+vW.z*0.05)) * (0.12 + 0.35*streak);
      base = mix(base, vec3(0.05,0.05,0.09) + refl, puddle*0.85);
      float fade = exp(-d*0.012);
      vec3 c = base + grid * l * (0.18+0.25*pulse) * fade * (1.0-puddle*0.6);
      c = mix(c, vec3(0.23,0.14,0.25), 1.0-exp(-pow(d*0.016,2.0)));
      gl_FragColor = vec4(c,1.0); }`
});
// step 5: CC0 ambientCG wet asphalt replaces the neon-grid shader (gridMat kept only for its time uniform)
const ground = new THREE.Mesh(gGeo, pbr('Asphalt025C', 60, { color: 0x9a90a0, roughness: 0.55, envMapIntensity: 1.4 })); ground.receiveShadow = true; scene.add(ground);

// Plaza: dark glossy disc, neon rim, holographic floor rings
const prof = [new THREE.Vector2(0, 0.35), new THREE.Vector2(PLAZA_R - 0.6, 0.35), new THREE.Vector2(PLAZA_R - 0.15, 0.25),
  new THREE.Vector2(PLAZA_R, 0.05), new THREE.Vector2(PLAZA_R + 0.1, -0.3)];
const tileTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#8a7f96'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 120 + Math.random() * 40 | 0; g.fillStyle = `rgb(${v + 10},${v},${v + 20})`; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); } });
tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.repeat.set(10, 10);
// simple neon dusk environment for wet reflections (made in code)
{ const envTex = canvasTex(256, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a1438'); gr.addColorStop(0.5, '#5a5a8a'); gr.addColorStop(0.55, '#1e2238'); gr.addColorStop(1, '#201018'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.fillStyle = ['#ffb060', '#22f0ff', '#ff3df0', '#ffd8a0'][i % 4]; g.fillRect(Math.random() * w, h * 0.38 + Math.random() * h * 0.14, 3, 4); } });
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(envTex).texture; scene.environmentIntensity = 0.5; }
const plaza = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), new THREE.MeshPhysicalMaterial({ color: 0x0a0e1c, roughness: 0.12, metalness: 0.15, clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 0.7, side: THREE.BackSide /* step 7: dark glassy light-bridge walkway */ }));
plaza.receiveShadow = true; scene.add(plaza);
const rim = new THREE.Mesh(new THREE.TorusGeometry(PLAZA_R - 0.35, 0.08, 8, 128), neon(CYAN));
rim.rotation.x = Math.PI / 2; rim.position.y = 0.37; scene.add(rim);
const holoRings = [];
[[3, MAG], [6, CYAN], [9.5, MAG], [13, CYAN]].forEach(([r, c], k) => {
  const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.06, r + 0.06, 128, 1, 0, Math.PI * (1.2 + k * 0.2)),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.38 + k * 0.002; scene.add(ring); holoRings.push(ring);
});
const FLOOR = 0.35;
const colliders = [], towerPts = [], portalPts = [];

// ---- Canvas textures made in code ----
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const winTex = canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  for (let y = 6; y < h; y += 12) for (let x = 4; x < w; x += 10) if (Math.random() < 0.35) {
    g.fillStyle = Math.random() < 0.5 ? '#3ff0ff' : (Math.random() < 0.5 ? '#ff5cf0' : '#ffe6a0'); g.fillRect(x, y, 5, 4);
  }
});
winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
const glyphs = ['LEDGER', 'NOODLE', '◇◈◇', 'XRPL//', '0x1F ◢◤', 'NODE 11'];
function billboard(text, col) {
  const tex = canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = 'rgba(10,0,30,0.35)'; g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, 40); g.fill();
    g.strokeStyle = col; g.lineWidth = 6; g.stroke();
    g.fillStyle = col; g.font = '700 84px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
    g.fillStyle = 'rgba(255,255,255,0.08)'; for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 2);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(6, 1.9), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
}

// ---- Sleek rounded dark towers (moved back, slimmer) ----
const billboards = [];
[[-56, -48, 13, 2.3], [50, -56, 16, 2.6], [-60, 40, 10, 2], [58, 46, 14, 2.4], [0, -74, 19, 3], [-16, 66, 11, 2.2]].forEach(([x, z, h, r], k) => {
  const g = new THREE.Group();
  const wt = winTex.clone(); wt.needsUpdate = true; wt.repeat.set(3, h / 6);
  g.add(shade(new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0x14122a, roughness: 0.3, metalness: 0.7, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: 0.9 }))));
  const edgeC = k % 2 ? MAG : CYAN;
  for (let s = 0; s < 4; s++) { // neon edge strips
    const a = s * Math.PI / 2 + Math.PI / 4;
    const strip = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, h, 4, 8), neon(edgeC));
    strip.position.set(Math.cos(a) * r * 1.01, 0, Math.sin(a) * r * 1.01); g.add(strip);
  }
  const crown = new THREE.Mesh(new THREE.TorusGeometry(r * 0.7, 0.1, 8, 48), neon(edgeC)); crown.rotation.x = Math.PI / 2; crown.position.y = h / 2 + r * 0.7; g.add(crown);
  const bb = billboard(glyphs[k], k % 2 ? '#ff6af3' : '#4ff6ff'); bb.position.set(0, h * 0.15, 0); g.add(bb); billboards.push({ m: bb, r: r + 2.2, k });
  g.position.set(x, groundH(x, z) + h / 2 + r - 0.5, z); scene.add(g);
  colliders.push({ x, z, r: r + 0.3 }); towerPts.push([x, z]);
});

// ---- Dense apartment blocks (warm windows, balconies, AC units, signage, cables) ----
const aptWin = canvasTex(128, 256, (g, w, h) => {
  const grd = g.createLinearGradient(0, h, 0, 0); grd.addColorStop(0, '#3a1e14'); grd.addColorStop(0.35, '#120c14'); grd.addColorStop(1, '#08070c');
  g.fillStyle = grd; g.fillRect(0, 0, w, h); // baked light spill from street at the bottom
  for (let y = 8; y < h - 4; y += 16) for (let x = 6; x < w - 6; x += 20) {
    const r = Math.random(); if (r < 0.45) continue;
    g.fillStyle = r < 0.85 ? (Math.random() < 0.5 ? '#ffb15c' : '#ffd29a') : (Math.random() < 0.5 ? '#3ff0ff' : '#ff6af3');
    g.fillRect(x, y, 12, 9); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 5, y, 2, 9);
  }
});
aptWin.wrapS = aptWin.wrapT = THREE.RepeatWrapping;
const concrete = [0x3b3340, 0x40363a, 0x353446, 0x463a3a];
const balM = mat(0x2a2430, { roughness: 0.8, metalness: 0.2 }), acM = mat(0x8a8a90, { roughness: 0.6 });
const signTxt = ['LEDGER 24h', 'NOODLE BAR', 'NODE CAFE', '◇ DATA ◇', 'XRPL//BAR', 'PIXEL INN'];
const aptTops = [], blocks = [];
const cableM = new THREE.MeshBasicMaterial({ color: 0x0c0a10 });
for (let k = 0; k < 16; k++) {
  if (k === 3) continue; // lot used by the enterable apartment (step 3)
  const a = (k / 16) * Math.PI * 2 + 0.2, dist = 42 + (k % 3) * 8; // preview: space buildings further from plaza
  const x = Math.cos(a) * dist, z = Math.sin(a) * dist, w = 8 + (k % 2) * 3, dpt = 7, h = 14 + ((k * 7) % 5) * 3;
  const y0 = groundH(x, z) - 0.5;
  const g = new THREE.Group(); g.position.set(x, y0, z); g.lookAt(0, y0, 0);
  const wt = aptWin.clone(); wt.needsUpdate = true; wt.repeat.set(w / 8, h / 14); wt.offset.set(Math.random(), Math.random());
  const b = shade(new THREE.Mesh(new RoundedBoxGeometry(w, h, dpt, 3, 0.6),
    new THREE.MeshStandardMaterial({ color: concrete[k % 4], roughness: 0.85, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: 1.0 })));
  b.position.y = h / 2; g.add(b);
  for (let fy = 3; fy < h - 2; fy += 3.5) for (let bx = -w / 2 + 1.8; bx < w / 2 - 1; bx += 3.4) {
    if (Math.random() < 0.45) { const bal = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.9, 0.9, 2, 0.15), balM); bal.position.set(bx, fy, dpt / 2 + 0.35); g.add(bal); }
    else if (Math.random() < 0.4) { const ac = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.6, 0.5, 2, 0.1), acM); ac.position.set(bx + 0.8, fy + 0.6, dpt / 2 + 0.25); g.add(ac); }
  }
  if (k % 2 === 0) { // vertical neon sign
    const sc = k % 4 ? '#ff6af3' : '#4ff6ff';
    const tex = canvasTex(96, 384, (q, W, H) => { q.fillStyle = 'rgba(10,0,20,0.8)'; q.beginPath(); q.roundRect(4, 4, W - 8, H - 8, 30); q.fill(); q.strokeStyle = sc; q.lineWidth = 5; q.stroke();
      q.fillStyle = sc; q.font = '700 40px system-ui'; q.textAlign = 'center'; [...signTxt[(k / 2) % 6]].slice(0, 8).forEach((ch, i) => q.fillText(ch, W / 2, 50 + i * 42)); });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 5.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
    sign.position.set(w / 2 - 0.8, 6 + (k % 3), dpt / 2 + 1.0); sign.rotation.y = Math.PI / 2; g.add(sign);
  }
  // warm street lamp glow spilling onto the wall (emissive bulb + baked glow quad)
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), neon(0xffa040)); bulb.position.set(-w / 4, 3.2, dpt / 2 + 0.6); g.add(bulb);
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: dotTexWarm(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
  spill.position.set(-w / 4, 3, dpt / 2 + 0.05); g.add(spill);
  scene.add(g); blocks.push({ g, w, h, d: dpt, k });
  colliders.push({ x, z, r: Math.max(w, dpt) / 2 + 0.3 });
  aptTops.push(new THREE.Vector3(x, y0 + h * 0.75, z));
}
function dotTexWarm() {
  return dotTexWarm.t || (dotTexWarm.t = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,170,90,0.9)'); r.addColorStop(1, 'rgba(255,120,60,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }));
}
// sagging cables between neighbouring blocks
for (let k = 0; k < aptTops.length; k++) {
  const p0 = aptTops[k], p1 = aptTops[(k + 1) % aptTops.length], mid = p0.clone().lerp(p1, 0.5); mid.y -= 3;
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, mid, p1), 16, 0.04, 4), cableM));
}
// a few real warm lights, used sparingly, to bounce onto walls and the wet ground
[[22, 12], [28, -14], [-24, -14], [-20, 26], [0, -28], [20, -10], [-12, -10]].forEach(([x, z]) => { const L = new THREE.PointLight(0xffa870, 20, 22, 1.5); L.position.set(x, 4, z); scene.add(L); });

// step 5: hide procedural box shells; Kenney glTF buildings replace them (world4.js)
blocks.forEach(b => b.g.children.forEach(c => { if (c.geometry instanceof RoundedBoxGeometry) c.visible = false; }));
buildWorld4(scene, { blocks, groundH, FLOOR, colliders });
const eggs = buildEasterEggs(scene);
const world6 = buildWorld6(scene, { colliders, FLOOR });
const world3 = buildWorld3(scene, { blocks: [], colliders, groundH, canvasTex });
// Environment pass (Beans-approved): dusk grade, street props, weathering, cheap FX
applyDuskGrade({ scene, renderer, fogDensity: 0.014 });
const _envLow0 = !!(matchMedia('(pointer: coarse)').matches || (window.__perf && window.__perf.low));
weatherFacades(scene, blocks, { low: _envLow0 });
const envScatter = scatterStreetProps(scene, { blocks, groundH, FLOOR, low: _envLow0 });
const envAtmos = installCheapAtmosphere(scene, { low: _envLow0 });
envAtmos.setLow(_envLow0);
window.__envpass = { scatter: envScatter, atmos: envAtmos, propsClearPaths: () => propsClearPaths(envScatter.placed, blocks), drawCalls: () => drawCallBudget(scene, { low: !!(window.__perf && window.__perf.low) }) };


// ---- Floating data platforms ----
const islands = [];
[[-20, -30, 10], [26, 6, 12], [-28, 6, 14]].forEach(([x, z, y], k) => {
  const g = new THREE.Group();
  g.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.4, 6), mat(0x1a1733, { metalness: 0.8, roughness: 0.3 }))));
  const edge = new THREE.Mesh(new THREE.TorusGeometry(3, 0.06, 6, 6), neon(k % 2 ? MAG : CYAN)); edge.rotation.x = Math.PI / 2; edge.rotation.z = Math.PI / 6; edge.position.y = 0.21; g.add(edge);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), neon(k % 2 ? CYAN : MAG)); core.position.y = 1.6; g.add(core);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 1.2, 4, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = -2.2; g.add(beam);
  g.position.set(x, y, z); g.userData.core = core; scene.add(g); islands.push(g);
});

// ---- Glowing crystal trees ----
const crystals = [];
[].forEach(([x, z], k) => { // step 5: crystal trees removed
  const y = groundH(x, z), c = k % 2 ? MAG : CYAN;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 2, 8), mat(0x2a2445)); stem.position.set(x, y + 1, z);
  const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, transparent: true, opacity: 0.55, roughness: 0.1, flatShading: true }));
  cr.position.set(x, y + 3, z); cr.scale.y = 1.5;
  const coreC = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), neon(c)); coreC.position.copy(cr.position);
  scene.add(stem, cr, coreC); crystals.push(cr); colliders.push({ x, z, r: 0.9 });
});

// ---- Data particles drifting up ----
const PN = 500, pPos = new Float32Array(PN * 3);
for (let i = 0; i < PN; i++) pPos.set([(Math.random() - 0.5) * 90, Math.random() * 25, (Math.random() - 0.5) * 90], i * 3);
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const dotTex = canvasTex(32, 32, (g) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, '#fff'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); });
scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x7ff8ff, size: 0.25, map: dotTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));

// ---- Floating text labels ----
function label(text, color = '#7ff8ff') {
  const tex = canvasTex(512, 128, (g) => {
    g.fillStyle = 'rgba(12,6,30,0.75)'; g.beginPath(); g.roundRect(16, 20, 480, 88, 44); g.fill();
    g.strokeStyle = color; g.lineWidth = 4; g.stroke();
    g.fillStyle = color; g.font = '600 52px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  s.scale.set(3.6, 0.9, 1); return trackLabel(s);
}

// ---- Portals: neon rings with swirling energy ----
const swirlMats = [];
function swirl(col) {
  const m = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(col) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; uniform vec3 uCol; varying vec2 vUv;
      void main(){ vec2 p = vUv*2.0-1.0; float r = length(p); if(r>1.0) discard;
        float a = atan(p.y,p.x); float s = sin(a*4.0 + r*14.0 - uTime*4.0)*0.5+0.5;
        float s2 = sin(a*7.0 - r*9.0 + uTime*2.0)*0.5+0.5;
        vec3 c = uCol*(0.5+s*0.9) + vec3(1.0)*pow(s*s2,3.0)*0.8 + uCol*pow(1.0-r,2.0)*1.2;
        gl_FragColor = vec4(c, 0.85*smoothstep(1.0,0.85,r)); }`
  });
  swirlMats.push(m); return m;
}
// step 3b: portals removed; arcade cabinets + art frames live in props.js

// ---- Rounded kiosk ----
const kiosk = new THREE.Group();
const kBody = shade(new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.2, 8, 24), mat(0x1c1934, { metalness: 0.8, roughness: 0.25 }))); kBody.position.y = 1.05; kiosk.add(kBody);
const kTrim = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.03, 8, 48), neon(CYAN)); kTrim.rotation.x = Math.PI / 2; kTrim.position.y = 0.7; kiosk.add(kTrim);
const kScreen = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 8, 24), new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false }));
kScreen.rotation.z = Math.PI / 2; kScreen.scale.set(1, 1, 0.25); kScreen.position.set(0, 2.15, 0); kiosk.add(kScreen);
const kl = label('Kiosk'); kl.position.y = 3.2; kl.scale.set(2.4, 0.6, 1); kiosk.add(kl);
kiosk.position.set(5, FLOOR, 5); kiosk.lookAt(0, FLOOR, 0); scene.add(kiosk);
colliders.push({ x: 5, z: 5, r: 0.6 });
const targets = { shop: [0, -19], arcade: [-5.5, -26.3], fighter: [-3.3, -26.3], gallery: [20, 0], kiosk: [5, 5], apartment: [0, 26.5] };
buildProps(scene, { canvasTex, colliders, FLOOR, warpTo: u => warpTo(u) });
const world7 = buildWorld7(scene, { FLOOR });
setTVHandler(openNews);
if (new URLSearchParams(location.search).get('news')) openNews();

// ---- Default Ledger Player (cyber vinyl-toy) ----
const graphite = new THREE.MeshPhysicalMaterial({ color: 0x6a7090, roughness: 0.35, metalness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.2 });
const pearl = new THREE.MeshPhysicalMaterial({ color: 0xe6e8f2, roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.15, sheen: 0.5, sheenColor: new THREE.Color(0xff9cf5) });
const visorTex = canvasTex(64, 64, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 0; y < 64; y += 4) g.fillRect(0, y, 64, 2); });
visorTex.wrapS = visorTex.wrapT = THREE.RepeatWrapping; visorTex.repeat.set(6, 1);
const visorMat = new THREE.MeshBasicMaterial({ color: 0x6ffcff, map: visorTex, transparent: true, opacity: 0.4, depthWrite: false });
const chestMat = new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false });
const magTrim = neon(MAG), cyTrim = neon(CYAN);
const avatar = new THREE.Group(), rig = new THREE.Group(); avatar.add(rig);
const add = (geo, m, x, y, z, parent = rig) => { const o = shade(new THREE.Mesh(geo, m)); o.position.set(x, y, z); parent.add(o); return o; };
const body = add(new THREE.SphereGeometry(0.5, 40, 28), graphite, 0, 0.72, 0); body.scale.set(1, 1.05, 0.85);
const plate = add(new THREE.SphereGeometry(0.46, 40, 28, Math.PI * 0.75, Math.PI * 0.5, Math.PI * 0.25, Math.PI * 0.5), pearl, 0, 0.72, 0); plate.scale.set(1.03, 1.07, 0.88); // pearl chest panel
const belt = add(new THREE.TorusGeometry(0.5, 0.018, 8, 64), magTrim, 0, 0.55, 0); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.85, 1);
const head = add(new THREE.SphereGeometry(0.42, 40, 28), pearl, 0, 1.38, 0); head.scale.set(1.05, 0.95, 1);
const neck = add(new THREE.TorusGeometry(0.3, 0.02, 8, 48), cyTrim, 0, 1.03, 0); neck.rotation.x = Math.PI / 2;
// step 3: slim wrap-around visor band (not two eyes)
const visorBack = add(new THREE.CylinderGeometry(0.43, 0.43, 0.15, 48, 1, true, Math.PI - 1.25, 2.5), graphite, 0, 1.4, 0); visorBack.material = graphite;
const visor = add(new THREE.CylinderGeometry(0.445, 0.445, 0.065, 48, 1, true, Math.PI - 1.15, 2.3), visorMat, 0, 1.4, 0);
for (const sx of [-0.12, 0.12]) { const d = add(new THREE.SphereGeometry(0.045, 16, 12), neon(0xffffff), sx, 1.39, -0.41); d.castShadow = false; }
for (const s of [-1, 1]) { // ear-light nodes
  const ear = add(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 24), graphite, s * 0.44, 1.38, 0); ear.rotation.z = Math.PI / 2;
  add(new THREE.SphereGeometry(0.045, 12, 8), s < 0 ? cyTrim : magTrim, s * 0.48, 1.38, 0);
}
add(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 8), graphite, 0.12, 1.85, 0.05); // antenna
const antTip = add(new THREE.SphereGeometry(0.05, 12, 8), magTrim, 0.12, 1.99, 0.05);
const lineM = (pts) => { const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], 0))); return new THREE.TubeGeometry(c, 12, 0.014, 6); };
const chest = new THREE.Group(); chest.position.set(0, 0.78, -0.43); rig.add(chest);
[[[0, 0.18], [0, 0.0]], [[-0.22, 0.12], [-0.12, 0.08], [-0.08, -0.12]], [[0.22, 0.12], [0.12, 0.08], [0.08, -0.12]],
 [[-0.24, -0.02], [-0.14, -0.04], [-0.12, -0.18]], [[0.24, -0.02], [0.14, -0.04], [0.12, -0.18]]].forEach(pts => {
  chest.add(new THREE.Mesh(lineM(pts), chestMat));
  for (const p of [pts[0], pts[pts.length - 1]]) { const n = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), chestMat); n.position.set(p[0], p[1], 0); chest.add(n); }
});
const arms = [-1, 1].map(s => {
  const a = add(new THREE.CapsuleGeometry(0.11, 0.3, 8, 16), graphite, s * 0.52, 0.75, 0); a.rotation.z = s * 0.25;
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.015, 6, 24), s < 0 ? cyTrim : magTrim); cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.12; a.add(cuff);
  return a;
});
const legs = [-1, 1].map(s => { const l = add(new THREE.SphereGeometry(0.16, 24, 16), pearl, s * 0.2, 0.12, -0.03); l.scale.set(1, 0.75, 1.2); return l; });
scene.add(avatar);
rig.visible = false; // step 5: droid retired, replaced by the digital wisp below
// ---- Digital wisp (default avatar until a collection is picked) ----
// ~human height (core ~1.2 m up), translucent cyan orb + additive halo + cheap point-sprite trail.
const wisp = new THREE.Group(); avatar.add(wisp);
const wispCore = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 20), new THREE.MeshBasicMaterial({ color: 0xbffcff, toneMapped: false }));
const wispShell = new THREE.Mesh(new THREE.SphereGeometry(0.38, 32, 20), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
const haloTex = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(120,250,255,0.6)'); r.addColorStop(1, 'rgba(0,200,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
const wispHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0x7ff8ff, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
wispHalo.scale.set(1.3, 1.3, 1); wispHalo.material.opacity = 0.7;
const flame = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.9, 24, 1, true), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
flame.position.y = 0.55;
wisp.add(wispShell, wispCore, wispHalo, flame); wisp.position.y = 1.25;
const wispLight = new THREE.PointLight(0x7ff8ff, 1.5, 5, 2); wisp.add(wispLight);
// Soft ground contact under Drop wisp (fixes grey pixel blotch from unfiltered trail/points near floor)
const wispBlobTex = canvasTex(128, 128, g => {
  const r = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  r.addColorStop(0, 'rgba(8,12,22,0.35)'); r.addColorStop(0.4, 'rgba(8,12,22,0.16)'); r.addColorStop(1, 'rgba(8,12,22,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
});
wispBlobTex.minFilter = THREE.LinearFilter; wispBlobTex.magFilter = THREE.LinearFilter; wispBlobTex.generateMipmaps = false;
const wispBlob = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: wispBlobTex, transparent: true, depthWrite: false, opacity: 0.7, toneMapped: false }));
wispBlob.name = 'wispBlobShadow'; wispBlob.rotation.x = -Math.PI / 2; wispBlob.position.y = 0.025;
avatar.add(wispBlob); // world-space under avatar (not parented to bobbing wisp)
window.__wispBlob = wispBlob;
const TN = 48, trailPos = new Float32Array(TN * 3), trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({ map: haloTex, color: 0x6ff0ff, size: 0.28, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, sizeAttenuation: true }));
trail.frustumCulled = false; scene.add(trail);
let trailInit = false, trailK = 0, wispBob = 0; const wispPrev = new THREE.Vector3();
function updateWisp(t, dt) {
  // movement-feel pass: controller state blends -> bob, lean into turns, squash/stretch, trail intensity
  const B = ctl.blend, mv = B.walk + B.run, bobA = 0.08 * B.idle + 0.05 * B.walk + 0.03 * B.run, bobF = 2.2 + 3 * B.walk + 6 * B.run;
  wispBob += dt * bobF; wisp.position.y = 1.25 + Math.sin(wispBob) * bobA - 0.12 * B.land + 0.05 * B.jump;
  const wp = wisp.getWorldPosition(new THREE.Vector3()); wispPrev.copy(wp);
  wisp.rotation.z += (THREE.MathUtils.clamp(-ctl.turnRate * 0.06, -0.35, 0.35) - wisp.rotation.z) * Math.min(1, dt * 10); // lean into turns
  wisp.rotation.x += (-Math.min(ctl.speed / 6, 1) * 0.25 - wisp.rotation.x) * Math.min(1, dt * 8); // lean forward with speed
  if (morphT < 0) wisp.scale.copy(ctl.scale);
  trail.material.opacity = 0.25 + 0.45 * mv + 0.3 * (B.jump + B.fall); wispLight.intensity = (morphT < 0 ? 1.5 : wispLight.intensity) + 2.5 * ctl.flash;
  wispShell.material.opacity = 0.24 + 0.06 * Math.sin(t * 5); flame.rotation.y = t * 2; flame.scale.y = 1 + 0.15 * Math.sin(t * 7);
  if (!trailInit) { for (let i = 0; i < TN; i++) trailPos.set([wp.x, Math.max(0.7, wp.y), wp.z], i * 3); trailInit = true; }
  const lowQ = !!(window.__perf && window.__perf.low);
  // only spawn trail when moving; keep Y ≥ 0.7 so sprites never pile into a grey floor blotch
  if (mv > 0.05 || B.jump > 0.05) {
    trailK = (trailK + 1) % TN;
    const ty = Math.max(0.75, wp.y + (Math.random() - 0.5) * 0.15);
    trailPos.set([wp.x + (Math.random() - 0.5) * 0.2, ty, wp.z + (Math.random() - 0.5) * 0.2], trailK * 3);
  }
  for (let i = 0; i < TN; i++) trailPos[i * 3 + 1] = Math.max(0.7, trailPos[i * 3 + 1] + dt * 0.35); // embers drift up, never below knees
  trailGeo.attributes.position.needsUpdate = true; trail.visible = avatar.visible && wisp.visible && (mv > 0.02 || B.jump > 0.02 || B.fall > 0.02);
  if (window.__wispBlob) {
    window.__wispBlob.visible = avatar.visible && wisp.visible;
    window.__wispBlob.position.set(0, 0.025, 0);
  }
  trail.material.size = lowQ ? 0.12 : 0.28;
  trail.material.opacity = lowQ ? (0.15 + 0.25 * mv) : (0.2 + 0.4 * mv);
}
// STUB (phase 2, not implemented): when a player picks an opted-in collection, map its species
// (e.g. 'bear', 'tiger') + traits to a CC0/creator-supplied glTF model and swap it in for the wisp.
// No wallet code here; `collection` will come from the read-only lookup in world3.loadWalletCollections.
// step 6c: skin change. Default = wisp. Player opts in: floating tag -> collection -> NFT tile -> transform burst -> character standee.
const skinChar = new THREE.Group(); skinChar.visible = false; avatar.add(skinChar);
const skinMat = new THREE.SpriteMaterial({ transparent: true, toneMapped: false });
const skinSprite = new THREE.Sprite(skinMat); skinSprite.scale.set(1.9, 1.9, 1); skinSprite.position.y = 1.05; skinChar.add(skinSprite);
const skinRing = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 40), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.6, toneMapped: false, side: THREE.DoubleSide })); skinRing.rotation.x = -Math.PI / 2; skinRing.position.y = 0.03; skinChar.add(skinRing);
const burstN = 160, burstGeo = new THREE.BufferGeometry(), burstPos = new Float32Array(burstN * 3), burstVel = [];
burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
const burst = new THREE.Points(burstGeo, new THREE.PointsMaterial({ color: 0x9ffcff, size: 0.09, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); burst.visible = false; scene.add(burst);
let morphT = -1, pendingTex = null;
// step 12: avatar sits in the world: soft contact shadow + coloured bounce light from the neon/glass floor below.
const contactTex = canvasTex(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(10,14,24,0.55)'); r.addColorStop(1, 'rgba(10,14,24,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false })); contact.rotation.x = -Math.PI / 2; contact.position.y = 0.015; skinChar.add(contact);
ensureBlobShadow(skinChar);
const bounce = new THREE.PointLight(0x40e0d0, 0.9, 2.2, 2); bounce.position.set(0, 0.12, 0.25); skinChar.add(bounce);
const bTeal = new THREE.Color(0x3fe8d8), bViolet = new THREE.Color(0x9a6bff);
let char3d = null, moves = null; export const floristQueue = []; // step 10: 'art' collections flagged here; projector rota = later chunk
// step 12: lighter transform (~1.1s): white-teal flash + soft bloom + petal/mote swirl resolving into the avatar. No dark frames.
const flashMat = new THREE.SpriteMaterial({ map: haloTex, color: 0xe8fffb, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, toneMapped: false });
const flash = new THREE.Sprite(flashMat); flash.visible = false; scene.add(flash);
const burstSeed = [];
function startBurst() { morphT = 0; burst.visible = true; flash.visible = true; burst.material.color.set(0xd8fff6); burst.material.size = 0.07;
  for (let i = 0; i < burstN; i++) { burstSeed[i] = [Math.random() * 6.28, 0.25 + Math.random() * 0.55, Math.random() * 1.6, 1.5 + Math.random() * 2.5]; burstVel[i] = [0, 0, 0]; burstPos.set([pos.x, pos.y + 1.0, pos.z], i * 3); } }
let wornName = null, wornTraits = null; // in-memory only
// Sample armour palette from NFT art (helmet region + body mid + dark visor). Corner = studio bg culled.
export function sampleArmourPaletteFromRGBA(data, w, h) {
  const px = (x, y) => { const i = (Math.max(0, Math.min(h - 1, y | 0)) * w + Math.max(0, Math.min(w - 1, x | 0))) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
  const corners = [px(1, 1), px(w - 2, 1), px(1, h - 2), px(w - 2, h - 2)];
  const bg = corners.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]);
  const dist = (p) => Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]);
  const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
  const median = (arr) => { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a - b); return s[s.length >> 1]; };
  const sampleRegion = (x0, y0, x1, y1, pred) => {
    const rs = [], gs = [], bs = [];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const p = px(x, y); if (p[3] < 20) continue; if (dist(p) < 28) continue; if (pred && !pred(p)) continue;
      rs.push(p[0]); gs.push(p[1]); bs.push(p[2]);
    }
    if (rs.length < 8) return null;
    return hex(median(rs), median(gs), median(bs));
  };
  const helmet = sampleRegion((w * 0.28) | 0, (h * 0.05) | 0, (w * 0.72) | 0, (h * 0.42) | 0, null);
  const visor = sampleRegion((w * 0.32) | 0, (h * 0.28) | 0, (w * 0.68) | 0, (h * 0.48) | 0, p => (p[0] + p[1] + p[2]) / 3 < 90) || '#0a0b0c';
  const body = sampleRegion((w * 0.28) | 0, (h * 0.48) | 0, (w * 0.72) | 0, (h * 0.82) | 0, p => (p[0] + p[1] + p[2]) / 3 > 40);
  return { helmet, body, visor, accent: null, bg: hex(bg[0], bg[1], bg[2]) };
}
export function sampleArmourPalette(img, opts = {}) {
  try {
    const iw = img.naturalWidth || img.width || 64, ih = img.naturalHeight || img.height || 64;
    const maxSide = opts.maxSide || 96;
    const scale = Math.min(1, maxSide / Math.max(iw, ih));
    const w = Math.max(16, Math.round(iw * scale)), h = Math.max(16, Math.round(ih * scale));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    return sampleArmourPaletteFromRGBA(ctx.getImageData(0, 0, w, h).data, w, h);
  } catch (e) { console.warn('[armour-palette]', e); return null; }
}


/** Head-region accessory hints from art (masks / hair colour). Never invents armour. */
export function sampleHeadAccessoryFromRGBA(data, w, h) {
  const px = (x, y) => { const i = (Math.max(0, Math.min(h - 1, y | 0)) * w + Math.max(0, Math.min(w - 1, x | 0))) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
  const corners = [px(1, 1), px(w - 2, 1), px(1, h - 2), px(w - 2, h - 2)];
  const bg = corners.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]);
  const dist = (p) => Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]);
  const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
  const median = (arr) => { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a - b); return s[s.length >> 1]; };
  // Eye band: mid-upper face — look for saturated non-fur stripe (mask)
  const rs = [], gs = [], bs = [], furR = [], furG = [], furB = [], hairR = [], hairG = [], hairB = [];
  const y0 = (h * 0.22) | 0, y1 = (h * 0.42) | 0, x0 = (w * 0.22) | 0, x1 = (w * 0.78) | 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const p = px(x, y); if (p[3] < 30 || dist(p) < 22) continue;
    const [r, g, b] = p; const chroma = Math.max(r, g, b) - Math.min(r, g, b); const L = (r + g + b) / 3;
    // Mask candidates: saturated or distinctly non-brown stripe across eyes
    if (chroma > 40 && L > 30 && L < 200) { rs.push(r); gs.push(g); bs.push(b); }
    else { furR.push(r); furG.push(g); furB.push(b); }
  }
  // Hair / top spikes region
  for (let y = (h * 0.02) | 0; y < (h * 0.2) | 0; y++) for (let x = (w * 0.25) | 0; x < (w * 0.75) | 0; x++) {
    const p = px(x, y); if (p[3] < 30 || dist(p) < 22) continue;
    hairR.push(p[0]); hairG.push(p[1]); hairB.push(p[2]);
  }
  const out = {};
  if (rs.length > 24 && rs.length > (furR.length * 0.12)) {
    out.mask = hex(median(rs), median(gs), median(bs));
    out.maskKind = 'eyemask';
  }
  if (hairR.length > 12) out.hair = hex(median(hairR), median(hairG), median(hairB));
  return out;
}
export function sampleHeadAccessory(img, opts = {}) {
  try {
    const iw = img.naturalWidth || img.width || 64, ih = img.naturalHeight || img.height || 64;
    const maxSide = opts.maxSide || 96;
    const scale = Math.min(1, maxSide / Math.max(iw, ih));
    const w = Math.max(16, Math.round(iw * scale)), h = Math.max(16, Math.round(ih * scale));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    return sampleHeadAccessoryFromRGBA(ctx.getImageData(0, 0, w, h).data, w, h);
  } catch (e) { console.warn('[head-accessory]', e); return null; }
}

/** Torso / helmet attire colours from art — generic for any NFT with clothes or army helmet. */
export function sampleAttireFromRGBA(data, w, h) {
  const px = (x, y) => { const i = (Math.max(0, Math.min(h - 1, y | 0)) * w + Math.max(0, Math.min(w - 1, x | 0))) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
  const corners = [px(1, 1), px(w - 2, 1), px(1, h - 2), px(w - 2, h - 2)];
  const bg = corners.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]);
  const dist = (p) => Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]);
  const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
  const median = (arr) => { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a - b); return s[s.length >> 1]; };
  const sampleRegion = (x0, y0, x1, y1, pred) => {
    const rs = [], gs = [], bs = [];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const p = px(x, y); if (p[3] < 20) continue; if (dist(p) < 28) continue; if (pred && !pred(p)) continue;
      rs.push(p[0]); gs.push(p[1]); bs.push(p[2]);
    }
    if (rs.length < 8) return null;
    return hex(median(rs), median(gs), median(bs));
  };
  // Mid torso = clothes; upper head = helmet/hat
  const clothes = sampleRegion((w * 0.28) | 0, (h * 0.48) | 0, (w * 0.72) | 0, (h * 0.78) | 0, p => (p[0] + p[1] + p[2]) / 3 > 25 && (p[0] + p[1] + p[2]) / 3 < 230);
  const helmet = sampleRegion((w * 0.3) | 0, (h * 0.05) | 0, (w * 0.7) | 0, (h * 0.32) | 0, null);
  const collar = sampleRegion((w * 0.35) | 0, (h * 0.42) | 0, (w * 0.65) | 0, (h * 0.55) | 0, p => {
    const chroma = Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]);
    return chroma > 35;
  });
  return { clothes, helmet, collar };
}
export function sampleAttire(img, opts = {}) {
  try {
    const iw = img.naturalWidth || img.width || 64, ih = img.naturalHeight || img.height || 64;
    const maxSide = opts.maxSide || 96;
    const scale = Math.min(1, maxSide / Math.max(iw, ih));
    const w = Math.max(16, Math.round(iw * scale)), h = Math.max(16, Math.round(ih * scale));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    return sampleAttireFromRGBA(ctx.getImageData(0, 0, w, h).data, w, h);
  } catch (e) { console.warn('[attire-palette]', e); return null; }
}

export async function applyCollectionAvatar(item) {
  wornName = item ? item.name : null; wornTraits = null; window.__lobbySkin = item ? { id: String(item.name).replace(/[^\w.-]/g, '').slice(0, 64), img: item.src } : null; window.dispatchEvent(new Event('lobbyskin'));
  if (!item) { skinChar.visible = false; wisp.visible = true; if (window.__wispBlob) window.__wispBlob.visible = true; document.getElementById('skintag').textContent = 'Skin: Drop ▾'; document.getElementById('aura').hidden = true; moves && moves.set(null); abil && abil.set(null); return true; }
  document.getElementById('skintag').textContent = `Skin: ${item.name} ▾`; // in-memory only, never persisted
  const col = collections.find(c => c.items.some(i => i.name === item.name && i.src === item.src)) || (item.issuer && [...collections, ...holderCollections].find(c => c.issuer === item.issuer && (c.taxon == null || c.taxon === item.taxon))) || {}; // v29: My NFTs tiles get their collection's full profile (verified + signature held items + tiers) like the prebuilt path
  let meta = { name: item.name, attributes: [] }; try { if (item.meta) meta = await (await fetch(item.meta)).json(); } catch (e) { /* no metadata: falls back to art */ }
  meta = Object.assign({}, meta, { attributes: [...(meta.attributes || []), ...(col.baseAttributes || [])] });
  await loadTraitMap(); const j = async u => { try { return u ? await (await fetch(u)).json() : null; } catch (e) { return null; } };
  const spec = mergeProfile(readTraits(meta), await j(item.profile), await j(item.profileVerified || col.profileVerified), col.collectionProfile); spec.seed = item.seed || item.name; window.__lastSpec = spec; wornTraits = traitsFromSpec(spec, col.id || col.name);
  // Opt-in voxel overlay (Power Zerp experiment): item.voxel = true|{...opts}. Loads NFT image; never default.
  // Also sample armour helmet/body/visor colours from art so black helmet art => black battle helmet.
  {
    const src = item.src || meta.image || item.image;
    const wantHead = !spec.features.mask && !spec.features.headwear && /^(bear|ape|cat|dog|tiger|human|robot)$/.test(spec.type);
    const wantAttire = !!(spec.features.clothes || (spec.features.headwear && (spec.features.headwear.kind === 'helmet' || spec.features.headwear.kind === 'skull_hat')));
    if (src && (item.voxel || spec.type === 'armour' || wantHead || wantAttire || (spec.features.headwear && String(spec.features.headwear.kind||'').startsWith('hair') && !spec.features.headwear.colour))) {
      try {
        const img = await new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = src; });
        if (wantHead || (spec.features.headwear && String(spec.features.headwear.kind||'').startsWith('hair'))) {
          const head = sampleHeadAccessory(img);
          if (head) {
            if (head.mask && !spec.features.mask && !spec.features.headwear) {
              // Apply only when the stripe looks like a real mask (red/dark/high-chroma band).
              // Skip blue/cyan pupils (PARC Blue Eyes) and plain fur — keep purple/red hero masks (BEAR).
              const mh = head.mask; let apply = false;
              if (mh && mh[0] === '#' && mh.length >= 7) {
                const r = parseInt(mh.slice(1, 3), 16), g = parseInt(mh.slice(3, 5), 16), b = parseInt(mh.slice(5, 7), 16);
                const chroma = Math.max(r, g, b) - Math.min(r, g, b);
                const L = (r + g + b) / 3;
                const redish = r > g + 25 && r > b + 10; // hero red mask
                const purplish = b > g + 20 && r > 80 && chroma > 40; // purple mask (BEAR)
                const blueEye = !purplish && b > r + 30 && b > g + 15 && r < 110; // cyan/blue pupil only
                const darkBand = L < 70 && chroma < 40; // black/grey domino
                apply = !blueEye && (redish || purplish || darkBand || (chroma > 55 && L > 40 && L < 180));
              }
              if (apply) {
                spec.features.mask = { kind: head.maskKind || 'eyemask', colour: head.mask, from: 'image-head' };
                spec.features.headwear = spec.features.headwear || { kind: 'eyemask', colour: head.mask, from: 'image-head' };
                spec.matched = [...new Set([...(spec.matched || []), 'mask:eyemask', 'headwear:eyemask'])];
              }
            }
            if (head.hair && spec.features.headwear && String(spec.features.headwear.kind||'').startsWith('hair') && !spec.features.headwear.colour) {
              spec.features.headwear.colour = head.hair;
            }
            spec.headAccessory = head;
          }
        }
        if (spec.type === 'armour') {
          const pal = sampleArmourPalette(img);
          if (pal) {
            const rgb = (hex) => {
              if (!hex || hex[0] !== '#' || hex.length < 7) return [128, 128, 128];
              return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
            };
            const lum = (hex) => { const [r, g, b] = rgb(hex); return (r + g + b) / 3; };
            // True black/charcoal helmet (Power-Ranger black) = dark + low chroma. Dark green/orange shading keeps Color trait.
            const isBlackHelmet = (hex) => {
              const [r, g, b] = rgb(hex); const L = (r + g + b) / 3; const chroma = Math.max(r, g, b) - Math.min(r, g, b);
              return L < 48 && chroma < 28;
            };
            const traitHelm = (spec.features.headwear && spec.features.headwear.colour) || spec.colours.helmet || spec.colours.body;
            let helm = traitHelm;
            if (pal.helmet && isBlackHelmet(pal.helmet)) helm = pal.helmet;
            else if (!helm && pal.helmet) helm = pal.helmet;
            if (helm) { spec.colours.helmet = helm; if (spec.features.headwear) spec.features.headwear.colour = helm; }
            if (pal.body && !spec.colours.body) spec.colours.body = pal.body;
            // Visor stays dark Power-Ranger glass when art samples dark/brown-black
            if (pal.visor && lum(pal.visor) < 100) spec.colours.visor = '#0a0b0c';
            else if (pal.visor) spec.colours.visor = pal.visor;
            else spec.colours.visor = spec.colours.visor || '#0a0b0c';
            spec.armourPalette = Object.assign({}, pal, { helmetApplied: helm });
          }
        }
        if (wantAttire && spec.type !== 'armour') {
          const att = sampleAttire(img);
          if (att) {
            if (spec.features.clothes) {
              // Prefer art torso for missing clothes colour; collar can tint under-shirt
              if (!spec.features.clothes.colour && att.clothes) spec.features.clothes.colour = att.clothes;
              if (spec.features.clothes.under && !spec.features.clothes.under.colour && att.collar) spec.features.clothes.under.colour = att.collar;
              else if (spec.features.clothes.under && att.collar && /vest|jacket/.test(spec.features.clothes.kind || '')) {
                // Keep trait under colour; art collar only fills gaps
              }
              // Camo without colour → green from torso
              if (spec.features.clothes.kind === 'camo' && att.clothes) spec.features.clothes.colour = spec.features.clothes.colour || att.clothes;
            }
            if (spec.features.headwear && spec.features.headwear.kind === 'helmet' && spec.features.headwear.style === 'army') {
              if (att.helmet) { spec.features.headwear.colour = att.helmet; spec.colours.helmet = att.helmet; }
            }
            if (spec.features.headwear && spec.features.headwear.kind === 'skull_hat' && att.helmet) {
              // Prefer mid-grey bone from art head if present
              const L = (() => { const h = att.helmet; if (!h || h[0] !== '#') return 200; return (parseInt(h.slice(1,3),16)+parseInt(h.slice(3,5),16)+parseInt(h.slice(5,7),16))/3; })();
              if (L > 80 && L < 210) { spec.features.headwear.colour = att.helmet; spec.colours.helmet = att.helmet; }
            }
            spec.attirePalette = att;
          }
        }
        if (item.voxel) {
          const opts = typeof item.voxel === 'object' ? item.voxel : {};
          spec.voxel = Object.assign({ image: img, depth: 8, maxSide: 48, bgTol: 42, targetH: 1.25 }, opts);
        }
      } catch (e) { console.warn('[voxel/armour-palette] image load failed', e); }
    }
  }
  if (spec.florist && col.id && !floristQueue.includes(col.id)) floristQueue.push(col.id); // taxonomy: abstract still queued for florist projector
  if (spec.type === 'art') { skinChar.visible = false; wisp.visible = true; return false; } // legacy guard (readTraits now ensures playable generic)
  if (char3d) skinChar.remove(char3d); char3d = buildAvatar(spec); char3d.userData.grow = 0; char3d.rotation.y = Math.PI; skinChar.add(char3d); stagePrep(char3d); skinSprite.visible = false; ensureBlobShadow(skinChar);
  const ab = document.getElementById('aura'); ab.hidden = spec.tier !== 'Legendary'; // '+1 AURA' only while wearing a Legendary
  if (!ab.hidden) { const on = localStorage.getItem('ledgerAura') !== 'off'; ab.textContent = `+1 AURA: ${on ? 'ON' : 'OFF'}`; ab.setAttribute('aria-pressed', on); }
  const _map = await loadTraitMap(); moves && moves.set(spec, _map); // step 13e: movement profile, STANCE, Legendary boost, emotes
  abil && abil.set(spec, _map); // preview: trait abilities (laser / flight / charge / aura / slash)
  pendingTex = true; startBurst(); return true;
}
// v15b: slower staged transform (~2.8s, eased): Drop swirls + dissolves, then the avatar builds up part by part:
// body -> face/eyes (small parts) -> traits (hat/mask) -> held props -> aura. Visibility toggles only (no extra draw cost).
const MT = 2.8, ST = [0.7, 1.2, 1.65, 2.05, 2.35], ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
function stagePrep(root) { const body = root.children[0], list = []; body && body.updateMatrixWorld(true);
  root.traverse(o => { if (o === root || !(o.isMesh || o.isSprite || o.isPoints) || (o.parent && o.parent.isMesh)) return; let st = null, a = o;
    while (a && a !== root) { if (a.userData && a.userData.stage != null) { st = a.userData.stage; break; } if (a === body) break; a = a.parent; }
    if (st == null) { if (!body || a !== body) st = 4; else { const g = o.geometry; if (g && !g.boundingSphere) g.computeBoundingSphere(); const sc = o.getWorldScale(new THREE.Vector3()); st = g && g.boundingSphere && g.boundingSphere.radius * Math.max(sc.x, sc.y, sc.z) >= 0.09 ? 0 : 1; } }
    list.push({ o, at: ST[st] + ((list.length * 0.618) % 1) * 0.3, v: o.visible }); o.visible = false; });
  root.userData.stageList = list; }
function updateSkin(t, dt) {
  if (morphT >= 0) { morphT += dt; const T = morphT, u = T / MT;
    for (let i = 0; i < burstN; i++) { const [a0, r0, h0, w] = burstSeed[i], ang = a0 + T * w * (1 + 1.5 * ease(T / 1.2)), r = r0 * (T < 1.2 ? 1 - 0.5 * ease(T / 1.2) : 0.5 + 0.6 * ease((T - 1.2) / 1.2)), h = 0.15 + h0 * Math.min(1, T * 0.9);
      burstPos[i * 3] = pos.x + Math.cos(ang) * r; burstPos[i * 3 + 1] = pos.y + h; burstPos[i * 3 + 2] = pos.z + Math.sin(ang) * r; } burstGeo.attributes.position.needsUpdate = true;
    burst.material.opacity = T < 0.3 ? T / 0.3 : Math.max(0, 1 - (T - 2.1) / 0.7);
    const fk = Math.max(0, 1 - Math.abs(T - 0.7) / 0.45) * 0.8 + Math.max(0, 1 - Math.abs(T - 2.4) / 0.3) * 0.35; flash.position.set(pos.x, pos.y + 0.9, pos.z); flash.scale.setScalar(0.8 + 2.2 * fk); flashMat.opacity = 0.6 * fk;
    wisp.scale.setScalar(Math.max(0.01, 1 - ease(T / 0.85))); wisp.rotation.y += dt * (4 + 14 * ease(T / 0.85)); wispLight.intensity = 1.5 + fk * 5;
    if (T > 0.65 && pendingTex) { pendingTex = null; skinChar.visible = true; wisp.visible = false; if (window.__wispBlob) window.__wispBlob.visible = false; }
    if (skinChar.visible && char3d) { char3d.userData.grow = 0.35 + 0.65 * ease((T - 0.65) / 1.0);
      for (const e of char3d.userData.stageList || []) if (!e.done && T >= e.at) { e.o.visible = e.v; e.done = true; } }
    if (T > MT) { (char3d && char3d.userData.stageList || []).forEach(e => { if (!e.done) e.o.visible = e.v; e.done = true; }); morphT = -1; burst.visible = false; flash.visible = false; wisp.scale.setScalar(1); wispLight.intensity = 1.5; } }
  if (skinChar.visible && char3d) { char3d.userData.animate(t, dt, ctl, walkT); const g = char3d.userData.grow ?? 1; char3d.scale.multiplyScalar(Math.max(0.01, g * (2 - g))); skinRing.material.opacity = 0.4 + 0.2 * Math.sin(t * 4);
    bounce.color.copy(bTeal).lerp(bViolet, 0.5 + 0.5 * Math.sin(pos.x * 0.35 + pos.z * 0.22)); bounce.intensity = 0.7 + 0.25 * Math.sin(t * 1.3); contact.scale.setScalar(1 - Math.min(0.5, Math.max(0, pos.y - (ctl.groundY ?? pos.y)) * 0.5)); }
}
// skin UI: scrollable 'choose your NFT' picker for the player's OWN collection (after wallet sign-in).
// Memory-only (__walletItems); never persists address/token. No sample/showcase strip.
{ const tag = document.getElementById('skintag'), panel = document.getElementById('skinpanel');
  // Same purple "NFT" tile as wallet.js — never leave a broken-image icon.
  const PLACEHOLDER_IMG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#1a1430"/><text x="64" y="70" text-anchor="middle" fill="#9ad" font-size="14" font-family="system-ui">NFT</text></svg>');
  const IPFS_GWS = ['https://ipfs.xrp.cafe/ipfs/', 'https://gateway.pinata.cloud/ipfs/', 'https://ipfs.io/ipfs/', 'https://dweb.link/ipfs/', 'https://nftstorage.link/ipfs/', 'https://w3s.link/ipfs/'];
  const lazyImg = (im, src) => {
    im.alt = im.alt || ''; im.loading = 'lazy'; im.decoding = 'async';
    if (!src) { im.src = PLACEHOLDER_IMG; return; }
    if (src.startsWith('data:')) { im.src = src; return; }
    const armErr = () => {
      im.onerror = () => {
        const cur = im.currentSrc || im.src || src;
        const cid = (cur.match(/\/ipfs\/(.+)$/) || [])[1];
        let k = +(im.dataset.gwk || -1) + 1;
        if (cid && k < IPFS_GWS.length) {
          // Skip gateway that just failed
          while (k < IPFS_GWS.length && cur.startsWith(IPFS_GWS[k])) k++;
          if (k < IPFS_GWS.length) { im.dataset.gwk = String(k); im.src = IPFS_GWS[k] + cid; return; }
        }
        im.onerror = null; im.src = PLACEHOLDER_IMG;
      };
    };
    armErr();
    if ('IntersectionObserver' in window) {
      im.dataset.src = src;
      const io = lazyImg.io || (lazyImg.io = new IntersectionObserver(ents => {
        ents.forEach(e => { if (!e.isIntersecting) return; const el = e.target; if (el.dataset.src) { el.src = el.dataset.src; delete el.dataset.src; } io.unobserve(el); });
      }, { root: panel, rootMargin: '80px' }));
      io.observe(im);
    } else im.src = src;
  };
  const tile = (it, onPick) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'skintile nftpick-tile'; b.title = it.name || 'NFT';
    const im = document.createElement('img'); im.alt = it.name || 'NFT'; lazyImg(im, it.src);
    const cap = document.createElement('span'); cap.textContent = it.name || 'NFT';
    b.append(im, cap);
    b.addEventListener('click', () => { onPick(it); });
    return b;
  };
  const render = () => {
    panel.replaceChildren();
    const mine = window.__walletItems || [];
    const head = document.createElement('p'); head.className = 'nftpick-h';
    head.textContent = mine.length ? `Choose your NFT (${mine.length})` : 'Choose your NFT';
    panel.append(head);
    // Drop (default wisp)
    const drop = document.createElement('button'); drop.type = 'button'; drop.className = 'nftpick-drop'; drop.textContent = 'Drop (default)';
    drop.addEventListener('click', () => { applyCollectionAvatar(null); tag.textContent = 'Skin: Drop ▾'; panel.classList.remove('on'); });
    panel.append(drop);
    if (!mine.length) {
      const hint = document.createElement('p'); hint.className = 'nftpick-hint';
      hint.textContent = 'Sign in with Xaman (top-right) to list NFTs from your own wallet. Nothing is stored — cleared on reload.';
      panel.append(hint);
    } else {
      // Touch-friendly horizontal strip (412 + desktop) + vertical wrap grid
      const strip = document.createElement('div'); strip.className = 'nftpick-strip'; strip.setAttribute('role', 'listbox'); strip.setAttribute('aria-label', 'Your NFTs');
      mine.forEach(it => strip.append(tile(it, (x) => { applyCollectionAvatar(x); tag.textContent = `Skin: ${x.name} ▾`; panel.classList.remove('on'); })));
      panel.append(strip);
      const grid = document.createElement('div'); grid.className = 'skingrid nftpick-grid';
      mine.forEach(it => grid.append(tile(it, (x) => { applyCollectionAvatar(x); tag.textContent = `Skin: ${x.name} ▾`; panel.classList.remove('on'); })));
      panel.append(grid);
    }
    // Secondary: opt-in lobby skins (not showcase samples)
    if (collections.length) {
      const det = document.createElement('details'); det.className = 'nftpick-lobby';
      const sum = document.createElement('summary'); sum.textContent = 'Lobby opt-in skins'; det.append(sum);
      const sel = document.createElement('select'); sel.id = 'skinsel'; sel.setAttribute('aria-label', 'Lobby collection');
      const opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = '— pick a collection —'; sel.append(opt0);
      collections.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.append(o); });
      const grid = document.createElement('div'); grid.className = 'skingrid';
      sel.addEventListener('change', () => {
        grid.replaceChildren();
        const c = collections.find(x => x.id === sel.value); if (!c) return;
        c.items.forEach(it => grid.append(tile(it, (x) => { applyCollectionAvatar(x); tag.textContent = `Skin: ${x.name} ▾`; panel.classList.remove('on'); })));
      });
      det.append(sel, grid); panel.append(det);
    }
  };
  addEventListener('walletitems', () => { if (panel.classList.contains('on')) render(); else {
    const n = (window.__walletItems || []).length;
    if (n && /^Skin: Drop/.test(tag.textContent || '')) tag.textContent = `Skin: My NFTs (${n}) ▾`;
  } });
  tag.addEventListener('click', () => { if (!panel.classList.contains('on')) render(); panel.classList.toggle('on'); if (document.pointerLockElement) document.exitPointerLock(); });
}

// ---- Bloom ----
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.4, 0.88);
composer.addPass(bloom);
const perf = initPerf({ renderer, bloom, scene, sun });
composer.addPass(new OutputPass());
const envFeel = createImpactFeel(scene, camera); window.__envFeel = envFeel;


// ---- Controls ----
const keys = {};
let frontView = false, hudOn = true, warping = false, guide = null;
let yaw = 0, pitch = -0.05, thirdPerson = false, vy = 0, active = false;
// v14b: snap tall buildings onto the terrain so none hover on downhill edges (base = lowest ground under footprint, sunk 0.3)
if (!new URLSearchParams(location.search).get('nosnap')) { const bb = new THREE.Box3(), sz = new THREE.Vector3();
  for (const o of scene.children) { if (!o.isGroup && !o.isMesh) continue; bb.setFromObject(o); if (bb.isEmpty()) continue; bb.getSize(sz);
    if (sz.y < 10 || Math.max(sz.x, sz.z) < 2 || Math.max(sz.x, sz.z) > 40) continue;
    const g = Math.min(...[[bb.min.x, bb.min.z], [bb.max.x, bb.min.z], [bb.min.x, bb.max.z], [bb.max.x, bb.max.z], [(bb.min.x + bb.max.x) / 2, (bb.min.z + bb.max.z) / 2]].map(([x, z]) => groundH(x, z)));
    const dy = g - 0.3 - bb.min.y; if (dy < -0.05 && dy > -4) o.position.y += dy; } }
const pos = new THREE.Vector3(0, FLOOR, 4); buildRestroom(scene); buildEggs(scene); buildAiNote(scene, FLOOR); const loungeTick = buildLounge(scene, interactables); const ambient = buildAmbientWaves(scene); addComingSoon(interactables); installVignette(); installSfx(); polishJoystick(); window.__lobby = { scene, pos, avatar, THREE };
// Lobby life (after pos exists): seats + upright wander animals + arcade NPCs
const lobbyLife = installLobbyLife(scene, {
  blocks, groundH, FLOOR, colliders, low: _envLow0,
  getPlayer: () => ({ x: pos.x, z: pos.z, y: pos.y }),
});
window.__lobbyLife = lobbyLife;
window.__lobbyLifeGround = (x, z) => (typeof groundH === 'function' ? groundH(x, z) : FLOOR);
if (window.__envProps && lobbyLife.seats && lobbyLife.seats.placed) {
  for (const p of lobbyLife.seats.placed) window.__envProps.push({ x: p.x, z: p.z, kind: 'life-' + p.kind });
}

const tvhint = document.getElementById('tvhint');
const nearest = () => interactables.find(i => Math.hypot(pos.x - i.x, pos.z - i.z) < i.r && pos.y < 2);
const overlay = document.getElementById('overlay'), viewname = document.getElementById('viewname');
const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');
const floorAt = (x, z, y = 0) => { const a = aptFloor(x, z, y); if (a !== null) return a; return (Math.hypot(x, z) < PLAZA_R || inLot(x, z)) ? FLOOR : groundH(x, z); };
window.__lobby.floorAt = floorAt; window.__lobby.FLOOR = FLOOR;

overlay.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('#wallet,#hub,#hud,#hguide,#tpad,#joy,button,input,a')) return; // v32/v33: UI clicks never grab pointer lock
  if (isTouch) { active = true; overlay.classList.add('hidden'); }
  else renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  active = document.pointerLockElement === renderer.domElement;
  overlay.classList.toggle('hidden', active || isGalleryOpen() || isNewsOpen());
});
document.addEventListener('mousemove', e => {
  if (!active || isTouch) return;
  yaw -= e.movementX * 0.0025;
  pitch = Math.max(-1.4, Math.min(1.4, pitch - e.movementY * 0.0025));
});
function setView(tp) { thirdPerson = tp; viewname.textContent = tp ? 'Third-person' : 'First-person'; }
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Escape' && window.__arcadeOpen) { e.preventDefault(); closeArcadeOverlay(); return; }
  if (e.code === 'KeyV') { frontView = false; setView(!thirdPerson); syncViewBtn(); }
  if (e.code === 'KeyC') { frontView = !frontView; viewname.textContent = frontView ? 'Front (C)' : (thirdPerson ? 'Third-person' : 'First-person'); }
  if (e.code === 'KeyM') { hudOn = !hudOn; document.body.classList.toggle('hudoff', !hudOn); }
  if (e.code === 'Space') ctl.jump();
  if (e.code === 'KeyE' && !isGalleryOpen() && !isNewsOpen()) { const it = nearest(); if (it) { if (it.use) it.use(); } else world3.tvUse(pos); }
  if (e.code === 'Escape') setTimeout(() => { if (!isGalleryOpen() && !isNewsOpen() && !active) overlay.classList.remove('hidden'); }, 0);
});
document.getElementById('gclose').addEventListener('click', () => { if (!active) overlay.classList.remove('hidden'); });
addEventListener('keyup', e => { keys[e.code] = false; });

const joy = document.getElementById('joy'), knob = document.getElementById('knob');
const jv = { x: 0, y: 0 }; let lookId = null, lastX = 0, lastY = 0, joyId = null;
const DEAD = 0.14; // stick dead-zone
const joyRecentre = () => { jv.x = jv.y = 0; joyId = null; if (knob) knob.style.transform = ''; };
const joyFromXY = (clientX, clientY) => {
  const r = joy.getBoundingClientRect();
  const half = Math.min(r.width, r.height) / 2, maxR = half * 0.72;
  let dx = clientX - (r.left + half), dy = clientY - (r.top + half); const d = Math.hypot(dx, dy);
  if (d > maxR) { dx *= maxR / d; dy *= maxR / d; }
  const nx = dx / maxR, ny = dy / maxR, mag = Math.hypot(nx, ny);
  const live = mag < DEAD ? 0 : Math.min(1, (mag - DEAD) / (1 - DEAD));
  const sx = mag > 1e-4 ? nx / mag * live : 0, sy = mag > 1e-4 ? ny / mag * live : 0;
  jv.x = sx; jv.y = sy; knob.style.transform = `translate(${dx}px,${dy}px)`;
};
// Pointer + touch: capture id so multi-touch / leave / cancel always recentres
joy.addEventListener('pointerdown', e => {
  if (joyId != null) return;
  joyId = e.pointerId; try { joy.setPointerCapture(e.pointerId); } catch {}
  joyFromXY(e.clientX, e.clientY); e.preventDefault();
}, { passive: false });
joy.addEventListener('pointermove', e => {
  if (e.pointerId !== joyId) return;
  joyFromXY(e.clientX, e.clientY); e.preventDefault();
}, { passive: false });
const joyRelease = e => { if (joyId == null || (e && e.pointerId != null && e.pointerId !== joyId)) return; joyRecentre(); };
['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave'].forEach(t => joy.addEventListener(t, joyRelease));
joy.addEventListener('touchend', e => { // also clear if our finger left without pointerup (iOS quirks)
  let still = false;
  for (const t of e.touches) if (joyId != null && t.identifier === joyId) still = true;
  if (!still) joyRecentre();
}, { passive: true });
joy.addEventListener('touchcancel', () => joyRecentre(), { passive: true });
addEventListener('blur', () => { joyRecentre(); for (const k of Object.keys(keys)) keys[k] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { joyRecentre(); for (const k of Object.keys(keys)) keys[k] = false; } });
window.__joyRecentre = joyRecentre;
window.__joyState = () => ({ x: jv.x, y: jv.y, id: joyId });
renderer.domElement.addEventListener('touchstart', e => { const t = e.changedTouches[0]; lookId = t.identifier; lastX = t.clientX; lastY = t.clientY; });
renderer.domElement.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) if (t.identifier === lookId) {
    yaw -= (t.clientX - lastX) * 0.005; pitch = Math.max(-1.4, Math.min(1.4, pitch - (t.clientY - lastY) * 0.005));
    lastX = t.clientX; lastY = t.clientY;
  }
});
renderer.domElement.addEventListener('touchend', e => {
  for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
});
renderer.domElement.addEventListener('touchcancel', () => { lookId = null; });
renderer.domElement.addEventListener('dblclick', () => { if (isTouch) { setView(!thirdPerson); syncViewBtn(); } });

// Test hook (screenshot script only): ?view=third&yaw=0.3
const qs = new URLSearchParams(location.search);
if (qs.get('view') === 'third') setView(true);
if (qs.has('yaw')) yaw = parseFloat(qs.get('yaw'));
if (qs.get('side')) window.__sideCam = parseFloat(qs.get('side')) || 1;
if (qs.get('front')) frontView = true;
if (qs.get('at')) { const [ax, az, ay] = qs.get('at').split(',').map(Number); pos.set(ax, ay || 0, az); }
if (qs.get('shot')) overlay.classList.add('hidden');
if (qs.has('pitch')) pitch = parseFloat(qs.get('pitch'));
if (qs.get('spawn') === 'fighter') { pos.set(-3.3, FLOOR, -26.0); yaw = Math.PI; } // step 6: inside LEDGER ARCADE
else if (qs.get('spawn') === 'shooters' || qs.get('spawn') === 'arcade') { pos.set(-5.5, FLOOR, -26.0); yaw = Math.PI; } // back beside the Vault Run cabinet (inside the shop)

// ---- HUD: mini-map, compass/radar, guide ----
const mm = document.getElementById('minimap'), mg = mm.getContext('2d');
const guideSel = document.getElementById('guide'), distEl = document.getElementById('dist');
guideSel.addEventListener('change', () => { guide = guideSel.value || null; guideSel.blur(); });
if (qs.get('guide')) { guideSel.value = qs.get('guide'); guide = guideSel.value; }
const marker = new THREE.Group(); scene.add(marker);
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 30, 24, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x22f0ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
beam.position.y = 15; marker.add(beam);
const chevMat = new THREE.MeshBasicMaterial({ color: 0x22f0ff, transparent: true, opacity: 0.85, toneMapped: false });
const chevs = [];
for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 3), chevMat); c.rotation.x = -Math.PI / 2; scene.add(c); chevs.push(c); }
function updateHud(t) { const slow = t - (updateHud.l || 0) > 0.1; if (slow) updateHud.l = t; // v17: text + minimap at ~10 Hz
  const tg = guide && targets[guide];
  marker.visible = !!tg; chevs.forEach(c => { c.visible = !!tg; });
  if (tg) {
    const [gx, gz] = tg; marker.position.set(gx, FLOOR, gz);
    const dx = gx - pos.x, dz = gz - pos.z, d = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
    if (slow) distEl.textContent = `${guideSel.options[guideSel.selectedIndex].text}: ${d.toFixed(1)} m`;
    chevs.forEach((c, i) => {
      const f = ((i + (t * 1.2) % 1) * 1.6 + 1.2); c.visible = f < d - 1;
      c.position.set(pos.x + dx / d * f, FLOOR + 0.25 + Math.sin(t * 4 + i) * 0.05, pos.z + dz / d * f);
      c.rotation.set(-Math.PI / 2, 0, 0); c.rotation.order = 'YXZ'; c.rotation.y = ang;
    });
  } else if (distEl.textContent) distEl.textContent = '';
  if (!hudOn || !slow) return;
  const W = mm.width, C = W / 2, S = 1.3; mg.clearRect(0, 0, W, W);
  mg.save(); mg.beginPath(); mg.arc(C, C, C - 4, 0, 7); mg.fillStyle = 'rgba(10,6,30,0.75)'; mg.fill(); mg.clip();
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  const map = (wx, wz) => { const rx = wx - pos.x, rz = wz - pos.z; return [C + (rx * cy - rz * sy) * S, C + (rx * sy + rz * cy) * S]; };
  const edge = ([x, y]) => { const dx = x - C, dy = y - C, l = Math.hypot(dx, dy), m = C - 12; return l > m ? [C + dx / l * m, C + dy / l * m] : [x, y]; };
  mg.strokeStyle = 'rgba(34,240,255,0.15)'; mg.lineWidth = 1;
  for (let r = 20; r < C; r += 20) { mg.beginPath(); mg.arc(C, C, r, 0, 7); mg.stroke(); }
  let [px, py] = map(0, 0); mg.beginPath(); mg.arc(px, py, PLAZA_R * S, 0, 7); mg.strokeStyle = '#22f0ff'; mg.lineWidth = 2; mg.stroke();
  towerPts.forEach(p => { const [x, y] = edge(map(p[0], p[1])); mg.fillStyle = '#ff3df0'; mg.beginPath(); mg.arc(x, y, 4, 0, 7); mg.fill(); });
  [[-7, -21, 7, -12, '#ff3df0', 'ARCADE SHOP'], [14, -5.5, 20.5, 5.5, '#7affb0', 'GALLERY'], [-6, 20, 6, 30, '#ffb35c', 'ESCROW PALACE']].forEach(([x0, z0, x1, z1, c, n]) => {
    const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(p => map(...p)); mg.beginPath(); pts.forEach(([x, y], k) => k ? mg.lineTo(x, y) : mg.moveTo(x, y)); mg.closePath();
    mg.fillStyle = c + '44'; mg.fill(); mg.strokeStyle = c; mg.lineWidth = 1.5; mg.stroke(); const [lx, ly] = map((x0 + x1) / 2, (z0 + z1) / 2); mg.fillStyle = '#fff'; mg.font = 'bold 9px system-ui'; mg.textAlign = 'center'; mg.fillText(n, lx, ly); });
  [['arcade', '#ff3d8a', 'A'], ['fighter', '#ff9a1f', 'F'], ['gallery', '#ffd23d', 'G']].forEach(([k, c, ch]) => { const [x, y] = map(...targets[k]); mg.fillStyle = c; mg.font = 'bold 12px system-ui'; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.beginPath(); mg.arc(x, y, 7, 0, 7); mg.fill(); mg.fillStyle = '#08041a'; mg.fillText(ch, x, y + 1); });
  portalPts.forEach(p => { const [x, y] = map(p.x, p.z); mg.strokeStyle = '#' + new THREE.Color(p.col).getHexString(); mg.lineWidth = 3; mg.beginPath(); mg.arc(x, y, 5, 0, 7); mg.stroke(); });
  [px, py] = map(5, 5); mg.fillStyle = '#22f0ff'; mg.fillRect(px - 3, py - 3, 6, 6);
  
  const sweep = (t * 2) % (Math.PI * 2); const gr = mg.createConicGradient(sweep, C, C);
  gr.addColorStop(0, 'rgba(34,240,255,0.25)'); gr.addColorStop(0.12, 'rgba(34,240,255,0)'); gr.addColorStop(1, 'rgba(34,240,255,0)');
  mg.fillStyle = gr; mg.fillRect(0, 0, W, W); mg.restore();
  mg.beginPath(); mg.arc(C, C, C - 4, 0, 7); mg.strokeStyle = '#ff3df0'; mg.lineWidth = 3; mg.stroke();
  const [nx, ny] = edge(map(pos.x, pos.z - 1000)); mg.fillStyle = '#fff'; mg.font = 'bold 13px system-ui'; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillText('N', nx, ny);
  mg.fillStyle = '#fff'; mg.beginPath(); mg.moveTo(C, C - 8); mg.lineTo(C - 6, C + 6); mg.lineTo(C + 6, C + 6); mg.closePath(); mg.fill();
  if (tg) { // radar arrow to guide target on the rim
    const [tx, ty] = map(tg[0], tg[1]), a = Math.atan2(ty - C, tx - C), r = C - 14;
    mg.save(); mg.translate(C + Math.cos(a) * r, C + Math.sin(a) * r); mg.rotate(a);
    mg.fillStyle = '#22f0ff'; mg.shadowColor = '#22f0ff'; mg.shadowBlur = 10;
    mg.beginPath(); mg.moveTo(9, 0); mg.lineTo(-6, -7); mg.lineTo(-6, 7); mg.closePath(); mg.fill(); mg.restore();
  }
}
// Arcade open/close — in-page iframe so in-memory wallet session (address / __walletItems) survives.
// Never location.href navigate away (that wiped Sign-in). Still NEVER write address/token to storage.
function closeArcadeOverlay() {
  const ov = document.getElementById('arcadeov');
  if (!ov) return;
  ov.classList.remove('on');
  const fr = ov.querySelector('#arcadeframe');
  if (fr) fr.src = 'about:blank';
  document.getElementById('warp')?.classList.remove('on');
  warping = false;
  window.__arcadeOpen = false;
}
function openArcadeOverlay(url) {
  let ov = document.getElementById('arcadeov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'arcadeov';
    ov.innerHTML = '<button type="button" id="arcadeovx" class="hudtog">← Lobby</button><iframe id="arcadeframe" title="Arcade game" allow="gamepad; fullscreen"></iframe>';
    document.body.appendChild(ov);
    ov.querySelector('#arcadeovx').addEventListener('click', (e) => { e.preventDefault(); closeArcadeOverlay(); });
    addEventListener('message', (e) => {
      const d = e.data;
      if (d === 'lobby-back' || (d && d.type === 'lobby-back')) closeArcadeOverlay();
    });
  }
  try {
    const u = new URL(url, location.href);
    u.searchParams.set('embed', '1');
    if (wornName && /fighter\//.test(u.pathname)) u.searchParams.set('nft', wornName);
    const tq = toQuery(wornTraits);
    if (tq && /fighter\/|shooter\//.test(u.pathname)) {
      // traits already query-shaped (a=b&c=d); merge
      tq.split('&').forEach(pair => { const [k, v] = pair.split('='); if (k) u.searchParams.set(decodeURIComponent(k), decodeURIComponent(v || '')); });
    }
    ov.querySelector('#arcadeframe').src = u.pathname + u.search + u.hash;
  } catch (_) {
    ov.querySelector('#arcadeframe').src = url + (url.includes('?') ? '&' : '?') + 'embed=1';
  }
  ov.classList.add('on');
  window.__arcadeOpen = true;
  document.getElementById('warp')?.classList.remove('on');
  warping = false;
}
function warpTo(url) {
  if (warping) return; warping = true;
  document.getElementById('warp')?.classList.add('on');
  if (document.pointerLockElement) document.exitPointerLock();
  // In-page overlay for arcade games — keeps Sign-in / __walletItems in memory
  if (/shooter\/|fighter\//.test(url)) {
    setTimeout(() => openArcadeOverlay(url), 280);
    return;
  }
  if (wornName && url.includes('fighter/')) url += (url.includes('?') ? '&' : '?') + 'nft=' + encodeURIComponent(wornName);
  const tq = toQuery(wornTraits); if (tq && /fighter\/|shooter\//.test(url)) url += (url.includes('?') ? '&' : '?') + tq;
  setTimeout(() => { location.href = url; }, 900);
}
window.__openArcadeOverlay = openArcadeOverlay;
window.__closeArcadeOverlay = closeArcadeOverlay;

// v27: portrait phones get a wider view (vertical FOV derived from aspect so horizontal ~68deg, capped 90) + follow cam pulled back
function baseFov(a) { return a < 1 ? Math.min(90, Math.max(65, 2 * Math.atan(Math.tan(34 * Math.PI / 180) / a) * 180 / Math.PI)) : 65; }
const portraitK = () => (innerWidth / innerHeight < 1 ? 1.3 : 1);
function applyViewFov() { camera.aspect = innerWidth / innerHeight; if (!warping) camera.fov = baseFov(camera.aspect); camera.updateProjectionMatrix(); }
applyViewFov();
addEventListener('orientationchange', () => setTimeout(applyViewFov, 150));
addEventListener('resize', () => {
  applyViewFov();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

// step 9: hoppable obstacles = colliders tagged { hop: heightAboveFloor } (benches, planters). Ray vs padded circle.
function hopProbe(p, dir, look) {
  let best = null, bd = Infinity;
  for (const c of colliders) { if (!c.hop) continue; const dx = c.x - p.x, dz = c.z - p.z, along = dx * dir.x + dz * dir.z, m = c.r + 0.4;
    if (along <= 0) continue; const perp = Math.abs(dx * dir.z - dz * dir.x); if (perp > c.r * 0.9) continue; // must be heading at it, not grazing
    const d = along - m; if (d < look && d < bd) { bd = d; best = { c, h: c.hop, depth: c.r * 2 }; } }
  return best;
}

// ---- Loop ----
const getSkinChar = () => (skinChar.visible && char3d) ? char3d : null;
const ctl = new CharacterController(), fcam = new FollowCam(), puffs = new PuffPool(scene); moves = setupMoves(ctl, scene, getSkinChar, floorAt); window.__moves = moves;
const abil = setupAbilities(ctl, scene, getSkinChar, () => yaw, floorAt, puffs); window.__abil = abil;
// On-screen View toggle (same as V key) — sits with special-move (#abil), touch-friendly on 412
function syncViewBtn() {
  const b = document.getElementById('viewbtn');
  if (!b) return;
  const label = frontView ? 'Front' : (thirdPerson ? 'Third' : 'First');
  b.querySelector('.al').textContent = 'View: ' + label;
  b.setAttribute('aria-label', 'Toggle view (V) — now ' + label);
}
{
  let host = document.getElementById('abil');
  if (!host) { host = document.createElement('div'); host.id = 'abil'; document.body.appendChild(host); }
  let vb = document.getElementById('viewbtn');
  if (!vb) {
    vb = document.createElement('button');
    vb.type = 'button'; vb.id = 'viewbtn'; vb.className = 'abilbtn viewbtn';
    vb.innerHTML = '<span class="al">View: First</span><span class="ak">V</span>';
    vb.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      frontView = false; setView(!thirdPerson); syncViewBtn();
    });
    host.appendChild(vb);
  }
  syncViewBtn();
  host.hidden = false; // View toggle always available, even with no NFT abilities
  window.__syncViewBtn = syncViewBtn;
}

window.__forceSkinReady = () => { if (!char3d) return false; skinChar.visible = true; wisp.visible = false; if (window.__wispBlob) window.__wispBlob.visible = false; morphT = -1; pendingTex = null; (char3d.userData.stageList || []).forEach(e => { e.o.visible = e.v; e.done = true; }); char3d.userData.grow = 1; burst.visible = false; flash.visible = false; return true; };
window.__dismissOverlays = () => {
  document.getElementById('introSkip')?.click();
  document.getElementById('overlay')?.classList.add('hidden');
  document.querySelectorAll('#agegate,.agegate,#intro,#hguide,#loadbar').forEach(e => e.remove());
  try { sessionStorage.setItem('guideSeen', '1'); } catch {}
  const skip = [...document.querySelectorAll('#hguide button,button')].find(b => /skip/i.test(b.textContent || ''));
  skip?.click();
};
// Resolve only after the animation loop consumes the step and renders (rAF alone races ?rec early-return)
window.__paintDone = null;
window.__paint = async (n = 3) => {
  for (let i = 0; i < n; i++) {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => { window.__paintDone = null; reject(new Error('paint timeout')); }, 5000);
      window.__paintDone = () => { clearTimeout(t); resolve(); };
      window.__in({ mx: 0, mz: 0, dt: 1 / 30 });
    });
  }
};
window.__stepN = async (n, input) => {
  for (let i = 0; i < n; i++) {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => { window.__paintDone = null; reject(new Error('step timeout')); }, 5000);
      window.__paintDone = () => { clearTimeout(t); resolve(); };
      window.__in(Object.assign({ mx: 0, mz: 0, dt: 1 / 30 }, input || {}));
    });
  }
};
window.__getChar3d = () => char3d; window.__skinVisible = () => skinChar.visible;
window.__renderer = renderer; window.__composer = composer;
window.__applyCollectionAvatar = applyCollectionAvatar;
window.__skin = i => applyCollectionAvatar((collections[0] && collections[0].items || [])[i]);
if (char3d && window.__lastSpec) loadTraitMap().then(m => { moves.set(window.__lastSpec, m); abil.set(window.__lastSpec, m); });
window.__ctl = ctl; // dojo hook later: ctl.hurt(dir)
const clock = new THREE.Clock(), fwd = new THREE.Vector3(), right = new THREE.Vector3();
let walkT = 0, eyeY = null, simT = 0, recIn = null, recStep = 0;
document.getElementById('aura').addEventListener('click', e => { const on = localStorage.getItem('ledgerAura') === 'off'; localStorage.setItem('ledgerAura', on ? 'on' : 'off'); e.currentTarget.textContent = `+1 AURA: ${on ? 'ON' : 'OFF'}`; e.currentTarget.setAttribute('aria-pressed', on); if (char3d && char3d.userData.auraSet) char3d.userData.auraSet(on); e.currentTarget.blur(); });
const boundary = makeBoundary(h => { pos.set(h.x, FLOOR, h.z); vy = 0; ctl.vy = 0; ctl.vel.set(0, 0, 0); yaw = h.yaw; });
let REC_DT = qs.get('rec') ? 1 / 15 : 0;
initDayCycle({ scene, renderer, hemi, sun }); // v34 day/night

// Quality toggle: phones default low; fake bloom on, composer bloom off
// Wrap apply — hudmenus/unityfeel overwrite onchange and would drop lobbyLife caps
{ const perf = window.__perf;
  const applyEnvQ = (low) => {
    if (envAtmos) envAtmos.setLow(!!low);
    if (typeof lobbyLife !== 'undefined' && lobbyLife && lobbyLife.setLow) lobbyLife.setLow(!!low);
    if (bloom) bloom.enabled = !low;
    document.getElementById('envgrade') && (document.getElementById('envgrade').style.opacity = low ? '0.22' : '0.28');
  };
  if (perf) {
    const _apply = perf.apply.bind(perf);
    perf.apply = (low) => { _apply(low); applyEnvQ(!!low); };
    const prev = perf.onchange;
    perf.onchange = (low) => { prev && prev(low); applyEnvQ(low); };
    if (matchMedia('(pointer: coarse)').matches && !perf.low) perf.apply(true);
    else applyEnvQ(!!perf.low);
  }
}

renderer.setAnimationLoop(() => {
  if (REC_DT) { if (recStep <= 0) return; recStep--; }
  const rd = clock.getDelta(), dt = REC_DT || Math.min(rd, 0.05); simT += dt; const t = REC_DT ? simT : clock.elapsedTime;
  let mx = 0, mz = 0;
  if (recIn) { mx = recIn.mx; mz = recIn.mz; yaw = recIn.yaw ?? yaw; }
  else if (active) {
    if (keys.KeyW || keys.ArrowUp) mz += 1;
    if (keys.KeyS || keys.ArrowDown) mz -= 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1;
    mx += jv.x; mz -= jv.y;
  }
  fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); right.set(Math.cos(yaw), 0, -Math.sin(yaw));
  const wish = fwd.clone().multiplyScalar(mz).addScaledVector(right, mx);
  const lim = 70;
  ctl.update(dt, pos, wish, (p, skip) => { p.x = THREE.MathUtils.clamp(p.x, -lim, lim); p.z = THREE.MathUtils.clamp(p.z, -lim, lim);
    for (const c of colliders) { if (c === skip || (c.hop && !ctl.grounded && p.y > FLOOR + c.hop)) continue; const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + 0.4;
      if (d < m && d > 1e-4) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; } }
    collideBoxes(p); }, floorAt, hopProbe);
  vy = ctl.vy;
  for (const ev of ctl.events) { if (ev.type === 'skid') puffs.emit(pos, 10, 2.2, 0.6); if (ev.type === 'land') { puffs.emit(pos, ev.hop ? 6 : 8 + Math.min(10, ev.impact | 0), ev.hop ? 1.6 : 2.5, ev.hop ? 0.4 : 0.7); if (!ev.hop && ev.impact > 2) { envFeel.shake(0.08 + Math.min(0.12, ev.impact * 0.015), 0.18); envFeel.burst(pos, 6 + Math.min(8, ev.impact | 0), 2.2); } } if (ev.type === 'jump') puffs.emit(pos, 5, 1.2, 0.4); if (ev.type === 'hop') puffs.emit(pos, 4, 0.8, 0.3); }
  if (ctl.grounded && ctl.speed > 1) puffs.trail(pos, ctl.speed * dt, 0.9); puffs.update(dt); moves.update(dt, pos); abil && abil.update(dt, pos); tickFeel(ctl, dt);
  if (warping) { camera.fov = Math.min(camera.fov + dt * 120, 140); camera.updateProjectionMatrix(); bloom.strength += dt * 4; }

  const moving = ctl.speed > 0.4;
  walkT += moving ? dt * 9 * Math.min(1.4, ctl.speed / 4) * moves.strideMul() : 0;
  const w = moving ? Math.sin(walkT) : 0;
  rig.position.y = moving ? Math.abs(Math.sin(walkT)) * 0.06 : Math.sin(t * 2) * 0.025; // waddle hop / idle bob
  rig.rotation.z = w * 0.08;                                                           // waddle sway
  legs[0].position.z = -0.03 + w * 0.12; legs[1].position.z = -0.03 - w * 0.12;
  arms[0].rotation.x = -w * 0.5; arms[1].rotation.x = w * 0.5;
  avatar.position.copy(pos); avatar.rotation.y = (thirdPerson && !frontView) ? ctl.facing : yaw; avatar.visible = thirdPerson || frontView;
  if (!(thirdPerson && !frontView)) ctl.facing = yaw; // first-person/front: body follows look

  // smoothed visual Y so ramps/steps never jitter the eye
  eyeY = eyeY === null ? pos.y : (ctl.grounded ? eyeY + (pos.y - eyeY) * (1 - Math.exp(-14 * dt)) : pos.y);
  const eye = new THREE.Vector3(pos.x, eyeY + 1.5, pos.z);
  const look = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  if (frontView) { camera.position.copy(eye).addScaledVector(fwd, 3).y -= 0.1; camera.lookAt(eye.x, eye.y - 0.3, eye.z); fcam.init = false; }
  else if (window.__sideCam) {
    // Side-on capture: camera on character's right (or left if __sideCam < 0), looking at torso
    const side = Math.sign(window.__sideCam) || 1;
    const dist = Math.abs(window.__sideCam) > 1 ? Math.abs(window.__sideCam) : 4.2;
    const r = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(side * dist);
    camera.position.set(eye.x + r.x, eye.y + 0.35, eye.z + r.z);
    camera.lookAt(eye.x, eye.y - 0.15, eye.z);
    fcam.init = false;
  } else if (thirdPerson) {
    const ins = inApt(pos.x, pos.z), dist = ins ? 2.0 : 4.5 * portraitK();
    const des = eye.clone().addScaledVector(look, -fcam.dist).add(new THREE.Vector3(0, ins ? 0.35 : 0.8, 0));
    if (ins) { des.x = THREE.MathUtils.clamp(des.x, APT.x0 + 0.5, APT.x1 - 0.5); des.z = THREE.MathUtils.clamp(des.z, APT.z0 + 0.5, APT.z1 - 0.5); }
    des.y = Math.max(floorAt(des.x, des.z, pos.y) + 0.4, des.y);
    fcam.update(dt, camera, eye, des, dist);
  } else { camera.position.copy(eye); camera.lookAt(eye.clone().add(look)); fcam.init = false; }

  updateHud(t); world3.update(t, dt);
  { const it = nearest(), nearTV = pos.distanceTo(world3.tvPos) < 2.6, show = !isGalleryOpen() && !isNewsOpen() && (it || nearTV);
    showPrompt(show ? (it ? it.hint : 'E: watch Ledger News') : '');
    const eBtn = document.querySelector('#tpad .s-right'); if (eBtn) eBtn.classList.toggle('tp-use-on', !!show);
    polishTick(pos, camera, t, sky); loungeTick(t); }
  swirlMats.forEach(m => { m.uniforms.uTime.value = t; });
  gridMat.uniforms.uTime.value = t;
  holoRings.forEach((r, k) => { r.rotation.z = t * (k % 2 ? -0.3 : 0.2); });
  const mS = motionScale(); islands.forEach((g, k) => { g.position.y += Math.sin(t + k) * 0.004 * mS; g.userData.core.rotation.y = t * (mS || 0.2); }); tickAmbient(ambient, t, dt, mS);
  crystals.forEach((c, k) => { c.rotation.y = t * 0.3 + k; });
  billboards.forEach(({ m, r, k }) => { const a = t * 0.15 + k; m.position.x = Math.sin(a) * r; m.position.z = Math.cos(a) * r; m.rotation.y = a; });
  const pa = pGeo.attributes.position;
  for (let i = 0; i < PN; i++) { let y = pa.getY(i) + dt * (0.6 + (i % 5) * 0.2) * (mS || 0.15); if (y > 25) y = 0; pa.setY(i, y); }
  pa.needsUpdate = true;
  visorTex.offset.x = -t * 0.5;
  visorMat.color.setScalar(Math.random() < 0.03 ? 0.6 : 1).multiply(new THREE.Color(0x6ffcff));
  chestMat.color.set(CYAN).multiplyScalar(0.6 + 0.6 * (0.5 + 0.5 * Math.sin(t * 3)));
  antTip.visible = Math.sin(t * 4) > -0.3;
  kScreen.material.color.set(CYAN).multiplyScalar(0.8 + 0.3 * Math.sin(t * 3));
  boundary(pos.x, pos.z, dt); updateWisp(t, dt); updateSkin(t, dt); eggs.update(t); world6.update(t); world7.update(t, (thirdPerson || frontView) ? avatar : camera);
  envFeel && envFeel.update(dt); envAtmos && envAtmos.update(t, dt);
  lobbyLife && lobbyLife.update(t, dt);
  composer.render();
  if (window.__paintDone) { const d = window.__paintDone; window.__paintDone = null; d(); }
});
// step 6: tokens in HUD + ambient sound toggle (button or N)
{ const tk = document.getElementById('tokens'), snd = document.getElementById('snd');
  const upd = () => { const v = `Tokens: ${arcadeLoad().tokens}`; if (tk.textContent !== v) tk.textContent = v; }; upd(); addEventListener('storage', upd); addEventListener('focus', upd); setInterval(upd, 5000); // v17: write only on change
  const tog = () => { const on = toggleAmbient(); setSfxEnabled(on); snd.textContent = `Sound: ${on ? 'on' : 'off'} (N)`; };
  snd.addEventListener('click', tog); addEventListener('keydown', e => { if (e.code === 'KeyN') tog(); }); }
// recording hook (only with ?rec=1): lets tools/rec6.py drive the camera along a path
if (qs.get('rec')) { window.__rec = (x, z, y, yw, pt) => { pos.set(x, y, z); vy = 0; ctl.vy = 0; yaw = yw; pitch = pt; };
  window.__pinRain = (x, z) => world7.pinRain(x, z);
  window.__skin = i => applyCollectionAvatar(collections[0].items[i]);
  window.__applyCollectionAvatar = applyCollectionAvatar;
  window.__scene = scene; window.__camera = camera; window.THREE_V = THREE.Vector3; window.__pos = () => [+pos.x.toFixed(2), +pos.z.toFixed(2)];
  window.__in = o => { recIn = o; recStep = 1; if (o && o.dt) REC_DT = o.dt; if (o && o.jump) ctl.jump(); if (o && o.pitch !== undefined) pitch = o.pitch; if (o && o.view) setView(true); }; }
// Unstuck: clear stuck input, cancel ability/flight, snap to nearest plaza-safe spot (KeyU — unique per test:keys)
const PLAZA_SAFE = [{ x: 0, z: 0 }, { x: 3, z: 3 }, { x: -3, z: 3 }, { x: 3, z: -3 }, { x: -3, z: -3 }, { x: 0, z: 6 }];
window.__unstuckReadyAt = 0;
window.__unstuck = () => {
  const now = performance.now();
  if (now < (window.__unstuckReadyAt || 0)) return false;
  window.__unstuckReadyAt = now + 2500; // wall-clock CD — survives long frames / hitchy devices
  joyRecentre();
  for (const k of Object.keys(keys)) keys[k] = false;
  if (ctl) { ctl.vel.set(0, 0, 0); ctl.vy = 0; ctl.grounded = true; ctl.lockT = 0; }
  if (abil && abil.cancel) abil.cancel();
  // pick nearest safe plaza spot from current pos
  let best = PLAZA_SAFE[0], bd = Infinity;
  for (const s of PLAZA_SAFE) { const d = (pos.x - s.x) ** 2 + (pos.z - s.z) ** 2; if (d < bd) { bd = d; best = s; } }
  const fy = typeof floorAt === 'function' ? floorAt(best.x, best.z, pos.y) : (typeof FLOOR === 'number' ? FLOOR : 0);
  pos.set(best.x, fy, best.z);
  if (window.__lobby) window.__lobby.pos = pos;
  return true;
};
addEventListener('keydown', e => {
  if (e.code === 'KeyU' && !e.repeat && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) {
    e.preventDefault(); window.__unstuck();
  }
});


// v13: HUD row on top of minimap; shared touch controller (touchpad.js) with the lobby layout
{ const row = document.getElementById('mmrow');
  if (tp.isTouch) { document.body.classList.add('touch'); active = true; overlay.classList.add('hidden'); }
  tp.setLayout(tp.LAYOUTS.lobby);
  // HUD settings: size + opacity, CSS variables only (in memory, never stored)
  // Gear lives on body — #hub #mmrow is display:none after declutter (Beans: "Got no hud")
  const gear = Object.assign(document.createElement('button'), { type: 'button', id: 'hudgear', textContent: '\u2699 HUD', title: 'HUD size & opacity' });
  document.body.append(gear);
  // Fullscreen toggle (Beans 2026-11-05): grouped right of Invite; hidden where unsupported (iPhone Safari)
  { const de = document.documentElement, req = de.requestFullscreen || de.webkitRequestFullscreen, fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
    if (!document.getElementById('hudfs') && req && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
      const fb = Object.assign(document.createElement('button'), { type: 'button', id: 'hudfs', textContent: '\u26f6', title: 'Fullscreen' }); fb.setAttribute('aria-label', 'Toggle fullscreen');
      ['pointerdown', 'touchstart', 'mousedown'].forEach(t => fb.addEventListener(t, e => e.stopPropagation(), { passive: true }));
      fb.onclick = e => { e.stopPropagation(); if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else { const r = (de.requestFullscreen || de.webkitRequestFullscreen).call(de); r && r.catch && r.catch(() => {}); } fb.blur(); };
      const sync = () => { fb.textContent = fsEl() ? '\u2715' : '\u26f6'; fb.title = fsEl() ? 'Exit fullscreen' : 'Fullscreen'; };
      document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync);
      const place = () => { const iv = [...document.querySelectorAll('.rbtn')].find(b => /invite/i.test(b.textContent)); if (iv) { fb.className = 'rbtn'; fb.removeAttribute('style'); Object.assign(fb.style, { position: 'absolute', left: 'calc(100% + 6px)', top: '0' }); iv.parentNode.append(fb); return; } const ib = document.getElementById('walletBtn'); if (fb.parentNode !== document.body) document.body.append(fb); if (!ib) return; const b = ib.getBoundingClientRect(), cs = getComputedStyle(ib);
        Object.assign(fb.style, { position: 'fixed', zIndex: 40, top: b.top + 'px', left: Math.max(0, b.left - b.height - 6) + 'px', width: b.height + 'px', height: b.height + 'px', padding: 0, borderRadius: cs.borderRadius, border: cs.border, background: cs.background, color: cs.color, font: '600 18px sans-serif', cursor: 'pointer' }); };
      place(); setTimeout(place, 1500); addEventListener('resize', () => setTimeout(place, 50)); } }
  const hs = Object.assign(document.createElement('div'), { id: 'hudset' }); hs.innerHTML = '<b>HUD settings</b><label>Size <span id="hsv">75%</span><input id="hsize" type="range" min="50" max="130" value="75"></label><label>Opacity <span id="hov">55%</span><input id="hop" type="range" min="20" max="100" value="55"></label><div class="hsave"><b>Arcade save</b><button type="button" id="sexp">Export</button><label class="mpick">Import<input id="simp" type="file" accept="application/json,.json" hidden></label><p id="smsg" class="gsub">Stays on this device. Files are checked before use.</p></div><button type="button" id="hsclose">Done</button>';
  document.body.append(hs); hs.insertBefore(document.getElementById('snd'), hs.children[1]); const rs = document.documentElement.style;
  gear.onclick = () => hs.classList.toggle('on');
  hs.querySelector('#sexp').onclick = async () => { const a = document.createElement('a'), u = URL.createObjectURL(new Blob([await exportSave()], { type: 'application/json' })); a.href = u; a.download = 'lobby-arcade-save.json'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); };
  hs.querySelector('#simp').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const err = await importSave(await f.text()); hs.querySelector('#smsg').textContent = err || 'Save imported. Reloading…'; if (!err) setTimeout(() => location.reload(), 600); }; hs.querySelector('#hsclose').onclick = () => hs.classList.remove('on');
  rs.setProperty('--hud-scale', .75); hs.querySelector('#hsize').oninput = e => { rs.setProperty('--hud-scale', e.target.value / 100); hs.querySelector('#hsv').textContent = e.target.value + '%'; };
  hs.querySelector('#hop').oninput = e => { rs.setProperty('--hud-op', e.target.value / 100); hs.querySelector('#hov').textContent = e.target.value + '%'; };
  // Back inside the lobby closes any open overlay/panel instead of leaving the site
  tp.trapBack(() => { dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })); document.querySelectorAll('.on').forEach(e => { if (e.id && /panel|skin/i.test(e.id)) e.classList.remove('on'); }); tp.setLayout(tp.LAYOUTS.lobby); }); }
try { initHudMenus({ perf }); } catch (e) { console.warn("hud menus", e); } // v16: runs last so Sound ends up inside Settings
