// ============================================================
// Manar — Azkar Module
// صيغ الصباح والمساء + الأذكار المركّبة (مقاطع لكل منها عدد).
// ============================================================

import type { AzkarChapter, Zikr, ZikrSegment, ZikrTime } from "./types";

/** هل في الباب أذكار تختلف بين الصباح والمساء؟ (باب ٢٧ حاليًا). */
export function hasTimeVariants(chapter: AzkarChapter): boolean {
  return chapter.azkar.some((z) => z.time != null || z.evening != null);
}

/**
 * تقدير احتياطي بالساعة المحلية: المساء من العصر تقريبًا (١٥:٠٠) حتى الفجر (٠٤:٠٠).
 * الأصل `azkarTimeNow` (من مواقيت الصلاة)؛ هذا حين لا يُعرف موقع المستخدم.
 */
export function defaultTime(now: Date = new Date()): ZikrTime {
  const h = now.getHours();
  return h >= 15 || h < 4 ? "evening" : "morning";
}

/** أذكار الباب التي تُقال في هذا الوقت. */
export function azkarForTime(chapter: AzkarChapter, time: ZikrTime | null): Zikr[] {
  if (!time) return chapter.azkar;
  return chapter.azkar.filter((z) => z.time == null || z.time === time);
}

/** لفظ الذكر في الوقت المحدد. */
export function zikrText(zikr: Zikr, time: ZikrTime | null): string {
  return time === "evening" && zikr.evening ? zikr.evening : zikr.text;
}

export interface SegmentState {
  /** رقم المقطع الحالي (من صفر). */
  index: number;
  segment: ZikrSegment;
  /** العدّ داخل المقطع الحالي. */
  count: number;
}

/** يحدد المقطع الجاري من العدد الكلي. يعيد null إن لم يكن الذكر مركّبًا. */
export function segmentState(zikr: Zikr, total: number): SegmentState | null {
  const segs = zikr.segments;
  if (!segs?.length) return null;
  let left = Math.max(0, total);
  for (let i = 0; i < segs.length; i++) {
    if (left < segs[i].repeat || i === segs.length - 1) {
      return { index: i, segment: segs[i], count: Math.min(left, segs[i].repeat) };
    }
    left -= segs[i].repeat;
  }
  return null;
}

/**
 * مفتاح عدّاد الذكر. أذكار المساء في باب ٢٧ لها عدّاد مستقل (`id:e`) حتى لا
 * يظهر ذكرٌ أُتمّ صباحًا تامًّا في المساء. الصباح وسائر الأبواب تبقى بالرقم
 * وحده، فيبقى التقدّم المحفوظ قبل هذا التغيير صالحًا.
 */
export function progressKey(zikrId: number, time: ZikrTime | null): string {
  return time === "evening" && !isDailyOnce(zikrId) ? `${zikrId}:e` : String(zikrId);
}

/**
 * أذكار عددها «في اليوم» لا «في الصباح/المساء»: عدّاد يومي واحد يظهر في
 * الجلستين، فما قيل صباحًا يُحتسب مساءً ولا يُطلب مرتين.
 * #96 «أستغفر الله وأتوب إليه» (مائة مرة في اليوم).
 */
export const DAILY_ONCE: ReadonlySet<number> = new Set([96]);

export function isDailyOnce(zikrId: number | undefined | null): boolean {
  return zikrId != null && DAILY_ONCE.has(zikrId);
}

/** هل أُتمّ هذا الذكر اليوم في أي وقت (صباحًا أو مساءً)؟ */
export function isZikrDone(completed: ReadonlySet<string>, zikrId: number): boolean {
  return completed.has(String(zikrId)) || completed.has(`${zikrId}:e`);
}
