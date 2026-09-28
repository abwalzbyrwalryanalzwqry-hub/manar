import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";
import {
  CUSTOM_TEMPLATES,
  MAX_CUSTOM_REMINDERS,
  WEEKDAY_ORDER,
  WEEKDAY_SHORT,
  describeTiming,
  from12h,
  offsetOptionsFor,
  reminderTimeOn,
  stepClock,
  suggestedToneFor,
  switchTimingMode,
  timingWarning,
  to12h,
  toneName,
  toneUrl,
  useDailyReminders,
  type CustomTemplateId,
  type DailyReminder,
  type ReminderToneId,
  type Weekday,
  COMPLETION_HINTS,
  completionKeyFor,
  toneOptionsFor,
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
import { effectiveVolume, getAdhanSettings } from "@/lib/adhan-settings";
import { isNativeShell, testDailyReminderNow } from "@/lib/native-notifications";

export const Route = createFileRoute("/reminders")({
  /* المحتوى كله أوقات وتواريخ بتوقيت الجهاز، والخادم لا يعرف منطقة المستخدم
   * الزمنية، فرسمه على الخادم يعطي نصاً مختلفاً ويكسر الـHydration. */
  ssr: false,
  head: () => ({ meta: [{ title: "تذكيرات الأذكار والوِرد — منار" }] }),
  component: Reminders,
});

/* الصلوات التي يُنسب إليها تذكير — الشروق مشمول لورد الضحى. */
const ANCHORS = PRAYER_ORDER;

function Reminders() {
  const { state, setEnabled, patch, toggleDay, reset, addCustom, remove } = useDailyReminders();
  const { location } = useLocation();
  const { settings } = useSettings();
  const [openId, setOpenId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<ReminderToneId | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTemplate, setNewTemplate] = useState<CustomTemplateId>("after-prayer");
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
      volume: effectiveVolume(getAdhanSettings(), "reminder"),
      usage: "notification",
      onEnd: () => setPreviewing((cur) => (cur === id ? null : cur)),
      onError: () => setPreviewing((cur) => (cur === id ? null : cur)),
      label: `نداء ${toneName(id)}`,
    });
  };

  /* مواقيت اليوم — لاشتقاق الساعة عند تبديل نوع التوقيت، ولتحذير التوقيت. */
  const todayTimes = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return computePrayerTimes(location, settings, d);
  }, [location, settings]);

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

  /* موعد التذكير اليوم (بغضّ النظر عن أيامه) — لتحذير التوقيت غير المنطقي. */
  const warningFor = (r: DailyReminder): string | null => {
    const at = reminderTimeOn(
      { ...r, days: [0, 1, 2, 3, 4, 5, 6] },
      todayTimes.dhuhr,
      (p) => todayTimes[p],
    );
    return at ? timingWarning(r, at, todayTimes) : null;
  };

  const testNow = async (r: DailyReminder) => {
    if (isNativeShell()) {
      const ok = await testDailyReminderNow(r);
      if (ok) toast.success("سيصل تنبيه تجريبي خلال ثانيتين بالصوت والقناة الفعليين");
      else toast.error("تعذّر إرسال التنبيه — تحقّق من إذن الإشعارات");
      return;
    }
    // على الويب لا إشعارات أصلية: نُسمع الصوت الفعلي ونعرض نصّ الإشعار.
    if (toneUrl(r.tone)) preview(r.tone);
    toast(r.name, { description: r.body });
  };

  const confirmReset = () => {
    if (
      !window.confirm(
        "استعادة أوقات التذكيرات الخمسة وأصواتها وأيامها الافتراضية؟ التذكيرات التي أضفتها تبقى.",
      )
    )
      return;
    reset();
    toast.success("استُعيدت القيم الافتراضية");
  };

  const submitNew = () => {
    const item = addCustom(newTemplate, newName);
    if (!item) {
      toast.error(`الحد الأقصى ${toArabicDigits(MAX_CUSTOM_REMINDERS)} تذكيرات مضافة`);
      return;
    }
    setAdding(false);
    setNewName("");
    setOpenId(item.id);
  };

  const confirmRemove = (r: DailyReminder) => {
    if (!window.confirm(`حذف تذكير «${r.name}»؟`)) return;
    remove(r.id);
    if (openId === r.id) setOpenId(null);
  };

  const activeCount = state.items.filter((r) => r.enabled).length;
  const customCount = state.items.filter((r) => r.custom).length;

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
          const live = r.enabled && state.enabled;
          const at = live ? nextRun(r) : null;
          const open = openId === r.id;
          const warning = warningFor(r);
          const suggested = suggestedToneFor(r);
          const tones = toneOptionsFor(r);
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
                  <Switch on={live} />
                </button>

                <button
                  onClick={() => setOpenId(open ? null : r.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-right"
                  aria-expanded={open}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                      {describeTiming(r.timing, toArabicDigits)} · {toneName(r.tone)}
                      {r.days.length < 7 && ` · ${toArabicDigits(r.days.length)} أيام`}
                      {!live && " · مطفأ"}
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
                  {!live && (
                    <div
                      role="status"
                      className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[10px] text-muted-foreground"
                    >
                      <span>
                        {state.enabled
                          ? "هذا التذكير مطفأ — تعديلاته تُحفظ وتعمل عند تشغيله."
                          : "كل التذكيرات مطفأة — تعديلاته تُحفظ وتعمل عند تشغيلها."}
                      </span>
                      <button
                        onClick={() =>
                          state.enabled ? patch(r.id, { enabled: true }) : setEnabled(true)
                        }
                        className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-medium text-primary"
                      >
                        تشغيل
                      </button>
                    </div>
                  )}

                  {/* ------------ التوقيت ------------ */}
                  <div>
                    <Label>التوقيت</Label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Chip
                        label="منسوب لصلاة"
                        hint="يتحرّك مع المواقيت"
                        active={r.timing.mode === "prayer"}
                        onClick={() => patch(r.id, switchTimingMode(r, "prayer", todayTimes))}
                      />
                      <Chip
                        label="ساعة ثابتة"
                        hint="نفس الوقت يومياً"
                        active={r.timing.mode === "clock"}
                        onClick={() => patch(r.id, switchTimingMode(r, "clock", todayTimes))}
                      />
                    </div>

                    {r.timing.mode === "prayer" ? (
                      <>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {ANCHORS.map((p) => (
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
                          {offsetOptionsFor(r.timing.offset).map((o) => (
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
                      <ClockPicker
                        hour={r.timing.hour}
                        minute={r.timing.minute}
                        onChange={(hour, minute) =>
                          patch(r.id, { timing: { mode: "clock", hour, minute } })
                        }
                      />
                    )}
                    {warning && (
                      <div
                        role="status"
                        className="mt-2 rounded-xl border border-border bg-card px-3 py-2 text-[10px] leading-relaxed text-muted-foreground"
                      >
                        {warning}
                      </div>
                    )}
                  </div>

                  {/* ------------ الصوت ------------ */}
                  <div>
                    <Label>الصوت</Label>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                      نداءات صوتية تناسب التذكير، والمقترح هو الافتراضي.
                    </p>
                    <div className="mt-2 space-y-1.5" role="radiogroup" aria-label="صوت التذكير">
                      {tones.map((t) => (
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
                            role="radio"
                            aria-checked={r.tone === t.id}
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
                              <span className="block truncate text-xs font-medium">
                                {t.name}
                                {t.id === suggested && (
                                  <span className="ms-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                                    مقترح
                                  </span>
                                )}
                              </span>
                              <span className="block truncate text-[9px] text-muted-foreground">
                                {t.hint}
                              </span>
                            </span>
                          </button>
                          {t.url && (
                            <button
                              onClick={() => preview(t.id)}
                              aria-label={`تجربة ${t.name}`}
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

                  {/* ------------ تخطّي ما أُنجز ------------ */}
                  {r.skipIfDone !== undefined && completionKeyFor(r) && (
                    <button
                      onClick={() => patch(r.id, { skipIfDone: !r.skipIfDone })}
                      role="switch"
                      aria-checked={r.skipIfDone}
                      className="flex w-full items-center justify-between gap-3 text-right"
                    >
                      <span className="min-w-0">
                        <span className="block text-[11px] font-medium">تخطّي إذا أُنجز</span>
                        <span className="block text-[9px] text-muted-foreground">
                          {COMPLETION_HINTS[completionKeyFor(r)!]}
                        </span>
                      </span>
                      <Switch on={!!r.skipIfDone} />
                    </button>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => void testNow(r)}
                      className="flex-1 rounded-xl border border-primary/30 bg-primary/10 py-2 text-[11px] font-medium text-primary"
                    >
                      تجربة التنبيه الآن
                    </button>
                    {r.custom && (
                      <button
                        onClick={() => confirmRemove(r)}
                        className="rounded-xl border border-border bg-card px-4 py-2 text-[11px] font-medium text-destructive"
                      >
                        حذف
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {adding ? (
          <div className="space-y-3 rounded-2xl border border-primary/40 bg-card p-4 shadow-soft">
            <Label>تذكير جديد</Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(CUSTOM_TEMPLATES) as CustomTemplateId[]).map((t) => (
                <MiniChip
                  key={t}
                  label={CUSTOM_TEMPLATES[t].name}
                  active={newTemplate === t}
                  onClick={() => setNewTemplate(t)}
                />
              ))}
            </div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={40}
              placeholder={`الاسم (اختياري): ${CUSTOM_TEMPLATES[newTemplate].name}`}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs"
              dir="rtl"
            />
            <div className="flex gap-2">
              <button
                onClick={submitNew}
                className="flex-1 rounded-xl gradient-primary py-2 text-[11px] font-medium text-primary-foreground"
              >
                إضافة
              </button>
              <button
                onClick={() => setAdding(false)}
                className="rounded-xl border border-border bg-card px-4 py-2 text-[11px]"
              >
                إلغاء
              </button>
            </div>
          </div>
        ) : (
          customCount < MAX_CUSTOM_REMINDERS && (
            <button
              onClick={() => setAdding(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card py-3 text-sm text-primary shadow-soft"
            >
              <Icon d={icons.plus} size={14} />
              إضافة تذكير
            </button>
          )
        )}
      </div>

      <div className="mt-5 px-5">
        <button
          onClick={confirmReset}
          className="w-full rounded-2xl border border-border bg-card py-3 text-sm shadow-soft"
        >
          استعادة القيم الافتراضية
        </button>
      </div>

      <div className="mt-3 px-5 pb-2">
        <p className="rounded-2xl border border-border bg-secondary/30 p-4 text-[10px] leading-relaxed text-muted-foreground">
          النداءات الصوتية تسجيلات مضمّنة في التطبيق وتعمل دون إنترنت، ولكل تذكير نداؤه المقترح
          افتراضياً. والتذكيرات المنسوبة إلى صلاة تتحرّك مع المواقيت يومياً، فلا تحتاج تعديلاً كل
          موسم.
        </p>
      </div>
    </Screen>
  );
}

/* محدِّد الساعة الثابتة بنظام ١٢ ساعة (كالوصف فوقه) مع ص/م، والدقائق تنقل
 * الساعة عند تجاوز ٥٥ أو النزول تحت ٠٠. */
function ClockPicker({
  hour,
  minute,
  onChange,
}: {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}) {
  const { h12, pm } = to12h(hour);
  const stepMin = (delta: number) => {
    const n = stepClock(hour, minute, delta);
    onChange(n.hour, n.minute);
  };
  return (
    <div className="mt-3 flex items-center justify-center gap-3">
      <Stepper
        label="الدقيقة"
        display={String(minute).padStart(2, "0")}
        onInc={() => stepMin(5)}
        onDec={() => stepMin(-5)}
      />
      <span className="pt-4 text-muted-foreground">:</span>
      <Stepper
        label="الساعة"
        display={String(h12)}
        onInc={() => onChange((hour + 1) % 24, minute)}
        onDec={() => onChange((hour + 23) % 24, minute)}
      />
      <div className="flex flex-col gap-1 pt-4">
        {([false, true] as const).map((isPm) => (
          <button
            key={String(isPm)}
            onClick={() => onChange(from12h(h12, isPm), minute)}
            aria-pressed={pm === isPm}
            className={`rounded-lg border px-2.5 py-1 text-[10px] font-medium transition ${
              pm === isPm
                ? "gradient-primary border-transparent text-primary-foreground"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {isPm ? "مساءً" : "صباحاً"}
          </button>
        ))}
      </div>
    </div>
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
  display,
  onInc,
  onDec,
}: {
  label: string;
  display: string;
  onInc: () => void;
  onDec: () => void;
}) {
  return (
    <div className="text-center">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className="mt-1 flex flex-col items-center gap-1">
        <button
          onClick={onInc}
          aria-label={`زيادة ${label}`}
          className="flex h-7 w-12 items-center justify-center rounded-lg border border-border bg-card"
        >
          <Icon d={icons.plus} size={12} />
        </button>
        <span className="font-display text-lg tabular-nums">{toArabicDigits(display)}</span>
        <button
          onClick={onDec}
          aria-label={`إنقاص ${label}`}
          className="flex h-7 w-12 items-center justify-center rounded-lg border border-border bg-card"
        >
          <Icon d={icons.minus} size={12} />
        </button>
      </div>
    </div>
  );
}
