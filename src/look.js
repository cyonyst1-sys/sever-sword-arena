// The finishing pass every map gets once it's built (high quality only): its surfaces mirror its own sky (so stone,
// wood, metal and leaves pick up the colour of the air round them and glossy things glint), bands of drifting haze give
// it depth, shafts of light slant down through the air, and a few coloured lights sit where the map has a reason for
// them. Each map's settings are one line in LOOK; the Colosseum has its own, fuller treatment (see maps2.js and maw.js).
import * as THREE from 'three';
import { setRim, sway, ripple, WIND } from './vfx.js?v=20261117195439';

const TAU = Math.PI * 2;
// env: how strongly surfaces mirror the sky. gloss: [material name in A.mats, new roughness] pairs (polished or wet
// things). haze: [colour, opacity, lift] bands round the arena (lift: how far up it starts, as a fraction of the
// arena's height; add 'n' for ordinary blending rather than glowing). shafts: [colour, opacity, how many]. lights:
// [colour, power, reach, x, y, z].
const LOOK = {
  spire: { env: 0.6, wet: 0.55, haze: [[0x8a6aff, 0.3, -0.6]], shafts: [0xffb0d8, 0.09, 7], custom: spireLook },
  plateaus: { env: 0.45, haze: [[0xffb070, 0.34, -0.5]], shafts: [0xffc080, 0.13, 8], custom: plateauLook },
  tilt: { env: 0.7, wet: 0.5, haze: [[0x4a6aff, 0.3, -0.7]] },
  canopy: { custom: fireflies(0xb8ff70, 420, 1.3), bump: 3, env: 0.6, wet: 0.5, haze: [[0xc8f0a0, 0.3, -0.3], [0x9ad0a0, 0.18, 0.2]], shafts: [0xf4ffc0, 0.16, 12] },
  grove: { custom: fireflies(0xb8ff70, 300, 1.2), bump: 1.6, env: 0.55, wet: 0.6, shafts: [0xf4ffc0, 0.15, 10], flat: true },
  run: { custom: (A, T) => motes(A, T, { n: 300, color: 0xb8ff70, size: 1.2, flat: true }), bump: 2.2, env: 0.5, wet: 0.65, shafts: [0xe8ffb0, 0.13, 10], flat: true },
  isles: { env: 0.7, wet: 0.45, haze: [[0x6a58ff, 0.34, -0.5]] },
  bamboo: { custom: fireflies(0xe0ff80, 300, 1.0), env: 0.55, wet: 0.6, haze: [[0xd8f0a8, 0.26, -0.4]], shafts: [0xf0ffc0, 0.14, 9] },
  pagoda: { custom: lanterns, env: 0.6, wet: 0.6, haze: [[0xffb890, 0.3, -0.5]], shafts: [0xffc8a0, 0.13, 8], lights: [[0xffa050, 300, 70, 0, 9, 0]] },
  dojo: { custom: lanterns, env: 0.5, wet: 0.75, haze: [[0xe8f0ff, 0.28, -0.4]], shafts: [0xffffff, 0.08, 6], lights: [[0xffb060, 260, 60, 0, 6, 0]] },
  city: { env: 0.9, wet: 0.4, haze: [[0x6a50ff, 0.3, -0.7]], lights: [[0xff40c0, 520, 130, -22, 22, 4], [0x40d0ff, 520, 130, 26, 30, 10]], custom: stars },
  foundry: { env: 0.8, wet: 0.4, haze: [[0xff6a20, 0.36, -0.7]], lights: [[0xff6a20, 800, 150, 0, -16, 0], [0xffa040, 260, 80, 0, 26, 0]], custom: foundryLook },
  comet: { custom: nebula, env: 0.7, wet: 0.5, lights: [[0x8ac8ff, 300, 120, 0, 30, 0]], flat: true },
  lava: { env: 0.7, wet: 0.4, bump: 1.5, flat: true },
  transport: { custom: transportLook, env: 0.4, shafts: [0xffe2b0, 0.1, 8], flat: true },
};

