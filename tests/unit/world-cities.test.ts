/**
 * منار — قاعدة المدن العالمية (المرحلة ٣٣، الجزء الثاني).
 *
 * - تُحمَّل كسولاً ولا يستوردها ملفٌّ استيراداً ثابتاً.
 * - كل مدينة باسمٍ عربي ومنطقةٍ زمنية صالحة، ولا تتكرّر مدن الدول العربية.
 * - البحث والاستدلال العكسي يعيدان المنطقة الزمنية، فيعرفها `timeZoneOf`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetWorldCitiesForTests,
  allPlaces,
  loadWorldCities,
  nearestPlace,
  normalizeAr,
  searchPlaces,
  toLocation,
  worldCitiesLoaded,
} from "@/lib/places";
import { timeZoneOf, isValidTimeZone } from "@/lib/place-timezone";
import { WORLD_CITIES, WORLD_COUNTRIES, WORLD_TIME_ZONES } from "@/lib/world-cities";

const root = resolve(__dirname, "../..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("بيانات المدن العالمية", () => {
  it("حجم معقول وأسماء عربية فقط", () => {
    expect(WORLD_CITIES.length).toBeGreaterThan(2000);
    for (const [name] of WORLD_CITIES) expect(name, name).not.toMatch(/[A-Za-z]/);
    for (const [, name] of WORLD_COUNTRIES) expect(name).not.toMatch(/[A-Za-z]/);
  });

  it("كل منطقة زمنية صالحة، وكل فهرس في مداه", () => {
    for (const tz of WORLD_TIME_ZONES) expect(isValidTimeZone(tz), tz).toBe(true);
    for (const [name, lat, lng, , ci, ti] of WORLD_CITIES) {
      expect(Math.abs(lat) <= 90 && Math.abs(lng) <= 180, name).toBe(true);
      expect(WORLD_COUNTRIES[ci], name).toBeDefined();
      expect(WORLD_TIME_ZONES[ti], name).toBeDefined();
    }
  });

  it("لا دول عربية فيها (مغطّاة في arab-places بمحافظاتها)", () => {
    const codes = WORLD_COUNTRIES.map(([c]) => c);
    for (const c of ["SA", "YE", "EG", "MA", "IQ", "SY", "EH"]) expect(codes).not.toContain(c);
  });

  it("لا يستوردها ملفٌّ استيراداً ثابتاً — تبقى خارج حزمة الإقلاع", () => {
    for (const f of walk(resolve(root, "src"))) {
      if (!/\.(ts|tsx)$/.test(f) || f.endsWith("world-cities.ts")) continue;
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/from\s+["']@\/lib\/world-cities["']/);
    }
  });
});

describe("الدمج في فهرس الأماكن", () => {
  beforeEach(() => __resetWorldCitiesForTests());

  it("قبل التحميل لا تظهر، وبعده تظهر", async () => {
    expect(worldCitiesLoaded()).toBe(false);
    expect(searchPlaces("هاربن").some((p) => p.city === "هاربن")).toBe(false);
    await loadWorldCities();
    expect(worldCitiesLoaded()).toBe(true);
    const hit = searchPlaces("هاربن")[0];
    expect(hit.city).toBe("هاربن");
    expect(hit.country).toBe("الصين");
    expect(hit.tz).toBe("Asia/Shanghai");
  });

  it("المدينة المضمَّنة لا تتكرّر بل تكتسب منطقتها الزمنية", async () => {
    await loadWorldCities();
    const ist = allPlaces().filter((p) => p.key === normalizeAr("إسطنبول"));
    expect(ist).toHaveLength(1);
    expect(ist[0].tz).toBe("Europe/Istanbul");
    const chi = allPlaces().filter((p) => p.key === normalizeAr("شيكاغو"));
    expect(chi).toHaveLength(1);
    expect(chi[0].tz).toBe("America/Chicago");
  });

  it("المدينة المضمَّنة تأخذ سكانها الحقيقيين في ترتيب البحث", async () => {
    await loadWorldCities();
    expect(searchPlaces("لوس")[0].city).toBe("لوس أنجلوس");
  });

  it("الدول متعدّدة المناطق: المنطقة من المدينة لا من الدولة", async () => {
    await loadWorldCities();
    const zone = (q: string) => timeZoneOf(toLocation(searchPlaces(q)[0]));
    expect(zone("لوس أنجلوس")).toBe("America/Los_Angeles");
    expect(zone("نوفوسيبيرسك")).toBe("Asia/Novosibirsk");
    expect(zone("بيرث")).toBe("Australia/Perth");
  });

  it("GPS: أقرب مدينة عالمية تحمل منطقتها", async () => {
    await loadWorldCities();
    const p = nearestPlace(-31.95, 115.86); // بيرث
    expect(p?.city).toBe("بيرث");
    expect(toLocation(p!, "gps").tz).toBe("Australia/Perth");
  });

  it("التحميل المتكرّر لا يكرّر المدن", async () => {
    await loadWorldCities();
    const n = allPlaces().length;
    await loadWorldCities();
    expect(allPlaces().length).toBe(n);
  });
});
