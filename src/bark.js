// The bark on the trees: a photographed bark (its colour, and the relief of its furrows as a normal map), tiled.
// Two images in src/textures, fetched once at start and shared by every tree in every map.
import * as THREE from 'three';

const imgs = {}, waiting = { color: [], normal: [] };
for (const k of ['color', 'normal']) new THREE.ImageLoader().load(new URL(`./textures/bark_${k}.jpg` + new URL(import.meta.url).search, import.meta.url).href,
  (im) => { imgs[k] = im; for (const t of waiting[k]) { t.image = im; t.needsUpdate = true; } waiting[k].length = 0; });
const tex = (k, rx, ry) => { const t = new THREE.Texture(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; if (k === 'color') t.colorSpace = THREE.SRGBColorSpace;
  if (imgs[k]) { t.image = imgs[k]; t.needsUpdate = true; } else waiting[k].push(t); return t; }; // (a tree built before the image arrives picks it up when it does)

/** The bark's colour image alone, tiled rx by ry (for far-off scenery). */
export const barkMap = (rx = 1, ry = 1) => tex('color', rx, ry);
/** A bark material. Its tiling comes from the shape's own UVs: see barkUV. */
export const barkMat = (o = {}) => new THREE.MeshStandardMaterial({ map: tex('color', 1, 1), normalMap: tex('normal', 1, 1), normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.95, ...o });
/** Tile the bark on a trunk, limb or knot in proportion to its size: around is the distance round it and along its length, in
 *  metres. One sheet of bark wraps right round whatever the size (so a giant trunk gets giant plates of bark and nothing
 *  repeats in a small grid), and repeats up the length at that same size. */
export function barkUV(geo, around, along) {
  const ru = 1, tile = around / ru, rv = Math.max(0.5, along / tile), uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv);
  uv.needsUpdate = true; return geo;
}
