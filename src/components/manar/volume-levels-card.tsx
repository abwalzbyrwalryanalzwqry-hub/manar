import { useEffect, useRef, useState } from "react";
import { Icon, icons } from "@/components/manar/shell";
import {
  effectiveVolume,
  notificationLevel,
  type AdhanSettings,
  type VolumeLevels,
} from "@/lib/adhan-settings";
import { playAdhan, playIqama } from "@/lib/adhan-sound";
import { play, stop } from "@/lib/audio-engine";
import { toArabicDigits, formatPercent } from "@/lib/format";
import {
  getPhoneAlarmVolume,
  isNativeShell,
  setPhoneAlarmVolume,
} from "@/lib/native-notifications";
import { approachPreviewUrl } from "@/lib/prayer-approach-audio";

type RowKey = "volume" | "adhanVolume" | "iqamaVolume" | "reminderVolume";

const ROWS: { key: RowKey; label: string; hint: string }[] = [
  { key: "volume", label: "المستوى العام", hint: "جميع أصوات منار وإشعاراتها" },
  { key: "adhanVolume", label: "الأذان", hint: "الأذان والأذان الأول للفجر والتثويب" },
  { key: "iqamaVolume", label: "الإقامة", hint: "صوت إقامة الصلاة" },
  {
    key: "reminderVolume",
    label: "التنبيهات",
    hint: "التنبيه قبل الصلاة وتذكيرات الأذكار والوِرد",
  },
];

const pct = (v: number) => formatPercent(v * 100);

const pick = (s: VolumeLevels): VolumeLevels => ({
  volume: s.volume,
  adhanVolume: s.adhanVolume,
  iqamaVolume: s.iqamaVolume,
  reminderVolume: s.reminderVolume,
});

const same = (a: VolumeLevels, b: VolumeLevels) =>
  ROWS.every((r) => Math.round(a[r.key] * 100) === Math.round(b[r.key] * 100));

/**
 * «مستوى الأصوات» في مركز التنبيهات: مؤشّر عام ومؤشّر لكل فئة، مع تجربة
 * فورية بالقيمة قيد الضبط. لا يُحفظ شيء إلا بزرّ «تأكيد»، و«إلغاء» يعيد
 * القيم المحفوظة.
 */
