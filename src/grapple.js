// Grapple styles from the shop: the line from your hand to where the hook bit, and the hook's head.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3(), _m = new THREE.Vector3();

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

/** A fighter's grapple in a given style. show(a, b) each frame while hooked (a = hand, b = hook point); hide() otherwise. */
export function makeGrapple(scene, st, fx = {}) {
  const glow = !!st.glow;
  const mat = glow ? new THREE.MeshBasicMaterial({ color: st.c, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })
    : new THREE.MeshStandardMaterial({ color: st.tex ? 0xffffff : st.c, roughness: 0.7, metalness: st.tex === 'chain' || st.tex === 'scales' ? 0.6 : 0, map: st.tex ? lineTex(st.tex).clone() : null });
  if (mat.map) mat.map.needsUpdate = true;
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, st.tex ? 8 : 5, 1, !glow), mat);
  const head = makeHead(st.head || 'claw');
  let bolt = null;
  if (st.bolt) { // a jagged electric line around a faint glow
    const N = 14, geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    bolt = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xeaffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    bolt.frustumCulled = false; bolt.N = N; scene.add(bolt);
  }
  rope.visible = head.visible = false; if (bolt) bolt.visible = false;
  scene.add(rope); scene.add(head);
  let t = 0;
  return {
    show(a, b, dt = 0.016) {
      t += dt;
      _d.subVectors(b, a); const L = _d.length() || 1e-3; _d.divideScalar(L);
      rope.visible = head.visible = true;
      rope.position.addVectors(a, b).multiplyScalar(0.5); rope.quaternion.setFromUnitVectors(UP, _d);
      const r = st.r * (glow ? 1 + 0.35 * Math.sin(t * 18) : 1); rope.scale.set(r, L, r);
      if (mat.map) mat.map.repeat.set(1, L / (st.r * 14)); // tiles keep their size however long the rope
      head.position.copy(b); head.quaternion.setFromUnitVectors(UP, _d);
      if (bolt) {
        bolt.visible = true; const p = bolt.geometry.attributes.position;
        for (let i = 0; i < bolt.N; i++) { const u = i / (bolt.N - 1), j = i === 0 || i === bolt.N - 1 ? 0 : 0.12; _m.copy(a).lerp(b, u); p.setXYZ(i, _m.x + (Math.random() - 0.5) * j, _m.y + (Math.random() - 0.5) * j, _m.z + (Math.random() - 0.5) * j); }
        p.needsUpdate = true; bolt.material.opacity = 0.6 + Math.random() * 0.4;
        if (fx.zap && Math.random() < dt * 25) { fx.zap.emit(b.x, b.y, b.z, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 0.2); }
      }
      if (st.smoke && fx.smoke && Math.random() < dt * 40) { _m.copy(a).lerp(b, Math.random()); fx.smoke.emit(_m.x, _m.y, _m.z, (Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4, 0.7); }
    },
    hide() { rope.visible = head.visible = false; if (bolt) bolt.visible = false; },
    dispose() {
      scene.remove(rope); scene.remove(head); rope.geometry.dispose(); mat.dispose(); if (mat.map) mat.map.dispose();
      head.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      if (bolt) { scene.remove(bolt); bolt.geometry.dispose(); bolt.material.dispose(); }
    },
  };
}
