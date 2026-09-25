import { describe, expect, it } from "vitest";
import { dayKey, type ActivityLog } from "@/lib/activity-log";
import { fromHijri, toHijri } from "@/lib/hijri";
import { SEASONS } from "@/lib/seasons/definitions";
import {
  addDays,
  daysBetween,
  findSeason,
  getSeasonState,
  importantDaysOf,
  instancesAround,
  seasonNotificationsBetween,
  seasonsOverview,
} from "@/lib/seasons/engine";
import { DEFAULT_NOTIFY, defaultGoal, goalProgress, normalizeStore } from "@/lib/seasons/store";
import type { Season } from "@/lib/seasons/types";

const H = (year: number, month: number, day: number, adjust = 0) =>
  fromHijri({ year, month, day }, adjust);
const S = (id: string): Season => {
  const s = findSeason(id);
  if (!s) throw new Error(`missing season ${id}`);
  return s;
};
const key = (d: Date) => dayKey(d);

describe("التعريفات", () => {
  it("معرّفات فريدة وبنية سليمة", () => {
    const ids = SEASONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SEASONS) {
      expect(s.phases.length).toBeGreaterThan(0);
      expect(s.references.length).toBeGreaterThan(0);
      const actionIds = s.recommendedActions.map((a) => a.id);
      expect(new Set(actionIds).size).toBe(actionIds.length);
      const phaseIds = new Set(s.phases.map((p) => p.id));
      for (const a of s.recommendedActions)
        for (const p of a.phases ?? []) expect(phaseIds).toContain(p);
    }
  });

  it("يغطي المواسم المطلوبة", () => {
    for (const id of [
      "ramadan",
      "dhul-hijjah",
      "shawwal",
      "muharram",
      "shaban",
      "hajj",
      "friday",
      "white-days",
      "monday-thursday",
      "month-start",
    ]) {
      expect(findSeason(id)).toBeTruthy();
    }
  });
});

describe("التقويم الهجري المرجعي", () => {
  it("١ محرم ١٤٤٧ = ٢٦ يونيو ٢٠٢٥ و١ شوال ١٤٤٦ = ٣٠ مارس ٢٠٢٥", () => {
    expect(key(H(1447, 1, 1))).toBe("2025-06-26");
    expect(key(H(1446, 10, 1))).toBe("2025-03-30");
  });
});

describe("رمضان", () => {
  const ramadan = S("ramadan");

  it("قبل رمضان: قادم مع عد تنازلي ومرحلة تمهيد", () => {
    const d = addDays(H(1447, 9, 1), -3);
    const st = getSeasonState(ramadan, d)!;
    expect(st.status).toBe("upcoming");
    expect(st.daysUntil).toBe(3);
    expect(st.phase).not.toBeNull();
  });

  it("اليوم الخامس من رمضان", () => {
    const st = getSeasonState(ramadan, H(1447, 9, 5))!;
    expect(st.status).toBe("current");
    expect(st.dayNumber).toBe(5);
    expect(st.phase?.id).not.toBe("last-ten");
    expect(st.daysLeft).toBe(st.instance.length - 4);
  });

  it("العشر الأواخر تبدأ ليلة ٢١", () => {
    expect(getSeasonState(ramadan, H(1447, 9, 20))!.phase?.id).not.toBe("last-ten");
    expect(getSeasonState(ramadan, H(1447, 9, 21))!.phase?.id).toBe("last-ten");
  });

  it("بعد رمضان: انتهى الموسم وشوال جارٍ", () => {
    const d = H(1447, 10, 3);
    const st = getSeasonState(ramadan, d)!;
    expect(st.status).toBe("ended");
    expect(st.phase).not.toBeNull();
    const sh = getSeasonState(S("shawwal"), d)!;
    expect(sh.status).toBe("current");
    expect(sh.dayNumber).toBe(3);
  });

  it("عيد الفطر في الأيام المهمة = ١ شوال", () => {
    const st = getSeasonState(ramadan, H(1447, 9, 10))!;
    const eid = importantDaysOf(st.instance, H(1447, 9, 10)).find((x) => x.id === "eid")!;
    expect(key(eid.date)).toBe(key(H(1447, 10, 1)));
  });

  it("طول رمضان يتبع الشهر الهجري (٢٩ أو ٣٠)", () => {
    const st = getSeasonState(ramadan, H(1447, 9, 1))!;
    expect([29, 30]).toContain(st.instance.length);
    expect(daysBetween(st.instance.startDate, H(1447, 10, 1))).toBe(st.instance.length);
  });
});

