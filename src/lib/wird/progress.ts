// ============================================================
// Manar — Wird Module: تقدّم مستقل تمامًا عن عدّاد الأذكار
// تخزين محلي (offline) بمفتاح خاص بالوِرد فقط
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { WirdSessionKey } from "./data";

const KEY = "manar.wird.progress.v1";
const EVENT = "manar:wird-progress";

export interface WirdSessionProgress {
  /** ترتيب الذكر → العدد الحالي */
  counts: Record<number, number>;
  /** الذكر النشط حاليًا (ترتيبه) */
  current: number;
  /** هل تم إكمال الوِرد بالكامل */
  done: boolean;
  updatedAt: number | null;
}

export type WirdStore = Record<WirdSessionKey, WirdSessionProgress>;

const emptySession = (): WirdSessionProgress => ({ counts: {}, current: 1, done: false, updatedAt: null });

const EMPTY: WirdStore = { morning: emptySession(), evening: emptySession() };

function readStore(): WirdStore {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<WirdStore>;
    return {
      morning: { ...emptySession(), ...(parsed.morning ?? {}) },
      evening: { ...emptySession(), ...(parsed.evening ?? {}) },
    };
  } catch {
    return EMPTY;
  }
}

function writeStore(store: WirdStore) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

/** قراءة تقدّم الوِردين (للبطاقات في الصفحة الرئيسية للوِرد). */
export function useWirdOverview() {
  const [store, setStore] = useState<WirdStore>(EMPTY);
  useEffect(() => {
    const sync = () => setStore(readStore());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return store;
}

/**
 * جلسة وِرد واحدة — عدّاد سريع:
 * الحالة تُحدّث فورًا في الذاكرة، والكتابة إلى التخزين مُجمّعة (debounce)
 * لتجنّب أي تقطيع عند الأعداد الكبيرة مثل ١٠٠.
 */
export function useWirdSessionProgress(session: WirdSessionKey) {
  const [state, setState] = useState<WirdSessionProgress>(emptySession);
  const [hydrated, setHydrated] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setState(readStore()[session]);
    setHydrated(true);
  }, [session]);

  const flush = useCallback(
    (next: WirdSessionProgress) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const store = readStore();
        writeStore({ ...store, [session]: next });
      }, 180);
    },
    [session],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const commit = useCallback(
    (fn: (prev: WirdSessionProgress) => WirdSessionProgress) => {
      setState((prev) => {
        const next = { ...fn(prev), updatedAt: Date.now() };
        flush(next);
        return next;
      });
    },
    [flush],
  );

  /** زيادة عدّاد ذكر بمقدار ١ (مع سقف العدد المطلوب). */
  const increment = useCallback(
    (order: number, repeat: number) =>
      commit((p) => {
        const n = Math.min(repeat, (p.counts[order] ?? 0) + 1);
        return { ...p, counts: { ...p.counts, [order]: n } };
      }),
    [commit],
  );

  const setCurrent = useCallback(
    (order: number) => commit((p) => (p.current === order ? p : { ...p, current: order })),
    [commit],
  );

  const markDone = useCallback((done: boolean) => commit((p) => ({ ...p, done })), [commit]);

  const resetSession = useCallback(() => commit(() => ({ ...emptySession(), current: 1 })), [commit]);

  const resetItem = useCallback(
    (order: number) => commit((p) => ({ ...p, counts: { ...p.counts, [order]: 0 }, done: false })),
    [commit],
  );

  return { progress: state, hydrated, increment, setCurrent, markDone, resetSession, resetItem };
}

/** نسبة إنجاز الوِرد (٠..١) بالنسبة لمجموع التكرارات المطلوبة. */
export function wirdCompletion(p: WirdSessionProgress, items: { order: number; repeat: number }[]) {
  const total = items.reduce((s, it) => s + it.repeat, 0);
  const done = items.reduce((s, it) => s + Math.min(it.repeat, p.counts[it.order] ?? 0), 0);
  const completedItems = items.filter((it) => (p.counts[it.order] ?? 0) >= it.repeat).length;
  return { total, done, ratio: total ? done / total : 0, completedItems };
}
