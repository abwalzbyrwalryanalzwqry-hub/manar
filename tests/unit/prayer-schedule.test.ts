import { describe, expect, it } from "vitest";
import { getAdhanSettings, type AdhanSettings } from "@/lib/adhan-settings";
import { ADHAN_ASSETS } from "@/lib/adhan-library-assets";
import { IQAMAH_IDS } from "@/lib/iqamah-library";
import {
  buildPrayerAlarms,
  rawResourceName,
  SCHEDULE_DAYS_AHEAD,
  type ManarAlarmEvent,
} from "@/lib/prayer-schedule";
import { computePrayerTimes, type LocationState, type Settings } from "@/lib/prayer";

const SANAA: LocationState = { lat: 15.3694, lng: 44.191, city: "صنعاء", source: "manual" };
const MAKKAH: LocationState = { lat: 21.4225, lng: 39.8262, city: "مكة", source: "manual" };
const CALC: Settings = {
  method: "UmmAlQura",
  madhab: "shafi",
  offsets: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  dstOffset: 0,
};
// ٢٣ سبتمبر ٢٠٢٦، ١:٠٠ فجراً بتوقيت صنعاء (UTC+3) — قبل كل صلوات يومها.
// لحظة مطلقة: الاختبارات تُعاد في CI بمناطق زمنية أخرى للجهاز (نيويورك، أوكلاند).
const NOW = Date.UTC(2026, 8, 22, 22, 0, 0);
const DAY = "_2026_09_23";

const base = (): AdhanSettings => structuredClone(getAdhanSettings());
/** أحداث صلوات ٢٣ سبتمبر في صنعاء وحدها، مهما كانت منطقة الجهاز الزمنية. */
const build = (s: AdhanSettings, extra: Partial<Parameters<typeof buildPrayerAlarms>[0]> = {}) =>
  buildPrayerAlarms({
    settings: s,
    location: SANAA,
    calc: CALC,
    now: NOW,
    days: 3,
    ...extra,
  }).filter((e) => e.key.endsWith(DAY));
const byRole = (ev: ManarAlarmEvent[], role: ManarAlarmEvent["role"]) =>
  ev.filter((e) => e.role === role);

const ADHAN_RAW = new Set(ADHAN_ASSETS.map((a) => rawResourceName(a.url)));
const IQAMAH_RAW = new Set<string>(IQAMAH_IDS);

describe("استقلال المراحل (الاختبارات ١–٦)", () => {
  it("١ — الأذان فقط: أذان بالصوت ولا إقامة", () => {
    const s = base();
    s.iqamaEnabled = false;
    const ev = build(s);
    expect(byRole(ev, "adhan")).toHaveLength(5);
    expect(byRole(ev, "iqamah")).toHaveLength(0);
    expect(byRole(ev, "iqamah_reminder")).toHaveLength(0);
    for (const e of byRole(ev, "adhan")) expect(e.sound).not.toBe("");
  });

  it("٢ — الإقامة فقط: إقامة بالصوت، وإشعار دخول الوقت بلا أذان", () => {
    const s = base();
    s.adhanEnabled = false;
    const ev = build(s);
    expect(byRole(ev, "adhan")).toHaveLength(0);
    expect(byRole(ev, "fajr_first_adhan")).toHaveLength(0);
    expect(byRole(ev, "iqamah")).toHaveLength(5);
    for (const e of byRole(ev, "iqamah")) expect(IQAMAH_RAW.has(e.sound)).toBe(true);
    const notices = byRole(ev, "prayer_notice");
    expect(notices).toHaveLength(5);
    for (const n of notices) {
      expect(n.kind).toBe("notice");
      expect(n.sound).toBe("");
    }
  });

  it("٣ — الأذان والإقامة معاً: الإقامة بعد الأذان بالفاصل المضبوط", () => {
    const s = base();
    const ev = build(s);
    const times = computePrayerTimes(SANAA, CALC, new Date(2026, 8, 23, 12));
    for (const p of ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const) {
      const a = ev.find((e) => e.prayer === p && e.role === "adhan")!;
      const i = ev.find((e) => e.prayer === p && e.role === "iqamah")!;
      expect(a.at).toBe(times[p].getTime());
      expect(i.at - a.at).toBe(s.iqamaOffsets[p] * 60_000);
    }
  });

  it("٤ — تعطيل الأذان لا يُعطّل الإقامة", () => {
    const s = base();
    s.adhanEnabled = false;
    expect(byRole(build(s), "iqamah")).toHaveLength(5);
  });

  it("٥ — تعطيل الإقامة لا يُعطّل الأذان", () => {
    const s = base();
    s.iqamaEnabled = false;
    expect(byRole(build(s), "adhan")).toHaveLength(5);
  });

  it("٦ — تعطيل التنبيهات النصّية لا يمسّ الأذان ولا الإقامة", () => {
    const s = base();
    s.prayerNoticeEnabled = false;
    s.iqamaReminderEnabled = false;
    s.remindersEnabled = false;
    const ev = build(s);
    expect(ev.filter((e) => e.kind === "notice")).toHaveLength(0);
    expect(byRole(ev, "adhan")).toHaveLength(5);
    expect(byRole(ev, "iqamah")).toHaveLength(5);
    for (const e of byRole(ev, "adhan")) expect(e.notice).toBe(false);
  });

  it("إيقاف صوت الإقامة يُبقي إشعارها صامتاً في موعده", () => {
    const s = base();
    s.iqamaSoundEnabled = false;
    const iq = byRole(build(s), "iqamah");
    expect(iq).toHaveLength(5);
    for (const e of iq) expect(e.sound).toBe("");
  });

  it("الوضع الصامت: كل الأحداث بلا صوت، ولا تُحذف", () => {
    const s = base();
    s.silentMode = true;
    const ev = build(s);
    expect(ev.length).toBeGreaterThan(0);
    for (const e of ev) expect(e.sound).toBe("");
  });

  it("تعطيل صلاة واحدة لا يمسّ غيرها", () => {
    const s = base();
    s.perPrayer.asr = { adhan: false, reminder: true, iqama: false };
    const ev = build(s);
    expect(ev.some((e) => e.prayer === "asr" && e.role === "adhan")).toBe(false);
    expect(ev.some((e) => e.prayer === "asr" && e.role === "iqamah")).toBe(false);
    expect(byRole(ev, "adhan")).toHaveLength(4);
  });
});

