# تقرير إصلاح خطأ إقلاع نسخة أندرويد — منار

التاريخ: ٢١ سبتمبر ٢٠٢٦ · الإصدار: 1.0.0 (versionCode 1) · نقطة الانطلاق: `c402cdf`

---

## ١. المشكلة

عند فتح تطبيق أندرويد تظهر شاشة حدود الخطأ:

> تعذّر عرض هذه الشاشة — حدث خطأ غير متوقع. يمكنك إعادة المحاولة أو الرجوع إلى الرئيسية.

وفي تفاصيل الخطأ:

```
TypeError: r.addListener(...).then is not a function
    at uD (https://localhost/assets/index-QmH6f-1p.js:55:177228)
```

قبلها كانت النسخة تُظهر شاشة خضراء ثابتة (شاشة البداية لا تُخفى أبداً). الإشعارات وأصوات الأذان كانت تعمل لأن الجدولة تحدث في الطبقة الأصلية (`AlarmManager` + خدمة أمامية) ولا تعتمد على واجهة الويب.

---

## ٢. السبب الجذري (Root Cause)

| البند | القيمة |
| --- | --- |
| الملف الأصلي | `src/lib/native-shell.ts` (وكذلك `src/lib/native-notifications.ts`) |
| الدالة | `setupBackButton()` — وهي أول ما يُنفَّذ في `NativeBridge` |
| الاستدعاء | `window.Capacitor.Plugins.App.addListener("backButton", cb).then(...)` |
| الإضافة | `@capacitor/app` 7.1.2 عبر جسر `@capacitor/android` 7.6.9 |
| المنصة | أندرويد فقط (على الويب `window.Capacitor` غير موجود فتتوقف الدوال مبكراً) |

الخطأ ليس في الإضافة ولا في تعارض إصدارات، بل في **نقطة الدخول المستخدمة**:

