/* مواسم منار — المرحلة الثالثة: المحتوى والتنبيهات. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fastingInfo, fromHijri, OCCASIONS, occasionsForHijri, toHijri } from "@/lib/hijri";
import { SEASONS } from "@/lib/seasons/definitions";
import {
  addDays,
  findSeason,
  getSeasonState,
  instancesAround,
  refOffset,
  reminderTimes,
  seasonNotificationsBetween,
} from "@/lib/seasons/engine";
import { seasonSoundFor } from "@/lib/seasons/sounds";
import { DEFAULT_NOTIFY } from "@/lib/seasons/store";
import type { Season, SeasonContent } from "@/lib/seasons/types";

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const H = (year: number, month: number, day: number) => fromHijri({ year, month, day });
const S = (id: string): Season => findSeason(id)!;
const ALL = {
  ...DEFAULT_NOTIFY,
  seasons: Object.fromEntries(SEASONS.map((s) => [s.id, true])),
};
const allContent = (): SeasonContent[] =>
  SEASONS.flatMap((s) => s.phases.flatMap((p) => p.content ?? []));
const texts = () =>
  allContent()
    .filter(
      (c): c is Extract<SeasonContent, { kind: "hadith" | "note" }> =>
        c.kind === "hadith" || c.kind === "note",
    )
    .map((c) => c.text);

/* ------------------------------ ٣.١ ------------------------------ */

describe("٣.١ المناسبات في التقويم متسقة مع المواسم", () => {
  it("لا تحديد لليلة القدر، ولا «ليلة فاضلة» بلا دليل", () => {
    expect(OCCASIONS.find((o) => o.id === "qadr")).toBeUndefined();
    expect(OCCASIONS.some((o) => /مرجّح/.test(`${o.title} ${o.note ?? ""}`))).toBe(false);
    for (const id of ["nisf-shaban", "isra", "mawlid"])
      expect(OCCASIONS.find((o) => o.id === id)?.kind, id).toBe("event");
  });

  it("العشر الأواخر حتى آخر الشهر كما في موسم رمضان", () => {
    const ramadan = S("ramadan");
    const lastTen = ramadan.phases.find((p) => p.id === "last-ten")!;
    for (const len of [29, 30]) {
      const inst = instancesAround(ramadan, H(1447, 9, 10)).find((i) => i.length === len);
      if (!inst) continue;
      expect(refOffset(lastTen.to, len)).toBe(len - 1);
    }
    for (const day of [21, 27, 29, 30])
      expect(occasionsForHijri({ year: 1447, month: 9, day }).map((o) => o.id)).toContain(
        "last-ten",
      );
    expect(occasionsForHijri({ year: 1447, month: 9, day: 20 }).map((o) => o.id)).not.toContain(
      "last-ten",
    );
  });

  it("ست من شوال في الشهر كله بعد العيد", () => {
    for (const day of [2, 7, 8, 20, 30])
      expect(occasionsForHijri({ year: 1447, month: 10, day }).map((o) => o.id)).toContain(
        "shawwal-six",
      );
    expect(occasionsForHijri({ year: 1447, month: 10, day: 1 }).map((o) => o.id)).not.toContain(
      "shawwal-six",
    );
  });

  it("أيام المواسم الثابتة لها مناسبة بالتاريخ نفسه في التقويم", () => {
    const at = (m: number, d: number) =>
      occasionsForHijri({ year: 1447, month: m, day: d }).map((o) => o.id);
    expect(at(1, 10)).toContain("ashura");
    expect(at(1, 9)).toContain("tasua");
    expect(at(10, 1)).toContain("eid-fitr");
    expect(at(12, 9)).toContain("arafah");
    expect(at(12, 10)).toContain("eid-adha");
    for (const d of [11, 12, 13]) expect(at(12, d)).toContain("tashreeq");
  });
});

/* ------------------------------ ٣.٢ ------------------------------ */

describe("٣.٢ تصحيح النصوص", () => {
  it("حديث التشريق كاملاً", () => {
    expect(texts()).toContain("أَيَّامُ التَّشْرِيقِ أَيَّامُ أَكْلٍ وَشُرْبٍ وَذِكْرٍ لِلَّهِ");
  });
  it("دعاء ليلة القدر بلا «كريم»", () => {
    const dua = texts().find((t) => t.includes("عَفُوٌّ"))!;
    expect(dua).toContain("إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ");
    expect(dua).not.toContain("كَرِيمٌ");
  });
  it("حديث ساعة الجمعة بصدره", () => {
    const h = texts().find((t) => t.includes("لاَ يُوَافِقُهَا"))!;
    expect(h.startsWith("أَنَّ رَسُولَ اللَّهِ")).toBe(true);
    expect(h).toContain("يَوْمَ الْجُمُعَةِ");
  });
  it("صيغة التكبير مع مصدرها في ليلة العيد وأيام التشريق", () => {
    const notes = SEASONS.flatMap((s) =>
      s.phases
        .filter((p) =>
          (p.content ?? []).some((c) => c.kind === "note" && c.text.includes("ابن مسعود")),
        )
        .map((p) => `${s.id}/${p.id}`),
    );
    expect(notes).toContain("ramadan/eid-night");
    expect(notes).toContain("dhul-hijjah/tashreeq");
    const note = allContent().find((c) => c.kind === "note" && c.text.includes("ابن مسعود"));
    expect(note && note.kind === "note" && note.source).toBeTruthy();
  });
});

