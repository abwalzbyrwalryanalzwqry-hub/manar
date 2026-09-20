package app.manar.islamic;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Manar — fired by the exact alarm at prayer / iqama time.
 *
 * The receiver does the minimum amount of work allowed in a broadcast: it hands
 * the event straight to {@link AdhanService}, which owns playback, the ongoing
 * notification and audio focus. It also re-arms the persisted schedule so the
 * next seven days stay armed even if the app is never opened again.
 */
public class AdhanAlarmReceiver extends BroadcastReceiver {

    public static final String ACTION_FIRE = "app.manar.islamic.action.ADHAN_FIRE";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_FIRE.equals(intent.getAction())) return;

        ManarChannels.ensure(context);

        AdhanService.play(
                context,
                intent.getStringExtra(AdhanService.EXTRA_SOUND),
                intent.getStringExtra(AdhanService.EXTRA_TITLE),
                intent.getStringExtra(AdhanService.EXTRA_BODY),
                intent.getStringExtra(AdhanService.EXTRA_KIND));
    }
}
