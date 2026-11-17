// A procedural samurai with human proportions: every part is a simple convex shape (so it can be cut
// cleanly), posed each frame with a long-striding run cycle, two-bone IK for arms and legs, and a sword
// driven by the swing input (s.x, s.y).
import * as THREE from 'three';
import { buildBody, poseBody } from './body.js?v=20261116201721';
import { item, cleanLook } from './cosmetics.js?v=20261116201721';

// Every material that can end up on a sliced piece is registered here, so a piece's single mesh can use
// one shared material array and keep each triangle's look.
export const MATS = [];
export function regMat(m) { if (m.userData.mi === undefined) { m.userData.mi = MATS.length; MATS.push(m); } return m.userData.mi; }

export const CAP = {
  flesh: new THREE.MeshStandardMaterial({ color: 0x151317, roughness: 0.45, side: THREE.DoubleSide }), // (the cut face: black, like the blood)
  steel: new THREE.MeshStandardMaterial({ color: 0xeef3f8, roughness: 0.25, metalness: 0.8, side: THREE.DoubleSide }),
  wood: new THREE.MeshStandardMaterial({ color: 0xc9a36b, roughness: 0.8, side: THREE.DoubleSide }),
};
for (const m of Object.values(CAP)) regMat(m);

export const PALETTE = [0xd63a3a, 0x2f7fe0, 0xf0c419, 0x2fae5f, 0x9b51e0, 0xf07f1f, 0x18b8a8, 0xeeeeee];
export const HORDE_COLOR = 0x2a2a2e;

