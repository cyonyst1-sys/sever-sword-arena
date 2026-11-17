// Glass Skyline: skyscrapers above the clouds, walled in glass you swing into and smash through, and half-built
// buildings that are nothing but steel framework with a concrete deck every couple of floors. Uses the same
// breakable chunks as the Paper Dojo: every window pane shatters, office partitions and crates break, and the
// steel frames (unbreakable) are there to swing from, run along and stand on.
import * as THREE from 'three';
import { cloudHeaps } from './scenery.js?v=20261117001656';
import { deck, prop } from './maps2.js';
import { kindMats, chunk, group, wall, stack, finishBrk, kill } from './dojo.js?v=20261117001656';

const TAU = Math.PI * 2;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });

export function buildCity(A, T) {
  const S = A.scene, M = A.mats, r = T.rng(9393);
  A.plats = []; A.pillars = []; A.arcPts = []; A.killY = -50;
  A.brk = { list: [], cells: new Map(), stamp: 0 };
  kindMats(T);
  // red steel columns that cut like bamboo: a band (a bolted splice) every 2.6 m
  M.bamboo = new THREE.MeshStandardMaterial({ map: T.canvasTex((g, s) => { const gr = g.createLinearGradient(0, 0, s, 0); gr.addColorStop(0, '#7e2a12'); gr.addColorStop(0.45, '#cf5a30'); gr.addColorStop(1, '#7a2810'); g.fillStyle = gr; g.fillRect(0, 0, s, s); g.fillStyle = '#3a1408'; g.fillRect(0, 0, s, s * 0.05); g.fillStyle = '#e0e0e0'; for (let i = 0; i < 6; i++) g.fillRect(i * s / 6 + 4, s * 0.012, 4, 4); }, 128), roughness: 0.5, metalness: 0.35 });
  A.setSky({ top: 0x04061a, mid: 0x1c1a4a, bot: 0x0a0a1e, fog: 0x1c1a48, near: 130, far: 520, hemiSky: 0x8e9cec, hemiGround: 0x48246a, hemi: 1.5, sunColor: 0xbcc8ff, sun: 1.9, sunOff: new THREE.Vector3(40, 70, 25) });
  const concrete = M.concrete = std(0xffffff, { map: T.canvasTex((g, s) => { g.fillStyle = '#a3a19c'; g.fillRect(0, 0, s, s); T.speckle(g, s, T.rng(3), 3500, 0.22); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, s, 2); g.fillRect(0, 0, 2, s); }), roughness: 0.95 });
  const facade = M.facade = std(0xffffff, { map: T.canvasTex((g, s) => {
    const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, '#16263c'); gr.addColorStop(0.5, '#243c5c'); gr.addColorStop(1, '#101c2e'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
    { const gl = g.createLinearGradient(0, 0, s, s); gl.addColorStop(0.3, 'rgba(255,255,255,0)'); gl.addColorStop(0.45, 'rgba(200,225,255,0.22)'); gl.addColorStop(0.55, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(0, 0, s, s); } // (a glint across each pane)
    g.fillStyle = '#1b232c'; g.fillRect(0, 0, s, 8); g.fillRect(0, 0, 6, s);
  }), roughness: 0.08, metalness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.9 });
  // a light on here or there: one pane in forty, scattered at random over a 32 m stretch of wall (so no pattern shows)
  facade.emissiveMap = T.canvasTex((g, s) => { const q = T.rng(21), n = 16, c = s / n; g.fillStyle = '#000'; g.fillRect(0, 0, s, s); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q() < 0.025) { g.fillStyle = q() < 0.7 ? '#ffd890' : q() < 0.5 ? '#8ae0ff' : '#ff8ad8'; g.fillRect(x * c + c * 0.12, y * c + c * 0.12, c * 0.76, c * 0.76); } }, 256); facade.emissiveMap.repeat.set(1 / 16, 1 / 16);
  const dark = std(0x2a3138, { roughness: 0.5, metalness: 0.5 }), white = std(0xffffff, { roughness: 0.6, map: (() => { const t = T.canvasTex((g, s) => { const q = T.rng(12); g.fillStyle = '#dfe2e6'; g.fillRect(0, 0, s, s); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(90,100,110,${0.03 + q() * 0.06})`; g.fillRect(q() * s, 0, 4 + q() * 30, s); } for (let i = 0; i < 14; i++) { const x = q() * s, d = g.createLinearGradient(0, 0, 0, s * (0.3 + q() * 0.5)); d.addColorStop(0, 'rgba(70,70,60,0.22)'); d.addColorStop(1, 'rgba(70,70,60,0)'); g.fillStyle = d; g.fillRect(x, 0, 3 + q() * 8, s); } g.fillStyle = 'rgba(40,50,60,0.55)'; g.fillRect(0, 0, s, 3); g.fillRect(0, 0, 3, s); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, 3, s, 2); g.fillRect(3, 0, 2, s); for (const [x, y] of [[14, 14], [s - 14, 14], [14, s - 14], [s - 14, s - 14]]) { g.fillStyle = '#7a828c'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); } T.speckle(g, s, q, 2500, 0.12); }, 256); t.repeat.set(2, 2); return t; })() }), red = std(0xc23b2b), yellow = std(0xe8b422);
  const pillar = (x, z, y0, y1, w) => { const m = A.addBox(x - w / 2, x + w / 2, y0, y1, z - w / 2, z + w / 2, dark); A.pillars.push({ x, z, w }); return m; };
  const hookBox = (p, x0, x1, y0, y1, z0, z1) => { const b = { x0, x1, y0, y1, z0, z1 }; A.rayBoxes.push(b); p.rays.push(b); };
  // a run of window panes along x (az == bz) or z (ax == bx), each pane on its own: it shatters alone
  const glass = (ax, az, bx, bz, y0, y1) => {
    const alongX = Math.abs(az - bz) < 1e-6, c = alongX ? az : ax, u0 = alongX ? Math.min(ax, bx) : Math.min(az, bz), L = alongX ? Math.abs(bx - ax) : Math.abs(bz - az);
    const nc = Math.max(1, Math.round(L / 2.4)), nr = Math.max(1, Math.round((y1 - y0) / 2.9)), w = L / nc, h = (y1 - y0) / nr;
    for (let i = 0; i < nc; i++) for (let j = 0; j < nr; j++) {
      const a0 = u0 + i * w + 0.03, a1 = u0 + (i + 1) * w - 0.03, h0 = y0 + j * h + 0.03, h1 = y0 + (j + 1) * h - 0.03;
      if (alongX) chunk(A, group(), 'glass', a0, a1, h0, h1, c - 0.05, c + 0.05, true); else chunk(A, group(), 'glass', c - 0.05, c + 0.05, h0, h1, a0, a1, true);
    }
  };
  const box4 = (x0, x1, z0, z1, y0, y1) => { glass(x0 + 0.35, z0, x1 - 0.35, z0, y0, y1); glass(x0 + 0.35, z1, x1 - 0.35, z1, y0, y1); glass(x0, z0 + 0.35, x0, z1 - 0.35, y0, y1); glass(x1, z0 + 0.35, x1, z1 - 0.35, y0, y1); };
  // concrete stairs from (lx,lz) on `lo` up to (hx,hz) beside `hi`: walkable, and a surface for the bots
  const stairs = (lo, hi, lx, lz, hx, hz, w) => {
    const dx = hx - lx, dz = hz - lz, L = Math.hypot(dx, dz);
    const p = { kind: 'branch', x: (lx + hx) / 2, z: (lz + hz) / 2, y: (lo.y + hi.y) / 2, ya: lo.y, yb: hi.y, w: L, d: w, ang: Math.atan2(dz, dx), i: A.plats.length, meshes: [], boxes: [], ramps: [], rays: [], parent: lo.i };
    A.plats.push(p); A.tag = p; A.addRamp(lx, lz, hx, hz, lo.y, hi.y, w, lo.y, concrete, { noWall: true, thick: 0.4 }); A.tag = null;
    A.node('P' + p.i, lx + dx * 0.15, lo.y + (hi.y - lo.y) * 0.15, lz + dz * 0.15).plat = p.i; // (its waypoint near the foot, so a bot at the bottom heads up rather than back)
    A.link('P' + lo.i, 'P' + p.i); A.link('P' + p.i, 'P' + hi.i);
    return p;
  };

  // ---------- glass skyscrapers: a floor every 6 m, stairs zig-zagging up inside, glass all the way round ----------
  const tower = (x, z, w, d, y0, n, o = {}) => {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, H = 6, floors = [];
    for (let k = 0; k <= n; k++) { // each slab leaves open the strip where the stairs from below come up
      const y = y0 + k * H, hs = k ? (k - 1) % 2 : -1, sx0 = hs === 0 ? x0 + 3 : x0, sx1 = hs === 1 ? x1 - 3 : x1;
      const p = deck(A, { x: (sx0 + sx1) / 2, z, y, w: sx1 - sx0, d, mat: concrete, kind: k === n ? 'roof' : 'floor', thick: 0.5 });
      if (k) p.parent = floors[0].i; floors.push(p);
    }
    const base = floors[0]; A.tag = base;
    A.addBox(x0, x1, y0 - 130, y0 - 0.5, z0, z1, facade); // the tower below the lowest floor, down into the clouds
    for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) pillar(cx, cz, y0 - 0.5, y0 + n * H + 1.3, 0.7);
    A.tag = null;
    for (let k = 0; k < n; k++) {
      const lo = floors[k], hi = floors[k + 1], y = lo.y, s = k % 2, xs = s === 0 ? x0 + 1.6 : x1 - 1.6;
      A.curPlat = lo.i;
      if (k <= 1) box4(x0, x1, z0, z1, y, y + H - 0.5); else { glass(x0 + 0.35, z0, x1 - 0.35, z0, y, y + H - 0.5); glass(x0 + 0.35, z1, x1 - 0.35, z1, y, y + H - 0.5); } // (glass all round the lower floors, on two sides above)
      stairs(lo, hi, xs, z1 - 1.4, xs, z0 + 2.6, 2.5);
      const pz = z + (r() - 0.5) * 3;
      if (k < 2) wall(A, x0 + 3.3, pz, x1 - 3.3, pz, y, y + H - 0.5, { kind: 'drywall', posts: false, ceil: true, doors: [0.3, 0.75], t: 0.14 }); // drywall partitions on the lower floors
      if (k === 0) wall(A, x, z0 + 3, x, pz - 1.2, y, y + H - 0.5, { kind: 'drywall', posts: false, ceil: true, doors: [0.5], t: 0.14 });
      stack(A, x + (r() - 0.5) * (w - 8), z + (r() - 0.5) * (d - 5), y, 2, 1, 1, 0.8, 0.75, 0.7, 'wood', false); // a desk
    }
    const top = floors[n], ty = top.y; A.curPlat = top.i;
    box4(x0, x1, z0, z1, ty, ty + 1.2); // a glass parapet round the roof
    stack(A, x + w * 0.22, z - d * 0.25, ty, 2, 2, 1, 1.2, 1.1, 1.2, 'wood', false); // rooftop plant boxes
    if (o.water) { // a water tower on legs (hook it)
      const [wx, wz] = [x - w * 0.2, z + d * 0.18];
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 3.2, 16), std(0x8a6a4a)); prop(A, top, tank, wx, ty + 4.6, wz);
      prop(A, top, new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.2, 16), dark), wx, ty + 6.8, wz);
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) prop(A, top, new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.2), dark), wx + a * 1.4, ty + 1.5, wz + b * 1.4);
      hookBox(top, wx - 2, wx + 2, ty + 3, ty + 7.3, wz - 2, wz + 2);
    }
    if (o.pad) { // a helipad
      const pad = new THREE.Mesh(new THREE.CircleGeometry(4.5, 32).rotateX(-Math.PI / 2), yellow); prop(A, top, pad, x + 1.5, ty + 0.03, z).castShadow = false;
      const h = new THREE.Mesh(new THREE.CircleGeometry(3.6, 32).rotateX(-Math.PI / 2), dark); prop(A, top, h, x + 1.5, ty + 0.04, z).castShadow = false;
      for (const [bx, bz, bw, bd] of [[-1, 0, 0.5, 3.4], [1, 0, 0.5, 3.4], [0, 0, 2, 0.5]]) prop(A, top, new THREE.Mesh(new THREE.BoxGeometry(bw, 0.02, bd), white), x + 1.5 + bx, ty + 0.06, z + bz).castShadow = false;
    }
    if (o.mast) { // a radio mast with a red light (hook it)
      prop(A, top, new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 20, 6), white), x, ty + 10, z);
      prop(A, top, new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 })), x, ty + 20.2, z);
      hookBox(top, x - 0.4, x + 0.4, ty + 1, ty + 20, z - 0.4, z + 0.4); A.pillars.push({ x, z, w: 0.6 });
    }
    A.curPlat = undefined;
    return floors;
  };
  tower(-13, -30, 16, 18, -4, 3, { water: true }); // (few floors: less to search, quicker to find a fight)
  tower(14, -30, 18, 16, 2, 2, { pad: true });
  tower(-14, 31, 18, 18, 4, 4, { mast: true });
  tower(13, 30, 16, 16, -6, 2, { water: true });

  // ---------- half-built buildings: a steel frame (columns every ~6 m, beams every 4 m) and a deck every couple of floors ----------
  const frame = (x, z, w, d, yb, top, decks, o = {}) => {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    const nx = Math.round(w / 6), nz = Math.round(d / 6), xs = [], zs = [];
    for (let i = 0; i <= nx; i++) xs.push(x0 + i * w / nx);
    for (let i = 0; i <= nz; i++) zs.push(z0 + i * d / nz);
    const ps = decks.map(([y, fx0, fx1, fz0, fz1]) => { // [height, and which part of the footprint it covers, 0..1]
      const a = x0 + fx0 * w, b = x0 + fx1 * w, c = z0 + fz0 * d, e = z0 + fz1 * d;
      return deck(A, { x: (a + b) / 2, z: (c + e) / 2, y, w: b - a, d: e - c, mat: concrete, kind: 'deck', thick: 0.4 });
    });
    for (const p of ps.slice(1)) p.parent = ps[0].i;
    A.curPlat = ps[0].i; const g = group();
    for (const X of [x0, x1]) for (const Z of [z0, z1]) { A.bamboo.push({ x: X, z: Z, r: 0.34, segs: [], inst: A.bamboo.length }); A.pillars.push({ x: X, z: Z, w: 0.7 }); } // only the corner columns: they rise into the sky, and you can hook them or slice them through (the top falls)
    for (const y of [...new Set(decks.map((k) => k[0]))]) { // beams only round the edge of the levels with a deck (the rest is just the outer columns)
      for (const Z of [z0, z1]) chunk(A, g, 'steel', x0 - 0.25, x1 + 0.25, y - 0.4, y, Z - 0.15, Z + 0.15, true);
      for (const X of [x0, x1]) chunk(A, g, 'steel', X - 0.15, X + 0.15, y - 0.4, y, z0 - 0.25, z1 + 0.25, true);
    }
    ps.forEach((p, k) => { // what's lying around on each deck: drywall sheets, pallets of crates, a partition going up
      A.curPlat = p.i; const hw = p.w / 2, hd = p.d / 2;
      stack(A, p.x - hw * 0.5, p.z + hd * 0.4, p.y, 1, 6, 1, 2.4, 0.12, 1.2, 'drywall', false);
      stack(A, p.x + hw * 0.45, p.z - hd * 0.45, p.y, 2, 2, 2, 1, 1, 1, 'wood');
      if (k % 2 === 0 && p.w > 10) wall(A, p.x - hw + 1.5, p.z, p.x + hw - 1.5, p.z, p.y, p.y + 3.6, { kind: 'drywall', posts: false, doors: [0.5], t: 0.14 });
      if (k === 0) wall(A, p.x, p.z - hd + 1.5, p.x, p.z + hd - 1.5, p.y, p.y + 3.6, { kind: 'drywall', posts: false, doors: [0.3, 0.7], t: 0.14 }); // (and across the other way on the lowest deck)
    });
    for (const [y0, y1] of o.glass || []) { A.curPlat = ps[0].i; glass(xs[0] + 0.3, z0, xs[xs.length - 1] - 0.3, z0, y0, y1); glass(x0, zs[0] + 0.3, x0, zs[zs.length - 1] - 0.3, y0, y1); } // the first windows going in
    A.curPlat = undefined;
    return ps;
  };
  const c1 = frame(0, 0, 24, 24, -10, 52, [[-2, 0, 1, 0, 1], [14, 0.5, 1, 0, 1], [30, 0, 1, 0.5, 1], [46, 0.5, 1, 0, 0.5]], { glass: [[-2, 5.6], [14, 19.6], [30, 35.6]] });
  frame(31, 0, 18, 18, -4, 40, [[0, 0, 1, 0, 1], [16, 0, 1, 0.34, 0.67], [32, 0, 1, 0, 0.5]], { glass: [[0, 7.6], [16, 21.6]] });
  frame(-31, 0, 18, 18, -8, 28, [[-4, 0, 1, 0, 1], [12, 0, 1, 0, 0.5]], { glass: [[-4, 1.6], [12, 17.6]] });
  { // a tower crane on the big frame: mast, a long jib you can run along, a counterweight, a cab
    const p = c1[c1.length - 1]; A.curPlat = p.i; const g = group();
    chunk(A, g, 'steel', 5.4, 6.6, 46, 80, -6.6, -5.4, true); // (stands on the top deck)
    chunk(A, g, 'steel', -22, 46, 78.4, 79.4, -6.5, -5.5, true);
    chunk(A, g, 'steel', -21, -16, 75.4, 78.4, -7.2, -4.8, true);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 2.2), yellow); prop(A, p, cab, 6, 77, -3.8);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 22, 4), dark); prop(A, p, cable, 34, 67.5, -6);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1.2), red); prop(A, p, hook, 34, 56.4, -6);
    stack(A, 34, -6, 53.4, 2, 2, 2, 1, 1, 1, 'wood', false); // a load of crates hanging off the hook (cut it apart)
    hookBox(p, 33.2, 34.8, 55.9, 57, -6.6, -5.4);
    A.curPlat = undefined;
  }

  // ---------- two tower cranes out past the edge: a mast up out of the clouds, a jib reaching in over the city (run along it,
  // hook it), a counterweight, and a load platform hanging on the cable that you can drop onto ----------
  const lifts = [];
  for (const [mx, mz, dir, topY, py] of [[-50, -16, 1, 56, 20], [50, 18, -1, 62, 26]]) {
    const L = 30, tipX = mx + dir * (L - 4), yellowS = std(0xe8b422, { roughness: 0.6, metalness: 0.3 });
    A.addBox(mx - 1, mx + 1, -90, topY, mz - 1, mz + 1, yellowS); A.pillars.push({ x: mx, z: mz, w: 2 }); // the mast
    A.addBox(Math.min(mx - dir * 10, mx + dir * L), Math.max(mx - dir * 10, mx + dir * L), topY, topY + 1.2, mz - 0.8, mz + 0.8, yellowS); // the jib (and the counter-jib behind)
    A.addBox(mx - dir * 10 - 1.6, mx - dir * 10 + 1.6, topY - 3.5, topY, mz - 1.4, mz + 1.4, dark); // counterweight
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2.4), white); cab.position.set(mx + dir * 1.8, topY - 1.1, mz + 1.6); S.add(cab);
    for (let k = 0; k < 10; k++) { const lat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.6), dark); lat.position.set(mx + dir * (k * 3 + 1), topY + 0.6, mz); lat.rotation.y = 0.6; S.add(lat); } // lattice on the jib
    const p = deck(A, { x: tipX, z: mz, y: py, w: 7, d: 7, mat: std(0x8a6a4a, { roughness: 0.9 }), kind: 'lift', thick: 0.5 }); // the load platform
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 5).translate(0, 0.5, 0), dark); cable.position.set(tipX, py + 3, mz); S.add(cable); // (it pays out and reels in as the platform goes down and up)
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { // four slings from the hook down to its corners
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.6, 4), dark); sl.position.set(tipX + sx * 1.6, py + 1.5, mz + sz * 1.6); sl.rotation.set(sz * 0.62, 0, -sx * 0.62); S.add(sl); p.meshes.push(sl); }
    prop(A, p, new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2), red), tipX, py + 3.5, mz); // the hook block
    // it works as a lift: down to the lower floors and back up under the jib, pausing at each end; whoever stands on it rides along
    { const lo = py - 20, hi = topY - 12; p.base = { x: p.x, y: p.y, z: p.z }; p.prev = { x: p.x, y: p.y, z: p.z }; p.cable = cable; p.topY = topY;
      p.path = (t) => { const u = ((t + (dir > 0 ? 0 : 9)) / 18) % 1, tri = u < 0.5 ? u * 2 : 2 - u * 2, s = Math.min(1, Math.max(0, (tri - 0.12) / 0.76)); return lo + (hi - lo) * s * s * (3 - 2 * s) - py; };
      const nd = A.nodeMap.get('P' + p.i); if (nd) nd.gone = true; A.spawns = A.spawns.filter((sp) => sp.plat !== p.i); // (bots don't plan routes over it, and nobody spawns on it)
      p.meshBase = p.meshes.map((q) => q.position.clone()); p.boxBase = p.boxes.map((b) => ({ ...b })); lifts.push(p); }
  }
  const moveLifts = () => { const t = Date.now() / 1000; for (const p of lifts) { const dy = p.path(t); p.prev.y = p.y; p.y = p.base.y + dy; p.meshes.forEach((q, j) => { q.position.y = p.meshBase[j].y + dy; }); p.boxes.forEach((b, j) => { b.y0 = p.boxBase[j].y0 + dy; b.y1 = p.boxBase[j].y1 + dy; }); p.cable.position.y = p.y + 3; p.cable.scale.y = Math.max(0.1, p.topY - p.y - 3); } };
  A.anim.push(moveLifts); moveLifts();
  A.tickHazards = (fighters) => { for (const f of fighters) { if (!f.alive || !f.onGround) continue; for (const p of lifts) { if (Math.abs(f.pos.y - p.prev.y) > 0.5 || !A.inPlat(p, f.pos, 0.2)) continue; if (p.y > p.prev.y) f.pos.y = p.y; break; } } };

  A.plantStalks(-70, 160); // the frames' corner columns, from the clouds up into the sky
  finishBrk(A);
  A.onDrop = (p) => {
    for (const b of A.brk.list) if (b.alive && b.plat === p.i) kill(A, b);
    for (const q of A.plats) if (q.parent === p.i && !q.gone) A.dropPlatform(q.i);
  };
  A.finishNav();

  // ---------- backdrop: a far skyline in the haze, puffs of cloud below, a sea of cloud ----------
  {
    const N = 170, im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, map: (() => { const t = T.canvasTex((g, s) => { const q = T.rng(22); g.fillStyle = '#10142a'; g.fillRect(0, 0, s, s); for (let y = 0; y < 48; y++) for (let x = 0; x < 14; x++) if (q() < 0.035) { g.fillStyle = q() < 0.7 ? '#ffd890' : q() < 0.5 ? '#8ae0ff' : '#ff8ad8'; g.fillRect(2 + x * s / 14, 1 + y * s / 48, s / 14 - 5, s / 48 - 2); } }, 256); return t; })() }), N), mm = new THREE.Matrix4(), col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = r() * TAU, dd = 290 + r() * 150, h = 60 + r() * r() * 300, wd = 12 + r() * 22;
      mm.compose(new THREE.Vector3(Math.cos(a) * dd, -110 + h / 2, Math.sin(a) * dd), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 3), new THREE.Vector3(wd, h, wd * (0.7 + r() * 0.6)));
      im.setMatrixAt(i, mm); im.setColorAt(i, col.setHSL(0.62, 0.3, 0.6 - (dd - 290) / 400 + r() * 0.05));
    }
    im.material.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
#ifdef USE_INSTANCING
 vMapUv += fract(vec2(instanceMatrix[3].x, instanceMatrix[3].z) * 0.0137);
#endif`); }; // (each building starts somewhere different in the pattern: no two alike)
    S.add(im);
  }
  cloudHeaps(S, r, { n: 46, rMin: 30, rMax: 210, y: -30, depth: 24, sMin: 8, sMax: 22, tint: new THREE.Color(0x4c4aa0) }); // clouds below: soft heaps of puffs (scenery.js)
  const sea = new THREE.Mesh(new THREE.CircleGeometry(620, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x302e72, transparent: true, opacity: 0.96 })); sea.position.y = -62; S.add(sea);
}
