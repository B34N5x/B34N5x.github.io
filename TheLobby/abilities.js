// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// Preview: trait -> ability runtime (laser, flight, charge, aura pulse, slash). Data from traits_map.json abilities.
// Cosmetic lobby FX only. Nothing stored. Works with keyboard + HUD/touch buttons.
// 2026-11-05: visible FX + trait-driven colours/shapes (traiteffects.js); charge direction fixed; pooled arcs/trails.
import * as THREE from './lib/three.module.js';
import { resolveAbilities } from './traits.js?v=34';
import { enrichAbilities } from './traiteffects.js?v=2';
import { createImpactPool, flightBank, physQuality } from './feelphys.js';

const busy = (el) => el && /INPUT|TEXTAREA|SELECT/.test(el.tagName);

function mkTrailPool(scene, n = 48) {
  const mats = {
    feathers: new THREE.MeshBasicMaterial({ color: 0xf4f4f8, transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false }),
    sparks: new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }),
    smoke: new THREE.MeshBasicMaterial({ color: 0x4a4058, transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false }),
    embers: new THREE.MeshBasicMaterial({ color: 0xff6a2a, transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }),
    frost: new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }),
    dust: new THREE.MeshBasicMaterial({ color: 0xc8a878, transparent: true, opacity: 0.7, toneMapped: false, depthWrite: false })
  };
  const pool = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mats.dust.clone());
    m.visible = false; scene.add(m);
    pool.push({ m, life: 0, vx: 0, vy: 0, vz: 0 });
  }
  let i = 0;
  return {
    emit(pos, kind, count, speed = 1.2) {
      const Q = physQuality();
      if (Q.dust <= 0) return;
      const nE = Math.min(count, Math.round(count * (Q.dust || 1)));
      const base = mats[kind] || mats.dust;
      for (let k = 0; k < nE; k++) {
        const p = pool[i++ % pool.length];
        p.m.material.color.copy(base.color); p.m.material.opacity = base.opacity;
        p.m.material.blending = base.blending || THREE.NormalBlending;
        p.m.position.set(pos.x + (Math.random() - 0.5) * 0.2, pos.y + Math.random() * 0.2, pos.z + (Math.random() - 0.5) * 0.2);
        p.m.scale.setScalar(0.6 + Math.random() * 1.1); p.m.visible = true;
        const a = Math.random() * Math.PI * 2;
        p.vx = Math.cos(a) * speed * (0.4 + Math.random()); p.vz = Math.sin(a) * speed * (0.4 + Math.random());
        p.vy = 0.6 + Math.random() * 1.8 * speed; p.life = 0.45 + Math.random() * 0.55;
      }
    },
    update(dt) {
      for (const p of pool) {
        if (!p.m.visible) continue;
        p.life -= dt; p.vy -= 4 * dt;
        p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
        p.m.material.opacity *= 0.96;
        if (p.life <= 0) p.m.visible = false;
        else if (p.life < 0.2) p.m.scale.multiplyScalar(0.9);
      }
    }
  };
}

