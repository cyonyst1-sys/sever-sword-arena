// Swinging Decks: a fairground swing ride in the sky. A tall mast in the middle with a striped crown on top that turns,
// and six big round platforms hanging from the ends of its arms on chains, swinging out as it spins (further out the
// faster it goes; it speeds up and slows down). Land on one and it gets a shove that it swings off and settles from.
// Whoever stands on a platform rides along with it. Cut a platform's chain and it flies off, out and away, with
// whoever is on it; a new one is hung back on 10 s later.
import * as THREE from 'three';
import { drift } from './maps2.js';
import { cloudHeaps } from './scenery.js?v=20261116031623';

const TAU = Math.PI * 2, N = 6, R = 14, DISH = 1.9, ARM = 25, L = 22, HUB = 40, MAXOFF = 2; // platforms, radius, dish depth, crown arm, chain, crown height, extra swing
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });
// how far the crown has turned at wall-clock time t (the same on every player's screen), how fast it's turning, and how
// far out the platforms swing: it speeds up and slows down over a minute, swinging further out when it's faster
const W0 = 0.24, W1 = 0.08, PER = 60;
const spin = (t) => W0 * t + W1 * PER / TAU * Math.sin(TAU * t / PER), rate = (t) => W0 + W1 * Math.cos(TAU * t / PER);
const lean = (w) => 0.26 + (w - (W0 - W1)) / (2 * W1) * 0.36; // radians out from straight down: about 15° to 36°

