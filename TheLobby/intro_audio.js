// (c) 2026 B34N5x. All rights reserved. Original procedural WebAudio score (no samples).
// Intro "track 1": bouncy MapleStory-style pentatonic chiptune + a short dubstep wub on the title reveal (~2.6 s).
window.IntroAudio = (() => {
  const B = 60 / 140, N = f => 440 * 2 ** ((f - 69) / 12);
  const LEAD = [[0,76,.5],[.5,79,.5],[1,81,.5],[1.5,84,1],[2.5,81,.5],[3,79,.5],[3.5,76,.5],[4,74,.5],[4.5,76,1],[5.5,79,.5],[6,81,.5],[6.5,79,.5],[7,84,.5],[7.5,88,1.5],[9,86,.5],[9.5,84,.5],[10,81,.5],[10.5,84,1.5],[12,88,2]];
  const BASS = [48,48,55,55,45,45,52,52,41,41,48,48,43,43,48,48];
  function tone(c, out, type, f, t, d, v) { const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0005, t + d); o.connect(g).connect(out); o.start(t); o.stop(t + d + .05); }
  function wub(c, out, t) { // saw -> lowpass with LFO on cutoff
    const o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain();
    o.type = o2.type = 'sawtooth'; o.frequency.value = N(36); o2.frequency.value = N(36) * 1.007; f.type = 'lowpass'; f.Q.value = 9; f.frequency.value = 500;
    l.frequency.setValueAtTime(4, t); l.frequency.linearRampToValueAtTime(8, t + 1.1); lg.gain.value = 420; l.connect(lg).connect(f.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.32, t + .05); g.gain.setValueAtTime(.32, t + 1.0); g.gain.exponentialRampToValueAtTime(.001, t + 1.35);
    o.connect(f); o2.connect(f); f.connect(g).connect(out); [o, o2, l].forEach(x => { x.start(t); x.stop(t + 1.4); }); }
  function score(c, dest, t0, dur) { // dur ~6.2 s; returns master gain
    const m = c.createGain(); m.gain.setValueAtTime(0, t0); m.gain.linearRampToValueAtTime(.55, t0 + .15); m.gain.setValueAtTime(.55, t0 + dur - 1); m.gain.linearRampToValueAtTime(0, t0 + dur); m.connect(dest);
    LEAD.forEach(([b, n, l]) => { tone(c, m, 'square', N(n), t0 + b * B, l * B * .9, .07); tone(c, m, 'triangle', N(n + 12), t0 + b * B, l * B * .6, .05); });
    BASS.forEach((n, i) => tone(c, m, 'triangle', N(n), t0 + i * B * .9, B * .8, .22));
    for (let i = 0; i < 26; i++) { const t = t0 + i * B / 2; tone(c, m, 'square', 2600 + (i % 2) * 400, t, .03, .015); } // hats
    tone(c, m, 'sine', N(96), t0 + 2.6, 1.2, .08); tone(c, m, 'sine', N(100), t0 + 2.62, 1.2, .06); // reveal sparkle
    wub(c, m, t0 + 2.6); return m; }
  return { score };
})();
