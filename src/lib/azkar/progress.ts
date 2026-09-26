// ============================================================
// Manar — Azkar Module
// Local progress: counters, completed azkar, bookmarks, last read
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useDayKey, useOnLeave } from "@/hooks/use-day-key";
import { dayKey, recordAzkarCount, syncAzkarChapters } from "@/lib/activity-log";
import { uniqueCompletedCount } from "./hub";
import { normalizeBookmarkLog, pruneBookmarkLog, type BookmarkLog } from "./merge";
import { azkarRepository } from "./repository";
import type { AzkarBook, ZikrTime } from "./types";
import { azkarForTime, hasTimeVariants, progressKey } from "./variant";

const KEY = "manar.azkar.progress.v1";
const EVENT = "manar:azkar-progress";
/**
 * مهلة تجميع الكتابة أثناء العدّ السريع. الحالة تتحدّث في الذاكرة فورًا، أما
 * التخزين والسجل اليومي (قراءة وكتابة JSON كبير) فمرة واحدة بعد توقّف النقر.
 */
export const WRITE_DELAY_MS = 220;

export interface AzkarProgress {
  /** مفتاح العدّاد (`progressKey`: «id» أو «id:e» للمساء) → العدد الحالي */
  counters: Record<string, number>;
  /** مفاتيح الأذكار المكتملة اليوم */
  completed: string[];
  /** bookmarked zikr ids */
  bookmarks: number[];
  /** آخر فعل لكل ذكر (حفظ/حذف) ووقته — ليُدمج الحفظ والحذف بين الأجهزة
   * ذكرًا ذكرًا بدل أن تمسح نسخةٌ نسخة (انظر azkar/merge). */
  bookmarkLog: BookmarkLog;
  /** آخر ذكر فُتح: الباب والذكر، ووقت الأذكار إن كان للباب صباح ومساء */
  last: { chapter: number; zikr: number; at: number; time?: ZikrTime } | null;
  /** YYYY-MM-DD of the counters/completed day */
  day: string;
  /** timestamp of the last saved change */
  updatedAt: number | null;
}

const empty = (day = today()): AzkarProgress => ({
  counters: {},
  completed: [],
  bookmarks: [],
  bookmarkLog: {},
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
    bookmarkLog: normalizeBookmarkLog(r.bookmarkLog),
    last: normalizeLast(r.last),
    day: typeof r.day === "string" ? r.day : day,
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : null,
  };
  return rollDay(p, day);
}

function normalizeLast(raw: unknown): AzkarProgress["last"] {
  const l = raw as Partial<NonNullable<AzkarProgress["last"]>> | null | undefined;
  if (!l || typeof l.chapter !== "number" || typeof l.zikr !== "number") return null;
  return {
    chapter: l.chapter,
    zikr: l.zikr,
    at: typeof l.at === "number" ? l.at : 0,
    ...(l.time === "morning" || l.time === "evening" ? { time: l.time } : {}),
  };
}

/** عدّة ضغطة على ذكر (دالة نقية). */
export function applyTap(p: AzkarProgress, key: string, repeat: number): AzkarProgress {
  const n = Math.min(repeat, (p.counters[key] ?? 0) + 1);
  const completed = n >= repeat && !p.completed.includes(key) ? [...p.completed, key] : p.completed;
  return { ...p, counters: { ...p.counters, [key]: n }, completed };
}

/** تراجع عن آخر عدّة (دالة نقية): ينقص العدّاد واحدًا ويُخرج الذكر من المكتمل. */
export function applyUndo(p: AzkarProgress, key: string): AzkarProgress {
  const now = p.counters[key] ?? 0;
  if (now <= 0) return p;
  const counters = { ...p.counters };
  if (now === 1) delete counters[key];
  else counters[key] = now - 1;
  return { ...p, counters, completed: p.completed.filter((k) => k !== key) };
}

export interface CompleteEntry {
  key: string;
  repeat: number;
}

/**
 * يعلّم أذكارًا مكتملة (دالة نقية) — يستعمله الوِرد ليُحتسب إتمامه في أذكار
 * الصباح والمساء. لا ينقص عدّادًا أعلى، ويعيد الحالة نفسها إن لم يتغيّر شيء.
 */
export function applyComplete(p: AzkarProgress, entries: readonly CompleteEntry[]): AzkarProgress {
  let counters = p.counters;
  let completed = p.completed;
  for (const { key, repeat } of entries) {
    if (!/^\d+(:e)?$/.test(key) || !(repeat > 0)) continue;
    if ((counters[key] ?? 0) < repeat) {
      if (counters === p.counters) counters = { ...counters };
      counters[key] = repeat;
    }
    if (!completed.includes(key)) {
      if (completed === p.completed) completed = [...completed];
      completed.push(key);
    }
  }
  return counters === p.counters && completed === p.completed ? p : { ...p, counters, completed };
}

/** تصفير مجموعة مفاتيح (دالة نقية). */
export function applyReset(p: AzkarProgress, keys: readonly string[]): AzkarProgress {
  const counters = { ...p.counters };
  for (const k of keys) delete counters[k];
  const drop = new Set(keys);
  return { ...p, counters, completed: p.completed.filter((k) => !drop.has(k)) };
}

