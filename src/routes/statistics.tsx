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
import { FARD_PRAYERS, useActivityLog, type Achievement, type DayBar } from "@/lib/activity-log";
import { PRAYER_LABELS } from "@/lib/prayer";
import { toArabicDigits } from "@/lib/format";

export const Route = createFileRoute("/statistics")({
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
                  {toArabicDigits(pct(month.prayerRatio))}٪
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
          {/* الرسم الأسبوعي */}
          <SectionLabel hint="آخر ٧ أيام">نشاط الأسبوع</SectionLabel>
          <div className="px-4">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
              <div className="flex h-36 items-end justify-between gap-2">
                {bars.map((b) => (
                  <WeekBar key={b.key} bar={b} />
                ))}
              </div>
              <div className="mt-4 flex justify-between border-t border-border pt-4 text-[11px]">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    معدل الأسبوع
                  </div>
                  <div className="font-display text-base font-medium tabular-nums">
                    {toArabicDigits(pct(week.prayerRatio))}٪
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    مقارنة بالأسبوع الماضي
                  </div>
                  <div
                    className={`font-display text-base font-medium tabular-nums ${
                      weekDelta > 0
                        ? "text-emerald-500"
                        : weekDelta < 0
                          ? "text-rose-500"
                          : "text-muted-foreground"
                    }`}
                  >
                    <span dir="ltr">
                      {weekDelta > 0 ? "+" : weekDelta < 0 ? "−" : ""}
                      {toArabicDigits(Math.abs(weekDelta))}٪
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

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

          {/* شبكة الأرقام */}
          <SectionLabel hint="آخر ٧ أيام">هذا الأسبوع</SectionLabel>
          <div className="grid grid-cols-2 gap-3 px-4 stagger">
            <Stat
              icon={icons.prayer}
              label="الصلوات"
              value={toArabicDigits(week.prayers)}
              sub={`من ${toArabicDigits(week.prayersPossible)}`}
              tone="gradient-primary"
            />
            <Stat
              icon={icons.quran}
              label="آيات مقروءة"
              value={toArabicDigits(week.ayahs)}
              sub={`${toArabicDigits(month.ayahs)} خلال ٣٠ يوماً`}
            />
            <Stat
              icon={icons.azkar}
              label="الأذكار"
              value={toArabicDigits(week.azkar)}
              sub="ذكر مكتمل"
            />
            <Stat
              icon={icons.heart}
              label="جلسات الوِرد"
              value={toArabicDigits(week.wird)}
              sub={`${toArabicDigits(week.activeDays)} ${dayWord(week.activeDays)} نشطة`}
              tone="gradient-gold"
            />
          </div>

          {/* الإنجازات */}
          <SectionLabel hint={`${toArabicDigits(unlocked)} مفتوحة`}>الإنجازات</SectionLabel>
          <div className="space-y-2 px-4 stagger">
            {achievements.map((a) => (
              <AchievementRow key={a.id} achievement={a} />
            ))}
          </div>
        </>
      )}
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
            {toArabicDigits(pct(ratio))}٪
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
