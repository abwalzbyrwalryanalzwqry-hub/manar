/* منار — لقطة ويدجتات الشاشة الرئيسية (أندرويد)، الإصدار ٢.
 *
 * الويدجت يعمل والتطبيق مغلق، فلا يستطيع تشغيل محرّك المواقيت. لذلك يحسب
 * الويب لقطة لثلاثين يوماً قادمة — المواقيت الستة بنصوصها الجاهزة وموعد
 * الإقامة، والتاريخان الهجري والميلادي، وسطر الموسم، وآية كل يوم — ويسلّمها
 * للطبقة الأصلية عند كل تغيير. الأصلي يختار الحالة من الساعة (الصلاة القادمة،
 * «حان الآن»، «الإقامة بعد…») ويضبط منبّهات تحديث غير موقظة.
 *
 * النصوص في الويدجت تُركَّب من صور مرسومة بخطوط التطبيق (`widgets/art.ts`)؛
 * `collectArt` تجمع من اللقطة ما يلزم رسمه.
 *
 * البناء دالة نقية (`buildWidgetSnapshot`) تُختبر بلا جهاز.
 */

import { displayPrefs } from "./display-prefs";
import { dayKey } from "./activity-log";
import {
  formatArTime,
  formatGregorianAr,
  formatHijriAr,
  formatWeekdayAr,
  toArabicDigits,
} from "./format";
import { hijriMonthName, toHijri } from "./hijri";
import {
  computePrayerTimes,
  PRAYER_LABELS,
  type LocationState,
  type PrayerKey,
  type Settings,
} from "./prayer";
import {
  DEFAULT_WIDGET_OPTIONS,
  type WidgetInstanceConfigs,
  type WidgetOptions,
} from "./widget-settings";
import { widgetSeasonLine } from "./seasons/widget-line";
import {
  addLine,
  addPara,
  emptyArtRequest,
  NATIVE_PHRASES,
  paraKey,
  type ArtRequest,
} from "./widgets/art-spec";
import type { WidgetExtras } from "./widgets/extras";

/** أيام اللقطة: الويدجت يعرض المواقيت شهراً دون فتح التطبيق. */
export const WIDGET_DAYS = 30;
/** الصلوات الخمس (العدّ للصلاة القادمة يتخطّى الشروق). */
export const WIDGET_PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
/** المواقيت الستة كما في صفحة المواقيت. */
export const WIDGET_TIMES: PrayerKey[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

export interface WidgetPrayer {
  key: PrayerKey;
  name: string;
  /** ms منذ epoch — الطبقة الأصلية تقارن به الساعة الحالية. */
  at: number;
  /** «٤:٣٠ م» جاهزة للعرض. */
  time: string;
  /** موعد الإقامة (ms) إن كانت الإقامة مفعّلة لهذه الصلاة. */
  iq?: number;
}

export interface WidgetVerse {
  text: string;
  ref: string;
  surah?: number;
  ayah?: number;
  /** مفتاح صورة الآية في حزمة الفن. */
  pk?: string;
}

export interface WidgetHijriParts {
  d: string;
  m: string;
  y: string;
}

export interface WidgetDay {
  date: string;
  weekday: string;
  /** «١٨ أكتوبر ٢٠٢٦». */
  greg: string;
  hijri: string;
  hp: WidgetHijriParts;
  /**
   * «اليوم الهجري يبدأ عند المغرب»: من هذه اللحظة (مغرب اليوم) يعرض الويدجت
   * `hijriEvening` — تاريخ الغد الهجري. غائبان والخيار مطفأ.
   */
  hijriFrom?: number;
  hijriEvening?: string;
  hpEvening?: WidgetHijriParts;
  /** سطر الموسم الجاري («اليوم ١٢ من رمضان · الإفطار ٦:٢١ م»)، إن وُجد. */
  season?: string;
  /** المواقيت الستة بترتيب `WIDGET_TIMES`. */
  prayers: WidgetPrayer[];
  verse: WidgetVerse | null;
}

export interface WidgetDisplay {
  digits: "arab" | "latn";
  clock: "12" | "24";
  /** معامل حجم الخط في التطبيق (الإعدادات ← المظهر). */
  scale: number;
  /** مظهر التطبيق الفعلي الآن — لنمط «يتبع التطبيق». */
  dark: boolean;
}

export interface WidgetSnapshot {
  v: 2;
  city: string;
  generatedAt: number;
  display: WidgetDisplay;
  days: WidgetDay[];
  /** الإعدادات الافتراضية لكل ويدجت. */
  options: WidgetOptions;
  /** إعدادات نسخ بعينها (`appWidgetId`). */
  configs: WidgetInstanceConfigs;
  /** بيانات الويدجتات الأخرى (الأذكار، المسبحة، الختمة…). */
  extras?: WidgetExtras;
}

export type WidgetIqamaFn = (prayer: PrayerKey, adhanAt: Date) => Date | null;

function hijriParts(date: Date, adjust: number): WidgetHijriParts {
  const h = toHijri(date, adjust);
  return {
    d: toArabicDigits(h.day),
    m: hijriMonthName(h.month),
    y: toArabicDigits(h.year),
  };
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
  configs?: WidgetInstanceConfigs;
  iqama?: WidgetIqamaFn;
  display?: Partial<WidgetDisplay>;
  extras?: WidgetExtras;
}): WidgetSnapshot {
  const count = input.days ?? WIDGET_DAYS;
  const adjust = input.hijriAdjust ?? 0;
  const prefs = displayPrefs();
  const days: WidgetDay[] = [];
  const clock = (at: Date) => {
    const ampm = prefs.clock === "24" ? "" : at.getHours() < 12 ? "ص" : "م";
    return ampm ? `${formatArTime(at)} ${ampm}` : formatArTime(at);
  };
  for (let i = 0; i < count; i += 1) {
    const date = new Date(
      input.from.getFullYear(),
      input.from.getMonth(),
      input.from.getDate() + i,
      12,
    );
    const times = computePrayerTimes(input.location, input.settings, date);
    const key = dayKey(date);
    let season: string | undefined;
    try {
      season = widgetSeasonLine(date, adjust, clock(times.maghrib));
    } catch {
      /* خطأ في المواسم لا يمنع الويدجت */
    }
    const tomorrow = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 12);
    const verse = input.verses?.[key];
    days.push({
      date: key,
      weekday: formatWeekdayAr(date),
      greg: formatGregorianAr(date),
      hijri: formatHijriAr(date, adjust),
      hp: hijriParts(date, adjust),
      ...(input.hijriAtMaghrib
        ? {
            hijriFrom: times.maghrib.getTime(),
            hijriEvening: formatHijriAr(tomorrow, adjust),
            hpEvening: hijriParts(tomorrow, adjust),
          }
        : {}),
      ...(season ? { season } : {}),
      prayers: WIDGET_TIMES.map((p) => {
        const at = times[p];
        let iq: number | undefined;
        if (p !== "sunrise" && input.iqama) {
          try {
            const t = input.iqama(p, at);
            if (t && Number.isFinite(t.getTime()) && t.getTime() > at.getTime()) iq = t.getTime();
          } catch {
            /* إقامة غير صالحة لا تمنع الويدجت */
          }
        }
        return {
          key: p,
          /* يوم الجمعة: «الجمعة» بدل «الظهر» كما في التطبيق والإشعارات. */
          name: p === "dhuhr" && date.getDay() === 5 ? "الجمعة" : PRAYER_LABELS[p].ar,
          at: at.getTime(),
          time: clock(at),
          ...(iq ? { iq } : {}),
        };
      }),
      verse: verse ? { ...verse, pk: paraKey("Q", verse.text) } : null,
    });
  }
  return {
    v: 2,
    city: input.location.city,
    generatedAt: input.now ?? Date.now(),
    display: {
      digits: input.display?.digits ?? prefs.digits,
      clock: input.display?.clock ?? prefs.clock,
      scale: input.display?.scale ?? 1,
      dark: input.display?.dark ?? true,
    },
    days,
    options: input.options ?? DEFAULT_WIDGET_OPTIONS,
    configs: input.configs ?? {},
    ...(input.extras ? { extras: input.extras } : {}),
  };
}

