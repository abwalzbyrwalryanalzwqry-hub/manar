import { describe, expect, it } from "vitest";
import { buildWidgetSnapshot } from "@/lib/widget-snapshot";
import {
  DEFAULT_WIDGET_OPTIONS,
  effectiveWidgetOptions,
  normalizeWidgetOptions,
  normalizeWidgetOverrides,
} from "@/lib/widget-settings";
import { contactUrls, DEVELOPER } from "@/lib/developer";
import { PRIVACY, TERMS } from "@/lib/legal";
import { normalizeSettings, type LocationState } from "@/lib/prayer";

const SANAA: LocationState = { lat: 15.3694, lng: 44.191, city: "صنعاء", source: "manual" };

describe("إعدادات الويدجت", () => {
  it("قيم افتراضية آمنة لأي مدخل تالف", () => {
    expect(normalizeWidgetOptions(null)).toEqual(DEFAULT_WIDGET_OPTIONS);
    expect(normalizeWidgetOptions({ verse: "x", theme: "pink" })).toEqual(DEFAULT_WIDGET_OPTIONS);
    expect(normalizeWidgetOptions({ verse: false, theme: "emerald" })).toMatchObject({
      verse: false,
      countdown: "minutes",
      theme: "emerald",
    });
  });

  it("يرحّل العدّ المنطقي القديم", () => {
    expect(normalizeWidgetOptions({ countdown: true }).countdown).toBe("minutes");
    expect(normalizeWidgetOptions({ countdown: false }).countdown).toBe("off");
    expect(normalizeWidgetOptions({ countdown: "seconds" }).countdown).toBe("seconds");
    expect(normalizeWidgetOptions({ opacity: 250 }).opacity).toBe(100);
    expect(normalizeWidgetOptions({ opacity: -3 }).opacity).toBe(0);
  });

  it("إعدادات النسخة تحفظ المخالف فقط وبقيم صالحة", () => {
    expect(normalizeWidgetOverrides({ theme: "sand", verse: "x", opacity: 40, junk: 1 })).toEqual({
      theme: "sand",
      opacity: 40,
    });
    expect(normalizeWidgetOverrides({ countdown: false })).toEqual({ countdown: "off" });
    expect(normalizeWidgetOverrides(null)).toEqual({});
    expect(effectiveWidgetOptions(DEFAULT_WIDGET_OPTIONS, { theme: "clear" }).theme).toBe("clear");
  });

  it("اللقطة تحمل خيارات العرض إلى الطبقة الأصلية", () => {
    const base = { location: SANAA, settings: normalizeSettings({}), from: new Date(2026, 8, 23) };
    expect(buildWidgetSnapshot(base).options).toEqual(DEFAULT_WIDGET_OPTIONS);
    const opts = {
      ...DEFAULT_WIDGET_OPTIONS,
      countdown: "off" as const,
      theme: "emerald" as const,
    };
    expect(buildWidgetSnapshot({ ...base, options: opts }).options).toEqual(opts);
  });
});

describe("عن المطور", () => {
  it("البيانات الرسمية كما زُوِّدت", () => {
    expect(DEVELOPER.name).toBe("م. إدريس الزوقري");
    expect(DEVELOPER.phone).toBe("776343551");
    expect(DEVELOPER.address).toBe("اليمن _ إب _ جوبلة");
    expect(DEVELOPER.email).toBe("zoqriidris@gmail.com");
    expect(DEVELOPER.whatsapp).toBe("@rzleelzr");
    expect(DEVELOPER.telegram).toBe("rzleelzr");
  });

  it("روابط التواصل مبنية من البيانات المزوَّدة فقط", () => {
    expect(contactUrls("phone")).toEqual(["tel:+967776343551"]);
    expect(contactUrls("email")).toEqual(["mailto:zoqriidris@gmail.com"]);
    expect(contactUrls("whatsapp")).toEqual([
      "whatsapp://send?phone=967776343551",
      "https://wa.me/967776343551",
    ]);
    expect(contactUrls("telegram")).toEqual([
      "tg://resolve?domain=rzleelzr",
      "https://t.me/rzleelzr",
    ]);
    const fb = contactUrls("facebook");
    expect(fb).toHaveLength(1);
    expect(decodeURIComponent(fb[0])).toContain("إدريس الزوقري");
  });
});

describe("الصفحات القانونية", () => {
  it("أقسام غير فارغة وبعناوين فريدة", () => {
    for (const doc of [PRIVACY, TERMS]) {
      expect(doc.length).toBeGreaterThan(5);
      expect(new Set(doc.map((s) => s.title)).size).toBe(doc.length);
      for (const s of doc) expect(Boolean(s.body) || (s.points?.length ?? 0) > 0).toBe(true);
    }
  });
});
