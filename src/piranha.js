// Great Canopy: fall too low and a giant piranha bursts out of the swamp, jaws wide, snaps you up and dives back in.
// Purely visual (every client plays it locally when it sees a fall death on that map).
import * as THREE from 'three';
import { bladeMesh } from './foundry.js?v=20261114234627';

const TAU = Math.PI * 2;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, ...o });
let mats = null;
function M() {
  return mats || (mats = {
    back: std(0x5e6a70, { metalness: 0.35, roughness: 0.4, emissive: 0x1a2024 }), belly: std(0xd2442a, { emissive: 0x3a0c06 }), fin: std(0x3a4044, { side: THREE.DoubleSide }),
    tooth: std(0xf3efdf, { roughness: 0.3, emissive: 0x444038 }), mouth: std(0x3a0606, { roughness: 0.9 }), eye: std(0xd8a020, { roughness: 0.2, emissive: 0x401800 }), pupil: std(0x050505),
  });
}
const half = (top) => new THREE.SphereGeometry(1, 24, 10, 0, TAU, top ? 0 : Math.PI / 2, Math.PI / 2);

// built lying along +x (head forward), mouth opening in the x-y plane; ~9 m long
function build() {
  const m = M(), g = new THREE.Group();
  const add = (geo, mat, x, y, z, sx, sy, sz, p = g) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; p.add(o); return o; };
  const sph = new THREE.SphereGeometry(1, 28, 18);
  add(sph, m.back, -1.6, 0.35, 0, 3.6, 2.5, 1.35); // deep, flat body
  add(sph, m.belly, -1.2, -0.6, 0, 3.3, 1.9, 1.25); // red belly
  add(sph, m.mouth, 1.2, 0, 0, 1.6, 1.3, 1.0); // the throat you see when it opens
  // tail and fins: flattened cones
  const fin = (x, y, rz, sx, sy, sz) => { const o = add(new THREE.ConeGeometry(1, 2, 4), m.fin, x, y, z0, sx, sy, sz); o.rotation.z = rz; return o; }, z0 = 0;
  fin(-6.2, 0.3, Math.PI / 2 + 0.5, 1.4, 1.2, 0.12); fin(-6.2, 0.3, Math.PI / 2 - 0.5, 1.4, 1.2, 0.12); // forked tail
  fin(-1.8, 2.7, -0.6, 1.1, 1.0, 0.1); fin(-2.4, -2.4, 0.5, 0.9, 0.8, 0.1); // dorsal, anal
  for (const s of [-1, 1]) { const p = fin(0.2, -0.7, 2.2, 0.6, 0.7, 0.1); p.position.z = s * 1.3; p.rotation.y = s * 0.5; }
  // jaws hinge just behind the eye; each is a half-ellipsoid with a row of teeth along its rim
  const jaw = (top) => {
    const piv = new THREE.Group(); piv.position.set(0.2, top ? 0.05 : -0.05, 0); g.add(piv);
    add(half(top), top ? m.back : m.belly, 1.9, 0, 0, 2.5, top ? 1.6 : 1.3, 1.15, piv);
    for (let i = 0; i <= 10; i++) {
      const a = -1.25 + (i / 10) * 2.5 + (top ? 0 : 0.12), t = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.75, 5), m.tooth);
      t.position.set(1.9 + 2.4 * Math.cos(a), top ? -0.25 : 0.25, 1.08 * Math.sin(a)); t.rotation.x = top ? Math.PI : 0; piv.add(t);
    }
    return piv;
  };
  g.userData.up = jaw(true); g.userData.lo = jaw(false);
  for (const s of [-1, 1]) { add(sph, m.eye, 1.3, 0.9, s * 0.95, 0.42, 0.42, 0.3); add(sph, m.pupil, 1.38, 0.92, s * 1.12, 0.2, 0.24, 0.16); }
  return g;
}

