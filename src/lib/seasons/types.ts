/* مواسم منار — أنواع البيانات.
 *
 * الموسم يُعرَّف بياناتٍ لا شيفرة: Season → Phase → Day → Content → Actions →
 * Notifications. إضافة موسم جديد تعني إضافة كائن إلى `definitions.ts` فقط،
 * والواجهة ومحرّك الحساب والتنبيهات تعمل عليه دون تعديل. */

import type { IconKey } from "@/components/manar/shell";

/** نوع الموسم — للتمييز في العرض لا في الحكم الشرعي. */
export type SeasonType = "worship" | "virtuous-day" | "occasion" | "recurring";

export const SEASON_TYPE_LABEL: Record<SeasonType, string> = {
  worship: "موسم تعبدي",
  "virtuous-day": "يوم فاضل",
  occasion: "مناسبة",
  recurring: "يوم متكرر",
};

/** دورة التكرار: سنوية بالتقويم الهجري، أو شهرية، أو أسبوعية. */
export type SeasonCycle =
  | {
      kind: "annual";
      month: number;
      startDay: number;
      /** "last" = آخر يوم في الشهر (٢٩ أو ٣٠ وفق التقويم المعتمد). */
      endDay: number | "last";
    }
  | {
      kind: "monthly";
      startDay: number;
      endDay: number | "last";
      /** أشهر لا يظهر فيها (مثلاً البيض في ذي الحجة: ١٣ من أيام التشريق). */
      skipMonths?: number[];
    }
  | {
      kind: "weekly";
      /** 0 = الأحد … 5 = الجمعة (مثل Date.getDay). */
      weekdays: number[];
      /** لا يُعرض اليوم إن كان صيامه فرضاً أو منهياً عنه (للاثنين والخميس). */
      skipWhenFastingFixed?: boolean;
    };

/**
 * مرجع يوم نسبةً إلى بداية الموسم.
 * - رقم موجب n: اليوم n من الموسم (١ = أول يوم).
 * - رقم سالب -n: قبل البداية بـ n يوم (-١ = اليوم السابق للبداية).
 * - { fromEnd: k }: نسبةً إلى آخر يوم (٠ = آخر يوم، ١ = اليوم التالي للنهاية).
 */
export type DayRef = number | { fromEnd: number };

/** روابط إلى أقسام التطبيق الموجودة فقط — لا نكرّر محتوى. */
export type SeasonLink =
  | { to: "/azkar/$chapter"; params: { chapter: string } }
  | { to: "/azkar/group/$group"; params: { group: string } }
  | { to: "/quran/mushaf"; search: { surah: number; ayah?: number; mode?: "surah" | "mushaf" } }
  | { to: "/quran/khatmah" }
  | { to: "/quran" }
  | { to: "/wird" }
  | { to: "/azkar" }
  | { to: "/prayer" }
  | { to: "/calendar" }
  | { to: "/seasons/$season"; params: { season: string } };

/** محتوى تعليمي — كل نص ديني يحمل مصدره. */
export type SeasonContent =
  | { kind: "ayah"; surah: number; from: number; to?: number }
  /** حديث موجود في `public/data/hadith/daily.json` — يُقرأ منه لا يُكرَّر. */
  | { kind: "hadith-ref"; id: number }
  | {
      kind: "hadith";
      text: string;
      narrator: string;
      source: string;
      /** درجة الحديث إن لم يكن في الصحيحين. */
      grade?: string;
    }
  /** توضيح عملي بلا ادعاء فضيلة أو حكم جديد. */
  | { kind: "note"; text: string; source?: string };

/** مصدر تحديث الإنجاز آلياً من سجل النشاط الموجود. */
export type AutoTrack = "prayers" | "quran" | "azkar" | "wird";

export type GoalFrequency = "daily" | "once" | "count";

