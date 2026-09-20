package app.manar.islamic;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Manar — exact-alarm scheduler for Adhan and Iqama.
 *
 * The web layer computes prayer times locally (no network) and hands this class
 * a flat list of events. Each event becomes one exact alarm that survives Doze
 * ({@code setExactAndAllowWhileIdle}) and fires {@link AdhanAlarmReceiver},
 * which starts {@link AdhanService} to play the full recording.
 *
 * The list is persisted verbatim so {@link BootReceiver} can re-arm everything
 * after a reboot, an app update, or a timezone change — without needing the
 * WebView to be alive.
 */
public final class AdhanScheduler {

    private static final String PREFS = "manar_adhan_schedule";
    private static final String KEY_EVENTS = "events";

    /** Request-code range reserved for Manar alarms. */
    private static final int REQUEST_BASE = 41000;

    private AdhanScheduler() {}

    /** One scheduled Adhan / Iqama event. */
    public static final class Event {
        public final int id;
        public final long atMillis;
        public final String sound;
        public final String title;
        public final String body;
        public final String kind;

        Event(int id, long atMillis, String sound, String title, String body, String kind) {
            this.id = id;
            this.atMillis = atMillis;
            this.sound = sound;
            this.title = title;
            this.body = body;
            this.kind = kind;
        }

        static Event fromJson(JSONObject o) {
            return new Event(
                    o.optInt("id"),
                    o.optLong("at"),
                    o.optString("sound", ""),
                    o.optString("title", "منار"),
                    o.optString("body", ""),
                    o.optString("kind", "adhan"));
        }

        JSONObject toJson() throws JSONException {
            return new JSONObject()
                    .put("id", id)
                    .put("at", atMillis)
                    .put("sound", sound == null ? "" : sound)
                    .put("title", title)
                    .put("body", body)
                    .put("kind", kind);
        }
    }

    public static List<Event> parse(JSONArray array) {
        List<Event> events = new ArrayList<>();
        if (array == null) return events;
        for (int i = 0; i < array.length(); i++) {
            JSONObject o = array.optJSONObject(i);
            if (o != null) events.add(Event.fromJson(o));
        }
        return events;
    }

    /** Replaces the whole schedule: cancels what we armed before, then re-arms. */
    public static int replaceAll(Context context, List<Event> events) {
        cancelAll(context);

        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return 0;

        long now = System.currentTimeMillis();
        List<Event> armed = new ArrayList<>();

        for (Event e : events) {
            if (e.atMillis <= now) continue;
            PendingIntent pi = pendingIntentFor(context, e, PendingIntent.FLAG_UPDATE_CURRENT);
            if (pi == null) continue;
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                    // Without the exact-alarm permission the OS would reject the
                    // call outright; an inexact alarm still fires, just later.
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, e.atMillis, pi);
                } else {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, e.atMillis, pi);
                }
                armed.add(e);
            } catch (SecurityException ignored) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, e.atMillis, pi);
                armed.add(e);
            }
        }

        persist(context, armed);
        return armed.size();
    }

    public static void cancelAll(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        List<Event> stored = restore(context);
        if (am != null) {
            for (Event e : stored) {
                PendingIntent pi = pendingIntentFor(context, e, PendingIntent.FLAG_NO_CREATE);
                if (pi != null) {
                    am.cancel(pi);
                    pi.cancel();
                }
            }
        }
        prefs(context).edit().remove(KEY_EVENTS).apply();
    }

    /** Re-arms the persisted schedule — used after reboot / update / time change. */
    public static int rearm(Context context) {
        List<Event> stored = restore(context);
        if (stored.isEmpty()) return 0;
        return replaceAll(context, stored);
    }

    public static boolean canScheduleExact(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        return am != null && am.canScheduleExactAlarms();
    }

    public static int pendingCount(Context context) {
        long now = System.currentTimeMillis();
        int count = 0;
        for (Event e : restore(context)) if (e.atMillis > now) count++;
        return count;
    }

    private static PendingIntent pendingIntentFor(Context context, Event e, int extraFlags) {
        Intent intent = new Intent(context, AdhanAlarmReceiver.class)
                .setAction(AdhanAlarmReceiver.ACTION_FIRE)
                // A distinct data URI keeps every PendingIntent unique, since
                // extras alone are ignored when Android compares intents.
                .setData(android.net.Uri.parse("manar://adhan/" + e.id))
                .putExtra(AdhanService.EXTRA_SOUND, e.sound)
                .putExtra(AdhanService.EXTRA_TITLE, e.title)
                .putExtra(AdhanService.EXTRA_BODY, e.body)
                .putExtra(AdhanService.EXTRA_KIND, e.kind);

        return PendingIntent.getBroadcast(
                context, REQUEST_BASE + e.id, intent, extraFlags | PendingIntent.FLAG_IMMUTABLE);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static void persist(Context context, List<Event> events) {
        JSONArray array = new JSONArray();
        for (Event e : events) {
            try {
                array.put(e.toJson());
            } catch (JSONException ignored) {
                // skip the single malformed entry rather than losing the schedule
            }
        }
        prefs(context).edit().putString(KEY_EVENTS, array.toString()).apply();
    }

    private static List<Event> restore(Context context) {
        String raw = prefs(context).getString(KEY_EVENTS, null);
        if (raw == null) return new ArrayList<>();
        try {
            return parse(new JSONArray(raw));
        } catch (JSONException e) {
            return new ArrayList<>();
        }
    }
}
