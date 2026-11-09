/* B34N5 motion-site preview — Motion scroll/parallax/hover + particle field.
   Patterns from Motion docs/examples: scroll, inView, hover, parallax, scroll-fade. */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse = window.matchMedia("(pointer: coarse)").matches;
  var MotionNS = window.Motion || {};
  var animate = MotionNS.animate;
  var scroll = MotionNS.scroll;
  var inView = MotionNS.inView;
  var hover = MotionNS.hover;

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

  if (!animate || !scroll) {
    document.documentElement.classList.add("no-motion-lib");
    return;
  }

  function reveal(el) {
    el.style.opacity = "1";
    el.style.transform = "none";
  }

  if (!reduce) {
    scroll(animate("#progress", { scaleX: [0, 1] }, { ease: "linear" }));

    var hero = document.getElementById("hero-mark");
    if (hero) {
      scroll(animate(hero, { y: [0, 90], opacity: [1, 0.4] }, { ease: "linear" }), {
        target: document.querySelector(".hero"),
        offset: ["start start", "end start"]
      });
    }

    // Soft tile fade — keep titles readable (no heavy name parallax over tagline)
    document.querySelectorAll(".flag").forEach(function (tile) {
      scroll(animate(tile, { opacity: [0.4, 1, 1] }, { ease: "linear" }), {
        target: tile,
        offset: ["start end", "center center", "end start"]
      });
      var viz = tile.querySelector(".viz");
      if (viz) {
        scroll(animate(viz, { y: [30, -30] }, { ease: "linear" }), {
          target: tile,
          offset: ["start end", "end start"]
        });
      }
    });

    if (inView) {
      inView(".kicker, .lab-tile, .foot", function (el) {
        animate(el, { opacity: [0, 1], y: [20, 0] }, {
          type: "spring",
          visualDuration: 0.5,
          bounce: 0.1
        });
        return function () {};
      }, { margin: "0px 0px -5% 0px", amount: 0.15 });
    }
    // Fallback so Lab never stays invisible if inView misses
    setTimeout(function () {
      document.querySelectorAll(".kicker, .lab-tile, .foot").forEach(function (el) {
        if (parseFloat(getComputedStyle(el).opacity) < 0.5) reveal(el);
      });
    }, 1200);

    if (hover && !coarse) {
      hover("[data-magnetic]", function (el) {
        var anim = animate(el, { scale: 1.03 }, {
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
            rotateX: py * -6,
            rotateY: px * 8
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
    document.querySelectorAll(".kicker, .lab-tile, .flag, .foot").forEach(reveal);
  }

  if (coarse) {
    document.querySelectorAll(".lab-tile").forEach(function (tile) {
      tile.addEventListener("click", function (e) {
        if (tile.classList.contains("soon")) e.preventDefault();
        var open = tile.classList.contains("is-open");
        document.querySelectorAll(".lab-tile.is-open").forEach(function (t) {
          t.classList.remove("is-open");
        });
        if (!open) tile.classList.add("is-open");
      });
    });
  }
})();
