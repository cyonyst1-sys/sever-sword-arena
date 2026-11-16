// Two more maps built on the canopy's ideas (cuttable stalks to swing from, walkable bridges, bots that swing
// and dash between surfaces) with their own layouts and looks:
//   Pagoda Falls: a three-tier pagoda at sunset, stone islands, rock spires and terraces, red lacquer posts.
//   Moonlit Isles: floating grass islands at night, a great cherry tree, rope bridges, bamboo groves.
import * as THREE from 'three';
import { buildMaw, mawY, buildTendrils } from './maw.js?v=20261116034714';

const TAU = Math.PI * 2;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const flat = (color) => new THREE.MeshBasicMaterial({ color, fog: false });

// ---------- shared pieces ----------
// a flat surface you can stand on: solid, a bot waypoint and a spawn point (offset sx/sz from the middle)
function deck(A, o) {
  const p = { kind: o.kind || 'deck', x: o.x, z: o.z, y: o.y, w: o.w, d: o.d, ang: 0, i: A.plats.length, meshes: [], boxes: [], ramps: [], rays: [] };
  A.plats.push(p); A.tag = p;
  A.addBox(o.x - o.w / 2, o.x + o.w / 2, o.y - (o.thick || 1.2), o.y, o.z - o.d / 2, o.z + o.d / 2, o.mat);
  A.tag = null;
  const nx = o.x + (o.sx || 0), nz = o.z + (o.sz || 0);
  A.node('P' + p.i, nx, o.y, nz).plat = p.i;
  const sp = new THREE.Vector3(nx, o.y, nz); sp.plat = p.i; A.spawns.push(sp);
  return p;
}
// add a decoration mesh that belongs to (and falls with) surface p
function prop(A, p, mesh, x, y, z) { mesh.position.set(x, y, z); mesh.castShadow = true; A.scene.add(mesh); if (p) A.own(p, mesh); return mesh; }
// a plank bridge with rope rails from surface a to surface b: walkable, and a surface of its own for the bots
function bridge(A, a, b, width, plankMat, ropeMat) {
  const pa = A.rimPoint(a, { x: b.x, z: b.z }), pb = A.rimPoint(b, { x: a.x, z: a.z });
  const dx = pb.x - pa.x, dz = pb.z - pa.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
  const ax = pa.x - ux * 0.8, az = pa.z - uz * 0.8, bx = pb.x + ux * 0.8, bz = pb.z + uz * 0.8; // overlap both edges a little
  const p = { kind: 'branch', x: (ax + bx) / 2, z: (az + bz) / 2, y: (a.y + b.y) / 2, ya: a.y, yb: b.y, w: L + 1.6, d: width, ang: Math.atan2(dz, dx), i: A.plats.length, meshes: [], boxes: [], ramps: [], rays: [] };
  A.plats.push(p); A.tag = p;
  A.addRamp(ax, az, bx, bz, a.y, b.y, width, Math.min(a.y, b.y) - 1, null, { visual: false, noWall: true });
  A.tag = null;
  const s = new THREE.Vector3(ax, a.y, az), e = new THREE.Vector3(bx, b.y, bz), dir = e.clone().sub(s), len = dir.length(); dir.normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  const planks = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, len), plankMat); planks.quaternion.copy(q);
  prop(A, p, planks, (s.x + e.x) / 2, (s.y + e.y) / 2 - 0.12, (s.z + e.z) / 2); planks.receiveShadow = true;
  for (const side of [1, -1]) { // rope rails and their posts
    const off = new THREE.Vector3(-uz, 0, ux).multiplyScalar(side * width / 2);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 5), ropeMat); rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    prop(A, p, rail, (s.x + e.x) / 2 + off.x, (s.y + e.y) / 2 + 0.95, (s.z + e.z) / 2 + off.z);
    for (const end of [s, e]) prop(A, p, new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 6), plankMat), end.x + off.x, end.y + 0.5, end.z + off.z);
  }
  A.node('P' + p.i, p.x, p.y, p.z).plat = p.i;
  A.link('P' + a.i, 'P' + p.i); A.link('P' + p.i, 'P' + b.i);
  return p;
}
// cuttable stalks scattered over the map (kept clear of surfaces), or clustered in groves
function stalk(A, x, z, r) { A.bamboo.push({ x, z, r, segs: [], inst: A.bamboo.length }); A.pillars.push({ x, z, w: r * 2 }); }
const clear = (A, x, z, m) => !A.plats.some((p) => A.inPlat(p, { x, z }, m));
// drifting particles (petals, fireflies) around the play area
function drift(A, n, color, size, vel, bob) {
  const pos = new Float32Array(n * 3), r = Math.random;
  for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * 220; pos[i * 3 + 1] = -20 + r() * 60; pos[i * 3 + 2] = (r() - 0.5) * 220; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.9, depthWrite: false })); pts.frustumCulled = false; A.scene.add(pts);
  A.anim.push((t, dt) => {
    dt = dt || 0; for (let i = 0; i < n; i++) {
      const k = i * 3; pos[k] += (vel[0] + Math.sin(t * 0.7 + i) * bob) * dt; pos[k + 1] += (vel[1] + Math.cos(t * 1.3 + i * 0.7) * bob) * dt; pos[k + 2] += (vel[2] + Math.cos(t * 0.5 + i) * bob) * dt;
      if (pos[k] > 110) pos[k] -= 220; if (pos[k] < -110) pos[k] += 220; if (pos[k + 2] > 110) pos[k + 2] -= 220; if (pos[k + 2] < -110) pos[k + 2] += 220; if (pos[k + 1] < -25) pos[k + 1] += 65; if (pos[k + 1] > 45) pos[k + 1] -= 65;
    }
    g.attributes.position.needsUpdate = true;
  });
}
// a ring of distant shapes for the backdrop (never fogged, so they read as silhouettes against the sky)
function farRing(A, n, rad, make) { for (let i = 0; i < n; i++) { const a = (i / n) * TAU + Math.sin(i * 7.3) * 0.2; make(Math.cos(a) * rad * (0.9 + 0.2 * Math.abs(Math.sin(i * 3.1))), Math.sin(a) * rad * (0.9 + 0.2 * Math.abs(Math.sin(i * 3.1))), i, a); } }

