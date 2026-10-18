package app.manar.islamic;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.SystemClock;
import android.util.TypedValue;
import android.widget.RemoteViews;

/**
 * مجموعة أدوات تركيب الويدجت: كل ويدجت هيكل واحد ({@code wd_root}) تُضاف إليه
 * صفوف وأعمدة ونصوص مرسومة. لا تخطيط ثابت لكل ويدجت ولكل مقاس؛ المقاس الفعلي
 * يحدّد ما يُعرض ({@link WidgetRender}).
 */
final class WidgetUi {

    final Context context;
    final String pkg;
    final WidgetArt art;
    final WidgetTheme theme;
    /** بكسل لكل dp. */
    final float dp;
    /** معامل حجم الخط في التطبيق. */
    final float scale;
    final int densityDpi;
    final int widgetId;
    private int clickSeq;

    WidgetUi(Context context, WidgetArt art, WidgetTheme theme, float scale, int widgetId) {
        this.context = context;
        this.pkg = context.getPackageName();
        this.art = art;
        this.theme = theme;
        this.dp = context.getResources().getDisplayMetrics().density;
        this.densityDpi = context.getResources().getDisplayMetrics().densityDpi;
        this.scale = scale <= 0 ? 1f : Math.max(0.85f, Math.min(1.3f, scale));
        this.widgetId = widgetId;
    }

    int px(float dps) {
        return Math.round(dps * dp);
    }

    /** الهيكل: خلفية النمط بالشفافية المطلوبة. */
    RemoteViews root(int opacity) {
        RemoteViews v = new RemoteViews(pkg, R.layout.wd_root);
        v.removeAllViews(R.id.wd_content);
        if (theme.bgRes != 0) {
            v.setImageViewResource(R.id.wd_bg, theme.bgRes);
            v.setInt(R.id.wd_bg, "setImageAlpha", Math.round(255 * Math.max(0, Math.min(100, opacity)) / 100f));
        } else {
            v.setImageViewResource(R.id.wd_bg, android.R.color.transparent);
        }
        return v;
    }

    RemoteViews box(int layout) {
        RemoteViews v = new RemoteViews(pkg, layout);
        return v;
    }

    /** سطر مرسوم: النمط (B/M/R/N/S)، الحجم dp، اللون، أقصى عرض dp. */
    RemoteViews text(String style, String text, float sizeDp, int color, float maxWdp) {
        return text(style, text, sizeDp, color, maxWdp, false);
    }

    RemoteViews text(String style, String text, float sizeDp, int color, float maxWdp, boolean clickable) {
        RemoteViews v = new RemoteViews(pkg, clickable ? R.layout.wd_text_click : R.layout.wd_text);
        Bitmap b = WidgetPaint.line(art, style, text, px(sizeDp * scale), px(maxWdp), densityDpi);
        v.setImageViewBitmap(R.id.wd_img, b);
        tint(v, R.id.wd_img, color);
        v.setContentDescription(R.id.wd_img, text);
        return v;
    }

    /** فقرة (آية/ذكر) تتّسع في المساحة. */
    RemoteViews para(String key, String text, float sizeDp, int color, float maxWdp, float maxHdp,
                     boolean center) {
        RemoteViews v = new RemoteViews(pkg, R.layout.wd_text);
        Bitmap b = WidgetPaint.para(art, key, text, px(sizeDp * scale), px(maxWdp), px(maxHdp),
                densityDpi, center);
        v.setImageViewBitmap(R.id.wd_img, b);
        tint(v, R.id.wd_img, color);
        v.setContentDescription(R.id.wd_img, text);
        return v;
    }

    RemoteViews gap(int dps) {
        int res = dps <= 2 ? R.layout.wd_gap2 : dps <= 4 ? R.layout.wd_gap4 : dps <= 6 ? R.layout.wd_gap6
                : dps <= 8 ? R.layout.wd_gap8 : R.layout.wd_gap12;
        return new RemoteViews(pkg, res);
    }

    RemoteViews space() {
        return new RemoteViews(pkg, R.layout.wd_space);
    }

    RemoteViews vspace() {
        return new RemoteViews(pkg, R.layout.wd_vspace);
    }

