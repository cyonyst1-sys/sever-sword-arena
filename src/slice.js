// Mesh slicing: bake posed meshes to world-space triangles, split them by a plane, cap each cut part,
// and turn each side into a tumbling rigid piece. Every original part is convex, so the cut face of a part
// is the convex hull of the points where the plane crossed it.
import * as THREE from 'three';
import { MATS } from './fighter.js?v=20261114034906';

let partSeq = 1;
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();

/** soup = { P: xyz per vertex, N: normals, M: material index per triangle, Q: part id per triangle, caps: part -> cap material } */
export function bakeMeshes(meshes) {
  const P = [], N = [], M = [], Q = [], caps = {};
  for (const mesh of meshes) {
    if (!mesh.visible) continue;
    const part = partSeq++; caps[part] = mesh.userData.cap.userData.mi;
    const g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, idx = g.index, mi = mesh.userData.mi;
    _nm.getNormalMatrix(mesh.matrixWorld);
    const cnt = idx ? idx.count : pos.count;
    for (let i = 0; i < cnt; i++) {
      const k = idx ? idx.getX(i) : i;
      _v.fromBufferAttribute(pos, k).applyMatrix4(mesh.matrixWorld); P.push(_v.x, _v.y, _v.z);
      _n.fromBufferAttribute(nor, k).applyMatrix3(_nm).normalize(); N.push(_n.x, _n.y, _n.z);
      if (i % 3 === 2) { M.push(mi); Q.push(part); }
    }
  }
  return { P, N, M, Q, caps };
}

function hull2(pts) { // monotone chain over {u,v}
  pts.sort((a, b) => a.u - b.u || a.v - b.v);
  const cr = (o, a, b) => (a.u - o.u) * (b.v - o.v) - (a.v - o.v) * (b.u - o.u);
  const lo = [], hi = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-12) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 1e-12) hi.pop(); hi.push(p); }
  lo.pop(); hi.pop(); return lo.concat(hi);
}

