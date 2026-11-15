// Distant scenery shared by every map, all painted once on canvases at load (no image files):
//   - two panoramic mountain ranges around the horizon: ridges, lit and shaded faces, rock strata, snow, forests
//   - a cloud texture on the sea of cloud below (drifting), with a layer of wisps above it
//   - rock texture on the rough rock undersides of the platforms, and on the maps' own far mountain cones
import * as THREE from 'three';

const TAU = Math.PI * 2;
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function tex(c, wrap = true) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const C = (v) => new THREE.Color(v);
const css = (c, a = 1) => `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},${a})`;
const mix = (a, b, t) => a.clone().lerp(b, t);

// per map: rock and tree colours, snow, tree kind
const THEMES = {
  spire: { rock: 0x6b7686, tree: 0x2c4636, snow: true, trees: 'pine' },
  colosseum: { rock: 0x7a7468, tree: 0x34502f, snow: true, trees: 'pine' },
  plateaus: { rock: 0x6b7686, tree: 0x2c4636, snow: true, trees: 'pine' },
  canopy: { rock: 0x58705a, tree: 0x24401f, snow: false, trees: 'broad' },
  pagoda: { rock: 0x4c3860, tree: 0x2a1d38, snow: false, trees: 'pine', retex: true },
  isles: { rock: 0x25345a, tree: 0x111a30, snow: true, snowCol: 0x7d8fbf, trees: 'pine' },
  dojo: { rock: 0x7482a6, tree: 0x46526a, snow: true, trees: 'pine', retex: true },
  city: { rock: 0x8597b2, tree: null, snow: true },
  bamboo: { rock: 0x5a8664, tree: 0x34603e, snow: false, trees: 'broad', retex: true },
  foundry: { rock: 0x34222a, tree: null, snow: false, glow: 0xff7a2a },
  tilt: { rock: 0x8292a8, tree: 0x4c6274, snow: true, trees: 'pine' },
};

// a periodic ridge line (wraps seamlessly round the horizon), normalised to 0..1 with sharp peaks
function ridge(r, W, oct) {
  const terms = []; for (let k = 1; k <= oct; k++) terms.push([k, r() * TAU, (0.4 + r() * 0.6) / Math.pow(k, 1.1), k > 6]);
  const h = new Float32Array(W); let lo = 1e9, hi = -1e9;
  for (let x = 0; x < W; x++) {
    let s = 0; const u = x / W * TAU;
    for (const [k, p, a, rid] of terms) s += rid ? a * (1 - 2 * Math.abs(Math.sin(k * u * 0.5 + p))) : a * Math.sin(k * u + p);
    h[x] = s; lo = Math.min(lo, s); hi = Math.max(hi, s);
  }
  for (let x = 0; x < W; x++) h[x] = Math.pow(Math.max(0, (h[x] - lo) / (hi - lo)), 1.5);
  return h;
}

