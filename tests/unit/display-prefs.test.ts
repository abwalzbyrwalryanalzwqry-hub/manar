import { afterEach, describe, expect, it } from "vitest";
import {
  __setDisplayForTests,
  DEFAULT_DISPLAY,
  isDefaultDisplay,
  normalizeDisplay,
} from "@/lib/display-prefs";
import {
  ampmAr,
  formatArTime,
  formatGregorianAr,
  formatHHMM,
  formatHijriAr,
  toArabicDigits,
} from "@/lib/format";
import { describeTiming } from "@/lib/daily-reminders";

const PM = new Date(2026, 8, 28, 15, 5);
const AM = new Date(2026, 8, 28, 4, 39);

afterEach(() => __setDisplayForTests(DEFAULT_DISPLAY));

describe("تنسيق العرض", () => {
  it("الافتراضي كما كان: ١٢ ساعة وأرقام عربية", () => {
    expect(formatHHMM(PM)).toBe("٠٣:٠٥");
    expect(formatArTime(PM)).toBe("٣:٠٥");
    expect(ampmAr(PM)).toBe("مساءً");
    expect(ampmAr(AM)).toBe("صباحاً");
    expect(toArabicDigits("12")).toBe("١٢");
  });

  it("٢٤ ساعة: بلا صباحاً/مساءً", () => {
    __setDisplayForTests({ clock: "24", digits: "arab" });
    expect(formatHHMM(PM)).toBe("١٥:٠٥");
    expect(formatArTime(AM)).toBe("٤:٣٩");
    expect(ampmAr(PM)).toBe("");
    expect(describeTiming({ mode: "clock", hour: 20, minute: 30 } as never, toArabicDigits)).toBe(
      "٢٠:٣٠",
    );
  });

  it("أرقام غربية: حتى الأرقام العربية المكتوبة مسبقاً", () => {
    __setDisplayForTests({ clock: "12", digits: "latn" });
    expect(formatHHMM(PM)).toBe("03:05");
    expect(toArabicDigits("٤٥ دقيقة")).toBe("45 دقيقة");
    expect(formatGregorianAr(PM)).toMatch(/2026/);
    expect(formatHijriAr(PM)).toMatch(/1448/);
  });

  it("القيم التالفة تعود للافتراضي", () => {
    expect(normalizeDisplay({ clock: "13", digits: "x" })).toEqual(DEFAULT_DISPLAY);
    expect(normalizeDisplay(null)).toEqual(DEFAULT_DISPLAY);
    expect(isDefaultDisplay(normalizeDisplay({ clock: "24" }))).toBe(false);
  });
});
