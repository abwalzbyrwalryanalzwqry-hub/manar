/**
 * منار — حارس حقوق الأصوات.
 *
 * كل ملف صوتي يُشحن داخل التطبيق يجب أن يكون موثّق الحقوق في
 * `docs/audio/licenses.json`: تسجيلات الأذان والإقامة، والنداءات الصوتية
 * وتنبيهات «اقتربت الصلاة» (تسجيلات صاحب المشروع)، والنغمات المولَّدة داخل منار.
 * إضافة ملف دون توثيقه تُفشل هذا الاختبار.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ADHAN_ASSETS } from "@/lib/adhan-library-assets";
import { REMINDER_TONES } from "@/lib/daily-reminders";
import { PRAYER_APPROACH_CLIPS } from "@/lib/prayer-approach-audio";

const root = resolve(__dirname, "../..");
type Licenses = {
  rights_status: string;
  verified_adhan_files: string[];
  verified_iqamah_files: string[];
  verified_reminder_files: string[];
  verified_prayer_approach_files: string[];
  owner_recordings: { covers: string[] };
};
const licenses = JSON.parse(
  readFileSync(resolve(root, "docs/audio/licenses.json"), "utf8"),
) as Licenses;

const audioIn = (dir: string) =>
  readdirSync(resolve(root, "public/audio", dir)).filter((f) => /\.(mp3|m4a|ogg|wav)$/i.test(f));
const fileOf = (url: string) => url.split("/").pop() ?? "";

describe("حقوق الأصوات موثّقة لكل ملف مشحون", () => {
  it("الحالة العامة VERIFIED", () => {
    expect(licenses.rights_status).toBe("VERIFIED");
  });

  it("مكتبة الأذان: كل ملف له مدخل VERIFIED في الفهرس، والعدد يطابق التوثيق", () => {
    // ملفات المكتبة أعيدت تسميتها بأسماء لاتينية، و`licenses.json` يحفظ أسماء المصدر؛
    // فالربط عبر فهرس ADHAN_ASSETS، والعدد يجب أن يطابق قائمة التوثيق.
    const files = audioIn("library");
    const byFile = new Map(ADHAN_ASSETS.map((a) => [fileOf(a.url), a]));
    for (const f of files) {
      expect(byFile.has(f), f).toBe(true);
      expect(byFile.get(f)?.rightsStatus).toBe("VERIFIED");
    }
    expect(files.length).toBe(licenses.verified_adhan_files.length);
  });

  it("مكتبة الإقامة", () => {
    for (const f of audioIn("iqamah")) expect(licenses.verified_iqamah_files).toContain(f);
  });

  it("أصوات التذكير: كل ملف تسجيل موثّق، ولا نغمات مولَّدة", () => {
    for (const f of audioIn("reminders")) expect(licenses.verified_reminder_files, f).toContain(f);
    expect(licenses).not.toHaveProperty("generated_tone_files");
  });

  it("النداءات الصوتية في الواجهة كلها من تسجيلات صاحب المشروع", () => {
    const voices = REMINDER_TONES.filter((t) => t.kind === "voice").map((t) => fileOf(t.url));
    expect(voices.length).toBeGreaterThan(0);
    for (const f of voices) expect(licenses.verified_reminder_files).toContain(f);
  });

  it("تنبيهات «اقتربت الصلاة» كلها موثّقة", () => {
    for (const f of audioIn("prayer-approach"))
      expect(licenses.verified_prayer_approach_files).toContain(f);
    for (const clip of Object.values(PRAYER_APPROACH_CLIPS))
      expect(licenses.verified_prayer_approach_files).toContain(fileOf(clip.url));
  });

  it("تسجيلات صاحب المشروع مشمولة بإقرار الملكية", () => {
    expect(licenses.owner_recordings.covers).toEqual(
      expect.arrayContaining(["verified_reminder_files", "verified_prayer_approach_files"]),
    );
  });
});
