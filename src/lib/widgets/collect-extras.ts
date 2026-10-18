/* منار — جمع بيانات الويدجتات غير المواقيت (تُكمَّل مع ويدجتات المرحلة الرابعة). */

import type { LocationState, Settings } from "@/lib/prayer";
import type { WidgetExtras } from "./extras";

/** أحداث تغيّر هذه البيانات — تعيد `WidgetSync` بناء اللقطة عندها. */
export const WIDGET_EXTRAS_EVENTS: string[] = [];

export async function buildWidgetExtras(_input: {
  location: LocationState;
  settings: Settings;
  from: Date;
  hijriAdjust: number;
}): Promise<WidgetExtras | undefined> {
  return undefined;
}
