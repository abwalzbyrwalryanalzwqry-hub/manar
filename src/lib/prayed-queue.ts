/* منار — دمج «صلّيت» من الإشعار في سجل النشاط.
 *
 * زرّ «صلّيت» في إشعار دخول الوقت أو الإقامة يعمل والتطبيق مغلق: يكتب الأصلي
 * (`PrayedQueue.java`) الصلاة ويومها، ويدمجها الويب هنا عند الفتح. الأيام
 * المستقبلية تُرفض كما في `setDayPrayers`، والقيم الغريبة تُهمل.
 */

import { FARD_PRAYERS, dayKey, recordPrayer } from "@/lib/activity-log";
import type { PrayerKey } from "@/lib/prayer";

export type PrayedItem = { prayer: string; day: string };

/** العناصر الصالحة فقط: صلاة مفروضة، ويومٌ صحيح ليس في المستقبل. */
export function validPrayed(
  items: unknown,
  todayKey = dayKey(),
): { prayer: PrayerKey; day: string }[] {
  if (!Array.isArray(items)) return [];
  const out: { prayer: PrayerKey; day: string }[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const it = (raw ?? {}) as Partial<PrayedItem>;
    if (typeof it.prayer !== "string" || typeof it.day !== "string") continue;
    if (!FARD_PRAYERS.includes(it.prayer as PrayerKey)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(it.day) || it.day > todayKey) continue;
    const k = `${it.prayer}|${it.day}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ prayer: it.prayer as PrayerKey, day: it.day });
  }
  return out;
}

/** يسجّل العناصر الصالحة ويعيد عددها. */
export function applyPrayed(items: unknown, todayKey = dayKey()): number {
  const ok = validPrayed(items, todayKey);
  for (const { prayer, day } of ok) {
    const [y, m, d] = day.split("-").map(Number);
    recordPrayer(prayer, true, new Date(y, m - 1, d, 12));
  }
  return ok.length;
}
