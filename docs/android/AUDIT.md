# منار — تدقيق جاهزية Android Release (بدون بناء)

تاريخ التدقيق: 2026-09-06. لم يُبنَ أي APK، ولم يُختبر أي جهاز.

## A) جاهز 100% (متحقَّق داخل Lovable)

- كل المحتوى الأساسي محلي: `public/data/quran/uthmani/*.json` (114 سورة)،
  `public/data/azkar/hisn-al-muslim.json` (132 فصلًا)، الوِرد داخل المصدر،
  `public/audio/library/*.mp3` (20 تسجيلًا، 16 MB)، `public/fonts/*.woff2` + `quran-fonts.css`.
- لا خطوط/صور/مكتبات/CDN خارجية. الفحص أظهر رابطًا خارجيًا واحدًا فقط:
  Nominatim في `src/lib/prayer.ts` — اختياري، محاط بـ `navigator.onLine !== false`
  و`AbortController` (6s)، والاسم يُحدَّد أولًا offline عبر `nearestCity`.
- مواقيت الصلاة تُحسب محليًا بـ `adhan` — لا شبكة.
- كل الحالة (الإعدادات، العدّادات، موضع القراءة، تقدّم الوِرد والأذكار) في `localStorage`.
  لا IndexedDB ولا Cache API ولا Service Worker → لا طبقة كاش هشّة تدّعي Offline.
- لا Route Loader ولا `createServerFn` مستخدم في أي صفحة (الملفان
  `src/lib/api/example.functions.ts` و`config.server.ts` غير مستوردين من الواجهة)
  → لا صفحة تحتاج سيرفر لتُفتح.
- منطق الجدولة الأصلية مكتوب فعليًا في `src/lib/native-notifications.ts`:
  يعيد بناء جدول 7 أيام، ويلغي فقط معرّفاته (نطاق 41000+) قبل إعادة الجدولة،
  ومعرّفاته فريدة لكل (يوم/صلاة/نوع) → لا تكرار ولا جدولة مزدوجة.
  وفي الشل الأصلي يُعطَّل مشغّل JS للأذان/الإقامة (`isNativeShell()`) فلا يتضاعف الصوت.
- RTL والخطوط العربية مضمّنة محليًا (Thmanyah + Amiri Quran + Scheherazade + Noto Naskh).

## B) يحتاج تعديلًا (يمنع Release حاليًا)

1. **حزم Capacitor غير مثبتة إطلاقًا.** `package.json` لا يحتوي أي `@capacitor/*`
   ولا `cap` script. `capacitor.config.ts` موجود لكنه بلا وقت تشغيل.
2. **مجلد `android/` غير موجود** — لم يُنشأ بعد (`npx cap add android`).
3. **البناء الحالي لا يُنتج `index.html`.** `dist/client/` يحتوي `assets, audio, data, fonts, _headers`
   فقط — الإخراج SSR/nitro. `webDir: "dist/client"` سيفتح شاشة بيضاء داخل WebView.
   لازم إخراج ثابت (SPA/prerender) يحتوي `index.html` قبل `cap sync`.
4. **زر الرجوع في أندرويد غير معالج** — لا مستمع `backButton` في المصدر، فالضغط عليه
   قد يُغلق التطبيق من أي شاشة. يحتاج `@capacitor/app` + `history.back()` مع خروج من الجذر فقط.
5. **صلاحيات Exact Alarm وBattery Optimization غير مطلوبة برمجيًا.**
   الكود يطلب صلاحية الإشعارات فقط (`ensureNativePermission`). على Android 13+/14
   يجب طلب `SCHEDULE_EXACT_ALARM` وإرشاد المستخدم لاستثناء تحسين البطارية،
   وإلا تتأخر التنبيهات أو تُلغى في وضع Doze.
6. **الأذان الطويل والتطبيق مغلق غير مضمون.** حاليًا الصوت يعتمد على صوت الإشعار،
   وأندرويد يقصّه عمليًا. للتشغيل الكامل مع أزرار القفل يلزم Foreground Service
   - Audio Focus + Media Session (موصوفة في README ولم تُنفَّذ بعد).
7. **ملفات الصوت غير منسوخة إلى `res/raw/`** — `soundName()` يُرجع اسمًا مجرّدًا يتوقعه
   أندرويد في `res/raw`، وهذا النسخ لم يحدث (لا مجلد android بعد).
8. **قنوات الإشعارات** `manar_adhan / manar_iqama / manar_reminders / manar_silent`
   مُشار إليها في الكود ولم تُنشأ في الطرف الأصلي.
9. **تبعيات غير مستخدمة** يمكن إزالتها لتصغير الحزمة: `recharts`, `embla-carousel-react`,
   `react-day-picker`, `input-otp`, `cmdk`, `react-resizable-panels`, `vaul`, `date-fns`
   (كلها tree-shaken فلا تضر الحجم النهائي — تنظيف اختياري لا يمنع البناء).

## C) ما لا يمكن اختباره داخل Lovable

