/* Light Motion field + reveals for inner pages (same design language as motion home). */
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MotionNS = window.Motion || {};
  var animate = MotionNS.animate;
  var inView = MotionNS.inView;
  var scroll = MotionNS.scroll;
  var glow = document.getElementById('glow');
  var canvas = document.getElementById('field');
  var ctx = canvas && canvas.getContext('2d');
  var mx = innerWidth * 0.5, my = innerHeight * 0.3, gx = mx, gy = my, particles = [];
  function resize() {
    if (!canvas) return;
    var dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.min(28, Math.floor((innerWidth * innerHeight) / 42000));
    particles = [];
    for (var i = 0; i < n; i++) {
      particles.push({
        x: Math.random() * innerWidth, y: Math.random() * innerHeight,
        r: 0.5 + Math.random() * 1.4, vx: -0.12 + Math.random() * 0.24,
        vy: -0.2 + Math.random() * 0.12, a: 0.12 + Math.random() * 0.28
      });
    }
  }
  function frame() {
    gx += (mx - gx) * 0.08; gy += (my - gy) * 0.08;
    if (glow && !reduce) glow.style.transform = 'translate(' + gx + 'px,' + gy + 'px) translate(-50%,-50%)';
    if (ctx && !reduce) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = innerWidth + 10;
        if (p.x > innerWidth + 10) p.x = -10;
        if (p.y < -10) p.y = innerHeight + 10;
        if (p.y > innerHeight + 10) p.y = -10;
        ctx.beginPath();
        ctx.fillStyle = 'rgba(61,245,143,' + p.a + ')';
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    requestAnimationFrame(frame);
  }
  addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
  addEventListener('resize', resize, { passive: true });
  resize();
  if (!reduce) requestAnimationFrame(frame);
  if (!animate) return;
  if (!reduce && scroll) {
    scroll(animate('#progress', { scaleX: [0, 1] }, { ease: 'linear' }));
  }
  if (!reduce && inView) {
    document.querySelectorAll('.reveal,.card,.page-title,.page-lead').forEach(function (el) {
      el.style.opacity = el.style.opacity || '0';
    });
    inView('.reveal,.card,.page-title,.page-lead,main .wrap > *', function (el) {
      animate(el, { opacity: [0, 1], y: [16, 0] }, { type: 'spring', visualDuration: 0.45, bounce: 0.08 });
    }, { amount: 0.12 });
    setTimeout(function () {
      document.querySelectorAll('.reveal,.card,.page-title,.page-lead').forEach(function (el) {
        if (parseFloat(getComputedStyle(el).opacity) < 0.4) {
          el.style.opacity = '1'; el.style.transform = 'none';
        }
      });
    }, 1400);
  }
})();
