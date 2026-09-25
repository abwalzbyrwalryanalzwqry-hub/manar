package app.manar.islamic;

import java.util.HashMap;
import java.util.Map;

/**
 * مُولَّد آلياً بـ {@code node scripts/build-loudness.mjs} — لا تعدّله يدوياً.
 *
 * <p>تضخيم وقت التشغيل (ميلي‑بل) لكل تسجيل أذان/إقامة أضعف من الهدف
 * -12 LUFS، بحدّ أعلى 12 ديسيبل. التسجيلات الأعلى من الهدف
 * غير مدرجة: لا خفض لأي صوت.
 */
final class ManarLoudness {

    private static final Map<String, Integer> GAIN_MB = build();

    private ManarLoudness() {}

    private static Map<String, Integer> build() {
        Map<String, Integer> m = new HashMap<>();
        m.put("afasy_full_1", 210); // -14.1 LUFS — public/audio/library/afasy-full-1.mp3
        m.put("afasy_full_2", 100); // -13.0 LUFS — public/audio/library/afasy-full-2.mp3
        m.put("dossary_short", 300); // -15.0 LUFS — public/audio/library/dossary-short.mp3
        m.put("fajr_dossary_second", 280); // -14.8 LUFS — public/audio/library/fajr-dossary-second.mp3
        m.put("gulf_khushoo_full", 300); // -15.0 LUFS — public/audio/library/gulf-khushoo-full.mp3
        m.put("madinah_qassas_full", 170); // -13.7 LUFS — public/audio/library/madinah-qassas-full.mp3
        m.put("madinah_short", 1110); // -23.1 LUFS — public/audio/library/madinah-short.mp3
        m.put("madinah_tathweeb", 940); // -21.4 LUFS — public/audio/library/madinah-tathweeb.mp3
        m.put("makkah_mulla_full_2", 850); // -20.5 LUFS — public/audio/library/makkah-mulla-full-2.mp3
        m.put("makkah_tathweeb", 300); // -15.0 LUFS — public/audio/library/makkah-tathweeb.mp3
        m.put("omar_hashim_full", 510); // -17.1 LUFS — public/audio/library/omar-hashim-full.mp3
        m.put("segment_takbir", 270); // -14.7 LUFS — public/audio/library/segment-takbir.mp3
        m.put("iqamah_08", 430); // -16.3 LUFS — public/audio/iqamah/iqamah_08.m4a
        m.put("iqamah_09", 400); // -16.0 LUFS — public/audio/iqamah/iqamah_09.m4a
        m.put("iqamah_10", 410); // -16.1 LUFS — public/audio/iqamah/iqamah_10.m4a
        m.put("iqamah_11", 400); // -16.0 LUFS — public/audio/iqamah/iqamah_11.m4a
        m.put("iqamah_12", 410); // -16.1 LUFS — public/audio/iqamah/iqamah_12.m4a
        m.put("iqamah_13", 410); // -16.1 LUFS — public/audio/iqamah/iqamah_13.m4a
        m.put("iqamah_14", 420); // -16.2 LUFS — public/audio/iqamah/iqamah_14.m4a
        m.put("iqamah_15", 400); // -16.0 LUFS — public/audio/iqamah/iqamah_15.m4a
        m.put("iqamah_16", 380); // -15.8 LUFS — public/audio/iqamah/iqamah_16.m4a
        m.put("iqamah_17", 400); // -16.0 LUFS — public/audio/iqamah/iqamah_17.m4a
        m.put("iqamah_18", 410); // -16.1 LUFS — public/audio/iqamah/iqamah_18.m4a
        m.put("iqamah_19", 410); // -16.1 LUFS — public/audio/iqamah/iqamah_19.m4a
        return m;
    }

    /** التضخيم المطلوب لمورد {@code res/raw} بالميلي‑بل (٠ = بلا تضخيم). */
    static int gainMillibels(String rawName) {
        Integer g = rawName == null ? null : GAIN_MB.get(rawName);
        return g == null ? 0 : g;
    }
}
