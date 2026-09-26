/**
 * Manar — copies the bundled Adhan / Iqama recordings into android/res/raw.
 *
 * Adhan: public/audio/library (mp3). Iqama: public/audio/iqamah (ogg/m4a) — two
 * separate folders, two separate catalogs; nothing here maps one onto the other.
 *
 * Android resource names may only contain [a-z0-9_], so `makkah-mulla-full-1.mp3`
 * becomes `makkah_mulla_full_1.mp3`. The same transform lives in
 * `src/lib/native-notifications.ts` (`rawResourceName`) so the web layer and the
 * native side always agree on the name.
 *
 * The files stay in `public/audio/library` as well: the in-app player uses those
 * for previews inside the WebView, while the native service needs res/raw to be
 * able to play while the app is closed.
 */
import {
  readdirSync,
  mkdirSync,
  copyFileSync,
  rmSync,
  existsSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
/* كل مجلدات الصوت التي يجدولها منار أصلياً.
 * `library` مقاطع الأذان، و`reminders` نداءات الأذكار والوِرد، و`iqamah`
 * تسجيلات الإقامة. لو نُسخ الأول وحده صمتت كل تذكيرات الأذكار
 * والوِرد والإقامة حين يكون التطبيق مغلقاً — وهو بالضبط وقت الحاجة إليها. */
/* `prayer-approach` حزمة «التنبيهات قبل الصلاة» — مجلدها مستقل عن `reminders`. */
const sources = [
  "public/audio/library",
  "public/audio/reminders",
  /* مكتبة الإقامة — تسجيلات حقيقية (Ogg Opus وM4A)، منفصلة تماماً عن `library`. */
  "public/audio/iqamah",
  "public/audio/prayer-approach",
  /* نسخ نغمات التنبيه بدرجات صوت ثابتة لقنوات الإشعار (build-volume-levels.mjs). */
  "assets/audio-levels",
].map((d) => resolve(root, d));
const target = resolve(root, "android/app/src/main/res/raw");

export function rawResourceName(fileName) {
  return fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "a$1");
}

const present = sources.filter((s) => existsSync(s));
if (!present.length) {
  console.error(`[manar] missing every audio source: ${sources.join(", ")}`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

let bytes = 0;
const copied = [];
const seen = new Map();
/* الصيغ التي يفكّها MediaPlayer على كل إصدارات أندرويد المدعومة (minSdk 24)
 * ولا يضغطها aapt داخل الحزمة (فتبقى قابلة للفتح بواصف ملف مباشرة). */
const AUDIO_EXT = /\.(mp3|ogg|m4a)$/i;

for (const source of present) {
  for (const file of readdirSync(source)) {
    const ext = AUDIO_EXT.exec(file)?.[1]?.toLowerCase();
    if (!ext) continue;
    const name = `${rawResourceName(file)}.${ext}`;
    /* res/raw مسطّح بلا مجلدات فرعية، فملفان بالاسم نفسه في مجلدين مختلفين
     * يدهس أحدهما الآخر بصمت وتُشغّل نغمةٌ خاطئة. نُعلِن الاصطدام بدل ابتلاعه. */
    const base = rawResourceName(file);
    if (seen.has(base)) {
      console.error(`[manar] اسم مورد مكرّر: raw/${base} من ${seen.get(base)} و${file}`);
      process.exit(1);
    }
    seen.set(base, file);
    copyFileSync(resolve(source, file), resolve(target, name));
    bytes += statSync(resolve(source, file)).size;
    copied.push(`${file} -> raw/${name}`);
  }
}

/* مُقلّص الموارد (`shrinkResources true`) يحذف كل ما لا تشير إليه الشيفرة
 * باسمه صراحةً. و`AdhanService` يحلّ أسماء الأصوات وقتَ التشغيل عبر
 * `getResources().getIdentifier(...)`، فلا يرى المُقلّص أي إشارة إليها ويمسح
 * `res/raw` بالكامل — فيُبنى تطبيق يبدو سليماً بينما كل أذان وتنبيه فيه صامت.
 * هذا الملف يُبقيها. */
writeFileSync(
  resolve(target, "keep.xml"),
  '<?xml version="1.0" encoding="utf-8"?>\n' +
    "<!-- مُولَّد بـ scripts/sync-android-raw-audio.mjs — لا يُحرَّر يدوياً -->\n" +
    '<resources xmlns:tools="http://schemas.android.com/tools" tools:keep="@raw/*"/>\n',
  "utf8",
);

console.log(
  `[manar] copied ${copied.length} recordings into res/raw (${(bytes / 1048576).toFixed(1)} MB)`,
);
for (const line of copied) console.log(`         ${line}`);
