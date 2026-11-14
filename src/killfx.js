// Kill effects from the shop: what happens to someone you cut down. The body still splits along your
// cut; the effect changes what sprays out, what the pieces leak, and what becomes of them.
import * as THREE from 'three';
import { Particles } from './slice.js?v=20261114034906';
import { sfx } from './audio.js?v=20261114034906';

const R = () => Math.random() - 0.5;

export function makeKillFx(scene, ground, { sound = true } = {}) {
  const P = (o) => new Particles(scene, ground, o);
  const sys = {
    petal: P({ color: 0xffb7d5, size: 0.09, gravity: 1.2, max: 900 }),
    ink: P({ color: 0x0b0b10, size: 0.09, gravity: 18, max: 1200, decals: true, decalColor: 0x07070a }),
    gold: P({ color: 0xffc23d, size: 0.11, gravity: 20, max: 600, decals: true, decalColor: 0xd9a92b }),
    smoke: P({ color: 0x8f8f94, size: 0.5, gravity: -0.7, max: 600 }),
    ash: P({ color: 0x5a524c, size: 0.07, gravity: -1.4, max: 700 }),
    ember: P({ color: 0xff8a2a, size: 0.06, gravity: -3, max: 700 }),
    ice: P({ color: 0xd8f6ff, size: 0.08, gravity: 20, max: 700 }),
    zap: P({ color: 0xcff4ff, size: 0.06, gravity: 0, max: 500 }),
    rift: P({ color: 0xb07aff, size: 0.07, gravity: 0, max: 600 }),
  };
  const mats = {
    ember: new THREE.MeshStandardMaterial({ color: 0x2a1208, emissive: 0xff5a10, emissiveIntensity: 1.7, roughness: 0.9 }),
    ice: new THREE.MeshStandardMaterial({ color: 0xbfe8ff, emissive: 0x2a6aa0, emissiveIntensity: 0.6, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.86 }),
  };
  const timed = []; // short-lived visuals: lightning bolts, rifts
  const s = (fn, p) => { if (sound) fn.call(sfx, p); };
  // spray n particles from c: speed sp, plus some lift
  const spray = (ps, c, n, sp, lift = 1, life = 2, spread = 0.3) => {
    for (let i = 0; i < n; i++) ps.emit(c.x + R() * spread, c.y + R() * spread, c.z + R() * spread, R() * 2 * sp, R() * 2 * sp + lift, R() * 2 * sp, life * (0.6 + Math.random() * 0.6));
  };

  const effects = {
    // pink petals burst out and drift down; the pieces shed petals instead of blood
    sakura: { burst: sys.petal, on(c, n, list) { spray(sys.petal, c, 70, 2.2, 1.5, 4, 0.5); for (const p of list) { p.bleedSys = sys.petal; p.bleed = 3; } } },
    // black ink splashes along the cut and the pieces trail it, leaving ink on the floor
    ink: { burst: sys.ink, on(c, n, list) { for (const p of list) { p.bleedSys = sys.ink; p.bleed = 3; } } },
    // a shower of gold coins with a chime; they land as coins on the platform
    gold: { burst: null, on(c, n, list) { spray(sys.gold, c, 55, 2.5, 5, 3); for (const p of list) p.bleed = 0; s(sfx.chime, c); } },
    // a puff of smoke and the pieces are gone
    smoke: { burst: null, on(c, n, list) {
      spray(sys.smoke, c, 34, 0.9, 0.6, 1.4, 0.8); s(sfx.poof, c);
      for (const p of list) { p.bleed = 0; p.life = Math.min(p.life, 1.0); p.tick = (q, dt) => { if (Math.random() < dt * 20) spray(sys.smoke, q.mesh.position, 1, 0.4, 0.4, 1, 0.3); }; }
    } },
    // the cut glows like hot metal, then the pieces crumble to ash and embers that float up
    ember: { burst: sys.ember, on(c, n, list) {
      for (const p of list) {
        p.bleed = 0; p.mesh.material = mats.ember; p.t = 0;
        p.tick = (q, dt) => {
          q.t += dt; if (Math.random() < dt * 30) spray(sys.ember, q.mesh.position, 1, 0.5, 1, 1.2, q.r);
          if (q.t > 1.3 && !q.done) { q.done = true; q.life = Math.min(q.life, 0.7); spray(sys.ash, q.mesh.position, 40, 0.8, 1, 2.2, q.r); spray(sys.ember, q.mesh.position, 20, 1, 1.5, 1.5, q.r); }
        };
      }
    } },
    // the pieces freeze solid and shatter when they hit the ground
    frozen: { burst: sys.ice, on(c, n, list) {
      for (const p of list) {
        p.bleed = 0; p.mesh.material = mats.ice; p.t = 0;
        p.tick = (q, dt) => {
          q.t += dt;
          if (!q.done && ((q.onFloor && q.t > 0.25) || q.t > 2.2)) { q.done = true; q.life = 0; spray(sys.ice, q.mesh.position, 45, 2.4, 3, 1.6, q.r); s(sfx.shatter, q.mesh.position); }
        };
      }
    } },
    // a bolt cracks down out of the sky onto them as they split
    lightning: { burst: undefined, on(c) {
      const pts = [], top = c.clone().add(new THREE.Vector3(R() * 6, 34, R() * 6));
      for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push(top.clone().lerp(c, u).add(new THREE.Vector3(R() * 2.2 * (1 - u * 0.8), 0, R() * 2.2 * (1 - u * 0.8)))); }
      const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: 0xdff7ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      for (let i = 0; i < 12; i++) {
        const a = pts[i], b = pts[i + 1], d = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, d.length(), 5, 1), mat);
        m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(m);
      }
      const flash = new THREE.PointLight(0xbfe8ff, 60, 30); flash.position.copy(c).add(new THREE.Vector3(0, 2, 0)); g.add(flash);
      scene.add(g); spray(sys.zap, c, 50, 4, 1, 0.5);
      s(sfx.thunder, c);
      timed.push({ t: 0, life: 0.4, step(t) { mat.opacity = Math.random() < 0.3 ? 0.15 : 1 - t / 0.4; flash.intensity = 60 * (1 - t / 0.4); },
        end() { scene.remove(g); g.traverse((o) => o.geometry && o.geometry.dispose()); mat.dispose(); } });
    } },
    // a purple tear opens along the cut and swallows the pieces
    void: { burst: null, on(c, n, list) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x9b51ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const core = new THREE.MeshBasicMaterial({ color: 0x07020d, side: THREE.DoubleSide });
      const g = new THREE.Group(), glow = new THREE.Mesh(new THREE.CircleGeometry(1, 32), mat), hole = new THREE.Mesh(new THREE.CircleGeometry(0.8, 32), core);
      hole.position.z = 0.01; g.add(glow, hole); g.position.copy(c); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      g.scale.set(0.001, 0.001, 1); scene.add(g); s(sfx.rift, c);
      for (const p of list) {
        p.bleed = 0; p.t = 0; p.asleep = false;
        p.tick = (q, dt) => {
          q.t += dt; q.asleep = false; const to = c.clone().sub(q.mesh.position), d = to.length();
          q.vel.lerp(to.multiplyScalar(5 / Math.max(0.3, d) * Math.min(1, q.t * 2)), Math.min(1, dt * 4)); q.vel.y += 24 * dt; // drawn in, not falling
          if (q.t > 0.55) q.life = Math.min(q.life, 0.45);
        };
      }
      timed.push({ t: 0, life: 1.1, step(t) {
        const o = t < 0.2 ? t / 0.2 : t > 0.8 ? Math.max(0, (1.1 - t) / 0.3) : 1; g.scale.set(0.35 * o + 0.001, 1.1 * o + 0.001, 1);
        if (t < 0.8) for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, r0 = 1.6; const p = c.clone().add(new THREE.Vector3(Math.cos(a) * r0, R() * 1.6, Math.sin(a) * r0)), v = c.clone().sub(p).multiplyScalar(2.2); sys.rift.emit(p.x, p.y, p.z, v.x, v.y, v.z, 0.45); }
      }, end() { scene.remove(g); glow.geometry.dispose(); hole.geometry.dispose(); mat.dispose(); core.dispose(); } });
    } },
  };

  return {
    /** What sprays out of the cut for this effect (undefined: normal blood; null: nothing). */
    burstFor(id) { const e = effects[id]; return e ? e.burst : undefined; },
    /** A kill with effect `id`: c is the cut centre, n the cut's normal, list the new pieces. */
    apply(id, c, n, list) { const e = effects[id]; if (e && c) e.on(c, n, list || []); },
    update(dt) {
      for (const p of Object.values(sys)) p.update(dt);
      for (const e of [...timed]) { e.t += dt; if (e.t >= e.life) { e.end(); timed.splice(timed.indexOf(e), 1); } else e.step(e.t); }
    },
  };
}
