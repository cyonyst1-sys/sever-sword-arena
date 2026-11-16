// Branch Run: racing through a giant forest. Whole Great Canopy trees come at you one after another, wide apart, their
// limbs and big leaves reaching across the lane. Land on a limb, stop and fight whoever's there, then jump, dash or swing
// on to the next tree before yours carries you back past and sinks into the mist. Everything moves by the wall clock,
// so every player sees the same trees in the same places.
import * as THREE from 'three';

const TAU = Math.PI * 2, N = 8, C = 56, V = 8, LANE = 10; // pooled trees, one tree every C m (wide apart), coming at V m/s, lane half-width
export const RUN = { speed: V };
const hash = (k, s = 0) => { const x = Math.sin(k * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

export function buildRun(A, T) {
  const S = A.scene, r = T.rng(5150);
  A.plats = []; A.pillars = []; A.arcPts = []; A.killY = -30; A.runMode = true;
  A.setSky({ top: 0x2e5a3a, mid: 0x8fb08a, bot: 0x2a3a2a, fog: 0x8fb08a, near: 45, far: 185, hemiSky: 0xf0fae0, hemiGround: 0x4a5a3a, hemi: 1.6, sunColor: 0xfff0d0, sun: 2.6, sunOff: new THREE.Vector3(20, 60, -30) });

  // ---- bark, moss and leaves
  const bark = T.canvasTex((g, s) => {
    const q = T.rng(41); g.fillStyle = '#4a3420'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) { const x = q() * s, w = 3 + q() * 9; g.fillStyle = `rgba(${q() < 0.5 ? '20,12,6' : '110,82,52'},${0.25 + q() * 0.35})`; g.fillRect(x, 0, w, s); } // deep furrows running along the wood
    for (let i = 0; i < 26; i++) { const x = q() * s, y = q() * s; g.strokeStyle = 'rgba(15,9,4,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, 4 + q() * 7, 9 + q() * 14, 0, 0, TAU); g.stroke(); } // knots
    for (let i = 0; i < 40; i++) { const gr = g.createRadialGradient(q() * s, q() * s, 0, q() * s, q() * s, 6 + q() * 16); gr.addColorStop(0, 'rgba(90,130,50,0.5)'); gr.addColorStop(1, 'rgba(90,130,50,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); } // moss
    T.speckle(g, s, q, 4000, 0.18);
  }, 512);
  const barkM = new THREE.MeshStandardMaterial({ map: bark, bumpMap: bark, bumpScale: 2, roughness: 0.95 });
  const topM = new THREE.MeshStandardMaterial({ map: bark, bumpMap: bark, bumpScale: 1.5, roughness: 0.9, color: 0xc8b89a }); // (the worn, walked-on top of a branch)
  const leafM = new THREE.MeshStandardMaterial({ color: 0x3f7a34, roughness: 0.8, flatShading: true });
  const leafM2 = new THREE.MeshStandardMaterial({ color: 0x5a9a3a, roughness: 0.8, flatShading: true });

  // ---- the backdrop: rows of giant trunks receding into the fog on both sides, a canopy overhead, mist below
  { const g = new THREE.CylinderGeometry(1, 1.15, 1, 14, 1, true);
    for (let i = 0; i < 70; i++) {
      const side = i % 2 ? 1 : -1, x = side * (26 + r() * 90), z = 60 - r() * 300, R = 3 + r() * 6;
      const m = new THREE.Mesh(g, barkM); m.position.set(x, 40, z); m.scale.set(R, 200, R); S.add(m);
    }
    const canopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), leafM, 160), mm = new THREE.Matrix4();
    for (let i = 0; i < 160; i++) { mm.compose(new THREE.Vector3((r() - 0.5) * 260, 55 + r() * 30, 60 - r() * 320), new THREE.Quaternion(), new THREE.Vector3(14 + r() * 16, 8 + r() * 8, 14 + r() * 16)); canopy.setMatrixAt(i, mm); }
    S.add(canopy);
    const mist = new THREE.Mesh(new THREE.PlaneGeometry(700, 700).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xc8d8c0, transparent: true, opacity: 0.9 })); mist.position.y = -26; S.add(mist);
  }

  // ---- the trees: a pool of N, each a whole Great Canopy tree (a huge trunk beside the lane with its limbs: oval bark
  // logs climbing and dipping segment by segment, with knots at the joints, side arms and big curled leaves you can run
  // across), built once in its own space and then carried toward you, the next tree due taking the place of one gone by
  const leafM3 = new THREE.MeshStandardMaterial({ color: 0x4f8f3a, roughness: 0.7, side: THREE.DoubleSide }), veinM = new THREE.MeshStandardMaterial({ color: 0x9ccf74, roughness: 0.7 });
  const trees = [], allPlats = [];
  const mkTree = (slot) => {
    const q = T.rng(900 + slot * 37), side = slot % 2 ? 1 : -1, tree = { slot, side, group: new THREE.Group(), plats: [], ramps: [], rays: [], ends: [], k: null, oz: 0, oy: 0 };
    S.add(tree.group);
    const tx = side * (LANE + 4), tR = 3.4 + q() * 1.6;
    { const g = new THREE.CylinderGeometry(tR * 0.85, tR * 1.2, 160, 18, 8), gp = g.attributes.position; for (let i = 0; i < gp.count; i++) { const s = 1 + (q() - 0.5) * 0.12; gp.setX(i, gp.getX(i) * s); gp.setZ(i, gp.getZ(i) * s); }
      const m = new THREE.Mesh(g, barkM); m.position.set(tx, 20, 0); m.castShadow = true; tree.group.add(m);
      tree.tbox = { lx0: tx - tR * 0.8, lx1: tx + tR * 0.8, lz0: -tR * 0.8, lz1: tR * 0.8, x0: 0, x1: 0, y0: -60, y1: 80, z0: 0, z1: 0 }; A.rayBoxes.push(tree.tbox); }
    const addPlat = (p) => { p.i = A.plats.length; p.meshes = []; p.boxes = []; p.ramps = []; p.rays = []; p.tree = tree; A.plats.push(p); tree.plats.push(p); allPlats.push(p);
      p.l = { x: p.x, z: p.z, y: p.y, ya: p.ya, yb: p.yb }; p.node = A.node('P' + p.i, p.x, p.y, p.z); p.node.plat = p.i; p.sp = new THREE.Vector3(); p.sp.plat = p.i; A.spawns.push(p.sp); return p; };
    const ramp = (p, lx, lz, hx, hz, hL, hH, w, base, o = {}) => { const r0 = A.addRamp(lx, lz, hx, hz, hL, hH, w, base, null, { visual: false, noWall: true, ...o }); r0.l = { lz: r0.lz, z0: r0.z0, z1: r0.z1, hL, hH, base }; p.ramps.push(r0); tree.ramps.push(r0); return r0; };
    const ray = (p, b) => { b.l = { y0: b.y0, y1: b.y1, z0: b.z0, z1: b.z1 }; A.rayBoxes.push(b); tree.rays.push(b); p.rays.push(b); };
    // one segment of a limb, A to B (Great Canopy's branch): the walkable top, the oval log, a knot at its end, hook boxes
    // keep it tidy: a new branch mustn't pass close to one already there (bar the one it grows from), nor a leaf sit on one
    const segs = [], lerp3 = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
    const segGap = (a, b, c, d) => { let m = Infinity; for (let i = 0; i <= 8; i++) { const p = lerp3(a, b, i / 8); for (let j = 0; j <= 8; j++) { const q2 = lerp3(c, d, j / 8); m = Math.min(m, Math.hypot(p.x - q2.x, (p.y - q2.y) * 1.6, p.z - q2.z)); } } return m; };
    const near = (p, q2) => Math.hypot(p.x - q2.x, p.y - q2.y, p.z - q2.z) < 0.01;
    const clear = (a, b, w) => segs.every((s) => near(s.b, a) || near(s.a, a) || segGap(lerp3(a, b, 0.15), b, s.a, s.b) > (w + s.w) / 2 + 1.6); // (the branch it grows from doesn't count)
    const branch = (a, b, wA, wB) => {
      const width = (wA + wB) / 2, dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
      const p = addPlat({ kind: 'branch', x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, y: (a.y + b.y) / 2, ya: a.y, yb: b.y, w: L, d: width, ang });
      tree.ends.push({ x: b.x, y: b.y, z: b.z, w: wB });
      segs.push({ a: { x: a.x, y: a.y, z: a.z }, b: { x: b.x, y: b.y, z: b.z }, w: width });
      ramp(p, a.x, a.z, b.x, b.z, a.y, b.y, width, Math.min(a.y, b.y) - 1.2);
      const OV = 1.8, R = width * 0.39, Ra = wA * 0.39, Rb = wB * 0.39, k = Math.hypot(L, b.y - a.y) / L;
      const a3 = new THREE.Vector3(a.x, a.y - Ra * (k - 0.15), a.z), b3 = new THREE.Vector3(b.x, b.y - Rb * (k - 0.15), b.z), dir = b3.clone().sub(a3), len = dir.length(); dir.normalize();
      const log = new THREE.Mesh(new THREE.CylinderGeometry(Rb, Ra, len + R * 0.15, 12, 1), barkM); log.geometry.scale(OV, 1, 1);
      const sx = new THREE.Vector3(-dir.z, 0, dir.x).normalize(), sz = new THREE.Vector3().crossVectors(sx, dir), qb = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(sx, dir, sz));
      log.position.copy(a3).add(b3).multiplyScalar(0.5); log.quaternion.copy(qb); log.castShadow = log.receiveShadow = true; tree.group.add(log);
      const knot = new THREE.Mesh(new THREE.SphereGeometry(Rb * 1.02, 12, 8), barkM); knot.scale.set(OV, 1, 1); knot.quaternion.copy(qb); knot.position.copy(b3); knot.castShadow = true; tree.group.add(knot);
      for (let s = 0; s <= len; s += 5) { const c = a3.clone().addScaledVector(dir, s); ray(p, { x0: c.x - R * 0.7, x1: c.x + R * 0.7, y0: c.y - R * 0.7, y1: c.y + R * 0.9, z0: c.z - R * 0.7, z1: c.z + R * 0.7 }); }
      return p;
    };
    // a big leaf (Great Canopy's): a curled walkable blade with a midrib, on a stalk from the branch
    const leaf = (Cc, len, wid, ang, y) => {
      if (segs.some((s) => segGap({ x: Cc.x, y, z: Cc.z }, { x: Cc.x + 0.01, y, z: Cc.z }, s.a, s.b) < len * 0.3 + s.w / 2)) return null; // (not on top of a branch)
      const p = addPlat({ kind: 'leaf', x: Cc.x, z: Cc.z, y, w: len, d: wid, ang }), ux = Math.cos(ang), uz = Math.sin(ang);
      const F = Math.min(0.9, wid * 0.12), kf = F / Math.pow(wid * 0.75, 2), kv = 0.07;
      ramp(p, Cc.x - ux * len * 0.42, Cc.z - uz * len * 0.42, Cc.x + ux * len * 0.42, Cc.z + uz * len * 0.42, y, y, wid * 0.78, y - 0.6, { foldK: kf, foldV: kv });
      const NU = 24, NV = 10, pos = [], idx = [];
      for (let sd = 0; sd < 2; sd++) for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
        const u = i / NU * 2 - 1, v = j / NV * 2 - 1, x = u * len / 2, hw = wid * 0.62 * Math.pow(Math.sin(Math.PI * (u + 1) / 2), 0.75) * (1 - 0.18 * u), z = v * hw;
        const tip = Math.pow(Math.max(0, u), 2); pos.push(x, -tip * 0.6 + (kf * z * z + kv * Math.abs(z)) * (1 - tip * 0.5) - sd * 0.18 * (1 - Math.abs(v) * 0.8), z);
      }
      const row = NV + 1, off = (NU + 1) * row;
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * row + j, b = a + row; idx.push(a, a + 1, b, a + 1, b + 1, b, off + a, off + b, off + a + 1, off + a + 1, off + b, off + b + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, leafM3); m.rotation.y = -ang; m.position.set(Cc.x, y + 0.06, Cc.z); m.castShadow = m.receiveShadow = true; tree.group.add(m);
      const rib = new THREE.Mesh(new THREE.BoxGeometry(len * 0.92, 0.08, 0.2), veinM); rib.rotation.y = -ang; rib.position.set(Cc.x, y + 0.1, Cc.z); tree.group.add(rib);
      ray(p, { x0: Cc.x - 2, x1: Cc.x + 2, y0: y - 0.6, y1: y + 0.15, z0: Cc.z - 2, z1: Cc.z + 2 });
      return p;
    };
    // limbs (Great Canopy's grow): level, climbing or dipping a stretch at a time, side arms now and then, leaves
    const inLane = (P) => Math.abs(P.x) < LANE + 7 && Math.abs(P.z) < 24; // (one long limb can wander right across the lane, and its arms forward and back)
    const grow = (start, angle, segs, depth) => {
      let a = angle, A0 = start, mode = 'level';
      for (let s = 0; s < segs; s++) {
        if (s % 2 === 0) { const rr = q(); mode = rr < 0.3 ? 'level' : rr < 0.65 ? 'up' : 'down'; } // (rising and dipping as it goes)
        let dy = mode === 'level' ? 0 : (mode === 'up' ? 1 : -1) * (1.5 + q() * 2.5);
        const L = 8 + q() * 4; a += (q() - 0.5) * 0.4;
        let B0 = null; for (const turn of [0, 0.7, -0.7, 1.3, -1.3]) { const aa = a + turn, c = { x: A0.x + Math.cos(aa) * L, y: A0.y + dy, z: A0.z + Math.sin(aa) * L }; if (inLane(c)) { a = aa; B0 = c; break; } } // (it bends away from the edges instead of stopping)
        if (!B0) break;
        const wA = Math.max(2.4, (depth ? 3.0 : 3.8) * (1 - s / segs * 0.4)), wB = Math.max(2.2, (depth ? 3.0 : 3.8) * (1 - (s + 1) / segs * 0.4));
        if (!clear(A0, B0, (wA + wB) / 2)) break; // (no tangles)
        branch(A0, B0, wA, wB);
        if (q() < 0.3) { const sdd = q() < 0.5 ? 1 : -1, la = a + sdd * (1.1 + q() * 0.5), len = 10 + q() * 4, wid = 6.5 + q() * 2.5, Cc = { x: B0.x + Math.cos(la) * (wB / 2 + len * 0.45), z: B0.z + Math.sin(la) * (wB / 2 + len * 0.45) }; if (inLane(Cc)) leaf(Cc, len, wid, la, B0.y + 0.25); }
        if (depth < 2 && s >= 1 && q() < (depth ? 0.3 : 0.6)) grow(B0, a + (q() < 0.5 ? 1 : -1) * (0.7 + q() * 0.6), depth ? 2 : 2 + (q() * 2 | 0), depth + 1); // (branching arms off the limb, and arms off those)
        A0 = B0;
      }
      if (q() < 0.6) { const len = 12 + q() * 3, wid = 7 + q() * 2, Cc = { x: A0.x + Math.cos(a) * len * 0.48, z: A0.z + Math.sin(a) * len * 0.48 }; if (inLane(Cc)) leaf(Cc, len, wid, a, A0.y + 0.3); }
    };
    const toLane = side > 0 ? Math.PI : 0, ys = [0, 4.5, 9, 13.5];
    { const a = toLane + (q() - 0.5) * 0.5; grow({ x: tx + Math.cos(a) * tR * 0.7, y: 4 + q() * 4, z: Math.sin(a) * tR * 0.7 }, a, 5 + (q() * 2 | 0), 0); } // (one long limb, pointing in across the lane)
    // launch spurs: an arm reaching well forward toward the next tree coming, kicking up at its end like a ramp, to run
    // up and dash off; and a catch arm reaching back toward the tree behind, for those dashing in to land on
    const inRun = (P, z0, z1) => Math.abs(P.x) < LANE + 5 && P.z > z0 && P.z < z1;
    const arm = (dir, z0, z1, mode) => { const lipUp = mode === 'lip'; for (let tries = 0; tries < 14; tries++) {
      const st = tree.ends.filter((e) => (mode === 'path' ? Math.abs(e.z) < 12 : dir < 0 ? e.z < 4 && e.y > 7 && e.y < 16 : e.z > -4 && e.y > 2 && e.y < 10)).sort(() => q() - 0.5)[0]; if (!st) return null; // (catch arms low, launch spurs high: you drop onto the next tree)
      const a = dir * Math.PI / 2 + (q() - 0.5) * 0.5, pts = [st]; let P = st;
      for (let s = 0, nseg = mode === 'path' ? 4 : 3; s < nseg; s++) { const L = 7 + q() * 2.5, last = s === nseg - 1, n = { x: P.x + Math.cos(a) * L, y: P.y + (lipUp ? (last ? 2.4 + q() * 1.2 : (q() - 0.5) * 1.2) : mode === 'path' ? (q() - 0.5) * 2.2 : 0.9 + q() * 0.7), z: P.z + Math.sin(a) * L }; if (!inRun(n, z0, z1) || !clear(P, n, 2.8)) break; pts.push(n); P = n; } // (a catch arm rises gently out toward you: landing on it, you run downhill)
      if (pts.length < 3) continue;
      let p = null; for (let s = 1; s < pts.length; s++) p = branch(pts[s - 1], pts[s], s === 1 ? Math.max(2.6, st.w) : 2.8, s === pts.length - 1 ? 2.3 : 2.8);
      if (lipUp) p.launch = true; else if (q() < 0.6) { const end = pts[pts.length - 1], len = 11 + q() * 3; leaf({ x: end.x + Math.cos(a) * len * 0.45, z: end.z + Math.sin(a) * len * 0.45 }, len, 7 + q() * 2, a, end.y + 0.3); }
      return p; } return null; };
    if (q() < 0.85) arm(-1, -36, 6, 'lip'); // forward: a launch spur, its lip about 30 m ahead of the trunk
    arm(1, -6, 22, 'catch'); // back: a catch arm, its end about 18 m behind the trunk
    for (let n = 0, want = 1 + (q() * 2 | 0); n < want; n++) arm(n % 2 ? 1 : -1, -34, 24, 'path'); // paths: long, rolling arms running along the way you travel, to run down
    return tree;
  };
  for (let i = 0; i < N; i++) trees.push(mkTree(i));
  for (const t of trees) for (let i = 0; i < t.plats.length; i++) for (let j = i + 1; j < t.plats.length; j++) A.link('P' + t.plats[i].i, 'P' + t.plats[j].i, 'swing');
  for (let i = 0; i < N; i++) { const a = trees[i], b = trees[(i + 1) % N]; for (const p of a.plats) for (const q2 of b.plats) A.link('P' + p.i, 'P' + q2.i, 'swing'); }

  // ---- move tree slot t to show tree k: everything in it shifts along z (and sinks once it's gone by)
  const placeTree = (t, k, Zz) => {
    t.k = k; const z = -k * C + Zz + (hash(k, 6) - 0.5) * 6, drop = z > 22 ? (z - 22) * (z - 22) * 0.03 : 0;
    t.prev = { z: t.oz, y: t.oy }; t.oz = z; t.oy = -drop; t.group.position.set(0, -drop, z);
    for (const r0 of t.ramps) { r0.lz = r0.l.lz + z; r0.z0 = r0.l.z0 + z; r0.z1 = r0.l.z1 + z; r0.hL = r0.l.hL - drop; r0.hH = r0.l.hH - drop; r0.base = r0.l.base - drop; }
    for (const b of t.rays) { b.z0 = b.l.z0 + z; b.z1 = b.l.z1 + z; b.y0 = b.l.y0 - drop; b.y1 = b.l.y1 - drop; }
    const tb = t.tbox; tb.x0 = tb.lx0; tb.x1 = tb.lx1; tb.z0 = tb.lz0 + z; tb.z1 = tb.lz1 + z;
    for (const p of t.plats) { p.x = p.l.x; p.z = p.l.z + z; p.y = p.l.y - drop; if (p.l.ya !== undefined) { p.ya = p.l.ya - drop; p.yb = p.l.yb - drop; } p.node.p.set(p.x, p.y, p.z); p.sp.set(p.x, p.y + 0.1, p.z); }
  };
  const clock = () => (Date.now() / 1000) % 20000;
  let Z = clock() * V;
  const kAt = (Zz) => Math.floor((Zz - 60) / C); // the oldest tree still in play
  const assign = (Zz) => { const k0 = kAt(Zz); for (const t of trees) { const k = k0 + ((((t.slot - k0) % N) + N) % N); placeTree(t, k, Zz); } };
  assign(Z);

  // ---- each frame: move the trees, carry whoever stands on one along with it
  const standing = (f, t) => f.alive && Math.abs(f.pos.z - t.oz) < 34 && (f.onGround || (f.runTree === t && f.vel.y <= 1.5)) && t.ramps.some((r0) => { const h = A.rampWalk(r0, f.pos.x, f.pos.z); return h !== null && Math.abs(f.pos.y - h) < (f.onGround ? 0.6 : 1.0); }); // (a moment off the ground on a bumpy limb still counts)
  A.tickTilt = (fighters, mine, dt) => {
    dt = Math.min(0.05, dt || 0);
    const riders = [];
    for (const f of fighters) if (mine(f)) for (const t of trees) if (standing(f, t)) { riders.push([f, t, t.k, t.oz, t.oy]); break; }
    Z = clock() * V; assign(Z);
    for (const [f, t, k, z, y] of riders) if (t.k === k) { f.pos.z += t.oz - z; f.pos.y += t.oy - y; f.runOn = true; f.runTree = t; } // (ride along)
    for (const f of fighters) if (mine(f) && f.runOn && !f.onGround && !riders.some((rr) => rr[0] === f)) { if (f.vel.y > 2) f.vel.z += V; f.runOn = false; f.runTree = null; } // (jump off: keep the tree's speed; just stepping off adds nothing)
    for (const f of fighters) if (mine(f) && f.isBot && f.alive && !f.runOn && f.pos.z < -50) f.pos.z += Math.min(6, (-50 - f.pos.z) * 0.3) * dt; // (bots that run on too far ahead get eased back so the fight stays together; never a player, never anyone standing on a tree)
  };
  A.fallText = () => 'fell into the forest'; A.fallBy = () => 'Fell into the forest';
  A.killAt = (q) => (q.z > 50 ? 1e9 : A.killY); // (left behind: the forest swallows you)
  /** The surface ahead of q worth heading for next (for the bots): a branch or leaf of the tree coming. */
  A.nextBranch = (q) => { let best = null, bs = Infinity; for (const p of allPlats) { if (p.z > q.z - 3 || p.z < q.z - 32 || (p.z < -45 && q.z > -45)) continue; const sc = (q.z - p.z) * 0.6 + Math.abs(p.x - q.x) + Math.abs(p.y - q.y) * 2; if (sc < bs) { bs = sc; best = p; } } return best; };
  A.finishNav();
}
