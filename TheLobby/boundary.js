// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// Step 12: sandbox boundary. Outside the zone -> 'RETURN TO THE LEDGER' warning (edge static + vignette + countdown).
// Interval countdown: every new exit starts a FRESH full countdown; going back inside resets it fully.
// Countdown ends -> fade to black, respawn at home (Escrow Palace), fade back in. Original design.
// v15: walkable map = streets/building fronts out to x=±24, z=-24..32 (street lights at [±24,-14]); +3 buffer before the warning.
export const ZONE = { x0: -32, x1: 36, z0: -36, z1: 44 }, LIMIT = 7; // preview: expanded with spaced lots
export const HOME = { x: 0, z: 26.2, yaw: 0 }; // just outside the ESCROW PALACE door (front wall z=28)
export function makeBoundary(onRespawn) {
  const el = document.getElementById('bound'), num = document.getElementById('boundn'), fade = document.getElementById('fade');
  let left = LIMIT, out = false, phase = 'ok', ft = 0;
  return (x, z, dt) => {
    const inside = x > ZONE.x0 && x < ZONE.x1 && z > ZONE.z0 && z < ZONE.z1;
    if (phase === 'fadeout' || phase === 'fadein') { ft += dt;
      if (phase === 'fadeout') { fade.style.opacity = Math.min(1, ft / 0.6); if (ft > 0.8) { onRespawn(HOME); phase = 'fadein'; ft = 0; } }
      else { fade.style.opacity = Math.max(0, 1 - ft / 0.7); if (ft > 0.7) { phase = 'ok'; fade.style.opacity = 0; } } return; }
    if (inside) { if (out) { out = false; left = LIMIT; el.classList.remove('on'); } return; } // full reset on return
    if (!out) { out = true; left = LIMIT; el.classList.add('on'); }
    left -= dt; num.textContent = Math.max(0, Math.ceil(left)); el.style.setProperty('--k', (1 - left / LIMIT).toFixed(2));
    if (left <= 0) { out = false; left = LIMIT; el.classList.remove('on'); phase = 'fadeout'; ft = 0; }
  };
}
