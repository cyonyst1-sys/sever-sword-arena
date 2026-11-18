// fit the rebuilt figure to the game's skeleton: bone weights, a warp into the game's own T-pose and proportions,
// a material for every triangle, then pack it all into one small binary file
const pos = window.__R.pos.slice(), idx = window.__R.idx, nv = pos.length / 3, S = 1.87;
// the lines where one material meets the next: points close to one move onto it, so the borders run straight
for (let v = 0; v < nv; v++) { const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], ax = Math.abs(x);
  for (const yb of [0.165, 0.214, 0.515, 0.6]) if (Math.abs(y - yb) < 0.006 && y < 0.7) pos[v * 3 + 1] = yb;
  if (y > 0.7 && Math.abs(ax - 0.272) < 0.006) pos[v * 3] = Math.sign(x) * 0.272;
  if (z < 0 && y > 0.6 && y < 0.84) { const w = 0.006 + (y - 0.6) * 0.16; if (Math.abs(ax - w) < 0.005) pos[v * 3] = (x >= 0 ? 1 : -1) * w; } }
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const BONES = ['hips', 'spine', 'neck', 'uaR', 'faR', 'uaL', 'faL', 'thR', 'shnR', 'thL', 'shnL', 'ftR', 'ftL'], BI = Object.fromEntries(BONES.map((n, i) => [n, i]));
// joints: M in the figure (its own units), G in the game's T-pose (metres). axis: the way each bone runs; k: how much thicker across
const side = (sg) => ({ M: { sh: [0.135 * sg, 0.778, 0.006], el: [0.26 * sg, 0.778, 0.006], hand: [0.375 * sg, 0.778, 0.006], hip: [0.052 * sg, 0.5, 0.004], knee: [0.054 * sg, 0.265, 0.004], foot: [0.058 * sg, 0.045, 0.004] },
  G: { sh: [0.22 * sg, 1.46, 0], el: [0.519 * sg, 1.46, 0], hand: [0.798 * sg, 1.46, 0], hip: [0.095 * sg, 0.93, 0], knee: [0.095 * sg, 0.47, 0], foot: [0.095 * sg, 0.01, 0] } });
const Rr = side(1), Ll = side(-1), up = [0, 1, 0], dn = [0, -1, 0];
const MAP = {
  hips: [[0, 0.53, 0], [0, 0.61, 0], [0, 0.99, 0], [0, 1.14, 0], up, 1], spine: [[0, 0.61, 0], [0, 0.815, 0], [0, 1.14, 0], [0, 1.49, 0], up, 1], neck: [[0, 0.815, 0], [0, 0.862, 0], [0, 1.49, 0], [0, 1.61, 0], up, 1],
  uaR: [Rr.M.sh, Rr.M.el, Rr.G.sh, Rr.G.el, [1, 0, 0], 1.12], faR: [Rr.M.el, Rr.M.hand, Rr.G.el, Rr.G.hand, [1, 0, 0], 1.12], uaL: [Ll.M.sh, Ll.M.el, Ll.G.sh, Ll.G.el, [-1, 0, 0], 1.12], faL: [Ll.M.el, Ll.M.hand, Ll.G.el, Ll.G.hand, [-1, 0, 0], 1.12],
  thR: [Rr.M.hip, Rr.M.knee, Rr.G.hip, Rr.G.knee, dn, 1], shnR: [Rr.M.knee, Rr.M.foot, Rr.G.knee, Rr.G.foot, dn, 1], thL: [Ll.M.hip, Ll.M.knee, Ll.G.hip, Ll.G.knee, dn, 1], shnL: [Ll.M.knee, Ll.M.foot, Ll.G.knee, Ll.G.foot, dn, 1],
  ftR: [Rr.M.foot, null, Rr.G.foot, null, dn, 1], ftL: [Ll.M.foot, null, Ll.G.foot, null, dn, 1],
};
const mapBone = (b, p) => { const [Ma, Mz, Ga, Gz, d, k] = MAP[b], r = [p[0] - Ma[0], p[1] - Ma[1], p[2] - Ma[2]];
  if (!Mz) return [Ga[0] + r[0] * S, Ga[1] + r[1] * S, Ga[2] + r[2] * S];
  const t = r[0] * d[0] + r[1] * d[1] + r[2] * d[2], lm = Math.abs((Mz[0] - Ma[0]) * d[0] + (Mz[1] - Ma[1]) * d[1] + (Mz[2] - Ma[2]) * d[2]), lg = Math.hypot(Gz[0] - Ga[0], Gz[1] - Ga[1], Gz[2] - Ga[2]), ax = t * lg / lm;
  return [Ga[0] + d[0] * ax + (r[0] - t * d[0]) * S * k, Ga[1] + d[1] * ax + (r[1] - t * d[1]) * S * k, Ga[2] + d[2] * ax + (r[2] - t * d[2]) * S * k]; };
