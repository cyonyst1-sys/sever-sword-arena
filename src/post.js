// Post-processing (high quality only): the scene is drawn into an HDR, multisampled buffer, the bright parts are bloomed
// (a small chain of down- and up-samples), surfaces that crowd each other are shaded (ambient occlusion, from the depth
// buffer), then everything is colour-graded, vignetted and
// dithered on its way to the screen. No three.js addons: a handful of full-screen passes.
import * as THREE from 'three';

const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const pass = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });

const DOWN = `varying vec2 vUv; uniform sampler2D t; uniform vec2 px; uniform float knee;
void main() { // 4 bilinear taps (a 4x4 box); on the first step, keep only what is brighter than the knee
  vec3 c = (texture2D(t, vUv + px * vec2(-1., -1.)).rgb + texture2D(t, vUv + px * vec2(1., -1.)).rgb + texture2D(t, vUv + px * vec2(-1., 1.)).rgb + texture2D(t, vUv + px * vec2(1., 1.)).rgb) * 0.25;
  if (knee > 0.0) { c = pow(c, vec3(2.2)); float l = max(c.r, max(c.g, c.b)); c *= smoothstep(knee * 0.8, knee * 1.5, l); c = min(c, vec3(2.0)); }
  gl_FragColor = vec4(c, 1.0); }`;
const UP = `varying vec2 vUv; uniform sampler2D t, add; uniform vec2 px;
void main() { // a 3x3 tent of the smaller level, added to this one
  vec3 c = texture2D(t, vUv).rgb * 4.0;
  c += (texture2D(t, vUv + px * vec2(-1., 0.)).rgb + texture2D(t, vUv + px * vec2(1., 0.)).rgb + texture2D(t, vUv + px * vec2(0., -1.)).rgb + texture2D(t, vUv + px * vec2(0., 1.)).rgb) * 2.0;
  c += texture2D(t, vUv + px * vec2(-1., -1.)).rgb + texture2D(t, vUv + px * vec2(1., -1.)).rgb + texture2D(t, vUv + px * vec2(-1., 1.)).rgb + texture2D(t, vUv + px * vec2(1., 1.)).rgb;
  gl_FragColor = vec4(c / 16.0 + texture2D(add, vUv).rgb, 1.0); }`;
const RAYS = `varying vec2 vUv; uniform sampler2D depth; uniform vec3 sun; uniform float aspect;
void main() { // light pouring round whatever stands between you and the sun: march toward it, adding up the open sky near it
  vec2 st = (sun.xy - vUv) / 20.0 * 0.92, p = vUv; float acc = 0.0, w = 1.0;
  for (int i = 0; i < 20; i++) { p += st;
    float z = 45.0 / (900.0 - texture2D(depth, p).x * 899.95), open = step(400.0, z) * step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0);
    vec2 q = (p - sun.xy) * vec2(aspect, 1.0); acc += open * exp(-dot(q, q) * 34.0) * w; w *= 0.97; }
  vec2 q0 = (vUv - sun.xy) * vec2(aspect, 1.0); // (the shafts fade out away from the sun)
  gl_FragColor = vec4(vec3(acc / 20.0 * sun.z * 1.4 * exp(-dot(q0, q0) * 2.2)), 1.0); }`;
