// Reusable character movement controller (wisp now, 3D trait characters later).
// Pure logic + tiny pooled FX; the avatar only reads ctl.state / ctl.blend / ctl.scale / ctl.facing.
import * as THREE from './lib/three.module.js';
const lerpK = (rate, dt) => 1 - Math.exp(-rate * dt);
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export const STATES = ['idle', 'walk', 'run', 'jump', 'fall', 'land', 'hurt'];

export class CharacterController {
  constructor(o = {}) {
    this.p = Object.assign({ walk: 3.2, run: 6, accel: 16, decel: 11, skidDecel: 24, turnDeg: 780, gravity: 22, jumpV: 7.2,
      coyote: 0.22, buffer: 0.28, fade: 0.16, snapDown: 0.4,
      hopMinSpeed: 4.2, hopLook: 1.3, hopMinH: 0.3, hopMaxH: 0.9, hopMaxDepth: 1.8, hopClear: 0.22 }, o);
    this.hopC = null; // collider being hopped (subtle auto-vault, step 9)
    this.vel = new THREE.Vector3(); this.vy = 0; this.grounded = true; this.facing = 0;
    this.coyoteT = 0; this.bufferT = 0; this.landT = 0; this.skidT = 0; this.lockT = 0; this.iT = 0; this.flashT = 0;
    this.state = 'idle'; this.blend = Object.fromEntries(STATES.map(s => [s, s === 'idle' ? 1 : 0]));
    this.scale = new THREE.Vector3(1, 1, 1); this.sq = new THREE.Vector3(1, 1, 1);
    this.events = []; this.dist = 0; this.hitStop = 0;
  }
  jump() {
    // Buffer always; if already grounded/coyote, apply this frame so hitchy devices don't eat the press
    this.bufferT = this.p.buffer;
    if ((this.grounded || this.coyoteT > 0) && this.lockT <= 0) {
      this.vy = this.p.jumpV; this.grounded = false; this.coyoteT = 0; this.bufferT = 0;
      this.sq.set(0.8, 1.2, 0.8); this.events.push({ type: 'jump' });
    }
  }
  // Hurt helper (dojo later): knockback impulse, flash, brief input lock, i-frames. Returns false while invulnerable.
  hurt(fromDir, { force = 7, up = 4, lock = 0.35, iframes = 1.0 } = {}) {
    if (this.iT > 0) return false;
    const d = fromDir.clone().setY(0).normalize(); this.vel.copy(d.multiplyScalar(force)); this.vy = up; this.grounded = false;
    this.lockT = lock; this.iT = iframes; this.flashT = 0.25; this.events.push({ type: 'hurt' }); return true;
  }
  get invulnerable() { return this.iT > 0; }
  get flash() { return this.flashT > 0 ? 1 : (this.iT > 0 ? (Math.sin(this.iT * 40) > 0 ? 0.4 : 0) : 0); }
  // input: wish = world-space XZ vector (length 0..1). pos mutated. collide(pos) and floorAt(x,z,y) supplied by the world.
  // probe(pos, dir, look) -> { c, h, depth } nearest hoppable obstacle ahead (optional; world supplies it).
  update(dt, pos, wish, collide, floorAt, probe) {
    const P = this.p; this.events.length = 0;
    this.lockT = Math.max(0, this.lockT - dt); this.iT = Math.max(0, this.iT - dt); this.flashT = Math.max(0, this.flashT - dt);
    this.bufferT = Math.max(0, this.bufferT - dt); this.landT = Math.max(0, this.landT - dt); this.skidT = Math.max(0, this.skidT - dt);
    const w = this.lockT > 0 ? new THREE.Vector3() : wish.clone().setY(0); if (w.length() > 1) w.normalize();
    const target = w.clone().multiplyScalar(P.run);
    const hs = Math.hypot(this.vel.x, this.vel.z);
    // skid: sharp reversal while moving fast
    if (this.grounded && hs > 3 && w.lengthSq() > 0.25 && (this.vel.x * w.x + this.vel.z * w.z) / hs < 0) {
      if (this.skidT <= 0) this.events.push({ type: 'skid' }); this.skidT = 0.18; }
    const rate = this.skidT > 0 ? P.skidDecel : (target.lengthSq() > this.vel.lengthSq() ? P.accel : P.decel);
    const k = lerpK(this.grounded ? rate : rate * 0.45, dt); // less air control
    if (this.lockT <= 0) { this.vel.x += (target.x - this.vel.x) * k; this.vel.z += (target.z - this.vel.z) * k; }
    else { this.vel.x *= 1 - lerpK(3, dt); this.vel.z *= 1 - lerpK(3, dt); }
    // subtle auto-hop: running straight at a low, thin obstacle -> small arc over it (no climbs; tall things never qualify)
    if (probe && this.grounded && !this.hopC && this.lockT <= 0 && hs > P.hopMinSpeed && w.lengthSq() > 0.5) {
      const dir = new THREE.Vector3(this.vel.x / hs, 0, this.vel.z / hs), wn = w.clone().normalize();
      if (dir.dot(wn) > 0.85) { const q = probe(pos, dir, P.hopLook);
        if (q && q.h >= P.hopMinH && q.h <= P.hopMaxH && q.depth <= P.hopMaxDepth) {
          const apex = q.h + P.hopClear; this.vy = Math.sqrt(2 * P.gravity * apex); this.grounded = false; this.coyoteT = 0;
          this.hopC = q.c; this.sq.set(1.12, 0.82, 1.12); this.events.push({ type: 'hop', h: q.h }); } } }
    if (this.hopC && !this.grounded && this.vy < this.p.jumpV * 0.2) this.sq.lerp(new THREE.Vector3(1.08, 0.9, 1.08), lerpK(12, dt)); // tuck near apex
    const ox = pos.x, oz = pos.z; pos.x += this.vel.x * dt; pos.z += this.vel.z * dt;
    collide(pos, this.hopC); // respect world collisions; bleed off velocity into walls
    if (dt > 0) { const ax = (pos.x - ox) / dt, az = (pos.z - oz) / dt; if (Math.abs(ax) < Math.abs(this.vel.x)) this.vel.x = ax; if (Math.abs(az) < Math.abs(this.vel.z)) this.vel.z = az; }
    this.dist += Math.hypot(pos.x - ox, pos.z - oz);
    // vertical: coyote + buffer
    this.coyoteT = this.grounded ? P.coyote : Math.max(0, this.coyoteT - dt);
    if (this.bufferT > 0 && this.coyoteT > 0 && this.lockT <= 0) { this.vy = P.jumpV; this.grounded = false; this.coyoteT = 0; this.bufferT = 0; this.sq.set(0.8, 1.2, 0.8); this.events.push({ type: 'jump' }); }
    const fy = floorAt(pos.x, pos.z, pos.y);
    if (this.grounded && this.vy <= 0 && pos.y - fy < P.snapDown && pos.y >= fy - 0.6) { pos.y = fy; this.vy = 0; } // stick to ramps going down
    else { this.vy -= P.gravity * dt; pos.y += this.vy * dt;
      if (pos.y <= fy) { const impact = -this.vy; pos.y = fy; this.vy = 0;
        if (!this.grounded) { this.landT = 0.15; this.hitStop = impact > 6 ? 0.045 : (impact > 3 ? 0.025 : 0); this.sq.set(1.2, 0.7, 1.2).lerp(new THREE.Vector3(1, 1, 1), 1 - Math.min(1, impact / 8)); this.events.push({ type: 'land', impact, hop: !!this.hopC }); }
        this.hopC = null;
        this.grounded = true; } else this.grounded = false; }
    // facing decoupled from movement (turnDeg per second)
    const nhs = Math.hypot(this.vel.x, this.vel.z);
    if (nhs > 0.3 && w.lengthSq() > 0.01) { const want = Math.atan2(-w.x, -w.z), d = angDiff(this.facing, want), mx = THREE.MathUtils.degToRad(P.turnDeg) * dt;
      this.turnRate = THREE.MathUtils.clamp(d, -mx, mx) / Math.max(dt, 1e-4); this.facing += THREE.MathUtils.clamp(d, -mx, mx); } else this.turnRate = 0;
    // squash/stretch ease back (spring-ish)
    this.sq.lerp(new THREE.Vector3(1, 1, 1), lerpK(10, dt)); this.scale.copy(this.sq);
    // state + crossfade weights
    const s = this.lockT > 0 ? 'hurt' : !this.grounded ? (this.vy > 0 ? 'jump' : 'fall') : this.landT > 0 ? 'land' : nhs > P.walk + 0.5 ? 'run' : nhs > 0.4 ? 'walk' : 'idle';
    this.state = s; this.hopping = !!this.hopC; const fk = Math.min(1, dt / P.fade);
    for (const n of STATES) this.blend[n] += ((n === s ? 1 : 0) - this.blend[n]) * fk;
    this.speed = nhs; return this;
  }
}

