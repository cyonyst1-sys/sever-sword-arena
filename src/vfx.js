// Small shared visual effects: a rim of light round the fighters (tinted by the map's sky), wind in grass, leaves and
// cloth, ripples on water, the line a cut draws for a split second, and a soft shadow under each fighter's feet.
import * as THREE from 'three';

export const RIM = { value: new THREE.Color(0x5a6a80) }, WIND = { value: 0 };
export function setRim(c, k = 1) { RIM.value.copy(c).multiplyScalar(k); }

// patch a standard material's shader once (chained after anything already patching it; its own slot in the program cache)
function once(m, key, fn) {
  if (!m || !m.isMeshStandardMaterial || m.userData[key]) return; m.userData[key] = 1;
  const prev = m.onBeforeCompile, pk = m.customProgramCacheKey();
  m.onBeforeCompile = (s, r) => { prev.call(m, s, r); fn(s); };
  m.customProgramCacheKey = () => pk + '|' + key + (m.userData[key + 'K'] || '');
  m.needsUpdate = true;
}

/** A rim of light on a fighter's silhouette: strongest where the surface turns away from the camera, and on top. */
export function rim(m) {
  once(m, 'rim', (s) => { s.uniforms.uRim = RIM;
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRim;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ float rf = 1.0 - saturate(dot(normalize(vViewPosition), normal)); rf = rf * rf * rf;
  totalEmissiveRadiance += uRim * rf * (0.3 + 0.7 * saturate(normal.y * 0.6 + 0.5)); }`); });
}

/** Wind. kind 'grass': blades bend from the root (instanced tufts). 'leaf': a whole clump shifts a little.
 *  'cloth': hangs from its top edge (uv.y = 1) and billows more toward the bottom. */
export function sway(m, kind = 'grass', amp = 1) {
  if (m) m.userData.swayK = kind + amp;
  const a = amp.toFixed(3), move = kind === 'grass' ? `float k = position.y * ${a}; transformed.x += (w1 + 0.4 * w2) * k; transformed.z += (0.6 * w2 + 0.3 * w1) * k;`
    : kind === 'cloth' ? `float k = (1.0 - uv.y) * ${a}; transformed += normal * (0.6 * w1 + 0.4 * w2) * k;`
    : `transformed.x += w1 * ${a}; transformed.z += w2 * ${a} * 0.7; transformed.y += w2 * ${a} * 0.3;`;
  once(m, 'sway', (s) => { s.uniforms.uWind = WIND;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace('#include <begin_vertex>', `#include <begin_vertex>
{
#ifdef USE_INSTANCING
  vec3 wq = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
#else
  vec3 wq = (modelMatrix * vec4(position, 1.0)).xyz;
#endif
  float w1 = sin(uWind * 1.6 + wq.x * 0.31 + wq.z * 0.23), w2 = sin(uWind * 2.7 - wq.x * 0.9 + wq.z * 0.7);
  ${move}
}`); });
}

/** Water: small waves crossing each other tip the surface this way and that, so the sky it mirrors shimmers. */
export function ripple(m, k = 1) {
  once(m, 'ripple', (s) => { s.uniforms.uWind = WIND;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRipW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRipW = (modelMatrix * vec4(position, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWind; varying vec3 vRipW;').replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ vec2 q = vRipW.xz; float t = uWind; vec2 g = vec2(0.0);
  g += vec2(0.8, 0.6) * cos(dot(q, vec2(0.8, 0.6)) * 0.55 + t * 1.3);
  g += vec2(-0.5, 0.86) * cos(dot(q, vec2(-0.5, 0.86)) * 0.9 - t * 1.7) * 0.7;
  g += vec2(0.2, -0.98) * cos(dot(q, vec2(0.2, -0.98)) * 1.7 + t * 2.3) * 0.5;
  g += vec2(-0.9, -0.4) * cos(dot(q, vec2(-0.9, -0.4)) * 3.1 + t * 3.1) * 0.3;
  normal = normalize(normal + mat3(viewMatrix) * vec3(g.x, 0.0, g.y) * ${(0.1 * k).toFixed(3)} / (1.0 + length(vViewPosition) * 0.01)); }`); });
}

/** The line a cut draws: a thin streak of light along the cut, seen edge-on, gone in a fifth of a second. */
export function makeSliceLines(scene) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 16; const g = c.getContext('2d');
  const a = g.createLinearGradient(0, 0, 128, 0); a.addColorStop(0, 'rgba(255,255,255,0)'); a.addColorStop(0.5, 'rgba(255,255,255,1)'); a.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = a; g.fillRect(0, 0, 128, 16);
  g.globalCompositeOperation = 'destination-in'; const b = g.createLinearGradient(0, 0, 0, 16); b.addColorStop(0, 'rgba(0,0,0,0)'); b.addColorStop(0.5, 'rgba(0,0,0,1)'); b.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = b; g.fillRect(0, 0, 128, 16);
  const tex = new THREE.CanvasTexture(c), geo = new THREE.PlaneGeometry(1, 1), pool = [];
  const view = new THREE.Vector3(), dir = new THREE.Vector3(), up = new THREE.Vector3(), mt = new THREE.Matrix4();
  return {
    emit(at, n, cam, color = 0xfff0d8) {
      let m = pool.find((q) => q.t <= 0);
      if (!m) { if (pool.length >= 8) return; m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false })); m.renderOrder = 20; m.frustumCulled = false; scene.add(m); pool.push(m); }
      view.subVectors(at, cam.position).normalize(); dir.crossVectors(n, view); if (dir.lengthSq() < 1e-4) dir.set(1, 0, 0); dir.normalize(); up.crossVectors(view, dir).normalize();
      mt.makeBasis(dir, up, view); m.quaternion.setFromRotationMatrix(mt); m.position.copy(at).addScaledVector(view, -0.35);
      m.material.color.setHex(color); m.t = m.T = 0.2; m.visible = true; m.scale.set(2.4, 0.06, 1); m.material.opacity = 0.5;
    },
    update(dt) { for (const m of pool) { if (m.t <= 0) continue; m.t -= dt; const k = Math.max(0, m.t / m.T); m.material.opacity = 0.5 * k; m.scale.set(2.4 + (1 - k) * 0.9, 0.025 + 0.045 * k, 1); if (m.t <= 0) m.visible = false; } },
  };
}

/** A soft dark patch under a fighter's feet (it fades as they leave the ground). */
let blobT = null;
export function makeBlob() {
  if (!blobT) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), d = g.createRadialGradient(32, 32, 0, 32, 32, 32); d.addColorStop(0, 'rgba(0,0,0,1)'); d.addColorStop(0.45, 'rgba(0,0,0,0.55)'); d.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = d; g.fillRect(0, 0, 64, 64); blobT = new THREE.CanvasTexture(c); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobT, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false }));
  m.renderOrder = 1; m.visible = false; return m;
}
