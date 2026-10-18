package app.manar.islamic;

/**
 * العبارات التي يركّبها الأصلي وحده في الويدجتات (العدّ، الحالات، العناوين).
 * كل كلمة هنا مرسومة بخطوط التطبيق في حزمة الفن، لأنها مدرجة حرفياً في
 * {@code NATIVE_PHRASES} في src/lib/widgets/art-spec.ts — يتحقّق من التطابق
 * tests/unit/widget-art-spec.test.ts (يقرأ القيم بين علامتي التنصيص هنا).
 */
final class WidgetWords {

    private WidgetWords() {}

    static final String REMAINING = "متبقٍّ";
    static final String AFTER = "بعد";
    static final String NOW = "حان الآن";
    static final String ENTERED = "دخل وقت";
    static final String IQAMA_IN = "الإقامة بعد";
    static final String IQAMA_DONE = "أُقيمت الصلاة";
    static final String NEXT_PRAYER = "الصلاة القادمة";
    static final String HOUR_ONE = "ساعة واحدة";
    static final String HOUR_TWO = "ساعتين";
    static final String HOURS = "ساعات";
    static final String HOUR = "ساعة";
    static final String MIN_ONE = "دقيقة واحدة";
    static final String MIN_TWO = "دقيقتين";
    static final String MINS = "دقائق";
    static final String MIN = "دقيقة";
    static final String AND = "و";
    static final String LESS_MIN = "أقل من دقيقة";
    static final String H = "س";
    static final String M = "د";
    static final String AM = "ص";
    static final String PM = "م";
    static final String DOT = "·";

    static final String TODAY_TIMES = "مواقيت اليوم";
    static final String VERSE_TODAY = "آية اليوم";
    static final String AZKAR_MORNING = "أذكار الصباح";
    static final String AZKAR_EVENING = "أذكار المساء";
    static final String NEXT = "التالي";
    static final String AZKAR_DONE = "اكتملت أذكار الوقت";
    static final String TASBIH = "المسبحة";
    static final String TASBIH_START = "ابدأ تسبيحاً من منار";
    static final String TASBIH_TAP = "اضغط للتسبيح";
    static final String TASBIH_GOAL = "بلغت الهدف";
    static final String PRAYED_TODAY = "صلواتي اليوم";
    static final String OF = "من";
    static final String PRAYED = "صلّيت";
    static final String PRAYED_ALL = "أحسنت، أتممت صلوات اليوم";
    static final String HIJRI_CAL = "التقويم الهجري";
    static final String KHATMAH = "الختمة";
    static final String TODAY = "اليوم";
    static final String DAY = "يوم";
    static final String WIRD_TODAY = "ورد اليوم";
    static final String WIRD_DONE = "أتممت ورد اليوم";
    static final String CONTINUE = "متابعة القراءة";
    static final String KHATMAH_START = "ابدأ ختمة من منار";
    static final String SEASON = "الموسم";
    static final String IFTAR = "الإفطار";
    static final String SUHOOR = "السحور";
    static final String IMSAK = "الإمساك";
    static final String MUSHAF = "المصحف";
    static final String AZKAR = "الأذكار";
    static final String QIBLA = "القبلة";
    static final String TASBEEH = "التسبيح";
    static final String OPEN_APP = "افتح منار لتحديث المواقيت";
    static final String RENEW = "افتح منار لتجديد المواقيت";
    static final String MANAR = "منار";

    static final String HIJRI_SUFFIX = "هـ";

    /** أسماء الصلوات بمفاتيحها (احتياط حين تُحسب المواقيت أصلياً). */
    static String prayerName(String key, boolean friday) {
        switch (key) {
            case "fajr": return "الفجر";
            case "sunrise": return "الشروق";
            case "dhuhr": return friday ? "الجمعة" : "الظهر";
            case "asr": return "العصر";
            case "maghrib": return "المغرب";
            case "isha": return "العشاء";
            default: return key;
        }
    }

    /** «بعد ساعتين و١٥ دقيقة»، «بعد ٤٥ دقيقة»، «بعد أقل من دقيقة». */
    static String afterPhrase(long ms, boolean latin) {
        long totalMin = (long) Math.ceil(ms / 60000.0);
        if (ms < 60000) return AFTER + " " + LESS_MIN;
        long h = totalMin / 60;
        long m = totalMin % 60;
        StringBuilder b = new StringBuilder(AFTER);
        if (h > 0) {
            b.append(' ').append(hoursWord(h, latin));
            if (m > 0) b.append(' ').append(AND).append(minutesWord(m, latin));
        } else {
            b.append(' ').append(minutesWord(m, latin));
        }
        return b.toString();
    }

    /** «ساعة واحدة»، «ساعتين»، «٣ ساعات»، «١١ ساعة». */
    static String hoursWord(long h, boolean latin) {
        if (h == 1) return HOUR_ONE;
        if (h == 2) return HOUR_TWO;
        long mod = h % 100;
        return digits(h, latin) + " " + (mod >= 3 && mod <= 10 ? HOURS : HOUR);
    }

    /** «دقيقة واحدة»، «دقيقتين»، «١٠ دقائق»، «١٥ دقيقة» — مطابقة لـ ManarText. */
    static String minutesWord(long m, boolean latin) {
        if (m == 1) return MIN_ONE;
        if (m == 2) return MIN_TWO;
        long mod = m % 100;
        return digits(m, latin) + " " + (mod >= 3 && mod <= 10 ? MINS : MIN);
    }

    /** الأرقام بالنمط الذي اختاره المستخدم في التطبيق. */
    static String digits(long n, boolean latin) {
        return digits(String.valueOf(n), latin);
    }

    static String digits(String s, boolean latin) {
        if (latin) {
            StringBuilder b = new StringBuilder(s.length());
            for (char c : s.toCharArray()) b.append(c >= '٠' && c <= '٩' ? (char) ('0' + (c - '٠')) : c);
            return b.toString();
        }
        StringBuilder b = new StringBuilder(s.length());
        for (char c : s.toCharArray()) b.append(c >= '0' && c <= '9' ? (char) ('٠' + (c - '0')) : c);
        return b.toString();
    }

    /** «٢:٠٥» للعدّاد الكبير (ساعات:دقائق). */
    static String clockCountdown(long ms, boolean latin) {
        long totalMin = Math.max(0, (long) Math.ceil(ms / 60000.0));
        long h = totalMin / 60;
        long m = totalMin % 60;
        return digits(h + ":" + (m < 10 ? "0" : "") + m, latin);
    }
}
