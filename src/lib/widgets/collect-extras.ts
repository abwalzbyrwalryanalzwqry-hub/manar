/* منار — جمع بيانات الويدجتات غير المواقيت من مخازن التطبيق المحلية.
 * كلها قراءات محلية سريعة (لا شبكة)؛ وأي فشل في جزء لا يُسقط الباقي. */

import { ACTIVITY_EVENT, dayKey, readLog, shiftDayKey } from "@/lib/activity-log";
import { azkarRepository } from "@/lib/azkar/repository";
import { zikrText } from "@/lib/azkar/variant";
import type { Zikr, ZikrTime } from "@/lib/azkar/types";
import { toArabicDigits } from "@/lib/format";
import { KHATMAH_EVENT, planStatus, readKhatmah } from "@/lib/quran/khatmah-plan";
import { QURAN_HISTORY_EVENT, readHistory } from "@/lib/quran/reading-history";
import { SURAH_META } from "@/lib/quran/metadata";
import { activeSession } from "@/lib/tasbih/session";
import { readTasbihStore, TASBIH_EVENT } from "@/lib/tasbih/store";
import { paraKey } from "./art-spec";
import type {
  WidgetAzkar,
  WidgetExtras,
  WidgetKhatmah,
  WidgetLastRead,
  WidgetTasbih,
  WidgetZikr,
} from "./extras";

/** أحداث تغيّر هذه البيانات — تعيد `WidgetSync` بناء اللقطة عندها. */
export const WIDGET_EXTRAS_EVENTS: string[] = [
  ACTIVITY_EVENT,
  TASBIH_EVENT,
  KHATMAH_EVENT,
  QURAN_HISTORY_EVENT,
];

/** باب «أذكار الصباح والمساء» في حصن المسلم. */
export const AZKAR_CHAPTER = 27;
/** أطول ذكر يتّسع له الويدجت مقروءاً؛ الأطول يُقرأ كاملاً في التطبيق. */
export const WIDGET_ZIKR_MAX = 260;

/** «٣ مرات»، «مرة واحدة»، «١٠٠ مرة». */
export function repeatNote(n: number): string {
  if (n <= 1) return "مرة واحدة";
  if (n === 2) return "مرتين";
  const mod = n % 100;
  return `${toArabicDigits(n)} ${mod >= 3 && mod <= 10 ? "مرات" : "مرة"}`;
}

/** نصّ الذكر للعرض: بلا الإرشاد الافتتاحي بين قوسين وبلا علامات الاقتباس. */
export function cleanZikrText(text: string): string {
  return text
    .replace(/^\s*\([^)]*\)\s*(أَوْ\s*\([^)]*\)\s*)?/u, "")
    .replace(/[«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function widgetAzkarFrom(azkar: readonly Zikr[]): WidgetAzkar {
  const pick = (time: ZikrTime): WidgetZikr[] =>
    azkar
      .filter((z) => z.time == null || z.time === time)
      .map((z) => {
        const q = !!z.quran?.length;
        const text = cleanZikrText(zikrText(z, time));
        return {
          id: z.id,
          text,
          repeat: z.repeat,
          q: q || undefined,
          note: repeatNote(z.repeat),
          pk: paraKey(q ? "Q" : "Z", text),
        };
      })
      .filter((z) => z.text.length > 0 && z.text.length <= WIDGET_ZIKR_MAX);
  return { chapter: AZKAR_CHAPTER, morning: pick("morning"), evening: pick("evening") };
}

async function azkarPart(): Promise<WidgetAzkar | undefined> {
  await azkarRepository.load();
  const ch = azkarRepository.chapter(AZKAR_CHAPTER);
  return ch ? widgetAzkarFrom(ch.azkar) : undefined;
}

function tasbihPart(): WidgetTasbih | null {
  const s = activeSession(readTasbihStore());
  if (!s) return null;
  return { id: s.id, name: s.name, count: s.count, target: s.target ?? 0 };
}

function khatmahPart(today: string): WidgetKhatmah | null {
  const plan = readKhatmah().plan;
  if (!plan) return null;
  const st = planStatus(plan, today);
  const title =
    st.phase === "finished"
      ? "تمّت الختمة"
      : st.phase === "upcoming"
        ? "الختمة تبدأ قريباً"
        : `اليوم ${toArabicDigits(Math.min(st.day, plan.days))} من ${toArabicDigits(plan.days)}`;
  const portion = st.portion
    ? st.portion.from.surah === st.portion.to.surah
      ? `ورد اليوم: ${st.portion.from.surahName}، ${toArabicDigits(st.portion.pages)} صفحات`
      : `ورد اليوم: ${st.portion.from.surahName} ← ${st.portion.to.surahName}`
    : st.phase === "finished"
      ? "ابدأ ختمة جديدة"
      : "أتممت ورد اليوم";
  return {
    title,
    portion,
    progress: Math.max(0, Math.min(1, st.progress)),
    todayDone: st.todayDone,
  };
}

function lastReadPart(): WidgetLastRead | null {
  const last = readHistory().entries[0];
  if (!last) return null;
  const meta = SURAH_META[last.surah - 1];
  if (!meta) return null;
  if (last.mode === "mushaf") {
    return {
      label: `سورة ${meta.nameAr}، صفحة ${toArabicDigits(last.page)}`,
      route: `/quran/mushaf?page=${last.page}&mode=mushaf`,
    };
  }
  return {
    label: `سورة ${meta.nameAr}، الآية ${toArabicDigits(last.ayah)}`,
    route: `/quran/mushaf?surah=${last.surah}&ayah=${last.ayah}&mode=surah`,
  };
}

function prayedPart(today: string): Record<string, string[]> {
  const log = readLog();
  const out: Record<string, string[]> = {};
  for (const k of [shiftDayKey(today, -1), today]) {
    const p = log.days[k]?.prayers;
    if (p?.length) out[k] = [...p];
  }
  return out;
}

function safe<T>(f: () => T): T | undefined {
  try {
    return f();
  } catch {
    return undefined;
  }
}

export async function buildWidgetExtras(input: { from: Date }): Promise<WidgetExtras> {
  const today = dayKey(input.from);
  const azkar = await azkarPart().catch(() => undefined);
  return {
    azkar,
    tasbih: safe(tasbihPart) ?? null,
    khatmah: safe(() => khatmahPart(today)) ?? null,
    lastRead: safe(lastReadPart) ?? null,
    prayed: safe(() => prayedPart(today)) ?? {},
  };
}
