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

function fleshTex(T) {
  return T.canvasTex((g, S) => {
    const r = T.rng(909); g.fillStyle = '#93303c'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 2) { const k = 0.5 + 0.5 * Math.sin(y / S * TAU * 6); g.fillStyle = `rgba(${k > 0.6 ? '255,170,170' : '70,10,25'},${Math.abs(k - 0.5) * 0.35})`; g.fillRect(0, y, S, 2); } // ridges, like the roof of a mouth
    for (let i = 0; i < 26; i++) { // veins
      let x = r() * S, y = r() * S; g.strokeStyle = `rgba(${70 + r() * 40 | 0},10,${50 + r() * 40 | 0},${0.35 + r() * 0.3})`; g.lineWidth = 1 + r() * 2.5;
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

export function buildMaw(A, T) {
  const S = A.scene, r = T.rng(31337), low = A.quality === 'low';
  // ---- the maw: one lathed surface, dark down the throat
  const geo = new THREE.LatheGeometry(PROF.map(([x, y]) => new THREE.Vector2(x, y)), low ? 64 : 120);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const k = Math.min(1, Math.max(0.06, (pos.getY(i) + 92) / 52)); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const ft = fleshTex(T); ft.repeat.set(14, 5);
  const maw = new THREE.Group(); S.add(maw);
  const flesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: ft, vertexColors: true, roughness: 0.32, metalness: 0.05, side: THREE.DoubleSide, emissive: 0x2a0408 }));
  flesh.receiveShadow = true; maw.add(flesh);
  // ---- rows of teeth, leaning in toward the throat; the inner rows are the ones that gulp
  const tg = new THREE.ConeGeometry(1, 1, 7); tg.translate(0, 0.5, 0);
  const tm = new THREE.MeshStandardMaterial({ color: 0xf4ead0, roughness: 0.35, metalness: 0.05, emissive: 0x3a3226 });
  const rows = [], mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  for (const [R, h, b] of [[38, 7, 1.3], [57, 9, 1.6], [88, 11, 2.0], [118, 13, 2.4], [150, 16, 2.8], [184, 20, 3.3]]) {
    const n = Math.round(TAU * R / (b * 2.5)), im = new THREE.InstancedMesh(tg, tm, n), grp = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const a = (i + r() * 0.3) / n * TAU, hh = h * (0.75 + r() * 0.5), lean = 0.35 + r() * 0.25;
      e.set(0, -a, 0, 'YXZ'); q.setFromEuler(e); // face the middle...
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), lean); // ...then lean in
      q.multiply(tilt);
      v.set(Math.cos(a) * R, mawY(R) - 1, Math.sin(a) * R); s.set(b, hh, b * 0.8);
      mm.compose(v, q, s); im.setMatrixAt(i, mm);
    }
    im.castShadow = !low; grp.add(im); maw.add(grp); rows.push(grp);
  }
  // ---- smog pooled in the throat, at the height where you die
  const smog = new THREE.Mesh(new THREE.CircleGeometry(50, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4a2a26, transparent: true, opacity: 0.72, depthWrite: false }));
  smog.position.y = A.killY - 2; maw.add(smog);
  // ---- the stands: stone steps from the lip up to an arcaded sandstone wall, three tiers of arches
  const steps = []; let sr = 193, sy = 22; steps.push(new THREE.Vector2(sr, 16));
  for (let i = 0; i < 16; i++) { steps.push(new THREE.Vector2(sr, sy)); sr += 2.6; steps.push(new THREE.Vector2(sr, sy)); sy += 2.4; }
  steps.push(new THREE.Vector2(sr, sy));
  const st = sandTex(T, false); st.repeat.set(40, 3);
  S.add(new THREE.Mesh(new THREE.LatheGeometry(steps, low ? 64 : 120), new THREE.MeshStandardMaterial({ map: st, roughness: 0.9, side: THREE.DoubleSide })));
  const wt = sandTex(T, true); wt.repeat.set(24, 3);
  const wallR = sr + 0.5, wallH = 72, wall = new THREE.Mesh(new THREE.CylinderGeometry(wallR, wallR, wallH, low ? 64 : 120, 1, true), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.9, side: THREE.BackSide }));
  wall.position.y = sy - 2 + wallH / 2; S.add(wall);
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
    rows.forEach((grp, i) => { const k = 1 - g * (0.22 - i * 0.03) + (b - 1); grp.scale.set(k, 1, k); grp.position.y = g * (5 - i * 0.6); });
  });
  // dying: touching the flesh anywhere, or sinking to the smog in the throat
  A.killAt = (p) => Math.max(A.killY, mawY(Math.hypot(p.x, p.z)) + 0.4);
}