/** What a surface on this map mirrors: its sky from zenith to horizon, the ground colour below, and the sun. */
function skyEnv(A, T) {
  let hemi = null; A.scene.traverse((o) => { if (o.isHemisphereLight) hemi = o; });
  const hex = (c, k = 1) => '#' + c.clone().multiplyScalar(k).getHexString();
  const hor = A.realScene.background && A.realScene.background.isColor ? A.realScene.background : new THREE.Color(0x8899aa);
  const top = hemi ? hemi.color.clone().lerp(hor, 0.25).multiplyScalar(0.8) : hor, gnd = hemi ? hemi.groundColor : new THREE.Color(0x333333);
  const t = T.canvasTex((g, s) => {
    const sky = g.createLinearGradient(0, 0, 0, s); sky.addColorStop(0, hex(top)); sky.addColorStop(0.46, hex(hor)); sky.addColorStop(0.54, hex(hor.clone().lerp(gnd, 0.6))); sky.addColorStop(1, hex(gnd, 0.7)); g.fillStyle = sky; g.fillRect(0, 0, s, s);
    if (A.sun && A.sunOff) { const d = A.sunOff.clone().normalize(), u = Math.atan2(d.z, d.x) / TAU + 0.5, v = 0.5 - Math.asin(d.y) / Math.PI, c = A.sun.color;
      for (const ox of [-s, 0, s]) for (const [R, a] of [[s * 0.2, 0.45], [s * 0.05, 1]]) { const b = g.createRadialGradient(u * s + ox, v * s, 0, u * s + ox, v * s, R); b.addColorStop(0, `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},${a})`); b.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = b; g.fillRect(0, 0, s, s); } } // the sun (or moon) and its glow
  }, 256);
  t.mapping = THREE.EquirectangularReflectionMapping; t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

const mistTex = (T, seed) => T.canvasTex((g, s) => { const q = T.rng(seed); g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 90; i++) { const x = q() * s, y = s * (0.4 + q() * 0.6), R = s * (0.08 + q() * 0.16); for (const ox of [-s, 0, s]) { const d = g.createRadialGradient(x + ox, y, 0, x + ox, y, R); d.addColorStop(0, `rgba(255,255,255,${0.1 + q() * 0.14})`); d.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = d; g.fillRect(x + ox - R, y - R, R * 2, R * 2); } } // drifts of it, thicker low down
  const f = g.createLinearGradient(0, 0, 0, s); f.addColorStop(0, 'rgba(0,0,0,1)'); f.addColorStop(0.5, 'rgba(0,0,0,0.3)'); f.addColorStop(0.88, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,0.7)'); g.fillStyle = f; g.fillRect(0, 0, s, s); }, 256);

/** The air of a map (every map, whatever the quality): mist that lies low under the arena and thickens toward the
 *  horizon, sunlight in shafts round whatever stands in front of the sun (both drawn in post.js), a rim of the sky's
 *  own light on the fighters, and wind: grass, leaves and banners stir, water ripples. mist: [lift, density, rays]. */
function air(A, L) {
  let hemi = null, y0 = 1e9; A.scene.traverse((o) => { if (o.isHemisphereLight) hemi = o;
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) { if (m.userData.sway) sway(m, m.userData.sway[0], m.userData.sway[1]); if (o.userData.water || o.userData.ripple) ripple(m, o.userData.ripple || 1); } });
  for (const p of A.plats) y0 = Math.min(y0, p.ya !== undefined ? Math.min(p.ya, p.yb) : p.y); if (y0 > 1e8) y0 = 0;
  const fog = A.realScene.fog, bg = A.realScene.background, col = (fog && fog.color ? fog.color : bg && bg.isColor ? bg : new THREE.Color(0x8899aa)).clone(), F = (L && L.mist) || [];
  const base = (A.water != null ? A.water : y0 - 42) + (F[0] || 0);
  A.atmo = { color: col, base, fall: 1 / Math.max(8, (y0 - base) * 0.45 + 4), dens: (F[1] ?? 1) * 0.014, sun: A.sunOff ? A.sunOff.clone().normalize() : null, sunCol: A.sun ? A.sun.color.clone().multiplyScalar(0.55) : new THREE.Color(0), rays: F[2] ?? (A.sunOff ? 0.7 : 0) };
  const c = A.sun ? A.sun.color.clone() : new THREE.Color(0xffffff); if (hemi) c.lerp(hemi.color, 0.45); c.multiplyScalar(1 / Math.max(0.2, c.r, c.g, c.b)); setRim(c, 0.62);
  A.anim.push((t) => { WIND.value = t; });
}

export function applyLook(A, T) {
  const L = LOOK[A.mapId]; air(A, L); if (!L || A.quality === 'low') return;
  const S = A.scene;
  // ---- reflections: everything mirrors the sky a little; polished and wet things a lot
  const env = skyEnv(A, T), seen = new Set();
  // surface detail: nothing is left a flat colour. Plain materials get a fine mineral grain (blotches, speckle, hairline
  // scratches) as both colour and relief; textured ones get relief from their own texture; and everything gets a little
  // variation in how glossy it is, so highlights break up across a surface instead of sitting on it like plastic
  const grain = T.canvasTex((g, s) => { const q = T.rng(31); g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 120; i++) { const x = q() * s, y = q() * s, R = s * (0.03 + q() * 0.1), d = g.createRadialGradient(x, y, 0, x, y, R); d.addColorStop(0, `rgba(${q() < 0.55 ? '0,0,0' : '255,255,255'},${0.05 + q() * 0.09})`); d.addColorStop(1, 'rgba(128,128,128,0)'); g.fillStyle = d; g.fillRect(x - R, y - R, R * 2, R * 2); }
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(0,0,0,${0.08 + q() * 0.14})`; g.lineWidth = 0.6 + q(); let x = q() * s, y = q() * s; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (q() - 0.5) * s * 0.08; y += (q() - 0.5) * s * 0.08; g.lineTo(x, y); } g.stroke(); }
    T.speckle(g, s, q, 9000, 0.16); }, 512);
  grain.repeat.set(2, 2);
  const rough = T.canvasTex((g, s) => { const q = T.rng(32); g.fillStyle = 'rgb(0,235,0)'; g.fillRect(0, 0, s, s); for (let i = 0; i < 160; i++) { const x = q() * s, y = q() * s, R = s * (0.03 + q() * 0.12), d = g.createRadialGradient(x, y, 0, x, y, R); d.addColorStop(0, `rgba(0,${q() < 0.6 ? 150 : 255},0,${0.25 + q() * 0.4})`); d.addColorStop(1, 'rgba(0,200,0,0)'); g.fillStyle = d; g.fillRect(x - R, y - R, R * 2, R * 2); } }, 256);
  rough.colorSpace = THREE.NoColorSpace; rough.repeat.set(3, 3);
  S.traverse((o) => { if (o.isHemisphereLight) o.intensity *= 0.9; // (the mirrored sky adds some light of its own)
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) { if (!m.isMeshStandardMaterial || m.envMap || seen.has(m)) continue; seen.add(m);
      m.envMap = env; m.envMapIntensity = L.env * (m.metalness > 0.4 ? 1.8 : 1);
      if (!m.transparent && !m.userData.plain && !o.isInstancedMesh && !o.isSkinnedMesh) {
        if (!m.bumpMap && !m.normalMap) { if (m.map) { m.bumpMap = m.map; m.bumpScale = 1.6 * (L.bump || 1); } else if (!m.vertexColors && !(m.emissiveIntensity > 1 && m.emissive.getHex())) { m.map = grain; m.bumpMap = grain; m.bumpScale = 1.3; } }
        if (!m.roughnessMap && !m.metalnessMap) m.roughnessMap = rough;
      }
      if (L.wet && m.roughness > L.wet && !m.transparent && !m.userData.dry) m.roughness = L.wet + (m.roughness - L.wet) * 0.35; // (rain-washed: nothing quite matte)
      m.needsUpdate = true; } });
  // ---- how big the place is (from its platforms)
  let R = 40, y0 = 1e9, y1 = -1e9;
  for (const p of A.plats) { R = Math.max(R, Math.hypot(p.x, p.z) + Math.max(p.w || 0, p.d || 0) / 2); const y = p.ya !== undefined ? (p.ya + p.yb) / 2 : p.y; y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const H = Math.max(40, y1 - y0 + 40);
  const anims = [];
  // ---- haze: soft bands of mist standing round the arena, turning slowly
  if (!L.flat) (L.haze || []).forEach(([color, opacity, lift], i) => {
    const tx = mistTex(T, 90 + i); tx.repeat.set(4 + i, 1);
    const rad = R * (1.25 + i * 0.5) + 25, h = H * 1.5;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, 64, 1, true), new THREE.MeshBasicMaterial({ map: tx, color, opacity, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.BackSide, toneMapped: false }));
    m.position.y = y0 + lift * H + h / 2; m.renderOrder = 3; S.add(m); anims.push((t) => { tx.offset.x = t * (i % 2 ? -0.005 : 0.004); });
  });
  // ---- shafts of light slanting down from the sun (one mesh: pairs of crossed sheets, bright in the middle, soft at the edges)
  if (L.shafts && A.sunOff) {
    const [color, opacity, n] = L.shafts, q = T.rng(4040 + A.mapId.length), d = A.sunOff.clone().normalize().negate(), side = new THREE.Vector3(-d.z, 0, d.x).normalize(), up = new THREE.Vector3().crossVectors(side, d).normalize();
    const pos = [], uv = [], idx = [], len = H * 1.6 + 60;
    for (let k = 0; k < n; k++) {
      const a = q() * TAU, rr = Math.sqrt(q()) * R * (L.flat ? 0.5 : 0.95), w = 5 + q() * 9, top = new THREE.Vector3(Math.cos(a) * rr, y1 + 45, Math.sin(a) * rr).addScaledVector(d, -20);
      if (L.flat) top.z = (q() - 0.5) * 2 * Math.min(R, 160); // (long, narrow maps: strung out along them)
      for (const ax of [side, up]) { const b = pos.length / 3;
        for (const [su, sv] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) { const p = top.clone().addScaledVector(ax, su * w / 2).addScaledVector(d, sv * len); pos.push(p.x, p.y, p.z); uv.push(su * 0.5 + 0.5, sv); }
        idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const tx = T.canvasTex((c, s) => { const a = c.createLinearGradient(0, 0, s, 0); a.addColorStop(0, '#000'); a.addColorStop(0.5, '#fff'); a.addColorStop(1, '#000'); c.fillStyle = a; c.fillRect(0, 0, s, s);
      const b = c.createLinearGradient(0, 0, 0, s); b.addColorStop(0, 'rgba(0,0,0,1)'); b.addColorStop(0.15, 'rgba(0,0,0,0)'); b.addColorStop(0.55, 'rgba(0,0,0,0.35)'); b.addColorStop(1, 'rgba(0,0,0,1)'); c.fillStyle = b; c.fillRect(0, 0, s, s); }, 64);
    const mat = new THREE.MeshBasicMaterial({ map: tx, color, opacity, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide, toneMapped: false });
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 4; S.add(m);
    anims.push((t) => { mat.opacity = opacity * (0.85 + 0.15 * Math.sin(t * 0.6)); });
  }
  // ---- a few coloured lights where the map has a reason for them (lanterns, the forge, the moon on the water)
  for (const [color, power, reach, x, y, z] of L.lights || []) { const p = new THREE.PointLight(color, power, reach, 1.6); p.position.set(x, y, z); S.add(p); }
  if (L.custom) L.custom(A, T);
  if (anims.length) A.anim.push((t) => { for (const f of anims) f(t); });
}

/** Northern lights: tall curtains of light hanging in the night sky, their rays drifting and rippling (one mesh, one draw). */
export function aurora(A, c1, c2, strength = 1) {
  const pos = [], uv = [], idx = [];
  for (const [a0, span, R, y0, h] of [[0.3, 1.5, 430, 70, 230], [2.4, 1.1, 450, 110, 260], [4.3, 1.4, 420, 60, 210], [5.6, 0.7, 460, 140, 240]]) {
    const n = 40, b = pos.length / 3;
    for (let k = 0; k <= n; k++) { const a = a0 + span * k / n, rr = R + Math.sin(k * 0.7) * 26; pos.push(Math.cos(a) * rr, y0, Math.sin(a) * rr, Math.cos(a) * rr, y0 + h, Math.sin(a) * rr); uv.push(k / n * span * 3, 0, k / n * span * 3, 1); }
    for (let k = 0; k < n; k++) { const i = b + k * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const u = { t: { value: 0 }, c1: { value: new THREE.Color(c1) }, c2: { value: new THREE.Color(c2) }, k: { value: strength } };
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float t, k; uniform vec3 c1, c2; varying vec2 vUv;
      float h(float x){ return fract(sin(x * 127.1) * 43758.5453); }
      float n(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h(i), h(i + 1.0), f); }
      void main(){ float x = vUv.x, y = vUv.y;
        float rays = n(x * 46.0 + t * 0.35) * 0.6 + n(x * 17.0 - t * 0.2) * 0.4; rays = pow(rays, 2.2);
        float band = n(x * 2.3 + t * 0.06); band = smoothstep(0.25, 0.75, band);
        float v = smoothstep(0.0, 0.12, y) * pow(1.0 - y, 1.6) * (0.5 + 0.5 * n(x * 6.0 + y * 2.0 - t * 0.1));
        float edge = smoothstep(0.0, 0.25, fract(x / 3.0) * 0.0 + 1.0);
        gl_FragColor = vec4(mix(c1, c2, clamp(y * 1.6 + n(x * 1.3 + t * 0.05) * 0.5 - 0.2, 0.0, 1.0)) * rays * band * v * k * 1.6 * edge, 1.0); }` }));
  m.frustumCulled = false; m.renderOrder = -1; A.scene.add(m); A.anim.push((t) => { u.t.value = t; });
  return m;
}
/** A soft round glow (a sprite): the light round a lantern, a crystal, a flame. */
let glowT = null;
export function glow(color, size, opacity = 0.9) {
  if (!glowT) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), d = g.createRadialGradient(32, 32, 0, 32, 32, 32); d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(0.25, 'rgba(255,255,255,0.45)'); d.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = d; g.fillRect(0, 0, 64, 64); glowT = new THREE.CanvasTexture(c); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); s.scale.setScalar(size); return s;
}

