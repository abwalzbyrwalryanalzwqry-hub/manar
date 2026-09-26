import { describe, expect, it } from "vitest";
import { computePrayerTimes, normalizeSettings, type LocationState } from "@/lib/prayer";
import {
  DEFAULT_SAKINAH,
  MIN_QUIET_MINUTES,
  START_OFFSET_LIMIT,
  adhanAudible,
  computeSakinahWindows,
  describeStart,
  effectiveEnd,
  filterMode,
  filterPatch,
  makeStartOffset,
  normalize,
  startDirection,
  withTiming,
  type SakinahSettings,
} from "@/lib/sakinah";

const SANAA: LocationState = { lat: 15.3694, lng: 44.191, city: "صنعاء", source: "manual" };
const CALC = normalizeSettings({});
const FROM = new Date(Date.UTC(2026, 8, 23, 0, 30)); // قبل فجر ٢٣ سبتمبر بتوقيت صنعاء
const id = (v: string | number) => String(v);

function onlyDhuhr(startOffset: number, afterMinutes: number): SakinahSettings {
  const base = normalize({});
  const prayers = Object.fromEntries(
    Object.entries(base.prayers).map(([k, v]) => [k, { ...v, enabled: false }]),
  ) as SakinahSettings["prayers"];
  prayers.dhuhr = withTiming({ ...prayers.dhuhr, enabled: true }, { startOffset, afterMinutes });
  return {
    ...base,
    enabled: true,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    jumuahSeparate: false,
    prayers,
  };
}

describe("سكينة: بداية الهدوء قبل الأذان أو معه أو بعده", () => {
  it("الإزاحة الموقّعة واتجاهها", () => {
    expect(makeStartOffset("before", 10)).toBe(-10);
    expect(makeStartOffset("with", 10)).toBe(0);
    expect(makeStartOffset("after", 7)).toBe(7);
    expect(makeStartOffset("after", 500)).toBe(START_OFFSET_LIMIT);
    expect(startDirection(-3)).toBe("before");
    expect(startDirection(0)).toBe("with");
    expect(startDirection(4)).toBe("after");
    expect(describeStart(5, id)).toMatch(/^بعد الأذان ٥|^بعد الأذان 5/);
  });

  it("النهاية لا تسبق البداية وتحفظ حدًّا أدنى للهدوء", () => {
    expect(effectiveEnd(20, 10)).toBe(20 + MIN_QUIET_MINUTES);
    expect(effectiveEnd(-10, 30)).toBe(30);
    const cfg = withTiming(DEFAULT_SAKINAH.prayers.dhuhr, { startOffset: 15, afterMinutes: 5 });
    expect(cfg.startOffset).toBe(15);
    expect(cfg.afterMinutes).toBeGreaterThanOrEqual(15 + MIN_QUIET_MINUTES);
    expect(cfg.beforeMinutes).toBe(0);
  });

  it("فترة الظهر تبدأ بعد الأذان بالدقائق المختارة", () => {
    const [w] = computeSakinahWindows(onlyDhuhr(10, 40), SANAA, CALC, 1, FROM);
    const dhuhr = computePrayerTimes(
      SANAA,
      CALC,
      (() => {
        const d = new Date(FROM);
        d.setHours(12, 0, 0, 0);
        return d;
      })(),
    ).dhuhr.getTime();
    expect(w.start - dhuhr).toBe(10 * 60_000);
    expect(w.end - dhuhr).toBe(40 * 60_000);
  });

  it("الإعداد القديم (قبل الأذان فقط) يُرحَّل إلى إزاحة سالبة", () => {
    const s = normalize({
      prayers: { fajr: { enabled: true, beforeMinutes: 5, afterMinutes: 20 } },
      jumuahBeforeMinutes: 10,
    });
    expect(s.prayers.fajr.startOffset).toBe(-5);
    expect(s.jumuahStartOffset).toBe(-10);
  });
});

describe("سكينة: أصوات منار فقط", () => {
  it("هو الافتراضي، ويُرحَّل إليه الإعداد القديم «المكالمات المهمة»", () => {
    expect(filterMode(normalize({}))).toBe("manar");
    expect(filterMode(normalize({ allowPriority: true }))).toBe("manar");
    expect(filterMode(normalize({ alarmsOnly: true }))).toBe("alarms");
    expect(filterMode(normalize({ totalSilence: true }))).toBe("none");
  });

  it("الأنماط متنافية، والصمت الكامل وحده يكتم الأذان", () => {
    for (const m of ["manar", "priority", "alarms", "none"] as const) {
      const s = normalize({ ...normalize({}), ...filterPatch(m) });
      expect(filterMode(s)).toBe(m);
      expect(adhanAudible(s)).toBe(m !== "none");
    }
  });
});
