import { describe, expect, it } from "vitest";
import { buildWidgetSnapshot } from "@/lib/widget-snapshot";
import { normalizeSettings, type LocationState } from "@/lib/prayer";
import { NOW_WINDOW_MS, widgetMetaLine, widgetProgress, widgetState } from "@/lib/widgets/state";
import { DEFAULT_WIDGET_OPTIONS } from "@/lib/widget-settings";

const SANAA: LocationState = { lat: 15.3694, lng: 44.191, city: "صنعاء", source: "manual" };

const snap = buildWidgetSnapshot({
  location: SANAA,
  settings: normalizeSettings({}),
  from: new Date(2026, 8, 23, 1),
  days: 10,
  iqama: (p, at) => (p === "isha" ? new Date(at.getTime() + 10 * 60_000) : null),
});
const today = snap.days[0];
const at = (k: string) => today.prayers.find((p) => p.key === k)!.at;

describe("حالة الويدجت", () => {
  it("قبل الظهر: الظهر قادمة والتقدّم من الفجر (الشروق ليس صلاة)", () => {
    const now = at("dhuhr") - 60 * 60_000;
    const s = widgetState(snap, now)!;
    expect(s.phase).toBe("next");
    expect(s.prayer.key).toBe("dhuhr");
    expect(s.from).toBe(at("fajr"));
    const pr = widgetProgress(s, now);
    expect(pr).toBeGreaterThan(0);
    expect(pr).toBeLessThan(1);
  });

  it("بعد الأذان مباشرة: «حان الآن» ربع ساعة ثم الصلاة التالية", () => {
    expect(widgetState(snap, at("asr") + 60_000)!.phase).toBe("now");
    const later = widgetState(snap, at("asr") + NOW_WINDOW_MS + 1000)!;
    expect(later.phase).toBe("next");
    expect(later.prayer.key).toBe("maghrib");
  });

  it("الإقامة: عدّ لها حتى موعدها", () => {
    const s = widgetState(snap, at("isha") + 2 * 60_000)!;
    expect(s.phase).toBe("iqama");
    expect(s.target).toBe(at("isha") + 10 * 60_000);
  });

  it("بعد العشاء: فجر الغد", () => {
    const s = widgetState(snap, at("isha") + 3 * 60 * 60_000)!;
    expect(s.prayer.key).toBe("fajr");
    expect(s.prayer.at).toBe(snap.days[1].prayers[0].at);
  });

  it("سطر التعريف وتنبيه التجديد قرب نفاد الأيام", () => {
    const s = widgetState(snap, at("dhuhr") - 1000)!;
    expect(widgetMetaLine(s, DEFAULT_WIDGET_OPTIONS, "صنعاء")).toContain("صنعاء");
    expect(widgetMetaLine(s, { hijri: false, season: false, city: false }, "صنعاء")).toBeNull();
    const late = widgetState(snap, snap.days[7].prayers[2].at - 1000)!;
    expect(widgetMetaLine(late, DEFAULT_WIDGET_OPTIONS, "صنعاء")).toBe("افتح منار لتجديد المواقيت");
  });

  it("خارج نطاق اللقطة: لا حالة", () => {
    expect(widgetState(snap, snap.days[9].prayers[5].at + 10 * 3600_000)).toBeNull();
  });

  it("مع الحساب الأصلي: الأيام المتبقية حتى نهاية المدى فلا تنبيه تجديد", () => {
    const short = buildWidgetSnapshot({
      location: SANAA,
      settings: normalizeSettings({}),
      from: new Date(2026, 8, 23, 1),
      days: 3,
      iqamaOffset: () => null,
      calcDays: 30,
    });
    const s = widgetState(short, short.days[2].prayers[2].at - 60_000)!;
    expect(s.daysLeft).toBe(27);
    expect(widgetMetaLine(s, DEFAULT_WIDGET_OPTIONS, short.city)).not.toContain("افتح منار");
    const old = widgetState({ ...short, calc: undefined }, short.days[2].prayers[2].at - 60_000)!;
    expect(old.daysLeft).toBe(0);
  });
});