// Ambient occlusion from the depth buffer alone, at half size: where surfaces meet or crowd each other (feet on the
// floor, a blade against the body, the foot of a wall, creases in armour) less of the sky's light gets in, so it is a
// little darker there. For each pixel: where it is and which way it faces (from its neighbours' depths), then eight
// nearby points on a spiral, each adding shade by how far it stands above this surface and how close it is.
const LIN = 'float lin(vec2 uv) { return 45.0 / (900.0 - texture2D(depth, uv).x * 899.95); }\n'; // (depth to metres: near 0.05, far 900)
const AO = `varying vec2 vUv; uniform sampler2D depth; uniform vec2 px, proj;
${LIN}vec3 at(vec2 uv, float z) { return vec3((uv * 2.0 - 1.0) * proj * z, -z); }
void main() {
  float z = lin(vUv); if (z > 110.0) { gl_FragColor = vec4(1.0); return; }
  vec3 P = at(vUv, z); vec2 ex = vec2(px.x, 0.0), ey = vec2(0.0, px.y);
  float zl = lin(vUv - ex), zr = lin(vUv + ex), zd = lin(vUv - ey), zu = lin(vUv + ey); // (the nearer neighbour each way, so an edge takes its facing from its own side)
  vec3 dx = abs(zl - z) < abs(zr - z) ? P - at(vUv - ex, zl) : at(vUv + ex, zr) - P, dy = abs(zd - z) < abs(zu - z) ? P - at(vUv - ey, zd) : at(vUv + ey, zu) - P;
  vec3 N = normalize(cross(dx, dy));
  float R = 0.6, rad = min(0.11, R / (2.0 * z * proj.y)), a0 = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2832, occ = 0.0;
  for (int i = 0; i < 8; i++) { float a = a0 + float(i) * 2.39996, r = rad * sqrt((float(i) + 0.5) / 8.0);
    vec2 uv = vUv + vec2(cos(a) * proj.y / proj.x, sin(a)) * r; vec3 v = at(uv, lin(uv)) - P; float d2 = dot(v, v);
    occ += max(0.0, dot(v, N) - 0.012 - 0.004 * z) / (d2 + 0.012) * (1.0 - smoothstep(R * R, R * R * 3.0, d2)); }
  float ao = clamp(1.0 - occ * 0.085, 0.0, 1.0);
  gl_FragColor = vec4(mix(ao, 1.0, smoothstep(50.0, 110.0, z)), 0.0, 0.0, 1.0); }`;
const AOBLUR = `varying vec2 vUv; uniform sampler2D t, depth; uniform vec2 px;
${LIN}void main() { // smooth the grain out, without bleeding across edges (neighbours at a different depth count for little)
  float z = lin(vUv), s = 0.0, w = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 uv = vUv + vec2(float(i), float(j)) * px * 1.5; float k = max(0.02, 1.0 - abs(lin(uv) - z) / (0.05 + 0.04 * z)); s += texture2D(t, uv).r * k; w += k; }
  gl_FragColor = vec4(s / w, 0.0, 0.0, 1.0); }`;
const FINAL = `varying vec2 vUv; uniform sampler2D t, bloom, depth, rays, aoT; uniform float strength, time, aoK; uniform vec2 px; uniform mat4 invVP; uniform vec3 camPos, fogCol, sunCol; uniform vec4 fogP;
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453), b = fract(sin(dot(i + vec2(1., 0.), vec2(127.1, 311.7))) * 43758.5453), c = fract(sin(dot(i + vec2(0., 1.), vec2(127.1, 311.7))) * 43758.5453), d = fract(sin(dot(i + vec2(1., 1.), vec2(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
void main() {
  vec3 c = texture2D(t, vUv).rgb;
  // a touch of sharpening (unsharp mask against the 4 neighbours)
  vec3 n = (texture2D(t, vUv + vec2(px.x, 0.)).rgb + texture2D(t, vUv - vec2(px.x, 0.)).rgb + texture2D(t, vUv + vec2(0., px.y)).rgb + texture2D(t, vUv - vec2(0., px.y)).rgb) * 0.25;
  c = max(c + (c - n) * 0.35, 0.0);
  if (aoK > 0.0) c *= mix(1.0, texture2D(aoT, vUv).r, aoK); // (ambient occlusion: under the mist and the glow, like any other shade)
  if (fogP.z > 0.0) { // mist that lies low: thick down in the depths and toward the horizon, thin up where the fight is, drifting
    vec4 w = invVP * vec4(vUv * 2.0 - 1.0, texture2D(depth, vUv).x * 2.0 - 1.0, 1.0); vec3 ray = w.xyz / w.w - camPos; float dist = length(ray); vec3 rd = ray / dist; dist = min(dist, 600.0);
    float tt = clamp(rd.y * dist * fogP.y, -40.0, 40.0), amt = fogP.z * exp(min(8.0, -fogP.y * (camPos.y - fogP.x))) * dist * (abs(tt) > 0.001 ? (1.0 - exp(-tt)) / tt : 1.0);
    amt *= 0.65 + 0.7 * vnoise((camPos.xz + rd.xz * min(dist, 140.0)) * 0.018 + fogP.w * vec2(0.03, 0.017));
    c = mix(c, fogCol, min(0.9, 1.0 - exp(-amt))); }
  c += sunCol * texture2D(rays, vUv).r;
  vec3 b = texture2D(bloom, vUv).rgb; b = b / (1.0 + b * 1.5); // (soft-capped, so stacked bright effects never flare out)
  c = min(pow(pow(min(c, vec3(4.0)), vec3(2.2)) + b * strength, vec3(1.0 / 2.2)), vec3(1.0)); // (bloom is added in linear light)
  // grade: a little more contrast and colour, warm highlights and cool shadows
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, 1.14);
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);
  c *= mix(vec3(0.95, 0.98, 1.06), vec3(1.04, 1.01, 0.96), smoothstep(0.1, 0.8, l));
  // vignette
  vec2 q = vUv - 0.5; c *= 1.0 - dot(q, q) * 0.55;
  c = clamp(c, 0.0, 1.0);
  c += (hash(gl_FragCoord.xy) - 0.5) / 255.0; // (dither: no banding in skies and fog)
  gl_FragColor = vec4(c, 1.0); }`;

