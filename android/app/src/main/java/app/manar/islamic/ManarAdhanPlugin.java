package app.manar.islamic;

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
                call.getDouble("reminder", 1d),
                Boolean.TRUE.equals(call.getBoolean("raiseAlarm", false)));
        call.resolve();
    }

    /**
     * صوت «المنبّه» في الجوال — الأذان والإقامة يُشغَّلان عليه، فمستوى منار
     * نسبةٌ منه. يعيد {@code level}/{@code max} و{@code percent}.
     */
    @PluginMethod
    public void alarmVolume(PluginCall call) {
        android.media.AudioManager am =
                (android.media.AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        JSObject result = new JSObject();
        int level = 0;
        int max = 0;
        if (am != null) {
            level = am.getStreamVolume(android.media.AudioManager.STREAM_ALARM);
            max = am.getStreamMaxVolume(android.media.AudioManager.STREAM_ALARM);
        }
        result.put("level", level);
        result.put("max", max);
        result.put("percent", max > 0 ? Math.round(level * 100f / max) : 0);
        call.resolve(result);
    }

    /** يضبط صوت المنبّه في الجوال (نسبة ٠–١)، مع شريط النظام ليرى المستخدم التغيير. */
    @PluginMethod
    public void setAlarmVolume(PluginCall call) {
        android.media.AudioManager am =
                (android.media.AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        JSObject result = new JSObject();
        if (am == null) {
            result.put("ok", false);
            call.resolve(result);
            return;
        }
        double fraction = Math.max(0d, Math.min(1d, call.getDouble("fraction", 1d)));
        int max = am.getStreamMaxVolume(android.media.AudioManager.STREAM_ALARM);
        try {
            am.setStreamVolume(
                    android.media.AudioManager.STREAM_ALARM,
                    (int) Math.round(max * fraction),
                    android.media.AudioManager.FLAG_SHOW_UI);
            result.put("ok", true);
        } catch (SecurityException e) {
            // وضع عدم الإزعاج قد يمنع تغيير الصوت من التطبيقات.
            result.put("ok", false);
        }
        int level = am.getStreamVolume(android.media.AudioManager.STREAM_ALARM);
        result.put("percent", max > 0 ? Math.round(level * 100f / max) : 0);
        call.resolve(result);
    }

    /** حالة الويدجت: عدد النسخ على الشاشة الرئيسية، وهل يدعم المُشغّل الإضافة المباشرة. */
    @PluginMethod
    public void widgetStatus(PluginCall call) {
        Context context = getContext();
        android.appwidget.AppWidgetManager manager =
                android.appwidget.AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(
                new android.content.ComponentName(context, ManarWidget.class));
        JSObject result = new JSObject();
        result.put("placed", ids == null ? 0 : ids.length);
        result.put("pinSupported",
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                        && manager.isRequestPinAppWidgetSupported());
        call.resolve(result);
    }

    /** يطلب من المُشغّل إضافة ويدجت منار مباشرة (أندرويد ٨+ ومُشغّل يدعم ذلك). */
    @PluginMethod
    public void pinWidget(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        boolean requested = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            android.appwidget.AppWidgetManager manager =
                    android.appwidget.AppWidgetManager.getInstance(context);
            if (manager.isRequestPinAppWidgetSupported()) {
                try {
                    requested = manager.requestPinAppWidget(
                            new android.content.ComponentName(context, ManarWidget.class), null, null);
                } catch (Exception ignored) {
                    requested = false;
                }
            }
        }
        result.put("requested", requested);
        call.resolve(result);
    }

    /**
     * يفتح رابطاً خارجياً (اتصال، بريد، واتساب، تلجرام، متصفح) بنيّة النظام.
     * يجرّب الروابط بالترتيب ويعيد {@code opened=false} إن لم يوجد تطبيق
     * يفتح أيّاً منها — فتعرض الواجهة بديلاً (نسخ) بدل الفشل الصامت.
     */
    @PluginMethod
    public void openExternal(PluginCall call) {
        Context context = getContext();
        JSONArray urls = call.getArray("urls");
        JSObject result = new JSObject();
        result.put("opened", false);
        if (urls != null) {
            for (int i = 0; i < urls.length(); i++) {
                String url = urls.optString(i, "");
                if (url.isEmpty()) continue;
                Uri uri = Uri.parse(url);
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();
                String action = "tel".equals(scheme)
                        ? Intent.ACTION_DIAL
                        : "mailto".equals(scheme) ? Intent.ACTION_SENDTO : Intent.ACTION_VIEW;
                Intent intent = new Intent(action, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    context.startActivity(intent);
                    result.put("opened", true);
                    result.put("url", url);
                    break;
                } catch (android.content.ActivityNotFoundException e) {
                    // لا تطبيق لهذا الرابط — نجرّب التالي.
                } catch (Exception e) {
                    // رفض النظام — نجرّب التالي.
                }
            }
        }
        call.resolve(result);
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
        result.put("pendingAdhan", AdhanScheduler.pendingCount(context, AdhanScheduler.KIND_ADHAN));
        result.put("pendingIqama", AdhanScheduler.pendingCount(context, AdhanScheduler.KIND_IQAMA));
        result.put("pendingNotice", AdhanScheduler.pendingCount(context, AdhanScheduler.KIND_NOTICE));
        result.put("lastScheduledAt", AdhanScheduler.lastScheduledAt(context));
        android.app.NotificationManager nm =
                context.getSystemService(android.app.NotificationManager.class);
        result.put("notificationsAllowed", nm != null && nm.areNotificationsEnabled());
        AdhanScheduler.Event next = AdhanScheduler.next(context);
        if (next != null) {
            result.put("nextKey", next.key);
            result.put("nextAt", next.atMillis);
        }
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
     * Opens the system battery screen so the user can set Manar to «Unrestricted».
     * Without this, Doze delays or drops the Adhan alarm on many OEM builds
     * (Xiaomi, Samsung, Huawei).
     *
     * We deliberately do NOT use ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS: it
     * needs the REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission, which Google Play
     * restricts. Android 12+ keeps the «Unrestricted» option in App info → Battery;
     * older versions list it under «Battery optimisation».
     */
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        Context context = getContext();
        if (isIgnoringBatteryOptimizations(context)) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        boolean opened = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            opened = startSafely(context, new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    .setData(Uri.parse("package:" + context.getPackageName())));
        }
        if (!opened) {
            opened = startSafely(context, new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        }
        if (!opened) openAppSettings(context);
        JSObject result = new JSObject();
        result.put("granted", false);
        result.put("opened", true);
        call.resolve(result);
    }

    private static boolean startSafely(Context context, Intent intent) {
        try {
            context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            return true;
        } catch (Exception e) {
            return false;
        }
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
