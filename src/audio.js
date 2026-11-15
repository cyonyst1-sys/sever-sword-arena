// Procedural sound effects (no audio files). Sounds fade with distance from the listener.
let AC = null, MG = null, NB = null, listener = null, vol = 0.5;
export function ensureAudio() {
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      MG = AC.createGain(); MG.gain.value = muted ? 0 : vol; MG.connect(AC.destination);
      NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
      const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (AC.state === 'suspended') AC.resume();
  } catch (e) { AC = null; }
}
export function setListener(v) { listener = v; }
let muted = false; // (the portal can mute the game, e.g. CrazyGames' own sound toggle)
export function setVolume(v) { vol = v; if (MG) MG.gain.value = muted ? 0 : v; }
export function setMuted(m) { muted = !!m; if (MG) MG.gain.value = muted ? 0 : vol; }
// Sounds fade with distance from the camera, falling off fast. Movement sounds (swings, jumps, landings,
// dashes) only carry ~15 m; combat sounds (slices, clashes, hooks) carry ~32 m.
const NEAR = 15, FAR = 32;
const att = (p, range = FAR) => { if (!p || !listener) return 1; const k = Math.max(0, 1 - p.distanceTo(listener) / range); return k * k; };
function nz(dur, f0, f1, q, vol, type) {
  if (!AC || vol < 0.003) return;
  const t = AC.currentTime, s = AC.createBufferSource(); s.buffer = NB; s.loop = true; // (loops: long sounds outlast the 1 s noise buffer)
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
// a short voiced grunt: a buzzy source through two vowel formants ("eh"), its pitch sagging
function voice(f0, f1, dur, vol, fm = [[560, 6], [1750, 9]], hold = 0.55, delay = 0) {
  if (!AC || vol < 0.003) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const vib = AC.createOscillator(), vg = AC.createGain(); vib.frequency.value = 23; vg.gain.value = f0 * 0.04; vib.connect(vg); vg.connect(o.frequency); // a rough, wet wobble
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.setValueAtTime(vol, t + dur * hold); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const [f, q, from, gt] of fm) { // (from: glide in from another sound, e.g. an "l"; gt: hold it a while first, then glide over gt, e.g. "o" into "i")
    const b = AC.createBiquadFilter(); b.type = 'bandpass'; b.Q.value = q; b.frequency.setValueAtTime(from || f, t);
    if (from) { if (gt) b.frequency.setValueAtTime(from, t + gt * 0.45); b.frequency.exponentialRampToValueAtTime(f, t + (gt || 0.09)); }
    o.connect(b); b.connect(g);
  }
  g.connect(MG); o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
}
// one small wet bubble pop, after a delay: a quick upward chirp
function bubble(delay, f, vol) {
  if (!AC || vol < 0.003) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.035);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g); g.connect(MG); o.start(t); o.stop(t + 0.08);
}
export const sfx = {
  swish(sp, p) { const a = att(p, NEAR); nz(0.18, 600 + Math.min(sp, 40) * 40, 3200, 1.1, a * (0.08 + Math.min(0.2, sp / 150))); },
  slice(p) { const a = att(p); nz(0.25, 3200, 700, 0.8, 0.35 * a); nz(0.3, 420, 110, 0.7, 0.32 * a, 'lowpass'); }, // the cut: a hiss and a soft thud
  kill(p) { // a kill: the cut, a wet "bleh" / "blah" / "bluh" / "uhh" / "ahh" / quick "mm" / "HOI" (short or drawn out, as the breath goes out of him), then light gurgling
    const a = att(p); this.slice(p);
    const k = Math.random() * 7 | 0; // bleh, blah, bluh, or just a groan: uhh or ahh, or a quick closed-mouth mm, or a yelped HOI
    if (k === 6) { // "HO-EE": a breathy h, a short shouted "ho", a tiny break, then "ee"
      const d = 0.35 + Math.random() * 0.2;
      nz(0.08, 1300, 1000, 1.2, 0.22 * a); // h
      const p0 = 205 + Math.random() * 35, ho = d * 0.42, ee = d * 0.62;
      voice(p0, p0 * 0.92, ho, 0.85 * a, [[520, 6], [880, 8]], 0.6); // "HO"
      voice(p0 * 1.12, p0 * 0.8, ee, 0.85 * a, [[300, 6], [2350, 10]], 0.45, ho + 0.04); // "EE", a beat later, up a little then falling
      for (let i = 0; i < 5; i++) bubble(d * 1.05 + i * 0.06 + Math.random() * 0.03, 260 + Math.random() * 380, (0.085 - i * 0.01) * a);
      return;
    }
    if (k < 3) nz(0.035, 260, 140, 0.8, 0.5 * a, 'lowpass'); // the "b": lips popping open
    const vw = [[[560, 6, 380], [1750, 9, 1000]], [[800, 6, 380], [1220, 8, 1000]], [[640, 6, 380], [1190, 8, 1000]], [[620, 6], [1150, 8]], [[820, 6], [1250, 8]], [[270, 3], [2300, 7]]][k]; // eh, ah or uh (an l gliding into each)
    const dur = k === 5 ? 0.22 + Math.random() * 0.2 : 0.5 + Math.random() * Math.random() * 1.7; // mostly shortish, now and then long and drawn out (mm: always quick)
    voice(150 + Math.random() * 40, dur > 1.2 ? 55 : 75, dur, 0.75 * a, vw, 0.18 + Math.random() * 0.15);
    nz(dur + 0.1, 1900, 600, 1.2, 0.13 * a); // the breath itself, a rasping exhale under it
    for (let i = 0; i < 5; i++) bubble(dur * 0.85 + i * 0.06 + Math.random() * 0.03, 260 + Math.random() * 380, (0.085 - i * 0.01) * a); // a short gurgle
    nz(0.3, 700, 250, 3, 0.07 * a); // a little wet rasp
  },
  tear(p) { const a = att(p); nz(0.16, 5200, 1800, 2, 0.22 * a); nz(0.1, 2600, 900, 3, 0.12 * a); },
  chop(p) { const a = att(p); nz(0.12, 2200, 900, 2.5, 0.3 * a); tn(260, 140, 0.1, 0.18 * a, 'triangle'); nz(0.25, 700, 300, 1, 0.12 * a, 'lowpass'); },
  steel(p) { const a = att(p); [880, 1760, 2640].forEach((f, i) => tn(f, f, 0.25 - i * 0.05, 0.06 * a)); },
  clang(p) { // blade on blade: a bright "ching": a sharp metallic tick, high inharmonic partials ringing out (each a slightly detuned pair, so it shimmers), and a short scraping hiss
    const a = att(p), b = 2050 + Math.random() * 450;
    nz(0.03, 7000, 5000, 0.7, 0.32 * a, 'highpass'); // the strike
    nz(0.2, 9500, 3800, 5, 0.1 * a); // the scrape of edge along edge
    [[1, 0.95, 0.055], [1.47, 0.75, 0.045], [2.09, 0.55, 0.035], [2.76, 0.4, 0.028], [3.6, 0.28, 0.02]].forEach(([k, d, v]) => { const f = b * k; tn(f, f * 0.997, d, v * a); tn(f * 1.0035, f * 1.0005, d * 0.9, v * 0.7 * a); });
    tn(1100, 760, 0.05, 0.05 * a, 'triangle'); // a little weight behind it
  },
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
