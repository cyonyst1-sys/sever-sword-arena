// Cosmetics: what the shop sells, what you own and wear, and how many coins you have.
// Everything is looks only: no item changes reach, speed or damage.
//
// Masks and headwear are lists of simple convex parts in head space (x right, y up, -z is the face;
// the head is about 0.2 wide and 0.24 tall), so they get sliced like the rest of the body.
// A part: [shape, material, [x, y, z], [sx, sy, sz], [rx, ry, rz]?]. Shapes: box, sph, cyl, cone.
// A material: { c: colour, m: metalness, r: roughness, e: glow colour, ei: glow strength }.

const PI = Math.PI;
const mat = (c, o = {}) => ({ c, m: 0, r: 0.6, ...o });
const IVORY = mat(0xeee6d2, { r: 0.45 }), BLACK = mat(0x0c0c0e, { r: 0.5 }), GOLD = mat(0xd9ad3c, { m: 0.85, r: 0.3 }), RED = mat(0xb3191f, { r: 0.45, e: 0x300000, ei: 1 });
const pair = (part) => [part(1), part(-1)]; // left and right copies of a part (side = 1 or -1)

export const CATEGORIES = [
  { id: 'mask', name: 'Masks' },
  { id: 'hat', name: 'Headwear' },
  { id: 'outfit', name: 'Outfits' },
  { id: 'sword', name: 'Swords' },
  { id: 'trail', name: 'Trails' },
  { id: 'kill', name: 'Kill Effects' },
  { id: 'grapple', name: 'Grapples' },
];

