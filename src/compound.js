// The Horde's maps: compounds. A solid mass of buildings with rooms and passages cut into it, like a floor plan seen
// from above: rooms to make a stand in, passages that twist and double back, and loops everywhere so you are never
// cornered for long. The walls stand far too high to get over (they can't be hooked, and an unseen ceiling at their
// tops stops any climb), so the horde has to come at you through the doors, and you have to keep moving. Beams cross
// the passages overhead and tall pillars stand in the big rooms: those you can hook, to haul yourself along or up.
//
// A layout is drawn on a grid of 2.5 m cells, cut out of the solid:
//   rooms  rectangles of cells [i0, j0, i1, j1] (inclusive);
//   halls  [width, [i, j], [i, j], ...]: a passage `width` cells wide run from point to point (each point is the
//          top-left cell of the passage there), turning wherever the points do; a slanted leg is cut in steps;
//   walls  rectangles put back in afterwards (a partition across a room).
// The three are laid out differently on purpose: a warren of small rooms and doglegs, a town with one winding
// street and back alleys, and a fort of great halls joined by long snaking tunnels. Everything else here is worked
// out from the grid: the blocks, pillars, crates, beams, lanterns, the places to come in, the painted floor, and
// the way the bots find their route.
import * as THREE from 'three';

const CELL = 2.5, G = 50, H = 14; // cell size, cells each way, how high the walls stand (and where the unseen ceiling is)
const LAYOUTS = {
  // Stone Warrens: sixteen small rooms in a castle, joined by short passages that dogleg and zigzag; some rooms
  // have no door to their neighbour, so the way round is never the straight one
  warrens: { rooms: [[16, 36, 24, 47], [2, 2, 9, 8], [14, 2, 22, 7], [14, 8, 16, 10], [27, 2, 34, 9], [39, 2, 47, 10], [2, 13, 8, 21], [13, 12, 20, 19], [25, 14, 33, 22], [38, 15, 47, 22],
      [2, 26, 10, 33], [15, 25, 22, 31], [27, 27, 35, 34], [40, 27, 47, 35], [3, 38, 11, 47], [29, 39, 36, 47], [41, 40, 47, 47]],
    halls: [[3, [10, 4], [13, 4]], [2, [23, 3], [24, 3], [24, 6], [26, 6]], [3, [35, 5], [38, 5]], [2, [4, 9], [4, 10], [6, 10], [6, 12]], [3, [9, 16], [12, 16]],
      [2, [18, 8], [18, 9], [16, 9], [16, 11]], [2, [30, 10], [30, 11], [28, 11], [28, 13]], [3, [34, 18], [37, 18]], [2, [43, 11], [43, 12], [41, 12], [41, 14]],
      [2, [4, 22], [4, 23], [6, 23], [6, 25]], [2, [14, 20], [14, 22], [18, 22], [18, 24]], [3, [23, 28], [26, 28]], [2, [31, 23], [31, 24], [29, 24], [29, 26]], [3, [36, 30], [39, 30]],
      [2, [5, 34], [5, 35], [7, 35], [7, 37]], [3, [12, 41], [15, 41]], [2, [19, 32], [19, 33], [21, 33], [21, 35]], [3, [25, 42], [28, 42]], [2, [32, 35], [32, 36], [34, 36], [34, 38]],
      [2, [45, 36], [45, 37], [43, 37], [43, 39]], [2, [21, 12], [23, 12], [23, 10], [25, 10], [25, 13]], [2, [11, 30], [12, 30], [12, 34], [14, 34], [14, 37], [15, 37]], [2, [37, 44], [38, 44], [38, 37], [39, 37]]],
    walls: [[20, 39, 20, 44], [29, 16, 29, 20], [41, 6, 45, 6], [5, 29, 7, 29]] },
  // Lantern Alleys: a town at night. One broad street winds through it from the south-west gate to the north-east
  // one; yards open off it, and narrow back alleys twist between them
  alleys: { rooms: [[2, 38, 8, 47], [8, 24, 15, 31], [22, 26, 30, 34], [26, 12, 34, 19], [41, 10, 48, 18], [40, 1, 48, 7], [2, 2, 10, 9], [36, 36, 46, 46], [3, 13, 9, 19], [22, 40, 30, 47]],
    halls: [[4, [3, 42], [12, 42], [18, 36], [18, 28], [24, 22], [32, 22], [38, 16], [38, 8], [44, 4]],
      [2, [5, 37], [5, 34], [9, 34], [9, 32]], [2, [10, 23], [10, 21], [6, 21], [6, 20]], [2, [5, 12], [5, 10]], [2, [11, 5], [15, 5], [15, 9], [20, 9], [20, 14], [25, 14]],
      [2, [29, 20], [29, 21]], [2, [35, 14], [37, 14]], [2, [25, 35], [25, 39]], [2, [31, 43], [33, 43], [33, 40], [35, 40]], [2, [42, 35], [42, 30], [45, 30], [45, 24], [43, 24], [43, 19]],
      [2, [31, 30], [34, 30], [34, 34], [37, 34], [37, 35]], [2, [16, 27], [17, 27]], [2, [16, 44], [21, 44]], [2, [39, 3], [30, 3], [30, 11]], [2, [11, 28], [11, 34], [13, 34], [13, 39]]],
    walls: [[25, 29, 27, 29], [39, 40, 39, 43], [44, 13, 46, 13]] },
  // Frost Garrison: a fort in the snow. A hub in the middle and eight great halls round it, joined by two long
  // tunnels that snake across the north and the south, and by crooked passages down each side
  garrison: { rooms: [[20, 41, 29, 47], [19, 19, 30, 30], [3, 3, 13, 11], [36, 3, 46, 12], [3, 37, 13, 46], [36, 38, 46, 46], [20, 2, 29, 8], [2, 20, 8, 29], [41, 19, 47, 30]],
    halls: [[3, [14, 6], [16, 6], [16, 12], [23, 12], [23, 15], [32, 15], [32, 9], [35, 9]], [3, [14, 42], [16, 42], [16, 36], [24, 36], [24, 33], [33, 33], [33, 40], [35, 40]],
      [2, [24, 9], [24, 11]], [2, [25, 39], [25, 40]], [2, [6, 12], [6, 15], [4, 15], [4, 19]], [2, [4, 30], [4, 33], [7, 33], [7, 36]], [2, [42, 13], [42, 16], [44, 16], [44, 18]], [2, [44, 31], [44, 34], [41, 34], [41, 37]],
      [3, [24, 18], [24, 18]], [3, [24, 31], [24, 31]], [3, [9, 24], [13, 24], [13, 26], [18, 26]], [3, [31, 23], [35, 23], [35, 26], [40, 26]],
      [2, [10, 12], [10, 17], [13, 17], [13, 20]], [2, [38, 31], [38, 35], [36, 35], [36, 37]]],
    walls: [[24, 23, 25, 26], [8, 6, 8, 8], [41, 41, 41, 43]] },
};
export const COMPOUNDS = Object.keys(LAYOUTS);
const THEMES = {
  warrens: { sky: { top: 0x3f6fb4, mid: 0xf0c79a, bot: 0xd9a070, fog: 0xe6c6a4, near: 70, far: 330, hemiSky: 0xfff2dc, hemiGround: 0xb8a48c, hemi: 2.2, sunColor: 0xffe2b8, sun: 2.3, sunOff: new THREE.Vector3(-24, 78, 20) },
    wall: 0xb8b0a4, roof: 0x5d5a60, floor: ['#8d8a86', '#74716e', '#a09c96'], lamp: 0xffb060, beam: 0x5a3d28, crest: 'rgba(150,40,34,0.55)', land: 0x7c8a5c },
  alleys: { sky: { top: 0x04060f, mid: 0x1b2440, bot: 0x0b0f1c, fog: 0x1a2238, near: 40, far: 260, hemiSky: 0x9fafe8, hemiGround: 0x4a4450, hemi: 1.7, sunColor: 0xa9c0ff, sun: 1.5, sunOff: new THREE.Vector3(26, 80, -18) },
    wall: 0xd9cfbd, roof: 0x23252d, floor: ['#4c4a50', '#3c3a40', '#5a585e'], lamp: 0xffa040, beam: 0x3a2618, crest: 'rgba(214,150,60,0.5)', land: 0x232a26, night: true, timber: true },
  garrison: { sky: { top: 0x8fa6c6, mid: 0xe9eef4, bot: 0xffffff, fog: 0xe2e8f0, near: 50, far: 280, hemiSky: 0xffffff, hemiGround: 0xb8c4d4, hemi: 1.75, sunColor: 0xfff6ea, sun: 1.7, sunOff: new THREE.Vector3(20, 76, 28) },
    wall: 0xb9c2cc, roof: 0xf2f6fa, floor: ['#dfe5ec', '#c9d1da', '#eef2f6'], lamp: 0xffc070, beam: 0x4a3a30, crest: 'rgba(44,90,160,0.5)', land: 0xe6ecf2 },
};

