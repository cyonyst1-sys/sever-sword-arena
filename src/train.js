// Bullet Train: a fight on the roofs of a very long train racing through forest, snowy mountains, desert canyon, sea coast
// and a city at night. The train never moves: the world streams past it (like Branch Run), bent along the track, which runs
// straight and level most of the way with a bend here and a rise there; the cars follow it like a chain. Over valleys there's open air under
// the train: hook its undercarriage and swing under and back up. Tunnels sweep anyone off the roofs (drop into a flatbed,
// fight by the lamplight); signal arms swing out over the train (jump the low ones, get off the roof for the high ones).
// Only the train can be hooked. Everything runs on the wall clock, so every player sees the same run.
import * as THREE from 'three';

const TAU = Math.PI * 2;
export const TRAIN = { V: 38, SEG: 150, NSEG: 60, BIOME: 12 };
const LOOP = TRAIN.SEG * TRAIN.NSEG; // (the run repeats after this many metres: everything is periodic in it)
// the track: dead straight and level most of the way, with a bend here and a rise there. Each entry [s, offset]: at s
// metres into the run the track starts easing over to that offset, taking BW (or HW_) metres about it; then it runs
// straight again until the next. Both end back at 0, so the run loops.
const BENDS = [[400, 13], [1400, 0], [2500, -14], [3500, 0], [4700, 11], [5600, 0], [6500, -12], [7400, 0]], BW = 380;
const HILLS = [[900, 3.2], [1900, 0], [3700, -3], [4300, 0], [5700, 4], [6700, 0], [7700, -2.6], [8550, 0]], HW_ = 320;
const steps = (tab) => tab.map(([s, x], i) => [s, x - (i ? tab[i - 1][1] : 0)]);
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10));
const along = (tab, w) => { const d = steps(tab); return (s) => { s = ((s % LOOP) + LOOP) % LOOP; let x = 0; for (const [s0, dx] of d) x += dx * ease((s - s0) / w); return x; }; };
export const PX = along(BENDS, BW), PY = along(HILLS, HW_); // (the track: where it is sideways and how high, s metres into the run)
const glsl = (tab, w) => steps(tab).map(([s0, dx]) => `ez((s - ${s0.toFixed(1)}) / ${w.toFixed(1)}) * (${dx.toFixed(3)})`).join(' + ');
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// what each stretch of track is: G ground, B bridge, T tunnel (a valley is four stretches of bridge, a tunnel two)
const PATTERN = 'GGBBBBGGGTTG' + 'GBBBBGGTTGGG' + 'GGGBBBBGTTGG' + 'GBBBBGGGTTGG' + 'GGTTGBBBBGGG';
export const segType = (i) => PATTERN[((i % TRAIN.NSEG) + TRAIN.NSEG) % TRAIN.NSEG];
const biomeOf = (i) => Math.floor((((i % TRAIN.NSEG) + TRAIN.NSEG) % TRAIN.NSEG) / TRAIN.BIOME) % 5;
const CEIL = 5.6, WALLX = 7.6, HW = 4.8, ROOF = 4.2, DECK = 1.6, GD = -26, GORGE = 170; // (GORGE: half the width of a valley, cliff to cliff) // (GD: the ground, far below the viaduct) // tunnel ceiling and walls, car roof and flatbed deck (above the rails)

const BIOMES = [ // sky top / horizon / below, fog, light, ground
  { name: 'forest', top: 0x4a7cc0, mid: 0xcfe0d0, bot: 0x7a9a68, fog: 0xb8d0b8, hemi: 1.0, sun: 2.2, ground: 0x4a7a34 },
  { name: 'snow', top: 0x7a98c8, mid: 0xe6eef6, bot: 0xffffff, fog: 0xdde6f0, hemi: 1.15, sun: 2.0, ground: 0xe8eef6 },
  { name: 'desert', top: 0x3a6aa8, mid: 0xf0c890, bot: 0xd8a070, fog: 0xeac498, hemi: 1.1, sun: 2.5, ground: 0xd2a874 },
  { name: 'coast', top: 0x3a7ad0, mid: 0xbfe0f0, bot: 0xe0f0ff, fog: 0xc8e0ee, hemi: 1.1, sun: 2.3, ground: 0x6a8a4a },
  { name: 'city', top: 0x04061a, mid: 0x1c1a4a, bot: 0x0a0a1e, fog: 0x1c1a48, hemi: 0.75, sun: 0.9, ground: 0x23262e },
];

