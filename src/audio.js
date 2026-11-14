// Procedural sound effects (no audio files). Sounds fade with distance from the listener.
let AC = null, MG = null, NB = null, listener = null, vol = 0.5;
export function ensureAudio() {
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      MG = AC.createGain(); MG.gain.value = vol; MG.connect(AC.destination);
      NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
      const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (AC.state === 'suspended') AC.resume();
  } catch (e) { AC = null; }
}
export function setListener(v) { listener = v; }
export function setVolume(v) { vol = v; if (MG) MG.gain.value = v; }
// Sounds fade with distance from the camera, falling off fast. Movement sounds (swings, jumps, landings,
// dashes) only carry ~15 m; combat sounds (slices, clashes, hooks) carry ~32 m.
const NEAR = 15, FAR = 32;
const att = (p, range = FAR) => { if (!p || !listener) return 1; const k = Math.max(0, 1 - p.distanceTo(listener) / range); return k * k; };
function nz(dur, f0, f1, q, vol, type) {
  if (!AC || vol < 0.003) return;
  const t = AC.currentTime, s = AC.createBufferSource(); s.buffer = NB;
  const f = AC.createBiquadFilter(); f.type = type || 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(MG); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
function tn(f0, f1, dur, vol, type) {
  if (!AC || vol < 0.003) return;
  const t = AC.currentTime, o = AC.createOscillator(); o.type = type || 'sine';
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(MG); o.start(t); o.stop(t + dur + 0.05);
}
export const sfx = {
  swish(sp, p) { const a = att(p, NEAR); nz(0.18, 600 + Math.min(sp, 40) * 40, 3200, 1.1, a * (0.08 + Math.min(0.2, sp / 150))); },
  slice(p) { const a = att(p); nz(0.25, 3200, 700, 0.8, 0.35 * a); tn(170, 45, 0.22, 0.4 * a); nz(0.35, 500, 120, 0.7, 0.3 * a, 'lowpass'); },
  tear(p) { const a = att(p); nz(0.16, 5200, 1800, 2, 0.22 * a); nz(0.1, 2600, 900, 3, 0.12 * a); },
  chop(p) { const a = att(p); nz(0.12, 2200, 900, 2.5, 0.3 * a); tn(260, 140, 0.1, 0.18 * a, 'triangle'); nz(0.25, 700, 300, 1, 0.12 * a, 'lowpass'); },
  steel(p) { const a = att(p); [880, 1760, 2640].forEach((f, i) => tn(f, f, 0.25 - i * 0.05, 0.06 * a)); },
  clang(p) { const a = att(p); [523, 1307, 1931, 2780].forEach((f, i) => tn(f, f * 0.98, 0.55 - i * 0.08, 0.11 * a)); nz(0.06, 4000, 3000, 1, 0.3 * a); },
  dash(p) { nz(0.24, 350, 2600, 0.8, 0.28 * att(p, NEAR)); },
  jump(p) { nz(0.12, 300, 900, 1, 0.12 * att(p, NEAR)); },
  pad(p) { const a = att(p, NEAR); tn(200, 900, 0.35, 0.2 * a, 'triangle'); nz(0.3, 500, 3000, 1, 0.15 * a); },
  hookFire(p) { const a = att(p); nz(0.12, 2500, 1200, 3, 0.2 * a); tn(600, 300, 0.1, 0.08 * a, 'square'); },
  hookHit(p) { const a = att(p); tn(1400, 700, 0.12, 0.15 * a, 'triangle'); nz(0.05, 3000, 2000, 2, 0.2 * a); },
  reel(p) { nz(0.08, 900, 1400, 4, 0.05 * att(p, NEAR)); },
  land(p) { nz(0.1, 200, 80, 1, 0.15 * att(p, NEAR), "lowpass"); },
  spawn(p) { const a = att(p, NEAR); tn(300, 600, 0.4, 0.1 * a, 'sine'); },
  // kill effects
  chime(p) { const a = att(p); [1319, 1760, 2637].forEach((f, i) => tn(f, f, 0.5 - i * 0.1, 0.07 * a)); },
  thunder(p) { const a = att(p, 40); nz(0.12, 5000, 1500, 1, 0.35 * a); nz(1.4, 260, 40, 0.6, 0.55 * a, 'lowpass'); },
  shatter(p) { const a = att(p); nz(0.3, 7000, 3500, 2, 0.22 * a); [2200, 3100, 4100].forEach((f) => tn(f, f * 0.9, 0.18, 0.04 * a)); },
  poof(p) { nz(0.45, 900, 180, 0.7, 0.25 * att(p), 'lowpass'); },
  rift(p) { const a = att(p); tn(110, 35, 0.9, 0.22 * a, 'sawtooth'); nz(0.9, 300, 1800, 3, 0.1 * a); },
  fall() { tn(400, 80, 1.2, 0.15, 'sine'); },
  gong() { tn(110, 108, 1.4, 0.25, 'sine'); tn(220, 218, 1.0, 0.1, 'sine'); tn(331, 329, 0.8, 0.06, 'sine'); },
  click() { tn(900, 700, 0.05, 0.06, 'triangle'); },
};