/* ------------------------------ ٣.٣ ------------------------------ */

describe("٣.٣ تنبيهات جديدة", () => {
  const plan = (from: Date, days: number) =>
    seasonNotificationsBetween(from, days, 0, ALL).map((n) => `${n.seasonId}/${n.reminderId}`);

  it("صباح أول رمضان وزكاة الفطر قبل العيد", () => {
    const r = S("ramadan");
    const inst = getSeasonState(r, H(1447, 9, 1))!.instance;
    expect(plan(inst.startDate, 1)).toContain("ramadan/first");
    const zakat = reminderTimes(inst, DEFAULT_NOTIFY, inst.startDate).find(
      (t) => t.reminder.id === "zakat-fitr",
    )!;
    expect(toHijri(zakat.at).day).toBe(inst.length - 1);
    expect(zakat.reminder.slot).toBe("evening");
  });

  it("صباح عرفة وعاشوراء، ودخول شعبان", () => {
    expect(plan(H(1447, 12, 9), 1)).toContain("dhul-hijjah/arafah");
    expect(plan(H(1448, 1, 10), 1)).toContain("muharram/ashura");
    expect(plan(H(1447, 8, 1), 1)).toContain("shaban/first");
  });

  it("لكل تنبيه جديد صوته", () => {
    expect(seasonSoundFor("ramadan", "first")).toBe("new");
    expect(seasonSoundFor("shaban", "first")).toBe("new");
    expect(seasonSoundFor("ramadan", "zakat-fitr")).toBe("general");
  });
});

/* ------------------------------ ٣.٤ ------------------------------ */

describe("٣.٤ لا تذكير بالكهف مرتين", () => {
  it("إن كان تذكير الكهف مفعّلاً في قسم الجمعة يُحذف الكهف من تذكير الموسم", () => {
    const thursday = new Date(2026, 9, 1, 12); // الخميس ١ أكتوبر ٢٠٢٦
    const prefs = { ...DEFAULT_NOTIFY, seasons: { friday: true } };
    const withKahf = seasonNotificationsBetween(thursday, 2, 0, prefs);
    const without = seasonNotificationsBetween(thursday, 2, 0, prefs, SEASONS, {
      jumuahKahf: true,
    });
    expect(
      withKahf.filter((n) => n.seasonId === "friday").some((n) => n.body.includes("الكهف")),
    ).toBe(true);
    const fri = without.filter((n) => n.seasonId === "friday");
    expect(fri.length).toBe(2);
    expect(fri.some((n) => n.body.includes("الكهف"))).toBe(false);
  });

  it("الجدولة تمرّر خيار قسم الجمعة", () => {
    expect(read("src/lib/native-notifications.ts")).toContain(
      "jumuahKahf: readJumuah().prefs.remindKahf",
    );
  });
});

/* ------------------------------ ٣.٥ ------------------------------ */

describe("٣.٥ الأيام البيض في ذي الحجة", () => {
  it("١٤ و١٥ ذي الحجة بلا ١٣", () => {
    const w = S("white-days");
    const inst = instancesAround(w, H(1447, 12, 14)).find(
      (i) => toHijri(i.startDate).month === 12,
    )!;
    expect(inst).toBeTruthy();
    expect(toHijri(inst.startDate).day).toBe(14);
    expect(inst.length).toBe(2);
    expect(fastingInfo(H(1447, 12, 14), toHijri(H(1447, 12, 14))).status).toBe("recommended");
    // ورمضان يبقى متخطّى.
    const ram = instancesAround(w, H(1447, 9, 14)).map((i) => toHijri(i.startDate).month);
    expect(ram).not.toContain(9);
  });

  it("تذكير عشية ١٤ ذي الحجة لا ١٣", () => {
    const eve = addDays(H(1447, 12, 14), -1);
    const list = seasonNotificationsBetween(eve, 1, 0, ALL).filter(
      (n) => n.seasonId === "white-days",
    );
    expect(list.length).toBe(1);
    expect(list[0].body).not.toContain("١٣");
  });
});

/* ------------------------------ B16 ------------------------------ */

describe("B16 قائمة التذكيرات بمواعيدها", () => {
  it("مرتّبة زمنياً، والماضي معلَّم", () => {
    const r = S("ramadan");
    const inst = getSeasonState(r, H(1447, 9, 10))!.instance;
    const list = reminderTimes(inst, DEFAULT_NOTIFY, H(1447, 9, 10));
    expect(list.map((t) => t.reminder.id)).toEqual([
      "d-7",
      "d-3",
      "d-1",
      "first",
      "last-ten",
      "zakat-fitr",
    ]);
    expect(list.filter((t) => t.past).map((t) => t.reminder.id)).toEqual([
      "d-7",
      "d-3",
      "d-1",
      "first",
    ]);
    expect(list[3].at.getHours()).toBe(DEFAULT_NOTIFY.morning.hour);
  });

  it("الصفحة تعرض الموعد لكل تذكير", () => {
    expect(read("src/routes/seasons.$season.tsx")).toContain("reminderTimes(st.instance");
  });
});
