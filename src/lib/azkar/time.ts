// ============================================================
// Manar — وقت أذكار الصباح والمساء من مواقيت الصلاة
// ------------------------------------------------------------
// الصباح من الفجر إلى العصر، والمساء من العصر إلى الفجر التالي — بمواقيت
// موقع المستخدم وطريقة الحساب التي اختارها، فيصحّ في كل فصل وبلد.
// إن لم يحدّد المستخدم موقعه (الموقع الافتراضي) أو تعذّر الحساب (خطوط العرض
// العالية) نرجع إلى التقدير بالساعة `defaultTime`.
// ============================================================

import { computePrayerTimes, getLocation, readSettings } from "@/lib/prayer";
import type { ZikrTime } from "./types";
import { defaultTime } from "./variant";

const valid = (d: Date | undefined | null): d is Date => !!d && !Number.isNaN(d.getTime());

/** الصباح إن كان الآن بين الفجر والعصر، وإلا المساء. */
export function timeFromPrayers(now: Date, fajr: Date, asr: Date): ZikrTime {
  return now >= fajr && now < asr ? "morning" : "evening";
}

/** وقت الأذكار الآن بحسب مواقيت موقع المستخدم. */
export function azkarTimeNow(now: Date = new Date()): ZikrTime {
  if (typeof window === "undefined") return defaultTime(now);
  try {
    const loc = getLocation();
    if (loc.source === "default") return defaultTime(now);
    const t = computePrayerTimes(loc, readSettings(), now);
    if (!valid(t.fajr) || !valid(t.asr) || t.fajr >= t.asr) return defaultTime(now);
    return timeFromPrayers(now, t.fajr, t.asr);
  } catch {
    return defaultTime(now);
  }
}
