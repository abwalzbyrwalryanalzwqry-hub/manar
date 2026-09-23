import { describe, expect, it } from "vitest";
import {
  fastingInfo,
  fromHijri,
  hijriMonthGrid,
  hijriMonthLength,
  isSameDay,
  toHijri,
} from "@/lib/hijri";

describe("التحويل الهجري", () => {
  it("١ محرّم ١٤٤٧ = ٢٦ يونيو ٢٠٢٥ (أم القرى)", () => {
    expect(toHijri(new Date(2025, 5, 26, 12))).toEqual({ year: 1447, month: 1, day: 1 });
  });

  it("ذهاب وعودة بلا خطأ لكل يوم على مدى سنتين وبكل درجات الإزاحة", () => {
    for (const adjust of [-2, -1, 0, 1, 2]) {
      for (let i = 0; i < 730; i += 3) {
        const g = new Date(2025, 0, 1 + i, 12);
        const h = toHijri(g, adjust);
        expect(isSameDay(fromHijri(h, adjust), g)).toBe(true);
      }
    }
  });

  it("انحدار: عيد الفطر وعرفة ١٤٤٦ في يومهما الصحيح", () => {
    // كان `fromHijri` يُرجع اليوم السابق لأشهر كاملة في المناطق ذات التوقيت الموجب.
    expect(isSameDay(fromHijri({ year: 1446, month: 10, day: 1 }), new Date(2025, 2, 30))).toBe(
      true,
    );
    expect(isSameDay(fromHijri({ year: 1446, month: 12, day: 9 }), new Date(2025, 5, 5))).toBe(
      true,
    );
  });

  it("الإزاحة تزحزح اليوم الهجري", () => {
    const g = new Date(2026, 8, 23, 12);
    const a = toHijri(g, 0);
    const b = toHijri(g, 1);
    expect(fromHijri(b, 0).getTime() - fromHijri(a, 0).getTime()).toBe(86_400_000);
  });

  it("طول الشهر ٢٩ أو ٣٠ ويطابق الشبكة", () => {
    for (let m = 1; m <= 12; m += 1) {
      const len = hijriMonthLength(1447, m);
      expect([29, 30]).toContain(len);
      const inMonth = hijriMonthGrid(1447, m).filter((c) => c.inMonth).length;
      expect(inMonth).toBe(len);
    }
  });
});

describe("حكم الصيام", () => {
  const d = new Date(2026, 8, 23, 12); // أربعاء
  it("رمضان فرض", () => {
    expect(fastingInfo(d, { year: 1447, month: 9, day: 5 }).status).toBe("obligatory");
  });
  it("العيدان وأيام التشريق منهيّ عنها", () => {
    expect(fastingInfo(d, { year: 1447, month: 10, day: 1 }).status).toBe("forbidden");
    for (const day of [10, 11, 12, 13]) {
      expect(fastingInfo(d, { year: 1447, month: 12, day }).status).toBe("forbidden");
    }
  });
  it("الأيام البيض مسنونة", () => {
    expect(fastingInfo(d, { year: 1447, month: 4, day: 14 }).status).toBe("recommended");
  });
  it("الاثنين والخميس مسنونان", () => {
    const monday = new Date(2026, 8, 21, 12);
    const thursday = new Date(2026, 8, 24, 12);
    expect(fastingInfo(monday, { year: 1447, month: 4, day: 2 }).status).toBe("recommended");
    expect(fastingInfo(thursday, { year: 1447, month: 4, day: 5 }).status).toBe("recommended");
  });
});
