/**
 * الأيام التي يولّدها الويدجت أصلياً بعد نهاية اللقطة يجب أن تطابق ما كان
 * الويب سيحسبه. يبني الاختبار لقطة قصيرة بـ`calc` ولقطة طويلة مرجعية، ويحفظهما
 * في ملف يقرؤه `WidgetCalcTest.java`. التحديث: `UPDATE_GOLDEN=1`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildWidgetCalc, buildWidgetSnapshot, type WidgetSnapshot } from "@/lib/widget-snapshot";
import { EMPTY_OFFSETS, type LocationState, type PrayerKey, type Settings } from "@/lib/prayer";
import { formatHijriAr } from "@/lib/format";
import { toHijri } from "@/lib/hijri";

const FILE = "android/app/src/test/resources/widget/extend.json";
const TZ = "Asia/Aden";
const ORIGINAL_TZ = process.env.TZ;

const location = { lat: 15.3694, lng: 44.191, city: "صنعاء" } as LocationState;
const settings: Settings = {
  method: "UmmAlQura",
  madhab: "shafi",
  offsets: EMPTY_OFFSETS,
  dstOffset: 0,
};
const OFF: Partial<Record<PrayerKey, number>> = {
  fajr: 20,
  dhuhr: 15,
  asr: 15,
  maghrib: 10,
  isha: 15,
};
const JUMUA = 30;

const iqama = (p: PrayerKey, at: Date) => {
  const m = p === "dhuhr" && at.getDay() === 5 ? JUMUA : OFF[p];
  return m ? new Date(at.getTime() + m * 60_000) : null;
};
const iqamaOffset = (p: PrayerKey, friday: boolean) =>
  p === "dhuhr" && friday ? JUMUA : (OFF[p] ?? null);

function build() {
  /* قبل رمضان ١٤٤٨ بأسبوعين: الأيام المولَّدة تعبر بداية الشهر (عشاء ١٢٠ دقيقة). */
  const from = new Date(2027, 0, 25, 12);
  const common = {
    location,
    settings,
    from,
    hijriAdjust: 0,
    hijriAtMaghrib: true,
    iqama,
    now: 0,
    display: { digits: "arab" as const, clock: "12" as const },
  };
  const short = buildWidgetSnapshot({ ...common, days: 10, iqamaOffset, calcDays: 60 });
  const full = buildWidgetSnapshot({ ...common, days: 40 });
  return { tz: TZ, short, full };
}

describe("توليد الأيام أصلياً بعد اللقطة", () => {
  beforeAll(() => {
    process.env.TZ = TZ;
  });
  afterAll(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it("جدول الأشهر الهجرية يطابق التقويم يوماً بيوم", () => {
    const from = new Date(2027, 0, 25, 12);
    const calc = buildWidgetCalc({
      location,
      settings,
      from,
      hijriAdjust: 0,
      hijriAtMaghrib: false,
      days: 120,
    });
    expect(calc.hijri.length).toBeGreaterThanOrEqual(4);
    expect(calc.until).toBe("2027-05-24");
    for (let i = 0; i < 120; i += 1) {
      const date = new Date(2027, 0, 25 + i, 12);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const mark = [...calc.hijri].reverse().find((m) => m.from <= key)!;
      const days = Math.round((Date.parse(key) - Date.parse(mark.from)) / 86_400_000);
      const h = toHijri(date, 0);
      expect([mark.d + days, mark.n, mark.y]).toEqual([h.day, h.month, h.year]);
      /* الصيغة التي يركّبها الأصلي = صيغة الويب. */
      expect(
        `${mark.d + days} ${mark.mf ?? mark.m} ${mark.y} هـ`.replace(
          /\d/g,
          (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)],
        ),
      ).toBe(formatHijriAr(date, 0));
    }
  });

  it("فواصل الإقامة والمعاملات في اللقطة", () => {
    const { short } = build();
    expect(short.calc?.iq).toEqual([20, 15, 15, 10, 15]);
    expect(short.calc?.jumua).toBe(30);
    expect(short.calc?.spec.ramadanIsha).toBe(true);
    expect(short.calc?.hm).toBe(true);
  });

  it("الملف المرجعي لاختبار JVM محدَّث", () => {
    const fresh = build();
    if (process.env.UPDATE_GOLDEN || !existsSync(FILE))
      writeFileSync(FILE, JSON.stringify(fresh) + "\n");
    const saved = JSON.parse(readFileSync(FILE, "utf8")) as {
      short: WidgetSnapshot;
      full: WidgetSnapshot;
    };
    expect(saved).toEqual(JSON.parse(JSON.stringify(fresh)));
    /* رمضان داخل الأيام المولَّدة. */
    expect(saved.full.days.slice(10).some((d) => d.hp.m === "رمضان")).toBe(true);
  });
});
