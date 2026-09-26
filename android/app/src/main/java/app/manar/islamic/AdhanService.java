package app.manar.islamic;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.media.MediaPlayer;
import android.media.audiofx.LoudnessEnhancer;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.SystemClock;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.media.VolumeProviderCompat;

import android.app.Service;

/**
 * Manar — Adhan / Iqama playback as a foreground service.
 *
 * A scheduled notification sound is capped by Android and gets cut after a few
 * seconds, which is useless for a 3-4 minute Adhan. This service instead:
 *
 *   - runs in the foreground with type {@code mediaPlayback} so the OS keeps it
 *     alive while the app is closed or the screen is off,
 *   - requests audio focus (and pauses other media politely),
 *   - exposes a {@link MediaSessionCompat} so the lock screen shows controls,
 *   - shows an ongoing notification with «إيقاف الصوت» and «كتم» actions,
 *   - holds a partial wake lock only for the duration of the recording,
 *   - stops itself as soon as playback finishes, focus is lost permanently, or
 *     the user taps stop.
 *
 * <p>وهذه الخدمة هي «مدير صوت منار»: مصدرٌ واحد لحالة الصوت
 * (IDLE / PLAYING_AZAN / PLAYING_IQAMA / MUTED / STOPPED)، فلا يُشغّل أذانٌ فوق
 * أذان ولا إقامةٌ فوق أذان. وأيّ تشغيلٍ جديد يُوقف ما قبله أولاً بدل أن يُنشئ
 * مشغّلاً ثانياً يُسرّب الصوت الأول.
 *
 * <p>والكتم مفصولٌ عن الإيقاف نيّةً وأثراً: الكتم يُسكت صوت منار فوراً ويُبقي
 * تنبيه الصلاة قائماً، والإيقاف يُنهي كل شيء. ولا يُحفظ الكتم في أي حالٍ دائم،
 * فلا يتسرّب إلى الصلاة التالية: كل تشغيلٍ يبدأ من جديد.
 */
