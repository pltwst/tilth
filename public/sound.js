// Synthesized sound effects: no audio files, so they work offline and cost no download.
let ctx = null;
let enabled = true;

// iOS: follow the silent switch and mix with the player's music.
if (navigator.audioSession) navigator.audioSession.type = 'ambient';

export const setSound = (on) => { enabled = on; };

function tone(freq, delay, dur, { type = 'triangle', vol = 0.12, slide = 1 } = {}) {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  const t = ctx.currentTime + delay, osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760]; // C major pentatonic
const run = (notes, gap, dur, opts) => notes.forEach((f, i) => tone(f, i * gap, dur, opts));

const SOUNDS = {
  place: () => { tone(320, 0, 0.14, { vol: 0.22, slide: 0.55 }); tone(900, 0, 0.05, { type: 'sine', vol: 0.04 }); },
  harvest: (n = 1) => run(SCALE.slice(0, Math.min(n, SCALE.length)), 0.065, 0.34),
  invalid: () => tone(150, 0, 0.14, { type: 'square', vol: 0.045, slide: 0.7 }),
  grow: () => run([1567.98, 2093], 0.06, 0.22, { type: 'sine', vol: 0.06 }),
  rot: () => tone(260, 0, 0.32, { type: 'sine', vol: 0.1, slide: 0.5 }),
  season: () => run([523.25, 659.25, 783.99, 1046.5], 0.09, 0.42),
  over: () => run([783.99, 659.25, 523.25, 392], 0.17, 0.5),
  undo: () => tone(620, 0, 0.1, { type: 'sine', vol: 0.07, slide: 0.65 }),
  achieve: () => run([783.99, 1046.5, 1318.51, 1567.98], 0.07, 0.36, { type: 'sine', vol: 0.09 }),
};

export function sfx(name, arg) {
  if (!enabled) return;
  try { SOUNDS[name](arg); } catch { /* no audio available: play silently */ }
}
