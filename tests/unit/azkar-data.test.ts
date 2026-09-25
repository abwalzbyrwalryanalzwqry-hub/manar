import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeArabic } from "@/lib/azkar/normalize";
import type { AzkarBook, Zikr } from "@/lib/azkar/types";
import { azkarForTime, defaultTime, segmentState, zikrText } from "@/lib/azkar/variant";
import { stripBasmala } from "@/lib/quran/basmala";
import { WIRD_SESSIONS } from "@/lib/wird/data";
import { HISN_WIRD_TEXTS } from "@/lib/wird/hisn-texts";

/* سلامة محتوى «حصن المسلم»: هذه الاختبارات تحرس التصحيحات التي طبّقها
 * scripts/azkar/build-hisn.py حتى لا يعود خطأ نصي دون أن يُلاحَظ. */

const book = JSON.parse(readFileSync("public/data/azkar/hisn-al-muslim.json", "utf8")) as AzkarBook;
const all: Zikr[] = book.chapters.flatMap((c) => c.azkar);
const byId = new Map(all.map((z) => [z.id, z]));

interface Surah {
  ayahs: { n: number; t: string }[];
}
const surahCache = new Map<number, Surah>();
function surah(n: number): Surah {
  let s = surahCache.get(n);
  if (!s) {
    s = JSON.parse(readFileSync(`public/data/quran/uthmani/${n}.json`, "utf8")) as Surah;
    surahCache.set(n, s);
  }
  return s;
}

/** كل النصوص المعروضة للذكر (المتن وصيغة المساء والمقاطع والإرشادات). */
function texts(z: Zikr): string[] {
  return [z.text, z.evening, z.lead, z.note, ...(z.segments ?? []).map((s) => s.text)].filter(
    (t): t is string => Boolean(t),
  );
}

const count = (s: string, ch: string) => s.split(ch).length - 1;

describe("بنية حصن المسلم", () => {
  it("١٣٢ بابًا و٢٦٧ ذكرًا بأرقام متسلسلة بلا تكرار", () => {
    expect(book.chapters.map((c) => c.id)).toEqual(Array.from({ length: 132 }, (_, i) => i + 1));
    expect(all.map((z) => z.id)).toEqual(Array.from({ length: 267 }, (_, i) => i + 1));
  });

  it("عدد التكرار موجب، ويساوي مجموع المقاطع في الأذكار المركّبة", () => {
    for (const z of all) {
      expect(z.repeat, `#${z.id}`).toBeGreaterThanOrEqual(1);
      if (z.segments) {
        expect(z.segments.length, `#${z.id}`).toBeGreaterThan(1);
        expect(
          z.segments.reduce((n, s) => n + s.repeat, 0),
          `#${z.id}`,
        ).toBe(z.repeat);
      }
    }
  });

  it("الأعداد المصحّحة", () => {
    expect(byId.get(66)?.repeat).toBe(4); // أستغفر الله ×٣ + اللهم أنت السلام ×١
    expect(byId.get(69)?.repeat).toBe(34); // (التسبيح والتحميد والتكبير) ×٣٣ + التهليل ×١
    expect(byId.get(106)?.repeat).toBe(100); // ٣٣ + ٣٣ + ٣٤
  });
});

describe("نظافة النصوص", () => {
  it("لا أرقام حواشٍ ولا أقواس فارغة", () => {
    for (const z of all)
      for (const t of texts(z)) {
        expect(t, `#${z.id}`).not.toMatch(/\([٠-٩0-9]{1,2}\)/);
        expect(t, `#${z.id}`).not.toMatch(/\(\s*\)/);
      }
  });

  it("لا نصوص تخريج مختلطة بالمتن", () => {
    const leaks = [
      "برقم",
      "صححه",
      "وصححه",
      "حسنه",
      "الألباني",
      "تحفة الأخ",
      "تحقيق",
      "بتحقيق",
      "الهلالي",
      "الأرناؤوط",
      "ففعلت ذلك فأذهبه",
      "الحديث،",
    ];
    for (const z of all)
      for (const t of texts(z))
        for (const w of leaks) expect(t.includes(w), `#${z.id} يحوي «${w}»`).toBe(false);
  });

  it("علامات التنصيص والأقواس القرآنية متوازنة", () => {
    for (const z of all)
      for (const t of texts(z)) {
        expect(count(t, "«"), `#${z.id} «»`).toBe(count(t, "»"));
        expect(count(t, "﴿"), `#${z.id} ﴿﴾`).toBe(count(t, "﴾"));
      }
  });

  it("خاتمة الكتاب ليست جزءًا من الذكر الأخير", () => {
    expect(byId.get(267)?.text).not.toContain("وَعَلَى آلِهِ وَأَصْحَابِهِ أَجْمَعِينَ");
  });
});