export function buildCompound(A, T) {
  const S = A.scene, id = A.mapId, L = LAYOUTS[id], TH = THEMES[id], low = A.quality === 'low', r = T.rng(900 + id.length * 37 + id.charCodeAt(0));
  A.plats = []; A.pillars = []; A.killY = -30; A.setSky(TH.sky);
  const O = -G * CELL / 2, cx = (i) => O + (i + 0.5) * CELL, X0 = (i) => O + i * CELL; // (a cell's middle; its near edge)

  // ---- the grid: '#' solid, '.' floor, 'o' a pillar, 'x' a crate. Rooms are cut first, then the halls from point to point, then the partitions put back
  const g = Array.from({ length: G }, () => Array(G).fill('#'));
  const carve = (i0, j0, i1, j1, c) => { for (let j = Math.max(1, j0); j <= Math.min(G - 2, j1); j++) for (let i = Math.max(1, i0); i <= Math.min(G - 2, i1); i++) g[j][i] = c; };
  for (const [i0, j0, i1, j1] of L.rooms) carve(i0, j0, i1, j1, '.');
  const legs = []; // (every straight leg of every hall: [i, j, length, does it run along z, width], for the beams)
  for (const [w, ...pts] of L.halls) for (let k = 0; k < pts.length; k++) { const [a, b] = pts[k], [c, d] = pts[Math.min(k + 1, pts.length - 1)], n = Math.max(Math.abs(c - a), Math.abs(d - b), 1);
    for (let s = 0; s <= n; s++) { const i = Math.round(a + (c - a) * s / n), j = Math.round(b + (d - b) * s / n); carve(i, j, i + w - 1, j + w - 1, '.'); } // (a slanted leg comes out stepped)
    if (k + 1 < pts.length && (a === c || b === d)) legs.push(a === c ? [a, Math.min(b, d), Math.abs(d - b) + w, true, w] : [Math.min(a, c), b, Math.abs(c - a) + w, false, w]); }
  for (const [i0, j0, i1, j1] of L.walls || []) carve(i0, j0, i1, j1, '#');
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
    if (g[j][i] === 'o') { A.addDisc(cx(i), cx(j), 0.8, 0, H, id === 'alleys' ? beamM : wallM, 14); A.pillars.push({ x: cx(i), z: cx(j), w: 1.7 }); } // (as tall as the walls: hook it high and swing)
    if (g[j][i] === 'x') { const s = 0.75 + r() * 0.3, hh = 1.0 + r() * 0.5; A.addBox(cx(i) - s, cx(i) + s, 0, hh, cx(j) - s, cx(j) + s, crateM, { plain: true }); } }

  // ---- beams overhead along every hall, to hook and haul yourself down it (not solid: you pass under them)
  { const beams = []; let nb = 0;
    for (const [i, j, len, alongZ, w] of legs) for (let k = 1; k < len; k += 4) { const bi = alongZ ? i : i + k, bj = alongZ ? j + k : j, span = Array.from({ length: w }, (_, q) => (alongZ ? open(bi + q, bj) : open(bi, bj + q))).every(Boolean);
      if (!span || (alongZ ? open(bi - 1, bj) || open(bi + w, bj) : open(bi, bj - 1) || open(bi, bj + w))) continue; // (only where there is a wall at each end to carry it)
      const y = nb++ % 2 ? 9.2 : 5; // (a low one, then a high one)
      const b = alongZ ? { x0: X0(bi), x1: X0(bi + w), y0: y, y1: y + 0.5, z0: cx(bj) - 0.24, z1: cx(bj) + 0.24 } : { x0: cx(bi) - 0.24, x1: cx(bi) + 0.24, y0: y, y1: y + 0.5, z0: X0(bj), z1: X0(bj + w) };
      A.rayBoxes.push(b); beams.push(b); }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), beamM, beams.length), mt = new THREE.Matrix4();
    beams.forEach((b, k) => { mt.makeScale(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0).setPosition((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2); im.setMatrixAt(k, mt); }); im.castShadow = true; im.frustumCulled = false; S.add(im); }

  // ---- lanterns on the walls (they glow; at night a light in the middle of each big room too)
  { const lamps = [];
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { if (!open(i, j) || (i * 7 + j * 13) % 5) continue;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!open(i + di, j + dj)) { lamps.push([cx(i) + di * (CELL / 2 - 0.12), 3.1, cx(j) + dj * (CELL / 2 - 0.12)]); if ((i + j) % 2) lamps.push([cx(i) + di * (CELL / 2 - 0.12), 8.8, cx(j) + dj * (CELL / 2 - 0.12)]); break; } } // (and a second lantern high up on some)
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.34, 0.22), lampM, lamps.length), mt = new THREE.Matrix4();
    lamps.forEach(([x, y, z], k) => { mt.makeTranslation(x, y, z); im.setMatrixAt(k, mt); }); im.frustumCulled = false; S.add(im);
    if (TH.night && !low) for (const [i0, j0, i1, j1] of L.rooms.slice(0, 6)) { const p = new THREE.PointLight(TH.lamp, 44, 46, 1.6); p.position.set(X0((i0 + i1 + 1) / 2), 7, X0((j0 + j1 + 1) / 2)); S.add(p); } }

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