/**
 * ما يلزم رسمه بخطوط التطبيق لهذه اللقطة: لكل نمط الكلمات التي يعرضها فيه
 * الأصلي، والفقرات (الآيات والأذكار). الأوقات والأرقام تُركَّب من الأرقام.
 */
export function collectArt(snap: WidgetSnapshot): ArtRequest {
  const req = emptyArtRequest();
  for (const p of NATIVE_PHRASES) {
    addLine(req, "B", p);
    addLine(req, "M", p);
    addLine(req, "R", p);
  }
  addLine(req, "B", snap.city);
  addLine(req, "M", snap.city);
  addLine(req, "R", snap.city);
  for (const d of snap.days) {
    for (const s of [d.hijri, d.hijriEvening, d.season, d.weekday, d.greg]) {
      addLine(req, "R", s);
      addLine(req, "M", s);
    }
    for (const hp of [d.hp, d.hpEvening]) {
      if (!hp) continue;
      addLine(req, "S", hp.m);
      addLine(req, "B", hp.m);
    }
    for (const p of d.prayers) {
      addLine(req, "B", p.name);
      addLine(req, "M", p.name);
      addLine(req, "R", p.name);
    }
    if (d.verse) {
      addPara(req, "Q", d.verse.text);
      addLine(req, "R", d.verse.ref);
    }
  }
  addLine(req, "S", "هـ");
  const ex = snap.extras;
  if (ex) {
    for (const list of [ex.azkar?.morning, ex.azkar?.evening]) {
      for (const z of list ?? []) {
        addPara(req, z.q ? "Q" : "Z", z.text);
        if (z.note) addLine(req, "R", z.note);
      }
    }
    if (ex.tasbih) {
      addLine(req, "B", ex.tasbih.name);
      addLine(req, "M", ex.tasbih.name);
    }
    if (ex.khatmah) {
      for (const s of [ex.khatmah.title, ex.khatmah.portion]) {
        addLine(req, "R", s);
        addLine(req, "M", s);
      }
    }
    if (ex.lastRead) {
      addLine(req, "M", ex.lastRead.label);
      addLine(req, "R", ex.lastRead.label);
    }
    for (const s of ex.seasons ?? []) {
      addLine(req, "B", s.title);
      addLine(req, "M", s.title);
      addLine(req, "R", s.line);
      addLine(req, "M", s.line);
    }
  }
  return req;
}

/** @deprecated أُبقي للتوافق: الآية تُعرض كاملة الآن (صورة مرسومة بخط المصحف). */
export function widgetVerseText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
