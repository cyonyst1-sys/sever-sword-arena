// Topiary Grove: two rows of ancient, gnarled cloud-pruned trees facing each other across a dusty yard at sunset.
// Each twisted trunk throws out crooked limbs, and every limb ends in a round, flat-clipped pad of foliage you can
// stand on. The pads lean out toward the other row, so you swing back and forth across the gap between the rows.
import * as THREE from 'three';

const TAU = Math.PI * 2;

export function buildGrove(A, T) {
  const S = A.scene, r = T.rng(7171);
  A.plats = []; A.pillars = []; A.arcPts = []; A.killY = -30;
  A.setSky({ top: 0x7a5a8a, mid: 0xf0a26a, bot: 0xa0603a, fog: 0xe8a070, near: 70, far: 260, hemiSky: 0xffd8b0, hemiGround: 0x5a4030, hemi: 1.2, sunColor: 0xffb070, sun: 2.4, sunOff: new THREE.Vector3(-70, 22, -45) });

  // ---- textures: deeply furrowed old bark (twisting), packed dust, clipped foliage
  const bark = T.canvasTex((g, s) => {
    const q = T.rng(51); g.fillStyle = '#5c4a3c'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) { const x0 = q() * s, w = 3 + q() * 12, lean = (q() - 0.5) * s * 0.6; g.strokeStyle = `rgba(${q() < 0.5 ? '28,20,14' : '140,118,96'},${0.3 + q() * 0.4})`; g.lineWidth = w; g.beginPath(); g.moveTo(x0, 0); g.bezierCurveTo(x0 + lean * 0.3, s * 0.3, x0 + lean * 0.7, s * 0.7, x0 + lean, s); g.stroke(); } // twisting ridges
    for (let i = 0; i < 18; i++) { const x = q() * s, y = q() * s; g.fillStyle = 'rgba(20,14,10,0.6)'; g.beginPath(); g.ellipse(x, y, 5 + q() * 10, 9 + q() * 18, q(), 0, TAU); g.fill(); } // hollows and knots
    T.speckle(g, s, q, 5000, 0.2);
  }, 512);
  const barkM = new THREE.MeshStandardMaterial({ map: bark, bumpMap: bark, bumpScale: 3, roughness: 0.95, color: 0xf0e2d4 });
  const dust = T.canvasTex((g, s) => { const q = T.rng(53); g.fillStyle = '#b08a62'; g.fillRect(0, 0, s, s); for (let i = 0; i < 500; i++) { const v = 130 + q() * 70 | 0; g.fillStyle = `rgba(${v + 20},${v},${v - 30},0.35)`; g.beginPath(); g.arc(q() * s, q() * s, 1 + q() * 6, 0, TAU); g.fill(); } T.speckle(g, s, q, 4000, 0.15); }, 512);
  dust.repeat.set(30, 30);
  const leafTex = T.canvasTex((g, s) => { const q = T.rng(57); g.fillStyle = '#3d5a2a'; g.fillRect(0, 0, s, s); for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${q() < 0.5 ? '25,45,18' : '110,150,70'},${0.3 + q() * 0.5})`; g.beginPath(); g.ellipse(q() * s, q() * s, 1 + q() * 3, 0.8 + q() * 1.6, q() * 3, 0, TAU); g.fill(); } }, 256);
  const leafM = new THREE.MeshStandardMaterial({ map: leafTex, bumpMap: leafTex, bumpScale: 2, roughness: 0.9, color: 0xe8f8d0, emissive: 0x16240c });

  // ---- the yard: packed dust, potted shrubs along the edges, low walls of hedge round the outside
  const plats = A.plats;
  const ground = { kind: 'ground', x: 0, z: 0, y: 0, w: 150, d: 150, ang: 0, round: 75, i: plats.length, meshes: [], boxes: [], ramps: [], rays: [] }; plats.push(ground);
  { const m = new THREE.Mesh(new THREE.CircleGeometry(75, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: dust, bumpMap: dust, bumpScale: 1, roughness: 1 })); m.receiveShadow = true; S.add(m);
    const c = { x: 0, z: 0, r: 75, y0: -3, y1: 0 }; A.discs.push(c); ground.discs = [c]; A.node('P' + ground.i, 0, 0, 0).plat = ground.i;
    const hedge = new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.9, color: 0x8aa078 });
    for (let k = 0; k < 40; k++) { const a = k / 40 * TAU, x = Math.cos(a) * 72, z = Math.sin(a) * 72, m2 = new THREE.Mesh(new THREE.BoxGeometry(12, 3.2, 3), hedge); m2.position.set(x, 1.6, z); m2.rotation.y = -a + Math.PI / 2; m2.castShadow = true; S.add(m2); A.boxes.push({ x0: x - 6, x1: x + 6, y0: 0, y1: 3.2, z0: z - 6, z1: z + 6, noHook: true }); }
    const pot = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.7 }), bush = new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.9, color: 0x9ab888 });
    for (let k = 0; k < 26; k++) { const x = (k % 2 ? 1 : -1) * (30 + r() * 30), z = (r() - 0.5) * 120, s = 0.8 + r() * 0.8, p0 = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * s, 0.7 * s, 1.2 * s, 10), pot); p0.position.set(x, 0.6 * s, z); S.add(p0); const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3 * s, 1), bush); b.position.set(x, 1.2 * s + 1.1 * s, z); b.scale.y = 1.3; b.castShadow = true; S.add(b); }
  }

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

  // ---- the trees: two rows facing each other across the yard
  const ROW = 17, trees = [];
  for (const side of [-1, 1]) for (let k = 0; k < 7; k++) {
    const x = side * (ROW + (r() - 0.5) * 3), z = -54 + k * 18 + (r() - 0.5) * 5 + (side > 0 ? 9 : 0) * 0, H = 9 + r() * 6, R0 = 2.4 + r() * 1.1;
    // the trunk: thick and swollen at the base, twisting as it rises, flared roots
    const tg = new THREE.CylinderGeometry(R0 * 0.62, R0 * 1.35, H, 18, 10, false), tp = tg.attributes.position, ph = r() * TAU;
    for (let i = 0; i < tp.count; i++) { const y = tp.getY(i) / H + 0.5, a = Math.atan2(tp.getZ(i), tp.getX(i)), rr = Math.hypot(tp.getX(i), tp.getZ(i)), k2 = 1 + 0.16 * Math.sin(a * 3 + y * 5 + ph) + 0.08 * Math.sin(a * 7 - y * 9), tw = a + y * 0.9; tp.setX(i, Math.cos(tw) * rr * k2); tp.setZ(i, Math.sin(tw) * rr * k2); }
    tg.computeVertexNormals();
    const tm = new THREE.Mesh(tg, barkM); tm.position.set(x, H / 2, z); tm.castShadow = tm.receiveShadow = true; S.add(tm);
    for (let j = 0; j < 5; j++) { const a = j / 5 * TAU + r(), rt = new THREE.Mesh(new THREE.ConeGeometry(R0 * 0.55, 3.2, 8), barkM); rt.position.set(x + Math.cos(a) * R0 * 1.15, 0.9, z + Math.sin(a) * R0 * 1.15); rt.rotation.set(Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0); S.add(rt); } // roots
    const tc = { x, z, r: R0 * 1.1, y0: 0, y1: H }; A.discs.push(tc); A.rayBoxes.push({ x0: x - R0, x1: x + R0, y0: 0, y1: H, z0: z - R0, z1: z + R0 }); A.pillars.push({ x, z, w: R0 * 2 });
    // a crown pad on top of the trunk, and limbs out to more pads: most lean out over the yard toward the other row
    const top = new THREE.Vector3(x, H, z), tree = { x, z, pads: [] };
    tree.pads.push(addPad(x, z, H + 2.4, 3 + r() * 0.8)); limb(top, new THREE.Vector3(x, H + 1.8, z), R0 * 0.6, R0 * 0.45);
    const n = 3 + (r() * 3 | 0);
    for (let j = 0; j < n; j++) {
      const toward = j < n - 1 || r() < 0.5, a = toward ? (side > 0 ? Math.PI : 0) + (r() - 0.5) * 1.9 : (side > 0 ? 0 : Math.PI) + (r() - 0.5) * 1.4; // (most face the other row)
      const dist = 5 + r() * 6, py = 6 + r() * 20, R = 2.2 + r() * 1.4, px = x + Math.cos(a) * dist, pz = z + Math.sin(a) * dist;
      if (tree.pads.some((q) => Math.hypot(q.x - px, q.z - pz) < q.round + R + 0.5 && Math.abs(q.y - py) < 4)) continue;
      const from = new THREE.Vector3(x, Math.min(H - 1, Math.max(3, py - 4 - r() * 3)), z), to = new THREE.Vector3(px, py - 0.8, pz);
      limb(from, to, R0 * 0.42, 0.45); tree.pads.push(addPad(px, pz, py, R));
    }
    trees.push(tree);
  }
  // spawns on the ground near each row, too
  for (let k = 0; k < 8; k++) { const sp = new THREE.Vector3((k % 2 ? 1 : -1) * 8, 0.05, -48 + k * 13); sp.plat = ground.i; A.spawns.push(sp); }

  // ---- the backdrop: more of these trees fading into the haze, and the sun low in the orange sky
  { const far = new THREE.MeshStandardMaterial({ color: 0x4a3a34, roughness: 1 }), farLeaf = new THREE.MeshStandardMaterial({ color: 0x5a6a4a, roughness: 1, flatShading: true });
    for (let k = 0; k < 40; k++) { const a = r() * TAU, d = 95 + r() * 90, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 14 + r() * 14;
      const t0 = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.6, h, 8), far); t0.position.set(x, h / 2, z); S.add(t0);
      for (let j = 0; j < 4; j++) { const pd = new THREE.Mesh(new THREE.SphereGeometry(3 + r() * 2, 10, 6), farLeaf); pd.scale.y = 0.4; pd.position.set(x + (r() - 0.5) * 9, h * (0.6 + r() * 0.5), z + (r() - 0.5) * 9); S.add(pd); } } }

  A.finishNav();
}