1. `window.Capacitor.Plugins.X` على أندرويد **ليس** الغلاف الرسمي الذي يُنشئه `registerPlugin()`، بل كائن يُولّده الكود الأصلي في
   [`JSExport.getPluginJS()`](https://github.com/ionic-team/capacitor/blob/main/android/capacitor/src/main/java/com/getcapacitor/JSExport.java):

   ```java
   "t.addListener = function(eventName, callback) {\n" +
   "  return w.Capacitor.addListener('" + plugin.getId() + "', eventName, callback);\n" +
   "}"
   ```

2. و`Capacitor.addListener` في `native-bridge.js` يعيد كائناً **متزامناً** بلا أي وعد:

   ```js
   cap.addListener = (pluginName, eventName, callback) => {
     const callbackId = cap.nativeCallback(pluginName, 'addListener', { eventName }, callback);
     return { remove: async () => { ... } };   // ← ليس Promise
   };
   ```

3. أما الواجهة الموثّقة للإضافات فتعيد `Promise<PluginListenerHandle>`
   ([توثيق Capacitor](https://capacitorjs.com/docs/core-apis/plugins)). لذلك كان `.then(...)` يُنفَّذ على كائن عادي لا يملك `then`، فيُرمى
   `TypeError: addListener(...).then is not a function`.

4. الاستدعاء يقع في أول `useEffect` داخل `NativeBridge`، فتسقط الشجرة إلى حدود الخطأ، ولا يُنفَّذ `hideSplash()`. ومع
   `launchAutoHide: false` وخلفية شاشة بداية `#0B1F1A` ظهرت «الشاشة الخضراء»؛ وبعد إضافة حدود خطأ مترجمة ظهرت رسالة «تعذّر عرض هذه الشاشة».

### جرد كل المستمعات في المشروع

| المستمع | الإضافة | مكان الاستخدام | وقت التنفيذ | القيمة المرجعة قبل الإصلاح | `.then()`؟ | الحالة |
| --- | --- | --- | --- | --- | --- | --- |
| `backButton` | App 7.1.2 | `native-shell.ts → setupBackButton` | أول `useEffect` عند الإقلاع | كائن متزامن `{remove}` | نعم ← **سبب الانهيار** | أُصلح |
| `appStateChange` | App 7.1.2 | `native-shell.ts → onResume` | عند الإقلاع | كائن متزامن `{remove}` | نعم ← كان سينهار أيضاً | أُصلح |
| `localNotificationActionPerformed` | LocalNotifications 7.0.7 | `native-notifications.ts → attachNativeActionListener` | بعد تهيئة الإشعارات | كائن متزامن | لا (`await` فقط) | نُقل إلى الغلاف الرسمي |
| `change` (prefers-color-scheme) | واجهة متصفح | `native-bridge.tsx` | عند الإقلاع | `undefined` (DOM) | لا | سليم |

لا يوجد أي استخدام آخر لـ `addListener` في `src/` (تم البحث عن `addListener(` و`.addListener(` و`addListener(...).then`).

### مشكلتان إضافيتان ظهرتا أثناء الاختبار الحقيقي

| # | الخطورة | المشكلة | السبب | الإصلاح |
| --- | --- | --- | --- | --- |
| B | CRITICAL | `Error: Missing Supabase environment variable(s)` يُرمى من داخل Proxy في `src/integrations/supabase/client.ts` عند أول لمس لـ `supabase.auth` في `AuthProvider`، فتظهر شاشة «تعذّر عرض هذه الشاشة» — أي **نفس الشاشة لسبب مختلف تماماً** في أي بناء لا يملك ملف `.env` (الملف غير مرفوع إلى المستودع) | تطبيق محلي بالكامل يسقط لأن خدمة سحابية اختيارية غير مهيأة | طبقة `src/integrations/supabase/optional-client.ts`: عند غياب الإعداد يُسجَّل تحذير واضح، وتُعطَّل ميزات الحساب/المزامنة فقط، ويعمل كل المحلي (مواقيت، أذان، قرآن، أذكار) بشكل طبيعي |
| C | HIGH | `Error: "Preferences.then()" is not implemented on android` — التخزين الأصلي (SharedPreferences) كان **لا يُحمَّل إطلاقاً**، فتسقط البيانات إلى `localStorage` الذي يُمحى مع تخزين الـWebView | `import("@capacitor/preferences").then((m) => m.Preferences)` — وكيل الإضافة يعترض قراءة أي خاصية بما فيها `then`، فيعتبره المحرّك thenable وينادي `Preferences.then()` | تغليف الدوال في كائن عادي داخل `persistent-storage.ts` + تسجيل أي فشل بدل كتمه |
| D | MEDIUM | `Minified React error #418` عند كل إقلاع: عدم تطابق ترطيب، فيعيد React بناء الشجرة كلها | HTML المُسبَق (prerender) يحمل الصفحة كاملة بينما يرسم العميل على أندرويد شاشة «جارٍ استعادة بياناتك» من `StorageGate` | تمرير `VITE_NATIVE_SHELL=1` في `build:android` ليُنتج الـprerender الشاشة نفسها، فيتطابق الخادم والعميل |

---

## ٣. الإصلاح

### `src/lib/native-shell.ts` (أُعيدت كتابته)

- الانتقال من الجسر الخام إلى الواجهات الرسمية: `@capacitor/core` و`@capacitor/app` و`@capacitor/splash-screen` و`@capacitor/status-bar` (كلها اعتماديات موجودة أصلاً — لم تُضف أي حزمة).
- `App.addListener("backButton" | "appStateChange", cb)` تعيد الآن `Promise<PluginListenerHandle>` حسب الواجهة الموثّقة، وتُحفظ `handle.remove` للتنظيف.
- `isNativeApp()` تستخدم `Capacitor.isNativePlatform()`.
- أخطاء التسجيل أو الإزالة تُسجَّل بـ`console.error` ولا تُكتم (لا يوجد `catch` صامت).
- تعليق طويل في رأس الملف يشرح السبب الجذري ويمنع العودة إلى `window.Capacitor.Plugins`.

### `src/lib/native-notifications.ts`

- `LocalNotifications` من الغلاف الرسمي، و`ManarAdhan` (إضافتنا الأصلية) عبر `registerPlugin<ManarAdhanPlugin>("ManarAdhan")` — وهي الطريقة المعتمدة للإضافات المخصّصة.
- كل الدوال ما زالت محكومة بـ`Capacitor.isNativePlatform()`، فلا تغيير في سلوك الويب.
- لم تُحذف أو تُعطَّل أي ميزة: الأذان، الإقامة، التنبيهات المسبقة، الأذونات، المعاينة، الإيقاف — كلها كما هي.

### `src/integrations/supabase/optional-client.ts` (جديد) + `auth-context.tsx` + `cloud-sync.ts`

- `getCloud()` تعيد العميل أو `null`، و`isCloudConfigured()` للواجهات.
- دوال الحساب تُرجع رسالة عربية واضحة عند غياب الإعداد بدل رمي استثناء يسقط الواجهة.
- عند وجود الإعداد فالسلوك مطابق ١٠٠٪ للسابق (نفس الاستدعاءات، نفس الجداول، نفس الجلسات).

### `src/lib/persistent-storage.ts`

- تغليف `Preferences` في كائن عادي (إصلاح C) → SharedPreferences تعمل فعلياً الآن.

### `src/components/manar/storage-gate.tsx` + `package.json`

- `VITE_NATIVE_SHELL=1` في `build:android`، وبوابة التخزين تبدأ غير جاهزة في بناء القشرة الأصلية → لا عدم تطابق ترطيب (إصلاح D).

### `capacitor.config.ts` + `src/components/manar/native-bridge.tsx` + `src/routes/__root.tsx`

- `launchAutoHide: true, launchShowDuration: 3000` كشبكة أمان على مستوى النظام: لا يمكن لأي فشل في الويب أن يُجمّد شاشة البداية مرة أخرى.
- حدود الخطأ تُخفي شاشة البداية وتعرض رسالة عربية — لم تُحذف حدود الخطأ ولم تُكتم الأخطاء.
- الخطوط: عائلة **ثمانية** الرسمية مُضمَّنة (٧ ملفات woff2) وهي خط الواجهة الافتراضي.

### ما لم يُفعل عمداً

لا تعديل على `dist/` أو الحزم المصغّرة، ولا تعطيل مستمع أو إضافة، ولا حذف ميزة أو مسار أو جدول أو migration، ولا ترقية اعتماديات جزافاً (لم تتغير أي نسخة حزمة)، ولا `try/catch` يكتم السبب.

---

## ٤. توافق الإصدارات

| الحزمة | المثبت | المتوقع/المتوافق | الحالة |
| --- | --- | --- | --- |
| @capacitor/core | 7.6.9 | 7.x | ✅ |
| @capacitor/android | 7.6.9 | يطابق core | ✅ |
| @capacitor/cli | 7.6.9 | يطابق core | ✅ |
| @capacitor/app | 7.1.2 | ^7 | ✅ |
| @capacitor/local-notifications | 7.0.7 | ^7 | ✅ |
| @capacitor/preferences | 7.0.4 | ^7 | ✅ |
| @capacitor/splash-screen | 7.0.5 | ^7 | ✅ |
| @capacitor/status-bar | 7.0.6 | ^7 | ✅ |
| @capacitor/device | 7.0.5 | ^7 | ✅ |
| @capacitor/filesystem | 7.1.8 | ^7 | ✅ |
| @capacitor/geolocation | 7.1.8 | ^7 | ✅ |
| @capacitor/share | 7.0.4 | ^7 | ✅ |
| ManarAdhan (إضافة محلية) | داخل المشروع | — | ✅ |

لا يوجد أي عدم توافق: الإضافات التسع تُزامن بنجاح مع `cap sync android` والطبقة الأصلية مبنية من نفس الإصدارات.

### البيئة

| العنصر | الإصدار |
| --- | --- |
| Node | v20.20.1 |
| npm | 10.8.2 |
| Java (JDK) | Temurin 21.0.12.1 LTS |
| Gradle | 8.11.1 |
| Android Gradle Plugin | 8.7.2 |
| compileSdk / targetSdk | 35 |
| minSdk | 24 |
| React | 19 |
| Vite | 7 |

---

## ٥. تسلسل الإقلاع (بعد الإصلاح)

```
App Start (MainActivity → WebView → https://localhost)
  ↓ native-bridge.js + JSExport plugin JS + PluginHeaders
Capacitor init  →  isNativePlatform() = true
  ↓
StorageGate → hydratePersistentStorage() (SharedPreferences عبر الغلاف الرسمي)
  ↓
AuthProvider → getCloud() (سحابة اختيارية؛ غيابها لا يُسقط شيئاً)
  ↓
NativeBridge → App.addListener(backButton) + StatusBar + appStateChange   ← كان ينهار هنا
  ↓
LocalNotifications + ManarAdhan (جدولة ٧ أيام)
  ↓
SplashScreen.hide()  (350ms + حارس 4s + launchAutoHide 3s من النظام)
  ↓
Router → Onboarding / Login / Home
```

---

## ٦. البناء

| الخطوة | النتيجة |
| --- | --- |
| تنظيف (`dist`, `.output`, `assets/public`, `gradlew clean`) | PASS |
| `npm run build:android` (Vite + prepare-android-webdir + sync-android-raw-audio) | PASS |
| `cap sync android` (٩ إضافات) | PASS |
| `tsc --noEmit` | PASS |
| `assembleRelease` (APK) | PASS |
| `bundleRelease` (AAB) | PASS |
| توقيع الإصدار | PASS — مفتاح إنتاجي جديد `android/manar-release.keystore` (RSA 4096، صلاحية ٣٠ سنة)، `CN=Manar, O=Manar, L=Sanaa, C=YE` |
| محتوى الحزمة | حزمة الويب محلية بالكامل داخل `assets/public` (لا `server.url`، لا موقع خارجي، لا iframe) + ٨ ملفات خطوط ثمانية |

---

## ٧. الاختبارات التشغيلية

البيئة لا تتيح محاكي أندرويد (لا `/dev/kvm`)، لذلك نُفِّذت الاختبارات على **حزمة الويب المستخرَجة من `app-release.apk` نفسه**، داخل محرك Chromium حقيقي، مع محاكاة كاملة لزمن تشغيل Capacitor على أندرويد كما يضخّه النظام: `androidBridge`، و`PluginHeaders`، و`nativePromise`/`nativeCallback`، وكائنات `Plugins` القديمة التي يولّدها `JSExport` بـ`addListener` متزامن (أي أن الخطأ الأصلي قابل لإعادة الإنتاج في هذه البيئة). الملفات: `webview-test/android-bridge-stub.js` و`run-tests.mjs`.

| الاختبار | النتيجة |
| --- | --- |
| اكتشاف المنصة = android | PASS |
| أول تشغيل — لا شاشة خطأ | PASS |
| لا وجود لـ `addListener(...).then is not a function` | PASS |
| عدم استخدام الجسر القديم إطلاقاً (عدّاد = ٠) | PASS |
| تسجيل `backButton` و`appStateChange` عبر الغلاف الرسمي | PASS |
| `SplashScreen.hide` يُنفَّذ | PASS |
| رسم الشاشة الأولى (تعريف → تسجيل → الرئيسية) | PASS |
| المسارات الرئيسية `/prayer` `/quran` `/azkar` `/more` | PASS |
| التنقل الداخلي عبر شريط التبويب (٠ إعادة تحميل كامل) | PASS |
| زر الرجوع في شاشة داخلية | PASS |
| زر الرجوع في جذر التبويب (تنبيه «اضغط مرة أخرى للخروج») | PASS |
| الخلفية/الاستئناف (إعادة جدولة الأذان) | PASS |
| بدون إنترنت (إقلاع + تنقل + مواقيت) | PASS |
| عودة الإنترنت | PASS |
| إعادة التشغيل | PASS |
| تغيير أبعاد الشاشة/التدوير | PASS |
| وضع الزائر + الوصول إلى الرئيسية بالمواقيت الحقيقية | PASS |
| التخزين الأصلي (SharedPreferences) يُستدعى فعلياً | PASS (`Preferences.keys/get/set`) |
| نسخة الويب بنفس الشيفرة (بلا جسر) | PASS |
| سجل الأخطاء (مكافئ logcat): لا `TypeError` ولا `Unhandled` ولا `Unimplemented` | PASS |
| خطوط ثمانية مُحمَّلة (٣٠٠/٤٠٠/٥٠٠ + Serif Display) | PASS |

المجموع: ١٦/١٦ في المجموعة الآلية، إضافة إلى اختبارات التنقل والزائر اليدوية.

### ما لم يُختبر هنا

- تشغيل على جهاز/محاكي أندرويد حقيقي (غير متاح في البيئة) — يبقى الاختبار النهائي على جهازك.
- وصول الأذان فعلياً في وقته عبر `AlarmManager` والخدمة الأمامية (طبقة أصلية بحتة؛ تعمل عندك أصلاً).
- تسجيل الدخول والمزامنة السحابية: يحتاج `VITE_SUPABASE_URL` و`VITE_SUPABASE_PUBLISHABLE_KEY` في `.env` وقت البناء (`project_id = ***REMOVED***`). بدونها يعمل التطبيق كاملاً في وضع محلي/زائر.

---

## ٨. ملخص التغييرات

**ملفات معدّلة**

- `src/lib/native-shell.ts` (إعادة كتابة)
- `src/lib/native-notifications.ts`
- `src/lib/persistent-storage.ts`
- `src/lib/auth-context.tsx`
- `src/lib/cloud-sync.ts`
- `src/components/manar/native-bridge.tsx`
- `src/components/manar/storage-gate.tsx`
- `src/routes/__root.tsx`
- `src/styles.css`
- `capacitor.config.ts`
- `package.json` (سكربت `build:android` فقط)

**ملفات جديدة**

- `src/integrations/supabase/optional-client.ts`
- `public/fonts/thmanyah-fonts.css` + ٧ ملفات `woff2`
- `docs/android/STARTUP-ERROR-FIX-REPORT.md`
- `android/manar-release.keystore` + `android/keystore.properties` (غير مرفوعين إلى Git)

**اعتماديات**: لا إضافة ولا حذف ولا ترقية. **إضافات Capacitor**: لا تغيير في الإصدارات؛ فقط طريقة الوصول. **تغييرات أندرويد الأصلية**: لا تغيير في Java/Manifest/Gradle عدا استخدام مفتاح التوقيع. **قاعدة البيانات**: لا تغيير على المخطط أو الـmigrations أو البيانات.
