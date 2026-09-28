/* المرحلة ٢٢ — عن التطبيق والتواصل.
 *
 * حارس لثلاثة قرارات: بريد تواصل رسمي واحد في كل الشاشات، ولا «موقعنا»،
 * ورقم الإصدار من package.json لا مكتوباً يدوياً. ومعها: «قيّم التطبيق» مخفيّ
 * ما دام منار غير منشور. */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEVELOPER } from "@/lib/developer";
import { PUBLISHED_ON_PLAY } from "@/lib/app-store";
import { BUILD_VERSION, formatAppVersion } from "@/lib/app-version";

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const pkg = JSON.parse(read("package.json")) as { version: string };

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("بريد التواصل", () => {
  it("بريد رسمي واحد", () => {
    expect(DEVELOPER.email).toBe("zoqriidris@gmail.com");
    expect(Object.keys(DEVELOPER).filter((k) => /mail/i.test(k))).toEqual(["email"]);
  });

  it("لا عنوان بريد مكتوب في الواجهة خارج developer.ts", () => {
    const offenders = walk(resolve(root, "src"))
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith("developer.ts"))
      .filter((f) => /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(readFileSync(f, "utf8")))
      .map((f) => relative(root, f));
    expect(offenders).toEqual([]);
  });

  it("الخصوصية والشروط تقرآن البريد نفسه", () => {
    expect(read("src/components/manar/legal-page.tsx")).toContain("DEVELOPER.email");
  });
});

describe("صفحة عن التطبيق", () => {
  const about = read("src/routes/about.tsx");

  it("لا «موقعنا»", () => {
    expect(about).not.toContain("موقعنا");
  });

  it("رقم الإصدار غير مكتوب يدوياً", () => {
    expect(about).not.toMatch(/الإصدار\s*\d/);
    expect(about).toContain("useAppVersion");
  });

  it("«قيّم التطبيق» مربوط بحالة النشر", () => {
    expect(about).toMatch(/PUBLISHED_ON_PLAY\s*&&[\s\S]{0,80}قيّم التطبيق/);
    expect(PUBLISHED_ON_PLAY).toBe(false);
  });
});

describe("رقم الإصدار", () => {
  it("يُحقن من package.json", () => {
    expect(BUILD_VERSION).toBe(pkg.version);
  });

  it("صيغة العرض", () => {
    expect(formatAppVersion({ name: "1.0.0", build: null })).toBe("1.0.0");
    expect(formatAppVersion({ name: "1.0.0", build: "11" })).toBe("1.0.0 (11)");
    expect(formatAppVersion({ name: "", build: "11" })).toBe("");
  });
});