/** Sky Spires at dusk: stars and an aurora, a ring of cold light round the rim of every dish, clusters of glowing ice
 *  crystals on some of them, and the stone washed blue and rain-slick. */
function spireLook(A, T) {
  const S = A.scene, r = T.rng(2024);
  aurora(A, 0x40e0ff, 0xff60c0, 1.6);
  { const n = 1200, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = r() * TAU, v = Math.acos(1 - r() * 0.8); pos[i * 3] = Math.sin(v) * Math.cos(u) * 480; pos[i * 3 + 1] = Math.cos(v) * 480; pos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * 480; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); S.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe0d8ff, size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }))); }
  if (A.mats.dishFloor) { A.mats.dishFloor.color.setHex(0xc4ccf0); A.mats.dishFloor.roughness = 0.42; A.mats.dishFloor.envMapIntensity = 0.9; }
  const ringM = new THREE.MeshBasicMaterial({ color: 0x6ad8ff, toneMapped: false }), crysG = new THREE.OctahedronGeometry(1, 0);
  const crysM = [0x7ae0ff, 0xc08aff, 0xff8ad0].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2, roughness: 0.12, flatShading: true }));
  for (const p of A.plats) { if (!p.round) continue;
    const R = p.round, D = p.dish || 0, ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.12, 0.06, 6, 64), ringM); ring.rotation.x = Math.PI / 2; ring.position.set(p.x, p.y + D + 0.06, p.z); S.add(ring); A.own(p, ring);
    if (p.i % 3 === 1 || R > 9) { const a = r() * TAU, cx = p.x + Math.cos(a) * R * 0.78, cz = p.z + Math.sin(a) * R * 0.78, cy = p.y + D * 0.61, m = crysM[p.i % 3]; // a cluster of ice crystals near the rim
      for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(crysG, m), sc = 0.35 + r() * 0.6; c.scale.set(sc * 0.45, sc * 1.6, sc * 0.45); c.rotation.set((r() - 0.5) * 0.7, r() * 3, (r() - 0.5) * 0.7); c.position.set(cx + (r() - 0.5) * 1.1, cy + sc * 0.8, cz + (r() - 0.5) * 1.1); S.add(c); A.own(p, c); }
      const gl = glow(m.color.getHex(), 6, 0.7); gl.position.set(cx, cy + 0.9, cz); S.add(gl); A.own(p, gl); } }
}
function stars(A, T) { const r = T.rng(909), n = 1300, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = r() * TAU, v = Math.acos(1 - r() * 0.85); pos[i * 3] = Math.sin(v) * Math.cos(u) * 480; pos[i * 3 + 1] = Math.cos(v) * 480; pos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * 480; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); A.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd8dcff, size: 1.4, sizeAttenuation: false, fog: false }))); }
/** Saw Foundry: streams of molten metal pouring down all round the works, each with a white-hot glow where it starts
 *  and where it lands in the smog. */
