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
const TENGU = mat(0x8e1c26, { r: 0.7, e: 0x1c0204, ei: 1 }), CHAR = mat(0x2a2228, { r: 0.6 });
const pair = (part) => [part(1), part(-1)]; // left and right copies of a part (side = 1 or -1)

export const CATEGORIES = [
  { id: 'mask', name: 'Masks' },
  { id: 'hat', name: 'Headwear' },
  { id: 'outfit', name: 'Outfits' },
  { id: 'sword', name: 'Weapons' },
  { id: 'trail', name: 'Trails' },
  { id: 'kill', name: 'Kill Effects' },
  { id: 'grapple', name: 'Grapples' },
  { id: 'shape', name: 'Sword Shapes' },
  { id: 'upgrade', name: 'Upgrades' },
];

// ---------- permanent upgrades: very small stat boosts, 5 levels each, bought with coins (bots never get them) ----------
// per: the change per level (a fraction); less: true when the number goes down (cooldowns, waits)
export const UPGRADES = [
  { id: 'blade', name: 'Long Blade', desc: 'Your sword starts longer', per: 0.02, what: 'length' },
  { id: 'speed', name: 'Swift Feet', desc: 'Faster running', per: 0.015, what: 'speed' },
  { id: 'dash', name: 'Quick Dash', desc: 'Dash recharges sooner', per: 0.05, what: 'cooldown', less: true },
  { id: 'jump', name: 'Spring Step', desc: 'Higher jumps', per: 0.02, what: 'height' },
  { id: 'air', name: 'Air Control', desc: 'Better steering in the air', per: 0.03, what: 'steering' },
  { id: 'stamina', name: 'Endurance', desc: 'Stamina refills faster (more dashes)', per: 0.05, what: 'refill' },
  { id: 'reel', name: 'Strong Reel', desc: 'Your grapple pulls you in faster', per: 0.03, what: 'pull' },
  { id: 'rope', name: 'Long Rope', desc: 'Your grapple reaches farther', per: 0.03, what: 'range' },
  { id: 'hands', name: 'Quick Hands', desc: 'Faster sword swings', per: 0.03, what: 'swing speed' },
  { id: 'steady', name: 'Steady Stance', desc: 'Recover sooner after a clash', per: 0.05, what: 'stun time', less: true },
  { id: 'respawn', name: 'Second Wind', desc: 'Respawn sooner after dying', per: 0.06, what: 'wait', less: true },
  { id: 'bounty', name: 'Bounty', desc: 'More coins from every match', per: 0.05, what: 'coins' },
];
export const UP_MAX = 5, UP_PRICES = [600, 1000, 1500, 2100, 2800];
/** Keep only real upgrade levels, 0..5 (used on levels arriving over the network too). */
export function cleanUp(u) { const o = {}; for (const x of UPGRADES) o[x.id] = Math.max(0, Math.min(UP_MAX, Math.floor(+(u && u[x.id]) || 0))); return o; }
/** The multiplier an upgrade at level L gives: 1 + per*L, or 1 - per*L for cooldowns and waits. */
export const upMul = (id, L) => { const x = UPGRADES.find((u) => u.id === id); return !x || !L ? 1 : x.less ? 1 - x.per * L : 1 + x.per * L; };
export const upText = (x, L) => `${x.less ? '−' : '+'}${Math.round(x.per * L * 1000) / 10}% ${x.what}`;

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
      // a carved wooden tengu: a rounded crimson face with a heavy brow, a long nose carved as a wedge (a ridge along the top,
      // a flat underside with the nostrils, tapering to a blunt end that dips a little), high cheekbones, gold eyes in dark
      // sockets, curled charcoal eyebrows, a drooping moustache, a frown, and a pointed goatee
      ['sph', TENGU, [0, 0, -0.072], [0.088, 0.112, 0.066]], ['sph', TENGU, [0, -0.088, -0.082], [0.052, 0.042, 0.044]], ['sph', TENGU, [0, 0.046, -0.112], [0.078, 0.024, 0.032]],
      ...pair((s) => ['sph', TENGU, [0.06 * s, -0.02, -0.092], [0.034, 0.022, 0.026], [0, 0, 0.35 * s]]), // cheekbones, high and out to the sides
      ['tnose', TENGU, [0, -0.02, -0.168], [0.034, 0.092, 0.036], [-PI / 2 - 0.16, 0, 0]], ...pair((s) => ['sph', CHAR, [0.012 * s, -0.043, -0.14], [0.007, 0.003, 0.009]]), // the nose: a carved wedge with a ridge along the top, jutting forward and down; the nostrils under it
      ...pair((s) => ['sph', CHAR, [0.037 * s, 0.017, -0.123], [0.025, 0.015, 0.012]]), ...pair((s) => ['sph', GOLD, [0.037 * s, 0.016, -0.13], [0.0135, 0.011, 0.008]]), ...pair((s) => ['sph', BLACK, [0.037 * s, 0.016, -0.1365], [0.0055, 0.0055, 0.003]]),
      ...pair((s) => ['box', CHAR, [0.041 * s, 0.054, -0.138], [0.05, 0.014, 0.012], [0, 0, 0.32 * s]]), ...pair((s) => ['sph', CHAR, [0.068 * s, 0.067, -0.134], [0.014, 0.014, 0.009]]), ...pair((s) => ['sph', CHAR, [0.016 * s, 0.045, -0.141], [0.012, 0.012, 0.009]]),
      ...pair((s) => ['box', CHAR, [0.03 * s, -0.05, -0.133], [0.046, 0.011, 0.01], [0, 0, -0.38 * s]]), ...pair((s) => ['sph', CHAR, [0.054 * s, -0.061, -0.128], [0.009, 0.009, 0.007]]),
      ['box', mat(0x3a0c12, { r: 0.6 }), [0, -0.074, -0.124], [0.05, 0.008, 0.008]], ['cone', CHAR, [0, -0.14, -0.105], [0.015, 0.075, 0.013], [PI, 0, 0]],
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

export const DEFAULT_LOOK = { mask: 'none', hat: 'none', outfit: 'default', sword: 'katana', shape: 'straight', trail: 'classic', kill: 'blood', grapple: 'rope' };
export const item = (cat, id) => CATALOG[cat].find((x) => x.id === id) || CATALOG[cat][0];

// ---------- the expansion: more of everything, and a new top tier (Legendary) in every tab ----------
/** Rarity by price: Common, Rare, Epic, Legendary. */
export const tierOf = (price) => (price >= 1500 ? 'legendary' : price >= 800 ? 'epic' : price >= 300 ? 'rare' : 'common');
// a horn that curves: a thick base cone and a thinner tip cone bent further over (side s = 1 or -1)
const horn = (m, x, y, z, s, len, lean, curl, w = 0.022) => [
  ['cone', m, [x * s, y, z], [w, len * 0.55, w], [0.15, 0, -lean * s]],
  ['cone', m, [(x + Math.sin(lean) * len * 0.5) * s, y + Math.cos(lean) * len * 0.48, z + 0.01], [w * 0.62, len * 0.55, w * 0.62], [0.15 + curl * 0.3, 0, -(lean + curl) * s]],
];
const fang = (m, x, y, z, len, up = false, w = 0.009) => ['cone', m, [x, y, z], [w, len, w], [up ? 0 : PI, 0, 0]];
const glow = (c, i = 2.6) => mat(c, { e: c, ei: i });
const LACQ = (c) => mat(c, { r: 0.28, m: 0.15 });

