import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  addLine,
  artHash,
  emptyArtRequest,
  NATIVE_PHRASES,
  paraKey,
  phraseWords,
} from "@/lib/widgets/art-spec";
import { afterPhrase, hoursWord, minutesWord } from "@/lib/widgets/words";

const read = (p: string) => readFileSync(p, "utf8");
const ARABIC = /[\u0600-\u06FF]/;

describe("حزمة الفن: مفردات الأصلي", () => {
  it("كل كلمة يركّبها WidgetWords.java مرسومة بخط التطبيق", () => {
    const java = read("android/app/src/main/java/app/manar/islamic/WidgetWords.java");
    const literals = [...java.matchAll(/"([^"\\]*)"/g)]
      .map((m) => m[1])
      .filter((s) => ARABIC.test(s));
    expect(literals.length).toBeGreaterThan(40);
    const vocab = new Set(NATIVE_PHRASES.flatMap((p) => phraseWords(p)));
    const missing = literals
      .flatMap((l) => phraseWords(l))
      .filter((w) => ARABIC.test(w) && !vocab.has(w));
    expect(missing).toEqual([]);
  });

  it("البصمة ثابتة لنفس المحتوى ومتغيّرة بتغيّره", () => {
    const a = emptyArtRequest();
    addLine(a, "B", "الظهر");
    const b = emptyArtRequest();
    addLine(b, "B", "الظهر");
    expect(artHash(a, "x")).toBe(artHash(b, "x"));
    addLine(b, "B", "العصر");
    expect(artHash(a, "x")).not.toBe(artHash(b, "x"));
    expect(artHash(a, "x")).not.toBe(artHash(a, "y"));
    expect(paraKey("Q", "نص")).not.toBe(paraKey("Z", "نص"));
  });
});

describe("عبارات العدّ (مطابقة للأصلي)", () => {
  it("المفرد والمثنى والجمع", () => {
    expect(minutesWord(1)).toBe("دقيقة واحدة");
    expect(minutesWord(2)).toBe("دقيقتين");
    expect(minutesWord(8)).toBe("٨ دقائق");
    expect(minutesWord(15)).toBe("١٥ دقيقة");
    expect(hoursWord(1)).toBe("ساعة واحدة");
    expect(hoursWord(3)).toBe("٣ ساعات");
    expect(hoursWord(11)).toBe("١١ ساعة");
  });

  it("العبارة كاملة", () => {
    expect(afterPhrase(30_000)).toBe("بعد أقل من دقيقة");
    expect(afterPhrase(84 * 60_000)).toBe("بعد ساعة واحدة و٢٤ دقيقة");
    expect(afterPhrase(120 * 60_000)).toBe("بعد ساعتين");
    expect(afterPhrase(9.5 * 60_000)).toBe("بعد ١٠ دقائق");
    expect(afterPhrase(5 * 60_000, true)).toBe("بعد 5 دقائق");
  });
});