export type SeasonAction = {
  id: string;
  title: string;
  hint?: string;
  link?: SeasonLink;
  /** يمكن إضافته إلى «خطتي في الموسم». */
  goal?: {
    frequency: GoalFrequency;
    /** لعدد الأيام عند frequency = "count". */
    target?: number;
    auto?: AutoTrack;
    /**
     * مراحل احتساب الهدف إن كانت أضيق من مراحل الظهور. مثلاً «صيام عرفة» يظهر
     * من قبل العشر ليُضاف إلى الخطة، لكنه لا يُسجَّل إلا يوم عرفة. إن غاب
     * فالاحتساب في مراحل الظهور (`phases`)، وإن غابت فالموسم كله.
     */
    trackPhases?: string[];
    /** هدف صيام: لا يُسجَّل في يوم يُنهى عن صومه (العيدان وأيام التشريق). */
    fasting?: boolean;
  };
  /** يظهر في هذه المراحل فقط؛ إن غاب يظهر طوال الموسم. */
  phases?: string[];
};

export type SeasonPhase = {
  id: string;
  title: string;
  subtitle?: string;
  from: DayRef;
  to: DayRef;
  content?: SeasonContent[];
  /** لوحات من خدمات التطبيق: أوقات الإمساك والإفطار، أو الثلث الأخير من الليل. */
  panels?: SeasonPanel[];
};

export type SeasonPanel = "fasting-times" | "night-times";

export type ImportantDay = {
  id: string;
  title: string;
  at: DayRef;
  kind: SeasonType;
  note?: string;
};

export type SeasonReminderSlot = "morning" | "evening";

export type SeasonReminder = {
  id: string;
  /** اليوم الذي يُرسَل فيه التنبيه. */
  at: DayRef;
  slot: SeasonReminderSlot;
  title: string;
  body: string;
};

export type Season = {
  id: string;
  title: string;
  shortTitle: string;
  /**
   * الاسم بعد حرف جرّ أو مضاف إليه («اليوم ٥ من ذي الحجة»، «بقي ٣ أيام على
   * ذي الحجة»، «تذكيرات ذي الحجة») إن اختلف عن `shortTitle`.
   */
  ofTitle?: string;
  description: string;
  type: SeasonType;
  icon: IconKey;
  cycle: SeasonCycle;
  /** أيام قبل البداية تظهر فيها مرحلة «قبل الموسم» (مرحلة تمهيد). */
  leadDays?: number;
  /** أيام بعد النهاية تبقى فيها مرحلة «ما بعد الموسم». */
  trailDays?: number;
  /** الأعلى يتقدّم عند تزامن موسمين. */
  priority: number;
  enabled: boolean;
  phases: SeasonPhase[];
  importantDays: ImportantDay[];
  recommendedActions: SeasonAction[];
  educationalContent: SeasonContent[];
  reminders: SeasonReminder[];
  notificationSettings: {
    /** مفعّل افتراضياً؟ السنوية نعم، المتكررة لا حتى لا تُزعج. */
    defaultEnabled: boolean;
  };
  references: string[];
};

/* ------------------------------ الحساب ------------------------------ */

export type HijriYMD = { year: number; month: number; day: number };

export type SeasonInstance = {
  season: Season;
  /** مفتاح ثابت للنسخة: `${id}@YYYY-MM-DD` — تُحفظ به خطة المستخدم. */
  key: string;
  startDate: Date;
  endDate: Date;
  hijriStart: HijriYMD;
  hijriEnd: HijriYMD;
  length: number;
};

export type SeasonStatus = "upcoming" | "current" | "ended";

export type SeasonState = {
  instance: SeasonInstance;
  status: SeasonStatus;
  /** اليوم n من الموسم (١..length) عند status = current، وإلا null. */
  dayNumber: number | null;
  /** الأيام المتبقية حتى البداية (upcoming) — ٠ في غير ذلك. */
  daysUntil: number;
  /** الأيام المتبقية حتى النهاية شاملة اليوم (current). */
  daysLeft: number;
  /** أيام منذ النهاية (ended). */
  daysSinceEnd: number;
  phase: SeasonPhase | null;
  /** ٠..١ داخل الموسم. */
  progress: number;
};
