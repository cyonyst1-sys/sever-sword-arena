// Transport: a sandstone canyon at golden hour. A camel hauls a covered wagon down a winding dirt road from one adobe
// village to the next. The escort walks with it and fights off the raiders who come at it to hack it apart. Rock
// outcrops, palms, two great rock arches and wooden watchtowers along the way to fight round and swing from.
import * as THREE from 'three';

const TAU = Math.PI * 2;
export const ROUTE = { z0: -150, z1: 150, speed: 2.3, hp: 100 };
const roadX = (z) => 9 * Math.sin(z / 38) + 4 * Math.sin(z / 17 + 1);
const valleyX = (z) => roadX(z) * 0.5; // (the canyon follows the road's bends, a little)

export function buildTransport(A, T) {
  const S = A.scene, r = T.rng(4242), low = A.quality === 'low';
  A.plats = []; A.pillars = []; A.killY = -30;
  A.setSky({ top: 0x5a8cc8, mid: 0xf0c890, bot: 0xd8a070, fog: 0xeac498, near: 90, far: 340, hemiSky: 0xfff0d8, hemiGround: 0x9a6a40, hemi: 1.2, sunColor: 0xffe0b0, sun: 2.5, sunOff: new THREE.Vector3(-40, 55, 30) });

  // ---- textures: rippled sand, a rutted dirt road, sun-baked adobe, and cloth
  const sand = T.canvasTex((g, s) => { const q = T.rng(5); g.fillStyle = '#d9b07a'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${q() < 0.5 ? '150,105,60' : '250,222,172'},${0.12 + q() * 0.2})`; g.lineWidth = 1 + q() * 3; const y = q() * s, ph = q() * 9; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + ph) * 6); g.stroke(); } // wind ripples
    T.speckle(g, s, q, 6000, 0.25); }, 512);
  sand.repeat.set(30, 60);
  const dirt = T.canvasTex((g, s) => { const q = T.rng(8); g.fillStyle = '#9a7048'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${q() < 0.5 ? '70,45,25' : '190,150,105'},${0.2 + q() * 0.3})`; g.beginPath(); g.arc(q() * s, q() * s, 1 + q() * 5, 0, TAU); g.fill(); } // pebbles
    for (const u of [0.3, 0.7]) { g.fillStyle = 'rgba(60,38,20,0.45)'; g.fillRect(u * s - 9, 0, 18, s); g.fillStyle = 'rgba(40,25,12,0.3)'; g.fillRect(u * s - 4, 0, 8, s); } // wheel ruts
    const e = g.createLinearGradient(0, 0, s, 0); e.addColorStop(0, 'rgba(217,176,122,1)'); e.addColorStop(0.12, 'rgba(217,176,122,0)'); e.addColorStop(0.88, 'rgba(217,176,122,0)'); e.addColorStop(1, 'rgba(217,176,122,1)'); g.fillStyle = e; g.fillRect(0, 0, s, s); // (soft sandy edges)
    T.speckle(g, s, q, 4000, 0.2); }, 256);
  const adobe = T.canvasTex((g, s) => { const q = T.rng(11); g.fillStyle = '#d6a878'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${q() < 0.5 ? '160,110,70' : '240,205,160'},${0.15 + q() * 0.25})`; g.beginPath(); g.ellipse(q() * s, q() * s, 4 + q() * 18, 3 + q() * 10, q() * 3, 0, TAU); g.fill(); } // trowelled mud
    for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(90,60,35,0.35)'; g.lineWidth = 1; let x = q() * s, y = q() * s; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (q() - 0.5) * 30; y += q() * 20; g.lineTo(x, y); } g.stroke(); } // cracks
    T.speckle(g, s, q, 3000, 0.2); }, 256);
  const adobeM = new THREE.MeshStandardMaterial({ map: adobe, bumpMap: adobe, bumpScale: 1.5, roughness: 0.95 });
  const woodM = new THREE.MeshStandardMaterial({ map: T.woodTex(), roughness: 0.85, color: 0xc8a888 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 });
  const cloth = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, side: THREE.DoubleSide });

  // ---- the ground: flat sand to fight on along the valley, rising into dunes beyond the canyon walls
  const plats = A.plats;
  A.boxes.push({ x0: -70, x1: 70, y0: -3, y1: 0, z0: -205, z1: 205, noHook: true });
  plats.push({ kind: 'ground', x: 0, z: 0, y: 0, w: 140, d: 410, ang: 0, i: 0, meshes: [], boxes: [], ramps: [], rays: [] });
  A.node('P0', 0, 0, 0).plat = 0;
  {
    const g = new THREE.PlaneGeometry(520, 760, low ? 60 : 130, low ? 90 : 190).rotateX(-Math.PI / 2), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), e = Math.abs(x - valleyX(z)) - 44; p.setY(i, (e > 0 ? Math.min(60, e * 0.5) * (0.6 + 0.4 * Math.sin(x * 0.03 + z * 0.02)) : 0) + 0.04 * Math.sin(x * 0.7) * Math.sin(z * 0.5) - 0.06); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: sand, roughness: 1, color: 0xf4dcc0 })); m.receiveShadow = true; S.add(m);
  }
  // ---- the road: a dirt ribbon winding from village to village
  {
    const pos = [], uv = [], idx = [], W = 3;
    let v = 0, prev = null;
    for (let z = -192; z <= 192; z += 1.5) {
      const x = roadX(z), dx = roadX(z + 0.5) - roadX(z - 0.5), l = Math.hypot(dx, 1), nx = 1 / l, nz = -dx / l;
      if (prev) v += Math.hypot(x - prev[0], z - prev[1]) / 6; prev = [x, z];
      pos.push(x - nx * W, 0.02, z - nz * W, x + nx * W, 0.02, z + nz * W); uv.push(0, v, 1, v);
      const k = pos.length / 3 - 2; if (k > 0) idx.push(k - 2, k, k - 1, k - 1, k, k + 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: dirt, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 })); m.receiveShadow = true; S.add(m);
  }

  // what's been placed so far (keeps things apart, and off the road)
  const taken = [];
  const clearOf = (x, z, R, road = 6) => Math.abs(x - roadX(z)) > R + road && taken.every((t) => Math.hypot(t[0] - x, t[1] - z) > t[2] + R + 1.5);
  const boulder = (x0, x1, y0, y1, z0, z1, hook = true) => { const m = A.addBox(x0, x1, y0, y1, z0, z1, A.mats.stone); A.rockify(m, x0, x1, y0, y1, z0, z1, r); if (!hook) A.boxes[A.boxes.length - 1].noHook = true; return m; };

  // ---- the canyon walls: sandstone cliffs down both sides and across both ends (you can hook them)
  for (const side of [-1, 1]) for (let z = -200; z <= 200; z += 9 + r() * 3) {
    const c = valleyX(z) + side * (33 + r() * 4), w = 9 + r() * 6, h = 14 + r() * 18, d = 10 + r() * 4;
    boulder(side < 0 ? c - w : c, side < 0 ? c : c + w, -1, h, z - d / 2, z + d / 2);
  }
  for (const zEnd of [-204, 204]) for (let x = -40; x <= 40; x += 10) boulder(x - 6, x + 6, -1, 16 + r() * 14, zEnd - 5, zEnd + 5);
  { const m = new THREE.MeshStandardMaterial({ color: 0xc08058, roughness: 1, flatShading: true }); // far-off mesas in the haze
    for (let k = 0; k < (low ? 10 : 22); k++) { const side = k % 2 ? 1 : -1, x = side * (110 + r() * 120), z = (r() - 0.5) * 600, R = 18 + r() * 30, h = 30 + r() * 50;
      const me = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.8, R * 1.2, h, 9), m); me.position.set(x, h / 2 - 5, z); me.rotation.y = r() * TAU; S.add(me); } }

  // ---- adobe houses: flat roofs (you can stand on them), wooden roof beams poking out, a dark doorway, cloth awnings
  const house = (x, z, w, d, h) => {
    A.addBox(x - w / 2, x + w / 2, 0, h, z - d / 2, z + d / 2, adobeM, { plain: true });
    A.addBox(x - w / 2 - 0.15, x + w / 2 + 0.15, h, h + 0.5, z - d / 2 - 0.15, z + d / 2 + 0.15, adobeM, { plain: true }); // parapet cap
    const beams = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.13, 0.9, 6).rotateX(Math.PI / 2), darkWood, Math.floor(w / 1.1) * 2);
    let n = 0; const mt = new THREE.Matrix4();
    for (let bx = -w / 2 + 0.6; bx < w / 2 - 0.3 && n < beams.count - 1; bx += 1.1) for (const s of [-1, 1]) { mt.makeTranslation(x + bx, h - 0.45, z + s * (d / 2 + 0.3)); beams.setMatrixAt(n++, mt); }
    beams.count = n; S.add(beams);
    const face = Math.abs(roadX(z) - x) > 0 ? Math.sign(roadX(z) - x) : 1; // (the door faces the road)
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.2), new THREE.MeshBasicMaterial({ color: 0x24160c })); door.position.set(x + face * (w / 2 + 0.02), 1.1, z); door.rotation.y = face * Math.PI / 2; S.add(door);
    if (r() < 0.6) { const aw = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.7, 2.2), cloth([0xb8402c, 0x2c6a8a, 0xd8b040, 0x6a8a3a][(r() * 4) | 0])); aw.position.set(x + face * (w / 2 + 1.0), 2.7, z); aw.rotation.set(0, face * Math.PI / 2, 0); aw.rotateX(-1.0); S.add(aw); }
    taken.push([x, z, Math.hypot(w, d) / 2]);
  };
  const village = (zc, dir) => { // dir: which way the road leaves the village
    for (let t = 0, n = 0; t < 80 && n < 9; t++) {
      const w = 5 + r() * 4, d = 5 + r() * 4, h = 3.5 + r() * 3.5, z = zc + (r() - 0.5) * 40, x = roadX(z) + (r() < 0.5 ? -1 : 1) * (7 + w / 2 + r() * 16);
      if (Math.abs(x - valleyX(z)) > 28 - w / 2 || !clearOf(x, z, Math.hypot(w, d) / 2, 5)) continue;
      house(x, z, w, d, h); n++;
    }
    // a well in the square, and crates and barrels by the road
    const wx = roadX(zc) + 9 * dir, wz = zc;
    if (clearOf(wx, wz, 1.6, 2)) { A.addDisc(wx, wz, 1.3, 0, 1.0, adobeM, 20); const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.9, 4), darkWood); roof.position.set(wx, 3.0, wz); roof.rotation.y = Math.PI / 4; S.add(roof);
      for (const s of [-1, 1]) A.addBox(wx + s * 1.1 - 0.1, wx + s * 1.1 + 0.1, 1, 2.6, wz - 0.1, wz + 0.1, darkWood, { solid: false }); taken.push([wx, wz, 1.6]); }
  };
  village(-170, 1); village(170, -1);
  // the destination: a great adobe gateway over the road into the far village, and a gold beam where the wagon unloads
  { const z = ROUTE.z1 - 6, x = roadX(z);
    for (const s of [-1, 1]) { A.addBox(x + s * 6.5 - 1.5, x + s * 6.5 + 1.5, 0, 10, z - 1.5, z + 1.5, adobeM, { plain: true }); taken.push([x + s * 6.5, z, 2.2]); }
    A.addBox(x - 8, x + 8, 8, 10, z - 1.2, z + 1.2, adobeM, { plain: true });
    for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4.5), cloth(0x2f7ae0)); b.position.set(x + s * 6.5, 6.5, z - 1.55); S.add(b); }
    const ex = roadX(ROUTE.z1), beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 90, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffc23d, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(ex, 45, ROUTE.z1 + 3); S.add(beam);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.1, 6, 48), new THREE.MeshBasicMaterial({ color: 0xffd25a })); ring.rotation.x = Math.PI / 2; ring.position.set(ex, 0.15, ROUTE.z1 + 3); S.add(ring);
    A.anim.push((t) => { ring.scale.setScalar(1 + 0.08 * Math.sin(t * 3)); });
  }

  // ---- two great rock arches spanning the road (swing from the span)
  for (const z of [-62, 68]) { const x = roadX(z);
    for (const s of [-1, 1]) { const px = x + s * 9.5; boulder(px - 2.6, px + 2.6, -0.5, 15, z - 2.4, z + 2.4); taken.push([px, z, 3.5]); }
    boulder(x - 12, x + 12, 12, 16.5, z - 2.6, z + 2.6);
  }
  // ---- wooden watchtowers: four posts, a deck up top to stand on, and a little thatched roof
  for (const z of [-110, -10, 105]) { const s = z > 0 ? 1 : -1, x = roadX(z) + s * 13, Y = 6.5;
    if (!clearOf(x, z, 2.6)) continue;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.addBox(x + a * 1.6 - 0.18, x + a * 1.6 + 0.18, 0, Y + 3, z + b * 1.6 - 0.18, z + b * 1.6 + 0.18, woodM, { plain: true });
    A.addBox(x - 2.1, x + 2.1, Y - 0.35, Y, z - 2.1, z + 2.1, woodM, { plain: true });
    for (const [a, b, w, d] of [[0, -2, 4.2, 0.12], [0, 2, 4.2, 0.12], [-2, 0, 0.12, 4.2], [2, 0, 0.12, 4.2]]) A.addBox(x + a - w / 2, x + a + w / 2, Y, Y + 1.0, z + b - d / 2, z + b + d / 2, woodM, { plain: true, solid: false });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.8, 4), new THREE.MeshStandardMaterial({ color: 0xb08850, roughness: 1 })); roof.position.set(x, Y + 3.9, z); roof.rotation.y = Math.PI / 4; roof.castShadow = true; S.add(roof);
    A.rayBoxes.push({ x0: x - 2.2, x1: x + 2.2, y0: Y + 3, y1: Y + 4.5, z0: z - 2.2, z1: z + 2.2 });
    taken.push([x, z, 3]);
  }
  // ---- rock outcrops along the way: cover to fight round, and rocks to hook
  for (let t = 0, n = 0; t < 300 && n < (low ? 14 : 20); t++) {
    const z = -135 + r() * 270, w = 3 + r() * 5, d = 3 + r() * 5, h = 2 + r() * 6, x = roadX(z) + (r() < 0.5 ? -1 : 1) * (8 + r() * 18);
    if (Math.abs(x - valleyX(z)) > 29 - w / 2 || !clearOf(x, z, Math.hypot(w, d) / 2)) continue;
    boulder(x - w / 2, x + w / 2, -0.4, h, z - d / 2, z + d / 2); taken.push([x, z, Math.hypot(w, d) / 2]); n++;
  }
  // ---- date palms: leaning, ringed trunks you can hook, and a crown of fronds (all instanced)
  {
    const spots = [];
    for (let t = 0; t < 400 && spots.length < (low ? 18 : 30); t++) { const z = -195 + r() * 390, x = roadX(z) + (r() < 0.5 ? -1 : 1) * (6 + r() * 22); if (Math.abs(x - valleyX(z)) > 29 || !clearOf(x, z, 1)) continue; spots.push([x, z]); taken.push([x, z, 1.2]); }
    const SEG = 6, trunkG = new THREE.CylinderGeometry(0.26, 0.34, 1, 8, 1), ringTex = T.canvasTex((g, s) => { g.fillStyle = '#7a5a3a'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 8) { g.fillStyle = 'rgba(40,25,12,0.6)'; g.fillRect(0, y, s, 3); } T.speckle(g, s, T.rng(3), 800, 0.3); }, 64);
    ringTex.repeat.set(2, 3);
    const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ map: ringTex, roughness: 0.95 }), spots.length * SEG);
    const frondG = (() => { const g = new THREE.PlaneGeometry(1.1, 4.2, 1, 8).translate(0, 2.1, 0).rotateX(-Math.PI / 2), p = g.attributes.position; // a long leaf drooping toward its tip
      for (let i = 0; i < p.count; i++) { const zz = -p.getZ(i), k = zz / 4.2; p.setX(i, p.getX(i) * (1 - k * 0.7) * (0.6 + 0.4 * Math.sin(k * Math.PI))); p.setY(i, -k * k * 1.8 + Math.abs(p.getX(i)) * -0.25); p.setZ(i, -zz); }
      g.computeVertexNormals(); return g; })();
    const frondN = 9, fronds = new THREE.InstancedMesh(frondG, new THREE.MeshStandardMaterial({ color: 0x5a8a3a, roughness: 0.85, side: THREE.DoubleSide }), spots.length * frondN);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1);
    let ti = 0, fi = 0;
    for (const [x, z] of spots) {
      const h = 7 + r() * 5, la = r() * TAU, lean = 0.12 + r() * 0.18, pts = [];
      for (let k = 0; k <= SEG; k++) { const u = k / SEG, off = Math.sin(lean) * h * u * u; pts.push(new THREE.Vector3(x + Math.cos(la) * off, h * u, z + Math.sin(la) * off)); } // (curving as it rises)
      for (let k = 0; k < SEG; k++) { const a = pts[k], b = pts[k + 1], d = b.clone().sub(a), L = d.length(); q.setFromUnitVectors(up, d.normalize()); sc.set(1 - k * 0.07, L, 1 - k * 0.07); mt.compose(a.clone().lerp(b, 0.5), q, sc); trunks.setMatrixAt(ti++, mt);
        if (k % 2 === 0) A.rayBoxes.push({ x0: a.x - 0.4, x1: a.x + 0.4, y0: a.y, y1: b.y, z0: a.z - 0.4, z1: a.z + 0.4 }); }
      A.discs.push({ x, z, r: 0.38, y0: 0, y1: h * 0.5 });
      const top = pts[SEG];
      for (let k = 0; k < frondN; k++) { const e = new THREE.Euler(-0.25 + r() * 0.35, k / frondN * TAU + r() * 0.3, 0, 'YXZ'); q.setFromEuler(e); sc.set(1, 1, 1); mt.compose(top, q, sc); fronds.setMatrixAt(fi++, mt); }
      A.rayBoxes.push({ x0: top.x - 1.6, x1: top.x + 1.6, y0: top.y - 1, y1: top.y + 0.6, z0: top.z - 1.6, z1: top.z + 1.6 }); // (hook the crown)
    }
    trunks.castShadow = fronds.castShadow = true; S.add(trunks, fronds);
  }

  // ---- bots' walking map: a grid of points across the valley floor, joined where you can walk straight between them
  {
    const G = [], STEP = 12;
    for (let z = -192; z <= 192; z += STEP) for (let i = -2; i <= 2; i++) { const x = valleyX(z) + i * STEP; if (A.wallAt(x, z, 0, 1.7, 0.6)) continue; const n = A.node('G' + G.length, x, 0, z); n.plat = 0; G.push(n); }
    for (const a of G) for (const b of G) if (a.id < b.id && a.p.distanceTo(b.p) < STEP * 1.5 && A.directPath(a.p, b.p)) A.link(a.name, b.name);
    let best = null, bd = Infinity; for (const n of G) { const d = n.p.length(); if (d < bd) { bd = d; best = n; } } if (best) A.link('P0', best.name);
  }
  // spawn spots (the escort and the raiders each have their own: chosen in the game by where the wagon is)
  for (let z = -180; z <= 180; z += 20) { const sp = new THREE.Vector3(roadX(z), 0.05, z); sp.plat = 0; A.spawns.push(sp); }

  A.caravan = makeCaravan(A, T, woodM, darkWood, cloth);
  A.finishNav();
}

// ---------- the caravan: a covered wagon, drawn by a camel, following the road ----------
function makeCaravan(A, T, woodM, darkWood, cloth) {
  const S = A.scene;
  // the route, measured out by distance along it (a point every half metre)
  const pts = [];
  { let px = roadX(ROUTE.z0), pz = ROUTE.z0, acc = 0; pts.push([px, pz]);
    for (let z = ROUTE.z0 + 0.05; z <= ROUTE.z1; z += 0.05) { const x = roadX(z); acc += Math.hypot(x - px, z - pz); px = x; pz = z; if (acc >= 0.5) { pts.push([x, z]); acc = 0; } } }
  const len = (pts.length - 1) * 0.5;
  const at = (s) => { const u = Math.max(0, Math.min(pts.length - 1.001, s / 0.5 + 0.0)), i = Math.floor(u), f = u - i, a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)], c = pts[Math.min(pts.length - 1, i + 2)];
    const x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f; return { x, z, a: Math.atan2(c[0] - a[0], c[1] - a[1] || 1e-6) }; };

  // ---- the wagon (forward is +z)
  const wagon = new THREE.Group(); S.add(wagon);
  const add = (g, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const coverM = new THREE.MeshStandardMaterial({ color: 0xeee0c4, roughness: 0.95, side: THREE.DoubleSide, emissive: 0xff2010, emissiveIntensity: 0 });
  add(wagon, new THREE.BoxGeometry(2.3, 0.3, 4.2), woodM, 0, 1.05, 0);
  for (const s of [-1, 1]) add(wagon, new THREE.BoxGeometry(0.12, 0.55, 4.2), woodM, s * 1.1, 1.45, 0);
  add(wagon, new THREE.BoxGeometry(2.3, 0.55, 0.12), woodM, 0, 1.45, -2.05);
  const cover = add(wagon, new THREE.CylinderGeometry(1.25, 1.25, 3.7, 20, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), coverM, 0, 1.55, -0.15);
  cover.scale.set(0.95, 1.1, 1);
  for (const z of [-1.9, -0.15, 1.6]) { const hoop = add(wagon, new THREE.TorusGeometry(1.2, 0.05, 5, 20, Math.PI), darkWood, 0, 1.55, z); hoop.scale.set(0.97, 1.12, 1); }
  for (const [x, z, c] of [[-0.5, -1.4, 0x8a6a40], [0.45, -1.2, 0x6a4a2a], [0, 1.2, 0x9a7a4a]]) add(wagon, new THREE.BoxGeometry(0.7, 0.6, 0.7), new THREE.MeshStandardMaterial({ map: woodM.map, color: c, roughness: 0.9 }), x, 1.5, z); // crates
  for (const s of [-1, 1]) { const shaft = add(wagon, new THREE.CylinderGeometry(0.06, 0.07, 3.4, 6).rotateX(Math.PI / 2), darkWood, s * 0.55, 1.0, 3.6); shaft.rotation.x = -0.08; }
  const wheels = [];
  const wheelG = (() => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 6, 20), darkWood)); g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 8).rotateX(Math.PI / 2), darkWood));
    for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.15, 0.05), woodM); sp.rotation.z = k / 6 * Math.PI; g.add(sp); } return g; })();
  for (const [x, z] of [[-1.25, -1.35], [1.25, -1.35], [-1.25, 1.35], [1.25, 1.35]]) { const w = wheelG.clone(); w.rotation.y = Math.PI / 2; w.position.set(x, 0.62, z); wagon.add(w); wheels.push(w); }
  const lantern = new THREE.PointLight(0xffb060, 0, 9); lantern.position.set(0, 2.6, 2.1); wagon.add(lantern);

  // ---- the camel
  const camel = new THREE.Group(); S.add(camel);
  const hide = new THREE.MeshStandardMaterial({ color: 0xc89a5e, roughness: 0.95 });
  const body = add(camel, new THREE.SphereGeometry(1, 16, 12), hide, 0, 2.05, 0); body.scale.set(0.62, 0.62, 1.25);
  const hump = add(camel, new THREE.SphereGeometry(1, 14, 10), hide, 0, 2.65, -0.1); hump.scale.set(0.45, 0.55, 0.6);
  const blanket = add(camel, new THREE.BoxGeometry(1.35, 0.5, 1.2), cloth(0xa8302a), 0, 2.2, 0.55); blanket.scale.y = 1;
  const neck = add(camel, new THREE.CylinderGeometry(0.2, 0.32, 1.5, 8), hide, 0, 2.55, 1.45); neck.rotation.x = 0.75;
  const head = add(camel, new THREE.SphereGeometry(1, 12, 8), hide, 0, 3.15, 2.05); head.scale.set(0.24, 0.24, 0.48);
  for (const s of [-1, 1]) add(camel, new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }), s * 0.16, 3.25, 2.05);
  const tail = add(camel, new THREE.CylinderGeometry(0.03, 0.06, 0.7, 5), hide, 0, 2.0, -1.3); tail.rotation.x = -0.3;
  const legs = [];
  for (const [x, z, ph] of [[-0.35, 0.8, 0], [0.35, 0.8, Math.PI], [-0.35, -0.8, Math.PI], [0.35, -0.8, 0]]) {
    const hip = new THREE.Group(); hip.position.set(x, 1.75, z); camel.add(hip);
    const up = add(hip, new THREE.CylinderGeometry(0.13, 0.11, 0.95, 6), hide, 0, -0.47, 0);
    const knee = new THREE.Group(); knee.position.y = -0.95; hip.add(knee); add(knee, new THREE.CylinderGeometry(0.09, 0.08, 0.8, 6), hide, 0, -0.4, 0);
    add(knee, new THREE.CylinderGeometry(0.13, 0.13, 0.08, 8), darkWood, 0, -0.8, 0.04); void up;
    legs.push({ hip, knee, ph });
  }

  // ---- its health bar, floating over the wagon
  const barC = document.createElement('canvas'); barC.width = 256; barC.height = 32; const bg = barC.getContext('2d');
  const barT = new THREE.CanvasTexture(barC); barT.colorSpace = THREE.SRGBColorSpace;
  const bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: barT, depthTest: false, transparent: true })); bar.scale.set(2.8, 0.35, 1); bar.renderOrder = 10; S.add(bar);
  let shownHp = -1;
  const drawBar = (hp) => { const k = Math.max(0, hp) / ROUTE.hp; bg.clearRect(0, 0, 256, 32); bg.fillStyle = 'rgba(0,0,0,0.6)'; bg.fillRect(0, 0, 256, 32);
    bg.fillStyle = k > 0.5 ? '#5ad06a' : k > 0.25 ? '#f0c040' : '#e04a3a'; bg.fillRect(4, 4, 248 * k, 24); bg.strokeStyle = 'rgba(255,255,255,0.8)'; bg.lineWidth = 2; bg.strokeRect(1, 1, 254, 30); barT.needsUpdate = true; };

  // collision: the wagon and the camel push you aside (and you can hook them). Their boxes follow them along the road.
  const wBox = { x0: 0, x1: 0, y0: 0, y1: 2.2, z0: 0, z1: 0 }, cBox = { x0: 0, x1: 0, y0: 0.9, y1: 2.6, z0: 0, z1: 0 };
  A.boxes.push(wBox, cBox);
  const fit = (b, x, z, a, hw, hl) => { const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)), ex = c * hw + s * hl, ez = s * hw + c * hl; b.x0 = x - ex; b.x1 = x + ex; b.z0 = z - ez; b.z1 = z + ez; };
  const CAMEL = 4.9; // (how far ahead of the wagon the camel walks)
  let lastS = 0, gait = 0, flashT = 0, tip = 0;
  const C = {
    len, at, wagon, camel, pos: new THREE.Vector3(), ang: 0, s: 0, hp: ROUTE.hp,
    /** Move everything to distance s along the road. hp: its health (a drop flashes it red); dead: it's wrecked. */
    update(s, hp, dt, dead) {
      s = Math.max(0, Math.min(len, s)); const ds = s - lastS; lastS = s; C.s = s;
      const w = at(s), c = at(Math.min(len, s + CAMEL)), cb = at(Math.min(len, s + CAMEL + 1));
      wagon.position.set(w.x, 0, w.z); wagon.rotation.y = w.a; C.ang = w.a; C.pos.set(w.x, 1.3, w.z);
      camel.position.set(c.x, 0, c.z); camel.rotation.y = Math.atan2(cb.x - c.x, cb.z - c.z);
      for (const wh of wheels) wh.rotation.x += ds / 0.62; // (rolling)
      gait += ds * 2.4;
      const walk = Math.min(1, Math.abs(ds) / Math.max(dt, 1e-3) / ROUTE.speed);
      for (const L of legs) { const k = Math.sin(gait + L.ph); L.hip.rotation.x = k * 0.45 * walk; L.knee.rotation.x = Math.max(0, -Math.cos(gait + L.ph)) * 0.7 * walk; }
      head.position.y = 3.15 + Math.sin(gait * 2) * 0.05 * walk; neck.rotation.x = 0.75 + Math.sin(gait * 2) * 0.04 * walk;
      if (hp < C.hp - 0.01) flashT = 0.22; C.hp = hp;
      flashT = Math.max(0, flashT - dt); coverM.emissiveIntensity = flashT * 3;
      if (dead) { tip = Math.min(1, tip + dt * 1.5); wagon.rotation.z = tip * 0.55; wagon.position.y = -tip * 0.35; wheels[0].visible = wheels[2].visible = tip < 0.3; coverM.color.setHex(0x6a5a48); camel.visible = tip < 0.2; } else if (tip) { tip = 0; wagon.rotation.z = 0; wheels.forEach((x) => (x.visible = true)); coverM.color.setHex(0xeee0c4); camel.visible = true; }
      lantern.intensity = A.quality === 'low' ? 0 : 1.2;
      fit(wBox, w.x, w.z, w.a, 1.3, 2.25); fit(cBox, c.x, c.z, camel.rotation.y, 0.55, 1.35);
      if (dead) { wBox.y1 = 1.6; cBox.y1 = -50; } else { wBox.y1 = 2.2; cBox.y1 = 2.6; }
      bar.position.set(w.x, 4.0, w.z); bar.visible = !dead;
      if (Math.round(hp) !== shownHp) { shownHp = Math.round(hp); drawBar(hp); }
    },
    /** The point on the wagon's side nearest p (at chest height): where a raider stands to hack at it. */
    near(p, m = 0, out = new THREE.Vector3()) { // (m: how far out from its side)
      const ca = Math.cos(C.ang), sa = Math.sin(C.ang), dx = p.x - C.pos.x, dz = p.z - C.pos.z, X = 1.3 + m, Z = 2.0;
      const lx = dx * ca - dz * sa, lz = dx * sa + dz * ca; // (into the wagon's frame: x across, z along)
      const qx = Math.sign(lx || 1) * X, qz = Math.max(-Z, Math.min(Z, lz)); // (always along a long side: never in front, where the camel is)
      return out.set(C.pos.x + qx * ca + qz * sa, 0.8, C.pos.z - qx * sa + qz * ca);
    },
    /** Does the blade segment a-b pass through the wagon or the camel? Returns the hit point, or null. */
    hitSeg(a, b) {
      for (const [o, ang, hw, hl, y0, y1] of [[wagon.position, C.ang, 1.35, 2.3, 0.4, 2.9], [camel.position, camel.rotation.y, 0.6, 1.5, 1.2, 3.3]]) {
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const L = (v) => { const dx = v.x - o.x, dz = v.z - o.z; return [dx * ca - dz * sa, v.y - o.y, dx * sa + dz * ca]; };
        const p = L(a), q = L(b); let t0 = 0, t1 = 1, ok = true;
        for (const [s0, s1, lo, hi] of [[p[0], q[0], -hw, hw], [p[1], q[1], y0, y1], [p[2], q[2], -hl, hl]]) {
          const d = s1 - s0; if (Math.abs(d) < 1e-9) { if (s0 < lo || s0 > hi) { ok = false; break; } continue; }
          let u = (lo - s0) / d, v = (hi - s0) / d; if (u > v) [u, v] = [v, u]; t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) { ok = false; break; }
        }
        if (ok) return new THREE.Vector3().lerpVectors(a, b, t0);
      }
      return null;
    },
  };
  C.update(0, ROUTE.hp, 0.016, false);
  return C;
}
export { roadX };
