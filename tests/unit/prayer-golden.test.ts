/**
 * تطابق الحساب الأصلي (`PrayerCalc.java`) مع الويب: يولّد هذا الاختبار القيم
 * المرجعية من `computePrayerTimes` نفسها (مكتبة adhan) لمدن وطرق ومناطق زمنية
 * متنوّعة، ويتحقق أن الملف المحفوظ الذي يقرؤه اختبار JVM ما زال مطابقاً لها.
 * بعد ترقية adhan أو تغيير القواعد: `UPDATE_GOLDEN=1 npx vitest run tests/unit/prayer-golden.test.ts`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import {
  computePrayerTimes,
  EMPTY_OFFSETS,
  PRAYER_ORDER,
  prayerCalcSpec,
  type LocationState,
  type Settings,
} from "@/lib/prayer";
import { toHijri } from "@/lib/hijri";

const FILE = "android/app/src/test/resources/prayer/golden.json";

type City = {
  name: string;
  tz: string;
  lat: number;
  lng: number;
  settings: Partial<Settings> & Pick<Settings, "method">;
};

const CITIES: City[] = [
  { name: "صنعاء", tz: "Asia/Aden", lat: 15.3694, lng: 44.191, settings: { method: "UmmAlQura" } },
  { name: "مكة", tz: "Asia/Riyadh", lat: 21.4225, lng: 39.8262, settings: { method: "UmmAlQura" } },
  {
    name: "القاهرة",
    tz: "Africa/Cairo",
    lat: 30.0444,
    lng: 31.2357,
    settings: { method: "Egyptian" },
  },
  {
    name: "إسطنبول",
    tz: "Europe/Istanbul",
    lat: 41.0082,
    lng: 28.9784,
    settings: { method: "Turkey" },
  },
  {
    name: "لندن",
    tz: "Europe/London",
    lat: 51.5074,
    lng: -0.1278,
    settings: { method: "MoonsightingCommittee" },
  },
  {
    name: "أوسلو",
    tz: "Europe/Oslo",
    lat: 59.9139,
    lng: 10.7522,
    settings: { method: "MoonsightingCommittee" },
  },
  {
    name: "ترومسو",
    tz: "Europe/Oslo",
    lat: 69.6492,
    lng: 18.9553,
    settings: { method: "MuslimWorldLeague" },
  },
  {
    name: "ريكيافيك",
    tz: "Atlantic/Reykjavik",
    lat: 64.1466,
    lng: -21.9426,
    settings: { method: "MuslimWorldLeague" },
  },
  {
    name: "كراتشي",
    tz: "Asia/Karachi",
    lat: 24.8607,
    lng: 67.0011,
    settings: { method: "Karachi", madhab: "hanafi" },
  },
  { name: "طهران", tz: "Asia/Tehran", lat: 35.6892, lng: 51.389, settings: { method: "Tehran" } },
  {
    name: "نيويورك",
    tz: "America/New_York",
    lat: 40.7128,
    lng: -74.006,
    settings: { method: "NorthAmerica" },
  },
  {
    name: "سيدني",
    tz: "Australia/Sydney",
    lat: -33.8688,
    lng: 151.2093,
    settings: { method: "MuslimWorldLeague" },
  },
  {
    name: "أوكلاند",
    tz: "Pacific/Auckland",
    lat: -36.8485,
    lng: 174.7633,
    settings: { method: "MuslimWorldLeague" },
  },
  {
    name: "هونولولو",
    tz: "Pacific/Honolulu",
    lat: 21.3069,
    lng: -157.8583,
    settings: { method: "NorthAmerica" },
  },
  { name: "دبي", tz: "Asia/Dubai", lat: 25.2048, lng: 55.2708, settings: { method: "Dubai" } },
  { name: "الكويت", tz: "Asia/Kuwait", lat: 29.3759, lng: 47.9774, settings: { method: "Kuwait" } },
  { name: "الدوحة", tz: "Asia/Qatar", lat: 25.2854, lng: 51.531, settings: { method: "Qatar" } },
  {
    name: "جاكرتا",
    tz: "Asia/Jakarta",
    lat: -6.2088,
    lng: 106.8456,
    settings: { method: "Singapore" },
  },
  {
    name: "كيب تاون",
    tz: "Africa/Johannesburg",
    lat: -33.9249,
    lng: 18.4241,
    settings: { method: "MoonsightingCommittee", madhab: "hanafi" },
  },
  {
    name: "صنعاء بإزاحات",
    tz: "Asia/Aden",
    lat: 15.3694,
    lng: 44.191,
    settings: {
      method: "UmmAlQura",
      offsets: { ...EMPTY_OFFSETS, fajr: 2, isha: -3, asr: 1 },
      dstOffset: 1,
    },
  },
  /* مسافر: إحداثيات صنعاء وهاتف على توقيت لندن. */
  {
    name: "صنعاء من لندن",
    tz: "Europe/London",
    lat: 15.3694,
    lng: 44.191,
    settings: { method: "UmmAlQura" },
  },
  {
    name: "ويلينغتون",
    tz: "Pacific/Auckland",
    lat: -41.2865,
    lng: 174.7762,
    settings: { method: "Egyptian" },
  },
];