// ---- more detail on the original masks
const add = (cat, id, parts) => item(cat, id).parts.push(...parts);
add('mask', 'wrap', [['box', mat(0x0e0e12), [0, -0.028, -0.124], [0.12, 0.005, 0.004]], ...pair((s) => ['box', mat(0x1b1b22, { r: 0.9 }), [0.03 * s, -0.04, 0.13], [0.018, 0.08, 0.006], [0.5, 0, 0.3 * s]])]);
add('mask', 'menpo', [...pair((s) => ['box', GOLD, [0.03 * s, -0.09, -0.13], [0.03, 0.006, 0.006], [0, 0, 0.5 * s]]), ...pair((s) => fang(IVORY, 0.018 * s, -0.098, -0.128, 0.018)), ['box', mat(0x1a1b20, { m: 0.7 }), [0, -0.16, -0.05], [0.09, 0.03, 0.05]]]);
add('mask', 'oni', [...pair((s) => fang(IVORY, 0.03 * s, -0.096, -0.128, 0.03, true)), ...pair((s) => ['box', GOLD, [0.04 * s, 0.05, -0.128], [0.05, 0.012, 0.006], [0, 0, 0.3 * s]]), ...pair((s) => ['sph', BLACK, [0.012 * s, -0.03, -0.13], [0.008, 0.006, 0.004]])]);
add('mask', 'kitsune', [...[-1, 1].flatMap((s) => [0, 1, 2].map((k) => ['box', BLACK, [0.05 * s, -0.04 - k * 0.012, -0.128], [0.05, 0.002, 0.002], [0, 0, (0.15 - k * 0.15) * s]])), ['box', mat(0xd7262e), [0, -0.075, -0.127], [0.03, 0.006, 0.004]], ['cone', mat(0xd7262e), [0, 0.07, -0.126], [0.012, 0.03, 0.004]]]);
add('mask', 'skull', [...[-3, -2, -1, 0, 1, 2, 3].map((k) => ['box', IVORY, [k * 0.012, -0.075, -0.127], [0.008, 0.016, 0.006]]), ['box', BLACK, [0.03, 0.06, -0.125], [0.004, 0.04, 0.004], [0, 0, 0.5]], ['box', BLACK, [0.04, 0.03, -0.125], [0.004, 0.03, 0.004], [0, 0, -0.4]]]);
add('mask', 'hannya', [...pair((s) => ['cone', GOLD, [0.1 * s, 0.24, -0.04], [0.012, 0.08, 0.012], [0.6, 0, -1.0 * s]]), ...pair((s) => fang(IVORY, 0.03 * s, -0.08, -0.131, 0.028, true))]);
add('mask', 'void', [...pair((s) => ['box', glow(0x5fe3ff, 2), [0.055 * s, -0.04, -0.127], [0.004, 0.08, 0.004], [0, 0, 0.35 * s]]), ['cyl', glow(0x5fe3ff, 2), [0, 0.07, -0.127], [0.016, 0.003, 0.016], [PI / 2, 0, 0]]]);

