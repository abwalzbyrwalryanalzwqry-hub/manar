// منار — نغمة هادئة قصيرة عند بلوغ هدف المسبحة (اختيارية، مطفأة افتراضيًا).
// تُولَّد محليًا بـ Web Audio (لا ملف ولا شبكة ولا إذن)، بمستوى منخفض
// وتلاشٍ ناعم، وتتبع مستوى صوت الوسائط في الجهاز.

type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;

export function playGoalChime(): void {
  if (typeof window === "undefined") return;
  try {
    const Ctor: AudioCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    /* نغمتان متتاليتان (خامسة تامة) بلا حدّة. */
    for (const [freq, at] of [
      [523.25, 0],
      [783.99, 0.14],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t0 + at);
      gain.gain.linearRampToValueAtTime(0.08, t0 + at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.95);
    }
  } catch {
    /* الصوت تحسين اختياري — لا يمنع العدّ */
  }
}
