/**
 * منار — حرّاس حجم الحزمة (بلا أي نقص في المحتوى).
 *
 * - أيقونات المشغّل WebP بلا فقد، ولا يجتمع PNG وWebP للاسم نفسه (خطأ بناء).
 * - أيقونات تثبيت الويب وملف manifest لا تُشحن داخل أندرويد ولا تُذكر فيه.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const res = resolve(root, "android/app/src/main/res");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("أيقونات المشغّل", () => {
  const dirs = readdirSync(res).filter((d) => /^mipmap-(m|h|xh|xxh|xxxh)dpi$/.test(d));

  it("كل الكثافات موجودة، وكلها WebP", () => {
    expect(dirs.length).toBe(5);
    for (const d of dirs) {
      const files = readdirSync(resolve(res, d));
      expect(
        files.filter((f) => f.endsWith(".png")),
        d,
      ).toEqual([]);
      for (const name of [
        "ic_launcher",
        "ic_launcher_round",
        "ic_launcher_foreground",
        "ic_launcher_bg",
      ]) {
        expect(files, d).toContain(`${name}.webp`);
      }
    }
  });

  it("سكربتا الأيقونات يكتبان WebP بلا فقد", () => {
    for (const p of ["scripts/build-brand-icons.py", "scripts/build-icon.py"]) {
      const src = read(p);
      expect(src).toMatch(/lossless=True/);
      expect(src).not.toMatch(/\.save\(d \/ "ic_launcher[a-z_]*\.png"/);
    }
  });
});

describe("ملفات الويب وحده خارج حزمة أندرويد", () => {
  it("سكربت التحضير يحذفها", () => {
    const s = read("scripts/prepare-android-webdir.mjs");
    for (const f of [
      "icon-512.png",
      "icon-192.png",
      "apple-touch-icon.png",
      "favicon.png",
      "manifest.webmanifest",
    ]) {
      expect(s).toContain(`"${f}"`);
    }
  });

  it("رأس الصفحة لا يذكرها في بناء أندرويد", () => {
    const s = read("src/routes/__root.tsx");
    expect(s).toMatch(/\.\.\.\(NATIVE_SHELL_BUILD\s*\?\s*\[\]/);
  });
});
