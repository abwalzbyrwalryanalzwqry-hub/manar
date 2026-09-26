// ============================================================
// Manar — Azkar Module
// تفضيلات جلسة الأذكار والوِرد: حجم نص الذكر، والاهتزاز، والعدّ بالضغط على النص.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { pulse } from "@/lib/haptics";

const KEY = "manar.azkar.prefs.v1";
const EVENT = "manar:azkar-prefs";

/** أحجام نص الذكر بالبكسل. الافتراضي ٢٢ (الحجم السابق الثابت). */
export const TEXT_SIZES = [18, 20, 22, 25, 28, 32] as const;
export const DEFAULT_TEXT_SIZE = 2;

export interface AzkarPrefs {
  /** فهرس في TEXT_SIZES. */
  textSize: number;
  /** اهتزاز خفيف مع كل نقرة عدّ. */
  hapticTap: boolean;
  /** اهتزاز أقوى قليلًا عند إتمام الذكر (أو مقطع منه) والانتقال لما بعده. */
  hapticDone: boolean;
  /** الضغط على نص الذكر يعدّ كالضغط على زر العدّاد. */
  tapAnywhere: boolean;
}

export const DEFAULT_AZKAR_PREFS: AzkarPrefs = {
  textSize: DEFAULT_TEXT_SIZE,
  hapticTap: true,
  hapticDone: true,
  tapAnywhere: true,
};

export function clampTextSize(n: unknown): number {
  const i = Math.trunc(Number(n));
  if (!Number.isFinite(i)) return DEFAULT_TEXT_SIZE;
  return Math.max(0, Math.min(TEXT_SIZES.length - 1, i));
}

export function normalizeAzkarPrefs(raw: unknown): AzkarPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<AzkarPrefs> & {
    /** الإصدار السابق: مفتاح واحد للاهتزاز — إطفاؤه يطفئ النوعين. */
    haptics?: unknown;
  };
  const legacy = typeof r.haptics === "boolean" ? r.haptics : undefined;
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : (legacy ?? d));
  return {
    textSize: r.textSize === undefined ? DEFAULT_TEXT_SIZE : clampTextSize(r.textSize),
    hapticTap: bool(r.hapticTap, DEFAULT_AZKAR_PREFS.hapticTap),
    hapticDone: bool(r.hapticDone, DEFAULT_AZKAR_PREFS.hapticDone),
    tapAnywhere:
      typeof r.tapAnywhere === "boolean" ? r.tapAnywhere : DEFAULT_AZKAR_PREFS.tapAnywhere,
  };
}

export function readAzkarPrefs(): AzkarPrefs {
  if (typeof window === "undefined") return DEFAULT_AZKAR_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? normalizeAzkarPrefs(JSON.parse(raw)) : DEFAULT_AZKAR_PREFS;
  } catch {
    return DEFAULT_AZKAR_PREFS;
  }
}

function writeAzkarPrefs(p: AzkarPrefs) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

/** حجم نص الذكر بالبكسل؛ نص القرآن بخط المصحف يأخذ الحجم نفسه تقريبًا. */
export function textSizePx(p: Pick<AzkarPrefs, "textSize">): number {
  return TEXT_SIZES[clampTextSize(p.textSize)];
}

export function useAzkarPrefs() {
  /* يبدأ بالافتراضي ثم يُقرأ بعد التركيب، حتى يطابق ما رُسم على الخادم. */
  const [prefs, setPrefs] = useState<AzkarPrefs>(DEFAULT_AZKAR_PREFS);
  useEffect(() => {
    const sync = () => setPrefs(readAzkarPrefs());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<AzkarPrefs>) => {
    const next = normalizeAzkarPrefs({ ...readAzkarPrefs(), ...patch });
    setPrefs(next);
    writeAzkarPrefs(next);
  }, []);

  return { prefs, update };
}

/* ------------------------------ الاهتزاز ------------------------------ */

export type HapticKind = "tap" | "step" | "done";

/** قوة كل نوع: العدّة خفيفة، ونهاية المقطع وإتمام الذكر أقوى قليلًا. */
export const HAPTIC_STRENGTH = { tap: "light", step: "medium", done: "medium" } as const;

/** هل يهتز هذا النوع بحسب إعدادات المستخدم؟ */
export function hapticEnabled(
  prefs: Pick<AzkarPrefs, "hapticTap" | "hapticDone">,
  kind: HapticKind,
): boolean {
  return kind === "tap" ? prefs.hapticTap : prefs.hapticDone;
}

/** يهتز إن كان النوع مفعّلًا. على أندرويد عبر @capacitor/haptics (انظر lib/haptics). */
export function haptic(prefs: Pick<AzkarPrefs, "hapticTap" | "hapticDone">, kind: HapticKind) {
  if (hapticEnabled(prefs, kind)) pulse(HAPTIC_STRENGTH[kind]);
}

/** نوع الاهتزاز لعدّة تنقل العدّاد من `before` إلى `before + 1`. */
export function hapticFor(
  before: number,
  repeat: number,
  segments?: readonly { repeat: number }[],
): HapticKind {
  const after = before + 1;
  if (after >= repeat) return "done";
  if (segments?.length) {
    let edge = 0;
    for (const s of segments) {
      edge += s.repeat;
      if (after === edge) return "step";
    }
  }
  return "tap";
}

/**
 * هل الضغطة على النص تُعدّ؟ لا إن وقعت على زر أو رابط أو عنصر مستثنى
 * (`data-no-tap`)، ولا إن كان المستخدم يحدّد نصًا.
 */
export function isCountableTap(target: EventTarget | null): boolean {
  const el = target as { closest?: (s: string) => unknown } | null;
  if (el?.closest?.("button, a, input, select, textarea, [data-no-tap]")) return false;
  if (typeof window !== "undefined") {
    const sel = window.getSelection?.();
    if (sel && !sel.isCollapsed && sel.toString().trim()) return false;
  }
  return true;
}