/** كل ١٣ يوماً على سنتين: تغطي الفصول والتوقيت الصيفي ورمضان ١٤٤٨ و١٤٤٩. */
function dates(): string[] {
  const out: string[] = [];
  for (let i = 0; i < 2 * 365; i += 13) {
    const d = new Date(Date.UTC(2026, 0, 1 + i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

interface Golden {
  adhan: string;
  dates: string[];
  cities: {
    name: string;
    tz: string;
    spec: ReturnType<typeof prayerCalcSpec>;
    /** فهارس التواريخ الواقعة في رمضان (لعشاء أم القرى). */
    ramadan: number[];
    times: (number | null)[][];
  }[];
}

const ORIGINAL_TZ = process.env.TZ;

function generate(): Golden {
  const list = dates();
  const adhanVersion = (
    JSON.parse(readFileSync("node_modules/adhan/package.json", "utf8")) as { version: string }
  ).version;
  return {
    adhan: adhanVersion,
    dates: list,
    cities: CITIES.map((c) => {
      process.env.TZ = c.tz;
      const loc = { lat: c.lat, lng: c.lng, city: c.name } as LocationState;
      const settings: Settings = {
        madhab: "shafi",
        offsets: EMPTY_OFFSETS,
        dstOffset: 0,
        ...c.settings,
      };
      const ramadan: number[] = [];
      const times = list.map((key, i) => {
        const [y, m, d] = key.split("-").map(Number);
        const date = new Date(y, m - 1, d, 12);
        if (toHijri(date, 0).month === 9) ramadan.push(i);
        const t = computePrayerTimes(loc, settings, date, 0);
        return PRAYER_ORDER.map((k) => {
          const v = t[k].getTime();
          return Number.isFinite(v) ? v : null;
        });
      });
      return { name: c.name, tz: c.tz, spec: prayerCalcSpec(loc, settings), ramadan, times };
    }),
  };
}

describe("المواقيت المرجعية للحساب الأصلي", () => {
  afterAll(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it("الملف المحفوظ مطابق لحساب الويب الحالي", () => {
    const fresh = generate();
    if (process.env.UPDATE_GOLDEN || !existsSync(FILE)) {
      writeFileSync(FILE, JSON.stringify(fresh) + "\n");
    }
    const saved = JSON.parse(readFileSync(FILE, "utf8")) as Golden;
    expect(saved).toEqual(fresh);
  });

  it("يغطي الحالات الصعبة: الدائرة القطبية ورمضان ولجنة الرؤية فوق ٥٥°", () => {
    const g = JSON.parse(readFileSync(FILE, "utf8")) as Golden;
    expect(g.cities.find((c) => c.name === "صنعاء")!.ramadan.length).toBeGreaterThan(0);
    expect(g.cities.find((c) => c.name === "أوسلو")!.spec.method).toBe("MoonsightingCommittee");
    const tromso = g.cities.find((c) => c.name === "ترومسو")!;
    expect(tromso.times.every((row) => row.every((v) => v !== null))).toBe(true);
  });
});
