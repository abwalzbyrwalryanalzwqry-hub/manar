import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  EmptyState,
  Icon,
  icons,
  RingProgress,
  Screen,
  ScreenHeader,
  SectionLabel,
  Skeleton,
} from "@/components/manar/shell";
import { SeasonContentList, SeasonLinkTo, Switch } from "@/components/manar/season-parts";
import { daysAr, phaseLabel, remainingLine, statusLine } from "@/lib/seasons/labels";
import { dayKey, useActivityLog } from "@/lib/activity-log";
import {
  ampmAr,
  formatArTime,
  formatCountdown,
  formatGregorianAr,
  formatWeekdayAr,
  toArabicDigits,
} from "@/lib/format";
import { hijriMonthName, useHijriAdjust } from "@/lib/hijri";
import { computeSunnahTimes, PRAYER_LABELS, usePrayerSchedule } from "@/lib/prayer";
import {
  findSeason,
  getSeasonState,
  importantDaysOf,
  isSeasonNotifyOn,
} from "@/lib/seasons/engine";
import {
  defaultGoal,
  goalProgress,
  useSeasonToday,
  useSeasonsStore,
  type GoalState,
} from "@/lib/seasons/store";
import {
  SEASON_TYPE_LABEL,
  type GoalFrequency,
  type Season,
  type SeasonAction,
  type SeasonPanel,
  type SeasonState,
} from "@/lib/seasons/types";

export const Route = createFileRoute("/seasons/$season")({
  head: ({ params }) => {
    const s = findSeason(params.season);
    return { meta: [{ title: `${s?.title ?? "موسم"} — منار` }] };
  },
  component: SeasonPage,
});

function SeasonPage() {
  const { season: id } = Route.useParams();
  const season = findSeason(id);
  const { adjust } = useHijriAdjust();
  const now = useSeasonToday();
  const st = useMemo(
    () => (season && now ? getSeasonState(season, now, adjust) : null),
    [season, now, adjust],
  );

  if (season && !now) {
    return (
      <Screen>
        <ScreenHeader
          title={season.title}
          subtitle={SEASON_TYPE_LABEL[season.type]}
          backTo="/seasons"
        />
        <div className="space-y-3 px-4">
          <Skeleton className="h-36 rounded-[28px]" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      </Screen>
    );
  }

  if (!season || !st || !now) {
    return (
      <Screen>
        <ScreenHeader title="مواسم منار" backTo="/seasons" />
        <EmptyState
          icon={icons.calendar}
          title="تعذّر العثور على هذا الموسم"
          hint="ارجع إلى صفحة المواسم لاختيار موسم آخر."
        />
      </Screen>
    );
  }

  return <SeasonDetail season={season} st={st} now={now} />;
}

