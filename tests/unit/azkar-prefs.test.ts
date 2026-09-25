import { describe, expect, it } from "vitest";
import {
  DEFAULT_AZKAR_PREFS,
  TEXT_SIZES,
  clampTextSize,
  hapticFor,
  isCountableTap,
  normalizeAzkarPrefs,
  textSizePx,
} from "@/lib/azkar/prefs";

/* المرحلة الثالثة: حجم النص، والاهتزاز، والعدّ بالضغط على النص. */

describe("تفضيلات عرض الأذكار", () => {
  it("الافتراضي يطابق الحجم السابق الثابت (٢٢) مع تفعيل الاهتزاز والعدّ بالنص", () => {
    expect(textSizePx(DEFAULT_AZKAR_PREFS)).toBe(22);
    expect(DEFAULT_AZKAR_PREFS.haptics).toBe(true);
    expect(DEFAULT_AZKAR_PREFS.tapAnywhere).toBe(true);
  });

  it("حجم النص محصور في المدى", () => {
    expect(clampTextSize(-3)).toBe(0);
    expect(clampTextSize(99)).toBe(TEXT_SIZES.length - 1);
    expect(clampTextSize("x")).toBe(2);
    expect(textSizePx({ textSize: 99 })).toBe(TEXT_SIZES[TEXT_SIZES.length - 1]);
  });

  it("القيم التالفة ترجع للافتراضي", () => {
    expect(normalizeAzkarPrefs(null)).toEqual(DEFAULT_AZKAR_PREFS);
    expect(normalizeAzkarPrefs({ haptics: "yes", tapAnywhere: 0, textSize: 4 })).toEqual({
      ...DEFAULT_AZKAR_PREFS,
      textSize: 4,
    });
    expect(normalizeAzkarPrefs({ haptics: false }).haptics).toBe(false);
  });
});

describe("الاهتزاز", () => {
  it("خفيف للعدّة، وأقوى عند إتمام الذكر", () => {
    expect(hapticFor(0, 3)).toBe("tap");
    expect(hapticFor(1, 3)).toBe("tap");
    expect(hapticFor(2, 3)).toBe("done");
    expect(hapticFor(0, 1)).toBe("done");
  });

  it("الأذكار المركّبة: اهتزاز عند نهاية كل مقطع", () => {
    const segs = [{ repeat: 33 }, { repeat: 33 }, { repeat: 34 }];
    expect(hapticFor(31, 100, segs)).toBe("tap");
    expect(hapticFor(32, 100, segs)).toBe("step");
    expect(hapticFor(65, 100, segs)).toBe("step");
    expect(hapticFor(98, 100, segs)).toBe("tap");
    expect(hapticFor(99, 100, segs)).toBe("done");
  });
});

describe("العدّ بالضغط على النص", () => {
  const el = (hit: boolean) => ({ closest: () => (hit ? {} : null) });
  it("لا يعدّ الضغط على الأزرار والروابط والحواشي", () => {
    expect(isCountableTap(el(true) as never)).toBe(false);
    expect(isCountableTap(el(false) as never)).toBe(true);
    expect(isCountableTap(null)).toBe(true);
  });
});
