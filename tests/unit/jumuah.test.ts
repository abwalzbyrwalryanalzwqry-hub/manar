import { describe, expect, it } from "vitest";
import {
  DEFAULT_JUMUAH_PREFS,
  isFriday,
  jumuahStats,
  jumuahTimeline,
  markableFridayKey,
  nextFridayKey,
  normalizeJumuah,
  planJumuahReminders,
  type JumuahStore,
} from "@/lib/jumuah";
import { computePrayerTimes, normalizeSettings, type LocationState } from "@/lib/prayer";
import { getAdhanSettings, type AdhanSettings } from "@/lib/adhan-settings";

const SANAA: LocationState = { lat: 15.3694, lng: 44.191, city: "صنعاء", source: "manual" };
const CALC = normalizeSettings({});
const ADHAN: AdhanSettings = structuredClone(getAdhanSettings());
// الجمعة ٢ أكتوبر ٢٠٢٦
const FRI = "2026-10-02";
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe("تواريخ الجمعة", () => {
  it("الجمعة القادمة، أو اليوم إن كان جمعة", () => {
    expect(nextFridayKey(local(2026, 9, 28))).toBe(FRI);
    expect(nextFridayKey(local(2026, 10, 2, 23))).toBe(FRI);
    expect(nextFridayKey(local(2026, 10, 3))).toBe("2026-10-09");
    expect(isFriday(local(2026, 10, 2))).toBe(true);
  });

  it("لا يُحتسب إلا يوم الجمعة: من فجرها إلى فجر السبت", () => {
    const fajrFri = local(2026, 10, 2, 4, 40);
    expect(markableFridayKey(local(2026, 10, 2, 13), fajrFri)).toBe(FRI);
    // ليلة الجمعة قبل الفجر ما زالت خميساً
    expect(markableFridayKey(local(2026, 10, 2, 3), fajrFri)).toBeNull();
    // ليلة السبت قبل الفجر ما زالت جمعة
    expect(markableFridayKey(local(2026, 10, 3, 2), local(2026, 10, 3, 4, 40))).toBe(FRI);
    expect(markableFridayKey(local(2026, 10, 3, 9), local(2026, 10, 3, 4, 40))).toBeNull();
    expect(markableFridayKey(local(2026, 9, 30, 13), local(2026, 9, 30, 4, 40))).toBeNull();
  });
});

describe("مواعيد الجمعة", () => {
  const t = jumuahTimeline(FRI, SANAA, CALC, ADHAN, DEFAULT_JUMUAH_PREFS);
  const fri = computePrayerTimes(SANAA, CALC, local(2026, 10, 2));
  const thu = computePrayerTimes(SANAA, CALC, local(2026, 10, 1));

  it("الأذان وقت الظهر، والإقامة بفاصل الجمعة", () => {
    expect(t.adhanAt.getTime()).toBe(fri.dhuhr.getTime());
    expect(t.iqamaAt!.getTime() - t.adhanAt.getTime()).toBe(ADHAN.jumuahIqamaOffset * 60_000);
    expect(t.adhanAt.getTime() - t.earlyAt.getTime()).toBe(60 * 60_000);
  });

  it("الكهف من مغرب الخميس إلى مغرب الجمعة، وساعة الإجابة آخر ساعة", () => {
    expect(t.kahfFrom.getTime()).toBe(thu.maghrib.getTime());
    expect(t.kahfTo.getTime()).toBe(fri.maghrib.getTime());
    expect(t.hourTo.getTime() - t.hourFrom.getTime()).toBe(60 * 60_000);
    expect(t.hourFrom.getTime()).toBeGreaterThanOrEqual(fri.asr.getTime());
  });

  it("إقامة الجمعة المطفأة لا موعد لها", () => {
    const off: AdhanSettings = { ...ADHAN, jumuahIqamaEnabled: false };
    expect(jumuahTimeline(FRI, SANAA, CALC, off, DEFAULT_JUMUAH_PREFS).iqamaAt).toBeNull();
  });
});