// ================= Pagoda Falls =================
export function buildPagoda(A, T) {
  const S = A.scene, M = A.mats, r = T.rng(5150);
  A.plats = []; A.pillars = []; A.arcPts = []; A.killY = -45;
  A.setSky({ top: 0x2a1f52, mid: 0xf2955a, bot: 0xffd2a8, fog: 0xe8a77a, near: 110, far: 430, hemiSky: 0xffd9b8, hemiGround: 0x4a3050, hemi: 0.95, sunColor: 0xffb070, sun: 2.1, sunOff: new THREE.Vector3(70, 34, -26) });
  // red lacquer posts with a gold band every 2.6 m: they cut and fall just like bamboo
  M.bamboo = new THREE.MeshStandardMaterial({ map: T.canvasTex((g, s) => { g.fillStyle = '#8f1a1a'; g.fillRect(0, 0, s, s); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.1})`; g.fillRect(Math.random() * s, 0, 2 + Math.random() * 4, s); } g.fillStyle = '#d4a63a'; g.fillRect(0, 0, s, s * 0.06); g.fillStyle = '#1a0c0c'; g.fillRect(0, s * 0.06, s, s * 0.015); }, 128), roughness: 0.35, metalness: 0.15 });
  const red = std(0xa31f1f, { roughness: 0.45 }), plaster = std(0xeae2d2), slate = std(0x3b3f4c, { roughness: 0.6, flatShading: true }), gold = std(0xd9ad3c, { metalness: 0.85, roughness: 0.3 });
  const rock = std(0x6a5a52, { roughness: 1, flatShading: true }), moss = std(0x5d7a3a, { roughness: 1 }), rope = std(0xb08a55, { roughness: 0.9 }), black = std(0x1a1414, { roughness: 0.5 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffc070 });

  // ---- the pagoda: three decks, each with a sloping tiled eave under it and a walled tier between
  const tiers = [[24, 0], [17, 9], [11, 18]], decks = [];
  tiers.forEach(([w, y], k) => {
    const p = deck(A, { x: 0, z: 0, y, w, d: w, mat: M.wood, kind: 'deck', sx: k < 2 ? w * 0.36 : 0, sz: k < 2 ? w * 0.36 : 0 });
    decks.push(p);
    const eave = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.78, w * 0.5, 2.6, 4, 1), slate); eave.rotation.y = Math.PI / 4; prop(A, p, eave, 0, y - 2.5, 0);
    for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 6), gold); c.rotation.set(cz * 0.6, 0, -cx * 0.6); prop(A, p, c, cx * w * 0.55, y - 1.2, cz * w * 0.55); }
    if (k < 2) { // the tier wall up to the next deck: white plaster, red corner posts
      const nw = tiers[k + 1][0] * 0.6, ny = tiers[k + 1][1] - 1.2;
      A.tag = p; A.addBox(-nw / 2, nw / 2, y, ny, -nw / 2, nw / 2, plaster); A.tag = null;
      for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) prop(A, p, new THREE.Mesh(new THREE.BoxGeometry(0.7, ny - y, 0.7), red), cx * nw / 2, (y + ny) / 2, cz * nw / 2);
    }
  });
  { const top = decks[2]; prop(A, top, new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.5, 9, 8), gold), 0, 18 + 4.5, 0); for (let i = 0; i < 5; i++) prop(A, top, new THREE.Mesh(new THREE.TorusGeometry(0.7 - i * 0.08, 0.1, 6, 16), gold), 0, 19.5 + i * 1.3, 0).rotation.x = Math.PI / 2; }
  { const base = new THREE.Mesh(new THREE.CylinderGeometry(6, 2, 50, 7), rock); prop(A, decks[0], base, 0, -26, 0); }

  // ---- ring of stone islands (some bridged to the pagoda), each with a torii gate or a lantern
  const slabs = [];
  [-4, 4, -8, 2, -2, 6].forEach((y, k) => {
    const a = (k / 6) * TAU + Math.PI / 6, x = Math.round(Math.cos(a) * 50), z = Math.round(Math.sin(a) * 50), w = 15 + (k % 2) * 2, d = 13 + ((k + 1) % 2) * 2;
    const p = deck(A, { x, z, y, w, d, mat: A.mats.stone, kind: 'slab', thick: 2 }); slabs.push(p);
    prop(A, p, new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, 0.12, d - 0.6), moss), x, y + 0.02, z).receiveShadow = true;
    prop(A, p, new THREE.Mesh(new THREE.ConeGeometry(Math.min(w, d) * 0.55, 16, 6), rock), x, y - 10, z).rotation.x = Math.PI;
    if (k % 2 === 0) { // torii gate (decoration: you pass through it)
      const tx = x - Math.cos(a) * 3, tz = z - Math.sin(a) * 3, ry = -a + Math.PI / 2;
      const g = new THREE.Group();
      for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 6, 10), red); post.position.set(s * 2.4, 3, 0); g.add(post); }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 0.6), red); beam.position.y = 4.6; g.add(beam);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.45, 0.9), black); cap.position.y = 6.1; g.add(cap);
      g.rotation.y = ry; prop(A, p, g, tx, y, tz);
    } else { // stone lantern with a warm light inside
      const lx = x + w * 0.3, lz = z - d * 0.3;
      prop(A, p, new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.9), A.mats.stone), lx, y + 0.6, lz);
      prop(A, p, new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), glow), lx, y + 1.5, lz);
      prop(A, p, new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.7, 4), A.mats.stone), lx, y + 2.15, lz).rotation.y = Math.PI / 4;
    }
  });
  for (const k of [0, 2, 4]) bridge(A, decks[0], slabs[k], 3, M.wood, rope);

  // ---- outer ring: tall rock spires (small tops) and broad low terraces between them
  const spires = [];
  [14, 22, 10, 18, 26, 12].forEach((y, k) => {
    const a = (k / 6) * TAU, x = Math.round(Math.cos(a) * 88), z = Math.round(Math.sin(a) * 88);
    const p = deck(A, { x, z, y, w: 9, d: 9, mat: A.mats.stone, kind: 'spire', thick: 1.5 }); spires.push(p);
    A.tag = p; A.addBox(x - 3.2, x + 3.2, -60, y - 1.5, z - 3.2, z + 3.2, rock); A.tag = null; // the column holding it up
    prop(A, p, new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.12, 8.6), moss), x, y + 0.02, z);
  });
  const terraces = [];
  [-12, -10, -14].forEach((y, k) => {
    const a = (k / 3) * TAU + Math.PI / 6, x = Math.round(Math.cos(a) * 82), z = Math.round(Math.sin(a) * 82);
    const p = deck(A, { x, z, y, w: 26, d: 20, mat: A.mats.floor, kind: 'terrace', thick: 2.5 }); terraces.push(p);
    prop(A, p, new THREE.Mesh(new THREE.CylinderGeometry(13, 4, 22, 7), rock), x, y - 13.5, z);
    for (let i = 0; i < 4; i++) { const bx = x + (r() - 0.5) * 18, bz = z + (r() - 0.5) * 12; A.tag = p; A.addBox(bx - 0.8, bx + 0.8, y, y + 1.1, bz - 0.8, bz + 0.8, A.mats.stone); A.tag = null; } // cover
  });
  bridge(A, slabs[0], terraces[0], 3, M.wood, rope); bridge(A, slabs[4], terraces[2], 3, M.wood, rope);

  // ---- red lacquer posts: a sparse set floor to sky (to swing from, and cut through)...
  for (let gx = -108; gx <= 108; gx += 17) for (let gz = -108; gz <= 108; gz += 17) {
    const x = gx + (r() - 0.5) * 10, z = gz + (r() - 0.5) * 10;
    if (Math.hypot(x, z) > 112 || r() < 0.15 || !clear(A, x, z, 2)) continue;
    stalk(A, x, z, 0.26 + r() * 0.12);
  }
  A.plantStalks(-62, 82);
  { // ...and thick stepping posts rising out of the clouds, their black-capped tops at about the height of the platforms
    // round them, higher and lower, many leaning at an angle: run and jump across them like stepping stones
    const plats = A.plats.slice(), posts = [], up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
    for (let gx = -100; gx <= 100; gx += 9) for (let gz = -100; gz <= 100; gz += 9) {
      const x = gx + (r() - 0.5) * 6, z = gz + (r() - 0.5) * 6;
      if (Math.hypot(x, z) > 100 || r() < 0.3 || !clear(A, x, z, 3)) continue;
      if (A.bamboo.some((s) => Math.hypot(s.x - x, s.z - z) < 2.5) || posts.some((p) => Math.hypot(p.x - x, p.z - z) < 4.2)) continue;
      let near = null, nd = 1e9; for (const p of plats) { const d = Math.hypot(p.x - x, p.z - z); if (d < nd) { nd = d; near = p; } }
      const top = Math.max(-14, Math.min(26, (near && nd < 40 ? near.y : 4) + (r() - 0.5) * 12)), rad = 0.85 + r() * 0.45;
      const lean = r() < 0.45 ? 0.09 + r() * 0.17 : 0, la = r() * TAU; // (radians off vertical, about 5 to 15 degrees, and which way)
      const len = top + 62, bx = x - Math.sin(lean) * Math.cos(la) * len, bz = z - Math.sin(lean) * Math.sin(la) * len, by = top - Math.cos(lean) * len;
      posts.push({ x, z, top, rad, bx, by, bz, len });
      A.discs.push({ x, z, r: rad + 0.1, y0: lean ? top - 1.2 : -62, y1: top }); // stand on the top (a leaning post is only solid near it)
      for (let t = 0; t <= 1.001; t += lean ? 0.08 : 1) { // hookable all the way down
        const px = bx + (x - bx) * t, py = by + (top - by) * t, pz = bz + (z - bz) * t, h = lean ? 3 : len / 2;
        A.rayBoxes.push({ x0: px - rad, x1: px + rad, y0: lean ? py - h : by, y1: lean ? py + h : top, z0: pz - rad, z1: pz + rad });
        if (!lean) break;
      }
      A.pillars.push({ x, z, w: rad * 2 });
    }
    const pm = M.bamboo.clone(); pm.map = M.bamboo.map.clone(); pm.map.needsUpdate = true; pm.map.repeat.set(3, 32); // (the gold bands every few metres up the long shafts)
    const shaft = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.12, 1, 12, 1, true).translate(0, 0.5, 0), pm, posts.length);
    const cap = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 14), black, posts.length);
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    posts.forEach((p, i) => {
      dir.set(p.x - p.bx, p.top - p.by, p.z - p.bz).normalize(); q.setFromUnitVectors(up, dir);
      mm.compose(v.set(p.bx, p.by, p.bz), q, s.set(p.rad, p.len, p.rad)); shaft.setMatrixAt(i, mm);
      mm.compose(v.set(p.x, p.top - 0.15, p.z), q.identity(), s.set(p.rad + 0.15, 0.3, p.rad + 0.15)); cap.setMatrixAt(i, mm); // (the cap sits level, so the top is flat to land on)
    });
    shaft.castShadow = cap.castShadow = A.quality !== 'low'; shaft.receiveShadow = cap.receiveShadow = true; S.add(shaft, cap);
  }
  A.finishNav();

  // ---- backdrop: sunset mountains with pines, a waterfall, the low sun, a sea of warm cloud, drifting petals
  const sunDir = A.sunOff.clone().normalize();
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(34, 40), flat(0xffe2a8)); sunDisc.position.copy(sunDir).multiplyScalar(480); sunDisc.lookAt(0, 0, 0); S.add(sunDisc);
  farRing(A, 16, 400, (x, z, i) => {
    const h = 130 + (i % 4) * 45, m = new THREE.Mesh(new THREE.ConeGeometry(70 + (i % 3) * 25, h, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x4a3560 : 0x5c4170, fog: false }));
    m.position.set(x, -80 + h / 2, z); m.rotation.y = i; S.add(m);
  });
  { // pine silhouettes along the mountain feet
    const im = new THREE.InstancedMesh(new THREE.ConeGeometry(4, 16, 5), flat(0x2a1d38), 160), mm = new THREE.Matrix4();
    for (let i = 0; i < 160; i++) { const a = r() * TAU, d = 300 + r() * 50, s = 0.7 + r() * 1.2; mm.compose(new THREE.Vector3(Math.cos(a) * d, -72 + 8 * s, Math.sin(a) * d), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); im.setMatrixAt(i, mm); }
    S.add(im);
  }
  { // a waterfall pouring off the tallest mountain, opposite the sun
    const t = T.canvasTex((g, s) => { g.fillStyle = '#8fb8d8'; g.fillRect(0, 0, s, s); for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.6})`; g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 20 + Math.random() * 60); } }, 128);
    t.repeat.set(2, 3);
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(36, 200), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.85, fog: false }));
    const a = Math.atan2(-sunDir.z, -sunDir.x) + 0.35; fall.position.set(Math.cos(a) * 360, 20, Math.sin(a) * 360); fall.lookAt(0, 20, 0); S.add(fall);
    const mist = new THREE.Mesh(new THREE.CircleGeometry(40, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, fog: false, depthWrite: false })); mist.position.set(Math.cos(a) * 355, -78, Math.sin(a) * 355); mist.lookAt(0, -78, 0); S.add(mist);
    A.anim.push((tt) => { t.offset.y = -tt * 0.9; });
  }
  const sea = new THREE.Mesh(new THREE.CircleGeometry(620, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf6bf98, transparent: true, opacity: 0.95 })); sea.position.y = -75; S.add(sea);
  drift(A, 420, 0xffc0d8, 0.16, [1.4, -0.7, 0.5], 0.6);
}

