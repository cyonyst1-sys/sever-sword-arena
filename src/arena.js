// The map: a big sky arena of floating platforms at different heights, tall pillars to grapple and
// swing between, and jump pads linking neighbouring platforms. Everything solid is an axis-aligned box or a ramp,
// so collision and "what am I standing on" stay simple and identical in every browser.
import * as THREE from 'three';

export const ISLAND_R = 30;
const STEP = 0.5;

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function canvasTex(draw, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function speckle(g, S, r, n, a) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${a * r()})`; g.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3); } }
function stoneTex(base, seed) {
  return canvasTex((g, S) => {
    const r = rng(seed); g.fillStyle = '#2a2723'; g.fillRect(0, 0, S, S);
    const rows = 4, h = S / rows;
    for (let y = 0; y < rows; y++) {
      let x = -((y % 2) * S / 8);
      while (x < S) {
        const w = S / 4 * (0.75 + r() * 0.5), sh = base + (r() * 34 - 17) | 0;
        g.fillStyle = `rgb(${sh},${sh - 5},${sh - 13})`; g.fillRect(x + 2, y * h + 2, w - 4, h - 4);
        x += w;
      }
    }
    speckle(g, S, r, 2500, 0.18);
  });
}
const floorTex = () => canvasTex((g, S) => {
  const r = rng(3); g.fillStyle = '#4c5a3c'; g.fillRect(0, 0, S, S);
  const n = 8, c = S / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (r() < 0.78) { const sh = 118 + r() * 34 | 0; g.fillStyle = `rgb(${sh},${sh - 4},${sh - 14})`; g.fillRect(x * c + 2, y * c + 2, c - 4, c - 4); }
  }
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${70 + r() * 30 | 0},${110 + r() * 40 | 0},50,${0.35 + r() * 0.4})`; g.beginPath(); g.arc(r() * S, r() * S, 2 + r() * 7, 0, Math.PI * 2); g.fill(); }
  speckle(g, S, r, 2000, 0.15);
});
const woodTex = () => canvasTex((g, S) => {
  const r = rng(11); g.fillStyle = '#5a3c22'; g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += S / 8) { const sh = 90 + r() * 30 | 0; g.fillStyle = `rgb(${sh},${sh * 0.66 | 0},${sh * 0.4 | 0})`; g.fillRect(0, y + 2, S, S / 8 - 4); }
  for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(40,24,10,0.25)'; g.fillRect(r() * S, r() * S, 10 + r() * 40, 1); }
});

const barkTex = () => canvasTex((g, S) => {
  const r = rng(17); g.fillStyle = '#4a3624'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) { const x = r() * S, w = 2 + r() * 7, sh = 50 + r() * 40 | 0; g.fillStyle = `rgb(${sh + 20},${sh},${sh * 0.6 | 0})`; g.fillRect(x, 0, w, S); }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(20,12,6,${0.2 + r() * 0.3})`; g.fillRect(r() * S, r() * S, 1 + r() * 3, 6 + r() * 26); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(90,120,60,${0.15 + r() * 0.2})`; g.beginPath(); g.arc(r() * S, r() * S, 3 + r() * 10, 0, Math.PI * 2); g.fill(); } // moss
});
const bambooTex = () => canvasTex((g, S) => {
  const grd = g.createLinearGradient(0, 0, S, 0);
  grd.addColorStop(0, '#5e8a2c'); grd.addColorStop(0.45, '#9dc35a'); grd.addColorStop(0.55, '#a9cc66'); grd.addColorStop(1, '#5a8428');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(40,60,15,0.9)'; g.fillRect(0, 0, S, S * 0.035); // the node ring
  g.fillStyle = 'rgba(220,235,170,0.6)'; g.fillRect(0, S * 0.035, S, S * 0.015);
  for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(60,90,25,0.25)'; g.fillRect(Math.random() * S, S * 0.05, 1, S * 0.95); }
}, 128);
function worldUV(geo, sc) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, p.getX(i) * sc, p.getZ(i) * sc);
    else if (ax >= az) uv.setXY(i, p.getZ(i) * sc, p.getY(i) * sc);
    else uv.setXY(i, p.getX(i) * sc, p.getY(i) * sc);
  }
  uv.needsUpdate = true;
}
// rotate a point a quarter turn k times around the centre
function Q(k, x, z) { for (let i = 0; i < k; i++) { const t = x; x = -z; z = t; } return [x, z]; }

export const MAPS = {
  spire: { name: 'Sky Spires', blurb: '23 small platforms at many heights: swing from one fight to the next' },
  plateaus: { name: 'Sky Plateaus', blurb: '7 huge platforms at slightly different heights: big brawls with room to dash' },
  canopy: { name: 'Great Canopy', blurb: 'giant tree branches to run along, big leaves to land on, and bamboo to swing from (and cut through)' },
};

