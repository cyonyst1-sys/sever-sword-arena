// Tipping Point: one big square deck hanging from a giant chain like the weight of a pendulum. It leans toward
// whichever side has more fighters on it (and further out counts a bit more, like a balance beam), and everyone on
// a leaning deck slides downhill: stand around on the low side and you slide off into the clouds. Get back up to
// the high side to level it out. Tall pillars stand round the deck to grapple back from a fall.
import * as THREE from 'three';
import { drift, farRing } from './maps2.js';

const TAU = Math.PI * 2, HALF = 16, TOP = 0, MAXS = 0.45; // half the deck's width, its height at the middle, the steepest slope (about 24°)
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });

export function buildTilt(A, T) {
  const S = A.scene, M = A.mats, r = T.rng(8181);
  A.plats = []; A.pillars = []; A.arcPts = []; A.killY = -40;
  A.setSky({ top: 0x3d6a9a, mid: 0xc9d8e6, bot: 0xe8eef4, fog: 0xc4d4e2, near: 90, far: 380, hemiSky: 0xeef4ff, hemiGround: 0x5a5a6a, hemi: 1.1, sunColor: 0xfff2dc, sun: 2.4, sunOff: new THREE.Vector3(35, 60, 25) });
  const planks = std(0xffffff, { map: T.canvasTex((g, s) => {
    for (let i = 0; i < 8; i++) { const c = 120 + Math.random() * 40 | 0; g.fillStyle = `rgb(${c},${c * 0.72 | 0},${c * 0.45 | 0})`; g.fillRect(0, i * s / 8, s, s / 8 - 2); g.fillStyle = 'rgba(40,24,10,0.6)'; g.fillRect(0, (i + 1) * s / 8 - 2, s, 2); }
    for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(50,30,14,0.25)'; g.fillRect(Math.random() * s, Math.random() * s, 8 + Math.random() * 30, 1); }
  }), roughness: 0.85 });
  planks.map.repeat.set(6, 6);
  const iron = std(0x2c2e34, { metalness: 0.7, roughness: 0.35 }), brass = std(0xc79a3a, { metalness: 0.8, roughness: 0.3 }), red = std(0xc23b2b), white = std(0xeeeeee);

  // ---- the deck: a surface with no box of its own (its height comes from the tilt), drawn as one tilting group
  const deck = { kind: 'tilt', x: 0, z: 0, y: TOP, w: HALF * 2, d: HALF * 2, ang: 0, i: 0, meshes: [], boxes: [], ramps: [], rays: [] };
  A.plats.push(deck); A.node('P0', 0, TOP, 0).plat = 0;
  for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, -9], [0, 9], [-9, 0], [9, 0]]) { const sp = new THREE.Vector3(x, TOP, z); sp.plat = 0; A.spawns.push(sp); }
  const g = new THREE.Group(); S.add(g); deck.meshes.push(g);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 1.2, HALF * 2), [iron, iron, planks, iron, iron, iron]); slab.position.y = -0.6; slab.receiveShadow = slab.castShadow = true; g.add(slab);
  { // a target painted on the deck (where to stand to keep it level), brass rim and corner rings for the chains
    const ring = (r0, r1, mat) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48).rotateX(-Math.PI / 2), mat); m.position.y = 0.02; m.receiveShadow = true; g.add(m); };
    ring(1.2, 2.2, red); ring(4.2, 5, white); ring(7.6, 8.4, red); ring(11.2, 11.8, white);
    for (const [x, z, w, d] of [[0, -HALF, HALF * 2 + 0.4, 0.4], [0, HALF, HALF * 2 + 0.4, 0.4], [-HALF, 0, 0.4, HALF * 2 + 0.4], [HALF, 0, 0.4, HALF * 2 + 0.4]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), brass); m.position.set(x, 0.05, z); g.add(m); }
    for (const [x, z] of [[-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF]]) { const m = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.15, 8, 16), brass); m.position.set(x, 0.5, z); g.add(m); }
    const keel = new THREE.Mesh(new THREE.ConeGeometry(8, 14, 4), iron); keel.rotation.set(Math.PI, Math.PI / 4, 0); keel.position.y = -8.2; g.add(keel); // the pendulum weight under the deck
  }
  // ---- the pendulum: a great chain from a hook far above, down to a yoke, and four chains to the deck's corners
  const PIV = new THREE.Vector3(0, 70, 0), YOKE = new THREE.Vector3(0, 22, 0);
  const link = new THREE.TorusGeometry(0.5, 0.16, 6, 12);
  const mainChain = new THREE.InstancedMesh(link, iron, 50), mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 50; i++) { e.set(0, i % 2 ? Math.PI / 2 : 0, 0); q.setFromEuler(e); mm.compose(new THREE.Vector3(0, YOKE.y + i * (PIV.y - YOKE.y) / 50, 0), q, new THREE.Vector3(1, 1, 1)); mainChain.setMatrixAt(i, mm); }
  S.add(mainChain);
  const yoke = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), brass); yoke.position.copy(YOKE); S.add(yoke);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(3, 0.6, 8, 24, Math.PI * 1.4), iron); hook.position.copy(PIV); S.add(hook);
  const corners = [[-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF]].map(([x, z]) => new THREE.Vector3(x, 0.5, z));
  const ropes = corners.map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 6), iron); S.add(m); return m; });
  A.rayBoxes.push({ x0: -1.2, x1: 1.2, y0: YOKE.y - 1.2, y1: PIV.y, z0: -1.2, z1: 1.2 }); A.pillars.push({ x: 0, z: 0, w: 2.4 }); // hook the great chain

  // ---- pillars round the deck to grapple back from a slide off the edge
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * TAU + TAU / 16, rr = 27 + (k % 2) * 5, x = Math.cos(a) * rr, z = Math.sin(a) * rr, top = 18 + (k % 3) * 6;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, top + 50, 10), iron); p.position.set(x, (top - 50) / 2, z); p.castShadow = true; S.add(p);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 8), brass); cap.position.set(x, top, z); S.add(cap);
    A.rayBoxes.push({ x0: x - 0.8, x1: x + 0.8, y0: -50, y1: top + 1, z0: z - 0.8, z1: z + 0.8 }); A.pillars.push({ x, z, w: 1.6 });
  }

  // ---- the tilt: two slopes (height change per metre along x and along z), driven by where the weight is
  const st = { sx: 0, sz: 0, vx: 0, vz: 0 };
  A.tilt = {
    heightAt(x, z, m = 0) { const dx = x - deck.x, dz = z - deck.z; if (Math.abs(dx) > HALF + m || Math.abs(dz) > HALF + m) return null; return TOP + dx * st.sx + dz * st.sz; },
    get sx() { return st.sx; }, get sz() { return st.sz; },
  };
  const onDeck = (f) => f.alive && Math.abs(f.pos.x) < HALF && Math.abs(f.pos.z) < HALF && Math.abs(f.pos.y - A.tilt.heightAt(f.pos.x, f.pos.z)) < 0.7;
  /** Uphill, if p stands on a leaning deck: { x, z, steep } (steep = slope 0..MAXS), else null. */
  A.tiltSlope = (p) => { if (Math.abs(p.x) > HALF || Math.abs(p.z) > HALF) return null; const m = Math.hypot(st.sx, st.sz); return m < 1e-4 ? null : { x: st.sx / m, z: st.sz / m, steep: m }; };
  /** Each frame: lean toward the weight, and slide whoever we move downhill. */
  A.tickTilt = (fighters, mine, dt) => {
    dt = Math.min(0.05, dt || 0);
    let tx = 0, tz = 0;
    for (const f of fighters) if (onDeck(f)) { // one fighter = one unit of weight, a bit more the further out they stand
      const ux = f.pos.x / HALF, uz = f.pos.z / HALF;
      tx += Math.sign(ux) * (0.45 + 0.55 * Math.abs(ux)) * Math.min(1, Math.abs(ux) * 4); tz += Math.sign(uz) * (0.45 + 0.55 * Math.abs(uz)) * Math.min(1, Math.abs(uz) * 4);
    }
    // weight on +x pushes the +x edge down (height falls with x: sx goes negative); a pull back to level, some damping
    const K = 0.22, SPR = 1.6, DMP = 1.3;
    st.vx += (-K * tx - SPR * st.sx - DMP * st.vx) * dt; st.vz += (-K * tz - SPR * st.sz - DMP * st.vz) * dt;
    st.sx = Math.max(-MAXS, Math.min(MAXS, st.sx + st.vx * dt)); st.sz = Math.max(-MAXS, Math.min(MAXS, st.sz + st.vz * dt));
    if (Math.abs(st.sx) === MAXS) st.vx = 0; if (Math.abs(st.sz) === MAXS) st.vz = 0;
    // slide: the steeper it leans, the faster you slip downhill (walk, jump or dash uphill to fight it)
    for (const f of fighters) {
      if (!mine(f)) continue;
      f.slide = f.slide || { x: 0, z: 0 };
      if (f.onGround && onDeck(f)) {
        const a = 26; f.slide.x += -st.sx * a * dt; f.slide.z += -st.sz * a * dt; // downhill is minus the slope
        const k = Math.max(0, 1 - 0.9 * dt); f.slide.x *= k; f.slide.z *= k;
        f.pos.x += f.slide.x * dt; f.pos.z += f.slide.z * dt;
      } else if (f.slide.x || f.slide.z) { if (!f.onGround) { f.vel.x += f.slide.x; f.vel.z += f.slide.z; } f.slide.x = f.slide.z = 0; } // carry the slide off the edge
    }
  };
  // draw: tilt the deck, stretch the corner chains to the yoke
  const up = new THREE.Vector3(0, 1, 0), nrm = new THREE.Vector3(), tmp = new THREE.Vector3();
  A.anim.push(() => {
    nrm.set(-st.sx, 1, -st.sz).normalize(); g.quaternion.setFromUnitVectors(up, nrm);
    corners.forEach((c, j) => { tmp.copy(c); tmp.y = TOP + c.x * st.sx + c.z * st.sz + 0.5; const m = ropes[j], d = YOKE.clone().sub(tmp), L = d.length(); m.position.copy(tmp).addScaledVector(d, 0.5); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(up, d.normalize()); });
  });

  A.finishNav();

  // ---- backdrop: cloud towers, a sea of cloud, a few birds' worth of drifting specks
  farRing(A, 18, 360, (x, z, i) => {
    const h = 60 + (i % 4) * 25, m = new THREE.Mesh(new THREE.SphereGeometry(40 + (i % 3) * 14, 12, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xf2f5f8 : 0xe1e8f0, fog: false }));
    m.scale.set(1.4, h / 50, 1.4); m.position.set(x, -40 + h * 0.4, z); S.add(m);
  });
  const sea = new THREE.Mesh(new THREE.CircleGeometry(620, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf4f7fa, transparent: true, opacity: 0.97 })); sea.position.y = -45; S.add(sea);
  drift(A, 120, 0xffffff, 0.2, [1.4, 0, 0.6], 0.4);
  void r; void M;
}