describe("النصوص القرآنية مطابقة للمصحف", () => {
  const quranItems = all.filter((z) => z.quran);

  it("الأذكار القرآنية معلَّمة", () => {
    expect(quranItems.map((z) => z.id)).toEqual([4, 70, 71, 75, 76, 99, 100, 101]);
  });

  it("كل آية في موضعها كاملة من المصحف العثماني", () => {
    for (const z of quranItems) {
      for (const p of z.quran ?? []) {
        for (let n = p.from; n <= p.to; n++) {
          const ayah = surah(p.surah).ayahs.find((a) => a.n === n);
          expect(ayah, `${p.surah}:${n}`).toBeDefined();
          const body = stripBasmala(p.surah, n, ayah!.t).trim();
          expect(z.text.includes(body), `#${z.id} ← ${p.surah}:${n}`).toBe(true);
        }
      }
    }
  });

  it("آل عمران ١٩٠ و١٩٥ لم يسقط منهما شيء، والبقرة ٢٨٦ بلا تكرار", () => {
    // المقارنة بلا تشكيل: ترتيب الحركات في المصدر العثماني يختلف أحيانًا.
    const z4 = normalizeArabic(byId.get(4)!.text);
    expect(z4).toContain("لاولي الالبب");
    expect(z4).toContain("فاستجاب لهم ربهم");
    const z101 = normalizeArabic(byId.get(101)!.text);
    expect(count(z101, "واعف عنا")).toBe(1);
  });
});

describe("صيغ الصباح والمساء (الباب ٢٧)", () => {
  const ch27 = book.chapters.find((c) => c.id === 27)!;

  it("لكل صيغة مساء لفظ مختلف عن الصباح", () => {
    for (const id of [77, 78, 80, 81, 89, 90]) {
      const z = byId.get(id)!;
      expect(z.evening, `#${id}`).toBeTruthy();
      expect(z.evening).not.toBe(z.text);
      expect(z.evening).toMatch(/أَمْسَ/);
    }
  });

  it("أذكار الصباح لا تظهر مساءً والعكس", () => {
    const morning = azkarForTime(ch27, "morning").map((z) => z.id);
    const evening = azkarForTime(ch27, "evening").map((z) => z.id);
    expect(morning).toContain(94);
    expect(morning).not.toContain(97);
    expect(evening).toContain(97);
    expect(evening).not.toContain(94);
    expect(evening).not.toContain(93);
    expect(zikrText(byId.get(77)!, "evening")).toContain("أَمْسَيْنَا");
    expect(zikrText(byId.get(77)!, "morning")).toContain("أَصْبَحْنَا");
  });

  it("الوقت الافتراضي حسب الساعة", () => {
    expect(defaultTime(new Date(2026, 0, 1, 6))).toBe("morning");
    expect(defaultTime(new Date(2026, 0, 1, 14, 59))).toBe("morning");
    expect(defaultTime(new Date(2026, 0, 1, 17))).toBe("evening");
    expect(defaultTime(new Date(2026, 0, 1, 2))).toBe("evening");
  });
});

describe("الأذكار المركّبة", () => {
  it("يتقدّم المقطع مع العدّ", () => {
    const z = byId.get(106)!;
    expect(segmentState(z, 0)).toMatchObject({ index: 0, count: 0 });
    expect(segmentState(z, 33)).toMatchObject({ index: 1, count: 0 });
    expect(segmentState(z, 70)).toMatchObject({ index: 2, count: 4 });
    expect(segmentState(z, 100)).toMatchObject({ index: 2, count: 34 });
    expect(segmentState(byId.get(1)!, 0)).toBeNull();
  });
});

describe("الوِرد يأخذ نصوصه من حصن المسلم", () => {
  it("النصوص المولّدة مطابقة للملف الحالي", () => {
    for (const [key, text] of Object.entries(HISN_WIRD_TEXTS)) {
      const [id, slot] = key.split(":");
      const z = byId.get(Number(id))!;
      expect(text, key).toBe(slot === "e" ? zikrText(z, "evening") : z.text);
    }
  });

  it("كل ذكر من الحصن في الوِرد بلفظ وقته وعدده", () => {
    for (const session of Object.values(WIRD_SESSIONS)) {
      session.items.forEach((it, i) => expect(it.order).toBe(i + 1));
      for (const it of session.items) {
        if (it.hisn == null) continue;
        const z = byId.get(it.hisn)!;
        expect([z.text, z.evening]).toContain(it.text);
        if (session.key === "evening" && z.evening) expect(it.text, `#${z.id}`).toBe(z.evening);
        if (session.key === "morning") expect(it.text, `#${z.id}`).toBe(z.text);
        expect(it.repeat, `#${z.id}`).toBe(z.repeat);
        if (session.key === "morning") expect(z.time, `#${z.id}`).not.toBe("evening");
        if (session.key === "evening" && z.id !== 93)
          expect(z.time, `#${z.id}`).not.toBe("morning");
      }
    }
  });

  it("أذكار خاصة بوقت لم تعد في الوِرد الخطأ", () => {
    const ids = (k: "morning" | "evening") => WIRD_SESSIONS[k].items.map((i) => i.hisn);
    expect(ids("morning")).not.toContain(97); // أعوذ بكلمات الله التامات — مساءً
    expect(ids("evening")).not.toContain(94); // سبحان الله وبحمده عدد خلقه — صباحًا
    expect(ids("morning")).toContain(89); // أصبحنا وأصبح الملك لله رب العالمين
  });
});
