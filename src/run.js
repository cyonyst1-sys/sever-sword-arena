// Branch Run: racing forward through a giant forest. Huge trunks stand on both sides of a lane, and their branches
// stream toward you; you're always running forward, land on a branch, fight whoever's on it for a moment, and leap
// (or grapple) on to the next one coming before yours carries you back past the trunk and drops away into the mist.
// Everything moves by the wall clock, so every player sees the same branches in the same places.
import * as THREE from 'three';

const TAU = Math.PI * 2, N = 26, C = 15, V = 9, LANE = 9; // pooled branches, one branch every C m, coming at V m/s, lane half-width
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

  // ---- the branches: a pool of N, each showing the branch due in its slot. A branch: a thick log lying along the run
  // (its top flattened to walk on) growing out of a huge trunk at the side of the lane, leafy at its tip
  const logGeo = new THREE.CylinderGeometry(1, 1, 1, 14, 6, false).rotateX(Math.PI / 2); // (along z)
  { const p = logGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.55) p.setY(i, 0.55 + (y - 0.55) * 0.25); } logGeo.computeVertexNormals(); } // (a flattened top)
  const trunkGeo = new THREE.CylinderGeometry(1, 1.1, 1, 16, 1, true), leafGeo = new THREE.IcosahedronGeometry(1, 1);
  const slots = [];
  for (let i = 0; i < N; i++) {
    const p = { kind: 'branch', x: 0, z: 0, y: 0, w: 3, d: 10, ang: 0, i: A.plats.length, meshes: [], boxes: [], ramps: [], rays: [], slot: i, k: null };
    A.plats.push(p); p.node = A.node('P' + p.i, 0, 0, 0); p.node.plat = p.i;
    p.box = { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 }; A.boxes.push(p.box); A.rayBoxes.push(p.box); p.boxes.push(p.box);
    p.tbox = { x0: 0, x1: 0, y0: -40, y1: 70, z0: 0, z1: 0 }; A.rayBoxes.push(p.tbox); // (the trunk: hook it, never stand on it)
    const g = new THREE.Group(); S.add(g); p.group = g;
    p.log = new THREE.Mesh(logGeo, barkM); p.log.castShadow = p.log.receiveShadow = true; g.add(p.log);
    p.trunk = new THREE.Mesh(trunkGeo, barkM); p.trunk.castShadow = true; S.add(p.trunk);
    p.leaves = [0, 1, 2].map((j) => { const m = new THREE.Mesh(leafGeo, j % 2 ? leafM2 : leafM); m.castShadow = true; g.add(m); return m; });
    p.sp = new THREE.Vector3(); p.sp.plat = p.i; A.spawns.push(p.sp);
    slots.push(p);
  }
  for (let i = 0; i < N; i++) A.link('P' + slots[i].i, 'P' + slots[(i + 1) % N].i, 'swing');

  // branch k's shape: which side its trunk is on, where it sits across the lane, its height, length and girth
  const shape = (k) => {
    const side = hash(k, 1) < 0.5 ? -1 : 1, lane = 3.2 * Math.sin(k * 0.8) + (hash(k, 2) - 0.5) * 2.4; // (weaving from side to side, never too far from the last)
    const y = 3 + 2.6 * Math.sin(k * 0.55) + 1.6 * Math.sin(k * 1.37 + 2) + hash(k, 3) * 1.5; // (rising and falling, never too far from the last)
    return { side, x: lane, y, len: 8.5 + hash(k, 4) * 5, girth: 1.6 + hash(k, 5) * 0.9, jit: (hash(k, 6) - 0.5) * 3 };
  };
  const place = (p, k, Z) => {
    const sh = p.k === k ? p.shape : (p.shape = shape(k)); p.k = k;
    const z = -k * C + Z + sh.jit, drop = z > 18 ? (z - 18) * (z - 18) * 0.035 : 0, y = sh.y - drop;
    p.prev = { x: p.x, y: p.y, z: p.z };
    p.x = sh.x; p.z = z; p.y = y; p.w = sh.girth * 1.7; p.d = sh.len;
    const b = p.box, hw = sh.girth * 0.85; b.x0 = sh.x - hw; b.x1 = sh.x + hw; b.z0 = z - sh.len / 2; b.z1 = z + sh.len / 2; b.y1 = y; b.y0 = y - sh.girth * 1.6;
    p.group.position.set(sh.x, y - sh.girth * 0.55 * 0.62, z); p.log.scale.set(sh.girth, sh.girth * 0.62, sh.len);
    // the trunk it grows from, beside the lane at the branch's far (back) end, and the crook joining them
    const tx = sh.side * (LANE + 2.5), tR = 2.6 + hash(k, 7) * 1.4; p.trunk.position.set(tx, 20, z + sh.len * 0.35); p.trunk.scale.set(tR, 120, tR);
    p.tbox.x0 = tx - tR * 0.8; p.tbox.x1 = tx + tR * 0.8; p.tbox.z0 = z + sh.len * 0.35 - tR * 0.8; p.tbox.z1 = z + sh.len * 0.35 + tR * 0.8;
    p.leaves.forEach((m, j) => { m.position.set(sh.side * (3.2 + j * 1.3), 3.2 + j * 1.1, -sh.len * 0.25 + j * 2.2); m.scale.set(1.8 + j * 0.5, 1.3 + j * 0.3, 1.9); }); // a leafy spray at the tip (it's soft: you pass through it)
    p.node.p.set(sh.x, y, z); p.sp.set(sh.x, y + 0.1, z - sh.len * 0.25);
  };
  const clock = () => (Date.now() / 1000) % 20000;
  let Z = clock() * V;
  const kAt = (Zz) => Math.floor((Zz - 60) / C); // the oldest branch still in play
  const assign = (Zz) => { const k0 = kAt(Zz); for (const p of slots) { const k = k0 + ((((p.slot - k0) % N) + N) % N); place(p, k, Zz); } };
  assign(Z); for (const p of slots) p.prev = { x: p.x, y: p.y, z: p.z };

  // ---- each frame: move the branches, carry whoever stands on one along with it
  const onIt = (f, p) => f.alive && f.onGround && f.pos.x > p.box.x0 - 0.4 && f.pos.x < p.box.x1 + 0.4 && f.pos.z > p.box.z0 - 0.4 && f.pos.z < p.box.z1 + 0.4 && Math.abs(f.pos.y - p.y) < 0.7;
  A.tickTilt = (fighters, mine, dt) => {
    dt = Math.min(0.05, dt || 0);
    const riders = [];
    for (const f of fighters) if (mine(f)) for (const p of slots) if (onIt(f, p)) { riders.push([f, p, p.k, p.x, p.y, p.z]); break; }
    Z = clock() * V; assign(Z);
    for (const [f, p, k, x, y, z] of riders) if (p.k === k) { f.pos.x += p.x - x; f.pos.y += p.y - y; f.pos.z += p.z - z; f.runOn = true; } // (ride along)
    for (const f of fighters) if (mine(f) && f.runOn && !f.onGround) { f.vel.z += V; f.runOn = false; } // (leap off: keep the branch's speed)
    for (const f of fighters) if (mine(f) && f.alive && f.pos.z < -30) f.pos.z += Math.min(8, (-30 - f.pos.z) * 0.3) * dt; // (run too far ahead and the forest's current eases you back: the fight stays together)
  };
  A.fallText = () => 'fell into the forest'; A.fallBy = () => 'Fell into the forest';
  A.killAt = (q) => (q.z > 46 ? 1e9 : A.killY); // (left behind: the forest swallows you)
  /** The branch ahead of q worth heading for next (for the bots). */
  A.nextBranch = (q) => { let best = null, bs = Infinity; for (const p of slots) { if (p.z + p.d / 2 > q.z - 1 || p.z < q.z - 40 || (p.z < -45 && q.z > -45)) continue; const sc = (q.z - p.z) * 0.6 + Math.abs(p.x - q.x) + Math.abs(p.y - q.y) * 2; if (sc < bs) { bs = sc; best = p; } } return best; };
  A.finishNav();
}
