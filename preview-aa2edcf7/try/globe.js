/* Live Testnet node globe — Three.js r169, self-hosted. */
import * as THREE from "./lib/three.module.js";
import { EffectComposer } from "./lib/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "./lib/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "./lib/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "./lib/addons/postprocessing/OutputPass.js";

var MAX_LABELS = 6;
var RADIUS = 2.35;

function reducedMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function isMobile() {
  return window.matchMedia && window.matchMedia("(max-width:720px)").matches;
}
function hasWebGL() {
  try {
    var c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch (e) { return false; }
}
function fibonacci(i, n, r) {
  var golden = Math.PI * (3 - Math.sqrt(5));
  var y = n <= 1 ? 0 : 1 - (i / (n - 1)) * 2;
  var rad = Math.sqrt(Math.max(0, 1 - y * y));
  var theta = golden * i;
  return new THREE.Vector3(Math.cos(theta) * rad * r, y * r, Math.sin(theta) * rad * r);
}
function ring(i, n, r) {
  var a = (i / n) * Math.PI * 2 - Math.PI / 2;
  return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
}
function shortKey(k) {
  if (!k || k.length < 10) return k || "";
  return k.slice(0, 6) + "…" + k.slice(-4);
}

function createGlobe(root) {
  var mobile = isMobile();
  var lowPower = mobile || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    (navigator.connection && navigator.connection.saveData);
  var nodeCount = mobile ? 24 : 36;
  var neighborsK = 3;
  var useBloom = !lowPower;

  var canvas = root.querySelector("#globe-canvas");
  var labelLayer = root.querySelector("#globe-labels");
  var leaderSvg = root.querySelector("#globe-leaders");
  var hint = root.querySelector(".globe-hint");

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !mobile, alpha: false, powerPreference: "low-power" });
  renderer.setClearColor(0x0b161c, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
  camera.position.set(0, 0.15, 7.2);

  var group = new THREE.Group();
  scene.add(group);
  scene.add(new THREE.AmbientLight(0x88a099, 0.55));
  var keyLight = new THREE.DirectionalLight(0xdeffee, 0.65);
  keyLight.position.set(2, 3, 4);
  scene.add(keyLight);

  var ringPos = [];
  var spherePos = [];
  var i;
  for (i = 0; i < nodeCount; i++) {
    ringPos.push(ring(i, nodeCount, RADIUS));
    spherePos.push(fibonacci(i, nodeCount, RADIUS));
  }

  /* k-nearest neighbours from the final sphere, so edges stay stable during the morph */
  var edges = [];
  var edgeSet = {};
  for (i = 0; i < nodeCount; i++) {
    var dists = [];
    var j;
    for (j = 0; j < nodeCount; j++) {
      if (i === j) continue;
      dists.push({ j: j, d: spherePos[i].distanceToSquared(spherePos[j]) });
    }
    dists.sort(function (a, b) { return a.d - b.d; });
    for (j = 0; j < neighborsK; j++) {
      var a = i, b = dists[j].j;
      var key = a < b ? a + "-" + b : b + "-" + a;
      if (edgeSet[key]) continue;
      edgeSet[key] = true;
      edges.push([a, b]);
    }
  }

  var segs = mobile ? 10 : 18;
  var geo = new THREE.SphereGeometry(0.07, segs, segs);
  var nodes = [];
  var baseEmissive = 0.62;
  for (i = 0; i < nodeCount; i++) {
    var mat = new THREE.MeshStandardMaterial({
      color: 0x00e676,
      emissive: 0x00ff99,
      emissiveIntensity: baseEmissive,
      roughness: 0.32,
      metalness: 0.08
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(ringPos[i]);
    group.add(mesh);
    nodes.push({
      mesh: mesh,
      mat: mat,
      ring: ringPos[i],
      sphere: spherePos[i],
      pulse: 0,
      key: null,
      lastSeen: 0
    });
  }

  var edgePositions = new Float32Array(edges.length * 6);
  var edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute("position", new THREE.BufferAttribute(edgePositions, 3));
  var edgeMat = new THREE.LineBasicMaterial({
    color: 0x00ff99,
    transparent: true,
    opacity: 0.38,
    depthWrite: false
  });
  var edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
  group.add(edgeLines);

  function writeEdges() {
    var p = edgePositions;
    var e, n, a, b, off;
    for (e = 0; e < edges.length; e++) {
      a = nodes[edges[e][0]].mesh.position;
      b = nodes[edges[e][1]].mesh.position;
      off = e * 6;
      p[off] = a.x; p[off + 1] = a.y; p[off + 2] = a.z;
      p[off + 3] = b.x; p[off + 4] = b.y; p[off + 5] = b.z;
    }
    edgeGeo.attributes.position.needsUpdate = true;
    edgeGeo.computeBoundingSphere();
  }
  writeEdges();

  /* Packets + short trails */
  var pktGeo = new THREE.SphereGeometry(0.06, 10, 10);
  var packets = [];
  function spawnPacket(path) {
    if (!path || path.length < 2) return;
    var mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 1 });
    var mesh = new THREE.Mesh(pktGeo, mat);
    group.add(mesh);
    var trail = [];
    var t, tm;
    for (t = 0; t < 6; t++) {
      tm = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.35 - t * 0.05 });
      var m = new THREE.Mesh(pktGeo, tm);
      m.scale.setScalar(0.7 - t * 0.08);
      group.add(m);
      trail.push(m);
    }
    packets.push({ mesh: mesh, mat: mat, trail: trail, path: path, u: 0, speed: 0.85 + Math.random() * 0.25, alive: true, history: [] });
  }
  function packetPos(pkt, u, out) {
    var segs = pkt.path.length - 1;
    var t = Math.min(Math.max(u, 0), 0.9999) * segs;
    var i0 = Math.floor(t);
    var f = t - i0;
    var a = nodes[pkt.path[i0]].mesh.position;
    var b = nodes[pkt.path[i0 + 1]].mesh.position;
    out.lerpVectors(a, b, f);
    return out;
  }
  var _tmp = new THREE.Vector3();
  function updatePackets(dt) {
    var p, k, h;
    for (p = packets.length - 1; p >= 0; p--) {
      var pkt = packets[p];
      if (!pkt.alive) continue;
      pkt.u += dt * pkt.speed;
      if (pkt.u >= 1) {
        pkt.alive = false;
        group.remove(pkt.mesh);
        pkt.mesh.material.dispose();
        for (k = 0; k < pkt.trail.length; k++) { group.remove(pkt.trail[k]); pkt.trail[k].material.dispose(); }
        packets.splice(p, 1);
        continue;
      }
      packetPos(pkt, pkt.u, pkt.mesh.position);
      pkt.history.unshift(pkt.mesh.position.clone());
      if (pkt.history.length > 8) pkt.history.pop();
      for (k = 0; k < pkt.trail.length; k++) {
        h = pkt.history[k + 1];
        if (h) { pkt.trail[k].position.copy(h); pkt.trail[k].visible = true; }
        else pkt.trail[k].visible = false;
      }
    }
  }

  function hopPath(from, hops) {
    var path = [from];
    var cur = from;
    var h, opts, e, n;
    for (h = 0; h < hops; h++) {
      opts = [];
      for (e = 0; e < edges.length; e++) {
        if (edges[e][0] === cur) opts.push(edges[e][1]);
        else if (edges[e][1] === cur) opts.push(edges[e][0]);
      }
      if (!opts.length) break;
      n = opts[(Math.random() * opts.length) | 0];
      if (n === path[path.length - 1] && opts.length > 1) n = opts[(opts.indexOf(n) + 1) % opts.length];
      path.push(n);
      cur = n;
    }
    return path.length >= 2 ? path : null;
  }

  /* Bloom */
  var composer = null;
  var bloomPass = null;
  function sizeRenderer() {
    var w = root.clientWidth || 640;
    var h = Math.max(280, root.clientHeight || (isMobile() ? 300 : 420));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(w, h);
    if (bloomPass) bloomPass.setSize(w, h);
    leaderSvg.setAttribute("viewBox", "0 0 " + w + " " + h);
    leaderSvg.setAttribute("width", String(w));
    leaderSvg.setAttribute("height", String(h));
  }
  if (useBloom) {
    composer = new EffectComposer(renderer);
    var renderPass = new RenderPass(scene, camera);
    renderPass.clear = true;
    renderPass.clearColor = new THREE.Color(0x0b161c);
    renderPass.clearAlpha = 1;
    composer.addPass(renderPass);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.48, 0.28, 0.52);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }
  sizeRenderer();

  /* Morph + interaction */
  var morph = 0;
  var morphing = false;
  var morphFrom = 0;
  var autoRotate = true;
  var dragging = false;
  var lastX = 0, lastY = 0;
  var velX = 0, velY = 0;
  var visible = false;
  var running = false;
  var slowFrames = 0;

  function applyMorph(t) {
    var s = t * t * (3 - 2 * t);
    var n;
    for (n = 0; n < nodes.length; n++) {
      nodes[n].mesh.position.lerpVectors(nodes[n].ring, nodes[n].sphere, s);
    }
    writeEdges();
  }
  function startMorph() {
    if (morph >= 1) return;
    morphing = true;
    morphFrom = performance.now();
  }

  function nodeIndexForKey(key) {
    var n, empty = -1;
    for (n = 0; n < nodes.length; n++) {
      if (nodes[n].key === key) return n;
      if (empty < 0 && !nodes[n].key) empty = n;
    }
    if (empty >= 0) { nodes[empty].key = key; return empty; }
    /* evict oldest */
    var oldest = 0, t = nodes[0].lastSeen;
    for (n = 1; n < nodes.length; n++) {
      if (nodes[n].lastSeen < t) { t = nodes[n].lastSeen; oldest = n; }
    }
    nodes[oldest].key = key;
    return oldest;
  }

  function pulseNode(idx, amount) {
    if (idx == null || !nodes[idx]) return;
    nodes[idx].pulse = Math.max(nodes[idx].pulse, amount || 1);
  }

  /* Labels + leader lines as SVG (CSP-safe, no element.style) */
  var labelPool = [];
  function ensureLabels() {
    if (labelPool.length) return;
    var L;
    for (L = 0; L < MAX_LABELS; L++) {
      var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("class", "globe-leader");
      leaderSvg.appendChild(line);
      var tx = document.createElementNS("http://www.w3.org/2000/svg", "text");
      tx.setAttribute("class", "globe-label-text");
      leaderSvg.appendChild(tx);
      labelPool.push({ tx: tx, line: line });
    }
  }
  var proj = new THREE.Vector3();
  function updateLabels() {
    ensureLabels();
    var w = canvas.clientWidth || 1;
    var h = canvas.clientHeight || 1;
    var now = performance.now();
    var ranked = nodes
      .map(function (n, idx) { return { n: n, idx: idx, score: n.key ? n.lastSeen : 0 }; })
      .filter(function (x) { return x.n.key && (now - x.n.lastSeen) < 14000; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, isMobile() ? 3 : MAX_LABELS);
    var i, item, tx, line, x, y, side, lx, ly;
    for (i = 0; i < labelPool.length; i++) {
      item = ranked[i];
      tx = labelPool[i].tx;
      line = labelPool[i].line;
      if (!item) {
        tx.textContent = "";
        line.setAttribute("x1", "0"); line.setAttribute("x2", "0");
        line.setAttribute("y1", "0"); line.setAttribute("y2", "0");
        continue;
      }
      proj.copy(item.n.mesh.position).applyMatrix4(group.matrixWorld).project(camera);
      if (proj.z > 1) { tx.textContent = ""; continue; }
      x = (proj.x * 0.5 + 0.5) * w;
      y = (-proj.y * 0.5 + 0.5) * h;
      side = (item.idx % 2 === 0) ? 1 : -1;
      lx = Math.max(8, Math.min(w - 8, x + side * 72));
      ly = Math.max(14, Math.min(h - 6, y - 28));
      tx.textContent = shortKey(item.n.key);
      tx.setAttribute("x", String(lx));
      tx.setAttribute("y", String(ly));
      tx.setAttribute("text-anchor", side > 0 ? "start" : "end");
      line.setAttribute("x1", String(x));
      line.setAttribute("y1", String(y));
      line.setAttribute("x2", String(lx));
      line.setAttribute("y2", String(ly));
    }
  }

  var clock = new THREE.Clock();
  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    var dt = Math.min(clock.getDelta(), 0.05);
    var now = performance.now();
    if (morphing) {
      morph = Math.min(1, (now - morphFrom) / 2000);
      applyMorph(morph);
      if (morph >= 1) morphing = false;
    }
    if (!dragging && autoRotate) group.rotation.y += dt * 0.18;
    if (!dragging) {
      velX *= 0.92; velY *= 0.92;
      group.rotation.y += velX * 0.005;
      group.rotation.x = Math.max(-0.9, Math.min(0.9, group.rotation.x + velY * 0.005));
    }
    var n, inten, s;
    for (n = 0; n < nodes.length; n++) {
      if (nodes[n].pulse > 0) {
        nodes[n].pulse = Math.max(0, nodes[n].pulse - dt * 1.4);
      }
      inten = baseEmissive + nodes[n].pulse * 1.5;
      nodes[n].mat.emissiveIntensity = inten;
      s = 1 + nodes[n].pulse * 0.28;
      nodes[n].mesh.scale.setScalar(s);
    }
    updatePackets(dt);
    var t0 = performance.now();
    if (composer && useBloom) composer.render();
    else renderer.render(scene, camera);
    var frameMs = performance.now() - t0;
    if (useBloom && frameMs > 22) {
      slowFrames += 1;
      if (slowFrames > 12) { useBloom = false; }
    } else slowFrames = Math.max(0, slowFrames - 1);
    updateLabels();
  }

  function onDown(ev) {
    dragging = true;
    autoRotate = false;
    var pt = ev.touches ? ev.touches[0] : ev;
    lastX = pt.clientX; lastY = pt.clientY;
    velX = 0; velY = 0;
    ev.preventDefault();
  }
  function onMove(ev) {
    if (!dragging) return;
    var pt = ev.touches ? ev.touches[0] : ev;
    var dx = pt.clientX - lastX, dy = pt.clientY - lastY;
    group.rotation.y += dx * 0.008;
    group.rotation.x = Math.max(-0.9, Math.min(0.9, group.rotation.x + dy * 0.008));
    velX = dx; velY = dy;
    lastX = pt.clientX; lastY = pt.clientY;
    ev.preventDefault();
  }
  function onUp() {
    dragging = false;
    setTimeout(function () { if (!dragging) autoRotate = true; }, 1400);
  }
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  canvas.addEventListener("touchstart", onDown, { passive: false });
  window.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("touchend", onUp);
  var ro = new ResizeObserver(sizeRenderer);
  ro.observe(root);

  if (hint) hint.textContent = "Drag to rotate · starts as a ring, then becomes a 3D network";

  return {
    ok: true,
    start: function () { startMorph(); },
    setVisible: function (on) {
      visible = !!on;
      root.hidden = !on;
      if (on) {
        sizeRenderer();
        if (!running) { running = true; clock.getDelta(); requestAnimationFrame(tick); }
        setTimeout(startMorph, 700);
      }
    },
    onValidation: function (info) {
      if (!info || !info.key) return;
      var idx = nodeIndexForKey(info.key);
      nodes[idx].lastSeen = performance.now();
      pulseNode(idx, 1);
    },
    onLedgerClosed: function () {
      var n;
      for (n = 0; n < nodes.length; n++) pulseNode(n, 0.45);
    },
    onSubmit: function () {
      var start = (Math.random() * nodeCount) | 0;
      spawnPacket(hopPath(start, 5));
      pulseNode(start, 0.8);
    },
    onProposed: function () {
      var start = (Math.random() * nodeCount) | 0;
      spawnPacket(hopPath(start, 4));
    },
    onValidated: function () {
      var n;
      for (n = 0; n < nodes.length; n++) pulseNode(n, 1);
    },
    dispose: function () {
      running = false;
      ro.disconnect();
    }
  };
}

var api = {
  ok: false,
  setVisible: function () {},
  start: function () {},
  onValidation: function () {},
  onLedgerClosed: function () {},
  onSubmit: function () {},
  onProposed: function () {},
  onValidated: function () {}
};

(function init() {
  var root = document.getElementById("globe-root");
  if (!root) return;
  if (reducedMotion() || !hasWebGL()) {
    api.ok = false;
    root.hidden = true;
    return;
  }
  try {
    var g = createGlobe(root);
    api = g;
    api.ok = true;
  } catch (e) {
    api.ok = false;
    root.hidden = true;
  }
})();

window.LiveGlobe = api;
