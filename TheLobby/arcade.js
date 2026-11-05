// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// Ledger Arcade tokens + leaderboards (device-only, localStorage). Original code (MIT).
// Scores exist only to unlock cabinets. Portable sealed save format (see README "Player data").
// Rules: every machine has a top-10 board with initials. Beating the current #1 earns 1 unlock token.
// When a player has earned 2 tokens on one machine, that machine's board resets (fairness). 2 tokens unlock the next locked machine.
// Any run that fails a check (tampered save, impossible score, rate limit) is blocked: no initials, no save, no token.
const KEY = 'ledgerArcade.v1', FORMAT = 'b34n5-arcade-save', VERSION = 1, GAME_VERSION = 'v14';
const SALT = 'b34n5-lobby/arcade-seal/2026'; // embedded app salt: deters casual edits only, not a secret
export const MACHINES = { run: 'VAULT RUN', clash: 'ESCROW CLASH' };
export const LOCKED_ORDER = ['VAULT', 'NODE RUSH'];
// Caps from the game formulas, generous on purpose:
// clash: wins*1000 + dealt*10 + (won ? hp*20 + timer*10) with 60s rounds, first to 2 wins; allow 10 rounds of draws: 2000+10*100*10+2000+600 = 14600 -> 15000
// run: per stage 8 cols x (150+80+50+50) x2 (dive bonus) = 5280 + 500*stage; 50 stages = 264000 + 637500 = 901500 -> 1000000
export const CAPS = { clash: 15000, run: 1000000 };
const HOUSE = { run: [['B34', 4000], ['XRP', 2500], ['LDG', 1500], ['ESC', 800], ['NOD', 400]], clash: [['B34', 3000], ['VLT', 2200], ['XRP', 1500], ['LDG', 900], ['NOD', 500]] };
const house = m => HOUSE[m].map(([n, s]) => ({ n, s, house: true }));
const fresh = () => ({ format: FORMAT, version: VERSION, gameVersion: GAME_VERSION, date: new Date().toISOString(), initials: '',
  scores: Object.fromEntries(Object.keys(MACHINES).map(m => [m, { board: house(m), earned: 0, resets: 0 }])), tokens: 0, gamesPlayed: 0, unlocks: [], settings: { aura: true }, selfReported: false });
