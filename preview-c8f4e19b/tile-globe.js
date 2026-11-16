/* Decorative flagship globe: Tracer look, no data, no tracing. */
(function () {
  "use strict";

  var GLOBE_R = 100;
  var THREE_SRC = "../tracer/js/three.min.js";
  var state = { ready: false, fallback: true, globe: null, dragging: false };

  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function hasWebGL() {
    try {
      var c = document.createElement("canvas");
      return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
    } catch (e) {
      return false;
    }
  }

  function hash32(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (typeof THREE !== "undefined") return resolve();
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function makeGlobeTexture() {
    var c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    var ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 1024, 512);
    var g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "rgba(4, 16, 28, 0.22)");
    g.addColorStop(0.5, "rgba(3, 12, 20, 0.16)");
    g.addColorStop(1, "rgba(4, 16, 28, 0.22)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
    for (var i = 0; i < 70; i++) {
      var h = hash32("land" + i);
      var x = (h / 0xffffffff) * 1024;
      var y = (hash32("ly" + i) / 0xffffffff) * 512;
      var r = 18 + (hash32("lr" + i) / 0xffffffff) * 64;
      ctx.fillStyle = "rgba(80, 220, 210, 0.07)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.anisotropy = 2;
    tex.needsUpdate = true;
    return tex;
  }

  function makeLatLong(mobile) {
    var pts = [];
    var R = GLOBE_R * 1.003;
    var meridians = mobile ? 8 : 12;
    var segs = mobile ? 32 : 64;
    var i, j, th, ph0, ph1, ph, y, r, a0, a1;
    for (i = 0; i < meridians; i++) {
      th = (i / meridians) * Math.PI;
      for (j = 0; j < segs; j++) {
        ph0 = (j / segs) * Math.PI * 2;
        ph1 = ((j + 1) / segs) * Math.PI * 2;
        pts.push(
          new THREE.Vector3(R * Math.sin(ph0) * Math.cos(th), R * Math.cos(ph0), R * Math.sin(ph0) * Math.sin(th)),
          new THREE.Vector3(R * Math.sin(ph1) * Math.cos(th), R * Math.cos(ph1), R * Math.sin(ph1) * Math.sin(th))
        );
      }
    }
    var lats = mobile ? 7 : 9;
    for (i = 1; i < lats; i++) {
      ph = (i / lats) * Math.PI;
      y = R * Math.cos(ph);
      r = R * Math.sin(ph);
      for (j = 0; j < segs; j++) {
        a0 = (j / segs) * Math.PI * 2;
        a1 = ((j + 1) / segs) * Math.PI * 2;
        pts.push(
          new THREE.Vector3(r * Math.cos(a0), y, r * Math.sin(a0)),
          new THREE.Vector3(r * Math.cos(a1), y, r * Math.sin(a1))
        );
      }
    }
    return new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({
        color: 0x4dfff2, transparent: true, opacity: 0.22,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
  }

  function showFallback(tile) {
    var img = tile.querySelector(".globe-fallback");
    var canvas = tile.querySelector(".globe-canvas");
    if (img) img.classList.remove("is-hidden");
    if (canvas) canvas.classList.remove("is-live");
    state.ready = true;
    state.fallback = true;
    window.__tracerTile = state;
  }

  function initGlobe(tile) {
    var canvas = tile.querySelector(".globe-canvas");
    var fallback = tile.querySelector(".globe-fallback");
    if (!canvas || typeof THREE === "undefined") return showFallback(tile);

    var mobile = Math.min(window.innerWidth, window.innerHeight) <= 520;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, 1, 0.35, 2600);
    var distance = 280;
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: !mobile,
        alpha: true,
        powerPreference: "low-power",
        stencil: false,
        depth: true,
      });
    } catch (e) {
      return showFallback(tile);
    }
    renderer.setClearColor(0x010308, 0);
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    else if (renderer.outputEncoding != null && THREE.sRGBEncoding != null) renderer.outputEncoding = THREE.sRGBEncoding;

    var globe = new THREE.Group();
    scene.add(globe);

    var starN = mobile ? 180 : 280;
    var starPos = new Float32Array(starN * 3);
    for (var i = 0; i < starN; i++) {
      var u = hash32("star" + i) / 0xffffffff;
      var v = hash32("s" + i) / 0xffffffff;
      var phi = Math.acos(2 * u - 1);
      var theta = v * Math.PI * 2;
      var r = 700 + (hash32("sr" + i) / 0xffffffff) * 500;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    var starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xc9ddd8, size: 1.2, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false })
    ));

    var shell = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 0.992, mobile ? 48 : 64, mobile ? 32 : 48),
      new THREE.MeshBasicMaterial({
        map: makeGlobeTexture(),
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    globe.add(shell);

    var atmos = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 1.12, mobile ? 32 : 48, mobile ? 24 : 32),
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
    globe.add(atmos);
    globe.add(makeLatLong(mobile));

    var tmpQ = new THREE.Quaternion();
    var tmpQ2 = new THREE.Quaternion();
    var tmpV = new THREE.Vector3();
    var tmpV2 = new THREE.Vector3();
    var dragging = false;
    var lastPtr = null;
    var ptrMoved = 0;
    var velX = 0;
    var velY = 0;
    var lastDragT = 0;
    var lastInteract = 0;
    var inView = true;
    var reduced = reducedMotion();
    var t0 = performance.now();
    var running = true;

    function resize() {
      var parent = canvas.parentElement;
      var rect = parent.getBoundingClientRect();
      var w = Math.max(1, rect.width);
      var h = Math.max(1, rect.height);
      var dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      camera.aspect = w / h;
      var half = GLOBE_R * 1.32;
      var fit = half / Math.sin((camera.fov * Math.PI) / 360);
      distance = fit / Math.min(1, camera.aspect);
      camera.position.set(0, 0, distance);
      camera.updateProjectionMatrix();
    }

    function rotateBy(dx, dy) {
      var speed = 0.005;
      var qx = tmpQ.setFromAxisAngle(tmpV.set(1, 0, 0), dy * speed);
      var qy = tmpQ2.setFromAxisAngle(tmpV2.set(0, 1, 0), dx * speed);
      globe.quaternion.premultiply(qy).premultiply(qx);
    }

    function onDown(e) {
      e.preventDefault();
      e.stopPropagation();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      dragging = true;
      lastPtr = { x: e.offsetX, y: e.offsetY };
      lastDragT = performance.now();
      ptrMoved = 0;
      velX = 0;
      velY = 0;
      lastInteract = lastDragT;
      tile.classList.add("is-dragging");
    }
    function onMove(e) {
      if (!dragging || !lastPtr) return;
      e.preventDefault();
      var dx = e.offsetX - lastPtr.x;
      var dy = e.offsetY - lastPtr.y;
      ptrMoved += Math.hypot(dx, dy);
      rotateBy(dx, dy);
      var now = performance.now();
      var dt = Math.max(8, now - lastDragT);
      velX = dx / dt;
      velY = dy / dt;
      lastDragT = now;
      lastPtr = { x: e.offsetX, y: e.offsetY };
      lastInteract = now;
    }
    function onUp(e) {
      dragging = false;
      lastPtr = null;
      tile.classList.remove("is-dragging");
      lastInteract = performance.now();
      if (ptrMoved >= 6 && e.type === "pointerup") {
        tile.addEventListener("click", function block(ev) {
          ev.preventDefault();
          ev.stopPropagation();
          tile.removeEventListener("click", block, true);
        }, true);
      }
      ptrMoved = 0;
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", function () { if (dragging) onUp({ type: "pointerleave" }); });
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", function () {
      t0 = performance.now();
    });

    function loop(now) {
      if (!running) return;
      requestAnimationFrame(loop);
      if (document.hidden || !inView) {
        t0 = now;
        return;
      }
      var dt = Math.min(40, now - t0);
      t0 = now;
      if (!dragging && (Math.abs(velX) > 0.002 || Math.abs(velY) > 0.002) && !reduced) {
        rotateBy(velX * dt, velY * dt);
        var damp = Math.pow(0.92, dt / 16.67);
        velX *= damp;
        velY *= damp;
        if (Math.abs(velX) < 0.002) velX = 0;
        if (Math.abs(velY) < 0.002) velY = 0;
      }
      if (!reduced && !dragging && now - lastInteract > 2800) {
        rotateBy(0.012 * (dt / 16.67), 0);
      }
      renderer.render(scene, camera);
    }

    resize();
    canvas.classList.add("is-live");
    if (fallback) fallback.classList.add("is-hidden");
    requestAnimationFrame(loop);

    state.ready = true;
    state.fallback = false;
    state.globe = globe;
    state.quat = function () {
      return { x: globe.quaternion.x, y: globe.quaternion.y, z: globe.quaternion.z, w: globe.quaternion.w };
    };
    state.setInView = function (v) { inView = !!v; };
    window.__tracerTile = state;
  }

  function start(tile) {
    if (!hasWebGL()) return showFallback(tile);
    loadScript(THREE_SRC)
      .then(function () { initGlobe(tile); })
      .catch(function () { showFallback(tile); });
  }

  function boot() {
    var tile = document.querySelector(".flag-tracer");
    if (!tile) return;
    window.__tracerTile = state;
    if (!("IntersectionObserver" in window)) {
      start(tile);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          if (!state.ready) start(tile);
          else if (state.setInView) state.setInView(true);
        } else if (state.setInView) {
          state.setInView(false);
        }
      });
    }, { rootMargin: "80px" });
    io.observe(tile);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