export function VolumeLevelsCard({
  settings,
  onConfirm,
  onRaisePhoneAlarm,
}: {
  settings: AdhanSettings;
  onConfirm: (levels: VolumeLevels) => void;
  /** تفعيل/إيقاف «رفع صوت المنبّه في الجوال وقت الأذان» — يُحفظ فوراً. */
  onRaisePhoneAlarm?: (on: boolean) => void;
}) {
  const saved = pick(settings);
  const [draft, setDraft] = useState<VolumeLevels>(saved);
  const [touched, setTouched] = useState(false);
  const [testing, setTesting] = useState<RowKey | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  // تتبّع القيم المحفوظة ما دام المستخدم لم يبدأ التعديل.
  const savedKey = ROWS.map((r) => saved[r.key]).join("|");
  useEffect(() => {
    if (!touched) setDraft(pick(settings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey, touched]);

  useEffect(
    () => () => {
      stopRef.current?.();
      stopRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 2600);
    return () => clearTimeout(t);
  }, [note]);

  const dirty = touched && !same(draft, saved);

  const stopTest = () => {
    stopRef.current?.();
    stopRef.current = null;
    stop();
    setTesting(null);
  };

  const test = (key: RowKey) => {
    if (testing === key) {
      stopTest();
      return;
    }
    if (!isNativeShell()) stopRef.current?.();
    setTesting(key);
    const done = () => setTesting((cur) => (cur === key ? null : cur));
    const opts = { onEnd: done, onError: done };
    if (key === "adhanVolume") {
      stopRef.current = playAdhan(settings.selectedAdhan, {
        ...opts,
        volume: effectiveVolume(draft, "adhan"),
      });
    } else if (key === "iqamaVolume") {
      stopRef.current = playIqama(settings.iqamaVariant, {
        ...opts,
        volume: effectiveVolume(draft, "iqama"),
      });
    } else {
      // التنبيهات والعام: نغمة التنبيه قبل الصلاة المختارة، بمستوى ما سيُسمَع فعلاً.
      const volume =
        key === "volume"
          ? draft.volume
          : isNativeShell()
            ? notificationLevel(draft) / 100
            : effectiveVolume(draft, "reminder");
      const url = approachPreviewUrl(settings.reminderSound, "dhuhr");
      if (!url) {
        done();
        return;
      }
      stopRef.current = play(url, {
        ...opts,
        volume,
        usage: "notification",
        label: "تجربة مستوى الصوت",
      });
    }
  };

  const confirm = () => {
    stopTest();
    onConfirm(draft);
    setTouched(false);
    setNote("تم حفظ مستوى الأصوات");
  };

  const cancel = () => {
    stopTest();
    setDraft(saved);
    setTouched(false);
    setNote("أُعيدت القيم المحفوظة");
  };

  const level = notificationLevel(draft);
  const reminderPct = Math.round(effectiveVolume(draft, "reminder") * 100);
  const muted = settings.silentMode || !settings.soundEnabled;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-sm font-medium">مستوى الأصوات</div>
        <div className="text-xs text-muted-foreground tabular-nums">{pct(draft.volume)}</div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        اضبط كل فئة وجرّبها، ثم اضغط «تأكيد» لحفظها.
      </p>

      <div className="mt-3 space-y-4">
        {ROWS.map((r) => (
          <div key={r.key}>
            <div className="mb-1.5 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium">{r.label}</div>
                <div className="truncate text-[10px] text-muted-foreground">{r.hint}</div>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {pct(draft[r.key])}
              </span>
              <button
                onClick={() => test(r.key)}
                aria-label={`تجربة ${r.label}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-primary"
              >
                <Icon d={testing === r.key ? icons.stop : icons.play} size={11} />
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(draft[r.key] * 100)}
              aria-label={r.label}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                setTouched(true);
                setDraft((d) => ({ ...d, [r.key]: v }));
              }}
              className="w-full accent-primary"
              dir="ltr"
            />
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl bg-secondary/40 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
        المستوى الفعلي: الأذان {pct(effectiveVolume(draft, "adhan"))} · الإقامة{" "}
        {pct(effectiveVolume(draft, "iqama"))} · التنبيهات {formatPercent(reminderPct)}
        {isNativeShell() && level !== reminderPct && (
          <> (تُشغَّل إشعاراتها بدرجة {formatPercent(level)})</>
        )}
        {muted && <div className="mt-1 text-foreground">الوضع الصامت مفعّل: لن تُسمع الأصوات.</div>}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={confirm}
          disabled={!dirty}
          className="gradient-primary flex-1 rounded-xl py-2 text-xs font-medium text-primary-foreground shadow-glow disabled:opacity-50 disabled:shadow-none"
        >
          تأكيد
        </button>
        <button
          onClick={cancel}
          disabled={!dirty}
          className="flex-1 rounded-xl border border-border bg-secondary/40 py-2 text-xs disabled:opacity-50"
        >
          إلغاء
        </button>
      </div>
      {note && (
        <p role="status" className="mt-2 text-center text-[11px] text-primary">
          {note}
        </p>
      )}

      {isNativeShell() && (
        <PhoneAlarmPanel
          raise={settings.raisePhoneAlarm}
          onRaise={(on) => onRaisePhoneAlarm?.(on)}
        />
      )}
    </div>
  );
}

/** تحت هذه النسبة يُسمع الأذان ضعيفاً على أغلب الأجهزة. */
const LOW_PHONE_ALARM = 60;

/**
 * صوت «المنبّه» في الجوال. الأذان والإقامة يُشغَّلان على قناة المنبّه، ومستوى
 * منار نسبةٌ منها: ١٠٠٪ في منار × ٣٠٪ منبّه = أذان ضعيف. هذه اللوحة تُظهر
 * المستوى الحقيقي وتتيح رفعه بلمسة، أو رفعه تلقائياً وقت الأذان فقط.
 */
function PhoneAlarmPanel({ raise, onRaise }: { raise: boolean; onRaise: (on: boolean) => void }) {
  const [percent, setPercent] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const read = () =>
      void getPhoneAlarmVolume().then((p) => {
        if (alive) setPercent(p);
      });
    read();
    // أزرار الصوت في الجوال لا تُبلغ الويب؛ قراءة خفيفة كل ثانيتين والشاشة ظاهرة.
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") read();
    }, 2000);
    document.addEventListener("visibilitychange", read);
    return () => {
      alive = false;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", read);
    };
  }, []);

  if (percent == null) return null;
  const low = percent < LOW_PHONE_ALARM;

  const raiseNow = async () => {
    setBusy(true);
    const p = await setPhoneAlarmVolume(1);
    setBusy(false);
    if (p != null) setPercent(p);
  };

  return (
    <div
      className={`mt-4 rounded-xl border p-3 ${low ? "border-gold/50 bg-gold/10" : "border-border bg-secondary/30"}`}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card text-primary">
          <Icon d={icons.bell} size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium">صوت المنبّه في جوالك</div>
          <div className="text-[10px] leading-relaxed text-muted-foreground">
            الأذان والإقامة يُشغَّلان على صوت المنبّه، ومستويات منار نسبةٌ منه.
          </div>
        </div>
        <span className="text-sm font-medium tabular-nums">{pct(percent / 100)}</span>
      </div>

      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-label="صوت المنبّه في الجوال"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        dir="ltr"
      >
        <div
          className={`h-full rounded-full ${low ? "bg-gold" : "bg-primary"}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {low && (
        <p className="mt-2 text-[11px] leading-relaxed text-foreground">
          صوت المنبّه منخفض، لذلك يُسمع الأذان ضعيفاً مهما رفعت مستواه هنا. ارفعه الآن أو فعّل الرفع
          التلقائي.
        </p>
      )}

      {percent < 100 && (
        <button
          onClick={() => void raiseNow()}
          disabled={busy}
          className="mt-2 w-full rounded-lg border border-primary/40 bg-card py-2 text-xs font-medium text-primary disabled:opacity-60"
        >
          رفع صوت المنبّه إلى الأقصى
        </button>
      )}

      <label className="mt-3 flex cursor-pointer items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium">رفعه تلقائياً وقت الأذان</span>
          <span className="block text-[10px] leading-relaxed text-muted-foreground">
            يُرفع صوت المنبّه إلى الأقصى أثناء الأذان والإقامة فقط، ثم يعود كما كان.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={raise}
          onChange={(e) => onRaise(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
          aria-label="رفع صوت المنبّه تلقائياً وقت الأذان"
        />
      </label>
    </div>
  );
}
