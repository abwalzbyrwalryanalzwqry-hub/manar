/* Arabic formatting helpers — Manar
 *
 * تتبع اختيار المستخدم في `display-prefs`: ساعة ١٢/٢٤ ونوع الأرقام. */

import { displayPrefs } from "./display-prefs";
import { hijriEngine, hijriMonthName, toHijri } from "./hijri";

const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/**
 * الأرقام بالنوع الذي اختاره المستخدم. الاسم تاريخي: مع «أرقام غربية» تُعاد
 * الأرقام العربية المشرقية أيضاً إلى 0-9.
 */
export function toArabicDigits(input: string | number): string {
  if (displayPrefs().digits === "latn") {
    return String(input).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
  }
  return String(input).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
}

const is24 = () => displayPrefs().clock === "24";
const hour = (date: Date) => (is24() ? date.getHours() : ((date.getHours() + 11) % 12) + 1);

export function formatArTime(date: Date): string {
  return toArabicDigits(`${hour(date)}:${String(date.getMinutes()).padStart(2, "0")}`);
}

/** «صباحاً» أو «مساءً»، ولا شيء بنظام ٢٤ ساعة. */
export function ampmAr(date: Date): string {
  if (is24()) return "";
  return date.getHours() < 12 ? "صباحاً" : "مساءً";
}

export function formatHHMM(date: Date): string {
  return toArabicDigits(
    `${String(hour(date)).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  );
}

/**
 * نسبة مئوية بقواعد CLDR للعربية: «٥٠٪» تُعرض والعلامة إلى يسار الرقم كما في
 * أنظمة التشغيل العربية، و«50%» مع الأرقام الغربية. `value` من ٠ إلى ١٠٠.
 * تحمل علامات اتجاه (ALM/LRM) فلا تنقلب داخل حاوية `dir="ltr"`.
 * `signed` يضيف «+» للفروق الموجبة.
 */
export function formatPercent(value: number, opts: { signed?: boolean } = {}): string {
  const n = Math.round(Number.isFinite(value) ? value : 0);
  return new Intl.NumberFormat(`ar-EG${numberingTag()}`, {
    style: "percent",
    maximumFractionDigits: 0,
    signDisplay: opts.signed ? "exceptZero" : "auto",
  }).format(n / 100);
}

/** لاحقة نظام الترقيم في Intl حسب اختيار المستخدم. */
export function numberingTag(): string {
  return displayPrefs().digits === "latn" ? "-u-nu-latn" : "";
}

/** Format a positive ms difference as Arabic HH:MM:SS */
export function formatCountdown(ms: number): { h: string; m: string; s: string; compact: string } {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return {
    h: toArabicDigits(String(h).padStart(2, "0")),
    m: toArabicDigits(String(m).padStart(2, "0")),
    s: toArabicDigits(String(s).padStart(2, "0")),
    compact: toArabicDigits(
      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
    ),
  };
}

export function formatGregorianAr(date: Date): string {
  return new Intl.DateTimeFormat(`ar-EG${numberingTag()}`, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * التاريخ الهجري (أم القرى) مع إزاحة المستخدم اليدوية بالأيام.
 * الإزاحة تُدار من شاشة التقويم عبر `useHijriAdjust` في `@/lib/hijri`.
 */
export function formatHijriAr(date: Date, adjust = 0): string {
  /* بلا دعم أم القرى في `Intl` (المرحلة ٣٣): من الجدول المضمَّن بالصيغة نفسها. */
  if (hijriEngine() === "table") {
    const h = toHijri(date, adjust);
    return toArabicDigits(`${h.day} ${hijriMonthName(h.month)} ${h.year} هـ`);
  }
  const target = adjust === 0 ? date : new Date(date.getTime() + adjust * 86_400_000);
  return new Intl.DateTimeFormat(
    `ar-SA-u-ca-islamic-umalqura${displayPrefs().digits === "latn" ? "-nu-latn" : ""}`,
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  ).format(target);
}

export function formatWeekdayAr(date: Date): string {
  return new Intl.DateTimeFormat("ar-EG", { weekday: "long" }).format(date);
}

/* ------------------------------------------------------------------ */
/*  صيغ العدد العربية                                                  */
/* ------------------------------------------------------------------ */

/**
 * المعدود بعد رقم: «٣ أيام»، «١١ يومًا»، «١٠٠ يوم». المفرد والمثنى بلا رقم
 * يتولّاهما `countAr`؛ هذه للأعداد المكتوبة بالأرقام (عدّاد، «٣ / ١٠ أيام»).
 * - ٣–١٠ (ومثلها ١٠٣–١١٠): جمع.
 * - ١١–٩٩: مفرد منصوب.
 * - المئات فما فوق إن انتهت بـ ٠٠–٠٢: مفرد مجرور.
 */
export function countedNoun(n: number, one: string, few: string, accusative = `${one}اً`): string {
  const mod = Math.abs(n) % 100;
  if (mod >= 3 && mod <= 10) return few;
  if (Math.abs(n) >= 100 && mod <= 2) return one;
  if (n === 1 || n === 2) return one;
  return accusative;
}

/** «تذكير واحد»، «تذكيران»، «٣ تذكيرات»، «١١ تذكيراً»، «١٠٠ تذكير». */
export function countAr(n: number, one: string, two: string, few: string): string {
  if (n === 1) return `${one} واحد`;
  if (n === 2) return two;
  return `${toArabicDigits(n)} ${countedNoun(n, one, few)}`;
}
