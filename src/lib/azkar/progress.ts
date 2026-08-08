// ============================================================
// Manar — Azkar Module
// Local progress: counters, completed azkar, bookmarks, last read
// ============================================================

import { useCallback, useEffect, useState } from "react";

const KEY = "manar.azkar.progress.v1";
const EVENT = "manar:azkar-progress";

export interface AzkarProgress {
  /** zikr id → current tap count */
  counters: Record<number, number>;
  /** completed zikr ids for today */
  completed: number[];
  /** bookmarked zikr ids */
  bookmarks: number[];
  /** last opened chapter + zikr */
  last: { chapter: number; zikr: number; at: number } | null;
  /** YYYY-MM-DD of the counters/completed day */
  day: string;
}

const EMPTY: AzkarProgress = { counters: {}, completed: [], bookmarks: [], last: null, day: today() };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function read(): AzkarProgress {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const p = { ...EMPTY, ...(JSON.parse(raw) as Partial<AzkarProgress>) };
    // Daily reset of counters + completion, bookmarks persist.
    if (p.day !== today()) return { ...p, counters: {}, completed: [], day: today() };
    return p;
  } catch {
    return EMPTY;
  }
}

function write(p: AzkarProgress) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

export function useAzkarProgress() {
  const [state, setState] = useState<AzkarProgress>(EMPTY);

  useEffect(() => {
    const sync = () => setState(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const patch = useCallback((fn: (prev: AzkarProgress) => AzkarProgress) => {
    setState((prev) => {
      const next = fn(prev);
      write(next);
      return next;
    });
  }, []);

  const tap = useCallback(
    (zikrId: number, repeat: number) =>
      patch((p) => {
        const n = Math.min(repeat, (p.counters[zikrId] ?? 0) + 1);
        const completed = n >= repeat && !p.completed.includes(zikrId) ? [...p.completed, zikrId] : p.completed;
        return { ...p, counters: { ...p.counters, [zikrId]: n }, completed, day: today() };
      }),
    [patch],
  );

  const resetZikr = useCallback(
    (zikrId: number) =>
      patch((p) => ({
        ...p,
        counters: { ...p.counters, [zikrId]: 0 },
        completed: p.completed.filter((id) => id !== zikrId),
      })),
    [patch],
  );

  const toggleBookmark = useCallback(
    (zikrId: number) =>
      patch((p) => ({
        ...p,
        bookmarks: p.bookmarks.includes(zikrId)
          ? p.bookmarks.filter((id) => id !== zikrId)
          : [...p.bookmarks, zikrId],
      })),
    [patch],
  );

  /** Reset a set of azkar (one chapter) without touching others. */
  const resetMany = useCallback(
    (zikrIds: number[]) =>
      patch((p) => {
        const counters = { ...p.counters };
        for (const id of zikrIds) counters[id] = 0;
        return {
          ...p,
          counters,
          completed: p.completed.filter((id) => !zikrIds.includes(id)),
        };
      }),
    [patch],
  );

  const setLast = useCallback(
    (chapter: number, zikr: number) =>
      patch((p) => ({ ...p, last: { chapter, zikr, at: Date.now() } })),
    [patch],
  );

  return { progress: state, tap, resetZikr, resetMany, toggleBookmark, setLast };
}