/** Split a soup by the plane n·p + d = 0. Returns [positive side, negative side, cut centre or null]. */
export function splitSoup(s, n, d) {
  const mk = () => ({ P: [], N: [], M: [], Q: [], caps: s.caps });
  const A = mk(), B = mk(), cap = new Map();
  const { P, N, M, Q } = s, EPS = 1e-6;
  const addCap = (q, x, y, z) => { let a = cap.get(q); if (!a) cap.set(q, a = []); a.push(x, y, z); };
  const fan = (S, poly, m, q) => {
    for (let i = 1; i + 1 < poly.length; i++) {
      for (const v of [poly[0], poly[i], poly[i + 1]]) { S.P.push(v[0], v[1], v[2]); S.N.push(v[3], v[4], v[5]); }
      S.M.push(m); S.Q.push(q);
    }
  };
  for (let t = 0; t < M.length; t++) {
    const o = t * 9; let pos = 0, neg = 0; const dv = [0, 0, 0];
    for (let j = 0; j < 3; j++) { const di = n.x * P[o + j * 3] + n.y * P[o + j * 3 + 1] + n.z * P[o + j * 3 + 2] + d; dv[j] = Math.abs(di) < EPS ? 0 : di; if (dv[j] > 0) pos++; else if (dv[j] < 0) neg++; }
    if (neg === 0 || pos === 0) {
      const S = neg === 0 ? A : B;
      for (let j = 0; j < 9; j++) { S.P.push(P[o + j]); S.N.push(N[o + j]); }
      S.M.push(M[t]); S.Q.push(Q[t]);
      for (let j = 0; j < 3; j++) if (dv[j] === 0) addCap(Q[t], P[o + j * 3], P[o + j * 3 + 1], P[o + j * 3 + 2]);
      continue;
    }
    const V = [0, 1, 2].map((j) => [P[o + j * 3], P[o + j * 3 + 1], P[o + j * 3 + 2], N[o + j * 3], N[o + j * 3 + 1], N[o + j * 3 + 2], dv[j]]);
    const pa = [], pb = [];
    for (let j = 0; j < 3; j++) {
      const a = V[j], b = V[(j + 1) % 3];
      if (a[6] >= 0) pa.push(a); if (a[6] <= 0) pb.push(a);
      if (a[6] === 0) addCap(Q[t], a[0], a[1], a[2]);
      if ((a[6] > 0 && b[6] < 0) || (a[6] < 0 && b[6] > 0)) {
        const k = a[6] / (a[6] - b[6]);
        const I = a.map((x, i) => x + (b[i] - x) * k);
        const l = Math.hypot(I[3], I[4], I[5]) || 1; I[3] /= l; I[4] /= l; I[5] /= l;
        pa.push(I); pb.push(I); addCap(Q[t], I[0], I[1], I[2]);
      }
    }
    fan(A, pa, M[t], Q[t]); fan(B, pb, M[t], Q[t]);
  }
  // caps
  const u = new THREE.Vector3(), w = new THREE.Vector3();
  u.crossVectors(n, Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
  w.crossVectors(n, u);
  let cx = 0, cy = 0, cz = 0, cn = 0;
  for (const [q, arr] of cap) {
    if (arr.length < 9) continue;
    const pts = [];
    for (let i = 0; i < arr.length; i += 3) pts.push({ u: arr[i] * u.x + arr[i + 1] * u.y + arr[i + 2] * u.z, v: arr[i] * w.x + arr[i + 1] * w.y + arr[i + 2] * w.z, x: arr[i], y: arr[i + 1], z: arr[i + 2] });
    const h = hull2(pts);
    if (h.length < 3) continue;
    const mi = s.caps[q];
    for (let i = 1; i + 1 < h.length; i++) {
      for (const p of [h[0], h[i], h[i + 1]]) { A.P.push(p.x, p.y, p.z); A.N.push(-n.x, -n.y, -n.z); B.P.push(p.x, p.y, p.z); B.N.push(n.x, n.y, n.z); }
      A.M.push(mi); A.Q.push(q); B.M.push(mi); B.Q.push(q);
    }
    for (const p of h) { cx += p.x; cy += p.y; cz += p.z; cn++; }
  }
  return [A, B, cn ? new THREE.Vector3(cx / cn, cy / cn, cz / cn) : null];
}

// ---------- particles (blood, sparks) ----------
export class Particles {
  constructor(scene, ground, { color, size = 0.06, max = 1600, decals = false, gravity = 20, decalColor = 0x5e0008 }) {
    this.ground = ground; this.max = max; this.g = gravity; this.n = 0; this.head = 0;
    this.p = new Float32Array(max * 3).fill(-9999); this.v = new Float32Array(max * 3); this.life = new Float32Array(max);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    this.pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, sizeAttenuation: true }));
    this.pts.frustumCulled = false; scene.add(this.pts);
    this.decals = null;
    if (decals) {
      const dg = new THREE.CircleGeometry(1, 10); dg.rotateX(-Math.PI / 2);
      this.decals = new THREE.InstancedMesh(dg, new THREE.MeshBasicMaterial({ color: decalColor, transparent: true, opacity: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 700);
      this.decals.count = 0; this.decals.frustumCulled = false; scene.add(this.decals);
      this.dHead = 0; this.dm = new THREE.Matrix4(); this.dq = new THREE.Quaternion(); this.ds = new THREE.Vector3(); this.dp = new THREE.Vector3();
    }
  }
  emit(x, y, z, vx, vy, vz, life = 2) {
    const i = this.head; this.head = (this.head + 1) % this.max;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz; this.life[i] = life;
  }
  decal(x, y, z, s) {
    if (!this.decals) return;
    this.dp.set(x, y + 0.012 + Math.random() * 0.004, z); this.dq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28);
    this.ds.set(s * (0.7 + Math.random() * 0.6), 1, s);
    this.dm.compose(this.dp, this.dq, this.ds);
    this.decals.setMatrixAt(this.dHead, this.dm); this.dHead = (this.dHead + 1) % 700;
    this.decals.count = Math.max(this.decals.count, this.dHead === 0 ? 700 : this.dHead);
    this.decals.instanceMatrix.needsUpdate = true;
  }
  update(dt) {
    const p = this.p, v = this.v;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      v[i * 3 + 1] -= this.g * dt;
      const ny = p[i * 3 + 1] + v[i * 3 + 1] * dt;
      p[i * 3] += v[i * 3] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
      if (this.decals && v[i * 3 + 1] < 0) {
        const g = this.ground(p[i * 3], p[i * 3 + 2], p[i * 3 + 1] - 0.45);
        if (ny <= g) { this.decal(p[i * 3], g, p[i * 3 + 2], 0.05 + Math.random() * 0.14); this.life[i] = 0; }
      }
      p[i * 3 + 1] = ny;
      if (this.life[i] <= 0 || ny < -80) { this.life[i] = 0; p[i * 3 + 1] = -9999; }
    }
    this.pts.geometry.attributes.position.needsUpdate = true;
  }
}

// ---------- pieces ----------
const UPV = new THREE.Vector3(0, 1, 0);
export class Pieces {
  constructor(scene, ground, blood) { this.scene = scene; this.ground = ground; this.blood = blood; this.list = []; this.max = 150; }