describe("ذو الحجة", () => {
  const dh = S("dhul-hijjah");

  it("يوم عرفة = ٩ ذي الحجة، والأضحى = ١٠", () => {
    expect(getSeasonState(dh, H(1446, 12, 9))!.phase?.id).toBe("arafah");
    expect(getSeasonState(dh, H(1446, 12, 10))!.phase?.id).toBe("adha");
    const st = getSeasonState(dh, H(1446, 12, 1))!;
    const days = importantDaysOf(st.instance, H(1446, 12, 1));
    expect(key(days.find((d) => d.id === "arafah")!.date)).toBe(key(H(1446, 12, 9)));
    expect(key(days.find((d) => d.id === "adha")!.date)).toBe(key(H(1446, 12, 10)));
  });

  it("أيام التشريق ١١–١٣ ثم ينتهي الموسم", () => {
    expect(getSeasonState(dh, H(1446, 12, 12))!.phase?.id).toBe("tashreeq");
    expect(getSeasonState(dh, H(1446, 12, 14))!.status).not.toBe("current");
  });

  it("الحج يوم ٨–١٣", () => {
    const hj = S("hajj");
    expect(getSeasonState(hj, H(1446, 12, 8))!.status).toBe("current");
    expect(getSeasonState(hj, H(1446, 12, 7))!.status).not.toBe("current");
  });
});

describe("محرم ورأس السنة", () => {
  it("حدود السنة الجديدة", () => {
    const m = S("muharram");
    const eve = addDays(H(1447, 1, 1), -1);
    const before = getSeasonState(m, eve)!;
    expect(before.status).toBe("upcoming");
    expect(before.daysUntil).toBe(1);
    const st = getSeasonState(m, H(1447, 1, 1))!;
    expect(st.status).toBe("current");
    expect(st.instance.hijriStart.year).toBe(1447);
    expect(getSeasonState(m, H(1447, 1, 10))!.phase?.id).toBe("ashura");
  });
});

describe("المتكررة", () => {
  it("الأيام البيض ١٣–١٥ وتُتخطّى في رمضان وذي الحجة", () => {
    const w = S("white-days");
    expect(getSeasonState(w, H(1447, 8, 13))!.status).toBe("current");
    expect(getSeasonState(w, H(1447, 8, 15))!.dayNumber).toBe(3);
    expect(getSeasonState(w, H(1447, 9, 13))!.status).not.toBe("current");
    expect(getSeasonState(w, H(1446, 12, 13))!.status).not.toBe("current");
  });

  it("ليلة الجمعة: الخميس = «غدًا الجمعة»", () => {
    const f = S("friday");
    const thu = new Date(2025, 5, 26, 12); // خميس
    expect(thu.getDay()).toBe(4);
    const st = getSeasonState(f, thu)!;
    expect(st.status).toBe("upcoming");
    expect(st.daysUntil).toBe(1);
    expect(st.phase?.id).toBe("eve");
    expect(getSeasonState(f, addDays(thu, 1))!.status).toBe("current");
  });

  it("صيام الإثنين والخميس لا يظهر داخل رمضان", () => {
    const mt = S("monday-thursday");
    let d = H(1447, 9, 5);
    while (d.getDay() !== 1) d = addDays(d, 1);
    expect(toHijri(d).month).toBe(9);
    expect(getSeasonState(mt, d)?.status).not.toBe("current");
    let o = H(1447, 8, 5);
    while (o.getDay() !== 1) o = addDays(o, 1);
    expect(getSeasonState(mt, o)!.status).toBe("current");
  });
});

describe("النظرة العامة", () => {
  it("رمضان يتقدّم على الجمعة في البطاقة المميّزة", () => {
    let d = H(1447, 9, 3);
    while (d.getDay() !== 5) d = addDays(d, 1);
    const ov = seasonsOverview(d);
    expect(ov.featured?.instance.season.id).toBe("ramadan");
    expect(ov.current.map((s) => s.instance.season.id)).toContain("friday");
  });

  it("لا يوجد موسم خاص: يُعرض الأقرب", () => {
    // منتصف ربيع الأول غالباً بلا موسم سنوي.
    const ov = seasonsOverview(H(1447, 3, 20));
    expect(ov.current.some((s) => s.instance.season.cycle.kind === "annual")).toBe(false);
    expect(ov.nearest).not.toBeNull();
    expect(ov.upcoming.length).toBeGreaterThan(0);
  });

  it("إزاحة التاريخ الهجري تُزحزح المواسم", () => {
    const r = S("ramadan");
    const a = instancesAround(r, H(1447, 9, 10), 0).find((i) => i.hijriStart.year === 1447)!;
    const b = instancesAround(r, H(1447, 9, 10), 1).find((i) => i.hijriStart.year === 1447)!;
    expect(Math.abs(daysBetween(a.startDate, b.startDate))).toBe(1);
  });
});

