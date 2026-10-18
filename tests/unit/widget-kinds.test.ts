import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WIDGET_KINDS } from "@/lib/widgets/kinds";
import {
  cleanZikrText,
  repeatNote,
  WIDGET_ZIKR_MAX,
  widgetAzkarFrom,
} from "@/lib/widgets/collect-extras";
import { applyExternalTaps, emptyTasbihStore, startSession } from "@/lib/tasbih/session";
import type { AzkarBook } from "@/lib/azkar/types";

const read = (p: string) => readFileSync(p, "utf8");
const JAVA = "android/app/src/main/java/app/manar/islamic/";

describe("سجلّ الأنواع: الويب والأصلي متطابقان", () => {
  const hub = read(JAVA + "WidgetHub.java");
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  const kinds = [...hub.matchAll(/KINDS = \{([^}]*)\}/g)][0][1]
    .match(/"(\w+)"/g)!
    .map((s) => s.slice(1, -1));

  it("نفس الأنواع بنفس الترتيب", () => {
    expect(kinds).toEqual(WIDGET_KINDS.map((k) => k.kind));
  });

  it("لكل نوع مزوّد مسجَّل، ووصف، وصورة معاينة في المُشغّل والمعرض", () => {
    for (const k of kinds) {
      const cls =
        k === "hub"
          ? "ManarWidget"
          : hub.match(new RegExp(`case "${k}":\\s*return (\\w+)\\.class`))?.[1];
      expect(cls, k).toBeTruthy();
      expect(existsSync(JAVA + cls + ".java"), cls).toBe(true);
      expect(manifest).toContain(`android:name=".${cls}"`);
      const info = k === "hub" ? "manar_widget_info" : `wd_info_${k}`;
      expect(manifest).toContain(`@xml/${info}`);
      expect(read(`android/app/src/main/res/xml/${info}.xml`)).toContain(
        `@drawable/wd_preview_${k}`,
      );
      expect(existsSync(`android/app/src/main/res/drawable-nodpi/wd_preview_${k}.webp`)).toBe(true);
      expect(existsSync(`public/widgets/${k}.webp`)).toBe(true);
    }
  });

  it("مسارات الفتح في الأصلي موجودة في التطبيق", () => {
    const src = read(JAVA + "WidgetKinds.java") + read(JAVA + "WidgetRender.java");
    const routes = new Set([...src.matchAll(/open\("(\/[a-z/-]*)/g)].map((m) => m[1]));
    for (const r of routes) {
      const file = r === "/" ? "index" : r.slice(1).replace(/\//g, ".");
      const candidates = [
        `src/routes/${file}.tsx`,
        `src/routes/_tabs.${file}.tsx`,
        `src/routes/${file}.index.tsx`,
      ];
      expect(
        candidates.some((c) => existsSync(c)),
        r,
      ).toBe(true);
    }
  });
});

describe("أذكار الويدجت", () => {
  const book = JSON.parse(read("public/data/azkar/hisn-al-muslim.json")) as AzkarBook;
  const ch = book.chapters.find((c) => c.id === 27)!;
  const az = widgetAzkarFrom(ch.azkar);

  it("أذكار الصباح والمساء القصيرة بنصّ نظيف ومفتاح صورة", () => {
    expect(az.morning.length).toBeGreaterThan(10);
    expect(az.evening.length).toBeGreaterThan(10);
    for (const z of [...az.morning, ...az.evening]) {
      expect(z.text.length).toBeLessThanOrEqual(WIDGET_ZIKR_MAX);
      expect(z.text).not.toMatch(/^\(/);
      expect(z.text).not.toMatch(/[«»]/);
      expect(z.pk).toMatch(/^[QZ]/);
    }
  });

  it("صيغة المساء تختلف حيث يلزم", () => {
    const m = az.morning.find((z) => z.id === 78)!;
    const e = az.evening.find((z) => z.id === 78)!;
    expect(m.text).toContain("أَصْبَحْنَا");
    expect(e.text).not.toBe(m.text);
    expect(az.morning.some((z) => z.id === 97)).toBe(false); // ذكر مسائي فقط
  });

  it("عبارات التكرار والتنظيف", () => {
    expect(repeatNote(1)).toBe("مرة واحدة");
    expect(repeatNote(2)).toBe("مرتين");
    expect(repeatNote(3)).toBe("٣ مرات");
    expect(repeatNote(100)).toBe("١٠٠ مرة");
    expect(cleanZikrText("(ثَلَاثَ مَرَّاتٍ) «بِسْمِ اللهِ»")).toBe("بِسْمِ اللهِ");
    expect(cleanZikrText("(عَشْرَ مَرَّاتٍ) أَوْ (مَرَّةً) «لَا إِلَهَ»")).toBe("لَا إِلَهَ");
  });
});

describe("ضغطات المسبحة من الويدجت", () => {
  it("تُضاف إلى جلستها وتثبت لحظة بلوغ الهدف", () => {
    const s0 = startSession(
      emptyTasbihStore(),
      { ref: { kind: "library", id: "x" }, name: "سبحان الله", text: "سبحان الله", target: 33 },
      1,
    );
    const id = s0.activeId!;
    const s1 = applyExternalTaps(s0, { [id]: 33, nope: 5 }, 10);
    const s = s1.sessions.find((x) => x.id === id)!;
    expect(s.count).toBe(33);
    expect(s.reachedAt).toBe(10);
    expect(applyExternalTaps(s1, {})).toBe(s1);
  });
});
