/**
 * Manar — يولّد نسخاً مخفَّضة الصوت من نغمات التنبيه لقنوات الإشعار.
 *
 * على أندرويد ٨+ صوت الإشعار ملفٌّ ثابت في قناته، ولا يقبل «مستوى صوت»
 * برمجياً. لكي يعمل مؤشّر «التنبيهات» في شاشة الإشعارات فعلاً والتطبيق
 * مغلق، نشحن لكل نغمة تنبيه نسخاً بدرجات ثابتة (٢٠/٤٠/٦٠/٨٠٪ من سعة
 * الموجة) باسم `<مورد>_v<الدرجة>.mp3`، ويختار منار القناة المطابقة
 * للدرجة الأقرب (src/lib/native-notifications.ts). الدرجة ١٠٠ هي الملف
 * الأصلي نفسه.
 *
 * يُشغَّل يدوياً عند تغيّر نغمة (يحتاج ffmpeg)، والمخرجات مُضمَّنة في
 * المستودع حتى لا يعتمد بناء أندرويد على ffmpeg:
 *
 *   node scripts/build-volume-levels.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

/** نفس التحويل في sync-android-raw-audio.mjs (ذاك الملف يعمل عند استيراده). */
function rawResourceName(fileName) {
  return fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "a$1");
}

const root = resolve(import.meta.dirname, "..");
export const LEVELS = [20, 40, 60, 80];
const out = resolve(root, "assets/audio-levels");

const sources = [
  ...readdirSync(resolve(root, "public/audio/reminders"))
    .filter((f) => f.endsWith(".mp3"))
    .map((f) => resolve(root, "public/audio/reminders", f)),
  ...readdirSync(resolve(root, "public/audio/prayer-approach"))
    .filter((f) => f.endsWith(".mp3"))
    .map((f) => resolve(root, "public/audio/prayer-approach", f)),
  resolve(root, "public/audio/library/segment-takbir.mp3"),
];

/* حزمة المواسم: تسجيلات كلام أحادية، فتكفيها ترميزة VBR (‏LAME ‎-V5، نحو
 * ٦٠–٩٠ ك.ب/ث) بجودة الكلام نفسها وحجمٍ أصغر من ٩٦ ك ثابتة. النغمات
 * والمقاطع أعلاه تبقى على ترميزها كما هي حتى لا يتغيّر أيٌّ من ملفاتها. */
const seasonsDir = resolve(root, "public/audio/seasons");
const vbrSources = new Set(
  readdirSync(seasonsDir)
    .filter((f) => f.endsWith(".mp3"))
    .map((f) => resolve(seasonsDir, f)),
);
sources.push(...vbrSources);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

let n = 0;
for (const src of sources) {
  if (!existsSync(src)) throw new Error(`missing ${src}`);
  const raw = rawResourceName(src.split("/").pop());
  for (const level of LEVELS) {
    const dest = resolve(out, `${raw}_v${level}.mp3`);
    execFileSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      src,
      "-af",
      `volume=${(level / 100).toFixed(2)}`,
      "-map_metadata",
      "-1",
      "-c:a",
      "libmp3lame",
      ...(vbrSources.has(src) ? ["-q:a", "5"] : ["-b:a", "96k"]),
      dest,
    ]);
    n++;
  }
}
console.log(`[manar] ${n} نسخة مخفّضة في assets/audio-levels`);
