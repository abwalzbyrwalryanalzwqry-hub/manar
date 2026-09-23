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
 *
 * ومعها «سكينة»: الويب يحسب فترات الهدوء من مواقيت الصلاة ويسلّمها هنا،
 * وهذه الطبقة تملك المنبّهات ووضع عدم الإزعاج والسجل، وتتحكّم في صوت منار
 * الجاري (كتماً أو إيقافاً).
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

    /* ------------------------ صوت منار ------------------------ */

    /** كتم صوت منار الجاري مع إبقاء تنبيه الصلاة والأذان القادم. */
    @PluginMethod
    public void muteAudio(PluginCall call) {
        AdhanService.mute(getContext());
        call.resolve();
    }

    /** حالة مدير الصوت المركزية — مصدرٌ واحد لا تخمين في الواجهة. */
    @PluginMethod
    public void audioState(PluginCall call) {
        JSObject result = new JSObject();
        result.put("state", AdhanService.currentState());
        result.put("kind", AdhanService.currentKind());
        result.put("title", AdhanService.currentTitle());
        call.resolve(result);
    }

    /* ------------------------- سكينة ------------------------- */

    /** يستبدل جدول فترات الهدوء كلّه بما حسبته طبقة الويب. */
    @PluginMethod
    public void sakinahSchedule(PluginCall call) {
        Context context = getContext();
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        SakinahStore.setEnabled(context, enabled);

        JSObject result = new JSObject();
        if (!enabled) {
            SakinahScheduler.cancelAll(context);
            SakinahStore.saveWindows(context, new java.util.ArrayList<>());
            if (SakinahStore.activeWindow(context) >= 0) SakinahManager.end(context, "disabled");
            SakinahLog.add(context, SakinahLog.SCHEDULE_UPDATED, "", "disabled");
            result.put("armed", 0);
            result.put("dndAccess", SakinahManager.hasPolicyAccess(context));
            call.resolve(result);
            return;
        }

        List<SakinahStore.Window> windows = SakinahStore.parse(call.getArray("windows"));
        int armed = SakinahScheduler.replaceAll(context, windows);
        SakinahLog.add(context, SakinahLog.SCHEDULE_CREATED, "", "windows=" + windows.size());

        result.put("armed", armed);
        result.put("dndAccess", SakinahManager.hasPolicyAccess(context));
        result.put("exactAlarms", AdhanScheduler.canScheduleExact(context));
        call.resolve(result);
    }

    @PluginMethod
    public void sakinahCancelAll(PluginCall call) {
        Context context = getContext();
        SakinahScheduler.cancelAll(context);
        SakinahStore.setEnabled(context, false);
        if (SakinahStore.activeWindow(context) >= 0) SakinahManager.end(context, "disabled");
        call.resolve();
    }

    /** «إيقاف الآن»: يُنهي الفترة الجارية وحدها ولا يُعطّل الميزة. */
    @PluginMethod
    public void sakinahStopNow(PluginCall call) {
        SakinahManager.stopNow(getContext());
        call.resolve();
    }

    /** تخطّي فترة بعينها قبل أن تبدأ. */
    @PluginMethod
    public void sakinahSkip(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) {
            call.reject("id is required");
            return;
        }
        SakinahManager.skip(getContext(), id);
        call.resolve();
    }

    @PluginMethod
    public void sakinahStatus(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        result.put("enabled", SakinahStore.isEnabled(context));
        result.put("dndAccess", SakinahManager.hasPolicyAccess(context));
        result.put("exactAlarms", AdhanScheduler.canScheduleExact(context));
        result.put("batteryUnrestricted", isIgnoringBatteryOptimizations(context));
        result.put("notificationsAllowed", areNotificationsEnabled(context));
        result.put("pending", SakinahScheduler.pendingCount(context));
        result.put("currentFilter", SakinahManager.currentFilter(context));
        result.put("sdk", Build.VERSION.SDK_INT);

        // نُغفل المفتاح حين لا توجد فترة بدل تمرير قيمة فارغة تحتاج تفسيراً
        SakinahStore.Window active = SakinahStore.currentWindow(context);
        if (active != null && SakinahStore.activeWindow(context) == active.id) {
            result.put("active", windowJson(active));
        }
        SakinahStore.Window next = SakinahStore.nextWindow(context);
        if (next != null) result.put("next", windowJson(next));
        call.resolve(result);
    }

    /** السجل الداخلي — الويب يُحوّله إلى جملة عربية تُقرأ. */
    @PluginMethod
    public void sakinahLog(PluginCall call) {
        JSObject result = new JSObject();
        result.put("events", SakinahLog.read(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void sakinahClearSkips(PluginCall call) {
        SakinahStore.clearSkipped(getContext());
        call.resolve();
    }

    /** يفتح شاشة النظام لمنح منار التحكّم في وضع عدم الإزعاج. */
    @PluginMethod
    public void sakinahRequestPolicyAccess(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        if (SakinahManager.hasPolicyAccess(context)) {
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        boolean opened = SakinahManager.openPolicyAccessSettings(context);
        result.put("granted", false);
        result.put("opened", opened);
        call.resolve(result);
    }

    private static JSObject windowJson(SakinahStore.Window w) {
        JSObject o = new JSObject();
        o.put("id", w.id);
        o.put("start", w.startMillis);
        o.put("end", w.endMillis);
        o.put("prayer", w.prayer);
        o.put("label", w.label);
        o.put("filter", w.filter);
        o.put("muteAdhan", w.muteAdhan);
        return o;
    }

    private static boolean areNotificationsEnabled(Context context) {
        try {
            return androidx.core.app.NotificationManagerCompat.from(context)
                    .areNotificationsEnabled();
        } catch (Exception e) {
            return true;
        }
    }

    @PluginMethod
    public void preview(PluginCall call) {
        String sound = call.getString("sound");
        if (sound == null || sound.trim().isEmpty()) {
            call.reject("sound is required");
            return;
        }
        Double volume = call.getDouble("volume");
        AdhanService.play(
                getContext(),
                sound,
                call.getString("title", "معاينة الأذان"),
                call.getString("body", ""),
                "preview",
                volume == null ? 1f : (float) Math.max(0d, Math.min(1d, volume)),
                call.getString("usage", "alarm"));
        call.resolve();
    }

    /** يحفظ مستويات «مستوى الأصوات» لتقرأها خدمة الأذان لحظة التشغيل. */
    @PluginMethod
    public void setVolumes(PluginCall call) {
        ManarVolumes.save(
                getContext(),
                call.getDouble("master", 1d),
                call.getDouble("adhan", 1d),
                call.getDouble("iqama", 1d),
                call.getDouble("reminder", 1d));
        call.resolve();
    }

    /** لقطة ويدجت الشاشة الرئيسية من الويب ({@code src/lib/widget-snapshot.ts}). */
    @PluginMethod
    public void updateWidget(PluginCall call) {
        Context context = getContext();
        ManarWidget.saveSnapshot(context, call.getString("snapshot", ""));
        JSObject result = new JSObject();
        result.put("widgets", ManarWidget.updateAll(context));
        call.resolve(result);
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

    /**
     * حالة الصوت تُبَلَّغ إلى الواجهة حين تكون حيّة، فيظهر «إيقاف الصوت» داخل
     * التطبيق بلا استطلاعٍ متكرّر ولا مؤقّت يعمل بلا حاجة.
     */
    @Override
    public void load() {
        AdhanService.setStateListener((state, kind, title) -> {
            JSObject data = new JSObject();
            data.put("state", state);
            data.put("kind", kind);
            data.put("title", title);
            notifyListeners("manarAudioState", data);
        });
    }

    @Override
    protected void handleOnDestroy() {
        AdhanService.setStateListener(null);
        super.handleOnDestroy();
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
