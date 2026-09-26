import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { nextIndexAfter } from "@/lib/azkar/hub";
import {
  applyComplete,
  applyTap,
  applyUndo,
  completedChapterKeys,
  normalizeProgress,
} from "@/lib/azkar/progress";
import { AzkarRepository } from "@/lib/azkar/repository";
import type { AzkarBook } from "@/lib/azkar/types";
import { azkarForTime, progressKey } from "@/lib/azkar/variant";
import { WIRD_SESSIONS } from "@/lib/wird/data";
import { linkedAzkarEntries } from "@/lib/wird/link";
import { applyDecrement, applyIncrement, emptySession } from "@/lib/wird/progress";

/* المرحلة الأولى من مراجعة قسم الأذكار: التراجع، والانتقال في آخر الباب،
 * ووقت نتائج البحث، وربط إتمام الوِرد بأذكار الصباح والمساء. */

const raw = readFileSync("public/data/azkar/hisn-al-muslim.json", "utf8");
const book = JSON.parse(raw) as AzkarBook;
const ch27 = book.chapters.find((c) => c.id === 27)!;
const DAY = "2026-09-26";
const fresh = () => normalizeProgress({}, DAY);

describe("التراجع عن آخر عدّة", () => {
  it("ينقص واحدًا ويُخرج الذكر من المكتمل", () => {
    let p = fresh();
    for (let i = 0; i < 3; i++) p = applyTap(p, "82", 3);
    expect(p.completed).toContain("82");
    p = applyUndo(p, "82");
    expect(p.counters["82"]).toBe(2);
    expect(p.completed).not.toContain("82");
  });

  it("لا يفعل شيئًا عند الصفر، ويحذف المفتاح عند الواحد", () => {
    const p = fresh();
    expect(applyUndo(p, "82")).toBe(p);
    const one = applyUndo(applyTap(p, "82", 3), "82");
    expect("82" in one.counters).toBe(false);
  });

  it("تراجع الوِرد ينقص العدّاد ويُلغي الإتمام", () => {
    const items = [{ order: 1, repeat: 1 }];
    const done = applyIncrement(emptySession(DAY), 1, 1, items);
    expect(done.done).toBe(true);
    const back = applyDecrement(done, 1, items);
    expect(back.counts[1]).toBe(0);
    expect(back.done).toBe(false);
    expect(applyDecrement(back, 1, items)).toBe(back);
  });
});

describe("الانتقال بعد الذكر", () => {
  const list = [{ repeat: 1 }, { repeat: 3 }, { repeat: 1 }];
  it("ينتقل للتالي مباشرة ما لم يكن آخر الباب", () => {
    expect(nextIndexAfter(list, () => 0, 0)).toBe(1);
  });
  it("في آخر الباب يعود إلى أول ذكر ناقص", () => {
    const counts = [1, 1, 1];
    expect(nextIndexAfter(list, (_z, i) => counts[i], 2)).toBe(1);
  });
  it("يعيد -1 إن اكتمل الباب كله", () => {
    const counts = [1, 3, 1];
    expect(nextIndexAfter(list, (_z, i) => counts[i], 2)).toBe(-1);
  });
});

describe("وقت نتائج البحث في باب الصباح والمساء", () => {
  const repo = new AzkarRepository();
  beforeAll(async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(raw, { status: 200 })),
    );
    await repo.load();
  });
  afterAll(() => vi.unstubAllGlobals());

  it("الذكر المسائي وحده (#97) يُفتح على المساء", () => {
    const hit = repo.search("اعوذ بكلمات الله التامات من شر ما خلق").find((h) => h.zikr.id === 97);
    expect(hit?.time).toBe("evening");
  });

  it("الذكر الصباحي وحده (#94) يُفتح على الصباح", () => {
    const hit = repo.search("عدد خلقه ورضا نفسه").find((h) => h.zikr.id === 94);
    expect(hit?.time).toBe("morning");
  });

  it("مطابقة لفظ المساء وحده تُفتح على المساء ويُقتطف منه", () => {
    const hit = repo.search("امسينا وامسى الملك").find((h) => h.zikr.id === 77);
    expect(hit?.time).toBe("evening");
    expect(hit?.excerpt).toContain("أَمْسَيْنَا");
  });

  it("ما يطابق اللفظين لا يُفرض عليه وقت", () => {
    const hit = repo.search("سيد الاستغفار خلقتني وانا عبدك").find((h) => h.zikr.id === 79);
    expect(hit?.time).toBeUndefined();
  });
});

