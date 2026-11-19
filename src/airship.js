// Sky Duel: two great airship planes racing side by side above the clouds, weaving round each other in a slow double
// helix: they swap sides, and each time they cross one passes right over the other. Red crews one, blue the other.
// Fight along the decks and out on the wings, jump or swing across when they close, hook the gas pods and the keel rail
// slung underneath to swing below a ship, and come back up over a wing.
//
// The ships don't travel through the world (the clouds stream past instead, like the Bullet Train's landscape); they
// only move against each other, a few metres a second, banking and pitching as they go. Everything about a ship is
// worked out in its own frame (u across, h up, v along, nose at -v): the walkable top is a height function the arena
// reads through a `disc`, and the walls, undersides, hook boxes, riders and ropes are carried here every frame.
import * as THREE from 'three';

const TAU = Math.PI * 2, std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const W = (2 * Math.PI) / 36, DX = 20, DY = 6.5, STREAM = 38; // one full weave every 36 s; how far apart they swing; the clouds' speed
const TEAM = [['A', 0xc23a32, 0x7a1c18], ['B', 0x2f6fd0, 0x163a78]]; // red ship, blue ship (cloth, paint)

// ---- the shape of a ship's top, in its own frame: the height you stand at over (u, v), or -1e9 where there is none
const hullHalf = (v) => (v < -21 || v > 20 ? -1 : v < -16 ? 3 * (v + 21) / 5 : v > 17 ? 3 - (v - 17) * 0.27 : 3);
const wingV0 = (au) => -6 + (au - 3) * 0.125, wingV1 = (au) => 3.5 - (au - 3) * 0.083; // (the wing tapers toward its tip)
const wingTop = (au) => -0.3 + (au - 3) * 0.05; // (and rises a little: dihedral)
function top(u, v) {
  const au = Math.abs(u);
  if (au <= 2 && v >= 13.5 && v <= 19.5) return 2.2; // the sterncastle's roof
  if (au <= hullHalf(v)) return 0; // the deck
  if (au > 3 && au <= 15.2 && v >= wingV0(au) && v <= wingV1(au)) return wingTop(au); // a wing
  return -1e9;
}
// solid parts, for walls and undersides: [u0, u1, h0, h1, v0, v1, slab]. A slab (a wing) only stops you from below: come at
// its edge and you climb onto it instead.
const SOLIDS = [
  [-3, 3, -1.6, 0, -16, 20], [-1.5, 1.5, -1.6, 0, -20, -16], [-2.2, 2.2, -3.2, -1.6, -15, 18], // hull: upper, nose, lower
  [-2, 2, 0, 2.2, 13.5, 19.5], // sterncastle
  [-2.2, -1.9, 2.2, 5.2, 15, 19.8], [1.9, 2.2, 2.2, 5.2, 15, 19.8], // twin fins
  [-9.4, -7.6, -3.6, -1.5, -7, 4], [7.6, 9.4, -3.6, -1.5, -7, 4], // gas pods under the wings
];
for (const s of [-1, 1]) for (let j = 0; j < 3; j++) { const a = 3 + j * 4.07, b = a + 4.07, m = (a + b) / 2, t = wingTop(m); SOLIDS.push([s < 0 ? -b : a, s < 0 ? -a : b, t - 0.7, t, wingV0(m), wingV1(m), true]); }
// what a grapple can bite: the solid parts and the keel rail. Wherever it bites below the deck, the rope is led round an
// open edge and brings you up on top (see shipHook)
const HOOKS = [...SOLIDS.slice(1).map((s) => s.slice(0, 6)), [-0.25, 0.25, -4.1, -3.8, -12, 12]];
for (const [v0, v1] of [[-16, -6.5], [-6.5, 3.5], [3.5, 12], [12, 20]]) HOOKS.push([-3, 3, -1.6, 0, v0, v1]); // (the long hull in pieces, so its box hugs it as the ship pitches)
// the open edges of a ship's top, where a rope can lead you up and over: [u, v, outward nu, nv, height of the top just inside].
// Not the wings' leading edges in front of the propellers, nor where a gas pod pokes out behind, nor beside the sterncastle.
const EDGES = [];
for (const s of [-1, 1]) {
  for (let au = 3.5; au <= 14.3; au += 0.5) { if (au < 4.6 || au > 12.4) EDGES.push([s * au, wingV0(au), 0, -1]); if (au < 6.6 || au > 10.4) EDGES.push([s * au, wingV1(au), 0, 1]); }
  for (let v = -3.5; v <= 1.6; v += 0.5) EDGES.push([s * 15.2, v, s, 0]); // (not the corners: easy to miss)
  for (let v = -19; v <= 13; v += 0.5) if (v < -6.6 || v > 4.1) EDGES.push([s * hullHalf(v), v, s, 0]);
}
for (let i = EDGES.length - 1; i >= 0; i--) { const e = EDGES[i]; e[4] = top(e[0] - e[2] * 0.7, e[1] - e[3] * 0.7); if (e[4] < -1e8) EDGES.splice(i, 1); }
const edgeIn = (u, v) => { const au = Math.abs(u); return Math.min(v - wingV0(au), wingV1(au) - v, 15.2 - au); }; // how far inside a wing's open edges
const PROP = [8.5, -2.55, -8.05, 2.35]; // a propeller: across, up, along, radius (one each side)

