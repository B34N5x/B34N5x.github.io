/* Lightweight same-origin navigation fade when View Transitions API is absent. */
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var supports = !!(document.startViewTransition && CSS.supports && CSS.supports('view-transition-name', 'none'));
  if (supports || reduce) return;
  document.documentElement.classList.add('vt-fallback');
  document.addEventListener('DOMContentLoaded', function () {
    requestAnimationFrame(function () {
      document.body.classList.add('is-entering');
      requestAnimationFrame(function () { document.body.classList.remove('is-entering'); });
    });
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    var href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('http')) return;
    // same-folder / relative only
    e.preventDefault();
    document.body.classList.add('is-leaving');
    setTimeout(function () { location.href = a.href; }, 220);
  });
})();
