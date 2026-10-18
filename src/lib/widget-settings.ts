/* منار — إعدادات ويدجتات الشاشة الرئيسية (أندرويد).
 *
 * طبقتان:
 *  - «الافتراضي» (`manar.widget.v1`): يُطبَّق على كل ويدجت لم تُخصَّص إعداداته،
 *    ويُرسَل مع اللقطة (`widget-snapshot.ts`).
 *  - «لكل ويدجت» (`manar.widget.instances.v1`): إعدادات نسخة بعينها على الشاشة
 *    (رقمها `appWidgetId`)، تُرسَل للأصلي بـ`setWidgetConfig` وتغلب الافتراضي.
 */

import { useCallback, useEffect, useState } from "react";

export const WIDGET_SETTINGS_KEY = "manar.widget.v1";
export const WIDGET_INSTANCES_KEY = "manar.widget.instances.v1";
export const WIDGET_SETTINGS_EVENT = "manar:widget-settings";
/** طلب «تحديث الويدجت الآن» — تستمع له `WidgetSync`. */
export const WIDGET_REFRESH_EVENT = "manar:widget-refresh";

/**
 * - auto: يتبع مظهر التطبيق (فاتح ← رملي، داكن ← ليلي).
 * - dynamic: ألوان النظام (Material You) على أندرويد ١٢ فأحدث، وإلا «ليلي».
 * - clear / clearDark: شفاف بنصّ فاتح / داكن فوق الخلفية.
 */
export type WidgetTheme = "auto" | "night" | "emerald" | "sand" | "dynamic" | "clear" | "clearDark";
export type CountdownMode = "minutes" | "seconds" | "off";

export interface WidgetOptions {
  /** آية اليوم في الويدجت الشامل. */
  verse: boolean;
  /**
   * العدّ للصلاة القادمة:
   *  - minutes: «بعد ساعتين و١٥ دقيقة» بخط التطبيق (يتحدّث كل دقيقة والشاشة مضاءة).
   *  - seconds: عدّاد حيّ بالثواني (أرقامه بخط النظام — قيد في أندرويد).
   */
  countdown: CountdownMode;
  /** سطر التاريخ الهجري. */
  hijri: boolean;
  /** اسم المدينة. */
  city: boolean;
  /** سطر الموسم بدل التاريخ الهجري في أيامه. */
  season: boolean;
  /** صف مواقيت اليوم الخمس حين تتسع المساحة. */
  times: boolean;
  /** اختصارات (المصحف، الأذكار، القبلة، المسبحة) في الويدجت الشامل الكبير. */
  shortcuts: boolean;
  theme: WidgetTheme;
  /** شفافية الخلفية ٠–١٠٠ (١٠٠ = معتمة). */
  opacity: number;
}

export const DEFAULT_WIDGET_OPTIONS: WidgetOptions = {
  verse: true,
  countdown: "minutes",
  hijri: true,
  city: true,
  season: true,
  times: true,
  shortcuts: true,
  theme: "night",
  opacity: 100,
};

export const WIDGET_THEME_LABELS: Record<WidgetTheme, string> = {
  auto: "يتبع التطبيق",
  night: "ليلي",
  emerald: "زمردي",
  sand: "رملي فاتح",
  dynamic: "ألوان النظام",
  clear: "شفاف بنص فاتح",
  clearDark: "شفاف بنص داكن",
};

export const COUNTDOWN_LABELS: Record<CountdownMode, string> = {
  minutes: "بالدقائق بخط منار",
  seconds: "حيّ بالثواني",
  off: "بلا عدّ",
};

const THEMES = Object.keys(WIDGET_THEME_LABELS) as WidgetTheme[];

export function normalizeWidgetOptions(raw: unknown): WidgetOptions {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const bool = (v: unknown, fb: boolean) => (typeof v === "boolean" ? v : fb);
  /* الإصدار السابق: countdown منطقي — true يصير «بالدقائق» (أخفّ وبخط التطبيق)، وfalse = بلا عدّ. */
  const countdown: CountdownMode =
    o.countdown === "minutes" || o.countdown === "seconds" || o.countdown === "off"
      ? o.countdown
      : o.countdown === false
        ? "off"
        : DEFAULT_WIDGET_OPTIONS.countdown;
  const opacity =
    typeof o.opacity === "number" && Number.isFinite(o.opacity)
      ? Math.round(Math.min(100, Math.max(0, o.opacity)))
      : DEFAULT_WIDGET_OPTIONS.opacity;
  return {
    verse: bool(o.verse, DEFAULT_WIDGET_OPTIONS.verse),
    countdown,
    hijri: bool(o.hijri, DEFAULT_WIDGET_OPTIONS.hijri),
    city: bool(o.city, DEFAULT_WIDGET_OPTIONS.city),
    season: bool(o.season, DEFAULT_WIDGET_OPTIONS.season),
    times: bool(o.times, DEFAULT_WIDGET_OPTIONS.times),
    shortcuts: bool(o.shortcuts, DEFAULT_WIDGET_OPTIONS.shortcuts),
    theme: THEMES.includes(o.theme as WidgetTheme)
      ? (o.theme as WidgetTheme)
      : DEFAULT_WIDGET_OPTIONS.theme,
    opacity,
  };
}

