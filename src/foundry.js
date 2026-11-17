// Saw Foundry: an industrial foundry floating in a smoky dusk sky, full of things that cut you in half.
//   rail saws     spinning blades that run back and forth along tracks across platforms
//   pendulums     giant saw blades swinging on long arms over the walkways
//   falling saws  a red warning ring appears on a platform, then a blade drops out of the sky and rolls off the edge
//   saw columns   poles in the gaps with spinning blades sticking out at several heights (dangers in the air)
//   lifts         platforms that rise and fall between levels
//   sliders       platforms that shuttle across gaps, carrying whoever stands on them
// Every hazard moves by the wall clock, so it is in the same place on every player's screen. A blade that hits you
// slices you along its own plane.
import * as THREE from 'three';
import { deck, prop, bridge, drift, farRing } from './maps2.js';

const TAU = Math.PI * 2;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const clock = () => Date.now() / 1000; // shared by everyone (unlike performance.now)
const hash = (n) => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// a saw blade: a toothed disc lying in the XY plane (its axis is +Z), with a red-hot hub
export function bladeMesh(R, mats) {
  const sh = new THREE.Shape(), teeth = Math.max(16, Math.round(R * 18));
  for (let i = 0; i <= teeth * 2; i++) { const a = i / (teeth * 2) * TAU, r = i % 2 ? R : R * 0.88; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y); }
  const hole = new THREE.Path(); hole.absarc(0, 0, R * 0.12, 0, TAU, true); sh.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.09, bevelEnabled: false, curveSegments: 4 }); geo.translate(0, 0, -0.045);
  const g = new THREE.Group(); g.add(new THREE.Mesh(geo, mats.blade));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.22, R * 0.22, 0.2, 16).rotateX(Math.PI / 2), mats.hub); g.add(hub);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function buildFoundry(A, T) {
  const S = A.scene, M = A.mats, r = T.rng(6161);
  A.plats = []; A.pillars = []; A.arcPts = []; A.killY = -45; // (below: a floor of grinders; all round the outside: spikes)
  A.setSky({ top: 0x0a0609, mid: 0x5a2010, bot: 0x200a06, fog: 0x42180c, near: 100, far: 420, hemiSky: 0xd0a090, hemiGround: 0xff5a1e, hemi: 1.35, sunColor: 0xffb070, sun: 2.0, sunOff: new THREE.Vector3(-50, 40, 30) });
  const plate = std(0xffffff, { map: T.canvasTex((g, s) => {
    g.fillStyle = '#7a7d86'; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 3; for (let i = -s; i < s * 2; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke(); g.beginPath(); g.moveTo(i + s, 0); g.lineTo(i, s); g.stroke(); } // diamond tread
    g.fillStyle = '#2a2b30'; g.fillRect(0, 0, s, 4); g.fillRect(0, 0, 4, s);
    g.fillStyle = '#8a8c92'; for (const [x, y] of [[10, 10], [s - 10, 10], [10, s - 10], [s - 10, s - 10]]) { g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); } // rivets
  }), roughness: 0.5, metalness: 0.4 });
  const stripe = std(0xffffff, { map: T.canvasTex((g, s) => { g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, s, s); g.fillStyle = '#e8b31a'; for (let i = -s; i < s * 2; i += s / 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s / 8, 0); g.lineTo(i + s / 8 + s, s); g.lineTo(i + s, s); g.fill(); } }), roughness: 0.5 });
  const steel = std(0x4a4c54, { metalness: 0.8, roughness: 0.3 }), rust = std(0x8a4a26, { roughness: 0.75, metalness: 0.3 }), dark = std(0x1c1c20, { roughness: 0.5, metalness: 0.5 });
  const mats = { blade: std(0xf2f4f8, { metalness: 0.3, roughness: 0.2, emissive: 0x6a3010, emissiveIntensity: 0.9 }), hub: std(0xff3a14, { emissive: 0xff2a00, emissiveIntensity: 1.6 }) };
  const warnMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.6, depthWrite: false });
  M.wood = steel; // (bridges use it for their planks)

  // a steel platform with a yellow-and-black hazard stripe round its edge
  const platf = (o) => {
    const p = deck(A, { ...o, mat: plate, thick: o.thick || 1.2 });
    A.tag = p; const t = 0.35, y = o.y, x0 = o.x - o.w / 2, x1 = o.x + o.w / 2, z0 = o.z - o.d / 2, z1 = o.z + o.d / 2;
    for (const [a, b, c, d] of [[x0, x1, z0, z0 + t], [x0, x1, z1 - t, z1], [x0, x0 + t, z0, z1], [x1 - t, x1, z0, z1]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(b - a, 0.06, d - c), stripe); m.position.set((a + b) / 2, y + 0.03, (c + d) / 2); m.receiveShadow = true; S.add(m); p.meshes.push(m); }
    A.tag = null;
    const under = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(o.w, o.d) * 0.3, 0.6, 14, 6), rust); prop(A, p, under, o.x, y - (o.thick || 1.2) - 7, o.z);
    return p;
  };

  // ---- layout: a big foundry floor in the middle, a ring of platforms at different heights round it
  const C = platf({ x: 0, z: 0, y: 0, w: 26, d: 26, kind: 'floor', sx: 0, sz: -9 });
  const ring = [];
  [[2, 18, 14], [9, 14, 16], [-3, 16, 14], [6, 18, 12], [-6, 14, 18], [12, 13, 13]].forEach(([y, w, d], k) => {
    const a = k / 6 * TAU + 0.25, x = Math.round(Math.cos(a) * 36), z = Math.round(Math.sin(a) * 36);
    ring.push(platf({ x, z, y, w, d, kind: 'deck' }));
  });
  const rope = std(0x2a2a2a, { roughness: 0.8 });
  const walks = [bridge(A, C, ring[0], 3, steel, rope), bridge(A, C, ring[3], 3, steel, rope)];

  // ---- hazards (each knows where its blade is at time T: centre, axis, radius)
  const hz = []; A.hazards = hz;
  const spin = (h, g, dt) => { h.ang = (h.ang || 0) + dt * 18; g.children[0].rotation.z = h.ang; g.children[1].rotation.z = h.ang; };

  // rail saws: a vertical blade running along a track across a platform, axis across the track
  const railSaw = (p, alongX, off, period, R = 1.5) => {
    const len = (alongX ? p.w : p.d) - 3, g = bladeMesh(R, mats); S.add(g); p.meshes.push(g);
    const track = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len + 1 : 0.5, 0.12, alongX ? 0.5 : len + 1), dark); track.position.set(p.x + (alongX ? 0 : off), p.y + 0.06, p.z + (alongX ? off : 0)); S.add(track); p.meshes.push(track);
    const h = { R, g, plat: p, axis: alongX ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0), c: new THREE.Vector3(), track: true };
    if (!alongX) g.rotation.y = Math.PI / 2;
    h.at = (t) => { const u = Math.sin(t * TAU / period) * len / 2; h.c.set(p.x + (alongX ? u : off), p.y + R - 0.35, p.z + (alongX ? off : u)); };
    hz.push(h); return h;
  };
  railSaw(C, true, 5, 7); railSaw(C, false, -6, 9); railSaw(ring[1], true, 0, 6); railSaw(ring[4], false, 2, 7.5);

  // pendulums: a long arm from a gantry over a walkway, a big blade at its end swinging across the walkway
  const pendulum = (wp, period, R = 2) => {
    const mid = new THREE.Vector3(wp.x, wp.y, wp.z), dir = new THREE.Vector3(Math.cos(wp.ang), 0, Math.sin(wp.ang)), side = new THREE.Vector3(-dir.z, 0, dir.x), L = 9, pivot = mid.clone().setY(wp.y + L + 1.2);
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, L + 1.4, 0.5), steel); leg.position.copy(pivot).addScaledVector(side, s * 0.0).addScaledVector(dir, s * 1.6).setY(wp.y + (L + 1.2) / 2 - 0.4); leg.position.addScaledVector(side, 3.2 * 0); S.add(leg); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), steel); beam.position.copy(pivot); S.add(beam);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, L, 0.25), steel); S.add(arm);
    const g = bladeMesh(R, mats); S.add(g);
    const h = { R, g, arm, axis: dir.clone(), c: new THREE.Vector3() };
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); // the blade swings in the plane across the walkway
    h.at = (t) => { const a = Math.sin(t * TAU / period) * 1.05; const off = side.clone().multiplyScalar(Math.sin(a) * L); h.c.copy(pivot).add(off).setY(pivot.y - Math.cos(a) * L); arm.position.copy(pivot).lerp(h.c, 0.5); arm.lookAt(h.c); arm.rotateX(Math.PI / 2); };
    A.rayBoxes.push({ x0: pivot.x - 0.5, x1: pivot.x + 0.5, y0: pivot.y - 0.5, y1: pivot.y + 0.5, z0: pivot.z - 0.5, z1: pivot.z + 0.5, danger: true }); // (players can hook the gantry; bots know better)
    hz.push(h); return h;
  };
  pendulum(walks[0], 4.6); pendulum(walks[1], 5.2);

  // saw columns: poles in the gaps between ring platforms, horizontal blades spinning off them at three heights
  for (let k = 0; k < 3; k++) {
    const a = (k * 2 + 1) / 6 * TAU + 0.25, x = Math.cos(a) * 30, z = Math.sin(a) * 30;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 60, 10), steel); pole.position.set(x, -10, z); S.add(pole);
    A.rayBoxes.push({ x0: x - 0.45, x1: x + 0.45, y0: -40, y1: 20, z0: z - 0.45, z1: z + 0.45, danger: true }); // (hookable, at your own risk: bots don't)
    [6, 15].forEach((hy, j) => {
      const R = 2.2, g = bladeMesh(R, mats); g.rotation.x = -Math.PI / 2; S.add(g);
      const h = { R, g, axis: new THREE.Vector3(0, 1, 0), c: new THREE.Vector3() }, dir = j % 2 ? 1 : -1;
      h.at = (t) => { const a = t * 0.9 * dir + j * 2.1; h.c.set(x + Math.cos(a) * 1.4, hy, z + Math.sin(a) * 1.4); };
      hz.push(h);
    });
  }

  // safe steel pylons (no blades) between the platforms: anchors to swing from, for players and bots
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * TAU + 0.25 + TAU / 12, rr = k % 2 ? 22 : 46, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const py = new THREE.Mesh(new THREE.BoxGeometry(1.1, 70, 1.1), steel); py.position.set(x, -10, z); py.castShadow = true; S.add(py);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.6), stripe); cap.position.set(x, 25.4, z); S.add(cap);
    A.rayBoxes.push({ x0: x - 0.55, x1: x + 0.55, y0: -45, y1: 25, z0: z - 0.55, z1: z + 0.55 }); A.pillars.push({ x, z, w: 1.1 });
  }

  // falling saws: every 5 s a warning ring on one platform, then a blade drops in and rolls off the edge
  const landing = [C, ...ring];
  const fallG = bladeMesh(2.2, mats); S.add(fallG); fallG.visible = false;
  const warn = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.4, 32).rotateX(-Math.PI / 2), warnMat); S.add(warn); warn.visible = false;
  const fall = { R: 2.2, g: fallG, axis: new THREE.Vector3(1, 0, 0), c: new THREE.Vector3(), off: true };
  fall.at = (t) => {
    const k = Math.floor(t / 5), u = t - k * 5, p = landing[Math.floor(hash(k) * landing.length) % landing.length];
    const lx = p.x + (hash(k + 0.3) - 0.5) * (p.w - 6), lz = p.z + (hash(k + 0.7) - 0.5) * (p.d - 6), ra = hash(k + 0.9) * TAU, rx = Math.cos(ra), rz = Math.sin(ra);
    warn.visible = u < 1.6; warn.position.set(lx, p.y + 0.08, lz); warn.material.opacity = 0.35 + 0.35 * Math.abs(Math.sin(u * 12));
    fall.axis.set(-rz, 0, rx); fallG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fall.axis);
    if (u < 1.6) { fall.off = true; fallG.visible = false; return; }
    fall.off = false; fallG.visible = true;
    if (u < 2.0) { const s = (u - 1.6) / 0.4; fall.c.set(lx, p.y + 2.2 + 36 * (1 - s) * (1 - s), lz); return; } // dropping out of the sky
    const d = (u - 2.0) * 9, x = lx + rx * d, z = lz + rz * d; // rolling across the platform...
    const over = !A.inPlat(p, { x, z }, 0), drop = over ? (u - 2.0 - Math.max(0, (Math.hypot(x - p.x, z - p.z) - Math.min(p.w, p.d) / 2) / 9)) : 0;
    fall.c.set(x, p.y + 2.2 - (over ? 12 * drop * drop + 2 : 0), z); // ...and off the edge
  };
  hz.push(fall);

  // ---- moving platforms: lifts (up and down) and sliders (back and forth across a gap)
  const movers = []; A.movers = movers;
  const mover = (o, path) => {
    const p = platf({ ...o, kind: o.kind, thick: 0.6 }); p.base = { x: p.x, y: p.y, z: p.z }; p.path = path; p.prev = { x: p.x, y: p.y, z: p.z };
    const n = A.nodeMap.get('P' + p.i); if (n) n.gone = true; // bots don't plan routes over moving things
    A.spawns = A.spawns.filter((sp) => sp.plat !== p.i);
    p.parts = [...p.meshes, ...p.boxes]; p.meshBase = p.meshes.map((m) => m.position.clone()); p.boxBase = p.boxes.map((b) => ({ ...b }));
    movers.push(p); return p;
  };
  mover({ x: 22, z: -24, y: -6, w: 6, d: 6, kind: 'lift' }, (t) => ({ x: 0, y: (1 - Math.cos(t * TAU / 9)) * 9, z: 0 }));
  mover({ x: -24, z: 21, y: -4, w: 6, d: 6, kind: 'lift' }, (t) => ({ x: 0, y: (1 - Math.cos(t * TAU / 10 + 1)) * 8, z: 0 }));
  mover({ x: -20, z: -10, y: 1, w: 7, d: 5, kind: 'slider' }, (t) => ({ x: -Math.cos(t * TAU / 8) * 6 + 6, y: 0, z: 0 }));
  mover({ x: 10, z: 22, y: 3, w: 5, d: 7, kind: 'slider' }, (t) => ({ x: 0, y: 0, z: -Math.cos(t * TAU / 7.5) * 5 + 5 }));
  // trapdoor platforms: the two plain platforms of the ring hide rows of blades in their deck. At random moments the
  // red warning flashes on the deck, and it drops sharply out from under you, leaving the blades standing up through
  // where you were; then it rises back up through them. (Wall clock and a hash of the cycle: the same for every player.)
  const trap = (p, seed) => {
    p.base = { x: p.x, y: p.y, z: p.z }; p.prev = { x: p.x, y: p.y, z: p.z };
    const n = A.nodeMap.get('P' + p.i); if (n) n.gone = true; A.spawns = A.spawns.filter((sp) => sp.plat !== p.i);
    const DROP = 3.4, CYC = 8;
    const cyc = (t) => { const k = Math.floor(t / CYC + seed), u = t - (k - seed) * CYC, u0 = 1.6 + hash(k * 3.1 + seed) * 4.2; return { u, u0 }; };
    p.path = (t) => { const { u, u0 } = cyc(t), d = u - u0; let y = 0;
      if (d >= 0 && d < 0.22) y = -DROP * (d / 0.22) ** 2; else if (d >= 0.22 && d < 2.0) y = -DROP; else if (d >= 2.0 && d < 3.2) { const s = (d - 2.0) / 1.2; y = -DROP * (1 - s * s * (3 - 2 * s)); }
      return { x: 0, y, z: 0 }; };
    p.parts = [...p.meshes, ...p.boxes]; p.meshBase = p.meshes.map((m) => m.position.clone()); p.boxBase = p.boxes.map((b) => ({ ...b })); movers.push(p);
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(p.w - 0.8, p.d - 0.8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0, depthWrite: false })); flash.position.set(p.x, p.y + 0.09, p.z); S.add(flash); p.meshes.push(flash); p.meshBase.push(flash.position.clone());
    A.anim.push(() => { const { u, u0 } = cyc(clock()), d = u - u0; flash.material.opacity = d > -0.9 && d < 0 ? 0.25 + 0.25 * Math.abs(Math.sin(d * 18)) : 0; });
    for (const oz of [-4, 0, 4]) for (const ox of [-4, 0, 4]) { // three rows of three blades, standing in the deck
      const R = 1.6, g = bladeMesh(R, mats); S.add(g); const c = new THREE.Vector3(p.x + ox, p.y - 1.75, p.z + oz);
      const h = { R, g, axis: new THREE.Vector3(0, 0, 1), c: new THREE.Vector3(), off: true };
      h.at = (t) => { h.c.copy(c); h.off = p.y > p.base.y - 0.3; }; // (harmless while the deck covers them)
      hz.push(h);
    }
  };
  trap(ring[2], 0); trap(ring[5], 0.47);
  const moveAll = (t) => {
    for (const p of movers) {
      const o = p.path(t); p.prev = { x: p.x, y: p.y, z: p.z };
      p.x = p.base.x + o.x; p.y = p.base.y + o.y; p.z = p.base.z + o.z;
      p.meshes.forEach((m, j) => m.position.set(p.meshBase[j].x + o.x, p.meshBase[j].y + o.y, p.meshBase[j].z + o.z));
      p.boxes.forEach((b, j) => { const q = p.boxBase[j]; b.x0 = q.x0 + o.x; b.x1 = q.x1 + o.x; b.y0 = q.y0 + o.y; b.y1 = q.y1 + o.y; b.z0 = q.z0 + o.z; b.z1 = q.z1 + o.z; });
    }
  };
  // carry whoever stands on a moving platform along with it (the game passes the fighters it moves itself)
  A.tickHazards = (fighters) => {
    for (const f of fighters) {
      if (!f.alive || !f.onGround) continue;
      for (const p of movers) {
        if (Math.abs(f.pos.y - p.prev.y) > 0.35 || !A.inPlat({ ...p, x: p.prev.x, z: p.prev.z }, f.pos, 0.2)) continue;
        f.pos.x += p.x - p.prev.x; f.pos.z += p.z - p.prev.z; if (p.y > p.prev.y) f.pos.y = p.y; // (going down, the floor-sticking does it)
        break;
      }
    }
  };
  /** Is a body standing at pos inside a blade? Returns the cut (the blade's plane) or null. */
  const _v = new THREE.Vector3(), _q = new THREE.Vector3();
  A.hazardHit = (pos) => {
    for (const h of hz) {
      if (h.off) continue;
      for (let k = 0; k < 5; k++) {
        _v.set(pos.x, pos.y + 0.25 + k * 0.35, pos.z).sub(h.c);
        const d = _v.dot(h.axis); if (Math.abs(d) > 0.38) continue;
        _q.copy(_v).addScaledVector(h.axis, -d); if (_q.length() > h.R + 0.3) continue;
        return { n: h.axis.clone(), pt: new THREE.Vector3(pos.x, pos.y + 0.25 + k * 0.35, pos.z) };
      }
    }
    return null;
  };
  /** The nearest blade to pos (for bots to steer clear of): { c, dist } or null. */
  A.hazardNear = (pos, range) => {
    let best = null;
    for (const h of hz) { if (h.off) continue; const dist = Math.hypot(h.c.x - pos.x, h.c.z - pos.z) - h.R; if (dist < range && h.c.y - h.R < pos.y + 2.2 && h.c.y + h.R > pos.y && (!best || dist < best.dist)) best = { c: h.c, dist }; }
    return best;
  };
  let last = clock();
  A.anim.push(() => { const t = clock(), dt = Math.min(0.1, t - last); last = t; moveAll(t); for (const h of hz) { h.at(t); h.g.position.copy(h.c); spin(h, h.g, dt); } });
  { const t = clock(); moveAll(t); for (const h of hz) { h.at(t); h.g.position.copy(h.c); } }

  A.finishNav();

  // ---- below: a floor of grinders, rows of toothed rollers turning against each other where the smog was. All round
  // the outside, past where anyone travels: a forest of huge jagged spikes, some leaning in. Touch either and you die.
  {
    const steel = std(0x8a8e98, { metalness: 0.7, roughness: 0.35, emissive: 0x24140e }), hot = std(0x8a3a20, { metalness: 0.6, roughness: 0.4, emissive: 0xff5a1a, emissiveIntensity: 0.55 });
    // one roller segment (10 m along x): a drum with rings of teeth, merged into one geometry
    const parts = [new THREE.CylinderGeometry(4, 4, 22, 16).rotateZ(Math.PI / 2)]; // (big rollers: 8 m across, 22 m long)
    for (let k = 0; k < 6; k++) for (let t = 0; t < 9; t++) { const a = t / 9 * TAU + k * 0.35, g = new THREE.ConeGeometry(1.1, 3, 5); g.translate(0, 5.3, 0); g.rotateX(a); g.translate(-9 + k * 3.6, 0, 0); parts.push(g); }
    const merged = (() => { const P = [], N = []; for (const g of parts) { const ng = g.index ? g.toNonIndexed() : g; P.push(...ng.attributes.position.array); N.push(...ng.attributes.normal.array); } const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); return m; })();
    const GY = -58, rows = [];
    for (let z = -126; z <= 126; z += 10.5) { const half = Math.sqrt(Math.max(0, 135 * 135 - z * z)); for (let x = -half; x < half; x += 22) rows.push([x + 11, z, rows.length % 2]); }
    const rollers = new THREE.InstancedMesh(merged, steel, rows.length), glow = new THREE.Mesh(new THREE.CircleGeometry(136, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff4a12 }));
    glow.position.y = GY - 6; S.add(glow); // white-hot light between the rollers
    rollers.frustumCulled = false; S.add(rollers);
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), ax = new THREE.Vector3(1, 0, 0), pv = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    let spin = 0;
    A.anim.push((t, dt) => { spin += (dt || 0) * 2.2; rows.forEach(([x, z, odd], i) => { q.setFromAxisAngle(ax, (odd ? spin : -spin) * 0.6); mm.compose(pv.set(x, GY, z), q, one); rollers.setMatrixAt(i, mm); }); rollers.instanceMatrix.needsUpdate = true; });
    // the spikes: outside everything you can stand on
    let reach = 0; for (const p of A.plats) reach = Math.max(reach, Math.hypot(p.x, p.z) + Math.max(p.w || 0, p.d || 0) / 2);
    const R0 = reach + 10, spikes = [], cone = new THREE.ConeGeometry(1, 1, 6); cone.translate(0, 0.5, 0);
    const RW = R0 + 34; // a ring wall all round the arena, bristling with spikes that point in at you
    const WH = 92; { const wall = new THREE.Mesh(new THREE.CylinderGeometry(RW + 1, RW + 6, WH, 64, 1, true), std(0x6a4a3e, { metalness: 0.6, roughness: 0.45, emissive: 0x5a1c08, side: THREE.BackSide })); wall.position.y = GY + WH / 2; S.add(wall); } // (rusty plate, lit from the grinders below; open sky above)
    for (let i = 0; i < 300; i++) {
      const a = r() * TAU, y = GY + 4 + r() * (WH - 10), len = 12 + r() * 22, w = 2.2 + r() * 3.2, x = Math.cos(a) * RW, z = Math.sin(a) * RW;
      const dir = new THREE.Vector3(-Math.cos(a) + (r() - 0.5) * 0.35, (r() - 0.5) * 0.5, -Math.sin(a) + (r() - 0.5) * 0.35).normalize(); // inward, a little up or down or sideways
      spikes.push({ x, z, by: y, h: len, w, d: dir });
    }
    const sm = new THREE.InstancedMesh(cone, steel, spikes.length), tips = new THREE.InstancedMesh(cone, hot, spikes.length), up = new THREE.Vector3(0, 1, 0), dv = new THREE.Vector3(), sv = new THREE.Vector3();
    spikes.forEach((s, i) => {
      dv.copy(s.d); q.setFromUnitVectors(up, dv); s.dir = dv.clone();
      mm.compose(pv.set(s.x, s.by, s.z), q, sv.set(s.w, s.h, s.w)); sm.setMatrixAt(i, mm);
      mm.compose(pv.set(s.x, s.by, s.z).addScaledVector(dv, s.h * 0.82), q, sv.set(s.w * 0.18, s.h * 0.18, s.w * 0.18)); tips.setMatrixAt(i, mm); // glowing tips
    });
    S.add(sm, tips);
    A.killAt = (p) => { // a spike, anywhere along it; below that, the grinders take you at the old smog line
      if (Math.hypot(p.x, p.z) < R0 - 6) return A.killY;
      for (const s of spikes) { const rx = p.x - s.x, ry = p.y - s.by, rz = p.z - s.z, along = rx * s.dir.x + ry * s.dir.y + rz * s.dir.z;
        if (along < 0 || along > s.h) continue; const px = rx - s.dir.x * along, py = ry - s.dir.y * along, pz = rz - s.dir.z * along;
        if (Math.hypot(px, py, pz) < s.w * (1 - along / s.h) + 0.3) return Infinity; }
      return A.killY;
    };
    A.chomp = () => {}; // (a death down here still sprays blood)
    A.fallText = (p) => (p.y > A.killY + 1 ? 'was impaled on the spikes' : 'was ground up'); A.fallBy = (p) => (p.y > A.killY + 1 ? 'Impaled on the spikes' : 'Ground up');
  }
  // ---- backdrop: smokestacks glowing at the base, a haze of embers, a sea of smog below
  farRing(A, 20, 330, (x, z, i) => {
    const h = 90 + (i % 4) * 30, m = new THREE.Mesh(new THREE.CylinderGeometry(6 + (i % 3) * 2, 10 + (i % 3) * 3, h, 10), new THREE.MeshBasicMaterial({ color: 0x2a1e22, fog: false }));
    m.position.set(x, -60 + h / 2, z); S.add(m);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(7 + (i % 3) * 2, 7 + (i % 3) * 2, 3, 10), new THREE.MeshBasicMaterial({ color: 0xff7a2a, fog: false })); glow.position.set(x, -60 + h - 2, z); S.add(glow);
  });
  const sea = new THREE.Mesh(new THREE.CircleGeometry(620, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2a100a, transparent: true, opacity: 0.95 })); sea.position.y = -55; S.add(sea);
  drift(A, 380, 0xffa040, 0.12, [0.4, 1.2, 0.3], 0.5);
  void r;
}
