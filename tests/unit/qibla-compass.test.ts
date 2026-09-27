/**
 * منار — بوصلة القبلة: الاتجاه المطلق، والانحراف المغناطيسي، والإرشاد.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  angleDelta,
  cardinalAr,
  circularSpread,
  continuousRotation,
  createSmoother,
  formatLatitude,
  formatLongitude,
  guidance,
  norm360,
  readHeading,
} from "@/lib/qibla/compass";
import { decimalYear, magneticDeclination } from "@/lib/qibla/declination";
import { qiblaBearing } from "@/lib/prayer";

const raw = (alpha: number | null, absolute: boolean, extra = {}) => ({
  alpha,
  beta: 0,
  gamma: 0,
  absolute,
  ...extra,
});

describe("قراءة الاتجاه", () => {
  it("القراءة النسبية مرفوضة — لا نخمّن الشمال", () => {
    expect(readHeading(raw(90, false))).toBeNull();
    expect(readHeading(raw(null, true))).toBeNull();
  });

  it("المطلقة: alpha عكس عقارب الساعة، والاتجاه معها", () => {
    expect(readHeading(raw(0, true))!.magnetic).toBe(0);
    expect(readHeading(raw(90, true))!.magnetic).toBe(270);
    expect(readHeading(raw(270, true))!.magnetic).toBe(90);
  });

  it("دوران الشاشة يُعوَّض", () => {
    expect(readHeading(raw(0, true), 90)!.magnetic).toBe(90);
  });

  it("iOS: webkitCompassHeading مباشرةً مع الدقة", () => {
    const r = readHeading(raw(123, false, { webkitCompassHeading: 45, webkitCompassAccuracy: 10 }));
    expect(r).toMatchObject({ magnetic: 45, accuracy: 10 });
  });

  it("الميل الكبير يُكشف", () => {
    expect(readHeading({ ...raw(0, true), beta: 70 })!.tilted).toBe(true);
    expect(readHeading({ ...raw(0, true), gamma: 10 })!.tilted).toBe(false);
  });
});

describe("زوايا مستمرة ومنعَّمة", () => {
  it("norm360 وangleDelta بأقصر طريق", () => {
    expect(norm360(-10)).toBe(350);
    expect(norm360(725)).toBe(5);
    expect(angleDelta(350, 10)).toBe(20);
    expect(angleDelta(10, 350)).toBe(-20);
  });

  it("الإبرة لا تلفّ دورة كاملة عند عبور ٣٦٠°", () => {
    expect(continuousRotation(-358, -2)).toBe(-362);
    expect(continuousRotation(0, 359)).toBe(-1);
  });

  it("المنعِّم الدائري: متوسط ٣٥٩° و١° قرب الصفر لا ١٨٠°", () => {
    const sm = createSmoother(0.5);
    sm.push(359);
    const v = sm.push(1);
    expect(Math.min(v, 360 - v)).toBeLessThan(1);
  });

  it("الاضطراب: ثابت ≈ ٠، مشتّت كبير", () => {
    expect(circularSpread([10, 10, 10])).toBeLessThan(0.01);
    expect(circularSpread([0, 90, 180, 270, 45])).toBeGreaterThan(60);
  });
});

describe("الإرشاد", () => {
  it("ضمن ±٥° = متّجه إلى القبلة", () => {
    expect(guidance(118, 120)).toEqual({ kind: "aligned" });
    expect(guidance(358, 2)).toEqual({ kind: "aligned" });
  });

  it("الجهة الأقصر", () => {
    expect(guidance(100, 130)).toEqual({ kind: "turn", dir: "right", by: 30 });
    expect(guidance(10, 300)).toEqual({ kind: "turn", dir: "left", by: 70 });
  });

  it("أسماء الجهات والإحداثيات بالعربية", () => {
    expect(cardinalAr(0)).toBe("الشمال");
    expect(cardinalAr(315)).toBe("الشمال الغربي");
    expect(cardinalAr(350)).toBe("الشمال");
    expect(formatLatitude(-33.9)).toBe("33.90° جنوباً");
    expect(formatLongitude(-74)).toBe("74.00° غرباً");
    expect(formatLongitude(44.2)).toBe("44.20° شرقاً");
  });
});

describe("الانحراف المغناطيسي (WMM2025)", () => {
  const d = new Date(Date.UTC(2026, 8, 27));
  /* قيم مرجعية من تنفيذ WMM2025 مستقل (geomagnetism) للتاريخ نفسه. */
  it.each([
    ["صنعاء", 15.35, 44.2, 2.162],
    ["مكة", 21.42, 39.83, 3.502],
    ["لندن", 51.5, -0.12, 1.206],
    ["نيويورك", 40.7, -74, -12.466],
    ["سيدني", -33.9, 151.2, 12.835],
    ["طوكيو", 35.7, 139.7, -7.94],
    ["القاهرة", 30, 31, 4.761],
  ])("%s", (_n, lat, lng, want) => {
    expect(magneticDeclination(lat, lng, d)).toBeCloseTo(want, 2);
  });

  it("السنة العشرية", () => {
    expect(decimalYear(new Date(Date.UTC(2026, 0, 1)))).toBe(2026);
    expect(decimalYear(new Date(Date.UTC(2026, 6, 2, 12)))).toBeCloseTo(2026.5, 2);
  });
});

describe("اتجاه القبلة", () => {
  it("صنعاء نحو الشمال الغربي (~٣٢٦°)", () => {
    const b = qiblaBearing({ lat: 15.3694, lng: 44.191 });
    expect(b).toBeGreaterThan(320);
    expect(b).toBeLessThan(330);
    expect(cardinalAr(b)).toBe("الشمال الغربي");
  });
});

describe("حرّاس الشاشة", () => {
  const src = readFileSync(resolve(__dirname, "../../src/routes/qibla.tsx"), "utf8");
  it("لا حروف لاتينية ثابتة للجهات ولا إشارة E/N ثابتة", () => {
    expect(src).not.toMatch(/°\s*[EN]\b/);
    expect(src).not.toMatch(/>\s*KAABA\s*</);
    expect(src).not.toMatch(/\{ l: "N"/);
  });
  it("لا تُقرأ alpha مباشرةً في الشاشة (تُمرّر عبر useCompass)", () => {
    expect(src).not.toMatch(/deviceorientation/);
    expect(src).toContain("useCompass(declination)");
  });
});
