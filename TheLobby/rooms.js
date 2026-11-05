// (c) 2026 B34N5x. All rights reserved.
// Invite rooms client: position/skin/emotes only. No text chat, no voice, no free-typed names.
// Relay URL from <meta name="rooms-url">; hidden if unset. Room code/password live in the URL hash + memory only.
import { roomKey, proofFor, EMOTES } from './rooms_core.js?v=4';
import { emoteListeners, showBubble, EMOTE_LABEL } from './hudmenus.js?v=9';
const URLB = (document.querySelector('meta[name="rooms-url"]') || {}).content || '';
const $ = (t, p, a = {}) => { const e = document.createElement(t); Object.assign(e, a); (p || document.body).append(e); return e; };
let ws = null, me = 0; const peers = new Map();
const bar = $('div', null, { id: 'roombar' });
const inv = $('button', bar, { type: 'button', className: 'rbtn', textContent: 'Invite friend' });
const status = $('div', null, { id: 'roomstatus', hidden: true });
const line = (txt) => { status.hidden = false; status.textContent = txt; clearTimeout(line.t); line.t = setTimeout(() => { status.hidden = true; }, 4000); };
if (!URLB) bar.hidden = true;
function avatarFor(id, skin) { const L = window.__lobby; if (!L) return null; const { THREE, scene } = L; let p = peers.get(id);
  if (!p) { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.8, 4, 10), new THREE.MeshStandardMaterial({ color: 0x40e0d0, emissive: 0x0a4040 })); m.position.y = 0.75; g.add(m);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true })); sp.scale.set(1.9, 1.9, 1); sp.position.y = 1.05; sp.visible = false; g.add(sp); scene.add(g); p = { g, m, sp }; peers.set(id, p); }
  if (skin !== undefined) { if (skin && skin.img) new THREE.TextureLoader().load(skin.img, t => { t.colorSpace = THREE.SRGBColorSpace; p.sp.material.map = t; p.sp.material.needsUpdate = true; p.sp.visible = true; p.m.visible = false; }); else { p.sp.visible = false; p.m.visible = true; } }
  return p; }
function drop(id) { const p = peers.get(id); if (p) { p.g.parent && p.g.parent.remove(p.g); peers.delete(id); } }
function connect(path, pw, host) {
  ws = new WebSocket(URLB.replace(/\/$/, '') + '/room/' + path); let code = '';
  ws.onmessage = async e => { let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.t === 'hello') { code = m.code; const k = await roomKey(code, pw), skin = window.__lobbySkin || null;
      ws.send(JSON.stringify(host ? { t: 'create', k, skin } : { t: 'join', proof: await proofFor(k, m.nonce), skin }));
      if (host) { const link = location.origin + location.pathname + '#room=' + code + '&pw=' + encodeURIComponent(pw);
        try { await navigator.clipboard.writeText(link); } catch {} line('Room ' + code + ' ready. Invite link copied.'); } }
    else if (m.t === 'welcome') { me = m.id; inv.textContent = 'Leave room'; for (const q of m.peers) { const p = avatarFor(q.id, q.skin); if (q.st) place(p, q.st); } line('Joined. ' + m.peers.length + ' other(s) here. Emotes only — no chat.'); }
    else if (m.t === 'joined') { avatarFor(m.id, m.skin); line('Player ' + m.id + ' joined'); }
    else if (m.t === 'left') { drop(m.id); line('Player ' + m.id + ' left'); }
    else if (m.t === 'state') place(avatarFor(m.id), m);
    else if (m.t === 'skin') avatarFor(m.id, m.skin);
    else if (m.t === 'emote' && EMOTES.includes(m.e) && m.id !== me) showBubble(EMOTE_LABEL[m.e] || m.e);
    else if (m.t === 'denied' || m.t === 'full') line(m.t === 'full' ? 'Room is full' : 'Could not join (wrong link or expired)'); };
  ws.onclose = () => { for (const id of [...peers.keys()]) drop(id); ws = null; me = 0; inv.textContent = 'Invite friend'; line('Left room'); };
}
function place(p, s) { if (p && s) { p.g.position.set(s.x, s.y, s.z); p.g.rotation.y = s.ry; } }
const pwGen = () => [...crypto.getRandomValues(new Uint8Array(6))].map(b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
inv.onclick = () => { if (ws) return ws.close(); connect('new', pwGen(), true); };
emoteListeners.push(e => { if (!ws || ws.readyState !== 1 || !me || !EMOTES.includes(e)) return; try { ws.send(JSON.stringify({ t: 'emote', e })); } catch {} });
let last = 0; (function tick(t) { requestAnimationFrame(tick); const L = window.__lobby; if (!ws || ws.readyState !== 1 || !me || !L || t - last < 100) return; last = t;
  ws.send(JSON.stringify({ t: 'state', x: L.pos.x, y: L.pos.y, z: L.pos.z, ry: L.avatar.rotation.y })); })(0);
addEventListener('lobbyskin', () => { if (ws && me) ws.send(JSON.stringify({ t: 'skin', skin: window.__lobbySkin })); });
const h = new URLSearchParams(location.hash.slice(1)); if (URLB && /^[A-Z2-9]{6}$/.test(h.get('room') || '') && h.get('pw')) { const c = h.get('room'), p = h.get('pw'); history.replaceState(null, '', location.pathname + location.search); setTimeout(() => connect(c, p, false), 1500); }
