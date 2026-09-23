import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Arabesque,
  Icon,
  icons,
  Screen,
  ScreenHeader,
  SectionLabel,
} from "@/components/manar/shell";
import { REMINDER_OPTIONS, effectiveVolume, useAdhanSettings } from "@/lib/adhan-settings";
import { VolumeLevelsCard } from "@/components/manar/volume-levels-card";
import { AlertSystemStatus } from "@/components/manar/alert-system-status";
import { iqamahLabel } from "@/lib/iqamah-library";
import { PRAYER_LABELS, PRAYER_ORDER, type PrayerKey } from "@/lib/prayer";
import { toArabicDigits } from "@/lib/format";
import { requestNotificationPermission } from "@/components/manar/adhan-provider";
import { adhanVariantLabel } from "@/lib/adhan-sound";
import { play } from "@/lib/audio-engine";
import { isNativeShell } from "@/lib/native-notifications";
import {
  PRAYER_APPROACH_CLIPS,
  PRAYER_APPROACH_SOUNDS,
  type ApproachPrayer,
} from "@/lib/prayer-approach-audio";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "مركز التنبيهات — منار" }] }),
  component: Notifications,
});

function Notifications() {
  const { settings, update, updateDeep } = useAdhanSettings();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [showPermSheet, setShowPermSheet] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPerm("unsupported");
      return;
    }
    setPerm(Notification.permission);
  }, []);

  const ask = async () => {
    const r = await requestNotificationPermission();
    setPerm(r);
    setShowPermSheet(false);
  };

  /* معاينة أصوات التنبيه قبل الصلاة — صوت واحد في كل لحظة، ويُسكَت عند المغادرة. */
  const [previewing, setPreviewing] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      stopRef.current?.();
      stopRef.current = null;
    },
    [],
  );
  const previewApproach = (key: string, url: string, label: string) => {
    if (!url || previewing === key) {
      stopRef.current?.();
      stopRef.current = null;
      setPreviewing(null);
      return;
    }
    if (!isNativeShell()) stopRef.current?.();
    setPreviewing(key);
    stopRef.current = play(url, {
      volume: effectiveVolume(settings, "reminder"),
      usage: "notification",
      onEnd: () => setPreviewing((cur) => (cur === key ? null : cur)),
      onError: () => setPreviewing((cur) => (cur === key ? null : cur)),
      label,
    });
  };

  const selectedAdhan = adhanVariantLabel(settings.selectedAdhan);
  const fajrAdhan = adhanVariantLabel(settings.fajrAdhan);

  return (
    <Screen>
      <ScreenHeader title="مركز التنبيهات" subtitle="إدارة جميع تنبيهات الصلاة" backTo="/more" />

      {/* Permission card */}
      <div className="px-4 animate-fade-up">
        <div className="gradient-hero relative overflow-hidden rounded-[28px] p-5 text-white shadow-elegant">
          <Arabesque className="absolute -left-10 -top-10 h-56 w-56 text-white/15" />
          <div className="relative flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Icon d={icons.bell} size={22} />
            </span>
            <div className="flex-1">
              <div className="font-display text-base">إذن الإشعارات</div>
              <div className="text-[11px] text-white/70">
                {perm === "granted" && "مفعّل — ستصلك تنبيهات الأذان والإقامة"}
                {perm === "denied" && "تم رفض الإذن — فعّله من إعدادات المتصفح"}
                {perm === "default" && "لم يتم منح الإذن بعد"}
                {perm === "unsupported" && "المتصفح لا يدعم الإشعارات"}
              </div>
            </div>
            {perm === "default" && (
              <button
                onClick={() => setShowPermSheet(true)}
                className="rounded-full bg-white/20 px-3 py-1.5 text-[11px] backdrop-blur"
              >
                تفعيل
              </button>
            )}
            {perm === "granted" && (
              <span className="rounded-full bg-white/20 px-3 py-1 text-[10px]">✓ مفعّل</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 px-4">
        <AlertSystemStatus settings={settings} />
      </div>

      {/* Master controls — كل مرحلة مستقلّة: تعطيل الأذان لا يُعطّل الإقامة */}
      <SectionLabel hint="كل مرحلة مستقلّة عن غيرها">التحكم العام</SectionLabel>
      <div className="space-y-2 px-4">
        <Toggle
          icon={icons.bell}
          label="الأذان"
          hint={`الصوت المختار: ${selectedAdhan}`}
          on={settings.adhanEnabled}
          onToggle={() => update({ adhanEnabled: !settings.adhanEnabled })}
        />
        <Toggle
          icon={icons.bell}
          label="إشعار دخول الوقت"
          hint="إشعار نصّي عند دخول وقت الصلاة، ولو كان الأذان معطّلاً"
          on={settings.prayerNoticeEnabled}
          onToggle={() => update({ prayerNoticeEnabled: !settings.prayerNoticeEnabled })}
        />
        <Toggle
          icon={icons.bell}
          label="التذكيرات قبل الصلاة"
          hint="تنبيهات قبل دخول وقت الصلاة"
          on={settings.remindersEnabled}
          onToggle={() => update({ remindersEnabled: !settings.remindersEnabled })}
        />
        <Toggle
          icon={icons.prayer}
          label="الإقامة"
          hint={
            settings.iqamaSoundEnabled
              ? `الصوت: ${iqamahLabel(settings.iqamaVariant)}`
              : "إشعار بلا صوت في موعد الإقامة"
          }
          on={settings.iqamaEnabled}
          onToggle={() => update({ iqamaEnabled: !settings.iqamaEnabled })}
        />
        <Toggle
          icon={icons.bell}
          label="تنبيه قبل الإقامة"
          hint={`إشعار نصّي قبل الإقامة — ${toArabicDigits(settings.iqamaReminderMinutes)} دقائق`}
          on={settings.iqamaReminderEnabled}
          onToggle={() => update({ iqamaReminderEnabled: !settings.iqamaReminderEnabled })}
        />
        <Link
          to="/iqama"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
            <Icon d={icons.speed} size={16} />
          </span>
          <div className="flex-1">
            <div className="text-sm font-medium">صوت الإقامة وموعدها</div>
            <div className="text-[11px] text-muted-foreground">
              الفاصل بين الأذان والإقامة لكل صلاة
            </div>
          </div>
          <span className="rotate-180 text-muted-foreground">
            <Icon d={icons.chevron} size={16} />
          </span>
        </Link>
      </div>

      {/* Sound */}
      <SectionLabel>الصوت والاهتزاز</SectionLabel>
      <div className="space-y-2 px-4">
        <Toggle
          icon={icons.bell}
          label="الصوت"
          hint="تشغيل الأذان والنغمات"
          on={settings.soundEnabled && !settings.silentMode}
          onToggle={() => update({ soundEnabled: !settings.soundEnabled })}
        />
        <Toggle
          icon={icons.sparkle}
          label="الاهتزاز"
          hint="هزّ الجهاز عند التنبيه"
          on={settings.vibrationEnabled}
          onToggle={() => update({ vibrationEnabled: !settings.vibrationEnabled })}
        />
        <Toggle
          icon={icons.bellOff}
          label="الوضع الصامت"
          hint="كتم جميع الأصوات مع إبقاء الإشعارات"
          on={settings.silentMode}
          onToggle={() => update({ silentMode: !settings.silentMode })}
        />

        <VolumeLevelsCard
          settings={settings}
          onConfirm={(levels) => update(levels)}
          onRaisePhoneAlarm={(on) => update({ raisePhoneAlarm: on })}
        />
      </div>

      {/* Reminders */}
      <SectionLabel hint="يمكن اختيار أكثر من توقيت">تذكيرات قبل الصلاة</SectionLabel>
      <div className="px-4">
        <div className="grid grid-cols-4 gap-2">
          {REMINDER_OPTIONS.map((m) => {
            const active = settings.reminderMinutes.includes(m);
            return (
              <button
                key={m}
                onClick={() =>
                  updateDeep((s) => ({
                    ...s,
                    reminderMinutes: active
                      ? s.reminderMinutes.filter((x) => x !== m)
                      : [...s.reminderMinutes, m].sort((a, b) => b - a),
                  }))
                }
                className={`rounded-2xl border py-3 text-center shadow-soft transition ${
                  active
                    ? "border-transparent gradient-primary text-primary-foreground shadow-glow"
                    : "border-border bg-card"
                }`}
              >
                <div className="font-display text-xl tabular-nums">{toArabicDigits(m)}</div>
                <div className="text-[10px] opacity-80">دقيقة</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* صوت التنبيه قبل الصلاة — من حزمة «اقتراب الصلاة» وحدها */}
      <SectionLabel hint="يُسمَع مع كل تذكير قبل الصلاة">صوت التنبيه</SectionLabel>
      <div className="space-y-1.5 px-4">
        {PRAYER_APPROACH_SOUNDS.map((t) => {
          const active = settings.reminderSound === t.id;
          return (
            <div
              key={t.id}
              className={`rounded-2xl border px-3 py-2.5 shadow-soft ${
                active ? "border-primary/50 bg-primary/10" : "border-border bg-card"
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => update({ reminderSound: t.id })}
                  role="radio"
                  aria-checked={active}
                  className="flex min-w-0 flex-1 items-center gap-2 text-right"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      active
                        ? "gradient-primary border-transparent text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {active && <Icon d={icons.check} size={10} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{t.name}</span>
                    <span className="block truncate text-[9px] text-muted-foreground">
                      {t.hint}
                    </span>
                  </span>
                </button>
                {t.url && (
                  <button
                    onClick={() => previewApproach(t.id, t.url, t.name)}
                    aria-label={`تجربة صوت ${t.name}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-primary"
                  >
                    <Icon d={previewing === t.id ? icons.stop : icons.play} size={11} />
                  </button>
                )}
              </div>
              {t.id === "approach-voice" && (
                <div className="mt-2 flex flex-wrap gap-1.5 pr-7">
                  {(Object.keys(PRAYER_APPROACH_CLIPS) as ApproachPrayer[]).map((p) => {
                    const clip = PRAYER_APPROACH_CLIPS[p];
                    const key = `${t.id}:${p}`;
                    return (
                      <button
                        key={p}
                        onClick={() => previewApproach(key, clip.url, clip.name)}
                        aria-label={`تجربة ${clip.name}`}
                        className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
                      >
                        <span className="text-primary">
                          <Icon d={previewing === key ? icons.stop : icons.play} size={9} />
                        </span>
                        {PRAYER_LABELS[p].ar}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Per-prayer */}
      <SectionLabel>التحكم لكل صلاة</SectionLabel>
      <div className="space-y-2 px-4 stagger">
        {PRAYER_ORDER.filter((p) => p !== "sunrise").map((p) => (
          <PerPrayer
            key={p}
            p={p}
            value={settings.perPrayer[p]}
            onChange={(patch) =>
              updateDeep((s) => ({
                ...s,
                perPrayer: { ...s.perPrayer, [p]: { ...s.perPrayer[p], ...patch } },
              }))
            }
          />
        ))}
      </div>

      {/* Fajr quick link */}
      <SectionLabel>الفجر</SectionLabel>
      <div className="px-4">
        <Link
          to="/adhan"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
            <Icon d={icons.sun} size={18} />
          </span>
          <div className="flex-1">
            <div className="text-sm font-medium">أذان الفجر</div>
            <div className="text-[11px] text-muted-foreground">
              {settings.fajrUseSeparate ? fajrAdhan : "نفس أذان باقي الصلوات"}
            </div>
          </div>
          <span className="rotate-180 text-muted-foreground">
            <Icon d={icons.chevron} size={16} />
          </span>
        </Link>
      </div>

      {/* Permission sheet */}
      {showPermSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowPermSheet(false)}
        >
          <div
            className="mx-auto w-full max-w-md rounded-t-[32px] border-t border-border bg-card p-6 shadow-elegant animate-fade-up"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted" />
            <div className="flex items-center gap-3">
              <span className="gradient-primary flex h-12 w-12 items-center justify-center rounded-2xl text-primary-foreground shadow-glow">
                <Icon d={icons.bell} size={22} />
              </span>
              <div>
                <div className="font-display text-lg">السماح بالتنبيهات</div>
                <div className="text-[11px] text-muted-foreground">
                  حتى تصلك أوقات الصلاة في وقتها
                </div>
              </div>
            </div>
            <ul className="my-4 space-y-2 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1 text-primary">
                  <Icon d={icons.check} size={14} />
                </span>{" "}
                تنبيه عند كل صلاة بصوت الأذان المختار
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-primary">
                  <Icon d={icons.check} size={14} />
                </span>{" "}
                تذكير قبل الصلاة بالوقت الذي تختاره
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-primary">
                  <Icon d={icons.check} size={14} />
                </span>{" "}
                إشعار الإقامة بعد الأذان بالدقائق المحددة
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-primary">
                  <Icon d={icons.check} size={14} />
                </span>{" "}
                يعمل بدون اتصال بالإنترنت
              </li>
            </ul>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPermSheet(false)}
                className="flex-1 rounded-2xl border border-border bg-card py-3 text-sm"
              >
                لاحقاً
              </button>
              <button
                onClick={ask}
                className="flex-1 rounded-2xl gradient-primary py-3 text-sm font-medium text-primary-foreground shadow-glow"
              >
                السماح
              </button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

function Toggle({
  icon,
  label,
  hint,
  on,
  onToggle,
}: {
  icon: string;
  label: string;
  hint?: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-right shadow-soft"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon d={icon} size={16} />
      </span>
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <span
        className={`relative h-6 w-11 rounded-full transition ${on ? "gradient-primary" : "bg-muted"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-all ${on ? "right-0.5" : "right-[22px]"}`}
        />
      </span>
    </button>
  );
}

function PerPrayer({
  p,
  value,
  onChange,
}: {
  p: PrayerKey;
  value: { adhan: boolean; reminder: boolean; iqama: boolean };
  onChange: (patch: Partial<{ adhan: boolean; reminder: boolean; iqama: boolean }>) => void;
}) {
  const Chip = ({ k, l }: { k: keyof typeof value; l: string }) => (
    <button
      onClick={() => onChange({ [k]: !value[k] })}
      className={`rounded-full px-3 py-1 text-[11px] transition ${
        value[k]
          ? "gradient-primary text-primary-foreground shadow-glow"
          : "border border-border bg-card text-muted-foreground"
      }`}
    >
      {l}
    </button>
  );
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
          <Icon d={icons.prayer} size={16} />
        </span>
        <div>
          <div className="text-sm font-medium">{PRAYER_LABELS[p].ar}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {PRAYER_LABELS[p].en}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-1.5">
        <Chip k="adhan" l="أذان" />
        <Chip k="reminder" l="تذكير" />
        <Chip k="iqama" l="إقامة" />
      </div>
    </div>
  );
}
