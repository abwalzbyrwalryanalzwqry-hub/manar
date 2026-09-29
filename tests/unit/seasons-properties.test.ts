/* مواسم منار — المرحلة الخامسة: خصائص تُفحص على كل المواسم × الإزاحات × السنوات. */

import { describe, expect, it } from "vitest";
import { fromHijri, hijriMonthLength } from "@/lib/hijri";
import { otherAlertRows } from "@/lib/alert-center";
import { SEASONS } from "@/lib/seasons/definitions";
import {
  activeSeasonNotifyCount,
  daysBetween,
  getSeasonState,
  instancesAround,
  phaseAt,
  refOffset,
  seasonNotificationsBetween,
} from "@/lib/seasons/engine";
import {
  DEFAULT_NOTIFY,
  normalizeStore,
  seasonsChangeEvent,
  SEASONS_PLAN_EVENT,
} from "@/lib/seasons/store";

const ADJUSTS = [-2, -1, 0, 1, 2];
const YEARS = [1446, 1447, 1448, 1449, 1450];

describe("خصائص المحرّك", () => {
  it("لكل موسم × إزاحة × سنة: حالة دائماً، والماضي لا يتجاوز نافذة ما بعده", () => {
    const bad: string[] = [];
    for (const s of SEASONS) {
      for (const adjust of ADJUSTS) {
        for (const y of YEARS) {
          for (let m = 1; m <= 12; m++) {
            for (const day of [1, 10, 20, hijriMonthLength(y, m)]) {
              const d = fromHijri({ year: y, month: m, day });
              const st = getSeasonState(s, d, adjust);
              if (!st) bad.push(`${s.id} ${y}/${m}/${day} adj${adjust}: لا حالة`);
              else if (st.status === "ended" && st.daysSinceEnd > (s.trailDays ?? 0))
                bad.push(`${s.id} ${y}/${m}/${day} adj${adjust}: ماضٍ بلا قادم`);
            }
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("كل يوم داخل نسخة له مرحلة، والنسخ لا تتداخل", () => {
    const bad: string[] = [];
    for (const s of SEASONS) {
      for (const adjust of ADJUSTS) {
        for (const y of YEARS) {
          const insts = instancesAround(s, fromHijri({ year: y, month: 6, day: 15 }), adjust);
          for (const inst of insts) {
            for (let o = 0; o < inst.length; o++)
              if (!phaseAt(s, o, inst.length)) bad.push(`${inst.key} يوم ${o + 1}`);
          }
          const sorted = [...insts].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
          for (let i = 1; i < sorted.length; i++)
            if (daysBetween(sorted[i - 1].endDate, sorted[i].startDate) < 1)
              bad.push(`${sorted[i].key} يتداخل`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("كل تذكير يقع في يوم له مرحلة وضمن نافذة الموسم (بكل الأطوال الفعلية)", () => {
    const bad: string[] = [];
    for (const s of SEASONS) {
      const lengths = new Set<number>();
      for (const adjust of ADJUSTS)
        for (const y of YEARS)
          for (const i of instancesAround(s, fromHijri({ year: y, month: 6, day: 15 }), adjust))
            lengths.add(i.length);
      for (const length of lengths) {
        for (const r of s.reminders) {
          const o = refOffset(r.at, length);
          // تذكير «ليلة الموسم» مساء اليوم السابق مقصود ولو بلا مرحلة تمهيد.
          if (o === -1 && r.slot === "evening" && !s.leadDays) continue;
          if (o < -(s.leadDays ?? 0) || o > length - 1 + (s.trailDays ?? 0))
            bad.push(`${s.id}/${r.id}: خارج النافذة (${o} من ${length})`);
          else if (!phaseAt(s, o, length))
            bad.push(`${s.id}/${r.id}: بلا مرحلة (${o} من ${length})`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("كل تذكير سنوي مفعّل افتراضياً يصل مرة واحدة في السنة", () => {
    const from = fromHijri({ year: 1448, month: 1, day: 1 });
    const planned = seasonNotificationsBetween(from, 354, 0, DEFAULT_NOTIFY);
    const keys = planned.map((n) => `${n.seasonId}/${n.reminderId}`);
    expect(new Set(planned.map((n) => n.key)).size).toBe(planned.length);
    const annualOn = SEASONS.filter(
      (s) => s.cycle.kind === "annual" && s.notificationSettings.defaultEnabled,
    );
    const missing: string[] = [];
    for (const s of annualOn)
      for (const r of s.reminders)
        if (keys.filter((k) => k === `${s.id}/${r.id}`).length !== 1)
          missing.push(`${s.id}/${r.id}`);
    expect(missing).toEqual([]);
    // صباح واحد ومساء واحد في اليوم على الأكثر.
    const perSlot = new Map<string, number>();
    for (const n of planned) {
      const k = `${n.dayIndex}:${n.slot}`;
      perSlot.set(k, (perSlot.get(k) ?? 0) + 1);
    }
    expect(Math.max(...perSlot.values())).toBe(1);
  });
});

describe("مركز التنبيهات وإعادة الجدولة", () => {
  it("العدّ يتبع المفعّل فقط، والأشهر الحرم لا تُحسب (بلا تذكيرات)", () => {
    const defaults = activeSeasonNotifyCount(DEFAULT_NOTIFY);
    const expected = SEASONS.filter(
      (s) => s.enabled && s.reminders.length && s.notificationSettings.defaultEnabled,
    ).length;
    expect(defaults).toBe(expected);
    const withSacred = activeSeasonNotifyCount({
      ...DEFAULT_NOTIFY,
      seasons: { rajab: true, "dhul-qadah": true },
    });
    expect(withSacred).toBe(defaults);
    const withFriday = activeSeasonNotifyCount({ ...DEFAULT_NOTIFY, seasons: { friday: true } });
    expect(withFriday).toBe(defaults + 1);
    expect(activeSeasonNotifyCount({ ...DEFAULT_NOTIFY, enabled: false })).toBe(0);

    const row = otherAlertRows({
      daily: { enabled: false, items: [] },
      seasons: { ...DEFAULT_NOTIFY, seasons: { friday: true } },
      jumuah: { remindEarly: false, remindKahf: false, remindHour: false },
      sakinah: { enabled: false },
    }).find((r) => r.id === "seasons");
    expect(row?.on).toBe(true);
    expect(row?.detail).toContain(String(defaults + 1).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]));
  });

  it("تسجيل التقدّم وحفظ القالب لا يعيدان الجدولة", () => {
    const base = normalizeStore({});
    const marked = {
      ...base,
      plans: {
        "ramadan@2027-02-08": {
          fast: { enabled: true, frequency: "daily" as const, target: 30, done: ["2027-02-08"] },
        },
      },
    };
    expect(seasonsChangeEvent(base, marked)).toBe(SEASONS_PLAN_EVENT);
    const templ = {
      ...marked,
      templates: { friday: { kahf: { frequency: "once" as const, target: 1 } } },
    };
    expect(seasonsChangeEvent(marked, templ)).toBe(SEASONS_PLAN_EVENT);
  });
});
