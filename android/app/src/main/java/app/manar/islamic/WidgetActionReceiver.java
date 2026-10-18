package app.manar.islamic;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * إجراءات الويدجتات ومنبّه تحديثها — غير مُصدَّر، فلا يحرّكه تطبيق آخر.
 */
public class WidgetActionReceiver extends BroadcastReceiver {

    static final String EXTRA_ID = "manar_widget_id";
    static final String EXTRA_ARG = "manar_widget_arg";

    static final String ACTION_TASBIH = "app.manar.islamic.WIDGET_TASBIH";
    static final String ACTION_ZIKR_NEXT = "app.manar.islamic.WIDGET_ZIKR_NEXT";
    static final String ACTION_PRAYED = "app.manar.islamic.WIDGET_PRAYED";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (action == null) return;
        int id = intent.getIntExtra(EXTRA_ID, 0);
        String arg = intent.getStringExtra(EXTRA_ARG);
        switch (action) {
            case ACTION_TASBIH:
                if (arg != null && !arg.isEmpty()) WidgetPrefs.addTap(context, arg);
                WidgetHub.updateAll(context);
                break;
            case ACTION_ZIKR_NEXT:
                if (arg != null) {
                    int i = WidgetPrefs.zikrIndex(context, id, arg);
                    WidgetPrefs.setZikrIndex(context, id, arg, i + 1);
                }
                WidgetHub.updateOne(context, id);
                break;
            case ACTION_PRAYED:
                if (arg != null && arg.contains("|")) {
                    String[] parts = arg.split("\\|", 2);
                    PrayedQueue.add(context, parts[0], parts[1]);
                    if (ManarActionReceiver.prayedListener != null) {
                        ManarActionReceiver.prayedListener.onPrayed(parts[0], parts[1]);
                    }
                }
                WidgetHub.updateAll(context);
                break;
            default:
                WidgetHub.updateAll(context);
        }
    }
}