export const CATALOG = {
  mask: [
    { id: 'none', name: 'Bare face', price: 0, sw: 0xe0b48c, parts: [] },
    { id: 'wrap', name: 'Shinobi Wrap', price: 150, sw: 0x1b1b22, hide: ['nose'], parts: [['cyl', mat(0x1b1b22, { r: 0.9 }), [0, -0.052, -0.004], [0.108, 0.072, 0.124]]] },
    { id: 'menpo', name: 'Iron Menpo', price: 300, sw: 0x2b2d33, hide: ['nose'], parts: [
      ['box', mat(0x2b2d33, { m: 0.7, r: 0.35 }), [0, -0.062, -0.096], [0.15, 0.095, 0.06]],
      ['box', mat(0x2b2d33, { m: 0.7, r: 0.35 }), [0, -0.13, -0.06], [0.14, 0.04, 0.07]],
      ...pair((s) => ['box', GOLD, [0.022 * s, -0.032, -0.128], [0.04, 0.009, 0.008], [0, 0, -0.3 * s]]),
    ] },
    { id: 'tengu', name: 'Tengu', price: 350, sw: 0xc0262c, hide: ['nose', 'eyeL', 'eyeR', 'browL', 'browR'], parts: [
      ['box', RED, [0, -0.005, -0.1], [0.155, 0.185, 0.05]],
      ['cone', RED, [0, -0.005, -0.2], [0.024, 0.17, 0.024], [-PI / 2, 0, 0]],
      ...pair((s) => ['box', BLACK, [0.038 * s, 0.025, -0.127], [0.034, 0.012, 0.006]]),
      ...pair((s) => ['box', GOLD, [0.04 * s, 0.05, -0.127], [0.045, 0.01, 0.006], [0, 0, 0.25 * s]]),
    ] },
    { id: 'oni', name: 'Oni', price: 400, sw: 0xb3191f, hide: ['nose', 'eyeL', 'eyeR', 'browL', 'browR'], parts: [
      ['box', RED, [0, -0.005, -0.1], [0.16, 0.19, 0.05]],
      ...pair((s) => ['cone', IVORY, [0.055 * s, 0.115, -0.085], [0.022, 0.085, 0.022], [0.2, 0, -0.35 * s]]),
      ...pair((s) => ['box', BLACK, [0.038 * s, 0.02, -0.127], [0.036, 0.016, 0.006], [0, 0, -0.2 * s]]),
      ...pair((s) => ['box', IVORY, [0.026 * s, -0.074, -0.128], [0.012, 0.026, 0.01]]),
      ['box', BLACK, [0, -0.058, -0.127], [0.075, 0.012, 0.006]],
    ] },
    { id: 'kitsune', name: 'Kitsune', price: 450, sw: 0xf4f1ea, hide: ['nose', 'eyeL', 'eyeR', 'browL', 'browR'], parts: [
      ['box', IVORY, [0, 0, -0.098], [0.15, 0.17, 0.05]],
      ['cone', IVORY, [0, -0.035, -0.15], [0.034, 0.07, 0.03], [-PI / 2, 0, 0]],
      ...pair((s) => ['cone', IVORY, [0.06 * s, 0.13, -0.03], [0.03, 0.065, 0.02], [0, 0, -0.25 * s]]),
      ...pair((s) => ['box', mat(0xd7262e), [0.045 * s, 0.038, -0.125], [0.042, 0.01, 0.004], [0, 0, 0.45 * s]]),
      ...pair((s) => ['box', BLACK, [0.036 * s, 0.018, -0.126], [0.03, 0.01, 0.005], [0, 0, 0.3 * s]]),
    ] },
    { id: 'skull', name: 'Skull', price: 500, sw: 0xe6dcc4, hide: ['nose', 'eyeL', 'eyeR', 'browL', 'browR'], parts: [
      ['box', IVORY, [0, 0.012, -0.098], [0.15, 0.15, 0.05]],
      ['box', IVORY, [0, -0.085, -0.09], [0.11, 0.05, 0.05]],
      ...pair((s) => ['box', BLACK, [0.037 * s, 0.02, -0.125], [0.04, 0.036, 0.006]]),
      ['box', BLACK, [0, -0.022, -0.125], [0.016, 0.026, 0.006]],
      ['box', BLACK, [0, -0.07, -0.117], [0.08, 0.006, 0.006]],
    ] },
    { id: 'hannya', name: 'Hannya', price: 650, sw: 0xe9e2cf, hide: ['nose', 'eyeL', 'eyeR', 'browL', 'browR'], parts: [
      ['box', mat(0xe9e2cf, { r: 0.4 }), [0, 0, -0.1], [0.16, 0.19, 0.05]],
      ...pair((s) => ['cone', GOLD, [0.06 * s, 0.13, -0.07], [0.02, 0.13, 0.02], [0.35, 0, -0.5 * s]]),
      ...pair((s) => ['box', mat(0xc8d84a, { e: 0x9aa020, ei: 1.2 }), [0.038 * s, 0.022, -0.127], [0.034, 0.014, 0.006], [0, 0, -0.3 * s]]),
      ['box', mat(0x9a0f18), [0, -0.062, -0.127], [0.09, 0.03, 0.006]],
      ...pair((s) => ['box', IVORY, [0.03 * s, -0.062, -0.13], [0.012, 0.03, 0.006]]),
    ] },
    { id: 'void', name: 'Void Mask', price: 1000, sw: 0x5fe3ff, hide: ['nose', 'eyeL', 'eyeR', 'browL', 'browR'], parts: [
      ['box', mat(0x0a0a10, { m: 0.6, r: 0.15 }), [0, 0, -0.1], [0.155, 0.19, 0.05]],
      ...pair((s) => ['box', mat(0x5fe3ff, { e: 0x5fe3ff, ei: 3 }), [0.04 * s, 0.022, -0.127], [0.045, 0.01, 0.006], [0, 0, -0.15 * s]]),
      ['box', mat(0x5fe3ff, { e: 0x5fe3ff, ei: 3 }), [0, -0.04, -0.127], [0.006, 0.07, 0.006]],
    ] },
  ],
  hat: [
    { id: 'none', name: 'Topknot', price: 0, sw: 0x141414, parts: [] },
    { id: 'hachimaki', name: 'Hachimaki', price: 100, sw: 0xf4f4f0, hide: ['band'], parts: [
      ['cyl', mat(0xf4f4f0, { r: 0.85 }), [0, 0.035, 0], [0.108, 0.03, 0.12]],
      ['cyl', mat(0xd7262e), [0, 0.035, -0.122], [0.022, 0.004, 0.022], [PI / 2, 0, 0]],
      ...pair((s) => ['box', mat(0xf4f4f0, { r: 0.85 }), [0.022 * s, -0.01, 0.13], [0.022, 0.09, 0.008], [0.45, 0, 0.25 * s]]),
    ] },
    { id: 'ponytail', name: 'Long Ponytail', price: 120, sw: 0x2a1a10, parts: [['cyl', mat(0x141414, { r: 0.9 }), [0, 0.02, 0.15], [0.026, 0.2, 0.026], [0.55, 0, 0]]] },
    { id: 'hood', name: 'Shinobi Hood', price: 200, sw: 0x23232c, hide: ['hair', 'knot', 'band', 'earL', 'earR'], parts: [['sph', mat(0x23232c, { r: 0.9 }), [0, 0.022, 0.03], [0.116, 0.142, 0.12]]] },
    { id: 'horns', name: 'Demon Horns', price: 250, sw: 0x5a0d12, parts: pair((s) => ['cone', mat(0x3a0a0e, { r: 0.4 }), [0.062 * s, 0.12, 0], [0.026, 0.12, 0.026], [0, 0, -0.45 * s]]) },
    { id: 'kasa', name: 'Straw Kasa', price: 300, sw: 0xc9a868, hide: ['knot'], parts: [
      ['cone', mat(0xc9a868, { r: 0.95 }), [0, 0.155, 0], [0.34, 0.13, 0.34]],
      ['cyl', mat(0x6b4a2c, { r: 0.9 }), [0, 0.1, 0], [0.11, 0.02, 0.12]],
    ] },
    { id: 'kabuto', name: 'Kabuto Helmet', price: 750, sw: 0x23252b, hide: ['hair', 'knot', 'band'], parts: [
      ['sph', mat(0x23252b, { m: 0.75, r: 0.35 }), [0, 0.075, 0.01], [0.122, 0.095, 0.128]],
      ['cyl', mat(0x23252b, { m: 0.75, r: 0.35 }), [0, 0.045, 0.01], [0.15, 0.012, 0.155]],
      ['box', mat(0x23252b, { m: 0.75, r: 0.35 }), [0, -0.03, 0.1], [0.2, 0.08, 0.05], [0.45, 0, 0]],
      ...pair((s) => ['box', GOLD, [0.045 * s, 0.17, -0.1], [0.022, 0.15, 0.006], [0, 0, -0.45 * s]]),
      ['cyl', GOLD, [0, 0.09, -0.125], [0.025, 0.006, 0.025], [PI / 2, 0, 0]],
    ] },
    { id: 'embercrown', name: 'Ember Crown', price: 1200, sw: 0xff7a1a, hide: ['knot'], parts: [
      ['cyl', GOLD, [0, 0.105, 0.005], [0.1, 0.025, 0.11]],
      ...[0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * PI * 2; return ['cone', mat(0xff8a2a, { e: 0xff5a00, ei: 2.2 }), [Math.sin(a) * 0.085, 0.16, Math.cos(a) * 0.09], [0.02, 0.08, 0.02]]; }),
    ] },
  ],
  // gi (jacket), trim (collar, belt, shoulder pads) and trousers. "Team colour" keeps your colour in the match.
  outfit: [
    { id: 'default', name: 'Team Colour', price: 0, sw: 0xd63a3a },
    { id: 'snow', name: 'Snowfield', price: 150, sw: 0xf2f2f0, gi: 0xf2f2f0, trim: 0xb8c2cc, pants: 0x8f99a3 },
    { id: 'shadow', name: 'Shadow', price: 200, sw: 0x1d1d24, gi: 0x1d1d24, trim: 0x3b3b48, pants: 0x121216 },
    { id: 'sakura', name: 'Sakura', price: 250, sw: 0xf4a6c4, gi: 0xf4a6c4, trim: 0xffffff, pants: 0x5a3a4a },
    { id: 'jade', name: 'Jade Warden', price: 300, sw: 0x2f8f5b, gi: 0x2f8f5b, trim: 0xd4af37, pants: 0x1f3a2c },
    { id: 'ocean', name: 'Tidecaller', price: 300, sw: 0x1e3f8a, gi: 0x1e3f8a, trim: 0x40d0d0, pants: 0x14203a },
    { id: 'crimson', name: 'Crimson Lord', price: 350, sw: 0x7c1018, gi: 0x7c1018, trim: 0xd4af37, pants: 0x1c1214 },
    { id: 'ember', name: 'Ash & Ember', price: 350, sw: 0xff7a1a, gi: 0x3a3a3a, trim: 0xff7a1a, pants: 0x222222 },
    { id: 'royal', name: 'Royal Violet', price: 400, sw: 0x5b2a8c, gi: 0x5b2a8c, trim: 0xe6c35c, pants: 0x221533 },
    { id: 'emperor', name: 'Golden Emperor', price: 900, sw: 0xd9a92b, gi: 0xd9a92b, trim: 0x111111, pants: 0x3a2a10 },
  ],
  // blade colour and finish, glow, width (w) and thickness (t) multipliers, guard and grip colours
  sword: [
    { id: 'katana', name: 'Steel Katana', price: 0, sw: 0xdfe6ee, blade: mat(0xdfe6ee, { m: 0.9, r: 0.18 }), guard: 0xc9a24a, grip: 0x2a1d14 },
    { id: 'needle', name: 'Needle', price: 200, sw: 0xf2f4f7, w: 0.55, blade: mat(0xf2f4f7, { m: 1, r: 0.1 }), guard: 0x9aa4ae, grip: 0x1a1a1a },
    { id: 'bone', name: 'Bone Blade', price: 300, sw: 0xe8dfc8, w: 1.2, t: 1.6, blade: mat(0xe8dfc8, { r: 0.75 }), guard: 0x6b4a2c, grip: 0x3a2a1a },
    { id: 'cleaver', name: 'Cleaver', price: 400, sw: 0xb9c0c8, w: 2.1, t: 1.6, blade: mat(0xb9c0c8, { m: 0.8, r: 0.4 }), guard: 0x3a3a3a, grip: 0x2a1d14 },
    { id: 'jade', name: 'Jade Edge', price: 450, sw: 0x3fbf7f, blade: mat(0x3fbf7f, { m: 0.3, r: 0.2, e: 0x0a5a30, ei: 1 }), guard: 0xd4af37, grip: 0x123322 },
    { id: 'gold', name: 'Gilded', price: 500, sw: 0xffd34d, blade: mat(0xffd34d, { m: 1, r: 0.22 }), guard: 0x1a1a1a, grip: 0x5a0d12 },
    { id: 'obsidian', name: 'Obsidian', price: 600, sw: 0x16161a, w: 1.15, blade: mat(0x111114, { m: 0.7, r: 0.12, e: 0x3a0000, ei: 1 }), guard: 0x8a0d16, grip: 0x111111 },
    { id: 'frost', name: 'Frostbite', price: 700, sw: 0xbfeaff, blade: mat(0xbfeaff, { m: 0.4, r: 0.1, e: 0x3aa0ff, ei: 0.9 }), guard: 0xe6f4ff, grip: 0x1e3f8a },
    { id: 'blood', name: 'Bloodmoon', price: 800, sw: 0xd61a2a, blade: mat(0x8a0d16, { m: 0.5, r: 0.2, e: 0xff1a2a, ei: 1.1 }), guard: 0x111111, grip: 0x3a0a0e },
    { id: 'void', name: 'Void Edge', price: 1200, sw: 0x9b51ff, blade: mat(0x0b0614, { m: 0.6, r: 0.15, e: 0x9b51ff, ei: 1.8 }), guard: 0x2a1a40, grip: 0x0b0614 },
  ],
  // inner and outer trail colours, and an effect: rainbow, ember, petal or zap
  trail: [
    { id: 'classic', name: 'Classic', price: 0, sw: 0xffffff, a: 0x99a6b3, b: 0xffffff },
    { id: 'crimson', name: 'Crimson', price: 150, sw: 0xff2a3a, a: 0x991020, b: 0xff3a4a },
    { id: 'azure', name: 'Azure', price: 150, sw: 0x3a9bff, a: 0x1a4a99, b: 0x5ab0ff },
    { id: 'emerald', name: 'Emerald', price: 150, sw: 0x2fe07f, a: 0x0f7a3a, b: 0x5af09a },
    { id: 'gold', name: 'Gold', price: 200, sw: 0xffc23d, a: 0x996a10, b: 0xffd65a },
    { id: 'violet', name: 'Violet', price: 200, sw: 0xa060ff, a: 0x4a1a99, b: 0xb07aff },
    { id: 'shadow', name: 'Shadow', price: 300, sw: 0x3a1a6a, a: 0x1a0830, b: 0x5a2aa0 },
    { id: 'rainbow', name: 'Rainbow', price: 600, sw: 0xff5ad0, a: 0xffffff, b: 0xffffff, fx: 'rainbow' },
    { id: 'ember', name: 'Ember', price: 700, sw: 0xff7a1a, a: 0xa03a00, b: 0xffa040, fx: 'ember' },
    { id: 'sakura', name: 'Sakura Petals', price: 700, sw: 0xffb7d5, a: 0xa04a70, b: 0xffc8e0, fx: 'petal' },
    { id: 'lightning', name: 'Lightning', price: 900, sw: 0x9fe8ff, a: 0x2a7aff, b: 0xcff4ff, fx: 'zap' },
  ],
  // what happens to someone you cut down (see killfx.js)
  kill: [
    { id: 'blood', name: 'Classic', price: 0, sw: 0x8a0a10 },
    { id: 'sakura', name: 'Sakura Burst', price: 400, sw: 0xffb7d5 },
    { id: 'ink', name: 'Ink Strike', price: 450, sw: 0x15151c },
    { id: 'smoke', name: 'Smoke Vanish', price: 450, sw: 0x9a9a9a },
    { id: 'gold', name: 'Gold Rush', price: 500, sw: 0xffc23d },
    { id: 'ember', name: 'Ember Ash', price: 650, sw: 0xff6a1a },
    { id: 'frozen', name: 'Frozen', price: 700, sw: 0xbfe8ff },
    { id: 'lightning', name: 'Lightning Strike', price: 800, sw: 0x9fe8ff },
    { id: 'void', name: 'Void Rift', price: 1000, sw: 0x9b51ff },
  ],
  // your grappling hook: the line (colour, thickness, pattern, glow) and the head (see grapple.js)
  grapple: [
    { id: 'rope', name: 'Rope', price: 0, sw: 0x2a2a2a, c: 0x1c1c1c, r: 0.018, head: 'claw' },
    { id: 'chain', name: 'Iron Chain', price: 300, sw: 0x5a5f66, c: 0x8a9099, r: 0.03, tex: 'chain', head: 'hook' },
    { id: 'vine', name: 'Jungle Vine', price: 300, sw: 0x3f8a3a, c: 0x4a8f3a, r: 0.028, tex: 'vine', head: 'leaf' },
    { id: 'kunai', name: 'Kunai Line', price: 350, sw: 0xc0262c, c: 0xc0262c, r: 0.011, head: 'kunai' },
    { id: 'shadow', name: 'Shadow Tether', price: 500, sw: 0x1a1022, c: 0x0b0610, r: 0.022, smoke: true, head: 'shadow' },
    { id: 'spirit', name: 'Spirit Thread', price: 600, sw: 0x5fd0ff, c: 0x5fd0ff, r: 0.02, glow: true, head: 'orb' },
    { id: 'lightning', name: 'Lightning Whip', price: 800, sw: 0xbff0ff, c: 0x6ac8ff, r: 0.016, glow: true, bolt: true, head: 'spark' },
    { id: 'dragon', name: 'Dragon Tail', price: 900, sw: 0xd9ad3c, c: 0xd9ad3c, r: 0.04, tex: 'scales', head: 'dragon' },
  ],
};

