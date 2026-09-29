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

import { displayPrefs } from "./display-prefs";
import { dayKey } from "./activity-log";
import { formatArTime, formatHijriAr, formatWeekdayAr } from "./format";
import {
  computePrayerTimes,
  PRAYER_LABELS,
  type LocationState,
  type PrayerKey,
  type Settings,
} from "./prayer";
import { DEFAULT_WIDGET_OPTIONS, type WidgetOptions } from "./widget-settings";
import { widgetSeasonLine } from "./seasons/widget-line";

/** أيام اللقطة: الويدجت يعرض المواقيت شهراً دون فتح التطبيق. */
export const WIDGET_DAYS = 30;
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
  /**
   * «اليوم الهجري يبدأ عند المغرب» (المرحلة ٣٣): من هذه اللحظة (مغرب اليوم)
   * يعرض الويدجت `hijriEvening` — تاريخ الغد الهجري. غائبان والخيار مطفأ.
   */
  hijriFrom?: number;
  hijriEvening?: string;
  /** سطر الموسم الجاري («اليوم ١٢ من رمضان · الإفطار ٦:٢١ م»)، إن وُجد. */
  season?: string;
  prayers: WidgetPrayer[];
  verse: WidgetVerse | null;
}

export interface WidgetSnapshot {
  v: 1;
  city: string;
  generatedAt: number;
  days: WidgetDay[];
  /** ما يعرضه الويدجت ولونه (إعدادات «ويدجت الشاشة الرئيسية»). */
  options: WidgetOptions;
}

export function buildWidgetSnapshot(input: {
  location: LocationState;
  settings: Settings;
  from: Date;
  hijriAdjust?: number;
  hijriAtMaghrib?: boolean;
  /** آية كل يوم بمفتاح `YYYY-MM-DD` (قد تنقص بعض الأيام). */
  verses?: Record<string, WidgetVerse | undefined>;
  days?: number;
  now?: number;
  options?: WidgetOptions;
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
    const clock = (at: Date) => {
      const ampm = displayPrefs().clock === "24" ? "" : at.getHours() < 12 ? "ص" : "م";
      return ampm ? `${formatArTime(at)} ${ampm}` : formatArTime(at);
    };
    let season: string | undefined;
    try {
      season = widgetSeasonLine(date, input.hijriAdjust ?? 0, clock(times.maghrib));
    } catch {
      /* خطأ في المواسم لا يمنع الويدجت */
    }
    days.push({
      date: key,
      weekday: formatWeekdayAr(date),
      hijri: formatHijriAr(date, input.hijriAdjust ?? 0),
      ...(input.hijriAtMaghrib
        ? {
            hijriFrom: times.maghrib.getTime(),
            hijriEvening: formatHijriAr(
              new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 12),
              input.hijriAdjust ?? 0,
            ),
          }
        : {}),
      ...(season ? { season } : {}),
      prayers: WIDGET_PRAYERS.map((p) => {
        const at = times[p];
        return {
          key: p,
          /* يوم الجمعة: «الجمعة» بدل «الظهر» كما في التطبيق والإشعارات. */
          name: p === "dhuhr" && date.getDay() === 5 ? "الجمعة" : PRAYER_LABELS[p].ar,
          at: at.getTime(),
          time: clock(at),
        };
      }),
      verse: input.verses?.[key] ?? null,
    });
  }
  return {
    v: 1,
    city: input.location.city,
    generatedAt: input.now ?? Date.now(),
    days,
    options: input.options ?? DEFAULT_WIDGET_OPTIONS,
  };
}

/** نص الآية المختصر للويدجت: حدّ أقصى للطول حتى لا يُقصّ في منتصف كلمة. */
export function widgetVerseText(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max)} …`;
}
