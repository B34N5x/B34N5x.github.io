// Soft tilt for floating cards. No libraries. Respects prefers-reduced-motion.
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cards = document.querySelectorAll('.float-deck .fcard');
  if (!cards.length) return;
  cards.forEach(function (c, i) {
    if (!reduce) c.classList.add('bob');
    c.style.setProperty('--i', String(i));
  });
  if (reduce || matchMedia('(pointer: coarse)').matches) return;
  var max = 7;
  cards.forEach(function (card) {
    var rx = 0, ry = 0, tx = 0, ty = 0, raf = 0;
    function frame() {
      rx += (tx - rx) * 0.12; ry += (ty - ry) * 0.12;
      card.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-2px)';
      if (Math.abs(tx - rx) > 0.05 || Math.abs(ty - ry) > 0.05) raf = requestAnimationFrame(frame); else raf = 0;
    }
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      ty = px * max; tx = -py * max;
      if (!raf) raf = requestAnimationFrame(frame);
    });
    card.addEventListener('pointerleave', function () {
      tx = 0; ty = 0;
      if (!raf) raf = requestAnimationFrame(frame);
      setTimeout(function () { if (!raf) card.style.transform = ''; }, 280);
    });
  });
})();
