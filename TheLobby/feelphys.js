// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// Lightweight procedural feel/physics for The Lobby (preview): spring-damper secondary motion,
// laser ground impacts (scorch + rock debris), flight banking helpers. Caps for phone / Lightweight.
// Original code — ideas only from open motion notes (no GPL/SA weights or Mixamo raw files).
import * as THREE from './lib/three.module.js';

const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const LW = () => !!(window.__perf && window.__perf.low);
export function physQuality() {
  if (RM()) return { debris: 0, scorch: 0, springs: 0.35, bank: 0.5, dust: 0 };
  if (LW()) return { debris: 4, scorch: 3, springs: 0.7, bank: 0.75, dust: 0.6 };
  return { debris: 10, scorch: 6, springs: 1, bank: 1, dust: 1 };
}

/** 1D spring-damper toward a target (critically-ish damped). */
export function spring1(state, target, dt, stiff = 18, damp = 8) {
  state.v += (target - state.x) * stiff * dt;
  state.v *= Math.exp(-damp * dt);
  state.x += state.v * dt;
  return state.x;
}

/** Create a pooled laser impact FX (scorch discs + rock chunks with gravity/bounce/friction). */
export function createImpactPool(scene, opts = {}) {
  const maxD = opts.maxDebris || 24, maxS = opts.maxScorch || 10;
  const debris = [], scorch = [];
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 0.92, metalness: 0.05 });
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x1a1210, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false });
  let di = 0, si = 0;
  for (let i = 0; i < maxD; i++) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06 + (i % 3) * 0.02, 0), rockMat.clone());
    m.visible = false; m.castShadow = false; scene.add(m);
    debris.push({ m, vx: 0, vy: 0, vz: 0, life: 0, bounce: 0 });
  }
  for (let i = 0; i < maxS; i++) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), darkMat.clone());
    m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m);
    scorch.push({ m, life: 0, max: 0 });
  }
  return {
    burst(pos, dir, strength = 1) {
      const Q = physQuality();
      if (Q.debris <= 0 && Q.scorch <= 0) return;
      const nD = Math.min(Q.debris, Math.max(3, Math.round(6 * strength)));
      const yaw = Math.atan2(dir.x || 0, dir.z || 1);
      for (let i = 0; i < nD; i++) {
        const d = debris[di++ % debris.length];
        const a = yaw + (Math.random() - 0.5) * 1.2, sp = 2.2 + Math.random() * 3.5 * strength;
        d.m.position.set(pos.x + Math.sin(a) * 0.1, pos.y + 0.08, pos.z + Math.cos(a) * 0.1);
        d.m.scale.setScalar(0.7 + Math.random() * 1.1); d.m.visible = true;
        d.vx = Math.sin(a) * sp; d.vy = 2.5 + Math.random() * 3.5 * strength; d.vz = Math.cos(a) * sp;
        d.life = 1.6 + Math.random() * 1.2; d.bounce = 0;
      }
      if (Q.scorch > 0) {
        const s = scorch[si++ % Math.min(scorch.length, Q.scorch)];
        s.m.position.set(pos.x, pos.y + 0.02, pos.z);
        s.m.scale.setScalar(0.55 + Math.random() * 0.55 * strength);
        s.m.material.opacity = 0.75; s.m.visible = true;
        s.life = s.max = 3.2 + Math.random() * 1.5;
      }
    },
    update(dt, floorAt) {
      const g = 18;
      for (const d of debris) {
        if (!d.m.visible) continue;
        d.life -= dt; d.vy -= g * dt;
        d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt;
        d.m.rotation.x += d.vx * dt * 2; d.m.rotation.z += d.vz * dt * 2;
        const fy = floorAt ? floorAt(d.m.position.x, d.m.position.z, d.m.position.y) : 0;
        if (d.m.position.y <= fy + 0.04) {
          d.m.position.y = fy + 0.04; d.vy = Math.abs(d.vy) * 0.35; d.vx *= 0.55; d.vz *= 0.55; d.bounce++;
          if (d.bounce > 3 || Math.hypot(d.vx, d.vz) < 0.15) { d.vx = d.vz = d.vy = 0; }
        }
        if (d.life <= 0) { d.m.visible = false; }
        else if (d.life < 0.45) d.m.scale.multiplyScalar(0.92);
      }
      for (const s of scorch) {
        if (!s.m.visible) continue;
        s.life -= dt;
        s.m.material.opacity = 0.75 * Math.max(0, s.life / s.max);
        if (s.life <= 0) s.m.visible = false;
      }
    }
  };
}

/** Flight banking helper: returns roll/pitch additives from turn rate + vertical speed. */
export function flightBank(ctl, dt, state) {
  const Q = physQuality();
  if (!state) state = { roll: 0, pitch: 0, rollV: 0, pitchV: 0 };
  const air = ctl && !ctl.grounded;
  const turn = (ctl && ctl.turnRate) || 0;
  const wantRoll = air ? THREE.MathUtils.clamp(-turn * 0.35, -0.55, 0.55) * Q.bank : 0;
  const wantPitch = air ? THREE.MathUtils.clamp(-(ctl.vy || 0) * 0.035, -0.35, 0.4) * Q.bank : 0;
  spring1(state._r || (state._r = { x: 0, v: 0 }), wantRoll, dt, 14, 7);
  spring1(state._p || (state._p = { x: 0, v: 0 }), wantPitch, dt, 12, 7);
  state.roll = state._r.x; state.pitch = state._p.x;
  return state;
}