// ---- new masks: scarier, more horns, fangs
const FACE = ['nose', 'eyeL', 'eyeR', 'browL', 'browR'];
CATALOG.mask.push(
  { id: 'crowtengu', name: 'Crow Tengu', price: 900, sw: 0x15151a, hide: FACE, parts: [
    ['box', LACQ(0x15151a), [0, 0, -0.1], [0.155, 0.185, 0.05]],
    ['cone', LACQ(0x22222a), [0, 0.0, -0.18], [0.03, 0.13, 0.026], [-PI / 2 - 0.12, 0, 0]], ['cone', GOLD, [0, -0.03, -0.165], [0.022, 0.09, 0.016], [-PI / 2 + 0.1, 0, 0]], // a crow's beak
    ...pair((s) => ['box', glow(0xff2a2a), [0.04 * s, 0.03, -0.127], [0.03, 0.012, 0.006], [0, 0, -0.3 * s]]),
    ...pair((s) => ['cone', LACQ(0x15151a), [0.085 * s, 0.03, -0.06], [0.02, 0.09, 0.008], [0, 0, -1.2 * s]]), ...pair((s) => ['cone', LACQ(0x15151a), [0.085 * s, -0.02, -0.06], [0.018, 0.08, 0.008], [0, 0, -1.6 * s]]), // feathers
  ] },
  { id: 'bloodoni', name: 'Blood Oni', price: 1100, sw: 0x8a0a10, hide: FACE, parts: [
    ['box', LACQ(0x8a0a10), [0, -0.005, -0.1], [0.165, 0.195, 0.05]],
    ['cone', IVORY, [0, 0.14, -0.08], [0.02, 0.1, 0.02], [0.15, 0, 0]], ...[1, -1].flatMap((s) => horn(IVORY, 0.06, 0.12, -0.08, s, 0.11, 0.4, 0.3)),
    ...pair((s) => ['box', glow(0xffd23a), [0.038 * s, 0.022, -0.127], [0.036, 0.016, 0.006], [0, 0, -0.3 * s]]),
    ['box', BLACK, [0, -0.06, -0.127], [0.09, 0.03, 0.006]], ...[-1, 1].flatMap((s) => [fang(IVORY, 0.03 * s, -0.045, -0.13, 0.028), fang(IVORY, 0.02 * s, -0.075, -0.13, 0.03, true)]),
  ] },
  { id: 'tusk', name: 'Tusk Demon', price: 1300, sw: 0x2a4a2a, hide: FACE, parts: [
    ['box', LACQ(0x2a4a2a), [0, -0.005, -0.1], [0.165, 0.2, 0.05]],
    ...[1, -1].flatMap((s) => horn(mat(0x1a1a1a, { r: 0.4 }), 0.055, 0.12, -0.07, s, 0.08, 0.5, 0.2, 0.016)),
    ...pair((s) => ['box', glow(0xff3a1a), [0.04 * s, 0.025, -0.127], [0.038, 0.014, 0.006], [0, 0, -0.35 * s]]),
    ...[1, -1].flatMap((s) => horn(IVORY, 0.05, -0.1, -0.13, s, 0.12, -0.3, -0.5, 0.016)), // tusks curling up out of the jaw
    ['box', BLACK, [0, -0.065, -0.127], [0.1, 0.02, 0.006]],
  ] },
  { id: 'oniking', name: 'Oni King', price: 1800, sw: 0xd9ad3c, hide: FACE, parts: [
    ['box', LACQ(0x1a0a0a), [0, -0.005, -0.1], [0.17, 0.2, 0.052]],
    ...[1, -1].flatMap((s) => horn(GOLD, 0.06, 0.12, -0.07, s, 0.17, 0.45, 0.45, 0.026)), ...[1, -1].flatMap((s) => horn(IVORY, 0.07, 0.07, -0.1, s, 0.08, 1.1, 0.3, 0.014)), // two great horns and two small
    ...pair((s) => ['box', GOLD, [0.042 * s, 0.05, -0.13], [0.055, 0.014, 0.008], [0, 0, 0.35 * s]]),
    ...pair((s) => ['box', glow(0xff7a1a, 3), [0.04 * s, 0.024, -0.128], [0.036, 0.016, 0.006], [0, 0, -0.3 * s]]),
    ['box', mat(0x6a0a0e), [0, -0.062, -0.128], [0.1, 0.035, 0.006]], ...[-2, -1, 1, 2].map((k) => fang(GOLD, k * 0.017, -0.046, -0.131, 0.024)), ...pair((s) => fang(GOLD, 0.032 * s, -0.08, -0.131, 0.034, true, 0.011)),
  ] },
  { id: 'dreadhannya', name: 'Dread Hannya', price: 2200, sw: 0xf0e8d8, hide: FACE, parts: [
    ['box', mat(0xf0e8d8, { r: 0.35 }), [0, 0, -0.1], [0.165, 0.2, 0.05]],
    ...[1, -1].flatMap((s) => horn(GOLD, 0.06, 0.12, -0.06, s, 0.24, 0.35, 0.75, 0.024)), // long, sweeping horns
    ...pair((s) => ['box', BLACK, [0.04 * s, 0.024, -0.127], [0.04, 0.02, 0.006], [0, 0, -0.35 * s]]), ...pair((s) => ['sph', glow(0xff2020, 3.5), [0.04 * s, 0.024, -0.131], [0.008, 0.008, 0.004]]),
    ['box', mat(0x7a0a10), [0, -0.064, -0.127], [0.11, 0.04, 0.006]], ...[-3, -2, -1, 0, 1, 2, 3].map((k) => fang(IVORY, k * 0.014, -0.045, -0.13, k % 3 === 0 ? 0.03 : 0.016)),
    ...pair((s) => ['box', GOLD, [0.06 * s, -0.02, -0.126], [0.004, 0.05, 0.004], [0, 0, 0.4 * s]]),
  ] },
  { id: 'wraith', name: 'Hollow Wraith', price: 2600, sw: 0x0a0a0e, hide: FACE, parts: [
    ['box', mat(0x050507, { r: 0.9 }), [0, 0, -0.1], [0.16, 0.21, 0.05]],
    ...pair((s) => ['box', glow(0xeaf6ff, 4), [0.04 * s, 0.02, -0.127], [0.04, 0.008, 0.006], [0, 0, -0.4 * s]]),
    ...[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((k) => fang(mat(0xd8d0c0, { r: 0.4 }), k * 0.012, -0.05, -0.128, 0.03 + (k % 2) * 0.015)),
    ...pair((s) => ['cone', mat(0x050507), [0.06 * s, -0.14, -0.08], [0.02, 0.09, 0.02], [PI, 0, 0.2 * s]]), ['cone', mat(0x050507), [0, -0.15, -0.09], [0.022, 0.1, 0.022], [PI, 0, 0]], // tattered at the chin
  ] },
);

// ---- new headwear, including whole heads
const WHOLE = ['hair', 'knot', 'band', 'earL', 'earR', ...FACE];
CATALOG.hat.push(
  { id: 'wolf', name: 'Wolf Pelt', price: 1000, sw: 0x7a7a80, hide: ['hair', 'knot', 'band'], parts: [
    ['sph', mat(0x6a6a70, { r: 0.95 }), [0, 0.06, 0.01], [0.122, 0.1, 0.13]],
    ['round', mat(0x6a6a70, { r: 0.95 }), [0, 0.07, -0.135], [0.07, 0.05, 0.09]], ['sph', BLACK, [0, 0.08, -0.18], [0.016, 0.012, 0.012]], // the wolf's snout over the brow
    ...pair((s) => ['sph', glow(0xffd23a, 1.5), [0.04 * s, 0.11, -0.12], [0.01, 0.007, 0.006]]),
    ...pair((s) => ['cone', mat(0x55555a, { r: 0.95 }), [0.06 * s, 0.17, -0.02], [0.028, 0.06, 0.016], [0, 0, -0.2 * s]]),
    ['cone', mat(0x6a6a70, { r: 0.95 }), [0, -0.05, 0.15], [0.06, 0.2, 0.04], [2.6, 0, 0]], // the pelt down the back
  ] },
  { id: 'bonehelm', name: 'Bone Helm', price: 1300, sw: 0xe8dfc8, hide: WHOLE, parts: [
    ['sph', mat(0xe8dfc8, { r: 0.6 }), [0, 0.01, 0.004], [0.122, 0.145, 0.132]],
    ...pair((s) => ['sph', BLACK, [0.042 * s, 0.012, -0.112], [0.026, 0.022, 0.02]]), ['cone', BLACK, [0, -0.025, -0.124], [0.012, 0.02, 0.006], [PI, 0, 0]],
    ...[-3, -2, -1, 0, 1, 2, 3].map((k) => ['box', mat(0xe8dfc8), [k * 0.013, -0.075, -0.115], [0.009, 0.02, 0.008]]),
    ...[1, -1].flatMap((s) => horn(mat(0xd8cfb8), 0.07, 0.11, 0.0, s, 0.1, 0.8, 0.5, 0.018)),
  ] },
  { id: 'onikabuto', name: 'Oni Kabuto', price: 1600, sw: 0x8a0a10, hide: ['hair', 'knot', 'band', 'nose'], parts: [
    ['sph', mat(0x1a1a1e, { m: 0.75, r: 0.3 }), [0, 0.075, 0.01], [0.124, 0.096, 0.13]],
    ['box', mat(0x1a1a1e, { m: 0.75, r: 0.3 }), [0, -0.03, 0.1], [0.21, 0.09, 0.05], [0.45, 0, 0]],
    ['box', LACQ(0x8a0a10), [0, -0.06, -0.1], [0.15, 0.09, 0.05]], ...[-2, -1, 1, 2].map((k) => fang(IVORY, k * 0.02, -0.03, -0.128, 0.022)), // a red face guard with fangs
    ...[1, -1].flatMap((s) => horn(GOLD, 0.05, 0.13, -0.1, s, 0.2, 0.6, 0.5, 0.012)),
    ['cyl', GOLD, [0, 0.1, -0.124], [0.026, 0.006, 0.026], [PI / 2, 0, 0]],
  ] },
  { id: 'phoenix', name: 'Phoenix Crest', price: 1800, sw: 0xff9a2a, hide: ['knot'], parts: [
    ['cyl', GOLD, [0, 0.1, 0.005], [0.104, 0.022, 0.114]],
    ...[-3, -2, -1, 0, 1, 2, 3].map((k) => ['cone', glow(k % 2 ? 0xffd23a : 0xff6a10, 2.4), [k * 0.028, 0.17 + (3 - Math.abs(k)) * 0.012, 0.03], [0.018, 0.12 + (3 - Math.abs(k)) * 0.03, 0.006], [-0.35, 0, -k * 0.18]]), // feathers of flame fanning up and back
    ['sph', glow(0xff3a1a, 3), [0, 0.11, -0.112], [0.014, 0.014, 0.008]],
  ] },
  { id: 'devil', name: 'Devil Head', price: 2200, sw: 0x6a0a0a, hide: WHOLE, parts: [
    ['sph', mat(0x6a0a0a, { r: 0.45 }), [0, 0.01, 0.004], [0.122, 0.145, 0.132]],
    ['round', mat(0x6a0a0a, { r: 0.45 }), [0, -0.05, -0.1], [0.1, 0.07, 0.07]], // a snout
    ...[1, -1].flatMap((s) => horn(mat(0x141010, { r: 0.35 }), 0.07, 0.11, -0.01, s, 0.22, 0.45, 0.75, 0.03)), // great horns rising and curling over
    ...pair((s) => ['cone', mat(0x6a0a0a, { r: 0.45 }), [0.12 * s, 0.03, 0.02], [0.02, 0.07, 0.012], [0, 0, -1.4 * s]]), // pointed ears
    ...pair((s) => ['sph', glow(0xffd23a, 3.5), [0.042 * s, 0.03, -0.122], [0.016, 0.01, 0.008]]), ...pair((s) => ['box', BLACK, [0.042 * s, 0.05, -0.124], [0.04, 0.008, 0.008], [0, 0, -0.45 * s]]),
    ['box', BLACK, [0, -0.08, -0.17], [0.07, 0.01, 0.006]], ...pair((s) => fang(IVORY, 0.025 * s, -0.082, -0.172, 0.03)), ...pair((s) => fang(IVORY, 0.015 * s, -0.08, -0.172, 0.018, true)),
  ] },
  { id: 'dragon', name: 'Dragon Head', price: 2800, sw: 0xc8202a, hide: WHOLE, parts: [
    ['sph', LACQ(0xc8202a), [0, 0.02, 0.01], [0.13, 0.13, 0.14]],
    ['round', LACQ(0xc8202a), [0, -0.01, -0.13], [0.11, 0.07, 0.15]], ['round', LACQ(0xa01820), [0, -0.075, -0.12], [0.1, 0.035, 0.14], [0.12, 0, 0]], // a long snout and its jaw
    ...[-3, -2, -1, 1, 2, 3].map((k) => fang(IVORY, k * 0.014, -0.055, -0.19, 0.022)),
    ...pair((s) => ['sph', GOLD, [0.03 * s, 0.03, -0.2], [0.014, 0.012, 0.012]]), // nostrils
    ...pair((s) => ['sph', mat(0xffd23a, { e: 0xffa000, ei: 1.5 }), [0.06 * s, 0.07, -0.08], [0.028, 0.026, 0.02]]), ...pair((s) => ['sph', BLACK, [0.065 * s, 0.07, -0.098], [0.012, 0.02, 0.006]]), // big eyes
    ...pair((s) => ['box', GOLD, [0.06 * s, 0.105, -0.085], [0.07, 0.016, 0.02], [0, 0, 0.25 * s]]), // bushy gold brows
    ...[1, -1].flatMap((s) => horn(GOLD, 0.05, 0.13, 0.02, s, 0.2, 0.35, -0.5, 0.016)), ...pair((s) => ['cone', GOLD, [0.09 * s, 0.24, 0.0], [0.01, 0.07, 0.01], [-0.3, 0, -0.9 * s]]), // antlers, branching
    ...pair((s) => ['cyl', GOLD, [0.07 * s, -0.04, -0.24], [0.004, 0.2, 0.004], [1.0, 0, 0.6 * s]]), // whiskers
    ...[-2, -1, 0, 1, 2].map((k) => ['cone', k % 2 ? GOLD : LACQ(0xe8b020), [k * 0.04, 0.05, 0.13], [0.03, 0.16, 0.012], [2.2, 0, -k * 0.25]]), // the mane
  ] },
);
// carved dragon masks (green, red, blue): a scowling, scaled head with gold forked antlers, gold eyes, an open jaw full of
// fangs with the tongue out, pointed ears, and a mane of spikes swept back all round
const carvedDragon = (id, name, c, d) => { const L = LACQ(c), D = LACQ(d), ANT = mat(0xcfb04a, { m: 0.7, r: 0.4 }); return { id, name, price: 2400, sw: c, hide: WHOLE, parts: [
  ['sph', L, [0, 0.02, 0.0], [0.125, 0.125, 0.135]], ['round', L, [0, 0.002, -0.135], [0.1, 0.062, 0.15]], ['sph', L, [0, 0.014, -0.212], [0.046, 0.032, 0.03]], // skull, snout, nose
  ['round', mat(0x1a0608, { r: 0.6 }), [0, -0.046, -0.118], [0.082, 0.03, 0.12]], ['round', D, [0, -0.09, -0.112], [0.09, 0.03, 0.135], [0.3, 0, 0]], ['round', mat(0xb03040, { r: 0.4 }), [0, -0.078, -0.16], [0.036, 0.012, 0.085], [0.3, 0, 0]], // the open mouth, the dropped jaw, the tongue
  ...[-3, -2, -1, 1, 2, 3].map((k) => fang(ANT, k * 0.0135, -0.032, -0.2, 0.024)), ...[-2.5, -1.5, 1.5, 2.5].map((k) => fang(ANT, k * 0.0135, -0.092, -0.21, 0.02, true)),
  ...pair((s) => ['sph', GOLD, [0.058 * s, 0.062, -0.086], [0.024, 0.019, 0.016]]), ...pair((s) => ['sph', BLACK, [0.061 * s, 0.062, -0.1], [0.008, 0.012, 0.005]]),
  ...pair((s) => ['round', D, [0.058 * s, 0.094, -0.092], [0.078, 0.022, 0.034], [0, 0, 0.32 * s]]), ...pair((s) => ['sph', L, [0.03 * s, 0.03, -0.2], [0.014, 0.012, 0.012]]), // heavy brows, nostrils
  ...pair((s) => ['cone', L, [0.128 * s, 0.07, 0.02], [0.032, 0.095, 0.014], [0, 0, -1.15 * s]]),
  ...pair((s) => ['cone', ANT, [0.052 * s, 0.215, 0.0], [0.017, 0.21, 0.017], [0.12, 0, -0.22 * s]]), ...pair((s) => ['cone', ANT, [0.084 * s, 0.2, 0.0], [0.012, 0.1, 0.012], [0.12, 0, -0.85 * s]]), // forked antlers
  ...Array.from({ length: 11 }, (_, i) => { const a = i / 10 * PI, cs = Math.cos(a), sn = Math.sin(a); return ['cone', D, [cs * 0.128, -0.03 + (i % 2) * 0.06, sn * 0.115 + 0.02], [0.024, 0.11, 0.013], [sn * 1.15, 0, -cs * 1.15]]; }),
  ...Array.from({ length: 7 }, (_, i) => { const a = (i + 0.5) / 7 * PI, cs = Math.cos(a), sn = Math.sin(a); return ['cone', L, [cs * 0.1, 0.11, sn * 0.1 + 0.02], [0.02, 0.085, 0.012], [sn * 0.75, 0, -cs * 0.75]]; }),
  ['cone', D, [0, -0.135, -0.17], [0.02, 0.06, 0.02], [PI, 0, 0]],
] }; };
CATALOG.mask.push(carvedDragon('dragongreen', 'Jade Dragon', 0x1f7a4a, 0x0e3a26), carvedDragon('dragonred', 'Crimson Dragon', 0xb02a22, 0x4a100e), carvedDragon('dragonblue', 'Azure Dragon', 0x2a6ad0, 0x123a7a));
// ---- oni masks, many kinds. Shared pieces: a carved face (dome, heavy brow, nose, cheeks, chin), dark eye sockets with
// an optional glowing eye, an open grin with a row of teeth and two tusks, pointed ears; and a half mask for the jaw alone
// a big two-part horn that reads as one piece: a solid lower length, then a pointed tip bending further over (s: which side)
const bigHorn = (m, x, y, z, s, len, lean, curl, w) => { const L1 = len * 0.5, L2 = len * 0.6, a2 = lean + curl, bx = x + Math.sin(lean) * L1, by = y + Math.cos(lean) * L1;
  return [['cyl', m, [(x + Math.sin(lean) * L1 / 2) * s, y + Math.cos(lean) * L1 / 2, z], [w, L1, w], [0, 0, -lean * s]], ['sph', m, [bx * s, by, z], [w, w, w]], ['cone', m, [(bx + Math.sin(a2) * L2 / 2) * s, by + Math.cos(a2) * L2 / 2, z], [w, L2, w], [0, 0, -a2 * s]]]; };
const oFace = (M) => [['sph', M, [0, 0, -0.07], [0.09, 0.115, 0.068]], ['sph', M, [0, 0.05, -0.112], [0.082, 0.027, 0.033]], ['sph', M, [0, -0.022, -0.136], [0.027, 0.028, 0.03]], ...pair((s) => ['sph', M, [0.05 * s, -0.036, -0.1], [0.035, 0.032, 0.03]]), ['sph', M, [0, -0.097, -0.085], [0.052, 0.04, 0.046]]];
const oEyes = (E) => [...pair((s) => ['sph', BLACK, [0.037 * s, 0.017, -0.125], [0.027, 0.013, 0.01], [0, 0, -0.25 * s]]), ...(E ? pair((s) => ['sph', E, [0.037 * s, 0.016, -0.132], [0.01, 0.008, 0.005]]) : [])];
const oGrin = (T, tusk = 0.034, z = -0.128) => [['box', BLACK, [0, -0.073, z + 0.002], [0.088, 0.024, 0.01]], ...[-3, -2, -1, 0, 1, 2, 3].flatMap((k) => [fang(T, k * 0.0115, -0.064, z - 0.004, 0.011, false, 0.006), fang(T, k * 0.0115, -0.082, z - 0.004, 0.011, true, 0.006)]), ...pair((s) => fang(T, 0.04 * s, -0.085, z - 0.006, tusk, true, 0.011))];
const oEars = (M) => pair((s) => ['cone', M, [0.108 * s, 0.01, -0.01], [0.022, 0.085, 0.012], [0, 0, -1.0 * s]]);
const oHalf = (M, T, tusk) => [['round', M, [0, -0.062, -0.098], [0.158, 0.09, 0.075]], ['round', M, [0, -0.02, -0.128], [0.05, 0.04, 0.03]], ...pair((s) => ['cone', M, [0.085 * s, -0.01, -0.08], [0.022, 0.07, 0.012], [0, 0, -0.5 * s]]), // the jaw plate, a nose guard, cheek fins
  ['box', BLACK, [0, -0.07, -0.136], [0.09, 0.02, 0.008]], ...[-3, -2, -1, 0, 1, 2, 3].map((k) => fang(T, k * 0.012, -0.079, -0.14, 0.01, true, 0.006)), ...pair((s) => fang(T, 0.03 * s, -0.045, -0.142, tusk, false, 0.012)), ...pair((s) => fang(T, 0.048 * s, -0.085, -0.14, tusk * 0.5, true, 0.009))];
{ const GUN = mat(0x4c505a, { m: 0.85, r: 0.3 }), SILV = mat(0xd8dce4, { m: 0.9, r: 0.22 }), TENT = mat(0x2c2622, { m: 0.5, r: 0.35 }), KAGE = mat(0x17171b, { r: 0.45, m: 0.35 }), WHT = mat(0xece8e0, { r: 0.5 }), COP = mat(0xb5562e, { m: 0.8, r: 0.35 }), IRE = LACQ(0xb81820), BLOOD = mat(0xa01018, { r: 0.35 }), HGOLD = mat(0xc89a3a, { m: 0.8, r: 0.35 });
  CATALOG.mask.push(
    { id: 'blackfang', name: 'Black Fang Menpo', price: 900, sw: 0x101014, hide: ['nose'], parts: oHalf(LACQ(0x0c0c10), IVORY, 0.055) },
    { id: 'copperoni', name: 'Copper Oni Menpo', price: 1100, sw: 0xb5562e, hide: ['nose'], parts: [...oHalf(COP, BLACK, 0.045), ...pair((s) => ['cone', COP, [0.05 * s, 0.0, -0.118], [0.02, 0.05, 0.01], [0, 0, 0.5 * s]])] },
    { id: 'irezumi', name: 'Irezumi Oni', price: 1400, sw: 0xb81820, hide: FACE, parts: [...oFace(IRE), ...oEyes(GOLD), ...oGrin(IVORY), ...oEars(IRE), ...pair((s) => horn(HGOLD, 0.045, 0.115, -0.03, s, 0.13, 0.3, 0.35, 0.017)).flat(),
      ...pair((s) => ['round', BLACK, [0.04 * s, 0.058, -0.136], [0.055, 0.02, 0.016], [0, 0, 0.38 * s]]), ...Array.from({ length: 7 }, (_, i) => { const a = (i + 0.5) / 7 * PI, cs = Math.cos(a), sn = Math.sin(a); return ['cone', BLACK, [cs * 0.105, 0.09, sn * 0.1 + 0.02], [0.022, 0.09, 0.012], [sn * 0.9, 0, -cs * 0.9]]; })] }, // bushy brows, a black mane
    { id: 'wolfoni', name: 'Wolf Oni', price: 1500, sw: 0xece8e0, hide: FACE, parts: [...oFace(WHT), ...oEyes(null), ['round', WHT, [0, -0.035, -0.155], [0.062, 0.05, 0.09]], ['sph', BLACK, [0, -0.02, -0.205], [0.016, 0.012, 0.012]], // a white wolf: a long muzzle, a black nose
      ...pair((s) => ['cone', WHT, [0.068 * s, 0.155, 0.0], [0.036, 0.1, 0.02], [0, 0, -0.18 * s]]), ...pair((s) => ['cone', BLACK, [0.068 * s, 0.148, -0.012], [0.02, 0.07, 0.01], [0, 0, -0.18 * s]]),
      ['cyl', BLACK, [0, 0.082, -0.129], [0.024, 0.004, 0.024], [PI / 2, 0, 0]], ['cyl', WHT, [0, 0.082, -0.132], [0.014, 0.004, 0.014], [PI / 2, 0, 0]], ...Array.from({ length: 8 }, (_, i) => ['box', BLACK, [Math.cos(i * PI / 4) * 0.03, 0.082 + Math.sin(i * PI / 4) * 0.03, -0.128], [0.012, 0.004, 0.004], [0, 0, i * PI / 4]]), // the black sun on its brow
      ['box', BLOOD, [0, -0.068, -0.196], [0.07, 0.014, 0.01]], ...pair((s) => ['box', BLOOD, [0.045 * s, -0.075, -0.15], [0.01, 0.04, 0.06]]), ...[-2, -1, 1, 2].map((k) => fang(IVORY, k * 0.012, -0.066, -0.2, 0.018, false, 0.006)), ...pair((s) => ['box', BLOOD, [0.05 * s, -0.005, -0.127], [0.008, 0.04, 0.004], [0, 0, 0.3 * s]])] }, // a bloodied mouth, red streaks under the eyes
    { id: 'shirohannya', name: 'White Hannya', price: 1700, sw: 0xece8e0, hide: FACE, parts: [...oFace(WHT), ...oEyes(GOLD), ...oGrin(HGOLD, 0.03), ...oEars(WHT), ...pair((s) => horn(HGOLD, 0.045, 0.118, -0.03, s, 0.15, 0.32, 0.3, 0.016)).flat(),
      ['box', BLOOD, [0, 0.09, -0.126], [0.016, 0.034, 0.005]], ['box', BLOOD, [0, 0.094, -0.127], [0.03, 0.006, 0.005]], ['box', BLOOD, [0, 0.082, -0.127], [0.026, 0.006, 0.005]], // a red mark on the brow
      ...pair((s) => ['cyl', BLOOD, [0.106 * s, -0.09, -0.02], [0.004, 0.13, 0.004]]), ...pair((s) => ['cone', HGOLD, [0.106 * s, -0.18, -0.02], [0.013, 0.045, 0.013]])] }, // red cords and gold tassels
    { id: 'kageoni', name: 'Kage Oni', price: 2000, sw: 0x17171b, hide: FACE, parts: [...oFace(KAGE), ...oEyes(null), ...oGrin(IVORY, 0.045), ...oEars(KAGE), ...pair((s) => bigHorn(KAGE, 0.07, 0.085, -0.02, s, 0.26, 0.95, -0.75, 0.034)).flat(),
      ...pair((s) => ['round', KAGE, [0.04 * s, 0.06, -0.136], [0.05, 0.016, 0.014], [0, 0, 0.42 * s]])] }, // a shadow: huge black horns sweeping up and in, ivory tusks
    { id: 'krakenoni', name: 'Kraken Oni', price: 2600, sw: 0x4c505a, hide: FACE, parts: [...oFace(GUN), ...oEyes(null), ...oGrin(SILV, 0.04), ...oEars(GUN), ...pair((s) => ['sph', WHT, [0.046 * s, 0.088, -0.06], [0.052, 0.05, 0.055]]), // gunmetal, with a white brow
      ['box', SILV, [0, 0.075, -0.13], [0.012, 0.07, 0.006]], ...pair((s) => ['box', SILV, [0.03 * s, 0.06, -0.134], [0.06, 0.008, 0.006], [0, 0, 0.5 * s]]), ...pair((s) => fang(SILV, 0.052 * s, -0.06, -0.132, 0.03, false, 0.01)),
      ...pair((s) => bigHorn(TENT, 0.07, 0.09, -0.03, s, 0.25, 0.8, -0.6, 0.028)).flat(), ...pair((s) => [0, 1, 2, 3, 4].map((i) => ['sph', SILV, [(0.076 + i * 0.02) * s, 0.094 + i * 0.02, -0.058], [0.0095 - i * 0.001, 0.0095 - i * 0.001, 0.005]])).flat()] }, // tentacle horns, a row of suckers down each
  ); }
// a lacquered tengu: glossy red, a furrowed brow under sweeping black eyebrows, amber eyes, long ears with a gold cord,
// a long wedge of a nose with a ridge along the top, tapering to a blunt end, and an open mouth showing gold teeth over a jutting chin
{ const R = mat(0xc0181c, { r: 0.16, m: 0.2, e: 0x240204, ei: 1 }), DR = mat(0x7a0c10, { r: 0.2, m: 0.2 }), AMB = mat(0xc88a2a, { m: 0.6, r: 0.25, e: 0x3a2000, ei: 1 }), TG = mat(0xc89a3a, { m: 0.8, r: 0.35 });
  CATALOG.mask.push({ id: 'lacquertengu', name: 'Lacquer Tengu', price: 1200, sw: 0xc0181c, hide: FACE, parts: [...oFace(R),
    ...[0, 1, 2].map((i) => ['round', DR, [0, 0.075 + i * 0.017, -0.118 + i * 0.012], [0.11 - i * 0.012, 0.007, 0.012]]), // furrows across the brow
    ...pair((s) => ['round', BLACK, [0.044 * s, 0.058, -0.137], [0.066, 0.019, 0.014], [0, 0, 0.55 * s]]), ...pair((s) => ['sph', BLACK, [0.014 * s, 0.04, -0.141], [0.012, 0.012, 0.008]]), // black eyebrows sweeping up and out, curled at the bridge
    ...pair((s) => ['sph', BLACK, [0.038 * s, 0.015, -0.124], [0.029, 0.016, 0.012], [0, 0, -0.3 * s]]), ...pair((s) => ['sph', AMB, [0.038 * s, 0.014, -0.131], [0.016, 0.012, 0.008]]), ...pair((s) => ['sph', BLACK, [0.038 * s, 0.014, -0.138], [0.006, 0.006, 0.003]]),
    ['tnose', R, [0, -0.016, -0.172], [0.036, 0.098, 0.038], [-PI / 2 - 0.1, 0, 0]], ...pair((s) => ['sph', BLACK, [0.013 * s, -0.04, -0.142], [0.0075, 0.003, 0.0095]]), // the nose: a carved wedge with a ridge along the top, jutting forward and down; the nostrils under it
    ['box', BLACK, [0, -0.07, -0.127], [0.078, 0.022, 0.01]], ...[-3, -2, -1, 0, 1, 2, 3].flatMap((k) => [['box', TG, [k * 0.0105, -0.064, -0.133], [0.009, 0.009, 0.005]], ['box', TG, [k * 0.0105, -0.077, -0.133], [0.009, 0.008, 0.005]]]), // gold teeth
    ['round', R, [0, -0.1, -0.105], [0.075, 0.03, 0.05]], ['round', R, [0, -0.055, -0.13], [0.09, 0.008, 0.012]], // the chin, the upper lip
    ...pair((s) => ['round', R, [0.106 * s, -0.005, -0.005], [0.018, 0.11, 0.045]]), ...pair((s) => ['cyl', TG, [0.122 * s, 0.03, -0.005], [0.005, 0.035, 0.005], [0, 0, PI / 2]]), // long ears, a gold cord through each
  ] }); }

// ---- outfits: families, each in several colours; the legendary ones glow along their trim
const fam = (id, name, price, vs) => vs.map(([v, vn, gi, trim, pants, o = {}]) => ({ id: `${id}-${v}`, name: `${name} · ${vn}`, price, sw: gi === 0x111111 || gi < 0x202020 ? trim : gi, gi, trim, pants, ...o }));
CATALOG.outfit.push(
  ...fam('ronin', 'Ronin', 300, [['ash', 'Ash', 0x6b6b6b, 0x2a2a2a, 0x1e1e1e], ['indigo', 'Indigo', 0x2c3a6b, 0xc9c9c9, 0x1a1f33], ['rust', 'Rust', 0x8a4a22, 0x2a1a10, 0x24170e], ['moss', 'Moss', 0x4a5a2a, 0xc9b36b, 0x232a14]]),
  ...fam('monk', 'Warrior Monk', 350, [['saffron', 'Saffron', 0xe08a1a, 0x7c1018, 0x5a1010], ['maroon', 'Maroon', 0x7c1018, 0xe0a83a, 0x3a0a0e], ['slate', 'Slate', 0x5a6470, 0xe08a1a, 0x2a2f36]]),
  ...fam('shinobi', 'Shinobi', 450, [['night', 'Night', 0x16161c, 0xc0262c, 0x0e0e12], ['storm', 'Storm', 0x1e2430, 0x4ab0ff, 0x10141c], ['venom', 'Venom', 0x16161c, 0x5af09a, 0x0e0e12], ['dusk', 'Dusk', 0x1a1424, 0xb07aff, 0x0e0b14]]),
  ...fam('festival', 'Festival', 500, [['koi', 'Koi', 0xf07f1f, 0xffffff, 0x1e3f8a], ['lantern', 'Lantern', 0xd7262e, 0xffc23d, 0x2a1a10], ['wisteria', 'Wisteria', 0xb07aff, 0xf4f1ea, 0x3a2a5a]]),
  ...fam('lord', 'Samurai Lord', 800, [['gold', 'Gold', 0x1a1a1a, 0xd9ad3c, 0x111111], ['silver', 'Silver', 0x22283a, 0xc9d2dc, 0x141826], ['crimson', 'Crimson', 0x7c1018, 0xd9ad3c, 0x1c1214], ['jade', 'Jade', 0x1f4a34, 0xd9ad3c, 0x10261a]]),
  ...fam('molten', 'Molten Core', 1800, [['fire', 'Fire', 0x1a1210, 0xff6a10, 0x0e0a08, { glow: 0xff5a00 }], ['blue', 'Blue Flame', 0x0e1220, 0x3a8aff, 0x080a12, { glow: 0x2a6aff }]]),
  ...fam('spirit', 'Spirit Walker', 2000, [['frost', 'Frost', 0xeef6ff, 0x5fe3ff, 0x8fb0c8, { glow: 0x3ac8ff }], ['jade', 'Jade', 0xeef6ee, 0x5af09a, 0x8fc8a8, { glow: 0x2ad078 }]]),
  ...fam('voidemp', 'Void Emperor', 2400, [['violet', 'Violet', 0x0b0614, 0x9b51ff, 0x050308, { glow: 0x9b51ff }], ['crimson', 'Crimson', 0x120406, 0xff2a3a, 0x060203, { glow: 0xff1a2a }]]),
  ...fam('celestial', 'Celestial', 2800, [['dawn', 'Dawn', 0xf4f1ea, 0xffd34d, 0x2a2f5a, { glow: 0xffb000 }], ['night', 'Night', 0x141a3a, 0xffd34d, 0x0a0e22, { glow: 0xffb000 }]]),
);

// ---- sword shapes (a tab of their own under Swords): the outline of the blade; the finish comes from the sword
CATALOG.shape = [
  { id: 'straight', name: 'Straight', price: 0, sw: 0xdfe6ee },
  { id: 'tachi', name: 'Curved Tachi', price: 250, sw: 0xdfe6ee },
  { id: 'jian', name: 'Twin-Edged Jian', price: 350, sw: 0xdfe6ee },
  { id: 'serrated', name: 'Sawtooth', price: 550, sw: 0xdfe6ee },
  { id: 'scimitar', name: 'Scimitar', price: 650, sw: 0xdfe6ee },
  { id: 'forked', name: 'Forked Tongue', price: 900, sw: 0xdfe6ee },
  { id: 'flame', name: 'Flame Kris', price: 1200, sw: 0xdfe6ee },
  { id: 'crescent', name: 'Crescent Moon', price: 1700, sw: 0xdfe6ee },
  { id: 'demon', name: 'Demon Fang', price: 2300, sw: 0xdfe6ee },
  { id: 'wing', name: 'Dragon Wing', price: 2900, sw: 0xdfe6ee },
];
CATALOG.sword.push(
  { id: 'molten', name: 'Molten', price: 1600, sw: 0xff6a10, blade: mat(0x2a0a04, { m: 0.4, r: 0.3, e: 0xff5a00, ei: 2.2 }), guard: 0x1a1a1a, grip: 0x3a1a0a },
  { id: 'spirit', name: 'Spirit Glass', price: 2000, sw: 0x9ff0ff, blade: mat(0xcff8ff, { m: 0.1, r: 0.05, e: 0x5fe3ff, ei: 2 }), guard: 0xeef6ff, grip: 0x1e3f8a },
  { id: 'sunsteel', name: 'Sunsteel', price: 2500, sw: 0xffe08a, blade: mat(0xffe8a0, { m: 1, r: 0.15, e: 0xffb000, ei: 1.6 }), guard: 0xffffff, grip: 0x7a5410 },
);

// ---- trails: a legendary tier, longer and with their own particles (len: how long the trail hangs, in seconds)
CATALOG.trail.push(
  { id: 'frost', name: 'Frost', price: 900, sw: 0xbfeaff, a: 0x3aa0ff, b: 0xe8f8ff, px: 'snow', len: 0.16 },
  { id: 'bloodmoon', name: 'Blood Moon', price: 1000, sw: 0xd61a2a, a: 0x5a0008, b: 0xff2a3a, px: 'ember', len: 0.16 },
  { id: 'aurora', name: 'Aurora', price: 1600, sw: 0x5af0b0, a: 0xffffff, b: 0xffffff, fx: 'aurora', px: 'star', len: 0.22 },
  { id: 'dragonfire', name: 'Dragonfire', price: 1900, sw: 0xff5a10, a: 0xff3a00, b: 0xffe080, fx: 'fire', px: 'ember', len: 0.24 },
  { id: 'voidrift', name: 'Void Rift', price: 2200, sw: 0x7a3aff, a: 0x12001f, b: 0xb070ff, px: 'void', len: 0.26 },
  { id: 'galaxy', name: 'Galaxy', price: 2800, sw: 0x3a5aff, a: 0xffffff, b: 0xffffff, fx: 'galaxy', px: 'star', len: 0.3 },
);
// ---- kill effects (see killfx.js)
CATALOG.kill.push(
  { id: 'shatter', name: 'Glass Shatter', price: 900, sw: 0xdff4ff },
  { id: 'petrify', name: 'Petrify', price: 1100, sw: 0x8a8580 },
  { id: 'spirit', name: 'Spirit Release', price: 1600, sw: 0x9fe8ff },
  { id: 'blackhole', name: 'Black Hole', price: 2000, sw: 0x1a0a2a },
  { id: 'dragonbreath', name: "Dragon's Breath", price: 2500, sw: 0xff5a10 },
);
// ---- grapples (see grapple.js)
CATALOG.grapple.push(
  { id: 'bone', name: 'Bone Chain', price: 700, sw: 0xe8dfc8, head: 'bonehook' },
  { id: 'frostchain', name: 'Frost Chain', price: 1100, sw: 0x9fe8ff, head: 'icicle' },
  { id: 'hellchain', name: 'Hellfire Chain', price: 1500, sw: 0xff5a10, head: 'flamehook' },
  { id: 'celestial', name: 'Celestial Ribbon', price: 2200, sw: 0xffd34d, head: 'star' },
  { id: 'serpent', name: 'Serpent', price: 2700, sw: 0x2a8a3a, head: 'snake' },
);
for (const c of Object.keys(CATALOG)) CATALOG[c].sort((a, b) => (a.price === 0 ? -1 : b.price === 0 ? 1 : a.price - b.price)); // (cheapest first, the free one at the front)
// ---------- spears ----------
// A spear is two-handed, held at the middle, with a blade at each end; it reaches as far as a sword and has moves of
// its own (see spearMove in main.js). It goes in the sword's slot: you carry one or the other. `head` is the blade
// outline each end carries (the same outlines as the sword shapes), `hl` how long a head is as a share of the reach,
// `w` and `t` how broad and thick it is; `guard` is the collar under each head, `grip` the shaft.
{ const sp = (id, name, price, sw, blade, guard, grip, head, hl = 0.36, w = 1.5, t = 1.3) => ({ id, name, price, sw, blade, guard, grip, w, t, spear: { head, hl } });
  CATALOG.sword.push(
    sp('ashspear', 'Ash Twin-Spear', 300, 0xcfd6de, mat(0xdfe6ee, { m: 0.9, r: 0.2 }), 0x6b6f76, 0x7a5a3a, 'jian'),
    sp('bamboolance', 'Bamboo Lance', 400, 0x9ac46a, mat(0xe8eef2, { m: 0.9, r: 0.15 }), 0x3a5a2a, 0x8aa85a, 'straight', 0.44, 1.0),
    sp('naginata', 'Twin Naginata', 500, 0xb9c0c8, mat(0xcfd6de, { m: 0.85, r: 0.25 }), 0xc9a24a, 0x2a1d14, 'tachi', 0.48, 1.9),
    sp('harpoon', 'Bone Harpoon', 550, 0xe8dfc8, mat(0xe8dfc8, { r: 0.75 }), 0x6b4a2c, 0x4a3524, 'serrated', 0.36, 1.8, 1.8),
    sp('jadefang', 'Jade Fang', 650, 0x3fbf7f, mat(0x3fbf7f, { m: 0.3, r: 0.2, e: 0x0a5a30, ei: 1 }), 0xd4af37, 0x123322, 'jian', 0.38, 1.8),
    sp('partisan', 'Gilded Partisan', 800, 0xffd34d, mat(0xffd34d, { m: 1, r: 0.22 }), 0x1a1a1a, 0x5a0d12, 'wing', 0.42, 1.4),
    sp('glaive', 'Obsidian Glaive', 950, 0x16161a, mat(0x111114, { m: 0.7, r: 0.12, e: 0x3a0000, ei: 1 }), 0x8a0d16, 0x111111, 'scimitar', 0.5, 2.0),
    sp('frostpike', 'Frost Pike', 1100, 0xbfeaff, mat(0xbfeaff, { m: 0.4, r: 0.1, e: 0x3aa0ff, ei: 0.9 }), 0xe6f4ff, 0x1e3f8a, 'straight', 0.52, 0.9),
    sp('bloodfork', 'Bloodmoon Fork', 1400, 0xd61a2a, mat(0x8a0d16, { m: 0.5, r: 0.2, e: 0xff1a2a, ei: 1.1 }), 0x111111, 0x3a0a0e, 'forked', 0.42, 2.1),
    sp('monkspade', 'Crescent Spade', 1700, 0xdfe6ee, mat(0xdfe6ee, { m: 0.9, r: 0.18 }), 0xc9a24a, 0x5a1a1a, 'crescent', 0.4, 1.9),
    // the three finest are double scythes: a short pole with a long curved blade running straight out of each end, bowed opposite ways
    sp('flamelance', 'Hellfire Scythe', 2100, 0xff6a10, mat(0x2a0a04, { m: 0.4, r: 0.3, e: 0xff5a00, ei: 2.2 }), 0x1a1a1a, 0x3a1a0a, 'scythe', 0.6, 2.9, 1.5),
    sp('stormlance', 'Storm Scythe', 2500, 0x9ff0ff, mat(0xcff8ff, { m: 0.1, r: 0.05, e: 0x5fe3ff, ei: 2 }), 0xeef6ff, 0x1e3f8a, 'scythe', 0.64, 2.7, 1.3),
    sp('voidreaper', 'Void Reaper', 3200, 0x9b51ff, mat(0x0b0614, { m: 0.6, r: 0.15, e: 0x9b51ff, ei: 1.8 }), 0x2a1a40, 0x0b0614, 'reaper', 0.68, 3.1, 1.6),
  ); }
/** Keep only real item ids (used on looks arriving over the network). */
export function cleanLook(look) {
  const out = { ...DEFAULT_LOOK };
  if (look && typeof look === 'object') for (const c of Object.keys(DEFAULT_LOOK)) if (CATALOG[c].some((x) => x.id === look[c])) out[c] = look[c];
  return out;
}
/** A random look for a bot: most wear a few things, some go plain. */
export function randomLook() {
  const pick = (c, p) => (Math.random() < p ? CATALOG[c][1 + Math.floor(Math.random() * (CATALOG[c].length - 1))].id : CATALOG[c][0].id);
  return { mask: pick('mask', 0.5), hat: pick('hat', 0.5), outfit: pick('outfit', 0.35), sword: pick('sword', 0.45), shape: pick('shape', 0.35), trail: pick('trail', 0.5), kill: pick('kill', 0.35), grapple: pick('grapple', 0.4) };
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
  { const gone = p.owned.filter((k) => /^outfit:(coat|warcoat)-/.test(k)); if (gone.length) { p.coins += gone.reduce((s, k) => s + (k.startsWith('outfit:warcoat-') ? 700 : 400), 0); p.owned = p.owned.filter((k) => !gone.includes(k)); } } // (the Long Coat and War Coat outfits were withdrawn: refund them)
  p.equip = cleanLook(p.equip);
  p.up = cleanUp(p.up);
  return p;
})();
/** Buy the next level of an upgrade. */
export function buyUpgrade(id) {
  const L = profile.up[id] || 0; if (L >= UP_MAX) return false;
  const c = UP_PRICES[L]; if (profile.coins < c) return false;
  profile.coins -= c; profile.up[id] = L + 1; saveProfile(); return true;
}
export function saveProfile() { try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* private mode */ } }
export const owns = (cat, id) => item(cat, id).price === 0 || profile.owned.includes(cat + ':' + id);
export function buy(cat, id) {
  const it = item(cat, id);
  if (owns(cat, id) || profile.coins < it.price) return false;
  profile.coins -= it.price; profile.owned.push(cat + ':' + id); saveProfile(); return true;
}
export function equip(cat, id) { if (!owns(cat, id)) return false; profile.equip[cat] = id; saveProfile(); return true; }
export function addCoins(n) { profile.coins += Math.max(0, Math.round(n)); saveProfile(); }