const Y0 = -130, YH = 290; // every range's canvas spans this world height
function paintRange(th, haze, o, W) {
  const H = W / 4, c = canvas(W, H), g = c.getContext('2d'), r = rng(o.seed);
  const py = (wy) => (Y0 + YH - wy) / YH * H, h = ridge(r, W, o.oct || 40);
  const rock = mix(C(th.rock), haze, o.mix), lit = mix(rock, C(0xffffff), 0.22), dark = mix(rock, C(0x000000), 0.35);
  const top = new Float32Array(W); for (let x = 0; x < W; x++) top[x] = py(o.lo + h[x] * (o.hi - o.lo));
  // the mass of the range, misting into the haze at its feet
  const path = new Path2D(); path.moveTo(0, H); for (let x = 0; x < W; x++) path.lineTo(x, top[x]); path.lineTo(W, top[W - 1]); path.lineTo(W, H); path.closePath();
  const gr = g.createLinearGradient(0, py(o.hi), 0, py(-60)); gr.addColorStop(0, css(rock)); gr.addColorStop(0.55, css(mix(rock, haze, 0.25))); gr.addColorStop(1, css(mix(rock, haze, 0.75)));
  g.fillStyle = gr; g.fill(path);
  g.save(); g.clip(path);
  // lit and shaded faces from the slope of a smoothed ridge, running down the mountain
  const sm = new Float32Array(W); for (let x = 0; x < W; x++) { let s = 0; for (let k = -6; k <= 6; k++) s += top[(x + k + W) % W]; sm[x] = s / 13; }
  for (let x = 0; x < W; x++) {
    const sl = sm[(x + 1) % W] - sm[(x - 1 + W) % W], a = Math.min(0.55, Math.abs(sl) * 0.35), len = H * 0.45;
    const gg = g.createLinearGradient(0, top[x], 0, top[x] + len); gg.addColorStop(0, css(sl < 0 ? lit : dark, a)); gg.addColorStop(1, css(sl < 0 ? lit : dark, 0));
    g.fillStyle = gg; g.fillRect(x, top[x], 1, len);
  }
  // rock strata and gullies
  for (let i = 0; i < W * 0.9; i++) {
    const x = r() * W, y = top[x | 0] + r() * H * 0.5, l = 4 + r() * 22;
    g.strokeStyle = css(r() < 0.6 ? dark : lit, 0.12 + r() * 0.2); g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * l * 0.6, y + l); g.stroke();
  }
  // snow on the peaks, streaking down the gullies
  if (th.snow && o.snow !== undefined) {
    const sl = py(o.snow), snow = mix(C(th.snowCol || 0xf4f6fa), haze, o.mix * 0.6), sh = mix(snow, C(0x7080a0), 0.3);
    for (let x = 0; x < W; x++) {
      if (top[x] > sl) continue;
      const d = (sl - top[x]) * (0.5 + 0.5 * Math.abs(Math.sin(x * 0.11) * Math.sin(x * 0.037 + 1))) + 2;
      const slp = sm[(x + 1) % W] - sm[(x - 1 + W) % W];
      g.fillStyle = css(slp < 0 ? snow : sh, 0.95); g.fillRect(x, top[x], 1, d);
    }
  }
  g.restore();
  // forests on the lower slopes, poking over the low ridgelines
  if (th.trees && o.trees) {
    const tl = py(o.treeLine), tc = mix(C(th.tree), haze, o.mix), tl2 = mix(tc, C(0xffffff), 0.12), list = [];
    for (let i = 0; i < o.trees; i++) {
      const x = r() * W, t0 = Math.max(top[x | 0] + 2, tl), y = t0 + Math.pow(r(), 0.7) * (py(-70) - t0);
      if (y > t0) list.push([x, y, (o.ts || 1) * (0.7 + r() * 0.6)]);
    }
    list.sort((a, b) => a[1] - b[1]);
    for (const [x, y, s] of list) {
      if (th.trees === 'pine') {
        const hh = 11 * s, w = 3.2 * s;
        g.fillStyle = css(tc); g.beginPath(); g.moveTo(x, y - hh); g.lineTo(x + w, y); g.lineTo(x - w, y); g.closePath(); g.fill();
        g.fillStyle = css(tl2, 0.7); g.beginPath(); g.moveTo(x, y - hh); g.lineTo(x - w, y); g.lineTo(x - w * 0.2, y); g.closePath(); g.fill();
      } else {
        g.fillStyle = css(tc); g.beginPath(); g.arc(x, y - 4 * s, 4 * s, 0, TAU); g.arc(x + 3 * s, y - 2.5 * s, 3 * s, 0, TAU); g.arc(x - 3 * s, y - 2.5 * s, 3 * s, 0, TAU); g.fill();
        g.fillStyle = css(tl2, 0.6); g.beginPath(); g.arc(x - 1 * s, y - 5.5 * s, 2 * s, 0, TAU); g.fill();
      }
    }
  }
  // the foundry's hills glow from vents and lava runs
  if (th.glow && o.glowN) {
    const gl = C(th.glow);
    for (let i = 0; i < o.glowN; i++) {
      const x = r() * W, y = top[x | 0] + 8 + r() * (py(-50) - top[x | 0] - 8), rad = 2 + r() * 6;
      const rg = g.createRadialGradient(x, y, 0, x, y, rad * 3); rg.addColorStop(0, css(gl, 0.9)); rg.addColorStop(1, css(gl, 0));
      g.fillStyle = rg; g.fillRect(x - rad * 3, y - rad * 3, rad * 6, rad * 6);
      g.strokeStyle = css(gl, 0.6); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 8, y + 10 + r() * 30); g.stroke();
    }
  }
  return c;
}

