package app.manar.islamic;

/** صيغ العدد العربية في نصوص Java — مطابقة لـ`minutesAr` في src/lib/notification-text.ts. */
final class ManarText {

    private ManarText() {}

    private static String digits(int n) {
        String s = String.valueOf(n);
        StringBuilder b = new StringBuilder();
        for (char c : s.toCharArray()) b.append((char) ('٠' + (c - '0')));
        return b.toString();
    }

    /** بعد حرف الجرّ: «دقيقة واحدة»، «دقيقتين»، «١٠ دقائق»، «١٥ دقيقة». */
    static String minutesGen(int m) {
        if (m == 1) return "دقيقة واحدة";
        if (m == 2) return "دقيقتين";
        int mod = m % 100;
        return digits(m) + (mod >= 3 && mod <= 10 ? " دقائق" : " دقيقة");
    }
}
