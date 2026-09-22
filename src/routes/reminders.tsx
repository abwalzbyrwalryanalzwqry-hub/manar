import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";
import {
  REMINDER_TONES,
  WEEKDAY_ORDER,
  WEEKDAY_SHORT,
  describeTiming,
  reminderTimeOn,
  toneName,
  toneUrl,
  useDailyReminders,
  type DailyReminder,
  type ReminderToneId,
  type Weekday,
} from "@/lib/daily-reminders";
import {
  PRAYER_LABELS,
  PRAYER_ORDER,
  computePrayerTimes,
  useLocation,
  useSettings,
} from "@/lib/prayer";
import { ampmAr, formatHHMM, toArabicDigits } from "@/lib/format";
import { play, stop } from "@/lib/audio-engine";
import { isNativeShell } from "@/lib/native-notifications";

export const Route = createFileRoute("/reminders")({
  head: () => ({ meta: [{ title: "تذكيرات الأذكار والوِرد — منار" }] }),
  component: Reminders,
});

/** خيارات الإزاحة المنسوبة لصلاة — بالدقائق. */
const OFFSETS = [-30, -15, 0, 15, 30, 45, 60, 90, 120];

function Reminders() {
  const { state, setEnabled, patch, toggleDay } = useDailyReminders();
  const { location } = useLocation();
  const { settings } = useSettings();
  const [openId, setOpenId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<ReminderToneId | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  /* إيقاف أي معاينة عند مغادرة الشاشة — وإلا استمرّ الصوت بعد الخروج. */
  useEffect(
    () => () => {
      stopRef.current?.();
      stop();
    },
    [],
  );

  /* لا نُرسل «إيقاف» قبل كل معاينة: `play` يُوقف الصوت السابق بنفسه،
   * والخدمة الأصلية تُحرّر مشغّلها قبل أي تشغيل جديد. الإيقاف المسبق كان
   * يُسابق طلب التشغيل في أندرويد فيُنهي التطبيق (انظر AdhanService). */
  const preview = (id: ReminderToneId) => {
    const url = toneUrl(id);
    if (!url || previewing === id) {
      stopRef.current?.();
      stopRef.current = null;
      setPreviewing(null);
      return;
    }
    /* على الويب نُسكت عنصر <audio> السابق بمُوقفه هو، حتى لا يُطلق حدث خطأ
     * كاذباً عند تفريغه. داخل أندرويد مُوقفه طلب «إيقاف» للخدمة — وهو المسبّب. */
    if (!isNativeShell()) stopRef.current?.();
    setPreviewing(id);
    stopRef.current = play(url, {
      onEnd: () => setPreviewing((cur) => (cur === id ? null : cur)),
      onError: () => setPreviewing((cur) => (cur === id ? null : cur)),
      label: `نغمة ${toneName(id)}`,
    });
  };

  /* الوقت الفعلي لأول عمل قادم لكل تذكير: هو ما يُطمئن المستخدم أن إعداده صار
   * وقتاً حقيقياً، لا مجرّد وصف. نبحث سبعة أيام لأن التذكير قد يُستثنى من أيام. */
  const nextRun = (r: DailyReminder): Date | null => {
    const now = new Date();
    for (let d = 0; d < 8; d++) {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() + d);
      const times = computePrayerTimes(location, settings, date);
      const at = reminderTimeOn(r, date, (p) => times[p]);
      if (at && at.getTime() > now.getTime()) return at;
    }
    return null;
  };

  const activeCount = state.items.filter((r) => r.enabled).length;

  return (
    <Screen>
      <ScreenHeader
        title="تذكيرات الأذكار والوِرد"
        subtitle={`${toArabicDigits(activeCount)} من ${toArabicDigits(state.items.length)} مُفعَّل`}
        backTo="/more"
      />

      <div className="px-5">
        <button
          onClick={() => setEnabled(!state.enabled)}
          role="switch"
          aria-checked={state.enabled}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-right shadow-soft"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Icon d={state.enabled ? icons.bell : icons.bellOff} size={16} />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-medium">تذكيرات الأذكار والوِرد</span>
            <span className="block text-[10px] text-muted-foreground">
              {state.enabled ? "تعمل حسب إعداد كل تذكير" : "كلها صامتة — الإعدادات محفوظة"}
            </span>
          </span>
          <Switch on={state.enabled} />
        </button>
      </div>

      <SectionLabel hint="اضغط أي تذكير لتعديل وقته وصوته وأيامه">التذكيرات</SectionLabel>

      <div className="space-y-2 px-5">
        {state.items.map((r) => {
          const at = r.enabled && state.enabled ? nextRun(r) : null;
          const open = openId === r.id;
          return (
            <div
              key={r.id}
              className={`overflow-hidden rounded-2xl border bg-card shadow-soft transition ${
                open ? "border-primary/40" : "border-border"
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3.5">
                <button
                  onClick={() => patch(r.id, { enabled: !r.enabled })}
                  role="switch"
                  aria-checked={r.enabled}
                  aria-label={`تشغيل ${r.name}`}
                  className="shrink-0"
                  disabled={!state.enabled}
                >
                  <Switch on={r.enabled && state.enabled} />
                </button>

                <button
                  onClick={() => setOpenId(open ? null : r.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-right"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                      {describeTiming(r.timing, toArabicDigits)} · {toneName(r.tone)}
                      {r.days.length < 7 && ` · ${toArabicDigits(r.days.length)} أيام`}
                    </span>
                  </span>
                  {at && (
                    <span className="shrink-0 text-left">
                      <span className="block font-display text-xs tabular-nums">
                        {formatHHMM(at)}
                      </span>
                      <span className="block text-[9px] text-muted-foreground">{ampmAr(at)}</span>
                    </span>
                  )}
                  <span
                    className={`shrink-0 text-muted-foreground transition ${open ? "-rotate-90" : "rotate-180"}`}
                  >
                    <Icon d={icons.chevron} size={14} />
                  </span>
                </button>
              </div>

              {open && (
                <div className="space-y-4 border-t border-border bg-secondary/20 px-4 py-4">
                  {/* ------------ التوقيت ------------ */}
                  <div>
                    <Label>التوقيت</Label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Chip
                        label="منسوب لصلاة"
                        hint="يتحرّك مع المواقيت"
                        active={r.timing.mode === "prayer"}
                        onClick={() =>
                          patch(r.id, { timing: { mode: "prayer", prayer: "fajr", offset: 30 } })
                        }
                      />
                      <Chip
                        label="ساعة ثابتة"
                        hint="نفس الوقت يومياً"
                        active={r.timing.mode === "clock"}
                        onClick={() =>
                          patch(r.id, { timing: { mode: "clock", hour: 6, minute: 0 } })
                        }
                      />
                    </div>

                    {r.timing.mode === "prayer" ? (
                      <>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {PRAYER_ORDER.filter((p) => p !== "sunrise").map((p) => (
                            <MiniChip
                              key={p}
                              label={PRAYER_LABELS[p].ar}
                              active={r.timing.mode === "prayer" && r.timing.prayer === p}
                              onClick={() =>
                                patch(r.id, {
                                  timing: {
                                    mode: "prayer",
                                    prayer: p,
                                    offset: r.timing.mode === "prayer" ? r.timing.offset : 30,
                                  },
                                })
                              }
                            />
                          ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {OFFSETS.map((o) => (
                            <MiniChip
                              key={o}
                              label={
                                o === 0
                                  ? "مع الأذان"
                                  : `${o > 0 ? "بعد" : "قبل"} ${toArabicDigits(Math.abs(o))}د`
                              }
                              active={r.timing.mode === "prayer" && r.timing.offset === o}
                              onClick={() =>
                                patch(r.id, {
                                  timing: {
                                    mode: "prayer",
                                    prayer: r.timing.mode === "prayer" ? r.timing.prayer : "fajr",
                                    offset: o,
                                  },
                                })
                              }
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="mt-3 flex items-center justify-center gap-3">
                        <Stepper
                          label="الدقيقة"
                          value={r.timing.minute}
                          onChange={(v) =>
                            patch(r.id, {
                              timing: {
                                mode: "clock",
                                hour: r.timing.mode === "clock" ? r.timing.hour : 6,
                                minute: (v + 60) % 60,
                              },
                            })
                          }
                          step={5}
                        />
                        <span className="pt-4 text-muted-foreground">:</span>
                        <Stepper
                          label="الساعة"
                          value={r.timing.hour}
                          onChange={(v) =>
                            patch(r.id, {
                              timing: {
                                mode: "clock",
                                hour: (v + 24) % 24,
                                minute: r.timing.mode === "clock" ? r.timing.minute : 0,
                              },
                            })
                          }
                          step={1}
                        />
                      </div>
                    )}
                  </div>

                  {/* ------------ الصوت ------------ */}
                  <div>
                    <Label>الصوت</Label>
                    <div className="mt-2 space-y-1.5">
                      {REMINDER_TONES.map((t) => (
                        <div
                          key={t.id}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                            r.tone === t.id
                              ? "border-primary/50 bg-primary/10"
                              : "border-border bg-card"
                          }`}
                        >
                          <button
                            onClick={() => patch(r.id, { tone: t.id })}
                            className="flex min-w-0 flex-1 items-center gap-2 text-right"
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                r.tone === t.id
                                  ? "gradient-primary border-transparent text-primary-foreground"
                                  : "border-border"
                              }`}
                            >
                              {r.tone === t.id && <Icon d={icons.check} size={10} />}
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
                              onClick={() => preview(t.id)}
                              aria-label={`تجربة نغمة ${t.name}`}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-primary"
                            >
                              <Icon d={previewing === t.id ? icons.stop : icons.play} size={11} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ------------ الأيام ------------ */}
                  <div>
                    <Label>الأيام</Label>
                    {/* شبكة من سبعة أعمدة لا صفّ يلتفّ: الأسبوع يُقرأ كوحدة
                        واحدة، ولو التفّ يومٌ إلى سطر جديد بدا مستقلاً عن بقيته. */}
                    <div className="mt-2 grid grid-cols-7 gap-1">
                      {WEEKDAY_ORDER.map((d) => (
                        <DayChip
                          key={d}
                          label={WEEKDAY_SHORT[d]}
                          active={r.days.includes(d as Weekday)}
                          onClick={() => toggleDay(r.id, d as Weekday)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 px-5 pb-2">
        <p className="rounded-2xl border border-border bg-secondary/30 p-4 text-[10px] leading-relaxed text-muted-foreground">
          كل النغمات في منار مُركَّبة داخل التطبيق نفسه، فلا تحمل أي حقوق لطرف آخر. والتذكيرات
          المنسوبة إلى صلاة تتحرّك مع المواقيت يومياً، فلا تحتاج تعديلاً كل موسم.
        </p>
      </div>
    </Screen>
  );
}

/* ----------------------------- عناصر ----------------------------- */

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={`relative block h-6 w-11 rounded-full transition ${on ? "gradient-primary" : "bg-muted"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-all ${
          on ? "right-0.5" : "right-[22px]"
        }`}
      />
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-medium text-muted-foreground">{children}</div>;
}

function Chip({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-right transition ${
        active
          ? "gradient-primary border-transparent text-primary-foreground shadow-glow"
          : "border-border bg-card"
      }`}
    >
      <span className="block text-[11px] font-medium">{label}</span>
      <span className={`block text-[9px] ${active ? "opacity-80" : "text-muted-foreground"}`}>
        {hint}
      </span>
    </button>
  );
}

function MiniChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1.5 text-[10px] font-medium transition ${
        active
          ? "gradient-primary border-transparent text-primary-foreground"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function DayChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border py-1.5 text-center text-[9px] font-medium transition ${
        active
          ? "gradient-primary border-transparent text-primary-foreground"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function Stepper({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step: number;
}) {
  return (
    <div className="text-center">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className="mt-1 flex flex-col items-center gap-1">
        <button
          onClick={() => onChange(value + step)}
          aria-label={`زيادة ${label}`}
          className="flex h-7 w-12 items-center justify-center rounded-lg border border-border bg-card"
        >
          <Icon d={icons.plus} size={12} />
        </button>
        <span className="font-display text-lg tabular-nums">
          {toArabicDigits(String(value).padStart(2, "0"))}
        </span>
        <button
          onClick={() => onChange(value - step)}
          aria-label={`إنقاص ${label}`}
          className="flex h-7 w-12 items-center justify-center rounded-lg border border-border bg-card"
        >
          <Icon d={icons.minus} size={12} />
        </button>
      </div>
    </div>
  );
}
