'use strict';
// Family Vault phase 1. Read-only Testnet views + UNSIGNED transaction builder.
// This file never asks for, handles or stores secrets or keys, and never signs or submits.
const TESTNET_SERVERS = ['wss://s.altnet.rippletest.net:51233', 'wss://testnet.xrpl-labs.com']; // primary, then fallback; both must report network id 1
const RIPPLE_EPOCH = 946684800; // seconds between 1970-01-01 and 2000-01-01 (UTC)
const $ = id => document.getElementById(id);
const ADDR_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
// Checks the built-in checksum of a classic XRPL address (base58 + double SHA-256), so typos are caught before anything is read.
const XRPL_ALPHA = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
const BAD_SUM = 'That address has a typo somewhere (its built-in checksum does not match). Please copy it again from the wallet.';
async function isClassicAddress(a) {
  if (typeof a !== 'string' || !ADDR_RE.test(a)) return false;
  let n = 0n; for (const ch of a) { const k = XRPL_ALPHA.indexOf(ch); if (k < 0) return false; n = n * 58n + BigInt(k); }
  const raw = []; while (n > 0n) { raw.unshift(Number(n & 255n)); n >>= 8n; }
  for (let i = 0; i < a.length && a[i] === 'r'; i++) raw.unshift(0);
  if (raw.length !== 25 || raw[0] !== 0) return false;
  const d1 = await crypto.subtle.digest('SHA-256', new Uint8Array(raw.slice(0, 21)));
  const d2 = new Uint8Array(await crypto.subtle.digest('SHA-256', d1));
  for (let i = 0; i < 4; i++) if (d2[i] !== raw[21 + i]) return false;
  return true;
}
const HASH_RE = /^[0-9A-Fa-f]{64}$/;

// ---- tiny Testnet client (read-only requests only) ----
let ws = null, connecting = null, nextId = 1; const pending = new Map();
const READ_ONLY = new Set(['account_objects', 'account_info', 'account_tx', 'tx', 'ledger_entry', 'server_info']);
function openServer(url) {
  return new Promise((res, rej) => {
    if (!TESTNET_SERVERS.includes(url)) return rej(new Error('Testnet only'));
    const s = new WebSocket(url); let done = false;
    const fail = m => { if (!done) { done = true; try { s.close(); } catch { } rej(new Error(m)); } };
    const timer = setTimeout(() => fail('timeout'), 8000);
    s.onerror = () => fail('unreachable');
    s.onopen = () => s.send(JSON.stringify({ id: 0, command: 'server_info' }));
    s.onmessage = e => { // safety: only talk to a server that reports the XRPL Testnet (network_id 1)
      const d = JSON.parse(e.data); if (d.id !== 0 || done) return; clearTimeout(timer);
      if (d.status === 'success' && d.result.info && d.result.info.network_id === 1) { done = true; res(s); } else fail('Refused: that server is not the XRPL Testnet.');
    };
  });
}
function connect() {
  if (ws && ws.readyState === 1) return Promise.resolve();
  if (connecting) return connecting;
  connecting = (async () => {
    let last;
    for (const url of TESTNET_SERVERS) {
      try { ws = await openServer(url); break; } catch (e) { last = e; ws = null; }
    }
    if (!ws) throw new Error('Could not reach the XRPL Testnet. Check your connection and try again.');
    ws.onclose = () => { ws = null; connecting = null; pending.forEach(p => p.rej(new Error('Connection closed'))); pending.clear(); };
    ws.onmessage = e => { const d = JSON.parse(e.data); const p = pending.get(d.id); if (!p) return; pending.delete(d.id);
      d.status === 'success' ? p.res(d.result) : p.rej(Object.assign(new Error(d.error_message || d.error || 'Request failed'), { code: d.error })); };
    connecting = null;
  })();
  connecting.catch(() => { connecting = null; });
  return connecting;
}
async function rpc(command, params = {}) {
  if (!READ_ONLY.has(command)) throw new Error('Blocked: this app only reads the ledger.');
  await connect();
  const id = nextId++;
  return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, command, api_version: 1, ...params })); });
}

