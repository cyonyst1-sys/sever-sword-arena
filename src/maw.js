// Colosseum: the arena hangs inside the open mouth of a giant creature. Its fleshy maw funnels down to a smoky throat
// under the arena, ringed with rows of teeth, and its lips stretch out and up to the stands of an old sandstone
// colosseum built around it. Fall in and it gulps (touch the flesh and you're dead; in the throat, at the smog).
import * as THREE from 'three';

const TAU = Math.PI * 2;
// the maw's profile: (radius, height) from the bottom of the throat out to the curled lip
const PROF = [[0.5, -96], [14, -93], [26, -82], [36, -64], [46, -50], [62, -40], [85, -29], [110, -17], [135, -3], [155, 9], [170, 21], [181, 28], [189, 28], [194, 21], [196, 10]];
export function mawY(r) { // the flesh's height at distance r from the middle (outside the lip: none)
  if (r >= 189) return -Infinity;
  for (let i = 1; i < PROF.length; i++) if (r <= PROF[i][0]) { const [r0, y0] = PROF[i - 1], [r1, y1] = PROF[i]; return y0 + (y1 - y0) * (r - r0) / (r1 - r0); }
  return -Infinity;
}

function fleshTex(T, soft) { // (soft: the folds are sculpted, so no painted ribs: mottled wet tissue with fine wrinkles running along the folds)
  return T.canvasTex((g, S) => {
    const r = T.rng(909); g.fillStyle = soft ? '#a8243c' : '#5a0e22'; g.fillRect(0, 0, S, S);
    if (soft) {
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '30,0,20' : '190,50,80'},${0.08 + r() * 0.14})`; g.beginPath(); g.ellipse(r() * S, r() * S, 10 + r() * 50, 4 + r() * 14, 0, 0, TAU); g.fill(); } // mottling
      for (let i = 0; i < 220; i++) { const y = r() * S, x = r() * S, w = 20 + r() * 120; g.strokeStyle = `rgba(${r() < 0.6 ? '20,0,10' : '255,170,190'},${0.1 + r() * 0.22})`; g.lineWidth = 0.6 + r() * 1.4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y + (r() - 0.5) * 6, x + w, y + (r() - 0.5) * 4); g.stroke(); } // fine wrinkles
    } else
    for (let y = 0; y < S; y += 2) { const k = 0.5 + 0.5 * Math.sin(y / S * TAU * 10); g.fillStyle = `rgba(${k > 0.7 ? '255,150,170' : '30,0,14'},${Math.abs(k - 0.5) * (k > 0.7 ? 0.55 : 0.6)})`; g.fillRect(0, y, S, 2); } // deep glossy ribs, ring after ring down the throat
    for (let i = 0; i < 26; i++) { // veins
      let x = r() * S, y = r() * S; g.strokeStyle = `rgba(${60 + r() * 40 | 0},10,${70 + r() * 50 | 0},${0.35 + r() * 0.3})`; g.lineWidth = 1 + r() * 2.5;
      g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 9; k++) { x += (r() - 0.5) * 34; y += (r() - 0.3) * 26; g.lineTo(x, y); } g.stroke();
    }
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,235,235,${r() * 0.35})`; g.fillRect(r() * S, r() * S, 1 + r() * 2, 1); } // wet glints
  }, 256);
}
function sandTex(T, arches) { // sandstone blocks; with arches: an arcade (dark openings between half columns), cornices top and bottom
  return T.canvasTex((g, S) => {
    const r = T.rng(arches ? 77 : 78); g.fillStyle = '#cfae7c'; g.fillRect(0, 0, S, S);
    const bh = S / 24;
    for (let y = 0; y < 24; y++) for (let x = -(y % 2) * 0.5; x < 8; x++) { const v = 190 + r() * 40 | 0; g.fillStyle = `rgb(${v},${v * 0.82 | 0},${v * 0.58 | 0})`; g.fillRect(x * S / 8 + 1, y * bh + 1, S / 8 - 2, bh - 2); }
    if (arches) {
      for (const cx of [S * 0.25, S * 0.75]) { // two arches per tile
        const w = S * 0.26, top = S * 0.3, bot = S * 0.86;
        g.fillStyle = '#e2c79a'; g.fillRect(cx - w / 2 - 8, top - w / 2 - 8, w + 16, bot - top + w / 2 + 8); // arch surround
        const gr = g.createLinearGradient(0, top - w / 2, 0, bot); gr.addColorStop(0, '#2a1d14'); gr.addColorStop(1, '#4a3424');
        g.fillStyle = gr; g.beginPath(); g.moveTo(cx - w / 2, bot); g.lineTo(cx - w / 2, top); g.arc(cx, top, w / 2, Math.PI, 0); g.lineTo(cx + w / 2, bot); g.fill();
        g.fillStyle = '#d8bb8a'; g.fillRect(cx - 7, top - w / 2 - 10, 14, 14); // keystone
      }
      for (const px of [0, S * 0.5, S]) { g.fillStyle = '#e6cfa6'; g.fillRect(px - 9, S * 0.1, 18, S * 0.8); g.fillStyle = 'rgba(80,55,30,0.35)'; g.fillRect(px + 5, S * 0.1, 4, S * 0.8); } // half columns
      for (const y of [0, S * 0.9]) { g.fillStyle = '#e8d2aa'; g.fillRect(0, y, S, S * 0.07); g.fillStyle = 'rgba(70,45,25,0.4)'; g.fillRect(0, y + S * 0.07, S, 4); } // cornices
    }
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(90,65,40,${0.08 + r() * 0.12})`; g.fillRect(r() * S, r() * S * 0.5, 2 + r() * 5, 20 + r() * 80); } // weathering streaks
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.1 * r()})`; g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
  }, 512);
}
// the stands at night: dark stone blocks; with arches, an arcade lit from inside with violet lamps. glow: the same
// pattern as a glow map (black but for the lamps and the light spilling from the arches)
function nightTex(T, arches, glow) {
  return T.canvasTex((g, S) => {
    const r = T.rng(arches ? 177 : 178);
    g.fillStyle = glow ? '#15121a' : '#24222c'; g.fillRect(0, 0, S, S); // (glow: the stone itself shows faintly, as if lit by all the fires)
    if (!glow) { const bh = S / 24; for (let y = 0; y < 24; y++) for (let x = -(y % 2) * 0.5; x < 8; x++) { const v = 84 + r() * 48 | 0; g.fillStyle = `rgb(${v + 8},${v},${v + 6})`; g.fillRect(x * S / 8 + 1, y * bh + 1, S / 8 - 2, bh - 2); } }
    if (arches) {
      for (const cx of [S * 0.25, S * 0.75]) { // two arches per tile
        const w = S * 0.26, top = S * 0.3, bot = S * 0.86;
        if (!glow) { g.fillStyle = '#3a3644'; g.fillRect(cx - w / 2 - 8, top - w / 2 - 8, w + 16, bot - top + w / 2 + 8); }
        const gr = g.createRadialGradient(cx, top, 2, cx, top + w * 0.15, w * 0.75); // (a dark recess with one violet lamp hanging in its crown)
        if (glow) { gr.addColorStop(0, 'rgba(220,150,255,0.95)'); gr.addColorStop(0.3, 'rgba(120,50,200,0.4)'); gr.addColorStop(1, 'rgba(20,0,40,0)'); }
        else { gr.addColorStop(0, '#5a3486'); gr.addColorStop(0.4, '#22123a'); gr.addColorStop(1, '#0a0612'); }
        g.fillStyle = gr; g.beginPath(); g.moveTo(cx - w / 2, bot); g.lineTo(cx - w / 2, top); g.arc(cx, top, w / 2, Math.PI, 0); g.lineTo(cx + w / 2, bot); g.fill();
        g.fillStyle = glow ? '#f4e0ff' : '#e8d0ff'; g.beginPath(); g.arc(cx, top + 4, 5, 0, TAU); g.fill(); // the lamp
      }
      if (!glow) { for (const px of [0, S * 0.5, S]) { g.fillStyle = '#34303e'; g.fillRect(px - 9, S * 0.1, 18, S * 0.8); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(px + 5, S * 0.1, 4, S * 0.8); } // half columns
        for (const y of [0, S * 0.9]) { g.fillStyle = '#3e3a48'; g.fillRect(0, y, S, S * 0.07); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, y + S * 0.07, S, 4); } } // cornices
    }
    if (glow && arches) for (const px of [0, S * 0.5, S]) { const gr = g.createRadialGradient(px, S * 0.52, 2, px, S * 0.56, S * 0.13); gr.addColorStop(0, 'rgba(255,170,80,0.75)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.fillRect(px - S * 0.14, S * 0.4, S * 0.28, S * 0.32); } // (torchlight on the stone round each torch)
    if (glow) { for (let i = 0; i < 26; i++) { const x = r() * S, y = r() * S; if (arches && y > S * 0.15 && y < S * 0.86 && (Math.abs(x - S * 0.25) < S * 0.15 || Math.abs(x - S * 0.75) < S * 0.15)) continue; g.fillStyle = 'rgba(190,120,255,0.9)'; g.beginPath(); g.arc(x, y, 1.5 + r() * 1.5, 0, TAU); g.fill(); } return; } // little violet lights all over the stonework
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(0,0,0,${0.1 + r() * 0.15})`; g.fillRect(r() * S, r() * S * 0.5, 2 + r() * 5, 20 + r() * 80); } // soot streaks
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.08 * r()})`; g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
  }, 512);
}

export function buildMaw(A, T) {
  const S = A.scene, r = T.rng(31337), low = A.quality === 'low';
  // ---- the maw: one lathed surface, sculpted into thick wet folds, ring after ring down to the throat (dark down there).
  // The folds are real shape, not paint: the profile is cut fine and every point pushed in or out along the surface, a
  // crease then a crown every few metres, wandering a little as they go round. Creases are shaded darker.
  const env = (A.colo && A.colo.env) || null, seg = low ? 64 : 96;
  const prof = [], arc = [], nrm = [];
  { let s = 0;
    for (let i = 1; i < PROF.length; i++) { const [r0, y0] = PROF[i - 1], [r1, y1] = PROF[i], L = Math.hypot(r1 - r0, y1 - y0), n = low ? 1 : Math.max(1, Math.round(L / 0.8));
      for (let k = i === 1 ? 0 : 1; k <= n; k++) { const t = k / n; prof.push(new THREE.Vector2(r0 + (r1 - r0) * t, y0 + (y1 - y0) * t)); arc.push(s + L * t); nrm.push([-(y1 - y0) / L, (r1 - r0) / L]); }
      s += L; } }
  const geo = new THREE.LatheGeometry(prof, seg), nP = prof.length;
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let idx = 0; idx < pos.count; idx++) {
    const j = idx % nP, phi = ((idx / nP) | 0) / seg * TAU, s = arc[j]; let f = 1;
    if (!low) { const wob = 0.13 * Math.sin(phi * 6 + s * 0.07) + 0.08 * Math.sin(phi * 13 - s * 0.11);
      f = Math.pow(Math.abs(Math.sin(Math.PI * (s / 5.6 + wob))), 0.5); // (0 down in a crease, 1 on the crown of a fold)
      const d = (j === 0 ? 0 : 0.5 + 1.3 * Math.min(1, s / 60)) * (f - 0.62), pr = Math.max(0.2, prof[j].x + nrm[j][0] * d);
      pos.setXYZ(idx, pr * Math.sin(phi), prof[j].y + nrm[j][1] * d, pr * Math.cos(phi)); }
    const k = Math.min(1, Math.max(0.06, (prof[j].y + 92) / 52)), c = low ? 1 : 0.16 + 0.84 * Math.pow(f, 1.6); col[idx * 3] = k * c; col[idx * 3 + 1] = k * c * c * 0.9; col[idx * 3 + 2] = k * Math.pow(c, 1.5); // (creases near black, deep red sides, crowns paler and pinker where the light catches)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  { const nr = geo.attributes.normal, last = seg * nP; for (let j = 0; j < nP; j++) nr.setXYZ(last + j, nr.getX(j), nr.getY(j), nr.getZ(j)); } // (no seam where the ring closes)
  const ft = fleshTex(T, !low); ft.repeat.set(low ? 14 : 22, low ? 5 : 36);
  const maw = new THREE.Group(); S.add(maw);
  const flesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: ft, bumpMap: ft, bumpScale: low ? 3 : 1.6, vertexColors: true, roughness: 0.15, metalness: 0.1, side: THREE.DoubleSide, emissive: 0x1c0216, envMap: env, envMapIntensity: 1.1 }));
  flesh.receiveShadow = true; maw.add(flesh);
  // ---- rows of spikes, chrome and needle-thin, leaning in toward the throat; the inner rows are the ones that gulp
  const tg = new THREE.ConeGeometry(1, 1, 10); tg.translate(0, 0.5, 0);
  const tm = new THREE.MeshStandardMaterial({ color: 0xf2f4fa, roughness: 0.22, metalness: 0.6, emissive: 0x34343e, envMap: env, envMapIntensity: 2.2 });
  // they wiggle: each spike sways and writhes like a feeler, rooted at its base and bending more toward its tip, every
  // one on its own rhythm (done in the shader, so thousands of them cost nothing extra)
  const uT = { value: 0 }; A.anim.push((t) => { uT.value = t; });
  tm.onBeforeCompile = (sh) => { sh.uniforms.uT = uT; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    #ifdef USE_INSTANCING
      float wph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23, wb = position.y * position.y;
      transformed.x += wb * (sin(uT * 1.7 + wph) * 1.5 + sin(uT * 3.3 + wph * 1.7) * 0.7);
      transformed.z += wb * (cos(uT * 1.4 + wph * 1.3) * 1.5 + sin(uT * 2.9 + wph * 0.6) * 0.7);
    #endif`); };
  tm.customProgramCacheKey = () => 'mawspike';
  const rows = [], mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  for (const [R, h, b] of [[24, 6, 0.9], [38, 7, 1.1], [47, 8, 1.2], [57, 9, 1.3], [72, 10, 1.5], [88, 11, 1.7], [103, 12, 1.8], [118, 13, 2.0], [134, 14, 2.2], [150, 16, 2.4], [167, 18, 2.6], [184, 20, 2.8]]) {
    const n = Math.round(TAU * R / (b * 2.5)), im = new THREE.InstancedMesh(tg, tm, n), grp = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const a = (i + r() * 0.3) / n * TAU, hh = h * (0.75 + r() * 0.5), lean = 0.35 + r() * 0.25;
      e.set(0, -a, 0, 'YXZ'); q.setFromEuler(e); // face the middle...
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), lean); // ...then lean in
      q.multiply(tilt);
      v.set(Math.cos(a) * R, mawY(R) - 1, Math.sin(a) * R); s.set(b * 0.55, hh * 1.25, b * 0.55);
      mm.compose(v, q, s); im.setMatrixAt(i, mm);
    }
    im.castShadow = !low; grp.add(im); maw.add(grp); rows.push(grp);
  }
  // ---- smog pooled in the throat, at the height where you die
  const smog = new THREE.Mesh(new THREE.CircleGeometry(50, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x14061e, transparent: true, opacity: 0.85, depthWrite: false }));
  smog.position.y = A.killY - 2; maw.add(smog);
  // ---- rings of glowing violet runes round the throat
  const runeT = T.canvasTex((g, s) => { const q = T.rng(66); g.fillStyle = '#000'; g.fillRect(0, 0, s, s); g.strokeStyle = '#d9a8ff'; g.lineCap = 'round'; g.shadowColor = '#a050ff'; g.shadowBlur = 8;
    for (let k = 0; k < 16; k++) { const x0 = k * s / 16 + 6, w = s / 16 - 12; g.lineWidth = 2.5 + q() * 1.5; g.beginPath(); // a glyph: a few strokes in a little box
      for (let j = 0; j < 4; j++) { const a = [x0 + q() * w, s * 0.2 + q() * s * 0.6], b = [x0 + q() * w, s * 0.2 + q() * s * 0.6]; g.moveTo(a[0], a[1]); if (q() < 0.4) g.arc(a[0], a[1], 3 + q() * 5, 0, TAU); else g.lineTo(b[0], b[1]); } g.stroke(); }
  }, 512);
  runeT.repeat.set(5, 1); runeT.wrapT = THREE.ClampToEdgeWrapping;
  const runeM = new THREE.MeshBasicMaterial({ map: runeT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, color: 0xd8a0ff, fog: false });
  for (const [r0, r1] of [[51.5, 59], [17, 25]]) { const pts = []; for (let k = 0; k <= 4; k++) { const rr = r0 + (r1 - r0) * k / 4; pts.push(new THREE.Vector2(rr - 0.8, mawY(rr) + 1.6)); } // (one round the lip of the pit, above the smog; one deep in the throat)
    const band = new THREE.Mesh(new THREE.LatheGeometry(pts, low ? 48 : 96), runeM); band.renderOrder = 2; maw.add(band); }
  A.anim.push((t) => { runeM.opacity = 0.75 + 0.25 * Math.sin(t * 1.3); });
  // ---- light and air: a violet glow welling up out of the pit, cold blue light hanging over the arena floor, and
  // blue mist lying against the foot of the stands (two soft bands of haze that turn slowly)
  const soft = (inner, c0, c1) => T.canvasTex((g, s) => { const d = g.createRadialGradient(s / 2, s / 2, s * inner, s / 2, s / 2, s / 2); d.addColorStop(0, c0); d.addColorStop(0.75, c1); d.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = d; g.fillRect(0, 0, s, s); }, 256);
  const add = (map, color, opacity, side = THREE.DoubleSide) => new THREE.MeshBasicMaterial({ map, color, opacity, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side, toneMapped: false });
  const pitGlow = new THREE.Mesh(new THREE.CircleGeometry(56, 48).rotateX(-Math.PI / 2), add(soft(0.12, 'rgba(60,10,120,0.0)', 'rgba(170,70,255,0.9)'), 0xffffff, 0.28)); pitGlow.position.y = A.killY - 1.5; maw.add(pitGlow); // (dark in the middle, glowing round its rim)
  if (!low) {
    const pit = new THREE.PointLight(0xa040ff, 380, 200, 1.5); pit.position.set(0, -60, 0); S.add(pit);
    const cold = new THREE.PointLight(0x4a8cff, 320, 95, 1.6); cold.position.set(0, 17, 0); S.add(cold);
    const mistT = T.canvasTex((g, s) => { const q = T.rng(88); g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 90; i++) { const x = q() * s, y = s * (0.45 + q() * 0.55), R = s * (0.08 + q() * 0.16); for (const ox of [-s, 0, s]) { const d = g.createRadialGradient(x + ox, y, 0, x + ox, y, R); d.addColorStop(0, `rgba(255,255,255,${0.1 + q() * 0.14})`); d.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = d; g.fillRect(x + ox - R, y - R, R * 2, R * 2); } } // drifts of it, thick low down
      const f = g.createLinearGradient(0, 0, 0, s); f.addColorStop(0, 'rgba(0,0,0,1)'); f.addColorStop(0.5, 'rgba(0,0,0,0.3)'); f.addColorStop(0.9, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,0.6)'); g.fillStyle = f; g.fillRect(0, 0, s, s); }, 512); // (fading out upward)
    const bands = [];
    for (const [R, y0, y1, c, o, rep] of [[189, 6, 84, 0x3f74ff, 0.55, 5], [128, -34, 30, 0x6a4cff, 0.3, 4]]) {
      const tx = mistT.clone(); tx.repeat.set(rep, 1); tx.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, y1 - y0, 64, 1, true), add(tx, c, o, THREE.BackSide)); m.position.y = (y0 + y1) / 2; m.renderOrder = 3; S.add(m); bands.push(tx);
    }
    A.anim.push((t) => { bands[0].offset.x = t * 0.004; bands[1].offset.x = -t * 0.006; });
  }
  // ---- the stands: dark stone steps from the lip up to an arcaded wall, three tiers of arches lit violet from inside
  const steps = []; let sr = 193, sy = 22; steps.push(new THREE.Vector2(sr, 16));
  for (let i = 0; i < 16; i++) { steps.push(new THREE.Vector2(sr, sy)); sr += 2.6; steps.push(new THREE.Vector2(sr, sy)); sy += 2.4; }
  steps.push(new THREE.Vector2(sr, sy));
  const st = nightTex(T, false); st.repeat.set(40, 3);
  S.add(new THREE.Mesh(new THREE.LatheGeometry(steps, low ? 64 : 120), new THREE.MeshStandardMaterial({ map: st, roughness: 0.75, side: THREE.DoubleSide })));
  const wt = nightTex(T, true), wg = nightTex(T, true, true); wt.repeat.set(24, 3); wg.repeat.set(24, 3);
  const wallR = sr + 0.5, wallH = 72, wall = new THREE.Mesh(new THREE.CylinderGeometry(wallR, wallR, wallH, low ? 64 : 120, 1, true), new THREE.MeshStandardMaterial({ map: wt, bumpMap: wt, bumpScale: 1.5, roughness: 0.8, side: THREE.BackSide, emissive: 0xffffff, emissiveMap: wg, emissiveIntensity: 1.6 }));
  wall.position.y = sy - 2 + wallH / 2; S.add(wall);
  { // torches burning on the half columns of the lower two tiers, and blood-red banners hanging from the top one
    const fireT = T.canvasTex((g, s) => { const gr = g.createRadialGradient(s / 2, s * 0.7, 0, s / 2, s * 0.6, s * 0.5); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.3, 'rgba(255,170,60,0.95)'); gr.addColorStop(0.65, 'rgba(255,80,20,0.4)'); gr.addColorStop(1, 'rgba(200,30,0,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(s / 2, 0); g.bezierCurveTo(s * 0.9, s * 0.5, s * 0.85, s, s / 2, s); g.bezierCurveTo(s * 0.15, s, s * 0.1, s * 0.5, s / 2, 0); g.fill(); }, 128);
    // (all the flames are one set of points and all the brackets one instanced mesh: two draws for the lot)
    const fm = new THREE.PointsMaterial({ map: fireT, size: 8, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }), fp = [];
    const brk = new THREE.MeshStandardMaterial({ color: 0x18161c, metalness: 0.7, roughness: 0.5 }), brkG = new THREE.CylinderGeometry(0.5, 0.25, 1.4, 8);
    const tierH = wallH / 3, top = sy - 2 + wallH, brks = new THREE.InstancedMesh(brkG, brk, 144); let nb = 0;
    for (let j = 0; j < 48; j++) for (const k of [0, 1, 2]) { if ((low && j % 2) || (k === 0 && j % 3 === 0)) continue; // (not behind a banner)
      const th = j / 48 * TAU, R = wallR - 1.2, y = top - (k + 1) * tierH + tierH * 0.42, x = Math.sin(th) * R, z = Math.cos(th) * R;
      mm.makeTranslation(x, y - 1.2, z); brks.setMatrixAt(nb++, mm); fp.push(x, y + 1.6, z); }
    brks.count = nb; S.add(brks);
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); S.add(new THREE.Points(fg, fm));
    A.anim.push((t) => { fm.size = 8 + Math.sin(t * 9) * 0.6 + Math.sin(t * 23) * 0.4; });
    const banT = T.canvasTex((g, s) => { g.fillStyle = '#7a0e16'; g.fillRect(0, 0, s, s * 2); const gr = g.createLinearGradient(0, 0, s, 0); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.5, 'rgba(255,80,80,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
      g.strokeStyle = '#e8c8b0'; g.lineWidth = 6; g.strokeRect(10, 10, s - 20, s - 20); // a pale border, and a sigil: a ring, a blade through it, two horns
      g.beginPath(); g.arc(s / 2, s * 0.42, s * 0.18, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(s / 2, s * 0.15); g.lineTo(s / 2, s * 0.78); g.stroke();
      g.beginPath(); g.moveTo(s * 0.26, s * 0.2); g.quadraticCurveTo(s * 0.3, s * 0.4, s * 0.42, s * 0.36); g.moveTo(s * 0.74, s * 0.2); g.quadraticCurveTo(s * 0.7, s * 0.4, s * 0.58, s * 0.36); g.stroke(); }, 256);
    const banM = new THREE.MeshStandardMaterial({ map: banT, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x2a0306 });
    for (let j = 0; j < 16; j++) { const th = (j * 3) / 48 * TAU, R = wallR - 0.8, x = Math.sin(th) * R, z = Math.cos(th) * R;
      const g = new THREE.PlaneGeometry(7, 18, 1, 6), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getY(i) * 0.4 + j) * 0.25); g.computeVertexNormals(); // (a gentle ripple)
      const m = new THREE.Mesh(g, banM); m.position.set(x, top - 13, z); m.rotation.y = Math.atan2(-Math.sin(th), -Math.cos(th)); S.add(m); }
  }
  { // a crumbling top: blocks of uneven height along the rim
    const n = 140, im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: st, roughness: 0.9 }), n);
    for (let i = 0; i < n; i++) { const a = i / n * TAU, hh = 2 + r() * 9 * (r() < 0.4 ? 1 : 0.3); mm.compose(v.set(Math.cos(a) * (wallR + 1.5), sy - 2 + wallH + hh / 2, Math.sin(a) * (wallR + 1.5)), q.setFromEuler(e.set(0, -a, 0)), s.set(4, hh, TAU * wallR / n + 0.2)); im.setMatrixAt(i, mm); }
    S.add(im);
  }
  // ---- breathing, and the gulp when someone falls in
  let gulp = -9;
  A.chomp = (p) => { gulp = A.lastT || 0; };
  A.fallText = () => 'was swallowed by the maw'; A.fallBy = () => 'Swallowed by the maw';
  A.anim.push((t) => {
    const b = 1 + Math.sin(t * 0.7) * 0.012; flesh.scale.set(b, 1, b);
    const u = t - gulp, g = u >= 0 && u < 1.1 ? Math.sin(Math.min(1, u / 1.1) * Math.PI) * (u < 0.25 ? u / 0.25 : 1) : 0;
    rows.forEach((grp, i) => { const k = 1 - g * Math.max(0, 0.22 - i * 0.017) + (b - 1); grp.scale.set(k, 1, k); grp.position.y = g * Math.max(0, 5 - i * 0.4); });
  });
  // dying: touching the flesh anywhere, or sinking to the smog in the throat
  A.killAt = (p) => Math.max(A.killY, mawY(Math.hypot(p.x, p.z)) + 0.4);
}

