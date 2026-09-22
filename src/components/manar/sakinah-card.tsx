/* منار — بطاقة «سكينة» في الرئيسية.
 *
 * زرّ الحالة يُفعّل الميزة ويُعطّلها في نقرة، والنقر على البطاقة نفسها يفتح
 * الصفحة الكاملة. الفصل بينهما مقصود: من أراد الإسكات الآن لا يُجبَر على
 * المرور بصفحة إعدادات.
 */

import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { Icon, icons } from "@/components/manar/shell";
import { formatHHMM, toArabicDigits } from "@/lib/format";
import { useLocation, useNow, useSettings } from "@/lib/prayer";
import {
  activePrayerCount,
  computeSakinahWindows,
  currentWindow,
  nextWindow,
  useSakinah,
} from "@/lib/sakinah";

export function SakinahCard({ nextPrayerLabel }: { nextPrayerLabel: string }) {
  const { settings, update } = useSakinah();
  const { location } = useLocation();
  const { settings: calc } = useSettings();
  /* نصف دقيقة تكفي لبطاقة حالة — لا حاجة لنبضة كل ثانية تستهلك البطارية. */
  const now = useNow(30_000);

  const windows = useMemo(
    () => computeSakinahWindows(settings, location, calc, 2, new Date()),
    [settings, location, calc],
  );

  const nowMs = now.getTime();
  const active = nowMs > 0 ? currentWindow(windows, nowMs) : null;
  const upcoming = nowMs > 0 ? nextWindow(windows, nowMs) : null;

  const statusLine = !settings.enabled
    ? `${toArabicDigits(activePrayerCount(settings))} صلوات جاهزة للإسكات`
    : active
      ? `🤫 الهدوء فعال · حتى ${formatHHMM(new Date(active.end))}`
      : upcoming
        ? `الصلاة القادمة: ${upcoming.label} · يبدأ الهدوء ${formatHHMM(new Date(upcoming.start))}`
        : `الصلاة القادمة: ${nextPrayerLabel}`;

  return (
    <div className="flex items-center gap-3 rounded-[24px] border border-border bg-card p-4 shadow-soft">
      <Link to="/sakinah" className="flex min-w-0 flex-1 items-center gap-3 text-right">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            active
              ? "gradient-primary text-primary-foreground shadow-glow"
              : "bg-secondary text-primary"
          }`}
        >
          <Icon d={icons.moon} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">سكينة</span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {statusLine}
          </span>
        </span>
      </Link>

      <button
        onClick={() => update({ enabled: !settings.enabled })}
        role="switch"
        aria-checked={settings.enabled}
        aria-label="تفعيل سكينة"
        className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
          settings.enabled
            ? "gradient-primary border-transparent text-primary-foreground shadow-glow"
            : "border-border bg-card text-muted-foreground"
        }`}
      >
        {settings.enabled ? "مفعلة" : "غير مفعلة"}
      </button>
    </div>
  );
}
