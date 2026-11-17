// Training Ground: four platforms in a line, each a short lesson. Walk and jump a small gap; cut a dummy and dash;
// hook up to a high ledge; cross a wide gap beside a wall you can plant on; then a sparring match. The lessons
// themselves (the prompts, and what counts as done) are in main.js: this is only the course.
import * as THREE from 'three';

export function buildTutorial(A, T) {
  const S = A.scene; A.plats = []; A.killY = -28; A.tutMap = true; A.cp = 0;
  A.setSky({ top: 0x2c4c8c, mid: 0x9cc2ea, bot: 0xead9c0, fog: 0xbcd2e8, near: 90, far: 400, hemiSky: 0xffffff, hemiGround: 0x8a7a60, hemi: 1.0, sunColor: 0xfff0d8, sun: 2.2, sunOff: new THREE.Vector3(40, 70, 30) });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc040, emissive: 0xffa020, emissiveIntensity: 1.6, roughness: 0.4 });
  const pad = (x0, x1, z0, z1, y) => {
    const p = { kind: 'pad', x: (x0 + x1) / 2, z: (z0 + z1) / 2, y, w: x1 - x0, d: z1 - z0, ang: 0, i: A.plats.length, meshes: [], boxes: [], ramps: [], rays: [] };
    A.plats.push(p);
    p.meshes.push(A.addBox(x0, x1, y - 1.2, y, z0, z1, A.mats.floor), A.addBox(x0 + 1.5, x1 - 1.5, y - 70, y - 1.2, z0 + 1.5, z1 - 1.5, A.mats.stone));
    A.node('P' + p.i, p.x, y, p.z).plat = p.i;
    for (const dx of [-2, 2]) { const sp = new THREE.Vector3(p.x + dx, y + 0.05, p.z + p.d * 0.25); sp.plat = p.i; A.spawns.push(sp); }
    return p;
  };
  const a = pad(-7, 7, -8, 8, 0), b = pad(-8, 8, -32, -12, 0), c = pad(-7, 7, -58, -44, 9), d = pad(-10, 10, -92, -69, 9);
  A.addBox(-8.2, -7, 9, 18, -72, -52, A.mats.stone); // the wall beside the last gap: jump at it to plant, jump again to push off
  // gold markers: the lip to hook, and where the dummy stands
  { const lip = new THREE.Mesh(new THREE.BoxGeometry(14, 0.25, 0.25), gold); lip.position.set(0, 8.9, -43.9); S.add(lip);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 6, 40).rotateX(Math.PI / 2), gold); ring.position.set(0, 0.05, -24); S.add(ring);
    for (const [x, y, z] of [[0, 0.05, -10], [0, 9.05, -60], [0, 9.05, -71]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(3, 0.06, 0.3), gold); m.position.set(x, y, z); S.add(m); } }
  A.link('P' + a.i, 'P' + b.i); A.link('P' + b.i, 'P' + c.i); A.link('P' + c.i, 'P' + d.i);
  A.dummyAt = new THREE.Vector3(0, 0, -24); A.arenaAt = new THREE.Vector3(0, 9, -84);
  A.spawnOk = (sp) => sp.plat === A.cp; // (fall, and you are back on the last platform you reached)
  A.fallText = () => 'fell off the training ground'; A.fallBy = () => 'You fell: try again';
  A.finishNav();
}
