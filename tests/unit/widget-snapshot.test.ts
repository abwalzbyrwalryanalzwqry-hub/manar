import { describe, expect, it } from "vitest";
import { buildWidgetSnapshot, widgetVerseText, WIDGET_PRAYERS } from "@/lib/widget-snapshot";
import { normalizeSettings, type LocationState } from "@/lib/prayer";

const SANAA: LocationState = { lat: 15.3694, lng: 44.191, city: "صنعاء", source: "manual" };

describe("لقطة الويدجت", () => {
  const snap = buildWidgetSnapshot({
    location: SANAA,
    settings: normalizeSettings({}),
    from: new Date(2026, 8, 23, 1),
    verses: { "2026-09-24": { text: "نص", ref: "سورة الكهف، الآية ١٠" } },
    now: 42,
  });

  it("سبعة أيام متتالية تبدأ من اليوم", () => {
    expect(snap.days.map((d) => d.date)).toEqual([
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
    ]);
    expect(snap.city).toBe("صنعاء");
    expect(snap.generatedAt).toBe(42);
  });

  it("خمس صلوات مرتّبة بأسماء عربية وأوقات بأرقام عربية", () => {
    for (const d of snap.days) {
      expect(d.prayers.map((p) => p.key)).toEqual(WIDGET_PRAYERS);
      for (let i = 1; i < d.prayers.length; i += 1) {
        expect(d.prayers[i].at).toBeGreaterThan(d.prayers[i - 1].at);
      }
      for (const p of d.prayers) expect(p.time).toMatch(/^[٠-٩]{1,2}:[٠-٩]{2} [صم]$/);
    }
    expect(snap.days[0].prayers[0].name).toBe("الفجر");
  });

  it("المواقيت متسلسلة عبر الأيام بلا فجوات", () => {
    for (let i = 1; i < snap.days.length; i += 1) {
      expect(snap.days[i].prayers[0].at).toBeGreaterThan(snap.days[i - 1].prayers[4].at);
    }
  });

  it("الآية تُربط بيومها فقط", () => {
    expect(snap.days[0].verse).toBeNull();
    expect(snap.days[1].verse?.ref).toContain("الكهف");
  });

  it("الهجري واليوم موجودان", () => {
    expect(snap.days[0].hijri.length).toBeGreaterThan(4);
    expect(snap.days[0].weekday).toBe("الأربعاء");
  });

  it("قابلة للتسلسل JSON", () => {
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
  });
});

describe("اختصار الآية", () => {
  it("لا يمسّ النص القصير", () => {
    expect(widgetVerseText("  قل   هو الله أحد ")).toBe("قل هو الله أحد");
  });
  it("يقصّ عند حدّ كلمة", () => {
    const long = Array(80).fill("كلمة").join(" ");
    const out = widgetVerseText(long, 50);
    expect(out.endsWith(" …")).toBe(true);
    expect(
      out
        .replace(" …", "")
        .split(" ")
        .every((w) => w === "كلمة"),
    ).toBe(true);
  });
});
