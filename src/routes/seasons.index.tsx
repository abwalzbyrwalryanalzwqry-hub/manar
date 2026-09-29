import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Arabesque,
  EmptyState,
  Icon,
  icons,
  Screen,
  ScreenHeader,
  SectionLabel,
  Skeleton,
} from "@/components/manar/shell";
import { Switch } from "@/components/manar/season-parts";
import { daysAr, phaseLabel, remainingLine, statusLine } from "@/lib/seasons/labels";
import { countAr, formatGregorianAr, formatHijriAr, toArabicDigits } from "@/lib/format";
import { hijriDisplayDate, hijriMonthName, useHijriAdjust } from "@/lib/hijri";
import { computePrayerTimes, useLocation, useNow, useSettings } from "@/lib/prayer";
import { SEASONS } from "@/lib/seasons/definitions";
import { activeSeasonNotifyCount, isSeasonNotifyOn, seasonsOverview } from "@/lib/seasons/engine";
import { useSeasonToday, useSeasonsStore } from "@/lib/seasons/store";
import { SEASON_TYPE_LABEL, type SeasonState } from "@/lib/seasons/types";

export const Route = createFileRoute("/seasons/")({
  head: () => ({
    meta: [
      { title: "مواسم منار — منار" },
      {
        name: "description",
        content: "المواسم الإيمانية على مدار العام: رمضان وعشر ذي الحجة والجمعة والأيام البيض.",
      },
    ],
  }),
  component: SeasonsPage,
});

function hijriShort(st: SeasonState) {
  const h = st.instance.hijriStart;
  return `${toArabicDigits(h.day)} ${hijriMonthName(h.month)}`;
}

function SeasonsPage() {
  const today = useSeasonToday();
  if (!today) {
    return (
      <Screen>
        <ScreenHeader title="مواسم منار" backTo="/more" />
        <div className="space-y-3 px-4">
          <Skeleton className="h-56 rounded-[28px]" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      </Screen>
    );
  }
  return <SeasonsContent now={today} />;
}

