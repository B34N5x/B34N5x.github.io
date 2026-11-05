// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// Compact HUD: Emotes / Settings / Info. Emotes are allow-listed codes only (no free text). Relay may forward via emoteListeners.
const $ = id => document.getElementById(id);
export const EMOTES = [
  { e: 'wave', label: '👋 Heya' },
  { e: 'thumbs', label: '👍' },
  { e: 'gg', label: 'GG' },
  { e: 'follow', label: 'Follow me' },
  { e: 'nicenft', label: 'Nice NFT!' },
  { e: 'dance', label: '💃 Dance' },
  { e: 'cheer', label: '🎉 Cheer' },
];
export const EMOTE_LABEL = Object.fromEntries(EMOTES.map(x => [x.e, x.label]));
const ALLOWED = new Set(EMOTES.map(x => x.e));
export const emoteListeners = [];
export function showBubble(text) {
  let b = $('ebubble'); if (!b) { b = document.createElement('div'); b.id = 'ebubble'; document.body.append(b); }
  b.textContent = text; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  clearTimeout(showBubble.t); showBubble.t = setTimeout(() => b.classList.remove('on'), 2200);
}
/** @param {string} e allow-listed emote code */
export function sendEmote(e) {
  if (!ALLOWED.has(e)) return;
  showBubble(EMOTE_LABEL[e] || e);
  emoteListeners.forEach(f => { try { f(e); } catch (err) {} });
}
export function initHudMenus(opt = {}) { if (document.getElementById('hmenu')) return;
  const bar = document.createElement('div'); bar.id = 'hmenu';
  bar.innerHTML = `<div class="hm"><button type="button" id="hmE" aria-expanded="false" aria-label="Emotes">😀<span class="lbl"> Emotes</span> ▾</button><div class="hmp" id="hmEp"></div></div>
  <div class="hm"><button type="button" id="hmS" aria-expanded="false" aria-label="Settings">⚙<span class="lbl"> Settings</span> ▾</button><div class="hmp" id="hmSp"></div></div>
  <button type="button" id="hmI" aria-pressed="true" aria-label="Info">ⓘ<span class="lbl"> Info: ON</span></button>`;
  document.body.append(bar);
  EMOTES.forEach(item => { const b = document.createElement('button'); b.type = 'button'; b.textContent = item.label; b.onclick = () => { sendEmote(item.e); close(); }; $('hmEp').append(b); });
  const sp = $('hmSp'); const snd = $('snd'); if (snd) sp.append(snd);
  const fs = document.createElement('button'); fs.type = 'button'; fs.id = 'hmFS';
  const fsTxt = () => fs.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
  fs.onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}).finally(fsTxt);
  document.addEventListener('fullscreenchange', fsTxt); fsTxt(); sp.append(fs);
  { const ib = document.createElement('button'); ib.type = 'button'; ib.id = 'hmInstall'; ib.textContent = 'Install app'; const hint = document.createElement('div'); hint.className = 'ainote'; hint.id = 'hmInstallHint';
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const upd = () => { const inst = window.__pwaInstalled || (window.__isInstalled && window.__isInstalled()); ib.hidden = inst || !(window.__bip || ios); hint.hidden = true; };
    ib.onclick = async () => { if (window.__bip) { const p = window.__bip; window.__bip = null; p.prompt(); await p.userChoice.catch(() => {}); upd(); } else if (ios) { hint.textContent = 'To install: tap Share, then Add to Home Screen.'; hint.hidden = false; } };
    addEventListener('pwachange', upd); upd(); sp.append(ib, hint); }
  const lay = document.createElement('button'); lay.type = 'button'; lay.textContent = 'Re-fit layout'; lay.onclick = () => { window.__layout && window.__layout(); close(); }; sp.append(lay);
  { const bug = document.createElement('button'); bug.type = 'button'; bug.id = 'hmBug'; bug.textContent = '🐞 Report a bug';
    const body = encodeURIComponent('What happened:\n\n\nSteps to reproduce:\n1.\n2.\n3.\n\nDevice & browser:\n');
    bug.onclick = () => { location.href = 'mailto:xrplwill.contact@gmail.com?subject=The%20Lobby%20beta%20bug&body=' + body; close(); }; sp.append(bug); }
  { const vb = document.createElement('button'); vb.type = 'button'; vb.id = 'hmView'; vb.textContent = 'Camera view [V]';
    vb.onclick = () => { dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', bubbles: true })); close(); }; sp.append(vb); }
  { const cb = document.createElement('button'); cb.type = 'button'; cb.id = 'hmFront'; cb.textContent = 'Front view [C]';
    cb.onclick = () => { dispatchEvent(new KeyboardEvent('keydown', { key: 'c', code: 'KeyC', bubbles: true })); close(); }; sp.append(cb); }
  { const mb = document.createElement('button'); mb.type = 'button'; mb.id = 'hmHud'; mb.textContent = 'Toggle HUD [M]';
    mb.onclick = () => { dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM', bubbles: true })); close(); }; sp.append(mb); }
    { const ub = document.createElement('button'); ub.type = 'button'; ub.id = 'hmUnstuck'; ub.textContent = '🧭 Unstuck [U]';
    ub.title = 'Clear stuck controls and return to the plaza';
    ub.onclick = () => { if (window.__unstuck) window.__unstuck(); close(); }; sp.append(ub); }
  { const gb = document.createElement('button'); gb.type = 'button'; gb.id = 'hmGuide'; gb.textContent = '🗺 Guide';
    gb.onclick = () => { const g = $('guide'); if (g) { g.focus(); g.click?.(); } const lab = document.querySelector('#hub .guide'); if (lab) lab.scrollIntoView({ block: 'nearest' }); close(); }; sp.append(gb); }
  { const ib = document.getElementById('inviteBtn'); if (ib) { const c = document.createElement('button'); c.type = 'button'; c.id = 'hmInvite'; c.textContent = '📨 Invite';
    c.onclick = () => { ib.click(); close(); }; sp.append(c); } }
if (opt.perf) { const lw = document.createElement('button'); lw.type = 'button'; const lt = () => lw.textContent = `Lightweight mode: ${opt.perf.low ? 'ON' : 'OFF'}`; lt(); const _poc = opt.perf.onchange; opt.perf.onchange = (low) => { _poc && _poc(low); lt(); }; lw.onclick = () => { opt.perf.manual = true; opt.perf.apply(!opt.perf.low); }; sp.append(lw); }
  const menus = [['hmE', 'hmEp'], ['hmS', 'hmSp']];
  function close() { menus.forEach(([b, p]) => { $(p).classList.remove('on'); $(b).setAttribute('aria-expanded', 'false'); }); }
  menus.forEach(([b, p]) => $(b).onclick = ev => { ev.stopPropagation(); const open = !$(p).classList.contains('on'); close(); if (open) { $(p).classList.add('on'); $(b).setAttribute('aria-expanded', 'true'); } });
  addEventListener('pointerdown', e => { if (!bar.contains(e.target)) close(); });
  let info = true; $('hmI').onclick = () => { info = !info; document.body.classList.toggle('noinfo', !info); { const l = document.createElement('span'); l.className = 'lbl'; l.textContent = ` Info: ${info ? 'ON' : 'OFF'}`; $('hmI').replaceChildren('ⓘ', l); } $('hmI').style.opacity = info ? 1 : 0.6; $('hmI').setAttribute('aria-pressed', info); };
  return { close };
}
