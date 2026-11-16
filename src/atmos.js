// Atmosphere on top of each map: a glowing sun in the sky where the light comes from, and a drift of small things in
// the air round the camera (embers, petals, dust, leaves, pollen, snow). One sprite and one draw call of points per map.
import * as THREE from 'three';

// what drifts in the air on each map: colour, how many, size (m), drift (m/s), sway, and whether it glows (additive)
const AIR = {
  spire: { c: 0xffffff, n: 380, size: 0.07, vel: [0.5, 0.06, 0.25], sway: 0.5, glow: true, a: 0.55 }, // ice sparkle
  tilt: { c: 0xfff4dc, n: 320, size: 0.07, vel: [0.4, 0.05, -0.3], sway: 0.5, glow: true, a: 0.5 },
  city: { c: 0xdfeaff, n: 300, size: 0.06, vel: [0.8, 0.02, 0.3], sway: 0.4, glow: true, a: 0.4 },
  plateaus: { c: 0xf2d9a4, n: 520, size: 0.1, vel: [2.2, 0.08, 0.5], sway: 0.8, a: 0.5 }, // blown sand
  colosseum: { c: 0xecc994, n: 520, size: 0.1, vel: [1.4, 0.15, -0.6], sway: 0.9, a: 0.5 },
  canopy: { c: 0xeaffb4, n: 420, size: 0.09, vel: [0.15, 0.25, 0.1], sway: 1.0, glow: true, a: 0.6 }, // pollen in the light
  pagoda: { c: 0xffb9cc, n: 420, size: 0.16, vel: [0.9, -0.9, 0.3], sway: 1.4, a: 0.9 }, // cherry petals
  bamboo: { c: 0xa9d466, n: 360, size: 0.17, vel: [0.5, -0.8, 0.2], sway: 1.5, a: 0.9 }, // falling leaves
  dojo: { c: 0xffffff, n: 520, size: 0.11, vel: [0.6, -0.7, 0.2], sway: 0.9, a: 0.85 }, // snow off the peak
  run: { c: 0x9ad06a, n: 420, size: 0.16, vel: [0.3, -0.9, 3], sway: 1.4, a: 0.9 }, // (leaves whipping past)
  lava: { c: 0xff7a26, n: 700, size: 0.11, vel: [0.2, 2.2, 0.15], sway: 1.0, glow: true, a: 0.95 }, // embers rising off the lava
  foundry: { c: 0xff8a2e, n: 460, size: 0.1, vel: [0.2, 1.5, 0.1], sway: 0.9, glow: true, a: 0.9 }, // embers
};
const NO_SUN = ['comet', 'lava', 'run', 'isles', 'pagoda', 'canopy']; // (space, a moon of its own, a sun of its own, a roof of leaves)

let glowTex = null;
function sunTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.045, 'rgba(255,255,255,1)'); gr.addColorStop(0.07, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.2, 'rgba(255,255,255,0.08)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.015)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace; return glowTex;
}

export function addAtmosphere(A) {
  const S = A.scene, low = A.quality === 'low';
  // relief: every textured surface also uses its own painting as a height map, so the joints between stones, the grain
  // in planks and the cracks in rock catch the light instead of looking printed on
  if (!low) S.traverse((ob) => { const m = ob.material; if (m && m.isMeshStandardMaterial && m.map && !m.bumpMap && !m.normalMap && !m.transparent) { m.bumpMap = m.map; m.bumpScale = 1.6; m.needsUpdate = true; } });
  if (A.sun && A.sunOff && !NO_SUN.includes(A.mapId)) { // the sun: a white-hot disc in a wide soft halo, behind the mountains
    const col = A.sun.color.clone().lerp(new THREE.Color(0xffffff), 0.35);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), color: col, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
    s.position.copy(A.sunOff).normalize().multiplyScalar(500); s.scale.setScalar(340); s.renderOrder = -4; S.add(s);
  }
  const o = AIR[A.mapId]; if (!o || low) return;
  const BOX = 56, pos = new Float32Array(o.n * 3); for (let i = 0; i < pos.length; i++) pos[i] = Math.random();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: o.glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { cam: { value: new THREE.Vector3() }, vel: { value: new THREE.Vector3(...o.vel) }, time: { value: 0 }, size: { value: o.size }, sway: { value: o.sway }, box: { value: BOX }, col: { value: new THREE.Color(o.c) }, alpha: { value: o.a }, px: { value: 600 } },
    vertexShader: `uniform vec3 cam, vel; uniform float time, size, sway, box, px; varying float vA;
      void main() { // each speck drifts and sways, and wraps round a box that follows the camera
        vec3 p = position * box + vel * time;
        p.x += sin(time * 0.7 + position.y * 40.0) * sway; p.z += cos(time * 0.55 + position.x * 37.0) * sway; p.y += sin(time * 0.9 + position.z * 31.0) * sway * 0.3;
        p = mod(p - cam, box) - box * 0.5 + cam;
        vec4 mv = viewMatrix * vec4(p, 1.0); float d = -mv.z;
        vA = smoothstep(box * 0.5, box * 0.3, length(p - cam)) * smoothstep(0.6, 2.5, d) * (0.6 + 0.4 * sin(time * 3.0 + position.x * 90.0));
        gl_PointSize = max(1.0, size * (0.6 + position.z * 0.8) * px / max(d, 0.1)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 col; uniform float alpha; varying float vA;
      void main() { float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.15, r) * vA * alpha; if (a < 0.01) discard; gl_FragColor = vec4(col, a); }`,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5;
  const size = new THREE.Vector2();
  pts.onBeforeRender = (renderer, scene, camera) => {
    mat.uniforms.cam.value.setFromMatrixPosition(camera.matrixWorld); mat.uniforms.time.value = (performance.now() / 1000) % 3600;
    renderer.getDrawingBufferSize(size); mat.uniforms.px.value = size.y * 0.7;
  };
  S.add(pts);
}
