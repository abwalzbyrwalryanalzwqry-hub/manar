/**
 * منار — جدول تعويض ارتفاع الصوت لتسجيلات الأذان والإقامة.
 *
 * لماذا: التسجيلات المرفقة متفاوتة جداً في ارتفاعها المُدرَك (من −٢٣ إلى −٤
 * LUFS، أي فارق ≈ ١٩ ديسيبل). فأذان «المدينة — قصير» مثلاً يُسمع أضعف بكثير من
 * أذان «مكة — الملا» حتى مع أقصى مستوى في التطبيق وأقصى صوت منبّه في الجوال.
 *
 * الملفات لا تُعاد ترميزها (سياسة `docs/audio/README.md`: تبقى بصيغتها الأصلية).
 * بدلاً من ذلك نقيس كل ملف مرّة (EBU R128 عبر ffmpeg) ونولّد جدولاً Java يطبّق
 * منه `AdhanService` تضخيماً وقت التشغيل عبر `LoudnessEnhancer`.
 *
 * القاعدة: رفع الضعيف فقط حتى الهدف، بحدّ أعلى ١٢ ديسيبل. لا خفض لأي تسجيل —
 * فلا يصبح أي أذان أضعف مما كان.
 *
 * التشغيل (يحتاج ffmpeg): `node scripts/build-loudness.mjs`
 */
import { spawnSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/* نسخة مطابقة لـ `rawResourceName` في sync-android-raw-audio.mjs (لا نستورده
 * لأن استيراده يشغّل النسخ). */
function rawResourceName(fileName) {
  return fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "a$1");
}

const root = resolve(import.meta.dirname, "..");
const TARGET_LUFS = -12;
const MAX_BOOST_DB = 12;
/* تحت هذا الفارق لا يُحسّ التضخيم؛ لا داعي لتشغيل المؤثّر. */
const MIN_BOOST_DB = 1;

const folders = ["public/audio/library", "public/audio/iqamah"];

function measure(file) {
  const r = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128", "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const out = String(r.stderr ?? "");
  const summary = out.slice(out.lastIndexOf("Summary:"));
  const m = /I:\s+(-?\d+(?:\.\d+)?) LUFS/.exec(summary);
  if (!m) throw new Error(`تعذّر قياس ${file}`);
  return Number(m[1]);
}

const rows = [];
for (const folder of folders) {
  for (const file of readdirSync(resolve(root, folder)).sort()) {
    if (!/\.(mp3|ogg|m4a)$/i.test(file)) continue;
    const lufs = measure(resolve(root, folder, file));
    const boost = Math.min(MAX_BOOST_DB, Math.max(0, TARGET_LUFS - lufs));
    rows.push({ name: rawResourceName(file), file: `${folder}/${file}`, lufs, boost });
  }
}

const entries = rows
  .filter((r) => r.boost >= MIN_BOOST_DB)
  .map(
    (r) =>
      `        m.put("${r.name}", ${Math.round(r.boost * 100)}); // ${r.lufs.toFixed(1)} LUFS — ${r.file}`,
  )
  .join("\n");

const java = `package app.manar.islamic;

import java.util.HashMap;
import java.util.Map;

/**
 * مُولَّد آلياً بـ {@code node scripts/build-loudness.mjs} — لا تعدّله يدوياً.
 *
 * <p>تضخيم وقت التشغيل (ميلي‑بل) لكل تسجيل أذان/إقامة أضعف من الهدف
 * ${TARGET_LUFS} LUFS، بحدّ أعلى ${MAX_BOOST_DB} ديسيبل. التسجيلات الأعلى من الهدف
 * غير مدرجة: لا خفض لأي صوت.
 */
final class ManarLoudness {

    private static final Map<String, Integer> GAIN_MB = build();

    private ManarLoudness() {}

    private static Map<String, Integer> build() {
        Map<String, Integer> m = new HashMap<>();
${entries}
        return m;
    }

    /** التضخيم المطلوب لمورد {@code res/raw} بالميلي‑بل (٠ = بلا تضخيم). */
    static int gainMillibels(String rawName) {
        Integer g = rawName == null ? null : GAIN_MB.get(rawName);
        return g == null ? 0 : g;
    }
}
`;

writeFileSync(
  resolve(root, "android/app/src/main/java/app/manar/islamic/ManarLoudness.java"),
  java,
);
for (const r of rows) {
  console.log(`${r.lufs.toFixed(1).padStart(6)} LUFS  +${r.boost.toFixed(1)} dB  ${r.file}`);
}