export function buildTrain(A, T) {
  const S = A.scene, low = A.quality === 'low';
  A.plats = []; A.pillars = []; A.killY = -60; A.trainMap = true;
  A.setSky({ top: BIOMES[0].top, mid: BIOMES[0].mid, bot: BIOMES[0].bot, fog: BIOMES[0].fog, near: 90, far: 360, hemiSky: 0xffffff, hemiGround: 0x6a6050, hemi: 1.0, sunColor: 0xfff0d8, sun: 2.2, sunOff: new THREE.Vector3(30, 60, -20) });
  let hemi = null, dome = null; S.traverse((o) => { if (o.isHemisphereLight) hemi = o; if (o.material && o.material.uniforms && o.material.uniforms.top) dome = o.material.uniforms; });

  // ---- bending: every piece of the world is drawn bent along the track (a shader offset by where it is along the run)
  const uS = { value: 0 }, uCr = { value: 1e9 }; // (uCr: how far back along the train the track starts to crumble away)
  const GLSL = `uniform float uS; uniform float uCr; float ez(float t) { t = clamp(t, 0.0, 1.0); return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
    vec3 pathOff(float s) { s = mod(s, ${LOOP.toFixed(1)}); return vec3(${glsl(BENDS, BW)}, ${glsl(HILLS, HW_)}, 0.0); }\n`;
  const bend = (m, crumble) => { m.onBeforeCompile = (sh) => { sh.uniforms.uS = uS; sh.uniforms.uCr = uCr; sh.vertexShader = (crumble ? '#define CRUMBLE\n' : '') + GLSL + sh.vertexShader.replace('#include <project_vertex>', `vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      vec4 wP = modelMatrix * mvPosition;
      #ifdef CRUMBLE
        // the track behind the train is falling to pieces: each piece (an instance) drops away once the last car has
        // passed over it, tumbling as it goes. Its own number comes from where it lies along the run, so it never changes.
        #ifdef USE_INSTANCING
          vec3 pO = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #else
          vec3 pO = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #endif
        vec3 pn = vec3(floor((uS - pO.z) * 2.0 + 0.5), floor(pO.x * 4.0 + 0.5), floor(pO.y + 0.5));
        vec3 pr = fract(sin(vec3(dot(pn, vec3(0.137, 1.71, 0.93)), dot(pn, vec3(0.291, 0.57, 2.31)), dot(pn, vec3(0.413, 3.13, 1.27)))) * 43758.5453);
        float ct = max(0.0, pO.z - uCr - pr.x * 9.0) / 38.0;
        if (ct > 0.0) {
          vec3 pd = wP.xyz - pO; float ca = cos(ct * (1.2 + 2.6 * pr.y)), sa = sin(ct * (1.2 + 2.6 * pr.y)), cb = cos(ct * (pr.z - 0.5) * 3.6), sb = sin(ct * (pr.z - 0.5) * 3.6);
          pd.yz = vec2(pd.y * ca - pd.z * sa, pd.y * sa + pd.z * ca); pd.xy = vec2(pd.x * cb - pd.y * sb, pd.x * sb + pd.y * cb);
          wP.xyz = pO + pd; wP.y -= 12.0 * ct * ct; wP.x += (pr.z - 0.5) * 5.0 * ct;
        }
      #endif
      wP.xyz += pathOff(uS - wP.z); mvPosition = viewMatrix * wP; gl_Position = projectionMatrix * mvPosition;`); };
    m.customProgramCacheKey = () => (crumble ? 'trainbendC' : 'trainbend'); return m; };
  const std = (color, o = {}) => bend(new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o }));
  const brk = (color, o = {}) => bend(new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o }), true); // (for what the track is made of: it falls away behind the train)

  // ---- the train: 14 cars, front (the engine) toward -z where the world comes from
  const steelM = new THREE.MeshStandardMaterial({ color: 0x3a3e46, metalness: 0.7, roughness: 0.4 }), darkM = new THREE.MeshStandardMaterial({ color: 0x15161a, metalness: 0.6, roughness: 0.5 });
  const roofT = T.canvasTex((g, s) => { g.fillStyle = '#4a4e56'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 8) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y, s, 2); } for (let x = 0; x < s; x += 32) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, 0, 3, s); } T.speckle(g, s, T.rng(4), 2000, 0.15); }, 128);
  roofT.repeat.set(3, 18);
  const roofM = new THREE.MeshStandardMaterial({ map: roofT, metalness: 0.5, roughness: 0.55 });
  const winT = T.canvasTex((g, s) => { g.fillStyle = '#0c1018'; g.fillRect(0, 0, s, s); for (let x = 0; x < 8; x++) { g.fillStyle = '#9ad0ff'; g.fillRect(x * s / 8 + 4, s * 0.3, s / 8 - 8, s * 0.4); } }, 128); winT.repeat.set(3, 1);
  const L = 57, GAP = 2.4, PITCH = L + GAP, NC = 7, Z0 = -(NC * PITCH) / 2 + L / 2; uCr.value = NC * PITCH / 2 - 5; // (the track gives way right under the tail of the last car)
  const TYPES = ['engine', 'flat', 'flat', 'box', 'flat', 'flat', 'pass']; // (two long runs of flatbeds coupled together: room to keep fighting down there through a tunnel)
  const COLS = { box: [0x8a2a1e, 0x2a4a7a, 0x6a5a2a, 0x2a6a4a], pass: [0xc8ccd4], tank: [0x2a2c30, 0xd8d0c0], engine: [0xc8202a], flat: [0x3a3028] };
  const cars = [], topOf = (ty) => (ty === 'flat' ? DECK : ty === 'tank' ? 3.9 : ROOF), endTop = (k) => (TYPES[k] === 'flat' ? Math.max(topOf(TYPES[k - 1] || 'box'), topOf(TYPES[k + 1] || 'box')) : topOf(TYPES[k])), slopes = [];
  for (let k = 0; k < NC; k++) {
    const type = TYPES[k], zc = Z0 + k * PITCH, top = type === 'flat' ? DECK : type === 'tank' ? 3.9 : ROOF, col = COLS[type][k % COLS[type].length];
    const g = new THREE.Group(); g.position.z = zc; S.add(g);
    const p = { kind: type === 'flat' ? 'flatbed' : 'car', x: 0, z: zc, y: top, w: type === 'tank' ? 7.8 : 2 * HW, d: L, ang: 0, i: A.plats.length, meshes: [], boxes: [], ramps: [], rays: [], car: true, type };
    A.plats.push(p);
    // (what you stand on and bump into is cut into short lengths along the car: each rides the track where it is, so the
    // whole car lies along the rails through a bend, turned as one piece, and meets its neighbours at the couplings)
    const slices = (x0, x1, y0, y1, z0, z1, to) => { const n = Math.max(1, Math.ceil((z1 - z0) / 5)); for (let j = 0; j < n; j++) { const b = { x0, x1, y0, y1, z0: zc + z0 + (z1 - z0) * j / n, z1: zc + z0 + (z1 - z0) * (j + 1) / n }; to.push(b); (to === p.rays ? A.rayBoxes : A.boxes).push(b); } };
    const box = (x0, x1, y0, y1, z0, z1, mat, solid = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; g.add(m); if (solid) slices(x0, x1, y0, y1, z0, z1, p.boxes); return m; };
    const bodyM = new THREE.MeshStandardMaterial({ color: col, metalness: 0.45, roughness: 0.45 });
    if (type === 'flat') {
      box(-HW, HW, 0.9, DECK, -L / 2, L / 2, roofM);
      for (const sx of [-1, 1]) for (let z = -24; z <= 24; z += 6) box(sx * (HW - 0.05) - 0.06, sx * (HW - 0.05) + 0.06, DECK, DECK + 0.8, z - 0.06, z + 0.06, steelM, false); // stanchions
      for (const sz of [-1, 1]) { const nb = TYPES[k + sz]; if (!nb || nb === 'flat') continue; // (no ramp between two flatbeds: the deck just carries on) // ramps at each end, from the deck up to the next car's roof (walk up; no jumping the gap)
        const r = A.addRamp(0, zc + sz * (L / 2 - 4.9), 0, zc + sz * L / 2, DECK, topOf(nb), 2 * HW - 1.2, DECK - 0.3, roofM); g.attach(S.children[S.children.length - 1]); // (its mesh turns with the car)
        slopes.push({ r, b: { lx: r.lx, x0: r.x0, x1: r.x1, hL: r.hL, hH: r.hH, base: r.base }, car: p, z: zc + sz * (L / 2 - 2.45) }); }
    } else if (type === 'tank') {
      const tk = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, L - 1, 24).rotateX(Math.PI / 2), bodyM); tk.position.set(0, 2.4, 0); tk.scale.x = 3; tk.castShadow = tk.receiveShadow = true; g.add(tk);
      slices(-3.9, 3.9, 0.9, 3.9, -L / 2 + 0.5, L / 2 - 0.5, p.boxes);
      box(-1.5, 1.5, 3.85, 3.95, -L / 2 + 1, L / 2 - 1, roofM, false); // catwalk
      box(-HW, HW, 0.9, 1.2, -L / 2, L / 2, darkM, false);
    } else {
      box(-HW, HW, 0.9, top, -L / 2, L / 2, bodyM);
      box(-HW - 0.05, HW + 0.05, top - 0.05, top + 0.05, -L / 2, L / 2, roofM, false);
      if (type === 'pass') for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(L - 2, 1.0), new THREE.MeshStandardMaterial({ map: winT, emissive: 0xffffff, emissiveMap: winT, emissiveIntensity: 0.5 })); w.position.set(sx * (HW + 0.01), 2.9, 0); w.rotation.y = sx * Math.PI / 2; g.add(w); }
      if (type === 'box') for (const sx of [-1, 1]) for (const dz of [-19, 0, 19]) box(sx * (HW + 0.02) - 0.03, sx * (HW + 0.02) + 0.03, 1.2, 3.6, dz - 2.2, dz + 2.2, darkM, false); // doors
      if (type === 'engine') { box(-HW + 1.2, HW - 1.2, top, top + 1.0, L / 2 - 12, L / 2 - 1, bodyM); // the cab
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 1.6, 12), darkM); st.position.set(0, top + 0.8, -L / 2 + 3); g.add(st);
        const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), new THREE.MeshBasicMaterial({ color: 0xfff4c0, toneMapped: false })); lamp.position.set(0, 2.6, -L / 2 - 0.01); lamp.rotation.y = Math.PI; g.add(lamp);
        const nose = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.4, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), bodyM); nose.position.set(0, 2.5, -L / 2 - 0.2); nose.scale.set(3, 1.05, 1.6); g.add(nose); }
    }
    for (const bz of [-L / 2 + 2.5, -L / 6, L / 6, L / 2 - 2.5]) { box(-HW + 0.4, HW - 0.4, 0.35, 0.9, bz - 1.4, bz + 1.4, darkM, false); // bogies and wheels
      for (const sx of [-1, 1]) for (const dz of [-0.8, 0.8]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 14).rotateZ(Math.PI / 2), steelM); w.position.set(sx * 3.15, 0.45, bz + dz); g.add(w); } }
    if (k < NC - 1) { box(-0.25, 0.25, 0.9, 1.3, L / 2, L / 2 + GAP, darkM, false); // coupler to the next car, and a gangway over the gap at roof height
      const gh = TYPES[k] === 'flat' && TYPES[k + 1] === 'flat' ? DECK : Math.max(topOf(TYPES[k] === 'flat' ? TYPES[k + 1] : TYPES[k]), topOf(TYPES[k + 1] === 'flat' ? TYPES[k] : TYPES[k + 1])); box(-3.0, 3.0, gh - 0.15, gh, L / 2 - 0.05, L / 2 + GAP + 0.05, roofM); }
    slices(-HW, HW, 0.9, top, -L / 2, L / 2, p.rays); // hookable all over (the undercarriage too, from below)
    p.g = g; p.boxBase = p.boxes.map((b) => ({ ...b })); p.rayBase = p.rays.map((b) => ({ ...b })); p.base = { x: 0, y: top, z: zc }; p.prev = null; p.cur = null;
    A.node('P' + p.i, 0, top, zc).plat = p.i;
    p.sps = []; for (const dz of [-21, -7, 7, 21]) { const sp = new THREE.Vector3(0, top + 0.05, zc + dz); sp.plat = p.i; sp.off = dz; A.spawns.push(sp); p.sps.push(sp); }
    cars.push(p);
  }
  for (let k = 1; k < NC; k++) A.link('P' + cars[k - 1].i, 'P' + cars[k].i);

  // ---- the world, in stretches: a template for each landscape and kind of stretch, cloned as it comes into view
  const tpl = new Map(), live = new Map();
  const sleeperG = new THREE.BoxGeometry(7.8, 0.15, 0.26), railG = new THREE.BoxGeometry(0.12, 0.2, TRAIN.SEG);
  const groundTex = (c) => T.canvasTex((g, s) => { const col = new THREE.Color(c); g.fillStyle = '#' + col.getHexString(); g.fillRect(0, 0, s, s); const q = T.rng(c & 255); for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${q() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + q() * 0.08})`; g.beginPath(); g.arc(q() * s, q() * s, 2 + q() * 10, 0, TAU); g.fill(); } T.speckle(g, s, q, 3000, 0.12); }, 256);
  const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
  const inst = (geo, mat, list) => { const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(); list.forEach(([x, y, z, sx, sy, sz, ry = 0], i) => { e.set(0, ry, 0); q.setFromEuler(e); mt.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)); im.setMatrixAt(i, mt); }); im.count = list.length; im.frustumCulled = false; return im; };
  const M = {}; const mat = (key, f) => M[key] || (M[key] = f());
  const build = (bi, ty, v, cap) => {
    const B = BIOMES[bi], g = new THREE.Group(), q = T.rng(1000 + bi * 97 + v * 13 + ty.charCodeAt(0)), SEG = TRAIN.SEG, H = SEG / 2;
    const low = new THREE.Group(); low.position.y = GD; g.add(low); // (the land, far below the viaduct)
    const add = (o, under) => { o.frustumCulled = false; (under ? low : g).add(o); return o; };
    const addL = (o) => add(o, true); // (on the land)
    // the track: sleepers, rails, ballast (no ballast on a bridge)
    add(inst(sleeperG, mat('sleeper', () => brk(0x4a3626)), Array.from({ length: SEG }, (_, k) => [0, -0.32, -k - 0.5, 1, 1, 1])));
    const unit = new THREE.BoxGeometry(1, 1, 1), run = (n, f) => Array.from({ length: n }, (_, k) => f(k)); // (everything the track is made of is laid in short pieces, so it can break up behind the train)
    add(inst(unit, mat('rail', () => brk(0x9aa0a8, { metalness: 0.8, roughness: 0.3 })), [-2.25, 2.25].flatMap((x) => run(SEG / 3, (k) => [x, -0.12, -1.5 - k * 3, 0.12, 0.2, 3]))));
    if (ty !== 'B') { add(inst(unit, mat('viaduct', () => brk(0x8a8478)), run(SEG / 5, (k) => [0, -1.1, -2.5 - k * 5, 2 * HW + 2.8, 1.4, 5]))); // a viaduct carries the track high above the land, on piers every 25 m
      add(inst(new THREE.BoxGeometry(1, 1, 1), mat('viaduct'), Array.from({ length: 6 }, (_, k) => [0, GD / 2 - 1, -12 - k * 25, 7.8, -GD, 2.2]))); }
    const gm = mat('ground' + bi, () => { const t = groundTex(B.ground); t.repeat.set(20, 5); return std(0xffffff, { map: t, roughness: 1 }); });
    if (ty === 'G' || ty === 'T') { // the ground either side (coast: land one side, the sea the other)
      const gg = new THREE.PlaneGeometry(B.name === 'coast' ? 300 : 600, SEG, 6, 15).rotateX(-Math.PI / 2); add(mk(gg, gm, B.name === 'coast' ? -150 : 0, -0.7, -H), true);
      if (B.name === 'coast') add(mk(new THREE.PlaneGeometry(300, SEG, 4, 15).rotateX(-Math.PI / 2), mat('sea', () => std(0x2a6ab0, { roughness: 0.15, metalness: 0.3 })), 150, -8, -H), true);
    }
    if (ty === 'B') { // a bridge: an open trestle over a great valley, a river far below, cliffs far off either side and at each end
      const cliffM = () => mat('cliff' + bi, () => std(bi === 1 ? 0xb8c4d4 : bi === 2 ? 0xb87a4a : 0x6a6458, { flatShading: true }));
      add(mk(new THREE.PlaneGeometry(2 * GORGE + 60, SEG, 4, 15).rotateX(-Math.PI / 2), mat('river' + bi, () => std(bi === 1 ? 0xcfe6f6 : bi === 4 ? 0x10142a : 0x2a5a8a, { roughness: 0.2, metalness: 0.3 })), 0, -48, -H));
      if (cap) add(mk(new THREE.BoxGeometry(2 * GORGE + 20, 60, 10), cliffM(), 0, GD - 30, cap === 'a' ? 5 : -SEG - 5)); // (the valley's end wall, under the land it opens out of)
      add(inst(unit, mat('girder', () => brk(0x5a4a3a)), [-3.9, 3.9].flatMap((x) => run(SEG / 5, (k) => [x, -1.0, -2.5 - k * 5, 0.4, 1.0, 5]))));
      const legs = []; for (let z = -5; z > -SEG; z -= 12) for (const sx of [-1, 1]) legs.push([sx * HW, -24, z, 0.5, 46, 0.5]);
      add(inst(new THREE.BoxGeometry(1, 1, 1), mat('trestle', () => brk(0x4a3a2a)), legs));
      const cross = []; for (let z = -5; z > -SEG; z -= 12) for (let y = -6; y > -46; y -= 9) cross.push([0, y, z, 2 * HW + 0.4, 0.35, 0.35]); add(inst(new THREE.BoxGeometry(1, 1, 1), mat('trestle'), cross));
      for (const sx of [-1, 1]) add(mk(new THREE.BoxGeometry(260, 60, SEG), cliffM(), sx * (GORGE + 130), GD - 30, -H));
    }
    if (ty === 'T') { // a tunnel through a mountain: walls, a low ceiling, lamps along the walls, a portal at each end
      const rockM = mat('rock' + bi, () => std(bi === 1 ? 0xc8d0dc : bi === 2 ? 0xa8704a : bi === 4 ? 0x30323a : 0x5a5650, { flatShading: true }));
      for (const sx of [-1, 1]) add(mk(new THREE.BoxGeometry(0.8, CEIL - GD + 1, SEG), mat('tunwall', () => std(0x3a3836)), sx * (WALLX + 0.4), (CEIL + GD) / 2, -H)); // (the tunnel goes all the way down: a deep shaft under the track)
      add(mk(new THREE.BoxGeometry(2 * WALLX + 1.6, 1.0, SEG), mat('tunwall'), 0, CEIL + 0.5, -H));
      add(inst(unit, mat('tunfloor', () => brk(0x24221f)), run(SEG / 5, (k) => [0, -0.72, -2.5 - k * 5, 2 * WALLX + 1.6, 0.5, 5]))); // (the tunnel's floor, at the track: fall off the train in here and that is the end of you)
      const lamps = []; for (let z = -4; z > -SEG; z -= 10) for (const sx of [-1, 1]) lamps.push([sx * (WALLX - 0.02), CEIL - 0.9, z - (sx > 0 ? 5 : 0), 0.15, 0.3, 0.8]);
      add(inst(new THREE.BoxGeometry(1, 1, 1), mat('lamp', () => bend(new THREE.MeshBasicMaterial({ color: 0xffd890, toneMapped: false }))), lamps));
      for (const z of [0, -SEG]) for (const [x, y, w, h] of [[-WALLX - 1.5, (CEIL + GD) / 2, 2.2, CEIL - GD + 2], [WALLX + 1.5, (CEIL + GD) / 2, 2.2, CEIL - GD + 2], [0, CEIL + 1.6, 2 * WALLX + 5, 2.2]]) add(mk(new THREE.BoxGeometry(w, h, 1.2), mat('portal', () => std(0x24221f)), x, y, z));
      const hills = []; for (let k = 0; k < 9; k++) { const sx = k % 2 ? 1 : -1, w = 30 + q() * 40; hills.push([sx * (WALLX + 2 + 0.62 * w + q() * 6), 12 + q() * 18, -q() * SEG, w, 30 + q() * 40, 40 + q() * 50, q() * 3]); }
      hills.push([0, CEIL + 10.5, -H, 2 * WALLX + 6, 14, SEG * 0.9]); add(inst(new THREE.DodecahedronGeometry(0.6, 0), rockM, hills));
    }
    if (ty === 'G') { // scenery for the landscape (well clear of the track)
      const P = []; const side = () => (q() < 0.5 ? -1 : 1) * (16 + q() * 120), N = low ? 26 : 60;
      if (bi === 0 || bi === 1) { const tr = [], cn = []; for (let k = 0; k < N; k++) { const x = side(), z = -q() * SEG, h = 8 + q() * 12; tr.push([x, h * 0.15, z, 0.5, h * 0.3, 0.5]); cn.push([x, h * 0.55, z, h * 0.28, h * 0.8, h * 0.28]); }
        addL(inst(new THREE.CylinderGeometry(1, 1, 1, 6), mat('trunk', () => std(0xb8a898, { map: T.barkMap(1, 2) })), tr)); addL(inst(new THREE.ConeGeometry(1, 1, 8), mat('pine' + bi, () => std(bi ? 0xe8f0f6 : 0x2a5a2a, { flatShading: true })), cn), true); }
      if (bi === 2) { for (let k = 0; k < N / 3; k++) P.push([side(), 2, -q() * SEG, 4 + q() * 9, 3 + q() * 8, 4 + q() * 9, q() * 3]); addL(inst(new THREE.DodecahedronGeometry(1, 0), mat('mesa', () => std(0xb87a4a, { flatShading: true })), P), true);
        const cs = []; for (let k = 0; k < N / 2; k++) cs.push([side(), 1.2, -q() * SEG, 0.3, 2.6 + q() * 2, 0.3]); addL(inst(new THREE.CylinderGeometry(1, 1, 1, 6), mat('cactus', () => std(0x4a7a3a)), cs), true); }
      if (bi === 3) { for (let k = 0; k < N / 3; k++) P.push([-(16 + q() * 120), 2, -q() * SEG, 4 + q() * 8, 2 + q() * 6, 4 + q() * 8, q() * 3]); addL(inst(new THREE.DodecahedronGeometry(1, 0), mat('coastrock', () => std(0x7a7468, { flatShading: true })), P), true); }
      if (bi === 4) { const win = mat('citywin', () => { const t = T.canvasTex((c, s) => { const r = T.rng(9); c.fillStyle = '#10141e'; c.fillRect(0, 0, s, s); for (let y = 0; y < 24; y++) for (let x = 0; x < 8; x++) if (r() < 0.1) { c.fillStyle = r() < 0.7 ? '#ffd890' : '#8ae0ff'; c.fillRect(x * s / 8 + 3, y * s / 24 + 2, s / 8 - 6, s / 24 - 4); } }, 256); t.repeat.set(1, 2); return std(0xffffff, { map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.6 }); });
        for (let k = 0; k < N / 3; k++) { const h = 15 + q() * 60; P.push([side() * 1.0 + (q() < 0.5 ? 0 : 0), h / 2 - 1, -q() * SEG, 8 + q() * 10, h, 8 + q() * 10]); } addL(inst(new THREE.BoxGeometry(1, 1, 1), win, P), true); }
    }
    return g;
  };
  const chunk = (i) => { const bi = biomeOf(i), ty = segType(i), v = hash(i * 1.37) < 0.5 ? 0 : 1, cap = ty !== 'B' ? '' : segType(i - 1) !== 'B' ? 'a' : segType(i + 1) !== 'B' ? 'z' : '', key = bi + ty + v + cap; if (!tpl.has(key)) tpl.set(key, build(bi, ty, v, cap)); const g = tpl.get(key).clone(); S.add(g); return g; };

  // ---- signal arms: gantries over the track. Low beams (jump them), high beams (get off the roof), side paddles
  // (sweep anyone hanging off the side). Red lamps flash on each as it comes.
  const armOf = (i) => { if (segType(i) !== 'G' || hash(i * 3.3) < 0.3) return null; return { s: i * TRAIN.SEG + 25 + hash(i * 5.1) * 100, kind: hash(i * 7.7) < 0.4 ? 'low' : hash(i * 7.7) < 0.75 ? 'high' : 'side', side: hash(i * 9.1) < 0.5 ? -1 : 1 }; };
  const armM = std(0x2a2c30, { metalness: 0.6 }), stripeM = std(0xe8b422), redM = bend(new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }));
  const armVis = new Map();
  const armMesh = (a) => { const g = new THREE.Group();
    for (const sx of [-1, 1]) g.add(mk(new THREE.BoxGeometry(0.4, 8, 0.4), armM, sx * (HW + 3), 3.3, 0));
    if (a.kind === 'low') g.add(mk(new THREE.BoxGeometry(2 * HW + 6.4, 0.35, 0.35), stripeM, 0, 4.58, 0));
    if (a.kind === 'high') g.add(mk(new THREE.BoxGeometry(2 * HW + 6.4, 0.7, 0.5), armM, 0, 5.65, 0));
    if (a.kind === 'side') g.add(mk(new THREE.BoxGeometry(2.4, 3.6, 0.3), stripeM, a.side * (HW + 1.35), 2.4, 0));
    const lamps = []; for (const x of [-HW - 2, HW + 2]) { const l = mk(new THREE.SphereGeometry(0.22, 8, 6), redM, x, a.kind === 'high' ? 6.3 : a.kind === 'low' ? 5.0 : 4.5, 0); g.add(l); lamps.push(l); } g.userData.lamps = lamps;
    g.traverse((o) => { o.frustumCulled = false; }); S.add(g); return g; };

  // ---- light for the landscapes and the dark of the tunnels
  const fog = A.realScene.fog, bg = A.realScene.background, sun = A.sun, cA = new THREE.Color(), cB = new THREE.Color(), dark = new THREE.Color(0x06060a);
  const tunLight = new THREE.PointLight(0xffc870, 0, 22, 1.4); S.add(tunLight);
  let Sw = 0, dTun = 0, lastWrap = -1;
  const runS = () => ((Date.now() / 1000 * TRAIN.V) % LOOP + LOOP) % LOOP;
  const inTunnel = (s) => segType(Math.floor(s / TRAIN.SEG)) === 'T', onBridge = (s) => segType(Math.floor(s / TRAIN.SEG)) === 'B';
  // a car sits on the rails at both its ends, like a link in a chain: it lies along the line between them (so it turns
  // into a bend and tips over a rise), and each end is where the next car's end is. {x, y: its middle; kx, ky: its lean per metre}
  const pose = (p) => { const sF = Sw - (p.base.z - L / 2), sR = Sw - (p.base.z + L / 2), xF = PX(sF), xR = PX(sR), yF = PY(sF), yR = PY(sR); return { x: (xF + xR) / 2, kx: (xR - xF) / L, y: (yF + yR) / 2, ky: (yR - yF) / L }; };
  const offX = (P, p, z) => P.x + P.kx * (z - p.base.z), offY = (P, p, z) => P.y + P.ky * (z - p.base.z); // (how far the car has carried a point at z along it)
  const place = () => {
    for (const p of cars) { p.prev = p.cur; const P = p.cur = pose(p); if (!p.prev) p.prev = P; p.x = P.x; p.y = p.base.y + P.y; p.ang = -Math.atan(P.kx);
      p.g.position.set(P.x, P.y, p.base.z); p.g.rotation.set(-Math.atan(P.ky), Math.atan(P.kx), 0);
      for (const [list, base] of [[p.boxes, p.boxBase], [p.rays, p.rayBase]]) list.forEach((b, j) => { const q = base[j], zm = (q.z0 + q.z1) / 2, ox = offX(P, p, zm), oy = offY(P, p, zm); b.x0 = q.x0 + ox; b.x1 = q.x1 + ox; b.y0 = q.y0 + oy; b.y1 = q.y1 + oy; });
      const n = A.nodeMap.get('P' + p.i); if (n) n.p.set(P.x, p.y, p.base.z); for (const sp of p.sps) { const z = p.base.z + sp.off; sp.set(offX(P, p, z), p.base.y + offY(P, p, z) + 0.05, z); } }
    for (const q of slopes) { const P = q.car.cur, ox = offX(P, q.car, q.z), oy = offY(P, q.car, q.z), r = q.r; r.lx = q.b.lx + ox; r.x0 = q.b.x0 + ox; r.x1 = q.b.x1 + ox; r.hL = q.b.hL + oy; r.hH = q.b.hH + oy; r.base = q.b.base + oy; }
  };
  A.anim.push((t, dt) => {
    Sw = runS(); uS.value = Sw;
    const wrap = Math.floor(Date.now() / 1000 * TRAIN.V / LOOP); if (wrap !== lastWrap) { lastWrap = wrap; for (const g of live.values()) S.remove(g); live.clear(); for (const g of armVis.values()) S.remove(g); armVis.clear(); }
    // stretches in view: from just behind the last car to well ahead of the engine
    const i0 = Math.floor((Sw - 300) / TRAIN.SEG), i1 = Math.floor((Sw + 520) / TRAIN.SEG);
    for (const [i, g] of live) if (i < i0 || i > i1) { S.remove(g); live.delete(i); }
    for (let i = i0; i <= i1; i++) { if (!live.has(i)) live.set(i, chunk(i)); live.get(i).position.z = Sw - i * TRAIN.SEG; }
    for (const [i, g] of armVis) if (i < i0 || i > i1) { S.remove(g); armVis.delete(i); }
    for (let i = i0; i <= i1; i++) { const a = armOf(i); if (!a) continue; if (!armVis.has(i)) armVis.set(i, armMesh(a)); const g = armVis.get(i); g.position.z = Sw - a.s; const on = Math.floor(t * 6) % 2 === 0; for (const l of g.userData.lamps) l.visible = on; }
    place();
    // the sky and light of the landscape we're in (blending into the next), darkening in a tunnel
    const cam = A.camZ ?? 0, sc = Sw - cam, u = sc / TRAIN.SEG / TRAIN.BIOME, b0 = ((Math.floor(u) % 5) + 5) % 5, b1 = (b0 + 1) % 5, f = THREE.MathUtils.smoothstep(u - Math.floor(u), 0.86, 1), X = BIOMES[b0], Y = BIOMES[b1];
    dTun += ((inTunnel(sc) ? 1 : 0) - dTun) * Math.min(1, (dt || 0.016) * 5);
    const mix = (a, b) => cA.setHex(a).lerp(cB.setHex(b), f);
    if (dome) { dome.top.value.copy(mix(X.top, Y.top)).lerp(dark, dTun); dome.mid.value.copy(mix(X.mid, Y.mid)).lerp(dark, dTun); dome.bot.value.copy(mix(X.bot, Y.bot)).lerp(dark, dTun); }
    fog.color.copy(mix(X.fog, Y.fog)).lerp(dark, dTun); bg.copy(fog.color); fog.near = 90 - 80 * dTun; fog.far = 360 - 290 * dTun;
    if (hemi) hemi.intensity = (X.hemi + (Y.hemi - X.hemi) * f) * (1 - 0.8 * dTun); if (sun) sun.intensity = (X.sun + (Y.sun - X.sun) * f) * (1 - 0.95 * dTun);
    const lampPhase = ((sc % 10) + 10) % 10 / 10; tunLight.intensity = dTun * (18 + 30 * Math.max(0, Math.cos(lampPhase * TAU))); tunLight.position.set(PX(sc), PY(sc) + CEIL - 1, cam);
  });

  // ---- what reaches the fighters: carried by their car; swept off by tunnel roofs and walls; knocked off by arms
  // an arm over the roof throws you back along the train; a tunnel roof or a side arm throws you off it
  const knock = (f, sx, why) => { f.knockedBy = why; f.knockAt = Date.now(); const tun = why === 'tunnel', off = tun || why === 'side arm'; f.vel.set(off ? sx * (tun ? 7 : 9) : 0, tun ? 0 : off ? 4 : 5, off ? 22 : 12); f.onGround = false; f.hook = null; f.dashT = 0; f.stagger = 0.8; f.mantle = null; };
  const armPrev = new Map(), END = NC * PITCH / 2;
  A.tickHazards = (fighters) => {
    for (const f of fighters) { if (!f.alive) continue;
      for (const p of cars) { const P0 = p.prev, P1 = p.cur; if (!P0) continue; // (whatever stands on a car, or is hooked to it, goes where that part of the car goes)
        if (f.onGround && Math.abs(f.pos.z - p.base.z) < L / 2 + GAP / 2 + 0.1 && Math.abs(f.pos.x - offX(P0, p, f.pos.z)) < HW + 0.6) { const z = f.pos.z; f.pos.x += offX(P1, p, z) - offX(P0, p, z); f.pos.y += offY(P1, p, z) - offY(P0, p, z); break; }
        if (f.hook && !f.hook.enemy && Math.abs(f.hook.p.z - p.base.z) < L / 2 + 0.2 && Math.abs(f.hook.p.x - offX(P0, p, f.hook.p.z)) < HW + 0.4) { const z = f.hook.p.z; f.hook.p.x += offX(P1, p, z) - offX(P0, p, z); f.hook.p.y += offY(P1, p, z) - offY(P0, p, z); break; } } // (the hook rides with its car)
      if (f.hook && !f.hook.enemy && !f.onGround && !f.reel) for (const p of cars) { // caught it: hooked onto a car's side or roof edge from below (not underneath it), you're reeled straight up onto the roof
        const hz = f.hook.p.z, cx = offX(p.cur, p, hz), cy = p.base.y + offY(p.cur, p, hz), hy = f.hook.p.y - cy;
        if (Math.abs(hz - p.base.z) > L / 2 + 0.3 || hy < -3.7 || hy > 0.7 || (hy < -2.6 && Math.abs(f.hook.p.x - cx) < HW - 0.2) || f.pos.y > cy - 0.2) continue; // (only the underside itself lets you swing under)
        f.reel = { p, sx: Math.max(-1, Math.min(1, (f.hook.p.x - cx) / HW)), z: hz - p.base.z, until: Date.now() + 1600 }; break; }
      if (f.isBot && !f.reel && !f.hook && !f.onGround && f.vel.y < -3 && !(f.saveTried > Date.now() - 2500)) { // a bot falling off grabs for the train: it catches it three times in four
        let best = null, bd = 9; for (const p of cars) { const d = Math.abs(f.pos.z - p.base.z); if (d < L / 2 + 1 && f.pos.y < p.y - 2 && f.pos.y > p.y - 16 && d < bd) { bd = d; best = p; } }
        if (best) { f.saveTried = Date.now(); if (Math.random() < 0.75) { const sx = Math.sign(f.pos.x - best.x) || 1, z = Math.max(-L / 2 + 1, Math.min(L / 2 - 1, f.pos.z - best.base.z)), wz = best.base.z + z; f.hook = { p: new THREE.Vector3(offX(best.cur, best, wz) + sx * HW, best.base.y + offY(best.cur, best, wz) - 0.3, wz), len: 20 }; f.reel = { p: best, sx, z, until: Date.now() + 1600 }; } } }
      if (f.reel) { const r = f.reel, p = r.p, tz = p.base.z + r.z, tx = offX(p.cur, p, tz) + r.sx * (HW - 0.9), ty = p.base.y + offY(p.cur, p, tz), dx = tx - f.pos.x, dy = ty + 0.6 - f.pos.y, dz = tz - f.pos.z, d = Math.hypot(dx, dy, dz);
        if (d < 1.2 || Date.now() > r.until || !f.alive) { if (d < 1.2) { f.pos.set(tx, ty + 0.05, tz); f.vel.set(0, 0, 0); f.onGround = true; } f.reel = null; f.hook = null; f.mantle = null; }
        else { const sp = Math.min(30, 14 + d * 1.6); f.vel.set(dx / d * sp, dy / d * sp, dz / d * sp); f.onGround = false; f.mantle = null; } }
      // a tunnel: its mouth sweeps whoever is too high to fit as it arrives, and goes on sweeping anyone standing where
      // they can't fit (a roof). Inside, the roof and walls are solid: jump into the roof and you only bump your head.
      const s = Sw - f.pos.z, tun = inTunnel(s) && Math.abs(f.pos.z) < END + 4, was = f.inTun; f.inTun = tun;
      if (tun) { const cx = PX(s), cy = PY(s), rx = f.pos.x - cx, head = f.pos.y - cy + 1.75;
        const g = A.groundHeight(f.pos.x, f.pos.z, f.pos.y + 0.5), noFit = f.prot <= 0 && g - cy + 1.75 > CEIL && f.pos.y - g < 0.7; // (on a roof: no room for you between it and the rock)
        if (f.prot <= 0 && head > CEIL && (!was || noFit) && !(f.knockAt > Date.now() - 900)) { knock(f, rx < 0 ? -1 : 1, 'tunnel'); f.sweep = rx < 0 ? -1 : 1; }
        if (noFit) { f.vel.z = Math.max(f.vel.z, 22); f.vel.x = (f.sweep || 1) * 7; } // (and it keeps bundling you back along the roof and off its side)
        if (!noFit && !f.onGround && head > CEIL && head < CEIL + 1.3) { f.pos.y = cy + CEIL - 1.75; if (f.vel.y > 0) f.vel.y = 0; }
        if (Math.abs(rx) > WALLX - 0.4 && Math.abs(rx) < WALLX + 1) { const sg = rx < 0 ? -1 : 1; f.pos.x = cx + sg * (WALLX - 0.4); if (f.vel.x * sg > 0) f.vel.x = 0; } }
    }
    for (let i = Math.floor((Sw - 300) / TRAIN.SEG); i <= Math.floor((Sw + 520) / TRAIN.SEG); i++) { const a = armOf(i); if (!a) continue;
      const z1 = Sw - a.s, z0 = armPrev.has(i) ? armPrev.get(i) : z1; armPrev.set(i, z1); if (z1 - z0 > 10 || z1 < -230 || z0 > 230) continue;
      for (const f of fighters) { if (!f.alive || f.prot > 0 || f.pos.z < z0 - 0.6 || f.pos.z > z1 + 0.6) continue; // (the arm swept past them this frame)
        const rx = f.pos.x - PX(a.s), ry = f.pos.y - PY(a.s), lo = ry + 0.1, hi = ry + 1.7;
        const hit = a.kind === 'low' ? Math.abs(rx) < HW + 3 && lo < 4.75 && hi > 4.4 : a.kind === 'high' ? Math.abs(rx) < HW + 3 && lo < 6.0 && hi > 5.3 : rx * a.side > HW + 0.15 && rx * a.side < HW + 2.6 && lo < 4.2 && hi > 0.6;
        if (hit) knock(f, a.kind === 'side' ? a.side : rx < 0 ? -1 : 1, a.kind + ' arm'); } }
  };
  // falling off: in the open there is a long drop to the land (longer over a valley), time to hook the train and swing
  // back up. In a tunnel the floor is right there at the track, and the rock all round: off the train is the end of
  // you. And whoever drifts off past either end of the train has been left behind.
  const lost = (p) => { const s = Sw - p.z; return Math.abs(p.z) > END + 35 ? 0 : inTunnel(s) ? 1 : onBridge(s) ? 2 : 3; };
  A.killAt = (p) => { const s = Sw - p.z, y0 = PY(s), w = lost(p); if (w === 0) return Infinity;
    if (w === 1) return Math.abs(p.x - PX(s)) > WALLX + 1 || p.y - y0 + 1.75 > CEIL + 1.3 ? Infinity : y0 - 0.25;
    return y0 + (w === 2 ? -42 : GD + 1); };
  A.fallText = (q) => ['was left behind by the train', 'was lost in the tunnel', 'fell into the valley', 'fell off the train'][lost(q)];
  A.fallBy = (q) => ['Left behind by the train', 'Lost in the tunnel', 'Fell into the valley', 'Fell off the train'][lost(q)];
  // for bots and spawning: what's coming for someone at this spot, in seconds (tunnel, high arm, low arm, side arm)
  A.trainDanger = (pos) => { const s = Sw - pos.z, out = { tunnel: 99, high: 99, low: 99, side: 99 };
    if (inTunnel(s)) out.tunnel = 0; else for (let d = 0; d < 10 * TRAIN.V; d += 15) if (inTunnel(s + d)) { out.tunnel = d / TRAIN.V; break; }
    for (let i = Math.floor(s / TRAIN.SEG); i <= Math.floor((s + 10 * TRAIN.V) / TRAIN.SEG); i++) { const a = armOf(i); if (a && a.s > s) out[a.kind] = Math.min(out[a.kind], (a.s - s) / TRAIN.V); }
    return out; };
  A.flatbeds = cars.filter((p) => p.type === 'flat');
  A.spawnOk = (sp) => { const p = A.plats[sp.plat]; if (!p || !p.car) return true; const d = A.trainDanger(sp); return p.type === 'flat' ? d.tunnel > 0.4 || true : d.tunnel > 3 && d.high > 2.5; };
  { const fo = A.follow.bind(A); A.follow = (p) => { A.camZ = p.z; fo(p); }; } // (where the camera is: for the landscape's light and the tunnel's dark)
  Sw = runS(); uS.value = Sw; place(); place();
  A.finishNav();
}
