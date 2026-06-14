/* Manar — Synthesized Adhan & Iqama tones (Web Audio API)
 * Works fully offline. Each variant uses a distinct maqam, tempo,
 * timbre and length so previews are audibly different.
 *
 * Notes:
 *   • Real, copyright-cleared adhan recordings can later be plugged in
 *     by replacing playAdhan() with an <audio> element fed from
 *     ADHAN_CATEGORIES[variant].asset — the call sites already exist.
 *   • Until an audio asset exists for a variant we render a
 *     maqam-flavoured chime so the user can distinguish selections.
 */

export type AdhanVariant =
  | "makkah"
  | "madinah"
  | "aqsa"
  | "gulf"
  | "egyptian"
  | "fajr_tathweeb"   // الصلاة خير من النوم
  | "takbir"
  | "short"
  | "silent";

export type IqamaVariant =
  | "iqama_full"      // إقامة كاملة
  | "iqama_qad"       // قد قامت الصلاة (mid length)
  | "iqama_short"     // تنبيه قصير
  | "iqama_chime"     // نغمة لطيفة
  | "silent";

type Note = { f: number; d: number; g?: number };
type Pattern = { notes: Note[]; wave: OscillatorType; reverb?: boolean; gap?: number; repeat?: number };

/* Maqam-flavoured patterns. Different scales/tempos make each
 * variant clearly distinguishable on preview. */
const ADHAN_PATTERNS: Record<AdhanVariant, Pattern> = {
  /* Hejaz — slow, ornamented, characteristic Makkan call */
  makkah: {
    wave: "sine", reverb: true, gap: 0.35,
    notes: [
      {f:293.66,d:1.1},{f:329.63,d:.6},{f:349.23,d:.5},{f:392,d:1.0},
      {f:440,d:.6},{f:392,d:.5},{f:349.23,d:.5},{f:329.63,d:1.1},
      {f:293.66,d:.6},{f:261.63,d:1.2},
    ],
  },
  /* Bayati — softer, longer notes (Madinah) */
  madinah: {
    wave: "sine", reverb: true, gap: 0.4,
    notes: [
      {f:261.63,d:1.0},{f:311.13,d:.55},{f:349.23,d:.55},{f:392,d:1.2},
      {f:349.23,d:.55},{f:311.13,d:.55},{f:293.66,d:1.4},{f:261.63,d:1.2},
    ],
  },
  /* Hijaz w/ a higher tessitura — Aqsa */
  aqsa: {
    wave: "triangle", reverb: true, gap: 0.3,
    notes: [
      {f:246.94,d:.9},{f:293.66,d:.4},{f:329.63,d:.5},{f:392,d:.7},
      {f:440,d:.7},{f:466.16,d:.5},{f:440,d:.5},{f:349.23,d:1.1},
      {f:329.63,d:.5},{f:293.66,d:1.0},
    ],
  },
  /* Nahawand — minor, drier (Gulf) */
  gulf: {
    wave: "triangle", reverb: false, gap: 0.22,
    notes: [
      {f:293.66,d:.55},{f:349.23,d:.4},{f:392,d:.4},{f:466.16,d:.55},
      {f:392,d:.55},{f:349.23,d:.4},{f:293.66,d:.65},{f:261.63,d:.9},
    ],
  },
  /* Saba — distinctly oriental, slower (Egyptian) */
  egyptian: {
    wave: "sine", reverb: true, gap: 0.5,
    notes: [
      {f:277.18,d:1.1},{f:329.63,d:.55},{f:349.23,d:.55},{f:415.3,d:.9},
      {f:369.99,d:.55},{f:349.23,d:.65},{f:311.13,d:.9},{f:277.18,d:1.3},
      {f:246.94,d:1.4},
    ],
  },
  /* Tathweeb — الصلاة خير من النوم — short ascending phrase */
  fajr_tathweeb: {
    wave: "sine", reverb: true, gap: 0.35,
    notes: [
      {f:293.66,d:.6},{f:349.23,d:.5},{f:392,d:.55},{f:440,d:.9},
      {f:392,d:.55},{f:349.23,d:.7},{f:293.66,d:1.0},
    ],
  },
  takbir: {
    wave: "sine", reverb: true, gap: 0.25, repeat: 2,
    notes: [{f:329.63,d:.45},{f:392,d:.45},{f:329.63,d:.45},{f:261.63,d:.9}],
  },
  short: {
    wave: "sine", reverb: true, gap: 0.2,
    notes: [{f:392,d:.35},{f:440,d:.35},{f:349.23,d:.6}],
  },
  silent: { wave: "sine", notes: [] },
};

