// voxelise the closed mesh: for every column along z, where the surface crosses it; fill between pairs of crossings
const { pos, idx } = window.__M, h = 0.004, org = [-0.52, -0.012, -0.236], nx = 260, ny = 254, nz = 118;
const cols = new Array(nx * ny); const J1 = 0.37, J2 = 0.61; // (sample points sit off the grid lines, so no ray grazes an edge)
for (let t = 0; t < idx.length; t += 3) {
  const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
  const ax = (pos[a] - org[0]) / h, ay = (pos[a + 1] - org[1]) / h, az = (pos[a + 2] - org[2]) / h, bx = (pos[b] - org[0]) / h, by = (pos[b + 1] - org[1]) / h, bz = (pos[b + 2] - org[2]) / h, cx = (pos[c] - org[0]) / h, cy = (pos[c + 1] - org[1]) / h, cz = (pos[c + 2] - org[2]) / h;
  const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-12) continue;
  const i0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - J1)), i1 = Math.min(nx - 1, Math.floor(Math.max(ax, bx, cx) - J1)), j0 = Math.max(0, Math.ceil(Math.min(ay, by, cy) - J2)), j1 = Math.min(ny - 1, Math.floor(Math.max(ay, by, cy) - J2));
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const px = i + J1, py = j + J2;
    const u = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, v = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den, w = 1 - u - v;
    if (u < 0 || v < 0 || w < 0) continue; const k = i + j * nx; (cols[k] || (cols[k] = [])).push(u * az + v * bz + w * cz); }
}
const occ = new Uint8Array(nx * ny * nz); let odd = 0;
for (let k = 0; k < nx * ny; k++) { const L = cols[k]; if (!L) continue; L.sort((p, q) => p - q); if (L.length & 1) { odd++; continue; }
  for (let m = 0; m < L.length; m += 2) { const z0 = Math.max(0, Math.ceil(L[m] - 0.5)), z1 = Math.min(nz - 1, Math.floor(L[m + 1] - 0.5)); for (let z = z0; z <= z1; z++) occ[k + z * nx * ny] = 1; } }
window.__V = { occ, nx, ny, nz, h, org, at: (i, j, z) => occ[i + j * nx + z * nx * ny] };
// a picture of slices through the solid: horizontal ones at several heights, and a front silhouette count
window.__slices = async (name, ys) => { const S = 2, cv = document.createElement('canvas'); cv.width = nx * S; cv.height = ys.length * (nz * S + 4); const g = cv.getContext('2d'); g.fillStyle = '#223'; g.fillRect(0, 0, cv.width, cv.height);
  ys.forEach((y, r) => { const j = Math.round((y - org[1]) / h); for (let i = 0; i < nx; i++) for (let z = 0; z < nz; z++) if (occ[i + j * nx + z * nx * ny]) { g.fillStyle = '#fd8'; g.fillRect(i * S, r * (nz * S + 4) + (nz - 1 - z) * S, S, S); } g.fillStyle = '#fff'; g.fillText('y=' + y, 4, r * (nz * S + 4) + 12); });
  const b = cv.toDataURL('image/jpeg', 0.8).split(',')[1]; await fetch('http://127.0.0.1:8799/?n=' + name, { method: 'POST', mode: 'no-cors', body: b }); return b.length; };
let filled = 0; for (let k = 0; k < occ.length; k++) filled += occ[k];
return JSON.stringify({ odd, filled, vol: +(filled * h * h * h).toFixed(4) });
