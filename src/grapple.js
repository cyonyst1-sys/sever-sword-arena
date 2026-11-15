// Grapple styles from the shop: the line from your hand to where the hook bit, and the hook's head.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3(), _m = new THREE.Vector3();
const _w = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _mx = new THREE.Matrix4();

// patterned lines (drawn once, tiled along the rope)
const texCache = {};
function lineTex(kind) {
  if (texCache[kind]) return texCache[kind];
  const c = document.createElement('canvas'); c.width = 32; c.height = 64; const g = c.getContext('2d');
  if (kind === 'chain') { // two links per tile
    g.fillStyle = '#2a2d31'; g.fillRect(0, 0, 32, 64);
    g.strokeStyle = '#b8bec6'; g.lineWidth = 5;
    g.beginPath(); g.ellipse(16, 16, 9, 14, 0, 0, 7); g.stroke();
    g.fillStyle = '#d4d9df'; g.fillRect(12, 34, 8, 28);
  } else if (kind === 'vine') {
    g.fillStyle = '#3f7f32'; g.fillRect(0, 0, 32, 64);
    g.fillStyle = '#2c5e24'; for (let y = 0; y < 64; y += 16) { g.save(); g.translate(16, y); g.rotate(0.6); g.fillRect(-16, -2, 32, 4); g.restore(); }
    g.fillStyle = '#6cc04a'; g.beginPath(); g.ellipse(8, 40, 6, 3, 0.8, 0, 7); g.fill();
  } else if (kind === 'scales') {
    g.fillStyle = '#7a5410'; g.fillRect(0, 0, 32, 64);
    for (let row = 0; row < 5; row++) for (let i = -1; i < 3; i++) {
      const x = i * 16 + (row % 2) * 8, y = row * 14;
      const gr = g.createRadialGradient(x + 8, y + 4, 1, x + 8, y + 6, 11); gr.addColorStop(0, '#ffe08a'); gr.addColorStop(1, '#b07e1c');
      g.fillStyle = gr; g.beginPath(); g.arc(x + 8, y + 4, 9, 0, Math.PI); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return (texCache[kind] = t);
}

// hook heads, built pointing along +y (into whatever they bit)
function makeHead(kind) {
  const g = new THREE.Group();
  const S = (o) => new THREE.MeshStandardMaterial(o), G = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); g.add(m); return m; };
  if (kind === 'claw') add(new THREE.OctahedronGeometry(0.12, 0), S({ color: 0x9aa4ae, metalness: 0.8, roughness: 0.3 }));
  else if (kind === 'hook') {
    const iron = S({ color: 0x5a5f66, metalness: 0.85, roughness: 0.35 });
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), iron, 0, -0.1);
    for (const s of [1, -1]) add(new THREE.TorusGeometry(0.11, 0.025, 6, 12, Math.PI), iron, 0.11 * s, 0.05, 0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2);
  } else if (kind === 'leaf') {
    const m = add(new THREE.SphereGeometry(0.16, 10, 6), S({ color: 0x5aa83a, roughness: 0.6 }), 0, 0.05); m.scale.set(0.45, 1, 0.12);
  } else if (kind === 'kunai') {
    const steel = S({ color: 0x2b2d33, metalness: 0.8, roughness: 0.25 });
    add(new THREE.ConeGeometry(0.05, 0.3, 4), steel, 0, 0.1);
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 6), S({ color: 0x5a0d12 }), 0, -0.12);
    add(new THREE.TorusGeometry(0.035, 0.01, 5, 10), steel, 0, -0.22, 0, Math.PI / 2);
  } else if (kind === 'shadow') {
    add(new THREE.OctahedronGeometry(0.14, 0), S({ color: 0x0b0610, emissive: 0x3a0a5a, emissiveIntensity: 1.2, roughness: 0.4 }));
  } else if (kind === 'orb') {
    add(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    add(new THREE.SphereGeometry(0.2, 12, 8), G(0x5fd0ff));
  } else if (kind === 'spark') {
    add(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    add(new THREE.SphereGeometry(0.16, 8, 6), G(0x6ac8ff));
  } else if (kind === 'dragon') {
    const gold = S({ color: 0xd9ad3c, metalness: 0.85, roughness: 0.3 });
    add(new THREE.ConeGeometry(0.11, 0.32, 6), gold, 0, 0.06); // snout, biting forward
    add(new THREE.SphereGeometry(0.12, 10, 8), gold, 0, -0.1);
    for (const s of [1, -1]) {
      add(new THREE.ConeGeometry(0.025, 0.18, 5), gold, 0.07 * s, -0.16, 0.07, -0.9, 0.3 * s); // horns sweeping back
      add(new THREE.SphereGeometry(0.022, 6, 4), S({ color: 0xff2a1a, emissive: 0xff2a1a, emissiveIntensity: 2 }), 0.065 * s, -0.04, 0.07);
    }
  }
  return g;
}

// ---- the lines themselves: each style is built from instanced pieces laid along the curve from hand to hook every frame
// (tube segments for strands, beads for links, leaves, charms, wisps and fins), so every style has its own shape and motion
const _q2 = new THREE.Quaternion(), _eu = new THREE.Euler(), X = new THREE.Vector3(1, 0, 0), _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _p = new THREE.Vector3(), _r = new THREE.Vector3();
const tubeGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0); // a unit segment, from its base along +y
const glowM = (c, o = 0.8) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
function charmTex() { // a paper talisman: white strip, red border and brush strokes
  if (texCache.charm) return texCache.charm;
  const c = document.createElement('canvas'); c.width = 32; c.height = 80; const g = c.getContext('2d');
  g.fillStyle = '#f2ead8'; g.fillRect(0, 0, 32, 80); g.strokeStyle = '#b3141c'; g.lineWidth = 3; g.strokeRect(3, 3, 26, 74);
  g.fillStyle = '#b3141c'; for (let i = 0; i < 4; i++) g.fillRect(10 + (i % 2) * 4, 12 + i * 15, 8, 4);
  g.beginPath(); g.arc(16, 66, 5, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (texCache.charm = t);
}

/** A fighter's grapple in a given style. show(a, b) each frame while hooked (a = hand, b = hook point); hide() otherwise. */
export function makeGrapple(scene, st, fx = {}) {
  const head = makeHead(st.head || 'claw');
  const layers = [], mats = [];
  const layer = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.count = 0; m.visible = false; scene.add(m); layers.push(m); mats.push(mat); return m; };
  const pts = Array.from({ length: 64 }, () => new THREE.Vector3());
  let t = 0, L = 1, A = null, B = null, sagK = 0;
  // a point along the line: u from hand (0) to hook (1), pushed off the axis by (o1, o2) across it, sagging a little in the middle
  const at = (u, o1 = 0, o2 = 0, out = _p) => out.copy(A).lerp(B, u).addScaledVector(_e1, o1).addScaledVector(_e2, o2).addScaledVector(UP, -sagK * 4 * u * (1 - u));
  const seg = (m, i, p, q, w) => { _w.subVectors(q, p); const l = _w.length() || 1e-3; _q.setFromUnitVectors(UP, _w.divideScalar(l)); _mx.compose(p, _q, _s.set(w, l, w)); m.setMatrixAt(i, _mx); };
  // a strand: n points from offset(u, i) → [o1, o2], drawn as segments of width w(u)
  const strand = (m, base, n, off, w) => {
    for (let i = 0; i < n; i++) { const u = i / (n - 1), o = off(u, i); at(u, o[0], o[1], pts[i]); }
    for (let i = 0; i < n - 1; i++) seg(m, base + i, pts[i], pts[i + 1], w((i + 0.5) / (n - 1)));
    return base + n - 1;
  };
  const flush = (m, n) => { m.count = n; m.instanceMatrix.needsUpdate = true; m.visible = n > 0; };
  const id = st.id;
  let draw;

  if (st.bolt) { // Lightning Whip: no rope at all, just two flickering jagged bolts (white-hot and blue)
    const m = layer(tubeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 2 * 13);
    for (let k = 0; k < 2; k++) for (let i = 0; i < 13; i++) m.setColorAt(k * 13 + i, new THREE.Color(k ? 0x5ab8ff : 0xeaffff));
    const jag = (J) => (u) => (u === 0 || u === 1 ? [0, 0] : [(Math.random() - 0.5) * J, (Math.random() - 0.5) * J]);
    draw = (dt, b) => {
      let n = strand(m, 0, 14, jag(0.18), () => 0.032 * (0.6 + Math.random() * 0.8));
      n = strand(m, n, 14, jag(0.3), () => 0.022 * (0.6 + Math.random() * 0.8));
      flush(m, n); m.material.opacity = 0.55 + Math.random() * 0.45;
      if (fx.zap && Math.random() < dt * 25) fx.zap.emit(b.x, b.y, b.z, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 0.2);
    };
  } else if (id === 'chain') { // Iron Chain: real interlocking links, each turned a quarter to the last
    const m = layer(new THREE.TorusGeometry(0.06, 0.017, 6, 12).scale(0.8, 1.35, 1), new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.9, roughness: 0.35 }), 420);
    draw = () => {
      const n = Math.min(420, Math.ceil(L / 0.13));
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n; at(u, 0, 0, _r); at(Math.min(1, u + 0.01), 0, 0, _p); _w.subVectors(_p, _r).normalize();
        _q.setFromUnitVectors(UP, _w); if (i % 2) _q.premultiply(_q2.setFromAxisAngle(_w, Math.PI / 2));
        _mx.compose(_r, _q, _s.set(1, Math.max(1, L / n / 0.13), 1)); m.setMatrixAt(i, _mx);
      }
      flush(m, n);
    };
  } else if (id === 'vine') { // Jungle Vine: a wavy green stem with a thin tendril curling round it, and leaves sprouting along it
    const stem = layer(tubeGeo, new THREE.MeshStandardMaterial({ color: 0x3f7f32, roughness: 0.8 }), 60);
    const tend = layer(tubeGeo, new THREE.MeshStandardMaterial({ color: 0x7cc24e, roughness: 0.7 }), 60);
    const lg = new THREE.SphereGeometry(1, 8, 5).translate(0, 1, 0); // (a leaf, grown out from its stalk end)
    const leaves = layer(lg, new THREE.MeshStandardMaterial({ color: 0x5aa83a, roughness: 0.6, side: THREE.DoubleSide }), 140);
    const wave = (u) => [Math.sin(u * L * 1.3 + t * 2) * 0.05 * Math.sin(u * Math.PI), Math.cos(u * L * 0.9 + t * 1.6) * 0.04 * Math.sin(u * Math.PI)];
    draw = () => {
      flush(stem, strand(stem, 0, 40, wave, (u) => 0.03 - u * 0.008));
      flush(tend, strand(tend, 0, 60, (u) => { const w = wave(u), a = u * L * 7; return [w[0] + Math.cos(a) * 0.035, w[1] + Math.sin(a) * 0.035]; }, () => 0.008));
      const n = Math.min(140, Math.floor(L / 0.45));
      for (let i = 0; i < n; i++) {
        const u = (i + 0.7) / (n + 0.4), w = wave(u), ang = i * 2.4 + Math.sin(t * 3 + i) * 0.25; at(u, w[0], w[1], _r);
        _w.copy(_e1).multiplyScalar(Math.cos(ang)).addScaledVector(_e2, Math.sin(ang)).addScaledVector(_d, 0.6).normalize();
        _q.setFromUnitVectors(UP, _w); const k = 0.75 + (i % 3) * 0.15;
        _mx.compose(_r, _q, _s.set(0.045 * k, 0.09 * k, 0.012)); leaves.setMatrixAt(i, _mx);
      }
      flush(leaves, n);
    };
  } else if (id === 'kunai') { // Kunai Line: a taut red silk cord humming in the wind, with paper talismans hanging off it, fluttering
    const cord = layer(tubeGeo, new THREE.MeshStandardMaterial({ color: 0xc0262c, roughness: 0.5, emissive: 0x300406 }), 30);
    const charms = layer(new THREE.PlaneGeometry(0.13, 0.32).translate(0, -0.18, 0), new THREE.MeshStandardMaterial({ map: charmTex(), roughness: 0.9, side: THREE.DoubleSide }), 60);
    const knots = layer(new THREE.SphereGeometry(0.022, 6, 4), new THREE.MeshStandardMaterial({ color: 0x7a0d12, roughness: 0.6 }), 60);
    draw = () => {
      const hum = Math.sin(t * 40) * 0.01;
      flush(cord, strand(cord, 0, 31, (u) => [hum * Math.sin(u * Math.PI * 3), 0], () => 0.009));
      const n = Math.min(60, Math.floor(L / 1.3));
      for (let i = 0; i < n; i++) {
        const u = (i + 1) / (n + 1); at(u, 0, 0, _r); _mx.makeTranslation(_r.x, _r.y, _r.z); knots.setMatrixAt(i, _mx);
        _q.setFromEuler(_eu.set(Math.sin(t * 7 + i * 1.7) * 0.5, Math.atan2(_d.x, _d.z) + Math.PI / 2, Math.sin(t * 5 + i) * 0.35));
        _mx.compose(_r, _q, _s.set(1, 1, 1)); charms.setMatrixAt(i, _mx);
      }
      flush(charms, n); flush(knots, n);
    };
  } else if (id === 'shadow') { // Shadow Tether: three black tendrils writhing round each other, laced with a violet glow (and smoke)
    const dark = layer(tubeGeo, new THREE.MeshStandardMaterial({ color: 0x0b0610, roughness: 0.5, emissive: 0x1a0428 }), 3 * 39);
    const vio = layer(tubeGeo, glowM(0x8a3aff, 0.55), 2 * 39);
    const coil = (k, R, sp) => (u) => { const env = Math.sin(u * Math.PI) * 0.7 + 0.3, a = u * L * sp + t * 3 + k * 2.09, rr = R * env * (1 + 0.4 * Math.sin(t * 5 + u * 9 + k)); return [Math.cos(a) * rr, Math.sin(a) * rr]; };
    draw = () => {
      let n = 0; for (let k = 0; k < 3; k++) n = strand(dark, n, 40, coil(k, 0.05, 2.2), (u) => 0.018 * (1.2 - u * 0.4)); flush(dark, n);
      n = 0; for (let k = 0; k < 2; k++) n = strand(vio, n, 40, coil(k + 0.5, 0.08, -1.6), () => 0.007); flush(vio, n);
      vio.material.opacity = 0.4 + 0.25 * Math.sin(t * 6);
    };
  } else if (id === 'spirit') { // Spirit Thread: a faint glowing thread with two ghostly strands spiralling round it and wisps flowing to the hook
    const core = layer(tubeGeo, glowM(0xbff0ff, 0.85), 30);
    const ghost = layer(tubeGeo, glowM(0x5fd0ff, 0.55), 2 * 47);
    const wisps = layer(new THREE.SphereGeometry(1, 8, 6), glowM(0x9fe6ff, 0.8), 40);
    draw = () => {
      flush(core, strand(core, 0, 31, (u) => [Math.sin(u * 12 + t * 4) * 0.012, 0], () => 0.008));
      let n = 0; for (let k = 0; k < 2; k++) n = strand(ghost, n, 48, (u) => { const a = u * L * 2.5 * (k ? -1 : 1) + t * 2, rr = 0.1 * Math.sin(u * Math.PI); return [Math.cos(a) * rr, Math.sin(a) * rr]; }, () => 0.009);
      flush(ghost, n);
      const w = Math.min(40, Math.ceil(L / 0.7));
      for (let i = 0; i < w; i++) {
        const u = ((i / w) + t * 0.6) % 1, a = u * L * 2.5 + i, rr = 0.05 * Math.sin(u * Math.PI); at(u, Math.cos(a) * rr, Math.sin(a) * rr, _r);
        const sz = 0.03 * (0.6 + 0.4 * Math.sin(t * 9 + i * 2)) * (0.4 + Math.sin(u * Math.PI)); _mx.compose(_r, _q.identity(), _s.set(sz, sz, sz)); wisps.setMatrixAt(i, _mx);
      }
      flush(wisps, w);
    };
  } else if (id === 'dragon') { // Dragon Tail: a thick scaled body that slithers (a wave runs along it), tapering to the hand, with red fins on its back
    const tex = lineTex('scales').clone(); tex.needsUpdate = true; tex.repeat.set(2, 1);
    const body = layer(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ map: tex, metalness: 0.55, roughness: 0.35 }), 47);
    const fins = layer(new THREE.ConeGeometry(1, 1, 4).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5, emissive: 0x2a0604, side: THREE.DoubleSide }), 80);
    const slither = (u) => { const env = Math.sin(u * Math.PI); return [Math.sin(u * L * 0.8 - t * 6) * 0.14 * env, 0]; };
    const thick = (u) => 0.022 + u * 0.05;
    draw = () => {
      flush(body, strand(body, 0, 48, slither, thick));
      const n = Math.min(80, Math.floor(L / 0.35));
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, o = slither(u), k = thick(u); at(u, o[0], o[1] + k * 0.8, _r);
        _q.setFromUnitVectors(UP, _w.copy(_e2).addScaledVector(_d, -0.7).normalize()); // (raked back toward the hand)
        _mx.compose(_r, _q, _s.set(k * 0.8, k * 3.6, k * 0.15)); fins.setMatrixAt(i, _mx);
      }
      flush(fins, n);
    };
  } else { // Rope: a twisted two-strand hemp rope, sagging a little
    const m = layer(tubeGeo, new THREE.MeshStandardMaterial({ roughness: 0.95 }), 2 * 59);
    for (let k = 0; k < 2; k++) for (let i = 0; i < 59; i++) m.setColorAt(k * 59 + i, new THREE.Color(k ? 0x6e5230 : 0x9a7a4a));
    draw = () => {
      let n = 0; for (let k = 0; k < 2; k++) n = strand(m, n, 60, (u) => { const a = u * L * 9 + k * Math.PI; return [Math.cos(a) * 0.011, Math.sin(a) * 0.011]; }, () => 0.013);
      flush(m, n);
    };
  }
  const sags = { rope: 0.02, chain: 0.03, vine: 0.025, kunai: 0, shadow: 0.01, spirit: 0, dragon: 0.015 };
  head.visible = false; scene.add(head);
  return {
    show(a, b, dt = 0.016) {
      t += dt; A = a; B = b;
      _d.subVectors(b, a); L = _d.length() || 1e-3; _d.divideScalar(L);
      _e1.crossVectors(_d, Math.abs(_d.y) < 0.95 ? UP : X).normalize(); _e2.crossVectors(_e1, _d);
      sagK = Math.min(1.2, (st.bolt ? 0 : sags[id] ?? 0.02) * L);
      head.visible = true; head.position.copy(b); head.quaternion.setFromUnitVectors(UP, _d);
      draw(dt, b);
      if (st.smoke && fx.smoke && Math.random() < dt * 40) { _m.copy(a).lerp(b, Math.random()); fx.smoke.emit(_m.x, _m.y, _m.z, (Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4, 0.7); }
    },
    hide() { head.visible = false; for (const m of layers) m.visible = false; },
    dispose() {
      scene.remove(head); head.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      for (const m of layers) { scene.remove(m); if (m.geometry !== tubeGeo) m.geometry.dispose(); m.dispose(); }
      for (const m of mats) { if (m.map && m.map !== texCache.charm) m.map.dispose(); m.dispose(); }
    },
  };
}