function SeasonsContent({ now }: { now: Date }) {
  const { adjust } = useHijriAdjust();
  const [showPast, setShowPast] = useState(false);
  const { store, patchNotify, setSeasonNotify } = useSeasonsStore();
  const headerDate = useHeaderHijri(adjust);
  const ov = useMemo(() => seasonsOverview(now, adjust), [now, adjust]);
  const featured = ov.featured;
  const others = [...ov.current, ...ov.around].filter(
    (s) => s.instance.key !== featured?.instance.key,
  );
  const notifyCount = activeSeasonNotifyCount(store.notify);

  return (
    <Screen>
      <ScreenHeader
        title="مواسم منار"
        subtitle={`${headerDate} · ${formatGregorianAr(now)}`}
        backTo="/more"
      />

      {/* الموسم الحالي */}
      <div className="px-4 animate-fade-up">
        {featured ? (
          <FeaturedCard st={featured} />
        ) : (
          <div className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-soft">
            <p className="text-sm font-medium">لا يوجد موسم خاص حاليًا.</p>
            {ov.nearest && (
              <Link
                to="/seasons/$season"
                params={{ season: ov.nearest.instance.season.id }}
                className="mt-4 flex items-center gap-3 rounded-2xl bg-secondary p-3"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-card text-primary">
                  <Icon d={icons[ov.nearest.instance.season.icon]} size={18} />
                </span>
                <div className="flex-1">
                  <div className="text-[11px] text-muted-foreground">أقرب موسم</div>
                  <div className="text-sm font-medium">{ov.nearest.instance.season.title}</div>
                </div>
                <span className="text-[12px] font-medium text-primary">
                  بعد {daysAr(ov.nearest.daysUntil)}
                </span>
              </Link>
            )}
          </div>
        )}
      </div>

      {others.length > 0 && (
        <>
          <SectionLabel>اليوم أيضًا</SectionLabel>
          <div className="space-y-2 px-4 stagger">
            {others.map((s) => (
              <SeasonRow key={s.instance.key} st={s} trailing={statusLine(s)} />
            ))}
          </div>
        </>
      )}

      <SectionLabel hint="عدّ تنازلي">المواسم القادمة</SectionLabel>
      <div className="space-y-2 px-4 stagger">
        {ov.upcoming.map((s) => (
          <SeasonRow
            key={s.instance.key}
            st={s}
            trailing={s.daysUntil === 1 ? "غدًا" : `بعد ${daysAr(s.daysUntil)}`}
            sub={`${hijriShort(s)} · ${formatGregorianAr(s.instance.startDate)}`}
          />
        ))}
      </div>

      <SectionLabel hint="كل أسبوع وكل شهر">أيام متكررة</SectionLabel>
      <div className="space-y-2 px-4 stagger">
        {ov.recurring.map((s) => (
          <SeasonRow
            key={s.instance.key}
            st={s}
            trailing={s.daysUntil === 1 ? "غدًا" : `بعد ${daysAr(s.daysUntil)}`}
            sub={`${hijriShort(s)} · ${formatGregorianAr(s.instance.startDate)}`}
          />
        ))}
      </div>

      {/* المواسم الماضية — قابلة للطي */}
      <div className="mt-7 px-4">
        <button
          type="button"
          onClick={() => setShowPast((v) => !v)}
          aria-expanded={showPast}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-soft"
        >
          <span className="text-sm font-medium">المواسم الماضية</span>
          <span
            className={`text-muted-foreground transition ${showPast ? "-rotate-90" : "rotate-90"}`}
          >
            <Icon d={icons.chevron} size={16} />
          </span>
        </button>
        {showPast && (
          <div className="mt-2 space-y-2 animate-fade-up">
            {ov.past.length ? (
              ov.past.map((s) => (
                <SeasonRow
                  key={s.instance.key}
                  st={s}
                  trailing="انتهى الموسم."
                  sub={`${hijriShort(s)} ${toArabicDigits(s.instance.hijriStart.year)}`}
                  muted
                />
              ))
            ) : (
              <EmptyState icon={icons.calendar} title="لا توجد مواسم ماضية لعرضها" />
            )}
          </div>
        )}
      </div>

      {/* تنبيهات المواسم */}
      <SectionLabel>تنبيهات المواسم</SectionLabel>
      <div className="space-y-2 px-4">
        <button
          type="button"
          role="switch"
          aria-checked={store.notify.enabled}
          onClick={() => patchNotify({ enabled: !store.notify.enabled })}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-right shadow-soft"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
            <Icon d={store.notify.enabled ? icons.bell : icons.bellOff} size={20} />
          </span>
          <div className="flex-1">
            <div className="text-sm font-medium">تنبيهات المواسم</div>
            <div className="text-[11px] text-muted-foreground">
              {store.notify.enabled
                ? notifyCount > 0
                  ? `مفعّلة: ${countAr(notifyCount, "موسم", "موسمان", "مواسم")} · تعمل دون إنترنت`
                  : "لا موسم مفعّل"
                : "متوقفة"}
            </div>
          </div>
          <Switch on={store.notify.enabled} />
        </button>

        {store.notify.enabled && (
          <>
            {/* أوقات التذكير — إعداد واحد لكل المواسم */}
            <div className="grid grid-cols-2 gap-2">
              <TimeField
                label="تذكير الصباح"
                value={store.notify.morning}
                onChange={(t) => patchNotify({ morning: t })}
              />
              <TimeField
                label="تذكير المساء"
                value={store.notify.evening}
                onChange={(t) => patchNotify({ evening: t })}
              />
            </div>

            {/* كل المواسم في مكان واحد */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              {notifySeasons.map((s, i) => {
                const on = isSeasonNotifyOn(s, store.notify);
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => setSeasonNotify(s.id, !on)}
                    className={`flex w-full items-center gap-3 p-3 text-right ${
                      i > 0 ? "border-t border-border" : ""
                    }`}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
                      <Icon d={icons[s.icon]} size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{s.title}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {countAr(s.reminders.length, "تذكير", "تذكيران", "تذكيرات")}
                      </div>
                    </div>
                    <Switch on={on} />
                  </button>
                );
              })}
            </div>
          </>
        )}
        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          تنبيه واحد كحد أقصى صباحًا ومساءً، والموسم الأعلى أولوية يتقدّم عند التزامن.
        </p>
      </div>
    </Screen>
  );
}