describe("فصل الأصوات: لا خلط بين الأذان والإقامة", () => {
  it("أحداث الإقامة لا تحمل إلا أصوات iqamah_*، والأذان لا يحمل أيّاً منها", () => {
    const s = base();
    s.fajrFirstAdhanEnabled = true;
    const ev = buildPrayerAlarms({ settings: s, location: SANAA, calc: CALC, now: NOW });
    for (const e of ev) {
      if (e.kind === "iqama") expect(IQAMAH_RAW.has(e.sound), e.key).toBe(true);
      if (e.kind === "adhan") {
        expect(e.sound.startsWith("iqamah"), e.key).toBe(false);
        expect(ADHAN_RAW.has(e.sound), e.key).toBe(true);
      }
      if (e.kind === "notice") expect(e.sound).toBe("");
    }
  });

  it("كل صوت من أصوات الإقامة الـ١٩ يصل إلى الجدول كما اختير", () => {
    for (const id of IQAMAH_IDS) {
      const s = base();
      s.iqamaVariant = id;
      const iq = byRole(build(s), "iqamah");
      for (const e of iq) expect(e.sound).toBe(id);
    }
  });

  it("صوت إقامة خاص لصلاةٍ يغلب الاختيار العام لها وحدها", () => {
    const s = base();
    s.iqamaVariant = "iqamah_01";
    s.perPrayerIqama = { maghrib: "iqamah_12" };
    const iq = byRole(build(s), "iqamah");
    expect(iq.find((e) => e.prayer === "maghrib")!.sound).toBe("iqamah_12");
    expect(iq.find((e) => e.prayer === "isha")!.sound).toBe("iqamah_01");
  });
});

