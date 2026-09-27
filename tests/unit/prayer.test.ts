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

describe("المواقيت تتغيّر مع الأيام وتطابق المراجع", () => {
  const settings = normalizeSettings({});
  const at = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 9));
  const clock = (d: Date) => {
    const v = hm(d);
    return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
  };

  it("تطابق تقويم أم القرى لصنعاء (AlAdhan، ٢٨ سبتمبر ٢٠٢٦) ضمن دقيقة", () => {
    const t = computePrayerTimes(SANAA, settings, at(2026, 9, 28), 0);
    const ref = {
      fajr: "04:39",
      sunrise: "05:53",
      dhuhr: "11:54",
      asr: "15:16",
      maghrib: "17:55",
      isha: "19:25",
    };
    for (const k of PRAYER_ORDER) {
      const [h, m] = ref[k].split(":").map(Number);
      expect(Math.abs(hm(t[k]) - (h * 60 + m))).toBeLessThanOrEqual(1);
    }
  });

  it("الفجر يتقدّم صيفاً ويتأخّر شتاءً — لا وقت ثابت", () => {
    const winter = computePrayerTimes(SANAA, settings, at(2026, 1, 15), 0);
    const summer = computePrayerTimes(SANAA, settings, at(2026, 6, 21), 0);
    expect(clock(winter.fajr)).toBe("05:15");
    expect(clock(summer.fajr)).toBe("04:11");
    // يومان متتاليان يختلفان أيضاً
    const a = computePrayerTimes(SANAA, settings, at(2026, 9, 28), 0);
    const b = computePrayerTimes(SANAA, settings, at(2026, 9, 29), 0);
    expect(hm(a.maghrib)).not.toBe(hm(b.maghrib));
  });

  it("أم القرى في رمضان: العشاء بعد المغرب بـ١٢٠ دقيقة، وخارجه ٩٠", () => {
    const ramadan = computePrayerTimes(SANAA, settings, at(2026, 2, 20), 0);
    expect(mins(ramadan.isha, ramadan.maghrib)).toBe(120);
    const normal = computePrayerTimes(SANAA, settings, at(2026, 9, 28), 0);
    expect(mins(normal.isha, normal.maghrib)).toBe(90);
    // الطرق الأخرى لا تتأثر برمضان
    const mwl = computePrayerTimes(
      SANAA,
      normalizeSettings({ method: "MuslimWorldLeague" }),
      at(2026, 2, 20),
      0,
    );
    expect(mins(mwl.isha, mwl.maghrib)).toBeLessThan(90);
  });

  it("الدائرة القطبية: مواقيت صالحة صيفاً بدل «تاريخ غير صالح»", () => {
    const tromso: LocationState = { lat: 69.65, lng: 18.96, city: "ترومسو", source: "manual" };
    const t = computePrayerTimes(
      tromso,
      normalizeSettings({ method: "MuslimWorldLeague" }),
      at(2026, 6, 21),
      0,
    );
    for (const k of PRAYER_ORDER) expect(Number.isNaN(t[k].getTime())).toBe(false);
  });
});
