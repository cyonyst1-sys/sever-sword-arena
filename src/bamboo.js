// Bamboo Fort: a square platform built entirely of bamboo, floating in jade mist. The floor is bamboo tiles you
// can slice straight through (and fall through the hole); small bamboo huts, fences and log piles stand on it;
// a dense bamboo wall rings the edge, so anyone swinging in smashes a window through it. Outside there is
// nothing but tall bamboo pillars to swing from, and a ring of small spawn pads that fall away once you leave
// them (and come back a few seconds later for the next fighter).
import * as THREE from 'three';
import { deck, prop, stalk, drift, farRing } from './maps2.js';
import { kindMats, chunk, join, group, wall, stack, finishBrk, kill } from './dojo.js?v=20261116000535';

const TAU = Math.PI * 2, HALF = 30, TILE = 1.5;

export function buildBamboo(A, T) {
  const S = A.scene, M = A.mats, r = T.rng(2727);
  A.plats = []; A.pillars = []; A.arcPts = []; A.killY = -40;
  A.brk = { list: [], cells: new Map(), stamp: 0 };
  const K = kindMats(T);
  A.setSky({ top: 0x5f9fb8, mid: 0xd5e6c6, bot: 0xbfd4bb, fog: 0xc9dcc2, near: 70, far: 330, hemiSky: 0xf0f8e0, hemiGround: 0x4a5a3a, hemi: 1.0, sunColor: 0xfff0d0, sun: 2.0, sunOff: new THREE.Vector3(40, 60, -30) });
  M.bamboo = new THREE.MeshStandardMaterial({ map: T.bambooTex(), roughness: 0.55 });
  const poleMat = new THREE.MeshStandardMaterial({ map: K.bamboo.mat.map, roughness: 0.6 });

  // ---- the main platform: its surface is bamboo floor tiles (breakable), so it's a surface with no box of its own
  const main = { kind: 'floor', x: 0, z: 0, y: 0, w: HALF * 2, d: HALF * 2, ang: 0, i: 0, meshes: [], boxes: [], ramps: [], rays: [] };
  A.plats.push(main);
  A.node('P0', 0, 0, 0).plat = 0;
  const fallback = new THREE.Vector3(0, 0, 0); fallback.plat = 0; A.spawns.push(fallback);
  A.curPlat = 0;
  const n = Math.round(HALF * 2 / TILE);
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) { // each tile on its own: a cut leaves a hole the size of the tile
    const x0 = -HALF + i * TILE, z0 = -HALF + k * TILE;
    chunk(A, group(), 'bamboo', x0 + 0.01, x0 + TILE - 0.01, -0.35, 0, z0 + 0.01, z0 + TILE - 0.01, true);
  }
  { // what holds the floor up (looks only): cross beams under it and a few great poles reaching down into the mist
    const beams = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.35, HALF * 2, 8), poleMat, 22), mm = new THREE.Matrix4(), q = new THREE.Quaternion();
    let c = 0;
    for (let j = 0; j < 11; j++) {
      const u = -HALF + 3 + j * 5.4;
      mm.compose(new THREE.Vector3(u, -0.75, 0), q.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1)); beams.setMatrixAt(c++, mm);
      mm.compose(new THREE.Vector3(0, -1.45, u), q.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), new THREE.Vector3(1, 1, 1)); beams.setMatrixAt(c++, mm);
    }
    S.add(beams); main.meshes.push(beams);
    for (const [x, z] of [[-18, -18], [18, -18], [-18, 18], [18, 18], [0, 0]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.6, 60, 10), poleMat); prop(A, main, m, x, -31, z); }
  }

  // ---- the wall round the edge: a close-set row of thin bamboo poles, 20 m tall. You can see through the gaps,
  // but they're too narrow to slip through: anyone swinging or dashing in cuts through the poles in the way, and
  // whatever is above each cut drops. Every pole is a stack of segments (each rests on the one below).
  const WH = 20, SEG = 4, SP = 0.36, PW = 0.14, WI = HALF - 0.3;
  const pole = (x, z, H = WH) => {
    const g = group(), h = H - 1.5 + r() * 3, nseg = Math.max(1, Math.round(h / SEG)); let below = null;
    for (let j = 0; j < nseg; j++) { const b = chunk(A, g, 'bamboo', x - PW / 2, x + PW / 2, j * h / nseg, (j + 1) * h / nseg, z - PW / 2, z + PW / 2, j === 0); join(b, below); below = b; }
  };
  for (let u = -WI; u <= WI + 1e-6; u += SP) { pole(u, -WI); pole(u, WI); if (u > -WI + 1e-6 && u < WI - 1e-6) { pole(-WI, u); pole(WI, u); } }

  // ---- a bamboo forest round the outside of the wall, layers deep, between the wall and the spawn pads: you spawn
  // facing it and cut your way in. Each culm rises out of the mist (that part is scenery) and can be cut from just
  // below the floor's height up; whatever is above the cut drops.
  const trunks = [];
  for (let gx = -46; gx <= 46; gx += 1.7) for (let gz = -46; gz <= 46; gz += 1.7) {
    const x = gx + (r() - 0.5) * 1.3, z = gz + (r() - 0.5) * 1.3, d = Math.hypot(x, z);
    if (Math.max(Math.abs(x), Math.abs(z)) < HALF + 1.3 || d > 45.5) continue; // outside the wall, inside the pads' ring
    let near = false; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + TAU / 16; if (Math.hypot(x - Math.cos(a) * 47, z - Math.sin(a) * 47) < 4.2) near = true; } // (room round each spawn pad)
    if (near || r() < 0.12) continue;
    const w = 0.16 + r() * 0.14, h = 10 + r() * 14, nseg = Math.round(h / 4.5) + 1, g = group(); let below = null;
    for (let j = 0; j < nseg; j++) { const y0 = -2 + j * (h + 2) / nseg, y1 = -2 + (j + 1) * (h + 2) / nseg, b = chunk(A, g, 'bamboo', x - w / 2, x + w / 2, y0, y1, z - w / 2, z + w / 2, j === 0); join(b, below); below = b; }
    trunks.push([x, z, w]);
  }

  // ---- small bamboo huts with flat bamboo roofs, a gazebo in the middle, fences and log piles
  const hut = (cx, cz, w, d, doorSide) => {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, h = 3;
    const o = (side) => ({ kind: 'bamboo', posts: false, ceil: true, t: 0.22, doors: side === doorSide ? [0.5] : [], win: side === doorSide ? [] : [0.5] });
    wall(A, x0, z0, x1, z0, 0, h, o(0)); wall(A, x0, z1, x1, z1, 0, h, o(1)); wall(A, x0, z0 + 0.11, x0, z1 - 0.11, 0, h, o(2)); wall(A, x1, z0 + 0.11, x1, z1 - 0.11, 0, h, o(3));
    const g = group(); // the roof: tiles that rest on the walls (base) and on each other
    for (let a = x0 - 0.3; a < x1 + 0.29; a += (w + 0.6) / 3) for (let b = z0 - 0.3; b < z1 + 0.29; b += (d + 0.6) / 3) chunk(A, g, 'bamboo', a, a + (w + 0.6) / 3 - 0.02, h, h + 0.3, b, b + (d + 0.6) / 3 - 0.02, true);
  };
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * TAU + 0.3, rr = 17, cx = Math.cos(a) * rr, cz = Math.sin(a) * rr;
    const doorSide = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 2 : 3) : (Math.sin(a) > 0 ? 0 : 1); // the door faces the middle
    hut(cx, cz, 5 + (k % 2), 5, doorSide);
  }
  { // gazebo: four poles in segments holding up a roof; cut the poles and the roof comes down
    const g = group(), w = 7, h = 3.6, tops = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      let below = null;
      for (let j = 0; j < 4; j++) { const b = chunk(A, g, 'bamboo', sx * w / 2 - 0.2, sx * w / 2 + 0.2, j * h / 4, (j + 1) * h / 4, sz * w / 2 - 0.2, sz * w / 2 + 0.2, j === 0); join(b, below); below = b; }
      tops.push([sx, sz, below]);
    }
    const roof = [];
    for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) {
      const a = -w / 2 - 0.5 + i * (w + 1) / 4, b = -w / 2 - 0.5 + k * (w + 1) / 4, c = chunk(A, g, 'bamboo', a, a + (w + 1) / 4 - 0.02, h, h + 0.3, b, b + (w + 1) / 4 - 0.02); roof.push([i, k, c]);
      for (const [sx, sz, top] of tops) if ((sx < 0 ? i === 0 : i === 3) && (sz < 0 ? k === 0 : k === 3)) join(c, top);
    }
    for (const [i, k, c] of roof) for (const [i2, k2, c2] of roof) if ((i2 === i + 1 && k2 === k) || (i2 === i && k2 === k + 1)) join(c, c2);
  }
  const fenceB = (ax, az, bx, bz) => { // bamboo post-and-rail fence
    const g = group(), L = Math.hypot(bx - ax, bz - az), m = Math.max(1, Math.round(L / 1.8)); let prev = null;
    for (let i = 0; i <= m; i++) {
      const x = ax + (bx - ax) * i / m, z = az + (bz - az) * i / m, post = chunk(A, g, 'bamboo', x - 0.1, x + 0.1, 0, 1.2, z - 0.1, z + 0.1, true);
      if (prev) for (const [h0, h1] of [[0.4, 0.55], [0.85, 1.0]]) { const px = (prev.x0 + prev.x1) / 2, pz = (prev.z0 + prev.z1) / 2, rail = chunk(A, g, 'bamboo', Math.min(px, x) - 0.05, Math.max(px, x) + 0.05, h0, h1, Math.min(pz, z) - 0.05, Math.max(pz, z) + 0.05); join(rail, prev); join(rail, post); }
      prev = post;
    }
  };
  fenceB(-8, -9, 8, -9); fenceB(-8, 9, 8, 9); fenceB(-24, -4, -24, 4); fenceB(24, -4, 24, 4); fenceB(-6, 24, 6, 24); fenceB(-6, -24, 6, -24);
  for (const [x, z] of [[-10, 4], [11, -3], [4, 12], [-5, -13], [22, 14], [-21, -14], [-14, 23], [15, -22]]) stack(A, x, z, 0, 3, 2, 1, 0.5, 0.5, 2.6, 'bamboo'); // piles of cut poles

  // ---- outside: only tall bamboo pillars to swing from
  for (let i = 0; i < 46; i++) {
    const a = i / 46 * TAU + (r() - 0.5) * 0.12, rr = 38 + r() * 26;
    stalk(A, Math.cos(a) * rr, Math.sin(a) * rr, 0.4 + r() * 0.25);
  }
  // ---- inside the fort: high bamboo walls between the huts, and tall pillars all over, to swing round and hook
  const taken = []; // spots already used (huts, gazebo, walls), to keep the pillars clear of them
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + 0.3; taken.push([Math.cos(a) * 17, Math.sin(a) * 17, 4.8]); }
  taken.push([0, 0, 5.5]);
  for (let k = 0; k < 6; k++) { // a 14 m wall halfway between each pair of huts, running across the way round
    const a = k / 6 * TAU + 0.3 + TAU / 12, cx = Math.cos(a) * 17, cz = Math.sin(a) * 17, tx = -Math.sin(a), tz = Math.cos(a), L = 7;
    const row = (ax, az, bx, bz, H) => { const L2 = Math.hypot(bx - ax, bz - az), m = Math.round(L2 / SP); for (let i = 0; i <= m; i++) pole(ax + (bx - ax) * i / m, az + (bz - az) * i / m, H); }; // a see-through row of thin poles, like the outer wall
    if (Math.abs(tx) > Math.abs(tz)) row(cx - L / 2, cz, cx + L / 2, cz, 14);
    else row(cx, cz - L / 2, cx, cz + L / 2, 14);
    for (let s = -1; s <= 1; s++) taken.push([cx + tx * s * 3, cz + tz * s * 3, 2.5]);
  }
  for (const [x, z] of [[0, -12], [0, 12], [-12, 0], [12, 0]]) { const m = Math.round(6 / SP); for (let i = 0; i <= m; i++) pole(x - 3 + 6 * i / m, z, 10); } // lower see-through pole walls round the gazebo
  for (const [x, z] of [[0, -12], [0, 12], [-12, 0], [12, 0]]) taken.push([x, z, 3.5]);
  let placed = 0;
  { // five thick permanent bamboo pillars spread over the fort (they can't be cut), so there's always something to hook
    const pm = new THREE.MeshStandardMaterial({ map: T.bambooTex(), roughness: 0.55 }); pm.map.repeat.set(2, 22);
    for (let j = 0; j < 5; j++) {
      let spot = null;
      for (const rad of [21, 23, 19, 25, 15]) { for (const da of [0, 0.15, -0.15, 0.3, -0.3]) { const a = j / 5 * TAU + 0.62 + da, x = Math.cos(a) * rad, z = Math.sin(a) * rad;
        if (!taken.some(([tx, tz, rr]) => Math.hypot(x - tx, z - tz) < rr + 2)) { spot = [x, z]; break; } } if (spot) break; }
      if (!spot) continue;
      const [x, z] = spot; A.addDisc(x, z, 0.95, -60, 52, pm, 16); A.pillars.push({ x, z, w: 1.9 }); taken.push([x, z, 6]);
      for (let y = -2; y < 52; y += 4.2) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.09, 6, 18), new THREE.MeshStandardMaterial({ color: 0x4f6f25, roughness: 0.6 })); ring.rotation.x = Math.PI / 2; ring.position.set(x, y, z); S.add(ring); } // node rings
    }
  }
  for (let tries = 0; tries < 400 && placed < 18; tries++) { // thick pillars rising 40 m, spread through the fort
    const x = (r() - 0.5) * (HALF * 2 - 6), z = (r() - 0.5) * (HALF * 2 - 6);
    if (taken.some(([tx, tz, rad]) => Math.hypot(x - tx, z - tz) < rad + 1.5)) continue;
    stalk(A, x, z, 0.55); taken.push([x, z, 6]); placed++;
  }
  A.plantStalks(-60, 42);

  // ---- spawn pads round the outside: a fighter starts on one, and it falls away once they leave it
  const pads = [];
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * TAU + TAU / 16, x = Math.cos(a) * 47, z = Math.sin(a) * 47;
    const p = deck(A, { x, z, y: 8, w: 4.5, d: 4.5, mat: poleMat, kind: 'pad', thick: 0.6 });
    p.base = p.meshes.map((m) => m.position.y); pads.push(p);
  }
  A.curPlat = undefined;
  finishBrk(A);
  A.onDrop = (p) => { for (const b of A.brk.list) if (b.alive && b.plat === p.i) kill(A, b); };
  A.finishNav();
  // spawn pads: hidden until someone spawns on one. It appears under them, drops into the mist 3 s later (whether
  // they've left or not), and is free for the next spawn a few seconds after that.
  const solid = (p, on) => { const dead = new Set(p.boxes); A.boxes = A.boxes.filter((b) => !dead.has(b)); if (on) A.boxes.push(...p.boxes); A.nodeMap.get('P' + p.i).gone = !on; };
  for (const p of pads) { p.state = 'idle'; p.busy = false; p.ghost = true; p.meshes.forEach((m) => { m.visible = false; }); solid(p, false); }
  A.tickPads = (fighters, now) => {
    const fs = [...fighters]; // (an iterator can only be walked once)
    for (const p of pads) {
      if (p.state === 'idle') {
        for (const f of fs) if (f.alive && Math.abs(f.pos.y - p.y) < 0.3 && Math.hypot(f.vel.x, f.vel.z) < 1 && f.vel.y > -2 && A.inPlat(p, f.pos, 0)) { // someone has just spawned here
          p.state = 'up'; p.busy = true; p.ghost = false; p.down = false; p.until = now + 3; p.fall = 0; p.fv = 0;
          p.meshes.forEach((m, j) => { m.position.y = p.base[j]; m.visible = true; }); solid(p, true); break;
        }
      } else if (p.state === 'up' && now > p.until) { p.state = 'cool'; p.down = true; p.ghost = true; p.until = now + 3; solid(p, false); }
      else if (p.state === 'cool' && now > p.until) { p.state = 'idle'; p.busy = false; p.down = false; p.meshes.forEach((m) => { m.visible = false; }); }
    }
  };
  A.anim.push((t, dt) => { dt = dt || 0; for (const p of pads) if (p.down && p.fall < 80) { p.fv += 30 * dt; p.fall += p.fv * dt; p.meshes.forEach((m, j) => { m.position.y = p.base[j] - p.fall; if (p.fall >= 80) m.visible = false; }); } });

  // ---- backdrop: green karst peaks in the mist, a sea of cloud, drifting bamboo leaves
  farRing(A, 22, 380, (x, z, i) => {
    const h = 120 + (i % 5) * 35, m = new THREE.Mesh(new THREE.CylinderGeometry(18 + (i % 3) * 8, 46 + (i % 4) * 10, h, 9), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x6f9a78 : 0x82aa86, fog: false }));
    m.position.set(x, -70 + h / 2, z); m.rotation.y = i; S.add(m);
  });
  // ---- far below: a forest floor of fallen bamboo and leaf litter, a bamboo forest rising out of it, mist between
  const GY = -62, gt = T.canvasTex((g, s) => {
    const q = T.rng(515); g.fillStyle = '#3e4a26'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${120 + q() * 60 | 0},${110 + q() * 50 | 0},${50 + q() * 30 | 0},${0.25 + q() * 0.3})`; g.beginPath(); g.ellipse(q() * s, q() * s, 3 + q() * 5, 1 + q() * 1.5, q() * 3, 0, TAU); g.fill(); } // dry leaves
    for (let i = 0; i < 70; i++) { // fallen culms, criss-crossed, with their node rings
      const x = q() * s, y = q() * s, a = q() * Math.PI, L = 60 + q() * 140, w = 4 + q() * 6, gr = 90 + q() * 70 | 0;
      for (const [dx, dy] of [[0, 0], [-s, 0], [s, 0], [0, -s], [0, s]]) {
        g.save(); g.translate(x + dx, y + dy); g.rotate(a);
        g.fillStyle = 'rgba(20,24,8,0.35)'; g.fillRect(-L / 2 + 2, -w / 2 + 2, L, w); // shadow
        const lg = g.createLinearGradient(0, -w / 2, 0, w / 2); lg.addColorStop(0, `rgb(${gr + 40},${gr + 60},${gr * 0.4 | 0})`); lg.addColorStop(1, `rgb(${gr * 0.6 | 0},${gr * 0.75 | 0},${gr * 0.25 | 0})`);
        g.fillStyle = lg; g.fillRect(-L / 2, -w / 2, L, w);
        g.fillStyle = 'rgba(40,50,15,0.8)'; for (let u = -L / 2 + 10 + q() * 10; u < L / 2; u += 18 + q() * 10) g.fillRect(u, -w / 2, 1.5, w);
        g.restore();
      }
    }
  }, 512);
  gt.repeat.set(70, 70);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(620, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.95 }));
  ground.position.y = GY; ground.userData.keep = true; S.add(ground);
  const mist = new THREE.Mesh(new THREE.CircleGeometry(620, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xdbe8d6, transparent: true, opacity: 0.4, depthWrite: false })); mist.position.y = -42; S.add(mist);
  { // the bamboo forest below and all round (scenery: you can't hook or cut these)
    const n = A.quality === 'low' ? 500 : 1100, culm = new THREE.CylinderGeometry(1, 1, 1, 7, 1, true); culm.translate(0, 0.5, 0);
    const bt = T.bambooTex(); bt.repeat.set(1, 14);
    const im = new THREE.InstancedMesh(culm, new THREE.MeshStandardMaterial({ map: bt, roughness: 0.6 }), n), mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler();
    let c = 0;
    for (let i = 0; i < n * 3 && c < n; i++) {
      const a = r() * TAU, d = 50 + Math.pow(r(), 0.8) * 150, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (Math.max(Math.abs(x), Math.abs(z)) < HALF + 22) continue; // (clear of the fort and the cuttable forest round it)
      const top = -20 + r() * (d < 90 ? 50 : 70), rad = 0.25 + r() * 0.35;
      mm.compose(new THREE.Vector3(x, GY, z), qq.setFromEuler(e.set((r() - 0.5) * 0.08, r() * TAU, (r() - 0.5) * 0.08)), new THREE.Vector3(rad, top - GY, rad)); im.setMatrixAt(c++, mm);
    }
    im.count = c; S.add(im);
    const lo = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), K.bamboo.mat, trunks.length); // the cuttable culms' lower trunks, down into the mist
    trunks.forEach(([x, z, w], i) => { mm.compose(new THREE.Vector3(x, (GY - 2) / 2, z), qq.identity(), new THREE.Vector3(w, -2 - GY, w)); lo.setMatrixAt(i, mm); });
    S.add(lo);
  }
  drift(A, 260, 0x9ccf5c, 0.16, [0.8, -0.6, 0.4], 0.6);
}
