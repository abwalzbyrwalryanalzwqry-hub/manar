import { loadDailyVerse, localDayNumber } from "@/lib/daily-content";
import { toArabicDigits } from "@/lib/format";
import type { WidgetVerse } from "@/lib/widget-snapshot";

/* الآيات ثابتة لليوم: تُحفظ بين البناءات فلا تُحمَّل ثلاثون آية مع كل تغيير. */
const verseCache = new Map<number, WidgetVerse | null>();
/** أطول مقطع (أكثر من آية) يُعرض كاملاً في الويدجت. */
export const WIDGET_RANGE_MAX = 260;

/** آية اليوم كما تظهر في الويدجت: المقطع كاملاً إن قصر، وإلا آيته الأولى بمرجعها. */
export async function widgetVerseFor(date: Date): Promise<WidgetVerse | null> {
  const n = localDayNumber(date);
  if (verseCache.has(n)) return verseCache.get(n) ?? null;
  try {
    const v = await loadDailyVerse(n);
    /* لا قصّ داخل آية أبداً. */
    const whole = v.from !== v.to && v.text.length <= WIDGET_RANGE_MAX;
    const ref = whole
      ? `سورة ${v.surahName}، الآيات ${toArabicDigits(v.from)} إلى ${toArabicDigits(v.to)}`
      : `سورة ${v.surahName}، الآية ${toArabicDigits(v.from)}`;
    const out: WidgetVerse = {
      text: (whole ? v.text : v.firstText).replace(/\s+/g, " ").trim(),
      ref,
      surah: v.surah,
      ayah: v.from,
    };
    verseCache.set(n, out);
    return out;
  } catch {
    /* الآية اختيارية في الويدجت — المواقيت أهم. */
    return null;
  }
}
