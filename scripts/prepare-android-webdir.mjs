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
/* ترقيع: Object.hasOwn (ES2022) يستعمله موجّه TanStack، ولا يعرفه WebView
   أقدم من Chrome 93. دالّة وقت تشغيل لا صيغة، فلا يُلوِّضها المُحوِّل. */
if(!Object.hasOwn){Object.defineProperty(Object,"hasOwn",{value:function(o,k){
return Object.prototype.hasOwnProperty.call(Object(o),k)},writable:true,configurable:true})}

/* سجلّ أخطاء مبكّر.
   الأخطاء التي تقع قبل تركيب React لا يلتقطها أي حدّ أخطاء في التطبيق،
   فتضيع تماماً ويبقى المستخدم أمام شاشةٍ لا تشرح شيئاً. نلتقطها هنا،
   ونحفظها ليقرأها المستخدم ويُصوّرها. */
var L=[];
window.__manarBootLog=L;
function rec(kind,msg,extra){
  L.push({t:Math.round(performance.now()),kind:kind,msg:String(msg||"").slice(0,600),
          extra:String(extra||"").slice(0,600)});
  try{localStorage.setItem("manar.bootlog.v1",JSON.stringify(L).slice(0,8000))}catch(e){}
}
window.addEventListener("error",function(e){
  if(e.target&&e.target!==window&&e.target.src){rec("asset","تعذّر تحميل ملف",e.target.src);return}
  rec("error",e.message,(e.filename||"")+":"+(e.lineno||""));
},true);
window.addEventListener("unhandledrejection",function(e){
  var r=e.reason;rec("reject",r&&r.message?r.message:r,r&&r.stack?r.stack:"");
});
rec("boot","بدأ تحميل الصفحة","");

/* درع الإقلاع: إن لم يُرسم شيء أصلاً بعد عشر ثوانٍ، نُظهر ما التقطناه.
   نفحص محتوى body الفعلي لا عناصر بعينها — الفحص السابق كان يبحث عن
   nav/main، وهما غير موجودين في شاشة البداية، فأطلق إنذاراً كاذباً على
   تطبيقٍ يعمل. */
setTimeout(function(){try{
  if(document.getElementById("manar-boot-error"))return;
  var b=document.body;
  if(b&&b.querySelector("div,section,h1,svg")&&(b.innerText||"").trim().length>0)return;
  var rows=L.filter(function(x){return x.kind!=="boot"});
  var d=document.createElement("div");
  d.id="manar-boot-error";d.setAttribute("dir","rtl");
  d.style.cssText="position:fixed;inset:0;z-index:99999;overflow:auto;padding:28px 20px;"+
  "background:#0B1F1A;color:#F8F9FA;font:15px/1.9 system-ui,sans-serif";
  var h="<div style='font-size:21px;color:#C9A227;margin-bottom:10px'>تعذّر تشغيل منار</div>"+
  "<div style='opacity:.85;margin-bottom:18px'>لم يبدأ التطبيق على هذا الجهاز. التفاصيل أدناه — صوّرها وأرسلها للمطوّر.</div>";
  if(rows.length){h+="<div style='font:12px/1.7 monospace;direction:ltr;text-align:left;"+
    "background:#00000055;border-radius:10px;padding:12px;white-space:pre-wrap;word-break:break-all'>"+
    rows.map(function(x){return x.t+"ms ["+x.kind+"] "+x.msg+(x.extra?"\\n   "+x.extra:"")})
    .join("\\n\\n").replace(/</g,"&lt;")+"</div>";}
  else{h+="<div style='opacity:.7'>لم يُسجَّل أي خطأ — الأرجح أن متصفّح أندرويد المدمج"+
    " (Android System WebView) قديم. حدّثه من متجر Play.</div>";}
  h+="<div style='margin-top:20px;opacity:.6;font-size:13px'>"+navigator.userAgent.replace(/</g,"&lt;")+"</div>";
  d.innerHTML=h;b.appendChild(d);
}catch(e){}},10000);
})();</script>`;

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
