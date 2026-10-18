/* منار — مزامنة ويدجتات الشاشة الرئيسية.
 *
 * يُركَّب مرة في الجذر. على أندرويد فقط:
 *  ١. يبني لقطة ثلاثين يوماً (المواقيت والإقامة، الهجري، المواسم، آية كل يوم،
 *     وبيانات الويدجتات الأخرى) ويسلّمها للأصلي عند أي تغيير يمسّها.
 *  ٢. يرسم الكلمات والآيات التي تعرضها اللقطة بخطوط التطبيق (`widgets/art.ts`)
 *     ويسلّمها صوراً — مرة لكل محتوى جديد (البصمة تمنع التكرار).
 * على الويب لا يفعل شيئاً.
 */

import { useEffect, useState } from "react";
import { useLocation, useSettings, type PrayerKey } from "@/lib/prayer";
import { useHijriAdjust } from "@/lib/hijri";
import { useLocalDay } from "@/lib/daily-content";
import { widgetVerseFor } from "@/lib/widgets/verse";
import { dayKey } from "@/lib/activity-log";
import {
  buildWidgetSnapshot,
  collectArt,
  WIDGET_DAYS,
  type WidgetVerse,
} from "@/lib/widget-snapshot";
import {
  getHomeWidgetStatus,
  isNativeShell,
  sendWidgetArt,
  updateHomeWidget,
} from "@/lib/native-notifications";
import {
  readInstanceConfigs,
  useWidgetOptions,
  WIDGET_REFRESH_EVENT,
  WIDGET_SETTINGS_EVENT,
} from "@/lib/widget-settings";
import {
  APPEARANCE_EVENT,
  FONT_SCALE_VALUES,
  readAppearance,
  resolveDark,
} from "@/lib/app-settings";
import { ADHAN_SETTINGS_EVENT, getAdhanSettings } from "@/lib/adhan-settings";
import { iqamahTimeFor } from "@/lib/prayer-schedule";
import { artHash } from "@/lib/widgets/art-spec";
import { buildWidgetExtras, WIDGET_EXTRAS_EVENTS } from "@/lib/widgets/collect-extras";

export function WidgetSync() {
  const { location } = useLocation();
  const { settings } = useSettings();
  const { adjust: hijriAdjust, atMaghrib, rev: hijriRev } = useHijriAdjust();
  const day = useLocalDay();
  const { options } = useWidgetOptions();
  /* أي حدث يمسّ ما يعرضه الويدجت يزيد العدّاد فيُعاد بناء اللقطة. */
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    const events = [
      WIDGET_REFRESH_EVENT,
      WIDGET_SETTINGS_EVENT,
      APPEARANCE_EVENT,
      ADHAN_SETTINGS_EVENT,
      ...WIDGET_EXTRAS_EVENTS,
    ];
    for (const e of events) window.addEventListener(e, bump);
    return () => {
      for (const e of events) window.removeEventListener(e, bump);
    };
  }, []);

  useEffect(() => {
    if (!isNativeShell()) return;
    let cancelled = false;

    const run = async () => {
      const from = new Date();
      const verses: Record<string, WidgetVerse> = {};
      for (let i = 0; i < WIDGET_DAYS; i += 1) {
        const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i, 12);
        const v = await widgetVerseFor(date);
        if (v) verses[dayKey(date)] = v;
        if (cancelled) return;
      }
      const adhan = getAdhanSettings();
      const appearance = readAppearance();
      const extras = await buildWidgetExtras({ location, settings, from, hijriAdjust }).catch(
        () => undefined,
      );
      if (cancelled) return;
      const snapshot = buildWidgetSnapshot({
        location,
        settings,
        from,
        hijriAdjust,
        hijriAtMaghrib: atMaghrib,
        verses,
        options,
        configs: readInstanceConfigs(),
        iqama: (p: PrayerKey, at: Date) => {
          const per = adhan.perPrayer[p] ?? { adhan: true, reminder: true, iqama: true };
          return per.iqama ? iqamahTimeFor(adhan, p, at) : null;
        },
        display: {
          scale: FONT_SCALE_VALUES[appearance.fontScale] ?? 1,
          dark: resolveDark(appearance.theme),
        },
        extras,
      });
      await updateHomeWidget(JSON.stringify(snapshot));

      /* الصور: بعد اللقطة (المواقيت أولاً)، وفقط إن تغيّر المحتوى أو الخط. */
      const [{ renderArtPack, fontsSignature }, status] = await Promise.all([
        import("@/lib/widgets/art"),
        getHomeWidgetStatus(),
      ]);
      if (cancelled || !status) return;
      const req = collectArt(snapshot);
      const hash = artHash(req, await fontsSignature());
      if (status.artHash === hash) return;
      const pack = await renderArtPack(req);
      if (cancelled) return;
      await sendWidgetArt(pack.index.hash, JSON.stringify(pack.index), pack.sheets);
    };

    // تأخير قصير: الإقلاع مشغول، والويدجت يحتمل ثوانيَ.
    const t = setTimeout(() => void run().catch(() => undefined), 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [location, settings, hijriAdjust, atMaghrib, hijriRev, day, options, tick]);

  return null;
}
