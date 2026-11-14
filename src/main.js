import * as THREE from 'three';
import { Arena, MAPS } from './arena.js?v=20261113204137';
import { Fighter, PALETTE, GUARD } from './fighter.js?v=20261113204137';
import { bakeMeshes, Pieces, Particles } from './slice.js?v=20261113204137';
import { sfx, ensureAudio, setListener, setVolume } from './audio.js?v=20261113204137';
import * as net from './net.js?v=20261113204137';
import { MODES, POINT_MODES, MODE_GOAL, ModeFx, makeCrown } from './modes.js?v=20261113204137';
import { profile, addCoins, randomLook, cleanLook, item } from './cosmetics.js?v=20261113204137';
import { makeKillFx } from './killfx.js?v=20261113204137';
import { makeGrapple } from './grapple.js?v=20261113204137';
import { initShop } from './shop.js?v=20261113204137';

// ---------- settings ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
};
const settings = Object.assign({ name: '', look: 1, blade: 1, quality: 'high', vol: 0.6 }, store.get('sever-settings', {}));
const saveSettings = () => store.set('sever-settings', settings);
const $ = (id) => document.getElementById(id);

// ---------- three ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.quality === 'low' ? 1 : 2));
renderer.shadowMap.enabled = settings.quality !== 'low';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 900);
function resize() { renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();

let arena = new Arena(scene, settings.quality, 'spire');
// switch maps (between matches): drop the old one and build the new
function useMap(id) { if (!MAPS[id]) id = 'spire'; if (arena.mapId === id && !arena.dirty) return; // (also rebuild after platforms have crumbled)
  arena.dispose(); arena = new Arena(scene, settings.quality, id); }
const ground = (x, z, y) => arena.groundHeight(x, z, y);
const blood = new Particles(scene, ground, { color: 0x8a0a10, size: 0.07, decals: true, max: 2400 });
const sparks = new Particles(scene, ground, { color: 0xffd27a, size: 0.06, gravity: 6, max: 400 });
const leafBits = new Particles(scene, ground, { color: 0x9ccf5c, size: 0.09, gravity: 9, max: 300 }); // bamboo chips
const killFx = makeKillFx(scene, ground); // kill effects from the shop
// sword-trail effects from the shop
const trailFx = {
  ember: new Particles(scene, ground, { color: 0xffa040, size: 0.05, gravity: -2, max: 500 }),
  petal: new Particles(scene, ground, { color: 0xffb7d5, size: 0.08, gravity: 2.5, max: 500 }),
  zap: new Particles(scene, ground, { color: 0xbff0ff, size: 0.04, gravity: 0, max: 400 }),
};
const grapFx = { smoke: new Particles(scene, ground, { color: 0x1a1020, size: 0.22, gravity: -0.5, max: 400 }), zap: trailFx.zap }; // grapple styles
const pieces = new Pieces(scene, ground, blood);
const fx = new ModeFx(scene); // throne, shrines, heads

// ---------- constants ----------
const G = 24, JUMP_V = 8.8, WALK = 12.5, DASH_V = 34, DASH_T = 0.38, CUT_SPD = 7, RAD = 0.38, HGT = 1.8;
const PULL = 34, REEL = 11, HOOK_MAX = 60;
const FFA_KILLS = 15, FFA_TIME = 300, MAX_PLAYERS = 8;
// every kill makes your sword longer (and your reach with it)
const BLADE_BASE = 1.12, BLADE_PER_KILL = 0.08, BLADE_MAX = 3.0;
const bladeFor = (k) => Math.min(BLADE_MAX, BLADE_BASE + (k || 0) * BLADE_PER_KILL);
const BOT_NAMES = ['Kaito', 'Ren', 'Hana', 'Jiro', 'Mika', 'Sora', 'Yuki', 'Taro', 'Aki', 'Nobu', 'Kenji', 'Rin', 'Daichi', 'Emi'];
const DIFF = [
  { wind: 0.62, cd: [1.0, 1.8], evade: 0.12, dash: 0.12, turn: 5, hookCd: 3, roam: 0.3, cross: 0.8 },
  { wind: 0.48, cd: [0.7, 1.3], evade: 0.3, dash: 0.25, turn: 7.5, hookCd: 1.4, roam: 0.6, cross: 2.5 },
  { wind: 0.36, cd: [0.4, 0.9], evade: 0.5, dash: 0.45, turn: 11, hookCd: 0.8, roam: 0.9, cross: 4 },
];
const PATTERNS = [
  [{ x: -1.0, y: 0.25 }, { x: 1.0, y: -0.15 }], [{ x: 1.0, y: 0.25 }, { x: -1.0, y: -0.15 }],
  [{ x: 0.75, y: 0.8 }, { x: -0.7, y: -0.75 }], [{ x: -0.75, y: 0.8 }, { x: 0.7, y: -0.75 }],
  [{ x: 0.1, y: 1.0 }, { x: -0.05, y: -0.9 }],
];

// ---------- session ----------
const S = {
  phase: 'menu', mode: 'ffa', map: 'spire', bots: 5, diff: 1, host: true, online: false, pub: true,
  myId: 'host', roster: [], obj: null, timeLeft: FFA_TIME, wave: 0, waveT: 3, waveActive: false, queue: 0, spawnT: 0, seq: 0, paused: false,
};
const fighters = new Map();
let me = null;
const rosterGet = (id) => S.roster.find((r) => r.id === id);
const isEnemy = (a, b) => a.team !== b.team;
const now = () => performance.now() / 1000;

function makeFighter(info) {
  const f = new Fighter({ id: info.id, name: info.id === S.myId ? null : info.name, color: PALETTE[info.col % PALETTE.length], team: info.team, isBot: !info.human, horde: !!info.horde, look: info.look });
  f.addTo(scene); f.group.visible = false; f.trailMesh.visible = true;
  f.net = null; f.respawnAt = Infinity;
  f.grap = makeGrapple(scene, item('grapple', f.look.grapple), grapFx); // their grappling hook, in their style
  f.crown = makeCrown(); f.crown.visible = false; f.group.add(f.crown); // worn by the juggernaut
  fighters.set(info.id, f);
  return f;
}
function dropFighter(id) {
  const f = fighters.get(id); if (!f) return;
  f.removeFrom(scene); f.grap.dispose(); fighters.delete(id);
  if (me === f) me = null;
}
function syncFighters() {
  for (const r of S.roster) if (!fighters.has(r.id)) makeFighter(r);
  for (const id of [...fighters.keys()]) if (!S.roster.some((r) => r.id === id)) dropFighter(id);
  for (const r of S.roster) { const f = fighters.get(r.id); if (f) f.team = r.team; } // teams can change mid-match (Juggernaut)
  me = fighters.get(S.myId) || null;
}
function clearWorld() {
  for (const id of [...fighters.keys()]) dropFighter(id);
  pieces.clear();
}

// ---------- input ----------
const keys = {};
const mouse = { lmb: false, lmbT: 0, drag: 0, rmb: false, gx: 0, gy: 0 };
// A tap is a quick slash; only holding the button past HOLD takes manual control of the sword. Until then
// the mouse keeps turning the camera, so you can spam quick slashes while you look around.
const HOLD = 0.12;
const swingHeld = () => mouse.lmb && now() - mouse.lmbT >= HOLD;
let locked = false;
let quickDir = 1;
canvas.addEventListener('mousedown', (e) => {
  ensureAudio();
  if (S.phase !== 'game') return;
  if (!locked) { lockPointer(); return; }
  if (e.button === 0) { mouse.lmb = true; mouse.lmbT = now(); mouse.drag = 0; mouse.gx = mouse.gy = 0; }
  if (e.button === 2) { mouse.rmb = true; if (me && me.alive) fireHook(me); }
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0 && mouse.lmb) {
    mouse.lmb = false;
    if (me && me.alive && now() - mouse.lmbT < 0.2 && mouse.drag < 0.25) quickSwing(me, mouse.gx, mouse.gy);
  }
  if (e.button === 2) { mouse.rmb = false; if (me && me.hook) releaseHook(me, true); }
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('mousemove', (e) => {
  if (!locked || !me || S.phase !== 'game') return;
  const dx = e.movementX || 0, dy = e.movementY || 0;
  if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return; // browser glitch spikes
  const k = 0.0022 * settings.look;
  if (mouse.lmb) { mouse.gx += dx; mouse.gy += dy; } // which way you were moving during a tap: the quick slash follows it
  if (swingHeld() && me.alive) {
    if (me.anim && me.anim.phase !== 'strike') me.anim = null; // taking manual control
    // swinging: the sword takes most of the motion, the body twists less, the camera turns least
    const ks = 0.0042 * settings.blade;
    me.s.x += dx * ks; me.s.y -= dy * ks;
    const r = Math.hypot(me.s.x, me.s.y); if (r > 1.05) { me.s.x *= 1.05 / r; me.s.y *= 1.05 / r; }
    mouse.drag += Math.hypot(dx, dy) * ks;
    twist.yaw = Math.max(-1.3, Math.min(1.3, twist.yaw - dx * k * 0.45));
    twist.pitch = Math.max(-0.6, Math.min(0.6, twist.pitch - dy * k * 0.35));
    view.yaw -= dx * k * 0.15; view.pitch = Math.max(-1.25, Math.min(1.25, view.pitch - dy * k * 0.15));
  } else {
    view.yaw -= dx * k; view.pitch = Math.max(-1.25, Math.min(1.25, view.pitch - dy * k));
  }
});
// The camera's angles, and how far the body is twisted away from them while swinging.
const view = { yaw: 0, pitch: 0 }, twist = { yaw: 0, pitch: 0 };
function viewDir(out) { const c = Math.cos(view.pitch); return out.set(-Math.sin(view.yaw) * c, Math.sin(view.pitch), -Math.cos(view.yaw) * c); }
window.addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  if (S.phase !== 'game' || !me) return;
  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat && me.alive && locked) tryDash(me, viewDir(new THREE.Vector3()));
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.lmb = false; if (me && me.hook) releaseHook(me, false); });
function lockPointer() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (S.phase !== 'game') return;
  if (locked) { $('pause').classList.add('hidden'); $('clickPlay').classList.add('hidden'); S.paused = false; }
  else {
    mouse.lmb = false; if (me && me.hook) releaseHook(me, false);
    $('pause').classList.remove('hidden');
    $('pauseNote').textContent = S.online ? 'The match keeps going while this menu is open.' : '';
    if (!S.online) S.paused = true;
  }
});

function lookDir(f, out) {
  const c = Math.cos(f.pitch);
  return out.set(-Math.sin(f.yaw) * c, Math.sin(f.pitch), -Math.cos(f.yaw) * c);
}

