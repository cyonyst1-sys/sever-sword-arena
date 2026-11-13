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
};

export class Arena {
  constructor(scene, quality, mapId = 'spire') {
    // everything the map adds lives under one group, so switching maps can remove it all
    this.realScene = scene; this.root = new THREE.Group(); scene.add(this.root);
    this.scene = this.root; this.quality = quality; this.mapId = MAPS[mapId] ? mapId : 'spire';
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
      const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, z0 = p.z - p.d / 2, z1 = p.z + p.d / 2;
      this.addBox(x0, x1, p.y - 0.35, p.y, z0, z1, M.floor);
      this.addBox(x0 + 0.2, x1 - 0.2, p.y - 2.2, p.y - 0.35, z0 + 0.2, z1 - 0.2, M.stone);
      const rad = Math.min(p.w, p.d) * 0.6, h = big ? 14 + r() * 10 : 5 + r() * 8;
      const cone = new THREE.ConeGeometry(rad, h, 8, 3); cone.rotateX(Math.PI);
      const cp = cone.attributes.position;
      for (let i = 0; i < cp.count; i++) { const y = cp.getY(i); if (y < h / 2 - 0.01) { const s = 1 + (r() - 0.5) * 0.4; cp.setX(i, cp.getX(i) * s); cp.setZ(i, cp.getZ(i) * s); } }
      cone.translate(p.x, p.y - 2.2 - h / 2, p.z); cone.computeVertexNormals();
      S.add(new THREE.Mesh(cone, M.rock));
      this.node('P' + p.i, p.x, p.y, p.z);
      this.spawns.push(new THREE.Vector3(p.x + (r() - 0.5) * 3, p.y, p.z + (r() - 0.5) * 3));
      if (big) { // big platforms: spawn spots and walking waypoints in each quarter too
        for (const [qx, qz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const x = p.x + qx * p.w / 4, z = p.z + qz * p.d / 4;
          this.spawns.push(new THREE.Vector3(x, p.y, z));
          this.node(`Q${p.i}_${qx}${qz}`, x, p.y, z); this.link('P' + p.i, `Q${p.i}_${qx}${qz}`);
        }
      }
    }

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
        this.addPad(pa.x, a.y, pa.z, la.x, b.y, la.z, T); this.addPad(pb.x, b.y, pb.z, lb.x, a.y, lb.z, T);
        padSpots.get(a.i).push(pa, lb); padSpots.get(b.i).push(pb, la);
        this.node(`D${a.i}_${b.i}`, pa.x, a.y, pa.z); this.node(`D${b.i}_${a.i}`, pb.x, b.y, pb.z);
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
        c.position.set(p.x + cx * (p.w / 2 - 0.5), p.y + 0.6, p.z + cz * (p.d / 2 - 0.5)); c.scale.y = 1.8; S.add(c);
      }
    }

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
    for (const r of this.ramps) { const h = this.rampH(r, x, z); if (h !== null && h <= y + STEP && h > g) g = h; }
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
        if (hh === null || hh <= top + STEP || r.base >= pos.y + h) continue;
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
