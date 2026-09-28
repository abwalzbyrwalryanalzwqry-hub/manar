/**
 * منار — منشئ واحد لنصوص الإشعارات والتنبيهات.
 *
 * كانت النصوص تُركَّب في كل ملف على حدة، فظهر «تبقى ١٠ دقيقة» و«٢ دقائق»
 * و«قبل ٣ يوم»، واسم «الظهر» يوم الجمعة. هنا قواعد العدد العربية مرّة واحدة،
 * والأرقام تتبع اختيار المستخدم (`display-prefs`) عبر `toArabicDigits`.
 *
 * الحالة: «رفع» للمبتدأ والفاعل («تبقّى دقيقتان»)، و«جرّ» بعد حرف الجرّ
 * والظرف («قبل دقيقتين»، «بـ٣ دقائق»).
 */
import { toArabicDigits } from "./format";

export type ArCase = "nom" | "gen";

type Noun = {
  one: string;
  two: { nom: string; gen: string };
  /** ٣–١٠ */
  few: string;
  /** ١١ فأكثر (تمييز مفرد منصوب أو مجرور) */
  many: string;
};

function counted(n: number, w: Noun, c: ArCase): string {
  const v = Math.max(0, Math.round(n));
  if (v === 1) return w.one;
  if (v === 2) return w.two[c];
  const mod = v % 100;
  if (mod >= 3 && mod <= 10) return `${toArabicDigits(v)} ${w.few}`;
  return `${toArabicDigits(v)} ${w.many}`;
}

const MINUTE: Noun = {
  one: "دقيقة واحدة",
  two: { nom: "دقيقتان", gen: "دقيقتين" },
  few: "دقائق",
  many: "دقيقة",
};
const HOUR: Noun = {
  one: "ساعة واحدة",
  two: { nom: "ساعتان", gen: "ساعتين" },
  few: "ساعات",
  many: "ساعة",
};
const DAY: Noun = {
  one: "يوم واحد",
  two: { nom: "يومان", gen: "يومين" },
  few: "أيام",
  many: "يومًا",
};

/** «دقيقة واحدة»، «دقيقتان»، «٥ دقائق»، «١٥ دقيقة». */
export function minutesAr(m: number, c: ArCase = "nom"): string {
  return counted(m, MINUTE, c);
}

export function hoursAr(h: number, c: ArCase = "nom"): string {
  return counted(h, HOUR, c);
}

export function daysAr(d: number, c: ArCase = "nom"): string {
  return counted(d, DAY, c);
}

/** مدة بالدقائق تُقرأ ساعاتٍ حين تكون كذلك: «ساعة»، «ساعة ونصف»، «ساعتان». */
export function durationAr(m: number, c: ArCase = "nom"): string {
  const v = Math.round(m);
  if (v === 60) return "ساعة";
  if (v === 90) return "ساعة ونصف";
  if (v >= 120 && v % 60 === 0) return hoursAr(v / 60, c);
  return minutesAr(v, c);
}

/** وحدة الدقائق وحدها تحت رقمٍ معروض (رقاقات الاختيار): «دقائق» أو «دقيقة». */
export function minutesUnit(m: number): string {
  const v = Math.round(m) % 100;
  if (Math.round(m) === 2) return "دقيقتان";
  return v >= 3 && v <= 10 ? "دقائق" : "دقيقة";
}

/* ------------------------- التنبيه قبل الصلاة ------------------------- */

export const PRE_PRAYER_TITLE = "تذكير الصلاة";

/**
 * «تبقّى ١٠ دقائق على صلاة الجمعة». `label` من `prayerLabelOn` حتى يُسمّى ظهر
 * الجمعة باسمها.
 */
export function prePrayerBody(m: number, label: string): string {
  return `تبقّى ${minutesAr(m)} على صلاة ${label}`;
}

/* ------------------------- الوقت النسبي ------------------------- */

/** «الآن»، «قبل ٥ دقائق»، «قبل ساعتين»، «قبل ٣ أيام». */
export function agoAr(ms: number, now: number = Date.now()): string {
  const m = Math.round(Math.max(0, now - ms) / 60_000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${minutesAr(m, "gen")}`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${hoursAr(h, "gen")}`;
  return `قبل ${daysAr(Math.round(h / 24), "gen")}`;
}

/* ------------------------- أسباب الصمت ------------------------- */

/**
 * لماذا لم يُسمع الأذان — النصّ نفسه في `AdhanService.silenceReason` (Java).
 * كان كل صمتٍ يقول «تم كتم الصوت» ولو لم يكتمه أحد.
 */
export const SILENCE_REASONS = {
  user: "أُسكت الصوت",
  sakinah: "مكتوم في فترة «سكينة»",
  silent: "الصوت مطفأ في منار",
  volume: "مستوى الصوت في منار صفر",
  focus: "الجوال مشغول بمكالمة أو صوت آخر",
} as const;

export type SilenceReason = keyof typeof SILENCE_REASONS;
