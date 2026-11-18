// Leaderboards: your record on each board, for this week and for all time, ranked against the players you have met
// online (their results in the matches you shared). It all lives in the saved profile. `remote` is where a worldwide
// table plugs in: an object with top(board, week) -> [{ name, v }] and submit(entry); until one is set, ranks are local.
import { profile, saveProfile } from './cosmetics.js?v=20261117200250';

export const BOARDS = [ // max: the best single value counts, not a running total
  { id: 'kills', name: 'Kills', unit: 'Kills' },
  { id: 'wins', name: 'Wins', unit: 'Wins' },
  { id: 'best', name: 'Best match', unit: 'Kills in one match', max: true },
  { id: 'streak', name: 'Best streak', unit: 'Kills without dying', max: true },
  { id: 'medals', name: 'Medals', unit: 'Medals' },
  { id: 'xp', name: 'Experience', unit: 'Experience' },
  { id: 'horde', name: 'Horde', unit: 'Waves survived', max: true },
];
const isMax = Object.fromEntries(BOARDS.map((b) => [b.id, !!b.max]));
export const weekKey = (t = Date.now()) => Math.floor((t / 864e5 + 3) / 7); // (weeks start on Monday, UTC)
export const weekLeft = () => ((weekKey() + 1) * 7 - 3) * 864e5 - Date.now(); // (milliseconds until this week's boards reset)

const L = (() => { const l = profile.lb && typeof profile.lb === 'object' ? profile.lb : {};
  l.all = l.all || {}; l.wk = l.wk && l.wk.key === weekKey() ? l.wk : { key: weekKey(), s: {} }; l.met = l.met || {}; return (profile.lb = l); })();
const week = () => { if (L.wk.key !== weekKey()) L.wk = { key: weekKey(), s: {} }; return L.wk.s; };
const put = (o, stat, v) => { o[stat] = isMax[stat] ? Math.max(o[stat] || 0, v) : (o[stat] || 0) + v; };

// The worldwide table: a Supabase project (set up with tools/leaderboard-setup.sql). Its URL and its public key go here
// (the "publishable" / "anon" key, which is meant to be shipped in a web page; never the secret key). Empty: local ranks only.
const WORLD = { url: '', key: '' };
const myId = () => { if (!profile.lbId) { profile.lbId = crypto.randomUUID(); saveProfile(); } return profile.lbId; }; // (this device's player: a random id, never shown to anyone)
const rpc = (fn, body) => fetch(`${WORLD.url.replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: WORLD.key, Authorization: `Bearer ${WORLD.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  .then((r) => { if (!r.ok) throw new Error('leaderboard ' + r.status); return r.text(); }).then((t) => (t ? JSON.parse(t) : null));
let remote = WORLD.url && WORLD.key ? {
  top: (board, week) => rpc('top_scores', { p_board: board, p_week: week, p_id: myId() }),
  submit: (e) => rpc('submit_score', { p_id: myId(), p_name: e.name, p_week: e.week, p_wk: e.wk, p_all: e.all }),
} : null;
export function setRemote(r) { remote = r; }
export const lbWorld = () => !!remote;

/** Count something of yours toward its board (a total, or a best). Call lbSave() once the match's counts are in. */
export function lbAdd(stat, v = 1) { if (!(v > 0)) return; put(L.all, stat, v); put(week(), stat, v); }
/** Another player's result in a match you shared. */
export function lbMet(name, stats) {
  name = String(name || '').trim().slice(0, 14); if (!name) return;
  const m = L.met[name] || (L.met[name] = { all: {}, wk: {}, key: weekKey() }); if (m.key !== weekKey()) { m.wk = {}; m.key = weekKey(); } m.t = Date.now();
  for (const [s, v] of Object.entries(stats)) if (v > 0) { put(m.all, s, v); put(m.wk, s, v); }
  const names = Object.keys(L.met); // (keep the 200 seen most recently)
  if (names.length > 200) { names.sort((a, b) => (L.met[a].t || 0) - (L.met[b].t || 0)); for (const n of names.slice(0, names.length - 200)) delete L.met[n]; }
}
/** Save your boards, and send them to the worldwide table if there is one (resolves when it has them, or has failed). */
export function lbSave(name) { saveProfile(); return remote ? Promise.resolve().then(() => remote.submit({ name, week: weekKey(), wk: week(), all: { ...L.all, xp: profile.xp || 0 } })).catch(() => {}) : Promise.resolve(); }
/** The top of a board: [{ name, v, me }], best first. wk: this week's board rather than the all-time one. */
export async function lbTop(board, wk, myName) {
  const mine = board === 'xp' && !wk ? profile.xp || 0 : (wk ? week() : L.all)[board] || 0;
  if (remote) try { const rows = await remote.top(board, wk ? weekKey() : 0); // [{ name, v, me, pos }]: the top 50, and you wherever you stand
    if (Array.isArray(rows)) { const out = rows.map((r) => ({ name: String(r.name), v: +r.v || 0, me: !!r.me, pos: +r.pos || 0, world: true })); if (!out.some((r) => r.me)) out.push({ name: myName, v: mine, me: true, pos: 0, world: true }); return out; } } catch (e) { /* offline: the local table */ }
  const rows = [{ name: myName, v: mine, me: true }];
  for (const [name, m] of Object.entries(L.met)) { const v = (wk ? (m.key === weekKey() ? m.wk : {}) : m.all)[board] || 0; if (v > 0 && name !== myName) rows.push({ name, v }); }
  return rows.sort((a, b) => b.v - a.v || (a.me ? -1 : 1)).slice(0, 50);
}
