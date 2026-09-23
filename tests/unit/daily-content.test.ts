import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DAILY_VERSES,
  dailyIndex,
  dailyVerseRef,
  estimateRecitationSeconds,
  formatSecondsAr,
  localDayNumber,
  pickDailyHadith,
  type DailyHadith,
} from "@/lib/daily-content";
import { SURAH_META } from "@/lib/quran/metadata";

describe("اليوم المحلي", () => {
  it("يتغيّر عند منتصف الليل المحلي لا UTC", () => {
    const before = new Date(2026, 8, 23, 23, 59);
    const after = new Date(2026, 8, 24, 0, 1);
    expect(localDayNumber(after) - localDayNumber(before)).toBe(1);
    expect(localDayNumber(new Date(2026, 8, 23, 0, 1))).toBe(localDayNumber(before));
  });
});

describe("التدوير اليومي", () => {
  it("يمرّ على كل العناصر مرة واحدة في كل دورة", () => {
    const n = DAILY_VERSES.length;
    const seen = new Set<number>();
    for (let d = 0; d < n; d += 1) seen.add(dailyIndex(20_000 + d, n, 37));
    expect(seen.size).toBe(n);
  });

  it("لا يكرّر آية اليوم في يومين متتاليين", () => {
    for (let d = 20_000; d < 20_400; d += 1) {
      expect(dailyVerseRef(d)).not.toEqual(dailyVerseRef(d + 1));
    }
  });

  it("كل آيات القائمة مراجع صحيحة في المصحف", () => {
    for (const [s, from, to] of DAILY_VERSES) {
      const meta = SURAH_META[s - 1];
      expect(meta, `سورة ${s}`).toBeDefined();
      expect(from).toBeGreaterThanOrEqual(1);
      expect(to ?? from).toBeLessThanOrEqual(meta!.ayatCount);
    }
  });

  it("حديث اليوم يعمل مع الملف المضمَّن", () => {
    const file = JSON.parse(readFileSync("public/data/hadith/daily.json", "utf8")) as {
      items: DailyHadith[];
    };
    expect(file.items.length).toBeGreaterThan(50);
    const ids = new Set(file.items.map((h) => h.id));
    expect(ids.size).toBe(file.items.length);
    for (let d = 20_000; d < 20_100; d += 1) {
      const h = pickDailyHadith(file.items, d);
      expect(h.text.length).toBeGreaterThan(0);
      expect(pickDailyHadith(file.items, d + 1).id).not.toBe(h.id);
    }
  });
});

describe("مدة التلاوة", () => {
  it("لا تقل عن ٥ ثوانٍ وتُقرَّب لمضاعفات ٥", () => {
    expect(estimateRecitationSeconds("قل")).toBe(5);
    const s = estimateRecitationSeconds(Array(80).fill("كلمة").join(" "));
    expect(s % 5).toBe(0);
    expect(s).toBe(50);
  });
  it("صياغة عربية سليمة", () => {
    expect(formatSecondsAr(5)).toBe("٥ ثوانٍ");
    expect(formatSecondsAr(45)).toBe("٤٥ ثانية");
    expect(formatSecondsAr(60)).toBe("دقيقة");
    expect(formatSecondsAr(130)).toBe("دقيقتان و١٠ ثوانٍ");
  });
});
