import { nearestAccessory, detectFromMeta } from './parts.js';
// Step 10 + taxonomy 2026-11-04: generic trait reader for ANY collection metadata
// { name, description, collection, attributes:[{trait_type,value}] }
// -> { type, features, colours, tier, florist, fallback?, matched }. Keyword map: traits_map.json.
// Robust: never throws; abstract / image-only / no-trait -> playable generic capsule (palette tint).
let MAP = null;
export async function loadTraitMap(url = 'traits_map.json') { if (!MAP) MAP = await (await fetch(url)).json(); return MAP; }
export function setTraitMap(m) { MAP = m; }
const words = s => String(s || '').toLowerCase().replace(/[^a-z0-9#]+/g, ' ').trim().split(/\s+/).filter(Boolean);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const hit = (ws, keys) => {
  const set = Array.isArray(ws) ? ws : words(ws);
  return (keys || []).some(k => {
    const kk = String(k).toLowerCase();
    if (!kk) return false;
    if (kk.includes(' ')) return set.join(' ').includes(kk) || norm(set.join(' ')).includes(norm(kk));
    return set.includes(kk);
  });
};
// light fuzzy: key stem (≥4 chars) as whole word prefix in token list
const fuzzyHit = (ws, keys) => {
  if (hit(ws, keys)) return true;
  const set = Array.isArray(ws) ? ws : words(ws);
  return (keys || []).some(k => {
    // Multi-word keys: require the full phrase in the joined text (no aggressive stem).
    const raw = String(k).toLowerCase().trim();
    if (!raw) return false;
    if (raw.includes(' ')) return set.join(' ').includes(raw);
    if (raw.length < 5) return false; // short keys (bean/cap/ram) = exact only via hit()
    // Token may be a longer form of the key (wing -> winged, horn -> horns already exact).
    return set.some(w => w === raw || (w.length > raw.length && w.startsWith(raw) && w.length <= raw.length + 3));
  });
};
const NONE = /^(none|no|nothing|blank|n\/a|null|0|-)$/i;

// Step 11: merge an image 'avatar profile' (tools/profile_nft.py, + optional hand-verified overrides).
// Image wins for body shape + colours; metadata traits win for named features + tier.
// v29: anything with a face/eyes, a character silhouette, detected parts, a mask or held items is a character.
export function isCharacterProfile(p, verified) { p = p || {}; const v = verified || {};
  return !!(p.eyes || v.eyes || (p.detected && p.detected.length) || (p.mask && p.mask.coverage && p.mask.coverage !== 'none') || p.heldItems || v.heldItems || v.features || (p.silhouette && p.silhouette.topBump) || (v.bodyType && v.bodyType !== 'object' && v.bodyType !== 'canvas')); }
export function mergeProfile(spec, profile, verified, collectionProfile) { // collectionProfile: only that collection's own registry entry
  const p = Object.assign({}, profile || {}, verified || {}, { colours: Object.assign({}, (profile || {}).colours, (verified || {}).colours) });
  if (!profile && !verified) return ensurePlayable(spec);
  const out = Object.assign({}, spec, { features: Object.assign({}, spec.features), colours: Object.assign({}, spec.colours), profile: p });
  if (p.bodyType && p.bodyType !== 'unknown') { out.type = p.bodyType; out.typeFrom = verified && verified.bodyType ? 'image (verified)' : 'image'; out.florist = false; }
  if (p.item && isCharacterProfile(p, verified) && (p.bodyType === 'object' || p.bodyType === 'canvas')) { out.type = (verified && verified.bodyType) || 'capsule'; out.typeFrom = 'character kept (v29)'; } // v29: character beats classifier
  if (p.item) { out.item = p.item; out.florist = false; if (p.item.colours && p.item.colours[0] && out.type !== 'object' && out.type !== 'canvas') out.colours.body = p.item.category === 'hat' ? (p.item.skin || '#e0b48c') : p.item.colours[0]; if (out.type === 'object' || out.type === 'canvas') return out; } // v29: only true item avatars skip character reads // step 23: non-character -> no limb/glove reads
  if (out.type === 'art') return ensurePlayable(out);
  if (p.colours.body) out.colours.body = p.colours.body;
  ['band', 'strap', 'gloves', 'shoes', 'shoeTrim', 'visor'].forEach(k => { if (p.colours[k]) out.colours[k] = p.colours[k]; });
  const hints = (p.accessoryHints || []).join(' ') + ' ' + Object.values(p.features || {}).join(' ');
  const nm = p.mask && p.mask.auto && !(verified && verified.features); // step 13f: new region extractor decides shades/mask when present
  if (nm) { const sh = p.mask.shades; if (sh && sh[2] - sh[0] > 0.3 && !out.features.eyewear) out.features.eyewear = { kind: 'sunglasses', colour: null, from: 'image' }; if (p.mask.coverage !== 'none' && !out.features.mask) out.features.mask = { kind: 'mask', colour: null, from: 'image' }; }
  else if (!out.features.eyewear && /shades|visor/.test(hints)) out.features.eyewear = { kind: 'sunglasses', colour: null, from: 'image' };
  if (!nm && !out.features.mask && /mask|band/.test(hints)) out.features.mask = { kind: 'mask', colour: null, from: 'image' };
  if (!nm && /glove/.test(hints)) out.features.gloves = { kind: 'mitten', colour: out.colours.gloves || null, from: 'image' };
  if (!nm && /shoe|sneaker|feet/.test(hints)) out.features.shoes = { kind: 'sneaker', colour: out.colours.shoes || null, from: 'image' };
  if (p.style) { out.style = p.style; out.styleFrom = verified && verified.style ? 'verified' : 'image'; out.styleConfidence = p.styleConfidence; }
  if (p.height) out.height = p.height;
  if (p.eyes) out.eyes = p.eyes;
  if (p.traitTiers) out.traitTiers = p.traitTiers; // step 13i: per-trait tiers for native parts // step 13h: eye colour/shape from the image face region (verified > auto)
  if (p.features && p.features.necklace) out.features.necklace = { kind: 'chain', from: 'verified' };
  if (p.mask && p.mask.coverage && p.mask.coverage !== 'none') { out.mask = p.mask; out.maskFrom = verified && verified.mask ? 'verified' : 'image (auto extractor)'; } // step 13d
  out.detected = [...(spec.detected || []), ...((p.detected) || []).map(d => Object.assign({ from: 'image' }, d)), ...Object.entries((verified && verified.features) || {}).map(([k, v]) => ({ name: `${k}: ${v}`, from: 'verified' }))]; // step 13f: metadata + image regions + verified
  out.featureParts = [...(p.accessoryHints || []), ...Object.values(p.features || {})].map(h => ({ seen: String(h), part: nearestAccessory(h).id })); // step 13e: every seen feature -> closest library part (never dropped)
  if (p.maskStyle) out.maskStyle = p.maskStyle; if (p.wearables) out.wearables = p.wearables; if (p.heldItems) out.heldItems = p.heldItems; else if (collectionProfile && collectionProfile.signatureHeldItems) out.heldItems = collectionProfile.signatureHeldItems; if (p.legendaryTraits) out.legendaryTraits = p.legendaryTraits;
  if (p.tier) { out.tier = p.tier; out.tierFrom = p.tierNote || 'profile'; }
  if (p.features && p.features.emblem) out.features.emblem = { kind: 'bean', from: 'creator-declared' };
  if (p.features && p.features.xMarks) out.features.xMarks = { kind: 'x', colour: p.colours.xMarks || null, from: 'creator-declared' };
  out.topBump = !!(p.silhouette && p.silhouette.topBump); out.aspect = (p.silhouette && p.silhouette.bodyAspect) || 1.2;
  out.matched = [...new Set([...(spec.matched || []), ...Object.keys(out.features).map(k => k + ':' + out.features[k].kind)])];
  return ensurePlayable(out);
}

function categoryOf(traitType, map) {
  const t = norm(traitType);
  if (!t || !map || !map.categories) return null;
  // Exact synonym match first (avoid "back" stealing "background").
  for (const [cat, syns] of Object.entries(map.categories)) {
    if (cat === 'about') continue;
    if ((syns || []).some(s => t === norm(s))) return cat;
  }
  // Then whole-word / multi-word contains (syn must be longer than 3 and appear as its own token).
  for (const [cat, syns] of Object.entries(map.categories)) {
    if (cat === 'about') continue;
    if ((syns || []).some(s => {
      const n = norm(s); if (!n || n.length < 4) return false;
      if (n.includes(' ')) return t.includes(n);
      return t.split(' ').includes(n);
    })) return cat;
  }
  return null;
}

function findColour(ws, map) {
  const list = Array.isArray(ws) ? ws : words(ws);
  for (const w of list) if (map.colours[w]) return map.colours[w];
  // compound e.g. "xrpl yellow" -> yellow
  for (const w of list) for (const [name, hex] of Object.entries(map.colours)) if (w.includes(name) || name.includes(w) && w.length >= 3) return hex;
  return null;
}

/** Ensure abstract / art / missing-type specs become a playable generic capsule (never crash). */
export function ensurePlayable(spec, map = MAP) {
  if (!spec) return { type: 'generic', features: {}, colours: Object.assign({}, (map && map.fallback && map.fallback.colours) || { body: '#6a7ad8' }), tier: null, florist: false, matched: [], fallback: 'null-spec', detected: [] };
  const out = spec;
  const fb = (map && map.fallback) || { type: 'generic', colours: { body: '#6a7ad8', accent: '#7dffd8' } };
  if (!out.features) out.features = {};
  if (!out.colours) out.colours = {};
  if (!out.matched) out.matched = [];
  if (!out.detected) out.detected = [];
  // Map unknown / art -> generic playable body (capsule pipeline via avatar3d)
  if (!out.type || out.type === 'art' || out.type === 'unknown') {
    out.type = fb.type || 'generic';
    out.typeFrom = out.typeFrom || 'fallback';
    out.fallback = out.fallback || (out.florist ? 'art-palette' : 'generic');
    out.florist = !!out.florist; // keep florist flag for projector rota if previously set
    if (!out.colours.body) out.colours.body = (fb.colours && fb.colours.body) || '#6a7ad8';
    if (!out.colours.accent) out.colours.accent = (fb.colours && fb.colours.accent) || '#7dffd8';
  }
  if (out.type === 'generic') {
    // avatar3d: generic uses capsule builder
    out._avatarType = 'capsule';
  }
  if (out.type === 'armour') { delete out._avatarType; delete out.fallback; out.florist = false; }
  return out;
}

export function readTraits(meta, map = MAP) {
  try {
    map = map || MAP || { types: {}, features: {}, colours: {}, tiers: [], defaults: {}, bodyTraits: [], categories: {}, abilities: {}, fallback: { type: 'generic', colours: { body: '#6a7ad8' } } };
    const attrs = Array.isArray(meta && meta.attributes) ? meta.attributes : [];
    const vals = attrs.map(a => {
      try {
        const rawV = a && a.value;
        const vStr = rawV == null ? '' : String(rawV);
        return { t: words(a && a.trait_type), v: words(vStr), raw: a, cat: categoryOf(a && a.trait_type, map), none: NONE.test(vStr.trim()) };
      } catch { return { t: [], v: [], raw: a, cat: null, none: true }; }
    }).filter(a => !a.none);
    const valW = vals.flatMap(a => a.v), typeW = vals.flatMap(a => a.t);
    const textW = words([meta && meta.name, meta && meta.description, meta && (typeof meta.collection === 'string' ? meta.collection : (meta.collection && meta.collection.name))].join(' '));
    const out = { type: 'art', typeFrom: null, features: {}, colours: {}, tier: null, florist: false, matched: [], categoriesHit: [] };

    // Species / body type: values first, then trait types, then name text; fuzzy allowed.
    // Skip accessory slots (headwear/eyes/mouth/outfit/clothes) so "Skull Hat" never becomes type=skeleton,
    // and clothing words never override ape/bear from name/fur.
    const SKIP_TYPE_CAT = new Set(['headwear','eyewear','mask','weapon','aura','wings','neckwear','accessories','held']);
    const bodyVals = vals.filter(a => !SKIP_TYPE_CAT.has(a.cat)).flatMap(a => a.v);
    for (const [src, ws] of [['traits', bodyVals.length ? bodyVals : valW], ['trait names', typeW], ['name/description', textW]]) {
      const ty = Object.keys(map.types || {}).find(k => fuzzyHit(ws, map.types[k]));
      if (ty && ty !== 'generic') { out.type = ty; out.typeFrom = src; break; }
    }
    // Body category attribute whose value is a type keyword
    if (out.type === 'art') {
      for (const a of vals) {
        if (a.cat === 'body' || hit(a.t, (map.categories && map.categories.body) || [])) {
          const ty = Object.keys(map.types || {}).find(k => fuzzyHit(a.v, map.types[k]));
          if (ty) { out.type = ty; out.typeFrom = 'body-category'; break; }
        }
      }
    }

    // Features: prefer matching within the attribute's category slot; else global.
    // Within a slot, try longer/more-specific keys first so "Skull Hat" → skull_hat not hat,
    // "pink spikes" → hair_spiky not hat, "Red Button Up Vest" → vest not armor.
    for (const [slot, opts] of Object.entries(map.features || {})) {
      const ranked = Object.entries(opts).sort((a, b) => {
        const la = Math.max(0, ...(a[1] || []).map(k => String(k).length));
        const lb = Math.max(0, ...(b[1] || []).map(k => String(k).length));
        return lb - la;
      });
      for (const [feat, keys] of ranked) {
        if (out.features[slot]) break;
        let a = vals.find(x => fuzzyHit(x.v, keys));
        if (!a) a = vals.find(x => (x.cat === slot || hit(x.t, keys)) && fuzzyHit(x.v.concat(x.t), keys));
        if (!a) a = vals.find(x => x.cat === slot && !NONE.test(String(x.raw && x.raw.value || '')) && fuzzyHit(x.v, keys));
        if (a && !out.features[slot]) {
          let kind = feat;
          // Re-pick best kind by longest matching key in the value
          let bestLen = -1;
          for (const [f2, k2] of ranked) {
            for (const kk of (k2 || [])) {
              if (fuzzyHit(a.v, [kk]) && String(kk).length > bestLen) { bestLen = String(kk).length; kind = f2; }
            }
          }
          const c = findColour(a.v, map);
          out.features[slot] = { kind, colour: c, from: a.raw && a.raw.value };
          out.matched.push(`${slot}:${kind}`);
          out.categoriesHit.push(slot);
        }
      }
    }
    // Headwear category with unmatched value: classify by keywords — NEVER default everything to hat.
    // Hair / spikes / wraps / skulls / ears / bands first; bare leftover → generic hat only if hat-ish words.
    for (const a of vals) {
      if (a.cat === 'headwear' && !out.features.headwear && a.v.length && !fuzzyHit(a.v, ['horn','horns','antler','antlers','ram','wing','wings','winged'])) {
        const raw = String(a.raw && a.raw.value || '').toLowerCase();
        let kind = null;
        if (/skull/.test(raw)) kind = 'skull_hat';
        else if (/spike|spiky|mohawk|afro|bun|tuft|hair|ponytail|braid/.test(raw)) kind = /mohawk/.test(raw) ? 'hair_mohawk' : /afro/.test(raw) ? 'hair_afro' : /bun/.test(raw) ? 'hair_buns' : /tuft/.test(raw) ? 'hair_tufts' : /long|pony|braid/.test(raw) ? 'hair_long' : 'hair_spiky';
        else if (/bandana/.test(raw)) kind = 'bandana';
        else if (/head\s*band|sweatband/.test(raw)) kind = 'headband';
        else if (/wrap|turban|durag|do-rag/.test(raw)) kind = 'headwrap';
        else if (/halo/.test(raw)) kind = 'halo';
        else if (/\bear(s)?\b|bunny|cat ear|fox ear|animal ear/.test(raw)) kind = 'ears';
        else if (/goggle/.test(raw)) kind = 'goggles';
        else if (/eye\s*mask|domino|hero mask/.test(raw)) kind = 'eyemask';
        else if (/helmet|soldier|military|combat|army lid/.test(raw)) kind = 'helmet';
        else if (/crown|tiara|laurel/.test(raw)) kind = 'crown';
        else if (/cap|snapback|baseball/.test(raw)) kind = 'cap';
        else if (/hat|fedora|beanie|bowler|cowboy|sombrero|wizard/.test(raw)) kind = 'hat';
        // If still unknown (e.g. "None" already filtered), skip — do not invent a hat.
        if (kind) {
          out.features.headwear = { kind, colour: findColour(a.v, map), from: a.raw && a.raw.value };
          out.matched.push('headwear:' + kind);
        }
      }
      if (a.cat === 'weapon' && !out.features.weapon && a.v.length) {
        out.features.weapon = { kind: 'blade', colour: findColour(a.v, map), from: a.raw && a.raw.value };
        out.matched.push('weapon:blade');
      }
      if (a.cat === 'aura' && !out.features.aura && a.v.length) {
        out.features.aura = { kind: 'glow', colour: findColour(a.v, map), from: a.raw && a.raw.value };
        out.matched.push('aura:glow');
      }
      if (a.cat === 'wings' && !out.features.wings && a.v.length && fuzzyHit(a.v, ['wing','wings','winged','angel','bat','feather'])) {
        out.features.wings = { kind: 'wings', colour: findColour(a.v, map), from: a.raw && a.raw.value };
        out.matched.push('wings:wings');
      }
    }

    // Colours from body/palette/background traits
    for (const a of vals) {
      const c = findColour(a.v, map); if (!c) continue;
      const body = a.cat === 'colour' || a.cat === 'body' || a.t.some(w => (map.bodyTraits || []).includes(w));
      const bg = a.cat === 'background';
      if (body && !out.colours.body) out.colours.body = c;
      else if (bg && !out.colours.accent) out.colours.accent = c;
      else if (!body) out.colours.accent = out.colours.accent || c;
    }
    // Don't treat background colour words (Ice, Fire sky, etc.) as equipped aura/weapon
    for (const a of vals) {
      if (a.cat !== 'background') continue;
      if (out.features.aura && String(out.features.aura.from || '') === String(a.raw && a.raw.value || '')) delete out.features.aura;
      if (out.features.weapon && String(out.features.weapon.from || '') === String(a.raw && a.raw.value || '')) delete out.features.weapon;
    }
    out.matched = out.matched.filter(m => {
      if (m.startsWith('aura:') && !out.features.aura) return false;
      if (m.startsWith('weapon:') && !out.features.weapon) return false;
      return true;
    });

    out.colours.body = out.colours.body || (map.defaults && map.defaults[out.type]) || null;

    const tw = [...valW, ...typeW].find(w => (map.tiers || []).includes(w));
    out.tier = tw ? tw[0].toUpperCase() + tw.slice(1) : null;
    const styleKw = { anime: ['anime', 'manga', 'chibi', 'waifu'], cartoon: ['cartoon', 'toon', 'comic'], realistic: ['realistic', 'photo', 'photoreal'], '3d_art': ['3d', 'render', 'clay', 'claymation', 'felt', 'plush', 'vinyl'], pixel: ['pixel', 'pixelated', '8bit', '8-bit'] };
    const allW = [...valW, ...typeW, ...textW]; out.style = Object.keys(styleKw).find(k => hit(allW, styleKw[k])) || null; if (out.style) out.styleFrom = 'metadata';
    out.detected = detectFromMeta(meta); // step 13f: every metadata trait is a candidate feature

    // ---- Attire enrichment (generic, any NFT — never per-NFT hardcode) ----
    // Helmet style + default colours; clothing layers; bags; mouth/eyes face bits.
    {
      const hw = out.features.headwear;
      if (hw && hw.kind === 'helmet') {
        const from = String(hw.from || '').toLowerCase();
        if (/soldier|military|army|combat|camo|fatigue/.test(from)) {
          hw.style = 'army';
          if (!hw.colour) hw.colour = (map.colours && (map.colours.olive || map.colours.army || map.colours.green)) || '#5a7a3a';
          out.colours.helmet = out.colours.helmet || hw.colour;
        }
      }
      if (hw && hw.kind === 'skull_hat') {
        // Bone/grey skull — never fall through to dark helmet default
        if (!hw.colour) hw.colour = (map.colours && (map.colours.silver || map.colours.grey)) || '#c5c0b4';
        out.colours.helmet = out.colours.helmet || hw.colour;
      }
      // Eyewear colour from trait name (Retro Glasses → purple when named)
      if (out.features.eyewear && !out.features.eyewear.colour) {
        const ef = String(out.features.eyewear.from || '').toLowerCase();
        const ec = findColour(words(ef), map);
        if (ec) out.features.eyewear.colour = ec;
        else if (/retro|purple|violet|pink/.test(ef)) out.features.eyewear.colour = (map.colours && map.colours.purple) || '#8a4fd8';
      }
      // Clothes layers + bag hints
      const cl = out.features.clothes;
      if (cl) {
        const from = String(cl.from || '').toLowerCase();
        if (!cl.colour) {
          const cc = findColour(words(from), map);
          if (cc) cl.colour = cc;
        }
        // Vest/jacket always imply an under-shirt layer (collar/sleeves show in art)
        if ((cl.kind === 'vest' || cl.kind === 'jacket') && !cl.under) {
          const underCol = cl.kind === 'vest'
            ? (cl.colour || (map.colours && map.colours.red) || '#d8383a')
            : ((map.colours && map.colours.maroon) || '#7a1f2a');
          // For "Red Button Up Vest": vest body is often dark in art; red is the shirt/collar.
          if (cl.kind === 'vest' && cl.colour && /red|maroon|crimson/.test(from)) {
            cl.under = { kind: 'shirt', colour: cl.colour };
            cl.colour = '#1a1a1e'; // dark vest over coloured shirt
            cl.layer = 'vest_over_shirt';
          } else {
            cl.under = { kind: 'shirt', colour: underCol };
            cl.layer = cl.kind + '_over_shirt';
          }
        }
        // Army/camo → satchel strap (common in military attire art)
        if ((cl.kind === 'camo' || /army|military|uniform|fatigue/.test(from)) && !out.features.accessories) {
          out.features.accessories = { kind: 'satchel', colour: '#1a1a1e', from: cl.from || 'army-attire' };
          out.matched.push('accessories:satchel');
        }
        // Overalls default blue when unnamed colour (leotard/jumpsuit art often blue)
        if (cl.kind === 'overalls' && !cl.colour) {
          cl.colour = (map.colours && map.colours.blue) || '#3a6fd8';
          cl.stripe = (map.colours && map.colours.magenta) || '#d946ef';
        }
        if (cl.kind === 'overalls' && !cl.stripe && /stripe|gym|leotard/.test(from)) {
          cl.stripe = (map.colours && map.colours.magenta) || '#d946ef';
        }
      }
      // Face bits from mouth/eyes traits (moustache, clown) — used by object + character builders
      for (const a of vals) {
        const raw = String(a.raw && a.raw.value || '').toLowerCase();
        const tt = String(a.raw && a.raw.trait_type || '').toLowerCase();
        if (/mouth|face/.test(tt) && /stache|moustache|mustache|stache/.test(raw) && !out.features.mouth) {
          out.features.mouth = { kind: 'moustache', colour: '#1a1a1e', from: a.raw && a.raw.value };
          out.matched.push('mouth:moustache');
        }
        if (/eyes?/.test(tt) && /clown|red clown/.test(raw) && !out.features.eyes) {
          out.features.eyes = { kind: 'clown', colour: (map.colours && map.colours.red) || '#d8383a', from: a.raw && a.raw.value };
          out.matched.push('eyes:clown');
        }
        if ((/body|clothes|outfit|pattern/.test(tt) || fuzzyHit(a.t, ['body'])) && /polka/.test(raw)) {
          out.features.pattern = { kind: 'polka', colour: (map.colours && map.colours.blue) || '#3a6fd8', ground: (map.colours && map.colours.yellow) || '#f2c53d', from: a.raw && a.raw.value };
          out.matched.push('pattern:polka');
        }
      }
    }


    // Space-armour / ranger humanoid (Power Zerp etc.): ONLY when traits/art actually show armour.
    // Never a default/fallback. Vest/jacket/shirt/camo/suit are NOT armour.
    // Triggers: name/desc ranger/zerp cues, OR literal Helmet + Body Armor trait pair.
    {
      const armourKeys = ['zerp', 'ranger', 'sentai', 'tokusatsu', 'power zerp', 'space armour', 'space armor', 'armoured', 'armored', 'mecha suit', 'power ranger'];
      const textHit = fuzzyHit(textW, armourKeys) || fuzzyHit(valW.concat(typeW), armourKeys);
      const helmAttr = vals.find(a => /^(helmet|headwear|head gear)$/i.test(String(a.raw && a.raw.trait_type || '').trim()) || (a.cat === 'headwear' && fuzzyHit(a.t, ['helmet'])));
      const bodyArmorAttr = vals.find(a => /body\s*armou?r/i.test(String(a.raw && a.raw.trait_type || '')) || (a.cat === 'clothes' && fuzzyHit(a.t.concat(a.v), ['body armor','body armour','plate armor','plate armour'])));
      const trueArmorClothes = out.features.clothes && out.features.clothes.kind === 'armor';
      const suitPair = !!(helmAttr && bodyArmorAttr && trueArmorClothes);
      const animal = ['bean', 'capsule', 'bear', 'tiger', 'cat', 'dog', 'ape', 'bird', 'frog', 'snail', 'skeleton'].includes(out.type);
      if ((textHit || suitPair) && !animal) {
        if (out.type === 'art' || out.type === 'generic' || out.type === 'human' || out.type === 'robot' || !out.type || out.type === 'armour') {
          out.type = 'armour';
          out.typeFrom = textHit ? 'armour-name' : 'helmet+armor';
          out.florist = false;
          delete out.fallback;
          delete out._avatarType;
          if (!out.features.headwear || !String(out.features.headwear.kind || '').startsWith('hair')) {
            if (!out.features.headwear) out.features.headwear = { kind: 'helmet', colour: null, from: 'armour-default' };
            else out.features.headwear.kind = 'helmet';
          }
          out.features.clothes = { kind: 'armor', colour: (out.features.clothes && out.features.clothes.colour) || out.colours.body || null, from: (out.features.clothes && out.features.clothes.from) || 'armour-default' };
          const helmC = out.features.headwear.colour || out.colours.body || findColour((helmAttr || { v: [] }).v, map) || null;
          if (helmC) { out.features.headwear.colour = helmC; out.colours.helmet = helmC; }
          if (out.colours.body && !out.features.clothes.colour) out.features.clothes.colour = out.colours.body;
          out.colours.visor = out.colours.visor || '#0a0b0c';
          out.matched = [...new Set([...(out.matched || []), 'headwear:helmet', 'clothes:armor', 'type:armour'])];
        }
      }
    }

    // Abstract / object NFTs with a dominant mug/cup/can shape → walking object (not plain bean)
    {
      const cupAttr = vals.find(a => fuzzyHit(a.t, ['cup','mug']) || fuzzyHit(a.v, ['cup','mug','green cup']));
      const nameCup = fuzzyHit(textW, ['cup of', 'big cup', 'mug of']);
      if ((cupAttr || nameCup) && (out.type === 'art' || out.type === 'generic' || out.florist)) {
        const cupCol = findColour((cupAttr || { v: [] }).v, map) || out.colours.accent || '#3fae5a';
        const bodyCol = out.colours.body || findColour((vals.find(a => /head|body|colour|color/i.test(String(a.raw && a.raw.trait_type || ''))) || { v: [] }).v, map) || '#9b6bce';
        out.type = 'object';
        out.typeFrom = 'object-trait';
        out.florist = false;
        delete out.fallback;
        delete out._avatarType;
        out.item = { category: 'object', template: 'cup', colours: [cupCol, bodyCol], label: 'cup' };
        out.colours.body = bodyCol;
        out.colours.accent = cupCol;
        // pink spikes etc. already in headwear; keep them for buildItem adornments
        out.matched = [...new Set([...(out.matched || []), 'type:object', 'item:cup'])];
      }
    }

    // Abstract / palette-only / image-only handling
    const noSpecies = out.type === 'art';
    const hasPalette = !!(out.colours.body || out.colours.accent || vals.some(a => a.cat === 'colour' || a.cat === 'background'));
    const imageOnly = attrs.length === 0;
    if (noSpecies) {
      out.florist = true; // still eligible for florist projector
      out.fallback = imageOnly ? 'image-only' : (hasPalette ? 'palette' : 'abstract');
      // palette tint for generic body
      if (!out.colours.body) {
        const fb = map.fallback || {};
        out.colours.body = (fb.colours && fb.colours.body) || '#6a7ad8';
        out.colours.accent = out.colours.accent || (fb.colours && fb.colours.accent) || '#7dffd8';
      }
    }
    return ensurePlayable(out, map);
  } catch (e) {
    return ensurePlayable({ type: 'generic', features: {}, colours: { body: '#6a7ad8' }, tier: null, florist: false, matched: [], detected: [], fallback: 'error', error: String(e && e.message || e) }, map);
  }
}

// Preview: resolve NFT traits -> ability entries from traits_map.json abilities block (data-driven).
export function resolveAbilities(spec, map = MAP) {
  const A = (map && map.abilities) || {};
  const bag = [];
  const push = (e, from) => { if (!e || e === 'about' || typeof e !== 'object') return; if (bag.some(x => x.id === e.id)) return; bag.push(Object.assign({}, e, { from })); };
  const text = JSON.stringify([(spec && spec.features) || {}, (spec && spec.detected) || [], (spec && spec.matched) || [], (spec && spec.wearables) || []]).toLowerCase();
  const vals = (((spec && spec.detected) || []).map(d => String(d.name || d).toLowerCase())).join(' ');
  const blob = text + ' ' + vals;
  const F = (spec && spec.features) || {};
  for (const [id, e] of Object.entries(A)) {
    if (!e || !e.keys || id === 'about') continue;
    let hitK = false;
    try { hitK = e.keys.some(k => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`).test(blob)); } catch { hitK = false; }
    const featHit = (
      (id === 'hat' && F.headwear) ||
      (id === 'wings' && F.wings) ||
      (id === 'laser_eyes' && F.eyes && /laser|beam/.test(JSON.stringify(F.eyes).toLowerCase())) ||
      (id === 'horns' && (F.horns || (spec.detected || []).some(d => /horn|antler|ram/i.test(d.name || '')))) ||
      (id === 'aura' && F.aura) ||
      (id === 'weapon' && F.weapon)
    );
    if (hitK || featHit) push(e, hitK ? 'keyword' : 'feature');
  }
  return bag;
}