export const DEFAULT_LOOK = { mask: 'none', hat: 'none', outfit: 'default', sword: 'katana', trail: 'classic', kill: 'blood', grapple: 'rope' };
export const item = (cat, id) => CATALOG[cat].find((x) => x.id === id) || CATALOG[cat][0];
/** Keep only real item ids (used on looks arriving over the network). */
export function cleanLook(look) {
  const out = { ...DEFAULT_LOOK };
  if (look && typeof look === 'object') for (const c of Object.keys(DEFAULT_LOOK)) if (CATALOG[c].some((x) => x.id === look[c])) out[c] = look[c];
  return out;
}
/** A random look for a bot: most wear a few things, some go plain. */
export function randomLook() {
  const pick = (c, p) => (Math.random() < p ? CATALOG[c][1 + Math.floor(Math.random() * (CATALOG[c].length - 1))].id : CATALOG[c][0].id);
  return { mask: pick('mask', 0.5), hat: pick('hat', 0.5), outfit: pick('outfit', 0.35), sword: pick('sword', 0.45), trail: pick('trail', 0.5), kill: pick('kill', 0.35), grapple: pick('grapple', 0.4) };
}

// ---------- your profile: coins, what you own, what you wear (kept in this browser) ----------
const KEY = 'sever.shop';
const START_COINS = 150;
export const profile = (() => {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* no storage */ }
  if (!p || typeof p !== 'object') p = {};
  p.coins = Math.max(0, Math.floor(+p.coins || (p.coins === 0 ? 0 : START_COINS)));
  p.owned = Array.isArray(p.owned) ? p.owned : [];
  p.equip = cleanLook(p.equip);
  return p;
})();
export function saveProfile() { try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* private mode */ } }
export const owns = (cat, id) => item(cat, id).price === 0 || profile.owned.includes(cat + ':' + id);
export function buy(cat, id) {
  const it = item(cat, id);
  if (owns(cat, id) || profile.coins < it.price) return false;
  profile.coins -= it.price; profile.owned.push(cat + ':' + id); saveProfile(); return true;
}
export function equip(cat, id) { if (!owns(cat, id)) return false; profile.equip[cat] = id; saveProfile(); return true; }
export function addCoins(n) { profile.coins += Math.max(0, Math.round(n)); saveProfile(); }
