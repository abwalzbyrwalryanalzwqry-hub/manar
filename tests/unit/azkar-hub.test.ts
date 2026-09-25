import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bookmarkEntries, chapterProgress, QUICK_LINKS, resumeTarget } from "@/lib/azkar/hub";
import { normalizeArabic } from "@/lib/azkar/normalize";
import { normalizeProgress } from "@/lib/azkar/progress";
import type { AzkarBook } from "@/lib/azkar/types";
import { azkarForTime, progressKey } from "@/lib/azkar/variant";

/* المرحلة الثالثة: المحفوظات، و«تابع من حيث توقفت»، والوصول السريع. */

const book = JSON.parse(readFileSync("public/data/azkar/hisn-al-muslim.json", "utf8")) as AzkarBook;
const ch = (id: number) => book.chapters.find((c) => c.id === id)!;
const DAY = "2026-09-26";

describe("الوصول السريع", () => {
  it("يشير إلى الصباح والمساء (٢٧) والنوم (٢٨) وبعد السلام (٢٥)", () => {
    expect(QUICK_LINKS.map((q) => [q.chapter, q.time ?? null])).toEqual([
      [27, "morning"],
      [27, "evening"],
      [28, null],
      [25, null],
    ]);
    for (const q of QUICK_LINKS) expect(ch(q.chapter)).toBeTruthy();
    expect(normalizeArabic(ch(25).title)).toContain(normalizeArabic("بعد السلام"));
  });

  it("تقدّم المساء مستقل عن الصباح", () => {
    const counters: Record<string, number> = {};
    for (const z of azkarForTime(ch(27), "morning"))
      counters[progressKey(z.id, "morning")] = z.repeat;
    expect(chapterProgress(ch(27), counters, "morning").complete).toBe(true);
    expect(chapterProgress(ch(27), counters, "evening").done).toBe(0);
  });
});

describe("تابع من حيث توقفت", () => {
  it("لا شيء إن لم يُفتح ذكر", () => {
    expect(resumeTarget(book, normalizeProgress({}, DAY))).toBeNull();
  });

  it("يفتح على آخر ذكر إن لم يكتمل، مع وقته", () => {
    const p = normalizeProgress(
      { day: DAY, last: { chapter: 27, zikr: 77, at: 1, time: "evening" } },
      DAY,
    );
    const r = resumeTarget(book, p)!;
    expect(r.chapter.id).toBe(27);
    expect(r.time).toBe("evening");
    expect(r.zikr).toBe(77);
    expect(r.position).toBe(azkarForTime(ch(27), "evening").findIndex((z) => z.id === 77) + 1);
  });

  it("إن اكتمل آخر ذكر يفتح الجلسة على أول ذكر ناقص", () => {
    const first = ch(28).azkar[0];
    const p = normalizeProgress(
      {
        day: DAY,
        counters: { [first.id]: first.repeat },
        last: { chapter: 28, zikr: first.id, at: 1 },
      },
      DAY,
    );
    const r = resumeTarget(book, p)!;
    expect(r.zikr).toBeUndefined();
    expect(r.position).toBe(2);
    expect(r.time).toBeUndefined();
  });

  it("لا يُعرض إن اكتمل الباب", () => {
    const counters = Object.fromEntries(ch(1).azkar.map((z) => [String(z.id), z.repeat]));
    const p = normalizeProgress({ day: DAY, counters, last: { chapter: 1, zikr: 1, at: 1 } }, DAY);
    expect(resumeTarget(book, p)).toBeNull();
  });

  it("الحالة القديمة بلا وقت تُفتح على الصباح في الباب ٢٧", () => {
    const p = normalizeProgress({ day: DAY, last: { chapter: 27, zikr: 75, at: 1 } }, DAY);
    expect(resumeTarget(book, p)?.time).toBe("morning");
  });
});

describe("المحفوظات", () => {
  it("الأحدث أولًا مع بابه، وتُهمل المعرّفات المجهولة", () => {
    const e = bookmarkEntries(book, [4, 99999, 106]);
    expect(e.map((x) => x.zikr.id)).toEqual([106, 4]);
    expect(e[0].chapter.id).toBe(28);
  });
});
