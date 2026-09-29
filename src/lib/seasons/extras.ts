/* مواسم منار — منطق بطاقات المرحلة الرابعة (بلا واجهة، قابل للاختبار). */

import { countedNoun, toArabicDigits } from "@/lib/format";
import type { SeasonState } from "./types";

/** المواسم التي تبدأ بأول الشهر الهجري: يُعرض لها تأكيد الدخول قرب بدايتها. */
export function monthConfirmApplies(st: SeasonState): boolean {
  const c = st.instance.season.cycle;
  if (c.kind !== "annual" || c.startDay !== 1) return false;
  if (st.status === "upcoming") return st.daysUntil <= 2;
  if (st.status === "current") return (st.dayNumber ?? 99) <= 3;
  return false;
}

/** الملخص يظهر بعد نهاية الموسم (مرحلة «ما بعده») أو في آخر يومين منه. */
export function summaryApplies(st: SeasonState): boolean {
  if (st.status === "ended") return true;
  return st.status === "current" && st.instance.length > 1 && st.daysLeft <= 2;
}

/** صفحات الجزء تقريباً (٦٠٤ / ٣٠). */
const JUZ_PAGES = 20;

/** «أنت متأخر ٣ أجزاء» / «متقدّم ١٢ صفحة» / «أتممت ورد اليوم». */
export function khatmahLine(
  behind: number,
  ahead: number,
  todayDone: boolean,
  phase: string,
): string {
  if (phase === "finished") return "تقبّل الله منك.";
  if (phase === "upcoming") return "تبدأ قريبًا.";
  const amount = (pages: number) =>
    pages >= JUZ_PAGES
      ? juzAr(Math.round(pages / JUZ_PAGES))
      : pages === 1
        ? "صفحة واحدة"
        : pages === 2
          ? "صفحتين"
          : `${toArabicDigits(pages)} ${countedNoun(pages, "صفحة", "صفحات", "صفحة")}`;
  if (behind > 0) return `أنت متأخر ${amount(behind)} عن الجدول`;
  if (ahead > 0) return `متقدّم ${amount(ahead)} على الجدول`;
  return todayDone ? "أتممت ورد اليوم" : "على الجدول";
}

function juzAr(n: number): string {
  if (n === 1) return "جزءًا واحدًا";
  if (n === 2) return "جزأين";
  return `${toArabicDigits(n)} ${countedNoun(n, "جزء", "أجزاء", "جزءًا")}`;
}
