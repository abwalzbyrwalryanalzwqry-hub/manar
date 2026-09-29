/* مواسم منار — المرحلة الأولى من خطة الإصلاح:
 * ١.١ نسخة قادمة دائماً للمتكررة، ١.٢–١.٣ أيام احتساب الأهداف،
 * ١.٤ عدّ المواسم المفعّلة افتراضياً، ١.٥ أوقات لوحتي الصيام والليل. */

import { describe, expect, it } from "vitest";
import { dayKey, type ActivityLog } from "@/lib/activity-log";
import { otherAlertRows } from "@/lib/alert-center";
import { fromHijri, toHijri } from "@/lib/hijri";
import { SEASONS } from "@/lib/seasons/definitions";
import {
  activeSeasonNotifyCount,
  addDays,
  daysBetween,
  findSeason,
  getSeasonState,
  nextInstance,
  seasonsOverview,
} from "@/lib/seasons/engine";
import { fastingPanelTimes, nightPanelTimes } from "@/lib/seasons/panel-times";
import {
  DEFAULT_NOTIFY,
  defaultGoal,
  goalDayKeys,
  goalProgress,
  isGoalDay,
} from "@/lib/seasons/store";
import type { Season, SeasonAction } from "@/lib/seasons/types";

const H = (year: number, month: number, day: number, adjust = 0) =>
  fromHijri({ year, month, day }, adjust);
const S = (id: string): Season => {
  const s = findSeason(id);
  if (!s) throw new Error(`missing season ${id}`);
  return s;
};
const A = (season: Season, id: string): SeasonAction => {
  const a = season.recommendedActions.find((x) => x.id === id);
  if (!a) throw new Error(`missing action ${season.id}/${id}`);
  return a;
};
const EMPTY_LOG: ActivityLog = { bestStreak: 0, days: {} };

/* ------------------------------ ١.١ ------------------------------ */

describe("١.١ لكل موسم نسخة في كل يوم", () => {
  it("الاثنين والخميس: حالة ونسخة قادمة في كل يوم من رمضان ١٤٤٧ و١٤٤٨", () => {
    const mt = S("monday-thursday");
    for (const year of [1447, 1448]) {
      const start = H(year, 9, 1);
      for (let i = 0; i < 31; i++) {
        const d = addDays(start, i);
        const st = getSeasonState(mt, d);
        expect(st, `${year} +${i}`).not.toBeNull();
        const next = nextInstance(mt, d);
        expect(next, `${year} +${i}`).not.toBeNull();
        // القادمة ليست في رمضان ولا يوم العيد.
        const h = toHijri(next!.startDate);
        expect(h.month === 9 || (h.month === 10 && h.day === 1)).toBe(false);
      }
    }
  });

  it("الاثنين والخميس يبقى في «أيام متكررة» طوال رمضان", () => {
    const d = H(1447, 9, 12);
    const ov = seasonsOverview(d);
    expect(ov.recurring.map((s) => s.instance.season.id)).toContain("monday-thursday");
  });

  it("كل المواسم: حالة غير فارغة يومياً لسنة كاملة، وأسبوعياً مع الإزاحات ±٢", () => {
    const start = H(1447, 1, 1);
    for (let i = 0; i < 360; i++) {
      const d = addDays(start, i);
      for (const s of SEASONS) {
        expect(getSeasonState(s, d), `${s.id} +${i}`).not.toBeNull();
        expect(nextInstance(s, d), `${s.id} next +${i}`).not.toBeNull();
      }
    }
    for (const adjust of [-2, -1, 1, 2]) {
      for (let i = 0; i < 360; i += 7) {
        const d = addDays(start, i);
        for (const s of SEASONS) {
          expect(getSeasonState(s, d, adjust), `${s.id} ${adjust} +${i}`).not.toBeNull();
        }
      }
    }
  });
});

/* ------------------------------ ١.٢ ------------------------------ */

