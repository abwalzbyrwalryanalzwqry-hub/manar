import { describe, expect, it } from "vitest";
import {
  CUSTOM_TEMPLATES,
  DEFAULT_REMINDERS,
  MAX_CUSTOM_REMINDERS,
  PRAYER_OFFSET_OPTIONS,
  REMINDER_TONES,
  SUGGESTED_TONE,
  describeTiming,
  from12h,
  isDoneToday,
  newCustomReminder,
  normalizeRemindersState,
  offsetOptionsFor,
  planDailyReminders,
  reminderActionFromTap,
  reminderTimeOn,
  stepClock,
  switchTimingMode,
  timingWarning,
  to12h,
  toneKind,
  type DailyReminder,
  type DailyRemindersState,
} from "@/lib/daily-reminders";
import type { PrayerKey } from "@/lib/prayer";

/* مواقيت صنعاء التقريبية بالساعة المحلية للجهاز — لا من محرّك المواقيت، لأن
 * CI يعيد الاختبارات بمناطق زمنية أخرى (نيويورك، أوكلاند)، والتذكيرات تعمل
 * بالساعة المحلية للجهاز كما يراها المستخدم. */
const timesFor = (d: Date): Record<PrayerKey, Date> => {
  const at = (h: number, m: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
  return {
    fajr: at(4, 25),
    sunrise: at(5, 42),
    dhuhr: at(11, 45),
    asr: at(15, 10),
    maghrib: at(17, 50),
    isha: at(19, 5),
  };
};
const DAY = new Date(2026, 8, 24, 12); // خميس
const TIMES = timesFor(DAY);
const byId = (id: string) => structuredClone(DEFAULT_REMINDERS.find((r) => r.id === id)!);
const digits = (s: string | number) => String(s);

describe("الوِرد اليومي وخيارات الإزاحة", () => {
  it("قيمة الوِرد الافتراضية (٢٠ دقيقة) ضمن الخيارات فيظهر اختيارها", () => {
    const wird = byId("wird");
    expect(wird.timing).toEqual({ mode: "prayer", prayer: "fajr", offset: 20 });
    expect(PRAYER_OFFSET_OPTIONS).toContain(20);
    for (const r of DEFAULT_REMINDERS) {
      if (r.timing.mode === "prayer")
        expect(offsetOptionsFor(r.timing.offset)).toContain(r.timing.offset);
    }
  });

  it("إزاحة محفوظة خارج القائمة تُضاف إليها مرتّبة", () => {
    expect(offsetOptionsFor(25)).toEqual([-30, -15, 0, 15, 20, 25, 30, 45, 60, 90, 120]);
    expect(offsetOptionsFor(30)).toEqual([...PRAYER_OFFSET_OPTIONS]);
  });
});

describe("تبديل نوع التوقيت لا يمحو الإعداد", () => {
  it("من «منسوب لصلاة» إلى «ساعة ثابتة»: الساعة = موعده الفعلي اليوم مقرّباً", () => {
    const r = byId("azkar-evening"); // بعد العصر بـ٣٠ دقيقة
    const at = new Date(TIMES.asr.getTime() + 30 * 60_000);
    const { timing, altTiming } = switchTimingMode(r, "clock", TIMES);
    expect(timing.mode).toBe("clock");
    if (timing.mode !== "clock") return;
    const want = Math.round((at.getHours() * 60 + at.getMinutes()) / 5) * 5;
    expect(timing.hour * 60 + timing.minute).toBe(want);
    expect(altTiming).toEqual(r.timing);
    // ليست ٦:٠٠ الثابتة القديمة.
    expect(timing).not.toEqual({ mode: "clock", hour: 6, minute: 0 });
  });

  it("الرجوع إلى النمط السابق يستعيده كما كان", () => {
    const r = byId("wird");
    const toClock = { ...r, ...switchTimingMode(r, "clock", TIMES) };
    const back = { ...toClock, ...switchTimingMode(toClock, "prayer", TIMES) };
    expect(back.timing).toEqual({ mode: "prayer", prayer: "fajr", offset: 20 });
    expect(back.altTiming).toEqual(toClock.timing);
  });

  it("من ساعة ثابتة بلا سابق: أقرب صلاة قبلها وفرقها عنها", () => {
    const r = byId("sleep-azkar"); // ٢٢:٣٠
    const { timing } = switchTimingMode(r, "prayer", TIMES);
    expect(timing.mode).toBe("prayer");
    if (timing.mode !== "prayer") return;
    expect(timing.prayer).toBe("isha");
    const at = new Date(TIMES.isha.getTime() + timing.offset * 60_000);
    // ضمن خمس دقائق من ٢٢:٣٠ نفسها.
    expect(Math.abs(at.getHours() * 60 + at.getMinutes() - (22 * 60 + 30))).toBeLessThanOrEqual(5);
  });

  it("النمط نفسه لا يغيّر شيئاً", () => {
    const r = byId("wird");
    expect(switchTimingMode(r, "prayer", TIMES).timing).toBe(r.timing);
  });
});

describe("الساعة الثابتة", () => {
  it("الدقائق تنقل الساعة: ١١:٥٥ + ٥ = ١٢:٠٠، و١٢:٠٠ − ٥ = ١١:٥٥", () => {
    expect(stepClock(11, 55, 5)).toEqual({ hour: 12, minute: 0 });
    expect(stepClock(12, 0, -5)).toEqual({ hour: 11, minute: 55 });
    expect(stepClock(23, 55, 5)).toEqual({ hour: 0, minute: 0 });
    expect(stepClock(0, 0, -5)).toEqual({ hour: 23, minute: 55 });
  });

  it("دقيقة ليست من مضاعفات الخمس تلتصق بأقرب مضاعف في اتجاه الخطوة", () => {
    expect(stepClock(11, 57, 5)).toEqual({ hour: 12, minute: 0 });
    expect(stepClock(11, 57, -5)).toEqual({ hour: 11, minute: 55 });
  });

  it("المحدِّد بنظام ١٢ ساعة كالوصف فوقه", () => {
    expect(to12h(22)).toEqual({ h12: 10, pm: true });
    expect(to12h(0)).toEqual({ h12: 12, pm: false });
    expect(to12h(12)).toEqual({ h12: 12, pm: true });
    expect(from12h(10, true)).toBe(22);
    expect(from12h(12, false)).toBe(0);
    expect(from12h(12, true)).toBe(12);
    expect(describeTiming({ mode: "clock", hour: 22, minute: 30 }, digits)).toBe("10:30 مساءً");
  });
});

describe("تذكيران غير متداخلين", () => {
  it("«وِرد قبل النوم» لا يذكر أذكار النوم التي لها تذكيرها المستقل", () => {
    const night = byId("wird-night");
    const sleep = byId("sleep-azkar");
    expect(night.body).not.toContain("أذكار النوم");
    expect(sleep.name).toBe("أذكار النوم");
  });
});

describe("الأصوات", () => {
  it("كل صوت مصنّف نغمةً أو نداءً صوتياً، والنداءات هي حزمة الـ١٢", () => {
    const voices = REMINDER_TONES.filter((t) => t.kind === "voice");
    expect(voices).toHaveLength(12);
    for (const t of REMINDER_TONES) expect(["tone", "voice"]).toContain(t.kind);
    expect(toneKind("silent")).toBe("tone");
  });

  it("النداء المقترح لكل تذكير مبنيّ نداء صوتي موجود", () => {
    for (const r of DEFAULT_REMINDERS) {
      const id = SUGGESTED_TONE[r.id];
      expect(id, r.id).toBeDefined();
      expect(toneKind(id)).toBe("voice");
    }
    expect(SUGGESTED_TONE["azkar-morning"]).toMatch(/^azkar-morning-/);
  });
});

describe("تحذير التوقيت غير المنطقي", () => {
  const at = (base: Date, min: number) => new Date(base.getTime() + min * 60_000);
  it("أذكار الصباح قبل الفجر أو بعد الشروق", () => {
    const r = byId("azkar-morning");
    expect(timingWarning(r, at(TIMES.fajr, -10), TIMES)).toMatch(/قبل دخول الفجر/);
    expect(timingWarning(r, at(TIMES.sunrise, 10), TIMES)).toMatch(/بعد الشروق/);
    expect(timingWarning(r, at(TIMES.fajr, 45), TIMES)).toBeNull();
  });

  it("أذكار المساء قبل العصر أو بعد المغرب", () => {
    const r = byId("azkar-evening");
    expect(timingWarning(r, at(TIMES.asr, -10), TIMES)).toMatch(/قبل العصر/);
    expect(timingWarning(r, at(TIMES.maghrib, 10), TIMES)).toMatch(/بعد المغرب/);
    expect(timingWarning(r, at(TIMES.asr, 30), TIMES)).toBeNull();
  });

  it("لا تحذير للتذكيرات الأخرى", () => {
    expect(timingWarning(byId("sleep-azkar"), at(TIMES.fajr, -60), TIMES)).toBeNull();
  });
});

describe("تخطّي تذكير اليوم إذا أُنجز", () => {
  const state: DailyRemindersState = { enabled: true, items: structuredClone(DEFAULT_REMINDERS) };
  // ٢٤ سبتمبر ٢٠٢٦ ٢:٠٠ فجراً بصنعاء — قبل كل تذكيرات اليوم.
  const now = new Date(2026, 8, 24, 2).getTime();
  const todayOf = (wird: string[]) =>
    planDailyReminders(state, { now, days: 2, timesFor, wirdDoneToday: wird }).filter(
      (p) => p.dayIndex === 0,
    );

  it("بلا إنجاز: كل المفعّلة تُجدول اليوم", () => {
    expect(todayOf([]).map((p) => p.reminder.id)).toEqual([
      "azkar-morning",
      "azkar-evening",
      "wird",
    ]);
  });

  it("إكمال ورد الصباح يلغي تذكيري الصباح والوِرد اليوم فقط", () => {
    expect(todayOf(["morning"]).map((p) => p.reminder.id)).toEqual(["azkar-evening"]);
    const tomorrow = planDailyReminders(state, {
      now,
      days: 2,
      timesFor,
      wirdDoneToday: ["morning"],
    }).filter((p) => p.dayIndex === 1);
    expect(tomorrow).toHaveLength(3);
  });

  it("إكمال ورد المساء يلغي تذكير المساء", () => {
    expect(todayOf(["evening"]).map((p) => p.reminder.id)).toEqual(["azkar-morning", "wird"]);
  });

  it("إطفاء «تخطّي إذا أُنجز» يُبقي التذكير", () => {
    const r = byId("azkar-morning");
    expect(isDoneToday(r, ["morning"])).toBe(true);
    expect(isDoneToday({ ...r, skipIfDone: false }, ["morning"])).toBe(false);
    expect(isDoneToday(byId("sleep-azkar"), ["morning", "evening"])).toBe(false);
  });

  it("المفتاح العام المطفأ لا يُجدول شيئاً، والأيام المستثناة تُحترم", () => {
    expect(planDailyReminders({ ...state, enabled: false }, { now, days: 7, timesFor })).toEqual(
      [],
    );
    const only: DailyRemindersState = {
      enabled: true,
      items: [{ ...byId("azkar-morning"), days: [5] }],
    };
    const plan = planDailyReminders(only, { now, days: 7, timesFor });
    expect(plan).toHaveLength(1);
    expect(plan[0].at.getDay()).toBe(5);
  });

  it("المواعيد الماضية لا تُجدول", () => {
    const late = new Date(2026, 8, 24, 23).getTime();
    const plan = planDailyReminders(state, { now: late, days: 1, timesFor });
    expect(plan).toEqual([]);
  });
});

describe("فتح التنبيه في صفحته", () => {
  const n = (extra: unknown, actionId = "tap") => ({ actionId, notification: { extra } });
  it("النقر يعيد مسار التذكير، و«ذكّرني لاحقاً» يعيد التأجيل", () => {
    expect(
      reminderActionFromTap(n({ kind: "daily-reminder", reminder: "wird", route: "/wird" })),
    ).toEqual({ type: "open", route: "/wird", reminder: "wird" });
    expect(
      reminderActionFromTap(
        n({ kind: "daily-reminder", reminder: "azkar-morning", route: "/azkar" }, "snooze"),
      ),
    ).toEqual({ type: "snooze", reminder: "azkar-morning" });
  });

  it("مسار مجهول أو تنبيه آخر أو زرّ آخر لا يفتح شيئاً", () => {
    expect(
      reminderActionFromTap(n({ kind: "daily-reminder", reminder: "x", route: "/login" })),
    ).toBeNull();
    expect(reminderActionFromTap(n({ kind: "season", season: "ramadan" }))).toBeNull();
    expect(
      reminderActionFromTap(n({ kind: "daily-reminder", reminder: "x", route: "/azkar" }, "stop")),
    ).toBeNull();
    expect(reminderActionFromTap(null)).toBeNull();
  });
});

describe("التذكيرات التي يضيفها المستخدم", () => {
  it("تُحفظ وتُقرأ بعد الفحص، وتُلحق بعد المبنيّة", () => {
    const c = newCustomReminder("after-prayer", "بعد العصر", "custom-abc");
    const st = normalizeRemindersState({ enabled: true, items: [c] });
    expect(st.items).toHaveLength(DEFAULT_REMINDERS.length + 1);
    const got = st.items.at(-1)!;
    expect(got).toMatchObject({
      id: "custom-abc",
      name: "بعد العصر",
      custom: true,
      route: "/azkar",
    });
    expect(got.timing).toEqual(CUSTOM_TEMPLATES["after-prayer"].timing);
  });

  it("معرّف غير صالح أو مسار مجهول لا يمرّ", () => {
    const bad = { ...newCustomReminder("duha", undefined, "custom-x1"), route: "/login" };
    const st = normalizeRemindersState({ items: [bad, { id: "../evil", name: "x" }] });
    const customs = st.items.filter((i) => i.custom);
    expect(customs).toHaveLength(1);
    expect(customs[0].route).toBe(CUSTOM_TEMPLATES.duha.route);
  });

  it("لا يتجاوز الحد الأقصى ولا يتكرّر معرّف", () => {
    const many = Array.from({ length: MAX_CUSTOM_REMINDERS + 5 }, (_, i) =>
      newCustomReminder("other", undefined, `custom-${i}`),
    );
    many.push(newCustomReminder("other", undefined, "custom-0"));
    const st = normalizeRemindersState({ items: many });
    expect(st.items.filter((i) => i.custom)).toHaveLength(MAX_CUSTOM_REMINDERS);
  });

  it("المبنيّة: الاسم يُحفظ، والمسار والنصّ من الشيفرة دائماً", () => {
    const tampered: Partial<DailyReminder> = { id: "wird", route: "/login" as never, body: "x" };
    const st = normalizeRemindersState({ items: [tampered] });
    const w = st.items.find((i) => i.id === "wird")!;
    expect(w.route).toBe("/wird");
    expect(w.body).toBe(byId("wird").body);
    expect(w.custom).toBeUndefined();
  });

  it("ورد الضحى منسوب إلى الشروق ويُحسب وقته", () => {
    const duha = newCustomReminder("duha", undefined, "custom-d");
    const at = reminderTimeOn(duha, DAY, (p) => TIMES[p])!;
    expect(at.getTime() - TIMES.sunrise.getTime()).toBe(30 * 60_000);
  });
});
