// Reasons to come back: experience and levels (a coin reward at each new level), and three daily challenges that change
// at midnight (your own clock). All of it lives in the saved profile, next to the coins.
import { profile, saveProfile } from './cosmetics.js?v=20261121141806';
import { lbAdd } from './boards.js?v=20261121141806';

profile.xp = Math.max(0, Math.floor(+profile.xp || 0));
export const xpFor = (lv) => 100 + (lv - 1) * 60; // (what it takes to get from this level to the next)
export function levelOf(xp = profile.xp) { let lv = 1; while (xp >= xpFor(lv)) { xp -= xpFor(lv); lv++; } return { lv, into: xp, need: xpFor(lv) }; }
export const LEVEL_COINS = (lv) => 60 + lv * 15;

// stat: what counts toward it (see track() calls in main.js). max: the best single value counts, not a running total.
const POOL = [
  { id: 'kills', stat: 'kills', n: [10, 15, 20], text: (n) => `Cut down ${n} fighters` },
  { id: 'wins', stat: 'wins', n: [1, 2], text: (n) => (n > 1 ? `Win ${n} matches` : 'Win a match') },
  { id: 'matches', stat: 'matches', n: [3, 4], text: (n) => `Play ${n} full matches` },
  { id: 'streak', stat: 'streak', max: true, n: [3, 4, 5], text: (n) => `Get ${n} kills without dying` },
  { id: 'air', stat: 'air', n: [3, 5], text: (n) => `Cut down ${n} fighters while you are in the air` },
  { id: 'hook', stat: 'hook', n: [2, 4], text: (n) => `Cut down ${n} fighters while hanging on your hook` },
  { id: 'dash', stat: 'dash', n: [3, 5], text: (n) => `Cut down ${n} fighters within a second of dashing` },
  { id: 'online', stat: 'online', n: [1, 2], text: (n) => (n > 1 ? `Play ${n} online matches` : 'Play an online match') },
  { id: 'special', stat: 'special', n: [1], text: () => 'Play a special mode (Lava Climb, Branch Run, Transport or Bullet Train)' },
];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function roll() { // today's three: the same for everyone on the same date
  const day = today(); if (profile.daily && profile.daily.day === day) return profile.daily;
  let h = 2166136261; for (const c of day) h = Math.imul(h ^ c.charCodeAt(0), 16777619); const r = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  const pool = POOL.slice(), list = [];
  for (let i = 0; i < 3; i++) { const p = pool.splice(Math.floor(r() * pool.length), 1)[0], k = Math.floor(r() * p.n.length); list.push({ id: p.id, n: p.n[k], have: 0, done: false, xp: 60 + k * 30, coins: 40 + k * 20 }); }
  profile.daily = { day, list }; saveProfile(); return profile.daily;
}
export function dailies() { return roll().list.map((c) => ({ ...c, text: POOL.find((p) => p.id === c.id).text(c.n) })); }

/** Add experience. Returns the levels gained and the coins they paid. */
export function addXp(n) {
  const a = levelOf().lv; profile.xp += Math.max(0, Math.round(n)); lbAdd('xp', Math.round(n)); const b = levelOf().lv; let coins = 0;
  for (let l = a + 1; l <= b; l++) coins += LEVEL_COINS(l);
  profile.coins += coins; saveProfile(); return { ups: b - a, lv: b, coins };
}
/** Count something toward today's challenges. Returns the text of any challenge this finished (its reward is paid here). */
export function track(stat, v = 1) {
  const out = [];
  for (const c of roll().list) { const p = POOL.find((q) => q.id === c.id); if (!p || p.stat !== stat || c.done) continue;
    c.have = p.max ? Math.max(c.have, v) : c.have + v;
    if (c.have >= c.n) { c.have = c.n; c.done = true; profile.coins += c.coins; addXp(c.xp); out.push(`${p.text(c.n)} · +${c.xp} XP, +${c.coins} coins`); } }
  saveProfile(); return out;
}
/** The level bar and today's challenges, for the home screen. */
export function progressHtml() {
  const L = levelOf(), bar = (k, c) => `<span style="display:block;height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden"><span style="display:block;height:100%;width:${Math.round(k * 100)}%;background:${c}"></span></span>`;
  return `<div style="display:flex;justify-content:space-between;font-size:13px"><b>Level ${L.lv}</b><span class="muted">${L.into} / ${L.need} XP</span></div>${bar(L.into / L.need, 'var(--gold)')}` +
    '<div class="muted" style="margin-top:8px;font-size:12px">Daily challenges</div>' +
    dailies().map((c) => `<div style="font-size:12px;margin-top:5px;${c.done ? 'opacity:.55' : ''}"><div style="display:flex;justify-content:space-between;gap:8px"><span>${c.done ? '✔ ' : ''}${c.text}</span><span class="muted" style="white-space:nowrap">${c.done ? 'done' : `${c.have}/${c.n} · +${c.xp} XP`}</span></div>${bar(c.have / c.n, c.done ? '#6c6' : 'var(--red)')}</div>`).join('');
}
