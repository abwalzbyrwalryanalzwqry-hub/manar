import { describe, expect, it } from "vitest";
import {
  EMPTY_OFFSETS,
  PRAYER_ORDER,
  computePrayerTimes,
  normalizeSettings,
  pickNextPrayer,
  qiblaBearing,
  type LocationState,
} from "@/lib/prayer";

const SANAA: LocationState = { lat: 15.3694, lng: 44.191, city: "صنعاء", source: "manual" };
const MAKKAH = { lat: 21.4225, lng: 39.8262 };
const DAY = new Date(Date.UTC(2026, 8, 23, 9)); // ٢٣ سبتمبر ٢٠٢٦ ظهراً بتوقيت صنعاء

/** الدقائق منذ منتصف الليل بتوقيت صنعاء (UTC+3) — مستقلة عن منطقة جهاز الاختبار. */
const hm = (d: Date) => ((d.getUTCHours() + 3) % 24) * 60 + d.getUTCMinutes();
const mins = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 60_000);

describe("مواقيت الصلاة", () => {
  const settings = normalizeSettings({});

  it("تأتي الصلوات بالترتيب الصحيح", () => {
    const t = computePrayerTimes(SANAA, settings, DAY);
    for (let i = 1; i < PRAYER_ORDER.length; i += 1) {
      expect(t[PRAYER_ORDER[i]].getTime()).toBeGreaterThan(t[PRAYER_ORDER[i - 1]].getTime());
    }
  });

  it("أوقات صنعاء ضمن نطاقات معقولة", () => {
    const t = computePrayerTimes(SANAA, settings, DAY);
    expect(hm(t.fajr)).toBeGreaterThan(4 * 60);
    expect(hm(t.fajr)).toBeLessThan(5 * 60);
    expect(hm(t.dhuhr)).toBeGreaterThan(11 * 60 + 50);
    expect(hm(t.dhuhr)).toBeLessThan(12 * 60 + 15);
    expect(hm(t.maghrib)).toBeGreaterThan(17 * 60 + 50);
    expect(hm(t.maghrib)).toBeLessThan(18 * 60 + 20);
  });

  it("الإزاحة اليدوية تُطبَّق على الصلاة المعنية وحدها", () => {
    const base = computePrayerTimes(SANAA, settings, DAY);
    const shifted = computePrayerTimes(
      SANAA,
      { ...settings, offsets: { ...EMPTY_OFFSETS, asr: 5 } },
      DAY,
    );
    expect(mins(shifted.asr, base.asr)).toBe(5);
    expect(shifted.dhuhr.getTime()).toBe(base.dhuhr.getTime());
  });

  it("إزاحة التوقيت الصيفي تُقدّم كل الأوقات ساعة", () => {
    const base = computePrayerTimes(SANAA, settings, DAY);
    const dst = computePrayerTimes(SANAA, { ...settings, dstOffset: 1 }, DAY);
    for (const k of PRAYER_ORDER) expect(mins(dst[k], base[k])).toBe(60);
  });

  it("تختار الصلاة القادمة والحالية", () => {
    const t = computePrayerTimes(SANAA, settings, DAY);
    const justAfterDhuhr = new Date(t.dhuhr.getTime() + 60_000);
    const { current, next } = pickNextPrayer(t, justAfterDhuhr);
    expect(current.key).toBe("dhuhr");
    expect(next?.key).toBe("asr");
  });

  it("لا صلاة قادمة بعد العشاء في اليوم نفسه", () => {
    const t = computePrayerTimes(SANAA, settings, DAY);
    const late = new Date(t.isha.getTime() + 60_000);
    expect(pickNextPrayer(t, late).next).toBeUndefined();
  });

  it("إعدادات تالفة تُستبدل بالقيم الافتراضية", () => {
    const s = normalizeSettings({ method: "???", offsets: { fajr: 9999 } });
    expect(typeof s.method).toBe("string");
    expect(Math.abs(s.offsets.fajr)).toBeLessThanOrEqual(60);
  });
});

describe("اتجاه القبلة", () => {
  it("من صنعاء ≈ ٣٢٦° (شمال غرب)", () => {
    const b = qiblaBearing(SANAA);
    expect(b).toBeGreaterThan(320);
    expect(b).toBeLessThan(330);
  });
  it("من مكة لا يعطي قيمة غير عددية", () => {
    expect(Number.isFinite(qiblaBearing({ lat: MAKKAH.lat + 0.01, lng: MAKKAH.lng }))).toBe(true);
  });
});
