/* مواسم منار — نصوص الحالة (بلا واجهة، قابلة للاختبار). */

import { countedNoun, toArabicDigits } from "@/lib/format";
import type { Season, SeasonState } from "./types";

/** «يوم واحد / يومان / ٣ أيام / ١١ يومًا / ١٠٠ يوم» — صيغة العدد العربية. */
export function daysAr(n: number): string {
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومان";
  return `${toArabicDigits(n)} ${dayUnit(n)}`;
}

/** كلمة «يوم» بعد رقم مكتوب: ١ يوم، ٢ يومان، ٣ أيام، ١١ يومًا، ١٠٠ يوم. */
export function dayUnit(n: number): string {
  if (n === 2) return "يومان";
  return countedNoun(n, "يوم", "أيام", "يومًا");
}

/** اسم الموسم بعد حرف جرّ أو مضافاً إليه: «من ذي الحجة»، «على رمضان». */
export function seasonOf(s: Season): string {
  return s.ofTitle ?? s.shortTitle;
}

/** سطر الحالة: جارٍ / قادم / انتهى — بصياغة هادئة. */
export function statusLine(st: SeasonState): string {
  const s = st.instance.season;
  if (st.status === "current") {
    if (st.instance.length === 1) return `اليوم: ${s.title}.`;
    return `اليوم ${toArabicDigits(st.dayNumber ?? 1)} من ${seasonOf(s)}.`;
  }
  if (st.status === "upcoming") {
    if (st.daysUntil === 1) return `غدًا ${s.shortTitle}.`;
    return `بقي ${daysAr(st.daysUntil)} على ${seasonOf(s)}.`;
  }
  return "انتهى الموسم.";
}

/** «بقي …» داخل الموسم الجاري. */
export function remainingLine(st: SeasonState): string | null {
  if (st.status !== "current" || st.instance.length === 1) return null;
  if (st.daysLeft === 1) return "اليوم الأخير";
  return `بقي ${daysAr(st.daysLeft)}`;
}

/** عنوان المرحلة إن لم يكن تكراراً لسطر الحالة (مثل «غدًا الجمعة»). */
export function phaseLabel(st: SeasonState): string | null {
  const t = st.phase?.title;
  if (!t) return null;
  return statusLine(st).replace(/\.$/, "") === t ? null : t;
}
