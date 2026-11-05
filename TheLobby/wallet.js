// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// Step 14: read-only "Sign in with Xaman" (Testnet). Address lives in a JS variable ONLY (no localStorage/sessionStorage/IndexedDB/cookies).
// Address lookup: read-only account_nfts on Testnet + Mainnet (xrplcluster, fallback s1.ripple) in parallel; memory only, no signing, no tx.
// Never signs anything except the server-created SignIn payload. No seeds, no keys, no funds.
import { applyCollectionAvatar } from './main.js?v=104'; // same URL as index.html so it's one module instance
const WS = 'wss://s.altnet.rippletest.net:51233', MAINNET = ['wss://xrplcluster.com', 'wss://s1.ripple.com'];
const DEMO_ADDR = 'rDEMOxTestnetB34N5notReal000000'; // fake, display only
let address = null; // memory only; gone on reload
const $ = id => document.getElementById(id);
async function nfts(addr, url = WS) {
  // Follow account_nfts marker until exhausted (pages of ≤400). Soft per-page timeout so large wallets finish.
  return new Promise((ok, bad) => {
    const ws = new WebSocket(url); const out = [];
    let timer = null;
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => { try { ws.close(); } catch {} bad(new Error('timeout')); }, 12000); };
    const ask = marker => {
      arm();
      const body = { command: 'account_nfts', account: addr, ledger_index: 'validated', limit: 400 };
      if (marker != null) body.marker = marker;
      ws.send(JSON.stringify(body));
    };
    ws.onopen = () => ask();
    ws.onerror = () => { clearTimeout(timer); bad(new Error('ws error')); };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.status !== 'success') {
        clearTimeout(timer); ws.close();
        return (url === WS || m.error === 'actNotFound') ? ok(out) : bad(m);
      }
      const page = m.result?.account_nfts || [];
      out.push(...page);
      if (m.result?.marker) ask(m.result.marker);
      else { clearTimeout(timer); ws.close(); ok(out); }
    };
  });
}
// v26: turn any looked-up NFT into a pickable skin: hex URI -> metadata JSON (https/ipfs) -> image. Read-only, memory only, full collection (placeholders OK).
// IPFS via public CORS gateways with fallback (ipfs.io/dweb.link return 429 without CORS under load); 4 at a time.
const IPFS = ['https://ipfs.xrp.cafe/ipfs/', 'https://gateway.pinata.cloud/ipfs/', 'https://ipfs.io/ipfs/', 'https://dweb.link/ipfs/', 'https://nftstorage.link/ipfs/', 'https://w3s.link/ipfs/'];
const cidOf = u => (u.match(/^ipfs:\/\/(?:ipfs\/)?(.+)$/) || u.match(/^((?:Qm[1-9A-Za-z]{44}|baf[a-z2-7]{50,}).*)$/) || u.match(/^https:\/\/[^/]+\/ipfs\/(.+)$/) || [])[1];
const GW = (u, k = 0) => { const c = cidOf(u); return c ? IPFS[k] + c : u; };
const hex = h => { try { return decodeURIComponent(h.replace(/../g, '%$&')); } catch { return ''; } };
async function getJson(u) { const tries = cidOf(u) ? IPFS.map((_, k) => GW(u, k)) : [u];
  for (const t of tries) { try { const r = await cap((async () => { const x = await fetch(t); if (!x.ok) throw 0; return x.json(); })(), 2500); if (r && typeof r === 'object' && !Array.isArray(r)) return r; } catch { /* next gateway */ } } return null; }
