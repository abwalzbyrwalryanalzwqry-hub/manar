import { beforeEach, describe, expect, it } from "vitest";
import {
  monthBars,
  monthHeatmap,
  readLog,
  setDayPrayers,
  type ActivityLog,
} from "@/lib/activity-log";
import { adjustQada, DEFAULT_QADA, makeUpQada, normalizeQada, qadaTotal } from "@/lib/qada";
import { formatPercent } from "@/lib/format";
import { __setDisplayForTests, DEFAULT_DISPLAY } from "@/lib/display-prefs";

const day = (prayers: string[]) => ({ prayers, ayahs: 0, azkar: 0, wird: [] }) as never;

describe("خريطة الشهر", () => {
  const log: ActivityLog = {
    bestStreak: 0,
    days: {
      "2026-09-01": day(["fajr", "dhuhr", "asr", "maghrib", "isha"]),
      "2026-09-02": day(["fajr"]),
    },
  };

  it("تبدأ بالسبت، وتعلّم اليوم والأيام القادمة", () => {
    const cells = monthHeatmap(log, 2026, 9, "2026-09-28");
    // ١ سبتمبر ٢٠٢٦ ثلاثاء: سبت أحد اثنين فارغة
    expect(cells.slice(0, 3)).toEqual([null, null, null]);
    const real = cells.filter(Boolean);
    expect(real).toHaveLength(30);
    expect(real[0]).toMatchObject({ key: "2026-09-01", ratio: 1, prayers: 5, future: false });
    expect(real[1]!.ratio).toBeCloseTo(0.2);
    expect(real[27]!.isToday).toBe(true);
    expect(real[28]!.future).toBe(true);
  });

  it("السنة: ١٢ شهراً، والشهر الحالي على ما مضى منه فقط", () => {
    const m = monthBars(log, 12, "2026-09-02");
    expect(m).toHaveLength(12);
    expect(m[0]).toMatchObject({ year: 2025, month: 10 });
    expect(m[11]).toMatchObject({ year: 2026, month: 9, prayers: 6 });
    expect(m[11].ratio).toBeCloseTo(6 / 10);
  });
});

describe("تسجيل يوم سابق", () => {
  const store = new Map<string, string>();
  const g = globalThis as { window?: unknown };
  beforeEach(() => {
    store.clear();
    g.window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
      dispatchEvent: () => true,
    };
    return () => {
      delete g.window;
    };
  });

  it("يضبط صلوات اليوم كما اختيرت، ويرفض الأيام القادمة", () => {
    expect(setDayPrayers("2026-09-20", ["fajr", "isha"], "2026-09-28")).toBe(true);
    expect(readLog().days["2026-09-20"].prayers.sort()).toEqual(["fajr", "isha"]);
    expect(setDayPrayers("2026-09-20", ["dhuhr"], "2026-09-28")).toBe(true);
    expect(readLog().days["2026-09-20"].prayers).toEqual(["dhuhr"]);
    expect(setDayPrayers("2026-10-01", ["fajr"], "2026-09-28")).toBe(false);
    expect(readLog().days["2026-10-01"]).toBeUndefined();
  });
});

describe("عدّاد القضاء", () => {
  it("مطفأ افتراضياً، ولا يقل عن الصفر", () => {
    expect(DEFAULT_QADA.enabled).toBe(false);
    const s = adjustQada(adjustQada(DEFAULT_QADA, "fajr", 3), "isha", -1);
    expect(s.remaining.fajr).toBe(3);
    expect(s.remaining.isha).toBe(0);
    expect(qadaTotal(s)).toBe(3);
  });

  it("«قضيت» يطرح ويحسب، ولا يفعل شيئاً عند الصفر", () => {
    let s = adjustQada(DEFAULT_QADA, "asr", 1);
    s = makeUpQada(s, "asr");
    expect(s.remaining.asr).toBe(0);
    expect(s.madeUp).toBe(1);
    expect(makeUpQada(s, "asr")).toBe(s);
  });

  it("القيم التالفة تُصحَّح", () => {
    const s = normalizeQada({
      enabled: true,
      remaining: { fajr: -5, dhuhr: "x", asr: 2.7 },
      madeUp: 1e9,
    });
    expect(s.remaining).toEqual({ fajr: 0, dhuhr: 0, asr: 2, maghrib: 0, isha: 0 });
    expect(s.madeUp).toBe(99_999);
  });
});

describe("النسبة المئوية", () => {
  it("الرقم ثم العلامة، وتتبع نوع الأرقام", () => {
    const strip = (t: string) => t.replace(/[\u061c\u200e\u200f]/g, "");
    expect(strip(formatPercent(50))).toBe("٥٠٪");
    expect(strip(formatPercent(0))).toBe("٠٪");
    expect(strip(formatPercent(7, { signed: true }))).toBe("+٧٪");
    expect(strip(formatPercent(-7, { signed: true }))).toMatch(/٧٪$/);
    __setDisplayForTests({ clock: "12", digits: "latn" });
    expect(strip(formatPercent(50))).toBe("50%");
    __setDisplayForTests(DEFAULT_DISPLAY);
  });
});
