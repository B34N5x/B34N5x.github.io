// Consent gate: the Check button only works after the Terms box is ticked.
// Stores only {version, acceptedAt} in localStorage. Does not touch any XRPL logic.
(function () {
  "use strict";
  var VERSION = "2026-10-14", KEY = "b34n5x-terms-accepted";
  var box = document.getElementById("consent"), btn = document.getElementById("btn"), form = document.getElementById("f");
  if (!box || !btn || !form) return;
  function accepted() { try { var v = JSON.parse(localStorage.getItem(KEY) || "null"); return !!v && v.version === VERSION; } catch (_) { return false; } }
  box.checked = accepted();
  function sync() { btn.disabled = !box.checked; }
  box.addEventListener("change", function () {
    try { if (box.checked) localStorage.setItem(KEY, JSON.stringify({ version: VERSION, acceptedAt: new Date().toISOString() })); else localStorage.removeItem(KEY); } catch (_) {}
    sync();
  });
  // Capture phase, registered before checker.js, so an unticked submit never reaches the checker.
  document.addEventListener("submit", function (e) {
    if (e.target === form && !box.checked) { e.preventDefault(); e.stopImmediatePropagation(); box.focus(); }
  }, true);
  sync();
})();
