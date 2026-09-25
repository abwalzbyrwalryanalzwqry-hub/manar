// ============================================================
// Manar — Azkar Module
// Local progress: counters, completed azkar, bookmarks, last read
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useDayKey } from "@/hooks/use-day-key";
import { dayKey, recordAzkarCount, syncAzkarChapters } from "@/lib/activity-log";
import { azkarRepository } from "./repository";
import type { AzkarBook } from "./types";
import { azkarForTime, hasTimeVariants, progressKey } from "./variant";

const KEY = "manar.azkar.progress.v1";
const EVENT = "manar:azkar-progress";

export interface AzkarProgress {
  /** مفتاح العدّاد (`progressKey`: «id» أو «id:e» للمساء) → العدد الحالي */
  counters: Record<string, number>;
  /** مفاتيح الأذكار المكتملة اليوم */
  completed: string[];
  /** bookmarked zikr ids */
  bookmarks: number[];
  /** last opened chapter + zikr */
  last: { chapter: number; zikr: number; at: number } | null;
  /** YYYY-MM-DD of the counters/completed day */
  day: string;
  /** timestamp of the last saved change */
  updatedAt: number | null;
}

const empty = (day = today()): AzkarProgress => ({
  counters: {},
  completed: [],
  bookmarks: [],
  last: null,
  day,
  updatedAt: null,
});

/* اليوم بالتوقيت المحلي. كان `toISOString` (UTC) فيتأخّر اليوم عن اليمن
 * ثلاث ساعات: ما يُقرأ بين ١٢ و٣ فجراً يُحسب لليوم السابق ويُصفَّر متأخراً. */
function today(): string {
  return dayKey();
}

/**
 * مفاتيح الفصول المكتملة لسجل اليوم. الفصل العادي برقمه، وباب الصباح والمساء
 * بمفتاحين مستقلين «27:m» و«27:e» لأن لكلٍّ منهما أذكاره وعدّاده.
 */
export function completedChapterKeys(
  book: Pick<AzkarBook, "chapters">,
  completed: readonly string[],
): string[] {
  const done = new Set(completed);
  const out: string[] = [];
  for (const c of book.chapters) {
    if (!c.azkar.length) continue;
    if (hasTimeVariants(c)) {
      for (const [time, tag] of [
        ["morning", "m"],
        ["evening", "e"],
      ] as const) {
        const list = azkarForTime(c, time);
        if (list.every((z) => done.has(progressKey(z.id, time)))) out.push(`${c.id}:${tag}`);
      }
    } else if (c.azkar.every((z) => done.has(String(z.id)))) {
      out.push(String(c.id));
    }
  }
  return out;
}

/** يصفّر العدّادات إن تغيّر اليوم؛ المحفوظات وآخر موضع تبقى. */
export function rollDay(p: AzkarProgress, day = today()): AzkarProgress {
  return p.day === day ? p : { ...p, counters: {}, completed: [], day };
}

/** يقرأ الحالة المحفوظة ويصحّح أنواعها (النسخ القديمة خزّنت المكتمل أرقامًا). */
export function normalizeProgress(raw: unknown, day = today()): AzkarProgress {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<AzkarProgress>;
  const counters: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.counters ?? {})) {
    if (/^\d+(:e)?$/.test(k) && typeof v === "number" && v > 0) counters[k] = Math.trunc(v);
  }
  const p: AzkarProgress = {
    ...empty(day),
    counters,
    completed: Array.isArray(r.completed) ? [...new Set(r.completed.map(String))] : [],
    bookmarks: Array.isArray(r.bookmarks) ? r.bookmarks.filter((n) => typeof n === "number") : [],
    last: r.last ?? null,
    day: typeof r.day === "string" ? r.day : day,
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : null,
  };
  return rollDay(p, day);
}

/** عدّة ضغطة على ذكر (دالة نقية). */
export function applyTap(p: AzkarProgress, key: string, repeat: number): AzkarProgress {
  const n = Math.min(repeat, (p.counters[key] ?? 0) + 1);
  const completed = n >= repeat && !p.completed.includes(key) ? [...p.completed, key] : p.completed;
  return { ...p, counters: { ...p.counters, [key]: n }, completed };
}

/** تصفير مجموعة مفاتيح (دالة نقية). */
export function applyReset(p: AzkarProgress, keys: readonly string[]): AzkarProgress {
  const counters = { ...p.counters };
  for (const k of keys) delete counters[k];
  const drop = new Set(keys);
  return { ...p, counters, completed: p.completed.filter((k) => !drop.has(k)) };
}

function read(): AzkarProgress {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? normalizeProgress(JSON.parse(raw)) : empty();
  } catch {
    return empty();
  }
}

function write(p: AzkarProgress) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
    /* السجل اليومي الموحّد يحتاج التاريخ، وهذه الوحدة تحفظ اليوم فقط. */
    if (p.day === today()) {
      recordAzkarCount(p.completed.length);
      const book = azkarRepository.getCached();
      if (book) syncAzkarChapters(completedChapterKeys(book, p.completed));
    }
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

export function useAzkarProgress() {
  const [state, setState] = useState<AzkarProgress>(() => empty());
  /* أحدث حالة خارج React: التحديث يُحسب منها ثم يُكتب مرة واحدة، فلا تُنفَّذ
   * الكتابة داخل دالة setState (تُستدعى مرتين في StrictMode). */
  const ref = useRef(state);
  const day = useDayKey();

  useEffect(() => {
    const sync = () => {
      ref.current = read();
      setState(ref.current);
    };
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [day]);

  const patch = useCallback((fn: (prev: AzkarProgress) => AzkarProgress, touch = true) => {
    const prev = rollDay(ref.current);
    const changed = fn(prev);
    if (changed === prev && prev === ref.current) return;
    const next = touch ? { ...changed, updatedAt: Date.now() } : changed;
    ref.current = next;
    setState(next);
    write(next);
  }, []);

  /** `key` من `progressKey(id, time)`. */
  const tap = useCallback(
    (key: string, repeat: number) => patch((p) => applyTap(p, key, repeat)),
    [patch],
  );

  const resetZikr = useCallback((key: string) => patch((p) => applyReset(p, [key])), [patch]);

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
  const resetMany = useCallback((keys: string[]) => patch((p) => applyReset(p, keys)), [patch]);

  /** Records the last opened zikr without touching the "progress saved" timestamp. */
  const setLast = useCallback(
    (chapter: number, zikr: number) =>
      patch(
        (p) =>
          p.last?.chapter === chapter && p.last?.zikr === zikr
            ? p
            : { ...p, last: { chapter, zikr, at: Date.now() } },
        false,
      ),
    [patch],
  );

  return { progress: state, tap, resetZikr, resetMany, toggleBookmark, setLast };
}
