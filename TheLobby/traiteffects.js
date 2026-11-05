// (c) 2026 B34N5x. All rights reserved. Third-party code under its own licence (see credits.txt).
// Preview: data-driven trait -> ability visual effect params. Phone-light, no storage.
// Maps public NFT trait keywords/colours onto laser/flight/charge/aura/slash FX.
import { resolveAbilities } from './traits.js?v=34';

const hex = (c, fb = '#ff3a5a') => {
  if (!c) return fb;
  if (typeof c === 'number') return '#' + (c >>> 0).toString(16).padStart(6, '0').slice(-6);
  const s = String(c).trim();
  if (/^#?[0-9a-f]{6}$/i.test(s)) return s.startsWith('#') ? s : '#' + s;
  const named = { red: '#ff3a5a', blue: '#3ab0ff', cyan: '#5ff8ff', green: '#5dff8a', purple: '#c07bff', violet: '#a06bff', gold: '#ffcc55', orange: '#ff9a3c', yellow: '#ffe066', white: '#f4f4f8', black: '#222230', silver: '#c0c6d0', pink: '#ff7ab6', teal: '#3dd6c6' };
  const k = s.toLowerCase();
  for (const [n, h] of Object.entries(named)) if (k.includes(n)) return h;
  return fb;
};

function blobOf(spec) {
  return JSON.stringify([(spec && spec.features) || {}, (spec && spec.detected) || [], (spec && spec.matched) || [], (spec && spec.colours) || {}]).toLowerCase();
}

function wingKind(blob, F) {
  if (/bat|demon|dragon|membrane/.test(blob)) return 'bat';
  if (/mech|metal|robot|jet|techno|steel/.test(blob)) return 'mechanical';
  if (/feather|angel|bird|winged/.test(blob) || (F && F.wings)) return 'feather';
  return 'feather';
}
function eyeKind(blob, F) {
  if (/cyber|neon|visor|tech|blue beam|ice/.test(blob)) return 'cyber';
  if (/laser|beam|heat/.test(blob) || (F && F.eyes && /laser|beam/.test(JSON.stringify(F.eyes).toLowerCase()))) return 'laser';
  return 'laser';
}
function hornKind(blob) {
  if (/fire|flame|infernal|lava/.test(blob)) return 'fire';
  if (/ice|frost|crystal/.test(blob)) return 'ice';
  if (/ram|goat|bone/.test(blob)) return 'ram';
  return 'ram';
}
function weaponKind(blob) {
  if (/axe|hammer|club/.test(blob)) return 'axe';
  if (/staff|wand|scepter|rod/.test(blob)) return 'staff';
  if (/katana|saber|blade|sword|scythe|dagger/.test(blob)) return 'sword';
  if (/blaster|gun|rifle|cannon/.test(blob)) return 'blaster';
  return 'sword';
}
function auraKind(blob) {
  if (/electric|lightning|plasma|spark/.test(blob)) return 'electric';
  if (/flame|fire|ember/.test(blob)) return 'flame';
  if (/sparkle|radiant|gold/.test(blob)) return 'sparkle';
  return 'glow';
}

/** Resolve per-ability FX params from NFT traits. Always returns a full effect object. */
export function resolveAbilityEffects(spec, map) {
  const F = (spec && spec.features) || {};
  const cols = (spec && spec.colours) || {};
  const blob = blobOf(spec);
  const body = hex(cols.body || cols.primary || cols.accent, '#9a9aa0');
  const accent = hex(cols.accent || cols.secondary || cols.body, body);
  const list = resolveAbilities(spec, map);
  const out = {};
  for (const a of list) {
    if (!a.ability) continue;
    if (a.ability === 'laser') {
      const kind = eyeKind(blob, F);
      const col = hex((F.eyes && F.eyes.colour) || a.color || (kind === 'cyber' ? '#3ab0ff' : '#ff3a5a'), kind === 'cyber' ? '#3ab0ff' : '#ff3a5a');
      out.laser = { kind, color: col, width: kind === 'cyber' ? 2.0 : 1.8, length: kind === 'cyber' ? 11 : 10, debris: kind === 'cyber' ? 1.2 : 1.5, dur: 0.9 };
    } else if (a.ability === 'flight') {
      const kind = wingKind(blob, F);
      const col = hex((F.wings && F.wings.colour) || accent, kind === 'mechanical' ? '#c0c6d0' : '#f4f4f8');
      out.flight = { kind, color: col, trail: kind === 'mechanical' ? 'sparks' : kind === 'bat' ? 'smoke' : 'feathers', boostY: a.boostY || 6.5, dur: a.duration || 1.45 };
    } else if (a.ability === 'charge') {
      const kind = hornKind(blob);
      const col = hex((F.horns && F.horns.colour) || accent, kind === 'fire' ? '#ff6a2a' : kind === 'ice' ? '#9ad8ff' : '#c8a878');
      out.charge = { kind, color: col, dust: kind === 'fire' ? 'embers' : kind === 'ice' ? 'frost' : 'dust', speed: a.speed || 2.4, dur: a.duration || 0.55 };
    } else if (a.ability === 'aura') {
      const kind = auraKind(blob);
      const col = hex((F.aura && F.aura.colour) || a.color || accent, '#7dffd8');
      out.aura = { kind, color: col, shape: kind === 'electric' ? 'hex' : kind === 'flame' ? 'flare' : 'ring', speed: a.speed || 1.55, dur: a.duration || 1.4 };
    } else if (a.ability === 'slash') {
      const kind = weaponKind(blob);
      const col = hex((F.weapon && F.weapon.colour) || accent, kind === 'blaster' ? '#5ff8ff' : '#ffe8a0');
      out.slash = { kind, color: col, arc: kind === 'axe' ? 1.4 : kind === 'staff' ? 0.7 : kind === 'blaster' ? 0.3 : 1.0, speed: a.speed || 2.0, dur: a.duration || 0.45 };
    }
  }
  // Abstract / trait-less fallback: body-palette tinted generic pulse (no combat ability required)
  if (!Object.keys(out).length) {
    out.fallback = { kind: 'palette', color: body, accent, pulse: true };
  }
  out._body = body; out._accent = accent;
  return out;
}

/** Attach effect params onto each resolved ability entry (mutates copies). */
export function enrichAbilities(list, spec, map) {
  const fx = resolveAbilityEffects(spec, map);
  return (list || []).map(a => {
    const copy = Object.assign({}, a);
    if (a.ability && fx[a.ability]) copy.fx = fx[a.ability];
    else if (!a.ability && fx.fallback) copy.fx = fx.fallback;
    return copy;
  });
}