// Spring-follow camera with lag; heavily damped Y so stairs/steps never bounce.
export class FollowCam {
  constructor() { this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.y = null; this.dist = 4.5; this.init = false; }
  update(dt, camera, eye, desired, dist) {
    this.dist += (dist - this.dist) * lerpK(4, dt); // smooth indoor pull-in
    if (!this.init) { this.pos.copy(desired); this.y = eye.y; this.init = true; }
    const k = 36, c = 2 * Math.sqrt(k); // softer critically-damped spring (fluidity pass)
    const ax = (desired.x - this.pos.x) * k - this.vel.x * c, az = (desired.z - this.pos.z) * k - this.vel.z * c;
    this.vel.x += ax * dt; this.vel.z += az * dt; this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    this.pos.y += (desired.y - this.pos.y) * lerpK(3, dt);
    this.y += (eye.y - this.y) * lerpK(3.2, dt); // damped look-at height
    camera.position.copy(this.pos); camera.lookAt(eye.x, this.y, eye.z);
  }
}

// Cheap pooled dust/spark puffs: one Points object, ring buffer.
export class PuffPool {
  constructor(scene, { n = 96, color = 0x9ff6ff, size = 0.18 } = {}) {
    this.n = n; this.i = 0; this.pos = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.life = new Float32Array(n); this.col = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.base = new THREE.Color(color); this.pts = new THREE.Points(g, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.pts.frustumCulled = false; scene.add(this.pts); this.acc = 0;
  }
  emit(p, count = 1, spread = 1.2, up = 0.8) {
    for (let c = 0; c < count; c++) { const i = this.i = (this.i + 1) % this.n, a = Math.random() * 6.283, s = spread * (0.4 + Math.random() * 0.6);
      this.pos.set([p.x + Math.cos(a) * 0.15, p.y + 0.05, p.z + Math.sin(a) * 0.15], i * 3); this.v.set([Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s], i * 3); this.life[i] = 0.6 + Math.random() * 0.3; } }
  trail(p, distDelta, every = 0.7) { this.acc += distDelta; while (this.acc > every) { this.acc -= every; this.emit(p, 2, 0.5, 0.5); } }
  update(dt) {
    for (let i = 0; i < this.n; i++) { if (this.life[i] <= 0) { this.col.fill(0, i * 3, i * 3 + 3); continue; }
      this.life[i] -= dt; const j = i * 3; this.pos[j] += this.v[j] * dt; this.pos[j + 1] += this.v[j + 1] * dt; this.pos[j + 2] += this.v[j + 2] * dt;
      this.v[j] *= 0.92; this.v[j + 2] *= 0.92; this.v[j + 1] *= 0.95; const a = Math.max(0, this.life[i]) * 1.3;
      this.col[j] = this.base.r * a; this.col[j + 1] = this.base.g * a; this.col[j + 2] = this.base.b * a; }
    this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true;
  }
}
