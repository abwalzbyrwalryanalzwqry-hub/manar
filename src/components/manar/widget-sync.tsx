/* منار — مزامنة ويدجت الشاشة الرئيسية.
 *
 * يُركَّب مرة في الجذر. على أندرويد فقط: يبني لقطة سبعة أيام (المواقيت، الهجري،
 * آية كل يوم) ويسلّمها للويدجت عند تغيّر الموقع أو الإعدادات أو إزاحة الهجري
 * أو اليوم. على الويب لا يفعل شيئاً.
 */

import { useEffect, useState } from "react";
import { useLocation, useSettings } from "@/lib/prayer";
import { useHijriAdjust } from "@/lib/hijri";
import { loadDailyVerse, localDayNumber, useLocalDay } from "@/lib/daily-content";
import { dayKey } from "@/lib/activity-log";
import { toArabicDigits } from "@/lib/format";
import {
  buildWidgetSnapshot,
  widgetVerseText,
  WIDGET_DAYS,
  type WidgetVerse,
} from "@/lib/widget-snapshot";
import { isNativeShell, updateHomeWidget } from "@/lib/native-notifications";
import { useWidgetOptions, WIDGET_REFRESH_EVENT } from "@/lib/widget-settings";

export function WidgetSync() {
  const { location } = useLocation();
  const { settings } = useSettings();
  const { adjust: hijriAdjust, atMaghrib, rev: hijriRev } = useHijriAdjust();
  const day = useLocalDay();
  const { options } = useWidgetOptions();
  /* «تحديث الويدجت الآن» من شاشة الويدجت: يزيد العدّاد فيُعاد بناء اللقطة. */
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const onRefresh = () => setRefreshTick((n) => n + 1);
    window.addEventListener(WIDGET_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(WIDGET_REFRESH_EVENT, onRefresh);
  }, []);

  useEffect(() => {
    if (!isNativeShell()) return;
    let cancelled = false;

    const run = async () => {
      const from = new Date();
      const verses: Record<string, WidgetVerse> = {};
      for (let i = 0; i < WIDGET_DAYS; i += 1) {
        const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i, 12);
        try {
          const v = await loadDailyVerse(localDayNumber(date));
          const ref =
            v.from === v.to
              ? `سورة ${v.surahName}، الآية ${toArabicDigits(v.from)}`
              : `سورة ${v.surahName}، الآيات ${toArabicDigits(v.from)} إلى ${toArabicDigits(v.to)}`;
          verses[dayKey(date)] = { text: widgetVerseText(v.firstText), ref };
        } catch {
          /* الآية اختيارية في الويدجت — المواقيت أهم. */
        }
        if (cancelled) return;
      }
      const snapshot = buildWidgetSnapshot({
        location,
        settings,
        from,
        hijriAdjust,
        hijriAtMaghrib: atMaghrib,
        verses,
        options,
      });
      await updateHomeWidget(JSON.stringify(snapshot));
    };

    // تأخير قصير: الإقلاع مشغول، والويدجت يحتمل ثوانيَ.
    const t = setTimeout(() => void run().catch(() => undefined), 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [location, settings, hijriAdjust, atMaghrib, hijriRev, day, options, refreshTick]);

  return null;
}
