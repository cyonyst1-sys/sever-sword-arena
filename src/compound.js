// The Horde's maps: compounds. A solid mass of buildings with rooms and corridors cut into it, like a floor plan seen
// from above: big rooms to make a stand in, long corridors to run down, and loops everywhere so you are never cornered
// for long. There is no way over the walls (they can't be hooked, and an unseen ceiling stops a climb), so the horde
// has to come at you through the doors, and you have to keep moving. Beams cross the corridors overhead and pillars
// stand in the big rooms: those you can hook, to haul yourself along.
//
// A layout is drawn on a grid of 3 m cells: rooms and halls are rectangles of cells [i0, j0, i1, j1] (inclusive) cut out
// of the solid. Everything else here is worked out from that: the blocks, pillars, crates, beams, lanterns, the places
// to come in, the painted floor, and a grid the bots find their way on.
import * as THREE from 'three';

const CELL = 3, G = 42, H = 6.4; // cell size, cells each way, how high the walls stand (and where the unseen ceiling is)
const LAYOUTS = {
  // Stone Warrens: nine rooms of a castle joined by passages, a court in the middle
  warrens: { rooms: [[16, 32, 25, 39], [2, 24, 9, 31], [3, 4, 10, 11], [16, 2, 24, 8], [30, 3, 39, 10], [31, 18, 39, 26], [30, 32, 38, 38], [16, 15, 25, 23], [3, 15, 8, 19]],
    halls: [[20, 24, 21, 31], [6, 34, 15, 35], [6, 32, 7, 33], [5, 20, 6, 23], [5, 12, 6, 14], [11, 6, 15, 7], [25, 5, 29, 6], [35, 11, 36, 17], [34, 27, 35, 31], [26, 35, 29, 36],
      [9, 17, 15, 18], [19, 9, 20, 14], [26, 20, 30, 21], [24, 12, 25, 14], [26, 12, 33, 13], [32, 11, 33, 11], [10, 27, 15, 28], [14, 22, 15, 26]] },
  // Lantern Alleys: a town at night. A ring of alleys round a well, a spoke to each side, yards and nooks off it
  alleys: { rooms: [[17, 33, 24, 39], [2, 16, 11, 24], [15, 2, 26, 9], [31, 14, 39, 22], [18, 18, 23, 23], [3, 31, 9, 38], [32, 3, 38, 8], [31, 30, 38, 37]],
    halls: [[13, 13, 28, 14], [13, 27, 28, 28], [13, 13, 14, 28], [27, 13, 28, 28], [20, 15, 21, 17], [20, 24, 21, 26], [15, 20, 17, 21], [24, 20, 26, 21],
      [20, 10, 21, 12], [20, 29, 21, 32], [12, 20, 12, 21], [29, 18, 30, 19], [10, 35, 16, 36], [5, 25, 6, 30], [6, 5, 7, 15], [8, 5, 14, 6], [27, 5, 31, 6], [35, 9, 36, 13], [34, 23, 35, 29], [25, 34, 30, 35]] },
  // Frost Garrison: a fort in the snow. A great drill yard, a hall on each side of it, a walk right round inside the walls, a tower at each corner
  garrison: { rooms: [[14, 14, 27, 27], [17, 2, 24, 7], [16, 33, 25, 39], [2, 17, 8, 24], [33, 16, 39, 25], [2, 3, 7, 9], [34, 3, 39, 9], [2, 32, 7, 38], [34, 32, 39, 38]],
    halls: [[20, 8, 21, 13], [20, 28, 21, 32], [9, 20, 13, 21], [28, 20, 32, 21], [4, 10, 37, 11], [4, 30, 37, 31], [4, 10, 5, 31], [36, 10, 37, 31]] },
};
export const COMPOUNDS = Object.keys(LAYOUTS);
const THEMES = {
  warrens: { sky: { top: 0x3f6fb4, mid: 0xf0c79a, bot: 0xd9a070, fog: 0xe6c6a4, near: 70, far: 330, hemiSky: 0xfff2dc, hemiGround: 0xa8947c, hemi: 1.75, sunColor: 0xffe2b8, sun: 2.3, sunOff: new THREE.Vector3(-24, 78, 20) },
    wall: 0xb8b0a4, roof: 0x5d5a60, floor: ['#8d8a86', '#74716e', '#a09c96'], lamp: 0xffb060, beam: 0x5a3d28, crest: 'rgba(150,40,34,0.55)', land: 0x7c8a5c },
  alleys: { sky: { top: 0x04060f, mid: 0x1b2440, bot: 0x0b0f1c, fog: 0x1a2238, near: 40, far: 260, hemiSky: 0x8f9fd8, hemiGround: 0x3a3440, hemi: 1.3, sunColor: 0xa9c0ff, sun: 1.5, sunOff: new THREE.Vector3(26, 80, -18) },
    wall: 0xd9cfbd, roof: 0x23252d, floor: ['#4c4a50', '#3c3a40', '#5a585e'], lamp: 0xffa040, beam: 0x3a2618, crest: 'rgba(214,150,60,0.5)', land: 0x232a26, night: true, timber: true },
  garrison: { sky: { top: 0x8fa6c6, mid: 0xe9eef4, bot: 0xffffff, fog: 0xe2e8f0, near: 50, far: 280, hemiSky: 0xffffff, hemiGround: 0xa8b4c4, hemi: 1.35, sunColor: 0xfff6ea, sun: 1.7, sunOff: new THREE.Vector3(20, 76, 28) },
    wall: 0xb9c2cc, roof: 0xf2f6fa, floor: ['#dfe5ec', '#c9d1da', '#eef2f6'], lamp: 0xffc070, beam: 0x4a3a30, crest: 'rgba(44,90,160,0.5)', land: 0xe6ecf2 },
};

