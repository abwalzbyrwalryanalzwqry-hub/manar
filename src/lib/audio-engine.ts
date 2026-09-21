/* Manar — Real Audio Engine
 * ---------------------------------------------------------------
 * A dedicated HTMLAudioElement-based player. No oscillators, no
 * synthesized tones, no placeholder sounds. If an audio asset is
 * missing, an Arabic toast is surfaced and playback aborts — we
 * never substitute synthetic audio.
 *
 * Supported formats: MP3, WAV, OGG.
 */

import { toast } from "sonner";

export type PlayOptions = {
  volume?: number; // 0..1
  onEnd?: () => void;
  onError?: (msg: string) => void;
  silentOnMissing?: boolean; // suppress toast (used for optional chains)
  label?: string; // human label included in error toast
};

let current: HTMLAudioElement | null = null;

function teardown() {
  if (!current) return;
  try {
    current.pause();
  } catch {
    /* ignore */
  }
  try {
    current.src = "";
    current.load();
  } catch {
    /* ignore */
  }
  current = null;
}

export function stop() {
  teardown();
  /* داخل أندرويد قد يكون الصوت جارياً في الخدمة الأصلية لا في عنصر <audio>،
   * فـ`teardown` وحده لا يُسكته وتستمرّ النغمة بعد مغادرة الشاشة. */
  nativeBridge()
    ?.stop()
    .catch(() => {});
}

export function isPlaying() {
  return !!current && !current.paused;
}

/**
 * Play a single audio asset by URL. Returns a stop() function.
 * Calls onEnd() when playback finishes naturally.
 * Calls onError() and shows an Arabic toast when the file fails.
 */
/* --------------------- الجسر إلى المُشغّل الأصلي --------------------- */

type NativeAdhanBridge = {
  preview: (o: { sound: string; title?: string; body?: string }) => Promise<void>;
  stop: () => Promise<void>;
};

/** اسم مورد أندرويد المقابل لمسار صوت — نفس التحويل في `sync-android-raw-audio.mjs`. */
function rawName(url: string): string {
  const file = url.split("/").pop() ?? "";
  return file
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "a$1");
}

function nativeBridge(): NativeAdhanBridge | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } })
    .Capacitor;
  return (cap?.Plugins?.["ManarAdhan"] as NativeAdhanBridge | undefined) ?? null;
}

export function play(url: string, opts: PlayOptions = {}): () => void {
  teardown();

  if (typeof window === "undefined" || typeof Audio === "undefined") {
    opts.onEnd?.();
    return () => {};
  }

  /* داخل أندرويد نُشغّل من `res/raw` عبر الخدمة الأصلية لا بعنصر <audio>.
   *
   * سببان، كلاهما لازم:
   *   • الملفات ليست في أصول الويب أصلاً — تُحذف من الحزمة عمداً حتى لا
   *     تُشحن مرّتين (scripts/prepare-android-webdir.mjs)، فعنصر <audio>
   *     لن يجد شيئاً.
   *   • الخدمة الأمامية تحتفظ بتركيز الصوت وتعرض أزرار قفل الشاشة وتُكمل
   *     التشغيل إذا غادر المستخدم التطبيق — وعنصر <audio> في WebView يُقطع.
   *
   * لا نعرف متى ينتهي التشغيل الأصلي، فنستدعي `onEnd` فوراً: كل مستدعٍ
   * يستعمله لإطفاء مؤشّر «يُشغَّل الآن» فحسب، وإبقاؤه معلّقاً أسوأ من
   * إطفائه مبكراً.
   */
  const bridge = nativeBridge();
  if (bridge) {
    const sound = rawName(url);
    if (!sound) {
      opts.onEnd?.();
      return () => {};
    }
    void bridge
      .preview({ sound, title: opts.label ?? "معاينة", body: "" })
      .then(() => opts.onEnd?.())
      .catch(() => {
        opts.onError?.("native_error");
        if (!opts.silentOnMissing) {
          toast.error("تعذّر تشغيل الصوت", {
            description: opts.label ? `الملف الصوتي لـ ${opts.label} غير متوفّر` : undefined,
          });
        }
      });
    return () => void bridge.stop().catch(() => {});
  }

  const a = new Audio();
  a.preload = "auto";
  a.volume = clamp(opts.volume ?? 0.8, 0, 1);
  a.src = url;
  current = a;

  let done = false;
  const finish = (err?: string) => {
    if (done) return;
    done = true;
    if (current === a) current = null;
    if (err) {
      opts.onError?.(err);
      // Autoplay policy blocks (no user gesture yet) are not a missing file —
      // never scare the user with an asset error for them.
      if (!opts.silentOnMissing && err !== "play_blocked") {
        toast.error("ملف الصوت غير متوفر", {
          description: opts.label
            ? `يرجى إضافة الملف الصوتي لـ ${opts.label}`
            : "يرجى إضافة الملف الصوتي إلى مجلد الأصوات",
        });
      }
    } else {
      opts.onEnd?.();
    }
  };

  a.addEventListener("ended", () => finish());
  a.addEventListener("error", () => finish("file_error"));

  a.play().catch(() => finish("play_blocked"));

  return () => {
    if (current === a) teardown();
    done = true;
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** Best-effort device vibration. */
export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
}
