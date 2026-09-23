/* منار — لقطة ويدجت الشاشة الرئيسية (أندرويد).
 *
 * الويدجت يعمل والتطبيق مغلق، فلا يستطيع تشغيل محرّك المواقيت. لذلك يحسب
 * الويب لقطة لسبعة أيام قادمة — مواقيت الصلوات الخمس بنصوصها العربية الجاهزة،
 * والتاريخ الهجري بإزاحة المستخدم، وآية كل يوم — ويسلّمها للطبقة الأصلية مرة
 * عند كل تغيير. الطبقة الأصلية تختار «الصلاة القادمة» بنفسها من الساعة وتضبط
 * منبّهاً يحدّث الويدجت عند كل أذان وعند منتصف الليل.
 *
 * البناء دالة نقية (`buildWidgetSnapshot`) تُختبر بلا جهاز.
 */

import { dayKey } from "./activity-log";
import { formatArTime, formatHijriAr, formatWeekdayAr } from "./format";
import {
  computePrayerTimes,
  PRAYER_LABELS,
  type LocationState,
  type PrayerKey,
  type Settings,
} from "./prayer";

export const WIDGET_DAYS = 7;
export const WIDGET_PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export interface WidgetPrayer {
  key: PrayerKey;
  name: string;
  /** ms منذ epoch — الطبقة الأصلية تقارن به الساعة الحالية. */
  at: number;
  /** «٤:٣٠ م» جاهزة للعرض. */
  time: string;
}

export interface WidgetVerse {
  text: string;
  ref: string;
}

export interface WidgetDay {
  date: string;
  weekday: string;
  hijri: string;
  prayers: WidgetPrayer[];
  verse: WidgetVerse | null;
}

export interface WidgetSnapshot {
  v: 1;
  city: string;
  generatedAt: number;
  days: WidgetDay[];
}

export function buildWidgetSnapshot(input: {
  location: LocationState;
  settings: Settings;
  from: Date;
  hijriAdjust?: number;
  /** آية كل يوم بمفتاح `YYYY-MM-DD` (قد تنقص بعض الأيام). */
  verses?: Record<string, WidgetVerse | undefined>;
  days?: number;
  now?: number;
}): WidgetSnapshot {
  const count = input.days ?? WIDGET_DAYS;
  const days: WidgetDay[] = [];
  for (let i = 0; i < count; i += 1) {
    const date = new Date(
      input.from.getFullYear(),
      input.from.getMonth(),
      input.from.getDate() + i,
      12,
    );
    const times = computePrayerTimes(input.location, input.settings, date);
    const key = dayKey(date);
    days.push({
      date: key,
      weekday: formatWeekdayAr(date),
      hijri: formatHijriAr(date, input.hijriAdjust ?? 0),
      prayers: WIDGET_PRAYERS.map((p) => {
        const at = times[p];
        const ampm = at.getHours() < 12 ? "ص" : "م";
        return {
          key: p,
          name: PRAYER_LABELS[p].ar,
          at: at.getTime(),
          time: `${formatArTime(at)} ${ampm}`,
        };
      }),
      verse: input.verses?.[key] ?? null,
    });
  }
  return { v: 1, city: input.location.city, generatedAt: input.now ?? Date.now(), days };
}

/** نص الآية المختصر للويدجت: حدّ أقصى للطول حتى لا يُقصّ في منتصف كلمة. */
export function widgetVerseText(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max)} …`;
}
