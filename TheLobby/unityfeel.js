// (c) 2026 B34N5x. All rights reserved. Third-party SFX under Kenney CC0 (see credits.txt).
// Lightweight "Unity game feel": load progress, vignette, footsteps, UI clicks, joystick chrome.
// Respects prefers-reduced-motion and Lightweight mode. Never breaks gameplay.
import * as THREE from './lib/three.module.js';

const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const LW = () => !!(window.__perf && window.__perf.low);
let sfxOn = false, stepAcc = 0, lastStep = 0;
const pool = {};
function play(file, vol = 0.22) {
  if (!sfxOn || RM()) return;
  try {
    const a = pool[file] || (pool[file] = new Audio('assets/kenney/sfx/' + file));
    const c = a.cloneNode(); c.volume = vol; c.play().catch(() => {});
  } catch { /* autoplay / missing */ }
}

/** Install a top progress bar driven by THREE.DefaultLoadingManager (glTF + textures). */
export function installLoader() {
  const bar = document.createElement('div'); bar.id = 'loadbar';
  bar.innerHTML = '<div class="lbtrack"><div class="lbfill"></div></div><span class="lblbl">Loading plaza…</span>';
  document.body.append(bar);
  const fill = bar.querySelector('.lbfill'), lbl = bar.querySelector('.lblbl');
  let done = false;
  const hide = () => { if (done) return; done = true; bar.classList.add('out'); setTimeout(() => bar.remove(), 500); };
  const mgr = THREE.DefaultLoadingManager;
  mgr.onStart = () => { bar.classList.add('on'); };
  mgr.onProgress = (_u, loaded, total) => {
    bar.classList.add('on');
    const p = total ? loaded / total : 0;
    fill.style.width = (8 + p * 92) + '%';
    lbl.textContent = total ? `Loading plaza… ${Math.round(p * 100)}%` : 'Loading plaza…';
  };
  mgr.onLoad = () => { fill.style.width = '100%'; lbl.textContent = 'Ready'; setTimeout(hide, RM() ? 0 : 280); };
  mgr.onError = () => { lbl.textContent = 'Some assets skipped'; setTimeout(hide, 600); };
  // Fallback if nothing reports (procedural-only path)
  setTimeout(() => { if (!bar.classList.contains('on')) hide(); }, 8000);
  setTimeout(hide, 20000);
}

/** Soft vignette overlay (CSS). Hidden in Lightweight / reduced-motion. */
export function installVignette() {
  if (document.getElementById('vignette')) return;
  const v = document.createElement('div'); v.id = 'vignette'; v.setAttribute('aria-hidden', 'true');
  document.body.append(v);
  const sync = () => v.classList.toggle('off', RM() || LW());
  sync();
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', sync);
  addEventListener('resize', sync);
  // Lightweight toggle fires custom apply via __perf.onchange
  const hook = () => { if (window.__perf) { const prev = window.__perf.onchange; window.__perf.onchange = (low) => { prev && prev(low); sync(); }; } };
  hook(); setTimeout(hook, 0);
}

/** Footsteps (Kenney Impact CC0) + UI clicks (Kenney Digital Audio CC0). */
export function installSfx() {
  // UI click on HUD / menus (capture, ignore canvas / joy drag)
  document.addEventListener('click', e => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (!t.closest('button, select, a, .skintile, #guide, .hmp, #hmenu')) return;
    if (t.closest('#joy, #tstick, #tpad, canvas')) return;
    play('lowDown.ogg', 0.18);
  }, true);
}

export function setSfxEnabled(on) { sfxOn = !!on; }

/** Call each frame from the game loop. */
export function tickFeel(ctl, dt) {
  if (!sfxOn || !ctl || RM()) { stepAcc = 0; return; }
  if (!(ctl.grounded && ctl.speed > 1.2)) { stepAcc = 0; return; }
  const pace = Math.max(0.22, 0.48 - Math.min(0.22, ctl.speed * 0.03));
  stepAcc += dt;
  if (stepAcc >= pace) {
    stepAcc = 0;
    const now = performance.now();
    if (now - lastStep < 90) return;
    lastStep = now;
    play('impactGeneric_light_002.ogg', 0.12 + Math.min(0.12, ctl.speed * 0.015));
  }
}

/** Responsive joystick chrome (visual only; input stays in main.js). */
export function polishJoystick() {
  const joy = document.getElementById('joy');
  if (!joy) return;
  joy.classList.add('unity-joy');
  // Safe-area aware position for notched phones
  const apply = () => {
    const s = getComputedStyle(document.documentElement).getPropertyValue('--hud-scale') || '1';
    joy.style.setProperty('--joy-scale', s.trim() || '1');
  };
  apply(); addEventListener('resize', apply);
}
