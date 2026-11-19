(() => {
  "use strict";
  const params = new URLSearchParams(location.search || "");
  if (params.get("embed") === "1" || window.self !== window.top) {
    document.documentElement.classList.add("embedded");
    if (document.body) document.body.classList.add("embedded");
    else document.addEventListener("DOMContentLoaded", () => document.body.classList.add("embedded"));
  }
  if (window.Qu1puDocs && typeof window.Qu1puDocs.load === "function") {
    window.Qu1puDocs.load();
  }
})();
