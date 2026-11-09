/* B34N5 motion-site preview — Motion scroll/parallax/hover + particle field.
   Patterns adapted from Motion docs: scroll, inView, hover, parallax, scroll-fade. */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse = window.matchMedia("(pointer: coarse)").matches;
  var MotionNS = window.Motion || {};
  var animate = MotionNS.animate;
  var scroll = MotionNS.scroll;
  var inView = MotionNS.inView;
  var hover = MotionNS.hover;

  /* —— Cursor glow + particle field (site float/particle vibe) —— */
  var glow = document.getElementById("glow");
  var canvas = document.getElementById("field");
  var ctx = canvas && canvas.getContext("2d");
  var mx = window.innerWidth * 0.5;
  var my = window.innerHeight * 0.35;
  var gx = mx;
  var gy = my;
  var particles = [];

  function resize() {
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.min(48, Math.floor((window.innerWidth * window.innerHeight) / 28000));
    particles = [];
    for (var i = 0; i < n; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: 0.6 + Math.random() * 1.6,
        vx: -0.15 + Math.random() * 0.3,
        vy: -0.25 + Math.random() * 0.15,
        a: 0.15 + Math.random() * 0.35
      });
    }
  }

  function frame() {
    gx += (mx - gx) * 0.08;
    gy += (my - gy) * 0.08;
    if (glow && !reduce) {
      glow.style.transform = "translate(" + gx + "px," + gy + "px) translate(-50%,-50%)";
    }
    if (ctx && !reduce) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var dx = p.x - gx;
        var dy = p.y - gy;
        var d2 = dx * dx + dy * dy;
        if (d2 < 220 * 220) {
          p.x += dx * -0.0008;
          p.y += dy * -0.0008;
        }
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = window.innerWidth + 10;
        if (p.x > window.innerWidth + 10) p.x = -10;
        if (p.y < -10) p.y = window.innerHeight + 10;
        if (p.y > window.innerHeight + 10) p.y = -10;
        ctx.beginPath();
        ctx.fillStyle = "rgba(61,245,143," + p.a + ")";
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener("pointermove", function (e) {
    mx = e.clientX;
    my = e.clientY;
  }, { passive: true });
  window.addEventListener("resize", resize, { passive: true });
  resize();
  if (!reduce) requestAnimationFrame(frame);

  /* —— Motion: scroll progress, parallax, reveals, magnetic hover —— */
  if (!animate || !scroll) {
    document.documentElement.classList.add("no-motion-lib");
    return;
  }

  if (!reduce) {
    // Progress bar (Motion scroll + animate) — docs/js/scroll, examples/js/parallax
    scroll(animate("#progress", { scaleX: [0, 1] }, { ease: "linear" }));

    // Hero parallax
    var hero = document.getElementById("hero-mark");
    if (hero) {
      scroll(animate(hero, { y: [0, 120], opacity: [1, 0.35] }, { ease: "linear" }), {
        target: document.querySelector(".hero"),
        offset: ["start start", "end start"]
      });
    }

    // Flagship title parallax + scroll fade on tiles — examples/js/parallax + scroll-fade
    document.querySelectorAll(".flag").forEach(function (tile) {
      var name = tile.querySelector(".name");
      if (name) {
        scroll(animate(name, { y: [40, -40] }, { ease: "linear" }), {
          target: tile,
          offset: ["start end", "end start"]
        });
      }
      scroll(animate(tile, { opacity: [0.35, 1, 1] }, { ease: "linear" }), {
        target: tile,
        offset: ["start end", "center center", "end start"]
      });
    });

    // Section kickers reveal via inView
    if (inView) {
      inView(".kicker, .lab-tile, .foot", function (el) {
        animate(el, { opacity: [0, 1], y: [24, 0] }, {
          type: "spring",
          visualDuration: 0.55,
          bounce: 0.12
        });
      }, { margin: "-8% 0px -8% 0px" });
    }

    // Magnetic / hover-reactive cards — docs/js/hover + spring animate
    if (hover && !coarse) {
      hover("[data-magnetic]", function (el) {
        var anim = animate(el, { scale: 1.035 }, {
          type: "spring",
          visualDuration: 0.35,
          bounce: 0.25
        });
        return function () {
          anim.stop();
          animate(el, { scale: 1, rotateX: 0, rotateY: 0 }, {
            type: "spring",
            visualDuration: 0.4,
            bounce: 0.15
          });
        };
      });

      document.querySelectorAll("[data-magnetic]").forEach(function (el) {
        el.addEventListener("pointermove", function (e) {
          var r = el.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width - 0.5;
          var py = (e.clientY - r.top) / r.height - 0.5;
          animate(el, {
            rotateX: py * -7,
            rotateY: px * 9
          }, { type: "spring", visualDuration: 0.25, bounce: 0 });
        });
        el.addEventListener("pointerleave", function () {
          animate(el, { rotateX: 0, rotateY: 0 }, {
            type: "spring",
            visualDuration: 0.4,
            bounce: 0.2
          });
        });
      });
    }
  } else {
    // Reduced motion: ensure visibility
    document.querySelectorAll(".kicker, .lab-tile, .flag, .foot").forEach(function (el) {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
  }

  // Mobile tap to show Lab hint
  if (coarse) {
    document.querySelectorAll(".lab-tile").forEach(function (tile) {
      tile.addEventListener("click", function (e) {
        if (tile.classList.contains("soon")) {
          e.preventDefault();
        }
        var open = tile.classList.contains("is-open");
        document.querySelectorAll(".lab-tile.is-open").forEach(function (t) {
          t.classList.remove("is-open");
        });
        if (!open) tile.classList.add("is-open");
      });
    });
  }
})();
