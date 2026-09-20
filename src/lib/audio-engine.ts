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
}

export function isPlaying() {
  return !!current && !current.paused;
}

/**
 * Play a single audio asset by URL. Returns a stop() function.
 * Calls onEnd() when playback finishes naturally.
 * Calls onError() and shows an Arabic toast when the file fails.
 */
export function play(url: string, opts: PlayOptions = {}): () => void {
  teardown();

  if (typeof window === "undefined" || typeof Audio === "undefined") {
    opts.onEnd?.();
    return () => {};
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
