package app.manar.islamic;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Manar — re-arms the saved Adhan schedule.
 *
 * Android drops every pending alarm on reboot, on app update, and treats
 * timezone / clock changes as invalidating absolute times. This receiver
 * restores the persisted schedule immediately, so the user does not have to open
 * the app for the next Adhan to fire. The app additionally re-syncs the full
 * seven-day schedule on its next launch.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (action == null) return;

        switch (action) {
            case Intent.ACTION_BOOT_COMPLETED:
            case "android.intent.action.LOCKED_BOOT_COMPLETED":
            case Intent.ACTION_MY_PACKAGE_REPLACED:
            case Intent.ACTION_TIMEZONE_CHANGED:
            case Intent.ACTION_TIME_CHANGED:
            case "android.intent.action.QUICKBOOT_POWERON":
            case "com.htc.intent.action.QUICKBOOT_POWERON":
            // Android 12+: المستخدم منح «المنبّهات والتذكيرات» أو سحبه. المنبّهات
            // المضبوطة قبل المنح كانت غير دقيقة، فنعيد ضبطها دقيقةً الآن دون
            // انتظار فتح التطبيق.
            case "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED":
                ManarChannels.ensure(context);
                android.util.Log.i("ManarSchedule", "re-arm after " + action);
                AdhanScheduler.rearm(context);
                // وسكينة معها: فترةٌ محفوظة بلا منبّه هي ميزة مُعطّلة في الحقيقة.
                SakinahLog.add(
                        context,
                        Intent.ACTION_TIMEZONE_CHANGED.equals(action)
                                        || Intent.ACTION_TIME_CHANGED.equals(action)
                                ? SakinahLog.TIMEZONE_CHANGED
                                : SakinahLog.DEVICE_RESTARTED,
                        "",
                        action);
                SakinahScheduler.rearm(context);
                // والويدجت: منبّه تحديثه سقط مع إعادة التشغيل، والساعة ربما تغيّرت.
                ManarWidget.updateAll(context);
                break;
            default:
                break;
        }
    }
}