/** المواسم التي لها تذكيرات — لقائمة التفعيل. */
const notifySeasons = SEASONS.filter((s) => s.enabled && s.reminders.length > 0);

function toHHMM(t: { hour: number; minute: number }) {
  return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { hour: number; minute: number };
  onChange: (t: { hour: number; minute: number }) => void;
}) {
  return (
    <label className="rounded-2xl border border-border bg-card p-3 text-center">
      <span className="block text-[10px] text-muted-foreground">{label}</span>
      <input
        type="time"
        value={toHHMM(value)}
        onChange={(e) => {
          if (!e.target.value) return;
          const [h, m] = e.target.value.split(":").map(Number);
          onChange({ hour: h || 0, minute: m || 0 });
        }}
        className="mt-1 w-full bg-transparent text-center text-sm tabular-nums outline-none"
      />
    </label>
  );
}

/**
 * التاريخ الهجري في العنوان كما في الرئيسية والتقويم: بعد المغرب هو الغد إن
 * اختار المستخدم «بداية اليوم الهجري عند المغرب». يُحدَّث كل دقيقة، ومواقيت
 * اليوم تُحسب مرة لليوم. (حساب المواسم نفسه يبقى باليوم المدني.)
 */
function useHeaderHijri(adjust: number): string {
  const { atMaghrib } = useHijriAdjust();
  const now = useNow(60_000);
  const { location } = useLocation();
  const { settings } = useSettings();
  const dayStamp = now.toDateString();
  const maghrib = useMemo(
    () =>
      atMaghrib ? computePrayerTimes(location, settings, new Date(dayStamp), adjust).maghrib : null,
    [atMaghrib, location, settings, dayStamp, adjust],
  );
  return formatHijriAr(hijriDisplayDate(now, maghrib, atMaghrib), adjust);
}

function FeaturedCard({ st }: { st: SeasonState }) {
  const s = st.instance.season;
  const remaining = remainingLine(st);
  return (
    <div className="gradient-hero relative overflow-hidden rounded-[28px] p-6 text-white shadow-elegant">
      <Arabesque className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 text-gold/20" />
      <div className="relative">
        <div className="flex items-center gap-3">
          <span className="gradient-gold flex h-12 w-12 items-center justify-center rounded-2xl text-navy shadow-gold">
            <Icon d={icons[s.icon]} size={22} />
          </span>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/60">
              {st.status === "current" ? "الموسم الحالي" : SEASON_TYPE_LABEL[s.type]}
            </div>
            <h2 className="font-display text-2xl font-medium">{s.title}</h2>
          </div>
        </div>
        {phaseLabel(st) && (
          <div className="mt-4 text-sm font-medium text-gold">{phaseLabel(st)}</div>
        )}
        <p className="mt-1 text-sm text-white/85">{statusLine(st)}</p>
        {remaining && <p className="text-[12px] text-white/60">{remaining}</p>}
        <p className="mt-3 text-[13px] leading-relaxed text-white/75">{s.description}</p>
        <Link
          to="/seasons/$season"
          params={{ season: s.id }}
          className="gradient-gold mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-medium text-navy shadow-gold transition active:scale-95"
        >
          ابدأ رحلة الموسم
          <span className="rotate-180">
            <Icon d={icons.chevron} size={14} />
          </span>
        </Link>
      </div>
    </div>
  );
}

function SeasonRow({
  st,
  trailing,
  sub,
  muted,
}: {
  st: SeasonState;
  trailing: string;
  sub?: string;
  muted?: boolean;
}) {
  const s = st.instance.season;
  return (
    <Link
      to="/seasons/$season"
      params={{ season: s.id }}
      className={`flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:shadow-elegant ${muted ? "opacity-75" : ""}`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon d={icons[s.icon]} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{s.title}</div>
        <div className="truncate text-[11px] text-muted-foreground">
          {sub ?? (st.phase?.title || SEASON_TYPE_LABEL[s.type])}
        </div>
      </div>
      <span className="shrink-0 text-[11px] font-medium text-primary">{trailing}</span>
    </Link>
  );
}