const ease = (t) => 1 - (1 - t) * (1 - t);
export class Piranhas {
  constructor(scene, splash) { this.scene = scene; this.splash = splash; this.list = []; }
  // pos: where the victim died; cam: the camera position (it turns side-on to it); water: the swamp's height;
  // onBite: called the moment the jaws close (hide the victim, crunch)
  bite(pos, cam, water, onBite) {
    const outer = new THREE.Group(), fish = build(); outer.add(fish); this.scene.add(outer);
    outer.position.set(pos.x, water - 8, pos.z);
    outer.rotation.y = Math.atan2(cam.x - pos.x, cam.z - pos.z) + (Math.random() - 0.5) * 0.5; // side-on to the camera
    fish.rotation.z = Math.PI / 2; // nose up
    this.list.push({ outer, fish, t: 0, y0: water - 8, y1: pos.y - 1.8, water, pos: pos.clone(), onBite, bit: false, out: false, back: false, vy: 0 });
  }
  burst(x, y, z, n, sp) { if (this.splash) for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = Math.random() * sp; this.splash.emit(x + Math.cos(a) * 2, y, z + Math.sin(a) * 2, Math.cos(a) * r, 8 + Math.random() * 14, Math.sin(a) * r, 1.6); } }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i], o = b.outer, f = b.fish, up = f.userData.up, lo = f.userData.lo; b.t += dt; const t = b.t;
      let open;
      if (t < 0.5) { // erupt, mouth gaping
        o.position.y = b.y0 + (b.y1 - b.y0) * ease(t / 0.5); open = Math.min(1, t / 0.3);
      } else if (t < 0.58) open = 1 - (t - 0.5) / 0.08; // SNAP
      else if (t < 1.0) { open = 0.12 * Math.abs(Math.sin((t - 0.58) * 26)); o.position.y = b.y1 + Math.sin((t - 0.58) * 40) * 0.12; f.rotation.z = Math.PI / 2 - (t - 0.58) * 0.8; } // chomp chomp, start to roll over
      else { // arc over and dive back in, nose first
        if (!b.vy) b.vy = 4; b.vy -= 30 * dt; o.position.y += b.vy * dt; open = 0;
        f.rotation.z = Math.max(-Math.PI / 2, f.rotation.z - dt * 3.2); o.translateX(dt * 3);
      }
      up.rotation.z = open * 0.55; lo.rotation.z = -open * 0.75;
      if (!b.out && o.position.y > b.water - 2) { b.out = true; this.burst(b.pos.x, b.water + 0.2, b.pos.z, 60, 9); }
      if (!b.bit && t >= 0.56) { b.bit = true; if (b.onBite) b.onBite(); }
      if (b.out && !b.back && t > 1 && o.position.y < b.water + 1) { b.back = true; this.burst(o.position.x, b.water + 0.2, o.position.z, 70, 11); }
      if (t > 2.6) { this.scene.remove(o); o.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); this.list.splice(i, 1); }
    }
  }
  clear() { for (const b of this.list) this.scene.remove(b.outer); this.list.length = 0; }
}

// Saw Foundry: the same idea with a giant spinning saw that rises out of the smog, cuts the faller in half and sinks back.
let sawMats = null;
export class GiantSaws {
  constructor(scene, sparks) { this.scene = scene; this.sparks = sparks; this.list = []; }
  // onBite(n): the moment the blade's edge reaches the body; n is the blade's plane normal (the cut)
  bite(pos, cam, water, onBite) {
    sawMats = sawMats || { blade: new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.9, roughness: 0.28, emissive: 0x2a1206 }), hub: new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.6, roughness: 0.5 }) };
    const R = 4.6, outer = new THREE.Group(), blade = bladeMesh(R, sawMats); outer.add(blade); this.scene.add(outer);
    outer.position.set(pos.x, water - R - 2, pos.z);
    outer.rotation.y = Math.atan2(cam.x - pos.x, cam.z - pos.z) + Math.PI / 4; // three-quarter view: you see the disc and the cut
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(outer.quaternion);
    this.list.push({ outer, blade, R, t: 0, y0: water - R - 2, y1: pos.y + 1.2 - R * 0.35, water, pos: pos.clone(), n, onBite, bit: false, out: false });
  }
  burst(x, y, z, n, sp) { if (this.sparks) for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = Math.random() * sp; this.sparks.emit(x + Math.cos(a), y, z + Math.sin(a), Math.cos(a) * r, 6 + Math.random() * 12, Math.sin(a) * r, 1.2); } }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i], o = b.outer, t = (b.t += dt);
      b.blade.rotation.z -= dt * (t < 1.2 ? 28 : 28 * Math.max(0, 2 - t)); // screaming fast, winding down as it sinks
      if (t < 0.45) o.position.y = b.y0 + (b.y1 - b.y0) * ease(t / 0.45);
      else if (t < 0.9) o.position.y = b.y1 + Math.sin(t * 60) * 0.06; // grinding in place
      else o.position.y -= dt * 14 * Math.min(1, (t - 0.9) * 2); // back down into the smog
      const top = o.position.y + b.R;
      if (!b.out && top > b.water) { b.out = true; this.burst(b.pos.x, b.water + 0.2, b.pos.z, 50, 7); }
      if (!b.bit && top >= b.pos.y + 0.4) { b.bit = true; this.burst(b.pos.x, b.pos.y + 1, b.pos.z, 60, 9); if (b.onBite) b.onBite(b.n); }
      if (t > 0.45 && t < 0.9 && Math.random() < 0.5) this.burst(b.pos.x, top - 0.3, b.pos.z, 2, 6); // sparks off the edge
      if (t > 2.4) { this.scene.remove(o); this.list.splice(i, 1); }
    }
  }
  clear() { for (const b of this.list) this.scene.remove(b.outer); this.list.length = 0; }
}
