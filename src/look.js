// The finishing pass every map gets once it's built (high quality only): its surfaces mirror its own sky (so stone,
// wood, metal and leaves pick up the colour of the air round them and glossy things glint), bands of drifting haze give
// it depth, shafts of light slant down through the air, and a few coloured lights sit where the map has a reason for
// them. Each map's settings are one line in LOOK; the Colosseum has its own, fuller treatment (see maps2.js and maw.js).
import * as THREE from 'three';

const TAU = Math.PI * 2;
// env: how strongly surfaces mirror the sky. gloss: [material name in A.mats, new roughness] pairs (polished or wet
// things). haze: [colour, opacity, lift] bands round the arena (lift: how far up it starts, as a fraction of the
// arena's height; add 'n' for ordinary blending rather than glowing). shafts: [colour, opacity, how many]. lights:
// [colour, power, reach, x, y, z].
const LOOK = {
  spire: { env: 0.45, wet: 0.72, haze: [[0xdcecff, 0.3, -0.6]], shafts: [0xfff4dc, 0.1, 7] },
  plateaus: { env: 0.35, haze: [[0xffe2b8, 0.28, -0.5]], shafts: [0xffeecc, 0.08, 6] },
  tilt: { env: 0.7, wet: 0.5, haze: [[0x4a6aff, 0.3, -0.7]] },
  canopy: { env: 0.55, wet: 0.6, haze: [[0xc8f0a0, 0.3, -0.3], [0x9ad0a0, 0.18, 0.2]], shafts: [0xf4ffc0, 0.16, 12] },
  grove: { env: 0.5, wet: 0.7, haze: [[0xffc890, 0.32, -0.5]], shafts: [0xffd0a0, 0.15, 9], flat: true },
  run: { env: 0.5, wet: 0.65, shafts: [0xe8ffb0, 0.13, 10], flat: true },
  isles: { env: 0.7, wet: 0.45, haze: [[0x6a58ff, 0.34, -0.5]] },
  bamboo: { env: 0.5, wet: 0.6, haze: [[0xd8f0a8, 0.26, -0.4]], shafts: [0xf0ffc0, 0.14, 9] },
  pagoda: { env: 0.55, wet: 0.6, haze: [[0xffb890, 0.3, -0.5]], shafts: [0xffc8a0, 0.13, 8], lights: [[0xffa050, 300, 70, 0, 9, 0]] },
  dojo: { env: 0.45, wet: 0.75, haze: [[0xe8f0ff, 0.28, -0.4]], shafts: [0xffffff, 0.08, 6], lights: [[0xffb060, 260, 60, 0, 6, 0]] },
  city: { env: 0.8, wet: 0.5, haze: [[0xc8dcff, 0.3, -0.7]], shafts: [0xe8f0ff, 0.07, 6] },
  foundry: { env: 0.6, wet: 0.55, haze: [[0xff9a50, 0.3, -0.7]], lights: [[0xff7a30, 420, 110, 0, -14, 0]] },
  comet: { env: 0.6, wet: 0.6, lights: [[0x8ac8ff, 300, 120, 0, 30, 0]], flat: true },
  lava: { env: 0.45, wet: 0.6, flat: true },
  transport: { env: 0.35, shafts: [0xffe2b0, 0.1, 8], flat: true },
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

export function applyLook(A, T) {
  const L = LOOK[A.mapId]; if (!L || A.quality === 'low') return;
  const S = A.scene;
  // ---- reflections: everything mirrors the sky a little; polished and wet things a lot
  const env = skyEnv(A, T), seen = new Set();
  S.traverse((o) => { if (o.isHemisphereLight) o.intensity *= 0.9; // (the mirrored sky adds some light of its own)
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) { if (!m.isMeshStandardMaterial || m.envMap || seen.has(m)) continue; seen.add(m);
      m.envMap = env; m.envMapIntensity = L.env * (m.metalness > 0.4 ? 1.8 : 1);
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
