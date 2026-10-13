// Easter eggs: type "bg123" anywhere or click the X mark to open the riddles.
(function () {
  "use strict";
  console.log("%c> wake up, builder...", "color:#3df58f;font-family:monospace;font-size:14px");
  console.log('Riddle: "A million of me make just one, the smallest piece when all is done." (Hint: type bg123 on the home page.)');
  const panel = document.getElementById("riddles"), mark = document.getElementById("xmark");
  if (!panel) return;
  let last = null;
  function open() { last = document.activeElement; panel.hidden = false; if (mark) mark.setAttribute("aria-expanded", "true"); panel.querySelector(".close").focus(); }
  function close() { panel.hidden = true; if (mark) mark.setAttribute("aria-expanded", "false"); if (last && last.focus) last.focus(); }
  if (mark) mark.addEventListener("click", () => panel.hidden ? open() : close());
  panel.querySelector(".close").addEventListener("click", close);
  panel.querySelectorAll("button[data-for]").forEach(b => b.addEventListener("click", () => {
    const a = document.getElementById(b.getAttribute("data-for")); a.hidden = !a.hidden;
    b.setAttribute("aria-expanded", String(!a.hidden)); b.textContent = a.hidden ? "Reveal answer" : "Hide answer";
  }));
  if (location.hash === "#bg123") open();
  let buf = "";
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !panel.hidden) { close(); return; }
    const t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    if (e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-5);
    if (buf === "bg123" && panel.hidden) open();
  });
})();