// ---------- movement ----------
const _t = new THREE.Vector3(), _t2 = new THREE.Vector3(), _t3 = new THREE.Vector3();
// the canopy branch a fighter is standing on (or just above), if any
function branchUnder(f) {
  let best = null, bd = 0.9;
  for (const p of arena.plats) if (p.kind === 'branch' && !p.gone && arena.inPlat(p, f.pos, 0.4)) { const d = Math.abs(arena.platTop(p, f.pos) - f.pos.y); if (d < bd) { bd = d; best = p; } }
  return best;
}
function tryDash(f, dir) {
  if (f.dashCd > 0 || f.stam < 22 || !f.alive) return false;
  const d = dir.clone(); d.y = Math.max(-0.35, Math.min(0.55, d.y)); d.normalize();
  f.preDash = f.vel.length(); // a dash out of a fast swing keeps that speed afterwards
  f.dashGround = f.onGround || !!branchUnder(f);
  f.dashDir.copy(d); f.dashT = DASH_T; f.dashCd = 0.9; f.stam -= 22; f.stamDelay = 0.6;
  if (f.hook) releaseHook(f, false);
  f.dashVictims = new Set();
  sfx.dash(f.pos);
  if (f === me) shake = Math.max(shake, 0.15);
  return true;
}
function fireHook(f, origin, dir) {
  if (!f.alive || (f.hookCd || 0) > 0) return false;
  if (!origin) { origin = camera.position.clone(); dir = new THREE.Vector3(); camera.getWorldDirection(dir); origin.addScaledVector(dir, camDist); }
  const h = arena.grappleTarget(origin, dir, HOOK_MAX);
  f.hookCd = 0.25;
  if (!h) { sfx.hookFire(f.pos); return false; }
  const chest = _t.copy(f.pos); chest.y += 1.3;
  const L = h.point.distanceTo(chest);
  if (L > HOOK_MAX || L < 1.4) return false;
  f.hook = { p: h.point, len: L };
  f.dashT = 0; f.onGround = false;
  sfx.hookFire(f.pos); sfx.hookHit(h.point);
  return true;
}
function releaseHook(f, boost) {
  if (!f.hook) return;
  f.hook = null;
  if (boost) { lookDir(f, _t); f.vel.addScaledVector(_t, 3); f.vel.y += 2.5; }
}
function applyHook(f, dt) {
  const chest = _t.copy(f.pos); chest.y += 1.3;
  const d = _t2.subVectors(f.hook.p, chest); const L = d.length(); d.divideScalar(L || 1);
  f.vel.addScaledVector(d, PULL * dt);
  f.hook.len = Math.max(1.2, Math.min(f.hook.len, L) - REEL * dt);
  const vr = f.vel.dot(d); if (L > f.hook.len && vr < 0) f.vel.addScaledVector(d, -vr);
  const sp = f.vel.length(); if (sp > 36) f.vel.multiplyScalar(36 / sp);
  if (L < 1.7) { // reeled all the way in: pop up, and if it's a platform's edge, onto its top
    const a = f.hook.p; f.hook = null;
    const lip = arena.plats.find((p) => !p.gone && arena.inPlat(p, a, 0.3) && Math.abs(a.y - arena.platTop(p, a)) < 0.6);
    if (lip) {
      const cx = lip.x - f.pos.x, cz = lip.z - f.pos.z, cl = Math.hypot(cx, cz) || 1;
      f.vel.set(cx / cl * 4.5, Math.max(8, f.vel.y * 0.3), cz / cl * 4.5);
      f.mantle = { x: cx / cl * 4.5, z: cz / cl * 4.5, t: 0.35 }; // keep climbing over the lip
    } else { f.vel.y = Math.max(f.vel.y, 7); f.vel.x += d.x * 3; f.vel.z += d.z * 3; }
  }
}
function stepFighter(f, dt, wish, sprint, jump) {
  f.dashCd -= dt; f.padCd -= dt; f.prot -= dt; f.stagger -= dt; f.hookCd = (f.hookCd || 0) - dt; f.swishCd -= dt;
  const wl = Math.hypot(wish.x, wish.z);
  if (f.dashT > 0) {
    f.dashT -= dt; f.vel.copy(f.dashDir).multiplyScalar(DASH_V);
    // dashing along a branch: follow it round its bends and up or down its slope instead of flying off straight
    const br = f.dashGround && branchUnder(f);
    if (br) {
      const ax = Math.cos(br.ang), az = Math.sin(br.ang), dp = f.dashDir.x * ax + f.dashDir.z * az;
      if (Math.abs(dp) > 0.55) {
        const sg = Math.sign(dp), lat = arena.platFrame(br, f.pos)[1];
        let hx = ax * sg + az * lat * 0.6, hz = az * sg - ax * lat * 0.6; const hl = Math.hypot(hx, hz); hx /= hl; hz /= hl; // and drift back to the middle
        f.dashDir.set(hx, 0, hz);
        f.vel.set(hx * DASH_V, (br.yb - br.ya) / br.w * sg * DASH_V, hz * DASH_V);
      }
    }
    if (f.dashT <= 0) f.vel.copy(f.dashDir).multiplyScalar(Math.max(DASH_V * 0.45, Math.min(f.preDash || 0, 36)));
  } else {
    if (f.onGround && !f.hook) {
      const spd = WALK;
      const k = Math.min(1, 16 * dt);
      f.vel.x += (wish.x * spd - f.vel.x) * k; f.vel.z += (wish.z * spd - f.vel.z) * k;
    } else { // air: keep momentum, steer a little
      const hs = Math.hypot(f.vel.x, f.vel.z);
      f.vel.x += wish.x * 32 * dt; f.vel.z += wish.z * 32 * dt; // strong air steering to line up landings
      const ns = Math.hypot(f.vel.x, f.vel.z), cap = Math.max(hs, WALK);
      if (ns > cap) { f.vel.x *= cap / ns; f.vel.z *= cap / ns; }
      if (!f.padFlight) { f.vel.x *= 1 - 0.12 * dt; f.vel.z *= 1 - 0.12 * dt; } // pad jumps fly their exact arc
    }
    f.vel.y -= G * dt;
    if (f.mantle) { f.mantle.t -= dt; f.vel.x = f.mantle.x; f.vel.z = f.mantle.z; if (f.mantle.t <= 0 || f.onGround || f.hook) f.mantle = null; }
    if (jump && f.onGround) {
      const p = f.padCd <= 0 && arena.padAt(f.pos);
      if (p) { f.vel.copy(p.v); f.padCd = 0.8; f.hook = null; f.padFlight = true; sfx.pad(f.pos); } // jump on a pad to launch
      else { f.vel.y = JUMP_V; sfx.jump(f.pos); }
      f.onGround = false;
    }
    if (f.hook) applyHook(f, dt);
  }
  f.prevPos.copy(f.pos);
  const was = f.onGround, fallV = f.vel.y;
  // fast moves (dashes, swings) go in short steps so a sloped branch can't be skipped past
  const n = Math.min(6, Math.ceil(f.vel.length() * dt / 0.35)) || 1;
  for (let k = 0; k < n; k++) {
    const py = f.pos.y; f.pos.addScaledVector(f.vel, dt / n);
    f.onGround = arena.collide(f.pos, f.vel, RAD, HGT, (k ? f.onGround : was) && f.dashT <= 0 && !f.hook, py);
  }
  if (f.hook) { // rope can't stretch
    const c = _t.copy(f.pos); c.y += 1.3; const d = _t2.subVectors(f.hook.p, c); const L = d.length();
    if (L > f.hook.len + 0.05) f.pos.addScaledVector(d.divideScalar(L), L - f.hook.len);
    if (f.onGround && f.hook.p.y > f.pos.y + 1) f.onGround = false;
  }
  if (f.onGround && !was && fallV < -6) sfx.land(f.pos);
  if (f.onGround || f.hook || f.dashT > 0) f.padFlight = false;
  f.stamDelay -= dt; if (f.stamDelay <= 0) f.stam = Math.min(100, f.stam + 30 * dt);
  f.stam = Math.max(0, f.stam);
}
function pushApart() {
  const list = [...fighters.values()].filter((f) => f.alive);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (Math.abs(a.pos.y - b.pos.y) > 1.6) continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = RAD * 2;
    if (d > 0.001 && d < m) {
      const p = (m - d) / 2, la = isLocal(a), lb = isLocal(b);
      if (la) { a.pos.x -= dx / d * p * (lb ? 1 : 2); a.pos.z -= dz / d * p * (lb ? 1 : 2); }
      if (lb) { b.pos.x += dx / d * p * (la ? 1 : 2); b.pos.z += dz / d * p * (la ? 1 : 2); }
    }
  }
}
const isLocal = (f) => f === me || (S.host && f.isBot);

// ---------- swords ----------
function quickSwing(f, gx = 0, gy = 0) {
  quickDir = -quickDir;
  let pat = [{ x: -1.0 * quickDir, y: 0.2 }, { x: 1.0 * quickDir, y: -0.15 }];
  const gl = Math.hypot(gx, gy);
  if (gl > 12) { const ux = gx / gl, uy = -gy / gl; pat = [{ x: -ux, y: -uy * 0.8 + 0.1 }, { x: ux, y: uy * 0.8 - 0.05 }]; quickDir = ux > 0 ? 1 : -1; } // slash the way the mouse was moving
  f.s.x = pat[0].x; f.s.y = pat[0].y; f.noCut = true;
  f.anim = { phase: 'strike', t: 0, from: pat[0], to: pat[1], dur: 0.14 };
}
function updateSword(f, dt) {
  const a = f.anim;
  const ease = (t) => 1 - Math.pow(1 - Math.min(1, t), 3);
  if (f.stagger > 0) { f.anim = null; f.armed = false; towardGuard(f, dt, 3.5); return; }
  if (a) {
    a.t += dt;
    if (a.phase === 'wind') {
      const k = ease(a.t / a.dur); f.s.x = a.s0.x + (a.from.x - a.s0.x) * k; f.s.y = a.s0.y + (a.from.y - a.s0.y) * k; f.armed = false;
      if (a.t >= a.dur) { a.phase = 'strike'; a.t = 0; a.dur = 0.13; }
    } else if (a.phase === 'strike') {
      const k = ease(a.t / a.dur); f.s.x = a.from.x + (a.to.x - a.from.x) * k; f.s.y = a.from.y + (a.to.y - a.from.y) * k; f.armed = true;
      if (a.t >= a.dur) { a.phase = 'rec'; a.t = 0; }
    } else { f.armed = !f.isBot; if (a.t > 0.18) f.anim = null; }
  } else {
    f.armed = !f.isBot;
    if (!(f === me && swingHeld())) towardGuard(f, dt, 1.4);
  }
}
function towardGuard(f, dt, rate) {
  const dx = GUARD.x - f.s.x, dy = GUARD.y - f.s.y, d = Math.hypot(dx, dy), st = rate * dt;
  if (d <= st) { f.s.x = GUARD.x; f.s.y = GUARD.y; } else { f.s.x += dx / d * st; f.s.y += dy / d * st; }
}