// Placeholder thumb for NFTs with no image / no URI — still pickable (traits optional).
const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#1a1430"/><text x="64" y="70" text-anchor="middle" fill="#9ad" font-size="14" font-family="system-ui">NFT</text></svg>');
// xrp.cafe NFT API: CORS *, CDN thumbs when public IPFS gateways time out / 403 (Power Zerps etc).
async function cafeNft(id) {
  if (!id) return null;
  try {
    const r = await Promise.race([
      fetch(`https://api.xrp.cafe/api/nft/${encodeURIComponent(id)}`).then(x => { if (!x.ok) throw 0; return x.json(); }),
      new Promise((_, rej) => setTimeout(() => rej(0), 4500))
    ]);
    const n = r && r.nft; if (!n) return null;
    // Prefer original_media_url (usually ipfs.xrp.cafe — embeddable). CDN media_url* often CF/CORP-blocked off-site.
    const orig = typeof n.original_media_url === 'string' && /^https:\/\//.test(n.original_media_url) ? n.original_media_url : null;
    const cdn = [n.media_url_sm, n.media_url].find(s => typeof s === 'string' && /^https:\/\//.test(s)) || null;
    return { name: n.item_name ? String(n.item_name).slice(0, 40) : null, orig, cdn, src: orig || cdn || null };
  } catch { return null; }
}
async function resolveHeld(held) {
  // Full collection — do NOT slice, do NOT drop missing URI/image. Parallel resolve in batches of 4.
  // Prefer xrp.cafe CDN thumbs when IPFS meta/image fails (pinata timeout; ipfs.io 403).
  const list = Array.isArray(held) ? held.slice() : [], out = [];
  const one = async n => {
    const serial = n.nft_serial != null ? n.nft_serial : '?';
    const iss = (n.Issuer || '').slice(0, 5);
    const base = { name: `#${serial} ${iss}…`, nft: n.NFTokenID, issuer: n.Issuer, taxon: n.NFTokenTaxon, net: n.net };
    let nm = base.name, src = PLACEHOLDER, meta, fromCafe = false;
    const c = await cafeNft(n.NFTokenID);
    if (c?.name) { nm = c.name; fromCafe = true; }
    // 1) cafe original_media_url (ipfs.xrp.cafe) — embeddable off-site
    if (c?.orig) { src = c.orig; fromCafe = true; }
    if (!n.URI) {
      if (src === PLACEHOLDER && c?.cdn) { src = c.cdn; fromCafe = true; }
      return { ...base, name: nm, src, placeholder: src === PLACEHOLDER, cafe: fromCafe || undefined };
    }
    const raw = hex(n.URI).trim(), u = GW(raw);
    if (!/^https:\/\//.test(u) && !cidOf(raw)) {
      if (src === PLACEHOLDER && c?.cdn) { src = c.cdn; fromCafe = true; }
      return { ...base, name: nm, src, placeholder: src === PLACEHOLDER, cafe: fromCafe || undefined };
    }
    if (src === PLACEHOLDER && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(u)) {
      src = /^https:\/\//.test(u) ? u : GW(raw);
    }
    if (src === PLACEHOLDER) {
      // 2) IPFS/https meta → image via GW (ipfs.xrp.cafe first — Power Zerp PNGs live here)
      const m = await getJson(raw);
      if (m && m.name && nm === base.name) nm = String(m.name).slice(0, 40);
      const img = m && (m.image || m.image_url || m.animation_url);
      if (img && typeof img === 'string') {
        const g = GW(img.trim());
        if (/^https:\/\//.test(g)) src = g;
        else if (cidOf(img.trim())) src = GW(img.trim());
      }
    }
    // 3) last resort: cafe CDN (may CF-challenge some networks; onerror → PLACEHOLDER)
    if (src === PLACEHOLDER && c?.cdn) { src = c.cdn; fromCafe = true; }
    meta = /^https:\/\//.test(u) ? u : undefined;
    return { ...base, name: nm, src, placeholder: src === PLACEHOLDER, cafe: fromCafe || undefined, meta };
  };
  for (let i = 0; i < list.length; i += 4) {
    const batch = await Promise.all(list.slice(i, i + 4).map(n => one(n).catch(() => ({
      name: `#${n.nft_serial ?? '?'}`, src: PLACEHOLDER, placeholder: true, nft: n.NFTokenID, issuer: n.Issuer, taxon: n.NFTokenTaxon
    }))));
    out.push(...batch);
  }
  return out;
}
async function matches(held, demo) {
  // Demo only: lobby sample mock-ups (never real B34N5 NFTs / address).
  const reg = (await (await fetch('collections.json')).json()).collections.filter(c => c.optIn);
  if (demo) return reg.filter(c => c.network === 'testnet-demo').flatMap(c => c.items);
  // Real wallets: opt-in collection catalog items are optional enrichment only.
  // The picker is filled from resolveHeld(full account_nfts) — not capped by collections.json item count.
  return reg.filter(c => c.issuer).flatMap(c => {
    const mine = held.filter(n => n.Issuer === c.issuer && (c.taxon == null || n.NFTokenTaxon === c.taxon));
    if (!mine.length || !(c.items || []).length) return [];
    return c.items.slice(0, mine.length);
  });
}
// v17: after sign-in/lookup, pulse the skin picker tab ~3x over 3 s; stops on open; reduced-motion = static highlight.
function flashSkin() { const t = $('skintag'); if (!t) return; t.classList.remove('sk-flash', 'sk-still'); void t.offsetWidth;
  const rm = matchMedia('(prefers-reduced-motion: reduce)').matches; t.classList.add(rm ? 'sk-still' : 'sk-flash');
  const stop = () => { t.classList.remove('sk-flash', 'sk-still'); clearTimeout(flashSkin.t); };
  t.addEventListener('click', stop, { once: true }); clearTimeout(flashSkin.t); flashSkin.t = setTimeout(stop, 3000); }
async function fetchAllNfts(addr) {
  // Testnet + Mainnet in parallel; follow markers on each. Memory only.
  const [t, m] = await Promise.all([nfts(addr).catch(() => []), mainnet(addr).catch(() => [])]);
  const seen = new Set();
  const all = [];
  for (const n of [...m.map(x => ({ ...x, net: 'Mainnet' })), ...t.map(x => ({ ...x, net: 'Testnet' }))]) {
    const id = n.NFTokenID || `${n.Issuer}:${n.nft_serial}`;
    if (seen.has(id)) continue; seen.add(id); all.push(n);
  }
  return all;
}
async function done(addr, demo, held) { flashSkin();
  $('walletInfo').textContent = ''; address = addr; $('walletBtn').textContent = `${demo ? 'DEMO ' : ''}${addr.slice(0, 6)}…${addr.slice(-4)} (sign out)`;
  if (demo) {
    const items = await matches([], true);
    status(`${items.length} demo skin${items.length === 1 ? '' : 's'} ready`);
    window.__walletItems = items; window.dispatchEvent(new Event('walletitems')); if (items[0]) await applyCollectionAvatar(items[0]);
    return;
  }
  // Always load FULL account_nfts (paginate markers). Xaman path used to skip resolveHeld when held was omitted.
  const all = (held && held.length) ? held : await fetchAllNfts(addr).catch(() => []);
  const own = await resolveHeld(all).catch(() => []);
  const enriched = await matches(all, false).catch(() => []);
  // Prefer enriched catalog skins when src overlaps; keep every owned NFT (placeholders OK).
  const items = [];
  const seenSrc = new Set();
  for (const o of [...enriched, ...own]) {
    const key = o.nft || o.src || o.name;
    if (seenSrc.has(key)) continue; seenSrc.add(key); items.push(o);
  }
  status(items.length ? `${items.length} NFT${items.length === 1 ? '' : 's'} in your wallet` : 'No NFTs on this account');
  window.__walletItems = items; window.dispatchEvent(new Event('walletitems')); if (items[0]) await applyCollectionAvatar(items[0]);
}
// Test hook: inject a large held list (no network) to prove picker lists all + select beyond 2nd.
window.__injectHeldNfts = async (held) => {
  const own = await resolveHeld(held);
  window.__walletItems = own;
  window.dispatchEvent(new Event('walletitems'));
  return own.length;
};
window.__resolveHeld = resolveHeld;
window.__cafeNft = cafeNft;
window.__IPFS_GWS = IPFS;
window.__PLACEHOLDER = PLACEHOLDER;
window.__nftsPageFollow = nfts; // exported for pagination unit tests via mock
const safeUrl = u => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };
const B58 = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
async function validAddr(a) { // XRPL classic address: ripple base58 + version byte 0 + 4-byte double-SHA256 checksum
  if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a)) return false;
  let n = 0n; for (const c of a) { const i = B58.indexOf(c); if (i < 0) return false; n = n * 58n + BigInt(i); }
  const b = []; while (n > 0n) { b.unshift(Number(n & 255n)); n >>= 8n; } for (const c of a) { if (c !== 'r') break; b.unshift(0); }
  if (b.length !== 25 || b[0] !== 0) return false;
  const h = async x => new Uint8Array(await crypto.subtle.digest('SHA-256', x));
  const c = await h(await h(new Uint8Array(b.slice(0, 21)))); return c.slice(0, 4).every((x, i) => x === b[21 + i]);
}
async function signIn() {
  if (!address && $('walletInfo').innerHTML) { $('walletInfo').innerHTML = ''; return; } // second tap closes the card
  clearTimeout(fadeInfo.t); $('walletInfo').style.opacity = 1;
  if (address) { address = null; window.__walletItems = []; window.dispatchEvent(new Event('walletitems')); $('walletBtn').textContent = 'Sign in with Xaman'; $('walletInfo').textContent = ''; return; }
  let r = null; try { r = await (await fetch('api/signin', { method: 'POST' })).json(); } catch { /* static hosting: no server */ }
  if (!r || r.demo || !r.uuid) return demoChoice();
  if (!safeUrl(r.link)) return demoChoice();
  const w = window.open(r.link, '_blank', 'noopener');
  const wi = $('walletInfo'); wi.textContent = w ? '' : 'Pop-up blocked, no problem: '; // built with DOM nodes, only https Xaman links/QR
  const a = document.createElement('a'); a.textContent = 'Open Xaman'; if (safeUrl(r.link)) a.href = r.link; if (!/Mobi/i.test(navigator.userAgent)) { a.target = '_blank'; a.rel = 'noopener'; }
  wi.append(a, ' or scan:', document.createElement('br'));
  if (safeUrl(r.qr)) wi.append(Object.assign(document.createElement('img'), { src: r.qr, width: 140, alt: 'Xaman QR' }));
  for (let i = 0; i < 100; i++) { await new Promise(t => setTimeout(t, 3000));
    let s = {}; try { s = await (await fetch(`api/status/${r.uuid}`)).json(); } catch { s = { error: 1 }; }
    if (s.signed && s.account) return done(s.account, false);
    if (s.resolved || s.expired || s.error) { status('Sign-in cancelled or expired.'); return; } }
  status('Sign-in timed out.');
}
// v16: every status line fades out 1 s after it appears (success, 0 NFTs, error, timeout) and is then removed.
function status(txt, keep) { const wi = $('walletInfo'); wi.textContent = ''; const sp = document.createElement('span'); sp.className = 'wstat'; sp.textContent = txt; wi.append(sp); if (keep) wi.append(keep);
  fadeInfo(wi); }