/** حفظ الذكر أو حذفه من المحفوظات، مع تسجيل الفعل ووقته للمزامنة. */
export function applyToggleBookmark(
  p: AzkarProgress,
  zikrId: number,
  now = Date.now(),
): AzkarProgress {
  const on = !p.bookmarks.includes(zikrId);
  return {
    ...p,
    bookmarks: on ? [...p.bookmarks, zikrId] : p.bookmarks.filter((id) => id !== zikrId),
    bookmarkLog: pruneBookmarkLog({ ...p.bookmarkLog, [String(zikrId)]: { on, at: now } }),
  };
}

/** مفاتيح الأذكار المكتملة اليوم (بعد تنفيذ أي كتابة معلّقة). */
export function readAzkarCompleted(): ReadonlySet<string> {
  if (typeof window === "undefined") return new Set();
  flushAll();
  return new Set(read().completed);
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

/** آخر نص كتبته هذه الوحدة — لتتجاهل الشاشةُ حدثَ كتابتها هي فلا تعيد القراءة. */
let lastWritten: string | null = null;

/** كتابات معلّقة لكل خطاف مركّب؛ `markAzkarComplete` ينفّذها قبل أن يقرأ. */
const flushers = new Set<() => void>();
function flushAll() {
  for (const f of flushers) f();
}

function write(p: AzkarProgress, log = true) {
  try {
    const raw = JSON.stringify(p);
    lastWritten = raw;
    window.localStorage.setItem(KEY, raw);
    /* السجل اليومي الموحّد يحتاج التاريخ، وهذه الوحدة تحفظ اليوم فقط.
     * التصفّح وحده (`setLast`) لا يمسّ السجل. */
    if (log && p.day === today()) {
      /* بلا تكرار، كما في الصفحة الرئيسية: «76» صباحًا و«76:e» مساءً ذكر واحد. */
      recordAzkarCount(uniqueCompletedCount(p.completed));
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
  /** كتابة معلّقة: الحالة، وهل تُسجَّل في السجل اليومي. */
  const pending = useRef<{ p: AzkarProgress; log: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const job = pending.current;
    pending.current = null;
    if (job) write(job.p, job.log);
  }, []);

  /* تُنفَّذ الكتابة المعلّقة عند المغادرة أو إرسال التطبيق للخلفية أو فكّ التركيب. */
  useOnLeave(flushNow);
  useEffect(() => {
    flushers.add(flushNow);
    return () => {
      flushers.delete(flushNow);
      flushNow();
    };
  }, [flushNow]);

  useEffect(() => {
    const sync = () => {
      /* تغييراتنا غير المكتوبة أحدث من التخزين؛ وحدثُ كتابتنا لا جديد فيه. */
      if (pending.current) return;
      let raw: string | null = null;
      try {
        raw = window.localStorage.getItem(KEY);
      } catch {
        /* ignore */
      }
      if (raw != null && raw === lastWritten && ref.current.updatedAt != null) {
        const same = JSON.stringify(ref.current) === raw;
        if (same) return;
      }
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

  const patch = useCallback(
    (fn: (prev: AzkarProgress) => AzkarProgress, touch = true) => {
      const prev = rollDay(ref.current);
      const changed = fn(prev);
      if (changed === prev && prev === ref.current) return;
      const next = touch ? { ...changed, updatedAt: Date.now() } : changed;
      ref.current = next;
      setState(next);
      /* تُجمَّع الكتابة: ضغطات متتالية سريعة = كتابة واحدة بعد التوقف. */
      pending.current = { p: next, log: touch || (pending.current?.log ?? false) };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flushNow, WRITE_DELAY_MS);
    },
    [flushNow],
  );

  /** `key` من `progressKey(id, time)`. */
  const tap = useCallback(
    (key: string, repeat: number) => patch((p) => applyTap(p, key, repeat)),
    [patch],
  );

  const resetZikr = useCallback((key: string) => patch((p) => applyReset(p, [key])), [patch]);

  /** تراجع عن آخر عدّة في ذكر. */
  const undo = useCallback((key: string) => patch((p) => applyUndo(p, key)), [patch]);

  const toggleBookmark = useCallback(
    (zikrId: number) => patch((p) => applyToggleBookmark(p, zikrId)),
    [patch],
  );

  /** Reset a set of azkar (one chapter) without touching others. */
  const resetMany = useCallback((keys: string[]) => patch((p) => applyReset(p, keys)), [patch]);

  /** Records the last opened zikr without touching the "progress saved" timestamp. */
  const setLast = useCallback(
    (chapter: number, zikr: number, time?: ZikrTime | null) =>
      patch(
        (p) =>
          p.last?.chapter === chapter &&
          p.last?.zikr === zikr &&
          p.last?.time === (time ?? undefined)
            ? p
            : { ...p, last: { chapter, zikr, at: Date.now(), ...(time ? { time } : {}) } },
        false,
      ),
    [patch],
  );

  return { progress: state, tap, undo, resetZikr, resetMany, toggleBookmark, setLast };
}

/**
 * يعلّم أذكارًا مكتملة اليوم من خارج شاشة الأذكار (الوِرد). يقرأ آخر حالة
 * محفوظة ويكتب فقط إن تغيّر شيء، فتتزامن الشاشات المفتوحة عبر الحدث.
 */
export function markAzkarComplete(entries: readonly CompleteEntry[]) {
  if (typeof window === "undefined" || !entries.length) return;
  flushAll();
  const prev = read();
  const next = applyComplete(prev, entries);
  if (next === prev) return;
  write({ ...next, updatedAt: Date.now() });
}
