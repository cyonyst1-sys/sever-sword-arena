// A fighter's body from a model file instead of the built-in one: a long coat with a sash, trousers and boots, in one
// skinned piece. The file (src/models/*.bin, made by tools/model-import) already holds the figure in the game's own
// T-pose and proportions with a weight for every bone, so here it only has to be loaded, given bones, and have those
// bones follow the joints the pose works out every frame, exactly as the built-in body's do.
// The head, hands and sword stay the game's own parts.
import * as THREE from 'three';

const _a = new THREE.Vector3();
// bones: [name, from joint, to joint (none: a foot, which takes the foot's own tilt), the way it points in the T-pose]
const BONES = [
  ['hips', 'pelvis', 'waist', [0, 1, 0]], ['spine', 'waist', 'neckBase', [0, 1, 0]], ['neck', 'neckBase', 'headBase', [0, 1, 0]],
  ['uaR', 'shR', 'elR', [1, 0, 0]], ['faR', 'elR', 'handR', [1, 0, 0]], ['uaL', 'shL', 'elL', [-1, 0, 0]], ['faL', 'elL', 'handL', [-1, 0, 0]],
  ['thR', 'hipR', 'kneeR', [0, -1, 0]], ['shnR', 'kneeR', 'footR', [0, -1, 0]], ['thL', 'hipL', 'kneeL', [0, -1, 0]], ['shnL', 'kneeL', 'footL', [0, -1, 0]],
  ['ftR', 'footR', null, null], ['ftL', 'footL', null, null],
];
// where each joint is in that T-pose (metres, the fighter's own space; the same numbers the import tool fitted the figure to)
const TP = { pelvis: [0, 0.99, 0], waist: [0, 1.14, 0], neckBase: [0, 1.49, 0], headBase: [0, 1.61, 0] };
for (const [s, g] of [['R', 1], ['L', -1]]) Object.assign(TP, { ['sh' + s]: [0.22 * g, 1.46, 0], ['el' + s]: [0.519 * g, 1.46, 0], ['hand' + s]: [0.798 * g, 1.46, 0], ['hip' + s]: [0.095 * g, 0.93, 0], ['knee' + s]: [0.095 * g, 0.47, 0], ['foot' + s]: [0.095 * g, 0.01, 0] });

const GEO = {}; // name -> geometry, once its file has arrived
export const modelReady = (name) => !!GEO[name];
/** Fetch a body file. Materials, in the file's order: coat, sash, under-robe, skin, trousers, boots. */
export function loadModel(name) {
  const url = new URL(`./models/${name}.bin` + new URL(import.meta.url).search, import.meta.url);
  return fetch(url).then((r) => { if (!r.ok) throw new Error('model ' + r.status); return r.arrayBuffer(); }).then((buf) => {
    const dv = new DataView(buf); if (dv.getUint32(0, true) !== 0x314d5653) throw new Error('not a body file');
    const nv = dv.getUint32(4, true), ni = dv.getUint32(8, true), ng = dv.getUint32(12, true), head = 16 + ng * 8, g = new THREE.BufferGeometry();
    const pos = new Float32Array(buf.slice(head, head + nv * 12)), uv = new Float32Array(nv * 2);
    for (let v = 0; v < nv; v++) { uv[v * 2] = (pos[v * 3] - pos[v * 3 + 2]) * 4; uv[v * 2 + 1] = pos[v * 3 + 1] * 4; } // (enough for the cloth's weave to lie on it)
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint8Array(buf, head + nv * 12, nv * 4), 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from(new Uint8Array(buf, head + nv * 16, nv * 4), (b) => b / 255), 4));
    g.setIndex(new THREE.BufferAttribute(new Uint16Array(buf.slice(head + nv * 20, head + nv * 20 + ni * 2)), 1));
    for (let i = 0; i < ng; i++) g.addGroup(dv.getUint32(16 + i * 8, true), dv.getUint32(20 + i * 8, true), i);
    g.computeVertexNormals(); GEO[name] = g; return g;
  }).catch((e) => { console.warn('body model not loaded:', e.message); return null; });
}

/** A body for one fighter (the geometry is shared; the bones are its own). mats: one material per group in the file. */
export function buildModelBody(name, mats) {
  const bones = BONES.map(([n, a]) => { const b = new THREE.Bone(); b.name = n; b.position.fromArray(TP[a]); return b; });
  const mesh = new THREE.SkinnedMesh(GEO[name], mats);
  for (const b of bones) mesh.add(b);
  mesh.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones));
  mesh.frustumCulled = false; mesh.castShadow = true;
  mesh.userData.bind = BONES.map(([, , , d]) => (d ? new THREE.Vector3().fromArray(d) : null));
  return mesh;
}

/** Move the body's bones to where fighter f's joints are this frame. */
export function poseModelBody(f) {
  const m = f.body, J = f.J, bones = m.skeleton.bones, bind = m.userData.bind;
  for (let i = 0; i < BONES.length; i++) {
    const [n, a, z] = BONES[i], b = bones[i];
    b.position.copy(J[a]);
    if (z) b.quaternion.setFromUnitVectors(bind[i], _a.subVectors(J[z], J[a]).normalize());
    else b.rotation.set(f.p[n === 'ftR' ? 'ftR' : 'ftL'].rotation.x, 0, 0); // (a foot: flat on the ground, tipping with the toe)
  }
}
