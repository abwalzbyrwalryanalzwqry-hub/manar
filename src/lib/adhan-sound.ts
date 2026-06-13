/* Manar — Synthesized Adhan & Iqama tones (Web Audio API)
 * Works fully offline. No external audio dependency.
 * Each "variant" produces a distinct maqam-flavored chime sequence
 * so the user can audibly distinguish previews.
 */

export type AdhanVariant =
  | "makkah"
  | "madinah"
  | "aqsa"
  | "gulf"
  | "egyptian"
  | "takbir"
  | "short"
  | "silent";

type Note = { f: number; d: number; g?: number };

/* Maqam-inspired note sets (Hz) — purely decorative for preview */
const VARIANTS: Record<AdhanVariant, { notes: Note[]; wave: OscillatorType; reverb?: boolean }> = {
  makkah:   { notes: [{f:293.66,d:.9},{f:329.63,d:.5},{f:392,d:.7},{f:440,d:.9},{f:392,d:.6},{f:329.63,d:.9}], wave: "sine", reverb: true },
  madinah:  { notes: [{f:261.63,d:.8},{f:311.13,d:.5},{f:349.23,d:.7},{f:392,d:.9},{f:349.23,d:.6},{f:293.66,d:1}], wave: "sine", reverb: true },
  aqsa:     { notes: [{f:246.94,d:.9},{f:293.66,d:.5},{f:329.63,d:.7},{f:392,d:.7},{f:440,d:.8},{f:349.23,d:1}], wave: "sine", reverb: true },
  gulf:     { notes: [{f:293.66,d:.6},{f:392,d:.5},{f:349.23,d:.5},{f:440,d:.7},{f:392,d:.8}], wave: "triangle", reverb: true },
  egyptian: { notes: [{f:277.18,d:.9},{f:329.63,d:.6},{f:369.99,d:.7},{f:415.3,d:.8},{f:369.99,d:.6},{f:311.13,d:1}], wave: "sine", reverb: true },
  takbir:   { notes: [{f:329.63,d:.5},{f:392,d:.5},{f:329.63,d:.5},{f:261.63,d:.9}], wave: "sine" },
  short:    { notes: [{f:392,d:.4},{f:440,d:.4},{f:349.23,d:.7}], wave: "sine" },
  silent:   { notes: [], wave: "sine" },
};

let ctx: AudioContext | null = null;
let currentStop: (() => void) | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Subtle convolution reverb tail using a generated impulse */
function makeReverb(c: AudioContext, seconds = 2.2): ConvolverNode {
  const rate = c.sampleRate;
  const len = Math.floor(rate * seconds);
  const impulse = c.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = impulse.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
  }
  const conv = c.createConvolver();
  conv.buffer = impulse;
  return conv;
}

export function stopAdhan() {
  if (currentStop) {
    try { currentStop(); } catch { /* ignore */ }
    currentStop = null;
  }
}

export type PlayOptions = { volume?: number; onEnd?: () => void };

/** Play a synthesized adhan/iqama variant. Returns a stop fn. */
export function playAdhan(variant: AdhanVariant, opts: PlayOptions = {}): () => void {
  stopAdhan();
  const v = VARIANTS[variant];
  if (!v || variant === "silent" || !v.notes.length) {
    opts.onEnd?.();
    return () => {};
  }
  const c = getCtx();
  if (!c) { opts.onEnd?.(); return () => {}; }

  const master = c.createGain();
  master.gain.value = opts.volume ?? 0.45;
  master.connect(c.destination);

  let tail: AudioNode = master;
  if (v.reverb) {
    const rev = makeReverb(c, 2.4);
    const wet = c.createGain();
    wet.gain.value = 0.35;
    rev.connect(wet).connect(master);
    tail = rev;
  }

  const oscs: OscillatorNode[] = [];
  let t = c.currentTime + 0.05;
  for (const n of v.notes) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = v.wave;
    o.frequency.value = n.f;
    // Octave doubling for richness
    const o2 = c.createOscillator();
    const g2 = c.createGain();
    o2.type = "sine";
    o2.frequency.value = n.f * 2;
    g2.gain.value = 0;

    const peak = (n.g ?? 0.9);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.08);
    g.gain.linearRampToValueAtTime(0.0001, t + n.d);

    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(peak * 0.25, t + 0.1);
    g2.gain.linearRampToValueAtTime(0.0001, t + n.d);

    o.connect(g).connect(tail);
    o2.connect(g2).connect(tail);
    if (tail !== master) { g.connect(master); g2.connect(master); }

    o.start(t);
    o2.start(t);
    o.stop(t + n.d + 0.05);
    o2.stop(t + n.d + 0.05);
    oscs.push(o, o2);
    t += n.d * 0.85;
  }

  const totalMs = (t - c.currentTime) * 1000 + 300;
  const timer = window.setTimeout(() => opts.onEnd?.(), totalMs);

  const stop = () => {
    window.clearTimeout(timer);
    oscs.forEach((o) => { try { o.stop(); } catch { /* ignore */ } });
    try { master.disconnect(); } catch { /* ignore */ }
  };
  currentStop = stop;
  return stop;
}

/** Short notification chime (used for reminders / iqama) */
export function playChime(volume = 0.4) {
  const c = getCtx();
  if (!c) return;
  const g = c.createGain();
  g.gain.value = volume;
  g.connect(c.destination);
  [880, 1175, 1568].forEach((f, i) => {
    const o = c.createOscillator();
    const og = c.createGain();
    o.type = "sine";
    o.frequency.value = f;
    const start = c.currentTime + i * 0.12;
    og.gain.setValueAtTime(0, start);
    og.gain.linearRampToValueAtTime(0.8, start + 0.04);
    og.gain.linearRampToValueAtTime(0.0001, start + 0.4);
    o.connect(og).connect(g);
    o.start(start);
    o.stop(start + 0.45);
  });
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
  }
}
