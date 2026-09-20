package app.manar.islamic;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

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
 *   - shows an ongoing notification with a single "إيقاف الأذان" action,
 *   - holds a partial wake lock only for the duration of the recording,
 *   - stops itself as soon as playback finishes, focus is lost permanently, or
 *     the user taps stop.
 */
public class AdhanService extends Service
        implements MediaPlayer.OnCompletionListener, MediaPlayer.OnErrorListener {

    public static final String ACTION_PLAY = "app.manar.islamic.action.PLAY";
    public static final String ACTION_STOP = "app.manar.islamic.action.STOP";

    public static final String EXTRA_SOUND = "sound";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_BODY = "body";
    public static final String EXTRA_KIND = "kind";

    private static final int NOTIFICATION_ID = 40990;

    @Nullable private MediaPlayer player;
    @Nullable private MediaSessionCompat session;
    @Nullable private AudioFocusRequest focusRequest;
    @Nullable private PowerManager.WakeLock wakeLock;
    @Nullable private AudioManager audioManager;

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
        Intent intent = new Intent(context, AdhanService.class)
                .setAction(ACTION_PLAY)
                .putExtra(EXTRA_SOUND, sound)
                .putExtra(EXTRA_TITLE, title)
                .putExtra(EXTRA_BODY, body)
                .putExtra(EXTRA_KIND, kind);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stop(Context context) {
        context.startService(new Intent(context, AdhanService.class).setAction(ACTION_STOP));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        ManarChannels.ensure(this);
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        session = new MediaSessionCompat(this, "manar-adhan");
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onStop() { stopEverything(); }
            @Override public void onPause() { stopEverything(); }
        });
        session.setActive(true);
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;

        if (ACTION_STOP.equals(action)) {
            stopEverything();
            return START_NOT_STICKY;
        }

        String sound = intent != null ? intent.getStringExtra(EXTRA_SOUND) : null;
        String title = intent != null ? intent.getStringExtra(EXTRA_TITLE) : null;
        String body = intent != null ? intent.getStringExtra(EXTRA_BODY) : null;
        String kind = intent != null ? intent.getStringExtra(EXTRA_KIND) : "adhan";

        if (title == null) title = "منار";
        if (body == null) body = "";

        // The notification must be posted before anything else can fail, or
        // Android kills the service for starting foreground too late.
        startForegroundCompat(buildNotification(title, body));

        if (sound == null || sound.trim().isEmpty()) {
            // Silent mode: the notification alone is the reminder.
            stopSelfSoon();
            return START_NOT_STICKY;
        }

        if (!requestFocus()) {
            stopSelfSoon();
            return START_NOT_STICKY;
        }

        acquireWakeLock();
        startPlayback(sound);
        updatePlaybackState(true, title, body, kind);
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

    private Notification buildNotification(String title, String body) {
        Intent open = new Intent(this, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(
                this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        PendingIntent stopPi = PendingIntent.getService(
                this,
                1,
                new Intent(this, AdhanService.class).setAction(ACTION_STOP),
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
                .addAction(R.drawable.ic_stat_manar, "إيقاف الأذان", stopPi);

        if (session != null) {
            b.setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                    .setMediaSession(session.getSessionToken())
                    .setShowActionsInCompactView(0)
                    .setShowCancelButton(true)
                    .setCancelButtonIntent(stopPi));
        }
        return b.build();
    }

    private boolean requestFocus() {
        if (audioManager == null) return false;
        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build();

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
                focusListener, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN);
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

    private void startPlayback(String sound) {
        int resId = getResources().getIdentifier(sound, "raw", getPackageName());
        if (resId == 0) {
            stopSelfSoon();
            return;
        }
        try {
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build());
            player.setDataSource(
                    this, Uri.parse("android.resource://" + getPackageName() + "/raw/" + sound));
            player.setOnCompletionListener(this);
            player.setOnErrorListener(this);
            player.setLooping(false);
            player.prepare();
            player.start();
        } catch (Exception e) {
            stopSelfSoon();
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

    private void stopSelfSoon() {
        stopEverything();
    }

    private void stopEverything() {
        if (player != null) {
            try {
                if (player.isPlaying()) player.stop();
            } catch (IllegalStateException ignored) {
                // player already released
            }
            player.release();
            player = null;
        }
        abandonFocus();
        releaseWakeLock();
        if (session != null) {
            session.setPlaybackState(new PlaybackStateCompat.Builder()
                    .setState(PlaybackStateCompat.STATE_STOPPED, 0, 1f)
                    .build());
        }
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onCompletion(MediaPlayer mp) {
        stopEverything();
    }

    @Override
    public boolean onError(MediaPlayer mp, int what, int extra) {
        stopEverything();
        return true;
    }

    @Override
    public void onDestroy() {
        stopEverything();
        if (session != null) {
            session.setActive(false);
            session.release();
            session = null;
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
