package app.manar.islamic;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

import java.util.List;

/**
 * Manar — bridge between the web layer and the native Adhan stack.
 *
 * The web app owns prayer-time computation and user settings; this plugin owns
 * alarms, playback and the OS-level permissions that make them reliable:
 *
 *   - {@code schedule}   — replace the whole Adhan/Iqama schedule
 *   - {@code cancelAll}  — drop every armed alarm
 *   - {@code stop}       — stop the currently playing Adhan
 *   - {@code preview}    — play a recording immediately (settings screen)
 *   - {@code status}     — exact-alarm + battery-optimisation state
 *   - {@code requestExactAlarmPermission} / {@code requestIgnoreBatteryOptimizations}
 */
@CapacitorPlugin(name = "ManarAdhan")
public class ManarAdhanPlugin extends Plugin {

    @PluginMethod
    public void schedule(PluginCall call) {
        JSONArray events = call.getArray("events");
        Context context = getContext();
        List<AdhanScheduler.Event> parsed = AdhanScheduler.parse(events);
        int armed = AdhanScheduler.replaceAll(context, parsed);

        JSObject result = new JSObject();
        result.put("scheduled", armed);
        result.put("exactAlarms", AdhanScheduler.canScheduleExact(context));
        call.resolve(result);
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        AdhanScheduler.cancelAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        AdhanService.stop(getContext());
        call.resolve();
    }

    @PluginMethod
    public void preview(PluginCall call) {
        String sound = call.getString("sound");
        if (sound == null || sound.trim().isEmpty()) {
            call.reject("sound is required");
            return;
        }
        AdhanService.play(
                getContext(),
                sound,
                call.getString("title", "معاينة الأذان"),
                call.getString("body", ""),
                "preview");
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        result.put("exactAlarms", AdhanScheduler.canScheduleExact(context));
        result.put("batteryUnrestricted", isIgnoringBatteryOptimizations(context));
        result.put("pending", AdhanScheduler.pendingCount(context));
        result.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(result);
    }

    /** Opens the system screen where the user grants exact alarms (Android 12+). */
    @PluginMethod
    public void requestExactAlarmPermission(PluginCall call) {
        Context context = getContext();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                || AdhanScheduler.canScheduleExact(context)) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                    .setData(Uri.parse("package:" + context.getPackageName()))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        } catch (Exception e) {
            openAppSettings(context);
        }
        JSObject result = new JSObject();
        result.put("granted", false);
        result.put("opened", true);
        call.resolve(result);
    }

    /**
     * Asks to be exempt from battery optimisation. Without this, Doze delays or
     * drops the Adhan alarm on many OEM builds (Xiaomi, Samsung, Huawei).
     */
    @SuppressLint("BatteryLife")
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        Context context = getContext();
        if (isIgnoringBatteryOptimizations(context)) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                    .setData(Uri.parse("package:" + context.getPackageName()))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        } catch (Exception e) {
            openAppSettings(context);
        }
        JSObject result = new JSObject();
        result.put("granted", false);
        result.put("opened", true);
        call.resolve(result);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Context context = getContext();
        try {
            Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, context.getPackageName())
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        } catch (Exception e) {
            openAppSettings(context);
        }
        call.resolve();
    }

    private static boolean isIgnoringBatteryOptimizations(Context context) {
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (pm == null) return false;
        return pm.isIgnoringBatteryOptimizations(context.getPackageName());
    }

    private static void openAppSettings(Context context) {
        try {
            context.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    .setData(Uri.parse("package:" + context.getPackageName()))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (Exception ignored) {
            // nothing else we can do; the caller already knows it was not granted
        }
    }
}
