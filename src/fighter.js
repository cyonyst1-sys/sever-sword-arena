// A procedural samurai: every part is a simple convex shape (so it can be cut cleanly), posed each frame
// with a walk cycle, two-bone IK for arms and legs, and a sword driven by the swing input (s.x, s.y).
import * as THREE from 'three';

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
  dark: new THREE.MeshStandardMaterial({ color: 0x24242a, roughness: 0.85 }),
  hair: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 }),
  blade: new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.18, metalness: 0.9 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.35, metalness: 0.8 }),
  grip: new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.9 }),
  eye: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }),
  oni: new THREE.MeshStandardMaterial({ color: 0x8e1717, roughness: 0.5, emissive: 0x220000 }),
};
for (const m of Object.values(M)) regMat(m);
CAP.flesh.userData.flesh = true; M.skin.userData.flesh = true;
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
  sph: new THREE.SphereGeometry(1, 12, 9),
  box: new THREE.BoxGeometry(1, 1, 1),
  skirt: new THREE.CylinderGeometry(0.21, 0.29, 0.42, 12, 1),
};

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4();
function seg(m, a, b, r) {
  _d.subVectors(b, a); const L = _d.length() || 1e-4;
  m.position.addVectors(a, b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, _d.divideScalar(L));
  m.scale.set(r, L, r);
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

export const GUARD = { x: 0.42, y: 0.38 };
export const BLADE_LEN = 1.12;

export class Fighter {
  constructor({ id, name, color, team, isBot, horde }) {
    Object.assign(this, { id, name, color, team, isBot: !!isBot, horde: !!horde });
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.s = { x: GUARD.x, y: GUARD.y };
    this.onGround = false; this.alive = false; this.dashT = 0; this.dashCd = 0; this.dashDir = new THREE.Vector3();
    this.stam = 100; this.stamDelay = 0; this.padCd = 0; this.prot = 0; this.walk = 0; this.stagger = 0;
    this.hand = new THREE.Vector3(); this.tip = new THREE.Vector3(); this.prevHand = new THREE.Vector3(); this.prevTip = new THREE.Vector3();
    this.prevPos = new THREE.Vector3(); this.noCut = true; this.swishCd = 0;
    this.handL = new THREE.Vector3(); this.hook = null; this.anim = null; this.armed = true;
    this.edge = new THREE.Vector3(1, 0, 0); this.lastD = new THREE.Vector3(0, 0, -1);
    this.group = new THREE.Group();
    this.meshes = [];
    const tunic = cloth(horde ? HORDE_COLOR : color), trim = cloth(horde ? 0x8e1717 : color, 0.55), pants = horde ? M.dark : cloth(0x2c2f3a);
    const mk = (geo, mat, cap = CAP.flesh) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.userData.cap = cap; this.group.add(m); this.meshes.push(m); return m; };
    this.p = {
      skirt: mk(GEO.skirt, pants), hips: mk(GEO.box, pants), torso: mk(GEO.box, tunic), belt: mk(GEO.box, trim),
      padL: mk(GEO.box, trim), padR: mk(GEO.box, trim),
      head: mk(GEO.sph, M.skin), hair: mk(GEO.sph, M.hair), band: mk(GEO.cyl, horde ? M.oni : tunic), knot: mk(GEO.sph, M.hair),
      eyeL: mk(GEO.box, M.eye), eyeR: mk(GEO.box, M.eye), mask: horde ? mk(GEO.box, M.oni) : null,
      uaL: mk(GEO.cyl, tunic), faL: mk(GEO.cyl, M.skin), hL: mk(GEO.sph, M.skin),
      uaR: mk(GEO.cyl, tunic), faR: mk(GEO.cyl, M.skin), hR: mk(GEO.sph, M.skin),
      thL: mk(GEO.cyl, pants), shL: mk(GEO.cyl, pants), ftL: mk(GEO.box, M.dark),
      thR: mk(GEO.cyl, pants), shR: mk(GEO.cyl, pants), ftR: mk(GEO.box, M.dark),
      grip: mk(GEO.cyl, M.grip, CAP.wood), guard: mk(GEO.box, M.gold, CAP.steel), blade: mk(GEO.box, M.blade, CAP.steel),
    };
    for (const m of this.meshes) m.userData.mi = regMat(m.material);
    // static parts
    const P = this.p;
    P.hips.position.set(0, 0.97, 0); P.hips.scale.set(0.34, 0.2, 0.22);
    P.skirt.position.set(0, 0.78, 0);
    P.torso.position.set(0, 1.25, 0); P.torso.scale.set(0.42, 0.5, 0.24);
    P.belt.position.set(0, 1.03, 0); P.belt.scale.set(0.44, 0.08, 0.26);
    P.padL.position.set(-0.28, 1.47, 0); P.padL.scale.set(0.16, 0.06, 0.24); P.padL.rotation.z = 0.35;
    P.padR.position.set(0.28, 1.47, 0); P.padR.scale.set(0.16, 0.06, 0.24); P.padR.rotation.z = -0.35;
    P.head.position.set(0, 1.67, 0); P.head.scale.setScalar(0.14);
    P.hair.position.set(0, 1.72, 0.015); P.hair.scale.set(0.148, 0.11, 0.15);
    P.band.position.set(0, 1.705, 0); P.band.scale.set(0.147, 0.045, 0.147);
    P.knot.position.set(0, 1.8, 0.09); P.knot.scale.setScalar(0.05);
    P.eyeL.position.set(-0.05, 1.68, -0.128); P.eyeL.scale.set(0.035, 0.018, 0.02);
    P.eyeR.position.set(0.05, 1.68, -0.128); P.eyeR.scale.set(0.035, 0.018, 0.02);
    if (P.mask) { P.mask.position.set(0, 1.62, -0.12); P.mask.scale.set(0.2, 0.09, 0.05); }
    // name tag
    this.label = null;
    if (name) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64;
      const g = c.getContext('2d'); g.font = 'bold 34px Inter, system-ui, sans-serif'; g.textAlign = 'center';
      g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(name, 128, 44);
      g.fillStyle = '#' + new THREE.Color(horde ? 0xff6b6b : color).getHexString(); g.fillText(name, 128, 44);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: true, transparent: true }));
      sp.scale.set(1.2, 0.3, 1); sp.position.set(0, 2.15, 0); this.group.add(sp); this.label = sp;
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
    // local velocity for the walk cycle
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const lvx = this.vel.x * c - this.vel.z * s, lvz = this.vel.x * s + this.vel.z * c;
    const sp = Math.hypot(lvx, lvz);
    const k = Math.min(1, sp / 6);
    this.walk += dt * (2.5 + sp * 1.6) * (sp > 0.3 ? 1 : 0);
    const ph = this.walk, dash = this.dashT > 0;
    const bob = this.onGround ? Math.abs(Math.sin(ph)) * 0.04 * k : 0;
    const hipY = 0.97 - bob - (dash ? 0.12 : 0);
    P.hips.position.y = hipY; P.skirt.position.y = hipY - 0.19; P.belt.position.y = hipY + 0.06;
    const lean = dash ? 0.35 : k * 0.08;
    // legs
    const ux = sp > 0.01 ? lvx / sp : 0, uz = sp > 0.01 ? lvz / sp : -1;
    for (const [side, sgn, off] of [['L', -1, 0], ['R', 1, Math.PI]]) {
      const hip = new THREE.Vector3(0.11 * sgn, hipY - 0.04, 0);
      const foot = new THREE.Vector3(0.12 * sgn, 0.08, 0);
      if (!this.onGround && !dash) { foot.set(0.13 * sgn, 0.38 + (sgn > 0 ? 0.1 : 0), -0.08); }
      else if (dash) { foot.set(0.12 * sgn, 0.25, sgn > 0 ? 0.35 : -0.3); }
      else {
        const sw = Math.sin(ph + off) * 0.34 * k;
        foot.x += ux * sw; foot.z += uz * sw;
        foot.y += Math.max(0, Math.cos(ph + off)) * 0.16 * k;
      }
      const knee = new THREE.Vector3();
      ik(hip, foot, 0.44, 0.44, new THREE.Vector3(0, 0, -1), knee);
      seg(P['th' + side], hip, knee, 0.075); seg(P['sh' + side], knee, foot, 0.06);
      P['ft' + side].position.set(foot.x, foot.y - 0.03, foot.z - 0.05); P['ft' + side].scale.set(0.1, 0.07, 0.24); P['ft' + side].rotation.set(0, 0, 0);
    }
    // torso and head lean
    P.torso.rotation.x = -lean; P.torso.position.z = -lean * 0.12;
    const tz = -lean * 0.3;
    for (const n of ['head', 'hair', 'band', 'knot', 'eyeL', 'eyeR', 'mask']) if (P[n]) P[n].position.z = (P[n].userData.z0 ??= P[n].position.z) + tz;
    for (const n of ['padL', 'padR']) P[n].position.z = tz * 0.6;
    // sword arm
    const d = this.bladeDir(_d.clone());
    const shR = new THREE.Vector3(0.25, 1.44, tz * 0.6), shL = new THREE.Vector3(-0.25, 1.44, tz * 0.6);
    const hand = new THREE.Vector3(0.12, 1.3, -0.1 + tz).addScaledVector(d, 0.44);
    const el = new THREE.Vector3();
    ik(shR, hand, 0.29, 0.29, new THREE.Vector3(0.6, -0.7, 0.3), el);
    seg(P.uaR, shR, el, 0.06); seg(P.faR, el, hand, 0.05); P.hR.position.copy(hand); P.hR.scale.setScalar(0.055);
    // off arm swings
    const handL = new THREE.Vector3(-0.3, 0.98, -Math.sin(ph) * 0.22 * k);
    if (dash) handL.set(-0.35, 1.05, 0.3);
    if (this.hook) { // reach for the grapple anchor
      g.updateMatrixWorld(true);
      const loc = g.worldToLocal(this.hook.p.clone()).sub(shL).normalize();
      handL.copy(shL).addScaledVector(loc, 0.56);
    }
    const elL = new THREE.Vector3();
    ik(shL, handL, 0.29, 0.29, new THREE.Vector3(-0.4, -0.3, 0.5), elL);
    seg(P.uaL, shL, elL, 0.06); seg(P.faL, elL, handL, 0.05); P.hL.position.copy(handL); P.hL.scale.setScalar(0.055);
    // blade edge leads in the direction of motion
    _c.subVectors(d, this.lastD); _c.addScaledVector(d, -_c.dot(d));
    if (_c.lengthSq() > 1e-5) this.edge.lerp(_c.normalize(), 0.5);
    this.edge.addScaledVector(d, -this.edge.dot(d)).normalize();
    if (!isFinite(this.edge.x) || this.edge.lengthSq() < 0.5) this.edge.set(1, 0, 0).addScaledVector(d, -d.x).normalize();
    this.lastD.copy(d);
    seg(P.grip, _a.copy(hand).addScaledVector(d, -0.12), _b.copy(hand).addScaledVector(d, 0.08), 0.022);
    boxBasis(P.guard, this.edge, d, _a.copy(hand).addScaledVector(d, 0.09), 0.13, 0.025, 0.07);
    boxBasis(P.blade, this.edge, d, _a.copy(hand).addScaledVector(d, 0.1 + BLADE_LEN / 2), 0.05, BLADE_LEN, 0.012);
    // world hand/tip for hit tests
    g.updateMatrixWorld(true);
    this.hand.copy(hand).applyMatrix4(g.matrixWorld);
    this.tip.copy(hand).addScaledVector(d, 0.1 + BLADE_LEN).applyMatrix4(g.matrixWorld);
    this.handL.copy(handL).applyMatrix4(g.matrixWorld);
    if (this.label) this.label.visible = this.alive;
  }

  updateTrail(now) {
    const T = this.trail;
    if (this.alive) T.push({ h: this.hand.clone().lerp(this.tip, 0.3), t: this.tip.clone(), time: now });
    while (T.length && (now - T[0].time > 0.12 || T.length > 10)) T.shift();
    const pos = this.trailMesh.geometry.attributes.position, col = this.trailMesh.geometry.attributes.color;
    for (let i = 0; i < 10; i++) {
      const e = T[Math.min(i, T.length - 1)] || { h: this.tip, t: this.tip, time: now };
      pos.setXYZ(i * 2, e.h.x, e.h.y, e.h.z); pos.setXYZ(i * 2 + 1, e.t.x, e.t.y, e.t.z);
      let v = 0;
      if (i > 0 && i < T.length) { const sp = T[i].t.distanceTo(T[i - 1].t) / Math.max(0.001, T[i].time - T[i - 1].time); v = Math.min(1, Math.max(0, (sp - 6) / 14)) * (1 - (now - e.time) / 0.12) * 0.8; }
      col.setXYZ(i * 2, v * 0.6, v * 0.65, v * 0.7); col.setXYZ(i * 2 + 1, v, v, v);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  }
}