// segment-segment closest points (Ericson), returns squared distance; c1/c2 receive the points
function segSeg(p1, q1, p2, q2, c1, c2) {
  const d1x = q1.x - p1.x, d1y = q1.y - p1.y, d1z = q1.z - p1.z, d2x = q2.x - p2.x, d2y = q2.y - p2.y, d2z = q2.z - p2.z;
  const rx = p1.x - p2.x, ry = p1.y - p2.y, rz = p1.z - p2.z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z, f = d2x * rx + d2y * ry + d2z * rz;
  let s, t; const cl = (v) => Math.max(0, Math.min(1, v));
  if (a < 1e-9 && e < 1e-9) { s = t = 0; }
  else if (a < 1e-9) { s = 0; t = cl(f / e); }
  else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e < 1e-9) { t = 0; s = cl(-c / a); }
    else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - b * b;
      s = den > 1e-12 ? cl((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = cl(-c / a); } else if (t > 1) { t = 1; s = cl((b - c) / a); }
    }
  }
  c1.set(p1.x + d1x * s, p1.y + d1y * s, p1.z + d1z * s); c2.set(p2.x + d2x * t, p2.y + d2y * t, p2.z + d2z * t);
  return c1.distanceToSquared(c2);
}
const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _c1 = new THREE.Vector3(), _c2 = new THREE.Vector3(), _a0 = new THREE.Vector3(), _a1 = new THREE.Vector3();
function cutNormal(f) {
  const bd = _t.subVectors(f.tip, f.hand), mv = _t2.subVectors(f.tip, f.prevTip).sub(f.pos).add(f.prevPos); // the swing itself, not the run
  const n = new THREE.Vector3().crossVectors(bd, mv);
  if (n.lengthSq() < 1e-8) n.crossVectors(bd, new THREE.Vector3(0, 1, 0));
  if (n.lengthSq() < 1e-8) n.set(1, 0, 0);
  return n.normalize();
}
function bladeSweep(f, dt) {
  if (f.noCut) { f.noCut = false; f.prevS = { x: f.s.x, y: f.s.y }; return; } // a snap into position isn't a swing
  // how fast the blade moves relative to the fighter's own body: running with the sword out isn't a swing
  const body = _t3.subVectors(f.pos, f.prevPos);
  const relSpd = (a, b) => Math.hypot(b.x - a.x - body.x, b.y - a.y - body.y, b.z - a.z - body.z) / dt;
  const tipSpd = relSpd(f.prevTip, f.tip);
  // the whoosh comes only from the swing itself (the sword moving in the hand), never from running or turning
  const ps = f.prevS || f.s, swing = Math.hypot(f.s.x - ps.x, f.s.y - ps.y) / dt * 1.6 * (f.bladeLen + 0.1);
  f.prevS = { x: f.s.x, y: f.s.y };
  if (swing > 11 && f.swishCd <= 0) { sfx.swish(swing, f.tip); f.swishCd = 0.22; }
  // and the bamboo (canopy): a blade moving through a stalk severs it (a swing, or just carrying it past at speed); bots too
  for (let s = 0; s < arena.bamboo.length; s++) {
    const st = arena.bamboo[s];
    if (Math.hypot(st.x - f.pos.x, st.z - f.pos.z) > f.bladeLen + 1.8 || (st.cutCd || 0) > now()) continue;
    for (let k = 0; k <= 6; k++) {
      const t = 0.12 + 0.88 * k / 6;
      _A.lerpVectors(f.prevHand, f.prevTip, t); _B.lerpVectors(f.hand, f.tip, t);
      if (_A.distanceTo(_B) / dt < 4) continue;
      _a0.set(st.x, f.pos.y - 3, st.z); _a1.set(st.x, f.pos.y + 5, st.z);
      if (segSeg(_A, _B, _a0, _a1, _c1, _c2) < (st.r + 0.06) ** 2) { st.cutCd = now() + 0.3; cutBamboo(s, +_c2.y.toFixed(2), true); break; }
    }
  }
  if (tipSpd < CUT_SPD || !f.armed) return;
  for (const g of fighters.values()) {
    if (g === f || !g.alive || g.prot > 0 || !isEnemy(f, g)) continue;
    if (g.pos.distanceToSquared(f.pos) > (f.bladeLen + 3) ** 2) continue;
    _a0.copy(g.pos); _a0.y += 0.15; _a1.copy(g.pos); _a1.y += 1.8;
    let parry = null, hit = null;
    for (let k = 0; k <= 6; k++) {
      const t = 0.12 + 0.88 * k / 6;
      _A.lerpVectors(f.prevHand, f.prevTip, t); _B.lerpVectors(f.hand, f.tip, t);
      if (relSpd(_A, _B) < CUT_SPD * 0.6) continue;
      if (!parry && segSeg(_A, _B, g.hand, g.tip, _c1, _c2) < 0.075 * 0.075) parry = _c1.clone();
      if (!hit && segSeg(_A, _B, _a0, _a1, _c1, _c2) < 0.34 * 0.34) hit = _c1.clone();
    }
    if (parry) { clash(f, g, parry); return; }
    if (hit) {
      const n = cutNormal(f);
      const imp = new THREE.Vector3().subVectors(f.tip, f.prevTip).divideScalar(dt).clampLength(0, 30);
      claimKill(f, g, n, hit, imp);
    }
  }
  if (f !== me) return;
  // slice the pieces lying around, too
  for (const p of [...pieces.list]) {
    if (p.cutCd > 0 || p.r < 0.06) continue;
    const c = p.mesh.position; if (c.distanceToSquared(f.pos) > (f.bladeLen + 2) ** 2) continue;
    for (let k = 0; k <= 5; k++) {
      const t = 0.15 + 0.85 * k / 5;
      _A.lerpVectors(f.prevHand, f.prevTip, t); _B.lerpVectors(f.hand, f.tip, t);
      if (segSeg(_A, _B, c, c, _c1, _c2) < (p.r * 0.75) ** 2) {
        const n = cutNormal(f), soup = pieces.worldSoup(p);
        const imp = new THREE.Vector3().subVectors(f.tip, f.prevTip).divideScalar(dt).clampLength(0, 20);
        const at = pieces.split(soup, n, -n.dot(_c1), p.vel, imp, 0.7);
        if (at) { pieces.remove(p); sfx.slice(at); }
        break;
      }
    }
  }
}
// cut stalk s at height y (and tell everyone if we did it)
function cutBamboo(s, y, mine) {
  const at = arena.cutBamboo(s, y); if (!at) return;
  const st = arena.bamboo[s]; // anyone we control who was hooked onto the part that just fell lets go
  for (const f of fighters.values()) if (f.hook && isLocal(f) && f.hook.p.y > y && Math.hypot(f.hook.p.x - st.x, f.hook.p.z - st.z) < st.r + 0.4) releaseHook(f, false);
  (S.bambooCuts ||= []).push([s, y]);
  sfx.chop(at);
  for (let i = 0; i < 18; i++) leafBits.emit(at.x, at.y, at.z, (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6, 0.8);
  if (mine) { if (S.host) net.broadcast({ t: 'bamboo', s, y }); else net.send({ t: 'bamboo', s, y }); }
}
function dashSweep(f) {
  if (f.dashT <= 0) return;
  _A.copy(f.prevPos); _A.y += 1.1; _B.copy(f.pos); _B.y += 1.1;
  for (const g of fighters.values()) {
    if (g === f || !g.alive || g.prot > 0 || !isEnemy(f, g) || f.dashVictims?.has(g.id)) continue;
    _a0.copy(g.pos); _a0.y += 0.15; _a1.copy(g.pos); _a1.y += 1.8;
    if (segSeg(_A, _B, _a0, _a1, _c1, _c2) < 0.6 * 0.6) {
      f.dashVictims?.add(g.id);
      // the cut runs along the dash and the blade
      const bd = _t.subVectors(f.tip, f.hand).normalize();
      const n = new THREE.Vector3().crossVectors(f.dashDir, bd);
      if (n.lengthSq() < 1e-4) n.crossVectors(f.dashDir, new THREE.Vector3(0, 1, 0));
      n.normalize();
      claimKill(f, g, n, _c2.clone(), f.dashDir.clone().multiplyScalar(14));
    }
  }
}
function clash(f, g, at) {
  sfx.clang(at);
  for (let i = 0; i < 26; i++) sparks.emit(at.x, at.y, at.z, (Math.random() - 0.5) * 9, Math.random() * 6, (Math.random() - 0.5) * 9, 0.4);
  const d = _t.subVectors(f.pos, g.pos); d.y = 0; d.normalize();
  if (isLocal(f)) { f.vel.addScaledVector(d, 4); f.vel.y += 1.5; f.stagger = 0.35; f.noCut = true; f.anim = null; if (f.isBot) f.atkCd = 0.5; }
  if (isLocal(g)) { g.vel.addScaledVector(d, -3); g.stagger = 0.2; g.noCut = true; }
  if (f === me || g === me) shake = Math.max(shake, 0.2);
}

// ---------- kills ----------
const arr = (v) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
const vec = (a) => new THREE.Vector3(a[0], a[1], a[2]);
function claimKill(att, vic, n, pt, imp) {
  if (S.host) {
    if (applyKill(vic.id, att.id, n, pt, imp)) net.broadcast({ t: 'kill', v: vic.id, k: att.id, n: arr(n), p: arr(pt), i: arr(imp) });
  } else if (att === me) {
    if (applyKill(vic.id, att.id, n, pt, imp)) net.send({ t: 'cut', v: vic.id, n: arr(n), p: arr(pt), i: arr(imp) });
  }
}
function selfFell(f) {
  if (S.host) { if (applyKill(f.id, null, null, null, null, true)) net.broadcast({ t: 'kill', v: f.id, k: null, fell: 1 }); }
  else if (f === me) { if (applyKill(f.id, null, null, null, null, true)) net.send({ t: 'fell' }); }
}
let shake = 0, hitstop = 0, punch = 0;
function applyKill(vId, kId, n, pt, imp, fell) {
  const v = fighters.get(vId); if (!v || !v.alive) return false;
  v.alive = false; v.hook = null; v.diedAt = now(); v.anim = null;
  if (!fell && n) {
    v.pose(0);
    const soup = bakeMeshes(v.meshes);
    const kfx = kId && kId !== vId ? fighters.get(kId)?.look.kill : null, burst = killFx.burstFor(kfx); // the killer's kill effect
    let at = pieces.split(soup, n, -n.dot(pt), v.vel, imp, 1, burst);
    if (!at) { const mid = v.pos.clone(); mid.y += 1.1; at = pieces.split(soup, n, -n.dot(mid), v.vel, imp, 1, burst); }
    if (at) killFx.apply(kfx, at, n, pieces.last);
    sfx.slice(at || v.pos);
  } else if (v === me) sfx.fall();
  v.group.visible = false; v.grap.hide();
  const kn = kId ? rosterGet(kId)?.name || '?' : null, vn = rosterGet(vId)?.name || '?';
  feed(fell ? `${vn} fell into the sky` : `${kn} <span style="color:var(--red)">⟋</span> ${vn}`);
  if (vId === S.myId) { deathAt.copy(v.pos); deathBy = fell ? 'You fell' : `Cut down by ${kn}`; }
  if (kId === S.myId) {
    shake = Math.max(shake, 0.35); hitstop = 0.07; punch = 1;
    const st = rosterGet(S.myId)?.streak || 0; if (bladeFor(st + 1) > bladeFor(st)) showBanner('BLADE GROWS');
  }
  if (S.host) {
    const kr = kId ? rosterGet(kId) : null, vr = rosterGet(vId);
    if (kr && kId !== vId) { kr.k++; kr.streak = (kr.streak || 0) + 1; } // streak: kills since your last death (sets blade length)
    if (vr) { vr.d++; vr.streak = 0; } // dying puts your blade back to its starting length
    // respawn in 3 s, except Horde (next wave) and Last Blade Standing (no respawns at all)
    v.respawnAt = S.mode === 'horde' || S.mode === 'lbs' ? Infinity : now() + 3;
    modeOnKill(v, vId, kId);
    if (v.isBot && S.mode === 'horde') setTimeout(() => { S.roster = S.roster.filter((r) => r.id !== vId); syncFighters(); sendRoster(); }, 4000);
    sendRoster();
    checkEnd();
  }
  return true;
}
const deathAt = new THREE.Vector3(); let deathBy = '';

// ---------- spawning ----------
function spawnPoint(f) {
  let best = null, bs = -Infinity;
  for (const sp of arena.spawns) {
    if (arena.plats[sp.plat]?.gone) continue; // that platform has fallen
    let md = 60;
    for (const g of fighters.values()) if (g !== f && g.alive && isEnemy(f, g)) md = Math.min(md, g.pos.distanceTo(sp));
    // big map: come back in near the action (about 18 m from the nearest enemy) so brawls grow; small map: far away
    // (Last Blade Standing has no respawns, so everyone starts spread out instead)
    const sc = (arena.mapId === 'plateaus' && S.mode !== 'lbs' ? -Math.abs(Math.min(md, 60) - 18) : md) + Math.random() * 6;
    if (sc > bs) { bs = sc; best = sp; }
  }
  return best.clone();
}
function spawn(f, p, yaw) {
  f.pos.copy(p); f.vel.set(0, 0, 0); f.yaw = yaw; f.pitch = 0; f.alive = true; f.prot = 1.5; f.hook = null; f.dashT = 0;
  f.bladeLen = bladeFor(rosterGet(f.id)?.streak); // come back with the blade your streak earns (the starting one after a death)
  f.stam = 100; f.s.x = GUARD.x; f.s.y = GUARD.y; f.noCut = true; f.anim = null; f.respawnAt = Infinity; f.onGround = true; f.stagger = 0;
  f.group.visible = true; f.trail.length = 0;
  if (f === me) { view.yaw = yaw; view.pitch = 0; twist.yaw = 0; twist.pitch = 0; }
  f.pose(0); f.prevHand.copy(f.hand); f.prevTip.copy(f.tip); f.prevPos.copy(f.pos);
  sfx.spawn(p);
}
function hostSpawn(f) {
  const p = spawnPoint(f), yaw = Math.atan2(p.x, p.z); // face the centre
  spawn(f, p, yaw);
  net.broadcast({ t: 'spawn', id: f.id, p: arr(p), y: +yaw.toFixed(3) });
}

// ---------- bots ----------
function targetCost(b, g) {
  let d = g.pos.distanceTo(b.pos);
  const pb = b.plat ?? null, pg = g.plat ?? null;
  if (pb !== null && pg !== null) d += arena.hops[pb][pg] * 22; // fight on your own platform or the next one over
  if (!isFinite(ground(g.pos.x, g.pos.z, g.pos.y))) d += 30;
  if (arena.mapId === 'plateaus' && pg !== null) { // big map: head for the plateau where the brawl is
    let crowd = 0; for (const o of fighters.values()) if (o.alive && o !== b && o !== g && o.plat === pg) crowd++;
    d -= crowd * 20;
  }
  if (S.obj && S.mode === 'koth' && S.obj.throne >= 0 && pg === S.obj.throne) d -= 40; // fight whoever holds the throne
  if (S.obj && S.mode === 'lbs' && S.obj.warn >= 0 && pg === S.obj.warn) d += 40; // don't chase onto a platform about to fall
  return d;
}
function nearestEnemy(b) {
  let best = null, bd = Infinity;
  for (const g of fighters.values()) {
    if (g === b || !g.alive || !isEnemy(b, g)) continue;
    let d = targetCost(b, g);
    d += Math.abs(g.pos.y - b.pos.y) * 1.5;
    if (d < bd) { bd = d; best = g; }
  }
  return best;
}
// Bots grapple to reach enemies above them, to cross big distances fast, and to save themselves when
// they go off the edge. Returns movement input while hanging on the rope, or null to walk as usual.
// is there floor (no big drop) `dist` metres ahead in direction (x,z)?
function floorAhead(b, x, z, dist) {
  const l = Math.hypot(x, z) || 1, px = b.pos.x + x / l * dist, pz = b.pos.z + z / l * dist;
  return ground(px, pz, b.pos.y) > b.pos.y - 1.5;
}
// aim is a direction, or (isPoint) a point to hook straight at
function botFireHook(b, aim, maxT, why, isPoint) {
  const o = b.pos.clone(); o.y += 1.5;
  const dir = isPoint ? aim.clone().sub(o) : aim.clone();
  if (!fireHook(b, o, dir.normalize())) { b.hookCd2 = 0.8; return false; }
  b.hookT = 0; b.hookMax = maxT; b.hookWhy = why;
  return true;
}
// the same "place" for bots: a platform, or (on the canopy) a whole limb of connected branches
const grp = (i) => (i == null || !arena.plats[i] ? i : arena.plats[i].group ?? i);
// canopy: a target on a branch or leaf joined to ours by walkable surface, not far off, is reached on foot, not by swinging
const samePlace = (b, t) => b.plat != null && t.plat != null && (grp(b.plat) === grp(t.plat) || (!!arena.comp && arena.comp[b.plat] === arena.comp[t.plat] && b.pos.distanceTo(t.pos) < 30));
function botGrapple(b, t, D, dt, dx, dy, dz, dh) {
  b.hookCd2 = (b.hookCd2 ?? 1 + Math.random() * 2) - dt;
  b.padOk = (b.padOk || 0) - dt; // > 0 while pads are allowed (after a swing couldn't be set up)
  if (b.onGround && (b.landOn || b.wasTravelling)) b.stayUntil = now() + 1.2 + Math.random() * 1.5; // just arrived: hold this platform a moment
  b.wasTravelling = !b.onGround && (!!b.landOn || !!b.padFlight || !!b.dest);
  if (b.onGround) b.landOn = null;
  const idle = { wish: { x: 0, z: 0 }, jump: false, sprint: false };
  if (b.hook) {
    b.hookT += dt;
    if (b.dest) {
      // let go the moment the arc will drop us onto the platform
      if (willLand(b, b.dest)) { releaseHook(b, false); b.landOn = b.dest; b.dest = null; b.hookCd2 = D.hookCd * (0.7 + Math.random() * 0.6); b.repath = 0; return null; }
      // reached the pillar without a landing lined up: kick off it in an arc onto the platform
      const c = _t.copy(b.pos); c.y += 1.3;
      if (b.hook.p.distanceTo(c) < 4.5) {
        const p = b.dest, tx = p.x - b.pos.x, ty = p.y - b.pos.y, tz = p.z - b.pos.z, T = Math.min(1.6, Math.max(0.7, Math.hypot(tx, tz) / 15));
        releaseHook(b, false);
        b.vel.set(tx / T, (ty + 12 * T * T) / T, tz / T).clampLength(0, 34);
        b.landOn = p; b.dest = null; b.hookCd2 = D.hookCd; b.repath = 0;
        return null;
      }
      // hooked to the platform's top but sunk below its rim: let go rather than haul up over the edge
      const topHook = Math.abs(b.hook.p.y - b.dest.y) < 0.3;
      if (b.hookT > 6 || (topHook && b.pos.y < b.dest.y - 0.4)) { releaseHook(b, false); b.dest = null; b.hookCd = 0; b.noTopUntil = now() + 3; return null; }
      return idle;
    }
    // a free swing (roam): let go over somewhere safe
    const below = ground(b.pos.x, b.pos.z, b.pos.y);
    const safe = isFinite(below) && below > b.pos.y - 9 && below >= t.pos.y - 3;
    if ((b.hook.p.y < b.pos.y - 0.3 || b.hookT > b.hookMax) && safe || b.hookT > 6) { releaseHook(b, true); b.hookCd2 = D.hookCd; b.repath = 0; return null; }
    const l = dh || 1;
    return { wish: { x: dx / l * 0.5, z: dz / l * 0.5 }, jump: false, sprint: false };
  }
  // in the air off a swing: sometimes dash for the platform (always, if we'd come up short)
  const floorNear = ground(b.pos.x, b.pos.z, b.pos.y) > b.pos.y - 3; // just a hop, not a flight
  if (!b.onGround && !floorNear && !b.padFlight && b.dashT <= 0 && b.dashCd <= 0 && b.stam >= 22 && !b.airDashed) {
    let p = b.landOn;
    if (!p) { // free swing or a fall: the nearest platform we could dash onto
      let bd = Infinity;
      for (const q of arena.plats) { if (q.gone) continue; const d = rimDist(q, b.pos); if (d < 15 && q.y <= b.pos.y + 4 && q.y > b.pos.y - 14 && d < bd) { bd = d; p = q; } }
    }
    if (p && !insidePlat(p, b.pos, -1)) {
      const short = !willLand(b, p);
      if (short || Math.random() < 0.35) {
        b.airDashed = true; // one roll per flight
        const dir = new THREE.Vector3(p.x - b.pos.x, p.y + 1.5 - b.pos.y, p.z - b.pos.z).normalize();
        if (short || Math.random() < 0.5) { tryDash(b, dir); b.landOn = p; }
      }
    }
  }
  if (b.onGround) b.airDashed = false;
  // dropped below the platform we were going for: forget it, so the rescue swing below can kick in
  if (!b.onGround && b.landOn && b.vel.y < 0 && b.pos.y < arena.platTop(b.landOn, b.pos) - 2.5) b.landOn = null;
  // flying after letting go: steer for the middle of the platform we're landing on
  if (!b.onGround && b.landOn) {
    const p = b.landOn, cx = p.x - b.pos.x, cz = p.z - b.pos.z, cl = Math.hypot(cx, cz) || 1;
    return cl > 0.8 ? { wish: { x: cx / cl, z: cz / cl }, jump: false, sprint: false } : idle;
  }
  // falling with nothing close below: swing to the nearest platform and land on it
  const under = ground(b.pos.x, b.pos.z, b.pos.y);
  if (!b.onGround && !b.padFlight && b.vel.y < -7 && !(isFinite(under) && under > b.pos.y - 12) && (b.hookCd || 0) <= 0) {
    const order = arena.plats.filter((p) => !(insidePlat(p, b.pos, 0.5) && p.y > b.pos.y))
      .map((p) => ({ p, d: Math.hypot(p.x - b.pos.x, p.z - b.pos.z) + Math.max(0, p.y - b.pos.y) * 0.9 })).sort((u, v) => u.d - v.d);
    for (const { p } of order.slice(0, 4)) if (botSwingTo(b, p, 'save')) return idle;
  }
  if (b.hookCd2 > 0 || !b.onGround || b.dashT > 0 || (b.anim && b.anim.phase !== 'rec')) return null;
  // enemy on another platform: swing over and land on it (pads are the fallback)
  if (t.plat != null && b.plat != null && !samePlace(b, t) && !(b.stayUntil > now()) && Math.random() < dt * D.cross * 4) {
    const ok = (p) => p && p.i !== b.plat && p.y - b.pos.y < 18 && p.y - b.pos.y > -16 && Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < 48;
    let tp = arena.plats[t.plat];
    if (!ok(tp) && b.path) { const n = b.path.find((q) => q.name[0] === 'P' && grp(+q.name.slice(1)) !== grp(b.plat)); tp = n ? arena.plats[+n.name.slice(1)] : null; }
    if (ok(tp) && botSwingTo(b, tp, 'cross')) return { wish: { x: 0, z: 0 }, jump: true, sprint: false };
    b.padOk = 2.5;
  }
  // long way off on about the same level: a free swing for show
  if (dh > 16 && Math.abs(dy) < 3 && !samePlace(b, t) && Math.random() < dt * D.roam) {
    const aim = new THREE.Vector3(dx, 0, dz).normalize(); aim.y = 0.45;
    if (botFireHook(b, aim, 1.6, 'roam')) { b.dest = null; return { wish: { x: 0, z: 0 }, jump: true, sprint: false }; }
  }
  return null;
}
// Would a bot let go right now and come down on platform p (not into its underside)?
function willLand(b, p) {
  let x = b.pos.x, y = b.pos.y, z = b.pos.z, vx = b.vel.x, vy = b.vel.y, vz = b.vel.z;
  const h = 1 / 30, m = Math.min(1.2, p.d * 0.2), q = { x: 0, z: 0 };
  for (let i = 0; i < 150; i++) {
    const py = y;
    vy -= 24 * h; x += vx * h; y += vy * h; z += vz * h;
    q.x = x; q.z = z;
    const top = arena.platTop(p, q), over = arena.inPlat(p, q, 0.5);
    if (over && py < top - 2.2 && y >= top - 2.2) return false; // would hit it from below
    if (vy < 0 && py > top && y <= top) return arena.inPlat(p, q, -m); // comes down onto the top
    if (vy < 0 && y < top - 2.2) return false; // already dropping past it
  }
  return false;
}
// Hook something that will carry the bot over platform tp: its top if we're above it, otherwise a sky
// pillar beside or beyond it, high up, so the swing passes over the platform.
function botSwingTo(b, tp, why) {
  const o = b.pos.clone(); o.y += 1.5;
  const cands = [];
  // well above it: hook its top and get pulled straight down onto it (from too far out the rope dips under the rim)
  if (b.onGround && !(b.noTopUntil > now()) && b.pos.y - tp.y > 2 + rimDist(tp, b.pos) * 0.45) cands.push({ p: new THREE.Vector3(tp.x, tp.y, tp.z), s: -1 });
  const ux = tp.x - b.pos.x, uz = tp.z - b.pos.z, ul = Math.hypot(ux, uz) || 1;
  for (const pl of arena.pillars) {
    const d = Math.hypot(pl.x - tp.x, pl.z - tp.z); if (d > Math.max(26, Math.max(tp.w, tp.d) / 2 + 12)) continue;
    const along = ((pl.x - b.pos.x) * ux + (pl.z - b.pos.z) * uz) / ul;
    if (along < ul * 0.6) continue; // behind or short of the platform: the swing wouldn't carry over it
    const fx = b.pos.x - pl.x, fz = b.pos.z - pl.z, fl = Math.hypot(fx, fz) || 1;
    // anchor a set height above the platform itself (never relative to the bot, or swings ratchet up the pillars)
    const pt = new THREE.Vector3(pl.x + fx / fl * pl.w / 2, tp.y + 10, pl.z + fz / fl * pl.w / 2);
    if (pt.distanceTo(o) > HOOK_MAX - 2) continue;
    // the rope line has to pass well above the platform's near half, or the swing sags into its side
    const lx = pt.x - o.x, lz = pt.z - o.z, ll = Math.hypot(lx, lz) || 1;
    const k = Math.max(0, Math.min(1, (rimDist(tp, o) + 0.5) / ll));
    if (o.y + (pt.y - o.y) * k < tp.y + 3.5) continue;
    cands.push({ p: pt, s: d + Math.abs(along - ul) * 0.3 });
  }
  cands.sort((a, c) => a.s - c.s);
  for (const c of cands.slice(0, 6)) {
    const dir = c.p.clone().sub(o).normalize();
    const hit = arena.raycast(o, dir, HOOK_MAX);
    if (!hit || hit.point.distanceTo(c.p) > 1.4) continue; // something in the way
    if (!fireHook(b, o, dir)) return false;
    b.hookT = 0; b.hookMax = 5; b.hookWhy = why; b.dest = tp;
    if (b.vel.y < 9) b.vel.y = 9; // hop as the hook fires, so the swing starts high
    return true;
  }
  return false;
}
// platform helpers (platforms can be rotated, and canopy branches slope)
const insidePlat = (p, q, m) => arena.inPlat(p, q, m);
const platUnder = (q) => { let best = null, bt = -Infinity; for (const p of arena.plats) { if (p.gone || !insidePlat(p, q, 0.4)) continue; const t = arena.platTop(p, q); if (t <= q.y + 0.6 && t > bt) { bt = t; best = p; } } return best; };
const rimDist = (p, q) => arena.rimDist(p, q);
// the point on a platform's top lip closest to q
const rimPoint = (p, q) => arena.rimPoint(p, q);
function botThink(b, dt) {
  const D = DIFF[S.diff] || DIFF[1];
  b.think = (b.think || 0) - dt; b.atkCd = (b.atkCd ?? 1) - dt; b.repath = (b.repath || 0) - dt;
  if (!b.target || !b.target.alive || b.think <= 0) {
    // stick with the current fight unless a much closer one turns up
    const nb = nearestEnemy(b);
    if (!b.target || !b.target.alive || !nb || targetCost(b, nb) < targetCost(b, b.target) - 15) b.target = nb;
    b.think = 1.5 + Math.random();
  }
  let t = b.target;
  const obj = botObjective(b); // the mode's objective: throne, heads, shrine, or away from a crumbling platform
  if (obj && (!t || obj.flee || t.pos.distanceTo(b.pos) > obj.engage)) t = obj;
  const wish = { x: 0, z: 0 }; let jump = false, sprint = false;
  if (!t) { b.yaw += dt * 0.3; return { wish, jump, sprint }; }
  const dx = t.pos.x - b.pos.x, dz = t.pos.z - b.pos.z, dy = t.pos.y - b.pos.y, dh = Math.hypot(dx, dz);
  // face the target, aim the blade at its chest
  const want = Math.atan2(-dx, -dz);
  let da = want - b.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
  const turn = (b.anim && b.anim.phase === 'strike' ? D.turn * 0.5 : D.turn) * dt;
  b.yaw += Math.max(-turn, Math.min(turn, da));
  b.pitch = Math.max(-0.7, Math.min(0.7, Math.atan2(dy, Math.max(0.5, dh))));
  // grappling hook
  const g = botGrapple(b, t, D, dt, dx, dy, dz, dh);
  if (g) return g;
  // two bots on different platforms hunting each other: one holds its ground and lets the other come
  // (also: a bot that just arrived on a platform holds it for a few seconds instead of leaving straight away)
  if (b.onGround && b.plat != null && t.plat != null && !samePlace(b, t) && !t.flee && ((t.isBot && t.target === b && b.id < t.id) || b.stayUntil > now())) {
    const p = arena.plats[b.plat], cx = p.x - b.pos.x, cz = p.z - b.pos.z, cl = Math.hypot(cx, cz);
    if (cl > 2) { wish.x = cx / cl * 0.5; wish.z = cz / cl * 0.5; }
    return { wish, jump, sprint };
  }
  // where to go
  let goal = t.pos, padGoal = false;
  const reach = b.bladeLen + 0.5; // how far this bot's sword reaches from its body
  const close = t.fake ? dh < 0.6 && Math.abs(dy) < 1.5 : dh < reach + 1.1 && Math.abs(dy) < 1.3 + b.bladeLen * 0.5;
  if (!close) {
    const direct = Math.abs(dy) < 0.9 && dh < 25 && arena.directPath(b.pos, t.pos);
    if (direct) b.path = null;
    else {
      if (!b.path || b.repath <= 0) {
        b.path = arena.path(b.pos, t.pos); b.repath = 0.8;
        // skip waypoints already behind us (otherwise every re-plan walks us back to the nearest one)
        const hd = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
        while (b.path.length >= 2 && Math.abs(b.path[0].p.y - b.path[1].p.y) < 1.5 && hd(b.pos, b.path[1].p) < hd(b.path[0].p, b.path[1].p)) b.path.shift();
      }
      while (b.path && b.path.length) {
        const n = b.path[0], hd = Math.hypot(n.p.x - b.pos.x, n.p.z - b.pos.z);
        const isPad = n.name[0] === 'D';
        if (isPad && hd < 0.7 && !(b.padOk > 0)) break; // wait on the pad: grappling comes first
        if (hd < (isPad ? 0.7 : 1.1) && Math.abs(n.p.y - b.pos.y) < 1.8) { b.path.shift(); if (isPad && b.onGround) jump = true; } else break;
      }
      if (b.path && b.path.length) { goal = b.path[0].p; padGoal = b.path[0].name[0] === 'D'; }
    }
    const gx = goal.x - b.pos.x, gz = goal.z - b.pos.z, gl = Math.hypot(gx, gz) || 1;
    wish.x = gx / gl; wish.z = gz / gl; sprint = gl > 8 && b.stam > 40;
  } else {
    // fighting distance: circle and keep a little space
    b.strafeT = (b.strafeT || 0) - dt; if (b.strafeT <= 0) { b.strafe = Math.random() < 0.5 ? -1 : 1; b.strafeT = 0.8 + Math.random() * 1.2; }
    const fx = dx / (dh || 1), fz = dz / (dh || 1);
    const back = dh < Math.min(1.5, reach * 0.6) ? -0.7 : dh > reach * 0.85 ? 0.6 : 0;
    wish.x = fx * back + -fz * b.strafe * 0.6; wish.z = fz * back + fx * b.strafe * 0.6;
    if (!t.fake && !b.anim && b.atkCd <= 0 && b.stagger <= 0 && Math.abs(da) < 0.6) {
      const pat = PATTERNS[(Math.random() * PATTERNS.length) | 0];
      b.anim = { phase: 'wind', t: 0, dur: D.wind * (0.85 + Math.random() * 0.3), s0: { x: b.s.x, y: b.s.y }, from: pat[0], to: pat[1] };
      b.atkCd = D.cd[0] + Math.random() * (D.cd[1] - D.cd[0]);
    }
  }
  // dash-cut in from mid range
  if (!close && dh > 6 && dh < 15 && Math.abs(dy) < 1.5 && b.dashCd <= 0 && Math.random() < dt * D.dash * 2) {
    const dir = new THREE.Vector3(dx, dy, dz).normalize(); if (floorAhead(b, dx, dz, 13) && floorAhead(b, dx, dz, 7)) tryDash(b, dir);
  }
  // dodge a swing that's coming
  if (t.anim && t.anim.phase === 'wind' && dh < 3 && b.dashCd <= 0 && !b.evaded) {
    b.evaded = true;
    if (Math.random() < D.evade) {
      const s = Math.random() < 0.5 ? 1 : -1, ev = new THREE.Vector3(-dz * s - dx, 0, dx * s - dz).normalize();
      if (floorAhead(b, ev.x, ev.z, 13) && floorAhead(b, ev.x, ev.z, 7)) tryDash(b, ev);
    }
  }
  if (!t.anim) b.evaded = false;
  // stuck? hop
  b.stuck = (b.stuck || 0) + ((wish.x || wish.z) && Math.hypot(b.vel.x, b.vel.z) < 0.6 && b.onGround ? dt : -dt);
  if (b.stuck > 0.8) { jump = true; b.stuck = 0; b.repath = 0; }
  // don't walk off the platform: if there's no floor ahead, try sideways, else stop
  // (walking onto a jump pad by the edge is fine: the drop just past it is where the pad sends us)
  const padDist = Math.hypot(goal.x - b.pos.x, goal.z - b.pos.z), toPad = padGoal && padDist < 3;
  if (toPad) { const k = Math.max(0.25, padDist / 3); wish.x *= k; wish.z *= k; } // ease onto the pad, not past it
  if (b.onGround && (wish.x || wish.z) && !toPad && !floorAhead(b, wish.x, wish.z, 1.9)) {
    const a = { x: -wish.z, z: wish.x }, c = { x: wish.z, z: -wish.x };
    if (floorAhead(b, a.x, a.z, 1.9)) { wish.x = a.x; wish.z = a.z; }
    else if (floorAhead(b, c.x, c.z, 1.9)) { wish.x = c.x; wish.z = c.z; }
    else { wish.x = 0; wish.z = 0; }
    b.stuck = 0;
  }
  return { wish, jump, sprint };
}

// ---------- host: match flow ----------
const coop = () => S.mode === 'horde';
function newRosterEntry(id, name, human, look) {
  const used = new Set(S.roster.map((r) => r.col));
  let col = 0; while (used.has(col) && col < 20) col++;
  return { id, name, human, col, team: coop() ? (human ? 'H' : 'R') : id, k: 0, d: 0, streak: 0, pts: 0, carry: 0, horde: !human && coop(), look: cleanLook(look || (human ? null : randomLook())) };
}
function fillBots() {
  if (coop()) return; // horde bots come and go with the waves
  const humans = S.roster.filter((r) => r.human).length;
  const want = Math.max(0, Math.min(S.bots, MAX_PLAYERS - humans));
  let bots = S.roster.filter((r) => !r.human);
  while (bots.length > want) { const b = bots.pop(); S.roster = S.roster.filter((r) => r !== b); }
  const names = BOT_NAMES.filter((n) => !S.roster.some((r) => r.name === n));
  while (bots.length < want) { const e = newRosterEntry('b' + (++S.seq), names.shift() || 'Bot', false); S.roster.push(e); bots.push(e); }
}
function sendRoster() { net.broadcast({ t: 'roster', list: S.roster, mode: S.mode, map: S.map, tl: Math.round(S.timeLeft), wv: S.wave }); renderLobby(); }
function startMatch() {
  useMap(S.map);
  clearWorld(); fx.clear(); S.bambooCuts = [];
  if (coop()) S.roster = S.roster.filter((r) => r.human);
  for (const r of S.roster) { r.k = 0; r.d = 0; r.streak = 0; r.pts = 0; r.carry = 0; r.team = coop() ? (r.human ? 'H' : 'R') : r.id; r.horde = !r.human && coop(); }
  fillBots();
  S.timeLeft = FFA_TIME; S.wave = 0; S.waveT = 3; S.waveActive = false; S.queue = 0; S.ended = false; S.lbsLive = false;
  initObjective();
  syncFighters();
  net.broadcast({ t: 'start', mode: S.mode, map: S.map, list: S.roster });
  enterGame();
  for (const f of fighters.values()) if (!coop() || !f.isBot) hostSpawn(f);
  if (S.mode === 'jugg') { const all = [...fighters.values()]; setJugg(all[(Math.random() * all.length) | 0].id); }
  S.lbsLive = true;
  sendObj();
  if (S.online) net.dirSetRoom(roomInfo());
}
function checkEnd() {
  if (S.ended || S.phase !== 'game') return;
  if (S.mode === 'ffa') {
    const top = [...S.roster].sort((a, b) => b.k - a.k)[0];
    if ((top && top.k >= FFA_KILLS) || S.timeLeft <= 0) endMatch();
  } else if (POINT_MODES.has(S.mode)) {
    const top = [...S.roster].sort((a, b) => (b.pts || 0) - (a.pts || 0))[0];
    if ((top && (top.pts || 0) >= MODE_GOAL[S.mode]) || S.timeLeft <= 0) endMatch();
  } else if (S.mode === 'lbs') {
    const alive = [...fighters.values()].filter((f) => f.alive);
    if (S.lbsLive && alive.length <= 1) endMatch(alive[0] ? alive[0].id : null);
  } else {
    const humans = [...fighters.values()].filter((f) => !f.isBot);
    if (humans.length && humans.every((f) => !f.alive) && S.waveActive) endMatch();
  }
}
function endMatch(winner) {
  S.ended = true;
  const res = { mode: S.mode, list: S.roster, wave: S.wave, winner: winner || null };
  net.broadcast({ t: 'end', res });
  setTimeout(() => showEnd(res), 1500);
}
function hostTick(dt) {
  const t = now();
  for (const f of fighters.values()) if (!f.alive && f.respawnAt <= t) hostSpawn(f);
  if (!coop()) {
    if (S.mode !== 'lbs') { S.timeLeft -= dt; if (S.timeLeft <= 0) checkEnd(); }
    if (!S.ended) modeTick(dt);
  } else if (!S.ended) {
    const bots = [...fighters.values()].filter((f) => f.isBot);
    const alive = bots.filter((f) => f.alive).length;
    if (!S.waveActive) {
      S.waveT -= dt;
      if (S.waveT <= 0) {
        S.wave++; S.waveActive = true; S.queue = 2 + S.wave * 2; S.spawnT = 0;
        for (const f of fighters.values()) if (!f.isBot && !f.alive) hostSpawn(f);
        net.broadcast({ t: 'wave', n: S.wave }); showBanner('WAVE ' + S.wave); sfx.gong();
      }
    } else {
      S.spawnT -= dt;
      if (S.queue > 0 && S.spawnT <= 0 && alive < 8) {
        S.queue--; S.spawnT = 0.9;
        const e = newRosterEntry('z' + (++S.seq), 'Oni', false); e.team = 'R'; e.horde = true;
        S.roster.push(e); syncFighters(); sendRoster();
        hostSpawn(fighters.get(e.id));
      }
      if (S.queue <= 0 && alive === 0 && bots.every((f) => !f.alive)) { S.waveActive = false; S.waveT = 5; showBanner('WAVE CLEARED'); net.broadcast({ t: 'banner', s: 'WAVE CLEARED' }); }
      checkEnd();
    }
  }
}

// ---------- game modes: the host runs the rules, everyone draws the objectives ----------
const ZERO = new THREE.Vector3();
const THRONE_TIME = 40, LBS_GRACE = 5, LBS_WARN = 3;
const freshObj = () => ({ throne: -1, throneIn: 0, jugg: null, shrines: [], tokens: [], warn: -1, gone: [], crumbleIn: 0 });
let until = { throne: 0, crumble: 0, warnEnd: 0 }, scoreT = 0;
function objForSend() {
  const o = S.obj || freshObj();
  o.throneIn = +Math.max(0, until.throne - now()).toFixed(1); o.crumbleIn = +Math.max(0, until.crumble - now()).toFixed(1);
  return o;
}
function sendObj() { const o = objForSend(); net.broadcast({ t: 'obj', o }); applyObj(o); }
// draw the objectives (host and clients alike)
function applyObj(o) {
  S.obj = o;
  if (!S.host) { until.throne = now() + (o.throneIn || 0); until.crumble = now() + (o.crumbleIn || 0); }
  for (const i of o.gone || []) if (arena.plats[i] && !arena.plats[i].gone) arena.dropPlatform(i);
  arena.warnPlatform(o.warn ?? -1);
  fx.setThrone(o.throne >= 0 ? arena.plats[o.throne] : null);
  fx.setShrines((o.shrines || []).map((s) => ({ x: s[0], y: s[1], z: s[2] })));
  fx.setTokens(o.tokens || []);
}
function pickThrone(prev) {
  let ok = arena.plats.filter((p) => !p.gone && p.i !== prev && p.w * p.d >= 80); // big enough to fight on
  if (!ok.length) ok = arena.plats.filter((p) => !p.gone && p.i !== prev);
  return ok.length ? ok[(Math.random() * ok.length) | 0].i : -1;
}
function initObjective() {
  S.obj = freshObj(); until = { throne: 0, crumble: 0, warnEnd: 0 }; scoreT = 0;
  if (S.mode === 'koth') { S.obj.throne = pickThrone(-1); until.throne = now() + THRONE_TIME; }
  if (S.mode === 'lbs') until.crumble = now() + LBS_GRACE;
  if (S.mode === 'hunt') { // two shrines, on big platforms as far apart as possible
    const big = arena.plats.filter((p) => p.w * p.d >= 80 && p.kind !== 'hub');
    let best = null, bd = -1;
    for (const a of big) for (const b of big) { const d = Math.hypot(a.x - b.x, a.z - b.z); if (a !== b && d > bd) { bd = d; best = [a, b]; } }
    S.obj.shrines = (best || arena.plats.slice(0, 2)).map((p) => [p.x, p.y, p.z, p.i]);
  }
}
function throneOccupants() {
  const p = arena.plats[S.obj.throne]; if (!p || p.gone) return [];
  return [...fighters.values()].filter((f) => f.alive && insidePlat(p, f.pos, 0.3) && f.pos.y > p.y - 0.6 && f.pos.y < p.y + 4);
}
function setJugg(id) {
  S.obj.jugg = id;
  for (const r of S.roster) r.team = r.id === id ? 'J' : 'H'; // everyone else teams up against the juggernaut
  syncFighters(); sendRoster(); sendObj();
  const n = id && rosterGet(id)?.name;
  if (n) { const s = `${n.toUpperCase()} IS THE JUGGERNAUT`; showBanner(s); net.broadcast({ t: 'banner', s }); }
}
function modeOnKill(v, vId, kId) {
  const o = S.obj; if (!o) return;
  if (S.mode === 'jugg' && vId === o.jugg) { // the crown goes to whoever cut the juggernaut down
    const k = kId && kId !== vId ? fighters.get(kId) : null;
    if (k && k.alive) setJugg(kId);
    else { const alive = [...fighters.values()].filter((f) => f.alive && f.id !== vId); setJugg(alive.length ? alive[(Math.random() * alive.length) | 0].id : null); }
  }
  if (S.mode === 'hunt') { // drop your own head plus every head you were carrying
    const r = rosterGet(vId), n = (r?.carry || 0) + 1;
    if (r) r.carry = 0;
    dropHeads(v.pos, n); sendObj();
  }
}
function dropHeads(pos, n) {
  for (let i = 0; i < n; i++) for (let tries = 0; tries < 8; tries++) {
    const a = Math.random() * Math.PI * 2, rr = 0.6 + Math.random() * 1.8, x = pos.x + Math.cos(a) * rr, z = pos.z + Math.sin(a) * rr;
    const g = ground(x, z, pos.y + 1);
    if (isFinite(g) && g > pos.y - 6) { S.obj.tokens.push([++S.seq, +x.toFixed(2), +(g + 0.5).toFixed(2), +z.toFixed(2)]); break; }
  } // (heads dropped over the void are lost)
}
function modeTick(dt) {
  const o = S.obj; if (!o) return;
  const t = now();
  if (S.mode === 'koth') {
    if (t >= until.throne || o.throne < 0) { o.throne = pickThrone(o.throne); until.throne = t + THRONE_TIME; showBanner('THE THRONE MOVES'); net.broadcast({ t: 'banner', s: 'THE THRONE MOVES' }); sfx.gong(); sendObj(); }
    scoreT += dt;
    if (scoreT >= 1) {
      scoreT -= 1;
      const on = throneOccupants();
      if (on.length === 1) { const r = rosterGet(on[0].id); if (r) { r.pts = (r.pts || 0) + 1; sendRoster(); checkEnd(); } }
    }
  } else if (S.mode === 'jugg') {
    const j = o.jugg ? fighters.get(o.jugg) : null;
    if (!j) { const alive = [...fighters.values()].filter((f) => f.alive); if (alive.length) setJugg(alive[(Math.random() * alive.length) | 0].id); }
    else if (j.alive) {
      scoreT += dt;
      if (scoreT >= 1) { scoreT -= 1; const r = rosterGet(j.id); if (r) { r.pts = (r.pts || 0) + 1; sendRoster(); checkEnd(); } }
    }
  } else if (S.mode === 'hunt') {
    let changed = false;
    for (const f of fighters.values()) {
      if (!f.alive) continue;
      const r = rosterGet(f.id); if (!r) continue;
      for (let i = o.tokens.length - 1; i >= 0; i--) { // pick up heads you walk over
        const k = o.tokens[i];
        if (Math.hypot(k[1] - f.pos.x, k[3] - f.pos.z) < 1.6 && Math.abs(k[2] - 0.5 - f.pos.y) < 2) { o.tokens.splice(i, 1); r.carry = (r.carry || 0) + 1; changed = true; sfx.hookHit(f.pos); }
      }
      if (r.carry > 0) for (const s of o.shrines) { // bank them at a shrine
        if (Math.hypot(s[0] - f.pos.x, s[2] - f.pos.z) < 3.5 && Math.abs(s[1] - f.pos.y) < 2.5) {
          const msg = `${esc(r.name)} banked ${r.carry} head${r.carry > 1 ? 's' : ''}`; feed(msg); net.broadcast({ t: 'feed', s: msg });
          r.pts = (r.pts || 0) + r.carry; r.carry = 0; changed = true; sfx.pad(f.pos);
        }
      }
    }
    if (changed) { sendObj(); sendRoster(); checkEnd(); }
  } else if (S.mode === 'lbs') {
    const left = arena.plats.filter((p) => !p.gone);
    if (o.warn >= 0 && t >= until.warnEnd) { o.gone.push(o.warn); o.warn = -1; sfx.gong(); net.broadcast({ t: 'banner', s: 'A PLATFORM FALLS' }); showBanner('A PLATFORM FALLS'); sendObj(); }
    else if (o.warn < 0 && left.length > 1 && t >= until.crumble) {
      // the outermost platform still standing goes next (ties broken at random)
      const pick = left.map((p) => ({ p, d: Math.hypot(p.x, p.z) + Math.random() * 6 })).sort((a, b) => b.d - a.d)[0].p;
      o.warn = pick.i; until.warnEnd = t + LBS_WARN;
      until.crumble = t + LBS_WARN + Math.max(1, 24 / Math.max(1, arena.plats.length - 1)); // a platform every few seconds
      sendObj();
    }
    checkEnd();
  }
}
// what a bot should go for besides fighting: the throne, a shrine or loose heads, or away from a crumbling platform
function botObjective(b) {
  const o = S.obj; if (!o) return null;
  const mk = (pos, plat, engage, flee) => ({ pos, plat, engage, flee, fake: true, alive: true, vel: ZERO, anim: null, isBot: false, target: null });
  if (S.mode === 'koth' && o.throne >= 0) {
    const p = arena.plats[o.throne]; if (!p || p.gone) return null;
    if (b.onGround && b.plat === p.i) return null; // on the throne: just fight for it
    return mk(new THREE.Vector3(p.x, p.y, p.z), p.i, 9);
  }
  if (S.mode === 'lbs' && o.warn >= 0 && b.plat === o.warn) {
    let best = null, bd = Infinity;
    for (const p of arena.plats) { if (p.gone || p.i === o.warn) continue; const d = Math.hypot(p.x - b.pos.x, p.z - b.pos.z) + Math.abs(p.y - b.pos.y) * 2; if (d < bd) { bd = d; best = p; } }
    return best ? mk(new THREE.Vector3(best.x, best.y, best.z), best.i, 1e9, true) : null;
  }
  if (S.mode === 'hunt') {
    const carry = rosterGet(b.id)?.carry || 0;
    if (carry > 0 && o.shrines.length) {
      let s = null, sd = Infinity; for (const q of o.shrines) { const d = Math.hypot(q[0] - b.pos.x, q[2] - b.pos.z); if (d < sd) { sd = d; s = q; } }
      if (carry >= 3 || sd < 25) return mk(new THREE.Vector3(s[0], s[1], s[2]), s[3], carry >= 3 ? 6 : 4);
    }
    let k = null, kd = 35; for (const q of o.tokens) { const d = Math.hypot(q[1] - b.pos.x, q[3] - b.pos.z) + Math.abs(q[2] - b.pos.y) * 2; if (d < kd) { kd = d; k = q; } }
    if (k) { const pos = new THREE.Vector3(k[1], k[2] - 0.5, k[3]); return mk(pos, platUnder(pos)?.i ?? null, 7); }
  }
  return null;
}


// ---------- networking ----------
let netT = 0;
function myState(f) {
  const h = f.hook ? arr(f.hook.p) : null;
  return [+f.pos.x.toFixed(2), +f.pos.y.toFixed(2), +f.pos.z.toFixed(2), +f.yaw.toFixed(3), +f.pitch.toFixed(3), +f.s.x.toFixed(3), +f.s.y.toFixed(3),
    (f.alive ? 1 : 0) | (f.dashT > 0 ? 2 : 0) | (f.onGround ? 4 : 0) | (f.prot > 0 ? 8 : 0) | (f.anim && f.anim.phase === 'wind' ? 16 : 0), h];
}
function applyState(f, s) {
  const p = new THREE.Vector3(s[0], s[1], s[2]);
  if (!f.net) f.net = { p: p.clone(), yaw: s[3], pitch: s[4], sx: s[5], sy: s[6], t: now(), v: new THREE.Vector3() };
  const n = f.net, tt = now(), dtt = Math.max(0.03, tt - n.t);
  n.v.subVectors(p, n.p).divideScalar(dtt); n.p.copy(p); n.t = tt;
  n.yaw = s[3]; n.pitch = s[4]; n.sx = s[5]; n.sy = s[6]; n.flags = s[7]; n.hook = s[8] ? vec(s[8]) : null;
  if ((s[7] & 1) && !f.alive && (!f.diedAt || tt - f.diedAt > 1.5)) spawn(f, p, s[3]);
}
function remoteUpdate(f, dt) {
  const n = f.net; if (!n) return;
  if (f.pos.distanceToSquared(n.p) > 25) f.pos.copy(n.p); else f.pos.lerp(n.p, 1 - Math.exp(-18 * dt));
  let da = n.yaw - f.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
  f.yaw += da * (1 - Math.exp(-20 * dt)); f.pitch += (n.pitch - f.pitch) * (1 - Math.exp(-20 * dt));
  const k = 1 - Math.exp(-30 * dt); f.s.x += (n.sx - f.s.x) * k; f.s.y += (n.sy - f.s.y) * k;
  f.vel.copy(n.v); f.onGround = !!(n.flags & 4); f.dashT = n.flags & 2 ? 0.1 : 0; f.prot = n.flags & 8 ? 0.5 : 0;
  f.anim = n.flags & 16 ? { phase: 'wind' } : null;
  f.hook = n.hook ? { p: n.hook, len: 1 } : null;
}
net.onNet({
  message(from, d) {
    if (!d || typeof d !== 'object') return;
    if (S.host) hostMsg(from, d); else clientMsg(d);
  },
  leave(id) {
    if (!S.host) return;
    const r = rosterGet(id); if (!r) return;
    if (S.obj && S.obj.jugg === id) S.obj.jugg = null; // the juggernaut left: the crown goes to someone else
    toast(`${r.name} left`);
    S.roster = S.roster.filter((x) => x.id !== id);
    if (S.phase === 'game' || S.phase === 'end') fillBots();
    syncFighters();
    for (const f of fighters.values()) if (!f.alive && f.isBot && !coop() && S.mode !== 'lbs' && f.respawnAt === Infinity && S.phase === 'game') f.respawnAt = now() + 1;
    sendRoster(); if (S.online) net.dirSetRoom(roomInfo());
  },
  closed() { toast('The host closed the room.'); toMenu(); },
});
function hostMsg(from, d) {
  if (d.t === 'hello') {
    if (S.roster.filter((r) => r.human).length >= MAX_PLAYERS || (S.mode === 'horde' && S.roster.filter((r) => r.human).length >= 4)) { net.sendTo(from, { t: 'full' }); net.kick(from); return; }
    const name = String(d.name || 'Player').replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 14) || 'Player';
    const e = newRosterEntry(from, name, true, d.look); S.roster.push(e);
    if (S.phase === 'game') fillBots();
    syncFighters();
    net.sendTo(from, { t: 'welcome', id: from, list: S.roster, mode: S.mode, map: S.map, phase: S.phase === 'game' ? 'game' : 'lobby', obj: S.phase === 'game' ? objForSend() : null, bamboo: S.bambooCuts || [] });
    if (S.phase === 'game') { const f = fighters.get(from); f.respawnAt = !coop() && S.mode !== 'lbs' ? now() + 1 : Infinity; if (S.mode === 'horde' && !S.waveActive) f.respawnAt = now() + 1; for (const g of fighters.values()) if (g.alive) net.sendTo(from, { t: 'spawn', id: g.id, p: arr(g.pos), y: +g.yaw.toFixed(3) }); }
    toast(`${name} joined`);
    sendRoster(); if (S.online) net.dirSetRoom(roomInfo());
    return;
  }
  const f = fighters.get(from); if (!f) return;
  if (d.t === 'p' && Array.isArray(d.s)) applyState(f, d.s);
  else if (d.t === 'bamboo' && Number.isInteger(d.s) && typeof d.y === 'number') { cutBamboo(d.s, d.y); net.broadcast({ t: 'bamboo', s: d.s, y: d.y }, from); }
  else if (d.t === 'cut') {
    const v = fighters.get(d.v);
    if (v && v.alive && f.alive && Array.isArray(d.n) && Array.isArray(d.p)) {
      const n = vec(d.n).normalize();
      if (applyKill(d.v, from, n, vec(d.p), vec(d.i || [0, 0, 0]))) net.broadcast({ t: 'kill', v: d.v, k: from, n: d.n, p: d.p, i: d.i }, from);
    }
  } else if (d.t === 'fell') { if (applyKill(from, null, null, null, null, true)) net.broadcast({ t: 'kill', v: from, k: null, fell: 1 }, from); }
}
function clientMsg(d) {
  if (d.t === 'welcome') { S.myId = d.id; S.roster = d.list; S.mode = d.mode; S.map = d.map || 'spire'; if (d.phase === 'game') { useMap(S.map); clearWorld(); fx.clear(); S.bambooCuts = []; if (d.obj) applyObj(d.obj); for (const [s, y] of d.bamboo || []) cutBamboo(s, y); syncFighters(); enterGame(); } else showLobby(); }
  else if (d.t === 'full') { toast('That room is full.'); toMenu(); }
  else if (d.t === 'roster') { S.roster = d.list; S.mode = d.mode; S.map = d.map || S.map; S.timeLeft = d.tl; S.wave = d.wv; syncFighters(); renderLobby(); }
  else if (d.t === 'start') { S.roster = d.list; S.mode = d.mode; S.map = d.map || 'spire'; useMap(S.map); clearWorld(); fx.clear(); S.obj = null; S.bambooCuts = []; syncFighters(); enterGame(); }
  else if (d.t === 's') {
    S.timeLeft = d.tl; S.wave = d.wv;
    for (const s of d.f) { const f = fighters.get(s[0]); if (f && f !== me) applyState(f, s.slice(1)); }
  } else if (d.t === 'spawn') { const f = fighters.get(d.id); if (f) spawn(f, vec(d.p), d.y); }
  else if (d.t === 'kill') { applyKill(d.v, d.k, d.n ? vec(d.n).normalize() : null, d.p ? vec(d.p) : null, d.i ? vec(d.i) : new THREE.Vector3(), !!d.fell); }
  else if (d.t === 'end') { S.ended = true; setTimeout(() => showEnd(d.res), 1500); }
  else if (d.t === 'lobby') { S.phase = 'lobby'; clearWorld(); showLobby(); }
  else if (d.t === 'wave') { S.wave = d.n; showBanner('WAVE ' + d.n); sfx.gong(); }
  else if (d.t === 'banner') showBanner(d.s);
  else if (d.t === 'obj') applyObj(d.o);
  else if (d.t === 'bamboo') cutBamboo(d.s, d.y);
  else if (d.t === 'feed') feed(d.s);
}
function netTick(dt) {
  if (!S.online) return;
  netT -= dt; if (netT > 0) return; netT = 0.05;
  if (S.host) {
    const f = []; for (const g of fighters.values()) f.push([g.id, ...myState(g)]);
    net.broadcast({ t: 's', f, tl: Math.round(S.timeLeft), wv: S.wave });
  } else if (me) net.send({ t: 'p', s: myState(me) });
}
function roomInfo() { return S.pub ? { code: net.net.code, name: settings.name || 'Ronin', game: S.mode, map: S.map, n: S.roster.filter((r) => r.human).length, max: S.mode === 'horde' ? 4 : MAX_PLAYERS, st: S.phase === 'game' ? 'playing' : 'lobby' } : null; }

