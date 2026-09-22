package app.manar.islamic;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * منار — مُستقبل منبّهات «سكينة».
 *
 * <p>يُفعّل الهدوء عند بداية الفترة ويرفعه عند نهايتها، ويستجيب لزرّ «إيقاف
 * الآن» في الإشعار. العمل هنا قصيرٌ جداً كما تقتضي قيود البثّ: تغييرُ نمط
 * المنع وكتابةُ سجلّ، لا أكثر.
 */
public class SakinahReceiver extends BroadcastReceiver {

    public static final String ACTION_START = "app.manar.islamic.action.SAKINAH_START";
    public static final String ACTION_END = "app.manar.islamic.action.SAKINAH_END";
    public static final String ACTION_STOP_NOW = "app.manar.islamic.action.SAKINAH_STOP_NOW";

    public static final String EXTRA_ID = "windowId";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (action == null) return;

        ManarChannels.ensure(context);
        int id = intent.getIntExtra(EXTRA_ID, -1);

        switch (action) {
            case ACTION_START: {
                if (!SakinahStore.isEnabled(context)) return;
                if (SakinahStore.isSkipped(context, id)) {
                    SakinahLog.add(context, SakinahLog.QUIET_SKIPPED, "", "id=" + id);
                    return;
                }
                SakinahStore.Window w = SakinahStore.windowById(context, id);
                if (w == null) return;
                // فترةٌ مضى وقت نهايتها قبل أن يصلنا منبّهها (نوم عميق): لا نُسكت
                // الهاتف بعد انقضاء الحاجة.
                if (System.currentTimeMillis() >= w.endMillis) return;
                SakinahManager.start(context, w);
                break;
            }
            case ACTION_END: {
                // نُنهي فقط إن كانت هذه هي الفترة الجارية فعلاً؛ فلو اندمجت
                // فتراتٌ متتالية لم نرفع الهدوء في وسط فترةٍ أخرى.
                int active = SakinahStore.activeWindow(context);
                if (active >= 0 && active != id) return;
                SakinahManager.end(context, "scheduled");
                break;
            }
            case ACTION_STOP_NOW:
                SakinahManager.stopNow(context);
                break;
            default:
                break;
        }
    }
}
