/* منار — تفضيلات العرض: المظهر وحجم الخط.
 *
 * تُطبَّق على `<html>` مباشرة (الصنف `dark` ومتغيّر `--manar-font-scale`) حتى
 * تسري على كل الشاشات بلا استثناء، ويُكتب أول تطبيق قبل أول رسم فلا يومض
 * التطبيق بالمظهر الخاطئ عند الإقلاع.
 */

import { useCallback, useEffect, useState } from "react";

const KEY = "manar.appearance.v1";
const EVENT = "manar:appearance";

export type ThemeMode = "light" | "dark" | "system";
export type FontScale = "small" | "medium" | "large" | "xlarge";

export type Appearance = {
  theme: ThemeMode;
  fontScale: FontScale;
};

export const DEFAULT_APPEARANCE: Appearance = { theme: "system", fontScale: "medium" };

export const THEME_LABELS: Record<ThemeMode, string> = {
  light: "فاتح",
  dark: "داكن",
  system: "تلقائي",
};

export const FONT_SCALE_LABELS: Record<FontScale, string> = {
  small: "صغير",
  medium: "متوسط",
  large: "كبير",
  xlarge: "كبير جداً",
};

const FONT_SCALE_VALUES: Record<FontScale, number> = {
  small: 0.9,
  medium: 1,
  large: 1.12,
  xlarge: 1.25,
};

export function readAppearance(): Appearance {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const p = JSON.parse(raw) as Partial<Appearance>;
    return {
      theme:
        p.theme === "light" || p.theme === "dark" || p.theme === "system"
          ? p.theme
          : DEFAULT_APPEARANCE.theme,
      fontScale:
        p.fontScale && p.fontScale in FONT_SCALE_VALUES
          ? p.fontScale
          : DEFAULT_APPEARANCE.fontScale,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** هل المظهر الفعلي داكن، بعد حلّ الوضع التلقائي مقابل تفضيل النظام؟ */
export function resolveDark(theme: ThemeMode): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function applyAppearance(a: Appearance) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolveDark(a.theme));
  root.style.setProperty("--manar-font-scale", String(FONT_SCALE_VALUES[a.fontScale]));
  /* شريط حالة النظام على أندرويد يقرأ هذا الوسم. */
  root.style.colorScheme = resolveDark(a.theme) ? "dark" : "light";
}

export function writeAppearance(next: Appearance) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  applyAppearance(next);
  window.dispatchEvent(new Event(EVENT));
}

export function useAppearance() {
  const [appearance, setState] = useState<Appearance>(DEFAULT_APPEARANCE);

  useEffect(() => {
    const sync = () => {
      const next = readAppearance();
      setState(next);
      applyAppearance(next);
    };
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);

    /* الوضع التلقائي يتبع تفضيل النظام، فيجب أن يستجيب لتغيّره أثناء التشغيل. */
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onScheme = () => {
      if (readAppearance().theme === "system") applyAppearance(readAppearance());
    };
    mq?.addEventListener("change", onScheme);

    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
      mq?.removeEventListener("change", onScheme);
    };
  }, []);

  const setTheme = useCallback(
    (theme: ThemeMode) => writeAppearance({ ...readAppearance(), theme }),
    [],
  );
  const setFontScale = useCallback(
    (fontScale: FontScale) => writeAppearance({ ...readAppearance(), fontScale }),
    [],
  );

  return {
    appearance,
    isDark: resolveDark(appearance.theme),
    setTheme,
    setFontScale,
  };
}