public class AdhanService extends Service
        implements MediaPlayer.OnCompletionListener, MediaPlayer.OnErrorListener {

    public static final String ACTION_PLAY = "app.manar.islamic.action.PLAY";
    public static final String ACTION_STOP = "app.manar.islamic.action.STOP";
    /** كتم صوت منار الجاري مع إبقاء تنبيه الصلاة. */
    public static final String ACTION_MUTE = "app.manar.islamic.action.MUTE";

    public static final String EXTRA_SOUND = "sound";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_BODY = "body";
    public static final String EXTRA_KIND = "kind";
    /** مستوى صوت صريح (٠..١) للمعاينة؛ غيابه يعني مستوى المستخدم المحفوظ. */
    public static final String EXTRA_VOLUME = "volume";
    /** "notification" لمعاينة نغمات التنبيه على مسار الإشعارات لا المنبّه. */
    public static final String EXTRA_USAGE = "usage";
    /** مفتاح الحدث الفريد (fajr_iqamah_2026_09_23) — للسجل ومنع التكرار. */
    public static final String EXTRA_KEY = "key";
    /** قناة إشعار حدث notice. */
    public static final String EXTRA_CHANNEL = "channel";
    /** بعد انتهاء الأذان يبقى إشعار دخول الوقت. */
    public static final String EXTRA_NOTICE = "notice";
    static final String EXTRA_EVENT_ID = "event_id";

    private static final int NOTIFICATION_ID = 40990;
    /** تنبيه الصلاة الباقي بعد الكتم — منفصلٌ عن إشعار التحكم. */
    private static final int NOTICE_ID = 40995;

    /* --------------------- حالة الصوت المركزية --------------------- */

    public static final String STATE_IDLE = "IDLE";
    public static final String STATE_PLAYING_AZAN = "PLAYING_AZAN";
    public static final String STATE_PLAYING_IQAMA = "PLAYING_IQAMA";
    public static final String STATE_MUTED = "MUTED";
    public static final String STATE_STOPPED = "STOPPED";

    /** من يُبلَّغ بتغيّر الحالة (الإضافة، حين تكون الواجهة حيّة). */
    public interface StateListener {
        void onAudioState(String state, String kind, String title);
    }

    private static volatile String state = STATE_IDLE;
    private static volatile String stateKind = "";
    private static volatile String stateTitle = "";
    @Nullable private static volatile StateListener stateListener;

    public static String currentState() {
        return state;
    }

    public static String currentKind() {
        return stateKind;
    }

    public static String currentTitle() {
        return stateTitle;
    }

    public static void setStateListener(@Nullable StateListener listener) {
        stateListener = listener;
    }

    private static void publish(String next, String kind, String title) {
        state = next;
        stateKind = kind == null ? "" : kind;
        stateTitle = title == null ? "" : title;
        StateListener l = stateListener;
        if (l != null) {
            try {
                l.onAudioState(state, stateKind, stateTitle);
            } catch (Exception ignored) {
                // الواجهة قد تكون في طريقها إلى الإغلاق
            }
        }
    }

    @Nullable private MediaPlayer player;
    /** تضخيم التسجيلات الضعيفة ({@link ManarLoudness}) — يُحرَّر مع المشغّل. */
    @Nullable private LoudnessEnhancer enhancer;
    /** صوت منبّه الجهاز قبل رفعه مؤقتاً (−١ = لم يُرفع)، ليُعاد بعد الأذان. */
    private int restoreAlarmVolume = -1;

    /* ------------- الإيقاف السريع بأزرار الجهاز (انظر startQuickStop) ------------- */

    /** مهلة بعد بدء الصوت تُهمَل فيها أحداث الشاشة والصوت التي يُسبّبها بدء التشغيل نفسه. */
    private static final long QUICK_STOP_GRACE_MS = 1200L;
    @Nullable private BroadcastReceiver quickStopReceiver;
    /** يمنع انطفاء الشاشة بالمهلة أثناء الصوت، فيصير انطفاؤها ضغطةَ زرّ التشغيل حتماً. */
    @Nullable private PowerManager.WakeLock screenLock;
    private long playStartedAt;
    /**
     * مسار صامت على قناة الوسائط طوال الصوت. أندرويد لا يوجّه أزرار الصوت والشاشة
     * مطفأة إلى أي جلسة إلا إن كانت قناة الوسائط نشطة (والأذان على قناة المنبّه)،
     * فكان زرّ الصوت يُهمَل والشاشة مطفأة. أصفار خالصة: لا يُسمع شيء.
     */
    @Nullable private AudioTrack keyBridge;
    @Nullable private MediaSessionCompat session;
    @Nullable private AudioFocusRequest focusRequest;
    @Nullable private PowerManager.WakeLock wakeLock;
    @Nullable private AudioManager audioManager;

    /**
     * آخر طلب تشغيل استلمته الخدمة.
     *
     * <p>معاينة نغمة ترسل «إيقاف» ثم «تشغيل» متتاليين. الإيقاف كان يستدعي
     * {@code stopSelf()} بلا رقم، فيُنزل النظام الخدمة بينما طلب التشغيل الذي
     * جاء عبر {@code startForegroundService} ما زال في الطابور ولم يبلغ
     * {@code startForeground} — وهذا ينهي التطبيق كله بـ
     * «Context.startForegroundService() did not then call Service.startForeground()».
     * الإيقاف برقم الطلب لا يُنزل الخدمة إن كان بعده طلبٌ لم يُعالَج بعد.
     */
    private int lastStartId = 0;

    private String currentNoticeTitle = "منار";
    private String currentNoticeBody = "";
    private String currentNoticeKind = "adhan";
    private String currentKey = "";
    private int currentEventId = 0;
    private boolean currentWantsNotice = false;

    private final AudioManager.OnAudioFocusChangeListener focusListener = change -> {
        if (change == AudioManager.AUDIOFOCUS_LOSS) {
            stopEverything();
        } else if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
            if (player != null && player.isPlaying()) player.pause();
        } else if (change == AudioManager.AUDIOFOCUS_GAIN) {
            if (player != null && !player.isPlaying()) player.start();
        }
    };

    /** Starts playback of a bundled recording from {@code res/raw}. */
    public static void play(Context context, String sound, String title, String body, String kind) {
        play(context, sound, title, body, kind, -1f, null);
    }

    /** تشغيل حدثٍ مُجدوَل بمفتاحه — من {@link AdhanAlarmReceiver}. */
    public static void play(
            Context context,
            String sound,
            String title,
            String body,
            String kind,
            String key,
            int eventId,
            boolean notice) {
        Intent intent = new Intent(context, AdhanService.class)
                .setAction(ACTION_PLAY)
                .putExtra(EXTRA_SOUND, sound)
                .putExtra(EXTRA_TITLE, title)
                .putExtra(EXTRA_BODY, body)
                .putExtra(EXTRA_KIND, kind)
                .putExtra(EXTRA_VOLUME, -1f)
                .putExtra(EXTRA_KEY, key)
                .putExtra(EXTRA_EVENT_ID, eventId)
                .putExtra(EXTRA_NOTICE, notice);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    /** مثل {@link #play} مع مستوى صوت صريح ومسار تشغيل (للمعاينة). */
    public static void play(
            Context context,
            String sound,
            String title,
            String body,
            String kind,
            float volume,
            @Nullable String usage) {
        Intent intent = new Intent(context, AdhanService.class)
                .setAction(ACTION_PLAY)
                .putExtra(EXTRA_SOUND, sound)
                .putExtra(EXTRA_TITLE, title)
                .putExtra(EXTRA_BODY, body)
                .putExtra(EXTRA_KIND, kind)
                .putExtra(EXTRA_VOLUME, volume)
                .putExtra(EXTRA_USAGE, usage);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stop(Context context) {
        context.startService(new Intent(context, AdhanService.class).setAction(ACTION_STOP));
    }

    /** كتم صوت منار الجاري فوراً مع إبقاء التنبيه. */
    public static void mute(Context context) {
        context.startService(new Intent(context, AdhanService.class).setAction(ACTION_MUTE));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        ManarChannels.ensure(this);
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        session = new MediaSessionCompat(this, "manar-adhan");
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onStop() { stopEverything(); }
            @Override public void onPause() { muteOnly("media-pause"); }
        });
        // أزرار الصوت أثناء تشغيل الأذان: التصرّف المتوقّع أن تُسكت الأذان، لا
        // أن تُنزل صوت الهاتف كلّه. ونمرّرها عبر الجلسة — وهي الآلة الرسمية —
        // ولا نعترض أزراراً أخرى ولا زرّ التشغيل.
        //
        // منذ أندرويد ١٣ (واجهة ٣٣) لا يوجّه النظام أزرار الصوت إلى جلسة «بعيدة»
        // ما لم يكن لها مسار توجيه (MediaRouter2) — يظهر ذلك في السجل:
        // «No routing session for app.manar.islamic». فالجلسة البعيدة تُهمَل،
        // والشاشة مطفأة لا يصل الزرّ إلى أيّ جهة. لذلك نجعلها هناك جلسةً محلية
        // على قناة الوسائط: تصير الجلسة الافتراضية للصوت، فيغيّر الزرّ صوت
        // الوسائط درجةً، فيلتقطه onQuickStopEvent فيُسكت الأذان ويُعيد الدرجة.
        if (Build.VERSION.SDK_INT >= 33) {
            session.setPlaybackToLocal(AudioManager.STREAM_MUSIC);
        } else {
            try {
                session.setPlaybackToRemote(new VolumeProviderCompat(
                        VolumeProviderCompat.VOLUME_CONTROL_RELATIVE, 100, 100) {
                    @Override
                    public void onAdjustVolume(int direction) {
                        if (direction != 0) muteOnly("volume-key");
                    }

                    @Override
                    public void onSetVolumeTo(int volume) {
                        if (volume < 100) muteOnly("volume-key");
                    }
                });
            } catch (Exception ignored) {
                // لو رفضت المنصّة التحكّم البعيد، يبقى زرّ الإشعار وشاشة القفل
            }
        }
        session.setActive(true);
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        lastStartId = startId;
        String action = intent != null ? intent.getAction() : null;

        if (ACTION_STOP.equals(action)) {
            stopEverything();
            return START_NOT_STICKY;
        }

        if (ACTION_MUTE.equals(action)) {
            muteOnly("notification");
            return START_NOT_STICKY;
        }

        String sound = intent != null ? intent.getStringExtra(EXTRA_SOUND) : null;
        String title = intent != null ? intent.getStringExtra(EXTRA_TITLE) : null;
        String body = intent != null ? intent.getStringExtra(EXTRA_BODY) : null;
        String kind = intent != null ? intent.getStringExtra(EXTRA_KIND) : "adhan";

        if (title == null) title = "منار";
        if (body == null) body = "";
        if (kind == null) kind = "adhan";
        float requested = intent != null ? intent.getFloatExtra(EXTRA_VOLUME, -1f) : -1f;
        float volume = requested >= 0f ? Math.min(1f, requested) : ManarVolumes.forKind(this, kind);
        boolean notificationUsage =
                intent != null && "notification".equals(intent.getStringExtra(EXTRA_USAGE));

        final String previousKey = currentKey;
        final boolean previousPlaying = player != null;

        currentNoticeTitle = title;
        currentNoticeBody = body;
        currentNoticeKind = kind;
        currentKey = intent != null && intent.getStringExtra(EXTRA_KEY) != null
                ? intent.getStringExtra(EXTRA_KEY) : "";
        currentEventId = intent != null ? intent.getIntExtra(EXTRA_EVENT_ID, 0) : 0;
        currentWantsNotice = intent != null && intent.getBooleanExtra(EXTRA_NOTICE, false);

        // The notification must be posted before anything else can fail, or
        // Android kills the service for starting foreground too late.
        startForegroundCompat(buildNotification(title, body, kind));

        // صوتٌ فوق صوت: أي تشغيلٍ جديد يُوقف السابق أولاً. وقبل هذا الإصلاح كان
        // المشغّل القديم يُستبدل مرجعُه فيبقى يعمل بلا سبيلٍ لإيقافه.
        releasePlayer();
        if (previousPlaying) {
            android.util.Log.i("ManarAudio", "stopped previous key=" + previousKey
                    + " before key=" + currentKey);
        }

        // سكينة: إن كانت فترة الهدوء جارية والمستخدم اختار كتم الأذان أيضاً،
        // فلا نُشغّل الصوت — ونُبقي التنبيه المكتوب وحده.
        SakinahStore.Window quiet = SakinahStore.currentWindow(this);
        // «صمت كامل» يكتم مسار المنبّه نفسه في النظام، فلا فائدة من التشغيل.
        if (quiet != null && (quiet.muteAdhan || "none".equals(quiet.filter))
                && !"preview".equals(kind)) {
            SakinahLog.add(this, SakinahLog.ADHAN_MUTED, quiet.prayer, kind);
            postSilentNotice();
            publish(STATE_MUTED, kind, title);
            stopForegroundOnly();
            stopSelfSafely();
            return START_NOT_STICKY;
        }

        // مستوى الصوت صفر يعني صمتاً مقصوداً: يبقى التنبيه المكتوب وحده.
        if (sound == null || sound.trim().isEmpty() || volume <= 0.001f) {
            // Silent mode: the notification alone is the reminder.
            if (!"preview".equals(kind)) postSilentNotice();
            publish(STATE_MUTED, kind, title);
            stopForegroundOnly();
            stopSelfSafely();
            return START_NOT_STICKY;
        }

        // «أصوات منار فقط»: يُفتح مسار المنبّه لصوت منار وحده طوال تشغيله،
        // وتُشغَّل التنبيهات على مسار المنبّه لأن مسار الإشعارات مكتوم.
        if (SakinahManager.isManarQuietActive(this)) {
            notificationUsage = false;
            SakinahManager.holdManarAudio(this);
        }

        if (!requestFocus(notificationUsage)) {
            postSilentNotice();
            publish(STATE_MUTED, kind, title);
            stopForegroundOnly();
            stopSelfSafely();
            return START_NOT_STICKY;
        }

        acquireWakeLock();
        if (!startPlayback(sound, volume, notificationUsage)) return START_NOT_STICKY;
        updatePlaybackState(true, title, body, kind);
        publish("iqama".equals(kind) ? STATE_PLAYING_IQAMA : STATE_PLAYING_AZAN, kind, title);
        return START_NOT_STICKY;
    }

    private void startForegroundCompat(Notification notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(
                    this,
                    NOTIFICATION_ID,
                    notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    /** نصّ زرّ الإيقاف يتبع ما يُسمَع فعلاً، لا اسماً واحداً لكل شيء. */
    private static String stopLabel(String kind) {
        if ("iqama".equals(kind)) return "إيقاف الإقامة";
        if ("preview".equals(kind)) return "إيقاف المعاينة";
        return "إيقاف الأذان";
    }

    private Notification buildNotification(String title, String body, String kind) {
        Intent open = new Intent(this, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(
                this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        PendingIntent stopPi = PendingIntent.getService(
                this,
                1,
                new Intent(this, AdhanService.class).setAction(ACTION_STOP),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        PendingIntent mutePi = PendingIntent.getService(
                this,
                2,
                new Intent(this, AdhanService.class).setAction(ACTION_MUTE),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, ManarChannels.PLAYBACK)
                .setSmallIcon(R.drawable.ic_stat_manar)
                .setColor(0xFFC9A227)
                .setContentTitle(title)
                .setContentText(body)
                .setContentIntent(openPi)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true)
                .setOngoing(true)
                // على أندرويد ١٤+ يمكن سحب إشعار الخدمة جانباً: السحب يُسكت الصوت.
                .setDeleteIntent(mutePi)
                // الكتم أوّلاً: هو ما يحتاجه المستخدم في ثانيةٍ واحدة.
                .addAction(R.drawable.ic_stat_manar, "كتم الصوت", mutePi)
                .addAction(R.drawable.ic_stat_manar, stopLabel(kind), stopPi);

        if (session != null) {
            b.setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                    .setMediaSession(session.getSessionToken())
                    .setShowActionsInCompactView(0, 1)
                    .setShowCancelButton(true)
                    .setCancelButtonIntent(stopPi));
        }
        return b.build();
    }

    /**
     * تنبيه الصلاة الذي يبقى بعد الكتم.
     *
     * <p>الكتم يُسكت الصوت ولا يُلغي التنبيه ولا الأذان القادم ولا الميزة —
     * فنُبقي إشعاراً نصيّاً على قناة الأذان بلا صوت.
     */
    private void postSilentNotice() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        String channel = "iqama".equals(currentNoticeKind) ? ManarChannels.IQAMA : ManarChannels.ADHAN;
        if ("preview".equals(currentNoticeKind)) return;

        Intent open = new Intent(this, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(
                this, 3, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification n = new NotificationCompat.Builder(this, channel)
                .setSmallIcon(R.drawable.ic_stat_manar)
                .setColor(0xFFC9A227)
                .setContentTitle(currentNoticeTitle)
                .setContentText(currentNoticeBody.isEmpty() ? "تم كتم الصوت" : currentNoticeBody)
                .setSubText("تم كتم الصوت")
                .setContentIntent(openPi)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setSilent(true)
                .setAutoCancel(true)
                .build();
        try {
            nm.notify(NOTICE_ID, n);
        } catch (SecurityException ignored) {
            // إذن الإشعارات مسحوب
        }
    }

    private static AudioAttributes attributes(boolean notificationUsage) {
        return notificationUsage
                ? new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                : new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build();
    }

    private boolean requestFocus(boolean notificationUsage) {
        if (audioManager == null) return false;
        AudioAttributes attrs = attributes(notificationUsage);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(attrs)
                    .setOnAudioFocusChangeListener(focusListener)
                    .setWillPauseWhenDucked(true)
                    .build();
            return audioManager.requestAudioFocus(focusRequest)
                    == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        }
        @SuppressWarnings("deprecation")
        int result = audioManager.requestAudioFocus(
                focusListener,
                notificationUsage ? AudioManager.STREAM_NOTIFICATION : AudioManager.STREAM_ALARM,
                AudioManager.AUDIOFOCUS_GAIN);
        return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }

    private void abandonFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (focusRequest != null) audioManager.abandonAudioFocusRequest(focusRequest);
        } else {
            @SuppressWarnings("deprecation")
            int ignored = audioManager.abandonAudioFocus(focusListener);
        }
        focusRequest = null;
    }

    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm == null) return;
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "manar:adhan");
        // Longest bundled recording is ~4 minutes; 10 minutes is a safe ceiling.
        wakeLock.acquire(10 * 60 * 1000L);
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
    }

    /**
     * الإقامات الكاملة (iqamah_01…07) حُذفت من التطبيق. منبّهٌ جُدوِل قبل التحديث
     * ولم يُفتح التطبيق بعده قد يحمل أحد أسمائها؛ فيُشغَّل بدلها مقطع «قد قامت
     * الصلاة» المقابل — إقامةٌ بإقامة، لا أذان. المطابقة نفسها في
     * {@code LEGACY_IQAMA_MIGRATION} (src/lib/iqamah-library.ts).
     */
    static String removedIqamahReplacement(String sound) {
        if (sound == null) return null;
        switch (sound) {
            case "iqamah_01": return "iqamah_09";
            case "iqamah_02": return "iqamah_15";
            case "iqamah_03": return "iqamah_12";
            case "iqamah_04": return "iqamah_17";
            case "iqamah_05": return "iqamah_13";
            case "iqamah_06": return "iqamah_19";
            case "iqamah_07": return "iqamah_10";
            default: return sound;
        }
    }

    /**
     * يبدأ تشغيل مورد من {@code res/raw}. عند أيّ فشل (مورد مفقود، فكّ ترميز،
     * حالة مشغّل) لا انهيار: يُسجَّل الخطأ، ويُنشر التنبيه المكتوب إن كان حدثاً
     * مُجدوَلاً، ثم تتوقّف الخدمة بأمان. ولا يُستبدل الصوت بصوتٍ آخر — فالإقامة
     * لا تُعوَّض بأذانٍ أبداً.
     */
    private boolean startPlayback(String sound, float volume, boolean notificationUsage) {
        sound = removedIqamahReplacement(sound);
        int resId = getResources().getIdentifier(sound, "raw", getPackageName());
        if (resId == 0) {
            android.util.Log.e("ManarAudio", "missing raw resource: " + sound + " key=" + currentKey);
            failSafely();
            return false;
        }
        try {
            player = new MediaPlayer();
            player.setAudioAttributes(attributes(notificationUsage));
            player.setDataSource(
                    this, Uri.parse("android.resource://" + getPackageName() + "/raw/" + sound));
            player.setOnCompletionListener(this);
            player.setOnErrorListener(this);
            player.setLooping(false);
            // مستوى المستخدم نسبةً إلى صوت المنبّه في الجهاز (١ = كما كان).
            player.setVolume(volume, volume);
            android.util.Log.i("ManarAudio", "play " + sound + " volume=" + volume
                    + " usage=" + (notificationUsage ? "notification" : "alarm"));
            player.prepare();
            applyLoudness(sound);
            if (!notificationUsage) raiseAlarmStreamIfWanted();
            player.start();
            startQuickStop();
            android.util.Log.i("ManarAudio", "start key=" + currentKey + " sound=" + sound
                    + " kind=" + currentNoticeKind);
            return true;
        } catch (Exception e) {
            android.util.Log.e("ManarAudio", "playback failed: " + sound + " key=" + currentKey, e);
            failSafely();
            return false;
        }
    }

    /** فشل التشغيل: تنبيه مكتوب لحدثٍ مُجدوَل، ثم إيقاف نظيف. */
    private void failSafely() {
        boolean scheduled = !"preview".equals(currentNoticeKind) && !currentKey.isEmpty();
        stopEverything();
        if (scheduled) {
            ManarNotices.post(this, currentEventId,
                    "iqama".equals(currentNoticeKind) ? "iqama" : "adhan",
                    currentNoticeTitle, currentNoticeBody, null, false);
        }
    }

    private void updatePlaybackState(boolean playing, String title, String body, String kind) {
        if (session == null) return;
        session.setMetadata(new android.support.v4.media.MediaMetadataCompat.Builder()
                .putString(android.support.v4.media.MediaMetadataCompat.METADATA_KEY_TITLE, title)
                .putString(android.support.v4.media.MediaMetadataCompat.METADATA_KEY_ARTIST, body)
                .putString(android.support.v4.media.MediaMetadataCompat.METADATA_KEY_ALBUM, "منار")
                .build());
        session.setPlaybackState(new PlaybackStateCompat.Builder()
                .setActions(PlaybackStateCompat.ACTION_STOP | PlaybackStateCompat.ACTION_PAUSE)
                .setState(
                        playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_STOPPED,
                        0,
                        1f)
                .build());
    }

    /**
     * إيقاف سريع دون فتح التطبيق، ما دام صوت منار يعمل:
     *
     * <ul>
     *   <li>أزرار الصوت: تمرّ عبر {@link MediaSessionCompat} (مزوّد الصوت البعيد في
     *       {@link #onCreate})، ويُلتقط هنا احتياطياً أيّ تغيّر فعلي في صوت الجهاز
     *       إن وجّه النظام الزرّ إلى قناة أخرى.</li>
     *   <li>زرّ التشغيل: إن كانت الشاشة مطفأة فإضاءتها تُسكت الصوت؛ وإن كانت مضاءة
     *       نمنع انطفاءها بالمهلة أثناء الصوت، فيكون انطفاؤها ضغطةَ الزرّ لا غير.</li>
     * </ul>
     *
     * <p>كلها «كتم» كزرّ الإشعار: يسكت الصوت ويبقى تنبيه الصلاة مكتوباً، والأذان
     * التالي في موعده. ولا يُحفظ شيء: يُسجَّل المستقبِل مع كل تشغيل ويُلغى معه.
     */
    private void startQuickStop() {
        stopQuickStop();
        playStartedAt = SystemClock.elapsedRealtime();
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        boolean screenOn = pm != null && pm.isInteractive();
        if (screenOn && pm != null) {
            try {
                @SuppressWarnings("deprecation")
                PowerManager.WakeLock lock =
                        pm.newWakeLock(PowerManager.SCREEN_DIM_WAKE_LOCK, "manar:adhan-screen");
                lock.setReferenceCounted(false);
                lock.acquire(10 * 60 * 1000L);
                screenLock = lock;
            } catch (Throwable t) {
                screenLock = null;
            }
        }
        startKeyBridge();
        quickStopReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                onQuickStopEvent(intent);
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_SCREEN_ON);
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        filter.addAction("android.media.VOLUME_CHANGED_ACTION");
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                registerReceiver(quickStopReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                registerReceiver(quickStopReceiver, filter);
            }
        } catch (Throwable t) {
            quickStopReceiver = null;
        }
        android.util.Log.i("ManarAudio", "quick-stop armed screen=" + (screenOn ? "on" : "off"));
    }

    private void onQuickStopEvent(Intent intent) {
        if (player == null || intent == null) return;
        String action = intent.getAction();
        boolean settled = SystemClock.elapsedRealtime() - playStartedAt >= QUICK_STOP_GRACE_MS;
        if (Intent.ACTION_SCREEN_ON.equals(action)) {
            if (settled) muteOnly("power-key");
        } else if (Intent.ACTION_SCREEN_OFF.equals(action)) {
            // بلا قفل الشاشة قد يكون الانطفاء مهلةً لا ضغطة (شاشة أضاءها النظام) — نتجاهله.
            if (screenLock != null && screenLock.isHeld()) muteOnly("power-key");
        } else if ("android.media.VOLUME_CHANGED_ACTION".equals(action)) {
            int now = intent.getIntExtra("android.media.EXTRA_VOLUME_STREAM_VALUE", -1);
            int prev = intent.getIntExtra("android.media.EXTRA_PREV_VOLUME_STREAM_VALUE", -1);
            int stream = intent.getIntExtra("android.media.EXTRA_VOLUME_STREAM_TYPE", -1);
            // يبثّ النظام التغيّر لكل قناة مُسمّاة باسم قناة الوسائط أيضاً (المساعد ١١،
            // الإتاحة ١٠، القراءة الآلية ٩) وقد يصل بثّها قبل الوسائط؛ لو أسكتنا عليها
            // لحاولنا إعادة قناة لا نملك صلاحيتها وضاعت إعادة صوت الوسائط. فنكتفي بالقنوات
            // الأصلية التي يغيّرها الزرّ فعلاً.
            if (!isUserVolumeStream(stream)) return;
            if (settled && now != prev && !quietModeChanging()) {
                // صوت المنبّه المرفوع مؤقتاً تُعيده restoreAlarmStream داخل muteOnly.
                boolean alarmHandled = stream == AudioManager.STREAM_ALARM && restoreAlarmVolume >= 0;
                muteOnly("volume-stream");
                // الضغطة كانت لإسكات الأذان لا لتغيير الصوت: نُعيد الدرجة كما كانت.
                if (!alarmHandled && stream >= 0 && prev >= 0) restoreStreamLevel(stream, prev);
            }
        }
    }

    private static boolean isUserVolumeStream(int stream) {
        return stream == AudioManager.STREAM_MUSIC
                || stream == AudioManager.STREAM_ALARM
                || stream == AudioManager.STREAM_RING
                || stream == AudioManager.STREAM_NOTIFICATION
                || stream == AudioManager.STREAM_SYSTEM
                || stream == AudioManager.STREAM_VOICE_CALL;
    }

    /**
     * «عدم الإزعاج» (ومنه سكينة) ووضع الصامت يغيّران أصوات الجهاز آلياً — ليس
     * ذلك ضغطة زرّ، فلا نُسكت الأذان بسببه.
     */
    private boolean quietModeChanging() {
        try {
            if (audioManager != null && audioManager.getRingerMode() != AudioManager.RINGER_MODE_NORMAL) {
                return true;
            }
            NotificationManager nm = getSystemService(NotificationManager.class);
            return nm != null
                    && nm.getCurrentInterruptionFilter() != NotificationManager.INTERRUPTION_FILTER_ALL
                    && nm.getCurrentInterruptionFilter() != NotificationManager.INTERRUPTION_FILTER_UNKNOWN;
        } catch (Throwable t) {
            return true;
        }
    }

    private void restoreStreamLevel(int stream, int level) {
        if (audioManager == null) return;
        try {
            audioManager.setStreamVolume(stream, level, 0);
            android.util.Log.i("ManarAudio", "restored stream=" + stream + " level=" + level);
        } catch (Throwable ignored) {
            // عدم الإزعاج أو سياسة الجهاز قد تمنع ذلك: لا ضرر.
        }
    }

    private void startKeyBridge() {
        try {
            int rate = 8000;
            int frames = rate / 2; // نصف ثانية تُكرَّر
            short[] silence = new short[frames];
            AudioTrack track = new AudioTrack.Builder()
                    .setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .build())
                    .setAudioFormat(new AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(rate)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .build())
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .setBufferSizeInBytes(frames * 2)
                    .build();
            track.write(silence, 0, frames);
            track.setLoopPoints(0, frames, -1);
            track.play();
            keyBridge = track;
        } catch (Throwable t) {
            // بدونه تبقى أزرار الصوت تعمل والشاشة مضاءة، وزرّ التشغيل والإشعار دائماً.
            android.util.Log.w("ManarAudio", "key bridge unavailable", t);
            releaseKeyBridge();
        }
    }

    private void releaseKeyBridge() {
        if (keyBridge == null) return;
        try {
            keyBridge.stop();
        } catch (Throwable ignored) {
            // not playing
        }
        try {
            keyBridge.release();
        } catch (Throwable ignored) {
            // already released
        }
        keyBridge = null;
    }

    private void stopQuickStop() {
        releaseKeyBridge();
        if (quickStopReceiver != null) {
            try {
                unregisterReceiver(quickStopReceiver);
            } catch (Throwable ignored) {
                // already unregistered
            }
            quickStopReceiver = null;
        }
        if (screenLock != null) {
            try {
                if (screenLock.isHeld()) screenLock.release();
            } catch (Throwable ignored) {
                // already released
            }
            screenLock = null;
        }
    }

    /**
     * التسجيلات المرفقة متفاوتة الارتفاع حتى ١٩ ديسيبل؛ نرفع الضعيف منها وقت
     * التشغيل دون إعادة ترميز الملف. أيّ فشل هنا (جهاز لا يدعم المؤثّر) لا يمنع
     * التشغيل — يُسمع الأذان بارتفاعه الأصلي.
     */
    private void applyLoudness(String sound) {
        releaseEnhancer();
        int gain = ManarLoudness.gainMillibels(sound);
        if (gain <= 0 || player == null) return;
        try {
            enhancer = new LoudnessEnhancer(player.getAudioSessionId());
            enhancer.setTargetGain(gain);
            enhancer.setEnabled(true);
            android.util.Log.i("ManarAudio", "loudness +" + gain + "mB " + sound);
        } catch (Throwable t) {
            android.util.Log.w("ManarAudio", "loudness enhancer unavailable", t);
            releaseEnhancer();
        }
    }

    private void releaseEnhancer() {
        if (enhancer == null) return;
        try {
            enhancer.release();
        } catch (Throwable ignored) {
            // already released
        }
        enhancer = null;
    }

    /**
     * صوت الأذان نسبةٌ من «صوت المنبّه» في الجوال: لو كان منخفضاً سُمع الأذان
     * ضعيفاً مهما رُفع مستواه في منار. إن فعّل المستخدم «رفع صوت المنبّه وقت
     * الأذان» نرفعه مؤقتاً إلى الأقصى ونعيده كما كان عند الانتهاء.
     */
    private void raiseAlarmStreamIfWanted() {
        if (audioManager == null || !ManarVolumes.raiseAlarm(this)) return;
        try {
            int max = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            int cur = audioManager.getStreamVolume(AudioManager.STREAM_ALARM);
            if (cur >= max) return;
            if (restoreAlarmVolume < 0) restoreAlarmVolume = cur;
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, max, 0);
            android.util.Log.i("ManarAudio", "alarm stream raised " + cur + " -> " + max);
        } catch (Throwable t) {
            // عدم الإزعاج أو سياسة الجهاز قد تمنع ذلك: يبقى التشغيل بالمستوى الحالي.
            android.util.Log.w("ManarAudio", "could not raise alarm stream", t);
        }
    }

    private void restoreAlarmStream() {
        if (restoreAlarmVolume < 0 || audioManager == null) return;
        try {
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, restoreAlarmVolume, 0);
        } catch (Throwable ignored) {
            // nothing else to do
        }
        restoreAlarmVolume = -1;
    }

    /** يُوقف المشغّل ويُحرّره دون إنهاء الخدمة — أساس منع تراكب الأصوات. */
    private void releasePlayer() {
        SakinahManager.releaseManarAudio(this);
        stopQuickStop();
        releaseEnhancer();
        restoreAlarmStream();
        if (player == null) return;
        try {
            if (player.isPlaying()) player.stop();
        } catch (IllegalStateException ignored) {
            // player already released
        }
        try {
            player.release();
        } catch (Exception ignored) {
            // nothing else to do
        }
        player = null;
    }

    /** يُنهي الخدمة فقط إن لم يصلها طلب أحدث — انظر {@link #lastStartId}. */
    private void stopSelfSafely() {
        stopSelf(lastStartId);
    }

    private void stopForegroundOnly() {
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
    }

    /** كتم: يُسكت صوت منار فوراً ويُبقي تنبيه الصلاة. */
    private void muteOnly(String by) {
        boolean wasSounding = player != null;
        if (wasSounding) android.util.Log.i("ManarAudio", "muted by=" + by + " key=" + currentKey);
        releasePlayer();
        abandonFocus();
        releaseWakeLock();
        if (session != null) {
            session.setPlaybackState(new PlaybackStateCompat.Builder()
                    .setState(PlaybackStateCompat.STATE_STOPPED, 0, 1f)
                    .build());
        }
        if (wasSounding) postSilentNotice();
        publish(STATE_MUTED, currentNoticeKind, currentNoticeTitle);
        stopForegroundOnly();
        stopSelfSafely();
    }

    private void stopEverything() {
        if (player != null) android.util.Log.i("ManarAudio", "stopped by=user key=" + currentKey);
        releasePlayer();
        abandonFocus();
        releaseWakeLock();
        if (session != null) {
            session.setPlaybackState(new PlaybackStateCompat.Builder()
                    .setState(PlaybackStateCompat.STATE_STOPPED, 0, 1f)
                    .build());
        }
        publish(STATE_STOPPED, currentNoticeKind, currentNoticeTitle);
        stopForegroundOnly();
        stopSelfSafely();
    }

    @Override
    public void onCompletion(MediaPlayer mp) {
        releasePlayer();
        abandonFocus();
        releaseWakeLock();
        publish(STATE_IDLE, currentNoticeKind, currentNoticeTitle);
        stopForegroundOnly();
        // إشعار دخول الوقت يبقى بعد انتهاء الأذان (إن كان مفعّلاً) — صامتاً لأن
        // الأذان سُمِع للتوّ. إشعار التحكم أُزيل مع انتهاء الخدمة الأمامية.
        if (currentWantsNotice && !"preview".equals(currentNoticeKind)) {
            ManarNotices.post(this, currentEventId, "adhan",
                    currentNoticeTitle, currentNoticeBody, null, true);
        }
        android.util.Log.i("ManarAudio", "completed key=" + currentKey);
        stopSelfSafely();
    }

    @Override
    public boolean onError(MediaPlayer mp, int what, int extra) {
        android.util.Log.e("ManarAudio", "decoder error what=" + what + " extra=" + extra
                + " key=" + currentKey);
        failSafely();
        return true;
    }

    @Override
    public void onDestroy() {
        releasePlayer();
        abandonFocus();
        releaseWakeLock();
        if (session != null) {
            session.setActive(false);
            session.release();
            session = null;
        }
        if (STATE_PLAYING_AZAN.equals(state) || STATE_PLAYING_IQAMA.equals(state)) {
            publish(STATE_IDLE, stateKind, stateTitle);
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
