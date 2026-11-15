// Comet Run: a cluster of asteroids (jump and dash across them) riding a comet toward a planet, with small rocks
// floating round it to grapple. The planet grows as the match goes on (by time left, the score, or players left),
// stars stream past faster and faster, the leading edge catches fire in the atmosphere, and when the match ends the
// comet hits the planet and explodes.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...o });

export function buildComet(A, T) {
  const S = A.scene, r = T.rng(4747);
  A.plats = []; A.pillars = []; A.arcPts = []; A.killY = -45;
  A.setSky({ top: 0x020310, mid: 0x070a1c, bot: 0x02030a, fog: 0x070a1c, near: 500, far: 1400, hemiSky: 0x8090c0, hemiGround: 0x201820, hemi: 0.75, sunColor: 0xfff2e0, sun: 2.6, sunOff: new THREE.Vector3(-50, 45, 35) });
  const D = new THREE.Vector3(1, -0.32, 0.25).normalize(); // the way we're flying: the planet is ahead

  // ---- the asteroids you stand on: a big one in the middle, a ring round it, a few further out; gaps you can jump or dash
  const rockTex = T.canvasTex((g, s) => {
    const q = T.rng(31); g.fillStyle = '#8a8076'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) { const v = 90 + q() * 80 | 0; g.fillStyle = `rgba(${v},${v - 6},${v - 12},0.5)`; g.beginPath(); g.arc(q() * s, q() * s, 1 + q() * 7, 0, TAU); g.fill(); }
    for (let i = 0; i < 40; i++) { const x = q() * s, y = q() * s, rr = 3 + q() * 10; g.strokeStyle = 'rgba(40,34,30,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.stroke(); } // little craters
    T.speckle(g, s, q, 3000, 0.18);
  });
  const rockM = std(0xffffff, { map: rockTex, vertexColors: true, side: THREE.DoubleSide });
  const plats = A.plats, roids = [];
  const addRoid = (x, z, y, R) => {
    const p = { kind: 'roid', x, z, y, w: 2 * R, d: 2 * R, ang: 0, round: R, i: plats.length, meshes: [], boxes: [], ramps: [], rays: [] };
    const ph = [r() * TAU, r() * TAU, r() * TAU], craters = []; for (let k = 0; k < 2 + (R > 12 ? 2 : 0); k++) { const a = r() * TAU, d = r() * R * 0.55; craters.push([x + Math.cos(a) * d, z + Math.sin(a) * d, 2 + r() * R * 0.18]); }
    p.hf = (qx, qz) => { // a lumpy, cratered top that rounds off at the edge
      const dx = qx - x, dz = qz - z, u = Math.hypot(dx, dz) / R;
      let h = 0.45 * Math.sin(dx * 0.31 + ph[0]) * Math.sin(dz * 0.27 + ph[1]) + 0.25 * Math.sin(dx * 0.13 - dz * 0.17 + ph[2]);
      for (const [cx, cz, cr] of craters) { const e = Math.hypot(qx - cx, qz - cz) / cr; h += -0.9 * Math.exp(-e * e * 2) + 0.35 * Math.exp(-(e - 1) * (e - 1) * 8); } // a dip with a raised rim
      if (u > 0.8) h -= 1.6 * Math.min(1, (u - 0.8) / 0.2) ** 2;
      return y + h;
    };
    plats.push(p); A.discs.push({ x, z, r: R, y0: y - R * 0.7, y1: y, hf: p.hf }); p.discs = [A.discs[A.discs.length - 1]];
    const box = { x0: x - R * 0.8, x1: x + R * 0.8, y0: y - R * 0.7, y1: y + 0.4, z0: z - R * 0.8, z1: z + R * 0.8 }; A.rayBoxes.push(box); p.rays.push(box);
    A.node('P' + p.i, x, p.hf(x, z), z).plat = p.i;
    for (let k = 0; k < (R > 12 ? 3 : 1); k++) { const a = r() * TAU, d = k ? R * 0.45 : 0, sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d, sp = new THREE.Vector3(sx, p.hf(sx, sz) + 0.05, sz); sp.plat = p.i; A.spawns.push(sp); }
    // the mesh: the top as a fine polar grid on the height function, the underside a lumpy dome
    const NA = 48, NT = 12, NB = 9, pos = [], col = [], idx = [], lump = (a, t) => 1 + 0.16 * Math.sin(3 * a + ph[0] + t * 3) + 0.08 * Math.sin(7 * a + ph[1] - t * 4) + 0.05 * Math.sin(13 * a + ph[2]);
    for (let i = 0; i <= NT; i++) for (let j = 0; j <= NA; j++) { const a = j / NA * TAU, rr = i / NT * R * (i === NT ? lump(a, 0) * 0.97 : 1), px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; const yy = p.hf(px, pz); pos.push(px, yy, pz); const c = 0.8 + (yy - y) * 0.12; col.push(c, c * 0.97, c * 0.94); }
    for (let i = 1; i <= NB; i++) for (let j = 0; j <= NA; j++) { // underneath
      const a = j / NA * TAU, t = i / NB, e = R * lump(a, 0) * 0.97, rr = e * Math.cos(t * Math.PI / 2) * lump(a * 1.3, t) + 0.01, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
      const ey = p.hf(x + Math.cos(a) * e, z + Math.sin(a) * e), yy = ey - R * 0.75 * Math.sin(t * Math.PI / 2) * (0.85 + 0.3 * Math.sin(a * 5 + ph[2]));
      pos.push(px, yy, pz); const c = 0.55 - t * 0.2; col.push(c, c * 0.95, c * 0.92);
    }
    const rows = NT + NB + 1;
    for (let i = 0; i < rows - 1; i++) for (let j = 0; j < NA; j++) { const a0 = i * (NA + 1) + j, b0 = a0 + NA + 1; idx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] / 9, pos[i + 2] / 9 + pos[i + 1] / 9); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, rockM); m.castShadow = m.receiveShadow = true; S.add(m); p.meshes.push(m);
    roids.push(p); return p;
  };
  const hub = addRoid(0, 0, 0, 16);
  const ring = [];
  for (let k = 0; k < 7; k++) { // the ring: each a jump (or a dash) from the hub and from its neighbours
    const R = 8 + r() * 4, a = k / 7 * TAU + (r() - 0.5) * 0.2, d = 16 + R + 4.5 + r() * 2.5, y = Math.round((r() - 0.4) * 10);
    ring.push(addRoid(Math.cos(a) * d, Math.sin(a) * d, y, R));
  }
  for (let k = 0; k < 5; k++) { // a few further out, off the gaps in the ring
    const a = (k / 5 + 0.07) * TAU, base = ring.reduce((best, q) => { const qa = Math.atan2(q.z, q.x), dd = Math.abs(((qa - a + Math.PI * 3) % TAU) - Math.PI); return dd < best.d ? { q, d: dd } : best; }, { q: null, d: 9 }).q;
    const R = 6 + r() * 3, dist = Math.hypot(base.x, base.z) + base.round + R + 4 + r() * 3, y = base.y + Math.round((r() - 0.5) * 6);
    addRoid(Math.cos(a) * dist, Math.sin(a) * dist, y, R);
  }
  for (const a of roids) for (const b of roids) if (a.i < b.i && Math.hypot(a.x - b.x, a.z - b.z) - a.round - b.round < 9 && Math.abs(a.y - b.y) < 7) A.link('P' + a.i, 'P' + b.i); // (bots jump the gaps)

  // ---- small rocks drifting round the cluster: grapple them to swing across
  const small = [];
  for (let k = 0, tries = 0; k < 32 && tries < 500; tries++) {
    const a = r() * TAU, d = 18 + r() * 70, x = Math.cos(a) * d, z = Math.sin(a) * d, y = 12 + r() * 32, s = 1.3 + r() * 1.8;
    if (small.some((q) => Math.hypot(q.x - x, q.z - z) < 9 && Math.abs(q.y - y) < 8)) continue;
    const geo = new THREE.DodecahedronGeometry(s, 1), pp = geo.attributes.position; for (let i = 0; i < pp.count; i++) { const f = 0.8 + 0.4 * Math.abs(Math.sin(pp.getX(i) * 3 + pp.getY(i) * 2 + k)); pp.setXYZ(i, pp.getX(i) * f, pp.getY(i) * f * 0.85, pp.getZ(i) * f); } geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, std(0x7a7068, { map: rockTex, flatShading: true })); m.position.set(x, y, z); m.rotation.set(r() * 3, r() * 3, r() * 3); m.castShadow = true; S.add(m);
    A.rayBoxes.push({ x0: x - s, x1: x + s, y0: y - s, y1: y + s, z0: z - s, z1: z + s }); A.pillars.push({ x, z, w: s * 2 });
    small.push({ x, y, z, m, spin: new THREE.Vector3((r() - 0.5) * 0.5, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5) }); k++;
  }
  A.finishNav();

  // ---- space: stars streaming past, the planet ahead, the comet's tail behind, fire on the leading edge
  const NS = A.quality === 'low' ? 600 : 1400, sp = new Float32Array(NS * 6), seeds = [];
  for (let i = 0; i < NS; i++) { const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize().multiplyScalar(250 + r() * 450); seeds.push(v); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.85, fog: false })); stars.frustumCulled = false; S.add(stars);
  const planetTex = T.canvasTex((g, s) => { // oceans, continents, cloud bands
    const q = T.rng(77); g.fillStyle = '#1d4f8f'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) { const x = q() * s, y = s * 0.15 + q() * s * 0.7, rr = 10 + q() * 45; g.fillStyle = q() < 0.6 ? '#3f7a3c' : '#9a8a5a'; g.beginPath(); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, rad = rr * (0.6 + q() * 0.6); g.lineTo(x + Math.cos(a) * rad * 1.6, y + Math.sin(a) * rad); } g.fill(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.25 + q() * 0.4})`; g.fillRect(q() * s, q() * s, 30 + q() * 120, 2 + q() * 5); }
    g.fillStyle = 'rgba(240,250,255,0.85)'; g.fillRect(0, 0, s, s * 0.06); g.fillRect(0, s * 0.94, s, s * 0.06); // ice caps
  }, 512);
  planetTex.wrapS = THREE.RepeatWrapping;
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshStandardMaterial({ map: planetTex, roughness: 0.8, fog: false, side: THREE.DoubleSide }));
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.04, 48, 32), new THREE.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: 0.25, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  S.add(planet, atmo);
  const glowTex = T.canvasTex((g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }, 128);
  const tailM = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, fog: true, side: THREE.DoubleSide }); // (faint, and fading into the distance)
  const tail = new THREE.Group(); S.add(tail);
  for (let k = 0; k < 4; k++) { const h = 380 + k * 60, c = new THREE.Mesh(new THREE.ConeGeometry(45 + k * 18, h, 24, 1, true), tailM); c.rotation.x = Math.PI / 2; c.position.z = -(75 + k * 12 + h / 2); tail.add(c); } // (starting well behind the cluster) // the gas tail streaming behind, narrow at the comet and widening away

  tail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), D.clone().negate());
  const fireM = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.BackSide }); // (behind everything nearer: a glow in the distance, never over the fight)
  const fire = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, TAU, 0, Math.PI / 2), fireM); fire.scale.set(95, 55, 95); fire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), D.clone().negate()); fire.position.copy(D).multiplyScalar(150); fire.renderOrder = -1; S.add(fire); // the shock front, ahead of us
  const flashM = new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, side: THREE.DoubleSide }); // (drawn over everything: the planet's surface is right there)
  const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), flashM); flash.visible = false; flash.renderOrder = 10; S.add(flash);
  for (const q of small) q.m.userData.base = q.m.position.clone();

  // ---- the run: progress 0..1 sets how close the planet is and how fast everything streams past; the end is impact
  let prog = 0, target = 0, pv = 0, impactT = -1, boomed = false, clock = 0;
  const P = new THREE.Vector3(), tmp = new THREE.Vector3();
  A.cometTick = (dt, p, ended) => {
    dt = Math.min(0.1, dt || 0); clock += dt;
    if (ended && impactT < 0) impactT = 0;
    if (impactT >= 0) { impactT += dt; prog = Math.min(1.02, prog + dt * 0.5); }
    else { // a soft spring toward where the match is (time left, players left, the score): after a death it starts gently, picks up and settles, over a few seconds; and it always creeps a little closer
      target = Math.max(target, Math.min(0.97, p)); pv += ((target - prog) * 0.55 - pv * 1.5) * dt; pv = Math.max(0, pv); prog = Math.min(0.97, prog + pv * dt + dt / 2400);
    }
    const e = prog * prog, L = 700, ang = 0.06 + e * 1.42; // the planet's angular size swells as we close in
    const rad = Math.min(L - 4, L * Math.sin(Math.min(1.45, ang)) + (impactT >= 0 ? impactT * 30 : 0)); // (at impact the surface is right at the cluster)
    P.copy(D).multiplyScalar(L); planet.position.copy(P); planet.scale.setScalar(rad); atmo.position.copy(P); atmo.scale.setScalar(rad);
    atmo.material.opacity = 0.25 * Math.max(0, Math.min(1, (L - rad * 1.04 - 20) / 60)); atmo.visible = atmo.material.opacity > 0.01; // (fades out before we'd be inside it: no blue veil over the screen)
    planet.rotation.y += dt * (0.02 + e * 0.2);
    const speed = 30 + e * 520; // the stars stream past faster and faster
    const pos = sg.attributes.position.array, len = 2 + speed * 0.05;
    for (let i = 0; i < NS; i++) { const v = seeds[i]; v.addScaledVector(D, -speed * dt); if (v.dot(D) < -450) v.addScaledVector(D, 900); if (v.length() > 720) v.setLength(260); pos[i * 6] = v.x; pos[i * 6 + 1] = v.y; pos[i * 6 + 2] = v.z; tmp.copy(v).addScaledVector(D, len); pos[i * 6 + 3] = tmp.x; pos[i * 6 + 4] = tmp.y; pos[i * 6 + 5] = tmp.z; }
    sg.attributes.position.needsUpdate = true;
    tailM.opacity = 0.05 + 0.02 * Math.sin(clock * 3) + e * 0.05;
    fireM.opacity = 0; fire.visible = false; // (no orange burn glow: it got in the way)
    fire.scale.set(95 + e * 40, 55 + e * 60, 95 + e * 40);
    for (const q of small) { q.m.rotation.x += q.spin.x * dt; q.m.rotation.y += q.spin.y * dt; q.m.rotation.z += q.spin.z * dt; }
    if (impactT >= 0) { // the surface rushes in... and the comet hits: a white flash and a swelling fireball
      const u = impactT - 1.1;
      if (u >= 0) { flash.visible = true; flash.position.copy(D).multiplyScalar(30); flash.scale.setScalar(20 + u * 420); flashM.opacity = Math.max(0, 1 - u * 0.9); flashM.color.setHSL(0.08 - Math.min(0.08, u * 0.04), 1, 0.75 - Math.min(0.3, u * 0.15)); }
      if (u >= 0 && !boomed) { boomed = true; flashScreen(); return true; } // (main shakes the camera and plays the boom)
    }
    return false;
  };
  A.fallText = () => 'drifted off into space'; A.fallBy = () => 'Drifted off into space';
}

function flashScreen() { // a white-out over the whole screen, fading
  try {
    const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;background:#fff6e0;pointer-events:none;z-index:50;opacity:1;transition:opacity 1.6s ease-out';
    document.body.appendChild(d); requestAnimationFrame(() => { d.style.opacity = '0'; }); setTimeout(() => d.remove(), 1800);
  } catch (e) {}
}
