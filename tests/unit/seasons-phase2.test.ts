/* مواسم منار — المرحلة الثانية من خطة الإصلاح: المنطق والأداء والصياغة. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { dayKey, type ActivityLog } from "@/lib/activity-log";
import { countAr, countedNoun } from "@/lib/format";
import { fromHijri } from "@/lib/hijri";
import { SEASONS } from "@/lib/seasons/definitions";
import {
  addDays,
  findSeason,
  getSeasonState,
  instancesAround,
  seasonsOverview,
} from "@/lib/seasons/engine";
import { dayUnit, daysAr, seasonOf, statusLine } from "@/lib/seasons/labels";
import {
  DEFAULT_NOTIFY,
  SEASONS_EVENT,
  SEASONS_PLAN_EVENT,
  defaultGoal,
  fastingBlocked,
  goalProgress,
  goalTiming,
  nextPhaseTitle,
  seasonsChangeEvent,
  type SeasonsStore,
} from "@/lib/seasons/store";
import type { Season, SeasonAction } from "@/lib/seasons/types";

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const H = (year: number, month: number, day: number) => fromHijri({ year, month, day });
const S = (id: string): Season => findSeason(id)!;
const A = (s: Season, id: string): SeasonAction => s.recommendedActions.find((a) => a.id === id)!;
const EMPTY: ActivityLog = { bestStreak: 0, days: {} };

/* ------------------------------ ٢.١ ------------------------------ */

describe("٢.١ الإنجاز لا يُعيد جدولة الإشعارات", () => {
  const base: SeasonsStore = { notify: DEFAULT_NOTIFY, plans: {} };

  it("تغيير الخطة وحدها ← حدث الخطة", () => {
    const next: SeasonsStore = {
      ...base,
      plans: {
        "ramadan@2027-02-08": {
          fast: { enabled: true, frequency: "daily", target: 1, done: ["2027-02-08"] },
        },
      },
    };
    expect(seasonsChangeEvent(base, next)).toBe(SEASONS_PLAN_EVENT);
  });

  it("تغيير التفضيلات ← حدث التنبيهات", () => {
    expect(
      seasonsChangeEvent(base, { ...base, notify: { ...DEFAULT_NOTIFY, enabled: false } }),
    ).toBe(SEASONS_EVENT);
    expect(
      seasonsChangeEvent(base, {
        ...base,
        notify: { ...DEFAULT_NOTIFY, seasons: { friday: true } },
      }),
    ).toBe(SEASONS_EVENT);
    expect(
      seasonsChangeEvent(base, {
        ...base,
        notify: { ...DEFAULT_NOTIFY, evening: { hour: 21, minute: 0 } },
      }),
    ).toBe(SEASONS_EVENT);
  });

  it("إعادة الجدولة تستمع لحدث التنبيهات لا الخطة، والواجهة للاثنين", () => {
    const provider = read("src/components/manar/adhan-provider.tsx");
    expect(provider).toContain(`"${SEASONS_EVENT}"`);
    expect(provider).not.toContain(SEASONS_PLAN_EVENT);
    const store = read("src/lib/seasons/store.ts");
    expect(store).toContain("addEventListener(SEASONS_PLAN_EVENT, sync)");
    // استعادة النسخة الاحتياطية تُطلق حدث التنبيهات (إعادة جدولة كاملة).
    expect(read("src/lib/local-backup.ts")).toContain(`"manar.seasons.v1": "${SEASONS_EVENT}"`);
  });
});

/* ------------------------------ ٢.٢ ------------------------------ */

describe("٢.٢ الأهداف التلقائية", () => {
  it("إنجاز اليوم من السجل: مُحتسب، والزر لا يعمل", () => {
    const r = S("ramadan");
    const today = H(1447, 9, 5);
    const st = getSeasonState(r, today)!;
    const log: ActivityLog = {
      bestStreak: 0,
      days: {
        [dayKey(today)]: {
          prayers: ["fajr", "dhuhr", "asr", "maghrib", "isha"],
          ayahs: 0,
          azkar: 0,
          wird: [],
        },
      },
    };
    const a = A(r, "prayers");
    const p = goalProgress(defaultGoal(a), a, st.instance, log, today);
    expect(p.todayAuto).toBe(true);
    expect(p.todayDone).toBe(true);
    expect(p.canMark).toBe(false);
    const q = goalProgress(defaultGoal(a), a, st.instance, EMPTY, today);
    expect(q.todayAuto).toBe(false);
    expect(q.canMark).toBe(true);
  });
});

/* ------------------------------ ٢.٣ ------------------------------ */

