// Paper Dojo District: a misty-morning town where (nearly) everything can be cut apart. Shoji walls, wooden
// posts, straw barns, hay bales, fences, crates, market stalls and training dummies are built from chunks. A
// sword stroke slices the chunks it passes through (each one splits along the blade and falls away), running
// into paper bursts through it, a dash smashes through anything, and whatever is left hanging with nothing
// holding it up comes down. Floors, roofs and the tower's decks stay put, so there is always somewhere to stand.
// Vertical: a four-tier dojo tower with stairs spiralling up it, two-storey houses, rooftop bridges, watchtowers
// and floating shrine islands around the town.
import * as THREE from 'three';
import { regMat } from './fighter.js?v=20261114014554';
import { deck, prop, bridge, stalk, drift, farRing } from './maps2.js';

const TAU = Math.PI * 2, CELL = 6;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const cellKey = (ix, iz) => ix * 4096 + iz;

// ---------- materials for each kind of breakable (made once; pieces use the plain colours, since cut pieces have no UVs) ----------
let KM = null;
function kindMats(T) {
  if (KM) return KM;
  const shoji = T.canvasTex((g, s) => {
    g.fillStyle = '#f2ead6'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(180,160,120,${Math.random() * 0.12})`; g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 6, 1); } // paper fibres
    g.fillStyle = '#4a2f1a'; const b = 6, l = 3;
    g.fillRect(0, 0, s, b); g.fillRect(0, s - b, s, b); g.fillRect(0, 0, b, s); g.fillRect(s - b, 0, b, s);
    for (const f of [1 / 3, 2 / 3]) g.fillRect(s * f - l / 2, 0, l, s);
    for (const f of [1 / 4, 2 / 4, 3 / 4]) g.fillRect(0, s * f - l / 2, s, l);
  }, 128);
  const straw = T.canvasTex((g, s) => {
    g.fillStyle = '#c29d48'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 500; i++) { const c = 150 + Math.random() * 90 | 0; g.strokeStyle = `rgba(${c},${c * 0.8 | 0},${c * 0.35 | 0},0.7)`; g.beginPath(); const x = Math.random() * s, y = Math.random() * s; g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 6, y + 8 + Math.random() * 18); g.stroke(); }
  }, 128);
  const plain = (c, r = 0.85) => regMat(std(c, { roughness: r }));
  KM = {
    paper: { mat: std(0xffffff, { map: shoji, roughness: 0.9, emissive: 0x4a3418, emissiveIntensity: 0.22 }), piece: plain(0xefe6d0), cap: plain(0xfaf4e4), tint: [0.92, 1] },
    wood: { mat: std(0xffffff, { map: T.woodTex(), roughness: 0.8 }), piece: plain(0x6e4a2c), cap: plain(0xc39463), tint: [0.75, 1.05] },
    straw: { mat: std(0xffffff, { map: straw, roughness: 1 }), piece: plain(0xc9a651, 1), cap: plain(0xe2c574, 1), tint: [0.85, 1.05] },
    cloth: { mat: std(0xffffff, { roughness: 0.9 }), piece: plain(0xa02c2c), cap: plain(0xc04848), tint: [0.8, 1], color: 0xb33030 },
  };
  return KM;
}

// ---------- breakable chunks ----------
// A chunk is a box. It belongs to a group (one wall, one stack, one stall...) and knows its neighbours in it;
// "base" chunks rest on a floor (or hang from a ceiling). After a cut, anything in the group no longer joined to a
// base chunk falls.
function chunk(A, g, kind, x0, x1, y0, y1, z0, z1, base) {
  const b = { x0, x1, y0, y1, z0, z1, kind, soft: kind === 'paper' || kind === 'cloth', i: A.brk.list.length, g, nb: [], base: !!base, alive: true, plat: A.curPlat, cells: [] };
  A.brk.list.push(b); g.chunks.push(b); return b;
}
const join = (a, b) => { if (a && b) { a.nb.push(b); b.nb.push(a); } };
const group = () => ({ chunks: [] });

/** A wall along x (az == bz) or along z (ax == bx), from y0 to y1: wooden posts every ~3 m, panels between
 *  (paper with a wooden kick-panel at the bottom and a beam under a ceiling, or straw, or planks). Doors and
 *  windows are gaps at the given fractions along it. */
function wall(A, ax, az, bx, bz, y0, y1, o = {}) {
  const alongX = Math.abs(az - bz) < 1e-6, c = alongX ? az : ax;
  const u0 = alongX ? Math.min(ax, bx) : Math.min(az, bz), u1 = alongX ? Math.max(ax, bx) : Math.max(az, bz);
  const kind = o.kind || 'paper', t = o.t || (kind === 'straw' ? 0.32 : kind === 'wood' ? 0.16 : 0.1), pw = 0.22, posts = o.posts !== false;
  const H = y1 - y0, L = u1 - u0, g = group(), grid = new Map();
  const cols = [], Le = posts ? L - pw : L, nb = Math.max(1, Math.round(Le / (o.bay || 3))), bay = Le / nb;
  for (let k = 0; k < nb; k++) {
    const s = k * bay, s1 = posts ? s + pw : s;
    if (posts) cols.push([s, s1, 1]);
    const np = Math.max(1, Math.round((s + bay - s1) / 1.05)), w = (s + bay - s1) / np;
    for (let j = 0; j < np; j++) cols.push([s1 + j * w, s1 + (j + 1) * w, 0]);
  }
  if (posts) cols.push([Le, L, 1]);
  const nr = Math.max(1, Math.round(H / 1.05)), rh = H / nr;
  cols.forEach(([a0, a1, post], ci) => {
    const um = (a0 + a1) / 2;
    for (let rj = 0; rj < nr; rj++) {
      const h0 = y0 + rj * rh, h1 = h0 + rh;
      if ((o.doors || []).some((f) => Math.abs(um - f * L) < 0.9) && h1 <= y0 + 2.75) continue;
      if ((o.win || []).some((f) => Math.abs(um - f * L) < 0.9) && h0 >= y0 + 0.9 && h1 <= y0 + 2.75) continue;
      let kd = kind, th = t;
      if (post) { kd = 'wood'; th = Math.max(t, pw); } else if (kind === 'paper' && ((rj === 0 && nr >= 3) || (o.ceil && rj === nr - 1 && nr >= 5))) kd = 'wood';
      const b = alongX ? chunk(A, g, kd, u0 + a0, u0 + a1, h0, h1, c - th / 2, c + th / 2) : chunk(A, g, kd, c - th / 2, c + th / 2, h0, h1, u0 + a0, u0 + a1);
      b.base = rj === 0 || (o.ceil && rj === nr - 1);
      if (kind === 'paper' && !post) b.soft = true; // (its thin kick-panel and beam give way with the paper)
      grid.set(ci * 64 + rj, b);
    }
  });
  for (const [k, b] of grid) { join(b, grid.get(k + 64)); join(b, grid.get(k + 1)); }
  return g;
}
/** A pile of boxes (hay bales, crates) nx by ny high by nz, each sx by sy by sz, centred on x,z, from y up. */
function stack(A, x, z, y, nx, ny, nz, sx, sy, sz, kind, taper = true) {
  const g = group(), grid = new Map();
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    if (taper && j > 0 && (i >= nx - j || k >= nz - j) && Math.random() < 0.7) continue; // piles thin out towards the top
    const x0 = x + (i - nx / 2) * sx, z0 = z + (k - nz / 2) * sz, y0 = y + j * sy;
    const b = chunk(A, g, kind, x0 + 0.02, x0 + sx - 0.02, y0, y0 + sy, z0 + 0.02, z0 + sz - 0.02, j === 0);
    grid.set((i * 32 + k) * 32 + j, b);
  }
  for (const [key, b] of grid) { join(b, grid.get(key + 1)); join(b, grid.get(key + 32)); join(b, grid.get(key + 1024)); }
  return g;
}
/** A post-and-rail fence from a to b (axis-aligned), posts every ~2 m. */
function fence(A, ax, az, bx, bz, y) {
  const g = group(), L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 2)), ux = (bx - ax) / L, uz = (bz - az) / L;
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const x = ax + ux * L * i / n, z = az + uz * L * i / n;
    const post = chunk(A, g, 'wood', x - 0.09, x + 0.09, y, y + 1.25, z - 0.09, z + 0.09, true);
    if (prev) for (const [h0, h1] of [[0.35, 0.5], [0.85, 1.0]]) {
      const px = (prev.x0 + prev.x1) / 2, pz = (prev.z0 + prev.z1) / 2;
      const rail = chunk(A, g, 'wood', Math.min(px, x) - (uz ? 0.03 : 0), Math.max(px, x) + (uz ? 0.03 : 0), y + h0, y + h1, Math.min(pz, z) - (ux ? 0.03 : 0), Math.max(pz, z) + (ux ? 0.03 : 0));
      join(rail, prev); join(rail, post);
    }
    prev = post;
  }
  return g;
}
/** A straw training dummy (makiwara): a post in segments with a straw-bound middle and a crossbar. */
function dummy(A, x, z, y) {
  const g = group(); let below = null;
  [[0, 0.6, 'wood'], [0.6, 1.2, 'straw'], [1.2, 1.7, 'straw']].forEach(([h0, h1, kd], j) => {
    const w = kd === 'straw' ? 0.22 : 0.13, b = chunk(A, g, kd, x - w, x + w, y + h0, y + h1, z - w, z + w, j === 0);
    join(b, below); below = b;
  });
  join(chunk(A, g, 'wood', x - 0.6, x + 0.6, y + 1.45, y + 1.55, z - 0.05, z + 0.05), below);
  return g;
}
/** A market stall: four posts in segments holding up a cloth canopy, with a counter of crates. */
function stall(A, x, z, y, rot) {
  const g = group(), w = 3, d = 2, tops = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const [px, pz] = rot(sx * w / 2, sz * d / 2); let below = null;
    for (let j = 0; j < 4; j++) { const b = chunk(A, g, 'wood', x + px - 0.08, x + px + 0.08, y + j * 0.6, y + j * 0.6 + 0.6, z + pz - 0.08, z + pz + 0.08, j === 0); join(b, below); below = b; }
    tops.push([px, pz, below]);
  }
  const cs = [];
  for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) {
    const [a, b] = rot(-w / 2 - 0.3 + i * (w + 0.6) / 3, -d / 2 - 0.3 + k * (d + 0.6) / 2), [c, e] = rot(-w / 2 - 0.3 + (i + 1) * (w + 0.6) / 3, -d / 2 - 0.3 + (k + 1) * (d + 0.6) / 2);
    const ch = chunk(A, g, 'cloth', x + Math.min(a, c), x + Math.max(a, c), y + 2.4, y + 2.52, z + Math.min(b, e), z + Math.max(b, e)); cs.push(ch);
    for (const [px, pz, top] of tops) if (Math.hypot(x + px - (ch.x0 + ch.x1) / 2, z + pz - (ch.z0 + ch.z1) / 2) < 1.3) join(ch, top);
  }
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { const a = cs[i], b = cs[j]; if (a.x0 <= b.x1 + 0.01 && b.x0 <= a.x1 + 0.01 && a.z0 <= b.z1 + 0.01 && b.z0 <= a.z1 + 0.01) join(a, b); }
  const [cx, cz] = rot(0, d / 2 - 0.5); stack(A, x + cx, z + cz, y, 3, 1, 1, 0.9, 0.9, 0.9, 'wood', false);
  return g;
}

/** Make the instanced meshes for every chunk and file the chunks into the collision grid. */
function finishBrk(A) {
  const K = KM, byKind = {};
  for (const b of A.brk.list) (byKind[b.kind] ||= []).push(b);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
  for (const [kind, list] of Object.entries(byKind)) {
    const k = K[kind], im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), k.mat, list.length);
    im.castShadow = im.receiveShadow = A.quality !== 'low'; im.frustumCulled = false;
    list.forEach((b, n) => {
      b.im = im; b.inst = n;
      m4.compose(p.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2), q, s.set(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0)); im.setMatrixAt(n, m4);
      const v = k.tint[0] + Math.random() * (k.tint[1] - k.tint[0]); col.set(k.color || 0xffffff).multiplyScalar(v); im.setColorAt(n, col);
      for (let ix = Math.floor((b.x0 - 1) / CELL); ix <= Math.floor((b.x1 + 1) / CELL); ix++) for (let iz = Math.floor((b.z0 - 1) / CELL); iz <= Math.floor((b.z1 + 1) / CELL); iz++) {
        const key = cellKey(ix, iz); let c = A.brk.cells.get(key); if (!c) A.brk.cells.set(key, c = []);
        c.push(b); b.cells.push(c);
      }
    });
    A.scene.add(im);
  }
}
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
function kill(A, b) {
  b.alive = false;
  for (const c of b.cells) { const i = c.indexOf(b); if (i >= 0) c.splice(i, 1); }
  b.im.setMatrixAt(b.inst, _zero); b.im.instanceMatrix.needsUpdate = true;
  A.dirty = true; // rebuild the map fresh for the next match
}
/** Break chunk b. Returns the chunks of its group that were left with no support (they fall too). */
export function breakChunk(A, b) {
  if (!b.alive) return [];
  kill(A, b);
  const seen = new Set(), q = b.g.chunks.filter((c) => c.alive && c.base);
  for (const c of q) seen.add(c);
  while (q.length) { const c = q.pop(); for (const n of c.nb) if (n.alive && !seen.has(n)) { seen.add(n); q.push(n); } }
  const fall = [];
  for (const c of b.g.chunks) if (c.alive && !seen.has(c)) { kill(A, c); fall.push(c); }
  return fall;
}
let partSeq = 5e6;
/** A chunk as a triangle soup, ready to be split or thrown as a piece. */
export function chunkSoup(b) {
  const k = KM[b.kind], geo = new THREE.BoxGeometry(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0).toNonIndexed();
  geo.translate((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
  const P = Array.from(geo.attributes.position.array), N = Array.from(geo.attributes.normal.array), T = P.length / 9, part = ++partSeq;
  geo.dispose();
  return { P, N, M: new Array(T).fill(k.piece), Q: new Array(T).fill(part), caps: { [part]: k.cap } };
}

// ================= Paper Dojo District =================
export function buildDojo(A, T) {
  const S = A.scene, M = A.mats, r = T.rng(4242);
  A.plats = []; A.pillars = []; A.arcPts = []; A.killY = -45;
  A.brk = { list: [], cells: new Map(), stamp: 0 };
  kindMats(T);
  A.setSky({ top: 0x86a8d8, mid: 0xf2d4c4, bot: 0xd9c9d2, fog: 0xe9d9d2, near: 85, far: 380, hemiSky: 0xfff0e6, hemiGround: 0x6a5a62, hemi: 1.0, sunColor: 0xffe2c0, sun: 1.9, sunOff: new THREE.Vector3(-55, 48, 30) });
  M.bamboo = new THREE.MeshStandardMaterial({ map: T.bambooTex(), roughness: 0.55 });
  const tileTex = T.canvasTex((g, s) => { g.fillStyle = '#2b2f3a'; g.fillRect(0, 0, s, s); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const c = 52 + Math.random() * 20 | 0; g.fillStyle = `rgb(${c},${c + 4},${c + 14})`; g.fillRect(x * s / 8 + (y % 2) * s / 16, y * s / 8 + 1, s / 8 - 2, s / 8 - 3); } });
  const roof = M.roof = std(0xffffff, { map: tileTex, roughness: 0.6 });
  const tatami = M.tatami = std(0xffffff, { map: T.canvasTex((g, s) => { g.fillStyle = '#b9b77a'; g.fillRect(0, 0, s, s); for (let i = 0; i < s; i += 2) { g.fillStyle = `rgba(90,90,40,${0.1 + Math.random() * 0.15})`; g.fillRect(0, i, s, 1); } g.fillStyle = '#2d3a2a'; g.fillRect(0, 0, s, 6); g.fillRect(0, s - 6, s, 6); }), roughness: 0.95 });
  tatami.map.repeat.set(1, 0.5);
  const dark = std(0x2a2830, { roughness: 0.6 }), rock = std(0x6a6470, { roughness: 1, flatShading: true }), rope = std(0xb08a55, { roughness: 0.9 });
  const bronze = std(0x8a6a3a, { metalness: 0.8, roughness: 0.35 }), moss = std(0x6b8a4a, { roughness: 1 }), lamp = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const W = M.wood, foot = []; // building footprints (kept clear of bamboo)
  const rot = (k, x, z) => { for (let i = 0; i < k; i++) { const t = x; x = z; z = -t; } return [x, z]; };
  const parentOf = (p, t) => { p.parent = t.i; return p; };
  const post = (x, z, y0, y1, w = 0.32) => A.addBox(x - w / 2, x + w / 2, y0, y1, z - w / 2, z + w / 2, W); // static (uncuttable) structure
  const mat = (x0, x1, z0, z1, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), tatami); m.receiveShadow = true; prop(A, A.tag, m, (x0 + x1) / 2, y + 0.03, (z0 + z1) / 2); m.castShadow = false; };
  // a sloping tiled eave skirting the edge of a roof or deck (decoration; skip some sides with `skip`)
  const eaves = (p, x0, x1, z0, z1, y, out = 1.6, skip = []) => {
    const sides = [[(x0 + x1) / 2, z0, x1 - x0, 0, -1], [(x0 + x1) / 2, z1, x1 - x0, 0, 1], [x0, (z0 + z1) / 2, z1 - z0, -1, 0], [x1, (z0 + z1) / 2, z1 - z0, 1, 0]];
    sides.forEach(([x, z, len, nx, nz], k) => {
      if (skip.includes(k)) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(nx ? out : len + out * 2, 0.14, nz ? out : len + out * 2), roof);
      if (nx) m.rotation.z = -nx * 0.42; else m.rotation.x = nz * 0.42;
      prop(A, p, m, x + nx * out * 0.45, y - 0.55, z + nz * out * 0.45).receiveShadow = true;
    });
  };
  // a room: four breakable walls between static corner posts (the slab above is the caller's)
  const room = (x0, x1, z0, z1, y0, y1, o = {}) => {
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) post(x, z, y0, y1);
    const d = o.doors || [0.5], wi = o.win;
    wall(A, x0 + 0.16, z0, x1 - 0.16, z0, y0, y1, { kind: o.kind, ceil: true, doors: o.dn ?? d, win: wi });
    wall(A, x0 + 0.16, z1, x1 - 0.16, z1, y0, y1, { kind: o.kind, ceil: true, doors: o.ds ?? d, win: wi });
    wall(A, x0, z0 + 0.16, x0, z1 - 0.16, y0, y1, { kind: o.kind, ceil: true, doors: o.dw ?? d, win: wi });
    wall(A, x1, z0 + 0.16, x1, z1 - 0.16, y0, y1, { kind: o.kind, ceil: true, doors: o.de ?? d, win: wi });
    if (o.kind !== 'straw') mat(x0, x1, z0, z1, y0);
    foot.push([x0, x1, z0, z1]);
  };
  // a ramp of wooden stairs from (lx,lz) on `lo` up to (hx,hz) beside `hi`: walkable, and a surface for the bots
  const stairs = (lo, hi, lx, lz, hx, hz, w = 2.4) => {
    const dx = hx - lx, dz = hz - lz, L = Math.hypot(dx, dz);
    const p = { kind: 'branch', x: (lx + hx) / 2, z: (lz + hz) / 2, y: (lo.y + hi.y) / 2, ya: lo.y, yb: hi.y, w: L, d: w, ang: Math.atan2(dz, dx), i: A.plats.length, meshes: [], boxes: [], ramps: [], rays: [], parent: lo.i };
    A.plats.push(p); A.tag = p;
    A.addRamp(lx, lz, hx, hz, lo.y, hi.y, w, lo.y, W, { noWall: true });
    A.tag = null;
    A.node('P' + p.i, p.x, p.y, p.z).plat = p.i;
    A.link('P' + lo.i, 'P' + p.i); A.link('P' + p.i, 'P' + hi.i);
    return p;
  };

  // ---- the town: a 3 x 3 grid of stone-paved blocks (each its own surface, so they can crumble one by one)
  const tiles = {};
  for (const ix of [-1, 0, 1]) for (const iz of [-1, 0, 1]) {
    const x = ix * 28, z = iz * 28, key = ix + ',' + iz, ck = { '1,1': 0, '1,-1': 1, '-1,-1': 2, '-1,1': 3 }[key];
    const sp = ck !== undefined ? rot(ck, -8, 9) : { '0,0': [0, 15.5], '1,0': [-9, 13], '0,-1': [0, 10], '-1,0': [6, -3], '0,1': [4, -8] }[key]; // spawn spots clear of buildings
    const p = deck(A, { x, z, y: 0, w: 28, d: 28, mat: M.stone, kind: 'street', thick: 3, sx: sp[0], sz: sp[1] });
    tiles[ix + ',' + iz] = p;
    const under = new THREE.Mesh(new THREE.ConeGeometry(19, 22, 4), rock); under.rotation.set(Math.PI, Math.PI / 4, 0); prop(A, p, under, x, -14, z);
  }
  for (const ix of [-1, 0, 1]) for (const iz of [-1, 0, 1]) { if (ix < 1) A.link('P' + tiles[ix + ',' + iz].i, 'P' + tiles[(ix + 1) + ',' + iz].i); if (iz < 1) A.link('P' + tiles[ix + ',' + iz].i, 'P' + tiles[ix + ',' + (iz + 1)].i); }

  // ---- the dojo tower: a paper room on every level, a deck on top of each, stairs spiralling up the outside
  const C = tiles['0,0'], TW = [22, 17, 12, 8], TY = [0, 6, 12, 18, 24], tdeck = [C];
  A.curPlat = C.i;
  for (let k = 0; k < 4; k++) {
    const s = TW[k] / 2, below = tdeck[k];
    A.tag = below; room(-s, s, -s, s, TY[k], TY[k + 1] - 0.5, { doors: k === 0 ? [0.3, 0.7] : [0.5], win: k > 0 ? [0.2, 0.8] : undefined }); A.tag = null;
    const nxt = k < 3 ? TW[k + 1] / 2 : 0, bal = (s + nxt) / 2;
    const p = parentOf(deck(A, { x: 0, z: 0, y: TY[k + 1], w: TW[k], d: TW[k], mat: W, kind: 'tower', thick: 0.5, sx: k < 3 ? bal : 0, sz: k < 3 ? bal * 0.3 : 0 }), below);
    tdeck.push(p); A.curPlat = p.i;
    eaves(p, -s, s, -s, s, TY[k + 1], 1.4, [[3], [0], [2], [1]][k]);
  }
  { // the stairs: the first runs along the east face from the street; each next one turns a corner
    const s0 = TW[0] / 2; let [a, b] = rot(0, s0 + 1.45, 13), [c, d] = rot(0, s0 + 1.45, -(s0 - 1.5));
    stairs(C, tdeck[1], a, b, c, d, 2.5);
    for (let k = 1; k < 4; k++) {
      const outer = TW[k - 1] / 2, inner = TW[k] / 2, xc = (outer + inner) / 2 + 0.1, w = outer - inner - 0.3;
      [a, b] = rot(k, xc, outer - 0.4); [c, d] = rot(k, xc, -(inner - 1.5));
      stairs(tdeck[k], tdeck[k + 1], a, b, c, d, w);
    }
  }
  { // the top: a bell under a curved roof (hook the roof to swing up)
    const top = tdeck[4], y = TY[4];
    for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) { A.tag = top; post(x, z, y, y + 4.2, 0.36); A.tag = null; }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 6.2, 2.4, 4, 1), roof); cap.rotation.y = Math.PI / 4; prop(A, top, cap, 0, y + 5.4, 0);
    prop(A, top, new THREE.Mesh(new THREE.ConeGeometry(0.3, 2.6, 8), bronze), 0, y + 7.7, 0);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 1.6, 16, 1, true), bronze); bell.material.side = THREE.DoubleSide; prop(A, top, bell, 0, y + 3.2, 0);
    const ray = { x0: -4.5, x1: 4.5, y0: y + 4.4, y1: y + 6.4, z0: -4.5, z1: 4.5 }; A.rayBoxes.push(ray); top.rays.push(ray);
    A.pillars.push({ x: 0, z: 0, w: 6 });
  }

  // ---- corner blocks: a two-storey house with stairs to its roof, a watchtower, hay and a fenced yard
  for (let k = 0; k < 4; k++) {
    const [tx, tz] = rot(k, 28, 28), t = tiles[Math.sign(tx) + ',' + Math.sign(tz)], R = (x, z) => { const [a, b] = rot(k, x, z); return [tx + a, tz + b]; };
    A.curPlat = t.i; A.tag = t;
    const [hx0, hz0] = R(-8, -7), [hx1, hz1] = R(4, 3), x0 = Math.min(hx0, hx1), x1 = Math.max(hx0, hx1), z0 = Math.min(hz0, hz1), z1 = Math.max(hz0, hz1);
    room(x0, x1, z0, z1, 0, 4.1, { doors: [0.5] });
    A.addBox(x0 - 0.2, x1 + 0.2, 4.1, 4.5, z0 - 0.2, z1 + 0.2, W); // the upper floor
    room(x0, x1, z0, z1, 4.5, 8.6, { doors: [], win: [0.3, 0.7] });
    A.tag = null;
    const rf = parentOf(deck(A, { x: (x0 + x1) / 2, z: (z0 + z1) / 2, y: 9, w: x1 - x0 + 0.4, d: z1 - z0 + 0.4, mat: roof, kind: 'roof', thick: 0.4 }), t);
    eaves(rf, x0 - 0.2, x1 + 0.2, z0 - 0.2, z1 + 0.2, 9, 1.3, [[3], [1], [2], [0]][k]);
    const [sa, sb] = R(5.5, 11), [sc, sd] = R(5.5, -5.5); stairs(t, rf, sa, sb, sc, sd, 2.4);
    // watchtower in the far corner: four posts up to a lookout deck
    const [wx, wz] = R(10.2, -10.2);
    A.tag = t; for (const [px, pz] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) post(wx + px, wz + pz, 0, 15.6, 0.4); A.tag = null;
    const wt = parentOf(deck(A, { x: wx, z: wz, y: 16, w: 5, d: 5, mat: W, kind: 'watch', thick: 0.4 }), t);
    A.curPlat = wt.i; fence(A, wx - 2.4, wz - 2.4, wx + 2.4, wz - 2.4, 16); fence(A, wx - 2.4, wz + 2.4, wx + 2.4, wz + 2.4, 16); A.curPlat = t.i;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 4.4, 2, 4, 1), roof); cap.rotation.y = Math.PI / 4; prop(A, wt, cap, wx, 19.2, wz);
    const ray = { x0: wx - 3, x1: wx + 3, y0: 18.4, y1: 20, z0: wz - 3, z1: wz + 3 }; A.rayBoxes.push(ray); wt.rays.push(ray);
    A.pillars.push({ x: wx, z: wz, w: 5 }); foot.push([wx - 2.6, wx + 2.6, wz - 2.6, wz + 2.6]);
    // hay bales, a woodpile, and a fenced yard
    const [bx, bz] = R(-9.5, 7.5); stack(A, bx, bz, 0, 3, 3, 2, 1.2, 0.8, 0.8, 'straw');
    const [cx, cz] = R(10, 6); stack(A, cx, cz, 0, 2, 2, 2, 1, 1, 1, 'wood');
    const [f0x, f0z] = R(-13, 3.5), [f1x, f1z] = R(-13, 13); fence(A, f0x, f0z, f1x, f1z, 0);
    const [f2x, f2z] = R(-13, 13), [f3x, f3z] = R(-1, 13); fence(A, f2x, f2z, f3x, f3z, 0);
    foot.push([Math.min(sa, sc) - 1.3, Math.max(sa, sc) + 1.3, Math.min(sb, sd) - 1.3, Math.max(sb, sd) + 1.3]);
  }

  // ---- the four side blocks: a training hall, a straw barn, a market, a tea garden
  const roofTo = (t, x0, x1, z0, z1, y, k, sx, sz, ex, ez) => { // flat roof + eaves + stairs up one side
    const rf = parentOf(deck(A, { x: (x0 + x1) / 2, z: (z0 + z1) / 2, y, w: x1 - x0 + 0.4, d: z1 - z0 + 0.4, mat: roof, kind: 'roof', thick: 0.4 }), t);
    eaves(rf, x0 - 0.2, x1 + 0.2, z0 - 0.2, z1 + 0.2, y, 1.2, k);
    stairs(t, rf, sx, sz, ex, ez, 2.2); foot.push([Math.min(sx, ex) - 1.2, Math.max(sx, ex) + 1.2, Math.min(sz, ez) - 1.2, Math.max(sz, ez) + 1.2]);
    return rf;
  };
  { // east: the training hall, a long paper hall with a partition, dummies inside and out
    const t = tiles['1,0']; A.curPlat = t.i; A.tag = t;
    room(23, 33, -9, 9, 0, 4.6, { dn: [0.5], ds: [0.5], dw: [0.25, 0.75], de: [0.5], win: [0.25, 0.75] });
    wall(A, 23.16, 0, 32.84, 0, 0, 4.6, { ceil: true, doors: [0.3, 0.7] });
    A.tag = null;
    roofTo(t, 23, 33, -9, 9, 5, [2], 36.8, 10, 36.8, -6);
    for (const [x, z] of [[26, -5], [30, -5], [26, 5], [30, 5], [18, -10], [18, 10], [17, 0]]) dummy(A, x, z, 0);
    stack(A, 38.5, -11, 0, 2, 3, 2, 1.2, 0.8, 0.8, 'straw');
  }
  { // north: the straw barn, hay everywhere and a fenced pen
    const t = tiles['0,-1']; A.curPlat = t.i; A.tag = t;
    room(-6, 6, -36, -24, 0, 5.1, { kind: 'straw', doors: [0.5] });
    A.tag = null;
    roofTo(t, -6, 6, -36, -24, 5.5, [0], -8.2, -22, -8.2, -33);
    for (const [x, z, nx, ny] of [[-2, -31, 3, 3], [2.5, -28, 2, 2], [11, -21, 3, 2], [-11, -40, 3, 2], [10, -38, 2, 3], [-12, -18, 2, 2]]) stack(A, x, z, 0, nx, ny, 2, 1.2, 0.8, 0.8, 'straw');
    fence(A, 8, -32, 13, -32, 0); fence(A, 13, -32, 13, -24, 0); fence(A, 8, -24, 13, -24, 0);
  }
  { // west: the market street, stalls, crates and folding screens, and a little shop with a roof deck
    const t = tiles['-1,0']; A.curPlat = t.i; A.tag = t;
    room(-38, -30, -12, -4, 0, 4.2, { doors: [0.5], win: [0.25, 0.75] });
    A.tag = null;
    roofTo(t, -38, -30, -12, -4, 4.6, [1], -40.2, 1, -40.2, -9.5);
    const rr = (x, z) => [x, z];
    for (const [x, z] of [[-24, 4], [-24, 10], [-33, 9], [-20, -9]]) stall(A, x, z, 0, rr);
    for (const [x, z] of [[-17, 3], [-28, -1]]) stack(A, x, z, 0, 2, 2, 2, 1, 1, 1, 'wood');
    wall(A, -36, 3, -31, 3, 0, 1.9, { posts: false });
    wall(A, -19, 6, -19, 11, 0, 1.9, { posts: false });
  }
  { // south: the tea garden, a small teahouse, a bamboo grove and fences
    const t = tiles['0,1']; A.curPlat = t.i; A.tag = t;
    room(4, 12, 28, 36, 0, 4.2, { doors: [0.5], win: [0.25, 0.75] });
    A.tag = null;
    roofTo(t, 4, 12, 28, 36, 4.6, [3], 14.2, 39, 14.2, 30.5);
    fence(A, -13, 22, -2, 22, 0); fence(A, -2, 22, -2, 32, 0);
    for (const [x, z] of [[-6, 40], [2, 22]]) { prop(A, t, new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.8), M.stone), x, 0.55, z); prop(A, t, new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), lamp), x, 1.35, z); prop(A, t, new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.6, 4), M.stone), x, 1.9, z).rotation.y = Math.PI / 4; }
    for (let i = 0; i < 70; i++) { const x = -12 + r() * 9.5, z = 23 + r() * 17; stalk(A, x, z, 0.12 + r() * 0.06); }
  }
  A.curPlat = undefined;

  // ---- rooftop bridges: each corner house to the tower's first deck
  for (const key of ['1,1', '-1,1', '1,-1', '-1,-1']) {
    const t = tiles[key], rf = A.plats.find((p) => p.kind === 'roof' && p.parent === t.i && p.y === 9);
    parentOf(bridge(A, rf, tdeck[1], 2.6, W, rope), t);
  }
  // ---- floating shrine islands off the four side blocks, joined by bridges
  [[1, 0, 6], [0, -1, 11], [-1, 0, 4], [0, 1, 9]].forEach(([ix, iz, y]) => {
    const x = ix * 66, z = iz * 66, t = tiles[ix + ',' + iz];
    const p = deck(A, { x, z, y, w: 16, d: 16, mat: M.stone, kind: 'island', thick: 2.5, sx: -ix * 4 + iz * 4, sz: -iz * 4 + ix * 4 });
    prop(A, p, new THREE.Mesh(new THREE.BoxGeometry(15.4, 0.12, 15.4), moss), x, y + 0.03, z).receiveShadow = true;
    const under = new THREE.Mesh(new THREE.ConeGeometry(10, 18, 6), rock); under.rotation.x = Math.PI; prop(A, p, under, x, y - 11.5, z);
    A.curPlat = p.i; A.tag = p;
    const hx = x + ix * 3.5, hz = z + iz * 3.5;
    room(hx - 3, hx + 3, hz - 3, hz + 3, y, y + 3.8, { doors: [0.5] });
    A.tag = null;
    const cap = parentOf(deck(A, { x: hx, z: hz, y: y + 4.2, w: 6.4, d: 6.4, mat: roof, kind: 'roof', thick: 0.4 }), p);
    eaves(cap, hx - 3.2, hx + 3.2, hz - 3.2, hz + 3.2, y + 4.2, 1.1);
    stack(A, x - iz * 5 - ix * 4, z + ix * 5 - iz * 4, y, 2, 2, 2, 1.2, 0.8, 0.8, 'straw');
    dummy(A, x + iz * 5 - ix * 4, z - ix * 5 - iz * 4, y);
    A.curPlat = undefined;
    parentOf(bridge(A, t, p, 3, W, rope), t);
  });

  // ---- bamboo and lantern poles along the town's edges (cut them, swing from them)
  for (let i = 0; i < 120; i++) {
    const a = r() * TAU, d = 30 + r() * 12, x = Math.cos(a) * d * 1.25, z = Math.sin(a) * d * 1.25;
    if (Math.abs(x) > 41 || Math.abs(z) > 41) continue;
    if (foot.some(([x0, x1, z0, z1]) => x > x0 - 1.2 && x < x1 + 1.2 && z > z0 - 1.2 && z < z1 + 1.2)) continue;
    if (A.brk.list.some((b) => x > b.x0 - 1 && x < b.x1 + 1 && z > b.z0 - 1 && z < b.z1 + 1)) continue;
    stalk(A, x, z, 0.12 + r() * 0.07);
  }
  A.plantStalks(0, 15);
  finishBrk(A);
  A.onDrop = (p) => {
    for (const b of A.brk.list) if (b.alive && b.plat === p.i) kill(A, b);
    for (const q of A.plats) if (q.parent === p.i && !q.gone) A.dropPlatform(q.i);
  };
  A.finishNav();

  // ---- backdrop: misty blue mountains with snow caps, a great volcano, pines, a sea of cloud, drifting petals
  farRing(A, 14, 400, (x, z, i) => {
    const h = 110 + (i % 4) * 40, rad = 70 + (i % 3) * 22, m = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 7), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x8c9cc0 : 0x9fadcc, fog: false }));
    m.position.set(x, -80 + h / 2, z); m.rotation.y = i; S.add(m);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.28, h * 0.28, 7), new THREE.MeshBasicMaterial({ color: 0xf4f2f6, fog: false })); snow.position.set(x, -80 + h - h * 0.14 + 0.5, z); snow.rotation.y = i; S.add(snow);
  });
  { const a = Math.atan2(-A.sunOff.z, -A.sunOff.x), x = Math.cos(a) * 460, z = Math.sin(a) * 460;
    const v = new THREE.Mesh(new THREE.CylinderGeometry(26, 190, 230, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x7a88b0, fog: false })); v.position.set(x, 15 - 80, z); S.add(v);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(26, 70, 64, 24, 1), new THREE.MeshBasicMaterial({ color: 0xf6f4f8, fog: false })); cap.position.set(x, 15 + 115 - 32 - 80 + 0.5, z); S.add(cap); }
  { const im = new THREE.InstancedMesh(new THREE.ConeGeometry(4, 16, 5), new THREE.MeshBasicMaterial({ color: 0x4f5a72, fog: false }), 150), mm = new THREE.Matrix4();
    for (let i = 0; i < 150; i++) { const a = r() * TAU, d = 300 + r() * 60, s = 0.7 + r() * 1.2; mm.compose(new THREE.Vector3(Math.cos(a) * d, -72 + 8 * s, Math.sin(a) * d), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); im.setMatrixAt(i, mm); }
    S.add(im); }
  const sea = new THREE.Mesh(new THREE.CircleGeometry(620, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf3e6e8, transparent: true, opacity: 0.95 })); sea.position.y = -70; S.add(sea);
  drift(A, 300, 0xffc8dc, 0.15, [1.0, -0.5, 0.6], 0.5);
  void dark;
}
