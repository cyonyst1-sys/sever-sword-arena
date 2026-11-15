// Swinging Decks: nine big round dish decks in a 3 x 3 grid, each hanging on one chain fixed to its middle from an
// iron frame overhead (cut the chain and the deck drops). Land on one and it gets shoved the way you were going (harder landings, bigger
// shoves), then swings back and forth like a pendulum, rising a little at each end of its swing, and slowly settles.
// Running or dashing across a deck pushes it the other way. Whoever stands on a deck rides along with it.
import * as THREE from 'three';
import { deck, drift, farRing } from './maps2.js';
import { cloudHeaps } from './scenery.js?v=20261115004232';

const TAU = Math.PI * 2, N = 3, R = 7, DISH = 1.2, GAP = 4, L = 24, MAXOFF = 4; // grid, dish radius and depth, gap, chain length, furthest swing
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });

export function buildTilt(A, T) {
  const S = A.scene, r = T.rng(8181);
  A.plats = []; A.pillars = []; A.arcPts = []; A.killY = -40;
  A.setSky({ top: 0x3d6a9a, mid: 0xc9d8e6, bot: 0xe8eef4, fog: 0xc4d4e2, near: 90, far: 380, hemiSky: 0xeef4ff, hemiGround: 0x5a5a6a, hemi: 1.1, sunColor: 0xfff2dc, sun: 2.4, sunOff: new THREE.Vector3(35, 60, 25) });
  const planks = std(0xffffff, { map: T.canvasTex((g, s) => {
    for (let i = 0; i < 8; i++) { const c = 120 + Math.random() * 40 | 0; g.fillStyle = `rgb(${c},${c * 0.72 | 0},${c * 0.45 | 0})`; g.fillRect(0, i * s / 8, s, s / 8 - 2); g.fillStyle = 'rgba(40,24,10,0.6)'; g.fillRect(0, (i + 1) * s / 8 - 2, s, 2); }
    for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(50,30,14,0.25)'; g.fillRect(Math.random() * s, Math.random() * s, 8 + Math.random() * 30, 1); }
  }), roughness: 0.85 });
  const iron = std(0x2c2e34, { metalness: 0.7, roughness: 0.35 }), brass = std(0xc79a3a, { metalness: 0.8, roughness: 0.3 }), red = std(0xc23b2b);
  const up = new THREE.Vector3(0, 1, 0);

  // ---- the decks: round dishes (like on Sky Spires), each hanging from one chain fixed to its middle, at slightly
  // different heights. Cut the chain and the deck drops.
  const span = N * 2 * R + (N - 1) * GAP, decks = [];
  const dishGeo = (() => { const D = DISH, prof = [];
    for (let k = 0; k <= 10; k++) { const u = k / 10; prof.push(new THREE.Vector2(Math.max(0.01, u * R), D * u * u)); }
    prof.push(new THREE.Vector2(R + 0.25, D + 0.05), new THREE.Vector2(R + 0.3, D - 0.3));
    for (let k = 10; k >= 0; k--) { const u = k / 10; prof.push(new THREE.Vector2(Math.max(0.01, u * (R + 0.1)), D * u * u - 0.5 - (1 - u) * 0.25)); }
    const g = new THREE.LatheGeometry(prof, 48), uv = g.attributes.uv, ps = g.attributes.position;
    for (let i = 0; i < ps.count; i++) uv.setXY(i, ps.getX(i) / 7, ps.getZ(i) / 7); return g; })();
  const plankD = planks.clone(); plankD.side = THREE.DoubleSide;
  for (let i = 0; i < N; i++) for (let k = 0; k < N; k++) {
    const x = -span / 2 + R + i * (2 * R + GAP), z = -span / 2 + R + k * (2 * R + GAP), y = Math.round((r() * 3 - 1) * 2) / 2;
    const p = { kind: 'swing', x, z, y, w: 2 * R, d: 2 * R, ang: 0, round: R, dish: DISH, i: A.plats.length, meshes: [], boxes: [], ramps: [], rays: [] };
    A.plats.push(p); A.node('P' + p.i, x, y, z).plat = p.i; { const sp = new THREE.Vector3(x + 2, y + 0.3, z); sp.plat = p.i; A.spawns.push(sp); }
    p.disc = { x, z, r: R, y0: y - 0.8, y1: y, dish: DISH }; A.discs.push(p.disc); p.discs = [p.disc];
    p.ray = { x0: x - R * 0.85, x1: x + R * 0.85, y0: y - 0.8, y1: y + DISH, z0: z - R * 0.85, z1: z + R * 0.85 }; A.rayBoxes.push(p.ray); p.rays.push(p.ray);
    p.home = { x, y, z }; p.off = { x: 0, z: 0 }; p.vel = { x: 0, z: 0 }; p.prev = { x, y, z }; p.riders = new Set();
    const g = new THREE.Group(); S.add(g); p.meshes.push(g); p.group = g;
    const m = new THREE.Mesh(dishGeo, plankD); m.castShadow = m.receiveShadow = true; g.add(m);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.27, 0.13, 6, 48), brass); rim.rotation.x = Math.PI / 2; rim.position.y = DISH; g.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 0.3, 16), brass); hub.position.y = 0.12; g.add(hub); // where the chain is fixed
    p.pivot = new THREE.Vector3(x, y + L, z);
    const cm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1, 6), iron); S.add(cm); p.meshes.push(cm);
    p.chains = [{ m: cm, a: 0, b: 0 }];
    decks.push(p);
  }
  // walking links between neighbouring decks (bots jump the gaps)
  for (const a of decks) for (const b of decks) if (a.i < b.i && Math.hypot(a.home.x - b.home.x, a.home.z - b.home.z) < 2 * R + GAP + 0.5) A.link('P' + a.i, 'P' + b.i);

  // ---- the iron frame overhead the decks hang from (hook it), and pillars round the outside
  const fy = 1 + L + 0.5, half = span / 2 + 1;
  for (let i = 0; i < N; i++) {
    const c = -span / 2 + R + i * (2 * R + GAP);
    for (const [x0, x1, z0, z1] of [[-half, half, c - 0.35, c + 0.35], [c - 0.35, c + 0.35, -half, half]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.7, z1 - z0), iron); m.position.set((x0 + x1) / 2, fy, (z0 + z1) / 2); m.castShadow = true; S.add(m);
      A.rayBoxes.push({ x0, x1, y0: fy - 0.35, y1: fy + 0.35, z0, z1 });
    }
  }
  for (const [x, z] of [[-half, -half], [half, -half], [-half, half], [half, half]]) { // the frame's legs go down into the clouds
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, fy + 50, 1.2), iron); m.position.set(x, (fy - 50) / 2, z); m.castShadow = true; S.add(m);
    A.rayBoxes.push({ x0: x - 0.6, x1: x + 0.6, y0: -50, y1: fy, z0: z - 0.6, z1: z + 0.6 }); A.pillars.push({ x, z, w: 1.2 });
  }
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * TAU + TAU / 16, rr = span / 2 + 10 + (k % 2) * 4, x = Math.cos(a) * rr, z = Math.sin(a) * rr, top = 14 + (k % 3) * 5;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, top + 50, 10), iron); p.position.set(x, (top - 50) / 2, z); p.castShadow = true; S.add(p);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 8), brass); cap.position.set(x, top, z); S.add(cap);
    A.rayBoxes.push({ x0: x - 0.8, x1: x + 0.8, y0: -50, y1: top + 1, z0: z - 0.8, z1: z + 0.8 }); A.pillars.push({ x, z, w: 1.6 });
  }

  // ---- swinging: a pendulum spring back to the middle, a little damping; landings and footwork push the decks
  const place = (p) => {
    const ox = p.off.x, oz = p.off.z, rise = (ox * ox + oz * oz) / (2 * L); // a pendulum rises as it swings out
    p.prev = { x: p.x, y: p.y, z: p.z };
    p.x = p.home.x + ox; p.z = p.home.z + oz; p.y = p.home.y + rise;
    p.group.position.set(p.x, p.y, p.z);
    const c = p.disc; c.x = p.x; c.z = p.z; c.y0 = p.y - 0.8; c.y1 = p.y;
    const q = p.ray, k = R * 0.85; q.x0 = p.x - k; q.x1 = p.x + k; q.z0 = p.z - k; q.z1 = p.z + k; q.y0 = p.y - 0.8; q.y1 = p.y + DISH;
    const ch = p.chains[0], s = new THREE.Vector3(p.x, p.y + 0.25, p.z), d = p.pivot.clone().sub(s), len = d.length();
    ch.line.a.copy(s); ch.line.b.copy(p.pivot); ch.m.position.copy(s).addScaledVector(d, 0.5); ch.m.quaternion.setFromUnitVectors(up, d.normalize()); ch.m.scale.set(1, len, 1);
  };
  // ---- the chain can be cut: a sword through it snaps it and the deck drops away (with whoever is on it); a fresh
  // one swings back into place 10 s later
  A.lines = [];
  for (const p of decks) for (const c of p.chains) { c.line = { id: A.lines.length, a: new THREE.Vector3(), b: new THREE.Vector3(), alive: true, deck: p, chain: c }; A.lines.push(c.line); }
  let clockT = 0;
  const dropDeck = (p) => {
    p.down = true; p.fall = 0; p.fv = 0; p.backAt = clockT + 10;
    A.discs = A.discs.filter((c) => c !== p.disc); A.rayBoxes = A.rayBoxes.filter((b) => b !== p.ray); A.nodeMap.get('P' + p.i).gone = true;
    for (const c of p.chains) { c.line.alive = false; c.m.visible = false; }
  };
  const restore = (p) => {
    p.down = false; p.off.x = p.off.z = p.vel.x = p.vel.z = 0; A.discs.push(p.disc); A.rayBoxes.push(p.ray); A.nodeMap.get('P' + p.i).gone = false;
    for (const c of p.chains) { c.line.alive = true; c.m.visible = true; }
    p.group.visible = true; place(p);
  };
  /** Cut chain id (from a sword here or a message from another player). Returns where, or null. */
  A.cutLine = (id) => {
    const Ln = A.lines[id]; if (!Ln || !Ln.alive) return null;
    Ln.alive = false; Ln.chain.m.visible = false; const at = Ln.a.clone().lerp(Ln.b, 0.15);
    if (!Ln.deck.chains.some((c) => c.line.alive)) dropDeck(Ln.deck); // (its only chain: down it goes)
    A.dirty = true; return at;
  };
  A.anim.push((t, dt) => {
    clockT = t; dt = dt || 0;
    for (const p of decks) {
      if (p.down && p.fall < 90) { p.fv += 30 * dt; p.fall += p.fv * dt; p.group.position.y -= p.fv * dt; p.disc.y0 -= p.fv * dt; p.disc.y1 -= p.fv * dt; if (p.fall >= 90) p.group.visible = false; }
      if (p.down && t > p.backAt) restore(p);
    }
  });
  const onDeck = (f, p) => f.alive && Math.hypot(f.pos.x - p.x, f.pos.z - p.z) < R + 0.2 && f.pos.y > p.y - 0.4 && f.pos.y < p.y + DISH + 0.7;
  // decks that swing into a neighbour bump off it (and pass the swing on), rather than passing through
  const pairs = [];
  for (const a of decks) for (const b of decks) if (a.i < b.i && Math.hypot(a.home.x - b.home.x, a.home.z - b.home.z) < (2 * R + GAP) * 1.5) pairs.push([a, b]);
  const bump = () => {
    for (const [a, b] of pairs) {
      if (a.down || b.down) continue;
      const dx = (b.home.x + b.off.x) - (a.home.x + a.off.x), dz = (b.home.z + b.off.z) - (a.home.z + a.off.z), dl = Math.hypot(dx, dz) || 1, ov = 2 * R + 0.3 - dl;
      if (ov <= 0) continue;
      const nx = dx / dl, nz = dz / dl; a.off.x -= nx * ov / 2; a.off.z -= nz * ov / 2; b.off.x += nx * ov / 2; b.off.z += nz * ov / 2;
      const rv = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz; if (rv < 0) { const j = rv * 0.92; a.vel.x += nx * j; a.vel.z += nz * j; b.vel.x -= nx * j; b.vel.z -= nz * j; }
    }
  };
  /** Each frame: swing the decks; a fighter landing on one shoves it, running on one pushes it back; carry riders. */
  A.tickTilt = (fighters, mine, dt) => {
    dt = Math.min(0.05, dt || 0); if (!dt) return;
    for (const p of decks) {
      if (p.down) { p.riders = new Set(); continue; } // (dropped: falling, not swinging)
      const now = new Set();
      for (const f of fighters) if (onDeck(f, p)) {
        now.add(f);
        if (!p.riders.has(f)) { // just landed: shoved the way they were going, and harder the faster they came in
          const hs = Math.hypot(f.vel.x, f.vel.z), drop = Math.max(0, -f.vel.y), k = 0.3 + Math.min(0.2, drop * 0.015);
          p.vel.x += f.vel.x * k; p.vel.z += f.vel.z * k;
          if (hs < 2) { const a = Math.random() * TAU; p.vel.x += Math.cos(a) * drop * 0.12; p.vel.z += Math.sin(a) * drop * 0.12; } // a straight drop just wobbles it
        } else { p.vel.x -= f.vel.x * 0.25 * dt; p.vel.z -= f.vel.z * 0.25 * dt; } // footwork pushes the deck back the other way
      }
      p.riders = now;
      const kspr = 24 / L, damp = 0.18;
      p.vel.x += (-kspr * p.off.x - damp * p.vel.x) * dt; p.vel.z += (-kspr * p.off.z - damp * p.vel.z) * dt;
      p.off.x += p.vel.x * dt; p.off.z += p.vel.z * dt;
      const o = Math.hypot(p.off.x, p.off.z); if (o > MAXOFF) { p.off.x *= MAXOFF / o; p.off.z *= MAXOFF / o; const vr = (p.vel.x * p.off.x + p.vel.z * p.off.z) / MAXOFF; if (vr > 0) { p.vel.x -= p.off.x / MAXOFF * vr; p.vel.z -= p.off.z / MAXOFF * vr; } }
    }
    bump(); // after every deck has moved: knock apart any that swung into each other
    for (const p of decks) {
      if (p.down) continue;
      place(p);
      for (const f of p.riders) if (mine(f) && f.onGround) { f.pos.x += p.x - p.prev.x; f.pos.z += p.z - p.prev.z; if (p.y > p.prev.y) f.pos.y += p.y - p.prev.y; } // ride along
    }
  };
  for (const p of decks) place(p);

  A.finishNav();

  // ---- backdrop: towering clouds, a sea of cloud, drifting specks
  cloudHeaps(S, r, { n: 16, rMin: 330, rMax: 400, y: -32, depth: 8, sMin: 26, sMax: 42, stack: 4, fog: false }); // towering clouds round the horizon
  const sea = new THREE.Mesh(new THREE.CircleGeometry(620, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf4f7fa, transparent: true, opacity: 0.97 })); sea.position.y = -45; S.add(sea);
  drift(A, 120, 0xffffff, 0.2, [1.4, 0, 0.6], 0.4);
}