const canon = v => Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',')}}` : JSON.stringify(v);
export async function sealOf(s) { const { seal, ...rest } = s; const b = new TextEncoder().encode(canon(rest) + '|' + (s.initials || '') + '|' + SALT);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join(''); }
const num = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
// returns '' when sane, otherwise a friendly reason
export function check(s) {
  if (!s || s.format !== FORMAT || s.version !== VERSION) return 'Not a lobby arcade save.';
  if (!num(s.tokens) || !num(s.gamesPlayed) || !Array.isArray(s.unlocks)) return 'Save has invalid numbers.';
  if (!/^[A-Z0-9]{0,3}$/.test(s.initials || '')) return 'Initials must be up to 3 letters.';
  for (const m of Object.keys(MACHINES)) { const g = s.scores && s.scores[m]; if (!g || !Array.isArray(g.board) || !num(g.earned) || !num(g.resets)) return 'Save has missing score data.';
    if (g.board.length > 10) return 'Save has too many score entries.';
    for (const e of g.board) if (!e || typeof e !== 'object' || !/^[A-Z0-9]{0,3}$/.test(e.n || '') || !num(e.s) || e.s > CAPS[m]) return `A ${MACHINES[m]} score is higher than the game allows.`; }
  if (s.unlocks.some((u, i) => u !== LOCKED_ORDER[i])) return 'Unlocks are out of cabinet order.';
  if (s.tokens + 2 * s.unlocks.length > s.gamesPlayed) return 'More tokens than games played could earn.';
  return '';
}
let cur = null, blocked = '', lastBlock = '';
const raw = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
function migrate(o) { // pre-v14 shape { tokens, earned, boards, unlocked, resets }
  const s = fresh(); if (!o) return s; s.tokens = o.tokens || 0; s.unlocks = o.unlocked || [];
  for (const m of Object.keys(MACHINES)) s.scores[m] = { board: (o.boards || {})[m] || house(m), earned: (o.earned || {})[m] || 0, resets: (o.resets || {})[m] || 0 };
  s.gamesPlayed = s.tokens + 2 * s.unlocks.length; return s;
}
export const ready = (async () => { const o = raw();
  if (!o || o.format !== FORMAT) { cur = migrate(o); return write(cur); }
  const bad = check(o) || (o.seal !== await sealOf(o) ? 'This device\'s arcade save was edited outside the game.' : '');
  cur = o; if (bad) { blocked = bad; console.warn('[arcade]', bad, '- scores blocked until the save is reset or a valid file is imported'); } })();
export const status = () => blocked;
export const lastBlockReason = () => lastBlock;
function get() { if (!cur) { const o = raw(); cur = o && o.format === FORMAT ? o : migrate(o); } return cur; }
async function write(s) { s.date = new Date().toISOString(); s.settings = { aura: localStorage.getItem('ledgerAura') !== 'off' };
  s.seal = await sealOf(s); localStorage.setItem(KEY, JSON.stringify(s)); }
// compatibility view used by the lobby/props/games
export function load() { const s = get(); return { tokens: s.tokens, unlocked: s.unlocks, boards: Object.fromEntries(Object.keys(MACHINES).map(m => [m, s.scores[m].board])) }; }
export const top = m => get().scores[m].board[0];
const games = []; let lastImport = 0;
// Call once at game over. Returns true only for a legit run that makes the board.
export function qualifies(m, score) {
  lastBlock = ''; const now = Date.now(); while (games.length && now - games[0] > 60000) games.shift();
  if (blocked) { lastBlock = 'Score not recorded: ' + blocked; return false; }
  if (!num(score) || score > CAPS[m]) { lastBlock = 'Score not recorded: that score is not possible in this game.'; return false; }
  if (games.length >= 6) { lastBlock = 'Score not recorded: too many games in a minute. Take a breather.'; return false; }
  games.push(now); const s = get(); s.gamesPlayed++; write(s);
  const b = s.scores[m].board; return score > 0 && (b.length < 10 || score > b[b.length - 1].s);
}
// returns { rank, token, reset, tokens } or null when blocked
export function submitScore(m, initials, score) {
  if (blocked || !num(score) || score > CAPS[m]) return null;
  const s = get(), g = s.scores[m], b = g.board, prevTop = b[0] ? b[0].s : 0;
  const n = (initials || 'AAA').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'A'); s.initials = n;
  b.push({ n, s: Math.floor(score), t: Date.now() }); b.sort((a, c) => c.s - a.s); g.board = b.slice(0, 10);
  const rank = g.board.findIndex(e => e.n === n && e.s === Math.floor(score)) + 1;
  let token = false, reset = false;
  if (score > prevTop) { token = true; s.tokens++; g.earned++; if (g.earned >= 2) { reset = true; g.earned = 0; g.resets++; g.board = house(m); } }
  write(s); return { rank, token, reset, tokens: s.tokens };
}
export const nextLocked = () => LOCKED_ORDER.find(t => !get().unlocks.includes(t)) || null;
export const isUnlocked = title => get().unlocks.includes(title);
export function spendUnlock(title) { const s = get(); if (blocked || s.tokens < 2 || s.unlocks.includes(title) || nextLocked() !== title) return false; s.tokens -= 2; s.unlocks.push(title); write(s); return true; }
export async function exportSave() { await ready; const s = get(); await write(s); return JSON.stringify(s, null, 2); }
// Whole file is accepted or rejected; nothing partial. Returns '' on success or a friendly reason.
export async function importSave(text) {
  if (Date.now() - lastImport < 60000) return 'One import per minute, please try again shortly.'; lastImport = Date.now();
  if (typeof text !== 'string' || text.length > 20000) return 'That file is too big to be a save.';
  let o; try { o = JSON.parse(text); } catch (e) { return 'That file is not valid JSON.'; }
  const bad = check(o); if (bad) return 'Import rejected: ' + bad;
  if (o.seal !== await sealOf(o)) return 'Import rejected: this file was edited after it was saved.';
  o.selfReported = true; cur = o; blocked = ''; await write(o); return '';
}
export const RULES = 'Beat the #1 score = 1 token · 2 tokens unlock the next machine · board resets after 2 tokens earned on it';
