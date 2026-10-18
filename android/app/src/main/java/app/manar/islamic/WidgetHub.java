package app.manar.islamic;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

import java.util.ArrayList;
import java.util.List;

/**
 * مركز الويدجتات: يرسم كل النسخ لكل الأنواع، ويضبط منبّه تحديث واحداً غير
 * موقظ لأقرب تغيير (أذان، إقامة، منتصف الليل، أو الدقيقة التالية لعدّ
 * بالدقائق — لا يصل والشاشة مطفأة فلا يستهلك البطارية).
 */
final class WidgetHub {

    private WidgetHub() {}

    static final String ACTION_REFRESH = "app.manar.islamic.WIDGET_REFRESH";

    /** الأنواع ومزوّداتها — يطابق `WIDGET_KINDS` في src/lib/widgets/kinds.ts. */
    static final String[] KINDS = {
            "hub", "next", "day", "verse", "azkar", "tasbih", "prayed", "hijri", "quran"};

    static Class<?> providerFor(String kind) {
        switch (kind) {
            case "next":
                return NextPrayerWidget.class;
            case "day":
                return DayTimesWidget.class;
            case "verse":
                return VerseWidget.class;
            case "azkar":
                return AzkarWidget.class;
            case "tasbih":
                return TasbihWidget.class;
            case "prayed":
                return PrayedWidget.class;
            case "hijri":
                return HijriWidget.class;
            case "quran":
                return QuranWidget.class;
            default:
                return ManarWidget.class;
        }
    }

    static String kindOf(ComponentName provider) {
        if (provider == null) return "hub";
        for (String k : KINDS) {
            if (providerFor(k).getName().equals(provider.getClassName())) return k;
        }
        return "hub";
    }

    static final class Instance {
        final int id;
        final String kind;

        Instance(int id, String kind) {
            this.id = id;
            this.kind = kind;
        }
    }

    static List<Instance> instances(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        List<Instance> out = new ArrayList<>();
        for (String k : KINDS) {
            int[] ids = mgr.getAppWidgetIds(new ComponentName(context, providerFor(k)));
            if (ids != null) for (int id : ids) out.add(new Instance(id, k));
        }
        return out;
    }

    /** يرسم كل النسخ ويعيد عددها. */
    static synchronized int updateAll(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        WidgetData data = WidgetData.load(context);
        long now = System.currentTimeMillis();
        long next = Long.MAX_VALUE;
        boolean ticks = false;
        List<Instance> list = instances(context);
        for (Instance in : list) {
            WidgetRender.Frame f = frame(context, mgr, in.id, in.kind, data, now);
            try {
                mgr.updateAppWidget(in.id, WidgetRender.render(f));
                WidgetPrefs.markShown(context, in.id);
            } catch (RuntimeException e) {
                // صور أكبر من حدّ الـBinder أو مُشغّل متعثّر: نرسم الحالة الدنيا بدل الانهيار.
                try {
                    mgr.updateAppWidget(in.id, WidgetRender.stale(f));
                } catch (RuntimeException ignored) {
                    // لا شيء آخر يمكن فعله.
                }
            }
            next = Math.min(next, f.refreshAt);
            ticks |= f.minuteTicks;
        }
        if (list.isEmpty()) {
            cancel(context);
        } else {
            if (ticks) next = Math.min(next, (now / 60_000L + 1) * 60_000L + 500);
            schedule(context, next == Long.MAX_VALUE ? WidgetData.nextMidnight(now) : next);
        }
        return list.size();
    }

    static synchronized void updateOne(Context context, int id) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        AppWidgetProviderInfo info = mgr.getAppWidgetInfo(id);
        String kind = kindOf(info == null ? null : info.provider);
        WidgetRender.Frame f = frame(context, mgr, id, kind, WidgetData.load(context),
                System.currentTimeMillis());
        try {
            mgr.updateAppWidget(id, WidgetRender.render(f));
        } catch (RuntimeException ignored) {
            // يُعاد الرسم مع التحديث التالي.
        }
    }

    static WidgetRender.Frame frame(Context context, AppWidgetManager mgr, int id, String kind,
                                    WidgetData data, long now) {
        Bundle o = mgr.getAppWidgetOptions(id);
        float wDp = 0;
        float hDp = 0;
        if (o != null) {
            // الوضع الرأسي: العرض الأصغر والارتفاع الأكبر.
            wDp = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
            hDp = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        }
        if (wDp <= 0 || hDp <= 0) {
            AppWidgetProviderInfo info = mgr.getAppWidgetInfo(id);
            float d = context.getResources().getDisplayMetrics().density;
            if (info != null) {
                if (wDp <= 0) wDp = info.minWidth / d;
                if (hDp <= 0) hDp = info.minHeight / d;
            }
            if (wDp <= 0) wDp = 250;
            if (hDp <= 0) hDp = 110;
        }
        return new WidgetRender.Frame(context, id, kind, data, now, wDp, hDp);
    }

    /** يُستدعى من الحفظ (الويب) ومن المنبّهات والأذان. */
    static void refreshSoon(Context context) {
        updateAll(context);
    }

    private static PendingIntent refreshIntent(Context context) {
        Intent intent = new Intent(context, WidgetActionReceiver.class).setAction(ACTION_REFRESH);
        return PendingIntent.getBroadcast(context, 7101, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void schedule(Context context, long at) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        long now = System.currentTimeMillis();
        long when = Math.max(now + 1000, at);
        // غير موقظ: لا قيمة لتحديث شاشة مطفأة، ويصل فور إضاءتها.
        long window = when - now < 120_000L ? 1_000L : 15_000L;
        am.setWindow(AlarmManager.RTC, when, window, refreshIntent(context));
    }

    static void cancel(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(refreshIntent(context));
    }

    /** هل على الشاشة أي ويدجت لمنار؟ */
    static boolean anyPlaced(Context context) {
        return !instances(context).isEmpty();
    }

}
