/**
 * Manar — copies the bundled Adhan / Iqama recordings into android/res/raw.
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
 * `library` مقاطع الأذان، و`reminders`/`iqama` النغمات المُركَّبة محلياً
 * (scripts/build-tones.py). لو نُسخ الأول وحده صمتت كل تذكيرات الأذكار
 * والوِرد والإقامة حين يكون التطبيق مغلقاً — وهو بالضبط وقت الحاجة إليها. */
/* `prayer-approach` حزمة «التنبيهات قبل الصلاة» — مجلدها مستقل عن `reminders`. */
const sources = [
  "public/audio/library",
  "public/audio/reminders",
  "public/audio/iqama",
  "public/audio/prayer-approach",
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
for (const source of present) {
  for (const file of readdirSync(source)) {
    if (!file.toLowerCase().endsWith(".mp3")) continue;
    const name = `${rawResourceName(file)}.mp3`;
    /* res/raw مسطّح بلا مجلدات فرعية، فملفان بالاسم نفسه في مجلدين مختلفين
     * يدهس أحدهما الآخر بصمت وتُشغّل نغمةٌ خاطئة. نُعلِن الاصطدام بدل ابتلاعه. */
    if (seen.has(name)) {
      console.error(`[manar] اسم مورد مكرّر: raw/${name} من ${seen.get(name)} و${file}`);
      process.exit(1);
    }
    seen.set(name, file);
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