const weights = (x, y) => { const ax = Math.abs(x), R = x > 0, w = {}, add = (b, v) => { if (v > 1e-4) w[b] = (w[b] || 0) + v; };
  const a = y > 0.7 ? ss(0.105, 0.165, ax) * ss(0.7, 0.74, y) : 0; // how much of an arm this point is
  if (a > 0) { const f = ss(0.235, 0.285, ax); add(R ? 'uaR' : 'uaL', a * (1 - f)); add(R ? 'faR' : 'faL', a * f); }
  const t = 1 - a; if (t > 0) { const n = ss(0.8, 0.835, y), sp = ss(0.53, 0.63, y), low = t * (1 - n) * (1 - sp), lg = 1 - ss(0.4, 0.53, y);
    add('neck', t * n); add('spine', t * (1 - n) * sp); add('hips', low * (1 - lg));
    const r = ss(-0.035, 0.035, x), sh = 1 - ss(0.195, 0.225, y), ft = 1 - ss(0.04, 0.08, y); // (the coat's skirt hangs from the thighs; below its hem, shins; at the bottom, feet)
    add('hips', low * lg * (1 - sh) * 0.45); // (the skirt swings a little over half as far as the legs under it)
    for (const [s2, q0] of [['R', r], ['L', 1 - r]]) { const q = low * lg * q0; add('th' + s2, q * (1 - sh) * 0.55); add('shn' + s2, q * sh * (1 - ft)); add('ft' + s2, q * sh * ft); } }
  return w; };
const P2 = new Float32Array(pos.length), SI = new Uint8Array(nv * 4), SW = new Uint8Array(nv * 4);
for (let v = 0; v < nv; v++) { const p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]], w = Object.entries(weights(p[0], p[1])).sort((a, b) => b[1] - a[1]).slice(0, 4), tot = w.reduce((s, e) => s + e[1], 0);
  let ox = 0, oy = 0, oz = 0, left = 255; w.forEach(([b, wt], i) => { const q = mapBone(b, p), f = wt / tot; ox += q[0] * f; oy += q[1] * f; oz += q[2] * f; const byte = i === w.length - 1 ? left : Math.round(f * 255); left -= byte; SI[v * 4 + i] = BI[b]; SW[v * 4 + i] = Math.max(0, byte); });
  P2[v * 3] = ox; P2[v * 3 + 1] = oy; P2[v * 3 + 2] = oz; }
// materials: 0 coat, 1 sash, 2 under-robe (the V at the chest), 3 skin, 4 trousers, 5 boots
const G = [[], [], [], [], [], []];
for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2], x = (pos[a * 3] + pos[b * 3] + pos[c * 3]) / 3, y = (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c * 3 + 1]) / 3, z = (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c * 3 + 2]) / 3, ax = Math.abs(x);
  const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2], vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, down = ny < -0.75 * Math.hypot(nx, ny, nz);
  const m = y < 0.165 ? 5 : y < 0.214 || (y < 0.26 && down) ? 4 : y > 0.7 && ax >= 0.272 ? 3 : y > 0.828 && ax < 0.06 ? 3 : z < 0 && y > 0.6 && y < 0.84 && ax < 0.006 + (y - 0.6) * 0.16 ? 2 : y > 0.515 && y < 0.6 && ax < 0.2 ? 1 : 0;
  G[m].push(a, b, c); }
const I2 = new Uint16Array(idx.length), groups = []; let o = 0; for (const g of G) { groups.push([o, g.length]); I2.set(g, o); o += g.length; }
window.__G = { pos: P2, idx: I2, groups, SI, SW, BONES };
// the file: 'SVM1', counts, groups, positions (float32), bone indices and weights (bytes), triangle indices (uint16)
const head = 16 + groups.length * 8, size = head + nv * 12 + nv * 8 + I2.length * 2, buf = new ArrayBuffer(size + (size & 1)), dv = new DataView(buf);
dv.setUint32(0, 0x314d5653, true); dv.setUint32(4, nv, true); dv.setUint32(8, I2.length, true); dv.setUint32(12, groups.length, true); groups.forEach(([s0, c0], i) => { dv.setUint32(16 + i * 8, s0, true); dv.setUint32(20 + i * 8, c0, true); });
new Float32Array(buf, head, nv * 3).set(P2); new Uint8Array(buf, head + nv * 12, nv * 4).set(SI); new Uint8Array(buf, head + nv * 16, nv * 4).set(SW); new Uint8Array(buf, head + nv * 20, I2.length * 2).set(new Uint8Array(I2.buffer));
window.__BIN = new Uint8Array(buf);
return JSON.stringify({ nv, tris: I2.length / 3, groups: groups.map((g) => g[1] / 3), bytes: buf.byteLength });
