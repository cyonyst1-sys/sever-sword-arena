// The map: a floating island with a stepped central ziggurat, a floating crown platform, four towers joined
// to the crown by sky bridges, ramps, jump pads and cover. Everything solid is an axis-aligned box or a ramp,
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

export class Arena {
  constructor(scene, quality) {
    this.scene = scene; this.quality = quality;
    this.boxes = []; this.ramps = []; this.pads = []; this.nodes = []; this.nodeMap = new Map(); this.spawns = []; this.anim = [];
    this.mats = {
      stone: new THREE.MeshStandardMaterial({ map: stoneTex(150, 5), roughness: 0.92 }),
      dark: new THREE.MeshStandardMaterial({ map: stoneTex(110, 9), roughness: 0.95 }),
      floor: new THREE.MeshStandardMaterial({ map: floorTex(), roughness: 0.95 }),
      wood: new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.85 }),
      rock: new THREE.MeshStandardMaterial({ color: 0x5b5148, roughness: 1, flatShading: true }),
    };
    this.build();
  }

  // ---------- building ----------
  addBox(x0, x1, y0, y1, z0, z1, mat, opts = {}) {
    const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    worldUV(geo, 0.5);
    const m = new THREE.Mesh(geo, mat || this.mats.stone);
    m.castShadow = m.receiveShadow = true; this.scene.add(m);
    if (opts.solid !== false) this.boxes.push({ x0, x1, y0, y1, z0, z1 });
    return m;
  }
  addBoxR(k, x0, x1, y0, y1, z0, z1, mat, opts) {
    const [ax, az] = Q(k, x0, z0), [bx, bz] = Q(k, x1, z1);
    return this.addBox(Math.min(ax, bx), Math.max(ax, bx), y0, y1, Math.min(az, bz), Math.max(az, bz), mat, opts);
  }
  // a ramp rising from point L (height hL) to point H (height hH), w wide, sitting on `base`
  addRamp(lx, lz, hx, hz, hL, hH, w, base, mat) {
    const dx = hx - lx, dz = hz - lz, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
    const px = -uz * w / 2, pz = ux * w / 2;
    const xs = [lx + px, lx - px, hx + px, hx - px], zs = [lz + pz, lz - pz, hz + pz, hz - pz];
    const r = { lx, lz, ux, uz, len, w, hL, hH, base, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
    this.ramps.push(r);
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
  addPad(x, y, z, tx, ty, tz, T) {
    const G = 24;
    const v = new THREE.Vector3((tx - x) / T, (ty - y + 0.5 * G * T * T) / T, (tz - z) / T);
    this.pads.push({ x, y, z, r: 1.0, v });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.18, 24), this.mats.dark);
    base.position.set(x, y + 0.09, z); base.receiveShadow = true; this.scene.add(base);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 24), new THREE.MeshBasicMaterial({ color: 0x55e0ff }));
    glow.position.set(x, y + 0.2, z); this.scene.add(glow);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 28), new THREE.MeshBasicMaterial({ color: 0x9ff3ff, transparent: true, opacity: 0.8 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(x, y + 0.25, z); this.scene.add(ring);
    this.anim.push((t) => { const k = (t * 0.9) % 1; ring.position.y = y + 0.25 + k * 2.2; ring.material.opacity = 0.8 * (1 - k); ring.scale.setScalar(1 - k * 0.35); });
  }
  node(name, x, y, z) { const n = { name, id: this.nodes.length, p: new THREE.Vector3(x, y, z), edges: [] }; this.nodes.push(n); this.nodeMap.set(name, n); return n; }
  link(a, b, type = 'walk', both = true) {
    const A = this.nodeMap.get(a), B = this.nodeMap.get(b);
    A.edges.push({ to: B, type }); if (both) B.edges.push({ to: A, type });
  }

  build() {
    const S = this.scene, M = this.mats;
    // sky & light
    S.background = new THREE.Color(0x9cc4e4);
    S.fog = new THREE.Fog(0xa9cbe6, 70, 220);
    S.add(new THREE.HemisphereLight(0xd8ecff, 0x5a4a38, 0.85));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.0);
    sun.position.set(30, 50, 18);
    if (this.quality !== 'low') {
      sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
      const c = sun.shadow.camera; c.left = c.bottom = -38; c.right = c.top = 38; c.near = 1; c.far = 140;
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    }
    S.add(sun);
    // sky dome gradient
    const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x3f7fc4) }, mid: { value: new THREE.Color(0xa9cbe6) }, bot: { value: new THREE.Color(0xe7eef3) } },
      vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vp; void main(){ float h = normalize(vp).y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.6)) : mix(mid, bot, min(1.0, -h * 3.0)); gl_FragColor = vec4(c, 1.0); }',
    }));
    S.add(dome);
    // cloud sea far below
    const clouds = new THREE.Mesh(new THREE.CircleGeometry(400, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2f5f8, fog: false, transparent: true, opacity: 0.9 }));
    clouds.position.y = -60; S.add(clouds);

    // island
    const R = ISLAND_R;
    const top = new THREE.CylinderGeometry(R, R - 0.6, 1.4, 72, 1);
    top.translate(0, -0.7, 0); worldUV(top, 0.25);
    const topMesh = new THREE.Mesh(top, M.floor); topMesh.receiveShadow = true; S.add(topMesh);
    const under = new THREE.ConeGeometry(R - 0.6, 20, 36, 6);
    under.rotateX(Math.PI); under.translate(0, -1.4 - 10, 0);
    const up = under.attributes.position, r = rng(21);
    for (let i = 0; i < up.count; i++) { const y = up.getY(i); if (y < -1.5) { const s = 1 + (r() - 0.5) * 0.35; up.setX(i, up.getX(i) * s); up.setZ(i, up.getZ(i) * s); up.setY(i, y + (r() - 0.5) * 1.5); } }
    under.computeVertexNormals();
    S.add(new THREE.Mesh(under, M.rock));
    // floating rocks for scenery
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2 + r(), d = 50 + r() * 70, s = 2 + r() * 7;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), M.rock);
      m.position.set(Math.cos(a) * d, -10 + r() * 30, Math.sin(a) * d); m.rotation.set(r() * 3, r() * 3, r() * 3); m.scale.y = 0.6;
      S.add(m);
      const bob = r() * 6; this.anim.push((t) => { m.position.y += Math.sin(t * 0.5 + bob) * 0.004; });
    }

    // ziggurat
    this.addBox(-7, 7, 0, 1.2, -7, 7, M.stone);
    this.addBox(-4.5, 4.5, 1.2, 2.6, -4.5, 4.5, M.stone);
    this.addBox(-2.5, 2.5, 2.6, 4.0, -2.5, 2.5, M.stone);
    // the crown, floating above, held up by four thin columns
    this.addBox(-3, 3, 6.6, 7.0, -3, 3, M.wood);
    for (const [x, z] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) this.addBox(x - 0.2, x + 0.2, 4.0, 6.6, z - 0.2, z + 0.2, M.dark);

    for (let k = 0; k < 4; k++) {
      // ramps up the ziggurat on every side, in one straight line
      this.addRampR(k, 0, 11, 0, 7, 0, 1.2, 3, 0);
      this.addRampR(k, 0, 7, 0, 4.5, 1.2, 2.6, 2.4, 1.2);
      this.addRampR(k, 0, 4.5, 0, 2.5, 2.6, 4.0, 2.0, 2.6);
      // tower, its ramp and landing, and the sky bridge to the crown
      this.addBoxR(k, -3, 3, 0, 7, 19, 25, M.stone);
      this.addBoxR(k, 3, 5.5, 0, 7, 22, 25, M.stone);
      this.addRampR(k, 4.25, 9, 4.25, 22, 0, 7, 2.5, 0);
      this.addBoxR(k, -1.25, 1.25, 6.6, 7.0, 3, 19, M.wood);
      // battlements on the tower top
      this.addBoxR(k, -3, -2.2, 7, 7.9, 24.2, 25, M.stone);
      this.addBoxR(k, -0.4, 0.4, 7, 7.9, 24.2, 25, M.stone);
      this.addBoxR(k, 2.2, 3, 7, 7.9, 24.2, 25, M.stone);
      this.addBoxR(k, -3, -2.2, 7, 7.9, 19, 19.8, M.stone);
      this.addBoxR(k, 2.2, 3, 7, 7.9, 19, 19.8, M.stone);
      // cover on the ground and tier one
      this.addBoxR(k, 5.5, 6.5, 1.2, 3.6, 5.5, 6.5, M.dark);
      this.addBoxR(k, -6, -2.2, 0, 1.1, 15, 15.6, M.stone);
      this.addBoxR(k, 8.5, 9.5, 0, 3.2, 15.5, 16.5, M.dark);
      this.addBoxR(k, 6.9, 8.1, 0, 1.2, 14.4, 15.6, M.wood);
      this.addBoxR(k, 15, 17, 0, 1.0, 5, 5.7, M.stone);
      // jump pad: from the ground straight onto the crown
      const [px, pz] = Q(k, 9.5, 9.5);
      this.addPad(px, 0, pz, 0, 7.0, 0, 1.15);
      // banner
      const [bx, bz] = Q(k, 0, 25.05);
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.2), new THREE.MeshStandardMaterial({ color: [0xb8202e, 0x2e6fd6, 0xe0a422, 0x2f9e5b][k], side: THREE.DoubleSide, roughness: 0.8 }));
      ban.position.set(bx, 5, bz); ban.rotation.y = -k * Math.PI / 2; S.add(ban);
      // glowing crystals at the rim
      for (let j = 0; j < 3; j++) {
        const a = (k * 3 + j) / 12 * Math.PI * 2 + 0.26;
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0x7fe8ff, emissive: 0x2fb8e0, emissiveIntensity: 1.2, flatShading: true }));
        c.position.set(Math.cos(a) * (R - 1.2), 0.9, Math.sin(a) * (R - 1.2)); c.scale.y = 1.8; S.add(c);
        this.anim.push((t) => { c.rotation.y = t * 0.6 + a; });
      }
    }

    // sky pillars: grapple anchors that rise far into the sky, on the island and out over the void
    this.grapples = [];
    const pillar = (x, z, w, y0) => {
      const m = this.addBox(x - w / 2, x + w / 2, y0, 70, z - w / 2, z + w / 2, M.dark);
      m.castShadow = false;
      // glowing rings mark them as grapple points
      for (let y = 10; y < 70; y += 12) {
        const ring = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.25, w + 0.12), new THREE.MeshBasicMaterial({ color: 0x7fe8ff }));
        ring.position.set(x, y, z); S.add(ring);
      }
    };
    for (let k = 0; k < 4; k++) {
      for (const [x, z, w, y0] of [[12, 21, 1.6, 0], [21, 9, 1.6, 0], [24.5, 24.5, 2.0, -60], [37, 8, 2.2, -60], [8, 37, 2.2, -60]]) {
        const [a, b] = Q(k, x, z); pillar(a, b, w, y0);
      }
    }
    pillar(0, 0, 1.2, 7.0); // spire above the crown

    // navigation graph for bots
    this.node('C3', 0, 4, 0); this.node('CR', 0, 7, 0);
    for (let k = 0; k < 4; k++) {
      const n = (name, x, y, z) => { const [a, b] = Q(k, x, z); this.node(name + k, a, y, b); };
      n('A', 0, 0, 12); n('R0', 4.25, 0, 7.8); n('R1', 4.25, 7, 23.5); n('T', 0, 7, 22); n('BR', 0, 7, 12);
      n('X', 2.7, 0, 12.5); n('D', 13, 0, 13); n('P', 9.5, 0, 9.5);
    }
    for (let k = 0; k < 4; k++) {
      this.link('A' + k, 'C3'); this.link('A' + k, 'R0' + k); this.link('R0' + k, 'R1' + k); this.link('R1' + k, 'T' + k);
      this.link('T' + k, 'BR' + k); this.link('BR' + k, 'CR'); this.link('BR' + k, 'X' + k, 'drop', false); this.link('X' + k, 'A' + k);
      this.link('A' + k, 'D' + k); this.link('D' + k, 'A' + ((k + 3) % 4)); this.link('D' + k, 'P' + k); this.link('P' + k, 'CR', 'pad', false);
    }
    // spawn points
    for (let k = 0; k < 4; k++) {
      for (const [x, y, z] of [[-9, 0, 17.5], [16, 0, 16], [0, 7, 22]]) { const [a, b] = Q(k, x, z); this.spawns.push(new THREE.Vector3(a, y, b)); }
    }
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
    if (x * x + z * z <= ISLAND_R * ISLAND_R && 0 <= y + STEP) g = 0;
    for (const b of this.boxes) if (x >= b.x0 - m && x <= b.x1 + m && z >= b.z0 - m && z <= b.z1 + m && b.y1 <= y + STEP && b.y1 > g) g = b.y1;
    for (const r of this.ramps) { const h = this.rampH(r, x, z); if (h !== null && h <= y + STEP && h > g) g = h; }
    return g;
  }
  /** Is there a wall at (x,z) for a body standing at feet height y? */
  wallAt(x, z, y, h = 1.7, m = 0.3) {
    for (const b of this.boxes) if (x >= b.x0 - m && x <= b.x1 + m && z >= b.z0 - m && z <= b.z1 + m && b.y1 > y + STEP && b.y0 < y + h) return true;
    return false;
  }
  /** Push a standing cylinder (feet at pos.y) out of walls; handles ceilings. Returns true if grounded. */
  collide(pos, vel, rad, h, wasGround) {
    for (let it = 0; it < 2; it++) {
      for (const b of this.boxes) {
        if (b.y1 <= pos.y + STEP || b.y0 >= pos.y + h) continue;
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
        if (hh === null || hh <= pos.y + STEP || r.base >= pos.y + h) continue;
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
    const g = this.groundHeight(pos.x, pos.z, pos.y);
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
  /** First solid hit along a ray (boxes only: platforms, towers, pillars). */
  raycast(o, d, max) {
    let best = max, hit = null;
    for (const b of this.boxes) {
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
  update(t) { for (const f of this.anim) f(t); }
}