export function buildTilt(A, T) {
  const S = A.scene, r = T.rng(8181);
  A.plats = []; A.pillars = []; A.arcPts = []; A.killY = -40;
  A.setSky({ top: 0x3d6a9a, mid: 0xc9d8e6, bot: 0xe8eef4, fog: 0xc4d4e2, near: 90, far: 380, hemiSky: 0xeef4ff, hemiGround: 0x5a5a6a, hemi: 1.1, sunColor: 0xfff2dc, sun: 2.4, sunOff: new THREE.Vector3(35, 60, 25) });
  const planks = std(0xffffff, { map: T.canvasTex((g, s) => {
    for (let i = 0; i < 8; i++) { const c = 120 + Math.random() * 40 | 0; g.fillStyle = `rgb(${c},${c * 0.72 | 0},${c * 0.45 | 0})`; g.fillRect(0, i * s / 8, s, s / 8 - 2); g.fillStyle = 'rgba(40,24,10,0.6)'; g.fillRect(0, (i + 1) * s / 8 - 2, s, 2); }
    for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(50,30,14,0.25)'; g.fillRect(Math.random() * s, Math.random() * s, 8 + Math.random() * 30, 1); }
  }), roughness: 0.85 });
  const iron = std(0x2c2e34, { metalness: 0.7, roughness: 0.35 }), brass = std(0xc79a3a, { metalness: 0.8, roughness: 0.3 });
  const up = new THREE.Vector3(0, 1, 0), wall = () => Date.now() / 1000;

  // ---- the mast and its turning crown (red and cream stripes, gold trim, bulbs round the rim)
  { const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, HUB + 60, 16), iron); mast.position.y = (HUB - 60) / 2; mast.castShadow = true; S.add(mast);
    A.rayBoxes.push({ x0: -1.6, x1: 1.6, y0: -60, y1: HUB, z0: -1.6, z1: 1.6 }); A.pillars.push({ x: 0, z: 0, w: 3.2 });
    for (const y of [4, 14, 24]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.18, 8, 24), brass); ring.rotation.x = Math.PI / 2; ring.position.y = y; S.add(ring); } }
  const crown = new THREE.Group(); crown.position.y = HUB; S.add(crown);
  { const stripes = T.canvasTex((g, s) => { for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#f2e6cc' : '#c8322a'; g.fillRect(i * s / 16, 0, s / 16, s); } }, 256);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(ARM + 2, 9, 32, 1, true), std(0xffffff, { map: stripes, side: THREE.DoubleSide, roughness: 0.6 })); roof.position.y = 5.5; roof.castShadow = true; crown.add(roof);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(ARM + 2, ARM + 2, 1.6, 32, 1, true), std(0xffffff, { map: stripes, side: THREE.DoubleSide })); skirt.position.y = 0.6; crown.add(skirt);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(ARM + 2, 0.2, 8, 64), brass); trim.rotation.x = Math.PI / 2; trim.position.y = -0.2; crown.add(trim);
    const flag = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3, 8), brass); flag.position.y = 11.5; crown.add(flag);
    const bulb = new THREE.MeshBasicMaterial({ color: 0xfff1b0, toneMapped: false });
    for (let k = 0; k < 32; k++) { const a = k / 32 * TAU, b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), bulb); b.position.set(Math.cos(a) * (ARM + 2.2), 0.6, Math.sin(a) * (ARM + 2.2)); crown.add(b); }
    for (let k = 0; k < N; k++) { const a = k / N * TAU, arm = new THREE.Mesh(new THREE.BoxGeometry(ARM, 0.5, 0.5), iron); arm.position.set(Math.cos(a) * ARM / 2, -0.4, Math.sin(a) * ARM / 2); arm.rotation.y = -a; crown.add(arm); }
    A.rayBoxes.push({ x0: -6, x1: 6, y0: HUB - 1, y1: HUB + 4, z0: -6, z1: 6 }); } // (the crown's hub: hook it)

  // ---- the platforms: big round dishes, each on one chain from the end of an arm
  const dishGeo = (() => { const D = DISH, prof = [];
    for (let k = 0; k <= 10; k++) { const u = k / 10; prof.push(new THREE.Vector2(Math.max(0.01, u * R), D * u * u)); }
    prof.push(new THREE.Vector2(R + 0.25, D + 0.05), new THREE.Vector2(R + 0.3, D - 0.3));
    for (let k = 10; k >= 0; k--) { const u = k / 10; prof.push(new THREE.Vector2(Math.max(0.01, u * (R + 0.1)), D * u * u - 0.5 - (1 - u) * 0.25)); }
    const g = new THREE.LatheGeometry(prof, 56), uv = g.attributes.uv, ps = g.attributes.position;
    for (let i = 0; i < ps.count; i++) uv.setXY(i, ps.getX(i) / 7, ps.getZ(i) / 7); return g; })();
  const plankD = planks.clone(); plankD.side = THREE.DoubleSide; plankD.shadowSide = THREE.FrontSide; // (so the dish doesn't shadow its own top)
  const decks = [];
  for (let k = 0; k < N; k++) {
    const p = { kind: 'swing', bank: true, x: 0, z: 0, y: 0, w: 2 * R, d: 2 * R, ang: 0, round: R, dish: DISH, i: A.plats.length, meshes: [], boxes: [], ramps: [], rays: [], slot: k };
    A.plats.push(p); p.node = A.node('P' + p.i, 0, 0, 0); p.node.plat = p.i;
    p.spawns = [0, 1].map((j) => { const sp = new THREE.Vector3(); sp.plat = p.i; sp.off = j ? -3 : 3; A.spawns.push(sp); return sp; });
    p.disc = { x: 0, z: 0, r: R, y0: -0.8, y1: 0, dish: DISH }; A.discs.push(p.disc); p.discs = [p.disc];
    p.ca = 1; p.sa = 0; p.tb = 0; p.cb = 1; // (the way out from the middle, and the bank: tan and cos of the tilt)
    p.disc.hf = (x, z) => { // banked: the outer edge higher, like a swing ride's seat; the dish curves up to the rim
      const dx = x - p.x, dz = z - p.z, u = dx * p.ca + dz * p.sa, v = -dx * p.sa + dz * p.ca, s = u / p.cb, d2 = (s * s + v * v) / (R * R);
      return d2 > 1.02 ? -1e9 : p.y + u * p.tb + DISH * Math.min(1, d2) / p.cb;
    };
    p.ray = { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 }; A.rayBoxes.push(p.ray); p.rays.push(p.ray);
    p.off = { x: 0, z: 0 }; p.vel = { x: 0, z: 0 }; p.prev = { x: 0, y: 0, z: 0 }; p.riders = new Set();
    const g = new THREE.Group(); S.add(g); p.meshes.push(g); p.group = g;
    const m = new THREE.Mesh(dishGeo, plankD); m.castShadow = m.receiveShadow = true; g.add(m);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.27, 0.15, 6, 56), brass); rim.rotation.x = Math.PI / 2; rim.position.y = DISH; g.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 0.35, 16), brass); hub.position.y = 0.14; g.add(hub); // where the chain is fixed
    const cm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 6), iron); S.add(cm); p.meshes.push(cm);
    p.chains = [{ m: cm }]; p.pivot = new THREE.Vector3();
    decks.push(p);
  }
  for (let k = 0; k < N; k++) A.link('P' + decks[k].i, 'P' + decks[(k + 1) % N].i, 'swing'); // (neighbours: jump or swing across)

  // ---- pillars round the outside (beyond the platforms' sweep) to swing from
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * TAU + TAU / 20, rr = 62 + (k % 2) * 6, x = Math.cos(a) * rr, z = Math.sin(a) * rr, top = 22 + (k % 3) * 7;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, top + 50, 10), iron); p.position.set(x, (top - 50) / 2, z); p.castShadow = true; S.add(p);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), brass); cap.position.set(x, top, z); S.add(cap);
    A.rayBoxes.push({ x0: x - 0.9, x1: x + 0.9, y0: -50, y1: top + 1, z0: z - 0.9, z1: z + 0.9 }); A.pillars.push({ x, z, w: 1.8 });
  }

  // ---- where everything is right now: the crown's turn sets where each arm end is and how far out the platforms swing
  let th = spin(wall()), lw = lean(rate(wall()));
  const _s = new THREE.Vector3(), _d = new THREE.Vector3();
  const place = (p) => {
    const a = th + p.slot / N * TAU, ca = Math.cos(a), sa = Math.sin(a);
    p.pivot.set(ca * ARM, HUB - 0.6, sa * ARM);
    const out = Math.sin(lw) * L, x = p.pivot.x + ca * out + p.off.x, z = p.pivot.z + sa * out + p.off.z;
    const drop = Math.sqrt(Math.max(1, L * L - out * out - p.off.x * p.off.x - p.off.z * p.off.z)), y = p.pivot.y - drop;
    p.prev = { x: p.x, y: p.y, z: p.z }; p.x = x; p.z = z; p.y = y;
    const bank = Math.min(0.8, lw * 1.25); p.ca = ca; p.sa = sa; p.tb = Math.tan(bank); p.cb = Math.cos(bank);
    p.group.position.set(x, y, z); p.group.rotation.order = 'YZX'; p.group.rotation.set(0, -a, bank); // (each platform turns with the ride, banked outward)
    const c = p.disc; c.x = x; c.z = z; c.y0 = y - 0.8; c.y1 = y;
    const q = p.ray, k = R * 0.85, hb = R * 0.85 * p.tb; q.x0 = x - k; q.x1 = x + k; q.z0 = z - k; q.z1 = z + k; q.y0 = y - 0.8 - hb; q.y1 = y + DISH + hb;
    p.node.p.set(x, y, z); for (const sp of p.spawns) sp.set(x + ca * sp.off, p.disc.hf(x + ca * sp.off, z + sa * sp.off) + 0.3, z + sa * sp.off);
    const ch = p.chains[0]; _s.set(x, y + 0.3, z); _d.subVectors(p.pivot, _s); const len = _d.length();
    ch.line.a.copy(_s); ch.line.b.copy(p.pivot); ch.m.position.copy(_s).addScaledVector(_d, 0.5); ch.m.quaternion.setFromUnitVectors(up, _d.normalize()); ch.m.scale.set(1, len, 1);
  };

  // ---- the chain can be cut: the platform flies off the way it was going (round and outward), arcs down into the
  // clouds with whoever is on it, and a new one is hung back on 10 s later
  A.lines = [];
  for (const p of decks) for (const c of p.chains) { c.line = { id: A.lines.length, a: new THREE.Vector3(), b: new THREE.Vector3(), alive: true, deck: p, chain: c }; A.lines.push(c.line); }
  let clockT = 0;
  const fling = (p) => {
    const a = th + p.slot / N * TAU, w = rate(wall()), rad = Math.hypot(p.x, p.z);
    p.down = true; p.backAt = clockT + 10; p.flyT = 0;
    p.fv = { x: -Math.sin(a) * w * rad + Math.cos(a) * 14 + p.vel.x, y: 6, z: Math.cos(a) * w * rad + Math.sin(a) * 14 + p.vel.z }; // (round, and thrown outward)
    p.spinV = (r() < 0.5 ? -1 : 1) * (1.5 + r());
    for (const c of p.chains) { c.line.alive = false; c.m.visible = false; }
    p.node.gone = true;
  };
  const restore = (p) => {
    p.down = false; p.off.x = p.off.z = p.vel.x = p.vel.z = 0; A.nodeMap.get('P' + p.i).gone = false;
    if (!A.discs.includes(p.disc)) A.discs.push(p.disc); if (!A.rayBoxes.includes(p.ray)) A.rayBoxes.push(p.ray);
    for (const c of p.chains) { c.line.alive = true; c.m.visible = true; }
    p.group.visible = true; p.group.rotation.set(0, 0, 0); place(p); p.prev = { x: p.x, y: p.y, z: p.z };
  };
  /** Cut chain id (from a sword here or a message from another player). Returns where, or null. */
  A.cutLine = (id) => {
    const Ln = A.lines[id]; if (!Ln || !Ln.alive) return null;
    Ln.alive = false; Ln.chain.m.visible = false; const at = Ln.a.clone().lerp(Ln.b, 0.15);
    if (!Ln.deck.chains.some((c) => c.line.alive)) fling(Ln.deck);
    A.dirty = true; return at;
  };
  A.anim.push((t) => { clockT = t; for (const p of decks) if (p.down && t > p.backAt) restore(p); });
  const onDeck = (f, p) => { if (!f.alive || Math.hypot(f.pos.x - p.x, f.pos.z - p.z) > R + 0.2) return false; const h = p.disc.hf(f.pos.x, f.pos.z); return f.pos.y > h - 0.4 && f.pos.y < h + 0.9; };
  /** Each frame: turn the crown, swing the platforms, fling cut ones away; landings shove a platform; carry riders. */
  A.tickTilt = (fighters, mine, dt) => {
    dt = Math.min(0.05, dt || 0); if (!dt) return;
    const t = wall(); th = spin(t); lw = lean(rate(t)); crown.rotation.y = -th;
    for (const p of decks) {
      if (p.down) { // flying off: carried along its arc, tumbling a little, until it's gone into the clouds
        p.flyT += dt; p.fv.y -= 22 * dt; p.prev = { x: p.x, y: p.y, z: p.z };
        p.x += p.fv.x * dt; p.y += p.fv.y * dt; p.z += p.fv.z * dt;
        p.group.position.set(p.x, p.y, p.z); p.group.rotation.x += p.spinV * 0.15 * dt; p.group.rotation.z += p.spinV * 0.1 * dt;
        const c = p.disc; c.x = p.x; c.z = p.z; c.y0 = p.y - 0.8; c.y1 = p.y; const q = p.ray, k = R * 0.85; q.x0 = p.x - k; q.x1 = p.x + k; q.z0 = p.z - k; q.z1 = p.z + k; q.y0 = p.y - 0.8; q.y1 = p.y + DISH;
        for (const f of p.riders) if (mine(f) && onDeck(f, p)) { f.pos.x += p.x - p.prev.x; f.pos.y += p.y - p.prev.y; f.pos.z += p.z - p.prev.z; }
        if (p.y < -60 && p.group.visible) { p.group.visible = false; A.discs = A.discs.filter((d) => d !== p.disc); A.rayBoxes = A.rayBoxes.filter((b) => b !== p.ray); }
        continue;
      }
      const now = new Set();
      for (const f of fighters) if (onDeck(f, p)) {
        now.add(f);
        if (!p.riders.has(f)) { // just landed: a shove the way they were going, harder the faster they came in
          const drop = Math.max(0, -f.vel.y), k = 0.12 + Math.min(0.1, drop * 0.008);
          p.vel.x += f.vel.x * k; p.vel.z += f.vel.z * k;
        }
      }
      p.riders = now;
      const kspr = 24 / L, damp = 0.5;
      p.vel.x += (-kspr * p.off.x - damp * p.vel.x) * dt; p.vel.z += (-kspr * p.off.z - damp * p.vel.z) * dt;
      p.off.x += p.vel.x * dt; p.off.z += p.vel.z * dt;
      const o = Math.hypot(p.off.x, p.off.z); if (o > MAXOFF) { p.off.x *= MAXOFF / o; p.off.z *= MAXOFF / o; }
    }
    for (const p of decks) {
      if (p.down) continue;
      place(p);
      for (const f of p.riders) if (mine(f)) {
        if (f.onGround) { f.pos.x += p.x - p.prev.x; f.pos.z += p.z - p.prev.z; f.pos.y += p.y - p.prev.y; f.onDeck = p; } // ride along
        else if (f.onDeck === p) { f.vel.x += (p.x - p.prev.x) / dt; f.vel.z += (p.z - p.prev.z) / dt; f.onDeck = null; } // (jump off: keep the deck's speed)
      }
    }
  };
  for (const p of decks) { place(p); p.prev = { x: p.x, y: p.y, z: p.z }; }

  A.finishNav();

  // ---- backdrop: towering clouds, a sea of cloud, drifting specks
  cloudHeaps(S, r, { n: 16, rMin: 330, rMax: 400, y: -32, depth: 8, sMin: 26, sMax: 42, stack: 4, fog: false }); // towering clouds round the horizon
  const sea = new THREE.Mesh(new THREE.CircleGeometry(620, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf4f7fa, transparent: true, opacity: 0.97 })); sea.position.y = -45; S.add(sea);
  drift(A, 120, 0xffffff, 0.2, [1.4, 0, 0.6], 0.4);
}
