// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// v18 intro: ~6 s "logging into the lobby" (boot text, neon sign power-up, doors open, fly-through), drawn on a 2D canvas.
// Once per session (sessionStorage 'introSeen' only). Skipped for prefers-reduced-motion. Skip button always visible. Music via intro_audio.js (procedural).
(() => {
  let seen = false; try { seen = sessionStorage.getItem('introSeen') === '1'; } catch {}
  if (seen || matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]nointro/.test(location.search)) return;
  const D = 6200, wrap = document.createElement('div'); wrap.id = 'intro';
  const cv = document.createElement('canvas'), sk = document.createElement('button');
  sk.type = 'button'; sk.id = 'introSkip'; sk.textContent = 'Skip ›'; sk.setAttribute('aria-label', 'Skip intro');
  // v35 tap gate: browsers block sound until a user gesture, so wait for one tap/click/key before playing the intro.
  const gt = document.createElement('button'); gt.type = 'button'; gt.id = 'introGate'; gt.setAttribute('aria-label', 'Tap to start, sound on');
  gt.innerHTML = '<span style="font-size:clamp(28px,7vmin,56px);font-weight:900;letter-spacing:.04em">TAP TO START</span><span style="font-size:clamp(16px,3.6vmin,24px);opacity:.85">\u{1F50A} sound on</span><span class="trustnote" style="display:block;max-width:min(84vw,460px);margin-top:.9em;padding:.45em .8em;font-size:clamp(12px,2.6vmin,15px);font-weight:500;line-height:1.35;color:#d9ffe6;background:rgba(0,40,20,.55);border:1px solid rgba(80,220,140,.55);border-radius:8px;white-space:normal">\u{1F512} No wallet connect. We never ask for seeds, keys or signatures. Paste a public address or play as a guest.</span>';
  gt.style.cssText = 'position:absolute;inset:0;margin:auto;width:min(86vw,520px);height:min(46vh,240px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(5,3,15,.82);color:#9ff7ff;border:2px solid #22f0ff;border-radius:18px;box-shadow:0 0 24px rgba(34,240,255,.45);font-family:inherit;cursor:pointer;z-index:1;text-align:center;padding:16px';
  wrap.append(cv, gt, sk); document.body.append(wrap);
  const g = cv.getContext('2d'); let W, H, R, raf, last = 0, el = 0, over = false;
  const size = () => { R = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * R; cv.height = H * R; g.setTransform(R, 0, 0, R, 0, 0); };
  size(); addEventListener('resize', size);
  // music: autoplays with the intro; if the browser blocks it, starts on the first pointerdown/keydown/touchstart anywhere; fades ~0.8 s on Enter/Skip/end. No toggle.
  let ac = null, mg = null; const EV = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown', 'touchstart']; // Android Chrome only grants activation on pointerup/touchend/click, not touchstart/touch-pointerdown
  const unhook = () => EV.forEach(k => removeEventListener(k, startAudio, true));
  // v37: audio is only started from the gate's click (a real user gesture). No AudioContext before the tap
  // (a context made at load starts 'suspended' and some Android builds never resume it). HTMLAudio fallback = the
  // same score pre-rendered offline to a WAV blob, started muted inside the gesture and unmuted if WebAudio isn't running.
  let fb = null; const log = (...a) => console.warn('[intro audio]', ...a);
  try { const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (OC && window.IntroAudio) { const sr = 22050, oc = new OC(1, Math.ceil(sr * D / 1000), sr);
    IntroAudio.score(oc, oc.destination, 0, D / 1000); oc.startRendering().then(b => { const d = b.getChannelData(0), n = d.length, v = new DataView(new ArrayBuffer(44 + n * 2)), w = (o, t) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
      w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
      fb = new Audio(URL.createObjectURL(new Blob([v], { type: 'audio/wav' }))); fb.preload = 'auto'; window.__introFB = fb; }).catch(e => log('offline render failed', e)); } } catch (e) { log('offline setup failed', e); }
  function startAudio() { if (mg || over || !window.IntroAudio) return;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); window.__introAC = ac;
      const p = ac.resume(); if (p) p.catch(e => log('resume failed', e));
      const sb = ac.createBufferSource(); sb.buffer = ac.createBuffer(1, 1, 22050); sb.connect(ac.destination); sb.start(0); // silent unlock
      mg = IntroAudio.score(ac, ac.destination, ac.currentTime + .05, D / 1000);
    } catch (e) { log('WebAudio failed', e); }
    if (fb) { try { fb.muted = true; fb.currentTime = 0; const q = fb.play(); if (q) q.catch(e => log('fallback play failed', e)); } catch (e) { log('fallback failed', e); }
      setTimeout(() => { if (over || !fb) return; if (ac && ac.state === 'running') { fb.pause(); return; } log('AudioContext state', ac && ac.state, '- using HTMLAudio fallback'); fb.muted = false; }, 300); } }
  const fade = () => { if (ac && mg) { const n = ac.currentTime; mg.gain.cancelScheduledValues(n); mg.gain.setValueAtTime(mg.gain.value, n); mg.gain.linearRampToValueAtTime(0, n + .8); } const c = ac; if (c) setTimeout(() => c.close().catch(() => {}), 1000);
    if (fb && !fb.paused) { const f = fb, v0 = f.volume, t0 = performance.now(), st = () => { const k = (performance.now() - t0) / 800; if (k >= 1) { f.pause(); return; } f.volume = v0 * (1 - k); requestAnimationFrame(st); }; st(); } };
  const end = () => { if (over) return; over = true; fade(); cancelAnimationFrame(raf); if (started) try { sessionStorage.setItem('introSeen', '1'); } catch {}
    wrap.style.pointerEvents = 'none'; wrap.style.opacity = 0; const rm = () => wrap.remove(); wrap.addEventListener('transitionend', rm, { once: true }); setTimeout(rm, 600); removeEventListener('resize', size); };
  let started = false; const begin = () => { if (started || over) return; started = true; gt.remove(); startAudio(); last = 0; raf = requestAnimationFrame(frame); };
  gt.onclick = begin; const onKey = e => { if (!started) { if (e.key !== 'Escape') return begin(); } if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { removeEventListener('keydown', onKey); end(); } };
  sk.onclick = end; addEventListener('keydown', onKey);
  const LINES = ['> handshake ........ ok', '> verifying guest pass ... ok', '> loading plaza ........ ok', '> welcome to the lobby'];
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  function frame(now) {
    el += last ? Math.min(50, now - last) : 0; last = now; const t = el / 1000; if (el >= D) return end(); // frame-clamped so a busy load can't skip it
    const m = Math.min(W, H), cx = W / 2, cy = H / 2;
    const z = 1 + 5 * ease((t - 4.2) / 1.8) ** 2; // fly-through zoom at the end
    g.setTransform(R, 0, 0, R, 0, 0); g.fillStyle = '#05030f'; g.fillRect(0, 0, W, H);
    g.save(); g.translate(cx, cy); g.scale(z, z); g.translate(-cx, -cy);
    // floor grid in perspective
    g.strokeStyle = 'rgba(34,240,255,.25)'; g.lineWidth = 1; const hz = cy + m * .12;
    for (let i = -10; i <= 10; i++) { g.beginPath(); g.moveTo(cx + i * m * .04, hz); g.lineTo(cx + i * m * .4, H * 1.3); g.stroke(); }
    for (let k = 0; k < 10; k++) { const y = hz + (H - hz) * ((k + (t * .6) % 1) / 10) ** 2; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    // shop front + doors
    const fw = m * .62, fh = m * .44, fx = cx - fw / 2, fy = hz - fh, open = ease((t - 3.2) / 1.1);
    g.fillStyle = '#120a2a'; g.fillRect(fx, fy, fw, fh);
    const dw = fw * .26, dh = fh * .62, dx = cx - dw, dy = hz - dh;
    g.fillStyle = 'rgba(255,61,240,.18)'; g.fillRect(dx, dy, dw * 2, dh); // light behind doors
    g.fillStyle = '#1d1340'; g.fillRect(dx - open * dw * .95, dy, dw, dh); g.fillRect(dx + dw + open * dw * .95, dy, dw, dh);
    g.strokeStyle = '#22f0ff'; g.lineWidth = 2; g.strokeRect(dx, dy, dw * 2, dh);
    // neon sign boot-up (flicker 1.4-2.6 s, then steady)
    const on = t > 2.6 || (t > 1.4 && Math.sin(t * 47) > .1);
    g.font = `italic 900 ${Math.round(m * .08)}px Impact, "Arial Black", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const sy = fy + fh * .16, fs = m * .08, tw = g.measureText('THE LOBBY').width; g.save(); g.translate(cx, sy); g.transform(1, 0, -.18, 1, 0, 0);
    const gr = g.createLinearGradient(0, -fs / 2, 0, fs / 2); [[0, '#f4f7fb'], [.38, '#b9c3cf'], [.52, '#ffb347'], [.72, '#ff5a1f'], [1, '#c8102e']].forEach(([o, c]) => gr.addColorStop(o, c));
    g.globalAlpha = on ? 1 : .2; g.shadowColor = '#ff2a3d'; g.shadowBlur = on ? 14 : 0; g.fillStyle = gr; g.fillText('THE LOBBY', 0, 0); g.shadowBlur = 0;
    ['#ff5a1f', '#ffb347', '#c8102e'].forEach((c, k) => { const x0 = -tw * (.3 - k * .1), x1 = tw * .62, lg = g.createLinearGradient(x0, 0, x1, 0); lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(.4, c); lg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = lg; g.fillRect(x0, fs * .55 + k * 5, x1 - x0, 2); });
    g.restore(); g.globalAlpha = 1; g.restore();
    // boot text (fades as the doors open)
    const a = 1 - ease((t - 3.4) / .6); if (a > 0) { g.globalAlpha = a; g.fillStyle = '#9ff7ff'; g.textAlign = 'left';
      g.font = `500 ${Math.max(11, Math.round(m * .03))}px ui-monospace, monospace`; const lh = Math.max(14, m * .042), x0 = Math.max(16, W * .06), y0 = Math.max(76, H * .1);
      LINES.forEach((s, i) => { const n = Math.floor((t - i * .7) * 40); if (n > 0) g.fillText(s.slice(0, n), x0, y0 + i * lh); }); g.globalAlpha = 1; }
    // progress bar
    g.fillStyle = 'rgba(34,240,255,.2)'; g.fillRect(W * .2, H - 14, W * .6, 3); g.fillStyle = '#22f0ff'; g.fillRect(W * .2, H - 14, W * .6 * Math.min(1, el / D), 3);
    g.fillStyle = 'rgba(5,3,15,' + ease((t - 5.6) / .6) + ')'; g.fillRect(0, 0, W, H);
    raf = requestAnimationFrame(frame);
  }
  g.fillStyle = '#05030f'; g.fillRect(0, 0, W, H); window.__introBegin = begin; window.__introEnd = end; window.__introSeek = s => { el = s * 1000; }; // test hook
})();
