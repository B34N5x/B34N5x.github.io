// (c) 2026 B34N5x. All rights reserved.
// Invite rooms, chunk 1: transport-agnostic relay logic shared by the Durable Object (do.js) and the local Node prototype (local.js).
// Memory only: nothing is stored or logged. Password never reaches the server: host sends K = SHA-256("b34n5-room:" + code + ":" + password);
// joiners prove knowledge with HMAC-SHA256(K, nonce). Only position/rotation, an allow-listed emote and an opt-in public skin are relayed.
// Emotes-only: free-text chat and any non-allowlisted string payloads are rejected (not broadcast). No display names.
const te = new TextEncoder(), hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
export const EMOTES = ['wave', 'thumbs', 'gg', 'follow', 'nicenft', 'dance', 'cheer'];
export const LIMITS = { players: 8, lifeMs: 2 * 3600e3, msgPerSec: 20, maxBytes: 1024, badPw: 5, lockMs: 60e3, joinPerMin: 10, createPerMin: 5 };
const ADDR = /(^|[^0-9A-Za-z])r[0-9A-Za-z]{24,34}([^0-9A-Za-z]|$)/; // never relay anything that looks like an XRPL address
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newCode() { const b = crypto.getRandomValues(new Uint8Array(6)); return [...b].map(x => ALPHA[x % ALPHA.length]).join(''); }
const nonce = () => hex(crypto.getRandomValues(new Uint8Array(16)));
async function hmac(kHex, msg) { const k = await crypto.subtle.importKey('raw', unhex(kHex), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return hex(await crypto.subtle.sign('HMAC', k, te.encode(msg))); }
const same = (a, b) => { if (typeof a !== 'string' || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const num = (v, lim) => Number.isFinite(v) ? Math.max(-lim, Math.min(lim, Math.round(v * 100) / 100)) : 0;
export function cleanSkin(s) {
  if (!s || typeof s !== 'object') return null;
  const id = typeof s.id === 'string' && /^[\w.-]{1,64}$/.test(s.id) ? s.id : null;
  const img = typeof s.img === 'string' && s.img.length <= 300 && (/^https:\/\/[^\s"'<>]+$/.test(s.img) || /^assets\/mock\/[\w.-]+\.(png|jpe?g|webp)$/.test(s.img)) ? s.img : null;
  const tr = typeof s.tr === 'string' && /^[a-z,]{0,60}$/.test(s.tr) ? s.tr : '';
  if ((id && ADDR.test(id)) || (img && ADDR.test(img))) return null;
  return id || img ? { id, img, tr } : null;
}
// One Room per code. send(sock, obj) and close(sock) are supplied by the transport.
export class Room {
  constructor(code, io) { this.code = code; this.io = io; this.k = null; this.peers = new Map(); this.bad = 0; this.lockUntil = 0; this.born = Date.now(); this.seq = 0; }
  get empty() { return this.peers.size === 0; }
  expired(now = Date.now()) { return now - this.born > LIMITS.lifeMs; }
  open(sock) { const p = { id: null, n: nonce(), ok: false, win: 0, cnt: 0, st: null }; this.peers.set(sock, p);
    this.io.send(sock, { t: 'hello', code: this.code, nonce: p.n, host: !this.k }); }
  leave(sock) { const p = this.peers.get(sock); this.peers.delete(sock); if (p && p.ok) this.bcast({ t: 'left', id: p.id }, sock); }
  bcast(o, except) { for (const [s, p] of this.peers) if (p.ok && s !== except) this.io.send(s, o); }
  async msg(sock, raw) {
    const p = this.peers.get(sock); if (!p) return;
    if (typeof raw !== 'string' || raw.length > LIMITS.maxBytes) return this.io.close(sock, 1009);
    const now = Date.now(); if (now - p.win > 1000) { p.win = now; p.cnt = 0; } if (++p.cnt > LIMITS.msgPerSec) return; // drop floods quietly
    let m; try { m = JSON.parse(raw); } catch { return; } if (!m || typeof m !== 'object' || Array.isArray(m)) return;
    if (!p.ok) return this.auth(sock, p, m, now);
    if (m.t === 'state') { p.st = { x: num(m.x, 500), y: num(m.y, 100), z: num(m.z, 500), ry: num(m.ry, 7) }; this.bcast({ t: 'state', id: p.id, ...p.st }, sock); }
    else if (m.t === 'emote' && typeof m.e === 'string' && EMOTES.includes(m.e)) this.bcast({ t: 'emote', id: p.id, e: m.e }, sock);
    else if (m.t === 'skin') { p.skin = cleanSkin(m.skin); this.bcast({ t: 'skin', id: p.id, skin: p.skin }, sock); }
    // chat / voice / free-text / unknown types: rejected (not broadcast)
  }
  async auth(sock, p, m, now) {
    const deny = () => { this.io.send(sock, { t: 'denied' }); this.io.close(sock, 4003); };
    if (m.t === 'create' && !this.k && typeof m.k === 'string' && /^[0-9a-f]{64}$/.test(m.k)) this.k = m.k;
    else if (m.t === 'join' && this.k) {
      if (now < this.lockUntil) return deny();
      if (!same(m.proof, await hmac(this.k, p.n))) { if (++this.bad >= LIMITS.badPw) { this.lockUntil = now + LIMITS.lockMs; this.bad = 0; } return deny(); }
      this.bad = 0;
    } else return deny();
    if ([...this.peers.values()].filter(q => q.ok).length >= LIMITS.players) { this.io.send(sock, { t: 'full' }); return this.io.close(sock, 4008); }
    p.ok = true; p.id = ++this.seq; p.skin = cleanSkin(m.skin);
    const others = [...this.peers.values()].filter(q => q.ok && q !== p).map(q => ({ id: q.id, st: q.st, skin: q.skin }));
    this.io.send(sock, { t: 'welcome', id: p.id, peers: others });
    this.bcast({ t: 'joined', id: p.id, skin: p.skin }, sock);
  }
}
export async function roomKey(code, pw) { return hex(await crypto.subtle.digest('SHA-256', te.encode(`b34n5-room:${code}:${pw}`))); }
export const proofFor = hmac;
