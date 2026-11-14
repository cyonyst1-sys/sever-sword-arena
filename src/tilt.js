// Swinging Decks: sixteen small wooden decks in a 4 x 4 grid with short gaps between, each hanging on its own
// chains from an iron frame overhead. Land on one and it gets shoved the way you were going (harder landings, bigger
// shoves), then swings back and forth like a pendulum, rising a little at each end of its swing, and slowly settles.
// Running or dashing across a deck pushes it the other way. Whoever stands on a deck rides along with it.
import * as THREE from 'three';
import { deck, drift, farRing } from './maps2.js';

const TAU = Math.PI * 2, N = 4, SIZE = 7, GAP = 2, L = 24, MAXOFF = 4; // grid, deck size, gap, chain length, furthest swing
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

  // ---- the decks: each hangs from a pivot straight above its middle, at a slightly different height
  const span = N * SIZE + (N - 1) * GAP, decks = [];
  for (let i = 0; i < N; i++) for (let k = 0; k < N; k++) {
    const x = -span / 2 + SIZE / 2 + i * (SIZE + GAP), z = -span / 2 + SIZE / 2 + k * (SIZE + GAP), y = Math.round((r() * 3 - 1) * 2) / 2;
    const p = deck(A, { x, z, y, w: SIZE, d: SIZE, mat: planks, kind: 'swing', thick: 0.6 });
    p.home = { x, y, z }; p.off = { x: 0, z: 0 }; p.vel = { x: 0, z: 0 }; p.prev = { x, y, z }; p.riders = new Set();
    // a brass rim, a red dot in the middle, and four chains up to the pivot
    const g = new THREE.Group(); S.add(g); p.meshes.push(g); p.group = g;
    for (const [a, b, w, d] of [[0, -SIZE / 2, SIZE + 0.2, 0.2], [0, SIZE / 2, SIZE + 0.2, 0.2], [-SIZE / 2, 0, 0.2, SIZE + 0.2], [SIZE / 2, 0, 0.2, SIZE + 0.2]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), brass); m.position.set(a, 0.05, b); g.add(m); }
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24).rotateX(-Math.PI / 2), red); dot.position.y = 0.02; g.add(dot);
    p.pivot = new THREE.Vector3(x, y + L, z);
    p.chains = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 5), iron); S.add(m); p.meshes.push(m); return { m, a: a * (SIZE / 2 - 0.3), b: b * (SIZE / 2 - 0.3) }; });
    p.meshBase = p.meshes.map((m) => m.position.clone()); p.boxBase = p.boxes.map((b) => ({ ...b }));
    decks.push(p);
  }
  // walking links between neighbouring decks (bots jump the gaps)
  for (const a of decks) for (const b of decks) if (a.i < b.i && Math.hypot(a.home.x - b.home.x, a.home.z - b.home.z) < SIZE + GAP + 0.5) A.link('P' + a.i, 'P' + b.i);

  // ---- the iron frame overhead the decks hang from (hook it), and pillars round the outside
  const fy = 1 + L + 0.5, half = span / 2 + 1;
  for (let i = 0; i < N; i++) {
    const c = -span / 2 + SIZE / 2 + i * (SIZE + GAP);
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
    const dx = ox, dy = rise, dz = oz;
    p.meshes.forEach((m, j) => m.position.set(p.meshBase[j].x + dx, p.meshBase[j].y + dy, p.meshBase[j].z + dz));
    p.group.position.set(p.x, p.y, p.z);
    p.boxes.forEach((b, j) => { const q = p.boxBase[j]; b.x0 = q.x0 + dx; b.x1 = q.x1 + dx; b.y0 = q.y0 + dy; b.y1 = q.y1 + dy; b.z0 = q.z0 + dz; b.z1 = q.z1 + dz; });
    for (const c of p.chains) { const s = new THREE.Vector3(p.x + c.a, p.y + 0.2, p.z + c.b), d = p.pivot.clone().sub(s), len = d.length(); c.line.a.copy(s); c.line.b.copy(p.pivot); c.m.position.copy(s).addScaledVector(d, 0.5); c.m.scale.set(1, len, 1); c.m.quaternion.setFromUnitVectors(up, d.normalize()); }
  };
  // ---- the chains can be cut: a sword through one snaps it; a deck down to its last chain drops away (with whoever
  // is on it), and a fresh one swings back into place 10 s later
  A.lines = [];
  for (const p of decks) for (const c of p.chains) { c.line = { id: A.lines.length, a: new THREE.Vector3(), b: new THREE.Vector3(), alive: true, deck: p, chain: c }; A.lines.push(c.line); }
  let clockT = 0;
  const dropDeck = (p) => {
    p.down = true; p.fall = 0; p.fv = 0; p.backAt = clockT + 10;
    const dead = new Set(p.boxes); A.boxes = A.boxes.filter((b) => !dead.has(b)); A.nodeMap.get('P' + p.i).gone = true;
    for (const c of p.chains) { c.line.alive = false; c.m.visible = false; }
  };
  const restore = (p) => {
    p.down = false; p.off.x = p.off.z = p.vel.x = p.vel.z = 0; A.boxes.push(...p.boxes); A.nodeMap.get('P' + p.i).gone = false;
    for (const c of p.chains) { c.line.alive = true; c.m.visible = true; }
    p.meshes.forEach((m) => { m.visible = true; }); place(p);
  };
  /** Cut chain id (from a sword here or a message from another player). Returns where, or null. */
  A.cutLine = (id) => {
    const L = A.lines[id]; if (!L || !L.alive) return null;
    L.alive = false; L.chain.m.visible = false; const at = L.a.clone().lerp(L.b, 0.15);
    if (L.deck.chains.filter((c) => c.line.alive).length <= 1) dropDeck(L.deck);
    A.dirty = true; return at;
  };
  A.anim.push((t, dt) => {
    clockT = t; dt = dt || 0;
    for (const p of decks) {
      if (p.down && p.fall < 90) { p.fv += 30 * dt; p.fall += p.fv * dt; p.meshes.forEach((m) => { m.position.y -= p.fv * dt; if (p.fall >= 90) m.visible = false; }); for (const b of p.boxes) { b.y0 -= p.fv * dt; b.y1 -= p.fv * dt; } }
      if (p.down && t > p.backAt) restore(p);
    }
  });
  const onDeck = (f, p) => f.alive && Math.abs(f.pos.x - p.x) < SIZE / 2 + 0.2 && Math.abs(f.pos.z - p.z) < SIZE / 2 + 0.2 && f.pos.y > p.y - 0.4 && f.pos.y < p.y + 0.7;
  // decks that swing into a neighbour bump off it (and pass the swing on), rather than passing through
  const pairs = [];
  for (const a of decks) for (const b of decks) if (a.i < b.i && Math.hypot(a.home.x - b.home.x, a.home.z - b.home.z) < (SIZE + GAP) * 1.5) pairs.push([a, b]); // (diagonal neighbours too)
  const bump = () => {
    for (const [a, b] of pairs) {
      if (a.down || b.down) continue;
      const dx = (b.home.x + b.off.x) - (a.home.x + a.off.x), dz = (b.home.z + b.off.z) - (a.home.z + a.off.z), ox = SIZE + 0.1 - Math.abs(dx), oz = SIZE + 0.1 - Math.abs(dz);
      if (ox <= 0 || oz <= 0) continue;
      if (ox < oz) { const s = Math.sign(dx) || 1; a.off.x -= s * ox / 2; b.off.x += s * ox / 2; const rv = (b.vel.x - a.vel.x) * s; if (rv < 0) { const t = a.vel.x; a.vel.x = b.vel.x * 0.85; b.vel.x = t * 0.85; } }
      else { const s = Math.sign(dz) || 1; a.off.z -= s * oz / 2; b.off.z += s * oz / 2; const rv = (b.vel.z - a.vel.z) * s; if (rv < 0) { const t = a.vel.z; a.vel.z = b.vel.z * 0.85; b.vel.z = t * 0.85; } }
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

  // ---- backdrop: cloud towers, a sea of cloud, drifting specks
  farRing(A, 18, 360, (x, z, i) => {
    const h = 60 + (i % 4) * 25, m = new THREE.Mesh(new THREE.SphereGeometry(40 + (i % 3) * 14, 12, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xf2f5f8 : 0xe1e8f0, fog: false }));
    m.scale.set(1.4, h / 50, 1.4); m.position.set(x, -40 + h * 0.4, z); S.add(m);
  });
  const sea = new THREE.Mesh(new THREE.CircleGeometry(620, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf4f7fa, transparent: true, opacity: 0.97 })); sea.position.y = -45; S.add(sea);
  drift(A, 120, 0xffffff, 0.2, [1.4, 0, 0.6], 0.4);
}
