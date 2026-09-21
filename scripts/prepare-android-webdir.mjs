/**
 * Manar — prepares dist/client so it is a valid Capacitor `webDir`.
 *
 * The TanStack Start SPA build emits `_shell.html` (the client shell) plus one
 * prerendered directory per route. Capacitor's WebView loads `index.html` from
 * the root of `webDir`, so the shell is copied there and the client router
 * takes over from the first paint. Without this step the app opens on a blank
 * white screen.
 */
import {
  copyFileSync,
  existsSync,
  rmSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const clientDir = resolve(root, "dist/client");
const shell = resolve(clientDir, "_shell.html");
const index = resolve(clientDir, "index.html");

if (!existsSync(shell)) {
  console.error(
    "[manar] dist/client/_shell.html is missing — run `vite build --config vite.config.capacitor.ts` first.",
  );
  process.exit(1);
}

copyFileSync(shell, index);

// The native shell never talks to a server: drop the SSR bundle so it cannot be
// shipped inside the APK by accident.
rmSync(resolve(root, "dist/server"), { recursive: true, force: true });
rmSync(resolve(clientDir, "_headers"), { force: true });

// Capacitor serves from https://localhost — make sure nothing points at a host.
/* ترقيعٌ ودرعٌ يُحقنان في رأس `index.html` قبل حزمة التطبيق.
 *
 * ١) الترقيع: `Object.hasOwn` (ES2022) يستعمله موجّه TanStack، و`WebView`
 *    الأقدم من Chrome 93 لا يعرفها. النتيجة `TypeError` في أول سطر يعمل من
 *    الموجّه، فلا يُرسم شيء أبداً. و`minSdk` هنا ٢٤ (أندرويد ٧)، و`WebView`
 *    يُحدَّث من متجر Play لا مع النظام — فوجود أجهزة بمحرّك قديم أمرٌ واقع.
 *    الترقيع أرخص من إسقاط تلك الأجهزة.
 *
 * ٢) الدرع: لو فشل الإقلاع لأي سبب آخر، فالمستخدم يرى شاشةً فارغة لا تتغيّر
 *    ولا يعرف أهو عطلٌ أم بطء. بعد ثماني ثوانٍ بلا أي عنصر رسمه React
 *    نُظهر رسالةً عربية صريحة. تُضاف إلى `body` بعد انتهاء الترطيب، فلا
 *    تُربك React.
 */
const BOOT_GUARD = `<script>(function(){
if(!Object.hasOwn){Object.defineProperty(Object,"hasOwn",{value:function(o,k){
return Object.prototype.hasOwnProperty.call(Object(o),k)},writable:true,configurable:true})}
var T=8000;setTimeout(function(){try{
if(document.querySelector("[data-tsd-source],#root>*,nav,main"))return;
var d=document.createElement("div");
d.setAttribute("dir","rtl");
d.style.cssText="position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;"+
"align-items:center;justify-content:center;gap:14px;padding:32px;text-align:center;"+
"background:#0B1F1A;color:#F8F9FA;font:16px/1.9 system-ui,sans-serif";
d.innerHTML="<div style='font-size:22px;color:#C9A227'>تعذّر تشغيل منار</div>"+
"<div style='max-width:22em;opacity:.85'>لم يتمكّن التطبيق من الإقلاع على هذا الجهاز. "+
"الأرجح أن متصفّح أندرويد المدمج (Android System WebView) قديم.</div>"+
"<div style='max-width:22em;opacity:.85'>حدّثه من متجر Play ثم أعد فتح التطبيق.</div>";
document.body.appendChild(d)}catch(e){}},T)})();</script>`;

const html = readFileSync(index, "utf8");
if (/https?:\/\/(?!localhost)/.test(html.replace(/https?:\/\/www\.w3\.org/g, ""))) {
  console.warn("[manar] warning: index.html references an external origin.");
}
writeFileSync(index, html.replace("</head>", `${BOOT_GUARD}</head>`));

/* الصوت يُشحن مرّة واحدة لا مرّتين.
 *
 * التسجيلات تُنسخ إلى `android/.../res/raw` (scripts/sync-android-raw-audio.mjs)
 * لأن الخدمة الأمامية وحدها تستطيع تشغيل أذان كامل والتطبيق مغلق. ولو بقيت
 * نسخةٌ ثانية منها في أصول الويب لتضاعف حجم الحزمة ١٦ ميجابايت بلا فائدة:
 * الطبقة الأصلية لا تقرأ من أصول الويب أصلاً، والمعاينة داخل التطبيق تمرّ
 * بالمُشغّل الأصلي (`src/lib/audio-engine.ts`) لا بعنصر <audio>.
 *
 * تبقى النسخة في `public/audio` كما هي لبناء الويب. */
const audioDir = resolve(clientDir, "audio");
if (existsSync(audioDir)) {
  let freed = 0;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, e.name);
      if (e.isDirectory()) walk(full);
      else freed += statSync(full).size;
    }
  };
  walk(audioDir);
  rmSync(audioDir, { recursive: true, force: true });
  console.log(
    `[manar] dropped duplicated web audio (${(freed / 1048576).toFixed(1)} MB) — res/raw is the single source`,
  );
}

console.log("[manar] dist/client/index.html ready for `cap sync android`.");