// ---- helpers ----
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dropsToXrp = d => (Number(BigInt(d) / 1000000n) + Number(BigInt(d) % 1000000n) / 1e6).toLocaleString('en', { maximumFractionDigits: 6 });
window.FV = { rpc: (c, p) => rpc(c, p) };
const rippleToDate = r => new Date((r + RIPPLE_EPOCH) * 1000);
const fmtUTC = d => d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const nowRipple = () => Math.floor(Date.now() / 1000) - RIPPLE_EPOCH;
function xrpToDrops(v) {
  const s = String(v).trim(); if (!/^\d+(\.\d{1,6})?$/.test(s)) return null;
  const [w, f = ''] = s.split('.'); const drops = BigInt(w) * 1000000n + BigInt((f + '000000').slice(0, 6));
  return drops > 0n ? drops.toString() : null;
}
function utcInputToRipple(v) { if (!v) return null; const t = Date.parse(v + ':00Z'); return isNaN(t) ? null : Math.floor(t / 1000) - RIPPLE_EPOCH; }
function show(el, html) { $(el).innerHTML = html; }
function errBox(el, msg) { show(el, '<p class="err">' + esc(msg) + '</p>'); }
function download(name, type, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
async function copyText(t, btn) { try { await navigator.clipboard.writeText(t); btn.textContent = 'Copied'; } catch { btn.textContent = 'Select and copy manually'; } }

// ---- opt-in calendar file (.ics), made on this device ----
function icsFor(events) {
  const z = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Family Vault practice//EN', 'CALSCALE:GREGORIAN'];
  events.forEach((e, i) => lines.push('BEGIN:VEVENT', 'UID:fv-' + z(e.date) + '-' + i + '@family-vault.local', 'DTSTAMP:' + z(new Date()),
    'DTSTART:' + z(e.date), 'DTEND:' + z(new Date(e.date.getTime() + 30 * 60000)), 'SUMMARY:' + e.title.replace(/[,;\\]/g, ' '),
    'DESCRIPTION:' + e.desc.replace(/[,;\\]/g, ' ').replace(/\n/g, '\\n'), 'END:VEVENT'));
  lines.push('END:VCALENDAR'); return lines.join('\r\n');
}
function icsButton(container, events, label) {
  const b = document.createElement('button'); b.className = 'alt'; b.textContent = label || 'Add unlock dates to my calendar (.ics)';
  b.onclick = () => download('family-vault-unlock-dates.ics', 'text/calendar', icsFor(events));
  container.appendChild(b);
  const p = document.createElement('p'); p.className = 'small'; p.textContent = 'Optional. The calendar file is made on your device; nothing is sent or stored.'; container.appendChild(p);
}

// ---- 1) family member's savings card ----
async function txDate(hash) { try { const t = await rpc('tx', { transaction: hash }); return t.date != null ? t.date : (t.tx_json && t.tx_json.date); } catch { return null; } }
$('loadChild').onclick = async () => {
  const addr = $('childAddr').value.trim();
  if (!ADDR_RE.test(addr)) return errBox('childOut', 'That does not look like an XRPL address. It should start with "r".');
  if (!(await isClassicAddress(addr))) return errBox('childOut', BAD_SUM);
  show('childOut', '<p class="note">Reading the Testnet ledger…</p>');
  try {
    let marker, objs = [];
    do { const r = await rpc('account_objects', { account: addr, type: 'escrow', ledger_index: 'validated', limit: 200, ...(marker ? { marker } : {}) }); objs = objs.concat(r.account_objects); marker = r.marker; } while (marker);
    const mine = objs.filter(o => o.Destination === addr);
    const now = nowRipple(); let total = 0n;
    if (!mine.length) { show('childOut', '<p class="note">No locked savings found for this address on Testnet right now.</p>'); document.dispatchEvent(new CustomEvent('fv:child', { detail: { addr, open: [], now } })); return; }
    for (const o of mine) { total += BigInt(o.Amount); o._created = await txDate(o.PreviousTxnID); }
    mine.sort((a, b) => (a.FinishAfter || 0) - (b.FinishAfter || 0));
    const upcoming = mine.filter(o => o.FinishAfter && o.FinishAfter > now);
    const next = upcoming[0];
    let html = `<div class="big">${dropsToXrp(total.toString())} test XRP locked</div>`;
    if (next) {
      const start = next._created || now, pct = Math.max(0, Math.min(100, Math.round((now - start) / (next.FinishAfter - start) * 100)));
      html += `<div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i data-w="${pct}"></i></div>
      <div class="row"><span>${mine.length} saving${mine.length > 1 ? 's' : ''}</span><span>Next unlock: <b>${fmtUTC(rippleToDate(next.FinishAfter))}</b></span><span>${pct}% of the way</span></div>`;
    } else html += `<p class="note">All savings here have reached their unlock date. They can be finished (claimed) now.</p>`;
    html += mine.map(o => {
      const st = o.FinishAfter && o.FinishAfter > now ? 'Locked' : (o.CancelAfter && o.CancelAfter <= now ? 'Past cancel date (can be returned to saver)' : 'Unlocked: ready to claim');
      return `<div class="esc"><b>${dropsToXrp(o.Amount)} test XRP</b> · ${esc(st)}<br>
      <span class="small">From ${esc(o.Account)}${o._created != null ? ' · locked ' + fmtUTC(rippleToDate(o._created)) : ''}${o.FinishAfter ? ' · unlocks ' + fmtUTC(rippleToDate(o.FinishAfter)) : ''}${o.CancelAfter ? ' · cancel after ' + fmtUTC(rippleToDate(o.CancelAfter)) : ''}${o.Condition ? ' · has a crypto-condition (not made by this tool)' : ''}<br>Created by tx ${esc(o.PreviousTxnID.slice(0, 12))}… (paste it in the hash lookup if it is an EscrowCreate)</span></div>`;
    }).join('');
    html += '<div class="btns" id="childIcs"></div>';
    show('childOut', html);
    document.querySelectorAll('#childOut .bar>i').forEach(i => i.style.width = i.dataset.w + '%');
    const evs = upcoming.map(o => ({ date: rippleToDate(o.FinishAfter), title: 'Family Vault: savings unlock (' + dropsToXrp(o.Amount) + ' test XRP)', desc: 'Testnet practice saving to ' + addr + ' unlocks. Check progress at your Family Vault page.' }));
    if (evs.length) icsButton($('childIcs'), evs);
    document.dispatchEvent(new CustomEvent('fv:child', { detail: { addr, open: mine, now } }));
  } catch (e) { errBox('childOut', e.code === 'actNotFound' ? 'This address is not active on Testnet yet (it needs to be funded first).' : e.message); }
};

// ---- 2) hash lookup ----
function unsignedBox(title, txObj, steps, fileName) {
  const json = JSON.stringify(txObj, null, 2), id = 'u' + Math.random().toString(36).slice(2);
  return `<h3>${esc(title)}</h3><pre class="json" id="${id}">${esc(json)}</pre>
  <div class="btns"><button class="alt" data-copy="${id}">Copy JSON</button><button class="alt" data-dl="${id}" data-name="${esc(fileName)}">Download JSON</button></div>
  <ol class="steps">${steps.map(s => '<li>' + s + '</li>').join('')}</ol>`;
}
document.addEventListener('click', e => {
  const c = e.target.dataset && e.target.dataset.copy, d = e.target.dataset && e.target.dataset.dl;
  if (c) copyText($(c).textContent, e.target);
  if (d) download(e.target.dataset.name, 'application/json', $(d).textContent);
});
const SIGN_STEPS = ['Open <b>your own</b> XRPL wallet that supports Testnet and signing a transaction from JSON.',
  'Paste or import this JSON. Your wallet fills in Fee and Sequence.',
  'Check every field (addresses, amount, dates) before you sign. Make sure your wallet is on <b>Testnet</b>.',
  'Sign and submit in your wallet. Then paste the new transaction hash here to check it.'];
$('lookHash').onclick = async () => {
  const h = $('hash').value.trim();
  if (!HASH_RE.test(h)) return errBox('hashOut', 'A transaction hash is 64 characters using 0-9 and A-F.');
  show('hashOut', '<p class="note">Looking it up on Testnet…</p>');
  try {
    const r = await rpc('tx', { transaction: h }); const t = r.tx_json || r;
    const ok = (r.meta && r.meta.TransactionResult) || '';
    if (t.TransactionType !== 'EscrowCreate') {
      return show('hashOut', `<p class="note">This is a <b>${esc(t.TransactionType)}</b> transaction (${esc(ok)}), not an EscrowCreate. For savings, paste the hash of the EscrowCreate.</p>`);
    }
    if (ok !== 'tesSUCCESS') return show('hashOut', `<p class="err">This EscrowCreate did not succeed (${esc(ok)}), so nothing was locked.</p>`);
    const owner = t.Account, seq = t.TicketSequence || t.Sequence, now = nowRipple();
    let status, entry = null;
    try { const le = await rpc('ledger_entry', { escrow: { owner, seq }, ledger_index: 'validated' }); entry = le.node; status = (t.FinishAfter && t.FinishAfter > now) ? 'Still locked' : 'Unlocked: ready to claim'; }
    catch (e) {
      if (e.code !== 'entryNotFound') throw e;
      status = 'Finished or cancelled';
      try { // find which, from the owner's public history
        const at = await rpc('account_tx', { account: owner, ledger_index_min: r.ledger_index || -1, ledger_index_max: -1, forward: true, limit: 200 });
        const hit = at.transactions.map(x => x.tx || x.tx_json).find(x => x && (x.TransactionType === 'EscrowFinish' || x.TransactionType === 'EscrowCancel') && x.Owner === owner && x.OfferSequence === seq);
        if (hit) status = hit.TransactionType === 'EscrowFinish' ? 'Finished: the XRP was delivered to the family member' : 'Cancelled: the XRP went back to the saver';
      } catch { }
    }
    const start = r.date != null ? r.date : t.date;
    let pct = 100; if (t.FinishAfter && start != null && t.FinishAfter > now) pct = Math.max(0, Math.round((now - start) / (t.FinishAfter - start) * 100));
    let html = `<div class="esc"><b>Status: ${esc(status)}</b><br><span class="small">
      Saver (owner): ${esc(owner)} · Sequence: ${seq}<br>To: ${esc(t.Destination)}<br>Amount: ${dropsToXrp(t.Amount)} test XRP<br>
      ${start != null ? 'Locked: ' + fmtUTC(rippleToDate(start)) + '<br>' : ''}
      ${t.FinishAfter ? 'Unlocks (FinishAfter): ' + fmtUTC(rippleToDate(t.FinishAfter)) + '<br>' : ''}
      ${t.CancelAfter ? 'Cancel after (CancelAfter): ' + fmtUTC(rippleToDate(t.CancelAfter)) : ''}</span></div>`;
    if (entry && t.FinishAfter) html += `<div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i data-w="${Math.min(pct, 100)}"></i></div><p class="small">${Math.min(pct, 100)}% of the way to the unlock date.</p>`;
    html += '<div class="btns" id="hashIcs"></div>';
    if (entry) {
      html += `<label for="signer">Address that will sign the claim or cancel (your own wallet)</label><input id="signer" autocomplete="off" spellcheck="false" placeholder="r...">
      <div class="btns"><button class="alt" id="mkFinish">Build unsigned claim (EscrowFinish)</button><button class="alt" id="mkCancel">Build unsigned cancel (EscrowCancel)</button></div><div id="fcOut"></div>`;
    }
    show('hashOut', html);
    document.dispatchEvent(new CustomEvent('fv:hash', { detail: { status, tx: t, open: !!entry } }));
    document.querySelectorAll('#hashOut .bar>i').forEach(i => i.style.width = i.dataset.w + '%');
    if (entry && t.FinishAfter && t.FinishAfter > now) icsButton($('hashIcs'), [{ date: rippleToDate(t.FinishAfter), title: 'Family Vault: savings unlock (' + dropsToXrp(t.Amount) + ' test XRP)', desc: 'Testnet practice saving unlocks. Hash: ' + h }]);
    if (entry) {
      const mk = async kind => {
        const s = $('signer').value.trim(); if (!ADDR_RE.test(s)) return errBox('fcOut', 'Enter the address of the wallet that will sign.'); if (!(await isClassicAddress(s))) return errBox('fcOut', BAD_SUM);
        const n2 = nowRipple();
        if (kind === 'EscrowFinish' && t.FinishAfter && n2 <= t.FinishAfter) return errBox('fcOut', 'Too early: the ledger will refuse a claim before ' + fmtUTC(rippleToDate(t.FinishAfter)) + '.');
        if (kind === 'EscrowCancel' && (!t.CancelAfter || n2 <= t.CancelAfter)) return errBox('fcOut', t.CancelAfter ? 'Too early: cancelling only works after ' + fmtUTC(rippleToDate(t.CancelAfter)) + '.' : 'This saving has no cancel date, so it cannot be cancelled.');
        show('fcOut', unsignedBox('Unsigned ' + kind, { TransactionType: kind, Account: s, Owner: owner, OfferSequence: seq }, SIGN_STEPS.concat([kind === 'EscrowFinish' ? 'A claim always sends the XRP to ' + esc(t.Destination) + ', whoever signs it.' : 'A cancel always returns the XRP to the saver ' + esc(owner) + ', whoever signs it.']), kind.toLowerCase() + '-unsigned.json'));
      };
      $('mkFinish').onclick = () => mk('EscrowFinish'); $('mkCancel').onclick = () => mk('EscrowCancel');
    }
  } catch (e) { errBox('hashOut', e.code === 'txnNotFound' ? 'No transaction with that hash on Testnet. Check you copied it fully, and that it was a Testnet transaction.' : e.message); }
};

// ---- 3) saver builder: UNSIGNED EscrowCreate ----
(function defaults() { const d = new Date(Date.now() + 365 * 864e5); d.setUTCMinutes(0, 0, 0); $('finish').value = d.toISOString().slice(0, 16); const c2 = new Date(d.getTime() + 30 * 864e5); $('cancel').value = c2.toISOString().slice(0, 16); })();
$('build').onclick = async () => {
  const saver = $('saver').value.trim(), dest = $('dest').value.trim(), drops = xrpToDrops($('amt').value);
  const fa = utcInputToRipple($('finish').value), ca = utcInputToRipple($('cancel').value), now = nowRipple(), errs = [];
  if (!ADDR_RE.test(saver)) errs.push('Your wallet address does not look right.');
  if (!ADDR_RE.test(dest)) errs.push("The family member's address does not look right.");
  if (ADDR_RE.test(saver) && !(await isClassicAddress(saver))) errs.push('Your wallet address has a typo (checksum does not match).');
  if (ADDR_RE.test(dest) && !(await isClassicAddress(dest))) errs.push("The family member's address has a typo (checksum does not match).");
  if (saver && saver === dest) errs.push('The saver and the family member must be different wallets.');
  if (!drops) errs.push('Enter an amount above 0 with at most 6 decimal places.');
  if (!fa || fa <= now + 60) errs.push('The unlock date must be in the future.');
  if (!ca || (fa && ca <= fa)) errs.push('The cancel-after date must be later than the unlock date.');
  if (errs.length) return show('buildOut', '<ul class="err">' + errs.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>');
  let note = '';
  try { await rpc('account_info', { account: dest, ledger_index: 'validated' }); } catch (e) { note = e.code === 'actNotFound' ? '<div class="warn">The family member\'s address is not active on Testnet yet. The ledger will reject this until that wallet is funded.</div>' : ''; }
  const tx = { TransactionType: 'EscrowCreate', Account: saver, Destination: dest, Amount: drops, FinishAfter: fa, CancelAfter: ca };
  const label = $('mlabel').value.trim();
  show('buildOut', note + `<div class="warn"><b>Before you sign, please read:</b><ul>
    <li>This locks <b>${dropsToXrp(drops)} test XRP</b> for ${esc(dest)}. Nobody can release it before <b>${fmtUTC(rippleToDate(fa))}</b>.</li>
    <li>After that, a claim always sends it to the family member's wallet. After <b>${fmtUTC(rippleToDate(ca))}</b>, if unclaimed, it can be returned to you.</li>
    <li>Each saving holds back a small reserve in your wallet while it is open, and every transaction costs a tiny fee, even if it fails.</li>
    <li>Transactions cannot be undone. This tool never sees your keys and cannot sign for you.</li>
    <li>Testnet only: this is practice XRP with no value.</li></ul></div>` +
    (label ? `<p class="small">Milestone label "${esc(label)}" stays on this page only. It is not in the transaction (ledger notes are public).</p>` : '') +
    unsignedBox('Unsigned EscrowCreate', tx, SIGN_STEPS, 'escrowcreate-unsigned.json') + '<div class="btns" id="buildIcs"></div>');
  icsButton($('buildIcs'), [{ date: rippleToDate(fa), title: 'Family Vault: ' + (label || 'savings unlock'), desc: 'Testnet practice saving to ' + dest + ' unlocks.' }]);
};
