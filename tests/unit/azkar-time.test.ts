import { afterEach, describe, expect, it, vi } from "vitest";
import { azkarTimeNow } from "@/lib/azkar/time";
import { computePrayerTimes } from "@/lib/prayer";

/* C6: الوقت من مواقيت موقع المستخدم، والرجوع للساعة إن لم يحدّد موقعه. */

function withLocation(loc: object | null) {
  const store: Record<string, string> = {};
  if (loc) store["manar.location.v1"] = JSON.stringify(loc);
  const ls = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  };
  vi.stubGlobal("localStorage", ls);
  vi.stubGlobal("window", { localStorage: ls, dispatchEvent: () => true });
}

afterEach(() => vi.unstubAllGlobals());

const SANAA = { lat: 15.3694, lng: 44.191, city: "صنعاء", source: "manual" };

describe("azkarTimeNow", () => {
  it("بموقع محدد: قبل العصر بدقيقة صباح، وبعده مساء", () => {
    withLocation(SANAA);
    const day = new Date(2026, 8, 26, 12);
    const t = computePrayerTimes(
      SANAA as never,
      { method: "UmmAlQura", madhab: "shafi", offsets: {} as never, dstOffset: 0 },
      day,
    );
    expect(azkarTimeNow(new Date(t.asr.getTime() - 60_000))).toBe("morning");
    expect(azkarTimeNow(new Date(t.asr.getTime() + 60_000))).toBe("evening");
    expect(azkarTimeNow(new Date(t.fajr.getTime() + 60_000))).toBe("morning");
    expect(azkarTimeNow(new Date(t.fajr.getTime() - 60_000))).toBe("evening");
  });

  it("بلا موقع محدد: التقدير بالساعة", () => {
    withLocation(null);
    expect(azkarTimeNow(new Date(2026, 8, 26, 14, 59))).toBe("morning");
    expect(azkarTimeNow(new Date(2026, 8, 26, 15, 1))).toBe("evening");
  });
});
