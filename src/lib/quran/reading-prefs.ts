// ============================================================
// Manar — Quran Module
// Phase 8.6.1 — Reading preferences (persisted locally)
// ============================================================

import { useCallback, useEffect, useState } from "react";

const KEY = "manar.quran.reading-prefs.v1";
const EVENT = "manar:reading-prefs";

export type FontSizeKey = "sm" | "md" | "lg" | "xl";
export type LineHeightKey = "compact" | "normal" | "relaxed";
export type WidthKey = "narrow" | "normal" | "wide";
export type QuranFontKey = "amiri" | "scheherazade" | "naskh";

export interface ReadingPrefs {
  fontSize: FontSizeKey;
  lineHeight: LineHeightKey;
  width: WidthKey;
  font: QuranFontKey;
}

export const DEFAULT_PREFS: ReadingPrefs = {
  fontSize: "md",
  lineHeight: "normal",
  width: "normal",
  font: "amiri",
};

export const FONT_SIZE_OPTIONS: { key: FontSizeKey; label: string; px: number }[] = [
  { key: "sm", label: "صغير", px: 22 },
  { key: "md", label: "متوسط", px: 26 },
  { key: "lg", label: "كبير", px: 31 },
  { key: "xl", label: "كبير جدًا", px: 37 },
];

export const LINE_HEIGHT_OPTIONS: {
  key: LineHeightKey;
  label: string;
  value: number;
}[] = [
  { key: "compact", label: "متقارب", value: 2.05 },
  { key: "normal", label: "مريح", value: 2.45 },
  { key: "relaxed", label: "واسع", value: 2.9 },
];

export const WIDTH_OPTIONS: { key: WidthKey; label: string; ch: string }[] = [
  { key: "narrow", label: "ضيّق", ch: "26rem" },
  { key: "normal", label: "معتاد", ch: "32rem" },
  { key: "wide", label: "عريض", ch: "100%" },
];

export const QURAN_FONT_OPTIONS: {
  key: QuranFontKey;
  label: string;
  stack: string;
}[] = [
  { key: "amiri", label: "أميري قرآن", stack: '"Amiri Quran", "Scheherazade New", serif' },
  {
    key: "scheherazade",
    label: "شهرزاد",
    stack: '"Scheherazade New", "Amiri Quran", serif',
  },
  {
    key: "naskh",
    label: "نسخ",
    stack: '"Noto Naskh Arabic", "Scheherazade New", serif',
  },
];

/** Resolved CSS values for the current preferences. */
export interface ResolvedReadingStyle {
  fontSizePx: number;
  lineHeight: number;
  maxWidth: string;
  fontFamily: string;
}

export function resolveReadingStyle(p: ReadingPrefs): ResolvedReadingStyle {
  const size = FONT_SIZE_OPTIONS.find((o) => o.key === p.fontSize) ?? FONT_SIZE_OPTIONS[1];
  const lh =
    LINE_HEIGHT_OPTIONS.find((o) => o.key === p.lineHeight) ?? LINE_HEIGHT_OPTIONS[1];
  const w = WIDTH_OPTIONS.find((o) => o.key === p.width) ?? WIDTH_OPTIONS[1];
  const f = QURAN_FONT_OPTIONS.find((o) => o.key === p.font) ?? QURAN_FONT_OPTIONS[0];
  return {
    fontSizePx: size.px,
    lineHeight: lh.value,
    maxWidth: w.ch,
    fontFamily: f.stack,
  };
}

function read(): ReadingPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<ReadingPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Reactive, cross-component reading preferences. */
export function useReadingPrefs() {
  const [prefs, setPrefs] = useState<ReadingPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(read());
    const sync = () => setPrefs(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<ReadingPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
        window.dispatchEvent(new Event(EVENT));
      } catch {
        /* ignore quota / privacy errors */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(KEY);
      window.dispatchEvent(new Event(EVENT));
    } catch {
      /* ignore */
    }
    setPrefs(DEFAULT_PREFS);
  }, []);

  return { prefs, update, reset, style: resolveReadingStyle(prefs) } as const;
}
