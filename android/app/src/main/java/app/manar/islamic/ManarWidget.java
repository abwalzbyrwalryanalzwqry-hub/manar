package app.manar.islamic;

import android.content.Context;

/**
 * «منار — الشامل»: الصلاة القادمة والعدّ، الهجري/الموسم والمدينة، آية اليوم،
 * واختصارات في المقاس الكبير. اسم الصنف ثابت منذ الإصدار الأول حتى تبقى
 * النسخ الموضوعة على الشاشات تعمل بعد التحديث.
 */
public class ManarWidget extends BaseWidget {

    /** @deprecated استعمل {@link WidgetHub#ACTION_REFRESH}. */
    @Deprecated
    public static final String ACTION_REFRESH = WidgetHub.ACTION_REFRESH;

    static void saveSnapshot(Context context, String json) {
        WidgetData.save(context, json);
    }

    static int updateAll(Context context) {
        return WidgetHub.updateAll(context);
    }
}
