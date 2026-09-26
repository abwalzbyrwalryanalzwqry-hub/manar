import { beforeEach, describe, expect, it, vi } from "vitest";

/* الاهتزاز: خفيف مع كل نقرة، وأقوى قليلًا عند الإتمام، وكل نوع بإعداده. */

const impact = vi.fn((_arg?: unknown) => Promise.resolve());
let native = true;
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => native,
    isPluginAvailable: () => native,
  },
}));
vi.mock("@capacitor/haptics", () => ({
  Haptics: { impact: (a: unknown) => impact(a) },
  ImpactStyle: { Light: "LIGHT", Medium: "MEDIUM", Heavy: "HEAVY" },
}));

async function load() {
  vi.resetModules();
  const prefs = await import("@/lib/azkar/prefs");
  const h = await import("@/lib/haptics");
  return { ...prefs, ...h };
}

const vibrate = vi.fn();
beforeEach(() => {
  impact.mockClear();
  vibrate.mockClear();
  vi.stubGlobal("navigator", { vibrate });
  vi.stubGlobal("window", {});
});

describe("قوة الاهتزاز", () => {
  it("العدّة خفيفة، ونهاية المقطع والإتمام أقوى قليلًا", async () => {
    const { HAPTIC_STRENGTH, WEB_VIBRATION_MS } = await load();
    expect(HAPTIC_STRENGTH).toEqual({ tap: "light", step: "medium", done: "medium" });
    expect(WEB_VIBRATION_MS.medium).toBeGreaterThan(WEB_VIBRATION_MS.light);
  });

  it("أندرويد: LIGHT للنقرة وMEDIUM للإتمام عبر الإضافة الأصلية", async () => {
    native = true;
    const { haptic } = await load();
    const on = { hapticTap: true, hapticDone: true };
    haptic(on, "tap");
    haptic(on, "done");
    expect(impact.mock.calls).toEqual([[{ style: "LIGHT" }], [{ style: "MEDIUM" }]]);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("الويب: Vibration API بمدة أطول للإتمام", async () => {
    native = false;
    const { haptic, WEB_VIBRATION_MS } = await load();
    haptic({ hapticTap: true, hapticDone: true }, "tap");
    haptic({ hapticTap: true, hapticDone: true }, "step");
    expect(vibrate.mock.calls).toEqual([[WEB_VIBRATION_MS.light], [WEB_VIBRATION_MS.medium]]);
    expect(impact).not.toHaveBeenCalled();
  });
});

describe("إعدادات الاهتزاز", () => {
  it("كل نوع يُطفأ وحده", async () => {
    native = true;
    const { haptic, hapticEnabled } = await load();
    const onlyDone = { hapticTap: false, hapticDone: true };
    expect(hapticEnabled(onlyDone, "tap")).toBe(false);
    expect(hapticEnabled(onlyDone, "done")).toBe(true);
    expect(hapticEnabled(onlyDone, "step")).toBe(true);
    haptic(onlyDone, "tap");
    expect(impact).not.toHaveBeenCalled();
    haptic({ hapticTap: true, hapticDone: false }, "done");
    expect(impact).not.toHaveBeenCalled();
  });

  it("النقر السريع لا يُنتظر: مئة نقرة تُرسل مئة اهتزاز دون انتظار أيّ منها", async () => {
    native = true;
    impact.mockImplementation(() => new Promise<void>(() => {})); // لا تنتهي أبدًا
    const { haptic } = await load();
    const t = performance.now();
    for (let i = 0; i < 100; i++) haptic({ hapticTap: true, hapticDone: true }, "tap");
    expect(impact).toHaveBeenCalledTimes(100);
    expect(performance.now() - t).toBeLessThan(50);
  });
});
