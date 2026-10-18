package app.manar.islamic;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

/**
 * أساس كل مزوّدات ويدجتات منار: الرسم كله في {@link WidgetHub}، فيبقى كل
 * مزوّد سطراً يحدّد نوعه.
 */
public abstract class BaseWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        WidgetHub.updateAll(context);
    }

    /** تغيّر المقاس: يُعاد الرسم لما يتّسع فيه. */
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id,
                                          Bundle newOptions) {
        WidgetHub.updateOne(context, id);
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        WidgetPrefs.forget(context, ids);
    }

    @Override
    public void onDisabled(Context context) {
        if (!WidgetHub.anyPlaced(context)) WidgetHub.cancel(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        // منبّه الإصدار السابق كان يستهدف المزوّد نفسه.
        if (WidgetHub.ACTION_REFRESH.equals(intent.getAction())) WidgetHub.updateAll(context);
    }
}
