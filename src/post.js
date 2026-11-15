// Post-processing (high quality only): the scene is drawn into an HDR, multisampled buffer, the bright parts are bloomed
// (a small chain of down- and up-samples), then everything is colour-graded, vignetted and
// dithered on its way to the screen. No three.js addons: a handful of full-screen passes.
import * as THREE from 'three';

const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const pass = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });

const DOWN = `varying vec2 vUv; uniform sampler2D t; uniform vec2 px; uniform float knee;
void main() { // 4 bilinear taps (a 4x4 box); on the first step, keep only what is brighter than the knee
  vec3 c = (texture2D(t, vUv + px * vec2(-1., -1.)).rgb + texture2D(t, vUv + px * vec2(1., -1.)).rgb + texture2D(t, vUv + px * vec2(-1., 1.)).rgb + texture2D(t, vUv + px * vec2(1., 1.)).rgb) * 0.25;
  if (knee > 0.0) { c = pow(c, vec3(2.2)); float l = max(c.r, max(c.g, c.b)); c *= smoothstep(knee * 0.8, knee * 1.5, l); c = min(c, vec3(12.0)); }
  gl_FragColor = vec4(c, 1.0); }`;
const UP = `varying vec2 vUv; uniform sampler2D t, add; uniform vec2 px;
void main() { // a 3x3 tent of the smaller level, added to this one
  vec3 c = texture2D(t, vUv).rgb * 4.0;
  c += (texture2D(t, vUv + px * vec2(-1., 0.)).rgb + texture2D(t, vUv + px * vec2(1., 0.)).rgb + texture2D(t, vUv + px * vec2(0., -1.)).rgb + texture2D(t, vUv + px * vec2(0., 1.)).rgb) * 2.0;
  c += texture2D(t, vUv + px * vec2(-1., -1.)).rgb + texture2D(t, vUv + px * vec2(1., -1.)).rgb + texture2D(t, vUv + px * vec2(-1., 1.)).rgb + texture2D(t, vUv + px * vec2(1., 1.)).rgb;
  gl_FragColor = vec4(c / 16.0 + texture2D(add, vUv).rgb, 1.0); }`;
const FINAL = `varying vec2 vUv; uniform sampler2D t, bloom; uniform float strength, time; uniform vec2 px;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
void main() {
  vec3 c = texture2D(t, vUv).rgb;
  // a touch of sharpening (unsharp mask against the 4 neighbours)
  vec3 n = (texture2D(t, vUv + vec2(px.x, 0.)).rgb + texture2D(t, vUv - vec2(px.x, 0.)).rgb + texture2D(t, vUv + vec2(0., px.y)).rgb + texture2D(t, vUv - vec2(0., px.y)).rgb) * 0.25;
  c = max(c + (c - n) * 0.35, 0.0);
  vec3 b = texture2D(bloom, vUv).rgb;
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
  main.isXRRenderTarget = true; main.texture.colorSpace = THREE.SRGBColorSpace; main.texture.internalFormat = 'RGBA8'; // (plain RGBA8 for both the texture and its multisample buffer)
  const down = [], up = [];
  for (let i = 0; i < LEVELS; i++) { down.push(new THREE.WebGLRenderTarget(4, 4, opt)); if (i < LEVELS - 1) up.push(new THREE.WebGLRenderTarget(4, 4, opt)); }
  const mDown = pass(DOWN, { t: { value: null }, px: { value: new THREE.Vector2() }, knee: { value: 0 } });
  const mUp = pass(UP, { t: { value: null }, add: { value: null }, px: { value: new THREE.Vector2() } });
  const mFinal = pass(FINAL, { t: { value: main.texture }, bloom: { value: null }, strength: { value: 0.7 }, time: { value: 0 }, px: { value: new THREE.Vector2() } });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mDown); quad.frustumCulled = false;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), size = new THREE.Vector2();
  let W = 0, H = 0, frame = 0;
  const draw = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quad, cam); };
  return {
    render(scene, camera) {
      renderer.getDrawingBufferSize(size);
      if (size.x !== W || size.y !== H) {
        W = size.x; H = size.y; main.setSize(W, H);
        for (let i = 0; i < LEVELS; i++) { const w = Math.max(2, W >> (i + 1)), h = Math.max(2, H >> (i + 1)); down[i].setSize(w, h); if (up[i]) up[i].setSize(w, h); }
      }
      renderer.setRenderTarget(main); renderer.render(scene, camera);
      let src = main;
      for (let i = 0; i < LEVELS; i++) { // bright parts, smaller and smaller
        mDown.uniforms.t.value = src.texture; mDown.uniforms.px.value.set(0.5 / src.width, 0.5 / src.height).multiplyScalar(i ? 2 : 1); mDown.uniforms.knee.value = i ? 0 : 0.68;
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
}