/* Iqama patterns — shorter, more rhythmic */
const IQAMA_PATTERNS: Record<Exclude<IqamaVariant,"silent">, Pattern> = {
  iqama_full: {
    wave: "sine", reverb: true, gap: 0.18,
    notes: [
      {f:392,d:.4},{f:440,d:.4},{f:392,d:.4},{f:349.23,d:.6},
      {f:392,d:.4},{f:440,d:.5},{f:392,d:.4},{f:349.23,d:.5},
      {f:329.63,d:.5},{f:293.66,d:.7},
    ],
  },
  iqama_qad: {
    wave: "sine", reverb: true, gap: 0.18,
    notes: [
      {f:349.23,d:.45},{f:392,d:.45},{f:440,d:.5},
      {f:392,d:.45},{f:349.23,d:.45},{f:293.66,d:.7},
    ],
  },
  iqama_short: {
    wave: "triangle", reverb: false, gap: 0.1,
    notes: [{f:440,d:.25},{f:523.25,d:.25},{f:392,d:.4}],
  },
  iqama_chime: {
    wave: "sine", reverb: true, gap: 0.08,
    notes: [{f:880,d:.18},{f:1175,d:.18},{f:1568,d:.32}],
  },
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

function makeReverb(c: AudioContext, seconds = 2.4): ConvolverNode {
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

function playPattern(p: Pattern, opts: PlayOptions): () => void {
  stopAdhan();
  if (!p.notes.length) { opts.onEnd?.(); return () => {}; }
  const c = getCtx();
  if (!c) { opts.onEnd?.(); return () => {}; }

  const master = c.createGain();
  master.gain.value = opts.volume ?? 0.45;
  master.connect(c.destination);

  let tail: AudioNode = master;
  if (p.reverb) {
    const rev = makeReverb(c, 2.4);
    rev.connect(master);
    tail = rev;
  }

  const oscs: OscillatorNode[] = [];
  let t = c.currentTime + 0.05;
  const repeat = p.repeat ?? 1;
  const gap = p.gap ?? 0.25;
  for (let r = 0; r < repeat; r++) {
    for (const n of p.notes) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = p.wave;
      o.frequency.value = n.f;
      const o2 = c.createOscillator();
      const g2 = c.createGain();
      o2.type = "sine";
      o2.frequency.value = n.f * 2;
      const peak = n.g ?? 0.85;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.08);
      g.gain.linearRampToValueAtTime(0.0001, t + n.d);
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(peak * 0.22, t + 0.1);
      g2.gain.linearRampToValueAtTime(0.0001, t + n.d);
      o.connect(g).connect(tail);
      o2.connect(g2).connect(tail);
      if (tail !== master) { g.connect(master); g2.connect(master); }
      o.start(t); o2.start(t);
      o.stop(t + n.d + 0.05); o2.stop(t + n.d + 0.05);
      oscs.push(o, o2);
      t += n.d * 0.7 + gap;
    }
  }

  const totalMs = (t - c.currentTime) * 1000 + 400;
  const timer = window.setTimeout(() => opts.onEnd?.(), totalMs);
  const stop = () => {
    window.clearTimeout(timer);
    oscs.forEach((o) => { try { o.stop(); } catch { /* ignore */ } });
    try { master.disconnect(); } catch { /* ignore */ }
  };
  currentStop = stop;
  return stop;
}

export function playAdhan(variant: AdhanVariant, opts: PlayOptions = {}): () => void {
  const p = ADHAN_PATTERNS[variant];
  if (!p || variant === "silent") { opts.onEnd?.(); return () => {}; }
  return playPattern(p, opts);
}

export function playIqama(variant: IqamaVariant, opts: PlayOptions = {}): () => void {
  if (variant === "silent") { opts.onEnd?.(); return () => {}; }
  const p = IQAMA_PATTERNS[variant];
  if (!p) { opts.onEnd?.(); return () => {}; }
  return playPattern(p, opts);
}

/** Short notification chime (used for reminders) */
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
