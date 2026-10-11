# خط ثمانية

واجهة منار مصمّمة بخط **ثمانية** (Thmanyah Sans و Thmanyah Serif Display)، وهو من تصميم وملكية
شركة ثمانية للنشر والتوزيع. ترخيصه يسمح باستعماله داخل التطبيقات، لكنه **يمنع رفع ملفات الخط أو
استضافتها أو إتاحتها للتنزيل** على أي منصة، ولذلك لا توجد ملفات الخط في هذا المستودع العام.

- الترخيص: <https://font.thmanyah.com/licenses>
- التنزيل الرسمي: <https://font.thmanyah.com>

## قبل البناء

نزّل الخط من الموقع الرسمي وضع ملفات WOFF2 التالية في هذا المجلد (`public/fonts/`) بهذه الأسماء:

```
thmanyah-sans-Light.woff2
thmanyah-sans-Regular.woff2
thmanyah-sans-Medium.woff2
thmanyah-sans-Bold.woff2
thmanyah-sans-Black.woff2
thmanyah-serif-display-Regular.woff2
thmanyah-serif-display-Bold.woff2
```

هذه الأسماء مُدرجة في `.gitignore` فلا تُرفع بالخطأ. وإن لم توجد الملفات يعمل التطبيق كاملاً بالخطوط
البديلة المضمّنة المرخّصة بـ SIL OFL (IBM Plex Sans Arabic و Noto Naskh Arabic و Scheherazade New).