// ================= Moonlit Isles =================
export function buildIsles(A, T) {
  const S = A.scene, M = A.mats, r = T.rng(9091);
  A.plats = []; A.pillars = []; A.arcPts = []; A.killY = -45;
  A.setSky({ top: 0x050a22, mid: 0x26406e, bot: 0x14203a, fog: 0x1f2f55, near: 90, far: 400, hemiSky: 0x8aa2d8, hemiGround: 0x1a1a2a, hemi: 1.0, sunColor: 0xc8dcff, sun: 1.7, sunOff: new THREE.Vector3(-40, 60, -70) });
  M.bamboo = new THREE.MeshStandardMaterial({ map: T.bambooTex(), roughness: 0.55 });
  const grass = std(0x4b7a3c, { roughness: 1 }), rock = std(0x4a4658, { roughness: 1, flatShading: true }), rope = std(0x9a7a50, { roughness: 0.9 });
  const lantern = new THREE.MeshBasicMaterial({ color: 0xffd27a }), bark = std(0x4a3226, { roughness: 1 }), blossom = std(0xf2a6c8, { roughness: 0.8, emissive: 0x3a1020, emissiveIntensity: 0.6, flatShading: true });

  // an island: grass top, a rough rock cone hanging under it, a lantern and a few stones
  const island = (x, z, y, w, d) => {
    const p = deck(A, { x, z, y, w, d, mat: grass, kind: 'island', thick: 1.6 });
    prop(A, p, new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.62, Math.max(w, d) * 0.95, 7), rock), x, y - 1.6 - Math.max(w, d) * 0.47, z).rotation.x = Math.PI;
    const lx = x + w * 0.32, lz = z + d * 0.3;
    prop(A, p, new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.6), rock), lx, y + 0.5, lz); prop(A, p, new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), lantern), lx, y + 1.25, lz);
    for (let i = 0; i < 3; i++) prop(A, p, new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + r() * 0.6, 0), rock), x + (r() - 0.5) * w * 0.7, y + 0.2, z + (r() - 0.5) * d * 0.7);
    return p;
  };
  // the big middle island and its great cherry tree (the trunk is solid; you can hook the blossom)
  const C = island(0, 0, 0, 30, 30);
  A.tag = C; A.addBox(-1.2, 1.2, 0, 12, -1.2, 1.2, bark); A.tag = null;
  prop(A, C, new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.6, 12, 9), bark), 0, 6, 0);
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, m = new THREE.Mesh(new THREE.IcosahedronGeometry(4 + r() * 2, 1), blossom); prop(A, C, m, Math.cos(a) * 4.5, 14 + r() * 3, Math.sin(a) * 4.5); }
  prop(A, C, new THREE.Mesh(new THREE.IcosahedronGeometry(5.5, 1), blossom), 0, 18, 0);
  { const box = { x0: -8, x1: 8, y0: 12, y1: 21, z0: -8, z1: 8 }; A.rayBoxes.push(box); C.rays.push(box); }
  const ring1 = [6, -6, 10, -2, 3].map((y, k) => { const a = (k / 5) * TAU + 0.3; return island(Math.round(Math.cos(a) * 46), Math.round(Math.sin(a) * 46), y, 18, 16); });
  const ring2 = [16, -10, 22, -4, 12, -14, 20, 2].map((y, k) => { const a = (k / 8) * TAU; return island(Math.round(Math.cos(a) * 86), Math.round(Math.sin(a) * 86), y, 11 + (k % 3), 11); });
  for (const k of [0, 2, 3]) bridge(A, C, ring1[k], 2.6, M.wood, rope);
  // each of those also reaches out to the nearest outer island
  for (const k of [0, 2, 3]) { const a = ring1[k], b = ring2.slice().sort((u, v) => Math.hypot(u.x - a.x, u.z - a.z) - Math.hypot(v.x - a.x, v.z - a.z))[0]; bridge(A, a, b, 2.6, M.wood, rope); }

  // bamboo groves between the islands, plus a light scatter everywhere else
  const groves = [];
  for (let k = 0; k < 13; k++) { const a = (k / 13) * TAU + 0.2, d = k % 2 ? 66 : 30 + (k % 3) * 8; groves.push([Math.cos(a) * d, Math.sin(a) * d]); }
  // ---- dark water below the islands (touch it and you're gone), grass growing up out of it thick as a reed bed
  // (every blade cuts, and you mow through it just by moving), and four red spiked lily pads in clear water that snap
  // up and swallow anyone who steps on them or flies over them
  const isl = A.plats.slice(), WATER = Math.min(...isl.map((p) => p.y)) - 4;
  A.killY = WATER; A.water = null;
  { const w = new THREE.Mesh(new THREE.CircleGeometry(420, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0c1830, roughness: 0.12, metalness: 0.55, emissive: 0x050c1c }));
    w.position.y = WATER; w.userData.keep = true; S.add(w); }
  const pads = []; // four lily pads, out in open water clear of the islands
  for (let k = 0, tries = 0; k < 4 && tries < 400; tries++) {
    const a = r() * TAU, d = 22 + r() * 70, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!clear(A, x, z, 9) || pads.some((p) => Math.hypot(p.x - x, p.z - z) < 40)) continue;
    pads.push({ x, z, R: 4.2 }); k++;
  }
  const blade = (x, z, hook) => { // a grass blade: up out of the water to a little above the island nearest it
    if (pads.some((p) => Math.hypot(p.x - x, p.z - z) < p.R + 4)) return; // (clear water round each lily pad)
    let ny = 0, nd = 1e9; for (const p of isl) { const d = Math.hypot(p.x - x, p.z - z); if (d < nd) { nd = d; ny = p.y; } }
    const st = { x, z, r: 0.07 + r() * 0.05, segs: [], inst: A.bamboo.length, top: ny + 1.5 + r() * 5, rot: r() * TAU, noHook: !hook };
    A.bamboo.push(st); if (hook) A.pillars.push({ x, z, w: st.r * 2 });
  };
  const low = A.quality === 'low', step = low ? 2 : 1.22;
  let n = 0;
  for (let gx = -108; gx <= 108; gx += step) for (let gz = -108; gz <= 108; gz += step) { const x = gx + (r() - 0.5) * step * 1.3, z = gz + (r() - 0.5) * step * 1.3; if (Math.hypot(x, z) < 112 && clear(A, x, z, 0.7)) blade(x, z, (n++ % 7) === 0); }
  for (const [gx, gz] of groves) for (let i = 0; i < (low ? 60 : 160); i++) { const a = r() * TAU, d = Math.sqrt(r()) * 12, x = gx + Math.cos(a) * d, z = gz + Math.sin(a) * d; if (clear(A, x, z, 0.6)) blade(x, z, (n++ % 7) === 0); }
  M.bamboo = new THREE.MeshStandardMaterial({ roughness: 0.7, emissive: 0x0c2410, side: THREE.DoubleSide, map: T.canvasTex((g, s) => { // grass: green with fine veins
    g.fillStyle = '#3f7a34'; g.fillRect(0, 0, s, s); for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '20,50,20' : '120,180,90'},${0.15 + r() * 0.25})`; g.fillRect(r() * s, 0, 1 + r() * 2, s); }
  }, 64) });
  A.plantStalks(WATER - 0.5, 70, false, true);
  A.mow = true; // (moving through the grass cuts it)
  { // the lily pads: a red, slightly cupped pad with a notch, dark veins, and a ring of spikes round the rim pointing up.
    // Each is two halves hinged across the middle: when it strikes it leaps up and the halves slam shut like jaws.
    const red = std(0xb3202a, { roughness: 0.55, emissive: 0x2a0408, side: THREE.DoubleSide }), spikeM = std(0xe8d8c0, { roughness: 0.4 }), vein = std(0x5a0a12, { roughness: 0.8 });
    for (const p of pads) {
      const root = new THREE.Group(); root.position.set(p.x, WATER + 0.05, p.z); root.rotation.y = r() * TAU; S.add(root);
      { // a thin vine straight up out of its middle to just above the grass, a glowing red bud on top: you can see where it lurks
        let gl = -1e9; for (const st of A.bamboo) if (Math.abs(st.x - p.x) < 16 && Math.abs(st.z - p.z) < 16) gl = Math.max(gl, st.top);
        if (gl < WATER) gl = WATER + 12;
        const H = gl + 2.5 - WATER, pts = []; for (let k = 0; k <= 8; k++) { const u = k / 8; pts.push(new THREE.Vector3(Math.sin(u * 7 + p.x) * 0.35 * u, u * H, Math.cos(u * 5 + p.z) * 0.35 * u)); }
        const stem = new THREE.Group(); root.add(stem); p.stem = stem;
        stem.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.09, 6, false), std(0x6a1018, { roughness: 0.6, emissive: 0x2a0408 })));
        const bud = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff3a3a, emissive: 0xff1a20, emissiveIntensity: 1.4 })); bud.scale.y = 1.4; bud.position.copy(pts[8]); stem.add(bud);
      }
      p.halves = [-1, 1].map((sd) => {
        const h = new THREE.Group(); root.add(h);
        const g = new THREE.CircleGeometry(p.R, 24, sd < 0 ? 0.08 : Math.PI + 0.08, Math.PI - 0.16).rotateX(-Math.PI / 2); // (a notch at the hinge)
        const pp = g.attributes.position; for (let i = 0; i < pp.count; i++) { const rr = Math.hypot(pp.getX(i), pp.getZ(i)) / p.R; pp.setY(i, rr * rr * 0.35); } g.computeVertexNormals();
        h.add(new THREE.Mesh(g, red));
        for (let k = 0; k < 5; k++) { const a = (sd < 0 ? 0.3 : Math.PI + 0.3) + k * 0.6, v = new THREE.Mesh(new THREE.BoxGeometry(p.R * 0.85, 0.04, 0.09), vein); v.position.set(Math.cos(a) * p.R * 0.45, 0.06, -Math.sin(a) * p.R * 0.45); v.rotation.y = a; h.add(v); }
        for (let k = 0; k < 11; k++) { const a = (sd < 0 ? 0.15 : Math.PI + 0.15) + k * (Math.PI - 0.3) / 10, sp = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.3, 6), spikeM); sp.position.set(Math.cos(a) * (p.R - 0.15), 0.95, -Math.sin(a) * (p.R - 0.15)); sp.rotation.set(Math.sin(a) * 0.25 * -1, 0, Math.cos(a) * -0.25); h.add(sp); } // spikes round the rim, leaning out a little
        h.userData.side = sd; return h;
      });
      p.root = root; p.t = -1;
    }
    A.lilyNear = (q) => { for (const p of pads) if (Math.hypot(q.x - p.x, q.z - p.z) < p.R + 0.4 && q.y < WATER + 45) return p; return null; }; // stepped on, or flown over
    A.lilySnap = (p, at, onClose) => { p.t = 0; p.at = at.clone(); p.onClose = onClose; p.closed = false; };
    A.anim.push((t, dt) => {
      dt = dt || 0;
      for (const p of pads) {
        if (p.stem) { p.stem.rotation.x = Math.sin(t * 0.7 + p.x) * 0.03; p.stem.rotation.z = Math.cos(t * 0.6 + p.z) * 0.03; } // (the vine sways a little)
        if (p.t < 0) continue;
        p.t += dt; const u = p.t, lift = p.at.y - WATER - 0.6;
        const up = u < 0.25 ? u / 0.25 : u < 0.7 ? 1 : Math.max(0, 1 - (u - 0.7) / 0.8); // leap up, hold the bite, sink back
        p.root.position.y = WATER + 0.05 + lift * (1 - Math.pow(1 - up, 3));
        const shut = u < 0.18 ? 0 : u < 0.3 ? (u - 0.18) / 0.12 : u < 1.2 ? 1 : Math.max(0, 1 - (u - 1.2) / 0.5); // SNAP shut, then open again on the water
        for (const h of p.halves) h.rotation.x = h.userData.side * shut * 1.45;
        if (!p.closed && u >= 0.3) { p.closed = true; if (p.onClose) p.onClose(); }
        if (u > 1.8) { p.t = -1; p.root.position.y = WATER + 0.05; for (const h of p.halves) h.rotation.x = 0; }
      }
    });
  }
  A.fallText = (q) => 'fell in the water'; A.fallBy = (q) => 'Fell in the water';
  A.finishNav();

  // ---- backdrop: stars, the full moon with a halo, far floating islands with trees, a moonlit cloud sea, fireflies
  { const n = 1600, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = r() * TAU, v = Math.acos(1 - r() * 1.05); pos[i * 3] = Math.sin(v) * Math.cos(u) * 470; pos[i * 3 + 1] = Math.cos(v) * 470; pos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * 470; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); S.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }))); }
  const md = A.sunOff.clone().normalize();
  const moon = new THREE.Mesh(new THREE.CircleGeometry(26, 40), flat(0xf4f1e2)); moon.position.copy(md).multiplyScalar(470); moon.lookAt(0, 0, 0); S.add(moon);
  const haloTex = T.canvasTex((g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(200,220,255,0.55)'); gr.addColorStop(1, 'rgba(200,220,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }, 128);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); halo.position.copy(moon.position).multiplyScalar(0.99); halo.scale.set(190, 190, 1); S.add(halo);
  farRing(A, 12, 360, (x, z, i) => {
    const y = -20 + (i % 4) * 22, s = 22 + (i % 3) * 12;
    const under = new THREE.Mesh(new THREE.ConeGeometry(s, s * 1.6, 6), flat(0x141a33)); under.rotation.x = Math.PI; under.position.set(x, y - s * 0.8, z); S.add(under);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(s, s, 2, 6), flat(0x1c2a40)); top.position.set(x, y, z); S.add(top);
    for (let t = 0; t < 3; t++) { const tr = new THREE.Mesh(new THREE.IcosahedronGeometry(s * 0.22, 0), flat(t % 2 ? 0x3a2a48 : 0x22314a)); tr.position.set(x + (t - 1) * s * 0.4, y + s * 0.3, z + Math.sin(t) * s * 0.3); S.add(tr); }
  });
  const sea = new THREE.Mesh(new THREE.CircleGeometry(620, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x33456e, transparent: true, opacity: 0.95 })); sea.position.y = -75; S.add(sea);
  drift(A, 260, 0xd8ff8a, 0.14, [0, 0, 0], 0.8);
}

// ================= Sky Spires: the coliseum bowl =================
// A round arena floor in the middle, then rings of round platforms stepping up and out like the seats of a
// coliseum. Everyone starts on the high rim and swings down on the stone columns between the rings.
function disc(A, o) {
  const p = { kind: o.kind, x: o.x, z: o.z, y: o.y, w: o.R * 2, d: o.R * 2, ang: 0, round: o.R, i: A.plats.length, meshes: [], boxes: [], ramps: [], rays: [] };
  A.plats.push(p); A.tag = p;
  A.addDisc(o.x, o.z, o.R, o.y - 0.4, o.y, A.mats.floor, 48); // the walking surface
  A.addDisc(o.x, o.z, o.R - 0.25, o.y - 2.4, o.y - 0.4, A.mats.stone, 40); // its stone rim
  A.tag = null;
  const h = 6 + o.R * 0.9, cone = new THREE.Mesh(new THREE.ConeGeometry(o.R * 0.85, h, 12, 3), A.mats.rock);
  cone.rotation.x = Math.PI; prop(A, p, cone, o.x, o.y - 2.4 - h / 2, o.z);
  A.node('P' + p.i, o.x, o.y, o.z).plat = p.i;
  const sp = new THREE.Vector3(o.x, o.y, o.z); sp.plat = p.i; A.spawns.push(sp);
  return p;
}
export function buildBowl(A, T) {
  const S = A.scene;
  A.plats = []; A.pillars = []; A.arcPts = []; A.killY = -45;
  A.setSky({ top: 0x5d8fc4, mid: 0xe6d3b3, bot: 0xd9b98a, fog: 0xdcc6a2, near: 110, far: 420, hemiSky: 0xd8ecff, hemiGround: 0x5a4a38, hemi: 0.85, sunColor: 0xfff0d8, sun: 2.0, sunOff: new THREE.Vector3(30, 50, 18) });
  buildMaw(A, T); // the giant creature's mouth below and the colosseum's stands around it
  // the arena floor (lowest), then three rings, each higher and further out
  const hub = disc(A, { x: 0, z: 0, y: 0, R: 18, kind: 'hub' });
  const ring = (n, rad, y, R, kind, off) => { for (let i = 0; i < n; i++) { const a = (i + off) / n * TAU; disc(A, { x: Math.round(Math.cos(a) * rad), z: Math.round(Math.sin(a) * rad), y: y + (i % 2 ? 1 : -1), R, kind }); } };
  ring(8, 34, 10, 6.5, 'tier', 0);
  ring(10, 56, 21, 6, 'tier', 0.5);
  ring(12, 80, 33, 6, 'rim', 0.25);
  { const m = new THREE.Mesh(new THREE.TorusGeometry(12, 0.25, 6, 64), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.7, roughness: 0.35 })); m.rotation.x = Math.PI / 2; prop(A, hub, m, 0, 0.03, 0); } // arena ring
  // fleshy tendrils rising out of the maw between the rings: the things you swing on (they bend as you swing on them)
  const tpts = [];
  for (let i = 0, tries = 0; tpts.length < 16 && tries < 400; i++, tries++) { // spread all over the mouth (near and far, never under a platform), each still curling in over the middle
    const a = i * 2.39996, rad = 105 + ((i * 37) % 65), x = Math.cos(a) * rad, z = Math.sin(a) * rad; // (rooted far out in the mouth, reaching right in)
    if (A.plats.some((p) => Math.hypot(p.x - x, p.z - z) < (p.round || 6) + 3) || tpts.some(([u, v]) => Math.hypot(u - x, v - z) < 14)) continue;
    tpts.push([x, z]);
  }
  buildTendrils(A, tpts);
  A.finishNav();
}
export { deck, prop, bridge, stalk, clear, drift, farRing };
