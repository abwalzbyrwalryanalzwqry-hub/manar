/* منار — محرّك التقويم الهجري.
 *
 * التحويل يعتمد على تقويم أم القرى عبر `Intl` (وهو التقويم الرسمي المعتمد في
 * السعودية والأدق للفترة ١٣٠٠–١٦٠٠هـ)، مع طبقة إزاحة يدوية ±٢ يوم.
 *
 * لماذا الإزاحة؟ بداية الشهر الهجري تُبنى على رؤية الهلال المحلية، فتختلف
 * الدول يوماً أو يومين. نفس المعالجة تعتمدها التطبيقات الاحترافية:
 * https://support.muslimpro.com/help/en/articles/how-to-adjust-islamic-hijri-calendar-date
 */

import { useEffect, useState } from "react";

export type HijriDate = {
  year: number;
  month: number; // 1..12
  day: number; // 1..30
};

export const HIJRI_MONTHS = [
  "محرّم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوّال",
  "ذو القعدة",
  "ذو الحجة",
] as const;

export function hijriMonthName(month: number): string {
  return HIJRI_MONTHS[Math.min(11, Math.max(0, month - 1))];
}

/* ------------------------------------------------------------------ */
/*  إزاحة التاريخ الهجري (تعديل المستخدم)                              */
/* ------------------------------------------------------------------ */

const LS_ADJUST = "manar.hijri.adjust.v1";
const EVT_ADJUST = "manar:hijri-adjust";

export const HIJRI_ADJUST_RANGE = [-2, -1, 0, 1, 2] as const;
export type HijriAdjust = (typeof HIJRI_ADJUST_RANGE)[number];

export function getHijriAdjust(): HijriAdjust {
  if (typeof window === "undefined") return 0;
  const raw = Number(window.localStorage.getItem(LS_ADJUST));
  if (!Number.isFinite(raw)) return 0;
  const clamped = Math.max(-2, Math.min(2, Math.trunc(raw)));
  return clamped as HijriAdjust;
}

export function setHijriAdjust(value: number) {
  if (typeof window === "undefined") return;
  const clamped = Math.max(-2, Math.min(2, Math.trunc(value)));
  window.localStorage.setItem(LS_ADJUST, String(clamped));
  window.dispatchEvent(new CustomEvent(EVT_ADJUST));
}