// Tendrils: fleshy arms rising from the maw to swing on. Each sways on a spring; a fighter hooked onto one drags its
// tip toward them (so it bends as they swing) and it springs back when they let go. Their hookable boxes follow the bend.
const DROP = 6, SPIKE = 26; // how far the arm curls down before its elbow (m), and the length of the spiked limb below it
// Fleshy arms rising out of the maw. Each rises, sweeps in over the arena and ends in an elbow, and from the elbow a
// long, skinny, needle-sharp limb (with thorns along it) angles down toward the fighting. Hook one anywhere (the arm
// or the limb) and it swings toward you and sags under your weight; let go and it springs back and wobbles.
export function buildTendrils(A, pts) {
  // dark plum hide, ringed like a worm, with rows of glowing violet glyph-marks down it (glow: the marks alone)
  const mk = (glow) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = glow ? '#000' : '#3a1238'; g.fillRect(0, 0, 128, 128);
    if (!glow) for (let y = 0; y < 128; y += 8) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, y, 128, 2); g.fillStyle = 'rgba(170,90,200,0.2)'; g.fillRect(0, y + 3, 128, 2); }
    g.strokeStyle = glow ? '#e0a8ff' : '#b070e0'; g.lineWidth = 2; g.lineCap = 'round';
    for (let y = 10; y < 128; y += 42) for (const x0 of [20]) { g.beginPath(); for (let j = 0; j < 2; j++) { const x = x0 + j * 16 + ((y * 7 + j * 13) % 6); g.moveTo(x, y); g.lineTo(x + ((j + y) % 3 - 1) * 4, y + 7); if ((j + y) % 2) { g.moveTo(x - 3, y + 3); g.lineTo(x + 3, y + 3); } } g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(2, 18); return t; };
  const tex = mk(false), glowTex = mk(true);
  // the limb: dark glossy chitin, a knobbly joint, pale bone thorns, and a needle tip
  const chitin = new THREE.MeshStandardMaterial({ color: 0x1c0a20, roughness: 0.15, metalness: 0.6, emissive: 0x120206, envMap: (A.colo && A.colo.env) || null, envMapIntensity: 1.2 });
  const bone = new THREE.MeshStandardMaterial({ color: 0xf2f4fa, roughness: 0.22, metalness: 0.6, emissive: 0x34343e, envMap: (A.colo && A.colo.env) || null, envMapIntensity: 2.2 });
  const limbGeo = new THREE.CylinderGeometry(0.05, 0.95, SPIKE, 10, 6).translate(0, SPIKE / 2, 0); // (thick at the elbow, y = 0, tapering to a needle at y = SPIKE; aimed each frame)
  const thornGeo = new THREE.ConeGeometry(0.28, 2.4, 6).translate(0, 1.2, 0);
  const jointGeo = new THREE.SphereGeometry(1.9, 14, 10);
  const list = A.tendrils = [];
  pts.forEach(([x, z], i) => {
    const by = mawY(Math.hypot(x, z)) - 2, top = 70 + ((i * 7) % 5) * 4, H = top - by, R0 = 2.5;
    const geo = new THREE.CylinderGeometry(1.7, R0, H, 14, 48, false); geo.translate(0, H / 2, 0);
    const uB = { value: new THREE.Vector2() }, uS = { value: 0 };
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.16, metalness: 0.3, emissive: 0xffffff, emissiveMap: glowTex, emissiveIntensity: 1.0, envMap: (A.colo && A.colo.env) || null, envMapIntensity: 1.0 });
    mat.onBeforeCompile = (sh) => { sh.uniforms.uB = uB; sh.uniforms.uS = uS; sh.uniforms.uH = { value: H };
      // bend the straight tube along its curve (rising, sweeping in, curling down a little to the elbow, sagging under
      // weight); each ring of the tube turned square to the curve so it stays round, normals turned with it
      sh.vertexShader = 'uniform vec2 uB; uniform float uH, uS;\n' + sh.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float ts = clamp(position.y / uH, 0.0, 1.0);
        vec3 Bd = length(uB) > 0.001 ? normalize(vec3(uB.x, 0.0, uB.y)) : vec3(1.0, 0.0, 0.0), Sd = vec3(-Bd.z, 0.0, Bd.x);
        float bwp = 2.6 * pow(max(ts, 0.0001), 1.6) / uH, dpp = (${DROP.toFixed(1)} * 4.0 * pow(ts, 3.0) + uS * 2.6 * pow(max(ts, 0.0001), 1.6)) / uH;
        vec3 Tg = normalize(vec3(uB.x * bwp, 1.0 - dpp, uB.y * bwp)), Nd = normalize(cross(Tg, Sd));
        objectNormal = normalize(Sd * dot(objectNormal.xz, Sd.xz) + Nd * dot(objectNormal.xz, Bd.xz) + Tg * objectNormal.y);`).replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 cen = vec3(uB.x * pow(ts, 2.6), ts * uH - ${DROP.toFixed(1)} * pow(ts, 4.0) - uS * pow(ts, 2.6), uB.y * pow(ts, 2.6));
        transformed = cen + Sd * dot(position.xz, Sd.xz) + Nd * dot(position.xz, Bd.xz);`); };
    mat.customProgramCacheKey = () => 'tendril2';
    const m = new THREE.Mesh(geo, mat); m.position.set(x, by, z); m.castShadow = A.quality !== 'low'; m.frustumCulled = false; A.scene.add(m); // (always drawn: it's bent in the shader, so its own bounds would hide it wrongly)
    // the elbow and the limb (moved and aimed every frame)
    const limb = new THREE.Group(); A.scene.add(limb);
    const joint = new THREE.Mesh(jointGeo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.16, metalness: 0.3, emissive: 0xffffff, emissiveMap: glowTex, emissiveIntensity: 1.0, envMap: (A.colo && A.colo.env) || null, envMapIntensity: 1.0 })); joint.scale.set(1, 0.85, 1); limb.add(joint);
    const lm = new THREE.Mesh(limbGeo, chitin); lm.castShadow = A.quality !== 'low'; limb.add(lm);
    for (let k = 0; k < 5; k++) { // thorns along the limb, raking back up toward the joint
      const u = 0.2 + k * 0.15, th = new THREE.Mesh(thornGeo, bone), a = k * 2.2;
      th.position.set(Math.cos(a) * 0.95 * (1 - u) * 0.9, u * SPIKE, Math.sin(a) * 0.95 * (1 - u) * 0.9);
      th.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); th.rotateX(-0.5); th.scale.setScalar(1.2 - u * 0.6); limb.add(th);
    }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 3, 6).translate(0, 1.5, 0), bone); tip.position.y = SPIKE - 0.5; limb.add(tip); // a pale needle point
    const ph = i * 1.7, dl = Math.hypot(x, z) || 1, inw = dl - 6 - (i % 4) * 5, rest = new THREE.Vector2(-x / dl * inw + Math.cos(ph * 2.3) * 2, -z / dl * inw + Math.sin(ph * 1.9) * 2);
    const boxes = []; for (let s = 0.12; s < 1.95; s += s < 1 ? 0.08 : 0.2) { const b = { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0, ts: s, tend: i }; A.rayBoxes.push(b); boxes.push(b); }
    list.push({ x, z, by, H, R0, uB, uS, rest, ph, bend: new THREE.Vector2(), vel: new THREE.Vector2(), sag: 0, sagV: 0, boxes, limb, dir: new THREE.Vector3(0, -1, 0) });
    { const s = 0.55, k = Math.pow(s, 2.6); A.pillars.push({ x: x + rest.x * k, z: z + rest.y * k, w: 2.8 }); } // (for the bots: aim at the middle of its curve, not its base)
  });
  const tipOff = (t, out) => { const c = A.lastT || 0; return out.copy(t.rest).add(t.bend).add(new THREE.Vector2(Math.sin(c * 0.45 + t.ph) * 3.5 + Math.sin(c * 1.2 + t.ph * 2.1) * 1.2, Math.cos(c * 0.4 + t.ph * 1.3) * 3.5 + Math.cos(c * 1.05 + t.ph * 0.7) * 1.2)); }; // (a slow, gentle writhe)
  const tmp = new THREE.Vector2(), _e = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  const bw = (s) => Math.pow(s, 2.6), dropY = (s) => DROP * Math.pow(s, 4);
  // a point on tendril i: s from 0 (its root) to 1 (the elbow), then on to 2 (the limb's needle tip)
  const point = (t, s, out) => {
    tipOff(t, tmp);
    if (s <= 1) return out.set(t.x + tmp.x * bw(s), t.by + s * t.H - dropY(s) - t.sag * bw(s), t.z + tmp.y * bw(s));
    point(t, 1, _e); return out.copy(_e).addScaledVector(t.dir, (s - 1) * SPIKE);
  };
  A.tendrilPoint = (i, s, out) => point(list[i], s, out);
  const rad = (t, s) => (s <= 1 ? t.R0 * (1 - s * 0.32) : 1.1 * (2 - s) + 0.2);
  const _p = new THREE.Vector3();
  A.tendrilAt = (p) => { // which tendril (and how far along it) a hook point is on: the nearest point on any of them, if it's close
    let best = null, bd = Infinity;
    for (let i = 0; i < list.length; i++) { const t = list[i];
      if (Math.hypot(p.x - t.x, p.z - t.z) > t.H * 2 + SPIKE + 40) continue;
      for (let s = 0; s <= 2.001; s += s < 1 ? 0.02 : 0.05) { point(t, s, _p); const d = _p.distanceTo(p) - rad(t, s); if (d < bd) { bd = d; best = { i, s: Math.min(s, 1.95) }; } } }
    return bd < 1.6 ? best : null;
  };
  const pv = new THREE.Vector3();
  A.tendrilTick = (dt, fighters) => {
    if (!dt) return;
    for (const t of list) { t.fx = 0; t.fz = 0; t.fy = 0; }
    for (const f of fighters) { const h = f.hook; if (!h || !h.tend) continue; const t = list[h.tend.i]; if (!t) continue; // whoever hangs on it drags it their way, and pulls it down
      point(t, h.tend.s, pv); const dx = f.pos.x - pv.x, dz = f.pos.z - pv.z, l = Math.hypot(dx, dz) || 1, lev = Math.min(1.3, h.tend.s), k = 40 * lev, rl = t.rest.length() || 1;
      point(t, 1, _e); const el = Math.hypot(_e.x, _e.z) || 1, kc = 45 * lev * Math.min(1, el / 12); t.fx -= _e.x / el * kc; t.fz -= _e.z / el * kc; // (it folds toward the middle of the arena, not past it)
      point(t, h.tend.s, pv);
      t.fx += dx / l * k; t.fz += dz / l * k; t.fy += 55 * lev + Math.max(0, pv.y - f.pos.y) * 1.2 * lev; } // (and down under your weight)
    for (const t of list) {
      t.vel.x += (-0.8 * t.bend.x - 0.55 * t.vel.x + t.fx) * dt; t.vel.y += (-0.8 * t.bend.y - 0.55 * t.vel.y + t.fz) * dt; // (soft and springy)
      t.bend.x += t.vel.x * dt; t.bend.y += t.vel.y * dt; const l = t.bend.length(); if (l > 40) t.bend.multiplyScalar(40 / l);
      t.sagV += (-1.0 * t.sag - 0.65 * t.sagV + t.fy) * dt; t.sag = Math.max(-4, Math.min(48, t.sag + t.sagV * dt));
      tipOff(t, tmp); t.uB.value.copy(tmp); t.uS.value = t.sag;
      // the limb: from the elbow, angled down and on in toward the middle, swinging back as the arm is dragged
      const L = Math.hypot(tmp.x, tmp.y) || 1; t.dir.set(tmp.x / L * 0.42 - t.vel.x * 0.02, -1, tmp.y / L * 0.42 - t.vel.y * 0.02).normalize();
      point(t, 1, _e); t.limb.position.copy(_e); t.limb.quaternion.setFromUnitVectors(_up, t.dir);
      for (const b of t.boxes) { point(t, b.ts, pv); const r = rad(t, b.ts) + 0.3, hh = b.ts < 1 ? t.H * 0.05 : SPIKE * 0.12; b.x0 = pv.x - r; b.x1 = pv.x + r; b.z0 = pv.z - r; b.z1 = pv.z + r; b.y0 = pv.y - Math.max(r, hh); b.y1 = pv.y + Math.max(r, hh); }
    }
    for (const f of fighters) { const h = f.hook; if (h && h.tend) point(list[h.tend.i], h.tend.s, h.p); } // ropes stay attached as it moves
  };
  // the spiked limbs are deadly: touch one (anywhere below its first stretch) and it runs you through
  const _s0 = new THREE.Vector3(), _s1 = new THREE.Vector3(), _c = new THREE.Vector3();
  A.spikeAt = (q, slack = 0) => {
    _c.set(q.x, q.y + 1.0, q.z);
    for (const t of list) {
      point(t, 1, _s0); _s0.addScaledVector(t.dir, SPIKE * 0.3); _s1.copy(_s0).addScaledVector(t.dir, SPIKE * 0.7);
      if (Math.abs(_c.x - _s0.x) > SPIKE && Math.abs(_c.z - _s0.z) > SPIKE) continue;
      const ab = _e.subVectors(_s1, _s0), u = Math.max(0, Math.min(1, _c.clone().sub(_s0).dot(ab) / ab.lengthSq())), d = _c.distanceTo(_s0.clone().addScaledVector(ab, u));
      if (d < 0.55 + 0.75 * (1 - u) + slack) return true;
    }
    return false;
  };
  { const ft = A.fallText, fb = A.fallBy; A.fallText = (q) => (A.spikeAt(q, 1.5) ? 'was impaled on a tendril' : ft ? ft(q) : 'fell'); A.fallBy = (q) => (A.spikeAt(q, 1.5) ? 'Impaled on a tendril' : fb ? fb(q) : 'Fell'); }
  A.tendrilTick(1e-4, []); // (place the hookable boxes)
  return list;
}
