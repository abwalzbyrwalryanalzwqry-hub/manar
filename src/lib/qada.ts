/* منار — عدّاد القضاء (اختياري، مطفأ افتراضياً).
 *
 * عدد بسيط لكل صلاة من الخمس يُضاف ويُنقص يدوياً، مع مجموع ما قُضي. لا
 * يُحسب تلقائياً من السجل، لأن ما فات قبل استعمال التطبيق لا يعرفه إلا صاحبه.
 */

import { useCallback, useEffect, useState } from "react";
import { FARD_PRAYERS } from "./activity-log";
import type { PrayerKey } from "./prayer";

export const QADA_KEY = "manar.qada.v1";
export const QADA_EVENT = "manar:qada";
export const QADA_MAX = 99_999;

export type FardKey = Exclude<PrayerKey, "sunrise">;

export type QadaStore = {
  enabled: boolean;
  /** المتبقي لكل صلاة. */
  remaining: Record<FardKey, number>;
  /** مجموع ما قُضي منذ التفعيل. */
  madeUp: number;
  /** أيام صيام متبقية للقضاء (مواسم منار، ٤.٥). */
  fasts: number;
  /** مجموع أيام الصيام المقضية. */
  fastsMadeUp: number;
};

const ZERO = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 } as Record<FardKey, number>;
export const DEFAULT_QADA: QadaStore = {
  enabled: false,
  remaining: ZERO,
  madeUp: 0,
  fasts: 0,
  fastsMadeUp: 0,
};

const clampN = (v: unknown) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(QADA_MAX, n)) : 0;
};

export function normalizeQada(raw: unknown): QadaStore {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<QadaStore>;
  const rem = { ...ZERO };
  for (const p of FARD_PRAYERS as FardKey[]) rem[p] = clampN(r.remaining?.[p]);
  return {
    enabled: r.enabled === true,
    remaining: rem,
    madeUp: clampN(r.madeUp),
    fasts: clampN(r.fasts),
    fastsMadeUp: clampN(r.fastsMadeUp),
  };
}

/** يضيف يوم صيام فائت (+١) أو يصحّح العدّ (−١) بلا احتساب قضاء. */
export function adjustQadaFasts(s: QadaStore, delta: number): QadaStore {
  return { ...s, fasts: clampN(s.fasts + delta) };
}

/** «قضيت يوماً»: ينقص المتبقي ويزيد المقضي. لا شيء إن كان صفراً. */
export function makeUpFast(s: QadaStore): QadaStore {
  if (s.fasts <= 0) return s;
  return { ...s, fasts: s.fasts - 1, fastsMadeUp: clampN(s.fastsMadeUp + 1) };
}

/** تراجع عن «قضيت يوماً» (إلغاء تسجيله في خطة الموسم). */
export function undoMakeUpFast(s: QadaStore): QadaStore {
  if (s.fastsMadeUp <= 0) return s;
  return { ...s, fasts: clampN(s.fasts + 1), fastsMadeUp: s.fastsMadeUp - 1 };
}

export function qadaTotal(s: QadaStore): number {
  return (FARD_PRAYERS as FardKey[]).reduce((n, p) => n + s.remaining[p], 0);
}

/** يضيف فائتة (+١) أو يُنقصها خطأً (−١) بلا احتساب قضاء. */
export function adjustQada(s: QadaStore, p: FardKey, delta: number): QadaStore {
  return { ...s, remaining: { ...s.remaining, [p]: clampN(s.remaining[p] + delta) } };
}

/** «قضيت واحدة»: ينقص المتبقي ويزيد مجموع المقضي. لا شيء إن كان صفراً. */
export function makeUpQada(s: QadaStore, p: FardKey): QadaStore {
  if (s.remaining[p] <= 0) return s;
  return { ...adjustQada(s, p, -1), madeUp: clampN(s.madeUp + 1) };
}

export function readQada(): QadaStore {
  if (typeof window === "undefined") return DEFAULT_QADA;
  try {
    const raw = window.localStorage.getItem(QADA_KEY);
    return raw ? normalizeQada(JSON.parse(raw)) : DEFAULT_QADA;
  } catch {
    return DEFAULT_QADA;
  }
}

export function writeQada(s: QadaStore) {
  try {
    window.localStorage.setItem(QADA_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(QADA_EVENT));
}

export function useQada() {
  const [store, setStore] = useState<QadaStore>(DEFAULT_QADA);
  useEffect(() => {
    const sync = () => setStore(readQada());
    sync();
    window.addEventListener(QADA_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(QADA_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const commit = useCallback((fn: (s: QadaStore) => QadaStore) => writeQada(fn(readQada())), []);
  return { store, commit };
}
