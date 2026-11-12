/* Live Testnet node globe — Three.js r169, self-hosted.
   Hop-by-hop packet travel along edges (illustrative paths).
   Validator keys and ledger closes are real Testnet data. */
import * as THREE from "./lib/three.module.js";
import { EffectComposer } from "./lib/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "./lib/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "./lib/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "./lib/addons/postprocessing/OutputPass.js";

var MAX_LABELS = 6;
var RADIUS = 2.35;

function reducedMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) ||
    !!(document.body && document.body.classList.contains("reduce-motion"));
}
function isMobile() {
  return window.matchMedia && window.matchMedia("(max-width:720px)").matches;
}
function isPortrait() {
  return window.matchMedia && window.matchMedia("(orientation: portrait)").matches;
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

function makeFollow() {
  return {
    playing: false,
    stage: "idle",
    hopsDone: 0,
    ledger: null,
    realProposed: false,
    realAgree: false,
    realValidated: false,
    listener: null
  };
}

function describeFollow(f) {
  var stage = f.stage || "idle";
  var map = {
    idle: {
      text: "Follow a payment hop by hop.",
      note: "Paths are illustrative. Ledger closes and validator keys are real."
    },
    submitted: {
      text: "Submitted.",
      note: "The submit is real. The hops you see next are illustrative."
    },
    relayed: {
      text: "Relayed to peers.",
      note: "This hop is illustrative — we cannot see the real peer routing."
    },
    proposed: {
      text: "Proposed.",
      note: "The connected server has seen this payment as proposed (real)."
    },
    agree: {
      text: "Validators agree.",
      note: "These pulses come from real Testnet validation messages."
    },
    validated: {
      text: f.ledger != null ? ("Validated in ledger " + f.ledger + ".") : "Validated.",
      note: "Ledger index and close time are real. A validated payment cannot be reversed."
    },
    waiting: {
      text: "Waiting for the next real Testnet event…",
      note: "Ledger and validation data are real. Paths stay illustrative."
    }
  };
  return map[stage] || map.idle;
}

function notifyFollow(f) {
  if (typeof f.listener === "function") f.listener(describeFollow(f), f);
}

function createGlobe(root) {
  var mobile = isMobile();
  var lowPower = mobile || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    (navigator.connection && navigator.connection.saveData);
  var nodeCount = mobile ? 24 : 36;
  var neighborsK = 3;
  var useBloom = !lowPower && !reducedMotion();

  var canvas = root.querySelector("#globe-canvas");
  var leaderSvg = root.querySelector("#globe-leaders");
  var hint = root.querySelector(".globe-hint");
  var tapEl = root.querySelector("#globe-tap");
  var fallbackSvg = root.querySelector("#globe-fallback");
  if (fallbackSvg) fallbackSvg.hidden = true;
  if (canvas) canvas.hidden = false;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !mobile, alpha: false, powerPreference: "low-power" });
  renderer.setClearColor(0x0b161c, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  var scene = new THREE.Scene();
  var BASE_FOV = 42;
  var BASE_Z = 7.2;
  var camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 40);
  camera.position.set(0, 0.15, BASE_Z);

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

  var nodeGeo = new THREE.SphereGeometry(0.085, 12, 12);
  var baseEmissive = 0.55;
  var nodes = [];
  for (i = 0; i < nodeCount; i++) {
    var mat = new THREE.MeshStandardMaterial({
      color: 0x00ff99,
      emissive: 0x00ff99,
      emissiveIntensity: baseEmissive,
      roughness: 0.35,
      metalness: 0.1
    });
    var mesh = new THREE.Mesh(nodeGeo, mat);
    mesh.position.copy(ringPos[i]);
    mesh.userData.idx = i;
    group.add(mesh);
    nodes.push({
      mesh: mesh,
      mat: mat,
      ring: ringPos[i],
      sphere: spherePos[i],
      key: "",
      lastSeen: 0,
      pulse: 0
    });
  }

  /* k-nearest neighbours from the final sphere, so edges stay stable during the morph */
  var edges = [];
  var edgeSet = {};
  var a, b, d, list, e, k;
  for (a = 0; a < nodeCount; a++) {
    list = [];
    for (b = 0; b < nodeCount; b++) {
      if (a === b) continue;
      d = spherePos[a].distanceTo(spherePos[b]);
      list.push({ b: b, d: d });
    }
    list.sort(function (x, y) { return x.d - y.d; });
    for (k = 0; k < neighborsK; k++) {
      b = list[k].b;
      var key = a < b ? a + "-" + b : b + "-" + a;
      if (edgeSet[key]) continue;
      edgeSet[key] = true;
      edges.push([a, b]);
    }
  }

  var edgePositions = new Float32Array(edges.length * 6);
  var edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute("position", new THREE.BufferAttribute(edgePositions, 3));
  var edgeMat = new THREE.LineBasicMaterial({
    color: 0x00ff99,
    transparent: true,
    opacity: 0.28
  });
  var edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
  group.add(edgeLines);

  function writeEdges() {
    var p = edgePositions;
    var e, a, b, i = 0;
    for (e = 0; e < edges.length; e++) {
      a = nodes[edges[e][0]].mesh.position;
      b = nodes[edges[e][1]].mesh.position;
      p[i++] = a.x; p[i++] = a.y; p[i++] = a.z;
      p[i++] = b.x; p[i++] = b.y; p[i++] = b.z;
    }
    edgeGeo.attributes.position.needsUpdate = true;
    edgeGeo.computeBoundingSphere();
  }
  writeEdges();

  /* Active hop highlight (cyan line along the current edge) */
  var hopPosArr = new Float32Array(6);
  var hopGeo = new THREE.BufferGeometry();
  hopGeo.setAttribute("position", new THREE.BufferAttribute(hopPosArr, 3));
  var hopMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.95 });
  var hopLine = new THREE.Line(hopGeo, hopMat);
  hopLine.visible = false;
  group.add(hopLine);

  function setHopLine(fromIdx, toPos, on) {
    if (!on) { hopLine.visible = false; return; }
    var a = nodes[fromIdx].mesh.position;
    hopPosArr[0] = a.x; hopPosArr[1] = a.y; hopPosArr[2] = a.z;
    hopPosArr[3] = toPos.x; hopPosArr[4] = toPos.y; hopPosArr[5] = toPos.z;
    hopGeo.attributes.position.needsUpdate = true;
    hopLine.visible = true;
  }

  var follow = makeFollow();
  var pktGeo = new THREE.SphereGeometry(0.11, 12, 12);
  var packets = [];
  var followPkt = null;

  function clearPacket(pkt) {
    if (!pkt) return;
    group.remove(pkt.mesh);
    pkt.mesh.material.dispose();
    var t;
    for (t = 0; t < pkt.trail.length; t++) {
      group.remove(pkt.trail[t]);
      pkt.trail[t].material.dispose();
    }
    if (pkt === followPkt) followPkt = null;
  }

  function spawnPacket(path, isFollow) {
    if (!path || path.length < 2) return null;
    if (isFollow && followPkt) {
      var ix = packets.indexOf(followPkt);
      clearPacket(followPkt);
      if (ix >= 0) packets.splice(ix, 1);
    }
    var mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 1 });
    var mesh = new THREE.Mesh(pktGeo, mat);
    group.add(mesh);
    var trail = [];
    var t, tm, m;
    for (t = 0; t < 7; t++) {
      tm = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.42 - t * 0.05 });
      m = new THREE.Mesh(pktGeo, tm);
      m.scale.setScalar(0.78 - t * 0.08);
      group.add(m);
      trail.push(m);
    }
    var pkt = {
      mesh: mesh,
      mat: mat,
      trail: trail,
      path: path,
      hop: 0,
      u: 0,
      speed: reducedMotion() ? 99 : 1.2,
      dwell: 0,
      arrived: false,
      alive: true,
      waiting: false,
      history: [],
      follow: !!isFollow
    };
    mesh.position.copy(nodes[path[0]].mesh.position);
    pulseNode(path[0], 0.9);
    packets.push(pkt);
    if (isFollow) followPkt = pkt;
    return pkt;
  }

  function packetEdgePos(pkt, out) {
    var a = nodes[pkt.path[pkt.hop]].mesh.position;
    var b = nodes[pkt.path[pkt.hop + 1]].mesh.position;
    out.lerpVectors(a, b, Math.min(Math.max(pkt.u, 0), 1));
    return out;
  }

  var _tmp = new THREE.Vector3();
  function finishHop(pkt) {
    var arrived = pkt.path[pkt.hop + 1];
    pulseNode(arrived, 1);
    pkt.arrived = true;
    pkt.dwell = reducedMotion() ? 0.05 : 0.22;
    if (pkt.follow) {
      follow.hopsDone += 1;
      if (follow.stage === "submitted" || follow.stage === "idle") {
        follow.stage = "relayed";
        notifyFollow(follow);
      } else if (follow.stage === "relayed") {
        notifyFollow(follow);
      }
    }
  }

  function advanceOrEnd(pkt) {
    if (pkt.hop + 1 < pkt.path.length - 1) {
      pkt.hop += 1;
      pkt.u = 0;
      pkt.arrived = false;
      pkt.dwell = 0;
      pkt.waiting = !follow.playing && pkt.follow;
      return;
    }
    pkt.alive = false;
    setHopLine(0, _tmp, false);
    if (pkt.follow) {
      followPkt = null;
      if (!follow.realProposed && !follow.realValidated) {
        follow.stage = "waiting";
        notifyFollow(follow);
      }
    }
  }

  function updatePackets(dt) {
    var p, k, h, pkt;
    for (p = packets.length - 1; p >= 0; p--) {
      pkt = packets[p];
      if (!pkt.alive) {
        clearPacket(pkt);
        packets.splice(p, 1);
        continue;
      }
      if (pkt.follow && !follow.playing && pkt.waiting) {
        packetEdgePos(pkt, pkt.mesh.position);
        setHopLine(pkt.path[pkt.hop], pkt.mesh.position, true);
        continue;
      }
      if (pkt.arrived) {
        pkt.dwell -= dt;
        packetEdgePos(pkt, pkt.mesh.position);
        setHopLine(pkt.path[pkt.hop], pkt.mesh.position, true);
        if (pkt.dwell <= 0) {
          if (pkt.follow && !follow.playing) {
            pkt.waiting = true;
            continue;
          }
          advanceOrEnd(pkt);
          if (!pkt.alive) {
            clearPacket(pkt);
            packets.splice(p, 1);
            continue;
          }
        } else {
          continue;
        }
      }
      pkt.u += dt * pkt.speed;
      if (pkt.u >= 1) {
        pkt.u = 1;
        packetEdgePos(pkt, pkt.mesh.position);
        setHopLine(pkt.path[pkt.hop], pkt.mesh.position, true);
        finishHop(pkt);
      } else {
        packetEdgePos(pkt, pkt.mesh.position);
        setHopLine(pkt.path[pkt.hop], pkt.mesh.position, true);
      }
      pkt.history.unshift(pkt.mesh.position.clone());
      if (pkt.history.length > 10) pkt.history.pop();
      for (k = 0; k < pkt.trail.length; k++) {
        h = pkt.history[k + 1];
        if (h) { pkt.trail[k].position.copy(h); pkt.trail[k].visible = true; }
        else pkt.trail[k].visible = false;
      }
    }
    if (!packets.length) hopLine.visible = false;
  }

  function hopPath(from, hops) {
    var path = [from];
    var cur = from;
    var h, opts, e, n, prev;
    for (h = 0; h < hops; h++) {
      opts = [];
      for (e = 0; e < edges.length; e++) {
        if (edges[e][0] === cur) opts.push(edges[e][1]);
        else if (edges[e][1] === cur) opts.push(edges[e][0]);
      }
      if (!opts.length) break;
      prev = path[path.length - 1];
      n = opts[(Math.random() * opts.length) | 0];
      if (n === prev && opts.length > 1) n = opts[(opts.indexOf(n) + 1) % opts.length];
      path.push(n);
      cur = n;
    }
    return path.length >= 2 ? path : null;
  }

  function nextHop() {
    var pkt = followPkt;
    if (!pkt || !pkt.alive) {
      var start = (Math.random() * nodeCount) | 0;
      follow.playing = false;
      if (follow.stage === "idle" || follow.stage === "waiting") {
        follow.stage = "relayed";
        notifyFollow(follow);
      }
      spawnPacket(hopPath(start, 5), true);
      notifyFollow(follow);
      return describeFollow(follow);
    }
    if (!pkt.arrived) {
      pkt.u = 1;
      packetEdgePos(pkt, pkt.mesh.position);
      finishHop(pkt);
    } else {
      pkt.waiting = false;
      follow.playing = false;
      advanceOrEnd(pkt);
    }
    notifyFollow(follow);
    return describeFollow(follow);
  }

  function setPlaying(on) {
    follow.playing = !!on;
    if (follow.playing && followPkt && followPkt.waiting) followPkt.waiting = false;
    if (follow.playing && !followPkt && follow.stage === "idle") {
      spawnPacket(hopPath((Math.random() * nodeCount) | 0, 5), true);
      follow.stage = "relayed";
    }
    notifyFollow(follow);
  }

  /* Bloom */
  var composer = null;
  var bloomPass = null;
  function fitCamera(w, h) {
    var aspect = w / Math.max(1, h);
    camera.aspect = aspect;
    if (h > w || isPortrait()) {
      var needed = RADIUS * 1.22 + 0.4;
      var vFov = 2 * Math.atan((needed / Math.max(aspect, 0.15)) / BASE_Z) * (180 / Math.PI);
      camera.fov = Math.max(30, Math.min(58, vFov));
    } else {
      camera.fov = BASE_FOV;
    }
    camera.position.set(0, 0.15, BASE_Z);
    camera.updateProjectionMatrix();
  }
  function sizeRenderer() {
    var w = Math.max(1, root.clientWidth || 640);
    var h = root.clientHeight || 0;
    if (h < 2) {
      h = isPortrait() ? Math.round((window.innerHeight || 640) * 0.6) : (isMobile() ? 300 : 420);
    }
    renderer.setSize(w, h, false);
    fitCamera(w, h);
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

  var morph = 0;
  var morphing = false;
  var morphFrom = 0;
  var autoRotate = !reducedMotion();
  var dragging = false;
  var lastX = 0, lastY = 0;
  var velX = 0, velY = 0;
  var visible = false;
  var running = false;
  var slowFrames = 0;
  var downX = 0, downY = 0, downT = 0, moved = false;
  var raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: 0.2 };

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
    var portrait = h > w || isPortrait();
    var now = performance.now();
    var ranked = nodes
      .map(function (n, idx) { return { n: n, idx: idx, score: n.key ? n.lastSeen : 0 }; })
      .filter(function (x) { return x.n.key && (now - x.n.lastSeen) < 14000; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, (portrait || isMobile()) ? 3 : MAX_LABELS);
    var padX = portrait ? 14 : 12;
    var padTop = portrait ? 42 : 28;
    var padBot = portrait ? 56 : 18;
    var used = [];
    var i, item, tx, line, x, y, side, lx, ly, k, tries, clash, tw, anchor, offset;
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
      tx.textContent = shortKey(item.n.key);
      try { tw = tx.getComputedTextLength(); } catch (err) { tw = 0; }
      if (!tw) tw = (tx.textContent.length || 11) * 6.8;
      /* Keep the full string inside the card, flipping the side if needed. */
      offset = portrait ? 52 : 72;
      side = (item.idx % 2 === 0) ? 1 : -1;
      if (side > 0) {
        lx = x + offset;
        anchor = "start";
        if (lx + tw > w - padX) {
          lx = x - offset;
          anchor = "end";
        }
      } else {
        lx = x - offset;
        anchor = "end";
        if (lx - tw < padX) {
          lx = x + offset;
          anchor = "start";
        }
      }
      if (anchor === "start") lx = Math.max(padX, Math.min(w - padX - tw, lx));
      else lx = Math.min(w - padX, Math.max(padX + tw, lx));
      ly = Math.max(padTop, Math.min(h - padBot, y - (portrait ? 28 : 24)));
      tries = 0;
      while (tries++ < 6) {
        clash = false;
        for (k = 0; k < used.length; k++) {
          if (Math.abs(used[k].y - ly) < 18 && Math.abs(used[k].x - lx) < tw + 16) { clash = true; break; }
        }
        if (!clash) break;
        ly = Math.max(padTop, Math.min(h - padBot, ly + 18));
      }
      used.push({ x: lx, y: ly });
      tx.setAttribute("x", String(lx));
      tx.setAttribute("y", String(ly));
      tx.setAttribute("text-anchor", anchor);
      line.setAttribute("x1", String(x));
      line.setAttribute("y1", String(y));
      line.setAttribute("x2", String(lx));
      line.setAttribute("y2", String(ly));
    }
  }

  function setTapLabel(msg) {
    if (!tapEl) return;
    if (!msg) { tapEl.hidden = true; tapEl.textContent = ""; return; }
    tapEl.hidden = false;
    tapEl.textContent = msg;
  }

  function pickNodeAt(cx, cy) {
    var rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    var ndc = new THREE.Vector2(
      ((cx - rect.left) / rect.width) * 2 - 1,
      -((cy - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    var meshes = nodes.map(function (n) { return n.mesh; });
    var hits = raycaster.intersectObjects(meshes, false);
    if (!hits.length) { setTapLabel(""); return; }
    var idx = hits[0].object.userData.idx;
    var n = nodes[idx];
    pulseNode(idx, 0.7);
    if (n.key) setTapLabel(shortKey(n.key) + " · real validator");
    else setTapLabel("Network node · illustrative peer");
  }

  var clock = new THREE.Clock();
  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    var dt = Math.min(clock.getDelta(), 0.05);
    var now = performance.now();
    if (morphing) {
      morph = Math.min(1, (now - morphFrom) / (reducedMotion() ? 1 : 2000));
      applyMorph(morph);
      if (morph >= 1) morphing = false;
    }
    if (!dragging && autoRotate && !reducedMotion()) group.rotation.y += dt * 0.18;
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
    lastX = downX = pt.clientX;
    lastY = downY = pt.clientY;
    downT = performance.now();
    moved = false;
    velX = 0; velY = 0;
    ev.preventDefault();
  }
  function onMove(ev) {
    if (!dragging) return;
    var pt = ev.touches ? ev.touches[0] : ev;
    var dx = pt.clientX - lastX, dy = pt.clientY - lastY;
    if (Math.hypot(pt.clientX - downX, pt.clientY - downY) > 7) moved = true;
    group.rotation.y += dx * 0.008;
    group.rotation.x = Math.max(-0.9, Math.min(0.9, group.rotation.x + dy * 0.008));
    velX = dx; velY = dy;
    lastX = pt.clientX; lastY = pt.clientY;
    ev.preventDefault();
  }
  function onUp() {
    if (dragging && !moved && performance.now() - downT < 500) pickNodeAt(lastX, lastY);
    dragging = false;
    setTimeout(function () { if (!dragging && !reducedMotion()) autoRotate = true; }, 1400);
  }
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  var ro = new ResizeObserver(sizeRenderer);
  ro.observe(root);
  function onViewportChange() {
    sizeRenderer();
    setTimeout(sizeRenderer, 200);
  }
  window.addEventListener("resize", onViewportChange);
  window.addEventListener("orientationchange", onViewportChange);
  if (window.matchMedia) {
    try { window.matchMedia("(orientation: portrait)").addEventListener("change", onViewportChange); }
    catch (e) { /* older Safari */ }
  }

  if (hint) hint.textContent = "Drag to rotate · tap a node for a label";

  return {
    ok: true,
    mode: "webgl",
    start: function () { startMorph(); },
    setVisible: function (on) {
      visible = !!on;
      root.hidden = !on;
      if (on) {
        sizeRenderer();
        if (!running) { running = true; clock.getDelta(); requestAnimationFrame(tick); }
        setTimeout(startMorph, reducedMotion() ? 0 : 700);
      }
    },
    onValidation: function (info) {
      if (!info || !info.key) return;
      var idx = nodeIndexForKey(info.key);
      nodes[idx].lastSeen = performance.now();
      pulseNode(idx, 1);
      if (follow.realProposed || follow.stage === "proposed") {
        follow.realAgree = true;
        follow.stage = "agree";
        notifyFollow(follow);
      }
    },
    onLedgerClosed: function () {
      var n;
      for (n = 0; n < nodes.length; n++) pulseNode(n, 0.45);
    },
    onSubmit: function () {
      var start = (Math.random() * nodeCount) | 0;
      follow.playing = true;
      follow.hopsDone = 0;
      follow.realProposed = false;
      follow.realAgree = false;
      follow.realValidated = false;
      follow.ledger = null;
      follow.stage = "submitted";
      spawnPacket(hopPath(start, 6), true);
      notifyFollow(follow);
    },
    onProposed: function () {
      follow.realProposed = true;
      follow.stage = "proposed";
      notifyFollow(follow);
    },
    onValidated: function (info) {
      var n;
      for (n = 0; n < nodes.length; n++) pulseNode(n, 1);
      follow.realValidated = true;
      follow.ledger = info && info.ledger != null ? info.ledger : follow.ledger;
      follow.stage = "validated";
      notifyFollow(follow);
    },
    nextHop: nextHop,
    setPlaying: setPlaying,
    isPlaying: function () { return !!follow.playing; },
    getFollow: function () { return describeFollow(follow); },
    setFollowListener: function (fn) { follow.listener = fn; notifyFollow(follow); },
    setReducedMotion: function (on) {
      autoRotate = !on;
      if (on) useBloom = false;
    },
    dispose: function () {
      running = false;
      ro.disconnect();
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onViewportChange);
    }
  };
}

