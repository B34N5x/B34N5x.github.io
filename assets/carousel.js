// Project tile carousel + subcategory panel. Desktop: 3D coverflow. Touch/narrow: flat scroll-snap + bottom sheet.
// No libs. Respects prefers-reduced-motion (static grid). Keyboard + swipe/scroll.
(function () {
  var root = document.getElementById('project-carousel');
  if (!root) return;

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touchNarrow = matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  var track = document.getElementById('carousel-track');
  var tiles = Array.prototype.slice.call(track.querySelectorAll('.car-tile'));
  var prevBtn = root.querySelector('.car-prev');
  var nextBtn = root.querySelector('.car-next');
  var dots = root.querySelector('.car-dots');
  var stage = root.querySelector('.carousel-stage');
  var subPanel = document.getElementById('sub-float');
  var subTiles = document.getElementById('sub-tiles');
  var subTitle = document.getElementById('sub-title');
  var subClose = subPanel && subPanel.querySelector('.sub-close');
  var n = tiles.length;
  var i = 0;
  var timer = 0;
  var paused = false;
  var open = false;
  var touchX = 0;
  var touchY = 0;
  var swiping = false;
  var snapScrolling = false;
  var mq = matchMedia('(max-width: 768px), (pointer: coarse)');

  function isSnap() {
    return touchNarrow || root.classList.contains('car-snap');
  }

  function applyMode() {
    touchNarrow = mq.matches;
    if (reduce) {
      root.classList.add('car-static');
      root.classList.remove('car-snap');
      if (subPanel) subPanel.classList.remove('sub-sheet');
      tiles.forEach(function (t) {
        t.tabIndex = 0;
        t.removeAttribute('aria-hidden');
        t.style.transform = '';
        t.style.opacity = '';
        t.style.zIndex = '';
        t.style.willChange = '';
      });
      return;
    }
    if (touchNarrow) {
      root.classList.add('car-snap');
      root.classList.remove('car-static');
      if (subPanel) subPanel.classList.add('sub-sheet');
      // Clear any leftover 3D inline styles from desktop mode
      tiles.forEach(function (t) {
        t.style.transform = '';
        t.style.opacity = '';
        t.style.zIndex = '';
        t.style.willChange = '';
        t.removeAttribute('data-off');
      });
      setActiveSnap(i, false);
    } else {
      root.classList.remove('car-snap');
      if (subPanel) subPanel.classList.remove('sub-sheet');
      setActiveCoverflow(i, false);
      start();
    }
  }

  function clearWillChangeSoon(el) {
    if (!el) return;
    el.style.willChange = 'transform, opacity';
    setTimeout(function () {
      if (el) el.style.willChange = 'auto';
    }, 480);
  }

  function setActiveCoverflow(idx, announce) {
    i = ((idx % n) + n) % n;
    tiles.forEach(function (t, k) {
      var off = k - i;
      if (off > n / 2) off -= n;
      if (off < -n / 2) off += n;
      t.dataset.off = String(off);
      t.setAttribute('aria-hidden', off === 0 ? 'false' : 'true');
      t.tabIndex = off === 0 ? 0 : -1;
      t.classList.toggle('is-focus', off === 0);
      var abs = Math.abs(off);
      var tx = off * 58;
      var ry = off * -28;
      var sc = off === 0 ? 1.08 : Math.max(0.72, 1 - abs * 0.14);
      var op = off === 0 ? 1 : Math.max(0.35, 1 - abs * 0.28);
      clearWillChangeSoon(t);
      t.style.transform =
        'translate(-50%,-50%) translateX(' + tx + '%) translateZ(' + (off === 0 ? 40 : -abs * 60) + 'px) rotateY(' + ry + 'deg) scale(' + sc + ')';
      t.style.opacity = String(op);
      t.style.zIndex = String(100 - abs);
    });
    syncDots(announce);
  }

  function setActiveSnap(idx, announce) {
    i = ((idx % n) + n) % n;
    tiles.forEach(function (t, k) {
      var on = k === i;
      t.setAttribute('aria-hidden', on ? 'false' : 'true');
      t.tabIndex = on ? 0 : -1;
      t.classList.toggle('is-focus', on);
      // Flat: only opacity/scale via CSS classes — no 3D, no inline transform
      t.style.transform = '';
      t.style.opacity = '';
      t.style.zIndex = '';
    });
    var target = tiles[i];
    if (target && stage && !snapScrolling) {
      snapScrolling = true;
      clearWillChangeSoon(target);
      var left = target.offsetLeft - (stage.clientWidth - target.offsetWidth) / 2;
      if (typeof stage.scrollTo === 'function') {
        stage.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' });
      } else {
        stage.scrollLeft = Math.max(0, left);
      }
      setTimeout(function () { snapScrolling = false; }, 420);
    }
    syncDots(announce);
  }

  function setActive(idx, announce) {
    if (reduce) return;
    if (isSnap()) setActiveSnap(idx, announce);
    else setActiveCoverflow(idx, announce);
  }

  function syncDots(announce) {
    if (dots) {
      Array.prototype.forEach.call(dots.children, function (d, k) {
        d.setAttribute('aria-selected', k === i ? 'true' : 'false');
        d.classList.toggle('on', k === i);
      });
    }
    if (announce && stage) {
      var label = tiles[i].getAttribute('data-label') || tiles[i].querySelector('.car-title');
      stage.setAttribute(
        'aria-label',
        'Projects, showing ' + (typeof label === 'string' ? label : (label && label.textContent) || (i + 1) + ' of ' + n)
      );
    }
  }

  function next() { if (!open) setActive(i + 1, true); }
  function prev() { if (!open) setActive(i - 1, true); }

  function start() {
    stop();
    // No auto-rotate on touch/narrow — avoids jank and surprise scroll fights
    if (reduce || paused || open || isSnap()) return;
    timer = setInterval(next, 4200);
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = 0; }
  }

  // Dots
  if (dots) {
    tiles.forEach(function (t, k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'car-dot';
      b.setAttribute('aria-label', 'Go to ' + (t.getAttribute('data-label') || ('tile ' + (k + 1))));
      b.setAttribute('role', 'tab');
      b.addEventListener('click', function () { setActive(k, true); start(); });
      dots.appendChild(b);
    });
  }

  if (prevBtn) prevBtn.addEventListener('click', function () { prev(); start(); });
  if (nextBtn) nextBtn.addEventListener('click', function () { next(); start(); });

  // Pause on hover / focus (desktop autoplay only)
  root.addEventListener('pointerenter', function () { paused = true; stop(); });
  root.addEventListener('pointerleave', function () { if (!open) { paused = false; start(); } });
  if (stage) {
    stage.addEventListener('focusin', function () { paused = true; stop(); });
    stage.addEventListener('focusout', function () {
      if (!open && !root.contains(document.activeElement)) { paused = false; start(); }
    });
  }

  // Keyboard
  document.addEventListener('keydown', function (e) {
    if (open) {
      if (e.key === 'Escape') { closeSubs(); e.preventDefault(); }
      return;
    }
    if (!root.contains(document.activeElement) && document.activeElement !== document.body) return;
    if (e.key === 'ArrowRight') { next(); start(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { prev(); start(); e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') {
      var t = tiles[i];
      if (t && (document.activeElement === t || document.activeElement === stage || document.activeElement === document.body)) {
        activateTile(t);
        e.preventDefault();
      }
    }
  });

  // Desktop coverflow swipe only (snap mode uses native scroll)
  if (stage) {
    stage.addEventListener('touchstart', function (e) {
      if (isSnap() || !e.touches[0]) return;
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
      swiping = true;
      paused = true; stop();
    }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (isSnap() || !swiping) return;
      swiping = false;
      var t = e.changedTouches[0];
      if (!t) { paused = false; start(); return; }
      var dx = t.clientX - touchX;
      var dy = t.clientY - touchY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) next(); else prev();
      }
      paused = false; start();
    }, { passive: true });

    // Sync active index from scroll-snap
    var scrollTimer = 0;
    stage.addEventListener('scroll', function () {
      if (!isSnap() || snapScrolling) return;
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        var mid = stage.scrollLeft + stage.clientWidth / 2;
        var best = 0;
        var bestDist = Infinity;
        tiles.forEach(function (t, k) {
          var c = t.offsetLeft + t.offsetWidth / 2;
          var d = Math.abs(c - mid);
          if (d < bestDist) { bestDist = d; best = k; }
        });
        if (best !== i) {
          i = best;
          tiles.forEach(function (t, k) {
            var on = k === i;
            t.setAttribute('aria-hidden', on ? 'false' : 'true');
            t.tabIndex = on ? 0 : -1;
            t.classList.toggle('is-focus', on);
          });
          syncDots(true);
        }
      }, 80);
    }, { passive: true });
  }

  function activateTile(tile) {
    if (!tile) return;
    if (tile.dataset.hasSubs === '1') {
      openSubs(tile.dataset.cat, tile.getAttribute('data-label') || '');
      return;
    }
    var href = tile.dataset.href;
    if (href) location.href = href;
  }

  tiles.forEach(function (t) {
    t.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) return;
      e.stopPropagation();
      setActive(tiles.indexOf(t), true);
      activateTile(t);
    });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { activateTile(t); e.preventDefault(); }
    });
  });

  function fillSubs(cat) {
    var tpl = document.getElementById('subs-' + cat);
    if (!tpl || !subTiles) return false;
    subTiles.innerHTML = '';
    var nodes = tpl.content.cloneNode(true);
    subTiles.appendChild(nodes);
    if (!reduce && !isSnap()) {
      Array.prototype.forEach.call(subTiles.querySelectorAll('.fcard'), function (c, idx) {
        c.classList.add('bob');
        c.style.setProperty('--i', String(idx));
      });
    }
    return true;
  }

  function openSubs(cat, title) {
    if (!subPanel || !fillSubs(cat)) return;
    open = true;
    stop();
    root.classList.add('car-dimmed');
    if (subTitle) subTitle.textContent = title || cat;
    document.body.classList.add('sub-open');
    subPanel.hidden = false;
    requestAnimationFrame(function () { subPanel.classList.add('open'); });
    tiles[i].setAttribute('aria-expanded', 'true');
    if (subClose) subClose.focus();
  }

  function closeSubs() {
    if (!open || !subPanel) return;
    open = false;
    subPanel.classList.remove('open');
    root.classList.remove('car-dimmed');
    document.body.classList.remove('sub-open');
    tiles.forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
    var finished = false;
    var done = function () {
      if (finished) return;
      finished = true;
      subPanel.hidden = true;
      if (subTiles) subTiles.innerHTML = '';
      subPanel.removeEventListener('transitionend', done);
      paused = false;
      start();
      if (tiles[i]) tiles[i].focus();
    };
    if (reduce) done();
    else {
      subPanel.addEventListener('transitionend', done);
      setTimeout(done, 420);
    }
  }

  if (subClose) subClose.addEventListener('click', closeSubs);
  document.addEventListener('click', function (e) {
    if (!open) return;
    if (subPanel.contains(e.target)) return;
    if (e.target.closest && e.target.closest('.car-tile[data-has-subs="1"]')) return;
    closeSubs();
  });

  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', function () {
      if (open) closeSubs();
      applyMode();
    });
  } else if (typeof mq.addListener === 'function') {
    mq.addListener(function () {
      if (open) closeSubs();
      applyMode();
    });
  }

  applyMode();
})();
