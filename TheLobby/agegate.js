// (c) 2026 B34N5x. All rights reserved.
// Self-declaration age notice. sessionStorage only (this tab); never sent to a server; no ID or personal data collected.
(function () {
  const KEY = 'lobbyAgeOk';
  try { if (sessionStorage.getItem(KEY) === '1') return; } catch (_) {}
  const wrap = document.createElement('div');
  wrap.id = 'agegate';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-labelledby', 'agegate-title');
  wrap.innerHTML = `<div class="agebox">
    <h2 id="agegate-title">Adult supervision advised</h2>
    <p>The Lobby is a shared 3D hangout with <strong>preset emotes only</strong> — no text chat and no voice.</p>
    <p>Confirm you are <strong>16 or older</strong>, or that a responsible adult is supervising you.</p>
    <p class="agenote">This choice stays in this browser tab only (session). We never collect ID, names, or personal details, and nothing is sent to our servers.</p>
    <div class="agebtns">
      <button type="button" id="age16" class="ageok">I am 16+</button>
      <button type="button" id="ageadult" class="ageok">An adult is supervising</button>
    </div>
  </div>`;
  const lock = () => { document.documentElement.classList.add('age-locked'); };
  const unlock = () => {
    try { sessionStorage.setItem(KEY, '1'); } catch (_) {}
    document.documentElement.classList.remove('age-locked');
    wrap.remove();
  };
  const go = () => { if (document.body) { document.body.append(wrap); lock(); } else document.addEventListener('DOMContentLoaded', () => { document.body.append(wrap); lock(); }); };
  go();
  wrap.addEventListener('click', e => {
    const t = e.target;
    if (t && (t.id === 'age16' || t.id === 'ageadult')) unlock();
  });
})();