/** يقرأ الإزاحة ويعيد الرسم عند تغييرها من أي شاشة. */
export function useHijriAdjust() {
  // نبدأ من 0 على الخادم وفي أول رسم حتى يتطابق الترطيب، ثم نقرأ المحفوظ.
  const [adjust, setAdjust] = useState<HijriAdjust>(0);

  useEffect(() => {
    const sync = () => setAdjust(getHijriAdjust());
    sync();
    window.addEventListener(EVT_ADJUST, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT_ADJUST, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { adjust, setAdjust: (v: number) => setHijriAdjust(v) };
}

/* ------------------------------------------------------------------ */
/*  التحويل: ميلادي → هجري                                             */
/* ------------------------------------------------------------------ */

const MS_PER_DAY = 86_400_000;

let formatter: Intl.DateTimeFormat | null = null;

function hijriFormatter(): Intl.DateTimeFormat {
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return formatter;
}

/** يُثبّت التاريخ على منتصف نهاره بتوقيت UTC حتى لا تُزحزحه المناطق الزمنية. */
function utcNoon(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12));
}

function shiftDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * يحوّل تاريخاً ميلادياً إلى هجري (أم القرى) بعد تطبيق إزاحة المستخدم.
 *
 * الإزاحة تعني «التاريخ الهجري عندي متقدّم/متأخّر بيوم»، فنطبّقها بإزاحة اليوم
 * الميلادي المُحوَّل — وهي الطريقة التي تُنتج نتيجة متّسقة مع طول الأشهر.
 */
export function toHijri(date: Date, adjust: number = 0): HijriDate {
  const target = shiftDays(utcNoon(date), adjust);
  const parts = hijriFormatter().formatToParts(target);
  let year = 0;
  let month = 1;
  let day = 1;
  for (const p of parts) {
    if (p.type === "year") year = Number(p.value.replace(/[^\d-]/g, ""));
    else if (p.type === "month") month = Number(p.value.replace(/[^\d]/g, ""));
    else if (p.type === "day") day = Number(p.value.replace(/[^\d]/g, ""));
  }
  return { year, month, day };
}

/* ------------------------------------------------------------------ */
/*  التحويل: هجري → ميلادي                                             */
/* ------------------------------------------------------------------ */

/** فرق الأيام بين تاريخين هجريين (تقديري، يكفي للبحث). */
function hijriToOrdinal(h: HijriDate): number {
  return h.year * 354.367 + (h.month - 1) * 29.53 + h.day;
}

/**
 * يحوّل تاريخاً هجرياً إلى ميلادي. نبدأ بتقدير فلكي ثم نصحّحه بالبحث الخطّي
 * (٥ تكرارات كحد أقصى عملياً) لأن `Intl` لا يوفّر تحويلاً عكسياً مباشراً.
 */
export function fromHijri(h: HijriDate, adjust: number = 0): Date {
  // ١ محرّم ١٤٤٧هـ ≈ ٢٦ يونيو ٢٠٢٥م — نستخدم نقطة ارتساء ثم نقدّر.
  const anchorHijri: HijriDate = { year: 1447, month: 1, day: 1 };
  const anchorGregorian = Date.UTC(2025, 5, 26, 12);
  const estimateDays = (hijriToOrdinal(h) - hijriToOrdinal(anchorHijri)) * 1.0;
  let guess = new Date(anchorGregorian + Math.round(estimateDays * MS_PER_DAY));

  for (let i = 0; i < 60; i += 1) {
    const got = toHijri(guess, adjust);
    if (got.year === h.year && got.month === h.month && got.day === h.day) break;
    const delta = (h.year - got.year) * 354 + (h.month - got.month) * 29.53 + (h.day - got.day);
    const step = Math.abs(delta) < 1 ? Math.sign(delta) || 1 : Math.round(delta);
    guess = shiftDays(guess, step);
  }

  // نُرجع تاريخاً محلياً في منتصف النهار حتى تكون العمليات اللاحقة آمنة.
  return new Date(guess.getUTCFullYear(), guess.getUTCMonth(), guess.getUTCDate(), 12);
}

/** عدد أيام الشهر الهجري (٢٩ أو ٣٠) وفق أم القرى بعد الإزاحة. */
export function hijriMonthLength(year: number, month: number, adjust: number = 0): number {
  const first = fromHijri({ year, month, day: 1 }, adjust);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextFirst = fromHijri({ year: nextYear, month: nextMonth, day: 1 }, adjust);
  const days = Math.round((nextFirst.getTime() - first.getTime()) / MS_PER_DAY);
  // حماية من أي انحراف غير متوقع في المحرّك.
  return days === 29 || days === 30 ? days : 30;
}

export function addHijriMonths(
  y: number,
  m: number,
  delta: number,
): { year: number; month: number } {
  const total = y * 12 + (m - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/* ------------------------------------------------------------------ */
/*  المناسبات الإسلامية                                                */
/* ------------------------------------------------------------------ */

export type OccasionKind = "eid" | "blessed" | "fast" | "event";

export type Occasion = {
  id: string;
  title: string;
  note?: string;
  kind: OccasionKind;
  /** يوم هجري ثابت في السنة. */
  month: number;
  day: number;
  /** عدد الأيام التي تستمرها المناسبة (١ = يوم واحد). */
  span?: number;
};

/** المناسبات الهجرية الثابتة — مرتّبة حسب السنة الهجرية. */
export const OCCASIONS: Occasion[] = [
  {
    id: "new-year",
    title: "رأس السنة الهجرية",
    note: "غرّة محرّم",
    kind: "event",
    month: 1,
    day: 1,
  },
  { id: "tasua", title: "تاسوعاء", note: "صيام مسنون", kind: "fast", month: 1, day: 9 },
  {
    id: "ashura",
    title: "عاشوراء",
    note: "صيام يُكفّر السنة الماضية",
    kind: "fast",
    month: 1,
    day: 10,
  },
  {
    id: "mawlid",
    title: "المولد النبوي",
    note: "ذكرى مولد النبي ﷺ",
    kind: "event",
    month: 3,
    day: 12,
  },
  { id: "isra", title: "الإسراء والمعراج", note: "٢٧ رجب", kind: "event", month: 7, day: 27 },
  { id: "nisf-shaban", title: "ليلة النصف من شعبان", kind: "blessed", month: 8, day: 15 },
  {
    id: "ramadan",
    title: "غرّة رمضان",
    note: "بداية شهر الصيام",
    kind: "blessed",
    month: 9,
    day: 1,
  },
  { id: "badr", title: "ذكرى غزوة بدر", note: "١٧ رمضان", kind: "event", month: 9, day: 17 },
  {
    id: "last-ten",
    title: "العشر الأواخر",
    note: "ليالي القدر المرجّحة",
    kind: "blessed",
    month: 9,
    day: 21,
    span: 9,
  },
  {
    id: "qadr",
    title: "ليلة القدر (مرجّحة)",
    note: "٢٧ رمضان",
    kind: "blessed",
    month: 9,
    day: 27,
  },
  { id: "eid-fitr", title: "عيد الفطر", note: "غرّة شوّال", kind: "eid", month: 10, day: 1 },
  {
    id: "shawwal-six",
    title: "ست من شوّال",
    note: "صيام مسنون بعد العيد",
    kind: "fast",
    month: 10,
    day: 2,
    span: 6,
  },
  {
    id: "hajj-ten",
    title: "العشر من ذي الحجة",
    note: "أفضل أيام العام",
    kind: "blessed",
    month: 12,
    day: 1,
    span: 9,
  },
  {
    id: "arafah",
    title: "يوم عرفة",
    note: "صيام يُكفّر سنتين لغير الحاج",
    kind: "fast",
    month: 12,
    day: 9,
  },
  { id: "eid-adha", title: "عيد الأضحى", note: "يوم النحر", kind: "eid", month: 12, day: 10 },
  {
    id: "tashreeq",
    title: "أيام التشريق",
    note: "١١–١٣ ذو الحجة",
    kind: "eid",
    month: 12,
    day: 11,
    span: 3,
  },
];

export const OCCASION_TONE: Record<OccasionKind, { dot: string; chip: string; label: string }> = {
  eid: { dot: "bg-rose-400", chip: "gradient-night", label: "عيد" },
  blessed: { dot: "bg-gold", chip: "gradient-gold", label: "ليلة فاضلة" },
  fast: { dot: "bg-emerald-500", chip: "gradient-primary", label: "صيام" },
  event: { dot: "bg-primary", chip: "gradient-primary", label: "مناسبة" },
};

/** مناسبات يوم هجري معيّن. */
export function occasionsForHijri(h: HijriDate): Occasion[] {
  return OCCASIONS.filter((o) => {
    if (o.month !== h.month) return false;
    const span = o.span ?? 1;
    return h.day >= o.day && h.day < o.day + span;
  });
}

/* ------------------------------------------------------------------ */
/*  الصيام                                                             */
/* ------------------------------------------------------------------ */

export type FastingInfo = {
  /** فرض (رمضان) · مسنون · منهيّ عنه · لا شيء */
  status: "obligatory" | "recommended" | "forbidden" | "none";
  reason?: string;
};

/**
 * حكم الصيام لليوم: رمضان فرض، أيام العيد والتشريق منهيّ عنها، والاثنين
 * والخميس والأيام البيض والمناسبات المسنونة صيام مستحب.
 */
export function fastingInfo(date: Date, h: HijriDate): FastingInfo {
  if (h.month === 9) return { status: "obligatory", reason: "صيام رمضان" };
  if (h.month === 10 && h.day === 1) return { status: "forbidden", reason: "عيد الفطر" };
  if (h.month === 12 && h.day >= 10 && h.day <= 13)
    return { status: "forbidden", reason: h.day === 10 ? "عيد الأضحى" : "أيام التشريق" };

  const fastOccasion = occasionsForHijri(h).find((o) => o.kind === "fast");
  if (fastOccasion) return { status: "recommended", reason: fastOccasion.title };

  if (h.day >= 13 && h.day <= 15) return { status: "recommended", reason: "الأيام البيض" };

  const weekday = date.getDay(); // 0 = الأحد
  if (weekday === 1) return { status: "recommended", reason: "صيام الاثنين" };
  if (weekday === 4) return { status: "recommended", reason: "صيام الخميس" };

  return { status: "none" };
}

/* ------------------------------------------------------------------ */
/*  المناسبات القادمة                                                  */
/* ------------------------------------------------------------------ */

export type UpcomingOccasion = Occasion & {
  date: Date;
  hijri: HijriDate;
  daysAway: number;
};

/**
 * أقرب المناسبات من اليوم. نفحص السنة الهجرية الحالية والتي تليها حتى تظهر
 * مناسبات بداية العام القادم في ديسمبر الهجري.
 */
export function upcomingOccasions(from: Date, adjust: number = 0, limit = 6): UpcomingOccasion[] {
  const todayHijri = toHijri(from, adjust);
  const startOfToday = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  const out: UpcomingOccasion[] = [];

  for (const year of [todayHijri.year, todayHijri.year + 1]) {
    for (const o of OCCASIONS) {
      const hijri: HijriDate = { year, month: o.month, day: o.day };
      const date = fromHijri(hijri, adjust);
      const daysAway = Math.round((date.getTime() - startOfToday.getTime()) / MS_PER_DAY);
      if (daysAway < 0) continue;
      out.push({ ...o, date, hijri, daysAway });
    }
  }

  return out.sort((a, b) => a.daysAway - b.daysAway).slice(0, limit);
}

/* ------------------------------------------------------------------ */
/*  بناء شبكة الشهر                                                    */
/* ------------------------------------------------------------------ */

export type CalendarCell = {
  date: Date;
  hijri: HijriDate;
  /** ينتمي للشهر المعروض (وليس تعبئة من الشهر المجاور). */
  inMonth: boolean;
  occasions: Occasion[];
  fasting: FastingInfo;
};

/** ترتيب أيام الأسبوع في التقويم العربي: يبدأ بالسبت. */
export const WEEKDAY_LABELS = ["سبت", "أحد", "اثن", "ثلا", "أرب", "خمي", "جمع"] as const;

/** رقم العمود (٠ = السبت) ليوم من `Date#getDay()` حيث ٠ = الأحد. */
function columnIndex(date: Date): number {
  return (date.getDay() + 1) % 7;
}

function buildGrid(firstDay: Date, length: number, adjust: number): CalendarCell[] {
  const lead = columnIndex(firstDay);
  const start = shiftDays(firstDay, -lead);
  const total = Math.ceil((lead + length) / 7) * 7;

  return Array.from({ length: total }, (_, i) => {
    const raw = shiftDays(start, i);
    const date = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate(), 12);
    const hijri = toHijri(date, adjust);
    return {
      date,
      hijri,
      inMonth: i >= lead && i < lead + length,
      occasions: occasionsForHijri(hijri),
      fasting: fastingInfo(date, hijri),
    };
  });
}

/** شبكة شهر هجري كامل مع تعبئة الأسابيع. */
export function hijriMonthGrid(year: number, month: number, adjust: number = 0): CalendarCell[] {
  const first = fromHijri({ year, month, day: 1 }, adjust);
  return buildGrid(first, hijriMonthLength(year, month, adjust), adjust);
}

/** شبكة شهر ميلادي كامل مع تعبئة الأسابيع. */
export function gregorianMonthGrid(
  year: number,
  month: number,
  adjust: number = 0,
): CalendarCell[] {
  const first = new Date(year, month, 1, 12);
  const length = new Date(year, month + 1, 0).getDate();
  return buildGrid(first, length, adjust);
}

export const GREGORIAN_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
] as const;

/** «شعبان ١٤٤٧» أو «١٥ شعبان ١٤٤٧». */
export function formatHijri(h: HijriDate, withDay = true): string {
  const head = withDay ? `${h.day} ` : "";
  return `${head}${hijriMonthName(h.month)} ${h.year}`;
}

/** مدى الشهر الهجري بالميلادي، مثل «يونيو – يوليو ٢٠٢٦». */
export function gregorianSpanLabel(cells: CalendarCell[]): string {
  const inMonth = cells.filter((c) => c.inMonth);
  if (!inMonth.length) return "";
  const first = inMonth[0].date;
  const last = inMonth[inMonth.length - 1].date;
  const fm = GREGORIAN_MONTHS[first.getMonth()];
  const lm = GREGORIAN_MONTHS[last.getMonth()];
  if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
    return `${fm} ${first.getFullYear()}`;
  }
  if (first.getFullYear() !== last.getFullYear()) {
    return `${fm} ${first.getFullYear()} – ${lm} ${last.getFullYear()}`;
  }
  return `${fm} – ${lm} ${last.getFullYear()}`;
}