- بناء Gradle، توليد Debug/Release APK أو AAB، والتوقيع.
- إطلاق إشعار مجدول فعلي والتطبيق مغلق، وسلوكه بعد إعادة تشغيل الهاتف.
- تشغيل الصوت في الخلفية، تركيز الصوت، أزرار شاشة القفل، وإيقاف الأذان من الإشعار.
- سلوك زر الرجوع الفعلي، شكل RTL والخطوط على WebView أندرويد، سرعة البدء على جهاز.
- وضع الطيران الحقيقي على الجهاز (تم فحص مكافئه في المتصفح بحجب كل الشبكات الخارجية:
  الصفحات والقرآن والأذكار والوِرد والصوت المحلي تعمل، بلا أي طلب خارجي).
- صلاحيات الموقع الدقيقة/التقريبية، وسلوك Doze/تحسين البطارية.

## D) الملفات التي يجب تعديلها قبل البناء

| الملف                                      | التعديل                                                      |
| ------------------------------------------ | ------------------------------------------------------------ |
| `package.json`                             | إضافة حزم Capacitor + سكربتات `cap` وسكربت بناء ثابت         |
| `vite.config.ts` أو سكربت بناء             | إنتاج إخراج ثابت يحتوي `index.html`                          |
| `capacitor.config.ts`                      | مطابقة `webDir` لمجلد الإخراج الثابت الفعلي                  |
| `src/routes/__root.tsx` (أو مزوّد جديد)    | مستمع زر الرجوع الأصلي                                       |
| `src/lib/native-notifications.ts`          | طلب Exact Alarm + إرشاد Battery Optimization                 |
| `android/app/src/main/AndroidManifest.xml` | الأذونات (بعد `cap add android`)                             |
| `android/app/build.gradle`                 | applicationId، SDK، versionCode/Name، signingConfigs، minify |
| `android/app/src/main/res/raw/`            | نسخ ملفات الأذان/الإقامة المطلوبة                            |
| `android/.../MainActivity` أو Plugin       | قنوات الإشعارات + Foreground Service للصوت                   |

## E) الأوامر النهائية للبناء (خارج Lovable)

```bash
bun add @capacitor/core @capacitor/cli @capacitor/android \
        @capacitor/local-notifications @capacitor/app @capacitor/device \
        @capacitor/preferences @capacitor/splash-screen @capacitor/status-bar \
        @capacitor/geolocation
bun run build              # يجب أن يُنتج index.html في مجلد webDir
npx cap add android
npx cap sync android
keytool -genkey -v -keystore manar.keystore -alias manar -keyalg RSA -keysize 2048 -validity 10000
cd android
./gradlew assembleDebug     # Debug APK
./gradlew assembleRelease   # Release APK
./gradlew bundleRelease     # AAB
```

## F) متطلبات Android خارج Lovable

- JDK 17، Android SDK 35، Gradle 8.11+، AGP 8.7+، Kotlin 2.0+ (متوافقة مع Capacitor 7).
- minSdk 24 / target+compile 35، `supportsRtl="true"`، الافتراضي `ar`، ثيم DayNight.
- الأذونات: POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM (بلا USE_EXACT_ALARM — سياسة Play),
  RECEIVE_BOOT_COMPLETED, FOREGROUND_SERVICE(+MEDIA_PLAYBACK), VIBRATE, WAKE_LOCK,
  ACCESS_COARSE/FINE_LOCATION, INTERNET (للمزامنة الاختيارية فقط).
- أيقونة إطلاق تكيّفية + `ic_stat_manar` + شاشة بداية `#0B1F1A`.
- keystore وكلمات مروره عبر متغيرات بيئة، وحفظه خارج المستودع.

## G) الحكم

**غير جاهز الآن للانتقال إلى Cloud Android Build.** المانعان الحاسمان:
لا حزم/مشروع Capacitor فعلي (B1, B2)، والبناء لا يُنتج `index.html` (B3).
بعد إصلاح B1–B4 يصبح البناء ممكنًا، وB5–B8 مطلوبة لتكون الإشعارات والأذان
موثوقة فعليًا والتطبيق مغلق.

---

## تحديث — نتيجة جولة الإصلاح والبناء (فرع `android-release-prep`)

تم معالجة العوائق الموثّقة أعلاه، وأُضيف عائقان جديدان ظهرا أثناء البناء الفعلي:

| #     | العائق                                                                                        | الحالة                                       |
| ----- | --------------------------------------------------------------------------------------------- | -------------------------------------------- |
| B1–B9 | العوائق الأصلية (بيئة البناء، الأيقونات، التوقيع، الأصوات الأصلية، الجدولة، الخطوط الخارجية…) | **مُصلَحة**                                  |
| B10   | `shrinkResources` يحذف كل ملفات `res/raw` (٢٠ ملف أذان) من حزمة الإصدار                       | **مُصلَح** عبر `res/raw/keep.xml`            |
| B11   | متغيّرات الأذان/الإقامة/التنبيه تشير إلى ملفات غير موجودة → رسالة «ملف الصوت غير متوفر»       | **مُصلَح** عبر ربطها بمكتبة الأصوات الحقيقية |

مخرجات مُتحقَّق منها: APK ٤٠ ميغابايت موقَّع (v2+v3)، AAB ٣٥ ميغابايت،
`versionCode=1`، `versionName=1.0.0`، minSdk 24، targetSdk 35.

حقوق تسجيلات الأذان والإقامة: **موثّقة** (`rightsStatus: "VERIFIED"`) — تحقّق منها صاحب
المشروع ووثّقها. يبقى غير مُخلَّص: تدوير مفاتيح Supabase المكشوفة في تاريخ Git.