describe("١.٢ أيام احتساب الهدف", () => {
  const ramadan = S("ramadan");

  it("قضاء ما فات: يُسجَّل ويُحتسب في أيام التمهيد قبل رمضان", () => {
    const d = addDays(H(1447, 9, 1), -5);
    const st = getSeasonState(ramadan, d)!;
    expect(st.status).toBe("upcoming");
    expect(st.phase?.id).toBe("prep");
    const qada = A(ramadan, "qada");
    const goal = { ...defaultGoal(qada), done: [dayKey(d)] };
    const p = goalProgress(goal, qada, st.instance, EMPTY_LOG, d);
    expect(p.canMark).toBe(true);
    expect(p.done).toBe(1);
    expect(p.todayDone).toBe(true);
    expect(p.target).toBe(3);
    // وداخل رمضان لا يُسجَّل.
    const inside = goalProgress(goal, qada, st.instance, EMPTY_LOG, H(1447, 9, 3));
    expect(inside.canMark).toBe(false);
  });

  it("صيام عرفة: لا يُحتسب قبل يومه ولو ظهر في الخطة", () => {
    const dh = S("dhul-hijjah");
    const a = A(dh, "arafah-fast");
    const before = H(1446, 12, 5);
    const st = getSeasonState(dh, before)!;
    const early = goalProgress(
      { ...defaultGoal(a), done: [dayKey(before)] },
      a,
      st.instance,
      EMPTY_LOG,
      before,
    );
    expect(early.canMark).toBe(false);
    expect(early.done).toBe(0);
    const arafah = H(1446, 12, 9);
    const onDay = goalProgress(
      { ...defaultGoal(a), done: [dayKey(arafah)] },
      a,
      st.instance,
      EMPTY_LOG,
      arafah,
    );
    expect(onDay.canMark).toBe(true);
    expect(onDay.complete).toBe(true);
  });

  it("الست من شوال: يوم العيد ليس من أيام الاحتساب", () => {
    const sh = S("shawwal");
    const a = A(sh, "six");
    const st = getSeasonState(sh, H(1447, 10, 1))!;
    const keys = goalDayKeys(a, st.instance);
    expect(keys).not.toContain(dayKey(H(1447, 10, 1)));
    expect(keys[0]).toBe(dayKey(H(1447, 10, 2)));
  });

  it("زكاة الفطر: يُسجَّل يوم العيد والموسم منتهٍ", () => {
    const eid = H(1447, 10, 1);
    const st = getSeasonState(ramadan, eid)!;
    expect(st.status).toBe("ended");
    expect(isGoalDay(A(ramadan, "zakat-fitr"), st.instance, eid)).toBe(true);
    expect(isGoalDay(A(ramadan, "fast"), st.instance, eid)).toBe(false);
  });

  it("التلقائي لا يُحتسب خارج أيامه", () => {
    const a = A(ramadan, "prayers");
    const st = getSeasonState(ramadan, H(1447, 9, 5))!;
    const outside = dayKey(addDays(st.instance.startDate, -1));
    const log: ActivityLog = {
      bestStreak: 0,
      days: {
        [outside]: {
          prayers: ["fajr", "dhuhr", "asr", "maghrib", "isha"],
          ayahs: 0,
          azkar: 0,
          wird: [],
        },
      },
    };
    expect(goalProgress(defaultGoal(a), a, st.instance, log, H(1447, 9, 5)).done).toBe(0);
  });

  it("مراحل الاحتساب معرّفة في مراحل موسمها", () => {
    for (const s of SEASONS) {
      const ids = new Set(s.phases.map((p) => p.id));
      for (const a of s.recommendedActions)
        for (const p of a.goal?.trackPhases ?? []) expect(ids, `${s.id}/${a.id}`).toContain(p);
    }
  });
});

/* ------------------------------ ١.٣ ------------------------------ */

describe("١.٣ هدف «كل يوم» بعدد أيام ظهوره", () => {
  it("إحياء الليل = أيام العشر الأواخر لا الشهر كله", () => {
    const r = S("ramadan");
    const st = getSeasonState(r, H(1447, 9, 25))!;
    const p = goalProgress(defaultGoal(A(r, "qiyam")), A(r, "qiyam"), st.instance, EMPTY_LOG);
    expect(p.target).toBe(st.instance.length - 20);
    expect([9, 10]).toContain(p.target);
  });

  it("العمل الصالح في ذي الحجة = ٩ أيام، والذكر = ١٣", () => {
    const dh = S("dhul-hijjah");
    const st = getSeasonState(dh, H(1446, 12, 3))!;
    const t = (id: string) =>
      goalProgress(defaultGoal(A(dh, id)), A(dh, id), st.instance, EMPTY_LOG).target;
    expect(t("good-deeds")).toBe(9);
    expect(t("dhikr")).toBe(13);
  });

  it("الصلوات في رمضان = أيام الشهر كاملة (بلا تغيير)", () => {
    const r = S("ramadan");
    const st = getSeasonState(r, H(1447, 9, 5))!;
    const p = goalProgress(defaultGoal(A(r, "prayers")), A(r, "prayers"), st.instance, EMPTY_LOG);
    expect(p.target).toBe(st.instance.length);
  });

  it("هدف «عدد أيام» لا يتجاوز أيام احتسابه", () => {
    const m = S("muharram");
    const a = A(m, "ashura");
    const st = getSeasonState(m, H(1447, 1, 5))!;
    const p = goalProgress({ ...defaultGoal(a), target: 20 }, a, st.instance, EMPTY_LOG);
    expect(p.windowDays).toBe(2);
    expect(p.target).toBe(2);
  });
});