export function makePost(renderer) {
  const LEVELS = 5, opt = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const main = new THREE.WebGLRenderTarget(4, 4, { ...opt, type: THREE.UnsignedByteType, depthBuffer: true, samples: 4 }); // (8-bit, like the screen: cheap to multisample)
  // (flagged like an XR target so three.js tone-maps and encodes into it exactly as it does to the screen: every map keeps
  // the look it had, and bloom and grading go on top)
  main.depthTexture = new THREE.DepthTexture(4, 4); main.depthTexture.type = THREE.UnsignedIntType; // (the depth of every pixel: for the low mist and the shafts of sunlight)
  main.isXRRenderTarget = true; main.texture.colorSpace = THREE.SRGBColorSpace; main.texture.internalFormat = 'RGBA8'; // (plain RGBA8 for both the texture and its multisample buffer)
  const down = [], up = [];
  for (let i = 0; i < LEVELS; i++) { down.push(new THREE.WebGLRenderTarget(4, 4, opt)); if (i < LEVELS - 1) up.push(new THREE.WebGLRenderTarget(4, 4, opt)); }
  const mDown = pass(DOWN, { t: { value: null }, px: { value: new THREE.Vector2() }, knee: { value: 0 } });
  const mUp = pass(UP, { t: { value: null }, add: { value: null }, px: { value: new THREE.Vector2() } });
  const mFinal = pass(FINAL, { t: { value: main.texture }, aoT: { value: null }, aoK: { value: 0 }, bloom: { value: null }, strength: { value: 0.3 }, time: { value: 0 }, px: { value: new THREE.Vector2() }, depth: { value: main.depthTexture }, rays: { value: null }, invVP: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() }, fogCol: { value: new THREE.Color() }, sunCol: { value: new THREE.Color(0) }, fogP: { value: new THREE.Vector4() } });
  const raysRT = new THREE.WebGLRenderTarget(4, 4, { ...opt, type: THREE.UnsignedByteType }), mRays = pass(RAYS, { depth: { value: main.depthTexture }, sun: { value: new THREE.Vector3() }, aspect: { value: 1 } }), sv = new THREE.Vector3(), cd = new THREE.Vector3();
  mFinal.uniforms.rays.value = raysRT.texture;
  const aoOpt = { type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false }, aoA = new THREE.WebGLRenderTarget(4, 4, aoOpt), aoB = new THREE.WebGLRenderTarget(4, 4, aoOpt);
  const mAO = pass(AO, { depth: { value: main.depthTexture }, px: { value: new THREE.Vector2() }, proj: { value: new THREE.Vector2() } }), mAOB = pass(AOBLUR, { t: { value: aoA.texture }, depth: { value: main.depthTexture }, px: { value: new THREE.Vector2() } });
  mFinal.uniforms.aoT.value = aoB.texture;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mDown); quad.frustumCulled = false;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), size = new THREE.Vector2();
  let W = 0, H = 0, frame = 0;
  const draw = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quad, cam); };
  const api = {
    ao: true, // (ambient occlusion on; the game switches it off when the frame rate needs the help)
    render(scene, camera, atmo) {
      renderer.getDrawingBufferSize(size);
      if (size.x !== W || size.y !== H) {
        W = size.x; H = size.y; main.setSize(W, H); raysRT.setSize(Math.max(2, W >> 2), Math.max(2, H >> 2)); aoA.setSize(Math.max(2, W >> 1), Math.max(2, H >> 1)); aoB.setSize(Math.max(2, W >> 1), Math.max(2, H >> 1));
        for (let i = 0; i < LEVELS; i++) { const w = Math.max(2, W >> (i + 1)), h = Math.max(2, H >> (i + 1)); down[i].setSize(w, h); if (up[i]) up[i].setSize(w, h); }
      }
      renderer.setRenderTarget(main); renderer.render(scene, camera);
      if (api.ao) { const e = camera.projectionMatrix.elements; mAO.uniforms.proj.value.set(1 / e[0], 1 / e[5]); mAO.uniforms.px.value.set(2 / W, 2 / H); draw(mAO, aoA); mAOB.uniforms.px.value.set(2 / W, 2 / H); draw(mAOB, aoB); }
      mFinal.uniforms.aoK.value = api.ao ? 0.9 : 0;
      { const A = atmo && atmo.dens > 0 ? atmo : null, u = mFinal.uniforms; let rs = 0;
        u.fogP.value.set(A ? A.base : 0, A ? A.fall : 0, A ? A.dens : 0, (performance.now() / 1000) % 4000);
        if (A) { u.fogCol.value.copy(A.color); u.camPos.value.copy(camera.position); u.invVP.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse); }
        if (A && A.sun && A.rays > 0) { const f = camera.getWorldDirection(cd).dot(A.sun); // (only with the sun in front of you, fading out as it leaves the screen)
          if (f > 0.15) { sv.copy(camera.position).addScaledVector(A.sun, 500).project(camera); rs = A.rays * Math.min(1, (f - 0.15) / 0.3) * Math.max(0, 1 - Math.max(0, Math.max(Math.abs(sv.x), Math.abs(sv.y)) - 1) / 0.6); } }
        if (rs > 0.01) { mRays.uniforms.sun.value.set(sv.x * 0.5 + 0.5, sv.y * 0.5 + 0.5, rs); mRays.uniforms.aspect.value = W / H; draw(mRays, raysRT); u.sunCol.value.copy(A.sunCol); } else u.sunCol.value.setRGB(0, 0, 0); }
      let src = main;
      for (let i = 0; i < LEVELS; i++) { // bright parts, smaller and smaller
        mDown.uniforms.t.value = src.texture; mDown.uniforms.px.value.set(0.5 / src.width, 0.5 / src.height).multiplyScalar(i ? 2 : 1); mDown.uniforms.knee.value = i ? 0 : 0.97;
        draw(mDown, down[i]); src = down[i];
      }
      for (let i = LEVELS - 2; i >= 0; i--) { // ...and back up, each level adding its own blur
        mUp.uniforms.t.value = src.texture; mUp.uniforms.add.value = down[i].texture; mUp.uniforms.px.value.set(1 / src.width, 1 / src.height);
        draw(mUp, up[i]); src = up[i];
      }
      mFinal.uniforms.bloom.value = src.texture; mFinal.uniforms.px.value.set(1 / W, 1 / H); mFinal.uniforms.time.value = (frame++ % 64) * 0.37;
      draw(mFinal, null);
    },
  };
  return api;
}
