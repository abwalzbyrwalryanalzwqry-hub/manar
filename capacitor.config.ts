/// <reference types="node" />
/**
 * Manar — Capacitor (Android) configuration.
 *
 * This is the single, canonical native wrapper for Manar. Do not add a
 * second Android architecture (Cordova, Bubblewrap/TWA, WebView shell).
 *
 * The web UI stays exactly as it is; native services (scheduled Adhan
 * notifications, background audio, media session, reboot rescheduling,
 * notification actions, audio focus) are provided by the Capacitor
 * plugins listed in docs/android/README.md.
 *
 * `webDir` expects a static client build produced by `vite build`
 * (see docs/android/README.md for the exact command and the remaining
 * signing step — no APK is produced inside Lovable).
 */
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.manar.islamic",
  appName: "منار",
  webDir: "dist/client",
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
    captureInput: true,
    // Offline-first: everything the core experience needs is bundled.
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      /* شاشة البداية يجب أن تختفي من تلقاء نفسها مهما حدث.
       *
       * كانت `launchAutoHide: false`، أي أنها تبقى حتى يستدعي التطبيق
       * `hide()` من `NativeBridge`. وهذا رهانٌ على أن حزمة الويب أقلعت:
       * فإن فشلت — خطأ تحليل على محرّك قديم، أصلٌ ناقص، أي استثناء قبل
       * تركيب React — لا يُستدعى `hide()` أبداً، فيبقى المستخدم أمام شاشة
       * خضراء ثابتة لا تتغيّر ولا تُخبره بشيء، ولا سبيل للخروج إلا إغلاق
       * التطبيق.
       *
       * الآن تختفي تلقائياً بعد ثلاث ثوانٍ كحدٍّ أقصى. و`NativeBridge` ما
       * زال يُخفيها فور رسم أول شاشة (٣٥٠ مللي)، فالإقلاع السليم لا
       * يتأخّر — هذا سقفٌ للفشل لا تأخيرٌ للنجاح. وعند الفشل يظهر ما
       * تحتها: رسالة الخطأ التي يحقنها `prepare-android-webdir.mjs`. */
      launchAutoHide: true,
      launchShowDuration: 3000,
      launchFadeOutDuration: 250,
      backgroundColor: "#0B1F1A",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_manar",
      iconColor: "#C9A227",
      sound: "adhan",
    },
  },
};

export default config;
