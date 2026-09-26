// ============================================================
// Manar — Wird Module: ربط إتمام الوِرد بتقدّم أذكار الصباح والمساء
// ------------------------------------------------------------
// الوِرد قسم مستقل بعدّاده، لكن كل ذكر يُتمّه المستخدم فيه وهو من الباب ٢٧
// يُعلَّم مكتملًا في «أذكار الصباح» أو «أذكار المساء» بالوقت نفسه، فلا يرى
// «٠ من ٢٢» بعد أن أنهى وِرده. الربط باتجاه واحد: الوِرد ← الأذكار، وإعادة
// الوِرد لا تمسح ما سُجّل في الأذكار (قد قاله فعلًا).
// ============================================================

import type { CompleteEntry } from "@/lib/azkar/progress";
import { isDailyOnce, progressKey } from "@/lib/azkar/variant";
import type { WirdSessionKey } from "./data";

export interface LinkableItem {
  order: number;
  repeat: number;
  hisn?: number;
  slot?: "m" | "e";
}

const SLOT: Record<WirdSessionKey, "m" | "e"> = { morning: "m", evening: "e" };

/**
 * هل يُحتسب هذا الذكر في أذكار الوقت؟ فقط ما كان من الحصن وبلفظ وقت الوِرد
 * نفسه؛ فالتهليل التام (#93) صباحي في الحصن، وإن قيل في ورد المساء لا يُحتسب
 * في أذكار المساء لأنه ليس منها.
 */
function linkable(
  session: WirdSessionKey,
  it: LinkableItem,
): it is LinkableItem & { hisn: number } {
  return it.hisn != null && it.slot === SLOT[session];
}

/** مفاتيح أذكار الوقت المقابلة لأذكار الوِرد المكتملة في `counts`. */
export function linkedAzkarEntries(
  session: WirdSessionKey,
  items: readonly LinkableItem[],
  counts: Readonly<Record<number, number>>,
  /** إن مُرّرت: يُعاد فقط ما اكتمل الآن ولم يكن مكتملًا فيها. */
  before?: Readonly<Record<number, number>>,
): CompleteEntry[] {
  const out: CompleteEntry[] = [];
  for (const it of items) {
    if (!linkable(session, it)) continue;
    if ((counts[it.order] ?? 0) < it.repeat) continue;
    if (before && (before[it.order] ?? 0) >= it.repeat) continue;
    out.push({ key: progressKey(it.hisn, session), repeat: it.repeat });
  }
  return out;
}

/**
 * الأذكار اليومية (`DAILY_ONCE`، كالاستغفار مائة مرة «في اليوم»): إن قيلت اليوم
 * في الوِرد الآخر أو في أذكار الصباح/المساء تُحتسب هنا تامّة ولا تُطلب مرتين.
 * يعيد عدّادات جديدة، أو `null` إن لم يتغيّر شيء.
 */
export function dailyCarryOver(
  items: readonly LinkableItem[],
  counts: Readonly<Record<number, number>>,
  otherItems: readonly LinkableItem[],
  otherCounts: Readonly<Record<number, number>>,
  azkarCompleted: ReadonlySet<string>,
): Record<number, number> | null {
  let out: Record<number, number> | null = null;
  for (const it of items) {
    if (!isDailyOnce(it.hisn) || (counts[it.order] ?? 0) >= it.repeat) continue;
    const hisn = it.hisn as number;
    const inOther = otherItems.some(
      (o) => o.hisn === hisn && (otherCounts[o.order] ?? 0) >= o.repeat,
    );
    if (inOther || azkarCompleted.has(progressKey(hisn, null))) {
      out ??= { ...counts };
      out[it.order] = it.repeat;
    }
  }
  return out;
}