describe("٢.٣ لا تسجيل صيام في يوم منهيّ عنه", () => {
  const fast: SeasonAction = {
    id: "x",
    title: "صيام",
    goal: { frequency: "count", target: 3, fasting: true },
  };
  const plain: SeasonAction = { id: "y", title: "ذكر", goal: { frequency: "daily" } };

  it("يوم عيد الفطر وأيام التشريق", () => {
    expect(fastingBlocked(fast, H(1447, 10, 1))).toContain("عيد الفطر");
    expect(fastingBlocked(fast, H(1446, 12, 10))).toContain("عيد الأضحى");
    expect(fastingBlocked(fast, H(1446, 12, 12))).toContain("أيام التشريق");
    expect(fastingBlocked(fast, H(1447, 10, 2))).toBeNull();
    expect(fastingBlocked(plain, H(1447, 10, 1))).toBeNull();
  });

  it("في التقدّم: ممنوع التسجيل مع السبب", () => {
    const sh = S("shawwal");
    const eid = H(1447, 10, 1);
    const st = getSeasonState(sh, eid)!;
    const p = goalProgress(defaultGoal(fast), fast, st.instance, EMPTY, eid);
    expect(p.canMark).toBe(false);
    expect(p.blocked).toContain("عيد الفطر");
  });

  it("أهداف الصيام في التعريفات موسومة", () => {
    const tagged = SEASONS.flatMap((s) =>
      s.recommendedActions.filter((a) => a.goal?.fasting).map((a) => `${s.id}/${a.id}`),
    );
    for (const id of [
      "ramadan/fast",
      "ramadan/qada",
      "shaban/fast",
      "shawwal/six",
      "dhul-hijjah/arafah-fast",
      "muharram/ashura",
      "monday-thursday/fast",
      "white-days/fast",
    ])
      expect(tagged).toContain(id);
  });
});

/* ------------------------------ ٢.٤ ------------------------------ */

describe("٢.٤ الخطة حسب المرحلة", () => {
  const r = S("ramadan");

  it("منتصف رمضان: القضاء مضى، وإحياء الليل وزكاة الفطر قادمان", () => {
    const d = H(1447, 9, 10);
    const st = getSeasonState(r, d)!;
    const t = (id: string) => goalTiming(A(r, id), st.instance, st.phase?.id, d);
    expect(t("qada")).toBe("past");
    expect(t("fast")).toBe("now");
    expect(t("qiyam")).toBe("later");
    expect(t("zakat-fitr")).toBe("later");
    expect(nextPhaseTitle(A(r, "qiyam"), st.instance, d)).toBe("العشر الأواخر");
  });

  it("قبل رمضان: القضاء الآن، والصيام قادم", () => {
    const d = addDays(H(1447, 9, 1), -10);
    const st = getSeasonState(r, d)!;
    expect(st.phase?.id).toBe("before");
    expect(goalTiming(A(r, "qada"), st.instance, st.phase?.id, d)).toBe("now");
    expect(goalTiming(A(r, "fast"), st.instance, st.phase?.id, d)).toBe("later");
  });

  it("متى يُسجَّل: مراحل الاحتساب", () => {
    const dh = S("dhul-hijjah");
    const d = H(1446, 12, 3);
    const st = getSeasonState(dh, d)!;
    expect(nextPhaseTitle(A(dh, "arafah-fast"), st.instance, d, "track")).toBe("يوم عرفة");
  });
});

/* ------------------------------ ٢.٥ ------------------------------ */

describe("٢.٥ صيغ العدد", () => {
  it("countAr", () => {
    expect(countAr(1, "موسم", "موسمان", "مواسم")).toBe("موسم واحد");
    expect(countAr(2, "موسم", "موسمان", "مواسم")).toBe("موسمان");
    expect(countAr(5, "موسم", "موسمان", "مواسم")).toBe("٥ مواسم");
    expect(countAr(11, "تذكير", "تذكيران", "تذكيرات")).toBe("١١ تذكيراً");
    expect(countAr(100, "تذكير", "تذكيران", "تذكيرات")).toBe("١٠٠ تذكير");
    expect(countAr(103, "تذكير", "تذكيران", "تذكيرات")).toBe("١٠٣ تذكيرات");
  });

  it("الأيام بعد رقم", () => {
    expect(daysAr(3)).toBe("٣ أيام");
    expect(daysAr(10)).toBe("١٠ أيام");
    expect(daysAr(11)).toBe("١١ يومًا");
    expect(daysAr(99)).toBe("٩٩ يومًا");
    expect(daysAr(100)).toBe("١٠٠ يوم");
    expect(daysAr(102)).toBe("١٠٢ يوم");
    expect(daysAr(105)).toBe("١٠٥ أيام");
    expect(daysAr(132)).toBe("١٣٢ يومًا");
    expect(dayUnit(1)).toBe("يوم");
    expect(dayUnit(2)).toBe("يومان");
    expect(dayUnit(30)).toBe("يومًا");
    expect(countedNoun(7, "يوم", "أيام", "يومًا")).toBe("أيام");
  });

  it("لا صيغ عدد ثابتة في واجهة المواسم", () => {
    const detail = read("src/routes/seasons.$season.tsx");
    const index = read("src/routes/seasons.index.tsx");
    expect(detail).not.toContain("تذكيرات هادئة");
    expect(detail).not.toContain('"يوم" : "أيام"');
    expect(detail).not.toContain('" يومًا"');
    expect(index).not.toContain("مواسم ·");
    expect(index).not.toContain("مفعّلة لـ");
  });
});

