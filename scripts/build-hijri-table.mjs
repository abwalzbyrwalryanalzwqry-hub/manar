#!/usr/bin/env node
/* منار — يولّد جدول أم القرى الاحتياطي (src/lib/hijri-table.ts) من ICU نفسه.
 *
 * لماذا من ICU لا من مصدر آخر؟ التطبيق يحسب الهجري بـ`Intl` (islamic-umalqura)
 * على كل جهاز سليم، والجدول لا يُستعمل إلا حين يعجز `Intl` (WebView ببيانات ICU
 * ناقصة يرجع التقويم الميلادي بصمت). فيجب أن يطابق الجدولُ ما يعرضه الجهاز
 * السليم يوماً بيوم، لا أن يختلف عنه. ICU يضمّن جدول أم القرى للفترة
 * ١٣٠٠–١٦٠٠هـ. قارنّاه بمكتبة hijridate (بيانات أم القرى المنشورة): متطابقان
 * شهراً بشهر في ١٤٢٠–١٤٥٠هـ.
 *
 * الترميز: يوم ١ محرّم ١٣٠٠ (أيام منذ ١٩٧٠-٠١-٠١ UTC)، ثم بتٌّ لكل شهر
 * (١ = ٣٠ يوماً، ٠ = ٢٩) مُعبّأ في base64.
 *
 *   node scripts/build-hijri-table.mjs            # يكتب الملف
 *   node scripts/build-hijri-table.mjs --check    # يفشل إن اختلف المحفوظ
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FIRST_YEAR = 1300;
const LAST_YEAR = 1600;
const DAY = 86_400_000;
const out = resolve(dirname(fileURLToPath(import.meta.url)), "../src/lib/hijri-table.ts");

const fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const parts = (t) => {
  const o = {};
  for (const p of fmt.formatToParts(new Date(t + DAY / 2))) {
    if (p.type === "year") o.y = Number(p.value.replace(/[^\d-]/g, ""));
    if (p.type === "month") o.m = Number(p.value);
    if (p.type === "day") o.d = Number(p.value);
  }
  return o;
};

const starts = [];
for (let t = Date.UTC(1882, 0, 1); t < Date.UTC(2180, 0, 1); t += DAY) {
  const p = parts(t);
  if (p.d === 1 && p.y >= FIRST_YEAR && p.y <= LAST_YEAR + 1) starts.push(t / DAY);
}
// آخر عنصر: ١ محرّم ١٦٠١ — نهاية آخر شهر.
const months = (LAST_YEAR - FIRST_YEAR + 1) * 12;
if (starts.length < months + 1) throw new Error(`ICU returned ${starts.length} month starts`);
starts.length = months + 1;
const bytes = new Uint8Array(Math.ceil(months / 8));
for (let i = 0; i < months; i++) {
  const len = starts[i + 1] - starts[i];
  if (len !== 29 && len !== 30) throw new Error(`month ${i} has ${len} days`);
  if (len === 30) bytes[i >> 3] |= 1 << (i & 7);
}
const b64 = Buffer.from(bytes).toString("base64");
const lines = b64.match(/.{1,96}/g).map((l) => `  "${l}"`);

const src = `/* منار — جدول أم القرى الاحتياطي (${FIRST_YEAR}–${LAST_YEAR}هـ).
 *
 * مُولَّد آلياً بـ\`scripts/build-hijri-table.mjs\` من ICU ${process.versions.icu} — لا تعدّله يدوياً.
 * يُستعمل فقط حين لا يدعم \`Intl\` تقويم أم القرى على الجهاز (انظر \`hijri.ts\`).
 */

/** ١ محرّم ${FIRST_YEAR}هـ: أيام منذ ١٩٧٠-٠١-٠١ (UTC). */
export const UQ_FIRST_YEAR = ${FIRST_YEAR};
export const UQ_LAST_YEAR = ${LAST_YEAR};
export const UQ_EPOCH_DAY = ${starts[0]};

/** بتٌّ لكل شهر من ١ محرّم ${FIRST_YEAR}: ١ = ٣٠ يوماً، ٠ = ٢٩. */
export const UQ_MONTH_BITS =
${lines.join(" +\n")};
`;

if (process.argv.includes("--check")) {
  const cur = readFileSync(out, "utf8");
  const strip = (s) => s.replace(/ICU [\d.]+/, "ICU");
  if (strip(cur) !== strip(src)) {
    console.error("hijri-table.ts differs from this ICU");
    process.exit(1);
  }
  console.log("hijri-table.ts: OK");
} else {
  writeFileSync(out, src);
  console.log(`wrote ${out}: ${months} months, epoch ${starts[0]}`);
}
