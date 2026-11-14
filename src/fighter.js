// A procedural samurai with human proportions: every part is a simple convex shape (so it can be cut
// cleanly), posed each frame with a long-striding run cycle, two-bone IK for arms and legs, and a sword
// driven by the swing input (s.x, s.y).
import * as THREE from 'three';
import { item, cleanLook } from './cosmetics.js?v=20261114025722';

// Every material that can end up on a sliced piece is registered here, so a piece's single mesh can use
// one shared material array and keep each triangle's look.
export const MATS = [];
export function regMat(m) { if (m.userData.mi === undefined) { m.userData.mi = MATS.length; MATS.push(m); } return m.userData.mi; }

export const CAP = {
  flesh: new THREE.MeshStandardMaterial({ color: 0xa50f1b, roughness: 0.5, emissive: 0x3a0005, side: THREE.DoubleSide }),
  steel: new THREE.MeshStandardMaterial({ color: 0xeef3f8, roughness: 0.25, metalness: 0.8, side: THREE.DoubleSide }),
  wood: new THREE.MeshStandardMaterial({ color: 0xc9a36b, roughness: 0.8, side: THREE.DoubleSide }),
};
for (const m of Object.values(CAP)) regMat(m);

export const PALETTE = [0xd63a3a, 0x2f7fe0, 0xf0c419, 0x2fae5f, 0x9b51e0, 0xf07f1f, 0x18b8a8, 0xeeeeee];
export const HORDE_COLOR = 0x2a2a2e;

const M = {
  skin: new THREE.MeshStandardMaterial({ color: 0xe0b48c, roughness: 0.7 }),
  skinShade: new THREE.MeshStandardMaterial({ color: 0xc99872, roughness: 0.75 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x24242a, roughness: 0.85 }),
  hair: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 }),
  blade: new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.18, metalness: 0.9 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.35, metalness: 0.8 }),
  grip: new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.9 }),
  eye: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }),
  oni: new THREE.MeshStandardMaterial({ color: 0x8e1717, roughness: 0.5, emissive: 0x220000 }),
  saya: new THREE.MeshStandardMaterial({ color: 0x1c1416, roughness: 0.3, metalness: 0.2 }), // lacquered scabbard
};
for (const m of Object.values(M)) regMat(m);
CAP.flesh.userData.flesh = true; M.skin.userData.flesh = true; M.skinShade.userData.flesh = true;
const clothCache = new Map();
function cloth(color, k = 1) {
  const key = color + ':' + k;
  if (!clothCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(k), roughness: 0.8 });
    regMat(m); clothCache.set(key, m);
  }
  return clothCache.get(key);
}

const GEO = {
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10, 1),
  taper: new THREE.CylinderGeometry(0.72, 1, 1, 9, 1), // narrower at the far end (limbs)
  chest: new THREE.CylinderGeometry(1, 0.74, 1, 14, 1), // wider at the top (shoulders to waist)
  sph: new THREE.SphereGeometry(1, 12, 8),
  sphLo: new THREE.SphereGeometry(1, 7, 5), // small round parts (ears, joints): fewer triangles to cut
  box: new THREE.BoxGeometry(1, 1, 1),
  skirt: new THREE.CylinderGeometry(0.17, 0.25, 0.4, 14, 1),
  cone: new THREE.ConeGeometry(1, 1, 10, 1),
};