export function readWidgetOptions(): WidgetOptions {
  if (typeof window === "undefined") return DEFAULT_WIDGET_OPTIONS;
  try {
    const raw = window.localStorage.getItem(WIDGET_SETTINGS_KEY);
    return raw ? normalizeWidgetOptions(JSON.parse(raw)) : DEFAULT_WIDGET_OPTIONS;
  } catch {
    return DEFAULT_WIDGET_OPTIONS;
  }
}

export function writeWidgetOptions(next: WidgetOptions) {
  try {
    window.localStorage.setItem(WIDGET_SETTINGS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(WIDGET_SETTINGS_EVENT));
  } catch {
    /* ignore quota */
  }
}

/* ───────────── إعدادات كل نسخة ───────────── */

/** خيارات نسخة بعينها: ما يخالف الإعدادات العامة فقط (الباقي يتبعها). */
export type WidgetOverrides = Partial<WidgetOptions>;
export type WidgetInstanceConfigs = Record<string, WidgetOverrides>;

/** يبقي من الكائن المفاتيح الصالحة بقيم صالحة فقط. */
export function normalizeWidgetOverrides(raw: unknown): WidgetOverrides {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const full = normalizeWidgetOptions(o);
  const out: WidgetOverrides = {};
  for (const k of Object.keys(DEFAULT_WIDGET_OPTIONS) as (keyof WidgetOptions)[]) {
    if (!(k in o)) continue;
    // قيمة غير صالحة تُطبَّع إلى الافتراضي؛ نقبلها فقط إن طابقت المُدخل.
    if (k === "countdown" && typeof o[k] === "boolean") {
      (out as Record<string, unknown>)[k] = full[k];
    } else if (full[k] === o[k]) {
      (out as Record<string, unknown>)[k] = full[k];
    }
  }
  return out;
}

export function effectiveWidgetOptions(base: WidgetOptions, ov?: WidgetOverrides): WidgetOptions {
  return ov ? { ...base, ...ov } : base;
}

export function readInstanceConfigs(): WidgetInstanceConfigs {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(WIDGET_INSTANCES_KEY) ?? "{}");
    const out: WidgetInstanceConfigs = {};
    if (raw && typeof raw === "object") {
      for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
        if (!/^\d+$/.test(id)) continue;
        const ov = normalizeWidgetOverrides(v);
        if (Object.keys(ov).length > 0) out[id] = ov;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function writeInstanceConfigs(next: WidgetInstanceConfigs) {
  try {
    window.localStorage.setItem(WIDGET_INSTANCES_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(WIDGET_SETTINGS_EVENT));
  } catch {
    /* ignore quota */
  }
}

/** يحذف إعدادات نسخ لم تعد على الشاشة. */
export function pruneInstanceConfigs(liveIds: readonly number[]) {
  const cur = readInstanceConfigs();
  const live = new Set(liveIds.map(String));
  const next: WidgetInstanceConfigs = {};
  let changed = false;
  for (const [id, v] of Object.entries(cur)) {
    if (live.has(id)) next[id] = v;
    else changed = true;
  }
  if (changed) writeInstanceConfigs(next);
}

export function useInstanceConfig(id: number | null) {
  const [overrides, setOverrides] = useState<WidgetOverrides>({});
  useEffect(() => {
    if (id == null) return;
    const sync = () => setOverrides(readInstanceConfigs()[String(id)] ?? {});
    sync();
    window.addEventListener(WIDGET_SETTINGS_EVENT, sync);
    return () => window.removeEventListener(WIDGET_SETTINGS_EVENT, sync);
  }, [id]);
  const update = useCallback(
    (patch: WidgetOverrides) => {
      if (id == null) return;
      const all = readInstanceConfigs();
      all[String(id)] = normalizeWidgetOverrides({ ...all[String(id)], ...patch });
      writeInstanceConfigs(all);
    },
    [id],
  );
  const reset = useCallback(() => {
    if (id == null) return;
    const all = readInstanceConfigs();
    delete all[String(id)];
    writeInstanceConfigs(all);
  }, [id]);
  return { overrides, update, reset };
}

export function useWidgetOptions() {
  const [options, setOptions] = useState<WidgetOptions>(DEFAULT_WIDGET_OPTIONS);

  useEffect(() => {
    const sync = () => setOptions(readWidgetOptions());
    sync();
    window.addEventListener(WIDGET_SETTINGS_EVENT, sync);
    return () => window.removeEventListener(WIDGET_SETTINGS_EVENT, sync);
  }, []);

  const update = useCallback((patch: Partial<WidgetOptions>) => {
    writeWidgetOptions({ ...readWidgetOptions(), ...patch });
  }, []);

  const reset = useCallback(() => writeWidgetOptions(DEFAULT_WIDGET_OPTIONS), []);

  return { options, update, reset };
}

export function requestWidgetRefresh() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(WIDGET_REFRESH_EVENT));
}
