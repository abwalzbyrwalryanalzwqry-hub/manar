package app.manar.islamic;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Manar — fired by the exact alarm at prayer / iqama time.
 *
 * The receiver does the minimum amount of work allowed in a broadcast:
 *
 * <ul>
 *   <li>يتحقّق أن الحدث لم يُطلق من قبل ({@link AdhanScheduler#markFired}) — فلا
 *       يتكرّر أذانٌ أو إقامة أو إشعار لنفس الصلاة مهما أُعيد ضبط المنبّهات.</li>
 *   <li>حدث {@code notice} (دخول الوقت بلا أذان، أو «اقتربت الإقامة») يُنشر نصّاً
 *       مباشرةً دون أي خدمة أو صوت.</li>
 *   <li>الأذان والإقامة يُسلَّمان إلى {@link AdhanService}، مالك الصوت الوحيد:
 *       التشغيل، والإشعار الجاري، وتركيز الصوت.</li>
 * </ul>
 */
public class AdhanAlarmReceiver extends BroadcastReceiver {

    public static final String ACTION_FIRE = "app.manar.islamic.action.ADHAN_FIRE";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        // منبّه التعبئة: يُقدّم نافذة الأحداث المضبوطة من الجدول المحفوظ فقط.
        if (AdhanScheduler.ACTION_TOP_UP.equals(intent.getAction())) {
            AdhanScheduler.topUp(context);
            return;
        }
        if (!ACTION_FIRE.equals(intent.getAction())) return;
        // كل إطلاق فرصة لتقديم النافذة أيضاً — لا ننتظر منبّه التعبئة.
        try {
            AdhanScheduler.topUp(context);
        } catch (Exception e) {
            Log.w("ManarSchedule", "top-up after fire failed", e);
        }

        ManarChannels.ensure(context);

        String key = intent.getStringExtra(AdhanService.EXTRA_KEY);
        String kind = intent.getStringExtra(AdhanService.EXTRA_KIND);
        String title = intent.getStringExtra(AdhanService.EXTRA_TITLE);
        String body = intent.getStringExtra(AdhanService.EXTRA_BODY);
        String channel = intent.getStringExtra(AdhanService.EXTRA_CHANNEL);
        int eventId = intent.getIntExtra(AdhanScheduler.EXTRA_EVENT_ID, 0);
        if (kind == null) kind = AdhanScheduler.KIND_ADHAN;

        if (!AdhanScheduler.markFired(context, key)) {
            Log.w("ManarSchedule", "duplicate fire ignored: " + key);
            return;
        }
        Log.i("ManarSchedule", "fire " + key + " kind=" + kind);

        if (AdhanScheduler.KIND_NOTICE.equals(kind)) {
            ManarNotices.post(context, eventId, channel, title, body, null, false);
            return;
        }

        try {
            AdhanService.play(
                    context,
                    intent.getStringExtra(AdhanService.EXTRA_SOUND),
                    title,
                    body,
                    kind,
                    key,
                    eventId,
                    intent.getBooleanExtra(AdhanService.EXTRA_NOTICE, false),
                    intent.getStringExtra(AdhanService.EXTRA_FOLLOW));
        } catch (Exception e) {
            // أندرويد ١٢+ يرفض بدء خدمة أمامية من الخلفية إن لم يكن المنبّه دقيقاً
            // ولم يُستثنَ التطبيق من تحسين البطارية — وهذا هو الوضع الافتراضي بعد
            // تثبيت جديد على أندرويد ١٤+. لا انهيار، ولا صمتٌ مبهم: إشعار يقول
            // لماذا لم يُسمع الأذان، بزرّ يفتح شاشة الإذن مباشرة.
            Log.e("ManarSchedule", "could not start playback for " + key, e);
            boolean blocked = !ManarPermissions.canStartPlaybackFromAlarm(context);
            AdhanScheduler.recordPlaybackFailure(context,
                    blocked ? ManarPermissions.REASON_BACKGROUND_START : ManarPermissions.REASON_OTHER);
            String channelKind = AdhanScheduler.KIND_IQAMA.equals(kind) ? "iqama" : "adhan";
            if (blocked) {
                ManarNotices.postPlaybackBlocked(context, eventId, channelKind, title, body);
            } else {
                ManarNotices.post(context, eventId, channelKind, title, body, null, false);
            }
        }
    }
}