export class Arena {
  constructor(scene, quality, mapId = 'spire') {
    // everything the map adds lives under one group, so switching maps can remove it all
    this.realScene = scene; this.root = new THREE.Group(); scene.add(this.root);
    this.scene = this.root; this.quality = quality; this.mapId = MAPS[mapId] ? mapId : 'spire';
    this.boxes = []; this.ramps = []; this.rayBoxes = []; this.bamboo = []; this.pads = []; this.nodes = []; this.nodeMap = new Map(); this.spawns = []; this.anim = [];
    this.mats = {
      stone: new THREE.MeshStandardMaterial({ map: stoneTex(150, 5), roughness: 0.92 }),
      dark: new THREE.MeshStandardMaterial({ map: stoneTex(110, 9), roughness: 0.95 }),
      floor: new THREE.MeshStandardMaterial({ map: floorTex(), roughness: 0.95 }),
      wood: new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.85 }),
      rock: new THREE.MeshStandardMaterial({ color: 0x5b5148, roughness: 1, flatShading: true }),
    };
    this.build();
  }
  dispose() {
    this.realScene.remove(this.root);
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of Object.values(this.mats)) { if (m.map) m.map.dispose(); m.dispose(); }
  }

  // ---------- building ----------
  addBox(x0, x1, y0, y1, z0, z1, mat, opts = {}) {
    const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    worldUV(geo, 0.5);
    const m = new THREE.Mesh(geo, mat || this.mats.stone);
    m.castShadow = m.receiveShadow = true; this.scene.add(m);
    const box = { x0, x1, y0, y1, z0, z1 };
    if (opts.solid !== false) this.boxes.push(box);
    if (this.tag) { this.tag.meshes.push(m); if (opts.solid !== false) this.tag.boxes.push(box); } // belongs to a platform (can crumble)
    return m;
  }
  // anything else that should fall with platform p
  own(p, ...meshes) { p.meshes.push(...meshes); }
  addBoxR(k, x0, x1, y0, y1, z0, z1, mat, opts) {
    const [ax, az] = Q(k, x0, z0), [bx, bz] = Q(k, x1, z1);
    return this.addBox(Math.min(ax, bx), Math.max(ax, bx), y0, y1, Math.min(az, bz), Math.max(az, bz), mat, opts);
  }
  // a ramp rising from point L (height hL) to point H (height hH), w wide, sitting on `base`
  addRamp(lx, lz, hx, hz, hL, hH, w, base, mat, opts = {}) {
    const dx = hx - lx, dz = hz - lz, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
    const px = -uz * w / 2, pz = ux * w / 2;
    const xs = [lx + px, lx - px, hx + px, hx - px], zs = [lz + pz, lz - pz, hz + pz, hz - pz];
    const r = { lx, lz, ux, uz, len, w, hL, hH, base, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
    r.noWall = !!opts.noWall; this.ramps.push(r);
    if (this.tag) (this.tag.ramps ||= []).push(r);
    if (opts.visual === false) return r; // (branches and leaves draw themselves)
    const geo = new THREE.BoxGeometry(r.x1 - r.x0, 1, r.z1 - r.z0);
    geo.translate((r.x0 + r.x1) / 2, 0.5, (r.z0 + r.z1) / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const t = Math.min(1, Math.max(0, ((x - lx) * ux + (z - lz) * uz) / len));
      p.setY(i, p.getY(i) > 0.5 ? hL + (hH - hL) * t : base);
    }
    geo.computeVertexNormals(); worldUV(geo, 0.5);
    const m = new THREE.Mesh(geo, mat || this.mats.dark); m.castShadow = m.receiveShadow = true; this.scene.add(m);
  }
  addRampR(k, lx, lz, hx, hz, hL, hH, w, base, mat) {
    const [a, b] = Q(k, lx, lz), [c, d] = Q(k, hx, hz);
    this.addRamp(a, b, c, d, hL, hH, w, base, mat);
  }
  addPad(x, y, z, tx, ty, tz, T, from = -1, to = -1) {
    const G = 24;
    const v = new THREE.Vector3((tx - x) / T, (ty - y + 0.5 * G * T * T) / T, (tz - z) / T);
    const pad = { x, y, z, r: 1.0, v, from, to, meshes: [] };
    this.pads.push(pad);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.18, 24), this.mats.dark);
    base.position.set(x, y + 0.09, z); base.receiveShadow = true; this.scene.add(base);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 24), new THREE.MeshBasicMaterial({ color: 0x55e0ff }));
    glow.position.set(x, y + 0.2, z); this.scene.add(glow);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 28), new THREE.MeshBasicMaterial({ color: 0x9ff3ff, transparent: true, opacity: 0.8 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(x, y + 0.25, z); this.scene.add(ring);
    this.anim.push((t) => { if (pad.gone) return; const k = (t * 0.9) % 1; ring.position.y = y + 0.25 + k * 2.2; ring.material.opacity = 0.8 * (1 - k); ring.scale.setScalar(1 - k * 0.35); });
    pad.meshes.push(base, glow, ring);
  }
  node(name, x, y, z) { const n = { name, id: this.nodes.length, p: new THREE.Vector3(x, y, z), edges: [] }; this.nodes.push(n); this.nodeMap.set(name, n); return n; }
  link(a, b, type = 'walk', both = true) {
    const A = this.nodeMap.get(a), B = this.nodeMap.get(b);
    A.edges.push({ to: B, type }); if (both) B.edges.push({ to: A, type });
  }

  // ---------- the Great Canopy: giant trunks, branches to run along, big leaves, bamboo to swing from ----------
  buildCanopy() {
    const S = this.scene, M = this.mats, r = rng(424242);
    M.bark = new THREE.MeshStandardMaterial({ map: barkTex(), roughness: 0.95 });
    M.bamboo = new THREE.MeshStandardMaterial({ map: bambooTex(), roughness: 0.55 });
    M.leaf = new THREE.MeshStandardMaterial({ color: 0x4f8f3a, roughness: 0.7, side: THREE.DoubleSide });
    M.leafDark = new THREE.MeshStandardMaterial({ color: 0x2c5a26, roughness: 0.9, flatShading: true });
    M.vein = new THREE.MeshStandardMaterial({ color: 0x9ccf74, roughness: 0.7 });
    M.stem = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    // green forest light under a leafy roof
    this.realScene.background = new THREE.Color(0x7d9c74);
    this.realScene.fog = new THREE.Fog(0x7b9a72, 45, 240);
    S.add(new THREE.HemisphereLight(0xd8f0c8, 0x2b3622, 0.95));
    const sun = new THREE.DirectionalLight(0xffe7b8, 1.7);
    this.sun = sun; this.sunOff = new THREE.Vector3(25, 55, 12); sun.position.copy(this.sunOff);
    if (this.quality !== 'low') {
      sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
      const c = sun.shadow.camera; c.left = c.bottom = -42; c.right = c.top = 42; c.near = 1; c.far = 170;
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    }
    S.add(sun); S.add(sun.target);
    this.killY = -45;
    // the forest floor far below, with mist above it
    const floor = new THREE.Mesh(new THREE.CircleGeometry(420, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x24301c, roughness: 1 }));
    floor.position.y = -62; S.add(floor);
    const mist = new THREE.Mesh(new THREE.CircleGeometry(420, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xdde8d6, transparent: true, opacity: 0.45, depthWrite: false }));
    mist.position.y = -40; S.add(mist);
    // the leafy roof
    for (let i = 0; i < 110; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 150, s = 10 + r() * 16;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 1), M.leafDark);
      m.position.set(Math.cos(a) * d, 70 + r() * 14, Math.sin(a) * d); m.scale.y = 0.35; m.rotation.y = r() * 3; S.add(m);
    }
    const plats = this.plats = []; this.pillars = [];
    // giant trunks from the floor to the roof: one in the middle, four around it
    const trunks = [{ x: 0, z: 0, r: 6 }];
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4 + (r() - 0.5) * 0.3, d = 66 + r() * 10; trunks.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: 4.5 }); }
    for (const t of trunks) {
      const g = new THREE.CylinderGeometry(t.r * 0.85, t.r * 1.25, 150, 18, 8);
      const gp = g.attributes.position;
      for (let i = 0; i < gp.count; i++) { const s = 1 + (r() - 0.5) * 0.12; gp.setX(i, gp.getX(i) * s); gp.setZ(i, gp.getZ(i) * s); }
      g.computeVertexNormals(); g.translate(t.x, 5, t.z);
      const m = new THREE.Mesh(g, M.bark); m.castShadow = m.receiveShadow = true; S.add(m);
      const h = t.r * 0.8; this.boxes.push({ x0: t.x - h, x1: t.x + h, y0: -70, y1: 80, z0: t.z - h, z1: t.z + h }); // solid, and grapple-able
    }
    this.trunks = trunks;

    // ---- branches and leaves ----
    const mid = (p) => (p.ya !== undefined ? (p.ya + p.yb) / 2 : p.y);
    const addPlat = (p) => {
      p.i = plats.length; p.meshes = []; p.boxes = []; p.ramps = []; p.rays = []; plats.push(p);
      this.node('P' + p.i, p.x, mid(p), p.z).plat = p.i;
      const sp = new THREE.Vector3(p.x, mid(p), p.z); sp.plat = p.i; this.spawns.push(sp);
      return p;
    };
    const linkP = (a, b) => this.link('P' + a.i, 'P' + b.i);
    const branch = (A, B, width, grp) => {
      const dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
      const p = addPlat({ kind: 'branch', x: (A.x + B.x) / 2, z: (A.z + B.z) / 2, y: (A.y + B.y) / 2, ya: A.y, yb: B.y, w: L, d: width, ang, group: grp });
      this.tag = p;
      // walkable top (no walls: you can step off the side of a branch)
      this.addRamp(A.x, A.z, B.x, B.z, A.y, B.y, width, Math.min(A.y, B.y) - 1.2, null, { visual: false, noWall: true });
      // the log itself: its top runs just above the walking surface
      const R = width * 0.55, a3 = new THREE.Vector3(A.x, A.y - R * 0.8, A.z), b3 = new THREE.Vector3(B.x, B.y - R * 0.8, B.z);
      const dir = b3.clone().sub(a3), len = dir.length(); dir.normalize();
      const log = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.92, R, len + R * 0.5, 12, 1), M.bark);
      log.position.copy(a3).add(b3).multiplyScalar(0.5); log.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      log.castShadow = log.receiveShadow = true; S.add(log); this.own(p, log);
      const knot = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, 12, 8), M.bark); knot.position.copy(b3); knot.castShadow = true; S.add(knot); this.own(p, knot);
      // grapple-only boxes along the log, so you can hook the branch (but never bump into them)
      for (let s = 0; s <= len; s += 5) {
        const c = a3.clone().addScaledVector(dir, s);
        const box = { x0: c.x - R * 0.7, x1: c.x + R * 0.7, y0: c.y - R * 0.7, y1: c.y + R * 0.9, z0: c.z - R * 0.7, z1: c.z + R * 0.7 };
        this.rayBoxes.push(box); p.rays.push(box);
      }
      this.tag = null;
      return p;
    };
    const buds = new Map(), rb = rng(777); // per limb: matrices of the little leaves round each bud (one instanced mesh per limb)
    const leaf = (C, len, wid, ang, y, grp, from, rw) => {
      const p = addPlat({ kind: 'leaf', x: C.x, z: C.z, y, w: len, d: wid, ang, group: grp });
      this.tag = p;
      const ux = Math.cos(ang), uz = Math.sin(ang);
      this.addRamp(C.x - ux * len * 0.42, C.z - uz * len * 0.42, C.x + ux * len * 0.42, C.z + uz * len * 0.42, y, y, wid * 0.78, y - 0.6, null, { visual: false, noWall: true });
      const sh = new THREE.Shape();
      sh.moveTo(-len / 2, 0); sh.quadraticCurveTo(-len * 0.1, wid * 0.75, len / 2, 0); sh.quadraticCurveTo(-len * 0.1, -wid * 0.75, -len / 2, 0);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.4, bevelEnabled: false, curveSegments: 12 }); g.rotateX(-Math.PI / 2); g.translate(0, -0.4, 0); // a thick leaf, visible edge-on
      const gp = g.attributes.position; // droops a little at the tip and the edges
      for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), z = gp.getZ(i); gp.setY(i, gp.getY(i) - Math.pow(Math.max(0, x / (len / 2)), 2) * 0.3 - Math.abs(z) / wid * 0.2); }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, M.leaf); m.rotation.y = -ang; m.position.set(C.x, y + 0.06, C.z); m.castShadow = m.receiveShadow = true; S.add(m); this.own(p, m);
      const rib = new THREE.Mesh(new THREE.BoxGeometry(len * 0.92, 0.08, 0.2), M.vein); rib.rotation.y = -ang; rib.position.set(C.x, y + 0.1, C.z); S.add(rib); this.own(p, rib);
      if (from) { // the stalk: grows out of the side of the branch, thick bark tapering into a thin green stem
        const R = rw || 1.5, end = new THREE.Vector3(C.x - ux * len * 0.42, y - 0.12, C.z - uz * len * 0.42);
        const h = new THREE.Vector3(end.x - from.x, 0, end.z - from.z).normalize();
        const bud = new THREE.Vector3(from.x + h.x * R * 0.7, from.y - R * 0.55, from.z + h.z * R * 0.7);
        const curve = new THREE.CatmullRomCurve3([bud, bud.clone().lerp(end, 0.45).add(new THREE.Vector3(0, 0.25, 0)), end]);
        const TS = 14, RS = 8, tube = new THREE.TubeGeometry(curve, TS, 1, RS, false), tp = tube.attributes.position;
        const col = new Float32Array(tp.count * 3), c0 = new THREE.Color(0x6b4a2c), c1 = new THREE.Color(0x4f8f3a), cc = new THREE.Color(), cp = new THREE.Vector3();
        for (let i = 0; i <= TS; i++) {
          const t = i / TS, e = t * t * (3 - 2 * t), rad = R * 0.5 * (1 - e) + 0.16 * e; // fat collar on the bark → slim stem
          curve.getPointAt(t, cp); cc.copy(c0).lerp(c1, Math.min(1, Math.max(0, (t - 0.25) / 0.6)));
          for (let j = 0; j <= RS; j++) { const k = i * (RS + 1) + j; tp.setXYZ(k, cp.x + (tp.getX(k) - cp.x) * rad, cp.y + (tp.getY(k) - cp.y) * rad, cp.z + (tp.getZ(k) - cp.z) * rad); cc.toArray(col, k * 3); }
        }
        tube.setAttribute('color', new THREE.BufferAttribute(col, 3)); tube.computeVertexNormals();
        const st = new THREE.Mesh(tube, M.stem); st.castShadow = true; S.add(st); this.own(p, st);
        // a spray of small leaves around the bud
        const n = 3 + Math.floor(rb() * 4), list = buds.get(grp) || buds.set(grp, { p, m: [] }).get(grp);
        for (let i = 0; i < n; i++) {
          const sz = 1.4 + rb() * 1.8, yaw = Math.atan2(h.z, h.x) + (rb() - 0.5) * 2.6, pitch = 0.25 + rb() * 0.7;
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rb() * 0.6 - 0.3, -yaw, pitch, 'YZX'));
          list.m.push(new THREE.Matrix4().compose(curve.getPointAt(0.15 + rb() * 0.25), q, new THREE.Vector3(sz, sz, sz)));
        }
      }
      const box = { x0: C.x - 2, x1: C.x + 2, y0: y - 0.6, y1: y + 0.15, z0: C.z - 2, z1: C.z + 2 }; // hook the leaf, too
      this.rayBoxes.push(box); p.rays.push(box);
      this.tag = null;
      return p;
    };
    let group = 0;
    // a limb: runs level, climbs or dips for a stretch, then levels out again; sprouts leaves and side arms
    const grow = (start, angle, segs, depth, startPlat) => {
      const grp = group++;
      let A = start, a = angle, mode = 'level', prev = startPlat;
      for (let s = 0; s < segs; s++) {
        if (s % 2 === 0) { const rr = r(); mode = rr < 0.4 ? 'level' : rr < 0.7 ? 'up' : 'down'; }
        let dy = mode === 'level' ? 0 : (mode === 'up' ? 1 : -1) * (2.5 + r() * 3.5);
        if (A.y + dy > 30 || A.y + dy < -20) dy = -dy * 0.5;
        const L = 10 + r() * 6; a += (r() - 0.5) * 0.45;
        const B = { x: A.x + Math.cos(a) * L, y: A.y + dy, z: A.z + Math.sin(a) * L };
        if (Math.hypot(B.x, B.z) > 100) break;
        if (trunks.some((t) => Math.hypot(B.x - t.x, B.z - t.z) < t.r + 2)) break; // don't run into a trunk
        const w = Math.max(2.6, (depth === 0 ? 4.4 : 3.4) - s * 0.12);
        const p = branch(A, B, w, grp);
        if (prev) linkP(prev, p);
        prev = p;
        if (r() < 0.3) { // a big leaf off one side
          const side = r() < 0.5 ? 1 : -1, la = a + side * (1.1 + r() * 0.5), len = 13 + r() * 6, wid = 7.5 + r() * 3.5;
          const C = { x: B.x + Math.cos(la) * (w / 2 + len * 0.45), z: B.z + Math.sin(la) * (w / 2 + len * 0.45) };
          if (Math.hypot(C.x, C.z) < 104) linkP(p, leaf(C, len, wid, la, B.y + 0.2 + r() * 0.6, grp, B, w * 0.55));
        }
        if (depth < 1 && s >= 2 && r() < 0.3) grow(B, a + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.6), 3 + Math.floor(r() * 3), depth + 1, p);
        A = B;
      }
      if (prev) { // a big leaf at the tip
        const len = 15 + r() * 4, wid = 8.5 + r() * 2.5, C = { x: A.x + Math.cos(a) * len * 0.48, z: A.z + Math.sin(a) * len * 0.48 };
        if (Math.hypot(C.x, C.z) < 106) linkP(prev, leaf(C, len, wid, a, A.y + 0.3, prev.group, A, prev.d * 0.55));
      }
    };
    // limbs radiate from the central trunk at several heights, and reach in from the outer trunks
    const ys = [-12, -2, 8, 18, 26];
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + r() * 0.4, t = trunks[0]; grow({ x: t.x + Math.cos(a) * (t.r + 0.5), y: ys[k % ys.length], z: t.z + Math.sin(a) * (t.r + 0.5) }, a, 6 + Math.floor(r() * 2), 0, null); }
    for (let i = 1; i < trunks.length; i++) {
      const t = trunks[i], toC = Math.atan2(-t.z, -t.x);
      for (let k = 0; k < 2; k++) { const a = toC + (k - 0.5) * 1.1 + (r() - 0.5) * 0.3; grow({ x: t.x + Math.cos(a) * (t.r + 0.5), y: ys[(i + k * 2) % ys.length] + (r() - 0.5) * 4, z: t.z + Math.sin(a) * (t.r + 0.5) }, a, 5 + Math.floor(r() * 2), 0, null); }
    }
    { // the little bud leaves: a small leaf shape, base at the origin pointing along +x
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.45, 0.32, 1, 0); sh.quadraticCurveTo(0.45, -0.32, 0, 0);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false, curveSegments: 6 }); g.rotateX(-Math.PI / 2);
      for (const { p, m } of buds.values()) { const im = new THREE.InstancedMesh(g, M.leaf, m.length); m.forEach((x, i) => im.setMatrixAt(i, x)); S.add(im); this.own(p, im); }
    }
    // where branches cross at about the same height you can walk from one to the other
    for (const a of plats) for (const b of plats) {
      if (a.i >= b.i || a.group === b.group) continue;
      if (Math.abs(mid(a) - mid(b)) < 1.2 && (this.inPlat(a, b, 0.5) || this.inPlat(b, a, 0.5))) linkP(a, b);
    }
    // bots' sense of distance between surfaces: walking connected, or roughly how many swings apart
    const comp = plats.map(() => -1);
    for (const p of plats) if (comp[p.i] < 0) { const q = [p.i]; comp[p.i] = p.i; while (q.length) { const u = q.shift(); for (const e of this.nodeMap.get('P' + u).edges) { const v = e.to.plat; if (v !== undefined && comp[v] < 0) { comp[v] = p.i; q.push(v); } } } }
    this.hops = plats.map((p) => plats.map((q) => Math.round(Math.hypot(p.x - q.x, p.z - q.z) / 25) + (comp[p.i] === comp[q.i] ? 0 : 1)));
    // swing routes for bots: each surface to its 3 nearest surfaces on other limbs within grapple reach
    for (const a of plats) {
      plats.filter((b) => comp[b.i] !== comp[a.i] && Math.abs(mid(b) - mid(a)) < 14)
        .map((b) => [b, Math.hypot(a.x - b.x, a.z - b.z)]).filter(([, d]) => d < 34).sort((u, v) => u[1] - v[1])
        .slice(0, 3).forEach(([b]) => this.link('P' + a.i, 'P' + b.i, 'swing'));
    }
    // bamboo everywhere, floor to roof, kept clear of branches, leaves and trunks
    for (let gx = -108; gx <= 108; gx += 11) for (let gz = -108; gz <= 108; gz += 11) {
      const x = gx + (r() - 0.5) * 8, z = gz + (r() - 0.5) * 8;
      if (Math.hypot(x, z) > 112 || r() < 0.2) continue;
      if (trunks.some((t) => Math.hypot(x - t.x, z - t.z) < t.r + 3)) continue;
      if (plats.some((p) => this.inPlat(p, { x, z }, 1.6))) continue;
      const rad = 0.28 + r() * 0.14, s = this.bamboo.length;
      this.bamboo.push({ x, z, r: rad, segs: [] });
      this.addBambooSeg(s, -62, 78);
      this.pillars.push({ x, z, w: rad * 2 });
    }
    this.arcPts = [];
  }

  build() {
    if (this.mapId === 'canopy') return this.buildCanopy();
    const S = this.scene, M = this.mats;
    // sky & light (the sun's shadow box follows the player around the big map)
    this.realScene.background = new THREE.Color(0x9cc4e4);
    this.realScene.fog = new THREE.Fog(0xa9cbe6, 90, 320);
    const big = this.mapId === 'plateaus';
    S.add(new THREE.HemisphereLight(0xd8ecff, 0x5a4a38, 0.85));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.0);
    this.sun = sun; this.sunOff = new THREE.Vector3(30, 50, 18);
    sun.position.copy(this.sunOff);
    if (this.quality !== 'low') {
      sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
      const c = sun.shadow.camera; c.left = c.bottom = -42; c.right = c.top = 42; c.near = 1; c.far = 170;
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    }
    S.add(sun); S.add(sun.target);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(520, 24, 12), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x3f7fc4) }, mid: { value: new THREE.Color(0xa9cbe6) }, bot: { value: new THREE.Color(0xe7eef3) } },
      vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vp; void main(){ float h = normalize(vp).y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.6)) : mix(mid, bot, min(1.0, -h * 3.0)); gl_FragColor = vec4(c, 1.0); }',
    }));
    S.add(dome);
    const clouds = new THREE.Mesh(new THREE.CircleGeometry(600, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2f5f8, fog: false, transparent: true, opacity: 0.92 }));
    clouds.position.y = -75; S.add(clouds);
    this.killY = -45;

    // ---- platforms: a hub, two rings at different heights, high perches and a few low ones ----
    const r = rng(20261113);
    const plats = this.plats = [];
    const fits = (x, z, y, w, d) => {
      if (Math.hypot(x, z) > 95) return false;
      for (const p of plats) {
        const ox = Math.abs(p.x - x) < (p.w + w) / 2 + 6, oz = Math.abs(p.z - z) < (p.d + d) / 2 + 6;
        if (ox && oz && Math.abs(p.y - y) < 10) return false;
      }
      return true;
    };
    const add = (x, z, y, w, d, kind) => { if (!fits(x, z, y, w, d)) return false; plats.push({ x, z, y, w, d, kind, i: plats.length }); return true; };
    if (big) {
      // Sky Plateaus: a huge central plateau and six big ones around it, each at a slightly different height
      plats.push({ x: 0, z: 0, y: 0, w: 46, d: 46, kind: 'hub', i: 0 });
      const ys = [-4, 3, 7, -2, 8, 2];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3, R = 62 + (r() - 0.5) * 4;
        plats.push({ x: Math.round(Math.cos(a) * R), z: Math.round(Math.sin(a) * R), y: ys[i], w: 36 + Math.round(r() * 8), d: 36 + Math.round(r() * 8), kind: 'plateau', i: plats.length });
      }
    } else {
      add(0, 0, 0, 20, 20, 'hub');
      const ring = (n, R0, R1, y0, y1, s0, s1, kind, off) => {
        for (let i = 0; i < n; i++) for (let t = 0; t < 14; t++) {
          const a = (i + off + r() * 0.5) / n * Math.PI * 2, R = R0 + r() * (R1 - R0);
          if (add(Math.round(Math.cos(a) * R), Math.round(Math.sin(a) * R), Math.round(y0 + r() * (y1 - y0)), Math.round(s0 + r() * (s1 - s0)), Math.round(s0 + r() * (s1 - s0)), kind)) break;
        }
      };
      ring(6, 28, 36, -5, 12, 11, 15, 'ring', 0);
      ring(9, 52, 66, -9, 24, 9, 14, 'outer', 0.5);
      ring(4, 16, 42, 20, 32, 7, 9, 'perch', 0.25);
      ring(3, 18, 44, -21, -14, 10, 13, 'low', 0.7);
    }

    for (const p of plats) {
      p.meshes = []; p.boxes = []; this.tag = p;
      const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, z0 = p.z - p.d / 2, z1 = p.z + p.d / 2;
      this.addBox(x0, x1, p.y - 0.35, p.y, z0, z1, M.floor);
      this.addBox(x0 + 0.2, x1 - 0.2, p.y - 2.2, p.y - 0.35, z0 + 0.2, z1 - 0.2, M.stone);
      const rad = Math.min(p.w, p.d) * 0.6, h = big ? 14 + r() * 10 : 5 + r() * 8;
      const cone = new THREE.ConeGeometry(rad, h, 8, 3); cone.rotateX(Math.PI);
      const cp = cone.attributes.position;
      for (let i = 0; i < cp.count; i++) { const y = cp.getY(i); if (y < h / 2 - 0.01) { const s = 1 + (r() - 0.5) * 0.4; cp.setX(i, cp.getX(i) * s); cp.setZ(i, cp.getZ(i) * s); } }
      cone.translate(p.x, p.y - 2.2 - h / 2, p.z); cone.computeVertexNormals();
      const rock = new THREE.Mesh(cone, M.rock); S.add(rock); this.own(p, rock);
      this.node('P' + p.i, p.x, p.y, p.z).plat = p.i;
      { const sp = new THREE.Vector3(p.x + (r() - 0.5) * 3, p.y, p.z + (r() - 0.5) * 3); sp.plat = p.i; this.spawns.push(sp); }
      if (big) { // big platforms: spawn spots and walking waypoints in each quarter too
        for (const [qx, qz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const x = p.x + qx * p.w / 4, z = p.z + qz * p.d / 4;
          { const sp = new THREE.Vector3(x, p.y, z); sp.plat = p.i; this.spawns.push(sp); }
          this.node(`Q${p.i}_${qx}${qz}`, x, p.y, z).plat = p.i; this.link('P' + p.i, `Q${p.i}_${qx}${qz}`);
        }
      }
    }
    this.tag = null;

    // ---- jump pads between neighbouring platforms ----
    this.arcPts = [];
    const linked = new Set(), padN = new Map(), padSpots = new Map(plats.map((p) => [p.i, []]));
    const spot = (a, b, inset) => {
      const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
      const t = Math.min(Math.abs(ux) > 1e-3 ? (a.w / 2 - inset) / Math.abs(ux) : 1e9, Math.abs(uz) > 1e-3 ? (a.d / 2 - inset) / Math.abs(uz) : 1e9);
      return new THREE.Vector3(a.x + ux * t, a.y, a.z + uz * t);
    };
    const comp = plats.map((p) => p.i); // union-find, so every platform ends up connected
    const root = (i) => (comp[i] === i ? i : (comp[i] = root(comp[i])));
    const tryLink = (a, b, cap) => {
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      const key = Math.min(a.i, b.i) + '-' + Math.max(a.i, b.i);
      if (linked.has(key) || (cap && ((padN.get(a.i) || 0) >= cap || (padN.get(b.i) || 0) >= cap))) return false;
      // take off near the edge facing the other platform; land near the middle, well clear of its pads
      const pa = spot(a, b, 2.2), pb = spot(b, a, 2.2);
      // (on big platforms: land 8 m in from the near edge, well clear of the return pad)
      const la = Math.min(b.w, b.d) > 24 ? spot(b, a, 8) : new THREE.Vector3(b.x, b.y, b.z).lerp(pb, -0.4);
      const lb = Math.min(a.w, a.d) > 24 ? spot(a, b, 8) : new THREE.Vector3(a.x, a.y, a.z).lerp(pa, -0.4);
      if (padSpots.get(a.i).some((q) => q.distanceTo(pa) < 2.8) || padSpots.get(b.i).some((q) => q.distanceTo(pb) < 2.8)) return false;
      // long enough in the air to come down onto the far platform, never up through it from below
      const up = Math.max(0, b.y - a.y), minT = Math.sqrt(2 * (up + 3) / 24) * 1.2;
      const flat = big ? pa.distanceTo(la) : d; // (big map: time the jump by how far it actually carries)
      const base = Math.max(minT, Math.min(2.4, Math.max(1.0, flat / 17 + Math.abs(b.y - a.y) / 40)));
      let T = 0, arcA = null, arcB = null;
      for (const k of [1, 1.3, 0.8, 1.6]) { T = base * k; arcA = this.arc(pa, la, T); arcB = arcA && this.arc(pb, lb, T); if (arcA && arcB) break; }
      if (!arcA || !arcB) return false;
      comp[root(a.i)] = root(b.i);
      linked.add(key); padN.set(a.i, (padN.get(a.i) || 0) + 1); padN.set(b.i, (padN.get(b.i) || 0) + 1);
        this.arcPts.push(...arcA, ...arcB);
        this.addPad(pa.x, a.y, pa.z, la.x, b.y, la.z, T, a.i, b.i); this.addPad(pb.x, b.y, pb.z, lb.x, a.y, lb.z, T, b.i, a.i);
        padSpots.get(a.i).push(pa, lb); padSpots.get(b.i).push(pb, la);
        const na = this.node(`D${a.i}_${b.i}`, pa.x, a.y, pa.z), nb = this.node(`D${b.i}_${a.i}`, pb.x, b.y, pb.z);
        na.plat = a.i; na.to = b.i; nb.plat = b.i; nb.to = a.i;
        this.link('P' + a.i, `D${a.i}_${b.i}`); this.link(`D${a.i}_${b.i}`, 'P' + b.i, 'pad', false);
        this.link('P' + b.i, `D${b.i}_${a.i}`); this.link(`D${b.i}_${a.i}`, 'P' + a.i, 'pad', false);
      return true;
    };
    for (const a of plats) {
      const nb = plats.filter((b) => b !== a).map((b) => ({ b, d: Math.hypot(b.x - a.x, b.z - a.z) })).sort((u, v) => u.d - v.d).slice(0, 4);
      for (const { b, d } of nb) if (d <= (big ? 85 : 46) && Math.abs(b.y - a.y) <= 22) tryLink(a, b, big ? 4 : 3);
    }
    // join any platform group that's still cut off to the closest platform outside it
    for (let guard = 0; guard < plats.length; guard++) {
      const roots = new Set(plats.map((p) => root(p.i))); if (roots.size <= 1) break;
      const pairs = [];
      for (const a of plats) for (const b of plats) if (a.i < b.i && root(a.i) !== root(b.i)) pairs.push([a, b, Math.hypot(b.x - a.x, b.z - a.z) + Math.abs(b.y - a.y) * 0.7]);
      pairs.sort((u, v) => u[2] - v[2]);
      if (!pairs.some(([a, b]) => tryLink(a, b, 0))) break;
    }
    // how many pad jumps apart every two platforms are (bots use it to pick nearby fights)
    const adj = plats.map(() => []);
    for (const k of linked) { const [i, j] = k.split('-').map(Number); adj[i].push(j); adj[j].push(i); }
    this.hops = plats.map((p) => {
      const h = plats.map(() => 99); h[p.i] = 0; const q = [p.i];
      while (q.length) { const u = q.shift(); for (const v of adj[u]) if (h[v] === 99) { h[v] = h[u] + 1; q.push(v); } }
      return h;
    });

    // ---- cover on each platform (kept off the pads, landings and centre) ----
    for (const p of plats) {
      this.tag = p;
      const keep = [new THREE.Vector3(p.x, p.y, p.z), ...padSpots.get(p.i)];
      if (big) { // low terraces (a step up, no jump needed) so the plateaus have levels to fight across
        for (let k = 0, tries = 0; k < 3 && tries < 40; tries++) {
          const tw = 8 + r() * 6, td = 8 + r() * 6;
          const x = p.x + (r() - 0.5) * (p.w - tw - 4), z = p.z + (r() - 0.5) * (p.d - td - 4);
          const near = (q, m) => Math.abs(q.x - x) < tw / 2 + m && Math.abs(q.z - z) < td / 2 + m;
          if (keep.some((q) => near(q, 2.5)) || this.arcPts.some((q) => q.y < p.y + 4 && near(q, 1.5))) continue;
          this.addBox(x - tw / 2, x + tw / 2, p.y, p.y + 0.45, z - td / 2, z + td / 2, M.stone);
          keep.push(new THREE.Vector3(x, p.y, z)); k++;
        }
      }
      const n = big ? Math.round(p.w * p.d / 70) : p.kind === 'perch' ? 1 : p.kind === 'hub' ? 5 : 2 + Math.floor(r() * 2);
      for (let k = 0, tries = 0; k < n && tries < (big ? n * 12 : 30); tries++) {
        const x = p.x + (r() - 0.5) * (p.w - 3), z = p.z + (r() - 0.5) * (p.d - 3);
        if (keep.some((q) => Math.hypot(q.x - x, q.z - z) < 3)) continue;
        if (this.arcPts.some((q) => q.y < p.y + 4 && Math.hypot(q.x - x, q.z - z) < 2.4)) continue; // under a pad's flight path
        if (r() < 0.55) { const along = r() < 0.5, L = 1.5 + r(); this.addBox(x - (along ? L : 0.3), x + (along ? L : 0.3), p.y, p.y + 1.1, z - (along ? 0.3 : L), z + (along ? 0.3 : L), M.stone); }
        else this.addBox(x - 0.55, x + 0.55, p.y, p.y + 2.3, z - 0.55, z + 0.55, M.dark);
        keep.push(new THREE.Vector3(x, p.y, z)); k++;
      }
      // glowing crystal on each corner for readability from afar
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshStandardMaterial({ color: 0x7fe8ff, emissive: 0x2fb8e0, emissiveIntensity: 1.2, flatShading: true }));
        c.position.set(p.x + cx * (p.w / 2 - 0.5), p.y + 0.6, p.z + cz * (p.d / 2 - 0.5)); c.scale.y = 1.8; S.add(c); this.own(p, c);
      }
    }
    this.tag = null;

    // ---- sky pillars all over the arena ----
    const pillars = [];
    for (let gx = -102; gx <= 102; gx += 16) for (let gz = -102; gz <= 102; gz += 16) {
      const x = gx + (r() - 0.5) * 9, z = gz + (r() - 0.5) * 9, w = 1.4 + r() * 1.0;
      if (Math.hypot(x, z) > 110 || r() < 0.2) continue;
      const on = plats.find((p) => Math.abs(p.x - x) < p.w / 2 + w / 2 + 2.5 && Math.abs(p.z - z) < p.d / 2 + w / 2 + 2.5);
      if (on) {
        // big map: some pillars rise straight through the plateaus (cover and grapple points mid-fight)
        if (!big || r() < 0.35) continue;
        const inside = Math.abs(on.x - x) < on.w / 2 - 3 && Math.abs(on.z - z) < on.d / 2 - 3;
        const clear = Math.hypot(on.x - x, on.z - z) > 5 && !padSpots.get(on.i).some((q) => Math.hypot(q.x - x, q.z - z) < 5);
        if (!inside || !clear) continue;
      }
      if (this.arcPts.some((q) => Math.hypot(q.x - x, q.z - z) < w / 2 + 1.8)) continue;
      const m = this.addBox(x - w / 2, x + w / 2, -90, 95, z - w / 2, z + w / 2, M.dark);
      m.castShadow = false;
      pillars.push({ x, z, w });
    }
    const ringGeo = new THREE.BoxGeometry(1, 0.25, 1), per = Math.ceil(170 / 14);
    const rings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x7fe8ff }), pillars.length * per);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    let ri = 0;
    for (const p of pillars) for (let y = -76; y < 94; y += 14) { mtx.compose(pos.set(p.x, y, p.z), q, sc.set(p.w + 0.12, 1, p.w + 0.12)); rings.setMatrixAt(ri++, mtx); }
    rings.count = ri; S.add(rings);
    this.pillars = pillars;

    // far-off floating rocks for scenery
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2 + r(), d = 140 + r() * 90, s = 3 + r() * 9;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), M.rock);
      m.position.set(Math.cos(a) * d, -20 + r() * 50, Math.sin(a) * d); m.rotation.set(r() * 3, r() * 3, r() * 3); m.scale.y = 0.6;
      S.add(m);
    }
  }
  // jump-pad arc from p0 to p1 taking T seconds; null if something is in the way
  arc(p0, p1, T) {
    const G = 24, v = new THREE.Vector3((p1.x - p0.x) / T, (p1.y - p0.y + 0.5 * G * T * T) / T, (p1.z - p0.z) / T);
    const pts = [];
    for (let k = 2; k <= 37; k++) {
      const t = T * k / 40, x = p0.x + v.x * t, y = p0.y + v.y * t - 0.5 * G * t * t + 0.9, z = p0.z + v.z * t;
      for (const b of this.boxes) if (x > b.x0 - 0.6 && x < b.x1 + 0.6 && y > b.y0 - 0.9 && y < b.y1 + 0.9 && z > b.z0 - 0.6 && z < b.z1 + 0.6) return null;
      pts.push({ x, y, z });
    }
    return pts;
  }
  follow(p) {
    if (!this.sun) return;
    const x = Math.round(p.x / 4) * 4, y = Math.round(p.y / 4) * 4, z = Math.round(p.z / 4) * 4;
    this.sun.target.position.set(x, y, z); this.sun.position.set(x, y, z).add(this.sunOff);
  }

  // ---------- queries ----------
  rampH(r, x, z) {
    const t = ((x - r.lx) * r.ux + (z - r.lz) * r.uz) / r.len;
    const s = (x - r.lx) * -r.uz + (z - r.lz) * r.ux;
    if (t < -0.02 || t > 1.02 || Math.abs(s) > r.w / 2 + 0.05) return null;
    return r.hL + (r.hH - r.hL) * Math.min(1, Math.max(0, t));
  }
  /** Highest walkable surface at (x,z) no higher than a step above y. -Infinity over the void. */
  groundHeight(x, z, y, m = 0.18) {
    let g = -Infinity;

    for (const b of this.boxes) if (x >= b.x0 - m && x <= b.x1 + m && z >= b.z0 - m && z <= b.z1 + m && b.y1 <= y + STEP && b.y1 > g) g = b.y1;
    for (const r of this.ramps) { const h = this.rampH(r, x, z); if (h !== null && h <= y + (r.noWall ? 1.2 : STEP) && h > g) g = h; } // branch tops: a fast dash up one still lands on it
    return g;
  }
  /** Is there a wall at (x,z) for a body standing at feet height y? */
  wallAt(x, z, y, h = 1.7, m = 0.3) {
    for (const b of this.boxes) if (x >= b.x0 - m && x <= b.x1 + m && z >= b.z0 - m && z <= b.z1 + m && b.y1 > y + STEP && b.y0 < y + h) return true;
    return false;
  }
  /** Push a standing cylinder (feet at pos.y) out of walls; handles ceilings. Returns true if grounded. */
  collide(pos, vel, rad, h, wasGround, prevY = pos.y) {
    const top = Math.max(pos.y, prevY); // fast falls can pass a floor in one frame: judge floors from where we were too
    for (let it = 0; it < 2; it++) {
      for (const b of this.boxes) {
        if (b.y1 <= top + STEP || b.y0 >= pos.y + h) continue;
        const cx = Math.max(b.x0, Math.min(pos.x, b.x1)), cz = Math.max(b.z0, Math.min(pos.z, b.z1));
        let dx = pos.x - cx, dz = pos.z - cz; const d2 = dx * dx + dz * dz;
        if (d2 >= rad * rad) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), p = rad - d; pos.x += dx / d * p; pos.z += dz / d * p;
          const vn = (vel.x * dx + vel.z * dz) / d; if (vn < 0) { vel.x -= dx / d * vn; vel.z -= dz / d * vn; }
        } else {
          // centre inside the box: leave by the nearest side
          const o = [pos.x - b.x0, b.x1 - pos.x, pos.z - b.z0, b.z1 - pos.z], i = o.indexOf(Math.min(...o));
          if (i === 0) pos.x = b.x0 - rad; else if (i === 1) pos.x = b.x1 + rad; else if (i === 2) pos.z = b.z0 - rad; else pos.z = b.z1 + rad;
        }
      }
      for (const r of this.ramps) { // the high sides of ramps are walls too
        const hh = this.rampH(r, pos.x, pos.z);
        if (r.noWall || hh === null || hh <= top + STEP || r.base >= pos.y + h) continue;
        const cx = Math.max(r.x0, Math.min(pos.x, r.x1)), cz = Math.max(r.z0, Math.min(pos.z, r.z1));
        const o = [pos.x - r.x0, r.x1 - pos.x, pos.z - r.z0, r.z1 - pos.z], i = o.indexOf(Math.min(...o));
        if (i === 0) pos.x = r.x0 - rad; else if (i === 1) pos.x = r.x1 + rad; else if (i === 2) pos.z = r.z0 - rad; else pos.z = r.z1 + rad;
        void cx; void cz;
      }
    }
    // ceilings
    if (vel.y > 0) for (const b of this.boxes) {
      if (pos.x < b.x0 || pos.x > b.x1 || pos.z < b.z0 || pos.z > b.z1) continue;
      if (b.y0 > pos.y + STEP && pos.y + h > b.y0) { pos.y = b.y0 - h; vel.y = 0; }
    }
    const g = this.groundHeight(pos.x, pos.z, top);
    if (vel.y <= 0 && pos.y <= g + 0.02) { pos.y = g; vel.y = 0; return true; }
    if (wasGround && vel.y <= 0 && pos.y - g < 0.4) { pos.y = g; vel.y = 0; return true; } // stick to ramps going down
    return false;
  }
  padAt(pos) {
    for (const p of this.pads) if (Math.abs(pos.y - p.y) < 0.4 && (pos.x - p.x) ** 2 + (pos.z - p.z) ** 2 < p.r * p.r) return p;
    return null;
  }
  /** Can someone walk straight from a to b on roughly one level? */
  directPath(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
    let y = a.y; const n = Math.ceil(L / 0.7);
    for (let i = 1; i <= n; i++) {
      const x = a.x + dx * i / n, z = a.z + dz * i / n;
      if (this.wallAt(x, z, y, 1.7, 0.25)) return false;
      const g = this.groundHeight(x, z, y);
      if (g < y - 0.8 || !isFinite(g)) return false;
      y = g;
    }
    return Math.abs(y - b.y) < 0.9;
  }
  nearestNode(p) {
    let best = null, bd = Infinity;
    for (const n of this.nodes) {
      if (n.gone) continue; // on a platform that has fallen
      const dy = Math.abs(n.p.y - p.y), d = Math.hypot(n.p.x - p.x, n.p.z - p.z) + dy * 4 + (dy > 1.5 ? 50 : 0);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  path(from, to) {
    const s = this.nearestNode(from), g = this.nearestNode(to);
    if (!s || !g) return [];
    if (s === g) return [g];
    const dist = new Map([[s, 0]]), prev = new Map(), open = [s], done = new Set();
    while (open.length) {
      open.sort((a, b) => (dist.get(a) + a.p.distanceTo(g.p)) - (dist.get(b) + b.p.distanceTo(g.p)));
      const u = open.shift(); if (u === g) break; if (done.has(u)) continue; done.add(u);
      for (const e of u.edges) {
        if (e.to.gone) continue;
        const nd = dist.get(u) + u.p.distanceTo(e.to.p);
        if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, { n: u, type: e.type }); open.push(e.to); }
      }
    }
    if (!prev.has(g)) return [];
    const out = []; let c = g;
    while (c !== s) { out.unshift(c); c = prev.get(c).n; }
    out.unshift(s);
    return out;
  }
  /** First hit along a ray: solid boxes, plus grapple-only things (bamboo, branch logs) you can hook but pass through. */
  raycast(o, d, max) {
    let best = max, hit = null;
    for (const list of [this.boxes, this.rayBoxes]) for (const b of list) {
      let t0 = 0, t1 = best;
      for (const [oa, da, lo, hi] of [[o.x, d.x, b.x0, b.x1], [o.y, d.y, b.y0, b.y1], [o.z, d.z, b.z0, b.z1]]) {
        if (Math.abs(da) < 1e-9) { if (oa < lo || oa > hi) { t0 = Infinity; break; } continue; }
        let a = (lo - oa) / da, c = (hi - oa) / da; if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) break;
      }
      if (t0 <= t1 && t0 > 0.3 && t0 < best) { best = t0; hit = b; }
    }
    return hit ? { dist: best, point: new THREE.Vector3().copy(o).addScaledVector(d, best) } : null;
  }
  /** Grapple target: straight ahead if that hits; otherwise the best surface in a cone in front. */
  grappleTarget(o, d, max = 55) {
    const direct = this.raycast(o, d, max);
    if (direct) return direct;
    let best = null, bs = -Infinity; const v = new THREE.Vector3(), dir = new THREE.Vector3();
    for (let i = 0; i < 40; i++) { // probe a cone around the aim, favouring the centre and upward
      const a = (i / 40) * Math.PI * 2 * 3.7, r = 0.05 + (i / 40) * 0.42;
      dir.copy(d); v.set(-d.z, 0, d.x).normalize();
      const up = new THREE.Vector3().crossVectors(v, d).normalize();
      dir.addScaledVector(v, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      const h = this.raycast(o, dir, max);
      if (!h) continue;
      const sc = dir.dot(d) * 3 + dir.y * 0.6 - h.dist * 0.01;
      if (sc > bs) { bs = sc; best = h; }
    }
    return best;
  }

  // ---------- platforms that can be rotated (and, for branches, sloped) ----------
  // A platform is a rectangle w long (along angle `ang`) by d wide, centred on (x, z); a branch also
  // slopes from height ya at one end to yb at the other.
  platFrame(p, q) { const a = p.ang || 0, ux = Math.cos(a), uz = Math.sin(a), dx = q.x - p.x, dz = q.z - p.z; return [dx * ux + dz * uz, -dx * uz + dz * ux]; }
  inPlat(p, q, m) { const [a, b] = this.platFrame(p, q); return Math.abs(a) < p.w / 2 + m && Math.abs(b) < p.d / 2 + m; }
  platTop(p, q) { if (p.ya === undefined) return p.y; const [a] = this.platFrame(p, q); const t = Math.max(0, Math.min(1, a / p.w + 0.5)); return p.ya + (p.yb - p.ya) * t; }
  rimDist(p, q) {
    const [a, b] = this.platFrame(p, q);
    const ca = Math.max(-p.w / 2, Math.min(a, p.w / 2)), cb = Math.max(-p.d / 2, Math.min(b, p.d / 2));
    return Math.hypot(a - ca, b - cb);
  }
  // the point on a platform's top edge closest to q
  rimPoint(p, q) {
    const [a, b] = this.platFrame(p, q);
    let ca = Math.max(-p.w / 2, Math.min(a, p.w / 2)), cb = Math.max(-p.d / 2, Math.min(b, p.d / 2));
    if (Math.abs(ca) < p.w / 2 && Math.abs(cb) < p.d / 2) { // above/below it: use the nearest side
      const o = [ca + p.w / 2, p.w / 2 - ca, cb + p.d / 2, p.d / 2 - cb], i = o.indexOf(Math.min(...o));
      if (i === 0) ca = -p.w / 2; else if (i === 1) ca = p.w / 2; else if (i === 2) cb = -p.d / 2; else cb = p.d / 2;
    }
    const an = p.ang || 0, ux = Math.cos(an), uz = Math.sin(an);
    const x = p.x + ux * ca - uz * cb, z = p.z + uz * ca + ux * cb;
    return new THREE.Vector3(x, this.platTop(p, { x, z }) - 0.15, z);
  }

  // ---------- crumbling platforms (Last Blade Standing) ----------
  // On the canopy a whole branch (its segments and leaves) crumbles together.
  groupOf(i) { const p = this.plats[i]; return !p ? [] : p.group === undefined ? [p] : this.plats.filter((q) => q.group === p.group); }
  /** Show (or clear, with -1) the red "about to fall" glow on a platform (or branch). */
  warnPlatform(i) {
    const keep = new Set(this.groupOf(i));
    for (const p of this.plats) if (p.warn && !keep.has(p)) { this.scene.remove(p.warn); p.warn.geometry.dispose(); p.warn = null; }
    for (const p of keep) {
      if (p.gone || p.warn) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.3, 0.14, p.d + 0.3), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.35, depthWrite: false }));
      const an = p.ang || 0, ux = Math.cos(an), uz = Math.sin(an);
      if (p.ya !== undefined) { // follow the branch's slope
        const dir = new THREE.Vector3(ux * p.w, p.yb - p.ya, uz * p.w).normalize();
        m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      } else m.rotation.y = -an;
      m.position.set(p.x, (p.ya !== undefined ? (p.ya + p.yb) / 2 : p.y) + 0.08, p.z); this.scene.add(m); p.warn = m;
      this.anim.push((t) => { if (p.warn === m) m.material.opacity = 0.2 + 0.25 * (0.5 + 0.5 * Math.sin(t * 14)); });
    }
  }
  /** Remove a platform (and the rest of its branch): it stops being solid, its pads and waypoints go, and it falls. */
  dropPlatform(i) {
    const group = this.groupOf(i).filter((p) => !p.gone); if (!group.length) return;
    this.dirty = true;
    const falling = [];
    for (const p of group) {
      p.gone = true;
      if (p.warn) { this.scene.remove(p.warn); p.warn = null; }
      const deadB = new Set(p.boxes), deadR = new Set(p.ramps || []), deadRay = new Set(p.rays || []);
      this.boxes = this.boxes.filter((b) => !deadB.has(b));
      this.ramps = this.ramps.filter((r) => !deadR.has(r));
      this.rayBoxes = this.rayBoxes.filter((b) => !deadRay.has(b));
      falling.push(...p.meshes);
      for (const pad of this.pads) if (pad.from === p.i || pad.to === p.i) { pad.gone = true; falling.push(...pad.meshes); }
      for (const n of this.nodes) if (n.plat === p.i || n.to === p.i) n.gone = true;
    }
    this.pads = this.pads.filter((pad) => !pad.gone);
    let v = 0;
    this.anim.push((t, dt) => {
      if (!falling.length) return;
      v += 45 * (dt || 1 / 60); // plunges fast
      for (const m of falling) { m.position.y -= v * (dt || 1 / 60); }
      if (v > 140) { for (const m of falling) this.scene.remove(m); falling.length = 0; }
    });
  }

  // ---------- bamboo (canopy): grapple onto it, pass through it, cut it with a sword ----------
  addBambooSeg(s, y0, y1) {
    const st = this.bamboo[s], len = y1 - y0; if (len < 0.4) return;
    const geo = new THREE.CylinderGeometry(st.r, st.r, len, 8, 1);
    const uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) + (y0 + y1) / 2) / 2.6); // nodes every 2.6 m, wherever it's cut
    uv.needsUpdate = true;
    const m = new THREE.Mesh(geo, this.mats.bamboo); m.position.set(st.x, (y0 + y1) / 2, st.z); m.castShadow = false;
    this.scene.add(m);
    const box = { x0: st.x - st.r, x1: st.x + st.r, y0, y1, z0: st.z - st.r, z1: st.z + st.r, bamboo: s };
    this.rayBoxes.push(box);
    st.segs.push({ y0, y1, mesh: m, box });
  }
  /** Cut stalk s at height y: a short piece drops out, leaving the parts above (hanging from the roof) and below. */
  cutBamboo(s, y) {
    const st = this.bamboo[s]; if (!st) return null;
    const seg = st.segs.find((g) => y > g.y0 + 0.2 && y < g.y1 - 0.2); if (!seg) return null;
    st.segs = st.segs.filter((g) => g !== seg);
    this.scene.remove(seg.mesh); seg.mesh.geometry.dispose();
    this.rayBoxes = this.rayBoxes.filter((b) => b !== seg.box);
    this.addBambooSeg(s, seg.y0, y - 0.55); this.addBambooSeg(s, y + 0.55, seg.y1);
    // the cut-out piece tumbles away
    const chunk = new THREE.Mesh(new THREE.CylinderGeometry(st.r, st.r, 1.1, 8), this.mats.bamboo);
    chunk.position.set(st.x, y, st.z); this.scene.add(chunk);
    const vx = (Math.random() - 0.5) * 4, vz = (Math.random() - 0.5) * 4, spin = (Math.random() - 0.5) * 10; let vy = 2, life = 4;
    this.anim.push((t, dt) => {
      if (life <= 0) return; dt = dt || 1 / 60; life -= dt;
      vy -= 24 * dt; chunk.position.x += vx * dt; chunk.position.z += vz * dt; chunk.position.y += vy * dt; chunk.rotation.z += spin * dt; chunk.rotation.x += spin * 0.6 * dt;
      if (life <= 0) { this.scene.remove(chunk); chunk.geometry.dispose(); }
    });
    this.dirty = true;
    return new THREE.Vector3(st.x, y, st.z);
  }
  update(t) { const dt = this.lastT ? Math.min(0.1, t - this.lastT) : 0; this.lastT = t; for (const f of this.anim) f(t, dt); }
}
