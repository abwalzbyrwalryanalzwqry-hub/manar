import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Arabesque,
  EmptyState,
  Icon,
  icons,
  RingProgress,
  Screen,
  ScreenHeader,
  SectionLabel,
} from "@/components/manar/shell";
import {
  FARD_PRAYERS,
  dayKey,
  monthBars,
  monthHeatmap,
  rangeStats,
  setDayPrayers,
  shiftDayKey,
  useActivityLog,
  type Achievement,
  type DayBar,
  type HeatCell,
} from "@/lib/activity-log";
import { PRAYER_LABELS, type PrayerKey } from "@/lib/prayer";
import { formatPercent, formatWeekdayAr, toArabicDigits } from "@/lib/format";
import { GREGORIAN_MONTHS, WEEKDAY_LABELS } from "@/lib/hijri";
import { useMemo, useState } from "react";
import { QuranSummary } from "@/components/manar/stats-quran-summary";
import { QadaCard } from "@/components/manar/qada-card";

export const Route = createFileRoute("/statistics")({
  /* «اليوم» والشهر الحالي بتوقيت الجهاز (انظر ssr-time-routes). */
  ssr: false,
  head: () => ({ meta: [{ title: "الإحصائيات — منار" }] }),
  component: Statistics,
});

function pct(ratio: number): number {
  return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
}

/** «يوم / يومين / يوماً» — العربية تعدّ المثنى صيغة مستقلة. */
function dayWord(n: number): string {
  if (n === 1) return "يوم";
  if (n === 2) return "يومين";
  return "يوماً";
}