/* ------------------------------ ١.٤ ------------------------------ */

describe("١.٤ مركز التنبيهات يعدّ المواسم المفعّلة افتراضياً", () => {
  const rows = (seasons: typeof DEFAULT_NOTIFY) =>
    otherAlertRows({
      daily: { enabled: false, items: [] },
      seasons,
      jumuah: { remindEarly: false, remindKahf: false, remindHour: false },
      sakinah: { enabled: false },
    }).find((r) => r.id === "seasons")!;

  it("الإعداد الافتراضي: مفعّلة بعدد المواسم الافتراضية", () => {
    const expected = SEASONS.filter(
      (s) => s.enabled && s.reminders.length && s.notificationSettings.defaultEnabled,
    ).length;
    expect(expected).toBeGreaterThan(0);
    expect(activeSeasonNotifyCount(DEFAULT_NOTIFY)).toBe(expected);
    const row = rows(DEFAULT_NOTIFY);
    expect(row.on).toBe(true);
    expect(row.detail).not.toBe("متوقّفة");
  });

  it("إطفاء موسم افتراضي وتفعيل متكرر يُحتسبان", () => {
    const base = activeSeasonNotifyCount(DEFAULT_NOTIFY);
    const p = { ...DEFAULT_NOTIFY, seasons: { ramadan: false, friday: true } };
    expect(activeSeasonNotifyCount(p)).toBe(base);
    expect(activeSeasonNotifyCount({ ...p, seasons: { ramadan: false } })).toBe(base - 1);
  });

  it("مواسم بلا تذكيرات لا تُعدّ، والمفتاح العام يُطفئ الكل", () => {
    expect(
      activeSeasonNotifyCount({ ...DEFAULT_NOTIFY, seasons: { shaban: true, hajj: true } }),
    ).toBe(activeSeasonNotifyCount(DEFAULT_NOTIFY));
    expect(rows({ ...DEFAULT_NOTIFY, enabled: false })).toMatchObject({
      on: false,
      detail: "متوقّفة",
    });
  });
});

/* ------------------------------ ١.٥ ------------------------------ */

describe("١.٥ أوقات لوحتي الصيام والليل", () => {
  const day = (d: number, fajr: number, maghrib: number, isha: number) => ({
    fajr: new Date(2027, 1, d, fajr, 0),
    maghrib: new Date(2027, 1, d, maghrib, 0),
    isha: new Date(2027, 1, d, isha, 30),
  });
  const y = day(9, 5, 18, 19);
  const t = day(10, 5, 18, 19);
  const n = day(11, 5, 18, 19);
  // الثلث الأخير الوهمي = مغرب الجدول + ٨ ساعات، لتمييز الليلة المختارة.
  const third = (x: typeof t) => new Date(x.maghrib.getTime() + 8 * 3600_000);

  it("قبل المغرب: إمساك اليوم وإفطاره", () => {
    const f = fastingPanelTimes(new Date(2027, 1, 10, 13), t, n);
    expect(f).toEqual({ imsak: t.fajr, iftar: t.maghrib, forTomorrow: false });
  });

  it("بعد المغرب: إمساك الغد وإفطاره", () => {
    const f = fastingPanelTimes(new Date(2027, 1, 10, 18, 5), t, n);
    expect(f).toEqual({ imsak: n.fajr, iftar: n.maghrib, forTomorrow: true });
  });

  it("بعد منتصف الليل وقبل الفجر: الليلة الجارية ليلة الأمس", () => {
    const r = nightPanelTimes(new Date(2027, 1, 10, 2), y, t, n, third);
    expect(r.night).toBe(y);
    expect(r.isha).toBe(y.isha);
    expect(r.lastThird).toEqual(third(y));
    expect(r.dawn).toBe(t.fajr);
    expect(r.ongoing).toBe(true);
    expect(daysBetween(r.lastThird, new Date(2027, 1, 10, 2))).toBe(0);
  });

  it("بعد الفجر: الليلة القادمة، وبعد المغرب: جارية", () => {
    const day1 = nightPanelTimes(new Date(2027, 1, 10, 10), y, t, n, third);
    expect(day1.night).toBe(t);
    expect(day1.ongoing).toBe(false);
    expect(day1.dawn).toBe(n.fajr);
    const eve = nightPanelTimes(new Date(2027, 1, 10, 21), y, t, n, third);
    expect(eve.night).toBe(t);
    expect(eve.ongoing).toBe(true);
  });
});
