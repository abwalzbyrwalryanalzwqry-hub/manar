import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { icons } from "@/components/manar/shell";
import { MORE_GROUPS, MORE_ITEMS, normalizeUsage, topUsed } from "@/lib/more-menu";

describe("قائمة المزيد", () => {
  it("أربع مجموعات، وكل عنصر مرة واحدة بأيقونة لا تتكرر", () => {
    expect(MORE_GROUPS.map((g) => g.title)).toEqual([
      "العبادة اليومية",
      "التنبيهات والأصوات",
      "الأدوات",
      "التطبيق",
    ]);
    const routes = MORE_ITEMS.map((i) => i.to);
    expect(new Set(routes).size).toBe(routes.length);
    const ic = MORE_ITEMS.map((i) => icons[i.icon]);
    expect(new Set(ic).size).toBe(ic.length);
    for (const d of ic) expect(d).toBeTruthy();
  });

  it("كل وجهة شاشة موجودة", () => {
    for (const { to } of MORE_ITEMS) {
      const f = to.slice(1);
      const found = [
        `src/routes/${f}.tsx`,
        `src/routes/${f}.index.tsx`,
        `src/routes/_tabs.${f}.tsx`,
      ];
      expect(
        found.some((p) => existsSync(p)),
        to,
      ).toBe(true);
    }
  });

  it("لا رموز تعبيرية في العناوين", () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const i of MORE_ITEMS) expect(emoji.test(i.label + i.desc), i.label).toBe(false);
    expect(emoji.test(readFileSync("src/routes/_tabs.more.tsx", "utf8"))).toBe(false);
  });
});

describe("الأكثر استخداماً", () => {
  it("مرتان على الأقل، الأعلى أولاً، والتعادل بترتيب القائمة", () => {
    const u = normalizeUsage({ "/qibla": 5, "/wird": 2, "/about": 2, "/calendar": 1, "/x": 99 });
    expect(u).toEqual({ "/qibla": 5, "/wird": 2, "/about": 2, "/calendar": 1 });
    expect(topUsed(u).map((i) => i.to)).toEqual(["/qibla", "/wird", "/about"]);
    expect(topUsed({})).toEqual([]);
  });

  it("يتجاهل القيم التالفة", () => {
    expect(normalizeUsage({ "/wird": "abc", "/qibla": -3 })).toEqual({});
    expect(normalizeUsage(null)).toEqual({});
  });
});
