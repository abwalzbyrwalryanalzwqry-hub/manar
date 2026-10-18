package app.manar.islamic;

import android.content.Context;
import android.graphics.Color;
import android.os.Build;

/**
 * ألوان ويدجتات منار. الخلفيات أشكال XML (تتبع زوايا النظام على أندرويد ١٢+)،
 * والنصوص أقنعة تُلوَّن بهذه القيم ({@link WidgetUi#tint}).
 */
final class WidgetTheme {

    final String id;
    /** خلفية البطاقة، أو 0 للشفاف. */
    final int bgRes;
    final int fg;
    final int fg2;
    final int accent;
    final int track;
    /** خلفية الرقاقة المميّزة (الصلاة القادمة في مواقيت اليوم). */
    final int chipRes;
    final int chipFg;
    final boolean light;

    private WidgetTheme(String id, int bgRes, int fg, int fg2, int accent, int track,
                        int chipRes, int chipFg, boolean light) {
        this.id = id;
        this.bgRes = bgRes;
        this.fg = fg;
        this.fg2 = fg2;
        this.accent = accent;
        this.track = track;
        this.chipRes = chipRes;
        this.chipFg = chipFg;
        this.light = light;
    }

    private static final int WHITE = 0xFFFFFFFF;
    private static final int WHITE_70 = 0xB3FFFFFF;
    private static final int WHITE_20 = 0x33FFFFFF;
    private static final int GOLD = 0xFFE3C35A;
    private static final int INK = 0xFF1C2A3B;
    private static final int INK_65 = 0xA61C2A3B;
    private static final int INK_15 = 0x261C2A3B;
    private static final int BRONZE = 0xFF94661A;

    /**
     * @param id   قيمة {@code theme} من إعدادات الويدجت
     * @param dark مظهر التطبيق الآن (لنمط «يتبع التطبيق»)
     */
    static WidgetTheme resolve(Context context, String id, boolean dark) {
        if ("auto".equals(id)) id = dark ? "night" : "sand";
        switch (id == null ? "" : id) {
            case "emerald":
                return new WidgetTheme("emerald", R.drawable.wd_bg_emerald, WHITE, WHITE_70, GOLD,
                        WHITE_20, R.drawable.wd_chip_light, 0xFF0B3D31, false);
            case "sand":
                return new WidgetTheme("sand", R.drawable.wd_bg_sand, INK, INK_65, BRONZE,
                        INK_15, R.drawable.wd_chip_ink, 0xFFFBF6EC, true);
            case "clear":
                return new WidgetTheme("clear", 0, WHITE, 0xD9FFFFFF, GOLD,
                        0x40FFFFFF, R.drawable.wd_chip_light, INK, false);
            case "clearDark":
                return new WidgetTheme("clearDark", 0, INK, 0xCC1C2A3B, BRONZE,
                        0x331C2A3B, R.drawable.wd_chip_ink, 0xFFFFFFFF, true);
            case "dynamic":
                if (Build.VERSION.SDK_INT >= 31) return dynamic(context);
                // لا ألوان نظام قبل أندرويد ١٢ ← الليلي.
            default:
                return new WidgetTheme("night", R.drawable.wd_bg_night, WHITE, WHITE_70, GOLD,
                        WHITE_20, R.drawable.wd_chip_gold, 0xFF14213A, false);
        }
    }

    private static WidgetTheme dynamic(Context c) {
        int fg = c.getColor(android.R.color.system_neutral1_50);
        int fg2 = withAlpha(c.getColor(android.R.color.system_neutral2_200), 0xE6);
        int accent = c.getColor(android.R.color.system_accent1_200);
        int track = withAlpha(fg, 0x33);
        int chipFg = c.getColor(android.R.color.system_accent1_900);
        return new WidgetTheme("dynamic", R.drawable.wd_bg_dynamic, fg, fg2, accent, track,
                R.drawable.wd_chip_dynamic, chipFg, false);
    }

    static int withAlpha(int color, int alpha) {
        return Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color));
    }
}