function cloudTex(S, r) { // tileable heaped cloud tops: white puffs with soft blue shadows underneath
  const c = canvas(S, S), g = c.getContext('2d'); g.fillStyle = '#d9e1ec'; g.fillRect(0, 0, S, S);
  const puff = (x, y, rad, col) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { const rg = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2); } };
  for (let i = 0; i < 90; i++) { const x = r() * S, y = r() * S, rad = S * (0.04 + r() * 0.1); puff(x + rad * 0.3, y + rad * 0.35, rad * 1.1, 'rgba(105,120,155,0.5)'); puff(x, y, rad, 'rgba(255,255,255,0.9)'); }
  return tex(c);
}
function wispTex(S, r) {
  const c = canvas(S, S), g = c.getContext('2d');
  for (let i = 0; i < 40; i++) { const x = r() * S, y = r() * S, rad = S * (0.05 + r() * 0.12); for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { const rg = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad); rg.addColorStop(0, 'rgba(255,255,255,0.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.save(); g.translate(x + dx, y + dy); g.scale(2.2, 1); g.translate(-x - dx, -y - dy); g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2); g.restore(); } }
  return tex(c);
}
function rockTex(S, r) { // light grey stone with cracks and lichen; multiplied by each material's own colour
  const c = canvas(S, S), g = c.getContext('2d'); g.fillStyle = '#c8c4bc'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) { const x = r() * S, y = r() * S, rad = 6 + r() * 26, v = 150 + r() * 90 | 0; g.fillStyle = `rgba(${v},${v - 4},${v - 10},0.35)`; g.beginPath(); g.ellipse(x, y, rad, rad * 0.6, r() * 3, 0, TAU); g.fill(); }
  for (let i = 0; i < 70; i++) { let x = r() * S, y = r() * S; g.strokeStyle = `rgba(40,36,32,${0.3 + r() * 0.4})`; g.lineWidth = 1 + r(); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 22; y += r() * 16; g.lineTo(x, y); } g.stroke(); }
  for (let i = 0; i < 50; i++) { g.fillStyle = `rgba(150,170,110,${0.15 + r() * 0.2})`; g.beginPath(); g.arc(r() * S, r() * S, 3 + r() * 9, 0, TAU); g.fill(); }
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.12 * r()})`; g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
  return tex(c);
}
function slopeTex(S, r, th) { // for the maps' own far mountain cones: forest at the foot, bare rock above, light at the top
  const c = canvas(S, S), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, S);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#d8d8d8'); gr.addColorStop(1, '#9a9a9a'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 500; i++) { const x = r() * S, y = r() * S, l = 6 + r() * 30; g.strokeStyle = `rgba(${r() < 0.6 ? '60,60,70' : '255,255,255'},${0.15 + r() * 0.2})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 8, y + l); g.stroke(); }
  if (th.trees) for (let i = 0; i < 900; i++) { const x = r() * S, y = S * 0.62 + Math.pow(r(), 0.6) * S * 0.38, s = 2 + r() * 3; g.fillStyle = `rgba(60,70,60,${0.5 + r() * 0.3})`; g.beginPath(); g.moveTo(x, y - s * 2.6); g.lineTo(x + s, y); g.lineTo(x - s, y); g.fill(); }
  return tex(c);
}

export function addScenery(A) {
  const th = THEMES[A.mapId] || THEMES.spire, S = A.scene, low = A.quality === 'low', r = rng(777 + A.mapId.length * 31);
  const haze = A.realScene.fog ? A.realScene.fog.color.clone() : C(0xa9cbe6), W = low ? 1024 : 2048, k = W / 2048;
  // two ranges: a tall hazy one far back, a nearer forested one in front
  const ranges = [
    { R: 508, seed: 11, lo: -30, hi: 155, mix: 0.62, oct: 30, snow: 70, rep: 2, order: -3 },
    { R: 478, seed: 23, lo: -55, hi: 88, mix: 0.32, oct: 44, snow: 52, rep: 3, trees: 5200 * k, treeLine: 38, ts: k, glowN: 45 * k, order: -2 },
  ];
  for (const o of ranges) {
    const t = tex(paintRange(th, haze, o, W), false); t.wrapS = THREE.RepeatWrapping; t.repeat.set(o.rep, 1);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(o.R, o.R, YH, 96, 1, true), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.BackSide, fog: false }));
    m.position.y = Y0 + YH / 2; m.rotation.y = r() * TAU; m.renderOrder = o.order; S.add(m);
  }
  // the sea of cloud (or the forest floor) far below, the maps' far mountains, and rough rock undersides
  const clouds = cloudTex(low ? 256 : 512, r), rockMap = rockTex(256, r), slope = th.retex ? slopeTex(256, r, th) : null, seas = [];
  A.root.traverse((o) => {
    if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
    const g = o.geometry, m = o.material, p = g.parameters || {};
    if (g.type === 'CircleGeometry' && p.radius >= 400) {
      if (m.isMeshStandardMaterial) { o.scale.setScalar(1.35); m.map = rockMap.clone(); m.map.needsUpdate = true; m.map.repeat.set(60, 60); m.color.multiplyScalar(1.6); m.needsUpdate = true; return; } // the canopy's forest floor
      if (m.opacity < 0.5) return;
      m.map = clouds; m.needsUpdate = true; seas.push(o);
    } else if (m.isMeshStandardMaterial && m.flatShading && !m.map) { m.map = rockMap; m.emissive = m.color.clone().multiplyScalar(0.35); m.emissiveMap = rockMap; m.needsUpdate = true; }
    else if (slope && m.isMeshBasicMaterial && !m.map && m.fog === false && (g.type === 'ConeGeometry' || g.type === 'CylinderGeometry') && (p.height || 0) > 50) { m.map = slope; m.color.lerp(haze, 0.3); m.needsUpdate = true; }
  });
  clouds.repeat.set(9, 9);
  const wisps = low ? null : wispTex(256, r); if (wisps) wisps.repeat.set(5, 5);
  for (const sea of seas) if (wisps) {
    const w = new THREE.Mesh(sea.geometry, new THREE.MeshBasicMaterial({ map: wisps, color: sea.material.color, transparent: true, opacity: 0.8, depthWrite: false, fog: sea.material.fog }));
    w.position.copy(sea.position); w.position.y += 7; S.add(w);
  }
  if (seas.length) A.anim.push((t, dt) => { clouds.offset.x += dt * 0.0015; clouds.offset.y += dt * 0.0006; if (wisps) { wisps.offset.x -= dt * 0.004; wisps.offset.y += dt * 0.0015; } });
}