  make(soup) {
    const T = soup.M.length; if (T === 0) return null;
    let cx = 0, cy = 0, cz = 0; const V = soup.P.length / 3;
    for (let i = 0; i < soup.P.length; i += 3) { cx += soup.P[i]; cy += soup.P[i + 1]; cz += soup.P[i + 2]; }
    cx /= V; cy /= V; cz /= V;
    const order = [...Array(T).keys()].sort((a, b) => soup.M[a] - soup.M[b]);
    const pos = new Float32Array(T * 9), nor = new Float32Array(T * 9);
    const L = { P: [], N: [], M: [], Q: [], caps: soup.caps };
    const geo = new THREE.BufferGeometry();
    let gStart = 0, gMat = soup.M[order[0]], r = 0, flesh = false;
    order.forEach((t, k) => {
      if (soup.M[t] !== gMat) { geo.addGroup(gStart * 3, (k - gStart) * 3, gMat); gStart = k; gMat = soup.M[t]; }
      for (let j = 0; j < 3; j++) {
        const o = t * 9 + j * 3, x = soup.P[o] - cx, y = soup.P[o + 1] - cy, z = soup.P[o + 2] - cz;
        pos.set([x, y, z], k * 9 + j * 3); nor.set([soup.N[o], soup.N[o + 1], soup.N[o + 2]], k * 9 + j * 3);
        L.P.push(x, y, z); L.N.push(soup.N[o], soup.N[o + 1], soup.N[o + 2]);
        r = Math.max(r, x * x + y * y + z * z);
      }
      L.M.push(soup.M[t]); L.Q.push(soup.Q[t]);
      if (MATS[soup.M[t]] && MATS[soup.M[t]].userData.flesh) flesh = true;
    });
    geo.addGroup(gStart * 3, (T - gStart) * 3, gMat);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, MATS); mesh.castShadow = true; mesh.position.set(cx, cy, cz);
    // contact samples: support points in 14 directions
    const dirs = [];
    for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) dirs.push(new THREE.Vector3(x, y, z).normalize());
    const samples = dirs.map((dv) => { let best = -Infinity, bp = null; for (let i = 0; i < L.P.length; i += 3) { const s = L.P[i] * dv.x + L.P[i + 1] * dv.y + L.P[i + 2] * dv.z; if (s > best) { best = s; bp = i; } } return new THREE.Vector3(L.P[bp], L.P[bp + 1], L.P[bp + 2]); });
    const p = { mesh, soup: L, vel: new THREE.Vector3(), w: new THREE.Vector3(), r: Math.sqrt(r), samples, life: 45, bleed: 0, flesh, cutCd: 0.2, sleep: 0, asleep: false };
    this.scene.add(mesh); this.list.push(p);
    while (this.list.length > this.max) this.remove(this.list[0]);
    return p;
  }
  remove(p) { this.scene.remove(p.mesh); p.mesh.geometry.dispose(); const i = this.list.indexOf(p); if (i >= 0) this.list.splice(i, 1); }
  clear() { while (this.list.length) this.remove(this.list[0]); }
  worldSoup(p) {
    p.mesh.updateMatrixWorld();
    const m = p.mesh.matrixWorld, q = p.mesh.quaternion, S = p.soup, P = [], N = [];
    for (let i = 0; i < S.P.length; i += 3) {
      _v.set(S.P[i], S.P[i + 1], S.P[i + 2]).applyMatrix4(m); P.push(_v.x, _v.y, _v.z);
      _n.set(S.N[i], S.N[i + 1], S.N[i + 2]).applyQuaternion(q); N.push(_n.x, _n.y, _n.z);
    }
    return { P, N, M: S.M.slice(), Q: S.Q.slice(), caps: S.caps };
  }
  /** Split a soup and launch both halves apart along the plane normal. Returns the cut centre (or null). */
  split(soup, n, d, baseVel, impulse, spin = 1, burst = this.blood) { // burst: what sprays from the cut (blood, or a kill effect's particles; null for none)
    const [A, B, c] = splitSoup(soup, n, d);
    if (!A.M.length || !B.M.length) return null;
    const out = [];
    for (const [S, sg] of [[A, 1], [B, -1]]) {
      const p = this.make(S); if (!p) continue;
      p.vel.copy(baseVel).multiplyScalar(0.6).addScaledVector(n, sg * 1.8).addScaledVector(impulse, 0.3 + Math.random() * 0.2);
      p.vel.y += 1.0 + Math.random();
      p.w.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(4 * spin).addScaledVector(n, sg * 2);
      p.bleed = p.flesh ? 2.2 : 0;
      out.push(p);
    }
    this.last = out;
    if (c && burst) {
      const fl = out.some((p) => p.flesh);
      if (fl) for (let i = 0; i < 70; i++) {
        const sg = Math.random() < 0.5 ? 1 : -1, sp = 1 + Math.random() * 4.5;
        burst.emit(c.x + (Math.random() - 0.5) * 0.3, c.y + (Math.random() - 0.5) * 0.3, c.z + (Math.random() - 0.5) * 0.3,
          n.x * sg * sp + impulse.x * 0.15 + (Math.random() - 0.5) * 2, n.y * sg * sp + 1.5 + Math.random() * 2, n.z * sg * sp + impulse.z * 0.15 + (Math.random() - 0.5) * 2, 3);
      }
    }
    return c || out[0]?.mesh.position.clone() || null;
  }

  update(dt) {
    const tmp = new THREE.Vector3(), r = new THREE.Vector3(), vc = new THREE.Vector3(), q = new THREE.Quaternion();
    for (const p of [...this.list]) {
      p.life -= dt; p.cutCd -= dt;
      const m = p.mesh;
      if (p.tick) p.tick(p, dt); // a kill effect at work on this piece
      if (p.life < 1) m.scale.setScalar(Math.max(0.01, p.life));
      if (p.life <= 0 || m.position.y < -80) { this.remove(p); continue; }
      const bs = p.bleedSys || this.blood; // what it leaks: blood, or petals, ink...
      if (p.bleed > 0 && bs) {
        p.bleed -= dt;
        if (Math.random() < dt * 25 * Math.min(1, p.bleed)) bs.emit(m.position.x, m.position.y, m.position.z, (Math.random() - 0.5) * 1.5 + p.vel.x * 0.3, 0.5 + Math.random(), (Math.random() - 0.5) * 1.5 + p.vel.z * 0.3, 2);
      }
      if (p.asleep) continue;
      p.onFloor = false;
      p.vel.y -= 24 * dt;
      m.position.addScaledVector(p.vel, dt);
      const wl = p.w.length();
      if (wl > 1e-5) { q.setFromAxisAngle(tmp.copy(p.w).divideScalar(wl), wl * dt); m.quaternion.premultiply(q); }
      // clearly in mid-air (nothing under it within its own size)? then no contact this frame: one ground check, not fourteen
      if (m.position.y - p.r - Math.max(0, -p.vel.y * dt) - 0.3 > this.ground(m.position.x, m.position.z, m.position.y + p.r, p.r + 0.2)) continue;
      // deepest contact
      let pen = 0, cp = null;
      const tol = Math.max(0.1, -p.vel.y * dt + 0.08);
      for (const s of p.samples) {
        tmp.copy(s).applyQuaternion(m.quaternion).add(m.position);
        const g = this.ground(tmp.x, tmp.z, tmp.y - 0.5 + tol);
        if (g - tmp.y > pen) { pen = g - tmp.y; cp = tmp.clone(); }
      }
      if (cp) {
        p.onFloor = true;
        m.position.y += pen;
        r.subVectors(cp, m.position);
        vc.crossVectors(p.w, r).add(p.vel);
        const I = 0.4 * Math.max(0.01, p.r * p.r);
        if (vc.y < 0) {
          const rxu = tmp.crossVectors(r, UPV).lengthSq();
          const j = -(1.25) * vc.y / (1 + rxu / I);
          p.vel.y += j;
          p.w.add(tmp.crossVectors(r, UPV).multiplyScalar(j / I));
        }
        const f = Math.min(1, 7 * dt); p.vel.x *= 1 - f; p.vel.z *= 1 - f; p.w.multiplyScalar(1 - Math.min(1, 6 * dt));
        // nearly still: settle for good (stops pieces rocking in place forever)
        if (p.vel.lengthSq() < 0.09 && p.w.lengthSq() < 0.36) { p.sleep += dt; if (p.sleep > 0.5) { p.asleep = true; p.vel.set(0, 0, 0); p.w.set(0, 0, 0); } } else p.sleep = 0;
      }
    }
    this.spread(dt);
  }

  // Pieces lying on the floor push each other apart and slide off to rest separately, instead of
  // piling into and through each other.
  spread(dt) {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i]; if (!(a.onFloor || a.asleep)) continue;
      const pa = a.mesh.position, ra = a.r * 0.55;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j]; if (!(b.onFloor || b.asleep)) continue;
        const pb = b.mesh.position, rb = b.r * 0.55;
        if (Math.abs(pa.y - pb.y) > ra + rb) continue;
        let dx = pb.x - pa.x, dz = pb.z - pa.z; const min = ra + rb, d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-3) { const ang = (i * 7 + j * 13) % 6.283; dx = Math.cos(ang); dz = Math.sin(ang); d = 1; } else { dx /= d; dz /= d; d = Math.sqrt(d2); }
        const over = min - d, push = Math.min(4, over * 6); // a gentle shove that fades as they part
        const wa = b.r * b.r / (a.r * a.r + b.r * b.r), wb = 1 - wa; // smaller pieces move more
        a.vel.x -= dx * push * wa; a.vel.z -= dz * push * wa;
        b.vel.x += dx * push * wb; b.vel.z += dz * push * wb;
        if (over > 0.03) { a.asleep = b.asleep = false; a.sleep = b.sleep = 0; }
      }
    }
  }
}
