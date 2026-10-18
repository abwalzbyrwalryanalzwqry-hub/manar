/**
 * حالة الويدجت في لحظة — نقل حرفي لـ WidgetData.state() في الأصلي، لتطابق
 * معاينة صفحة الويدجتات ما يظهر على الشاشة الرئيسية تماماً.
 */
import type { WidgetDay, WidgetPrayer, WidgetSnapshot } from "@/lib/widget-snapshot";
import type { WidgetOptions } from "@/lib/widget-settings";

export const NOW_WINDOW_MS = 15 * 60_000;

export type WidgetPhase = "next" | "now" | "iqama";

export interface WidgetState {
  today: WidgetDay;
  phase: WidgetPhase;
  prayer: WidgetPrayer;
  from: number;
  target: number;
  hijri: string;
  daysLeft: number;
}

function dayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function widgetState(snap: WidgetSnapshot, now: number): WidgetState | null {
  const idx = snap.days.findIndex((d) => d.date === dayKey(now));
  if (idx < 0) return null;
  const today = snap.days[idx];
  const line: WidgetPrayer[] = [];
  for (let i = Math.max(0, idx - 1); i <= Math.min(snap.days.length - 1, idx + 1); i++) {
    for (const p of snap.days[i].prayers) if (p.key !== "sunrise") line.push(p);
  }
  let current: WidgetPrayer | null = null;
  let next: WidgetPrayer | null = null;
  for (const p of line) {
    if (p.at <= now) current = p;
    else {
      next = p;
      break;
    }
  }
  let prev: WidgetPrayer | null = null;
  for (const p of line) if (current && p.at < current.at) prev = p;

  const evening = today.hijriFrom != null && now >= today.hijriFrom && !!today.hijriEvening;
  const hijri = evening ? today.hijriEvening! : today.hijri;
  /* مع الحساب الأصلي يستمر الويدجت حتى `calc.until` (كما في WidgetData.java). */
  const daysLeft = snap.calc
    ? Math.max(0, Math.round((Date.parse(snap.calc.until) - Date.parse(today.date)) / 86_400_000))
    : snap.days.length - 1 - idx;

  if (current) {
    const iq = current.iq ?? 0;
    const nowEnd = iq > current.at ? Math.max(iq, current.at + 60_000) : current.at + NOW_WINDOW_MS;
    if (now < nowEnd) {
      const pending = iq > now;
      return {
        today,
        phase: pending ? "iqama" : "now",
        prayer: current,
        from: current.at,
        target: pending ? iq : nowEnd,
        hijri,
        daysLeft,
      };
    }
  }
  if (!next) return null;
  return {
    today,
    phase: "next",
    prayer: next,
    from: current ? current.at : prev ? prev.at : now,
    target: next.at,
    hijri,
    daysLeft,
  };
}

export function widgetProgress(s: WidgetState, now: number): number {
  if (s.target <= s.from) return 0;
  return Math.max(0, Math.min(1, (now - s.from) / (s.target - s.from)));
}

/** سطر الهجري/الموسم · المدينة — مطابق لـ WidgetRender.metaLine. */
export function widgetMetaLine(
  s: WidgetState,
  o: Pick<WidgetOptions, "season" | "hijri" | "city">,
  city: string,
): string | null {
  if (s.daysLeft >= 0 && s.daysLeft <= 4) return "افتح منار لتجديد المواقيت";
  const parts: string[] = [];
  if (o.season && s.today.season) parts.push(s.today.season);
  else if (o.hijri && s.hijri) parts.push(s.hijri);
  if (o.city && city) parts.push(city);
  return parts.length ? parts.join("، ") : null;
}
