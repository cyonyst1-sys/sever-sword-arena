// Game modes: their names and rules text, and the objective visuals (throne, shrines, heads, crown).
import * as THREE from 'three';

export const MODES = {
  ffa: { name: 'Free-for-all', blurb: 'Everyone against everyone. First to 15 kills.' },
  koth: { name: 'King of the Platform', blurb: 'Stand on the glowing platform alone to score 1 point a second. It moves every 40 s. First to 60.' },
  jugg: { name: 'Juggernaut', blurb: 'One crowned fighter with a 3 m blade against everyone else. Cut them down to take the crown. The juggernaut scores 1 point a second. First to 60.' },
  lbs: { name: 'Last Blade Standing', blurb: 'No respawns. Platforms glow red, then crumble into the clouds, from the outside in. Last fighter alive wins.' },
  hunt: { name: 'Headhunter', blurb: 'Every kill drops gold heads. Carry them to a shrine to bank them; die and you drop them all. First to 20 banked.' },
  horde: { name: 'Horde', blurb: 'Co-op: everyone together against waves of oni.' },
};
export const POINT_MODES = new Set(['koth', 'jugg', 'hunt']); // won on points rather than kills
export const MODE_GOAL = { ffa: 15, koth: 60, jugg: 60, hunt: 20 };

const GOLD = 0xffc23d;
const add = (g, m) => { g.add(m); return m; };

export class ModeFx {
  constructor(scene) {
    this.root = new THREE.Group(); scene.add(this.root);
    this.throne = null; this.shrines = []; this.tokens = new Map();
    this.tokenGeo = new THREE.OctahedronGeometry(0.3, 0);
    this.tokenMat = new THREE.MeshStandardMaterial({ color: GOLD, emissive: 0xb07300, emissiveIntensity: 1.4, metalness: 0.6, roughness: 0.3, flatShading: true });
  }
  clear() { this.setThrone(null); this.setShrines([]); this.setTokens([]); }

  // King of the Platform: a tall gold beam and a glowing outline on the throne platform
  setThrone(p) {
    if (this.throne && this.throne.plat === p) return;
    if (this.throne) { this.root.remove(this.throne.g); this.throne.g.traverse((o) => o.geometry && o.geometry.dispose()); this.throne = null; }
    if (!p) return;
    const g = new THREE.Group();
    const beam = add(g, new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 80, 24, 1, true), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    beam.position.set(p.x, p.y + 40, p.z);
    const plate = add(g, new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.06, p.d), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.12, depthWrite: false })));
    plate.position.set(p.x, p.y + 0.05, p.z); plate.rotation.y = -(p.ang || 0);
    const edge = add(g, new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(p.w + 0.2, 0.5, p.d + 0.2)), new THREE.LineBasicMaterial({ color: GOLD })));
    edge.position.set(p.x, p.y + 0.25, p.z); edge.rotation.y = -(p.ang || 0);
    this.root.add(g); this.throne = { g, plat: p, beam, plate };
  }
  // Headhunter: shrines where heads are banked
  setShrines(list) {
    for (const s of this.shrines) { this.root.remove(s.g); s.g.traverse((o) => o.geometry && o.geometry.dispose()); }
    this.shrines = [];
    for (const pos of list) {
      const g = new THREE.Group();
      const beam = add(g, new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 60, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
      beam.position.set(pos.x, pos.y + 30, pos.z);
      const ring = add(g, new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.08, 6, 40), new THREE.MeshBasicMaterial({ color: 0xff9a2e })));
      ring.rotation.x = Math.PI / 2; ring.position.set(pos.x, pos.y + 0.08, pos.z);
      const gem = add(g, new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), this.tokenMat));
      gem.position.set(pos.x, pos.y + 1.6, pos.z);
      this.root.add(g); this.shrines.push({ g, gem, pos });
    }
  }
  // Headhunter: the gold heads lying around, as [id, x, y, z]
  setTokens(list) {
    const keep = new Set();
    for (const [id, x, y, z] of list) {
      keep.add(id);
      let m = this.tokens.get(id);
      if (!m) { m = new THREE.Mesh(this.tokenGeo, this.tokenMat); m.castShadow = true; this.root.add(m); this.tokens.set(id, m); m.userData.base = y; }
      m.position.set(x, y, z); m.userData.base = y;
    }
    for (const [id, m] of this.tokens) if (!keep.has(id)) { this.root.remove(m); this.tokens.delete(id); }
  }
  update(t) {
    if (this.throne) { this.throne.beam.material.opacity = 0.16 + 0.08 * Math.sin(t * 3); this.throne.plate.material.opacity = 0.08 + 0.06 * Math.sin(t * 3); }
    for (const s of this.shrines) { s.gem.rotation.y = t * 1.5; s.gem.position.y = s.pos.y + 1.6 + Math.sin(t * 2) * 0.2; }
    for (const m of this.tokens.values()) { m.rotation.y = t * 2.5; m.position.y = m.userData.base + 0.15 * Math.sin(t * 3 + m.id); }
  }
}

/** A gold crown (and a marker you can see from afar) for the juggernaut; added to a fighter's group. */
export function makeCrown() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: GOLD, emissive: 0x9a6400, emissiveIntensity: 1.2, metalness: 0.7, roughness: 0.3 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.09, 10, 1, true), mat); band.position.y = 1.86; g.add(band);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2, spike = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 4), mat);
    spike.position.set(Math.cos(a) * 0.14, 1.94, Math.sin(a) * 0.14); g.add(spike);
  }
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4), new THREE.MeshBasicMaterial({ color: GOLD }));
  marker.rotation.x = Math.PI; marker.position.y = 2.75; g.add(marker);
  g.userData.marker = marker;
  return g;
}
