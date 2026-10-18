package app.manar.islamic;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.os.Bundle;

/**
 * إعداد الويدجت من المُشغّل. عند الإضافة أول مرة يقبل فوراً بالإعدادات
 * الافتراضية (لا نقاطع المستخدم)، وعند «إعدادات الأداة» لاحقاً (أندرويد ١٢+)
 * يفتح صفحة الويدجتات في منار على هذه النسخة بعينها.
 */
public class WidgetConfigActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        int id = getIntent() == null ? AppWidgetManager.INVALID_APPWIDGET_ID
                : getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,
                        AppWidgetManager.INVALID_APPWIDGET_ID);
        Intent result = new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        setResult(RESULT_OK, result);
        if (id != AppWidgetManager.INVALID_APPWIDGET_ID && WidgetPrefs.wasShown(this, id)) {
            Intent open = new Intent(this, MainActivity.class)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    .putExtra(MainActivity.EXTRA_ROUTE, "/widget?id=" + id);
            startActivity(open);
        } else if (id != AppWidgetManager.INVALID_APPWIDGET_ID) {
            WidgetHub.updateOne(this, id);
        }
        finish();
    }
}