function foundryLook(A, T) {
  const S = A.scene, tx = T.canvasTex((g, s) => { const q = T.rng(55); const b = g.createLinearGradient(0, 0, s, 0); b.addColorStop(0, '#7a1c04'); b.addColorStop(0.5, '#ffd27a'); b.addColorStop(1, '#7a1c04'); g.fillStyle = b; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${q() < 0.5 ? '255,255,220' : '160,40,0'},${0.25 + q() * 0.4})`; g.fillRect(q() * s, q() * s, 2 + q() * 5, 20 + q() * 70); } }, 128);
  tx.repeat.set(1, 6);
  const m = new THREE.MeshBasicMaterial({ map: tx, toneMapped: false, fog: false });
  A.anim.push((t) => { tx.offset.y = t * 0.9; });
  for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + 0.4, R = 118 + (k % 3) * 14, x = Math.cos(a) * R, z = Math.sin(a) * R, top = 46 + (k % 4) * 12, w = 1.1 + (k % 3) * 0.5;
    const f = new THREE.Mesh(new THREE.CylinderGeometry(w, w * 0.7, top + 58, 10, 1, true), m); f.position.set(x, (top - 58) / 2, z); S.add(f);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(w * 2.2, w * 2.2, 5, 10), new THREE.MeshStandardMaterial({ color: 0x2a2428, metalness: 0.7, roughness: 0.4 })); spout.position.set(x, top + 2, z); S.add(spout);
    for (const [y, sz] of [[top - 1, 16], [-54, 34]]) { const gl = glow(0xff7a20, sz, 0.8); gl.position.set(x, y, z); S.add(gl); } }
}

/** Glowing motes drifting through a map (fireflies, spores, paper lanterns): one set of points, slowly wheeling and bobbing. */
function motes(A, T, o) {
  let R = 40, y0 = 1e9, y1 = -1e9; for (const p of A.plats) { R = Math.max(R, Math.hypot(p.x, p.z)); const y = p.ya !== undefined ? (p.ya + p.yb) / 2 : p.y; y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const r = T.rng(o.seed || 606), n = o.n, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.sqrt(r()) * (R + 25) * (o.spread || 1); pos[i * 3] = o.flat ? (r() - 0.5) * 60 : Math.cos(a) * d; pos[i * 3 + 1] = y0 - 6 + r() * (y1 - y0 + (o.up || 24)); pos[i * 3 + 2] = o.flat ? (r() - 0.5) * 2 * Math.min(R, 170) : Math.sin(a) * d; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  glow(0, 1); // (makes sure the soft round texture exists)
  const m = new THREE.PointsMaterial({ map: glowT, color: o.color, size: o.size, sizeAttenuation: true, transparent: true, opacity: o.opacity || 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; A.scene.add(pts);
  A.anim.push((t) => { if (!o.flat) pts.rotation.y = t * (o.turn || 0.01); pts.position.y = Math.sin(t * 0.5) * 0.8 + (o.rise ? (t * o.rise) % 6 : 0); m.opacity = (o.opacity || 0.9) * (0.75 + 0.25 * Math.sin(t * 2.3)); });
}
function fireflies(c, n = 260, size = 0.55) { return (A, T) => motes(A, T, { n, color: c, size }); }
function lanterns(A, T) { motes(A, T, { n: 110, color: 0xffa040, size: 2.2, up: 60, rise: 0.25, spread: 1.3, seed: 707 }); motes(A, T, { n: 160, color: 0xffd080, size: 0.5, seed: 708 }); }
/** Comet Crash: great clouds of coloured gas far off in space, and many more stars. */
function nebula(A, T) { const r = T.rng(1212);
  for (const [c, s] of [[0x6a30ff, 520], [0x2060ff, 440], [0xff3aa0, 380], [0x20c0ff, 300], [0x8a40ff, 460]]) { const a = r() * TAU, e = (r() - 0.3) * 1.2, gl = glow(c, s, 0.5); gl.material.fog = false; gl.position.set(Math.cos(a) * Math.cos(e) * 430, Math.sin(e) * 430, Math.sin(a) * Math.cos(e) * 430); gl.renderOrder = -2; A.scene.add(gl); }
  const n = 1500, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = r() * TAU, v = Math.acos(1 - r() * 2); pos[i * 3] = Math.sin(v) * Math.cos(u) * 470; pos[i * 3 + 1] = Math.cos(v) * 470; pos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * 470; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); A.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.3, sizeAttenuation: false, fog: false }))); }
/** A burning torch or brazier at each of the given spots: a dark post, a flickering flame glow. */
function fires(A, spots, h = 2.4) { const post = new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 0.8 }), gs = [];
  const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.13, h, 6).translate(0, h / 2, 0), post, spots.length), mt = new THREE.Matrix4();
  spots.forEach(([x, y, z], i) => { mt.makeTranslation(x, y, z); im.setMatrixAt(i, mt); const gl = glow(0xff8a30, 3.6, 0.9); gl.position.set(x, y + h + 0.35, z); A.scene.add(gl); gs.push(gl); });
  A.scene.add(im); A.anim.push((t) => { for (let i = 0; i < gs.length; i++) gs[i].scale.setScalar(3.6 + Math.sin(t * 9 + i * 2.1) * 0.5 + Math.sin(t * 23 + i) * 0.3); }); }
/** Sky Plateaus: braziers burning round the rim of every plateau. */
function plateauLook(A) { const s = []; for (const p of A.plats) { if ((p.w || 0) < 20) continue; for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + p.i, rr = Math.min(p.w, p.d) / 2 - 1.5; s.push([p.x + Math.cos(a) * rr, p.y, p.z + Math.sin(a) * rr]); } } fires(A, s); }
/** Transport: torches burning down both sides of the road. */
function transportLook(A) { const C = A.caravan; if (!C) return; const s = []; for (let d = 6; d < C.len; d += 26) { const w = C.at(d), side = (d / 26 | 0) % 2 ? 1 : -1; s.push([w.x + Math.cos(w.a) * side * 5.2, 0, w.z - Math.sin(w.a) * side * 5.2]); } fires(A, s, 2.8); }