// ---- where a ship is at wall-clock time t (the same on every machine): s = +1 for the red ship, -1 for the blue
function poseAt(s, t, o = {}) {
  const f = W * t, c = Math.cos(f), n = Math.sin(f);
  o.x = s * DX * c; o.y = s * DY * n; o.z = s * 7 * Math.sin(0.61 * f + 1);
  const roll = s * 0.15 * c + 0.02 * Math.sin(1.7 * f + s), pitch = s * 0.05 * c + 0.012 * Math.sin(2.3 * f); // banks toward the middle as it swings in, noses up as it climbs
  o.roll = roll; o.pitch = pitch; o.sr = Math.sin(roll); o.cr = Math.cos(roll); o.sp = Math.sin(pitch); o.cp = Math.cos(pitch);
  return o;
}
const toLocal = (P, x, y, z, o) => { const dx = x - P.x, dy = y - P.y, dz = z - P.z, y1 = dy * P.cp + dz * P.sp; o.v = -dy * P.sp + dz * P.cp; o.u = dx * P.cr + y1 * P.sr; o.h = -dx * P.sr + y1 * P.cr; return o; };
const toWorld = (P, u, h, v, o) => { const y1 = u * P.sr + h * P.cr; o.x = P.x + u * P.cr - h * P.sr; o.y = P.y + y1 * P.cp - v * P.sp; o.z = P.z + y1 * P.sp + v * P.cp; return o; };
/** The top of the ship under world (x, z), as a world height (-1e9 off the ship). */
function heightAt(P, x, z) {
  const dx = x - P.x, dz = z - P.z; let h = 0, u = 0, v = 0, y1 = 0;
  for (let i = 0; i < 3; i++) { u = (dx + h * P.sr) / P.cr; y1 = u * P.sr + h * P.cr; v = (dz - y1 * P.sp) / P.cp; const t = top(u, v); if (t < -1e8) { if (i) break; return -1e9; } h = t; }
  if (top(u, v) < -1e8) return -1e9;
  return P.y + y1 * P.cp - v * P.sp;
}