/* ------------------------------ ٢.٦ ------------------------------ */

describe("٢.٦ النظرة العامة بلا تكرار، والأولوية للتمهيد القريب", () => {
  const ids = (xs: { instance: { season: Season } }[]) => xs.map((s) => s.instance.season.id);

  it("يوم عيد الفطر: لا تكرار لرمضان المنتهي ولا لبداية الشهر", () => {
    const ov = seasonsOverview(H(1447, 10, 1));
    expect(ov.featured?.instance.season.id).toBe("shawwal");
    expect(ids(ov.around)).not.toContain("ramadan");
    expect(ids(ov.current)).not.toContain("month-start");
  });

  it("غرّة المحرّم ورمضان: بداية الشهر لا تتكرّر مع الموسم السنوي", () => {
    expect(ids(seasonsOverview(H(1447, 1, 1)).current)).not.toContain("month-start");
    expect(ids(seasonsOverview(H(1447, 9, 1)).current)).not.toContain("month-start");
    // وفي شهر بلا موسم سنوي تبقى.
    expect(ids(seasonsOverview(H(1447, 4, 1)).current)).toContain("month-start");
  });

  it("ما بعد رمضان يبقى في «اليوم أيضًا» (مرحلته لا تتكرّر)", () => {
    const ov = seasonsOverview(H(1447, 10, 4));
    expect(ids(ov.around)).toContain("ramadan");
  });

  it("آخر أسبوع من شعبان: رمضان مميّز، وقبله شعبان", () => {
    const late = seasonsOverview(addDays(H(1447, 9, 1), -5));
    expect(late.featured?.instance.season.id).toBe("ramadan");
    expect(ids(late.current)).toContain("shaban");
    const mid = seasonsOverview(H(1447, 8, 10));
    expect(mid.featured?.instance.season.id).toBe("shaban");
  });
});

/* ------------------------------ ٢.٨ ------------------------------ */

describe("٢.٨ اسم الموسم في سطر الحالة", () => {
  it("«من ذي الحجة» و«على ذي الحجة»", () => {
    const dh = S("dhul-hijjah");
    expect(seasonOf(dh)).toBe("ذي الحجة");
    expect(statusLine(getSeasonState(dh, H(1446, 12, 5))!)).toBe("اليوم ٥ من ذي الحجة.");
    expect(statusLine(getSeasonState(dh, addDays(H(1446, 12, 1), -5))!)).toBe(
      "بقي ٥ أيام على ذي الحجة.",
    );
    expect(statusLine(getSeasonState(S("muharram"), H(1447, 1, 12))!)).toBe("اليوم ١٢ من المحرم.");
  });

  it("عنوان صفحة المواسم يتبع خيار «اليوم الهجري عند المغرب»", () => {
    const index = read("src/routes/seasons.index.tsx");
    expect(index).toContain("hijriDisplayDate(");
    expect(index).toContain("atMaghrib");
  });

  it("أوقات التذكير في صفحة المواسم لا في صفحة كل موسم", () => {
    expect(read("src/routes/seasons.$season.tsx")).not.toContain('type="time"');
    expect(read("src/routes/seasons.index.tsx")).toContain('type="time"');
  });
});

/* ------------------------------ ٢.٩ ------------------------------ */

describe("٢.٩ تخزين نُسخ المواسم", () => {
  it("الاستدعاء نفسه يعيد النتيجة المخزّنة، والإزاحة مفتاح مستقل", () => {
    const r = S("ramadan");
    const d = H(1447, 9, 10);
    const a = instancesAround(r, d, 0);
    expect(instancesAround(r, new Date(d.getTime() + 3600_000), 0)).toBe(a);
    const b = instancesAround(r, d, 1);
    expect(b).not.toBe(a);
    expect(b[1].startDate.getTime()).not.toBe(a[1].startDate.getTime());
  });

  it("الموسم المعرَّف خارج القائمة لا يشارك المخزن", () => {
    const r = S("ramadan");
    const clone: Season = { ...r, id: "ramadan", cycle: { ...r.cycle } };
    const d = H(1447, 9, 10);
    expect(instancesAround(clone, d)).not.toBe(instancesAround(r, d));
    expect(instancesAround(clone, d)[0].season).toBe(clone);
  });
});