function SeasonDetail({ season, st, now }: { season: Season; st: SeasonState; now: Date }) {
  const phaseId = st.phase?.id;
  const actions = season.recommendedActions.filter(
    (a) => !a.phases || (phaseId ? a.phases.includes(phaseId) : false),
  );
  const content = [...(st.phase?.content ?? []), ...season.educationalContent];
  const days = importantDaysOf(st.instance, now);
  const h = st.instance.hijriStart;
  const he = st.instance.hijriEnd;
  const range =
    st.instance.length === 1
      ? `${toArabicDigits(h.day)} ${hijriMonthName(h.month)} · ${formatWeekdayAr(st.instance.startDate)} ${formatGregorianAr(st.instance.startDate)}`
      : `${toArabicDigits(h.day)} ${hijriMonthName(h.month)} – ${toArabicDigits(he.day)} ${hijriMonthName(he.month)} ${toArabicDigits(he.year)}`;
  const remaining = remainingLine(st);

  return (
    <Screen>
      <ScreenHeader
        title={season.title}
        subtitle={SEASON_TYPE_LABEL[season.type]}
        backTo="/seasons"
      />

      {/* الرأس: المرحلة، التاريخ، العد التنازلي أو التقدّم */}
      <div className="px-4 animate-fade-up">
        <div className="relative overflow-hidden rounded-[28px] border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center gap-4">
            <RingProgress
              value={st.status === "current" ? st.progress : st.status === "ended" ? 1 : 0}
              size={92}
              stroke={7}
            >
              <div className="text-center">
                {st.status === "current" ? (
                  <>
                    <div className="font-display text-xl font-medium">
                      {toArabicDigits(st.dayNumber ?? 1)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      من {toArabicDigits(st.instance.length)}
                    </div>
                  </>
                ) : st.status === "upcoming" ? (
                  <>
                    <div className="font-display text-xl font-medium">
                      {toArabicDigits(st.daysUntil)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {st.daysUntil === 1 ? "يوم" : "أيام"}
                    </div>
                  </>
                ) : (
                  <span className="text-primary">
                    <Icon d={icons.check} size={22} />
                  </span>
                )}
              </div>
            </RingProgress>
            <div className="min-w-0 flex-1">
              {phaseLabel(st) && (
                <div className="inline-flex rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-primary">
                  {phaseLabel(st)}
                </div>
              )}
              <p className="mt-2 text-sm font-medium">{statusLine(st)}</p>
              {remaining && <p className="text-[12px] text-muted-foreground">{remaining}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">{range}</p>
            </div>
          </div>
          {st.phase?.subtitle && (
            <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
              {st.phase.subtitle}
            </p>
          )}
        </div>
      </div>

      {/* المراحل */}
      {season.phases.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto px-4 pb-1" role="list">
          {season.phases.map((p) => (
            <span
              key={p.id}
              role="listitem"
              aria-current={p.id === phaseId ? "step" : undefined}
              ref={
                p.id === phaseId
                  ? (el) => el?.scrollIntoView({ block: "nearest", inline: "center" })
                  : undefined
              }
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium ${
                p.id === phaseId
                  ? "gradient-primary text-white shadow-soft"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {p.title}
            </span>
          ))}
        </div>
      )}

      {/* لوحات من خدمات التطبيق */}
      {st.status === "current" && st.phase?.panels?.map((p) => <Panel key={p} kind={p} />)}

      {/* التعريف */}
      <SectionLabel>عن الموسم</SectionLabel>
      <p className="px-5 text-[13px] leading-relaxed text-muted-foreground">{season.description}</p>
      {content.length > 0 && (
        <div className="mt-3">
          <SeasonContentList blocks={content} />
        </div>
      )}

      {/* أعمال الموسم */}
      {actions.length > 0 && (
        <>
          <SectionLabel>أعمال الموسم</SectionLabel>
          <div className="space-y-2 px-4 stagger">
            {actions.map((a) => (
              <ActionRow key={a.id} action={a} />
            ))}
          </div>
        </>
      )}

      {/* الأيام المهمة */}
      {days.length > 0 && (
        <>
          <SectionLabel>الأيام المهمة</SectionLabel>
          <div className="space-y-2 px-4">
            {days.map((d) => (
              <div
                key={d.id}
                className={`flex items-center gap-3 rounded-2xl border p-4 ${
                  d.status === "today" ? "border-primary/40 bg-secondary" : "border-border bg-card"
                } ${d.status === "past" ? "opacity-70" : ""}`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-card text-primary">
                  <Icon d={d.status === "past" ? icons.check : icons.calendar} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{d.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatWeekdayAr(d.date)} {formatGregorianAr(d.date)}
                    {d.note ? ` · ${d.note}` : ""}
                  </div>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-primary">
                  {d.status === "today"
                    ? "اليوم"
                    : d.diff === 1
                      ? "غدًا"
                      : d.diff > 0
                        ? `بعد ${daysAr(d.diff)}`
                        : "مضى"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <PlanSection season={season} st={st} now={now} />
      <RemindersSection season={season} />

      {season.references.length > 0 && (
        <>
          <SectionLabel>المصادر</SectionLabel>
          <ul className="space-y-1 px-5 text-[11px] leading-relaxed text-muted-foreground">
            {season.references.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </>
      )}
    </Screen>
  );
}

/* ------------------------------ اللوحات ------------------------------ */

function Panel({ kind }: { kind: SeasonPanel }) {
  const { today, next, remainingMs } = usePrayerSchedule();
  if (kind === "fasting-times") {
    const cd = formatCountdown(remainingMs);
    return (
      <div className="mt-4 px-4 animate-fade-up">
        <div className="grid grid-cols-3 gap-2">
          <TimeTile
            label="الإمساك (الفجر)"
            value={formatArTime(today.fajr)}
            sub={ampmAr(today.fajr)}
          />
          <TimeTile
            label="الإفطار (المغرب)"
            value={formatArTime(today.maghrib)}
            sub={ampmAr(today.maghrib)}
          />
          <Link to="/prayer" className="block">
            <TimeTile label={`حتى ${PRAYER_LABELS[next.key].ar}`} value={cd.compact} />
          </Link>
        </div>
        <p className="mt-2 px-1 text-[10px] text-muted-foreground">
          من مواقيت الصلاة في التطبيق حسب موقعك وطريقة الحساب المختارة.
        </p>
      </div>
    );
  }
  const sunnah = computeSunnahTimes(today);
  return (
    <div className="mt-4 px-4 animate-fade-up">
      <div className="grid grid-cols-2 gap-2">
        <TimeTile label="العشاء" value={formatArTime(today.isha)} sub={ampmAr(today.isha)} />
        <TimeTile
          label="بداية الثلث الأخير"
          value={formatArTime(sunnah.lastThirdOfTheNight)}
          sub={ampmAr(sunnah.lastThirdOfTheNight)}
        />
      </div>
      <p className="mt-2 px-1 text-[10px] text-muted-foreground">
        الثلث الأخير تقريبي: بين المغرب وفجر الغد.
      </p>
    </div>
  );
}

function TimeTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-soft">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-base font-medium tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

/* ------------------------------ الأعمال ------------------------------ */

function ActionRow({ action }: { action: SeasonAction }) {
  const body = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon d={icons.sparkle} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{action.title}</div>
        {action.hint && (
          <div className="text-[11px] leading-relaxed text-muted-foreground">{action.hint}</div>
        )}
      </div>
      {action.link && (
        <span className="rotate-180 text-muted-foreground">
          <Icon d={icons.chevron} size={16} />
        </span>
      )}
    </>
  );
  const cls = "flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft";
  return action.link ? (
    <SeasonLinkTo link={action.link} className={`${cls} transition hover:shadow-elegant`}>
      {body}
    </SeasonLinkTo>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* ------------------------------ خطتي في الموسم ------------------------------ */

const FREQ_LABEL: Record<GoalFrequency, string> = {
  daily: "كل يوم",
  once: "مرة واحدة",
  count: "عدد أيام",
};

function PlanSection({ season, st, now }: { season: Season; st: SeasonState; now: Date }) {
  const { store, patchGoal, toggleDone } = useSeasonsStore();
  const { log } = useActivityLog();
  const goals = season.recommendedActions.filter((a) => a.goal);
  if (!goals.length || st.status === "ended") return null;

  const key = st.instance.key;
  const plan = store.plans[key] ?? {};
  const active = goals.filter((a) => plan[a.id]?.enabled);
  const available = goals.filter((a) => !plan[a.id]?.enabled);
  const todayKeyDate = now;
  const canMark = st.status === "current";

  return (
    <>
      <SectionLabel hint="اختياري">خطتي في الموسم</SectionLabel>
      <div className="space-y-2 px-4">
        {active.length === 0 && (
          <p className="px-1 text-[12px] leading-relaxed text-muted-foreground">
            اختر ما يناسبك من الأعمال لتتابع تقدّمك فيها خلال الموسم.
          </p>
        )}
        {active.map((a) => {
          const g = plan[a.id] as GoalState;
          const p = goalProgress(g, a, st.instance, log, todayKeyDate);
          const unit = g.frequency === "once" ? "" : " يومًا";
          return (
            <div key={a.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <RingProgress value={p.target ? p.done / p.target : 0} size={44} stroke={4}>
                  <span className="text-primary">
                    <Icon d={p.complete ? icons.check : icons.target} size={16} />
                  </span>
                </RingProgress>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {toArabicDigits(p.done)} / {toArabicDigits(p.target)}
                    {unit}
                    {a.goal?.auto ? " · يُحتسب تلقائيًا من نشاطك" : ""}
                  </div>
                </div>
                {canMark && (
                  <button
                    type="button"
                    onClick={() => toggleDone(key, a, dayKey(now))}
                    aria-pressed={p.todayDone}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition active:scale-95 ${
                      p.todayDone ? "gradient-primary text-white" : "bg-secondary text-primary"
                    }`}
                  >
                    {p.todayDone ? "أُنجز اليوم" : "أنجزته اليوم"}
                  </button>
                )}
              </div>
              {canMark && !p.todayDone && !p.complete && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  لم تكمل هدف اليوم. يمكنك إكماله لاحقًا.
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(Object.keys(FREQ_LABEL) as GoalFrequency[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => patchGoal(key, a, { frequency: f })}
                    aria-pressed={g.frequency === f}
                    className={`rounded-full px-3 py-1 text-[11px] ${
                      g.frequency === f
                        ? "bg-secondary font-medium text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {FREQ_LABEL[f]}
                  </button>
                ))}
                {g.frequency === "count" && (
                  <span className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="إنقاص"
                      onClick={() => patchGoal(key, a, { target: Math.max(1, g.target - 1) })}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-primary"
                    >
                      <Icon d={icons.minus} size={12} />
                    </button>
                    <span className="w-6 text-center text-[12px] tabular-nums">
                      {toArabicDigits(g.target)}
                    </span>
                    <button
                      type="button"
                      aria-label="زيادة"
                      onClick={() =>
                        patchGoal(key, a, { target: Math.min(st.instance.length, g.target + 1) })
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-primary"
                    >
                      <Icon d={icons.plus} size={12} />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => patchGoal(key, a, { enabled: false })}
                  className="ms-auto rounded-full px-3 py-1 text-[11px] text-muted-foreground"
                >
                  إيقاف
                </button>
              </div>
            </div>
          );
        })}
        {available.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => patchGoal(key, a, { ...(plan[a.id] ?? defaultGoal(a)), enabled: true })}
            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border p-3 text-right"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-primary">
              <Icon d={icons.plus} size={14} />
            </span>
            <span className="flex-1 text-[13px]">{a.title}</span>
            <span className="text-[10px] text-muted-foreground">
              {FREQ_LABEL[a.goal?.frequency ?? "daily"]}
            </span>
          </button>
        ))}
        {active.length > 0 && (
          <p className="px-1 text-[11px] text-muted-foreground">استمر في رحلتك.</p>
        )}
      </div>
    </>
  );
}

/* ------------------------------ التذكيرات ------------------------------ */

function toHHMM(t: { hour: number; minute: number }) {
  return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}

function fromHHMM(v: string) {
  const [h, m] = v.split(":").map(Number);
  return { hour: h || 0, minute: m || 0 };
}

function RemindersSection({ season }: { season: Season }) {
  const { store, setSeasonNotify, patchNotify } = useSeasonsStore();
  if (!season.reminders.length) return null;
  const on = isSeasonNotifyOn(season, store.notify);
  const master = store.notify.enabled;

  return (
    <>
      <SectionLabel>التذكيرات</SectionLabel>
      <div className="space-y-2 px-4">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={!master}
          onClick={() => setSeasonNotify(season.id, !on)}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-right shadow-soft disabled:opacity-60"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
            <Icon d={on && master ? icons.bell : icons.bellOff} size={18} />
          </span>
          <div className="flex-1">
            <div className="text-sm font-medium">تذكيرات {season.shortTitle}</div>
            <div className="text-[11px] text-muted-foreground">
              {master
                ? `${toArabicDigits(season.reminders.length)} تذكيرات هادئة في أيامها فقط`
                : "تنبيهات المواسم متوقفة من صفحة المواسم"}
            </div>
          </div>
          <Switch on={on && master} />
        </button>
        {master && on && (
          <div className="grid grid-cols-2 gap-2">
            <label className="rounded-2xl border border-border bg-card p-3 text-center">
              <span className="block text-[10px] text-muted-foreground">تذكير الصباح</span>
              <input
                type="time"
                value={toHHMM(store.notify.morning)}
                onChange={(e) =>
                  e.target.value && patchNotify({ morning: fromHHMM(e.target.value) })
                }
                className="mt-1 w-full bg-transparent text-center text-sm tabular-nums outline-none"
              />
            </label>
            <label className="rounded-2xl border border-border bg-card p-3 text-center">
              <span className="block text-[10px] text-muted-foreground">تذكير المساء</span>
              <input
                type="time"
                value={toHHMM(store.notify.evening)}
                onChange={(e) =>
                  e.target.value && patchNotify({ evening: fromHHMM(e.target.value) })
                }
                className="mt-1 w-full bg-transparent text-center text-sm tabular-nums outline-none"
              />
            </label>
          </div>
        )}
        <ul className="space-y-1 px-1 text-[11px] leading-relaxed text-muted-foreground">
          {season.reminders.map((r) => (
            <li key={r.id}>• {r.title}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