export function buildCompound(A, T) {
  const S = A.scene, id = A.mapId, L = LAYOUTS[id], TH = THEMES[id], low = A.quality === 'low', r = T.rng(900 + id.length * 37 + id.charCodeAt(0));
  A.plats = []; A.pillars = []; A.killY = -30; A.setSky(TH.sky);
  const O = -G * CELL / 2, cx = (i) => O + (i + 0.5) * CELL, X0 = (i) => O + i * CELL; // (a cell's middle; its near edge)

  // ---- the grid: '#' solid, '.' floor, 'o' a pillar, 'x' a crate
  const g = Array.from({ length: G }, () => Array(G).fill('#'));
  for (const [i0, j0, i1, j1] of [...L.rooms, ...L.halls]) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) g[j][i] = '.';
  const at = (i, j) => (i < 0 || j < 0 || i >= G || j >= G ? '#' : g[j][i]), open = (i, j) => at(i, j) !== '#', walk = (i, j) => at(i, j) === '.';
  const spawnCells = [];
  for (const [i0, j0, i1, j1] of L.rooms) {
    const w = i1 - i0 + 1, d = j1 - j0 + 1, mi = (i0 + i1) / 2, mj = (j0 + j1) / 2;
    spawnCells.push([mi, mj]); if (w >= 8) spawnCells.push([i0 + 1.5, mj], [i1 - 1.5, mj]); if (d >= 8) spawnCells.push([mi, j0 + 1.5], [mi, j1 - 1.5]);
    if (w >= 8 && d >= 8) for (const [a, b] of [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]]) g[Math.round(j0 + (d - 1) * b)][Math.round(i0 + (w - 1) * a)] = 'o'; // four pillars in a big room
    for (let k = 0; k < Math.floor(w * d / 26); k++) { const i = i0 + 2 + Math.floor(r() * Math.max(1, w - 4)), j = j0 + 2 + Math.floor(r() * Math.max(1, d - 4)); // crates, well inside (never in a doorway)
      if (g[j][i] === '.' && !spawnCells.some(([a, b]) => Math.abs(a - i) < 1.6 && Math.abs(b - j) < 1.6)) g[j][i] = 'x'; }
  }

  // ---- materials
  const stoneT = T.stoneTex(150, id === 'garrison' ? 9 : 5);
  const timberT = TH.timber ? T.canvasTex((c, s) => { const q = T.rng(31); c.fillStyle = '#e4dccb'; c.fillRect(0, 0, s, s); T.speckle(c, s, q, 5000, 0.1);
    c.fillStyle = '#33241a'; for (const u of [0, 0.5]) { c.fillRect(u * s - 5, 0, 10, s); c.fillRect(0, u * s - 5, s, 10); } c.fillRect(0, s - 5, s, 5); c.fillRect(s - 5, 0, 5, s); // dark timber framing over pale plaster
    c.save(); c.translate(s * 0.25, s * 0.25); c.rotate(0.6); c.fillRect(-3, -s * 0.36, 6, s * 0.72); c.restore(); }, 256) : null;
  const wallM = new THREE.MeshStandardMaterial({ map: timberT || stoneT, color: timberT ? 0xffffff : TH.wall, roughness: 0.93 });
  const roofM = new THREE.MeshStandardMaterial({ color: TH.roof, roughness: id === 'garrison' ? 1 : 0.8 });
  const beamM = new THREE.MeshStandardMaterial({ color: TH.beam, roughness: 0.85, map: T.woodTex() }), crateM = new THREE.MeshStandardMaterial({ map: T.woodTex(), color: id === 'garrison' ? 0xd8dde4 : 0xc8a888, roughness: 0.9 });
  const lampM = new THREE.MeshBasicMaterial({ color: TH.lamp, toneMapped: false });

  // ---- the floor: one slab under everything, painted from the grid (paving in every open cell, darker at the foot of the walls, a crest in each room)
  A.boxes.push({ x0: O - 30, x1: -O + 30, y0: -3, y1: 0, z0: O - 30, z1: -O + 30, noHook: true });
  A.plats.push({ kind: 'ground', x: 0, z: 0, y: 0, w: G * CELL, d: G * CELL, ang: 0, i: 0, meshes: [], boxes: [], ramps: [], rays: [] });
  A.node('P0', cx(L.rooms[0][0] + 2), 0, cx(L.rooms[0][1] + 2)).plat = 0; A.comp = [0]; A.hops = [[0]];
  { const tex = T.canvasTex((c, s) => { const k = s / G, q = T.rng(77); c.fillStyle = '#000'; c.fillRect(0, 0, s, s);
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { if (!open(i, j)) continue;
        for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) { c.fillStyle = TH.floor[(q() * 3) | 0]; c.fillRect(i * k + a * k / 2 + 0.6, j * k + b * k / 2 + 0.6, k / 2 - 1.2, k / 2 - 1.2); } // four flags to a cell
        c.fillStyle = 'rgba(0,0,0,0.28)'; const e = k * 0.2; if (!open(i - 1, j)) c.fillRect(i * k, j * k, e, k); if (!open(i + 1, j)) c.fillRect((i + 1) * k - e, j * k, e, k); if (!open(i, j - 1)) c.fillRect(i * k, j * k, k, e); if (!open(i, j + 1)) c.fillRect(i * k, (j + 1) * k - e, k, e); }
      c.strokeStyle = TH.crest; c.lineWidth = k * 0.35; for (const [i0, j0, i1, j1] of L.rooms) { const R = Math.min(i1 - i0, j1 - j0) * k * 0.3; c.beginPath(); c.arc((i0 + i1 + 1) / 2 * k, (j0 + j1 + 1) / 2 * k, R, 0, 7); c.stroke(); }
      T.speckle(c, s, q, 9000, 0.12); }, low ? 1024 : 2048); tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(G * CELL, G * CELL).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 })); m.position.y = 0.01; m.receiveShadow = true; S.add(m);
    const land = new THREE.Mesh(new THREE.CircleGeometry(520, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: TH.land, roughness: 1 })); land.position.y = -0.05; land.receiveShadow = true; S.add(land); } // (the country round about)

  // ---- the solid: every run of '#' cells gathered into the biggest block it makes, each its own height, with a roof slab on top
  { const used = g.map((row) => row.map(() => false)), roofs = [];
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { if (g[j][i] !== '#' || used[j][i]) continue;
      let w = 1; while (i + w < G && g[j][i + w] === '#' && !used[j][i + w] && w < 9) w++;
      let d = 1; while (j + d < G && d < 9 && Array.from({ length: w }, (_, k) => g[j + d][i + k] === '#' && !used[j + d][i + k]).every(Boolean)) d++;
      for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) used[j + b][i + a] = true;
      const edge = i === 0 || j === 0 || i + w === G || j + d === G, hh = H + 0.3 + (edge ? 1.6 : 0) + r() * 2.6, x0 = X0(i), x1 = X0(i + w), z0 = X0(j), z1 = X0(j + d);
      A.addBox(x0, x1, 0, hh, z0, z1, wallM, { plain: !!TH.timber }); Object.assign(A.boxes[A.boxes.length - 1], { noHook: true, wall: true }); // (can't be hooked, and nothing can be hooked through it)
      roofs.push([(x0 + x1) / 2, hh + 0.14, (z0 + z1) / 2, x1 - x0 + 0.3, 0.28, z1 - z0 + 0.3]); }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), roofM, roofs.length), mt = new THREE.Matrix4();
    roofs.forEach(([x, y, z, sx, sy, sz], k) => { mt.makeScale(sx, sy, sz).setPosition(x, y, z); im.setMatrixAt(k, mt); }); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; S.add(im); }
  A.tickHazards = (fighters) => { for (const f of fighters) if (f.alive && f.pos.y + 1.8 > H) { f.pos.y = H - 1.8; if (f.vel.y > 0) f.vel.y = 0; } }; // (the unseen ceiling, level with the wall tops: no climbing out over the walls, however you go up)

  // ---- pillars (to hook, and to fight round) and crates (to jump on)
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    if (g[j][i] === 'o') { A.addDisc(cx(i), cx(j), 0.62, 0, H, id === 'alleys' ? beamM : wallM, 12); A.pillars.push({ x: cx(i), z: cx(j), w: 1.3 }); }
    if (g[j][i] === 'x') { const s = 0.75 + r() * 0.3, hh = 1.0 + r() * 0.5; A.addBox(cx(i) - s, cx(i) + s, 0, hh, cx(j) - s, cx(j) + s, crateM, { plain: true }); } }

  // ---- beams overhead along every hall, to hook and haul yourself down it (not solid: you pass under them)
  { const beams = [];
    for (const [i0, j0, i1, j1] of L.halls) { const w = i1 - i0 + 1, d = j1 - j0 + 1, alongZ = d >= w, n = alongZ ? d : w;
      for (let k = 0; k < n; k += 4) { const j = alongZ ? j0 + k : j0, i = alongZ ? i0 : i0 + k;
        const b = alongZ ? { x0: X0(i0), x1: X0(i1 + 1), y0: 4.5, y1: 5.0, z0: cx(j) - 0.22, z1: cx(j) + 0.22 } : { x0: cx(i) - 0.22, x1: cx(i) + 0.22, y0: 4.5, y1: 5.0, z0: X0(j0), z1: X0(j1 + 1) };
        A.rayBoxes.push(b); beams.push(b); } }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), beamM, beams.length), mt = new THREE.Matrix4();
    beams.forEach((b, k) => { mt.makeScale(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0).setPosition((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2); im.setMatrixAt(k, mt); }); im.castShadow = true; im.frustumCulled = false; S.add(im); }

  // ---- lanterns on the walls (they glow; at night a light in the middle of each big room too)
  { const lamps = [];
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { if (!open(i, j) || (i * 7 + j * 13) % 5) continue;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!open(i + di, j + dj)) { lamps.push([cx(i) + di * (CELL / 2 - 0.12), 3.1, cx(j) + dj * (CELL / 2 - 0.12)]); break; } }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.34, 0.22), lampM, lamps.length), mt = new THREE.Matrix4();
    lamps.forEach(([x, y, z], k) => { mt.makeTranslation(x, y, z); im.setMatrixAt(k, mt); }); im.frustumCulled = false; S.add(im);
    if (TH.night && !low) for (const [i0, j0, i1, j1] of L.rooms.slice(0, 6)) { const p = new THREE.PointLight(TH.lamp, 26, 34, 1.6); p.position.set(X0((i0 + i1 + 1) / 2), 4.6, X0((j0 + j1 + 1) / 2)); S.add(p); } }

  // ---- where fighters come in: the middle of every room, and near the ends of the big ones
  for (const [i, j] of spawnCells) { if (!walk(Math.round(i), Math.round(j))) continue; const sp = new THREE.Vector3(O + (i + 0.5) * CELL, 0.05, O + (j + 0.5) * CELL); sp.plat = 0; A.spawns.push(sp); }

  // ---- finding the way: the shortest run of open cells from one place to another, then straightened wherever there is a clear line
  const ci = (v) => Math.max(0, Math.min(G - 1, Math.floor((v - O) / CELL)));
  const near = (x, z) => { const i = ci(x), j = ci(z); if (walk(i, j)) return [i, j]; let best = null, bd = 1e9; // (the open cell nearest a point that isn't in one)
    for (let b = -3; b <= 3; b++) for (let a = -3; a <= 3; a++) if (walk(i + a, j + b)) { const d = (cx(i + a) - x) ** 2 + (cx(j + b) - z) ** 2; if (d < bd) { bd = d; best = [i + a, j + b]; } } return best; };
  const clear = (x0, z0, x1, z1) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.75); // (a body's width of open floor all the way along)
    for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n; for (const [a, b] of [[0.55, 0], [-0.55, 0], [0, 0.55], [0, -0.55]]) if (!walk(ci(x + a), ci(z + b))) return false; } return true; };
  A.path = (from, to) => {
    const s = near(from.x, from.z), e = near(to.x, to.z); if (!s || !e) return [];
    const key = (i, j) => j * G + i, prev = new Map(), dist = new Map([[key(...s), 0]]), openL = [[0, s[0], s[1]]], done = new Set();
    while (openL.length) { let bi = 0; for (let k = 1; k < openL.length; k++) if (openL[k][0] < openL[bi][0]) bi = k; const [, i, j] = openL.splice(bi, 1)[0], kk = key(i, j);
      if (done.has(kk)) continue; done.add(kk); if (i === e[0] && j === e[1]) break;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const a = i + di, b = j + dj;
        if (!walk(a, b) || (di && dj && (!walk(a, j) || !walk(i, b)))) continue; // (no cutting a corner)
        const nd = dist.get(kk) + (di && dj ? 1.414 : 1), nk = key(a, b); if (nd < (dist.get(nk) ?? 1e9)) { dist.set(nk, nd); prev.set(nk, kk); openL.push([nd + Math.hypot(e[0] - a, e[1] - b), a, b]); } } }
    if (!prev.has(key(...e)) && key(...e) !== key(...s)) return [];
    const cells = []; for (let k = key(...e); k !== undefined; k = prev.get(k)) cells.unshift([cx(k % G), cx(Math.floor(k / G))]);
    const out = []; let px = from.x, pz = from.z, k = 0;
    while (k < cells.length) { let f = k; while (f + 1 < cells.length && clear(px, pz, cells[f + 1][0], cells[f + 1][1])) f++; // (as far along as can be walked to in a straight line)
      [px, pz] = cells[f]; out.push({ name: 'G', p: new THREE.Vector3(px, 0, pz) }); k = f + 1; }
    return out;
  };
  A.grid = { G, CELL, O, open, rooms: L.rooms }; // (for the map in the corner of the screen)
}