describe("منع التكرار (الاختبارات ١٥–١٨)", () => {
  const s = base();
  s.fajrFirstAdhanEnabled = true;
  s.iqamaReminderEnabled = true;
  const week = buildPrayerAlarms({ settings: s, location: SANAA, calc: CALC, now: NOW });

  it("مفاتيح ومعرّفات فريدة عبر أسبوع كامل", () => {
    expect(new Set(week.map((e) => e.key)).size).toBe(week.length);
    expect(new Set(week.map((e) => e.id)).size).toBe(week.length);
    for (const e of week) expect(e.id).toBeLessThan(100_000);
  });

  it("صيغة المفتاح: fajr_iqamah_2026_09_23", () => {
    expect(week.some((e) => e.key === "fajr_iqamah_2026_09_23")).toBe(true);
    expect(week.some((e) => e.key === "fajr_adhan_2026_09_23")).toBe(true);
    for (const e of week) expect(e.key).toMatch(/^[a-z]+_[a-z_]+_\d{4}_\d{2}_\d{2}$/);
  });

  it("إعادة البناء تُنتج القائمة نفسها بالمعرّفات نفسها", () => {
    const again = buildPrayerAlarms({ settings: s, location: SANAA, calc: CALC, now: NOW });
    expect(again).toEqual(week);
  });

  it("إعادة البناء بعد ساعات لا تُغيّر معرّف حدثٍ قادم", () => {
    const later = buildPrayerAlarms({
      settings: s,
      location: SANAA,
      calc: CALC,
      now: NOW + 9 * 3600_000,
    });
    const first = new Map(week.map((e) => [e.key, e.id]));
    for (const e of later) if (first.has(e.key)) expect(e.id).toBe(first.get(e.key));
  });

  it("سبعة أيام، ولا أحداث في الماضي", () => {
    expect(SCHEDULE_DAYS_AHEAD).toBe(7);
    // ٧ أيام بتقويم الجهاز: ٦ أو ٧ أيام كاملة من صلوات صنعاء حسب فرق المنطقة.
    const n = byRole(week, "adhan").length;
    expect(n).toBeGreaterThanOrEqual(30);
    expect(n).toBeLessThanOrEqual(35);
    for (const e of week) expect(e.at).toBeGreaterThan(NOW);
  });
});

describe("المواعيد وإعادة الجدولة (الاختبارات ١١–١٣)", () => {
  it("١٣ — تغيير فاصل الإقامة يُغيّر موعدها فقط", () => {
    const s = base();
    const a = build(s);
    s.iqamaOffsets.fajr = 20;
    const b = build(s);
    const adhan = b.find((e) => e.key === "fajr_adhan_2026_09_23")!;
    expect(b.find((e) => e.key === "fajr_iqamah_2026_09_23")!.at - adhan.at).toBe(20 * 60_000);
    expect(adhan.at).toBe(a.find((e) => e.key === "fajr_adhan_2026_09_23")!.at);
  });

  it("فاصل صفر = بلا إقامة لتلك الصلاة", () => {
    const s = base();
    s.iqamaOffsets.dhuhr = 0;
    expect(build(s).some((e) => e.prayer === "dhuhr" && e.role === "iqamah")).toBe(false);
  });

  it("١١ — تغيير المدينة يُغيّر المواقيت بالمفاتيح نفسها", () => {
    const s = base();
    const a = build(s);
    const b = build(s, { location: MAKKAH });
    const ka = a.find((e) => e.key === "dhuhr_adhan_2026_09_23")!;
    const kb = b.find((e) => e.key === "dhuhr_adhan_2026_09_23")!;
    expect(kb.at).not.toBe(ka.at);
    expect(kb.id).toBe(ka.id); // يستبدل ولا يُضيف
  });

  it("١٢ — تغيير طريقة الحساب يُغيّر موعد الفجر", () => {
    const s = base();
    const a = build(s).find((e) => e.key === "fajr_adhan_2026_09_23")!;
    const b = build(s, { calc: { ...CALC, method: "MuslimWorldLeague" } }).find(
      (e) => e.key === "fajr_adhan_2026_09_23",
    )!;
    expect(b.at).not.toBe(a.at);
  });

  it("تنبيه قبل الإقامة يقع بين الأذان والإقامة، ويُتجاهل إن جاوز الفاصل", () => {
    const s = base();
    s.iqamaReminderEnabled = true;
    s.iqamaReminderMinutes = 5;
    const ev = build(s);
    for (const r of byRole(ev, "iqamah_reminder")) {
      const a = ev.find((e) => e.prayer === r.prayer && e.role === "adhan")!;
      const i = ev.find((e) => e.prayer === r.prayer && e.role === "iqamah")!;
      expect(r.at).toBe(i.at - 5 * 60_000);
      expect(r.at).toBeGreaterThan(a.at);
      expect(r.kind).toBe("notice");
      expect(r.channel).toBe("iqama");
    }
    s.iqamaOffsets.maghrib = 5;
    expect(build(s).some((e) => e.prayer === "maghrib" && e.role === "iqamah_reminder")).toBe(
      false,
    );
  });

  it("الأذان الأول للفجر قبل الأذان الثاني بالفاصل المضبوط", () => {
    const s = base();
    s.fajrFirstAdhanEnabled = true;
    s.fajrFirstAdhanOffset = 30;
    const ev = build(s);
    const first = ev.find((e) => e.role === "fajr_first_adhan")!;
    const second = ev.find((e) => e.key === "fajr_adhan_2026_09_23")!;
    expect(second.at - first.at).toBe(30 * 60_000);
  });
});
