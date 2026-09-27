import { describe, expect, it } from "vitest";
import { methodForCountry, methodSuggestion } from "@/lib/method-suggest";
import type { LocationState } from "@/lib/prayer";

const gps = (country: string): LocationState => ({
  lat: 0,
  lng: 0,
  city: "x",
  country,
  source: "gps",
});

describe("اقتراح طريقة الحساب", () => {
  it("البلدان التي تنص عليها مكتبة adhan", () => {
    expect(methodForCountry("المملكة العربية السعودية")).toBe("UmmAlQura");
    expect(methodForCountry("مصر")).toBe("Egyptian");
    expect(methodForCountry("الإمارات العربية المتحدة")).toBe("Dubai");
    expect(methodForCountry("Malaysia")).toBe("Singapore");
    expect(methodForCountry("كندا")).toBe("MoonsightingCommittee");
    expect(methodForCountry("تركيا")).toBe("Turkey");
  });

  it("لا اقتراح لبلد غير معروف", () => {
    expect(methodForCountry("اليمن")).toBeNull();
    expect(methodForCountry("")).toBeNull();
    expect(methodForCountry(undefined)).toBeNull();
  });

  it("يظهر بعد GPS فقط، ولا يتكرر إن رُفض أو كانت الطريقة مختارة", () => {
    expect(methodSuggestion(gps("مصر"), "UmmAlQura", [])).toEqual({
      method: "Egyptian",
      country: "مصر",
    });
    expect(methodSuggestion({ ...gps("مصر"), source: "manual" }, "UmmAlQura", [])).toBeNull();
    expect(methodSuggestion(gps("مصر"), "Egyptian", [])).toBeNull();
    expect(methodSuggestion(gps("مصر"), "UmmAlQura", ["مصر:Egyptian"])).toBeNull();
  });
});