describe("التخزين يرفض غير الجمعة", () => {
  it("يوم ليس جمعة يُسقط حتى من ملف مستورد", () => {
    const s = normalizeJumuah({
      days: {
        [FRI]: { attended: true, kahf: true, bogus: true },
        "2026-10-01": { attended: true },
      },
      prefs: { earlyMinutes: 7 },
    });
    expect(Object.keys(s.days)).toEqual([FRI]);
    expect(s.days[FRI]).toEqual({ attended: true, kahf: true });
    expect(s.prefs.earlyMinutes).toBe(60);
  });
});

describe("سجلّ الجمعة", () => {
  const days = {
    "2026-09-11": { attended: true },
    "2026-09-18": { attended: true },
    "2026-09-25": { attended: true, kahf: true },
  };

  it("سلسلة الجُمَع المتتالية لا تنقطع قبل صلاة جمعة اليوم", () => {
    expect(jumuahStats(days, "2026-09-28").streak).toBe(3);
    expect(jumuahStats(days, FRI).streak).toBe(3);
    expect(jumuahStats({ ...days, [FRI]: { attended: true } }, FRI).streak).toBe(4);
    // جمعة فاتت تقطع السلسلة
    expect(jumuahStats(days, "2026-10-05").streak).toBe(0);
  });

  it("آخر ثماني جُمَع مرتّبة، وعدّاد آخر ١٢", () => {
    const s = jumuahStats(days, "2026-09-28");
    expect(s.recent).toHaveLength(8);
    expect(s.recent[7]).toEqual({ key: "2026-09-25", attended: true, deeds: 2 });
    expect(s.last12).toBe(3);
    expect(s.total).toBe(3);
  });
});

describe("تنبيهات الجمعة", () => {
  const store: JumuahStore = { prefs: { ...DEFAULT_JUMUAH_PREFS, remindHour: true }, days: {} };
  const plan = (st: JumuahStore, now: Date, days = 7) =>
    planJumuahReminders({
      now: now.getTime(),
      days,
      store: st,
      timelineFor: (k) => jumuahTimeline(k, SANAA, CALC, ADHAN, st.prefs),
      sunriseFor: (k) => {
        const [y, m, d] = k.split("-").map(Number);
        return computePrayerTimes(SANAA, CALC, new Date(y, m - 1, d, 12)).sunrise;
      },
    });

  it("يوم الجمعة وحده: الكهف ثم التبكير ثم ساعة الإجابة", () => {
    const r = plan(store, local(2026, 9, 28));
    expect(r.map((x) => x.slot)).toEqual([0, 1, 2]);
    for (const x of r) expect(x.key).toBe(FRI);
  });

  it("ما أُنجز لا يُذكَّر به، وما مضى لا يُضبط", () => {
    const done: JumuahStore = { ...store, days: { [FRI]: { kahf: true, attended: true } } };
    expect(plan(done, local(2026, 9, 28)).map((x) => x.slot)).toEqual([2]);
    // بعد الظهر يوم الجمعة لا يبقى إلا ساعة الإجابة
    const t = jumuahTimeline(FRI, SANAA, CALC, ADHAN, store.prefs);
    expect(plan(store, new Date(t.adhanAt.getTime() + 60_000)).map((x) => x.slot)).toEqual([2]);
  });

  it("المفاتيح المطفأة لا تنبيه لها، والمدى أسبوعان = جمعتان", () => {
    const off: JumuahStore = {
      ...store,
      prefs: { ...store.prefs, remindKahf: false, remindEarly: false, remindHour: false },
    };
    expect(plan(off, local(2026, 9, 28))).toHaveLength(0);
    const keys = new Set(plan(store, local(2026, 9, 28), 14).map((x) => x.key));
    expect([...keys]).toEqual([FRI, "2026-10-09"]);
  });
});