export function setupAbilities(ctl, scene, getChar, getYaw, floorAt, puffs) {
  const bar = document.getElementById('abil') || (() => {
    const d = document.createElement('div'); d.id = 'abil'; document.body.append(d); return d;
  })();
  let list = [], cool = {}, active = null, beam = null, slashArc = null, auraMesh = null, wingFlap = 0, bank = null, wasAir = false, fxMap = {};
  const impacts = createImpactPool(scene);
  const trails = mkTrailPool(scene);
  const mkBeam = () => {
    if (beam) return beam;
    const g = new THREE.Group(); g.name = 'ability-laser-beam';
    // Opaque bright core (NormalBlending) so SwiftShader / phone always show a beam, not just additive glow
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 1, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff3a5a, transparent: true, opacity: 1, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
    core.rotation.x = Math.PI / 2; core.position.z = -0.5; core.name = 'laser-core'; g.add(core);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff88a0, transparent: true, opacity: 0.17, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.rotation.x = Math.PI / 2; glow.position.z = -0.5; glow.name = 'laser-glow'; g.add(glow);
    // Flat ribbon facing up — readable from behind/side when cylinder is thin on screen
    const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 1),
      new THREE.MeshBasicMaterial({ color: 0xff5577, transparent: true, opacity: 0.85, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
    ribbon.rotation.x = Math.PI / 2; ribbon.position.z = -0.5; ribbon.name = 'laser-ribbon'; g.add(ribbon);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, toneMapped: false, depthWrite: false }));
    muzzle.name = 'laser-muzzle'; g.add(muzzle);
    g.visible = false; g.frustumCulled = false; scene.add(g); beam = g; return g;
  };
  const mkSlash = () => {
    if (slashArc) return slashArc;
    const g = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.045, 8, 24, Math.PI * 1.1),
      new THREE.MeshBasicMaterial({ color: 0xffe8a0, transparent: true, opacity: 0.95, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    g.rotation.x = Math.PI * 0.15; g.visible = false; g.name = 'ability-slash-arc'; scene.add(g); slashArc = g; return g;
  };
  const mkAura = (color) => {
    if (auraMesh) { auraMesh.material.color.set(color); return auraMesh; }
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.04, 10, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    m.rotation.x = Math.PI / 2; m.visible = false; m.name = 'ability-aura-fx'; scene.add(m); auraMesh = m; return m;
  };
  const paint = () => {
    const keepView = [...bar.querySelectorAll('#viewbtn, .viewbtn')];
    bar.replaceChildren();
    for (const a of list) {
      if (!a.ability) continue;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'hudtog abilbtn'; b.dataset.id = a.id;
      const left = Math.max(0, (cool[a.id] || 0));
      const al = document.createElement('span'), ak = document.createElement('span'); al.className = 'al'; ak.className = 'ak';
      al.textContent = a.label; ak.textContent = left > 0.05 ? `${left.toFixed(1)}s` : `${(a.key || '').replace(/^(Key|Digit)/, '')}`; b.append(al, ak); b.title = `${a.label} (key ${ak.textContent})`;
      b.disabled = left > 0.05 || !!(active && active.id !== a.id);
      b.addEventListener('click', () => fire(a));
      bar.append(b);
    }
    for (const v of keepView) bar.append(v); // View sits after special-move(s)
    bar.hidden = !list.some(a => a.ability) && !bar.querySelector('#viewbtn');
  };
  const lookDir = (yaw) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });
  const fire = (a) => {
    if (!a || !a.ability) return;
    if ((cool[a.id] || 0) > 0) return;
    if (active) return;
    cool[a.id] = a.cooldown || 1;
    if (ctl && ctl.sq) ctl.sq.set(0.92, 1.08, 0.92); // anticipation squash
    const fx = a.fx || fxMap[a.ability] || {};
    if (a.ability === 'laser') {
      const g = mkBeam(), c = getChar(), yaw = getYaw ? getYaw() : 0;
      const col = new THREE.Color(fx.color || a.color || '#ff3a5a');
      const w = Math.max(1.6, fx.width || 1.8);
      g.children.forEach((m) => {
        if (m.name === 'laser-muzzle') m.material.color.set('#ffffff');
        else if (m.name === 'laser-glow') m.material.color.copy(col.clone().lerp(new THREE.Color('#ffffff'), 0.4));
        else m.material.color.copy(col);
      });
      const len = Math.max(8, fx.length || 10);
      g.scale.set(w, w, len); g.visible = true;
      const origin = new THREE.Vector3(0, 1.35, 0);
      if (c) {
        c.updateMatrixWorld(true);
        const eyes = c.userData && c.userData.eyes;
        if (eyes && eyes[0]) { const ww = new THREE.Vector3(); eyes[0].getWorldPosition(ww); origin.copy(ww); }
        else { const box = new THREE.Box3().setFromObject(c); origin.set((box.min.x + box.max.x) / 2, box.min.y + (box.max.y - box.min.y) * 0.78, (box.min.z + box.max.z) / 2); }
      } else if (ctl && ctl._pos) origin.set(ctl._pos.x, ctl._pos.y + 1.35, ctl._pos.z);
      g.position.copy(origin);
      g.rotation.set(0, yaw, 0);
      active = { id: a.id, kind: 'laser', t: 0, dur: Math.max(0.85, fx.dur || 0.9), g, len, yaw, origin: origin.clone(), fx };
      if (floorAt) {
        const d = lookDir(yaw), hit = origin.clone();
        hit.x += d.x * Math.min(len, 6); hit.z += d.z * Math.min(len, 6);
        hit.y = floorAt(hit.x, hit.z, hit.y) + 0.02;
        impacts.burst(hit, d, Math.max(1.4, fx.debris || 1.4));
        if (window.__envFeel) { window.__envFeel.shake(0.1, 0.2); window.__envFeel.burst(hit, 10, 2.6); }
        if (puffs) puffs.emit(hit, 14, 2.2, 0.7);
      }
    } else if (a.ability === 'flight') {
      ctl.vy = Math.max(ctl.vy, fx.boostY || a.boostY || 6.5);
      ctl.grounded = false;
      const sp = Math.hypot(ctl.vel.x, ctl.vel.z) || 0;
      if (sp > 0.2 && getYaw) { const yaw = getYaw(), boost = Math.min(2.2, sp * 0.35); const d = lookDir(yaw); ctl.vel.x += d.x * boost; ctl.vel.z += d.z * boost; }
      active = { id: a.id, kind: 'flight', t: 0, dur: fx.dur || a.duration || 1.45, g0: ctl.p.gravity, fx };
      ctl.p.gravity = (active.g0 || 22) * 0.32;
      wingFlap = 1; wasAir = true;
      if (puffs) { const c = getChar(); const p = c ? new THREE.Vector3().setFromMatrixPosition(c.matrixWorld) : (ctl._pos || new THREE.Vector3()); p.y += 0.4; trails.emit(p, fx.trail || 'feathers', 10, 1.4); }
    } else if (a.ability === 'charge') {
      const yaw = getYaw ? getYaw() : 0;
      active = { id: a.id, kind: 'charge', t: 0, dur: fx.dur || a.duration || 0.55, speed: fx.speed || a.speed || 2.4, yaw, fx };
      const c = getChar(); const p = c ? new THREE.Vector3().setFromMatrixPosition(c.matrixWorld) : new THREE.Vector3();
      trails.emit(p, fx.dust || 'dust', 14, 1.8);
      if (puffs) puffs.emit(p, 10, 2.2, 0.6);
    } else if (a.ability === 'aura') {
      ctl.p.run = (ctl.p.run || 6) * (fx.speed || a.speed || 1.55);
      active = { id: a.id, kind: 'aura', t: 0, dur: fx.dur || a.duration || 1.4, run0: (ctl.p.run || 6) / (fx.speed || a.speed || 1.55), fx };
      const ring = mkAura(fx.color || a.color || '#7dffd8');
      ring.visible = true; ring.scale.setScalar(1);
      const c = getChar();
      if (c) c.traverse(o => { if (o.name === 'ability-aura' || (o.userData && o.userData.abilityPart === 'aura_ring')) { o.visible = true; o.userData._auraPulse = 1; } });
    } else if (a.ability === 'slash') {
      const yaw = getYaw ? getYaw() : 0;
      active = { id: a.id, kind: 'slash', t: 0, dur: fx.dur || a.duration || 0.45, speed: fx.speed || a.speed || 2.0, yaw, fx };
      const arc = mkSlash();
      const col = new THREE.Color(fx.color || '#ffe8a0');
      arc.material.color.copy(col);
      const span = fx.arc || 1;
      arc.scale.set(span, 1, span); arc.visible = true;
      const c = getChar();
      if (c) { c.updateMatrixWorld(true); const p = new THREE.Vector3().setFromMatrixPosition(c.matrixWorld); arc.position.set(p.x, p.y + 1.0, p.z); }
      arc.rotation.y = yaw;
    }
    paint();
  };
  addEventListener('keydown', e => {
    if (e.repeat || busy(document.activeElement)) return;
    const a = list.find(x => x.ability && x.key === e.code);
    if (a) { e.preventDefault(); fire(a); }
  });
  return {
    set(spec, map) {
      const raw = spec ? resolveAbilities(spec, map) : [];
      list = spec ? enrichAbilities(raw, spec, map) : [];
      fxMap = {};
      for (const a of list) if (a.ability && a.fx) fxMap[a.ability] = a.fx;
      cool = {}; active = null;
      if (beam) beam.visible = false;
      if (slashArc) slashArc.visible = false;
      if (auraMesh) auraMesh.visible = false;
      paint();
      return list;
    },
    list: () => list.slice(),
    fx: () => {
      const o = Object.assign({}, fxMap);
      for (const a of list) if (a.ability && a.fx) o[a.ability] = a.fx;
      return o;
    },
    fireById(id) { const a = list.find(x => x.id === id || x.ability === id); if (a) fire(a); },
    cancel() {
      if (active) {
        if (active.kind === 'flight' && active.g0 != null) ctl.p.gravity = active.g0;
        if (active.kind === 'aura' && active.run0 != null) ctl.p.run = active.run0;
        if (active.g) active.g.visible = false;
      }
      active = null; wingFlap = 0; bank = null; wasAir = false;
      if (beam) beam.visible = false;
      if (slashArc) slashArc.visible = false;
      if (auraMesh) auraMesh.visible = false;
      const c = getChar();
      if (c) { c.rotation.x = 0; c.rotation.z = 0; }
    },
    update(dt, pos) {
      for (const k of Object.keys(cool)) { cool[k] = Math.max(0, cool[k] - dt); }
      impacts.update(dt, floorAt);
      trails.update(dt);
      if (wasAir && ctl.grounded) {
        wasAir = false;
        if (puffs && physQuality().dust > 0) puffs.emit(pos, Math.round(10 * physQuality().dust), 2.4, 0.75);
        if (window.__envFeel) { window.__envFeel.shake(0.12, 0.25); window.__envFeel.burst(pos, 12, 3); }
        ctl.sq.set(1.22, 0.72, 1.22);
      }
      if (!ctl.grounded) wasAir = true;
      bank = flightBank(ctl, dt, bank);
      const cBank = getChar();
      if (cBank && !ctl.grounded) {
        cBank.rotation.z = bank.roll;
        cBank.rotation.x = bank.pitch;
        cBank.userData._flightPitch = bank.pitch;
      } else if (cBank && ctl.grounded) {
        // upright on ground — do not leave flight lean stuck
        if (Math.abs(cBank.rotation.z) < 0.6) cBank.rotation.z *= 0.85;
        if (Math.abs(cBank.rotation.x) < 0.6) cBank.rotation.x *= 0.85;
      }
      if (active) {
        active.t += dt;
        if (active.kind === 'laser' && active.g) {
          const k = Math.min(1, active.t / active.dur);
          // Stay bright for most of the shot; fade only in the last third
          const fade = k < 0.65 ? 1 : 1 - ((k - 0.65) / 0.35);
          active.g.children.forEach((m) => {
            const base = m.name === 'laser-glow' ? 0.17 : m.name === 'laser-ribbon' ? 0.7 : 1;
            m.material.opacity = base * fade;
          });
          const c = getChar();
          if (c) {
            c.updateMatrixWorld(true);
            const eyes = c.userData && c.userData.eyes;
            if (eyes && eyes[0]) eyes[0].getWorldPosition(active.g.position);
            else {
              const box = new THREE.Box3().setFromObject(c);
              active.g.position.set((box.min.x + box.max.x) / 2, box.min.y + (box.max.y - box.min.y) * 0.78, (box.min.z + box.max.z) / 2);
            }
          } else if (pos) active.g.position.set(pos.x, pos.y + 1.35, pos.z);
          if (getYaw) active.g.rotation.y = getYaw();
          if (active.t >= active.dur) { active.g.visible = false; active = null; }
        } else if (active.kind === 'flight') {
          if (!ctl.grounded && ctl.vy < 0) ctl.vy += ctl.p.gravity * 0.95 * dt;
          if (!ctl.grounded && getYaw) {
            const yaw = getYaw(), glide = 1.6 * (1 - Math.min(1, active.t / active.dur));
            const d = lookDir(yaw);
            ctl.vel.x += (d.x * glide - ctl.vel.x) * Math.min(1, dt * 2.5);
            ctl.vel.z += (d.z * glide - ctl.vel.z) * Math.min(1, dt * 2.5);
          }
          wingFlap = Math.max(0, wingFlap - dt);
          const c = getChar();
          if (c) {
            const flap = Math.sin(active.t * 16) * 0.45;
            c.traverse(o => { if (o.name === 'ability-wings' || (o.userData && o.userData.abilityPart === 'wings')) { o.rotation.z = flap; o.rotation.y = Math.sin(active.t * 12) * 0.2; } });
            if (active.t % 0.12 < dt) {
              const p = new THREE.Vector3().setFromMatrixPosition(c.matrixWorld); p.y += 0.5;
              trails.emit(p, (active.fx && active.fx.trail) || 'feathers', 3, 0.9);
            }
          }
          if (active.t >= active.dur) { ctl.p.gravity = active.g0; active = null; }
        } else if (active.kind === 'charge') {
          const sp = (ctl.p.run || 6) * active.speed;
          const d = lookDir(active.yaw);
          pos.x += d.x * sp * dt;
          pos.z += d.z * sp * dt;
          if (active.t % 0.08 < dt) trails.emit(pos, (active.fx && active.fx.dust) || 'dust', 4, 1.2);
          if (active.t >= active.dur) active = null;
        } else if (active.kind === 'aura') {
          const c = getChar();
          if (auraMesh) {
            if (pos) auraMesh.position.set(pos.x, pos.y + 0.15, pos.z);
            auraMesh.rotation.z += dt * 3;
            const pulse = 1 + 0.18 * Math.sin(active.t * 10);
            auraMesh.scale.setScalar(pulse);
            auraMesh.material.opacity = 0.55 + 0.25 * Math.sin(active.t * 8);
          }
          if (c) c.traverse(o => { if (o.name === 'ability-aura' || (o.userData && o.userData.abilityPart === 'aura_ring')) { o.rotation.y += dt * 3; o.scale.setScalar(1 + 0.12 * Math.sin(active.t * 10)); } });
          if (active.t >= active.dur) {
            ctl.p.run = active.run0;
            if (auraMesh) auraMesh.visible = false;
            if (c) c.traverse(o => { if (o.userData && o.userData.abilityPart === 'aura_ring') o.scale.setScalar(1); });
            active = null;
          }
        } else if (active.kind === 'slash') {
          const sp = (ctl.p.run || 6) * active.speed;
          const d = lookDir(active.yaw);
          pos.x += d.x * sp * dt;
          pos.z += d.z * sp * dt;
          if (slashArc) {
            const k = active.t / active.dur;
            slashArc.rotation.y = active.yaw + k * Math.PI * 1.2;
            slashArc.material.opacity = 0.95 * (1 - k);
            if (pos) slashArc.position.set(pos.x, pos.y + 1.0, pos.z);
          }
          const c = getChar();
          if (c) c.traverse(o => { if (o.userData && o.userData.abilityPart === 'held') o.rotation.z = Math.sin(active.t * 20) * 0.9; });
          if (active.t >= active.dur) { if (slashArc) slashArc.visible = false; active = null; }
        }
      }
      paint();
    }
  };
}
