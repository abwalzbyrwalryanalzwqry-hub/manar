import { describe, expect, it } from "vitest";
import {
  currentStreak,
  dayKey,
  prayerDayKey,
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

describe("فصول الأذكار المكتملة اليوم", () => {
  const store = new Map<string, string>();
  const stubWindow = () =>
    ({
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
      dispatchEvent: () => true,
    }) as unknown as Window & typeof globalThis;

  it("يُسجَّل الإكمال بوقته، ويبقى الوقت الأول، ويُحذف عند التصفير", async () => {
    const g = globalThis as { window?: unknown };
    const prev = g.window;
    g.window = stubWindow();
    try {
      const { readLog, syncAzkarChapters } = await import("@/lib/activity-log");
      const t1 = new Date(2026, 8, 24, 6, 0).getTime();
      const key = dayKey(new Date(t1));
      syncAzkarChapters([27], t1);
      expect(readLog().days[key].chapters).toEqual({ "27": t1 });
      syncAzkarChapters([27, 28], t1 + 1000);
      expect(readLog().days[key].chapters).toEqual({ "27": t1, "28": t1 + 1000 });
      syncAzkarChapters([28], t1 + 2000);
      expect(readLog().days[key].chapters).toEqual({ "28": t1 + 1000 });
      syncAzkarChapters([], t1 + 3000);
      expect(readLog().days[key].chapters).toBeUndefined();
    } finally {
      g.window = prev;
    }
  });

  it("قيم الفصول الفاسدة في التخزين تُهمل", async () => {
    const g = globalThis as { window?: unknown };
    const prev = g.window;
    g.window = stubWindow();
    try {
      store.set(
        "manar.activity.v1",
        JSON.stringify({
          days: { "2026-09-24": { wird: [], chapters: { "27": "x", "28": 5, abc: 1, "29": -1 } } },
          bestStreak: 0,
        }),
      );
      const { readLog } = await import("@/lib/activity-log");
      expect(readLog().days["2026-09-24"].chapters).toEqual({ "28": 5 });
    } finally {
      g.window = prev;
    }
  });
});

describe("prayerDayKey — يوم الصلاة من الفجر إلى الفجر", () => {
  const fajr = new Date(2026, 8, 28, 4, 30);

  it("قبل فجر اليوم يُنسب التسجيل إلى الأمس", () => {
    expect(prayerDayKey(new Date(2026, 8, 28, 0, 40), fajr)).toBe("2026-09-27");
    expect(prayerDayKey(new Date(2026, 8, 28, 4, 29), fajr)).toBe("2026-09-27");
  });

  it("من الفجر فصاعداً هو اليوم نفسه", () => {
    expect(prayerDayKey(new Date(2026, 8, 28, 4, 30), fajr)).toBe("2026-09-28");
    expect(prayerDayKey(new Date(2026, 8, 28, 23, 59), fajr)).toBe("2026-09-28");
  });

  it("بلا فجر أو بفجر يوم آخر يرجع إلى التاريخ الميلادي", () => {
    const now = new Date(2026, 8, 28, 1, 0);
    expect(prayerDayKey(now)).toBe("2026-09-28");
    expect(prayerDayKey(now, null)).toBe("2026-09-28");
    expect(prayerDayKey(now, new Date(2026, 8, 29, 4, 30))).toBe("2026-09-28");
    expect(prayerDayKey(now, new Date(Number.NaN))).toBe("2026-09-28");
  });

  it("عبر حدّ الشهر والسنة", () => {
    const f = new Date(2027, 0, 1, 5, 0);
    expect(prayerDayKey(new Date(2027, 0, 1, 1, 0), f)).toBe("2026-12-31");
  });
});
