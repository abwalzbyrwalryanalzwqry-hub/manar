// ============================================================
// Manar — Azkar Module
// اشتقاقات الصفحة الرئيسية للأذكار: الوصول السريع، و«تابع من حيث توقفت»، والمحفوظات.
// ============================================================

import type { AzkarProgress } from "./progress";
import type { AzkarBook, AzkarChapter, Zikr, ZikrTime } from "./types";
import { azkarForTime, progressKey } from "./variant";

export interface QuickLink {
  id: "morning" | "evening" | "sleep" | "after-prayer";
  label: string;
  chapter: number;
  time?: ZikrTime;
  icon: "sun" | "moon" | "bed" | "prayer";
}

/** الأكثر استخدامًا: باب ٢٧ (صباحًا ومساءً)، وباب ٢٨ (النوم)، وباب ٢٥ (بعد السلام). */
export const QUICK_LINKS: QuickLink[] = [
  { id: "morning", label: "أذكار الصباح", chapter: 27, time: "morning", icon: "sun" },
  { id: "evening", label: "أذكار المساء", chapter: 27, time: "evening", icon: "moon" },
  { id: "sleep", label: "أذكار النوم", chapter: 28, icon: "bed" },
  { id: "after-prayer", label: "بعد الصلاة", chapter: 25, icon: "prayer" },
];

/** أذكار الباب في وقت محدد مع عدد المكتمل منها اليوم. */
export function chapterProgress(
  chapter: AzkarChapter,
  counters: AzkarProgress["counters"],
  time: ZikrTime | null,
) {
  const list = azkarForTime(chapter, time);
  const done = list.filter((z) => (counters[progressKey(z.id, time)] ?? 0) >= z.repeat).length;
  return { list, done, total: list.length, complete: list.length > 0 && done === list.length };
}

export interface ResumeTarget {
  chapter: AzkarChapter;
  time?: ZikrTime;
  /** الذكر الذي يُفتح عليه؛ غير محدد إن كان آخر ذكر مكتملًا (فتفتح الجلسة على أول ناقص). */
  zikr?: number;
  /** ترتيب الذكر المعروض (من ١) ومجموع أذكار الباب في هذا الوقت. */
  position: number;
  total: number;
  done: number;
}

/**
 * «تابع من حيث توقفت»: آخر باب فُتح إن لم يكتمل بعد. يعود null إن لم يُفتح شيء
 * اليوم أو اكتمل الباب، فلا يُعرض زر يفتح بابًا منتهيًا.
 */
export function resumeTarget(
  book: Pick<AzkarBook, "chapters">,
  progress: Pick<AzkarProgress, "last" | "counters">,
): ResumeTarget | null {
  const last = progress.last;
  if (!last) return null;
  const chapter = book.chapters.find((c) => c.id === last.chapter);
  if (!chapter) return null;
  const timed = chapter.azkar.some((z) => z.time != null || z.evening != null);
  const time = timed ? (last.time ?? "morning") : null;
  const { list, done, total, complete } = chapterProgress(chapter, progress.counters, time);
  if (complete || !total) return null;
  const at = list.findIndex((z) => z.id === last.zikr);
  const lastZikr: Zikr | undefined = list[at];
  const lastDone = lastZikr
    ? (progress.counters[progressKey(lastZikr.id, time)] ?? 0) >= lastZikr.repeat
    : true;
  const firstOpen = list.findIndex(
    (z) => (progress.counters[progressKey(z.id, time)] ?? 0) < z.repeat,
  );
  return {
    chapter,
    ...(time ? { time } : {}),
    zikr: lastDone ? undefined : lastZikr?.id,
    position: (lastDone ? firstOpen : at) + 1,
    total,
    done,
  };
}

export interface BookmarkEntry {
  zikr: Zikr;
  chapter: AzkarChapter;
}

/** المحفوظات بترتيب الحفظ، الأحدث أولًا؛ تُهمل المعرّفات التي لم تعد في الكتاب. */
export function bookmarkEntries(
  book: Pick<AzkarBook, "chapters">,
  bookmarks: readonly number[],
): BookmarkEntry[] {
  const index = new Map<number, BookmarkEntry>();
  for (const chapter of book.chapters) {
    for (const zikr of chapter.azkar) index.set(zikr.id, { zikr, chapter });
  }
  return [...bookmarks]
    .reverse()
    .map((id) => index.get(id))
    .filter((e): e is BookmarkEntry => !!e);
}

/**
 * عدد الأذكار المكتملة اليوم بلا تكرار. في الباب ٢٧ يُسجَّل الذكر مرتين
 * (`76` صباحًا و`76:e` مساءً)، فيُحسب مرة واحدة حتى لا يتجاوز الشريط المجموع.
 */
export function uniqueCompletedCount(completed: readonly string[]): number {
  return new Set(completed.map((k) => k.split(":")[0])).size;
}

/**
 * مصدر «ذكر اليوم»: بابا الاستغفار والتوبة (١٢٩)، وفضل التسبيح والتحميد والتهليل
 * والتكبير (١٣٠). أحاديثهما عامة لا ترتبط بوقت أو مناسبة، ونصوصها من الكتاب نفسه.
 */
export const DAILY_CHAPTERS = [129, 130] as const;

/** رقم اليوم من تاريخ `YYYY-MM-DD` محلي، ليتغيّر الذكر عند منتصف الليل. */
function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
}

/** ذكر اليوم: واحد ثابت طوال اليوم يتبدّل يوميًا بالدور على أذكار المصدر. */
export function zikrOfTheDay(book: Pick<AzkarBook, "chapters">, day: string): BookmarkEntry | null {
  const pool: BookmarkEntry[] = [];
  for (const id of DAILY_CHAPTERS) {
    const chapter = book.chapters.find((c) => c.id === id);
    for (const zikr of chapter?.azkar ?? []) pool.push({ zikr, chapter: chapter! });
  }
  if (!pool.length) return null;
  const i = ((dayNumber(day) % pool.length) + pool.length) % pool.length;
  return pool[i];
}

/**
 * الذكر الذي يُنتقل إليه بعد `from`: التالي مباشرة إن وُجد، وإلا (في آخر الباب)
 * أول ذكر لم يكتمل. يعود -1 إن اكتمل الباب كله فتُعرض شاشة الإتمام.
 */
export function nextIndexAfter(
  list: readonly Pick<Zikr, "repeat">[],
  countOf: (z: Pick<Zikr, "repeat">, i: number) => number,
  from: number,
): number {
  if (from + 1 < list.length) return from + 1;
  return list.findIndex((z, i) => countOf(z, i) < z.repeat);
}
