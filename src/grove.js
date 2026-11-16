// Topiary Grove: two rows of ancient, gnarled cloud-pruned trees facing each other across a misty gulf at sunset (no floor).
// Each twisted trunk throws out crooked limbs, and every limb ends in a round, flat-clipped pad of foliage you can
// stand on. The pads lean out toward the other row, so you swing back and forth across the gap between the rows.
import * as THREE from 'three';

const TAU = Math.PI * 2;

export function buildGrove(A, T) {
  const S = A.scene, r = T.rng(7171);
  A.plats = []; A.pillars = []; A.arcPts = []; A.killY = -22;
  A.setSky({ top: 0x7a5a8a, mid: 0xf0a26a, bot: 0xa0603a, fog: 0xe8a070, near: 70, far: 260, hemiSky: 0xffd8b0, hemiGround: 0x5a4030, hemi: 1.2, sunColor: 0xffb070, sun: 2.4, sunOff: new THREE.Vector3(-70, 22, -45) });

  // ---- textures: deeply furrowed old bark (twisting), packed dust, clipped foliage
  const bark = T.canvasTex((g, s) => {
    const q = T.rng(51); g.fillStyle = '#5c4a3c'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) { const x0 = q() * s, w = 3 + q() * 12, lean = (q() - 0.5) * s * 0.6; g.strokeStyle = `rgba(${q() < 0.5 ? '28,20,14' : '140,118,96'},${0.3 + q() * 0.4})`; g.lineWidth = w; g.beginPath(); g.moveTo(x0, 0); g.bezierCurveTo(x0 + lean * 0.3, s * 0.3, x0 + lean * 0.7, s * 0.7, x0 + lean, s); g.stroke(); } // twisting ridges
    for (let i = 0; i < 18; i++) { const x = q() * s, y = q() * s; g.fillStyle = 'rgba(20,14,10,0.6)'; g.beginPath(); g.ellipse(x, y, 5 + q() * 10, 9 + q() * 18, q(), 0, TAU); g.fill(); } // hollows and knots
    T.speckle(g, s, q, 5000, 0.2);
  }, 512);
  const barkM = new THREE.MeshStandardMaterial({ map: bark, bumpMap: bark, bumpScale: 3, roughness: 0.95, color: 0xf0e2d4 });
  const leafTex = T.canvasTex((g, s) => { const q = T.rng(57); g.fillStyle = '#3d5a2a'; g.fillRect(0, 0, s, s); for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${q() < 0.5 ? '25,45,18' : '110,150,70'},${0.3 + q() * 0.5})`; g.beginPath(); g.ellipse(q() * s, q() * s, 1 + q() * 3, 0.8 + q() * 1.6, q() * 3, 0, TAU); g.fill(); } }, 256);
  const leafM = new THREE.MeshStandardMaterial({ map: leafTex, bumpMap: leafTex, bumpScale: 2, roughness: 0.9, color: 0xe8f8d0, emissive: 0x16240c });

  // ---- no floor: the trees rise out of a sea of warm mist far below (fall into it and you're gone)
  const plats = A.plats;
  { const mist = new THREE.Mesh(new THREE.CircleGeometry(400, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf0b88a, transparent: true, opacity: 0.94 })); mist.position.y = -24; S.add(mist); }

  // ---- a foliage pad: round, flat-topped like a clipped cloud of leaves, with a lumpy rim and underside
  const padGeo = (R) => { const g = new THREE.SphereGeometry(1, 28, 14), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), lump = 1 + 0.07 * Math.sin(a * 7 + r() * 0.3) + 0.05 * Math.sin(a * 13);
      p.setXYZ(i, x * R * lump, y > 0.25 ? 0.25 * 1.2 + (y - 0.25) * 0.18 : y * 1.2, z * R * lump); } // (flattened on top: the clipped walking surface)
    g.computeVertexNormals(); return g; };
  const addPad = (x, z, y, R) => {
    const p = { kind: 'pad', x, z, y, w: 2 * R, d: 2 * R, ang: 0, round: R, i: plats.length, meshes: [], boxes: [], ramps: [], rays: [] }; plats.push(p);
    const m = new THREE.Mesh(padGeo(R), leafM); m.position.set(x, y - 0.42, z); m.castShadow = m.receiveShadow = true; S.add(m); p.meshes.push(m);
    const c = { x, z, r: R * 0.97, y0: y - 1.3, y1: y }; A.discs.push(c); p.discs = [c];
    const k = R * 0.85, box = { x0: x - k, x1: x + k, y0: y - 1.3, y1: y, z0: z - k, z1: z + k }; A.rayBoxes.push(box); p.rays.push(box);
    A.node('P' + p.i, x, y, z).plat = p.i;
    const sp = new THREE.Vector3(x, y + 0.05, z); sp.plat = p.i; A.spawns.push(sp);
    return p;
  };
  // ---- a limb: a crooked, tapering branch from a to b, hookable along its length
  const limb = (a, b, r0, r1) => {
    const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3((r() - 0.5) * 2, (r() - 0.2) * 2, (r() - 0.5) * 2)); // (a crook in the middle)
    for (const [p0, p1, ra, rb] of [[a, mid, r0, (r0 + r1) / 2], [mid, b, (r0 + r1) / 2, r1]]) {
      const d = p1.clone().sub(p0), L = d.length(), m = new THREE.Mesh(new THREE.CylinderGeometry(rb, ra, L, 10, 3), barkM);
      m.position.copy(p0).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.castShadow = true; S.add(m);
      for (let s = 0.15; s < 1; s += 0.3) { const q = p0.clone().lerp(p1, s), w = ra * 0.8; A.rayBoxes.push({ x0: q.x - w, x1: q.x + w, y0: q.y - w, y1: q.y + w, z0: q.z - w, z1: q.z + w }); }
    }
  };

  // ---- the trees: two rows, close together, facing each other across the gap. Big, ancient and gnarled: each has a
  // broad crown pad on top, a big pad low down (the floor of the fight), and more pads all round on its crooked limbs
  const ROW = 15, BASE = -40, trees = [], all = [];
  const free = (px, pz, py, R) => all.every((q) => Math.hypot(q.x - px, q.z - pz) > q.round + R + 0.8 || Math.abs(q.y - py) > 5);
  const pad = (px, pz, py, R) => { const p = addPad(px, pz, py, R); all.push(p); return p; };
  for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
    const x = side * (ROW + (k === 1 || k === 2 ? 4 : 0) + (r() - 0.5) * 2), z = -39 + k * 26 + (k === 1 ? -5 : k === 2 ? 5 : 0) + (side > 0 ? 13 : 0) + (r() - 0.5) * 3, top = 15 + r() * 8, H = top - BASE, R0 = 1.5 + r() * 0.6; // (slimmer trunks)
    // the trunk: thick and swollen, twisting as it rises out of the mist
    const tg = new THREE.CylinderGeometry(R0 * 0.62, R0 * 1.3, H, 20, 14, false), tp = tg.attributes.position, ph = r() * TAU;
    for (let i = 0; i < tp.count; i++) { const y = tp.getY(i) / H + 0.5, a = Math.atan2(tp.getZ(i), tp.getX(i)), rr = Math.hypot(tp.getX(i), tp.getZ(i)), k2 = 1 + 0.16 * Math.sin(a * 3 + y * 7 + ph) + 0.08 * Math.sin(a * 7 - y * 12), tw = a + y * 1.4; tp.setX(i, Math.cos(tw) * rr * k2); tp.setZ(i, Math.sin(tw) * rr * k2); }
    tg.computeVertexNormals();
    const tm = new THREE.Mesh(tg, barkM); tm.position.set(x, BASE + H / 2, z); tm.castShadow = tm.receiveShadow = true; S.add(tm);
    const tc = { x, z, r: R0 * 1.05, y0: BASE, y1: top }; A.discs.push(tc); A.rayBoxes.push({ x0: x - R0, x1: x + R0, y0: BASE, y1: top, z0: z - R0, z1: z + R0 }); A.pillars.push({ x, z, w: R0 * 2 });
    const tree = { x, z, pads: [] };
    // the crown pad on top of the trunk
    tree.pads.push(pad(x, z, top + 2.6, 4.6 + r() * 1.2)); limb(new THREE.Vector3(x, top, z), new THREE.Vector3(x, top + 2, z), R0 * 0.62, R0 * 0.5);
    // big low pads (the floor of the fight): first try toward the other row, then any way round the trunk
    for (let t = 0, made = 0; t < 14 && made < 2; t++) {
      const a = t < 3 ? (side > 0 ? Math.PI : 0) + (r() - 0.5) * 0.9 : r() * TAU, R = 5.2 + r() * 2, dist = R0 + R * 0.75 + r() * 1.5, py = -2 + r() * 6, px = x + Math.cos(a) * dist, pz = z + Math.sin(a) * dist;
      if (!free(px, pz, py, R)) continue;
      limb(new THREE.Vector3(x, py - 3, z), new THREE.Vector3(px, py - 1, pz), R0 * 0.55, 1.2); tree.pads.push(pad(px, pz, py, R)); made++;
    }
    // pads all round on crooked limbs: most toward the other row, some out the back and sides
    for (let j = 0, n = 4 + (r() * 3 | 0), tries = 0; j < n && tries < 30; tries++) {
      const toward = r() < 0.6, a = toward ? (side > 0 ? Math.PI : 0) + (r() - 0.5) * 2.2 : r() * TAU;
      const dist = R0 + 3 + r() * 6, py = 5 + r() * 24, R = 3.8 + r() * 1.8, px = x + Math.cos(a) * dist, pz = z + Math.sin(a) * dist;
      if (!free(px, pz, py, R)) continue;
      const from = new THREE.Vector3(x, Math.min(top - 1, Math.max(-6, py - 5 - r() * 3)), z), to = new THREE.Vector3(px, py - 1, pz);
      limb(from, to, R0 * 0.42, 0.6); tree.pads.push(pad(px, pz, py, R)); j++;
    }
    trees.push(tree);
  }

  // ---- the backdrop: more of these trees fading into the haze, and the sun low in the orange sky
  { const far = new THREE.MeshStandardMaterial({ color: 0x4a3a34, roughness: 1 }), farLeaf = new THREE.MeshStandardMaterial({ color: 0x5a6a4a, roughness: 1, flatShading: true });
    for (let k = 0; k < 40; k++) { const a = r() * TAU, d = 95 + r() * 90, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 14 + r() * 14;
      const t0 = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.6, h, 8), far); t0.scale.y = 1 + 40 / h; t0.position.set(x, (h - 40) / 2, z); S.add(t0); // (rising out of the mist)
      for (let j = 0; j < 4; j++) { const pd = new THREE.Mesh(new THREE.SphereGeometry(3 + r() * 2, 10, 6), farLeaf); pd.scale.y = 0.4; pd.position.set(x + (r() - 0.5) * 9, h * (0.6 + r() * 0.5), z + (r() - 0.5) * 9); S.add(pd); } } }

  // ---- and more of them filling the open mist all round the two rows (scenery: a wood standing in the haze). Two instanced meshes.
  { const N = A.quality === 'low' ? 40 : 90, PN = 4, far = new THREE.MeshStandardMaterial({ color: 0x4a3a34, roughness: 1 }), farLeaf = new THREE.MeshStandardMaterial({ color: 0x5a6a4a, roughness: 1, flatShading: true });
    const tr = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 1, 1, 8).translate(0, 0.5, 0), far, N), pd = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), farLeaf, N * PN), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    let n = 0; const got = [];
    for (let t = 0; t < 4000 && n < N; t++) { const a = r() * TAU, d = 34 + r() * 66, x = Math.cos(a) * d, z = Math.sin(a) * d + 8;
      if ((Math.abs(x) < 36 && Math.abs(z - 8) < 74) || got.some(([u, v]) => Math.hypot(u - x, v - z) < 11)) continue; // (clear of the fighting, and of each other)
      got.push([x, z]); const h = 12 + r() * 20, w = 1.6 + r() * 1.4;
      mt.compose(ps.set(x, -40, z), q, sc.set(w, h + 40, w)); tr.setMatrixAt(n, mt);
      for (let j = 0; j < PN; j++) { const R = 3 + r() * 2.6; mt.compose(ps.set(x + (j ? (r() - 0.5) * 11 : 0), j ? h * (0.5 + r() * 0.45) : h + 0.6, z + (j ? (r() - 0.5) * 11 : 0)), q, sc.set(R, R * 0.4, R)); pd.setMatrixAt(n * PN + j, mt); }
      n++; }
    tr.count = n; pd.count = n * PN; S.add(tr, pd); }

  A.finishNav();
}
