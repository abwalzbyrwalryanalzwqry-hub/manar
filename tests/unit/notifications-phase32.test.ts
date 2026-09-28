/**
 * منار — المرحلة ٣٢: الإقامة لا تتأخّر في وضع Doze.
 *
 * في Doze لا يُطلق أندرويد منبّهات `setExactAndAllowWhileIdle` أكثر من مرة كل
 * ~٩ دقائق للتطبيق، والأذان وتنبيه الإقامة والإقامة متقاربة (٥–١٠ دقائق في
 * المغرب). الحل: لحظات الصلاة بـ`setAlarmClock` (أولوية المنبّه)، وهو إعدادٌ يُطفأ.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getAdhanSettings, type AdhanSettings } from "@/lib/adhan-settings";
import { describeLogEvent } from "@/lib/alert-center";
import { PRIORITY_ROLES, buildPrayerAlarms } from "@/lib/prayer-schedule";
import type { LocationState, Settings } from "@/lib/prayer";

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const java = (n: string) => read(`android/app/src/main/java/app/manar/islamic/${n}.java`);

const SANAA: LocationState = { lat: 15.3694, lng: 44.191, city: "صنعاء", source: "manual" };
const CALC: Settings = {
  method: "UmmAlQura",
  madhab: "shafi",
  offsets: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  dstOffset: 0,
};
const NOW = Date.UTC(2026, 8, 22, 22, 0, 0);
const full = (): AdhanSettings => ({
  ...structuredClone(getAdhanSettings()),
  iqamaReminderEnabled: true,
  fajrFirstAdhanEnabled: true,
  fajrReminderEnabled: true,
  fajrReminderMinutes: 45,
});
const build = (s: AdhanSettings) =>
  buildPrayerAlarms({ settings: s, location: SANAA, calc: CALC, now: NOW, days: 2 });

async function readStored(stored: Record<string, unknown> | null) {
  const store = new Map<string, string>();
  if (stored) store.set("manar.adhan-settings.v2", JSON.stringify(stored));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  });
  vi.resetModules();
  const mod = await import("@/lib/adhan-settings");
  return mod.getAdhanSettings();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("الإعداد «أولوية المنبّه»", () => {
  it("مفعّل افتراضياً", () => {
    expect(getAdhanSettings().alarmClockPriority).toBe(true);
  });
  it("إعدادات محفوظة قبل المرحلة ٣٢ (بلا الحقل) تأخذه مفعّلاً", async () => {
    expect((await readStored({ adhanEnabled: true })).alarmClockPriority).toBe(true);
  });
  it("إطفاؤه يُحفظ", async () => {
    expect((await readStored({ alarmClockPriority: false })).alarmClockPriority).toBe(false);
  });
});

describe("المحرّك يوسم لحظات الصلاة وحدها بالأولوية", () => {
  it("كل حدث يحمل قيمة صريحة للأولوية", () => {
    for (const e of build(full())) expect(typeof e.priority).toBe("boolean");
  });

  it("الأذان والإقامة وتنبيهها بأولوية؛ التذكيرات قبل الصلاة بلا أولوية", () => {
    const events = build(full());
    const roles = new Set(events.map((e) => e.role));
    for (const r of ["adhan", "iqamah", "iqamah_reminder", "reminder"] as const)
      expect(roles.has(r)).toBe(true);
    for (const e of events) expect(e.priority).toBe(PRIORITY_ROLES.has(e.role));
    expect(events.filter((e) => e.role === "reminder").every((e) => !e.priority)).toBe(true);
    expect(events.filter((e) => e.role === "iqamah").every((e) => e.priority)).toBe(true);
  });

  it("إشعار دخول الوقت (والأذان مطفأ) بأولوية — هو لحظة الصلاة", () => {
    const events = build({ ...full(), adhanEnabled: false });
    const notices = events.filter((e) => e.role === "prayer_notice");
    expect(notices.length).toBeGreaterThan(0);
    expect(notices.every((e) => e.priority)).toBe(true);
  });

  it("إطفاء الإعداد يُسقط الأولوية عن الجميع", () => {
    const events = build({ ...full(), alarmClockPriority: false });
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.priority)).toBe(false);
  });

  it("أذكار اليوم لا تأخذ أولوية المنبّه", () => {
    const src = read("src/lib/native-notifications.ts");
    expect(src).toMatch(/role: "daily",[\s\S]{0,200}priority: false/);
  });
});

describe("أندرويد: AdhanScheduler.armExact", () => {
  const sched = java("AdhanScheduler");
  const arm = sched.slice(sched.indexOf("static String armExact("));

  it("الأولوية تُضبط بـsetAlarmClock مع نيّة عرضٍ تفتح /prayer", () => {
    expect(arm).toMatch(
      /if \(priority\)[\s\S]*?am\.setAlarmClock\(new AlarmManager\.AlarmClockInfo\(at, show\), pi\)/,
    );
    expect(arm).toContain('ManarNotices.openIntent(context, SHOW_REQUEST, "/prayer")');
  });

  it("السلّم: بلا إذن دقيق ← غير دقيق؛ فشل setAlarmClock ← دقيق ثم غير دقيق", () => {
    expect(arm).toMatch(
      /if \(!exactAllowed\) \{[\s\S]*?setInexact\(am, at, pi\);[\s\S]*?MODE_INEXACT/,
    );
    expect(arm).toMatch(
      /catch \(RuntimeException e\)[\s\S]*?setExactAndAllowWhileIdle[\s\S]*?catch \(SecurityException/,
    );
  });

  it("armWindow يمرّ به ويعدّ ما ضُبط بأولوية للسجل", () => {
    expect(sched).toContain("armExact(context, am, e.atMillis, pi, e.priority)");
    expect(sched).toMatch(/ManarLog\.SCHEDULED[\s\S]*?"\/" \+ lastClockArmed/);
    // لا setAlarm قديم يتجاوز السلّم.
    expect(sched).not.toMatch(/private static void setAlarm\(/);
  });

  it("الحقل يُحفظ ويُستعاد؛ الجدول القديم بلا الحقل: الأذان والإقامة بأولوية", () => {
    expect(sched).toContain('.put("priority", priority)');
    expect(sched).toMatch(/o\.has\("priority"\)[\s\S]*?defaultPriority\(/);
    expect(sched).toMatch(
      /static boolean defaultPriority\(String kind\) \{\s*return KIND_ADHAN\.equals\(kind\) \|\| KIND_IQAMA\.equals\(kind\);/,
    );
  });

  it("«تجربة شاملة» تسلك المسار نفسه وتسجّل الطريقة", () => {
    const plugin = java("ManarAdhanPlugin");
    const test = plugin.slice(plugin.indexOf("public void testAlarm("));
    expect(test).toContain("AdhanScheduler.armExact(context, am, at, pi, priority)");
    expect(test).toContain("ManarLog.TEST_SCHEDULED, key, mode");
    expect(read("src/lib/native-notifications.ts")).toContain("priority: s.alarmClockPriority");
  });
});

describe("سجل التنبيهات يذكر أولوية المنبّه", () => {
  it("الجدولة", () => {
    const line = describeLogEvent({ at: 0, type: "scheduled", key: "", detail: "40/30/exact/12" });
    expect(line).toContain("بأولوية المنبّه");
    expect(line).toContain("١٢");
  });
  it("سجل قديم بثلاثة حقول لا يذكرها", () => {
    const line = describeLogEvent({ at: 0, type: "scheduled", key: "", detail: "40/30/exact" });
    expect(line).not.toContain("أولوية");
  });
  it("التجربة", () => {
    expect(describeLogEvent({ at: 0, type: "test_scheduled", key: "t", detail: "clock" })).toBe(
      "ضُبطت تجربة شاملة بأولوية المنبّه",
    );
  });
});

describe("البيان (Manifest)", () => {
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  it("الرجوع التنبّئي مفعّل — الرجوع يمرّ من OnBackPressedDispatcher", () => {
    expect(manifest).toContain('android:enableOnBackInvokedCallback="true"');
    const appPlugin = read(
      "node_modules/@capacitor/app/android/src/main/java/com/capacitorjs/plugins/app/AppPlugin.java",
    );
    expect(appPlugin).toContain("getOnBackPressedDispatcher().addCallback");
  });
  it("تعليق الإنترنت يطابق الاستعمال الفعلي", () => {
    expect(manifest).not.toContain("cloud sync");
    expect(manifest).toContain("Nominatim");
    expect(manifest).toContain("everyayah");
  });
});
