// All sounds are generated with the Web Audio API — no files, works offline.
// The AudioContext must be created/resumed from a user gesture (the Start tap).

let ctx = null;
export let muted = false;
export let vibration = true;
let volume = 0.7;

export function setMuted(v) { muted = v; }
export function setVibration(v) { vibration = v; }
export function setVolume(v) { volume = Math.min(1, Math.max(0, v)); }

/** Call from a user gesture (Start button) to unlock audio. */
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  // Play a silent buffer — required on iOS to actually unlock output.
  const buf = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
}

function tone(freq, startIn, duration, { type = 'square', gain = 0.32 } = {}) {
  if (muted || volume === 0 || !ctx || ctx.state !== 'running') return;
  gain *= volume;
  const t0 = ctx.currentTime + startIn;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // short attack/release envelope to avoid clicks
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.setValueAtTime(gain, t0 + duration - 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function vibrate(pattern) {
  if (vibration && navigator.vibrate) navigator.vibrate(pattern);
}

/** Short tick for the 3-2-1 lead-in before every transition. */
export function tick() {
  tone(660, 0, 0.1);
  vibrate(60);
}

/** Work phase begins — high, energetic double beep. */
export function workStart() {
  tone(880, 0, 0.15);
  tone(1175, 0.17, 0.2);
  vibrate([120, 60, 120]);
}

/** Rest / set-rest begins — lower single beep. */
export function restStart() {
  tone(440, 0, 0.35);
  vibrate(250);
}

/** Preview beep for the settings panel (call from a user gesture). */
export function test() {
  unlock();
  tone(880, 0, 0.15);
  tone(1175, 0.17, 0.2);
  vibrate([120, 60, 120]);
}

/** Workout complete — distinct ascending triad. */
export function finish() {
  tone(660, 0, 0.18);
  tone(880, 0.2, 0.18);
  tone(1320, 0.4, 0.5, { type: 'triangle', gain: 0.3 });
  vibrate([300, 100, 300, 100, 500]);
}
