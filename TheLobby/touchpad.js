// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// v14 shared touch controller: left stick (optional), right face-button diamond, shoulder pills, exit.
// setLayout(map) swaps labels + keys. map = { stick: bool, buttons: [{ slot, label, word, key, code, hold }], exit: { label, onTap } }
// slots: top|left|right|bottom (diamond), l1|r1 (shoulder pills). Keys dispatch as real KeyboardEvents (key + code) so games run their own handlers.
const CSS = `:root{--hud-scale:1;--hud-op:.55}
#tpad button,#tstick,#texit{opacity:var(--hud-op);transition:opacity .1s}#tpad button.on,#tpad button:active,#texit:active{opacity:1}
#tpad,#tstick,#texit{display:none}body.touch #tpad{display:block}#texit:not([hidden]){display:block}body.touch.tp-stick #tstick{display:block}
#tpad{position:fixed;right:10px;bottom:14px;width:200px;height:236px;z-index:33;touch-action:none;transform:scale(var(--hud-scale));transform-origin:bottom right}
#tpad button{position:absolute;width:58px;height:58px;touch-action:none;border-radius:50%;border:1px solid #22f0ff;background:rgba(6,24,40,.45);color:#dffcff;font:700 15px sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;padding:0;-webkit-tap-highlight-color:transparent;user-select:none}
#tpad button::after{content:'';position:absolute;inset:-6px;border-radius:50%}#tpad button>*{pointer-events:none}
#tpad button small{font:500 8px sans-serif;margin-top:3px;opacity:.8}#tpad button.on{background:rgba(34,240,255,.35)}
#tpad .s-top{left:71px;top:46px}#tpad .s-left{left:6px;top:106px}#tpad .s-right{left:136px;top:106px}
#tpad .s-bottom{left:68px;top:168px;width:64px;height:64px;font-size:19px;border-color:#ff3df0}
#tpad .s-l1,#tpad .s-r1{top:0;width:76px;height:36px;border-radius:18px;flex-direction:row;gap:5px;font-size:12px}#tpad .s-l1 small,#tpad .s-r1 small{margin:0}
#tpad .s-l1::after,#tpad .s-r1::after{inset:-8px -2px;border-radius:22px}#tpad .s-l1{left:2px}#tpad .s-r1{left:122px}
#tstick{position:fixed;left:24px;bottom:24px;width:110px;height:110px;transform:scale(var(--hud-scale));transform-origin:bottom left;border-radius:50%;background:rgba(255,255,255,.22);z-index:31;touch-action:none}
#tstick i{position:absolute;left:35px;top:35px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.7)}
#texit{position:fixed;top:64px;left:10px;min-height:48px;z-index:32;padding:6px 12px;border-radius:14px;border:1px solid #ff3df0;background:rgba(20,6,30,.6);color:#ffd6fb;font:700 13px sans-serif}
@media (max-height:500px){#tpad{bottom:6px}}`;
export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const kd = (key, code, up) => dispatchEvent(new KeyboardEvent(up ? 'keyup' : 'keydown', { key, code, bubbles: true }));
let pad, stick, exitB;
function mount() {
  if (pad) return; const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  pad = Object.assign(document.createElement('div'), { id: 'tpad' }); stick = Object.assign(document.createElement('div'), { id: 'tstick' }); stick.innerHTML = '<i></i>';
  exitB = Object.assign(document.createElement('button'), { id: 'texit', type: 'button' }); document.body.append(pad, stick, exitB);
  if (isTouch) document.body.classList.add('touch');
  // stick -> arrow keys (held while pushed)
  const knob = stick.firstChild, held = {};
  const dir = (k, c, on) => { if (!!held[k] === on) return; held[k] = on; kd(k, c, !on); };
  const upd = (dx, dy) => { dir('ArrowLeft', 'ArrowLeft', dx < -15); dir('ArrowRight', 'ArrowRight', dx > 15); dir('ArrowUp', 'ArrowUp', dy < -25); dir('ArrowDown', 'ArrowDown', dy > 25); };
  stick.addEventListener('touchmove', e => { e.preventDefault(); const t = e.targetTouches[0], r = stick.getBoundingClientRect();
    let dx = t.clientX - r.left - 55, dy = t.clientY - r.top - 55; const m = Math.hypot(dx, dy); if (m > 40) { dx *= 40 / m; dy *= 40 / m; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; upd(dx, dy); }, { passive: false });
  stick.addEventListener('touchend', () => { knob.style.transform = ''; upd(0, 0); });
}
export function setLayout(map) {
  mount(); pad.replaceChildren(); document.body.classList.toggle('tp-stick', !!map.stick);
  pad.classList.toggle('tp-lobby', !!(map && map.buttons && map.buttons.some(b => (b.key === 'e' || b.code === 'KeyE') && (b.word === 'use' || b.label === 'E'))));
  for (const b of map.buttons) {
    const el = document.createElement('button'); el.type = 'button'; el.className = 's-' + b.slot; el.replaceChildren(String(b.label), Object.assign(document.createElement('small'), { textContent: b.word }));
    const down = () => { el.classList.add('on'); b.fn ? b.fn() : kd(b.key, b.code); }, up = () => { el.classList.remove('on'); if (!b.fn) kd(b.key, b.code, true); };
    let held = false; // pointer events: thumb, mouse and pen alike; capture so a sliding thumb still releases cleanly
    el.addEventListener('pointerdown', e => { e.preventDefault(); if (held) return; held = true; try { el.setPointerCapture(e.pointerId); } catch { } down(); });
    const rel = e => { if (!held) return; held = false; e.preventDefault?.(); up(); };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => el.addEventListener(t, rel)); el.addEventListener('contextmenu', e => e.preventDefault()); pad.append(el); }
  exitB.hidden = !map.exit; if (map.exit) { exitB.textContent = map.exit.label; exitB.onclick = map.exit.onTap; }
}
const K = (slot, label, word, key, code) => ({ slot, label, word, key, code: code || 'Key' + key.toUpperCase() });
// game pages: Back gesture / browser Back / exit button all return to the lobby
const toLobby = spawn => location.replace(`../index.html?spawn=${spawn}`);
const GAME_EXIT = spawn => ({ label: '\u2190 Back to Lobby', onTap: () => toLobby(spawn), spawn });
export function trapBack(onBack) { history.pushState({ tp: 1 }, ''); addEventListener('popstate', () => { history.pushState({ tp: 1 }, ''); onBack(); }); }
export function gamePage(map) { setLayout(map); trapBack(() => toLobby(map.exit.spawn)); addEventListener('keydown', e => { if (e.key === 'Escape' && !e.repeat) toLobby(map.exit.spawn); }); } // v26: Esc = back to lobby
export const LAYOUTS = {
  lobby: { stick: false, buttons: [K('right', 'E', 'use', 'e'), K('bottom', '\u2191', 'jump', ' ', 'Space')] }, // Jump + E always on (desktop+phone); N/M/C/V in Settings
  fighter: { stick: true, buttons: [K('top', 'U', 'special', 'u'), K('left', 'J', 'punch', 'j'), K('right', 'K', 'kick', 'k'), K('bottom', 'W', 'jump', 'w'), K('r1', 'L', 'block', 'l')],
    exit: GAME_EXIT('fighter') },
  shooter: { stick: true, buttons: [K('bottom', '\u25CF', 'fire', ' ', 'Space'), K('r1', 'M', 'music', 'm')], exit: GAME_EXIT('arcade') },
};

// v15b: flag any fullscreen (API on any element, or browser-level fullscreen) for CSS
const fsSync = () => document.documentElement.classList.toggle('isfs',
  !!(document.fullscreenElement || document.webkitFullscreenElement) ||
  matchMedia('(display-mode: fullscreen)').matches ||
  (Math.abs(innerHeight - screen.height) < 2 && Math.abs(innerWidth - screen.width) < 2));
['fullscreenchange', 'webkitfullscreenchange', 'resize'].forEach(e => addEventListener(e, fsSync));
document.addEventListener('fullscreenchange', fsSync); fsSync();
