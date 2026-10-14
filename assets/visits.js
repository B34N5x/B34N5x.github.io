// Anonymous visit counter: no cookies, no IPs, no personal data. Only a page count and site total are stored.
(function () {
  var el = document.createElement("div"); el.className = "visit-count"; el.setAttribute("aria-hidden", "true");
  var p = location.pathname.replace(/index\.html$/, "");
  fetch("https://xrpl-will.pages.dev/api/count?p=" + encodeURIComponent(p), { method: "POST", credentials: "omit", cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { if (d && typeof d.page === "number") { el.textContent = "visits " + d.page; document.body.appendChild(el); } })
    .catch(function () {});
})();
