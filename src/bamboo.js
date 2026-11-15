// Bamboo Fort: a square platform built entirely of bamboo, floating in jade mist. The floor is bamboo tiles you
// can slice straight through (and fall through the hole); small bamboo huts, fences and log piles stand on it;
// a dense bamboo wall rings the edge, so anyone swinging in smashes a window through it. Outside there is
// nothing but tall bamboo pillars to swing from, and a ring of small spawn pads that fall away once you leave
// them (and come back a few seconds later for the next fighter).
import * as THREE from 'three';
import { deck, prop, stalk, drift, farRing } from './maps2.js';
import { kindMats, chunk, join, group, wall, stack, finishBrk, kill } from './dojo.js?v=20261114211314';

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
  const sea = new THREE.Mesh(new THREE.CircleGeometry(620, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xdbe8d6, transparent: true, opacity: 0.95 })); sea.position.y = -60; S.add(sea);
  drift(A, 260, 0x9ccf5c, 0.16, [0.8, -0.6, 0.4], 0.6);
}
