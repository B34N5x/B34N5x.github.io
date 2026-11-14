/* 3D globe network: rotate 360, zoom through arcs, pick any node. three.js r149 vendored locally. */
(function (global) {
  "use strict";

  const GLOBE_R = 100;
  const MAX_PINGS = 42;
  const MAX_NODES = 180;
  const MAX_NODES_MOBILE = 110;
  const MAX_EDGES = 260;
  const MAX_EDGES_MOBILE = 150;
  const HUB_THRESHOLD = 6;
  const WINDOW_MS = 20000;
  const EDGE_LIFE = 18000;
  const RECENT_CAP = 10;
  const MIN_DIST_FACTOR = 0.08; // inside the shell, so you can zoom through the lines
  const MAX_DIST_FACTOR = 2.4;

  function hash32(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function easePing(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    if (typeof Motion !== "undefined" && typeof Motion.easeInOut === "function") {
      return Motion.easeInOut(t);
    }
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function isMobileSize(w, h) {
    return Math.min(w, h) <= 520 || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0 && w * h < 700000);
  }

  function slerpVec(a, b, t, out) {
    const ax = a.x, ay = a.y, az = a.z;
    const bx = b.x, by = b.y, bz = b.z;
    const ra = Math.hypot(ax, ay, az) || 1;
    const rb = Math.hypot(bx, by, bz) || 1;
    const naX = ax / ra, naY = ay / ra, naZ = az / ra;
    const nbX = bx / rb, nbY = by / rb, nbZ = bz / rb;
    let dot = naX * nbX + naY * nbY + naZ * nbZ;
    if (dot > 0.9995) {
      out.x = naX + (nbX - naX) * t;
      out.y = naY + (nbY - naY) * t;
      out.z = naZ + (nbZ - naZ) * t;
      const r = Math.hypot(out.x, out.y, out.z) || 1;
      out.x /= r; out.y /= r; out.z /= r;
      return out;
    }
    if (dot < -0.9995) {
      // Opposite points: pick a stable perpendicular axis from the hash of both
      let ox = -naY, oy = naX, oz = 0;
      if (Math.hypot(ox, oy, oz) < 1e-4) { ox = 0; oy = -naZ; oz = naY; }
      const or = Math.hypot(ox, oy, oz) || 1;
      ox /= or; oy /= or; oz /= or;
      const ang = Math.PI * t;
      const c = Math.cos(ang), s = Math.sin(ang);
      // rotate na around `o` by ang (Rodrigues)
      const crX = oy * naZ - oz * naY, crY = oz * naX - ox * naZ, crZ = ox * naY - oy * naX;
      const d = ox * naX + oy * naY + oz * naZ;
      out.x = naX * c + crX * s + ox * d * (1 - c);
      out.y = naY * c + crY * s + oy * d * (1 - c);
      out.z = naZ * c + crZ * s + oz * d * (1 - c);
      return out;
    }
    if (dot < -1) dot = -1;
    if (dot > 1) dot = 1;
    const omega = Math.acos(dot);
    const so = Math.sin(omega) || 1e-6;
    const wa = Math.sin((1 - t) * omega) / so;
    const wb = Math.sin(t * omega) / so;
    out.x = naX * wa + nbX * wb;
    out.y = naY * wa + nbY * wb;
    out.z = naZ * wa + nbZ * wb;
    return out;
  }

  function TracerMap(canvas) {
    this.canvas = canvas;
    this.nodes = new Map();
    this.pings = [];
    this.edges = [];
    this.watched = new Set();
    this.hover = null;
    this.selected = null;
    this.activity = new Map();
    this.cam = { x: 0, y: 0, scale: 1, distance: 280, roll: 0 };
    this.camTarget = null;
    this.distance = 280;
    this.defaultDist = 280;
    this.dpr = 1;
    this.w = 0;
    this.h = 0;
    this.dragging = false;
    this.lastPtr = null;
    this.pointers = new Map();
    this.pinch = null;
    this.ptrMoved = 0;
    this.velX = 0;
    this.velY = 0;
    this.lastDragT = 0;
    this.lastInteract = 0;
    this.autoRotate = true;
    this.reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.t0 = performance.now();
    this.mobile = false;
    this.maxNodes = MAX_NODES;
    this.maxEdges = MAX_EDGES;
    this._tmp = {
      v: new THREE.Vector3(),
      v2: new THREE.Vector3(),
      v3: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      q2: new THREE.Quaternion(),
      e: new THREE.Euler(),
      m: new THREE.Matrix4(),
      c: new THREE.Color(),
    };
    this._bindLabels();
    this._initThree();
    this._bind();
    this.resize({ fit: true });
    this.resetView(true);
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  TracerMap.prototype._bindLabels = function () {
    this.labelRoot = document.getElementById("node-labels");
    if (!this.labelRoot) {
      this.labelRoot = document.createElement("div");
      this.labelRoot.id = "node-labels";
      if (this.canvas.parentElement) this.canvas.parentElement.appendChild(this.labelRoot);
    }
  };

  TracerMap.prototype._initThree = function () {
    if (typeof THREE === "undefined") {
      throw new Error("three.js failed to load (local vendor)");
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010308);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.35, 2600);
    camera.position.set(0, 0, this.distance);
    camera.lookAt(0, 0, 0);

    const mobileGuess = typeof window !== "undefined" && (Math.min(window.innerWidth, window.innerHeight) <= 520);
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !mobileGuess,
      alpha: false,
      powerPreference: "high-performance",
      stencil: false,
      depth: true,
    });
    renderer.setClearColor(0x010308, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace || THREE.sRGBEncoding;
    if (renderer.outputEncoding != null && THREE.sRGBEncoding != null) renderer.outputEncoding = THREE.sRGBEncoding;

    const globe = new THREE.Group();
    scene.add(globe);

    // Star field — fixed in world space so the globe turns in front of it
    const starN = 420;
    const starPos = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const h = hash32("star" + i);
      const h2 = hash32("s" + i);
      const u = h / 0xffffffff;
      const v = h2 / 0xffffffff;
      const phi = Math.acos(2 * u - 1);
      const theta = v * Math.PI * 2;
      const r = 700 + (hash32("sr" + i) / 0xffffffff) * 500;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xc9ddd8, size: 1.2, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false })
    );
    scene.add(stars);

    // Holographic shell: low-opacity fill + faint continents, so arcs stay on top
    const globeTex = this._makeGlobeTexture();
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 0.992, mobileGuess ? 48 : 64, mobileGuess ? 32 : 48),
      new THREE.MeshBasicMaterial({
        map: globeTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    shell.renderOrder = 0;
    globe.add(shell);

    const atmos = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 1.12, mobileGuess ? 32 : 48, mobileGuess ? 24 : 32),
      new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color(0x2ee6d0) } },
        vertexShader: "varying vec3 vNormal;varying vec3 vView;void main(){vNormal=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}",
        fragmentShader: "uniform vec3 color;varying vec3 vNormal;varying vec3 vView;void main(){float f=pow(1.0-max(dot(vNormal,vView),0.0),2.6);gl_FragColor=vec4(color,f*0.22);}",
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    atmos.renderOrder = 0;
    globe.add(atmos);

    const meridians = this._makeLatLong(mobileGuess);
    meridians.renderOrder = 1;
    globe.add(meridians);

    // Instanced neon nodes + additive halo shells
    const nodeSegs = mobileGuess ? 8 : 12;
    const nodeGeo = new THREE.SphereGeometry(1, nodeSegs, mobileGuess ? 6 : 10);
    function makeBalls(color, cap) {
      const mesh = new THREE.InstancedMesh(
        nodeGeo,
        new THREE.MeshBasicMaterial({ color: color, transparent: false }),
        cap
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      globe.add(mesh);
      return mesh;
    }
    function makeHalos(color, cap) {
      const mesh = new THREE.InstancedMesh(
        nodeGeo,
        new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
        cap
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      globe.add(mesh);
      return mesh;
    }
    // One mesh per colour — instanceColor is unreliable in this WebGL path
    // cyan / green / magenta
    const nodeMeshes = {
      ambient: makeBalls(0x3cfff8, MAX_NODES),
      watch: makeBalls(0x3dff8a, 40),
      hub: makeBalls(0xe056ff, 48),
      route: makeBalls(0xff7ad9, 48),
      flag: makeBalls(0xff3ec8, 48),
      selected: makeBalls(0x7dffc0, 4),
    };
    const nodeHalos = {
      ambient: makeHalos(0x3cfff8, MAX_NODES),
      watch: makeHalos(0x3dff8a, 40),
      hub: makeHalos(0xe056ff, 48),
      route: makeHalos(0xff7ad9, 48),
      flag: makeHalos(0xff3ec8, 48),
      selected: makeHalos(0x7dffc0, 4),
    };
    const nodeMesh = nodeMeshes.ambient;

    // Selection ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.05, 32),
      new THREE.MeshBasicMaterial({
        color: 0x3dff8a, side: THREE.DoubleSide, transparent: true, opacity: 0.95,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    ring.visible = false;
    globe.add(ring);

    // Edges + ping trails as line segments
    const maxSegs = MAX_EDGES * 24;
    const edgePos = new Float32Array(maxSegs * 2 * 3);
    const edgeCol = new Float32Array(maxSegs * 2 * 3);
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute("position", new THREE.BufferAttribute(edgePos, 3).setUsage(THREE.DynamicDrawUsage));
    edgeGeo.setAttribute("color", new THREE.BufferAttribute(edgeCol, 3).setUsage(THREE.DynamicDrawUsage));
    edgeGeo.setDrawRange(0, 0);
    const edgeLine = new THREE.LineSegments(
      edgeGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    edgeLine.frustumCulled = false;
    edgeLine.renderOrder = 2;
    globe.add(edgeLine);

    const trailMax = MAX_PINGS * 24;
    const trailPos = new Float32Array(trailMax * 2 * 3);
    const trailCol = new Float32Array(trailMax * 2 * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3).setUsage(THREE.DynamicDrawUsage));
    trailGeo.setAttribute("color", new THREE.BufferAttribute(trailCol, 3).setUsage(THREE.DynamicDrawUsage));
    trailGeo.setDrawRange(0, 0);
    const trailLine = new THREE.LineSegments(
      trailGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    trailLine.frustumCulled = false;
    trailLine.renderOrder = 2;
    globe.add(trailLine);

    const pingGeo = new THREE.SphereGeometry(1, mobileGuess ? 8 : 10, mobileGuess ? 6 : 8);
    function makePings(color, halo) {
      const mesh = new THREE.InstancedMesh(
        pingGeo,
        new THREE.MeshBasicMaterial(halo ? {
          color: color, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
        } : { color: color }),
        MAX_PINGS
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.renderOrder = halo ? 3 : 4;
      globe.add(mesh);
      return mesh;
    }
    const pingMeshes = {
      ambient: makePings(0x3cfff8, false),
      watch: makePings(0x3dff8a, false),
      flag: makePings(0xff3ec8, false),
    };
    const pingHalos = {
      ambient: makePings(0x3cfff8, true),
      watch: makePings(0x3dff8a, true),
      flag: makePings(0xff3ec8, true),
    };
    const pingMesh = pingMeshes.ambient;

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.globe = globe;
    this.stars = stars;
    this.shell = shell;
    this.atmos = atmos;
    this.nodeMesh = nodeMesh;
    this.nodeMeshes = nodeMeshes;
    this.nodeHalos = nodeHalos;
    this.pingMesh = pingMesh;
    this.pingMeshes = pingMeshes;
    this.pingHalos = pingHalos;
    this.edgeGeo = edgeGeo;
    this.trailGeo = trailGeo;
    this.ring = ring;
    this._nodeIndex = [];
    this._defaultQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.32, 0.72, 0.08, "YXZ"));
    this.globe.quaternion.copy(this._defaultQuat);
  };

  TracerMap.prototype._makeGlobeTexture = function () {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 1024, 512);
    // very faint volume so the shell reads as a globe, not a solid ball
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "rgba(4, 16, 28, 0.22)");
    g.addColorStop(0.5, "rgba(3, 12, 20, 0.16)");
    g.addColorStop(1, "rgba(4, 16, 28, 0.22)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
    // faint abstract continents (not a real map)
    for (let i = 0; i < 70; i++) {
      const h = hash32("land" + i);
      const x = (h / 0xffffffff) * 1024;
      const y = (hash32("ly" + i) / 0xffffffff) * 512;
      const r = 18 + (hash32("lr" + i) / 0xffffffff) * 64;
      ctx.fillStyle = "rgba(80, 220, 210, 0.07)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.anisotropy = 2;
    tex.needsUpdate = true;
    return tex;
  };

  TracerMap.prototype._makeLatLong = function (mobile) {
    const pts = [];
    const R = GLOBE_R * 1.003;
    const meridians = mobile ? 8 : 12;
    const segs = mobile ? 32 : 64;
    for (let i = 0; i < meridians; i++) {
      const th = (i / meridians) * Math.PI;
      for (let j = 0; j < segs; j++) {
        const ph0 = (j / segs) * Math.PI * 2;
        const ph1 = ((j + 1) / segs) * Math.PI * 2;
        pts.push(
          new THREE.Vector3(R * Math.sin(ph0) * Math.cos(th), R * Math.cos(ph0), R * Math.sin(ph0) * Math.sin(th)),
          new THREE.Vector3(R * Math.sin(ph1) * Math.cos(th), R * Math.cos(ph1), R * Math.sin(ph1) * Math.sin(th))
        );
      }
    }
    const lats = mobile ? 7 : 9;
    for (let i = 1; i < lats; i++) {
      const ph = (i / lats) * Math.PI;
      const y = R * Math.cos(ph);
      const r = R * Math.sin(ph);
      for (let j = 0; j < segs; j++) {
        const a0 = (j / segs) * Math.PI * 2;
        const a1 = ((j + 1) / segs) * Math.PI * 2;
        pts.push(
          new THREE.Vector3(r * Math.cos(a0), y, r * Math.sin(a0)),
          new THREE.Vector3(r * Math.cos(a1), y, r * Math.sin(a1))
        );
      }
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: 0x4dfff2, transparent: true, opacity: 0.22,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
  };

  TracerMap.prototype._bind = function () {
    const c = this.canvas;
    const self = this;
    window.addEventListener("resize", function () { self.resize(); });
    window.addEventListener("orientationchange", function () {
      setTimeout(function () { self.resize({ fit: true }); }, 120);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", function () { self.resize(); });
    }
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) self.t0 = performance.now();
    });
    c.addEventListener("pointerdown", function (e) { self._onDown(e); });
    c.addEventListener("pointermove", function (e) { self._onMove(e); });
    c.addEventListener("pointerup", function (e) { self._onUp(e); });
    c.addEventListener("pointercancel", function (e) { self._onUp(e); });
    c.addEventListener("pointerleave", function () {
      self.hover = null;
      if (self.onHover) self.onHover(null, 0, 0);
    });
    c.addEventListener("wheel", function (e) {
      e.preventDefault();
      self._markInteract();
      self._zoomAt(e.offsetX, e.offsetY, e.deltaY > 0 ? 0.9 : 1.11);
    }, { passive: false });
    c.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  };

  TracerMap.prototype._markInteract = function () {
    this.lastInteract = performance.now();
    this.camTarget = null;
  };

  TracerMap.prototype._syncCam = function () {
    const e = this._tmp.e.setFromQuaternion(this.globe.quaternion, "YXZ");
    this.cam.x = e.y * 180 / Math.PI;
    this.cam.y = e.x * 180 / Math.PI;
    this.cam.roll = e.z * 180 / Math.PI;
    this.cam.distance = this.distance;
    this.cam.scale = this.defaultDist / Math.max(1, this.distance);
    this.camera.position.set(0, 0, this.distance);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  };

  TracerMap.prototype._computeDefaultDist = function () {
    const fov = (this.camera.fov || 42) * Math.PI / 180;
    const aspect = this.w / Math.max(1, this.h);
    const half = GLOBE_R * 1.32;
    const distV = half / Math.tan(fov / 2);
    const distH = half / (Math.tan(fov / 2) * aspect);
    return Math.max(distV, distH);
  };

  TracerMap.prototype._limits = function () {
    return {
      min: Math.max(8, GLOBE_R * MIN_DIST_FACTOR),
      max: this.defaultDist * MAX_DIST_FACTOR,
    };
  };

  TracerMap.prototype.resize = function (opts) {
    opts = opts || {};
    const prevW = this.w, prevH = this.h;
    const parent = this.canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.mobile = isMobileSize(this.w, this.h);
    this.maxNodes = this.mobile ? MAX_NODES_MOBILE : MAX_NODES;
    this.maxEdges = this.mobile ? MAX_EDGES_MOBILE : MAX_EDGES;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 1.75);
    if (this.renderer) {
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(this.w, this.h, false);
    }
    this.canvas.style.width = this.w + "px";
    this.canvas.style.height = this.h + "px";
    const oldDefault = this.defaultDist;
    this.defaultDist = this._computeDefaultDist();
    this.camera.aspect = this.w / this.h;
    if (opts.fit || (prevW && prevH && ((prevW > prevH) !== (this.w > this.h)))) {
      const rel = oldDefault ? this.distance / oldDefault : 1;
      this.distance = this.defaultDist * rel;
    }
    const lim = this._limits();
    this.distance = Math.max(lim.min, Math.min(lim.max, this.distance));
    this._syncCam();
  };

  TracerMap.prototype.fitAll = function () {
    // Frame the whole globe, keep current orientation
    this.camTarget = { quat: this.globe.quaternion.clone(), distance: this.defaultDist };
  };

  TracerMap.prototype.resetView = function (instant) {
    const q = this._defaultQuat.clone();
    if (instant || this.reduced) {
      this.globe.quaternion.copy(q);
      this.distance = this.defaultDist;
      this.camTarget = null;
      this.velX = 0;
      this.velY = 0;
      this._syncCam();
    } else {
      this.velX = 0;
      this.velY = 0;
      this.camTarget = { quat: q, distance: this.defaultDist };
    }
    this.lastInteract = 0;
  };

  TracerMap.prototype.focusNetwork = function () {
    this.fitAll();
  };

  TracerMap.prototype.setWatched = function (addresses) {
    this.watched = new Set(addresses || []);
    const self = this;
    this.watched.forEach(function (a) {
      self.ensureNode(a, true);
    });
    this._refreshHubs();
  };

  TracerMap.prototype.ensureNode = function (addr, important) {
    if (!addr) return null;
    let n = this.nodes.get(addr);
    if (!n) {
      if (!important && this.nodes.size >= this.maxNodes) this._evict();
      if (!important && this.nodes.size >= this.maxNodes) return null;
      const pos = this._home(addr);
      n = {
        addr: addr,
        x: pos.x, y: pos.y, z: pos.z,
        tx: pos.x, ty: pos.y, tz: pos.z,
        count: 0, last: performance.now(),
        hub: false, route: false, unexpected: false,
        recent: [],
      };
      this.nodes.set(addr, n);
    }
    n.last = performance.now();
    return n;
  };

  TracerMap.prototype._home = function (addr) {
    const h = hash32(addr);
    const h2 = hash32(addr + ":r");
    let phi, theta;
    if (this.watched.has(addr)) {
      const list = Array.from(this.watched);
      if (list.length <= 1) {
        phi = Math.PI / 2 - 0.12;
        theta = 0.35;
      } else {
        const i = Math.max(0, list.indexOf(addr));
        theta = (i / list.length) * Math.PI * 2;
        phi = Math.PI / 2 - 0.18;
      }
    } else {
      const u = h / 0xffffffff;
      const v = h2 / 0xffffffff;
      phi = Math.acos(2 * u - 1);
      theta = v * Math.PI * 2;
    }
    const r = GLOBE_R * 1.012;
    return {
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.cos(phi),
      z: r * Math.sin(phi) * Math.sin(theta),
    };
  };

  TracerMap.prototype._evict = function () {
    const now = performance.now();
    let oldest = null;
    let oldestT = Infinity;
    const selected = this.selected;
    this.nodes.forEach((n) => {
      if (this.watched.has(n.addr) || n.hub || n.addr === selected) return;
      if (n.last < oldestT) { oldestT = n.last; oldest = n; }
    });
    if (oldest && now - oldest.last > 4000) this.nodes.delete(oldest.addr);
  };

  TracerMap.prototype.noteActivity = function (addr, now) {
    if (!addr) return;
    let arr = this.activity.get(addr);
    if (!arr) { arr = []; this.activity.set(addr, arr); }
    arr.push(now);
    const cut = now - WINDOW_MS;
    while (arr.length && arr[0] < cut) arr.shift();
  };

  TracerMap.prototype._remember = function (addr, tx, ping) {
    const n = this.nodes.get(addr);
    if (!n || !tx) return;
    if (!n.recent) n.recent = [];
    if (tx.hash && n.recent.some(function (r) { return r.tx && r.tx.hash === tx.hash; })) return;
    const dir = addr === tx.account ? "out" : addr === tx.destination ? "in" : "hop";
    n.recent.unshift({ tx: tx, born: ping.born, flagged: !!ping.flagged, watched: !!ping.watched, dir: dir });
    if (n.recent.length > RECENT_CAP) n.recent.length = RECENT_CAP;
  };

  TracerMap.prototype.addPing = function (tx, opts) {
    opts = opts || {};
    const from = tx.account;
    const to = tx.destination;
    const watched = opts.watched || this.watched.has(from) || (to && this.watched.has(to));
    const now = performance.now();
    const waypoints = (tx.waypoints && tx.waypoints.length ? tx.waypoints.slice() : [from, to].filter(Boolean));
    const flagged = !!(opts.flagged || tx.flagged);
    this.noteActivity(from, now);
    if (to) this.noteActivity(to, now);
    this.ensureNode(from, watched || flagged);
    if (to) this.ensureNode(to, watched || flagged);
    for (let i = 0; i < waypoints.length; i++) this.ensureNode(waypoints[i], watched || flagged);
    this._layoutRoute(waypoints, tx.hops || []);
    this._refreshHubs();

    if (!opts.priority && !watched && !flagged) {
      const ambient = this.pings.filter(function (p) { return !p.watched && !p.flagged; }).length;
      if (this.pings.length >= MAX_PINGS || ambient >= MAX_PINGS - 4) {
        for (let i = 0; i < this.pings.length; i++) {
          if (!this.pings[i].watched && !this.pings[i].flagged) { this.pings.splice(i, 1); break; }
        }
        if (this.pings.length >= MAX_PINGS) return null;
      }
    }

    const duration = this.reduced ? 200 : (watched || opts.priority || flagged ? 2000 : 2800);
    const ping = {
      id: (tx.hash || "") + ":" + now,
      from: from,
      to: to,
      waypoints: waypoints,
      t: 0,
      born: now,
      duration: duration,
      watched: !!watched || !!opts.priority,
      flagged: flagged,
      tx: tx,
      curve: ((hash32(tx.hash || from) % 200) - 100) / 100,
    };
    this.pings.push(ping);
    for (let i = 0; i < waypoints.length; i++) this._remember(waypoints[i], tx, ping);
    for (let i = 0; i < waypoints.length - 1; i++) {
      this.edges.push({ a: waypoints[i], b: waypoints[i + 1], born: now, watched: ping.watched, flagged: flagged });
    }
    if (this.edges.length > this.maxEdges) this.edges.splice(0, this.edges.length - this.maxEdges);
    if (opts.focus) this.focusPing(ping);
    return ping;
  };

  TracerMap.prototype._layoutRoute = function (waypoints, hops) {
    if (!waypoints || waypoints.length < 3) return;
    const start = this.nodes.get(waypoints[0]);
    const end = this.nodes.get(waypoints[waypoints.length - 1]);
    if (!start || !end) return;
    const a = { x: start.tx, y: start.ty, z: start.tz };
    const b = { x: end.tx, y: end.ty, z: end.tz };
    const unexpected = {};
    for (let i = 0; hops && i < hops.length; i++) {
      if (hops[i].unexpected && hops[i].account) unexpected[hops[i].account] = true;
    }
    const mid = { x: 0, y: 0, z: 0 };
    const bin = {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
    let br = Math.hypot(bin.x, bin.y, bin.z);
    if (br < 1e-4) { bin.x = 0; bin.y = 1; bin.z = 0; br = 1; }
    bin.x /= br; bin.y /= br; bin.z /= br;
    for (let i = 1; i < waypoints.length - 1; i++) {
      const n = this.nodes.get(waypoints[i]);
      if (!n) continue;
      const t = i / (waypoints.length - 1);
      slerpVec(a, b, t, mid);
      const offset = ((i % 2 === 0) ? 1 : -1) * 0.08;
      mid.x += bin.x * offset;
      mid.y += bin.y * offset;
      mid.z += bin.z * offset;
      const r = Math.hypot(mid.x, mid.y, mid.z) || 1;
      const R = GLOBE_R * 1.012;
      n.tx = mid.x / r * R;
      n.ty = mid.y / r * R;
      n.tz = mid.z / r * R;
      n.route = true;
      n.unexpected = !!unexpected[n.addr];
    }
  };

  TracerMap.prototype._refreshHubs = function () {
    const self = this;
    this.nodes.forEach(function (n) {
      const arr = self.activity.get(n.addr) || [];
      n.count = arr.length;
      n.hub = n.count >= HUB_THRESHOLD && !self.watched.has(n.addr);
      if (!n.route) {
        const home = self._home(n.addr);
        n.tx = home.x;
        n.ty = home.y;
        n.tz = home.z;
      }
    });
  };

  TracerMap.prototype._facePoint = function (x, y, z, distance) {
    const local = this._tmp.v.set(x, y, z).normalize();
    const target = this._tmp.v2.set(0, 0, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(local, target);
    this.camTarget = { quat: q, distance: distance };
  };

  TracerMap.prototype.focusPing = function (ping) {
    const pts = (ping.waypoints || [ping.from, ping.to]).map((a) => this.nodes.get(a)).filter(Boolean);
    if (!pts.length) return;
    let sx = 0, sy = 0, sz = 0;
    for (let i = 0; i < pts.length; i++) { sx += pts[i].x; sy += pts[i].y; sz += pts[i].z; }
    sx /= pts.length; sy /= pts.length; sz /= pts.length;
    const close = this.defaultDist / (pts.length > 2 ? 1.35 : 1.65);
    this._facePoint(sx, sy, sz, close);
  };

  TracerMap.prototype.focusNode = function (addr) {
    const n = typeof addr === "string" ? this.nodes.get(addr) : addr;
    if (!n) return;
    this.selectNode(n.addr);
    this._facePoint(n.x, n.y, n.z, this.defaultDist / 1.85);
  };

  TracerMap.prototype.selectNode = function (addr) {
    this.selected = addr || null;
    if (addr) this.ensureNode(addr, true);
  };

  TracerMap.prototype.projectNode = function (addr) {
    const n = typeof addr === "string" ? this.nodes.get(addr) : addr;
    if (!n) return null;
    const world = this._worldPos(n, this._tmp.v);
    const v = world.clone().project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * this.w,
      y: (-v.y * 0.5 + 0.5) * this.h,
      z: v.z,
      front: this._isFront(world),
    };
  };

  TracerMap.prototype._worldPos = function (n, out) {
    out = out || new THREE.Vector3();
    out.set(n.x, n.y, n.z);
    this.globe.localToWorld(out);
    return out;
  };

  TracerMap.prototype._isFront = function (world) {
    // Camera sits on +Z looking at the origin. Inside the globe, everything is pickable.
    if (this.distance < GLOBE_R * 1.05) return true;
    return world.z > 0;
  };

  TracerMap.prototype._zoomAt = function (sx, sy, factor) {
    const lim = this._limits();
    const before = this.distance;
    this.distance = Math.max(lim.min, Math.min(lim.max, this.distance / factor));
    this.camTarget = null;
    // Keep the globe point under the cursor reasonably stable by nudging rotation
    if (Math.abs(this.distance - before) > 0.01) {
      const hit = this._pickGlobe(sx, sy);
      this._syncCam();
      if (hit) {
        const hit2 = this._pickGlobe(sx, sy);
        if (hit2) {
          const q = new THREE.Quaternion().setFromUnitVectors(hit2.clone().normalize(), hit.clone().normalize());
          this.globe.quaternion.premultiply(q);
        }
      }
    }
    this._syncCam();
  };

  TracerMap.prototype._pickGlobe = function (sx, sy) {
    const ndc = this._tmp.v.set((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1, 0.5);
    const ray = new THREE.Raycaster();
    ray.setFromCamera({ x: ndc.x, y: ndc.y }, this.camera);
    const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), GLOBE_R);
    const hit = this._tmp.v2;
    if (ray.ray.intersectSphere(sphere, hit)) return hit.clone();
    return null;
  };

  TracerMap.prototype._onDown = function (e) {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (this.pointers.size === 2) {
      const pts = Array.from(this.pointers.values());
      this.pinch = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        distance: this.distance,
      };
      this.dragging = false;
      return;
    }
    this.dragging = true;
    this.lastPtr = { x: e.offsetX, y: e.offsetY };
    this.lastDragT = performance.now();
    this.ptrMoved = 0;
    this.velX = 0;
    this.velY = 0;
    this.camTarget = null;
    this._markInteract();
    this.canvas.classList.add("dragging");
  };

  TracerMap.prototype._rotateBy = function (dx, dy) {
    // Trackball: drag in screen space rotates around camera-right / camera-up (world X / Y)
    const speed = 0.005;
    const qx = this._tmp.q.setFromAxisAngle(this._tmp.v.set(1, 0, 0), dy * speed);
    const qy = this._tmp.q2.setFromAxisAngle(this._tmp.v2.set(0, 1, 0), dx * speed);
    this.globe.quaternion.premultiply(qy).premultiply(qx);
  };

  TracerMap.prototype._onMove = function (e) {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (this.pointers.size === 2 && this.pinch) {
      const pts = Array.from(this.pointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.pinch.dist > 8) {
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const factor = dist / this.pinch.dist;
        const target = this.pinch.distance / factor;
        const lim = this._limits();
        const next = Math.max(lim.min, Math.min(lim.max, target));
        const zoomFactor = this.distance / next;
        this._zoomAt(midX, midY, zoomFactor);
        this.pinch.dist = dist;
        this.pinch.distance = this.distance;
        this._markInteract();
      }
      return;
    }
    if (this.dragging && this.lastPtr) {
      const dx = e.offsetX - this.lastPtr.x;
      const dy = e.offsetY - this.lastPtr.y;
      this.ptrMoved = (this.ptrMoved || 0) + Math.hypot(dx, dy);
      this._rotateBy(dx, dy);
      const now = performance.now();
      const dt = Math.max(8, now - (this.lastDragT || now));
      this.velX = dx / dt;
      this.velY = dy / dt;
      this.lastDragT = now;
      this.lastPtr = { x: e.offsetX, y: e.offsetY };
      this._syncCam();
      return;
    }
    this.hover = this.hitNode(e.offsetX, e.offsetY);
    if (this.onHover) this.onHover(this.hover, e.offsetX, e.offsetY);
  };

  TracerMap.prototype._onUp = function (e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 0) {
      const wasDrag = this.dragging;
      const moved = this.ptrMoved || 0;
      this.dragging = false;
      this.canvas.classList.remove("dragging");
      this.lastPtr = null;
      this.ptrMoved = 0;
      if (wasDrag && moved < 6 && this.onClick) {
        const n = this.hitNode(e.offsetX, e.offsetY);
        const p = this.hitPing(e.offsetX, e.offsetY);
        this.onClick(n, p);
      } else if (wasDrag) {
        this._markInteract();
      }
    }
  };

  TracerMap.prototype._screenDist = function (world, sx, sy) {
    const v = world.clone().project(this.camera);
    if (v.z < -1 || v.z > 1) return Infinity;
    const px = (v.x * 0.5 + 0.5) * this.w;
    const py = (-v.y * 0.5 + 0.5) * this.h;
    return Math.hypot(px - sx, py - sy);
  };

  TracerMap.prototype.hitNode = function (sx, sy) {
    let best = null;
    let bestD = 22;
    const world = this._tmp.v3;
    this.nodes.forEach((n) => {
      this._worldPos(n, world);
      if (!this._isFront(world) && this.distance > GLOBE_R * 1.2) return;
      const d = this._screenDist(world, sx, sy);
      const boost = n.addr === this.selected ? 8 : (n.hub || this.watched.has(n.addr) ? 6 : 0);
      if (d < bestD + boost && d < (best ? bestD : Infinity)) {
        best = n;
        bestD = d;
      }
    });
    return best && bestD <= 26 ? best : null;
  };

  TracerMap.prototype.hitPing = function (sx, sy) {
    for (let i = this.pings.length - 1; i >= 0; i--) {
      const p = this.pings[i];
      const pt = this._pingPos(p);
      if (!pt) continue;
      const world = this._tmp.v.set(pt.x, pt.y, pt.z);
      this.globe.localToWorld(world);
      if (this._screenDist(world, sx, sy) < 16) return p;
    }
    return null;
  };

  TracerMap.prototype._arcPoint = function (a, b, t, curve, out) {
    slerpVec(a, b, t, out);
    const lift = Math.sin(Math.PI * t) * (6 + Math.abs(curve || 0) * 10);
    const r = GLOBE_R * 1.02 + lift;
    out.x *= r;
    out.y *= r;
    out.z *= r;
    return out;
  };

  TracerMap.prototype._pingPos = function (p) {
    const ids = (p.waypoints && p.waypoints.length ? p.waypoints : [p.from, p.to].filter(Boolean));
    const pts = [];
    for (let i = 0; i < ids.length; i++) {
      const n = this.nodes.get(ids[i]);
      if (n) pts.push(n);
    }
    if (!pts.length) return null;
    if (pts.length === 1) {
      const a = pts[0];
      return { x: a.x, y: a.y, z: a.z, pts: pts, kind: "point" };
    }
    const tmpA = this._tmp.v;
    const lengths = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = Math.acos(Math.max(-1, Math.min(1,
        (pts[i].x * pts[i + 1].x + pts[i].y * pts[i + 1].y + pts[i].z * pts[i + 1].z) /
        ((Math.hypot(pts[i].x, pts[i].y, pts[i].z) || 1) * (Math.hypot(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z) || 1))
      )));
      const len = Math.max(0.001, d);
      lengths.push(len);
      total += len;
    }
    let dist = (p.te != null ? p.te : p.t) * total;
    let idx = lengths.length - 1;
    for (let i = 0; i < lengths.length; i++) {
      if (dist <= lengths[i]) { idx = i; break; }
      dist -= lengths[i];
    }
    const u = Math.min(1, dist / lengths[idx]);
    this._arcPoint(pts[idx], pts[idx + 1], u, p.curve, tmpA);
    return { x: tmpA.x, y: tmpA.y, z: tmpA.z, pts: pts, kind: pts.length > 2 ? "poly" : "arc", lengths: lengths, total: total };
  };

  TracerMap.prototype._loop = function (now) {
    if (document.hidden) {
      this.t0 = now;
      requestAnimationFrame(this._loop);
      return;
    }
    const dt = Math.min(40, now - this.t0);
    this.t0 = now;
    this._step(now, dt);
    this._draw(now);
    requestAnimationFrame(this._loop);
  };

  TracerMap.prototype._step = function (now, dt) {
    if (!this.dragging && !this.pinch && (Math.abs(this.velX) > 0.002 || Math.abs(this.velY) > 0.002) && !this.reduced) {
      this._rotateBy(this.velX * dt, this.velY * dt);
      const damp = Math.pow(0.92, dt / 16.67);
      this.velX *= damp;
      this.velY *= damp;
      if (Math.abs(this.velX) < 0.002) this.velX = 0;
      if (Math.abs(this.velY) < 0.002) this.velY = 0;
    }

    const idle = now - this.lastInteract > 2800;
    if (this.autoRotate && idle && !this.dragging && !this.camTarget && !this.reduced) {
      this._rotateBy(0.012 * (dt / 16.67), 0);
    }

    if (this.camTarget) {
      const k = this.reduced ? 1 : Math.min(1, 0.1);
      this.globe.quaternion.slerp(this.camTarget.quat, k);
      this.distance += (this.camTarget.distance - this.distance) * k;
      if (this.globe.quaternion.angleTo(this.camTarget.quat) < 0.01 && Math.abs(this.distance - this.camTarget.distance) < 0.8) {
        this.globe.quaternion.copy(this.camTarget.quat);
        this.distance = this.camTarget.distance;
        this.camTarget = null;
      }
    }

    const kN = this.reduced ? 1 : 0.08;
    this.nodes.forEach((n) => {
      n.x += (n.tx - n.x) * kN;
      n.y += (n.ty - n.y) * kN;
      n.z += (n.tz - n.z) * kN;
    });

    const remain = [];
    for (let i = 0; i < this.pings.length; i++) {
      const p = this.pings[i];
      p.t = Math.min(1, (now - p.born) / p.duration);
      p.te = this.reduced ? p.t : easePing(p.t);
      if (p.t < 1) remain.push(p);
      else if (this.onArrive && p.watched) this.onArrive(p);
    }
    this.pings = remain;
    const cut = now - EDGE_LIFE;
    this.edges = this.edges.filter((e) => e.born > cut);
    this._syncCam();
  };

  TracerMap.prototype._setInstance = function (mesh, i, x, y, z, s, color) {
    const m = this._tmp.m;
    m.makeScale(s, s, s);
    m.setPosition(x, y, z);
    mesh.setMatrixAt(i, m);
    if (mesh.setColorAt) mesh.setColorAt(i, this._tmp.c.set(color));
  };

  TracerMap.prototype._draw = function (now) {
    this._updateNodes(now);
    this._updateEdges(now);
    this._updatePings(now);
    this._updateLabels();
    this.renderer.render(this.scene, this.camera);
  };

  TracerMap.prototype._updateNodes = function (now) {
    const buckets = this.nodeMeshes;
    const counts = { ambient: 0, watch: 0, hub: 0, route: 0, flag: 0, selected: 0 };
    const caps = { ambient: MAX_NODES, watch: 40, hub: 48, route: 48, flag: 48, selected: 4 };
    const self = this;
    const close = this.cam.scale >= 1.25;
    this.nodes.forEach(function (n) {
      const watched = self.watched.has(n.addr);
      const selected = self.selected === n.addr;
      const hover = self.hover && self.hover.addr === n.addr;
      let s = watched ? 2.6 : n.hub ? 2.25 + Math.min(1.4, n.count * 0.08) : 1.55;
      if (selected) s *= 1.7;
      if (hover && !selected) s *= 1.25;
      if (watched || selected) s *= 1 + Math.sin(now / 280) * 0.08;
      const kind = selected ? "selected" : n.unexpected ? "flag" : watched ? "watch" : n.hub ? "hub" : n.route ? "route" : "ambient";
      const i = counts[kind];
      if (i >= caps[kind]) return;
      self._setInstance(buckets[kind], i, n.x, n.y, n.z, s, 0xffffff);
      if (self.nodeHalos && self.nodeHalos[kind]) {
        self._setInstance(self.nodeHalos[kind], i, n.x, n.y, n.z, s * 2.15, 0xffffff);
      }
      counts[kind] = i + 1;
    });
    Object.keys(buckets).forEach(function (k) {
      buckets[k].count = counts[k];
      buckets[k].instanceMatrix.needsUpdate = true;
      if (self.nodeHalos && self.nodeHalos[k]) {
        self.nodeHalos[k].count = counts[k];
        self.nodeHalos[k].instanceMatrix.needsUpdate = true;
      }
    });

    if (this.selected && this.nodes.get(this.selected)) {
      const n = this.nodes.get(this.selected);
      this.ring.visible = true;
      this.ring.position.set(n.x, n.y, n.z);
      this.ring.lookAt(0, 0, 0);
      const pulse = 1.15 + Math.sin(now / 220) * 0.12;
      this.ring.scale.set(pulse, pulse, pulse);
    } else {
      this.ring.visible = false;
    }
    this._close = close;
  };

  TracerMap.prototype._pushSeg = function (pos, col, cursor, ax, ay, az, bx, by, bz, r, g, b, r2, g2, b2) {
    const i = cursor[0];
    const p = i * 3;
    pos[p] = ax; pos[p + 1] = ay; pos[p + 2] = az;
    pos[p + 3] = bx; pos[p + 4] = by; pos[p + 5] = bz;
    col[p] = r; col[p + 1] = g; col[p + 2] = b;
    col[p + 3] = r2 != null ? r2 : r; col[p + 4] = g2 != null ? g2 : g; col[p + 5] = b2 != null ? b2 : b;
    cursor[0] = i + 2;
  };

  TracerMap.prototype._lodSegs = function () {
    if (this.mobile && this.cam.scale < 1.05) return 8;
    if (this.cam.scale < 0.9) return 8;
    if (this.cam.scale < 1.4) return this.mobile ? 12 : 16;
    return this.mobile ? 14 : 22;
  };

  TracerMap.prototype._updateEdges = function (now) {
    const pos = this.edgeGeo.attributes.position.array;
    const col = this.edgeGeo.attributes.color.array;
    const cursor = [0];
    const segs = this._lodSegs();
    const aP = { x: 0, y: 0, z: 0 };
    const bP = { x: 0, y: 0, z: 0 };
    const selected = this.selected;
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i];
      const a = this.nodes.get(e.a);
      const b = this.nodes.get(e.b);
      if (!a || !b) continue;
      const age = (now - e.born) / EDGE_LIFE;
      let alpha = Math.max(0, 0.55 * (1 - age)) * (e.flagged ? 1.6 : e.watched ? 1.4 : 1);
      const lit = selected && (e.a === selected || e.b === selected);
      if (lit) alpha = Math.max(alpha, 0.85);
      else if (selected) alpha *= 0.35;
      let r, g, bl;
      if (e.flagged) { r = 1; g = 0.24; bl = 0.78; }
      else if (lit) { r = 0.24; g = 1; bl = 0.54; }
      else if (e.watched) { r = 0.24; g = 1; bl = 0.54; }
      else { r = 0.24; g = 1; bl = 0.97; }
      r *= alpha * 1.25; g *= alpha * 1.25; bl *= alpha * 1.25;
      for (let s = 0; s < segs; s++) {
        this._arcPoint(a, b, s / segs, 0.2, aP);
        this._arcPoint(a, b, (s + 1) / segs, 0.2, bP);
        this._pushSeg(pos, col, cursor, aP.x, aP.y, aP.z, bP.x, bP.y, bP.z, r, g, bl);
      }
    }
    this.edgeGeo.setDrawRange(0, cursor[0]);
    this.edgeGeo.attributes.position.needsUpdate = true;
    this.edgeGeo.attributes.color.needsUpdate = true;
  };

  TracerMap.prototype._updatePings = function (now) {
    const pos = this.trailGeo.attributes.position.array;
    const col = this.trailGeo.attributes.color.array;
    const cursor = [0];
    const segs = this._lodSegs();
    const aP = { x: 0, y: 0, z: 0 };
    const bP = { x: 0, y: 0, z: 0 };
    const pingCounts = { ambient: 0, watch: 0, flag: 0 };
    for (let i = 0; i < this.pings.length; i++) {
      const p = this.pings[i];
      const pt = this._pingPos(p);
      if (!pt) continue;
      const r = p.flagged ? 1 : p.watched ? 0.24 : 0.24;
      const g = p.flagged ? 0.24 : p.watched ? 1 : 1;
      const b = p.flagged ? 0.78 : p.watched ? 0.54 : 0.97;
      const pts = pt.pts;
      if (pts && pts.length >= 2) {
        // Draw the travelled portion of each hop
        let acc = 0;
        const until = (p.te != null ? p.te : p.t) * (pt.total || 1);
        for (let h = 0; h < pts.length - 1; h++) {
          const len = pt.lengths[h];
          const startT = 0;
          let endT = 1;
          if (acc + len <= until) endT = 1;
          else if (acc >= until) break;
          else endT = (until - acc) / len;
          const steps = Math.max(1, Math.ceil(segs * (endT - startT)));
          for (let s = 0; s < steps; s++) {
            const t0 = startT + (endT - startT) * (s / steps);
            const t1 = startT + (endT - startT) * ((s + 1) / steps);
            this._arcPoint(pts[h], pts[h + 1], t0, p.curve, aP);
            this._arcPoint(pts[h], pts[h + 1], t1, p.curve, bP);
            const fade0 = 0.25 + 0.75 * t0;
            const fade1 = 0.25 + 0.75 * t1;
            this._pushSeg(pos, col, cursor, aP.x, aP.y, aP.z, bP.x, bP.y, bP.z, r * fade0, g * fade0, b * fade0, r * fade1, g * fade1, b * fade1);
          }
          acc += len;
        }
      }
      const size = (p.flagged || p.watched ? 2.9 : 2.15);
      const kind = p.flagged ? "flag" : p.watched ? "watch" : "ambient";
      const mesh = this.pingMeshes[kind];
      const idx = pingCounts[kind];
      this._setInstance(mesh, idx, pt.x, pt.y, pt.z, size, 0xffffff);
      if (this.pingHalos && this.pingHalos[kind]) {
        this._setInstance(this.pingHalos[kind], idx, pt.x, pt.y, pt.z, size * 2.3, 0xffffff);
      }
      pingCounts[kind] = idx + 1;
    }
    const pMeshes = this.pingMeshes;
    const pHalos = this.pingHalos || {};
    ["ambient", "watch", "flag"].forEach(function (k) {
      pMeshes[k].count = pingCounts[k];
      pMeshes[k].instanceMatrix.needsUpdate = true;
      if (pHalos[k]) {
        pHalos[k].count = pingCounts[k];
        pHalos[k].instanceMatrix.needsUpdate = true;
      }
    });
    this.trailGeo.setDrawRange(0, cursor[0]);
    this.trailGeo.attributes.position.needsUpdate = true;
    this.trailGeo.attributes.color.needsUpdate = true;
  };

  TracerMap.prototype._updateLabels = function () {
    if (!this.labelRoot) return;
    const wanted = [];
    const self = this;
    const showExtra = this.cam.scale >= 1.2;
    this.nodes.forEach(function (n) {
      const watched = self.watched.has(n.addr);
      const selected = self.selected === n.addr;
      const hover = self.hover && self.hover.addr === n.addr;
      if (!(selected || watched || hover || (showExtra && (n.hub || n.unexpected || n.route)))) return;
      const pr = self.projectNode(n);
      if (!pr || !pr.front || pr.x < -20 || pr.y < -20 || pr.x > self.w + 20 || pr.y > self.h + 20) return;
      wanted.push({ n: n, pr: pr, selected: selected, watched: watched, hover: hover });
    });
    wanted.sort(function (a, b) {
      return (b.selected - a.selected) || (b.watched - a.watched) || (b.hover - a.hover);
    });
    const keep = wanted.slice(0, this.mobile ? 6 : 10);
    const root = this.labelRoot;
    while (root.childNodes.length > keep.length) root.removeChild(root.lastChild);
    for (let i = 0; i < keep.length; i++) {
      let el = root.childNodes[i];
      if (!el) {
        el = document.createElement("span");
        root.appendChild(el);
      }
      const item = keep[i];
      const tag = item.selected ? "SEL  " : item.watched ? "WATCH  " : item.n.unexpected ? "CHECK  " : item.n.hub ? "HUB  " : item.n.route ? "HOP  " : "";
      const label = tag + (typeof TracerCurrency !== "undefined" ? TracerCurrency.shortAddr(item.n.addr) : item.n.addr.slice(0, 8));
      if (el.textContent !== label) el.textContent = label;
      el.className = item.selected ? "selected" : item.watched ? "watch" : item.n.unexpected ? "flag" : "";
      el.style.left = item.pr.x + "px";
      el.style.top = item.pr.y + "px";
    }
  };

  global.TracerMap = TracerMap;
})(window);