function createSvgGlobe(root) {
  var canvas = root.querySelector("#globe-canvas");
  var fallback = root.querySelector("#globe-fallback");
  var hint = root.querySelector(".globe-hint");
  var tapEl = root.querySelector("#globe-tap");
  var leaderSvg = root.querySelector("#globe-leaders");
  if (canvas) canvas.hidden = true;
  if (leaderSvg) leaderSvg.hidden = true;
  if (!fallback) return { ok: false };
  fallback.hidden = false;
  root.classList.add("is-svg");

  var nodeCount = isMobile() ? 18 : 24;
  var neighborsK = 3;
  var W = 200;
  var pts = [];
  var i, a, b, d, list, k;
  for (i = 0; i < nodeCount; i++) {
    /* 2D projection of a Fibonacci sphere (x, y) */
    var g = Math.PI * (3 - Math.sqrt(5));
    var y = nodeCount <= 1 ? 0 : 1 - (i / (nodeCount - 1)) * 2;
    var rad = Math.sqrt(Math.max(0, 1 - y * y));
    var th = g * i;
    pts.push({ x: Math.cos(th) * rad * 80, y: y * 80, key: "", lastSeen: 0, pulse: 0, el: null });
  }
  var edges = [];
  var edgeSet = {};
  for (a = 0; a < nodeCount; a++) {
    list = [];
    for (b = 0; b < nodeCount; b++) {
      if (a === b) continue;
      d = Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y);
      list.push({ b: b, d: d });
    }
    list.sort(function (x, y) { return x.d - y.d; });
    for (k = 0; k < neighborsK; k++) {
      b = list[k].b;
      var key = a < b ? a + "-" + b : b + "-" + a;
      if (edgeSet[key]) continue;
      edgeSet[key] = true;
      edges.push([a, b]);
    }
  }

  fallback.setAttribute("viewBox", "-110 -110 220 220");
  fallback.setAttribute("role", "img");
  fallback.setAttribute("aria-label", "Testnet node network. Tap a node for a short label.");
  fallback.replaceChildren();
  var edgeEls = [];
  for (i = 0; i < edges.length; i++) {
    var ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ln.setAttribute("class", "svg-edge");
    ln.setAttribute("x1", String(pts[edges[i][0]].x));
    ln.setAttribute("y1", String(pts[edges[i][0]].y));
    ln.setAttribute("x2", String(pts[edges[i][1]].x));
    ln.setAttribute("y2", String(pts[edges[i][1]].y));
    fallback.appendChild(ln);
    edgeEls.push(ln);
  }
  var hopLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  hopLine.setAttribute("class", "svg-hop");
  hopLine.setAttribute("hidden", "");
  fallback.appendChild(hopLine);
  var trailEls = [];
  for (i = 0; i < 6; i++) {
    var tc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    tc.setAttribute("class", "svg-trail");
    tc.setAttribute("r", String(2.6 - i * 0.3));
    tc.setAttribute("hidden", "");
    fallback.appendChild(tc);
    trailEls.push(tc);
  }
  var pktEl = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  pktEl.setAttribute("class", "svg-pkt");
  pktEl.setAttribute("r", "3.4");
  pktEl.setAttribute("hidden", "");
  fallback.appendChild(pktEl);
  for (i = 0; i < nodeCount; i++) {
    var c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("class", "svg-node");
    c.setAttribute("cx", String(pts[i].x));
    c.setAttribute("cy", String(pts[i].y));
    c.setAttribute("r", "4.2");
    c.setAttribute("data-idx", String(i));
    fallback.appendChild(c);
    pts[i].el = c;
  }

  var follow = makeFollow();
  var pkt = null;
  var visible = false;
  var running = false;
  var lastT = 0;

  function pulseNode(idx, amount) {
    if (pts[idx]) pts[idx].pulse = Math.max(pts[idx].pulse, amount || 1);
  }
  function setTapLabel(msg) {
    if (!tapEl) return;
    if (!msg) { tapEl.hidden = true; tapEl.textContent = ""; return; }
    tapEl.hidden = false;
    tapEl.textContent = msg;
  }
  function hopPath(from, hops) {
    var path = [from], cur = from, h, opts, e, n, prev;
    for (h = 0; h < hops; h++) {
      opts = [];
      for (e = 0; e < edges.length; e++) {
        if (edges[e][0] === cur) opts.push(edges[e][1]);
        else if (edges[e][1] === cur) opts.push(edges[e][0]);
      }
      if (!opts.length) break;
      prev = path[path.length - 1];
      n = opts[(Math.random() * opts.length) | 0];
      if (n === prev && opts.length > 1) n = opts[(opts.indexOf(n) + 1) % opts.length];
      path.push(n); cur = n;
    }
    return path.length >= 2 ? path : null;
  }
  function spawn(path) {
    if (!path) return;
    pkt = { path: path, hop: 0, u: 0, speed: reducedMotion() ? 99 : 1.2, dwell: 0, arrived: false, waiting: false, history: [], alive: true };
    pulseNode(path[0], 0.9);
    pktEl.removeAttribute("hidden");
  }
  function edgePos(p) {
    var a = pts[p.path[p.hop]], b = pts[p.path[p.hop + 1]];
    var u = Math.min(Math.max(p.u, 0), 1);
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
  }
  function showHop(pos) {
    var a = pts[pkt.path[pkt.hop]];
    hopLine.setAttribute("x1", String(a.x));
    hopLine.setAttribute("y1", String(a.y));
    hopLine.setAttribute("x2", String(pos.x));
    hopLine.setAttribute("y2", String(pos.y));
    hopLine.removeAttribute("hidden");
    pktEl.setAttribute("cx", String(pos.x));
    pktEl.setAttribute("cy", String(pos.y));
    pktEl.removeAttribute("hidden");
    var h, t;
    pkt.history.unshift(pos);
    if (pkt.history.length > 8) pkt.history.pop();
    for (h = 0; h < trailEls.length; h++) {
      t = pkt.history[h + 1];
      if (t) {
        trailEls[h].setAttribute("cx", String(t.x));
        trailEls[h].setAttribute("cy", String(t.y));
        trailEls[h].removeAttribute("hidden");
      } else trailEls[h].setAttribute("hidden", "");
    }
  }
  function finishHop() {
    pulseNode(pkt.path[pkt.hop + 1], 1);
    pkt.arrived = true;
    pkt.dwell = reducedMotion() ? 0.05 : 0.22;
    follow.hopsDone += 1;
    if (follow.stage === "submitted" || follow.stage === "idle") follow.stage = "relayed";
    notifyFollow(follow);
  }
  function advanceOrEnd() {
    if (pkt.hop + 1 < pkt.path.length - 1) {
      pkt.hop += 1; pkt.u = 0; pkt.arrived = false; pkt.dwell = 0;
      pkt.waiting = !follow.playing;
      return;
    }
    pkt.alive = false;
    hopLine.setAttribute("hidden", "");
    pktEl.setAttribute("hidden", "");
    var h;
    for (h = 0; h < trailEls.length; h++) trailEls[h].setAttribute("hidden", "");
    pkt = null;
    if (!follow.realProposed && !follow.realValidated) {
      follow.stage = "waiting";
      notifyFollow(follow);
    }
  }
  function tick(now) {
    if (!running) return;
    requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    var dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    var n, el;
    for (n = 0; n < pts.length; n++) {
      if (pts[n].pulse > 0) pts[n].pulse = Math.max(0, pts[n].pulse - dt * 1.4);
      el = pts[n].el;
      if (pts[n].pulse > 0.05) el.setAttribute("class", "svg-node on");
      else if (pts[n].key) el.setAttribute("class", "svg-node keyed");
      else el.setAttribute("class", "svg-node");
      el.setAttribute("r", String(4.2 + pts[n].pulse * 1.6));
    }
    if (!pkt || !pkt.alive) return;
    if (!follow.playing && pkt.waiting) { showHop(edgePos(pkt)); return; }
    if (pkt.arrived) {
      pkt.dwell -= dt;
      showHop(edgePos(pkt));
      if (pkt.dwell <= 0) {
        if (!follow.playing) { pkt.waiting = true; return; }
        advanceOrEnd();
      }
      return;
    }
    pkt.u += dt * pkt.speed;
    if (pkt.u >= 1) { pkt.u = 1; showHop(edgePos(pkt)); finishHop(); }
    else showHop(edgePos(pkt));
  }

  function nextHop() {
    if (!pkt || !pkt.alive) {
      follow.playing = false;
      if (follow.stage === "idle" || follow.stage === "waiting") follow.stage = "relayed";
      spawn(hopPath((Math.random() * nodeCount) | 0, 5));
      notifyFollow(follow);
      return describeFollow(follow);
    }
    if (!pkt.arrived) { pkt.u = 1; showHop(edgePos(pkt)); finishHop(); }
    else { pkt.waiting = false; follow.playing = false; advanceOrEnd(); }
    notifyFollow(follow);
    return describeFollow(follow);
  }
  function setPlaying(on) {
    follow.playing = !!on;
    if (follow.playing && pkt && pkt.waiting) pkt.waiting = false;
    if (follow.playing && !pkt && follow.stage === "idle") {
      spawn(hopPath((Math.random() * nodeCount) | 0, 5));
      follow.stage = "relayed";
    }
    notifyFollow(follow);
  }

  fallback.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.getAttribute) return;
    var idx = t.getAttribute("data-idx");
    if (idx == null) { setTapLabel(""); return; }
    idx = Number(idx);
    pulseNode(idx, 0.7);
    if (pts[idx].key) setTapLabel(shortKey(pts[idx].key) + " · real validator");
    else setTapLabel("Network node · illustrative peer");
  });

  if (hint) hint.textContent = "Tap a node for a label";

  return {
    ok: true,
    mode: "svg",
    start: function () {},
    setVisible: function (on) {
      visible = !!on;
      root.hidden = !on;
      if (on && !running) { running = true; lastT = performance.now(); requestAnimationFrame(tick); }
    },
    onValidation: function (info) {
      if (!info || !info.key) return;
      var n, empty = -1, oldest = 0;
      for (n = 0; n < pts.length; n++) {
        if (pts[n].key === info.key) { empty = n; break; }
        if (empty < 0 && !pts[n].key) empty = n;
        if (pts[n].lastSeen < pts[oldest].lastSeen) oldest = n;
      }
      if (empty < 0) empty = oldest;
      pts[empty].key = info.key;
      pts[empty].lastSeen = performance.now();
      pulseNode(empty, 1);
      if (follow.realProposed || follow.stage === "proposed") {
        follow.realAgree = true;
        follow.stage = "agree";
        notifyFollow(follow);
      }
    },
    onLedgerClosed: function () {
      var n; for (n = 0; n < pts.length; n++) pulseNode(n, 0.45);
    },
    onSubmit: function () {
      follow.playing = true;
      follow.hopsDone = 0;
      follow.realProposed = false;
      follow.realAgree = false;
      follow.realValidated = false;
      follow.ledger = null;
      follow.stage = "submitted";
      spawn(hopPath((Math.random() * nodeCount) | 0, 6));
      notifyFollow(follow);
    },
    onProposed: function () {
      follow.realProposed = true;
      follow.stage = "proposed";
      notifyFollow(follow);
    },
    onValidated: function (info) {
      var n; for (n = 0; n < pts.length; n++) pulseNode(n, 1);
      follow.realValidated = true;
      follow.ledger = info && info.ledger != null ? info.ledger : follow.ledger;
      follow.stage = "validated";
      notifyFollow(follow);
    },
    nextHop: nextHop,
    setPlaying: setPlaying,
    isPlaying: function () { return !!follow.playing; },
    getFollow: function () { return describeFollow(follow); },
    setFollowListener: function (fn) { follow.listener = fn; notifyFollow(follow); },
    setReducedMotion: function () {},
    dispose: function () { running = false; }
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
  onValidated: function () {},
  nextHop: function () {},
  setPlaying: function () {},
  setFollowListener: function () {},
  setReducedMotion: function () {}
};

(function init() {
  var root = document.getElementById("globe-root");
  if (!root) return;
  var useSvg = reducedMotion() || !hasWebGL();
  try {
    var g = useSvg ? createSvgGlobe(root) : createGlobe(root);
    if (g && g.ok) api = g;
    else {
      api.ok = false;
      root.hidden = true;
    }
  } catch (e) {
    try {
      api = createSvgGlobe(root);
    } catch (e2) {
      api.ok = false;
      root.hidden = true;
    }
  }
})();

window.LiveGlobe = api;