// ---------- UI ----------
const screens = ['home', 'mp', 'lobby', 'settings', 'pause', 'end', 'shop'];
const shop = initShop({ show, onClose: () => { show('home'); updateCoinBadge(); } });
function updateCoinBadge() { $('coinBadge').textContent = profile.coins; }
$('toShop').addEventListener('click', () => shop.open());
updateCoinBadge();
function show(id) { for (const s of screens) $(s).classList.toggle('hidden', s !== id); }
function toast(msg) { const t = $('toast'); t.textContent = msg; t.style.opacity = 1; clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = 0; }, 2600); }
function feed(html) {
  const el = document.createElement('div'); el.innerHTML = html; $('feed').prepend(el);
  setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 600); }, 5000);
  while ($('feed').children.length > 6) $('feed').lastChild.remove();
}
function showBanner(s) { const b = $('banner'); b.textContent = s; b.style.opacity = 1; clearTimeout(b._h); b._h = setTimeout(() => { b.style.opacity = 0; }, 2200); }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const colorOf = (r) => '#' + new THREE.Color(r.horde ? 0xff6b6b : PALETTE[r.col % PALETTE.length]).getHexString();

$('name').value = settings.name;
$('name').addEventListener('input', () => { settings.name = $('name').value.trim().slice(0, 14); saveSettings(); });
$('map').value = MAPS[settings.map] ? settings.map : 'spire';
$('map').onchange = () => { settings.map = $('map').value; saveSettings(); }; // remember the map you picked
// mode menus (home, host, lobby) all come from the one list of modes
for (const id of ['mode', 'hostMode', 'lobbyModeSel']) $(id).innerHTML = Object.entries(MODES).map(([k, m]) => `<option value="${k}">${m.name}</option>`).join('');
$('mode').value = MODES[settings.mode] ? settings.mode : 'ffa';
const showBlurb = () => { $('modeBlurb').textContent = MODES[$('mode').value].blurb; };
$('mode').onchange = () => { settings.mode = $('mode').value; saveSettings(); $('hostMode').value = $('mode').value; showBlurb(); };
$('hostMode').value = $('mode').value; showBlurb();
$('playSolo').onclick = () => startSolo($('mode').value);
$('toMp').onclick = () => { ensureAudio(); show('mp'); net.dirStart(renderRooms); };
$('mpBack').onclick = () => { if (!S.online) net.dirStop(); show('home'); };
let settingsBack = 'home';
$('toSettings').onclick = () => { settingsBack = 'home'; openSettings(); };
$('pauseSettings').onclick = () => { settingsBack = 'pause'; openSettings(); };
function openSettings() {
  show('settings');
  for (const [id, key] of [['sLook', 'look'], ['sBlade', 'blade'], ['sVol', 'vol']]) { $(id).value = settings[key]; $(id + 'V').textContent = (+settings[key]).toFixed(2); }
  $('sQuality').value = settings.quality;
}
for (const [id, key] of [['sLook', 'look'], ['sBlade', 'blade'], ['sVol', 'vol']]) $(id).addEventListener('input', () => { settings[key] = +$(id).value; $(id + 'V').textContent = (+settings[key]).toFixed(2); if (key === 'vol') setVolume(settings.vol); saveSettings(); });
$('sQuality').onchange = () => { settings.quality = $('sQuality').value; saveSettings(); };
$('settingsDone').onclick = () => show(settingsBack);
$('resumeBtn').onclick = () => { lockPointer(); };
$('quitBtn').onclick = () => { leaveRoom(); toMenu(); };
$('menuBtn').onclick = () => { leaveRoom(); toMenu(); };
$('againBtn').onclick = () => {
  if (!S.online) { startSolo(S.mode); return; }
  if (S.host) { S.phase = 'lobby'; clearWorld(); net.broadcast({ t: 'lobby' }); showLobby(); }
};
$('joinBtn').onclick = () => joinRoom($('joinCode').value);
$('joinCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom($('joinCode').value); });
$('hostBtn').onclick = hostRoom;
$('startBtn').onclick = () => { if (S.host) { S.mode = $('lobbyModeSel').value; S.map = $('lobbyMap').value; S.bots = +$('lobbyBots').value; S.diff = +$('lobbyDiff').value; startMatch(); } };
$('leaveBtn').onclick = () => { leaveRoom(); toMenu(); };
$('copyLink').onclick = () => {
  const link = location.origin + location.pathname + '?room=' + net.net.code;
  (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast('Invite link copied'), () => toast(link));
};
for (const id of ['lobbyModeSel', 'lobbyMap', 'lobbyBots', 'lobbyDiff']) $(id).onchange = () => { if (!S.host) return; S.mode = $('lobbyModeSel').value; S.map = $('lobbyMap').value; S.bots = +$('lobbyBots').value; S.diff = +$('lobbyDiff').value; for (const r of S.roster) r.team = coop() ? 'H' : r.id; sendRoster(); if (S.online) net.dirSetRoom(roomInfo()); };

function renderRooms(rooms) {
  const el = $('rooms');
  if (!rooms.length) { el.innerHTML = '<div class="empty">No open rooms right now. Host one!</div>'; return; }
  el.innerHTML = '';
  for (const r of rooms) {
    const d = document.createElement('div'); d.className = 'item';
    d.innerHTML = `<span class="grow"><b>${esc(r.name)}</b> · ${esc(MODES[r.game]?.name || 'Free-for-all')} · ${esc(MAPS[r.map]?.name || 'Sky Spires')} · ${r.n}/${r.max}${r.st === 'playing' ? ' · in a match' : ''}</span>`;
    const b = document.createElement('button'); b.textContent = 'Join'; b.onclick = () => joinRoom(r.code); d.appendChild(b);
    el.appendChild(d);
  }
}
function renderLobby() {
  if (S.phase !== 'lobby') return;
  $('lobbyCode').textContent = net.net.code || '-----';
  $('lobbyMode').textContent = (MODES[S.mode] || MODES.ffa).name + ': ' + (MODES[S.mode] || MODES.ffa).blurb;
  $('lobbyPlayers').innerHTML = S.roster.filter((r) => r.human).map((r) => `<div class="item"><span class="dot" style="background:${colorOf(r)}"></span><span class="grow">${esc(r.name)}${r.id === S.myId ? ' (you)' : ''}${r.id === 'host' ? ' · host' : ''}</span></div>`).join('');
  $('lobbyHostOpts').classList.toggle('hidden', !S.host);
  $('startBtn').classList.toggle('hidden', !S.host);
  $('lobbyWait').textContent = S.host ? (coop() ? 'Press Start when everyone is in.' : 'Bots fill the empty slots. Press Start when everyone is in.') : 'Waiting for the host to start…';
  $('lobbyMapName').textContent = (MAPS[S.map] || MAPS.spire).name + ': ' + (MAPS[S.map] || MAPS.spire).blurb;
  if (S.host) { $('lobbyModeSel').value = S.mode; $('lobbyMap').value = S.map; $('lobbyBots').value = S.bots; $('lobbyDiff').value = S.diff; }
}
function showLobby() { S.phase = 'lobby'; show('lobby'); $('hud').classList.add('hidden'); if (document.pointerLockElement) document.exitPointerLock(); renderLobby(); }

async function hostRoom() {
  ensureAudio();
  if (!net.available()) { toast("Multiplayer couldn't load. Check your connection."); return; }
  $('hostBtn').disabled = true;
  try {
    await net.host();
    S.online = true; S.host = true; S.myId = 'host'; S.mode = $('hostMode').value; S.map = $('map').value; S.pub = $('pub').checked; S.bots = 4; S.diff = 1;
    S.roster = [newRosterEntry('host', settings.name || 'Ronin', true, profile.equip)];
    showLobby();
    net.dirStart(() => {}); net.dirSetRoom(roomInfo());
  } catch (e) { toast(e.message || 'Could not create a room.'); }
  $('hostBtn').disabled = false;
}
async function joinRoom(code) {
  ensureAudio();
  code = net.cleanCode(code);
  if (code.length !== 5) { toast('Room codes are 5 letters.'); return; }
  if (!net.available()) { toast("Multiplayer couldn't load. Check your connection."); return; }
  toast('Joining ' + code + '…');
  try {
    await net.join(code);
    S.online = true; S.host = false; net.dirStop();
    net.send({ t: 'hello', name: settings.name || 'Ronin', look: profile.equip });
  } catch (e) { toast(e.message || "Couldn't join that room."); }
}
function leaveRoom() {
  if (S.online) { net.dirSetRoom(null); net.leave(); net.dirStop(); }
  S.online = false; S.host = true; S.myId = 'host';
}
function startSolo(mode) {
  ensureAudio();
  leaveRoom();
  S.mode = mode; S.map = $('map').value; S.bots = +$('bots').value; S.diff = +$('diff').value;
  S.roster = [newRosterEntry('host', settings.name || 'Ronin', true, profile.equip)];
  startMatch();
}
function enterGame() {
  S.phase = 'game'; S.ended = false; S.paused = false; S.matchStart = now();
  show(null); $('hud').classList.remove('hidden');
  $('hint').style.opacity = 1; setTimeout(() => { $('hint').style.opacity = 0; }, 12000);
  if (!locked) $('clickPlay').classList.remove('hidden');
  lockPointer();
}
function toMenu() {
  fx.clear(); S.obj = null;
  S.phase = 'menu'; S.ended = false; clearWorld(); S.roster = [];
  $('hud').classList.add('hidden'); $('clickPlay').classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  show('home');
}
const ranked = (list, mode) => [...list].sort((a, b) => POINT_MODES.has(mode) ? (b.pts || 0) - (a.pts || 0) || b.k - a.k : b.k - a.k || a.d - b.d);
function showEnd(res) {
  if (S.phase !== 'game') return;
  S.phase = 'end';
  if (document.pointerLockElement) document.exitPointerLock();
  show('end'); $('hud').classList.add('hidden'); $('clickPlay').classList.add('hidden');
  const list = ranked(res.list, res.mode), name = (MODES[res.mode] || MODES.ffa).name, pts = POINT_MODES.has(res.mode);
  if (res.mode === 'horde') { $('endTitle').textContent = `The horde got you on wave ${res.wave}`; }
  else {
    const w = res.mode === 'lbs' ? (res.winner ? rosterGet(res.winner) || res.list.find((r) => r.id === res.winner) : null) : list[0];
    $('endTitle').textContent = w && w.id === S.myId ? 'Victory' : res.mode === 'lbs' && !w ? 'Nobody survived' : `${w ? w.name : 'Nobody'} wins`;
  }
  $('endSub').textContent = name;
  const rows = list.filter((r) => res.mode !== 'horde' || r.human);
  $('endTable').innerHTML = `<tr><th></th><th>Name</th>${pts ? `<th>${res.mode === 'hunt' ? 'Heads' : 'Points'}</th>` : ''}<th>Kills</th><th>Deaths</th></tr>` + rows.map((r, i) => `<tr><td>${i + 1}</td><td><span class="dot" style="background:${colorOf(r)}"></span> ${esc(r.name)}${r.id === S.myId ? ' (you)' : ''}</td>${pts ? `<td>${r.pts || 0}</td>` : ''}<td>${r.k}</td><td>${r.d}</td></tr>`).join('');
  // coins: for playing a real match (not quitting straight out), kills, points or waves, and winning
  const mine = res.list.find((r) => r.id === S.myId), top = res.mode === 'lbs' ? res.winner : list[0] && list[0].id;
  let coins = 0;
  if (mine && now() - (S.matchStart || now()) > 40) {
    coins = 10 + 5 * mine.k + (POINT_MODES.has(res.mode) ? Math.floor((mine.pts || 0) / 4) : 0) + (res.mode === 'horde' ? 5 * res.wave : 0);
    if (res.mode !== 'horde' && top === S.myId && res.list.length > 1) coins += 30;
    if (!S.online) coins = Math.round(coins * [0.75, 1, 1.3][S.diff ?? 1]);
    addCoins(coins);
  }
  $('endCoins').innerHTML = coins ? `<b>+${coins} coins</b> &middot; you have ${profile.coins}` : 'Play a full match to earn coins';
  updateCoinBadge();
  $('againBtn').classList.toggle('hidden', S.online && !S.host);
  $('againBtn').textContent = S.online ? 'Back to lobby' : 'Play again';
}

// invite links
{
  const q = new URLSearchParams(location.search);
  const room = net.cleanCode(q.get('room'));
  if (room.length === 5) { show('mp'); $('joinCode').value = room; net.dirStart(renderRooms); toast('Enter your name on the home screen if you like, then press Join.'); }
}

// ---------- HUD ----------
let hudT = 0;
const clock = (t) => { t = Math.max(0, t); return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; };
function updateHud(dt) {
  hudT -= dt; if (hudT > 0) return; hudT = 0.1;
  if (S.phase !== 'game') return;
  const mr = rosterGet(S.myId), o = S.obj || {}, pts = POINT_MODES.has(S.mode);
  const top = ranked(S.roster, S.mode)[0];
  const lead = top ? `Leader: <span style="color:${colorOf(top)}">${esc(top.name)}</span> ${pts ? top.pts || 0 : top.k}` : '';
  let status = '';
  if (S.mode === 'ffa') $('topbar').innerHTML = `${clock(S.timeLeft)} · First to ${FFA_KILLS} · ${lead}`;
  else if (S.mode === 'koth') {
    $('topbar').innerHTML = `King of the Platform · ${clock(S.timeLeft)} · Throne moves in ${Math.ceil(Math.max(0, until.throne - now()))} s · ${lead}/${MODE_GOAL.koth}`;
    if (me && me.alive && S.obj && o.throne >= 0) {
      const p = arena.plats[o.throne], on = p && insidePlat(p, me.pos, 0.3) && me.pos.y > p.y - 0.6 && me.pos.y < p.y + 4;
      if (on) status = throneOccupants().length > 1 ? 'CONTESTED: clear the throne' : 'HOLDING THE THRONE · +1 a second';
    }
  } else if (S.mode === 'jugg') {
    const j = o.jugg && rosterGet(o.jugg);
    $('topbar').innerHTML = `Juggernaut · ${clock(S.timeLeft)} · Juggernaut: ${j ? `<span style="color:${colorOf(j)}">${esc(j.name)}</span>` : '-'} · ${lead}/${MODE_GOAL.jugg}`;
    if (me && me.alive) status = o.jugg === S.myId ? 'YOU ARE THE JUGGERNAUT · survive to score' : 'Hunt the crowned juggernaut';
  } else if (S.mode === 'lbs') {
    const alive = [...fighters.values()].filter((f) => f.alive).length;
    const falls = o.warn >= 0 ? '<span style="color:var(--red)">A platform is falling!</span>' : `Next platform falls in ${Math.ceil(Math.max(0, until.crumble - now()))} s`;
    $('topbar').innerHTML = `Last Blade Standing · ${alive} alive · ${falls}`;
    if (me && me.alive && o.warn >= 0 && me.plat === o.warn) status = '<span style="color:var(--red)">YOUR PLATFORM IS FALLING · get off!</span>';
  } else if (S.mode === 'hunt') {
    $('topbar').innerHTML = `Headhunter · ${clock(S.timeLeft)} · ${lead}/${MODE_GOAL.hunt} banked`;
    if (me && me.alive && mr && mr.carry) status = `CARRYING ${mr.carry} HEAD${mr.carry > 1 ? 'S' : ''} · bank them at a shrine`;
  } else {
    const left = [...fighters.values()].filter((f) => f.isBot && f.alive).length + (S.host ? S.queue : 0);
    $('topbar').textContent = `Wave ${Math.max(1, S.wave)} · ${left} oni left`;
  }
  const big = pts ? (mr?.pts || 0) : (mr ? mr.k : 0);
  const unit = S.mode === 'hunt' ? 'banked' : pts ? 'points' : 'kills';
  $('myscore').innerHTML = `${big}<small>${unit}${pts ? ` · ${mr ? mr.k : 0} kills` : ''} · ${mr ? mr.d : 0} deaths · blade ${(me ? me.bladeLen : bladeFor(mr?.streak)).toFixed(2)} m</small>`;
  if (me) {
    $('stamBar').style.width = me.stam + '%';
    $('pipDash').classList.toggle('on', me.dashCd <= 0 && me.stam >= 22);
    $('pipHook').classList.toggle('on', (me.hookCd || 0) <= 0);
    let c = '';
    if (!me.alive) {
      if (S.mode === 'horde') c = `${esc(deathBy)}<small>You'll be back for the next wave</small>`;
      else if (S.mode === 'lbs') c = `${esc(deathBy)}<small>You're out. Watching the rest fight it out…</small>`;
      else { const w = Math.max(0, Math.ceil((me.respawnAt === Infinity ? 3 - (now() - (me.diedAt || 0)) : me.respawnAt - now()))); c = `${esc(deathBy)}<small>Back in ${w}…</small>`; }
    } else if (status) c = `<small style="font-size:16px;color:var(--gold)">${status}</small>`;
    $('center').innerHTML = c;
    $('bladeHint').classList.toggle('hidden', !(swingHeld() && me.alive));
  }
  $('board').classList.toggle('hidden', !keys.Tab);
  if (keys.Tab) {
    const list = ranked(S.roster, S.mode).filter((r) => S.mode !== 'horde' || r.human);
    $('board').innerHTML = `<table><tr><th>Name</th>${pts ? `<th>${S.mode === 'hunt' ? 'Banked' : 'Points'}</th>` : ''}${S.mode === 'hunt' ? '<th>Carrying</th>' : ''}<th>Kills</th><th>Deaths</th></tr>` + list.map((r) => `<tr><td><span class="dot" style="background:${colorOf(r)}"></span> ${esc(r.name)}${r.human ? '' : ' <span class="muted">bot</span>'}${S.obj && S.obj.jugg === r.id ? ' 👑' : ''}</td>${pts ? `<td>${r.pts || 0}</td>` : ''}${S.mode === 'hunt' ? `<td>${r.carry || 0}</td>` : ''}<td>${r.k}</td><td>${r.d}</td></tr>`).join('') + '</table>';
  }
}

// ---------- camera ----------
let camDist = 3.4, hookAimT = 0;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function updateCamera(dt) {
  if (!me) { // slow fly-around of the arena behind the menus
    const a = now() * 0.05;
    camera.position.set(Math.cos(a) * 75, 34, Math.sin(a) * 75); camera.lookAt(0, 4, 0);
    arena.follow(new THREE.Vector3(0, 0, 0));
    return;
  }
  arena.follow(me.alive ? me.pos : deathAt);
  if (!me.alive) { // circle the place you died
    const a = now() * 0.25;
    camPos.set(deathAt.x + Math.cos(a) * 6, deathAt.y + 3.5, deathAt.z + Math.sin(a) * 6);
    camera.position.lerp(camPos, 1 - Math.exp(-3 * dt)); camera.lookAt(deathAt.x, deathAt.y + 0.5, deathAt.z);
    return;
  }
  const look = viewDir(camLook); // the camera follows its own angles, not the twisting body
  const right = _t3.set(Math.cos(view.yaw), 0, -Math.sin(view.yaw));
  const pivot = _t.copy(me.pos); pivot.y += 1.62; pivot.addScaledVector(right, 0.55);
  let dist = 3.4;
  for (let i = 1; i <= 14; i++) { // pull in if a wall is in the way
    const d = 3.4 * i / 14;
    const x = pivot.x - look.x * d, y = pivot.y - look.y * d + 0.25 * i / 14, z = pivot.z - look.z * d;
    if (arena.wallAt(x, z, y - 0.1, 0.2, 0.15) || y < ground(x, z, y) + 0.1 || arena.inLog(x, y, z)) { dist = Math.max(0.6, d - 0.25); break; }
  }
  camDist = dist;
  camera.position.set(pivot.x - look.x * dist, pivot.y - look.y * dist + 0.25 * dist / 3.4, pivot.z - look.z * dist);
  if (shake > 0.001) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake));
  camera.lookAt(pivot.x + look.x * 20, pivot.y + look.y * 20, pivot.z + look.z * 20);
  const sp = me.vel.length();
  const fov = 72 + Math.min(14, Math.max(0, sp - 8) * 0.7) + punch * 4;
  camera.fov += (fov - camera.fov) * (1 - Math.exp(-6 * dt)); camera.updateProjectionMatrix();
  // crosshair shows when the hook has something to grab
  hookAimT -= dt;
  if (hookAimT <= 0) {
    hookAimT = 0.12;
    const o = camera.position.clone(), d = new THREE.Vector3(); camera.getWorldDirection(d); o.addScaledVector(d, camDist);
    $('xhair').classList.toggle('hook', !!arena.grappleTarget(o, d, HOOK_MAX));
  }
}

