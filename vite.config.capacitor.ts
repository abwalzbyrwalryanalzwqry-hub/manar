// Manar — dedicated build config for the Capacitor (Android/iOS) shell.
// Produces a fully static SPA in dist/client (with index.html) that runs
// inside the native WebView with zero server involvement.
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/* تحميل كسول لمكتبة Supabase في قشرة أندرويد.
 *
 * `auth-attacher.ts` مُنشأ تلقائياً من Lovable (لا يُعدَّل يدوياً) ويستورد عميل
 * Supabase استيراداً ثابتاً من `start.ts`، فكانت المكتبة كلها (~٢٠٠ كيلوبايت
 * مضغوطة) تُحلَّل قبل رسم أول شاشة. هنا — في بناء أندرويد وحده — نستبدل به
 * نسخة كسولة مطابقة السلوك (`auth-attacher.native.ts`). بناء الويب لا يتغيّر. */
const nativeAttacher = fileURLToPath(
  new URL("./src/integrations/supabase/auth-attacher.native.ts", import.meta.url),
);
const lazyCloudPlugin = {
  name: "manar-lazy-cloud",
  enforce: "pre" as const,
  resolveId(source: string, importer?: string) {
    if (importer?.endsWith("auth-attacher.native.ts")) return null;
    if (/(^|\/)integrations\/supabase\/auth-attacher(\.ts)?$/.test(source)) return nativeAttacher;
    return null;
  },
};

export default defineConfig({
  nitro: false,
  vite: {
    plugins: [lazyCloudPlugin],
    build: {
      /* هدف بناء متحفّظ لمتصفّح أندرويد المدمج.
       *
       * Vite يستهدف افتراضياً متصفّحاتٍ حديثة، فتخرج الحزمة وفيها `??=`
       * و`||=` وحقول الصفوف الخاصة (`#x`). و`minSdk` هنا ٢٤ (أندرويد ٧)،
       * و`WebView` يُحدَّث من متجر Play لا مع النظام — فجهازٌ لم يُحدَّث
       * منذ سنوات يحمل محرّكاً أقدم من هذه الصيغ. والفشل صامت وقاسٍ: خطأ
       * تحليل واحد يُسقط الحزمة كلّها قبل أن تعمل سطراً، فلا يُرسم شيء،
       * وتبقى شاشة البداية الأصلية معلّقة بلا نهاية.
       *
       * chrome69 يغطّي أندرويد ٩ فما فوق ومعظم أجهزة ٧ و٨ المحدَّثة،
       * بزيادةٍ طفيفة في الحجم. التغطية هنا أهمّ من البايتات. */
      target: ["chrome69"],
    },
  },
  tanstackStart: {
    spa: { enabled: true },
    /* لا توليد مسبق في قشرة أندرويد.
     *
     * القشرة تُحمّل `index.html` واحداً دائماً (من https://localhost/) ثم
     * يتنقّل موجّه العميل في الذاكرة بلا طلب جديد. فأي HTML مُولَّد مسبقاً
     * لمسارٍ بعينه يحمل حالةً لا تُطابق المسار الذي سيُعرَض — شريط التبويبات
     * مثلاً يأتي وقد خُزِّن فيه تبويبٌ نشط خاطئ، فيفشل الترطيب
     * (React #418) ويُعاد بناء الشجرة كلّها في العميل. كان ذلك يقع في
     * سبع شاشات.
     *
     * تعطيله يُسقط أيضاً ٢٣ مجلّد HTML لا تُقرأ من الحزمة، ويُزيل خطوة
     * تتبّع كل رابط داخلي وقت البناء. */
    prerender: { enabled: false },
  },
});
