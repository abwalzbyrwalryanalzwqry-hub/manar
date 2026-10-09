// ============================================================
// منار — إعدادات المسبحة
// ------------------------------------------------------------
// الصوت مطفأ افتراضيًا (لا صوت مزعج)، والاهتزاز خفيف ويمكن إطفاؤه.
// العدد الافتراضي إعداد للتطبيق فقط، ولا يُعرض بوصفه عددًا مسنونًا.
// لا يحتاج أي إذن من النظام.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { parseCount } from "@/lib/personal-azkar/model";
import { TASBIH_TARGET_MAX } from "./session";

export const TASBIH_PREFS_KEY = "manar.tasbih.prefs.v1";
export const TASBIH_PREFS_EVENT = "manar:tasbih-prefs";

export type TasbihProgressStyle = "ring" | "bar" | "number";

export interface TasbihPrefs {
  /** اهتزاز خفيف مع كل نقرة. */
  hapticTap: boolean;
  /** اهتزاز أوضح قليلًا عند بلوغ الهدف. */
  hapticGoal: boolean;
  /** نغمة هادئة قصيرة عند بلوغ الهدف (تتبع مستوى صوت الوسائط). */
  soundGoal: boolean;
  /** الهدف المقترح عند بدء جلسة؛ `null` = عدّاد مفتوح. */
  defaultTarget: number | null;
  progressStyle: TasbihProgressStyle;
}

export const DEFAULT_TASBIH_PREFS: TasbihPrefs = {
  hapticTap: true,
  hapticGoal: true,
  soundGoal: false,
  defaultTarget: 33,
  progressStyle: "ring",
};

export function normalizeTasbihPrefs(raw: unknown): TasbihPrefs {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const bool = (k: keyof TasbihPrefs) =>
    typeof r[k] === "boolean" ? (r[k] as boolean) : (DEFAULT_TASBIH_PREFS[k] as boolean);
  const t =
    "defaultTarget" in r
      ? parseCount(r.defaultTarget as number | null, TASBIH_TARGET_MAX)
      : { ok: true as const, value: DEFAULT_TASBIH_PREFS.defaultTarget };
  return {
    hapticTap: bool("hapticTap"),
    hapticGoal: bool("hapticGoal"),
    soundGoal: bool("soundGoal"),
    defaultTarget: t.ok ? t.value : DEFAULT_TASBIH_PREFS.defaultTarget,
    progressStyle:
      r.progressStyle === "bar" || r.progressStyle === "number" || r.progressStyle === "ring"
        ? r.progressStyle
        : DEFAULT_TASBIH_PREFS.progressStyle,
  };
}

export function readTasbihPrefs(): TasbihPrefs {
  if (typeof window === "undefined") return DEFAULT_TASBIH_PREFS;
  try {
    const raw = window.localStorage.getItem(TASBIH_PREFS_KEY);
    return raw ? normalizeTasbihPrefs(JSON.parse(raw)) : DEFAULT_TASBIH_PREFS;
  } catch {
    return DEFAULT_TASBIH_PREFS;
  }
}

function writeTasbihPrefs(p: TasbihPrefs) {
  try {
    window.localStorage.setItem(TASBIH_PREFS_KEY, JSON.stringify(p));
    window.dispatchEvent(new Event(TASBIH_PREFS_EVENT));
  } catch {
    /* يبقى الإعداد في الذاكرة لهذه الجلسة */
  }
}

export function useTasbihPrefs() {
  const [prefs, setPrefs] = useState<TasbihPrefs>(DEFAULT_TASBIH_PREFS);
  useEffect(() => {
    const sync = () => setPrefs(readTasbihPrefs());
    sync();
    window.addEventListener(TASBIH_PREFS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(TASBIH_PREFS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const update = useCallback((patch: Partial<TasbihPrefs>) => {
    const next = normalizeTasbihPrefs({ ...readTasbihPrefs(), ...patch });
    setPrefs(next);
    writeTasbihPrefs(next);
  }, []);
  const reset = useCallback(() => {
    setPrefs(DEFAULT_TASBIH_PREFS);
    writeTasbihPrefs(DEFAULT_TASBIH_PREFS);
  }, []);
  return { prefs, update, reset };
}