// woven cloth and combed hair: small tiling textures used both as a faint pattern and as relief
function fabricTex(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = kind === 'hair' ? '#d8d8d8' : '#ececec'; g.fillRect(0, 0, 64, 64);
  if (kind === 'hair') { for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${0.15 + Math.random() * 0.3})`; g.fillRect(Math.random() * 64, 0, 1, 64); } }
  else for (let y = 0; y < 64; y += 4) for (let x = 0; x < 64; x += 4) { // over-under weave
    const o = ((x + y) / 4) % 2 === 0; g.fillStyle = o ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.2)'; g.fillRect(x, y, o ? 4 : 2, o ? 2 : 4);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 3, y + 3, 1, 1);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(kind === 'hair' ? 3 : 7, kind === 'hair' ? 1 : 5); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const WEAVE = fabricTex('weave'), HAIRT = fabricTex('hair');
const M = {
  skin: new THREE.MeshStandardMaterial({ color: 0xe0b48c, roughness: 0.7 }),
  skinShade: new THREE.MeshStandardMaterial({ color: 0xc99872, roughness: 0.75 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x24242a, roughness: 0.85, map: WEAVE, bumpMap: WEAVE, bumpScale: 0.9 }),
  hair: new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.75, map: HAIRT, bumpMap: HAIRT, bumpScale: 1.2 }),
  blade: new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.18, metalness: 0.9 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.35, metalness: 0.8 }),
  grip: new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.9 }),
  eye: new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.25 }), // (the whites)
  iris: new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.2 }),
  oni: new THREE.MeshStandardMaterial({ color: 0x8e1717, roughness: 0.5, emissive: 0x220000 }),
  saya: new THREE.MeshStandardMaterial({ color: 0x1c1416, roughness: 0.3, metalness: 0.2 }), // lacquered scabbard
};
for (const m of Object.values(M)) regMat(m);
CAP.flesh.userData.flesh = true; M.skin.userData.flesh = true; M.skinShade.userData.flesh = true;
// armour: small tiling patterns used as both colour and relief (light grey, so the material's colour tints them)
function armorTex(kind, rx, ry) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  if (kind === 'lamellar') { // rows of small lacquered plates, each row overlapping the one below, laced together
    g.fillStyle = '#2e2e2e'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { const px = x * 16, py = y * 32;
      const gr = g.createLinearGradient(0, py, 0, py + 32); gr.addColorStop(0, '#b4b4b4'); gr.addColorStop(0.7, '#7c7c7c'); gr.addColorStop(1, '#1a1a1a'); g.fillStyle = gr;
      g.beginPath(); if (g.roundRect) g.roundRect(px + 1, py + 1, 14, 30, [2, 2, 6, 6]); else g.rect(px + 1, py + 1, 14, 30); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(px + 2, py + 2, 2, 20); // a glint down one edge
      g.fillStyle = '#ffffff'; g.fillRect(px + 4, py + 6, 8, 3); g.fillRect(px + 4, py + 13, 8, 3); // the lacing
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(px + 7, py + 5, 2, 12); }
  } else if (kind === 'splint') { // polished metal splints riveted over dark padding
    g.fillStyle = '#3c3c3c'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 4) { g.fillStyle = 'rgba(0,0,0,' + (y % 8 ? 0.15 : 0.32) + ')'; g.fillRect(0, y, 128, 1); }
    for (let x = 0; x < 4; x++) { const px = x * 32 + 5, gr = g.createLinearGradient(px, 0, px + 22, 0); gr.addColorStop(0, '#8a8a8a'); gr.addColorStop(0.4, '#ffffff'); gr.addColorStop(1, '#6e6e6e'); g.fillStyle = gr; g.fillRect(px, 0, 22, 128);
      for (let y = 12; y < 128; y += 34) { g.fillStyle = '#262626'; g.beginPath(); g.arc(px + 11, y, 3.4, 0, 7); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(px + 10, y - 1, 1.3, 0, 7); g.fill(); } }
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, 128, 6); g.fillRect(0, 122, 128, 6); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 6, 128, 2); g.fillRect(0, 120, 128, 2); // a rolled rim top and bottom
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const armorCache = new Map();
/** Armour in a colour: 'lamellar' (lacquered plates laced in rows) or 'splint' (riveted metal strips). */
function armor(color, kind, rx, ry, k = 1) {
  const key = kind + ':' + color + ':' + rx + ':' + ry + ':' + k;
  if (!armorCache.has(key)) {
    const t = armorTex(kind, rx, ry), lam = kind === 'lamellar';
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(k), map: t, bumpMap: t, bumpScale: lam ? 1.6 : 1.3, roughness: lam ? 0.36 : 0.26, metalness: lam ? 0.45 : 0.85 });
    regMat(m); shine(m); armorCache.set(key, m);
  }
  return armorCache.get(key);
}
const clothCache = new Map();
function cloth(color, k = 1, glow = 0) { // (glow: the trim of a legendary outfit lights up)
  const key = color + ':' + k + ':' + glow;
  if (!clothCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(k * 1.08), roughness: 0.85, map: WEAVE, bumpMap: WEAVE, bumpScale: 0.9, emissive: glow ? new THREE.Color(glow) : new THREE.Color(0), emissiveIntensity: glow ? 1.6 : 1 });
    regMat(m); clothCache.set(key, m);
  }
  return clothCache.get(key);
}

// a profile spun round the y axis (closed at both ends): [radius, y] pairs from the bottom (y = -0.5) to the top (0.5)
const lathe = (prof, n) => new THREE.LatheGeometry([[0.001, -0.5], ...prof, [0.001, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), n);
// a box with its edges and corners rounded off (a superellipsoid): still 1 x 1 x 1 across the middle of each face
function roundBox() {
  const g = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3), p = g.attributes.position, nm = g.attributes.normal, N = 4, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) * 2, y = p.getY(i) * 2, z = p.getZ(i) * 2, k = Math.pow(Math.pow(Math.abs(x), N) + Math.pow(Math.abs(y), N) + Math.pow(Math.abs(z), N), 1 / N) || 1;
    p.setXYZ(i, x / k / 2, y / k / 2, z / k / 2);
    v.set(Math.sign(x) * Math.pow(Math.abs(x / k), N - 1), Math.sign(y) * Math.pow(Math.abs(y / k), N - 1), Math.sign(z) * Math.pow(Math.abs(z / k), N - 1)).normalize(); nm.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}
// the torso: a V from a narrow waist up to broad, rounded shoulders, a chest standing out at the front (two pecs with a
// dip down the middle) and shoulder blades at the back (forward is -z). Unit size, stretched into place like the rest.
function torso() {
  const g = new THREE.CylinderGeometry(1, 1, 1, 28, 14, false), p = g.attributes.position;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const bump = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const t = y + 0.5;
    const w = 0.74 + 0.34 * ss(0.05, 0.78, t) - 0.2 * ss(0.86, 1.0, t); // waist to shoulders, rounding over the top
    x *= w; z *= w * 0.96;
    if (z < 0) z *= 1 + 0.26 * bump(t, 0.66, 0.17) * (1 - 0.45 * Math.exp(-((x / 0.16) ** 2))); // the chest, a dip at the breastbone
    else z *= 1 + 0.12 * bump(t, 0.7, 0.2) * (0.6 + 0.4 * Math.min(1, Math.abs(x) / 0.5)); // the shoulder blades
    if (t > 0.98) y = 0.48 + (y - 0.48) * 0.4; // (a softer top)
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals(); return g;
}
// a sculpted head (unit size, stretched into place like the rest; forward is -z): a skull longer front to back, a brow
// ridge, eye sockets, cheekbones, a nose with a bridge and a tip, a groove for the mouth, a jaw narrowing to a chin
function headGeo(withNose = true) {
  const g = new THREE.SphereGeometry(1, 40, 30), p = g.attributes.position;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const gs = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2) - (((y - cy) / sy) ** 2));
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const fr = ss(-0.2, -0.85, z); // how much this point faces forward
    if (z > 0) z *= 1.08; // the back of the skull
    if (y > -0.2) x *= 0.94; // flatter at the temples
    const low = ss(-0.15, -0.85, y); // the lower face: the jaw narrows toward the chin and the chin comes down and forward
    x *= 1 - 0.3 * low * (0.4 + 0.6 * fr); y -= 0.16 * low * (0.3 + 0.7 * fr); z -= 0.07 * gs(x, y, 0, -0.95, 0.35, 0.18) * fr;
    if (z < 0) {
      z -= 0.07 * gs(x, y, 0, 0.27, 0.6, 0.07) * fr; // brow ridge
      z += 0.1 * (gs(x, y, -0.36, 0.1, 0.17, 0.12) + gs(x, y, 0.36, 0.1, 0.17, 0.12)) * fr; // eye sockets
      x *= 1 + 0.06 * (gs(x, y, -0.55, -0.15, 0.2, 0.15) + gs(x, y, 0.55, -0.15, 0.2, 0.15)); // cheekbones
      const nose = y < 0.2 && y > -0.36 ? (0.07 + 0.22 * ss(0.16, -0.22, y)) * (1 - ss(-0.24, -0.34, y)) : 0, nw = 0.1 + 0.07 * ss(-0.05, -0.24, y);
      if (withNose) z -= nose * Math.exp(-((x / nw) ** 2)) * fr; // the nose: a narrow bridge growing out to a broader tip
      z += 0.03 * gs(x, y, 0, -0.5, 0.2, 0.025) * fr; // the line of the mouth
      z -= 0.025 * gs(x, y, 0, -0.43, 0.22, 0.05) * fr; // upper lip
    }
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals(); return g;
}
// hair that follows the skull and stops at a hairline (low at the back, up at the forehead) instead of a ball on top
function hairGeo() {
  const g = new THREE.SphereGeometry(1, 32, 24), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const line = -0.62 + 1.15 * Math.min(1, Math.max(0, (-z + 1) / 2)) ** 1.4 - 0.3 * Math.abs(x) * (z < 0 ? 1 : 0); // the hairline: forehead high, back low
    if (z > 0) z *= 1.1;
    const t = Math.min(1, Math.max(0, (y - line + 0.08) / 0.1)), k = 0.66 + (0.34 + 0.04 * Math.sin(x * 9 + z * 7)) * t * t * (3 - 2 * t); // (below the line it tucks well inside the head; above it, a little texture)
    p.setXYZ(i, x * k * 0.96, y * k, z * k);
  }
  g.computeVertexNormals(); return g;
}
// sword shapes: a blade outline (x across the blade, the edge at +x; y from the hilt, -0.5, to the tip, 0.5) pushed
// out into a thin slab, unit size like the box it replaces, so the sword's width and thickness still scale it
const bladeCache = {};
function bladeGeo(id) {
  if (bladeCache[id]) return bladeCache[id];
  const n = 40, L = [], Rr = [], ys = Array.from({ length: n + 1 }, (_, i) => -0.5 + i / n);
  const tipIn = (y, at) => Math.max(0, Math.min(1, (0.5 - y) / (0.5 - at))); // 1 below the tip, closing to 0 at it
  const edge = (c, h, at = 0.38, tipX = null) => { for (const y of ys) { const k = y > at ? tipIn(y, at) : 1, cc = c(y); L.push([cc - h(y) * (y > at && tipX === 'back' ? 1 : k), y]); Rr.push([cc + h(y) * k, y]); } };
  const saw = (t) => t - Math.floor(t);
  const P = (y) => y + 0.5;
  if (id === 'tachi') edge((y) => -1.2 * P(y) ** 2, () => 0.5, 0.36);
  else if (id === 'jian') edge(() => 0, (y) => 0.45 - 0.05 * Math.sin(P(y) * Math.PI), 0.32);
  else if (id === 'serrated') { for (const y of ys) { const k = y > 0.38 ? tipIn(y, 0.38) : 1; L.push([-0.5 * k, y]); Rr.push([(0.5 + (y < 0.36 && y > -0.42 ? 0.32 * saw(P(y) * 16) : 0)) * k, y]); } }
  else if (id === 'scimitar') edge((y) => -1.6 * P(y) ** 2, (y) => 0.38 + 0.62 * P(y) ** 1.5, 0.42);
  else if (id === 'forked') { for (const y of ys) { L.push([-0.5, y]); Rr.push([0.5, y]); } L[n][0] = -0.55; Rr[n][0] = 0.55; }
  else if (id === 'flame') edge((y) => 0.38 * Math.sin(P(y) * Math.PI * 9) * (1 - P(y) * 0.5), () => 0.42, 0.4);
  else if (id === 'crescent') { for (const y of ys) { const s = Math.sin(Math.PI * P(y)), k = y > 0.42 ? tipIn(y, 0.42) : 1; L.push([(-0.5 - 2.8 * s) * k, y]); Rr.push([(0.5 - 1.0 * s) * k, y]); } }
  else if (id === 'demon') { for (const y of ys) { const k = y > 0.4 ? tipIn(y, 0.4) : 1; L.push([(-0.7 - (y > -0.35 && y < 0.35 ? 1.0 * saw(P(y) * 6) : 0)) * k, y]); Rr.push([(0.7 + 0.12 * Math.sin(P(y) * 30)) * k, y]); } }
  else if (id === 'wing') { for (const y of ys) { const s = Math.sin(Math.PI * Math.min(1, P(y) * 1.05)), k = y > 0.45 ? tipIn(y, 0.45) : 1; L.push([-0.4 * k, y]); Rr.push([(0.4 + 2.4 * s ** 0.7 - 0.6 * Math.abs(Math.sin(P(y) * Math.PI * 5)) * s) * k, y]); } }
  else { for (const y of ys) { L.push([-0.5, y]); Rr.push([y > 0.3 ? 0.5 - (y - 0.3) / 0.2 * 1.0 : 0.5, y]); } } // straight, with an angled tip
  const pts = [...Rr.map(([x, y]) => new THREE.Vector2(x, y)), ...L.reverse().map(([x, y]) => new THREE.Vector2(x, y))];
  if (id === 'forked') pts.splice(n + 1, 0, new THREE.Vector2(0, 0.3)); // (a notch splitting the tip in two)
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); g.computeVertexNormals();
  return (bladeCache[id] = g);
}
const GEO = {
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14, 1),
  tasset: lathe([[0.98, -0.49], [1.02, -0.2], [1.1, 0.2], [1.2, 0.46], [1.12, 0.49]], 14), // a thigh plate: snug at the hip, flaring toward the knee
  taper: lathe([[0.86, -0.49], [1.0, -0.36], [1.05, -0.1], [0.92, 0.22], [0.76, 0.42], [0.62, 0.49]], 10), // limbs: a rounded, slightly muscled shape, narrower at the far end
  chest: torso(),
  // limbs, each from the near joint (y = -0.5) to the far one (0.5), with the muscle where it really sits
  arm: lathe([[0.95, -0.49], [1.08, -0.35], [1.13, -0.1], [1.0, 0.15], [0.82, 0.35], [0.74, 0.49]], 12), // deltoid into a biceps, down to the elbow
  fore: lathe([[0.9, -0.49], [1.14, -0.32], [1.05, -0.1], [0.85, 0.15], [0.66, 0.38], [0.6, 0.49]], 12), // thick below the elbow, slim at the wrist
  thigh: lathe([[1.0, -0.49], [1.1, -0.3], [1.05, -0.05], [0.9, 0.2], [0.74, 0.4], [0.68, 0.49]], 12),
  calf: lathe([[0.78, -0.49], [0.98, -0.32], [1.12, -0.18], [0.95, 0.05], [0.7, 0.3], [0.52, 0.49]], 12), // the calf high, a slim ankle
  neck: lathe([[1.7, -0.49], [1.25, -0.3], [1.0, -0.05], [0.95, 0.49]], 12), // flaring into the trapezius
  headS: headGeo(), headFlat: headGeo(false), hairS: hairGeo(), // (headFlat: under a face mask, no nose to poke through it)
  sph: new THREE.SphereGeometry(1, 16, 11),
  sphLo: new THREE.SphereGeometry(1, 9, 6), // small round parts (ears, joints): fewer triangles to cut
  box: new THREE.BoxGeometry(1, 1, 1),
  round: roundBox(), // hands, feet, shoulder pads, collar, nose...
  skirt: new THREE.CylinderGeometry(0.17, 0.25, 0.4, 16, 1),
  cone: new THREE.ConeGeometry(1, 1, 12, 1),
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
// the seven skirt panels: [angle round the waist (0 = front), the leg it rides on, width]
const KUSA = [[0, null, 0.13], [-0.95, 'L', 0.125], [0.95, 'R', 0.125], [-1.85, 'L', 0.12], [1.85, 'R', 0.12], [-2.7, 'L', 0.12], [2.7, 'R', 0.12]];
const _ka = new THREE.Vector3(), _kb = new THREE.Vector3(), _kc = new THREE.Vector3(), _kx = new THREE.Vector3(), _ky = new THREE.Vector3();
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
    const gi = cloth(horde ? HORDE_COLOR : O ? O.gi : color), trim = cloth(horde ? 0x8e1717 : O ? O.trim : color, O ? 1 : 0.55, O && O.glow || 0), pants = horde ? M.dark : cloth(O ? O.pants : 0x2c2f3a);
    // armour, in the outfit's colours: lacquered plates for the shoulders, chest and skirt; steel splints for the bracers and greaves
    const tc = horde ? 0x8e1717 : O ? O.trim : color, gc = horde ? HORDE_COLOR : O ? O.gi : color;
    const lamPad = armor(tc, 'lamellar', 2, 1, 1.25), lamSkirt = armor(tc, 'lamellar', 5, 0.5, 1.1), lamTas = armor(tc, 'lamellar', 1, 1.25, 1.1), lamDou = armor(gc, 'lamellar', 4, 2.5, 0.85), splint = armor(horde ? 0x6a6a72 : 0xc4c8d0, 'splint', 2, 1);
    const mk = (geo, mat, cap = CAP.flesh) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.userData.cap = cap; this.group.add(m); this.meshes.push(m); return m; };
    this.p = {
      // trunk
      pelvis: mk(GEO.sph, pants), skirt: mk(GEO.skirt, lamSkirt, CAP.steel), ku0: mk(GEO.round, lamTas, CAP.steel), ku1: mk(GEO.round, lamTas, CAP.steel), ku2: mk(GEO.round, lamTas, CAP.steel), ku3: mk(GEO.round, lamTas, CAP.steel), ku4: mk(GEO.round, lamTas, CAP.steel), ku5: mk(GEO.round, lamTas, CAP.steel), ku6: mk(GEO.round, lamTas, CAP.steel), abdomen: mk(GEO.cyl, gi), obi: mk(GEO.cyl, trim), chest: mk(GEO.chest, gi),
      collar: mk(GEO.round, trim), padL: mk(GEO.round, lamPad, CAP.steel), padR: mk(GEO.round, lamPad, CAP.steel), pad2L: mk(GEO.round, lamPad, CAP.steel), pad2R: mk(GEO.round, lamPad, CAP.steel),
      dou: mk(GEO.chest, lamDou, CAP.steel), buckle: mk(GEO.round, M.gold, CAP.steel), delL: mk(GEO.sphLo, gi), delR: mk(GEO.sphLo, gi),
      // head
      neck: mk(GEO.neck, M.skinShade), head: mk(GEO.headS, M.skin), jaw: mk(GEO.sph, M.skin), nose: mk(GEO.round, M.skinShade),
      earL: mk(GEO.sphLo, M.skinShade), earR: mk(GEO.sphLo, M.skinShade), eyeL: mk(GEO.sph, M.eye), eyeR: mk(GEO.sph, M.eye),
      browL: mk(GEO.box, M.hair), browR: mk(GEO.box, M.hair),
      hair: mk(GEO.hairS, M.hair), band: mk(GEO.cyl, horde ? M.oni : gi), knot: mk(GEO.sphLo, M.hair), mask: horde ? mk(GEO.round, M.oni) : null,
      // arms
      uaL: mk(GEO.arm, gi), elL: mk(GEO.sphLo, M.skin), faL: mk(GEO.fore, M.skin), hL: mk(GEO.round, M.skin),
      uaR: mk(GEO.arm, gi), elR: mk(GEO.sphLo, M.skin), faR: mk(GEO.fore, M.skin), hR: mk(GEO.round, M.skin),
      // legs
      thL: mk(GEO.thigh, pants), knL: mk(GEO.sphLo, pants), shL: mk(GEO.calf, pants), ftL: mk(GEO.round, M.dark),
      thR: mk(GEO.thigh, pants), knR: mk(GEO.sphLo, pants), shR: mk(GEO.calf, pants), ftR: mk(GEO.round, M.dark),
      // sword
      // detail: crossed lapels, the obi knot and its tails at the back, wrist guards, shin wraps, a scabbard
      lapL: mk(GEO.round, trim), lapR: mk(GEO.round, trim), obiK: mk(GEO.round, trim), tailL: mk(GEO.round, trim), tailR: mk(GEO.round, trim),
      wrL: mk(GEO.cyl, splint, CAP.steel), wrR: mk(GEO.cyl, splint, CAP.steel), kyL: mk(GEO.taper, splint, CAP.steel), kyR: mk(GEO.taper, splint, CAP.steel),
      saya: mk(GEO.cyl, M.saya, CAP.wood), kojiri: mk(GEO.cyl, M.gold, CAP.steel),
      grip: mk(GEO.cyl, L.sword.id === 'katana' ? M.grip : cosMat({ c: L.sword.grip, r: 0.9 }), CAP.wood), guard: mk(GEO.box, L.sword.id === 'katana' ? M.gold : cosMat({ c: L.sword.guard, m: 0.8, r: 0.35 }), CAP.steel), blade: mk(bladeGeo(item('shape', this.look.shape).id), L.sword.id === 'katana' ? M.blade : cosMat(L.sword.blade), CAP.steel),
    };
    // mask and headwear: extra parts worn on the head; some hide what they cover
    this.acc = [];
    for (const it of [L.mask, L.hat]) {
      for (const [shape, md, p, s, r = [0, 0, 0]] of it.parts || []) this.acc.push({ m: mk(GEO[shape], cosMat(md)), p, s, r });
      for (const n of it.hide || []) { const m = this.p[n]; if (m) { this.group.remove(m); this.meshes = this.meshes.filter((x) => x !== m); } }
    }
    if ([L.mask, L.hat].some((it) => (it.hide || []).includes('nose'))) this.p.head.geometry = GEO.headFlat; // (a face mask: no nose under it)
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
    const N = 18; // (trail points: the longest legendary trails use them all)
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    const idx = []; for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    tg.setIndex(idx);
    this.trailMesh = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.trailMesh.frustumCulled = false;
    this.pose(0);
    // one smooth, skinned body (torso, neck, arms and legs) in place of the separate parts, built around the joints
    // of a plain standing pose; from here on its bones follow the joints every frame
    { const keep = { onGround: this.onGround, stride: this.stride, walk: this.walk, dashT: this.dashT, hook: this.hook };
      this.onGround = true; this.stride = 0; this.walk = 0; this.dashT = 0; this.hook = null; this.pose(0);
      const mats = [gi, M.skin, pants, M.skinShade];
      this.body = buildBody(this, mats); Object.assign(this, keep);
      this.body.userData.cap = CAP.flesh; this.body.userData.mis = mats.map(regMat); this.body.userData.mi = this.body.userData.mis[0];
      this.group.add(this.body); this.meshes.push(this.body);
      for (const e of [this.p.eyeL, this.p.eyeR]) { const ir = new THREE.Mesh(GEO.sph, M.iris); ir.position.z = -0.78; ir.scale.set(0.55, 0.95, 0.32); e.add(ir); } // (an iris and pupil in each eye)
      for (const n of ['jaw', 'nose', 'pelvis', 'abdomen', 'chest', 'neck', 'uaL', 'uaR', 'faL', 'faR', 'elL', 'elR', 'thL', 'thR', 'shL', 'shR', 'knL', 'knR', 'delL', 'delR']) { const m = this.p[n]; if (m) { this.group.remove(m); this.meshes = this.meshes.filter((x) => x !== m); } }
      this.pose(0); }
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
    this.J ||= {};
    const P = this.p, g = this.group;
    g.position.copy(this.pos); g.rotation.order = 'YXZ'; g.rotation.y = this.yaw;
    // a wall plant: which way the wall is from the body (in its own frame), and which side of the body is against it
    let WL = null, wallSide = 0;
    if (this.planted) { const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), wx = -this.planted.x, wz = -this.planted.z; WL = V(wx * cy - wz * sy, 0, wx * sy + wz * cy); wallSide = WL.x < 0 ? -1 : 1; }
    { // lean with the ground: the body stands square to whatever slope is under its feet (eased, so it doesn't snap)
      const n = this.gN, cy = Math.cos(this.yaw), sy = Math.sin(this.yaw); let a = 0, b = 0;
      if (n && this.alive !== false) { const lx = n.x * cy - n.z * sy, lz = n.x * sy + n.z * cy, l = Math.hypot(lx, n.y, lz) || 1; b = -Math.asin(Math.max(-0.6, Math.min(0.6, lx / l))); a = Math.max(-0.6, Math.min(0.6, Math.atan2(lz, n.y))); }
      const tk = this.tiltK || 0.22; this.tiltA = (this.tiltA || 0) + (a - (this.tiltA || 0)) * tk; this.tiltB = (this.tiltB || 0) + (b - (this.tiltB || 0)) * tk;
      g.rotation.x = this.tiltA; g.rotation.z = this.tiltB; }
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
    const sh = (side) => at(0.22 * side * Math.cos(twist), 0.47, -0.22 * side * Math.sin(twist)); // (broad shoulders)
    P.pelvis.position.copy(P0); P.pelvis.scale.set(0.16, 0.1, 0.11); P.pelvis.rotation.set(0, 0, 0);
    P.skirt.position.set(0, hipY - 0.06, 0.005); P.skirt.scale.set(0.8, 0.3, 0.64); // (just a short band at the hips now: the skirt is split in two, a plate on each thigh that moves with the leg)
    seg(P.abdomen, at(0, 0.0, 0), at(0, 0.2, 0), 0.128, 0.74);
    seg(P.obi, at(0, 0.04, 0), at(0, 0.12, 0), 0.134, 0.78); // (a belt that hugs the waist)
    seg(P.chest, at(0, 0.15, 0), at(0, 0.5, 0), 0.17, 0.6); P.chest.rotateY(twist);
    seg(P.dou, at(0, 0.13, 0), at(0, 0.47, 0), 0.194, 0.67); P.dou.rotateY(twist); // (the chest plate, just proud of the body)
    P.buckle.position.copy(at(0, 0.08, -0.13)); P.buckle.scale.set(0.075, 0.06, 0.03); P.buckle.rotation.set(-lean, 0, 0);
    // the gi's crossed lapels, the obi knot and its tails, and the scabbard thrust through the obi on the left
    seg(P.lapL, at(-0.088, 0.45, -0.088), at(0.03, 0.15, -0.104), 0.05, 0.22); seg(P.lapR, at(0.088, 0.45, -0.09), at(-0.012, 0.22, -0.108), 0.045, 0.22);
    P.obiK.position.copy(at(0, 0.085, 0.118)); P.obiK.scale.set(0.085, 0.06, 0.04); P.obiK.rotation.set(-lean, 0, 0);
    const sw = Math.sin(ph * 2) * 0.03 * k; // the tails swing a little as you run
    seg(P.tailL, at(-0.02, 0.07, 0.125), at(-0.05, -0.15, 0.15 + k * 0.12 + sw), 0.032, 0.3); seg(P.tailR, at(0.025, 0.07, 0.125), at(0.06, -0.11, 0.14 + k * 0.1 - sw), 0.032, 0.3);
    seg(P.saya, at(-0.17, 0.09, -0.16), at(-0.24, -0.22, 0.62), 0.024, 0.75); seg(P.kojiri, at(-0.239, -0.217, 0.6), at(-0.242, -0.226, 0.64), 0.027, 0.75);
    P.collar.position.copy(at(0, 0.45, -0.07)); P.collar.scale.set(0.12, 0.07, 0.03); P.collar.rotation.set(-lean, twist, 0);
    for (const [n, side] of [['L', -1], ['R', 1]]) {
      const S = sh(side);
      P['del' + n].position.copy(S); P['del' + n].scale.set(0.084, 0.076, 0.086);
      P['pad' + n].position.copy(S).add(V(0.035 * side, 0.035, 0)); P['pad' + n].scale.set(0.15, 0.05, 0.21); P['pad' + n].rotation.set(-lean, twist, -0.4 * side);
      P['pad2' + n].rotation.set(-lean, twist, -0.95 * side); P['pad2' + n].position.copy(S).add(V(0.105 * side, -0.035, 0)); P['pad2' + n].scale.set(0.13, 0.045, 0.2); // (a second plate hanging below the first)
    }
    // ---- head
    const neckBase = at(0, 0.5, 0), headC = at(0, 0.68, -0.01);
    Object.assign(this.J, { pelvis: P0.clone(), waist: at(0, 0.15, 0), neckBase: neckBase.clone(), headBase: at(0, 0.62, 0) });
    seg(P.neck, neckBase, at(0, 0.6, 0), 0.05);
    const hp = Math.max(-0.4, Math.min(0.4, this.pitch * 0.5)) - lean * 0.6; // look up/down a little, stay level while leaning
    const H = (x, y, z) => { const cy = Math.cos(hp), sy = Math.sin(hp); return V(x, y * cy + z * sy, -y * sy + z * cy).add(headC); };
    const headRot = (m) => m.rotation.set(hp, 0, 0);
    P.head.position.copy(headC); P.head.scale.set(0.1, 0.122, 0.112); headRot(P.head);
    P.jaw.position.copy(H(0, -0.07, -0.02)); P.jaw.scale.set(0.078, 0.058, 0.082); headRot(P.jaw);
    P.nose.position.copy(H(0, -0.01, -0.112)); P.nose.scale.set(0.024, 0.042, 0.03); headRot(P.nose);
    P.earL.position.copy(H(-0.1, 0, 0.005)); P.earR.position.copy(H(0.1, 0, 0.005));
    P.earL.scale.set(0.013, 0.03, 0.02); P.earR.scale.set(0.013, 0.03, 0.02);
    P.eyeL.position.copy(H(-0.035, 0.0105, -0.0975)); P.eyeR.position.copy(H(0.035, 0.0105, -0.0975)); // (in the sockets: the socket's surface is at z -0.0986, so half of each eye stands out of it)
    P.eyeL.scale.set(0.018, 0.0092, 0.011); P.eyeR.scale.set(0.018, 0.0092, 0.011); headRot(P.eyeL); headRot(P.eyeR);
    P.browL.position.copy(H(-0.035, 0.0345, -0.104)); P.browR.position.copy(H(0.035, 0.0345, -0.104));
    P.browL.scale.set(0.03, 0.006, 0.012); P.browR.scale.set(0.03, 0.006, 0.012); headRot(P.browL); headRot(P.browR); P.browL.rotateZ(-0.14); P.browR.rotateZ(0.14);
    P.hair.position.copy(H(0, 0.004, 0.004)); P.hair.scale.set(0.108, 0.131, 0.12); headRot(P.hair); // (follows the skull, down to a hairline)
    P.band.position.copy(H(0, 0.052, 0.004)); P.band.scale.set(0.104, 0.03, 0.116); headRot(P.band);
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
      if (WL) { // planted on a wall: the leg on the wall's side is drawn up, knee bent at the waist, its foot high on the wall; the other foot is set against the wall lower down
        const near = (sgn < 0 ? -1 : 1) === wallSide;
        foot.set(0.09 * sgn + WL.x * (near ? 0.4 : 0.36), near ? 0.7 : 0.22, WL.z * (near ? 0.4 : 0.36)); toe = near ? 0.25 : -0.2;
      }
      const knee = V();
      ik(hip, foot, THIGH, SHIN, WL ? V(-WL.x * 0.6, 0.5, -WL.z * 0.6 - 0.3) : V(0, 0, -1), knee);
      const Jb = this.J; Jb['hip' + side] = hip.clone(); Jb['knee' + side] = knee.clone(); Jb['foot' + side] = foot.clone(); // (joints, for the skinned body)
      seg(P['th' + side], hip, knee, 0.095); P['kn' + side].position.copy(knee); P['kn' + side].scale.setScalar(0.06);
      seg(P['sh' + side], knee, foot, 0.07);
      seg(P['ky' + side], _a.lerpVectors(knee, foot, 0.22), _b.lerpVectors(knee, foot, 0.86), 0.072); // shin wraps
      const ft = P['ft' + side];
      ft.position.set(foot.x, foot.y - 0.035 + Math.max(0, toe) * 0.05, foot.z - 0.06); ft.scale.set(0.095, 0.065, 0.25); ft.rotation.set(toe, 0, 0);
    }

    // ---- the skirt (kusazuri): seven separate panels of tiered plates hanging from the waist. Each hangs from its own
    // spot on the belt and its lower edge rides on the thigh beneath it, so the panels part and swing with the legs
    { const J = this.J, len = 0.6;
      for (let i = 0; i < 7; i++) { const [th, leg, wd] = KUSA[i], sn = Math.sin(th), cs = Math.cos(th), m = P['ku' + i];
        _ka.set(sn * 0.158, hipY - 0.03, -cs * 0.122); // (where it hangs from)
        if (leg) _kb.lerpVectors(J['hip' + leg], J['knee' + leg], len); else _kb.lerpVectors(J.hipL, J.kneeL, len).add(_kc.lerpVectors(J.hipR, J.kneeR, len)).multiplyScalar(0.5);
        _kb.x += sn * (leg ? 0.115 : 0.02); _kb.z -= cs * (leg ? 0.12 : 0.135); if (!leg) _kb.x = 0; // (out to the surface of the thigh)
        _ky.subVectors(_kb, _ka); const L = _ky.length() || 1e-3; _ky.divideScalar(L); _kx.set(cs, 0, sn).addScaledVector(_ky, -(cs * _ky.x + sn * _ky.z)).normalize();
        boxBasis(m, _kx, _ky, _kc.addVectors(_ka, _kb).multiplyScalar(0.5), wd, L + 0.03, 0.028); } }

    // ---- sword arm
    const d = this.bladeDir(_d.clone());
    const shR = sh(1), shL = sh(-1);
    const hand = V(0.12, 1.3, -0.1).add(R(0, 0, 0).sub(V(0, 0, 0))).addScaledVector(d, 0.44);
    hand.z += -sl * 0.35; hand.y += (hipY - 0.99) * 0.6;
    const el = V();
    ik(shR, hand, UPPER, FORE, V(0.6, -0.7, 0.3), el);
    Object.assign(this.J, { shR: shR.clone(), elR: el.clone(), handR: hand.clone() });
    seg(P.uaR, shR, el, 0.064); P.elR.position.copy(el); P.elR.scale.setScalar(0.046); seg(P.faR, el, hand, 0.052);
    seg(P.wrR, _a.lerpVectors(el, hand, 0.62), _b.lerpVectors(el, hand, 0.97), 0.05); // wrist guard
    seg(P.hR, _b.copy(hand).addScaledVector(d, -0.03), _a.copy(hand).addScaledVector(d, 0.07), 0.05, 0.85);
    // ---- off arm: swings opposite the legs with a bent elbow, or reaches for the grapple
    const sL = Math.sin(ph);
    const handL = V(-0.27, 1.12 + 0.06 * k + (hipY - 0.99), 0.05 + sL * 0.34 * k);
    if (dash) handL.set(-0.36, 1.05, 0.35);
    if (air && !this.hook) handL.set(-0.38, 1.35, -0.1);
    if (WL && !this.hook && wallSide < 0) handL.copy(shL).add(V(WL.x * 0.14, 0.2, WL.z * 0.14)); // (the wall on your left: that arm folds up, its elbow out against the wall)
    else if (WL && !this.hook) handL.copy(shL).add(V(-0.1, -0.2, -0.3)); // (the wall on your right: the left arm hangs free, out for balance)
    if (this.hook) { // reach for the grapple anchor
      g.updateMatrixWorld(true);
      const loc = g.worldToLocal(this.hook.p.clone()).sub(shL).normalize();
      handL.copy(shL).addScaledVector(loc, 0.56);
    }
    const elL = V();
    ik(shL, handL, UPPER, FORE, WL && wallSide < 0 && !this.hook ? V(WL.x, -0.15, WL.z) : V(-0.3, -0.4, 0.6), elL);
    Object.assign(this.J, { shL: shL.clone(), elL: elL.clone(), handL: handL.clone() });
    seg(P.uaL, shL, elL, 0.064); P.elL.position.copy(elL); P.elL.scale.setScalar(0.046); seg(P.faL, elL, handL, 0.052);
    seg(P.wrL, _a.lerpVectors(elL, handL, 0.62), _b.lerpVectors(elL, handL, 0.97), 0.05);
    seg(P.hL, handL, _a.subVectors(handL, elL).normalize().multiplyScalar(0.1).add(handL), 0.05, 0.85);

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
    if (this.body) poseBody(this);
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
    while (T.length && (now - T[0].time > (this.trailStyle.len || 0.12) || T.length > 18)) T.shift();
    const pos = this.trailMesh.geometry.attributes.position, col = this.trailMesh.geometry.attributes.color;
    const st = this.trailStyle, A = _tcA.set(st.a), B = _tcB.set(st.b), n = T.length;
    this.tipSpeed = n > 1 ? T[n - 1].t.distanceTo(T[n - 2].t) / Math.max(0.001, T[n - 1].time - T[n - 2].time) : 0;
    for (let i = 0; i < 18; i++) {
      const e = T[Math.min(i, T.length - 1)] || { h: this.tip, t: this.tip, time: now };
      pos.setXYZ(i * 2, e.h.x, e.h.y, e.h.z); pos.setXYZ(i * 2 + 1, e.t.x, e.t.y, e.t.z);
      let v = 0;
      if (i > 0 && i < T.length) { const sp = T[i].t.distanceTo(T[i - 1].t) / Math.max(0.001, T[i].time - T[i - 1].time); v = Math.min(1, Math.max(0, (sp - 6) / 14)) * (1 - (now - e.time) / (st.len || 0.12)) * 0.8; }
      if (st.fx === 'aurora') { const h = 0.35 + 0.22 * Math.sin(now * 1.6 + i * 0.35); A.setHSL(h, 0.9, 0.35); B.setHSL(h + 0.08, 1, 0.68); } // (greens through cyan to violet, rippling)
      else if (st.fx === 'galaxy') { A.setHSL((0.62 + 0.18 * Math.sin(now * 2 + i * 0.5)) % 1, 1, 0.3); B.setHSL((now * 0.5 + i * 0.09) % 1, 1, 0.72); if (Math.random() < 0.12) B.setRGB(1, 1, 1); } // (deep blue and violet with every colour sparkling through)
      else if (st.fx === 'fire') { const fl = 0.75 + Math.random() * 0.45; A.setRGB(1 * fl, 0.25 * fl, 0); B.setRGB(1, 0.85 * fl, 0.4 * fl); }
      else if (st.fx === 'rainbow') { A.setHSL((now * 0.9 + i * 0.07) % 1, 1, 0.45); B.setHSL((now * 0.9 + i * 0.07) % 1, 1, 0.65); }
      else if (st.fx === 'zap') v *= 0.45 + Math.random() * 0.9; // crackles
      col.setXYZ(i * 2, v * A.r, v * A.g, v * A.b); col.setXYZ(i * 2 + 1, v * B.r, v * B.g, v * B.b);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  }
}
