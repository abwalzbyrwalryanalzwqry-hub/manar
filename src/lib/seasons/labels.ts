/* مواسم منار — نصوص الحالة (بلا واجهة، قابلة للاختبار). */

import { toArabicDigits } from "@/lib/format";
import type { SeasonState } from "./types";

/** «يوم واحد / يومان / ٣ أيام / ١١ يومًا» — صيغة العدد العربية. */
export function daysAr(n: number): string {
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومان";
  if (n >= 3 && n <= 10) return `${toArabicDigits(n)} أيام`;
  return `${toArabicDigits(n)} يومًا`;
}

/** سطر الحالة: جارٍ / قادم / انتهى — بصياغة هادئة. */
export function statusLine(st: SeasonState): string {
  const s = st.instance.season;
  if (st.status === "current") {
    if (st.instance.length === 1) return `اليوم: ${s.title}.`;
    const name = s.cycle.kind === "annual" && s.id === "ramadan" ? "رمضان" : "الموسم";
    return `اليوم ${toArabicDigits(st.dayNumber ?? 1)} من ${name}.`;
  }
  if (st.status === "upcoming") {
    if (st.daysUntil === 1) return `غدًا ${s.shortTitle}.`;
    return `بقي ${daysAr(st.daysUntil)} على ${s.shortTitle}.`;
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
