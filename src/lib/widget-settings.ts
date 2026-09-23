/* منار — إعدادات ويدجت الشاشة الرئيسية (أندرويد).
 *
 * ما يظهر في الويدجت ولونه. تُحفظ محلياً، وتُرسَل مع لقطة الويدجت
 * (`widget-snapshot.ts`) فتطبّقها الطبقة الأصلية (`ManarWidget.java`) عند الرسم.
 */

import { useCallback, useEffect, useState } from "react";

export const WIDGET_SETTINGS_KEY = "manar.widget.v1";
export const WIDGET_SETTINGS_EVENT = "manar:widget-settings";
/** طلب «تحديث الويدجت الآن» — تستمع له `WidgetSync`. */
export const WIDGET_REFRESH_EVENT = "manar:widget-refresh";

export type WidgetTheme = "night" | "emerald";

export interface WidgetOptions {
  /** آية اليوم أسفل الويدجت. */
  verse: boolean;
  /** العدّ التنازلي للصلاة القادمة. */
  countdown: boolean;
  /** سطر التاريخ الهجري أعلى الويدجت. */
  hijri: boolean;
  /** اسم المدينة بجانب التاريخ. */
  city: boolean;
  theme: WidgetTheme;
}

export const DEFAULT_WIDGET_OPTIONS: WidgetOptions = {
  verse: true,
  countdown: true,
  hijri: true,
  city: true,
  theme: "night",
};

export const WIDGET_THEME_LABELS: Record<WidgetTheme, string> = {
  night: "ليلي",
  emerald: "زمردي",
};

export function normalizeWidgetOptions(raw: unknown): WidgetOptions {
  const o = raw && typeof raw === "object" ? (raw as Partial<WidgetOptions>) : {};
  const bool = (v: unknown, fb: boolean) => (typeof v === "boolean" ? v : fb);
  return {
    verse: bool(o.verse, DEFAULT_WIDGET_OPTIONS.verse),
    countdown: bool(o.countdown, DEFAULT_WIDGET_OPTIONS.countdown),
    hijri: bool(o.hijri, DEFAULT_WIDGET_OPTIONS.hijri),
    city: bool(o.city, DEFAULT_WIDGET_OPTIONS.city),
    theme: o.theme === "emerald" ? "emerald" : "night",
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