export function buildAirship(A, T) {
  const S = A.scene, r = T.rng(7373), low = A.quality === 'low', wall = () => Date.now() / 1000;
  A.plats = []; A.pillars = []; A.arcPts = []; A.killY = -55; A.shipMap = true;
  A.setSky({ top: 0x2a66c8, mid: 0xa8d4f6, bot: 0xeaf4fc, fog: 0xd4e8f8, near: 110, far: 470, hemiSky: 0xf0f8ff, hemiGround: 0x9ab0c8, hemi: 1.15, sunColor: 0xfff0d0, sun: 2.4, sunOff: new THREE.Vector3(-38, 70, 26) });
  A.fallText = () => 'fell out of the sky'; A.fallBy = () => 'You fell out of the sky';

  // ---- materials
  const deckM = A.mats.wood, hullM = std(0x6e4c34, { map: A.mats.wood.map, roughness: 0.75 }), darkM = std(0x2c2420, { roughness: 0.7 });
  const brass = std(0xd0a24a, { metalness: 0.85, roughness: 0.3 }), glass = new THREE.MeshBasicMaterial({ color: 0xffe2a0 }), blur = new THREE.MeshBasicMaterial({ color: 0xe8eef4, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  const cloth = (col) => std(0xffffff, { roughness: 0.9, map: T.canvasTex((g, s) => { g.fillStyle = '#' + col.toString(16).padStart(6, '0'); g.fillRect(0, 0, s, s); // doped canvas over ribs, a pale band along it
    for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(i * s / 8, 0, 3, s); g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(i * s / 8 + 3, 0, 5, s); }
    g.fillStyle = 'rgba(255,240,210,0.85)'; g.fillRect(0, s * 0.44, s, s * 0.1); T.speckle(g, s, T.rng(col), 1500, 0.12); }) });
  const flat = (pts, depth) => { const sh = new THREE.Shape(); pts.forEach(([u, v], i) => (i ? sh.lineTo(u, v) : sh.moveTo(u, v))); const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); g.rotateX(Math.PI / 2); return g; }; // (an outline in (u, v), its top at h = 0, `depth` thick)
  const uvFlat = (g, k) => { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * k, p.getZ(i) * k); return g; };
  const OUT = [[0, -21], [1.5, -19.2], [3, -16], [3, 17], [2.2, 20], [-2.2, 20], [-3, 17], [-3, -16], [-1.5, -19.2]];
  const hullG = uvFlat(flat(OUT, 1.6), 0.22), keelG = uvFlat(flat(OUT.map(([u, v]) => [u * 0.73, v * 0.88 + 0.8]), 1.6), 0.22), deckG = uvFlat(flat(OUT.map(([u, v]) => [u * 0.94, v * 0.985]), 0.06), 0.3);
  const wingG = (s) => uvFlat(flat([[0, -6], [12, -4.5], [12.45, -1], [12, 2.5], [0, 3.5]].map(([u, v]) => [u * s, v]), 0.7), 0.125);
  const podG = new THREE.SphereGeometry(1, 20, 14).scale(1.15, 1.15, 6.2), bladeG = new THREE.BoxGeometry(0.34, 2.3, 0.07).translate(0, 1.15, 0), discG = new THREE.CircleGeometry(2.35, 28);
  const ringG = new THREE.RingGeometry(2.08, 2.35, 36), warn = new THREE.MeshBasicMaterial({ color: 0xff3418, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });

  // ---- build a ship
  const ships = TEAM.map(([team, col, paint], k) => {
    const g = new THREE.Group(); S.add(g);
    const add = (geo, mat, x = 0, y = 0, z = 0, sh = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sh; m.receiveShadow = true; g.add(m); return m; };
    const fab = cloth(col), paintM = std(paint, { roughness: 0.55 });
    add(hullG, hullM); add(keelG, paintM, 0, -1.6, 0); add(deckG, deckM, 0, 0.02, 0, false);
    for (const s of [-1, 1]) {
      const w = add(wingG(s), fab, s * 3, -0.3, 0); w.rotation.z = s * 0.05;
      const edge = add(new THREE.CylinderGeometry(0.2, 0.2, 12.1, 8), brass, s * 9, -0.35, -5.2); edge.rotation.set(0, -s * 0.125, Math.PI / 2 + s * 0.05); // (a brass leading edge)
      add(new THREE.BoxGeometry(0.16, 0.5, 33), brass, s * 3.02, -0.2, 0.5, false); // gunwale strip
      // a gas pod slung under the wing on two struts, a propeller on its nose
      add(podG, fab, s * 8.5, -2.55, -1.5); add(new THREE.SphereGeometry(1.19, 16, 10).scale(1, 1, 0.5), brass, s * 8.5, -2.55, -7.3);
      for (const v of [-4, 1]) add(new THREE.BoxGeometry(0.22, 1.3, 0.9), darkM, s * 8.5, -0.95, v);
      for (const y of [-1.42, -3.68]) add(new THREE.BoxGeometry(0.1, 0.06, 11.5), brass, s * 8.5, y, -1.5, false);
      // twin fins on the sterncastle, a flag on each
      add(new THREE.BoxGeometry(0.3, 3, 4.8), fab, s * 2.05, 3.7, 17.4); add(new THREE.BoxGeometry(0.34, 0.22, 4.9), brass, s * 2.05, 5.25, 17.4, false);
      add(new THREE.BoxGeometry(0.06, 0.9, 1.5), paintM, s * 2.05, 5.75, 19.2);
      for (const v of [-13, -3, 7]) add(new THREE.BoxGeometry(0.34, 0.34, 0.5), glass, s * 2.96, -0.8, v, false); // lamps along the hull
    }
    const props = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * PROP[0], PROP[1], PROP[2]); g.add(p); p.add(new THREE.Mesh(ringG, warn)); // (a red rim on the blur: these kill)
      for (let b = 0; b < 3; b++) { const m = new THREE.Mesh(bladeG, darkM); m.rotation.z = b * TAU / 3; m.castShadow = true; p.add(m); }
      p.add(new THREE.Mesh(discG, blur)); p.add(new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 10).rotateX(-Math.PI / 2), brass)); return p; });
    // the sterncastle (lit windows), the keel rail on its struts, a bowsprit and its lantern, crates on the deck
    add(new THREE.BoxGeometry(4, 2.2, 6), hullM, 0, 1.1, 16.5); add(new THREE.BoxGeometry(4.3, 0.14, 6.3), deckM, 0, 2.13, 16.5, false);
    for (const u of [-1.1, 0, 1.1]) add(new THREE.BoxGeometry(0.7, 0.8, 0.08), glass, u, 1.25, 13.47, false);
    for (const s of [-1, 1]) for (const v of [15, 18]) add(new THREE.BoxGeometry(0.08, 0.7, 0.9), glass, s * 2.01, 1.25, v, false);
    const rail = add(new THREE.CylinderGeometry(0.13, 0.13, 24, 8), brass, 0, -3.95, 0); rail.rotation.x = Math.PI / 2;
    for (const v of [-11, -4, 4, 11]) add(new THREE.BoxGeometry(0.14, 0.8, 0.14), brass, 0, -3.55, v, false);
    const sprit = add(new THREE.CylinderGeometry(0.1, 0.16, 5, 8), brass, 0, -0.5, -22.6); sprit.rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(0.34, 10, 8), glass, 0, -0.5, -25.2, false);
    add(new THREE.BoxGeometry(6.02, 0.5, 0.3), brass, 0, -0.2, -16.1, false);

    const ship = { k, s: k ? -1 : 1, team, g, props, cur: poseAt(k ? -1 : 1, wall()), last: null, vis: {}, plats: [], spawns: [], rays: [] };
    ship.last = { ...ship.cur };
    // the walkable top, read by the arena's own ground code (y0: NaN, so it has no flat rim or underside of its own: those are ours)
    ship.disc = { x: 0, z: 0, r: 26, y0: NaN, y1: 0, hf: (x, z) => heightAt(ship.cur, x, z) }; A.discs.push(ship.disc);
    for (const [lu, lv, w, d] of [[0, -1.25, 6, 29.5], [-9.1, -1, 12.2, 7], [9.1, -1, 12.2, 7]]) {
      const p = { kind: 'ship', bank: true, disc: ship.disc, x: 0, z: 0, y: 0, w, d, ang: 0, i: A.plats.length, meshes: [], boxes: [], ramps: [], rays: [], lu, lv, ship: k };
      A.plats.push(p); p.node = A.node('P' + p.i, 0, 0, 0); p.node.plat = p.i; ship.plats.push(p);
    }
    A.link('P' + ship.plats[0].i, 'P' + ship.plats[1].i); A.link('P' + ship.plats[0].i, 'P' + ship.plats[2].i);
    for (const [lu, lv, pi] of [[0, -12, 0], [0, -4, 0], [0, 4, 0], [0, 10.5, 0], [-8, -1, 1], [-12, -1, 1], [8, -1, 2], [12, -1, 2]]) {
      const sp = new THREE.Vector3(); sp.plat = ship.plats[pi].i; sp.team = team; sp.lu = lu; sp.lv = lv; A.spawns.push(sp); ship.spawns.push(sp);
    }
    for (const b of HOOKS) { const q = { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0, under: !!b[6], loc: b }; A.rayBoxes.push(q); ship.rays.push(q); }
    return ship;
  });
  A.ships = ships;

  // ---- put a ship where it is now: its hook boxes, surfaces, waypoints and spawn spots
  const _w = { x: 0, y: 0, z: 0 }, _l = { u: 0, h: 0, v: 0 };
  const place = (ship, t) => {
    const P = poseAt(ship.s, t, ship.cur);
    ship.disc.x = P.x; ship.disc.z = P.z; ship.disc.y1 = P.y + 3;
    for (const q of ship.rays) { const b = q.loc; q.x0 = q.y0 = q.z0 = Infinity; q.x1 = q.y1 = q.z1 = -Infinity;
      for (let c = 0; c < 8; c++) { toWorld(P, b[c & 1], b[2 + (c >> 1 & 1)], b[4 + (c >> 2)], _w); q.x0 = Math.min(q.x0, _w.x); q.x1 = Math.max(q.x1, _w.x); q.y0 = Math.min(q.y0, _w.y); q.y1 = Math.max(q.y1, _w.y); q.z0 = Math.min(q.z0, _w.z); q.z1 = Math.max(q.z1, _w.z); } }
    for (const p of ship.plats) { toWorld(P, p.lu, top(p.lu, p.lv), p.lv, _w); p.x = _w.x; p.y = _w.y; p.z = _w.z; p.node.p.set(_w.x, _w.y, _w.z); }
    for (const sp of ship.spawns) { toWorld(P, sp.lu, top(sp.lu, sp.lv) + 0.15, sp.lv, _w); sp.set(_w.x, _w.y, _w.z); }
  };
  const draw = (ship, P, t) => { ship.g.position.set(P.x, P.y, P.z); ship.g.rotation.set(P.pitch, 0, P.roll); for (const p of ship.props) p.rotation.z = t * 31 * (p.position.x < 0 ? 1 : -1); };
  for (const ship of ships) { place(ship, wall()); draw(ship, ship.cur, 0); }

  // ---- each frame of play: carry whoever stands on a ship (and any rope hooked to one) along with it, then keep
  // bodies out of its hull, pods and fins, and from rising up through its wings
  const riding = (f, ship, P) => { toLocal(P, f.pos.x, f.pos.y, f.pos.z, _l); const t = top(_l.u, _l.v); return t > -1e8 && Math.abs(_l.h - t) < 0.9; };
  const carry = (ship, v) => { toLocal(ship.last, v.x, v.y, v.z, _l); toWorld(ship.cur, _l.u, _l.h, _l.v, _w); v.x = _w.x; v.y = _w.y; v.z = _w.z; };
  // a hook that bites a ship anywhere below its deck (a wing's underside, a gas pod, the belly, the keel rail, the hull's
  // side) is led round the open edge that makes the shortest way up: you swing out from under, and it lifts you onto the top
  A.shipHook = (f, pt) => {
    for (const ship of ships) {
      const P = ship.cur; toLocal(P, pt.x, pt.y, pt.z, _l); const pu = _l.u, ph = _l.h, pv = _l.v;
      if (Math.abs(pu) > 17.5 || pv < -27 || pv > 22.5 || ph < -7.5 || ph > 7.5) continue; // (generous: a hook box is squared off round the banking ship)
      const tp = top(pu, pv); if (ph > 0.25 || (tp > -1e8 && ph > tp - 0.3)) return null; // bit the top, the sterncastle or a fin: it holds where it bit
      toLocal(P, f.pos.x, f.pos.y + 1.3, f.pos.z, _l); const fu = _l.u, fh = _l.h, fv = _l.v;
      let e = null, bc = 1e9;
      for (const c of EDGES) { let d = Math.hypot(fu - c[0], fh - c[4], fv - c[1]) + 0.6 * Math.hypot(pu - c[0], ph - c[4], pv - c[1]);
        const k = (PROP[2] - fv) / (c[1] + c[3] * 1.1 - fv); if (k > -0.1 && k < 1.1 && Math.hypot(Math.abs(fu + (c[0] - fu) * k) - PROP[0], fh - 1.3 + (c[4] - 1.7 - fh) * k - PROP[1]) < PROP[3] + 2.2) d += 40; // (never a way that leads through a propeller)
        if (d < bc) { bc = d; e = c; } }
      const V = (u, h, v) => { toWorld(P, u, h, v, _w); return new THREE.Vector3(_w.x, _w.y, _w.z); };
      const out = { p: V(e[0] - e[2] * 0.7, e[4] + 0.05, e[1] - e[3] * 0.7), via: fh < e[4] - 0.6 ? V(e[0] + e[2] * 1.1, e[4] - 1.3, e[1] + e[3] * 1.1) : null, aim: V(e[0] - e[2] * 3, e[4], e[1] - e[3] * 3) };
      out.aim.ship = ship; return out; // (aim: the way in over the edge, for the last heave onto the top)
    }
    return null;
  };
  // the propellers: a body that meets a spinning disc is cut across, along the disc's plane
  A.hazText = 'was minced by a propeller'; A.hazBy = 'Minced by a propeller';
  A.hazardHit = (pos) => {
    for (const ship of ships) {
      const P = ship.cur; toLocal(P, pos.x, pos.y, pos.z, _l);
      if (Math.abs(_l.v - PROP[2]) > 0.65) continue;
      const du = Math.abs(_l.u) - PROP[0], ch = Math.max(_l.h + 0.1, Math.min(PROP[1], _l.h + 1.75)), dh = ch - PROP[1];
      if (du * du + dh * dh < (PROP[3] + 0.2) ** 2) return { n: new THREE.Vector3(0, -P.sp, P.cp), pt: new THREE.Vector3(pos.x, pos.y + ch - _l.h, pos.z) };
    }
    return null;
  };
  A.tickTilt = (fighters, mine, dt) => {
    dt = Math.min(0.05, dt || 0); if (!dt) return;
    const t = wall(); for (const ship of ships) { place(ship, t); ship.vx = (ship.cur.x - ship.last.x) / dt; ship.vz = (ship.cur.z - ship.last.z) / dt; }
    for (const f of fighters) {
      if (!f.alive || !mine(f)) continue;
      const hk = f.hook && !f.hook.enemy ? f.hook : null;
      if (hk && hk.ship === undefined) { hk.ship = -1; for (const ship of ships) { toLocal(ship.last, hk.p.x, hk.p.y, hk.p.z, _l); if (Math.abs(_l.u) < 16.5 && _l.v > -26 && _l.v < 21.5 && _l.h > -5.2 && _l.h < 7.5) hk.ship = ship.k; } }
      for (const ship of ships) {
        const P = ship.cur, L = ship.last;
        if (hk && hk.ship === ship.k) { carry(ship, hk.p); if (hk.via) carry(ship, hk.via); if (hk.aim) carry(ship, hk.aim); }
        if ((f.pos.x - L.x) ** 2 + (f.pos.z - L.z) ** 2 > 900 || Math.abs(f.pos.y - L.y) > 16) { if (f.onShip === ship) f.onShip = null; continue; }
        if ((f.onGround || f.dashT > 0) && riding(f, ship, L)) { // planted on the deck (or dashing along it): moved with it, feet kept on it as it banks
          carry(ship, f.pos); if (f.onGround) { const h = heightAt(P, f.pos.x, f.pos.z); if (h > -1e8) f.pos.y = h; } f.onShip = ship;
        } else if (f.onShip === ship) { f.vel.x += (P.x - L.x) / dt; f.vel.z += (P.z - L.z) / dt; f.onShip = null; } // (jumped off: keep the ship's speed)
        // walls and undersides
        toLocal(P, f.pos.x, f.pos.y, f.pos.z, _l); let u = _l.u, h = _l.h, v = _l.v, hit = 0, pu = 0, pv = 0;
        if (Math.abs(u) > 17 || v < -22.5 || v > 21.5 || h > 6.5 || h < -6) continue;
        for (const b of SOLIDS) {
          if (h >= b[3] - 0.5 || h + 1.7 <= b[2] - 0.15) continue; // standing on it (or stepping up), or well below it
          const cu = Math.max(b[0], Math.min(u, b[1])), cv = Math.max(b[4], Math.min(v, b[5])), du = u - cu, dv = v - cv, d2 = du * du + dv * dv;
          if (d2 >= 0.16) continue;
          if (h + 1.7 < b[2] + 0.8) { if (d2 < 1e-9 || b[6]) { if (d2 < 1e-9 && !(b[6] && edgeIn(u, v) < ((f.hook && f.hook.aim) || f.mantle ? 2.6 : 1.3))) { h = b[2] - 1.86; hit |= 2; } continue; } } // head against its underside: held below it (but a wing's open rim lets you up: that is where a rope brings you over)
          if (b[6]) continue;
          if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (0.4 - d) / d; u += du * k; v += dv * k; pu = du; pv = dv; }
          else { const o = [u - b[0], b[1] - u, v - b[4], b[5] - v], i = o.indexOf(Math.min(...o)); if (i === 0) { u = b[0] - 0.4; pu = -1; } else if (i === 1) { u = b[1] + 0.4; pu = 1; } else if (i === 2) { v = b[4] - 0.4; pv = -1; } else { v = b[5] + 0.4; pv = 1; } }
          hit |= 1;
        }
        if (!hit) continue;
        toWorld(P, u, h, v, _w); f.pos.set(_w.x, _w.y, _w.z);
        const vx = (P.x - L.x) / dt, vz = (P.z - L.z) / dt;
        if (hit & 2 && f.vel.y > 0) f.vel.y = 0;
        if (pu && (f.vel.x - vx) * pu < 0) f.vel.x = vx;
        if (pv && (f.vel.z - vz) * pv < 0) f.vel.z = vz;
      }
    }
    for (const ship of ships) Object.assign(ship.last, ship.cur);
  };

  // ---- the sky streaming past: a floor of cloud far below, banks of cloud at every height, and rock islands
  const sea = new THREE.Mesh(new THREE.CircleGeometry(520, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe6f1fa })); sea.position.y = -70; S.add(sea);
  const NC = low ? 46 : 80, PER = 6, puffs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 9), new THREE.MeshLambertMaterial({ color: 0xf4f8fc, emissive: 0x8fa6c0, emissiveIntensity: 0.5 }), NC * PER);
  puffs.frustumCulled = false; S.add(puffs);
  const clouds = [];
  for (let i = 0; i < NC; i++) {
    const band = r(), y = band < 0.6 ? -66 + r() * 22 : band < 0.85 ? -34 + r() * 20 : 26 + r() * 50, side = r() < 0.5 ? -1 : 1;
    const x = y < -40 ? (r() - 0.5) * 520 : side * (y < 0 ? 46 + r() * 190 : 58 + r() * 200), sz = (y < -40 ? 13 : 9) + r() * 12; // (nothing drifts through the ships themselves)
    const c = { x, y, z: (r() - 0.5) * 960, p: [] };
    for (let j = 0; j < PER; j++) c.p.push([(r() - 0.5) * sz * 2.6, (r() - 0.3) * sz * 0.5, (r() - 0.5) * sz * 3.4, sz * (0.55 + r() * 0.6)]);
    clouds.push(c);
  }
  const isles = [];
  { const rock = std(0x7a7480, { roughness: 1, flatShading: true }), grass = std(0x6f9a52, { roughness: 1, flatShading: true });
    for (let i = 0; i < (low ? 4 : 7); i++) {
      const g = new THREE.Group(), R = 14 + r() * 16, side = i % 2 ? -1 : 1;
      const base = new THREE.Mesh(new THREE.ConeGeometry(R, R * 1.7, 7), rock); base.rotation.x = Math.PI; base.position.y = -R * 0.85; g.add(base);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.96, R, 2.2, 7), grass); cap.position.y = 1; g.add(cap);
      for (let j = 0; j < 4; j++) { const tr = new THREE.Mesh(new THREE.ConeGeometry(2 + r() * 2, 7 + r() * 6, 6), std(0x3f6a3a, { flatShading: true })); tr.position.set((r() - 0.5) * R, 6, (r() - 0.5) * R); g.add(tr); }
      g.position.set(side * (95 + r() * 150), -48 + r() * 50, 0); g.userData.z = (i / 7) * 960 + r() * 60; S.add(g); isles.push(g);
    }
  }
  const mtx = puffs.instanceMatrix.array, wrap = (z) => ((z % 960) + 960) % 960 - 480;
  A.anim.push((t) => {
    const now = wall(), rt = A.replayAt != null ? A.replayAt + now - performance.now() / 1000 : now; // (a replay shows the ships where they were then)
    for (const ship of ships) { place(ship, now); draw(ship, A.replayAt != null ? poseAt(ship.s, rt, ship.vis) : ship.cur, now); }
    const sh = now * STREAM; let o = 0;
    for (const c of clouds) { const z = wrap(c.z + sh); for (const p of c.p) { mtx[o] = p[3]; mtx[o + 5] = p[3] * 0.36; mtx[o + 10] = p[3]; mtx[o + 12] = c.x + p[0]; mtx[o + 13] = c.y + p[1]; mtx[o + 14] = z + p[2]; mtx[o + 15] = 1; o += 16; } }
    puffs.instanceMatrix.needsUpdate = true;
    for (const g of isles) g.position.z = wrap(g.userData.z + sh);
    void t;
  });

  A.finishNav();
}