// ---------- main loop ----------
let last = performance.now();
function frame(t) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, Math.max(0.0005, (t - last) / 1000)); last = t;
  tick(rdt, t / 1000);
}
function tick(rdt, tt) {
  arena.update(tt); fx.update(tt);
  if (S.phase === 'game' && !S.paused) {
    if (S.host) hostTick(rdt);
    for (const f of fighters.values()) {
      if (!f.alive) continue;
      if (f === me) {
        const fw = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
        const st = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
        // body = camera + twist; the twist eases back once you stop swinging
        if (!swingHeld()) { const k = Math.exp(-6 * rdt); twist.yaw *= k; twist.pitch *= k; }
        f.yaw = view.yaw + twist.yaw; f.pitch = Math.max(-1.25, Math.min(1.25, view.pitch + twist.pitch));
        const vy = view.yaw, fx = -Math.sin(vy), fz = -Math.cos(vy), rx = Math.cos(vy), rz = -Math.sin(vy); // move relative to the camera
        let wx = fx * fw + rx * st, wz = fz * fw + rz * st; const l = Math.hypot(wx, wz); if (l > 0) { wx /= l; wz /= l; }
        stepFighter(f, rdt, { x: wx, z: wz }, false, keys.Space && locked);
        if (f.hook && !mouse.rmb) releaseHook(f, true);
        updateSword(f, rdt);
      } else if (S.host && f.isBot) {
        const b = botThink(f, rdt);
        stepFighter(f, rdt, f.padFlight ? { x: 0, z: 0 } : b.wish, b.sprint, b.jump);
        updateSword(f, rdt);
      } else remoteUpdate(f, rdt);
    }
    pushApart();
    for (const f of fighters.values()) {
      if (!f.alive) { f.updateTrail(tt); continue; }
      const isJugg = S.mode === 'jugg' && S.obj && S.obj.jugg === f.id;
      const want = isJugg ? BLADE_MAX : bladeFor(rosterGet(f.id)?.streak); // the juggernaut always carries the longest blade
      f.crown.visible = isJugg;
      f.bladeLen += (want - f.bladeLen) * Math.min(1, rdt * 4);
      if (f.onGround) { const p = platUnder(f.pos); if (p) f.plat = p.i; } // which platform they're on
      f.pose(rdt);
      if (isLocal(f)) {
        bladeSweep(f, rdt); dashSweep(f);
        if (f.pos.y < arena.killY) selfFell(f);
      }
      f.prevHand.copy(f.hand); f.prevTip.copy(f.tip);
      f.updateTrail(tt);
      const tfx = trailFx[f.trailStyle.fx]; // ember, petal and zap trails shed particles off a fast blade
      if (tfx && f.tipSpeed > 9 && f.trail.length > 1) for (let k = 0; k < 2; k++) { const u = Math.random(), p = _t.copy(f.hand).lerp(f.tip, 0.4 + u * 0.6), j = f.trailStyle.fx === 'zap' ? 5 : 1.5; tfx.emit(p.x, p.y, p.z, (Math.random() - 0.5) * j, (Math.random() - 0.3) * j, (Math.random() - 0.5) * j, f.trailStyle.fx === 'zap' ? 0.18 : 0.9); }
      f.group.visible = f.alive && !(f.prot > 0 && Math.floor(tt * 12) % 2 === 0);
      // rope
      if (f.hook) f.grap.show(f.handL, f.hook.p, rdt); else f.grap.hide();
    }
    netTick(rdt);
  } else if (S.phase === 'game') netTick(rdt);
  const pdt = hitstop > 0 ? rdt * 0.08 : rdt; hitstop -= rdt;
  pieces.update(pdt); blood.update(pdt); sparks.update(pdt); leafBits.update(pdt); for (const p of Object.values(trailFx)) p.update(pdt); grapFx.smoke.update(pdt); killFx.update(pdt);
  shake *= Math.exp(-9 * rdt); punch *= Math.exp(-6 * rdt);
  updateCamera(rdt);
  setListener(me && me.alive ? me.pos : camera.position); // hear from your character, not the camera behind it
  updateHud(rdt);
  $('vignette').style.boxShadow = me && !me.alive ? 'inset 0 0 200px rgba(140,0,0,.55)' : 'inset 0 0 160px rgba(160,0,0,0)';
  renderer.render(scene, camera);
}
show('home');
setVolume(settings.vol);
$('clickPlay').onclick = () => { ensureAudio(); lockPointer(); };
$('loading').remove();
requestAnimationFrame(frame);
// handy for debugging in the console
window.__sever = { S, fighters, pieces, get arena() { return arena; }, camera, tick, applyKill, botSwingTo, willLand, sfx, quickSwing, fireHook, releaseHook, tryDash, mouse, get me() { return me; } };
