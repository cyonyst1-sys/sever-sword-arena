// The fighter's body as one smooth skinned mesh: torso, neck, arms and legs in a single piece that bends at the waist,
// neck, shoulders, elbows, hips and knees. It's built once per fighter around their joints in a standing pose, and
// every frame its bones follow the joints the pose works out (so all the existing animation drives it unchanged).
// Head, hands, feet, clothing and the sword stay separate parts.
import * as THREE from 'three';

const _q = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), FRONT = new THREE.Vector3(0, 0, -1);
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
// a smooth profile through [u, value] keys
const prof = (keys) => (u) => { for (let i = 1; i < keys.length; i++) if (u <= keys[i][0]) { const [u0, v0] = keys[i - 1], [u1, v1] = keys[i]; return lerp(v0, v1, ss(0, 1, (u - u0) / (u1 - u0))); } return keys[keys.length - 1][1]; };

// bones: [name, from joint, to joint]
const BONES = [
  ['hips', 'pelvis', 'waist'], ['spine', 'waist', 'neckBase'], ['neck', 'neckBase', 'headBase'],
  ['uaR', 'shR', 'elR'], ['faR', 'elR', 'handR'], ['uaL', 'shL', 'elL'], ['faL', 'elL', 'handL'],
  ['thR', 'hipR', 'kneeR'], ['shnR', 'kneeR', 'footR'], ['thL', 'hipL', 'kneeL'], ['shnL', 'kneeL', 'footL'],
];
const BI = Object.fromEntries(BONES.map(([n], i) => [n, i]));

