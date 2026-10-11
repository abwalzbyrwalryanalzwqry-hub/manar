package app.manar.islamic;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaPlayer;
import android.util.Log;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;

/**
 * مستقبِل فحص — بناء التصحيح فقط.
 *
 * <ul>
 *   <li>{@code DECODE_ALL}: يفكّ كل تسجيلات الإقامة من {@code res/raw} فكًّا كاملًا
 *       بـ MediaCodec (يُثبت دعم المُفكِّك على هذا الإصدار)، ثم يشغّل كلًّا منها
 *       بـ MediaPlayer لحظةً ويتحقّق أنه يعمل.</li>
 *   <li>{@code SCHEDULE} مع {@code scenario}: يضبط أحداثًا قريبة عبر
 *       {@link AdhanScheduler} الحقيقي (المستقبِل والخدمة نفسهما في الإصدار).</li>
 * </ul>
 * النتائج في logcat بوسم {@code ManarTest}.
 */
public class ManarTestReceiver extends BroadcastReceiver {

    private static final String TAG = "ManarTest";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if ("app.manar.islamic.test.DECODE_ALL".equals(action)) {
            // الاختبار يُشغَّل والتطبيق في المقدّمة، فيبقى الخيط حيًّا حتى ينتهي.
            final Context app = context.getApplicationContext();
            new Thread(() -> decodeAll(app), "manar-decode-test").start();
        } else if ("app.manar.islamic.test.SCHEDULE".equals(action)) {
            schedule(context, intent.getStringExtra("scenario"));
        }
    }

    /* --------------------------- فكّ وتشغيل --------------------------- */

    private static void decodeAll(Context ctx) {
        // المكتبة لم تعد ١٩ ثابتة (حُذفت iqamah_01…07 عمداً)، فيُفحص كل مورد إقامة موجود فعلاً
        // في الحزمة؛ والسكربت يقارن العدد بملفات public/audio/iqamah حتى لا يسقط ملفٌ دون أن يُلاحظ.
        int pass = 0;
        int fail = 0;
        for (int i = 1; i <= 99; i++) {
            String name = String.format(java.util.Locale.US, "iqamah_%02d", i);
            if (ctx.getResources().getIdentifier(name, "raw", ctx.getPackageName()) == 0) continue;
            if (decodeOne(ctx, name) && playOne(ctx, name)) pass++;
            else fail++;
        }
        Log.i(TAG, "DECODE_DONE pass=" + pass + " fail=" + fail);
    }

    private static boolean decodeOne(Context ctx, String name) {
        int resId = ctx.getResources().getIdentifier(name, "raw", ctx.getPackageName());
        if (resId == 0) {
            Log.e(TAG, "DECODE " + name + " FAIL missing resource");
            return false;
        }
        MediaExtractor ex = new MediaExtractor();
        MediaCodec codec = null;
        try (AssetFileDescriptor afd = ctx.getResources().openRawResourceFd(resId)) {
            if (afd == null) {
                Log.e(TAG, "DECODE " + name + " FAIL compressed in apk");
                return false;
            }
            ex.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            MediaFormat fmt = ex.getTrackFormat(0);
            String mime = fmt.getString(MediaFormat.KEY_MIME);
            int rate = fmt.getInteger(MediaFormat.KEY_SAMPLE_RATE);
            int ch = fmt.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
            long durUs = fmt.containsKey(MediaFormat.KEY_DURATION) ? fmt.getLong(MediaFormat.KEY_DURATION) : 0;
            ex.selectTrack(0);
            codec = MediaCodec.createDecoderByType(mime);
            codec.configure(fmt, null, null, 0);
            codec.start();
            MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
            long pcmBytes = 0;
            int outRate = rate;
            int outCh = ch;
            boolean inEos = false;
            boolean outEos = false;
            long guard = System.currentTimeMillis() + 60_000;
            while (!outEos && System.currentTimeMillis() < guard) {
                if (!inEos) {
                    int in = codec.dequeueInputBuffer(10_000);
                    if (in >= 0) {
                        ByteBuffer buf = codec.getInputBuffer(in);
                        int n = ex.readSampleData(buf, 0);
                        if (n < 0) {
                            codec.queueInputBuffer(in, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                            inEos = true;
                        } else {
                            codec.queueInputBuffer(in, 0, n, ex.getSampleTime(), 0);
                            ex.advance();
                        }
                    }
                }
                int out = codec.dequeueOutputBuffer(info, 10_000);
                if (out == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    MediaFormat of = codec.getOutputFormat();
                    outRate = of.getInteger(MediaFormat.KEY_SAMPLE_RATE);
                    outCh = of.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
                } else if (out >= 0) {
                    pcmBytes += info.size;
                    if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) outEos = true;
                    codec.releaseOutputBuffer(out, false);
                }
            }
            double decodedSec = pcmBytes / (2.0 * outCh * outRate);
            double declaredSec = durUs / 1e6;
            boolean ok = outEos && decodedSec > 1.0
                    && (declaredSec <= 0 || Math.abs(decodedSec - declaredSec) < 1.0);
            Log.i(TAG, String.format(java.util.Locale.US,
                    "DECODE %s %s mime=%s rate=%d ch=%d declared=%.2fs decoded=%.2fs",
                    name, ok ? "OK" : "FAIL", mime, rate, ch, declaredSec, decodedSec));
            return ok;
        } catch (Exception e) {
            Log.e(TAG, "DECODE " + name + " FAIL " + e);
            return false;
        } finally {
            if (codec != null) {
                try {
                    codec.stop();
                } catch (Exception ignored) {
                    // already stopped
                }
                codec.release();
            }
            ex.release();
        }
    }

    private static boolean playOne(Context ctx, String name) {
        int resId = ctx.getResources().getIdentifier(name, "raw", ctx.getPackageName());
        MediaPlayer mp = null;
        try {
            mp = MediaPlayer.create(ctx, resId);
            if (mp == null) {
                Log.e(TAG, "PLAY " + name + " FAIL create returned null");
                return false;
            }
            int dur = mp.getDuration();
            mp.setVolume(0.05f, 0.05f);
            mp.start();
            Thread.sleep(900);
            boolean ok = mp.isPlaying() && mp.getCurrentPosition() > 0 && dur > 1000;
            Log.i(TAG, "PLAY " + name + (ok ? " OK" : " FAIL") + " duration=" + dur
                    + "ms position=" + mp.getCurrentPosition());
            return ok;
        } catch (Exception e) {
            Log.e(TAG, "PLAY " + name + " FAIL " + e);
            return false;
        } finally {
            if (mp != null) mp.release();
        }
    }

    /* ----------------------------- جدولة ----------------------------- */

    private static AdhanScheduler.Event ev(int id, String key, long at, String sound, String kind,
                                           String channel, boolean notice) {
        return new AdhanScheduler.Event(id, key, at, sound, "اختبار " + key, "منار", kind,
                channel, notice);
    }

    private static void schedule(Context ctx, String scenario) {
        long now = System.currentTimeMillis();
        List<AdhanScheduler.Event> list = new ArrayList<>();
        if ("flow".equals(scenario)) {
            // أذان ← تنبيه قبل الإقامة ← إقامة، ثم إقامة طويلة يقطعها أذان (صوت واحد فقط).
            list.add(ev(9001, "t_dhuhr_adhan", now + 60_000, "madinah_short", "adhan", "", true));
            list.add(ev(9001, "t_dhuhr_adhan", now + 60_000, "madinah_short", "adhan", "", true));
            list.add(ev(9002, "t_dhuhr_adhan", now + 61_000, "madinah_short", "adhan", "", true));
            list.add(ev(9003, "t_dhuhr_iqamah_reminder", now + 100_000, "", "notice", "iqama", false));
            list.add(ev(9004, "t_dhuhr_iqamah", now + 125_000, "iqamah_08", "iqama", "", false));
            // مقاطع الإقامة الحالية قصيرة (~٥ ث)، فيأتي الأذان بعد ثانيتين ليقطعها وهي تعمل.
            list.add(ev(9005, "t_asr_iqamah", now + 150_000, "iqamah_15", "iqama", "", false));
            list.add(ev(9006, "t_asr_adhan", now + 152_000, "madinah_short", "adhan", "", false));
            list.add(ev(9007, "t_maghrib_prayer_notice", now + 175_000, "", "notice", "adhan", false));
        } else if ("refire".equals(scenario)) {
            // المفاتيح نفسها التي أُطلقت: يجب ألا يُضبط منها شيء.
            list.add(ev(9001, "t_dhuhr_adhan", now + 30_000, "madinah_short", "adhan", "", true));
            list.add(ev(9004, "t_dhuhr_iqamah", now + 35_000, "iqamah_08", "iqama", "", false));
        } else if ("reboot".equals(scenario)) {
            list.add(ev(9101, "t_isha_iqamah", now + 240_000, "iqamah_19", "iqama", "", false));
            list.add(ev(9102, "t_isha_iqamah_reminder", now + 230_000, "", "notice", "iqama", false));
        } else if ("quick".equals(scenario)) {
            // الإيقاف السريع بأزرار الجهاز: أصوات طويلة يُسكتها الاختبار قبل نهايتها.
            list.add(ev(9301, "t_q1_adhan", now + 20_000, "afasy_full_1", "adhan", "", false));
            list.add(ev(9302, "t_q2_iqamah", now + 70_000, "iqamah_15", "iqama", "", false));
            list.add(ev(9303, "t_q3_adhan", now + 120_000, "afasy_full_2", "adhan", "", false));
            list.add(ev(9304, "t_q4_iqamah", now + 170_000, "iqamah_15", "iqama", "", false));
        } else if ("missing".equals(scenario)) {
            // مورد غير موجود: لا انهيار، لا صوت بديل، يبقى الإشعار المكتوب.
            list.add(ev(9201, "t_missing_iqamah", now + 20_000, "iqamah_99", "iqama", "", false));
        }
        int armed = AdhanScheduler.replaceAll(ctx, list);
        Log.i(TAG, "SCHEDULED scenario=" + scenario + " requested=" + list.size() + " armed=" + armed
                + " exact=" + AdhanScheduler.canScheduleExact(ctx));
    }
}