// Tendrils: fleshy arms rising from the maw to swing on. Each sways on a spring; a fighter hooked onto one drags its
// tip toward them (so it bends as they swing) and it springs back when they let go. Their hookable boxes follow the bend.
export function buildTendrils(A, pts) {
  const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#6e2233'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 8) { g.fillStyle = 'rgba(30,5,12,0.35)'; g.fillRect(0, y, 128, 2); g.fillStyle = 'rgba(200,110,120,0.18)'; g.fillRect(0, y + 3, 128, 2); } // ringed like a worm
    for (let i = 0; i < 30; i++) { const x = (i * 37) % 128, y = (i * 53) % 128; g.fillStyle = 'rgba(230,160,170,0.55)'; g.beginPath(); g.arc(x, y, 3 + (i % 3), 0, TAU); g.fill(); g.fillStyle = 'rgba(60,10,20,0.7)'; g.beginPath(); g.arc(x, y, 1.5, 0, TAU); g.fill(); } // suckers
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(2, 18); return t; })();
  const list = A.tendrils = [];
  pts.forEach(([x, z], i) => {
    const by = mawY(Math.hypot(x, z)) - 2, top = 62 + ((i * 7) % 5) * 3, H = top - by, R0 = 2.1;
    const geo = new THREE.CylinderGeometry(0.45, R0, H, 12, 40, true); geo.translate(0, H / 2, 0);
    const uB = { value: new THREE.Vector2() };
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.05, emissive: 0x220308 });
    mat.onBeforeCompile = (sh) => { sh.uniforms.uB = uB; sh.uniforms.uH = { value: H };
      sh.vertexShader = 'uniform vec2 uB; uniform float uH;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat ts = clamp(position.y / uH, 0.0, 1.0); transformed.xz += uB * pow(ts, 2.6); transformed.y -= 14.0 * pow(ts, 5.0);'); };
    mat.customProgramCacheKey = () => 'tendril';
    const m = new THREE.Mesh(geo, mat); m.position.set(x, by, z); m.castShadow = A.quality !== 'low'; A.scene.add(m);
    const ph = i * 1.7, dl = Math.hypot(x, z) || 1, inw = dl - 5 - (i % 4) * 2.5, rest = new THREE.Vector2(-x / dl * inw + Math.cos(ph * 2.3) * 2, -z / dl * inw + Math.sin(ph * 1.9) * 2); // (curling right in: the tips hang over the centre platform) // a natural curve at rest
    const boxes = []; for (let s = 0.12; s < 1; s += 0.08) { const b = { x0: 0, x1: 0, y0: by + (s - 0.05) * H, y1: by + (s + 0.05) * H, z0: 0, z1: 0, ts: s, tend: i }; A.rayBoxes.push(b); boxes.push(b); }
    list.push({ x, z, by, H, R0, uB, rest, ph, bend: new THREE.Vector2(), vel: new THREE.Vector2(), boxes });
    A.pillars.push({ x, z, w: 2.8 });
  });
  const tipOff = (t, out) => out.copy(t.rest).add(t.bend).add(new THREE.Vector2(Math.sin((A.lastT || 0) * 0.4 + t.ph) * 3, Math.cos((A.lastT || 0) * 0.33 + t.ph * 1.3) * 3));
  const tmp = new THREE.Vector2();
  const bw = (s) => Math.pow(s, 2.6), dropY = (s) => 14 * Math.pow(s, 5); // (the shape: rising, then hooking in hard over the top, the tip drooping like a claw)
  A.tendrilPoint = (i, s, out) => { const t = list[i]; tipOff(t, tmp); return out.set(t.x + tmp.x * bw(s), t.by + s * t.H - dropY(s), t.z + tmp.y * bw(s)); };
  A.tendrilAt = (p) => { // which tendril (and how far up it) a hook point is on
    for (let i = 0; i < list.length; i++) { const t = list[i]; let s = (p.y - t.by) / t.H; s = (p.y - t.by + dropY(Math.min(1, Math.max(0, s)))) / t.H; if (s < 0 || s > 1) continue; tipOff(t, tmp);
      if (Math.hypot(p.x - (t.x + tmp.x * bw(s)), p.z - (t.z + tmp.y * bw(s))) < t.R0 + 1) return { i, s }; }
    return null;
  };
  const pv = new THREE.Vector3();
  A.tendrilTick = (dt, fighters) => {
    if (!dt) return;
    for (const t of list) { t.fx = 0; t.fz = 0; }
    for (const f of fighters) { const h = f.hook; if (!h || !h.tend) continue; const t = list[h.tend.i]; if (!t) continue; // the rope drags the tip toward whoever hangs on it
      A.tendrilPoint(h.tend.i, h.tend.s, pv); const dx = f.pos.x - pv.x, dz = f.pos.z - pv.z, l = Math.hypot(dx, dz) || 1, k = 28 * h.tend.s;
      t.fx += dx / l * k; t.fz += dz / l * k; }
    for (const t of list) {
      t.vel.x += (-2 * t.bend.x - 1.1 * t.vel.x + t.fx) * dt; t.vel.y += (-2 * t.bend.y - 1.1 * t.vel.y + t.fz) * dt;
      t.bend.x += t.vel.x * dt; t.bend.y += t.vel.y * dt; const l = t.bend.length(); if (l > 12) t.bend.multiplyScalar(12 / l);
      tipOff(t, tmp); t.uB.value.copy(tmp);
      for (const b of t.boxes) { const s = b.ts, cx = t.x + tmp.x * bw(s), cz = t.z + tmp.y * bw(s), cy = t.by + s * t.H - dropY(s), r = t.R0 * (1 - s * 0.75) + 0.3; b.x0 = cx - r; b.x1 = cx + r; b.z0 = cz - r; b.z1 = cz + r; b.y0 = cy - t.H * 0.05; b.y1 = cy + t.H * 0.05; }
    }
    for (const f of fighters) { const h = f.hook; if (h && h.tend) A.tendrilPoint(h.tend.i, h.tend.s, h.p); } // ropes stay attached as it moves
  };
  A.tendrilTick(1e-4, []); // (place the hookable boxes)
  return list;
}
