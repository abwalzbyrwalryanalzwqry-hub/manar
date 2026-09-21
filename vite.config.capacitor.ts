// Manar — dedicated build config for the Capacitor (Android/iOS) shell.
// Produces a fully static SPA in dist/client (with index.html) that runs
// inside the native WebView with zero server involvement.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: false,
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
