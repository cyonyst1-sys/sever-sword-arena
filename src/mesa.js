// Sky Plateaus: every plateau is the top of a mesa (a South American tepui): a sandy, gently rolling top with dips
// and mounds, and sheer layered sandstone cliffs dropping straight down through the clouds.
import * as THREE from 'three';

const TAU = Math.PI * 2;
function canvasTex(draw, S = 256) {
  const c = document.createElement('canvas'); c.width = c.height = S; draw(c.getContext('2d'), S);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
let mats = null;
function M(rng) {
  if (mats) return mats;
  const sand = canvasTex((g, S) => { // sand with ripples, pebbles and a few cracks
    const r = rng(61); g.fillStyle = '#d6b689'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 3) { g.fillStyle = `rgba(${Math.sin(y * 0.21) > 0 ? '255,240,210' : '120,90,55'},0.07)`; g.fillRect(0, y, S, 2); }
    for (let i = 0; i < 260; i++) { const v = 110 + r() * 90 | 0; g.fillStyle = `rgba(${v},${v * 0.82 | 0},${v * 0.6 | 0},0.7)`; g.beginPath(); g.ellipse(r() * S, r() * S, 1 + r() * 3, 1 + r() * 2.2, r() * 3, 0, TAU); g.fill(); }
    for (let i = 0; i < 12; i++) { let x = r() * S, y = r() * S; g.strokeStyle = 'rgba(90,60,35,0.35)'; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.09 * r()})`; g.fillRect(r() * S, r() * S, 1, 1); }
  });
  const cliff = canvasTex((g, S) => { // layered sandstone: bands of colour, ledges, vertical cracks and water stains
    const r = rng(62); let y = 0;
    while (y < S) { const h = 4 + r() * 22, c = [[201, 138, 94], [176, 101, 74], [138, 74, 54], [216, 160, 112], [160, 92, 66]][r() * 5 | 0]; g.fillStyle = `rgb(${c})`; g.fillRect(0, y, S, h + 1); g.fillStyle = 'rgba(60,30,20,0.35)'; g.fillRect(0, y + h - 1.5, S, 1.5); y += h; }
    for (let i = 0; i < 40; i++) { let x = r() * S, yy = 0; g.strokeStyle = `rgba(55,28,18,${0.25 + r() * 0.35})`; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(x, yy); while (yy < S) { yy += 8 + r() * 14; x += (r() - 0.5) * 5; g.lineTo(x, yy); } g.stroke(); }
    for (let i = 0; i < 20; i++) { const x = r() * S, w = 3 + r() * 8; const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(40,25,20,0.3)'); gr.addColorStop(1, 'rgba(40,25,20,0)'); g.fillStyle = gr; g.fillRect(x, 0, w, S); }
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.1 * r()})`; g.fillRect(r() * S, r() * S, 1 + r(), 1 + r()); }
  });
  cliff.repeat.set(1, 1);
  return (mats = {
    top: new THREE.MeshStandardMaterial({ map: sand, vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    side: new THREE.MeshStandardMaterial({ map: cliff, vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }),
  });
}

// the top's shape and its physics: call while laying out platforms (pads are added after, and flatten the ground round them)
export function makeMesa(A, p, r) {
  const R = p.round = Math.min(p.w, p.d) / 2, ph = Array.from({ length: 8 }, () => r() * TAU);
  const bumps = []; for (let k = 0; k < 4; k++) { const a = r() * TAU, d = r() * R * 0.6; bumps.push([p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, k === 3 ? -1.1 : 0.9 + r() * 0.9, 18 + r() * 30]); } // three mounds and a dip
  p.flats = [];
  p.hf = (x, z) => {
    const dx = x - p.x, dz = z - p.z, u = Math.hypot(dx, dz) / R;
    let h = 0.55 * Math.sin(dx * 0.17 + ph[0]) * Math.sin(dz * 0.15 + ph[1]) + 0.4 * Math.sin(dx * 0.07 + dz * 0.05 + ph[2]) + 0.18 * Math.sin(dx * 0.37 - dz * 0.29 + ph[3]);
    for (const [bx, bz, a, s2] of bumps) h += a * Math.exp(-((x - bx) ** 2 + (z - bz) ** 2) / s2);
    if (u > 0.86) h -= 1.1 * Math.min(1, (u - 0.86) / 0.14) ** 2; // the top rounds off at the cliff edge
    for (const f of p.flats) { const k = Math.hypot(x - f.x, z - f.z); if (k < f.r + 3) h *= k < f.r ? 0 : (k - f.r) / 3; } // level round the jump pads
    return p.y + h;
  };
  const c = { x: p.x, z: p.z, r: R, y0: p.y - 40, y1: p.y, hf: p.hf }; A.discs.push(c); p.discs = [c];
  const box = { x0: p.x - R * 0.9, x1: p.x + R * 0.9, y0: p.y - 300, y1: p.y + 0.5, z0: p.z - R * 0.9, z1: p.z + R * 0.9 }; A.rayBoxes.push(box); (p.rays ||= []).push(box);
}

// the mesh: build once the pads are placed (so the ground round them is level)
export function mesaMesh(A, p, r) {
  const m = M((s) => { let v = s >>> 0; return () => { v = (v * 1664525 + 1013904223) >>> 0; return v / 4294967296; }; }), R = p.round;
  const NA = A.quality === 'low' ? 64 : 112, NT = A.quality === 'low' ? 12 : 22, ph = Array.from({ length: 6 }, () => r() * TAU);
  const buttress = (a) => 0.5 * Math.sin(5 * a + ph[0]) + 0.3 * Math.sin(11 * a + ph[1]) + 0.2 * Math.sin(23 * a + ph[2]);
  const rimR = (a) => R * (1 + 0.035 * buttress(a)); // the edge wanders a little (never inside the walkable circle by much)
  // ---- the top: rings out from the middle
  const tp = [], tc = [], tu = [], ti = [];
  for (let i = 0; i <= NT; i++) for (let j = 0; j <= NA; j++) {
    const a = j / NA * TAU, rr = (i / NT) * (i === NT ? rimR(a) : R), x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr, y = p.hf(x, z);
    tp.push(x, y, z); tu.push(x / 7, z / 7);
    const k = 0.86 + 0.12 * Math.sin(x * 0.13 + ph[3]) * Math.sin(z * 0.11 + ph[4]) + (y - p.y) * 0.05, g = Math.max(0, Math.sin(x * 0.05 + ph[5]) * Math.sin(z * 0.06) - 0.55) * 1.4; // sand, darker in the dips, scrubby patches
    tc.push(k * (1 - g * 0.4), k * (1 - g * 0.1), k * (1 - g * 0.6));
  }
  for (let i = 0; i < NT; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; ti.push(a, a + 1, b, a + 1, b + 1, b); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(tu, 2)); tg.setIndex(ti); tg.computeVertexNormals();
  const top = new THREE.Mesh(tg, m.top); top.receiveShadow = true; A.scene.add(top); p.meshes.push(top);
  // ---- the cliffs: almost sheer, flaring only a little, all the way down through the clouds
  const T = [0, 0.004, 0.012, 0.025, 0.05, 0.09, 0.15, 0.24, 0.36, 0.5, 0.66, 0.83, 1], DROP = 300, sp = [], sc = [], su = [], si = [];
  for (let i = 0; i < T.length; i++) for (let j = 0; j <= NA; j++) {
    const t = T[i], a = j / NA * TAU, e = rimR(a), ex = p.x + Math.cos(a) * e, ez = p.z + Math.sin(a) * e, ey = p.hf(ex, ez);
    const rr = e * (1 + 0.01 * Math.min(1, t * 60) + 0.22 * t ** 1.6) + (t > 0 ? R * 0.04 * buttress(a * 1.7 + t * 3) * Math.min(1, t * 8) : 0);
    const x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr, y = ey - (t < 0.004 ? 0 : 0.6) - DROP * t;
    sp.push(x, y, z); su.push(a * R / 22, y / 22);
    const k = Math.max(0.35, 1 - t * 0.8); sc.push(k, k, k); // darker as it drops into the haze
  }
  for (let i = 0; i < T.length - 1; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; si.push(a, b, a + 1, a + 1, b, b + 1); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2)); sg.setIndex(si); sg.computeVertexNormals();
  const side = new THREE.Mesh(sg, m.side); side.receiveShadow = true; A.scene.add(side); p.meshes.push(side);
}
