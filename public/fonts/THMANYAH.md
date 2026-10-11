# خط ثمانية

واجهة منار مصمّمة بخط **ثمانية** (Thmanyah Sans و Thmanyah Serif Display)، وهو من تصميم وملكية
شركة ثمانية للنشر والتوزيع. ترخيصه يجيز تضمينه داخل التطبيقات، لكنه **يمنع رفع ملفات الخط أو
استضافتها أو إتاحتها للتنزيل**؛ لذلك لا توجد ملفاته في هذا المستودع العام، وتُجلب وقت البناء فقط.

- الترخيص: <https://font.thmanyah.com/licenses>
- التنزيل الرسمي: <https://font.thmanyah.com>

## في البناء الآلي (CI)

يجلب `scripts/fetch-thmanyah-fonts.sh` الملفات من المستودع الخاص `manar-fonts` بمفتاح نشر للقراءة
فقط محفوظ في السر `MANAR_FONTS_DEPLOY_KEY`، ويتحقق من سلامتها بـ `SHA256SUMS`، ثم يضعها هنا قبل
`npm run build:android`، ويتأكد سير العمل أنها مضمّنة في الحزمة. الخط إلزامي في بناء `main` والإصدار؛
وفي طلبات الدمج التي لا تصلها الأسرار (Dependabot والتفرعات) يُبنى بالخطوط البديلة.

## على جهازك

نزّل الخط من الموقع الرسمي، ثم إما أن تضع الملفات التالية في هذا المجلد يدوياً، أو تشغّل:

```bash
MANAR_FONTS_DIR=/path/to/fonts bash scripts/fetch-thmanyah-fonts.sh
```

```
thmanyah-sans-Light.woff2
thmanyah-sans-Regular.woff2
thmanyah-sans-Medium.woff2
thmanyah-sans-Bold.woff2
thmanyah-sans-Black.woff2
thmanyah-serif-display-Regular.woff2
thmanyah-serif-display-Bold.woff2
```

هذه الأسماء مُدرجة في `.gitignore` فلا تُرفع بالخطأ. وإن غابت يعمل التطبيق بالخطوط البديلة المضمّنة
المرخّصة بـ SIL OFL (IBM Plex Sans Arabic و Noto Naskh Arabic و Scheherazade New).