function Statistics() {
  const { log, hydrated, today, streak, bestStreak, week, prevWeek, month, bars, achievements } =
    useActivityLog();

  const hasAnyData = Object.keys(log.days).length > 0;
  const weekDelta = pct(week.prayerRatio) - pct(prevWeek.prayerRatio);
  const unlocked = achievements.filter((a) => a.value >= a.goal).length;

  return (
    <Screen>
      <ScreenHeader title="الإحصائيات" subtitle="تقدمك في رحلتك الإيمانية" backTo="/more" />

      {/* بطاقة السلسلة */}
      <div className="px-4 animate-fade-up">
        <div className="gradient-hero relative overflow-hidden rounded-[32px] p-6 text-white shadow-elegant">
          <Arabesque className="absolute -right-10 -top-10 h-60 w-60 text-white/15" />
          <div className="grain-overlay absolute inset-0" />
          <div className="relative flex items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/60">
                <Icon d={icons.flame} size={12} /> سلسلة
              </div>
              <div className="mt-2 font-display text-6xl font-black tabular-nums leading-none">
                {toArabicDigits(streak)}
              </div>
              <div className="mt-1 text-xs font-light text-white/80">
                {dayWord(streak)} {streak === 1 ? "متصل" : "متتالية"}
              </div>
              {bestStreak > 0 && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold/90 px-2.5 py-0.5 text-[10px] font-medium text-navy">
                  <Icon d={icons.trend} size={10} />
                  {streak >= bestStreak
                    ? "أعلى رقم لك"
                    : `أفضل سلسلة ${toArabicDigits(bestStreak)} ${dayWord(bestStreak)}`}
                </div>
              )}
            </div>
            <RingProgress value={month.prayerRatio} size={104} stroke={4}>
              <div className="text-center">
                <div className="font-display text-2xl font-black tabular-nums">
                  {formatPercent(pct(month.prayerRatio))}
                </div>
                <div className="text-[9px] uppercase tracking-widest text-white/60">٣٠ يوماً</div>
              </div>
            </RingProgress>
          </div>
        </div>
      </div>

      {!hydrated ? null : !hasAnyData ? (
        <div className="px-4 pt-8">
          <EmptyState
            icon={icons.stats}
            title="لا توجد بيانات بعد"
            hint="سجّل صلواتك من شاشة أوقات الصلاة، واقرأ وردك وأذكارك — وستظهر إحصائياتك هنا يوماً بيوم."
          />
          <Link
            to="/prayer"
            className="gradient-primary mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium text-primary-foreground shadow-glow"
          >
            <Icon d={icons.prayer} size={16} /> ابدأ بتسجيل صلوات اليوم
          </Link>
        </div>
      ) : (
        <>
          {/* صلوات اليوم */}
          <SectionLabel
            hint={`${toArabicDigits(today.prayers.length)} من ${toArabicDigits(FARD_PRAYERS.length)}`}
          >
            صلوات اليوم
          </SectionLabel>
          <div className="px-4">
            <div className="flex gap-2">
              {FARD_PRAYERS.map((p) => {
                const done = today.prayers.includes(p);
                return (
                  <div
                    key={p}
                    className={`flex-1 rounded-2xl border p-3 text-center shadow-soft transition ${
                      done
                        ? "border-transparent gradient-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    <div className="flex justify-center">
                      <Icon d={done ? icons.check : icons.prayer} size={14} />
                    </div>
                    <div className="mt-1.5 text-[10px] font-medium">{PRAYER_LABELS[p].ar}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <RangeSection log={log} bars={bars} weekDelta={weekDelta} />

          {/* الإنجازات */}
          <SectionLabel hint={`${toArabicDigits(unlocked)} مفتوحة`}>الإنجازات</SectionLabel>
          <div className="space-y-2 px-4 stagger">
            {achievements.map((a) => (
              <AchievementRow key={a.id} achievement={a} />
            ))}
          </div>
          <QuranSummary />
        </>
      )}

      {hydrated && <QadaCard />}
    </Screen>
  );
}

function WeekBar({ bar }: { bar: DayBar }) {
  const active = bar.record.prayers.length > 0;
  return (
    /* h-full على العمود ضروري: الحاوية `items-end` تُقلّص الأعمدة إلى ارتفاع
       محتواها، فيصبح `h-full` بالداخل صفراً وتختفي الأعمدة. */
    <div className="flex h-full flex-1 flex-col items-center gap-2">
      <div className="relative flex w-full flex-1 items-end">
        <div
          className={`w-full rounded-t-xl transition-all duration-500 ${
            bar.isToday ? "gradient-gold" : active ? "gradient-primary" : "bg-muted"
          }`}
          /* أدنى ارتفاع مرئي حتى لا يختفي اليوم الفارغ تماماً من الرسم. */
          style={{ height: `${Math.max(4, bar.ratio * 100)}%` }}
        />
      </div>
      <span
        className={`text-[10px] ${bar.isToday ? "font-medium text-foreground" : "text-muted-foreground"}`}
      >
        {bar.label}
      </span>
    </div>
  );
}

function AchievementRow({ achievement: a }: { achievement: Achievement }) {
  const done = a.value >= a.goal;
  const ratio = a.goal ? Math.min(1, a.value / a.goal) : 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              done ? "gradient-gold text-navy shadow-gold" : "bg-secondary text-primary"
            }`}
          >
            <Icon d={done ? icons.check : icons.star} size={18} />
          </span>
          <div>
            <div className="text-sm font-medium">{a.title}</div>
            <div className="text-[10px] text-muted-foreground">{a.hint}</div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs font-medium tabular-nums text-primary">
            {formatPercent(pct(ratio))}
          </div>
          <div className="text-[9px] text-muted-foreground tabular-nums">
            {toArabicDigits(Math.min(a.value, a.goal))} / {toArabicDigits(a.goal)}
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all duration-500 ${done ? "gradient-gold" : "gradient-primary"}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-20 blur-2xl ${tone ?? "bg-primary"}`}
      />
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon d={icon} size={16} />
      </span>
      <div className="relative mt-3 font-display text-3xl font-black tabular-nums">{value}</div>
      <div className="relative text-xs font-medium">{label}</div>
      <div className="relative mt-0.5 text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  أسبوع / شهر / سنة                                                  */
/* ------------------------------------------------------------------ */

type Range = "week" | "month" | "year";
const RANGE_DAYS: Record<Range, number> = { week: 7, month: 30, year: 365 };
const RANGE_HINT: Record<Range, string> = {
  week: "آخر ٧ أيام",
  month: "آخر ٣٠ يوماً",
  year: "آخر ٣٦٥ يوماً",
};

function RangeSection({
  log,
  bars,
  weekDelta,
}: {
  log: ReturnType<typeof useActivityLog>["log"];
  bars: DayBar[];
  weekDelta: number;
}) {
  const [range, setRange] = useState<Range>("week");
  const todayKey = dayKey();
  const stats = useMemo(() => rangeStats(log, RANGE_DAYS[range], todayKey), [log, range, todayKey]);
  const [ty, tm] = todayKey.split("-").map(Number);
  const [cursor, setCursor] = useState({ year: ty, month: tm });
  const [editKey, setEditKey] = useState<string | null>(null);
  const cells = useMemo(
    () => monthHeatmap(log, cursor.year, cursor.month, todayKey),
    [log, cursor, todayKey],
  );
  const months = useMemo(() => monthBars(log, 12, todayKey), [log, todayKey]);
  const atCurrent = cursor.year === ty && cursor.month === tm;
  const oldest = shiftDayKey(todayKey, -729).slice(0, 7);
  const cursorKey = `${cursor.year}-${String(cursor.month).padStart(2, "0")}`;
  const step = (delta: number) => {
    const total = cursor.year * 12 + (cursor.month - 1) + delta;
    setCursor({ year: Math.floor(total / 12), month: (total % 12) + 1 });
  };

  return (
    <>
      <div className="px-4 pt-6">
        <div
          className="flex items-center gap-2 rounded-2xl border border-border bg-card p-1 shadow-soft"
          role="tablist"
          aria-label="المدى"
        >
          {(
            [
              { k: "week", l: "أسبوع" },
              { k: "month", l: "شهر" },
              { k: "year", l: "سنة" },
            ] as { k: Range; l: string }[]
          ).map((t) => (
            <button
              key={t.k}
              type="button"
              role="tab"
              aria-selected={range === t.k}
              onClick={() => setRange(t.k)}
              className={`flex-1 rounded-xl py-2 text-xs font-medium transition ${
                range === t.k
                  ? "gradient-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground"
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      <SectionLabel hint={range === "month" ? "اضغط يوماً لتعديل صلواته" : RANGE_HINT[range]}>
        {range === "week" ? "نشاط الأسبوع" : range === "month" ? "خريطة الشهر" : "نشاط السنة"}
      </SectionLabel>
      <div className="px-4">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          {range === "week" && (
            <div className="flex h-36 items-end justify-between gap-2">
              {bars.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  className="flex h-full flex-1"
                  onClick={() => setEditKey(b.key)}
                  aria-label={`تعديل صلوات ${formatWeekdayAr(b.date)}`}
                >
                  <WeekBar bar={b} />
                </button>
              ))}
            </div>
          )}

          {range === "month" && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  disabled={cursorKey <= oldest}
                  aria-label="الشهر السابق"
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-border disabled:opacity-30"
                >
                  <Icon d={icons.chevron} size={14} />
                </button>
                <div className="text-sm font-medium">
                  {GREGORIAN_MONTHS[cursor.month - 1]} {toArabicDigits(cursor.year)}
                </div>
                <button
                  type="button"
                  onClick={() => step(1)}
                  disabled={atCurrent}
                  aria-label="الشهر التالي"
                  className="flex h-8 w-8 rotate-180 items-center justify-center rounded-xl border border-border disabled:opacity-30"
                >
                  <Icon d={icons.chevron} size={14} />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {WEEKDAY_LABELS.map((w) => (
                  <div key={w} className="pb-1 text-[9px] text-muted-foreground">
                    {w}
                  </div>
                ))}
                {cells.map((c, i) =>
                  c ? (
                    <HeatDay key={c.key} cell={c} onPick={() => setEditKey(c.key)} />
                  ) : (
                    <div key={`e${i}`} />
                  ),
                )}
              </div>
              <div className="mt-3 flex items-center justify-end gap-1.5 text-[9px] text-muted-foreground">
                أقل
                {[0, 0.2, 0.6, 1].map((r) => (
                  <span key={r} className={`h-3 w-3 rounded ${heatTone(r)}`} />
                ))}
                أكثر
              </div>
            </>
          )}

          {range === "year" && (
            <div className="flex h-36 items-end justify-between gap-1">
              {months.map((m) => (
                <div
                  key={`${m.year}-${m.month}`}
                  className="flex h-full flex-1 flex-col items-center gap-1.5"
                >
                  <div className="relative flex w-full flex-1 items-end">
                    <div
                      className={`w-full rounded-t-lg ${m.prayers ? "gradient-primary" : "bg-muted"}`}
                      style={{ height: `${Math.max(4, m.ratio * 100)}%` }}
                      title={formatPercent(pct(m.ratio))}
                    />
                  </div>
                  <span className="text-[8px] text-muted-foreground">
                    {GREGORIAN_MONTHS[m.month - 1].slice(0, 3)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex justify-between border-t border-border pt-4 text-[11px]">
            <div>
              <div className="text-[10px] text-muted-foreground">معدل الصلوات</div>
              <div className="font-display text-base font-medium tabular-nums">
                {formatPercent(pct(stats.prayerRatio))}
              </div>
            </div>
            {range === "week" && (
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground">مقارنة بالأسبوع الماضي</div>
                <div
                  className={`font-display text-base font-medium tabular-nums ${
                    weekDelta > 0
                      ? "text-emerald-500"
                      : weekDelta < 0
                        ? "text-rose-500"
                        : "text-muted-foreground"
                  }`}
                >
                  {formatPercent(weekDelta, { signed: true })}
                </div>
              </div>
            )}
            {range !== "week" && (
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground">أيام نشطة</div>
                <div className="font-display text-base font-medium tabular-nums">
                  {toArabicDigits(stats.activeDays)} من {toArabicDigits(stats.days)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 px-4 stagger">
        <Stat
          icon={icons.prayer}
          label="الصلوات"
          value={toArabicDigits(stats.prayers)}
          sub={`من ${toArabicDigits(stats.prayersPossible)}`}
          tone="gradient-primary"
        />
        <Stat
          icon={icons.quran}
          label="آيات مقروءة"
          value={toArabicDigits(stats.ayahs)}
          sub={RANGE_HINT[range]}
        />
        <Stat
          icon={icons.azkar}
          label="الأذكار"
          value={toArabicDigits(stats.azkar)}
          sub="ذكر مكتمل"
        />
        <Stat
          icon={icons.heart}
          label="جلسات الوِرد"
          value={toArabicDigits(stats.wird)}
          sub={`${toArabicDigits(stats.activeDays)} ${dayWord(stats.activeDays)} نشطة`}
          tone="gradient-gold"
        />
      </div>

      {editKey && (
        <DaySheet
          dayKeyValue={editKey}
          prayers={log.days[editKey]?.prayers ?? []}
          onClose={() => setEditKey(null)}
        />
      )}
    </>
  );
}

function heatTone(ratio: number): string {
  if (ratio <= 0) return "bg-muted";
  if (ratio < 0.4) return "bg-primary/25";
  if (ratio < 0.8) return "bg-primary/55";
  if (ratio < 1) return "bg-primary/80";
  return "gradient-primary";
}

function HeatDay({ cell, onPick }: { cell: HeatCell; onPick: () => void }) {
  return (
    <button
      type="button"
      disabled={cell.future}
      onClick={onPick}
      aria-label={`يوم ${toArabicDigits(cell.day)}: ${toArabicDigits(cell.prayers)} من ٥`}
      className={`flex aspect-square items-center justify-center rounded-lg text-[10px] tabular-nums transition disabled:opacity-30 ${heatTone(
        cell.ratio,
      )} ${cell.ratio >= 0.8 ? "text-primary-foreground" : "text-foreground"} ${
        cell.isToday ? "ring-2 ring-gold" : ""
      }`}
    >
      {toArabicDigits(cell.day)}
    </button>
  );
}

function DaySheet({
  dayKeyValue,
  prayers,
  onClose,
}: {
  dayKeyValue: string;
  prayers: PrayerKey[];
  onClose: () => void;
}) {
  const [y, m, d] = dayKeyValue.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  const [picked, setPicked] = useState<PrayerKey[]>(prayers);
  const toggle = (p: PrayerKey) =>
    setPicked((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        dir="rtl"
        role="dialog"
        aria-label="تسجيل صلوات يوم"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto w-full max-w-md rounded-t-[32px] border-t border-border bg-card p-6 shadow-elegant animate-fade-up"
      >
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted" />
        <h2 className="font-display text-lg font-medium">
          {formatWeekdayAr(date)} {toArabicDigits(d)} {GREGORIAN_MONTHS[m - 1]}
        </h2>
        <p className="mb-4 text-[11px] text-muted-foreground">
          سجّل ما صلّيته في هذا اليوم إن نسيت تسجيله في وقته.
        </p>
        <div className="grid grid-cols-5 gap-2">
          {FARD_PRAYERS.map((p) => {
            const on = picked.includes(p);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p)}
                className={`rounded-2xl border p-3 text-center transition ${
                  on
                    ? "border-transparent gradient-primary text-primary-foreground shadow-glow"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                <div className="flex justify-center">
                  <Icon d={on ? icons.check : icons.prayer} size={14} />
                </div>
                <div className="mt-1.5 text-[10px] font-medium">{PRAYER_LABELS[p].ar}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setDayPrayers(dayKeyValue, picked);
              onClose();
            }}
            className="gradient-primary rounded-2xl py-3.5 text-sm font-medium text-primary-foreground shadow-glow"
          >
            حفظ
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-border py-3.5 text-sm font-medium text-muted-foreground"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
