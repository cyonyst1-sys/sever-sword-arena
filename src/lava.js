// Lava Climb: the inside of a volcano's crater. Lava rises from the bottom; climb a course of floating basalt to the
// summit up top before it reaches you. The course is hops, dash gaps, grapple climbs and rock anchors to swing from, and
// three checkpoint arenas on the way, each under a glowing gate that stays shut for you until you've eliminated enough
// fighters (1, then 2, then 3 kills in all). First to stand on the summit wins; or the last one alive.
import * as THREE from 'three';

const TAU = Math.PI * 2, WALL = 47;
export const LAVA = {
  floors: [0, 36, 80, 124], // the base, then the three checkpoint arenas
  summit: 168, need: [1, 2, 3], gateUp: 10, arenaR: 15,
  /** Height of the lava t seconds into the match: a few seconds' grace, then rising faster and faster. */
  y(t) { const s = Math.max(0, t - 10); return -8 + s * 0.85 + s * s * 0.0045; }, // (the first arena goes under about 50 s in, the summit about 2 min 15 s)
};

export function buildLava(A, T) {
  const S = A.scene, r = T.rng(9191), low = A.quality === 'low';
  A.plats = []; A.pillars = []; A.killY = -40; A.lava = LAVA;
  A.setSky({ top: 0x2a3550, mid: 0x5a3a30, bot: 0x2a0c06, fog: 0x6a3420, near: 80, far: 300, hemiSky: 0xe8d8d0, hemiGround: 0xff7a30, hemi: 1.35, sunColor: 0xffe8d0, sun: 2.6, sunOff: new THREE.Vector3(18, 60, 10) });

  // ---- textures: dark basalt with glowing cracks (the cracks are also the glow map), and the crater's layered rock
  const crackPaths = [];
  const basalt = T.canvasTex((g, s) => {
    const q = T.rng(17); g.fillStyle = '#5a4c44'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 500; i++) { const v = 60 + q() * 60 | 0; g.fillStyle = `rgba(${v + 8},${v},${v - 6},0.55)`; g.beginPath(); g.arc(q() * s, q() * s, 2 + q() * 12, 0, TAU); g.fill(); }
    for (let i = 0; i < 14; i++) { let x = q() * s, y = q() * s, a = q() * TAU; const pts = [[x, y]]; for (let k = 0; k < 9; k++) { a += (q() - 0.5) * 1.3; x += Math.cos(a) * s / 22; y += Math.sin(a) * s / 22; pts.push([x, y]); } crackPaths.push(pts); }
    g.strokeStyle = 'rgba(10,6,4,0.9)'; g.lineWidth = 3; for (const p of crackPaths) { g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
    T.speckle(g, s, q, 5000, 0.2);
  }, 512);
  const cracks = T.canvasTex((g, s) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, s, s); g.lineCap = 'round';
    for (const [w, c] of [[6, 'rgba(255,90,20,0.35)'], [2.2, 'rgba(255,170,60,0.95)']]) { g.strokeStyle = c; g.lineWidth = w; for (const p of crackPaths) { g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); } }
  }, 512);
  cracks.colorSpace = THREE.SRGBColorSpace;
  const rockM = new THREE.MeshStandardMaterial({ map: basalt, roughness: 0.95, emissive: 0xff6a20, emissiveMap: cracks, emissiveIntensity: 1.1 });
  const underM = new THREE.MeshStandardMaterial({ map: basalt, roughness: 1, color: 0xb0a098 });
  const wallTex = T.canvasTex((g, s) => { // the crater wall: bands of rock, streaked with soot, glowing seams low down
    const q = T.rng(23); for (let y = 0; y < s; y += 4) { const v = 78 + 26 * Math.sin(y * 0.05) + q() * 20 | 0; g.fillStyle = `rgb(${v + 10},${v + 2},${v - 4})`; g.fillRect(0, y, s, 4); }
    for (let i = 0; i < 70; i++) { const x = q() * s, w = 2 + q() * 10; g.fillStyle = `rgba(0,0,0,${0.15 + q() * 0.25})`; g.fillRect(x, q() * s * 0.5, w, s * (0.3 + q() * 0.7)); }
    for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(${q() < 0.5 ? '0,0,0' : '160,140,120'},${q() * 0.3})`; g.beginPath(); g.arc(q() * s, q() * s, 1 + q() * 5, 0, TAU); g.fill(); }
  }, 512);
  wallTex.repeat.set(10, 5);

  // ---- the crater wall: a rough cylinder all round (solid, but you can't hook it: the course is the way up)
  {
    const H = 280, g = new THREE.CylinderGeometry(WALL + 1, WALL + 7, H, 96, 40, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.035 * Math.sin(a * 7 + y * 0.05) + 0.025 * Math.sin(a * 17 - y * 0.11) + 0.015 * Math.sin(a * 41 + y * 0.3); p.setX(i, x * k); p.setZ(i, z * k); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1, side: THREE.BackSide, color: 0xe8d0c0, bumpMap: wallTex, bumpScale: 2, emissive: 0x2a0c04 }));
    m.position.y = H / 2 - 40; m.receiveShadow = true; S.add(m);
    for (let k = 0; k < 40; k++) { const a = k / 40 * TAU, a2 = (k + 1) / 40 * TAU, x0 = Math.cos(a) * (WALL + 1.5), z0 = Math.sin(a) * (WALL + 1.5), x1 = Math.cos(a2) * (WALL + 1.5), z1 = Math.sin(a2) * (WALL + 1.5);
      A.boxes.push({ x0: Math.min(x0, x1) - 1.5, x1: Math.max(x0, x1) + 1.5, y0: -60, y1: 240, z0: Math.min(z0, z1) - 1.5, z1: Math.max(z0, z1) + 1.5, noHook: true }); }
  }

  // ---- floating basalt: a hex-ish column top, glowing cracks, a jagged root hanging underneath
  const plats = A.plats;
  const markM = () => new THREE.MeshBasicMaterial({ color: 0xff4a2a, toneMapped: false });
  /** A floating basalt rock: a hex-ish column top with glowing cracks and a jagged root hanging underneath. tilt (radians)
   *  leans its top over toward heading `tdir`: still walkable, just off-camber. Course rocks wear a ring round the
   *  rim, red until you've stood on it, then green. */
  const rock = (x, z, y, R, kind = 'step', tilt = 0, tdir = 0) => {
    const p = { kind, x, z, y, w: 2 * R, d: 2 * R, ang: 0, round: R, i: plats.length, meshes: [], boxes: [], ramps: [], rays: [] };
    plats.push(p);
    const gx = Math.cos(tdir) * Math.tan(tilt), gz = Math.sin(tdir) * Math.tan(tilt), lift = R * Math.tan(tilt);
    const c = { x, z, r: R, y0: y - 2.2 - lift, y1: y }; A.discs.push(c); p.discs = [c];
    if (tilt) { p.bank = true; p.disc = c; c.hf = (qx, qz) => { const dx = qx - x, dz = qz - z; return dx * dx + dz * dz > R * R * 1.02 ? -1e9 : y + dx * gx + dz * gz; }; }
    const k = R * 0.88, box = { x0: x - k, x1: x + k, y0: y - 2.2 - lift, y1: y + lift, z0: z - k, z1: z + k }; A.rayBoxes.push(box); p.rays.push(box);
    const sides = R > 9 ? 14 : 6 + (r() * 3 | 0), top = new THREE.CylinderGeometry(R * 1.04, R * 0.92, 2.2, sides, 2), tp = top.attributes.position;
    for (let i = 0; i < tp.count; i++) if (tp.getY(i) < 1) { tp.setX(i, tp.getX(i) * (0.92 + r() * 0.12)); tp.setZ(i, tp.getZ(i) * (0.92 + r() * 0.12)); }
    const uv = top.attributes.uv; for (let i = 0; i < tp.count; i++) uv.setXY(i, (tp.getX(i) + x) / 9, (tp.getZ(i) + z + tp.getY(i)) / 9);
    top.computeVertexNormals();
    const g = new THREE.Group(); g.position.set(x, y, z); S.add(g); p.meshes.push(g);
    if (tilt) g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-gx, 1, -gz).normalize());
    const m = new THREE.Mesh(top, rockM); m.position.y = -1.1; m.rotation.y = r() * TAU; m.castShadow = m.receiveShadow = true; g.add(m);
    const rootH = R * (1.3 + r() * 1.2), root = new THREE.ConeGeometry(R * 0.9, rootH, sides, 4), rp = root.attributes.position;
    for (let i = 0; i < rp.count; i++) { const yy = rp.getY(i); if (yy < rootH / 2 - 0.1) { rp.setX(i, rp.getX(i) * (0.75 + r() * 0.5) + (r() - 0.5) * 0.4); rp.setZ(i, rp.getZ(i) * (0.75 + r() * 0.5) + (r() - 0.5) * 0.4); } }
    root.rotateX(Math.PI); root.computeVertexNormals();
    const u = new THREE.Mesh(root, underM); u.position.y = -2.2 - rootH / 2; u.rotation.y = r() * TAU; u.castShadow = true; g.add(u);
    if (kind === 'step') { p.mark = new THREE.Mesh(new THREE.TorusGeometry(R * 0.97, 0.13, 6, 40), markM()); p.mark.rotation.x = Math.PI / 2; p.mark.position.y = 0.06; g.add(p.mark); }
    A.node('P' + p.i, x, y, z).plat = p.i;
    return p;
  };
  // a rock anchor hanging in the air to swing from (hookable, not walkable), ringed in gold so it reads from a distance
  const ringM = new THREE.MeshBasicMaterial({ color: 0xffc860, toneMapped: false });
  const anchor = (x, y, z) => {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 0), underM); m.position.set(x, y, z); m.rotation.set(r() * 3, r() * 3, 0); m.castShadow = true; S.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.09, 6, 32), ringM); ring.position.set(x, y, z); ring.rotation.x = Math.PI / 2; S.add(ring);
    A.rayBoxes.push({ x0: x - 1.6, x1: x + 1.6, y0: y - 1.6, y1: y + 1.6, z0: z - 1.6, z1: z + 1.6 }); A.pillars.push({ x, z, w: 3.2 });
    A.anchors.push(new THREE.Vector3(x, y, z));
  };
  A.anchors = [];

  // ---- the base (where everyone starts) and the three checkpoint arenas
  const floors = LAVA.floors.map((y, i) => rock(0, 0, y, i ? LAVA.arenaR : 17, i ? 'arena' : 'base'));
  for (let k = 0; k < 10; k++) { const a = k / 10 * TAU, sp = new THREE.Vector3(Math.cos(a) * 11, 0.05, Math.sin(a) * 11); sp.plat = 0; A.spawns.push(sp); }
  const summit = rock(0, 0, LAVA.summit, 7.5, 'summit');

  // ---- the course between them: a climbing spiral of steps of four kinds
  const KINDS = [['hop', 0.25], ['dash', 0.2], ['climb', 0.35], ['swing', 0.2]]; // (big steps: few rocks, each one counts)
  const pick = () => { let u = r(); for (const [k, w] of KINDS) { if ((u -= w) < 0) return k; } return 'hop'; };
  const fits = (x, z, y, R) => Math.hypot(x, z) + R < WALL - 3 && plats.every((p) => Math.abs(p.y - y) > 5.5 || Math.hypot(p.x - x, p.z - z) > p.round + R + 3);
  let a = r() * TAU, dir = 1, prev = floors[0];
  const course = [];
  A.sections = []; // (the course rocks of each stretch: touch them all to get into the arena, or onto the summit, at its top)
  for (let sec = 0; sec < 4; sec++) {
    const s0 = course.length;
    const target = sec < 3 ? LAVA.floors[sec + 1] : LAVA.summit, base = LAVA.floors[sec];
    // first step: off the floor and (after a checkpoint) up past its gate, to a rock out near the edge
    let y = sec === 0 ? 2.2 : base + LAVA.gateUp + 3, rad = sec === 0 ? 26.5 : 23;
    let p = null;
    for (let t = 0; t < 40 && !p; t++) { const x = Math.cos(a) * rad, z = Math.sin(a) * rad; if (fits(x, z, y, 6)) p = rock(x, z, y, 6); else a += 0.3; }
    if (!p) p = rock(Math.cos(a) * rad, Math.sin(a) * rad, y, 6); // (never leave a section without a way in)
    A.link('P' + prev.i, 'P' + p.i, sec === 0 ? 'walk' : 'swing'); course.push(p); prev = p; // (off the base: a short hop up, close enough to climb)
    while (prev.y < target - 7) {
      let kind = pick(), made = null;
      for (let t = 0; t < 30 && !made; t++) {
        const k = t > 20 ? 'hop' : kind;
        const dy = k === 'hop' ? 2 + r() * 1.5 : k === 'dash' ? r() * 1.5 : k === 'climb' ? 10 + r() * 4 : -1 + r() * 4;
        const dist = k === 'hop' ? 3.5 + r() * 2.5 : k === 'dash' ? 8 + r() * 3 : k === 'climb' ? 2 + r() * 2.5 : 16 + r() * 6; // (the gap, edge to edge)
        const R = k === 'swing' ? 5 + r() * 1.5 : k === 'dash' ? 4 + r() * 2 : 4 + r() * 3;
        const nr = Math.max(16, Math.min(36, rad + (r() - 0.5) * 14)); // (wandering in and out: no neat spiral)
        const na = a + dir * (dist + prev.round + R) / ((rad + nr) / 2);
        const x = Math.cos(na) * nr, z = Math.sin(na) * nr, ny = Math.min(prev.y + dy, target - 3);
        const gap = Math.hypot(x - prev.x, z - prev.z) - prev.round - R; // (the radius wanders, so check the real gap)
        if (gap < 0.8 || gap > dist * 1.25 + 1 || !fits(x, z, ny, R)) { if (t % 6 === 5) dir = -dir; continue; }
        const ah = Math.atan2(z - prev.z, x - prev.x), u = r(); // the way you come in from the last rock: lean the top to face you (far edge up), or to one side; never away
        const tdir = ah + (u < 0.5 ? 0 : u < 0.75 ? Math.PI / 2 : -Math.PI / 2) + (r() - 0.5) * 0.5;
        made = rock(x, z, ny, R, 'step', r() < 0.45 ? 0.2 + r() * 0.25 : 0, tdir); a = na; rad = nr; // (some lean over, off-camber: 11 to 26 degrees)
        if (k === 'swing') { // a rock to swing from, high above the middle of the gap
          const mx = (prev.x + x) / 2, mz = (prev.z + z) / 2, my = Math.max(prev.y, ny) + 11;
          anchor(mx, my, mz);
        }
        A.link('P' + prev.i, 'P' + made.i, 'swing'); // (every step is a jump, dash or swing: never a walk)
      }
      if (!made) break;
      course.push(made); prev = made;
    }
    // last step: in to the arena (or the summit) from a rock just below its edge
    const top = sec < 3 ? floors[sec + 1] : summit, ea = Math.atan2(prev.z, prev.x), er = top.round + 6;
    const lx = Math.cos(ea) * er, lz = Math.sin(ea) * er;
    if (fits(lx, lz, top.y - 3, 3.2)) { const q = rock(lx, lz, top.y - 3, 3.2); A.link('P' + prev.i, 'P' + q.i, 'swing'); prev = q; course.push(q); }
    A.link('P' + prev.i, 'P' + top.i, 'swing'); A.sections.push({ rocks: course.slice(s0).map((q) => q.i), top }); prev = top;
  }

  // ---- a ring of light round each arena (and the summit) that keeps you out until you've stood on every rock of the
  // stretch below it; red while it's shut for you, gone once you've done it
  const barTex = T.canvasTex((g, s) => { const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); g.fillStyle = 'rgba(255,255,255,0.5)'; for (let x = 0; x < s; x += 16) g.fillRect(x, 0, 2, s); }, 128);
  barTex.repeat.set(10, 1);
  A.barriers = A.sections.map((sec, k) => {
    const t = sec.top, R = t.round + 0.8, y0 = t.y - 6, y1 = t.y + 9;
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3a20, map: barTex, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, y1 - y0, 64, 1, true), mat); m.position.set(t.x, (y0 + y1) / 2, t.z); m.renderOrder = 3; S.add(m);
    return { k, x: t.x, z: t.z, R, y0, y1, rocks: sec.rocks, top: t.i, mesh: m };
  });
  /** Show which course rocks the local player has stood on (green) and which barriers are open for them. */
  A.markTouched = (set) => {
    for (const p of plats) if (p.mark) p.mark.material.color.set(set.has(p.i) ? 0x40ff90 : 0xff4a2a);
    for (const b of A.barriers) b.mesh.visible = !b.rocks.every((i) => set.has(i));
  };
  // ---- the summit: a gold rim and a beam of light straight up (you can see where you're going from anywhere)
  { const gold = new THREE.Mesh(new THREE.TorusGeometry(7.6, 0.25, 8, 48), new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 0.8, roughness: 0.3, emissive: 0x6a4000 }));
    gold.rotation.x = Math.PI / 2; gold.position.set(0, LAVA.summit + 0.1, 0); S.add(gold);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.6, 160, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    beam.position.set(0, LAVA.summit + 80, 0); S.add(beam); }

  // ---- the gates: a sheet of light across the whole crater a little above each arena; red while it's shut for you
  A.gates = LAVA.floors.slice(1).map((fy, k) => {
    const y = fy + LAVA.gateUp;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { col: { value: new THREE.Color(0xff3020) }, t: { value: 0 }, a: { value: 1 } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 col; uniform float t, a; varying vec2 vP;
        void main(){ // a hexagonal grid of light that shimmers, brighter at the edges of each cell, plus a soft sheet
          vec2 p = vP * 0.32, R = vec2(1.0, 1.7320508), H = R * 0.5; vec2 c0 = mod(p, R) - H, c1 = mod(p - H, R) - H; vec2 gv = dot(c0, c0) < dot(c1, c1) ? c0 : c1;
          float hd = max(dot(abs(gv), vec2(0.5, 0.8660254)), abs(gv.x)); float e = smoothstep(0.4, 0.49, hd);
          float w = 0.55 + 0.45 * sin(t * 2.0 + length(vP) * 0.25);
          gl_FragColor = vec4(col, a * (0.025 + e * 0.2 * w)); }`,
    });
    const m = new THREE.Mesh(new THREE.CircleGeometry(WALL + 2, 64), mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = 3; S.add(m);
    return { y, floor: fy, need: LAVA.need[k], mesh: m, mat, open: false, fade: 1 };
  });
  /** Show gate k open (green and fading away) or shut (red) for the local player. */
  A.gateVis = (k, open) => { const g = A.gates[k]; if (g.open === open) return; g.open = open; g.mat.uniforms.col.value.set(open ? 0x40ff90 : 0xff3020); };

  // ---- the lava: a glowing, slowly churning sheet, a light that rises with it, and its glow on the crater wall
  const lavaM = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 } }, fog: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float t; varying vec2 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += n(p) * a; p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
      void main(){
        vec2 p = vP * 0.06; vec2 w = vec2(fbm(p + vec2(t * 0.05, 0.0)), fbm(p + vec2(0.0, t * 0.04) + 5.2));
        float f = fbm(p * 1.6 + w * 2.2 + vec2(t * 0.02, -t * 0.03));
        float crust = smoothstep(0.42, 0.62, f); // dark cooled crust floating on bright molten rock
        vec3 hot = mix(vec3(1.0, 0.85, 0.35), vec3(1.0, 0.35, 0.05), smoothstep(0.2, 0.45, f));
        vec3 c = mix(hot, vec3(0.16, 0.05, 0.03), crust);
        c += vec3(1.0, 0.4, 0.1) * 0.25 * (1.0 - crust) * (0.5 + 0.5 * sin(t * 1.5 + f * 12.0));
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const lava = new THREE.Mesh(new THREE.CircleGeometry(WALL + 8, 72), lavaM); lava.rotation.x = -Math.PI / 2; S.add(lava);
  const glow = new THREE.PointLight(0xff6a20, low ? 0 : 900, 70, 1.6); S.add(glow);
  const haze = new THREE.Mesh(new THREE.CylinderGeometry(WALL - 0.5, WALL - 0.5, 26, 64, 1, true), new THREE.MeshBasicMaterial({ color: 0xff5010, transparent: true, opacity: 0.25, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, map: T.canvasTex((g, s) => { const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }, 64) }));
  S.add(haze);
  A.lavaY = LAVA.y(0);
  /** Move the lava to where it is t seconds into the match. */
  A.lavaTick = (t, clock) => {
    const y = LAVA.y(t); A.lavaY = y;
    lava.position.y = y; glow.position.set(0, y + 6, 0); haze.position.y = y + 13;
    lavaM.uniforms.t.value = clock;
    for (const g of A.gates) { g.mat.uniforms.t.value = clock; g.fade += ((g.open ? 0 : 1) - g.fade) * 0.08; g.mat.uniforms.a.value = 0.15 + g.fade * 0.85; g.mesh.visible = g.show !== false && y < g.y + 1; }
  };
  A.killAt = () => A.lavaY;
  A.fallText = () => 'melted in the lava'; A.fallBy = () => 'Melted in the lava';
  A.summitAt = (q) => Math.hypot(q.x, q.z) < 7.6 && q.y > LAVA.summit - 0.3 && q.y < LAVA.summit + 2.5;
  A.summitPos = new THREE.Vector3(0, LAVA.summit, 0);
  A.finishNav();
}
