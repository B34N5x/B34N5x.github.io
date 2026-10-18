'use strict';
// Celebrations, saving journey PDF and story box, driven by public Testnet data.
// Nothing here is stored or sent anywhere; the only network use is read-only Testnet requests via app.js.
(function () {
  const $ = id => document.getElementById(id);
  const EPOCH = 946684800, rd = r => new Date((r + EPOCH) * 1000);
  const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const xrp = d => (Number(d) / 1e6).toLocaleString('en', { maximumFractionDigits: 6 });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nameOf = () => ($('childName').value.trim() || 'your family member');
  const Name = () => { const n = nameOf(); return n.charAt(0).toUpperCase() + n.slice(1); };
  // Static, sourced list (PLAN §6e). Approximate months, neutral wording, no numbers.
  const EVENTS = [['2008-09', 'Global financial crisis: Lehman Brothers filed for bankruptcy'], ['2018-01', 'Crypto bear market began, lasting through most of 2018'],
    ['2020-03', 'Markets fell sharply as COVID-19 spread worldwide'], ['2022-05', 'Crypto downturn: the TerraUSD stablecoin and Luna collapsed'],
    ['2022-11', 'Crypto downturn: the FTX exchange filed for bankruptcy']];
  function dur(a, b) { let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth(); if (b.getUTCDate() < a.getUTCDate()) m--; m = Math.max(0, m);
    const y = Math.floor(m / 12); m %= 12; if (!y && !m) return 'less than a month'; return (y ? y + ' year' + (y == 1 ? '' : 's') : '') + (y && m ? ', ' : '') + (m ? m + ' month' + (m == 1 ? '' : 's') : ''); }
  const ym = d => d.toISOString().slice(0, 7);

  // ---- state from the ledger (memory only, gone when the page closes) ----
  let child = null, history = [], shown = new Set();
  async function loadHistory(addr) {
    let marker, out = [], pages = 0;
    do { const r = await window.FV.rpc('account_tx', { account: addr, ledger_index_min: -1, ledger_index_max: -1, forward: true, limit: 200, ...(marker ? { marker } : {}) });
      out = out.concat(r.transactions); marker = r.marker; } while (marker && ++pages < 10);
    const creates = new Map(); const ev = [];
    out.forEach(x => { const t = x.tx || x.tx_json; if (!t || !x.meta || x.meta.TransactionResult !== 'tesSUCCESS') return; const d = t.date != null ? t.date : x.date;
      if (t.TransactionType === 'EscrowCreate' && t.Destination === addr) { creates.set(t.Account + ':' + (t.TicketSequence || t.Sequence), t); ev.push({ d, kind: 'create', what: 'Saving locked (EscrowCreate)', amt: t.Amount, hash: t.hash || x.hash, fa: t.FinishAfter }); }
      if ((t.TransactionType === 'EscrowFinish' || t.TransactionType === 'EscrowCancel') && creates.has(t.Owner + ':' + t.OfferSequence)) {
        const c = creates.get(t.Owner + ':' + t.OfferSequence); ev.push({ d, kind: t.TransactionType === 'EscrowFinish' ? 'finish' : 'cancel', what: t.TransactionType === 'EscrowFinish' ? 'Saving claimed (EscrowFinish)' : 'Saving returned to saver (EscrowCancel)', amt: c.Amount, hash: t.hash || x.hash }); }
    });
    return ev.sort((a, b) => a.d - b.d);
  }
  const firstDate = () => { const c = history.find(e => e.kind === 'create'); return c ? rd(c.d) : null; };
  function updateDur() { const f = firstDate(); $('storyDur').innerHTML = f ? '<b>Saving for ' + dur(f, new Date()) + '</b> so far (first saving ' + f.toISOString().slice(0, 10) + ' UTC).' : ''; }

  // ---- pop-ups (no sound, easy to close, reduced-motion aware) ----
  const pop = $('pop'), pc = $('popc');
  function celebrate(key, title, sub, opts = {}) {
    if (key && shown.has(key)) return; if (key) shown.add(key);
    $('pt').textContent = title; $('psub').textContent = sub || '';
    $('pdur').hidden = !opts.dur; if (opts.dur) $('pdur').innerHTML = opts.dur; $('pq').hidden = !opts.quote;
    pop.classList.add('open'); $('close').focus(); if (rm) return;
    const cl = ['#ffd6c2', '#d9ccff', '#c8f2dc', '#ffb38a', '#b9a7ff'];
    for (let i = 0; i < 40; i++) { const d = document.createElement('i'); d.className = 'conf'; d.style.left = Math.random() * 100 + '%'; d.style.background = cl[i % 5]; d.style.animationDelay = Math.random() * .6 + 's'; pc.appendChild(d); setTimeout(() => d.remove(), 3200); }
  }
  const close = () => pop.classList.remove('open');
  $('close').onclick = close; pop.onclick = e => { if (e.target === pop) close(); }; addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  document.addEventListener('fv:child', async e => {
    child = e.detail.addr; const now = e.detail.now;
    try { history = await loadHistory(child); } catch { history = []; }
    updateDur();
    const out = $('childOut');
    if (history.length) { const b = document.createElement('button'); b.className = 'alt'; b.textContent = 'Celebrate the handoff (legal age)'; b.onclick = handoff; const w = document.createElement('div'); w.className = 'btns'; w.appendChild(b); out.appendChild(w); }
    const ready = e.detail.open.filter(o => o.FinishAfter && o.FinishAfter <= now);
    const finished = history.filter(h => h.kind === 'finish');
    if (ready.length) celebrate('ready:' + child, 'Milestone reached!', 'Look how far ' + Name() + "'s savings have come. " + (ready.length > 1 ? ready.length + ' savings are' : 'A saving is') + ' now ready to claim.');
    else if (finished.length) celebrate('fin:' + child, 'You made it! Every bit you saved is now ' + Name() + "'s.", 'Small steps, a big start for ' + Name() + '.');
    else if (history.filter(h => h.kind === 'create').length === 1 && Date.now() - rd(history[0].d) < 7 * 864e5) celebrate('first:' + child, 'First saving locked in.', Name() + "'s future just got a little brighter.");
  });
  document.addEventListener('fv:hash', e => {
    const { status, tx } = e.detail;
    if (/^Finished/.test(status)) celebrate('h:' + tx.hash + 'f', 'You made it! Every bit you saved is now ' + Name() + "'s.", 'Patience paid off.');
    else if (/^Unlocked/.test(status)) celebrate('h:' + tx.hash + 'u', 'Milestone reached!', 'This saving is now ready to claim.');
  });
  function handoff() {
    const f = firstDate(); const d = f ? 'You saved for ' + dur(f, new Date()) : '';
    const n = f ? EVENTS.filter(x => x[0] >= ym(f) && x[0] <= ym(new Date())).length : 0;
    celebrate(null, 'You did it. Years of care, now in ' + Name() + "'s hands.", 'All that patience added up to a real gift. ' + Name() + ' takes it from here.',
      { quote: true, dur: d ? '<b>' + esc(d) + '.</b>' + (n ? ' Through ' + n + ' big market shake-up' + (n > 1 ? 's' : '') + ', and you kept going.' : '') : '' });
  }

  // ---- story files (downloads only) ----
  function dl(name, type, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  const fname = () => nameOf().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'family';
  $('storyTxt').onclick = () => dl(fname() + '-saving-story.txt', 'text/plain', $('story').value + ($('highlights').value.trim() ? '\n\nHighlights:\n' + $('highlights').value : ''));
  $('storyJson').onclick = () => dl(fname() + '-saving-story.json', 'application/json', JSON.stringify({ name: $('childName').value.trim() || null, story: $('story').value, highlights: $('highlights').value.split('\n').filter(Boolean), savedOn: new Date().toISOString() }, null, 2));

  // ---- journey PDF (browser print, built here from ledger data + this page) ----
  function fillJourney() {
    $('jtitle').textContent = Name() + "'s saving journey";
    const f = firstDate(), end = new Date();
    $('jdur').textContent = f ? 'Saving for ' + dur(f, end) + ' (' + f.toISOString().slice(0, 10) + ' to ' + end.toISOString().slice(0, 10) + ' UTC).' : 'Load their savings above to add the ledger history.';
    const inRange = f ? EVENTS.filter(x => x[0] >= ym(f) && x[0] <= ym(end)) : [];
    const rows = history.map(h => ({ m: ym(rd(h.d)), h: '<td>' + esc(h.what) + '</td><td>' + xrp(h.amt) + ' test XRP</td><td>' + esc((h.hash || '').slice(0, 10)) + '…</td>' }));
    history.filter(h => h.kind === 'create' && h.fa && h.fa > Date.now() / 1000 - EPOCH).forEach(h => rows.push({ m: ym(rd(h.fa)), h: '<td>Unlocks (upcoming)</td><td>' + xrp(h.amt) + ' test XRP</td><td>—</td>' }));
    inRange.forEach(x => rows.push({ m: x[0], h: '<td colspan="3"><i>World event: ' + esc(x[1]) + '</i></td>' }));
    rows.sort((a, b) => a.m < b.m ? -1 : a.m > b.m ? 1 : 0);
    $('jrows').innerHTML = rows.map(r => '<tr><td>' + r.m + '</td>' + r.h + '</tr>').join('') || '<tr><td colspan="4">No ledger events loaded.</td></tr>';
    $('jevents').innerHTML = inRange.map(x => '<li>' + x[0] + ': ' + esc(x[1]) + '</li>').join('') || '<li>Calm markets so far.</li>';
    $('jkept').hidden = !inRange.length;
    const hl = $('highlights').value.split('\n').map(s => s.trim()).filter(Boolean);
    $('jhigh').innerHTML = hl.map(s => '<li>' + esc(s) + '</li>').join('') || '<li>None added.</li>';
    $('jstory').textContent = $('story').value || '(No story written yet.)';
  }
  $('pdf').onclick = () => { fillJourney(); window.print(); };
  addEventListener('beforeprint', fillJourney);
  window.FVJ = { fillJourney, handoff }; // for local testing only
})();
