// Clear this page: reset everything by reloading a clean URL. Nothing is stored anywhere.
(function () {
  const b = document.getElementById('clearPage'), m = document.getElementById('clearMsg');
  if (location.search === '?cleared') {
    history.replaceState(null, '', location.pathname); // tidy the URL; the flag lives only in the address bar
    if (m) m.hidden = false;
    setTimeout(() => { if (m) m.hidden = true; }, 6000);
  }
  if (b) b.onclick = () => {
    document.querySelectorAll('input, textarea').forEach(el => { el.value = ''; });
    location.replace(location.pathname + '?cleared');
  };
})();
// "I'm new to this" toggle, same pattern as XRPL Will: body.beginner class, default off, memory only (no storage).
(function () {
  const bt = document.getElementById('beginner-toggle'); if (!bt) return;
  const set = on => { document.body.classList.toggle('beginner', on); bt.checked = on; };
  set(false); bt.addEventListener('change', () => set(bt.checked));
})();
