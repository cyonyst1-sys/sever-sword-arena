// The shop screen: browse by category, try things on a turning, swinging preview fighter, buy and equip.
import * as THREE from 'three';
import { Fighter, PALETTE, setMetalEnv, metalEnvFor } from './fighter.js?v=20261113231000';
import { Particles, Pieces, bakeMeshes } from './slice.js?v=20261113231000';
import { makeKillFx } from './killfx.js?v=20261113231000';
import { makeGrapple } from './grapple.js?v=20261113231000';
import { CATEGORIES, CATALOG, item, profile, owns, buy, equip } from './cosmetics.js?v=20261113231000';

const $ = (id) => document.getElementById(id);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export function initShop({ show, onClose }) {
  let cat = 'mask', sel = profile.equip.mask, open = false, f = null, lookKey = '', raf = 0, last = 0, t0 = 0;

  // ---- preview scene (its own small renderer, only running while the shop is open)
  const canvas = $('shopCanvas');
  let renderer = null, shopEnv = null;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff1e0, 0x2a2420, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 4, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 1.2); rim.position.set(-3, 2, -3); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(32, 300 / 380, 0.05, 50);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; scene.add(floor);
  const fx = { ember: null, petal: null, zap: null };
  const noGround = () => -10;
  fx.ember = new Particles(scene, noGround, { color: 0xffa040, size: 0.03, gravity: -2, max: 300 });
  fx.petal = new Particles(scene, noGround, { color: 0xffb7d5, size: 0.05, gravity: 2.5, max: 300 });
  fx.zap = new Particles(scene, noGround, { color: 0xbff0ff, size: 0.025, gravity: 0, max: 300 });
  fx.smoke = new Particles(scene, noGround, { color: 0x1a1020, size: 0.14, gravity: -0.5, max: 300 });
  // kill-effect demo: the preview fighter is cut down every few seconds and the pieces land on the floor disc
  const floorAt = (x, z, y) => (y > -0.5 && Math.hypot(x, z) < 3 ? 0 : -Infinity);
  const blood = new Particles(scene, floorAt, { color: 0x8a0a10, size: 0.035, max: 800, decals: true });
  const pieces = new Pieces(scene, floorAt, blood), kfx = makeKillFx(scene, floorAt, { sound: false });
  let grap = null, grapId = '', killT = 0, dead = false;
  const GRAP_AT = new THREE.Vector3(0.8, 2.7, -0.6);
  const camAt = { pos: new THREE.Vector3(0.9, 1.25, -3.9), look: new THREE.Vector3(0, 1.0, 0) };

  // the look being shown: what you wear, with the selected item tried on
  const tryLook = () => ({ ...profile.equip, [cat]: sel });
  function rebuild() {
    const look = tryLook(), k = JSON.stringify(look);
    if (k === lookKey && f) return;
    lookKey = k;
    if (f) f.removeFrom(scene);
    f = new Fighter({ id: 'preview', name: null, color: PALETTE[0], team: 'p', look });
    f.alive = true; f.onGround = true; f.addTo(scene);
    if (look.grapple !== grapId) { if (grap) grap.dispose(); grapId = look.grapple; grap = makeGrapple(scene, item('grapple', grapId), fx); }
    pieces.clear(); dead = false; killT = 0;
  }

  // ---- UI
  function renderTabs() {
    $('shopTabs').innerHTML = CATEGORIES.map((c) => `<button data-c="${c.id}" class="${c.id === cat ? 'on' : ''}">${c.name}</button>`).join('');
  }
  function renderGrid() {
    $('shopGrid').innerHTML = CATALOG[cat].map((it) => {
      const own = owns(cat, it.id), eq = profile.equip[cat] === it.id;
      const st = eq ? '<span class="pr eq">Equipped</span>' : own ? '<span class="pr">Owned</span>' : `<span class="pr ${profile.coins < it.price ? 'no' : ''}"><span class="coin"></span>${it.price}</span>`;
      const sw = it.id === 'rainbow' ? 'linear-gradient(90deg,#ff4a4a,#ffd24a,#4aff7a,#4ab0ff,#c04aff)' : `linear-gradient(135deg, ${hex(it.sw)}, ${hex(it.sw)}aa)`;
      return `<button class="card ${it.id === sel ? 'sel' : ''}" data-id="${it.id}"><div class="sw" style="background:${sw}"></div><span class="nm">${it.name}</span>${st}</button>`;
    }).join('');
  }
  function renderAction() {
    const it = item(cat, sel), own = owns(cat, sel), eq = profile.equip[cat] === sel, b = $('shopAction');
    $('shopItemName').textContent = it.name;
    $('shopCoins').textContent = profile.coins;
    if (eq) { b.textContent = 'Equipped'; b.disabled = true; }
    else if (own) { b.textContent = 'Equip'; b.disabled = false; }
    else if (profile.coins >= it.price) { b.textContent = `Buy for ${it.price}`; b.disabled = false; }
    else { b.textContent = `Need ${it.price - profile.coins} more coins`; b.disabled = true; }
  }
  const refresh = () => { renderTabs(); renderGrid(); renderAction(); rebuild(); };

  $('shopTabs').addEventListener('click', (e) => { const c = e.target.closest('button')?.dataset.c; if (c) { cat = c; sel = profile.equip[c]; refresh(); } });
  $('shopGrid').addEventListener('click', (e) => { const id = e.target.closest('.card')?.dataset.id; if (id) { sel = id; refresh(); } });
  $('shopAction').addEventListener('click', () => {
    if (!owns(cat, sel) && !buy(cat, sel)) return;
    equip(cat, sel); refresh();
  });
  $('shopClose').addEventListener('click', () => { open = false; cancelAnimationFrame(raf); onClose(); });

  // ---- preview animation: turn slowly, swing every couple of seconds so the trail shows
  function frame(ms) {
    if (!open) return;
    raf = requestAnimationFrame(frame);
    const t = ms / 1000, dt = Math.min(0.05, last ? t - last : 0.016); last = t;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w * devicePixelRatio || canvas.height !== h * devicePixelRatio) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    const lt = t - t0;
    f.yaw = Math.sin(lt * 0.5) * 0.7; // turns to show off the front and sides
    const ph = lt % 1.8; // a slash, then back to guard
    if (ph < 0.22) { const u = ph / 0.22; f.s.x = -0.95 + 1.9 * u; f.s.y = 0.7 - 1.3 * u; }
    else { const u = Math.min(1, (ph - 0.22) / 0.6); f.s.x = 0.95 + (0.42 - 0.95) * u; f.s.y = -0.6 + (0.38 + 0.6) * u; }
    f.pose(dt); f.updateTrail(lt);
    const tf = fx[f.trailStyle.fx];
    if (tf && !dead && f.tipSpeed > 6) for (let k = 0; k < 2; k++) { const p = f.hand.clone().lerp(f.tip, 0.4 + Math.random() * 0.6), j = f.trailStyle.fx === 'zap' ? 3 : 0.8; tf.emit(p.x, p.y, p.z, (Math.random() - 0.5) * j, (Math.random() - 0.3) * j, (Math.random() - 0.5) * j, f.trailStyle.fx === 'zap' ? 0.15 : 0.8); }
    for (const p of Object.values(fx)) p.update(dt);
    // kill effects tab: cut the fighter down along a slanted line, then bring them back
    if (cat === 'kill') {
      killT += dt;
      if (!dead && killT > 0.9) {
        dead = true; f.pose(0);
        const n = new THREE.Vector3(0.8, 0.55, 0.25).normalize(), pt = f.pos.clone().add(new THREE.Vector3(0, 1.15, 0));
        const burst = kfx.burstFor(sel), at = pieces.split(bakeMeshes(f.meshes), n, -n.dot(pt), new THREE.Vector3(), new THREE.Vector3(0, 0.5, 1.2), 1, burst);
        if (at) kfx.apply(sel, at, n, pieces.last);
        f.group.visible = false; f.trailMesh.visible = false;
      }
      if (killT > 3.4) { pieces.clear(); if (blood.decals) blood.decals.count = 0; dead = false; killT = 0; f.group.visible = true; f.trailMesh.visible = true; }
    } else if (dead) { pieces.clear(); dead = false; killT = 0; f.group.visible = true; f.trailMesh.visible = true; }
    pieces.update(dt); blood.update(dt); kfx.update(dt);
    // grapples tab: hold a line up to a hook point
    if (cat === 'grapple' && grap) grap.show(f.handL, GRAP_AT, dt); else if (grap) grap.hide();
    // head items get a close-up; the rest show the whole fighter
    const close = cat === 'mask' || cat === 'hat';
    const wide = cat === 'grapple';
    camAt.pos.lerp(close ? _v.set(0.4, 1.7, -1.5) : wide ? _v.set(1.4, 1.8, -4.6) : _v.set(0.9, 1.25, -3.9), Math.min(1, dt * 5));
    camAt.look.lerp(close ? _v.set(0, 1.66, 0) : wide ? _v.set(0.3, 1.55, 0) : _v.set(0, 1.0, 0), Math.min(1, dt * 5));
    camera.position.copy(camAt.pos); camera.lookAt(camAt.look);
    renderer.render(scene, camera);
  }
  const _v = new THREE.Vector3();

  return {
    open() {
      if (!renderer) { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); renderer.setPixelRatio(devicePixelRatio); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; shopEnv = metalEnvFor(renderer); }
      setMetalEnv(shopEnv); // the preview has its own renderer, so its own reflection map (the game's goes back on close)
      show('shop'); open = true; sel = profile.equip[cat]; lookKey = ''; refresh();
      last = 0; t0 = performance.now() / 1000; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    },
  };
}
