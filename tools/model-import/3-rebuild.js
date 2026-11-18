// edit the solid (so the result is our own swordsman, not the source figure), then rebuild a light, clean surface from it
const V = window.__V, { nx, ny, nz, h, org } = V, occ = V.occ.slice(), N2 = nx * ny;
const X = (x) => Math.round((x - org[0]) / h), Y = (y) => Math.round((y - org[1]) / h), Z = (z) => Math.round((z - org[2]) / h);
const at = (i, j, k) => occ[i + j * nx + k * N2], set = (i, j, k, v) => { occ[i + j * nx + k * N2] = v; };
const xc = X(0); // (the body's centre plane)
// 1. no head (the game's own head goes on), no hands (the game's own), no cloth tails hanging from the left arm
for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
  const x = org[0] + (i + 0.5) * h, y = org[1] + (j + 0.5) * h, z = org[2] + (k + 0.5) * h;
  if (y > 0.862 || (y > 0.842 && z < -0.04) || Math.abs(x) > 0.385 || (x < -0.125 && y < 0.738 && y > 0.56)) set(i, j, k, 0);
}
// 2. nothing worn at the right hip: between knee and chest, the right side keeps only what the left side also has (mirror test)
for (let j = Y(0.34); j <= Y(0.742); j++) for (let k = 0; k < nz; k++) {
  let ext = 0; for (let i = 0; i < xc; i++) if (at(i, j, k)) { ext = xc - i; break; } // how far the left side reaches in this row
  for (let i = xc + ext + 2; i < nx; i++) set(i, j, k, 0);
}
// 3. the coat below the waist is a thin shell round the legs: fill it in, so it survives as one solid skirt
for (let j = Y(0.222); j <= Y(0.53); j++) {
  const x0 = new Int16Array(nz).fill(-1), x1 = new Int16Array(nz).fill(-1), z0 = new Int16Array(nx).fill(-1), z1 = new Int16Array(nx).fill(-1);
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) if (at(i, j, k)) { if (x0[k] < 0) x0[k] = i; x1[k] = i; if (z0[i] < 0) z0[i] = k; z1[i] = k; }
  for (let k = 0; k < nz; k++) if (x0[k] >= 0) for (let i = x0[k]; i <= x1[k]; i++) if (z0[i] >= 0 && k >= z0[i] && k <= z1[i]) set(i, j, k, 1);
}
// 4. a coarser density grid (each cell: how full its 3 x 3 x 3 block is), softened once
const F = 3, cx = Math.ceil(nx / F) + 2, cy = Math.ceil(ny / F) + 2, cz = Math.ceil(nz / F) + 2, C2 = cx * cy; let D = new Float32Array(cx * cy * cz);
for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (occ[i + j * nx + k * N2]) D[(1 + (i / F | 0)) + (1 + (j / F | 0)) * cx + (1 + (k / F | 0)) * C2] += 1 / 27;
{ const B = new Float32Array(D.length); for (let k = 1; k < cz - 1; k++) for (let j = 1; j < cy - 1; j++) for (let i = 1; i < cx - 1; i++) { const q = i + j * cx + k * C2; B[q] = 0.4 * D[q] + 0.1 * (D[q - 1] + D[q + 1] + D[q - cx] + D[q + cx] + D[q - C2] + D[q + C2]); } D = B; }
const H = h * F, O = [org[0] - 0.5 * H, org[1] - 0.5 * H, org[2] - 0.5 * H]; // (sample q sits at O + index * H)
// 5. surface nets: one point in every cell the surface passes through, joined across every grid edge it crosses
const iso = 0.5, P = [], cellV = new Int32Array(D.length).fill(-1), offs = [0, 1, cx, cx + 1, C2, C2 + 1, C2 + cx, C2 + cx + 1], cpos = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
for (let k = 0; k < cz - 1; k++) for (let j = 0; j < cy - 1; j++) for (let i = 0; i < cx - 1; i++) { const q = i + j * cx + k * C2; let m = 0; for (let c = 0; c < 8; c++) if (D[q + offs[c]] >= iso) m |= 1 << c; if (m === 0 || m === 255) continue;
  let sx = 0, sy = 0, sz = 0, n = 0; for (const [a, b] of edges) { const va = D[q + offs[a]], vb = D[q + offs[b]]; if ((va >= iso) === (vb >= iso)) continue; const t = (iso - va) / (vb - va); sx += cpos[a][0] + (cpos[b][0] - cpos[a][0]) * t; sy += cpos[a][1] + (cpos[b][1] - cpos[a][1]) * t; sz += cpos[a][2] + (cpos[b][2] - cpos[a][2]) * t; n++; }
  cellV[q] = P.length / 3; P.push(O[0] + (i + sx / n) * H, O[1] + (j + sy / n) * H, O[2] + (k + sz / n) * H); }
const I = [], step = [1, cx, C2];
for (let k = 1; k < cz - 1; k++) for (let j = 1; j < cy - 1; j++) for (let i = 1; i < cx - 1; i++) { const q = i + j * cx + k * C2;
  for (let a = 0; a < 3; a++) { const v0 = D[q] >= iso, v1 = D[q + step[a]] >= iso; if (v0 === v1) continue; const b = step[(a + 1) % 3], c = step[(a + 2) % 3];
    const A = cellV[q], B = cellV[q - b], Cc = cellV[q - b - c], Dd = cellV[q - c]; if (A < 0 || B < 0 || Cc < 0 || Dd < 0) continue;
    if (v0) I.push(A, B, Cc, A, Cc, Dd); else I.push(A, Dd, Cc, A, Cc, B); } } // (wound to face outward)
// 6. relax the points a little (keeps the shape, takes the grid steps out)
const pos = new Float32Array(P), idx = new Uint32Array(I), nv = pos.length / 3;
for (let it = 0; it < 2; it++) { const acc = new Float32Array(pos.length), cnt = new Uint16Array(nv);
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) { const a = idx[t + e], b = idx[t + (e + 1) % 3]; acc[a * 3] += pos[b * 3]; acc[a * 3 + 1] += pos[b * 3 + 1]; acc[a * 3 + 2] += pos[b * 3 + 2]; cnt[a]++; }
  for (let v = 0; v < nv; v++) if (cnt[v]) for (let d = 0; d < 3; d++) pos[v * 3 + d] = 0.5 * pos[v * 3 + d] + 0.5 * acc[v * 3 + d] / cnt[v]; }
window.__R = { pos, idx };
return JSON.stringify({ verts: nv, tris: idx.length / 3 });