// v16b: the whole info area under the sign-in button (status, NFT list, QR caption) is transient: fade 1 s after a result, then empty it.
function fadeInfo(wi = $('walletInfo')) { clearTimeout(fadeInfo.t); wi.style.transition = ''; wi.style.opacity = 1;
  fadeInfo.t = setTimeout(() => { wi.style.transition = 'opacity .4s'; wi.style.opacity = 0; fadeInfo.t = setTimeout(() => { wi.textContent = ''; wi.style.opacity = 1; wi.style.transition = ''; }, 450); }, 1000); }
const cap = (p, ms) => Promise.race([p, new Promise(ok => setTimeout(() => ok([]), ms))]); // never hang: empty after ms
async function mainnet(a) { for (const u of MAINNET) { try { return await nfts(a, u); } catch { /* fallback */ } } return []; }
async function lookup(a) { // read-only public search on both networks in parallel; memory only
  const wi = $('walletInfo'); wi.textContent = ''; const sp = Object.assign(document.createElement('span'), { className: 'wspin', title: 'Searching' }); wi.append(sp); setTimeout(() => sp.remove(), 1500); // brief spinner only, no network/status text
  // Full marker pagination — do not race a short cap that returns [] mid-page.
  const all = await fetchAllNfts(a).catch(() => []);
  const m = all.filter(n => n.net === 'Mainnet'), tnet = all.filter(n => n.net === 'Testnet');
  await done(a, false, all);
  const ul = document.createElement('ul'); ul.className = 'wmn';
  all.slice(0, 40).forEach(n => { const li = document.createElement('li'); li.textContent = `[${n.net}] ${n.Issuer.slice(0, 6)}…${n.Issuer.slice(-4)} · taxon ${n.NFTokenTaxon} · #${n.nft_serial}`; li.title = n.NFTokenID; ul.append(li); });
  if (all.length > 40) ul.append(Object.assign(document.createElement('li'), { textContent: `+${all.length - 40} more` }));
  sp.remove(); status(`Mainnet: ${m.length} · Testnet: ${tnet.length} NFT${all.length === 1 ? '' : 's'} found`, all.length ? ul : null);
}
function demoChoice() { // no LOBBY_XAMAN keys: demo or a pasted Testnet address (read-only, memory only)
  $('walletInfo').innerHTML = '<div class="gcard wpick">Xaman sign-in is not set up yet.<br><input id="waddr" placeholder="Enter address" aria-label="Enter address"><button id="wgo" type="button">Look up</button><button id="wdemo" type="button">Try demo</button></div>';
  $('wdemo').onclick = () => done(DEMO_ADDR, true);
  $('wgo').onclick = async () => { const a = $('waddr').value.trim(); if (await validAddr(a)) lookup(a); else $('waddr').value = '', $('waddr').placeholder = 'Not a valid XRPL address'; };
}
$('walletBtn').onclick = e => { e.stopPropagation(); if (document.pointerLockElement) document.exitPointerLock(); return signIn(e); }; // v32: real desktop clicks
$('walletBtn').style.setProperty('opacity', '1', 'important'); // v32 full opacity
['pointerdown','mousedown','click'].forEach(t => $('wallet').addEventListener(t, e => e.stopPropagation()));
if (location.search.includes('wallettest')) signIn().then(() => $('wdemo') && location.search.includes('demo') && $('wdemo').click()); // headless demo check