// metal reflects a soft sky (set once from main via setMetalEnv); only metal gets it, so nothing else changes
let metalEnv = null;
const shine = (m) => { if (metalEnv && m.metalness >= 0.4) { m.envMap = metalEnv; m.envMapIntensity = 0.9; m.needsUpdate = true; } return m; };
export function setMetalEnv(tex) { metalEnv = tex; for (const m of MATS) shine(m); }
/** A soft sky (warm above, dark below, a bright sun) drawn into a reflection map for this renderer. */
export function metalEnvFor(renderer) {
  const env = new THREE.Scene(), geo = new THREE.SphereGeometry(10, 24, 12), col = [], c = new THREE.Color();
  for (let i = 0, p = geo.attributes.position; i < p.count; i++) { const y = p.getY(i) / 10; c.set(y > 0 ? 0x9fb8d0 : 0x3a332c).lerp(new THREE.Color(y > 0 ? 0xfff4e2 : 0x161210), Math.abs(y) ** 0.7); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); sun.position.set(5, 7, 3); env.add(sun);
  const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(env, 0.02).texture; pm.dispose(); geo.dispose();
  return tex;
}
// materials for cosmetics, made once per look and shared
const cosMats = new Map();
export function cosMat(d) {
  const k = JSON.stringify(d);
  if (!cosMats.has(k)) { const m = new THREE.MeshStandardMaterial({ color: d.c, metalness: d.m || 0, roughness: d.r ?? 0.6, emissive: d.e || 0, emissiveIntensity: d.ei || 0 }); regMat(m); shine(m); cosMats.set(k, m); }
  return cosMats.get(k);
}
const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4();
// stretch a unit cylinder from a to b, radius r (depth scaled by dz)
function seg(m, a, b, r, dz = 1) {
  _d.subVectors(b, a); const L = _d.length() || 1e-4;
  m.position.addVectors(a, b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, _d.divideScalar(L));
  m.scale.set(r, L, r * dz);
}
// two-bone IK: returns the elbow/knee in `out`, and pulls `t` in if it's out of reach
function ik(A, t, L1, L2, hint, out) {
  _a.subVectors(t, A); let dist = _a.length();
  const dir = _a.divideScalar(dist || 1);
  const dc = Math.min(Math.max(dist, 0.05), L1 + L2 - 0.001);
  if (dc !== dist) t.copy(A).addScaledVector(dir, dc);
  const a = (L1 * L1 - L2 * L2 + dc * dc) / (2 * dc), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  _b.copy(hint).addScaledVector(dir, -hint.dot(dir)).normalize();
  out.copy(A).addScaledVector(dir, a).addScaledVector(_b, h);
}
function boxBasis(m, x, y, pos, sx, sy, sz) {
  _c.crossVectors(x, y);
  _m.makeBasis(x, y, _c); m.quaternion.setFromRotationMatrix(_m);
  m.position.copy(pos); m.scale.set(sx, sy, sz);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _tcA = new THREE.Color(), _tcB = new THREE.Color();

export const GUARD = { x: 0.42, y: 0.38 };
export const BLADE_LEN = 1.12;
const THIGH = 0.46, SHIN = 0.46, UPPER = 0.3, FORE = 0.28;

export class Fighter {
  constructor({ id, name, color, team, isBot, horde, look }) {
    Object.assign(this, { id, name, color, team, isBot: !!isBot, horde: !!horde });
    this.look = horde ? cleanLook(null) : cleanLook(look);
    const L = { outfit: item('outfit', this.look.outfit), sword: item('sword', this.look.sword), mask: item('mask', this.look.mask), hat: item('hat', this.look.hat) };
    this.trailStyle = item('trail', this.look.trail); this.tipSpeed = 0;
    this.bladeW = L.sword.w || 1; this.bladeT = L.sword.t || 1;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.s = { x: GUARD.x, y: GUARD.y };
    this.onGround = false; this.alive = false; this.dashT = 0; this.dashCd = 0; this.dashDir = new THREE.Vector3();
    this.stam = 100; this.stamDelay = 0; this.padCd = 0; this.prot = 0; this.walk = 0; this.stagger = 0;
    this.hand = new THREE.Vector3(); this.tip = new THREE.Vector3(); this.prevHand = new THREE.Vector3(); this.prevTip = new THREE.Vector3();
    this.prevPos = new THREE.Vector3(); this.noCut = true; this.swishCd = 0;
    this.handL = new THREE.Vector3(); this.hook = null; this.anim = null; this.armed = true;
    this.bladeLen = BLADE_LEN; // grows with kills
    this.stride = 0; // eases in and out so starts and stops don't snap
    this.edge = new THREE.Vector3(1, 0, 0); this.lastD = new THREE.Vector3(0, 0, -1);
    this.group = new THREE.Group();
    this.meshes = [];
    const O = L.outfit.gi !== undefined && !horde ? L.outfit : null;
    const gi = cloth(horde ? HORDE_COLOR : O ? O.gi : color), trim = cloth(horde ? 0x8e1717 : O ? O.trim : color, O ? 1 : 0.55), pants = horde ? M.dark : cloth(O ? O.pants : 0x2c2f3a);
    const mk = (geo, mat, cap = CAP.flesh) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.userData.cap = cap; this.group.add(m); this.meshes.push(m); return m; };
    this.p = {
      // trunk
      pelvis: mk(GEO.sph, pants), skirt: mk(GEO.skirt, pants), abdomen: mk(GEO.cyl, gi), obi: mk(GEO.cyl, trim), chest: mk(GEO.chest, gi),
      collar: mk(GEO.box, trim), padL: mk(GEO.box, trim), padR: mk(GEO.box, trim), delL: mk(GEO.sphLo, gi), delR: mk(GEO.sphLo, gi),
      // head
      neck: mk(GEO.cyl, M.skinShade), head: mk(GEO.sph, M.skin), jaw: mk(GEO.sph, M.skin), nose: mk(GEO.box, M.skinShade),
      earL: mk(GEO.sphLo, M.skinShade), earR: mk(GEO.sphLo, M.skinShade), eyeL: mk(GEO.box, M.eye), eyeR: mk(GEO.box, M.eye),
      browL: mk(GEO.box, M.hair), browR: mk(GEO.box, M.hair),
      hair: mk(GEO.sph, M.hair), band: mk(GEO.cyl, horde ? M.oni : gi), knot: mk(GEO.sphLo, M.hair), mask: horde ? mk(GEO.box, M.oni) : null,
      // arms
      uaL: mk(GEO.taper, gi), elL: mk(GEO.sphLo, M.skin), faL: mk(GEO.taper, M.skin), hL: mk(GEO.box, M.skin),
      uaR: mk(GEO.taper, gi), elR: mk(GEO.sphLo, M.skin), faR: mk(GEO.taper, M.skin), hR: mk(GEO.box, M.skin),
      // legs
      thL: mk(GEO.taper, pants), knL: mk(GEO.sphLo, pants), shL: mk(GEO.taper, pants), ftL: mk(GEO.box, M.dark),
      thR: mk(GEO.taper, pants), knR: mk(GEO.sphLo, pants), shR: mk(GEO.taper, pants), ftR: mk(GEO.box, M.dark),
      // sword
      // detail: crossed lapels, the obi knot and its tails at the back, wrist guards, shin wraps, a scabbard
      lapL: mk(GEO.box, trim), lapR: mk(GEO.box, trim), obiK: mk(GEO.box, trim), tailL: mk(GEO.box, trim), tailR: mk(GEO.box, trim),
      wrL: mk(GEO.cyl, M.dark), wrR: mk(GEO.cyl, M.dark), kyL: mk(GEO.taper, horde ? M.dark : cloth(0xd2cab8)), kyR: mk(GEO.taper, horde ? M.dark : cloth(0xd2cab8)),
      saya: mk(GEO.cyl, M.saya, CAP.wood), kojiri: mk(GEO.cyl, M.gold, CAP.steel),
      grip: mk(GEO.cyl, L.sword.id === 'katana' ? M.grip : cosMat({ c: L.sword.grip, r: 0.9 }), CAP.wood), guard: mk(GEO.box, L.sword.id === 'katana' ? M.gold : cosMat({ c: L.sword.guard, m: 0.8, r: 0.35 }), CAP.steel), blade: mk(GEO.box, L.sword.id === 'katana' ? M.blade : cosMat(L.sword.blade), CAP.steel),
    };
    // mask and headwear: extra parts worn on the head; some hide what they cover
    this.acc = [];
    for (const it of [L.mask, L.hat]) {
      for (const [shape, md, p, s, r = [0, 0, 0]] of it.parts || []) this.acc.push({ m: mk(GEO[shape], cosMat(md)), p, s, r });
      for (const n of it.hide || []) { const m = this.p[n]; if (m) { this.group.remove(m); this.meshes = this.meshes.filter((x) => x !== m); } }
    }
    for (const m of this.meshes) m.userData.mi = regMat(m.material);
    // name tag
    this.label = null;
    if (name) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64;
      const g = c.getContext('2d'); g.font = 'bold 34px Inter, system-ui, sans-serif'; g.textAlign = 'center';
      g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(name, 128, 44);
      g.fillStyle = '#' + new THREE.Color(horde ? 0xff6b6b : color).getHexString(); g.fillText(name, 128, 44);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: true, transparent: true }));
      sp.scale.set(1.2, 0.3, 1); sp.position.set(0, 2.2, 0); this.group.add(sp); this.label = sp;
    }
    // sword trail (world space)
    this.trail = [];
    const N = 10;
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    const idx = []; for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    tg.setIndex(idx);
    this.trailMesh = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.trailMesh.frustumCulled = false;
    this.pose(0);
  }

  addTo(scene) { scene.add(this.group); scene.add(this.trailMesh); }
  removeFrom(scene) { scene.remove(this.group); scene.remove(this.trailMesh); }
  forward(out) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  // local blade direction from the swing input and pitch
  bladeDir(out) {
    const sx = this.s.x, sy = this.s.y, r = Math.min(1.05, Math.hypot(sx, sy)), a = r * 1.6, ph = Math.atan2(sy, sx);
    out.set(Math.sin(a) * Math.cos(ph), Math.sin(a) * Math.sin(ph), -Math.cos(a));
    const p = Math.max(-0.7, Math.min(0.7, this.pitch)), c = Math.cos(p), s = Math.sin(p), y = out.y, z = out.z;
    out.y = y * c - z * s; out.z = y * s + z * c;
    return out;
  }

  pose(dt) {
    const P = this.p, g = this.group;
    g.position.copy(this.pos); g.rotation.y = this.yaw;
    // local velocity for the run cycle
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const lvx = this.vel.x * c - this.vel.z * s, lvz = this.vel.x * s + this.vel.z * c;
    const sp = Math.hypot(lvx, lvz);
    const dash = this.dashT > 0, air = !this.onGround && !dash;
    // long, bounding strides: about 2.2 steps a second at full speed instead of quick little ones
    const want = this.onGround && sp > 0.4 ? Math.min(1, sp / 9) : 0;
    this.stride += (want - this.stride) * Math.min(1, dt * 8);
    const k = this.stride;
    if (sp > 0.4) this.walk += dt * (2.6 + sp * 0.85);
    const ph = this.walk;
    const ux = sp > 0.01 ? lvx / sp : 0, uz = sp > 0.01 ? lvz / sp : -1;

    // ---- trunk: pelvis bobs (highest mid-stride, like a running flight phase) and the body leans into the run
    const hipY = (dash ? 0.86 : air ? 0.97 : 0.99 - 0.05 * k + 0.05 * k * Math.cos(2 * ph));
    const lean = dash ? 0.45 : air ? 0.12 : 0.22 * k;
    const cl = Math.cos(lean), sl = Math.sin(lean);
    const R = (x, y, z) => V(x, y * cl + z * sl, -y * sl + z * cl); // tip the upper body forward
    const P0 = V(0, hipY, 0);
    const at = (x, y, z) => R(x, y, z).add(P0);
    const twist = -Math.sin(ph) * 0.1 * k; // shoulders counter-rotate against the hips
    const sh = (side) => at(0.2 * side * Math.cos(twist), 0.47, -0.2 * side * Math.sin(twist));
    P.pelvis.position.copy(P0); P.pelvis.scale.set(0.16, 0.1, 0.11); P.pelvis.rotation.set(0, 0, 0);
    P.skirt.position.set(0, hipY - 0.2, 0.01); P.skirt.scale.set(1, 1, 0.78);
    seg(P.abdomen, at(0, 0.0, 0), at(0, 0.2, 0), 0.135, 0.74);
    seg(P.obi, at(0, 0.04, 0), at(0, 0.12, 0), 0.148, 0.78);
    seg(P.chest, at(0, 0.17, 0), at(0, 0.47, 0), 0.15, 0.62); P.chest.rotateY(twist);
    // the gi's crossed lapels, the obi knot and its tails, and the scabbard thrust through the obi on the left
    seg(P.lapL, at(-0.088, 0.45, -0.088), at(0.03, 0.15, -0.104), 0.05, 0.22); seg(P.lapR, at(0.088, 0.45, -0.09), at(-0.012, 0.22, -0.108), 0.045, 0.22);
    P.obiK.position.copy(at(0, 0.085, 0.118)); P.obiK.scale.set(0.085, 0.06, 0.04); P.obiK.rotation.set(-lean, 0, 0);
    const sw = Math.sin(ph * 2) * 0.03 * k; // the tails swing a little as you run
    seg(P.tailL, at(-0.02, 0.07, 0.125), at(-0.05, -0.15, 0.15 + k * 0.12 + sw), 0.032, 0.3); seg(P.tailR, at(0.025, 0.07, 0.125), at(0.06, -0.11, 0.14 + k * 0.1 - sw), 0.032, 0.3);
    seg(P.saya, at(-0.17, 0.09, -0.16), at(-0.24, -0.22, 0.62), 0.024, 0.75); seg(P.kojiri, at(-0.239, -0.217, 0.6), at(-0.242, -0.226, 0.64), 0.027, 0.75);
    P.collar.position.copy(at(0, 0.45, -0.07)); P.collar.scale.set(0.12, 0.07, 0.03); P.collar.rotation.set(-lean, twist, 0);
    for (const [n, side] of [['L', -1], ['R', 1]]) {
      const S = sh(side);
      P['del' + n].position.copy(S); P['del' + n].scale.set(0.072, 0.068, 0.075);
      P['pad' + n].position.copy(S).add(V(0.035 * side, 0.03, 0)); P['pad' + n].scale.set(0.13, 0.05, 0.2); P['pad' + n].rotation.set(-lean, twist, -0.45 * side);
    }
    // ---- head
    const neckBase = at(0, 0.5, 0), headC = at(0, 0.68, -0.01);
    seg(P.neck, neckBase, at(0, 0.6, 0), 0.05);
    const hp = Math.max(-0.4, Math.min(0.4, this.pitch * 0.5)) - lean * 0.6; // look up/down a little, stay level while leaning
    const H = (x, y, z) => { const cy = Math.cos(hp), sy = Math.sin(hp); return V(x, y * cy + z * sy, -y * sy + z * cy).add(headC); };
    const headRot = (m) => m.rotation.set(hp, 0, 0);
    P.head.position.copy(headC); P.head.scale.set(0.1, 0.122, 0.112); headRot(P.head);
    P.jaw.position.copy(H(0, -0.07, -0.02)); P.jaw.scale.set(0.078, 0.058, 0.082); headRot(P.jaw);
    P.nose.position.copy(H(0, -0.01, -0.112)); P.nose.scale.set(0.024, 0.042, 0.03); headRot(P.nose);
    P.earL.position.copy(H(-0.1, 0, 0.005)); P.earR.position.copy(H(0.1, 0, 0.005));
    P.earL.scale.set(0.018, 0.034, 0.024); P.earR.scale.set(0.018, 0.034, 0.024);
    P.eyeL.position.copy(H(-0.04, 0.018, -0.1)); P.eyeR.position.copy(H(0.04, 0.018, -0.1));
    P.eyeL.scale.set(0.03, 0.014, 0.02); P.eyeR.scale.set(0.03, 0.014, 0.02); headRot(P.eyeL); headRot(P.eyeR);
    P.browL.position.copy(H(-0.042, 0.045, -0.1)); P.browR.position.copy(H(0.042, 0.045, -0.1));
    P.browL.scale.set(0.038, 0.01, 0.02); P.browR.scale.set(0.038, 0.01, 0.02); headRot(P.browL); headRot(P.browR);
    P.hair.position.copy(H(0, 0.04, 0.014)); P.hair.scale.set(0.106, 0.1, 0.118); headRot(P.hair);
    P.band.position.copy(H(0, 0.035, 0.0)); P.band.scale.set(0.104, 0.03, 0.116); headRot(P.band);
    P.knot.position.copy(H(0, 0.12, 0.07)); P.knot.scale.setScalar(0.04);
    if (P.mask) { P.mask.position.copy(H(0, -0.04, -0.095)); P.mask.scale.set(0.15, 0.08, 0.04); headRot(P.mask); }
    for (const a of this.acc) { a.m.position.copy(H(a.p[0], a.p[1], a.p[2])); a.m.scale.set(a.s[0], a.s[1], a.s[2]); a.m.rotation.set(hp + a.r[0], a.r[1], a.r[2]); }

    // ---- legs
    for (const [side, sgn, off] of [['L', -1, 0], ['R', 1, Math.PI]]) {
      const hip = V(0.095 * sgn, hipY - 0.06, 0);
      const foot = V(0.11 * sgn, 0.08, 0);
      let toe = 0;
      if (dash) { foot.set(0.12 * sgn, 0.22, sgn > 0 ? 0.42 : -0.38); toe = sgn > 0 ? 0.6 : -0.2; }
      else if (air) { foot.set(0.12 * sgn, sgn > 0 ? 0.42 : 0.3, sgn > 0 ? -0.12 : 0.22); toe = 0.3; }
      else {
        const sn = Math.sin(ph + off), cs = Math.cos(ph + off);
        const A = 0.56 * k; // half a stride: feet reach well ahead and push off well behind
        foot.x += ux * sn * A; foot.z += uz * sn * A;
        foot.y += Math.max(0, cs) * 0.4 * k + Math.max(0, -sn) * Math.max(0, cs) * 0.25 * k; // high knee forward, heel kicks up behind
        toe = -cs * 0.45 * k; // toes point down as the foot pushes off
      }
      const knee = V();
      ik(hip, foot, THIGH, SHIN, V(0, 0, -1), knee);
      seg(P['th' + side], hip, knee, 0.088); P['kn' + side].position.copy(knee); P['kn' + side].scale.setScalar(0.06);
      seg(P['sh' + side], knee, foot, 0.064);
      seg(P['ky' + side], _a.lerpVectors(knee, foot, 0.22), _b.lerpVectors(knee, foot, 0.86), 0.072); // shin wraps
      const ft = P['ft' + side];
      ft.position.set(foot.x, foot.y - 0.035 + Math.max(0, toe) * 0.05, foot.z - 0.06); ft.scale.set(0.095, 0.065, 0.25); ft.rotation.set(toe, 0, 0);
    }

    // ---- sword arm
    const d = this.bladeDir(_d.clone());
    const shR = sh(1), shL = sh(-1);
    const hand = V(0.12, 1.3, -0.1).add(R(0, 0, 0).sub(V(0, 0, 0))).addScaledVector(d, 0.44);
    hand.z += -sl * 0.35; hand.y += (hipY - 0.99) * 0.6;
    const el = V();
    ik(shR, hand, UPPER, FORE, V(0.6, -0.7, 0.3), el);
    seg(P.uaR, shR, el, 0.058); P.elR.position.copy(el); P.elR.scale.setScalar(0.046); seg(P.faR, el, hand, 0.046);
    seg(P.wrR, _a.lerpVectors(el, hand, 0.62), _b.lerpVectors(el, hand, 0.97), 0.05); // wrist guard
    seg(P.hR, hand, _a.copy(hand).addScaledVector(d, 0.06), 0.042, 0.8);
    // ---- off arm: swings opposite the legs with a bent elbow, or reaches for the grapple
    const sL = Math.sin(ph);
    const handL = V(-0.27, 1.12 + 0.06 * k + (hipY - 0.99), 0.05 + sL * 0.34 * k);
    if (dash) handL.set(-0.36, 1.05, 0.35);
    if (air && !this.hook) handL.set(-0.38, 1.35, -0.1);
    if (this.hook) { // reach for the grapple anchor
      g.updateMatrixWorld(true);
      const loc = g.worldToLocal(this.hook.p.clone()).sub(shL).normalize();
      handL.copy(shL).addScaledVector(loc, 0.56);
    }
    const elL = V();
    ik(shL, handL, UPPER, FORE, V(-0.3, -0.4, 0.6), elL);
    seg(P.uaL, shL, elL, 0.058); P.elL.position.copy(elL); P.elL.scale.setScalar(0.046); seg(P.faL, elL, handL, 0.046);
    seg(P.wrL, _a.lerpVectors(elL, handL, 0.62), _b.lerpVectors(elL, handL, 0.97), 0.05);
    seg(P.hL, handL, _a.subVectors(handL, elL).normalize().multiplyScalar(0.07).add(handL), 0.042, 0.8);

    // ---- sword: the blade edge leads in the direction of motion
    _c.subVectors(d, this.lastD); _c.addScaledVector(d, -_c.dot(d));
    if (_c.lengthSq() > 1e-5) this.edge.lerp(_c.normalize(), 0.5);
    this.edge.addScaledVector(d, -this.edge.dot(d)).normalize();
    if (!isFinite(this.edge.x) || this.edge.lengthSq() < 0.5) this.edge.set(1, 0, 0).addScaledVector(d, -d.x).normalize();
    this.lastD.copy(d);
    seg(P.grip, _a.copy(hand).addScaledVector(d, -0.12), _b.copy(hand).addScaledVector(d, 0.08), 0.022);
    boxBasis(P.guard, this.edge, d, _a.copy(hand).addScaledVector(d, 0.09), 0.13, 0.025, 0.07);
    const bl = this.bladeLen, bw = (0.05 + (bl - BLADE_LEN) * 0.012) * this.bladeW;
    boxBasis(P.blade, this.edge, d, _a.copy(hand).addScaledVector(d, 0.1 + bl / 2), bw, bl, (0.012 + (bl - BLADE_LEN) * 0.003) * this.bladeT);
    // world hand/tip for hit tests
    g.updateMatrixWorld(true);
    this.hand.copy(hand).applyMatrix4(g.matrixWorld);
    this.tip.copy(hand).addScaledVector(d, 0.1 + bl).applyMatrix4(g.matrixWorld);
    this.handL.copy(handL).applyMatrix4(g.matrixWorld);
    if (this.label) this.label.visible = this.alive;
  }

  updateTrail(now) {
    const T = this.trail;
    if (this.alive) T.push({ h: this.hand.clone().lerp(this.tip, 0.3), t: this.tip.clone(), time: now });
    while (T.length && (now - T[0].time > 0.12 || T.length > 10)) T.shift();
    const pos = this.trailMesh.geometry.attributes.position, col = this.trailMesh.geometry.attributes.color;
    const st = this.trailStyle, A = _tcA.set(st.a), B = _tcB.set(st.b), n = T.length;
    this.tipSpeed = n > 1 ? T[n - 1].t.distanceTo(T[n - 2].t) / Math.max(0.001, T[n - 1].time - T[n - 2].time) : 0;
    for (let i = 0; i < 10; i++) {
      const e = T[Math.min(i, T.length - 1)] || { h: this.tip, t: this.tip, time: now };
      pos.setXYZ(i * 2, e.h.x, e.h.y, e.h.z); pos.setXYZ(i * 2 + 1, e.t.x, e.t.y, e.t.z);
      let v = 0;
      if (i > 0 && i < T.length) { const sp = T[i].t.distanceTo(T[i - 1].t) / Math.max(0.001, T[i].time - T[i - 1].time); v = Math.min(1, Math.max(0, (sp - 6) / 14)) * (1 - (now - e.time) / 0.12) * 0.8; }
      if (st.fx === 'rainbow') { A.setHSL((now * 0.9 + i * 0.07) % 1, 1, 0.45); B.setHSL((now * 0.9 + i * 0.07) % 1, 1, 0.65); }
      else if (st.fx === 'zap') v *= 0.45 + Math.random() * 0.9; // crackles
      col.setXYZ(i * 2, v * A.r, v * A.g, v * A.b); col.setXYZ(i * 2 + 1, v * B.r, v * B.g, v * B.b);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  }
}