/** Build the body for fighter f (posed standing, with f.J filled in). mats: [cloth top, skin, cloth legs, neck skin]. */
export function buildBody(f, mats) {
  const J = f.J, P = [], UV = [], SI = [], SW = [], groups = [[], [], [], []];
  const ring = (c, ax, ay, rx, ry, n, v, bones, front) => { // one ring of n vertices round centre c, in the plane of ax, ay
    const start = P.length / 3;
    for (let k = 0; k <= n; k++) {
      const a = k / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      let ry2 = ry; if (front && sa < 0) ry2 = ry * (1 + front(ca)); // (the chest stands out at the front)
      P.push(c.x + ax.x * ca * rx + ay.x * sa * ry2, c.y + ax.y * ca * rx + ay.y * sa * ry2, c.z + ax.z * ca * rx + ay.z * sa * ry2);
      UV.push(k / n * 2, v);
      SI.push(bones[0][0], bones[1] ? bones[1][0] : 0, 0, 0); SW.push(bones[0][1], bones[1] ? bones[1][1] : 0, 0, 0);
    }
    return start;
  };
  const stitch = (r0, r1, n, mat) => { for (let k = 0; k < n; k++) groups[mat].push(r0 + k, r0 + k + 1, r1 + k, r0 + k + 1, r1 + k + 1, r1 + k); }; // (wound to face outward)
  const cap = (r, n, c, bones, mat, flip) => { const ci = P.length / 3; P.push(c.x, c.y, c.z); UV.push(0.5, 0); SI.push(bones[0][0], 0, 0, 0); SW.push(1, 0, 0, 0); for (let k = 0; k < n; k++) flip ? groups[mat].push(ci, r + k, r + k + 1) : groups[mat].push(ci, r + k + 1, r + k); };
  // a limb: a tube through points pts (bone index for each span), radius r(u) over its whole length, smooth weights over the joints
  const limb = (pts, spanBones, r, matOf, n = 14) => {
    const L = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const l = pts[i].distanceTo(pts[i - 1]); L.push(l); tot += l; }
    let side = new THREE.Vector3().crossVectors(_a.subVectors(pts[1], pts[0]).normalize(), FRONT); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
    let prevRing = -1, prevMat = 0, run = 0; const T = new THREE.Vector3(), ax = side.clone(), ay = new THREE.Vector3();
    for (let i = 0; i < pts.length - 1; i++) {
      const steps = Math.max(3, Math.round(L[i] / 0.045));
      for (let s = i === 0 ? 0 : 1; s <= steps; s++) {
        const u = s / steps, c = _b.lerpVectors(pts[i], pts[i + 1], u).clone(), gu = (run + u * L[i]) / tot;
        T.subVectors(pts[i + 1], pts[i]).normalize();
        if (u > 0.85 && i < pts.length - 2) T.lerp(_a.subVectors(pts[i + 2], pts[i + 1]).normalize(), (u - 0.85) / 0.3).normalize(); // (round the joint)
        if (u < 0.15 && i > 0) T.lerp(_a.subVectors(pts[i], pts[i - 1]).normalize(), (0.15 - u) / 0.3).normalize();
        ax.addScaledVector(T, -ax.dot(T)).normalize(); ay.crossVectors(T, ax).normalize(); // (carried along the limb without twisting)
        const b = spanBones[i], bones = [[b, 1]];
        if (u > 0.62 && i < pts.length - 2) { const w = 0.5 * ss(0.62, 1, u); bones[0][1] = 1 - w; bones.push([spanBones[i + 1], w]); }
        if (u < 0.38 && i > 0) { const w = 0.5 * (1 - ss(0, 0.38, u)); bones[0][1] = 1 - w; bones.push([spanBones[i - 1], w]); }
        const rad = r(gu), m = matOf(i, u), ri = ring(c, ax, ay, rad, rad, n, gu * tot * 6, bones);
        if (prevRing >= 0) stitch(prevRing, ri, n, m); else cap(ri, n, c, bones, m, false);
        prevRing = ri; prevMat = m;
      }
      run += L[i];
    }
    cap(prevRing, n, pts[pts.length - 1], [[spanBones[spanBones.length - 1], 1]], prevMat, true);
  };

  // ---- the torso and neck: rings up the body, wide at the hips, in at the waist, out to a broad chest and shoulders,
  // rounding over into the neck. Front is -z.
  const base = J.pelvis, top = J.headBase, H = top.y - base.y + 0.1;
  const W = prof([[0, 0.06], [0.06, 0.14], [0.16, 0.158], [0.3, 0.14], [0.45, 0.16], [0.62, 0.185], [0.76, 0.19], [0.83, 0.12], [0.86, 0.058], [1, 0.05]]);
  const D = prof([[0, 0.05], [0.06, 0.1], [0.16, 0.11], [0.3, 0.095], [0.45, 0.105], [0.62, 0.11], [0.76, 0.1], [0.83, 0.075], [0.86, 0.056], [1, 0.05]]);
  const chest = (t) => (x) => 0.32 * Math.exp(-(((t - 0.6) / 0.11) ** 2)) * (1 - 0.5 * Math.exp(-((x / 0.3) ** 2))); // pecs, a dip at the breastbone
  const N = 24, AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 0, -1);
  let prev = -1; const yb = base.y - 0.1;
  for (let s = 0; s <= 30; s++) {
    const t = s / 30, y = yb + t * H, c = new THREE.Vector3(0, y, lerp(0, 0.005, t));
    const hy = (y - base.y) / (J.waist.y - base.y), sy = (y - J.waist.y) / (J.neckBase.y - J.waist.y);
    const bones = y < J.waist.y ? (hy > 0.6 ? [[BI.hips, 1 - 0.5 * ss(0.6, 1, hy)], [BI.spine, 0.5 * ss(0.6, 1, hy)]] : [[BI.hips, 1]])
      : y < J.neckBase.y - 0.02 ? (sy < 0.2 ? [[BI.spine, 0.5 + 0.5 * ss(0, 0.2, sy)], [BI.hips, 0.5 - 0.5 * ss(0, 0.2, sy)]] : [[BI.spine, 1]])
      : [[BI.neck, ss(J.neckBase.y - 0.02, J.neckBase.y + 0.05, y)], [BI.spine, 1 - ss(J.neckBase.y - 0.02, J.neckBase.y + 0.05, y)]];
    const mat = t < 0.2 ? 2 : t < 0.84 ? 0 : 3;
    const ri = ring(c, AX, AY, W(t), D(t), N, t * 3, bones, chest(t));
    if (prev >= 0) stitch(prev, ri, N, mat); else cap(ri, N, c, bones, mat, false);
    prev = ri;
  }
  cap(prev, N, new THREE.Vector3(0, yb + H + 0.02, 0), [[BI.neck, 1]], 3, true);

  // ---- arms: from inside the shoulder, a rounded deltoid, the biceps, a slim elbow, a full forearm, a slim wrist
  for (const [s, sg] of [['R', 1], ['L', -1]]) {
    const sh = J['sh' + s], el = J['el' + s], hd = J['hand' + s], inner = sh.clone().add(new THREE.Vector3(-0.07 * sg, -0.02, 0));
    const lu = inner.distanceTo(sh), l1 = sh.distanceTo(el), l2 = el.distanceTo(hd), tot = lu + l1 + l2, e0 = (lu + l1) / tot, s0 = lu / tot;
    const r = prof([[0, 0.07], [s0, 0.083], [s0 + 0.1, 0.07], [s0 + (e0 - s0) * 0.5, 0.068], [e0 - 0.04, 0.05], [e0, 0.047], [e0 + 0.08, 0.058], [e0 + 0.2, 0.054], [0.97, 0.036], [1, 0.034]]);
    limb([inner, sh, el, hd], [BI['ua' + s], BI['ua' + s], BI['fa' + s]], r, (i, u) => (i < 2 ? 0 : u < 0.1 ? 0 : 1));
  }
  // ---- legs: from inside the hip, a full thigh, a slim knee, a high calf, a slim ankle
  for (const s of ['R', 'L']) {
    const hp = J['hip' + s], kn = J['knee' + s], ft = J['foot' + s], inner = hp.clone().add(new THREE.Vector3(0, 0.08, 0)), ank = ft.clone().add(new THREE.Vector3(0, 0.05, 0));
    const lu = inner.distanceTo(hp), l1 = hp.distanceTo(kn), l2 = kn.distanceTo(ank), tot = lu + l1 + l2, k0 = (lu + l1) / tot, h0 = lu / tot;
    const r = prof([[0, 0.09], [h0, 0.1], [h0 + 0.12, 0.098], [k0 - 0.05, 0.068], [k0, 0.064], [k0 + 0.1, 0.072], [k0 + 0.2, 0.074], [0.92, 0.045], [1, 0.042]]);
    limb([inner, hp, kn, ank], [BI['th' + s], BI['th' + s], BI['shn' + s]], r, () => 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  const idx = []; groups.forEach((g, m) => { if (g.length) { geo.addGroup(idx.length, g.length, m); idx.push(...g); } });
  geo.setIndex(idx); geo.computeVertexNormals();
  // bones: each sits at its start joint, unrotated, in this standing pose
  const bones = BONES.map(([n, a]) => { const b = new THREE.Bone(); b.name = n; b.position.copy(J[a]); return b; });
  const mesh = new THREE.SkinnedMesh(geo, mats);
  for (const b of bones) mesh.add(b);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.frustumCulled = false; mesh.castShadow = true;
  mesh.userData.bind = BONES.map(([, a, z]) => _a.subVectors(J[z], J[a]).normalize().clone());
  return mesh;
}

/** Move fighter f's body bones to where its joints are this frame. */
export function poseBody(f) {
  const m = f.body, J = f.J, bones = m.skeleton.bones, bind = m.userData.bind;
  for (let i = 0; i < BONES.length; i++) {
    const [, a, z] = BONES[i], b = bones[i];
    b.position.copy(J[a]);
    b.quaternion.setFromUnitVectors(bind[i], _a.subVectors(J[z], J[a]).normalize());
  }
}
