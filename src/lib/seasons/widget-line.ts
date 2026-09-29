/* مواسم منار — سطر الموسم في ويدجت الشاشة الرئيسية (٤.٧).
 *
 * «اليوم ١٢ من رمضان · الإفطار ٦:٢١ م». للمواسم السنوية وحدها (الجمعة
 * والبيض لا تزاحم التاريخ الهجري)، والقادم خلال ثلاثة أيام. */

import { seasonsOverview } from "./engine";
import { statusLine } from "./labels";

export function widgetSeasonLine(date: Date, adjust: number, iftar?: string): string | undefined {
  const ov = seasonsOverview(date, adjust);
  const st =
    ov.current.find((s) => s.instance.season.cycle.kind === "annual") ??
    ov.around.find(
      (s) =>
        s.status === "upcoming" && s.instance.season.cycle.kind === "annual" && s.daysUntil <= 3,
    );
  if (!st) return undefined;
  const line = statusLine(st).replace(/\.$/, "");
  const fasting = st.status === "current" && st.instance.season.id === "ramadan";
  return fasting && iftar ? `${line} · الإفطار ${iftar}` : line;
}