describe("التنبيهات", () => {
  const all: typeof DEFAULT_NOTIFY = {
    ...DEFAULT_NOTIFY,
    seasons: Object.fromEntries(SEASONS.map((s) => [s.id, true])),
  };

  it("تنبيه واحد كحد أقصى لكل فترة في اليوم", () => {
    const list = seasonNotificationsBetween(H(1446, 8, 1), 400, 0, all);
    const slots = list.map((n) => `${n.dayIndex}:${n.slot}`);
    expect(new Set(slots).size).toBe(slots.length);
    const keys = list.map((n) => n.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(list.length).toBeGreaterThan(0);
  });

  it("«بقي ٣ أيام على رمضان» في يومها", () => {
    const start = addDays(H(1447, 9, 1), -5);
    const list = seasonNotificationsBetween(start, 10, 0, DEFAULT_NOTIFY);
    const d3 = list.find((n) => n.seasonId === "ramadan" && n.dayIndex === 2);
    expect(d3?.body).toContain("٣");
  });

  it("الإيقاف العام يُلغي كل التنبيهات", () => {
    expect(seasonNotificationsBetween(new Date(), 30, 0, { ...all, enabled: false })).toEqual([]);
  });

  it("المتكررة متوقفة افتراضياً", () => {
    const list = seasonNotificationsBetween(new Date(2025, 5, 1, 12), 60, 0, DEFAULT_NOTIFY);
    expect(list.some((n) => n.seasonId === "friday")).toBe(false);
  });
});

describe("خطتي في الموسم", () => {
  it("تطبيع التخزين التالف", () => {
    const s = normalizeStore({
      notify: { morning: { hour: 99 } },
      plans: { x: { a: { target: -3, done: ["bad", "2025-01-01"] } } },
    });
    expect(s.notify.morning).toEqual(DEFAULT_NOTIFY.morning);
    expect(s.plans.x.a.target).toBe(1);
    expect(s.plans.x.a.done).toEqual(["2025-01-01"]);
  });

  it("التقدّم يجمع اليدوي مع سجل النشاط", () => {
    const r = S("ramadan");
    const inst = getSeasonState(r, H(1447, 9, 5))!.instance;
    const action = r.recommendedActions.find((a) => a.goal?.auto === "prayers")!;
    const d1 = key(inst.startDate);
    const d2 = key(addDays(inst.startDate, 1));
    const log: ActivityLog = {
      bestStreak: 0,
      days: {
        [d1]: {
          prayers: ["fajr", "dhuhr", "asr", "maghrib", "isha"],
          ayahs: 0,
          azkar: 0,
          wird: [],
        },
      },
    };
    const goal = { ...defaultGoal(action), done: [d2, "1999-01-01"] };
    const p = goalProgress(goal, action, inst, log, addDays(inst.startDate, 4));
    expect(p.done).toBe(2);
    expect(p.target).toBe(inst.length);
    expect(p.todayDone).toBe(false);
  });
});

describe("نصوص الحالة", () => {
  it("صيغ العدد والحالات", async () => {
    const { daysAr, statusLine } = await import("@/lib/seasons/labels");
    expect(daysAr(1)).toBe("يوم واحد");
    expect(daysAr(2)).toBe("يومان");
    expect(daysAr(3)).toBe("٣ أيام");
    expect(daysAr(11)).toBe("١١ يومًا");
    const r = S("ramadan");
    expect(statusLine(getSeasonState(r, H(1447, 9, 4))!)).toBe("اليوم ٤ من رمضان.");
    expect(statusLine(getSeasonState(S("shawwal"), H(1447, 10, 4))!)).toBe("اليوم ٤ من الموسم.");
    expect(statusLine(getSeasonState(r, H(1447, 10, 3))!)).toBe("انتهى الموسم.");
  });
});

describe("فتح تنبيه الموسم", () => {
  it("النقر على تنبيه موسم معروف يعيد معرّفه فقط", async () => {
    const { seasonIdFromNotificationTap: f } = await import("@/lib/seasons/notification-route");
    const n = (extra: unknown, actionId = "tap") => ({ actionId, notification: { extra } });
    expect(f(n({ kind: "season", season: "ramadan", route: "/seasons/ramadan" }))).toBe("ramadan");
    expect(f(n({ kind: "season", season: "ramadan" }, "stop"))).toBeNull();
    expect(f(n({ kind: "season", season: "unknown" }))).toBeNull();
    expect(f(n({ kind: "daily-reminder", reminder: "x" }))).toBeNull();
    expect(f(n(undefined))).toBeNull();
    expect(f(null)).toBeNull();
  });
});