describe("إتمام أذكار من خارج الشاشة", () => {
  it("يعلّم المفاتيح مكتملة ولا ينقص عدّادًا أعلى", () => {
    const p = applyComplete(fresh(), [
      { key: "91", repeat: 100 },
      { key: "77:e", repeat: 1 },
    ]);
    expect(p.counters).toMatchObject({ "91": 100, "77:e": 1 });
    expect(p.completed).toEqual(expect.arrayContaining(["91", "77:e"]));
  });

  it("يعيد الحالة نفسها إن لم يتغيّر شيء، ويتجاهل المفاتيح غير الصالحة", () => {
    const p = applyComplete(fresh(), [{ key: "91", repeat: 100 }]);
    expect(applyComplete(p, [{ key: "91", repeat: 100 }])).toBe(p);
    expect(applyComplete(p, [{ key: "x", repeat: 1 }])).toBe(p);
  });
});

describe("ربط الوِرد بأذكار الصباح والمساء", () => {
  const full = (items: { order: number; repeat: number }[]) =>
    Object.fromEntries(items.map((it) => [it.order, it.repeat]));

  it("أعداد أذكار الوِرد المأخوذة من الحصن تطابق أعدادها في الكتاب", () => {
    for (const s of Object.values(WIRD_SESSIONS)) {
      for (const it of s.items) {
        if (it.hisn == null) continue;
        const z = ch27.azkar.find((x) => x.id === it.hisn)!;
        expect({ id: it.hisn, repeat: it.repeat }).toEqual({ id: z.id, repeat: z.repeat });
      }
    }
  });

  for (const time of ["morning", "evening"] as const) {
    it(`إتمام ورد ${time === "morning" ? "الصباح" : "المساء"} يُتمّ أذكار الوقت نفسه في الباب ٢٧`, () => {
      const items = WIRD_SESSIONS[time].items;
      const entries = linkedAzkarEntries(time, items, full(items));
      const p = applyComplete(fresh(), entries);
      for (const z of azkarForTime(ch27, time)) {
        expect(p.counters[progressKey(z.id, time)] ?? 0).toBeGreaterThanOrEqual(z.repeat);
      }
      const tag = time === "morning" ? "27:m" : "27:e";
      expect(completedChapterKeys(book, p.completed)).toContain(tag);
      /* لا يمسّ الوقت الآخر. */
      const other = time === "morning" ? "27:e" : "27:m";
      expect(completedChapterKeys(book, p.completed)).not.toContain(other);
    });
  }

  it("التهليل التام (#93) في ورد المساء لا يُحتسب في أذكار المساء", () => {
    const items = WIRD_SESSIONS.evening.items;
    const keys = linkedAzkarEntries("evening", items, full(items)).map((e) => e.key);
    expect(keys).not.toContain("93:e");
    expect(keys).not.toContain("93");
  });

  it("الأذكار الزائدة على الحصن (التحميد والتكبير) لا تُربط", () => {
    const items = WIRD_SESSIONS.morning.items;
    const entries = linkedAzkarEntries("morning", items, full(items));
    expect(entries.length).toBe(items.filter((i) => i.hisn != null).length);
  });

  it("مع `before` يُعاد ما اكتمل الآن فقط", () => {
    const items = WIRD_SESSIONS.morning.items;
    const ayah = items.find((i) => i.hisn === 75)!;
    const tasbih = items.find((i) => i.hisn === 91)!;
    const before = { [ayah.order]: 1, [tasbih.order]: 99 };
    const after = { [ayah.order]: 1, [tasbih.order]: 100 };
    expect(linkedAzkarEntries("morning", items, after, before)).toEqual([
      { key: "91", repeat: 100 },
    ]);
  });

  it("الناقص لا يُربط", () => {
    const items = WIRD_SESSIONS.morning.items;
    const tasbih = items.find((i) => i.hisn === 91)!;
    expect(linkedAzkarEntries("morning", items, { [tasbih.order]: 99 })).toEqual([]);
  });
});
