# أصوات تذكيرات الأذكار والوِرد — `public/audio/reminders/`

الفهرس البرمجي: `REMINDER_TONES` في `src/lib/daily-reminders.ts`. كل صوت يحمل
`kind` فتعرضه الواجهة في إحدى مجموعتين:

## النغمات (`kind: "tone"`) — مولَّدة داخل منار

| الملف                  | الاسم في الواجهة |
| ---------------------- | ---------------- |
| `azkar-morning.mp3`    | إشراق            |
| `azkar-evening.mp3`    | أصيل             |
| `wird.mp3`             | تأمّل            |
| `reminder-bell.mp3`    | جرس              |
| `reminder-default.mp3` | نداء             |
| `reminder-chime.mp3`   | نقرة             |

مولَّدة بـ`scripts/build-tones.py` (`npm run audio:tones`)، فلا حقوق فيها لطرف آخر.

## النداءات الصوتية (`kind: "voice"`) — تسجيلات بصوت بشري

`azkar-morning-01..03`، `azkar-evening-01..02`، `azkar-sleep-01..02`،
`azkar-wake-01`، `wird-daily-01`، `wird-quran-01`، `azkar-general-01..02`
(١٢ ملفًا، أُضيفت في #18).

**الحقوق: غير موثّقة بعد (PENDING).** بخلاف تسجيلات الأذان والإقامة
(`licenses.json`, `rights_status: VERIFIED`)، لا يوجد في المستودع توثيق لمصدر هذه
النداءات ولا لحقّ نشرها. لذلك صُحّحت عبارة الواجهة التي كانت تقول إن «كل النغمات
مُركَّبة داخل التطبيق فلا تحمل أي حقوق لطرف آخر».

المطلوب من صاحب المشروع قبل النشر: توثيق المصدر وحقّ الاستعمال لكل ملف، ثم
إضافتها إلى `licenses.json` تحت `verified_reminder_files` كما وُثّقت أصوات الإقامة.
