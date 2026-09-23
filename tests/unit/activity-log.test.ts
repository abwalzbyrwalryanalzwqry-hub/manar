import { describe, expect, it } from "vitest";
import {
  currentStreak,
  dayKey,
  rangeStats,
  shiftDayKey,
  type ActivityLog,
  type DayRecord,
} from "@/lib/activity-log";

const day = (p: Partial<DayRecord> = {}): DayRecord => ({
  prayers: [],
  ayahs: 0,
  azkar: 0,
  wird: [],
  ...p,
});

describe("مفاتيح الأيام", () => {
  it("بالتوقيت المحلي", () => {
    expect(dayKey(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
  });
  it("الإزاحة تعبر حدود الشهر والسنة", () => {
    expect(shiftDayKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDayKey("2025-12-31", 1)).toBe("2026-01-01");
  });
});

describe("السلسلة", () => {
  const today = "2026-09-23";
  it("تُحسب حتى اليوم", () => {
    const log: ActivityLog = {
      bestStreak: 0,
      days: {
        "2026-09-21": day({ ayahs: 3 }),
        "2026-09-22": day({ prayers: ["fajr"] }),
        "2026-09-23": day({ wird: ["morning"] }),
      },
    };
    expect(currentStreak(log, today)).toBe(3);
  });
  it("لا تنقطع صباحاً قبل بدء العمل", () => {
    const log: ActivityLog = { bestStreak: 0, days: { "2026-09-22": day({ azkar: 1 }) } };
    expect(currentStreak(log, today)).toBe(1);
  });
  it("تنقطع بعد يوم فارغ", () => {
    const log: ActivityLog = { bestStreak: 0, days: { "2026-09-21": day({ azkar: 1 }) } };
    expect(currentStreak(log, today)).toBe(0);
  });
});

describe("إحصاء المدى", () => {
  it("يجمع الأسبوع ونسبة الصلوات", () => {
    const log: ActivityLog = {
      bestStreak: 0,
      days: {
        "2026-09-23": day({ prayers: ["fajr", "dhuhr", "asr", "maghrib", "isha"], ayahs: 10 }),
        "2026-09-20": day({ prayers: ["fajr"], wird: ["morning", "evening"] }),
        "2026-09-10": day({ prayers: ["fajr"] }), // خارج المدى
      },
    };
    const s = rangeStats(log, 7, "2026-09-23");
    expect(s.prayers).toBe(6);
    expect(s.prayersPossible).toBe(35);
    expect(s.ayahs).toBe(10);
    expect(s.wird).toBe(2);
    expect(s.activeDays).toBe(2);
    expect(s.prayerRatio).toBeCloseTo(6 / 35);
  });
});