    /** شريط تقدّم بعرض dp. */
    RemoteViews bar(float wdp, float hdp, float fraction) {
        RemoteViews v = new RemoteViews(pkg, R.layout.wd_bar);
        int w = px(wdp);
        int h = Math.max(2, px(hdp));
        v.setImageViewBitmap(R.id.wd_img, WidgetPaint.bar(w, h, 1f, densityDpi));
        tint(v, R.id.wd_img, theme.track);
        v.setImageViewBitmap(R.id.wd_img2, WidgetPaint.bar(w, h, fraction, densityDpi));
        tint(v, R.id.wd_img2, theme.accent);
        return v;
    }

    /** حلقة تقدّم بمقاس dp؛ أضف المحتوى إلى {@code R.id.wd_box}. */
    RemoteViews ring(float sizeDp, float strokeDp, float fraction) {
        RemoteViews v = new RemoteViews(pkg, R.layout.wd_stack);
        v.removeAllViews(R.id.wd_box);
        int s = px(sizeDp);
        float st = strokeDp * dp;
        v.setImageViewBitmap(R.id.wd_img, WidgetPaint.ring(s, st, 1f, densityDpi));
        tint(v, R.id.wd_img, theme.track);
        v.setImageViewBitmap(R.id.wd_img2, WidgetPaint.ring(s, st, fraction, densityDpi));
        tint(v, R.id.wd_img2, theme.accent);
        return v;
    }

    RemoteViews dot(float sizeDp, boolean filled, int color) {
        RemoteViews v = new RemoteViews(pkg, R.layout.wd_text);
        v.setImageViewBitmap(R.id.wd_img, WidgetPaint.dot(px(sizeDp), filled, 1.6f * dp, densityDpi));
        tint(v, R.id.wd_img, color);
        return v;
    }

    RemoteViews icon(int drawable, int color) {
        RemoteViews v = new RemoteViews(pkg, R.layout.wd_icon);
        v.setImageViewResource(R.id.wd_img, drawable);
        tint(v, R.id.wd_img, color);
        return v;
    }

    /** العدّاد الحيّ بالثواني حتى {@code atMillis} (خط النظام). */
    RemoteViews chrono(long atMillis, float sizeSp, int color) {
        RemoteViews v = new RemoteViews(pkg, R.layout.wd_chrono);
        long base = SystemClock.elapsedRealtime() + Math.max(0, atMillis - System.currentTimeMillis());
        v.setChronometer(R.id.wd_chrono, base, null, true);
        v.setChronometerCountDown(R.id.wd_chrono, true);
        v.setTextColor(R.id.wd_chrono, color);
        v.setTextViewTextSize(R.id.wd_chrono, TypedValue.COMPLEX_UNIT_SP, sizeSp * scale);
        return v;
    }

    /**
     * يلوّن قناع ALPHA_8: المرشّح يعطي اللون، وشفافية اللون تُطبَّق على الصورة
     * (SRC_ATOP يتجاهل شفافية المرشّح).
     */
    static void tint(RemoteViews v, int id, int color) {
        v.setInt(id, "setColorFilter", color | 0xFF000000);
        v.setInt(id, "setImageAlpha", (color >>> 24) & 0xFF);
    }

    /** يفتح التطبيق على مسار (يُتحقَّق منه في الويب كما مع الإشعارات). */
    PendingIntent open(String route) {
        /* بلا data: لا يصل كرابط إلى appUrlOpen؛ رمز الطلب الفريد يميّز النوايا. */
        clickSeq++;
        Intent intent = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (route != null) intent.putExtra(MainActivity.EXTRA_ROUTE, route);
        return PendingIntent.getActivity(context, widgetId * 64 + (clickSeq & 63), intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** إجراء داخل الويدجت دون فتح التطبيق (مسبحة، «التالي»، «صلّيت»). */
    PendingIntent action(String action, String arg) {
        Intent intent = new Intent(context, WidgetActionReceiver.class)
                .setAction(action)
                .setData(Uri.parse("manar-widget-action://" + widgetId + "/" + (++clickSeq)))
                .putExtra(WidgetActionReceiver.EXTRA_ID, widgetId);
        if (arg != null) intent.putExtra(WidgetActionReceiver.EXTRA_ARG, arg);
        return PendingIntent.getBroadcast(context, widgetId * 64 + (clickSeq & 63), intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
